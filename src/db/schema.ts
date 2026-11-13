import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export interface UserPreferences {
  theme: 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
  soundNotifications: boolean;
  autoNextQuestion: boolean;
  showQuestionPalette: boolean;
  defaultCourseId?: string | null;
  defaultSubjectId?: string | null;
  defaultDifficulty: 'All Levels' | 'Easy' | 'Medium' | 'Hard';
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'light',
  fontSize: 'medium',
  soundNotifications: true,
  autoNextQuestion: false,
  showQuestionPalette: true,
  defaultCourseId: null,
  defaultSubjectId: null,
  defaultDifficulty: 'All Levels',
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fullName: text('full_name').notNull(),
    email: text('email').notNull(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull().default('student'),
    examTarget: text('exam_target').notNull().default('Acadet CBT Examination'),
    whatsappNumber: text('whatsapp_number'),
    isActive: boolean('is_active').notNull().default(true),
    preferences: jsonb('preferences')
      .$type<UserPreferences>()
      .notNull()
      .default(DEFAULT_USER_PREFERENCES),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_email_unique_idx').on(table.email),
    uniqueIndex('users_username_unique_idx').on(table.username),
    index('users_role_idx').on(table.role),
    check('users_role_check', sql`${table.role} IN ('student', 'admin', 'super_admin')`),
  ]
);

// Legacy table kept for safe relational compatibility
export const subjects = pgTable(
  'subjects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    code: text('code').notNull(),
    examCategory: text('exam_category').notNull().default('Acadet CBT Examination'),
    description: text('description').notNull().default(''),
    defaultDurationMinutes: integer('default_duration_minutes').notNull().default(90),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('subjects_slug_unique_idx').on(table.slug),
    uniqueIndex('subjects_code_unique_idx').on(table.code),
    index('subjects_active_idx').on(table.isActive),
  ]
);

export const courses = pgTable(
  'courses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subjectId: uuid('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
    code: text('code').notNull(),
    title: text('title').notNull(),
    level: text('level').notNull().default('100 Level'),
    description: text('description').notNull().default(''),
    courseValue: numeric('course_value', { precision: 12, scale: 2 })
      .notNull()
      .default('2300.00'),
    registrationFee: numeric('registration_fee', { precision: 12, scale: 2 })
      .notNull()
      .default('2350.00'),
    currency: text('currency').notNull().default('NGN'),
    publicationStatus: text('publication_status').notNull().default('published'),
    examCategory: text('exam_category').notNull().default('Acadet CBT Examination'),
    defaultDurationMinutes: integer('default_duration_minutes').notNull().default(60),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('courses_code_unique_idx').on(sql`LOWER(${table.code})`),
    index('courses_subject_idx').on(table.subjectId),
    index('courses_publication_status_idx').on(table.publicationStatus, table.isActive),
    check(
      'courses_publication_status_check',
      sql`${table.publicationStatus} IN ('draft', 'published', 'archived')`
    ),
    check('courses_registration_fee_check', sql`${table.registrationFee} >= 0`),
    check(
      'courses_standardized_pricing_check',
      sql`${table.courseValue} = 2300.00 AND ${table.registrationFee} = 2350.00`
    ),
  ]
);

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subjectId: uuid('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
    courseId: uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }),
    questionText: text('question_text').notNull(),
    optionA: text('option_a').notNull(),
    optionB: text('option_b').notNull(),
    optionC: text('option_c').notNull(),
    optionD: text('option_d').notNull(),
    correctOption: text('correct_option').notNull(),
    explanation: text('explanation').notNull().default(''),
    difficulty: text('difficulty').notNull().default('Medium'),
    topic: text('topic').notNull().default('General'),
    examYear: integer('exam_year'),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('questions_subject_difficulty_idx').on(table.subjectId, table.difficulty, table.isActive),
    index('questions_course_idx').on(table.courseId),
    check('questions_correct_option_check', sql`${table.correctOption} IN ('A', 'B', 'C', 'D')`),
    check('questions_difficulty_check', sql`${table.difficulty} IN ('Easy', 'Medium', 'Hard')`),
  ]
);

export const examSessions = pgTable(
  'exam_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
    courseId: uuid('course_id').references(() => courses.id, { onDelete: 'restrict' }),
    examTitle: text('exam_title').notNull().default('Acadet CBT Examination'),
    difficultyFilter: text('difficulty_filter').notNull().default('All Levels'),
    totalQuestions: integer('total_questions').notNull(),
    timeLimitSeconds: integer('time_limit_seconds').notNull(),
    timeSpentSeconds: integer('time_spent_seconds').notNull().default(0),
    status: text('status').notNull().default('in_progress'),
    correctCount: integer('correct_count'),
    wrongCount: integer('wrong_count'),
    unansweredCount: integer('unanswered_count'),
    scorePercentage: integer('score_percentage'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
  },
  (table) => [
    index('exam_sessions_user_status_idx').on(table.userId, table.status, table.startedAt),
    index('exam_sessions_subject_idx').on(table.subjectId),
    index('exam_sessions_course_idx').on(table.courseId),
    check(
      'exam_sessions_status_check',
      sql`${table.status} IN ('in_progress', 'submitted', 'abandoned')`
    ),
  ]
);

export const examSessionQuestions = pgTable(
  'exam_session_questions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => examSessions.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'restrict' }),
    questionOrder: integer('question_order').notNull(),
    selectedOption: text('selected_option'),
    isMarkedForReview: boolean('is_marked_for_review').notNull().default(false),
    isCorrect: boolean('is_correct'),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('exam_session_questions_order_unique_idx').on(
      table.sessionId,
      table.questionOrder
    ),
    uniqueIndex('exam_session_questions_q_unique_idx').on(table.sessionId, table.questionId),
    index('exam_session_questions_session_idx').on(table.sessionId),
    check(
      'exam_session_questions_selected_check',
      sql`${table.selectedOption} IS NULL OR ${table.selectedOption} IN ('A', 'B', 'C', 'D')`
    ),
  ]
);

export const studyMaterials = pgTable(
  'study_materials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subjectId: uuid('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
    courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    category: text('category').notNull().default('Notes'),
    fileType: text('file_type').notNull().default('PDF'),
    fileSizeBytes: integer('file_size_bytes').notNull().default(0),
    objectKey: text('object_key').notNull(),
    mimeType: text('mime_type').notNull().default('application/pdf'),
    downloadCount: integer('download_count').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('study_materials_subject_cat_idx').on(table.subjectId, table.category, table.isActive),
    index('study_materials_course_cat_idx').on(table.courseId, table.category, table.isActive),
    check(
      'study_materials_category_check',
      sql`${table.category} IN ('Tutorials', 'Notes', 'Past Questions', 'Guides')`
    ),
  ]
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'restrict' }),
    paymentReference: text('payment_reference').notNull(),
    gateway: text('gateway').notNull().default('paystack'),
    whatsappNumber: text('whatsapp_number'),
    courseValue: numeric('course_value', { precision: 12, scale: 2 })
      .notNull()
      .default('2300.00'),
    totalAmountCharged: numeric('total_amount_charged', { precision: 12, scale: 2 })
      .notNull()
      .default('2350.00'),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('NGN'),
    gatewayFee: numeric('gateway_fee', { precision: 12, scale: 2 }),
    gatewayFeeSource: text('gateway_fee_source'),
    netSettlementAmount: numeric('net_settlement_amount', { precision: 12, scale: 2 }),
    settlementVariance: numeric('settlement_variance', { precision: 12, scale: 2 }),
    reconciliationStatus: text('reconciliation_status').notNull().default('pending'),
    feeAbsorbedBy: text('fee_absorbed_by').notNull().default('Acadet CBT'),
    paymentChannel: text('payment_channel'),
    paymentStatus: text('payment_status').notNull().default('pending'),
    gatewayTransactionId: text('gateway_transaction_id'),
    gatewayResponse: jsonb('gateway_response')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    authorizationUrl: text('authorization_url'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('payments_reference_unique_idx').on(table.paymentReference),
    index('payments_student_created_idx').on(table.studentId, table.createdAt),
    index('payments_course_status_idx').on(table.courseId, table.paymentStatus),
    index('payments_status_created_idx').on(table.paymentStatus, table.createdAt),
    index('payments_reconciliation_idx').on(table.reconciliationStatus, table.createdAt),
    check(
      'payments_status_check',
      sql`${table.paymentStatus} IN ('pending', 'successful', 'failed', 'refunded')`
    ),
    check(
      'payments_reconciliation_status_check',
      sql`${table.reconciliationStatus} IN ('pending', 'reconciled', 'shortfall', 'not_applicable')`
    ),
    check('payments_amount_check', sql`${table.amount} >= 0`),
  ]
);

export const courseRegistrations = pgTable(
  'course_registrations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'restrict' }),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),
    whatsappNumber: text('whatsapp_number'),
    registrationStatus: text('registration_status').notNull().default('active'),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('course_registrations_payment_unique_idx').on(table.paymentId),
    uniqueIndex('course_registrations_active_student_course_idx')
      .on(table.studentId, table.courseId)
      .where(sql`${table.registrationStatus} = 'active'`),
    index('course_registrations_student_idx').on(table.studentId, table.registeredAt),
    index('course_registrations_course_idx').on(table.courseId, table.registeredAt),
    check(
      'course_registrations_status_check',
      sql`${table.registrationStatus} IN ('active', 'pending', 'revoked', 'expired')`
    ),
  ]
);

export const paymentWebhookEvents = pgTable(
  'payment_webhook_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventReference: text('event_reference').notNull(),
    eventType: text('event_type').notNull(),
    paymentReference: text('payment_reference'),
    processingStatus: text('processing_status').notNull().default('received'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    errorMessage: text('error_message'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('payment_webhook_events_ref_unique_idx').on(table.eventReference),
    index('payment_webhook_events_received_idx').on(table.receivedAt),
    check(
      'payment_webhook_events_status_check',
      sql`${table.processingStatus} IN ('received', 'processed', 'ignored', 'failed')`
    ),
  ]
);

export const announcements = pgTable(
  'announcements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    isPinned: boolean('is_pinned').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('announcements_active_pinned_idx').on(table.isActive, table.isPinned)]
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_logs_actor_created_idx').on(table.actorUserId, table.createdAt)]
);
