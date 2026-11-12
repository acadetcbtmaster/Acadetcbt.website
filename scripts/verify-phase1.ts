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
  ] as const;

  for (const key of expectedTables) {
    assert.ok(schema[key], `Missing table export: ${key}`);
  }

  console.log('[Phase 1 Verification] Checking SQL migration file...');
  const sqlPath = path.resolve(process.cwd(), 'migrations/0001_initial_schema.sql');
  const sqlContent = await fs.readFile(sqlPath, 'utf-8');
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
      sqlContent.includes(`CREATE TABLE IF NOT EXISTS ${tbl}`),
      `SQL migration missing table: ${tbl}`
    );
  }

  assert.ok(
    sqlContent.includes('REFERENCES subjects(id)'),
    'Missing foreign key relationships in SQL migration'
  );
  assert.ok(
    sqlContent.includes("CHECK (correct_option IN ('A', 'B', 'C', 'D'))"),
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
