import crypto from 'node:crypto';
import path from 'node:path';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { getDb, getPool } from '../../db/index.js';
import {
  announcements,
  auditLogs,
  brandingAssetBinaries,
  courses,
  examSessions,
  founderProfile,
  paymentBackups,
  payments,
  questions,
  siteBranding,
  studyMaterials,
  users,
} from '../../db/schema.js';
import {
  AiGenerationError,
  generateCbtQuestionsWithAi,
  normalizeDifficultyForDb,
  regenerateSingleQuestionWithAi,
} from '../lib/aiQuestionGenerator.js';
import {
  getAiSettingsSummary,
  saveGeminiApiSettings,
  testGeminiConnection,
} from '../lib/aiSettings.js';
import { writeAuditLog } from '../lib/audit.js';
import {
  getPublicBrandingAndFounder,
  resolveBaseUrl,
  sanitizePublicUrl,
  sanitizeSocialLinks,
} from '../lib/branding.js';
import {
  getAdminEmailStatusOverview,
  sendAdminTestEmail,
  verifyEmailServiceConnection,
} from '../lib/email.js';
import {
  activateGst111Manual,
  deactivateGst111Manual,
  getStudentGst111History,
  Gst111RestrictionError,
  listGst111StudentStatuses,
} from '../lib/gst111.js';
import { sanitizeUser } from '../lib/jwt.js';
import {
  createStudentNotification,
  normalizeWhatsappGroupLink,
} from '../lib/notifications.js';
import {
  buildMaterialObjectKey,
  deleteObjectKey,
  isObjectStorageConfigured,
  ObjectStorageNotConfiguredError,
  uploadObjectBuffer,
} from '../lib/objectStorage.js';
import {
  PaymentValidationError,
  resolveAdminVerificationLog,
  verifyAndSettleStudentReference,
} from '../lib/paymentSettlement.js';
import {
  PaystackGatewayError,
  PaystackNotConfiguredError,
  PaystackReferenceNotFoundError,
  verifyPaystackTransaction,
} from '../lib/paystack.js';
import {
  COURSE_VALUE_NAIRA,
  deriveDefaultCourseValueNaira,
  FEE_ABSORBER_LABEL,
  STANDARD_CURRENCY,
  TOTAL_STUDENT_PAYABLE_NAIRA,
} from '../lib/pricing.js';
import {
  attachImagesToQuestion,
  cleanupS3ObjectsForQuestion,
  deleteQuestionImage,
  getQuestionImagesMap,
  MAX_QUESTION_IMAGE_BYTES,
  QuestionImageValidationError,
} from '../lib/questionImages.js';
import {
  CBT_RECOMMENDED_MIN_QUESTIONS,
  getCourseCbtReadiness,
} from '../lib/questionStats.js';
import {
  handleApiError,
  requireAuth,
  requireRole,
} from '../middleware/auth.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const questionImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_QUESTION_IMAGE_BYTES, files: 8 },
});

const questionAiSourceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 12 },
});

const optionalMultipartImages: RequestHandler = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    (questionImageUpload.array('images', 8) as unknown as RequestHandler)(req, res, next);
    return;
  }
  next();
};

const optionalMultipartAiSources: RequestHandler = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    (
      questionAiSourceUpload.fields([
        { name: 'document', maxCount: 1 },
        { name: 'images', maxCount: 10 },
      ]) as unknown as RequestHandler
    )(req, res, next);
    return;
  }
  next();
};

router.use(requireAuth, requireRole('admin', 'super_admin'));

const whatsappGroupLinkSchema = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .refine(
    (val) => {
      if (!val || val.trim() === '') return true;
      return normalizeWhatsappGroupLink(val) !== null;
    },
    { message: 'WhatsApp group link must be a valid URL starting with https:// or http://' }
  );

const courseCreateSchema = z.object({
  code: z.string().trim().min(2).max(30),
  title: z.string().trim().min(2).max(160),
  level: z.string().trim().min(2).max(40).default('100 Level'),
  description: z.string().trim().max(1000).default(''),
  registrationFee: z.coerce
    .number()
    .min(100, 'Minimum course registration price is ₦100')
    .max(1_000_000, 'Maximum course registration price is ₦1,000,000')
    .default(TOTAL_STUDENT_PAYABLE_NAIRA),
  courseValue: z.coerce
    .number()
    .min(0, 'Net course value cannot be negative')
    .max(1_000_000, 'Maximum course value is ₦1,000,000')
    .optional(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toUpperCase())
    .default(STANDARD_CURRENCY),
  publicationStatus: z.enum(['draft', 'published', 'archived']).default('published'),
  examCategory: z.string().trim().min(2).max(120).default('Acadet CBT Examination'),
  defaultDurationMinutes: z.coerce.number().int().min(5).max(240).default(60),
  whatsappGroupLink: whatsappGroupLinkSchema,
});

const courseUpdateSchema = courseCreateSchema.partial();

const coerceBooleanField = z.preprocess((val) => {
  if (typeof val === 'string') {
    const trimmed = val.trim().toLowerCase();
    if (trimmed === 'true' || trimmed === '1') return true;
    if (trimmed === 'false' || trimmed === '0') return false;
  }
  return val;
}, z.boolean());

const questionSchema = z.object({
  courseId: z.string().uuid('Valid courseId is required'),
  questionText: z.string().trim().min(5).max(3000),
  optionA: z.string().trim().min(1).max(1000),
  optionB: z.string().trim().min(1).max(1000),
  optionC: z.string().trim().min(1).max(1000),
  optionD: z.string().trim().min(1).max(1000),
  correctOption: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string().trim().max(2000).default(''),
  difficulty: z
    .enum(['Easy', 'Medium', 'Hard', 'Difficult'])
    .default('Medium')
    .transform((v) => normalizeDifficultyForDb(v)),
  topic: z.string().trim().min(1).max(120).default('General'),
  examYear: z.coerce.number().int().min(1980).max(2100).nullable().optional(),
  isActive: coerceBooleanField.default(true),
  publicationStatus: z.enum(['draft', 'published']).default('published'),
});

const announcementSchema = z.object({
  title: z.string().trim().min(2).max(180),
  body: z.string().trim().min(5).max(3000),
  isPinned: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(['student', 'admin', 'super_admin']).optional(),
  examTarget: z.string().trim().min(2).max(120).optional(),
});

router.get('/overview', async (_req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query<{
      totalUsers: number;
      totalCourses: number;
      totalQuestions: number;
      totalActiveQuestions: number;
      totalEasyQuestions: number;
      totalMediumQuestions: number;
      totalHardQuestions: number;
      totalUncategorizedQuestions: number;
      totalInactiveQuestions: number;
      coursesReadyForCbt: number;
      totalMaterials: number;
      totalSubmittedExams: number;
      totalActiveRegistrations: number;
      totalSuccessfulPayments: number;
      totalRevenueNaira: string;
      totalCourseValueNaira: string;
      totalPaystackFeesNaira: string;
      totalNetSettlementNaira: string;
      totalReconciledPayments: number;
      totalShortfallPayments: number;
    }>(
      `
      SELECT
        (SELECT COUNT(*)::int FROM users) AS "totalUsers",
        (SELECT COUNT(*)::int FROM courses) AS "totalCourses",
        (SELECT COUNT(*)::int FROM questions) AS "totalQuestions",
        (SELECT COUNT(*)::int FROM questions WHERE is_active = TRUE AND COALESCE(publication_status, 'published') = 'published') AS "totalActiveQuestions",
        (SELECT COUNT(*)::int FROM questions WHERE is_active = TRUE AND COALESCE(publication_status, 'published') = 'published' AND LOWER(TRIM(COALESCE(difficulty, ''))) = 'easy') AS "totalEasyQuestions",
        (SELECT COUNT(*)::int FROM questions WHERE is_active = TRUE AND COALESCE(publication_status, 'published') = 'published' AND LOWER(TRIM(COALESCE(difficulty, ''))) = 'medium') AS "totalMediumQuestions",
        (SELECT COUNT(*)::int FROM questions WHERE is_active = TRUE AND COALESCE(publication_status, 'published') = 'published' AND LOWER(TRIM(COALESCE(difficulty, ''))) IN ('hard', 'difficult')) AS "totalHardQuestions",
        (SELECT COUNT(*)::int FROM questions WHERE is_active = TRUE AND COALESCE(publication_status, 'published') = 'published' AND LOWER(TRIM(COALESCE(difficulty, ''))) NOT IN ('easy', 'medium', 'hard', 'difficult')) AS "totalUncategorizedQuestions",
        (SELECT COUNT(*)::int FROM questions WHERE is_active = FALSE OR COALESCE(publication_status, 'published') = 'draft') AS "totalInactiveQuestions",
        (
          SELECT COUNT(*)::int FROM courses c
          WHERE (
            SELECT COUNT(*) FROM questions q
            WHERE (q.course_id = c.id OR (q.course_id IS NULL AND c.subject_id IS NOT NULL AND q.subject_id = c.subject_id))
              AND q.is_active = TRUE
              AND COALESCE(q.publication_status, 'published') = 'published'
          ) >= $1
        ) AS "coursesReadyForCbt",
        (SELECT COUNT(*)::int FROM study_materials) AS "totalMaterials",
        (SELECT COUNT(*)::int FROM exam_sessions WHERE status = 'submitted') AS "totalSubmittedExams",
        (SELECT COUNT(*)::int FROM course_registrations WHERE registration_status = 'active') AS "totalActiveRegistrations",
        (SELECT COUNT(*)::int FROM payments WHERE payment_status = 'successful') AS "totalSuccessfulPayments",
        (SELECT COALESCE(SUM(total_amount_charged), 0)::text FROM payments WHERE payment_status = 'successful') AS "totalRevenueNaira",
        (SELECT COALESCE(SUM(course_value), 0)::text FROM payments WHERE payment_status = 'successful') AS "totalCourseValueNaira",
        (SELECT COALESCE(SUM(gateway_fee), 0)::text FROM payments WHERE payment_status = 'successful') AS "totalPaystackFeesNaira",
        (SELECT COALESCE(SUM(net_settlement_amount), 0)::text FROM payments WHERE payment_status = 'successful') AS "totalNetSettlementNaira",
        (SELECT COUNT(*)::int FROM payments WHERE payment_status = 'successful' AND reconciliation_status = 'reconciled') AS "totalReconciledPayments",
        (SELECT COUNT(*)::int FROM payments WHERE payment_status = 'successful' AND reconciliation_status = 'shortfall') AS "totalShortfallPayments"
    `,
      [CBT_RECOMMENDED_MIN_QUESTIONS]
    );

    const row = result.rows[0];
    res.json({
      overview: {
        totalUsers: row?.totalUsers ?? 0,
        totalCourses: row?.totalCourses ?? 0,
        totalQuestions: row?.totalQuestions ?? 0,
        totalActiveQuestions: row?.totalActiveQuestions ?? 0,
        totalEasyQuestions: row?.totalEasyQuestions ?? 0,
        totalMediumQuestions: row?.totalMediumQuestions ?? 0,
        totalHardQuestions: row?.totalHardQuestions ?? 0,
        totalUncategorizedQuestions: row?.totalUncategorizedQuestions ?? 0,
        totalInactiveQuestions: row?.totalInactiveQuestions ?? 0,
        coursesReadyForCbt: row?.coursesReadyForCbt ?? 0,
        totalMaterials: row?.totalMaterials ?? 0,
        totalSubmittedExams: row?.totalSubmittedExams ?? 0,
        totalActiveRegistrations: row?.totalActiveRegistrations ?? 0,
        totalSuccessfulPayments: row?.totalSuccessfulPayments ?? 0,
        totalRevenueNaira: Number(row?.totalRevenueNaira ?? 0),
        totalCourseValueNaira: Number(row?.totalCourseValueNaira ?? 0),
        totalPaystackFeesNaira: Number(row?.totalPaystackFeesNaira ?? 0),
        totalNetSettlementNaira: Number(row?.totalNetSettlementNaira ?? 0),
        totalReconciledPayments: row?.totalReconciledPayments ?? 0,
        totalShortfallPayments: row?.totalShortfallPayments ?? 0,
      },
    });
  } catch (err) {
    handleApiError(res, err, 'fetching admin overview');
  }
});

// Courses CRUD + Registrations, Question Difficulty & Revenue Rollup
router.get('/courses', async (_req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query<{
      id: string;
      subjectId: string | null;
      code: string;
      title: string;
      level: string;
      description: string;
      courseValue: string;
      registrationFee: string;
      currency: string;
      publicationStatus: 'draft' | 'published' | 'archived';
      examCategory: string;
      defaultDurationMinutes: number;
      whatsappGroupLink: string | null;
      isActive: boolean;
      createdAt: Date;
      questionCount: number;
      easyCount: number;
      mediumCount: number;
      hardCount: number;
      uncategorizedCount: number;
      inactiveCount: number;
      totalRegistrations: number;
      totalRevenue: string;
    }>(`
      SELECT
        c.id,
        c.subject_id AS "subjectId",
        c.code,
        c.title,
        c.level,
        c.description,
        c.course_value::text AS "courseValue",
        c.registration_fee::text AS "registrationFee",
        c.currency,
        c.publication_status AS "publicationStatus",
        c.exam_category AS "examCategory",
        c.default_duration_minutes AS "defaultDurationMinutes",
        c.whatsapp_group_link AS "whatsappGroupLink",
        c.is_active AS "isActive",
        c.created_at AS "createdAt",
        COALESCE(qs."questionCount", 0)::int AS "questionCount",
        COALESCE(qs."easyCount", 0)::int AS "easyCount",
        COALESCE(qs."mediumCount", 0)::int AS "mediumCount",
        COALESCE(qs."hardCount", 0)::int AS "hardCount",
        COALESCE(qs."uncategorizedCount", 0)::int AS "uncategorizedCount",
        COALESCE(qs."inactiveCount", 0)::int AS "inactiveCount",
        (
          SELECT COUNT(*)::int FROM course_registrations cr
          WHERE cr.course_id = c.id AND cr.registration_status = 'active'
        ) AS "totalRegistrations",
        (
          SELECT COALESCE(SUM(p.total_amount_charged), 0)::text FROM payments p
          WHERE p.course_id = c.id AND p.payment_status = 'successful'
        ) AS "totalRevenue"
      FROM courses c
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE q.is_active = TRUE AND COALESCE(q.publication_status, 'published') = 'published')::int AS "questionCount",
          COUNT(*) FILTER (WHERE q.is_active = TRUE AND COALESCE(q.publication_status, 'published') = 'published' AND LOWER(TRIM(COALESCE(q.difficulty, ''))) = 'easy')::int AS "easyCount",
          COUNT(*) FILTER (WHERE q.is_active = TRUE AND COALESCE(q.publication_status, 'published') = 'published' AND LOWER(TRIM(COALESCE(q.difficulty, ''))) = 'medium')::int AS "mediumCount",
          COUNT(*) FILTER (WHERE q.is_active = TRUE AND COALESCE(q.publication_status, 'published') = 'published' AND LOWER(TRIM(COALESCE(q.difficulty, ''))) IN ('hard', 'difficult'))::int AS "hardCount",
          COUNT(*) FILTER (WHERE q.is_active = TRUE AND COALESCE(q.publication_status, 'published') = 'published' AND LOWER(TRIM(COALESCE(q.difficulty, ''))) NOT IN ('easy', 'medium', 'hard', 'difficult'))::int AS "uncategorizedCount",
          COUNT(*) FILTER (WHERE q.is_active = FALSE OR COALESCE(q.publication_status, 'published') = 'draft')::int AS "inactiveCount"
        FROM questions q
        WHERE q.course_id = c.id
          OR (q.course_id IS NULL AND c.subject_id IS NOT NULL AND q.subject_id = c.subject_id)
      ) qs ON TRUE
      ORDER BY c.code ASC
    `);

    res.json({
      courses: result.rows.map((r) => ({
        ...r,
        courseValue: Number(r.courseValue ?? COURSE_VALUE_NAIRA),
        registrationFee: Number(r.registrationFee ?? TOTAL_STUDENT_PAYABLE_NAIRA),
        currency: r.currency || STANDARD_CURRENCY,
        cbtReady: r.questionCount >= CBT_RECOMMENDED_MIN_QUESTIONS,
        totalRevenue: Number(r.totalRevenue),
      })),
    });
  } catch (err) {
    handleApiError(res, err, 'listing admin courses');
  }
});

router.post('/courses', async (req, res) => {
  try {
    const parsed = courseCreateSchema.parse(req.body);
    const db = getDb();

    const normalizedCode = parsed.code.toUpperCase();
    const existing = await db
      .select({ id: courses.id })
      .from(courses)
      .where(sql`LOWER(${courses.code}) = ${normalizedCode.toLowerCase()}`)
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({
        error: `Course code "${normalizedCode}" already exists.`,
      });
      return;
    }

    const feeNaira = Number(parsed.registrationFee.toFixed(2));
    const valueNaira =
      parsed.courseValue !== undefined
        ? Number(parsed.courseValue.toFixed(2))
        : deriveDefaultCourseValueNaira(feeNaira);

    if (valueNaira > feeNaira) {
      res.status(400).json({
        error: 'Net course value cannot exceed the student registration price.',
      });
      return;
    }

    const [created] = await db
      .insert(courses)
      .values({
        code: normalizedCode,
        title: parsed.title,
        level: parsed.level,
        description: parsed.description,
        courseValue: valueNaira.toFixed(2),
        registrationFee: feeNaira.toFixed(2),
        currency: parsed.currency,
        publicationStatus: parsed.publicationStatus,
        examCategory: parsed.examCategory,
        defaultDurationMinutes: parsed.defaultDurationMinutes,
        whatsappGroupLink: normalizeWhatsappGroupLink(parsed.whatsappGroupLink),
        isActive: parsed.publicationStatus === 'published',
      })
      .returning();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.course.create',
      entityType: 'course',
      entityId: created.id,
      metadata: {
        code: created.code,
        title: created.title,
        courseValue: created.courseValue,
        registrationFee: created.registrationFee,
        feeAbsorbedBy: FEE_ABSORBER_LABEL,
        publicationStatus: created.publicationStatus,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      course: {
        ...created,
        courseValue: Number(created.courseValue),
        registrationFee: Number(created.registrationFee),
        questionCount: 0,
        easyCount: 0,
        mediumCount: 0,
        hardCount: 0,
        uncategorizedCount: 0,
        inactiveCount: 0,
        cbtReady: false,
        totalRegistrations: 0,
        totalRevenue: 0,
      },
    });
  } catch (err) {
    handleApiError(res, err, 'creating course');
  }
});

router.patch('/courses/:id', async (req, res) => {
  try {
    const parsed = courseUpdateSchema.parse(req.body);
    const db = getDb();

    const [existingCourse] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, req.params.id))
      .limit(1);

    if (!existingCourse) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }

    const currentFeeNaira = Number(existingCourse.registrationFee ?? TOTAL_STUDENT_PAYABLE_NAIRA);
    const currentValueNaira = Number(existingCourse.courseValue ?? COURSE_VALUE_NAIRA);

    const nextFeeNaira =
      parsed.registrationFee !== undefined
        ? Number(parsed.registrationFee.toFixed(2))
        : currentFeeNaira;

    let nextValueNaira: number;
    if (parsed.courseValue !== undefined) {
      nextValueNaira = Number(parsed.courseValue.toFixed(2));
    } else if (parsed.registrationFee !== undefined) {
      nextValueNaira = deriveDefaultCourseValueNaira(nextFeeNaira);
    } else {
      nextValueNaira = currentValueNaira;
    }

    if (nextValueNaira > nextFeeNaira) {
      res.status(400).json({
        error: 'Net course value cannot exceed the student registration price.',
      });
      return;
    }

    const updateValues: Record<string, unknown> = {
      courseValue: nextValueNaira.toFixed(2),
      registrationFee: nextFeeNaira.toFixed(2),
      currency: parsed.currency ?? existingCourse.currency ?? STANDARD_CURRENCY,
      updatedAt: new Date(),
    };
    if (parsed.code !== undefined) updateValues.code = parsed.code.toUpperCase();
    if (parsed.title !== undefined) updateValues.title = parsed.title;
    if (parsed.level !== undefined) updateValues.level = parsed.level;
    if (parsed.description !== undefined) updateValues.description = parsed.description;
    if (parsed.publicationStatus !== undefined) {
      updateValues.publicationStatus = parsed.publicationStatus;
      updateValues.isActive = parsed.publicationStatus === 'published';
    }
    if (parsed.examCategory !== undefined) updateValues.examCategory = parsed.examCategory;
    if (parsed.defaultDurationMinutes !== undefined) {
      updateValues.defaultDurationMinutes = parsed.defaultDurationMinutes;
    }
    if (parsed.whatsappGroupLink !== undefined) {
      updateValues.whatsappGroupLink = normalizeWhatsappGroupLink(parsed.whatsappGroupLink);
    }

    const [updated] = await db
      .update(courses)
      .set(updateValues)
      .where(eq(courses.id, req.params.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.course.update',
      entityType: 'course',
      entityId: updated.id,
      metadata: {
        ...parsed,
        previousRegistrationFee: existingCourse.registrationFee,
        newRegistrationFee: updated.registrationFee,
        previousCourseValue: existingCourse.courseValue,
        newCourseValue: updated.courseValue,
      },
      ipAddress: req.ip,
    });

    res.json({
      course: {
        ...updated,
        courseValue: Number(updated.courseValue),
        registrationFee: Number(updated.registrationFee),
      },
    });
  } catch (err) {
    handleApiError(res, err, 'updating course');
  }
});

router.delete('/courses/:id', async (req, res) => {
  try {
    const pool = getPool();
    const courseId = req.params.id;

    // Safe delete check: do not delete if payments, registrations, or exam sessions depend on it
    const depRes = await pool.query<{
      payCount: number;
      regCount: number;
      sessCount: number;
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM payments WHERE course_id = $1) AS "payCount",
         (SELECT COUNT(*)::int FROM course_registrations WHERE course_id = $1) AS "regCount",
         (SELECT COUNT(*)::int FROM exam_sessions WHERE course_id = $1) AS "sessCount"`,
      [courseId]
    );
    const deps = depRes.rows[0];
    if (deps && (deps.payCount > 0 || deps.regCount > 0 || deps.sessCount > 0)) {
      res.status(409).json({
        error:
          'Cannot delete a course that has existing payment records, registrations, or exam attempts. Unpublish or archive it instead.',
      });
      return;
    }

    const db = getDb();
    const [deleted] = await db
      .delete(courses)
      .where(eq(courses.id, courseId))
      .returning({ id: courses.id, code: courses.code });

    if (!deleted) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.course.delete',
      entityType: 'course',
      entityId: deleted.id,
      metadata: { code: deleted.code },
      ipAddress: req.ip,
    });

    res.json({ deletedId: deleted.id });
  } catch (err) {
    handleApiError(res, err, 'deleting course');
  }
});

// Real-time PostgreSQL Question Statistics Dashboard endpoint
router.get('/questions/stats', async (_req, res) => {
  try {
    const pool = getPool();

    const perCourseResult = await pool.query<{
      courseId: string;
      code: string;
      title: string;
      level: string;
      examCategory: string;
      publicationStatus: 'draft' | 'published' | 'archived';
      defaultDurationMinutes: number;
      questionCount: number;
      easyCount: number;
      mediumCount: number;
      hardCount: number;
      uncategorizedCount: number;
      inactiveCount: number;
      lastQuestionUpdatedAt: Date | null;
    }>(`
      SELECT
        c.id AS "courseId",
        c.code,
        c.title,
        c.level,
        c.exam_category AS "examCategory",
        c.publication_status AS "publicationStatus",
        c.default_duration_minutes AS "defaultDurationMinutes",
        COALESCE(qs."questionCount", 0)::int AS "questionCount",
        COALESCE(qs."easyCount", 0)::int AS "easyCount",
        COALESCE(qs."mediumCount", 0)::int AS "mediumCount",
        COALESCE(qs."hardCount", 0)::int AS "hardCount",
        COALESCE(qs."uncategorizedCount", 0)::int AS "uncategorizedCount",
        COALESCE(qs."inactiveCount", 0)::int AS "inactiveCount",
        qs."lastQuestionUpdatedAt" AS "lastQuestionUpdatedAt"
      FROM courses c
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE q.is_active = TRUE AND COALESCE(q.publication_status, 'published') = 'published')::int AS "questionCount",
          COUNT(*) FILTER (WHERE q.is_active = TRUE AND COALESCE(q.publication_status, 'published') = 'published' AND LOWER(TRIM(COALESCE(q.difficulty, ''))) = 'easy')::int AS "easyCount",
          COUNT(*) FILTER (WHERE q.is_active = TRUE AND COALESCE(q.publication_status, 'published') = 'published' AND LOWER(TRIM(COALESCE(q.difficulty, ''))) = 'medium')::int AS "mediumCount",
          COUNT(*) FILTER (WHERE q.is_active = TRUE AND COALESCE(q.publication_status, 'published') = 'published' AND LOWER(TRIM(COALESCE(q.difficulty, ''))) IN ('hard', 'difficult'))::int AS "hardCount",
          COUNT(*) FILTER (WHERE q.is_active = TRUE AND COALESCE(q.publication_status, 'published') = 'published' AND LOWER(TRIM(COALESCE(q.difficulty, ''))) NOT IN ('easy', 'medium', 'hard', 'difficult'))::int AS "uncategorizedCount",
          COUNT(*) FILTER (WHERE q.is_active = FALSE OR COALESCE(q.publication_status, 'published') = 'draft')::int AS "inactiveCount",
          MAX(q.updated_at) AS "lastQuestionUpdatedAt"
        FROM questions q
        WHERE q.course_id = c.id
          OR (q.course_id IS NULL AND c.subject_id IS NOT NULL AND q.subject_id = c.subject_id)
      ) qs ON TRUE
      ORDER BY c.level ASC, c.code ASC
    `);

    const summaryResult = await pool.query<{
      totalActiveQuestions: number;
      totalInactiveQuestions: number;
      easyCount: number;
      mediumCount: number;
      hardCount: number;
      uncategorizedCount: number;
      unassignedActiveQuestions: number;
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE q.is_active = TRUE AND COALESCE(q.publication_status, 'published') = 'published')::int AS "totalActiveQuestions",
        COUNT(*) FILTER (WHERE q.is_active = FALSE OR COALESCE(q.publication_status, 'published') = 'draft')::int AS "totalInactiveQuestions",
        COUNT(*) FILTER (WHERE q.is_active = TRUE AND COALESCE(q.publication_status, 'published') = 'published' AND LOWER(TRIM(COALESCE(q.difficulty, ''))) = 'easy')::int AS "easyCount",
        COUNT(*) FILTER (WHERE q.is_active = TRUE AND COALESCE(q.publication_status, 'published') = 'published' AND LOWER(TRIM(COALESCE(q.difficulty, ''))) = 'medium')::int AS "mediumCount",
        COUNT(*) FILTER (WHERE q.is_active = TRUE AND COALESCE(q.publication_status, 'published') = 'published' AND LOWER(TRIM(COALESCE(q.difficulty, ''))) IN ('hard', 'difficult'))::int AS "hardCount",
        COUNT(*) FILTER (WHERE q.is_active = TRUE AND COALESCE(q.publication_status, 'published') = 'published' AND LOWER(TRIM(COALESCE(q.difficulty, ''))) NOT IN ('easy', 'medium', 'hard', 'difficult'))::int AS "uncategorizedCount",
        COUNT(*) FILTER (
          WHERE q.is_active = TRUE
            AND COALESCE(q.publication_status, 'published') = 'published'
            AND NOT EXISTS (
              SELECT 1 FROM courses c
              WHERE q.course_id = c.id
                OR (q.course_id IS NULL AND c.subject_id IS NOT NULL AND q.subject_id = c.subject_id)
            )
        )::int AS "unassignedActiveQuestions"
      FROM questions q
    `);

    const courseRows = perCourseResult.rows.map((row) => {
      const readiness = getCourseCbtReadiness(row.questionCount);
      return {
        ...row,
        cbtReady: readiness.ready,
        readinessStatus: readiness.status,
        readinessLabel: readiness.label,
        lastQuestionUpdatedAt: row.lastQuestionUpdatedAt
          ? row.lastQuestionUpdatedAt.toISOString()
          : null,
      };
    });

    const sumRow = summaryResult.rows[0];
    res.json({
      summary: {
        totalCourses: courseRows.length,
        publishedCourses: courseRows.filter((c) => c.publicationStatus === 'published').length,
        cbtReadyCourses: courseRows.filter((c) => c.cbtReady).length,
        cbtMinRecommended: CBT_RECOMMENDED_MIN_QUESTIONS,
        totalActiveQuestions: sumRow?.totalActiveQuestions ?? 0,
        totalInactiveQuestions: sumRow?.totalInactiveQuestions ?? 0,
        easyCount: sumRow?.easyCount ?? 0,
        mediumCount: sumRow?.mediumCount ?? 0,
        hardCount: sumRow?.hardCount ?? 0,
        uncategorizedCount: sumRow?.uncategorizedCount ?? 0,
        unassignedActiveQuestions: sumRow?.unassignedActiveQuestions ?? 0,
      },
      courses: courseRows,
    });
  } catch (err) {
    handleApiError(res, err, 'fetching question statistics');
  }
});

// Questions CRUD + Drafts/Publishing + Multi-Image Attachments
router.get('/questions', async (req, res) => {
  try {
    const pool = getPool();
    const courseId =
      typeof req.query.courseId === 'string' && req.query.courseId.trim()
        ? req.query.courseId.trim()
        : null;
    const rawDiff =
      typeof req.query.difficulty === 'string' ? req.query.difficulty.trim() : '';
    const difficultyFilter =
      rawDiff && ['Easy', 'Medium', 'Hard', 'Difficult'].includes(rawDiff)
        ? normalizeDifficultyForDb(rawDiff)
        : null;
    const searchFilter =
      typeof req.query.search === 'string' && req.query.search.trim()
        ? `%${req.query.search.trim()}%`
        : null;
    const statusFilter =
      typeof req.query.status === 'string' &&
      ['active', 'inactive', 'all'].includes(req.query.status.trim())
        ? req.query.status.trim()
        : 'all';
    const publicationFilter =
      typeof req.query.publicationStatus === 'string' &&
      ['draft', 'published', 'all'].includes(req.query.publicationStatus.trim())
        ? req.query.publicationStatus.trim()
        : 'all';
    const aiBatchId =
      typeof req.query.aiBatchId === 'string' &&
      z.string().uuid().safeParse(req.query.aiBatchId.trim()).success
        ? req.query.aiBatchId.trim()
        : null;

    const rawLimit = Number(req.query.limit);
    const limitVal =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), 1000)
        : courseId
          ? 500
          : 300;

    const whereParts: string[] = [];
    const params: unknown[] = [];

    if (courseId) {
      params.push(courseId);
      const pIdx = params.length;
      whereParts.push(`(
        q.course_id = $${pIdx}
        OR (
          q.course_id IS NULL
          AND EXISTS (
            SELECT 1 FROM courses ct
            WHERE ct.id = $${pIdx} AND ct.subject_id IS NOT NULL AND q.subject_id = ct.subject_id
          )
        )
      )`);
    }

    if (difficultyFilter) {
      if (difficultyFilter === 'Hard') {
        whereParts.push(`LOWER(TRIM(COALESCE(q.difficulty, ''))) IN ('hard', 'difficult')`);
      } else {
        params.push(difficultyFilter.toLowerCase());
        whereParts.push(`LOWER(TRIM(COALESCE(q.difficulty, ''))) = $${params.length}`);
      }
    }

    if (statusFilter === 'active') {
      whereParts.push('q.is_active = TRUE');
    } else if (statusFilter === 'inactive') {
      whereParts.push('q.is_active = FALSE');
    }

    if (publicationFilter === 'draft') {
      whereParts.push(`COALESCE(q.publication_status, 'published') = 'draft'`);
    } else if (publicationFilter === 'published') {
      whereParts.push(`COALESCE(q.publication_status, 'published') = 'published'`);
    }

    if (aiBatchId) {
      params.push(aiBatchId);
      whereParts.push(`q.ai_batch_id = $${params.length}`);
    }

    if (searchFilter) {
      params.push(searchFilter);
      const sIdx = params.length;
      whereParts.push(
        `(q.question_text ILIKE $${sIdx} OR q.topic ILIKE $${sIdx} OR COALESCE(c.code, '') ILIKE $${sIdx})`
      );
    }

    params.push(limitVal);
    const limitIdx = params.length;
    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const result = await pool.query<{
      id: string;
      courseId: string | null;
      courseCode: string | null;
      courseTitle: string | null;
      questionText: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctOption: 'A' | 'B' | 'C' | 'D';
      explanation: string;
      difficulty: 'Easy' | 'Medium' | 'Hard';
      topic: string;
      examYear: number | null;
      isActive: boolean;
      publicationStatus: 'draft' | 'published';
      aiGenerated: boolean;
      aiRequiresImage: boolean;
      aiImageNote: string | null;
      aiBatchId: string | null;
      createdAt: Date;
    }>(
      `
      SELECT
        q.id,
        COALESCE(q.course_id, c_legacy.id) AS "courseId",
        COALESCE(c.code, c_legacy.code, 'COURSE') AS "courseCode",
        COALESCE(c.title, c_legacy.title, 'Unassigned Course') AS "courseTitle",
        q.question_text AS "questionText",
        q.option_a AS "optionA",
        q.option_b AS "optionB",
        q.option_c AS "optionC",
        q.option_d AS "optionD",
        q.correct_option AS "correctOption",
        q.explanation,
        q.difficulty,
        q.topic,
        q.exam_year AS "examYear",
        q.is_active AS "isActive",
        COALESCE(q.publication_status, 'published') AS "publicationStatus",
        COALESCE(q.ai_generated, FALSE) AS "aiGenerated",
        COALESCE(q.ai_requires_image, FALSE) AS "aiRequiresImage",
        q.ai_image_note AS "aiImageNote",
        q.ai_batch_id AS "aiBatchId",
        q.created_at AS "createdAt"
      FROM questions q
      LEFT JOIN courses c ON q.course_id = c.id
      LEFT JOIN LATERAL (
        SELECT cl.id, cl.code, cl.title
        FROM courses cl
        WHERE q.course_id IS NULL AND q.subject_id IS NOT NULL AND cl.subject_id = q.subject_id
        ORDER BY cl.code ASC
        LIMIT 1
      ) c_legacy ON TRUE
      ${whereClause}
      ORDER BY q.created_at DESC
      LIMIT $${limitIdx}
      `,
      params
    );

    const imagesMap = await getQuestionImagesMap(result.rows.map((r) => r.id));

    res.json({
      questions: result.rows.map((r) => ({
        ...r,
        images: imagesMap.get(r.id) || [],
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      })),
    });
  } catch (err) {
    handleApiError(res, err, 'listing admin questions');
  }
});

router.post('/questions', optionalMultipartImages, async (req, res) => {
  try {
    const parsed = questionSchema.parse(req.body ?? {});
    const db = getDb();

    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, parsed.courseId))
      .limit(1);

    if (!course) {
      res.status(404).json({ error: 'Selected course not found.' });
      return;
    }

    const uploadedFiles = Array.isArray(req.files)
      ? (req.files as Express.Multer.File[])
      : [];

    const effectiveActive =
      parsed.publicationStatus === 'draft' ? false : parsed.isActive;

    const [created] = await db
      .insert(questions)
      .values({
        courseId: course.id,
        subjectId: course.subjectId ?? null,
        questionText: parsed.questionText,
        optionA: parsed.optionA,
        optionB: parsed.optionB,
        optionC: parsed.optionC,
        optionD: parsed.optionD,
        correctOption: parsed.correctOption,
        explanation: parsed.explanation,
        difficulty: parsed.difficulty,
        topic: parsed.topic,
        examYear: parsed.examYear ?? null,
        isActive: effectiveActive,
        publicationStatus: parsed.publicationStatus,
        createdBy: req.user!.id,
      })
      .returning();

    let attachedImages: Awaited<ReturnType<typeof attachImagesToQuestion>> = [];
    if (uploadedFiles.length > 0) {
      try {
        attachedImages = await attachImagesToQuestion({
          questionId: created.id,
          files: uploadedFiles.map((f) => ({
            buffer: f.buffer,
            mimeType: f.mimetype,
            fileName: f.originalname,
          })),
          createdBy: req.user!.id,
        });
      } catch (imgErr) {
        // Roll back created question if an uploaded image fails validation
        await db.delete(questions).where(eq(questions.id, created.id));
        throw imgErr;
      }
    }

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.question.create',
      entityType: 'question',
      entityId: created.id,
      metadata: {
        courseId: course.id,
        courseCode: course.code,
        publicationStatus: created.publicationStatus,
        imageCount: attachedImages.length,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      question: {
        ...created,
        courseCode: course.code,
        courseTitle: course.title,
        images: attachedImages,
      },
    });
  } catch (err) {
    if (err instanceof QuestionImageValidationError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    handleApiError(res, err, 'creating question');
  }
});

router.patch('/questions/:id', async (req, res) => {
  try {
    const parsed = questionSchema.partial().parse(req.body ?? {});
    const db = getDb();

    let resolvedCourse: { id: string; code: string; title: string; subjectId: string | null } | null = null;
    if (parsed.courseId) {
      const [foundCourse] = await db
        .select({
          id: courses.id,
          code: courses.code,
          title: courses.title,
          subjectId: courses.subjectId,
        })
        .from(courses)
        .where(eq(courses.id, parsed.courseId))
        .limit(1);

      if (!foundCourse) {
        res.status(404).json({ error: 'Selected course not found.' });
        return;
      }
      resolvedCourse = foundCourse;
    }

    const updateValues: Record<string, unknown> = {
      ...parsed,
      updatedAt: new Date(),
    };
    if (parsed.publicationStatus === 'published' && parsed.isActive === undefined) {
      updateValues.isActive = true;
    } else if (parsed.publicationStatus === 'draft' && parsed.isActive === undefined) {
      updateValues.isActive = false;
    }
    if (resolvedCourse) {
      updateValues.courseId = resolvedCourse.id;
      updateValues.subjectId = resolvedCourse.subjectId ?? null;
    }

    const [updated] = await db
      .update(questions)
      .set(updateValues)
      .where(eq(questions.id, req.params.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }

    if (!resolvedCourse && updated.courseId) {
      const [courseRow] = await db
        .select({
          id: courses.id,
          code: courses.code,
          title: courses.title,
          subjectId: courses.subjectId,
        })
        .from(courses)
        .where(eq(courses.id, updated.courseId))
        .limit(1);
      if (courseRow) resolvedCourse = courseRow;
    }

    const imagesMap = await getQuestionImagesMap([updated.id]);

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.question.update',
      entityType: 'question',
      entityId: updated.id,
      metadata: {
        courseId: updated.courseId,
        difficulty: updated.difficulty,
        isActive: updated.isActive,
        publicationStatus: updated.publicationStatus,
      },
      ipAddress: req.ip,
    });

    res.json({
      question: {
        ...updated,
        courseCode: resolvedCourse?.code || 'COURSE',
        courseTitle: resolvedCourse?.title || 'Unassigned Course',
        images: imagesMap.get(updated.id) || [],
      },
    });
  } catch (err) {
    handleApiError(res, err, 'updating question');
  }
});

router.post('/questions/:id/publish', async (req, res) => {
  try {
    const questionId = z.string().uuid('Valid questionId is required').parse(req.params.id);
    const db = getDb();
    const [updated] = await db
      .update(questions)
      .set({
        publicationStatus: 'published',
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(questions.id, questionId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }

    const [courseRow] = updated.courseId
      ? await db
          .select({ code: courses.code, title: courses.title })
          .from(courses)
          .where(eq(courses.id, updated.courseId))
          .limit(1)
      : [];
    const imagesMap = await getQuestionImagesMap([updated.id]);

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.question.publish',
      entityType: 'question',
      entityId: updated.id,
      metadata: { courseId: updated.courseId, difficulty: updated.difficulty },
      ipAddress: req.ip,
    });

    res.json({
      question: {
        ...updated,
        courseCode: courseRow?.code || 'COURSE',
        courseTitle: courseRow?.title || 'Unassigned Course',
        images: imagesMap.get(updated.id) || [],
      },
      message: 'Question approved and published to the live CBT question bank.',
    });
  } catch (err) {
    handleApiError(res, err, 'publishing question');
  }
});

router.post('/questions/publish-batch', async (req, res) => {
  try {
    const schema = z.object({
      questionIds: z.array(z.string().uuid()).min(1, 'Select at least one draft question to publish.'),
    });
    const parsed = schema.parse(req.body ?? {});
    const db = getDb();

    const updatedRows = await db
      .update(questions)
      .set({
        publicationStatus: 'published',
        isActive: true,
        updatedAt: new Date(),
      })
      .where(inArray(questions.id, parsed.questionIds))
      .returning({ id: questions.id });

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.question.publish_batch',
      entityType: 'question',
      entityId: updatedRows[0]?.id ?? null,
      metadata: { publishedCount: updatedRows.length, questionIds: updatedRows.map((r) => r.id) },
      ipAddress: req.ip,
    });

    res.json({
      publishedCount: updatedRows.length,
      publishedIds: updatedRows.map((r) => r.id),
      message: `${updatedRows.length} question(s) approved and published to the live CBT bank.`,
    });
  } catch (err) {
    handleApiError(res, err, 'publishing draft questions');
  }
});

router.post(
  '/questions/:id/images',
  questionImageUpload.array('images', 8) as unknown as RequestHandler,
  async (req, res) => {
    try {
      const questionId = z.string().uuid('Valid questionId is required').parse(req.params.id);
      const db = getDb();
      const [existing] = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.id, questionId))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: 'Question not found.' });
        return;
      }

      const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];
      if (files.length === 0) {
        res.status(400).json({ error: 'Select at least one JPG, JPEG, PNG, or WEBP image.' });
        return;
      }

      const caption =
        typeof req.body?.caption === 'string' && req.body.caption.trim()
          ? req.body.caption.trim()
          : null;

      await attachImagesToQuestion({
        questionId,
        files: files.map((f) => ({
          buffer: f.buffer,
          mimeType: f.mimetype,
          fileName: f.originalname,
          caption,
        })),
        createdBy: req.user!.id,
      });

      const imagesMap = await getQuestionImagesMap([questionId]);
      res.status(201).json({
        images: imagesMap.get(questionId) || [],
        message: `${files.length} image(s) attached to question.`,
      });
    } catch (err) {
      if (err instanceof QuestionImageValidationError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      handleApiError(res, err, 'attaching question images');
    }
  }
);

router.post(
  '/questions/:id/images/:imageId/replace',
  questionImageUpload.single('image') as unknown as RequestHandler,
  async (req, res) => {
    try {
      const questionId = z.string().uuid().parse(req.params.id);
      const imageId = z.string().uuid().parse(req.params.imageId);
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'Select a replacement JPG, JPEG, PNG, or WEBP image.' });
        return;
      }

      const db = getDb();
      const [existing] = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.id, questionId))
        .limit(1);
      if (!existing) {
        res.status(404).json({ error: 'Question not found.' });
        return;
      }

      await attachImagesToQuestion({
        questionId,
        files: [
          {
            buffer: file.buffer,
            mimeType: file.mimetype,
            fileName: file.originalname,
          },
        ],
        createdBy: req.user!.id,
      });
      await deleteQuestionImage(questionId, imageId);

      const imagesMap = await getQuestionImagesMap([questionId]);
      res.json({
        images: imagesMap.get(questionId) || [],
        message: 'Question image replaced.',
      });
    } catch (err) {
      if (err instanceof QuestionImageValidationError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      handleApiError(res, err, 'replacing question image');
    }
  }
);

router.delete('/questions/:id/images/:imageId', async (req, res) => {
  try {
    const questionId = z.string().uuid().parse(req.params.id);
    const imageId = z.string().uuid().parse(req.params.imageId);

    const deleted = await deleteQuestionImage(questionId, imageId);
    if (!deleted) {
      res.status(404).json({ error: 'Question image not found.' });
      return;
    }

    const imagesMap = await getQuestionImagesMap([questionId]);
    res.json({
      deletedImageId: imageId,
      images: imagesMap.get(questionId) || [],
      message: 'Image removed from question.',
    });
  } catch (err) {
    handleApiError(res, err, 'deleting question image');
  }
});

router.delete('/questions/:id', async (req, res) => {
  try {
    await cleanupS3ObjectsForQuestion(req.params.id);
    const db = getDb();
    const [deleted] = await db
      .delete(questions)
      .where(eq(questions.id, req.params.id))
      .returning({
        id: questions.id,
        courseId: questions.courseId,
        difficulty: questions.difficulty,
      });
    if (!deleted) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.question.delete',
      entityType: 'question',
      entityId: deleted.id,
      metadata: {
        courseId: deleted.courseId,
        difficulty: deleted.difficulty,
      },
      ipAddress: req.ip,
    });

    res.json({ deletedId: deleted.id });
  } catch (err) {
    handleApiError(res, err, 'deleting question');
  }
});

// Secure Admin AI API Key Configuration & Connection Testing
router.get('/ai/settings', async (_req, res) => {
  try {
    const settings = await getAiSettingsSummary();
    res.json({ settings });
  } catch (err) {
    handleApiError(res, err, 'fetching AI settings');
  }
});

router.put('/ai/settings', async (req, res) => {
  try {
    const schema = z.object({
      apiKey: z.string().trim().min(15).max(300).optional(),
      clearStoredKey: z.boolean().optional(),
      modelName: z.enum(['gemini-4-hydrogen', 'gemini-4-neon']).optional(),
    });
    const parsed = schema.parse(req.body ?? {});

    const settings = await saveGeminiApiSettings({
      apiKey: parsed.apiKey,
      clearStoredKey: parsed.clearStoredKey,
      modelName: parsed.modelName,
      adminUserId: req.user!.id,
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: parsed.clearStoredKey ? 'admin.ai.key_cleared' : 'admin.ai.settings_updated',
      entityType: 'system',
      entityId: 'gemini_ai',
      metadata: {
        source: settings.source,
        modelName: settings.modelName,
        maskedKey: settings.maskedKey,
      },
      ipAddress: req.ip,
    });

    res.json({
      settings,
      message: parsed.clearStoredKey
        ? 'Stored Gemini API key removed.'
        : 'Gemini API settings saved securely on the backend.',
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Invalid Gemini API key')) {
      res.status(400).json({ error: err.message });
      return;
    }
    handleApiError(res, err, 'updating AI settings');
  }
});

router.post('/ai/test', async (req, res) => {
  try {
    const schema = z.object({
      apiKey: z.string().trim().min(10).max(300).optional(),
      modelName: z.enum(['gemini-4-hydrogen', 'gemini-4-neon']).optional(),
    });
    const parsed = schema.parse(req.body ?? {});

    const outcome = await testGeminiConnection({
      candidateApiKey: parsed.apiKey,
      modelName: parsed.modelName,
      adminUserId: req.user!.id,
    });

    res.status(outcome.ok ? 200 : 400).json({
      ok: outcome.ok,
      message: outcome.message,
      settings: outcome.summary,
    });
  } catch (err) {
    handleApiError(res, err, 'testing Gemini API connection');
  }
});

// Multimodal AI Question Generator (PDF/DOC/DOCX/TXT, Image OCR/Diagrams, Direct Text -> Draft Queue)
router.post('/ai/generate-questions', optionalMultipartAiSources, async (req, res) => {
  try {
    const schema = z.object({
      courseId: z.string().uuid('Please select a valid course from the database.'),
      count: z.coerce.number().int().min(1).max(50).default(5),
      difficulty: z.enum(['Easy', 'Medium', 'Hard', 'Difficult']).default('Medium'),
      topicHint: z.string().trim().max(160).optional(),
      textContent: z.string().max(130_000).optional(),
    });
    const parsed = schema.parse(req.body ?? {});

    const db = getDb();
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, parsed.courseId))
      .limit(1);

    if (!course) {
      res.status(404).json({ error: 'Selected course was not found.' });
      return;
    }

    const fileMap = (req.files && !Array.isArray(req.files) ? req.files : {}) as Record<
      string,
      Express.Multer.File[]
    >;
    const docFile = fileMap.document?.[0] ?? null;
    const uploadedImageFiles = fileMap.images ?? [];

    const drafts = await generateCbtQuestionsWithAi({
      course: {
        id: course.id,
        code: course.code,
        title: course.title,
        level: course.level,
      },
      count: parsed.count,
      difficulty: parsed.difficulty,
      topicHint: parsed.topicHint,
      textContent: parsed.textContent,
      documentFile: docFile
        ? {
            buffer: docFile.buffer,
            mimeType: docFile.mimetype,
            originalname: docFile.originalname,
          }
        : null,
      uploadedImages: uploadedImageFiles.map((img) => ({
        buffer: img.buffer,
        mimeType: img.mimetype,
        originalname: img.originalname,
      })),
    });

    const batchId = crypto.randomUUID();
    const insertedQuestions = await db
      .insert(questions)
      .values(
        drafts.map((d) => ({
          courseId: course.id,
          subjectId: course.subjectId ?? null,
          questionText: d.questionText,
          optionA: d.optionA,
          optionB: d.optionB,
          optionC: d.optionC,
          optionD: d.optionD,
          correctOption: d.correctOption,
          explanation: d.explanation,
          difficulty: d.difficulty,
          topic: d.topic,
          isActive: false,
          publicationStatus: 'draft',
          aiGenerated: true,
          aiRequiresImage: d.requiresImage,
          aiImageNote: d.imageNote,
          aiBatchId: batchId,
          createdBy: req.user!.id,
        }))
      )
      .returning();

    const attachedMap = new Map<string, Awaited<ReturnType<typeof attachImagesToQuestion>>>();
    for (let idx = 0; idx < insertedQuestions.length; idx += 1) {
      const qRow = insertedQuestions[idx];
      const matchedIndices = drafts[idx]?.matchedImageIndices || [];
      if (matchedIndices.length > 0 && uploadedImageFiles.length > 0) {
        const filesToAttach = matchedIndices
          .map((imgIdx) => uploadedImageFiles[imgIdx])
          .filter((f): f is Express.Multer.File => Boolean(f));
        if (filesToAttach.length > 0) {
          const savedImgs = await attachImagesToQuestion({
            questionId: qRow.id,
            files: filesToAttach.map((f) => ({
              buffer: f.buffer,
              mimeType: f.mimetype,
              fileName: f.originalname,
              caption: drafts[idx]?.imageNote || null,
            })),
            createdBy: req.user!.id,
          });
          attachedMap.set(qRow.id, savedImgs);
        }
      }
    }

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.ai.generate_questions',
      entityType: 'course',
      entityId: course.id,
      metadata: {
        batchId,
        courseCode: course.code,
        difficulty: normalizeDifficultyForDb(parsed.difficulty),
        count: insertedQuestions.length,
        hasDocument: Boolean(docFile),
        uploadedImagesCount: uploadedImageFiles.length,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      batchId,
      count: insertedQuestions.length,
      message: `Generated ${insertedQuestions.length} draft question(s) for ${course.code}. Review and approve before publishing.`,
      questions: insertedQuestions.map((row) => ({
        ...row,
        courseCode: course.code,
        courseTitle: course.title,
        images: attachedMap.get(row.id) || [],
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      })),
    });
  } catch (err) {
    if (err instanceof AiGenerationError || err instanceof QuestionImageValidationError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    handleApiError(res, err, 'generating AI questions');
  }
});

router.post('/ai/regenerate-question/:id', async (req, res) => {
  try {
    const questionId = z.string().uuid().parse(req.params.id);
    const schema = z.object({
      instruction: z.string().trim().max(500).optional(),
      sourceExcerpt: z.string().max(15_000).optional(),
    });
    const parsed = schema.parse(req.body ?? {});

    const db = getDb();
    const [existing] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Question draft not found.' });
      return;
    }

    if (!existing.courseId) {
      res.status(400).json({ error: 'Question must be assigned to a course before regenerating.' });
      return;
    }

    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, existing.courseId))
      .limit(1);

    if (!course) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }

    const regenerated = await regenerateSingleQuestionWithAi({
      course: {
        id: course.id,
        code: course.code,
        title: course.title,
        level: course.level,
      },
      existingQuestion: existing,
      instruction: parsed.instruction,
      sourceExcerpt: parsed.sourceExcerpt,
    });

    const [updated] = await db
      .update(questions)
      .set({
        questionText: regenerated.questionText,
        optionA: regenerated.optionA,
        optionB: regenerated.optionB,
        optionC: regenerated.optionC,
        optionD: regenerated.optionD,
        correctOption: regenerated.correctOption,
        explanation: regenerated.explanation,
        topic: regenerated.topic,
        aiRequiresImage: regenerated.requiresImage,
        aiImageNote: regenerated.imageNote,
        updatedAt: new Date(),
      })
      .where(eq(questions.id, existing.id))
      .returning();

    const imagesMap = await getQuestionImagesMap([updated.id]);

    res.json({
      question: {
        ...updated,
        courseCode: course.code,
        courseTitle: course.title,
        images: imagesMap.get(updated.id) || [],
        createdAt:
          updated.createdAt instanceof Date
            ? updated.createdAt.toISOString()
            : String(updated.createdAt),
      },
      message: 'Question regenerated successfully.',
    });
  } catch (err) {
    if (err instanceof AiGenerationError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    handleApiError(res, err, 'regenerating question');
  }
});

// Compatibility endpoint updated to save as drafts via centralized AI service & Gemini 4
router.post('/questions/generate', async (req, res) => {
  try {
    const genSchema = z.object({
      courseId: z.string().uuid(),
      topic: z.string().trim().min(2).max(160),
      difficulty: z.enum(['Easy', 'Medium', 'Hard', 'Difficult']).default('Medium'),
      count: z.number().int().min(1).max(50).default(5),
    });

    const parsed = genSchema.parse(req.body ?? {});
    const db = getDb();
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, parsed.courseId))
      .limit(1);

    if (!course) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }

    const drafts = await generateCbtQuestionsWithAi({
      course: { id: course.id, code: course.code, title: course.title, level: course.level },
      count: parsed.count,
      difficulty: parsed.difficulty,
      topicHint: parsed.topic,
      textContent: `Focus topic: ${parsed.topic}`,
    });

    const batchId = crypto.randomUUID();
    const inserted = await db
      .insert(questions)
      .values(
        drafts.map((d) => ({
          courseId: course.id,
          subjectId: course.subjectId ?? null,
          questionText: d.questionText,
          optionA: d.optionA,
          optionB: d.optionB,
          optionC: d.optionC,
          optionD: d.optionD,
          correctOption: d.correctOption,
          explanation: d.explanation,
          difficulty: d.difficulty,
          topic: parsed.topic,
          isActive: false,
          publicationStatus: 'draft',
          aiGenerated: true,
          aiRequiresImage: d.requiresImage,
          aiImageNote: d.imageNote,
          aiBatchId: batchId,
          createdBy: req.user!.id,
        }))
      )
      .returning();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.question.generate',
      entityType: 'course',
      entityId: course.id,
      metadata: {
        batchId,
        courseCode: course.code,
        topic: parsed.topic,
        difficulty: normalizeDifficultyForDb(parsed.difficulty),
        count: inserted.length,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      batchId,
      questions: inserted.map((row) => ({
        ...row,
        courseCode: course.code,
        courseTitle: course.title,
        images: [],
      })),
    });
  } catch (err) {
    if (err instanceof AiGenerationError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    handleApiError(res, err, 'generating questions');
  }
});

// Study Materials Upload & Management (External S3 Object Storage with automatic PostgreSQL BYTEA fallback)
router.post(
  '/materials/upload',
  upload.single('file') as unknown as RequestHandler,
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'A study material file is required.' });
        return;
      }

      const metaSchema = z.object({
        title: z.string().trim().min(2).max(180),
        description: z.string().trim().max(500).default(''),
        category: z.enum(['Tutorials', 'Notes', 'Past Questions', 'Guides']).default('Notes'),
        courseId: z.string().uuid().optional().or(z.literal('')),
      });

      const parsed = metaSchema.parse(req.body);
      const objectKey = buildMaterialObjectKey(file.originalname, parsed.category);

      let storageBackend: 's3' | 'postgres' = 'postgres';
      let fileData: Buffer | null = file.buffer;

      if (isObjectStorageConfigured()) {
        try {
          await uploadObjectBuffer({
            objectKey,
            body: file.buffer,
            contentType: file.mimetype || 'application/octet-stream',
          });
          storageBackend = 's3';
          fileData = null;
        } catch (storageErr) {
          console.warn(
            '[StudyMaterials] S3 upload failed, falling back to PostgreSQL BYTEA:',
            storageErr
          );
          storageBackend = 'postgres';
          fileData = file.buffer;
        }
      }

      const lowerName = file.originalname.toLowerCase();
      const fileType =
        lowerName.endsWith('.doc') || lowerName.endsWith('.docx')
          ? 'DOC'
          : file.mimetype.startsWith('image/')
            ? 'IMAGE'
            : 'PDF';

      const db = getDb();
      const [created] = await db
        .insert(studyMaterials)
        .values({
          courseId: parsed.courseId ? parsed.courseId : null,
          title: parsed.title,
          description: parsed.description,
          category: parsed.category,
          fileType,
          fileSizeBytes: file.size,
          storageBackend,
          objectKey,
          originalFilename: path.basename(file.originalname || 'material.pdf'),
          fileData,
          mimeType: file.mimetype || 'application/pdf',
          uploadedBy: req.user!.id,
          isActive: true,
        })
        .returning({
          id: studyMaterials.id,
          courseId: studyMaterials.courseId,
          title: studyMaterials.title,
          description: studyMaterials.description,
          category: studyMaterials.category,
          fileType: studyMaterials.fileType,
          fileSizeBytes: studyMaterials.fileSizeBytes,
          storageBackend: studyMaterials.storageBackend,
          mimeType: studyMaterials.mimeType,
          downloadCount: studyMaterials.downloadCount,
          createdAt: studyMaterials.createdAt,
        });

      await writeAuditLog({
        actorUserId: req.user!.id,
        action: 'admin.material.upload',
        entityType: 'study_material',
        entityId: created.id,
        metadata: { title: created.title, objectKey, storageBackend },
        ipAddress: req.ip,
      });

      res.status(201).json({ material: created });
    } catch (err) {
      handleApiError(res, err, 'uploading study material');
    }
  }
);

router.delete('/materials/:id', async (req, res) => {
  try {
    const db = getDb();
    const [existing] = await db
      .select({
        id: studyMaterials.id,
        objectKey: studyMaterials.objectKey,
        storageBackend: studyMaterials.storageBackend,
      })
      .from(studyMaterials)
      .where(eq(studyMaterials.id, req.params.id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Study material not found.' });
      return;
    }

    if (existing.storageBackend === 's3') {
      try {
        await deleteObjectKey(existing.objectKey);
      } catch (storageErr) {
        if (!(storageErr instanceof ObjectStorageNotConfiguredError)) {
          console.warn('[ObjectStorage Delete Warning]', storageErr);
        }
      }
    }

    await db.delete(studyMaterials).where(eq(studyMaterials.id, existing.id));
    res.json({ deletedId: existing.id });
  } catch (err) {
    handleApiError(res, err, 'deleting study material');
  }
});

// Course Registrations Monitoring + Export
async function queryAdminRegistrations(filters: {
  search?: string;
  courseId?: string;
  paymentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const pool = getPool();
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.search) {
    values.push(`%${filters.search.toLowerCase()}%`);
    const idx = values.length;
    clauses.push(
      `(LOWER(u.full_name) LIKE $${idx} OR LOWER(u.email) LIKE $${idx} OR LOWER(COALESCE(u.registration_code, '')) LIKE $${idx} OR LOWER(COALESCE(cr.whatsapp_number, p.whatsapp_number, u.whatsapp_number, '')) LIKE $${idx})`
    );
  }
  if (filters.courseId) {
    values.push(filters.courseId);
    clauses.push(`cr.course_id = $${values.length}`);
  }
  if (filters.paymentStatus) {
    values.push(filters.paymentStatus);
    clauses.push(
      `COALESCE(p.payment_status, CASE WHEN cr.preserved_payment_ref IS NOT NULL OR cr.activation_source = 'admin_manual' THEN 'successful' ELSE 'pending' END) = $${values.length}`
    );
  }
  if (filters.dateFrom) {
    values.push(filters.dateFrom);
    clauses.push(`cr.registered_at >= $${values.length}::timestamptz`);
  }
  if (filters.dateTo) {
    values.push(`${filters.dateTo}T23:59:59.999Z`);
    clauses.push(`cr.registered_at <= $${values.length}::timestamptz`);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const res = await pool.query<{
    id: string;
    studentId: string;
    studentName: string;
    studentEmail: string;
    studentRegistrationCode: string | null;
    whatsappNumber: string | null;
    courseId: string;
    courseCode: string;
    courseTitle: string;
    paymentId: string;
    paymentReference: string;
    activationSource: 'paystack' | 'admin_manual';
    courseValue: string;
    totalAmountCharged: string;
    amount: string;
    currency: string;
    gatewayFee: string | null;
    netSettlementAmount: string | null;
    settlementVariance: string | null;
    reconciliationStatus: string;
    paymentChannel: string | null;
    paymentStatus: string;
    registrationStatus: string;
    gateway: string;
    gatewayTransactionId: string | null;
    paidAt: Date | null;
    registeredAt: Date;
  }>(
    `SELECT
       cr.id,
       u.id AS "studentId",
       u.full_name AS "studentName",
       u.email AS "studentEmail",
       u.registration_code AS "studentRegistrationCode",
       COALESCE(cr.whatsapp_number, p.whatsapp_number, u.whatsapp_number) AS "whatsappNumber",
       c.id AS "courseId",
       c.code AS "courseCode",
       c.title AS "courseTitle",
       COALESCE(p.id::text, cr.id::text) AS "paymentId",
       CASE
         WHEN cr.activation_source = 'admin_manual' AND cr.payment_id IS NULL THEN 'ADMIN-ACTIVATED'
         ELSE COALESCE(p.payment_reference, cr.preserved_payment_ref, 'PRESERVED-REG')
       END AS "paymentReference",
       cr.activation_source AS "activationSource",
       COALESCE(p.course_value, c.course_value, 2300.00)::text AS "courseValue",
       CASE
         WHEN cr.activation_source = 'admin_manual' AND cr.payment_id IS NULL THEN '0.00'
         ELSE COALESCE(p.total_amount_charged, cr.preserved_amount_paid, c.registration_fee, 2350.00)::text
       END AS "totalAmountCharged",
       CASE
         WHEN cr.activation_source = 'admin_manual' AND cr.payment_id IS NULL THEN '0.00'
         ELSE COALESCE(p.amount, cr.preserved_amount_paid, c.registration_fee, 2350.00)::text
       END AS "amount",
       COALESCE(p.currency, c.currency, 'NGN') AS currency,
       p.gateway_fee::text AS "gatewayFee",
       p.net_settlement_amount::text AS "netSettlementAmount",
       p.settlement_variance::text AS "settlementVariance",
       COALESCE(p.reconciliation_status, CASE WHEN cr.activation_source = 'admin_manual' THEN 'not_applicable' ELSE 'reconciled' END) AS "reconciliationStatus",
       p.payment_channel AS "paymentChannel",
       COALESCE(p.payment_status, CASE WHEN cr.preserved_payment_ref IS NOT NULL OR cr.activation_source = 'admin_manual' THEN 'successful' ELSE 'pending' END) AS "paymentStatus",
       cr.registration_status AS "registrationStatus",
       CASE
         WHEN cr.activation_source = 'admin_manual' AND cr.payment_id IS NULL THEN 'admin_manual'
         ELSE COALESCE(p.gateway, 'paystack')
       END AS gateway,
       p.gateway_transaction_id AS "gatewayTransactionId",
       COALESCE(p.paid_at, cr.activated_at) AS "paidAt",
       cr.registered_at AS "registeredAt"
     FROM course_registrations cr
     INNER JOIN users u ON u.id = cr.student_id
     INNER JOIN courses c ON c.id = cr.course_id
     LEFT JOIN payments p ON p.id = cr.payment_id
     ${whereSql}
     ORDER BY cr.registered_at DESC
     LIMIT 500`,
    values
  );

  return res.rows.map((r) => ({
    ...r,
    activationSource: r.activationSource === 'admin_manual' ? 'admin_manual' : 'paystack',
    courseValue: Number(r.courseValue),
    totalAmountCharged: Number(r.totalAmountCharged),
    amount: Number(r.amount),
    gatewayFee: r.gatewayFee !== null ? Number(r.gatewayFee) : null,
    netSettlementAmount: r.netSettlementAmount !== null ? Number(r.netSettlementAmount) : null,
    settlementVariance: r.settlementVariance !== null ? Number(r.settlementVariance) : null,
  }));
}

router.get('/registrations', async (req, res) => {
  try {
    const rows = await queryAdminRegistrations({
      search: typeof req.query.search === 'string' ? req.query.search.trim() : undefined,
      courseId: typeof req.query.courseId === 'string' ? req.query.courseId.trim() : undefined,
      paymentStatus:
        typeof req.query.paymentStatus === 'string' ? req.query.paymentStatus.trim() : undefined,
      dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : undefined,
      dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : undefined,
    });
    res.json({ registrations: rows });
  } catch (err) {
    handleApiError(res, err, 'listing course registrations');
  }
});

router.get('/registrations/export', async (req, res) => {
  try {
    const rows = await queryAdminRegistrations({
      search: typeof req.query.search === 'string' ? req.query.search.trim() : undefined,
      courseId: typeof req.query.courseId === 'string' ? req.query.courseId.trim() : undefined,
      paymentStatus:
        typeof req.query.paymentStatus === 'string' ? req.query.paymentStatus.trim() : undefined,
      dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : undefined,
      dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : undefined,
    });

    const escapeCsv = (val: unknown) => {
      const s = String(val ?? '');
      return `"${s.replace(/"/g, '""')}"`;
    };

    const header = [
      'Registration ID',
      'Student Name',
      'Email',
      'WhatsApp Number',
      'Course Code',
      'Course Title',
      'Course Value',
      'Total Charged',
      'Paystack Fee',
      'Net Settlement',
      'Settlement Variance',
      'Reconciliation Status',
      'Payment Channel',
      'Currency',
      'Payment Status',
      'Registration Status',
      'Payment Reference',
      'Registration Date',
    ].join(',');

    const lines = rows.map((r) =>
      [
        escapeCsv(r.id),
        escapeCsv(r.studentName),
        escapeCsv(r.studentEmail),
        escapeCsv(r.whatsappNumber || ''),
        escapeCsv(r.courseCode),
        escapeCsv(r.courseTitle),
        escapeCsv(r.courseValue),
        escapeCsv(r.totalAmountCharged),
        escapeCsv(r.gatewayFee ?? ''),
        escapeCsv(r.netSettlementAmount ?? ''),
        escapeCsv(r.settlementVariance ?? ''),
        escapeCsv(r.reconciliationStatus),
        escapeCsv(r.paymentChannel || ''),
        escapeCsv(r.currency),
        escapeCsv(r.paymentStatus),
        escapeCsv(r.registrationStatus),
        escapeCsv(r.paymentReference),
        escapeCsv(new Date(r.registeredAt).toISOString()),
      ].join(',')
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="acadet-course-registrations-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send([header, ...lines].join('\n'));
  } catch (err) {
    handleApiError(res, err, 'exporting course registrations');
  }
});

// Payment Records Management
router.get('/payments', async (req, res) => {
  try {
    const pool = getPool();
    const clauses: string[] = [];
    const values: unknown[] = [];

    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const courseId = typeof req.query.courseId === 'string' ? req.query.courseId.trim() : '';
    const studentId = typeof req.query.studentId === 'string' ? req.query.studentId.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';

    if (status) {
      values.push(status);
      clauses.push(`p.payment_status = $${values.length}`);
    }
    if (courseId) {
      values.push(courseId);
      clauses.push(`p.course_id = $${values.length}`);
    }
    if (studentId) {
      values.push(studentId);
      clauses.push(`p.student_id = $${values.length}`);
    }
    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      const idx = values.length;
      clauses.push(
        `(LOWER(COALESCE(u.full_name, '')) LIKE $${idx} OR LOWER(COALESCE(u.email, '')) LIKE $${idx} OR LOWER(COALESCE(p.deleted_student_ref, '')) LIKE $${idx} OR LOWER(p.payment_reference) LIKE $${idx} OR LOWER(COALESCE(p.whatsapp_number, u.whatsapp_number, '')) LIKE $${idx})`
      );
    }
    if (dateFrom) {
      values.push(dateFrom);
      clauses.push(`p.created_at >= $${values.length}::timestamptz`);
    }
    if (dateTo) {
      values.push(`${dateTo}T23:59:59.999Z`);
      clauses.push(`p.created_at <= $${values.length}::timestamptz`);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const resDb = await pool.query<{
      id: string;
      studentId: string;
      studentName: string;
      studentEmail: string;
      whatsappNumber: string | null;
      courseId: string;
      courseCode: string;
      courseTitle: string;
      paymentReference: string;
      gateway: string;
      courseValue: string;
      totalAmountCharged: string;
      amount: string;
      currency: string;
      gatewayFee: string | null;
      gatewayFeeSource: string | null;
      netSettlementAmount: string | null;
      settlementVariance: string | null;
      reconciliationStatus: string;
      feeAbsorbedBy: string;
      paymentChannel: string | null;
      paymentStatus: 'pending' | 'successful' | 'failed' | 'refunded';
      gatewayTransactionId: string | null;
      gatewayResponse: Record<string, unknown>;
      paidAt: Date | null;
      createdAt: Date;
      registrationId: string | null;
      registrationStatus: string | null;
    }>(
      `SELECT
         p.id,
         COALESCE(u.id::text, p.deleted_student_ref, 'deleted-user') AS "studentId",
         COALESCE(u.full_name, 'Deleted Student (' || COALESCE(p.deleted_student_ref, 'Anonymized') || ')') AS "studentName",
         COALESCE(u.email, 'anonymized@deleted.local') AS "studentEmail",
         COALESCE(p.whatsapp_number, u.whatsapp_number) AS "whatsappNumber",
         c.id AS "courseId",
         c.code AS "courseCode",
         c.title AS "courseTitle",
         p.payment_reference AS "paymentReference",
         p.gateway,
         p.course_value::text AS "courseValue",
         p.total_amount_charged::text AS "totalAmountCharged",
         p.amount::text AS "amount",
         p.currency,
         p.gateway_fee::text AS "gatewayFee",
         p.gateway_fee_source AS "gatewayFeeSource",
         p.net_settlement_amount::text AS "netSettlementAmount",
         p.settlement_variance::text AS "settlementVariance",
         p.reconciliation_status AS "reconciliationStatus",
         p.fee_absorbed_by AS "feeAbsorbedBy",
         p.payment_channel AS "paymentChannel",
         p.payment_status AS "paymentStatus",
         p.gateway_transaction_id AS "gatewayTransactionId",
         p.gateway_response AS "gatewayResponse",
         p.paid_at AS "paidAt",
         p.created_at AS "createdAt",
         cr.id AS "registrationId",
         cr.registration_status AS "registrationStatus"
       FROM payments p
       LEFT JOIN users u ON u.id = p.student_id
       INNER JOIN courses c ON c.id = p.course_id
       LEFT JOIN course_registrations cr ON cr.payment_id = p.id
       ${whereSql}
       ORDER BY p.created_at DESC
       LIMIT 500`,
      values
    );

    res.json({
      payments: resDb.rows.map((r) => ({
        ...r,
        courseValue: Number(r.courseValue),
        totalAmountCharged: Number(r.totalAmountCharged),
        amount: Number(r.amount),
        gatewayFee: r.gatewayFee !== null ? Number(r.gatewayFee) : null,
        netSettlementAmount:
          r.netSettlementAmount !== null ? Number(r.netSettlementAmount) : null,
        settlementVariance:
          r.settlementVariance !== null ? Number(r.settlementVariance) : null,
      })),
    });
  } catch (err) {
    handleApiError(res, err, 'listing payment records');
  }
});

router.post('/payments/:id/reverify', async (req, res) => {
  try {
    const db = getDb();
    const [payRow] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, req.params.id))
      .limit(1);

    if (!payRow) {
      res.status(404).json({ error: 'Payment record not found.' });
      return;
    }

    const outcome = await verifyAndSettleStudentReference({
      reference: payRow.paymentReference,
      requestingUser: {
        id: req.user!.id,
        email: req.user!.email,
        fullName: req.user!.fullName,
        role: req.user!.role,
        whatsappNumber: req.user!.whatsappNumber,
      },
      source: 'admin_reverify',
      ipAddress: req.ip,
    });

    res.json(outcome);
  } catch (err) {
    if (err instanceof PaystackNotConfiguredError) {
      res.status(503).json({ error: err.message, code: 'PAYSTACK_NOT_CONFIGURED' });
      return;
    }
    if (err instanceof PaystackGatewayError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    if (err instanceof PaymentValidationError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    handleApiError(res, err, 're-verifying payment');
  }
});

// Announcements CRUD
router.get('/announcements', async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(announcements)
      .orderBy(desc(announcements.isPinned), desc(announcements.createdAt));
    res.json({ announcements: rows });
  } catch (err) {
    handleApiError(res, err, 'listing announcements');
  }
});

router.post('/announcements', async (req, res) => {
  try {
    const parsed = announcementSchema.parse(req.body);
    const db = getDb();
    const [created] = await db
      .insert(announcements)
      .values({ ...parsed, createdBy: req.user!.id })
      .returning();
    res.status(201).json({ announcement: created });
  } catch (err) {
    handleApiError(res, err, 'creating announcement');
  }
});

router.patch('/announcements/:id', async (req, res) => {
  try {
    const parsed = announcementSchema.partial().parse(req.body);
    const db = getDb();
    const [updated] = await db
      .update(announcements)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(announcements.id, req.params.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: 'Announcement not found.' });
      return;
    }
    res.json({ announcement: updated });
  } catch (err) {
    handleApiError(res, err, 'updating announcement');
  }
});

router.delete('/announcements/:id', async (req, res) => {
  try {
    const db = getDb();
    const [deleted] = await db
      .delete(announcements)
      .where(eq(announcements.id, req.params.id))
      .returning({ id: announcements.id });
    if (!deleted) {
      res.status(404).json({ error: 'Announcement not found.' });
      return;
    }
    res.json({ deletedId: deleted.id });
  } catch (err) {
    handleApiError(res, err, 'deleting announcement');
  }
});

// User Management + Student Lifecycle (Search, Filters, Profile + Exam History, Suspend, Reactivate, Permanent Delete, Notifications)
router.get('/users', async (req, res) => {
  try {
    const pool = getPool();
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : '';

    const clauses: string[] = [];
    const values: unknown[] = [];

    if (search) {
      values.push(`%${search}%`);
      const idx = values.length;
      clauses.push(
        `(LOWER(u.full_name) LIKE $${idx} OR LOWER(u.email) LIKE $${idx} OR LOWER(u.username) LIKE $${idx} OR LOWER(COALESCE(u.registration_code, '')) LIKE $${idx} OR LOWER(COALESCE(u.whatsapp_number, '')) LIKE $${idx})`
      );
    }

    if (status === 'active') {
      clauses.push(`(u.is_active = TRUE AND u.account_status = 'active')`);
    } else if (status === 'suspended') {
      clauses.push(`(u.is_active = FALSE OR u.account_status = 'suspended')`);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const resDb = await pool.query<{
      id: string;
      fullName: string;
      email: string;
      username: string;
      registrationCode: string | null;
      role: string;
      examTarget: string;
      whatsappNumber: string | null;
      isActive: boolean;
      accountStatus: string;
      suspendedReason: string | null;
      suspendedAt: Date | null;
      preferences: Record<string, unknown> | null;
      createdAt: Date;
      registeredCoursesCount: number;
      submittedExamsCount: number;
    }>(
      `SELECT
         u.id,
         u.full_name AS "fullName",
         u.email,
         u.username,
         u.registration_code AS "registrationCode",
         u.role,
         u.exam_target AS "examTarget",
         u.whatsapp_number AS "whatsappNumber",
         u.is_active AS "isActive",
         u.account_status AS "accountStatus",
         u.suspended_reason AS "suspendedReason",
         u.suspended_at AS "suspendedAt",
         u.preferences,
         u.created_at AS "createdAt",
         (
           SELECT COUNT(*)::int FROM course_registrations cr
           WHERE cr.student_id = u.id AND cr.registration_status = 'active'
         ) AS "registeredCoursesCount",
         (
           SELECT COUNT(*)::int FROM exam_sessions es
           WHERE es.user_id = u.id AND es.status = 'submitted'
         ) AS "submittedExamsCount"
       FROM users u
       ${whereSql}
       ORDER BY u.created_at DESC
       LIMIT 300`,
      values
    );

    res.json({
      users: resDb.rows.map((r) => ({
        ...sanitizeUser({
          id: r.id,
          fullName: r.fullName,
          email: r.email,
          username: r.username,
          registrationCode: r.registrationCode,
          role: r.role,
          examTarget: r.examTarget,
          whatsappNumber: r.whatsappNumber,
          isActive: r.isActive,
          accountStatus: r.accountStatus,
          suspendedReason: r.suspendedReason,
          suspendedAt: r.suspendedAt,
          preferences: r.preferences as never,
          createdAt: r.createdAt,
        }),
        registeredCoursesCount: r.registeredCoursesCount,
        submittedExamsCount: r.submittedExamsCount,
      })),
    });
  } catch (err) {
    handleApiError(res, err, 'listing users');
  }
});

router.get('/users/:id/profile', async (req, res) => {
  try {
    const pool = getPool();
    const db = getDb();
    const studentId = req.params.id;

    const [userRow] = await db
      .select()
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1);

    if (!userRow) {
      res.status(404).json({ error: 'Student account not found.' });
      return;
    }

    const coursesStatusRes = await pool.query<{
      courseId: string;
      code: string;
      title: string;
      level: string;
      courseValue: string;
      registrationFee: string;
      currency: string;
      registrationStatus: string | null;
      activationSource: string | null;
      registeredAt: Date | null;
      whatsappNumber: string | null;
      paymentId: string | null;
      preservedPaymentRef: string | null;
      paymentStatus: string | null;
      paymentReference: string | null;
      amountPaid: string | null;
    }>(
      `SELECT
         c.id AS "courseId",
         c.code,
         c.title,
         c.level,
         c.course_value::text AS "courseValue",
         c.registration_fee::text AS "registrationFee",
         c.currency,
         cr.registration_status AS "registrationStatus",
         cr.activation_source AS "activationSource",
         cr.registered_at AS "registeredAt",
         COALESCE(cr.whatsapp_number, p.whatsapp_number) AS "whatsappNumber",
         cr.payment_id AS "paymentId",
         cr.preserved_payment_ref AS "preservedPaymentRef",
         COALESCE(
           p.payment_status,
           CASE
             WHEN cr.preserved_payment_ref IS NOT NULL OR cr.activation_source = 'admin_manual' THEN 'successful'
             ELSE NULL
           END
         ) AS "paymentStatus",
         CASE
           WHEN cr.activation_source = 'admin_manual' AND cr.payment_id IS NULL THEN 'ADMIN-ACTIVATED'
           ELSE COALESCE(p.payment_reference, cr.preserved_payment_ref)
         END AS "paymentReference",
         CASE
           WHEN cr.activation_source = 'admin_manual' AND cr.payment_id IS NULL THEN '0.00'
           ELSE COALESCE(p.total_amount_charged, cr.preserved_amount_paid)::text
         END AS "amountPaid"
       FROM courses c
       LEFT JOIN course_registrations cr
         ON cr.course_id = c.id AND cr.student_id = $1 AND cr.registration_status = 'active'
       LEFT JOIN payments p
         ON p.id = cr.payment_id
       WHERE c.is_active = TRUE AND c.publication_status = 'published'
       ORDER BY c.code ASC`,
      [studentId]
    );

    const paymentsRes = await pool.query<{
      id: string;
      courseId: string;
      courseCode: string;
      courseTitle: string;
      paymentReference: string;
      gateway: string;
      whatsappNumber: string | null;
      courseValue: string;
      totalAmountCharged: string;
      amount: string;
      currency: string;
      gatewayFee: string | null;
      gatewayFeeSource: string | null;
      netSettlementAmount: string | null;
      settlementVariance: string | null;
      reconciliationStatus: string;
      feeAbsorbedBy: string;
      paymentChannel: string | null;
      paymentStatus: string;
      gatewayTransactionId: string | null;
      paidAt: Date | null;
      createdAt: Date;
    }>(
      `SELECT
         p.id,
         p.course_id AS "courseId",
         c.code AS "courseCode",
         c.title AS "courseTitle",
         p.payment_reference AS "paymentReference",
         p.gateway,
         p.whatsapp_number AS "whatsappNumber",
         p.course_value::text AS "courseValue",
         p.total_amount_charged::text AS "totalAmountCharged",
         p.amount::text AS "amount",
         p.currency,
         p.gateway_fee::text AS "gatewayFee",
         p.gateway_fee_source AS "gatewayFeeSource",
         p.net_settlement_amount::text AS "netSettlementAmount",
         p.settlement_variance::text AS "settlementVariance",
         p.reconciliation_status AS "reconciliationStatus",
         p.fee_absorbed_by AS "feeAbsorbedBy",
         p.payment_channel AS "paymentChannel",
         p.payment_status AS "paymentStatus",
         p.gateway_transaction_id AS "gatewayTransactionId",
         p.paid_at AS "paidAt",
         p.created_at AS "createdAt"
       FROM payments p
       INNER JOIN courses c ON c.id = p.course_id
       WHERE p.student_id = $1
       ORDER BY p.created_at DESC`,
      [studentId]
    );

    const examHistoryRes = await pool.query<{
      id: string;
      courseId: string | null;
      courseCode: string | null;
      courseTitle: string | null;
      examTitle: string;
      difficultyFilter: string;
      status: string;
      totalQuestions: number;
      correctCount: number | null;
      scorePercentage: number | null;
      timeSpentSeconds: number;
      startedAt: Date;
      submittedAt: Date | null;
    }>(
      `SELECT
         es.id,
         es.course_id AS "courseId",
         c.code AS "courseCode",
         COALESCE(c.title, s.name) AS "courseTitle",
         es.exam_title AS "examTitle",
         es.difficulty_filter AS "difficultyFilter",
         es.status,
         es.total_questions AS "totalQuestions",
         es.correct_count AS "correctCount",
         es.score_percentage AS "scorePercentage",
         es.time_spent_seconds AS "timeSpentSeconds",
         es.started_at AS "startedAt",
         es.submitted_at AS "submittedAt"
       FROM exam_sessions es
       LEFT JOIN courses c ON c.id = es.course_id
       LEFT JOIN subjects s ON s.id = es.subject_id
       WHERE es.user_id = $1
       ORDER BY es.started_at DESC
       LIMIT 100`,
      [studentId]
    );

    const coursesStatus = coursesStatusRes.rows.map((r) => {
      const isGst111Manual =
        r.activationSource === 'admin_manual' &&
        r.code.replace(/\s+/g, '').toUpperCase() === 'GST111';
      return {
        courseId: r.courseId,
        code: r.code,
        title: r.title,
        level: r.level,
        courseValue: Number(r.courseValue ?? COURSE_VALUE_NAIRA),
        registrationFee: Number(r.registrationFee ?? TOTAL_STUDENT_PAYABLE_NAIRA),
        currency: r.currency || STANDARD_CURRENCY,
        isRegistered:
          r.registrationStatus === 'active' &&
          (isGst111Manual ||
            r.paymentStatus === 'successful' ||
            (r.paymentId === null && Boolean(r.preservedPaymentRef))),
        activationSource:
          r.registrationStatus === 'active'
            ? r.activationSource === 'admin_manual'
              ? 'admin_manual'
              : 'paystack'
            : null,
        registeredAt: r.registeredAt,
        whatsappNumber: r.whatsappNumber,
        paymentStatus: r.paymentStatus,
        paymentReference: r.paymentReference,
        amountPaid: r.amountPaid !== null ? Number(r.amountPaid) : null,
      };
    });

    const studentPayments = paymentsRes.rows.map((p) => ({
      ...p,
      courseValue: Number(p.courseValue),
      totalAmountCharged: Number(p.totalAmountCharged),
      amount: Number(p.amount),
      gatewayFee: p.gatewayFee !== null ? Number(p.gatewayFee) : null,
      netSettlementAmount:
        p.netSettlementAmount !== null ? Number(p.netSettlementAmount) : null,
      settlementVariance:
        p.settlementVariance !== null ? Number(p.settlementVariance) : null,
    }));

    const successfulPayments = studentPayments.filter((p) => p.paymentStatus === 'successful');
    const totalAmountPaid = successfulPayments.reduce((acc, p) => acc + p.amount, 0);
    const totalCoursesRegistered = coursesStatus.filter((c) => c.isRegistered).length;
    const submittedExams = examHistoryRes.rows.filter((e) => e.status === 'submitted');

    res.json({
      student: sanitizeUser(userRow),
      coursesStatus,
      payments: studentPayments,
      examHistory: examHistoryRes.rows,
      summary: {
        totalPublishedCourses: coursesStatus.length,
        totalCoursesRegistered,
        totalSuccessfulPayments: successfulPayments.length,
        totalAmountPaid,
        totalSubmittedExams: submittedExams.length,
        outstandingCourseRegistrations: Math.max(
          0,
          coursesStatus.length - totalCoursesRegistered
        ),
      },
    });
  } catch (err) {
    handleApiError(res, err, 'fetching student profile');
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const parsed = updateUserSchema.parse(req.body);
    if (parsed.role === 'super_admin' && req.user!.role !== 'super_admin') {
      res.status(403).json({ error: 'Only super admins may promote a user to super_admin.' });
      return;
    }

    const db = getDb();
    const updatePayload: Record<string, unknown> = {
      ...parsed,
      updatedAt: new Date(),
    };

    if (parsed.isActive !== undefined) {
      updatePayload.accountStatus = parsed.isActive ? 'active' : 'suspended';
      if (parsed.isActive) {
        updatePayload.suspendedReason = null;
        updatePayload.suspendedAt = null;
        updatePayload.suspendedBy = null;
      } else {
        updatePayload.suspendedAt = new Date();
        updatePayload.suspendedBy = req.user!.id;
      }
    }

    const [updated] = await db
      .update(users)
      .set(updatePayload)
      .where(eq(users.id, req.params.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.user.update',
      entityType: 'user',
      entityId: updated.id,
      metadata: parsed,
      ipAddress: req.ip,
    });

    res.json({ user: sanitizeUser(updated) });
  } catch (err) {
    handleApiError(res, err, 'updating user');
  }
});

router.post('/users/:id/suspend', async (req, res) => {
  try {
    const bodySchema = z.object({
      reason: z.string().trim().max(500).optional(),
    });
    const parsed = bodySchema.parse(req.body ?? {});
    const targetId = req.params.id;

    if (targetId === req.user!.id) {
      res.status(400).json({ error: 'You cannot suspend your own active account.' });
      return;
    }

    const pool = getPool();
    const targetRes = await pool.query<{ id: string; role: string; email: string }>(
      `SELECT id, role, email FROM users WHERE id = $1 LIMIT 1`,
      [targetId]
    );
    const target = targetRes.rows[0];
    if (!target) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }

    if (target.role === 'super_admin') {
      const otherAdmins = await pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM users WHERE role = 'super_admin' AND is_active = TRUE AND account_status = 'active' AND id <> $1`,
        [targetId]
      );
      if ((otherAdmins.rows[0]?.count ?? 0) === 0) {
        res.status(409).json({
          error: 'Cannot suspend the last active Super Admin account.',
        });
        return;
      }
    }

    const db = getDb();
    const [updated] = await db
      .update(users)
      .set({
        isActive: false,
        accountStatus: 'suspended',
        suspendedReason: parsed.reason?.trim() || 'Suspended by Acadet CBT administration.',
        suspendedAt: new Date(),
        suspendedBy: req.user!.id,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetId))
      .returning();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.user.suspend',
      entityType: 'user',
      entityId: targetId,
      metadata: {
        targetEmail: target.email,
        reason: updated.suspendedReason,
      },
      ipAddress: req.ip,
    });

    res.json({
      user: sanitizeUser(updated),
      message: `Account for ${updated.fullName} has been suspended.`,
    });
  } catch (err) {
    handleApiError(res, err, 'suspending account');
  }
});

router.post('/users/:id/reactivate', async (req, res) => {
  try {
    const targetId = req.params.id;
    const db = getDb();

    const [updated] = await db
      .update(users)
      .set({
        isActive: true,
        accountStatus: 'active',
        suspendedReason: null,
        suspendedAt: null,
        suspendedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.user.reactivate',
      entityType: 'user',
      entityId: updated.id,
      metadata: {
        targetEmail: updated.email,
      },
      ipAddress: req.ip,
    });

    res.json({
      user: sanitizeUser(updated),
      message: `Account for ${updated.fullName} has been reactivated.`,
    });
  } catch (err) {
    handleApiError(res, err, 'reactivating account');
  }
});

router.delete('/users/:id', async (req, res) => {
  const deleteSchema = z.object({
    confirmation: z.string().trim().optional(),
    confirmEmail: z.string().trim().optional(),
  });

  try {
    const parsed = deleteSchema.parse(req.body ?? {});
    const targetId = req.params.id;

    if (targetId === req.user!.id) {
      res.status(400).json({ error: 'You cannot permanently delete your own account.' });
      return;
    }

    const pool = getPool();
    const client = await pool.connect();

    let deletedSummary: {
      deletedId: string;
      deletedStudentRef: string;
      targetEmail: string;
      targetRole: string;
      anonymizedPaymentsCount: number;
    };

    try {
      await client.query('BEGIN');

      const targetRes = await client.query<{
        id: string;
        email: string;
        full_name: string;
        role: string;
      }>(
        `SELECT id, email, full_name, role FROM users WHERE id = $1 FOR UPDATE`,
        [targetId]
      );

      const target = targetRes.rows[0];
      if (!target) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: 'Account not found.' });
        return;
      }

      if (target.role !== 'student' && req.user!.role !== 'super_admin') {
        await client.query('ROLLBACK');
        res.status(403).json({
          error: 'Only a Super Admin can permanently delete administrator accounts.',
        });
        return;
      }

      const confirmedByWord = parsed.confirmation?.toUpperCase() === 'DELETE';
      const confirmedByEmail =
        Boolean(parsed.confirmEmail) &&
        parsed.confirmEmail!.toLowerCase() === target.email.toLowerCase();

      if (!confirmedByWord && !confirmedByEmail) {
        await client.query('ROLLBACK');
        res.status(400).json({
          error: 'Explicit deletion confirmation is required (type DELETE or the exact account email).',
        });
        return;
      }

      if (target.role === 'super_admin') {
        const otherActiveSuperAdmins = await client.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count
           FROM users
           WHERE role = 'super_admin'
             AND is_active = TRUE
             AND account_status = 'active'
             AND id <> $1`,
          [targetId]
        );
        if ((otherActiveSuperAdmins.rows[0]?.count ?? 0) === 0) {
          await client.query('ROLLBACK');
          res.status(409).json({
            code: 'CANNOT_DELETE_LAST_SUPER_ADMIN',
            error: 'Cannot permanently delete the last active Super Admin account.',
          });
          return;
        }
      }

      const deletedStudentRef = `DEL-${target.id.slice(0, 8).toUpperCase()}`;

      // 1. Delete dependent personal academic records safely before anonymizing payments
      await client.query(`DELETE FROM course_registrations WHERE student_id = $1`, [targetId]);
      await client.query(`DELETE FROM exam_sessions WHERE user_id = $1`, [targetId]);
      await client.query(`DELETE FROM notification_reads WHERE user_id = $1`, [targetId]);
      await client.query(`DELETE FROM notifications WHERE recipient_user_id = $1`, [targetId]);

      // 2. Preserve financial ledger rows in anonymized form per retention policy
      const payAnonRes = await client.query(
        `UPDATE payments
         SET student_id = NULL,
             whatsapp_number = NULL,
             deleted_student_ref = $2,
             gateway_response = jsonb_strip_nulls(COALESCE(gateway_response, '{}'::jsonb) - 'metadata'),
             updated_at = NOW()
         WHERE student_id = $1`,
        [targetId, deletedStudentRef]
      );

      // 3. Remove personal user account record
      await client.query(`DELETE FROM users WHERE id = $1`, [targetId]);

      await client.query('COMMIT');

      deletedSummary = {
        deletedId: target.id,
        deletedStudentRef,
        targetEmail: target.email,
        targetRole: target.role,
        anonymizedPaymentsCount: payAnonRes.rowCount ?? 0,
      };
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.user.permanent_delete',
      entityType: 'user',
      entityId: deletedSummary.deletedId,
      metadata: {
        deletedStudentRef: deletedSummary.deletedStudentRef,
        deletedRole: deletedSummary.targetRole,
        anonymizedPaymentsCount: deletedSummary.anonymizedPaymentsCount,
      },
      ipAddress: req.ip,
    });

    res.json({
      deletedId: deletedSummary.deletedId,
      deletedStudentRef: deletedSummary.deletedStudentRef,
      anonymizedPaymentsCount: deletedSummary.anonymizedPaymentsCount,
      message: 'Account permanently deleted. Financial records retained in anonymized form.',
    });
  } catch (err) {
    handleApiError(res, err, 'permanently deleting account');
  }
});

router.post('/users/:id/notifications', async (req, res) => {
  try {
    const schema = z.object({
      title: z.string().trim().min(2, 'Notification title is required').max(180),
      message: z.string().trim().min(2, 'Notification message is required').max(3000),
    });
    const parsed = schema.parse(req.body);
    const targetId = req.params.id;

    const db = getDb();
    const [recipient] = await db
      .select({ id: users.id, fullName: users.fullName, email: users.email })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);

    if (!recipient) {
      res.status(404).json({ error: 'Student account not found.' });
      return;
    }

    const created = await createStudentNotification({
      recipientUserId: recipient.id,
      senderUserId: req.user!.id,
      senderName: req.user!.fullName,
      notificationType: 'admin_direct',
      title: parsed.title,
      message: parsed.message,
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.notification.send',
      entityType: 'notification',
      entityId: created?.id || null,
      metadata: {
        recipientUserId: recipient.id,
        recipientEmail: recipient.email,
        title: parsed.title,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      notification: created,
      message: `Notification sent to ${recipient.fullName}.`,
    });
  } catch (err) {
    handleApiError(res, err, 'sending student notification');
  }
});

router.get('/notifications', async (req, res) => {
  try {
    const pool = getPool();
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const type = typeof req.query.type === 'string' ? req.query.type.trim() : '';

    const clauses: string[] = [];
    const values: unknown[] = [];

    if (search) {
      values.push(`%${search}%`);
      const idx = values.length;
      clauses.push(
        `(LOWER(n.title) LIKE $${idx} OR LOWER(n.message) LIKE $${idx} OR LOWER(u.full_name) LIKE $${idx} OR LOWER(u.email) LIKE $${idx})`
      );
    }

    if (type && ['admin_direct', 'payment_success', 'system'].includes(type)) {
      values.push(type);
      clauses.push(`n.notification_type = $${values.length}`);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await pool.query<{
      id: string;
      recipientUserId: string;
      recipientName: string;
      recipientEmail: string;
      senderName: string;
      notificationType: 'admin_direct' | 'payment_success' | 'system';
      title: string;
      message: string;
      courseCode: string | null;
      courseTitle: string | null;
      actionLabel: string | null;
      actionUrl: string | null;
      isRead: boolean;
      readAt: Date | null;
      createdAt: Date;
    }>(
      `SELECT
         n.id,
         n.recipient_user_id AS "recipientUserId",
         u.full_name AS "recipientName",
         u.email AS "recipientEmail",
         n.sender_name AS "senderName",
         n.notification_type AS "notificationType",
         n.title,
         n.message,
         c.code AS "courseCode",
         c.title AS "courseTitle",
         n.action_label AS "actionLabel",
         n.action_url AS "actionUrl",
         (nr.id IS NOT NULL) AS "isRead",
         nr.read_at AS "readAt",
         n.created_at AS "createdAt"
       FROM notifications n
       INNER JOIN users u ON u.id = n.recipient_user_id
       LEFT JOIN courses c ON c.id = n.course_id
       LEFT JOIN notification_reads nr
         ON nr.notification_id = n.id AND nr.user_id = n.recipient_user_id
       ${whereSql}
       ORDER BY n.created_at DESC
       LIMIT 200`,
      values
    );

    res.json({ notifications: result.rows });
  } catch (err) {
    handleApiError(res, err, 'listing notifications');
  }
});

router.get('/results', async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: examSessions.id,
        userId: examSessions.userId,
        studentName: users.fullName,
        studentEmail: users.email,
        courseCode: courses.code,
        courseTitle: courses.title,
        scorePercentage: examSessions.scorePercentage,
        correctCount: examSessions.correctCount,
        totalQuestions: examSessions.totalQuestions,
        timeSpentSeconds: examSessions.timeSpentSeconds,
        submittedAt: examSessions.submittedAt,
      })
      .from(examSessions)
      .innerJoin(users, eq(examSessions.userId, users.id))
      .leftJoin(courses, eq(examSessions.courseId, courses.id))
      .where(eq(examSessions.status, 'submitted'))
      .orderBy(desc(examSessions.submittedAt))
      .limit(200);

    res.json({ results: rows });
  } catch (err) {
    handleApiError(res, err, 'listing student results');
  }
});

// Payment Inspection, Backup & Reset Management (Preserves users, registrations, exam sessions & results)
const TEST_PAYMENT_PREDICATE = `(
  LOWER(payment_reference) LIKE '%test%'
  OR LOWER(payment_reference) LIKE '%demo%'
  OR LOWER(payment_reference) LIKE '%seed%'
  OR COALESCE(gateway_response->>'domain', '') = 'test'
)`;

async function fetchPaymentResetPreviewAndBackups() {
  const pool = getPool();
  const [countsRes, backupsRes] = await Promise.all([
    pool.query<{
      totalPayments: number;
      successfulCount: number;
      liveSuccessfulCount: number;
      pendingCount: number;
      failedCount: number;
      refundedCount: number;
      testCount: number;
      testAndStaleCount: number;
      linkedRegistrationsCount: number;
      activeRegistrationsCount: number;
      webhookEventsCount: number;
    }>(`
      SELECT
        (SELECT COUNT(*)::int FROM payments) AS "totalPayments",
        (SELECT COUNT(*)::int FROM payments WHERE payment_status = 'successful') AS "successfulCount",
        (SELECT COUNT(*)::int FROM payments WHERE payment_status = 'successful' AND NOT ${TEST_PAYMENT_PREDICATE}) AS "liveSuccessfulCount",
        (SELECT COUNT(*)::int FROM payments WHERE payment_status = 'pending') AS "pendingCount",
        (SELECT COUNT(*)::int FROM payments WHERE payment_status = 'failed') AS "failedCount",
        (SELECT COUNT(*)::int FROM payments WHERE payment_status = 'refunded') AS "refundedCount",
        (SELECT COUNT(*)::int FROM payments WHERE ${TEST_PAYMENT_PREDICATE}) AS "testCount",
        (SELECT COUNT(*)::int FROM payments WHERE ${TEST_PAYMENT_PREDICATE} OR payment_status IN ('pending', 'failed')) AS "testAndStaleCount",
        (SELECT COUNT(*)::int FROM course_registrations WHERE payment_id IS NOT NULL) AS "linkedRegistrationsCount",
        (SELECT COUNT(*)::int FROM course_registrations WHERE registration_status = 'active') AS "activeRegistrationsCount",
        (SELECT COUNT(*)::int FROM payment_webhook_events) AS "webhookEventsCount"
    `),
    pool.query<{
      id: string;
      backupLabel: string;
      resetScope: string;
      totalPaymentsCount: number;
      successfulCount: number;
      pendingCount: number;
      failedCount: number;
      testCount: number;
      createdByName: string | null;
      createdAt: Date;
    }>(`
      SELECT
        pb.id,
        pb.backup_label AS "backupLabel",
        pb.reset_scope AS "resetScope",
        pb.total_payments_count AS "totalPaymentsCount",
        pb.successful_count AS "successfulCount",
        pb.pending_count AS "pendingCount",
        pb.failed_count AS "failedCount",
        pb.test_count AS "testCount",
        u.full_name AS "createdByName",
        pb.created_at AS "createdAt"
      FROM payment_backups pb
      LEFT JOIN users u ON u.id = pb.created_by
      ORDER BY pb.created_at DESC
      LIMIT 15
    `),
  ]);

  return {
    preview: countsRes.rows[0] ?? {
      totalPayments: 0,
      successfulCount: 0,
      liveSuccessfulCount: 0,
      pendingCount: 0,
      failedCount: 0,
      refundedCount: 0,
      testCount: 0,
      testAndStaleCount: 0,
      linkedRegistrationsCount: 0,
      activeRegistrationsCount: 0,
      webhookEventsCount: 0,
    },
    backups: backupsRes.rows,
  };
}

async function createPaymentBackupSnapshot(params: {
  actorUserId: string;
  label: string;
  scope: 'manual_snapshot' | 'test_and_stale' | 'full_production_reset';
}) {
  const pool = getPool();
  const [payRows, regRows, webhookRows] = await Promise.all([
    pool.query(`SELECT * FROM payments ORDER BY created_at DESC`),
    pool.query(`SELECT * FROM course_registrations ORDER BY registered_at DESC`),
    pool.query(`SELECT * FROM payment_webhook_events ORDER BY received_at DESC LIMIT 1000`),
  ]);

  const rows = payRows.rows as Array<{
    payment_status: string;
    payment_reference: string;
    gateway_response?: Record<string, unknown> | null;
  }>;

  let successfulCount = 0;
  let pendingCount = 0;
  let failedCount = 0;
  let testCount = 0;

  for (const r of rows) {
    if (r.payment_status === 'successful') successfulCount += 1;
    else if (r.payment_status === 'pending') pendingCount += 1;
    else if (r.payment_status === 'failed') failedCount += 1;

    const refLower = String(r.payment_reference || '').toLowerCase();
    const domain = String(r.gateway_response?.domain || '').toLowerCase();
    if (
      refLower.includes('test') ||
      refLower.includes('demo') ||
      refLower.includes('seed') ||
      domain === 'test'
    ) {
      testCount += 1;
    }
  }

  const db = getDb();
  const [inserted] = await db
    .insert(paymentBackups)
    .values({
      backupLabel: params.label,
      resetScope: params.scope,
      totalPaymentsCount: rows.length,
      successfulCount,
      pendingCount,
      failedCount,
      testCount,
      snapshotPayload: {
        exportedAt: new Date().toISOString(),
        payments: payRows.rows,
        courseRegistrations: regRows.rows,
        paymentWebhookEvents: webhookRows.rows,
      },
      createdBy: params.actorUserId,
    })
    .returning({
      id: paymentBackups.id,
      backupLabel: paymentBackups.backupLabel,
      resetScope: paymentBackups.resetScope,
      totalPaymentsCount: paymentBackups.totalPaymentsCount,
      successfulCount: paymentBackups.successfulCount,
      pendingCount: paymentBackups.pendingCount,
      failedCount: paymentBackups.failedCount,
      testCount: paymentBackups.testCount,
      createdAt: paymentBackups.createdAt,
    });

  return inserted;
}

router.get('/payments/reset-preview', async (_req, res) => {
  try {
    const data = await fetchPaymentResetPreviewAndBackups();
    res.json(data);
  } catch (err) {
    handleApiError(res, err, 'fetching payment reset preview');
  }
});

router.post('/payments/backup', async (req, res) => {
  try {
    const bodySchema = z.object({
      label: z.string().trim().min(2).max(120).optional(),
    });
    const parsed = bodySchema.parse(req.body ?? {});
    const label =
      parsed.label ||
      `Payment Backup ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

    const backup = await createPaymentBackupSnapshot({
      actorUserId: req.user!.id,
      label,
      scope: 'manual_snapshot',
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.payments.backup_create',
      entityType: 'payment_backup',
      entityId: backup.id,
      metadata: {
        backupLabel: backup.backupLabel,
        totalPaymentsCount: backup.totalPaymentsCount,
      },
      ipAddress: req.ip,
    });

    const data = await fetchPaymentResetPreviewAndBackups();
    res.status(201).json({
      backup,
      ...data,
      message: `Backup created with ${backup.totalPaymentsCount} payment records.`,
    });
  } catch (err) {
    handleApiError(res, err, 'creating payment backup');
  }
});

router.get('/payments/backup/:id/export', async (req, res) => {
  try {
    const db = getDb();
    const [backup] = await db
      .select()
      .from(paymentBackups)
      .where(eq(paymentBackups.id, req.params.id))
      .limit(1);

    if (!backup) {
      res.status(404).json({ error: 'Payment backup record not found.' });
      return;
    }

    const safeDate = new Date(backup.createdAt).toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="acadet-payments-backup-${safeDate}-${backup.id.slice(0, 8)}.json"`
    );
    res.send(
      JSON.stringify(
        {
          id: backup.id,
          backupLabel: backup.backupLabel,
          resetScope: backup.resetScope,
          createdAt: backup.createdAt,
          counts: {
            totalPaymentsCount: backup.totalPaymentsCount,
            successfulCount: backup.successfulCount,
            pendingCount: backup.pendingCount,
            failedCount: backup.failedCount,
            testCount: backup.testCount,
          },
          snapshot: backup.snapshotPayload,
        },
        null,
        2
      )
    );
  } catch (err) {
    handleApiError(res, err, 'exporting payment backup');
  }
});

router.post('/payments/reset-test', requireRole('super_admin'), async (req, res) => {
  try {
    const backup = await createPaymentBackupSnapshot({
      actorUserId: req.user!.id,
      label: `Auto-Backup before Test/Stale Cleanup (${new Date().toISOString().slice(0, 10)})`,
      scope: 'test_and_stale',
    });

    const pool = getPool();
    const client = await pool.connect();
    let removedCount = 0;

    try {
      await client.query('BEGIN');

      const targetRes = await client.query<{ id: string; payment_reference: string }>(
        `SELECT id, payment_reference FROM payments
         WHERE ${TEST_PAYMENT_PREDICATE} OR payment_status IN ('pending', 'failed')`
      );
      const targetIds = targetRes.rows.map((r) => r.id);
      const targetRefs = targetRes.rows.map((r) => r.payment_reference);

      if (targetIds.length > 0) {
        // Preserve any active course_registrations before clearing stale payment rows
        await client.query(
          `UPDATE course_registrations cr
           SET preserved_payment_ref = COALESCE(cr.preserved_payment_ref, p.payment_reference),
               preserved_amount_paid = COALESCE(cr.preserved_amount_paid, p.total_amount_charged, p.amount),
               payment_id = NULL,
               updated_at = NOW()
           FROM payments p
           WHERE cr.payment_id = p.id
             AND p.id = ANY($1::uuid[])`,
          [targetIds]
        );

        await client.query(
          `UPDATE notifications SET payment_id = NULL WHERE payment_id = ANY($1::uuid[])`,
          [targetIds]
        );

        if (targetRefs.length > 0) {
          await client.query(
            `DELETE FROM payment_webhook_events WHERE payment_reference = ANY($1::text[])`,
            [targetRefs]
          );
        }

        const delRes = await client.query(
          `DELETE FROM payments WHERE id = ANY($1::uuid[])`,
          [targetIds]
        );
        removedCount = delRes.rowCount ?? 0;
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.payments.reset_test',
      entityType: 'payments',
      entityId: backup.id,
      metadata: {
        backupId: backup.id,
        removedCount,
        preservedStudentsAndRegistrations: true,
      },
      ipAddress: req.ip,
    });

    const data = await fetchPaymentResetPreviewAndBackups();
    res.json({
      removedCount,
      backupId: backup.id,
      ...data,
      message: `Removed ${removedCount} test, pending, and failed transactions. Live successful receipts, student accounts, exam sessions, and course registrations remain intact.`,
    });
  } catch (err) {
    handleApiError(res, err, 'cleaning test and stale payment transactions');
  }
});

router.post('/payments/reset-all', requireRole('super_admin'), async (req, res) => {
  try {
    const schema = z.object({
      backupId: z.string().uuid('A verified backup ID is required before full payment reset.'),
      acknowledgeConsequences: z.literal(true),
      confirmation: z.literal('RESET ALL PAYMENTS'),
    });
    const parsed = schema.parse(req.body ?? {});

    const db = getDb();
    const [verifiedBackup] = await db
      .select({
        id: paymentBackups.id,
        backupLabel: paymentBackups.backupLabel,
        createdAt: paymentBackups.createdAt,
      })
      .from(paymentBackups)
      .where(eq(paymentBackups.id, parsed.backupId))
      .limit(1);

    if (!verifiedBackup) {
      res.status(400).json({
        error: 'Verified backup not found. Create a payment backup first before confirming a full reset.',
      });
      return;
    }

    const pool = getPool();
    const client = await pool.connect();
    let deletedPaymentsCount = 0;
    let preservedRegistrationsCount = 0;

    try {
      await client.query('BEGIN');

      const preserveRes = await client.query(
        `UPDATE course_registrations cr
         SET preserved_payment_ref = COALESCE(cr.preserved_payment_ref, p.payment_reference),
             preserved_amount_paid = COALESCE(cr.preserved_amount_paid, p.total_amount_charged, p.amount),
             payment_id = NULL,
             updated_at = NOW()
         FROM payments p
         WHERE cr.payment_id = p.id`
      );
      preservedRegistrationsCount = preserveRes.rowCount ?? 0;

      await client.query(`UPDATE notifications SET payment_id = NULL WHERE payment_id IS NOT NULL`);
      await client.query(`DELETE FROM payment_webhook_events`);
      const delRes = await client.query(`DELETE FROM payments`);
      deletedPaymentsCount = delRes.rowCount ?? 0;

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.payments.reset_all',
      entityType: 'payments',
      entityId: verifiedBackup.id,
      metadata: {
        verifiedBackupId: verifiedBackup.id,
        deletedPaymentsCount,
        preservedRegistrationsCount,
        preservedStudentsAndExams: true,
      },
      ipAddress: req.ip,
    });

    const data = await fetchPaymentResetPreviewAndBackups();
    res.json({
      deletedPaymentsCount,
      preservedRegistrationsCount,
      verifiedBackupId: verifiedBackup.id,
      ...data,
      message: `Cleared ${deletedPaymentsCount} payment records for a fresh start using backup "${verifiedBackup.backupLabel}". All student accounts, exam history, results, and ${preservedRegistrationsCount} course registrations were preserved.`,
    });
  } catch (err) {
    handleApiError(res, err, 'performing Super Admin payment reset');
  }
});

// Super Admin Site Branding, SEO & Founder Profile Management
const brandingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const socialLinksSchema = z
  .object({
    facebook: z.string().trim().max(400).optional(),
    twitter: z.string().trim().max(400).optional(),
    instagram: z.string().trim().max(400).optional(),
    youtube: z.string().trim().max(400).optional(),
    linkedin: z.string().trim().max(400).optional(),
    whatsapp: z.string().trim().max(400).optional(),
    tiktok: z.string().trim().max(400).optional(),
    website: z.string().trim().max(400).optional(),
  })
  .optional();

router.get('/branding', async (_req, res) => {
  try {
    const [{ branding, founder }, resetState] = await Promise.all([
      getPublicBrandingAndFounder(),
      fetchPaymentResetPreviewAndBackups(),
    ]);
    res.json({
      branding,
      founder,
      recentBackups: resetState.backups,
    });
  } catch (err) {
    handleApiError(res, err, 'fetching branding configuration');
  }
});

router.patch('/branding', requireRole('super_admin'), async (req, res) => {
  try {
    const schema = z.object({
      siteName: z.string().trim().min(2).max(120).optional(),
      tagline: z.string().trim().min(2).max(160).optional(),
      siteDescription: z.string().trim().min(10).max(2000).optional(),
      seoTitle: z.string().trim().min(5).max(160).optional(),
      seoDescription: z.string().trim().min(10).max(400).optional(),
      seoKeywords: z.string().trim().min(5).max(500).optional(),
      logoUrl: z.string().trim().max(500).optional(),
      faviconUrl: z.string().trim().max(500).optional(),
      contactEmail: z.string().trim().email().max(160).optional(),
      contactPhone: z.string().trim().max(50).nullable().optional(),
      contactWhatsapp: z.string().trim().max(250).nullable().optional(),
      socialLinks: socialLinksSchema,
    });

    const parsed = schema.parse(req.body ?? {});
    const updateValues: Record<string, unknown> = {
      updatedBy: req.user!.id,
      updatedAt: new Date(),
    };

    if (parsed.siteName !== undefined) updateValues.siteName = parsed.siteName;
    if (parsed.tagline !== undefined) updateValues.tagline = parsed.tagline;
    if (parsed.siteDescription !== undefined) updateValues.siteDescription = parsed.siteDescription;
    if (parsed.seoTitle !== undefined) updateValues.seoTitle = parsed.seoTitle;
    if (parsed.seoDescription !== undefined) updateValues.seoDescription = parsed.seoDescription;
    if (parsed.seoKeywords !== undefined) updateValues.seoKeywords = parsed.seoKeywords;
    if (parsed.logoUrl !== undefined) {
      const safeLogo = sanitizePublicUrl(parsed.logoUrl);
      if (!safeLogo) {
        res.status(400).json({ error: 'Logo URL must be a valid https://, http://, or relative / path.' });
        return;
      }
      updateValues.logoUrl = safeLogo;
    }
    if (parsed.faviconUrl !== undefined) {
      const safeFav = sanitizePublicUrl(parsed.faviconUrl);
      if (!safeFav) {
        res.status(400).json({ error: 'Favicon URL must be a valid https://, http://, or relative / path.' });
        return;
      }
      updateValues.faviconUrl = safeFav;
    }
    if (parsed.contactEmail !== undefined) updateValues.contactEmail = parsed.contactEmail;
    if (parsed.contactPhone !== undefined) updateValues.contactPhone = parsed.contactPhone || null;
    if (parsed.contactWhatsapp !== undefined) {
      updateValues.contactWhatsapp = parsed.contactWhatsapp || null;
    }
    if (parsed.socialLinks !== undefined) {
      updateValues.socialLinks = sanitizeSocialLinks(parsed.socialLinks);
    }

    const db = getDb();
    await db
      .insert(siteBranding)
      .values({ id: 'default' })
      .onConflictDoNothing();

    await db
      .update(siteBranding)
      .set(updateValues)
      .where(eq(siteBranding.id, 'default'));

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.branding.update',
      entityType: 'site_branding',
      entityId: 'default',
      metadata: { updatedFields: Object.keys(parsed) },
      ipAddress: req.ip,
    });

    const latest = await getPublicBrandingAndFounder();
    res.json({
      branding: latest.branding,
      founder: latest.founder,
      message: 'Official branding & SEO settings saved.',
    });
  } catch (err) {
    handleApiError(res, err, 'updating site branding');
  }
});

router.patch('/founder', requireRole('super_admin'), async (req, res) => {
  try {
    const schema = z.object({
      fullName: z.string().trim().min(2).max(160).optional(),
      positionTitle: z.string().trim().min(2).max(160).optional(),
      biography: z.string().trim().min(10).max(5000).optional(),
      founderMessage: z.string().trim().min(10).max(5000).optional(),
      visionStatement: z.string().trim().min(5).max(3000).optional(),
      missionStatement: z.string().trim().min(5).max(3000).optional(),
      backgroundStory: z.string().trim().min(5).max(5000).optional(),
      photoUrl: z.string().trim().max(500).nullable().optional(),
      socialLinks: socialLinksSchema,
    });

    const parsed = schema.parse(req.body ?? {});
    const updateValues: Record<string, unknown> = {
      updatedBy: req.user!.id,
      updatedAt: new Date(),
    };

    if (parsed.fullName !== undefined) updateValues.fullName = parsed.fullName;
    if (parsed.positionTitle !== undefined) updateValues.positionTitle = parsed.positionTitle;
    if (parsed.biography !== undefined) updateValues.biography = parsed.biography;
    if (parsed.founderMessage !== undefined) updateValues.founderMessage = parsed.founderMessage;
    if (parsed.visionStatement !== undefined) updateValues.visionStatement = parsed.visionStatement;
    if (parsed.missionStatement !== undefined) updateValues.missionStatement = parsed.missionStatement;
    if (parsed.backgroundStory !== undefined) updateValues.backgroundStory = parsed.backgroundStory;
    if (parsed.photoUrl !== undefined) {
      if (!parsed.photoUrl) {
        updateValues.photoUrl = null;
        updateValues.photoObjectKey = null;
      } else {
        const safePhoto = sanitizePublicUrl(parsed.photoUrl);
        if (!safePhoto) {
          res.status(400).json({ error: 'Photo URL must be a valid https://, http://, or relative / path.' });
          return;
        }
        updateValues.photoUrl = safePhoto;
      }
    }
    if (parsed.socialLinks !== undefined) {
      updateValues.socialLinks = sanitizeSocialLinks(parsed.socialLinks);
    }

    const db = getDb();
    await db
      .insert(founderProfile)
      .values({ id: 'default' })
      .onConflictDoNothing();

    await db
      .update(founderProfile)
      .set(updateValues)
      .where(eq(founderProfile.id, 'default'));

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.founder.update',
      entityType: 'founder_profile',
      entityId: 'default',
      metadata: { updatedFields: Object.keys(parsed) },
      ipAddress: req.ip,
    });

    const latest = await getPublicBrandingAndFounder();
    res.json({
      branding: latest.branding,
      founder: latest.founder,
      message: 'Founder profile updated and published.',
    });
  } catch (err) {
    handleApiError(res, err, 'updating founder profile');
  }
});

router.post(
  '/branding/upload',
  requireRole('super_admin'),
  brandingUpload.single('file') as unknown as RequestHandler,
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'An image file (PNG, JPG, WEBP, SVG, or ICO) is required.' });
        return;
      }

      const slotSchema = z.object({
        slot: z.enum(['logo', 'favicon', 'founder-photo']),
      });
      const { slot } = slotSchema.parse(req.body ?? {});

      const mime = (file.mimetype || '').toLowerCase();
      const allowedMimes = [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/webp',
        'image/svg+xml',
        'image/x-icon',
        'image/vnd.microsoft.icon',
      ];
      if (!allowedMimes.includes(mime)) {
        res.status(400).json({
          error: 'Unsupported image format. Please upload PNG, JPG, WEBP, SVG, or ICO.',
        });
        return;
      }

      const ext =
        path.extname(file.originalname || '').toLowerCase().replace(/[^.a-z0-9]/g, '') || '.png';
      const candidateObjectKey = `branding/${slot}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
      let savedObjectKey: string | null = null;
      const db = getDb();

      if (isObjectStorageConfigured()) {
        try {
          await uploadObjectBuffer({
            objectKey: candidateObjectKey,
            body: file.buffer,
            contentType: file.mimetype || 'image/png',
          });
          savedObjectKey = candidateObjectKey;
        } catch (storageErr) {
          console.warn(
            `[Branding Upload Warning:${slot}] S3 upload failed, falling back to PostgreSQL BYTEA:`,
            storageErr
          );
          savedObjectKey = null;
        }
      }

      if (!savedObjectKey) {
        const cleanName = path.basename(file.originalname || `${slot}${ext}`);
        await db
          .insert(brandingAssetBinaries)
          .values({
            slot,
            mimeType: file.mimetype || 'image/png',
            fileName: cleanName,
            fileSizeBytes: file.size,
            fileData: file.buffer,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: brandingAssetBinaries.slot,
            set: {
              mimeType: file.mimetype || 'image/png',
              fileName: cleanName,
              fileSizeBytes: file.size,
              fileData: file.buffer,
              updatedAt: new Date(),
            },
          });
      }

      const publicUrl = `/api/public/assets/${slot}?v=${Date.now()}`;

      if (slot === 'founder-photo') {
        await db.insert(founderProfile).values({ id: 'default' }).onConflictDoNothing();
        await db
          .update(founderProfile)
          .set({
            photoUrl: publicUrl,
            photoObjectKey: savedObjectKey,
            updatedBy: req.user!.id,
            updatedAt: new Date(),
          })
          .where(eq(founderProfile.id, 'default'));
      } else {
        await db.insert(siteBranding).values({ id: 'default' }).onConflictDoNothing();
        await db
          .update(siteBranding)
          .set({
            ...(slot === 'logo'
              ? { logoUrl: publicUrl, logoObjectKey: savedObjectKey }
              : { faviconUrl: publicUrl, faviconObjectKey: savedObjectKey }),
            updatedBy: req.user!.id,
            updatedAt: new Date(),
          })
          .where(eq(siteBranding.id, 'default'));
      }

      await writeAuditLog({
        actorUserId: req.user!.id,
        action: 'admin.branding.upload',
        entityType: slot === 'founder-photo' ? 'founder_profile' : 'site_branding',
        entityId: slot,
        metadata: {
          objectKey: savedObjectKey,
          storageBackend: savedObjectKey ? 's3' : 'postgres',
          publicUrl,
        },
        ipAddress: req.ip,
      });

      const latest = await getPublicBrandingAndFounder();
      res.status(201).json({
        slot,
        url: publicUrl,
        branding: latest.branding,
        founder: latest.founder,
        message: `Uploaded new ${slot.replace('-', ' ')} asset.`,
      });
    } catch (err) {
      handleApiError(res, err, 'uploading branding asset');
    }
  }
);

router.get('/audit-logs', async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: auditLogs.id,
        actorUserId: auditLogs.actorUserId,
        actorName: users.fullName,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);

    res.json({ logs: rows });
  } catch (err) {
    handleApiError(res, err, 'listing audit logs');
  }
});

// Admin Payment Verification Logs & Controlled Paystack-Backed Resolution
router.get('/verification-logs', async (req, res) => {
  try {
    const pool = getPool();
    const resultFilter =
      typeof req.query.result === 'string' ? req.query.result.trim() : '';
    const courseId =
      typeof req.query.courseId === 'string' ? req.query.courseId.trim() : '';
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

    const clauses: string[] = [];
    const values: unknown[] = [];

    if (resultFilter) {
      values.push(resultFilter);
      clauses.push(`pvl.verification_result = $${values.length}`);
    }
    if (courseId) {
      values.push(courseId);
      clauses.push(`pvl.course_id = $${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      const idx = values.length;
      clauses.push(
        `(LOWER(pvl.payment_reference) LIKE $${idx}
          OR LOWER(COALESCE(u.full_name, '')) LIKE $${idx}
          OR LOWER(COALESCE(u.email, '')) LIKE $${idx}
          OR LOWER(COALESCE(pvl.paystack_customer_email, '')) LIKE $${idx}
          OR LOWER(COALESCE(c.code, '')) LIKE $${idx}
          OR LOWER(COALESCE(c.title, '')) LIKE $${idx})`
      );
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const [logsRes, summaryRes] = await Promise.all([
      pool.query<{
        id: string;
        studentId: string | null;
        studentName: string | null;
        studentEmail: string | null;
        paymentId: string | null;
        courseId: string | null;
        courseCode: string | null;
        courseTitle: string | null;
        paymentReference: string;
        verificationSource: string;
        verificationResult: string;
        paymentStatus: string | null;
        registrationStatus: string | null;
        paystackStatus: string | null;
        paystackAmountKobo: number | null;
        paystackCurrency: string | null;
        paystackCustomerEmail: string | null;
        paystackTransactionId: string | null;
        paystackPayload: Record<string, unknown>;
        reason: string;
        resolvedBy: string | null;
        resolvedByName: string | null;
        resolvedAt: Date | null;
        resolutionNote: string | null;
        createdAt: Date;
      }>(
        `SELECT
           pvl.id,
           pvl.student_id AS "studentId",
           u.full_name AS "studentName",
           u.email AS "studentEmail",
           pvl.payment_id AS "paymentId",
           pvl.course_id AS "courseId",
           c.code AS "courseCode",
           c.title AS "courseTitle",
           pvl.payment_reference AS "paymentReference",
           pvl.verification_source AS "verificationSource",
           pvl.verification_result AS "verificationResult",
           pvl.payment_status AS "paymentStatus",
           pvl.registration_status AS "registrationStatus",
           pvl.paystack_status AS "paystackStatus",
           pvl.paystack_amount_kobo AS "paystackAmountKobo",
           pvl.paystack_currency AS "paystackCurrency",
           pvl.paystack_customer_email AS "paystackCustomerEmail",
           pvl.paystack_transaction_id AS "paystackTransactionId",
           pvl.paystack_payload AS "paystackPayload",
           pvl.reason,
           pvl.resolved_by AS "resolvedBy",
           ru.full_name AS "resolvedByName",
           pvl.resolved_at AS "resolvedAt",
           pvl.resolution_note AS "resolutionNote",
           pvl.created_at AS "createdAt"
         FROM payment_verification_logs pvl
         LEFT JOIN users u ON u.id = pvl.student_id
         LEFT JOIN courses c ON c.id = pvl.course_id
         LEFT JOIN users ru ON ru.id = pvl.resolved_by
         ${whereSql}
         ORDER BY pvl.created_at DESC
         LIMIT 300`,
        values
      ),
      pool.query<{ verificationResult: string; count: number }>(
        `SELECT verification_result AS "verificationResult", COUNT(*)::int AS count
         FROM payment_verification_logs
         GROUP BY verification_result`
      ),
    ]);

    const counts: Record<string, number> = {};
    let total = 0;
    for (const row of summaryRes.rows) {
      counts[row.verificationResult] = row.count;
      total += row.count;
    }

    res.json({
      logs: logsRes.rows,
      summary: { total, counts },
    });
  } catch (err) {
    handleApiError(res, err, 'listing payment verification logs');
  }
});

router.post('/verification-logs/:id/reverify', async (req, res) => {
  try {
    const pool = getPool();
    const logRes = await pool.query<{
      id: string;
      payment_reference: string;
    }>(
      `SELECT id, payment_reference FROM payment_verification_logs WHERE id = $1 LIMIT 1`,
      [req.params.id]
    );
    const logRow = logRes.rows[0];
    if (!logRow) {
      res.status(404).json({ error: 'Verification log entry not found.' });
      return;
    }

    try {
      const pData = await verifyPaystackTransaction(logRow.payment_reference);
      await pool.query(
        `UPDATE payment_verification_logs
         SET paystack_status = $2,
             paystack_amount_kobo = $3,
             paystack_currency = $4,
             paystack_customer_email = $5,
             paystack_transaction_id = $6,
             paystack_payload = $7::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [
          logRow.id,
          String(pData.status || ''),
          Number.isFinite(Number(pData.amount)) ? Math.round(Number(pData.amount)) : null,
          pData.currency ? String(pData.currency).toUpperCase() : null,
          pData.customer?.email ? String(pData.customer.email).trim().toLowerCase() : null,
          pData.id !== undefined && pData.id !== null ? String(pData.id) : null,
          JSON.stringify(pData),
        ]
      );

      res.json({
        logId: logRow.id,
        paystackStatus: String(pData.status || ''),
        paystackAmountKobo: Number(pData.amount || 0),
        paystackCurrency: String(pData.currency || 'NGN').toUpperCase(),
        paystackCustomerEmail: pData.customer?.email || null,
        paystackTransactionId: pData.id !== undefined && pData.id !== null ? String(pData.id) : null,
        paystackPayload: pData,
        message: `Live Paystack status for ${logRow.payment_reference}: ${String(pData.status || 'unknown').toUpperCase()}.`,
      });
    } catch (gwErr) {
      if (gwErr instanceof PaystackReferenceNotFoundError) {
        await pool.query(
          `UPDATE payment_verification_logs
           SET paystack_status = 'not_found',
               updated_at = NOW()
           WHERE id = $1`,
          [logRow.id]
        );
        res.json({
          logId: logRow.id,
          paystackStatus: 'not_found',
          paystackAmountKobo: null,
          paystackCurrency: null,
          paystackCustomerEmail: null,
          paystackTransactionId: null,
          paystackPayload: {},
          message: `Paystack has no transaction record for reference ${logRow.payment_reference}.`,
        });
        return;
      }
      throw gwErr;
    }
  } catch (err) {
    if (err instanceof PaystackNotConfiguredError) {
      res.status(503).json({ error: err.message, code: 'PAYSTACK_NOT_CONFIGURED' });
      return;
    }
    if (err instanceof PaystackGatewayError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    handleApiError(res, err, 're-querying Paystack for verification log');
  }
});

router.post('/verification-logs/:id/resolve', async (req, res) => {
  try {
    const schema = z.object({
      action: z.enum(['approve_activate', 'reject']),
      studentId: z.string().uuid().optional(),
      courseId: z.string().uuid().optional(),
      resolutionNote: z
        .string()
        .trim()
        .min(3, 'Please provide a brief resolution note explaining the review outcome.')
        .max(1000),
      reverifyLive: z.boolean().optional(),
    });
    const parsed = schema.parse(req.body ?? {});

    const resolved = await resolveAdminVerificationLog({
      logId: req.params.id,
      action: parsed.action,
      studentId: parsed.studentId,
      courseId: parsed.courseId,
      resolutionNote: parsed.resolutionNote,
      adminUserId: req.user!.id,
      ipAddress: req.ip,
      reverifyLiveWithPaystack: parsed.reverifyLive,
    });

    res.json(resolved);
  } catch (err) {
    if (err instanceof PaystackNotConfiguredError) {
      res.status(503).json({ error: err.message, code: 'PAYSTACK_NOT_CONFIGURED' });
      return;
    }
    if (err instanceof PaystackGatewayError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    if (err instanceof PaymentValidationError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    handleApiError(res, err, 'resolving payment verification log');
  }
});

router.get('/email/status', async (req, res) => {
  try {
    const verify = req.query.verify === 'true';
    const statusOverview = await getAdminEmailStatusOverview(verify);
    res.json(statusOverview);
  } catch (err) {
    handleApiError(res, err, 'fetching email and recovery diagnostics');
  }
});

router.post('/email/test-connection', async (req, res) => {
  try {
    const emailService = await verifyEmailServiceConnection();
    const overview = await getAdminEmailStatusOverview(false);
    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.email_connection_tested',
      entityType: 'system',
      entityId: 'resend',
      metadata: {
        provider: 'resend',
        configured: emailService.configured,
        connectionStatus: emailService.connectionStatus,
      },
      ipAddress: req.ip,
    });
    res.json({
      ok: emailService.connectionStatus === 'connected',
      ...(emailService.scopeNote ? { scopeNote: emailService.scopeNote } : {}),
      ...overview,
    });
  } catch (err) {
    handleApiError(res, err, 'testing Resend email API connection');
  }
});

router.post('/email/send-test', async (req, res) => {
  try {
    const schema = z.object({
      toEmail: z.string().trim().email('Please enter a valid recipient email address.').optional(),
    });
    const parsed = schema.parse(req.body ?? {});
    const recipient = parsed.toEmail || req.user!.email;

    const sendResult = await sendAdminTestEmail({
      adminUserId: req.user!.id,
      toEmail: recipient,
      adminName: req.user!.fullName,
      requestBaseUrl: resolveBaseUrl(req),
    });

    const overview = await getAdminEmailStatusOverview(false);

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.email_test_dispatched',
      entityType: 'system',
      entityId: 'resend',
      metadata: {
        provider: 'resend',
        recipientEmail: recipient,
        deliveryStatus: sendResult.status,
        deliveredConfirmed: sendResult.deliveredConfirmed,
        providerMessageUuid: sendResult.providerMessageUuid ?? null,
      },
      ipAddress: req.ip,
    });

    if (!sendResult.sent) {
      res.status(503).json({
        error: sendResult.error || 'Failed to submit Resend diagnostic email.',
        ...overview,
      });
      return;
    }

    const message = sendResult.deliveredConfirmed
      ? `Resend confirmed delivery of the test email to ${recipient} (status: delivered).`
      : `Resend accepted the test email for ${recipient} (status: ${sendResult.status}). Check your recipient inbox (and spam folder) or Resend Logs to confirm final receipt.`;

    res.json({
      ok: true,
      accepted: sendResult.accepted,
      deliveredConfirmed: sendResult.deliveredConfirmed,
      deliveryStatus: sendResult.status,
      message,
      ...overview,
    });
  } catch (err) {
    handleApiError(res, err, 'sending test email');
  }
});

// GST 111 ONLY: Admin-Controlled Manual Subscription Activation & Deactivation
router.get('/gst111/students', async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim() : 'all';
    const statusFilter = (
      ['all', 'active', 'locked', 'admin_manual'].includes(rawStatus) ? rawStatus : 'all'
    ) as 'all' | 'active' | 'locked' | 'admin_manual';

    const payload = await listGst111StudentStatuses({
      search,
      statusFilter,
    });
    res.json(payload);
  } catch (err) {
    handleApiError(res, err, 'listing GST 111 manual subscription statuses');
  }
});

router.get('/gst111/students/:studentId/history', async (req, res) => {
  try {
    const studentId = z.string().uuid('Valid studentId is required').parse(req.params.studentId);
    const history = await getStudentGst111History(studentId);
    res.json({ history });
  } catch (err) {
    handleApiError(res, err, 'fetching GST 111 student activation history');
  }
});

router.post('/gst111/activate', async (req, res) => {
  try {
    const schema = z.object({
      studentId: z.string().uuid('Valid studentId is required'),
      courseId: z.string().uuid().optional(),
      courseCode: z.string().trim().max(40).optional(),
      note: z.string().trim().max(500).optional(),
    });
    const parsed = schema.parse(req.body ?? {});

    const outcome = await activateGst111Manual({
      studentId: parsed.studentId,
      requestedCourseId: parsed.courseId,
      requestedCourseCode: parsed.courseCode,
      note: parsed.note,
      admin: {
        id: req.user!.id,
        fullName: req.user!.fullName,
        email: req.user!.email,
      },
      ipAddress: req.ip,
    });

    res.status(201).json(outcome);
  } catch (err) {
    if (err instanceof Gst111RestrictionError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    handleApiError(res, err, 'manually activating GST 111 subscription');
  }
});

router.post('/gst111/deactivate', async (req, res) => {
  try {
    const schema = z.object({
      studentId: z.string().uuid('Valid studentId is required'),
      courseId: z.string().uuid().optional(),
      courseCode: z.string().trim().max(40).optional(),
      reason: z.string().trim().max(500).optional(),
    });
    const parsed = schema.parse(req.body ?? {});

    const outcome = await deactivateGst111Manual({
      studentId: parsed.studentId,
      requestedCourseId: parsed.courseId,
      requestedCourseCode: parsed.courseCode,
      reason: parsed.reason,
      admin: {
        id: req.user!.id,
        fullName: req.user!.fullName,
        email: req.user!.email,
      },
      ipAddress: req.ip,
    });

    res.json(outcome);
  } catch (err) {
    if (err instanceof Gst111RestrictionError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    handleApiError(res, err, 'manually deactivating GST 111 subscription');
  }
});

export default router;
