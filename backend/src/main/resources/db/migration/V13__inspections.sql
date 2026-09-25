CREATE TABLE inspections (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, space_id uuid NOT NULL,
 lease_id uuid, resident_id uuid,
 type varchar(20) NOT NULL CHECK(type IN ('MOVE_IN','MOVE_OUT','ROUTINE')),
 status varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','COMPLETED')),
 scheduled_on date NOT NULL, completed_at timestamptz, conducted_by uuid REFERENCES accounts(id),
 resident_acknowledged_at timestamptz, notes varchar(2000),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,space_id) REFERENCES spaces(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,lease_id) REFERENCES leases(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,resident_id) REFERENCES residents(organization_id,building_id,id),
 CHECK((status='COMPLETED')=(completed_at IS NOT NULL)));
CREATE INDEX inspection_space ON inspections(organization_id,building_id,space_id,scheduled_on DESC);
CREATE INDEX inspection_resident ON inspections(organization_id,building_id,resident_id);

CREATE TABLE inspection_items (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, inspection_id uuid NOT NULL,
 area varchar(120) NOT NULL, condition varchar(20) NOT NULL CHECK(condition IN ('GOOD','FAIR','DAMAGED')),
 notes varchar(500),
 FOREIGN KEY(organization_id,building_id,inspection_id) REFERENCES inspections(organization_id,building_id,id));
CREATE INDEX inspection_item_inspection ON inspection_items(organization_id,building_id,inspection_id);

CREATE TABLE inspection_photos (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, inspection_id uuid NOT NULL,
 uploaded_by uuid NOT NULL REFERENCES accounts(id), object_key varchar(500) NOT NULL,
 content_type varchar(60) NOT NULL, size_bytes bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,building_id,inspection_id) REFERENCES inspections(organization_id,building_id,id));
CREATE INDEX inspection_photo_inspection ON inspection_photos(organization_id,building_id,inspection_id);

ALTER TABLE inspections ENABLE ROW LEVEL SECURITY; ALTER TABLE inspections FORCE ROW LEVEL SECURITY;
ALTER TABLE inspection_items ENABLE ROW LEVEL SECURITY; ALTER TABLE inspection_items FORCE ROW LEVEL SECURITY;
ALTER TABLE inspection_photos ENABLE ROW LEVEL SECURITY; ALTER TABLE inspection_photos FORCE ROW LEVEL SECURITY;

CREATE POLICY inspections_tenant ON inspections USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY inspection_items_tenant ON inspection_items USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY inspection_photos_tenant ON inspection_photos USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());

GRANT SELECT,INSERT,UPDATE ON inspections,inspection_items,inspection_photos TO "${runtimeRole}";
