-- 0001_initial_schema.sql
-- Acadet CBT PostgreSQL Relational Schema for Render Managed PostgreSQL

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  exam_target TEXT NOT NULL DEFAULT 'JAMB UTME Practice Exam',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  preferences JSONB NOT NULL DEFAULT '{"theme":"light","fontSize":"medium","soundNotifications":true,"autoNextQuestion":false,"showQuestionPalette":true,"defaultSubjectId":null,"defaultDifficulty":"All Levels"}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_role_check CHECK (role IN ('student', 'admin', 'super_admin'))
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  exam_category TEXT NOT NULL DEFAULT 'JAMB UTME Practice Exam',
  description TEXT NOT NULL DEFAULT '',
  default_duration_minutes INTEGER NOT NULL DEFAULT 90,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS subjects_slug_unique_idx ON subjects (slug);
CREATE UNIQUE INDEX IF NOT EXISTS subjects_code_unique_idx ON subjects (code);
CREATE INDEX IF NOT EXISTS subjects_active_idx ON subjects (is_active);

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'UTME',
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS courses_subject_code_unique_idx ON courses (subject_id, code);
CREATE INDEX IF NOT EXISTS courses_subject_idx ON courses (subject_id);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'Medium',
  topic TEXT NOT NULL DEFAULT 'General',
  exam_year INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT questions_correct_option_check CHECK (correct_option IN ('A', 'B', 'C', 'D')),
  CONSTRAINT questions_difficulty_check CHECK (difficulty IN ('Easy', 'Medium', 'Hard'))
);

CREATE INDEX IF NOT EXISTS questions_subject_difficulty_idx ON questions (subject_id, difficulty, is_active);
CREATE INDEX IF NOT EXISTS questions_course_idx ON questions (course_id);

CREATE TABLE IF NOT EXISTS exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  exam_title TEXT NOT NULL DEFAULT 'JAMB UTME Practice Exam',
  difficulty_filter TEXT NOT NULL DEFAULT 'All Levels',
  total_questions INTEGER NOT NULL,
  time_limit_seconds INTEGER NOT NULL,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress',
  correct_count INTEGER,
  wrong_count INTEGER,
  unanswered_count INTEGER,
  score_percentage INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  CONSTRAINT exam_sessions_status_check CHECK (status IN ('in_progress', 'submitted', 'abandoned'))
);

CREATE INDEX IF NOT EXISTS exam_sessions_user_status_idx ON exam_sessions (user_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS exam_sessions_subject_idx ON exam_sessions (subject_id);

CREATE TABLE IF NOT EXISTS exam_session_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  question_order INTEGER NOT NULL,
  selected_option TEXT,
  is_marked_for_review BOOLEAN NOT NULL DEFAULT FALSE,
  is_correct BOOLEAN,
  answered_at TIMESTAMPTZ,
  CONSTRAINT exam_session_questions_selected_check CHECK (selected_option IS NULL OR selected_option IN ('A', 'B', 'C', 'D'))
);

CREATE UNIQUE INDEX IF NOT EXISTS exam_session_questions_order_unique_idx ON exam_session_questions (session_id, question_order);
CREATE UNIQUE INDEX IF NOT EXISTS exam_session_questions_q_unique_idx ON exam_session_questions (session_id, question_id);
CREATE INDEX IF NOT EXISTS exam_session_questions_session_idx ON exam_session_questions (session_id);

CREATE TABLE IF NOT EXISTS study_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Notes',
  file_type TEXT NOT NULL DEFAULT 'PDF',
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  object_key TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  download_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT study_materials_category_check CHECK (category IN ('Tutorials', 'Notes', 'Past Questions', 'Guides'))
);

CREATE INDEX IF NOT EXISTS study_materials_subject_cat_idx ON study_materials (subject_id, category, is_active);

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS announcements_active_pinned_idx ON announcements (is_active, is_pinned, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx ON audit_logs (actor_user_id, created_at DESC);
