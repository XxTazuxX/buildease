# Authentication and administration API

All routes use JSON under `/api`. Error responses contain `message`; credentials, SQL details, and stack traces are not returned. List routes accept zero-based `page`, return up to 50 records, and use deterministic ordering. IDs are UUIDs. Mutations require `X-XSRF-TOKEN` plus its matching cookie; protected endpoints also require an access JWT in `Authorization: Bearer …`.

| Endpoint | Request / behavior |
| --- | --- |
| GET /auth/csrf | Returns token/headerName and sets CSRF cookie |
| POST /auth/login | email, password → accessToken, mustChangePassword; refresh cookie |
| POST /auth/refresh | Refresh cookie → rotated cookie and accessToken |
| POST /auth/logout | Revokes refresh/access session and deletes cookie |
| GET /auth/me | Safe profile and active/pending organizations |
| POST /auth/change-password | oldPassword, newPassword; revokes all sessions |
| GET, POST /platform/organizations | List; create with name, ownerEmail, ownerName, temporaryPassword for new owner |
| PATCH /platform/organizations/{org} | active |
| GET, POST /platform/accounts | List; create with email, name, temporaryPassword, platformAdmin |
| PATCH /platform/accounts/{id} | active |
| POST /platform/accounts/{id}/reset-password | temporaryPassword; platform administrators only |
| GET /organizations/{org}/access | Current owner flag and building roles |
| GET, POST /organizations/{org}/buildings | Accessible buildings; create with name, code |
| GET /organizations/{org}/members | Optional buildingId; required for managers |
| POST /organizations/{org}/members | email, name, temporaryPassword for new account, owner, buildingId or null, roles array |
| PATCH /organizations/{org}/members/{user} | owner, removed; organization owners only |
| POST /organizations/{org}/invitations/accept | Accept current account's pending membership |
| GET, PUT /organizations/{org}/buildings/{building}/members/{user}/roles | Read or replace roles array |
| GET /organizations/{org}/audit | Owner-only organization audit list |

Building roles: PROPERTY_MANAGER, ACCOUNTANT, MAINTENANCE_STAFF, SECURITY_OPERATIONS_STAFF, TENANT. Owners and platform admins are not assignable through building-role endpoints. Re-adding an existing organization member to a building preserves organization membership and credentials. Inviting an existing global account into a new organization creates PENDING membership; only that user can accept.

Temporary passwords require 15–64 Unicode characters and at most 72 UTF-8 bytes. They are never returned by the API: the creating administrator supplies and privately delivers them. Expired temporary passwords need a platform-admin reset. There is no email recovery or public signup in this release.
