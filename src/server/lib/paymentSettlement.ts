import { getPool } from '../../db/index.js';
import { writeAuditLog } from './audit.js';
import { nairaToKobo, type PaystackVerifyData } from './paystack.js';

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
    amount: string;
    currency: string;
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

    const lockedPaymentRes = await client.query<{
      id: string;
      student_id: string;
      course_id: string;
      payment_reference: string;
      gateway: string;
      whatsapp_number: string | null;
      amount: string;
      currency: string;
      payment_status: string;
      gateway_transaction_id: string | null;
      paid_at: Date | null;
      created_at: Date;
    }>(
      `SELECT id, student_id, course_id, payment_reference, gateway, whatsapp_number, amount::text, currency, payment_status, gateway_transaction_id, paid_at, created_at
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
      registration_fee: string;
      currency: string;
    }>(
      `SELECT id, code, title, registration_fee::text, currency FROM courses WHERE id = $1 LIMIT 1`,
      [pRow.course_id]
    );
    const cRow = courseRes.rows[0] || null;

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
      return {
        paymentStatus: 'successful',
        alreadyProcessed: true,
        unlocked: existingReg.rows.length > 0,
        message: 'Payment already verified and course registration is active.',
        payment: {
          id: pRow.id,
          studentId: pRow.student_id,
          courseId: pRow.course_id,
          paymentReference: pRow.payment_reference,
          gateway: pRow.gateway,
          whatsappNumber: pRow.whatsapp_number,
          amount: pRow.amount,
          currency: pRow.currency,
          paymentStatus: pRow.payment_status,
          gatewayTransactionId: pRow.gateway_transaction_id,
          paidAt: pRow.paid_at,
          createdAt: pRow.created_at,
        },
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
        course: cRow
          ? {
              id: cRow.id,
              code: cRow.code,
              title: cRow.title,
              registrationFee: cRow.registration_fee,
              currency: cRow.currency,
            }
          : null,
      };
    }

    const gatewayStatus = String(paystackData.status || '').toLowerCase();

    if (gatewayStatus === 'success') {
      const expectedKobo = nairaToKobo(pRow.amount);
      const actualKobo = Number(paystackData.amount);
      if (!Number.isFinite(actualKobo) || actualKobo !== expectedKobo) {
        throw new PaymentValidationError(
          `Payment amount mismatch: expected ${expectedKobo} kobo, received ${actualKobo} kobo.`,
          400
        );
      }

      const expectedCurrency = String(pRow.currency || 'NGN').toUpperCase();
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

      const updatedPay = await client.query<{
        id: string;
        student_id: string;
        course_id: string;
        payment_reference: string;
        gateway: string;
        whatsapp_number: string | null;
        amount: string;
        currency: string;
        payment_status: string;
        gateway_transaction_id: string | null;
        paid_at: Date | null;
        created_at: Date;
      }>(
        `UPDATE payments
         SET payment_status = 'successful',
             gateway_transaction_id = $2,
             gateway_response = $3::jsonb,
             paid_at = $4,
             whatsapp_number = COALESCE(whatsapp_number, $5),
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, student_id, course_id, payment_reference, gateway, whatsapp_number, amount::text, currency, payment_status, gateway_transaction_id, paid_at, created_at`,
        [pRow.id, gatewayTxId, JSON.stringify(paystackData), paidAt, resolvedWhatsapp]
      );

      // Check if student already has an active registration for this course (concurrency guard)
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

      let regRow = existingActive.rows[0] || null;
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

      const finalP = updatedPay.rows[0];
      await client.query('COMMIT');

      outcome = {
        paymentStatus: 'successful',
        alreadyProcessed: false,
        unlocked: Boolean(regRow),
        message: 'Payment verified successfully. Course registration is now active.',
        payment: {
          id: finalP.id,
          studentId: finalP.student_id,
          courseId: finalP.course_id,
          paymentReference: finalP.payment_reference,
          gateway: finalP.gateway,
          whatsappNumber: finalP.whatsapp_number,
          amount: finalP.amount,
          currency: finalP.currency,
          paymentStatus: finalP.payment_status,
          gatewayTransactionId: finalP.gateway_transaction_id,
          paidAt: finalP.paid_at,
          createdAt: finalP.created_at,
        },
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
        course: cRow
          ? {
              id: cRow.id,
              code: cRow.code,
              title: cRow.title,
              registrationFee: cRow.registration_fee,
              currency: cRow.currency,
            }
          : null,
      };
    } else if (
      gatewayStatus === 'failed' ||
      gatewayStatus === 'abandoned' ||
      gatewayStatus === 'reversed'
    ) {
      const updatedPay = await client.query<{
        id: string;
        student_id: string;
        course_id: string;
        payment_reference: string;
        gateway: string;
        whatsapp_number: string | null;
        amount: string;
        currency: string;
        payment_status: string;
        gateway_transaction_id: string | null;
        paid_at: Date | null;
        created_at: Date;
      }>(
        `UPDATE payments
         SET payment_status = 'failed',
             gateway_transaction_id = COALESCE($2, gateway_transaction_id),
             gateway_response = $3::jsonb,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, student_id, course_id, payment_reference, gateway, whatsapp_number, amount::text, currency, payment_status, gateway_transaction_id, paid_at, created_at`,
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
        payment: {
          id: finalP.id,
          studentId: finalP.student_id,
          courseId: finalP.course_id,
          paymentReference: finalP.payment_reference,
          gateway: finalP.gateway,
          whatsappNumber: finalP.whatsapp_number,
          amount: finalP.amount,
          currency: finalP.currency,
          paymentStatus: finalP.payment_status,
          gatewayTransactionId: finalP.gateway_transaction_id,
          paidAt: finalP.paid_at,
          createdAt: finalP.created_at,
        },
        registration: null,
        course: cRow
          ? {
              id: cRow.id,
              code: cRow.code,
              title: cRow.title,
              registrationFee: cRow.registration_fee,
              currency: cRow.currency,
            }
          : null,
      };
    } else {
      // Pending / ongoing / queued
      const updatedPay = await client.query<{
        id: string;
        student_id: string;
        course_id: string;
        payment_reference: string;
        gateway: string;
        whatsapp_number: string | null;
        amount: string;
        currency: string;
        payment_status: string;
        gateway_transaction_id: string | null;
        paid_at: Date | null;
        created_at: Date;
      }>(
        `UPDATE payments
         SET payment_status = 'pending',
             gateway_response = $2::jsonb,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, student_id, course_id, payment_reference, gateway, whatsapp_number, amount::text, currency, payment_status, gateway_transaction_id, paid_at, created_at`,
        [pRow.id, JSON.stringify(paystackData)]
      );
      const finalP = updatedPay.rows[0];
      await client.query('COMMIT');

      outcome = {
        paymentStatus: 'pending',
        alreadyProcessed: false,
        unlocked: false,
        message: 'Payment is still pending confirmation from Paystack. Course remains locked.',
        payment: {
          id: finalP.id,
          studentId: finalP.student_id,
          courseId: finalP.course_id,
          paymentReference: finalP.payment_reference,
          gateway: finalP.gateway,
          whatsappNumber: finalP.whatsapp_number,
          amount: finalP.amount,
          currency: finalP.currency,
          paymentStatus: finalP.payment_status,
          gatewayTransactionId: finalP.gateway_transaction_id,
          paidAt: finalP.paid_at,
          createdAt: finalP.created_at,
        },
        registration: null,
        course: cRow
          ? {
              id: cRow.id,
              code: cRow.code,
              title: cRow.title,
              registrationFee: cRow.registration_fee,
              currency: cRow.currency,
            }
          : null,
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
      unlocked: outcome.unlocked,
    },
    ipAddress,
  });

  return outcome;
}
