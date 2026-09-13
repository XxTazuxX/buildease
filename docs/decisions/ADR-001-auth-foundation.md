# ADR-001: Authentication foundation dependencies

Java 21 with Spring Boot 3.5.16 is pinned for the repository's JUnit 5 / Testcontainers 1.x target. Boot 4.x is not introduced implicitly because it changes the test ecosystem and starter structure. A later platform upgrade should be isolated and validated. All Spring, Hibernate, Jackson, PostgreSQL, Flyway, and test-stack versions remain Boot-managed; no transitive exclusions were added.

Compatibility evidence:
- https://docs.spring.io/spring-boot/3.5/system-requirements.html
- https://docs.spring.io/spring-boot/3.5/appendix/dependency-versions/coordinates.html
- https://repo.maven.apache.org/maven2/org/springframework/boot/spring-boot-starter-parent/3.5.16/
- https://jdbc.postgresql.org/documentation/use/ (`channelBinding`, not libpq's `channel_binding`)
- https://neon.com/docs/connect/connection-pooling (direct migration connection)
- https://www.postgresql.org/docs/current/ddl-rowsecurity.html (owner/BYPASSRLS behavior)

ArchUnit 1.5.0 supplies architecture checks. Spotless 3.10.2, JaCoCo 0.8.15, Maven Wrapper 3.3.4, and Exec 3.6.4 were verified against their official Maven Central metadata. Maven Enforcer is Boot-managed. Frontend versions were verified against npm and installed exactly; package-lock.json is authoritative. No Java coordinates or versions pre-existed this foundation.

The development database's PostgreSQL version could not be inspected without replacement secrets. Tests default to PostgreSQL 17; set TEST_POSTGRES_IMAGE to the verified Neon major version before live rollout.

Nimbus JOSE JWT is declared directly because the encoder uses its JWKSource API. Boot does not manage this artifact directly; its explicit 9.37.4 version exactly matches Spring Security 6.5.11's published POM, without changing the effective transitive version. Evidence: https://repo.maven.apache.org/maven2/org/springframework/security/spring-security-oauth2-jose/6.5.11/spring-security-oauth2-jose-6.5.11.pom and https://github.com/spring-projects/spring-security/issues/17875 (backported security fix). Recheck this pin with platform upgrades.
