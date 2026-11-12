import { GoogleGenAI, Type } from '@google/genai';
import { desc, eq } from 'drizzle-orm';
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { getDb, getPool } from '../../db/index.js';
import {
  announcements,
  auditLogs,
  courses,
  examSessions,
  questions,
  studyMaterials,
  subjects,
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

const subjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  code: z.string().trim().min(2).max(20),
  examCategory: z.string().trim().min(2).max(120).default('JAMB UTME Practice Exam'),
  description: z.string().trim().max(500).default(''),
  defaultDurationMinutes: z.number().int().min(5).max(240).default(90),
  isActive: z.boolean().default(true),
});

const courseSchema = z.object({
  subjectId: z.string().uuid(),
  code: z.string().trim().min(2).max(30),
  title: z.string().trim().min(2).max(160),
  level: z.string().trim().min(2).max(40).default('UTME'),
  description: z.string().trim().max(500).default(''),
  isActive: z.boolean().default(true),
});

const questionSchema = z.object({
  subjectId: z.string().uuid(),
  courseId: z.string().uuid().nullable().optional(),
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
      totalSubjects: number;
      totalQuestions: number;
      totalMaterials: number;
      totalSubmittedExams: number;
    }>(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS "totalUsers",
        (SELECT COUNT(*)::int FROM subjects) AS "totalSubjects",
        (SELECT COUNT(*)::int FROM questions) AS "totalQuestions",
        (SELECT COUNT(*)::int FROM study_materials) AS "totalMaterials",
        (SELECT COUNT(*)::int FROM exam_sessions WHERE status = 'submitted') AS "totalSubmittedExams"
    `);

    res.json({
      overview: result.rows[0] || {
        totalUsers: 0,
        totalSubjects: 0,
        totalQuestions: 0,
        totalMaterials: 0,
        totalSubmittedExams: 0,
      },
    });
  } catch (err) {
    handleApiError(res, err, 'fetching admin overview');
  }
});

// Subjects CRUD
router.get('/subjects', async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db.select().from(subjects).orderBy(subjects.name);
    res.json({ subjects: rows });
  } catch (err) {
    handleApiError(res, err, 'listing admin subjects');
  }
});

router.post('/subjects', async (req, res) => {
  try {
    const parsed = subjectSchema.parse(req.body);
    const db = getDb();
    const [created] = await db.insert(subjects).values(parsed).returning();
    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.subject.create',
      entityType: 'subject',
      entityId: created.id,
      metadata: { name: created.name, code: created.code },
      ipAddress: req.ip,
    });
    res.status(201).json({ subject: created });
  } catch (err) {
    handleApiError(res, err, 'creating subject');
  }
});

router.patch('/subjects/:id', async (req, res) => {
  try {
    const parsed = subjectSchema.partial().parse(req.body);
    const db = getDb();
    const [updated] = await db
      .update(subjects)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(subjects.id, req.params.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Subject not found.' });
      return;
    }
    res.json({ subject: updated });
  } catch (err) {
    handleApiError(res, err, 'updating subject');
  }
});

router.delete('/subjects/:id', async (req, res) => {
  try {
    const db = getDb();
    const [deleted] = await db
      .delete(subjects)
      .where(eq(subjects.id, req.params.id))
      .returning({ id: subjects.id });
    if (!deleted) {
      res.status(404).json({ error: 'Subject not found.' });
      return;
    }
    res.json({ deletedId: deleted.id });
  } catch (err) {
    handleApiError(res, err, 'deleting subject');
  }
});

// Courses CRUD
router.get('/courses', async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: courses.id,
        subjectId: courses.subjectId,
        subjectName: subjects.name,
        code: courses.code,
        title: courses.title,
        level: courses.level,
        description: courses.description,
        isActive: courses.isActive,
      })
      .from(courses)
      .innerJoin(subjects, eq(courses.subjectId, subjects.id))
      .orderBy(subjects.name, courses.code);
    res.json({ courses: rows });
  } catch (err) {
    handleApiError(res, err, 'listing courses');
  }
});

router.post('/courses', async (req, res) => {
  try {
    const parsed = courseSchema.parse(req.body);
    const db = getDb();
    const [created] = await db.insert(courses).values(parsed).returning();
    res.status(201).json({ course: created });
  } catch (err) {
    handleApiError(res, err, 'creating course');
  }
});

router.delete('/courses/:id', async (req, res) => {
  try {
    const db = getDb();
    const [deleted] = await db
      .delete(courses)
      .where(eq(courses.id, req.params.id))
      .returning({ id: courses.id });
    if (!deleted) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }
    res.json({ deletedId: deleted.id });
  } catch (err) {
    handleApiError(res, err, 'deleting course');
  }
});

// Questions CRUD (only visible to admins!)
router.get('/questions', async (req, res) => {
  try {
    const db = getDb();
    const subjectId =
      typeof req.query.subjectId === 'string' && req.query.subjectId.trim()
        ? req.query.subjectId.trim()
        : null;

    const baseQuery = db
      .select({
        id: questions.id,
        subjectId: questions.subjectId,
        subjectName: subjects.name,
        courseId: questions.courseId,
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
      .innerJoin(subjects, eq(questions.subjectId, subjects.id));

    const rows = subjectId
      ? await baseQuery.where(eq(questions.subjectId, subjectId)).orderBy(desc(questions.createdAt))
      : await baseQuery.orderBy(desc(questions.createdAt)).limit(200);

    res.json({ questions: rows });
  } catch (err) {
    handleApiError(res, err, 'listing admin questions');
  }
});

router.post('/questions', async (req, res) => {
  try {
    const parsed = questionSchema.parse(req.body);
    const db = getDb();
    const [created] = await db
      .insert(questions)
      .values({
        ...parsed,
        courseId: parsed.courseId ?? null,
        examYear: parsed.examYear ?? null,
        createdBy: req.user!.id,
      })
      .returning();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'admin.question.create',
      entityType: 'question',
      entityId: created.id,
      ipAddress: req.ip,
    });

    res.status(201).json({ question: created });
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
      subjectId: z.string().uuid(),
      topic: z.string().trim().min(2).max(160),
      difficulty: z.enum(['Easy', 'Medium', 'Hard']).default('Medium'),
      count: z.number().int().min(1).max(10).default(5),
    });

    const parsed = genSchema.parse(req.body);
    const db = getDb();
    const [subject] = await db
      .select()
      .from(subjects)
      .where(eq(subjects.id, parsed.subjectId))
      .limit(1);

    if (!subject) {
      res.status(404).json({ error: 'Subject not found.' });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate ${parsed.count} accurate ${parsed.difficulty}-difficulty JAMB UTME multiple-choice questions for ${subject.name} focusing on topic "${parsed.topic}". Each question must have 4 distinct options A, B, C, D, one unambiguous correctOption letter, and a clear concise explanation.`,
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
          subjectId: subject.id,
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
      subjectId: z.string().uuid().optional().or(z.literal('')),
    });

    const parsed = metaSchema.parse(req.body);
    const objectKey = buildMaterialObjectKey(file.originalname, parsed.category);

    await uploadObjectBuffer({
      objectKey,
      body: file.buffer,
      contentType: file.mimetype || 'application/octet-stream',
    });

    const lowerName = file.originalname.toLowerCase();
    const fileType = lowerName.endsWith('.doc') || lowerName.endsWith('.docx')
      ? 'DOC'
      : file.mimetype.startsWith('image/')
        ? 'IMAGE'
        : 'PDF';

    const db = getDb();
    const [created] = await db
      .insert(studyMaterials)
      .values({
        subjectId: parsed.subjectId ? parsed.subjectId : null,
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
});

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

// User Management & Results Oversight
router.get('/users', async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db.select().from(users).orderBy(desc(users.createdAt)).limit(200);
    res.json({ users: rows.map(sanitizeUser) });
  } catch (err) {
    handleApiError(res, err, 'listing users');
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
        subjectName: subjects.name,
        scorePercentage: examSessions.scorePercentage,
        correctCount: examSessions.correctCount,
        totalQuestions: examSessions.totalQuestions,
        timeSpentSeconds: examSessions.timeSpentSeconds,
        submittedAt: examSessions.submittedAt,
      })
      .from(examSessions)
      .innerJoin(users, eq(examSessions.userId, users.id))
      .innerJoin(subjects, eq(examSessions.subjectId, subjects.id))
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
