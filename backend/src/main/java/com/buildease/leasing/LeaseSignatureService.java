package com.buildease.leasing;

import com.buildease.auth.Actor;
import com.buildease.common.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class LeaseSignatureService {
  private final Store db;

  public LeaseSignatureService(Store db) {
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

  private boolean isSigningResident(Actor actor, Access access, Map<String, Object> lease) {
    return access.roles().contains("TENANT")
        && db.find(
                "select 1 from residents where id=? and account_id=?",
                lease.get("resident_id"),
                actor.id())
            .isPresent();
  }

  public void sign(
      Actor actor,
      UUID organization,
      UUID building,
      UUID lease,
      SignatureRole role,
      String signedName,
      SignatureMethod method,
      String signatureData) {
    Access access = enter(actor, organization, building);
    var leaseRow =
        db.one(
            "select resident_id from leases where organization_id=? and building_id=? and id=?",
            organization,
            building,
            lease);
    if (role == SignatureRole.OWNER) {
      if (!access.manager()) throw ApiException.forbidden();
    } else if (!access.manager() && !isSigningResident(actor, access, leaseRow)) {
      throw ApiException.forbidden();
    }
    if (method == SignatureMethod.DRAWN && (signatureData == null || signatureData.isBlank()))
      throw new ApiException(400, "A drawn signature requires signature data");
    db.update(
        "insert into lease_signatures(id,organization_id,building_id,lease_id,role,signer_account_id,signed_name,method,signature_data) values (?,?,?,?,?,?,?,?,?) "
            + "on conflict(lease_id,role) do update set signer_account_id=excluded.signer_account_id,signed_name=excluded.signed_name,method=excluded.method,signature_data=excluded.signature_data,signed_at=now()",
        UUID.randomUUID(),
        organization,
        building,
        lease,
        role.name(),
        actor.id(),
        signedName.trim(),
        method.name(),
        method == SignatureMethod.DRAWN ? signatureData : null);
    db.audit(actor.id(), organization, "LEASE_SIGNED", lease);
  }

  public Map<String, Object> status(Actor actor, UUID organization, UUID building, UUID lease) {
    Access access = enter(actor, organization, building);
    var leaseRow =
        db.one(
            "select resident_id from leases where organization_id=? and building_id=? and id=?",
            organization,
            building,
            lease);
    if (!access.manager()
        && !access.roles().contains("ACCOUNTANT")
        && !isSigningResident(actor, access, leaseRow)) throw ApiException.forbidden();
    Map<String, Map<String, Object>> byRole = new HashMap<>();
    for (var row :
        db.rows(
            "select role,signed_name,method,signed_at from lease_signatures where organization_id=? and building_id=? and lease_id=?",
            organization,
            building,
            lease)) byRole.put((String) row.get("role"), row);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("owner", byRole.get("OWNER"));
    result.put("resident", byRole.get("RESIDENT"));
    result.put("fullyExecuted", byRole.containsKey("OWNER") && byRole.containsKey("RESIDENT"));
    return result;
  }

  private record Access(boolean owner, boolean manager, Set<String> roles) {}
}
