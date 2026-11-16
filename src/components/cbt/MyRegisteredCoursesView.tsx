import {
  BookCheck,
  Calendar,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  MessageCircle,
  Play,
  Receipt,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { PaymentReceiptData, RegisteredCourseItem } from '../../types/cbt';
import { CopyReferenceButton } from './CopyReferenceButton';
import { formatCurrency } from './CourseRegistrationView';
import { PaymentReceiptModal } from './PaymentReceiptModal';

interface MyRegisteredCoursesViewProps {
  onStartExamForCourse: (courseId: string) => void;
  onBrowseCatalogue: () => void;
  refreshTrigger?: number;
}

export const MyRegisteredCoursesView: React.FC<MyRegisteredCoursesViewProps> = ({
  onStartExamForCourse,
  onBrowseCatalogue,
  refreshTrigger = 0,
}) => {
  const [items, setItems] = useState<RegisteredCourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<PaymentReceiptData | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.catalog
      .getMyCourses()
      .then((res) => {
        if (active) setItems(res.registeredCourses);
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : 'Unable to load your registered courses.'
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshTrigger]);

  const handleViewReceipt = async (paymentId: string) => {
    setLoadingReceiptId(paymentId);
    setError(null);
    try {
      const res = await api.payments.getReceipt(paymentId);
      setActiveReceipt(res.receipt);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Official receipt could not be loaded right now.'
      );
    } finally {
      setLoadingReceiptId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="bg-[#0b337a] text-white px-4 py-2.5 sm:px-5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <BookCheck className="w-5 h-5 shrink-0" />
            <div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight leading-tight">
                My Registered Courses
              </h2>
              <p className="text-xs text-blue-100">
                Verified courses unlocked for your CBT examinations.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onBrowseCatalogue}
            className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors"
          >
            Register Another Course
          </button>
        </div>

        <div className="p-3 sm:p-4 space-y-3">
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              Loading your registered courses...
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="text-base font-extrabold text-slate-800 dark:text-white">
                No Registered Courses Yet
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                You have not completed registration for any course yet. Browse the Course Catalogue to register and unlock CBT examinations.
              </p>
              <button
                type="button"
                onClick={onBrowseCatalogue}
                className="px-5 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-sm font-extrabold shadow-sm inline-flex items-center gap-2 min-h-[44px]"
              >
                <CreditCard className="w-4 h-4" />
                <span>Go to Course Registration</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((item) => {
                const isGst111 =
                  item.code.replace(/\s+/g, '').toUpperCase() === 'GST111';
                const isAdminActivated = item.activationSource === 'admin_manual';

                return (
                <div
                  key={item.registrationId}
                  className="rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-white dark:bg-slate-900 p-3.5 flex flex-col justify-between gap-3 shadow-xs"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-extrabold text-[#0b337a] dark:text-blue-300">
                        {item.code} · {item.level}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isAdminActivated && (
                          <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 border border-[#c6daf7] dark:border-blue-800 text-[#0b337a] dark:text-blue-300 text-[10px] font-extrabold">
                            Admin Activated
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 font-extrabold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {isGst111 ? 'GST 111 – Subscription Active' : 'Registered ✓'}
                          </span>
                        </span>
                      </div>
                    </div>

                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                      {item.title}
                    </h3>

                    <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 pt-1">
                      <div className="flex items-center justify-between">
                        <span>Payment Status:</span>
                        <span className="font-extrabold text-emerald-700 dark:text-emerald-400 capitalize tabular-nums">
                          {isAdminActivated
                            ? 'Successful (Admin Activated)'
                            : `${item.paymentStatus} (${formatCurrency(item.amountPaid, item.currency)})`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{isAdminActivated ? 'Authorization:' : 'Course Value:'}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                          {isAdminActivated
                            ? 'Admin Activated'
                            : `${formatCurrency(item.courseValue ?? 2300, item.currency)} (Fees absorbed)`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Registration Date:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {new Date(item.registeredAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      {item.paymentReference && (
                        <div className="pt-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span>Reference:</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                              {item.paymentReference}
                            </span>
                          </div>
                          <div className="flex justify-end">
                            <CopyReferenceButton reference={item.paymentReference} compact />
                          </div>
                        </div>
                      )}
                      {item.whatsappNumber && (
                        <div className="flex items-center justify-between">
                          <span>WhatsApp Number:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                            {item.whatsappNumber}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span>Available Questions:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                          {item.questionCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={item.questionCount === 0}
                        onClick={() => onStartExamForCourse(item.courseId)}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white text-xs sm:text-sm font-extrabold shadow-xs flex items-center justify-center gap-1.5 min-h-[40px] transition-colors"
                      >
                        <Play className="w-4 h-4" />
                        <span>{item.questionCount === 0 ? 'No Questions Yet' : 'Start CBT'}</span>
                      </button>

                      {item.paymentId && item.paymentStatus === 'successful' && (
                        <button
                          type="button"
                          disabled={loadingReceiptId === item.paymentId}
                          onClick={() => void handleViewReceipt(item.paymentId)}
                          className="py-2 px-3 rounded-xl border border-[#c6daf7] dark:border-slate-700 bg-[#eff5ff] dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 text-[#0b337a] dark:text-blue-300 text-xs font-extrabold inline-flex items-center gap-1 min-h-[40px]"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>
                            {loadingReceiptId === item.paymentId ? '...' : 'Receipt'}
                          </span>
                        </button>
                      )}
                    </div>

                    {item.whatsappGroupLink && (
                      <a
                        href={item.whatsappGroupLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 px-3 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold flex items-center justify-center gap-1.5 min-h-[38px] transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Join Tutorial Group</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
                );
              })}
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

