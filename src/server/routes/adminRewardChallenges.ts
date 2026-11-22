import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { getPool } from '../../db/index.js';
import { writeAuditLog } from '../lib/audit.js';
import {
  RewardChallengeError,
  broadcastNotificationToStudents,
  buildChallengeSummaryForUser,
  dispatchChallengeNotification,
  finalizeAndAnnounceChallengeWinner,
  formatWatDateTime,
  generateRewardChallengeQuestionsWithAi,
  getChallengeLeaderboard,
  markRewardPaymentPaid,
  parseBulkChallengeQuestionsFile,
  parseScheduleTimestampInput,
  resetChallengeResultsForRetest,
  syncChallengeAutomations,
} from '../lib/rewardChallenge.js';
import { handleApiError, requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('admin', 'super_admin'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

function handleRewardError(res: Parameters<typeof handleApiError>[0], err: unknown, context: string) {
  if (err instanceof RewardChallengeError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  handleApiError(res, err, context);
}

const createChallengeSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(1500).default(''),
  rewardAmount: z.number().min(0).default(10000),
  rewardCurrency: z.string().trim().min(2).max(10).default('NGN'),
  durationMinutes: z.number().int().min(1).max(360).default(20),
  questionCount: z.number().int().min(1).max(200).default(20),
  selectionMode: z.enum(['random', 'ordered']).default('random'),
  challengeOpenAt: z.string().optional(),
  examStartAt: z.string().optional(),
  examEndAt: z.string().optional(),
  winnerAnnouncementAt: z.string().optional(),
  challengeCloseAt: z.string().nullable().optional(),
  featureImmediately: z.boolean().default(true),
});

const settingsSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().max(1500).optional(),
  rewardAmount: z.number().min(0).optional(),
  rewardCurrency: z.string().trim().min(2).max(10).optional(),
  isFeatured: z.boolean().optional(),
  durationMinutes: z.number().int().min(1).max(360).optional(),
  questionCount: z.number().int().min(1).max(200).optional(),
  selectionMode: z.enum(['random', 'ordered']).optional(),
  challengeOpenAt: z.string().optional(),
  examStartAt: z.string().optional(),
  examEndAt: z.string().optional(),
  winnerAnnouncementAt: z.string().optional(),
  challengeCloseAt: z.string().nullable().optional(),
});

const questionSchema = z.object({
  questionText: z.string().trim().min(3),
  optionA: z.string().trim().min(1),
  optionB: z.string().trim().min(1),
  optionC: z.string().trim().min(1),
  optionD: z.string().trim().min(1),
  correctOption: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string().trim().default(''),
  subjectCategory: z.string().trim().min(1).max(100).default('General'),
  publicationStatus: z.enum(['draft', 'published']).default('published'),
  sortOrder: z.number().int().min(1).optional(),
});

const batchQuestionSaveSchema = z.object({
  questions: z.array(questionSchema).min(1).max(150),
  sourceType: z.enum(['manual', 'bulk_upload', 'ai_generated']).default('ai_generated'),
  publicationStatus: z.enum(['draft', 'published']).default('published'),
});

router.get('/', async (req, res) => {
  try {
    await syncChallengeAutomations();
    const pool = getPool();
    const rows = await pool.query<{ id: string }>(
      `SELECT id
       FROM reward_challenges
       ORDER BY is_active DESC, is_featured DESC, created_at DESC`
    );

    const challenges = [];
    for (const r of rows.rows) {
      const summary = await buildChallengeSummaryForUser({
        challengeId: r.id,
        userId: req.user!.id,
      });
      if (summary) challenges.push(summary);
    }

    res.json({ challenges });
  } catch (err) {
    handleRewardError(res, err, 'listing admin reward challenges');
  }
});

router.post('/', async (req, res) => {
  try {
    const parsed = createChallengeSchema.parse(req.body);
    const now = Date.now();
    const challengeOpenAt = parsed.challengeOpenAt
      ? parseScheduleTimestampInput(parsed.challengeOpenAt)
      : new Date(now + 5 * 60_000);
    const examStartAt = parsed.examStartAt
      ? parseScheduleTimestampInput(parsed.examStartAt)
      : new Date(now + 60 * 60_000);
    const examEndAt = parsed.examEndAt
      ? parseScheduleTimestampInput(parsed.examEndAt)
      : new Date(examStartAt.getTime() + 120 * 60_000);
    const winnerAnnouncementAt = parsed.winnerAnnouncementAt
      ? parseScheduleTimestampInput(parsed.winnerAnnouncementAt)
      : new Date(examEndAt.getTime() + 5 * 60_000);
    const challengeCloseAt = parsed.challengeCloseAt
      ? parseScheduleTimestampInput(parsed.challengeCloseAt)
      : null;

    if (examEndAt.getTime() <= examStartAt.getTime()) {
      res.status(400).json({ error: 'Examination closing time must be after Examination start time.' });
      return;
    }

    const pool = getPool();
    const client = await pool.connect();
    let newChallengeId = '';

    try {
      await client.query('BEGIN');

      if (parsed.featureImmediately) {
        await client.query(`UPDATE reward_challenges SET is_featured = FALSE WHERE is_featured = TRUE`);
      }

      const chRes = await client.query<{ id: string }>(
        `INSERT INTO reward_challenges (
           title, description, is_active, is_featured, lifecycle_status,
           reward_amount, reward_currency, created_by
         )
         VALUES ($1, $2, FALSE, $3, 'draft', $4, $5, $6)
         RETURNING id`,
        [
          parsed.title,
          parsed.description,
          parsed.featureImmediately,
          parsed.rewardAmount,
          parsed.rewardCurrency,
          req.user!.id,
        ]
      );
      newChallengeId = chRes.rows[0].id;

      await client.query(
        `INSERT INTO reward_challenge_settings (
           challenge_id, timezone, challenge_open_at, exam_start_at, exam_end_at,
           duration_minutes, question_count, selection_mode, winner_announcement_at,
           challenge_close_at
         )
         VALUES ($1, 'Africa/Lagos', $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          newChallengeId,
          challengeOpenAt,
          examStartAt,
          examEndAt,
          parsed.durationMinutes,
          parsed.questionCount,
          parsed.selectionMode,
          winnerAnnouncementAt,
          challengeCloseAt,
        ]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'reward_challenge_created',
      entityType: 'reward_challenge',
      entityId: newChallengeId,
      metadata: { title: parsed.title, rewardAmount: parsed.rewardAmount },
      ipAddress: req.ip,
    });

    const summary = await buildChallengeSummaryForUser({
      challengeId: newChallengeId,
      userId: req.user!.id,
    });
    res.status(201).json({ challenge: summary });
  } catch (err) {
    handleRewardError(res, err, 'creating reward challenge');
  }
});

router.get('/payments/all', async (_req, res) => {
  try {
    await syncChallengeAutomations();
    const pool = getPool();
    const rows = await pool.query<{
      id: string;
      challengeId: string;
      challengeTitle: string;
      winnerId: string;
      studentId: string;
      studentName: string;
      studentRegistrationCode: string | null;
      score: number;
      totalQuestions: number;
      position: number;
      bankName: string | null;
      accountNumber: string | null;
      accountName: string | null;
      bankSubmittedAt: Date | null;
      rewardAmount: number;
      currency: string;
      paymentStatus: string;
      paidByAdminName: string | null;
      paidByAdminEmail: string | null;
      paidAt: Date | null;
      paymentReference: string | null;
      adminNote: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `SELECT
         p.id,
         p.challenge_id AS "challengeId",
         c.title AS "challengeTitle",
         p.winner_id AS "winnerId",
         p.student_id AS "studentId",
         w.student_name AS "studentName",
         w.student_registration_code AS "studentRegistrationCode",
         w.score,
         w.total_questions AS "totalQuestions",
         w.position,
         b.bank_name AS "bankName",
         b.account_number AS "accountNumber",
         b.account_name AS "accountName",
         b.submitted_at AS "bankSubmittedAt",
         p.reward_amount::float8 AS "rewardAmount",
         p.currency,
         p.payment_status AS "paymentStatus",
         p.paid_by_admin_name AS "paidByAdminName",
         p.paid_by_admin_email AS "paidByAdminEmail",
         p.paid_at AS "paidAt",
         p.payment_reference AS "paymentReference",
         p.admin_note AS "adminNote",
         p.created_at AS "createdAt",
         p.updated_at AS "updatedAt"
       FROM reward_challenge_payments p
       INNER JOIN reward_challenges c ON c.id = p.challenge_id
       INNER JOIN reward_challenge_winners w ON w.id = p.winner_id
       LEFT JOIN reward_challenge_bank_details b ON b.id = p.bank_details_id
       ORDER BY p.created_at DESC`
    );

    res.json({
      payments: rows.rows.map((r) => ({
        ...r,
        bankSubmittedAt: r.bankSubmittedAt ? r.bankSubmittedAt.toISOString() : null,
        paidAt: r.paidAt ? r.paidAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    handleRewardError(res, err, 'loading all reward challenge payments');
  }
});

router.get('/:id/overview', async (req, res) => {
  try {
    const challenge = await buildChallengeSummaryForUser({
      challengeId: req.params.id,
      userId: req.user!.id,
    });
    if (!challenge) {
      res.status(404).json({ error: 'Reward challenge not found.' });
      return;
    }

    const pool = getPool();
    const [studentsCountRes, completedCountRes, paymentRes] = await Promise.all([
      pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM users WHERE role = 'student' AND is_active = TRUE`
      ),
      pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM reward_challenge_results WHERE challenge_id = $1`,
        [req.params.id]
      ),
      pool.query<{ paymentStatus: string }>(
        `SELECT payment_status AS "paymentStatus" FROM reward_challenge_payments WHERE challenge_id = $1 LIMIT 1`,
        [req.params.id]
      ),
    ]);

    const overview = {
      totalRegisteredStudents: studentsCountRes.rows[0]?.count ?? 0,
      totalParticipants: challenge.participantCount,
      totalSubmittedExaminations: challenge.submittedCount,
      totalCompletedExaminations: completedCountRes.rows[0]?.count ?? 0,
      currentStatus: challenge.displayStatus,
      lifecycleStatus: challenge.lifecycleStatus,
      scheduledExamStartAt: challenge.settings.examStartAt,
      scheduledExamEndAt: challenge.settings.examEndAt,
      uploadedQuestionsCount: challenge.uploadedQuestionCount,
      publishedQuestionsCount: challenge.publishedQuestionCount,
      winnerAnnouncementStatus: challenge.hasWinner
        ? `Winner Announced (${challenge.winner?.studentName})`
        : challenge.noValidParticipants
          ? 'Completed (No valid participants)'
          : challenge.settings.winnerAnnouncedAt
            ? 'Finalized'
            : 'Pending Schedule',
      rewardPaymentStatus: paymentRes.rows[0]?.paymentStatus ?? 'not_applicable',
    };

    res.json({ challenge, overview });
  } catch (err) {
    handleRewardError(res, err, 'loading admin reward challenge overview');
  }
});

router.patch('/:id/settings', async (req, res) => {
  try {
    const parsed = settingsSchema.parse(req.body);
    const pool = getPool();
    const existingRes = await pool.query<{ id: string }>(
      `SELECT id FROM reward_challenges WHERE id = $1 LIMIT 1`,
      [req.params.id]
    );
    if (existingRes.rows.length === 0) {
      res.status(404).json({ error: 'Reward challenge not found.' });
      return;
    }

    const currentSummary = await buildChallengeSummaryForUser({
      challengeId: req.params.id,
      userId: req.user!.id,
    });
    if (!currentSummary) {
      res.status(404).json({ error: 'Reward challenge not found.' });
      return;
    }

    const nextOpenAt = parsed.challengeOpenAt
      ? parseScheduleTimestampInput(parsed.challengeOpenAt)
      : new Date(currentSummary.settings.challengeOpenAt);
    const nextStartAt = parsed.examStartAt
      ? parseScheduleTimestampInput(parsed.examStartAt)
      : new Date(currentSummary.settings.examStartAt);
    const nextEndAt = parsed.examEndAt
      ? parseScheduleTimestampInput(parsed.examEndAt)
      : new Date(currentSummary.settings.examEndAt);
    const nextAnnounceAt = parsed.winnerAnnouncementAt
      ? parseScheduleTimestampInput(parsed.winnerAnnouncementAt)
      : new Date(currentSummary.settings.winnerAnnouncementAt);
    const nextCloseAt =
      parsed.challengeCloseAt === null
        ? null
        : parsed.challengeCloseAt !== undefined
          ? parseScheduleTimestampInput(parsed.challengeCloseAt)
          : currentSummary.settings.challengeCloseAt
            ? new Date(currentSummary.settings.challengeCloseAt)
            : null;

    if (nextOpenAt.getTime() > nextStartAt.getTime()) {
      res.status(400).json({ error: 'Challenge opening time must be on or before examination start time.' });
      return;
    }
    if (nextEndAt.getTime() <= nextStartAt.getTime()) {
      res.status(400).json({ error: 'Examination closing time must be after examination start time.' });
      return;
    }
    if (nextAnnounceAt.getTime() < nextEndAt.getTime()) {
      res.status(400).json({
        error: 'Winner announcement date/time must be at or after the examination closing time.',
      });
      return;
    }
    if (nextCloseAt && nextCloseAt.getTime() <= nextEndAt.getTime()) {
      res.status(400).json({
        error: 'Challenge closing date/time must be after the examination closing time.',
      });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (parsed.isFeatured) {
        await client.query(`UPDATE reward_challenges SET is_featured = FALSE WHERE id <> $1`, [
          req.params.id,
        ]);
      }

      const winnerCheck = await client.query<{ exists: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM reward_challenge_winners WHERE challenge_id = $1) AS exists`,
        [req.params.id]
      );
      const hasRecordedWinner = Boolean(winnerCheck.rows[0]?.exists);
      const nowMs = Date.now();
      const shouldResetStaleFinalization =
        !hasRecordedWinner &&
        (nextEndAt.getTime() > nowMs || nextAnnounceAt.getTime() > nowMs);

      await client.query(
        `UPDATE reward_challenges
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             reward_amount = COALESCE($3, reward_amount),
             reward_currency = COALESCE($4, reward_currency),
             is_featured = COALESCE($5, is_featured),
             lifecycle_status = CASE
               WHEN $7::boolean THEN
                 CASE
                   WHEN is_active THEN 'active'
                   WHEN lifecycle_status = 'closed' THEN 'draft'
                   ELSE lifecycle_status
                 END
               ELSE lifecycle_status
             END,
             closed_at = CASE WHEN $7::boolean THEN NULL ELSE closed_at END,
             updated_at = NOW()
         WHERE id = $6`,
        [
          parsed.title ?? null,
          parsed.description ?? null,
          parsed.rewardAmount ?? null,
          parsed.rewardCurrency ?? null,
          parsed.isFeatured ?? null,
          req.params.id,
          shouldResetStaleFinalization,
        ]
      );

      await client.query(
        `UPDATE reward_challenge_settings
         SET challenge_open_at = $1,
             exam_start_at = $2,
             exam_end_at = $3,
             winner_announcement_at = $4,
             challenge_close_at = $5,
             duration_minutes = COALESCE($6, duration_minutes),
             question_count = COALESCE($7, question_count),
             selection_mode = COALESCE($8, selection_mode),
             exam_finalized_at = CASE WHEN $10::boolean THEN NULL ELSE exam_finalized_at END,
             winner_announced_at = CASE WHEN $10::boolean THEN NULL ELSE winner_announced_at END,
             updated_at = NOW()
         WHERE challenge_id = $9`,
        [
          nextOpenAt,
          nextStartAt,
          nextEndAt,
          nextAnnounceAt,
          nextCloseAt,
          parsed.durationMinutes ?? null,
          parsed.questionCount ?? null,
          parsed.selectionMode ?? null,
          req.params.id,
          shouldResetStaleFinalization,
        ]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'reward_challenge_settings_updated',
      entityType: 'reward_challenge',
      entityId: req.params.id,
      metadata: {
        rewardAmount: parsed.rewardAmount,
        durationMinutes: parsed.durationMinutes,
        questionCount: parsed.questionCount,
      },
      ipAddress: req.ip,
    });

    const updated = await buildChallengeSummaryForUser({
      challengeId: req.params.id,
      userId: req.user!.id,
    });
    res.json({ challenge: updated, message: 'Challenge settings and schedule saved (Africa/Lagos WAT).' });
  } catch (err) {
    handleRewardError(res, err, 'updating reward challenge settings');
  }
});

router.post('/:id/activate', async (req, res) => {
  try {
    const summary = await buildChallengeSummaryForUser({
      challengeId: req.params.id,
      userId: req.user!.id,
    });
    if (!summary) {
      res.status(404).json({ error: 'Reward challenge not found.' });
      return;
    }

    if (summary.publishedQuestionCount === 0) {
      res.status(400).json({
        error:
          'Publish at least 1 question in the Challenge Question Bank before activating this competition.',
        code: 'NO_PUBLISHED_QUESTIONS',
      });
      return;
    }

    const pool = getPool();
    const winnerCheck = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM reward_challenge_winners WHERE challenge_id = $1) AS exists`,
      [req.params.id]
    );
    const hasRecordedWinner = Boolean(winnerCheck.rows[0]?.exists);
    const hasFutureWindow =
      new Date(summary.settings.examEndAt).getTime() > Date.now() ||
      new Date(summary.settings.winnerAnnouncementAt).getTime() > Date.now();

    await pool.query(`UPDATE reward_challenges SET is_featured = FALSE WHERE id <> $1`, [req.params.id]);
    await pool.query(
      `UPDATE reward_challenges
       SET is_active = TRUE,
           is_featured = TRUE,
           lifecycle_status = 'active',
           activated_at = COALESCE(activated_at, NOW()),
           closed_at = CASE WHEN $2::boolean THEN NULL ELSE closed_at END,
           updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, !hasRecordedWinner && hasFutureWindow]
    );

    if (!hasRecordedWinner && hasFutureWindow) {
      await pool.query(
        `UPDATE reward_challenge_settings
         SET exam_finalized_at = NULL,
             winner_announced_at = NULL,
             updated_at = NOW()
         WHERE challenge_id = $1`,
        [req.params.id]
      );
    }

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'reward_challenge_activated',
      entityType: 'reward_challenge',
      entityId: req.params.id,
      ipAddress: req.ip,
    });

    await broadcastNotificationToStudents({
      challengeId: req.params.id,
      eventType: 'challenge_activated',
      title: `Acadet Reward CBT Challenge Activated: ${summary.title}`,
      message: `${summary.title} is now activated! Grand Prize: ₦${Math.round(summary.rewardAmount).toLocaleString('en-NG')}. Exam begins ${formatWatDateTime(summary.settings.examStartAt)} (${summary.settings.questionCount} questions · ${summary.settings.durationMinutes} mins).`,
      actionLabel: 'Open Reward Challenge',
    });

    const updated = await buildChallengeSummaryForUser({
      challengeId: req.params.id,
      userId: req.user!.id,
    });
    res.json({ challenge: updated, message: 'Challenge activated and published to student dashboards.' });
  } catch (err) {
    handleRewardError(res, err, 'activating reward challenge');
  }
});

router.post('/:id/deactivate', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query(
      `UPDATE reward_challenges
       SET is_active = FALSE,
           lifecycle_status = 'deactivated',
           deactivated_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'reward_challenge_deactivated',
      entityType: 'reward_challenge',
      entityId: req.params.id,
      ipAddress: req.ip,
    });

    const updated = await buildChallengeSummaryForUser({
      challengeId: req.params.id,
      userId: req.user!.id,
    });
    res.json({
      challenge: updated,
      message: 'Challenge deactivated. Students now see it as Closed / Unavailable.',
    });
  } catch (err) {
    handleRewardError(res, err, 'deactivating reward challenge');
  }
});

router.post('/:id/sync', async (req, res) => {
  try {
    await syncChallengeAutomations(req.params.id);
    const updated = await buildChallengeSummaryForUser({
      challengeId: req.params.id,
      userId: req.user!.id,
    });
    res.json({ challenge: updated, message: 'Challenge schedule & automation state synchronized.' });
  } catch (err) {
    handleRewardError(res, err, 'syncing reward challenge');
  }
});

router.post('/:id/reset-results', async (req, res) => {
  try {
    const outcome = await resetChallengeResultsForRetest(req.params.id);
    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'reward_challenge_results_reset',
      entityType: 'reward_challenge',
      entityId: req.params.id,
      metadata: outcome,
      ipAddress: req.ip,
    });
    const updated = await buildChallengeSummaryForUser({
      challengeId: req.params.id,
      userId: req.user!.id,
    });
    res.json({
      challenge: updated,
      ...outcome,
      message: `Cleared ${outcome.deletedAttempts} attempt(s) and ${outcome.clearedWinners} winner record(s). The competition is ready to run on its schedule.`,
    });
  } catch (err) {
    handleRewardError(res, err, 'resetting reward challenge results');
  }
});

router.get('/:id/questions', async (req, res) => {
  try {
    const pool = getPool();
    const rows = await pool.query<{
      id: string;
      challengeId: string;
      sortOrder: number;
      questionText: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctOption: 'A' | 'B' | 'C' | 'D';
      explanation: string;
      subjectCategory: string;
      publicationStatus: 'draft' | 'published';
      sourceType: 'manual' | 'bulk_upload' | 'ai_generated';
      createdAt: Date;
    }>(
      `SELECT
         id,
         challenge_id AS "challengeId",
         sort_order AS "sortOrder",
         question_text AS "questionText",
         option_a AS "optionA",
         option_b AS "optionB",
         option_c AS "optionC",
         option_d AS "optionD",
         correct_option AS "correctOption",
         explanation,
         subject_category AS "subjectCategory",
         publication_status AS "publicationStatus",
         source_type AS "sourceType",
         created_at AS "createdAt"
       FROM reward_challenge_questions
       WHERE challenge_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [req.params.id]
    );

    res.json({
      questions: rows.rows.map((q) => ({
        ...q,
        createdAt: q.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    handleRewardError(res, err, 'listing reward challenge questions');
  }
});

router.post('/:id/questions', async (req, res) => {
  try {
    const parsed = questionSchema.parse(req.body);
    const pool = getPool();

    const maxOrderRes = await pool.query<{ maxOrder: number }>(
      `SELECT COALESCE(MAX(sort_order), 0)::int AS "maxOrder" FROM reward_challenge_questions WHERE challenge_id = $1`,
      [req.params.id]
    );
    const nextSortOrder = parsed.sortOrder ?? (maxOrderRes.rows[0]?.maxOrder ?? 0) + 1;

    const inserted = await pool.query<{
      id: string;
      challengeId: string;
      sortOrder: number;
      questionText: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctOption: 'A' | 'B' | 'C' | 'D';
      explanation: string;
      subjectCategory: string;
      publicationStatus: 'draft' | 'published';
      sourceType: 'manual' | 'bulk_upload' | 'ai_generated';
      createdAt: Date;
    }>(
      `INSERT INTO reward_challenge_questions (
         challenge_id, sort_order, question_text, option_a, option_b, option_c, option_d,
         correct_option, explanation, subject_category, publication_status, source_type, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'manual', $12)
       RETURNING
         id, challenge_id AS "challengeId", sort_order AS "sortOrder",
         question_text AS "questionText", option_a AS "optionA", option_b AS "optionB",
         option_c AS "optionC", option_d AS "optionD", correct_option AS "correctOption",
         explanation, subject_category AS "subjectCategory",
         publication_status AS "publicationStatus", source_type AS "sourceType",
         created_at AS "createdAt"`,
      [
        req.params.id,
        nextSortOrder,
        parsed.questionText,
        parsed.optionA,
        parsed.optionB,
        parsed.optionC,
        parsed.optionD,
        parsed.correctOption,
        parsed.explanation,
        parsed.subjectCategory,
        parsed.publicationStatus,
        req.user!.id,
      ]
    );

    const q = inserted.rows[0];
    res.status(201).json({ question: { ...q, createdAt: q.createdAt.toISOString() } });
  } catch (err) {
    handleRewardError(res, err, 'creating reward challenge question');
  }
});

router.patch('/:id/questions/:questionId', async (req, res) => {
  try {
    const parsed = questionSchema.partial().parse(req.body);
    const pool = getPool();

    const updated = await pool.query<{
      id: string;
      challengeId: string;
      sortOrder: number;
      questionText: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctOption: 'A' | 'B' | 'C' | 'D';
      explanation: string;
      subjectCategory: string;
      publicationStatus: 'draft' | 'published';
      sourceType: 'manual' | 'bulk_upload' | 'ai_generated';
      createdAt: Date;
    }>(
      `UPDATE reward_challenge_questions
       SET question_text = COALESCE($1, question_text),
           option_a = COALESCE($2, option_a),
           option_b = COALESCE($3, option_b),
           option_c = COALESCE($4, option_c),
           option_d = COALESCE($5, option_d),
           correct_option = COALESCE($6, correct_option),
           explanation = COALESCE($7, explanation),
           subject_category = COALESCE($8, subject_category),
           publication_status = COALESCE($9, publication_status),
           sort_order = COALESCE($10, sort_order),
           updated_at = NOW()
       WHERE id = $11 AND challenge_id = $12
       RETURNING
         id, challenge_id AS "challengeId", sort_order AS "sortOrder",
         question_text AS "questionText", option_a AS "optionA", option_b AS "optionB",
         option_c AS "optionC", option_d AS "optionD", correct_option AS "correctOption",
         explanation, subject_category AS "subjectCategory",
         publication_status AS "publicationStatus", source_type AS "sourceType",
         created_at AS "createdAt"`,
      [
        parsed.questionText ?? null,
        parsed.optionA ?? null,
        parsed.optionB ?? null,
        parsed.optionC ?? null,
        parsed.optionD ?? null,
        parsed.correctOption ?? null,
        parsed.explanation ?? null,
        parsed.subjectCategory ?? null,
        parsed.publicationStatus ?? null,
        parsed.sortOrder ?? null,
        req.params.questionId,
        req.params.id,
      ]
    );

    if (!updated.rows[0]) {
      res.status(404).json({ error: 'Challenge question not found.' });
      return;
    }

    const q = updated.rows[0];
    res.json({ question: { ...q, createdAt: q.createdAt.toISOString() } });
  } catch (err) {
    handleRewardError(res, err, 'updating reward challenge question');
  }
});

router.delete('/:id/questions/:questionId', async (req, res) => {
  try {
    const pool = getPool();
    const deleted = await pool.query<{ id: string }>(
      `DELETE FROM reward_challenge_questions WHERE id = $1 AND challenge_id = $2 RETURNING id`,
      [req.params.questionId, req.params.id]
    );
    if (!deleted.rows[0]) {
      res.status(404).json({ error: 'Challenge question not found.' });
      return;
    }
    res.json({ deletedId: deleted.rows[0].id });
  } catch (err) {
    handleRewardError(res, err, 'deleting reward challenge question');
  }
});

router.post('/:id/questions/publish-batch', async (req, res) => {
  try {
    const schema = z.object({
      questionIds: z.array(z.string()).optional(),
      publishAllDrafts: z.boolean().optional(),
    });
    const parsed = schema.parse(req.body ?? {});
    const pool = getPool();

    const updatedRes = parsed.publishAllDrafts
      ? await pool.query<{ id: string }>(
          `UPDATE reward_challenge_questions
           SET publication_status = 'published', updated_at = NOW()
           WHERE challenge_id = $1 AND publication_status = 'draft'
           RETURNING id`,
          [req.params.id]
        )
      : await pool.query<{ id: string }>(
          `UPDATE reward_challenge_questions
           SET publication_status = 'published', updated_at = NOW()
           WHERE challenge_id = $1 AND id = ANY($2::uuid[])
           RETURNING id`,
          [req.params.id, parsed.questionIds || []]
        );

    res.json({
      publishedCount: updatedRes.rows.length,
      publishedIds: updatedRes.rows.map((r) => r.id),
      message: `${updatedRes.rows.length} challenge question(s) published.`,
    });
  } catch (err) {
    handleRewardError(res, err, 'publishing challenge questions');
  }
});

router.post('/:id/questions/bulk-upload', upload.single('file') as unknown as RequestHandler, async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Select a PDF, DOCX, TXT, CSV, or JSON file to upload.' });
      return;
    }

    const publicationStatus =
      req.body?.publicationStatus === 'draft' ? 'draft' : 'published';
    const parsedItems = await parseBulkChallengeQuestionsFile({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalname: req.file.originalname,
    });

    const pool = getPool();
    const maxOrderRes = await pool.query<{ maxOrder: number }>(
      `SELECT COALESCE(MAX(sort_order), 0)::int AS "maxOrder" FROM reward_challenge_questions WHERE challenge_id = $1`,
      [req.params.id]
    );
    let sortCursor = (maxOrderRes.rows[0]?.maxOrder ?? 0) + 1;

    const savedQuestions = [];
    for (const item of parsedItems) {
      const ins = await pool.query<{
        id: string;
        challengeId: string;
        sortOrder: number;
        questionText: string;
        optionA: string;
        optionB: string;
        optionC: string;
        optionD: string;
        correctOption: 'A' | 'B' | 'C' | 'D';
        explanation: string;
        subjectCategory: string;
        publicationStatus: 'draft' | 'published';
        sourceType: 'manual' | 'bulk_upload' | 'ai_generated';
        createdAt: Date;
      }>(
        `INSERT INTO reward_challenge_questions (
           challenge_id, sort_order, question_text, option_a, option_b, option_c, option_d,
           correct_option, explanation, subject_category, publication_status, source_type, created_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'bulk_upload', $12)
         RETURNING
           id, challenge_id AS "challengeId", sort_order AS "sortOrder",
           question_text AS "questionText", option_a AS "optionA", option_b AS "optionB",
           option_c AS "optionC", option_d AS "optionD", correct_option AS "correctOption",
           explanation, subject_category AS "subjectCategory",
           publication_status AS "publicationStatus", source_type AS "sourceType",
           created_at AS "createdAt"`,
        [
          req.params.id,
          sortCursor,
          item.questionText,
          item.optionA,
          item.optionB,
          item.optionC,
          item.optionD,
          item.correctOption,
          item.explanation,
          item.subjectCategory,
          publicationStatus,
          req.user!.id,
        ]
      );
      sortCursor += 1;
      savedQuestions.push({
        ...ins.rows[0],
        createdAt: ins.rows[0].createdAt.toISOString(),
      });
    }

    res.status(201).json({
      count: savedQuestions.length,
      questions: savedQuestions,
      message: `Successfully imported ${savedQuestions.length} question(s) from ${req.file.originalname}.`,
    });
  } catch (err) {
    handleRewardError(res, err, 'bulk uploading challenge questions');
  }
});

router.post('/:id/questions/ai-generate', upload.single('document') as unknown as RequestHandler, async (req, res) => {
  try {
    const pool = getPool();
    const chRes = await pool.query<{ title: string }>(
      `SELECT title FROM reward_challenges WHERE id = $1 LIMIT 1`,
      [req.params.id]
    );
    const ch = chRes.rows[0];
    if (!ch) {
      res.status(404).json({ error: 'Reward challenge not found.' });
      return;
    }

    const countRaw = Number(req.body?.count ?? 10);
    const count = Number.isFinite(countRaw) ? Math.max(1, Math.min(60, Math.floor(countRaw))) : 10;
    const subjectCategory = String(req.body?.subjectCategory || 'General').trim() || 'General';
    const instructions = String(req.body?.instructions || '').trim();

    const drafts = await generateRewardChallengeQuestionsWithAi({
      challengeTitle: ch.title,
      count,
      subjectCategory,
      instructions,
      documentFile: req.file
        ? {
            buffer: req.file.buffer,
            mimeType: req.file.mimetype,
            originalname: req.file.originalname,
          }
        : null,
    });

    res.json({
      drafts,
      count: drafts.length,
      message: `Generated ${drafts.length} competition question draft(s). Review and save them into the Challenge Question Bank.`,
    });
  } catch (err) {
    handleRewardError(res, err, 'generating AI reward challenge questions');
  }
});

router.post('/:id/questions/ai-save-batch', async (req, res) => {
  try {
    const parsed = batchQuestionSaveSchema.parse(req.body);
    const pool = getPool();
    const maxOrderRes = await pool.query<{ maxOrder: number }>(
      `SELECT COALESCE(MAX(sort_order), 0)::int AS "maxOrder" FROM reward_challenge_questions WHERE challenge_id = $1`,
      [req.params.id]
    );
    let sortCursor = (maxOrderRes.rows[0]?.maxOrder ?? 0) + 1;

    const saved = [];
    for (const q of parsed.questions) {
      const ins = await pool.query<{
        id: string;
        challengeId: string;
        sortOrder: number;
        questionText: string;
        optionA: string;
        optionB: string;
        optionC: string;
        optionD: string;
        correctOption: 'A' | 'B' | 'C' | 'D';
        explanation: string;
        subjectCategory: string;
        publicationStatus: 'draft' | 'published';
        sourceType: 'manual' | 'bulk_upload' | 'ai_generated';
        createdAt: Date;
      }>(
        `INSERT INTO reward_challenge_questions (
           challenge_id, sort_order, question_text, option_a, option_b, option_c, option_d,
           correct_option, explanation, subject_category, publication_status, source_type, created_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING
           id, challenge_id AS "challengeId", sort_order AS "sortOrder",
           question_text AS "questionText", option_a AS "optionA", option_b AS "optionB",
           option_c AS "optionC", option_d AS "optionD", correct_option AS "correctOption",
           explanation, subject_category AS "subjectCategory",
           publication_status AS "publicationStatus", source_type AS "sourceType",
           created_at AS "createdAt"`,
        [
          req.params.id,
          sortCursor,
          q.questionText,
          q.optionA,
          q.optionB,
          q.optionC,
          q.optionD,
          q.correctOption,
          q.explanation,
          q.subjectCategory,
          q.publicationStatus ?? parsed.publicationStatus,
          parsed.sourceType,
          req.user!.id,
        ]
      );
      sortCursor += 1;
      saved.push({
        ...ins.rows[0],
        createdAt: ins.rows[0].createdAt.toISOString(),
      });
    }

    res.status(201).json({
      count: saved.length,
      questions: saved,
      message: `Saved ${saved.length} question(s) into Challenge Question Bank.`,
    });
  } catch (err) {
    handleRewardError(res, err, 'saving AI challenge question batch');
  }
});

router.get('/:id/participants', async (req, res) => {
  try {
    await syncChallengeAutomations(req.params.id);
    const pool = getPool();
    const rows = await pool.query<{
      participantId: string;
      studentId: string;
      fullName: string;
      email: string;
      registrationCode: string | null;
      status: 'joined' | 'in_progress' | 'completed';
      joinedAt: Date;
      attemptStatus: string | null;
      startedAt: Date | null;
      submittedAt: Date | null;
      completionTimeSeconds: number | null;
      score: number | null;
      totalQuestions: number | null;
      percentage: number | null;
    }>(
      `SELECT
         p.id AS "participantId",
         p.student_id AS "studentId",
         u.full_name AS "fullName",
         u.email,
         u.registration_code AS "registrationCode",
         p.status,
         p.joined_at AS "joinedAt",
         a.status AS "attemptStatus",
         a.started_at AS "startedAt",
         r.submitted_at AS "submittedAt",
         r.completion_time_seconds AS "completionTimeSeconds",
         r.score,
         r.total_questions AS "totalQuestions",
         r.percentage
       FROM reward_challenge_participants p
       INNER JOIN users u ON u.id = p.student_id
       LEFT JOIN reward_challenge_attempts a ON a.challenge_id = p.challenge_id AND a.student_id = p.student_id
       LEFT JOIN reward_challenge_results r ON r.attempt_id = a.id
       WHERE p.challenge_id = $1
       ORDER BY COALESCE(r.score, -1) DESC, COALESCE(r.completion_time_seconds, 999999) ASC, p.joined_at ASC`,
      [req.params.id]
    );

    res.json({
      participants: rows.rows.map((row) => ({
        ...row,
        attemptStatus: row.attemptStatus ?? 'not_started',
        joinedAt: row.joinedAt.toISOString(),
        startedAt: row.startedAt ? row.startedAt.toISOString() : null,
        submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
      })),
    });
  } catch (err) {
    handleRewardError(res, err, 'loading reward challenge participants');
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
    handleRewardError(res, err, 'loading admin reward challenge leaderboard');
  }
});

router.post('/:id/winner/announce', async (req, res) => {
  try {
    const schema = z.object({
      forceEndOpenAttempts: z.boolean().optional().default(false),
    });
    const parsed = schema.parse(req.body ?? {});

    const outcome = await finalizeAndAnnounceChallengeWinner({
      challengeId: req.params.id,
      mode: 'admin',
      forceEndOpenAttempts: parsed.forceEndOpenAttempts,
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'reward_challenge_winner_announced',
      entityType: 'reward_challenge',
      entityId: req.params.id,
      metadata: {
        finalizedNow: outcome.finalizedNow,
        winnerStudentId: outcome.winner?.studentId ?? null,
      },
      ipAddress: req.ip,
    });

    const summary = await buildChallengeSummaryForUser({
      challengeId: req.params.id,
      userId: req.user!.id,
    });

    res.json({
      challenge: summary,
      finalizedNow: outcome.finalizedNow,
      winner: outcome.winner,
      message: outcome.winner
        ? `Official winner ${outcome.winner.studentName} (${outcome.winner.score}/${outcome.winner.totalQuestions}) announced and all participants notified.`
        : 'Challenge finalized with zero valid submissions.',
    });
  } catch (err) {
    handleRewardError(res, err, 'finalizing and announcing reward challenge winner');
  }
});

router.get('/:id/winner-payment', async (req, res) => {
  try {
    const summary = await buildChallengeSummaryForUser({
      challengeId: req.params.id,
      userId: req.user!.id,
    });
    if (!summary) {
      res.status(404).json({ error: 'Reward challenge not found.' });
      return;
    }

    const pool = getPool();
    const resPay = await pool.query<{
      id: string;
      challengeId: string;
      winnerId: string;
      studentId: string;
      studentName: string;
      studentEmail: string;
      studentRegistrationCode: string | null;
      score: number;
      totalQuestions: number;
      percentage: number;
      completionTimeSeconds: number;
      bankName: string | null;
      accountNumber: string | null;
      accountName: string | null;
      correctionNote: string | null;
      bankSubmittedAt: Date | null;
      rewardAmount: number;
      currency: string;
      paymentStatus: 'payment_pending' | 'payment_processing' | 'payment_completed';
      paidByAdminName: string | null;
      paidByAdminEmail: string | null;
      paidAt: Date | null;
      paymentReference: string | null;
      adminNote: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `SELECT
         p.id,
         p.challenge_id AS "challengeId",
         p.winner_id AS "winnerId",
         p.student_id AS "studentId",
         w.student_name AS "studentName",
         u.email AS "studentEmail",
         w.student_registration_code AS "studentRegistrationCode",
         w.score,
         w.total_questions AS "totalQuestions",
         w.percentage,
         w.completion_time_seconds AS "completionTimeSeconds",
         b.bank_name AS "bankName",
         b.account_number AS "accountNumber",
         b.account_name AS "accountName",
         b.correction_note AS "correctionNote",
         b.submitted_at AS "bankSubmittedAt",
         p.reward_amount::float8 AS "rewardAmount",
         p.currency,
         p.payment_status AS "paymentStatus",
         p.paid_by_admin_name AS "paidByAdminName",
         p.paid_by_admin_email AS "paidByAdminEmail",
         p.paid_at AS "paidAt",
         p.payment_reference AS "paymentReference",
         p.admin_note AS "adminNote",
         p.created_at AS "createdAt",
         p.updated_at AS "updatedAt"
       FROM reward_challenge_payments p
       INNER JOIN reward_challenge_winners w ON w.id = p.winner_id
       INNER JOIN users u ON u.id = p.student_id
       LEFT JOIN reward_challenge_bank_details b ON b.id = p.bank_details_id
       WHERE p.challenge_id = $1
       LIMIT 1`,
      [req.params.id]
    );

    const record = resPay.rows[0]
      ? {
          ...resPay.rows[0],
          bankSubmittedAt: resPay.rows[0].bankSubmittedAt
            ? resPay.rows[0].bankSubmittedAt.toISOString()
            : null,
          paidAt: resPay.rows[0].paidAt ? resPay.rows[0].paidAt.toISOString() : null,
          createdAt: resPay.rows[0].createdAt.toISOString(),
          updatedAt: resPay.rows[0].updatedAt.toISOString(),
        }
      : null;

    res.json({
      challenge: summary,
      winnerPayment: record,
    });
  } catch (err) {
    handleRewardError(res, err, 'loading winner payment record');
  }
});

router.patch('/:id/payment/status', async (req, res) => {
  try {
    const schema = z.object({
      paymentStatus: z.enum(['payment_pending', 'payment_processing']),
      paymentReference: z.string().trim().max(120).optional(),
      adminNote: z.string().trim().max(500).optional(),
    });
    const parsed = schema.parse(req.body);
    const pool = getPool();

    const currentRes = await pool.query<{
      id: string;
      paymentStatus: string;
      studentId: string;
      challengeTitle: string;
    }>(
      `SELECT p.id, p.payment_status AS "paymentStatus", p.student_id AS "studentId", c.title AS "challengeTitle"
       FROM reward_challenge_payments p
       INNER JOIN reward_challenges c ON c.id = p.challenge_id
       WHERE p.challenge_id = $1
       LIMIT 1`,
      [req.params.id]
    );
    const current = currentRes.rows[0];
    if (!current) {
      res.status(404).json({ error: 'Winner payment record not found.' });
      return;
    }
    if (current.paymentStatus === 'payment_completed') {
      res.status(409).json({ error: 'Completed reward payment status cannot be reverted.' });
      return;
    }

    await pool.query(
      `UPDATE reward_challenge_payments
       SET payment_status = $1,
           payment_reference = COALESCE($2, payment_reference),
           admin_note = COALESCE($3, admin_note),
           updated_at = NOW()
       WHERE id = $4`,
      [
        parsed.paymentStatus,
        parsed.paymentReference ?? null,
        parsed.adminNote ?? null,
        current.id,
      ]
    );

    if (parsed.paymentStatus === 'payment_processing') {
      await dispatchChallengeNotification({
        challengeId: req.params.id,
        studentId: current.studentId,
        eventType: 'reward_payment_processing',
        title: `${current.challengeTitle}: Reward Payout Processing`,
        message: `Your reward payout for ${current.challengeTitle} is currently being processed by Acadet CBT administration.`,
        idempotencyKey: `reward_processing:${req.params.id}:${current.studentId}`,
      });
    }

    res.json({
      paymentStatus: parsed.paymentStatus,
      message: `Reward payment status updated to ${parsed.paymentStatus === 'payment_processing' ? 'PAYMENT PROCESSING' : 'PAYMENT PENDING'}.`,
    });
  } catch (err) {
    handleRewardError(res, err, 'updating reward payment status');
  }
});

router.post('/:id/payment/mark-paid', async (req, res) => {
  try {
    const schema = z.object({
      confirmedTransfer: z.literal(true),
      paymentReference: z.string().trim().max(120).optional(),
      adminNote: z.string().trim().max(500).optional(),
    });
    const parsed = schema.parse(req.body);

    const payment = await markRewardPaymentPaid({
      challengeId: req.params.id,
      adminUser: {
        id: req.user!.id,
        fullName: req.user!.fullName,
        email: req.user!.email,
      },
      confirmedTransfer: parsed.confirmedTransfer,
      paymentReference: parsed.paymentReference,
      adminNote: parsed.adminNote,
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'reward_challenge_payment_marked_paid',
      entityType: 'reward_challenge_payment',
      entityId: payment.id,
      metadata: {
        challengeId: req.params.id,
        paymentReference: payment.paymentReference,
      },
      ipAddress: req.ip,
    });

    res.json({
      payment,
      message:
        'Reward payment marked as PAYMENT COMPLETED and winner has been notified.',
    });
  } catch (err) {
    handleRewardError(res, err, 'marking reward payment as paid');
  }
});

export default router;
