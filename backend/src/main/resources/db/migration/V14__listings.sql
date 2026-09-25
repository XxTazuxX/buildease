CREATE TABLE listings (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, space_id uuid NOT NULL,
 headline varchar(160) NOT NULL, description varchar(4000) NOT NULL,
 rent_amount numeric(14,2) NOT NULL CHECK(rent_amount>0), currency varchar(3) NOT NULL,
 status varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED','UNPUBLISHED')),
 created_by uuid NOT NULL REFERENCES accounts(id),
 published_at timestamptz, unpublished_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,space_id) REFERENCES spaces(organization_id,building_id,id),
 CHECK((status='PUBLISHED')=(published_at IS NOT NULL)));
CREATE INDEX listing_space ON listings(organization_id,building_id,space_id);
CREATE UNIQUE INDEX one_active_listing_per_space ON listings(organization_id,building_id,space_id) WHERE status='PUBLISHED';

CREATE TABLE listing_syndications (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, listing_id uuid NOT NULL,
 channel varchar(20) NOT NULL CHECK(channel IN ('ZILLOW','APARTMENTS_COM')),
 status varchar(16) NOT NULL CHECK(status IN ('PENDING','SYNDICATED','FAILED','REMOVED')),
 external_id varchar(120), synced_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(listing_id,channel),
 FOREIGN KEY(organization_id,building_id,listing_id) REFERENCES listings(organization_id,building_id,id));
CREATE INDEX listing_syndication_listing ON listing_syndications(organization_id,building_id,listing_id);

ALTER TABLE listings ENABLE ROW LEVEL SECURITY; ALTER TABLE listings FORCE ROW LEVEL SECURITY;
ALTER TABLE listing_syndications ENABLE ROW LEVEL SECURITY; ALTER TABLE listing_syndications FORCE ROW LEVEL SECURITY;

CREATE POLICY listings_tenant ON listings USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY listing_syndications_tenant ON listing_syndications USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());

GRANT SELECT,INSERT,UPDATE ON listings,listing_syndications TO "${runtimeRole}";
