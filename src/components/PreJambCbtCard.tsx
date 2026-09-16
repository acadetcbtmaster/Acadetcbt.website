import React from 'react';
import {
  Target,
  Monitor,
  TrendingUp,
  ShieldCheck,
  Clock,
  ClipboardCheck,
  Sparkles,
  ArrowRight,
  Tv
} from 'lucide-react';

interface PreJambCbtCardProps {
  onStartTest?: () => void;
  onStartGuestMode?: () => void;
  onExploreFullMock?: () => void;
  className?: string;
}

export const PreJambCbtCard: React.FC<PreJambCbtCardProps> = ({
  onStartTest,
  onStartGuestMode,
  className = '',
}) => {
  const handleGuestClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStartGuestMode) {
      onStartGuestMode();
    } else if (onStartTest) {
      onStartTest();
    }
  };

  return (
    <div
      className={`w-full bg-gradient-to-br from-blue-50/70 via-slate-50/50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/30 border border-blue-200/90 dark:border-blue-800/50 hover:border-blue-400 dark:hover:border-blue-600 rounded-xl shadow-xs overflow-hidden text-slate-800 dark:text-slate-200 transition-colors ${className}`}
      id="pre-jamb-cbt-featured-card"
    >
      <div className="p-5 sm:p-6">
        
        {/* Header Eyebrow & Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-black bg-[#1e3a8a] dark:bg-blue-800 text-white shadow-xs uppercase tracking-wide">
            <ShieldCheck className="w-3.5 h-3.5 text-white" />
            Official Standard Format
          </span>
          <span className="text-[11px] text-blue-900 dark:text-blue-200 font-semibold bg-blue-100/70 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-200/70 dark:border-blue-800/50">
            2025/2026 Academic Catalog
          </span>
        </div>

        {/* Title and High-Contrast Typography */}
        <div className="space-y-1 mb-5">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              ACADET CBT MASTER
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200/60 dark:border-blue-900/40">
              <Sparkles className="w-3 h-3 text-[#1e3a8a] dark:text-blue-400" />
              UTME Prep
            </span>
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#1e3a8a] dark:text-blue-400">
            Pre-JAMB Examination Simulation
          </p>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed font-normal mt-1">
            Practice under realistic examination conditions with live timer tracking, authentic question randomization, and comprehensive solution explanations.
          </p>
        </div>

        {/* 4 Cohesive Feature Specification Blocks */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-5">
          <div className="p-3 bg-white/90 dark:bg-slate-800/60 border border-blue-100/90 dark:border-blue-900/40 rounded-lg flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200/70 dark:border-blue-800/50 text-[#1e3a8a] dark:text-blue-300 flex items-center justify-center shrink-0">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">Targeted</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">JAMB Syllabus</span>
            </div>
          </div>

          <div className="p-3 bg-white/90 dark:bg-slate-800/60 border border-blue-100/90 dark:border-blue-900/40 rounded-lg flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200/70 dark:border-blue-800/50 text-[#1e3a8a] dark:text-blue-300 flex items-center justify-center shrink-0">
              <Monitor className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">CBT Layout</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Standard 8-Key UI</span>
            </div>
          </div>

          <div className="p-3 bg-white/90 dark:bg-slate-800/60 border border-blue-100/90 dark:border-blue-900/40 rounded-lg flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200/70 dark:border-blue-800/50 text-[#1e3a8a] dark:text-blue-300 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">Timed</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Real Exam Timer</span>
            </div>
          </div>

          <div className="p-3 bg-white/90 dark:bg-slate-800/60 border border-blue-100/90 dark:border-blue-900/40 rounded-lg flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200/70 dark:border-blue-800/50 text-[#1e3a8a] dark:text-blue-300 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">Instant</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Score Analytics</span>
            </div>
          </div>
        </div>

        {/* Primary Functional Action CTA */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-blue-100 dark:border-blue-900/40">
          <div className="text-xs text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
            <span><strong className="text-slate-900 dark:text-white font-bold">Guest Access:</strong> No registration required to test your speed.</span>
          </div>

          <button
            type="button"
            onClick={handleGuestClick}
            className="px-5 py-2.5 bg-[#1e3a8a] hover:bg-[#172554] active:bg-[#0f172a] text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shrink-0"
            id="btn-start-cbt-guest-mode"
          >
            <Tv className="w-4 h-4" />
            <span>Launch Pre-JAMB CBT Test</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};

