import { CreditCard, Lock, X } from 'lucide-react';
import React from 'react';
import { formatCurrency } from './CourseRegistrationView';

interface CourseAccessRequiredModalProps {
  course: {
    id: string;
    code: string;
    title: string;
    courseValue?: number;
    registrationFee: number;
    currency?: string;
  } | null;
  onClose: () => void;
  onRegisterNow: (courseId: string) => void;
}

export const CourseAccessRequiredModal: React.FC<CourseAccessRequiredModalProps> = ({
  course,
  onClose,
  onRegisterNow,
}) => {
  if (!course) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[1px]">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div className="bg-[#0b337a] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-amber-300" />
            <h2 className="text-base font-extrabold">Course Registration Required</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg hover:bg-white/15"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            You have not registered for this course. Please complete your course registration to access the CBT examination.
          </p>

          <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/80 border border-[#d6e4fa] dark:border-slate-700 p-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-600 dark:text-slate-400">Course</span>
              <span className="font-extrabold text-slate-900 dark:text-white text-right">
                {course.code} — {course.title}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-600 dark:text-slate-400">Course Value</span>
              <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                {formatCurrency(course.courseValue ?? course.registrationFee, course.currency)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-600 dark:text-slate-400">Processing Charges</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                Absorbed by Acadet CBT
              </span>
            </div>
            <div className="border-t border-[#d6e4fa] dark:border-slate-700 pt-2 flex justify-between gap-3">
              <span className="font-extrabold text-[#082252] dark:text-white">Total Payable</span>
              <span className="font-extrabold text-[#0a58ed] dark:text-blue-400 tabular-nums">
                {formatCurrency(course.registrationFee, course.currency)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => onRegisterNow(course.id)}
              className="px-5 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-sm font-extrabold shadow-sm flex items-center gap-2 min-h-[44px]"
            >
              <CreditCard className="w-4 h-4" />
              <span>Register Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
