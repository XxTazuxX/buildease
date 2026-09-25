package com.buildease.leasing;

import com.buildease.auth.Actor;
import com.buildease.common.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class OnlinePaymentService {
  private final Store db;
  private final PaymentGateway gateway;

  public OnlinePaymentService(Store db, PaymentGateway gateway) {
    this.db = db;
    this.gateway = gateway;
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

  public UUID pay(Actor actor, UUID organization, UUID building, UUID lease, BigDecimal amount) {
    Access access = enter(actor, organization, building);
    var row =
        db.one(
            "select resident_id,status,currency from leases where organization_id=? and building_id=? and id=?",
            organization,
            building,
            lease);
    boolean isResident =
        access.roles().contains("TENANT")
            && db.find(
                    "select 1 from residents where id=? and account_id=?",
                    row.get("resident_id"),
                    actor.id())
                .isPresent();
    if (!access.manager() && !isResident) throw ApiException.forbidden();
    if (!"ACTIVE".equals(row.get("status")))
      throw new ApiException(409, "Payments require an active lease");
    var result = gateway.charge(lease, amount, (String) row.get("currency"));
    if (!"SUCCEEDED".equals(result.status())) throw new ApiException(402, "Payment was declined");
    UUID id = UUID.randomUUID();
    db.update(
        "insert into payments(id,organization_id,building_id,lease_id,amount,currency,method,reference,received_on,recorded_by,notes) values (?,?,?,?,?,?,'CARD',?,current_date,?,?)",
        id,
        organization,
        building,
        lease,
        amount,
        row.get("currency"),
        result.gatewayReference(),
        actor.id(),
        "Online payment (test gateway)");
    db.audit(actor.id(), organization, "ONLINE_PAYMENT_SUCCEEDED", id);
    return id;
  }

  private record Access(boolean owner, boolean manager, Set<String> roles) {}
}
