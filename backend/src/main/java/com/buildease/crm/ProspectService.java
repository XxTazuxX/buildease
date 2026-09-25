package com.buildease.crm;

import com.buildease.auth.Actor;
import com.buildease.common.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ProspectService {
  private static final Set<ProspectStatus> TERMINAL =
      Set.of(ProspectStatus.LEASED, ProspectStatus.REJECTED, ProspectStatus.WITHDRAWN);

  private final Store db;

  public ProspectService(Store db) {
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
      UUID listing,
      String name,
      String email,
      String phone,
      String notes) {
    manager(actor, organization, building);
    db.one(
        "select id from spaces where organization_id=? and building_id=? and id=?",
        organization,
        building,
        space);
    UUID id = UUID.randomUUID();
    db.update(
        "insert into prospects(id,organization_id,building_id,space_id,listing_id,name,email,phone,notes,created_by) values (?,?,?,?,?,?,?,?,?,?)",
        id,
        organization,
        building,
        space,
        listing,
        name.trim(),
        trim(email),
        trim(phone),
        trim(notes));
    db.audit(actor.id(), organization, "PROSPECT_CREATED", id);
    return id;
  }

  public void updateStatus(
      Actor actor,
      UUID organization,
      UUID building,
      UUID prospect,
      ProspectStatus status,
      String notes) {
    manager(actor, organization, building);
    if (status == ProspectStatus.LEASED)
      throw new ApiException(400, "Leasing a prospect requires linking a lease");
    var row = lockedProspect(organization, building, prospect);
    ProspectStatus current = ProspectStatus.valueOf((String) row.get("status"));
    if (TERMINAL.contains(current))
      throw new ApiException(409, "Cannot change status of a " + current + " prospect");
    db.update(
        "update prospects set status=?,notes=coalesce(?,notes),updated_at=now() where id=?",
        status.name(),
        trim(notes),
        prospect);
    db.audit(actor.id(), organization, "PROSPECT_STATUS_CHANGED", prospect);
  }

  public void linkLease(Actor actor, UUID organization, UUID building, UUID prospect, UUID lease) {
    manager(actor, organization, building);
    var row = lockedProspect(organization, building, prospect);
    ProspectStatus current = ProspectStatus.valueOf((String) row.get("status"));
    if (current != ProspectStatus.APPROVED)
      throw new ApiException(409, "Only an approved prospect can be linked to a lease");
    db.one(
        "select id from leases where organization_id=? and building_id=? and id=?",
        organization,
        building,
        lease);
    db.update(
        "update prospects set status='LEASED',lease_id=?,updated_at=now() where id=?",
        lease,
        prospect);
    db.audit(actor.id(), organization, "PROSPECT_LEASED", prospect);
  }

  public List<Map<String, Object>> list(
      Actor actor, UUID organization, UUID building, ProspectStatus status, UUID space, int page) {
    manager(actor, organization, building);
    if (page < 0 || page > 10000) throw new ApiException(400, "Invalid page");
    List<Object> args = new ArrayList<>(List.of(organization, building));
    StringBuilder sql =
        new StringBuilder(
            "select id,space_id,listing_id,lease_id,name,email,phone,status,created_at from prospects where organization_id=? and building_id=?");
    if (status != null) {
      sql.append(" and status=?");
      args.add(status.name());
    }
    if (space != null) {
      sql.append(" and space_id=?");
      args.add(space);
    }
    sql.append(" order by created_at desc,id limit 50 offset ?");
    args.add(page * 50);
    return db.rows(sql.toString(), args.toArray());
  }

  public Map<String, Object> detail(Actor actor, UUID organization, UUID building, UUID prospect) {
    manager(actor, organization, building);
    return db.one(
        "select id,space_id,listing_id,lease_id,name,email,phone,status,notes,created_at,updated_at from prospects where organization_id=? and building_id=? and id=?",
        organization,
        building,
        prospect);
  }

  private Map<String, Object> lockedProspect(UUID organization, UUID building, UUID prospect) {
    return db.one(
        "select * from prospects where organization_id=? and building_id=? and id=? for update",
        organization,
        building,
        prospect);
  }

  private String trim(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private record Access(boolean owner, boolean manager, Set<String> roles) {}
}
