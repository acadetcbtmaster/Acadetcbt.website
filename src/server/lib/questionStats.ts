export type NormalizedDifficultyBucket = 'Easy' | 'Medium' | 'Hard' | 'Uncategorized';

export const CBT_RECOMMENDED_MIN_QUESTIONS = 20;

export function normalizeQuestionDifficulty(
  rawDifficulty: string | null | undefined
): NormalizedDifficultyBucket {
  const normalized = (rawDifficulty || '').trim().toLowerCase();
  if (normalized === 'easy') return 'Easy';
  if (normalized === 'medium') return 'Medium';
  if (normalized === 'hard' || normalized === 'difficult') return 'Hard';
  return 'Uncategorized';
}

export function getCourseCbtReadiness(activeQuestionCount: number): {
  ready: boolean;
  status: 'ready' | 'low' | 'empty';
  label: string;
} {
  if (activeQuestionCount <= 0) {
    return { ready: false, status: 'empty', label: 'No Questions' };
  }
  if (activeQuestionCount < CBT_RECOMMENDED_MIN_QUESTIONS) {
    return {
      ready: false,
      status: 'low',
      label: `Low Bank (< ${CBT_RECOMMENDED_MIN_QUESTIONS})`,
    };
  }
  return { ready: true, status: 'ready', label: 'CBT Ready' };
}

export interface DifficultyCountsInput {
  questionCount: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  uncategorizedCount?: number;
}

export function isQuestionBreakdownReconciled(counts: DifficultyCountsInput): boolean {
  const uncategorized = counts.uncategorizedCount ?? 0;
  return (
    counts.questionCount ===
    counts.easyCount + counts.mediumCount + counts.hardCount + uncategorized
  );
}
