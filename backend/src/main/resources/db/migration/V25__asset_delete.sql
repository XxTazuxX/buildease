-- Managers may delete an asset that has no meter readings. Readings are history the application
-- never deletes, so the service refuses an asset that has any (it can be retired instead).
GRANT DELETE ON assets TO "${runtimeRole}";
