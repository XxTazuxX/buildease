package com.buildease.inspection;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/organizations/{organization}/buildings/{building}/inspections")
public class InspectionController {
  private final InspectionService service;

  public InspectionController(InspectionService service) {
    this.service = service;
  }

  public record CreateBody(
      @NotNull UUID spaceId,
      UUID leaseId,
      UUID residentId,
      @NotNull InspectionType type,
      @NotNull LocalDate scheduledOn) {}

  public record ItemBody(
      @NotBlank @Size(max = 120) String area,
      @NotNull Condition condition,
      @Size(max = 500) String notes) {}

  public record CompleteBody(@Size(max = 2000) String notes) {}

  @GetMapping
  Object list(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @RequestParam(required = false) UUID spaceId,
      @RequestParam(defaultValue = "0") @Min(0) int page) {
    return service.list(actor, organization, building, spaceId, page);
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
            body.leaseId(),
            body.residentId(),
            body.type(),
            body.scheduledOn()));
  }

  @GetMapping("/{inspection}")
  Object detail(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID inspection) {
    return service.detail(actor, organization, building, inspection);
  }

  @PostMapping("/{inspection}/items")
  Object addItem(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID inspection,
      @Valid @RequestBody ItemBody body) {
    return Map.of(
        "id",
        service.addItem(
            actor,
            organization,
            building,
            inspection,
            body.area(),
            body.condition(),
            body.notes()));
  }

  @PostMapping("/{inspection}/complete")
  void complete(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID inspection,
      @Valid @RequestBody(required = false) CompleteBody body) {
    service.complete(actor, organization, building, inspection, body == null ? null : body.notes());
  }

  @PostMapping("/{inspection}/acknowledge")
  void acknowledge(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID inspection) {
    service.acknowledge(actor, organization, building, inspection);
  }
}
