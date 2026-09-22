package com.buildease.automation;

import static org.assertj.core.api.Assertions.*;

import com.buildease.auth.Actor;
import com.buildease.building.*;
import com.buildease.common.Store;
import com.buildease.maintenance.MaintenanceService;
import com.buildease.tenancy.TenantService;
import java.time.LocalDate;
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
class AutomationIT {
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
  @Autowired MaintenanceAutomation automation;
  @Autowired PasswordEncoder passwords;

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

  private record Fixture(UUID organization, UUID building, Actor owner) {}

  private Fixture organizationWithDuePlan(String label, int intervalDays) {
    String ownerEmail = "owner-" + UUID.randomUUID() + "@example.test";
    UUID org =
        (UUID)
            tenants
                .createOrganization(admin, "Operations " + label, ownerEmail, "Owner", password)
                .get("id");
    db.context(admin.id(), org);
    UUID ownerAccount = Store.id(db.one("select id from accounts where email=?", ownerEmail), "id");
    Actor owner = new Actor(ownerAccount, UUID.randomUUID(), false, false);
    UUID building =
        (UUID) tenants.createBuilding(owner, org, "Harbor " + label, "H-" + label).get("id");
    UUID space =
        buildings.createSpace(
            owner, org, building, null, null, "Flat 1", "F1", SpaceType.FLAT, true, null, 4, null);
    UUID category = maintenance.createCategory(owner, org, building, "Plumbing", 4, 48);
    maintenance.createRecurringPlan(
        owner,
        org,
        building,
        space,
        category,
        "Quarterly inspection " + label,
        "Check fixtures",
        intervalDays,
        LocalDate.now());
    return new Fixture(org, building, owner);
  }

  @Test
  void dueRecurringPlanGeneratesRequestAndAdvancesSchedule() {
    Fixture fixture = organizationWithDuePlan("A", 90);

    automation.run();

    var requests =
        maintenance.requests(
            fixture.owner(), fixture.organization(), fixture.building(), null, null, 0);
    assertThat(requests).hasSize(1);
    assertThat(requests.getFirst()).containsEntry("status", "SUBMITTED");

    var plans =
        maintenance.recurringPlans(fixture.owner(), fixture.organization(), fixture.building());
    assertThat(plans).hasSize(1);
    assertThat(((java.sql.Date) plans.getFirst().get("next_run_on")).toLocalDate())
        .isEqualTo(LocalDate.now().plusDays(90));
  }

  @Test
  void reRunningWithinTheSameScheduledMinuteDoesNotDuplicateWork() {
    Fixture fixture = organizationWithDuePlan("B", 30);

    automation.run();
    automation.run();

    var requests =
        maintenance.requests(
            fixture.owner(), fixture.organization(), fixture.building(), null, null, 0);
    assertThat(requests).hasSize(1);
  }

  @Test
  void everyOrganizationWithADuePlanIsProcessedInTheSameRun() {
    Fixture first = organizationWithDuePlan("C1", 30);
    Fixture second = organizationWithDuePlan("C2", 30);

    automation.run();

    assertThat(
            maintenance.requests(
                first.owner(), first.organization(), first.building(), null, null, 0))
        .hasSize(1);
    assertThat(
            maintenance.requests(
                second.owner(), second.organization(), second.building(), null, null, 0))
        .hasSize(1);
  }
}
