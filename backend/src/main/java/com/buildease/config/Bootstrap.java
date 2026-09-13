package com.buildease.config;

import com.buildease.auth.AuthService;
import com.buildease.common.Store;
import com.buildease.security.PasswordPolicy;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@org.springframework.core.annotation.Order(100)
@Component
@ConditionalOnProperty(name = "app.bootstrap", havingValue = "true")
public class Bootstrap implements ApplicationRunner {
  private final Store db;
  private final TransactionTemplate tx;
  private final PasswordEncoder passwords;
  private final String email, password;
  private final ConfigurableApplicationContext context;

  public Bootstrap(
      Store db,
      TransactionTemplate tx,
      PasswordEncoder passwords,
      @Value("${app.bootstrap-email}") String email,
      @Value("${app.bootstrap-password}") String password,
      ConfigurableApplicationContext context) {
    this.db = db;
    this.tx = tx;
    this.passwords = passwords;
    this.email = email;
    this.password = password;
    this.context = context;
  }

  public void run(ApplicationArguments args) {
    PasswordPolicy.validate(password);
    if (email.isBlank() || !email.contains("@"))
      throw new IllegalArgumentException("BOOTSTRAP_EMAIL required");
    tx.executeWithoutResult(
        s -> {
          db.one("select pg_advisory_xact_lock(187390112)");
          if (db.find("select id from accounts where platform_admin").isPresent())
            throw new IllegalStateException(
                "Platform administrator already exists; bootstrap refused");
          UUID id = UUID.randomUUID();
          db.update(
              "insert into accounts(id,email,display_name,password_hash,platform_admin,temporary_password_expires_at) values (?,?,?, ?,true,now()+interval '24 hours')",
              id,
              AuthService.email(email),
              "System Administrator",
              passwords.encode(password));
          db.context(id, null);
          db.audit(id, null, "PLATFORM_BOOTSTRAPPED", id);
        });
    SpringApplication.exit(context);
  }
}
