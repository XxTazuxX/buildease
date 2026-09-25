package com.buildease.screening;

import java.util.UUID;

/**
 * Boundary for a tenant credit/background/eviction screening bureau (TransUnion SmartMove,
 * Experian, ...). The only implementation wired up today is {@link StubScreeningProvider} — these
 * bureaus require a paid, contracted account and offer no public sandbox, so this platform never
 * calls a real one. A real integration is a config + adapter swap, not a rewrite: implement this
 * interface and wire it in as the {@code @Primary} bean.
 */
public interface ScreeningProvider {
  record ScreeningResult(ScreeningDecision decision, String report, String providerReference) {}

  ScreeningResult run(UUID prospectId, String applicantName, String applicantEmail);
}
