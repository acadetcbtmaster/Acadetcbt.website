import { BookCheck, Calendar, CheckCircle2, CreditCard, Play } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { RegisteredCourseItem } from '../../types/cbt';
import { formatCurrency } from './CourseRegistrationView';

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

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="bg-[#0b337a] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <BookCheck className="w-5 h-5 shrink-0" />
          <div>
            <h2 className="text-lg font-extrabold tracking-tight leading-tight">
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
          className="px-3.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors"
        >
          Register Another Course
        </button>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div
                key={item.registrationId}
                className="rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-xs"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-extrabold text-[#0b337a] dark:text-blue-300">
                      {item.code} · {item.level}
                    </span>
                    <span className="inline-flex items-center gap-1 font-extrabold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Registered ✓</span>
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                    {item.title}
                  </h3>

                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 pt-1">
                    <div className="flex items-center justify-between">
                      <span>Payment Status:</span>
                      <span className="font-extrabold text-emerald-700 dark:text-emerald-400 capitalize">
                        {item.paymentStatus} ({formatCurrency(item.amountPaid, item.currency)})
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Registration Date:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(item.registeredAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Available Questions:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                        {item.questionCount}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={item.questionCount === 0}
                  onClick={() => onStartExamForCourse(item.courseId)}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white text-sm font-extrabold shadow-xs flex items-center justify-center gap-2 min-h-[44px] transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span>{item.questionCount === 0 ? 'No Questions Yet' : 'Start CBT'}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
