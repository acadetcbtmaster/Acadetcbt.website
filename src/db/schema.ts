import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
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
  defaultSubjectId: string | null;
  defaultDifficulty: 'All Levels' | 'Easy' | 'Medium' | 'Hard';
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'light',
  fontSize: 'medium',
  soundNotifications: true,
  autoNextQuestion: false,
  showQuestionPalette: true,
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
    examTarget: text('exam_target').notNull().default('JAMB UTME Practice Exam'),
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

export const subjects = pgTable(
  'subjects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    code: text('code').notNull(),
    examCategory: text('exam_category').notNull().default('JAMB UTME Practice Exam'),
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
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    title: text('title').notNull(),
    level: text('level').notNull().default('UTME'),
    description: text('description').notNull().default(''),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('courses_subject_code_unique_idx').on(table.subjectId, table.code),
    index('courses_subject_idx').on(table.subjectId),
  ]
);

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
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
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
    examTitle: text('exam_title').notNull().default('JAMB UTME Practice Exam'),
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
    check(
      'study_materials_category_check',
      sql`${table.category} IN ('Tutorials', 'Notes', 'Past Questions', 'Guides')`
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
