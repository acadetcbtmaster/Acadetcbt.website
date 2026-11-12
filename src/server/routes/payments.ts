import { and, desc, eq } from 'drizzle-orm';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/index.js';
import { courseRegistrations, courses, payments } from '../../db/schema.js';
import { writeAuditLog } from '../lib/audit.js';
import {
  PaymentValidationError,
  settlePaystackTransaction,
} from '../lib/paymentSettlement.js';
import {
  generatePaymentReference,
  getPaystackPublicKey,
  initializePaystackTransaction,
  isPaystackConfigured,
  nairaToKobo,
  PaystackGatewayError,
  PaystackNotConfiguredError,
  verifyPaystackTransaction,
} from '../lib/paystack.js';
import { handleApiError, requireAuth } from '../middleware/auth.js';

const router = Router();

const initSchema = z.object({
  courseId: z.string().uuid('Valid courseId is required'),
});

const verifyBodySchema = z.object({
  reference: z.string().trim().min(4, 'Payment reference is required').max(120),
});

function resolveCallbackUrl(req: Request): string {
  const configured = process.env.PAYSTACK_CALLBACK_URL?.trim();
  if (configured) {
    return configured;
  }
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    return appUrl.replace(/\/$/, '') + '/';
  }
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() ||
    req.protocol ||
    'https';
  const host = req.get('host');
  if (host) {
    return `${proto}://${host}/`;
  }
  return 'http://localhost:3000/';
}

router.get('/config', (_req, res) => {
  res.json({
    configured: isPaystackConfigured(),
    publicKey: getPaystackPublicKey(),
  });
});

router.post('/initialize', requireAuth, async (req, res) => {
  try {
    const parsed = initSchema.parse(req.body);
    const db = getDb();
    const student = req.user!;

    if (!isPaystackConfigured()) {
      res.status(503).json({
        error: 'Paystack payment gateway is not configured on the server.',
        code: 'PAYSTACK_NOT_CONFIGURED',
      });
      return;
    }

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

    // Prevent duplicate payment for an already-registered course
    const existingReg = await db
      .select({ id: courseRegistrations.id })
      .from(courseRegistrations)
      .where(
        and(
          eq(courseRegistrations.studentId, student.id),
          eq(courseRegistrations.courseId, course.id),
          eq(courseRegistrations.registrationStatus, 'active')
        )
      )
      .limit(1);

    if (existingReg.length > 0) {
      res.status(409).json({
        error: `You have already registered for ${course.code} — ${course.title}.`,
        code: 'ALREADY_REGISTERED',
      });
      return;
    }

    const amountKobo = nairaToKobo(course.registrationFee);
    if (amountKobo <= 0) {
      res.status(400).json({
        error: 'This course does not have a valid payable registration fee configured.',
      });
      return;
    }

    const reference = generatePaymentReference();
    const currency = (course.currency || 'NGN').toUpperCase();
    const callbackUrl = resolveCallbackUrl(req);

    // Create pending payment record first with the authoritative DB fee snapshot
    const [pendingPayment] = await db
      .insert(payments)
      .values({
        studentId: student.id,
        courseId: course.id,
        paymentReference: reference,
        gateway: 'paystack',
        amount: course.registrationFee,
        currency,
        paymentStatus: 'pending',
      })
      .returning();

    let paystackInit;
    try {
      paystackInit = await initializePaystackTransaction({
        email: student.email,
        amountKobo,
        currency,
        reference,
        callbackUrl,
        metadata: {
          student_id: student.id,
          student_name: student.fullName,
          course_id: course.id,
          course_code: course.code,
          course_title: course.title,
          expected_amount_kobo: amountKobo,
          expected_currency: currency,
        },
      });
    } catch (initErr) {
      await db
        .update(payments)
        .set({
          paymentStatus: 'failed',
          gatewayResponse: {
            initError: initErr instanceof Error ? initErr.message : 'Initialization failed',
          },
          updatedAt: new Date(),
        })
        .where(eq(payments.id, pendingPayment.id));
      throw initErr;
    }

    await db
      .update(payments)
      .set({
        authorizationUrl: paystackInit.authorization_url,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, pendingPayment.id));

    await writeAuditLog({
      actorUserId: student.id,
      action: 'payment.initialize',
      entityType: 'payment',
      entityId: pendingPayment.id,
      metadata: {
        reference,
        courseId: course.id,
        courseCode: course.code,
        amount: course.registrationFee,
        currency,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      paymentId: pendingPayment.id,
      reference,
      authorizationUrl: paystackInit.authorization_url,
      accessCode: paystackInit.access_code,
      amount: Number(course.registrationFee),
      currency,
      course: {
        id: course.id,
        code: course.code,
        title: course.title,
        level: course.level,
      },
    });
  } catch (err) {
    if (err instanceof PaystackNotConfiguredError) {
      res.status(503).json({ error: err.message, code: 'PAYSTACK_NOT_CONFIGURED' });
      return;
    }
    if (err instanceof PaystackGatewayError) {
      res.status(err.statusCode).json({ error: err.message, code: 'PAYSTACK_GATEWAY_ERROR' });
      return;
    }
    handleApiError(res, err, 'initializing Paystack payment');
  }
});

async function handleVerifyRequest(req: Request, reference: string, res: import('express').Response) {
  try {
    const db = getDb();
    const [existingPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.paymentReference, reference))
      .limit(1);

    if (!existingPayment) {
      res.status(404).json({ error: 'Payment transaction reference not found.' });
      return;
    }

    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';
    if (existingPayment.studentId !== req.user!.id && !isAdmin) {
      res.status(403).json({ error: 'You are not authorized to verify this payment.' });
      return;
    }

    // If already verified and active, settlePaystackTransaction isn't even needed to call Paystack again unless desired,
    // or verify directly if still pending/failed
    if (existingPayment.paymentStatus === 'successful') {
      const outcome = await settlePaystackTransaction({
        paystackData: {
          id: existingPayment.gatewayTransactionId || existingPayment.id,
          status: 'success',
          reference: existingPayment.paymentReference,
          amount: nairaToKobo(existingPayment.amount),
          currency: existingPayment.currency,
          paid_at: existingPayment.paidAt ? existingPayment.paidAt.toISOString() : null,
        },
        actorUserId: req.user!.id,
        source: 'verify_endpoint',
        ipAddress: req.ip,
      });
      res.json(outcome);
      return;
    }

    const paystackData = await verifyPaystackTransaction(reference);
    const outcome = await settlePaystackTransaction({
      paystackData,
      actorUserId: req.user!.id,
      source: 'verify_endpoint',
      ipAddress: req.ip,
    });

    res.json(outcome);
  } catch (err) {
    if (err instanceof PaystackNotConfiguredError) {
      res.status(503).json({ error: err.message, code: 'PAYSTACK_NOT_CONFIGURED' });
      return;
    }
    if (err instanceof PaystackGatewayError) {
      res.status(err.statusCode).json({ error: err.message, code: 'PAYSTACK_GATEWAY_ERROR' });
      return;
    }
    if (err instanceof PaymentValidationError) {
      res.status(err.statusCode).json({ error: err.message, code: 'PAYMENT_VALIDATION_FAILED' });
      return;
    }
    handleApiError(res, err, 'verifying payment');
  }
}

router.get('/verify/:reference', requireAuth, async (req, res) => {
  const reference = req.params.reference?.trim();
  if (!reference) {
    res.status(400).json({ error: 'Payment reference is required.' });
    return;
  }
  await handleVerifyRequest(req, reference, res);
});

router.post('/verify', requireAuth, async (req, res) => {
  try {
    const parsed = verifyBodySchema.parse(req.body);
    await handleVerifyRequest(req, parsed.reference, res);
  } catch (err) {
    handleApiError(res, err, 'verifying payment');
  }
});

router.get('/my', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: payments.id,
        courseId: payments.courseId,
        courseCode: courses.code,
        courseTitle: courses.title,
        paymentReference: payments.paymentReference,
        gateway: payments.gateway,
        amount: payments.amount,
        currency: payments.currency,
        paymentStatus: payments.paymentStatus,
        gatewayTransactionId: payments.gatewayTransactionId,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .innerJoin(courses, eq(payments.courseId, courses.id))
      .where(eq(payments.studentId, req.user!.id))
      .orderBy(desc(payments.createdAt))
      .limit(100);

    res.json({
      payments: rows.map((r) => ({
        ...r,
        amount: Number(r.amount),
      })),
    });
  } catch (err) {
    handleApiError(res, err, 'listing student payments');
  }
});

export default router;
