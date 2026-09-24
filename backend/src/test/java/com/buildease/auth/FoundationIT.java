package com.buildease.auth;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.buildease.building.*;
import com.buildease.common.*;
import com.buildease.leasing.*;
import com.buildease.maintenance.*;
import com.buildease.occupancy.*;
import com.buildease.security.*;
import com.buildease.tenancy.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;

@SpringBootTest
@AutoConfigureMockMvc
class FoundationIT {
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
  @Autowired AuthService auth;
  @Autowired TenantService tenants;
  @Autowired BuildingService buildingConfigurations;
  @Autowired OccupancyService occupancy;
  @Autowired LeaseService leases;
  @Autowired MaintenanceService maintenance;
  @Autowired PasswordEncoder passwords;
  @Autowired TransactionTemplate tx;
  @Autowired JwtDecoder decoder;
  @Autowired MockMvc mvc;
  @Autowired Flyway flyway;
  Actor admin;
  String password = "A safe temporary password!";

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

  String email(UUID id) {
    return (String) db.one("select email from accounts where id=?", id).get("email");
  }

  Actor actor(String email) {
    var t = auth.login(email, password, "test-" + email);
    return auth.authenticate(decoder.decode(t.accessToken()));
  }

  UUID organization(String email) {
    return (UUID)
        tenants.createOrganization(admin, "Organization", email, "Owner", password).get("id");
  }

  @Test
  void migrationsRepeatAndRestrictedRoleFailClosed() {
    assertThat(flyway.info().applied()).hasSize(10);
    flyway.validate();
    assertThat(flyway.migrate().migrationsExecuted).isZero();
    assertThat(db.rows("select * from buildings")).isEmpty();
    assertThatThrownBy(
            () ->
                db.update(
                    "insert into buildings(id,organization_id,name,code) values (?,?,?,?)",
                    UUID.randomUUID(),
                    UUID.randomUUID(),
                    "forged",
                    "bad"))
        .isInstanceOf(Exception.class);
    assertThat(db.one("select rolsuper,rolbypassrls from pg_roles where rolname=current_user"))
        .containsEntry("rolsuper", false)
        .containsEntry("rolbypassrls", false);
  }

  @Test
  void passwordsRefreshReuseAndRevocation() {
    var login = auth.login(email(admin.id()), password, "auth-test");
    var current = auth.authenticate(decoder.decode(login.accessToken()));
    var fresh = auth.refresh(login.refreshToken());
    assertThat(fresh.refreshToken()).isNotEqualTo(login.refreshToken());
    assertThatThrownBy(() -> auth.refresh(login.refreshToken())).isInstanceOf(ApiException.class);
    assertThatThrownBy(() -> auth.refresh(fresh.refreshToken())).isInstanceOf(ApiException.class);
    assertThatThrownBy(() -> auth.authenticate(decoder.decode(login.accessToken())))
        .isInstanceOf(ApiException.class);
    var next = auth.login(email(admin.id()), password, "auth-test");
    auth.changePassword(
        auth.authenticate(decoder.decode(next.accessToken())),
        password,
        "A new permanent password!");
    assertThatThrownBy(() -> auth.refresh(next.refreshToken())).isInstanceOf(ApiException.class);
  }

  @Test
  void temporaryPasswordIsRestrictedAndExpires() throws Exception {
    UUID id =
        (UUID)
            tenants
                .createAccount(
                    admin, "temp-" + UUID.randomUUID() + "@example.test", "User", password, false)
                .get("id");
    var login = auth.login(email(id), password, "temporary");
    assertThat(login.mustChangePassword()).isTrue();
    mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + login.accessToken()))
        .andExpect(status().isForbidden());
    auth.changePassword(
        auth.authenticate(decoder.decode(login.accessToken())),
        password,
        "A permanent password phrase");
    assertThat(
            auth.login(email(id), "A permanent password phrase", "temporary").mustChangePassword())
        .isFalse();
    tenants.reset(admin, id, password);
    db.update(
        "update accounts set temporary_password_expires_at=now()-interval '1 minute' where id=?",
        id);
    assertThatThrownBy(() -> auth.login(email(id), password, "temporary"))
        .isInstanceOf(ApiException.class);
  }

  @Test
  void csrfAndUnauthenticatedRequestsAreRejected() throws Exception {
    mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/auth/login")
                .contentType("application/json")
                .content("{\"email\":\"nobody@example.test\",\"password\":\"incorrect\"}"))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/auth/csrf"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.token").isString());
    mvc.perform(
            post("/api/auth/login")
                .with(csrf())
                .contentType("application/json")
                .content("{\"email\":\"nobody@example.test\",\"password\":\"incorrect\"}"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.message").value("Invalid credentials or session"));
  }

  @Test
  void throttlingPersistsAcrossFailedTransactions() {
    String email = "missing-" + UUID.randomUUID() + "@example.test";
    for (int i = 0; i < 10; i++)
      assertThatThrownBy(() -> auth.login(email, "incorrect", "throttle-" + email))
          .isInstanceOf(ApiException.class);
    assertThatThrownBy(() -> auth.login(email, "incorrect", "throttle-" + email))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(429));
  }

  @Test
  void tenantsInvitationsDelegationAndCompositeConstraints() {
    String ownerEmail = "owner-" + UUID.randomUUID() + "@example.test";
    UUID org = organization(ownerEmail);
    Actor owner = actor(ownerEmail);
    // Direct service calls use an actor only after authentication; clear temporary status for this
    // fixture.
    db.update("update accounts set must_change_password=false where id=?", owner.id());
    UUID building = (UUID) tenants.createBuilding(owner, org, "Main", "MAIN").get("id");
    UUID other = organization("other-" + UUID.randomUUID() + "@example.test");
    UUID otherBuilding = (UUID) tenants.createBuilding(admin, other, "Other", "OTHER").get("id");
    assertThatThrownBy(() -> tenants.buildings(owner, other, 0)).isInstanceOf(ApiException.class);
    assertThatThrownBy(
            () ->
                tx.execute(
                    s -> {
                      db.context(owner.id(), org);
                      return db.update(
                          "insert into building_roles values (?,?,?,?)",
                          org,
                          otherBuilding,
                          owner.id(),
                          "TENANT");
                    }))
        .isInstanceOf(Exception.class);
    tx.executeWithoutResult(
        s -> {
          db.context(owner.id(), org);
          assertThat(db.rows("select * from buildings where organization_id=?", other)).isEmpty();
        });
    assertThat(db.rows("select * from buildings")).isEmpty();
    String managerEmail = "manager-" + UUID.randomUUID() + "@example.test";
    UUID managerId =
        (UUID)
            tenants
                .invite(
                    owner,
                    org,
                    managerEmail,
                    "Manager",
                    password,
                    false,
                    building,
                    Set.of(Role.PROPERTY_MANAGER))
                .get("id");
    Actor manager = actor(managerEmail);
    for (Role role : Role.values()) {
      String userEmail = role + "-" + UUID.randomUUID() + "@example.test";
      if (role == Role.PROPERTY_MANAGER)
        assertThatThrownBy(
                () ->
                    tenants.invite(
                        manager, org, userEmail, "User", password, false, building, Set.of(role)))
            .isInstanceOf(ApiException.class);
      else {
        UUID user =
            (UUID)
                tenants
                    .invite(
                        manager, org, userEmail, "User", password, false, building, Set.of(role))
                    .get("id");
        Actor userActor = actor(userEmail);
        assertThatThrownBy(() -> tenants.createBuilding(userActor, org, "Bad", "BAD"))
            .isInstanceOf(ApiException.class);
        assertThatThrownBy(
                () ->
                    tenants.replaceRoles(
                        userActor, org, building, user, Set.of(Role.PROPERTY_MANAGER)))
            .isInstanceOf(ApiException.class);
      }
    }
    assertThatThrownBy(
            () -> tenants.replaceRoles(manager, org, building, owner.id(), Set.of(Role.TENANT)))
        .isInstanceOf(ApiException.class);
    assertThatThrownBy(() -> tenants.membership(owner, org, owner.id(), false, true))
        .isInstanceOf(ApiException.class);
    tenants.invite(
        admin, other, ownerEmail, "Ignored", null, false, otherBuilding, Set.of(Role.TENANT));
    assertThatThrownBy(() -> tenants.buildings(owner, other, 0)).isInstanceOf(ApiException.class);
    tenants.accept(owner, other);
    assertThat(tenants.buildings(owner, other, 0)).hasSize(1);
    tenants.membership(admin, other, owner.id(), false, true);
    assertThatThrownBy(() -> tenants.buildings(owner, other, 0)).isInstanceOf(ApiException.class);
    tenants.membership(owner, org, managerId, false, true);
    assertThatThrownBy(() -> tenants.buildings(manager, org, 0)).isInstanceOf(ApiException.class);
  }

  @Test
  void disabledOrganizationImmediatelyDeniesAccess() {
    String e = "disable-" + UUID.randomUUID() + "@example.test";
    UUID org = organization(e);
    Actor owner = actor(e);
    tenants.organizationActive(admin, org, false);
    assertThatThrownBy(() -> tenants.overview(owner, org)).isInstanceOf(ApiException.class);
  }

  @Test
  void dashboardAggregatesOperationsAndHidesUnauthorizedSections() {
    String ownerEmail = "dashboard-owner-" + UUID.randomUUID() + "@example.test";
    UUID org = organization(ownerEmail);
    Actor owner = actor(ownerEmail);
    UUID building = (UUID) tenants.createBuilding(owner, org, "Dashboard", "DASH").get("id");
    tenants.createBuilding(owner, org, "Dashboard annex", "DASH2");
    UUID space =
        buildingConfigurations.createSpace(
            owner, org, building, null, null, "Flat 1", "F1", SpaceType.FLAT, true, null, 4, null);
    String residentEmail = "dashboard-resident-" + UUID.randomUUID() + "@example.test";
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
            LocalDate.now(),
            null,
            new BigDecimal("1200.00"),
            LocalDate.now(),
            null,
            null);
    leases.activate(owner, org, building, lease);
    db.update(
        "insert into charges(id,organization_id,building_id,lease_id,amount,currency,due_on) values (?,?,?,?,?,'USD',current_date)",
        UUID.randomUUID(),
        org,
        building,
        lease,
        new BigDecimal("1200.00"));
    leases.recordPayment(
        owner,
        org,
        building,
        lease,
        new BigDecimal("450.00"),
        PaymentMethod.BANK_TRANSFER,
        null,
        LocalDate.now(),
        null);
    db.update(
        "insert into charges(id,organization_id,building_id,lease_id,amount,currency,due_on) values (?,?,?,?,?,'EUR',current_date)",
        UUID.randomUUID(),
        org,
        building,
        lease,
        new BigDecimal("19.95"));
    UUID category = maintenance.createCategory(owner, org, building, "Repairs", 1, 2);
    UUID request =
        maintenance.submit(
            owner, org, building, space, category, "Leak", "Pipe is leaking", Impact.HIGH, false);
    db.update(
        "update maintenance_requests set resolution_due_at=now()-interval '1 hour' where id=?",
        request);
    UUID closedRequest =
        maintenance.submit(
            owner, org, building, space, category, "Closed", "Resolved", Impact.LOW, false);
    UUID cancelledRequest =
        maintenance.submit(
            owner, org, building, space, category, "Cancelled", "Duplicate", Impact.LOW, false);
    db.update(
        "update maintenance_requests set status='CLOSED',resolution_due_at=now()-interval '1 hour' where id=?",
        closedRequest);
    db.update(
        "update maintenance_requests set status='CANCELLED',resolution_due_at=now()-interval '1 hour' where id=?",
        cancelledRequest);

    var dashboard = tenants.dashboard(owner, org);
    @SuppressWarnings("unchecked")
    var properties = (Map<String, Object>) dashboard.get("properties");
    @SuppressWarnings("unchecked")
    var people = (Map<String, Object>) dashboard.get("people");
    @SuppressWarnings("unchecked")
    var maintenanceSummary = (Map<String, Object>) dashboard.get("maintenance");
    assertThat(properties)
        .containsEntry("building_count", 2L)
        .containsEntry("space_count", 1L)
        .containsEntry("occupied_space_count", 1L);
    assertThat(people)
        .containsEntry("active_resident_count", 1L)
        .containsEntry("active_assignment_count", 1L);
    assertThat(maintenanceSummary)
        .containsEntry("open_request_count", 1L)
        .containsEntry("overdue_request_count", 1L);
    @SuppressWarnings("unchecked")
    var balances =
        (List<Map<String, Object>>)
            ((Map<String, Object>) dashboard.get("finance")).get("balance_by_currency");
    assertThat(balances)
        .containsExactly(
            Map.of("currency", "EUR", "amount", "19.95"),
            Map.of("currency", "USD", "amount", "750.00"));

    assertThat(tenants.dashboard(admin, org)).isEqualTo(dashboard);

    String managerEmail = "dashboard-manager-" + UUID.randomUUID() + "@example.test";
    tenants.invite(
        owner,
        org,
        managerEmail,
        "Manager",
        password,
        false,
        building,
        Set.of(Role.PROPERTY_MANAGER));
    var managerDashboard = tenants.dashboard(actor(managerEmail), org);
    @SuppressWarnings("unchecked")
    var managerProperties = (Map<String, Object>) managerDashboard.get("properties");
    assertThat(managerProperties).containsEntry("building_count", 1L);
    assertThat(managerDashboard.get("people")).isNotNull();
    assertThat(managerDashboard.get("finance")).isNotNull();
    assertThat(managerDashboard.get("maintenance")).isNotNull();

    String accountantEmail = "dashboard-accountant-" + UUID.randomUUID() + "@example.test";
    tenants.invite(
        owner,
        org,
        accountantEmail,
        "Accountant",
        password,
        false,
        building,
        Set.of(Role.ACCOUNTANT));
    var accountantDashboard = tenants.dashboard(actor(accountantEmail), org);
    assertThat(accountantDashboard.get("people")).isNull();
    assertThat(accountantDashboard.get("finance")).isNotNull();
    assertThat(accountantDashboard.get("maintenance")).isNull();

    String staffEmail = "dashboard-staff-" + UUID.randomUUID() + "@example.test";
    UUID staffAccount =
        (UUID)
            tenants
                .invite(
                    owner,
                    org,
                    staffEmail,
                    "Maintenance",
                    password,
                    false,
                    building,
                    Set.of(Role.MAINTENANCE_STAFF))
                .get("id");
    maintenance.assignStaff(owner, org, building, request, staffAccount, null);
    var staffDashboard = tenants.dashboard(actor(staffEmail), org);
    assertThat(staffDashboard.get("people")).isNull();
    assertThat(staffDashboard.get("finance")).isNull();
    @SuppressWarnings("unchecked")
    var staffMaintenance = (Map<String, Object>) staffDashboard.get("maintenance");
    assertThat(staffMaintenance).containsEntry("open_request_count", 1L);

    String vendorEmail = "dashboard-vendor-" + UUID.randomUUID() + "@example.test";
    UUID vendorAccount =
        (UUID)
            tenants
                .invite(
                    owner,
                    org,
                    vendorEmail,
                    "Vendor",
                    password,
                    false,
                    building,
                    Set.of(Role.VENDOR))
                .get("id");
    UUID vendorRequest =
        maintenance.submit(
            owner, org, building, space, category, "Window", "Broken window", Impact.MEDIUM, false);
    maintenance.triage(owner, org, building, vendorRequest, Priority.MEDIUM, null);
    UUID vendor =
        maintenance.createVendor(
            owner, org, building, "Glass team", vendorEmail, null, vendorAccount);
    maintenance.assignVendor(owner, org, building, vendorRequest, vendor, null);
    var vendorDashboard = tenants.dashboard(actor(vendorEmail), org);
    assertThat(vendorDashboard.get("people")).isNull();
    assertThat(vendorDashboard.get("finance")).isNull();
    @SuppressWarnings("unchecked")
    var vendorMaintenance = (Map<String, Object>) vendorDashboard.get("maintenance");
    assertThat(vendorMaintenance).containsEntry("open_request_count", 1L);

    String unrelatedEmail = "dashboard-unrelated-" + UUID.randomUUID() + "@example.test";
    UUID unrelated =
        (UUID)
            tenants
                .invite(owner, org, unrelatedEmail, "Member", password, false, null, Set.of())
                .get("id");
    var unrelatedDashboard = tenants.dashboard(actor(unrelatedEmail), org);
    assertThat(unrelatedDashboard.get("people")).isNull();
    assertThat(unrelatedDashboard.get("finance")).isNull();
    assertThat(unrelatedDashboard.get("maintenance")).isNull();
    @SuppressWarnings("unchecked")
    var unrelatedProperties = (Map<String, Object>) unrelatedDashboard.get("properties");
    assertThat(unrelatedProperties).containsEntry("building_count", 0L);

    UUID otherOrganization = organization("dashboard-other-" + UUID.randomUUID() + "@example.test");
    assertThatThrownBy(() -> tenants.dashboard(actor(unrelatedEmail), otherOrganization))
        .isInstanceOfSatisfying(
            ApiException.class, error -> assertThat(error.status).isEqualTo(403));
    tenants.membership(owner, org, unrelated, false, true);
    assertThatThrownBy(() -> tenants.dashboard(actor(unrelatedEmail), org))
        .isInstanceOfSatisfying(
            ApiException.class, error -> assertThat(error.status).isEqualTo(403));
  }

  @Test
  void buildingConfigurationIsOwnerControlledAndTenantIsolated() {
    String ownerEmail = "building-owner-" + UUID.randomUUID() + "@example.test";
    UUID organization = organization(ownerEmail);
    Actor owner = actor(ownerEmail);
    UUID building =
        (UUID) tenants.createBuilding(owner, organization, "Harbor House", "HARBOR").get("id");
    buildingConfigurations.configure(
        owner,
        organization,
        building,
        "Harbor House",
        "10 Bay Road",
        null,
        "Colombo",
        "Western",
        "00100",
        "lk",
        "Asia/Colombo",
        "lkr",
        "+94 11 555 0100");
    UUID level =
        buildingConfigurations.createLevel(owner, organization, building, "Level 1", "l1", 1);
    UUID flat =
        buildingConfigurations.createSpace(
            owner,
            organization,
            building,
            level,
            null,
            "Flat 101",
            "f101",
            SpaceType.FLAT,
            true,
            new java.math.BigDecimal("82.50"),
            5,
            null);
    buildingConfigurations.createSpace(
        owner,
        organization,
        building,
        level,
        flat,
        "Bedroom 1",
        "f101-r1",
        SpaceType.ROOM,
        false,
        new java.math.BigDecimal("14.25"),
        2,
        null);
    buildingConfigurations.status(owner, organization, building, flat, SpaceStatus.MAINTENANCE);

    assertThat(buildingConfigurations.building(owner, organization, building))
        .containsEntry("timezone", "Asia/Colombo")
        .containsEntry("currency", "LKR")
        .containsEntry("country_code", "LK");
    assertThat(buildingConfigurations.levels(owner, organization, building)).hasSize(1);
    assertThat(buildingConfigurations.spaces(owner, organization, building)).hasSize(2);
    assertThatThrownBy(
            () ->
                buildingConfigurations.status(
                    owner, organization, building, flat, SpaceStatus.OCCUPIED))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));

    String tenantEmail = "building-tenant-" + UUID.randomUUID() + "@example.test";
    tenants.invite(
        owner, organization, tenantEmail, "Tenant", password, false, building, Set.of(Role.TENANT));
    Actor tenant = actor(tenantEmail);
    assertThat(buildingConfigurations.spaces(tenant, organization, building)).hasSize(2);
    assertThatThrownBy(
            () ->
                buildingConfigurations.createLevel(
                    tenant, organization, building, "Forbidden", "NO", 2))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));

    UUID otherOrganization =
        organization("isolated-building-" + UUID.randomUUID() + "@example.test");
    assertThatThrownBy(() -> buildingConfigurations.spaces(tenant, otherOrganization, building))
        .isInstanceOf(ApiException.class);
  }

  @Test
  void lastOwnerAccountCannotBeDisabledAndRoleChangesAreImmediate() {
    String ownerEmail = "last-owner-" + UUID.randomUUID() + "@example.test";
    UUID org = organization(ownerEmail);
    Actor owner = actor(ownerEmail);
    assertThatThrownBy(() -> tenants.accountStatus(admin, owner.id(), false))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
    UUID b = (UUID) tenants.createBuilding(owner, org, "Building", "ONE").get("id");
    String managerEmail = "revoke-" + UUID.randomUUID() + "@example.test";
    UUID managerId =
        (UUID)
            tenants
                .invite(
                    owner,
                    org,
                    managerEmail,
                    "Manager",
                    password,
                    false,
                    b,
                    Set.of(Role.PROPERTY_MANAGER))
                .get("id");
    Actor manager = actor(managerEmail);
    assertThatThrownBy(() -> tenants.reset(manager, owner.id(), password))
        .isInstanceOf(ApiException.class);
    assertThat(tenants.members(manager, org, b, 0)).isNotEmpty();
    tenants.replaceRoles(owner, org, b, managerId, Set.of(Role.TENANT));
    assertThatThrownBy(() -> tenants.members(manager, org, b, 0)).isInstanceOf(ApiException.class);
    tenants.accountStatus(admin, managerId, false);
    assertThatThrownBy(() -> auth.login(managerEmail, password, "disabled-test"))
        .isInstanceOf(ApiException.class);
  }

  @Test
  void membersCannotChangeTheirOwnMembershipOrBuildingRoles() {
    String ownerEmail = "self-owner-" + UUID.randomUUID() + "@example.test";
    UUID org = organization(ownerEmail);
    Actor owner = actor(ownerEmail);
    UUID building =
        (UUID) tenants.createBuilding(owner, org, "Self-service guard", "SELF").get("id");

    tenants.invite(
        owner,
        org,
        "second-owner-" + UUID.randomUUID() + "@example.test",
        "Second Owner",
        password,
        true,
        null,
        Set.of());

    assertThatThrownBy(() -> tenants.membership(owner, org, owner.id(), false, false))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
    assertThatThrownBy(() -> tenants.membership(owner, org, owner.id(), true, true))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
    assertThatThrownBy(
            () -> tenants.replaceRoles(owner, org, building, owner.id(), Set.of(Role.TENANT)))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));

    assertThat(tenants.overview(owner, org).get("owner")).isEqualTo(true);
  }

  @Test
  void ownerCanEditOrganizationMemberAndAssignRolesInASelectedBuilding() {
    String ownerEmail = "member-owner-" + UUID.randomUUID() + "@example.test";
    UUID org = organization(ownerEmail);
    Actor owner = actor(ownerEmail);
    UUID building =
        (UUID) tenants.createBuilding(owner, org, "Member operations", "MEMBERS").get("id");
    String memberEmail = "member-" + UUID.randomUUID() + "@example.test";
    UUID memberId =
        (UUID)
            tenants
                .invite(owner, org, memberEmail, "Global identity", password, false, null, Set.of())
                .get("id");

    assertThat(tenants.members(owner, org, building, 0))
        .extracting(row -> row.get("account_id"))
        .contains(memberId);
    tenants.updateMemberProfile(owner, org, memberId, "Building display name");
    tenants.replaceRoles(owner, org, building, memberId, Set.of(Role.TENANT));

    assertThat(tenants.members(owner, org, building, 0))
        .anySatisfy(
            row ->
                assertThat(row)
                    .containsEntry("account_id", memberId)
                    .containsEntry("display_name", "Building display name"));
    assertThat(db.one("select display_name from accounts where id=?", memberId))
        .containsEntry("display_name", "Global identity");
    assertThatThrownBy(
            () -> tenants.updateMemberProfile(actor(memberEmail), org, memberId, "Unauthorized"))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }

  @Test
  void lastPlatformAdministratorMustRemainActive() {
    var others =
        db.rows("select id from accounts where platform_admin and active and id<>?", admin.id());
    try {
      db.update("update accounts set active=false where platform_admin and id<>?", admin.id());
      assertThatThrownBy(() -> tenants.accountStatus(admin, admin.id(), false))
          .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
    } finally {
      for (var other : others)
        db.update("update accounts set active=true where id=?", other.get("id"));
    }
  }

  @Test
  void refreshExpiryLogoutAndSafeProjection() throws Exception {
    var tokens = auth.login(email(admin.id()), password, "expiry");
    Actor actor = auth.authenticate(decoder.decode(tokens.accessToken()));
    assertThat(db.find("select 1 from refresh_tokens where token_hash=?", tokens.refreshToken()))
        .isEmpty();
    assertThat(auth.me(actor)).doesNotContainKeys("password_hash", "temporary_password_expires_at");
    mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + tokens.accessToken()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.password_hash").doesNotExist());
    auth.logout(tokens.refreshToken(), actor);
    assertThatThrownBy(() -> auth.authenticate(decoder.decode(tokens.accessToken())))
        .isInstanceOf(ApiException.class);
    var next = auth.login(email(admin.id()), password, "expiry");
    var nextActor = auth.authenticate(decoder.decode(next.accessToken()));
    db.update(
        "update auth_sessions set expires_at=now()-interval '1 second' where id=?",
        nextActor.sessionId());
    assertThatThrownBy(() -> auth.refresh(next.refreshToken())).isInstanceOf(ApiException.class);
  }

  @Test
  void migrationChecksumChangesAreRejected() {
    var migrationDb =
        new JdbcTemplate(
            new DriverManagerDataSource(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
    Integer checksum =
        migrationDb.queryForObject(
            "select checksum from flyway_schema_history where version='1'", Integer.class);
    try {
      migrationDb.update("update flyway_schema_history set checksum=0 where version='1'");
      assertThatThrownBy(() -> flyway.validate())
          .isInstanceOf(org.flywaydb.core.api.exception.FlywayValidateException.class);
    } finally {
      migrationDb.update("update flyway_schema_history set checksum=? where version='1'", checksum);
    }
  }

  @Test
  void wrongIssuerAudienceSignatureAndExpiredJwtAreRejected() {
    var token = auth.login(email(admin.id()), password, "claims").accessToken();
    String signature = token.substring(token.lastIndexOf('.') + 1);
    String changed = (signature.charAt(0) == 'a' ? "b" : "a") + signature.substring(1);
    assertThatThrownBy(
            () -> decoder.decode(token.substring(0, token.lastIndexOf('.') + 1) + changed))
        .isInstanceOf(org.springframework.security.oauth2.jwt.JwtException.class);
    var encoder =
        new org.springframework.security.oauth2.jwt.NimbusJwtEncoder(
            new com.nimbusds.jose.jwk.source.ImmutableSecret<>(
                new javax.crypto.spec.SecretKeySpec(new byte[32], "HmacSHA256")));
    for (int scenario = 0; scenario < 3; scenario++) {
      var claims =
          org.springframework.security.oauth2.jwt.JwtClaimsSet.builder()
              .issuer(scenario == 0 ? "other" : "buildease")
              .audience(List.of(scenario == 1 ? "other" : "buildease-api"))
              .subject(admin.id().toString())
              .issuedAt(Instant.now().minusSeconds(900))
              .expiresAt(Instant.now().plusSeconds(scenario == 2 ? -120 : 600))
              .claim("sid", UUID.randomUUID().toString())
              .build();
      String invalid =
          encoder
              .encode(
                  org.springframework.security.oauth2.jwt.JwtEncoderParameters.from(
                      org.springframework.security.oauth2.jwt.JwsHeader.with(
                              org.springframework.security.oauth2.jose.jws.MacAlgorithm.HS256)
                          .build(),
                      claims))
              .getTokenValue();
      assertThatThrownBy(() -> decoder.decode(invalid))
          .isInstanceOf(org.springframework.security.oauth2.jwt.JwtException.class);
    }
  }

  @Test
  void explicitBootstrapCreatesOneTemporaryAdministratorAndRefusesRepeat() {
    tx.executeWithoutResult(
        status -> {
          status.setRollbackOnly();
          db.update("update accounts set platform_admin=false");
          var context = new org.springframework.context.support.GenericApplicationContext();
          context.refresh();
          String email = "bootstrap-" + UUID.randomUUID() + "@example.test";
          var command =
              new com.buildease.config.Bootstrap(db, tx, passwords, email, password, context);
          command.run(new org.springframework.boot.DefaultApplicationArguments());
          var account = db.one("select * from accounts where email=?", email);
          assertThat(account)
              .containsEntry("platform_admin", true)
              .containsEntry("must_change_password", true);
          assertThat(passwords.matches(password, (String) account.get("password_hash"))).isTrue();
          assertThatThrownBy(
                  () -> command.run(new org.springframework.boot.DefaultApplicationArguments()))
              .isInstanceOf(IllegalStateException.class);
        });
  }

  @Test
  void platformAuditIsCrossOrganizationAndPlatformAdminOnly() {
    String ownerAEmail = "owner-a-" + UUID.randomUUID() + "@example.test";
    String ownerBEmail = "owner-b-" + UUID.randomUUID() + "@example.test";
    UUID orgA = organization(ownerAEmail);
    UUID orgB = organization(ownerBEmail);
    Actor ownerA = actor(ownerAEmail);

    var rows = tenants.platformAudit(admin, 0, null, null);
    assertThat(rows).anySatisfy(r -> assertThat(r).containsEntry("organization_id", orgA));
    assertThat(rows).anySatisfy(r -> assertThat(r).containsEntry("organization_id", orgB));
    assertThat(rows).anySatisfy(r -> assertThat(r).containsEntry("organization_id", null));

    var scopedToA = tenants.platformAudit(admin, 0, orgA, null);
    assertThat(scopedToA).isNotEmpty();
    assertThat(scopedToA).allSatisfy(r -> assertThat(r).containsEntry("organization_id", orgA));

    var scopedToOwnerA = tenants.platformAudit(admin, 0, null, ownerA.id());
    assertThat(scopedToOwnerA).isNotEmpty();
    assertThat(scopedToOwnerA)
        .allSatisfy(r -> assertThat(r).containsEntry("actor_id", ownerA.id()));

    assertThatThrownBy(() -> tenants.platformAudit(ownerA, 0, null, null))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }
}
