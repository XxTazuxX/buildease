package com.buildease.notification;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/organizations/{organization}/buildings/{building}/announcements")
public class AnnouncementController {
  private final AnnouncementService service;

  public AnnouncementController(AnnouncementService service) {
    this.service = service;
  }

  public record SendBody(
      @NotBlank @Size(max = 160) String title,
      @NotBlank @Size(max = 4000) String body,
      @NotNull Audience audience) {}

  @PostMapping
  Object send(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @Valid @RequestBody SendBody body) {
    return Map.of(
        "id",
        service.send(actor, organization, building, body.title(), body.body(), body.audience()));
  }

  @GetMapping
  Object history(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @RequestParam(defaultValue = "0") @Min(0) int page) {
    return service.history(actor, organization, building, page);
  }

  @GetMapping("/{announcement}")
  Object detail(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID announcement) {
    return service.detail(actor, organization, building, announcement);
  }
}
