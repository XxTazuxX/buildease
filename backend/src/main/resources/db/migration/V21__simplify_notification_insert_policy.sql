-- V20's rewrite kept a correlated EXISTS subquery to re-verify the sender's membership at
-- INSERT time, aliased as "sender". Because "sender" is the only table in that subquery's
-- FROM list, the unqualified reference on the right side of "sender.organization_id=organization_id"
-- resolves within the subquery's own scope (inner scope shadows outer), making the comparison a
-- self-referential tautology rather than a check against the row being inserted. That isn't why
-- AnnouncementIT still failed after V20 (the tautology makes the check MORE permissive, not less),
-- but it shows the correlated-subquery shape here is fragile and worth removing rather than patching
-- further blind. AnnouncementService.send() (and every other writer: RentAutomation,
-- MaintenanceAutomation) already fully authorizes the sender via manager()/enter() before this
-- INSERT ever runs, and recipients are already scoped to the same organization/building by the
-- service layer. Every other tenant-scoped table in this schema (charges, payments, leases, ...)
-- trusts that same split of responsibility and only checks organization_id=app_org() at the RLS
-- layer, so bring notifications_insert in line with that pattern instead of re-deriving
-- authorization state via a correlated subquery.
DROP POLICY notifications_insert ON notifications;
CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK(
 app_platform_admin() OR organization_id=app_org()
);
