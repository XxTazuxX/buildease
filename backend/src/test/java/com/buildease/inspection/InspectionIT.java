package com.buildease.inspection;

import static org.assertj.core.api.Assertions.*;

import com.buildease.auth.Actor;
import com.buildease.building.*;
import com.buildease.common.ApiException;
import com.buildease.common.Store;
import com.buildease.occupancy.OccupancyService;
import com.buildease.security.Role;
import com.buildease.tenancy.TenantService;
import java.time.LocalDate;
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
class InspectionIT {
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
  @Autowired OccupancyService occupancy;
  @Autowired InspectionService inspections;
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
    var tokens = auth.login(email, password, "inspection-" + email);
    db.update("update accounts set must_change_password=false where email=?", email);
    return auth.authenticate(decoder.decode(tokens.accessToken()));
  }

  private record Setup(
      UUID organization,
      UUID building,
      UUID space,
      UUID resident,
      String residentEmail,
      Actor owner) {}

  private Setup organizationWithSpaceAndResident() {
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
    String residentEmail = "resident-" + UUID.randomUUID() + "@example.test";
    UUID residentAccount =
        (UUID)
            tenants
                .invite(
                    owner,
                    org,
                    residentEmail,
                    "Resident",
                    password,
                    false,
                    building,
                    Set.of(Role.TENANT))
                .get("id");
    UUID resident =
        occupancy.createResident(owner, org, building, residentAccount, "Resident", null);
    return new Setup(org, building, space, resident, residentEmail, owner);
  }

  @Test
  void managerSchedulesAddsItemsAndCompletesAMoveInInspection() {
    Setup s = organizationWithSpaceAndResident();
    UUID inspection =
        inspections.create(
            s.owner(),
            s.organization(),
            s.building(),
            s.space(),
            null,
            s.resident(),
            InspectionType.MOVE_IN,
            LocalDate.now());
    inspections.addItem(
        s.owner(), s.organization(), s.building(), inspection, "Kitchen", Condition.GOOD, null);
    inspections.addItem(
        s.owner(),
        s.organization(),
        s.building(),
        inspection,
        "Bathroom",
        Condition.FAIR,
        "Minor scuff on tile");

    inspections.complete(s.owner(), s.organization(), s.building(), inspection, "All good");

    var detail = inspections.detail(s.owner(), s.organization(), s.building(), inspection);
    assertThat(detail).containsEntry("status", "COMPLETED");
    assertThat(detail.get("completed_at")).isNotNull();
    @SuppressWarnings("unchecked")
    var items = (java.util.List<java.util.Map<String, Object>>) detail.get("items");
    assertThat(items).hasSize(2);
  }

  @Test
  void itemsCannotBeAddedAfterTheInspectionIsCompleted() {
    Setup s = organizationWithSpaceAndResident();
    UUID inspection =
        inspections.create(
            s.owner(),
            s.organization(),
            s.building(),
            s.space(),
            null,
            s.resident(),
            InspectionType.ROUTINE,
            LocalDate.now());
    inspections.complete(s.owner(), s.organization(), s.building(), inspection, null);

    assertThatThrownBy(
            () ->
                inspections.addItem(
                    s.owner(),
                    s.organization(),
                    s.building(),
                    inspection,
                    "Kitchen",
                    Condition.GOOD,
                    null))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
  }

  @Test
  void residentCanAcknowledgeTheirOwnCompletedInspectionOnceButNotSomeoneElses() {
    Setup a = organizationWithSpaceAndResident();
    UUID inspection =
        inspections.create(
            a.owner(),
            a.organization(),
            a.building(),
            a.space(),
            null,
            a.resident(),
            InspectionType.MOVE_IN,
            LocalDate.now());
    inspections.complete(a.owner(), a.organization(), a.building(), inspection, null);
    Actor residentA = actor(a.residentEmail());

    UUID secondSpace =
        buildings.createSpace(
            a.owner(),
            a.organization(),
            a.building(),
            null,
            null,
            "Flat 2",
            "F2",
            SpaceType.FLAT,
            true,
            null,
            4,
            null);
    String residentBEmail = "resident-" + UUID.randomUUID() + "@example.test";
    UUID residentBAccount =
        (UUID)
            tenants
                .invite(
                    a.owner(),
                    a.organization(),
                    residentBEmail,
                    "Resident B",
                    password,
                    false,
                    a.building(),
                    Set.of(Role.TENANT))
                .get("id");
    occupancy.createResident(
        a.owner(), a.organization(), a.building(), residentBAccount, "Resident B", null);
    Actor residentB = actor(residentBEmail);

    assertThatThrownBy(
            () -> inspections.acknowledge(residentB, a.organization(), a.building(), inspection))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));

    inspections.acknowledge(residentA, a.organization(), a.building(), inspection);
    var detail = inspections.detail(a.owner(), a.organization(), a.building(), inspection);
    assertThat(detail.get("resident_acknowledged_at")).isNotNull();

    assertThatThrownBy(
            () -> inspections.acknowledge(residentA, a.organization(), a.building(), inspection))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
  }

  @Test
  void nonManagerCannotCreateOrCompleteInspections() {
    Setup s = organizationWithSpaceAndResident();
    Actor tenant = actor(s.residentEmail());

    assertThatThrownBy(
            () ->
                inspections.create(
                    tenant,
                    s.organization(),
                    s.building(),
                    s.space(),
                    null,
                    s.resident(),
                    InspectionType.MOVE_IN,
                    LocalDate.now()))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));

    UUID inspection =
        inspections.create(
            s.owner(),
            s.organization(),
            s.building(),
            s.space(),
            null,
            s.resident(),
            InspectionType.MOVE_IN,
            LocalDate.now());
    assertThatThrownBy(
            () -> inspections.complete(tenant, s.organization(), s.building(), inspection, null))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }

  @Test
  void tenantSeesOnlyTheirOwnInspectionsInTheList() {
    Setup a = organizationWithSpaceAndResident();
    UUID inspectionA =
        inspections.create(
            a.owner(),
            a.organization(),
            a.building(),
            a.space(),
            null,
            a.resident(),
            InspectionType.MOVE_IN,
            LocalDate.now());
    Actor tenantA = actor(a.residentEmail());

    UUID secondSpace =
        buildings.createSpace(
            a.owner(),
            a.organization(),
            a.building(),
            null,
            null,
            "Flat 2",
            "F2",
            SpaceType.FLAT,
            true,
            null,
            4,
            null);
    String residentBEmail = "resident-" + UUID.randomUUID() + "@example.test";
    UUID residentBAccount =
        (UUID)
            tenants
                .invite(
                    a.owner(),
                    a.organization(),
                    residentBEmail,
                    "Resident B",
                    password,
                    false,
                    a.building(),
                    Set.of(Role.TENANT))
                .get("id");
    UUID residentB =
        occupancy.createResident(
            a.owner(), a.organization(), a.building(), residentBAccount, "Resident B", null);
    inspections.create(
        a.owner(),
        a.organization(),
        a.building(),
        secondSpace,
        null,
        residentB,
        InspectionType.MOVE_IN,
        LocalDate.now());

    var ownInspections = inspections.list(tenantA, a.organization(), a.building(), null, 0);
    assertThat(ownInspections).hasSize(1);
    assertThat(ownInspections.getFirst()).containsEntry("id", inspectionA);
  }
}
