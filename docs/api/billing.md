# SaaS billing API

BuildEase bills customer organizations with manual invoices: the platform operator assigns plans and records payments received out of band (bank transfer, card terminal). No payment processor is involved. Amounts are `numeric(14,2)` and serialize as JSON numbers.

## Lifecycle

| Status | Meaning | Can create buildings, units, staff? |
| --- | --- | --- |
| TRIALING | Self-registered workspace on the free trial (`trial_ends_on`) | Yes until the trial ends, then read-only |
| ACTIVE | Paying customer | Yes, within plan limits |
| PAST_DUE | An issued invoice passed its due date | Yes (grace) |
| SUSPENDED | Operator suspended the account; the organization is disabled | No (organization locked) |
| CANCELLED | Subscription ended | No |

- Self-registration starts a 14-day trial on the hidden `TRIAL` plan. Organizations created by a platform administrator start `ACTIVE` on Professional, and existing organizations were grandfathered onto Professional.
- Plan limits (`max_buildings`, `max_spaces`, `max_staff`, `null` = unlimited) are enforced when creating buildings, spaces, owners and staff roles. Tenants and vendors never use a seat. A blocked create returns **402** with an upgrade message.
- The billing job (same cadence as other automations) issues a renewal invoice at the start of every paid period (due in 14 days, emailed to the billing contact or owners), marks unpaid invoices `OVERDUE` and moves the subscription to `PAST_DUE`. Recording payment of the last overdue invoice returns it to `ACTIVE`. Suspension is always a deliberate operator action.

## Organization endpoints

| Endpoint | Access | Request / behavior |
| --- | --- | --- |
| GET /api/public/plans | Anyone | Active, public plans for the pricing page |
| GET /api/organizations/{org}/billing/status | Any active member | status, planCode, planName, trialEndsOn, trialDaysLeft, writable |
| GET /api/organizations/{org}/billing | Owners | Subscription, plan, usage vs limits, pending request, billing profile |
| PATCH /api/organizations/{org}/billing | Owners | billingEmail, billingName, billingAddress, taxId |
| POST /api/organizations/{org}/billing/plan-request | Owners | planId, cycle (`MONTHLY`/`ANNUAL`); awaits operator approval |
| DELETE /api/organizations/{org}/billing/plan-request | Owners | Withdraws the pending request |
| GET /api/organizations/{org}/billing/invoices | Owners | Issued, overdue, paid and void invoices (drafts are hidden) |
| GET /api/organizations/{org}/billing/invoices/{invoice} | Owners | Invoice with `bill_to` details for printing |

Billing endpoints stay readable while an organization is suspended so owners can see what they owe.

## Platform endpoints (platform administrators)

| Endpoint | Request / behavior |
| --- | --- |
| GET /api/platform/billing/summary | MRR, ARR, subscription counts by status, pending requests, outstanding, overdue, collected in the last 30 days |
| GET /api/platform/plans | Every plan, including hidden and retired ones |
| POST /api/platform/plans, PUT /api/platform/plans/{plan} | code, name, description, monthlyPrice, annualPrice, currency, maxBuildings, maxSpaces, maxStaff, features[], trialDays, publiclyListed, active, sortOrder |
| GET /api/platform/subscriptions?status=&pending=&page= | Organizations with their subscription and pending request |
| PUT /api/platform/subscriptions/{org} | planId, status, cycle, trialEndsOn (TRIALING), periodEnd (optional); `SUSPENDED` disables the organization, any other status re-enables it; activating starts a new period today |
| POST /api/platform/subscriptions/{org}/approve-request, /decline-request | Applies (as `ACTIVE`) or clears the owner's request |
| GET /api/platform/invoices?organizationId=&status=&page=, GET /api/platform/invoices/{invoice} | Invoice register |
| POST /api/platform/invoices | organizationId plus either nothing (bill the current plan and period) or description + amount; tax, notes optional. Creates a `DRAFT` with number `BE-{year}-{sequence}` |
| POST /api/platform/invoices/{invoice}/issue | dueOn optional (default 14 days); emails the customer |
| POST /api/platform/invoices/{invoice}/pay | paidOn, method, reference (all optional) |
| POST /api/platform/invoices/{invoice}/void | reason (optional); paid invoices cannot be voided |

Invalid transitions return **409**. Row-level security lets customers read only their own subscription and invoices, and only platform administrators can write invoices.
