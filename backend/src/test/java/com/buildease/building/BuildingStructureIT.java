package com.buildease.building;

import static org.assertj.core.api.Assertions.*;

import com.buildease.auth.Actor;
import com.buildease.common.ApiException;
import com.buildease.common.Store;
import com.buildease.leasing.LeaseService;
import com.buildease.occupancy.OccupancyService;
import com.buildease.security.Role;
import com.buildease.tenancy.TenantService;
import java.math.BigDecimal;
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
class BuildingStructureIT {
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
    var tokens = auth.login(email, password, "structure-" + email);
    db.update("update accounts set must_change_password=false where email=?", email);
    return auth.authenticate(decoder.decode(tokens.accessToken()));
  }

  private record Setup(UUID organization, UUID building, Actor owner) {}

  private Setup organization() {
    String ownerEmail = "owner-" + UUID.randomUUID() + "@example.test";
    UUID org =
        (UUID)
            tenants
                .createOrganization(admin, "Operations", ownerEmail, "Owner", password)
                .get("id");
    Actor owner = actor(ownerEmail);
    UUID building = (UUID) tenants.createBuilding(owner, org, "Harbor", "HARBOR").get("id");
    return new Setup(org, building, owner);
  }

  private UUID level(Setup s, String name, String code) {
    return buildings.createLevel(s.owner(), s.organization(), s.building(), name, code, 0);
  }

  private UUID space(Setup s, UUID level, UUID parent, String name, String code) {
    return buildings.createSpace(
        s.owner(),
        s.organization(),
        s.building(),
        level,
        parent,
        name,
        code,
        SpaceType.FLAT,
        true,
        null,
        4,
        null);
  }

  private Map<String, Object> spaceRow(Setup s, UUID space) {
    return buildings.spaces(s.owner(), s.organization(), s.building()).stream()
        .filter(row -> space.equals(row.get("id")))
        .findFirst()
        .orElseThrow();
  }

  private List<Object> ids(List<Map<String, Object>> rows) {
    return rows.stream().map(row -> row.get("id")).toList();
  }

  @Test
  void editingALevelChangesItsNameCodeAndOrder() {
    Setup s = organization();
    UUID level = level(s, "Ground", "g0");

    buildings.updateLevel(s.owner(), s.organization(), s.building(), level, "Lobby", "lb", 5);

    var row =
        buildings.levels(s.owner(), s.organization(), s.building()).stream()
            .filter(r -> level.equals(r.get("id")))
            .findFirst()
            .orElseThrow();
    assertThat(row)
        .containsEntry("name", "Lobby")
        .containsEntry("code", "LB")
        .containsEntry("sort_order", 5);
  }

  @Test
  void aLevelCodeMustStayUnique() {
    Setup s = organization();
    level(s, "Ground", "G0");
    UUID second = level(s, "First", "L1");

    assertThatThrownBy(
            () ->
                buildings.updateLevel(
                    s.owner(), s.organization(), s.building(), second, "First", "g0", 1))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
  }

  @Test
  void aLevelWithSpacesCannotBeDeletedUntilTheyMove() {
    Setup s = organization();
    UUID level = level(s, "Ground", "G0");
    UUID flat = space(s, level, null, "Flat 1", "F1");

    assertThatThrownBy(
            () -> buildings.deleteLevel(s.owner(), s.organization(), s.building(), level))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));

    buildings.updateSpace(
        s.owner(),
        s.organization(),
        s.building(),
        flat,
        null,
        null,
        "Flat 1",
        "F1",
        SpaceType.FLAT,
        true,
        null,
        4,
        null);
    buildings.deleteLevel(s.owner(), s.organization(), s.building(), level);

    assertThat(ids(buildings.levels(s.owner(), s.organization(), s.building())))
        .doesNotContain(level);
  }

  @Test
  void editingASpaceChangesItsDetails() {
    Setup s = organization();
    UUID level = level(s, "Ground", "G0");
    UUID flat = space(s, null, null, "Flat 1", "F1");

    buildings.updateSpace(
        s.owner(),
        s.organization(),
        s.building(),
        flat,
        level,
        null,
        "Corner flat",
        "f1a",
        SpaceType.OFFICE,
        false,
        new BigDecimal("55.50"),
        6,
        "  Sunny  ");

    assertThat(spaceRow(s, flat))
        .containsEntry("name", "Corner flat")
        .containsEntry("code", "F1A")
        .containsEntry("type", "OFFICE")
        .containsEntry("level_id", level)
        .containsEntry("rentable", false)
        .containsEntry("capacity", 6)
        .containsEntry("notes", "Sunny");
  }

  @Test
  void aSpaceCannotBePlacedInsideItselfOrItsOwnChildren() {
    Setup s = organization();
    UUID parent = space(s, null, null, "Wing", "W1");
    UUID child = space(s, null, parent, "Room", "R1");

    assertThatThrownBy(
            () ->
                buildings.updateSpace(
                    s.owner(),
                    s.organization(),
                    s.building(),
                    parent,
                    null,
                    parent,
                    "Wing",
                    "W1",
                    SpaceType.FLAT,
                    true,
                    null,
                    4,
                    null))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
    assertThatThrownBy(
            () ->
                buildings.updateSpace(
                    s.owner(),
                    s.organization(),
                    s.building(),
                    parent,
                    null,
                    child,
                    "Wing",
                    "W1",
                    SpaceType.FLAT,
                    true,
                    null,
                    4,
                    null))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
  }

  @Test
  void aSpaceCodeMustStayUnique() {
    Setup s = organization();
    space(s, null, null, "Flat 1", "F1");
    UUID second = space(s, null, null, "Flat 2", "F2");

    assertThatThrownBy(
            () ->
                buildings.updateSpace(
                    s.owner(),
                    s.organization(),
                    s.building(),
                    second,
                    null,
                    null,
                    "Flat 2",
                    "f1",
                    SpaceType.FLAT,
                    true,
                    null,
                    4,
                    null))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
  }

  @Test
  void aSpaceWithAnOpenLeaseMustStayRentableAndCannotBeDeleted() {
    Setup s = organization();
    UUID flat = space(s, null, null, "Flat 1", "F1");
    draftLease(s, flat);

    assertThatThrownBy(
            () ->
                buildings.updateSpace(
                    s.owner(),
                    s.organization(),
                    s.building(),
                    flat,
                    null,
                    null,
                    "Flat 1",
                    "F1",
                    SpaceType.FLAT,
                    false,
                    null,
                    4,
                    null))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
    assertThat(spaceRow(s, flat)).containsEntry("rentable", true);

    assertThatThrownBy(() -> buildings.deleteSpace(s.owner(), s.organization(), s.building(), flat))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
    assertThat(ids(buildings.spaces(s.owner(), s.organization(), s.building()))).contains(flat);
  }

  @Test
  void anUnusedSpaceCanBeDeletedButNotWhileItHasChildren() {
    Setup s = organization();
    UUID parent = space(s, null, null, "Wing", "W1");
    UUID child = space(s, null, parent, "Room", "R1");

    assertThatThrownBy(
            () -> buildings.deleteSpace(s.owner(), s.organization(), s.building(), parent))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));

    buildings.deleteSpace(s.owner(), s.organization(), s.building(), child);
    buildings.deleteSpace(s.owner(), s.organization(), s.building(), parent);

    assertThat(ids(buildings.spaces(s.owner(), s.organization(), s.building())))
        .doesNotContain(parent, child);
  }

  @Test
  void nonOwnerCannotEditOrDeleteLevelsAndSpaces() {
    Setup s = organization();
    UUID level = level(s, "Ground", "G0");
    UUID flat = space(s, null, null, "Flat 1", "F1");
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
                buildings.updateLevel(
                    tenant, s.organization(), s.building(), level, "Hacked", "HK", 0))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
    assertThatThrownBy(() -> buildings.deleteLevel(tenant, s.organization(), s.building(), level))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
    assertThatThrownBy(() -> buildings.deleteSpace(tenant, s.organization(), s.building(), flat))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }

  private UUID draftLease(Setup s, UUID space) {
    String residentEmail = "resident-" + UUID.randomUUID() + "@example.test";
    UUID residentAccount =
        (UUID)
            tenants
                .invite(
                    s.owner(),
                    s.organization(),
                    residentEmail,
                    "Resident",
                    password,
                    false,
                    s.building(),
                    Set.of(Role.TENANT))
                .get("id");
    UUID resident =
        occupancy.createResident(
            s.owner(), s.organization(), s.building(), residentAccount, "Resident", null);
    LocalDate startsOn = LocalDate.now();
    return leases.createDraft(
        s.owner(),
        s.organization(),
        s.building(),
        resident,
        space,
        startsOn,
        null,
        new BigDecimal("1200.00"),
        startsOn,
        null,
        null);
  }
}
