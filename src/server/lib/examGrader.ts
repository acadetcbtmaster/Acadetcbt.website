export type OptionLetter = 'A' | 'B' | 'C' | 'D';

export interface GradableQuestionItem {
  sessionQuestionId: string;
  questionOrder: number;
  selectedOption: OptionLetter | null;
  correctOption: OptionLetter;
}

export interface GradedQuestionOutcome {
  sessionQuestionId: string;
  questionOrder: number;
  selectedOption: OptionLetter | null;
  correctOption: OptionLetter;
  isCorrect: boolean;
}

export interface ExamScoreSummary {
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  scorePercentage: number;
  outcomes: GradedQuestionOutcome[];
}

export function gradeExamAnswers(items: GradableQuestionItem[]): ExamScoreSummary {
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  const outcomes: GradedQuestionOutcome[] = items.map((item) => {
    if (!item.selectedOption) {
      unansweredCount += 1;
      return {
        sessionQuestionId: item.sessionQuestionId,
        questionOrder: item.questionOrder,
        selectedOption: null,
        correctOption: item.correctOption,
        isCorrect: false,
      };
    }

    const isCorrect = item.selectedOption === item.correctOption;
    if (isCorrect) {
      correctCount += 1;
    } else {
      wrongCount += 1;
    }

    return {
      sessionQuestionId: item.sessionQuestionId,
      questionOrder: item.questionOrder,
      selectedOption: item.selectedOption,
      correctOption: item.correctOption,
      isCorrect,
    };
  });

  const totalQuestions = items.length;
  const scorePercentage =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  return {
    totalQuestions,
    correctCount,
    wrongCount,
    unansweredCount,
    scorePercentage,
    outcomes,
  };
}
