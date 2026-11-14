import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  History,
  Lock,
  MessageCircle,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type {
  CourseCatalogueItem,
  PaymentInitializeResponse,
  PaymentReceiptData,
  SafeUser,
} from '../../types/cbt';
import { AcadetCrest } from './AcadetLogo';
import { CopyReferenceButton } from './CopyReferenceButton';
import { PaymentReceiptModal } from './PaymentReceiptModal';

interface CourseRegistrationViewProps {
  user: SafeUser;
  courses: CourseCatalogueItem[];
  onRefreshCatalog: () => Promise<void>;
  onStartCourseExam: (courseId: string) => void;
  onPaymentVerifiedNavigate?: () => void;
  onOpenVerifyPayment?: (reference?: string) => void;
  onOpenPaymentHistory?: () => void;
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
  onOpenVerifyPayment,
  onOpenPaymentHistory,
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
  const [checkoutReady, setCheckoutReady] = useState<PaymentInitializeResponse | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState<string>(user.whatsappNumber ?? '');
  const [initializingPay, setInitializingPay] = useState(false);
  const [verifyingRef, setVerifyingRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<PaymentReceiptData | null>(null);

  React.useEffect(() => {
    if (initialRegisterCourseId) {
      const target = courses.find((c) => c.id === initialRegisterCourseId && !c.isRegistered);
      if (target) {
        setCheckoutReady(null);
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
      setCheckoutReady(init);
      await onRefreshCatalog();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to initialize Paystack checkout. Please try again.'
      );
    } finally {
      setInitializingPay(false);
    }
  };

  const handleRecheckPending = async (reference: string) => {
    setVerifyingRef(reference);
    setError(null);
    setNotice(null);
    try {
      const outcome = await api.payments.verify(reference, 'student_manual');
      await onRefreshCatalog();
      setNotice(outcome.message);
      if (outcome.receipt) {
        setActiveReceipt(outcome.receipt);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify transaction status.');
    } finally {
      setVerifyingRef(null);
    }
  };

  const closeModal = () => {
    setConfirmCourse(null);
    setCheckoutReady(null);
    setError(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-3.5">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="bg-[#0b337a] text-white px-4 py-2.5 sm:px-5 sm:py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <AcadetCrest className="w-8 h-8 sm:w-9 sm:h-9" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight leading-tight">
                Course Registration
              </h2>
              <p className="text-[11px] sm:text-xs text-blue-100 truncate">
                Select a course and complete Paystack payment (₦2,350) to unlock CBT exams.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenVerifyPayment && (
              <button
                type="button"
                onClick={() => onOpenVerifyPayment()}
                className="px-2.5 py-1.5 rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold inline-flex items-center gap-1"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verify Payment</span>
              </button>
            )}
            {onOpenPaymentHistory && (
              <button
                type="button"
                onClick={onOpenPaymentHistory}
                className="px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold inline-flex items-center gap-1"
              >
                <History className="w-3.5 h-3.5" />
                <span>Payment History</span>
              </button>
            )}
            <div className="text-xs font-bold text-blue-100 tabular-nums pl-1">
              {courses.filter((c) => c.isRegistered).length}/{courses.length} Registered
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4 space-y-3">
          {/* Compact Search & Status Filter */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search course code, title, or level..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#dce6f5] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm min-h-[40px] focus:outline-none focus:ring-2 focus:ring-[#0a58ed]"
              />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#eff5ff] dark:bg-slate-800 shrink-0 overflow-x-auto">
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
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap min-h-[34px] ${
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
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3 py-2 text-xs sm:text-sm font-medium text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs sm:text-sm font-medium text-[#0b337a] dark:text-blue-200 flex flex-wrap items-center justify-between gap-2">
              <span>{notice}</span>
              {activeReceipt && (
                <button
                  type="button"
                  onClick={() => setActiveReceipt(activeReceipt)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-extrabold inline-flex items-center gap-1"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>View Receipt</span>
                </button>
              )}
            </div>
          )}

          {filteredCourses.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No published courses match your current filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredCourses.map((course) => {
                const isRegistered = course.isRegistered;
                const isPending = !isRegistered && course.registrationState === 'pending';
                const isFailed = !isRegistered && course.registrationState === 'failed';

                return (
                  <div
                    key={course.id}
                    className={`rounded-xl border p-3.5 flex flex-col justify-between gap-2.5 transition-colors ${
                      isRegistered
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10'
                        : 'border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#0a58ed]/50'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-extrabold text-[#0b337a] dark:text-blue-300 tracking-wide truncate">
                          {course.code} · {course.level}
                        </span>
                        <span className="font-bold text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                          {course.questionCount} Qs
                        </span>
                      </div>

                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                        {course.title}
                      </h3>

                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-snug">
                        {course.description || course.examCategory}
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-base sm:text-lg font-extrabold text-[#082252] dark:text-white tabular-nums leading-tight">
                            {formatCurrency(2350, course.currency)}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums leading-tight">
                            Value {formatCurrency(course.courseValue ?? 2300, course.currency)} · Charges absorbed
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {isRegistered ? (
                            <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Registered ✓</span>
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-600 dark:text-amber-400">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>Pending</span>
                            </span>
                          ) : isFailed ? (
                            <span className="inline-flex items-center gap-1 text-xs font-extrabold text-red-600 dark:text-red-400">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>Failed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                              <Lock className="w-3.5 h-3.5 shrink-0" />
                              <span>Not Registered</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {isPending && course.latestPaymentReference && (
                        <div className="rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/70 px-2.5 py-2 space-y-1">
                          <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                            Saved Payment Reference:
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="font-mono text-[11px] font-extrabold text-slate-900 dark:text-white break-all">
                              {course.latestPaymentReference}
                            </span>
                            <CopyReferenceButton
                              reference={course.latestPaymentReference}
                              compact
                            />
                          </div>
                        </div>
                      )}

                      {isRegistered ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled
                            className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 min-h-[40px] cursor-default"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Registered ✓</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onStartCourseExam(course.id)}
                            className="py-2 px-3 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-bold flex items-center justify-center gap-1.5 min-h-[40px]"
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
                              setCheckoutReady(null);
                              setWhatsappNumber(user.whatsappNumber ?? '');
                              setConfirmCourse(course);
                            }}
                            className="flex-1 py-2 px-3 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold shadow-xs flex items-center justify-center gap-1.5 min-h-[40px] transition-colors"
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>{isFailed ? 'Retry Registration' : 'Register Now'}</span>
                          </button>

                          {isPending && course.latestPaymentReference && (
                            <button
                              type="button"
                              disabled={verifyingRef === course.latestPaymentReference}
                              onClick={() =>
                                void handleRecheckPending(course.latestPaymentReference!)
                              }
                              title="Verify pending payment status with Paystack"
                              className="py-2 px-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-1 min-h-[40px]"
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

      {/* Course Registration & Payment Reference Modal */}
      {confirmCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/60 backdrop-blur-[1px]">
          <div className="w-full max-w-md max-h-[94dvh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-[#0b337a] text-white px-4 py-2.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <AcadetCrest className="w-7 h-7" />
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <h3 className="text-sm sm:text-base font-extrabold truncate">
                  {checkoutReady
                    ? 'Payment Reference Ready'
                    : 'Confirm Course Registration'}
                </h3>
              </div>
              <button
                type="button"
                disabled={initializingPay}
                onClick={closeModal}
                aria-label="Close registration confirmation"
                className="p-1 rounded-lg hover:bg-white/15 shrink-0"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {checkoutReady ? (
              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800 border border-[#c6daf7] dark:border-slate-700 p-3.5 space-y-2">
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Payment Reference:
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-sm sm:text-base font-extrabold text-[#0b337a] dark:text-blue-300 break-all">
                      {checkoutReady.reference}
                    </span>
                  </div>
                  <CopyReferenceButton reference={checkoutReady.reference} />
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug pt-1">
                    Save or copy this reference before proceeding. If your connection interrupts after paying, enter it under Payment Verification or retrieve it anytime from My Payment History.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Course</span>
                    <span className="font-extrabold text-slate-900 dark:text-white text-right">
                      {checkoutReady.course.code} — {checkoutReady.course.title}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Total Amount Payable</span>
                    <span className="font-extrabold text-[#0a58ed] dark:text-blue-400 tabular-nums">
                      {formatCurrency(checkoutReady.amount, checkoutReady.currency)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => window.location.assign(checkoutReady.authorizationUrl)}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold shadow-sm flex items-center justify-center gap-2 min-h-[42px]"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Proceed to Paystack Checkout</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[38px]"
                  >
                    Close & Keep Reference
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-3.5 sm:p-4 space-y-2.5 overflow-y-auto flex-1">
                  {error && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
                      {error}
                    </div>
                  )}

                  {/* Compact Summary Grid */}
                  <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/80 border border-[#d6e4fa] dark:border-slate-700 p-3 space-y-1.5 text-xs sm:text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-600 dark:text-slate-400">Student</span>
                      <span className="font-bold text-slate-900 dark:text-white text-right truncate">
                        {user.fullName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-600 dark:text-slate-400">Email</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200 text-right truncate">
                        {user.email}
                      </span>
                    </div>

                    <div className="border-t border-[#d6e4fa] dark:border-slate-700 pt-1.5 flex items-start justify-between gap-2">
                      <span className="text-slate-600 dark:text-slate-400 shrink-0">Course</span>
                      <span className="font-extrabold text-[#0b337a] dark:text-blue-300 text-right leading-snug">
                        {confirmCourse.code} — {confirmCourse.title}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-600 dark:text-slate-400">Course Value</span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                        {formatCurrency(confirmCourse.courseValue ?? 2300, confirmCourse.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-600 dark:text-slate-400">Processing Charges</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 text-right">
                        Absorbed by Acadet CBT
                      </span>
                    </div>

                    <div className="border-t border-[#d6e4fa] dark:border-slate-700 pt-1.5 flex items-center justify-between gap-2">
                      <span className="font-extrabold text-[#082252] dark:text-white">
                        Total Amount Payable
                      </span>
                      <span className="text-lg font-extrabold text-[#0a58ed] dark:text-blue-400 tabular-nums">
                        {formatCurrency(2350, confirmCourse.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Compact WhatsApp Number Field */}
                  <div>
                    <label
                      htmlFor="course-reg-whatsapp"
                      className="flex items-center gap-1.5 text-xs font-extrabold text-[#082252] dark:text-slate-200 mb-1"
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
                      className="w-full px-3 py-2 rounded-xl border border-[#c6daf7] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white tabular-nums min-h-[40px] focus:outline-none focus:ring-2 focus:ring-[#0a58ed]"
                    />
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                      A unique payment reference is created and saved to your account before Paystack opens.
                    </p>
                  </div>
                </div>

                <div className="px-3.5 sm:px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-end gap-2.5 shrink-0">
                  <button
                    type="button"
                    disabled={initializingPay}
                    onClick={closeModal}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={initializingPay}
                    onClick={() => void handlePayNow()}
                    className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold shadow-sm flex items-center justify-center gap-1.5 min-h-[40px] disabled:opacity-60"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>{initializingPay ? 'Preparing Reference...' : 'PAY NOW'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <PaymentReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />
    </div>
  );
};

