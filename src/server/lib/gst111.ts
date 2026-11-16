import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { getPool } from '../../db/index.js';
import { writeAuditLog } from './audit.js';
import { createStudentNotification } from './notifications.js';

export type Gst111ActivationSource = 'admin_manual' | 'paystack' | 'none';
export type Gst111SubscriptionStatus = 'active' | 'locked';

export interface Gst111CourseInfo {
  id: string;
  code: string;
  title: string;
  level: string;
  registrationFee: number;
  currency: string;
  publicationStatus: string;
  isActive: boolean;
}

export interface Gst111StudentStatusItem {
  studentId: string;
  registrationCode: string;
  fullName: string;
  email: string;
  username: string;
  whatsappNumber: string | null;
  accountStatus: 'active' | 'suspended';
  isActive: boolean;
  joinedAt: string;
  gst111Status: Gst111SubscriptionStatus;
  activationSource: Gst111ActivationSource;
  subscriptionLabel: string;
  paymentStatusLabel: string;
  registrationId: string | null;
  activatedAt: string | null;
  deactivatedAt: string | null;
  lastActionByName: string | null;
  lastActionByEmail: string | null;
  lastActionAt: string | null;
  lastActionNote: string | null;
  historyCount: number;
}

export interface Gst111ActivationHistoryItem {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentRegistrationCode: string | null;
  courseId: string;
  courseCode: string;
  registrationId: string | null;
  action: 'activated' | 'deactivated';
  previousStatus: string;
  nextStatus: string;
  adminUserId: string | null;
  adminName: string;
  adminEmail: string;
  reason: string | null;
  createdAt: string;
}

export class Gst111RestrictionError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 403, code = 'GST111_ONLY_RESTRICTED') {
    super(message);
    this.name = 'Gst111RestrictionError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function normalizeCourseCode(code: string | null | undefined): string {
  return String(code ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase();
}

export function isGst111CourseCode(code: string | null | undefined): boolean {
  return normalizeCourseCode(code) === 'GST111';
}

export function assertGst111OnlyTarget(params: {
  requestedCourseCode?: string | null;
  requestedCourseId?: string | null;
  resolvedGst111Course?: Gst111CourseInfo | null;
}): void {
  if (
    params.requestedCourseCode !== undefined &&
    params.requestedCourseCode !== null &&
    params.requestedCourseCode.trim() !== '' &&
    !isGst111CourseCode(params.requestedCourseCode)
  ) {
    throw new Gst111RestrictionError(
      `Manual subscription activation is restricted exclusively to GST 111. Course "${params.requestedCourseCode}" is not permitted.`,
      403,
      'GST111_ONLY_RESTRICTED'
    );
  }

  if (
    params.requestedCourseId &&
    params.resolvedGst111Course &&
    params.requestedCourseId !== params.resolvedGst111Course.id
  ) {
    throw new Gst111RestrictionError(
      'Manual subscription activation is restricted exclusively to GST 111 and cannot target any other course.',
      403,
      'GST111_ONLY_RESTRICTED'
    );
  }
}

export async function generateUniqueRegistrationCode(): Promise<string> {
  const pool = getPool();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `ACD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE UPPER(COALESCE(registration_code, '')) = $1 LIMIT 1`,
      [candidate]
    );
    if (existing.rows.length === 0) {
      return candidate;
    }
  }
  const fallbackSuffix = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `ACD-${fallbackSuffix}`;
}

async function ensureStudentRegistrationCode(
  client: PoolClient,
  studentId: string,
  currentCode: string | null
): Promise<string> {
  const trimmed = currentCode?.trim().toUpperCase();
  if (trimmed) return trimmed;
  const generated = `ACD-${studentId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  await client.query(
    `UPDATE users SET registration_code = $2, updated_at = NOW() WHERE id = $1 AND (registration_code IS NULL OR BTRIM(registration_code) = '')`,
    [studentId, generated]
  );
  const recheck = await client.query<{ registration_code: string | null }>(
    `SELECT registration_code FROM users WHERE id = $1 LIMIT 1`,
    [studentId]
  );
  return recheck.rows[0]?.registration_code || generated;
}

export async function resolveGst111Course(
  client?: PoolClient
): Promise<Gst111CourseInfo | null> {
  const runner = client ?? getPool();
  const res = await runner.query<{
    id: string;
    code: string;
    title: string;
    level: string;
    registrationFee: string;
    currency: string;
    publicationStatus: string;
    isActive: boolean;
  }>(
    `SELECT
       id,
       code,
       title,
       level,
       registration_fee::text AS "registrationFee",
       currency,
       publication_status AS "publicationStatus",
       is_active AS "isActive"
     FROM courses
     WHERE UPPER(REGEXP_REPLACE(code, '\\s+', '', 'g')) = 'GST111'
     ORDER BY is_active DESC, (publication_status = 'published') DESC, created_at ASC
     LIMIT 1`
  );

  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    level: row.level,
    registrationFee: Number(row.registrationFee ?? 2350),
    currency: row.currency || 'NGN',
    publicationStatus: row.publicationStatus,
    isActive: row.isActive,
  };
}

export async function listGst111StudentStatuses(params: {
  search?: string;
  statusFilter?: 'all' | 'active' | 'locked' | 'admin_manual';
}): Promise<{
  gst111Course: Gst111CourseInfo | null;
  students: Gst111StudentStatusItem[];
  recentHistory: Gst111ActivationHistoryItem[];
  stats: {
    totalStudents: number;
    activeSubscriptions: number;
    adminActivatedCount: number;
    paystackActivatedCount: number;
    lockedCount: number;
  };
}> {
  const pool = getPool();
  const gst111Course = await resolveGst111Course();

  const clauses: string[] = [`u.role = 'student'`];
  const values: unknown[] = [];

  if (gst111Course) {
    values.push(gst111Course.id);
  } else {
    values.push(null);
  }

  const search = params.search?.trim().toLowerCase() || '';
  if (search) {
    values.push(`%${search}%`);
    const idx = values.length;
    clauses.push(
      `(LOWER(COALESCE(u.registration_code, '')) LIKE $${idx}
        OR LOWER(u.full_name) LIKE $${idx}
        OR LOWER(u.email) LIKE $${idx}
        OR LOWER(u.username) LIKE $${idx}
        OR LOWER(COALESCE(u.whatsapp_number, '')) LIKE $${idx}
        OR u.id::text LIKE $${idx})`
    );
  }

  const whereSql = `WHERE ${clauses.join(' AND ')}`;

  const studentRes = await pool.query<{
    studentId: string;
    registrationCode: string | null;
    fullName: string;
    email: string;
    username: string;
    whatsappNumber: string | null;
    accountStatus: string;
    isActive: boolean;
    joinedAt: Date;
    registrationId: string | null;
    registrationStatus: string | null;
    activationSource: string | null;
    activatedAt: Date | null;
    deactivatedAt: Date | null;
    registeredAt: Date | null;
    adminNote: string | null;
    paymentStatus: string | null;
    preservedPaymentRef: string | null;
    paymentId: string | null;
    lastActionByName: string | null;
    lastActionByEmail: string | null;
    lastActionAt: Date | null;
    lastActionNote: string | null;
    historyCount: number;
  }>(
    `SELECT
       u.id AS "studentId",
       u.registration_code AS "registrationCode",
       u.full_name AS "fullName",
       u.email,
       u.username,
       u.whatsapp_number AS "whatsappNumber",
       u.account_status AS "accountStatus",
       u.is_active AS "isActive",
       u.created_at AS "joinedAt",
       active_cr.id AS "registrationId",
       active_cr.registration_status AS "registrationStatus",
       active_cr.activation_source AS "activationSource",
       active_cr.activated_at AS "activatedAt",
       latest_cr.deactivated_at AS "deactivatedAt",
       active_cr.registered_at AS "registeredAt",
       COALESCE(active_cr.admin_note, latest_cr.admin_note) AS "adminNote",
       p.payment_status AS "paymentStatus",
       active_cr.preserved_payment_ref AS "preservedPaymentRef",
       active_cr.payment_id AS "paymentId",
       COALESCE(lh.admin_name, act_u.full_name) AS "lastActionByName",
       COALESCE(lh.admin_email, act_u.email) AS "lastActionByEmail",
       COALESCE(lh.created_at, active_cr.activated_at, latest_cr.deactivated_at) AS "lastActionAt",
       COALESCE(lh.reason, active_cr.admin_note, latest_cr.admin_note) AS "lastActionNote",
       COALESCE(hc.history_count, 0)::int AS "historyCount"
     FROM users u
     LEFT JOIN LATERAL (
       SELECT cr.*
       FROM course_registrations cr
       WHERE $1::uuid IS NOT NULL
         AND cr.student_id = u.id
         AND cr.course_id = $1::uuid
         AND cr.registration_status = 'active'
       ORDER BY cr.registered_at DESC
       LIMIT 1
     ) active_cr ON TRUE
     LEFT JOIN payments p ON p.id = active_cr.payment_id
     LEFT JOIN users act_u ON act_u.id = active_cr.activated_by
     LEFT JOIN LATERAL (
       SELECT cr.*
       FROM course_registrations cr
       WHERE $1::uuid IS NOT NULL
         AND cr.student_id = u.id
         AND cr.course_id = $1::uuid
       ORDER BY cr.updated_at DESC, cr.registered_at DESC
       LIMIT 1
     ) latest_cr ON TRUE
     LEFT JOIN LATERAL (
       SELECT h.admin_name, h.admin_email, h.created_at, h.reason
       FROM gst111_activation_history h
       WHERE h.student_id = u.id
       ORDER BY h.created_at DESC
       LIMIT 1
     ) lh ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS history_count
       FROM gst111_activation_history h
       WHERE h.student_id = u.id
     ) hc ON TRUE
     ${whereSql}
     ORDER BY u.created_at DESC
     LIMIT 300`,
    values
  );

  const mapped: Gst111StudentStatusItem[] = studentRes.rows.map((row) => {
    const isUnlocked =
      Boolean(row.registrationId) &&
      row.registrationStatus === 'active' &&
      (row.activationSource === 'admin_manual' ||
        row.paymentStatus === 'successful' ||
        (row.paymentId === null && Boolean(row.preservedPaymentRef)));

    const source: Gst111ActivationSource = !isUnlocked
      ? 'none'
      : row.activationSource === 'admin_manual'
        ? 'admin_manual'
        : 'paystack';

    const fallbackCode =
      row.registrationCode ||
      `ACD-${row.studentId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

    return {
      studentId: row.studentId,
      registrationCode: fallbackCode,
      fullName: row.fullName,
      email: row.email,
      username: row.username,
      whatsappNumber: row.whatsappNumber,
      accountStatus:
        row.accountStatus === 'suspended' || !row.isActive ? 'suspended' : 'active',
      isActive: row.isActive && row.accountStatus !== 'suspended',
      joinedAt: row.joinedAt.toISOString(),
      gst111Status: isUnlocked ? 'active' : 'locked',
      activationSource: source,
      subscriptionLabel: isUnlocked
        ? 'GST 111 – Subscription Active'
        : 'GST 111 – Inactive / Locked',
      paymentStatusLabel: isUnlocked
        ? source === 'admin_manual'
          ? 'Successful (Admin Activated)'
          : 'Successful (Paystack)'
        : 'Locked / Unpaid',
      registrationId: row.registrationId,
      activatedAt: row.activatedAt
        ? row.activatedAt.toISOString()
        : row.registeredAt
          ? row.registeredAt.toISOString()
          : null,
      deactivatedAt: row.deactivatedAt ? row.deactivatedAt.toISOString() : null,
      lastActionByName: row.lastActionByName,
      lastActionByEmail: row.lastActionByEmail,
      lastActionAt: row.lastActionAt ? row.lastActionAt.toISOString() : null,
      lastActionNote: row.lastActionNote,
      historyCount: row.historyCount,
    };
  });

  const stats = {
    totalStudents: mapped.length,
    activeSubscriptions: mapped.filter((s) => s.gst111Status === 'active').length,
    adminActivatedCount: mapped.filter(
      (s) => s.gst111Status === 'active' && s.activationSource === 'admin_manual'
    ).length,
    paystackActivatedCount: mapped.filter(
      (s) => s.gst111Status === 'active' && s.activationSource === 'paystack'
    ).length,
    lockedCount: mapped.filter((s) => s.gst111Status === 'locked').length,
  };

  const statusFilter = params.statusFilter || 'all';
  const filtered = mapped.filter((s) => {
    if (statusFilter === 'active') return s.gst111Status === 'active';
    if (statusFilter === 'locked') return s.gst111Status === 'locked';
    if (statusFilter === 'admin_manual') {
      return s.gst111Status === 'active' && s.activationSource === 'admin_manual';
    }
    return true;
  });

  const recentHistory = await getRecentGst111History(60);

  return {
    gst111Course,
    students: filtered,
    recentHistory,
    stats,
  };
}

export async function getStudentGst111History(
  studentId: string
): Promise<Gst111ActivationHistoryItem[]> {
  const pool = getPool();
  const res = await pool.query<{
    id: string;
    studentId: string;
    studentName: string;
    studentEmail: string;
    studentRegistrationCode: string | null;
    courseId: string;
    courseCode: string;
    registrationId: string | null;
    action: 'activated' | 'deactivated';
    previousStatus: string;
    nextStatus: string;
    adminUserId: string | null;
    adminName: string;
    adminEmail: string;
    reason: string | null;
    createdAt: Date;
  }>(
    `SELECT
       h.id,
       h.student_id AS "studentId",
       u.full_name AS "studentName",
       u.email AS "studentEmail",
       COALESCE(h.student_registration_code, u.registration_code) AS "studentRegistrationCode",
       h.course_id AS "courseId",
       h.course_code AS "courseCode",
       h.registration_id AS "registrationId",
       h.action,
       h.previous_status AS "previousStatus",
       h.next_status AS "nextStatus",
       h.admin_user_id AS "adminUserId",
       h.admin_name AS "adminName",
       h.admin_email AS "adminEmail",
       h.reason,
       h.created_at AS "createdAt"
     FROM gst111_activation_history h
     INNER JOIN users u ON u.id = h.student_id
     WHERE h.student_id = $1
     ORDER BY h.created_at DESC
     LIMIT 100`,
    [studentId]
  );

  return res.rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getRecentGst111History(
  limit = 60
): Promise<Gst111ActivationHistoryItem[]> {
  const pool = getPool();
  const res = await pool.query<{
    id: string;
    studentId: string;
    studentName: string;
    studentEmail: string;
    studentRegistrationCode: string | null;
    courseId: string;
    courseCode: string;
    registrationId: string | null;
    action: 'activated' | 'deactivated';
    previousStatus: string;
    nextStatus: string;
    adminUserId: string | null;
    adminName: string;
    adminEmail: string;
    reason: string | null;
    createdAt: Date;
  }>(
    `SELECT
       h.id,
       h.student_id AS "studentId",
       u.full_name AS "studentName",
       u.email AS "studentEmail",
       COALESCE(h.student_registration_code, u.registration_code) AS "studentRegistrationCode",
       h.course_id AS "courseId",
       h.course_code AS "courseCode",
       h.registration_id AS "registrationId",
       h.action,
       h.previous_status AS "previousStatus",
       h.next_status AS "nextStatus",
       h.admin_user_id AS "adminUserId",
       h.admin_name AS "adminName",
       h.admin_email AS "adminEmail",
       h.reason,
       h.created_at AS "createdAt"
     FROM gst111_activation_history h
     INNER JOIN users u ON u.id = h.student_id
     ORDER BY h.created_at DESC
     LIMIT $1`,
    [limit]
  );

  return res.rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function activateGst111Manual(params: {
  studentId: string;
  requestedCourseId?: string;
  requestedCourseCode?: string;
  note?: string;
  admin: {
    id: string;
    fullName: string;
    email: string;
  };
  ipAddress?: string;
}): Promise<{
  registrationId: string;
  studentId: string;
  studentRegistrationCode: string;
  courseId: string;
  courseCode: string;
  activationSource: 'admin_manual';
  historyEntry: Gst111ActivationHistoryItem;
  message: string;
}> {
  assertGst111OnlyTarget({
    requestedCourseCode: params.requestedCourseCode,
  });

  const pool = getPool();
  const client = await pool.connect();

  let txResult: {
    registrationId: string;
    studentId: string;
    studentName: string;
    studentEmail: string;
    studentRegistrationCode: string;
    courseId: string;
    courseCode: string;
    courseTitle: string;
    historyId: string;
    createdAt: Date;
  };

  const trimmedNote = params.note?.trim() || 'Manual GST 111 activation by administrator';

  try {
    await client.query('BEGIN');

    const gst111Course = await resolveGst111Course(client);
    if (!gst111Course) {
      throw new Gst111RestrictionError(
        'GST 111 course was not found in the database. Create or publish GST 111 under Courses first.',
        404,
        'GST111_COURSE_NOT_FOUND'
      );
    }

    assertGst111OnlyTarget({
      requestedCourseCode: params.requestedCourseCode,
      requestedCourseId: params.requestedCourseId,
      resolvedGst111Course: gst111Course,
    });

    const studentRes = await client.query<{
      id: string;
      full_name: string;
      email: string;
      registration_code: string | null;
      whatsapp_number: string | null;
      role: string;
    }>(
      `SELECT id, full_name, email, registration_code, whatsapp_number, role
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [params.studentId]
    );

    const student = studentRes.rows[0];
    if (!student) {
      throw new Gst111RestrictionError('Registered student account not found.', 404, 'STUDENT_NOT_FOUND');
    }

    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [`gst111:${student.id}:${gst111Course.id}`]
    );

    const regCode = await ensureStudentRegistrationCode(
      client,
      student.id,
      student.registration_code
    );

    const existingActiveRes = await client.query<{
      id: string;
      activation_source: string;
    }>(
      `SELECT id, activation_source
       FROM course_registrations
       WHERE student_id = $1
         AND course_id = $2
         AND registration_status = 'active'
       LIMIT 1`,
      [student.id, gst111Course.id]
    );

    if (existingActiveRes.rows.length > 0) {
      throw new Gst111RestrictionError(
        `${student.full_name} (${regCode}) already has an active GST 111 subscription (${
          existingActiveRes.rows[0].activation_source === 'admin_manual'
            ? 'Admin Activated'
            : 'Paystack Paid'
        }).`,
        409,
        'GST111_ALREADY_ACTIVE'
      );
    }

    const insertRegRes = await client.query<{ id: string }>(
      `INSERT INTO course_registrations (
         student_id,
         course_id,
         payment_id,
         preserved_payment_ref,
         preserved_amount_paid,
         whatsapp_number,
         registration_status,
         activation_source,
         activated_by,
         activated_at,
         admin_note,
         registered_at,
         updated_at
       )
       VALUES ($1, $2, NULL, NULL, NULL, $3, 'active', 'admin_manual', $4, NOW(), $5, NOW(), NOW())
       RETURNING id`,
      [student.id, gst111Course.id, student.whatsapp_number, params.admin.id, trimmedNote]
    );

    const registrationId = insertRegRes.rows[0].id;

    const historyRes = await client.query<{ id: string; created_at: Date }>(
      `INSERT INTO gst111_activation_history (
         student_id,
         student_registration_code,
         course_id,
         course_code,
         registration_id,
         action,
         previous_status,
         next_status,
         admin_user_id,
         admin_name,
         admin_email,
         reason
       )
       VALUES ($1, $2, $3, $4, $5, 'activated', 'inactive_locked', 'active_admin_manual', $6, $7, $8, $9)
       RETURNING id, created_at`,
      [
        student.id,
        regCode,
        gst111Course.id,
        gst111Course.code,
        registrationId,
        params.admin.id,
        params.admin.fullName,
        params.admin.email,
        trimmedNote,
      ]
    );

    await client.query('COMMIT');

    txResult = {
      registrationId,
      studentId: student.id,
      studentName: student.full_name,
      studentEmail: student.email,
      studentRegistrationCode: regCode,
      courseId: gst111Course.id,
      courseCode: gst111Course.code,
      courseTitle: gst111Course.title,
      historyId: historyRes.rows[0].id,
      createdAt: historyRes.rows[0].created_at,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await writeAuditLog({
    actorUserId: params.admin.id,
    action: 'admin.gst111.manual_activate',
    entityType: 'course_registration',
    entityId: txResult.registrationId,
    metadata: {
      studentId: txResult.studentId,
      studentRegistrationCode: txResult.studentRegistrationCode,
      courseId: txResult.courseId,
      courseCode: txResult.courseCode,
      activationSource: 'admin_manual',
      note: trimmedNote,
    },
    ipAddress: params.ipAddress,
  });

  try {
    await createStudentNotification({
      recipientUserId: txResult.studentId,
      senderUserId: params.admin.id,
      senderName: params.admin.fullName,
      notificationType: 'system',
      title: 'GST 111 – Subscription Active',
      message: `Your ${txResult.courseCode} — ${txResult.courseTitle} subscription has been activated by administration (Admin Activated). Payment Status: Successful. You now have full access to all GST 111 features.`,
      courseId: txResult.courseId,
      idempotencyKey: `gst111-activate-${txResult.registrationId}`,
    });
  } catch (notifErr) {
    console.warn('[GST 111 Notification Warning]', notifErr);
  }

  return {
    registrationId: txResult.registrationId,
    studentId: txResult.studentId,
    studentRegistrationCode: txResult.studentRegistrationCode,
    courseId: txResult.courseId,
    courseCode: txResult.courseCode,
    activationSource: 'admin_manual',
    historyEntry: {
      id: txResult.historyId,
      studentId: txResult.studentId,
      studentName: txResult.studentName,
      studentEmail: txResult.studentEmail,
      studentRegistrationCode: txResult.studentRegistrationCode,
      courseId: txResult.courseId,
      courseCode: txResult.courseCode,
      registrationId: txResult.registrationId,
      action: 'activated',
      previousStatus: 'inactive_locked',
      nextStatus: 'active_admin_manual',
      adminUserId: params.admin.id,
      adminName: params.admin.fullName,
      adminEmail: params.admin.email,
      reason: trimmedNote,
      createdAt: txResult.createdAt.toISOString(),
    },
    message: `GST 111 subscription manually activated for ${txResult.studentName} (${txResult.studentRegistrationCode}).`,
  };
}

export async function deactivateGst111Manual(params: {
  studentId: string;
  requestedCourseId?: string;
  requestedCourseCode?: string;
  reason?: string;
  admin: {
    id: string;
    fullName: string;
    email: string;
  };
  ipAddress?: string;
}): Promise<{
  registrationId: string;
  studentId: string;
  studentRegistrationCode: string;
  courseId: string;
  courseCode: string;
  historyEntry: Gst111ActivationHistoryItem;
  message: string;
}> {
  assertGst111OnlyTarget({
    requestedCourseCode: params.requestedCourseCode,
  });

  const pool = getPool();
  const client = await pool.connect();

  let txResult: {
    registrationId: string;
    studentId: string;
    studentName: string;
    studentEmail: string;
    studentRegistrationCode: string;
    courseId: string;
    courseCode: string;
    courseTitle: string;
    previousSource: string;
    historyId: string;
    createdAt: Date;
  };

  const trimmedReason =
    params.reason?.trim() || 'GST 111 subscription deactivated by administrator';

  try {
    await client.query('BEGIN');

    const gst111Course = await resolveGst111Course(client);
    if (!gst111Course) {
      throw new Gst111RestrictionError(
        'GST 111 course was not found in the database.',
        404,
        'GST111_COURSE_NOT_FOUND'
      );
    }

    assertGst111OnlyTarget({
      requestedCourseCode: params.requestedCourseCode,
      requestedCourseId: params.requestedCourseId,
      resolvedGst111Course: gst111Course,
    });

    const studentRes = await client.query<{
      id: string;
      full_name: string;
      email: string;
      registration_code: string | null;
    }>(
      `SELECT id, full_name, email, registration_code
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [params.studentId]
    );

    const student = studentRes.rows[0];
    if (!student) {
      throw new Gst111RestrictionError('Registered student account not found.', 404, 'STUDENT_NOT_FOUND');
    }

    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [`gst111:${student.id}:${gst111Course.id}`]
    );

    const regCode = await ensureStudentRegistrationCode(
      client,
      student.id,
      student.registration_code
    );

    const activeRegRes = await client.query<{
      id: string;
      activation_source: string;
    }>(
      `SELECT id, activation_source
       FROM course_registrations
       WHERE student_id = $1
         AND course_id = $2
         AND registration_status = 'active'
       FOR UPDATE
       LIMIT 1`,
      [student.id, gst111Course.id]
    );

    const activeReg = activeRegRes.rows[0];
    if (!activeReg) {
      throw new Gst111RestrictionError(
        `${student.full_name} (${regCode}) does not currently have an active GST 111 subscription.`,
        409,
        'GST111_NOT_ACTIVE'
      );
    }

    await client.query(
      `UPDATE course_registrations
       SET registration_status = 'revoked',
           deactivated_by = $2,
           deactivated_at = NOW(),
           admin_note = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [activeReg.id, params.admin.id, trimmedReason]
    );

    const previousStatus =
      activeReg.activation_source === 'admin_manual'
        ? 'active_admin_manual'
        : 'active_paystack';

    const historyRes = await client.query<{ id: string; created_at: Date }>(
      `INSERT INTO gst111_activation_history (
         student_id,
         student_registration_code,
         course_id,
         course_code,
         registration_id,
         action,
         previous_status,
         next_status,
         admin_user_id,
         admin_name,
         admin_email,
         reason
       )
       VALUES ($1, $2, $3, $4, $5, 'deactivated', $6, 'inactive_locked', $7, $8, $9, $10)
       RETURNING id, created_at`,
      [
        student.id,
        regCode,
        gst111Course.id,
        gst111Course.code,
        activeReg.id,
        previousStatus,
        params.admin.id,
        params.admin.fullName,
        params.admin.email,
        trimmedReason,
      ]
    );

    await client.query('COMMIT');

    txResult = {
      registrationId: activeReg.id,
      studentId: student.id,
      studentName: student.full_name,
      studentEmail: student.email,
      studentRegistrationCode: regCode,
      courseId: gst111Course.id,
      courseCode: gst111Course.code,
      courseTitle: gst111Course.title,
      previousSource: activeReg.activation_source,
      historyId: historyRes.rows[0].id,
      createdAt: historyRes.rows[0].created_at,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await writeAuditLog({
    actorUserId: params.admin.id,
    action: 'admin.gst111.manual_deactivate',
    entityType: 'course_registration',
    entityId: txResult.registrationId,
    metadata: {
      studentId: txResult.studentId,
      studentRegistrationCode: txResult.studentRegistrationCode,
      courseId: txResult.courseId,
      courseCode: txResult.courseCode,
      previousActivationSource: txResult.previousSource,
      reason: trimmedReason,
    },
    ipAddress: params.ipAddress,
  });

  try {
    await createStudentNotification({
      recipientUserId: txResult.studentId,
      senderUserId: params.admin.id,
      senderName: params.admin.fullName,
      notificationType: 'system',
      title: 'GST 111 – Subscription Locked',
      message: `Your access to ${txResult.courseCode} — ${txResult.courseTitle} has been deactivated by administration. To regain access, complete payment or contact administration.`,
      courseId: txResult.courseId,
      idempotencyKey: `gst111-deactivate-${txResult.historyId}`,
    });
  } catch (notifErr) {
    console.warn('[GST 111 Deactivate Notification Warning]', notifErr);
  }

  return {
    registrationId: txResult.registrationId,
    studentId: txResult.studentId,
    studentRegistrationCode: txResult.studentRegistrationCode,
    courseId: txResult.courseId,
    courseCode: txResult.courseCode,
    historyEntry: {
      id: txResult.historyId,
      studentId: txResult.studentId,
      studentName: txResult.studentName,
      studentEmail: txResult.studentEmail,
      studentRegistrationCode: txResult.studentRegistrationCode,
      courseId: txResult.courseId,
      courseCode: txResult.courseCode,
      registrationId: txResult.registrationId,
      action: 'deactivated',
      previousStatus:
        txResult.previousSource === 'admin_manual'
          ? 'active_admin_manual'
          : 'active_paystack',
      nextStatus: 'inactive_locked',
      adminUserId: params.admin.id,
      adminName: params.admin.fullName,
      adminEmail: txResult.previousSource ? params.admin.email : params.admin.email,
      reason: trimmedReason,
      createdAt: txResult.createdAt.toISOString(),
    },
    message: `GST 111 subscription deactivated for ${txResult.studentName} (${txResult.studentRegistrationCode}). Access is now locked.`,
  };
}
