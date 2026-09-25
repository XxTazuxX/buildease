package com.buildease.building;

import com.buildease.auth.Actor;
import com.buildease.common.ApiException;
import com.buildease.common.Store;
import java.math.BigDecimal;
import java.time.ZoneId;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class BuildingService {
  private final Store db;

  public BuildingService(Store db) {
    this.db = db;
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

  private void owner(Actor actor, UUID organization, UUID building) {
    if (!enter(actor, organization, building)) throw ApiException.forbidden();
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
