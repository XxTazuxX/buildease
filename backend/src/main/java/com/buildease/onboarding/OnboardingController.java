package com.buildease.onboarding;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class OnboardingController {
  private final OnboardingService service;

  public OnboardingController(OnboardingService service) {
    this.service = service;
  }

  public record Registration(
      @NotBlank @Email @Size(max = 254) String email,
      @NotBlank @Size(max = 120) String displayName,
      @NotBlank @Size(max = 120) String organizationName,
      @NotBlank @Size(max = 256) String password) {}

  public record Token(@NotBlank @Size(max = 256) String token) {}

  public record ResetRequest(@NotBlank @Email @Size(max = 254) String email) {}

  public record Reset(
      @NotBlank @Size(max = 256) String token, @NotBlank @Size(max = 256) String password) {}

  @PostMapping("/register")
  ResponseEntity<Void> register(@Valid @RequestBody Registration body) {
    service.register(body.email(), body.displayName(), body.organizationName(), body.password());
    return ResponseEntity.accepted().build();
  }

  @PostMapping("/verify")
  Map<String, Object> verify(@Valid @RequestBody Token body) {
    return Map.of("organizationId", service.verify(body.token()));
  }

  @PostMapping("/forgot-password")
  ResponseEntity<Void> forgot(@Valid @RequestBody ResetRequest body) {
    service.requestReset(body.email());
    return ResponseEntity.accepted().build();
  }

  @PostMapping("/reset-password")
  ResponseEntity<Void> reset(@Valid @RequestBody Reset body) {
    service.reset(body.token(), body.password());
    return ResponseEntity.noContent().build();
  }
}
