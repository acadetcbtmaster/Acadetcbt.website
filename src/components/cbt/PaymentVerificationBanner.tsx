import { AlertCircle, CheckCircle2, Clock, RefreshCw, X } from 'lucide-react';
import React from 'react';
import type { PaymentVerifyOutcome } from '../../types/cbt';
import { formatCurrency } from './CourseRegistrationView';

interface PaymentVerificationBannerProps {
  verifying: boolean;
  reference: string | null;
  outcome: PaymentVerifyOutcome | null;
  error: string | null;
  onRetryVerify: (reference: string) => void;
  onGoToMyCourses: () => void;
  onDismiss: () => void;
}

export const PaymentVerificationBanner: React.FC<PaymentVerificationBannerProps> = ({
  verifying,
  reference,
  outcome,
  error,
  onRetryVerify,
  onGoToMyCourses,
  onDismiss,
}) => {
  if (!verifying && !outcome && !error) return null;

  const isSuccess = outcome?.paymentStatus === 'successful' && outcome.unlocked;
  const isPending = outcome?.paymentStatus === 'pending';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[1px]">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div className="bg-[#0b337a] text-white px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-extrabold">Course Payment Verification</h2>
          {!verifying && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Close payment verification modal"
              className="p-1.5 rounded-lg hover:bg-white/15"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {verifying ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-full border-4 border-[#0a58ed] border-t-transparent animate-spin mx-auto" />
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                Verifying your transaction with Paystack...
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Reference: <span className="font-mono">{reference}</span>
              </p>
            </div>
          ) : error ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="text-sm text-red-800 dark:text-red-200">
                  <div className="font-extrabold">Verification Error</div>
                  <p className="mt-1 text-xs">{error}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2.5">
                {reference && (
                  <button
                    type="button"
                    onClick={() => onRetryVerify(reference)}
                    className="px-4 py-2 rounded-xl bg-[#0a58ed] text-white text-xs font-bold flex items-center gap-1.5 min-h-[40px]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Verification</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDismiss}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold min-h-[40px]"
                >
                  Close
                </button>
              </div>
            </div>
          ) : outcome ? (
            <div className="space-y-4">
              {isSuccess ? (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-emerald-900 dark:text-emerald-100">
                    <div className="font-extrabold">Registration Confirmed ✓</div>
                    <p className="mt-1 text-xs">{outcome.message}</p>
                  </div>
                </div>
              ) : isPending ? (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900 dark:text-amber-100">
                    <div className="font-extrabold">Payment Pending</div>
                    <p className="mt-1 text-xs">{outcome.message}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-red-900 dark:text-red-100">
                    <div className="font-extrabold">Payment Failed</div>
                    <p className="mt-1 text-xs">{outcome.message}</p>
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-3.5 space-y-1.5 text-xs">
                {outcome.course && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Course</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {outcome.course.code} — {outcome.course.title}
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Reference</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {outcome.payment.paymentReference}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Amount</span>
                  <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(
                      Number(outcome.payment.amount),
                      outcome.payment.currency
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Payment Status</span>
                  <span className="font-extrabold capitalize">
                    {outcome.payment.paymentStatus}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5">
                {isPending && reference && (
                  <button
                    type="button"
                    onClick={() => onRetryVerify(reference)}
                    className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold flex items-center gap-1.5 min-h-[42px]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-check Status</span>
                  </button>
                )}
                {isSuccess ? (
                  <button
                    type="button"
                    onClick={onGoToMyCourses}
                    className="px-5 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold min-h-[42px]"
                  >
                    Go to My Registered Courses
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold min-h-[42px]"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
