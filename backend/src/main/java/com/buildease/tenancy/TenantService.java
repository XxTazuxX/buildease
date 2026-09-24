package com.buildease.tenancy;

import com.buildease.auth.*;
import com.buildease.common.*;
import com.buildease.security.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class TenantService {
  private final Store db;
  private final PasswordEncoder passwords;

  public TenantService(Store db, PasswordEncoder passwords) {
    this.db = db;
    this.passwords = passwords;
  }

  private void platform(Actor a) {
    if (!a.admin()
        || db.find("select 1 from accounts where id=? and active and platform_admin", a.id())
            .isEmpty()) throw ApiException.forbidden();
    db.context(a.id(), null, a.impersonatedBy());
  }

  private boolean enter(Actor a, UUID org) {
    db.context(a.id(), null, a.impersonatedBy());
    var membership =
        db.find(
            "select * from memberships where organization_id=? and account_id=? and status='ACTIVE'",
            org,
            a.id());
    if (!a.admin() && membership.isEmpty()) throw ApiException.forbidden();
    db.context(a.id(), org, a.impersonatedBy());
    var organization = db.one("select * from organizations where id=? for update", org);
    if (!(boolean) organization.get("active")) throw ApiException.forbidden();
    membership =
        db.find(
            "select * from memberships where organization_id=? and account_id=? and status='ACTIVE'",
            org,
            a.id());
    if (db.find("select 1 from accounts where id=? and active", a.id()).isEmpty()
        || (!a.admin() && membership.isEmpty())) throw ApiException.forbidden();
    return a.admin() || membership.map(m -> (boolean) m.get("owner")).orElse(false);
  }

  private boolean manager(Actor a, UUID org, UUID building) {
    return db.find(
            "select 1 from building_roles where organization_id=? and building_id=? and account_id=? and role='PROPERTY_MANAGER'",
            org,
            building,
            a.id())
        .isPresent();
  }

  private void owner(Actor a, UUID org) {
    if (!enter(a, org)) throw ApiException.forbidden();
  }

  private UUID account(String email, String name, String temporaryPassword) {
    var existing = db.find("select id from accounts where email=?", AuthService.email(email));
    if (existing.isPresent()) return Store.id(existing.get(), "id");
    PasswordPolicy.validate(temporaryPassword);
    UUID id = UUID.randomUUID();
    db.update(
        "insert into accounts(id,email,display_name,password_hash,temporary_password_expires_at) values (?,?,?,?,now()+interval '24 hours')",
        id,
        AuthService.email(email),
        name,
        passwords.encode(temporaryPassword));
    return id;
  }

  private void member(Actor a, UUID org, UUID user, boolean isOwner, boolean existing) {
    db.update(
        "insert into memberships(organization_id,account_id,owner,status) values (?,?,?,?) on conflict (organization_id,account_id) do update set owner=EXCLUDED.owner,status=EXCLUDED.status where memberships.status='REMOVED'",
        org,
        user,
        isOwner,
        existing ? "PENDING" : "ACTIVE");
    db.audit(a.id(), org, "MEMBER_INVITED", user);
  }

  public List<Map<String, Object>> organizations(Actor a, int page) {
    platform(a);
    return db.rows(
        "select id,name,active from organizations order by name,id limit 50 offset ?",
        offset(page));
  }

  public Map<String, Object> createOrganization(
      Actor a, String name, String email, String ownerName, String temporaryPassword) {
    platform(a);
    UUID org = UUID.randomUUID();
    boolean existing =
        db.find("select id from accounts where email=?", AuthService.email(email)).isPresent();
    UUID user = account(email, ownerName, temporaryPassword);
    db.update("insert into organizations(id,name) values (?,?)", org, name);
    db.context(a.id(), org, a.impersonatedBy());
    member(a, org, user, true, existing);
    db.audit(a.id(), org, "ORGANIZATION_CREATED", org);
    return Map.of("id", org);
  }

  public void organizationActive(Actor a, UUID org, boolean active) {
    platform(a);
    db.one("select id from organizations where id=? for update", org);
    db.update("update organizations set active=? where id=?", active, org);
    db.audit(a.id(), org, "ORGANIZATION_STATUS", org);
  }

  public List<Map<String, Object>> accounts(Actor a, int page) {
    platform(a);
    return db.rows(
        "select id,email,display_name,active,platform_admin,must_change_password from accounts order by email limit 50 offset ?",
        offset(page));
  }

  // Deliberately does not email the new account; the admin relays the temporary password out of
  // band. Only self-registration/forgot-password (OnboardingService) send email.
  public Map<String, Object> createAccount(
      Actor a, String email, String name, String password, boolean admin) {
    platform(a);
    if (db.find("select id from accounts where email=?", AuthService.email(email)).isPresent())
      throw new ApiException(409, "Account already exists");
    UUID id = account(email, name, password);
    db.update("update accounts set platform_admin=? where id=?", admin, id);
    db.audit(a.id(), null, "ACCOUNT_CREATED", id);
    return Map.of("id", id);
  }

  public void accountStatus(Actor a, UUID id, boolean active) {
    platform(a);
    // Lock organizations before accounts, matching membership operations, to serialize owner
    // removals.
    db.rows("select id from organizations order by id for update");
    db.rows("select id from accounts where platform_admin order by id for update");
    var target = db.one("select * from accounts where id=? for update", id);
    if (!active
        && (boolean) target.get("platform_admin")
        && (boolean) target.get("active")
        && ((Number)
                    db.one("select count(*) as n from accounts where active and platform_admin")
                        .get("n"))
                .longValue()
            <= 1) throw new ApiException(409, "The last platform administrator must remain active");
    if (!active
        && (boolean) target.get("active")
        && db.find(
                "select 1 from memberships m where m.account_id=? and m.owner and m.status='ACTIVE' and not exists (select 1 from memberships other join accounts x on x.id=other.account_id where other.organization_id=m.organization_id and other.account_id<>m.account_id and other.owner and other.status='ACTIVE' and x.active)",
                id)
            .isPresent())
      throw new ApiException(409, "Appoint another active owner before disabling this account");
    db.update("update accounts set active=? where id=?", active, id);
    db.update("update auth_sessions set revoked=true where account_id=?", id);
    db.audit(a.id(), null, "ACCOUNT_STATUS", id);
  }

  // Deliberately does not email the target account; the admin relays the temporary password
  // out of band. Only self-registration/forgot-password (OnboardingService) send email.
  public void reset(Actor a, UUID id, String password) {
    platform(a);
    PasswordPolicy.validate(password);
    db.one("select id from accounts where id=? for update", id);
    db.update(
        "update accounts set password_hash=?,must_change_password=true,temporary_password_expires_at=now()+interval '24 hours' where id=?",
        passwords.encode(password),
        id);
    db.update("update auth_sessions set revoked=true where account_id=?", id);
    db.audit(a.id(), null, "PASSWORD_RESET", id);
  }

  public Map<String, Object> overview(Actor a, UUID org) {
    boolean owner = enter(a, org);
    var roles =
        db.rows(
            "select building_id,role from building_roles where organization_id=? and account_id=?",
            org,
            a.id());
    return Map.of("owner", owner, "roles", roles);
  }

  public Map<String, Object> dashboard(Actor a, UUID org) {
    boolean owner = enter(a, org);
    Set<String> actorRoles = new HashSet<>();
    db.rows(
            "select distinct role from building_roles where organization_id=? and account_id=?",
            org,
            a.id())
        .forEach(row -> actorRoles.add((String) row.get("role")));

    String visibleBuildings =
        owner
            ? "true"
            : "exists(select 1 from building_roles own where own.organization_id=b.organization_id and own.building_id=b.id and own.account_id=?)";
    Object[] visibleArgs = owner ? new Object[] {org} : new Object[] {org, a.id()};
    Number buildingCount =
        number(
            "select count(*) value from buildings b where b.organization_id=? and "
                + visibleBuildings,
            visibleArgs);

    String visibleSpaces =
        owner
            ? "true"
            : "exists(select 1 from building_roles own where own.organization_id=s.organization_id and own.building_id=s.building_id and own.account_id=?)";
    Object[] spaceArgs = owner ? new Object[] {org} : new Object[] {org, a.id()};
    Map<String, Object> properties = new LinkedHashMap<>();
    properties.put("building_count", buildingCount);
    properties.put(
        "space_count",
        number(
            "select count(*) value from spaces s where s.organization_id=? and " + visibleSpaces,
            spaceArgs));
    properties.put(
        "occupied_space_count",
        number(
            "select count(*) value from spaces s where s.organization_id=? and s.status='OCCUPIED' and "
                + visibleSpaces,
            spaceArgs));
    properties.put(
        "vacant_space_count",
        number(
            "select count(*) value from spaces s where s.organization_id=? and s.status='VACANT' and "
                + visibleSpaces,
            spaceArgs));

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("properties", properties);
    result.put(
        "people",
        owner || actorRoles.contains("PROPERTY_MANAGER") ? peopleDashboard(a, org, owner) : null);
    result.put(
        "finance",
        owner || actorRoles.contains("PROPERTY_MANAGER") || actorRoles.contains("ACCOUNTANT")
            ? financeDashboard(a, org, owner)
            : null);
    result.put(
        "maintenance",
        owner
                || actorRoles.contains("PROPERTY_MANAGER")
                || actorRoles.contains("MAINTENANCE_STAFF")
                || actorRoles.contains("SECURITY_OPERATIONS_STAFF")
                || actorRoles.contains("VENDOR")
            ? maintenanceDashboard(a, org, owner)
            : null);
    return result;
  }

  private Map<String, Object> peopleDashboard(Actor actor, UUID org, boolean owner) {
    String managedBuildings =
        "select building_id from building_roles where organization_id=? and account_id=? and role='PROPERTY_MANAGER'";
    Map<String, Object> people = new LinkedHashMap<>();
    people.put(
        "active_member_count",
        owner
            ? number(
                "select count(*) value from memberships where organization_id=? and status='ACTIVE'",
                org)
            : number(
                "select count(distinct m.account_id) value from memberships m join building_roles r on r.organization_id=m.organization_id and r.account_id=m.account_id where m.organization_id=? and m.status='ACTIVE' and r.building_id in ("
                    + managedBuildings
                    + ")",
                org,
                org,
                actor.id()));
    people.put(
        "active_resident_count",
        owner
            ? number("select count(*) value from residents where organization_id=? and active", org)
            : number(
                "select count(*) value from residents where organization_id=? and active and building_id in ("
                    + managedBuildings
                    + ")",
                org,
                org,
                actor.id()));
    people.put(
        "active_assignment_count",
        owner
            ? number(
                "select count(*) value from space_assignments where organization_id=? and status='ACTIVE'",
                org)
            : number(
                "select count(*) value from space_assignments where organization_id=? and status='ACTIVE' and building_id in ("
                    + managedBuildings
                    + ")",
                org,
                org,
                actor.id()));
    return people;
  }

  private Map<String, Object> financeDashboard(Actor actor, UUID org, boolean owner) {
    String financeBuildings =
        "select building_id from building_roles where organization_id=? and account_id=? and role in ('PROPERTY_MANAGER','ACCOUNTANT')";
    Map<String, Object> finance = new LinkedHashMap<>();
    finance.put(
        "active_lease_count",
        owner
            ? number(
                "select count(*) value from leases where organization_id=? and status='ACTIVE'",
                org)
            : number(
                "select count(*) value from leases where organization_id=? and status='ACTIVE' and building_id in ("
                    + financeBuildings
                    + ")",
                org,
                org,
                actor.id()));

    Map<String, BigDecimal> balances = new TreeMap<>();
    String chargeSql =
        "select currency,sum(amount) amount from charges where organization_id=?"
            + (owner ? "" : " and building_id in (" + financeBuildings + ")")
            + " group by currency";
    String paymentSql =
        "select currency,sum(amount) amount from payments where organization_id=?"
            + (owner ? "" : " and building_id in (" + financeBuildings + ")")
            + " group by currency";
    Object[] financeArgs = owner ? new Object[] {org} : new Object[] {org, org, actor.id()};
    db.rows(chargeSql, financeArgs)
        .forEach(
            row ->
                balances.merge(
                    (String) row.get("currency"), (BigDecimal) row.get("amount"), BigDecimal::add));
    db.rows(paymentSql, financeArgs)
        .forEach(
            row ->
                balances.merge(
                    (String) row.get("currency"),
                    ((BigDecimal) row.get("amount")).negate(),
                    BigDecimal::add));
    finance.put(
        "balance_by_currency",
        balances.entrySet().stream()
            .map(
                entry ->
                    Map.<String, Object>of(
                        "currency", entry.getKey(), "amount", entry.getValue().toPlainString()))
            .toList());
    return finance;
  }

  private Map<String, Object> maintenanceDashboard(Actor actor, UUID org, boolean owner) {
    String scope;
    Object[] args;
    if (owner) {
      scope = "true";
      args = new Object[] {org};
    } else {
      scope =
          "(r.building_id in (select building_id from building_roles where organization_id=? and account_id=? and role='PROPERTY_MANAGER')"
              + " or exists(select 1 from work_orders w where w.request_id=r.id and w.assigned_account_id=?)"
              + " or exists(select 1 from work_orders w join vendor_accounts va on va.organization_id=w.organization_id and va.building_id=w.building_id and va.vendor_id=w.vendor_id where w.request_id=r.id and va.account_id=?))";
      args = new Object[] {org, org, actor.id(), actor.id(), actor.id()};
    }
    Map<String, Object> maintenance = new LinkedHashMap<>();
    maintenance.put(
        "open_request_count",
        number(
            "select count(*) value from maintenance_requests r where r.organization_id=? and r.status not in ('CLOSED','CANCELLED') and "
                + scope,
            args));
    maintenance.put(
        "overdue_request_count",
        number(
            "select count(*) value from maintenance_requests r where r.organization_id=? and r.status not in ('CLOSED','CANCELLED') and r.resolution_due_at<now() and "
                + scope,
            args));
    return maintenance;
  }

  private Number number(String sql, Object... args) {
    return (Number) db.one(sql, args).get("value");
  }

  public List<Map<String, Object>> buildings(Actor a, UUID org, int page) {
    boolean owner = enter(a, org);
    return db.rows(
        "select b.id,b.name,b.code from buildings b where organization_id=? and (? or exists(select 1 from building_roles r where r.organization_id=b.organization_id and r.building_id=b.id and r.account_id=?)) order by b.name,b.id limit 50 offset ?",
        org,
        owner,
        a.id(),
        offset(page));
  }

  public Map<String, Object> createBuilding(Actor a, UUID org, String name, String code) {
    owner(a, org);
    UUID id = UUID.randomUUID();
    db.update(
        "insert into buildings(id,organization_id,name,code) values (?,?,?,?)",
        id,
        org,
        name,
        code);
    db.audit(a.id(), org, "BUILDING_CREATED", id);
    return Map.of("id", id);
  }

  public List<Map<String, Object>> members(Actor a, UUID org, UUID building, int page) {
    boolean owner = enter(a, org);
    if (!owner && (building == null || !manager(a, org, building))) throw ApiException.forbidden();
    if (building == null) {
      return db.rows(
          "select m.account_id,a.email,coalesce(m.display_name,a.display_name) display_name,m.owner,m.status from memberships m join accounts a on a.id=m.account_id where m.organization_id=? and m.status<>'REMOVED' order by a.email limit 50 offset ?",
          org,
          offset(page));
    }
    db.one("select id from buildings where id=? and organization_id=?", building, org);
    return db.rows(
        "select m.account_id,a.email,coalesce(m.display_name,a.display_name) display_name,m.owner,m.status from memberships m join accounts a on a.id=m.account_id where m.organization_id=? and m.status<>'REMOVED' and (? or exists(select 1 from building_roles r where r.organization_id=m.organization_id and r.account_id=m.account_id and r.building_id=?)) order by a.email limit 50 offset ?",
        org,
        owner,
        building,
        offset(page));
  }

  public Map<String, Object> invite(
      Actor a,
      UUID org,
      String email,
      String name,
      String password,
      boolean makeOwner,
      UUID building,
      Set<Role> roles) {
    boolean owner = enter(a, org);
    if (!owner && (makeOwner || building == null || !manager(a, org, building)))
      throw ApiException.forbidden();
    if (building == null && !roles.isEmpty())
      throw new ApiException(400, "Building required for roles");
    for (Role r : roles) if (!RolePolicy.mayGrant(owner, !owner, r)) throw ApiException.forbidden();
    if (!owner && roles.isEmpty()) throw new ApiException(400, "Select at least one role");
    boolean existing =
        db.find("select id from accounts where email=?", AuthService.email(email)).isPresent();
    UUID user = account(email, name, password);
    var current =
        db.find("select * from memberships where organization_id=? and account_id=?", org, user);
    if (current.isPresent() && !current.get().get("status").equals("REMOVED")) {
      if (building == null)
        throw new ApiException(409, "Membership already exists; edit its owner role instead");
      replaceRolesInternal(a, org, building, user, roles, owner);
      return Map.of("id", user, "status", current.get().get("status"));
    }
    member(a, org, user, makeOwner, existing);
    if (building != null) replaceRolesInternal(a, org, building, user, roles, owner);
    return Map.of("id", user, "status", existing ? "PENDING" : "ACTIVE");
  }

  public void accept(Actor a, UUID org) {
    db.context(a.id(), null, a.impersonatedBy());
    db.one(
        "select * from memberships where account_id=? and organization_id=? and status='PENDING'",
        a.id(),
        org);
    db.context(a.id(), org, a.impersonatedBy());
    db.one("select id from organizations where id=? and active for update", org);
    db.update(
        "update memberships set status='ACTIVE' where account_id=? and organization_id=? and status='PENDING'",
        a.id(),
        org);
    db.audit(a.id(), org, "INVITATION_ACCEPTED", a.id());
  }

  public void updateMemberProfile(Actor actor, UUID organization, UUID user, String displayName) {
    owner(actor, organization);
    db.one(
        "select 1 from memberships where organization_id=? and account_id=? and status<>'REMOVED' for update",
        organization,
        user);
    db.update(
        "update memberships set display_name=? where organization_id=? and account_id=?",
        displayName.trim(),
        organization,
        user);
    db.audit(actor.id(), organization, "MEMBER_PROFILE_CHANGED", user);
  }

  public void membership(Actor a, UUID org, UUID user, boolean makeOwner, boolean removed) {
    owner(a, org);
    if (a.id().equals(user)) throw ApiException.forbidden();
    var m =
        db.one(
            "select * from memberships where organization_id=? and account_id=? for update",
            org,
            user);
    if ((boolean) m.get("owner") && m.get("status").equals("ACTIVE") && (removed || !makeOwner)) {
      long owners =
          ((Number)
                  db.one(
                          "select count(*) n from memberships m join accounts a on a.id=m.account_id where m.organization_id=? and m.owner and m.status='ACTIVE' and a.active",
                          org)
                      .get("n"))
              .longValue();
      if (owners <= 1) throw new ApiException(409, "The last active owner must remain");
    }
    db.update(
        "update memberships set owner=?,status=case when ? then 'REMOVED' else status end where organization_id=? and account_id=?",
        makeOwner,
        removed,
        org,
        user);
    if (removed)
      db.update("delete from building_roles where organization_id=? and account_id=?", org, user);
    db.audit(a.id(), org, "MEMBERSHIP_CHANGED", user);
  }

  public List<Map<String, Object>> roles(Actor a, UUID org, UUID building, UUID user) {
    boolean owner = enter(a, org);
    if (!owner && !manager(a, org, building) && !a.id().equals(user))
      throw ApiException.forbidden();
    return db.rows(
        "select role from building_roles where organization_id=? and building_id=? and account_id=?",
        org,
        building,
        user);
  }

  public void replaceRoles(Actor a, UUID org, UUID building, UUID user, Set<Role> roles) {
    boolean owner = enter(a, org);
    replaceRolesInternal(a, org, building, user, roles, owner);
  }

  private void replaceRolesInternal(
      Actor a, UUID org, UUID building, UUID user, Set<Role> roles, boolean owner) {
    if (a.id().equals(user)) throw ApiException.forbidden();
    boolean manager = manager(a, org, building);
    if (!owner && !manager) throw ApiException.forbidden();
    db.one("select id from buildings where organization_id=? and id=?", org, building);
    var membership =
        db.one(
            "select * from memberships where organization_id=? and account_id=? and status<>'REMOVED'",
            org,
            user);
    if (!owner
        && ((boolean) membership.get("owner")
            || db.find(
                    "select 1 from building_roles where organization_id=? and building_id=? and account_id=? and role='PROPERTY_MANAGER'",
                    org,
                    building,
                    user)
                .isPresent())) throw ApiException.forbidden();
    for (Role role : roles)
      if (!RolePolicy.mayGrant(owner, manager, role)) throw ApiException.forbidden();
    db.update(
        "delete from building_roles where organization_id=? and building_id=? and account_id=?",
        org,
        building,
        user);
    for (Role role : roles)
      db.update(
          "insert into building_roles(organization_id,building_id,account_id,role) values (?,?,?,?)",
          org,
          building,
          user,
          role.name());
    db.audit(a.id(), org, "BUILDING_ROLES_CHANGED", user);
  }

  public List<Map<String, Object>> audit(Actor a, UUID org, int page) {
    owner(a, org);
    return db.rows(
        "select actor_id,action,target_id,created_at from audit_events where organization_id=? order by created_at desc,id limit 50 offset ?",
        org,
        offset(page));
  }

  public List<Map<String, Object>> platformAudit(
      Actor a, int page, UUID organization, UUID actorFilter) {
    platform(a);
    return db.rows(
        "select actor_id,action,target_id,organization_id,impersonated_by,created_at from audit_events "
            + "where (?::uuid is null or organization_id=?) and (?::uuid is null or actor_id=?) "
            + "order by created_at desc,id limit 50 offset ?",
        organization,
        organization,
        actorFilter,
        actorFilter,
        offset(page));
  }

  private int offset(int page) {
    if (page < 0 || page > 10000) throw new IllegalArgumentException("Invalid page");
    return page * 50;
  }
}
