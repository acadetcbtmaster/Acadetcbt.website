import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Lock,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type {
  MaterialCategory,
  MaterialPaymentInitResponse,
  StudyMaterialCourseSummary,
  StudyMaterialItem,
} from '../../types/cbt';
import { AcadetCrest } from './AcadetLogo';
import { CopyReferenceButton } from './CopyReferenceButton';
import { formatCurrency } from './CourseRegistrationView';

interface StudyMaterialsViewProps {
  selectedCourseId?: string | null;
  compact?: boolean;
  onExploreMore?: () => void;
  onRegisterCourse?: (courseId: string) => void;
  onOpenPurchases?: () => void;
  refreshTrigger?: number;
}

const SUB_CATEGORIES: Array<'All' | MaterialCategory> = [
  'All',
  'Lecture Notes',
  'Handouts',
  'Past Questions',
  'Practical Guides',
  'Tutorials',
  'Notes',
  'Guides',
];

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadDate(raw: string): string {
  try {
    return new Date(raw).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export const StudyMaterialsView: React.FC<StudyMaterialsViewProps> = ({
  selectedCourseId,
  compact = false,
  onExploreMore,
  onRegisterCourse,
  onOpenPurchases,
  refreshTrigger = 0,
}) => {
  // 'GENERAL' represents courseId === null; UUID represents a specific course; null means Course Grid View
  const [openedCourseKey, setOpenedCourseKey] = useState<string | null>(null);
  const [courseSearch, setCourseSearch] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [levelFilter, setLevelFilter] = useState('All');
  const [semesterFilter, setSemesterFilter] = useState('All');

  const [materialSearch, setMaterialSearch] = useState('');
  const [subCategory, setSubCategory] = useState<'All' | MaterialCategory>('All');

  const [courseSummaries, setCourseSummaries] = useState<StudyMaterialCourseSummary[]>([]);
  const [materials, setMaterials] = useState<StudyMaterialItem[]>([]);
  const [courseLocked, setCourseLocked] = useState(false);
  const [lockedCourseInfo, setLockedCourseInfo] =
    useState<StudyMaterialCourseSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Per-PDF Paystack Payment Modal state
  const [payTarget, setPayTarget] = useState<StudyMaterialItem | null>(null);
  const [checkoutData, setCheckoutData] = useState<MaterialPaymentInitResponse | null>(null);
  const [initializingPay, setInitializingPay] = useState(false);
  const [verifyingRef, setVerifyingRef] = useState(false);
  const [manualVerifyOpen, setManualVerifyOpen] = useState(false);
  const [manualVerifyRefInput, setManualVerifyRefInput] = useState('');
  const [modalFeedback, setModalFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const loadMaterialsData = useCallback(
    async (courseKeyToFetch: string | null = openedCourseKey) => {
      setLoading(true);
      setError(null);
      try {
        const queryCourseId = compact
          ? selectedCourseId || undefined
          : courseKeyToFetch === 'GENERAL'
            ? 'general'
            : courseKeyToFetch || undefined;

        const res = await api.materials.list(
          queryCourseId ? { courseId: queryCourseId } : undefined
        );
        setCourseSummaries(res.courseSummaries || []);
        setMaterials(res.materials || []);
        setCourseLocked(Boolean(res.courseLocked || res.courseRegistrationRequired));
        setLockedCourseInfo(res.lockedCourse || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to fetch study materials.');
      } finally {
        setLoading(false);
      }
    },
    [compact, selectedCourseId, openedCourseKey]
  );

  useEffect(() => {
    void loadMaterialsData(openedCourseKey);
  }, [loadMaterialsData, openedCourseKey, refreshTrigger]);

  const hierarchyOptions = useMemo(() => {
    const faculties = new Set<string>();
    const departments = new Set<string>();
    const levels = new Set<string>();
    const semesters = new Set<string>();
    for (const c of courseSummaries) {
      if (c.faculty) faculties.add(c.faculty);
      if (c.department) departments.add(c.department);
      if (c.level) levels.add(c.level);
      if (c.semester) semesters.add(c.semester);
    }
    return {
      faculties: ['All', ...Array.from(faculties).sort()],
      departments: ['All', ...Array.from(departments).sort()],
      levels: ['All', ...Array.from(levels).sort()],
      semesters: ['All', ...Array.from(semesters).sort()],
    };
  }, [courseSummaries]);

  const filteredCourseCards = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    return courseSummaries.filter((c) => {
      if (facultyFilter !== 'All' && (c.faculty || 'General') !== facultyFilter) return false;
      if (departmentFilter !== 'All' && (c.department || 'General') !== departmentFilter) {
        return false;
      }
      if (levelFilter !== 'All' && c.level !== levelFilter) return false;
      if (semesterFilter !== 'All' && (c.semester || 'First Semester') !== semesterFilter) {
        return false;
      }
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.level.toLowerCase().includes(q) ||
        (c.department || '').toLowerCase().includes(q) ||
        (c.faculty || '').toLowerCase().includes(q)
      );
    });
  }, [
    courseSummaries,
    courseSearch,
    facultyFilter,
    departmentFilter,
    levelFilter,
    semesterFilter,
  ]);

  const activeCourseSummary = useMemo(() => {
    if (!openedCourseKey) return null;
    if (openedCourseKey === 'GENERAL') {
      return courseSummaries.find((c) => c.courseId === null) || null;
    }
    return (
      courseSummaries.find((c) => c.courseId === openedCourseKey) ||
      lockedCourseInfo ||
      null
    );
  }, [courseSummaries, openedCourseKey, lockedCourseInfo]);

  const courseMaterials = useMemo(() => {
    if (compact) {
      return materials.slice(0, 5);
    }
    if (!openedCourseKey || courseLocked) return [];
    const q = materialSearch.trim().toLowerCase();
    return materials.filter((item) => {
      const matchesCourse =
        openedCourseKey === 'GENERAL'
          ? item.courseId === null
          : item.courseId === openedCourseKey;
      if (!matchesCourse) return false;
      if (subCategory !== 'All' && item.category !== subCategory) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [compact, materials, openedCourseKey, courseLocked, subCategory, materialSearch]);

  const openCourseFolder = (course: StudyMaterialCourseSummary) => {
    const nextKey = course.courseId === null ? 'GENERAL' : course.courseId;
    setOpenedCourseKey(nextKey);
    setSubCategory('All');
    setMaterialSearch('');
    setError(null);
    setNotice(null);
  };

  const handleOpenPayModal = (item: StudyMaterialItem) => {
    setPayTarget(item);
    setCheckoutData(null);
    setModalFeedback(null);
  };

  const handleClosePayModal = () => {
    setPayTarget(null);
    setCheckoutData(null);
    setModalFeedback(null);
  };

  const handleStartPaystackCheckout = async () => {
    if (!payTarget) return;
    setInitializingPay(true);
    setModalFeedback(null);
    try {
      const init = await api.materials.initializePayment(payTarget.id);
      setCheckoutData(init);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'MATERIAL_ALREADY_PURCHASED') {
        setModalFeedback({ type: 'ok', text: err.message });
        await loadMaterialsData(openedCourseKey);
      } else if (err instanceof ApiError && err.code === 'COURSE_REGISTRATION_REQUIRED') {
        setModalFeedback({ type: 'err', text: err.message });
        await loadMaterialsData(openedCourseKey);
      } else {
        setModalFeedback({
          type: 'err',
          text:
            err instanceof Error
              ? err.message
              : 'Unable to initialize Paystack checkout right now.',
        });
      }
    } finally {
      setInitializingPay(false);
    }
  };

  const handleVerifyMaterialReference = async (refToCheck: string) => {
    const cleanRef = refToCheck.trim();
    if (!cleanRef) {
      setModalFeedback({ type: 'err', text: 'Enter a valid Paystack reference.' });
      return;
    }
    setVerifyingRef(true);
    setModalFeedback(null);
    try {
      const outcome = await api.materials.verifyPayment(cleanRef, 'student_manual');
      if (outcome.unlocked) {
        setNotice(outcome.message);
        await loadMaterialsData(openedCourseKey);
        setPayTarget(null);
        setCheckoutData(null);
        setManualVerifyOpen(false);
        setManualVerifyRefInput('');
      } else {
        setModalFeedback({
          type: outcome.paymentStatus === 'pending' ? 'ok' : 'err',
          text: outcome.message,
        });
      }
    } catch (err) {
      setModalFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to verify material payment.',
      });
    } finally {
      setVerifyingRef(false);
    }
  };

  const handleDownload = async (item: StudyMaterialItem) => {
    if (!item.isFree && !item.isPurchased) {
      handleOpenPayModal(item);
      return;
    }

    setDownloadingId(item.id);
    setError(null);
    setNotice(null);
    try {
      const res = await api.materials.requestDownload(item.id);
      const anchor = document.createElement('a');
      anchor.href = res.downloadUrl;
      anchor.download = res.filename;
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      setMaterials((prev) =>
        prev.map((m) =>
          m.id === item.id ? { ...m, downloadCount: m.downloadCount + 1 } : m
        )
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === 'MATERIAL_PAYMENT_REQUIRED') {
        await loadMaterialsData(openedCourseKey);
        handleOpenPayModal(item);
      } else if (err instanceof ApiError && err.code === 'COURSE_REGISTRATION_REQUIRED') {
        await loadMaterialsData(openedCourseKey);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Download unavailable.');
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const renderMaterialRow = (item: StudyMaterialItem) => {
    const isDoc = item.fileType === 'DOC';
    const isImage = item.fileType === 'IMAGE';
    const isUnlocked = item.isFree || item.isPurchased;
    const priceLabel = item.isFree ? 'Free' : formatCurrency(item.price, item.currency);
    const downloadLabel = item.fileType === 'PDF' ? 'Download PDF' : 'Download';

    return (
      <div
        key={item.id}
        className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#9dc0f5] dark:hover:border-blue-800 transition-colors"
      >
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className={`w-10 h-11 rounded-lg flex flex-col items-center justify-center text-white font-extrabold text-[10px] shrink-0 ${
              isDoc ? 'bg-[#0a58ed]' : isImage ? 'bg-indigo-600' : 'bg-[#e03e3e]'
            }`}
          >
            <FileText className="w-4 h-4 mb-0.5" />
            <span>{item.fileType}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-extrabold text-sm text-slate-900 dark:text-white break-words">
                {item.title}
              </span>
              {item.isFree ? (
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-extrabold">
                  Free
                </span>
              ) : item.isPurchased ? (
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-extrabold inline-flex items-center gap-1">
                  <Unlock className="w-3 h-3" />
                  <span>Unlocked ({priceLabel})</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 text-[11px] font-extrabold inline-flex items-center gap-1 tabular-nums">
                  <Lock className="w-3 h-3" />
                  <span>{priceLabel}</span>
                </span>
              )}
            </div>
            {item.description && (
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 break-words">
                {item.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              <span className="font-bold text-slate-600 dark:text-slate-300">{item.category}</span>
              {compact && item.courseCode && <span>· {item.courseCode}</span>}
              <span>· {formatBytes(item.fileSizeBytes)}</span>
              <span className="inline-flex items-center gap-1">
                · <Calendar className="w-3 h-3" /> {formatUploadDate(item.createdAt)}
              </span>
              <span>· {item.downloadCount} downloads</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 shrink-0">
          {isUnlocked ? (
            <button
              type="button"
              disabled={downloadingId === item.id}
              onClick={() => void handleDownload(item)}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold shadow-xs inline-flex items-center justify-center gap-1.5 min-h-[38px] disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloadingId === item.id ? 'Preparing...' : downloadLabel}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleOpenPayModal(item)}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#0b337a] hover:bg-[#082252] text-white text-xs font-extrabold shadow-xs inline-flex items-center justify-center gap-1.5 min-h-[38px] tabular-nums"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Buy Now · {priceLabel}</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
        {/* Deep Navy Header Strip */}
        <div className="bg-[#0b337a] text-white px-4 sm:px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <AcadetCrest className="w-8 h-8 shrink-0" />
            <BookOpen className="w-5 h-5 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight leading-tight">
                Study Materials
              </h2>
              {!compact && (
                <p className="text-[11px] sm:text-xs text-blue-100 truncate">
                  {openedCourseKey && activeCourseSummary
                    ? `${activeCourseSummary.code} — ${activeCourseSummary.title}`
                    : 'Select a registered course folder to view and access study materials'}
                </p>
              )}
            </div>
          </div>

          {!compact && (
            <div className="flex flex-wrap items-center gap-2">
              {onOpenPurchases && (
                <button
                  type="button"
                  onClick={onOpenPurchases}
                  className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>My Purchases</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setModalFeedback(null);
                  setManualVerifyOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verify Material Payment</span>
              </button>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5 space-y-4 flex-1 flex flex-col">
          {notice && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3.5 py-2.5 text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold break-words [overflow-wrap:anywhere]">{notice}</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3.5 py-2.5 text-xs sm:text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words [overflow-wrap:anywhere]">{error}</span>
            </div>
          )}

          {compact ? (
            /* Compact Widget Mode (used inside ResultsView sidebar) */
            <div className="flex-1 space-y-2.5">
              {loading ? (
                <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Loading study materials...
                </div>
              ) : courseLocked && lockedCourseInfo ? (
                <div className="py-6 px-3 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 text-center space-y-2.5">
                  <Lock className="w-7 h-7 mx-auto text-amber-600 dark:text-amber-400" />
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {lockedCourseInfo.code} Registration Required
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    You need to register for this course before accessing its study materials.
                  </p>
                  {onRegisterCourse && lockedCourseInfo.courseId && (
                    <button
                      type="button"
                      onClick={() => onRegisterCourse(lockedCourseInfo.courseId!)}
                      className="px-4 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                    >
                      <span>Register Now</span>
                    </button>
                  )}
                </div>
              ) : courseMaterials.length === 0 ? (
                <div className="py-8 text-center space-y-2 text-slate-500 dark:text-slate-400">
                  <FolderOpen className="w-8 h-8 mx-auto opacity-60" />
                  <div className="text-sm font-semibold">
                    No study materials uploaded for this course yet.
                  </div>
                </div>
              ) : (
                courseMaterials.map(renderMaterialRow)
              )}
              {onExploreMore && (
                <button
                  type="button"
                  onClick={onExploreMore}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#eff5ff] dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 text-[#082252] dark:text-blue-300 font-bold text-sm transition-colors"
                >
                  Browse All Courses &amp; Materials →
                </button>
              )}
            </div>
          ) : !openedCourseKey ? (
            /* STAGE 1: Available Courses Selection Grid with Faculty/Dept/Level/Semester Organization */
            <div className="space-y-4">
              <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/80 border border-[#d6e4fa] dark:border-slate-700 px-4 py-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-900 border border-[#d6e4fa] dark:border-slate-700 flex items-center justify-center shrink-0 p-1">
                      <AcadetCrest className="w-9 h-9" frameOnDark={false} />
                    </div>
                    <div>
                      <div className="text-sm sm:text-base font-extrabold text-[#082252] dark:text-white">
                        Select a Course Folder
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        Registered courses open immediately. Course registration lets you browse materials; paid PDFs unlock individually via Paystack.
                      </div>
                    </div>
                  </div>

                  <div className="relative w-full sm:w-64 shrink-0">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                      placeholder="Search course code or title..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#c6daf7] dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm min-h-[38px] focus:outline-none focus:ring-2 focus:ring-[#0a58ed]"
                    />
                  </div>
                </div>

                {/* Faculty / Department / Level / Semester Filters */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#d6e4fa] dark:border-slate-700">
                  <select
                    aria-label="Filter by Faculty"
                    value={facultyFilter}
                    onChange={(e) => setFacultyFilter(e.target.value)}
                    className="rounded-lg border border-[#c6daf7] dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold"
                  >
                    {hierarchyOptions.faculties.map((f) => (
                      <option key={f} value={f}>
                        {f === 'All' ? 'All Faculties' : f}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter by Department"
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="rounded-lg border border-[#c6daf7] dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold"
                  >
                    {hierarchyOptions.departments.map((d) => (
                      <option key={d} value={d}>
                        {d === 'All' ? 'All Departments' : d}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter by Level"
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value)}
                    className="rounded-lg border border-[#c6daf7] dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold"
                  >
                    {hierarchyOptions.levels.map((l) => (
                      <option key={l} value={l}>
                        {l === 'All' ? 'All Levels' : l}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter by Semester"
                    value={semesterFilter}
                    onChange={(e) => setSemesterFilter(e.target.value)}
                    className="rounded-lg border border-[#c6daf7] dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold"
                  >
                    {hierarchyOptions.semesters.map((s) => (
                      <option key={s} value={s}>
                        {s === 'All' ? 'All Semesters' : s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  Loading available courses and materials...
                </div>
              ) : filteredCourseCards.length === 0 ? (
                <div className="py-12 text-center space-y-2 text-slate-500 dark:text-slate-400">
                  <FolderOpen className="w-9 h-9 mx-auto opacity-60" />
                  <div className="text-sm font-semibold">
                    No matching courses found.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredCourseCards.map((course) => {
                    const isAvailable = Boolean(course.isRegistered);
                    return (
                      <button
                        key={course.courseId ?? 'GENERAL'}
                        type="button"
                        onClick={() => openCourseFolder(course)}
                        className={`text-left rounded-2xl border bg-white dark:bg-slate-900 hover:shadow-md p-4 transition-all flex flex-col justify-between gap-3 group ${
                          isAvailable
                            ? 'border-[#dce6f5] dark:border-slate-800 hover:border-[#0a58ed] dark:hover:border-blue-500'
                            : 'border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-[#eff5ff] dark:bg-blue-950/60 text-[#0b337a] dark:text-blue-300 text-xs font-extrabold tracking-wide">
                              {course.code}
                            </span>
                            {isAvailable ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-extrabold inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Available</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 text-[11px] font-extrabold inline-flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                <span>Locked</span>
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug group-hover:text-[#0a58ed] dark:group-hover:text-blue-400 transition-colors">
                            {course.title}
                          </h3>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {[course.faculty, course.department, course.level, course.semester]
                              .filter((v) => v && v !== 'General')
                              .join(' · ') || `${course.level} · ${course.semester || 'First Semester'}`}
                          </div>
                        </div>

                        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-extrabold text-slate-700 dark:text-slate-200 tabular-nums">
                              {course.materialCount}{' '}
                              {course.materialCount === 1 ? 'File' : 'Files'}
                            </span>
                            {course.materialCount > 0 && (
                              <span className="text-slate-500 dark:text-slate-400">
                                ({course.freeCount} Free · {course.paidCount} Paid)
                              </span>
                            )}
                          </div>
                          <span className="inline-flex items-center gap-0.5 font-extrabold text-[#0a58ed] dark:text-blue-400 shrink-0">
                            <span>{isAvailable ? 'Open' : 'Unlock'}</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : courseLocked ? (
            /* STAGE 2A: COURSE REGISTRATION REQUIRED ACCESS RESTRICTION SCREEN */
            <div className="space-y-4">
              <div>
                <button
                  type="button"
                  onClick={() => setOpenedCourseKey(null)}
                  className="px-3 py-1.5 rounded-xl bg-[#eff5ff] dark:bg-slate-800 border border-[#c6daf7] dark:border-slate-700 text-[#0b337a] dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-slate-700 text-xs font-extrabold inline-flex items-center gap-1.5 min-h-[36px]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>All Courses</span>
                </button>
              </div>

              <div className="rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-gradient-to-br from-amber-50 via-white to-[#eff5ff] dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-6 sm:p-8 text-center max-w-xl mx-auto space-y-4 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-8 h-8" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-lg sm:text-xl font-extrabold text-[#082252] dark:text-white">
                    {activeCourseSummary?.code || 'Course'} Registration Required
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    You need to register for this course before accessing its study materials.
                  </p>
                </div>

                {activeCourseSummary && (
                  <div className="rounded-xl bg-white dark:bg-slate-800/80 border border-[#dce6f5] dark:border-slate-700 p-3.5 text-left text-xs space-y-1.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Course</span>
                      <span className="font-extrabold text-slate-900 dark:text-white text-right">
                        {activeCourseSummary.code} — {activeCourseSummary.title}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Academic Info</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 text-right">
                        {activeCourseSummary.level} · {activeCourseSummary.semester || 'First Semester'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Uploaded Files</span>
                      <span className="font-bold text-[#0b337a] dark:text-blue-300">
                        {activeCourseSummary.materialCount} materials ({activeCourseSummary.freeCount} Free ·{' '}
                        {activeCourseSummary.paidCount} Paid)
                      </span>
                    </div>
                    {typeof activeCourseSummary.registrationFee === 'number' &&
                      activeCourseSummary.registrationFee > 0 && (
                        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700 flex justify-between gap-2">
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            Course Registration Fee
                          </span>
                          <span className="font-extrabold text-[#0a58ed] dark:text-blue-400 tabular-nums">
                            {formatCurrency(
                              activeCourseSummary.registrationFee,
                              activeCourseSummary.currency || 'NGN'
                            )}
                          </span>
                        </div>
                      )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpenedCourseKey(null)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[42px]"
                  >
                    Back to Courses
                  </button>
                  {activeCourseSummary?.courseId && onRegisterCourse && (
                    <button
                      type="button"
                      onClick={() => onRegisterCourse(activeCourseSummary.courseId!)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold shadow-sm inline-flex items-center justify-center gap-1.5 min-h-[42px]"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Register Now</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* STAGE 2B: Selected Registered Course Materials & PDFs */
            <div className="space-y-4 flex-1 flex flex-col">
              <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/80 border border-[#d6e4fa] dark:border-slate-700 px-3.5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setOpenedCourseKey(null)}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-[#c6daf7] dark:border-slate-700 text-[#0b337a] dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800 text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 min-h-[36px]"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>All Courses</span>
                  </button>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm sm:text-base font-extrabold text-[#082252] dark:text-white truncate">
                        {activeCourseSummary
                          ? `${activeCourseSummary.code} — ${activeCourseSummary.title}`
                          : 'Course Materials'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold">
                        Registered
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {courseMaterials.length}{' '}
                      {courseMaterials.length === 1 ? 'material' : 'materials'} available · Paid PDFs require individual purchase to download
                    </div>
                  </div>
                </div>

                <div className="relative w-full sm:w-56 shrink-0">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    placeholder="Filter uploaded PDFs..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#c6daf7] dark:border-slate-700 bg-white dark:bg-slate-900 text-xs min-h-[36px] focus:outline-none focus:ring-2 focus:ring-[#0a58ed]"
                  />
                </div>
              </div>

              {/* Sub-category filter inside selected course */}
              <div className="flex flex-wrap items-center gap-2">
                {SUB_CATEGORIES.map((cat) => {
                  const active = subCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSubCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        active
                          ? 'bg-[#0a58ed] text-white shadow-xs'
                          : 'bg-[#eff5ff] dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 space-y-2.5">
                {loading ? (
                  <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    Loading uploaded PDFs...
                  </div>
                ) : courseMaterials.length === 0 ? (
                  <div className="py-10 text-center space-y-2.5 text-slate-500 dark:text-slate-400">
                    <FolderOpen className="w-9 h-9 mx-auto opacity-60" />
                    <div className="text-sm font-semibold">
                      No uploaded PDFs or study materials found in this course
                      {subCategory !== 'All' ? ` under ${subCategory}` : ''}.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (subCategory !== 'All' || materialSearch) {
                          setSubCategory('All');
                          setMaterialSearch('');
                        } else {
                          setOpenedCourseKey(null);
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-[#eff5ff] dark:bg-slate-800 text-[#0b337a] dark:text-blue-300 text-xs font-extrabold"
                    >
                      {subCategory !== 'All' || materialSearch
                        ? 'Show All Files in Course'
                        : '← Back to All Courses'}
                    </button>
                  </div>
                ) : (
                  courseMaterials.map(renderMaterialRow)
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Per-PDF Paystack Checkout Modal */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#0b337a] text-white px-4 py-3.5 flex items-center justify-between shrink-0">
              <h3 className="text-base font-extrabold">
                {checkoutData ? 'Material Checkout Ready' : 'Unlock Paid Study Material'}
              </h3>
              <button
                type="button"
                onClick={handleClosePayModal}
                aria-label="Close material checkout"
                className="p-1.5 rounded-lg hover:bg-white/15"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto">
              {modalFeedback && (
                <div
                  className={`rounded-xl px-3.5 py-2.5 text-xs border break-words [overflow-wrap:anywhere] ${
                    modalFeedback.type === 'ok'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                      : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                  }`}
                >
                  {modalFeedback.text}
                </div>
              )}

              {checkoutData ? (
                <div className="space-y-3.5">
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3.5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-emerald-800 dark:text-emerald-300 font-bold">
                        Payment Reference
                      </span>
                      <span className="font-mono font-extrabold text-emerald-950 dark:text-emerald-100 break-all">
                        {checkoutData.reference}
                      </span>
                    </div>
                    <CopyReferenceButton reference={checkoutData.reference} />
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                      Save this reference before opening Paystack. Once paid, you can immediately verify and download this PDF.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-1.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">PDF / Material</span>
                      <span className="font-extrabold text-slate-900 dark:text-white text-right">
                        {checkoutData.material.title}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Amount</span>
                      <span className="font-extrabold text-[#0a58ed] dark:text-blue-400 tabular-nums">
                        {formatCurrency(checkoutData.amount, checkoutData.currency)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => window.location.assign(checkoutData.authorizationUrl)}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold shadow-sm flex items-center justify-center gap-2 min-h-[42px]"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Proceed to Paystack Checkout</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={verifyingRef}
                      onClick={() => void handleVerifyMaterialReference(checkoutData.reference)}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 min-h-[40px] disabled:opacity-60"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${verifyingRef ? 'animate-spin' : ''}`} />
                      <span>{verifyingRef ? 'Checking Paystack...' : "I've Paid — Verify & Unlock"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClosePayModal}
                      className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/80 border border-[#d6e4fa] dark:border-slate-700 p-3.5 space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-600 dark:text-slate-400">Material</span>
                      <span className="font-extrabold text-slate-900 dark:text-white text-right">
                        {payTarget.title}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="text-slate-600 dark:text-slate-400">Course</span>
                      <span className="font-bold text-[#0b337a] dark:text-blue-300 text-right">
                        {payTarget.courseCode
                          ? `${payTarget.courseCode} — ${payTarget.courseTitle}`
                          : 'General Resource'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="text-slate-600 dark:text-slate-400">Format &amp; Size</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {payTarget.fileType} · {formatBytes(payTarget.fileSizeBytes)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-[#d6e4fa] dark:border-slate-700 flex items-center justify-between">
                      <span className="font-extrabold text-[#082252] dark:text-white">
                        Material Price
                      </span>
                      <span className="text-lg font-extrabold text-[#0a58ed] dark:text-blue-400 tabular-nums">
                        {formatCurrency(payTarget.price, payTarget.currency)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Once your Paystack payment succeeds, this {payTarget.fileType} file unlocks on your account so you can download it anytime while your course registration is active.
                  </p>

                  <div className="flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      disabled={initializingPay}
                      onClick={handleClosePayModal}
                      className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold min-h-[40px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={initializingPay}
                      onClick={() => void handleStartPaystackCheckout()}
                      className="px-5 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold shadow-sm inline-flex items-center gap-1.5 min-h-[40px] disabled:opacity-60"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>{initializingPay ? 'Preparing Checkout...' : 'Pay with Paystack'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Study Material Payment Verification Modal */}
      {manualVerifyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="bg-[#0b337a] text-white px-4 py-3.5 flex items-center justify-between">
              <h3 className="text-base font-extrabold">Verify Material Payment Reference</h3>
              <button
                type="button"
                onClick={() => setManualVerifyOpen(false)}
                aria-label="Close verify reference modal"
                className="p-1.5 rounded-lg hover:bg-white/15"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleVerifyMaterialReference(manualVerifyRefInput);
              }}
              className="p-4 sm:p-5 space-y-3.5"
            >
              {modalFeedback && (
                <div
                  className={`rounded-xl px-3.5 py-2.5 text-xs border break-words [overflow-wrap:anywhere] ${
                    modalFeedback.type === 'ok'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                      : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                  }`}
                >
                  {modalFeedback.text}
                </div>
              )}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                  Material Payment Reference
                </label>
                <input
                  required
                  value={manualVerifyRefInput}
                  onChange={(e) => setManualVerifyRefInput(e.target.value)}
                  placeholder="e.g. ACD-MAT-2026-A1B2C3D4E5"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono font-bold"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setManualVerifyOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold min-h-[40px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingRef}
                  className="px-4 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold inline-flex items-center gap-1.5 min-h-[40px] disabled:opacity-60"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{verifyingRef ? 'Verifying...' : 'Verify & Unlock PDF'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
