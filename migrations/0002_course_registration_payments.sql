-- 0002_course_registration_payments.sql
-- Safe upgrade migration for Course-Based Registration, Paystack Payments, and Webhook Idempotency

-- 1. Upgrade courses table safely while preserving existing relationships
ALTER TABLE courses ALTER COLUMN subject_id DROP NOT NULL;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS registration_fee NUMERIC(12, 2) NOT NULL DEFAULT 2000.00,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS exam_category TEXT NOT NULL DEFAULT 'Acadet CBT Examination',
  ADD COLUMN IF NOT EXISTS default_duration_minutes INTEGER NOT NULL DEFAULT 60;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_publication_status_check'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_publication_status_check
      CHECK (publication_status IN ('draft', 'published', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_registration_fee_check'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_registration_fee_check
      CHECK (registration_fee >= 0);
  END IF;
END $$;

UPDATE courses
SET publication_status = CASE WHEN is_active THEN 'published' ELSE 'draft' END
WHERE publication_status IS NULL OR publication_status NOT IN ('draft', 'published', 'archived');

CREATE UNIQUE INDEX IF NOT EXISTS courses_code_unique_idx ON courses (LOWER(code));
CREATE INDEX IF NOT EXISTS courses_publication_status_idx ON courses (publication_status, is_active);

-- 2. Make legacy subject_id nullable on questions & exam_sessions and link study_materials directly to courses
ALTER TABLE questions ALTER COLUMN subject_id DROP NOT NULL;
ALTER TABLE exam_sessions ALTER COLUMN subject_id DROP NOT NULL;

ALTER TABLE study_materials
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS study_materials_course_cat_idx
  ON study_materials (course_id, category, is_active);

CREATE INDEX IF NOT EXISTS exam_sessions_course_idx
  ON exam_sessions (course_id);

-- Backfill any legacy rows that only had subject_id populated
UPDATE questions q
SET course_id = c.id
FROM (
  SELECT DISTINCT ON (subject_id) id, subject_id
  FROM courses
  WHERE subject_id IS NOT NULL
  ORDER BY subject_id, created_at ASC
) c
WHERE q.course_id IS NULL AND q.subject_id = c.subject_id;

UPDATE exam_sessions s
SET course_id = c.id
FROM (
  SELECT DISTINCT ON (subject_id) id, subject_id
  FROM courses
  WHERE subject_id IS NOT NULL
  ORDER BY subject_id, created_at ASC
) c
WHERE s.course_id IS NULL AND s.subject_id = c.subject_id;

UPDATE study_materials m
SET course_id = c.id
FROM (
  SELECT DISTINCT ON (subject_id) id, subject_id
  FROM courses
  WHERE subject_id IS NOT NULL
  ORDER BY subject_id, created_at ASC
) c
WHERE m.course_id IS NULL AND m.subject_id = c.subject_id;

-- 3. Create payments table (one row per payment attempt for one student & one course)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  payment_reference TEXT NOT NULL,
  gateway TEXT NOT NULL DEFAULT 'paystack',
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  gateway_transaction_id TEXT,
  gateway_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  authorization_url TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_status_check CHECK (payment_status IN ('pending', 'successful', 'failed', 'refunded')),
  CONSTRAINT payments_amount_check CHECK (amount >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_reference_unique_idx ON payments (payment_reference);
CREATE INDEX IF NOT EXISTS payments_student_created_idx ON payments (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_course_status_idx ON payments (course_id, payment_status);
CREATE INDEX IF NOT EXISTS payments_status_created_idx ON payments (payment_status, created_at DESC);

-- 4. Create course_registrations table (1:1 with successful payment; 1 active registration per student+course)
CREATE TABLE IF NOT EXISTS course_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  registration_status TEXT NOT NULL DEFAULT 'active',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT course_registrations_status_check CHECK (registration_status IN ('active', 'pending', 'revoked', 'expired'))
);

CREATE UNIQUE INDEX IF NOT EXISTS course_registrations_payment_unique_idx
  ON course_registrations (payment_id);

CREATE UNIQUE INDEX IF NOT EXISTS course_registrations_active_student_course_idx
  ON course_registrations (student_id, course_id)
  WHERE registration_status = 'active';

CREATE INDEX IF NOT EXISTS course_registrations_student_idx
  ON course_registrations (student_id, registered_at DESC);

CREATE INDEX IF NOT EXISTS course_registrations_course_idx
  ON course_registrations (course_id, registered_at DESC);

-- 5. Create payment_webhook_events table for webhook deduplication & auditability
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_reference TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payment_reference TEXT,
  processing_status TEXT NOT NULL DEFAULT 'received',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT payment_webhook_events_status_check CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_events_ref_unique_idx
  ON payment_webhook_events (event_reference);

CREATE INDEX IF NOT EXISTS payment_webhook_events_received_idx
  ON payment_webhook_events (received_at DESC);
