package com.buildease.mail;

import static org.assertj.core.api.Assertions.*;

import com.buildease.auth.Actor;
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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

@SpringBootTest
class MailSettingsIT {
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
    r.add("spring.mail.host", () -> "");
  }

  @Autowired Store db;
  @Autowired MailSettingsService settings;
  @Autowired PasswordEncoder passwords;

  Actor admin;
  Actor nonAdmin;
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
  void nonAdminIsForbidden() {
    assertThatThrownBy(() -> settings.current(nonAdmin))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
    assertThatThrownBy(
            () -> settings.update(nonAdmin, "smtp.test", 587, "u", "p", "from@test.example", true))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }

  @Test
  void currentNeverReturnsTheStoredPassword() {
    settings.update(admin, "smtp.test", 587, "user", "secret", "from@test.example", true);
    assertThat(settings.current(admin)).doesNotContainKey("smtp_password");
  }

  @Test
  void updatingWithABlankPasswordKeepsTheExistingOne() {
    settings.update(admin, "smtp.test", 587, "user", "secret", "from@test.example", true);
    settings.update(admin, "smtp.test", 2525, "user", "", "from@test.example", false);
    var stored = db.one("select smtp_password,port,starttls from mail_settings where id=true");
    assertThat(stored)
        .containsEntry("smtp_password", "secret")
        .containsEntry("port", 2525)
        .containsEntry("starttls", false);
  }

  @Test
  void sendingAgainstAnUnreachableHostFailsWithAServiceUnavailableError() {
    settings.update(admin, "smtp.invalid.example.test", 587, null, null, "from@test.example", true);
    assertThatThrownBy(() -> settings.sendTest(admin, "someone@example.test"))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(503));
  }

  @Test
  void sendingWithNoHostConfiguredFailsClearly() {
    assertThatThrownBy(() -> settings.send("someone@example.test", "Subject", "Body"))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(503));
  }
}
