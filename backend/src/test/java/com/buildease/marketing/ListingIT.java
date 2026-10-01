package com.buildease.marketing;

import static org.assertj.core.api.Assertions.*;

import com.buildease.auth.Actor;
import com.buildease.building.*;
import com.buildease.common.ApiException;
import com.buildease.common.Store;
import com.buildease.security.Role;
import com.buildease.tenancy.TenantService;
import java.math.BigDecimal;
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
class ListingIT {
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
  @Autowired ListingService listings;
  @Autowired com.buildease.crm.ProspectService prospects;
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
    var tokens = auth.login(email, password, "listing-" + email);
    db.update("update accounts set must_change_password=false where email=?", email);
    return auth.authenticate(decoder.decode(tokens.accessToken()));
  }

  private record Setup(UUID organization, UUID building, UUID space, Actor owner) {}

  private Setup organizationWithVacantSpace() {
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

  @Test
  void publishingAListingSyndicatesToEveryRequestedChannel() {
    Setup s = organizationWithVacantSpace();
    UUID listing =
        listings.create(
            s.owner(),
            s.organization(),
            s.building(),
            s.space(),
            "Bright 1BR near the harbor",
            "Freshly renovated, available now.",
            new BigDecimal("1200.00"));

    listings.publish(
        s.owner(),
        s.organization(),
        s.building(),
        listing,
        Set.of(ListingChannel.ZILLOW, ListingChannel.APARTMENTS_COM));

    var detail = listings.detail(s.owner(), s.organization(), s.building(), listing);
    assertThat(detail).containsEntry("status", "PUBLISHED");
    @SuppressWarnings("unchecked")
    var syndications = (java.util.List<java.util.Map<String, Object>>) detail.get("syndications");
    assertThat(syndications).hasSize(2);
    assertThat(syndications)
        .allSatisfy(row -> assertThat(row).containsEntry("status", "SYNDICATED"));
  }

  @Test
  void onlyOnePublishedListingIsAllowedPerSpace() {
    Setup s = organizationWithVacantSpace();
    UUID first =
        listings.create(
            s.owner(),
            s.organization(),
            s.building(),
            s.space(),
            "Bright 1BR",
            "Available now.",
            new BigDecimal("1200.00"));
    listings.publish(
        s.owner(), s.organization(), s.building(), first, Set.of(ListingChannel.ZILLOW));

    UUID second =
        listings.create(
            s.owner(),
            s.organization(),
            s.building(),
            s.space(),
            "Bright 1BR (again)",
            "Available now.",
            new BigDecimal("1250.00"));
    assertThatThrownBy(
            () ->
                listings.publish(
                    s.owner(),
                    s.organization(),
                    s.building(),
                    second,
                    Set.of(ListingChannel.ZILLOW)))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
  }

  @Test
  void unpublishingRemovesFromEverySyndicatedChannel() {
    Setup s = organizationWithVacantSpace();
    UUID listing =
        listings.create(
            s.owner(),
            s.organization(),
            s.building(),
            s.space(),
            "Bright 1BR",
            "Available now.",
            new BigDecimal("1200.00"));
    listings.publish(
        s.owner(), s.organization(), s.building(), listing, Set.of(ListingChannel.ZILLOW));

    listings.unpublish(s.owner(), s.organization(), s.building(), listing);

    var detail = listings.detail(s.owner(), s.organization(), s.building(), listing);
    assertThat(detail).containsEntry("status", "UNPUBLISHED");
    @SuppressWarnings("unchecked")
    var syndications = (java.util.List<java.util.Map<String, Object>>) detail.get("syndications");
    assertThat(syndications.getFirst()).containsEntry("status", "REMOVED");
  }

  private UUID draftListing(Setup s) {
    return listings.create(
        s.owner(),
        s.organization(),
        s.building(),
        s.space(),
        "Bright 1BR",
        "Available now.",
        new BigDecimal("1200.00"));
  }

  @Test
  void editingAListingChangesItsTextAndRentButNotWhilePublished() {
    Setup s = organizationWithVacantSpace();
    UUID listing = draftListing(s);

    listings.update(
        s.owner(),
        s.organization(),
        s.building(),
        listing,
        "  Renovated 1BR  ",
        "New kitchen.",
        new BigDecimal("1350.50"));

    var detail = listings.detail(s.owner(), s.organization(), s.building(), listing);
    assertThat(detail)
        .containsEntry("headline", "Renovated 1BR")
        .containsEntry("description", "New kitchen.")
        .containsEntry("rent_amount", new BigDecimal("1350.50"));

    listings.publish(
        s.owner(), s.organization(), s.building(), listing, Set.of(ListingChannel.ZILLOW));
    assertThatThrownBy(
            () ->
                listings.update(
                    s.owner(),
                    s.organization(),
                    s.building(),
                    listing,
                    "Changed while live",
                    "Nope.",
                    new BigDecimal("1.00")))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));

    listings.unpublish(s.owner(), s.organization(), s.building(), listing);
    listings.update(
        s.owner(),
        s.organization(),
        s.building(),
        listing,
        "Editable again",
        "Back to draft text.",
        new BigDecimal("1300.00"));
    assertThat(listings.detail(s.owner(), s.organization(), s.building(), listing))
        .containsEntry("headline", "Editable again");
  }

  @Test
  void deletingRemovesTheListingAndItsSyndicationHistory() {
    Setup s = organizationWithVacantSpace();
    UUID neverPublished = draftListing(s);
    listings.delete(s.owner(), s.organization(), s.building(), neverPublished);
    assertThatThrownBy(
            () -> listings.detail(s.owner(), s.organization(), s.building(), neverPublished))
        .isInstanceOf(ApiException.class);

    UUID wasPublished = draftListing(s);
    listings.publish(
        s.owner(), s.organization(), s.building(), wasPublished, Set.of(ListingChannel.ZILLOW));
    listings.unpublish(s.owner(), s.organization(), s.building(), wasPublished);
    listings.delete(s.owner(), s.organization(), s.building(), wasPublished);

    assertThatThrownBy(
            () -> listings.detail(s.owner(), s.organization(), s.building(), wasPublished))
        .isInstanceOf(ApiException.class);
    assertThat(
            listings.list(s.owner(), s.organization(), s.building(), null, 0).stream()
                .map(row -> row.get("id")))
        .doesNotContain(neverPublished, wasPublished);
    assertThat(db.find("select 1 from listing_syndications where listing_id=?", wasPublished))
        .isEmpty();
  }

  @Test
  void aPublishedListingCannotBeDeleted() {
    Setup s = organizationWithVacantSpace();
    UUID listing = draftListing(s);
    listings.publish(
        s.owner(), s.organization(), s.building(), listing, Set.of(ListingChannel.ZILLOW));

    assertThatThrownBy(() -> listings.delete(s.owner(), s.organization(), s.building(), listing))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
    assertThat(listings.detail(s.owner(), s.organization(), s.building(), listing))
        .containsEntry("status", "PUBLISHED");
  }

  @Test
  void aListingWithProspectsCannotBeDeleted() {
    Setup s = organizationWithVacantSpace();
    UUID listing = draftListing(s);
    prospects.create(
        s.owner(),
        s.organization(),
        s.building(),
        s.space(),
        listing,
        "Jane Prospect",
        null,
        null,
        null);

    assertThatThrownBy(() -> listings.delete(s.owner(), s.organization(), s.building(), listing))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
    assertThat(listings.detail(s.owner(), s.organization(), s.building(), listing))
        .containsEntry("status", "DRAFT");
  }

  @Test
  void nonManagerCannotEditOrDeleteListings() {
    Setup s = organizationWithVacantSpace();
    UUID listing = draftListing(s);
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
                listings.update(
                    tenant,
                    s.organization(),
                    s.building(),
                    listing,
                    "Hacked",
                    "Nope.",
                    new BigDecimal("1.00")))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
    assertThatThrownBy(() -> listings.delete(tenant, s.organization(), s.building(), listing))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }

  @Test
  void cannotListASpaceThatIsNotRentableOrNotVacant() {
    Setup s = organizationWithVacantSpace();
    UUID occupiedSpace =
        buildings.createSpace(
            s.owner(),
            s.organization(),
            s.building(),
            null,
            null,
            "Storage",
            "ST1",
            SpaceType.STORAGE,
            false,
            null,
            null,
            null);
    assertThatThrownBy(
            () ->
                listings.create(
                    s.owner(),
                    s.organization(),
                    s.building(),
                    occupiedSpace,
                    "Storage unit",
                    "Not really rentable.",
                    new BigDecimal("50.00")))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(409));
  }

  @Test
  void nonManagerCannotCreateOrPublishListings() {
    Setup s = organizationWithVacantSpace();
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
                listings.create(
                    tenant,
                    s.organization(),
                    s.building(),
                    s.space(),
                    "Bright 1BR",
                    "Available now.",
                    new BigDecimal("1200.00")))
        .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status).isEqualTo(403));
  }
}
