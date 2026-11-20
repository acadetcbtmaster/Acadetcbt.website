-- Add PostgreSQL binary fallback storage for Study Materials and Branding Assets
-- Ensures uploads work cleanly even when external S3 Object Storage is not configured.

ALTER TABLE study_materials
  ADD COLUMN IF NOT EXISTS storage_backend TEXT NOT NULL DEFAULT 's3',
  ADD COLUMN IF NOT EXISTS file_data BYTEA,
  ADD COLUMN IF NOT EXISTS original_filename TEXT;

ALTER TABLE study_materials DROP CONSTRAINT IF EXISTS study_materials_storage_backend_check;
ALTER TABLE study_materials
  ADD CONSTRAINT study_materials_storage_backend_check
  CHECK (storage_backend IN ('s3', 'postgres'));

CREATE TABLE IF NOT EXISTS branding_asset_binaries (
  slot TEXT PRIMARY KEY,
  mime_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  file_data BYTEA NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT branding_asset_binaries_slot_check
    CHECK (slot IN ('logo', 'favicon', 'founder-photo'))
);
