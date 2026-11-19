import {
  BarChart3,
  BookCheck,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileEdit,
  History,
  Loader2,
  Lock,
  MailCheck,
  Megaphone,
  Play,
  Send,
  Settings,
  ShieldCheck,
  Trophy,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type {
  ActivitySummary,
  AnnouncementItem,
  CourseCatalogueItem,
  DifficultyLevel,
  SafeUser,
} from '../../types/cbt';
import { AcadetCrest, HeroStudyGraphic, useBranding } from './AcadetLogo';
import { formatCurrency } from './CourseRegistrationView';

interface HomeDashboardProps {
  user?: SafeUser | null;
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
  onNavigateVerifyPayment: () => void;
  onNavigatePaymentHistory: () => void;
  onNavigateViewResults: () => void;
  onNavigateStudyMaterials: () => void;
  onOpenSettings: () => void;
  startingExam: boolean;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  user,
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
  onNavigateVerifyPayment,
  onNavigatePaymentHistory,
  onNavigateViewResults,
  onNavigateStudyMaterials,
  onOpenSettings,
  startingExam,
}) => {
  const { branding } = useBranding();
  const [showStartModal, setShowStartModal] = useState(false);
  const [modalCourseId, setModalCourseId] = useState<string>(
    selectedCourseId || courses[0]?.id || ''
  );
  const [modalDifficulty, setModalDifficulty] =
    useState<DifficultyLevel>(defaultDifficulty);
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [startError, setStartError] = useState<string | null>(null);
  const [resendingVerif, setResendingVerif] = useState(false);
  const [verifFeedback, setVerifFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const handleResendVerification = async () => {
    setResendingVerif(true);
    setVerifFeedback(null);
    try {
      await api.auth.resendVerification();
      setVerifFeedback({
        type: 'ok',
        text: "We've sent a verification link to your registered email address. Please check your inbox and click the verification link to activate your account.",
      });
    } catch (err) {
      setVerifFeedback({
        type: 'err',
        text:
          err instanceof ApiError
            ? err.message
            : 'Unable to send verification email right now.',
      });
    } finally {
      setResendingVerif(false);
    }
  };

  const activeCourseId = selectedCourseId || courses[0]?.id || '';
  const pinnedAnnouncement = announcements[0] || null;
  const registeredCount = courses.filter((c) => c.isRegistered).length;
  const selectedModalCourse = courses.find((c) => c.id === modalCourseId) || null;
  const gst111Course =
    courses.find((c) => c.code.replace(/\s+/g, '').toUpperCase() === 'GST111') || null;

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
    <div className="max-w-6xl mx-auto w-full px-3 sm:px-5 py-3.5 sm:py-5 space-y-4 sm:space-y-5">
      {/* Hero Banner */}
      <section className="rounded-2xl border border-[#c6daf7] dark:border-slate-700 bg-gradient-to-r from-[#eff5ff] via-[#e1ecfe] to-[#cce0ff] dark:from-slate-900 dark:via-slate-800 dark:to-blue-950/70 px-4 py-4 sm:px-7 sm:py-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="space-y-2 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3">
            <AcadetCrest className="w-10 h-10 sm:w-11 sm:h-11" frameOnDark={false} />
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-[#082252] dark:text-white">
              Welcome to {branding.siteName}
            </h1>
          </div>
          <p className="text-sm sm:text-lg font-semibold text-[#1e3a6e] dark:text-blue-200">
            Prepare smart. Practice well. Score higher.
          </p>
          {user?.registrationCode && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-[#9dc0f5] dark:border-slate-700 text-xs font-extrabold text-[#0b337a] dark:text-blue-300">
              <span className="text-slate-500 dark:text-slate-400 font-bold">Student Reg Code:</span>
              <span className="font-mono">{user.registrationCode}</span>
            </div>
          )}
          <div className="w-16 h-1 rounded-full bg-[#0a58ed] mx-auto md:mx-0" />

          <div className="pt-1.5 flex flex-wrap items-center justify-center md:justify-start gap-2">
            <button
              type="button"
              onClick={onNavigateCourseRegistration}
              className="px-3.5 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold shadow-xs inline-flex items-center gap-1.5 min-h-[40px] transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              <span>Course Registration</span>
            </button>
            <button
              type="button"
              onClick={onNavigateMyCourses}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-[#9dc0f5] dark:border-slate-700 text-[#082252] dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 min-h-[40px] transition-colors tabular-nums"
            >
              <BookCheck className="w-4 h-4 text-[#0a58ed]" />
              <span>My Courses ({registeredCount})</span>
            </button>
            <button
              type="button"
              onClick={onNavigateVerifyPayment}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-[#9dc0f5] dark:border-slate-700 text-[#082252] dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 min-h-[40px] transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Verify Payment</span>
            </button>
            <button
              type="button"
              onClick={onNavigatePaymentHistory}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-[#9dc0f5] dark:border-slate-700 text-[#082252] dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 min-h-[40px] transition-colors"
            >
              <History className="w-4 h-4 text-[#0b337a] dark:text-blue-300" />
              <span>Payment History</span>
            </button>
          </div>
        </div>

        <div className="shrink-0">
          <HeroStudyGraphic />
        </div>
      </section>

      {user && !user.emailVerified && (
        <section className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <MailCheck className="w-5 h-5 shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
            <div className="min-w-0 text-xs sm:text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-amber-950 dark:text-amber-100">
                  {verifFeedback?.type === 'ok'
                    ? 'Verification Email Sent Successfully!'
                    : 'Email Verification'}
                </span>
                <span className="text-amber-800 dark:text-amber-300 font-semibold truncate">
                  ({user.email})
                </span>
              </div>
              {verifFeedback?.type === 'ok' ? (
                <div className="mt-0.5 space-y-1">
                  <p className="text-emerald-800 dark:text-emerald-300 font-semibold leading-snug">
                    {verifFeedback.text}
                  </p>
                  <p className="text-amber-900/90 dark:text-amber-200/90 text-xs font-medium leading-snug">
                    Can&apos;t find the email? Check your spam or junk folder.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-amber-900/90 dark:text-amber-200/90 mt-0.5 leading-snug">
                    Please verify your email address to activate your account and access all Acadet CBT features.
                  </p>
                  {verifFeedback && (
                    <p className="mt-1 font-bold text-red-700 dark:text-red-300">
                      {verifFeedback.text}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resendingVerif}
            className="shrink-0 px-3.5 py-2 rounded-lg bg-[#0b337a] hover:bg-[#082252] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 min-h-[38px] disabled:opacity-60"
          >
            {resendingVerif ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>
              {resendingVerif
                ? 'Sending...'
                : verifFeedback?.type === 'ok'
                  ? 'Resend Verification Email'
                  : 'Verify Email Address'}
            </span>
          </button>
        </section>
      )}

      {gst111Course && (
        <section
          className={`rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            gst111Course.isRegistered
              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/75 dark:bg-emerald-950/30'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
          }`}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            {gst111Course.isRegistered ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            ) : (
              <Lock className="w-5 h-5 shrink-0 text-slate-500 dark:text-slate-400 mt-0.5" />
            )}
            <div className="min-w-0 text-xs sm:text-sm space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-[#082252] dark:text-white">
                  {gst111Course.isRegistered
                    ? 'GST 111 – Subscription Active'
                    : 'GST 111 – Subscription Inactive / Locked'}
                </span>
                {gst111Course.isRegistered && gst111Course.activationSource === 'admin_manual' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 border border-[#c6daf7] dark:border-blue-800 text-[#0b337a] dark:text-blue-300 text-[11px] font-extrabold">
                    Admin Activated
                  </span>
                )}
              </div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {gst111Course.isRegistered ? (
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                    Payment Status: Successful
                  </span>
                ) : (
                  <span>
                    Payment Status: Payment Required ({formatCurrency(gst111Course.registrationFee, gst111Course.currency)}) — Complete Paystack payment to unlock CBT access.
                  </span>
                )}
              </div>
            </div>
          </div>

          {gst111Course.isRegistered ? (
            <button
              type="button"
              disabled={startingExam || gst111Course.questionCount === 0}
              onClick={() => {
                onSelectCourse(gst111Course.id);
                void onStartExam({
                  courseId: gst111Course.id,
                  difficulty: defaultDifficulty,
                  questionCount: 20,
                });
              }}
              className="shrink-0 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 min-h-[38px]"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{gst111Course.questionCount === 0 ? 'Unlocked (No Qs)' : 'Start GST 111 CBT'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onRequireRegistration(gst111Course)}
              className="shrink-0 px-3.5 py-2 rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 min-h-[38px]"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Unlock GST 111</span>
            </button>
          )}
        </section>
      )}

      {/* 4 Horizontal Action Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Start Exam */}
        <button
          type="button"
          onClick={openExamModal}
          className="group rounded-2xl bg-gradient-to-br from-[#0a58ed] to-[#0041b5] hover:from-[#0b61ff] hover:to-[#0049cc] text-white p-4 sm:p-5 flex flex-col items-center justify-between text-center shadow-md hover:shadow-lg transition-all min-h-[146px] sm:min-h-[166px]"
        >
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <FileEdit className="w-6 h-6 text-white" />
          </div>
          <div className="my-2">
            <div className="text-lg font-extrabold tracking-tight">Start Exam</div>
            <div className="text-xs sm:text-sm text-blue-100 mt-0.5">Begin a course CBT test</div>
          </div>
          <span className="w-7 h-7 rounded-full bg-white text-[#0041b5] flex items-center justify-center shadow-sm group-hover:translate-x-0.5 transition-transform">
            <ChevronRight className="w-4 h-4" />
          </span>
        </button>

        {/* Course Results */}
        <button
          type="button"
          onClick={onNavigateViewResults}
          className="group rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 hover:border-[#9dc0f5] dark:hover:border-blue-700 p-4 sm:p-5 flex flex-col items-center justify-between text-center shadow-sm hover:shadow-md transition-all min-h-[146px] sm:min-h-[166px]"
        >
          <div className="w-10 h-10 rounded-xl bg-[#eff5ff] dark:bg-blue-950/60 flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-[#0b337a] dark:text-blue-400" />
          </div>
          <div className="my-2">
            <div className="text-lg font-extrabold tracking-tight text-[#082252] dark:text-white">
              Course Results
            </div>
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Check your performance
            </div>
          </div>
          <span className="w-7 h-7 rounded-full bg-[#0b337a] text-white flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
            <ChevronRight className="w-4 h-4" />
          </span>
        </button>

        {/* Study Materials */}
        <button
          type="button"
          onClick={onNavigateStudyMaterials}
          className="group rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 hover:border-[#9dc0f5] dark:hover:border-blue-700 p-4 sm:p-5 flex flex-col items-center justify-between text-center shadow-sm hover:shadow-md transition-all min-h-[146px] sm:min-h-[166px]"
        >
          <div className="w-10 h-10 rounded-xl bg-[#eff5ff] dark:bg-blue-950/60 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-[#0b337a] dark:text-blue-400" />
          </div>
          <div className="my-2">
            <div className="text-lg font-extrabold tracking-tight text-[#082252] dark:text-white">
              Study Materials
            </div>
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Access course tutorials & notes
            </div>
          </div>
          <span className="w-7 h-7 rounded-full bg-[#0b337a] text-white flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
            <ChevronRight className="w-4 h-4" />
          </span>
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="group rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 hover:border-[#9dc0f5] dark:hover:border-blue-700 p-4 sm:p-5 flex flex-col items-center justify-between text-center shadow-sm hover:shadow-md transition-all min-h-[146px] sm:min-h-[166px]"
        >
          <div className="w-10 h-10 rounded-xl bg-[#eff5ff] dark:bg-blue-950/60 flex items-center justify-center">
            <Settings className="w-6 h-6 text-[#0b337a] dark:text-blue-400" />
          </div>
          <div className="my-2">
            <div className="text-lg font-extrabold tracking-tight text-[#082252] dark:text-white">
              Settings
            </div>
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Adjust your preferences
            </div>
          </div>
          <span className="w-7 h-7 rounded-full bg-[#0b337a] text-white flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
            <ChevronRight className="w-4 h-4" />
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
                        {formatCurrency(selectedModalCourse.registrationFee, selectedModalCourse.currency)}
                      </span>{' '}
                      ({formatCurrency(selectedModalCourse.courseValue ?? selectedModalCourse.registrationFee, selectedModalCourse.currency)} course value · processing charges absorbed by Acadet CBT). Complete Paystack registration to unlock this exam.
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
                        {lvl === 'Hard' ? 'Difficult' : lvl}
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
