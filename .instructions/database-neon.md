# Database and Neon

Load for persistence, SQL, migrations, database configuration, or schema changes.

## Environments
Use Neon PostgreSQL for persistent environments: a development branch/database for development and a separate production branch/database for production. Automated integration tests use disposable PostgreSQL Testcontainers. Detailed persistence testing belongs to [testing-tdd.md](testing-tdd.md); secret storage belongs to [security.md](security.md).

## Schema lifecycle
Use Flyway migrations under `backend/src/main/resources/db/migration/`, for example `V1__create_buildings.sql`, `V2__create_rooms.sql`, `V3__create_tenants.sql`, and `V4__create_leases.sql`.

Persistent environments should generally use `spring.jpa.hibernate.ddl-auto=validate`. Do not rely on Hibernate automatic schema mutation there. Create new migrations; do not edit applied production migrations unless explicitly required and proven safe.

Check existing mappings, constraints, transactions, repository queries, and migration history before changing persistence. Verify affected behavior against PostgreSQL, including migration execution.

Driver/Flyway additions or upgrades follow [java-dependencies.md](java-dependencies.md), including PostgreSQL support and generation-specific Flyway modules.
