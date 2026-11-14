import { and, eq } from 'drizzle-orm';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { getDb, getPool } from '../../db/index.js';
import { courseRegistrations, courses, payments, users } from '../../db/schema.js';
import { writeAuditLog } from '../lib/audit.js';
import { normalizeWhatsappGroupLink } from '../lib/notifications.js';
import {
  buildPaymentReceiptById,
  PaymentValidationError,
  verifyAndSettleStudentReference,
} from '../lib/paymentSettlement.js';
import {
  generatePaymentReference,
  getPaystackPublicKey,
  initializePaystackTransaction,
  isPaystackConfigured,
  PaystackGatewayError,
  PaystackNotConfiguredError,
} from '../lib/paystack.js';
import {
  COURSE_VALUE_KOBO,
  COURSE_VALUE_NAIRA,
  FEE_ABSORBER_LABEL,
  STANDARD_CURRENCY,
  TOTAL_STUDENT_PAYABLE_KOBO,
  TOTAL_STUDENT_PAYABLE_NAIRA,
} from '../lib/pricing.js';
import { handleApiError, requireAuth } from '../middleware/auth.js';

const router = Router();

const WHATSAPP_NUMBER_REGEX = /^\+?\d{10,15}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeWhatsappNumber(value: string): string {
  return value.trim().replace(/[\s()-]/g, '');
}

const initSchema = z.object({
  courseId: z.string().uuid('Valid courseId is required'),
  whatsappNumber: z
    .string('Please input your correct WhatsApp number.')
    .transform(normalizeWhatsappNumber)
    .refine((val) => WHATSAPP_NUMBER_REGEX.test(val), {
      message:
        'Please input your correct WhatsApp number (10 to 15 digits, e.g. 08012345678).',
    }),
});

const verifyBodySchema = z.object({
  reference: z.string().trim().min(4, 'Payment reference is required').max(120),
  source: z.enum(['student_manual', 'callback']).optional(),
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
    pricing: {
      courseValue: COURSE_VALUE_NAIRA,
      totalAmountPayable: TOTAL_STUDENT_PAYABLE_NAIRA,
      currency: STANDARD_CURRENCY,
      feeAbsorbedBy: FEE_ABSORBER_LABEL,
    },
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

    // Authoritative standardized pricing structure:
    // Course value = ₦2,300; Paystack processing fees absorbed by Acadet CBT; Total payable = ₦2,350.
    const amountKobo = TOTAL_STUDENT_PAYABLE_KOBO;
    if (amountKobo > TOTAL_STUDENT_PAYABLE_KOBO || amountKobo <= 0) {
      res.status(400).json({
        error: 'Configured student payable amount violates platform pricing cap.',
      });
      return;
    }

    const reference = generatePaymentReference();
    const currency = STANDARD_CURRENCY;
    const callbackUrl = resolveCallbackUrl(req);

    // Save latest verified/entered WhatsApp number on student's profile for convenience
    await db
      .update(users)
      .set({
        whatsappNumber: parsed.whatsappNumber,
        updatedAt: new Date(),
      })
      .where(eq(users.id, student.id));

    // Create pending payment record first with the authoritative DB pricing snapshot
    const [pendingPayment] = await db
      .insert(payments)
      .values({
        studentId: student.id,
        courseId: course.id,
        paymentReference: reference,
        gateway: 'paystack',
        whatsappNumber: parsed.whatsappNumber,
        courseValue: COURSE_VALUE_NAIRA.toFixed(2),
        totalAmountCharged: TOTAL_STUDENT_PAYABLE_NAIRA.toFixed(2),
        amount: TOTAL_STUDENT_PAYABLE_NAIRA.toFixed(2),
        currency,
        reconciliationStatus: 'pending',
        feeAbsorbedBy: FEE_ABSORBER_LABEL,
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
          whatsapp_number: parsed.whatsappNumber,
          course_id: course.id,
          course_code: course.code,
          course_title: course.title,
          course_value_kobo: COURSE_VALUE_KOBO,
          expected_amount_kobo: amountKobo,
          expected_currency: currency,
          fee_absorbed_by: FEE_ABSORBER_LABEL,
        },
      });
    } catch (initErr) {
      await db
        .update(payments)
        .set({
          paymentStatus: 'failed',
          reconciliationStatus: 'not_applicable',
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
        whatsappNumber: parsed.whatsappNumber,
        courseValue: COURSE_VALUE_NAIRA,
        totalAmountCharged: TOTAL_STUDENT_PAYABLE_NAIRA,
        feeAbsorbedBy: FEE_ABSORBER_LABEL,
        currency,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      paymentId: pendingPayment.id,
      reference,
      authorizationUrl: paystackInit.authorization_url,
      accessCode: paystackInit.access_code,
      courseValue: COURSE_VALUE_NAIRA,
      amount: TOTAL_STUDENT_PAYABLE_NAIRA,
      feeAbsorbedBy: FEE_ABSORBER_LABEL,
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

async function handleVerifyRequest(
  req: Request,
  reference: string,
  source: 'student_manual' | 'callback',
  res: import('express').Response
) {
  try {
    const outcome = await verifyAndSettleStudentReference({
      reference,
      requestingUser: {
        id: req.user!.id,
        email: req.user!.email,
        fullName: req.user!.fullName,
        role: req.user!.role,
        whatsappNumber: req.user!.whatsappNumber,
      },
      source,
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
      res.status(err.statusCode).json({
        error: err.message,
        code:
          err.statusCode === 403
            ? 'PAYMENT_OWNERSHIP_MISMATCH'
            : err.statusCode === 409
              ? 'PAYMENT_DUPLICATE_TRANSACTION'
              : 'PAYMENT_VALIDATION_FAILED',
        verificationResult:
          err.statusCode === 403 ? 'unauthorized_or_mismatch' : undefined,
      });
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
  const sourceParam =
    req.query.source === 'manual' || req.query.source === 'student_manual'
      ? 'student_manual'
      : 'callback';
  await handleVerifyRequest(req, reference, sourceParam, res);
});

router.post('/verify', requireAuth, async (req, res) => {
  try {
    const parsed = verifyBodySchema.parse(req.body);
    await handleVerifyRequest(req, parsed.reference, parsed.source ?? 'student_manual', res);
  } catch (err) {
    handleApiError(res, err, 'verifying payment');
  }
});

router.get('/:id/receipt', requireAuth, async (req, res) => {
  try {
    const paymentId = req.params.id?.trim();
    if (!paymentId || !UUID_REGEX.test(paymentId)) {
      res.status(400).json({ error: 'Invalid payment ID.' });
      return;
    }

    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';
    const receipt = await buildPaymentReceiptById(paymentId, isAdmin ? null : req.user!.id);

    if (!receipt) {
      res.status(404).json({
        error: 'Official receipt is only available for verified successful payments.',
      });
      return;
    }

    res.json({ receipt });
  } catch (err) {
    if (err instanceof PaymentValidationError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    handleApiError(res, err, 'fetching official payment receipt');
  }
});

router.get('/my', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const resDb = await pool.query<{
      id: string;
      courseId: string;
      courseCode: string;
      courseTitle: string;
      courseLevel: string;
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
      paymentStatus: 'pending' | 'successful' | 'failed' | 'refunded';
      authorizationUrl: string | null;
      gatewayTransactionId: string | null;
      paidAt: Date | null;
      createdAt: Date;
      registrationStatus: string | null;
      registeredAt: Date | null;
      whatsappGroupLink: string | null;
    }>(
      `SELECT DISTINCT ON (p.id, p.created_at)
         p.id,
         p.course_id AS "courseId",
         c.code AS "courseCode",
         c.title AS "courseTitle",
         c.level AS "courseLevel",
         p.payment_reference AS "paymentReference",
         p.gateway,
         COALESCE(cr.whatsapp_number, p.whatsapp_number) AS "whatsappNumber",
         p.course_value::text AS "courseValue",
         p.total_amount_charged::text AS "totalAmountCharged",
         p.amount::text AS amount,
         p.currency,
         p.gateway_fee::text AS "gatewayFee",
         p.gateway_fee_source AS "gatewayFeeSource",
         p.net_settlement_amount::text AS "netSettlementAmount",
         p.settlement_variance::text AS "settlementVariance",
         p.reconciliation_status AS "reconciliationStatus",
         p.fee_absorbed_by AS "feeAbsorbedBy",
         p.payment_channel AS "paymentChannel",
         p.payment_status AS "paymentStatus",
         CASE WHEN p.payment_status = 'pending' THEN p.authorization_url ELSE NULL END AS "authorizationUrl",
         p.gateway_transaction_id AS "gatewayTransactionId",
         p.paid_at AS "paidAt",
         p.created_at AS "createdAt",
         cr.registration_status AS "registrationStatus",
         cr.registered_at AS "registeredAt",
         c.whatsapp_group_link AS "whatsappGroupLink"
       FROM payments p
       INNER JOIN courses c ON c.id = p.course_id
       LEFT JOIN course_registrations cr
         ON (cr.payment_id = p.id OR (cr.student_id = p.student_id AND cr.course_id = p.course_id AND cr.registration_status = 'active'))
       WHERE p.student_id = $1
       ORDER BY p.created_at DESC, p.id, (cr.registration_status = 'active') DESC NULLS LAST
       LIMIT 100`,
      [req.user!.id]
    );

    res.json({
      payments: resDb.rows.map((r) => {
        const isActive =
          r.paymentStatus === 'successful' && r.registrationStatus === 'active';
        return {
          ...r,
          courseValue: Number(r.courseValue),
          totalAmountCharged: Number(r.totalAmountCharged),
          amount: Number(r.amount),
          gatewayFee: r.gatewayFee !== null ? Number(r.gatewayFee) : null,
          netSettlementAmount:
            r.netSettlementAmount !== null ? Number(r.netSettlementAmount) : null,
          settlementVariance:
            r.settlementVariance !== null ? Number(r.settlementVariance) : null,
          registrationStatus:
            r.registrationStatus ||
            (r.paymentStatus === 'successful' ? 'active' : 'not_activated'),
          whatsappGroupLink: isActive
            ? normalizeWhatsappGroupLink(r.whatsappGroupLink)
            : null,
        };
      }),
    });
  } catch (err) {
    handleApiError(res, err, 'listing student payments');
  }
});

export default router;

