package com.buildease.security;

import com.buildease.auth.*;
import com.buildease.common.ApiException;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.*;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.*;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.*;
import org.springframework.security.web.csrf.*;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
public class SecurityConfig {
  @Bean
  PasswordEncoder passwordEncoder() {
    return new DelegatingPasswordEncoder("bcrypt", Map.of("bcrypt", new BCryptPasswordEncoder(12)));
  }

  @Bean
  SecretKeySpec signingKey(@Value("${app.jwt-secret}") String secret) {
    byte[] bytes = Base64.getDecoder().decode(secret);
    if (bytes.length < 32)
      throw new IllegalArgumentException(
          "JWT_SECRET must be base64 encoding at least 32 random bytes");
    return new SecretKeySpec(bytes, "HmacSHA256");
  }

  @Bean
  JwtEncoder encoder(SecretKeySpec key) {
    return new NimbusJwtEncoder(new ImmutableSecret<>(key));
  }

  @Bean
  JwtDecoder decoder(SecretKeySpec key) {
    var decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
    decoder.setJwtValidator(
        new DelegatingOAuth2TokenValidator<>(
            JwtValidators.createDefaultWithIssuer("buildease"),
            jwt ->
                jwt.getAudience().contains("buildease-api")
                    ? OAuth2TokenValidatorResult.success()
                    : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token"))));
    return decoder;
  }

  @Bean
  @org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication
  SecurityFilterChain security(
      HttpSecurity http, AuthService auth, @Value("${app.secure-cookies}") boolean secure)
      throws Exception {
    var csrf = new CookieCsrfTokenRepository();
    csrf.setCookieCustomizer(c -> c.secure(secure).sameSite("Strict").path("/"));
    http.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .csrf(
            c ->
                c.csrfTokenRepository(csrf)
                    .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
        .authorizeHttpRequests(
            a ->
                a.requestMatchers(
                        "/api/auth/csrf",
                        "/api/auth/login",
                        "/api/auth/refresh",
                        "/api/auth/logout",
                        "/api/auth/register",
                        "/api/auth/verify",
                        "/api/auth/forgot-password",
                        "/api/auth/reset-password",
                        "/api/impersonation/refresh")
                    .permitAll()
                    .requestMatchers("/api/**")
                    .authenticated()
                    .anyRequest()
                    .permitAll())
        .oauth2ResourceServer(o -> o.jwt(j -> {}))
        .exceptionHandling(
            e ->
                e.authenticationEntryPoint((req, res, ex) -> error(res, 401))
                    .accessDeniedHandler((req, res, ex) -> error(res, 403)))
        .addFilterAfter(
            new OncePerRequestFilter() {
              protected void doFilterInternal(
                  HttpServletRequest req, HttpServletResponse res, FilterChain chain)
                  throws ServletException, IOException {
                var authentication =
                    org.springframework.security.core.context.SecurityContextHolder.getContext()
                        .getAuthentication();
                if (authentication instanceof JwtAuthenticationToken token) {
                  Actor actor;
                  try {
                    actor = auth.authenticate(token.getToken());
                  } catch (ApiException | IllegalArgumentException e) {
                    error(res, 401);
                    return;
                  }
                  req.setAttribute("actor", actor);
                  // The forced-password-change lockout is about the real credential holder's own
                  // session; it must not block an admin viewing as someone else.
                  if (actor.impersonatedBy() == null
                      && actor.mustChangePassword()
                      && !Set.of("/api/auth/change-password", "/api/auth/logout", "/api/auth/csrf")
                          .contains(req.getRequestURI())) {
                    error(res, 403);
                    return;
                  }
                }
                chain.doFilter(req, res);
              }
            },
            BearerTokenAuthenticationFilter.class);
    return http.build();
  }

  private static void error(HttpServletResponse res, int status) throws IOException {
    res.setStatus(status);
    res.setContentType("application/json");
    res.getWriter().write("{\"message\":\"Authentication or permission required\"}");
  }
}
