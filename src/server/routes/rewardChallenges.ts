import { Router } from 'express';
import { z } from 'zod';
import { getPool } from '../../db/index.js';
import {
  RewardChallengeError,
  buildChallengeSummaryForUser,
  getChallengeAttemptState,
  getChallengeLeaderboard,
  saveChallengeAnswer,
  startOrResumeChallengeAttempt,
  submitChallengeAttempt,
  submitWinnerBankDetails,
  syncChallengeAutomations,
} from '../lib/rewardChallenge.js';
import { handleApiError, requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const answerSchema = z.object({
  questionOrder: z.number().int().min(1),
  selectedOption: z.enum(['A', 'B', 'C', 'D']).nullable().optional(),
  isMarkedForReview: z.boolean().optional(),
});

const submitSchema = z.object({
  submissionSource: z.enum(['manual', 'auto_timer']).default('manual'),
  answers: z
    .array(
      z.object({
        questionOrder: z.number().int().min(1),
        selectedOption: z.enum(['A', 'B', 'C', 'D']).nullable(),
        isMarkedForReview: z.boolean().optional(),
      })
    )
    .optional(),
});

const bankDetailsSchema = z.object({
  bankName: z.string().trim().min(2).max(120),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, 'Account number must be exactly 10 digits.'),
  accountName: z.string().trim().min(3).max(140),
  correctionNote: z.string().trim().max(300).optional(),
});

function handleRewardError(res: Parameters<typeof handleApiError>[0], err: unknown, context: string) {
  if (err instanceof RewardChallengeError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  handleApiError(res, err, context);
}

router.get('/current', async (req, res) => {
  try {
    const challenge = await buildChallengeSummaryForUser({
      userId: req.user!.id,
    });
    res.json({ challenge });
  } catch (err) {
    handleRewardError(res, err, 'loading current reward challenge');
  }
});

router.get('/history', async (req, res) => {
  try {
    await syncChallengeAutomations();
    const pool = getPool();
    const idsRes = await pool.query<{ id: string }>(
      `SELECT id
       FROM reward_challenges
       WHERE lifecycle_status IN ('active', 'closed') OR is_active = TRUE
       ORDER BY is_active DESC, is_featured DESC, created_at DESC`
    );

    const challenges = [];
    for (const row of idsRes.rows) {
      const summary = await buildChallengeSummaryForUser({
        challengeId: row.id,
        userId: req.user!.id,
      });
      if (summary) challenges.push(summary);
    }

    res.json({ challenges });
  } catch (err) {
    handleRewardError(res, err, 'loading reward challenge history');
  }
});

router.get('/my/history', async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user!.id;

    const attemptsRes = await pool.query<{
      challengeId: string;
      challengeTitle: string;
      rewardAmount: number;
      rewardCurrency: string;
      attemptId: string;
      status: string;
      submittedAt: Date | null;
      score: number | null;
      totalQuestions: number;
      percentage: number | null;
      completionTimeSeconds: number | null;
      position: number | null;
      isWinner: boolean;
      paymentStatus: string | null;
      paidAt: Date | null;
      paymentReference: string | null;
    }>(
      `SELECT
         c.id AS "challengeId",
         c.title AS "challengeTitle",
         c.reward_amount::float8 AS "rewardAmount",
         c.reward_currency AS "rewardCurrency",
         a.id AS "attemptId",
         a.status,
         a.submitted_at AS "submittedAt",
         r.score,
         a.total_questions AS "totalQuestions",
         r.percentage,
         r.completion_time_seconds AS "completionTimeSeconds",
         lb.position,
         (w.student_id = $1) AS "isWinner",
         p.payment_status AS "paymentStatus",
         p.paid_at AS "paidAt",
         p.payment_reference AS "paymentReference"
       FROM reward_challenge_attempts a
       INNER JOIN reward_challenges c ON c.id = a.challenge_id
       LEFT JOIN reward_challenge_results r ON r.attempt_id = a.id
       LEFT JOIN reward_challenge_leaderboards lb ON lb.challenge_id = c.id AND lb.student_id = $1
       LEFT JOIN reward_challenge_winners w ON w.challenge_id = c.id
       LEFT JOIN reward_challenge_payments p ON p.challenge_id = c.id AND p.student_id = $1
       WHERE a.student_id = $1
       ORDER BY a.started_at DESC`,
      [userId]
    );

    res.json({
      history: attemptsRes.rows.map((row) => ({
        ...row,
        isWinner: Boolean(row.isWinner),
        submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
        paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      })),
    });
  } catch (err) {
    handleRewardError(res, err, 'loading student reward challenge history');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const challenge = await buildChallengeSummaryForUser({
      challengeId: req.params.id,
      userId: req.user!.id,
    });
    if (!challenge) {
      res.status(404).json({ error: 'Reward challenge not found.' });
      return;
    }
    res.json({ challenge });
  } catch (err) {
    handleRewardError(res, err, 'loading reward challenge details');
  }
});

router.post('/:id/join', async (req, res) => {
  try {
    const summary = await buildChallengeSummaryForUser({
      challengeId: req.params.id,
      userId: req.user!.id,
    });
    if (!summary) {
      res.status(404).json({ error: 'Reward challenge not found.' });
      return;
    }
    if (!summary.isActive || summary.displayStatus === 'Challenge Closed') {
      res.status(403).json({
        error: summary.unavailableReason || 'This challenge is currently closed or unavailable.',
        code: 'CHALLENGE_CLOSED',
      });
      return;
    }
    if (!summary.canJoinWaitingRoom) {
      res.status(403).json({
        error: summary.unavailableReason || 'Registration for this challenge is not open.',
        code: 'WAITING_ROOM_CLOSED',
      });
      return;
    }

    const pool = getPool();
    await pool.query(
      `INSERT INTO reward_challenge_participants (challenge_id, student_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT (challenge_id, student_id) DO NOTHING`,
      [req.params.id, req.user!.id]
    );

    const updated = await buildChallengeSummaryForUser({
      challengeId: req.params.id,
      userId: req.user!.id,
    });
    res.json({ challenge: updated });
  } catch (err) {
    handleRewardError(res, err, 'joining reward challenge');
  }
});

router.post('/:id/start', async (req, res) => {
  try {
    const payload = await startOrResumeChallengeAttempt({
      challengeId: req.params.id,
      studentId: req.user!.id,
    });
    res.status(201).json(payload);
  } catch (err) {
    handleRewardError(res, err, 'starting reward challenge examination');
  }
});

router.get('/:id/attempt', async (req, res) => {
  try {
    const payload = await getChallengeAttemptState({
      challengeId: req.params.id,
      studentId: req.user!.id,
    });
    res.json(payload);
  } catch (err) {
    handleRewardError(res, err, 'loading reward challenge attempt');
  }
});

router.patch('/:id/attempt/answer', async (req, res) => {
  try {
    const parsed = answerSchema.parse(req.body);
    const result = await saveChallengeAnswer({
      challengeId: req.params.id,
      studentId: req.user!.id,
      questionOrder: parsed.questionOrder,
      selectedOption: parsed.selectedOption,
      isMarkedForReview: parsed.isMarkedForReview,
    });
    res.json(result);
  } catch (err) {
    handleRewardError(res, err, 'saving reward challenge answer');
  }
});

router.post('/:id/attempt/submit', async (req, res) => {
  try {
    const parsed = submitSchema.parse(req.body ?? {});
    const normalizedAnswers = parsed.answers?.map((item) => ({
      questionOrder: item.questionOrder,
      selectedOption: item.selectedOption ?? null,
      isMarkedForReview: item.isMarkedForReview,
    }));
    const payload = await submitChallengeAttempt({
      challengeId: req.params.id,
      studentId: req.user!.id,
      submissionSource: parsed.submissionSource,
      answers: normalizedAnswers,
    });
    res.json({
      ...payload,
      confirmationMessage: 'Your examination has been successfully submitted.',
    });
  } catch (err) {
    handleRewardError(res, err, 'submitting reward challenge examination');
  }
});

router.get('/:id/leaderboard', async (req, res) => {
  try {
    const leaderboard = await getChallengeLeaderboard({
      challengeId: req.params.id,
      viewerUserId: req.user!.id,
    });
    res.json(leaderboard);
  } catch (err) {
    handleRewardError(res, err, 'loading reward challenge leaderboard');
  }
});

router.get('/:id/winner', async (req, res) => {
  try {
    const summary = await buildChallengeSummaryForUser({
      challengeId: req.params.id,
      userId: req.user!.id,
    });
    if (!summary) {
      res.status(404).json({ error: 'Reward challenge not found.' });
      return;
    }
    res.json({
      challengeId: summary.id,
      challengeTitle: summary.title,
      displayStatus: summary.displayStatus,
      hasWinner: summary.hasWinner,
      noValidParticipants: summary.noValidParticipants,
      winner: summary.winner,
      isCurrentUserWinner: summary.myParticipation.isWinner,
      myBankDetails: summary.myParticipation.myBankDetails,
      myPayment: summary.myParticipation.myPayment,
    });
  } catch (err) {
    handleRewardError(res, err, 'loading reward challenge winner');
  }
});

router.post('/:id/winner/bank-details', async (req, res) => {
  try {
    const parsed = bankDetailsSchema.parse(req.body);
    const bankDetails = await submitWinnerBankDetails({
      challengeId: req.params.id,
      studentId: req.user!.id,
      bankName: parsed.bankName,
      accountNumber: parsed.accountNumber,
      accountName: parsed.accountName,
      correctionNote: parsed.correctionNote,
    });
    res.json({
      bankDetails,
      message: 'Your bank details have been securely submitted for reward payout verification.',
    });
  } catch (err) {
    handleRewardError(res, err, 'submitting winner bank details');
  }
});

export default router;
