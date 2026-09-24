package com.buildease.maintenance;

import com.buildease.auth.Actor;
import com.buildease.common.*;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class MaintenanceService {
  private final Store db;

  public MaintenanceService(Store db) {
    this.db = db;
  }

  private Access enter(Actor actor, UUID organization, UUID building) {
    db.context(actor.id(), null, actor.impersonatedBy());
    var membership =
        db.find(
            "select owner from memberships where organization_id=? and account_id=? and status='ACTIVE'",
            organization,
            actor.id());
    if (!actor.admin() && membership.isEmpty()) throw ApiException.forbidden();
    db.context(actor.id(), organization, actor.impersonatedBy());
    db.one("select id from organizations where id=? and active for update", organization);
    db.one("select id from buildings where organization_id=? and id=?", organization, building);
    Set<String> roles = new HashSet<>();
    db.rows(
            "select role from building_roles where organization_id=? and building_id=? and account_id=?",
            organization,
            building,
            actor.id())
        .forEach(row -> roles.add((String) row.get("role")));
    boolean owner =
        actor.admin() || membership.map(row -> (boolean) row.get("owner")).orElse(false);
    return new Access(owner, owner || roles.contains("PROPERTY_MANAGER"), roles);
  }

  private Access manager(Actor actor, UUID organization, UUID building) {
    Access access = enter(actor, organization, building);
    if (!access.manager()) throw ApiException.forbidden();
    return access;
  }

  public UUID createCategory(
      Actor actor,
      UUID organization,
      UUID building,
      String name,
      int responseHours,
      int resolutionHours) {
    manager(actor, organization, building);
    if (resolutionHours < responseHours)
      throw new ApiException(400, "Resolution target must not precede response target");
    UUID id = UUID.randomUUID();
    db.update(
        "insert into maintenance_categories(id,organization_id,building_id,name,default_priority,response_minutes,resolution_minutes) values (?,?,?,?,?,?,?)",
        id,
        organization,
        building,
        name.trim(),
        Priority.MEDIUM.name(),
        responseHours * 60,
        resolutionHours * 60);
    db.audit(actor.id(), organization, "MAINTENANCE_CATEGORY_CREATED", id);
    return id;
  }

  public void updateCategory(
      Actor actor,
      UUID organization,
      UUID building,
      UUID category,
      String name,
      int responseHours,
      int resolutionHours) {
    manager(actor, organization, building);
    if (resolutionHours < responseHours)
      throw new ApiException(400, "Resolution target must not precede response target");
    db.one(
        "select id from maintenance_categories where organization_id=? and building_id=? and id=? and active for update",
        organization,
        building,
        category);
    db.update(
        "update maintenance_categories set name=?,response_minutes=?,resolution_minutes=? where organization_id=? and building_id=? and id=?",
        name.trim(),
        responseHours * 60,
        resolutionHours * 60,
        organization,
        building,
        category);
    db.audit(actor.id(), organization, "MAINTENANCE_CATEGORY_UPDATED", category);
  }

  public List<Map<String, Object>> categories(Actor actor, UUID organization, UUID building) {
    enter(actor, organization, building);
    return db.rows(
        "select id,name,default_priority,response_minutes,resolution_minutes,active from maintenance_categories where organization_id=? and building_id=? and active order by name",
        organization,
        building);
  }

  public UUID submit(
      Actor actor,
      UUID organization,
      UUID building,
      UUID space,
      UUID category,
      String title,
      String description,
      Impact impact,
      boolean danger) {
    Access access = enter(actor, organization, building);
    db.one(
        "select id from spaces where organization_id=? and building_id=? and id=?",
        organization,
        building,
        space);
    var policy =
        db.one(
            "select * from maintenance_categories where organization_id=? and building_id=? and id=? and active",
            organization,
            building,
            category);
    UUID resident = null;
    if (!access.manager()) {
      if (!access.roles().contains("TENANT")) throw ApiException.forbidden();
      var assignment =
          db.find(
                  "select r.id from residents r join space_assignments s on s.resident_id=r.id and s.status='ACTIVE' where r.organization_id=? and r.building_id=? and r.account_id=? and s.space_id=? and r.active",
                  organization,
                  building,
                  actor.id(),
                  space)
              .orElseThrow(ApiException::forbidden);
      resident = Store.id(assignment, "id");
    }
    Priority suggested =
        suggest(Priority.valueOf((String) policy.get("default_priority")), impact, danger);
    UUID id = UUID.randomUUID();
    db.update(
        "insert into maintenance_requests(id,organization_id,building_id,space_id,resident_id,category_id,created_by,title,description,impact,danger,suggested_priority,status) values (?,?,?,?,?,?,?,?,?,?,?,?,'SUBMITTED')",
        id,
        organization,
        building,
        space,
        resident,
        category,
        actor.id(),
        title.trim(),
        description.trim(),
        impact.name(),
        danger,
        suggested.name());
    history(actor, organization, building, id, null, RequestStatus.SUBMITTED, null);
    notifyManagers(organization, building, id, "New maintenance request", "request:new:" + id);
    db.audit(actor.id(), organization, "MAINTENANCE_REQUEST_SUBMITTED", id);
    return id;
  }

  public List<Map<String, Object>> requests(
      Actor actor,
      UUID organization,
      UUID building,
      RequestStatus status,
      Priority priority,
      int page) {
    Access access = enter(actor, organization, building);
    if (page < 0 || page > 10000) throw new ApiException(400, "Invalid page");
    String scope;
    List<Object> args = new ArrayList<>(List.of(organization, building));
    if (access.manager()) scope = "true";
    else if (access.roles().contains("TENANT")) {
      scope =
          "r.resident_id in (select id from residents where account_id=? and organization_id=? and building_id=?)";
      args.add(actor.id());
      args.add(organization);
      args.add(building);
    } else if (access.roles().contains("VENDOR")) {
      scope =
          "exists(select 1 from work_orders w join vendor_accounts va on va.vendor_id=w.vendor_id and va.organization_id=w.organization_id and va.building_id=w.building_id where w.request_id=r.id and va.account_id=?)";
      args.add(actor.id());
    } else {
      scope =
          "exists(select 1 from work_orders w where w.request_id=r.id and w.assigned_account_id=?)";
      args.add(actor.id());
    }
    StringBuilder sql =
        new StringBuilder(
                "select r.id,r.space_id,r.category_id,r.title,r.impact,r.danger,r.suggested_priority,r.priority,r.status,r.response_due_at,r.resolution_due_at,r.created_at,r.updated_at from maintenance_requests r where r.organization_id=? and r.building_id=? and ")
            .append(scope);
    if (status != null) {
      sql.append(" and r.status=?");
      args.add(status.name());
    }
    if (priority != null) {
      sql.append(" and coalesce(r.priority,r.suggested_priority)=?");
      args.add(priority.name());
    }
    sql.append(
        " order by case when r.resolution_due_at<now() and r.status not in ('CLOSED','CANCELLED') then 0 else 1 end,r.created_at desc,r.id limit 50 offset ?");
    args.add(page * 50);
    return db.rows(sql.toString(), args.toArray());
  }

  public Map<String, Object> request(Actor actor, UUID organization, UUID building, UUID request) {
    Access access = enter(actor, organization, building);
    var row = lockedRequest(organization, building, request, false);
    requireRequestAccess(actor, organization, building, row, access);
    var result = new LinkedHashMap<>(row);
    result.put(
        "history",
        db.rows(
            "select actor_id,from_status,to_status,reason,created_at from maintenance_status_history where request_id=? order by created_at,id",
            request));
    result.put(
        "work_orders",
        db.rows(
            "select id,assigned_account_id,vendor_id,status,estimated_cost,actual_cost,currency,created_at,updated_at from work_orders where request_id=? order by created_at,id",
            request));
    result.put(
        "work_logs",
        db.rows(
            "select l.id,l.work_order_id,l.actor_id,l.note,l.minutes,l.created_at from work_logs l join work_orders w on w.id=l.work_order_id where w.request_id=? order by l.created_at,l.id",
            request));
    result.put(
        "comments",
        db.rows(
            "select id,actor_id,body,internal,created_at from maintenance_comments where request_id=? and (? or not internal) order by created_at,id",
            request,
            access.manager()));
    result.put(
        "photos",
        db.rows(
            "select id,content_type,size_bytes,created_at from maintenance_photos where request_id=? order by created_at,id",
            request));
    return result;
  }

  public void triage(
      Actor actor,
      UUID organization,
      UUID building,
      UUID request,
      Priority priority,
      String reason) {
    manager(actor, organization, building);
    var row = lockedRequest(organization, building, request, true);
    requireStatus(row, RequestStatus.SUBMITTED);
    var category =
        db.one(
            "select response_minutes,resolution_minutes from maintenance_categories where id=?",
            row.get("category_id"));
    Instant now = Instant.now();
    transition(
        actor,
        organization,
        building,
        row,
        RequestStatus.TRIAGED,
        reason,
        "priority=?,triage_reason=?,response_due_at=?,resolution_due_at=?",
        priority.name(),
        trim(reason),
        Timestamp.from(
            now.plusSeconds(((Number) category.get("response_minutes")).longValue() * 60)),
        Timestamp.from(
            now.plusSeconds(((Number) category.get("resolution_minutes")).longValue() * 60)));
  }

  public UUID assignStaff(
      Actor actor,
      UUID organization,
      UUID building,
      UUID request,
      UUID account,
      BigDecimal estimate) {
    manager(actor, organization, building);
    db.one(
        "select 1 from memberships where organization_id=? and account_id=? and status='ACTIVE'",
        organization,
        account);
    return assign(actor, organization, building, request, account, null, estimate);
  }

  public UUID assignVendor(
      Actor actor,
      UUID organization,
      UUID building,
      UUID request,
      UUID vendor,
      BigDecimal estimate) {
    manager(actor, organization, building);
    db.one(
        "select 1 from vendors where organization_id=? and building_id=? and id=? and active",
        organization,
        building,
        vendor);
    return assign(actor, organization, building, request, null, vendor, estimate);
  }

  private UUID assign(
      Actor actor,
      UUID organization,
      UUID building,
      UUID request,
      UUID account,
      UUID vendor,
      BigDecimal estimate) {
    var row = lockedRequest(organization, building, request, true);
    RequestStatus current = RequestStatus.valueOf((String) row.get("status"));
    if (!Set.of(RequestStatus.TRIAGED, RequestStatus.ASSIGNED).contains(current))
      throw conflict(current, RequestStatus.ASSIGNED);
    String currency =
        (String)
            db.one(
                    "select currency from buildings where id=? and organization_id=?",
                    building,
                    organization)
                .get("currency");
    UUID work = UUID.randomUUID();
    db.update(
        "insert into work_orders(id,organization_id,building_id,request_id,assigned_account_id,vendor_id,status,estimated_cost,currency) values (?,?,?,?,?,?,'ASSIGNED',?,?)",
        work,
        organization,
        building,
        request,
        account,
        vendor,
        estimate,
        currency);
    if (current != RequestStatus.ASSIGNED)
      transition(
          actor,
          organization,
          building,
          row,
          RequestStatus.ASSIGNED,
          "Work assigned",
          "",
          new Object[0]);
    UUID recipient = account != null ? account : vendorAccount(organization, building, vendor);
    if (recipient != null)
      notify(
          recipient,
          organization,
          building,
          "WORK_ASSIGNED",
          "Maintenance work assigned",
          "/maintenance/" + request,
          "work:assigned:" + work);
    db.audit(actor.id(), organization, "MAINTENANCE_WORK_ASSIGNED", work);
    return work;
  }

  public void start(Actor actor, UUID organization, UUID building, UUID request) {
    Access access = enter(actor, organization, building);
    var row = lockedRequest(organization, building, request, true);
    requireRequestAccess(actor, organization, building, row, access);
    requireStatus(row, RequestStatus.ASSIGNED);
    db.update(
        "update work_orders set status='IN_PROGRESS',updated_at=now() where request_id=? and status='ASSIGNED' and (? or assigned_account_id=? or vendor_id in (select vendor_id from vendor_accounts where account_id=? and organization_id=? and building_id=?))",
        request,
        access.manager(),
        actor.id(),
        actor.id(),
        organization,
        building);
    transition(
        actor, organization, building, row, RequestStatus.IN_PROGRESS, null, "", new Object[0]);
  }

  public void resolve(Actor actor, UUID organization, UUID building, UUID request, String summary) {
    Access access = enter(actor, organization, building);
    var row = lockedRequest(organization, building, request, true);
    requireRequestAccess(actor, organization, building, row, access);
    requireStatus(row, RequestStatus.IN_PROGRESS);
    db.update(
        "update work_orders set status='COMPLETED',updated_at=now() where request_id=? and status='IN_PROGRESS'",
        request);
    transition(
        actor,
        organization,
        building,
        row,
        RequestStatus.RESOLVED,
        summary,
        "resolution_summary=?,resolved_at=now()",
        summary.trim());
    if (row.get("resident_id") != null) {
      UUID account =
          Store.id(
              db.one("select account_id from residents where id=?", row.get("resident_id")),
              "account_id");
      notify(
          account,
          organization,
          building,
          "REQUEST_RESOLVED",
          "Maintenance request resolved",
          "/maintenance/" + request,
          "request:resolved:" + request);
    }
  }

  public void close(
      Actor actor, UUID organization, UUID building, UUID request, ResolutionOutcome outcome) {
    Access access = enter(actor, organization, building);
    var row = lockedRequest(organization, building, request, true);
    requireRequestAccess(actor, organization, building, row, access);
    requireStatus(row, RequestStatus.RESOLVED);
    if (!access.manager() && outcome == ResolutionOutcome.AUTO_CLOSED)
      throw ApiException.forbidden();
    if (outcome == ResolutionOutcome.REJECTED) {
      transition(
          actor,
          organization,
          building,
          row,
          RequestStatus.IN_PROGRESS,
          "Resident requested more work",
          "resolution_outcome=?",
          outcome.name());
      return;
    }
    transition(
        actor,
        organization,
        building,
        row,
        RequestStatus.CLOSED,
        null,
        "resolution_outcome=?,closed_at=now()",
        outcome.name());
  }

  public void cancel(Actor actor, UUID organization, UUID building, UUID request, String reason) {
    Access access = enter(actor, organization, building);
    var row = lockedRequest(organization, building, request, true);
    requireRequestAccess(actor, organization, building, row, access);
    RequestStatus current = RequestStatus.valueOf((String) row.get("status"));
    if (Set.of(RequestStatus.CLOSED, RequestStatus.CANCELLED).contains(current))
      throw conflict(current, RequestStatus.CANCELLED);
    transition(
        actor, organization, building, row, RequestStatus.CANCELLED, reason, "", new Object[0]);
    db.update(
        "update work_orders set status='CANCELLED',updated_at=now() where request_id=? and status<>'COMPLETED'",
        request);
  }

  public UUID addComment(
      Actor actor, UUID organization, UUID building, UUID request, String body, boolean internal) {
    Access access = enter(actor, organization, building);
    var row = lockedRequest(organization, building, request, false);
    requireRequestAccess(actor, organization, building, row, access);
    if (internal
        && !access.manager()
        && !access.roles().contains("MAINTENANCE_STAFF")
        && !access.roles().contains("VENDOR")) throw ApiException.forbidden();
    UUID id = UUID.randomUUID();
    db.update(
        "insert into maintenance_comments(id,organization_id,building_id,request_id,actor_id,body,internal) values (?,?,?,?,?,?,?)",
        id,
        organization,
        building,
        request,
        actor.id(),
        body.trim(),
        internal);
    db.audit(actor.id(), organization, "MAINTENANCE_COMMENT_ADDED", id);
    return id;
  }

  public UUID addWorkLog(
      Actor actor, UUID organization, UUID building, UUID workOrder, String note, Integer minutes) {
    Access access = enter(actor, organization, building);
    var work =
        db.one(
            "select * from work_orders where organization_id=? and building_id=? and id=?",
            organization,
            building,
            workOrder);
    requireWorkAccess(actor, organization, building, work, access);
    if ("CANCELLED".equals(work.get("status")))
      throw new ApiException(409, "Cancelled work cannot be updated");
    UUID id = UUID.randomUUID();
    db.update(
        "insert into work_logs(id,organization_id,building_id,work_order_id,actor_id,note,minutes) values (?,?,?,?,?,?,?)",
        id,
        organization,
        building,
        workOrder,
        actor.id(),
        note.trim(),
        minutes);
    db.audit(actor.id(), organization, "MAINTENANCE_WORK_LOG_ADDED", id);
    return id;
  }

  public void updateWorkCosts(
      Actor actor,
      UUID organization,
      UUID building,
      UUID workOrder,
      BigDecimal estimated,
      BigDecimal actual) {
    manager(actor, organization, building);
    db.one(
        "select id from work_orders where organization_id=? and building_id=? and id=? for update",
        organization,
        building,
        workOrder);
    if (estimated == null && actual == null)
      throw new ApiException(400, "At least one cost is required");
    db.update(
        "update work_orders set estimated_cost=coalesce(?,estimated_cost),actual_cost=coalesce(?,actual_cost),updated_at=now() where id=?",
        estimated,
        actual,
        workOrder);
    db.audit(actor.id(), organization, "MAINTENANCE_WORK_COST_UPDATED", workOrder);
  }

  private void requireWorkAccess(
      Actor actor, UUID organization, UUID building, Map<String, Object> work, Access access) {
    if (access.manager() || actor.id().equals(work.get("assigned_account_id"))) return;
    if (work.get("vendor_id") != null
        && db.find(
                "select 1 from vendor_accounts where organization_id=? and building_id=? and vendor_id=? and account_id=?",
                organization,
                building,
                work.get("vendor_id"),
                actor.id())
            .isPresent()) return;
    throw ApiException.forbidden();
  }

  public UUID createVendor(
      Actor actor,
      UUID organization,
      UUID building,
      String name,
      String email,
      String phone,
      UUID account) {
    manager(actor, organization, building);
    UUID id = UUID.randomUUID();
    db.update(
        "insert into vendors(id,organization_id,building_id,name,email,phone) values (?,?,?,?,?,?)",
        id,
        organization,
        building,
        name.trim(),
        trim(email),
        trim(phone));
    if (account != null) {
      db.one(
          "select 1 from building_roles where organization_id=? and building_id=? and account_id=? and role='VENDOR'",
          organization,
          building,
          account);
      db.update(
          "insert into vendor_accounts(organization_id,building_id,vendor_id,account_id) values (?,?,?,?)",
          organization,
          building,
          id,
          account);
    }
    db.audit(actor.id(), organization, "VENDOR_CREATED", id);
    return id;
  }

  public List<Map<String, Object>> vendors(Actor actor, UUID organization, UUID building) {
    manager(actor, organization, building);
    return db.rows(
        "select id,name,email,phone,active from vendors where organization_id=? and building_id=? order by name,id",
        organization,
        building);
  }

  public UUID createRecurringPlan(
      Actor actor,
      UUID organization,
      UUID building,
      UUID space,
      UUID category,
      String title,
      String description,
      int intervalDays,
      java.time.LocalDate nextRunOn) {
    manager(actor, organization, building);
    db.one(
        "select 1 from spaces where organization_id=? and building_id=? and id=?",
        organization,
        building,
        space);
    db.one(
        "select 1 from maintenance_categories where organization_id=? and building_id=? and id=? and active",
        organization,
        building,
        category);
    UUID id = UUID.randomUUID();
    db.update(
        "insert into recurring_maintenance_plans(id,organization_id,building_id,space_id,category_id,title,description,interval_days,next_run_on) values (?,?,?,?,?,?,?,?,?)",
        id,
        organization,
        building,
        space,
        category,
        title.trim(),
        description.trim(),
        intervalDays,
        nextRunOn);
    db.audit(actor.id(), organization, "RECURRING_MAINTENANCE_PLAN_CREATED", id);
    return id;
  }

  public List<Map<String, Object>> recurringPlans(Actor actor, UUID organization, UUID building) {
    manager(actor, organization, building);
    return db.rows(
        "select id,space_id,category_id,title,description,interval_days,next_run_on,active from recurring_maintenance_plans where organization_id=? and building_id=? order by next_run_on,id",
        organization,
        building);
  }

  private void requireRequestAccess(
      Actor actor, UUID organization, UUID building, Map<String, Object> request, Access access) {
    if (access.manager()) return;
    if (access.roles().contains("TENANT")
        && request.get("resident_id") != null
        && db.find(
                "select 1 from residents where id=? and account_id=?",
                request.get("resident_id"),
                actor.id())
            .isPresent()) return;
    if (db.find(
            "select 1 from work_orders w where w.request_id=? and (w.assigned_account_id=? or w.vendor_id in (select vendor_id from vendor_accounts where account_id=? and organization_id=? and building_id=?))",
            request.get("id"),
            actor.id(),
            actor.id(),
            organization,
            building)
        .isPresent()) return;
    throw ApiException.forbidden();
  }

  private Map<String, Object> lockedRequest(
      UUID organization, UUID building, UUID request, boolean lock) {
    return db.one(
        "select * from maintenance_requests where organization_id=? and building_id=? and id=?"
            + (lock ? " for update" : ""),
        organization,
        building,
        request);
  }

  private void requireStatus(Map<String, Object> row, RequestStatus expected) {
    RequestStatus current = RequestStatus.valueOf((String) row.get("status"));
    if (current != expected) throw conflict(current, expected);
  }

  private ApiException conflict(RequestStatus current, RequestStatus target) {
    return new ApiException(
        409, "Cannot change maintenance request from " + current + " to " + target);
  }

  private void transition(
      Actor actor,
      UUID organization,
      UUID building,
      Map<String, Object> row,
      RequestStatus target,
      String reason,
      String extra,
      Object... extraArgs) {
    RequestStatus current = RequestStatus.valueOf((String) row.get("status"));
    List<Object> args = new ArrayList<>();
    args.add(target.name());
    args.addAll(Arrays.asList(extraArgs));
    args.add(row.get("id"));
    args.add(row.get("version"));
    String suffix = extra.isBlank() ? "" : "," + extra;
    int changed =
        db.update(
            "update maintenance_requests set status=?,version=version+1,updated_at=now()"
                + suffix
                + " where id=? and version=?",
            args.toArray());
    if (changed != 1) throw new ApiException(409, "Maintenance request changed concurrently");
    history(actor, organization, building, Store.id(row, "id"), current, target, reason);
    db.audit(actor.id(), organization, "MAINTENANCE_REQUEST_" + target.name(), Store.id(row, "id"));
  }

  private void history(
      Actor actor,
      UUID organization,
      UUID building,
      UUID request,
      RequestStatus from,
      RequestStatus to,
      String reason) {
    db.update(
        "insert into maintenance_status_history(id,organization_id,building_id,request_id,actor_id,from_status,to_status,reason) values (?,?,?,?,?,?,?,?)",
        UUID.randomUUID(),
        organization,
        building,
        request,
        actor.id(),
        from == null ? null : from.name(),
        to.name(),
        trim(reason));
  }

  private Priority suggest(Priority category, Impact impact, boolean danger) {
    if (danger) return Priority.URGENT;
    Priority impactPriority =
        switch (impact) {
          case LOW -> Priority.LOW;
          case MEDIUM -> Priority.MEDIUM;
          case HIGH -> Priority.HIGH;
        };
    return category.ordinal() > impactPriority.ordinal() ? category : impactPriority;
  }

  private void notifyManagers(
      UUID organization, UUID building, UUID request, String title, String key) {
    db.rows(
            "select distinct m.account_id from memberships m left join building_roles r on r.organization_id=m.organization_id and r.account_id=m.account_id and r.building_id=? where m.organization_id=? and m.status='ACTIVE' and (m.owner or r.role='PROPERTY_MANAGER')",
            building,
            organization)
        .forEach(
            row ->
                notify(
                    Store.id(row, "account_id"),
                    organization,
                    building,
                    "REQUEST_SUBMITTED",
                    title,
                    "/maintenance/" + request,
                    key));
  }

  private void notify(
      UUID account,
      UUID organization,
      UUID building,
      String type,
      String title,
      String path,
      String key) {
    db.update(
        "insert into notifications(id,account_id,organization_id,building_id,type,title,target_path,deduplication_key) values (?,?,?,?,?,?,?,?)",
        UUID.randomUUID(),
        account,
        organization,
        building,
        type,
        title,
        path,
        key);
  }

  private UUID vendorAccount(UUID organization, UUID building, UUID vendor) {
    if (vendor == null) return null;
    return db.find(
            "select account_id from vendor_accounts where organization_id=? and building_id=? and vendor_id=? order by account_id limit 1",
            organization,
            building,
            vendor)
        .map(row -> Store.id(row, "account_id"))
        .orElse(null);
  }

  private String trim(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private record Access(boolean owner, boolean manager, Set<String> roles) {}
}
