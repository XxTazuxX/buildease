# Product and architecture

Load for domain design, architecture decisions, planning, or the initial product audit. This is intended direction, not evidence that modules already exist.

## Product and workflows
BuildEase is a production-oriented building operations platform. Preserve useful existing Building, Room, Tenant, Payment, and MaintenanceRequest concepts if present; do not assume the handoff's approximate inventory matches the repository.

For every significant feature identify the real problem, actor, affected records, state changes, validation, retained history, permissions, acceptance tests, and affected modules. Model workflows rather than unrelated CRUD screens:
- Tenant → lease → unit assignment → occupancy → charges → payments → move-out.
- Lease → charge → invoice → payment → payment allocation → balance → adjustment/refund.
- Maintenance request → category → priority → assignment → status → cost → resolution.

## Domain invariants
- Use Java `BigDecimal` for money; never `float` or `double` for financial values.
- Keep Charge, Invoice, Payment, PaymentAllocation, Balance, Deposit, Expense, Refund, and Adjustment distinct.
- Preserve financial history through explicit adjustments, reversals, refunds, or state transitions rather than overwriting past records.
- Change critical lease, occupancy, move-in/out, invoice, payment, maintenance, and user states through explicit business operations. Validate transitions; do not expose arbitrary controller-driven setters for critical state.

## Direction and priorities
The intended system combines a Java/Spring backend, a modular MVVM React frontend, and PostgreSQL persistence. Load [backend.md](backend.md), [frontend-mvvm.md](frontend-mvvm.md), or [database-neon.md](database-neon.md) only for the boundary being changed. Prefer domain clarity, explicit ownership, testability, reproducibility, stable dependencies, and small reviewable changes over premature microservices or excessive abstractions.

Stabilize foundations before expanding scope: repository structure, Codespaces, dependency management, Neon, Flyway, backend tests, frontend tests, quality checks, CI, backend architecture, then modular MVVM.

Approximate product order, adapted to existing code: buildings; floors/rooms/units; tenants; occupancy/assignment; leases; billing; payments; maintenance; expenses; authentication/authorization expansion; reports/dashboard; additional operations. This ordering does not defer authorization needed by an earlier feature.

Later domains may include properties/apartments, recurring charges, deposits, utilities, staff/vendors, documents, notices/communication, assets, parking, tenant self-service, administration, and audit logs. Do not build all at once. AI classification, predictive maintenance, anomaly detection, OCR, document Q&A, natural-language reporting, and damage-image analysis follow correct core operations.

## Initial audit before new product functionality
Perform once, then reuse findings and update only changed facts. Start with Graphify and inspect a scoped repository tree. Check status/branch; devcontainer; Java/Maven/Node/npm/Docker; Codex/uv/Graphify availability; backend/frontend; current Spring Boot and dependencies; entities/repositories/services/controllers; tests; Flyway/database configuration without secrets; MVVM alignment; quality tools; GitHub Actions; Makefile; ignore rules; README. Missing tools/files are findings, not reasons to invent implementation.

Report current state, alignment, gaps, conflicts, risks (dependencies, schema, tests, secrets, architecture), and the five highest-value ordered next actions. Do not automatically execute mass migrations, refactors, dependency upgrades, or broad product features as part of the audit.

For current behavior, prioritize source → tests → migrations → Maven/npm configuration → repository docs → Graphify extracted relationships → inferred relationships → assumptions.
