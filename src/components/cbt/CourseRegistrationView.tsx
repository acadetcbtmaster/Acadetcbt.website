import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Lock,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type { CourseCatalogueItem, SafeUser } from '../../types/cbt';

interface CourseRegistrationViewProps {
  user: SafeUser;
  courses: CourseCatalogueItem[];
  onRefreshCatalog: () => Promise<void>;
  onStartCourseExam: (courseId: string) => void;
  onPaymentVerifiedNavigate?: () => void;
  onWhatsappUpdated?: (whatsappNumber: string) => void;
  initialRegisterCourseId?: string | null;
  onClearInitialRegisterCourseId?: () => void;
}

export function formatCurrency(amount: number, currency = 'NGN'): string {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency || 'NGN',
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `₦${amount.toLocaleString()}`;
  }
}

export const CourseRegistrationView: React.FC<CourseRegistrationViewProps> = ({
  user,
  courses,
  onRefreshCatalog,
  onStartCourseExam,
  onWhatsappUpdated,
  initialRegisterCourseId = null,
  onClearInitialRegisterCourseId,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'registered' | 'unregistered'>('all');
  const [confirmCourse, setConfirmCourse] = useState<CourseCatalogueItem | null>(() =>
    initialRegisterCourseId
      ? courses.find((c) => c.id === initialRegisterCourseId && !c.isRegistered) || null
      : null
  );
  const [whatsappNumber, setWhatsappNumber] = useState<string>(user.whatsappNumber ?? '');
  const [initializingPay, setInitializingPay] = useState(false);
  const [verifyingRef, setVerifyingRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialRegisterCourseId) {
      const target = courses.find((c) => c.id === initialRegisterCourseId && !c.isRegistered);
      if (target) {
        setConfirmCourse(target);
        setWhatsappNumber((prev) => prev || user.whatsappNumber || '');
      }
      onClearInitialRegisterCourseId?.();
    }
  }, [initialRegisterCourseId, courses, onClearInitialRegisterCourseId, user.whatsappNumber]);

  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((c) => {
      if (statusFilter === 'registered' && !c.isRegistered) return false;
      if (statusFilter === 'unregistered' && c.isRegistered) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.level.toLowerCase().includes(q)
      );
    });
  }, [courses, search, statusFilter]);

  const handlePayNow = async () => {
    if (!confirmCourse) return;
    const normalizedWhatsapp = whatsappNumber.trim().replace(/[\s()-]/g, '');
    if (!/^\+?\d{10,15}$/.test(normalizedWhatsapp)) {
      setError(
        'Please input your correct WhatsApp number (10 to 15 digits, e.g. 08012345678 or +2348012345678).'
      );
      return;
    }

    setInitializingPay(true);
    setError(null);
    setNotice(null);
    try {
      onWhatsappUpdated?.(normalizedWhatsapp);
      const init = await api.payments.initialize(confirmCourse.id, normalizedWhatsapp);
      window.location.assign(init.authorizationUrl);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to initialize Paystack checkout. Please try again.'
      );
      setInitializingPay(false);
    }
  };

  const handleRecheckPending = async (reference: string) => {
    setVerifyingRef(reference);
    setError(null);
    setNotice(null);
    try {
      const outcome = await api.payments.verify(reference);
      await onRefreshCatalog();
      setNotice(outcome.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify transaction status.');
    } finally {
      setVerifyingRef(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="bg-[#0b337a] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 shrink-0" />
            <div>
              <h2 className="text-lg font-extrabold tracking-tight leading-tight">
                Course Registration
              </h2>
              <p className="text-xs text-blue-100">
                Course Catalogue — Register and complete Paystack payment to unlock CBT examinations.
              </p>
            </div>
          </div>

          <div className="text-xs font-bold text-blue-100 tabular-nums">
            {courses.filter((c) => c.isRegistered).length} of {courses.length} Courses Registered
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Search & Status Filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by course code, title, or level..."
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#dce6f5] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a58ed]"
              />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#eff5ff] dark:bg-slate-800 shrink-0">
              {(
                [
                  { id: 'all', label: 'All Courses' },
                  { id: 'registered', label: 'Registered' },
                  { id: 'unregistered', label: 'Not Registered' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    statusFilter === tab.id
                      ? 'bg-[#0a58ed] text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm font-medium text-[#0b337a] dark:text-blue-200">
              {notice}
            </div>
          )}

          {filteredCourses.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              No published courses match your current filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCourses.map((course) => {
                const isRegistered = course.isRegistered;
                const isPending = !isRegistered && course.registrationState === 'pending';
                const isFailed = !isRegistered && course.registrationState === 'failed';

                return (
                  <div
                    key={course.id}
                    className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between gap-4 transition-colors ${
                      isRegistered
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10'
                        : 'border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#0a58ed]/50'
                    }`}
                  >
                    <div className="space-y-2.5">
                      {/* Clean Metadata Line */}
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-extrabold text-[#0b337a] dark:text-blue-300 tracking-wide">
                          {course.code} · {course.level}
                        </span>
                        <span className="font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                          {course.questionCount} CBT Questions
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-snug">
                        {course.title}
                      </h3>

                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                        {course.description || course.examCategory}
                      </p>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            Total Payable
                          </div>
                          <div className="text-lg font-extrabold text-[#082252] dark:text-white tabular-nums">
                            {formatCurrency(2350, course.currency)}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                            Course value: {formatCurrency(course.courseValue ?? 2300, course.currency)} · Charges absorbed by Acadet CBT
                          </div>
                        </div>

                        {/* Clear Semantic Registration Status Indicator */}
                        <div className="text-right">
                          {isRegistered ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span>Registered ✓</span>
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-600 dark:text-amber-400">
                              <Clock className="w-4 h-4 shrink-0" />
                              <span>Payment Pending</span>
                            </span>
                          ) : isFailed ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-red-600 dark:text-red-400">
                              <AlertCircle className="w-4 h-4 shrink-0" />
                              <span>Payment Failed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                              <Lock className="w-3.5 h-3.5 shrink-0" />
                              <span>Not Registered</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {isRegistered ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled
                            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 min-h-[42px] cursor-default"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Registered ✓</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onStartCourseExam(course.id)}
                            className="py-2.5 px-3.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-bold flex items-center justify-center gap-1.5 min-h-[42px]"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Start CBT</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setError(null);
                              setWhatsappNumber(user.whatsappNumber ?? '');
                              setConfirmCourse(course);
                            }}
                            className="flex-1 py-2.5 px-4 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold shadow-xs flex items-center justify-center gap-2 min-h-[44px] transition-colors"
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>{isFailed ? 'Retry Registration' : 'Register Now'}</span>
                          </button>

                          {isPending && course.latestPaymentReference && (
                            <button
                              type="button"
                              disabled={verifyingRef === course.latestPaymentReference}
                              onClick={() =>
                                handleRecheckPending(course.latestPaymentReference!)
                              }
                              title="Verify pending payment status with Paystack"
                              className="py-2.5 px-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 min-h-[44px]"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${
                                  verifyingRef === course.latestPaymentReference
                                    ? 'animate-spin'
                                    : ''
                                }`}
                              />
                              <span>Verify</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Step 1: Course Registration Confirmation Modal */}
      {confirmCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="bg-[#0b337a] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="text-base font-extrabold">Confirm Course Registration</h3>
              </div>
              <button
                type="button"
                disabled={initializingPay}
                onClick={() => setConfirmCourse(null)}
                aria-label="Close registration confirmation"
                className="p-1.5 rounded-lg hover:bg-white/15"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3.5 py-2.5 text-sm font-medium text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/80 border border-[#d6e4fa] dark:border-slate-700 p-4 space-y-2.5 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-600 dark:text-slate-400">Student Name</span>
                  <span className="font-bold text-slate-900 dark:text-white text-right">
                    {user.fullName}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-600 dark:text-slate-400">Student Email</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-right truncate">
                    {user.email}
                  </span>
                </div>
                <div className="border-t border-[#d6e4fa] dark:border-slate-700 pt-2.5 flex justify-between gap-3">
                  <span className="text-slate-600 dark:text-slate-400">Course Code</span>
                  <span className="font-extrabold text-[#0b337a] dark:text-blue-300">
                    {confirmCourse.code}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-600 dark:text-slate-400">Course Title</span>
                  <span className="font-bold text-slate-900 dark:text-white text-right">
                    {confirmCourse.title}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-600 dark:text-slate-400">Course Registration Value</span>
                  <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatCurrency(confirmCourse.courseValue ?? 2300, confirmCourse.currency)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-600 dark:text-slate-400">Payment Processing Charges</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 text-right">
                    Absorbed by Acadet CBT
                  </span>
                </div>
                <div className="border-t border-[#d6e4fa] dark:border-slate-700 pt-2.5 flex justify-between items-center gap-3">
                  <span className="font-extrabold text-[#082252] dark:text-white">
                    Total Amount Payable
                  </span>
                  <span className="text-xl font-extrabold text-[#0a58ed] dark:text-blue-400 tabular-nums">
                    {formatCurrency(2350, confirmCourse.currency)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 pt-1 leading-snug">
                  Paystack processing fees are absorbed by Acadet CBT. You will be charged exactly ₦2,350.
                </p>
              </div>

              <div>
                <label
                  htmlFor="course-reg-whatsapp"
                  className="flex items-center gap-1.5 text-xs font-extrabold text-[#082252] dark:text-slate-200 mb-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    WhatsApp Number <span className="text-red-500">*</span>
                  </span>
                </label>
                <input
                  id="course-reg-whatsapp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={whatsappNumber}
                  onChange={(e) => {
                    setWhatsappNumber(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Input your correct WhatsApp number (e.g. 08012345678)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#c6daf7] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white tabular-nums min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[#0a58ed]"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Input your correct WhatsApp number for course updates and registration confirmation.
                </p>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                You will be redirected to Paystack secure checkout. Course examination access unlocks automatically once Paystack verifies your payment on the server.
              </p>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  disabled={initializingPay}
                  onClick={() => setConfirmCourse(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={initializingPay}
                  onClick={handlePayNow}
                  className="px-5 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-sm font-extrabold shadow-sm flex items-center gap-2 min-h-[44px] disabled:opacity-60"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{initializingPay ? 'Connecting to Paystack...' : 'PAY NOW'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
