import {
  ArrowRight,
  Award,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type {
  ActiveExamSession,
  CourseCatalogueItem,
  GradedExamQuestion,
  ResultsOverview,
} from '../../types/cbt';
import { AcadetCrest } from './AcadetLogo';

interface ResultsViewProps {
  courses: CourseCatalogueItem[];
  initialSessionResult?: {
    session: ActiveExamSession;
    questions: GradedExamQuestion[];
  } | null;
  onClearInitialSessionResult?: () => void;
  compact?: boolean;
}

function formatTotalDuration(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return `${safe}s`;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  courses,
  initialSessionResult = null,
  onClearInitialSessionResult,
  compact = false,
}) => {
  const [courseFilter, setCourseFilter] = useState<string>('');
  const [data, setData] = useState<ResultsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<{
    session: ActiveExamSession;
    questions: GradedExamQuestion[];
  } | null>(initialSessionResult);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (initialSessionResult) {
      setDetailModal(initialSessionResult);
    }
  }, [initialSessionResult]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.results
      .list(courseFilter || undefined)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load results.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [courseFilter, initialSessionResult]);

  const openSessionDetail = async (sessionId: string) => {
    setLoadingDetail(true);
    try {
      const detail = await api.results.getDetail(sessionId);
      setDetailModal(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load detailed result.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const kpis = data?.kpis || {
    averageScore: 0,
    examsTaken: 0,
    bestScore: 0,
    totalTimeSeconds: 0,
  };
  const trend = data?.trend || [];
  const history = data?.history || [];

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
      {/* Deep Navy Header Strip */}
      <div className="bg-[#0b337a] text-white px-5 py-3.5 flex items-center gap-2.5">
        <AcadetCrest className="w-8 h-8" />
        <BarChart3 className="w-5 h-5 shrink-0" />
        <h2 className="text-lg font-extrabold tracking-tight">Course Results</h2>
      </div>

      <div className="p-4 sm:p-5 space-y-5 flex-1">
        {/* Sub-header + Filter Dropdown */}
        <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/80 border border-[#d6e4fa] dark:border-slate-700 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm sm:text-base font-extrabold text-[#082252] dark:text-white">
              Your Performance Overview
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Track your progress and check your course scores.
            </div>
          </div>

          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            aria-label="Filter results by course"
            className="rounded-xl border border-[#c6daf7] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0a58ed]"
          >
            <option value="">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* 4 KPI Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-center shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-[#0a58ed] text-white flex items-center justify-center mx-auto mb-2">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-[#082252] dark:text-white tabular-nums">
              {loading ? '—' : `${kpis.averageScore}%`}
            </div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
              Average Score
            </div>
          </div>

          <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-center shadow-xs">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-[#082252] dark:text-white tabular-nums">
              {loading ? '—' : kpis.examsTaken}
            </div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
              Exams Taken
            </div>
          </div>

          <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-center shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 flex items-center justify-center mx-auto mb-2">
              <Trophy className="w-4 h-4" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-[#082252] dark:text-white tabular-nums">
              {loading ? '—' : `${kpis.bestScore}%`}
            </div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
              Best Score
            </div>
          </div>

          <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-center shadow-xs">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#0a58ed] dark:text-blue-400 flex items-center justify-center mx-auto mb-2">
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-[#082252] dark:text-white tabular-nums">
              {loading ? '—' : formatTotalDuration(kpis.totalTimeSeconds)}
            </div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
              Total Time
            </div>
          </div>
        </div>

        {/* Performance Trend Chart */}
        <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <h3 className="text-sm sm:text-base font-extrabold text-[#082252] dark:text-white">
            Your Performance Trend
          </h3>

          {trend.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Complete your first course examination to generate your score trend chart.
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <PerformanceLineChart points={trend.slice(-8)} />
            </div>
          )}

          {history.length > 0 && (
            <button
              type="button"
              disabled={loadingDetail}
              onClick={() => openSessionDetail(history[0].id)}
              className="w-full py-2.5 px-4 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white font-bold text-sm shadow-xs flex items-center justify-center gap-2 transition-colors min-h-[44px]"
            >
              <BarChart3 className="w-4 h-4" />
              <span>{loadingDetail ? 'Loading Breakdown...' : 'View Detailed Results'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Recent Exam Attempts List */}
        {!compact && history.length > 0 && (
          <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/70 border-b border-[#dce6f5] dark:border-slate-800 text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Completed Course Exam History
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      {item.courseCode ? `${item.courseCode} — ` : ''}
                      {item.courseTitle}{' '}
                      <span className="text-xs font-semibold text-slate-500">
                        ({item.difficultyFilter})
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {item.correctCount ?? 0}/{item.totalQuestions} correct ·{' '}
                      {formatTotalDuration(item.timeSpentSeconds)} ·{' '}
                      {item.submittedAt
                        ? new Date(item.submittedAt).toLocaleString()
                        : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-lg bg-[#eff5ff] dark:bg-blue-950/60 text-[#0a58ed] dark:text-blue-300 font-extrabold text-sm tabular-nums">
                      {item.scorePercentage ?? 0}%
                    </span>
                    <button
                      type="button"
                      onClick={() => openSessionDetail(item.id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detailed Question-by-Question Review Modal */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-[1px]">
          <div className="w-full max-w-3xl max-h-[90vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-[#0b337a] text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <AcadetCrest className="w-8 h-8" />
                <Award className="w-5 h-5 shrink-0" />
                <div>
                  <h3 className="font-extrabold text-base">
                    {detailModal.session.courseCode
                      ? `${detailModal.session.courseCode} — `
                      : ''}
                    {detailModal.session.courseTitle} — Graded Result
                  </h3>
                  <p className="text-xs text-blue-100">
                    Score: {detailModal.session.scorePercentage ?? 0}% (
                    {detailModal.session.correctCount ?? 0} of{' '}
                    {detailModal.session.totalQuestions} correct)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailModal(null);
                  onClearInitialSessionResult?.();
                }}
                className="p-1.5 rounded-lg hover:bg-white/15"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {detailModal.questions.map((q) => {
                const options = [
                  { letter: 'A' as const, text: q.optionA },
                  { letter: 'B' as const, text: q.optionB },
                  { letter: 'C' as const, text: q.optionC },
                  { letter: 'D' as const, text: q.optionD },
                ];
                return (
                  <div
                    key={q.questionId}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                        Q{q.order}. {q.questionText}
                      </div>
                      {q.isCorrect ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Correct
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs font-extrabold shrink-0">
                          <XCircle className="w-3.5 h-3.5" />
                          {q.selectedOption ? 'Incorrect' : 'Skipped'}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                      {options.map((opt) => {
                        const isAnswer = opt.letter === q.correctOption;
                        const isChosen = opt.letter === q.selectedOption;
                        return (
                          <div
                            key={opt.letter}
                            className={`px-3 py-2 rounded-lg border ${
                              isAnswer
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                                : isChosen
                                  ? 'border-red-400 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 font-semibold'
                                  : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {opt.letter}. {opt.text}
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div className="rounded-lg bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                        <span className="font-bold text-[#0b337a] dark:text-blue-300">
                          Explanation:{' '}
                        </span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PerformanceLineChart: React.FC<{
  points: ResultsOverview['trend'];
}> = ({ points }) => {
  const width = 460;
  const height = 185;
  const padLeft = 42;
  const padRight = 24;
  const padTop = 26;
  const padBottom = 30;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const coords = points.map((pt, idx) => {
    const x =
      points.length === 1
        ? padLeft + chartW / 2
        : padLeft + (idx / (points.length - 1)) * chartW;
    const clamped = Math.max(0, Math.min(100, pt.scorePercentage));
    const y = padTop + ((100 - clamped) / 100) * chartH;
    return { ...pt, x, y };
  });

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const areaPath =
    coords.length > 0
      ? `M ${coords[0].x},${padTop + chartH} L ${coords
          .map((c) => `${c.x},${c.y}`)
          .join(' L ')} L ${coords[coords.length - 1].x},${padTop + chartH} Z`
      : '';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full min-w-[320px] h-auto"
      role="img"
      aria-label="Course exam score trend chart"
    >
      <defs>
        <linearGradient id="acadetChartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a58ed" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#0a58ed" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {[0, 25, 50, 75, 100].map((pct) => {
        const y = padTop + ((100 - pct) / 100) * chartH;
        return (
          <g key={pct}>
            <line
              x1={padLeft}
              y1={y}
              x2={width - padRight}
              y2={y}
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-700"
              strokeWidth="1"
            />
            <text
              x={padLeft - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-slate-500 dark:fill-slate-400 text-[10px] font-semibold"
            >
              {pct}%
            </text>
          </g>
        );
      })}

      {areaPath && <path d={areaPath} fill="url(#acadetChartFill)" />}

      {coords.length > 1 && (
        <polyline
          fill="none"
          stroke="#0a58ed"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={polyline}
        />
      )}

      {coords.map((c) => (
        <g key={c.sessionId}>
          <circle
            cx={c.x}
            cy={c.y}
            r="4.5"
            fill="#0a58ed"
            stroke="#ffffff"
            strokeWidth="2"
          />
          <rect
            x={c.x - 17}
            y={Math.max(2, c.y - 23)}
            width="34"
            height="16"
            rx="4"
            fill="#0a58ed"
          />
          <text
            x={c.x}
            y={Math.max(13, c.y - 12)}
            textAnchor="middle"
            fill="#ffffff"
            className="text-[9.5px] font-extrabold tabular-nums"
          >
            {c.scorePercentage}%
          </text>
          <text
            x={c.x}
            y={height - 8}
            textAnchor="middle"
            className="fill-slate-600 dark:fill-slate-400 text-[10px] font-semibold"
          >
            {c.label}
          </text>
        </g>
      ))}
    </svg>
  );
};
