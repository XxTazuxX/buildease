package com.buildease.integrations;

import com.buildease.common.ApiException;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

/**
 * Read-only export surface for external accounting tools, authenticated by an API key (see {@link
 * ApiKeyService}) instead of the normal browser session — there is no logged-in {@code Actor} on
 * this path, unlike every other controller in this codebase.
 */
@RestController
@RequestMapping("/api/public/v1/organizations/{organization}")
public class PublicAccountingController {
  private final ApiKeyService keys;
  private final AccountingSyncService accounting;

  public PublicAccountingController(ApiKeyService keys, AccountingSyncService accounting) {
    this.keys = keys;
    this.accounting = accounting;
  }

  @GetMapping("/ledger")
  Object ledger(
      @PathVariable UUID organization,
      @RequestHeader("X-API-Key") String apiKey,
      @RequestParam LocalDate from,
      @RequestParam LocalDate to) {
    var resolved = keys.resolve(apiKey);
    if (!resolved.organization().equals(organization))
      throw new ApiException(401, "Invalid API key");
    return accounting.ledger(resolved.organization(), resolved.actingAccount(), from, to);
  }
}
