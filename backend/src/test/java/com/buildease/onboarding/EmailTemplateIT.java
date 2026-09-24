package com.buildease.onboarding;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.buildease.auth.Actor;
import com.buildease.common.ApiException;
import com.buildease.common.Store;
import com.buildease.mail.MailSettingsService;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;

@SpringBootTest
class EmailTemplateIT {
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
  @Autowired EmailTemplateService templates;
  @Autowired IdentityMail mail;
  @Autowired OnboardingService onboarding;
  @Autowired PasswordEncoder passwords;
  @MockitoBean MailSettingsService mailSettings;

  Actor admin;
  Actor nonAdmin;
  final String password = "A safe temporary password!";

  @BeforeEach
  void fixture() {
    reset(mailSettings);
    UUID adminId = UUID.randomUUID();
    db.update(
        "insert into accounts(id,email,display_name,password_hash,platform_admin,must_change_password) values (?,?,?,?,true,false)",
        adminId,
        adminId + "@example.test",
        "Admin",
        passwords.encode(password));
    admin = new Actor(adminId, UUID.randomUUID(), true, false);

    UUID userId = UUID.randomUUID();
    db.update(
        "insert into accounts(id,email,display_name,password_hash,platform_admin,must_change_password) values (?,?,?,?,false,false)",
        userId,
        userId + "@example.test",
        "User",
        passwords.encode(password));
    nonAdmin = new Actor(userId, UUID.randomUUID(), false, false);
  }

  @Test
  void bothKeysAreSeededWithTodaysCopy() {
    var list = templates.list(admin);
    assertThat(list).hasSize(2);
    assertThat(list)
        .anySatisfy(t -> assertThat(t).containsEntry("template_key", "VERIFICATION"))
        .anySatisfy(t -> assertThat(t).containsEntry("template_key", "PASSWORD_RESET"));
  }

  @Test
  void nonAdminIsForbidden() {
    assertThatThrownBy(() -> templates.list(nonAdmin))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }

  @Test
  void updatePersistsAndAuditsSettingsUpdated() {
    templates.update(admin, EmailTemplateKey.VERIFICATION, "New subject", "New body with {{link}}");
    var row = templates.get(admin, EmailTemplateKey.VERIFICATION);
    assertThat(row)
        .containsEntry("subject", "New subject")
        .containsEntry("body", "New body with {{link}}");
    assertThat(
            db.rows(
                "select action from audit_events where target_id=? and action='SETTINGS_UPDATED'",
                admin.id()))
        .hasSize(1);
  }

  @Test
  void registrationSendsTheRenderedTemplateWithARealVerificationLink() {
    String email = "owner-" + UUID.randomUUID() + "@example.test";
    onboarding.register(email, "New Owner", "New Org", password);

    ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
    verify(mailSettings).send(eq(email), subject.capture(), body.capture());
    assertThat(subject.getValue()).isEqualTo("Verify your BuildEase workspace");
    assertThat(body.getValue()).contains("/verify?token=").doesNotContain("{{link}}");
  }
}
