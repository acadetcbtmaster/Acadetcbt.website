export type UserRole = 'student' | 'admin' | 'super_admin';
export type DifficultyLevel = 'All Levels' | 'Easy' | 'Medium' | 'Hard';
export type QuestionDifficulty = 'Easy' | 'Medium' | 'Hard';
export type OptionLetter = 'A' | 'B' | 'C' | 'D';
export type MaterialCategory = 'Tutorials' | 'Notes' | 'Past Questions' | 'Guides';
export type PublicationStatus = 'draft' | 'published' | 'archived';
export type PaymentStatus = 'pending' | 'successful' | 'failed' | 'refunded';
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
  isActive: boolean;
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
  registrationStatus: string;
  registeredAt: string;
  paymentId: string;
  paymentReference: string;
  paymentStatus: PaymentStatus;
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
  amount: number;
  currency: string;
  course: {
    id: string;
    code: string;
    title: string;
    level: string;
  };
}

export interface PaymentVerifyOutcome {
  paymentStatus: PaymentStatus;
  alreadyProcessed: boolean;
  unlocked: boolean;
  message: string;
  payment: {
    id: string;
    studentId: string;
    courseId: string;
    paymentReference: string;
    gateway: string;
    amount: string;
    currency: string;
    paymentStatus: PaymentStatus;
    gatewayTransactionId: string | null;
    paidAt: string | null;
    createdAt: string;
  };
  registration: {
    id: string;
    studentId: string;
    courseId: string;
    paymentId: string;
    registrationStatus: string;
    registeredAt: string;
  } | null;
  course: {
    id: string;
    code: string;
    title: string;
    registrationFee: string;
    currency: string;
  } | null;
}

export interface StudentPaymentRecord {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  paymentReference: string;
  gateway: string;
  amount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  gatewayTransactionId: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface AdminOverview {
  totalUsers: number;
  totalCourses: number;
  totalQuestions: number;
  totalMaterials: number;
  totalSubmittedExams: number;
  totalActiveRegistrations: number;
  totalSuccessfulPayments: number;
  totalRevenueNaira: number;
}

export interface AdminCourseItem {
  id: string;
  subjectId: string | null;
  code: string;
  title: string;
  level: string;
  description: string;
  registrationFee: number;
  currency: string;
  publicationStatus: PublicationStatus;
  examCategory: string;
  defaultDurationMinutes: number;
  isActive: boolean;
  createdAt: string;
  questionCount: number;
  totalRegistrations: number;
  totalRevenue: number;
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
  courseId: string;
  courseCode: string;
  courseTitle: string;
  paymentId: string;
  paymentReference: string;
  amount: number;
  currency: string;
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
  courseId: string;
  courseCode: string;
  courseTitle: string;
  paymentReference: string;
  gateway: string;
  amount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  gatewayTransactionId: string | null;
  gatewayResponse: Record<string, unknown>;
  paidAt: string | null;
  createdAt: string;
  registrationId: string | null;
  registrationStatus: string | null;
}

export interface AdminStudentProfile {
  student: SafeUser;
  coursesStatus: Array<{
    courseId: string;
    code: string;
    title: string;
    level: string;
    registrationFee: number;
    currency: string;
    isRegistered: boolean;
    registeredAt: string | null;
    paymentStatus: PaymentStatus | null;
    paymentReference: string | null;
    amountPaid: number | null;
  }>;
  payments: StudentPaymentRecord[];
  summary: {
    totalPublishedCourses: number;
    totalCoursesRegistered: number;
    totalSuccessfulPayments: number;
    totalAmountPaid: number;
    outstandingCourseRegistrations: number;
  };
}
