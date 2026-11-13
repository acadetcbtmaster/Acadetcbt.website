-- 0003_whatsapp_number_course_registration.sql
-- Add student WhatsApp number tracking for course registration & Paystack records

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

ALTER TABLE course_registrations
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
