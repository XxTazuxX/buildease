package com.buildease.config;

import com.buildease.common.Store;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@org.springframework.core.annotation.Order(0)
@Component
public class RuntimeGuard implements ApplicationRunner {
  private final Store db;

  public RuntimeGuard(Store db) {
    this.db = db;
  }

  public void run(ApplicationArguments args) {
    var role =
        db.one(
            "select rolsuper,rolbypassrls,rolcreaterole from pg_roles where rolname=current_user");
    if ((boolean) role.get("rolsuper")
        || (boolean) role.get("rolbypassrls")
        || (boolean) role.get("rolcreaterole")
        || db.find(
                "select 1 from pg_tables where schemaname='public' and pg_has_role(current_user,tableowner,'MEMBER') and tablename='accounts'")
            .isPresent())
      throw new IllegalStateException(
          "Runtime database role must not be superuser, BYPASSRLS, or schema owner");
  }
}
