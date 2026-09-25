-- No RLS: resolving a presented key to its organization must work before any org context is
-- known, exactly like accounts-by-email during login or refresh_tokens-by-hash. Access is
-- controlled entirely in the service layer (owner-only create/list/revoke; hash lookup to resolve).
CREATE TABLE api_keys (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, name varchar(120) NOT NULL,
 key_hash char(64) NOT NULL UNIQUE, created_by uuid NOT NULL REFERENCES accounts(id),
 created_at timestamptz NOT NULL DEFAULT now(), last_used_at timestamptz, revoked_at timestamptz);
CREATE INDEX api_key_org ON api_keys(organization_id) WHERE revoked_at IS NULL;

CREATE TABLE accounting_syncs (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL,
 status varchar(16) NOT NULL CHECK(status IN ('SUCCEEDED','FAILED')),
 provider_reference varchar(120), synced_by uuid NOT NULL REFERENCES accounts(id),
 synced_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,building_id) REFERENCES buildings(organization_id,id));
CREATE INDEX accounting_sync_building ON accounting_syncs(organization_id,building_id,synced_at DESC);

ALTER TABLE accounting_syncs ENABLE ROW LEVEL SECURITY; ALTER TABLE accounting_syncs FORCE ROW LEVEL SECURITY;
CREATE POLICY accounting_syncs_tenant ON accounting_syncs USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());

GRANT SELECT,INSERT,UPDATE ON api_keys TO "${runtimeRole}";
GRANT SELECT,INSERT ON accounting_syncs TO "${runtimeRole}";
