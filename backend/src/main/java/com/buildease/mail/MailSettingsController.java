package com.buildease.mail;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/platform/mail-settings")
public class MailSettingsController {
  private final MailSettingsService service;

  public MailSettingsController(MailSettingsService service) {
    this.service = service;
  }

  public record Settings(
      @Size(max = 255) String host,
      @Min(1) @Max(65535) int port,
      @Size(max = 255) String username,
      @Size(max = 500) String password,
      @Size(max = 254) String from,
      boolean starttls) {}

  public record Test(@NotBlank @Email @Size(max = 254) String recipient) {}

  @GetMapping
  Object current(@RequestAttribute Actor actor) {
    return service.current(actor);
  }

  @PutMapping
  void update(@RequestAttribute Actor actor, @Valid @RequestBody Settings b) {
    service.update(actor, b.host(), b.port(), b.username(), b.password(), b.from(), b.starttls());
  }

  @PostMapping("/test")
  void test(@RequestAttribute Actor actor, @Valid @RequestBody Test b) {
    service.sendTest(actor, b.recipient());
  }
}
