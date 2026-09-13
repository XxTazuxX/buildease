CREATE TABLE organizations (
 id uuid PRIMARY KEY, name varchar(120) NOT NULL, active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE memberships (
 organization_id uuid NOT NULL REFERENCES organizations(id), account_id uuid NOT NULL REFERENCES accounts(id),
 owner boolean NOT NULL DEFAULT false, status varchar(16) NOT NULL CHECK(status IN ('ACTIVE','PENDING','REMOVED')),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,account_id)
);
CREATE TABLE buildings (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id),
 name varchar(120) NOT NULL, code varchar(40) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,id), UNIQUE(organization_id,code)
);
CREATE TABLE building_roles (
 organization_id uuid NOT NULL, building_id uuid NOT NULL, account_id uuid NOT NULL,
 role varchar(40) NOT NULL CHECK(role IN ('PROPERTY_MANAGER','ACCOUNTANT','MAINTENANCE_STAFF','SECURITY_OPERATIONS_STAFF','TENANT')),
 PRIMARY KEY(organization_id,building_id,account_id,role),
 FOREIGN KEY(organization_id,building_id) REFERENCES buildings(organization_id,id),
 FOREIGN KEY(organization_id,account_id) REFERENCES memberships(organization_id,account_id)
);
CREATE INDEX membership_accounts ON memberships(account_id);
CREATE INDEX building_role_accounts ON building_roles(account_id,organization_id);
