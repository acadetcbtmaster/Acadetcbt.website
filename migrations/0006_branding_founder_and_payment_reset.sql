-- Acadet CBT Upgrade: Branding, Founder Profile & Payment Record Reset Support
-- Safe, additive PostgreSQL migration preserving existing user, exam, result, and course registration records.

-- 1. Preserve course registrations safely during authorized Super Admin payment resets
ALTER TABLE course_registrations
  ADD COLUMN IF NOT EXISTS preserved_payment_ref TEXT,
  ADD COLUMN IF NOT EXISTS preserved_amount_paid NUMERIC(12, 2);

ALTER TABLE course_registrations
  ALTER COLUMN payment_id DROP NOT NULL;

DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.table_name = 'course_registrations'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'payment_id'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE course_registrations DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE course_registrations
  ADD CONSTRAINT course_registrations_payment_id_fkey
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;

-- 2. Payment Backups Table (required before test cleanup or Super Admin payment reset)
CREATE TABLE IF NOT EXISTS payment_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_label TEXT NOT NULL,
  reset_scope TEXT NOT NULL DEFAULT 'manual_snapshot',
  total_payments_count INTEGER NOT NULL DEFAULT 0,
  successful_count INTEGER NOT NULL DEFAULT 0,
  pending_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  test_count INTEGER NOT NULL DEFAULT 0,
  snapshot_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_backups_scope_check CHECK (
    reset_scope IN ('manual_snapshot', 'test_and_stale', 'full_production_reset')
  )
);

CREATE INDEX IF NOT EXISTS payment_backups_created_idx
  ON payment_backups (created_at DESC);

-- 3. Official Site Branding & SEO Settings Table
CREATE TABLE IF NOT EXISTS site_branding (
  id TEXT PRIMARY KEY DEFAULT 'default',
  site_name TEXT NOT NULL DEFAULT 'Acadet CBT',
  tagline TEXT NOT NULL DEFAULT '...Learn, Practice, Excel',
  site_description TEXT NOT NULL DEFAULT 'Acadet CBT is an online computer-based testing and academic preparation platform helping students study course materials, practise examination questions, and track performance.',
  seo_title TEXT NOT NULL DEFAULT 'Acadet CBT | Online CBT Practice, Courses & Exam Preparation',
  seo_description TEXT NOT NULL DEFAULT 'Acadet CBT and Acadet Learning Hub provide realistic online CBT practice, JAMB CBT practice, structured courses, study materials, and instant performance analytics.',
  seo_keywords TEXT NOT NULL DEFAULT 'Acadet CBT, Acadet Learning Hub, JAMB CBT Practice, Online CBT Practice, Computer-Based Examination, Online Examination Practice',
  logo_url TEXT NOT NULL DEFAULT '/acadet-logo.png',
  logo_object_key TEXT,
  favicon_url TEXT NOT NULL DEFAULT '/favicon-48x48.png',
  favicon_object_key TEXT,
  contact_email TEXT NOT NULL DEFAULT 'support@acadetcbt.website',
  contact_phone TEXT,
  contact_whatsapp TEXT,
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO site_branding (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- 4. Founder & Creator Profile Table
CREATE TABLE IF NOT EXISTS founder_profile (
  id TEXT PRIMARY KEY DEFAULT 'default',
  full_name TEXT NOT NULL DEFAULT 'ISAIAH (MENMEX)',
  position_title TEXT NOT NULL DEFAULT 'Founder & Creator, Acadet CBT',
  biography TEXT NOT NULL DEFAULT 'Isaiah, popularly known as Menmex, is the Founder and Creator of Acadet CBT. He is a digital content creator and technology enthusiast interested in building practical digital solutions and supporting students through accessible educational resources and technology-driven learning.',
  founder_message TEXT NOT NULL DEFAULT 'Acadet CBT was established to make learning, examination preparation and academic practice more accessible to students. Our goal is to provide a platform where students can improve their understanding, practise effectively and build confidence in their academic journey.',
  vision_statement TEXT NOT NULL DEFAULT 'To make structured academic preparation, computer-based testing practice, and accessible study materials available to every student preparing for success.',
  mission_statement TEXT NOT NULL DEFAULT 'To improve students'' understanding of registered courses, provide reliable CBT simulations and educational resources, and build academic confidence through consistent practice and performance insight.',
  background_story TEXT NOT NULL DEFAULT 'Acadet CBT was created under Acadet Learning Hub to bridge the gap between classroom study and realistic computer-based examination readiness, combining curated courses, study materials, verified assessments, and guided tutorial support.',
  photo_url TEXT,
  photo_object_key TEXT,
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO founder_profile (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;
