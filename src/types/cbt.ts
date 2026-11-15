export type UserRole = 'student' | 'admin' | 'super_admin';
export type AccountStatus = 'active' | 'suspended';
export type NotificationType = 'admin_direct' | 'payment_success' | 'system';
export type DifficultyLevel = 'All Levels' | 'Easy' | 'Medium' | 'Hard';
export type QuestionDifficulty = 'Easy' | 'Medium' | 'Hard';
export type OptionLetter = 'A' | 'B' | 'C' | 'D';
export type MaterialCategory = 'Tutorials' | 'Notes' | 'Past Questions' | 'Guides';
export type PublicationStatus = 'draft' | 'published' | 'archived';
export type PaymentStatus = 'pending' | 'successful' | 'failed' | 'refunded';
export type PaymentVerificationResult =
  | 'successful'
  | 'already_registered'
  | 'pending'
  | 'failed'
  | 'not_found'
  | 'awaiting_admin_review'
  | 'unauthorized_or_mismatch';
export type ReconciliationStatus = 'pending' | 'reconciled' | 'shortfall' | 'not_applicable';
export type CourseRegistrationState = 'registered' | 'pending' | 'failed' | 'not_registered';

export interface UserPreferences {
  theme: 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
  soundNotifications: boolean;
  autoNextQuestion: boolean;
  showQuestionPalette: boolean;
  defaultCourseId?: string | null;
  defaultSubjectId?: string | null;
  defaultDifficulty: DifficultyLevel;
}

export interface SafeUser {
  id: string;
  fullName: string;
  email: string;
  username: string;
  role: UserRole;
  examTarget: string;
  whatsappNumber?: string | null;
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  isActive: boolean;
  accountStatus: AccountStatus;
  suspendedReason?: string | null;
  suspendedAt?: string | null;
  registeredCoursesCount?: number;
  submittedExamsCount?: number;
  preferences: UserPreferences;
  createdAt: string;
}

export interface CourseCatalogueItem {
  id: string;
  subjectId?: string | null;
  code: string;
  title: string;
  level: string;
  description: string;
  courseValue?: number;
  registrationFee: number;
  currency: string;
  publicationStatus: PublicationStatus;
  examCategory: string;
  defaultDurationMinutes: number;
  questionCount: number;
  isRegistered: boolean;
  registrationState: CourseRegistrationState;
  registeredAt: string | null;
  latestPaymentStatus: PaymentStatus | null;
  latestPaymentReference: string | null;
}

export interface RegisteredCourseItem {
  registrationId: string;
  courseId: string;
  code: string;
  title: string;
  level: string;
  description: string;
  examCategory: string;
  defaultDurationMinutes: number;
  whatsappGroupLink?: string | null;
  registrationStatus: string;
  registeredAt: string;
  whatsappNumber?: string | null;
  paymentId: string;
  paymentReference: string;
  paymentStatus: PaymentStatus;
  courseValue?: number;
  amountPaid: number;
  currency: string;
  paidAt: string | null;
  questionCount: number;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  isActive?: boolean;
  createdAt: string;
}

export interface ActivitySummary {
  lastAttempt: {
    id: string;
    courseId: string;
    courseCode: string;
    courseTitle: string;
    scorePercentage: number | null;
    correctCount: number | null;
    totalQuestions: number;
    submittedAt: string | null;
  } | null;
  bestScore: number | null;
  totalCompletedExams: number;
}

export interface ActiveExamSession {
  id: string;
  userId: string;
  courseId: string;
  courseTitle: string;
  courseCode: string;
  examTitle: string;
  difficultyFilter: string;
  totalQuestions: number;
  timeLimitSeconds: number;
  timeSpentSeconds: number;
  status: 'in_progress' | 'submitted' | 'abandoned';
  correctCount?: number | null;
  wrongCount?: number | null;
  unansweredCount?: number | null;
  scorePercentage?: number | null;
  startedAt: string;
  submittedAt?: string | null;
}

export interface ActiveExamQuestion {
  order: number;
  questionId: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  difficulty: QuestionDifficulty;
  topic: string;
  selectedOption: OptionLetter | null;
  isMarkedForReview: boolean;
}

export interface GradedExamQuestion extends ActiveExamQuestion {
  isCorrect: boolean | null;
  correctOption: OptionLetter;
  explanation: string;
}

export interface ResultsOverview {
  kpis: {
    averageScore: number;
    examsTaken: number;
    bestScore: number;
    totalTimeSeconds: number;
  };
  trend: Array<{
    label: string;
    sessionId: string;
    courseTitle: string;
    courseCode: string;
    scorePercentage: number;
    submittedAt: string | null;
  }>;
  history: Array<{
    id: string;
    courseId: string;
    courseTitle: string;
    courseCode: string;
    examTitle: string;
    difficultyFilter: string;
    totalQuestions: number;
    correctCount: number | null;
    wrongCount: number | null;
    unansweredCount: number | null;
    scorePercentage: number | null;
    timeSpentSeconds: number;
    startedAt: string;
    submittedAt: string | null;
  }>;
}

export interface StudyMaterialItem {
  id: string;
  courseId: string | null;
  courseTitle: string | null;
  courseCode: string | null;
  title: string;
  description: string;
  category: MaterialCategory;
  fileType: 'PDF' | 'DOC' | 'IMAGE' | 'OTHER';
  fileSizeBytes: number;
  mimeType: string;
  downloadCount: number;
  createdAt: string;
}

export interface PaymentInitializeResponse {
  paymentId: string;
  reference: string;
  authorizationUrl: string;
  accessCode: string;
  courseValue?: number;
  amount: number;
  feeAbsorbedBy?: string;
  currency: string;
  course: {
    id: string;
    code: string;
    title: string;
    level: string;
  };
}

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
  whatsappGroupLink?: string | null;
}

export interface PaymentVerifyOutcome {
  verificationResult?: PaymentVerificationResult;
  paymentStatus: PaymentStatus | 'not_found';
  alreadyProcessed: boolean;
  unlocked: boolean;
  message: string;
  payment: {
    id: string;
    studentId: string;
    courseId: string;
    paymentReference: string;
    gateway: string;
    whatsappNumber?: string | null;
    courseValue?: string;
    totalAmountCharged?: string;
    amount: string;
    currency: string;
    gatewayFee?: string | null;
    gatewayFeeSource?: string | null;
    netSettlementAmount?: string | null;
    settlementVariance?: string | null;
    reconciliationStatus?: ReconciliationStatus;
    feeAbsorbedBy?: string;
    paymentChannel?: string | null;
    paymentStatus: PaymentStatus;
    gatewayTransactionId: string | null;
    paidAt: string | null;
    createdAt: string;
  } | null;
  registration: {
    id: string;
    studentId: string;
    courseId: string;
    paymentId: string;
    whatsappNumber?: string | null;
    registrationStatus: string;
    registeredAt: string;
  } | null;
  course: {
    id: string;
    code: string;
    title: string;
    courseValue?: string;
    registrationFee: string;
    currency: string;
    whatsappGroupLink?: string | null;
  } | null;
  receipt?: PaymentReceiptData | null;
}

export interface StudentPaymentRecord {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  courseLevel?: string;
  paymentReference: string;
  gateway: string;
  whatsappNumber?: string | null;
  courseValue?: number;
  totalAmountCharged?: number;
  amount: number;
  currency: string;
  gatewayFee?: number | null;
  gatewayFeeSource?: string | null;
  netSettlementAmount?: number | null;
  settlementVariance?: number | null;
  reconciliationStatus?: ReconciliationStatus;
  feeAbsorbedBy?: string;
  paymentChannel?: string | null;
  paymentStatus: PaymentStatus;
  authorizationUrl?: string | null;
  gatewayTransactionId: string | null;
  paidAt: string | null;
  createdAt: string;
  registrationStatus?: string | null;
  registeredAt?: string | null;
  whatsappGroupLink?: string | null;
}

export interface AdminOverview {
  totalUsers: number;
  totalCourses: number;
  totalQuestions: number;
  totalActiveQuestions?: number;
  totalEasyQuestions?: number;
  totalMediumQuestions?: number;
  totalHardQuestions?: number;
  totalUncategorizedQuestions?: number;
  totalInactiveQuestions?: number;
  coursesReadyForCbt?: number;
  totalMaterials: number;
  totalSubmittedExams: number;
  totalActiveRegistrations: number;
  totalSuccessfulPayments: number;
  totalRevenueNaira: number;
  totalCourseValueNaira?: number;
  totalPaystackFeesNaira?: number;
  totalNetSettlementNaira?: number;
  totalReconciledPayments?: number;
  totalShortfallPayments?: number;
}

export interface AdminCourseItem {
  id: string;
  subjectId: string | null;
  code: string;
  title: string;
  level: string;
  description: string;
  courseValue?: number;
  registrationFee: number;
  currency: string;
  publicationStatus: PublicationStatus;
  examCategory: string;
  defaultDurationMinutes: number;
  whatsappGroupLink?: string | null;
  isActive: boolean;
  createdAt: string;
  questionCount: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  uncategorizedCount: number;
  inactiveCount: number;
  cbtReady: boolean;
  totalRegistrations: number;
  totalRevenue: number;
}

export interface CourseQuestionStatsItem {
  courseId: string;
  code: string;
  title: string;
  level: string;
  examCategory: string;
  publicationStatus: PublicationStatus;
  defaultDurationMinutes: number;
  questionCount: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  uncategorizedCount: number;
  inactiveCount: number;
  cbtReady: boolean;
  readinessStatus: 'ready' | 'low' | 'empty';
  readinessLabel: string;
  lastQuestionUpdatedAt: string | null;
}

export interface QuestionStatsSummary {
  totalCourses: number;
  publishedCourses: number;
  cbtReadyCourses: number;
  cbtMinRecommended: number;
  totalActiveQuestions: number;
  totalInactiveQuestions: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  uncategorizedCount: number;
  unassignedActiveQuestions: number;
}

export interface QuestionStatsResponse {
  summary: QuestionStatsSummary;
  courses: CourseQuestionStatsItem[];
}

export interface AdminQuestionItem {
  id: string;
  courseId: string | null;
  courseCode: string;
  courseTitle: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: OptionLetter;
  explanation: string;
  difficulty: QuestionDifficulty;
  topic: string;
  examYear: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface AdminRegistrationItem {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  whatsappNumber?: string | null;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  paymentId: string;
  paymentReference: string;
  courseValue?: number;
  totalAmountCharged?: number;
  amount: number;
  currency: string;
  gatewayFee?: number | null;
  netSettlementAmount?: number | null;
  settlementVariance?: number | null;
  reconciliationStatus?: ReconciliationStatus;
  paymentChannel?: string | null;
  paymentStatus: PaymentStatus;
  registrationStatus: string;
  gateway: string;
  gatewayTransactionId: string | null;
  paidAt: string | null;
  registeredAt: string;
}

export interface AdminPaymentRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  whatsappNumber?: string | null;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  paymentReference: string;
  gateway: string;
  courseValue?: number;
  totalAmountCharged?: number;
  amount: number;
  currency: string;
  gatewayFee?: number | null;
  gatewayFeeSource?: string | null;
  netSettlementAmount?: number | null;
  settlementVariance?: number | null;
  reconciliationStatus?: ReconciliationStatus;
  feeAbsorbedBy?: string;
  paymentChannel?: string | null;
  paymentStatus: PaymentStatus;
  gatewayTransactionId: string | null;
  gatewayResponse: Record<string, unknown>;
  paidAt: string | null;
  createdAt: string;
  registrationId: string | null;
  registrationStatus: string | null;
}

export interface StudentNotificationItem {
  id: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  senderName: string;
  courseId: string | null;
  courseCode: string | null;
  courseTitle: string | null;
  paymentId: string | null;
  actionLabel: string | null;
  actionUrl: string | null;
  createdAt: string;
  readAt: string | null;
  isRead: boolean;
}

export interface AdminNotificationRecord {
  id: string;
  recipientUserId: string;
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  courseCode: string | null;
  courseTitle: string | null;
  actionLabel: string | null;
  actionUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface StudentExamHistoryItem {
  id: string;
  courseId: string | null;
  courseCode: string | null;
  courseTitle: string | null;
  examTitle: string;
  difficultyFilter: string;
  status: string;
  totalQuestions: number;
  correctCount: number | null;
  scorePercentage: number | null;
  timeSpentSeconds: number;
  startedAt: string;
  submittedAt: string | null;
}

export interface AdminStudentProfile {
  student: SafeUser;
  coursesStatus: Array<{
    courseId: string;
    code: string;
    title: string;
    level: string;
    courseValue?: number;
    registrationFee: number;
    currency: string;
    isRegistered: boolean;
    registeredAt: string | null;
    whatsappNumber?: string | null;
    paymentStatus: PaymentStatus | null;
    paymentReference: string | null;
    amountPaid: number | null;
  }>;
  payments: StudentPaymentRecord[];
  examHistory: StudentExamHistoryItem[];
  summary: {
    totalPublishedCourses: number;
    totalCoursesRegistered: number;
    totalSuccessfulPayments: number;
    totalAmountPaid: number;
    totalSubmittedExams: number;
    outstandingCourseRegistrations: number;
  };
}

export interface SocialLinksMap {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  youtube?: string;
  linkedin?: string;
  whatsapp?: string;
  tiktok?: string;
  website?: string;
}

export interface SiteBrandingData {
  siteName: string;
  tagline: string;
  siteDescription: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  logoUrl: string;
  faviconUrl: string;
  contactEmail: string;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  socialLinks: SocialLinksMap;
  updatedAt: string;
}

export interface FounderProfileData {
  fullName: string;
  positionTitle: string;
  biography: string;
  founderMessage: string;
  visionStatement: string;
  missionStatement: string;
  backgroundStory: string;
  photoUrl: string | null;
  socialLinks: SocialLinksMap;
  updatedAt: string;
}

export interface PublicCourseSummary {
  id: string;
  code: string;
  title: string;
  level: string;
  description: string;
  courseValue: number;
  registrationFee: number;
  currency: string;
  examCategory: string;
  defaultDurationMinutes: number;
  questionCount: number;
}

export interface PublicSiteDataResponse {
  branding: SiteBrandingData;
  founder: FounderProfileData;
  courses: PublicCourseSummary[];
}

export interface PaymentResetPreview {
  totalPayments: number;
  successfulCount: number;
  liveSuccessfulCount: number;
  pendingCount: number;
  failedCount: number;
  refundedCount: number;
  testCount: number;
  testAndStaleCount: number;
  linkedRegistrationsCount: number;
  activeRegistrationsCount: number;
  webhookEventsCount: number;
}

export interface PaymentBackupSummary {
  id: string;
  backupLabel: string;
  resetScope: 'manual_snapshot' | 'test_and_stale' | 'full_production_reset';
  totalPaymentsCount: number;
  successfulCount: number;
  pendingCount: number;
  failedCount: number;
  testCount: number;
  createdByName?: string | null;
  createdAt: string;
}

export interface AdminPaymentVerificationLog {
  id: string;
  studentId: string | null;
  studentName: string | null;
  studentEmail: string | null;
  paymentId: string | null;
  courseId: string | null;
  courseCode: string | null;
  courseTitle: string | null;
  paymentReference: string;
  verificationSource: 'student_manual' | 'callback' | 'webhook' | 'admin_reverify' | 'admin_review';
  verificationResult: PaymentVerificationResult;
  paymentStatus: string | null;
  registrationStatus: string | null;
  paystackStatus: string | null;
  paystackAmountKobo: number | null;
  paystackCurrency: string | null;
  paystackCustomerEmail: string | null;
  paystackTransactionId: string | null;
  paystackPayload: Record<string, unknown>;
  reason: string;
  resolvedBy: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

export type SmtpConnectionStatus =
  | 'connected'
  | 'unconfigured'
  | 'connection_failed'
  | 'unknown';

export interface AdminEmailStatusOverview {
  smtp: {
    configured: boolean;
    missingVariables: string[];
    validationErrors: string[];
    host: string | null;
    port: number | null;
    secure: boolean;
    userMasked: string | null;
    fromEmail: string | null;
    appBaseUrl: string;
    connectionStatus: SmtpConnectionStatus;
    lastCheckedAt: string | null;
    lastError: string | null;
  };
  delivery: {
    totalSent: number;
    totalFailed: number;
    totalSkippedUnconfigured: number;
    lastSuccessfulAttemptAt: string | null;
    lastFailedAttemptAt: string | null;
    lastFailureReason: string | null;
    recentLogs: Array<{
      id: string;
      recipientEmail: string;
      emailType: string;
      subject: string;
      deliveryStatus: string;
      errorMessage: string | null;
      createdAt: string;
    }>;
  };
  verificationStats: {
    totalUsers: number;
    verifiedUsers: number;
    unverifiedUsers: number;
    activePendingTokens: number;
    totalVerificationsCompleted: number;
  };
  passwordRecoveryStats: {
    requestsLast24h: number;
    requestsTotal: number;
    completedResetsTotal: number;
    activePendingTokens: number;
    expiredOrInvalidatedTokens: number;
  };
}
