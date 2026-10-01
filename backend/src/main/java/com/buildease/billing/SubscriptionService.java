package com.buildease.billing;

import com.buildease.auth.Actor;
import com.buildease.common.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Organization subscriptions: which plan a customer is on, its lifecycle state, usage against plan
 * limits, and plan-change requests. Payment is collected manually against {@link
 * SaasInvoiceService} invoices.
 */
@Service
@Transactional
public class SubscriptionService {
  static final UUID TRIAL_PLAN = UUID.fromString("00000000-0000-4000-8000-000000000001");
  static final UUID GRANDFATHERED_PLAN = UUID.fromString("00000000-0000-4000-8000-000000000003");

  public enum Resource {
    BUILDING,
    SPACE,
    STAFF
  }

  public enum Status {
    TRIALING,
    ACTIVE,
    PAST_DUE,
    SUSPENDED,
    CANCELLED
  }

  public enum Cycle {
    MONTHLY,
    ANNUAL
  }

  private final Store db;

  public SubscriptionService(Store db) {
    this.db = db;
  }

  // ---- Organization-facing -------------------------------------------------------------------

  /** Minimal subscription state any active member may read (drives the in-app banner). */
  public Map<String, Object> status(Actor actor, UUID organization) {
    member(actor, organization);
    var sub = current(organization);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("status", sub.get("status"));
    result.put("planCode", sub.get("plan_code"));
    result.put("planName", sub.get("plan_name"));
    result.put("trialEndsOn", sub.get("trial_ends_on"));
    result.put("trialDaysLeft", trialDaysLeft(sub));
    result.put("writable", writable(sub));
    return result;
  }

  public Map<String, Object> overview(Actor actor, UUID organization) {
    owner(actor, organization);
    var sub = current(organization);
    Map<String, Object> result = new LinkedHashMap<>(sub);
    result.put("trial_days_left", trialDaysLeft(sub));
    result.put("writable", writable(sub));
    Map<String, Object> usage = new LinkedHashMap<>();
    usage.put("buildings", usage(organization, Resource.BUILDING));
    usage.put("spaces", usage(organization, Resource.SPACE));
    usage.put("staff", usage(organization, Resource.STAFF));
    result.put("usage", usage);
    Map<String, Object> limits = new LinkedHashMap<>();
    limits.put("buildings", sub.get("max_buildings"));
    limits.put("spaces", sub.get("max_spaces"));
    limits.put("staff", sub.get("max_staff"));
    result.put("limits", limits);
    result.put(
        "requested_plan",
        sub.get("requested_plan_id") == null
            ? null
            : PlanService.normalize(
                db.one(
                    "select " + PlanService.COLUMNS + " from plans where id=?",
                    sub.get("requested_plan_id"))));
    return result;
  }

  public void updateProfile(
      Actor actor,
      UUID organization,
      String billingEmail,
      String billingName,
      String billingAddress,
      String taxId) {
    owner(actor, organization);
    current(organization);
    db.update(
        "update organization_subscriptions set billing_email=?,billing_name=?,billing_address=?,tax_id=?,updated_at=now() where organization_id=?",
        blank(billingEmail),
        blank(billingName),
        blank(billingAddress),
        blank(taxId),
        organization);
    db.audit(actor.id(), organization, "BILLING_PROFILE_UPDATED", organization);
  }

  public void requestPlan(Actor actor, UUID organization, UUID plan, Cycle cycle) {
    owner(actor, organization);
    var sub = current(organization);
    db.one("select id from plans where id=? and active and public", plan);
    if (plan.equals(sub.get("plan_id"))
        && cycle.name().equals(sub.get("billing_cycle"))
        && !"TRIALING".equals(sub.get("status")))
      throw new ApiException(409, "You are already on this plan");
    db.update(
        "update organization_subscriptions set requested_plan_id=?,requested_cycle=?,requested_at=now(),updated_at=now() where organization_id=?",
        plan,
        cycle.name(),
        organization);
    db.audit(actor.id(), organization, "PLAN_CHANGE_REQUESTED", plan);
  }

  public void withdrawRequest(Actor actor, UUID organization) {
    owner(actor, organization);
    current(organization);
    db.update(
        "update organization_subscriptions set requested_plan_id=null,requested_cycle=null,requested_at=null,updated_at=now() where organization_id=?",
        organization);
    db.audit(actor.id(), organization, "PLAN_CHANGE_WITHDRAWN", organization);
  }

  // ---- Lifecycle hooks used by other domains ---------------------------------------------------

  /** Starts the free trial for a newly created organization (caller has set the org context). */
  public void startTrial(UUID organization) {
    var plan = db.one("select trial_days from plans where id=?", TRIAL_PLAN);
    int days = Math.max(1, ((Number) plan.get("trial_days")).intValue());
    LocalDate today = LocalDate.now();
    db.update(
        "insert into organization_subscriptions(organization_id,plan_id,status,billing_cycle,trial_ends_on,current_period_start,current_period_end) values (?,?,'TRIALING','MONTHLY',?,?,?) on conflict(organization_id) do nothing",
        organization,
        TRIAL_PLAN,
        today.plusDays(days),
        today,
        today.plusDays(days));
  }

  /**
   * Provisions a platform-managed organization. Operators create these deliberately, so they start
   * on the paid default plan (the operator invoices them) instead of a trial.
   */
  public void provision(UUID organization) {
    current(organization);
  }

  /**
   * Enforces the plan before creating a resource. The caller has already authorized the actor and
   * set the organization context. Responds 402 when the subscription is inactive or full.
   */
  public void requireCapacity(UUID organization, Resource resource) {
    var sub = current(organization);
    if (!writable(sub))
      throw new ApiException(
          402,
          "TRIALING".equals(sub.get("status"))
              ? "Your free trial has ended. Choose a plan in Billing to keep adding data."
              : "Your subscription is not active. Visit Billing to reactivate it.");
    String column =
        switch (resource) {
          case BUILDING -> "max_buildings";
          case SPACE -> "max_spaces";
          case STAFF -> "max_staff";
        };
    Object limit = sub.get(column);
    if (limit == null) return;
    long max = ((Number) limit).longValue();
    if (usage(organization, resource) >= max)
      throw new ApiException(
          402,
          "Your "
              + sub.get("plan_name")
              + " plan allows "
              + max
              + " "
              + label(resource, max)
              + ". Upgrade your plan in Billing to add more.");
  }

  // ---- Platform administration -----------------------------------------------------------------

  public List<Map<String, Object>> list(Actor actor, Status status, boolean pendingOnly, int page) {
    Platform.require(db, actor);
    if (page < 0 || page > 10000) throw new ApiException(400, "Invalid page");
    List<Object> args = new ArrayList<>();
    StringBuilder sql =
        new StringBuilder(
            "select o.id as organization_id,o.name as organization_name,o.active as organization_active,"
                + "s.status,s.billing_cycle,s.trial_ends_on,s.current_period_start,s.current_period_end,s.billing_email,"
                + "p.id as plan_id,p.code as plan_code,p.name as plan_name,p.monthly_price,p.annual_price,p.currency,"
                + "s.requested_plan_id,rp.name as requested_plan_name,s.requested_cycle,s.requested_at "
                + "from organizations o left join organization_subscriptions s on s.organization_id=o.id "
                + "left join plans p on p.id=s.plan_id left join plans rp on rp.id=s.requested_plan_id where true");
    if (status != null) {
      sql.append(" and s.status=?");
      args.add(status.name());
    }
    if (pendingOnly) sql.append(" and s.requested_plan_id is not null");
    sql.append(" order by s.requested_at desc nulls last,o.name,o.id limit 50 offset ?");
    args.add(page * 50);
    return db.rows(sql.toString(), args.toArray());
  }

  /** Applies an operator decision; returns true when a fresh paid billing period began today. */
  public boolean assign(
      Actor actor,
      UUID organization,
      UUID plan,
      Status status,
      Cycle cycle,
      LocalDate trialEndsOn,
      LocalDate periodEnd) {
    Platform.require(db, actor);
    db.context(actor.id(), organization, actor.impersonatedBy());
    db.one("select id from organizations where id=? for update", organization);
    var sub = current(organization);
    db.one("select id from plans where id=?", plan);
    if (status == Status.TRIALING && trialEndsOn == null)
      throw new ApiException(400, "A trial end date is required");
    LocalDate start = ((java.sql.Date) sub.get("current_period_start")).toLocalDate();
    LocalDate end = ((java.sql.Date) sub.get("current_period_end")).toLocalDate();
    boolean activating = status == Status.ACTIVE && !Status.ACTIVE.name().equals(sub.get("status"));
    boolean freshPeriod = activating && !"PAST_DUE".equals(sub.get("status"));
    if (freshPeriod) {
      // A newly paying customer starts a fresh billing period today.
      start = LocalDate.now();
      end = cycle == Cycle.ANNUAL ? start.plusYears(1) : start.plusMonths(1);
    }
    if (periodEnd != null) {
      if (!periodEnd.isAfter(start))
        throw new ApiException(400, "Period end must be after the period start");
      end = periodEnd;
    }
    boolean clearsRequest =
        plan.equals(sub.get("requested_plan_id"))
            && cycle.name().equals(sub.get("requested_cycle"));
    db.update(
        "update organization_subscriptions set plan_id=?,status=?,billing_cycle=?,trial_ends_on=?,current_period_start=?,current_period_end=?"
            + (clearsRequest
                ? ",requested_plan_id=null,requested_cycle=null,requested_at=null"
                : "")
            + ",updated_at=now() where organization_id=?",
        plan,
        status.name(),
        cycle.name(),
        status == Status.TRIALING ? trialEndsOn : null,
        start,
        end,
        organization);
    // Suspension reuses the existing disabled-organization lockout; any other state re-enables.
    db.update(
        "update organizations set active=? where id=?", status != Status.SUSPENDED, organization);
    db.audit(actor.id(), organization, "SUBSCRIPTION_CHANGED", organization);
    return freshPeriod;
  }

  public boolean approveRequest(Actor actor, UUID organization) {
    Platform.require(db, actor);
    db.context(actor.id(), organization, actor.impersonatedBy());
    var sub = current(organization);
    if (sub.get("requested_plan_id") == null)
      throw new ApiException(409, "There is no pending plan request");
    return assign(
        actor,
        organization,
        (UUID) sub.get("requested_plan_id"),
        Status.ACTIVE,
        Cycle.valueOf((String) sub.get("requested_cycle")),
        null,
        null);
  }

  public void declineRequest(Actor actor, UUID organization) {
    Platform.require(db, actor);
    db.context(actor.id(), organization, actor.impersonatedBy());
    current(organization);
    db.update(
        "update organization_subscriptions set requested_plan_id=null,requested_cycle=null,requested_at=null,updated_at=now() where organization_id=?",
        organization);
    db.audit(actor.id(), organization, "PLAN_CHANGE_DECLINED", organization);
  }

  public Map<String, Object> summary(Actor actor) {
    Platform.require(db, actor);
    Map<String, Object> result = new LinkedHashMap<>();
    BigDecimal mrr = BigDecimal.ZERO;
    for (var row :
        db.rows(
            "select s.billing_cycle,p.monthly_price,p.annual_price from organization_subscriptions s join plans p on p.id=s.plan_id where s.status in ('ACTIVE','PAST_DUE')")) {
      mrr =
          mrr.add(
              "ANNUAL".equals(row.get("billing_cycle"))
                  ? ((BigDecimal) row.get("annual_price"))
                      .divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP)
                  : (BigDecimal) row.get("monthly_price"));
    }
    result.put("mrr", mrr);
    result.put("arr", mrr.multiply(BigDecimal.valueOf(12)));
    Map<String, Object> counts = new LinkedHashMap<>();
    for (Status status : Status.values()) counts.put(status.name(), 0L);
    db.rows("select status,count(*) as n from organization_subscriptions group by status")
        .forEach(
            row -> counts.put((String) row.get("status"), ((Number) row.get("n")).longValue()));
    result.put("subscriptions", counts);
    result.put(
        "pendingRequests",
        ((Number)
                db.one(
                        "select count(*) as n from organization_subscriptions where requested_plan_id is not null")
                    .get("n"))
            .longValue());
    result.put(
        "outstanding",
        db.one(
                "select coalesce(sum(total),0) as total from saas_invoices where status in ('ISSUED','OVERDUE')")
            .get("total"));
    result.put(
        "overdue",
        db.one("select coalesce(sum(total),0) as total from saas_invoices where status='OVERDUE'")
            .get("total"));
    result.put(
        "collectedLast30Days",
        db.one(
                "select coalesce(sum(total),0) as total from saas_invoices where status='PAID' and paid_on>=current_date-30")
            .get("total"));
    result.put("currency", "USD");
    return result;
  }

  // ---- Internals -------------------------------------------------------------------------------

  /** The organization's subscription joined with its plan, created lazily if missing. */
  Map<String, Object> current(UUID organization) {
    var found = find(organization);
    if (found.isPresent()) return found.get();
    LocalDate today = LocalDate.now();
    db.update(
        "insert into organization_subscriptions(organization_id,plan_id,status,current_period_start,current_period_end) values (?,?,'ACTIVE',?,?) on conflict(organization_id) do nothing",
        organization,
        GRANDFATHERED_PLAN,
        today,
        today.plusMonths(1));
    return find(organization).orElseThrow(() -> new ApiException(404, "Record not found"));
  }

  private Optional<Map<String, Object>> find(UUID organization) {
    return db.find(
            "select s.*,p.code as plan_code,p.name as plan_name,p.monthly_price,p.annual_price,p.currency,p.max_buildings,p.max_spaces,p.max_staff,p.features "
                + "from organization_subscriptions s join plans p on p.id=s.plan_id where s.organization_id=?",
            organization)
        .map(PlanService::normalize);
  }

  static boolean writable(Map<String, Object> sub) {
    String status = (String) sub.get("status");
    if ("SUSPENDED".equals(status) || "CANCELLED".equals(status)) return false;
    if ("TRIALING".equals(status) && sub.get("trial_ends_on") != null)
      return !((java.sql.Date) sub.get("trial_ends_on")).toLocalDate().isBefore(LocalDate.now());
    return true;
  }

  private static Long trialDaysLeft(Map<String, Object> sub) {
    if (!"TRIALING".equals(sub.get("status")) || sub.get("trial_ends_on") == null) return null;
    long days =
        ChronoUnit.DAYS.between(
            LocalDate.now(), ((java.sql.Date) sub.get("trial_ends_on")).toLocalDate());
    return Math.max(0, days);
  }

  long usage(UUID organization, Resource resource) {
    String sql =
        switch (resource) {
          case BUILDING -> "select count(*) as n from buildings where organization_id=?";
          case SPACE -> "select count(*) as n from spaces where organization_id=?";
          case STAFF ->
              "select count(*) as n from memberships m where m.organization_id=? and m.status in ('ACTIVE','PENDING') and (m.owner or exists(select 1 from building_roles r where r.organization_id=m.organization_id and r.account_id=m.account_id and r.role not in ('TENANT','VENDOR')))";
        };
    return ((Number) db.one(sql, organization).get("n")).longValue();
  }

  private static String label(Resource resource, long count) {
    String noun =
        switch (resource) {
          case BUILDING -> "building";
          case SPACE -> "unit";
          case STAFF -> "staff seat";
        };
    return count == 1 ? noun : noun + "s";
  }

  private void member(Actor actor, UUID organization) {
    db.context(actor.id(), null, actor.impersonatedBy());
    if (!actor.admin()
        && db.find(
                "select 1 from memberships where organization_id=? and account_id=? and status='ACTIVE'",
                organization,
                actor.id())
            .isEmpty()) throw ApiException.forbidden();
    db.context(actor.id(), organization, actor.impersonatedBy());
    db.one("select id from organizations where id=?", organization);
  }

  /**
   * Owners manage billing. Unlike other domains this does not require the organization to be
   * active, so a suspended customer can still see what they owe.
   */
  private void owner(Actor actor, UUID organization) {
    db.context(actor.id(), null, actor.impersonatedBy());
    v