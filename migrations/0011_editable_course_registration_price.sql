-- 0011_editable_course_registration_price.sql
-- Allow administrators to configure each course's registration_fee and course_value dynamically in the Admin Panel.

ALTER TABLE courses
  DROP CONSTRAINT IF EXISTS courses_standardized_pricing_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_registration_fee_check'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_registration_fee_check
      CHECK (registration_fee >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_course_value_check'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_course_value_check
      CHECK (course_value >= 0);
  END IF;
END $$;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_total_cap_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_amounts_non_negative_check'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_amounts_non_negative_check
      CHECK (amount >= 0 AND total_amount_charged >= 0);
  END IF;
END $$;
