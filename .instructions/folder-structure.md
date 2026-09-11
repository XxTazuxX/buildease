# Folder and package ownership

Load when creating/moving files, changing package boundaries, or refactoring architecture. These are target locations; preserve coherent existing structure rather than mass-moving files to match a template.

## Repository ownership
| Path | Responsibility |
| --- | --- |
| `.instructions/` | Modular agent guidance; root `AGENTS.md` routes by task |
| `.devcontainer/` | Codespaces configuration and lifecycle scripts |
| `.github/workflows/` | CI/security workflows; `.github/dependabot.yml` for dependency automation |
| `backend/` | Spring Boot application, Maven wrapper and POM |
| `frontend/` | React application, package/lock files, TypeScript and Vite configuration |
| `docs/architecture/`, `docs/decisions/`, `docs/api/`, `docs/domain/` | Durable design, ADRs, API and domain documentation |
| `scripts/dev/`, `scripts/ci/`, `scripts/maintenance/` | Repository automation |
| `.local/` | Ignored temporary local files |
| `graphify-out/` | Generated knowledge graph artifacts |

Root may contain `.gitignore`, Makefile, AGENTS.md, and README.md. Keep meaningful ADRs in `docs/decisions/`, e.g. Neon PostgreSQL, modular MVVM, Testcontainers, or React/Vite decisions. Avoid documentation for trivial implementation details.

## Backend
Target production source: `backend/src/main/java/com/buildease/`; tests: `backend/src/test/java/com/buildease/`; resources: `backend/src/main/resources/`. Migration placement is owned by [database-neon.md](database-neon.md).

Prefer feature/domain packages: building, room, tenant, lease, billing, payment, maintenance, expense, user, security, common, config. A small building module may keep Building, BuildingController, BuildingService, and BuildingRepository together. As complexity warrants, split into domain, application, persistence, api, dto, mapper, and exception subpackages.

`common/` is only for truly cross-domain concerns such as shared API errors, generic pagination, and base auditing primitives. Keep domain-specific behavior in its owner.

## Frontend
Under `frontend/src/`:
- `app/`: router, providers, theme, config.
- `modules/`: buildings, rooms, tenants, leases, billing, payments, maintenance as needed.
- `shared/`: components, hooks, api, utils, types, validation.
- `test/`: fixtures, mocks, setup.ts.
- `App.tsx`, `main.tsx`: application entrypoints.

A mature `modules/tenants/` may have model (`tenant.types.ts`, `.schema.ts`, `.api.ts`, `.mapper.ts`, `.queryKeys.ts`), viewmodel (`useTenantListViewModel.ts`, `useTenantDetailsViewModel.ts`, `useTenantFormViewModel.ts`), view (list/detail pages, form, components), routes (`tenant.routes.tsx`), tests, and `index.ts`. Layer responsibilities belong to [frontend-mvvm.md](frontend-mvvm.md).

## Creation and generated files
Create a directory only for a clear responsibility; avoid deep trees with single files. Before placing a file identify backend/frontend, domain owner, production/test/configuration, feature-specific/shared, and an existing nearby location that fits.

Normally ignore `backend/target/`, `frontend/node_modules/`, `frontend/dist/`, `frontend/coverage/`, `*.log`, and `.local/`. Do not manually edit generated code. Add nested AGENTS.md only when justified, without duplicating the modular guidance or contradicting root rules.
