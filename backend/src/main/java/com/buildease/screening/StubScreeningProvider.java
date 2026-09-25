package com.buildease.screening;

import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Test/sandbox implementation of {@link ScreeningProvider}: deterministically returns a passing
 * report without contacting any real credit or background-check bureau. This is the only
 * implementation wired up — see the interface Javadoc for why.
 */
@Component
public class StubScreeningProvider implements ScreeningProvider {
  @Override
  public ScreeningResult run(UUID prospectId, String applicantName, String applicantEmail) {
    return new ScreeningResult(
        ScreeningDecision.PASS,
        "Sandbox screening report for " + applicantName + ": no adverse records found.",
        "stub-screening-" + prospectId);
  }
}
