package com.buildease.integrations;

import static org.assertj.core.api.Assertions.*;

import com.buildease.auth.Actor;
import com.buildease.building.*;
import com.buildease.common.ApiException;
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
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

@SpringBootTest
class AccountingSyncIT {
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
  @Autowired ApiKeyService keys;
  @Autowired AccountingSyncService accounting;
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
    var tokens = auth.login(email, password, "accounting-" + email);
    db.update("update accounts set must_change_password=false where email=?", email);
    return auth.authenticate(decoder.decode(tokens.accessToken()));
  }

  private record Setup(UUID organization, UUID building, UUID lease, Actor owner) {}

  private Setup organizationWithActiveLeaseAndCharge() {
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
    LocalDate startsOn = LocalDate.now();
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
    db.update(
        "insert into charges(id,organization_id,building_id,lease_id,type,amount,currency,due_on) values (?,?,?,?,'RENT',?,'USD',?)",
        UUID.randomUUID(),
        org,
        building,
        lease,
        new BigDecimal("1200.00"),
        startsOn);
    return new Setup(org, building, lease, owner);
  }

  @Test
  void managerSyncsToTheStubAdapterAndTheAttemptAppearsInHistory() {
    Setup s = organizationWithActiveLeaseAndCharge();

    UUID syncId = accounting.sync(s.owner(), s.organization(), s.building());

    var history = accounting.history(s.owner(), s.organization(), s.building());
    assertThat(history).hasSize(1);
    assertThat(history.getFirst()).containsEntry("id", syncId).containsEntry("status", "SUCCEEDED");
  }

  @Test
  void publicLedgerViaAnApiKeyIncludesTheChargeAndIsScopedToItsOwnOrganization() {
    Setup a = organizationWithActiveLeaseAndCharge();
    Setup b = organizationWithActiveLeaseAndCharge();
    var created = keys.create(a.owner(), a.organization(), "Accounting sync");
    var resolved = keys.resolve((String) created.get("key"));

    var ledger =
        accounting.ledger(
            resolved.organization(), resolved.actingAccount(), LocalDate.now(), LocalDate.now());

    assertThat(ledger).hasSize(1);
    assertThat(ledger.getFirst()).containsEntry("building_id", a.building());
    assertThat(ledger.stream().map(row -> row.get("building_id"))).doesNotContain(b.building());
  }

  @Test
  void nonManagerCannotTriggerASyncOrViewHistory() {
    Setup s = organizationWithActiveLeaseAndCharge();
    String tenantEmail = "tenant-" + UUID.randomUUID() + "@example.test";
    tenants.invite(
        s.owner(),
        s.organization(),
        tenantEmail,
        "Tenant",
        password,
        false,
        s.building(),
        Set.of(Role.TENANT));
    Actor tenant = actor(tenantEmail);

    assertThatThrownBy(() -> accounting.sync(tenant, s.organization(), s.building()))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
    assertThatThrownBy(() -> accounting.history(tenant, s.organization(), s.building()))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }
}
