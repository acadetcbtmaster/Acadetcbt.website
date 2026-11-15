import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { checkDatabaseHealth, isDatabaseConfigured } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';

async function verifyPhase1() {
  console.log('[Phase 1 Verification] Checking relational schema definitions...');
  const expectedTables = [
    'users',
    'subjects',
    'courses',
    'questions',
    'examSessions',
    'examSessionQuestions',
    'studyMaterials',
    'announcements',
    'auditLogs',
    'payments',
    'courseRegistrations',
    'paymentWebhookEvents',
    'notifications',
    'notificationReads',
    'paymentBackups',
    'siteBranding',
    'founderProfile',
    'paymentVerificationLogs',
    'emailVerificationTokens',
    'passwordResetTokens',
    'emailDeliveryLogs',
  ] as const;

  for (const key of expectedTables) {
    assert.ok(schema[key], `Missing table export: ${key}`);
  }

  console.log('[Phase 1 Verification] Checking SQL migration files...');
  const sqlPath1 = path.resolve(process.cwd(), 'migrations/0001_initial_schema.sql');
  const sqlContent1 = await fs.readFile(sqlPath1, 'utf-8');
  const requiredSqlTables = [
    'users',
    'subjects',
    'courses',
    'questions',
    'exam_sessions',
    'exam_session_questions',
    'study_materials',
    'announcements',
    'audit_logs',
  ];

  for (const tbl of requiredSqlTables) {
    assert.ok(
      sqlContent1.includes(`CREATE TABLE IF NOT EXISTS ${tbl}`),
      `SQL migration 0001 missing table: ${tbl}`
    );
  }

  const sqlPath2 = path.resolve(
    process.cwd(),
    'migrations/0002_course_registration_payments.sql'
  );
  const sqlContent2 = await fs.readFile(sqlPath2, 'utf-8');
  for (const tbl of ['payments', 'course_registrations', 'payment_webhook_events']) {
    assert.ok(
      sqlContent2.includes(`CREATE TABLE IF NOT EXISTS ${tbl}`),
      `SQL migration 0002 missing table: ${tbl}`
    );
  }
  assert.ok(
    sqlContent2.includes('registration_fee'),
    'Migration 0002 must add registration_fee on courses'
  );

  const sqlPath3 = path.resolve(
    process.cwd(),
    'migrations/0003_whatsapp_number_course_registration.sql'
  );
  const sqlContent3 = await fs.readFile(sqlPath3, 'utf-8');
  for (const tbl of ['users', 'payments', 'course_registrations']) {
    assert.ok(
      sqlContent3.includes(`ALTER TABLE ${tbl}`) &&
        sqlContent3.includes('whatsapp_number'),
      `SQL migration 0003 must add whatsapp_number on ${tbl}`
    );
  }

  const sqlPath4 = path.resolve(
    process.cwd(),
    'migrations/0004_standardized_course_pricing.sql'
  );
  const sqlContent4 = await fs.readFile(sqlPath4, 'utf-8');
  assert.ok(
    sqlContent4.includes('course_value'),
    'SQL migration 0004 must add course_value'
  );
  for (const col of [
    'total_amount_charged',
    'gateway_fee',
    'net_settlement_amount',
    'reconciliation_status',
  ]) {
    assert.ok(
      sqlContent4.includes(col),
      `SQL migration 0004 must add ${col} on payments`
    );
  }

  const sqlPath5 = path.resolve(
    process.cwd(),
    'migrations/0005_user_lifecycle_notifications_group_links.sql'
  );
  const sqlContent5 = await fs.readFile(sqlPath5, 'utf-8');
  for (const snippet of [
    'account_status',
    'suspended_reason',
    'whatsapp_group_link',
    'deleted_student_ref',
    'ON DELETE SET NULL',
    'CREATE TABLE IF NOT EXISTS notifications',
    'CREATE TABLE IF NOT EXISTS notification_reads',
    'notifications_idempotency_unique_idx',
  ]) {
    assert.ok(
      sqlContent5.includes(snippet),
      `SQL migration 0005 missing expected definition: ${snippet}`
    );
  }

  const sqlPath6 = path.resolve(
    process.cwd(),
    'migrations/0006_branding_founder_and_payment_reset.sql'
  );
  const sqlContent6 = await fs.readFile(sqlPath6, 'utf-8');
  for (const snippet of [
    'CREATE TABLE IF NOT EXISTS payment_backups',
    'CREATE TABLE IF NOT EXISTS site_branding',
    'CREATE TABLE IF NOT EXISTS founder_profile',
    'preserved_payment_ref',
    'ON DELETE SET NULL',
    'ISAIAH (MENMEX)',
  ]) {
    assert.ok(
      sqlContent6.includes(snippet),
      `SQL migration 0006 missing expected definition: ${snippet}`
    );
  }

  const sqlPath7 = path.resolve(
    process.cwd(),
    'migrations/0007_payment_verification_logs_and_recovery.sql'
  );
  const sqlContent7 = await fs.readFile(sqlPath7, 'utf-8');
  for (const snippet of [
    'payments_gateway_tx_idx',
    'CREATE TABLE IF NOT EXISTS payment_verification_logs',
    'verification_result',
    'awaiting_admin_review',
    'unauthorized_or_mismatch',
    'paystack_transaction_id',
  ]) {
    assert.ok(
      sqlContent7.includes(snippet),
      `SQL migration 0007 missing expected definition: ${snippet}`
    );
  }

  const sqlPath9 = path.resolve(
    process.cwd(),
    'migrations/0009_email_verification_and_password_recovery.sql'
  );
  const sqlContent9 = await fs.readFile(sqlPath9, 'utf-8');
  for (const snippet of [
    'email_verified',
    'session_version',
    'CREATE TABLE IF NOT EXISTS email_verification_tokens',
    'CREATE TABLE IF NOT EXISTS password_reset_tokens',
    'CREATE TABLE IF NOT EXISTS email_delivery_logs',
    'token_hash',
  ]) {
    assert.ok(
      sqlContent9.includes(snippet),
      `SQL migration 0009 missing expected definition: ${snippet}`
    );
  }

  const sqlPath10 = path.resolve(
    process.cwd(),
    'migrations/0010_email_delivery_status_states.sql'
  );
  const sqlContent10 = await fs.readFile(sqlPath10, 'utf-8');
  for (const snippet of [
    'provider_message_uuid',
    'provider_status',
    "'queued'",
    "'delivered'",
    "'bounced'",
  ]) {
    assert.ok(
      sqlContent10.includes(snippet),
      `SQL migration 0010 missing expected definition: ${snippet}`
    );
  }

  assert.ok(
    sqlContent1.includes("CHECK (correct_option IN ('A', 'B', 'C', 'D'))"),
    'Missing check constraint on correct_option'
  );

  const health = await checkDatabaseHealth();
  console.log('[Phase 1 Verification] DB health check (no silent fallback):', {
    configured: isDatabaseConfigured(),
    ...health,
  });

  console.log('[Phase 1 Verification] PASSED.');
}

verifyPhase1().catch((err) => {
  console.error('[Phase 1 Verification] FAILED:', err);
  process.exit(1);
});
