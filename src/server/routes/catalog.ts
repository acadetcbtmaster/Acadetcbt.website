import { and, desc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { Router } from 'express';
import { getDb } from '../../db/index.js';
import {
  announcements,
  courseRegistrations,
  courses,
  examSessions,
  payments,
  subjects,
} from '../../db/schema.js';
import {
  handleApiError,
  optionalAuth,
  requireAuth,
  requireDb,
} from '../middleware/auth.js';

const router = Router();

// Primary Course Catalogue endpoint — returns all published courses with per-student registration & payment status
router.get('/courses', requireDb, optionalAuth, async (req, res) => {
  try {
    const db = getDb();
    const studentId = req.user?.id || null;

    const courseRows = await db
      .select({
        id: courses.id,
        subjectId: courses.subjectId,
        code: courses.code,
        title: courses.title,
        level: courses.level,
        description: courses.description,
        courseValue: courses.courseValue,
        registrationFee: courses.registrationFee,
        currency: courses.currency,
        publicationStatus: courses.publicationStatus,
        examCategory: courses.examCategory,
        defaultDurationMinutes: courses.defaultDurationMinutes,
        questionCount: sql<number>`(
          SELECT COUNT(*)::int FROM questions q
          WHERE (
            q.course_id = ${courses.id}
            OR (q.course_id IS NULL AND ${courses.subjectId} IS NOT NULL AND q.subject_id = ${courses.subjectId})
          )
          AND q.is_active = TRUE
        )`,
      })
      .from(courses)
      .where(and(eq(courses.isActive, true), eq(courses.publicationStatus, 'published')))
      .orderBy(courses.code);

    const activeRegMap = new Map<
      string,
      { registrationId: string; registeredAt: Date; paymentReference: string }
    >();
    const latestPaymentMap = new Map<
      string,
      { paymentStatus: string; paymentReference: string; createdAt: Date }
    >();

    if (studentId) {
      const regRows = await db
        .select({
          id: courseRegistrations.id,
          courseId: courseRegistrations.courseId,
          registeredAt: courseRegistrations.registeredAt,
          paymentReference: sql<string>`COALESCE(${payments.paymentReference}, ${courseRegistrations.preservedPaymentRef}, 'PRESERVED-REG')`,
        })
        .from(courseRegistrations)
        .leftJoin(payments, eq(courseRegistrations.paymentId, payments.id))
        .where(
          and(
            eq(courseRegistrations.studentId, studentId),
            eq(courseRegistrations.registrationStatus, 'active'),
            or(
              eq(payments.paymentStatus, 'successful'),
              and(
                isNull(courseRegistrations.paymentId),
                isNotNull(courseRegistrations.preservedPaymentRef)
              )
            )
          )
        );

      for (const r of regRows) {
        activeRegMap.set(r.courseId, {
          registrationId: r.id,
          registeredAt: r.registeredAt,
          paymentReference: r.paymentReference,
        });
      }

      const payRows = await db
        .select({
          courseId: payments.courseId,
          paymentStatus: payments.paymentStatus,
          paymentReference: payments.paymentReference,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .where(eq(payments.studentId, studentId))
        .orderBy(desc(payments.createdAt));

      for (const p of payRows) {
        if (!latestPaymentMap.has(p.courseId)) {
          latestPaymentMap.set(p.courseId, p);
        }
      }
    }

    const enriched = courseRows.map((c) => {
      const activeReg = activeRegMap.get(c.id);
      const latestPay = latestPaymentMap.get(c.id);

      let registrationState: 'registered' | 'pending' | 'failed' | 'not_registered' =
        'not_registered';
      if (activeReg) {
        registrationState = 'registered';
      } else if (latestPay?.paymentStatus === 'pending') {
        registrationState = 'pending';
      } else if (latestPay?.paymentStatus === 'failed') {
        registrationState = 'failed';
      }

      return {
        ...c,
        courseValue: Number(c.courseValue ?? 2300),
        registrationFee: Number(c.registrationFee ?? 2350),
        isRegistered: Boolean(activeReg),
        registrationState,
        registeredAt: activeReg?.registeredAt ?? null,
        latestPaymentStatus: activeReg
          ? 'successful'
          : (latestPay?.paymentStatus as
              | 'pending'
              | 'successful'
              | 'failed'
              | 'refunded'
              | undefined) ?? null,
        latestPaymentReference:
          activeReg?.paymentReference ?? latestPay?.paymentReference ?? null,
      };
    });

    res.json({ courses: enriched });
  } catch (err) {
    handleApiError(res, err, 'fetching course catalogue');
  }
});

// Student's actively registered courses ONLY
router.get('/my-courses', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const studentId = req.user!.id;

    const rows = await db
      .select({
        registrationId: courseRegistrations.id,
        courseId: courses.id,
        code: courses.code,
        title: courses.title,
        level: courses.level,
        description: courses.description,
        examCategory: courses.examCategory,
        defaultDurationMinutes: courses.defaultDurationMinutes,
        whatsappGroupLink: courses.whatsappGroupLink,
        registrationStatus: courseRegistrations.registrationStatus,
        registeredAt: courseRegistrations.registeredAt,
        whatsappNumber: sql<string | null>`COALESCE(${courseRegistrations.whatsappNumber}, ${payments.whatsappNumber})`,
        paymentId: courseRegistrations.paymentId,
        paymentReference: sql<string>`COALESCE(${payments.paymentReference}, ${courseRegistrations.preservedPaymentRef}, 'PRESERVED-REG')`,
        paymentStatus: sql<string>`COALESCE(${payments.paymentStatus}, 'successful')`,
        courseValue: sql<string>`COALESCE(${payments.courseValue}, ${courses.courseValue}, '2300.00')`,
        amountPaid: sql<string>`COALESCE(${payments.totalAmountCharged}, ${courseRegistrations.preservedAmountPaid}, ${courses.registrationFee}, '2350.00')`,
        currency: sql<string>`COALESCE(${payments.currency}, ${courses.currency}, 'NGN')`,
        paidAt: sql<Date | null>`COALESCE(${payments.paidAt}, ${courseRegistrations.registeredAt})`,
        questionCount: sql<number>`(
          SELECT COUNT(*)::int FROM questions q
          WHERE (
            q.course_id = ${courses.id}
            OR (q.course_id IS NULL AND ${courses.subjectId} IS NOT NULL AND q.subject_id = ${courses.subjectId})
          )
          AND q.is_active = TRUE
        )`,
      })
      .from(courseRegistrations)
      .innerJoin(courses, eq(courseRegistrations.courseId, courses.id))
      .leftJoin(payments, eq(courseRegistrations.paymentId, payments.id))
      .where(
        and(
          eq(courseRegistrations.studentId, studentId),
          eq(courseRegistrations.registrationStatus, 'active'),
          or(
            eq(payments.paymentStatus, 'successful'),
            and(
              isNull(courseRegistrations.paymentId),
              isNotNull(courseRegistrations.preservedPaymentRef)
            )
          ),
          eq(courses.isActive, true)
        )
      )
      .orderBy(desc(courseRegistrations.registeredAt));

    res.json({
      registeredCourses: rows.map((r) => ({
        ...r,
        courseValue: Number(r.courseValue ?? 2300),
        amountPaid: Number(r.amountPaid ?? 2350),
      })),
    });
  } catch (err) {
    handleApiError(res, err, 'fetching registered courses');
  }
});

// Legacy compatibility endpoint
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
      })
      .from(subjects)
      .where(eq(subjects.isActive, true))
      .orderBy(subjects.name);

    res.json({ subjects: subjectRows });
  } catch (err) {
    handleApiError(res, err, 'fetching legacy subjects');
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
        courseId: examSessions.courseId,
        courseCode: courses.code,
        courseTitle: courses.title,
        legacySubjectName: subjects.name,
        scorePercentage: examSessions.scorePercentage,
        correctCount: examSessions.correctCount,
        totalQuestions: examSessions.totalQuestions,
        submittedAt: examSessions.submittedAt,
      })
      .from(examSessions)
      .leftJoin(courses, eq(examSessions.courseId, courses.id))
      .leftJoin(subjects, eq(examSessions.subjectId, subjects.id))
      .where(
        and(eq(examSessions.userId, userId), eq(examSessions.status, 'submitted'))
      )
      .orderBy(desc(examSessions.submittedAt));

    const first = recentSessions[0] || null;
    const lastAttempt = first
      ? {
          id: first.id,
          courseId: first.courseId || '',
          courseCode: first.courseCode || '',
          courseTitle: first.courseTitle || first.legacySubjectName || 'Course Exam',
          scorePercentage: first.scorePercentage,
          correctCount: first.correctCount,
          totalQuestions: first.totalQuestions,
          submittedAt: first.submittedAt,
        }
      : null;

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
