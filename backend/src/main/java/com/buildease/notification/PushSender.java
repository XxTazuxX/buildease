package com.buildease.notification;

/**
 * Boundary for delivering a Web Push message to one browser subscription. The only implementation
 * wired up today is {@link LoggingPushSender}, which records the attempt without contacting a push
 * service — production delivery needs a VAPID-signing adapter (and the matching private key) wired
 * in as the {@code @Primary} bean.
 */
public interface PushSender {
  record Subscription(String endpoint, String publicKey, String authSecret) {}

  record Message(String title, String targetPath) {}

  /** Returns false when the push service reports the subscription is gone (410/404). */
  boolean send(Subscription subscription, Message message);
}
