CREATE TABLE assets (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, space_id uuid,
 name varchar(160) NOT NULL, category varchar(40) NOT NULL CHECK(category IN
   ('HVAC','APPLIANCE','PLUMBING','ELECTRICAL','ELEVATOR','FIRE_SAFETY','SECURITY','STRUCTURAL','OTHER')),
 manufacturer varchar(120), model varchar(120), serial_number varchar(120),
 install_date date, warranty_expires_on date,
 status varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','RETIRED')),
 notes varchar(2000),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,space_id) REFERENCES spaces(organization_id,building_id,id));
CREATE INDEX asset_building ON assets(organization_id,building_id,status);
CREATE INDEX asset_space ON assets(organization_id,building_id,space_id);

CREATE TABLE asset_meter_readings (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, asset_id uuid NOT NULL,
 reading_value numeric(14,2) NOT NULL, unit varchar(24) NOT NULL,
 recorded_by uuid NOT NULL REFERENCES accounts(id), recorded_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,building_id,asset_id) REFERENCES assets(organization_id,building_id,id));
CREATE INDEX asset_meter_reading_asset ON asset_meter_readings(organization_id,building_id,asset_id,recorded_at DESC);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY; ALTER TABLE assets FORCE ROW LEVEL SECURITY;
ALTER TABLE asset_meter_readings ENABLE ROW LEVEL SECURITY; ALTER TABLE asset_meter_readings FORCE ROW LEVEL SECURITY;

CREATE POLICY assets_tenant ON assets USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY asset_meter_readings_tenant ON asset_meter_readings USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());

GRANT SELECT,INSERT,UPDATE ON assets,asset_meter_readings TO "${runtimeRole}";
