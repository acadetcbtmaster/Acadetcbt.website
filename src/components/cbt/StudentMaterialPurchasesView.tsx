import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Lock,
  Receipt,
  RefreshCw,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { StudentMaterialPurchaseItem } from '../../types/cbt';
import { AcadetCrest } from './AcadetLogo';
import { CopyReferenceButton } from './CopyReferenceButton';
import { formatCurrency } from './CourseRegistrationView';

interface StudentMaterialPurchasesViewProps {
  refreshTrigger?: number;
  onBrowseMaterials: () => void;
  onRegisterCourse?: (courseId: string) => void;
}

export const StudentMaterialPurchasesView: React.FC<StudentMaterialPurchasesViewProps> = ({
  refreshTrigger = 0,
  onBrowseMaterials,
  onRegisterCourse,
}) => {
  const [purchases, setPurchases] = useState<StudentMaterialPurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadPurchases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.materials.myPurchases();
      setPurchases(res.purchases || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load your study material purchases.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPurchases();
  }, [loadPurchases, refreshTrigger]);

  const handleDownload = async (item: StudentMaterialPurchaseItem) => {
    setDownloadingId(item.id);
    setError(null);
    setNotice(null);
    try {
      const res = await api.materials.requestDownload(item.materialId);
      await api.materials.downloadFile(res.downloadUrl, res.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download material.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleVerifyPending = async (item: StudentMaterialPurchaseItem) => {
    setBusyId(item.id);
    setError(null);
    setNotice(null);
    try {
      const outcome = await api.materials.verifyPayment(item.paymentReference, 'student_manual');
      setNotice(outcome.message);
      await loadPurchases();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setBusyId(null);
    }
  };

  const successfulCount = purchases.filter((p) => p.paymentStatus === 'successful').length;
  const totalSpent = purchases
    .filter((p) => p.paymentStatus === 'successful')
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="bg-[#0b337a] text-white px-4 sm:px-5 py-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <AcadetCrest className="w-8 h-8 shrink-0" />
          <Receipt className="w-5 h-5 shrink-0" />
          <div>
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight leading-tight">
              Study Material Purchases
            </h2>
            <p className="text-[11px] sm:text-xs text-blue-100">
              All paid study materials, receipts, and instant re-downloads
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBrowseMaterials}
            className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Study Materials</span>
          </button>
          <button
            type="button"
            onClick={() => void loadPurchases()}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-[#eff5ff]/70 dark:bg-slate-800/60 p-3.5">
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Unlocked Materials
            </div>
            <div className="text-xl font-extrabold text-[#0b337a] dark:text-blue-400 tabular-nums mt-0.5">
              {successfulCount}
            </div>
          </div>
          <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-[#eff5ff]/70 dark:bg-slate-800/60 p-3.5">
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Total Material Spend
            </div>
            <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
              {formatCurrency(totalSpent, 'NGN')}
            </div>
          </div>
          <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-[#eff5ff]/70 dark:bg-slate-800/60 p-3.5">
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Total Transactions
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {purchases.length}
            </div>
          </div>
        </div>

        {notice && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3.5 py-2.5 text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span className="font-semibold break-words [overflow-wrap:anywhere]">{notice}</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3.5 py-2.5 text-xs sm:text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words [overflow-wrap:anywhere]">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading your study material purchase records...
          </div>
        ) : purchases.length === 0 ? (
          <div className="py-12 text-center space-y-3 text-slate-500 dark:text-slate-400">
            <FileText className="w-9 h-9 mx-auto opacity-60" />
            <div className="text-sm font-semibold">
              You have not purchased any paid study materials yet.
            </div>
            <button
              type="button"
              onClick={onBrowseMaterials}
              className="px-4 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold"
            >
              Browse Study Materials
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-[#dce6f5] dark:border-slate-800 rounded-xl overflow-hidden">
            {purchases.map((p) => {
              const dateLabel = new Date(p.paidAt || p.createdAt).toLocaleString();
              return (
                <div
                  key={p.id}
                  className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white break-words">
                        {p.materialTitle}
                      </span>
                      {p.paymentStatus === 'successful' ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-extrabold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Successful</span>
                        </span>
                      ) : p.paymentStatus === 'pending' ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-extrabold inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Pending</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 text-[11px] font-extrabold capitalize">
                          {p.paymentStatus}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {p.courseCode
                        ? `${p.courseCode} — ${p.courseTitle}`
                        : 'General Study Resource'}{' '}
                      · {p.category} · {p.fileType}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs pt-0.5">
                      <span className="font-extrabold text-[#0a58ed] dark:text-blue-400 tabular-nums">
                        {formatCurrency(p.amount, p.currency)}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">{dateLabel}</span>
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        {p.paymentReference}
                        <CopyReferenceButton reference={p.paymentReference} />
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {p.canDownload ? (
                      <button
                        type="button"
                        disabled={downloadingId === p.id}
                        onClick={() => void handleDownload(p)}
                        className="px-4 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold inline-flex items-center gap-1.5 min-h-[38px] disabled:opacity-60"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>
                          {downloadingId === p.id
                            ? 'Preparing...'
                            : p.fileType === 'PDF'
                              ? 'Download PDF'
                              : 'Download'}
                        </span>
                      </button>
                    ) : p.paymentStatus === 'successful' && !p.isCourseRegistered ? (
                      onRegisterCourse && p.courseId ? (
                        <button
                          type="button"
                          onClick={() => onRegisterCourse(p.courseId!)}
                          className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 min-h-[38px]"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Course Registration Required</span>
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                          Course Registration Required
                        </span>
                      )
                    ) : p.paymentStatus === 'successful' && !p.isMaterialPublished ? (
                      <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
                        Temporarily Unpublished
                      </span>
                    ) : p.paymentStatus === 'pending' ? (
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => void handleVerifyPending(p)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 min-h-[38px] disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${busyId === p.id ? 'animate-spin' : ''}`}
                        />
                        <span>{busyId === p.id ? 'Verifying...' : 'Verify Payment'}</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
