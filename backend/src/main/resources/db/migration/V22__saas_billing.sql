-- SaaS subscription billing for customer organizations. Billing is manual/invoice based: the
-- platform operator assigns plans and records payments received out of band; no payment
-- processor is involved.

-- Global plan catalogue. No RLS: plans are public product information (the pricing page reads
-- them anonymously) and only platform administrators may change them (enforced in the service).
CREATE TABLE plans (
 id uuid PRIMARY KEY, code varchar(40) NOT NULL UNIQUE CHECK(code=upper(code)),
 name varchar(80) NOT NULL, description varchar(500),
 monthly_price numeric(14,2) NOT NULL CHECK(monthly_price>=0),
 annual_price numeric(14,2) NOT NULL CHECK(annual_price>=0),
 currency varchar(3) NOT NULL DEFAULT 'USD',
 max_buildings integer CHECK(max_buildings IS NULL OR max_buildings>=0),
 max_spaces integer CHECK(max_spaces IS NULL OR max_spaces>=0),
 max_staff integer CHECK(max_staff IS NULL OR max_staff>=0),
 features varchar(120)[] NOT NULL DEFAULT '{}',
 trial_days integer NOT NULL DEFAULT 0 CHECK(trial_days>=0),
 public boolean NOT NULL DEFAULT true, active boolean NOT NULL DEFAULT true,
 sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO plans(id,code,name,description,monthly_price,annual_price,max_buildings,max_spaces,max_staff,features,trial_days,public,sort_order) VALUES
 ('00000000-0000-4000-8000-000000000001','TRIAL','Free trial','Try every feature for 14 days.',0,0,1,25,5,
  ARRAY['Maintenance requests','Occupancy & residents','Leases & rent ledger','Tenant portal'],14,false,0),
 ('00000000-0000-4000-8000-000000000002','STARTER','Starter','For independent landlords with a single property.',49,490,1,50,5,
  ARRAY['1 building, up to 50 units','Maintenance requests','Leases & rent ledger','Tenant portal','Email support'],0,true,1),
 ('00000000-0000-4000-8000-000000000003','PROFESSIONAL','Professional','For growing property managers running a portfolio.',149,1490,10,500,25,
  ARRAY['Up to 10 buildings, 500 units','Everything in Starter','Inspections & asset registry','Leasing CRM & listings','Financial reports & exports'],0,true,2),
 ('00000000-0000-4000-8000-000000000004','ENTERPRISE','Enterprise','For large operators that need scale and integrations.',499,4990,NULL,NULL,NULL,
  ARRAY['Unlimited buildings and units','Everything in Professional','API keys & accounting sync','Priority support'],0,true,3);

CREATE TABLE organization_subscriptions (
 organization_id uuid PRIMARY KEY REFERENCES organizations(id),
 plan_id uuid NOT NULL REFERENCES plans(id),
 status varchar(16) NOT NULL CHECK(status IN ('TRIALING','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED')),
 billing_cycle varchar(8) NOT NULL DEFAULT 'MONTHLY' CHECK(billing_cycle IN ('MONTHLY','ANNUAL')),
 trial_ends_on date,
 current_period_start date NOT NULL, current_period_end date NOT NULL,
 billing_email varchar(254), billing_name varchar(160), billing_address varchar(500), tax_id varchar(60),
 requested_plan_id uuid REFERENCES plans(id), requested_cycle varchar(8) CHECK(requested_cycle IN ('MONTHLY','ANNUAL')),
 requested_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(current_period_end>current_period_start),
 CHECK(status<>'TRIALING' OR trial_ends_on IS NOT NULL)
);

-- Existing organizations predate billing: grandfather them onto Professional. Where the migration
-- role is subject to RLS this may see no rows; SubscriptionService creates the same row lazily.
INSERT INTO organization_subscriptions(organization_id,plan_id,status,current_period_start,current_period_end)
 SELECT id,'00000000-0000-4000-8000-000000000003','ACTIVE',current_date,(current_date+interval '1 month')::date FROM organizations;

CREATE SEQUENCE saas_invoice_seq;

CREATE TABLE saas_invoices (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id),
 number varchar(40) NOT NULL UNIQUE, plan_id uuid REFERENCES plans(id),
 description varchar(300) NOT NULL,
 period_start date, period_end date,
 subtotal numeric(14,2) NOT NULL CHECK(subtotal>=0), tax numeric(14,2) NOT NULL DEFAULT 0 CHECK(tax>=0),
 total numeric(14,2) NOT NULL CHECK(total=subtotal+tax), currency varchar(3) NOT NULL,
 status varchar(10) NOT NULL CHECK(status IN ('DRAFT','ISSUED','OVERDUE','PAID','VOID')),
 issued_on date, due_on date, paid_on date,
 payment_method varchar(40), payment_reference varchar(120), notes varchar(1000),
 created_by uuid NOT NULL REFERENCES accounts(id), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(period_end IS NULL OR period_start IS NULL OR period_end>period_start),
 CHECK(status NOT IN ('ISSUED','OVERDUE','PAID') OR (issued_on IS NOT NULL AND due_on IS NOT NULL)),
 CHECK((status='PAID')=(paid_on IS NOT NULL))
);
-- One automatically generated renewal invoice per organization and period.
CREATE UNIQUE INDEX saas_invoice_period ON saas_invoices(organization_id,period_start) WHERE status<>'VOID' AND period_start IS NOT NULL;
CREATE INDEX saas_invoice_org ON saas_invoices(organization_id,created_at DESC);

ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY; ALTER TABLE organization_subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE saas_invoices ENABLE ROW LEVEL SECURITY; ALTER TABLE saas_invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_tenant ON organization_subscriptions USING(app_platform_admin() OR organization_id=app_org()) WITH CHECK(app_platform_admin() OR organization_id=app_org());
-- Customers can read their invoices; only the platform operator creates or changes them.
CREATE POLICY saas_invoices_read ON saas_invoices FOR SELECT USING(app_platform_admin() OR organization_id=app_org());
CREATE POLICY saas_invoices_write ON saas_invoices FOR INSERT WITH CHECK(app_platform_admin());
CREATE POLICY saas_invoices_update ON saas_invoices FOR UPDATE USING(app_platform_admin()) WITH CHECK(app_platform_admin());

-- Transactional email templates for billing and anti-enumeration registration.
ALTER TABLE email_templates DROP CONSTRAINT email_templates_template_key_check;
ALTER TABLE email_templates ADD CONSTRAINT email_templates_template_key_check
 CHECK(template_key IN ('VERIFICATION','PASSWORD_RESET','ACCOUNT_EXISTS','SAAS_INVOICE_ISSUED'));
INSERT INTO email_templates(template_key,subject,body) VALUES
 ('ACCOUNT_EXISTS','You already have a BuildEase account',
  E'Someone tried to register a new BuildEase workspace with this email address, which already has an account.\n\nIf it was you, sign in or reset your password:\n\n{{link}}\n\nIf it was not you, you can ignore this email.'),
 ('SAAS_INVOICE_ISSUED','Your BuildEase invoice is ready',
  E'A new BuildEase subscription invoice has been issued for your organization.\n\nView it and payment instructions here:\n\n{{link}}');

-- Online rent payments: make client retries idempotent.
ALTER TABLE payments ADD COLUMN idempotency_key varchar(120);
CREATE UNIQUE INDEX payment_idempotency ON payments(lease_id,idempotency_key) WHERE idempotency_key IS NOT NULL;

GRANT SELECT,INSERT,UPDATE ON plans TO "${runtimeRole}";
GRANT SELECT,INSERT,UPDATE ON organization_subscriptions,saas_invoices TO "${runtimeRole}";
GRANT USAGE,SELECT ON SEQUENCE saas_invoice_seq TO "${runtimeRole}";

-- Web push dispatch bookkeeping: each notification is offered to the push adapter once.
ALTER TABLE notifications ADD COLUMN push_attempted_at timestamptz;
CREATE INDEX notification_push_pending ON notifications(created_at) WHERE push_attempted_at IS NULL;
