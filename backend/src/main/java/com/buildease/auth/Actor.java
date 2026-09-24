package com.buildease.auth;

import java.util.UUID;

public record Actor(
    UUID id, UUID sessionId, boolean admin, boolean mustChangePassword, UUID impersonatedBy) {
  public Actor(UUID id, UUID sessionId, boolean admin, boolean mustChangePassword) {
    this(id, sessionId, admin, mustChangePassword, null);
  }
}
