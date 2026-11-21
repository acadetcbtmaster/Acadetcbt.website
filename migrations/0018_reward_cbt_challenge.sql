-- Migration 0018: Acadet Reward CBT Challenge System
-- Preserves all existing tables, GST111 course/payment records, and standard CBT engine.

CREATE TABLE IF NOT EXISTS reward_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  lifecycle_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (lifecycle_status IN ('draft', 'active', 'closed', 'deactivated')),
  reward_amount NUMERIC(12, 2) NOT NULL DEFAULT 10000.00
    CHECK (reward_amount >= 0),
  reward_currency TEXT NOT NULL DEFAULT 'NGN',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reward_challenges_active_idx
  ON reward_challenges (is_active, is_featured, created_at DESC);

CREATE TABLE IF NOT EXISTS reward_challenge_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL UNIQUE REFERENCES reward_challenges(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
  challenge_open_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exam_start_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 day'),
  exam_end_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 day 2 hours'),
  duration_minutes INTEGER NOT NULL DEFAULT 10 CHECK (duration_minutes >= 1 AND duration_minutes <= 360),
  question_count INTEGER NOT NULL DEFAULT 40 CHECK (question_count >= 1 AND question_count <= 500),
  selection_mode TEXT NOT NULL DEFAULT 'random'
    CHECK (selection_mode IN ('random', 'ordered')),
  winner_announcement_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 day 8 hours'),
  challenge_close_at TIMESTAMPTZ,
  exam_finalized_at TIMESTAMPTZ,
  winner_announced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reward_challenge_settings_schedule_idx
  ON reward_challenge_settings (exam_start_at, exam_end_at, winner_announcement_at);

CREATE TABLE IF NOT EXISTS reward_challenge_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES reward_challenges(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
  explanation TEXT NOT NULL DEFAULT '',
  subject_category TEXT NOT NULL DEFAULT 'General',
  publication_status TEXT NOT NULL DEFAULT 'published'
    CHECK (publication_status IN ('draft', 'published')),
  source_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'bulk_upload', 'ai_generated')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reward_challenge_questions_chal_pub_idx
  ON reward_challenge_questions (challenge_id, publication_status, sort_order, created_at);

CREATE TABLE IF NOT EXISTS reward_challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES reward_challenges(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'joined'
    CHECK (status IN ('joined', 'in_progress', 'completed')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS reward_challenge_participants_unique_idx
  ON reward_challenge_participants (challenge_id, student_id);

CREATE INDEX IF NOT EXISTS reward_challenge_participants_student_idx
  ON reward_challenge_participants (student_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS reward_challenge_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES reward_challenges(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES reward_challenge_participants(id) ON DELETE CASCADE,
  question_ids_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_questions INTEGER NOT NULL CHECK (total_questions >= 1),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 60),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  completion_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted', 'auto_submitted')),
  is_valid BOOLEAN NOT NULL DEFAULT TRUE,
  submission_source TEXT
    CHECK (submission_source IS NULL OR submission_source IN ('manual', 'auto_timer', 'server_scheduler')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS reward_challenge_attempts_chal_student_unique_idx
  ON reward_challenge_attempts (challenge_id, student_id);

CREATE INDEX IF NOT EXISTS reward_challenge_attempts_status_expires_idx
  ON reward_challenge_attempts (challenge_id, status, expires_at);

CREATE TABLE IF NOT EXISTS reward_challenge_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES reward_challenge_attempts(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES reward_challenges(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES reward_challenge_questions(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL,
  selected_option TEXT CHECK (selected_option IS NULL OR selected_option IN ('A', 'B', 'C', 'D')),
  is_marked_for_review BOOLEAN NOT NULL DEFAULT FALSE,
  is_correct BOOLEAN,
  answered_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS reward_challenge_answers_attempt_order_unique_idx
  ON reward_challenge_answers (attempt_id, question_order);

CREATE UNIQUE INDEX IF NOT EXISTS reward_challenge_answers_attempt_question_unique_idx
  ON reward_challenge_answers (attempt_id, question_id);

CREATE TABLE IF NOT EXISTS reward_challenge_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES reward_challenges(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL UNIQUE REFERENCES reward_challenge_attempts(id) ON DELETE CASCADE,
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  wrong_answers INTEGER NOT NULL DEFAULT 0,
  unanswered_questions INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  percentage INTEGER NOT NULL DEFAULT 0,
  completion_time_seconds INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL,
  is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
  is_valid BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS reward_challenge_results_chal_student_unique_idx
  ON reward_challenge_results (challenge_id, student_id);

CREATE INDEX IF NOT EXISTS reward_challenge_results_ranking_idx
  ON reward_challenge_results (challenge_id, is_valid, score DESC, completion_time_seconds ASC, submitted_at ASC);

CREATE TABLE IF NOT EXISTS reward_challenge_leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES reward_challenges(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES reward_challenge_attempts(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  student_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  percentage INTEGER NOT NULL,
  completion_time_seconds INTEGER NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  is_final BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS reward_challenge_leaderboards_chal_student_unique_idx
  ON reward_challenge_leaderboards (challenge_id, student_id);

CREATE INDEX IF NOT EXISTS reward_challenge_leaderboards_chal_pos_idx
  ON reward_challenge_leaderboards (challenge_id, position ASC);

CREATE TABLE IF NOT EXISTS reward_challenge_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL UNIQUE REFERENCES reward_challenges(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES reward_challenge_attempts(id) ON DELETE CASCADE,
  result_id UUID NOT NULL REFERENCES reward_challenge_results(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 1,
  student_name TEXT NOT NULL,
  student_registration_code TEXT,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  percentage INTEGER NOT NULL,
  completion_time_seconds INTEGER NOT NULL,
  reward_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reward_currency TEXT NOT NULL DEFAULT 'NGN',
  announced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  announcement_mode TEXT NOT NULL DEFAULT 'scheduler'
    CHECK (announcement_mode IN ('scheduler', 'admin'))
);

CREATE INDEX IF NOT EXISTS reward_challenge_winners_student_idx
  ON reward_challenge_winners (student_id, announced_at DESC);

CREATE TABLE IF NOT EXISTS reward_challenge_bank_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL UNIQUE REFERENCES reward_challenges(id) ON DELETE CASCADE,
  winner_id UUID NOT NULL REFERENCES reward_challenge_winners(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  edit_locked BOOLEAN NOT NULL DEFAULT FALSE,
  correction_note TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reward_challenge_bank_details_student_idx
  ON reward_challenge_bank_details (student_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS reward_challenge_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL UNIQUE REFERENCES reward_challenges(id) ON DELETE CASCADE,
  winner_id UUID NOT NULL REFERENCES reward_challenge_winners(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_details_id UUID REFERENCES reward_challenge_bank_details(id) ON DELETE SET NULL,
  reward_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  payment_status TEXT NOT NULL DEFAULT 'payment_pending'
    CHECK (payment_status IN ('payment_pending', 'payment_processing', 'payment_completed')),
  paid_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  paid_by_admin_name TEXT,
  paid_by_admin_email TEXT,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reward_challenge_payments_status_idx
  ON reward_challenge_payments (payment_status, created_at DESC);

CREATE TABLE IF NOT EXISTS reward_challenge_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES reward_challenges(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reward_challenge_notifications_chal_student_idx
  ON reward_challenge_notifications (challenge_id, student_id, created_at DESC);
