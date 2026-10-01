package com.buildease.notification;

import com.buildease.common.Store;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Offers each new in-app notification to the recipient's registered browsers through {@link
 * PushSender}. Runs only when a VAPID public key is configured, so installations without web push
 * never mark notifications as attempted.
 */
@Service
public class PushDispatcher {
  private static final Logger log = LoggerFactory.getLogger(PushDispatcher.class);
  private final Store db;
  private final TransactionTemplate transactions;
  private final PushSender sender;
  private final boolean configured;

  public PushDispatcher(
      Store db,
      TransactionTemplate transactions,
      PushSender sender,
      @Value("${app.web-push-public-key:}") String publicKey) {
    this.db = db;
    this.transactions = transactions;
    this.sender = sender;
    this.configured = !publicKey.isBlank();
  }

  @Scheduled(fixedDelayString = "${app.push-delay-ms:15000}")
  public void run() {
    if (!configured) return;
    List<UUID> recipients =
        transactions.execute(
            status -> {
              var admin =
                  db.find(
                      "select id from accounts where active and platform_admin order by created_at,id limit 1");
              if (admin.isEmpty()) return List.<UUID>of();
              db.context(Store.id(admin.get(), "id"), null);
              return db
                  .rows(
                      "select distinct account_id from notifications where push_attempted_at is null and created_at>now()-interval '1 day' limit 500")
                  .stream()
                  .map(row -> Store.id(row, "account_id"))
                  .toList();
            });
    for (UUID account : recipients) {
      try {
        transactions.executeWithoutResult(status -> deliver(account));
      } catch (RuntimeException error) {
        log.warn("Web push dispatch failed for one recipient", error);
      }
    }
  }

  private void deliver(UUID account) {
    // Act as the recipient: RLS only exposes their own notifications and subscriptions.
    db.context(account, null);
    var subscriptions =
        db.rows(
            "select id,endpoint,public_key,auth_secret from push_subscriptions where account_id=? and (expires_at is null or expires_at>now())",
            account);
    for (var notification :
        db.rows(
            "select id,title,target_path from notifications where account_id=? and push_attempted_at is null and created_at>now()-interval '1 day' order by created_at for update skip locked",
            account)) {
      var message =
          new PushSender.Message(
              (String) notification.get("title"), (String) notification.get("target_path"));
      for (var subscription : subscriptions) {
        boolean alive =
            sender.send(
                new PushSender.Subscription(
                    (String) subscription.get("endpoint"),
                    (String) subscription.get("public_key"),
                    (String) subscription.get("auth_secret")),
                message);
        if (!alive) db.update("delete from push_subscriptions where id=?", subscription.get("id"));
      }
      db.update(
          "update notifications set push_attempted_at=now() where id=?", notification.get("id"));
    }
  }
}
