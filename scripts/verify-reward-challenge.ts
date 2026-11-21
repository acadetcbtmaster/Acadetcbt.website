import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createApp } from '../server.js';
import {
  RewardChallengeError,
  computeChallengeDisplayStatus,
  formatWatDateTime,
  parseBulkChallengeQuestionsFile,
  parseScheduleTimestampInput,
  type ChallengeRowJoined,
} from '../src/server/lib/rewardChallenge.js';

function makeChallenge(overrides: Partial<ChallengeRowJoined> = {}): ChallengeRowJoined {
  const base = new Date('2026-12-01T09:00:00+01:00');
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Acadet Scholarship CBT #1',
    description: 'Timed challenge',
    isActive: true,
    isFeatured: true,
    lifecycleStatus: 'active',
    rewardAmount: 25000,
    rewardCurrency: 'NGN',
    timezone: 'Africa/Lagos',
    challengeOpenAt: new Date(base.getTime() + 1 * 3600_000),
    examStartAt: new Date(base.getTime() + 2 * 3600_000),
    examEndAt: new Date(base.getTime() + 4 * 3600_000),
    durationMinutes: 20,
    questionCount: 20,
    selectionMode: 'random',
    winnerAnnouncementAt: new Date(base.getTime() + 5 * 3600_000),
    challengeCloseAt: new Date(base.getTime() + 24 * 3600_000),
    examFinalizedAt: null,
    winnerAnnouncedAt: null,
    ...overrides,
  };
}

async function run() {
  console.log('[Reward Challenge Verification] 1. Testing Africa/Lagos (WAT) timestamp parsing & status transitions...');
  const parsedWat = parseScheduleTimestampInput('2026-12-01T14:30');
  assert.equal(parsedWat.toISOString(), '2026-12-01T13:30:00.000Z');
  assert.ok(formatWatDateTime(parsedWat).includes('WAT'));

  assert.throws(
    () => parseScheduleTimestampInput('invalid-date'),
    (err: unknown) => err instanceof RewardChallengeError && err.code === 'INVALID_SCHEDULE'
  );

  const ch = makeChallenge();
  assert.equal(
    computeChallengeDisplayStatus({
      challenge: ch,
      hasWinner: false,
      uploadedQuestionCount: 20,
      now: new Date(ch.challengeOpenAt.getTime() - 60_000),
    }).displayStatus,
    'Upcoming'
  );

  const activeState = computeChallengeDisplayStatus({
    challenge: ch,
    hasWinner: false,
    uploadedQuestionCount: 20,
    now: new Date(ch.challengeOpenAt.getTime() + 60_000),
  });
  assert.equal(activeState.displayStatus, 'Active');
  assert.equal(activeState.canJoinWaitingRoom, true);
  assert.equal(activeState.canStartExam, false);

  const inProgState = computeChallengeDisplayStatus({
    challenge: ch,
    hasWinner: false,
    uploadedQuestionCount: 20,
    now: new Date(ch.examStartAt.getTime() + 60_000),
  });
  assert.equal(inProgState.displayStatus, 'Examination in Progress');
  assert.equal(inProgState.canStartExam, true);

  assert.equal(
    computeChallengeDisplayStatus({
      challenge: ch,
      hasWinner: false,
      uploadedQuestionCount: 20,
      now: new Date(ch.examEndAt.getTime() + 60_000),
    }).displayStatus,
    'Examination Completed'
  );

  assert.equal(
    computeChallengeDisplayStatus({
      challenge: makeChallenge({ winnerAnnouncedAt: new Date() }),
      hasWinner: true,
      uploadedQuestionCount: 20,
      now: new Date(ch.winnerAnnouncementAt.getTime() + 60_000),
    }).displayStatus,
    'Winner Announced'
  );

  assert.equal(
    computeChallengeDisplayStatus({
      challenge: makeChallenge({ isActive: false, lifecycleStatus: 'deactivated' }),
      hasWinner: false,
      uploadedQuestionCount: 20,
      now: new Date(ch.examStartAt.getTime() + 60_000),
    }).displayStatus,
    'Challenge Closed'
  );

  console.log('[Reward Challenge Verification] 2. Testing bulk file question parsing (JSON, CSV, TXT)...');
  const jsonQs = await parseBulkChallengeQuestionsFile({
    originalname: 'bank.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify([
        {
          questionText: 'What is the capital of Nigeria?',
          optionA: 'Lagos',
          optionB: 'Abuja',
          optionC: 'Kano',
          optionD: 'Ibadan',
          correctOption: 'B',
          explanation: 'Abuja became capital in 1991.',
          subjectCategory: 'General Studies',
        },
      ])
    ),
  });
  assert.equal(jsonQs.length, 1);
  assert.equal(jsonQs[0].correctOption, 'B');

  const csvQs = await parseBulkChallengeQuestionsFile({
    originalname: 'bank.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'question,optionA,optionB,optionC,optionD,correctOption,explanation,category\n"2 + 2 = ?","3","4","5","6","B","Basic arithmetic","Math"\n'
    ),
  });
  assert.equal(csvQs.length, 1);
  assert.equal(csvQs[0].optionB, '4');

  const txtQs = await parseBulkChallengeQuestionsFile({
    originalname: 'bank.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      '1. Which gas is essential for respiration?\nA. Nitrogen\nB. Argon\nC. Oxygen\nD. Neon\nAnswer: C\nExplanation: Aerobic respiration requires oxygen.\n'
    ),
  });
  assert.equal(txtQs.length, 1);
  assert.equal(txtQs[0].correctOption, 'C');

  console.log('[Reward Challenge Verification] 3. Auditing migration, schema, UI invariants & safety rules...');
  const migrationSql = await fs.readFile(
    path.resolve(process.cwd(), 'migrations/0018_reward_cbt_challenge.sql'),
    'utf-8'
  );
  for (const tbl of [
    'reward_challenges',
    'reward_challenge_settings',
    'reward_challenge_questions',
    'reward_challenge_participants',
    'reward_challenge_attempts',
    'reward_challenge_answers',
    'reward_challenge_results',
    'reward_challenge_leaderboards',
    'reward_challenge_winners',
    'reward_challenge_bank_details',
    'reward_challenge_payments',
    'reward_challenge_notifications',
  ]) {
    assert.ok(migrationSql.includes(tbl), `Missing migration table ${tbl}`);
  }
  assert.equal(migrationSql.toUpperCase().includes('DROP TABLE'), false);

  const schemaSrc = await fs.readFile(
    path.resolve(process.cwd(), 'src/db/schema.ts'),
    'utf-8'
  );
  assert.ok(schemaSrc.includes('rewardChallenges'));
  assert.ok(schemaSrc.includes('rewardChallengeBankDetails'));

  const homeSrc = await fs.readFile(
    path.resolve(process.cwd(), 'src/components/cbt/HomeDashboard.tsx'),
    'utf-8'
  );
  assert.ok(homeSrc.includes('RewardChallengeDashboardCard'));
  assert.equal(homeSrc.includes('GST 111 – Subscription Inactive'), false);
  assert.equal(homeSrc.includes('Unlock GST 111'), false);

  // Ensure GST111 course & manual admin tools remain intact in backend & admin console
  const gst111AdminSrc = await fs.readFile(
    path.resolve(process.cwd(), 'src/components/cbt/Gst111ManualActivationPanel.tsx'),
    'utf-8'
  );
  assert.ok(gst111AdminSrc.includes('Manual Subscription Activation'));

  const adminRewardSrc = await fs.readFile(
    path.resolve(process.cwd(), 'src/components/cbt/AdminRewardChallengePanel.tsx'),
    'utf-8'
  );
  assert.ok(
    adminRewardSrc.includes('successfully transferred the reward') &&
      adminRewardSrc.includes("provided bank account?")
  );

  for (const rel of [
    'src/components/cbt/RewardChallengeDashboardCard.tsx',
    'src/components/cbt/RewardChallengeExamHall.tsx',
    'src/components/cbt/RewardChallengeHub.tsx',
    'src/components/cbt/AdminRewardChallengePanel.tsx',
  ]) {
    const src = await fs.readFile(path.resolve(process.cwd(), rel), 'utf-8');
    assert.equal(src.includes('window.alert'), false, `${rel} must not use window.alert`);
    assert.equal(src.includes('window.confirm'), false, `${rel} must not use window.confirm`);
    assert.equal(src.includes('window.open'), false, `${rel} must not use window.open`);
    assert.equal(src.includes('localStorage'), false, `${rel} must not use localStorage`);
    assert.equal(src.includes('sessionStorage'), false, `${rel} must not use sessionStorage`);
  }

  console.log('[Reward Challenge Verification] 4. Checking HTTP auth & admin role boundaries...');
  const app = await createApp({ skipVite: true });
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object');
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    for (const [method, endpoint] of [
      ['GET', '/api/reward-challenges/current'],
      ['GET', '/api/reward-challenges/history'],
      ['GET', '/api/admin/reward-challenges'],
      ['GET', '/api/admin/reward-challenges/payments/all'],
      ['POST', '/api/admin/reward-challenges'],
    ] as const) {
      const resp = await fetch(`${baseUrl}${endpoint}`, { method });
      assert.ok(
        resp.status === 401 || resp.status === 503,
        `Expected 401 or 503 for unauthenticated ${method} ${endpoint}, got ${resp.status}`
      );
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('[Reward Challenge Verification] PASSED.');
}

run().catch((err) => {
  console.error('[Reward Challenge Verification] FAILED:', err);
  process.exit(1);
});
