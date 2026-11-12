import { and, asc, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { getDb } from '../../db/index.js';
import {
  courses,
  examSessionQuestions,
  examSessions,
  questions,
  subjects,
} from '../../db/schema.js';
import { handleApiError, requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const courseIdFilter =
      typeof req.query.courseId === 'string' && req.query.courseId.trim()
        ? req.query.courseId.trim()
        : null;

    const conditions = [
      eq(examSessions.userId, req.user!.id),
      eq(examSessions.status, 'submitted'),
    ];
    if (courseIdFilter) {
      conditions.push(eq(examSessions.courseId, courseIdFilter));
    }

    const sessions = await db
      .select({
        id: examSessions.id,
        courseId: examSessions.courseId,
        courseTitle: courses.title,
        courseCode: courses.code,
        legacySubjectName: subjects.name,
        legacySubjectCode: subjects.code,
        examTitle: examSessions.examTitle,
        difficultyFilter: examSessions.difficultyFilter,
        totalQuestions: examSessions.totalQuestions,
        correctCount: examSessions.correctCount,
        wrongCount: examSessions.wrongCount,
        unansweredCount: examSessions.unansweredCount,
        scorePercentage: examSessions.scorePercentage,
        timeSpentSeconds: examSessions.timeSpentSeconds,
        startedAt: examSessions.startedAt,
        submittedAt: examSessions.submittedAt,
      })
      .from(examSessions)
      .leftJoin(courses, eq(examSessions.courseId, courses.id))
      .leftJoin(subjects, eq(examSessions.subjectId, subjects.id))
      .where(and(...conditions))
      .orderBy(desc(examSessions.submittedAt));

    const normalizedHistory = sessions.map((s) => ({
      id: s.id,
      courseId: s.courseId || '',
      courseTitle: s.courseTitle || s.legacySubjectName || 'Course Exam',
      courseCode: s.courseCode || s.legacySubjectCode || '',
      examTitle: s.examTitle,
      difficultyFilter: s.difficultyFilter,
      totalQuestions: s.totalQuestions,
      correctCount: s.correctCount,
      wrongCount: s.wrongCount,
      unansweredCount: s.unansweredCount,
      scorePercentage: s.scorePercentage,
      timeSpentSeconds: s.timeSpentSeconds,
      startedAt: s.startedAt,
      submittedAt: s.submittedAt,
    }));

    const examsTaken = normalizedHistory.length;
    const averageScore =
      examsTaken > 0
        ? Math.round(
            normalizedHistory.reduce((sum, s) => sum + (s.scorePercentage ?? 0), 0) /
              examsTaken
          )
        : 0;
    const bestScore =
      examsTaken > 0
        ? Math.max(...normalizedHistory.map((s) => s.scorePercentage ?? 0))
        : 0;
    const totalTimeSeconds = normalizedHistory.reduce(
      (sum, s) => sum + (s.timeSpentSeconds ?? 0),
      0
    );

    const chronological = [...normalizedHistory].reverse();
    const trend = chronological.map((s, idx) => ({
      label: `Exam ${idx + 1}`,
      sessionId: s.id,
      courseTitle: s.courseTitle,
      courseCode: s.courseCode,
      scorePercentage: s.scorePercentage ?? 0,
      submittedAt: s.submittedAt,
    }));

    res.json({
      kpis: {
        averageScore,
        examsTaken,
        bestScore,
        totalTimeSeconds,
      },
      trend,
      history: normalizedHistory,
    });
  } catch (err) {
    handleApiError(res, err, 'fetching course exam results');
  }
});

router.get('/:sessionId', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { sessionId } = req.params;

    const [sessionRow] = await db
      .select({
        id: examSessions.id,
        userId: examSessions.userId,
        courseId: examSessions.courseId,
        courseTitle: courses.title,
        courseCode: courses.code,
        legacySubjectName: subjects.name,
        legacySubjectCode: subjects.code,
        examTitle: examSessions.examTitle,
        difficultyFilter: examSessions.difficultyFilter,
        totalQuestions: examSessions.totalQuestions,
        correctCount: examSessions.correctCount,
        wrongCount: examSessions.wrongCount,
        unansweredCount: examSessions.unansweredCount,
        scorePercentage: examSessions.scorePercentage,
        timeLimitSeconds: examSessions.timeLimitSeconds,
        timeSpentSeconds: examSessions.timeSpentSeconds,
        status: examSessions.status,
        startedAt: examSessions.startedAt,
        submittedAt: examSessions.submittedAt,
      })
      .from(examSessions)
      .leftJoin(courses, eq(examSessions.courseId, courses.id))
      .leftJoin(subjects, eq(examSessions.subjectId, subjects.id))
      .where(eq(examSessions.id, sessionId))
      .limit(1);

    if (!sessionRow) {
      res.status(404).json({ error: 'Result session not found.' });
      return;
    }

    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';
    if (sessionRow.userId !== req.user!.id && !isAdmin) {
      res.status(403).json({ error: 'You are not authorized to view this exam result.' });
      return;
    }

    if (sessionRow.status !== 'submitted') {
      res.status(409).json({
        error: 'This exam has not been submitted yet. Submit the exam before reviewing answers.',
      });
      return;
    }

    const items = await db
      .select({
        order: examSessionQuestions.questionOrder,
        questionId: questions.id,
        questionText: questions.questionText,
        optionA: questions.optionA,
        optionB: questions.optionB,
        optionC: questions.optionC,
        optionD: questions.optionD,
        difficulty: questions.difficulty,
        topic: questions.topic,
        selectedOption: examSessionQuestions.selectedOption,
        isMarkedForReview: examSessionQuestions.isMarkedForReview,
        isCorrect: examSessionQuestions.isCorrect,
        correctOption: questions.correctOption,
        explanation: questions.explanation,
      })
      .from(examSessionQuestions)
      .innerJoin(questions, eq(examSessionQuestions.questionId, questions.id))
      .where(eq(examSessionQuestions.sessionId, sessionId))
      .orderBy(asc(examSessionQuestions.questionOrder));

    res.json({
      session: {
        ...sessionRow,
        courseTitle: sessionRow.courseTitle || sessionRow.legacySubjectName || 'Course Exam',
        courseCode: sessionRow.courseCode || sessionRow.legacySubjectCode || '',
      },
      questions: items,
    });
  } catch (err) {
    handleApiError(res, err, 'fetching detailed result');
  }
});

export default router;
