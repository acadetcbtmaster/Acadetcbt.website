-- Migration 0005: Account Suspension Lifecycle, Permanent Deletion Financial Anonymization,
-- Course WhatsApp Group Invite Links, and Student Notifications System

-- 1. Account suspension tracking columns on users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Backfill account_status cleanly from existing is_active flag
UPDATE users
SET account_status = CASE WHEN is_active = TRUE THEN 'active' ELSE 'suspended' END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_account_status_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_account_status_check
      CHECK (account_status IN ('active', 'suspended'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_account_status_idx ON users (account_status, is_active);

-- 2. Course WhatsApp tutorial group invite link column on courses
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS whatsapp_group_link TEXT;

-- 3. Preserve anonymized financial records when permanently deleting student accounts
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS deleted_student_ref TEXT;

ALTER TABLE payments
  ALTER COLUMN student_id DROP NOT NULL;

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT c.conname INTO fk_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
  WHERE t.relname = 'payments'
    AND c.contype = 'f'
    AND a.attname = 'student_id'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE payments DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE payments
    ADD CONSTRAINT payments_student_id_users_id_fk
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE SET NULL;
END $$;

-- 4. Individual & automatic student notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL DEFAULT 'Acadet CBT Administration',
  notification_type TEXT NOT NULL DEFAULT 'admin_direct',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  action_label TEXT,
  action_url TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_type_check
    CHECK (notification_type IN ('admin_direct', 'payment_success', 'system'))
);

CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
  ON notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_type_created_idx
  ON notifications (notification_type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_idempotency_unique_idx
  ON notifications (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 5. Per-student read receipts
CREATE TABLE IF NOT EXISTS notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_reads_unique_idx
  ON notification_reads (notification_id, user_id);

CREATE INDEX IF NOT EXISTS notification_reads_user_idx
  ON notification_reads (user_id, read_at DESC);
