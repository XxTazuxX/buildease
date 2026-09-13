package com.buildease.security;

import static org.assertj.core.api.Assertions.*;

import org.junit.jupiter.api.Test;

class PoliciesTest {
  @Test
  void rejectsShortOrTruncatedPasswords() {
    assertThatThrownBy(() -> PasswordPolicy.validate("short"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> PasswordPolicy.validate("界".repeat(25)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> PasswordPolicy.validate("a".repeat(65)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatCode(() -> PasswordPolicy.validate("a long password phrase"))
        .doesNotThrowAnyException();
  }

  @Test
  void managersCannotEscalateAndNonManagersCannotDelegate() {
    for (Role role : Role.values()) {
      assertThat(RolePolicy.mayGrant(false, true, role)).isEqualTo(role != Role.PROPERTY_MANAGER);
      assertThat(RolePolicy.mayGrant(false, false, role)).isFalse();
      assertThat(RolePolicy.mayGrant(true, false, role)).isTrue();
    }
  }

  @Test
  void domainPermissionsDoNotGiveTenantFinancialAdministration() {
    assertThat(RolePolicy.permissions(Role.TENANT))
        .contains("self:read")
        .doesNotContain("finance:write");
    assertThat(RolePolicy.permissions(Role.ACCOUNTANT)).contains("finance:write");
    assertThat(RolePolicy.permissions(Role.MAINTENANCE_STAFF)).contains("maintenance:assigned");
  }
}
