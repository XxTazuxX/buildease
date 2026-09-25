package com.buildease.integrations;

import static org.assertj.core.api.Assertions.*;

import com.buildease.auth.Actor;
import com.buildease.common.ApiException;
import com.buildease.common.Store;
import com.buildease.security.Role;
import com.buildease.tenancy.TenantService;
import java.util.Base64;
import java.util.Set;
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
import org.testcontainers.containers.PostgreSQLContainer;

@SpringBootTest
class ApiKeyIT {
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
  @Autowired TenantService tenants;
  @Autowired ApiKeyService keys;
  @Autowired PasswordEncoder passwords;
  @Autowired JwtDecoder decoder;
  @Autowired com.buildease.auth.AuthService auth;

  Actor admin;
  final String password = "A safe temporary password!";

  @BeforeEach
  void fixture() {
    UUID id = UUID.randomUUID();
    db.update(
        "insert into accounts(id,email,display_name,password_hash,platform_admin,must_change_password) values (?,?,?,?,true,false)",
        id,
        id + "@example.test",
        "Admin",
        passwords.encode(password));
    admin = new Actor(id, UUID.randomUUID(), true, false);
  }

  Actor actor(String email) {
    var tokens = auth.login(email, password, "apikey-" + email);
    db.update("update accounts set must_change_password=false where email=?", email);
    return auth.authenticate(decoder.decode(tokens.accessToken()));
  }

  private record Setup(UUID organization, UUID building, Actor owner) {}

  private Setup organization() {
    String ownerEmail = "owner-" + UUID.randomUUID() + "@example.test";
    UUID org =
        (UUID)
            tenants
                .createOrganization(admin, "Operations", ownerEmail, "Owner", password)
                .get("id");
    Actor owner = actor(ownerEmail);
    UUID building = (UUID) tenants.createBuilding(owner, org, "Harbor", "HARBOR").get("id");
    return new Setup(org, building, owner);
  }

  @Test
  void ownerCreatesAKeyThatResolvesBackToTheirOrganizationAndAccount() {
    Setup s = organization();
    var created = keys.create(s.owner(), s.organization(), "Accounting sync");
    String key = (String) created.get("key");

    var resolved = keys.resolve(key);
    assertThat(resolved.organization()).isEqualTo(s.organization());
    assertThat(resolved.actingAccount()).isEqualTo(s.owner().id());

    var listed = keys.list(s.owner(), s.organization());
    assertThat(listed).hasSize(1);
    assertThat(listed.getFirst()).containsEntry("name", "Accounting sync");
    assertThat(listed.getFirst()).doesNotContainKey("key_hash").doesNotContainKey("key");
  }

  @Test
  void revokedKeysNoLongerResolveAndInvalidKeysAreRejected() {
    Setup s = organization();
    var created = keys.create(s.owner(), s.organization(), "Accounting sync");
    UUID keyId = (UUID) created.get("id");
    String key = (String) created.get("key");

    keys.revoke(s.owner(), s.organization(), keyId);

    assertThatThrownBy(() -> keys.resolve(key))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(401));
    assertThatThrownBy(() -> keys.resolve("not-a-real-key"))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(401));
  }

  @Test
  void nonOwnerManagerCannotCreateListOrRevokeApiKeys() {
    Setup s = organization();
    String managerEmail = "manager-" + UUID.randomUUID() + "@example.test";
    tenants.invite(
        s.owner(),
        s.organization(),
        managerEmail,
        "Manager",
        password,
        false,
        s.building(),
        Set.of(Role.PROPERTY_MANAGER));
    Actor manager = actor(managerEmail);

    assertThatThrownBy(() -> keys.create(manager, s.organization(), "Sneaky key"))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
    assertThatThrownBy(() -> keys.list(manager, s.organization()))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }
}
