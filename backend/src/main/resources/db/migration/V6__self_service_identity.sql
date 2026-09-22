CREATE TABLE registration_requests (
 id uuid PRIMARY KEY,
 token_hash char(64) NOT NULL UNIQUE,
 email varchar(254) NOT NULL CHECK(email=lower(trim(email))),
 display_name varchar(120) NOT NULL,
 organization_name varchar(120) NOT NULL,
 password_hash varchar(255) NOT NULL,
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pending_registration_email ON registration_requests(email) WHERE consumed_at IS NULL;
CREATE TABLE password_reset_requests (
 id uuid PRIMARY KEY,
 token_hash char(64) NOT NULL UNIQUE,
 account_id uuid NOT NULL REFERENCES accounts(id),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_account ON password_reset_requests(account_id,created_at DESC);
GRANT SELECT,INSERT,UPDATE,DELETE ON registration_requests,password_reset_requests TO "${runtimeRole}";
