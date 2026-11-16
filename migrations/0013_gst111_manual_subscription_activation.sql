-- Migration 0013: Student Registration Codes + Admin-Controlled Manual Subscription Activation (GST 111 ONLY)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS registration_code TEXT;

WITH candidates AS (
  SELECT
    id,
    'ACD-' || UPPER(SUBSTR(REPLACE(id::text, '-', ''), 1, 8)) AS base_code,
    ROW_NUMBER() OVER (
      PARTITION BY UPPER(SUBSTR(REPLACE(id::text, '-', ''), 1, 8))
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM users
  WHERE registration_code IS NULL OR BTRIM(registration_code) = ''
)
UPDATE users u
SET registration_code = CASE
  WHEN c.rn = 1 THEN c.base_code
  ELSE c.base_code || '-' || c.rn::text
END
FROM candidates c
WHERE u.id = c.id;

CREATE UNIQUE INDEX IF NOT EXISTS users_registration_code_unique_idx
  ON users (registration_code);

CREATE INDEX IF NOT EXISTS users_registration_code_upper_idx
  ON users (UPPER(registration_code));

ALTER TABLE course_registrations
  ADD COLUMN IF NOT EXISTS activation_source TEXT NOT NULL DEFAULT 'paystack',
  ADD COLUMN IF NOT EXISTS activated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'course_registrations_activation_source_check'
  ) THEN
    ALTER TABLE course_registrations
      ADD CONSTRAINT course_registrations_activation_source_check
      CHECK (activation_source IN ('paystack', 'admin_manual'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS course_registrations_activation_source_idx
  ON course_registrations (activation_source, registration_status, registered_at DESC);

CREATE TABLE IF NOT EXISTS gst111_activation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_registration_code TEXT,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  registration_id UUID REFERENCES course_registrations(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('activated', 'deactivated')),
  previous_status TEXT NOT NULL,
  next_status TEXT NOT NULL,
  admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_name TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gst111_activation_history_student_created_idx
  ON gst111_activation_history (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS gst111_activation_history_created_idx
  ON gst111_activation_history (created_at DESC);

CREATE INDEX IF NOT EXISTS gst111_activation_history_reg_code_idx
  ON gst111_activation_history (UPPER(COALESCE(student_registration_code, '')));
