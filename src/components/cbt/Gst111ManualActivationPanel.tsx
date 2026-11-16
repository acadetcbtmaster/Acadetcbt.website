import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  KeyRound,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  UserCheck,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type {
  Gst111ActivationHistoryItem,
  Gst111CourseInfo,
  Gst111StudentStatusItem,
} from '../../types/cbt';
import { CopyReferenceButton } from './CopyReferenceButton';
import { formatCurrency } from './CourseRegistrationView';

interface Gst111ManualActivationPanelProps {
  onCatalogUpdated: () => Promise<void>;
  onOpenFullProfile?: (studentId: string) => void;
}

export const Gst111ManualActivationPanel: React.FC<Gst111ManualActivationPanelProps> = ({
  onCatalogUpdated,
  onOpenFullProfile,
}) => {
  const [gst111Course, setGst111Course] = useState<Gst111CourseInfo | null>(null);
  const [students, setStudents] = useState<Gst111StudentStatusItem[]>([]);
  const [recentHistory, setRecentHistory] = useState<Gst111ActivationHistoryItem[]>([]);
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeSubscriptions: 0,
    adminActivatedCount: 0,
    paystackActivatedCount: 0,
    lockedCount: 0,
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'locked' | 'admin_manual'>(
    'all'
  );
  const [loading, setLoading] = useState(true);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Selected student inspection & per-student history
  const [selectedStudent, setSelectedStudent] = useState<Gst111StudentStatusItem | null>(null);
  const [studentHistory, setStudentHistory] = useState<Gst111ActivationHistoryItem[]>([]);
  const [loadingStudentHistory, setLoadingStudentHistory] = useState(false);

  // Optional activation note per selected student
  const [activationNote, setActivationNote] = useState('');

  // Confirmation modal before deactivating an active GST 111 subscription
  const [deactivateTarget, setDeactivateTarget] = useState<Gst111StudentStatusItem | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');

  const loadGst111Data = useCallback(
    async (nextSearch = search, nextStatus = statusFilter) => {
      setLoading(true);
      try {
        const res = await api.admin.gst111.listStudents({
          search: nextSearch.trim() || undefined,
          status: nextStatus,
        });
        setGst111Course(res.gst111Course);
        setStudents(res.students);
        setRecentHistory(res.recentHistory);
        setStats(res.stats);

        setSelectedStudent((prev) => {
          if (!prev) return res.students[0] || null;
          return res.students.find((s) => s.studentId === prev.studentId) || prev;
        });
      } catch (err) {
        setFeedback({
          type: 'err',
          text:
            err instanceof Error
              ? err.message
              : 'Unable to load GST 111 manual subscription controls.',
        });
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter]
  );

  const loadSelectedStudentHistory = useCallback(async (studentId: string) => {
    setLoadingStudentHistory(true);
    try {
      const res = await api.admin.gst111.getStudentHistory(studentId);
      setStudentHistory(res.history);
    } catch {
      setStudentHistory([]);
    } finally {
      setLoadingStudentHistory(false);
    }
  }, []);

  useEffect(() => {
    void loadGst111Data('', 'all');
  }, [loadGst111Data]);

  useEffect(() => {
    if (selectedStudent) {
      void loadSelectedStudentHistory(selectedStudent.studentId);
    } else {
      setStudentHistory([]);
    }
  }, [selectedStudent, loadSelectedStudentHistory]);

  const handleActivateStudent = async (student: Gst111StudentStatusItem) => {
    if (!gst111Course) {
      setFeedback({
        type: 'err',
        text: 'GST 111 course was not found in the database. Create GST 111 under Courses first.',
      });
      return;
    }

    setBusyStudentId(student.studentId);
    setFeedback(null);
    try {
      const res = await api.admin.gst111.activate({
        studentId: student.studentId,
        courseId: gst111Course.id,
        courseCode: gst111Course.code,
        note:
          selectedStudent?.studentId === student.studentId && activationNote.trim()
            ? activationNote.trim()
            : undefined,
      });
      setActivationNote('');
      setFeedback({ type: 'ok', text: res.message });
      await Promise.all([
        loadGst111Data(search, statusFilter),
        loadSelectedStudentHistory(student.studentId),
        onCatalogUpdated(),
      ]);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to activate GST 111 subscription.',
      });
    } finally {
      setBusyStudentId(null);
    }
  };

  const handleConfirmDeactivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deactivateTarget || !gst111Course) return;

    const target = deactivateTarget;
    setBusyStudentId(target.studentId);
    setFeedback(null);
    try {
      const res = await api.admin.gst111.deactivate({
        studentId: target.studentId,
        courseId: gst111Course.id,
        courseCode: gst111Course.code,
        reason: deactivateReason.trim() || undefined,
      });
      setDeactivateTarget(null);
      setDeactivateReason('');
      setFeedback({ type: 'ok', text: res.message });
      await Promise.all([
        loadGst111Data(search, statusFilter),
        loadSelectedStudentHistory(target.studentId),
        onCatalogUpdated(),
      ]);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to deactivate GST 111 subscription.',
      });
    } finally {
      setBusyStudentId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Strict GST 111 Restriction Notice */}
      <div className="rounded-xl border border-[#c6daf7] dark:border-slate-700 bg-gradient-to-r from-[#eff5ff] to-[#e4eefe] dark:from-slate-800/80 dark:to-slate-900 p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0b337a] text-white flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-extrabold text-[#082252] dark:text-white">
                  Manual Subscription Activation
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#0b337a] text-white text-[11px] font-extrabold tracking-wide">
                  <ShieldCheck className="w-3 h-3" />
                  GST 111 ONLY
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Search any registered student by Registration Code, email, username, or name to activate or lock their <strong>GST 111</strong> access individually.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => void loadGst111Data(search, statusFilter)}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-[#c6daf7] dark:border-slate-700 text-xs font-bold text-[#0b337a] dark:text-blue-300 inline-flex items-center gap-1.5 hover:bg-blue-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="rounded-lg bg-white/80 dark:bg-slate-900/70 border border-[#d6e4fa] dark:border-slate-700 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-[#0a58ed] dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <strong>Strict Course Scope:</strong> Manual activation applies exclusively to{' '}
            <strong>
              {gst111Course ? `${gst111Course.code} — ${gst111Course.title}` : 'GST 111'}
            </strong>
            . All other courses continue to enforce standard Paystack payment checkout, and manual activations are recorded internally as <strong>Admin Activated</strong> without creating Paystack revenue entries.
          </div>
        </div>
      </div>

      {!loading && !gst111Course && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <span>
            No <strong>GST 111</strong> course record was found in the Courses table. Create or publish <strong>GST 111</strong> under the <strong>Courses</strong> tab before manually activating subscriptions.
          </span>
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold border flex items-start gap-2 ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}
        >
          {feedback.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* GST 111 Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
        {[
          { label: 'Total Students', val: stats.totalStudents, color: 'text-[#082252] dark:text-white' },
          { label: 'GST 111 Active', val: stats.activeSubscriptions, color: 'text-emerald-700 dark:text-emerald-400' },
          { label: 'Admin Activated', val: stats.adminActivatedCount, color: 'text-[#0a58ed] dark:text-blue-400' },
          { label: 'Paystack Paid', val: stats.paystackActivatedCount, color: 'text-teal-700 dark:text-teal-400' },
          { label: 'Locked / Unpaid', val: stats.lockedCount, color: 'text-amber-700 dark:text-amber-400' },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
          >
            <div className={`text-lg sm:text-xl font-extrabold tabular-nums ${item.color}`}>
              {item.val}
            </div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              {item.label}
            </div>
          </div>
        ))}
      </div>

      {/* Search & Status Filter */}
      <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/70 border border-[#d6e4fa] dark:border-slate-700 p-3.5 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void loadGst111Data(search, statusFilter);
              }
            }}
            placeholder="Search by Registration Code (e.g. ACD-...), name, email, username, or WhatsApp..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-semibold"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-x-auto">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active' },
                { id: 'admin_manual', label: 'Admin Activated' },
                { id: 'locked', label: 'Locked' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setStatusFilter(f.id);
                  void loadGst111Data(search, f.id);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap transition-colors ${
                  statusFilter === f.id
                    ? 'bg-[#0a58ed] text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void loadGst111Data(search, statusFilter)}
            className="px-3.5 py-2 rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold"
          >
            Search
          </button>
        </div>
      </div>

      {/* Main Split: Student Directory + Selected Student Detail & Per-Student History */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Left: Registered Students List */}
        <div className="xl:col-span-7 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
          <div className="bg-slate-50 dark:bg-slate-800/70 px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            <span>Registered Students ({students.length})</span>
            <span>GST 111 Control</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs sm:text-sm text-slate-500">
              Loading registered students and GST 111 status...
            </div>
          ) : students.length === 0 ? (
            <div className="py-12 text-center text-xs sm:text-sm text-slate-500 px-4">
              No registered student accounts match your search query.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[560px] overflow-y-auto">
              {students.map((s) => {
                const isSelected = selectedStudent?.studentId === s.studentId;
                const isBusy = busyStudentId === s.studentId;
                const isUnlocked = s.gst111Status === 'active';

                return (
                  <div
                    key={s.studentId}
                    onClick={() => setSelectedStudent(s)}
                    className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#eff5ff]/90 dark:bg-blue-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-[#0b337a]/10 dark:bg-blue-900/50 text-[#0b337a] dark:text-blue-300">
                          {s.registrationCode}
                        </span>
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                          {s.fullName}
                        </span>
                        {isUnlocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-extrabold">
                            <CheckCircle2 className="w-3 h-3" />
                            Active · {s.activationSource === 'admin_manual' ? 'Admin Activated' : 'Paystack Paid'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-extrabold">
                            <Lock className="w-3 h-3" />
                            Inactive / Locked
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="truncate">{s.email}</span>
                        <span>@{s.username}</span>
                        {s.whatsappNumber && (
                          <span className="tabular-nums">WhatsApp: {s.whatsappNumber}</span>
                        )}
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isUnlocked ? (
                        <button
                          type="button"
                          disabled={isBusy || !gst111Course}
                          onClick={() => {
                            setSelectedStudent(s);
                            setDeactivateTarget(s);
                            setDeactivateReason('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Deactivate Subscription</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy || !gst111Course}
                          onClick={() => {
                            setSelectedStudent(s);
                            void handleActivateStudent(s);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>{isBusy ? 'Activating...' : 'Activate Subscription'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Selected Student Inspection & Audit History */}
        <div className="xl:col-span-5 rounded-xl border border-[#d6e4fa] dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          {!selectedStudent ? (
            <div className="p-6 text-center text-xs sm:text-sm text-slate-500">
              Select a student on the left to inspect registered details, GST 111 status, and activation history.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              <div className="bg-[#0b337a] text-white px-4 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold truncate">
                    {selectedStudent.fullName}
                  </div>
                  <div className="text-[11px] text-blue-100 font-mono">
                    Reg Code: {selectedStudent.registrationCode}
                  </div>
                </div>
                {onOpenFullProfile && (
                  <button
                    type="button"
                    onClick={() => onOpenFullProfile(selectedStudent.studentId)}
                    className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold inline-flex items-center gap-1 shrink-0"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Full Profile</span>
                  </button>
                )}
              </div>

              <div className="p-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-slate-500 block">Registration Code</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono font-extrabold text-[#0b337a] dark:text-blue-300">
                        {selectedStudent.registrationCode}
                      </span>
                      <CopyReferenceButton
                        reference={selectedStudent.registrationCode}
                        compact
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Account Status</span>
                    <span
                      className={`font-extrabold ${
                        selectedStudent.isActive
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {selectedStudent.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Email</span>
                    <span className="font-semibold break-all text-slate-900 dark:text-white">
                      {selectedStudent.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">WhatsApp</span>
                    <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                      {selectedStudent.whatsappNumber || '—'}
                    </span>
                  </div>
                </div>

                {/* Current GST 111 Status Card */}
                <div
                  className={`rounded-xl border p-3 space-y-2 ${
                    selectedStudent.gst111Status === 'active'
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30'
                      : 'border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {selectedStudent.subscriptionLabel}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-extrabold ${
                        selectedStudent.gst111Status === 'active'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-600 text-white'
                      }`}
                    >
                      {selectedStudent.gst111Status === 'active' ? 'ACTIVE' : 'LOCKED'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 dark:text-slate-300 space-y-0.5">
                    <div>
                      <strong>Payment / Access Status:</strong>{' '}
                      {selectedStudent.paymentStatusLabel}
                    </div>
                    {gst111Course && (
                      <div>
                        <strong>Course Price:</strong>{' '}
                        {formatCurrency(gst111Course.registrationFee, gst111Course.currency)} (bypassed when Admin Activated)
                      </div>
                    )}
                    {selectedStudent.lastActionAt && (
                      <div>
                        <strong>Last Updated:</strong>{' '}
                        {new Date(selectedStudent.lastActionAt).toLocaleString()}
                        {selectedStudent.lastActionByName
                          ? ` by ${selectedStudent.lastActionByName}`
                          : ''}
                      </div>
                    )}
                  </div>

                  {selectedStudent.gst111Status === 'locked' ? (
                    <div className="space-y-2 pt-1">
                      <input
                        type="text"
                        value={activationNote}
                        onChange={(e) => setActivationNote(e.target.value)}
                        placeholder="Optional admin activation note (e.g. Verified offline payment)"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        disabled={
                          busyStudentId === selectedStudent.studentId || !gst111Course
                        }
                        onClick={() => void handleActivateStudent(selectedStudent)}
                        className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>
                          {busyStudentId === selectedStudent.studentId
                            ? 'Activating GST 111...'
                            : 'Activate GST 111 Subscription'}
                        </span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        busyStudentId === selectedStudent.studentId || !gst111Course
                      }
                      onClick={() => {
                        setDeactivateTarget(selectedStudent);
                        setDeactivateReason('');
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 mt-1"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Deactivate GST 111 Subscription</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Per-Student Activation History */}
              <div className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    <span>Student GST 111 Activation History ({studentHistory.length})</span>
                  </h4>
                </div>

                {loadingStudentHistory ? (
                  <div className="text-xs text-slate-500 py-3">Loading history...</div>
                ) : studentHistory.length === 0 ? (
                  <div className="text-xs text-slate-500 py-3">
                    No manual activation or deactivation actions recorded for this student yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {studentHistory.map((h) => (
                      <div
                        key={h.id}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 text-xs space-y-1 bg-slate-50/70 dark:bg-slate-800/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1 font-extrabold capitalize ${
                              h.action === 'activated'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {h.action === 'activated' ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <Clock className="w-3.5 h-3.5" />
                            )}
                            {h.action} ({h.courseCode})
                          </span>
                          <span className="text-[11px] text-slate-500 tabular-nums">
                            {new Date(h.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-slate-700 dark:text-slate-300">
                          Admin: <strong>{h.adminName}</strong> ({h.adminEmail})
                        </div>
                        {h.reason && (
                          <div className="text-slate-600 dark:text-slate-400 italic">
                            Note: {h.reason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Audit Log Table for GST 111 Manual Actions */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
        <div className="bg-slate-50 dark:bg-slate-800/70 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h4 className="text-xs sm:text-sm font-extrabold text-[#082252] dark:text-white flex items-center gap-1.5">
            <History className="w-4 h-4 text-[#0a58ed]" />
            <span>Recent GST 111 Manual Activation &amp; Deactivation Audit Log</span>
          </h4>
          <span className="text-xs font-bold text-slate-500 tabular-nums">
            {recentHistory.length} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 dark:bg-slate-800/50 font-extrabold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-3.5 py-2.5">Reg Code</th>
                <th className="px-3.5 py-2.5">Student</th>
                <th className="px-3.5 py-2.5">Course</th>
                <th className="px-3.5 py-2.5">Action</th>
                <th className="px-3.5 py-2.5">Authorized Admin</th>
                <th className="px-3.5 py-2.5">Note / Reason</th>
                <th className="px-3.5 py-2.5">Date &amp; Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {recentHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No manual GST 111 activation or deactivation events have been recorded yet.
                  </td>
                </tr>
              ) : (
                recentHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-3.5 py-2.5 font-mono font-extrabold text-[#0b337a] dark:text-blue-300">
                      {h.studentRegistrationCode || '—'}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {h.studentName}
                      </div>
                      <div className="text-[11px] text-slate-500">{h.studentEmail}</div>
                    </td>
                    <td className="px-3.5 py-2.5 font-extrabold">{h.courseCode}</td>
                    <td className="px-3.5 py-2.5">
                      {h.action === 'activated' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-extrabold">
                          <CheckCircle2 className="w-3 h-3" />
                          Activated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300 font-extrabold">
                          <Lock className="w-3 h-3" />
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <div className="font-bold">{h.adminName}</div>
                      <div className="text-[11px] text-slate-500">{h.adminEmail}</div>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400 max-w-xs">
                      {h.reason || '—'}
                    </td>
                    <td className="px-3.5 py-2.5 tabular-nums whitespace-nowrap text-slate-500">
                      {new Date(h.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal Before Deactivating Active GST 111 Subscription */}
      {deactivateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 shadow-2xl overflow-hidden">
            <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-sm sm:text-base font-extrabold">
                  Confirm GST 111 Deactivation
                </h3>
              </div>
              <button
                type="button"
                disabled={busyStudentId === deactivateTarget.studentId}
                onClick={() => setDeactivateTarget(null)}
                className="p-1 rounded-lg hover:bg-white/15"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmDeactivate} className="p-4 space-y-3">
              <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 text-xs text-red-800 dark:text-red-200 space-y-1">
                <div className="font-extrabold">
                  Are you sure you want to deactivate GST 111 access for this student?
                </div>
                <p>
                  <strong>{deactivateTarget.fullName}</strong> ({deactivateTarget.registrationCode}) will immediately lose access to GST 111 CBT exams and their subscription status will become <strong>Inactive / Locked</strong> until they pay or an admin activates it again.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Deactivation (Optional, recorded in audit log)
                </label>
                <textarea
                  rows={2}
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value)}
                  placeholder="e.g. Temporary manual access period ended"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={busyStudentId === deactivateTarget.studentId}
                  onClick={() => setDeactivateTarget(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyStudentId === deactivateTarget.studentId}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>
                    {busyStudentId === deactivateTarget.studentId
                      ? 'Deactivating...'
                      : 'Confirm Deactivation'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
