package com.buildease.assets;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/organizations/{organization}/buildings/{building}/assets")
public class AssetController {
  private final AssetService service;

  public AssetController(AssetService service) {
    this.service = service;
  }

  public record AssetBody(
      UUID spaceId,
      @NotBlank @Size(max = 160) String name,
      @NotNull AssetCategory category,
      @Size(max = 120) String manufacturer,
      @Size(max = 120) String model,
      @Size(max = 120) String serialNumber,
      LocalDate installDate,
      LocalDate warrantyExpiresOn,
      @Size(max = 2000) String notes) {}

  public record StatusBody(@NotNull AssetStatus status) {}

  public record MeterReadingBody(
      @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal value,
      @NotBlank @Size(max = 24) String unit) {}

  @GetMapping
  Object list(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @RequestParam(required = false) AssetStatus status,
      @RequestParam(required = false) UUID spaceId,
      @RequestParam(defaultValue = "0") @Min(0) int page) {
    return service.list(actor, organization, building, status, spaceId, page);
  }

  @PostMapping
  Object create(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @Valid @RequestBody AssetBody body) {
    return Map.of(
        "id",
        service.create(
            actor,
            organization,
            building,
            body.spaceId(),
            body.name(),
            body.category(),
            body.manufacturer(),
            body.model(),
            body.serialNumber(),
            body.installDate(),
            body.warrantyExpiresOn(),
            body.notes()));
  }

  @GetMapping("/{asset}")
  Object detail(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID asset) {
    return service.detail(actor, organization, building, asset);
  }

  @PatchMapping("/{asset}")
  void update(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID asset,
      @Valid @RequestBody AssetBody body) {
    service.update(
        actor,
        organization,
        building,
        asset,
        body.name(),
        body.category(),
        body.manufacturer(),
        body.model(),
        body.serialNumber(),
        body.installDate(),
        body.warrantyExpiresOn(),
        body.notes());
  }

  @PostMapping("/{asset}/status")
  void status(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID asset,
      @Valid @RequestBody StatusBody body) {
    service.setStatus(actor, organization, building, asset, body.status());
  }

  @PostMapping("/{asset}/meter-readings")
  Object meterReading(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID asset,
      @Valid @RequestBody MeterReadingBody body) {
    return Map.of(
        "id",
        service.recordMeterReading(
            actor, organization, building, asset, body.value(), body.unit()));
  }
}
