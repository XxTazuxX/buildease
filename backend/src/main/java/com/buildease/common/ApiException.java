package com.buildease.common;

public class ApiException extends RuntimeException {
  public final int status;

  public ApiException(int status, String message) {
    super(message);
    this.status = status;
  }

  public static ApiException forbidden() {
    return new ApiException(403, "Access denied");
  }
}
