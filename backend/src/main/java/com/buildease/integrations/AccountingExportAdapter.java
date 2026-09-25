package com.buildease.integrations;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Boundary for pushing a building's ledger to an external accounting system (QuickBooks, ...). The
 * only implementation wired up today is {@link StubAccountingExportAdapter} — this platform has no
 * live accounting-integration account, so nothing is actually sent anywhere. A real integration is
 * a config + adapter swap, not a rewrite: implement this interface and wire it in as the
 * {@code @Primary} bean.
 */
public interface AccountingExportAdapter {
  record ExportResult(String status, String providerReference) {}

  ExportResult export(UUID organization, UUID building, List<Map<String, Object>> ledgerLines);
}
