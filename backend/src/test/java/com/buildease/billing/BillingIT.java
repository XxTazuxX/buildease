package com.buildease.billing;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.buildease.auth.Actor;
import com.buildease.auth.AuthService;
import com.buildease.building.*;
import com.buildease.common.*;
import com.buildease.onboarding.IdentityMail;
import com.buildease.onboarding.OnboardingService;
import com.buildease.security.Role;
import com.buildease.tenancy.TenantService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;

@SpringBootTest
class BillingIT {
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
    // Keep background jobs from claiming the run slot this test drives explicitly.
    r.add("app.automation-delay-ms", () -> 3_600_000);
  }

  @Autowired Store db;
  @Autowired TenantService tenants;
  @Autowired BuildingService buildings;
  @Autowired OnboardingService onboarding;
  @Autowired PlanService plans;
  @Autowired SubscriptionService subscriptions;
  @Autowired SaasInvoiceService invoices;
  @Autowired BillingAutomation automation;
  @Autowired PasswordEncoder passwords;
  @Autowired JwtDecoder decoder;
  @Autowired AuthService auth;
  @Autowired TransactionTemplate transactions;
  @MockitoBean IdentityMail mail;

  static final UUID STARTER = UUID.fromString("00000000-0000-4000-8000-000000000002");
  Actor admin;
  final String password = "A safe temporary password!";

  @BeforeEach
  void fixture() {
    reset(mail);
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
    var tokens = auth.login(email, password, "billing-" + email);
    db.update("update accounts set must_change_password=false where email=?", email);
    return auth.authenticate(decoder.decode(tokens.accessToken()));
  }

  private record Tenant(UUID organization, Actor owner) {}

  private Tenant selfRegistered() {
    String email = "owner-" + UUID.randomUUID() + "@example.test";
    onboarding.register(email, "Owner", "Self Serve", password);
    ArgumentCaptor<String> token = ArgumentCaptor.forClass(String.class);
    verify(mail).verification(eq(email), token.capture());
    UUID org = onboarding.verify(token.getValue());
    return new Tenant(org, actor(email));
  }

  private Tenant managed() {
    String email = "owner-" + UUID.randomUUID() + "@example.test";
    UUID org =
        (UUID) tenants.createOrganization(admin, "Managed", email, "Owner", password).get("id");
    return new Tenant(org, actor(email));
  }

  private void asAdmin(UUID organization, String sql, Object... args) {
    transactions.executeWithoutResult(
        status -> {
          db.context(admin.id(), organization);
          db.update(sql, args);
        });
  }

  @Test
  void pricingListsOnlyPublicActivePlans() {
    assertThat(plans.publicPlans())
        .extracting(row -> row.get("code"))
        .containsExactly("STARTER", "PROFESSIONAL", "ENTERPRISE");
    assertThat(plans.publicPlans().getFirst().get("features")).isInstanceOf(List.class);
  }

  @Test
  void selfRegisteredOrganizationsTrialWithinTrialLimits() {
    Tenant t = selfRegistered();
    var overview = subscriptions.overview(t.owner(), t.organization());
    assertThat(overview).containsEntry("status", "TRIALING").containsEntry("plan_code", "TRIAL");
    assertThat(overview.get("trial_days_left")).isEqualTo(14L);

    tenants.createBuilding(t.owner(), t.organization(), "First", "FIRST");
    assertThatThrownBy(() -> tenants.createBuilding(t.owner(), t.organization(), "Two", "TWO"))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(402));
  }

  @Test
  void anExpiredTrialIsReadOnlyUntilAPlanIsAssigned() {
    Tenant t = selfRegistered();
    asAdmin(
        t.organization(),
        "update organization_subscriptions set trial_ends_on=current_date-1 where organization_id=?",
        t.organization());
    assertThat(subscriptions.status(t.owner(), t.organization())).containsEntry("writable", false);
    assertThatThrownBy(() -> tenants.createBuilding(t.owner(), t.organization(), "One", "ONE"))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(402));

    subscriptions.requestPlan(
        t.owner(), t.organization(), STARTER, SubscriptionService.Cycle.MONTHLY);
    assertThat(subscriptions.list(admin, null, true, 0))
        .anySatisfy(row -> assertThat(row).containsEntry("organization_id", t.organization()));
    invoices.approveRequest(admin, t.organization());

    var overview = subscriptions.overview(t.owner(), t.organization());
    assertThat(overview).containsEntry("status", "ACTIVE").containsEntry("plan_code", "STARTER");
    assertThat(overview.get("requested_plan_id")).isNull();
    // The first period of a newly paying customer is invoiced at activation, not a month later.
    var first = invoices.forOrganization(t.owner(), t.organization(), 0);
    assertThat(first).hasSize(1);
    assertThat(first.getFirst()).containsEntry("status", "ISSUED");
    assertThat((BigDecimal) first.getFirst().get("total")).isEqualByComparingTo("49.00");
    verify(mail).saasInvoiceIssued(anyString(), eq(t.organization().toString()));
    assertThatThrownBy(
            () -> invoices.create(admin, t.organization(), null, null, null, null, null, null))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
    tenants.createBuilding(t.owner(), t.organization(), "One", "ONE");
  }

  @Test
  void staffSeatsAndSpacesAreLimitedButTenantsAreFree() {
    Tenant t = selfRegistered();
    UUID building =
        (UUID) tenants.createBuilding(t.owner(), t.organization(), "Harbor", "HARBOR").get("id");
    asAdmin(null, "update plans set max_staff=2,max_spaces=1 where code='TRIAL'");
    try {
      tenants.invite(
          t.owner(),
          t.organization(),
          "pm-" + UUID.randomUUID() + "@example.test",
          "Manager",
          password,
          false,
          building,
          Set.of(Role.PROPERTY_MANAGER));
      assertThatThrownBy(
              () ->
                  tenants.invite(
                      t.owner(),
                      t.organization(),
                      "staff-" + UUID.randomUUID() + "@example.test",
                      "Staff",
                      password,
                      false,
                      building,
                      Set.of(Role.MAINTENANCE_STAFF)))
          .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(402));
      tenants.invite(
          t.owner(),
          t.organization(),
          "tenant-" + UUID.randomUUID() + "@example.test",
          "Tenant",
          password,
          false,
          building,
          Set.of(Role.TENANT));

      buildings.createSpace(
          t.owner(),
          t.organization(),
          building,
          null,
          null,
          "Flat 1",
          "F1",
          SpaceType.FLAT,
          true,
          null,
          2,
          null);
      assertThatThrownBy(
              () ->
                  buildings.createSpace(
                      t.owner(),
                      t.organization(),
                      building,
                      null,
                      null,
                      "Flat 2",
                      "F2",
                      SpaceType.FLAT,
                      true,
                      null,
                      2,
                      null))
          .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(402));
    } finally {
      asAdmin(null, "update plans set max_staff=5,max_spaces=25 where code='TRIAL'");
    }
  }

  @Test
  void onlyOwnersSeeBillingAndOrganizationsAreIsolated() {
    Tenant a = managed();
    Tenant b = managed();
    UUID building =
        (UUID) tenants.createBuilding(a.owner(), a.organization(), "Harbor", "HARBOR").get("id");
    String managerEmail = "pm-" + UUID.randomUUID() + "@example.test";
    tenants.invite(
        a.owner(),
        a.organization(),
        managerEmail,
        "Manager",
        password,
        false,
        building,
        Set.of(Role.PROPERTY_MANAGER));
    Actor manager = actor(managerEmail);

    assertThat(subscriptions.overview(a.owner(), a.organization()))
        .containsEntry("status", "ACTIVE")
        .containsEntry("plan_code", "PROFESSIONAL");
    assertThat(subscriptions.status(manager, a.organization())).containsEntry("writable", true);
    assertThatThrownBy(() -> subscriptions.overview(manager, a.organization()))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
    assertThatThrownBy(() -> subscriptions.overview(a.owner(), b.organization()))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
    assertThatThrownBy(() -> subscriptions.summary(a.owner()))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));

    UUID invoice = invoices.create(admin, b.organization(), null, null, null, null, null, null);
    invoices.issue(admin, invoice, null);
    assertThat(invoices.forOrganization(a.owner(), a.organization(), 0)).isEmpty();
    assertThatThrownBy(() -> invoices.detailForOrganization(a.owner(), a.organization(), invoice))
        .isInstanceOf(ApiException.class);
  }

  @Test
  void invoiceLifecycleIsEnforcedAndDraftsStayPrivate() {
    Tenant t = managed();
    subscriptions.updateProfile(
        t.owner(), t.organization(), "ap@example.test", "Acme Ltd", "1 Quay St", "VAT-1");
    UUID invoice = invoices.create(admin, t.organization(), null, null, null, null, null, null);
    var draft = invoices.detail(admin, invoice);
    assertThat(draft).containsEntry("status", "DRAFT");
    assertThat((BigDecimal) draft.get("total")).isEqualByComparingTo("149.00");
    assertThat((String) draft.get("number")).startsWith("BE-");
    assertThat(invoices.forOrganization(t.owner(), t.organization(), 0)).isEmpty();
    assertThatThrownBy(() -> invoices.markPaid(admin, invoice, null, "Bank", "REF"))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));

    invoices.issue(admin, invoice, null);
    verify(mail).saasInvoiceIssued(eq("ap@example.test"), eq(t.organization().toString()));
    var visible = invoices.detailForOrganization(t.owner(), t.organization(), invoice);
    assertThat(visible).containsEntry("status", "ISSUED");
    assertThat(((Map<?, ?>) visible.get("bill_to")).get("name")).isEqualTo("Acme Ltd");

    invoices.markPaid(admin, invoice, LocalDate.now(), "Bank transfer", "TX-1");
    assertThat(invoices.detail(admin, invoice)).containsEntry("status", "PAID");
    assertThatThrownBy(() -> invoices.voidInvoice(admin, invoice, "Oops"))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
    assertThatThrownBy(
            () ->
                invoices.create(
                    t.owner(), t.organization(), "x", BigDecimal.ONE, null, null, null, null))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }

  @Test
  void suspendingAnOrganizationLocksItAndReactivationRestoresAccess() {
    Tenant t = managed();
    subscriptions.assign(
        admin,
        t.organization(),
        STARTER,
        SubscriptionService.Status.SUSPENDED,
        SubscriptionService.Cycle.MONTHLY,
        null,
        null);
    assertThatThrownBy(() -> tenants.createBuilding(t.owner(), t.organization(), "X", "X"))
        .isInstanceOf(ApiException.class);
    assertThat(subscriptions.overview(t.owner(), t.organization()))
        .containsEntry("status", "SUSPENDED");

    subscriptions.assign(
        admin,
        t.organization(),
        STARTER,
        SubscriptionService.Status.ACTIVE,
        SubscriptionService.Cycle.MONTHLY,
        null,
        null);
    tenants.createBuilding(t.owner(), t.organization(), "X", "X");
  }

  @Test
  void automationRenewsElapsedPeriodsAndFlagsOverdueInvoices() {
    Tenant t = managed();
    asAdmin(
        t.organization(),
        "update organization_subscriptions set current_period_start=current_date-40,current_period_end=current_date-10 where organization_id=?",
        t.organization());

    automation.run();

    var sub = subscriptions.overview(t.owner(), t.organization());
    assertThat(((java.sql.Date) sub.get("current_period_end")).toLocalDate())
        .isAfter(LocalDate.now());
    var issued = invoices.forOrganization(t.owner(), t.organization(), 0);
    assertThat(issued).hasSize(1);
    assertThat(issued.getFirst()).containsEntry("status", "ISSUED");

    asAdmin(
        t.organization(),
        "update saas_invoices set issued_on=current_date-30,due_on=current_date-1 where organization_id=?",
        t.organization());
    asAdmin(
        null,
        "update automation_runs set scheduled_for=scheduled_for-interval '1 hour' where job_key='billing'");
    automation.run();

    assertThat(invoices.forOrganization(t.owner(), t.organization(), 0).getFirst())
        .containsEntry("status", "OVERDUE");
    assertThat(subscriptions.status(t.owner(), t.organization()))
        .containsEntry("status", "PAST_DUE")
        .containsEntry("writable", true);

    UUID invoice = (UUID) issued.getFirst().get("id");
    invoices.markPaid(admin, invoice, null, "Card", null);
    assertThat(subscriptions.status(t.owner(), t.organization())).containsEntry("status", "ACTIVE");
  }
}
