package com.buildease.e2e;

import com.buildease.BuildEaseApplication;
import com.buildease.auth.Actor;
import com.buildease.common.Store;
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
    UUID other =
        (UUID)
            tenants
                .createOrganization(
                    actor, "South Properties", "owner@example.test", "North Owner", null)
                .get("id");
    tenants.createBuilding(actor, other, "South House", "SOUTH");
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
