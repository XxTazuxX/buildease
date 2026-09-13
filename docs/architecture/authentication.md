# Authentication and organization boundaries

Identity is global; normalized email identifies one account. Organization membership is ACTIVE, PENDING, or REMOVED. Organization ownership is a membership flag; multiple building roles may coexist. Building keys and membership foreign keys include organization IDs to prevent cross-organization assignments.

The platform role is System Administrator. Organization owners manage their organization's buildings and membership. Property Managers grant Accountant, Maintenance Staff, Security / Operations Staff, and Tenant roles only in assigned buildings. They cannot change owners/managers or globally reset/disable accounts. The final active owner and platform administrator are protected. Existing-account additions require acceptance and preserve credentials. New accounts start active with a 24-hour temporary password.

Future domain endpoints must combine `RolePolicy` permissions with resource ownership or assignment checks: `billing:own` is not permission to read other tenants' invoices, and `maintenance:assigned` requires an actual work assignment. This release exposes no billing or maintenance endpoints.

## Authentication

Access JWTs are HS256-signed using a secret with at least 256 random bits, issuer `buildease`, audience `buildease-api`, and a ten-minute expiry. Only account/session IDs are authoritative JWT claims; live account/session state and database membership determine authorization. Refresh tokens are 256-bit random opaque values, SHA-256 hashed at rest, and rotated under transactional locks. Reuse revokes the entire family. Sessions expire absolutely seven days after login, regardless of cookie refresh. Password changes/resets revoke all account sessions. Login throttling is persistent by normalized account and remote peer address (ten failures per 15-minute window); proxy headers are not blindly trusted.

The React client stores access tokens only in memory. Refresh cookies are HttpOnly, SameSite Strict, and Secure by default. Mutation requests require the Spring CSRF token from `/api/auth/csrf`. Vite proxies `/api` to the backend; there is no permissive CORS configuration. A browser Web Lock serializes cookie rotation across tabs where supported; a shared promise coalesces in-tab refresh. Older browsers without Web Locks must use one tab to avoid strict replay revocation. Logout clears local state and invalidates the server session. Password replacement returns users to login.

## Database trust boundary

The runtime role is a non-owner LOGIN without superuser or BYPASSRLS. Flyway connects separately with migration credentials. FORCE RLS policies apply to tenant-owned tables. Services authenticate the actor, validate membership, lock the organization, recheck membership, and set transaction-local `app.actor`/`app.org`. Context is cleared automatically at transaction end, including pooled connections. No HTTP header is accepted as an administrator override.

These RLS policies enforce the application's **validated transaction context**; PostgreSQL custom settings are not cryptographic credentials. Anyone with the runtime database password can set them directly. Do not expose SQL access or runtime credentials to end users. The application remains responsible for validating context and role/resource permissions. Central identity records are accessed only through internal repositories; delegated API projections omit credential fields. Audit events are append-only for the runtime role and never include passwords or tokens.

## Schema changes

Flyway alone owns DDL; Hibernate validates its mapped identity entity. Integration tests additionally exercise the schema constraints and RLS policies. Do not edit applied migrations or enable automatic baselining/cleaning. Add the next numbered SQL migration, test against disposable PostgreSQL, then deploy. Record state corrections as new migrations rather than rewriting history.
