package com.buildease.inspection;

import com.buildease.auth.Actor;
import com.buildease.common.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class InspectionService {
  private final Store db;

  public InspectionService(Store db) {
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

  private Access manager(Actor actor, UUID organization, UUID building) {
    Access access = enter(actor, organization, building);
    if (!access.manager()) throw ApiException.forbidden();
    return access;
  }

  public UUID create(
      Actor actor,
      UUID organization,
      UUID building,
      UUID space,
      UUID lease,
      UUID resident,
      InspectionType type,
      LocalDate scheduledOn) {
    manager(actor, organization, building);
    db.one(
        "select id from spaces where organization_id=? and building_id=? and id=?",
        organization,
        building,
        space);
    UUID id = UUID.randomUUID();
    db.update(
        "insert into inspections(id,organization_id,building_id,space_id,lease_id,resident_id,type,scheduled_on) values (?,?,?,?,?,?,?,?)",
        id,
        organization,
        building,
        space,
        lease,
        resident,
        type.name(),
        scheduledOn);
    db.audit(actor.id(), organization, "INSPECTION_SCHEDULED", id);
    return id;
  }

  public UUID addItem(
      Actor actor,
      UUID organization,
      UUID building,
      UUID inspection,
      String area,
      Condition condition,
      String notes) {
    manager(actor, organization, building);
    requireDraft(organization, building, inspection);
    UUID id = UUID.randomUUID();
    db.update(
        "insert into inspection_items(id,organization_id,building_id,inspection_id,area,condition,notes) values (?,?,?,?,?,?,?)",
        id,
        organization,
        building,
        inspection,
        area,
        condition.name(),
        trim(notes));
    return id;
  }

  public void complete(
      Actor actor, UUID organization, UUID building, UUID inspection, String notes) {
    manager(actor, organization, building);
    requireDraft(organization, building, inspection);
    db.update(
        "update inspections set status='COMPLETED',completed_at=now(),conducted_by=?,notes=?,updated_at=now() where id=?",
        actor.id(),
        trim(notes),
        inspection);
    db.audit(actor.id(), organization, "INSPECTION_COMPLETED", inspection);
  }

  public void acknowledge(Actor actor, UUID organization, UUID building, UUID inspection) {
    Access access = enter(actor, organization, building);
    var row =
        db.one(
            "select status,resident_id,resident_acknowledged_at from inspections where organization_id=? and building_id=? and id=?",
            organization,
            building,
            inspection);
    if (!"COMPLETED".equals(row.get("status")))
      throw new ApiException(409, "Inspection is not yet completed");
    if (!access.manager() && !isOwnResident(actor, row)) throw ApiException.forbidden();
    if (row.get("resident_acknowledged_at") != null)
      throw new ApiException(409, "Inspection already acknowledged");
    db.update(
        "update inspections set resident_acknowledged_at=now(),updated_at=now() where id=?",
        inspection);
    db.audit(actor.id(), organization, "INSPECTION_ACKNOWLEDGED", inspection);
  }

  public List<Map<String, Object>> list(
      Actor actor, UUID organization, UUID building, UUID space, int page) {
    Access access = enter(actor, organization, building);
    if (page < 0 || page > 10000) throw new ApiException(400, "Invalid page");
    List<Object> args = new ArrayList<>(List.of(organization, building));
    String scope;
    if (access.manager()) scope = "true";
    else if (access.roles().contains("TENANT")) {
      scope =
          "resident_id in (select id from residents where account_id=? and organization_id=? and building_id=?)";
      args.add(actor.id());
      args.add(organization);
      args.add(building);
    } else throw ApiException.forbidden();
    StringBuilder sql =
        new StringBuilder(
                "select id,space_id,lease_id,resident_id,type,status,scheduled_on,completed_at,resident_acknowledged_at from inspections where organization_id=? and building_id=? and ")
            .append(scope);
    if (space != null) {
      sql.append(" and space_id=?");
      args.add(space);
    }
    sql.append(" order by scheduled_on desc,id limit 50 offset ?");
    args.add(page * 50);
    return db.rows(sql.toString(), args.toArray());
  }

  public Map<String, Object> detail(
      Actor actor, UUID organization, UUID building, UUID inspection) {
    Access access = enter(actor, organization, building);
    var row =
        db.one(
            "select id,space_id,lease_id,resident_id,type,status,scheduled_on,completed_at,conducted_by,resident_acknowledged_at,notes from inspections where organization_id=? and building_id=? and id=?",
            organization,
            building,
            inspection);
    if (!access.manager() && !isOwnResident(actor, row)) throw ApiException.forbidden();
    var result = new LinkedHashMap<>(row);
    result.put(
        "items",
        db.rows(
            "select id,area,condition,notes from inspection_items where organization_id=? and building_id=? and inspection_id=? order by area",
            organization,
            building,
            inspection));
    result.put(
        "photos",
        db.rows(
            "select id,uploaded_by,content_type,size_bytes,created_at from inspection_photos where organization_id=? and building_id=? and inspection_id=? order by created_at",
            organization,
            building,
            inspection));
    return result;
  }

  Map<String, Object> requireDraft(UUID organization, UUID building, UUID inspection) {
    var row =
        db.one(
            "select status from inspections where organization_id=? and building_id=? and id=? for update",
            organization,
            building,
            inspection);
    if (!"DRAFT".equals(row.get("status")))
      throw new ApiException(409, "Inspection is already completed");
    return row;
  }

  void requireManagerForPhotos(Actor actor, UUID organization, UUID building, UUID inspection) {
    manager(actor, organization, building);
    requireDraft(organization, building, inspection);
  }

  private boolean isOwnResident(Actor actor, Map<String, Object> row) {
    UUID resident = (UUID) row.get("resident_id");
    if (resident == null) return false;
    return db.find("select 1 from residents where id=? and account_id=?", resident, actor.id())
        .isPresent();
  }

  private String trim(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private record Access(boolean owner, boolean manager, Set<String> roles) {}
}
