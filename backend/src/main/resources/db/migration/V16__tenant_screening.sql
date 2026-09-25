CREATE TABLE screenings (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, prospect_id uuid NOT NULL,
 status varchar(16) NOT NULL CHECK(status IN ('PENDING','PASS','FAIL','REVIEW')),
 report varchar(4000), provider_reference varchar(120),
 requested_by uuid NOT NULL REFERENCES accounts(id), requested_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 FOREIGN KEY(organization_id,building_id,prospect_id) REFERENCES prospects(organization_id,building_id,id),
 CHECK((status='PENDING')=(completed_at IS NULL)));
CREATE INDEX screening_prospect ON screenings(organization_id,building_id,prospect_id,requested_at DESC);

ALTER TABLE screenings ENABLE ROW LEVEL SECURITY; ALTER TABLE screenings FORCE ROW LEVEL SECURITY;
CREATE POLICY screenings_tenant ON screenings USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());

GRANT SELECT,INSERT ON screenings TO "${runtimeRole}";
