export type UserRole = 'student' | 'admin' | 'super_admin';
export type DifficultyLevel = 'All Levels' | 'Easy' | 'Medium' | 'Hard';
export type QuestionDifficulty = 'Easy' | 'Medium' | 'Hard';
export type OptionLetter = 'A' | 'B' | 'C' | 'D';
export type MaterialCategory = 'Tutorials' | 'Notes' | 'Past Questions' | 'Guides';

export interface UserPreferences {
  theme: 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
  soundNotifications: boolean;
  autoNextQuestion: boolean;
  showQuestionPalette: boolean;
  defaultSubjectId: string | null;
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

export interface SubjectSummary {
  id: string;
  slug: string;
  name: string;
  code: string;
  examCategory: string;
  description: string;
  defaultDurationMinutes: number;
  questionCount: number;
  courseCount: number;
}

export interface CourseSummary {
  id: string;
  subjectId: string;
  code: string;
  title: string;
  level: string;
  description: string;
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
    subjectId: string;
    subjectName: string;
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
  subjectId: string;
  subjectName: string;
  subjectCode: string;
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
    subjectName: string;
    scorePercentage: number;
    submittedAt: string | null;
  }>;
  history: Array<{
    id: string;
    subjectId: string;
    subjectName: string;
    subjectCode: string;
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
  subjectId: string | null;
  subjectName: string | null;
  title: string;
  description: string;
  category: MaterialCategory;
  fileType: 'PDF' | 'DOC' | 'IMAGE' | 'OTHER';
  fileSizeBytes: number;
  mimeType: string;
  downloadCount: number;
  createdAt: string;
}

export interface AdminOverview {
  totalUsers: number;
  totalSubjects: number;
  totalQuestions: number;
  totalMaterials: number;
  totalSubmittedExams: number;
}

export interface AdminQuestionItem {
  id: string;
  subjectId: string;
  subjectName: string;
  courseId: string | null;
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
