CREATE TABLE audit_events (
 id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES accounts(id),
 organization_id uuid REFERENCES organizations(id), action varchar(80) NOT NULL,
 target_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION app_actor() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('app.actor',true),'')::uuid
$$;
CREATE FUNCTION app_org() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('app.org',true),'')::uuid
$$;
CREATE FUNCTION app_platform_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM accounts WHERE id=app_actor() AND platform_admin AND active)
$$;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_read ON organizations FOR SELECT USING (
 app_platform_admin() OR id=app_org() OR EXISTS(SELECT 1 FROM memberships m WHERE m.organization_id=id AND m.account_id=app_actor() AND m.status IN ('ACTIVE','PENDING'))
);
CREATE POLICY organization_write ON organizations FOR ALL USING(app_platform_admin() OR id=app_org()) WITH CHECK(app_platform_admin() OR id=app_org());
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_read ON memberships FOR SELECT USING(app_platform_admin() OR organization_id=app_org() OR account_id=app_actor());
CREATE POLICY membership_write ON memberships FOR ALL USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings FORCE ROW LEVEL SECURITY;
CREATE POLICY building_tenant ON buildings USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
ALTER TABLE building_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_roles FORCE ROW LEVEL SECURITY;
CREATE POLICY role_tenant ON building_roles USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON audit_events FOR SELECT USING(app_platform_admin() OR organization_id=app_org());
CREATE POLICY audit_insert ON audit_events FOR INSERT WITH CHECK(actor_id=app_actor() AND (organization_id IS NULL OR organization_id=app_org() OR app_platform_admin()));
-- The runtime LOGIN role must be provisioned separately. Its password is never part of a migration.
GRANT USAGE ON SCHEMA public TO "${runtimeRole}";
GRANT SELECT,INSERT,UPDATE ON accounts,auth_sessions,refresh_tokens,login_attempts TO "${runtimeRole}";
GRANT SELECT,INSERT,UPDATE,DELETE ON organizations,memberships,buildings,building_roles TO "${runtimeRole}";
GRANT SELECT,INSERT ON audit_events TO "${runtimeRole}";
GRANT EXECUTE ON FUNCTION app_actor(),app_org(),app_platform_admin() TO "${runtimeRole}";
