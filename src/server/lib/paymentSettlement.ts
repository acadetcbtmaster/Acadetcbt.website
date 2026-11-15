import { getPool } from '../../db/index.js';
import { writeAuditLog } from './audit.js';
import { generatePaymentSuccessNotification, normalizeWhatsappGroupLink } from './notifications.js';
import {
  isValidPaymentReferenceFormat,
  nairaToKobo,
  PaystackReferenceNotFoundError,
  verifyPaystackTransaction,
  type PaystackVerifyData,
} from './paystack.js';
import {
  COURSE_VALUE_KOBO,
  COURSE_VALUE_NAIRA,
  FEE_ABSORBER_LABEL,
  koboToNaira,
  reconcileCoursePayment,
  STANDARD_CURRENCY,
  TOTAL_STUDENT_PAYABLE_NAIRA,
} from './pricing.js';

export type PaymentVerificationResult =
  | 'successful'
  | 'already_registered'
  | 'pending'
  | 'failed'
  | 'not_found'
  | 'awaiting_admin_review'
  | 'unauthorized_or_mismatch';

export interface PaymentReceiptData {
  paymentId: string;
  studentName: string;
  studentEmail: string;
  whatsappNumber: string | null;
  courseId: string;
  courseTitle: string;
  courseCode: string;
  courseValue: number;
  amountPaid: number;
  currency: string;
  paymentReference: string;
  paymentGateway: string;
  paymentChannel: string | null;
  gatewayTransactionId: string | null;
  paymentDate: string;
  paymentStatus: 'SUCCESSFUL';
  registrationStatus: 'ACTIVE';
  whatsappGroupLink: string | null;
}

export interface SettlementOutcome {
  verificationResult?: PaymentVerificationResult;
  paymentStatus: 'pending' | 'successful' | 'failed' | 'refunded' | 'not_found';
  alreadyProcessed: boolean;
  unlocked: boolean;
  message: string;
  payment: {
    id: string;
    studentId: string;
    courseId: string;
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
  } | null;
  registration: {
    id: string;
    studentId: string;
    courseId: string;
    paymentId: string;
    whatsappNumber: string | null;
    registrationStatus: string;
    registeredAt: Date;
  } | null;
  course: {
    id: string;
    code: string;
    title: string;
    courseValue: string;
    registrationFee: string;
    currency: string;
    whatsappGroupLink?: string | null;
  } | null;
  receipt?: PaymentReceiptData | null;
}

export class PaymentValidationError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'PaymentValidationError';
    this.statusCode = statusCode;
  }
}

interface LockedPaymentRow {
  id: string;
  student_id: string;
  course_id: string;
  payment_reference: string;
  gateway: string;
  whatsapp_number: string | null;
  course_value: string;
  total_amount_charged: string;
  amount: string;
  currency: string;
  gateway_fee: string | null;
  gateway_fee_source: string | null;
  net_settlement_amount: string | null;
  settlement_variance: string | null;
  reconciliation_status: string;
  fee_absorbed_by: string;
  payment_channel: string | null;
  payment_status: string;
  gateway_transaction_id: string | null;
  paid_at: Date | null;
  created_at: Date;
}

const PAYMENT_RETURNING_COLS = `id, student_id, course_id, payment_reference, gateway, whatsapp_number, course_value::text, total_amount_charged::text, amount::text, currency, gateway_fee::text, gateway_fee_source, net_settlement_amount::text, settlement_variance::text, reconciliation_status, fee_absorbed_by, payment_channel, payment_status, gateway_transaction_id, paid_at, created_at`;

function mapPaymentOutcome(row: LockedPaymentRow): SettlementOutcome['payment'] {
  return {
    id: row.id,
    studentId: row.student_id,
    courseId: row.course_id,
    paymentReference: row.payment_reference,
    gateway: row.gateway,
    whatsappNumber: row.whatsapp_number,
    courseValue: row.course_value,
    totalAmountCharged: row.total_amount_charged,
    amount: row.amount,
    currency: row.currency,
    gatewayFee: row.gateway_fee,
    gatewayFeeSource: row.gateway_fee_source,
    netSettlementAmount: row.net_settlement_amount,
    settlementVariance: row.settlement_variance,
    reconciliationStatus: row.reconciliation_status,
    feeAbsorbedBy: row.fee_absorbed_by,
    paymentChannel: row.payment_channel,
    paymentStatus: row.payment_status,
    gatewayTransactionId: row.gateway_transaction_id,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

export async function settlePaystackTransaction(params: {
  paystackData: PaystackVerifyData;
  actorUserId?: string | null;
  source: 'verify_endpoint' | 'webhook' | 'admin_reverify';
  ipAddress?: string;
}): Promise<SettlementOutcome> {
  const { paystackData, actorUserId, source, ipAddress } = params;
  const reference = String(paystackData.reference || '').trim();
  if (!reference) {
    throw new PaymentValidationError('Missing transaction reference from Paystack.', 400);
  }

  const pool = getPool();
  const client = await pool.connect();

  let outcome: SettlementOutcome;

  try {
    await client.query('BEGIN');

    const lockedPaymentRes = await client.query<LockedPaymentRow>(
      `SELECT ${PAYMENT_RETURNING_COLS}
       FROM payments
       WHERE payment_reference = $1
       FOR UPDATE`,
      [reference]
    );

    if (lockedPaymentRes.rows.length === 0) {
      throw new PaymentValidationError(
        `No matching payment record found for reference ${reference}.`,
        404
      );
    }

    const pRow = lockedPaymentRes.rows[0];
    const courseRes = await client.query<{
      id: string;
      code: string;
      title: string;
      course_value: string;
      registration_fee: string;
      currency: string;
    }>(
      `SELECT id, code, title, course_value::text, registration_fee::text, currency FROM courses WHERE id = $1 LIMIT 1`,
      [pRow.course_id]
    );
    const cRow = courseRes.rows[0] || null;
    const mappedCourse = cRow
      ? {
          id: cRow.id,
          code: cRow.code,
          title: cRow.title,
          courseValue: cRow.course_value,
          registrationFee: cRow.registration_fee,
          currency: cRow.currency,
        }
      : null;

    // Ensure Paystack verified reference matches the locked payment reference
    if (reference !== pRow.payment_reference) {
      throw new PaymentValidationError(
        `Transaction reference mismatch: expected ${pRow.payment_reference}, received ${reference}.`,
        400
      );
    }

    // If payment already settled successfully, return idempotently without duplicating registration
    if (pRow.payment_status === 'successful') {
      const existingReg = await client.query<{
        id: string;
        student_id: string;
        course_id: string;
        payment_id: string;
        whatsapp_number: string | null;
        registration_status: string;
        registered_at: Date;
      }>(
        `SELECT id, student_id, course_id, payment_id, whatsapp_number, registration_status, registered_at
         FROM course_registrations
         WHERE student_id = $1 AND course_id = $2 AND registration_status = 'active'
         LIMIT 1`,
        [pRow.student_id, pRow.course_id]
      );

      await client.query('COMMIT');
      const isShortfall = pRow.reconciliation_status === 'shortfall';
      return {
        verificationResult:
          existingReg.rows.length > 0 && !isShortfall ? 'already_registered' : 'awaiting_admin_review',
        paymentStatus: 'successful',
        alreadyProcessed: true,
        unlocked: existingReg.rows.length > 0 && !isShortfall,
        message:
          isShortfall && existingReg.rows.length === 0
            ? `Payment recorded with a net settlement shortfall below the ₦${Number(pRow.course_value || COURSE_VALUE_NAIRA).toLocaleString()} course value. Admin reconciliation required.`
            : 'This payment has already been verified. Your course registration is active.',
        payment: mapPaymentOutcome(pRow),
        registration: existingReg.rows[0]
          ? {
              id: existingReg.rows[0].id,
              studentId: existingReg.rows[0].student_id,
              courseId: existingReg.rows[0].course_id,
              paymentId: existingReg.rows[0].payment_id,
              whatsappNumber: existingReg.rows[0].whatsapp_number,
              registrationStatus: existingReg.rows[0].registration_status,
              registeredAt: existingReg.rows[0].registered_at,
            }
          : null,
        course: mappedCourse,
      };
    }

    const gatewayStatus = String(paystackData.status || '').toLowerCase();

    if (gatewayStatus === 'success') {
      const gatewayTxIdCheck =
        paystackData.id !== undefined && paystackData.id !== null
          ? String(paystackData.id).trim()
          : null;
      if (gatewayTxIdCheck) {
        const duplicateTx = await client.query<{ id: string }>(
          `SELECT id FROM payments
           WHERE gateway_transaction_id = $1
             AND id <> $2
             AND payment_status = 'successful'
           LIMIT 1`,
          [gatewayTxIdCheck, pRow.id]
        );
        if (duplicateTx.rows.length > 0) {
          throw new PaymentValidationError(
            'This Paystack transaction has already been used for another course registration.',
            409
          );
        }
      }
      const expectedKobo = nairaToKobo(pRow.total_amount_charged || pRow.amount);
      const actualKobo = Number(paystackData.amount);
      const reportedFeesKobo =
        typeof paystackData.fees === 'number' && Number.isFinite(paystackData.fees)
          ? Math.round(paystackData.fees)
          : null;

      // Detect Paystack dashboard "Pass fees to customers" gross-up against course expectedKobo
      const isPaystackFeePassThrough =
        reportedFeesKobo !== null &&
        reportedFeesKobo > 0 &&
        expectedKobo > 0 &&
        Number.isFinite(actualKobo) &&
        actualKobo > expectedKobo &&
        Math.abs(actualKobo - reportedFeesKobo - expectedKobo) <= 1;

      if (!Number.isFinite(actualKobo) || (actualKobo > expectedKobo && !isPaystackFeePassThrough)) {
        throw new PaymentValidationError(
          `Student charge exceeds configured course price ₦${koboToNaira(expectedKobo).toLocaleString()} (${expectedKobo} kobo): received ${actualKobo} kobo. In Paystack Dashboard → Settings → Preferences → Transaction fees, uncheck "Pass fees to customers" so Acadet CBT absorbs the charges.`,
          400
        );
      }

      if (actualKobo !== expectedKobo && !isPaystackFeePassThrough) {
        throw new PaymentValidationError(
          `Payment amount mismatch: expected ${expectedKobo} kobo, received ${actualKobo} kobo.`,
          400
        );
      }

      const expectedCurrency = String(pRow.currency || STANDARD_CURRENCY).toUpperCase();
      const actualCurrency = String(paystackData.currency || '').toUpperCase();
      if (actualCurrency !== expectedCurrency) {
        throw new PaymentValidationError(
          `Payment currency mismatch: expected ${expectedCurrency}, received ${actualCurrency}.`,
          400
        );
      }

      const metaCourseId = paystackData.metadata?.course_id;
      if (typeof metaCourseId === 'string' && metaCourseId !== pRow.course_id) {
        throw new PaymentValidationError(
          'Transaction metadata course_id does not match the initialized course.',
          400
        );
      }

      const metaStudentId = paystackData.metadata?.student_id;
      if (typeof metaStudentId === 'string' && metaStudentId !== pRow.student_id) {
        throw new PaymentValidationError(
          'Transaction metadata student_id does not match the initialized student.',
          400
        );
      }

      // Compute actual Paystack transaction charges and verify net settlement covers ₦2,300 course value
      const courseValueKobo = pRow.course_value
        ? nairaToKobo(pRow.course_value)
        : COURSE_VALUE_KOBO;

      const reconciliation = reconcileCoursePayment({
        totalChargedKobo: actualKobo,
        courseValueKobo,
        currency: actualCurrency,
        channel: paystackData.channel || paystackData.authorization?.channel || null,
        countryCode: paystackData.authorization?.country_code || null,
        gatewayReportedFeesKobo: reportedFeesKobo,
      });

      const paidAt = paystackData.paid_at ? new Date(paystackData.paid_at) : new Date();
      const gatewayTxId =
        paystackData.id !== undefined && paystackData.id !== null
          ? String(paystackData.id)
          : null;

      const metaWhatsapp =
        typeof paystackData.metadata?.whatsapp_number === 'string'
          ? paystackData.metadata.whatsapp_number.trim()
          : null;
      const resolvedWhatsapp = pRow.whatsapp_number || metaWhatsapp || null;
      const resolvedChannel =
        paystackData.channel || paystackData.authorization?.channel || null;
      const resolvedFeeBearer = isPaystackFeePassThrough
        ? 'Customer (Paystack Pass-Through)'
        : FEE_ABSORBER_LABEL;

      const updatedPay = await client.query<LockedPaymentRow>(
        `UPDATE payments
         SET payment_status = 'successful',
             gateway_transaction_id = $2,
             gateway_response = $3::jsonb,
             paid_at = $4,
             whatsapp_number = COALESCE(whatsapp_number, $5),
             course_value = $6,
             total_amount_charged = $7,
             gateway_fee = $8,
             gateway_fee_source = $9,
             net_settlement_amount = $10,
             settlement_variance = $11,
             reconciliation_status = $12,
             fee_absorbed_by = $13,
             payment_channel = $14,
             updated_at = NOW()
         WHERE id = $1
         RETURNING ${PAYMENT_RETURNING_COLS}`,
        [
          pRow.id,
          gatewayTxId,
          JSON.stringify(paystackData),
          paidAt,
          resolvedWhatsapp,
          reconciliation.courseValueNaira.toFixed(2),
          reconciliation.totalChargedNaira.toFixed(2),
          reconciliation.paystackFeeNaira.toFixed(2),
          reconciliation.feeSource,
          reconciliation.netSettlementNaira.toFixed(2),
          reconciliation.settlementVarianceNaira.toFixed(2),
          reconciliation.reconciliationStatus,
          resolvedFeeBearer,
          resolvedChannel,
        ]
      );

      let regRow: {
        id: string;
        student_id: string;
        course_id: string;
        payment_id: string;
        whatsapp_number: string | null;
        registration_status: string;
        registered_at: Date;
      } | null = null;

      if (reconciliation.coversCourseValue) {
        const existingActive = await client.query<{
          id: string;
          student_id: string;
          course_id: string;
          payment_id: string;
          whatsapp_number: string | null;
          registration_status: string;
          registered_at: Date;
        }>(
          `SELECT id, student_id, course_id, payment_id, whatsapp_number, registration_status, registered_at
           FROM course_registrations
           WHERE student_id = $1 AND course_id = $2 AND registration_status = 'active'
           LIMIT 1`,
          [pRow.student_id, pRow.course_id]
        );

        regRow = existingActive.rows[0] || null;
        if (!regRow) {
          const insertedReg = await client.query<{
            id: string;
            student_id: string;
            course_id: string;
            payment_id: string;
            whatsapp_number: string | null;
            registration_status: string;
            registered_at: Date;
          }>(
            `INSERT INTO course_registrations (student_id, course_id, payment_id, whatsapp_number, registration_status, registered_at)
             VALUES ($1, $2, $3, $4, 'active', NOW())
             ON CONFLICT (payment_id) DO NOTHING
             RETURNING id, student_id, course_id, payment_id, whatsapp_number, registration_status, registered_at`,
            [pRow.student_id, pRow.course_id, pRow.id, resolvedWhatsapp]
          );
          regRow = insertedReg.rows[0] || null;
        }
      }

      const finalP = updatedPay.rows[0];
      await client.query('COMMIT');

      outcome = {
        verificationResult: reconciliation.coversCourseValue ? 'successful' : 'awaiting_admin_review',
        paymentStatus: 'successful',
        alreadyProcessed: false,
        unlocked: Boolean(regRow) && reconciliation.coversCourseValue,
        message: reconciliation.coversCourseValue
          ? 'Payment verified successfully! Your course registration is now active.'
          : `Payment received (₦${reconciliation.totalChargedNaira.toLocaleString()}), but net settlement after Paystack fees (₦${reconciliation.netSettlementNaira.toLocaleString()}) is below the ₦${reconciliation.courseValueNaira.toLocaleString()} course value.`,
        payment: mapPaymentOutcome(finalP),
        registration: regRow
          ? {
              id: regRow.id,
              studentId: regRow.student_id,
              courseId: regRow.course_id,
              paymentId: regRow.payment_id,
              whatsappNumber: regRow.whatsapp_number,
              registrationStatus: regRow.registration_status,
              registeredAt: regRow.registered_at,
            }
          : null,
        course: mappedCourse,
      };
    } else if (
      gatewayStatus === 'failed' ||
      gatewayStatus === 'abandoned' ||
      gatewayStatus === 'reversed'
    ) {
      const updatedPay = await client.query<LockedPaymentRow>(
        `UPDATE payments
         SET payment_status = 'failed',
             reconciliation_status = 'not_applicable',
             gateway_transaction_id = COALESCE($2, gateway_transaction_id),
             gateway_response = $3::jsonb,
             updated_at = NOW()
         WHERE id = $1
         RETURNING ${PAYMENT_RETURNING_COLS}`,
        [
          pRow.id,
          paystackData.id ? String(paystackData.id) : null,
          JSON.stringify(paystackData),
        ]
      );
      const finalP = updatedPay.rows[0];
      await client.query('COMMIT');

      outcome = {
        verificationResult: 'failed',
        paymentStatus: 'failed',
        alreadyProcessed: false,
        unlocked: false,
        message: 'Payment verification indicates that this transaction was not successful.',
        payment: mapPaymentOutcome(finalP),
        registration: null,
        course: mappedCourse,
      };
    } else {
      const updatedPay = await client.query<LockedPaymentRow>(
        `UPDATE payments
         SET payment_status = 'pending',
             reconciliation_status = 'pending',
             gateway_response = $2::jsonb,
             updated_at = NOW()
         WHERE id = $1
         RETURNING ${PAYMENT_RETURNING_COLS}`,
        [pRow.id, JSON.stringify(paystackData)]
      );
      const finalP = updatedPay.rows[0];
      await client.query('COMMIT');

      outcome = {
        verificationResult: 'pending',
        paymentStatus: 'pending',
        alreadyProcessed: false,
        unlocked: false,
        message: 'Your payment is still being processed. Please check again shortly.',
        payment: mapPaymentOutcome(finalP),
        registration: null,
        course: mappedCourse,
      };
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (outcome.payment) {
    await writeAuditLog({
      actorUserId: actorUserId ?? outcome.payment.studentId,
      action: `payment.verify.${outcome.paymentStatus}`,
      entityType: 'payment',
      entityId: outcome.payment.id,
      metadata: {
        source,
        reference,
        courseId: outcome.payment.courseId,
        courseValue: outcome.payment.courseValue,
        totalAmountCharged: outcome.payment.totalAmountCharged,
        gatewayFee: outcome.payment.gatewayFee,
        netSettlementAmount: outcome.payment.netSettlementAmount,
        reconciliationStatus: outcome.payment.reconciliationStatus,
        unlocked: outcome.unlocked,
      },
      ipAddress,
    });

    if (outcome.paymentStatus === 'successful' && outcome.unlocked && outcome.registration) {
      try {
        await generatePaymentSuccessNotification({
          studentId: outcome.payment.studentId,
          courseId: outcome.payment.courseId,
          paymentId: outcome.payment.id,
          paymentReference: outcome.payment.paymentReference,
          totalAmountChargedNaira: Number(
            outcome.payment.totalAmountCharged || outcome.payment.amount
          ),
        });
      } catch (notifErr) {
        console.warn('[Notification] Failed creating payment success notification:', notifErr);
      }

      const receipt = await buildPaymentReceiptById(outcome.payment.id);
      if (receipt) {
        outcome.receipt = receipt;
        if (outcome.course && receipt.whatsappGroupLink) {
          outcome.course.whatsappGroupLink = receipt.whatsappGroupLink;
        }
      }
    }
  }

  return outcome;
}

export async function buildPaymentReceiptById(
  paymentId: string,
  expectedStudentId?: string | null
): Promise<PaymentReceiptData | null> {
  const pool = getPool();
  const res = await pool.query<{
    payment_id: string;
    student_id: string | null;
    student_name: string;
    student_email: string;
    whatsapp_number: string | null;
    course_id: string;
    course_title: string;
    course_code: string;
    course_value: string;
    total_amount_charged: string;
    amount: string;
    currency: string;
    payment_reference: string;
    gateway: string;
    payment_channel: string | null;
    gateway_transaction_id: string | null;
    payment_status: string;
    paid_at: Date | null;
    created_at: Date;
    registration_status: string | null;
    whatsapp_group_link: string | null;
  }>(
    `SELECT
       p.id AS payment_id,
       p.student_id,
       COALESCE(u.full_name, 'Acadet CBT Student') AS student_name,
       COALESCE(u.email, '') AS student_email,
       COALESCE(cr.whatsapp_number, p.whatsapp_number, u.whatsapp_number) AS whatsapp_number,
       c.id AS course_id,
       c.title AS course_title,
       c.code AS course_code,
       p.course_value::text AS course_value,
       p.total_amount_charged::text AS total_amount_charged,
       p.amount::text AS amount,
       p.currency,
       p.payment_reference,
       p.gateway,
       p.payment_channel,
       p.gateway_transaction_id,
       p.payment_status,
       p.paid_at,
       p.created_at,
       cr.registration_status,
       c.whatsapp_group_link
     FROM payments p
     LEFT JOIN users u ON u.id = p.student_id
     INNER JOIN courses c ON c.id = p.course_id
     LEFT JOIN course_registrations cr
       ON cr.payment_id = p.id OR (cr.student_id = p.student_id AND cr.course_id = p.course_id AND cr.registration_status = 'active')
     WHERE p.id = $1
     ORDER BY (cr.registration_status = 'active') DESC NULLS LAST
     LIMIT 1`,
    [paymentId]
  );

  const row = res.rows[0];
  if (!row) return null;
  if (expectedStudentId && row.student_id !== expectedStudentId) {
    throw new PaymentValidationError('You are not authorized to access this payment receipt.', 403);
  }
  if (row.payment_status !== 'successful') {
    return null;
  }

  const isActive = row.registration_status === 'active';
  return {
    paymentId: row.payment_id,
    studentName: row.student_name,
    studentEmail: row.student_email,
    whatsappNumber: row.whatsapp_number,
    courseId: row.course_id,
    courseTitle: row.course_title,
    courseCode: row.course_code,
    courseValue: Number(row.course_value || COURSE_VALUE_NAIRA),
    amountPaid: Number(row.total_amount_charged || row.amount || TOTAL_STUDENT_PAYABLE_NAIRA),
    currency: row.currency || STANDARD_CURRENCY,
    paymentReference: row.payment_reference,
    paymentGateway: row.gateway === 'paystack' ? 'Paystack' : row.gateway,
    paymentChannel: row.payment_channel,
    gatewayTransactionId: row.gateway_transaction_id,
    paymentDate: (row.paid_at || row.created_at).toISOString(),
    paymentStatus: 'SUCCESSFUL',
    registrationStatus: 'ACTIVE',
    whatsappGroupLink: isActive ? normalizeWhatsappGroupLink(row.whatsapp_group_link) : null,
  };
}

export async function recordPaymentVerificationLog(params: {
  studentId?: string | null;
  paymentId?: string | null;
  courseId?: string | null;
  paymentReference: string;
  verificationSource: 'student_manual' | 'callback' | 'webhook' | 'admin_reverify' | 'admin_review';
  verificationResult: PaymentVerificationResult;
  paymentStatus?: string | null;
  registrationStatus?: string | null;
  paystackData?: PaystackVerifyData | null;
  reason?: string;
  resolvedBy?: string | null;
  resolutionNote?: string | null;
}): Promise<string> {
  const pool = getPool();
  const pData = params.paystackData;
  const res = await pool.query<{ id: string }>(
    `INSERT INTO payment_verification_logs (
       student_id,
       payment_id,
       course_id,
       payment_reference,
       verification_source,
       verification_result,
       payment_status,
       registration_status,
       paystack_status,
       paystack_amount_kobo,
       paystack_currency,
       paystack_customer_email,
       paystack_transaction_id,
       paystack_payload,
       reason,
       resolved_by,
       resolved_at,
       resolution_note
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8,
       $9, $10, $11, $12, $13, $14::jsonb,
       $15, $16, $17, $18
     )
     RETURNING id`,
    [
      params.studentId || null,
      params.paymentId || null,
      params.courseId || null,
      params.paymentReference,
      params.verificationSource,
      params.verificationResult,
      params.paymentStatus || null,
      params.registrationStatus || null,
      pData ? String(pData.status || '') : null,
      pData && Number.isFinite(Number(pData.amount)) ? Math.round(Number(pData.amount)) : null,
      pData?.currency ? String(pData.currency).toUpperCase() : null,
      pData?.customer?.email ? String(pData.customer.email).trim().toLowerCase() : null,
      pData?.id !== undefined && pData?.id !== null ? String(pData.id) : null,
      JSON.stringify(pData || {}),
      params.reason || '',
      params.resolvedBy || null,
      params.resolvedBy ? new Date() : null,
      params.resolutionNote || null,
    ]
  );
  return res.rows[0].id;
}

export async function verifyAndSettleStudentReference(params: {
  reference: string;
  requestingUser: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    whatsappNumber?: string | null;
  };
  source: 'student_manual' | 'callback' | 'admin_reverify';
  ipAddress?: string;
  verifyFn?: (reference: string) => Promise<PaystackVerifyData>;
}): Promise<SettlementOutcome> {
  const reference = String(params.reference || '').trim();
  const verifyFn = params.verifyFn ?? verifyPaystackTransaction;
  const isAdmin =
    params.requestingUser.role === 'admin' || params.requestingUser.role === 'super_admin';

  if (!isValidPaymentReferenceFormat(reference)) {
    throw new PaymentValidationError(
      'Invalid payment reference format. Please check and enter the full Paystack reference.',
      400
    );
  }

  const pool = getPool();

  // Check if reference already exists locally
  const localPayRes = await pool.query<
    LockedPaymentRow & {
      course_code: string;
      course_title: string;
      course_reg_fee: string;
    }
  >(
    `SELECT p.*, c.code AS course_code, c.title AS course_title, c.registration_fee::text AS course_reg_fee
     FROM payments p
     INNER JOIN courses c ON c.id = p.course_id
     WHERE p.payment_reference = $1
     LIMIT 1`,
    [reference]
  );

  const localPayment = localPayRes.rows[0] || null;

  // CASE A: Local payment record exists
  if (localPayment) {
    // 1. Ownership check — never leak another student's transaction details
    if (localPayment.student_id !== params.requestingUser.id && !isAdmin) {
      await recordPaymentVerificationLog({
        studentId: params.requestingUser.id,
        paymentId: null,
        courseId: null,
        paymentReference: reference,
        verificationSource: params.source,
        verificationResult: 'unauthorized_or_mismatch',
        reason: 'Requested payment reference belongs to another student account.',
      });

      await writeAuditLog({
        actorUserId: params.requestingUser.id,
        action: 'payment.verify.unauthorized_reference',
        entityType: 'payment_reference',
        entityId: reference,
        metadata: { source: params.source },
        ipAddress: params.ipAddress,
      });

      throw new PaymentValidationError(
        'This payment reference does not belong to your student account. Please check your reference or contact support.',
        403
      );
    }

    // 2. If already verified successfully locally, return idempotent receipt & status
    if (localPayment.payment_status === 'successful') {
      const outcome = await settlePaystackTransaction({
        paystackData: {
          id: localPayment.gateway_transaction_id || localPayment.id,
          status: 'success',
          reference: localPayment.payment_reference,
          amount: nairaToKobo(localPayment.total_amount_charged || localPayment.amount),
          fees:
            localPayment.gateway_fee !== null && localPayment.gateway_fee !== undefined
              ? nairaToKobo(localPayment.gateway_fee)
              : null,
          channel: localPayment.payment_channel,
          currency: localPayment.currency,
          paid_at: localPayment.paid_at ? localPayment.paid_at.toISOString() : null,
        },
        actorUserId: params.requestingUser.id,
        source: params.source === 'admin_reverify' ? 'admin_reverify' : 'verify_endpoint',
        ipAddress: params.ipAddress,
      });

      const receipt =
        outcome.unlocked && outcome.payment
          ? await buildPaymentReceiptById(outcome.payment.id)
          : null;
      if (receipt && outcome.course && receipt.whatsappGroupLink) {
        outcome.course.whatsappGroupLink = receipt.whatsappGroupLink;
      }

      const finalResult: PaymentVerificationResult = outcome.unlocked
        ? 'already_registered'
        : 'awaiting_admin_review';

      await recordPaymentVerificationLog({
        studentId: localPayment.student_id,
        paymentId: localPayment.id,
        courseId: localPayment.course_id,
        paymentReference: reference,
        verificationSource: params.source,
        verificationResult: finalResult,
        paymentStatus: 'successful',
        registrationStatus: outcome.unlocked ? 'active' : 'not_activated',
        reason: outcome.message,
      });

      return {
        ...outcome,
        verificationResult: finalResult,
        receipt,
      };
    }

    // 3. Known pending/failed payment -> query Paystack Verify API directly
    let paystackData: PaystackVerifyData;
    try {
      paystackData = await verifyFn(reference);
    } catch (err) {
      if (err instanceof PaystackReferenceNotFoundError) {
        await recordPaymentVerificationLog({
          studentId: localPayment.student_id,
          paymentId: localPayment.id,
          courseId: localPayment.course_id,
          paymentReference: reference,
          verificationSource: params.source,
          verificationResult: 'not_found',
          paymentStatus: localPayment.payment_status,
          registrationStatus: 'not_activated',
          reason: err.message,
        });
        return {
          verificationResult: 'not_found',
          paymentStatus: 'not_found',
          alreadyProcessed: false,
          unlocked: false,
          message:
            'We could not locate this payment reference. Please check the reference and try again.',
          payment: mapPaymentOutcome(localPayment),
          registration: null,
          course: {
            id: localPayment.course_id,
            code: localPayment.course_code,
            title: localPayment.course_title,
            courseValue: localPayment.course_value,
            registrationFee: localPayment.course_reg_fee,
            currency: localPayment.currency,
          },
          receipt: null,
        };
      }
      throw err;
    }

    const settled = await settlePaystackTransaction({
      paystackData,
      actorUserId: params.requestingUser.id,
      source: params.source === 'admin_reverify' ? 'admin_reverify' : 'verify_endpoint',
      ipAddress: params.ipAddress,
    });

    const vResult: PaymentVerificationResult =
      settled.verificationResult ??
      (settled.paymentStatus === 'successful' && settled.unlocked
        ? 'successful'
        : settled.paymentStatus === 'pending'
          ? 'pending'
          : settled.paymentStatus === 'failed'
            ? 'failed'
            : 'awaiting_admin_review');

    await recordPaymentVerificationLog({
      studentId: localPayment.student_id,
      paymentId: localPayment.id,
      courseId: localPayment.course_id,
      paymentReference: reference,
      verificationSource: params.source,
      verificationResult: vResult,
      paymentStatus: settled.paymentStatus,
      registrationStatus: settled.unlocked ? 'active' : 'not_activated',
      paystackData,
      reason: settled.message,
    });

    return {
      ...settled,
      verificationResult: vResult,
    };
  }

  // CASE B: Reference NOT found locally -> Section 5 Recovery Flow via Paystack API
  let paystackData: PaystackVerifyData;
  try {
    paystackData = await verifyFn(reference);
  } catch (err) {
    if (err instanceof PaystackReferenceNotFoundError) {
      await recordPaymentVerificationLog({
        studentId: params.requestingUser.id,
        paymentId: null,
        courseId: null,
        paymentReference: reference,
        verificationSource: params.source,
        verificationResult: 'not_found',
        paymentStatus: 'not_found',
        registrationStatus: 'not_activated',
        reason: 'Payment reference not found in Acadet CBT database or Paystack.',
      });
      return {
        verificationResult: 'not_found',
        paymentStatus: 'not_found',
        alreadyProcessed: false,
        unlocked: false,
        message:
          'We could not locate this payment reference. Please check the reference and try again.',
        payment: null,
        registration: null,
        course: null,
        receipt: null,
      };
    }
    throw err;
  }

  if (String(paystackData.reference || '').trim() !== reference) {
    await recordPaymentVerificationLog({
      studentId: params.requestingUser.id,
      paymentReference: reference,
      verificationSource: params.source,
      verificationResult: 'unauthorized_or_mismatch',
      paystackData,
      reason: 'Paystack returned a mismatched transaction reference.',
    });
    throw new PaymentValidationError(
      'Transaction reference mismatch detected during Paystack verification.',
      400
    );
  }

  const gatewayStatus = String(paystackData.status || '').toLowerCase();

  if (gatewayStatus === 'failed' || gatewayStatus === 'abandoned' || gatewayStatus === 'reversed') {
    await recordPaymentVerificationLog({
      studentId: params.requestingUser.id,
      paymentReference: reference,
      verificationSource: params.source,
      verificationResult: 'failed',
      paymentStatus: 'failed',
      registrationStatus: 'not_activated',
      paystackData,
      reason: `Paystack reported status "${gatewayStatus}" for unrecorded transaction.`,
    });
    return {
      verificationResult: 'failed',
      paymentStatus: 'failed',
      alreadyProcessed: false,
      unlocked: false,
      message: 'Payment verification indicates that this transaction was not successful.',
      payment: null,
      registration: null,
      course: null,
      receipt: null,
    };
  }

  if (gatewayStatus !== 'success') {
    await recordPaymentVerificationLog({
      studentId: params.requestingUser.id,
      paymentReference: reference,
      verificationSource: params.source,
      verificationResult: 'pending',
      paymentStatus: 'pending',
      registrationStatus: 'not_activated',
      paystackData,
      reason: `Paystack reported non-final status "${gatewayStatus || 'pending'}".`,
    });
    return {
      verificationResult: 'pending',
      paymentStatus: 'pending',
      alreadyProcessed: false,
      unlocked: false,
      message: 'Your payment is still being processed. Please check again shortly.',
      payment: null,
      registration: null,
      course: null,
      receipt: null,
    };
  }

  // Paystack confirmed SUCCESS for an unrecorded reference:
  // Check duplicate gateway transaction ID before anything else
  const gatewayTxId =
    paystackData.id !== undefined && paystackData.id !== null
      ? String(paystackData.id).trim()
      : null;

  if (gatewayTxId) {
    const existingByTx = await pool.query<{
      id: string;
      student_id: string | null;
      course_id: string;
      payment_reference: string;
    }>(
      `SELECT id, student_id, course_id, payment_reference
       FROM payments
       WHERE gateway_transaction_id = $1 AND payment_status = 'successful'
       LIMIT 1`,
      [gatewayTxId]
    );
    if (existingByTx.rows[0]) {
      const prev = existingByTx.rows[0];
      if (prev.student_id !== params.requestingUser.id && !isAdmin) {
        await recordPaymentVerificationLog({
          studentId: params.requestingUser.id,
          paymentReference: reference,
          verificationSource: params.source,
          verificationResult: 'unauthorized_or_mismatch',
          paystackData,
          reason: 'Paystack transaction ID already associated with another student registration.',
        });
        throw new PaymentValidationError(
          'This payment reference does not belong to your student account.',
          403
        );
      }

      await recordPaymentVerificationLog({
        studentId: params.requestingUser.id,
        paymentId: prev.id,
        courseId: prev.course_id,
        paymentReference: reference,
        verificationSource: params.source,
        verificationResult: 'already_registered',
        paymentStatus: 'successful',
        registrationStatus: 'active',
        paystackData,
        reason: 'Paystack transaction already settled on this student account.',
      });
      const existingReceipt = await buildPaymentReceiptById(prev.id, params.requestingUser.id);
      return {
        verificationResult: 'already_registered',
        paymentStatus: 'successful',
        alreadyProcessed: true,
        unlocked: Boolean(existingReceipt),
        message: 'This payment has already been verified. Your course registration is active.',
        payment: null,
        registration: null,
        course: existingReceipt
          ? {
              id: existingReceipt.courseId,
              code: existingReceipt.courseCode,
              title: existingReceipt.courseTitle,
              courseValue: String(existingReceipt.courseValue),
              registrationFee: String(existingReceipt.amountPaid),
              currency: existingReceipt.currency,
              whatsappGroupLink: existingReceipt.whatsappGroupLink,
            }
          : null,
        receipt: existingReceipt,
      };
    }
  }

  // Ownership check via Paystack customer email & trusted metadata
  const paystackEmail = String(paystackData.customer?.email || '').trim().toLowerCase();
  const userEmailLower = params.requestingUser.email.trim().toLowerCase();
  const metaStudentId =
    typeof paystackData.metadata?.student_id === 'string'
      ? paystackData.metadata.student_id.trim()
      : null;

  if (metaStudentId && metaStudentId !== params.requestingUser.id && !isAdmin) {
    await recordPaymentVerificationLog({
      studentId: params.requestingUser.id,
      paymentReference: reference,
      verificationSource: params.source,
      verificationResult: 'unauthorized_or_mismatch',
      paystackData,
      reason: 'Paystack transaction metadata student_id belongs to another student.',
    });
    throw new PaymentValidationError(
      'This payment reference does not belong to your student account.',
      403
    );
  }

  if (!metaStudentId && paystackEmail && paystackEmail !== userEmailLower && !isAdmin) {
    // Check if that customer email belongs to a different registered student account
    const otherUserRes = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1`,
      [paystackEmail, params.requestingUser.id]
    );
    if (otherUserRes.rows.length > 0) {
      await recordPaymentVerificationLog({
        studentId: params.requestingUser.id,
        paymentReference: reference,
        verificationSource: params.source,
        verificationResult: 'unauthorized_or_mismatch',
        paystackData,
        reason: 'Paystack customer email belongs to a different registered student account.',
      });
      throw new PaymentValidationError(
        'This payment reference does not belong to your student account.',
        403
      );
    }
  }

  // Resolve target course from trusted Paystack metadata
  const metaCourseId =
    typeof paystackData.metadata?.course_id === 'string'
      ? paystackData.metadata.course_id.trim()
      : null;
  const metaCourseCode =
    typeof paystackData.metadata?.course_code === 'string'
      ? paystackData.metadata.course_code.trim()
      : null;

  let matchedCourse: {
    id: string;
    code: string;
    title: string;
    course_value: string;
    registration_fee: string;
    currency: string;
  } | null = null;

  if (metaCourseId) {
    const cRes = await pool.query<{
      id: string;
      code: string;
      title: string;
      course_value: string;
      registration_fee: string;
      currency: string;
    }>(
      `SELECT id, code, title, course_value::text, registration_fee::text, currency
       FROM courses
       WHERE id::text = $1 AND is_active = TRUE AND publication_status = 'published'
       LIMIT 1`,
      [metaCourseId]
    );
    matchedCourse = cRes.rows[0] || null;
  } else if (metaCourseCode) {
    const cRes = await pool.query<{
      id: string;
      code: string;
      title: string;
      course_value: string;
      registration_fee: string;
      currency: string;
    }>(
      `SELECT id, code, title, course_value::text, registration_fee::text, currency
       FROM courses
       WHERE UPPER(code) = UPPER($1) AND is_active = TRUE AND publication_status = 'published'
       LIMIT 1`,
      [metaCourseCode]
    );
    matchedCourse = cRes.rows[0] || null;
  }

  const emailMatches = paystackEmail === userEmailLower;
  const studentReliablyMatched = metaStudentId === params.requestingUser.id || emailMatches;

  const expectedCourseKobo = matchedCourse
    ? nairaToKobo(matchedCourse.registration_fee || TOTAL_STUDENT_PAYABLE_NAIRA)
    : nairaToKobo(TOTAL_STUDENT_PAYABLE_NAIRA);
  const expectedCourseNaira = koboToNaira(expectedCourseKobo);
  const expectedCourseCurrency = (matchedCourse?.currency || STANDARD_CURRENCY).toUpperCase();

  const actualKobo = Number(paystackData.amount);
  const actualCurrency = String(paystackData.currency || '').toUpperCase();
  const reportedFeesKobo =
    typeof paystackData.fees === 'number' && Number.isFinite(paystackData.fees)
      ? Math.round(paystackData.fees)
      : null;
  const isPassThrough =
    reportedFeesKobo !== null &&
    reportedFeesKobo > 0 &&
    Number.isFinite(actualKobo) &&
    actualKobo > expectedCourseKobo &&
    Math.abs(actualKobo - reportedFeesKobo - expectedCourseKobo) <= 1;

  const amountValid =
    actualCurrency === expectedCourseCurrency &&
    (actualKobo === expectedCourseKobo || isPassThrough);

  // If student ownership, course metadata, or amount/currency cannot be reliably established -> route to Admin Review
  if (!studentReliablyMatched || !matchedCourse || !amountValid) {
    const reasonParts: string[] = [];
    if (!studentReliablyMatched) {
      reasonParts.push(
        `Customer email (${paystackEmail || 'unknown'}) does not match account email (${userEmailLower})`
      );
    }
    if (!matchedCourse) {
      reasonParts.push('Course metadata missing or unmatched on Paystack transaction');
    }
    if (!amountValid) {
      reasonParts.push(
        `Paystack amount/currency (${actualCurrency} ${(actualKobo / 100).toFixed(2)}) differs from course price ${expectedCourseCurrency} ${expectedCourseNaira.toFixed(2)}`
      );
    }

    await recordPaymentVerificationLog({
      studentId: params.requestingUser.id,
      courseId: matchedCourse?.id || null,
      paymentReference: reference,
      verificationSource: params.source,
      verificationResult: 'awaiting_admin_review',
      paymentStatus: 'successful',
      registrationStatus: 'not_activated',
      paystackData,
      reason: reasonParts.join('; '),
    });

    await writeAuditLog({
      actorUserId: params.requestingUser.id,
      action: 'payment.verify.awaiting_admin_review',
      entityType: 'payment_reference',
      entityId: reference,
      metadata: {
        reasons: reasonParts,
        paystackAmountKobo: actualKobo,
        paystackCurrency: actualCurrency,
      },
      ipAddress: params.ipAddress,
    });

    return {
      verificationResult: 'awaiting_admin_review',
      paymentStatus: 'successful',
      alreadyProcessed: false,
      unlocked: false,
      message:
        'Your Paystack payment was confirmed, but automatic student or course matching requires administrator review. Do not pay again — support has logged this reference for review.',
      payment: null,
      registration: null,
      course: matchedCourse
        ? {
            id: matchedCourse.id,
            code: matchedCourse.code,
            title: matchedCourse.title,
            courseValue: matchedCourse.course_value,
            registrationFee: matchedCourse.registration_fee,
            currency: matchedCourse.currency,
          }
        : null,
      receipt: null,
    };
  }

  // Prevent using a new unrecorded payment reference to duplicate an already active course registration
  const existingCourseReg = await pool.query<{ id: string }>(
    `SELECT id FROM course_registrations
     WHERE student_id = $1 AND course_id = $2 AND registration_status = 'active'
     LIMIT 1`,
    [params.requestingUser.id, matchedCourse.id]
  );

  if (existingCourseReg.rows.length > 0) {
    await recordPaymentVerificationLog({
      studentId: params.requestingUser.id,
      courseId: matchedCourse.id,
      paymentReference: reference,
      verificationSource: params.source,
      verificationResult: 'awaiting_admin_review',
      paymentStatus: 'successful',
      registrationStatus: 'active',
      paystackData,
      reason: `Student already has an active registration for ${matchedCourse.code}; additional Paystack reference sent for administrator review.`,
    });
    return {
      verificationResult: 'awaiting_admin_review',
      paymentStatus: 'successful',
      alreadyProcessed: true,
      unlocked: false,
      message:
        'You already have an active registration for this course. This additional transaction reference has been queued for administrator review.',
      payment: null,
      registration: null,
      course: {
        id: matchedCourse.id,
        code: matchedCourse.code,
        title: matchedCourse.title,
        courseValue: matchedCourse.course_value,
        registrationFee: matchedCourse.registration_fee,
        currency: matchedCourse.currency,
      },
      receipt: null,
    };
  }

  // Recover the unrecorded Paystack transaction cleanly through unified settlement pipeline
  const recoveredWhatsapp =
    (typeof paystackData.metadata?.whatsapp_number === 'string' &&
      paystackData.metadata.whatsapp_number.trim()) ||
    params.requestingUser.whatsappNumber ||
    null;

  await pool.query(
    `INSERT INTO payments (
       student_id,
       course_id,
       payment_reference,
       gateway,
       whatsapp_number,
       course_value,
       total_amount_charged,
       amount,
       currency,
       reconciliation_status,
       fee_absorbed_by,
       payment_status
     )
     VALUES ($1, $2, $3, 'paystack', $4, $5, $6, $7, $8, 'pending', $9, 'pending')
     ON CONFLICT (payment_reference) DO NOTHING`,
    [
      params.requestingUser.id,
      matchedCourse.id,
      reference,
      recoveredWhatsapp,
      Number(matchedCourse.course_value || COURSE_VALUE_NAIRA).toFixed(2),
      Number(matchedCourse.registration_fee || TOTAL_STUDENT_PAYABLE_NAIRA).toFixed(2),
      Number(matchedCourse.registration_fee || TOTAL_STUDENT_PAYABLE_NAIRA).toFixed(2),
      expectedCourseCurrency,
      FEE_ABSORBER_LABEL,
    ]
  );

  const recoveredOutcome = await settlePaystackTransaction({
    paystackData,
    actorUserId: params.requestingUser.id,
    source: 'verify_endpoint',
    ipAddress: params.ipAddress,
  });

  const finalResult: PaymentVerificationResult =
    recoveredOutcome.paymentStatus === 'successful' && recoveredOutcome.unlocked
      ? 'successful'
      : 'awaiting_admin_review';

  await recordPaymentVerificationLog({
    studentId: params.requestingUser.id,
    paymentId: recoveredOutcome.payment?.id || null,
    courseId: matchedCourse.id,
    paymentReference: reference,
    verificationSource: params.source,
    verificationResult: finalResult,
    paymentStatus: recoveredOutcome.paymentStatus,
    registrationStatus: recoveredOutcome.unlocked ? 'active' : 'not_activated',
    paystackData,
    reason: 'Recovered successful Paystack transaction previously missing from local records.',
  });

  await writeAuditLog({
    actorUserId: params.requestingUser.id,
    action: 'payment.verify.recovered',
    entityType: 'payment',
    entityId: recoveredOutcome.payment?.id || reference,
    metadata: {
      reference,
      courseId: matchedCourse.id,
      courseCode: matchedCourse.code,
      unlocked: recoveredOutcome.unlocked,
    },
    ipAddress: params.ipAddress,
  });

  return {
    ...recoveredOutcome,
    verificationResult: finalResult,
    message: recoveredOutcome.unlocked
      ? 'Payment verified successfully! Your course registration is now active.'
      : recoveredOutcome.message,
  };
}

export async function resolveAdminVerificationLog(params: {
  logId: string;
  action: 'approve_activate' | 'reject';
  studentId?: string;
  courseId?: string;
  resolutionNote: string;
  adminUserId: string;
  ipAddress?: string;
  reverifyLiveWithPaystack?: boolean;
  verifyFn?: (reference: string) => Promise<PaystackVerifyData>;
}): Promise<{
  logId: string;
  verificationResult: PaymentVerificationResult;
  outcome: SettlementOutcome | null;
  message: string;
}> {
  const pool = getPool();
  const verifyFn = params.verifyFn ?? verifyPaystackTransaction;

  const logRes = await pool.query<{
    id: string;
    student_id: string | null;
    payment_id: string | null;
    course_id: string | null;
    payment_reference: string;
    verification_result: string;
    paystack_status: string | null;
    paystack_amount_kobo: number | null;
    paystack_currency: string | null;
    paystack_payload: Record<string, unknown> | null;
  }>(
    `SELECT
       id, student_id, payment_id, course_id, payment_reference,
       verification_result, paystack_status, paystack_amount_kobo, paystack_currency, paystack_payload
     FROM payment_verification_logs
     WHERE id = $1
     LIMIT 1`,
    [params.logId]
  );

  const logRow = logRes.rows[0];
  if (!logRow) {
    throw new PaymentValidationError('Verification log entry not found.', 404);
  }

  if (params.action === 'reject') {
    await pool.query(
      `UPDATE payment_verification_logs
       SET verification_result = 'failed',
           registration_status = 'not_activated',
           resolved_by = $2,
           resolved_at = NOW(),
           resolution_note = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [logRow.id, params.adminUserId, params.resolutionNote]
    );

    await writeAuditLog({
      actorUserId: params.adminUserId,
      action: 'admin.verification_log.reject',
      entityType: 'payment_verification_log',
      entityId: logRow.id,
      metadata: {
        paymentReference: logRow.payment_reference,
        resolutionNote: params.resolutionNote,
      },
      ipAddress: params.ipAddress,
    });

    return {
      logId: logRow.id,
      verificationResult: 'failed',
      outcome: null,
      message: 'Verification case marked as rejected. No course access was granted.',
    };
  }

  // Strictly enforce verified Paystack success payload before any admin activation
  let paystackData: PaystackVerifyData | null =
    logRow.paystack_payload && Object.keys(logRow.paystack_payload).length > 0
      ? (logRow.paystack_payload as unknown as PaystackVerifyData)
      : null;

  if (params.reverifyLiveWithPaystack || !paystackData) {
    paystackData = await verifyFn(logRow.payment_reference);
  }

  if (!paystackData || String(paystackData.status || '').toLowerCase() !== 'success') {
    throw new PaymentValidationError(
      'Cannot activate course: Paystack has not verified this transaction as successful.',
      400
    );
  }

  if (String(paystackData.currency || '').toUpperCase() !== STANDARD_CURRENCY) {
    throw new PaymentValidationError(
      'Cannot activate course: Paystack transaction currency is not NGN.',
      400
    );
  }

  const targetStudentId = params.studentId || logRow.student_id;
  const targetCourseId = params.courseId || logRow.course_id;
  if (!targetStudentId || !targetCourseId) {
    throw new PaymentValidationError(
      'Both a verified student account and target course must be selected to resolve this review.',
      400
    );
  }

  const [studentRes, courseRes] = await Promise.all([
    pool.query<{ id: string; whatsapp_number: string | null }>(
      `SELECT id, whatsapp_number FROM users WHERE id = $1 LIMIT 1`,
      [targetStudentId]
    ),
    pool.query<{
      id: string;
      code: string;
      title: string;
      course_value: string;
      registration_fee: string;
      currency: string;
    }>(
      `SELECT id, code, title, course_value::text, registration_fee::text, currency
       FROM courses WHERE id = $1 AND is_active = TRUE LIMIT 1`,
      [targetCourseId]
    ),
  ]);

  if (!studentRes.rows[0]) {
    throw new PaymentValidationError('Selected student account does not exist.', 404);
  }
  if (!courseRes.rows[0]) {
    throw new PaymentValidationError('Selected course does not exist or is inactive.', 404);
  }

  // Guard against reusing an already-used Paystack transaction ID on another registration
  const gatewayTxId =
    paystackData.id !== undefined && paystackData.id !== null
      ? String(paystackData.id).trim()
      : null;
  if (gatewayTxId) {
    const dupTx = await pool.query<{ id: string; payment_reference: string }>(
      `SELECT id, payment_reference FROM payments
       WHERE gateway_transaction_id = $1 AND payment_status = 'successful' AND payment_reference <> $2
       LIMIT 1`,
      [gatewayTxId, logRow.payment_reference]
    );
    if (dupTx.rows[0]) {
      throw new PaymentValidationError(
        `Paystack transaction ID ${gatewayTxId} is already attached to payment ${dupTx.rows[0].payment_reference}.`,
        409
      );
    }
  }

  // Ensure a payment row exists for this reference before calling unified settlePaystackTransaction
  const existingPay = await pool.query<{ id: string; student_id: string | null }>(
    `SELECT id, student_id FROM payments WHERE payment_reference = $1 LIMIT 1`,
    [logRow.payment_reference]
  );

  if (existingPay.rows[0] && existingPay.rows[0].student_id && existingPay.rows[0].student_id !== targetStudentId) {
    throw new PaymentValidationError(
      'Payment reference is already bound to a different student account.',
      409
    );
  }

  if (!existingPay.rows[0]) {
    const resolvedCourse = courseRes.rows[0];
    const resolvedCourseValue = Number(resolvedCourse.course_value || COURSE_VALUE_NAIRA).toFixed(2);
    const resolvedRegistrationFee = Number(
      resolvedCourse.registration_fee || TOTAL_STUDENT_PAYABLE_NAIRA
    ).toFixed(2);
    const resolvedCurrency = String(resolvedCourse.currency || STANDARD_CURRENCY).toUpperCase();

    await pool.query(
      `INSERT INTO payments (
         student_id, course_id, payment_reference, gateway, whatsapp_number,
         course_value, total_amount_charged, amount, currency,
         reconciliation_status, fee_absorbed_by, payment_status
       )
       VALUES ($1, $2, $3, 'paystack', $4, $5, $6, $7, $8, 'pending', $9, 'pending')
       ON CONFLICT (payment_reference) DO NOTHING`,
      [
        targetStudentId,
        targetCourseId,
        logRow.payment_reference,
        studentRes.rows[0].whatsapp_number,
        resolvedCourseValue,
        resolvedRegistrationFee,
        resolvedRegistrationFee,
        resolvedCurrency,
        FEE_ABSORBER_LABEL,
      ]
    );
  }

  // Strip conflicting metadata IDs only after authorized admin explicitly matched student+course
  const verifiedPayloadForSettlement: PaystackVerifyData = {
    ...paystackData,
    metadata: {
      ...(paystackData.metadata || {}),
      student_id: targetStudentId,
      course_id: targetCourseId,
    },
  };

  const outcome = await settlePaystackTransaction({
    paystackData: verifiedPayloadForSettlement,
    actorUserId: params.adminUserId,
    source: 'admin_reverify',
    ipAddress: params.ipAddress,
  });

  await pool.query(
    `UPDATE payment_verification_logs
     SET student_id = $2,
         payment_id = $3,
         course_id = $4,
         verification_result = $5,
         payment_status = $6,
         registration_status = $7,
         paystack_status = $8,
         paystack_amount_kobo = $9,
         paystack_currency = $10,
         paystack_transaction_id = $11,
         paystack_payload = $12::jsonb,
         resolved_by = $13,
         resolved_at = NOW(),
         resolution_note = $14,
         updated_at = NOW()
     WHERE id = $1`,
    [
      logRow.id,
      targetStudentId,
      outcome.payment?.id || null,
      targetCourseId,
      outcome.unlocked ? 'successful' : 'awaiting_admin_review',
      outcome.paymentStatus,
      outcome.unlocked ? 'active' : 'not_activated',
      String(paystackData.status || ''),
      Math.round(Number(paystackData.amount || 0)),
      String(paystackData.currency || 'NGN').toUpperCase(),
      gatewayTxId,
      JSON.stringify(paystackData),
      params.adminUserId,
      params.resolutionNote,
    ]
  );

  await writeAuditLog({
    actorUserId: params.adminUserId,
    action: 'admin.verification_log.approve_activate',
    entityType: 'payment_verification_log',
    entityId: logRow.id,
    metadata: {
      paymentReference: logRow.payment_reference,
      targetStudentId,
      targetCourseId,
      unlocked: outcome.unlocked,
      resolutionNote: params.resolutionNote,
    },
    ipAddress: params.ipAddress,
  });

  return {
    logId: logRow.id,
    verificationResult: outcome.unlocked ? 'successful' : 'awaiting_admin_review',
    outcome,
    message: outcome.unlocked
      ? `Verified Paystack payment matched and ${courseRes.rows[0].code} activated for student.`
      : outcome.message,
  };
}

