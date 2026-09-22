package com.buildease.maintenance;

import static org.assertj.core.api.Assertions.*;

import com.buildease.auth.Actor;
import com.buildease.building.*;
import com.buildease.common.*;
import com.buildease.occupancy.OccupancyService;
import com.buildease.security.Role;
import com.buildease.tenancy.TenantService;
import java.util.*;
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
class MaintenanceIT {
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
  @Autowired MaintenanceService maintenance;
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
    var tokens = auth.login(email, password, "maintenance-" + email);
    db.update("update accounts set must_change_password=false where email=?", email);
    return auth.authenticate(decoder.decode(tokens.accessToken()));
  }

  @Test
  void assignmentDrivesOccupancyAndResidentCanCompleteTicketLifecycle() {
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
            owner,
            building == null ? null : org,
            building,
            null,
            null,
            "Flat 1",
            "F1",
            SpaceType.FLAT,
            true,
            null,
            4,
            null);
    UUID secondSpace =
        buildings.createSpace(
            owner, org, building, null, null, "Flat 2", "F2", SpaceType.FLAT, true, null, 4, null);

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
    UUID assignment =
        occupancy.assign(owner, org, building, resident, space, java.time.LocalDate.now());
    UUID secondAssignment =
        occupancy.assign(owner, org, building, resident, secondSpace, java.time.LocalDate.now());
    occupancy.updateResident(
        owner, org, building, resident, "Resident Updated", "+1 555 0100", true);

    var residentRows = occupancy.residents(owner, org, building);
    assertThat(residentRows).hasSize(1);
    assertThat(residentRows.getFirst())
        .containsEntry("display_name", "Resident Updated")
        .containsEntry("phone", "+1 555 0100");
    assertThat((List<?>) residentRows.getFirst().get("assignments")).hasSize(2);

    assertThat(
            buildings.spaces(owner, org, building).stream()
                .filter(row -> space.equals(row.get("id")))
                .findFirst()
                .orElseThrow())
        .containsEntry("status", "OCCUPIED");
    assertThatThrownBy(
            () ->
                occupancy.assign(owner, org, building, resident, space, java.time.LocalDate.now()))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));

    Actor tenant = actor(residentEmail);
    UUID category = maintenance.createCategory(owner, org, building, "Plumbing", 4, 48);
    UUID request =
        maintenance.submit(
            tenant,
            org,
            building,
            space,
            category,
            "Leaking tap",
            "Water is dripping",
            Impact.MEDIUM,
            false);
    assertThat(maintenance.requests(tenant, org, building, null, null, 0)).hasSize(1);
    maintenance.triage(owner, org, building, request, Priority.HIGH, "Prevent water damage");
    UUID work = maintenance.assignStaff(owner, org, building, request, owner.id(), null);
    maintenance.addWorkLog(owner, org, building, work, "Inspected fixture", 20);
    maintenance.updateWorkCosts(
        owner,
        org,
        building,
        work,
        new java.math.BigDecimal("25.00"),
        new java.math.BigDecimal("18.50"));
    assertThatThrownBy(() -> maintenance.addWorkLog(tenant, org, building, work, "Not assigned", 5))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
    assertThat((List<?>) maintenance.request(owner, org, building, request).get("work_logs"))
        .hasSize(1);
    maintenance.start(owner, org, building, request);
    maintenance.resolve(owner, org, building, request, "Washer replaced");
    maintenance.close(tenant, org, building, request, ResolutionOutcome.CONFIRMED);
    assertThat(maintenance.request(tenant, org, building, request))
        .containsEntry("status", "CLOSED");

    occupancy.end(owner, org, building, assignment, java.time.LocalDate.now());
    occupancy.end(owner, org, building, secondAssignment, java.time.LocalDate.now());
    assertThat(
            buildings.spaces(owner, org, building).stream()
                .filter(row -> space.equals(row.get("id")))
                .findFirst()
                .orElseThrow())
        .containsEntry("status", "VACANT");
    assertThatThrownBy(
            () ->
                maintenance.submit(
                    tenant,
                    org,
                    building,
                    space,
                    category,
                    "Again",
                    "No assignment",
                    Impact.LOW,
                    false))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }
}
