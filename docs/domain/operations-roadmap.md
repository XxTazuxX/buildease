# Building and tenant operations roadmap

Each phase is independently deployable. Every phase adds forward-only Flyway migrations, keeps prior APIs compatible, and runs its own tests together with all earlier tests.

- [x] Phase 1 — Building profiles, levels/zones, flexible spaces, controlled space status, owner and property-manager configuration, and tenant-isolated read access.
- [x] Phase 2 — Prospects and applications, screening records (manual/adapter), tenant records, household occupants, and assignment readiness.
- [x] Phase 3 — Lease drafts, e-signatures, activation, deposits, ending and automatic expiry, occupancy history. *Not yet:* renewal, transfer, notice workflows and private lease documents.
- [x] Phase 4 — Tenant maintenance tickets, triage, assignment, work logs, costs, SLA tracking, resolution confirmation, recurring plans and auto-close.
- [ ] Phase 5 — Security checkpoints, patrol schedules, visitor logs and incidents. *Done:* move-in/out inspections with photo evidence and the asset registry.
- [ ] Phase 6 — Utility meters, readings, tariffs, fixed/area/occupant allocation, review, and billing approval. *Done:* asset meter readings.
- [x] Phase 7 — Recurring rent charges, per-period late fees, manual and online payments (stub gateway), balances, and deposit refunds/forfeits. *Not yet:* adjustments and receipts.
- [ ] Phase 8 — Rule-based checks. *Done:* overdue balances, lease expiry, stalled/overdue tickets, trial expiry and overdue subscription invoices. *Not yet:* missing documents, inspections due, patrols, vacant-space readiness.
- [x] Phase 9 — Dashboards, rent roll / income / occupancy / maintenance reports with CSV export, in-app notification inbox, audit logs, and end-to-end tests.
- [x] SaaS — Subscription plans, trials, plan limits, manual invoicing, operator revenue dashboard, public landing and pricing pages ([billing API](../api/billing.md)).

External providers are adapter boundaries with stub implementations until real accounts are chosen: tenant screening, online rent payments, listing syndication, accounting export and web push delivery. SMS is not implemented.
