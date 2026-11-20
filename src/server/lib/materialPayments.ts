import { getPool } from '../../db/index.js';
import { writeAuditLog } from './audit.js';
import { PaymentValidationError, type PaymentVerificationResult } from './paymentSettlement.js';
import {
  generatePaymentReference,
  initializePaystackTransaction,
  isPaystackConfigured,
  isValidPaymentReferenceFormat,
  nairaToKobo,
  PaystackNotConfiguredError,
  PaystackReferenceNotFoundError,
  verifyPaystackTransaction,
  type PaystackVerifyData,
} from './paystack.js';
import { koboToNaira, STANDARD_CURRENCY } from './pricing.js';

export const MATERIAL_REF_PREFIX = 'ACD-MAT';
export const MIN_PAID_MATERIAL_NAIRA = 100;
export const MAX_PAID_MATERIAL_NAIRA = 500_000;

export class MaterialPaymentError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 400, code = 'MATERIAL_PAYMENT_ERROR') {
    super(message);
    this.name = 'MaterialPaymentError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function validateMaterialPriceNaira(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') {
    return 0;
  }
  const numeric = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new MaterialPaymentError(
      'Invalid material price. Enter 0 for a Free PDF or at least ₦100.',
      400,
      'INVALID_MATERIAL_PRICE'
    );
  }
  if (numeric > 0 && numeric < MIN_PAID_MATERIAL_NAIRA) {
    throw new MaterialPaymentError(
      `Paid study materials must be priced at least ₦${MIN_PAID_MATERIAL_NAIRA} for Paystack checkout (or ₦0 for Free).`,
      400,
      'MATERIAL_PRICE_BELOW_MINIMUM'
    );
  }
  if (numeric > MAX_PAID_MATERIAL_NAIRA) {
    throw new MaterialPaymentError(
      `Material price cannot exceed ₦${MAX_PAID_MATERIAL_NAIRA.toLocaleString()}.`,
      400,
      'MATERIAL_PRICE_TOO_HIGH'
    );
  }
  return Number(numeric.toFixed(2));
}

export interface MaterialPurchaseOutcome {
  paymentType: 'study_material';
  verificationResult?: PaymentVerificationResult;
  paymentStatus: 'pending' | 'successful' | 'failed' | 'refunded' | 'not_found';
  alreadyProcessed: boolean;
  unlocked: boolean;
  message: string;
  payment: {
    id: string;
    studentId: string;
    materialId: string;
    courseId: string | null;
    paymentReference: string;
    gateway: string;
    amount: string;
    currency: string;
    paymentChannel: string | null;
    paymentStatus: string;
    gatewayTransactionId: string | null;
    paidAt: Date | null;
    createdAt: Date;
  } | null;
  material: {
    id: string;
    title: string;
    fileType: string;
    category: string;
    price: number;
    currency: string;
    courseId: string | null;
    courseCode: string | null;
    courseTitle: string | null;
  } | null;
}

interface LockedMaterialPurchaseRow {
  id: string;
  student_id: string;
  material_id: string;
  course_id: string | null;
  payment_reference: string;
  gateway: string;
  amount: string;
  currency: string;
  payment_channel: string | null;
  payment_status: string;
  gateway_transaction_id: string | null;
  paid_at: Date | null;
  created_at: Date;
}

const PURCHASE_COLS = `id, student_id, material_id, course_id, payment_reference, gateway, amount::text, currency, payment_channel, payment_status, gateway_transaction_id, paid_at, created_at`;

function mapPurchase(row: LockedMaterialPurchaseRow): MaterialPurchaseOutcome['payment'] {
  return {
    id: row.id,
    studentId: row.student_id,
    materialId: row.material_id,
    courseId: row.course_id,
    paymentReference: row.payment_reference,
    gateway: row.gateway,
    amount: row.amount,
    currency: row.currency,
    paymentChannel: row.payment_channel,
    paymentStatus: row.payment_status,
    gatewayTransactionId: row.gateway_transaction_id,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

export async function isStudyMaterialReference(reference: string): Promise<boolean> {
  const ref = String(reference || '').trim();
  if (!ref) return false;
  if (ref.toUpperCase().startsWith(`${MATERIAL_REF_PREFIX}-`)) {
    return true;
  }
  const pool = getPool();
  const res = await pool.query<{ id: string }>(
    `SELECT id FROM study_material_purchases WHERE payment_reference = $1 LIMIT 1`,
    [ref]
  );
  return res.rows.length > 0;
}

export async function isStudentRegisteredForCourse(
  studentId: string,
  courseId: string
): Promise<boolean> {
  const pool = getPool();
  const res = await pool.query<{ id: string }>(
    `SELECT cr.id
     FROM course_registrations cr
     INNER JOIN courses c ON c.id = cr.course_id
     LEFT JOIN payments p ON p.id = cr.payment_id
     WHERE cr.student_id = $1
       AND cr.course_id = $2
       AND cr.registration_status = 'active'
       AND (
         p.payment_status = 'successful'
         OR (cr.payment_id IS NULL AND cr.preserved_payment_ref IS NOT NULL)
         OR (
           cr.activation_source = 'admin_manual'
           AND UPPER(REGEXP_REPLACE(c.code, '\\s+', '', 'g')) = 'GST111'
         )
       )
     LIMIT 1`,
    [studentId, courseId]
  );
  return res.rows.length > 0;
}

export async function getStudentRegisteredCourseIds(
  studentId: string
): Promise<Set<string>> {
  const pool = getPool();
  const res = await pool.query<{ course_id: string }>(
    `SELECT DISTINCT cr.course_id
     FROM course_registrations cr
     INNER JOIN courses c ON c.id = cr.course_id
     LEFT JOIN payments p ON p.id = cr.payment_id
     WHERE cr.student_id = $1
       AND cr.registration_status = 'active'
       AND (
         p.payment_status = 'successful'
         OR (cr.payment_id IS NULL AND cr.preserved_payment_ref IS NOT NULL)
         OR (
           cr.activation_source = 'admin_manual'
           AND UPPER(REGEXP_REPLACE(c.code, '\\s+', '', 'g')) = 'GST111'
         )
       )`,
    [studentId]
  );
  return new Set(res.rows.map((r) => r.course_id));
}

export async function getSuccessfulMaterialPurchaseId(
  studentId: string,
  materialId: string
): Promise<string | null> {
  const pool = getPool();
  const res = await pool.query<{ id: string }>(
    `SELECT id FROM study_material_purchases
     WHERE student_id = $1 AND material_id = $2 AND payment_status = 'successful'
     LIMIT 1`,
    [studentId, materialId]
  );
  return res.rows[0]?.id ?? null;
}

export async function hasPurchasedMaterial(
  studentId: string,
  materialId: string
): Promise<boolean> {
  const id = await getSuccessfulMaterialPurchaseId(studentId, materialId);
  return Boolean(id);
}

export async function recordMaterialDownloadAuthorization(params: {
  studentId: string;
  materialId: string;
  courseId: string | null;
  purchaseId: string | null;
  isFreeDownload: boolean;
  paymentStatusSnapshot: string;
  ipAddress?: string;
}): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO study_material_download_logs (
       student_id, material_id, course_id, purchase_id, is_free_download, payment_status_snapshot, ip_address
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      params.studentId,
      params.materialId,
      params.courseId,
      params.purchaseId,
      params.isFreeDownload,
      params.paymentStatusSnapshot,
      params.ipAddress ?? null,
    ]
  );
  await pool.query(
    `UPDATE study_materials
     SET download_count = download_count + 1
     WHERE id = $1`,
    [params.materialId]
  );
}

export async function initializeStudyMaterialPayment(params: {
  student: {
    id: string;
    email: string;
    fullName: string;
  };
  materialId: string;
  callbackUrl: string;
}): Promise<{
  purchaseId: string;
  reference: string;
  authorizationUrl: string;
  accessCode: string;
  amount: number;
  currency: string;
  material: {
    id: string;
    title: string;
    fileType: string;
    category: string;
    price: number;
    currency: string;
    courseId: string | null;
    courseCode: string | null;
    courseTitle: string | null;
  };
}> {
  if (!isPaystackConfigured()) {
    throw new PaystackNotConfiguredError(
      'Paystack payment gateway is not configured on the server.'
    );
  }

  const pool = getPool();
  const matRes = await pool.query<{
    id: string;
    title: string;
    file_type: string;
    category: string;
    price: string;
    currency: string;
    publication_status: string;
    course_id: string | null;
    course_code: string | null;
    course_title: string | null;
  }>(
    `SELECT sm.id, sm.title, sm.file_type, sm.category, sm.price::text, sm.currency,
            COALESCE(sm.publication_status, 'published') AS publication_status,
            sm.course_id, c.code AS course_code, c.title AS course_title
     FROM study_materials sm
     LEFT JOIN courses c ON c.id = sm.course_id
     WHERE sm.id = $1 AND sm.is_active = TRUE
     LIMIT 1`,
    [params.materialId]
  );

  const mat = matRes.rows[0];
  if (!mat || mat.publication_status !== 'published') {
    throw new MaterialPaymentError(
      'Study material is unavailable or currently unpublished.',
      404,
      'MATERIAL_NOT_FOUND'
    );
  }

  if (mat.course_id) {
    const registered = await isStudentRegisteredForCourse(params.student.id, mat.course_id);
    if (!registered) {
      throw new MaterialPaymentError(
        `You need to register for ${mat.course_code || 'this course'} before accessing or purchasing its study materials.`,
        403,
        'COURSE_REGISTRATION_REQUIRED'
      );
    }
  }

  const priceNaira = Number(mat.price ?? 0);
  if (!Number.isFinite(priceNaira) || priceNaira <= 0) {
    throw new MaterialPaymentError(
      'This study material is free and does not require payment.',
      400,
      'MATERIAL_IS_FREE'
    );
  }
  if (priceNaira < MIN_PAID_MATERIAL_NAIRA) {
    throw new MaterialPaymentError(
      `This study material price (₦${priceNaira}) is below the Paystack minimum of ₦${MIN_PAID_MATERIAL_NAIRA}. Ask an administrator to adjust its price.`,
      400,
      'MATERIAL_PRICE_BELOW_MINIMUM'
    );
  }

  const alreadyBought = await hasPurchasedMaterial(params.student.id, mat.id);
  if (alreadyBought) {
    throw new MaterialPaymentError(
      'You have already purchased and unlocked this study material. Click Download to access it.',
      409,
      'MATERIAL_ALREADY_PURCHASED'
    );
  }

  const currency = String(mat.currency || STANDARD_CURRENCY).toUpperCase();
  const amountKobo = nairaToKobo(priceNaira);
  const reference = generatePaymentReference(MATERIAL_REF_PREFIX);

  const insertedRes = await pool.query<{ id: string }>(
    `INSERT INTO study_material_purchases (
       student_id, material_id, course_id, payment_reference, gateway, amount, currency, payment_status
     )
     VALUES ($1, $2, $3, $4, 'paystack', $5, $6, 'pending')
     RETURNING id`,
    [params.student.id, mat.id, mat.course_id, reference, priceNaira.toFixed(2), currency]
  );

  const purchaseId = insertedRes.rows[0].id;

  try {
    const paystackInit = await initializePaystackTransaction({
      email: params.student.email,
      amountKobo,
      currency,
      reference,
      callbackUrl: params.callbackUrl,
      metadata: {
        purchase_type: 'study_material',
        purchase_id: purchaseId,
        material_id: mat.id,
        material_title: mat.title,
        course_id: mat.course_id,
        course_code: mat.course_code,
        student_id: params.student.id,
        student_name: params.student.fullName,
        expected_amount_kobo: amountKobo,
        expected_currency: currency,
      },
    });

    await pool.query(
      `UPDATE study_material_purchases
       SET authorization_url = $2,
           gateway_response = $3::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [purchaseId, paystackInit.authorization_url, JSON.stringify(paystackInit)]
    );

    return {
      purchaseId,
      reference: paystackInit.reference,
      authorizationUrl: paystackInit.authorization_url,
      accessCode: paystackInit.access_code,
      amount: priceNaira,
      currency,
      material: {
        id: mat.id,
        title: mat.title,
        fileType: mat.file_type,
        category: mat.category,
        price: priceNaira,
        currency,
        courseId: mat.course_id,
        courseCode: mat.course_code,
        courseTitle: mat.course_title,
      },
    };
  } catch (initErr) {
    await pool.query(
      `UPDATE study_material_purchases
       SET payment_status = 'failed',
           gateway_response = $2::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [
        purchaseId,
        JSON.stringify({
          error: initErr instanceof Error ? initErr.message : 'Paystack initialize error',
        }),
      ]
    );
    throw initErr;
  }
}

export async function settleStudyMaterialPaystackTransaction(params: {
  paystackData: PaystackVerifyData;
  actorUserId?: string | null;
  source: 'verify_endpoint' | 'webhook' | 'admin_reverify';
  ipAddress?: string;
}): Promise<MaterialPurchaseOutcome> {
  const { paystackData, actorUserId, source, ipAddress } = params;
  const reference = String(paystackData.reference || '').trim();
  if (!reference) {
    throw new PaymentValidationError('Missing transaction reference from Paystack.', 400);
  }

  const pool = getPool();
  const client = await pool.connect();
  let outcome: MaterialPurchaseOutcome;
  let unlockedNotificationInfo: {
    purchaseId: string;
    studentId: string;
    materialId: string;
    materialTitle: string;
    courseId: string | null;
    courseCode: string | null;
    amount: string;
    currency: string;
    reference: string;
  } | null = null;

  try {
    await client.query('BEGIN');

    const lockedRes = await client.query<LockedMaterialPurchaseRow>(
      `SELECT ${PURCHASE_COLS}
       FROM study_material_purchases
       WHERE payment_reference = $1
       FOR UPDATE`,
      [reference]
    );

    if (lockedRes.rows.length === 0) {
      throw new PaymentValidationError(
        `No matching study material purchase found for reference ${reference}.`,
        404
      );
    }

    const pRow = lockedRes.rows[0];
    const matRes = await client.query<{
      id: string;
      title: string;
      file_type: string;
      category: string;
      price: string;
      currency: string;
      course_id: string | null;
      course_code: string | null;
      course_title: string | null;
    }>(
      `SELECT sm.id, sm.title, sm.file_type, sm.category, sm.price::text, sm.currency,
              sm.course_id, c.code AS course_code, c.title AS course_title
       FROM study_materials sm
       LEFT JOIN courses c ON c.id = sm.course_id
       WHERE sm.id = $1
       LIMIT 1`,
      [pRow.material_id]
    );
    const matRow = matRes.rows[0] || null;
    const mappedMaterial = matRow
      ? {
          id: matRow.id,
          title: matRow.title,
          fileType: matRow.file_type,
          category: matRow.category,
          price: Number(matRow.price),
          currency: matRow.currency,
          courseId: matRow.course_id,
          courseCode: matRow.course_code,
          courseTitle: matRow.course_title,
        }
      : null;

    if (pRow.payment_status === 'successful') {
      await client.query('COMMIT');
      return {
        paymentType: 'study_material',
        verificationResult: 'already_registered',
        paymentStatus: 'successful',
        alreadyProcessed: true,
        unlocked: true,
        message: 'This study material payment has already been verified. Your PDF is unlocked for download.',
        payment: mapPurchase(pRow),
        material: mappedMaterial,
      };
    }

    const gatewayStatus = String(paystackData.status || '').toLowerCase();

    if (gatewayStatus === 'success') {
      const gatewayTxIdCheck =
        paystackData.id !== undefined && paystackData.id !== null
          ? String(paystackData.id).trim()
          : null;

      if (gatewayTxIdCheck) {
        const dupMatTx = await client.query<{ id: string }>(
          `SELECT id FROM study_material_purchases
           WHERE gateway_transaction_id = $1
             AND id <> $2
             AND payment_status = 'successful'
           LIMIT 1`,
          [gatewayTxIdCheck, pRow.id]
        );
        const dupCourseTx = await client.query<{ id: string }>(
          `SELECT id FROM payments
           WHERE gateway_transaction_id = $1
             AND payment_status = 'successful'
           LIMIT 1`,
          [gatewayTxIdCheck]
        );
        if (dupMatTx.rows.length > 0 || dupCourseTx.rows.length > 0) {
          throw new PaymentValidationError(
            'This Paystack transaction has already been used for another purchase.',
            409
          );
        }
      }

      const expectedKobo = nairaToKobo(pRow.amount);
      const actualKobo = Number(paystackData.amount);
      const reportedFeesKobo =
        typeof paystackData.fees === 'number' && Number.isFinite(paystackData.fees)
          ? Math.round(paystackData.fees)
          : null;

      const isPaystackFeePassThrough =
        reportedFeesKobo !== null &&
        reportedFeesKobo > 0 &&
        expectedKobo > 0 &&
        Number.isFinite(actualKobo) &&
        actualKobo > expectedKobo &&
        Math.abs(actualKobo - reportedFeesKobo - expectedKobo) <= 1;

      if (!Number.isFinite(actualKobo) || (actualKobo !== expectedKobo && !isPaystackFeePassThrough)) {
        throw new PaymentValidationError(
          `Payment amount mismatch: expected ₦${koboToNaira(expectedKobo).toLocaleString()} (${expectedKobo} kobo), received ${actualKobo} kobo.`,
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

      const metaMaterialId = paystackData.metadata?.material_id;
      if (typeof metaMaterialId === 'string' && metaMaterialId !== pRow.material_id) {
        throw new PaymentValidationError(
          'Transaction metadata material_id does not match this study material purchase.',
          400
        );
      }

      const metaStudentId = paystackData.metadata?.student_id;
      if (typeof metaStudentId === 'string' && metaStudentId !== pRow.student_id) {
        throw new PaymentValidationError(
          'Transaction metadata student_id does not match this student.',
          400
        );
      }

      const paidAt = paystackData.paid_at ? new Date(paystackData.paid_at) : new Date();
      const resolvedChannel =
        paystackData.channel || paystackData.authorization?.channel || null;

      const updatedRes = await client.query<LockedMaterialPurchaseRow>(
        `UPDATE study_material_purchases
         SET payment_status = 'successful',
             gateway_transaction_id = $2,
             payment_channel = $3,
             gateway_response = $4::jsonb,
             paid_at = $5,
             updated_at = NOW()
         WHERE id = $1
         RETURNING ${PURCHASE_COLS}`,
        [pRow.id, gatewayTxIdCheck, resolvedChannel, JSON.stringify(paystackData), paidAt]
      );

      const finalRow = updatedRes.rows[0];
      await client.query('COMMIT');

      unlockedNotificationInfo = {
        purchaseId: finalRow.id,
        studentId: finalRow.student_id,
        materialId: finalRow.material_id,
        materialTitle: mappedMaterial?.title || 'Study Material',
        courseId: mappedMaterial?.courseId || null,
        courseCode: mappedMaterial?.courseCode || null,
        amount: finalRow.amount,
        currency: finalRow.currency,
        reference: finalRow.payment_reference,
      };

      outcome = {
        paymentType: 'study_material',
        verificationResult: 'successful',
        paymentStatus: 'successful',
        alreadyProcessed: false,
        unlocked: true,
        message: 'Payment verified successfully! Your study material is now unlocked for download.',
        payment: mapPurchase(finalRow),
        material: mappedMaterial,
      };
    } else if (
      gatewayStatus === 'failed' ||
      gatewayStatus === 'abandoned' ||
      gatewayStatus === 'reversed'
    ) {
      const updatedRes = await client.query<LockedMaterialPurchaseRow>(
        `UPDATE study_material_purchases
         SET payment_status = 'failed',
             gateway_transaction_id = COALESCE($2, gateway_transaction_id),
             gateway_response = $3::jsonb,
             updated_at = NOW()
         WHERE id = $1
         RETURNING ${PURCHASE_COLS}`,
        [
          pRow.id,
          paystackData.id ? String(paystackData.id) : null,
          JSON.stringify(paystackData),
        ]
      );
      const finalRow = updatedRes.rows[0];
      await client.query('COMMIT');

      outcome = {
        paymentType: 'study_material',
        verificationResult: 'failed',
        paymentStatus: 'failed',
        alreadyProcessed: false,
        unlocked: false,
        message: `Paystack reported status "${gatewayStatus}" for this material purchase.`,
        payment: mapPurchase(finalRow),
        material: mappedMaterial,
      };
    } else {
      await client.query('COMMIT');
      outcome = {
        paymentType: 'study_material',
        verificationResult: 'pending',
        paymentStatus: 'pending',
        alreadyProcessed: false,
        unlocked: false,
        message: `Transaction status on Paystack is "${paystackData.status || 'pending'}". Please complete checkout or retry verification.`,
        payment: mapPurchase(pRow),
        material: mappedMaterial,
      };
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  if (unlockedNotificationInfo) {
    try {
      const courseTag = unlockedNotificationInfo.courseCode
        ? ` (${unlockedNotificationInfo.courseCode})`
        : '';
      await pool.query(
        `INSERT INTO notifications (
           recipient_user_id, sender_name, notification_type, title, message,
           course_id, action_label, action_url, idempotency_key
         )
         VALUES ($1, 'Acadet CBT Billing', 'payment_success', $2, $3, $4, 'Open Study Materials', '/materials', $5)
         ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
        [
          unlockedNotificationInfo.studentId,
          `Material Unlocked: ${unlockedNotificationInfo.materialTitle}`,
          `Your payment of ₦${Number(unlockedNotificationInfo.amount).toLocaleString()} (Ref: ${unlockedNotificationInfo.reference}) for "${unlockedNotificationInfo.materialTitle}"${courseTag} was confirmed. You can now download it anytime in Study Materials.`,
          unlockedNotificationInfo.courseId,
          `material-pay-success:${unlockedNotificationInfo.purchaseId}`,
        ]
      );
    } catch (notifErr) {
      console.warn('[MaterialPayment] Failed writing student unlock notification:', notifErr);
    }

    await writeAuditLog({
      actorUserId: actorUserId ?? unlockedNotificationInfo.studentId,
      action: 'material.payment.verified',
      entityType: 'study_material_purchase',
      entityId: unlockedNotificationInfo.purchaseId,
      metadata: {
        reference: unlockedNotificationInfo.reference,
        materialId: unlockedNotificationInfo.materialId,
        amount: unlockedNotificationInfo.amount,
        source,
      },
      ipAddress,
    });
  }

  return outcome;
}

export async function verifyAndSettleMaterialReference(params: {
  reference: string;
  requestingUser: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
  source: 'student_manual' | 'callback';
  ipAddress?: string;
}): Promise<MaterialPurchaseOutcome> {
  const reference = String(params.reference || '').trim();
  if (!reference || !isValidPaymentReferenceFormat(reference)) {
    throw new PaymentValidationError(
      'Invalid payment reference format. Check the reference and try again.',
      400
    );
  }

  const pool = getPool();
  const isAdmin =
    params.requestingUser.role === 'admin' || params.requestingUser.role === 'super_admin';

  const localRes = await pool.query<{
    id: string;
    student_id: string;
    material_id: string;
  }>(
    `SELECT id, student_id, material_id
     FROM study_material_purchases
     WHERE payment_reference = $1
     LIMIT 1`,
    [reference]
  );

  const localRow = localRes.rows[0];
  if (!localRow) {
    return {
      paymentType: 'study_material',
      verificationResult: 'not_found',
      paymentStatus: 'not_found',
      alreadyProcessed: false,
      unlocked: false,
      message: 'We could not find a study material payment record with that reference.',
      payment: null,
      material: null,
    };
  }

  if (!isAdmin && localRow.student_id !== params.requestingUser.id) {
    throw new PaymentValidationError(
      'This study material payment reference belongs to another student account.',
      403
    );
  }

  let paystackData: PaystackVerifyData;
  try {
    paystackData = await verifyPaystackTransaction(reference);
  } catch (err) {
    if (err instanceof PaystackReferenceNotFoundError) {
      return {
        paymentType: 'study_material',
        verificationResult: 'not_found',
        paymentStatus: 'not_found',
        alreadyProcessed: false,
        unlocked: false,
        message: 'Paystack has no completed transaction for that reference yet.',
        payment: null,
        material: null,
      };
    }
    throw err;
  }

  return settleStudyMaterialPaystackTransaction({
    paystackData,
    actorUserId: params.requestingUser.id,
    source: 'verify_endpoint',
    ipAddress: params.ipAddress,
  });
}
