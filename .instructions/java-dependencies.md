# Java dependencies and Maven plugins

Load before adding, removing, or upgrading Java dependencies, BOMs, exclusions, or Maven plugins.

## Evidence and selection
Every material change requires investigation. Never invent coordinates or plugin versions, copy versions from memory, choose newest blindly, add arbitrary libraries/repositories, or override Boot-managed versions without justification.

Research current information on the web using official library docs → Spring docs → Maven Central metadata → official project/releases → migration/release notes. Prefer those over tutorials. If internet access is unavailable, prefer existing BOM-managed versions, do not guess explicit versions, and disclose the verification limit.

Select compatible → supported → secure → stable → latest within those constraints. Verify Java 21, Spring Boot/Framework, Hibernate, Jakarta APIs, test ecosystem, and plugin compatibility.

## Mandatory workflow
Inspect `pom.xml` → determine Java and Spring Boot versions → inspect effective dependency management → research current official information → verify groupId/artifactId → check Boot/BOM ownership and compatibility → inspect current dependency tree → select strategy → edit POM → resolve → inspect resulting tree → test → verify → report evidence.

Prefer official ecosystem BOMs, including Spring Boot and Testcontainers when applicable. Normally omit versions managed by Spring Boot. Give each dependency one intentional version owner; avoid accidental competition among parent, BOM, dependencyManagement, explicit versions, and profiles.

Declare dependencies explicitly when source directly uses their classes. Use compile/default for production, runtime for runtime-only implementations, and test for test libraries. Do not expose JUnit/Mockito/Testcontainers as production dependencies. Avoid SNAPSHOT by default, LATEST, RELEASE, ranges, wildcards, and dynamic versions.

## Compatibility safeguards
- Do not add competing JSON stacks, connection pools, logging implementations, ORMs, or redundant HTTP clients without need.
- Prefer Boot-managed logging. Avoid multiple SLF4J providers, bridge loops, and incompatible SLF4J/Logback/Log4j/JUL pins.
- Check `jakarta.*` versus legacy Java EE `javax.*`; do not accidentally introduce obsolete APIs.
- Keep Hibernate in Boot's managed generation unless strong evidence supports an override; check extensions against the exact generation.
- Prefer `spring-boot-starter-security`; do not mix Spring Security generations.
- Treat Boot Test, JUnit Jupiter, Mockito, AssertJ, Testcontainers, and ArchUnit as one compatible ecosystem.
- Use official PostgreSQL JDBC; Neon does not require a special Java driver absent a demonstrated requirement.
- For Flyway, verify Boot compatibility, PostgreSQL support, and required modules for the installed generation.

Apply the same diligence to Compiler, Surefire, Failsafe, Enforcer, JaCoCo, Spotless, Checkstyle, PMD, SpotBugs, and Boot Maven plugins. Verify exact current Enforcer syntax when implementing Java/Maven constraints, dependencyConvergence, requireUpperBoundDeps, or requireReleaseDeps.

Prefer Maven Central and trusted official sources. Unknown third-party repositories require explicit justification. Before any exclusion, determine its origin, dependents, resolved version, safe replacement, and test evidence; never exclude merely to silence warnings.

## Verification and reporting
Run at minimum from `backend/`: `./mvnw dependency:tree`, `./mvnw test`, and `./mvnw verify`. Use `./mvnw help:effective-pom` when version ownership is unclear; consider it and `./mvnw dependency:analyze` for significant changes. Investigate warnings rather than applying mechanical fixes.

Compilation/resolution is insufficient for runtime effects: test database integration, Flyway against PostgreSQL Testcontainers, security, or serialization/API behavior as affected.

For vulnerabilities, establish actual exposure, check Boot guidance, choose supported patches, prefer a platform upgrade when appropriate, inspect the resulting tree, and verify. Many manual Spring overrides are a signal to consider a Boot platform upgrade instead.

Keep upgrades isolated and reviewable. For major upgrades, read release/migration notes, identify breaks, inspect usage and Graphify blast radius, update tests, and perform the upgrade separately.

Final dependency report: changed dependency; previous effective version where relevant; resulting effective version; Boot/BOM ownership; compatibility source; reason; tree result; tests run; exclusions and rationale; remaining warnings.
