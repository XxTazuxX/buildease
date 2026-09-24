package com.buildease.impersonation;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/impersonation")
public class ImpersonationController {
  private final ImpersonationService service;

  public ImpersonationController(ImpersonationService service) {
    this.service = service;
  }

  public record RefreshBody(@NotBlank String refreshToken) {}

  @PostMapping("/refresh")
  Object refresh(@Valid @RequestBody RefreshBody b) {
    return service.refresh(b.refreshToken());
  }

  @PostMapping("/exit")
  void exit(@RequestAttribute Actor actor) {
    service.end(actor);
  }
}
