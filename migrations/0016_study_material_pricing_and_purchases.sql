-- Per-material pricing & Paystack purchase tracking for individual PDFs / study materials

ALTER TABLE study_materials
  ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE study_materials
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NGN';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'study_materials_price_check'
      AND conrelid = 'study_materials'::regclass
  ) THEN
    ALTER TABLE study_materials
      ADD CONSTRAINT study_materials_price_check CHECK (price >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS study_material_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES study_materials(id) ON DELETE CASCADE,
  payment_reference TEXT NOT NULL,
  gateway TEXT NOT NULL DEFAULT 'paystack',
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'successful', 'failed', 'refunded')),
  gateway_transaction_id TEXT,
  payment_channel TEXT,
  gateway_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  authorization_url TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS study_material_purchases_ref_unique_idx
  ON study_material_purchases(payment_reference);

CREATE UNIQUE INDEX IF NOT EXISTS study_material_purchases_active_student_mat_idx
  ON study_material_purchases(student_id, material_id)
  WHERE payment_status = 'successful';

CREATE INDEX IF NOT EXISTS study_material_purchases_student_created_idx
  ON study_material_purchases(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS study_material_purchases_material_status_idx
  ON study_material_purchases(material_id, payment_status);

CREATE INDEX IF NOT EXISTS study_material_purchases_gateway_tx_idx
  ON study_material_purchases(gateway_transaction_id)
  WHERE gateway_transaction_id IS NOT NULL;
