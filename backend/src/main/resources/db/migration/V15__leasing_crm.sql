CREATE TABLE prospects (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL,
 space_id uuid NOT NULL, listing_id uuid, lease_id uuid,
 name varchar(160) NOT NULL, email varchar(254), phone varchar(40),
 status varchar(20) NOT NULL DEFAULT 'NEW' CHECK(status IN
   ('NEW','CONTACTED','APPLIED','SCREENING','APPROVED','REJECTED','LEASED','WITHDRAWN')),
 notes varchar(2000), created_by uuid NOT NULL REFERENCES accounts(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,space_id) REFERENCES spaces(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,listing_id) REFERENCES listings(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,lease_id) REFERENCES leases(organization_id,building_id,id),
 CHECK((status='LEASED')=(lease_id IS NOT NULL)));
CREATE INDEX prospect_space ON prospects(organization_id,building_id,space_id,created_at DESC);
CREATE INDEX prospect_status ON prospects(organization_id,building_id,status);

ALTER TABLE prospects ENABLE ROW LEVEL SECURITY; ALTER TABLE prospects FORCE ROW LEVEL SECURITY;
CREATE POLICY prospects_tenant ON prospects USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());

GRANT SELECT,INSERT,UPDATE ON prospects TO "${runtimeRole}";
