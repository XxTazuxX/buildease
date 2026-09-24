package com.buildease.impersonation;

import com.buildease.auth.Actor;
import com.buildease.auth.AuthService;
import com.buildease.common.ApiException;
import com.buildease.common.Store;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ImpersonationService {
  private final Store db;
  private final AuthService auth;

  public ImpersonationService(Store db, AuthService auth) {
    this.db = db;
    this.auth = auth;
  }

  private ApiException denied() {
    return new ApiException(401, "Invalid or expired impersonation session");
  }

  public Map<String, Object> start(Actor admin, UUID targetId) {
    if (!admin.admin() || admin.impersonatedBy() != null) throw ApiException.forbidden();
    if (db.find("select 1 from accounts where id=? and active and platform_admin", admin.id())
        .isEmpty()) throw ApiException.forbidden();
    if (targetId.equals(admin.id()))
      throw new ApiException(400, "Cannot impersonate your own account");
    db.context(admin.id(), null);
    var target =
        db.find("select email,display_name from accounts where id=? and active", targetId)
            .orElseThrow(() -> new ApiException(404, "Account not found"));
    UUID sessionId = UUID.randomUUID();
    db.update(
        "insert into impersonation_sessions(id,admin_account_id,target_account_id) values (?,?,?)",
        sessionId,
        admin.id(),
        targetId);
    db.audit(admin.id(), null, "IMPERSONATION_STARTED", targetId);
    String access = auth.issueImpersonationAccessToken(targetId, sessionId);
    String refreshToken = auth.opaque();
    db.update(
        "insert into impersonation_refresh_tokens(token_hash,impersonation_session_id) values (?,?)",
        AuthService.hash(refreshToken),
        sessionId);
    return Map.of(
        "accessToken",
        access,
        "refreshToken",
        refreshToken,
        "targetEmail",
        target.get("email"),
        "targetDisplayName",
        target.get("display_name"));
  }

  @Transactional(noRollbackFor = ApiException.class)
  public Map<String, Object> refresh(String token) {
    if (token == null) throw denied();
    var found =
        db.find(
            "select t.used,s.id as session_id,s.target_account_id,s.admin_account_id,s.ended_at "
                + "from impersonation_refresh_tokens t join impersonation_sessions s on s.id=t.impersonation_session_id "
                + "where t.token_hash=? for update of t,s",
            AuthService.hash(token));
    if (found.isEmpty()) throw denied();
    var row = found.get();
    UUID sessionId = Store.id(row, "session_id");
    if ((boolean) row.get("used")) {
      db.update(
          "update impersonation_sessions set ended_at=now() where id=? and ended_at is null",
          sessionId);
      throw denied();
    }
    if (row.get("ended_at") != null) throw denied();
    UUID target = Store.id(row, "target_account_id");
    UUID admin = Store.id(row, "admin_account_id");
    if (db.find("select 1 from accounts where id=? and active and platform_admin", admin).isEmpty())
      throw denied();
    if (db.find("select 1 from accounts where id=? and active", target).isEmpty()) throw denied();
    db.update(
        "update impersonation_refresh_tokens set used=true where token_hash=?",
        AuthService.hash(token));
    String newToken = auth.opaque();
    db.update(
        "insert into impersonation_refresh_tokens(token_hash,impersonation_session_id) values (?,?)",
        AuthService.hash(newToken),
        sessionId);
    String access = auth.issueImpersonationAccessToken(target, sessionId);
    return Map.of("accessToken", access, "refreshToken", newToken);
  }

  public void end(Actor actor) {
    if (actor.impersonatedBy() == null) throw new ApiException(400, "Not impersonating");
    db.context(actor.id(), null, actor.impersonatedBy());
    db.update(
        "update impersonation_sessions set ended_at=now() where id=? and ended_at is null",
        actor.sessionId());
    db.audit(actor.id(), null, "IMPERSONATION_ENDED", actor.id());
  }
}
