package com.buildease.leasing;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/organizations/{organization}/buildings/{building}/leases/{lease}/signature")
public class LeaseSignatureController {
  private final LeaseSignatureService service;

  public LeaseSignatureController(LeaseSignatureService service) {
    this.service = service;
  }

  public record SignBody(
      @NotNull SignatureRole role,
      @NotBlank @Size(max = 160) String signedName,
      @NotNull SignatureMethod method,
      @Size(max = 200000) String signatureData) {}

  @GetMapping
  Object status(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID lease) {
    return service.status(actor, organization, building, lease);
  }

  @PostMapping
  void sign(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID lease,
      @Valid @RequestBody SignBody body) {
    service.sign(
        actor,
        organization,
        building,
        lease,
        body.role(),
        body.signedName(),
        body.method(),
        body.signatureData());
  }
}
