import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  History,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type {
  PaymentReceiptData,
  PaymentStatus,
  StudentPaymentRecord,
} from '../../types/cbt';
import { AcadetCrest } from './AcadetLogo';
import { CopyReferenceButton } from './CopyReferenceButton';
import { formatCurrency } from './CourseRegistrationView';
import { PaymentReceiptModal } from './PaymentReceiptModal';

interface PaymentHistoryViewProps {
  onOpenVerifyReference: (reference: string) => void;
  onOpenCourseRegistration: () => void;
  refreshTrigger?: number;
}

export const PaymentHistoryView: React.FC<PaymentHistoryViewProps> = ({
  onOpenVerifyReference,
  onOpenCourseRegistration,
  refreshTrigger = 0,
}) => {
  const [payments, setPayments] = useState<StudentPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [search, setSearch] = useState('');
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<PaymentReceiptData | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.payments.myPayments();
      setPayments(res.payments);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load your payment history right now.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPayments();
  }, [fetchPayments, refreshTrigger]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (statusFilter !== 'all' && p.paymentStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        p.paymentReference.toLowerCase().includes(q) ||
        p.courseCode.toLowerCase().includes(q) ||
        p.courseTitle.toLowerCase().includes(q)
      );
    });
  }, [payments, statusFilter, search]);

  const handleOpenReceipt = async (paymentId: string) => {
    setLoadingReceiptId(paymentId);
    setError(null);
    try {
      const res = await api.payments.getReceipt(paymentId);
      setActiveReceipt(res.receipt);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Official receipt could not be retrieved.'
      );
    } finally {
      setLoadingReceiptId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-3.5">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="bg-[#0b337a] text-white px-4 py-3 sm:px-5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <AcadetCrest className="w-8 h-8" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight leading-tight">
                MY PAYMENT HISTORY
              </h2>
              <p className="text-xs text-blue-100 truncate">
                Retrieve saved payment references, verify pending transactions, and download official receipts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenVerifyReference('')}
              className="px-3 py-1.5 rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold inline-flex items-center gap-1.5 min-h-[36px]"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verify Payment</span>
            </button>
          </div>
        </div>

        <div className="p-3 sm:p-4 space-y-3">
          {/* Compact Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by reference, course code, or title..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#dce6f5] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm min-h-[40px] focus:outline-none focus:ring-2 focus:ring-[#0a58ed]"
              />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#eff5ff] dark:bg-slate-800 shrink-0 overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'successful', label: 'Successful' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'failed', label: 'Failed' },
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
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3 py-2.5 text-xs sm:text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              Loading your payment history...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <History className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <div className="text-sm font-extrabold text-slate-800 dark:text-white">
                No Payment Transactions Found
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {payments.length === 0
                  ? 'You have not initiated any course registration payment yet.'
                  : 'No payment records match your current search or status filter.'}
              </p>
              {payments.length === 0 && (
                <button
                  type="button"
                  onClick={onOpenCourseRegistration}
                  className="px-4 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 min-h-[40px]"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Go to Course Registration</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Compact Cards */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filtered.map((item) => {
                  const isSuccess = item.paymentStatus === 'successful';
                  const isPending = item.paymentStatus === 'pending';
                  const isActiveReg = item.registrationStatus === 'active';

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-3.5 space-y-2.5 bg-slate-50/40 dark:bg-slate-800/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-[#0b337a] dark:text-blue-300">
                            {item.courseCode}
                          </div>
                          <div className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
                            {item.courseTitle}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                            {formatCurrency(
                              item.totalAmountCharged ?? item.amount,
                              item.currency
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(item.paidAt || item.createdAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 break-all">
                          {item.paymentReference}
                        </span>
                        <CopyReferenceButton reference={item.paymentReference} compact />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 font-extrabold uppercase ${
                            isSuccess
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : isPending
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {isSuccess ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : isPending ? (
                            <Clock className="w-3.5 h-3.5" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5" />
                          )}
                          <span>Payment: {item.paymentStatus}</span>
                        </span>

                        <span
                          className={`font-extrabold uppercase ${
                            isActiveReg
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          Reg: {isActiveReg ? 'ACTIVE' : 'NOT ACTIVATED'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {isSuccess ? (
                          <button
                            type="button"
                            disabled={loadingReceiptId === item.id}
                            onClick={() => void handleOpenReceipt(item.id)}
                            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 min-h-[38px]"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>
                              {loadingReceiptId === item.id ? 'Loading...' : 'View Receipt'}
                            </span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onOpenVerifyReference(item.paymentReference)}
                              className="flex-1 py-2 px-3 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 min-h-[38px]"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Verify Payment</span>
                            </button>
                            {isPending && item.authorizationUrl && (
                              <a
                                href={item.authorizationUrl}
                                className="py-2 px-3 rounded-xl border border-[#c6daf7] dark:border-slate-700 text-xs font-bold text-[#0b337a] dark:text-blue-300 inline-flex items-center gap-1 min-h-[38px]"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Paystack</span>
                              </a>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#eff5ff] dark:bg-slate-800 text-[#082252] dark:text-slate-200 font-extrabold uppercase tracking-wider">
                    <tr>
                      <th className="px-3.5 py-2.5">Course</th>
                      <th className="px-3.5 py-2.5">Payment Reference</th>
                      <th className="px-3.5 py-2.5">Amount</th>
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5">Payment</th>
                      <th className="px-3.5 py-2.5">Registration</th>
                      <th className="px-3.5 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filtered.map((item) => {
                      const isSuccess = item.paymentStatus === 'successful';
                      const isPending = item.paymentStatus === 'pending';
                      const isActiveReg = item.registrationStatus === 'active';

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                        >
                          <td className="px-3.5 py-2.5">
                            <div className="font-extrabold text-[#0b337a] dark:text-blue-300">
                              {item.courseCode}
                            </div>
                            <div className="text-slate-700 dark:text-slate-300 font-semibold max-w-[200px] truncate">
                              {item.courseTitle}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <div className="flex flex-col items-start gap-1">
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                {item.paymentReference}
                              </span>
                              <CopyReferenceButton reference={item.paymentReference} compact />
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 font-extrabold tabular-nums text-slate-900 dark:text-white">
                            {formatCurrency(
                              item.totalAmountCharged ?? item.amount,
                              item.currency
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 tabular-nums text-slate-600 dark:text-slate-400">
                            {new Date(item.paidAt || item.createdAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span
                              className={`font-extrabold uppercase ${
                                isSuccess
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : isPending
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {item.paymentStatus}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span
                              className={`font-extrabold uppercase ${
                                isActiveReg
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {isActiveReg ? 'ACTIVE' : 'NOT ACTIVATED'}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {isSuccess ? (
                                <button
                                  type="button"
                                  disabled={loadingReceiptId === item.id}
                                  onClick={() => void handleOpenReceipt(item.id)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold inline-flex items-center gap-1 min-h-[34px]"
                                >
                                  <Receipt className="w-3.5 h-3.5" />
                                  <span>
                                    {loadingReceiptId === item.id ? 'Loading...' : 'View Receipt'}
                                  </span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => onOpenVerifyReference(item.paymentReference)}
                                    className="px-3 py-1.5 rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white font-extrabold inline-flex items-center gap-1 min-h-[34px]"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>Verify</span>
                                  </button>
                                  {isPending && item.authorizationUrl && (
                                    <a
                                      href={item.authorizationUrl}
                                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold inline-flex items-center gap-1 min-h-[34px]"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span>Pay</span>
                                    </a>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
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
