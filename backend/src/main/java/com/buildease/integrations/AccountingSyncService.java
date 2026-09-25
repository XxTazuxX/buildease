package com.buildease.integrations;

import com.buildease.auth.Actor;
import com.buildease.common.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class AccountingSyncService {
  private final Store db;
  private final AccountingExportAdapter adapter;

  public AccountingSyncService(Store db, AccountingExportAdapter adapter) {
    this.db = db;
    this.adapter = adapter;
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

  public List<Map<String, Object>> ledger(
      UUID organization, UUID actingAccount, LocalDate from, LocalDate to) {
    db.context(actingAccount, organization);
    List<Map<String, Object>> lines = new ArrayList<>();
    db.rows(
            "select building_id,'CHARGE' as type,type as description,amount,currency,due_on as date from charges where organization_id=? and due_on between ? and ?",
            organization,
            from,
            to)
        .forEach(lines::add);
    db.rows(
            "select building_id,'PAYMENT' as type,method as description,amount,currency,received_on as date from payments where organization_id=? and received_on between ? and ?",
            organization,
            from,
            to)
        .forEach(lines::add);
    lines.sort(Comparator.comparing(l -> (java.sql.Date) l.get("date")));
    return lines;
  }

  public UUID sync(Actor actor, UUID organization, UUID building) {
    manager(actor, organization, building);
    var lines = buildingLedger(organization, building);
    var result = adapter.export(organization, building, lines);
    UUID id = UUID.randomUUID();
    db.update(
        "insert into accounting_syncs(id,organization_id,building_id,status,provider_reference,synced_by) values (?,?,?,?,?,?)",
        id,
        organization,
        building,
        result.status(),
        result.providerReference(),
        actor.id());
    db.audit(actor.id(), organization, "ACCOUNTING_SYNCED", id);
    return id;
  }

  private List<Map<String, Object>> buildingLedger(UUID organization, UUID building) {
    List<Map<String, Object>> lines = new ArrayList<>();
    db.rows(
            "select 'CHARGE' as type,type as description,amount,currency,due_on as date from charges where organization_id=? and building_id=?",
            organization,
            building)
        .forEach(lines::add);
    db.rows(
            "select 'PAYMENT' as type,method as description,amount,currency,received_on as date from payments where organization_id=? and building_id=?",
            organization,
            building)
        .forEach(lines::add);
    return lines;
  }

  public List<Map<String, Object>> history(Actor actor, UUID organization, UUID building) {
    manager(actor, organization, building);
    return db.rows(
        "select id,status,provider_reference,synced_by,synced_at from accounting_syncs where organization_id=? and building_id=? order by synced_at desc",
        organization,
        building);
  }

  private record Access(boolean owner, boolean manager, Set<String> roles) {}
}
