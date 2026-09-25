package com.buildease.marketing;

import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Test/sandbox implementation of {@link ListingSyndicationAdapter}: deterministically "publishes" a
 * listing without contacting any real partner. This is the only implementation wired up — see the
 * interface Javadoc for why.
 */
@Component
public class StubListingSyndicationAdapter implements ListingSyndicationAdapter {
  @Override
  public SyndicationResult publish(
      ListingChannel channel,
      UUID listingId,
      String headline,
      String description,
      BigDecimal rentAmount,
      String currency) {
    return new SyndicationResult(
        SyndicationStatus.SYNDICATED, "stub-" + channel.name().toLowerCase() + "-" + listingId);
  }

  @Override
  public void remove(ListingChannel channel, String externalId) {}
}
