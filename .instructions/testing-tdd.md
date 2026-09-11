# Testing and TDD

Load for behavior changes, regression fixes, test design, and migrations.

## Workflow
For meaningful business logic: understand requirement → acceptance criteria → write failing test → verify expected failure → implement minimum correct behavior → green → refactor → broader relevant tests → applicable quality checks. Use judgment for trivial configuration and boilerplate; do not add superficial tests after implementation merely for coverage.

Apply strongest TDD discipline to occupancy, assignment, leases, charges, invoices, payments, allocations, balances, deposits, move-in/out, maintenance transitions, authorization, and financial calculations.

## Backend
Use JUnit 5, AssertJ, Mockito, MockMvc, Spring Boot Test, PostgreSQL Testcontainers, ArchUnit, and JaCoCo.

Prefer domain/unit tests → service tests → repository/PostgreSQL tests → controller tests → cross-layer integration. Do not use `@SpringBootTest` for everything.

Use disposable PostgreSQL Testcontainers when testing constraints, transactions, JPA mappings, repository queries, Flyway, or PostgreSQL-specific behavior. H2 is not evidence of PostgreSQL equivalence. Database environment policy is owned by [database-neon.md](database-neon.md).

## Frontend
Use Vitest, React Testing Library, jest-dom, user-event, MSW, and Playwright.
- Model: schema validation, mappings, calculations, transformations.
- ViewModel: loading/errors, derived state, mutations, invalidation, forms.
- View: rendering, accessibility, interactions, user-visible behavior.
- E2E: important workflows only.

## Coverage and failures
An initial coverage target may be approximately 80%; prioritize critical business behavior over percentage. Never weaken valid tests or add useless tests to raise coverage.

On failure, read the actual error, identify the cause and whether code/config/test is wrong, fix the smallest relevant issue, run narrow verification, then broader relevant checks. Quality commands and completion criteria live in [code-quality.md](code-quality.md).
