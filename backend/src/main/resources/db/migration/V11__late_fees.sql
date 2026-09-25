ALTER TABLE buildings ADD COLUMN late_fee_amount numeric(14,2) CHECK(late_fee_amount IS NULL OR late_fee_amount>=0);
ALTER TABLE buildings ADD COLUMN late_fee_grace_days integer NOT NULL DEFAULT 5 CHECK(late_fee_grace_days>=0);

ALTER TABLE charges DROP CONSTRAINT charges_type_check;
ALTER TABLE charges ADD CONSTRAINT charges_type_check CHECK(type IN ('RENT','LATE_FEE'));

CREATE UNIQUE INDEX one_late_fee_per_period ON charges(lease_id,due_on) WHERE type='LATE_FEE';
