package com.buildease.notification;

import static org.assertj.core.api.Assertions.*;

import com.buildease.auth.Actor;
import com.buildease.building.*;
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
class AnnouncementIT {
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
  @Autowired com.buildease.occupancy.OccupancyService occupancy;
  @Autowired AnnouncementService announcements;
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
    var tokens = auth.login(email, password, "announcements-" + email);
    db.update("update accounts set must_change_password=false where email=?", email);
    return auth.authenticate(decoder.decode(tokens.accessToken()));
  }

  private record Setup(UUID organization, UUID building, Actor owner) {}

  private Setup organizationWithBuilding() {
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

  private Actor inviteResident(Setup s, String email) {
    UUID space =
        buildings.createSpace(
            s.owner(),
            s.organization(),
            s.building(),
            null,
            null,
            "Flat " + UUID.randomUUID(),
            "F" + email.hashCode(),
            SpaceType.FLAT,
            true,
            null,
            4,
            null);
    UUID account =
        (UUID)
            tenants
                .invite(
                    s.owner(),
                    s.organization(),
                    email,
                    "Resident",
                    password,
                    false,
                    s.building(),
                    Set.of(Role.TENANT))
                .get("id");
    occupancy.createResident(s.owner(), s.organization(), s.building(), account, "Resident", null);
    return actor(email);
  }

  @Test
  void sendingToAllResidentsFansOutToEachResidentsInbox() {
    Setup s = organizationWithBuilding();
    String residentEmail = "resident-" + UUID.randomUUID() + "@example.test";
    Actor resident = inviteResident(s, residentEmail);

    UUID announcementId =
        announcements.send(
            s.owner(),
            s.organization(),
            s.building(),
            "Water shutoff",
            "Water will be off from 10am to noon.",
            Audience.ALL_RESIDENTS);

    var inbox = notifications.inbox(resident, false, 0);
    assertThat(inbox).hasSize(1);
    assertThat(inbox.getFirst()).containsEntry("title", "Water shutoff");
    assertThat(inbox.getFirst().get("target_path")).isEqualTo("/announcements/" + announcementId);

    var history = announcements.history(s.owner(), s.organization(), s.building(), 0);
    assertThat(history).hasSize(1);
    assertThat(history.getFirst()).containsEntry("recipient_count", 1);
  }

  @Test
  void sendingToAllStaffReachesTheOwnerButNotTenants() {
    Setup s = organizationWithBuilding();
    String residentEmail = "resident-" + UUID.randomUUID() + "@example.test";
    Actor resident = inviteResident(s, residentEmail);

    announcements.send(
        s.owner(),
        s.organization(),
        s.building(),
        "Ops update",
        "Team sync at 3pm.",
        Audience.ALL_STAFF);

    assertThat(notifications.inbox(resident, false, 0)).isEmpty();
    assertThat(notifications.inbox(s.owner(), false, 0)).hasSize(1);
  }

  @Test
  void onlyAManagerCanSendOrViewHistoryButAnyMemberCanReadDetail() {
    Setup s = organizationWithBuilding();
    String residentEmail = "resident-" + UUID.randomUUID() + "@example.test";
    Actor resident = inviteResident(s, residentEmail);

    assertThatThrownBy(
            () ->
                announcements.send(
                    resident,
                    s.organization(),
                    s.building(),
                    "Title",
                    "Body",
                    Audience.ALL_RESIDENTS))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
    assertThatThrownBy(() -> announcements.history(resident, s.organization(), s.building(), 0))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));

    UUID announcementId =
        announcements.send(
            s.owner(),
            s.organization(),
            s.building(),
            "Title",
            "Body text",
            Audience.ALL_RESIDENTS);
    var detail = announcements.detail(resident, s.organization(), s.building(), announcementId);
    assertThat(detail).containsEntry("body", "Body text");
  }
}
