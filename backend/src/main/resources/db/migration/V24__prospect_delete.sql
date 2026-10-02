-- Managers may delete a prospect that was never screened or leased. Screening records and leased
-- prospects are history the application never deletes, so the service refuses those cases.
GRANT DELETE ON prospects TO "${runtimeRole}";
