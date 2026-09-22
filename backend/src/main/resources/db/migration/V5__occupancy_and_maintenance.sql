ALTER TABLE building_roles DROP CONSTRAINT building_roles_role_check;
ALTER TABLE building_roles ADD CONSTRAINT building_roles_role_check
  CHECK(role IN ('PROPERTY_MANAGER','ACCOUNTANT','MAINTENANCE_STAFF','SECURITY_OPERATIONS_STAFF','TENANT','VENDOR'));

CREATE TABLE residents (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, account_id uuid NOT NULL,
 display_name varchar(120) NOT NULL, phone varchar(40), active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,building_id,id), UNIQUE(organization_id,building_id,account_id),
 FOREIGN KEY(organization_id,building_id) REFERENCES buildings(organization_id,id),
 FOREIGN KEY(organization_id,account_id) REFERENCES memberships(organization_id,account_id));
CREATE TABLE household_members (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, resident_id uuid NOT NULL,
 name varchar(120) NOT NULL, relationship varchar(60), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,building_id,resident_id) REFERENCES residents(organization_id,building_id,id));
CREATE TABLE space_assignments (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, resident_id uuid NOT NULL,
 space_id uuid NOT NULL, status varchar(16) NOT NULL CHECK(status IN ('ACTIVE','ENDED')),
 starts_on date NOT NULL, ends_on date, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,resident_id) REFERENCES residents(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,space_id) REFERENCES spaces(organization_id,building_id,id),
 CHECK(ends_on IS NULL OR ends_on>=starts_on));
CREATE UNIQUE INDEX one_active_assignment_per_space ON space_assignments(organization_id,building_id,space_id) WHERE status='ACTIVE';

CREATE TABLE vendors (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, name varchar(160) NOT NULL,
 email varchar(254), phone varchar(40), active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,building_id,id), FOREIGN KEY(organization_id,building_id) REFERENCES buildings(organization_id,id));
CREATE TABLE vendor_accounts (
 organization_id uuid NOT NULL, building_id uuid NOT NULL, vendor_id uuid NOT NULL, account_id uuid NOT NULL,
 PRIMARY KEY(organization_id,building_id,vendor_id,account_id),
 FOREIGN KEY(organization_id,building_id,vendor_id) REFERENCES vendors(organization_id,building_id,id),
 FOREIGN KEY(organization_id,account_id) REFERENCES memberships(organization_id,account_id));
CREATE TABLE sla_policies (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, name varchar(120) NOT NULL,
 priority varchar(16) NOT NULL CHECK(priority IN ('LOW','MEDIUM','HIGH','URGENT')),
 response_minutes integer NOT NULL CHECK(response_minutes>0), resolution_minutes integer NOT NULL CHECK(resolution_minutes>=response_minutes),
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,building_id,id), FOREIGN KEY(organization_id,building_id) REFERENCES buildings(organization_id,id));
CREATE TABLE maintenance_categories (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, name varchar(120) NOT NULL,
 default_priority varchar(16) NOT NULL CHECK(default_priority IN ('LOW','MEDIUM','HIGH','URGENT')),
 response_minutes integer NOT NULL CHECK(response_minutes>0), resolution_minutes integer NOT NULL CHECK(resolution_minutes>=response_minutes),
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,building_id,id), UNIQUE(organization_id,building_id,name),
 FOREIGN KEY(organization_id,building_id) REFERENCES buildings(organization_id,id));
CREATE TABLE maintenance_requests (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, space_id uuid NOT NULL,
 resident_id uuid, category_id uuid NOT NULL, created_by uuid NOT NULL REFERENCES accounts(id),
 title varchar(160) NOT NULL, description varchar(4000) NOT NULL, impact varchar(16) NOT NULL CHECK(impact IN ('LOW','MEDIUM','HIGH')),
 danger boolean NOT NULL DEFAULT false, suggested_priority varchar(16) NOT NULL CHECK(suggested_priority IN ('LOW','MEDIUM','HIGH','URGENT')),
 priority varchar(16) CHECK(priority IN ('LOW','MEDIUM','HIGH','URGENT')),
 status varchar(20) NOT NULL CHECK(status IN ('SUBMITTED','TRIAGED','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','CANCELLED')),
 response_due_at timestamptz, resolution_due_at timestamptz, triage_reason varchar(500), resolution_summary varchar(2000),
 resolution_outcome varchar(24) CHECK(resolution_outcome IN ('CONFIRMED','REJECTED','AUTO_CLOSED')),
 version integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz, closed_at timestamptz, UNIQUE(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,space_id) REFERENCES spaces(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,resident_id) REFERENCES residents(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,category_id) REFERENCES maintenance_categories(organization_id,building_id,id));
CREATE TABLE maintenance_status_history (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, request_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES accounts(id), from_status varchar(20), to_status varchar(20) NOT NULL,
 reason varchar(500), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,building_id,request_id) REFERENCES maintenance_requests(organization_id,building_id,id));
CREATE TABLE work_orders (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, request_id uuid NOT NULL,
 assigned_account_id uuid REFERENCES accounts(id), vendor_id uuid,
 status varchar(20) NOT NULL CHECK(status IN ('ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED')),
 estimated_cost numeric(14,2) CHECK(estimated_cost IS NULL OR estimated_cost>=0),
 actual_cost numeric(14,2) CHECK(actual_cost IS NULL OR actual_cost>=0), currency varchar(3) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,request_id) REFERENCES maintenance_requests(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,vendor_id) REFERENCES vendors(organization_id,building_id,id),
 CHECK((assigned_account_id IS NOT NULL)::int+(vendor_id IS NOT NULL)::int=1));
CREATE TABLE work_logs (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, work_order_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES accounts(id), note varchar(2000) NOT NULL, minutes integer CHECK(minutes IS NULL OR minutes>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,building_id,work_order_id) REFERENCES work_orders(organization_id,building_id,id));
CREATE TABLE maintenance_comments (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, request_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES accounts(id), body varchar(2000) NOT NULL, internal boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,building_id,request_id) REFERENCES maintenance_requests(organization_id,building_id,id));
CREATE TABLE maintenance_photos (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, request_id uuid NOT NULL,
 uploaded_by uuid NOT NULL REFERENCES accounts(id), object_key varchar(500) NOT NULL UNIQUE,
 content_type varchar(40) NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,building_id,request_id) REFERENCES maintenance_requests(organization_id,building_id,id));
CREATE TABLE recurring_maintenance_plans (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL, space_id uuid, category_id uuid NOT NULL,
 title varchar(160) NOT NULL, description varchar(2000) NOT NULL, interval_days integer NOT NULL CHECK(interval_days>0),
 next_run_on date NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,building_id,id), FOREIGN KEY(organization_id,building_id) REFERENCES buildings(organization_id,id),
 FOREIGN KEY(organization_id,building_id,space_id) REFERENCES spaces(organization_id,building_id,id),
 FOREIGN KEY(organization_id,building_id,category_id) REFERENCES maintenance_categories(organization_id,building_id,id));
CREATE TABLE notifications (
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id), organization_id uuid NOT NULL, building_id uuid,
 type varchar(40) NOT NULL, title varchar(160) NOT NULL, target_path varchar(500) NOT NULL,
 deduplication_key varchar(200) NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_id,deduplication_key), FOREIGN KEY(organization_id,account_id) REFERENCES memberships(organization_id,account_id),
 FOREIGN KEY(organization_id,building_id) REFERENCES buildings(organization_id,id));
CREATE TABLE push_subscriptions (
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id), endpoint_hash char(64) NOT NULL UNIQUE,
 endpoint varchar(1000) NOT NULL, public_key varchar(200) NOT NULL, auth_secret varchar(200) NOT NULL,
 expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE automation_runs (
 id uuid PRIMARY KEY, job_key varchar(160) NOT NULL, scheduled_for timestamptz NOT NULL,
 status varchar(16) NOT NULL CHECK(status IN ('STARTED','COMPLETED','FAILED')), detail varchar(500),
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, UNIQUE(job_key,scheduled_for));

CREATE INDEX maintenance_request_queue ON maintenance_requests(organization_id,building_id,status,priority,resolution_due_at,created_at);
CREATE INDEX maintenance_request_resident ON maintenance_requests(resident_id,created_at DESC);
CREATE INDEX work_order_assignee ON work_orders(assigned_account_id,status);
CREATE INDEX work_order_vendor ON work_orders(vendor_id,status);
CREATE INDEX notification_inbox ON notifications(account_id,read_at,created_at DESC);

ALTER TABLE residents ENABLE ROW LEVEL SECURITY; ALTER TABLE residents FORCE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY; ALTER TABLE household_members FORCE ROW LEVEL SECURITY;
ALTER TABLE space_assignments ENABLE ROW LEVEL SECURITY; ALTER TABLE space_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY; ALTER TABLE vendors FORCE ROW LEVEL SECURITY;
ALTER TABLE vendor_accounts ENABLE ROW LEVEL SECURITY; ALTER TABLE vendor_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE sla_policies ENABLE ROW LEVEL SECURITY; ALTER TABLE sla_policies FORCE ROW LEVEL SECURITY;
ALTER TABLE maintenance_categories ENABLE ROW LEVEL SECURITY; ALTER TABLE maintenance_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY; ALTER TABLE maintenance_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE maintenance_status_history ENABLE ROW LEVEL SECURITY; ALTER TABLE maintenance_status_history FORCE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY; ALTER TABLE work_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY; ALTER TABLE work_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE maintenance_comments ENABLE ROW LEVEL SECURITY; ALTER TABLE maintenance_comments FORCE ROW LEVEL SECURITY;
ALTER TABLE maintenance_photos ENABLE ROW LEVEL SECURITY; ALTER TABLE maintenance_photos FORCE ROW LEVEL SECURITY;
ALTER TABLE recurring_maintenance_plans ENABLE ROW LEVEL SECURITY; ALTER TABLE recurring_maintenance_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY; ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY; ALTER TABLE push_subscriptions FORCE ROW LEVEL SECURITY;

CREATE POLICY residents_tenant ON residents USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY household_tenant ON household_members USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY assignments_tenant ON space_assignments USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY vendors_tenant ON vendors USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY vendor_accounts_tenant ON vendor_accounts USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY sla_tenant ON sla_policies USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY categories_tenant ON maintenance_categories USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY requests_tenant ON maintenance_requests USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY request_history_tenant ON maintenance_status_history USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY work_orders_tenant ON work_orders USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY work_logs_tenant ON work_logs USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY comments_tenant ON maintenance_comments USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY photos_tenant ON maintenance_photos USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY recurring_tenant ON recurring_maintenance_plans USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
CREATE POLICY notifications_read ON notifications FOR SELECT USING(app_platform_admin() OR account_id=app_actor());
CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK(
 app_platform_admin() OR (
  organization_id=app_org()
  AND EXISTS(SELECT 1 FROM memberships sender WHERE sender.organization_id=organization_id AND sender.account_id=app_actor() AND sender.status='ACTIVE')
  AND EXISTS(SELECT 1 FROM memberships recipient WHERE recipient.organization_id=organization_id AND recipient.account_id=account_id AND recipient.status='ACTIVE')
 ));
CREATE POLICY notifications_update ON notifications FOR UPDATE USING(app_platform_admin() OR account_id=app_actor()) WITH CHECK(app_platform_admin() OR account_id=app_actor());
CREATE POLICY push_own ON push_subscriptions USING(account_id=app_actor()) WITH CHECK(account_id=app_actor());

GRANT SELECT,INSERT,UPDATE,DELETE ON residents,household_members,space_assignments,vendors,vendor_accounts,
 sla_policies,maintenance_categories,maintenance_requests,maintenance_status_history,work_orders,work_logs,
 maintenance_comments,maintenance_photos,recurring_maintenance_plans,notifications,push_subscriptions TO "${runtimeRole}";
GRANT SELECT,INSERT,UPDATE ON automation_runs TO "${runtimeRole}";
