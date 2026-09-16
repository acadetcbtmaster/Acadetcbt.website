import { sanitizeCircular, safeStringifyGlobal } from '../lib/safeJson';
import { PRE_JAMB_QUESTION_BANK, PreJambQuestionItem, JAMB_SUBJECTS, JambSubjectMeta } from '../data/jambQuestionsBank';
import { PreJambDatabaseService, PreJambQuestion, PreJambSubject, PreJambCandidate as DBCandidate, PreJambExamResult as DBResult } from './prejambDatabaseService';

// Safe serialization helpers
export function safeClone<T>(val: T): T {
  try {
    const sanitized = sanitizeCircular(val);
    return JSON.parse(JSON.stringify(sanitized));
  } catch {
    return val;
  }
}

export function safeStringify(val: any, indent?: number): string {
  return safeStringifyGlobal(val, indent);
}

export interface PreJambCandidate {
  id: string;
  regNumber: string;
  name: string;
  email: string;
  phone?: string;
  targetUniversity?: string;
  targetCourse?: string;
  utmeSubjects?: string[];
  subscriptionStatus?: 'active' | 'free' | 'expired';
  totalTestsTaken?: number;
  bestScore?: number;
  averageScore?: number;
  totalTimeSpentMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PreJambQuestionRecord {
  id: string;
  subjectId: string;
  subjectName: string;
  question: string;
  options: [string, string, string, string];
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  examYear?: number;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PreJambExamResultRecord {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateRegNumber: string;
  examTitle: string;
  isFullMock: boolean;
  subjectIds: string[];
  totalQuestions: number;
  totalScore: number;
  percentage: number;
  utmeAggregate: number;
  timeUsedSeconds: number;
  subjectScores: Record<string, { correct: number; total: number; percentage: number }>;
  answersBySubject: Record<string, Record<string, 'A' | 'B' | 'C' | 'D'>>;
  markedForReview?: Record<string, any>;
  completedAt: string;
}

export interface PreJambDatabaseStats {
  totalQuestions: number;
  totalCandidates: number;
  totalResults: number;
  totalMockExamsTaken: number;
  totalSubjects: number;
  averageScoreAggregate: number;
  highestAggregate: number;
  questionsPerSubject: Record<string, number>;
  latestSyncTimestamp: string;
}

/**
 * PreJambStorageService
 * Unified client storage bridge that proxies to PreJambDatabaseService
 * guaranteeing immediate synchronization between Admin uploads and all User accounts.
 */
export class PreJambStorageService {
  public static initDatabase(): void {
    PreJambDatabaseService.initDatabase();
  }

  public static getQuestions(filter?: string | { subjectId?: string; search?: string }): PreJambQuestionRecord[] {
    this.initDatabase();
    let filterObj: { subjectId?: string; search?: string } | undefined;
    if (typeof filter === 'string') {
      filterObj = filter && filter !== 'all' ? { subjectId: filter } : undefined;
    } else if (filter) {
      filterObj = filter;
    }
    const questions = PreJambDatabaseService.getPreJambQuestions(filterObj);
    return questions.map((q) => ({
      id: q.id,
      subjectId: q.subjectId,
      subjectName: q.subjectName,
      question: q.question,
      options: [q.options[0] || '', q.options[1] || '', q.options[2] || '', q.options[3] || ''] as [string, string, string, string],
      correctAnswer: q.correctAnswer as any,
      explanation: q.explanation || '',
      topic: q.topic,
      difficulty: q.difficulty as any,
      examYear: q.examYear,
      source: q.source,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    }));
  }

  public static getQuestionById(id: string): PreJambQuestionRecord | null {
    this.initDatabase();
    const q = PreJambDatabaseService.getPreJambQuestionById(id);
    if (!q) return null;
    return {
      id: q.id,
      subjectId: q.subjectId,
      subjectName: q.subjectName,
      question: q.question,
      options: [q.options[0] || '', q.options[1] || '', q.options[2] || '', q.options[3] || ''] as [string, string, string, string],
      correctAnswer: q.correctAnswer as any,
      explanation: q.explanation || '',
      topic: q.topic,
      difficulty: q.difficulty as any,
      examYear: q.examYear,
      source: q.source,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    };
  }

  public static saveQuestion(question: PreJambQuestionRecord): PreJambQuestionRecord {
    this.initDatabase();
    const saved = PreJambDatabaseService.savePreJambQuestion({
      id: question.id,
      subjectId: question.subjectId,
      subjectName: question.subjectName,
      question: question.question,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      topic: question.topic,
      difficulty: question.difficulty,
      examYear: question.examYear,
      source: question.source,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    });

    return {
      id: saved.id,
      subjectId: saved.subjectId,
      subjectName: saved.subjectName,
      question: saved.question,
      options: [saved.options[0] || '', saved.options[1] || '', saved.options[2] || '', saved.options[3] || ''],
      correctAnswer: saved.correctAnswer as any,
      explanation: saved.explanation || '',
      topic: saved.topic,
      difficulty: saved.difficulty as any,
      examYear: saved.examYear,
      source: saved.source,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  public static bulkSaveQuestions(questions: PreJambQuestionRecord[]): void {
    this.initDatabase();
    const dbQuestions: PreJambQuestion[] = questions.map((q) => ({
      id: q.id,
      subjectId: q.subjectId,
      subjectName: q.subjectName,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      topic: q.topic,
      difficulty: q.difficulty,
      examYear: q.examYear,
      source: q.source,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    }));
    PreJambDatabaseService.bulkSavePreJambQuestions(dbQuestions);
  }

  public static deleteQuestion(id: string): boolean {
    this.initDatabase();
    return PreJambDatabaseService.deletePreJambQuestion(id);
  }

  public static generateExamQuestionsForSubject(subjectId: string, count: number): PreJambQuestionItem[] {
    this.initDatabase();
    return PreJambDatabaseService.generateExamQuestionsForSubject(subjectId, count);
  }

  public static getCandidates(): PreJambCandidate[] {
    this.initDatabase();
    return PreJambDatabaseService.getPreJambCandidates() as any;
  }

  public static getCandidateById(id: string): PreJambCandidate | null {
    this.initDatabase();
    return PreJambDatabaseService.getPreJambCandidateById(id) as any;
  }

  public static findCandidateByRegOrEmail(queryStr: string): PreJambCandidate | null {
    this.initDatabase();
    return PreJambDatabaseService.findPreJambCandidateByRegOrEmail(queryStr) as any;
  }

  public static saveCandidate(candidate: PreJambCandidate): PreJambCandidate {
    this.initDatabase();
    return PreJambDatabaseService.savePreJambCandidate(candidate as any) as any;
  }

  public static deleteCandidate(id: string): boolean {
    this.initDatabase();
    return PreJambDatabaseService.deletePreJambCandidate(id);
  }

  public static getResults(candidateId?: string): PreJambExamResultRecord[] {
    this.initDatabase();
    return PreJambDatabaseService.getPreJambResults(candidateId) as any;
  }

  public static getResultById(id: string): PreJambExamResultRecord | null {
    this.initDatabase();
    const results = PreJambDatabaseService.getPreJambResults();
    return (results.find((r) => r.id === id) as any) || null;
  }

  public static saveResult(result: PreJambExamResultRecord): PreJambExamResultRecord {
    this.initDatabase();
    return PreJambDatabaseService.savePreJambResult(result as any) as any;
  }

  public static getDatabaseStats(): PreJambDatabaseStats {
    this.initDatabase();
    const stats = PreJambDatabaseService.getDatabaseStats();
    return {
      totalQuestions: stats.totalQuestions,
      totalCandidates: stats.totalCandidates,
      totalResults: stats.totalAttempts,
      totalMockExamsTaken: stats.totalAttempts,
      totalSubjects: stats.totalSubjects,
      averageScoreAggregate: stats.averageAggregate,
      highestAggregate: stats.highestAggregate,
      questionsPerSubject: stats.questionsPerSubject,
      latestSyncTimestamp: stats.lastSyncTime,
    };
  }

  public static getSubjects(): JambSubjectMeta[] {
    this.initDatabase();
    const dbSubjects = PreJambDatabaseService.getPreJambSubjects();
    if (dbSubjects && dbSubjects.length > 0) {
      const colors = ['emerald', 'indigo', 'blue', 'amber', 'rose', 'cyan', 'purple', 'teal'];
      return dbSubjects.map((s, idx) => ({
        id: s.id,
        name: s.name,
        code: s.code || s.id.substring(0, 3).toUpperCase(),
        questionCount: s.defaultQuestionCount || 40,
        timeMinutes: s.timeMinutes || 40,
        icon: s.icon || 'BookOpen',
        description: s.description || `Official JAMB Subject - ${s.name}`,
        color: colors[idx % colors.length] || 'indigo',
      }));
    }
    return JAMB_SUBJECTS;
  }

  public static getQuestionsCountBySubject(): Record<string, number> {
    this.initDatabase();
    const stats = PreJambDatabaseService.getDatabaseStats();
    return stats.questionsPerSubject;
  }

  public static exportDatabaseJson(): string {
    return this.exportFullDatabaseSnapshot();
  }

  public static exportFullDatabaseSnapshot(): string {
    this.initDatabase();
    return PreJambDatabaseService.exportFullDatabaseSnapshot();
  }

  public static importDatabaseJson(jsonString: string): { success: boolean; message: string; count?: number } {
    return this.importDatabaseSnapshot(jsonString);
  }

  public static importDatabaseSnapshot(jsonString: string): { success: boolean; message: string; count?: number } {
    this.initDatabase();
    return PreJambDatabaseService.importDatabaseSnapshot(jsonString);
  }

  public static resetDatabaseToDefaults(): void {
    this.resetToDefaultSeeds();
  }

  public static resetToDefaultSeeds(): void {
    PreJambDatabaseService.resetToDefaultSeeds();
  }
}
