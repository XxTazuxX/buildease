package com.buildease.onboarding;

import com.buildease.mail.MailSettingsService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class IdentityMail {
  private final MailSettingsService mail;
  private final EmailTemplateService templates;
  private final String publicUrl;

  public IdentityMail(
      MailSettingsService mail,
      EmailTemplateService templates,
      @Value("${app.public-url}") String publicUrl) {
    this.mail = mail;
    this.templates = templates;
    this.publicUrl = publicUrl.replaceAll("/+$", "");
  }

  public void verification(String recipient, String token) {
    var rendered =
        templates.render(EmailTemplateKey.VERIFICATION, publicUrl + "/verify?token=" + token);
    mail.send(recipient, rendered.subject(), rendered.body());
  }

  public void passwordReset(String recipient, String token) {
    var rendered =
        templates.render(
            EmailTemplateKey.PASSWORD_RESET, publicUrl + "/reset-password?token=" + token);
    mail.send(recipient, rendered.subject(), rendered.body());
  }
}
