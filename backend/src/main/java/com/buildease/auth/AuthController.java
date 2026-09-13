package com.buildease.auth;

import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthService auth;
  private final boolean secure;

  public AuthController(AuthService auth, @Value("${app.secure-cookies}") boolean secure) {
    this.auth = auth;
    this.secure = secure;
  }

  public record Login(
      @NotBlank @Email @Size(max = 254) String email, @NotBlank @Size(max = 256) String password) {}

  public record Change(
      @NotBlank @Size(max = 256) String oldPassword,
      @NotBlank @Size(max = 256) String newPassword) {}

  @GetMapping("/csrf")
  Map<String, String> csrf(CsrfToken token) {
    return Map.of("token", token.getToken(), "headerName", token.getHeaderName());
  }

  @PostMapping("/login")
  Map<String, Object> login(
      @Valid @RequestBody Login body, HttpServletRequest req, HttpServletResponse res) {
    return response(auth.login(body.email(), body.password(), req.getRemoteAddr()), res);
  }

  @PostMapping("/refresh")
  Map<String, Object> refresh(
      @CookieValue(name = "BE_REFRESH", required = false) String refresh, HttpServletResponse res) {
    return response(auth.refresh(refresh), res);
  }

  @PostMapping("/logout")
  ResponseEntity<Void> logout(
      @CookieValue(name = "BE_REFRESH", required = false) String refresh,
      @RequestAttribute(name = "actor", required = false) Actor actor,
      HttpServletResponse res) {
    auth.logout(refresh, actor);
    clear(res);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/me")
  Map<String, Object> me(@RequestAttribute Actor actor) {
    return auth.me(actor);
  }

  @PostMapping("/change-password")
  ResponseEntity<Void> change(
      @RequestAttribute Actor actor, @Valid @RequestBody Change body, HttpServletResponse res) {
    auth.changePassword(actor, body.oldPassword(), body.newPassword());
    clear(res);
    return ResponseEntity.noContent().build();
  }

  private Map<String, Object> response(AuthService.Tokens tokens, HttpServletResponse res) {
    res.addHeader(
        HttpHeaders.SET_COOKIE,
        ResponseCookie.from("BE_REFRESH", tokens.refreshToken())
            .httpOnly(true)
            .secure(secure)
            .sameSite("Strict")
            .path("/api/auth")
            .maxAge(604800)
            .build()
            .toString());
    res.setHeader("Cache-Control", "no-store");
    return Map.of(
        "accessToken", tokens.accessToken(), "mustChangePassword", tokens.mustChangePassword());
  }

  private void clear(HttpServletResponse res) {
    res.addHeader(
        HttpHeaders.SET_COOKIE,
        ResponseCookie.from("BE_REFRESH", "")
            .httpOnly(true)
            .secure(secure)
            .sameSite("Strict")
            .path("/api/auth")
            .maxAge(0)
            .build()
            .toString());
  }
}
