import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Calculator,
  CheckCircle2,
  Grid,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type {
  ActiveExamQuestion,
  ActiveExamSession,
  GradedExamQuestion,
  OptionLetter,
} from '../../types/cbt';
import { AcadetCrest } from './AcadetLogo';
import { CalculatorModal } from './CalculatorModal';
import { QuestionImageGallery } from './QuestionImageGallery';

interface ExamHallProps {
  session: ActiveExamSession;
  initialQuestions: ActiveExamQuestion[];
  showQuestionPalette: boolean;
  soundNotifications: boolean;
  autoNextQuestion: boolean;
  remainingSeconds: number;
  endExamConfirmOpen: boolean;
  onCloseEndExamConfirm: () => void;
  onOpenEndExamConfirm: () => void;
  onExamSubmitted: (result: {
    session: ActiveExamSession;
    questions: GradedExamQuestion[];
  }) => void;
}

function playSoftClickTone() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 540;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch {
    // Ignore audio context blocks
  }
}

export const ExamHall: React.FC<ExamHallProps> = ({
  session,
  initialQuestions,
  showQuestionPalette,
  soundNotifications,
  autoNextQuestion,
  remainingSeconds,
  endExamConfirmOpen,
  onCloseEndExamConfirm,
  onOpenEndExamConfirm,
  onExamSubmitted,
}) => {
  const [questions, setQuestions] = useState<ActiveExamQuestion[]>(initialQuestions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setQuestions(initialQuestions);
    setCurrentIndex(0);
  }, [session.id, initialQuestions]);

  // Auto-submit when server timer reaches zero
  useEffect(() => {
    if (remainingSeconds <= 0 && !submitting) {
      void handleFinalSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds]);

  const currentQuestion = questions[currentIndex];
  const answeredCount = questions.filter((q) => q.selectedOption !== null).length;
  const markedCount = questions.filter((q) => q.isMarkedForReview).length;
  const unansweredCount = questions.length - answeredCount;

  const persistAnswer = async (
    order: number,
    selectedOption: OptionLetter | null,
    isMarkedForReview?: boolean
  ) => {
    const elapsed = Math.max(0, session.timeLimitSeconds - remainingSeconds);
    try {
      await api.exams.saveAnswer(session.id, {
        questionOrder: order,
        selectedOption,
        ...(isMarkedForReview !== undefined ? { isMarkedForReview } : {}),
        timeSpentSeconds: elapsed,
      });
    } catch {
      // Final batch on submit ensures authoritative sync if network hiccups
    }
  };

  const handleSelectOption = (letter: OptionLetter) => {
    if (!currentQuestion || submitting) return;
    if (soundNotifications) playSoftClickTone();

    const order = currentQuestion.order;
    setQuestions((prev) =>
      prev.map((q) => (q.order === order ? { ...q, selectedOption: letter } : q))
    );
    void persistAnswer(order, letter, currentQuestion.isMarkedForReview);

    if (autoNextQuestion && currentIndex < questions.length - 1) {
      window.setTimeout(() => {
        setCurrentIndex((idx) => Math.min(questions.length - 1, idx + 1));
      }, 240);
    }
  };

  const handleToggleMarkForReview = () => {
    if (!currentQuestion || submitting) return;
    const nextMarked = !currentQuestion.isMarkedForReview;
    const order = currentQuestion.order;
    setQuestions((prev) =>
      prev.map((q) => (q.order === order ? { ...q, isMarkedForReview: nextMarked } : q))
    );
    void persistAnswer(order, currentQuestion.selectedOption, nextMarked);
  };

  const handleFinalSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const elapsed = Math.max(0, session.timeLimitSeconds - remainingSeconds);
      const result = await api.exams.submit(session.id, {
        timeSpentSeconds: elapsed,
        answers: questions.map((q) => ({
          questionOrder: q.order,
          selectedOption: q.selectedOption,
          isMarkedForReview: q.isMarkedForReview,
        })),
      });
      onCloseEndExamConfirm();
      onExamSubmitted(result);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit exam.');
      setSubmitting(false);
    }
  };

  if (!currentQuestion) {
    return null;
  }

  const difficultyBadgeClass =
    currentQuestion.difficulty === 'Easy'
      ? 'bg-[#0a58ed] text-white'
      : currentQuestion.difficulty === 'Medium'
        ? 'bg-amber-500 text-white'
        : 'bg-rose-600 text-white';

  const options: Array<{ letter: OptionLetter; text: string }> = [
    { letter: 'A', text: currentQuestion.optionA },
    { letter: 'B', text: currentQuestion.optionB },
    { letter: 'C', text: currentQuestion.optionC },
    { letter: 'D', text: currentQuestion.optionD },
  ];

  const renderPaletteCard = (onPick?: () => void) => (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
      <div className="bg-[#0b337a] text-white px-4 py-3 font-extrabold text-sm">
        Question Palette
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-5 gap-2">
          {questions.map((q, idx) => {
            const isCurrent = idx === currentIndex;
            const isAnswered = q.selectedOption !== null;
            const isMarked = q.isMarkedForReview;

            let btnStyle =
              'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 hover:border-[#0a58ed]';
            if (isCurrent) {
              btnStyle = 'bg-[#0a58ed] text-white border border-[#0a58ed] shadow-sm';
            } else if (isMarked) {
              btnStyle = 'bg-[#9333ea] text-white border border-[#9333ea]';
            } else if (isAnswered) {
              btnStyle = 'bg-[#16a34a] text-white border border-[#16a34a]';
            }

            return (
              <button
                key={q.questionId}
                type="button"
                onClick={() => {
                  setCurrentIndex(idx);
                  onPick?.();
                }}
                className={`h-9 rounded-lg font-bold text-sm tabular-nums transition-all ${btnStyle}`}
              >
                {q.order}
              </button>
            );
          })}
        </div>

        {/* Color Legend matching Screenshot 3 & 5 */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-2.5">
            <span className="w-4 h-4 rounded bg-[#0a58ed] inline-block shrink-0" />
            <span>Current</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-4 h-4 rounded bg-[#16a34a] inline-block shrink-0" />
            <span>Answered</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-4 h-4 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 inline-block shrink-0" />
            <span>Not Answered</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-4 h-4 rounded bg-[#9333ea] inline-block shrink-0" />
            <span>Marked for Review</span>
          </div>
        </div>

        <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/80 border border-[#dce6f5] dark:border-slate-700 py-3 px-4 text-center">
          <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
            Total Questions
          </div>
          <div className="text-2xl font-extrabold text-[#0b337a] dark:text-blue-400 tabular-nums mt-0.5">
            {questions.length}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 gap-4">
      <div className="flex flex-col lg:flex-row gap-5 flex-1">
        {/* Desktop Left Question Palette */}
        {showQuestionPalette && (
          <aside className="hidden lg:block w-64 shrink-0">{renderPaletteCard()}</aside>
        )}

        {/* Main Question Area */}
        <section className="flex-1 flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-[#eff5ff]/75 dark:bg-slate-800/70 border-b border-[#dce6f5] dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <AcadetCrest className="w-7 h-7" frameOnDark={false} />
              <div className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white truncate">
                Question {currentQuestion.order} of {questions.length}
              </div>
            </div>
            <span
              className={`px-3.5 py-1 rounded-lg text-xs font-extrabold ${difficultyBadgeClass}`}
            >
              {currentQuestion.difficulty === 'Hard'
                ? 'Difficult'
                : currentQuestion.difficulty}
            </span>
          </div>

          <div className="p-5 sm:p-7 flex-1 flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div className="text-base sm:text-xl font-bold text-slate-900 dark:text-slate-100 leading-relaxed">
                {currentQuestion.questionText}
              </div>

              <QuestionImageGallery images={currentQuestion.images} />

              <div className="space-y-3">
                {options.map((opt) => {
                  const isSelected = currentQuestion.selectedOption === opt.letter;
                  return (
                    <button
                      key={opt.letter}
                      type="button"
                      onClick={() => handleSelectOption(opt.letter)}
                      className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all flex items-center gap-3.5 min-h-[52px] ${
                        isSelected
                          ? 'border-[#0a58ed] bg-[#eff5ff] dark:bg-blue-950/50 ring-2 ring-[#0a58ed]/30'
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#0a58ed]/60 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-[#0a58ed]'
                            : 'border-slate-400 dark:border-slate-500'
                        }`}
                      >
                        {isSelected && (
                          <span className="w-2.5 h-2.5 rounded-full bg-[#0a58ed]" />
                        )}
                      </span>
                      <span className="text-base font-extrabold text-slate-900 dark:text-white shrink-0">
                        {opt.letter}.
                      </span>
                      <span className="text-base font-medium text-slate-800 dark:text-slate-200">
                        {opt.text}
                      </span>
                    </button>
                  );
                })}
              </div>

              <label className="inline-flex items-center gap-2.5 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={currentQuestion.isMarkedForReview}
                  onChange={handleToggleMarkForReview}
                  className="w-5 h-5 rounded border-slate-300 text-[#9333ea] focus:ring-[#9333ea]"
                />
                <span className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">
                  Mark for Review
                </span>
              </label>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Controls Bar (Matching Screenshots 3 & 5) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <button
          type="button"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
          className="px-4 sm:px-5 py-2.5 min-h-[44px] rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-sm shadow-sm flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Previous</span>
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setMobilePaletteOpen(true)}
            className="lg:hidden px-3.5 py-2.5 min-h-[44px] rounded-xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold text-sm shadow-sm flex items-center gap-2"
          >
            <Grid className="w-4 h-4 text-[#0b337a] dark:text-blue-400" />
            <span>Questions</span>
          </button>

          <button
            type="button"
            onClick={() => setReviewModalOpen(true)}
            className="px-4 py-2.5 min-h-[44px] rounded-xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold text-sm shadow-sm flex items-center gap-2"
          >
            <Bookmark className="w-4 h-4 text-[#0b337a] dark:text-blue-400" />
            <span>Review</span>
          </button>

          <button
            type="button"
            onClick={() => setCalculatorOpen(true)}
            className="px-4 py-2.5 min-h-[44px] rounded-xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold text-sm shadow-sm flex items-center gap-2"
          >
            <Calculator className="w-4 h-4 text-[#0b337a] dark:text-blue-400" />
            <span className="hidden sm:inline">Calculator</span>
          </button>
        </div>

        {currentIndex < questions.length - 1 ? (
          <button
            type="button"
            onClick={() => setCurrentIndex((idx) => Math.min(questions.length - 1, idx + 1))}
            className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white font-bold text-sm shadow-sm flex items-center gap-2 transition-colors"
          >
            <span>Next</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenEndExamConfirm}
            className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-sm shadow-sm flex items-center gap-2 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Submit Exam</span>
          </button>
        )}
      </div>

      {/* Mobile Question Palette Sheet */}
      {mobilePaletteOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex items-end sm:items-center justify-center bg-slate-950/50 p-3">
          <div className="w-full max-w-md space-y-2">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setMobilePaletteOpen(false)}
                className="p-2 rounded-full bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderPaletteCard(() => setMobilePaletteOpen(false))}
          </div>
        </div>
      )}

      {/* Review Marked Questions Summary Modal */}
      {reviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="bg-[#0b337a] text-white px-5 py-3.5 flex items-center justify-between">
              <span className="font-extrabold text-sm">Question Review Overview</span>
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/15"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3">
                  <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {answeredCount}
                  </div>
                  <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                    Answered
                  </div>
                </div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-3">
                  <div className="text-lg font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">
                    {unansweredCount}
                  </div>
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Unanswered
                  </div>
                </div>
                <div className="rounded-xl bg-purple-50 dark:bg-purple-950/40 p-3">
                  <div className="text-lg font-extrabold text-purple-700 dark:text-purple-300 tabular-nums">
                    {markedCount}
                  </div>
                  <div className="text-xs font-semibold text-purple-800 dark:text-purple-200">
                    Marked
                  </div>
                </div>
              </div>

              {renderPaletteCard(() => setReviewModalOpen(false))}
            </div>
          </div>
        </div>
      )}

      {/* End Exam Confirmation Modal */}
      {endExamConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="bg-[#0b337a] text-white px-5 py-4 flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-300" />
              <h2 className="text-base font-extrabold">Submit Examination?</h2>
            </div>

            <div className="p-5 space-y-4">
              {submitError && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-300">
                  {submitError}
                </div>
              )}

              <p className="text-sm text-slate-600 dark:text-slate-300">
                Your answers will be securely graded on the server. Once submitted, you can review the correct answers and explanations.
              </p>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-3.5 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Answered:</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {answeredCount} / {questions.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Unanswered:</span>
                  <span className="font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                    {unansweredCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Marked for Review:</span>
                  <span className="font-extrabold text-purple-600 dark:text-purple-400 tabular-nums">
                    {markedCount}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onCloseEndExamConfirm}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Continue Exam
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleFinalSubmit}
                  className="px-5 py-2.5 rounded-xl bg-[#e03e3e] hover:bg-[#c82d2d] text-white text-sm font-extrabold shadow-sm disabled:opacity-60"
                >
                  {submitting ? 'Grading...' : 'Yes, Submit Exam'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CalculatorModal open={calculatorOpen} onClose={() => setCalculatorOpen(false)} />
    </div>
  );
};
