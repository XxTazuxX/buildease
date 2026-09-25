package com.buildease.marketing;

import com.buildease.auth.Actor;
import com.buildease.common.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ListingService {
  private final Store db;
  private final ListingSyndicationAdapter syndication;

  public ListingService(Store db, ListingSyndicationAdapter syndication) {
    this.db = db;
    this.syndication = syndication;
  }

  private Access enter(Actor actor, UUID organization, UUID building) {
    db.context(actor.id(), null, actor.impersonatedBy());
    var membership =
        db.find(
            "select owner from memberships where organization_id=? and account_id=? and status='ACTIVE'",
            organization,
            actor.id());
    if (!actor.admin() && membership.isEmpty()) throw ApiException.forbidden();
    db.context(actor.id(), organization, actor.impersonatedBy());
    db.one("select id from organizations where id=? and active for update", organization);
    db.one("select id from buildings where organization_id=? and id=?", organization, building);
    Set<String> roles = new HashSet<>();
    db.rows(
            "select role from building_roles where organization_id=? and building_id=? and account_id=?",
            organization,
            building,
            actor.id())
        .forEach(row -> roles.add((String) row.get("role")));
    boolean owner =
        actor.admin() || membership.map(row -> (boolean) row.get("owner")).orElse(false);
    return new Access(owner, owner || roles.contains("PROPERTY_MANAGER"), roles);
  }

  private void manager(Actor actor, UUID organization, UUID building) {
    if (!enter(actor, organization, building).manager()) throw ApiException.forbidden();
  }

  public UUID create(
      Actor actor,
      UUID organization,
      UUID building,
      UUID space,
      String headline,
      String description,
      BigDecimal rentAmount) {
    manager(actor, organization, building);
    var spaceRow =
        db.one(
            "select rentable,status from spaces where organization_id=? and building_id=? and id=?",
            organization,
            building,
            space);
    if (!(boolean) spaceRow.get("rentable"))
      throw new ApiException(409, "Space is not marked rentable");
    if (!Set.of("VACANT", "RESERVED").contains(spaceRow.get("status")))
      throw new ApiException(409, "Space must be vacant or reserved to list it");
    String currency =
        (String)
            db.one(
                    "select currency from buildings where id=? and organization_id=?",
                    building,
                    organization)
                .get("currency");
    UUID id = UUID.randomUUID();
    db.update(
        "insert into listings(id,organization_id,building_id,space_id,headline,description,rent_amount,currency,created_by) values (?,?,?,?,?,?,?,?,?)",
        id,
        organization,
        building,
        space,
        headline.trim(),
        description.trim(),
        rentAmount,
        currency,
        actor.id());
    db.audit(actor.id(), organization, "LISTING_CREATED", id);
    return id;
  }

  public void publish(
      Actor actor, UUID organization, UUID building, UUID listing, Set<ListingChannel> channels) {
    manager(actor, organization, building);
    var row = lockedListing(organization, building, listing);
    ListingStatus current = ListingStatus.valueOf((String) row.get("status"));
    if (current == ListingStatus.PUBLISHED)
      throw new ApiException(409, "Listing is already published");
    for (ListingChannel channel : channels) {
      var result =
          syndication.publish(
              channel,
              listing,
              (String) row.get("headline"),
              (String) row.get("description"),
              (BigDecimal) row.get("rent_amount"),
              (String) row.get("currency"));
      db.update(
          "insert into listing_syndications(id,organization_id,building_id,listing_id,channel,status,external_id) values (?,?,?,?,?,?,?) "
              + "on conflict(listing_id,channel) do update set status=excluded.status,external_id=excluded.external_id,synced_at=now()",
          UUID.randomUUID(),
          organization,
          building,
          listing,
          channel.name(),
          result.status().name(),
          result.externalId());
    }
    try {
      db.update(
          "update listings set status='PUBLISHED',published_at=now(),unpublished_at=null,updated_at=now() where id=?",
          listing);
    } catch (DataIntegrityViolationException e) {
      throw new ApiException(409, "This space already has a published listing");
    }
    db.audit(actor.id(), organization, "LISTING_PUBLISHED", listing);
  }

  public void unpublish(Actor actor, UUID organization, UUID building, UUID listing) {
    manager(actor, organization, building);
    var row = lockedListing(organization, building, listing);
    ListingStatus current = ListingStatus.valueOf((String) row.get("status"));
    if (current != ListingStatus.PUBLISHED) throw new ApiException(409, "Listing is not published");
    for (var syndicated :
        db.rows(
            "select channel,external_id from listing_syndications where organization_id=? and building_id=? and listing_id=? and status='SYNDICATED'",
            organization,
            building,
            listing)) {
      syndication.remove(
          ListingChannel.valueOf((String) syndicated.get("channel")),
          (String) syndicated.get("external_id"));
      db.update(
          "update listing_syndications set status='REMOVED',synced_at=now() where organization_id=? and building_id=? and listing_id=? and channel=?",
          organization,
          building,
          listing,
          syndicated.get("channel"));
    }
    db.update(
        "update listings set status='UNPUBLISHED',unpublished_at=now(),updated_at=now() where id=?",
        listing);
    db.audit(actor.id(), organization, "LISTING_UNPUBLISHED", listing);
  }

  public List<Map<String, Object>> list(
      Actor actor, UUID organization, UUID building, ListingStatus status, int page) {
    manager(actor, organization, building);
    if (page < 0 || page > 10000) throw new ApiException(400, "Invalid page");
    List<Object> args = new ArrayList<>(List.of(organization, building));
    StringBuilder sql =
        new StringBuilder(
            "select id,space_id,headline,rent_amount,currency,status,published_at from listings where organization_id=? and building_id=?");
    if (status != null) {
      sql.append(" and status=?");
      args.add(status.name());
    }
    sql.append(" order by created_at desc,id limit 50 offset ?");
    args.add(page * 50);
    return db.rows(sql.toString(), args.toArray());
  }

  public Map<String, Object> detail(Actor actor, UUID organization, UUID building, UUID listing) {
    manager(actor, organization, building);
    var row =
        db.one(
            "select id,space_id,headline,description,rent_amount,currency,status,published_at,unpublished_at from listings where organization_id=? and building_id=? and id=?",
            organization,
            building,
            listing);
    var result = new LinkedHashMap<>(row);
    result.put(
        "syndications",
        db.rows(
            "select channel,status,external_id,synced_at from listing_syndications where organization_id=? and building_id=? and listing_id=? order by channel",
            organization,
            building,
            listing));
    return result;
  }

  private Map<String, Object> lockedListing(UUID organization, UUID building, UUID listing) {
    return db.one(
        "select * from listings where organization_id=? and building_id=? and id=? for update",
        organization,
        building,
        listing);
  }

  private record Access(boolean owner, boolean manager, Set<String> roles) {}
}
