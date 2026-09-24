CREATE TABLE mail_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 host varchar(255), port integer NOT NULL DEFAULT 587,
 username varchar(255), smtp_password varchar(500), from_address varchar(254),
 starttls boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES accounts(id)
);
INSERT INTO mail_settings(id) VALUES (true);

CREATE TABLE email_templates (
 template_key varchar(40) PRIMARY KEY CHECK(template_key IN ('VERIFICATION','PASSWORD_RESET')),
 subject varchar(200) NOT NULL, body varchar(4000) NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES accounts(id)
);
INSERT INTO email_templates(template_key,subject,body) VALUES
 ('VERIFICATION','Verify your BuildEase workspace',
  E'Complete your BuildEase registration:\n\n{{link}}\n\nThis link expires in 30 minutes.'),
 ('PASSWORD_RESET','Reset your BuildEase password',
  E'Reset your BuildEase password:\n\n{{link}}\n\nThis link expires in 30 minutes. If you did not request it, ignore this email.');

CREATE TABLE impersonation_sessions (
 id uuid PRIMARY KEY, admin_account_id uuid NOT NULL REFERENCES accounts(id),
 target_account_id uuid NOT NULL REFERENCES accounts(id),
 started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
 CHECK(admin_account_id<>target_account_id)
);
CREATE INDEX impersonation_admin ON impersonation_sessions(admin_account_id,started_at DESC);

CREATE TABLE impersonation_refresh_tokens (
 token_hash char(64) PRIMARY KEY, impersonation_session_id uuid NOT NULL REFERENCES impersonation_sessions(id),
 used boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_events ADD COLUMN impersonated_by uuid REFERENCES accounts(id);

GRANT SELECT,UPDATE ON mail_settings,email_templates TO "${runtimeRole}";
GRANT SELECT,INSERT,UPDATE ON impersonation_sessions,impersonation_refresh_tokens TO "${runtimeRole}";
