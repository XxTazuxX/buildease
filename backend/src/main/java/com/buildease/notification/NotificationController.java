package com.buildease.notification;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
  private final NotificationService service;

  public NotificationController(NotificationService service) {
    this.service = service;
  }

  public record Subscription(
      @NotBlank @Size(max = 1000) String endpoint,
      @NotBlank @Size(max = 200) String publicKey,
      @NotBlank @Size(max = 200) String authSecret,
      Instant expiresAt) {}

  @GetMapping
  Object inbox(
      @RequestAttribute Actor actor,
      @RequestParam(defaultValue = "false") boolean unreadOnly,
      @RequestParam(defaultValue = "0") @Min(0) int page) {
    return service.inbox(actor, unreadOnly, page);
  }

  @PostMapping("/{notification}/read")
  void read(@RequestAttribute Actor actor, @PathVariable UUID notification) {
    service.read(actor, notification);
  }

  @GetMapping("/push/configuration")
  Object configuration() {
    return service.webPushConfiguration();
  }

  @PostMapping("/push/subscriptions")
  Object subscribe(@RequestAttribute Actor actor, @Valid @RequestBody Subscription body) {
    return Map.of(
        "id",
        service.subscribe(
            actor, body.endpoint(), body.publicKey(), body.authSecret(), body.expiresAt()));
  }

  @DeleteMapping("/push/subscriptions/{subscription}")
  void unsubscribe(@RequestAttribute Actor actor, @PathVariable UUID subscription) {
    service.unsubscribe(actor, subscription);
  }
}
