CREATE TABLE announcements (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, building_id uuid NOT NULL,
 title varchar(160) NOT NULL, body varchar(4000) NOT NULL,
 audience varchar(20) NOT NULL CHECK(audience IN ('ALL_RESIDENTS','ALL_STAFF')),
 sent_by uuid NOT NULL REFERENCES accounts(id), recipient_count integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,building_id) REFERENCES buildings(organization_id,id));
CREATE INDEX announcement_building ON announcements(organization_id,building_id,created_at DESC);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY; ALTER TABLE announcements FORCE ROW LEVEL SECURITY;
CREATE POLICY announcements_tenant ON announcements USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());

GRANT SELECT,INSERT ON announcements TO "${runtimeRole}";
