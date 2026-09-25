package com.buildease.notification;

import com.buildease.auth.Actor;
import com.buildease.common.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class AnnouncementService {
  private final Store db;

  public AnnouncementService(Store db) {
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

  private void manager(Actor actor, UUID organization, UUID building) {
    if (!enter(actor, organization, building).manager()) throw ApiException.forbidden();
  }

  public UUID send(
      Actor actor, UUID organization, UUID building, String title, String body, Audience audience) {
    manager(actor, organization, building);
    List<UUID> recipients =
        (audience == Audience.ALL_RESIDENTS
                ? db.rows(
                    "select distinct account_id from residents where organization_id=? and building_id=? and active",
                    organization,
                    building)
                : db.rows(
                    "select distinct account_id from building_roles where organization_id=? and building_id=? and role in ('PROPERTY_MANAGER','ACCOUNTANT','MAINTENANCE_STAFF','SECURITY_OPERATIONS_STAFF')"
                        + " union select account_id from memberships where organization_id=? and owner and status='ACTIVE'",
                    organization,
                    building,
                    organization))
            .stream().map(row -> Store.id(row, "account_id")).toList();
    UUID id = UUID.randomUUID();
    db.update(
        "insert into announcements(id,organization_id,building_id,title,body,audience,sent_by,recipient_count) values (?,?,?,?,?,?,?,?)",
        id,
        organization,
        building,
        title,
        body,
        audience.name(),
        actor.id(),
        recipients.size());
    for (UUID recipient : recipients)
      db.update(
          "insert into notifications(id,account_id,organization_id,building_id,type,title,target_path,deduplication_key) values (?,?,?,?,'ANNOUNCEMENT',?,?,?) on conflict(account_id,deduplication_key) do nothing",
          UUID.randomUUID(),
          recipient,
          organization,
          building,
          title,
          "/announcements/" + id,
          "announcement:" + id);
    db.audit(actor.id(), organization, "ANNOUNCEMENT_SENT", id);
    return id;
  }

  public List<Map<String, Object>> history(
      Actor actor, UUID organization, UUID building, int page) {
    manager(actor, organization, building);
    if (page < 0 || page > 10000) throw new ApiException(400, "Invalid page");
    return db.rows(
        "select id,title,audience,sent_by,recipient_count,created_at from announcements where organization_id=? and building_id=? order by created_at desc,id limit 50 offset ?",
        organization,
        building,
        page * 50);
  }

  public Map<String, Object> detail(
      Actor actor, UUID organization, UUID building, UUID announcement) {
    enter(actor, organization, building);
    return db.one(
        "select id,title,body,audience,sent_by,recipient_count,created_at from announcements where organization_id=? and building_id=? and id=?",
        organization,
        building,
        announcement);
  }

  private record Access(boolean owner, boolean manager, Set<String> roles) {}
}
