package com.buildease.occupancy;

import com.buildease.auth.Actor;
import com.buildease.common.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class OccupancyService {
  private final Store db;

  public OccupancyService(Store db) {
    this.db = db;
  }

  private boolean manage(Actor actor, UUID organization, UUID building) {
    db.context(actor.id(), null);
    var member =
        db.find(
            "select owner from memberships where organization_id=? and account_id=? and status='ACTIVE'",
            organization,
            actor.id());
    if (!actor.admin() && member.isEmpty()) throw ApiException.forbidden();
    db.context(actor.id(), organization);
    db.one("select id from organizations where id=? and active for update", organization);
    db.one("select id from buildings where organization_id=? and id=?", organization, building);
    return actor.admin()
        || member.map(row -> (boolean) row.get("owner")).orElse(false)
        || db.find(
                "select 1 from building_roles where organization_id=? and building_id=? and account_id=? and role='PROPERTY_MANAGER'",
                organization,
                building,
                actor.id())
            .isPresent();
  }

  private void manager(Actor actor, UUID organization, UUID building) {
    if (!manage(actor, organization, building)) throw ApiException.forbidden();
  }

  public UUID createResident(
      Actor actor, UUID organization, UUID building, UUID account, String name, String phone) {
    manager(actor, organization, building);
    db.one(
        "select 1 from memberships m join accounts a on a.id=m.account_id where m.organization_id=? and m.account_id=? and m.status='ACTIVE' and a.active",
        organization,
        account);
    if (db.find(
            "select 1 from building_roles where organization_id=? and building_id=? and account_id=? and role='TENANT'",
            organization,
            building,
            account)
        .isEmpty())
      throw new ApiException(409, "Account must have the tenant role for this building");
    UUID id = UUID.randomUUID();
    db.update(
        "insert into residents(id,organization_id,building_id,account_id,display_name,phone) values (?,?,?,?,?,?)",
        id,
        organization,
        building,
        account,
        name.trim(),
        blank(phone));
    db.audit(actor.id(), organization, "RESIDENT_CREATED", id);
    return id;
  }

  public List<Map<String, Object>> residents(Actor actor, UUID organization, UUID building) {
    boolean canManage = manage(actor, organization, building);
    List<Map<String, Object>> result =
        canManage
            ? db.rows(
                "select r.id,r.account_id,r.display_name,r.phone,r.active from residents r where r.organization_id=? and r.building_id=? order by r.display_name,r.id",
                organization,
                building)
            : db.rows(
                "select r.id,r.account_id,r.display_name,r.phone,r.active from residents r where r.organization_id=? and r.building_id=? and r.account_id=? order by r.display_name,r.id",
                organization,
                building,
                actor.id());
    for (var row : result) {
      var assignments =
          db.rows(
              "select id,space_id,starts_on from space_assignments where organization_id=? and building_id=? and resident_id=? and status='ACTIVE' order by starts_on,id",
              organization,
              building,
              row.get("id"));
      row.put("assignments", assignments);
      var first = assignments.stream().findFirst();
      row.put("assignment_id", first.map(value -> value.get("id")).orElse(null));
      row.put("space_id", first.map(value -> value.get("space_id")).orElse(null));
      row.put("starts_on", first.map(value -> value.get("starts_on")).orElse(null));
    }
    return result;
  }

  public void updateResident(
      Actor actor,
      UUID organization,
      UUID building,
      UUID resident,
      String displayName,
      String phone,
      boolean active) {
    manager(actor, organization, building);
    db.one(
        "select id from residents where organization_id=? and building_id=? and id=? for update",
        organization,
        building,
        resident);
    if (!active
        && db.find(
                "select 1 from space_assignments where organization_id=? and building_id=? and resident_id=? and status='ACTIVE'",
                organization,
                building,
                resident)
            .isPresent())
      throw new ApiException(409, "End active space assignments before deactivating resident");
    db.update(
        "update residents set display_name=?,phone=?,active=?,updated_at=now() where organization_id=? and building_id=? and id=?",
        displayName.trim(),
        blank(phone),
        active,
        organization,
        building,
        resident);
    db.audit(actor.id(), organization, "RESIDENT_PROFILE_CHANGED", resident);
  }

  public UUID addHouseholdMember(
      Actor actor,
      UUID organization,
      UUID building,
      UUID resident,
      String name,
      String relationship) {
    manager(actor, organization, building);
    db.one(
        "select id from residents where organization_id=? and building_id=? and id=? and active",
        organization,
        building,
        resident);
    UUID id = UUID.randomUUID();
    db.update(
        "insert into household_members(id,organization_id,building_id,resident_id,name,relationship) values (?,?,?,?,?,?)",
        id,
        organization,
        building,
        resident,
        name.trim(),
        blank(relationship));
    db.audit(actor.id(), organization, "HOUSEHOLD_MEMBER_ADDED", id);
    return id;
  }

  public UUID assign(
      Actor actor,
      UUID organization,
      UUID building,
      UUID resident,
      UUID space,
      LocalDate startsOn) {
    manager(actor, organization, building);
    db.one(
        "select id from residents where organization_id=? and building_id=? and id=? and active",
        organization,
        building,
        resident);
    var target =
        db.one(
            "select status from spaces where organization_id=? and building_id=? and id=? for update",
            organization,
            building,
            space);
    if (!Set.of("VACANT", "RESERVED").contains(target.get("status")))
      throw new ApiException(409, "Space is not available for assignment");
    UUID id = UUID.randomUUID();
    try {
      db.update(
          "insert into space_assignments(id,organization_id,building_id,resident_id,space_id,status,starts_on) values (?,?,?,?,?,'ACTIVE',?)",
          id,
          organization,
          building,
          resident,
          space,
          startsOn);
    } catch (DataIntegrityViolationException e) {
      throw new ApiException(409, "Space already has an active assignment");
    }
    db.update(
        "update spaces set status='OCCUPIED',updated_at=now() where organization_id=? and building_id=? and id=?",
        organization,
        building,
        space);
    db.audit(actor.id(), organization, "SPACE_ASSIGNED", id);
    return id;
  }

  public void end(
      Actor actor, UUID organization, UUID building, UUID assignment, LocalDate endsOn) {
    manager(actor, organization, building);
    var row =
        db.one(
            "select * from space_assignments where organization_id=? and building_id=? and id=? for update",
            organization,
            building,
            assignment);
    if (!"ACTIVE".equals(row.get("status")))
      throw new ApiException(409, "Assignment is already ended");
    LocalDate start = ((java.sql.Date) row.get("starts_on")).toLocalDate();
    if (endsOn.isBefore(start)) throw new ApiException(400, "End date cannot be before start date");
    UUID space = Store.id(row, "space_id");
    db.update(
        "update space_assignments set status='ENDED',ends_on=?,updated_at=now() where id=?",
        endsOn,
        assignment);
    db.update(
        "update spaces set status='VACANT',updated_at=now() where organization_id=? and building_id=? and id=?",
        organization,
        building,
        space);
    db.audit(actor.id(), organization, "SPACE_ASSIGNMENT_ENDED", assignment);
  }

  public Optional<Map<String, Object>> activeAssignment(
      UUID organization, UUID building, UUID resident, UUID space) {
    return db.find(
        "select id from space_assignments where organization_id=? and building_id=? and resident_id=? and space_id=? and status='ACTIVE'",
        organization,
        building,
        resident,
        space);
  }

  private String blank(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
