package com.buildease.notification;

import com.buildease.auth.*;
import com.buildease.common.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class NotificationService {
  private final Store db;
  private final String publicKey;

  public NotificationService(Store db, @Value("${app.web-push-public-key:}") String publicKey) {
    this.db = db;
    this.publicKey = publicKey;
  }

  public List<Map<String, Object>> inbox(Actor actor, boolean unreadOnly, int page) {
    if (page < 0 || page > 10000) throw new ApiException(400, "Invalid page");
    db.context(actor.id(), null);
    return db.rows(
        "select id,organization_id,building_id,type,title,target_path,read_at,created_at from notifications where account_id=? and (?=false or read_at is null) order by created_at desc,id limit 50 offset ?",
        actor.id(),
        unreadOnly,
        page * 50);
  }

  public void read(Actor actor, UUID notification) {
    db.context(actor.id(), null);
    if (db.update(
            "update notifications set read_at=coalesce(read_at,now()) where id=? and account_id=?",
            notification,
            actor.id())
        != 1) throw new ApiException(404, "Notification not found");
  }

  public Map<String, String> webPushConfiguration() {
    if (publicKey.isBlank()) throw new ApiException(503, "Web push is not configured");
    return Map.of("publicKey", publicKey);
  }

  public UUID subscribe(
      Actor actor, String endpoint, String key, String secret, Instant expiresAt) {
    db.context(actor.id(), null);
    String hash = AuthService.hash(endpoint);
    var existing =
        db.find(
            "select id from push_subscriptions where endpoint_hash=? and account_id=?",
            hash,
            actor.id());
    if (existing.isPresent()) {
      UUID id = Store.id(existing.get(), "id");
      db.update(
          "update push_subscriptions set endpoint=?,public_key=?,auth_secret=?,expires_at=?,updated_at=now() where id=?",
          endpoint,
          key,
          secret,
          expiresAt == null ? null : Timestamp.from(expiresAt),
          id);
      return id;
    }
    UUID id = UUID.randomUUID();
    db.update(
        "insert into push_subscriptions(id,account_id,endpoint_hash,endpoint,public_key,auth_secret,expires_at) values (?,?,?,?,?,?,?)",
        id,
        actor.id(),
        hash,
        endpoint,
        key,
        secret,
        expiresAt == null ? null : Timestamp.from(expiresAt));
    return id;
  }

  public void unsubscribe(Actor actor, UUID subscription) {
    db.context(actor.id(), null);
    db.update(
        "delete from push_subscriptions where id=? and account_id=?", subscription, actor.id());
  }
}
