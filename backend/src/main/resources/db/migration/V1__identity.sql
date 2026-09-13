CREATE TABLE accounts (
 id uuid PRIMARY KEY, email varchar(254) NOT NULL UNIQUE CHECK(email=lower(trim(email))),
 display_name varchar(120) NOT NULL, password_hash varchar(255) NOT NULL,
 platform_admin boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true,
 must_change_password boolean NOT NULL DEFAULT true, temporary_password_expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth_sessions (
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id),
 expires_at timestamptz NOT NULL, revoked boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_account ON auth_sessions(account_id);
CREATE TABLE refresh_tokens (
 token_hash char(64) PRIMARY KEY, session_id uuid NOT NULL REFERENCES auth_sessions(id),
 used boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE login_attempts (
 key_hash char(64) PRIMARY KEY, failures integer NOT NULL DEFAULT 0,
 window_started timestamptz NOT NULL DEFAULT now(), blocked_until timestamptz
);
