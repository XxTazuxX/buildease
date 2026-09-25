package com.buildease.leasing;

import com.buildease.auth.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/organizations/{organization}/buildings/{building}/leases/{lease}/pay")
public class OnlinePaymentController {
  private final OnlinePaymentService service;

  public OnlinePaymentController(OnlinePaymentService service) {
    this.service = service;
  }

  public record PayBody(
      @NotNull @DecimalMin("0.01") @Digits(integer = 12, fraction = 2) BigDecimal amount) {}

  @PostMapping
  Object pay(
      @RequestAttribute Actor actor,
      @PathVariable UUID organization,
      @PathVariable UUID building,
      @PathVariable UUID lease,
      @Valid @RequestBody PayBody body) {
    return Map.of("id", service.pay(actor, organization, building, lease, body.amount()));
  }
}
