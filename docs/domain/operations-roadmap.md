# Building and tenant operations roadmap

Each phase is independently deployable. Every phase adds forward-only Flyway migrations, keeps prior APIs compatible, and runs its own tests together with all earlier tests.

- [x] Phase 1 — Building profiles, levels/zones, flexible spaces, controlled space status, owner configuration, and tenant-isolated read access.
- [ ] Phase 2 — Tenant applications, consented screening checklists, tenant records, household occupants, and assignment readiness.
- [ ] Phase 3 — Lease drafts, activation, renewal, transfer, notice, move-out, occupancy history, deposits, and private documents.
- [ ] Phase 4 — Tenant maintenance tickets, triage, assignment, work logs, costs, SLA tracking, and resolution confirmation.
- [ ] Phase 5 — Security checkpoints, patrol schedules, visitor logs, incidents, inspections, and evidence.
- [ ] Phase 6 — Utility meters, readings, tariffs, fixed/area/occupant allocation, review, and billing approval.
- [ ] Phase 7 — Recurring charges, invoices, manual payments, allocations, balances, adjustments, refunds, and receipts.
- [ ] Phase 8 — Rule-based checks for screening, lease expiry, overdue balances, missing documents, inspections, urgent tickets, patrols, and vacant-space readiness.
- [ ] Phase 9 — Operational dashboards, reports, exports, in-app notifications, recovery tools, and end-to-end hardening.

External tenant screening is adapter-ready and manual until a provider is selected. Documents use private S3-compatible storage when Phase 3 begins. Online payment collection and email/SMS delivery remain separate integrations after the internal ledger and in-app notification workflows are stable.
