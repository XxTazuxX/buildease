package com.buildease.config;

import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(100)
@ConditionalOnProperty(name = "app.migrate-only", havingValue = "true")
public class MigrationOnly implements ApplicationRunner {
  private final ConfigurableApplicationContext context;

  public MigrationOnly(ConfigurableApplicationContext context) {
    this.context = context;
  }

  public void run(ApplicationArguments args) {
    SpringApplication.exit(context);
  }
}
