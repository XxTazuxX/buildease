package com.buildease.screening;

import com.buildease.auth.Actor;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(
    "/api/organizations/{organization}/buildings/{building}/prospects/{prospect}/screenings")
public class ScreeningController {
  private final ScreeningService service;

  public ScreeningController(ScreeningService service) {
    this.service = service;
  }

  @GetMapping
  Object list(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID prospect) {
    return service.list(actor, organization, building, prospect);
  }

  @PostMapping
  Object request(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID prospect) {
    return Map.of("id", service.request(actor, organization, building, prospect));
  }
}
