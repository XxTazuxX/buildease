package com.buildease.billing;

import com.buildease.auth.Actor;
import com.buildease.common.*;
import com.buildease.onboarding.IdentityMail;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Subscription invoices issued by the platform operator to customer organizations. Payment is
 * received out of band (bank transfer, card terminal, ...) and recorded here by an administrator.
 */
@Service
@Transactional
public class SaasInvoiceService {
  private static final Logger log = LoggerFactory.getLogger(SaasInvoiceService.class);
  static final int PAYMENT_TERMS_DAYS = 14;
  private static final String COLUMNS =
      "i.id,i.organization_id,o.name as organization_name,i.number,i.plan_id,p.name as plan_name,i.description,i.period_start,i.period_end,i.subtotal,i.tax,i.total,i.currency,i.status,i.issued_on,i.due_on,i.paid_on,i.payment_method,i.payment_reference,i.notes,i.created_at";

  private final Store db;
  private final SubscriptionService subscriptions;
  private final IdentityMail mail;

  public SaasInvoiceService(Store db, SubscriptionService subscriptions, IdentityMail mail) {
    this.db = db;
    this.subscriptions = subscriptions;
    this.mail = mail;
  }

  public enum Status {
    DRAFT,
    ISSUED,
    OVERDUE,
    PAID,
    VOID
  }

  // ---- Organization-facing -------------------------------------------------------------------

  public List<Map<String, Object>> forOrganization(Actor actor, UUID organization, int page) {
    subscriptions.overview(actor, organization);
    if (page < 0 || page > 10000) throw new ApiException(400, "Invalid page");
    return db.rows(
        "select "
            + COLUMNS
            + " from saas_invoices i join organizations o on o.id=i.organization_id left join plans p on p.id=i.plan_id where i.organization_id=? and i.status<>'DRAFT' order by i.created_at desc,i.id limit 50 offset ?",
        organization,
        page * 50);
  }

  public Map<String, Object> detailForOrganization(Actor actor, UUID organization, UUID invoice) {
    var sub = subscriptions.overview(actor, organization);
    var row =
        db.one(
            "select "
                + COLUMNS
                + " from saas_invoices i join organizations o on o.id=i.organization_id left join plans p on p.id=i.plan_id where i.organization_id=? and i.id=? and i.status<>'DRAFT'",
            organization,
            invoice);
    return withBillTo(row, sub);
  }

  // ---- Platform administration -----------------------------------------------------------------

  public List<Map<String, Object>> list(Actor actor, UUID organization, Status status, int page) {
    Platform.require(db, actor);
    if (page < 0 || page > 10000) throw new ApiException(400, "Invalid page");
    List<Object> args = new ArrayList<>();
    StringBuilder sql =
        new StringBuilder(
            "select "
                + COLUMNS
                + " from saas_invoices i join organizations o on o.id=i.organization_id left join plans p on p.id=i.plan_id where true");
    if (organization != null) {
      sql.append(" and i.organization_id=?");
      args.add(organization);
    }
    if (status != null) {
      sql.append(" and i.status=?");
      args.add(status.name());
    }
    sql.append(" order by i.created_at desc,i.id limit 50 offset ?");
    args.add(page * 50);
    return db.rows(sql.toString(), args.toArray());
  }

  public Map<String, Object> detail(Actor actor, UUID invoice) {
    Platform.require(db, actor);
    var row =
        db.one(
            "select "
                + COLUMNS
                + " from saas_invoices i join organizations o on o.id=i.organization_id left join plans p on p.id=i.plan_id where i.id=?",
            invoice);
    db.context(actor.id(), Store.id(row, "organization_id"), actor.impersonatedBy());
    return withBillTo(row, subscriptions.current(Store.id(row, "organization_id")));
  }

  /** Creates a draft. Without explicit lines, bills the organization's current plan and period. */
  public UUID create(
      Actor actor,
      UUID organization,
      String description,
      BigDecimal subtotal,
      BigDecimal tax,
      LocalDate periodStart,
      LocalDate periodEnd,
      String notes) {
    Platform.require(db, actor);
    db.context(actor.id(), organization, actor.impersonatedBy());
    var sub = subscriptions.current(organization);
    boolean fromPlan = subtotal == null;
    if (fromPlan) {
      subtotal =
          "ANNUAL".equals(sub.get("billing_cycle"))
              ? (BigDecimal) sub.get("annual_price")
              : (BigDecimal) sub.get("monthly_price");
      if (periodStart == null)
        periodStart = ((java.sql.Date) sub.get("current_period_start")).toLocalDate();
      if (periodEnd == null)
        periodEnd = ((java.sql.Date) sub.get("current_period_end")).toLocalDate();
      if (description == null || description.isBlank())
        description =
            "BuildEase "
                + sub.get("plan_name")
                + " plan ("
                + ((String) sub.get("billing_cycle")).toLowerCase(Locale.ROOT)
                + ")";
    }
    if (description == null || description.isBlank())
      throw new ApiException(400, "A description is required");
    if (subtotal.signum() < 0) throw new ApiException(400, "Amount cannot be negative");
    BigDecimal taxAmount = tax == null ? BigDecimal.ZERO : tax;
    if (taxAmount.signum() < 0) throw new ApiException(400, "Tax cannot be negative");
    if ((periodStart == null) != (periodEnd == null)
        || (periodStart != null && !periodEnd.isAfter(periodStart)))
      throw new ApiException(400, "Billing period is invalid");
    return insert(
        actor.id(),
        organization,
        fromPlan ? (UUID) sub.get("plan_id") : null,
        description.trim(),
        periodStart,
        periodEnd,
        subtotal,
        taxAmount,
        (String) sub.get("currency"),
        "DRAFT",
        null,
        null,
        notes);
  }

  public void issue(Actor actor, UUID invoice, LocalDate dueOn) {
    Platform.require(db, actor);
    var row = locked(invoice);
    requireStatus(row, Set.of(Status.DRAFT));
    LocalDate issuedOn = LocalDate.now();
    LocalDate due = dueOn == null ? issuedOn.plusDays(PAYMENT_TERMS_DAYS) : dueOn;
    if (due.isBefore(issuedOn)) throw new ApiException(400, "Due date cannot be in the past");
    db.update(
        "update saas_invoices set status='ISSUED',issued_on=?,due_on=?,updated_at=now() where id=?",
        issuedOn,
        due,
        invoice);
    db.audit(actor.id(), Store.id(row, "organization_id"), "SAAS_INVOICE_ISSUED", invoice);
    notifyIssued(Store.id(row, "organization_id"));
  }

  public void markPaid(
      Actor actor, UUID invoice, LocalDate paidOn, String method, String reference) {
    Platform.require(db, actor);
    var row = locked(invoice);
    requireStatus(row, Set.of(Status.ISSUED, Status.OVERDUE));
    LocalDate paid = paidOn == null ? LocalDate.now() : paidOn;
    if (paid.isAfter(LocalDate.now())) throw new ApiException(400, "Payment date is in the future");
    UUID organization = Store.id(row, "organization_id");
    db.update(
        "update saas_invoices set status='PAID',paid_on=?,payment_method=?,payment_reference=?,updated_at=now() where id=?",
        paid,
        blank(method),
        blank(reference),
        invoice);
    db.context(actor.id(), organization, actor.impersonatedBy());
    // Settling the last overdue invoice brings a past-due customer back into good standing.
    if (db.find(
            "select 1 from saas_invoices where organization_id=? and status='OVERDUE'",
            organization)
        .isEmpty())
      db.update(
          "update organization_subscriptions set status='ACTIVE',updated_at=now() where organization_id=? and status='PAST_DUE'",
          organization);
    db.audit(actor.id(), organization, "SAAS_INVOICE_PAID", invoice);
  }

  public void voidInvoice(Actor actor, UUID invoice, String reason) {
    Platform.require(db, actor);
    var row = locked(invoice);
    requireStatus(row, Set.of(Status.DRAFT, Status.ISSUED, Status.OVERDUE));
    db.update(
        "update saas_invoices set status='VOID',notes=coalesce(?,notes),updated_at=now() where id=?",
        blank(reason),
        invoice);
    db.audit(actor.id(), Store.id(row, "organization_id"), "SAAS_INVOICE_VOIDED", invoice);
  }

  /** Assigns a plan and, when that starts a fresh paid period, invoices it immediately. */
  public void assignPlan(
      Actor actor,
      UUID organization,
      UUID plan,
      SubscriptionService.Status status,
      SubscriptionService.Cycle cycle,
      LocalDate trialEndsOn,
      LocalDate periodEnd) {
    if (subscriptions.assign(actor, organization, plan, status, cycle, trialEndsOn, periodEnd))
      invoiceCurrentPeriod(actor, organization);
  }

  /** Approves the owner's plan request and invoices the first period of the new plan. */
  public void approveRequest(Actor actor, UUID organization) {
    if (subscriptions.approveRequest(actor, organization))
      invoiceCurrentPeriod(actor, organization);
  }

  /**
   * Billing is in advance: the renewal job invoices each later period, so the period that starts
   * when a customer is activated must be invoiced here or it would never be billed.
   */
  private void invoiceCurrentPeriod(Actor actor, UUID organization) {
    db.context(actor.id(), organization, actor.impersonatedBy());
    var sub = subscriptions.current(organization);
    boolean annual = "ANNUAL".equals(sub.get("billing_cycle"));
    BigDecimal price =
        annual ? (BigDecimal) sub.get("annual_price") : (BigDecimal) sub.get("monthly_price");
    if (price.signum() <= 0) return;
    LocalDate start = ((java.sql.Date) sub.get("current_period_start")).toLocalDate();
    if (db.find(
            "select 1 from saas_invoices where organization_id=? and period_start=? and status<>'VOID'",
            organization,
            start)
        .isPresent()) return;
    LocalDate today = LocalDate.now();
    insert(
        actor.id(),
        organization,
        (UUID) sub.get("plan_id"),
        "BuildEase " + sub.get("plan_name") + " plan (" + (annual ? "annual" : "monthly") + ")",
        start,
        ((java.sql.Date) sub.get("current_period_end")).toLocalDate(),
        price,
        BigDecimal.ZERO,
        (String) sub.get("currency"),
        "ISSUED",
        today,
        today.plusDays(PAYMENT_TERMS_DAYS),
        null);
    notifyIssued(organization);
  }

  // ---- Shared with the renewal job -------------------------------------------------------------

  /** Inserts an invoice row; the caller must hold platform-administrator context. */
  UUID insert(
      UUID actor,
      UUID organization,
      UUID plan,
      String description,
      LocalDate periodStart,
      LocalDate periodEnd,
      BigDecimal subtotal,
      BigDecimal tax,
      String currency,
      String status,
      LocalDate issuedOn,
      LocalDate dueOn,
      String notes) {
    UUID id = UUID.randomUUID();
    long sequence =
        ((Number) db.one("select nextval('saas_invoice_seq') as n").get("n")).longValue();
    String number = String.format("BE-%d-%06d", LocalDate.now().getYear(), sequence);
    try {
      db.update(
          "insert into saas_invoices(id,organization_id,number,plan_id,description,period_start,period_end,subtotal,tax,total,currency,status,issued_on,due_on,notes,created_by) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        id,
        organization,
        number,
        plan,
        description,
        periodStart,
        periodEnd,
        subtotal,
        tax,
        subtotal.add(tax),
        currency,
        status,
        issuedOn,
        dueOn,
        blank(notes),
        actor);
    } catch (org.springframework.dao.DataIntegrityViolationException e) {
      throw new ApiException(409, "This billing period has already been 