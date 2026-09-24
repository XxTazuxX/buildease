package com.buildease.onboarding;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/platform/email-templates")
public class EmailTemplateController {
  private final EmailTemplateService service;

  public EmailTemplateController(EmailTemplateService service) {
    this.service = service;
  }

  public record Template(
      @NotBlank @Size(max = 200) String subject, @NotBlank @Size(max = 4000) String body) {}

  @GetMapping
  Object list(@RequestAttribute Actor actor) {
    return service.list(actor);
  }

  @GetMapping("/{key}")
  Object get(@RequestAttribute Actor actor, @PathVariable EmailTemplateKey key) {
    return service.get(actor, key);
  }

  @PutMapping("/{key}")
  void update(
      @RequestAttribute Actor actor,
      @PathVariable EmailTemplateKey key,
      @Valid @RequestBody Template b) {
    service.update(actor, key, b.subject(), b.body());
  }
}
