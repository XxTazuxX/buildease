package com.buildease.security;

import java.util.Set;

public final class RolePolicy {
  private RolePolicy() {}

  public static boolean mayGrant(boolean owner, boolean manager, Role target) {
    return owner || manager && target != Role.PROPERTY_MANAGER;
  }

  public static Set<String> permissions(Role role) {
    return switch (role) {
      case PROPERTY_MANAGER ->
          Set.of(
              "self:read",
              "building:manage",
              "members:delegate",
              "operations:write",
              "maintenance:manage");
      case ACCOUNTANT -> Set.of("self:read", "finance:read", "finance:write");
      case MAINTENANCE_STAFF -> Set.of("self:read", "maintenance:assigned");
      case SECURITY_OPERATIONS_STAFF -> Set.of("self:read", "operations:write");
      case TENANT -> Set.of("self:read", "occupancy:own", "billing:own", "requests:own");
      case VENDOR -> Set.of("self:read", "maintenance:assigned");
    };
  }
}
