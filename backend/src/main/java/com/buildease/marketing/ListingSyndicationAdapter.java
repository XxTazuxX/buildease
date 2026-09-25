package com.buildease.marketing;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Boundary for pushing a listing to an external syndication partner (Zillow, Apartments.com, ...).
 * The only implementation wired up today is {@link StubListingSyndicationAdapter} — none of these
 * partners offer a public sandbox, and this platform has no live partner accounts, so syndication
 * is simulated deterministically. A real partner integration is a config + adapter swap, not a
 * rewrite: implement this interface and wire it in as the {@code @Primary} bean.
 */
public interface ListingSyndicationAdapter {
  record SyndicationResult(SyndicationStatus status, String externalId) {}

  SyndicationResult publish(
      ListingChannel channel,
      UUID listingId,
      String headline,
      String description,
      BigDecimal rentAmount,
      String currency);

  void remove(ListingChannel channel, String externalId);
}
