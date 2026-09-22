package com.buildease.onboarding;

import com.buildease.common.ApiException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
public class IdentityMail {
  private final ObjectProvider<JavaMailSender> senders;
  private final String from;
  private final String publicUrl;

  public IdentityMail(
      ObjectProvider<JavaMailSender> senders,
      @Value("${app.mail-from:}") String from,
      @Value("${app.public-url}") String publicUrl) {
    this.senders = senders;
    this.from = from;
    this.publicUrl = publicUrl.replaceAll("/+$", "");
  }

  public void verification(String recipient, String token) {
    send(
        recipient,
        "Verify your BuildEase workspace",
        "Complete your BuildEase registration:\n\n"
            + publicUrl
            + "/verify?token="
            + token
            + "\n\nThis link expires in 30 minutes.");
  }

  public void passwordReset(String recipient, String token) {
    send(
        recipient,
        "Reset your BuildEase password",
        "Reset your BuildEase password:\n\n"
            + publicUrl
            + "/reset-password?token="
            + token
            + "\n\nThis link expires in 30 minutes. If you did not request it, ignore this email.");
  }

  private void send(String recipient, String subject, String body) {
    JavaMailSender sender = senders.getIfAvailable();
    if (sender == null || from.isBlank())
      throw new ApiException(503, "Identity email is not configured");
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
}
