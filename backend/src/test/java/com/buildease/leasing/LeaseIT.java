package com.buildease.leasing;

import static org.assertj.core.api.Assertions.*;

import com.buildease.auth.Actor;
import com.buildease.building.*;
import com.buildease.common.ApiException;
import com.buildease.common.Store;
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
import org.testcontainers.containers.PostgreSQLContainer;

@SpringBootTest
class LeaseIT {
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
    var tokens = auth.login(email, password, "leasing-" + email);
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

  private UUID draftLease(Setup s, LocalDate startsOn) {
    return leases.createDraft(
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
  }

  @Test
  void draftLeaseActivatesReusesOrCreatesAssignmentAndFlipsSpaceOccupied() {
    Setup s = organizationWithRentableSpaceAndResident();
    LocalDate startsOn = LocalDate.now();
    UUID lease = draftLease(s, startsOn);

    leases.activate(s.owner(), s.organization(), s.building(), lease);

    var detail = leases.lease(s.owner(), s.organization(), s.building(), lease);
    assertThat(detail).containsEntry("status", "ACTIVE");
    assertThat(detail.get("assignment_id")).isNotNull();
    assertThat(
            buildings.spaces(s.owner(), s.organization(), s.building()).stream()
                .filter(row -> s.space().equals(row.get("id")))
                .findFirst()
                .orElseThrow())
        .containsEntry("status", "OCCUPIED");

    UUID secondLease = draftLease(s, startsOn);
    assertThatThrownBy(
            () -> leases.activate(s.owner(), s.organization(), s.building(), secondLease))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
  }

  @Test
  void endingLeaseEndsTheAssignmentAndFreesTheSpaceForANewLease() {
    Setup s = organizationWithRentableSpaceAndResident();
    LocalDate startsOn = LocalDate.now();
    UUID lease = draftLease(s, startsOn);
    leases.activate(s.owner(), s.organization(), s.building(), lease);

    leases.end(
        s.owner(), s.organization(), s.building(), lease, startsOn, LeaseEndReason.TERMINATED);

    assertThat(
            buildings.spaces(s.owner(), s.organization(), s.building()).stream()
                .filter(row -> s.space().equals(row.get("id")))
                .findFirst()
                .orElseThrow())
        .containsEntry("status", "VACANT");

    UUID nextLease = draftLease(s, startsOn);
    leases.activate(s.owner(), s.organization(), s.building(), nextLease);
    assertThat(leases.lease(s.owner(), s.organization(), s.building(), nextLease))
        .containsEntry("status", "ACTIVE");
  }

  @Test
  void cancelingADraftLeaseNeverTouchesOccupancy() {
    Setup s = organizationWithRentableSpaceAndResident();
    UUID lease = draftLease(s, LocalDate.now());

    leases.cancel(s.owner(), s.organization(), s.building(), lease);

    assertThat(leases.lease(s.owner(), s.organization(), s.building(), lease))
        .containsEntry("status", "CANCELLED");
    assertThat(
            buildings.spaces(s.owner(), s.organization(), s.building()).stream()
                .filter(row -> s.space().equals(row.get("id")))
                .findFirst()
                .orElseThrow())
        .containsEntry("status", "VACANT");
    assertThatThrownBy(() -> leases.activate(s.owner(), s.organization(), s.building(), lease))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
  }

  @Test
  void nonManagerCannotCreateActivateOrEndALease() {
    Setup s = organizationWithRentableSpaceAndResident();
    Actor tenant = actor(s.residentEmail());
    LocalDate startsOn = LocalDate.now();

    assertThatThrownBy(
            () ->
                leases.createDraft(
                    tenant,
                    s.organization(),
                    s.building(),
                    s.resident(),
                    s.space(),
                    startsOn,
                    null,
                    new BigDecimal("1200.00"),
                    startsOn,
                    null,
                    null))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));

    UUID lease = draftLease(s, startsOn);
    assertThatThrownBy(() -> leases.activate(tenant, s.organization(), s.building(), lease))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
    leases.activate(s.owner(), s.organization(), s.building(), lease);
    assertThatThrownBy(
            () ->
                leases.end(
                    tenant,
                    s.organization(),
                    s.building(),
                    lease,
                    startsOn,
                    LeaseEndReason.TERMINATED))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }

  @Test
  void onlyManagerOrAccountantCanRecordPaymentsOrDepositsAndBalanceReflectsBoth() {
    Setup s = organizationWithRentableSpaceAndResident();
    LocalDate startsOn = LocalDate.now();
    UUID lease = draftLease(s, startsOn);
    leases.activate(s.owner(), s.organization(), s.building(), lease);

    String staffEmail = "staff-" + UUID.randomUUID() + "@example.test";
    tenants.invite(
        s.owner(),
        s.organization(),
        staffEmail,
        "Staff",
        password,
        false,
        s.building(),
        Set.of(Role.MAINTENANCE_STAFF));
    Actor staff = actor(staffEmail);
    assertThatThrownBy(
            () ->
                leases.recordPayment(
                    staff,
                    s.organization(),
                    s.building(),
                    lease,
                    new BigDecimal("1200.00"),
                    PaymentMethod.BANK_TRANSFER,
                    null,
                    startsOn,
                    null))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));

    String accountantEmail = "accountant-" + UUID.randomUUID() + "@example.test";
    tenants.invite(
        s.owner(),
        s.organization(),
        accountantEmail,
        "Accountant",
        password,
        false,
        s.building(),
        Set.of(Role.ACCOUNTANT));
    Actor accountant = actor(accountantEmail);
    leases.recordPayment(
        accountant,
        s.organization(),
        s.building(),
        lease,
        new BigDecimal("500.00"),
        PaymentMethod.BANK_TRANSFER,
        "ref-1",
        startsOn,
        null);

    var detail = leases.lease(s.owner(), s.organization(), s.building(), lease);
    @SuppressWarnings("unchecked")
    var charges = (java.util.List<java.util.Map<String, Object>>) detail.get("charges");
    assertThat(charges).isEmpty();
    assertThat((BigDecimal) detail.get("balance")).isEqualByComparingTo("-500.00");
  }

  @Test
  void tenantSeesOnlyTheirOwnLeaseAndBalance() {
    Setup a = organizationWithRentableSpaceAndResident();
    LocalDate startsOn = LocalDate.now();
    UUID leaseA = draftLease(a, startsOn);
    leases.activate(a.owner(), a.organization(), a.building(), leaseA);
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
    UUID leaseB =
        leases.createDraft(
            a.owner(),
            a.organization(),
            a.building(),
            residentB,
            secondSpace,
            startsOn,
            null,
            new BigDecimal("900.00"),
            startsOn,
            null,
            null);
    leases.activate(a.owner(), a.organization(), a.building(), leaseB);

    var ownLeases = leases.leases(tenantA, a.organization(), a.building(), null, 0);
    assertThat(ownLeases).hasSize(1);
    assertThat(ownLeases.getFirst()).containsEntry("id", leaseA);
    assertThatThrownBy(() -> leases.lease(tenantA, a.organization(), a.building(), leaseB))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }

  @Test
  void depositRefundAndForfeitAreExclusiveAndCannotRepeat() {
    Setup a = organizationWithRentableSpaceAndResident();
    LocalDate startsOn = LocalDate.now();
    UUID leaseA = draftLease(a, startsOn);
    leases.refundDeposit(
        a.owner(),
        a.organization(),
        a.building(),
        leaseA,
        startsOn,
        new BigDecimal("1200.00"),
        null);
    assertThatThrownBy(
            () ->
                leases.refundDeposit(
                    a.owner(),
                    a.organization(),
                    a.building(),
                    leaseA,
                    startsOn,
                    new BigDecimal("1200.00"),
                    null))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));

    UUID leaseB = draftLease(a, startsOn);
    leases.forfeitDeposit(
        a.owner(), a.organization(), a.building(), leaseB, "Damages exceed deposit");
    assertThatThrownBy(
            () -> leases.forfeitDeposit(a.owner(), a.organization(), a.building(), leaseB, "Again"))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
  }
}
