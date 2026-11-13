import { getPool } from '../../db/index.js';

export type NotificationType = 'admin_direct' | 'payment_success' | 'system';

export interface NotificationInsertInput {
  recipientUserId: string;
  senderUserId?: string | null;
  senderName?: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  courseId?: string | null;
  paymentId?: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  idempotencyKey?: string | null;
}

export interface CreatedNotificationRow {
  id: string;
  recipientUserId: string;
  senderUserId: string | null;
  senderName: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  courseId: string | null;
  paymentId: string | null;
  actionLabel: string | null;
  actionUrl: string | null;
  idempotencyKey: string | null;
  createdAt: Date;
}

export function normalizeWhatsappGroupLink(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function buildPaymentSuccessNotificationContent(params: {
  studentName: string;
  courseCode: string;
  courseTitle: string;
  totalAmountChargedNaira: number;
  paymentReference: string;
  whatsappGroupLink?: string | null;
}): {
  title: string;
  message: string;
  actionLabel: string | null;
  actionUrl: string | null;
} {
  const safeGroupLink = normalizeWhatsappGroupLink(params.whatsappGroupLink);
  const amountFormatted = `₦${Math.round(params.totalAmountChargedNaira).toLocaleString('en-NG')}`;
  const courseLabel = `${params.courseCode} — ${params.courseTitle}`;

  const lines = [
    `Hello ${params.studentName},`,
    `Your payment of ${amountFormatted} (Ref: ${params.paymentReference}) for ${courseLabel} has been verified and confirmed.`,
    `Your course registration is now active and CBT examination access for ${params.courseCode} is unlocked.`,
  ];

  if (safeGroupLink) {
    lines.push(
      `Use the invitation button below to join the ${params.courseCode} WhatsApp tutorial group for updates, schedules, and peer support.`
    );
  }

  return {
    title: `Course Registration Confirmed: ${params.courseCode}`,
    message: lines.join('\n\n'),
    actionLabel: safeGroupLink ? `Join ${params.courseCode} Tutorial Group` : null,
    actionUrl: safeGroupLink,
  };
}

export async function createStudentNotification(
  input: NotificationInsertInput
): Promise<CreatedNotificationRow | null> {
  const pool = getPool();
  const senderName = input.senderName?.trim() || 'Acadet CBT Administration';

  const result = await pool.query<CreatedNotificationRow>(
    `INSERT INTO notifications (
       recipient_user_id,
       sender_user_id,
       sender_name,
       notification_type,
       title,
       message,
       course_id,
       payment_id,
       action_label,
       action_url,
       idempotency_key
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
     RETURNING
       id,
       recipient_user_id AS "recipientUserId",
       sender_user_id AS "senderUserId",
       sender_name AS "senderName",
       notification_type AS "notificationType",
       title,
       message,
       course_id AS "courseId",
       payment_id AS "paymentId",
       action_label AS "actionLabel",
       action_url AS "actionUrl",
       idempotency_key AS "idempotencyKey",
       created_at AS "createdAt"`,
    [
      input.recipientUserId,
      input.senderUserId ?? null,
      senderName,
      input.notificationType,
      input.title.trim(),
      input.message.trim(),
      input.courseId ?? null,
      input.paymentId ?? null,
      input.actionLabel ?? null,
      input.actionUrl ?? null,
      input.idempotencyKey ?? null,
    ]
  );

  return result.rows[0] || null;
}

export async function generatePaymentSuccessNotification(params: {
  studentId: string;
  courseId: string;
  paymentId: string;
  paymentReference: string;
  totalAmountChargedNaira: number;
}): Promise<CreatedNotificationRow | null> {
  const pool = getPool();

  const lookup = await pool.query<{
    studentName: string;
    courseCode: string;
    courseTitle: string;
    whatsappGroupLink: string | null;
  }>(
    `SELECT
       u.full_name AS "studentName",
       c.code AS "courseCode",
       c.title AS "courseTitle",
       c.whatsapp_group_link AS "whatsappGroupLink"
     FROM users u
     INNER JOIN courses c ON c.id = $2
     WHERE u.id = $1
     LIMIT 1`,
    [params.studentId, params.courseId]
  );

  const info = lookup.rows[0];
  if (!info) return null;

  const content = buildPaymentSuccessNotificationContent({
    studentName: info.studentName,
    courseCode: info.courseCode,
    courseTitle: info.courseTitle,
    totalAmountChargedNaira: params.totalAmountChargedNaira,
    paymentReference: params.paymentReference,
    whatsappGroupLink: info.whatsappGroupLink,
  });

  return createStudentNotification({
    recipientUserId: params.studentId,
    senderUserId: null,
    senderName: 'Acadet CBT System',
    notificationType: 'payment_success',
    title: content.title,
    message: content.message,
    courseId: params.courseId,
    paymentId: params.paymentId,
    actionLabel: content.actionLabel,
    actionUrl: content.actionUrl,
    idempotencyKey: `payment_success:${params.paymentId}`,
  });
}
