# BuildEase

Java 21 / Spring Boot and React / TypeScript building-management foundation with JWT authentication, organization isolation, delegated building roles, and Flyway migrations.

## Local verification (no Neon credentials needed)

Requires Java 21, Node 22, and Docker. The Maven wrapper pins Maven; npm's lockfile pins frontend packages.

```bash
cd frontend
npm ci
npx playwright install --with-deps chromium
cd ..
make verify
```

`make verify` runs backend unit/integration/architecture/format/dependency checks, frontend type/lint/format/test/build checks, and real browser workflows. Integration and browser tests create disposable PostgreSQL containers and never use the configured Neon database. Tests currently default to PostgreSQL 17; set `TEST_POSTGRES_IMAGE` to the same major as your Neon database after verifying `SHOW server_version`.

## Connect to a new Neon development database

1. Rotate any credential previously pasted into chat. Configure replacement values as Codespaces or deployment environment secrets using the names in [.env.example](.env.example). This file contains placeholders, not credentials. Spring Boot does not automatically load `.env` files.
2. Use a direct JDBC endpoint for `MIGRATION_DB_URL`, with the migration/owner user. Use the pooled endpoint for `DB_URL`, with a new `buildease_runtime` user and a random password of at least 24 characters. Neon JDBC URLs should use `sslmode=require&channelBinding=require`; pgJDBC `verify-full` additionally requires a configured root certificate. The JDBC property is `channelBinding`, not `channel_binding`.
3. Configure `JWT_SECRET` as base64 encoding at least 32 random bytes, delivered through secrets. `SECURE_COOKIES` defaults to true. Only for local HTTP development, explicitly set it to false; Codespaces HTTPS and production use true.
4. Provision the runtime role once, then migrate:

```bash
scripts/maintenance/provision-database.sh
scripts/maintenance/migrate.sh
```

Provisioning deliberately refuses to overwrite an existing database role. It needs role-creation privileges and does not print passwords. In managed environments where role creation is delegated, provision the same restricted role through Neon first. Flyway grants privileges during migration. The running application refuses owner/superuser/BYPASSRLS connections.

5. Configure `BOOTSTRAP_EMAIL` and `BOOTSTRAP_PASSWORD` through secrets, then run `make bootstrap`. This creates the first platform administrator and exits. Bootstrap refuses if any platform administrator already exists. Remove bootstrap secrets afterward. Sign in and replace the temporary password within 24 hours.
6. Start each application in a separate terminal:

```bash
make dev-backend
make dev-frontend
```

Open port 5173. Vite proxies `/api` to port 8080. Create organizations and initial owners through Administration; deliver new-account temporary passwords privately. Existing users accept invitations after login. Owners manage buildings and memberships; property managers delegate only permitted roles in assigned buildings.

## Schema and deployment

Flyway versioned SQL in `backend/src/main/resources/db/migration/` owns schema changes. Hibernate validates its mapped identity entity; tests verify additional constraints and RLS. Never use `ddl-auto=update`, edit applied migrations, enable baselining on an unknown database, or run destructive tests against Neon.

Before deployment: run verification, review the next migration, take a Neon branch/restore checkpoint, apply migrations with the direct connection, verify `flyway_schema_history`, then start the application. For deployments with a separate migration job, disable application Flyway using `SPRING_FLYWAY_ENABLED=false` and keep migration credentials out of the runtime environment. Correct deployed mistakes with a new forward migration; do not automatically drop schema or rewrite history.

A failed startup/migration must block rollout. Check a non-secret startup log, GET `/api/auth/csrf`, and a designated administrator login/profile/logout smoke flow. Do not include tokens, cookies, credential-bearing URLs, or passwords in logs or support reports. Audit events record actor, target, action, organization, and time without credentials.

The initial implementation is not a subscription/billing platform: public signup, email delivery/recovery, MFA, and operational lease/billing/maintenance modules are outside this release. Platform administrators can reset expired temporary passwords; retain more than one active administrator for recovery.

- [API contracts](docs/api/authentication.md)
- [Security boundaries and role model](docs/architecture/authentication.md)
- [Dependency evidence](docs/decisions/ADR-001-auth-foundation.md)
- [Instruction router](AGENTS.md)
