import { and, desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { getDb } from '../../db/index.js';
import {
  announcements,
  courses,
  examSessions,
  questions,
  subjects,
} from '../../db/schema.js';
import { handleApiError, requireAuth, requireDb } from '../middleware/auth.js';

const router = Router();

router.get('/subjects', requireDb, async (_req, res) => {
  try {
    const db = getDb();
    const subjectRows = await db
      .select({
        id: subjects.id,
        slug: subjects.slug,
        name: subjects.name,
        code: subjects.code,
        examCategory: subjects.examCategory,
        description: subjects.description,
        defaultDurationMinutes: subjects.defaultDurationMinutes,
        questionCount: sql<number>`(
          SELECT COUNT(*)::int FROM questions q
          WHERE q.subject_id = ${subjects.id} AND q.is_active = TRUE
        )`,
        courseCount: sql<number>`(
          SELECT COUNT(*)::int FROM courses c
          WHERE c.subject_id = ${subjects.id} AND c.is_active = TRUE
        )`,
      })
      .from(subjects)
      .where(eq(subjects.isActive, true))
      .orderBy(subjects.name);

    res.json({ subjects: subjectRows });
  } catch (err) {
    handleApiError(res, err, 'fetching subjects');
  }
});

router.get('/subjects/:subjectId/courses', requireDb, async (req, res) => {
  try {
    const db = getDb();
    const courseRows = await db
      .select({
        id: courses.id,
        subjectId: courses.subjectId,
        code: courses.code,
        title: courses.title,
        level: courses.level,
        description: courses.description,
      })
      .from(courses)
      .where(
        and(eq(courses.subjectId, req.params.subjectId), eq(courses.isActive, true))
      )
      .orderBy(courses.code);

    res.json({ courses: courseRows });
  } catch (err) {
    handleApiError(res, err, 'fetching courses');
  }
});

router.get('/announcements', requireDb, async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        isPinned: announcements.isPinned,
        createdAt: announcements.createdAt,
      })
      .from(announcements)
      .where(eq(announcements.isActive, true))
      .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
      .limit(10);

    res.json({ announcements: rows });
  } catch (err) {
    handleApiError(res, err, 'fetching announcements');
  }
});

router.get('/activity', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const userId = req.user!.id;

    const recentSessions = await db
      .select({
        id: examSessions.id,
        subjectId: examSessions.subjectId,
        subjectName: subjects.name,
        scorePercentage: examSessions.scorePercentage,
        correctCount: examSessions.correctCount,
        totalQuestions: examSessions.totalQuestions,
        submittedAt: examSessions.submittedAt,
      })
      .from(examSessions)
      .innerJoin(subjects, eq(examSessions.subjectId, subjects.id))
      .where(
        and(eq(examSessions.userId, userId), eq(examSessions.status, 'submitted'))
      )
      .orderBy(desc(examSessions.submittedAt));

    const lastAttempt = recentSessions[0] || null;
    const bestScore =
      recentSessions.length > 0
        ? Math.max(...recentSessions.map((s) => s.scorePercentage ?? 0))
        : null;

    res.json({
      lastAttempt,
      bestScore,
      totalCompletedExams: recentSessions.length,
    });
  } catch (err) {
    handleApiError(res, err, 'fetching activity summary');
  }
});

export default router;
