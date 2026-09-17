export type UserRole = 'student' | 'admin';

export interface Subscription {
  isPremium: boolean;
  plan: 'Free Trial' | '14-Day Premium' | '30-Day Premium' | string;
  startDate: string | null;
  expiryDate: string | null;
  questionsAttemptedCount: number;
  freeLimit: number;
}

export interface UserProfile {
  id: string;
  name: string;
  username?: string;
  email: string;
  phone?: string;
  passwordHint?: string;
  password?: string;
  photoUrl?: string;
  googleUserId?: string;
  authProvider?: 'Google' | 'Email' | string;
  role: UserRole;
  adminRole?: string;
  avatarUrl?: string;
  universityId: string;
  universityName?: string;
  departmentId: string;
  departmentName?: string;
  subscription: Subscription;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  bookmarks: string[]; // Question IDs
  purchasedMaterialIds?: string[]; // Material IDs user paid 500 NGN for
  seenQuestionIds?: string[]; // Question IDs user has practiced
  createdDate: string;
  createdAt?: string;
  registeredDate?: string;
  updatedAt?: string;
  lastActiveDate?: string;
  isOnline?: boolean;
  streakCount?: number;
  lastPracticeDate?: string;
  streakHistory?: string[];
  isRestricted?: boolean;
  isBanned?: boolean;
  banReason?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  referredBy?: string;
  isGuest?: boolean;
}

export interface University {
  id: string;
  name: string;
  abbreviation: string;
  location: string;
  logoUrl?: string;
}

export interface Faculty {
  id: string;
  universityId: string;
  name: string;
  code?: string;
  description?: string;
  deanName?: string;
  status?: 'Active' | 'Disabled';
  createdAt?: string;
}

export interface Department {
  id: string;
  facultyId: string;
  name: string;
  code?: string;
  universityId?: string;
  description?: string;
  headOfDepartment?: string;
  durationYears?: number;
  status?: 'Active' | 'Disabled';
  createdAt?: string;
}

export interface Course {
  id: string;
  universityId?: string;
  universityName?: string;
  facultyId?: string;
  facultyName?: string;
  departmentId: string;
  departmentName?: string;
  code: string;
  title: string;
  level?: string;
  semester: 'First' | 'Second' | 'First Semester' | 'Second Semester' | string;
  session: string;
  description?: string;
  isDisabled?: boolean;
}

export interface Topic {
  id: string;
  courseId: string;
  name: string;
}

export type QuestionSource = 'Past Question' | 'Material Generated' | 'SMART Generated' | 'Smart Upload' | 'Manual Admin' | 'Bulk Import' | 'Bulk JSON Import' | 'Past Questions Text Import' | string;
export type QuestionStatus = 'Draft' | 'Pending' | 'Under Review' | 'Publishing Queue' | 'Published' | 'Rejected';
export type DifficultyLevel = 'Medium' | string;
export type QuestionType = 'MCQ' | 'True or False' | 'Fill in the Blank' | 'Matching';

export interface QuestionVersion {
  version: number;
  editor: string;
  date: string;
  changes: string;
  snapshot: Partial<Question>;
}

export interface Question {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D' | string;
  explanation: string;
  universityId: string;
  facultyId?: string;
  departmentId?: string;
  courseId: string;
  courseCode?: string;
  level?: string;
  semester?: 'First' | 'Second' | 'First Semester' | 'Second Semester' | string;
  session?: string;
  topicId?: string;
  topicName?: string;
  difficulty: DifficultyLevel;
  questionType?: QuestionType;
  source: QuestionSource;
  status: QuestionStatus;
  createdDate: string;
  updatedDate: string;
  createdBy?: string;
  lastModifiedBy?: string;
  versionNumber?: number;
  versionHistory?: QuestionVersion[];
  qualityScore?: string;
  issuesDetected?: string;
  isWarning?: boolean;
  suggestedFix?: string;
  suggestedVersion?: {
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: string;
    explanation: string;
    issuesDetected?: string;
  };
  timesAnswered?: number;
  timesFailed?: number;
  averageSuccessRate?: number;
  diagramUrl?: string;
}

export interface StudyMaterial {
  id: string;
  title: string;
  universityId: string;
  universityName?: string;
  facultyId?: string;
  departmentId?: string;
  level?: string;
  semester?: string;
  courseId: string;
  courseCode?: string;
  courseTitle?: string;
  type: 'PDF' | 'DOCX' | 'PPTX' | 'Image' | 'Video Link' | 'Lecture Notes' | 'Text Document';
  accessLevel: 'Free Trial' | 'Premium Only';
  fileSize?: string;
  fileSizeBytes?: number;
  totalDownloads: number;
  uploadedBy: string;
  uploadDate: string;
  status: 'Active' | 'Archived';
  fileUrl?: string;
  videoUrl?: string;
  description?: string;
  pagesCount?: number;
  thumbnailUrl?: string;
  topic?: string;
  tags?: string[];
  extractedTextPreview?: string;
}

export const SEED_STUDY_MATERIALS: StudyMaterial[] = [];

export interface TestSessionResult {
  id: string;
  type: 'practice' | 'mock_cbt';
  courseId: string;
  courseCode: string;
  courseTitle: string;
  universityName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeSpentSeconds: number;
  timeLimitMinutes?: number;
  date: string;
  userAnswers: Record<string, 'A' | 'B' | 'C' | 'D'>;
  markedForReview?: string[];
  questionIds: string[];
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency?: string;
  durationDays: number;
  description?: string;
  active: boolean;
  status?: 'Active' | 'Disabled' | 'Inactive' | string;
  features?: string[];
  popular?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentTransaction {
  id: string;
  paymentId?: string;
  userId: string;
  userName: string;
  userUsername?: string;
  userEmail: string;
  studentIdCode?: string;
  universityName?: string;
  departmentName?: string;
  courseName?: string;
  reference: string;
  gateway: 'Squad' | 'Squad Payment Gateway' | 'KoraPay' | 'KoraPay Gateway' | 'Paystack' | 'Flutterwave' | 'Bank Transfer' | 'Free Access' | string;
  amount: number;
  planName: string;
  planId?: string;
  durationDays?: number;
  date?: string;
  paymentDate?: string;
  expiryDate?: string;
  status: 'Successful' | 'Pending' | 'Failed' | 'Refunded';
  paymentMethod?: string;
  squadResponse?: any;
  proofUrl?: string;
  proofType?: 'JPG' | 'PNG' | 'JPEG' | 'PDF';
  handledByAdmin?: string;
  rejectionReason?: string;
  notes?: string;
  metadata?: Record<string, any> | any;
}

export interface LeaderboardStudentEntry {
  rank: number;
  previousRank: number;
  studentId: string;
  studentName: string;
  studentIdCode: string;
  photoUrl?: string;
  universityName: string;
  departmentName: string;
  courseCode: string;
  level: string;
  subscriptionStatus: 'Free Trial' | '14-Day Premium' | '30-Day Premium' | 'Expired' | string;
  totalScore: number;
  averageScore: number;
  totalAttempts: number;
  completionRate: number;
  lastCbtDate: string;
  badge: string;
  highestScore: number;
  correctAnswers: number;
  incorrectAnswers: number;
  totalStudyTimeMinutes: number;
  registeredDate: string;
  lastActive: string;
}

export interface RankingHistoryRecord {
  id: string;
  studentId: string;
  studentName: string;
  previousRank: number;
  newRank: number;
  dateChanged: string;
  reason: string;
  scoreUsed: number;
  category: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  userName?: string;
  title: string;
  message: string;
  type: 'payment' | 'subscription' | 'leaderboard' | 'system';
  date: string;
  read: boolean;
}

export interface AdminActivityLog {
  id: string;
  admin: string;
  action: string;
  module: string;
  details: string;
  time: string;
}

export interface SystemSettings {
  freeQuestionLimit: number;
  allowAiGeneration: boolean;
  maintenanceMode: boolean;
  paystackPublicKey: string;
  flutterwavePublicKey: string;
}

// Specific University Department Lists
export const FUL_DEPARTMENTS = [
  'Computer Science',
  'Cyber Security',
  'Software Engineering',
  'Information Technology',
  'Mathematics',
  'Statistics',
  'Physics',
  'Chemistry',
  'Biochemistry',
  'Biology',
  'Microbiology',
  'Geology',
  'Economics',
  'Accounting',
  'Business Administration',
  'Political Science',
  'Sociology',
  'English',
  'History and International Studies',
  'Library and Information Science',
  'Geography',
  'Agriculture',
  'Animal Science',
  'Crop Science',
  'Fisheries and Aquaculture',
  'Food Science and Technology',
];

export const FUAHSE_DEPARTMENTS = [
  'Medicine and Surgery',
  'Nursing Science',
  'Medical Laboratory Science',
  'Radiography',
  'Physiotherapy',
  'Human Anatomy',
  'Human Physiology',
  'Public Health',
  'Nutrition and Dietetics',
  'Dentistry',
  'Dental Therapy',
  'Dental Technology',
  'Prosthetics and Orthotics',
  'Biomedical Engineering',
  'Audiology',
  'Optometry',
  'Environmental Health Science',
  'Health Information Management',
];

export interface FacultyGroup {
  id: string;
  name: string;
  departments: string[];
}

export const DEFAULT_FACULTY_DEPARTMENTS: FacultyGroup[] = [
  {
    id: 'fac-1',
    name: '1. Faculty of Administration / Management Sciences',
    departments: [
      'Accounting / Accountancy',
      'Banking and Finance',
      'Business Administration / Management',
      'Public Administration',
      'Marketing',
      'Insurance and Actuarial Science',
      'Industrial Relations and Personnel Management (IRPM)',
      'Entrepreneurship',
      'Hospitality and Tourism Management',
    ],
  },
  {
    id: 'fac-2',
    name: '2. Faculty of Agriculture & Agricultural Sciences',
    departments: [
      'Agricultural Economics',
      'Agricultural Extension and Rural Development',
      'Animal Science / Animal Production',
      'Crop Science / Agronomy',
      'Soil Science and Land Management',
      'Fisheries and Aquaculture',
      'Forestry and Wildlife Management',
      'Food Science and Technology',
    ],
  },
  {
    id: 'fac-3',
    name: '3. Faculty of Arts & Humanities',
    departments: [
      'English Language and Literary Studies',
      'History and International Studies',
      'Linguistics and African / Foreign Languages (Igbo, Yoruba, Hausa, French, Arabic, etc.)',
      'Theatre, Film, and Performing Arts',
      'Philosophy',
      'Religious Studies (Christian Religious Studies, Islamic Studies)',
      'Music',
      'Archaeology and Heritage Studies',
      'Fine and Applied Arts',
    ],
  },
  {
    id: 'fac-4',
    name: '4. Faculty of Basic Medical / Medical Sciences',
    departments: [
      'Human Anatomy',
      'Human Physiology',
      'Medical Biochemistry',
      'Medical Laboratory Science (MLS)',
      'Nursing Science',
      'Radiography and Radiation Science',
      'Physiotherapy / Medical Rehabilitation',
    ],
  },
  {
    id: 'fac-5',
    name: '5. Faculty of Clinical Sciences / Medicine',
    departments: [
      'Medicine and Surgery (MBBS)',
      'Anesthesia',
      'Community Health / Public Health Medicine',
      'Obstetrics and Gynecology',
      'Pediatrics',
      'Surgery',
      'Internal Medicine',
      'Pathology / Hematology',
    ],
  },
  {
    id: 'fac-6',
    name: '6. Faculty of Computing & Information Technology',
    departments: [
      'Computer Science',
      'Cybersecurity',
      'Software Engineering',
      'Information Technology (IT)',
      'Data Science',
      'Information Systems',
      'Artificial Intelligence',
    ],
  },
  {
    id: 'fac-7',
    name: '7. Faculty of Dentistry',
    departments: [
      'Oral and Maxillofacial Surgery',
      'Preventive and Community Dentistry',
      'Restorative Dentistry',
      'Child Dental Health',
    ],
  },
  {
    id: 'fac-8',
    name: '8. Faculty of Education',
    departments: [
      'Educational Foundations',
      'Educational Management / Administration',
      'Guidance and Counseling',
      'Adult and Non-Formal Education',
      'Science Education (Biology, Chemistry, Physics, Mathematics Education)',
      'Arts Education (English, History, Religious Education)',
      'Social Science Education (Economics, Geography Education)',
      'Vocational and Technical Education',
      'Library and Information Science (LIS)',
      'Human Kinetics and Health Education',
    ],
  },
  {
    id: 'fac-9',
    name: '9. Faculty of Engineering & Technology',
    departments: [
      'Agricultural and Bio-resources Engineering',
      'Chemical Engineering',
      'Civil Engineering',
      'Computer Engineering',
      'Electrical and Electronics Engineering',
      'Mechanical Engineering',
      'Petroleum and Gas Engineering',
      'Mechatronics Engineering',
      'Metallurgical and Materials Engineering',
      'Marine Engineering',
      'Systems Engineering',
    ],
  },
  {
    id: 'fac-10',
    name: '10. Faculty of Environmental Sciences / Design',
    departments: [
      'Architecture',
      'Building Technology',
      'Estate Management',
      'Quantity Surveying',
      'Urban and Regional Planning (URP)',
      'Surveying and Geo-informatics',
      'Fine Arts / Industrial Design',
    ],
  },
  {
    id: 'fac-11',
    name: '11. Faculty of Law',
    departments: [
      'Jurisprudence and International Law',
      'Commercial and Industrial Law',
      'Private and Property Law',
      'Public Law',
      'Islamic Law / Sharia (in select institutions)',
    ],
  },
  {
    id: 'fac-12',
    name: '12. Faculty of Communication & Media Studies',
    departments: [
      'Mass Communication',
      'Journalism and Media Studies',
      'Public Relations and Advertising',
      'Broadcasting (Radio, TV, Film)',
      'Development Communication',
    ],
  },
  {
    id: 'fac-13',
    name: '13. Faculty of Pharmaceutical Sciences',
    departments: [
      'Clinical Pharmacy and Pharmacy Management',
      'Pharmaceutical Chemistry',
      'Pharmaceutics and Pharmaceutical Technology',
      'Pharmacognosy and Environmental Medicine',
      'Pharmacology and Toxicology',
      'Pharmaceutical Microbiology and Biotechnology',
    ],
  },
  {
    id: 'fac-14',
    name: '14. Faculty of Physical Sciences',
    departments: [
      'Pure and Applied Chemistry',
      'Physics and Astronomy',
      'Mathematics',
      'Statistics',
      'Geology / Geophysics',
      'Industrial Chemistry',
    ],
  },
  {
    id: 'fac-15',
    name: '15. Faculty of Life / Biological Sciences',
    departments: [
      'Biochemistry',
      'Microbiology',
      'Plant Science and Biotechnology (Botany)',
      'Zoology and Environmental Biology',
      'Cell Biology and Genetics',
    ],
  },
  {
    id: 'fac-16',
    name: '16. Faculty of Social Sciences',
    departments: [
      'Economics',
      'Political Science',
      'Sociology and Anthropology',
      'Psychology',
      'Geography and Environmental Management',
      "Mass Communication (in schools where it's under Social Sciences)",
      'Social Work',
      'Criminology and Security Studies',
      'Demography and Social Statistics',
    ],
  },
  {
    id: 'fac-17',
    name: '17. Faculty of Veterinary Medicine',
    departments: [
      'Veterinary Anatomy',
      'Veterinary Physiology and Pharmacology',
      'Veterinary Pathology',
      'Veterinary Microbiology and Parasitology',
      'Veterinary Medicine',
      'Veterinary Surgery and Radiology',
      'Veterinary Public Health and Preventive Medicine',
    ],
  },
];

export const COMMON_UNIVERSITY_DEPARTMENTS = [
  'Accounting',
  'Actuarial Science',
  'Agriculture & Agricultural Economics',
  'Animal Science',
  'Architecture',
  'Banking and Finance',
  'Biochemistry',
  'Biological Sciences',
  'Biomedical Engineering',
  'Building & Quantity Surveying',
  'Business Administration',
  'Chemical Engineering',
  'Chemistry',
  'Civil Engineering',
  'Computer Engineering',
  'Computer Science',
  'Crop Science',
  'Cyber Security',
  'Dentistry & Dental Technology',
  'Economics',
  'Educational Management',
  'Electrical & Electronics Engineering',
  'English & Literary Studies',
  'Environmental Health Science',
  'Estate Management',
  'Fisheries and Aquaculture',
  'Food Science and Technology',
  'General Studies (GST)',
  'Geography & Environmental Management',
  'Geology & Geophysics',
  'Health Information Management',
  'History and International Studies',
  'Human Anatomy',
  'Human Physiology',
  'Industrial Chemistry',
  'Information Technology',
  'Law (LL.B)',
  'Library and Information Science',
  'Mass Communication & Media Studies',
  'Mathematics',
  'Mechanical Engineering',
  'Mechatronics Engineering',
  'Medical Laboratory Science',
  'Medicine and Surgery (MBBS)',
  'Microbiology',
  'Mining Engineering',
  'Nursing Science',
  'Optometry',
  'Petroleum Engineering',
  'Pharmacy (Pharm D / B.Pharm)',
  'Physics & Electronics',
  'Physiotherapy',
  'Political Science & Public Administration',
  'Public Health',
  'Radiography & Radiation Science',
  'Sociology & Criminology',
  'Software Engineering',
  'Statistics',
  'Surveying and Geo-informatics',
  'Urban and Regional Planning',
];

// Initial Seed Data (Empty defaults - Supabase database is single source of truth)
export const SEED_UNIVERSITIES: University[] = [];

export const SEED_FACULTIES: Faculty[] = [];

export const SEED_DEPARTMENTS: Department[] = [];

export const SEED_COURSES: Course[] = [];

export const SEED_TOPICS: Topic[] = [];

export const SEED_QUESTIONS: Question[] = [];

export const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan-1d',
    name: '1-Day Starter Pass',
    price: 150,
    currency: 'NGN',
    durationDays: 1,
    description: '1-Day Starter Pass',
    active: true,
    features: [
      '1-Day full CBT practice access',
      'Unlimited practice questions & explanations',
      'Instant AI CBT simulation',
    ],
  },
  {
    id: 'plan-10d',
    name: '10-Day Intensive Pass',
    price: 500,
    currency: 'NGN',
    durationDays: 10,
    description: '10-Day Intensive Pass',
    active: true,
    features: [
      '10-Day unlimited practice questions',
      'Unlimited CBT simulations',
      'Diagnostic AI feedback & solutions',
    ],
  },
  {
    id: 'plan-14d',
    name: '14-Day Premium Access',
    price: 800,
    currency: 'NGN',
    durationDays: 14,
    description: '14-Day Premium Access',
    active: true,
    features: [
      '14-Day unlimited practice questions',
      'Unlimited CBT simulations',
      'Extracted study questions',
      'Detailed AI explanations',
      'Performance analytics',
    ],
  },
  {
    id: 'plan-30d',
    name: '30-Day Full Access',
    price: 1500,
    currency: 'NGN',
    durationDays: 30,
    description: '30-Day Full Access',
    active: true,
    popular: true,
    features: [
      '30-Day full CBT & AI access',
      'SMART Diagnostic Analysis',
      'Downloadable PDF summaries',
      'Priority academic support',
    ],
  },
  {
    id: 'plan-90d',
    name: '90-Day Semester Pass',
    price: 3500,
    currency: 'NGN',
    durationDays: 90,
    description: '90-Day Semester Pass',
    active: true,
    features: [
      '90-Day complete semester CBT access',
      'Full question bank & mock exams',
      'MenCore Smart tutor & step-by-step solutions',
      'Comprehensive performance analytics',
    ],
  },
];

export type NotificationType =
  | 'Announcement'
  | 'Information'
  | 'Reminder'
  | 'Warning'
  | 'Maintenance'
  | 'Subscription'
  | 'Payment'
  | 'CBT Updates'
  | 'System Updates'
  | 'Emergency';

export type RecipientGroup =
  | 'All Students'
  | 'All Premium Students'
  | 'All Free Trial Students'
  | 'Students of a Selected University'
  | 'Students of a Selected Course'
  | 'Students of a Selected Level'
  | 'Individual Student(s)'
  | 'Suspended Students'
  | 'Administrators';

export type NotificationDeliveryStatus = 'Sent' | 'Scheduled' | 'Draft' | 'Delivered' | 'Failed';
export type NotificationPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface NotificationAttachment {
  name: string;
  type: 'PDF' | 'Image' | 'Video Link' | 'Study Material' | 'External Link';
  url: string;
  fileSize?: string;
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  recipientGroup: RecipientGroup;
  universityId?: string;
  universityName?: string;
  courseId?: string;
  courseCode?: string;
  targetStudentIds?: string[];
  priority: NotificationPriority;
  status: NotificationDeliveryStatus;
  totalRecipients: number;
  totalDelivered: number;
  totalRead: number;
  failedCount: number;
  failedDevices?: number;
  createdDate: string;
  scheduledDate?: string;
  sentDate?: string;
  sentBy: string;
  attachments?: NotificationAttachment[];
  openedCount?: number;
  isSystemGenerated?: boolean;
}

export type ReportCategory =
  | 'Student Reports'
  | 'CBT Reports'
  | 'Question Reports'
  | 'University Reports'
  | 'Course Reports'
  | 'Revenue Reports'
  | 'Subscription Reports'
  | 'System Reports';

export type ReportFormat = 'PDF' | 'Excel' | 'CSV';

export interface ReportRecord {
  id: string;
  title: string;
  category: ReportCategory;
  universityId?: string;
  universityName?: string;
  courseId?: string;
  courseCode?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  generatedBy: string;
  generatedDate: string;
  status: 'Completed' | 'Generating' | 'Failed' | 'Scheduled';
  format: ReportFormat;
  totalRecords: number;
  summaryText: string;
  keyInsights: string[];
  scheduleFrequency?: 'Daily' | 'Weekly' | 'Monthly' | 'Annual' | 'None';
  dataPayload?: any;
}

// Full Activity Logs Data Model
export type ActivityLogCategory =
  | 'Student Activity'
  | 'Administrator Activity'
  | 'Payment Activity'
  | 'Question Activity'
  | 'System Activity'
  | 'Security Alert';

export type ActivityLogStatus = 'Success' | 'Failed' | 'Warning';
export type ActivityLogUserRole = 'Student' | 'Administrator' | 'System';

export interface FullActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: ActivityLogUserRole;
  userEmail?: string;
  category: ActivityLogCategory;
  action: string;
  module: string;
  details: string;
  timestamp: string;
  ipAddress: string;
  device?: string;
  browser?: string;
  operatingSystem?: string;
  status: ActivityLogStatus;
  isArchived?: boolean;
  isSecurityAlert?: boolean;
  metadata?: Record<string, any>;
}

export interface ActiveUserSession {
  sessionId: string;
  userId: string;
  userName: string;
  userRole: ActivityLogUserRole;
  email: string;
  ipAddress: string;
  device: string;
  browser: string;
  operatingSystem: string;
  loginTime: string;
  lastActivityTime: string;
  status: 'Active' | 'Idle' | 'Terminated';
  location?: string;
}

// Support Tickets & Feedback Data Model
export type SupportTicketCategory =
  | 'Account & Login'
  | 'Payment & Subscription'
  | 'CBT & Examination'
  | 'Question Error / Report'
  | 'Technical / App Bug'
  | 'Feature Request'
  | 'General Inquiry';

export type SupportTicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type SupportTicketStatus = 'Open' | 'In Progress' | 'Pending Student' | 'Resolved' | 'Closed';

export interface TicketAttachment {
  name: string;
  url: string;
  size?: string;
  type?: string;
}

export interface TicketMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'Student' | 'Administrator' | 'Support Agent' | 'System';
  messageText: string;
  timestamp: string;
  isInternalNote?: boolean;
  attachments?: TicketAttachment[];
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  universityName?: string;
  departmentName?: string;
  courseCode?: string;
  questionId?: string;
  title: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  assignedAdmin?: string;
  createdDate: string;
  lastUpdated: string;
  description: string;
  messages: TicketMessage[];
  attachments?: TicketAttachment[];
  deviceInfo?: string;
  browser?: string;
  operatingSystem?: string;
  isBugReport?: boolean;
  isQuestionReport?: boolean;
  satisfactionRating?: number;
  feedbackComments?: string;
}

// ==========================================
// Backup & Restore Module Types
// ==========================================

export type BackupType = 'Automatic' | 'Manual';
export type BackupStatus = 'Success' | 'In Progress' | 'Failed' | 'Restored';
export type VerificationStatus = 'Verified' | 'Unverified' | 'Corrupted' | 'Pending';

export interface BackupRecord {
  id: string;
  name: string;
  type: BackupType;
  size: string; // e.g. "24.5 MB"
  sizeBytes: number;
  createdDate: string;
  createdBy: string;
  status: BackupStatus;
  location: string; // e.g. "Cloud Firestore Bucket (eu-west2)"
  verificationStatus: VerificationStatus;
  durationSeconds: number;
  scope: string[]; // ['Complete System Backup'] or specific entities
  healthScore: number;
  dataPayload?: Record<string, any>;
  notes?: string;
}

export interface AutoBackupConfig {
  enabled: boolean;
  schedule: 'Hourly' | 'Daily' | 'Weekly' | 'Monthly';
  backupTime: string; // e.g. "02:00 AM"
  retentionCount: number;
  selectedScopes: string[];
}

export interface RestoreLog {
  id: string;
  backupId: string;
  backupName: string;
  restoredBy: string;
  timestamp: string;
  status: 'Completed' | 'In Progress' | 'Failed';
  details: string;
  scopeRestored: string[];
}

// ==========================================
// Settings & System Configuration Module Types
// ==========================================

export interface SystemGeneralSettings {
  platformName: string;
  logoUrl: string;
  faviconUrl: string;
  description: string;
  contactEmail: string;
  supportPhone: string;
  officialWebsite: string;
  copyrightText: string;
  defaultLanguage: string;
  defaultTimeZone: string;
  dateTimeFormat: string;
}

export interface AuthenticationSettings {
  emailAuthEnabled: boolean;
  googleSignInEnabled: boolean;
  minPasswordLength: number;
  requirePasswordNumber: boolean;
  requirePasswordSpecialChar: boolean;
  sessionTimeoutMinutes: number;
  loginAttemptLimit: number;
  lockoutDurationMinutes: number;
  rememberMeOption: boolean;
  twoFactorEnabled: boolean;
}

export interface StudentRegistrationSettings {
  registrationEnabled: boolean;
  requireEmailVerification: boolean;
  requirePhoneVerification: boolean;
  defaultFreeTrialDurationDays: number;
  maxFreeTrialAttempts: number;
  defaultStudentStatus: 'Active' | 'Pending Approval';
  autoAssignStudentId: boolean;
}

export interface CbtExamSettings {
  defaultCbtTimeMinutes: number;
  passingScorePercentage: number;
  randomizeQuestions: boolean;
  randomizeAnswerOptions: boolean;
  showResultImmediately: boolean;
  hideCorrectAnswersUntilCompletion: boolean;
  allowQuestionReview: boolean;
  autoSubmitWhenTimeEnds: boolean;
  maxCbtAttempts: number;
  negativeMarkingEnabled: boolean;
  negativeMarkingDeductionPct: number;
}

export interface SubscriptionSettingsConfig {
  freeTrialQuestionLimit: number;
  enableUnlimitedQuestions: boolean;
  allowUnlimitedForPremiumOnly: boolean;
  warningThreshold: number;
  freeTrialEnabled: boolean;
  premiumQuestionAccess: string;
  subscriptionDurationDays: number;
  subscriptionPriceNGN: number;
  subscriptionBenefits: string[];
  trialExpirationMessage: string;
  upgradePageTitle: string;
  upgradePageContent: string;
  paymentActivationEnabled: boolean;
  gracePeriodDays: number;
  autoExpirationEnabled: boolean;
  renewalReminderDays: number;
}

export interface NotificationSettingsConfig {
  pushNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  maintenanceAlertsEnabled: boolean;
  paymentNotificationsEnabled: boolean;
  cbtRemindersEnabled: boolean;
  subscriptionExpiryRemindersEnabled: boolean;
}

export interface SystemSecuritySettings {
  passwordPolicyStrictness: 'Basic' | 'Moderate' | 'Strict' | 'Enterprise';
  sessionExpirationMinutes: number;
  deviceLoginLimit: number;
  ipRestrictionsEnabled: boolean;
  allowedIps: string[];
  auditLoggingEnabled: boolean;
  securityAlertsEnabled: boolean;
}

export interface MaintenanceModeConfig {
  enabled: boolean;
  message: string;
  startTime: string;
  endTime: string;
  allowAdminsThrough: boolean;
}

export interface SystemIntegrationStatus {
  id: string;
  name: string;
  serviceKey: string;
  status: 'Connected' | 'Disconnected' | 'Error';
  lastTested: string;
  details: string;
}

export interface AdminRolePermission {
  roleId: string;
  roleName: string;
  description: string;
  userCount: number;
  permissions: string[];
  isCustom?: boolean;
}

export type { AdminRole, AdminPermission, AdminAccount, PermissionDefinition } from './utils/rbac';

export interface SystemHealthMetrics {
  cpuUsagePct: number;
  memoryUsagePct: number;
  dbPerformanceMs: number;
  storageUsageMb: number;
  activeUsersCount: number;
  networkStatus: 'Optimal' | 'Degraded' | 'Offline';
  errorRatePct: number;
  responseTimeMs: number;
  lastUpdated: string;
}

export interface SystemSettingsPayload {
  general: SystemGeneralSettings;
  auth: AuthenticationSettings;
  registration: StudentRegistrationSettings;
  cbt: CbtExamSettings;
  subscription: SubscriptionSettingsConfig;
  notifications: NotificationSettingsConfig;
  security: SystemSecuritySettings;
  maintenance: MaintenanceModeConfig;
  integrations: SystemIntegrationStatus[];
  roles: AdminRolePermission[];
}

// Learning Community Models
export interface TopicRequest {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  universityId: string;
  universityName: string;
  level: string;
  semester: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  topicTitle: string;
  challengeDescription: string;
  status: 'Pending' | 'In Review' | 'Tutorial Planned' | 'Completed';
  createdAt: string;
  requestCount?: number;
}

export interface TopicCollectionConfig {
  isOpen: boolean;
  closedMessage: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TutorialVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  universityId: string;
  universityName: string;
  level: string;
  semester: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  topic: string;
  durationMinutes: number;
  keyLearningPoints: string[];
  viewsCount: number;
  likesCount?: number;
  likedBy?: string[];
  savedBy?: string[];
  isFeatured: boolean;
  approvalStatus?: 'Draft' | 'Approved' | 'Rejected' | 'Archived';
  visibility?: 'visible' | 'hidden';
  createdAt: string;
  createdByName: string;
}

export interface CommunityDiscussionPost {
  id: string;
  authorId: string;
  authorName: string;
  authorUniversity: string;
  authorLevel: string;
  courseCode: string;
  courseTitle: string;
  topic: string;
  title: string;
  content: string;
  upvotes: number;
  upvotedBy: string[];
  repliesCount: number;
  isReported: boolean;
  reportReason?: string;
  reportedBy?: string;
  createdAt: string;
  status: 'Active' | 'Hidden' | 'Reviewed' | 'Draft' | 'Approved' | 'Rejected' | 'Archived';
  approvalStatus?: 'Draft' | 'Approved' | 'Rejected' | 'Archived';
  visibility?: 'visible' | 'hidden';
}

export interface CommunityReply {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorRole: 'student' | 'admin';
  content: string;
  createdAt: string;
}

export interface LearningResourceItem {
  id: string;
  title: string;
  description: string;
  resourceType: 'PDF Summary' | 'Formula Sheet' | 'Revision Outline' | 'Diagram' | 'Past Q&A Note';
  fileUrl: string;
  fileSize: string;
  universityName: string;
  courseCode: string;
  level: string;
  approvalStatus?: 'Draft' | 'Approved' | 'Rejected' | 'Archived';
  visibility?: 'visible' | 'hidden';
  createdAt: string;
}

export interface CommunityAnnouncement {
  id: string;
  title: string;
  content: string;
  category: 'New Tutorial' | 'Academic Update' | 'CBT Notice' | 'Weekly Tip';
  authorName: string;
  youtubeLink?: string;
  createdAt: string;
  isPinned: boolean;
  approvalStatus?: 'Draft' | 'Approved' | 'Rejected' | 'Archived';
  visibility?: 'visible' | 'hidden';
}

// ==========================================
// MENCORE AI ASSISTANT SPECIFICATION (POWERED BY MENMEX)
// ==========================================

export interface MenCorePermissions {
  websiteFeatures: boolean;
  platformNavigation: boolean;
  premiumPlans: boolean;
  payments: boolean;
  notifications: boolean;
  accountRecovery: boolean;
  studyMaterials: boolean;
  community: boolean;
  analytics: boolean;
  academicQuestions: boolean;
  courseQuestions: boolean;
  universityQuestions: boolean;
  cbtQuestions: boolean;
  generalAI: boolean;
}

export interface MenCoreNavigationTarget {
  label: string; // e.g. "Open Subscription Page"
  view: string;  // e.g. "dashboard", "study-materials", "community", "leaderboard", "practice"
  tab?: string;  // e.g. "subscription", "profile"
}

export interface MenCoreKnowledgeItem {
  id: string;
  title: string;
  category: 'CBT & Practice' | 'Subscriptions & Payments' | 'Account & Profile' | 'Platform Features' | 'Study Tools & Community' | 'General';
  keywords: string[];
  answer: string;
  navigationTarget?: MenCoreNavigationTarget;
  isPinned: boolean;
  scheduledDate?: string;
  updatedAt: string;
}

export interface MenCoreConversationLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: 'student' | 'admin';
  question: string;
  answer: string;
  questionType: 'platform' | 'navigation' | 'subscription' | 'academic' | 'restricted' | 'other';
  wasHelpful?: boolean;
  starRating?: number; // 1 to 5 ⭐⭐⭐⭐⭐
  createdAt: string;
  unanswered: boolean; // For Smart Suggestions
}

export interface MenCoreAnnouncementItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  isActive: boolean;
  badgeCount: number;
}

export interface MenCoreSettings {
  isEnabled: boolean;
  showOnAuthPages: boolean;
  maintenanceMode: boolean;
  onlineStatus: 'online' | 'offline' | 'busy';
  name: string;
  subtitle: string;
  tagline: string;
  welcomeMessage: string;
  typingSpeed: number;
  responseSpeed: 'instant' | 'fast' | 'natural';
  maxConversationLength: number;
  avatarUrl: string;
  themeColor: 'indigo' | 'emerald' | 'violet' | 'amber' | 'blue';
  glowingAnimation: boolean;
  restrictedReplyMessage: string;
  permissions: any;
}

export interface FaceArenaSettings {
  status: 'open' | 'closed' | 'locked';
  weeklyChallengeId: string;
  weeklyTitle: string;
  description?: string;
  bannerUrl?: string;
  startDate?: string;
  endDate?: string;
  isPublished?: boolean;
  timerDurationSeconds: number;
  totalQuestionsCount: number;
  passingScorePercentage: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  allowPreviousQuestion: boolean;
  autoSubmitOnTimeout: boolean;
  showResultsImmediately: boolean;
  externalTestUrl?: string;
  externalButtonText?: string;
  testMode?: 'in_app' | 'external_link' | 'both';
  createdAt: string;
  updatedAt: string;
}

export interface FaceArenaQuestion {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  category?: string;
}

export interface FaceArenaParticipant {
  id: string;
  weeklyChallengeId: string;
  userId: string;
  fullName: string;
  whatsAppNumber: string;
  date: string;
  timeStarted: string;
  timeSubmitted: string | null;
  timeUsedSeconds: number;
  questionsAttempted: number;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  score: number;
  percentage: number;
  position?: number;
  passed: boolean;
  answers: Record<number, 'A' | 'B' | 'C' | 'D'>;
  status: 'registered' | 'in_progress' | 'completed';
}

export interface FaceArenaArchive {
  id: string;
  weeklyChallengeId: string;
  weeklyTitle: string;
  archivedAt: string;
  totalParticipants: number;
  highestScore: number;
  lowestScore: number;
  averageScore: number;
  numberPassed: number;
  numberFailed: number;
  participants: FaceArenaParticipant[];
  settings: FaceArenaSettings;
}

// Dynamic Interface Editor Types
export interface QuickLinkItem {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  url: string;
  status: 'active' | 'inactive';
  approvalStatus?: 'Draft' | 'Approved' | 'Rejected' | 'Archived';
  visibility?: 'visible' | 'hidden';
  order: number;
  badge?: string;
  target?: '_blank' | '_self';
  createdAt?: string;
  updatedAt?: string;
}

export type HomepageSectionType =
  | 'announcement'
  | 'quick_links'
  | 'featured_content'
  | 'latest_updates'
  | 'ad_banner'
  | 'custom_section';

export interface HomepageSection {
  id: string;
  type: HomepageSectionType;
  title: string;
  subtitle?: string;
  description?: string;
  buttonText?: string;
  buttonLink?: string;
  imageUrl?: string;
  bgImage?: string;
  bgColor?: string;
  textColor?: string;
  status: 'active' | 'inactive';
  order: number;
  badge?: string;
  createdAt?: string;
  updatedAt?: string;
}

