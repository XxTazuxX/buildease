CREATE TABLE leases (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, resident_id uuid NOT NULL,
 space_id uuid NOT NULL, assignment_id uuid,
 status varchar(16) NOT NULL CHECK(status IN ('DRAFT','ACTIVE','ENDED','CANCELLED')),
 starts_on date NOT NULL, ends_on date, rent_amount numeric(14,2) NOT NULL CHECK(rent_amount>0),
 currency varchar(3) NOT NULL, next_charge_on date NOT NULL, ended_on date,
 end_reason varchar(16) CHECK(end_reason IN ('EXPIRED','TERMINATED')),
 version integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,resident_id) REFERENCES residents(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,space_id) REFERENCES spaces(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,assignment_id) REFERENCES space_assignments(organization_id,building_id,id),
 CHECK(ends_on IS NULL OR ends_on>=starts_on),
 CHECK((status IN ('DRAFT','CANCELLED'))=(assignment_id IS NULL)),
 CHECK((status='ENDED')=(ended_on IS NOT NULL AND end_reason IS NOT NULL)));
CREATE UNIQUE INDEX one_active_lease_per_space ON leases(organization_id,building_id,space_id) WHERE status='ACTIVE';
CREATE INDEX lease_resident ON leases(organization_id,building_id,resident_id);
CREATE INDEX lease_due ON leases(organization_id,building_id,status,next_charge_on);

CREATE TABLE deposits (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, lease_id uuid NOT NULL UNIQUE,
 status varchar(16) NOT NULL CHECK(status IN ('HELD','REFUNDED','FORFEITED')),
 amount numeric(14,2) NOT NULL CHECK(amount>=0), held_on date NOT NULL,
 refunded_on date, refunded_amount numeric(14,2) CHECK(refunded_amount IS NULL OR refunded_amount>=0),
 notes varchar(500), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,lease_id) REFERENCES leases(organization_id,building_id,id),
 CHECK((status='REFUNDED')=(refunded_on IS NOT NULL)));

CREATE TABLE charges (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, lease_id uuid NOT NULL,
 type varchar(16) NOT NULL DEFAULT 'RENT' CHECK(type IN ('RENT')),
 amount numeric(14,2) NOT NULL CHECK(amount>0), currency varchar(3) NOT NULL, due_on date NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,lease_id) REFERENCES leases(organization_id,building_id,id));
CREATE INDEX charge_lease ON charges(organization_id,building_id,lease_id,due_on);

CREATE TABLE payments (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, lease_id uuid NOT NULL,
 amount numeric(14,2) NOT NULL CHECK(amount>0), currency varchar(3) NOT NULL,
 method varchar(20) NOT NULL CHECK(method IN ('CASH','BANK_TRANSFER','CHECK','CARD','OTHER')),
 reference varchar(120), received_on date NOT NULL, recorded_by uuid NOT NULL REFERENCES accounts(id),
 notes varchar(500), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,lease_id) REFERENCES leases(organization_id,building_id,id));
CREATE INDEX payment_lease ON payments(organization_id,building_id,lease_id,received_on);

ALTER TABLE leases ENABLE ROW LEVEL SECURITY; ALTER TABLE leases FORCE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY; ALTER TABLE deposits FORCE ROW LEVEL SECURITY;
ALTER TABLE charges ENABLE ROW LEVEL SECURITY; ALTER TABLE charges FORCE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY; ALTER TABLE payments FORCE ROW LEVEL SECURITY;

CREATE POLICY leases_tenant ON leases USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY deposits_tenant ON deposits USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY charges_tenant ON charges USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY payments_tenant ON payments USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());

GRANT SELECT,INSERT,UPDATE,DELETE ON leases,deposits,charges,payments TO "${runtimeRole}";
