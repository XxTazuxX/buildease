# Code quality and verification

Load for quality tooling, verification, CI checks, or dependency work.

## Intended tooling
Backend: Spotless, Checkstyle, PMD, SpotBugs, JaCoCo, ArchUnit, Maven Enforcer. Frontend: ESLint, Prettier, TypeScript strict mode, Vitest coverage. SonarQube for IDE/SonarLint may provide editor feedback.

Inspect current configuration before claiming a tool or command exists. Target commands:
- Backend: `cd backend && ./mvnw verify` — compile, tests, configured integration tests, formatting, static analysis, coverage, architecture, dependency rules.
- Frontend: `cd frontend && npm run quality` — typecheck, lint, format check, tests, coverage.
- Whole project: `make verify`.

Only claim checks actually run; state missing scripts or environment blockers. Do not introduce all target tools merely because this file lists them. Java tool/plugin changes also require [java-dependencies.md](java-dependencies.md).

## Completion criteria
For significant changes, verify applicable acceptance behavior, module ownership, architecture, domain rules, tests actually run/passing, formatting, static analysis, TypeScript, architecture/dependency checks, migrations, authorization, secret safety, graph freshness, and necessary documentation. Load the owning topical file only when that concern applies. Written code alone is not completion.

Reports must distinguish implemented, compiled, unit tested, integration tested, quality verified, and E2E verified. Dependency-specific evidence belongs to [java-dependencies.md](java-dependencies.md).

## Change discipline
Avoid combining features, large refactors, broad upgrades, and unrelated cleanup unless necessary. Mention discovered technical debt separately. Before adding a package style, DTO/mapper strategy, response envelope, exception format, framework, or frontend abstraction, inspect existing conventions.

Before adding a library, check whether the current stack or Java/Spring/React already solves the problem, maintenance, compatibility, and whether the benefit justifies the dependency. Avoid libraries merely to save a few simple lines.
