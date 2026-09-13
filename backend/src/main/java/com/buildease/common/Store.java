package com.buildease.common;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class Store {
  private final JdbcTemplate jdbc;

  public Store(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public List<Map<String, Object>> rows(String sql, Object... args) {
    return jdbc.queryForList(sql, args);
  }

  public Map<String, Object> one(String sql, Object... args) {
    return rows(sql, args).stream()
        .findFirst()
        .orElseThrow(() -> new ApiException(404, "Record not found"));
  }

  public Optional<Map<String, Object>> find(String sql, Object... args) {
    return rows(sql, args).stream().findFirst();
  }

  public int update(String sql, Object... args) {
    return jdbc.update(sql, args);
  }

  public void context(UUID actor, UUID org) {
    jdbc.queryForObject("select set_config('app.actor',?,true)", String.class, actor.toString());
    jdbc.queryForObject(
        "select set_config('app.org',?,true)", String.class, org == null ? "" : org.toString());
  }

  public void audit(UUID actor, UUID org, String action, UUID target) {
    update(
        "insert into audit_events(id,actor_id,organization_id,action,target_id) values (?,?,?,?,?)",
        UUID.randomUUID(),
        actor,
        org,
        action,
        target);
  }

  public static UUID id(Map<String, Object> row, String key) {
    return (UUID) row.get(key);
  }
}
