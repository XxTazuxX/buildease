package com.buildease.reporting;

import com.buildease.auth.Actor;
import com.buildease.common.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ReportingService {
  private final Store db;

  public ReportingService(Store db) {
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

  private Access financeReader(Actor actor, UUID organization, UUID building) {
    Access access = enter(actor, organization, building);
    if (!access.manager() && !access.roles().contains("ACCOUNTANT")) throw ApiException.forbidden();
    return access;
  }

  public List<Map<String, Object>> rentRoll(Actor actor, UUID organization, UUID building) {
    financeReader(actor, organization, building);
    var rows =
        db.rows(
            "select l.id as lease_id,l.resident_id,r.display_name as resident_name,l.space_id,"
                + "s.name as space_name,s.code as space_code,l.rent_amount,l.currency,"
                + "l.next_charge_on,l.starts_on,l.ends_on,"
                + "coalesce((select sum(amount) from charges where lease_id=l.id),0) as charged,"
                + "coalesce((select sum(amount) from payments where lease_id=l.id),0) as paid,"
                + "d.status as deposit_status,d.amount as deposit_amount "
                + "from leases l "
                + "join residents r on r.id=l.resident_id "
                + "join spaces s on s.id=l.space_id "
                + "left join deposits d on d.lease_id=l.id "
                + "where l.organization_id=? and l.building_id=? and l.status='ACTIVE' "
                + "order by s.name",
            organization,
            building);
    for (var row : rows) {
      BigDecimal charged = (BigDecimal) row.get("charged");
      BigDecimal paid = (BigDecimal) row.get("paid");
      row.put("balance", charged.subtract(paid));
    }
    return rows;
  }

  public Map<String, Object> incomeStatement(
      Actor actor, UUID organization, UUID building, LocalDate from, LocalDate to) {
    financeReader(actor, organization, building);
    if (to.isBefore(from)) throw new ApiException(400, "'to' cannot be before 'from'");
    BigDecimal charged =
        (BigDecimal)
            db.one(
                    "select coalesce(sum(amount),0) as total from charges where organization_id=? and building_id=? and due_on between ? and ?",
                    organization,
                    building,
                    from,
                    to)
                .get("total");
    BigDecimal collected =
        (BigDecimal)
            db.one(
                    "select coalesce(sum(amount),0) as total from payments where organization_id=? and building_id=? and received_on between ? and ?",
                    organization,
                    building,
                    from,
                    to)
                .get("total");
    BigDecimal chargedToDate =
        (BigDecimal)
            db.one(
                    "select coalesce(sum(amount),0) as total from charges where organization_id=? and building_id=? and due_on<=?",
                    organization,
                    building,
                    to)
                .get("total");
    BigDecimal collectedToDate =
        (BigDecimal)
            db.one(
                    "select coalesce(sum(amount),0) as total from payments where organization_id=? and building_id=? and received_on<=?",
                    organization,
                    building,
                    to)
                .get("total");
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("from", from);
    result.put("to", to);
    result.put("totalCharged", charged);
    result.put("totalCollected", collected);
    result.put("outstandingBalance", chargedToDate.subtract(collectedToDate));
    return result;
  }

  public Map<String, Object> leaseStatement(
      Actor actor, UUID organization, UUID building, UUID lease, LocalDate from, LocalDate to) {
    Access access = enter(actor, organization, building);
    var leaseRow =
        db.one(
            "select resident_id from leases where organization_id=? and building_id=? and id=?",
            organization,
            building,
            lease);
    requireLeaseAccess(actor, access, leaseRow);
    if (to.isBefore(from)) throw new ApiException(400, "'to' cannot be before 'from'");
    BigDecimal openingCharged =
        (BigDecimal)
            db.one(
                    "select coalesce(sum(amount),0) as total from charges where organization_id=? and building_id=? and lease_id=? and due_on<?",
                    organization,
                    building,
                    lease,
                    from)
                .get("total");
    BigDecimal openingPaid =
        (BigDecimal)
            db.one(
                    "select coalesce(sum(amount),0) as total from payments where organization_id=? and building_id=? and lease_id=? and received_on<?",
                    organization,
                    building,
                    lease,
                    from)
                .get("total");
    BigDecimal openingBalance = openingCharged.subtract(openingPaid);

    List<Map<String, Object>> lines = new ArrayList<>();
    db.rows(
            "select id,'CHARGE' as kind,type as label,amount,due_on as date from charges where organization_id=? and building_id=? and lease_id=? and due_on between ? and ?",
            organization,
            building,
            lease,
            from,
            to)
        .forEach(lines::add);
    db.rows(
            "select id,'PAYMENT' as kind,method as label,amount,received_on as date from payments where organization_id=? and building_id=? and lease_id=? and received_on between ? and ?",
            organization,
            building,
            lease,
            from,
            to)
        .forEach(lines::add);
    lines.sort(Comparator.comparing(l -> (java.sql.Date) l.get("date")));

    BigDecimal running = openingBalance;
    for (var line : lines) {
      BigDecimal amount = (BigDecimal) line.get("amount");
      running = "CHARGE".equals(line.get("kind")) ? running.add(amount) : running.subtract(amount);
      line.put("runningBalance", running);
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("from", from);
    result.put("to", to);
    result.put("openingBalance", openingBalance);
    result.put("lines", lines);
    result.put("closingBalance", running);
    return result;
  }

  public Map<String, Object> occupancyReport(Actor actor, UUID organization, UUID building) {
    financeReader(actor, organization, building);
    Map<String, Long> byStatus = new LinkedHashMap<>();
    for (String status : List.of("VACANT", "RESERVED", "OCCUPIED", "MAINTENANCE", "INACTIVE"))
      byStatus.put(status, 0L);
    for (var row :
        db.rows(
            "select status,count(*) as count from spaces where organization_id=? and building_id=? and rentable group by status",
            organization,
            building))
      byStatus.put((String) row.get("status"), ((Number) row.get("count")).longValue());
    long totalRentable = byStatus.values().stream().mapToLong(Long::longValue).sum();
    long occupied = byStatus.get("OCCUPIED");
    double occupancyRate = totalRentable == 0 ? 0 : (occupied * 100.0) / totalRentable;
    Number avgTenancyDays =
        (Number)
            db.one(
                    "select avg(current_date-starts_on) as value from space_assignments where organization_id=? and building_id=? and status='ACTIVE'",
                    organization,
                    building)
                .get("value");
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("byStatus", byStatus);
    result.put("totalRentable", totalRentable);
    result.put("occupancyRate", Math.round(occupancyRate * 100) / 100.0);
    result.put("averageTenancyDays", avgTenancyDays == null ? null : avgTenancyDays.intValue());
    return result;
  }

  public Map<String, Object> maintenanceReport(
      Actor actor, UUID organization, UUID building, LocalDate from, LocalDate to) {
    financeReader(actor, organization, building);
    if (to.isBefore(from)) throw new ApiException(400, "'to' cannot be before 'from'");
    var byStatus =
        db.rows(
            "select status,count(*) as count from maintenance_requests where organization_id=? and building_id=? and created_at::date between ? and ? group by status",
            organization,
            building,
            from,
            to);
    Number avgResolutionHours =
        (Number)
            db.one(
                    "select avg(extract(epoch from resolved_at-created_at)/3600) as value from maintenance_requests where organization_id=? and building_id=? and resolved_at is not null and created_at::date between ? and ?",
                    organization,
                    building,
                    from,
                    to)
                .get("value");
    long slaTotal =
        ((Number)
                db.one(
                        "select count(*) as value from maintenance_requests where organization_id=? and building_id=? and resolved_at is not null and created_at::date between ? and ?",
                        organization,
                        building,
                        from,
                        to)
                    .get("value"))
            .longValue();
    long slaMet =
        ((Number)
                db.one(
                        "select count(*) as value from maintenance_requests where organization_id=? and building_id=? and resolved_at is not null and resolved_at<=resolution_due_at and created_at::date between ? and ?",
                        organization,
                        building,
                        from,
                        to)
                    .get("value"))
            .longValue();
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("from", from);
    result.put("to", to);
    result.put("byStatus", byStatus);
    result.put(
        "averageResolutionHours",
        avgResolutionHours == null
            ? null
            : Math.round(avgResolutionHours.doubleValue() * 10) / 10.0);
    double slaRate = slaTotal == 0 ? 0 : (slaMet * 100.0) / slaTotal;
    result.put("slaComplianceRate", Math.round(slaRate * 100) / 100.0);
    return result;
  }

  public String rentRollCsv(Actor actor, UUID organization, UUID building) {
    var rows = rentRoll(actor, organization, building);
    StringBuilder csv =
        new StringBuilder(
            "Resident,Space,Rent,Currency,Next Due,Charged,Paid,Balance,Deposit Status,Deposit Amount\n");
    for (var row : rows)
      csv.append(
          csvRow(
              row.get("resident_name"),
              row.get("space_name") + " (" + row.get("space_code") + ")",
              row.get("rent_amount"),
              row.get("currency"),
              row.get("next_charge_on"),
              row.get("charged"),
              row.get("paid"),
              row.get("balance"),
              row.get("deposit_status"),
              row.get("deposit_amount")));
    return csv.toString();
  }

  public String incomeStatementCsv(
      Actor actor, UUID organization, UUID building, LocalDate from, LocalDate to) {
    var statement = incomeStatement(actor, organization, building, from, to);
    StringBuilder csv =
        new StringBuilder("From,To,Total Charged,Total Collected,Outstanding Balance\n");
    csv.append(
        csvRow(
            statement.get("from"),
            statement.get("to"),
            statement.get("totalCharged"),
            statement.get("totalCollected"),
            statement.get("outstandingBalance")));
    return csv.toString();
  }

  private String csvRow(Object... values) {
    StringBuilder row = new StringBuilder();
    for (int i = 0; i < values.length; i++) {
      if (i > 0) row.append(',');
      row.append(csvField(values[i]));
    }
    return row.append('\n').toString();
  }

  private String csvField(Object value) {
    String text = value == null ? "" : value.toString();
    if (text.contains(",") || text.contains("\"") || text.contains("\n"))
      return "\"" + text.replace("\"", "\"\"") + "\"";
    return text;
  }

  private void requireLeaseAccess(Actor actor, Access access, Map<String, Object> lease) {
    if (access.manager() || access.roles().contains("ACCOUNTANT")) return;
    if (access.roles().contains("TENANT")
        && db.find(
                "select 1 from residents where id=? and account_id=?",
                lease.get("resident_id"),
                actor.id())
            .isPresent()) return;
    throw ApiException.forbidden();
  }

  private record Access(boolean owner, boolean manager, Set<String> roles) {}
}
