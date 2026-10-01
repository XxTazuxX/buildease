package com.buildease.billing;

import com.buildease.common.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Subscription lifecycle job: ends expired trials, issues renewal invoices at the start of each
 * billing period, and marks unpaid invoices overdue. Suspension stays a deliberate operator action.
 */
@Service
public class BillingAutomation {
  private static final Logger log = LoggerFactory.getLogger(BillingAutomation.class);
  private final Store db;
  private final TransactionTemplate transactions;
  private final SubscriptionService subscriptions;
  private final SaasInvoiceService invoices;

  public BillingAutomation(
      Store db,
      TransactionTemplate transactions,
      SubscriptionService subscriptions,
      SaasInvoiceService invoices) {
    this.db = db;
    this.transactions = transactions;
    this.subscriptions = subscriptions;
    this.invoices = invoices;
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
        log.warn("Billing automation failed for organization {}", organization, error);
        recordFailure(administrator, organization, scheduled, error);
      }
    }
  }

  private void process(UUID actor, UUID organization, Instant scheduled) {
    db.context(actor, organization);
    if (db.update(
            "insert into automation_runs(id,organization_id,job_key,scheduled_for,status) values (?,?,'billing',?,'STARTED') on conflict(organization_id,job_key,scheduled_for) do nothing",
            UUID.randomUUID(),
            organization,
            java.sql.Timestamp.from(scheduled))
        != 1) return;
    var sub = subscriptions.current(organization);
    LocalDate today = LocalDate.now();
    String status = (String) sub.get("status");
    // An expired trial stays TRIALING (and read-only, see SubscriptionService#writable) until the
    // operator assigns a paid plan; owners are told once.
    if ("TRIALING".equals(status)
        && ((java.sql.Date) sub.get("trial_ends_on")).toLocalDate().isBefore(today))
      notifyOwners(
          organization, "Your free trial has ended — choose a plan", "billing:trial-ended");
    if (Set.of("ACTIVE", "PAST_DUE").contains(status)) renew(actor, organization, sub, today);
    int overdue =
        db.update(
            "update saas_invoices set status='OVERDUE',updated_at=now() where organization_id=? and status='ISSUED' and due_on<?",
            organization,
            today);
    if (overdue > 0) {
      db.update(
          "update organization_subscriptions set status='PAST_DUE',updated_at=now() where organization_id=? and status='ACTIVE'",
          organization);
      notifyOwners(organization, "A subscription invoice is overdue", "billing:overdue:" + today);
      db.audit(actor, organization, "SUBSCRIPTION_PAST_DUE", organization);
    }
    db.update(
        "update automation_runs set status='COMPLETED',completed_at=now() where organization_id=? and job_key='billing' and scheduled_for=?",
        organization,
        java.sql.Timestamp.from(scheduled));
  }

  /** Rolls every elapsed period forward, invoicing each new period in advance. */
  private void renew(UUID actor, UUID organization, Map<String, Object> sub, LocalDate today) {
    LocalDate end = ((java.sql.Date) sub.get("current_period_end")).toLocalDate();
    boolean annual = "ANNUAL".equals(sub.get("billing_cycle"));
    BigDecimal price =
        annual ? (BigDecimal) sub.get("annual_price") : (BigDecimal) sub.get("monthly_price");
    int guard = 0;
    while (!end.isAfter(today) && guard++ < 24) {
      LocalDate start = end;
      end = annual ? start.plusYears(1) : start.plusMonths(1);
      db.update(
          "update organization_subscriptions set current_period_start=?,current_period_end=?,updated_at=now() where organization_id=?",
          start,
          end,
          organization);
      if (price.signum() > 0
          && db.find(
                  "select 1 from saas_invoices where organization_id=? and period_start=? and status<>'VOID'",
                  organization,
                  start)
              .isEmpty()) {
        invoices.insert(
            actor,
            organization,
            (UUID) sub.get("plan_id"),
            "BuildEase " + sub.get("plan_name") + " plan (" + (annual ? "annual" : "monthly") + ")",
            start,
            end,
            price,
            BigDecimal.ZERO,
            (String) sub.get("currency"),
            "ISSUED",
            today,
            today.plusDays(SaasInvoiceService.PAYMENT_TERMS_DAYS),
            null);
        invoices.notifyIssued(organization);
      }
    }
  }

  private void notifyOwners(UUID organization, String title, String key) {
    for (var owner :
        db.rows(
            "select account_id from memberships where organization_id=? and owner and status='ACTIVE'",
            organization))
      db.update(
          "insert into notifications(id,account_id,organization_id,type,title,target_path,deduplication_key) values (?,?,?,'BILLING',?,'/billing',?) on conflict(account_id,deduplication_key) do nothing",
          UUID.randomUUID(),
          owner.get("account_id"),
          organization,
          title,
          key + ":" + organization);
  }

  private void recordFailure(
      UUID actor, UUID organization, Instant scheduled, RuntimeException error) {
    try {
      transactions.executeWithoutResult(
          status -> {
            db.context(actor, organization);
            db.update(
                "insert into automation_runs(id,organization_id,job_key,scheduled_for,status,detail,completed_at) values (?,?,'billing',?,'FAILED',?,now()) "
                    + "on conflict(organization_id,job_key,scheduled_for) do update set status='FAILED',detail=excluded.detail,completed_at=now()",
                UUID.randomUUID(),
                organization,
                java.sql.Timestamp.from(scheduled),
                error.getClass().getSimpleName());
          });
    } catch (RuntimeException ignored) {
      // Best effort: the next tick retries.
    }
  }
}
