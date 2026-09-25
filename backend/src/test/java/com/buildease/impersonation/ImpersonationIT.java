package com.buildease.impersonation;

import static org.assertj.core.api.Assertions.*;

import com.buildease.auth.Actor;
import com.buildease.auth.AuthService;
import com.buildease.common.ApiException;
import com.buildease.common.Store;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;

@SpringBootTest
class ImpersonationIT {
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>(
          System.getenv().getOrDefault("TEST_POSTGRES_IMAGE", "postgres:17-alpine"));
  static final String RUNTIME_PASSWORD = UUID.randomUUID().toString();

  static {
    POSTGRES.start();
    var admin =
        new JdbcTemplate(
            new DriverManagerDataSource(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
    admin.execute(
        "create role buildease_runtime login password '"
            + RUNTIME_PASSWORD
            + "' nosuperuser nobypassrls");
  }

  @DynamicPropertySource
  static void database(DynamicPropertyRegistry r) {
    r.add("spring.datasource.hikari.maximum-pool-size", () -> 1);
    r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    r.add("spring.datasource.username", () -> "buildease_runtime");
    r.add("spring.datasource.password", () -> RUNTIME_PASSWORD);
    r.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    r.add("spring.flyway.user", POSTGRES::getUsername);
    r.add("spring.flyway.password", POSTGRES::getPassword);
    r.add("spring.flyway.placeholders.runtimeRole", () -> "buildease_runtime");
    r.add("app.jwt-secret", () -> Base64.getEncoder().encodeToString(new byte[32]));
    r.add("app.secure-cookies", () -> false);
  }

  @Autowired Store db;
  @Autowired AuthService auth;
  @Autowired ImpersonationService impersonation;
  @Autowired JwtDecoder decoder;
  @Autowired PasswordEncoder passwords;
  @Autowired TransactionTemplate transactions;

  Actor admin;
  UUID targetId;
  final String password = "A safe temporary password!";

  @BeforeEach
  void fixture() {
    UUID adminId = UUID.randomUUID();
    db.update(
        "insert into accounts(id,email,display_name,password_hash,platform_admin,must_change_password) values (?,?,?,?,true,false)",
        adminId,
        adminId + "@example.test",
        "Admin",
        passwords.encode(password));
    admin = new Actor(adminId, UUID.randomUUID(), true, false);

    targetId = UUID.randomUUID();
    db.update(
        "insert into accounts(id,email,display_name,password_hash,platform_admin,must_change_password) values (?,?,?,?,false,false)",
        targetId,
        targetId + "@example.test",
        "Target User",
        passwords.encode(password));
  }

  @Test
  void nonAdminCannotStartImpersonation() {
    Actor plain = new Actor(targetId, UUID.randomUUID(), false, false);
    assertThatThrownBy(() -> impersonation.start(plain, admin.id()))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }

  @Test
  void cannotTargetYourOwnAccount() {
    assertThatThrownBy(() -> impersonation.start(admin, admin.id()))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(400));
  }

  @Test
  void cannotImpersonateWhileAlreadyImpersonating() {
    var tokens = impersonation.start(admin, targetId);
    Actor impersonated = auth.authenticate(decoder.decode((String) tokens.get("accessToken")));
    assertThatThrownBy(() -> impersonation.start(impersonated, admin.id()))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }

  @Test
  void cannotTargetAnInactiveAccount() {
    db.update("update accounts set active=false where id=?", targetId);
    assertThatThrownBy(() -> impersonation.start(admin, targetId))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(404));
  }

  @Test
  void canImpersonateAnAccountWithAPendingOrExpiredTemporaryPassword() {
    db.update(
        "update accounts set must_change_password=true,temporary_password_expires_at=now()-interval '1 hour' where id=?",
        targetId);
    var tokens = impersonation.start(admin, targetId);
    Actor impersonated = auth.authenticate(decoder.decode((String) tokens.get("accessToken")));
    assertThat(impersonated.id()).isEqualTo(targetId);
    assertThat(impersonated.impersonatedBy()).isEqualTo(admin.id());
  }

  @Test
  void issuedTokenResolvesToTheTargetWithImpersonatedByTheAdmin() {
    var tokens = impersonation.start(admin, targetId);
    Actor impersonated = auth.authenticate(decoder.decode((String) tokens.get("accessToken")));
    assertThat(impersonated.id()).isEqualTo(targetId);
    assertThat(impersonated.impersonatedBy()).isEqualTo(admin.id());
  }

  @Test
  void actionsPerformedWhileImpersonatingAreAuditedUnderBothIdentities() {
    var tokens = impersonation.start(admin, targetId);
    Actor impersonated = auth.authenticate(decoder.decode((String) tokens.get("accessToken")));
    // set_config(...,true) is transaction-local: context() and the operation relying on it must
    // share one transaction, or the config reverts the instant the setting call's own implicit
    // transaction commits.
    transactions.executeWithoutResult(
        status -> {
          db.context(impersonated.id(), null, impersonated.impersonatedBy());
          db.audit(impersonated.id(), null, "TEST_ACTION", impersonated.id());
        });
    var row =
        transactions.execute(
            status -> {
              db.context(admin.id(), null, null);
              return db.one(
                  "select actor_id,impersonated_by from audit_events where action='TEST_ACTION'");
            });
    assertThat(row)
        .containsEntry("actor_id", targetId)
        .containsEntry("impersonated_by", admin.id());
  }

  @Test
  void refreshRotatesTheTokenAndRejectsReuse() {
    var tokens = impersonation.start(admin, targetId);
    var refreshed = impersonation.refresh((String) tokens.get("refreshToken"));
    // Compare the opaque refresh token, not the JWT access token: both tokens carry
    // second-granularity iat/exp claims, so two issued within the same wall-clock second
    // (routine on fast CI) would be byte-identical and make that comparison flaky.
    assertThat(refreshed.get("refreshToken")).isNotEqualTo(tokens.get("refreshToken"));

    assertThatThrownBy(() -> impersonation.refresh((String) tokens.get("refreshToken")))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(401));
    // Reuse of a used token kills the session outright, so even the freshly rotated token is dead.
    assertThatThrownBy(() -> impersonation.refresh((String) refreshed.get("refreshToken")))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(401));
  }

  @Test
  void endInvalidatesTheStillUnexpiredAccessTokenImmediately() {
    var tokens = impersonation.start(admin, targetId);
    Actor impersonated = auth.authenticate(decoder.decode((String) tokens.get("accessToken")));
    impersonation.end(impersonated);

    var stillDecoded = decoder.decode((String) tokens.get("accessToken"));
    assertThatThrownBy(() -> auth.authenticate(stillDecoded))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(401));
  }

  @Test
  void deactivatingTheAdminMidImpersonationInvalidatesTheSessionOnTheNextRequest() {
    var tokens = impersonation.start(admin, targetId);
    var decoded = decoder.decode((String) tokens.get("accessToken"));
    assertThat(auth.authenticate(decoded)).isNotNull();

    db.update("update accounts set platform_admin=false where id=?", admin.id());

    assertThatThrownBy(() -> auth.authenticate(decoded))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(401));
  }
}
