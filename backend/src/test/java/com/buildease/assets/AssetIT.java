package com.buildease.assets;

import static org.assertj.core.api.Assertions.*;

import com.buildease.auth.Actor;
import com.buildease.building.*;
import com.buildease.common.ApiException;
import com.buildease.common.Store;
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
class AssetIT {
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
  @Autowired AssetService assets;
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
    var tokens = auth.login(email, password, "asset-" + email);
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
            owner,
            org,
            building,
            null,
            null,
            "Roof",
            "ROOF",
            SpaceType.COMMON_AREA,
            false,
            null,
            null,
            null);
    return new Setup(org, building, space, owner);
  }

  @Test
  void managerCreatesAndUpdatesAnAssetWithWarrantyTracking() {
    Setup s = organizationWithSpace();
    UUID asset =
        assets.create(
            s.owner(),
            s.organization(),
            s.building(),
            s.space(),
            "Rooftop HVAC Unit",
            AssetCategory.HVAC,
            "Carrier",
            "50TCQ",
            "SN-12345",
            LocalDate.now().minusYears(1),
            LocalDate.now().plusYears(4),
            "Installed during renovation");

    var detail = assets.detail(s.owner(), s.organization(), s.building(), asset);
    assertThat(detail).containsEntry("name", "Rooftop HVAC Unit").containsEntry("status", "ACTIVE");

    assets.update(
        s.owner(),
        s.organization(),
        s.building(),
        asset,
        "Rooftop HVAC Unit (North)",
        AssetCategory.HVAC,
        "Carrier",
        "50TCQ",
        "SN-12345",
        LocalDate.now().minusYears(1),
        LocalDate.now().plusYears(4),
        "Renamed after adding a second unit");
    var updated = assets.detail(s.owner(), s.organization(), s.building(), asset);
    assertThat(updated).containsEntry("name", "Rooftop HVAC Unit (North)");
  }

  @Test
  void retiringAnAssetChangesItsStatusAndItDropsFromTheActiveList() {
    Setup s = organizationWithSpace();
    UUID asset =
        assets.create(
            s.owner(),
            s.organization(),
            s.building(),
            s.space(),
            "Rooftop HVAC Unit",
            AssetCategory.HVAC,
            null,
            null,
            null,
            null,
            null,
            null);

    assets.setStatus(s.owner(), s.organization(), s.building(), asset, AssetStatus.RETIRED);

    var active =
        assets.list(s.owner(), s.organization(), s.building(), AssetStatus.ACTIVE, null, 0);
    assertThat(active).isEmpty();
    var retired =
        assets.list(s.owner(), s.organization(), s.building(), AssetStatus.RETIRED, null, 0);
    assertThat(retired).hasSize(1);
  }

  @Test
  void maintenanceStaffCanRecordMeterReadingsButCannotCreateAssets() {
    Setup s = organizationWithSpace();
    UUID asset =
        assets.create(
            s.owner(),
            s.organization(),
            s.building(),
            s.space(),
            "Rooftop HVAC Unit",
            AssetCategory.HVAC,
            null,
            null,
            null,
            null,
            null,
            null);
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

    assets.recordMeterReading(
        staff, s.organization(), s.building(), asset, new BigDecimal("1204.50"), "hours");

    var detail = assets.detail(s.owner(), s.organization(), s.building(), asset);
    @SuppressWarnings("unchecked")
    var readings = (java.util.List<java.util.Map<String, Object>>) detail.get("meterReadings");
    assertThat(readings).hasSize(1);
    assertThat(readings.getFirst()).containsEntry("unit", "hours");

    assertThatThrownBy(
            () ->
                assets.create(
                    staff,
                    s.organization(),
                    s.building(),
                    s.space(),
                    "Another unit",
                    AssetCategory.HVAC,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }

  @Test
  void aTenantCannotViewOrRecordAgainstAssets() {
    Setup s = organizationWithSpace();
    UUID asset =
        assets.create(
            s.owner(),
            s.organization(),
            s.building(),
            s.space(),
            "Rooftop HVAC Unit",
            AssetCategory.HVAC,
            null,
            null,
            null,
            null,
            null,
            null);
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

    assertThatThrownBy(() -> assets.detail(tenant, s.organization(), s.building(), asset))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
    assertThatThrownBy(
            () ->
                assets.recordMeterReading(
                    tenant, s.organization(), s.building(), asset, new BigDecimal("10"), "hours"))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }
}
