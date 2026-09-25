package com.buildease.screening;

import com.buildease.auth.Actor;
import com.buildease.common.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ScreeningService {
  private final Store db;
  private final ScreeningProvider provider;

  public ScreeningService(Store db, ScreeningProvider provider) {
    this.db = db;
    this.provider = provider;
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

  public UUID request(Actor actor, UUID organization, UUID building, UUID prospect) {
    manager(actor, organization, building);
    var row =
        db.one(
            "select name,email,status from prospects where organization_id=? and building_id=? and id=? for update",
            organization,
            building,
            prospect);
    if (!Set.of("APPLIED", "SCREENING").contains(row.get("status")))
      throw new ApiException(409, "Prospect must have applied before screening");
    if ("APPLIED".equals(row.get("status")))
      db.update("update prospects set status='SCREENING',updated_at=now() where id=?", prospect);
    var result = provider.run(prospect, (String) row.get("name"), (String) row.get("email"));
    UUID id = UUID.randomUUID();
    db.update(
        "insert into screenings(id,organization_id,building_id,prospect_id,status,report,provider_reference,requested_by,completed_at) values (?,?,?,?,?,?,?,?,now())",
        id,
        organization,
        building,
        prospect,
        result.decision().name(),
        result.report(),
        result.providerReference(),
        actor.id());
    db.audit(actor.id(), organization, "SCREENING_REQUESTED", id);
    return id;
  }

  public List<Map<String, Object>> list(
      Actor actor, UUID organization, UUID building, UUID prospect) {
    manager(actor, organization, building);
    return db.rows(
        "select id,status,report,provider_reference,requested_at,completed_at from screenings where organization_id=? and building_id=? and prospect_id=? order by requested_at desc,id",
        organization,
        building,
        prospect);
  }

  private record Access(boolean owner, boolean manager, Set<String> roles) {}
}
