package com.buildease.auth;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "accounts")
public class Account {
  @Id UUID id;

  @Column(nullable = false, length = 254)
  String email;

  @Column(name = "display_name", nullable = false, length = 120)
  String displayName;

  @Column(name = "password_hash", nullable = false, length = 255)
  String passwordHash;

  @Column(name = "platform_admin", nullable = false)
  boolean platformAdmin;

  @Column(nullable = false)
  boolean active;

  @Column(name = "must_change_password", nullable = false)
  boolean mustChangePassword;

  @Column(name = "temporary_password_expires_at")
  Instant temporaryPasswordExpiresAt;

  @Column(name = "created_at", nullable = false)
  Instant createdAt;

  protected Account() {}
}
