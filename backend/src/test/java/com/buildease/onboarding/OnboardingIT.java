package com.buildease.onboarding;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.buildease.auth.AuthService;
import com.buildease.common.ApiException;
import com.buildease.common.Store;
import com.buildease.tenancy.TenantService;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;

@SpringBootTest
class OnboardingIT {
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

  @Autowired OnboardingService onboarding;
  @Autowired Store db;
  @Autowired AuthService auth;
  @Autowired TenantService tenants;
  @Autowired JwtDecoder decoder;
  @MockitoBean IdentityMail mail;

  final String password = "A safe temporary password!";

  @BeforeEach
  void resetMock() {
    reset(mail);
  }

  private com.buildease.auth.Actor actor(String email, String password) {
    var tokens = auth.login(email, password, "onboarding-" + email);
    return auth.authenticate(decoder.decode(tokens.accessToken()));
  }

  @Test
  void registrationVerificationCreatesOwnerOrganizationAndConsumesToken() {
    String email = "owner-" + UUID.randomUUID() + "@example.test";
    onboarding.register(email, "New Owner", "New Org", password);

    ArgumentCaptor<String> token = ArgumentCaptor.forClass(String.class);
    verify(mail).verification(eq(email), token.capture());

    UUID organization = onboarding.verify(token.getValue());

    assertThat(db.find("select id from accounts where email=?", email)).isPresent();
    var owner = actor(email, password);
    var members = tenants.members(owner, organization, null, 0);
    assertThat(members).hasSize(1);
    assertThat(members.getFirst())
        .containsEntry("email", email)
        .containsEntry("owner", true)
        .containsEntry("status", "ACTIVE");

    assertThatThrownBy(() -> onboarding.verify(token.getValue()))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(400));
  }

  @Test
  void registrationRejectsAnEmailThatAlreadyHasAnAccount() {
    String email = "owner-" + UUID.randomUUID() + "@example.test";
    onboarding.register(email, "New Owner", "New Org", password);
    ArgumentCaptor<String> token = ArgumentCaptor.forClass(String.class);
    verify(mail).verification(eq(email), token.capture());
    onboarding.verify(token.getValue());

    assertThatThrownBy(() -> onboarding.register(email, "Again", "Another Org", password))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
  }

  @Test
  void registrationIsRateLimitedPerEmailPerHour() {
    String email = "owner-" + UUID.randomUUID() + "@example.test";
    onboarding.register(email, "New Owner", "New Org", password);
    onboarding.register(email, "New Owner", "New Org", password);
    onboarding.register(email, "New Owner", "New Org", password);

    assertThatThrownBy(() -> onboarding.register(email, "New Owner", "New Org", password))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(429));
    verify(mail, times(3)).verification(eq(email), anyString());
  }

  @Test
  void verifyRejectsAnInvalidOrExpiredToken() {
    assertThatThrownBy(() -> onboarding.verify("not-a-real-token"))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(400));
  }

  @Test
  void passwordResetUpdatesPasswordAndRevokesExistingSessions() {
    String email = "owner-" + UUID.randomUUID() + "@example.test";
    onboarding.register(email, "New Owner", "New Org", password);
    ArgumentCaptor<String> registerToken = ArgumentCaptor.forClass(String.class);
    verify(mail).verification(eq(email), registerToken.capture());
    UUID organization = onboarding.verify(registerToken.getValue());
    UUID account = Store.id(db.one("select id from accounts where email=?", email), "id");

    auth.login(email, password, "onboarding-it");
    assertThat(db.rows("select revoked from auth_sessions where account_id=?", account))
        .hasSize(1)
        .allSatisfy(row -> assertThat(row).containsEntry("revoked", false));

    onboarding.requestReset(email);
    ArgumentCaptor<String> resetToken = ArgumentCaptor.forClass(String.class);
    verify(mail).passwordReset(eq(email), resetToken.capture());

    String newPassword = "A brand new safe password!";
    onboarding.reset(resetToken.getValue(), newPassword);

    assertThat(db.rows("select revoked from auth_sessions where account_id=?", account))
        .allSatisfy(row -> assertThat(row).containsEntry("revoked", true));
    assertThatThrownBy(() -> auth.login(email, password, "onboarding-it"))
        .isInstanceOf(ApiException.class);
    assertThat(auth.login(email, newPassword, "onboarding-it").accessToken()).isNotBlank();

    assertThatThrownBy(() -> onboarding.reset(resetToken.getValue(), newPassword))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(400));
    assertThat(organization).isNotNull();
  }

  @Test
  void resetRequestForUnknownEmailIsSilentlyIgnored() {
    onboarding.requestReset("no-such-account-" + UUID.randomUUID() + "@example.test");
    verifyNoInteractions(mail);
  }

  @Test
  void resetRequestIsCooledDownForFiveMinutesPerAccount() {
    String email = "owner-" + UUID.randomUUID() + "@example.test";
    onboarding.register(email, "New Owner", "New Org", password);
    ArgumentCaptor<String> registerToken = ArgumentCaptor.forClass(String.class);
    verify(mail).verification(eq(email), registerToken.capture());
    onboarding.verify(registerToken.getValue());

    onboarding.requestReset(email);
    onboarding.requestReset(email);

    verify(mail, times(1)).passwordReset(eq(email), anyString());
  }

  @Test
  void resetRejectsAnInvalidOrExpiredToken() {
    assertThatThrownBy(() -> onboarding.reset("not-a-real-token", password))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(400));
  }
}
