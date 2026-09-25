package com.buildease.leasing;

import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Test/sandbox implementation of {@link PaymentGateway}: deterministically succeeds without
 * contacting any real payment processor or moving real money. This is the only implementation wired
 * up — see the interface Javadoc for why.
 */
@Component
public class StubPaymentGateway implements PaymentGateway {
  @Override
  public ChargeResult charge(UUID leaseId, BigDecimal amount, String currency) {
    return new ChargeResult("SUCCEEDED", "stub-charge-" + UUID.randomUUID());
  }
}
