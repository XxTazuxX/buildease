-- Managers may now delete a listing (never while it is published, and never when prospects were
-- created from it); the service removes its syndication history first. The runtime role could
-- previously only read, insert and update these tables.
GRANT DELETE ON listings, listing_syndications TO "${runtimeRole}";
