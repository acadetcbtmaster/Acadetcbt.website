import { GoogleGenAI, Type } from '@google/genai';
import { desc, eq, sql } from 'drizzle-orm';
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { getDb, getPool } from '../../db/index.js';
import {
  announcements,
  auditLogs,
  courses,
  examSessions,
  payments,
  questions,
  studyMaterials,
  users,
} from '../../db/schema.js';
import { writeAuditLog } from '../lib/audit.js';
import { sanitizeUser } from '../lib/jwt.js';
import {
  buildMaterialObjectKey,
  deleteObjectKey,
  ObjectStorageNotConfiguredError,
  uploadObjectBuffer,
} from '../lib/objectStorage.js';
import {
  PaymentValidationError,
  settlePaystackTransaction,
} from '../lib/paymentSettlement.js';
import {
  PaystackGatewayError,
  PaystackNotConfiguredError,
  verifyPaystackTransaction,
} from '../lib/paystack.js';
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

router.use(requireAuth, requireRole('admin', 'super_admin'));

const courseCreateSchema = z.object({
  code: z.string().trim().min(2).max(30),
  title: z.string().trim().min(2).max(160),
  level: z.string().trim().min(2).max(40).default('100 Level'),
  description: z.string().trim().max(1000).default(''),
  registrationFee: z.coerce.number().min(0).max(10000000).default(2000),
  currency: z.string().trim().length(3).default('NGN'),
  publicationStatus: z.enum(['draft', 'published', 'archived']).default('published'),
  examCategory: z.string().trim().min(2).max(120).default('Acadet CBT Examination'),
  defaultDurationMinutes: z.coerce.number().int().min(5).max(240).default(60),
});

const courseUpdateSchema = courseCreateSchema.partial();

const questionSchema = z.object({
  courseId: z.string().uuid('Valid courseId is required'),
  questionText: z.string().trim().min(5).max(3000),
  optionA: z.string().trim().min(1).max(1000),
  optionB: z.string().trim().min(1).max(1000),
  optionC: z.string().trim().min(1).max(1000),
  optionD: z.string().trim().min(1).max(1000),
  correctOption: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string().trim().max(2000).default(''),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).default('Medium'),
  topic: z.string().trim().min(1).max(120).default('General'),
  examYear: z.number().int().min(1980).max(2100).nullable().optional(),
  isActive: z.boolean().default(true),
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
      totalMaterials: number;
      totalSubmittedExams: number;
      totalActiveRegistrations: number;
      totalSuccessfulPayments: number;
      totalRevenueNaira: string;
    }>(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS "totalUsers",
        (SELECT COUNT(*)::int FROM courses) AS "totalCourses",
        (SELECT COUNT(*)::int FROM questions) AS "totalQuestions",
        (SELECT COUNT(*)::int FROM study_materials) AS "totalMaterials",
        (SELECT COUNT(*)::int FROM exam_sessions WHERE status = 'submitted') AS "totalSubmittedExams",
        (SELECT COUNT(*)::int FROM course_registrations WHERE registration_status = 'active') AS "totalActiveRegistrations",
        (SELECT COUNT(*)::int FROM payments WHERE payment_status = 'successful') AS "totalSuccessfulPayments",
        (SELECT COALESCE(SUM(amount), 0)::text FROM payments WHERE payment_status = 'successful') AS "totalRevenueNaira"
    `);

    const row = result.rows[0];
    res.json({
      overview: {
        totalUsers: row?.totalUsers ?? 0,
        totalCourses: row?.totalCourses ?? 0,
        totalQuestions: row?.totalQuestions ?? 0,
        totalMaterials: row?.totalMaterials ?? 0,
        totalSubmittedExams: row?.totalSubmittedExams ?? 0,
        totalActiveRegistrations: row?.totalActiveRegistrations ?? 0,
        totalSuccessfulPayments: row?.totalSuccessfulPayments ?? 0,
        totalRevenueNaira: Number(row?.totalRevenueNaira ?? 0),
      },
    });
  } catch (err) {
    handleApiError(res, err, 'fetching admin overview');
  }
});

// Courses CRUD + Registrations & Revenue Rollup
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
      registrationFee: string;
      currency: string;
      publicationStatus: 'draft' | 'published' | 'archived';
      examCategory: string;
      defaultDurationMinutes: number;
      isActive: boolean;
      createdAt: Date;
      questionCount: number;
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
        c.registration_fee::text AS "registrationFee",
        c.currency,
        c.publication_status AS "publicationStatus",
        c.exam_category AS "examCategory",
        c.default_duration_minutes AS "defaultDurationMinutes",
        c.is_active AS "isActive",
        c.created_at AS "createdAt",
        (
          SELECT COUNT(*)::int FROM questions q
          WHERE (q.course_id = c.id OR (q.course_id IS NULL AND c.subject_id IS NOT NULL AND q.subject_id = c.subject_id))
            AND q.is_active = TRUE
        ) AS "questionCount",
        (
          SELECT COUNT(*)::int FROM course_registrations cr
          WHERE cr.course_id = c.id AND cr.registration_status = 'active'
        ) AS "totalRegistrations",
        (
          SELECT COALESCE(SUM(p.amount), 0)::text FROM payments p
          WHERE p.course_id = c.id AND p.payment_status = 'successful'
        ) AS "totalRevenue"
      FROM courses c
      ORDER BY c.code ASC
    `);

    res.json({
      courses: result.rows.map((r) => ({
        ...r,
        registrationFee: Number(r.registrationFee),
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

    const [created] = await db
      .insert(courses)
      .values({
        code: normalizedCode,
        title: parsed.title,
        level: parsed.level,
        description: parsed.description,
        registrationFee: parsed.registrationFee.toFixed(2),
        currency: parsed.currency.toUpperCase(),
        publicationStatus: parsed.publicationStatus,
        examCategory: parsed.examCategory,
        defaultDurationMinutes: parsed.defaultDurationMinutes,
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
        registrationFee: created.registrationFee,
        publicationStatus: created.publicationStatus,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      course: {
        ...created,
        registrationFee: Number(created.registrationFee),
        questionCount: 0,
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

    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (parsed.code !== undefined) updateValues.code = parsed.code.toUpperCase();
    if (parsed.title !== undefined) updateValues.title = parsed.title;
    if (parsed.level !== undefined) updateValues.level = parsed.level;
    if (parsed.description !== undefined) updateValues.description = parsed.description;
    if (parsed.registrationFee !== undefined) {
      updateValues.registrationFee = parsed.registrationFee.toFixed(2);
    }
    if (parsed.currency !== undefined) updateValues.currency = parsed.currency.toUpperCase();
    if (parsed.publicationStatus !== undefined) {
      updateValues.publicationStatus = parsed.publicationStatus;
      updateValues.isActive = parsed.publicationStatus === 'published';
    }
    if (parsed.examCategory !== undefined) updateValues.examCategory = parsed.examCategory;
    if (parsed.defaultDurationMinutes !== undefined) {
      updateValues.defaultDurationMinutes = parsed.defaultDurationMinutes;
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
      metadata: parsed,
      ipAddress: req.ip,
    });

    res.json({
      course: {
        ...updated,
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

// Questions CRUD (Course-based — answers visible only to admins)
router.get('/questions', async (req, res) => {
  try {
    const db = getDb();
    const courseId =
      typeof req.query.courseId === 'string' && req.query.courseId.trim()
        ? req.query.courseId.trim()
        : null;

    const baseQuery = db
      .select({
        id: questions.id,
        courseId: questions.courseId,
        courseCode: courses.code,
        courseTitle: courses.title,
        questionText: questions.questionText,
        optionA: questions.optionA,
        optionB: questions.optionB,
        optionC: questions.optionC,
        optionD: questions.optionD,
        correctOption: questions.correctOption,
        explanation: questions.explanation,
        difficulty: questions.difficulty,
        topic: questions.topic,
        examYear: questions.examYear,
        isActive: questions.isActive,
        createdAt: questions.createdAt,
      })
      .from(questions)
      .leftJoin(courses, eq(questions.courseId, courses.id));

    const rows = courseId
      ? await baseQuery.where(eq(questions.courseId, courseId)).orderBy(desc(questions.createdAt))
      : await baseQuery.orderBy(desc(questions.createdAt)).limit(250);

    res.json({
      questions: rows.map((r) => ({
        ...r,
        courseCode: r.courseCode || 'COURSE',
        courseTitle: r.courseTitle || 'Unassigned Course',
      })),
    });
  } catch (err) {
    handleApiError(res, err, 'listing admin questions');
  }
});

router.post('/questions', async (req, res) => {
  try {
    const parsed = questionSchema.parse(req.body);
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
        isActive: parsed.isActive,
        createdBy: req.user!.id,
      })
      .returning();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.question.create',
      entityType: 'question',
      entityId: created.id,
      metadata: { courseId: course.id, courseCode: course.code },
      ipAddress: req.ip,
    });

    res.status(201).json({
      question: {
        ...created,
        courseCode: course.code,
        courseTitle: course.title,
      },
    });
  } catch (err) {
    handleApiError(res, err, 'creating question');
  }
});

router.patch('/questions/:id', async (req, res) => {
  try {
    const parsed = questionSchema.partial().parse(req.body);
    const db = getDb();
    const [updated] = await db
      .update(questions)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(questions.id, req.params.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }
    res.json({ question: updated });
  } catch (err) {
    handleApiError(res, err, 'updating question');
  }
});

router.delete('/questions/:id', async (req, res) => {
  try {
    const db = getDb();
    const [deleted] = await db
      .delete(questions)
      .where(eq(questions.id, req.params.id))
      .returning({ id: questions.id });
    if (!deleted) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }
    res.json({ deletedId: deleted.id });
  } catch (err) {
    handleApiError(res, err, 'deleting question');
  }
});

router.post('/questions/generate', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
      return;
    }

    const genSchema = z.object({
      courseId: z.string().uuid(),
      topic: z.string().trim().min(2).max(160),
      difficulty: z.enum(['Easy', 'Medium', 'Hard']).default('Medium'),
      count: z.number().int().min(1).max(10).default(5),
    });

    const parsed = genSchema.parse(req.body);
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

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate ${parsed.count} accurate ${parsed.difficulty}-difficulty CBT multiple-choice questions for course "${course.code}: ${course.title}" focusing on topic "${parsed.topic}". Each question must have 4 distinct options A, B, C, D, one unambiguous correctOption letter, and a clear concise explanation.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              questionText: { type: Type.STRING },
              optionA: { type: Type.STRING },
              optionB: { type: Type.STRING },
              optionC: { type: Type.STRING },
              optionD: { type: Type.STRING },
              correctOption: { type: Type.STRING, enum: ['A', 'B', 'C', 'D'] },
              explanation: { type: Type.STRING },
            },
            required: [
              'questionText',
              'optionA',
              'optionB',
              'optionC',
              'optionD',
              'correctOption',
              'explanation',
            ],
          },
        },
      },
    });

    let drafts: Array<{
      questionText: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctOption: 'A' | 'B' | 'C' | 'D';
      explanation: string;
    }> = [];
    try {
      const parsedJson = JSON.parse(response.text || '[]');
      if (Array.isArray(parsedJson)) {
        drafts = parsedJson;
      }
    } catch {
      res.status(502).json({ error: 'AI returned an invalid question payload. Please retry.' });
      return;
    }

    if (drafts.length === 0) {
      res.status(502).json({ error: 'AI did not generate any questions. Please try a different topic.' });
      return;
    }

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
          difficulty: parsed.difficulty,
          topic: parsed.topic,
          isActive: true,
          createdBy: req.user!.id,
        }))
      )
      .returning();

    res.status(201).json({ questions: inserted });
  } catch (err) {
    handleApiError(res, err, 'generating questions');
  }
});

// Study Materials Upload & Management (External Object Storage + PostgreSQL metadata)
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

      await uploadObjectBuffer({
        objectKey,
        body: file.buffer,
        contentType: file.mimetype || 'application/octet-stream',
      });

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
          objectKey,
          mimeType: file.mimetype || 'application/pdf',
          uploadedBy: req.user!.id,
          isActive: true,
        })
        .returning();

      await writeAuditLog({
        actorUserId: req.user!.id,
        action: 'admin.material.upload',
        entityType: 'study_material',
        entityId: created.id,
        metadata: { title: created.title, objectKey },
        ipAddress: req.ip,
      });

      res.status(201).json({ material: created });
    } catch (err) {
      if (err instanceof ObjectStorageNotConfiguredError) {
        res.status(503).json({
          error: err.message,
          code: 'OBJECT_STORAGE_NOT_CONFIGURED',
        });
        return;
      }
      handleApiError(res, err, 'uploading study material');
    }
  }
);

router.delete('/materials/:id', async (req, res) => {
  try {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(studyMaterials)
      .where(eq(studyMaterials.id, req.params.id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Study material not found.' });
      return;
    }

    try {
      await deleteObjectKey(existing.objectKey);
    } catch (storageErr) {
      if (!(storageErr instanceof ObjectStorageNotConfiguredError)) {
        console.warn('[ObjectStorage Delete Warning]', storageErr);
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
    clauses.push(`(LOWER(u.full_name) LIKE $${idx} OR LOWER(u.email) LIKE $${idx})`);
  }
  if (filters.courseId) {
    values.push(filters.courseId);
    clauses.push(`cr.course_id = $${values.length}`);
  }
  if (filters.paymentStatus) {
    values.push(filters.paymentStatus);
    clauses.push(`p.payment_status = $${values.length}`);
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
    courseId: string;
    courseCode: string;
    courseTitle: string;
    paymentId: string;
    paymentReference: string;
    amount: string;
    currency: string;
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
       c.id AS "courseId",
       c.code AS "courseCode",
       c.title AS "courseTitle",
       p.id AS "paymentId",
       p.payment_reference AS "paymentReference",
       p.amount::text AS "amount",
       p.currency,
       p.payment_status AS "paymentStatus",
       cr.registration_status AS "registrationStatus",
       p.gateway,
       p.gateway_transaction_id AS "gatewayTransactionId",
       p.paid_at AS "paidAt",
       cr.registered_at AS "registeredAt"
     FROM course_registrations cr
     INNER JOIN users u ON u.id = cr.student_id
     INNER JOIN courses c ON c.id = cr.course_id
     INNER JOIN payments p ON p.id = cr.payment_id
     ${whereSql}
     ORDER BY cr.registered_at DESC
     LIMIT 500`,
    values
  );

  return res.rows.map((r) => ({
    ...r,
    amount: Number(r.amount),
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
      'Course Code',
      'Course Title',
      'Amount',
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
        escapeCsv(r.courseCode),
        escapeCsv(r.courseTitle),
        escapeCsv(r.amount),
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
        `(LOWER(u.full_name) LIKE $${idx} OR LOWER(u.email) LIKE $${idx} OR LOWER(p.payment_reference) LIKE $${idx})`
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
      courseId: string;
      courseCode: string;
      courseTitle: string;
      paymentReference: string;
      gateway: string;
      amount: string;
      currency: string;
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
         u.id AS "studentId",
         u.full_name AS "studentName",
         u.email AS "studentEmail",
         c.id AS "courseId",
         c.code AS "courseCode",
         c.title AS "courseTitle",
         p.payment_reference AS "paymentReference",
         p.gateway,
         p.amount::text AS "amount",
         p.currency,
         p.payment_status AS "paymentStatus",
         p.gateway_transaction_id AS "gatewayTransactionId",
         p.gateway_response AS "gatewayResponse",
         p.paid_at AS "paidAt",
         p.created_at AS "createdAt",
         cr.id AS "registrationId",
         cr.registration_status AS "registrationStatus"
       FROM payments p
       INNER JOIN users u ON u.id = p.student_id
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
        amount: Number(r.amount),
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

    const paystackData = await verifyPaystackTransaction(payRow.paymentReference);
    const outcome = await settlePaystackTransaction({
      paystackData,
      actorUserId: req.user!.id,
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

// User Management + Student Course Registration History Profile
router.get('/users', async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db.select().from(users).orderBy(desc(users.createdAt)).limit(250);
    res.json({ users: rows.map(sanitizeUser) });
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
      registrationFee: string;
      currency: string;
      registrationStatus: string | null;
      registeredAt: Date | null;
      paymentStatus: string | null;
      paymentReference: string | null;
      amountPaid: string | null;
    }>(
      `SELECT
         c.id AS "courseId",
         c.code,
         c.title,
         c.level,
         c.registration_fee::text AS "registrationFee",
         c.currency,
         cr.registration_status AS "registrationStatus",
         cr.registered_at AS "registeredAt",
         p.payment_status AS "paymentStatus",
         p.payment_reference AS "paymentReference",
         p.amount::text AS "amountPaid"
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
      amount: string;
      currency: string;
      paymentStatus: string;
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
         p.amount::text AS "amount",
         p.currency,
         p.payment_status AS "paymentStatus",
         p.paid_at AS "paidAt",
         p.created_at AS "createdAt"
       FROM payments p
       INNER JOIN courses c ON c.id = p.course_id
       WHERE p.student_id = $1
       ORDER BY p.created_at DESC`,
      [studentId]
    );

    const coursesStatus = coursesStatusRes.rows.map((r) => ({
      courseId: r.courseId,
      code: r.code,
      title: r.title,
      level: r.level,
      registrationFee: Number(r.registrationFee),
      currency: r.currency,
      isRegistered: r.registrationStatus === 'active' && r.paymentStatus === 'successful',
      registeredAt: r.registeredAt,
      paymentStatus: r.paymentStatus,
      paymentReference: r.paymentReference,
      amountPaid: r.amountPaid ? Number(r.amountPaid) : null,
    }));

    const studentPayments = paymentsRes.rows.map((p) => ({
      ...p,
      amount: Number(p.amount),
    }));

    const successfulPayments = studentPayments.filter((p) => p.paymentStatus === 'successful');
    const totalAmountPaid = successfulPayments.reduce((acc, p) => acc + p.amount, 0);
    const totalCoursesRegistered = coursesStatus.filter((c) => c.isRegistered).length;

    res.json({
      student: sanitizeUser(userRow),
      coursesStatus,
      payments: studentPayments,
      summary: {
        totalPublishedCourses: coursesStatus.length,
        totalCoursesRegistered,
        totalSuccessfulPayments: successfulPayments.length,
        totalAmountPaid,
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
    const [updated] = await db
      .update(users)
      .set({ ...parsed, updatedAt: new Date() })
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

export default router;
