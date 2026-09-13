package com.buildease.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.*;

@Configuration
@ConditionalOnProperty(name = "spring.flyway.enabled", matchIfMissing = true, havingValue = "true")
public class MigrationConfig {
  @Bean
  FlywayMigrationStrategy migrations(
      @Value("${spring.flyway.placeholders.runtimeRole}") String runtimeRole) {
    if (!runtimeRole.matches("[a-z][a-z0-9_]{0,62}"))
      throw new IllegalArgumentException("DB_USERNAME must be a lowercase SQL identifier");
    return flyway -> flyway.migrate();
  }
}
