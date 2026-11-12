import { BookOpen, Clock, FileText, Play } from 'lucide-react';
import React, { useState } from 'react';
import type { DifficultyLevel, SubjectSummary } from '../../types/cbt';

interface PracticeExamsViewProps {
  subjects: SubjectSummary[];
  defaultDifficulty: DifficultyLevel;
  onStartExam: (params: {
    subjectId: string;
    difficulty: DifficultyLevel;
    questionCount: number;
  }) => Promise<void>;
  startingExam: boolean;
}

export const PracticeExamsView: React.FC<PracticeExamsViewProps> = ({
  subjects,
  defaultDifficulty,
  onStartExam,
  startingExam,
}) => {
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(defaultDifficulty);
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [error, setError] = useState<string | null>(null);

  const handleLaunch = async (subjectId: string) => {
    setError(null);
    try {
      await onStartExam({ subjectId, difficulty, questionCount });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start exam.');
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="bg-[#0b337a] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileText className="w-5 h-5" />
          <h2 className="text-lg font-extrabold tracking-tight">Practice Exams</h2>
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

        {subjects.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            No active subjects found in PostgreSQL. Seed subjects or add them in the Admin Console.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((sub) => (
              <div
                key={sub.id}
                className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-4 flex flex-col justify-between gap-4 hover:border-[#0a58ed]/50 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-[#eff5ff] dark:bg-blue-950/60 text-[#0b337a] dark:text-blue-300 font-extrabold text-xs">
                      {sub.code}
                    </span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                      {sub.questionCount} questions
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {sub.name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {sub.description || sub.examCategory}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {sub.defaultDurationMinutes}m
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      {sub.courseCount} courses
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={startingExam || sub.questionCount === 0}
                    onClick={() => handleLaunch(sub.id)}
                    className="px-3.5 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Start</span>
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
