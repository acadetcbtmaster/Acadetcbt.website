import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createApp } from '../server.js';
import { gradeExamAnswers } from '../src/server/lib/examGrader.js';

async function verifyPhase3() {
  console.log('[Phase 3 Verification] Testing backend exam grading math...');
  const outcome = gradeExamAnswers([
    { sessionQuestionId: 'q1', questionOrder: 1, selectedOption: 'A', correctOption: 'A' },
    { sessionQuestionId: 'q2', questionOrder: 2, selectedOption: 'B', correctOption: 'C' },
    { sessionQuestionId: 'q3', questionOrder: 3, selectedOption: null, correctOption: 'D' },
    { sessionQuestionId: 'q4', questionOrder: 4, selectedOption: 'C', correctOption: 'C' },
  ]);

  assert.equal(outcome.totalQuestions, 4);
  assert.equal(outcome.correctCount, 2);
  assert.equal(outcome.wrongCount, 1);
  assert.equal(outcome.unansweredCount, 1);
  assert.equal(outcome.scorePercentage, 50);

  console.log('[Phase 3 Verification] Verifying exam start route omits correct answers & checks course registration...');
  const examsSource = await fs.readFile(
    path.resolve(process.cwd(), 'src/server/routes/exams.ts'),
    'utf-8'
  );
  const startSection = examsSource.split("router.get('/:sessionId'")[0];
  assert.equal(
    startSection.includes('questions.correctOption'),
    false,
    'POST /api/exams/start must never select questions.correctOption'
  );
  assert.ok(
    startSection.includes('hasActivePaidCourseRegistration') &&
      startSection.includes('COURSE_REGISTRATION_REQUIRED'),
    'POST /api/exams/start must enforce active paid course registration'
  );

  console.log('[Phase 3 Verification] Testing Express API routes...');
  const app = await createApp({ skipVite: true });
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object');
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = (await healthRes.json()) as {
      status: string;
      database: { configured: boolean };
      paystack: { configured: boolean };
    };
    assert.equal(healthJson.status, 'ok');
    assert.equal(typeof healthJson.paystack?.configured, 'boolean');

    if (!healthJson.database.configured) {
      const courseRes = await fetch(`${baseUrl}/api/catalog/courses`);
      assert.equal(courseRes.status, 503);
      const courseJson = (await courseRes.json()) as { code: string };
      assert.equal(courseJson.code, 'DATABASE_NOT_CONFIGURED');
    } else {
      const courseRes = await fetch(`${baseUrl}/api/catalog/courses`);
      assert.equal(courseRes.status, 401);
    }

    const notFoundRes = await fetch(`${baseUrl}/api/nonexistent`);
    assert.equal(notFoundRes.status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('[Phase 3 Verification] PASSED.');
}

verifyPhase3().catch((err) => {
  console.error('[Phase 3 Verification] FAILED:', err);
  process.exit(1);
});
