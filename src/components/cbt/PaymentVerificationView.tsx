import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  History,
  MessageCircle,
  Play,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type {
  PaymentReceiptData,
  PaymentVerifyOutcome,
  StudentPaymentRecord,
} from '../../types/cbt';
import { AcadetCrest } from './AcadetLogo';
import { CopyReferenceButton } from './CopyReferenceButton';
import { formatCurrency } from './CourseRegistrationView';
import { PaymentReceiptModal } from './PaymentReceiptModal';

interface PaymentVerificationViewProps {
  initialReference?: string | null;
  onClearInitialReference?: () => void;
  onPaymentConfirmed: () => Promise<void>;
  onStartCourseExam: (courseId: string) => void;
  onOpenPaymentHistory: () => void;
  onOpenCourseRegistration: () => void;
}

export const PaymentVerificationView: React.FC<PaymentVerificationViewProps> = ({
  initialReference = null,
  onClearInitialReference,
  onPaymentConfirmed,
  onStartCourseExam,
  onOpenPaymentHistory,
  onOpenCourseRegistration,
}) => {
  const [referenceInput, setReferenceInput] = useState(initialReference || '');
  const [verifying, setVerifying] = useState(false);
  const [outcome, setOutcome] = useState<PaymentVerifyOutcome | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [myPayments, setMyPayments] = useState<StudentPaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [activeReceipt, setActiveReceipt] = useState<PaymentReceiptData | null>(null);

  const loadMyPayments = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const res = await api.payments.myPayments();
      setMyPayments(res.payments);
    } catch {
      // Keep page interactive even if history fetch momentarily fails
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  useEffect(() => {
    void loadMyPayments();
  }, [loadMyPayments]);

  useEffect(() => {
    if (initialReference && initialReference.trim()) {
      setReferenceInput(initialReference.trim());
      setOutcome(null);
      setErrorMessage(null);
      onClearInitialReference?.();
    }
  }, [initialReference, onClearInitialReference]);

  const runVerification = async (rawRef: string) => {
    const cleanRef = rawRef.trim();
    if (!cleanRef) {
      setErrorMessage('Please enter your Paystack payment reference before verifying.');
      setOutcome(null);
      return;
    }

    setVerifying(true);
    setErrorMessage(null);
    setOutcome(null);

    try {
      const res = await api.payments.verify(cleanRef, 'student_manual');
      setOutcome(res);
      await loadMyPayments();
      if (res.unlocked || res.paymentStatus === 'successful') {
        await onPaymentConfirmed();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Unable to verify payment reference right now. Please try again.'
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runVerification(referenceInput);
  };

  const pendingOrRetryable = myPayments.filter(
    (p) => p.paymentStatus === 'pending' || p.paymentStatus === 'failed'
  );

  const vResult = outcome?.verificationResult;
  const isSuccess =
    outcome &&
    (vResult === 'successful' || vResult === 'already_registered' || outcome.unlocked);
  const isPending = vResult === 'pending' || outcome?.paymentStatus === 'pending';
  const isAwaitingAdmin = vResult === 'awaiting_admin_review';
  const isNotFound = vResult === 'not_found' || outcome?.paymentStatus === 'not_found';

  return (
    <div className="max-w-3xl mx-auto space-y-3.5">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="bg-[#0b337a] text-white px-4 py-3 sm:px-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <AcadetCrest className="w-8 h-8" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                Payment Verification
              </div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight leading-tight">
                Verify Your Payment
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenPaymentHistory}
              className="px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold inline-flex items-center gap-1"
            >
              <History className="w-3.5 h-3.5" />
              <span>Payment History</span>
            </button>
          </div>
        </div>

        <div className="p-3.5 sm:p-5 space-y-4">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Did you successfully make a payment but your course registration was not activated? Enter your Paystack transaction reference below to verify your payment and retrieve your course registration.
          </p>

          <form onSubmit={handleSubmit} className="space-y-2.5">
            <label
              htmlFor="manual-payment-reference"
              className="block text-xs font-extrabold uppercase tracking-wide text-[#082252] dark:text-slate-200"
            >
              Enter Payment Reference
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="manual-payment-reference"
                  type="text"
                  value={referenceInput}
                  onChange={(e) => {
                    setReferenceInput(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="e.g. ACD-2026-XXXXXXXX"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#c6daf7] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono font-bold text-slate-900 dark:text-white min-h-[42px] focus:outline-none focus:ring-2 focus:ring-[#0a58ed]"
                />
              </div>
              <button
                type="submit"
                disabled={verifying}
                className="px-5 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold shadow-xs inline-flex items-center justify-center gap-2 min-h-[42px] disabled:opacity-60 shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
                <span>{verifying ? 'Verifying...' : 'VERIFY PAYMENT'}</span>
              </button>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              You can find your transaction reference on your Paystack payment confirmation page or transaction receipt.
            </p>
          </form>

          {errorMessage && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3.5 flex items-start gap-2.5 text-xs sm:text-sm text-red-800 dark:text-red-200">
              <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-extrabold">Verification Notice</div>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {outcome && (
            <div className="space-y-3">
              {isSuccess ? (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5 flex items-start gap-3 text-emerald-900 dark:text-emerald-100">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs sm:text-sm">
                    <div className="font-extrabold">
                      {vResult === 'already_registered'
                        ? 'Payment Already Verified'
                        : 'Payment Verified & Course Activated'}
                    </div>
                    <p>{outcome.message}</p>
                  </div>
                </div>
              ) : isPending ? (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3.5 flex items-start gap-3 text-amber-900 dark:text-amber-100">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs sm:text-sm">
                    <div className="font-extrabold">Payment Still Processing</div>
                    <p>{outcome.message}</p>
                  </div>
                </div>
              ) : isAwaitingAdmin ? (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3.5 flex items-start gap-3 text-amber-900 dark:text-amber-100">
                  <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs sm:text-sm">
                    <div className="font-extrabold">Logged for Administrator Review</div>
                    <p>{outcome.message}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3.5 flex items-start gap-3 text-red-900 dark:text-red-100">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs sm:text-sm">
                    <div className="font-extrabold">
                      {isNotFound ? 'Reference Not Found' : 'Transaction Not Successful'}
                    </div>
                    <p>{outcome.message}</p>
                  </div>
                </div>
              )}

              {(outcome.payment || outcome.course) && (
                <div className="rounded-xl bg-[#eff5ff]/70 dark:bg-slate-800/70 border border-[#dce6f5] dark:border-slate-700 p-3.5 space-y-2 text-xs">
                  {outcome.course && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Course</span>
                      <span className="font-extrabold text-[#0b337a] dark:text-blue-300 text-right">
                        {outcome.course.code} — {outcome.course.title}
                      </span>
                    </div>
                  )}
                  {outcome.payment && (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-slate-500 dark:text-slate-400">Payment Reference</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {outcome.payment.paymentReference}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 dark:text-slate-400">Amount</span>
                        <span className="font-extrabold tabular-nums text-slate-900 dark:text-white">
                          {formatCurrency(
                            Number(outcome.payment.totalAmountCharged ?? outcome.payment.amount),
                            outcome.payment.currency
                          )}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {isSuccess && (
                <div className="flex flex-wrap items-center gap-2">
                  {outcome.receipt && (
                    <button
                      type="button"
                      onClick={() => setActiveReceipt(outcome.receipt || null)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 min-h-[40px]"
                    >
                      <Receipt className="w-4 h-4" />
                      <span>View Official Receipt</span>
                    </button>
                  )}

                  {outcome.course && (
                    <button
                      type="button"
                      onClick={() => onStartCourseExam(outcome.course!.id)}
                      className="px-4 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 min-h-[40px]"
                    >
                      <Play className="w-4 h-4" />
                      <span>Start Course CBT</span>
                    </button>
                  )}

                  {(outcome.receipt?.whatsappGroupLink || outcome.course?.whatsappGroupLink) && (
                    <a
                      href={
                        outcome.receipt?.whatsappGroupLink ||
                        outcome.course?.whatsappGroupLink ||
                        '#'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 min-h-[40px]"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Join Tutorial Group</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Pending / Incomplete Payments for Quick Recovery */}
          {!loadingPayments && pendingOrRetryable.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs sm:text-sm font-extrabold text-[#082252] dark:text-white">
                  Unconfirmed Transactions on Your Account ({pendingOrRetryable.length})
                </h3>
                <button
                  type="button"
                  onClick={onOpenCourseRegistration}
                  className="text-xs font-bold text-[#0a58ed] dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Course Registration</span>
                </button>
              </div>

              <div className="space-y-2">
                {pendingOrRetryable.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-extrabold text-[#0b337a] dark:text-blue-300">
                          {item.courseCode} — {item.courseTitle}
                        </span>
                        <span
                          className={`text-[11px] font-extrabold uppercase ${
                            item.paymentStatus === 'pending'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {item.paymentStatus}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                          {item.paymentReference}
                        </span>
                        <CopyReferenceButton reference={item.paymentReference} compact />
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={verifying}
                      onClick={() => {
                        setReferenceInput(item.paymentReference);
                        void runVerification(item.paymentReference);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 min-h-[38px] shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Verify Now</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <PaymentReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />
    </div>
  );
};
