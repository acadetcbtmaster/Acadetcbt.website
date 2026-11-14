-- Payment Verification Logs & Duplicate Gateway Transaction Guard Migration

CREATE INDEX IF NOT EXISTS payments_gateway_tx_idx
  ON payments(gateway_transaction_id)
  WHERE gateway_transaction_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  payment_reference TEXT NOT NULL,
  verification_source TEXT NOT NULL DEFAULT 'student_manual'
    CHECK (verification_source IN ('student_manual', 'callback', 'webhook', 'admin_reverify', 'admin_review')),
  verification_result TEXT NOT NULL
    CHECK (
      verification_result IN (
        'successful',
        'already_registered',
        'pending',
        'failed',
        'not_found',
        'awaiting_admin_review',
        'unauthorized_or_mismatch'
      )
    ),
  payment_status TEXT,
  registration_status TEXT,
  paystack_status TEXT,
  paystack_amount_kobo INTEGER,
  paystack_currency TEXT,
  paystack_customer_email TEXT,
  paystack_transaction_id TEXT,
  paystack_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NOT NULL DEFAULT '',
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_verification_logs_result_idx
  ON payment_verification_logs(verification_result, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_verification_logs_student_idx
  ON payment_verification_logs(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_verification_logs_reference_idx
  ON payment_verification_logs(payment_reference, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_verification_logs_course_idx
  ON payment_verification_logs(course_id, created_at DESC);
