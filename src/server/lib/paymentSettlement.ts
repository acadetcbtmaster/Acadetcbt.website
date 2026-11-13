import { getPool } from '../../db/index.js';
import { writeAuditLog } from './audit.js';
import { generatePaymentSuccessNotification } from './notifications.js';
import { nairaToKobo, type PaystackVerifyData } from './paystack.js';
import {
  COURSE_VALUE_KOBO,
  FEE_ABSORBER_LABEL,
  reconcileCoursePayment,
  STANDARD_CURRENCY,
  TOTAL_STUDENT_PAYABLE_KOBO,
} from './pricing.js';

export interface SettlementOutcome {
  paymentStatus: 'pending' | 'successful' | 'failed' | 'refunded';
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
  };
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
  } | null;
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
        paymentStatus: 'successful',
        alreadyProcessed: true,
        unlocked: existingReg.rows.length > 0 && !isShortfall,
        message:
          isShortfall && existingReg.rows.length === 0
            ? 'Payment recorded with a net settlement shortfall below the ₦2,300 course value. Admin reconciliation required.'
            : 'Payment already verified and course registration is active.',
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
      const expectedKobo = nairaToKobo(pRow.total_amount_charged || pRow.amount);
      const actualKobo = Number(paystackData.amount);
      const reportedFeesKobo =
        typeof paystackData.fees === 'number' && Number.isFinite(paystackData.fees)
          ? Math.round(paystackData.fees)
          : null;

      // Detect Paystack dashboard "Pass fees to customers" gross-up (e.g. 235000 -> 238579 with fees = 3579)
      const isPaystackFeePassThrough =
        reportedFeesKobo !== null &&
        reportedFeesKobo > 0 &&
        expectedKobo === TOTAL_STUDENT_PAYABLE_KOBO &&
        Number.isFinite(actualKobo) &&
        actualKobo > TOTAL_STUDENT_PAYABLE_KOBO &&
        Math.abs(actualKobo - reportedFeesKobo - expectedKobo) <= 1;

      if (!Number.isFinite(actualKobo) || (actualKobo > TOTAL_STUDENT_PAYABLE_KOBO && !isPaystackFeePassThrough)) {
        throw new PaymentValidationError(
          `Student charge exceeds maximum allowed ₦2,350 (${TOTAL_STUDENT_PAYABLE_KOBO} kobo): received ${actualKobo} kobo. In Paystack Dashboard → Settings → Preferences → Transaction fees, uncheck "Pass fees to customers" so Acadet CBT absorbs the charges.`,
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
        paymentStatus: 'successful',
        alreadyProcessed: false,
        unlocked: Boolean(regRow) && reconciliation.coversCourseValue,
        message: reconciliation.coversCourseValue
          ? 'Payment verified and reconciled. Course registration is now active.'
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
        paymentStatus: 'failed',
        alreadyProcessed: false,
        unlocked: false,
        message: 'Payment was not successful. Course remains locked.',
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
        paymentStatus: 'pending',
        alreadyProcessed: false,
        unlocked: false,
        message: 'Payment is still pending confirmation from Paystack. Course remains locked.',
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
  }

  return outcome;
}
