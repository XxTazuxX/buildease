package com.buildease.integrations;

import com.buildease.auth.Actor;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/organizations/{organization}/buildings/{building}/accounting")
public class AccountingSyncController {
  private final AccountingSyncService service;

  public AccountingSyncController(AccountingSyncService service) {
    this.service = service;
  }

  @PostMapping("/sync")
  Object sync(
      @RequestAttribute Actor actor, @PathVariable UUID organization, @PathVariable UUID building) {
    return Map.of("id", service.sync(actor, organization, building));
  }

  @GetMapping("/syncs")
  Object history(
      @RequestAttribute Actor actor, @PathVariable UUID organization, @PathVariable UUID building) {
    return service.history(actor, organization, building);
  }
}
