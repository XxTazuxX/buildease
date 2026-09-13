package com.buildease.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.*;

import com.tngtech.archunit.junit.*;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeClasses(
    packages = "com.buildease",
    importOptions = com.tngtech.archunit.core.importer.ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {
  @ArchTest
  static final ArchRule controllers_use_services =
      classes()
          .that()
          .haveSimpleNameEndingWith("Controller")
          .should()
          .onlyDependOnClassesThat()
          .resideOutsideOfPackages("org.springframework.jdbc..", "jakarta.persistence..")
          .because("HTTP controllers must not perform persistence");

  @ArchTest
  static final ArchRule repositories_do_not_depend_on_controllers =
      noClasses()
          .that()
          .haveSimpleName("Store")
          .should()
          .dependOnClassesThat()
          .haveSimpleNameEndingWith("Controller");
}
