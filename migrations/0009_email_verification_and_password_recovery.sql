-- Acadet CBT Upgrade: Email Verification, Password Recovery & SMTP Delivery Tracking
-- Safely extends users and creates hashed-token tables without affecting any existing records.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS users_email_verified_idx
  ON users (email_verified, is_active);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  invalidated_at TIMESTAMPTZ,
  request_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_verification_tokens_hash_unique_idx
  ON email_verification_tokens (token_hash);

CREATE INDEX IF NOT EXISTS email_verification_tokens_user_created_idx
  ON email_verification_tokens (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS email_verification_tokens_expires_idx
  ON email_verification_tokens (expires_at);

CREATE INDEX IF NOT EXISTS email_verification_tokens_active_user_idx
  ON email_verification_tokens (user_id)
  WHERE used_at IS NULL AND invalidated_at IS NULL;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  invalidated_at TIMESTAMPTZ,
  request_ip TEXT,
  used_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_hash_unique_idx
  ON password_reset_tokens (token_hash);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_created_idx
  ON password_reset_tokens (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS password_reset_tokens_ip_created_idx
  ON password_reset_tokens (request_ip, created_at DESC)
  WHERE request_ip IS NOT NULL;

CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_idx
  ON password_reset_tokens (expires_at);

CREATE INDEX IF NOT EXISTS password_reset_tokens_active_user_idx
  ON password_reset_tokens (user_id)
  WHERE used_at IS NULL AND invalidated_at IS NULL;

CREATE TABLE IF NOT EXISTS email_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  email_type TEXT NOT NULL CHECK (email_type IN ('verification', 'password_reset', 'password_changed', 'admin_test')),
  subject TEXT NOT NULL,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('sent', 'failed', 'skipped_unconfigured')),
  message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_delivery_logs_status_created_idx
  ON email_delivery_logs (delivery_status, created_at DESC);

CREATE INDEX IF NOT EXISTS email_delivery_logs_type_created_idx
  ON email_delivery_logs (email_type, created_at DESC);
