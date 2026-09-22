package com.buildease.automation;

import com.buildease.common.*;
import java.time.*;
import java.util.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class MaintenanceAutomation {
  private final Store db;
  private final TransactionTemplate transactions;

  public MaintenanceAutomation(Store db, TransactionTemplate transactions) {
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
            "insert into automation_runs(id,organization_id,job_key,scheduled_for,status) values (?,?,'maintenance',?,'STARTED') on conflict(organization_id,job_key,scheduled_for) do nothing",
            run,
            organization,
            java.sql.Timestamp.from(scheduled))
        != 1) return;
    try {
      for (var plan :
          db.rows(
              "select p.*,c.default_priority from recurring_maintenance_plans p join maintenance_categories c on c.id=p.category_id where p.organization_id=? and p.active and p.space_id is not null and p.next_run_on<=current_date for update of p skip locked",
              organization)) {
        UUID request = UUID.randomUUID();
        db.update(
            "insert into maintenance_requests(id,organization_id,building_id,space_id,category_id,created_by,title,description,impact,danger,suggested_priority,status) values (?,?,?,?,?,?,?,?,'MEDIUM',false,?,'SUBMITTED')",
            request,
            organization,
            plan.get("building_id"),
            plan.get("space_id"),
            plan.get("category_id"),
            actor,
            plan.get("title"),
            plan.get("description"),
            plan.get("default_priority"));
        db.update(
            "insert into maintenance_status_history(id,organization_id,building_id,request_id,actor_id,to_status,reason) values (?,?,?,?,?,'SUBMITTED','Recurring maintenance plan')",
            UUID.randomUUID(),
            organization,
            plan.get("building_id"),
            request,
            actor);
        db.update(
            "update recurring_maintenance_plans set next_run_on=next_run_on+interval '1 day'*interval_days where id=?",
            plan.get("id"));
        db.audit(actor, organization, "RECURRING_MAINTENANCE_CREATED", request);
      }
      var alerts =
          db.rows(
              "select id,building_id from maintenance_requests where organization_id=? and status not in ('CLOSED','CANCELLED') and ((resolution_due_at<now()) or (status='TRIAGED' and updated_at<now()-interval '1 hour'))",
              organization);
      for (var request : alerts) {
        UUID building = Store.id(request, "building_id");
        for (var recipient :
            db.rows(
                "select distinct m.account_id from memberships m left join building_roles r on r.organization_id=m.organization_id and r.account_id=m.account_id and r.building_id=? where m.organization_id=? and m.status='ACTIVE' and (m.owner or r.role='PROPERTY_MANAGER')",
                building,
                organization)) {
          String key =
              "maintenance:attention:" + request.get("id") + ":" + LocalDate.now(ZoneOffset.UTC);
          db.update(
              "insert into notifications(id,account_id,organization_id,building_id,type,title,target_path,deduplication_key) values (?,?,?,?,?,?,?,?) on conflict(account_id,deduplication_key) do nothing",
              UUID.randomUUID(),
              recipient.get("account_id"),
              organization,
              building,
              "MAINTENANCE_ATTENTION",
              "Maintenance request needs attention",
              "/maintenance/" + request.get("id"),
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
