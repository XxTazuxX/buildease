package com.buildease.assets;

import com.buildease.auth.Actor;
import com.buildease.common.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class AssetService {
  private final Store db;

  public AssetService(Store db) {
    this.db = db;
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
      String name,
      AssetCategory category,
      String manufacturer,
      String model,
      String serialNumber,
      LocalDate installDate,
      LocalDate warrantyExpiresOn,
      String notes) {
    manager(actor, organization, building);
    if (space != null)
      db.one(
          "select id from spaces where organization_id=? and building_id=? and id=?",
          organization,
          building,
          space);
    UUID id = UUID.randomUUID();
    db.update(
        "insert into assets(id,organization_id,building_id,space_id,name,category,manufacturer,model,serial_number,install_date,warranty_expires_on,notes) values (?,?,?,?,?,?,?,?,?,?,?,?)",
        id,
        organization,
        building,
        space,
        name.trim(),
        category.name(),
        trim(manufacturer),
        trim(model),
        trim(serialNumber),
        installDate,
        warrantyExpiresOn,
        trim(notes));
    db.audit(actor.id(), organization, "ASSET_CREATED", id);
    return id;
  }

  public void update(
      Actor actor,
      UUID organization,
      UUID building,
      UUID asset,
      String name,
      AssetCategory category,
      String manufacturer,
      String model,
      String serialNumber,
      LocalDate installDate,
      LocalDate warrantyExpiresOn,
      String notes) {
    manager(actor, organization, building);
    db.one(
        "select id from assets where organization_id=? and building_id=? and id=?",
        organization,
        building,
        asset);
    db.update(
        "update assets set name=?,category=?,manufacturer=?,model=?,serial_number=?,install_date=?,warranty_expires_on=?,notes=?,updated_at=now() where id=?",
        name.trim(),
        category.name(),
        trim(manufacturer),
        trim(model),
        trim(serialNumber),
        installDate,
        warrantyExpiresOn,
        trim(notes),
        asset);
    db.audit(actor.id(), organization, "ASSET_UPDATED", asset);
  }

  public void setStatus(
      Actor actor, UUID organization, UUID building, UUID asset, AssetStatus status) {
    manager(actor, organization, building);
    db.one(
        "select id from assets where organization_id=? and building_id=? and id=?",
        organization,
        building,
        asset);
    db.update("update assets set status=?,updated_at=now() where id=?", status.name(), asset);
    db.audit(actor.id(), organization, "ASSET_STATUS_CHANGED", asset);
  }

  public UUID recordMeterReading(
      Actor actor, UUID organization, UUID building, UUID asset, BigDecimal value, String unit) {
    Access access = enter(actor, organization, building);
    if (!access.manager() && !access.roles().contains("MAINTENANCE_STAFF"))
      throw ApiException.forbidden();
    db.one(
        "select id from assets where organization_id=? and building_id=? and id=?",
        organization,
        building,
        asset);
    UUID id = UUID.randomUUID();
    db.update(
        "insert into asset_meter_readings(id,organization_id,building_id,asset_id,reading_value,unit,recorded_by) values (?,?,?,?,?,?,?)",
        id,
        organization,
        building,
        asset,
        value,
        unit.trim(),
        actor.id());
    return id;
  }

  public List<Map<String, Object>> list(
      Actor actor, UUID organization, UUID building, AssetStatus status, UUID space, int page) {
    manager(actor, organization, building);
    if (page < 0 || page > 10000) throw new ApiException(400, "Invalid page");
    List<Object> args = new ArrayList<>(List.of(organization, building));
    StringBuilder sql =
        new StringBuilder(
            "select id,space_id,name,category,manufacturer,model,warranty_expires_on,status from assets where organization_id=? and building_id=?");
    if (status != null) {
      sql.append(" and status=?");
      args.add(status.name());
    }
    if (space != null) {
      sql.append(" and space_id=?");
      args.add(space);
    }
    sql.append(" order by name,id limit 50 offset ?");
    args.add(page * 50);
    return db.rows(sql.toString(), args.toArray());
  }

  public Map<String, Object> detail(Actor actor, UUID organization, UUID building, UUID asset) {
    manager(actor, organization, building);
    var row =
        db.one(
            "select id,space_id,name,category,manufacturer,model,serial_number,install_date,warranty_expires_on,status,notes,created_at,updated_at from assets where organization_id=? and building_id=? and id=?",
            organization,
            building,
            asset);
    var result = new LinkedHashMap<>(row);
    result.put(
        "meterReadings",
        db.rows(
            "select id,reading_value,unit,recorded_by,recorded_at from asset_meter_readings where organization_id=? and building_id=? and asset_id=? order by recorded_at desc,id",
            organization,
            building,
            asset));
    return result;
  }

  private String trim(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private record Access(boolean owner, boolean manager, Set<String> roles) {}
}
