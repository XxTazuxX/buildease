package com.buildease.auth;

import java.util.UUID;

public record Actor(UUID id, UUID sessionId, boolean admin, boolean mustChangePassword) {}
