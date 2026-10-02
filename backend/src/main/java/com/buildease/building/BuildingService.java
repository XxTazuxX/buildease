package com.buildease.building;

import com.buildease.auth.Actor;
import com.buildease.billing.SubscriptionService;
import com.buildease.common.ApiException;
import com.buildease.common.Store;
import java.math.BigDecimal;
import java.time.ZoneId;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class BuildingService {
  private final Store db;

  private final SubscriptionService subscriptions;

  public BuildingService(Store db, SubscriptionService subscriptions) {
    this.db = db;
    this.subscriptions = subscriptions;
  }

  private boolean enter(Actor actor, UUID organization, UUID building) {
    db.context(actor.id(), null, actor.impersonatedBy());
    if (db.find("select 1 from accounts where id=? and active", actor.id()).isEmpty())
      throw ApiException.forbidden();
    var membership =
        db.find(
            "select owner from memberships where organization_id=? and account_id=? and status='ACTIVE'",
            organization,
            actor.id());
    if (!actor.admin() && membership.isEmpty()) throw ApiException.forbidden();
    db.context(actor.id(), organization, actor.impersonatedBy());
    db.one("select id from organizations where id=? and active for update", organization);
    db.one("select id from buildings where organization_id=? and id=?", organization, building);
    boolean owner = actor.admin() || membership.map(m -> (boolean) m.get("owner")).orElse(false);
    if (!owner
        && db.find(
                "select 1 from building_roles where organization_id=? and building_id=? and account_id=?",
                organization,
                building,
                actor.id())
            .isEmpty()) throw ApiException.forbidden();
    return owner;
  }

  /** Owners, and property managers of this building ({@code building:manage}), may configure it. */
  private void owner(Actor actor, UUID organization, UUID building) {
    if (enter(actor, organization, building)) return;
    if (db.find(
            "select 1 from building_roles where organization_id=? and building_id=? and account_id=? and role='PROPERTY_MANAGER'",
            organization,
            building,
            actor.id())
        .isEmpty()) throw ApiException.forbidden();
  }

  public Map<String, Object> building(Actor actor, UUID organization, UUID building) {
    enter(actor, organization, building);
    return db.one(
        "select id,name,code,address_line1,address_line2,city,region,postal_code,country_code,timezone,currency,emergency_contact,late_fee_amount,late_fee_grace_days from buildings where organization_id=? and id=?",
        organization,
        building);
  }

  public void configure(
      Actor actor,
      UUID organization,
      UUID building,
      String name,
      String addressLine1,
      String addressLine2,
      String city,
      String region,
      String postalCode,
      String countryCode,
      String timezone,
      String currency,
      String emergencyContact,
      BigDecimal lateFeeAmount,
      int lateFeeGraceDays) {
    owner(actor, organization, building);
    try {
      ZoneId.of(timezone);
    } catch (Exception e) {
      throw new ApiException(400, "Unknown timezone");
    }
    String currentCurrency =
        (String)
            db.one(
                    "select currency from buildings where organization_id=? and id=?",
                    organization,
                    building)
                .get("currency");
    if (currency != null
        && !currency.equalsIgnoreCase(currentCurrency)
        && db.find(
                "select 1 from leases where organization_id=? and building_id=? limit 1",
                organization,
                building)
            .isPresent())
      throw new ApiException(409, "Currency cannot change once leases exist for this building");
    db.update(
        "update buildings set name=?,address_line1=?,address_line2=?,city=?,region=?,postal_code=?,country_code=?,timezone=?,currency=?,emergency_contact=?,late_fee_amount=?,late_fee_grace_days=?,updated_at=now() where organization_id=? and id=?",
        name,
        blank(addressLine1),
        blank(addressLine2),
        blank(city),
        blank(region),
        blank(postalCode),
        upper(countryCode),
        timezone,
        upper(currency),
        blank(emergencyContact),
        lateFeeAmount,
        lateFeeGraceDays,
        organization,
        building);
    db.audit(actor.id(), organization, "BUILDING_CONFIGURED", building);
  }

  public List<Map<String, Object>> levels(Actor actor, UUID organization, UUID building) {
    enter(actor, organization, building);
    return db.rows(
        "select id,name,code,sort_order,active from building_levels where organization_id=? and building_id=? order by sort_order,name,id",
        organization,
        building);
  }

  public UUID createLevel(
      Actor actor, UUID organization, UUID building, String name, String code, int sortOrder) {
    owner(actor, organization, building);
    UUID id = UUID.randomUUID();
    db.update(
        "insert into building_levels(id,organization_id,building_id,name,code,sort_order) values (?,?,?,?,?,?)",
        id,
        organization,
        building,
        name,
        upper(code),
        sortOrder);
    db.audit(actor.id(), organization, "BUILDING_LEVEL_CREATED", id);
    return id;
  }

  public void updateLevel(
      Actor actor,
      UUID organization,
      UUID building,
      UUID level,
      String name,
      String code,
      int sortOrder) {
    owner(actor, organization, building);
    lockedLevel(organization, building, level);
    try {
      db.update(
          "update building_levels set name=?,code=?,sort_order=?,updated_at=now() where organization_id=? and building_id=? and id=?",
          name,
          upper(code),
          sortOrder,
          organization,
          building,
          level);
    } catch (DataIntegrityViolationException e) {
      throw new ApiException(409, "Another level already uses this code");
    }
    db.audit(actor.id(), organization, "BUILDING_LEVEL_UPDATED", level);
  }

  public void deleteLevel(Actor actor, UUID organization, UUID building, UUID level) {
    owner(actor, organization, building);
    lockedLevel(organization, building, level);
    if (db.find(
            "select 1 from spaces where organization_id=? and building_id=? and level_id=? limit 1",
            organization,
            building,
            level)
        .isPresent()) throw new ApiException(409, "Move or delete the spaces on this level first");
    db.update(
        "delete from building_levels where organization_id=? and building_id=? and id=?",
        organization,
        building,
        level);
    db.audit(actor.id(), organization, "BUILDING_LEVEL_DELETED", level);
  }

  public void updateSpace(
      Actor actor,
      UUID organization,
      UUID building,
      UUID space,
      UUID level,
      UUID parent,
      String name,
      String code,
      SpaceType type,
      boolean rentable,
      BigDecimal area,
      Integer capacity,
      String notes) {
    owner(actor, organization, building);
    var row = lockedSpace(organization, building, space);
    rejectCycle(organization, building, space, parent);
    if ((boolean) row.get("rentable")
        && !rentable
        && db.find(
                "select 1 from leases where organization_id=? and building_id=? and space_id=? and status in ('DRAFT','ACTIVE') limit 1",
                organization,
                building,
                space)
            .isPresent())
      throw new ApiException(409, "A space with an open lease must stay rentable");
    try {
      db.update(
          "update spaces set level_id=?,parent_space_id=?,name=?,code=?,type=?,rentable=?,area=?,capacity=?,notes=?,updated_at=now() where organization_id=? and building_id=? and id=?",
          level,
          parent,
          name,
          upper(code),
          type.name(),
          rentable,
          area,
          capacity,
          blank(notes),
          organization,
          building,
          space);
    } catch (DataIntegrityViolationException e) {
      throw new ApiException(
          409, "Another space already uses this code, or the level or parent space is invalid");
    }
    db.audit(actor.id(), organization, "SPACE_UPDATED", space);
  }

  public void deleteSpace(Actor actor, UUID organization, UUID building, UUID space) {
    owner(actor, organization, building);
    var row = lockedSpace(organization, building, space);
    if (SpaceStatus.valueOf((String) row.get("status")) == SpaceStatus.OCCUPIED)
      throw new ApiException(409, "An occupied space cannot be deleted");
    if (db.find(
            "select 1 from spaces where organization_id=? and building_id=? and parent_space_id=? limit 1",
            organization,
            building,
            space)
        .isPresent())
      throw new ApiException(409, "Move or delete the child spaces of this space first");
    try {
      db.update(
          "delete from spaces where organization_id=? and building_id=? and id=?",
          organization,
          building,
          space);
    } catch (DataIntegrityViolationException e) {
      throw new ApiException(
          409,
          "This space has leases, residents, listings, requests, inspections or assets and cannot be deleted. Mark it Inactive instead");
    }
    db.audit(actor.id(), organization, "SPACE_DELETED", space);
  }

  /** A space may not be moved inside itself or any of its own descendants. */
  private void rejectCycle(UUID organization, UUID building, UUID space, UUID parent) {
    UUID cursor = parent;
    for (int depth = 0; cursor != null && depth < 1000; depth++) {
      if (cursor.equals(space))
        throw new ApiException(409, "A space cannot be placed inside itself or its child spaces");
      cursor =
          db.find(
                  "select parent_space_id from spaces where organization_id=? and building_id=? and id=?",
                  organization,
                  building,
                  cursor)
              .map(found -> (UUID) found.get("parent_space_id"))
              .orElse(null);
    }
  }

  private Map<String, Object> lockedLevel(UUID organization, UUID building, UUID level) {
    return db.one(
        "select id from building_levels where organization_id=? and building_id=? and id=? for update",
        organization,
        building,
        level);
  }

  private Map<String, Object> lockedSpace(UUID organization, UUID building, UUID space) {
    return db.one(
        "select status,rentable from spaces where organization_id=? and building_id=? and id=? for update",
        organization,
        building,
        space);
  }

  public List<Map<String, Object>> spaces(Actor actor, UUID organization, UUID building) {
    enter(actor, organization, building);
    return db.rows(
        "select id,level_id,parent_space_id,name,code,type,status,rentable,area,capacity,notes from spaces where organization_id=? and building_id=? order by code,id",
        organization,
        building);
  }

  public UUID createSpace(
      Actor actor,
      UUID organization,
      UUID building,
      UUID level,
      UUID parent,
      String name,
      String code,
      SpaceType type,
      boolean rentable,
      BigDecimal area,
      Integer capacity,
      String notes) {
    owner(actor, organization, building);
    subscriptions.requireCapacity(organization, SubscriptionService.Resource.SPACE);
    UUID id = UUID.randomUUID();
    db.update(
        "insert into spaces(id,organization_id,building_id,level_id,parent_space_id,name,code,type,rentable,area,capacity,notes) values (?,?,?,?,?,?,?,?,?,?,?,?)",
        id,
        organization,
        building,
        level,
        parent,
        name,
        upper(code),
        type.name(),
        rentable,
        area,
        capacity,
        blank(notes));
    db.audit(actor.id(), organization, "SPACE_CREATED", id);
    return id;
  }

  public void status(
      Actor actor, UUID organization, UUID building, UUID space, SpaceStatus target) {
    owner(actor, organization, building);
    var row =
        db.one(
            "select status from spaces where organization_id=? and building_id=? and id=? for update",
            organization,
            building,
            space);
    SpaceStatus current = SpaceStatus.valueOf((String) row.get("status"));
    if (target == SpaceStatus.OCCUPIED || !allowed(current, target))
      throw new ApiException(409, "Space status transition is not allowed");
    db.update(
        "update spaces set status=?,updated_at=now() where organization_id=? and building_id=? and id=?",
        target.name(),
        organization,
        building,
        space);
    db.audit(actor.id(), organization, "SPACE_STATUS_CHANGED", space);
  }

  private boolean allowed(SpaceStatus current, SpaceStatus target) {
    if (current == target) return true;
    return switch (current) {
      case VACANT ->
          Set.of(SpaceStatus.RESERVED, SpaceStatus.MAINTENANCE, SpaceStatus.INACTIVE)
              .contains(target);
      case RESERVED -> Set.of(SpaceStatus.VACANT, SpaceStatus.MAINTENANCE).contains(target);
      case MAINTENANCE -> Set.of(SpaceStatus.VACANT, SpaceStatus.INACTIVE).contains(target);
      case INACTIVE -> target == SpaceStatus.VACANT;
      case OCCUPIED -> false;
    };
  }

  private String blank(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private String upper(String value) {
    String normalized = blank(value);
    return normalized == null ? null : normalized.toUpperCase(Locale.ROOT);
  }
}
