package com.buildease.e2e;

import com.buildease.BuildEaseApplication;
import com.buildease.auth.Actor;
import com.buildease.building.BuildingService;
import com.buildease.building.SpaceType;
import com.buildease.common.Store;
import com.buildease.maintenance.MaintenanceService;
import com.buildease.occupancy.OccupancyService;
import com.buildease.security.Role;
import com.buildease.tenancy.TenantService;
import java.util.*;
import org.springframework.boot.SpringApplication;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.testcontainers.containers.PostgreSQLContainer;

/** Disposable fixtures only; this class is never packaged into the production JAR. */
public class E2eServer {
  public static void main(String[] args) throws Exception {
    var postgres =
        new PostgreSQLContainer<>(
            System.getenv().getOrDefault("TEST_POSTGRES_IMAGE", "postgres:17-alpine"));
    postgres.start();
    String runtimePassword = UUID.randomUUID().toString();
    var sql =
        new JdbcTemplate(
            new DriverManagerDataSource(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()));
    sql.execute(
        "create role buildease_runtime login password '"
            + runtimePassword
            + "' nosuperuser nobypassrls");
    var settings = new LinkedHashMap<String, String>();
    settings.put("server.port", System.getenv().getOrDefault("E2E_BACKEND_PORT", "8080"));
    settings.put("spring.datasource.url", postgres.getJdbcUrl());
    settings.put("spring.datasource.username", "buildease_runtime");
    settings.put("spring.datasource.password", runtimePassword);
    settings.put("spring.flyway.url", postgres.getJdbcUrl());
    settings.put("spring.flyway.user", postgres.getUsername());
    settings.put("spring.flyway.password", postgres.getPassword());
    settings.put("spring.flyway.placeholders.runtimeRole", "buildease_runtime");
    settings.put("app.jwt-secret", Base64.getEncoder().encodeToString(new byte[32]));
    settings.put("app.secure-cookies", "false");
    settings.put("spring.profiles.active", "e2e");
    var context =
        SpringApplication.run(
            BuildEaseApplication.class,
            settings.entrySet().stream()
                .map(e -> "--" + e.getKey() + "=" + e.getValue())
                .toArray(String[]::new));
    var db = context.getBean(Store.class);
    var passwords = context.getBean(PasswordEncoder.class);
    var tenants = context.getBean(TenantService.class);
    String password = "Temporary password for tests!";
    UUID admin = UUID.randomUUID();
    db.update(
        "insert into accounts(id,email,display_name,password_hash,platform_admin,temporary_password_expires_at) values (?,?,?,?,true,now()+interval '24 hours')",
        admin,
        "admin@example.test",
        "Test Admin",
        passwords.encode(password));
    Actor actor = new Actor(admin, UUID.randomUUID(), true, false);
    UUID org =
        (UUID)
            tenants
                .createOrganization(
                    actor, "North Properties", "owner@example.test", "North Owner", password)
                .get("id");
    UUID building = (UUID) tenants.createBuilding(actor, org, "North House", "NORTH").get("id");
    tenants.invite(
        actor,
        org,
        "manager@example.test",
        "Property Manager",
        password,
        false,
        building,
        Set.of(Role.PROPERTY_MANAGER));
    tenants.invite(
        actor,
        org,
        "tenant@example.test",
        "Tenant User",
        password,
        false,
        building,
        Set.of(Role.TENANT));
    UUID other =
        (UUID)
            tenants
                .createOrganization(
                    actor, "South Properties", "owner@example.test", "North Owner", null)
                .get("id");
    tenants.createBuilding(actor, other, "South House", "SOUTH");

    // Billing workflow: a separate managed customer so specs do not depend on each other.
    tenants.createOrganization(
        actor, "Harbor Holdings", "billing-owner@example.test", "Harbor Owner", password);

    // Maintenance workflow: a resident with a unit and a property manager to work the ticket.
    var buildings = context.getBean(BuildingService.class);
    var occupancy = context.getBean(OccupancyService.class);
    var maintenance = context.getBean(MaintenanceService.class);
    UUID quayOrg =
        (UUID)
            tenants
                .createOrganization(
                    actor, "Quay Residences", "quay-owner@example.test", "Quay Owner", password)
                .get("id");
    UUID quay = (UUID) tenants.createBuilding(actor, quayOrg, "Quay House", "QUAY").get("id");
    UUID flat =
        buildings.createSpace(
            actor, quayOrg, quay, null, null, "Flat 1", "F1", SpaceType.FLAT, true, null, 2, null);
    tenants.invite(
        actor,
        quayOrg,
        "quay-manager@example.test",
        "Quay Manager",
        password,
        false,
        quay,
        Set.of(Role.PROPERTY_MANAGER));
    UUID residentAccount =
        (UUID)
            tenants
                .invite(
                    actor,
                    quayOrg,
                    "quay-tenant@example.test",
                    "Quay Tenant",
                    password,
                    false,
                    quay,
                    Set.of(Role.TENANT))
                .get("id");
    UUID resident =
        occupancy.createResident(actor, quayOrg, quay, residentAccount, "Quay Tenant", null);
    occupancy.assign(actor, quayOrg, quay, resident, flat, java.time.LocalDate.now());
    maintenance.createCategory(actor, quayOrg, quay, "Plumbing", 4, 48);
    System.out.println("E2E fixtures ready");
    Runtime.getRuntime()
        .addShutdownHook(
            new Thread(
                () -> {
                  context.close();
                  postgres.stop();
                }));
    new java.util.concurrent.CountDownLatch(1).await();
  }
}
