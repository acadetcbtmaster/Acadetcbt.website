import {
  BarChart3,
  BookOpen,
  Calendar,
  ChevronRight,
  FileEdit,
  History,
  Megaphone,
  Play,
  Settings,
  Trophy,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import type {
  ActivitySummary,
  AnnouncementItem,
  DifficultyLevel,
  SubjectSummary,
} from '../../types/cbt';
import { HeroStudyGraphic } from './AcadetLogo';

interface HomeDashboardProps {
  subjects: SubjectSummary[];
  selectedSubjectId: string | null;
  defaultDifficulty: DifficultyLevel;
  announcements: AnnouncementItem[];
  activity: ActivitySummary | null;
  onSelectSubject: (subjectId: string) => void;
  onStartExam: (params: {
    subjectId: string;
    difficulty: DifficultyLevel;
    questionCount: number;
  }) => Promise<void>;
  onNavigateViewResults: () => void;
  onNavigateStudyMaterials: () => void;
  onOpenSettings: () => void;
  startingExam: boolean;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  subjects,
  selectedSubjectId,
  defaultDifficulty,
  announcements,
  activity,
  onSelectSubject,
  onStartExam,
  onNavigateViewResults,
  onNavigateStudyMaterials,
  onOpenSettings,
  startingExam,
}) => {
  const [showStartModal, setShowStartModal] = useState(false);
  const [modalSubjectId, setModalSubjectId] = useState<string>(
    selectedSubjectId || subjects[0]?.id || ''
  );
  const [modalDifficulty, setModalDifficulty] =
    useState<DifficultyLevel>(defaultDifficulty);
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [startError, setStartError] = useState<string | null>(null);

  const activeSubjectId = selectedSubjectId || subjects[0]?.id || '';
  const pinnedAnnouncement = announcements[0] || null;

  const openExamModal = () => {
    setModalSubjectId(activeSubjectId || subjects[0]?.id || '');
    setModalDifficulty(defaultDifficulty);
    setStartError(null);
    setShowStartModal(true);
  };

  const handleLaunchExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalSubjectId) {
      setStartError('Please select a subject before starting.');
      return;
    }
    setStartError(null);
    try {
      onSelectSubject(modalSubjectId);
      await onStartExam({
        subjectId: modalSubjectId,
        difficulty: modalDifficulty,
        questionCount,
      });
      setShowStartModal(false);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Unable to start exam.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-3 sm:px-6 py-5 sm:py-7 space-y-6">
      {/* Hero Banner (Matching Screenshot 1) */}
      <section className="rounded-2xl border border-[#c6daf7] dark:border-slate-700 bg-gradient-to-r from-[#eff5ff] via-[#e1ecfe] to-[#cce0ff] dark:from-slate-900 dark:via-slate-800 dark:to-blue-950/70 px-6 py-6 sm:px-9 sm:py-7 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="space-y-2.5 text-center md:text-left">
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#082252] dark:text-white">
            Welcome to Acadet CBT
          </h1>
          <p className="text-base sm:text-xl font-semibold text-[#1e3a6e] dark:text-blue-200">
            Prepare smart. Practice well. Score higher.
          </p>
          <div className="w-20 h-1.5 rounded-full bg-[#0a58ed] mx-auto md:mx-0 mt-3" />
        </div>

        <div className="shrink-0">
          <HeroStudyGraphic />
        </div>
      </section>

      {/* 4 Horizontal Action Cards (Matching Screenshot 1) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Start Exam (Featured Vibrant Blue Card) */}
        <button
          type="button"
          onClick={openExamModal}
          className="group rounded-2xl bg-gradient-to-br from-[#0a58ed] to-[#0041b5] hover:from-[#0b61ff] hover:to-[#0049cc] text-white p-6 flex flex-col items-center justify-between text-center shadow-md hover:shadow-lg transition-all min-h-[188px]"
        >
          <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center">
            <FileEdit className="w-7 h-7 text-white" />
          </div>
          <div className="my-3">
            <div className="text-xl font-extrabold tracking-tight">Start Exam</div>
            <div className="text-sm text-blue-100 mt-0.5">Begin a practice test</div>
          </div>
          <span className="w-8 h-8 rounded-full bg-white text-[#0041b5] flex items-center justify-center shadow-sm group-hover:translate-x-0.5 transition-transform">
            <ChevronRight className="w-5 h-5" />
          </span>
        </button>

        {/* View Results */}
        <button
          type="button"
          onClick={onNavigateViewResults}
          className="group rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 hover:border-[#9dc0f5] dark:hover:border-blue-700 p-6 flex flex-col items-center justify-between text-center shadow-sm hover:shadow-md transition-all min-h-[188px]"
        >
          <div className="w-12 h-12 rounded-xl bg-[#eff5ff] dark:bg-blue-950/60 flex items-center justify-center">
            <BarChart3 className="w-7 h-7 text-[#0b337a] dark:text-blue-400" />
          </div>
          <div className="my-3">
            <div className="text-xl font-extrabold tracking-tight text-[#082252] dark:text-white">
              View Results
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Check your performance
            </div>
          </div>
          <span className="w-8 h-8 rounded-full bg-[#0b337a] text-white flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
            <ChevronRight className="w-5 h-5" />
          </span>
        </button>

        {/* Study Materials */}
        <button
          type="button"
          onClick={onNavigateStudyMaterials}
          className="group rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 hover:border-[#9dc0f5] dark:hover:border-blue-700 p-6 flex flex-col items-center justify-between text-center shadow-sm hover:shadow-md transition-all min-h-[188px]"
        >
          <div className="w-12 h-12 rounded-xl bg-[#eff5ff] dark:bg-blue-950/60 flex items-center justify-center">
            <BookOpen className="w-7 h-7 text-[#0b337a] dark:text-blue-400" />
          </div>
          <div className="my-3">
            <div className="text-xl font-extrabold tracking-tight text-[#082252] dark:text-white">
              Study Materials
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Access tutorials & notes
            </div>
          </div>
          <span className="w-8 h-8 rounded-full bg-[#0b337a] text-white flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
            <ChevronRight className="w-5 h-5" />
          </span>
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="group rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 hover:border-[#9dc0f5] dark:hover:border-blue-700 p-6 flex flex-col items-center justify-between text-center shadow-sm hover:shadow-md transition-all min-h-[188px]"
        >
          <div className="w-12 h-12 rounded-xl bg-[#eff5ff] dark:bg-blue-950/60 flex items-center justify-center">
            <Settings className="w-7 h-7 text-[#0b337a] dark:text-blue-400" />
          </div>
          <div className="my-3">
            <div className="text-xl font-extrabold tracking-tight text-[#082252] dark:text-white">
              Settings
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Adjust your preferences
            </div>
          </div>
          <span className="w-8 h-8 rounded-full bg-[#0b337a] text-white flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
            <ChevronRight className="w-5 h-5" />
          </span>
        </button>
      </section>

      {/* Lower Two Panels: Important Notice + Your Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Important Notice */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="bg-[#0b337a] text-white px-5 py-3 flex items-center gap-2.5">
            <Megaphone className="w-5 h-5 shrink-0" />
            <h2 className="text-base font-extrabold">Important Notice</h2>
          </div>
          <div className="p-5">
            {pinnedAnnouncement ? (
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {pinnedAnnouncement.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {pinnedAnnouncement.body}
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Welcome to the Acadet CBT Practice Platform!
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                  Select any active subject above to begin a timed practice test.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Your Activity */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="bg-[#0b337a] text-white px-5 py-3 flex items-center gap-2.5">
            <History className="w-5 h-5 shrink-0" />
            <h2 className="text-base font-extrabold">Your Activity</h2>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:divide-x divide-slate-200 dark:divide-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#eff5ff] dark:bg-blue-950/60 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-[#0b337a] dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Last Attempt:
                </div>
                <div className="text-sm font-extrabold text-[#0052cc] dark:text-blue-400 truncate mt-0.5">
                  {activity?.lastAttempt
                    ? `${activity.lastAttempt.subjectName} (${activity.lastAttempt.scorePercentage ?? 0}%)`
                    : 'Not yet taken'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3.5 sm:pl-5">
              <div className="w-10 h-10 rounded-xl bg-[#eff5ff] dark:bg-blue-950/60 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-[#0b337a] dark:text-blue-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Best Score:
                </div>
                <div className="text-lg font-extrabold text-[#0052cc] dark:text-blue-400 tabular-nums mt-0.5">
                  {activity?.bestScore !== null && activity?.bestScore !== undefined
                    ? `${activity.bestScore}%`
                    : '0%'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Start Exam Configuration Modal */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="bg-[#0b337a] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Play className="w-5 h-5" />
                <h2 className="text-base font-extrabold">Configure Practice Exam</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowStartModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/15"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLaunchExam} className="p-5 space-y-4">
              {startError && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3.5 py-2.5 text-sm font-medium text-red-700 dark:text-red-300">
                  {startError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                  Subject
                </label>
                <select
                  value={modalSubjectId}
                  onChange={(e) => setModalSubjectId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                >
                  {subjects.length === 0 ? (
                    <option value="">No subjects available</option>
                  ) : (
                    subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} ({sub.questionCount} questions available)
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                    Difficulty
                  </label>
                  <select
                    value={modalDifficulty}
                    onChange={(e) =>
                      setModalDifficulty(e.target.value as DifficultyLevel)
                    }
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                  >
                    {(['All Levels', 'Easy', 'Medium', 'Hard'] as const).map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                    Question Count
                  </label>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                  >
                    {[5, 10, 20, 40, 60].map((num) => (
                      <option key={num} value={num}>
                        {num} Questions
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStartModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={startingExam || subjects.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-sm font-extrabold shadow-sm disabled:opacity-60"
                >
                  {startingExam ? 'Preparing Exam...' : 'Start Exam Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
