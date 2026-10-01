package com.buildease.automation;

import com.buildease.common.*;
import java.time.*;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class RentAutomation {
  private static final Logger log = LoggerFactory.getLogger(RentAutomation.class);
  private final Store db;
  private final TransactionTemplate transactions;

  public RentAutomation(Store db, TransactionTemplate transactions) {
    this.db = db;
    this.transactions = transactions;
  }

  @Scheduled(fixedDelayString = "${app.automation-delay-ms:60000}")
  public void run() {
    UUID administrator =
        transactions.execute(
            status ->
                db.find(
                        "select id from accounts where active and platform_admin order by created_at,id limit 1")
                    .map(row -> Store.id(row, "id"))
                    .orElse(null));
    if (administrator == null) return;
    List<UUID> organizations =
        transactions.execute(
            status -> {
              db.context(administrator, null);
              return db.rows("select id from organizations where active order by id").stream()
                  .map(row -> Store.id(row, "id"))
                  .toList();
            });
    Instant scheduled = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MINUTES);
    for (UUID organization : organizations) {
      try {
        transactions.executeWithoutResult(
            status -> process(administrator, organization, scheduled));
      } catch (RuntimeException error) {
        // The failed transaction rolled back, including its STARTED marker, so record the
        // failure in a fresh transaction and keep processing the remaining organizations.
        log.warn("Rent automation failed for organization {}", organization, error);
        AutomationRuns.recordFailure(
            db, transactions, administrator, organization, "rent", scheduled, error);
      }
    }
  }

  private void process(UUID actor, UUID organization, Instant scheduled) {
    db.context(actor, organization);
    UUID run = UUID.randomUUID();
    if (db.update(
            "insert into automation_runs(id,organization_id,job_key,scheduled_for,status) values (?,?,'rent',?,'STARTED') on conflict(organization_id,job_key,scheduled_for) do nothing",
            run,
            organization,
            java.sql.Timestamp.from(scheduled))
        != 1) return;
    generateRent(actor, organization);
    chargeLateFees(actor, organization);
    endExpiredLeases(actor, organization);
    notifyOverdue(organization);
    db.update("update automation_runs set status='COMPLETED',completed_at=now() where id=?", run);
  }

  private void generateRent(UUID actor, UUID organization) {
    for (var lease :
        db.rows(
            "select id,building_id,rent_amount,currency,next_charge_on from leases where organization_id=? and status='ACTIVE' and next_charge_on<=current_date and (ends_on is null or next_charge_on<=ends_on) for update skip locked",
            organization)) {
      UUID charge = UUID.randomUUID();
      db.update(
          "insert into charges(id,organization_id,building_id,lease_id,type,amount,currency,due_on) values (?,?,?,?,'RENT',?,?,?)",
          charge,
          organization,
          lease.get("building_id"),
          lease.get("id"),
          lease.get("rent_amount"),
          lease.get("currency"),
          lease.get("next_charge_on"));
      // Anchor every period on the first rent due date so month-end leases do not drift
      // (Jan 31 -> Feb 28 -> Mar 31, not Mar 28).
      db.update(
          "update leases set next_charge_on=(select (min(due_on)+count(*)*interval '1 month')::date from charges where lease_id=? and type='RENT') where id=?",
          lease.get("id"),
          lease.get("id"));
      db.audit(actor, organization, "RENT_CHARGE_GENERATED", charge);
    }
  }

  private void chargeLateFees(UUID actor, UUID organization) {
    // A rent charge is unpaid when payments (applied oldest-first) do not cover the running total
    // up to and including it. Each unpaid rent period past its grace window gets one late fee.
    for (var charge :
        db.rows(
            "select c.lease_id,c.building_id,c.currency,c.due_on,b.late_fee_amount from ("
                + "select c.*,sum(c.amount) over (partition by c.lease_id order by c.due_on,c.created_at,c.id) as running"
                + " from charges c where c.organization_id=?) c"
                + " join leases l on l.id=c.lease_id join buildings b on b.id=c.building_id"
                + " where l.status='ACTIVE' and c.type='RENT' and b.late_fee_amount>0"
                + " and c.due_on+b.late_fee_grace_days<current_date"
                + " and c.running>coalesce((select sum(p.amount) from payments p where p.lease_id=c.lease_id),0)",
            organization)) {
      UUID lateFee = UUID.randomUUID();
      int inserted =
          db.update(
              "insert into charges(id,organization_id,building_id,lease_id,type,amount,currency,due_on) values (?,?,?,?,'LATE_FEE',?,?,?) on conflict (lease_id,due_on) where type='LATE_FEE' do nothing",
              lateFee,
              organization,
              charge.get("building_id"),
              charge.get("lease_id"),
              charge.get("late_fee_amount"),
              charge.get("currency"),
              charge.get("due_on"));
      if (inserted == 1) db.audit(actor, organization, "LATE_FEE_CHARGED", lateFee);
    }
  }

  private void endExpiredLeases(UUID actor, UUID organization) {
    for (var lease :
        db.rows(
            "select id,building_id,assignment_id,space_id,ends_on from leases where organization_id=? and status='ACTIVE' and ends_on is not null and ends_on<current_date for update skip locked",
            organization)) {
      db.update(
          "update leases set status='ENDED',ended_on=ends_on,end_reason='EXPIRED',version=version+1,updated_at=now() where id=?",
          lease.get("id"));
      if (lease.get("assignment_id") != null
          && db.update(
                  "update space_assignments set status='ENDED',ends_on=?,updated_at=now() where id=? and status='ACTIVE'",
                  lease.get("ends_on"),
                  lease.get("assignment_id"))
              == 1)
        db.update(
            "update spaces set status='VACANT',updated_at=now() where organization_id=? and building_id=? and id=? and not exists(select 1 from space_assignments where space_id=? and status='ACTIVE')",
            organization,
            lease.get("building_id"),
            lease.get("space_id"),
            lease.get("space_id"));
      db.audit(actor, organization, "LEASE_EXPIRED", Store.id(lease, "id"));
    }
  }

  private void notifyOverdue(UUID organization) {
    var overdue =
        db.rows(
            "select l.id,l.building_id from leases l where l.organization_id=? and l.status='ACTIVE'"
                + " and exists(select 1 from charges c where c.lease_id=l.id and c.due_on<current_date-interval '7 days')"
                + " and coalesce((select sum(amount) from charges where lease_id=l.id),0)>coalesce((select sum(amount) from payments where lease_id=l.id),0)",
            organization);
    for (var lease : overdue) {
      UUID building = Store.id(lease, "building_id");
      for (var recipient :
          db.rows(
              "select distinct m.account_id from memberships m left join building_roles r on r.organization_id=m.organization_id and r.account_id=m.account_id and r.building_id=? where m.organization_id=? and m.status='ACTIVE' and (m.owner or r.role in ('PROPERTY_MANAGER','ACCOUNTANT'))",
              building,
              organization)) {
        String key = "rent:overdue:" + lease.get("id") + ":" + LocalDate.now(ZoneOffset.UTC);
        db.update(
            "insert into notifications(id,account_id,organization_id,building_id,type,title,target_path,deduplication_key) values (?,?,?,?,?,?,?,?) on conflict(account_id,deduplication_key) do nothing",
            UUID.randomUUID(),
            recipient.get("account_id"),
            organization,
            building,
            "RENT_OVERDUE",
            "Rent balance overdue",
            "/leases/" + lease.get("id"),
            key);
      }
    }
  }
}
