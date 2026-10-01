package com.buildease.billing;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

/** Platform-operator billing administration: plans, subscriptions, invoices and revenue. */
@RestController
@RequestMapping("/api/platform")
public class PlatformBillingController {
  private final PlanService plans;
  private final SubscriptionService subscriptions;
  private final SaasInvoiceService invoices;

  public PlatformBillingController(
      PlanService plans, SubscriptionService subscriptions, SaasInvoiceService invoices) {
    this.plans = plans;
    this.subscriptions = subscriptions;
    this.invoices = invoices;
  }

  public record Plan(
      @NotBlank @Pattern(regexp = "[A-Za-z0-9_]{2,40}") String code,
      @NotBlank @Size(max = 80) String name,
      @Size(max = 500) String description,
      @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal monthlyPrice,
      @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal annualPrice,
      @Pattern(regexp = "[A-Za-z]{3}") String currency,
      @Min(0) Integer maxBuildings,
      @Min(0) Integer maxSpaces,
      @Min(0) Integer maxStaff,
      @Size(max = 20) List<@Size(max = 120) String> features,
      @Min(0) @Max(90) int trialDays,
      boolean publiclyListed,
      boolean active,
      int sortOrder) {
    PlanService.PlanInput input() {
      return new PlanService.PlanInput(
          code,
          name,
          description,
          monthlyPrice,
          annualPrice,
          currency,
          maxBuildings,
          maxSpaces,
          maxStaff,
          features,
          trialDays,
          publiclyListed,
          active,
          sortOrder);
    }
  }

  public record Assignment(
      @NotNull UUID planId,
      @NotNull SubscriptionService.Status status,
      @NotNull SubscriptionService.Cycle cycle,
      LocalDate trialEndsOn,
      LocalDate periodEnd) {}

  public record NewInvoice(
      @NotNull UUID organizationId,
      @Size(max = 300) String description,
      @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal amount,
      @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal tax,
      LocalDate periodStart,
      LocalDate periodEnd,
      @Size(max = 1000) String notes) {}

  public record Issue(LocalDate dueOn) {}

  public record Payment(
      LocalDate paidOn, @Size(max = 40) String method, @Size(max = 120) String reference) {}

  public record Voiding(@Size(max = 1000) String reason) {}

  @GetMapping("/plans")
  Object plans(@RequestAttribute Actor actor) {
    return plans.all(actor);
  }

  @PostMapping("/plans")
  Map<String, Object> createPlan(@RequestAttribute Actor actor, @Valid @RequestBody Plan body) {
    return Map.of("id", plans.create(actor, body.input()));
  }

  @PutMapping("/plans/{plan}")
  void updatePlan(
      @RequestAttribute Actor actor, @PathVariable UUID plan, @Valid @RequestBody Plan body) {
    plans.update(actor, plan, body.input());
  }

  @GetMapping("/subscriptions")
  Object subscriptions(
      @RequestAttribute Actor actor,
      @RequestParam(required = false) SubscriptionService.Status status,
      @RequestParam(defaultValue = "false") boolean pending,
      @RequestParam(defaultValue = "0") int page) {
    return subscriptions.list(actor, status, pending, page);
  }

  @PutMapping("/subscriptions/{organization}")
  void assign(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @Valid @RequestBody Assignment body) {
    invoices.assignPlan(
        actor,
        organization,
        body.planId(),
        body.status(),
        body.cycle(),
        body.trialEndsOn(),
        body.periodEnd());
  }

  @PostMapping("/subscriptions/{organization}/approve-request")
  void approve(@RequestAttribute Actor actor, @PathVariable UUID organization) {
    invoices.approveRequest(actor, organization);
  }

  @PostMapping("/subscriptions/{organization}/decline-request")
  void decline(@RequestAttribute Actor actor, @PathVariable UUID organization) {
    subscriptions.declineRequest(actor, organization);
  }

  @GetMapping("/billing/summary")
  Object summary(@RequestAttribute Actor actor) {
    return subscriptions.summary(actor);
  }

  @GetMapping("/invoices")
  Object invoices(
      @RequestAttribute Actor actor,
      @RequestParam(required = false) UUID organizationId,
      @RequestParam(required = false) SaasInvoiceService.Status status,
      @RequestParam(defaultValue = "0") int page) {
    return invoices.list(actor, organizationId, status, page);
  }

  @GetMapping("/invoices/{invoice}")
  Object invoice(@RequestAttribute Actor actor, @PathVariable UUID invoice) {
    return invoices.detail(actor, invoice);
  }

  @PostMapping("/invoices")
  Map<String, Object> createInvoice(
      @RequestAttribute Actor actor, @Valid @RequestBody NewInvoice body) {
    return Map.of(
        "id",
        invoices.create(
            actor,
            body.organizationId(),
            body.description(),
            body.amount(),
            body.tax(),
            body.periodStart(),
            body.periodEnd(),
            body.notes()));
  }

  @PostMapping("/invoices/{invoice}/issue")
  void issue(
      @RequestAttribute Actor actor,
      @PathVariable UUID invoice,
      @RequestBody(required = false) Issue body) {
    invoices.issue(actor, invoice, body == null ? null : body.dueOn());
  }

  @PostMapping("/invoices/{invoice}/pay")
  void pay(
      @RequestAttribute Actor actor, @PathVariable UUID invoice, @Valid @RequestBody Payment body) {
    invoices.markPaid(actor, invoice, body.paidOn(), body.method(), body.reference());
  }

  @PostMapping("/invoices/{invoice}/void")
  void voidInvoice(
      @RequestAttribute Actor actor,
      @PathVariable UUID invoice,
      @Valid @RequestBody(required = false) Voiding body) {
    invoices.voidInvoice(actor, invoice, body == null ? null : body.reason());
  }
}
