package com.buildease.automation;

import static org.assertj.core.api.Assertions.*;

import com.buildease.auth.Actor;
import com.buildease.building.*;
import com.buildease.common.Store;
import com.buildease.leasing.LeaseService;
import com.buildease.occupancy.OccupancyService;
import com.buildease.security.Role;
import com.buildease.tenancy.TenantService;
import java.math.BigDecimal;
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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;

@SpringBootTest
class RentAutomationIT {
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
  @Autowired LeaseService leases;
  @Autowired RentAutomation automation;
  @Autowired PasswordEncoder passwords;
  @Autowired TransactionTemplate transactions;

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

  private record Fixture(UUID organization, UUID building, UUID lease, Actor owner) {}

  private Fixture organizationWithActiveLease(String label, LocalDate startsOn) {
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
    UUID lease =
        leases.createDraft(
            owner,
            org,
            building,
            resident,
            space,
            startsOn,
            null,
            new BigDecimal("1200.00"),
            startsOn,
            null,
            null);
    leases.activate(owner, org, building, lease);
    return new Fixture(org, building, lease, owner);
  }

  @Test
  void dueLeaseGeneratesChargeAndAdvancesNextChargeDate() {
    Fixture f = organizationWithActiveLease("A", LocalDate.now());

    automation.run();

    var detail = leases.lease(f.owner(), f.organization(), f.building(), f.lease());
    @SuppressWarnings("unchecked")
    var charges = (java.util.List<java.util.Map<String, Object>>) detail.get("charges");
    assertThat(charges).hasSize(1);
    assertThat(charges.getFirst()).containsEntry("type", "RENT");
    assertThat(((java.sql.Date) detail.get("next_charge_on")).toLocalDate())
        .isEqualTo(LocalDate.now().plusMonths(1));
  }

  @Test
  void reRunningWithinTheSameScheduledMinuteDoesNotDuplicateCharges() {
    Fixture f = organizationWithActiveLease("B", LocalDate.now());

    automation.run();
    automation.run();

    var detail = leases.lease(f.owner(), f.organization(), f.building(), f.lease());
    @SuppressWarnings("unchecked")
    var charges = (java.util.List<java.util.Map<String, Object>>) detail.get("charges");
    assertThat(charges).hasSize(1);
  }

  @Test
  void chargesStopOnceTheLeaseHasEnded() {
    Fixture f = organizationWithActiveLease("C", LocalDate.now());
    leases.end(
        f.owner(),
        f.organization(),
        f.building(),
        f.lease(),
        LocalDate.now(),
        com.buildease.leasing.LeaseEndReason.TERMINATED);

    automation.run();

    var detail = leases.lease(f.owner(), f.organization(), f.building(), f.lease());
    @SuppressWarnings("unchecked")
    var charges = (java.util.List<java.util.Map<String, Object>>) detail.get("charges");
    assertThat(charges).isEmpty();
  }

  @Test
  void lateFeeIsChargedWhenBuildingConfiguresOneAndGraceDaysHaveElapsed() {
    Fixture f = organizationWithActiveLease("E", LocalDate.now().minusDays(10));
    // set_config(...,true) is transaction-local, so it must be set in the same transaction as
    // this update, or the RLS check sees no org context and the update silently matches 0 rows.
    transactions.executeWithoutResult(
        status -> {
          db.context(f.owner().id(), f.organization(), null);
          db.update(
              "update buildings set late_fee_amount=?,late_fee_grace_days=? where id=?",
              new BigDecimal("50.00"),
              5,
              f.building());
        });

    automation.run();

    var detail = leases.lease(f.owner(), f.organization(), f.building(), f.lease());
    @SuppressWarnings("unchecked")
    var charges = (java.util.List<java.util.Map<String, Object>>) detail.get("charges");
    var lateFees = charges.stream().filter(c -> "LATE_FEE".equals(c.get("type"))).toList();
    assertThat(lateFees).hasSize(1);
    assertThat((BigDecimal) lateFees.getFirst().get("amount")).isEqualByComparingTo("50.00");
  }

  @Test
  void noLateFeeIsChargedWhenTheBuildingHasNotConfiguredOne() {
    Fixture f = organizationWithActiveLease("F", LocalDate.now().minusDays(10));

    automation.run();

    var detail = leases.lease(f.owner(), f.organization(), f.building(), f.lease());
    @SuppressWarnings("unchecked")
    var charges = (java.util.List<java.util.Map<String, Object>>) detail.get("charges");
    assertThat(charges.stream().filter(c -> "LATE_FEE".equals(c.get("type")))).isEmpty();
  }

  @Test
  void everyOrganizationWithADueLeaseIsProcessedInTheSameRun() {
    Fixture first = organizationWithActiveLease("D1", LocalDate.now());
    Fixture second = organizationWithActiveLease("D2", LocalDate.now());

    automation.run();

    @SuppressWarnings("unchecked")
    var firstCharges =
        (java.util.List<java.util.Map<String, Object>>)
            leases
                .lease(first.owner(), first.organization(), first.building(), first.lease())
                .get("charges");
    @SuppressWarnings("unchecked")
    var secondCharges =
        (java.util.List<java.util.Map<String, Object>>)
            leases
                .lease(second.owner(), second.organization(), second.building(), second.lease())
                .get("charges");
    assertThat(firstCharges).hasSize(1);
    assertThat(secondCharges).hasSize(1);
  }
}
