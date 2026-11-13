-- 0004_standardized_course_pricing.sql
-- Standardize Acadet CBT course pricing (₦2,300 course value, ₦2,350 total payable, Paystack charges absorbed by Acadet CBT)
-- Add merchant-side fee accounting and net settlement reconciliation columns on payments

-- 1. Standardize pricing structure across every course
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS course_value NUMERIC(12, 2) NOT NULL DEFAULT 2300.00;

ALTER TABLE courses
  ALTER COLUMN course_value SET DEFAULT 2300.00,
  ALTER COLUMN registration_fee SET DEFAULT 2350.00,
  ALTER COLUMN currency SET DEFAULT 'NGN';

UPDATE courses
SET course_value = 2300.00,
    registration_fee = 2350.00,
    currency = 'NGN',
    updated_at = NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_standardized_pricing_check'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_standardized_pricing_check
      CHECK (course_value = 2300.00 AND registration_fee = 2350.00);
  END IF;
END $$;

-- 2. Add separate financial reporting & fee reconciliation columns to payments
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS course_value NUMERIC(12, 2) NOT NULL DEFAULT 2300.00,
  ADD COLUMN IF NOT EXISTS total_amount_charged NUMERIC(12, 2) NOT NULL DEFAULT 2350.00,
  ADD COLUMN IF NOT EXISTS gateway_fee NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS gateway_fee_source TEXT,
  ADD COLUMN IF NOT EXISTS net_settlement_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS settlement_variance NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS fee_absorbed_by TEXT NOT NULL DEFAULT 'Acadet CBT',
  ADD COLUMN IF NOT EXISTS payment_channel TEXT;

UPDATE payments
SET total_amount_charged = amount,
    course_value = COALESCE(course_value, 2300.00),
    fee_absorbed_by = COALESCE(fee_absorbed_by, 'Acadet CBT'),
    reconciliation_status = CASE
      WHEN payment_status = 'successful' AND reconciliation_status = 'pending' THEN 'reconciled'
      WHEN payment_status IN ('failed', 'refunded') THEN 'not_applicable'
      ELSE reconciliation_status
    END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_reconciliation_status_check'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_reconciliation_status_check
      CHECK (reconciliation_status IN ('pending', 'reconciled', 'shortfall', 'not_applicable'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_total_cap_check'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_total_cap_check
      CHECK (amount <= 2350.00 AND total_amount_charged <= 2350.00) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS payments_reconciliation_idx
  ON payments (reconciliation_status, created_at DESC);
