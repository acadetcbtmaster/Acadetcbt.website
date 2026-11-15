-- Acadet CBT Upgrade: Track Lockally accepted/queued vs delivered vs bounced states cleanly
DO $$
DECLARE
  constraint_name_rec RECORD;
BEGIN
  FOR constraint_name_rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'email_delivery_logs'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%delivery_status%'
  LOOP
    EXECUTE format('ALTER TABLE email_delivery_logs DROP CONSTRAINT IF EXISTS %I', constraint_name_rec.conname);
  END LOOP;
END $$;

ALTER TABLE email_delivery_logs
  ADD COLUMN IF NOT EXISTS provider_message_uuid TEXT,
  ADD COLUMN IF NOT EXISTS provider_status TEXT;

ALTER TABLE email_delivery_logs
  ADD CONSTRAINT email_delivery_logs_delivery_status_check
  CHECK (delivery_status IN ('queued', 'delivered', 'bounced', 'sent', 'failed', 'skipped_unconfigured'));
