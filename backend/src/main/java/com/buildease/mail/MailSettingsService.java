package com.buildease.mail;

import com.buildease.auth.Actor;
import com.buildease.common.ApiException;
import com.buildease.common.Store;
import java.util.*;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class MailSettingsService {
  private final Store db;

  public MailSettingsService(Store db) {
    this.db = db;
  }

  private void platform(Actor a) {
    if (!a.admin()
        || db.find("select 1 from accounts where id=? and active and platform_admin", a.id())
            .isEmpty()) throw ApiException.forbidden();
    db.context(a.id(), null, a.impersonatedBy());
  }

  public Map<String, Object> current(Actor a) {
    platform(a);
    return db.one(
        "select host,port,username,from_address,starttls from mail_settings where id=true");
  }

  public void update(
      Actor a,
      String host,
      int port,
      String username,
      String password,
      String from,
      boolean starttls) {
    platform(a);
    if (password == null || password.isBlank())
      db.update(
          "update mail_settings set host=?,port=?,username=?,from_address=?,starttls=?,updated_at=now(),updated_by=? where id=true",
          blank(host),
          port,
          blank(username),
          blank(from),
          starttls,
          a.id());
    else
      db.update(
          "update mail_settings set host=?,port=?,username=?,smtp_password=?,from_address=?,starttls=?,updated_at=now(),updated_by=? where id=true",
          blank(host),
          port,
          blank(username),
          password,
          blank(from),
          starttls,
          a.id());
    db.audit(a.id(), null, "MAIL_SETTINGS_UPDATED", a.id());
  }

  public void sendTest(Actor a, String recipient) {
    platform(a);
    send(
        recipient,
        "BuildEase test email",
        "This is a test email confirming your SMTP settings are working.");
  }

  public void send(String recipient, String subject, String body) {
    var settings = db.one("select * from mail_settings where id=true");
    String host = (String) settings.get("host");
    String from = (String) settings.get("from_address");
    if (host == null || host.isBlank() || from == null || from.isBlank())
      throw new ApiException(503, "Identity email is not configured");
    JavaMailSenderImpl sender = new JavaMailSenderImpl();
    sender.setHost(host);
    sender.setPort((Integer) settings.get("port"));
    String username = (String) settings.get("username");
    if (username != null && !username.isBlank()) {
      sender.setUsername(username);
      sender.setPassword((String) settings.get("smtp_password"));
    }
    Properties props = sender.getJavaMailProperties();
    props.put("mail.smtp.connectiontimeout", "5000");
    props.put("mail.smtp.timeout", "3000");
    props.put("mail.smtp.writetimeout", "5000");
    props.put("mail.smtp.starttls.enable", String.valueOf(settings.get("starttls")));
    SimpleMailMessage message = new SimpleMailMessage();
    message.setFrom(from);
    message.setTo(recipient);
    message.setSubject(subject);
    message.setText(body);
    try {
      sender.send(message);
    } catch (RuntimeException error) {
      throw new ApiException(503, "Identity email could not be delivered");
    }
  }

  private static String blank(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
