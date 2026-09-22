package com.buildease.leasing;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/organizations/{organization}/buildings/{building}/leases")
public class LeaseController {
  private final LeaseService service;

  public LeaseController(LeaseService service) {
    this.service = service;
  }

  public record LeaseBody(
      @NotNull UUID residentId,
      @NotNull UUID spaceId,
      @NotNull LocalDate startsOn,
      LocalDate endsOn,
      @NotNull @DecimalMin("0.01") @Digits(integer = 12, fraction = 2) BigDecimal rentAmount,
      @NotNull LocalDate firstChargeOn,
      @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal depositAmount,
      LocalDate depositHeldOn) {}

  public record EndBody(@NotNull LocalDate endsOn, @NotNull LeaseEndReason reason) {}

  public record ReasonBody(@NotBlank @Size(max = 500) String reason) {}

  public record PaymentBody(
      @NotNull @DecimalMin("0.01") @Digits(integer = 12, fraction = 2) BigDecimal amount,
      @NotNull PaymentMethod method,
      @Size(max = 120) String reference,
      @NotNull LocalDate receivedOn,
      @Size(max = 500) String notes) {}

  public record DepositBody(
      @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal amount,
      @NotNull LocalDate heldOn) {}

  public record DepositRefundBody(
      @NotNull LocalDate refundedOn,
      @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal refundedAmount,
      @Size(max = 500) String notes) {}

  @GetMapping
  Object leases(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @RequestParam(required = false) LeaseStatus status,
      @RequestParam(defaultValue = "0") @Min(0) int page) {
    return service.leases(actor, organization, building, status, page);
  }

  @PostMapping
  Object create(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @Valid @RequestBody LeaseBody body) {
    return Map.of(
        "id",
        service.createDraft(
            actor,
            organization,
            building,
            body.residentId(),
            body.spaceId(),
            body.startsOn(),
            body.endsOn(),
            body.rentAmount(),
            body.firstChargeOn(),
            body.depositAmount(),
            body.depositHeldOn()));
  }

  @GetMapping("/{lease}")
  Object lease(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID lease) {
    return service.lease(actor, organization, building, lease);
  }

  @PostMapping("/{lease}/activate")
  void activate(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID lease) {
    service.activate(actor, organization, building, lease);
  }

  @PostMapping("/{lease}/cancel")
  void cancel(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID lease) {
    service.cancel(actor, organization, building, lease);
  }

  @PostMapping("/{lease}/end")
  void end(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID lease,
      @Valid @RequestBody EndBody body) {
    service.end(actor, organization, building, lease, body.endsOn(), body.reason());
  }

  @GetMapping("/{lease}/charges")
  Object charges(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID lease) {
    return service.charges(actor, organization, building, lease);
  }

  @GetMapping("/{lease}/payments")
  Object payments(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID lease) {
    return service.payments(actor, organization, building, lease);
  }

  @PostMapping("/{lease}/payments")
  Object recordPayment(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID lease,
      @Valid @RequestBody PaymentBody body) {
    return Map.of(
        "id",
        service.recordPayment(
            actor,
            organization,
            building,
            lease,
            body.amount(),
            body.method(),
            body.reference(),
            body.receivedOn(),
            body.notes()));
  }

  @PostMapping("/{lease}/deposit")
  Object recordDeposit(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID lease,
      @Valid @RequestBody DepositBody body) {
    return Map.of(
        "id",
        service.recordDeposit(actor, organization, building, lease, body.amount(), body.heldOn()));
  }

  @PostMapping("/{lease}/deposit/refund")
  void refundDeposit(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID lease,
      @Valid @RequestBody DepositRefundBody body) {
    service.refundDeposit(
        actor,
        organization,
        building,
        lease,
        body.refundedOn(),
        body.refundedAmount(),
        body.notes());
  }

  @PostMapping("/{lease}/deposit/forfeit")
  void forfeitDeposit(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID lease,
      @Valid @RequestBody ReasonBody body) {
    service.forfeitDeposit(actor, organization, building, lease, body.reason());
  }
}
