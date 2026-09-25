CREATE TABLE lease_signatures (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, lease_id uuid NOT NULL,
 role varchar(16) NOT NULL CHECK(role IN ('OWNER','RESIDENT')),
 signer_account_id uuid NOT NULL REFERENCES accounts(id),
 signed_name varchar(160) NOT NULL,
 method varchar(10) NOT NULL CHECK(method IN ('TYPED','DRAWN')),
 signature_data varchar(200000),
 signed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(lease_id,role),
 FOREIGN KEY(organization_id,building_id,lease_id) REFERENCES leases(organization_id,building_id,id));
CREATE INDEX lease_signature_lease ON lease_signatures(organization_id,building_id,lease_id);

ALTER TABLE lease_signatures ENABLE ROW LEVEL SECURITY; ALTER TABLE lease_signatures FORCE ROW LEVEL SECURITY;
CREATE POLICY lease_signatures_tenant ON lease_signatures USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());

GRANT SELECT,INSERT,UPDATE ON lease_signatures TO "${runtimeRole}";
