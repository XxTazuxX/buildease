package com.buildease.leasing;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Boundary for an online rent-payment processor (Stripe, ...). The only implementation wired up
 * today is {@link StubPaymentGateway} — this platform has no live payment-processor account, so no
 * real money ever moves. A real integration (e.g. Stripe in test or live mode) is a config +
 * adapter swap, not a rewrite: implement this interface and wire it in as the {@code @Primary}
 * bean.
 */
public interface PaymentGateway {
  record ChargeResult(String status, String gatewayReference) {}

  ChargeResult charge(UUID leaseId, BigDecimal amount, String currency);
}
