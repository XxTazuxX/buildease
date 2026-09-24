package com.buildease.onboarding;

import com.buildease.auth.Actor;
import com.buildease.common.ApiException;
import com.buildease.common.Store;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class EmailTemplateService {
  private final Store db;

  public EmailTemplateService(Store db) {
    this.db = db;
  }

  private void platform(Actor a) {
    if (!a.admin()
        || db.find("select 1 from accounts where id=? and active and platform_admin", a.id())
            .isEmpty()) throw ApiException.forbidden();
    db.context(a.id(), null, a.impersonatedBy());
  }

  public List<Map<String, Object>> list(Actor a) {
    platform(a);
    return db.rows("select template_key,subject,body from email_templates order by template_key");
  }

  public Map<String, Object> get(Actor a, EmailTemplateKey key) {
    platform(a);
    return db.one(
        "select template_key,subject,body from email_templates where template_key=?", key.name());
  }

  public void update(Actor a, EmailTemplateKey key, String subject, String body) {
    platform(a);
    db.update(
        "update email_templates set subject=?,body=?,updated_at=now(),updated_by=? where template_key=?",
        subject.trim(),
        body.trim(),
        a.id(),
        key.name());
    db.audit(a.id(), null, "SETTINGS_UPDATED", a.id());
  }

  public record Rendered(String subject, String body) {}

  public Rendered render(EmailTemplateKey key, String link) {
    var row = db.one("select subject,body from email_templates where template_key=?", key.name());
    return new Rendered(
        (String) row.get("subject"), ((String) row.get("body")).replace("{{link}}", link));
  }
}
