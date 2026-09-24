package com.buildease.mail;

import com.buildease.common.Store;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Seeds mail_settings from the deploy-time SMTP env vars exactly once, so existing deployments keep
 * working after this table becomes the source of truth. Never overwrites an admin-set value (the
 * WHERE clause only matches while host is still unset).
 */
@Component
public class MailSettingsBootstrap implements ApplicationRunner {
  private final Store db;
  private final String host;
  private final int port;
  private final String username;
  private final String password;
  private final String from;
  private final boolean starttls;

  public MailSettingsBootstrap(
      Store db,
      @Value("${spring.mail.host:}") String host,
      @Value("${spring.mail.port:587}") int port,
      @Value("${spring.mail.username:}") String username,
      @Value("${spring.mail.password:}") String password,
      @Value("${app.mail-from:}") String from,
      @Value("${spring.mail.properties.mail.smtp.starttls.enable:true}") boolean starttls) {
    this.db = db;
    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
    this.from = from;
    this.starttls = starttls;
  }

  public void run(ApplicationArguments args) {
    if (host.isBlank()) return;
    db.update(
        "update mail_settings set host=?,port=?,username=?,smtp_password=?,from_address=?,starttls=? where id=true and host is null",
        host,
        port,
        username.isBlank() ? null : username,
        password.isBlank() ? null : password,
        from.isBlank() ? null : from,
        starttls);
  }
}
