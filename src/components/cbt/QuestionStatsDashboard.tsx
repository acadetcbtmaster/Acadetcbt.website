import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Filter,
  Layers,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import type { CourseQuestionStatsItem, QuestionStatsSummary } from '../../types/cbt';

interface QuestionStatsDashboardProps {
  summary: QuestionStatsSummary | null;
  courseStats: CourseQuestionStatsItem[];
  selectedCourseId: string;
  onSelectCourse: (courseId: string) => void;
  onQuickAddForCourse: (courseId: string) => void;
  onRefresh: () => Promise<void>;
  refreshing?: boolean;
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function ReadinessIndicator({
  status,
  label,
}: {
  status: 'ready' | 'low' | 'empty';
  label: string;
}) {
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  if (status === 'low') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-400 whitespace-nowrap">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

function DifficultyProportionBar({
  easyCount,
  mediumCount,
  hardCount,
  uncategorizedCount,
  total,
}: {
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  uncategorizedCount: number;
  total: number;
}) {
  if (total <= 0) {
    return (
      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" />
    );
  }

  const easyW = (easyCount / total) * 100;
  const medW = (mediumCount / total) * 100;
  const hardW = (hardCount / total) * 100;
  const uncatW = (uncategorizedCount / total) * 100;

  return (
    <div
      className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex"
      role="img"
      aria-label={`Difficulty mix: ${easyCount} Easy, ${mediumCount} Medium, ${hardCount} Difficult`}
    >
      {easyW > 0 && (
        <div
          style={{ width: `${easyW}%` }}
          className="bg-emerald-600 dark:bg-emerald-500 h-full"
          title={`Easy: ${easyCount}`}
        />
      )}
      {medW > 0 && (
        <div
          style={{ width: `${medW}%` }}
          className="bg-amber-500 dark:bg-amber-400 h-full"
          title={`Medium: ${mediumCount}`}
        />
      )}
      {hardW > 0 && (
        <div
          style={{ width: `${hardW}%` }}
          className="bg-rose-600 dark:bg-rose-500 h-full"
          title={`Difficult: ${hardCount}`}
        />
      )}
      {uncatW > 0 && (
        <div
          style={{ width: `${uncatW}%` }}
          className="bg-slate-400 dark:bg-slate-500 h-full"
          title={`Uncategorized: ${uncategorizedCount}`}
        />
      )}
    </div>
  );
}

export const QuestionStatsDashboard: React.FC<QuestionStatsDashboardProps> = ({
  summary,
  courseStats,
  selectedCourseId,
  onSelectCourse,
  onQuickAddForCourse,
  onRefresh,
  refreshing = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [readinessFilter, setReadinessFilter] = useState<'all' | 'ready' | 'needs_more'>('all');
  const [groupByLevel, setGroupByLevel] = useState(true);

  const availableLevels = useMemo(() => {
    const set = new Set<string>();
    for (const c of courseStats) {
      if (c.level && c.level.trim()) set.add(c.level.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [courseStats]);

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return courseStats.filter((c) => {
      if (levelFilter !== 'ALL' && c.level !== levelFilter) return false;
      if (readinessFilter === 'ready' && !c.cbtReady) return false;
      if (readinessFilter === 'needs_more' && c.cbtReady) return false;
      if (q) {
        const hay = `${c.code} ${c.title} ${c.level} ${c.examCategory}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [courseStats, searchQuery, levelFilter, readinessFilter]);

  const groupedByLevel = useMemo(() => {
    const map = new Map<string, CourseQuestionStatsItem[]>();
    for (const c of filteredCourses) {
      const key = c.level || 'General';
      const list = map.get(key);
      if (list) list.push(c);
      else map.set(key, [c]);
    }
    return Array.from(map.entries());
  }, [filteredCourses]);

  const selectedCourse = useMemo(
    () => courseStats.find((c) => c.courseId === selectedCourseId) || null,
    [courseStats, selectedCourseId]
  );

  const activeTotal = summary?.totalActiveQuestions ?? 0;
  const easyTotal = summary?.easyCount ?? 0;
  const mediumTotal = summary?.mediumCount ?? 0;
  const hardTotal = summary?.hardCount ?? 0;
  const uncatTotal = summary?.uncategorizedCount ?? 0;
  const minRecommended = summary?.cbtMinRecommended ?? 20;

  const renderCourseCard = (course: CourseQuestionStatsItem) => {
    const isSelected = course.courseId === selectedCourseId;
    return (
      <button
        key={course.courseId}
        type="button"
        onClick={() => onSelectCourse(isSelected ? '' : course.courseId)}
        aria-pressed={isSelected}
        className={`text-left rounded-xl border p-3.5 transition-colors flex flex-col justify-between gap-3 ${
          isSelected
            ? 'border-[#0a58ed] bg-[#eff5ff]/70 dark:bg-blue-950/30 ring-2 ring-[#0a58ed]/20'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#0a58ed]/50'
        }`}
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-[#0b337a] dark:text-blue-300 tracking-wide">
              {course.code}
            </span>
            <ReadinessIndicator status={course.readinessStatus} label={course.readinessLabel} />
          </div>

          <div className="text-sm font-extrabold text-slate-900 dark:text-white line-clamp-1">
            {course.title}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span>{course.level}</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{course.publicationStatus}</span>
            <span aria-hidden="true">·</span>
            <span>{course.defaultDurationMinutes}m CBT</span>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="grid grid-cols-4 gap-1.5">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-2 py-1.5 text-center">
              <div className="text-sm font-extrabold text-[#082252] dark:text-white tabular-nums">
                {course.questionCount}
              </div>
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Total
              </div>
            </div>
            <div className="rounded-lg border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 px-2 py-1.5 text-center">
              <div className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {course.easyCount}
              </div>
              <div className="text-[10px] font-bold text-emerald-700/80 dark:text-emerald-300">
                Easy
              </div>
            </div>
            <div className="rounded-lg border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 px-2 py-1.5 text-center">
              <div className="text-sm font-extrabold text-amber-700 dark:text-amber-400 tabular-nums">
                {course.mediumCount}
              </div>
              <div className="text-[10px] font-bold text-amber-700/80 dark:text-amber-300">
                Medium
              </div>
            </div>
            <div className="rounded-lg border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 px-2 py-1.5 text-center">
              <div className="text-sm font-extrabold text-rose-700 dark:text-rose-400 tabular-nums">
                {course.hardCount}
              </div>
              <div className="text-[10px] font-bold text-rose-700/80 dark:text-rose-300">
                Difficult
              </div>
            </div>
          </div>

          <DifficultyProportionBar
            easyCount={course.easyCount}
            mediumCount={course.mediumCount}
            hardCount={course.hardCount}
            uncategorizedCount={course.uncategorizedCount}
            total={course.questionCount}
          />

          {(course.uncategorizedCount > 0 || course.inactiveCount > 0) && (
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {course.uncategorizedCount > 0 && (
                <span>Uncategorized: {course.uncategorizedCount}</span>
              )}
              {course.inactiveCount > 0 && (
                <span>Inactive: {course.inactiveCount}</span>
              )}
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header & Platform-Wide Difficulty KPI Strip */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-[#0a58ed] shrink-0" />
            <div>
              <h3 className="text-base font-extrabold text-[#082252] dark:text-white leading-tight">
                Course Question Statistics Dashboard
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live PostgreSQL breakdown by course and difficulty level ·{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                  {summary?.cbtReadyCourses ?? 0} of {summary?.totalCourses ?? courseStats.length} courses
                </span>{' '}
                meet the {minRecommended}-question CBT readiness standard
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={refreshing}
            onClick={() => void onRefresh()}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 min-h-[40px] whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Sync Stats'}</span>
          </button>
        </div>

        {/* 4 Global Visual Indicator Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-[#f8fbff] dark:bg-slate-800/40 p-3.5">
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Total Active Questions
            </div>
            <div className="text-2xl font-extrabold text-[#0b337a] dark:text-blue-400 tabular-nums mt-1">
              {activeTotal}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {summary?.totalInactiveQuestions ? `${summary.totalInactiveQuestions} inactive` : 'Across all courses'}
              {summary?.unassignedActiveQuestions ? ` · ${summary.unassignedActiveQuestions} unassigned` : ''}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5">
            <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
              Easy Questions
            </div>
            <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
              {easyTotal}
            </div>
            <div className="text-[11px] font-medium text-emerald-700/80 dark:text-emerald-300/80 mt-1 tabular-nums">
              {pct(easyTotal, activeTotal)}% of active bank
            </div>
          </div>

          <div className="rounded-xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-3.5">
            <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
              Medium Questions
            </div>
            <div className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 tabular-nums mt-1">
              {mediumTotal}
            </div>
            <div className="text-[11px] font-medium text-amber-700/80 dark:text-amber-300/80 mt-1 tabular-nums">
              {pct(mediumTotal, activeTotal)}% of active bank
            </div>
          </div>

          <div className="rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-3.5">
            <div className="text-xs font-bold text-rose-800 dark:text-rose-300">
              Difficult Questions
            </div>
            <div className="text-2xl font-extrabold text-rose-700 dark:text-rose-400 tabular-nums mt-1">
              {hardTotal}
            </div>
            <div className="text-[11px] font-medium text-rose-700/80 dark:text-rose-300/80 mt-1 tabular-nums">
              {pct(hardTotal, activeTotal)}% of active bank
              {uncatTotal > 0 ? ` · ${uncatTotal} uncategorized` : ''}
            </div>
          </div>
        </div>

        {/* Filter & Grouping Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5 pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter courses by code, title, level, or category..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm min-h-[40px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                aria-label="Filter by academic level"
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-2 text-xs font-bold min-h-[40px]"
              >
                <option value="ALL">All Levels</option>
                {availableLevels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <select
              aria-label="Filter by CBT readiness"
              value={readinessFilter}
              onChange={(e) =>
                setReadinessFilter(e.target.value as 'all' | 'ready' | 'needs_more')
              }
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-2 text-xs font-bold min-h-[40px]"
            >
              <option value="all">All Readiness States</option>
              <option value="ready">CBT Ready ({minRecommended}+)</option>
              <option value="needs_more">Needs Questions (&lt; {minRecommended})</option>
            </select>

            <button
              type="button"
              onClick={() => setGroupByLevel((prev) => !prev)}
              className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 min-h-[40px] whitespace-nowrap shrink-0 transition-colors ${
                groupByLevel
                  ? 'border-[#0a58ed] bg-[#eff5ff] dark:bg-blue-950/40 text-[#0b337a] dark:text-blue-300'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{groupByLevel ? 'Grouped by Level' : 'Flat Grid'}</span>
            </button>
          </div>
        </div>

        {/* Courses Statistics Grid */}
        {filteredCourses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 py-8 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
            No courses match your current search or filter criteria.
          </div>
        ) : groupByLevel ? (
          <div className="space-y-4">
            {groupedByLevel.map(([levelName, items]) => (
              <div key={levelName} className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    {levelName}
                  </h4>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                    {items.length} {items.length === 1 ? 'course' : 'courses'} ·{' '}
                    {items.reduce((sum, item) => sum + item.questionCount, 0)} questions
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {items.map(renderCourseCard)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredCourses.map(renderCourseCard)}
          </div>
        )}
      </div>

      {/* Selected Course Detailed Breakdown Panel */}
      {selectedCourse && (
        <div className="rounded-xl border border-[#0a58ed]/40 bg-[#f8fbff] dark:bg-slate-900 p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                <span className="text-[#0b337a] dark:text-blue-300 font-extrabold">
                  {selectedCourse.code}
                </span>
                <span aria-hidden="true">·</span>
                <span>{selectedCourse.level}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedCourse.examCategory}</span>
                <span aria-hidden="true">·</span>
                <ReadinessIndicator
                  status={selectedCourse.readinessStatus}
                  label={selectedCourse.readinessLabel}
                />
              </div>
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                {selectedCourse.title} — Detailed Question Distribution
              </h4>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onQuickAddForCourse(selectedCourse.courseId)}
                className="px-3 py-2 rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-bold flex items-center gap-1.5 min-h-[40px] whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question to {selectedCourse.code}</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectCourse('')}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 min-h-[40px] whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" />
                <span>Show All Courses</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-3">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Total Questions
              </div>
              <div className="text-xl font-extrabold text-[#082252] dark:text-white tabular-nums mt-0.5">
                {selectedCourse.questionCount}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                Active in CBT bank
                {selectedCourse.inactiveCount > 0
                  ? ` · ${selectedCourse.inactiveCount} inactive`
                  : ''}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-slate-800/60 p-3">
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                Easy Questions
              </div>
              <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
                {selectedCourse.easyCount}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                {pct(selectedCourse.easyCount, selectedCourse.questionCount)}% share
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-slate-800/60 p-3">
              <div className="text-xs font-bold text-amber-700 dark:text-amber-300">
                Medium Questions
              </div>
              <div className="text-xl font-extrabold text-amber-700 dark:text-amber-400 tabular-nums mt-0.5">
                {selectedCourse.mediumCount}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                {pct(selectedCourse.mediumCount, selectedCourse.questionCount)}% share
              </div>
            </div>

            <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-800/60 p-3">
              <div className="text-xs font-bold text-rose-700 dark:text-rose-300">
                Difficult Questions
              </div>
              <div className="text-xl font-extrabold text-rose-700 dark:text-rose-400 tabular-nums mt-0.5">
                {selectedCourse.hardCount}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                {pct(selectedCourse.hardCount, selectedCourse.questionCount)}% share
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <DifficultyProportionBar
              easyCount={selectedCourse.easyCount}
              mediumCount={selectedCourse.mediumCount}
              hardCount={selectedCourse.hardCount}
              uncategorizedCount={selectedCourse.uncategorizedCount}
              total={selectedCourse.questionCount}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span>
                {selectedCourse.cbtReady
                  ? `${selectedCourse.code} is ready for standard ${minRecommended}-question CBT sessions.`
                  : `Upload ${Math.max(0, minRecommended - selectedCourse.questionCount)} more active question(s) to reach the ${minRecommended}-question CBT benchmark.`}
              </span>
              {selectedCourse.uncategorizedCount > 0 && (
                <span className="font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                  {selectedCourse.uncategorizedCount} uncategorized active question(s)
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
