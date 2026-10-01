# Maintenance API

All routes use JSON under `/api/organizations/{organization}/buildings/{building}/maintenance`. Managers are organization owners and the building's property managers. Assignees are staff accounts or vendor accounts linked to a work order on the request.

| Endpoint | Access | Request / behavior |
| --- | --- | --- |
| GET/POST /categories, PATCH /categories/{category} | Read: members; write: managers | name, responseHours, resolutionHours (SLA targets) |
| GET /requests?status=&priority=&page= | Scoped | Managers see all; tenants their own; assignees their assigned requests |
| POST /requests | Managers, tenants for their assigned space | spaceId, categoryId, title, description, impact, danger |
| GET /requests/{request} | Requester, assignee, manager | Includes history, work orders, logs, comments (internal comments hidden from residents), photos |
| POST /requests/{request}/triage | Managers | priority, reason; starts SLA clocks (`SUBMITTED` → `TRIAGED`) |
| POST /requests/{request}/assign-staff | Managers | accountId (must be maintenance staff or property manager in the building, or an owner), estimatedCost |
| POST /requests/{request}/assign-vendor | Managers | vendorId, estimatedCost |
| POST /requests/{request}/start | Managers, assignees | `ASSIGNED` → `IN_PROGRESS` |
| POST /requests/{request}/resolve | Managers, assignees | summary (required); completes the actor's work orders (managers: all) |
| POST /requests/{request}/close | Requester or managers | outcome `CONFIRMED` closes; `REJECTED` reopens to `IN_PROGRESS`, clears the resolution and reopens the latest work order. Assignees cannot confirm their own work. |
| POST /requests/{request}/cancel | Requester (only while `SUBMITTED`/`TRIAGED`), managers (any open state) | reason |
| POST /requests/{request}/comments | Requester, assignees, managers | body, internal (staff only) |
| POST /work-orders/{workOrder}/logs | Assignee, managers | note, minutes |
| POST /work-orders/{workOrder}/costs | Managers | estimatedCost, actualCost |
| GET/POST /vendors | Managers | name, email, phone, accountId (account must hold the VENDOR role) |
| GET/POST /recurring-plans | Managers | spaceId, categoryId, title, description, intervalDays, nextRunOn |
| POST /requests/{request}/photos/upload, GET /photos/{photo}/download | Request participants | Presigned private object-storage URLs |

Scheduled automation opens a request for each due recurring plan, notifies managers about overdue or stalled requests, and closes requests left `RESOLVED` for seven days with outcome `AUTO_CLOSED`. SLA targets come from the request's category.
