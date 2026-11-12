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

  console.log('[Phase 3 Verification] Verifying exam start route omits correct answers...');
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
    const healthJson = (await healthRes.json()) as { status: string; database: { configured: boolean } };
    assert.equal(healthJson.status, 'ok');
    assert.equal(healthJson.database.configured, false);

    const subjRes = await fetch(`${baseUrl}/api/catalog/subjects`);
    assert.equal(subjRes.status, 503);
    const subjJson = (await subjRes.json()) as { code: string };
    assert.equal(subjJson.code, 'DATABASE_NOT_CONFIGURED');

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
