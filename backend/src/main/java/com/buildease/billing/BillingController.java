package com.buildease.billing;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

/** Customer-facing billing: the public plan catalogue and an organization's own subscription. */
@RestController
@RequestMapping("/api")
public class BillingController {
  private final PlanService plans;
  private final SubscriptionService subscriptions;
  private final SaasInvoiceService invoices;

  public BillingController(
      PlanService plans, SubscriptionService subscriptions, SaasInvoiceService invoices) {
    this.plans = plans;
    this.subscriptions = subscriptions;
    this.invoices = invoices;
  }

  public record Profile(
      @Email @Size(max = 254) String billingEmail,
      @Size(max = 160) String billingName,
      @Size(max = 500) String billingAddress,
      @Size(max = 60) String taxId) {}

  public record PlanRequest(@NotNull UUID planId, @NotNull SubscriptionService.Cycle cycle) {}

  @GetMapping("/public/plans")
  Object publicPlans() {
    return plans.publicPlans();
  }

  @GetMapping("/organizations/{organization}/billing/status")
  Object status(@RequestAttribute Actor actor, @PathVariable UUID organization) {
    return subscriptions.status(actor, organization);
  }

  @GetMapping("/organizations/{organization}/billing")
  Object overview(@RequestAttribute Actor actor, @PathVariable UUID organization) {
    return subscriptions.overview(actor, organization);
  }

  @PatchMapping("/organizations/{organization}/billing")
  void profile(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @Valid @RequestBody Profile body) {
    subscriptions.updateProfile(
        actor,
        organization,
        body.billingEmail(),
        body.billingName(),
        body.billingAddress(),
        body.taxId());
  }

  @PostMapping("/organizations/{organization}/billing/plan-request")
  void requestPlan(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @Valid @RequestBody PlanRequest body) {
    subscriptions.requestPlan(actor, organization, body.planId(), body.cycle());
  }

  @DeleteMapping("/organizations/{organization}/billing/plan-request")
  void withdrawRequest(@RequestAttribute Actor actor, @PathVariable UUID organization) {
    subscriptions.withdrawRequest(actor, organization);
  }

  @GetMapping("/organizations/{organization}/billing/invoices")
  Object invoices(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @RequestParam(defaultValue = "0") int page) {
    return invoices.forOrganization(actor, organization, page);
  }

  @GetMapping("/organizations/{organization}/billing/invoices/{invoice}")
  Map<String, Object> invoice(
      @RequestAttribute Actor actor, @PathVariable UUID organization, @PathVariable UUID invoice) {
    return invoices.detailForOrganization(actor, organization, invoice);
  }
}
