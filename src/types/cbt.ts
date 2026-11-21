export type UserRole = 'student' | 'admin' | 'super_admin';
export type AccountStatus = 'active' | 'suspended';
export type NotificationType = 'admin_direct' | 'payment_success' | 'system';
export type DifficultyLevel = 'All Levels' | 'Easy' | 'Medium' | 'Hard';
export type QuestionDifficulty = 'Easy' | 'Medium' | 'Hard';
export type OptionLetter = 'A' | 'B' | 'C' | 'D';
export type MaterialCategory =
  | 'Tutorials'
  | 'Notes'
  | 'Past Questions'
  | 'Guides'
  | 'Lecture Notes'
  | 'Handouts'
  | 'Practical Guides';
export type MaterialPublicationStatus = 'published' | 'unpublished';
export type PublicationStatus = 'draft' | 'published' | 'archived';
export type QuestionPublicationStatus = 'draft' | 'published';
export type AiConnectionStatus = 'connected' | 'failed' | 'unconfigured' | 'unknown';
export type AiKeySource = 'database' | 'environment' | 'none';

export interface AiSettingsSummary {
  configured: boolean;
  source: AiKeySource;
  maskedKey: string | null;
  modelName: string;
  connectionStatus: AiConnectionStatus;
  lastTestedAt: string | null;
  lastTestMessage: string | null;
  updatedAt: string | null;
}

export interface QuestionImageItem {
  id: string;
  questionId: string;
  sortOrder: number;
  caption: string | null;
  mimeType: string;
  fileName: string;
  fileSizeBytes: number;
  url: string;
  createdAt: string;
}
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
export type ActivationSource = 'paystack' | 'admin_manual';

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
  registrationCode?: string | null;
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
  faculty?: string;
  department?: string;
  semester?: string;
  description: string;
  courseValue?: number;
  registrationFee: number;
  currency: string;
  publicationStatus: PublicationStatus;
  examCategory: string;
  defaultDurationMinutes: number;
  questionCount: number;
  isRegistered: boolean;
  activationSource?: ActivationSource | null;
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
  faculty?: string;
  department?: string;
  semester?: string;
  description: string;
  examCategory: string;
  defaultDurationMinutes: number;
  whatsappGroupLink?: string | null;
  registrationStatus: string;
  activationSource?: ActivationSource;
  activatedAt?: string | null;
  registeredAt: string;
  whatsappNumber?: string | null;
  paymentId: string | null;
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
  images?: QuestionImageItem[];
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
  courseLevel?: string | null;
  faculty?: string | null;
  department?: string | null;
  academicLevel?: string | null;
  semester?: string | null;
  title: string;
  description: string;
  category: MaterialCategory;
  fileType: 'PDF' | 'DOC' | 'IMAGE' | 'OTHER';
  fileSizeBytes: number;
  originalFilename?: string | null;
  mimeType: string;
  price: number;
  currency: string;
  publicationStatus?: MaterialPublicationStatus;
  isFree: boolean;
  isPurchased: boolean;
  purchaseStatus?: 'free' | 'payment_required' | 'pending' | 'purchased';
  pendingPaymentReference?: string | null;
  downloadCount: number;
  freeDownloadCount?: number;
  purchaseCount?: number;
  totalRevenue?: number;
  createdAt: string;
}

export interface StudyMaterialCourseSummary {
  courseId: string | null;
  code: string;
  title: string;
  level: string;
  faculty?: string;
  department?: string;
  semester?: string;
  registrationFee?: number;
  currency?: string;
  isRegistered?: boolean;
  locked?: boolean;
  materialCount: number;
  freeCount: number;
  paidCount: number;
  unlockedCount: number;
}

export interface StudentMaterialPurchaseItem {
  id: string;
  materialId: string;
  materialTitle: string;
  category: MaterialCategory;
  fileType: 'PDF' | 'DOC' | 'IMAGE' | 'OTHER';
  fileSizeBytes: number;
  materialIsActive: boolean;
  materialPublicationStatus: MaterialPublicationStatus;
  courseId: string | null;
  courseCode: string | null;
  courseTitle: string | null;
  amount: number;
  currency: string;
  paymentReference: string;
  paymentStatus: PaymentStatus;
  paymentChannel: string | null;
  paidAt: string | null;
  createdAt: string;
  isCourseRegistered: boolean;
  isMaterialPublished: boolean;
  canDownload: boolean;
}

export interface AdminMaterialSalesReport {
  summary: {
    totalMaterials: number;
    publishedMaterials: number;
    unpublishedMaterials: number;
    totalSuccessfulPurchases: number;
    totalRevenue: number;
    totalFreeDownloads: number;
    totalDownloadEvents: number;
  };
  mostPurchasedMaterials: Array<{
    materialId: string;
    title: string;
    courseCode: string | null;
    courseTitle: string | null;
    category: string;
    price: number;
    purchaseCount: number;
    revenue: number;
    freeDownloads: number;
    downloadCount: number;
  }>;
  salesByCourse: Array<{
    courseId: string | null;
    courseCode: string;
    courseTitle: string;
    department: string;
    materialCount: number;
    purchaseCount: number;
    revenue: number;
    freeDownloads: number;
  }>;
  salesByDepartment: Array<{
    department: string;
    materialCount: number;
    purchaseCount: number;
    revenue: number;
    freeDownloads: number;
  }>;
  transactions: Array<{
    id: string;
    studentId: string;
    studentName: string;
    studentEmail: string;
    studentRegistrationCode: string | null;
    materialId: string;
    materialTitle: string;
    category: string;
    courseId: string | null;
    courseCode: string | null;
    courseTitle: string | null;
    department: string | null;
    amount: number;
    currency: string;
    paymentReference: string;
    paymentStatus: PaymentStatus;
    paymentChannel: string | null;
    gatewayTransactionId: string | null;
    paidAt: string | null;
    createdAt: string;
  }>;
}

export interface MaterialPaymentInitResponse {
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
  paymentType?: 'course' | 'study_material';
  verificationResult?: PaymentVerificationResult;
  paymentStatus: PaymentStatus | 'not_found';
  alreadyProcessed: boolean;
  unlocked: boolean;
  message: string;
  payment: {
    id: string;
    studentId: string;
    courseId?: string;
    materialId?: string;
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
  registration?: {
    id: string;
    studentId: string;
    courseId: string;
    paymentId: string;
    whatsappNumber?: string | null;
    registrationStatus: string;
    registeredAt: string;
  } | null;
  course?: {
    id: string;
    code: string;
    title: string;
    courseValue?: string;
    registrationFee: string;
    currency: string;
    whatsappGroupLink?: string | null;
  } | null;
  material?: {
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
  faculty?: string;
  department?: string;
  semester?: string;
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
  publicationStatus?: QuestionPublicationStatus;
  aiGenerated?: boolean;
  aiRequiresImage?: boolean;
  aiImageNote?: string | null;
  aiBatchId?: string | null;
  images?: QuestionImageItem[];
  createdAt: string;
}

export interface AdminRegistrationItem {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentRegistrationCode?: string | null;
  whatsappNumber?: string | null;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  paymentId: string;
  paymentReference: string;
  activationSource?: ActivationSource;
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
    activationSource?: ActivationSource | null;
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

export type EmailServiceConnectionStatus =
  | 'connected'
  | 'unconfigured'
  | 'connection_failed'
  | 'unknown';

export interface AdminEmailStatusOverview {
  emailService: {
    provider: 'Resend Transactional Email API';
    configured: boolean;
    missingVariables: string[];
    validationErrors: string[];
    apiUrl: string | null;
    apiKeyMasked: string | null;
    fromEmail: string | null;
    replyToEmail?: string | null;
    appBaseUrl: string;
    connectionStatus: EmailServiceConnectionStatus;
    lastCheckedAt: string | null;
    lastError: string | null;
  };
  delivery: {
    totalAcceptedQueued: number;
    totalDeliveredConfirmed: number;
    totalSent: number;
    totalFailed: number;
    totalSkippedUnconfigured: number;
    lastSuccessfulAttemptAt: string | null;
    lastDeliveredConfirmedAt: string | null;
    lastFailedAttemptAt: string | null;
    lastFailureReason: string | null;
    recentLogs: Array<{
      id: string;
      recipientEmail: string;
      emailType: string;
      subject: string;
      deliveryStatus: string;
      messageId: string | null;
      providerMessageUuid: string | null;
      providerStatus: string | null;
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
  accountStatus: AccountStatus;
  isActive: boolean;
  joinedAt: string;
  gst111Status: 'active' | 'locked';
  activationSource: 'admin_manual' | 'paystack' | 'none';
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

export interface Gst111StudentsResponse {
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
}

export type RewardChallengeDisplayStatus =
  | 'Upcoming'
  | 'Active'
  | 'Examination in Progress'
  | 'Examination Completed'
  | 'Winner Announced'
  | 'Challenge Closed';

export type RewardChallengeLifecycleStatus = 'draft' | 'active' | 'closed' | 'deactivated';
export type RewardChallengeSelectionMode = 'random' | 'ordered';
export type RewardChallengePaymentStatus =
  | 'payment_pending'
  | 'payment_processing'
  | 'payment_completed';

export interface RewardChallengeSettingsData {
  timezone: string;
  challengeOpenAt: string;
  examStartAt: string;
  examEndAt: string;
  durationMinutes: number;
  questionCount: number;
  selectionMode: RewardChallengeSelectionMode;
  winnerAnnouncementAt: string;
  challengeCloseAt: string | null;
  examFinalizedAt: string | null;
  winnerAnnouncedAt: string | null;
}

export interface RewardChallengeWinnerPublic {
  id: string;
  challengeId: string;
  studentId: string;
  position: number;
  studentName: string;
  studentRegistrationCode?: string | null;
  score: number;
  totalQuestions: number;
  percentage: number;
  completionTimeSeconds: number;
  rewardAmount: number;
  rewardCurrency: string;
  announcedAt: string;
  isCurrentUserWinner?: boolean;
}

export interface RewardChallengeBankDetailsData {
  id: string;
  challengeId: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  editLocked: boolean;
  correctionNote: string | null;
  submittedAt: string;
  updatedAt: string;
}

export interface RewardChallengePaymentData {
  id: string;
  challengeId: string;
  challengeTitle?: string;
  winnerId: string;
  studentId: string;
  studentName?: string;
  studentRegistrationCode?: string | null;
  score?: number;
  totalQuestions?: number;
  position?: number;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  bankSubmittedAt?: string | null;
  rewardAmount: number;
  currency: string;
  paymentStatus: RewardChallengePaymentStatus;
  paidByAdminName: string | null;
  paidByAdminEmail: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RewardChallengeAttemptSummary {
  id: string;
  status: 'in_progress' | 'submitted' | 'auto_submitted';
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  completionSeconds: number | null;
  totalQuestions: number;
  durationSeconds: number;
  submissionSource: string | null;
}

export interface RewardChallengeResultSummary {
  id: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unansweredQuestions: number;
  score: number;
  percentage: number;
  completionTimeSeconds: number;
  submittedAt: string;
  isFinalized: boolean;
  position: number | null;
}

export interface RewardChallengeSummary {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  isFeatured: boolean;
  lifecycleStatus: RewardChallengeLifecycleStatus;
  displayStatus: RewardChallengeDisplayStatus;
  rewardAmount: number;
  rewardCurrency: string;
  uploadedQuestionCount: number;
  publishedQuestionCount: number;
  participantCount: number;
  submittedCount: number;
  settings: RewardChallengeSettingsData;
  canStartExam: boolean;
  canJoinWaitingRoom: boolean;
  unavailableReason: string | null;
  hasWinner: boolean;
  winner: RewardChallengeWinnerPublic | null;
  noValidParticipants: boolean;
  serverNow: string;
  myParticipation: {
    joined: boolean;
    attempt: RewardChallengeAttemptSummary | null;
    result: RewardChallengeResultSummary | null;
    isWinner: boolean;
    myBankDetails: RewardChallengeBankDetailsData | null;
    myPayment: RewardChallengePaymentData | null;
  };
}

export interface RewardChallengeExamQuestion {
  order: number;
  questionId: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  subjectCategory: string;
  selectedOption: OptionLetter | null;
  isMarkedForReview: boolean;
}

export interface RewardChallengeGradedQuestion extends RewardChallengeExamQuestion {
  correctOption: OptionLetter;
  explanation: string;
  isCorrect: boolean | null;
}

export interface RewardChallengeAttemptPayload {
  challenge: RewardChallengeSummary;
  attempt: RewardChallengeAttemptSummary;
  remainingSeconds: number;
  serverNow: string;
  questions: RewardChallengeExamQuestion[] | RewardChallengeGradedQuestion[];
  answersRevealed: boolean;
  result: RewardChallengeResultSummary | null;
}

export interface RewardChallengeLeaderboardEntry {
  position: number;
  studentId: string;
  studentName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  completionTimeSeconds: number;
  submittedAt: string;
  isFinal: boolean;
  isCurrentUser: boolean;
}

export interface RewardChallengeLeaderboardResponse {
  challengeId: string;
  challengeTitle: string;
  displayStatus: RewardChallengeDisplayStatus;
  isFinal: boolean;
  winnerAnnouncementAt: string;
  winnerAnnouncedAt: string | null;
  winner: RewardChallengeWinnerPublic | null;
  myRank: RewardChallengeLeaderboardEntry | null;
  entries: RewardChallengeLeaderboardEntry[];
  serverNow: string;
}

export interface RewardChallengeAdminOverview {
  totalRegisteredStudents: number;
  totalParticipants: number;
  totalSubmittedExaminations: number;
  totalCompletedExaminations: number;
  currentStatus: RewardChallengeDisplayStatus;
  lifecycleStatus: RewardChallengeLifecycleStatus;
  scheduledExamStartAt: string;
  scheduledExamEndAt: string;
  uploadedQuestionsCount: number;
  publishedQuestionsCount: number;
  winnerAnnouncementStatus: string;
  rewardPaymentStatus: string;
}

export interface RewardChallengeAdminQuestion {
  id: string;
  challengeId: string;
  sortOrder: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: OptionLetter;
  explanation: string;
  subjectCategory: string;
  publicationStatus: QuestionPublicationStatus;
  sourceType: 'manual' | 'bulk_upload' | 'ai_generated';
  createdAt: string;
}

export interface RewardChallengeAiDraftQuestion {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: OptionLetter;
  explanation: string;
  subjectCategory: string;
}

export interface RewardChallengeAdminParticipantItem {
  participantId: string;
  studentId: string;
  fullName: string;
  email: string;
  registrationCode: string | null;
  status: 'joined' | 'in_progress' | 'completed';
  joinedAt: string;
  attemptStatus: 'not_started' | 'in_progress' | 'submitted' | 'auto_submitted';
  startedAt: string | null;
  submittedAt: string | null;
  completionTimeSeconds: number | null;
  score: number | null;
  totalQuestions: number | null;
  percentage: number | null;
}

export interface RewardChallengeStudentHistoryItem {
  challengeId: string;
  challengeTitle: string;
  rewardAmount: number;
  rewardCurrency: string;
  attemptId: string;
  status: string;
  submittedAt: string | null;
  score: number | null;
  totalQuestions: number;
  percentage: number | null;
  completionTimeSeconds: number | null;
  position: number | null;
  isWinner: boolean;
  paymentStatus: RewardChallengePaymentStatus | null;
  paidAt: string | null;
  paymentReference: string | null;
}

export interface RewardChallengeAdminWinnerPayment {
  id: string;
  challengeId: string;
  winnerId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentRegistrationCode: string | null;
  score: number;
  totalQuestions: number;
  percentage: number;
  completionTimeSeconds: number;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  correctionNote: string | null;
  bankSubmittedAt: string | null;
  rewardAmount: number;
  currency: string;
  paymentStatus: RewardChallengePaymentStatus;
  paidByAdminName: string | null;
  paidByAdminEmail: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

