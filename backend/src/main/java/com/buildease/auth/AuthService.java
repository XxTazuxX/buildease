package com.buildease.auth;

import com.buildease.common.*;
import com.buildease.security.PasswordPolicy;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
  private final Store db;
  private final PasswordEncoder passwords;
  private final JwtEncoder jwt;
  private final SecureRandom random = new SecureRandom();
  private final String dummy;

  public AuthService(Store db, PasswordEncoder passwords, JwtEncoder jwt) {
    this.db = db;
    this.passwords = passwords;
    this.jwt = jwt;
    dummy = passwords.encode("Dummy password for timing");
  }

  public record Tokens(String accessToken, String refreshToken, boolean mustChangePassword) {}

  public static String email(String email) {
    return email.trim().toLowerCase(Locale.ROOT);
  }

  public static String hash(String value) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }

  public String opaque() {
    byte[] b = new byte[32];
    random.nextBytes(b);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
  }

  private ApiException denied() {
    return new ApiException(401, "Invalid credentials or session");
  }

  @Transactional(noRollbackFor = ApiException.class)
  public Tokens login(String email, String password, String address) {
    String normalized = email(email);
    String key = hash(normalized);
    String ipKey = hash("ip:" + address);
    throttle(key);
    throttle(ipKey);
    var found = db.find("select * from accounts where email=? for update", normalized);
    String encoded = found.map(a -> (String) a.get("password_hash")).orElse(dummy);
    boolean valid = passwords.matches(password, encoded);
    if (found.isEmpty()
        || !valid
        || !(boolean) found.get().get("active")
        || expiredTemporary(found.get())) {
      fail(key);
      fail(ipKey);
      throw denied();
    }
    var account = found.get();
    UUID id = Store.id(account, "id");
    db.context(id, null);
    db.update("update login_attempts set failures=0,blocked_until=null where key_hash=?", key);
    UUID session = UUID.randomUUID();
    db.update(
        "insert into auth_sessions(id,account_id,expires_at) values (?,?,?)",
        session,
        id,
        java.sql.Timestamp.from(Instant.now().plus(Duration.ofDays(7))));
    db.audit(id, null, "LOGIN", id);
    return issue(account, session);
  }

  private void throttle(String key) {
    db.update("insert into login_attempts(key_hash) values (?) on conflict do nothing", key);
    var attempt = db.one("select * from login_attempts where key_hash=? for update", key);
    if (attempt.get("blocked_until") != null
        && ((java.sql.Timestamp) attempt.get("blocked_until")).toInstant().isAfter(Instant.now()))
      throw new ApiException(429, "Too many attempts. Try again later.");
    db.update(
        "update login_attempts set failures=0,window_started=now(),blocked_until=null where key_hash=? and window_started < now()-interval '15 minutes'",
        key);
  }

  private void fail(String key) {
    db.update(
        "update login_attempts set failures=failures+1,blocked_until=case when failures+1>=10 then now()+interval '15 minutes' else blocked_until end where key_hash=?",
        key);
  }

  private boolean expiredTemporary(Map<String, Object> a) {
    return (boolean) a.get("must_change_password")
        && (a.get("temporary_password_expires_at") == null
            || ((java.sql.Timestamp) a.get("temporary_password_expires_at"))
                .toInstant()
                .isBefore(Instant.now()));
  }

  private Tokens issue(Map<String, Object> account, UUID session) {
    Instant now = Instant.now();
    boolean change = (boolean) account.get("must_change_password");
    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .issuer("buildease")
            .audience(List.of("buildease-api"))
            .subject(account.get("id").toString())
            .issuedAt(now)
            .expiresAt(now.plusSeconds(600))
            .claim("sid", session.toString())
            .build();
    String access =
        jwt.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
            .getTokenValue();
    String refresh = opaque();
    db.update(
        "insert into refresh_tokens(token_hash,session_id) values (?,?)", hash(refresh), session);
    return new Tokens(access, refresh, change);
  }

  @Transactional(noRollbackFor = ApiException.class)
  public Tokens refresh(String token) {
    if (token == null) throw denied();
    var tokenOwner =
        db.find(
                "select s.account_id from auth_sessions s join refresh_tokens r on r.session_id=s.id where r.token_hash=?",
                hash(token))
            .orElseThrow(this::denied);
    var a = db.one("select * from accounts where id=? for update", tokenOwner.get("account_id"));
    var found =
        db.find(
            "select s.*,r.used from auth_sessions s join refresh_tokens r on r.session_id=s.id where r.token_hash=? for update of s,r",
            hash(token));
    if (found.isEmpty()) throw denied();
    var s = found.get();
    UUID sid = Store.id(s, "id");
    if ((boolean) s.get("used")) {
      db.update("update auth_sessions set revoked=true where id=?", sid);
      throw denied();
    }

    if ((boolean) s.get("revoked")
        || ((java.sql.Timestamp) s.get("expires_at")).toInstant().isBefore(Instant.now())
        || !(boolean) a.get("active")
        || expiredTemporary(a)) throw denied();
    db.update("update refresh_tokens set used=true where token_hash=?", hash(token));
    return issue(a, sid);
  }

  @Transactional(readOnly = true)
  public Actor authenticate(Jwt token) {
    UUID id = UUID.fromString(token.getSubject());
    String imp = token.getClaimAsString("imp");
    if (imp != null) return authenticateImpersonation(id, UUID.fromString(imp));
    UUID sid = UUID.fromString(token.getClaimAsString("sid"));
    var a =
        db.find(
                "select a.* from accounts a join auth_sessions s on s.account_id=a.id where a.id=? and s.id=? and a.active and not s.revoked and s.expires_at>now()",
                id,
                sid)
            .orElseThrow(this::denied);
    if (expiredTemporary(a)) throw denied();
    return new Actor(
        id, sid, (boolean) a.get("platform_admin"), (boolean) a.get("must_change_password"));
  }

  private Actor authenticateImpersonation(UUID target, UUID impersonationSessionId) {
    var session =
        db.find(
                "select admin_account_id from impersonation_sessions where id=? and target_account_id=? and ended_at is null",
                impersonationSessionId,
                target)
            .orElseThrow(this::denied);
    UUID admin = Store.id(session, "admin_account_id");
    if (db.find("select 1 from accounts where id=? and active and platform_admin", admin).isEmpty())
      throw denied();
    // Unlike a normal login, impersonation never relies on the target's own password/credential
    // state, so an expired or pending temporary password must not block an admin from viewing
    // as them.
    var a =
        db.find("select * from accounts where id=? and active", target).orElseThrow(this::denied);
    return new Actor(
        target,
        impersonationSessionId,
        (boolean) a.get("platform_admin"),
        (boolean) a.get("must_change_password"),
        admin);
  }

  public String issueImpersonationAccessToken(UUID targetAccountId, UUID impersonationSessionId) {
    Instant now = Instant.now();
    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .issuer("buildease")
            .audience(List.of("buildease-api"))
            .subject(targetAccountId.toString())
            .issuedAt(now)
            .expiresAt(now.plusSeconds(600))
            .claim("imp", impersonationSessionId.toString())
            .build();
    return jwt.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
        .getTokenValue();
  }

  @Transactional
  public void logout(String refresh, Actor actor) {
    if (refresh != null)
      db.update(
          "update auth_sessions set revoked=true where id in (select session_id from refresh_tokens where token_hash=?)",
          hash(refresh));
    if (actor != null) {
      db.context(actor.id(), null, actor.impersonatedBy());
      db.update("update auth_sessions set revoked=true where id=?", actor.sessionId());
      db.audit(actor.id(), null, "LOGOUT", actor.id());
    }
  }

  @Transactional
  public void changePassword(Actor actor, String oldPassword, String newPassword) {
    PasswordPolicy.validate(newPassword);
    var a = db.one("select * from accounts where id=? for update", actor.id());
    if (!passwords.matches(oldPassword, (String) a.get("password_hash"))) throw denied();
    if (passwords.matches(newPassword, (String) a.get("password_hash")))
      throw new ApiException(400, "Choose a different password");
    db.context(actor.id(), null, actor.impersonatedBy());
    db.update(
        "update accounts set password_hash=?,must_change_password=false,temporary_password_expires_at=null where id=?",
        passwords.encode(newPassword),
        actor.id());
    db.update("update auth_sessions set revoked=true where account_id=?", actor.id());
    db.audit(actor.id(), null, "PASSWORD_CHANGED", actor.id());
  }

  @Transactional(readOnly = true)
  public Map<String, Object> me(Actor actor) {
    db.context(actor.id(), null, actor.impersonatedBy());
    var result =
        new LinkedHashMap<>(
            db.one(
                "select id,email,display_name,platform_admin,must_change_password from accounts where id=?",
                actor.id()));
    result.put(
        "memberships",
        db.rows(
            "select m.organization_id,o.name,m.owner,m.status from memberships m join organizations o on o.id=m.organization_id where m.account_id=? and m.status in ('ACTIVE','PENDING') and o.active order by o.name",
            actor.id()));
    return result;
  }
}
