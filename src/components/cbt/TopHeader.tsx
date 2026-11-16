import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  Lock,
  LogOut,
  Menu,
  Shield,
  User as UserIcon,
} from 'lucide-react';
import React, { useState } from 'react';
import type { CourseCatalogueItem, SafeUser } from '../../types/cbt';
import { AcadetCrest, useBranding } from './AcadetLogo';

interface TopHeaderProps {
  user: SafeUser;
  courses: CourseCatalogueItem[];
  selectedCourseId: string | null;
  onSelectCourse: (courseId: string) => void;
  onNavigateHome: () => void;
  onOpenAdmin?: () => void;
  onOpenNotifications?: () => void;
  unreadNotifications?: number;
  onLogout: () => void;
  onToggleMobileMenu?: () => void;
  examMode?: {
    remainingSeconds: number;
    courseLabel?: string;
    onRequestEndExam: () => void;
  };
}

function formatTimer(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  user,
  courses,
  selectedCourseId,
  onSelectCourse,
  onNavigateHome,
  onOpenAdmin,
  onOpenNotifications,
  unreadNotifications = 0,
  onLogout,
  onToggleMobileMenu,
  examMode,
}) => {
  const { branding } = useBranding();
  const [courseOpen, setCourseOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const activeCourse =
    courses.find((c) => c.id === selectedCourseId) || courses[0] || null;
  const firstName = user.fullName.trim().split(/\s+/)[0] || 'Student';
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';

  return (
    <header className="sticky top-0 z-30 bg-[#0b337a] text-white shadow-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-[72px] flex items-center justify-between gap-3">
        {/* Left: Brand + Mobile Menu Button */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {!examMode && onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg text-white/90 hover:bg-white/10 active:bg-white/20 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <button
            type="button"
            onClick={onNavigateHome}
            className="flex items-center gap-2.5 text-left group focus:outline-none min-w-0"
          >
            <AcadetCrest className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 transition-transform group-hover:scale-105" />
            <div className="min-w-0">
              <div className="text-lg sm:text-xl font-extrabold tracking-tight leading-tight whitespace-nowrap">
                {branding.siteName}
              </div>
              <div className="text-[11px] sm:text-xs italic text-blue-100/90 leading-tight truncate">
                {branding.tagline}
              </div>
            </div>
          </button>

          {/* Center Course Selector (Desktop & Tablet) */}
          <div className="hidden md:flex items-center pl-4 ml-2 border-l border-white/25 relative">
            <div>
              <div className="text-sm font-bold leading-tight text-white">
                {user.examTarget || 'Acadet CBT Examination'}
              </div>
              <div className="relative">
                <button
                  type="button"
                  disabled={Boolean(examMode) || courses.length === 0}
                  onClick={() => setCourseOpen((prev) => !prev)}
                  className="text-xs italic text-blue-100 hover:text-white flex items-center gap-1 mt-0.5 disabled:opacity-90 disabled:cursor-default"
                >
                  <span className="truncate max-w-[260px]">
                    Course:{' '}
                    {examMode?.courseLabel
                      ? examMode.courseLabel
                      : activeCourse
                        ? `${activeCourse.code} — ${activeCourse.title}`
                        : 'Select Course'}
                  </span>
                  {!examMode && courses.length > 0 && (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                  )}
                </button>

                {courseOpen && !examMode && courses.length > 0 && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setCourseOpen(false)}
                    />
                    <div className="absolute left-0 mt-2 w-80 max-h-80 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50">
                      <div className="px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                        Course Selection
                      </div>
                      {courses.map((course) => (
                        <button
                          key={course.id}
                          type="button"
                          onClick={() => {
                            onSelectCourse(course.id);
                            setCourseOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between gap-2 hover:bg-blue-50 dark:hover:bg-slate-800 ${
                            course.id === activeCourse?.id
                              ? 'font-bold text-[#0052cc] dark:text-blue-400 bg-blue-50/70 dark:bg-slate-800/70'
                              : 'font-medium'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate">
                              <span className="font-extrabold">{course.code}</span> ·{' '}
                              {course.title}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                              {course.questionCount} Qs
                            </div>
                          </div>

                          {course.isRegistered ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Registered
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 shrink-0">
                              <Lock className="w-3 h-3" />
                              Locked
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Either Exam Timer + End Exam OR User Greeting Menu */}
        {examMode ? (
          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            <div className="flex items-center gap-2 sm:gap-2.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
              <Clock className="w-5 h-5 text-blue-100 shrink-0" />
              <div className="leading-tight">
                <div className="text-[10px] uppercase tracking-wider text-blue-100 font-semibold hidden sm:block">
                  Time Remaining
                </div>
                <div
                  className={`text-base sm:text-xl font-extrabold font-mono tabular-nums ${
                    examMode.remainingSeconds <= 300 ? 'text-amber-300 animate-pulse' : 'text-white'
                  }`}
                >
                  {formatTimer(examMode.remainingSeconds)}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={examMode.onRequestEndExam}
              className="px-3.5 sm:px-4 py-2 min-h-[42px] rounded-lg bg-[#e03e3e] hover:bg-[#c82d2d] text-white font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
            >
              End Exam
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {onOpenNotifications && (
              <button
                type="button"
                onClick={onOpenNotifications}
                aria-label="Open Notification Centre"
                title="Notifications"
                className="relative p-2 rounded-xl hover:bg-white/10 transition-colors min-w-[42px] min-h-[42px] flex items-center justify-center"
              >
                <Bell className="w-5 h-5 text-white" />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold tabular-nums flex items-center justify-center leading-none shadow-xs">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </button>
            )}

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setProfileOpen((p) => !p)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/10 transition-colors min-h-[42px]"
              >
                <div className="w-9 h-9 rounded-full bg-white/15 border border-white/40 flex items-center justify-center shrink-0">
                  <UserIcon className="w-5 h-5 text-white" />
                </div>
                <div className="text-left leading-tight hidden sm:block">
                  <div className="text-sm font-bold flex items-center gap-1">
                    <span>Hello, {firstName}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                  </div>
                  <div className="text-xs italic text-blue-100/90">Good luck!</div>
                </div>
              </button>

              {profileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-60 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="text-sm font-bold truncate">{user.fullName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {user.email}
                      </div>
                      {user.registrationCode && (
                        <div className="mt-1 text-[11px] font-mono font-extrabold text-[#0b337a] dark:text-blue-300">
                          Reg Code: {user.registrationCode}
                        </div>
                      )}
                    </div>
                    {isAdmin && onOpenAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          onOpenAdmin();
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[#0b337a] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 flex items-center gap-2"
                      >
                        <Shield className="w-4 h-4" />
                        <span>Admin Console</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        onLogout();
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
