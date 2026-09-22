package com.buildease.occupancy;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/organizations/{organization}/buildings/{building}")
public class OccupancyController {
  private final OccupancyService service;

  public OccupancyController(OccupancyService service) {
    this.service = service;
  }

  public record ResidentBody(
      @NotNull UUID accountId,
      @NotBlank @Size(max = 120) String displayName,
      @Size(max = 40) String phone) {}

  public record ResidentUpdateBody(
      @NotBlank @Size(max = 120) String displayName,
      @Size(max = 40) String phone,
      boolean active) {}

  public record HouseholdBody(
      @NotBlank @Size(max = 120) String name, @Size(max = 60) String relationship) {}

  public record AssignmentBody(
      @NotNull UUID residentId, @NotNull UUID spaceId, @NotNull LocalDate startsOn) {}

  public record EndBody(@NotNull LocalDate endsOn) {}

  @GetMapping("/residents")
  Object residents(
      @RequestAttribute Actor actor, @PathVariable UUID organization, @PathVariable UUID building) {
    return service.residents(actor, organization, building);
  }

  @PostMapping("/residents")
  Object create(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @Valid @RequestBody ResidentBody body) {
    return Map.of(
        "id",
        service.createResident(
            actor, organization, building, body.accountId(), body.displayName(), body.phone()));
  }

  @PatchMapping("/residents/{resident}")
  void update(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID resident,
      @Valid @RequestBody ResidentUpdateBody body) {
    service.updateResident(
        actor, organization, building, resident, body.displayName(), body.phone(), body.active());
  }

  @PostMapping("/residents/{resident}/household-members")
  Object household(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID resident,
      @Valid @RequestBody HouseholdBody body) {
    return Map.of(
        "id",
        service.addHouseholdMember(
            actor, organization, building, resident, body.name(), body.relationship()));
  }

  @PostMapping("/space-assignments")
  Object assign(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @Valid @RequestBody AssignmentBody body) {
    return Map.of(
        "id",
        service.assign(
            actor, organization, building, body.residentId(), body.spaceId(), body.startsOn()));
  }

  @PostMapping("/space-assignments/{assignment}/end")
  void end(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID assignment,
      @Valid @RequestBody EndBody body) {
    service.end(actor, organization, building, assignment, body.endsOn());
  }
}
