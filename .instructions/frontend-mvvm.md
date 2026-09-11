# Frontend modular MVVM

Load for React features, frontend architecture, client state, or API integration.

## Stack
Target React, TypeScript, Vite, Material UI, React Router, TanStack Query, React Hook Form, Zod, Axios or Fetch, Recharts, and Day.js. Do not introduce Next.js without a real requirement.

## Layer ownership
Dependency direction: View → ViewModel → Model → Shared. Avoid circular dependencies. Model must not depend on View or ViewModel; Shared must not depend on a specific business module.

| Layer | Owns |
| --- | --- |
| Model | Domain/API types, Zod schemas, API adapters, query keys, mappings, normalization, pure calculations and transformations |
| ViewModel | Usually React hooks; queries/mutations, loading/errors, local interaction state, forms, navigation, invalidation, dialogs, derived presentation state |
| View | Pages, components, forms, tables, dialogs, layout, presentation, interactions, accessibility |

Views consume ViewModels. They must not call Axios directly, contain backend URLs, implement financial rules, duplicate backend domain logic, or orchestrate complex queries. Frontend validation improves UX; server rules remain authoritative.

## Modules and shared code
Business behavior belongs in `modules/`. Expose intentional public APIs through `modules/<module>/index.ts`; prefer `@/modules/tenants` to deep internal imports. Use `@/app/*`, `@/modules/*`, and `@/shared/*` aliases instead of long relative paths.

Shared code may include DataTable, ConfirmDialog, PageHeader, HTTP infrastructure, useDebounce, date utilities, and PagedResponse. Keep building/tenant/payment-specific behavior in its module.

## Data, forms, and routing
- Cross-module HTTP infrastructure lives in `shared/api/` (httpClient, apiError, interceptors). Domain endpoints live in `modules/<module>/model/<domain>.api.ts`; avoid a giant API service.
- Use relative `/api/...` URLs and a Vite development proxy. Never hardcode localhost, Codespaces forwarding domains, or production domains in client endpoint code.
- TanStack Query owns server state. The module owns query keys; do not scatter query strings through Views. A key factory may expose `all`, `lists()`, and `detail(id)`.
- Form flow: Zod schema → React Hook Form → ViewModel → mutation → Model/API.
- Modules may own route configuration; the app router composes modules. Avoid an ever-growing monolithic routing file.

Load [folder-structure.md](folder-structure.md) when creating/moving modules, and [testing-tdd.md](testing-tdd.md) for behavior changes.
