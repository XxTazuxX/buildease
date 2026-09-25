package com.buildease.integrations;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/organizations/{organization}/api-keys")
public class ApiKeyController {
  private final ApiKeyService service;

  public ApiKeyController(ApiKeyService service) {
    this.service = service;
  }

  public record CreateBody(@NotBlank @Size(max = 120) String name) {}

  @GetMapping
  Object list(@RequestAttribute Actor actor, @PathVariable UUID organization) {
    return service.list(actor, organization);
  }

  @PostMapping
  Object create(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @Valid @RequestBody CreateBody body) {
    return service.create(actor, organization, body.name());
  }

  @DeleteMapping("/{key}")
  void revoke(
      @RequestAttribute Actor actor, @PathVariable UUID organization, @PathVariable UUID key) {
    service.revoke(actor, organization, key);
  }
}
