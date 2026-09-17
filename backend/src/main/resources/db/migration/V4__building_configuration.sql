ALTER TABLE buildings
  ADD COLUMN address_line1 varchar(160),
  ADD COLUMN address_line2 varchar(160),
  ADD COLUMN city varchar(100),
  ADD COLUMN region varchar(100),
  ADD COLUMN postal_code varchar(24),
  ADD COLUMN country_code varchar(2),
  ADD COLUMN timezone varchar(64) NOT NULL DEFAULT 'UTC',
  ADD COLUMN currency varchar(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN emergency_contact varchar(160),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE building_levels (
 id uuid PRIMARY KEY,
 organization_id uuid NOT NULL,
 building_id uuid NOT NULL,
 name varchar(120) NOT NULL,
 code varchar(40) NOT NULL,
 sort_order integer NOT NULL DEFAULT 0,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,building_id,id),
 UNIQUE(organization_id,building_id,code),
 FOREIGN KEY(organization_id,building_id) REFERENCES buildings(organization_id,id)
);

CREATE TABLE spaces (
 id uuid PRIMARY KEY,
 organization_id uuid NOT NULL,
 building_id uuid NOT NULL,
 level_id uuid,
 parent_space_id uuid,
 name varchar(120) NOT NULL,
 code varchar(40) NOT NULL,
 type varchar(24) NOT NULL CHECK(type IN ('FLAT','ROOM','SHOP','OFFICE','PARKING','STORAGE','COMMON_AREA','OTHER')),
 status varchar(24) NOT NULL DEFAULT 'VACANT' CHECK(status IN ('VACANT','RESERVED','OCCUPIED','MAINTENANCE','INACTIVE')),
 rentable boolean NOT NULL DEFAULT true,
 area numeric(12,2) CHECK(area IS NULL OR area>0),
 capacity integer CHECK(capacity IS NULL OR capacity>0),
 notes varchar(1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,building_id,id),
 UNIQUE(organization_id,building_id,code),
 FOREIGN KEY(organization_id,building_id) REFERENCES buildings(organization_id,id),
 FOREIGN KEY(organization_id,building_id,level_id) REFERENCES building_levels(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,parent_space_id) REFERENCES spaces(organization_id,building_id,id),
 CHECK(parent_space_id IS NULL OR parent_space_id<>id)
);

CREATE INDEX building_levels_order ON building_levels(organization_id,building_id,sort_order,name);
CREATE INDEX spaces_level ON spaces(organization_id,building_id,level_id);
CREATE INDEX spaces_parent ON spaces(organization_id,building_id,parent_space_id);

ALTER TABLE building_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_levels FORCE ROW LEVEL SECURITY;
CREATE POLICY building_level_tenant ON building_levels
 USING(app_platform_admin() OR organization_id=app_org())
 WITH CHECK(app_platform_admin() OR organization_id=app_org());

ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces FORCE ROW LEVEL SECURITY;
CREATE POLICY space_tenant ON spaces
 USING(app_platform_admin() OR organization_id=app_org())
 WITH CHECK(app_platform_admin() OR organization_id=app_org());

GRANT SELECT,INSERT,UPDATE,DELETE ON building_levels,spaces TO "${runtimeRole}";
