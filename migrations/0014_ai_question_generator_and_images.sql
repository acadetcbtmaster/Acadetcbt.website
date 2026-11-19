-- 0014_ai_question_generator_and_images.sql
-- Adds secure backend AI provider configuration, draft/published workflow for AI-generated
-- CBT questions, and single/multi-image attachment storage for questions.

CREATE TABLE IF NOT EXISTS ai_provider_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  provider_name TEXT NOT NULL DEFAULT 'gemini',
  encrypted_api_key TEXT,
  key_hint TEXT,
  model_name TEXT NOT NULL DEFAULT 'gemini-4-hydrogen',
  last_tested_at TIMESTAMPTZ,
  last_test_status TEXT NOT NULL DEFAULT 'unknown',
  last_test_message TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_provider_settings_test_status_check
    CHECK (last_test_status IN ('unknown', 'connected', 'failed', 'unconfigured'))
);

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_requires_image BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_image_note TEXT,
  ADD COLUMN IF NOT EXISTS ai_batch_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'questions_publication_status_check'
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT questions_publication_status_check
      CHECK (publication_status IN ('draft', 'published'));
  END IF;
END $$;

UPDATE questions
SET publication_status = 'published'
WHERE publication_status IS NULL;

CREATE INDEX IF NOT EXISTS questions_course_pub_diff_active_idx
  ON questions (course_id, publication_status, difficulty, is_active);

CREATE INDEX IF NOT EXISTS questions_ai_batch_idx
  ON questions (ai_batch_id)
  WHERE ai_batch_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS question_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  caption TEXT,
  mime_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_backend TEXT NOT NULL DEFAULT 'postgres',
  object_key TEXT,
  image_data BYTEA,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT question_images_storage_backend_check
    CHECK (storage_backend IN ('s3', 'postgres')),
  CONSTRAINT question_images_mime_check
    CHECK (mime_type IN ('image/jpeg', 'image/jpg', 'image/png', 'image/webp')),
  CONSTRAINT question_images_size_check
    CHECK (file_size_bytes > 0 AND file_size_bytes <= 5242880)
);

CREATE INDEX IF NOT EXISTS question_images_question_order_idx
  ON question_images (question_id, sort_order, created_at);
