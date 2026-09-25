package com.buildease.integrations;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Test/sandbox implementation of {@link AccountingExportAdapter}: deterministically succeeds
 * without contacting any real accounting system. This is the only implementation wired up — see the
 * interface Javadoc for why.
 */
@Component
public class StubAccountingExportAdapter implements AccountingExportAdapter {
  @Override
  public ExportResult export(
      UUID organization, UUID building, List<Map<String, Object>> ledgerLines) {
    return new ExportResult("SUCCEEDED", "stub-accounting-sync-" + UUID.randomUUID());
  }
}
