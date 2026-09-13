package com.buildease.security;

import java.nio.charset.StandardCharsets;

public final class PasswordPolicy {
  private PasswordPolicy() {}

  public static void validate(String password) {
    if (password == null
        || password.codePointCount(0, password.length()) < 15
        || password.codePointCount(0, password.length()) > 64
        || password.getBytes(StandardCharsets.UTF_8).length > 72)
      throw new IllegalArgumentException(
          "Password must contain 15–64 characters and at most 72 UTF-8 bytes");
  }
}
