package com.buildease.onboarding;

import com.buildease.auth.AuthService;
import com.buildease.common.*;
import com.buildease.security.PasswordPolicy;
import java.security.SecureRandom;
import java.time.*;
import java.util.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OnboardingService {
  private final Store db;
  private final PasswordEncoder passwords;
  private final IdentityMail mail;
  private final SecureRandom random = new SecureRandom();

  public OnboardingService(Store db, PasswordEncoder passwords, IdentityMail mail) {
    this.db = db;
    this.passwords = passwords;
    this.mail = mail;
  }

  @Transactional
  public void register(String email, String displayName, String organizationName, String password) {
    String normalized = AuthService.email(email);
    PasswordPolicy.validate(password);
    if (db.find("select 1 from accounts where email=?", normalized).isPresent())
      throw new ApiException(409, "An account already exists for this email");
    long attempts =
        ((Number)
                db.one(
                        "select count(*) n from registration_requests where email=? and created_at>now()-interval '1 hour'",
                        normalized)
                    .get("n"))
            .longValue();
    if (attempts >= 3)
      throw new ApiException(429, "Too many registration attempts. Try again later.");
    String token = opaque();
    db.update(
        "update registration_requests set consumed_at=now() where email=? and consumed_at is null",
        normalized);
    db.update(
        "insert into registration_requests(id,token_hash,email,display_name,organization_name,password_hash,expires_at) values (?,?,?,?,?,?,?)",
        UUID.randomUUID(),
        AuthService.hash(token),
        normalized,
        displayName.trim(),
        organizationName.trim(),
        passwords.encode(password),
        java.sql.Timestamp.from(Instant.now().plus(Duration.ofMinutes(30))));
    mail.verification(normalized, token);
  }

  @Transactional
  public UUID verify(String token) {
    var request =
        db.find(
                "select * from registration_requests where token_hash=? and consumed_at is null and expires_at>now() for update",
                AuthService.hash(token))
            .orElseThrow(() -> new ApiException(400, "Verification link is invalid or expired"));
    String email = (String) request.get("email");
    if (db.find("select 1 from accounts where email=?", email).isPresent())
      throw new ApiException(409, "Account already exists");
    UUID account = UUID.randomUUID();
    UUID organization = UUID.randomUUID();
    db.update(
        "insert into accounts(id,email,display_name,password_hash,must_change_password) values (?,?,?,?,false)",
        account,
        email,
        request.get("display_name"),
        request.get("password_hash"));
    db.context(account, organization);
    db.update(
        "insert into organizations(id,name) values (?,?)",
        organization,
        request.get("organization_name"));
    db.update(
        "insert into memberships(organization_id,account_id,owner,status) values (?,?,true,'ACTIVE')",
        organization,
        account);
    db.update("update registration_requests set consumed_at=now() where id=?", request.get("id"));
    db.audit(account, organization, "OWNER_SELF_REGISTERED", organization);
    return organization;
  }

  @Transactional
  public void requestReset(String email) {
    String normalized = AuthService.email(email);
    var account = db.find("select id from accounts where email=? and active", normalized);
    if (account.isEmpty()) return;
    UUID id = Store.id(account.get(), "id");
    if (db.find(
            "select 1 from password_reset_requests where account_id=? and consumed_at is null and created_at>now()-interval '5 minutes'",
            id)
        .isPresent()) return;
    String token = opaque();
    db.update(
        "insert into password_reset_requests(id,token_hash,account_id,expires_at) values (?,?,?,?)",
        UUID.randomUUID(),
        AuthService.hash(token),
        id,
        java.sql.Timestamp.from(Instant.now().plus(Duration.ofMinutes(30))));
    mail.passwordReset(normalized, token);
  }

  @Transactional
  public void reset(String token, String password) {
    PasswordPolicy.validate(password);
    var request =
        db.find(
                "select * from password_reset_requests where token_hash=? and consumed_at is null and expires_at>now() for update",
                AuthService.hash(token))
            .orElseThrow(() -> new ApiException(400, "Reset link is invalid or expired"));
    UUID account = Store.id(request, "account_id");
    db.update(
        "update accounts set password_hash=?,must_change_password=false,temporary_password_expires_at=null where id=?",
        passwords.encode(password),
        account);
    db.update("update auth_sessions set revoked=true where account_id=?", account);
    db.update(
        "update password_reset_requests set consumed_at=now() where account_id=? and consumed_at is null",
        account);
  }

  private String opaque() {
    byte[] bytes = new byte[32];
    random.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }
}
