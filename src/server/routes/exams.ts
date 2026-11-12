import { and, asc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/index.js';
import {
  examSessionQuestions,
  examSessions,
  questions,
  subjects,
} from '../../db/schema.js';
import { writeAuditLog } from '../lib/audit.js';
import { gradeExamAnswers, type OptionLetter } from '../lib/examGrader.js';
import { handleApiError, requireAuth } from '../middleware/auth.js';

const router = Router();

const startExamSchema = z.object({
  subjectId: z.string().uuid('Valid subjectId is required'),
  courseId: z.string().uuid().nullable().optional(),
  difficulty: z.enum(['All Levels', 'Easy', 'Medium', 'Hard']).default('All Levels'),
  questionCount: z.number().int().min(1).max(60).default(20),
  timeLimitMinutes: z.number().int().min(1).max(240).optional(),
});

const saveAnswerSchema = z.object({
  questionOrder: z.number().int().min(1),
  selectedOption: z.enum(['A', 'B', 'C', 'D']).nullable().optional(),
  isMarkedForReview: z.boolean().optional(),
  timeSpentSeconds: z.number().int().min(0).max(86400).optional(),
});

const submitExamSchema = z.object({
  timeSpentSeconds: z.number().int().min(0).max(86400).optional(),
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

router.post('/start', requireAuth, async (req, res) => {
  try {
    const parsed = startExamSchema.parse(req.body);
    const db = getDb();

    const [subject] = await db
      .select()
      .from(subjects)
      .where(and(eq(subjects.id, parsed.subjectId), eq(subjects.isActive, true)))
      .limit(1);

    if (!subject) {
      res.status(404).json({ error: 'Selected subject was not found or is inactive.' });
      return;
    }

    const conditions = [
      eq(questions.subjectId, subject.id),
      eq(questions.isActive, true),
    ];

    if (parsed.courseId) {
      conditions.push(eq(questions.courseId, parsed.courseId));
    }

    if (parsed.difficulty !== 'All Levels') {
      conditions.push(eq(questions.difficulty, parsed.difficulty));
    }

    // Explicitly project ONLY non-answer fields so correctOption is never exposed before submission
    const pickedQuestions = await db
      .select({
        id: questions.id,
        questionText: questions.questionText,
        optionA: questions.optionA,
        optionB: questions.optionB,
        optionC: questions.optionC,
        optionD: questions.optionD,
        difficulty: questions.difficulty,
        topic: questions.topic,
      })
      .from(questions)
      .where(and(...conditions))
      .orderBy(sql`RANDOM()`)
      .limit(parsed.questionCount);

    if (pickedQuestions.length === 0) {
      res.status(404).json({
        error: `No active questions found for ${subject.name} (${parsed.difficulty}).`,
      });
      return;
    }

    const durationMinutes =
      parsed.timeLimitMinutes ?? subject.defaultDurationMinutes ?? 90;
    const timeLimitSeconds = durationMinutes * 60;

    const createdResult = await db.transaction(async (tx) => {
      const [session] = await tx
        .insert(examSessions)
        .values({
          userId: req.user!.id,
          subjectId: subject.id,
          courseId: parsed.courseId ?? null,
          examTitle: subject.examCategory || 'JAMB UTME Practice Exam',
          difficultyFilter: parsed.difficulty,
          totalQuestions: pickedQuestions.length,
          timeLimitSeconds,
          timeSpentSeconds: 0,
          status: 'in_progress',
        })
        .returning();

      const sessionQuestionValues = pickedQuestions.map((q, idx) => ({
        sessionId: session.id,
        questionId: q.id,
        questionOrder: idx + 1,
        selectedOption: null,
        isMarkedForReview: false,
        isCorrect: null,
      }));

      await tx.insert(examSessionQuestions).values(sessionQuestionValues);

      return {
        session: {
          ...session,
          subjectName: subject.name,
          subjectCode: subject.code,
        },
        questions: pickedQuestions.map((q, idx) => ({
          order: idx + 1,
          questionId: q.id,
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          difficulty: q.difficulty,
          topic: q.topic,
          selectedOption: null as OptionLetter | null,
          isMarkedForReview: false,
        })),
      };
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'exam.start',
      entityType: 'exam_session',
      entityId: createdResult.session.id,
      metadata: {
        subjectId: subject.id,
        difficulty: parsed.difficulty,
        totalQuestions: pickedQuestions.length,
      },
      ipAddress: req.ip,
    });

    res.status(201).json(createdResult);
  } catch (err) {
    handleApiError(res, err, 'starting exam');
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
        subjectId: examSessions.subjectId,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        examTitle: examSessions.examTitle,
        difficultyFilter: examSessions.difficultyFilter,
        totalQuestions: examSessions.totalQuestions,
        timeLimitSeconds: examSessions.timeLimitSeconds,
        timeSpentSeconds: examSessions.timeSpentSeconds,
        status: examSessions.status,
        correctCount: examSessions.correctCount,
        wrongCount: examSessions.wrongCount,
        unansweredCount: examSessions.unansweredCount,
        scorePercentage: examSessions.scorePercentage,
        startedAt: examSessions.startedAt,
        submittedAt: examSessions.submittedAt,
      })
      .from(examSessions)
      .innerJoin(subjects, eq(examSessions.subjectId, subjects.id))
      .where(eq(examSessions.id, sessionId))
      .limit(1);

    if (!sessionRow) {
      res.status(404).json({ error: 'Exam session not found.' });
      return;
    }

    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';
    if (sessionRow.userId !== req.user!.id && !isAdmin) {
      res.status(403).json({ error: 'You are not authorized to access this exam session.' });
      return;
    }

    if (sessionRow.status === 'in_progress') {
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
        })
        .from(examSessionQuestions)
        .innerJoin(questions, eq(examSessionQuestions.questionId, questions.id))
        .where(eq(examSessionQuestions.sessionId, sessionId))
        .orderBy(asc(examSessionQuestions.questionOrder));

      res.json({ session: sessionRow, questions: items });
      return;
    }

    const gradedItems = await db
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

    res.json({ session: sessionRow, questions: gradedItems });
  } catch (err) {
    handleApiError(res, err, 'fetching exam session');
  }
});

router.patch('/:sessionId/answer', requireAuth, async (req, res) => {
  try {
    const parsed = saveAnswerSchema.parse(req.body);
    const db = getDb();
    const { sessionId } = req.params;

    const [session] = await db
      .select({
        id: examSessions.id,
        userId: examSessions.userId,
        status: examSessions.status,
      })
      .from(examSessions)
      .where(eq(examSessions.id, sessionId))
      .limit(1);

    if (!session) {
      res.status(404).json({ error: 'Exam session not found.' });
      return;
    }

    if (session.userId !== req.user!.id) {
      res.status(403).json({ error: 'You cannot modify another student\'s exam session.' });
      return;
    }

    if (session.status !== 'in_progress') {
      res.status(409).json({ error: 'This exam session has already been submitted.' });
      return;
    }

    await db.transaction(async (tx) => {
      const updates: Record<string, unknown> = {
        answeredAt: new Date(),
      };
      if (parsed.selectedOption !== undefined) {
        updates.selectedOption = parsed.selectedOption;
      }
      if (parsed.isMarkedForReview !== undefined) {
        updates.isMarkedForReview = parsed.isMarkedForReview;
      }

      await tx
        .update(examSessionQuestions)
        .set(updates)
        .where(
          and(
            eq(examSessionQuestions.sessionId, sessionId),
            eq(examSessionQuestions.questionOrder, parsed.questionOrder)
          )
        );

      if (typeof parsed.timeSpentSeconds === 'number') {
        await tx
          .update(examSessions)
          .set({ timeSpentSeconds: parsed.timeSpentSeconds })
          .where(eq(examSessions.id, sessionId));
      }
    });

    res.json({ ok: true });
  } catch (err) {
    handleApiError(res, err, 'saving exam answer');
  }
});

router.post('/:sessionId/submit', requireAuth, async (req, res) => {
  try {
    const parsed = submitExamSchema.parse(req.body || {});
    const db = getDb();
    const { sessionId } = req.params;

    const [session] = await db
      .select()
      .from(examSessions)
      .where(eq(examSessions.id, sessionId))
      .limit(1);

    if (!session) {
      res.status(404).json({ error: 'Exam session not found.' });
      return;
    }

    if (session.userId !== req.user!.id) {
      res.status(403).json({ error: 'You cannot submit another student\'s exam session.' });
      return;
    }

    if (session.status === 'submitted') {
      const [subject] = await db
        .select({ name: subjects.name, code: subjects.code })
        .from(subjects)
        .where(eq(subjects.id, session.subjectId))
        .limit(1);

      const gradedQuestions = await db
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
          ...session,
          subjectName: subject?.name || '',
          subjectCode: subject?.code || '',
        },
        questions: gradedQuestions,
      });
      return;
    }

    const resultPayload = await db.transaction(async (tx) => {
      if (parsed.answers && parsed.answers.length > 0) {
        for (const ans of parsed.answers) {
          await tx
            .update(examSessionQuestions)
            .set({
              selectedOption: ans.selectedOption,
              ...(ans.isMarkedForReview !== undefined
                ? { isMarkedForReview: ans.isMarkedForReview }
                : {}),
              answeredAt: new Date(),
            })
            .where(
              and(
                eq(examSessionQuestions.sessionId, sessionId),
                eq(examSessionQuestions.questionOrder, ans.questionOrder)
              )
            );
        }
      }

      const rowsToGrade = await tx
        .select({
          sessionQuestionId: examSessionQuestions.id,
          questionOrder: examSessionQuestions.questionOrder,
          selectedOption: examSessionQuestions.selectedOption,
          correctOption: questions.correctOption,
        })
        .from(examSessionQuestions)
        .innerJoin(questions, eq(examSessionQuestions.questionId, questions.id))
        .where(eq(examSessionQuestions.sessionId, sessionId))
        .orderBy(asc(examSessionQuestions.questionOrder));

      const graded = gradeExamAnswers(
        rowsToGrade.map((r) => ({
          sessionQuestionId: r.sessionQuestionId,
          questionOrder: r.questionOrder,
          selectedOption: (r.selectedOption as OptionLetter | null) ?? null,
          correctOption: r.correctOption as OptionLetter,
        }))
      );

      for (const outcome of graded.outcomes) {
        await tx
          .update(examSessionQuestions)
          .set({ isCorrect: outcome.isCorrect })
          .where(eq(examSessionQuestions.id, outcome.sessionQuestionId));
      }

      const finalTimeSpent =
        typeof parsed.timeSpentSeconds === 'number'
          ? Math.min(parsed.timeSpentSeconds, session.timeLimitSeconds)
          : Math.max(
              session.timeSpentSeconds,
              Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
            );

      const [updatedSession] = await tx
        .update(examSessions)
        .set({
          status: 'submitted',
          timeSpentSeconds: finalTimeSpent,
          correctCount: graded.correctCount,
          wrongCount: graded.wrongCount,
          unansweredCount: graded.unansweredCount,
          scorePercentage: graded.scorePercentage,
          submittedAt: new Date(),
        })
        .where(eq(examSessions.id, sessionId))
        .returning();

      const [subject] = await tx
        .select({ name: subjects.name, code: subjects.code })
        .from(subjects)
        .where(eq(subjects.id, updatedSession.subjectId))
        .limit(1);

      const gradedQuestions = await tx
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

      return {
        session: {
          ...updatedSession,
          subjectName: subject?.name || '',
          subjectCode: subject?.code || '',
        },
        questions: gradedQuestions,
      };
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'exam.submit',
      entityType: 'exam_session',
      entityId: sessionId,
      metadata: {
        scorePercentage: resultPayload.session.scorePercentage,
        correctCount: resultPayload.session.correctCount,
        totalQuestions: resultPayload.session.totalQuestions,
      },
      ipAddress: req.ip,
    });

    res.json(resultPayload);
  } catch (err) {
    handleApiError(res, err, 'submitting exam');
  }
});

export default router;
