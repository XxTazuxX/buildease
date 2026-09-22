package com.buildease.maintenance;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/organizations/{organization}/buildings/{building}/maintenance")
public class MaintenanceController {
  private final MaintenanceService service;

  public MaintenanceController(MaintenanceService service) {
    this.service = service;
  }

  public record CategoryBody(
      @NotBlank @Size(max = 120) String name,
      @Min(1) @Max(8760) int responseHours,
      @Min(1) @Max(87600) int resolutionHours) {}

  public record MaintenanceRequestBody(
      @NotNull UUID spaceId,
      @NotNull UUID categoryId,
      @NotBlank @Size(max = 160) String title,
      @NotBlank @Size(max = 4000) String description,
      @NotNull Impact impact,
      boolean danger) {}

  public record TriageBody(@NotNull Priority priority, @NotBlank @Size(max = 500) String reason) {}

  public record StaffBody(
      @NotNull UUID accountId,
      @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal estimatedCost) {}

  public record VendorAssignmentBody(
      @NotNull UUID vendorId,
      @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal estimatedCost) {}

  public record ResolutionBody(@NotBlank @Size(max = 2000) String summary) {}

  public record CloseBody(@NotNull ResolutionOutcome outcome) {}

  public record ReasonBody(@NotBlank @Size(max = 500) String reason) {}

  public record CommentBody(@NotBlank @Size(max = 2000) String body, boolean internal) {}

  public record VendorBody(
      @NotBlank @Size(max = 160) String name,
      @Email @Size(max = 254) String email,
      @Size(max = 40) String phone,
      UUID accountId) {}

  public record RecurringBody(
      @NotNull UUID spaceId,
      @NotNull UUID categoryId,
      @NotBlank @Size(max = 160) String title,
      @NotBlank @Size(max = 2000) String description,
      @Min(1) @Max(3650) int intervalDays,
      @NotNull java.time.LocalDate nextRunOn) {}

  public record WorkLogBody(
      @NotBlank @Size(max = 2000) String note, @Min(1) @Max(1440) Integer minutes) {}

  public record WorkCostBody(
      @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal estimatedCost,
      @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal actualCost) {}

  @GetMapping("/categories")
  Object categories(
      @RequestAttribute Actor actor, @PathVariable UUID organization, @PathVariable UUID building) {
    return service.categories(actor, organization, building);
  }

  @PostMapping("/categories")
  Object category(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @Valid @RequestBody CategoryBody body) {
    return Map.of(
        "id",
        service.createCategory(
            actor,
            organization,
            building,
            body.name(),
            body.responseHours(),
            body.resolutionHours()));
  }

  @GetMapping("/requests")
  Object requests(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @RequestParam(required = false) RequestStatus status,
      @RequestParam(required = false) Priority priority,
      @RequestParam(defaultValue = "0") @Min(0) int page) {
    return service.requests(actor, organization, building, status, priority, page);
  }

  @PostMapping("/requests")
  Object submit(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @Valid @RequestBody MaintenanceRequestBody body) {
    return Map.of(
        "id",
        service.submit(
            actor,
            organization,
            building,
            body.spaceId(),
            body.categoryId(),
            body.title(),
            body.description(),
            body.impact(),
            body.danger()));
  }

  @GetMapping("/requests/{request}")
  Object request(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID request) {
    return service.request(actor, organization, building, request);
  }

  @PostMapping("/requests/{request}/triage")
  void triage(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID request,
      @Valid @RequestBody TriageBody body) {
    service.triage(actor, organization, building, request, body.priority(), body.reason());
  }

  @PostMapping("/requests/{request}/assign-staff")
  Object staff(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID request,
      @Valid @RequestBody StaffBody body) {
    return Map.of(
        "id",
        service.assignStaff(
            actor, organization, building, request, body.accountId(), body.estimatedCost()));
  }

  @PostMapping("/requests/{request}/assign-vendor")
  Object vendorAssignment(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID request,
      @Valid @RequestBody VendorAssignmentBody body) {
    return Map.of(
        "id",
        service.assignVendor(
            actor, organization, building, request, body.vendorId(), body.estimatedCost()));
  }

  @PostMapping("/requests/{request}/start")
  void start(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID request) {
    service.start(actor, organization, building, request);
  }

  @PostMapping("/requests/{request}/resolve")
  void resolve(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID request,
      @Valid @RequestBody ResolutionBody body) {
    service.resolve(actor, organization, building, request, body.summary());
  }

  @PostMapping("/requests/{request}/close")
  void close(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID request,
      @Valid @RequestBody CloseBody body) {
    service.close(actor, organization, building, request, body.outcome());
  }

  @PostMapping("/requests/{request}/cancel")
  void cancel(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID request,
      @Valid @RequestBody ReasonBody body) {
    service.cancel(actor, organization, building, request, body.reason());
  }

  @PostMapping("/requests/{request}/comments")
  Object comment(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID request,
      @Valid @RequestBody CommentBody body) {
    return Map.of(
        "id",
        service.addComment(actor, organization, building, request, body.body(), body.internal()));
  }

  @PostMapping("/work-orders/{workOrder}/logs")
  Object workLog(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID workOrder,
      @Valid @RequestBody WorkLogBody body) {
    return Map.of(
        "id",
        service.addWorkLog(actor, organization, building, workOrder, body.note(), body.minutes()));
  }

  @PostMapping("/work-orders/{workOrder}/costs")
  void workCosts(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID workOrder,
      @Valid @RequestBody WorkCostBody body) {
    service.updateWorkCosts(
        actor, organization, building, workOrder, body.estimatedCost(), body.actualCost());
  }

  @GetMapping("/vendors")
  Object vendors(
      @RequestAttribute Actor actor, @PathVariable UUID organization, @PathVariable UUID building) {
    return service.vendors(actor, organization, building);
  }

  @PostMapping("/vendors")
  Object vendor(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @Valid @RequestBody VendorBody body) {
    return Map.of(
        "id",
        service.createVendor(
            actor,
            organization,
            building,
            body.name(),
            body.email(),
            body.phone(),
            body.accountId()));
  }

  @GetMapping("/recurring-plans")
  Object recurring(
      @RequestAttribute Actor actor, @PathVariable UUID organization, @PathVariable UUID building) {
    return service.recurringPlans(actor, organization, building);
  }

  @PostMapping("/recurring-plans")
  Object recurring(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @Valid @RequestBody RecurringBody body) {
    return Map.of(
        "id",
        service.createRecurringPlan(
            actor,
            organization,
            building,
            body.spaceId(),
            body.categoryId(),
            body.title(),
            body.description(),
            body.intervalDays(),
            body.nextRunOn()));
  }
}
