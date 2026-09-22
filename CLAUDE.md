# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Start here: AGENTS.md

This repository's actual operating rules live in [AGENTS.md](AGENTS.md), with modular detail in `.instructions/`. **Read AGENTS.md first, every session**, then load only the `.instructions/*.md` files matching the task category from its routing table (backend, frontend-mvvm, database-neon, testing-tdd, security, code-quality, git-ci, java-dependencies, architecture, folder-structure, graphify-context). Do not preload all instruction files. This CLAUDE.md is a supplement for command lookup and architecture orientation — it does not replace that router.

Non-negotiable rules from AGENTS.md worth repeating here: current source/tests are authoritative over these docs; make the smallest coherent change; never commit or print secrets; never run destructive tests against Neon (shared/production database); backend validation and authorization are authoritative, frontend checks are UX only; verify before claiming success.

## Commands

Requires Java 21, Node 22, and Docker (integration/E2E tests spin up disposable PostgreSQL Testcontainers — never the configured Neon database).

```bash
make verify          # full project: backend + frontend + e2e
make backend         # cd backend && ./mvnw verify
make frontend        # cd frontend && npm ci && npm run quality
make e2e             # cd frontend && npm run test:e2e (Playwright)
make dev-backend     # loads .env, runs Spring Boot on :8080
make dev-frontend    # Vite dev server on :5173, proxies /api -> :8080
make bootstrap       # one-time first platform administrator (needs BOOTSTRAP_EMAIL/PASSWORD)
```

Backend (`cd backend`):
- `./mvnw verify` — compile, unit + integration (Failsafe) tests, Spotless format check, JaCoCo coverage, ArchUnit architecture tests, dependency convergence enforcement.
- `./mvnw test -Dtest=ClassName` / `-Dtest=ClassName#methodName` — run a single test class/method.
- `./mvnw spotless:apply` — auto-fix formatting (Google Java Format) before `verify` fails on it.

Frontend (`cd frontend`):
- `npm run quality` — typecheck (`tsc -b`) + lint (ESLint) + `format:check` (Prettier) + `coverage` (Vitest) + `build`.
- `npm run test` — Vitest once; `npx vitest run path/to/file.test.tsx` for a single file; `npx vitest` for watch mode.
- `npm run test:e2e` — Playwright; `npx playwright test path/to/spec.ts` for a single spec (run `npx playwright install --with-deps chromium` once first).
- `npm run lint` / `npm run format` — ESLint / Prettier write mode.

First-time Neon setup, migrations, and credential rotation are documented in [README.md](README.md); do not improvise on those steps.

## Architecture

**Stack**: Java 21 / Spring Boot backend (Maven), React 19 / TypeScript frontend (Vite), PostgreSQL via Neon in deployed environments, Flyway-owned schema.

**Request flow (dev)**: browser → React/Vite `:5173` → Vite `/api` proxy → Spring Boot `:8080` → PostgreSQL. Production may bundle the built frontend into the Spring Boot JAR (serving `/` and `/api/**` from one process) — this is optional, not the default dev workflow.

### Backend — layered by feature package

`backend/src/main/java/com/buildease/<domain>` (current domains: `auth`, `automation`, `building`, `common`, `config`, `maintenance`, `notification`, `occupancy`, `onboarding`, `security`, `tenancy`). Dependency direction is strict: **Controller → Service/Application → Repository → PostgreSQL**.
- Repositories never depend on controllers or hold business rules; persistence entities are not automatically REST DTOs.
- Significant workflows (state transitions, money, occupancy/maintenance lifecycle) go through services, not controller-driven setters.
- `common/` is only for genuinely cross-domain concerns (shared API errors, pagination, audit primitives) — keep domain logic in its owning package.
- Money uses `BigDecimal`, never `float`/`double`.
- Schema changes are Flyway migrations under `backend/src/main/resources/db/migration/` (`V5__…`, `V6__…`, …); Hibernate is `ddl-auto=validate` in persistent environments, never `update`. Don't edit applied migrations — add a new forward migration.
- Security model: `security/Role.java` and `security/RolePolicy.java` define roles and access rules, enforced in `security/SecurityConfig.java`. Backend authorization is authoritative regardless of what the frontend shows.

### Frontend — modular MVVM

`frontend/src/` is organized as `app/` (router, providers, theme, config), `modules/<domain>/` (current modules: `admin`, `auth`, `buildings`, `maintenance`, `occupancy`, `onboarding`), and `shared/` (cross-module components, hooks, `api/` HTTP infra, utils). Within a module, dependency direction is **View → ViewModel → Model → Shared**:

| Layer | Owns |
| --- | --- |
| Model | API types, Zod schemas, API adapters (`*.api.ts`), query keys, mappers, pure transforms |
| ViewModel | Hooks: TanStack Query queries/mutations, loading/error state, forms, navigation, dialogs |
| View | Pages/components/forms/tables — no direct Axios/fetch calls, no backend URLs, no business rules |

- Modules expose a public surface via `modules/<module>/index.ts`; prefer importing `@/modules/tenants` over deep relative paths (aliases: `@/app/*`, `@/modules/*`, `@/shared/*`).
- Cross-module HTTP plumbing lives only in `shared/api/`; domain endpoints live in each module's `model/*.api.ts`.
- Use relative `/api/...` URLs — never hardcode localhost/Codespaces/production domains in client code (the Vite dev proxy and prod same-origin serving both depend on this).
- Server state is owned by TanStack Query; each module owns its own query-key factory (`all`, `lists()`, `detail(id)` convention).
- Form flow: Zod schema → React Hook Form → ViewModel → mutation → Model/API.

### Testing conventions

- Backend: JUnit 5 + AssertJ + Mockito + MockMvc + Spring Boot Test; PostgreSQL Testcontainers (not H2) for anything touching constraints, transactions, JPA mappings, or Flyway; ArchUnit enforces the layering rules above. Prefer unit → service → repository/Postgres → controller → cross-layer integration, not `@SpringBootTest` for everything.
- Frontend: Vitest + React Testing Library + jest-dom + user-event + MSW for Model/ViewModel/View unit tests; Playwright E2E for important workflows only.
- Apply strongest TDD discipline to occupancy, assignment, leases, billing, payments, maintenance transitions, and authorization — these are financial/state-integrity critical.

### Key references

- [docs/api/authentication.md](docs/api/authentication.md) — API contracts.
- [docs/architecture/authentication.md](docs/architecture/authentication.md) — security boundaries and role model.
- [docs/decisions/ADR-001-auth-foundation.md](docs/decisions/ADR-001-auth-foundation.md) — dependency evidence for the auth foundation.
- The maintenance-first release intentionally excludes billing/leases/rent/subscriptions/SMS/native apps/AI features (see README) — don't assume those exist or add them speculatively.
