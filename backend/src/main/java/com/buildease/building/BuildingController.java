package com.buildease.building;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/organizations/{organization}/buildings/{building}")
public class BuildingController {
  private final BuildingService service;

  public BuildingController(BuildingService service) {
    this.service = service;
  }

  public record Configuration(
      @NotBlank @Size(max = 120) String name,
      @Size(max = 160) String addressLine1,
      @Size(max = 160) String addressLine2,
      @Size(max = 100) String city,
      @Size(max = 100) String region,
      @Size(max = 24) String postalCode,
      @Pattern(regexp = "[A-Za-z]{2}") String countryCode,
      @NotBlank @Size(max = 64) String timezone,
      @NotBlank @Pattern(regexp = "[A-Za-z]{3}") String currency,
      @Size(max = 160) String emergencyContact) {}

  public record Level(
      @NotBlank @Size(max = 120) String name,
      @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{1,40}") String code,
      @Min(-1000) @Max(1000) int sortOrder) {}

  public record Space(
      UUID levelId,
      UUID parentSpaceId,
      @NotBlank @Size(max = 120) String name,
      @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{1,40}") String code,
      @NotNull SpaceType type,
      boolean rentable,
      @DecimalMin("0.01") @Digits(integer = 10, fraction = 2) BigDecimal area,
      @Min(1) @Max(100000) Integer capacity,
      @Size(max = 1000) String notes) {}

  public record Status(@NotNull SpaceStatus status) {}

  @GetMapping
  Object building(
      @RequestAttribute Actor actor, @PathVariable UUID organization, @PathVariable UUID building) {
    return service.building(actor, organization, building);
  }

  @PutMapping
  void configure(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @Valid @RequestBody Configuration body) {
    service.configure(
        actor,
        organization,
        building,
        body.name(),
        body.addressLine1(),
        body.addressLine2(),
        body.city(),
        body.region(),
        body.postalCode(),
        body.countryCode(),
        body.timezone(),
        body.currency(),
        body.emergencyContact());
  }

  @GetMapping("/levels")
  Object levels(
      @RequestAttribute Actor actor, @PathVariable UUID organization, @PathVariable UUID building) {
    return service.levels(actor, organization, building);
  }

  @PostMapping("/levels")
  Object level(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @Valid @RequestBody Level body) {
    return java.util.Map.of(
        "id",
        service.createLevel(
            actor, organization, building, body.name(), body.code(), body.sortOrder()));
  }

  @GetMapping("/spaces")
  Object spaces(
      @RequestAttribute Actor actor, @PathVariable UUID organization, @PathVariable UUID building) {
    return service.spaces(actor, organization, building);
  }

  @PostMapping("/spaces")
  Object space(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @Valid @RequestBody Space body) {
    return java.util.Map.of(
        "id",
        service.createSpace(
            actor,
            organization,
            building,
            body.levelId(),
            body.parentSpaceId(),
            body.name(),
            body.code(),
            body.type(),
            body.rentable(),
            body.area(),
            body.capacity(),
            body.notes()));
  }

  @PostMapping("/spaces/{space}/status")
  void status(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID space,
      @Valid @RequestBody Status body) {
    service.status(actor, organization, building, space, body.status());
  }
}
