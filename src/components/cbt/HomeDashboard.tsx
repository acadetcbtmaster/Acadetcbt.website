import {
  BarChart3,
  BookCheck,
  BookOpen,
  Calendar,
  ChevronRight,
  CreditCard,
  FileEdit,
  History,
  Lock,
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
  CourseCatalogueItem,
  DifficultyLevel,
} from '../../types/cbt';
import { HeroStudyGraphic } from './AcadetLogo';
import { formatCurrency } from './CourseRegistrationView';

interface HomeDashboardProps {
  courses: CourseCatalogueItem[];
  selectedCourseId: string | null;
  defaultDifficulty: DifficultyLevel;
  announcements: AnnouncementItem[];
  activity: ActivitySummary | null;
  onSelectCourse: (courseId: string) => void;
  onStartExam: (params: {
    courseId: string;
    difficulty: DifficultyLevel;
    questionCount: number;
  }) => Promise<void>;
  onRequireRegistration: (course: CourseCatalogueItem) => void;
  onNavigateCourseRegistration: () => void;
  onNavigateMyCourses: () => void;
  onNavigateViewResults: () => void;
  onNavigateStudyMaterials: () => void;
  onOpenSettings: () => void;
  startingExam: boolean;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  courses,
  selectedCourseId,
  defaultDifficulty,
  announcements,
  activity,
  onSelectCourse,
  onStartExam,
  onRequireRegistration,
  onNavigateCourseRegistration,
  onNavigateMyCourses,
  onNavigateViewResults,
  onNavigateStudyMaterials,
  onOpenSettings,
  startingExam,
}) => {
  const [showStartModal, setShowStartModal] = useState(false);
  const [modalCourseId, setModalCourseId] = useState<string>(
    selectedCourseId || courses[0]?.id || ''
  );
  const [modalDifficulty, setModalDifficulty] =
    useState<DifficultyLevel>(defaultDifficulty);
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [startError, setStartError] = useState<string | null>(null);

  const activeCourseId = selectedCourseId || courses[0]?.id || '';
  const pinnedAnnouncement = announcements[0] || null;
  const registeredCount = courses.filter((c) => c.isRegistered).length;
  const selectedModalCourse = courses.find((c) => c.id === modalCourseId) || null;

  const openExamModal = () => {
    const firstRegistered = courses.find((c) => c.isRegistered);
    const defaultPick =
      courses.find((c) => c.id === activeCourseId) || firstRegistered || courses[0];
    setModalCourseId(defaultPick?.id || '');
    setModalDifficulty(defaultDifficulty);
    setStartError(null);
    setShowStartModal(true);
  };

  const handleLaunchExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCourseId || !selectedModalCourse) {
      setStartError('Please select a course before starting.');
      return;
    }
    if (!selectedModalCourse.isRegistered) {
      setShowStartModal(false);
      onRequireRegistration(selectedModalCourse);
      return;
    }

    setStartError(null);
    try {
      onSelectCourse(modalCourseId);
      await onStartExam({
        courseId: modalCourseId,
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
      {/* Hero Banner */}
      <section className="rounded-2xl border border-[#c6daf7] dark:border-slate-700 bg-gradient-to-r from-[#eff5ff] via-[#e1ecfe] to-[#cce0ff] dark:from-slate-900 dark:via-slate-800 dark:to-blue-950/70 px-6 py-6 sm:px-9 sm:py-7 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="space-y-3 text-center md:text-left">
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#082252] dark:text-white">
            Welcome to Acadet CBT
          </h1>
          <p className="text-base sm:text-xl font-semibold text-[#1e3a6e] dark:text-blue-200">
            Prepare smart. Practice well. Score higher.
          </p>
          <div className="w-20 h-1.5 rounded-full bg-[#0a58ed] mx-auto md:mx-0" />

          <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-2.5">
            <button
              type="button"
              onClick={onNavigateCourseRegistration}
              className="px-4 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold shadow-xs inline-flex items-center gap-2 min-h-[40px] transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              <span>Course Registration</span>
            </button>
            <button
              type="button"
              onClick={onNavigateMyCourses}
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-[#9dc0f5] dark:border-slate-700 text-[#082252] dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 min-h-[40px] transition-colors tabular-nums"
            >
              <BookCheck className="w-4 h-4 text-[#0a58ed]" />
              <span>My Courses ({registeredCount})</span>
            </button>
          </div>
        </div>

        <div className="shrink-0">
          <HeroStudyGraphic />
        </div>
      </section>

      {/* 4 Horizontal Action Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Start Exam */}
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
            <div className="text-sm text-blue-100 mt-0.5">Begin a course CBT test</div>
          </div>
          <span className="w-8 h-8 rounded-full bg-white text-[#0041b5] flex items-center justify-center shadow-sm group-hover:translate-x-0.5 transition-transform">
            <ChevronRight className="w-5 h-5" />
          </span>
        </button>

        {/* Course Results */}
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
              Course Results
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
              Access course tutorials & notes
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
                  Register for any course under Course Registration to unlock timed CBT practice examinations.
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
                    ? `${activity.lastAttempt.courseCode} (${activity.lastAttempt.scorePercentage ?? 0}%)`
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
                <h2 className="text-base font-extrabold">Configure Course Examination</h2>
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
                  Select Course
                </label>
                <select
                  value={modalCourseId}
                  onChange={(e) => setModalCourseId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                >
                  {courses.length === 0 ? (
                    <option value="">No courses available</option>
                  ) : (
                    courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.title} ({c.isRegistered ? 'Registered ✓' : 'Not Registered'})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {selectedModalCourse && !selectedModalCourse.isRegistered && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <div className="font-extrabold">Course Registration Required</div>
                    <div className="mt-0.5">
                      Total payable:{' '}
                      <span className="font-extrabold tabular-nums">
                        {formatCurrency(2350, selectedModalCourse.currency)}
                      </span>{' '}
                      (₦2,300 course value · processing charges absorbed by Acadet CBT). Complete Paystack registration to unlock this exam.
                    </div>
                  </div>
                </div>
              )}

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
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={startingExam || courses.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-sm font-extrabold shadow-sm disabled:opacity-60 min-h-[44px]"
                >
                  {startingExam
                    ? 'Preparing Exam...'
                    : selectedModalCourse && !selectedModalCourse.isRegistered
                      ? 'Register to Unlock'
                      : 'Start Exam Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
