package com.buildease.automation;

import com.buildease.common.*;
import java.time.*;
import java.util.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class RentAutomation {
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
    for (UUID organization : organizations)
      transactions.executeWithoutResult(status -> process(administrator, organization));
  }

  private void process(UUID actor, UUID organization) {
    db.context(actor, organization);
    Instant scheduled = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MINUTES);
    UUID run = UUID.randomUUID();
    if (db.update(
            "insert into automation_runs(id,organization_id,job_key,scheduled_for,status) values (?,?,'rent',?,'STARTED') on conflict(organization_id,job_key,scheduled_for) do nothing",
            run,
            organization,
            java.sql.Timestamp.from(scheduled))
        != 1) return;
    try {
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
        db.update(
            "update leases set next_charge_on=next_charge_on+interval '1 month' where id=?",
            lease.get("id"));
        db.audit(actor, organization, "RENT_CHARGE_GENERATED", charge);
      }
      for (var lease :
          db.rows(
              "select l.id,l.building_id,l.currency,b.late_fee_amount,"
                  + "(select min(due_on) from charges where lease_id=l.id and due_on<current_date) as oldest_due "
                  + "from leases l join buildings b on b.id=l.building_id "
                  + "where l.organization_id=? and l.status='ACTIVE' and b.late_fee_amount is not null and b.late_fee_amount>0"
                  + " and exists(select 1 from charges c where c.lease_id=l.id and c.due_on<=current_date-(b.late_fee_grace_days||' days')::interval)"
                  + " and coalesce((select sum(amount) from charges where lease_id=l.id),0)>coalesce((select sum(amount) from payments where lease_id=l.id),0)",
              organization)) {
        UUID lateFee = UUID.randomUUID();
        int inserted =
            db.update(
                "insert into charges(id,organization_id,building_id,lease_id,type,amount,currency,due_on) values (?,?,?,?,'LATE_FEE',?,?,?) on conflict (lease_id,due_on) where type='LATE_FEE' do nothing",
                lateFee,
                organization,
                lease.get("building_id"),
                lease.get("id"),
                lease.get("late_fee_amount"),
                lease.get("currency"),
                lease.get("oldest_due"));
        if (inserted == 1) db.audit(actor, organization, "LATE_FEE_CHARGED", lateFee);
      }
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
      db.update("update automation_runs set status='COMPLETED',completed_at=now() where id=?", run);
    } catch (RuntimeException error) {
      db.update(
          "update automation_runs set status='FAILED',detail=?,completed_at=now() where id=?",
          error.getClass().getSimpleName(),
          run);
      throw error;
    }
  }
}
