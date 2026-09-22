DELETE FROM automation_runs;
ALTER TABLE automation_runs ADD COLUMN organization_id uuid NOT NULL REFERENCES organizations(id);
ALTER TABLE automation_runs DROP CONSTRAINT automation_runs_job_key_scheduled_for_key;
ALTER TABLE automation_runs ADD CONSTRAINT automation_runs_organization_id_job_key_scheduled_for_key
 UNIQUE(organization_id,job_key,scheduled_for);
