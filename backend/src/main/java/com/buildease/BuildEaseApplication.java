package com.buildease;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class BuildEaseApplication {
  public static void main(String[] args) {
    SpringApplication.run(BuildEaseApplication.class, args);
  }
}
