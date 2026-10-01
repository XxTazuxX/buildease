package com.buildease.billing;

import com.buildease.auth.Actor;
import com.buildease.common.*;
import java.math.BigDecimal;
import java.sql.Array;
import java.sql.SQLException;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The SaaS plan catalogue: public for the pricing page, editable by platform administrators. */
@Service
@Transactional
public class PlanService {
  static final String COLUMNS =
      "id,code,name,description,monthly_price,annual_price,currency,max_buildings,max_spaces,max_staff,features,trial_days,public,active,sort_order";

  private final Store db;

  public PlanService(Store db) {
    this.db = db;
  }

  public record PlanInput(
      String code,
      String name,
      String description,
      BigDecimal monthlyPrice,
      BigDecimal annualPrice,
      String currency,
      Integer maxBuildings,
      Integer maxSpaces,
      Integer maxStaff,
      List<String> features,
      int trialDays,
      boolean publiclyListed,
      boolean active,
      int sortOrder) {}

  public List<Map<String, Object>> publicPlans() {
    return normalize(
        db.rows(
            "select "
                + COLUMNS
                + " from plans where active and public order by sort_order,monthly_price,id"));
  }

  public List<Map<String, Object>> all(Actor actor) {
    Platform.require(db, actor);
    return normalize(db.rows("select " + COLUMNS + " from plans order by sort_order,id"));
  }

  public UUID create(Actor actor, PlanInput input) {
    Platform.require(db, actor);
    validate(input);
    UUID id = UUID.randomUUID();
    try {
      db.update(
          "insert into plans(id,code,name,description,monthly_price,annual_price,currency,max_buildings,max_spaces,max_staff,features,trial_days,public,active,sort_order) values (?,?,?,?,?,?,?,?,?,?,?::varchar[],?,?,?,?)",
          id,
          input.code().trim().toUpperCase(Locale.ROOT),
          input.name().trim(),
          blank(input.description()),
          input.monthlyPrice(),
          input.annualPrice(),
          currency(input.currency()),
          input.maxBuildings(),
          input.maxSpaces(),
          input.maxStaff(),
          features(input.features()),
          input.trialDays(),
          input.publiclyListed(),
          input.active(),
          input.sortOrder());
    } catch (DataIntegrityViolationException e) {
      throw new ApiException(409, "A plan with this code already exists");
    }
    db.audit(actor.id(), null, "PLAN_CREATED", id);
    return id;
  }

  public void update(Actor actor, UUID plan, PlanInput input) {
    Platform.require(db, actor);
    validate(input);
    db.one("select id from plans where id=? for update", plan);
    db.update(
        "update plans set name=?,description=?,monthly_price=?,annual_price=?,currency=?,max_buildings=?,max_spaces=?,max_staff=?,features=?::varchar[],trial_days=?,public=?,active=?,sort_order=?,updated_at=now() where id=?",
        input.name().trim(),
        blank(input.description()),
        input.monthlyPrice(),
        input.annualPrice(),
        currency(input.currency()),
        input.maxBuildings(),
        input.maxSpaces(),
        input.maxStaff(),
        features(input.features()),
        input.trialDays(),
        input.publiclyListed(),
        input.active(),
        input.sortOrder(),
        plan);
    db.audit(actor.id(), null, "PLAN_UPDATED", plan);
  }

  private void validate(PlanInput input) {
    if (input.monthlyPrice().signum() < 0 || input.annualPrice().signum() < 0)
      throw new ApiException(400, "Prices cannot be negative");
    for (Integer limit : Arrays.asList(input.maxBuildings(), input.maxSpaces(), input.maxStaff()))
      if (limit != null && limit < 0) throw new ApiException(400, "Limits cannot be negative");
    if (input.trialDays() < 0 || input.trialDays() > 90)
      throw new ApiException(400, "Trial must be between 0 and 90 days");
  }

  private static String[] features(List<String> features) {
    if (features == null) return new String[0];
    return features.stream()
        .filter(f -> f != null && !f.isBlank())
        .map(String::trim)
        .limit(20)
        .toArray(String[]::new);
  }

  private static String currency(String currency) {
    return currency == null || currency.isBlank()
        ? "USD"
        : currency.trim().toUpperCase(Locale.ROOT);
  }

  private static String blank(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  /** JDBC returns SQL arrays as {@link Array}; convert them so rows serialize as JSON lists. */
  static List<Map<String, Object>> normalize(List<Map<String, Object>> rows) {
    List<Map<String, Object>> result = new ArrayList<>(rows.size());
    for (var row : rows) result.add(normalize(row));
    return result;
  }

  static Map<String, Object> normalize(Map<String, Object> row) {
    var copy = new LinkedHashMap<>(row);
    for (var entry : copy.entrySet())
      if (entry.getValue() instanceof Array array) {
        try {
          entry.setValue(List.of((Object[]) array.getArray()));
        } catch (SQLException e) {
          throw new IllegalStateException("Unreadable array column " + entry.getKey(), e);
        }
      }
    return copy;
  }
}
