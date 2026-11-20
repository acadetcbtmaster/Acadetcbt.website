-- ACADET CBT Upgrade 0017:
-- 1) Add academic hierarchy metadata (faculty, department, semester) to courses
-- 2) Add publication_status, academic metadata, and expanded categories to study_materials
-- 3) Add course_id relational link on study_material_purchases
-- 4) Create study_material_download_logs audit/analytics table

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS faculty TEXT NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS semester TEXT NOT NULL DEFAULT 'First Semester';

ALTER TABLE study_materials
  ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS faculty TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS academic_level TEXT,
  ADD COLUMN IF NOT EXISTS semester TEXT;

ALTER TABLE study_materials
  DROP CONSTRAINT IF EXISTS study_materials_publication_status_check;

ALTER TABLE study_materials
  ADD CONSTRAINT study_materials_publication_status_check
  CHECK (publication_status IN ('published', 'unpublished'));

ALTER TABLE study_materials
  DROP CONSTRAINT IF EXISTS study_materials_category_check;

ALTER TABLE study_materials
  ADD CONSTRAINT study_materials_category_check
  CHECK (
    category IN (
      'Tutorials',
      'Notes',
      'Past Questions',
      'Guides',
      'Lecture Notes',
      'Handouts',
      'Practical Guides'
    )
  );

CREATE INDEX IF NOT EXISTS study_materials_pub_course_idx
  ON study_materials (course_id, publication_status, is_active);

-- Backfill material academic fields from parent course where unset
UPDATE study_materials sm
SET
  faculty = COALESCE(sm.faculty, c.faculty),
  department = COALESCE(sm.department, c.department),
  academic_level = COALESCE(sm.academic_level, c.level),
  semester = COALESCE(sm.semester, c.semester)
FROM courses c
WHERE sm.course_id = c.id
  AND (
    sm.faculty IS NULL
    OR sm.department IS NULL
    OR sm.academic_level IS NULL
    OR sm.semester IS NULL
  );

ALTER TABLE study_material_purchases
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;

UPDATE study_material_purchases smp
SET course_id = sm.course_id
FROM study_materials sm
WHERE smp.material_id = sm.id
  AND smp.course_id IS NULL
  AND sm.course_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS study_material_purchases_course_status_idx
  ON study_material_purchases (course_id, payment_status);

CREATE TABLE IF NOT EXISTS study_material_download_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES study_materials(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  purchase_id UUID REFERENCES study_material_purchases(id) ON DELETE SET NULL,
  is_free_download BOOLEAN NOT NULL DEFAULT FALSE,
  payment_status_snapshot TEXT,
  ip_address TEXT,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS study_material_download_logs_mat_time_idx
  ON study_material_download_logs (material_id, downloaded_at DESC);

CREATE INDEX IF NOT EXISTS study_material_download_logs_student_time_idx
  ON study_material_download_logs (student_id, downloaded_at DESC);
