import { CheckCircle2, Clock, FileText, Lock, Play } from 'lucide-react';
import React, { useState } from 'react';
import type { CourseCatalogueItem, DifficultyLevel } from '../../types/cbt';
import { formatCurrency } from './CourseRegistrationView';

interface PracticeExamsViewProps {
  courses: CourseCatalogueItem[];
  defaultDifficulty: DifficultyLevel;
  onStartExam: (params: {
    courseId: string;
    difficulty: DifficultyLevel;
    questionCount: number;
  }) => Promise<void>;
  onRequireRegistration: (course: CourseCatalogueItem) => void;
  startingExam: boolean;
}

export const PracticeExamsView: React.FC<PracticeExamsViewProps> = ({
  courses,
  defaultDifficulty,
  onStartExam,
  onRequireRegistration,
  startingExam,
}) => {
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(defaultDifficulty);
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [error, setError] = useState<string | null>(null);

  const handleLaunch = async (course: CourseCatalogueItem) => {
    setError(null);
    if (!course.isRegistered) {
      onRequireRegistration(course);
      return;
    }
    try {
      await onStartExam({ courseId: course.id, difficulty, questionCount });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start exam.');
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="bg-[#0b337a] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileText className="w-5 h-5" />
          <div>
            <h2 className="text-lg font-extrabold tracking-tight leading-tight">
              Course Examinations
            </h2>
            <p className="text-xs text-blue-100">
              Select a registered course to begin your timed CBT session.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
            className="rounded-lg bg-white/15 border border-white/25 px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
          >
            {(['All Levels', 'Easy', 'Medium', 'Hard'] as const).map((lvl) => (
              <option key={lvl} value={lvl} className="text-slate-900">
                Difficulty: {lvl}
              </option>
            ))}
          </select>

          <select
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="rounded-lg bg-white/15 border border-white/25 px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
          >
            {[5, 10, 20, 40, 60].map((num) => (
              <option key={num} value={num} className="text-slate-900">
                {num} Questions
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {courses.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            No published courses found in PostgreSQL yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <div
                key={course.id}
                className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-4 flex flex-col justify-between gap-4 hover:border-[#0a58ed]/50 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-extrabold text-[#0b337a] dark:text-blue-300">
                      {course.code} · {course.level}
                    </span>
                    <span className="font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                      {course.questionCount} questions
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {course.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {course.description || course.examCategory}
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      {course.defaultDurationMinutes} mins
                    </span>
                    {course.isRegistered ? (
                      <span className="inline-flex items-center gap-1 font-extrabold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Registered ✓
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                        <Lock className="w-3.5 h-3.5" />
                        {formatCurrency(course.registrationFee, course.currency)}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={startingExam || (course.isRegistered && course.questionCount === 0)}
                    onClick={() => handleLaunch(course)}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 min-h-[42px] transition-colors ${
                      course.isRegistered
                        ? 'bg-[#0a58ed] hover:bg-[#0044b8] disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white'
                        : 'bg-[#eff5ff] dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 text-[#0b337a] dark:text-blue-300 border border-[#c6daf7] dark:border-slate-700'
                    }`}
                  >
                    {course.isRegistered ? (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>{course.questionCount === 0 ? 'No Questions Yet' : 'Start CBT'}</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Start CBT</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
