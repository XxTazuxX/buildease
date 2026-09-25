package com.buildease.marketing;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/organizations/{organization}/buildings/{building}/listings")
public class ListingController {
  private final ListingService service;

  public ListingController(ListingService service) {
    this.service = service;
  }

  public record CreateBody(
      @NotNull UUID spaceId,
      @NotBlank @Size(max = 160) String headline,
      @NotBlank @Size(max = 4000) String description,
      @NotNull @DecimalMin("0.01") @Digits(integer = 12, fraction = 2) BigDecimal rentAmount) {}

  public record PublishBody(@NotEmpty Set<ListingChannel> channels) {}

  @GetMapping
  Object list(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @RequestParam(required = false) ListingStatus status,
      @RequestParam(defaultValue = "0") @Min(0) int page) {
    return service.list(actor, organization, building, status, page);
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
            body.headline(),
            body.description(),
            body.rentAmount()));
  }

  @GetMapping("/{listing}")
  Object detail(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID listing) {
    return service.detail(actor, organization, building, listing);
  }

  @PostMapping("/{listing}/publish")
  void publish(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID listing,
      @Valid @RequestBody PublishBody body) {
    service.publish(actor, organization, building, listing, body.channels());
  }

  @PostMapping("/{listing}/unpublish")
  void unpublish(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID listing) {
    service.unpublish(actor, organization, building, listing);
  }
}
