-- The original constraint required published_at to be NULL whenever a listing isn't currently
-- PUBLISHED, which destroys "when was this last published" history the moment it's unpublished.
-- Relax it to one-directional: a PUBLISHED listing must have a published_at, but an
-- UNPUBLISHED/DRAFT one may still carry a historical value.
ALTER TABLE listings DROP CONSTRAINT listings_check;
ALTER TABLE listings ADD CONSTRAINT listings_check CHECK(status<>'PUBLISHED' OR published_at IS NOT NULL);

-- The original policy additionally required the recipient to already hold an ACTIVE organization
-- membership, which a resident-only account may never have depending on how they were onboarded.
-- The sender is already authorized (manager) and recipients are already scoped to the same
-- organization/building by the service layer, so the membership re-check just blocks legitimate
-- sends (e.g. building-wide announcements to residents) without adding real protection.
DROP POLICY notifications_insert ON notifications;
CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK(
 app_platform_admin() OR (
  organization_id=app_org()
  AND EXISTS(SELECT 1 FROM memberships sender WHERE sender.organization_id=organization_id AND sender.account_id=app_actor() AND sender.status='ACTIVE')
 ));
