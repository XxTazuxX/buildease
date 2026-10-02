package com.buildease.maintenance;

import static org.assertj.core.api.Assertions.*;

import com.buildease.auth.Actor;
import com.buildease.building.*;
import com.buildease.common.ApiException;
import com.buildease.common.Store;
import com.buildease.security.Role;
import com.buildease.tenancy.TenantService;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import java.util.Map;
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
class MaintenanceManagementIT {
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
    var tokens = auth.login(email, password, "mgmt-" + email);
    db.update("update accounts set must_change_password=false where email=?", email);
    return auth.authenticate(decoder.decode(tokens.accessToken()));
  }

  private record Setup(UUID organization, UUID building, UUID space, Actor owner) {}

  private Setup organizationWithSpace() {
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
    return new Setup(org, building, space, owner);
  }

  private UUID account(Setup s, Role role) {
    String email = role.name().toLowerCase() + "-" + UUID.randomUUID() + "@example.test";
    return (UUID)
        tenants
            .invite(
                s.owner(),
                s.organization(),
                email,
                role.name(),
                password,
                false,
                s.building(),
                Set.of(role))
            .get("id");
  }

  private UUID category(Setup s, String name) {
    return maintenance.createCategory(s.owner(), s.organization(), s.building(), name, 4, 48);
  }

  private UUID plan(Setup s, UUID category) {
    return maintenance.createRecurringPlan(
        s.owner(),
        s.organization(),
        s.building(),
        s.space(),
        category,
        "Quarterly inspection",
        "Check fixtures",
        90,
        LocalDate.now().plusDays(7));
  }

  private List<Object> ids(List<Map<String, Object>> rows) {
    return rows.stream().map(row -> row.get("id")).toList();
  }

  @Test
  void anUnusedCategoryCanBeDeleted() {
    Setup s = organizationWithSpace();
    UUID category = category(s, "Plumbing");

    maintenance.deleteCategory(s.owner(), s.organization(), s.building(), category);

    assertThat(ids(maintenance.categories(s.owner(), s.organization(), s.building())))
        .doesNotContain(category);
  }

  @Test
  void aCategoryUsedByARequestCannotBeDeleted() {
    Setup s = organizationWithSpace();
    UUID category = category(s, "Plumbing");
    maintenance.submit(
        s.owner(),
        s.organization(),
        s.building(),
        s.space(),
        category,
        "Leaking tap",
        "Dripping",
        Impact.MEDIUM,
        false);

    assertThatThrownBy(
            () -> maintenance.deleteCategory(s.owner(), s.organization(), s.building(), category))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
    assertThat(ids(maintenance.categories(s.owner(), s.organization(), s.building())))
        .contains(category);
  }

  @Test
  void aCategoryUsedByARecurringPlanCannotBeDeletedUntilThePlanIsRemoved() {
    Setup s = organizationWithSpace();
    UUID category = category(s, "Plumbing");
    UUID plan = plan(s, category);

    assertThatThrownBy(
            () -> maintenance.deleteCategory(s.owner(), s.organization(), s.building(), category))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));

    maintenance.deleteRecurringPlan(s.owner(), s.organization(), s.building(), plan);
    maintenance.deleteCategory(s.owner(), s.organization(), s.building(), category);
    assertThat(ids(maintenance.categories(s.owner(), s.organization(), s.building())))
        .doesNotContain(category);
  }

  @Test
  void editingAVendorChangesItsDetailsAndTheLinkedAccount() {
    Setup s = organizationWithSpace();
    UUID vendorAccount = account(s, Role.VENDOR);
    UUID vendor =
        maintenance.createVendor(
            s.owner(), s.organization(), s.building(), "Glass team", null, null, null);

    maintenance.updateVendor(
        s.owner(),
        s.organization(),
        s.building(),
        vendor,
        "  Glass & Co ",
        "glass@example.test",
        "555-0100",
        vendorAccount);
    assertThat(vendorRow(s, vendor))
        .containsEntry("name", "Glass & Co")
        .containsEntry("email", "glass@example.test")
        .containsEntry("phone", "555-0100")
        .containsEntry("account_id", vendorAccount);

    maintenance.updateVendor(
        s.owner(), s.organization(), s.building(), vendor, "Glass & Co", null, null, null);
    assertThat(vendorRow(s, vendor)).containsEntry("email", null).containsEntry("account_id", null);
  }

  @Test
  void aVendorCanOnlyBeLinkedToAnAccountWithTheVendorRole() {
    Setup s = organizationWithSpace();
    UUID tenantAccount = account(s, Role.TENANT);
    UUID vendor =
        maintenance.createVendor(
            s.owner(), s.organization(), s.building(), "Glass team", null, null, null);

    assertThatThrownBy(
            () ->
                maintenance.updateVendor(
                    s.owner(),
                    s.organization(),
                    s.building(),
                    vendor,
                    "Glass team",
                    null,
                    null,
                    tenantAccount))
        .isInstanceOf(ApiException.class);
    assertThat(vendorRow(s, vendor)).containsEntry("account_id", null);
  }

  @Test
  void anUnusedVendorCanBeDeletedEvenWhenLinkedToAnAccount() {
    Setup s = organizationWithSpace();
    UUID vendor =
        maintenance.createVendor(
            s.owner(),
            s.organization(),
            s.building(),
            "Glass team",
            null,
            null,
            account(s, Role.VENDOR));

    maintenance.deleteVendor(s.owner(), s.organization(), s.building(), vendor);

    assertThat(ids(maintenance.vendors(s.owner(), s.organization(), s.building())))
        .doesNotContain(vendor);
  }

  @Test
  void aVendorWithWorkOrdersCannotBeDeleted() {
    Setup s = organizationWithSpace();
    UUID category = category(s, "Glazing");
    UUID request =
        maintenance.submit(
            s.owner(),
            s.organization(),
            s.building(),
            s.space(),
            category,
            "Window",
            "Broken window",
            Impact.MEDIUM,
            false);
    maintenance.triage(s.owner(), s.organization(), s.building(), request, Priority.MEDIUM, null);
    UUID vendor =
        maintenance.createVendor(
            s.owner(), s.organization(), s.building(), "Glass team", null, null, null);
    maintenance.assignVendor(s.owner(), s.organization(), s.building(), request, vendor, null);

    assertThatThrownBy(
            () -> maintenance.deleteVendor(s.owner(), s.organization(), s.building(), vendor))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
    assertThat(ids(maintenance.vendors(s.owner(), s.organization(), s.building())))
        .contains(vendor);
  }

  @Test
  void editingARecurringPlanChangesItsScheduleAndText() {
    Setup s = organizationWithSpace();
    UUID category = category(s, "Plumbing");
    UUID other = category(s, "Electrical");
    UUID plan = plan(s, category);
    LocalDate next = LocalDate.now().plusDays(30);

    maintenance.updateRecurringPlan(
        s.owner(),
        s.organization(),
        s.building(),
        plan,
        s.space(),
        other,
        "  Boiler service ",
        "Annual service",
        365,
        next);

    var row =
        maintenance.recurringPlans(s.owner(), s.organization(), s.building()).stream()
            .filter(r -> plan.equals(r.get("id")))
            .findFirst()
            .orElseThrow();
    assertThat(row)
        .containsEntry("title", "Boiler service")
        .containsEntry("description", "Annual service")
        .containsEntry("interval_days", 365)
        .containsEntry("category_id", other);
  }

  @Test
  void aRecurringPlanCanBeDeleted() {
    Setup s = organizationWithSpace();
    UUID plan = plan(s, category(s, "Plumbing"));

    maintenance.deleteRecurringPlan(s.owner(), s.organization(), s.building(), plan);

    assertThat(ids(maintenance.recurringPlans(s.owner(), s.organization(), s.building())))
        .doesNotContain(plan);
  }

  @Test
  void nonManagerCannotEditOrDeleteVendorsPlansOrCategories() {
    Setup s = organizationWithSpace();
    UUID category = category(s, "Plumbing");
    UUID plan = plan(s, category);
    UUID vendor =
        maintenance.createVendor(
            s.owner(), s.organization(), s.building(), "Glass team", null, null, null);
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

    assertThatThrownBy(
            () ->
                maintenance.updateVendor(
                    tenant, s.organization(), s.building(), vendor, "Hacked", null, null, null))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
    assertThatThrownBy(
            () -> maintenance.deleteVendor(tenant, s.organization(), s.building(), vendor))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
    assertThatThrownBy(
            () -> maintenance.deleteRecurringPlan(tenant, s.organization(), s.building(), plan))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
    assertThatThrownBy(
            () -> maintenance.deleteCategory(tenant, s.organization(), s.building(), category))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }

  private Map<String, Object> vendorRow(Setup s, UUID vendor) {
    return maintenance.vendors(s.owner(), s.organization(), s.building()).stream()
        .filter(row -> vendor.equals(row.get("id")))
        .findFirst()
        .orElseThrow();
  }
}
