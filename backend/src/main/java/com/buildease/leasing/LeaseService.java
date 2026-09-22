package com.buildease.leasing;

import com.buildease.auth.Actor;
import com.buildease.common.*;
import com.buildease.occupancy.OccupancyService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class LeaseService {
  private final Store db;
  private final OccupancyService occupancy;

  public LeaseService(Store db, OccupancyService occupancy) {
    this.db = db;
    this.occupancy = occupancy;
  }

  private Access enter(Actor actor, UUID organization, UUID building) {
    db.context(actor.id(), null);
    var membership =
        db.find(
            "select owner from memberships where organization_id=? and account_id=? and status='ACTIVE'",
            organization,
            actor.id());
    if (!actor.admin() && membership.isEmpty()) throw ApiException.forbidden();
    db.context(actor.id(), organization);
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

  private Access financeWriter(Actor actor, UUID organization, UUID building) {
    Access access = enter(actor, organization, building);
    if (!access.manager() && !access.roles().contains("ACCOUNTANT")) throw ApiException.forbidden();
    return access;
  }

  public UUID createDraft(
      Actor actor,
      UUID organization,
      UUID building,
      UUID resident,
      UUID space,
      LocalDate startsOn,
      LocalDate endsOn,
      BigDecimal rentAmount,
      LocalDate firstChargeOn,
      BigDecimal depositAmount,
      LocalDate depositHeldOn) {
    manager(actor, organization, building);
    db.one(
        "select id from residents where organization_id=? and building_id=? and id=? and active",
        organization,
        building,
        resident);
    var spaceRow =
        db.one(
            "select rentable from spaces where organization_id=? and building_id=? and id=?",
            organization,
            building,
            space);
    if (!(boolean) spaceRow.get("rentable"))
      throw new ApiException(409, "Space is not marked rentable");
    if (endsOn != null && endsOn.isBefore(startsOn))
      throw new ApiException(400, "End date cannot be before start date");
    if (firstChargeOn.isBefore(startsOn))
      throw new ApiException(400, "First charge date cannot precede the lease start");
    String currency =
        (String)
            db.one(
                    "select currency from buildings where id=? and organization_id=?",
                    building,
                    organization)
                .get("currency");
    UUID id = UUID.randomUUID();
    db.update(
        "insert into leases(id,organization_id,building_id,resident_id,space_id,status,starts_on,ends_on,rent_amount,currency,next_charge_on) values (?,?,?,?,?,'DRAFT',?,?,?,?,?)",
        id,
        organization,
        building,
        resident,
        space,
        startsOn,
        endsOn,
        rentAmount,
        currency,
        firstChargeOn);
    if (depositAmount != null)
      db.update(
          "insert into deposits(id,organization_id,building_id,lease_id,status,amount,held_on) values (?,?,?,?,'HELD',?,?)",
          UUID.randomUUID(),
          organization,
          building,
          id,
          depositAmount,
          depositHeldOn != null ? depositHeldOn : startsOn);
    db.audit(actor.id(), organization, "LEASE_DRAFTED", id);
    return id;
  }

  public List<Map<String, Object>> leases(
      Actor actor, UUID organization, UUID building, LeaseStatus status, int page) {
    Access access = enter(actor, organization, building);
    if (page < 0 || page > 10000) throw new ApiException(400, "Invalid page");
    String scope;
    List<Object> args = new ArrayList<>(List.of(organization, building));
    if (access.manager() || access.roles().contains("ACCOUNTANT")) scope = "true";
    else if (access.roles().contains("TENANT")) {
      scope =
          "resident_id in (select id from residents where account_id=? and organization_id=? and building_id=?)";
      args.add(actor.id());
      args.add(organization);
      args.add(building);
    } else throw ApiException.forbidden();
    StringBuilder sql =
        new StringBuilder(
                "select id,resident_id,space_id,assignment_id,status,starts_on,ends_on,rent_amount,currency,next_charge_on,ended_on,end_reason from leases where organization_id=? and building_id=? and ")
            .append(scope);
    if (status != null) {
      sql.append(" and status=?");
      args.add(status.name());
    }
    sql.append(" order by starts_on desc,id limit 50 offset ?");
    args.add(page * 50);
    return db.rows(sql.toString(), args.toArray());
  }

  public Map<String, Object> lease(Actor actor, UUID organization, UUID building, UUID lease) {
    Access access = enter(actor, organization, building);
    var row =
        db.one(
            "select id,resident_id,space_id,assignment_id,status,starts_on,ends_on,rent_amount,currency,next_charge_on,ended_on,end_reason from leases where organization_id=? and building_id=? and id=?",
            organization,
            building,
            lease);
    requireLeaseAccess(actor, access, row);
    var result = new LinkedHashMap<>(row);
    result.put(
        "charges",
        db.rows(
            "select id,type,amount,currency,due_on,created_at from charges where organization_id=? and building_id=? and lease_id=? order by due_on,id",
            organization,
            building,
            lease));
    result.put(
        "payments",
        db.rows(
            "select id,amount,currency,method,reference,received_on,recorded_by,notes,created_at from payments where organization_id=? and building_id=? and lease_id=? order by received_on,id",
            organization,
            building,
            lease));
    result.put(
        "deposit",
        db.find(
                "select id,status,amount,held_on,refunded_on,refunded_amount,notes from deposits where organization_id=? and building_id=? and lease_id=?",
                organization,
                building,
                lease)
            .orElse(null));
    BigDecimal charged =
        (BigDecimal)
            db.one(
                    "select coalesce(sum(amount),0) as total from charges where organization_id=? and building_id=? and lease_id=?",
                    organization,
                    building,
                    lease)
                .get("total");
    BigDecimal paid =
        (BigDecimal)
            db.one(
                    "select coalesce(sum(amount),0) as total from payments where organization_id=? and building_id=? and lease_id=?",
                    organization,
                    building,
                    lease)
                .get("total");
    result.put("balance", charged.subtract(paid));
    return result;
  }

  private void requireLeaseAccess(Actor actor, Access access, Map<String, Object> lease) {
    if (access.manager() || access.roles().contains("ACCOUNTANT")) return;
    if (access.roles().contains("TENANT")
        && db.find(
                "select 1 from residents where id=? and account_id=?",
                lease.get("resident_id"),
                actor.id())
            .isPresent()) return;
    throw ApiException.forbidden();
  }

  public void activate(Actor actor, UUID organization, UUID building, UUID lease) {
    manager(actor, organization, building);
    var row = lockedLease(organization, building, lease);
    requireLeaseStatus(row, LeaseStatus.DRAFT);
    UUID resident = Store.id(row, "resident_id");
    UUID space = Store.id(row, "space_id");
    LocalDate startsOn = ((java.sql.Date) row.get("starts_on")).toLocalDate();
    UUID assignment =
        occupancy
            .activeAssignment(organization, building, resident, space)
            .map(a -> Store.id(a, "id"))
            .orElseGet(
                () -> occupancy.assign(actor, organization, building, resident, space, startsOn));
    int changed;
    try {
      changed =
          db.update(
              "update leases set status='ACTIVE',assignment_id=?,version=version+1,updated_at=now() where id=? and version=?",
              assignment,
              lease,
              row.get("version"));
    } catch (DataIntegrityViolationException e) {
      throw new ApiException(409, "Space already has an active lease");
    }
    if (changed != 1) throw new ApiException(409, "Lease changed concurrently");
    db.audit(actor.id(), organization, "LEASE_ACTIVATED", lease);
  }

  public void cancel(Actor actor, UUID organization, UUID building, UUID lease) {
    manager(actor, organization, building);
    var row = lockedLease(organization, building, lease);
    requireLeaseStatus(row, LeaseStatus.DRAFT);
    int changed =
        db.update(
            "update leases set status='CANCELLED',version=version+1,updated_at=now() where id=? and version=?",
            lease,
            row.get("version"));
    if (changed != 1) throw new ApiException(409, "Lease changed concurrently");
    db.audit(actor.id(), organization, "LEASE_CANCELLED", lease);
  }

  public void end(
      Actor actor,
      UUID organization,
      UUID building,
      UUID lease,
      LocalDate endsOn,
      LeaseEndReason reason) {
    manager(actor, organization, building);
    var row = lockedLease(organization, building, lease);
    requireLeaseStatus(row, LeaseStatus.ACTIVE);
    LocalDate startsOn = ((java.sql.Date) row.get("starts_on")).toLocalDate();
    if (endsOn.isBefore(startsOn))
      throw new ApiException(400, "End date cannot be before start date");
    UUID assignment = (UUID) row.get("assignment_id");
    var assignmentRow = db.find("select status from space_assignments where id=?", assignment);
    if (assignmentRow.isPresent() && "ACTIVE".equals(assignmentRow.get().get("status")))
      occupancy.end(actor, organization, building, assignment, endsOn);
    int changed =
        db.update(
            "update leases set status='ENDED',ended_on=?,end_reason=?,version=version+1,updated_at=now() where id=? and version=?",
            endsOn,
            reason.name(),
            lease,
            row.get("version"));
    if (changed != 1) throw new ApiException(409, "Lease changed concurrently");
    db.audit(actor.id(), organization, "LEASE_ENDED", lease);
  }

  public List<Map<String, Object>> charges(
      Actor actor, UUID organization, UUID building, UUID lease) {
    Access access = enter(actor, organization, building);
    requireLeaseAccess(actor, access, leaseAccessRow(organization, building, lease));
    return db.rows(
        "select id,type,amount,currency,due_on,created_at from charges where organization_id=? and building_id=? and lease_id=? order by due_on,id",
        organization,
        building,
        lease);
  }

  public List<Map<String, Object>> payments(
      Actor actor, UUID organization, UUID building, UUID lease) {
    Access access = enter(actor, organization, building);
    requireLeaseAccess(actor, access, leaseAccessRow(organization, building, lease));
    return db.rows(
        "select id,amount,currency,method,reference,received_on,recorded_by,notes,created_at from payments where organization_id=? and building_id=? and lease_id=? order by received_on,id",
        organization,
        building,
        lease);
  }

  private Map<String, Object> leaseAccessRow(UUID organization, UUID building, UUID lease) {
    return db.one(
        "select resident_id from leases where organization_id=? and building_id=? and id=?",
        organization,
        building,
        lease);
  }

  public UUID recordPayment(
      Actor actor,
      UUID organization,
      UUID building,
      UUID lease,
      BigDecimal amount,
      PaymentMethod method,
      String reference,
      LocalDate receivedOn,
      String notes) {
    financeWriter(actor, organization, building);
    var row =
        db.one(
            "select currency,status from leases where organization_id=? and building_id=? and id=?",
            organization,
            building,
            lease);
    if (!Set.of("ACTIVE", "ENDED").contains(row.get("status")))
      throw new ApiException(409, "Payments require an active or ended lease");
    UUID id = UUID.randomUUID();
    db.update(
        "insert into payments(id,organization_id,building_id,lease_id,amount,currency,method,reference,received_on,recorded_by,notes) values (?,?,?,?,?,?,?,?,?,?,?)",
        id,
        organization,
        building,
        lease,
        amount,
        row.get("currency"),
        method.name(),
        trim(reference),
        receivedOn,
        actor.id(),
        trim(notes));
    db.audit(actor.id(), organization, "LEASE_PAYMENT_RECORDED", id);
    return id;
  }

  public UUID recordDeposit(
      Actor actor,
      UUID organization,
      UUID building,
      UUID lease,
      BigDecimal amount,
      LocalDate heldOn) {
    financeWriter(actor, organization, building);
    var row =
        db.one(
            "select status from leases where organization_id=? and building_id=? and id=?",
            organization,
            building,
            lease);
    if (!Set.of("DRAFT", "ACTIVE").contains(row.get("status")))
      throw new ApiException(409, "Deposit requires a draft or active lease");
    UUID id = UUID.randomUUID();
    try {
      db.update(
          "insert into deposits(id,organization_id,building_id,lease_id,status,amount,held_on) values (?,?,?,?,'HELD',?,?)",
          id,
          organization,
          building,
          lease,
          amount,
          heldOn);
    } catch (DataIntegrityViolationException e) {
      throw new ApiException(409, "Lease already has a deposit recorded");
    }
    db.audit(actor.id(), organization, "LEASE_DEPOSIT_RECORDED", id);
    return id;
  }

  public void refundDeposit(
      Actor actor,
      UUID organization,
      UUID building,
      UUID lease,
      LocalDate refundedOn,
      BigDecimal refundedAmount,
      String notes) {
    financeWriter(actor, organization, building);
    var row = lockedDeposit(organization, building, lease);
    requireDepositStatus(row, DepositStatus.HELD);
    db.update(
        "update deposits set status='REFUNDED',refunded_on=?,refunded_amount=?,notes=?,updated_at=now() where id=?",
        refundedOn,
        refundedAmount,
        trim(notes),
        row.get("id"));
    db.audit(actor.id(), organization, "LEASE_DEPOSIT_REFUNDED", Store.id(row, "id"));
  }

  public void forfeitDeposit(
      Actor actor, UUID organization, UUID building, UUID lease, String reason) {
    financeWriter(actor, organization, building);
    var row = lockedDeposit(organization, building, lease);
    requireDepositStatus(row, DepositStatus.HELD);
    db.update(
        "update deposits set status='FORFEITED',notes=?,updated_at=now() where id=?",
        trim(reason),
        row.get("id"));
    db.audit(actor.id(), organization, "LEASE_DEPOSIT_FORFEITED", Store.id(row, "id"));
  }

  private Map<String, Object> lockedLease(UUID organization, UUID building, UUID lease) {
    return db.one(
        "select * from leases where organization_id=? and building_id=? and id=? for update",
        organization,
        building,
        lease);
  }

  private Map<String, Object> lockedDeposit(UUID organization, UUID building, UUID lease) {
    return db.one(
        "select * from deposits where organization_id=? and building_id=? and lease_id=? for update",
        organization,
        building,
        lease);
  }

  private void requireLeaseStatus(Map<String, Object> row, LeaseStatus expected) {
    LeaseStatus current = LeaseStatus.valueOf((String) row.get("status"));
    if (current != expected)
      throw new ApiException(409, "Cannot change lease from " + current + " to " + expected);
  }

  private void requireDepositStatus(Map<String, Object> row, DepositStatus expected) {
    DepositStatus current = DepositStatus.valueOf((String) row.get("status"));
    if (current != expected)
      throw new ApiException(409, "Cannot change deposit from " + current + " to " + expected);
  }

  private String trim(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private record Access(boolean owner, boolean manager, Set<String> roles) {}
}
