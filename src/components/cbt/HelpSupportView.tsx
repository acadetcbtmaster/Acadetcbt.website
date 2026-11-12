import { CheckCircle2, Database, HardDrive, HelpCircle, ShieldCheck } from 'lucide-react';
import React from 'react';

interface HelpSupportViewProps {
  dbConfigured: boolean;
  dbConnected: boolean;
  objectStorageConfigured: boolean;
}

export const HelpSupportView: React.FC<HelpSupportViewProps> = ({
  dbConfigured,
  dbConnected,
  objectStorageConfigured,
}) => (
  <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
    <div className="bg-[#0b337a] text-white px-5 py-3.5 flex items-center gap-2.5">
      <HelpCircle className="w-5 h-5" />
      <h2 className="text-lg font-extrabold tracking-tight">Help & Support</h2>
    </div>

    <div className="p-5 sm:p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-4 space-y-2">
          <div className="flex items-center gap-2 font-extrabold text-sm text-[#082252] dark:text-white">
            <ShieldCheck className="w-4 h-4 text-[#0a58ed]" />
            <span>How CBT Grading Works</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Every option you select during an exam is saved directly to PostgreSQL. Correct answers are never sent to your browser during an active session; all scoring and explanations are evaluated securely on the backend when you submit.
          </p>
        </div>

        <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-4 space-y-2">
          <div className="flex items-center gap-2 font-extrabold text-sm text-[#082252] dark:text-white">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Exam Navigation & Palette Legend</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Blue indicates your current question, Green indicates answered questions, Purple indicates questions marked for review, and White indicates unanswered questions. Use the built-in Calculator button anytime during an exam.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/70 border border-[#d6e4fa] dark:border-slate-700 p-4 space-y-3">
        <h3 className="text-sm font-extrabold text-[#082252] dark:text-white">
          Backend Infrastructure Status
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
          <div className="flex items-center justify-between rounded-lg bg-white dark:bg-slate-900 px-3.5 py-2.5 border border-slate-200 dark:border-slate-700">
            <span className="flex items-center gap-2 font-semibold">
              <Database className="w-4 h-4 text-[#0b337a] dark:text-blue-400" />
              Render PostgreSQL
            </span>
            <span
              className={`font-extrabold ${
                dbConfigured && dbConnected
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {dbConfigured && dbConnected
                ? 'Connected'
                : dbConfigured
                  ? 'Unreachable'
                  : 'Not Configured'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-white dark:bg-slate-900 px-3.5 py-2.5 border border-slate-200 dark:border-slate-700">
            <span className="flex items-center gap-2 font-semibold">
              <HardDrive className="w-4 h-4 text-[#0b337a] dark:text-blue-400" />
              External Object Storage
            </span>
            <span
              className={`font-extrabold ${
                objectStorageConfigured
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {objectStorageConfigured ? 'Configured' : 'Not Configured'}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
);
