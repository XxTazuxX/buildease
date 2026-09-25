package com.buildease.integrations;

import com.buildease.auth.Actor;
import com.buildease.auth.AuthService;
import com.buildease.common.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ApiKeyService {
  private final Store db;
  private final AuthService auth;

  public ApiKeyService(Store db, AuthService auth) {
    this.db = db;
    this.auth = auth;
  }

  public record ResolvedKey(UUID organization, UUID actingAccount) {}

  private boolean enter(Actor actor, UUID organization) {
    db.context(actor.id(), null, actor.impersonatedBy());
    var membership =
        db.find(
            "select owner from memberships where organization_id=? and account_id=? and status='ACTIVE'",
            organization,
            actor.id());
    if (!actor.admin() && membership.isEmpty()) throw ApiException.forbidden();
    db.context(actor.id(), organization, actor.impersonatedBy());
    db.one("select id from organizations where id=? and active", organization);
    return actor.admin() || membership.map(row -> (boolean) row.get("owner")).orElse(false);
  }

  private void owner(Actor actor, UUID organization) {
    if (!enter(actor, organization)) throw ApiException.forbidden();
  }

  public Map<String, Object> create(Actor actor, UUID organization, String name) {
    owner(actor, organization);
    String key = auth.opaque();
    UUID id = UUID.randomUUID();
    db.update(
        "insert into api_keys(id,organization_id,name,key_hash,created_by) values (?,?,?,?,?)",
        id,
        organization,
        name.trim(),
        AuthService.hash(key),
        actor.id());
    db.audit(actor.id(), organization, "API_KEY_CREATED", id);
    return Map.of("id", id, "key", key);
  }

  public List<Map<String, Object>> list(Actor actor, UUID organization) {
    owner(actor, organization);
    return db.rows(
        "select id,name,created_at,last_used_at,revoked_at from api_keys where organization_id=? order by created_at desc",
        organization);
  }

  public void revoke(Actor actor, UUID organization, UUID key) {
    owner(actor, organization);
    db.one("select id from api_keys where organization_id=? and id=?", organization, key);
    db.update("update api_keys set revoked_at=now() where id=? and revoked_at is null", key);
    db.audit(actor.id(), organization, "API_KEY_REVOKED", key);
  }

  public ResolvedKey resolve(String plaintextKey) {
    if (plaintextKey == null || plaintextKey.isBlank())
      throw new ApiException(401, "Missing API key");
    String hash = AuthService.hash(plaintextKey);
    var row =
        db.find(
                "select organization_id,created_by from api_keys where key_hash=? and revoked_at is null",
                hash)
            .orElseThrow(() -> new ApiException(401, "Invalid API key"));
    db.update("update api_keys set last_used_at=now() where key_hash=?", hash);
    return new ResolvedKey(Store.id(row, "organization_id"), Store.id(row, "created_by"));
  }
}
