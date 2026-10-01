package com.buildease.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Stub {@link PushSender}: logs that a push would be delivered, without contacting any push
 * service. Notifications still reach the in-app inbox. See the interface Javadoc for enabling real
 * delivery.
 */
@Component
public class LoggingPushSender implements PushSender {
  private static final Logger log = LoggerFactory.getLogger(LoggingPushSender.class);

  @Override
  public boolean send(Subscription subscription, Message message) {
    // Never log the endpoint or keys: they are bearer credentials for the subscription.
    log.debug("Web push delivery is not configured; skipped \"{}\"", message.title());
    return true;
  }
}
