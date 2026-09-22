# Occupancy API

All routes use JSON under `/api/organizations/{organization}/buildings/{building}` and enforce organization and building authorization in the backend.

| Endpoint | Request / behavior |
| --- | --- |
| GET /residents | Returns one row per resident with an `assignments` array of active spaces |
| POST /residents | accountId, displayName, phone; creates a resident for an active tenant account |
| PATCH /residents/{resident} | displayName, phone, active; active assignments must end before deactivation |
| POST /residents/{resident}/household-members | name, relationship |
| POST /space-assignments | residentId, spaceId, startsOn; a resident may hold multiple active spaces |
| POST /space-assignments/{assignment}/end | endsOn; preserves assignment history and vacates the space |

An active space can have only one active assignment. Activating an assignment marks its space `OCCUPIED`; ending it marks the space `VACANT`. Resident list responses retain the legacy first-assignment fields while exposing every active assignment in `assignments`.
