package com.buildease.crm;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/organizations/{organization}/buildings/{building}/prospects")
public class ProspectController {
  private final ProspectService service;

  public ProspectController(ProspectService service) {
    this.service = service;
  }

  public record CreateBody(
      @NotNull UUID spaceId,
      UUID listingId,
      @NotBlank @Size(max = 160) String name,
      @Email @Size(max = 254) String email,
      @Size(max = 40) String phone,
      @Size(max = 2000) String notes) {}

  public record StatusBody(@NotNull ProspectStatus status, @Size(max = 2000) String notes) {}

  public record LinkLeaseBody(@NotNull UUID leaseId) {}

  @GetMapping
  Object list(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @RequestParam(required = false) ProspectStatus status,
      @RequestParam(required = false) UUID spaceId,
      @RequestParam(defaultValue = "0") @Min(0) int page) {
    return service.list(actor, organization, building, status, spaceId, page);
  }

  @PostMapping
  Object create(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @Valid @RequestBody CreateBody body) {
    return Map.of(
        "id",
        service.create(
            actor,
            organization,
            building,
            body.spaceId(),
            body.listingId(),
            body.name(),
            body.email(),
            body.phone(),
            body.notes()));
  }

  @GetMapping("/{prospect}")
  Object detail(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID prospect) {
    return service.detail(actor, organization, building, prospect);
  }

  @PostMapping("/{prospect}/status")
  void status(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID prospect,
      @Valid @RequestBody StatusBody body) {
    service.updateStatus(actor, organization, building, prospect, body.status(), body.notes());
  }

  @PostMapping("/{prospect}/link-lease")
  void linkLease(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID prospect,
      @Valid @RequestBody LinkLeaseBody body) {
    service.linkLease(actor, organization, building, prospect, body.leaseId());
  }
}
