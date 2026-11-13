import { and, asc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/index.js';
import {
  courseRegistrations,
  courses,
  examSessionQuestions,
  examSessions,
  payments,
  questions,
} from '../../db/schema.js';
import { writeAuditLog } from '../lib/audit.js';
import { gradeExamAnswers, type OptionLetter } from '../lib/examGrader.js';
import {
  COURSE_VALUE_NAIRA,
  STANDARD_CURRENCY,
  TOTAL_STUDENT_PAYABLE_NAIRA,
} from '../lib/pricing.js';
import { handleApiError, requireAuth } from '../middleware/auth.js';

const router = Router();

const startExamSchema = z.object({
  courseId: z.string().uuid('Valid courseId is required'),
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

async function hasActivePaidCourseRegistration(
  studentId: string,
  courseId: string
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: courseRegistrations.id })
    .from(courseRegistrations)
    .leftJoin(payments, eq(courseRegistrations.paymentId, payments.id))
    .where(
      and(
        eq(courseRegistrations.studentId, studentId),
        eq(courseRegistrations.courseId, courseId),
        eq(courseRegistrations.registrationStatus, 'active'),
        or(
          eq(payments.paymentStatus, 'successful'),
          and(
            isNull(courseRegistrations.paymentId),
            isNotNull(courseRegistrations.preservedPaymentRef)
          )
        )
      )
    )
    .limit(1);

  return rows.length > 0;
}

router.post('/start', requireAuth, async (req, res) => {
  try {
    const parsed = startExamSchema.parse(req.body);
    const db = getDb();

    const [course] = await db
      .select()
      .from(courses)
      .where(
        and(
          eq(courses.id, parsed.courseId),
          eq(courses.isActive, true),
          eq(courses.publicationStatus, 'published')
        )
      )
      .limit(1);

    if (!course) {
      res.status(404).json({ error: 'Selected course was not found or is not published.' });
      return;
    }

    // Enforce course-specific paid registration access control
    const isRegistered = await hasActivePaidCourseRegistration(req.user!.id, course.id);
    if (!isRegistered) {
      res.status(403).json({
        error:
          'You have not registered for this course. Please complete your course registration to access the CBT examination.',
        code: 'COURSE_REGISTRATION_REQUIRED',
        course: {
          id: course.id,
          code: course.code,
          title: course.title,
          level: course.level,
          courseValue: COURSE_VALUE_NAIRA,
          registrationFee: TOTAL_STUDENT_PAYABLE_NAIRA,
          currency: STANDARD_CURRENCY,
        },
      });
      return;
    }

    const courseMatchCondition = course.subjectId
      ? or(
          eq(questions.courseId, course.id),
          and(isNull(questions.courseId), eq(questions.subjectId, course.subjectId))
        )
      : eq(questions.courseId, course.id);

    const conditions = [courseMatchCondition!, eq(questions.isActive, true)];

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
        error: `No active questions found for ${course.code} — ${course.title} (${parsed.difficulty}).`,
      });
      return;
    }

    const durationMinutes =
      parsed.timeLimitMinutes ?? course.defaultDurationMinutes ?? 60;
    const timeLimitSeconds = durationMinutes * 60;

    const createdResult = await db.transaction(async (tx) => {
      const [session] = await tx
        .insert(examSessions)
        .values({
          userId: req.user!.id,
          subjectId: course.subjectId ?? null,
          courseId: course.id,
          examTitle: course.examCategory || 'Acadet CBT Examination',
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
          courseId: course.id,
          courseTitle: course.title,
          courseCode: course.code,
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
        courseId: course.id,
        courseCode: course.code,
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
        courseId: examSessions.courseId,
        courseTitle: courses.title,
        courseCode: courses.code,
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
      .leftJoin(courses, eq(examSessions.courseId, courses.id))
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
      if (sessionRow.courseId && !isAdmin) {
        const isRegistered = await hasActivePaidCourseRegistration(
          req.user!.id,
          sessionRow.courseId
        );
        if (!isRegistered) {
          res.status(403).json({
            error:
              'You do not have an active registration for this course.',
            code: 'COURSE_REGISTRATION_REQUIRED',
          });
          return;
        }
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
        courseId: examSessions.courseId,
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
      res.status(403).json({ error: "You cannot modify another student's exam session." });
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
      res.status(403).json({ error: "You cannot submit another student's exam session." });
      return;
    }

    if (session.status === 'submitted') {
      const courseRow = session.courseId
        ? (
            await db
              .select({ title: courses.title, code: courses.code })
              .from(courses)
              .where(eq(courses.id, session.courseId))
              .limit(1)
          )[0]
        : null;

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
          courseTitle: courseRow?.title || '',
          courseCode: courseRow?.code || '',
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

      const courseRow = updatedSession.courseId
        ? (
            await tx
              .select({ title: courses.title, code: courses.code })
              .from(courses)
              .where(eq(courses.id, updatedSession.courseId))
              .limit(1)
          )[0]
        : null;

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
          courseTitle: courseRow?.title || '',
          courseCode: courseRow?.code || '',
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
