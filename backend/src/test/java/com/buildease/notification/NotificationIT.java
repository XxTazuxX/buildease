package com.buildease.notification;

import static org.assertj.core.api.Assertions.*;

import com.buildease.auth.Actor;
import com.buildease.building.*;
import com.buildease.common.ApiException;
import com.buildease.common.Store;
import com.buildease.maintenance.MaintenanceService;
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
class NotificationIT {
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
  @Autowired BuildingService buildings;
  @Autowired MaintenanceService maintenance;
  @Autowired NotificationService notifications;
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
    var tokens = auth.login(email, password, "notification-" + email);
    db.update("update accounts set must_change_password=false where email=?", email);
    return auth.authenticate(decoder.decode(tokens.accessToken()));
  }

  @Test
  void assigningWorkNotifiesTheAssigneeAndReadMarksItRead() {
    String ownerEmail = "owner-" + UUID.randomUUID() + "@example.test";
    UUID org =
        (UUID)
            tenants
                .createOrganization(admin, "Operations", ownerEmail, "Owner", password)
                .get("id");
    Actor owner = actor(ownerEmail);
    UUID building = (UUID) tenants.createBuilding(owner, org, "Harbor", "HARBOR").get("id");
    UUID space =
        buildings.createSpace(
            owner, org, building, null, null, "Flat 1", "F1", SpaceType.FLAT, true, null, 4, null);
    UUID category = maintenance.createCategory(owner, org, building, "Plumbing", 4, 48);

    String staffEmail = "staff-" + UUID.randomUUID() + "@example.test";
    UUID staffAccount =
        (UUID)
            tenants
                .invite(
                    owner,
                    org,
                    staffEmail,
                    "Staff",
                    password,
                    false,
                    building,
                    Set.of(Role.MAINTENANCE_STAFF))
                .get("id");
    Actor staff = actor(staffEmail);

    UUID request =
        maintenance.submit(
            owner,
            org,
            building,
            space,
            category,
            "Leaking tap",
            "Dripping",
            com.buildease.maintenance.Impact.MEDIUM,
            false);
    maintenance.triage(
        owner, org, building, request, com.buildease.maintenance.Priority.HIGH, "Water damage");
    maintenance.assignStaff(owner, org, building, request, staffAccount, null);

    var inbox = notifications.inbox(staff, false, 0);
    assertThat(inbox).hasSize(1);
    assertThat(inbox.getFirst())
        .containsEntry("type", "WORK_ASSIGNED")
        .containsEntry("target_path", "/maintenance/" + request);
    assertThat(inbox.getFirst().get("read_at")).isNull();

    assertThat(notifications.inbox(staff, true, 0)).hasSize(1);

    UUID notificationId = com.buildease.common.Store.id(inbox.getFirst(), "id");
    notifications.read(staff, notificationId);

    assertThat(notifications.inbox(staff, true, 0)).isEmpty();
    assertThat(notifications.inbox(staff, false, 0).getFirst().get("read_at")).isNotNull();

    assertThatThrownBy(() -> notifications.read(staff, UUID.randomUUID()))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(404));
    assertThatThrownBy(() -> notifications.read(owner, notificationId))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(404));
  }

  @Test
  void pushSubscriptionsAreDedupedByEndpointAndRemovable() {
    String ownerEmail = "owner-" + UUID.randomUUID() + "@example.test";
    tenants.createOrganization(admin, "Operations", ownerEmail, "Owner", password);
    Actor owner = actor(ownerEmail);
    String endpoint = "https://push.example.test/" + UUID.randomUUID();

    UUID subscription = notifications.subscribe(owner, endpoint, "key", "secret", null);
    UUID resubscribed = notifications.subscribe(owner, endpoint, "key2", "secret2", null);
    assertThat(resubscribed).isEqualTo(subscription);

    notifications.unsubscribe(owner, subscription);
    UUID afterRemoval = notifications.subscribe(owner, endpoint, "key3", "secret3", null);
    assertThat(afterRemoval).isNotEqualTo(subscription);
  }
}
