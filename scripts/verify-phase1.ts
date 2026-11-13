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
