package com.buildease.reporting;

import static org.assertj.core.api.Assertions.*;

import com.buildease.auth.Actor;
import com.buildease.building.*;
import com.buildease.common.ApiException;
import com.buildease.common.Store;
import com.buildease.leasing.LeaseService;
import com.buildease.maintenance.Impact;
import com.buildease.maintenance.MaintenanceService;
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
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;

@SpringBootTest
class ReportingIT {
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
  @Autowired MaintenanceService maintenance;
  @Autowired TransactionTemplate transactions;
  @Autowired ReportingService reporting;
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
    var tokens = auth.login(email, password, "reporting-" + email);
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

  private Setup organizationWithRentableSpaceAndResident() {
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

  private UUID activeLease(Setup s, LocalDate startsOn) {
    UUID lease =
        leases.createDraft(
            s.owner(),
            s.organization(),
            s.building(),
            s.resident(),
            s.space(),
            startsOn,
            null,
            new BigDecimal("1200.00"),
            startsOn,
            new BigDecimal("1200.00"),
            startsOn);
    leases.activate(s.owner(), s.organization(), s.building(), lease);
    return lease;
  }

  private void charge(Setup s, UUID lease, BigDecimal amount, LocalDate dueOn) {
    // set_config(...,true) is transaction-local, so the context set by activeLease()'s own
    // (already-committed) transaction is gone by the time a bare db.update() runs here; both
    // calls must share one transaction for the RLS check on this insert to see the right actor/org.
    transactions.executeWithoutResult(
        status -> {
          db.context(s.owner().id(), s.organization(), null);
          db.update(
              "insert into charges(id,organization_id,building_id,lease_id,type,amount,currency,due_on) values (?,?,?,?,'RENT',?,'USD',?)",
              UUID.randomUUID(),
              s.organization(),
              s.building(),
              lease,
              amount,
              dueOn);
        });
  }

  @Test
  void rentRollListsActiveLeasesWithNamesBalanceAndDepositStatus() {
    Setup s = organizationWithRentableSpaceAndResident();
    LocalDate startsOn = LocalDate.now().minusMonths(1);
    UUID lease = activeLease(s, startsOn);
    charge(s, lease, new BigDecimal("1200.00"), startsOn);
    charge(s, lease, new BigDecimal("1200.00"), startsOn.plusMonths(1));
    leases.recordPayment(
        s.owner(),
        s.organization(),
        s.building(),
        lease,
        new BigDecimal("1200.00"),
        com.buildease.leasing.PaymentMethod.BANK_TRANSFER,
        null,
        startsOn,
        null);

    var rows = reporting.rentRoll(s.owner(), s.organization(), s.building());
    assertThat(rows).hasSize(1);
    var row = rows.getFirst();
    assertThat(row.get("resident_name")).isEqualTo("Resident");
    assertThat(row.get("space_name")).isEqualTo("Flat 1");
    assertThat((BigDecimal) row.get("charged")).isEqualByComparingTo("2400.00");
    assertThat((BigDecimal) row.get("paid")).isEqualByComparingTo("1200.00");
    assertThat((BigDecimal) row.get("balance")).isEqualByComparingTo("1200.00");
    assertThat(row.get("deposit_status")).isEqualTo("HELD");
  }

  @Test
  void incomeStatementSeparatesPeriodTotalsFromOutstandingToDate() {
    Setup s = organizationWithRentableSpaceAndResident();
    LocalDate twoMonthsAgo = LocalDate.now().minusMonths(2);
    LocalDate lastMonth = LocalDate.now().minusMonths(1);
    UUID lease = activeLease(s, twoMonthsAgo);
    charge(s, lease, new BigDecimal("1200.00"), twoMonthsAgo);
    charge(s, lease, new BigDecimal("1200.00"), lastMonth);
    leases.recordPayment(
        s.owner(),
        s.organization(),
        s.building(),
        lease,
        new BigDecimal("1200.00"),
        com.buildease.leasing.PaymentMethod.BANK_TRANSFER,
        null,
        twoMonthsAgo,
        null);

    var statement =
        reporting.incomeStatement(
            s.owner(), s.organization(), s.building(), lastMonth, LocalDate.now());
    assertThat((BigDecimal) statement.get("totalCharged")).isEqualByComparingTo("1200.00");
    assertThat((BigDecimal) statement.get("totalCollected")).isEqualByComparingTo("0.00");
    assertThat((BigDecimal) statement.get("outstandingBalance")).isEqualByComparingTo("1200.00");
  }

  @Test
  void leaseStatementComputesOpeningAndRunningBalanceAndTenantCanViewTheirOwn() {
    Setup s = organizationWithRentableSpaceAndResident();
    LocalDate twoMonthsAgo = LocalDate.now().minusMonths(2);
    LocalDate lastMonth = LocalDate.now().minusMonths(1);
    UUID lease = activeLease(s, twoMonthsAgo);
    charge(s, lease, new BigDecimal("1200.00"), twoMonthsAgo);
    charge(s, lease, new BigDecimal("1200.00"), lastMonth);
    leases.recordPayment(
        s.owner(),
        s.organization(),
        s.building(),
        lease,
        new BigDecimal("1200.00"),
        com.buildease.leasing.PaymentMethod.BANK_TRANSFER,
        null,
        twoMonthsAgo,
        null);

    var statement =
        reporting.leaseStatement(
            s.owner(), s.organization(), s.building(), lease, lastMonth, LocalDate.now());
    assertThat((BigDecimal) statement.get("openingBalance")).isEqualByComparingTo("0.00");
    @SuppressWarnings("unchecked")
    var lines = (java.util.List<java.util.Map<String, Object>>) statement.get("lines");
    assertThat(lines).hasSize(1);
    assertThat((BigDecimal) lines.getFirst().get("runningBalance")).isEqualByComparingTo("1200.00");
    assertThat((BigDecimal) statement.get("closingBalance")).isEqualByComparingTo("1200.00");

    Actor tenant = actor(s.residentEmail());
    assertThat(
            reporting.leaseStatement(
                tenant, s.organization(), s.building(), lease, lastMonth, LocalDate.now()))
        .containsKey("closingBalance");
  }

  @Test
  void onlyManagerOrAccountantCanViewRentRollOrIncomeStatement() {
    Setup s = organizationWithRentableSpaceAndResident();
    Actor tenant = actor(s.residentEmail());

    assertThatThrownBy(() -> reporting.rentRoll(tenant, s.organization(), s.building()))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
    assertThatThrownBy(
            () ->
                reporting.incomeStatement(
                    tenant,
                    s.organization(),
                    s.building(),
                    LocalDate.now().minusMonths(1),
                    LocalDate.now()))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }

  @Test
  void occupancyReportCountsSpacesByStatusAndComputesTheOccupancyRate() {
    Setup s = organizationWithRentableSpaceAndResident();
    activeLease(s, LocalDate.now());
    buildings.createSpace(
        s.owner(),
        s.organization(),
        s.building(),
        null,
        null,
        "Flat 2",
        "F2",
        SpaceType.FLAT,
        true,
        null,
        4,
        null);

    var report = reporting.occupancyReport(s.owner(), s.organization(), s.building());

    @SuppressWarnings("unchecked")
    var byStatus = (java.util.Map<String, Long>) report.get("byStatus");
    assertThat(byStatus.get("OCCUPIED")).isEqualTo(1L);
    assertThat(byStatus.get("VACANT")).isEqualTo(1L);
    assertThat(report).containsEntry("totalRentable", 2L).containsEntry("occupancyRate", 50.0);
  }

  @Test
  void maintenanceReportCountsRequestsByStatusWithinTheDateRange() {
    Setup s = organizationWithRentableSpaceAndResident();
    UUID category =
        maintenance.createCategory(s.owner(), s.organization(), s.building(), "Plumbing", 4, 48);
    maintenance.submit(
        s.owner(),
        s.organization(),
        s.building(),
        s.space(),
        category,
        "Leaking tap",
        "Water is dripping",
        Impact.MEDIUM,
        false);

    var report =
        reporting.maintenanceReport(
            s.owner(), s.organization(), s.building(), LocalDate.now(), LocalDate.now());

    @SuppressWarnings("unchecked")
    var byStatus = (java.util.List<java.util.Map<String, Object>>) report.get("byStatus");
    assertThat(byStatus)
        .anySatisfy(
            row -> {
              assertThat(row.get("status")).isEqualTo("SUBMITTED");
              assertThat(((Number) row.get("count")).longValue()).isEqualTo(1L);
            });
  }

  @Test
  void rentRollCsvIncludesAHeaderAndOneRowPerActiveLease() {
    Setup s = organizationWithRentableSpaceAndResident();
    activeLease(s, LocalDate.now());

    String csv = reporting.rentRollCsv(s.owner(), s.organization(), s.building());

    assertThat(csv).startsWith("Resident,Space,Rent,Currency,Next Due");
    assertThat(csv).contains("Resident");
    assertThat(csv.lines().count()).isEqualTo(2);
  }
}
