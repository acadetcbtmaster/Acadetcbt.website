import React, { useState } from 'react';
import { UserProfile, TestSessionResult, Question, Course } from '../types';
import { PreJambCbtCard } from './PreJambCbtCard';
import {
  Sparkles,
  BookOpen,
  Award,
  Zap,
  CheckCircle2,
  Bookmark,
  ArrowRight,
  Crown,
  History,
  Target,
  Flame,
  Check,
  TrendingUp,
  AlertTriangle,
  Search,
  GraduationCap,
  ChevronRight,
  BarChart3,
  Clock,
  Bell,
  MoreVertical,
  CreditCard,
  RotateCw,
  Mail,
  FileCheck2,
  Building2,
  Vote,
  User,
  Settings,
  ShieldCheck,
  ExternalLink,
  Smartphone
} from 'lucide-react';
import { getEffectiveStreak, getLast7DaysStreakStatus } from '../utils/streak';

interface StudentDashboardProps {
  user: UserProfile;
  results: TestSessionResult[];
  questions?: Question[];
  courses?: Course[];
  onNavigate: (tab: string) => void;
  onOpenSubscribe: () => void;
  onOpenEditProfile?: () => void;
  onOpenSignUp?: () => void;
  onOpenInstallModal?: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  user,
  results,
  courses = [],
  onNavigate,
  onOpenSubscribe,
  onOpenEditProfile,
  onOpenSignUp,
  onOpenInstallModal,
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isRefreshingCourses, setIsRefreshingCourses] = useState(false);
  const [courseNoticeDismissed, setCourseNoticeDismissed] = useState(false);

  const isGuest = user?.isGuest ?? false;
  const isPremium = user?.subscription?.isPremium ?? false;
  const questionsUsed = user?.subscription?.questionsAttemptedCount ?? 0;
  const freeLimit = user?.subscription?.freeLimit ?? 30;
  const freeRemaining = Math.max(0, freeLimit - questionsUsed);

  // Departmental name and university
  const universityDisplay = user.universityName || 'Acadet CBT Portal';
  const departmentDisplay = user.departmentName ? user.departmentName.toUpperCase() : 'GENERAL CBT STUDIES';
  const facultyDisplay = (user as any).facultyName ? (user as any).facultyName.toUpperCase() : 'ACADEMIC PORTAL';
  const levelDisplay = (user as any).level || '100 Level';

  // Filter courses for student's department if available
  const departmentalCourses = courses.filter((c) => {
    if (!user.departmentId && !user.departmentName) return true;
    return c.departmentId === user.departmentId || c.departmentName === user.departmentName;
  });

  const displayCourses = departmentalCourses.length > 0 ? departmentalCourses.slice(0, 4) : [];

  // Streak calculations
  const streakInfo = getEffectiveStreak(user);
  const weekDays = getLast7DaysStreakStatus(user);

  // Calculate metrics
  const totalCompleted = results.reduce((acc, r) => acc + (r.totalQuestions || 0), 0) + questionsUsed;
  const mockCbtsCount = results.filter((r) => r.type === 'mock_cbt').length;
  
  const avgScore = results.length > 0
    ? Math.round(results.reduce((acc, r) => acc + (r.percentage || 0), 0) / results.length)
    : 78;

  const recentSessions = results.slice(0, 4);

  const handleRefreshCourses = () => {
    setIsRefreshingCourses(true);
    setTimeout(() => {
      setIsRefreshingCourses(false);
    }, 600);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6" id="student-dashboard">
      
      {/* =========================================================================
          SECTION 1: NIGERIAN UNIVERSITY STUDENT PORTAL BLUE HEADER (IMAGE 1 VIBE)
          ========================================================================= */}
      <div 
        className="relative rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#1a429b] via-[#1d49ab] to-[#143680] text-white p-5 sm:p-7 shadow-lg pb-10 sm:pb-12 overflow-visible"
        id="dashboard-institutional-header"
      >
        {/* Subtle decorative glow in top corner */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.04] rounded-full blur-2xl pointer-events-none" />

        {/* Top Profile Bar: Avatar, Greeting, University, Bell & More Menu */}
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Circular Bordered Avatar (exact matching Image 1) */}
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full ring-2 ring-white/80 p-0.5 bg-white/10 shrink-0 overflow-hidden shadow-md flex items-center justify-center">
              {user.avatarUrl || user.photoUrl ? (
                <img
                  src={user.avatarUrl || user.photoUrl}
                  alt={user.name}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-blue-800 text-white flex items-center justify-center font-bold text-lg sm:text-xl">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Greeting & University Subtitle */}
            <div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Welcome back, {user.name}</span>
              </h1>
              <p className="text-xs sm:text-sm text-blue-100/90 font-medium mt-0.5">
                {universityDisplay}
              </p>
            </div>
          </div>

          {/* Right Header Actions: Notification Bell + More Vertical Menu */}
          <div className="flex items-center gap-2 shrink-0 relative">
            <button
              onClick={() => onNavigate('community')}
              className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer relative shadow-sm"
              title="Campus Notifications & Announcements"
              aria-label="Campus Notifications"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400"></span>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shadow-sm"
                title="More Portal Options"
                aria-label="More Portal Options"
              >
                <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </button>

              {/* Dropdown Menu */}
              {showMoreMenu && (
                <div className="absolute right-0 top-11 w-52 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 text-slate-800 dark:text-slate-200 text-xs animate-in fade-in slide-in-from-top-2">
                  {onOpenEditProfile && (
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        onOpenEditProfile();
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span>Edit Student Profile</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      onOpenSubscribe();
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    <span>Fees & Subscription</span>
                  </button>
                  {onOpenInstallModal && (
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        onOpenInstallModal();
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Install Offline App</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Academic Department & Faculty Info */}
        <div className="mt-4 sm:mt-5 pt-3.5 border-t border-white/15 relative z-10">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-blue-200 shrink-0" />
            <span className="font-extrabold text-xs sm:text-sm tracking-wider uppercase text-white">
              {departmentDisplay}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-blue-200/90 font-medium pl-6 uppercase tracking-wide mt-0.5">
            {facultyDisplay}
          </p>
        </div>

        {/* Status Chips Row: [400 Level] [REGULAR] [Session: 2026/2027] [Semester: first] */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2 relative z-10">
          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-white/15 hover:bg-white/20 border border-white/25 text-white backdrop-blur-xs transition-colors">
            {levelDisplay}
          </span>
          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-white/15 hover:bg-white/20 border border-white/25 text-white backdrop-blur-xs transition-colors">
            REGULAR
          </span>
          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-white/15 hover:bg-white/20 border border-white/25 text-white backdrop-blur-xs transition-colors">
            Session: 2026/2027
          </span>
          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-white/15 hover:bg-white/20 border border-white/25 text-white backdrop-blur-xs transition-colors">
            Semester: first
          </span>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: FLOATING AVAILABLE BALANCE & STATUS CARD (IMAGE 1 VIBE)
          ========================================================================= */}
      <div className="-mt-7 sm:-mt-8 relative z-20 px-1 sm:px-2">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-md flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <CreditCard className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>Available Balance</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {isPremium ? 'Unlimited Pass' : 'NGN 0.00'}
              </span>
              {!isPremium && (
                <span className="text-[11px] font-semibold text-slate-500">
                  ({freeRemaining} free questions left)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/50 text-[#1a429b] dark:text-blue-300 font-bold text-xs flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#1a429b] dark:text-blue-400" />
              <span>Active</span>
            </div>
            {!isPremium && (
              <button
                onClick={onOpenSubscribe}
                className="px-3 py-1 bg-[#ea580c] hover:bg-[#c2410c] text-white font-bold text-xs rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                Top Up
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 3: QUICK SERVICES (IMAGE 1 4-CARD GRID: ELECTION, MEMO, CLEARANCE, HOSTEL)
          ========================================================================= */}
      <div className="space-y-3 pt-1">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
          Quick Services
        </h2>

        <div className="grid grid-cols-4 gap-2.5 sm:gap-4" id="quick-services-grid">
          
          {/* Service 1: Practice Questions */}
          <button
            onClick={() => onNavigate('practice')}
            className="group flex flex-col items-center justify-center p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer text-center"
            id="service-card-practice"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-50/70 text-[#1a429b] dark:bg-blue-950/40 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
              Practice
            </span>
            <span className="text-[10px] text-slate-500 hidden sm:block mt-0.5">
              CBT Questions
            </span>
          </button>

          {/* Service 2: Study Notes & Handouts */}
          <button
            onClick={() => onNavigate('materials')}
            className="group flex flex-col items-center justify-center p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer text-center"
            id="service-card-memo"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-50/70 text-[#1a429b] dark:bg-blue-950/40 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Mail className="w-6 h-6" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
              Notes
            </span>
            <span className="text-[10px] text-slate-500 hidden sm:block mt-0.5">
              Class Handouts
            </span>
          </button>

          {/* Service 3: Score Clearance & Results */}
          <button
            onClick={() => onNavigate('performance')}
            className="group flex flex-col items-center justify-center p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer text-center"
            id="service-card-clearance"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-50/70 text-[#1a429b] dark:bg-blue-950/40 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
              Results
            </span>
            <span className="text-[10px] text-slate-500 hidden sm:block mt-0.5">
              Test Clearance
            </span>
          </button>

          {/* Service 4: Mock CBT Simulation Hall */}
          <button
            onClick={() => onNavigate('mock_cbt')}
            className="group flex flex-col items-center justify-center p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer text-center"
            id="service-card-hostel"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-50/70 text-[#1a429b] dark:bg-blue-950/40 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Building2 className="w-6 h-6" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
              Mock CBT
            </span>
            <span className="text-[10px] text-slate-500 hidden sm:block mt-0.5">
              Exam Hall
            </span>
          </button>

        </div>
      </div>

      {/* =========================================================================
          SECTION 4: COURSE OFFERED (EXACT REPLICA FROM IMAGE 1)
          ========================================================================= */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Course Offered
          </h2>
          <button
            onClick={handleRefreshCourses}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
            title="Refresh Courses"
            aria-label="Refresh course list"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshingCourses ? 'animate-spin text-[#1a429b]' : ''}`} />
          </button>
        </div>

        {displayCourses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {displayCourses.map((c) => (
              <div
                key={c.id}
                onClick={() => onNavigate('practice')}
                className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-[#1a429b] dark:bg-blue-950 dark:text-blue-300">
                    {c.code}
                  </span>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-1">
                    {c.title}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {c.level ? `${c.level} • ` : ''}{c.semester || 'First Semester'} • Departmental Core
                  </p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1a429b] flex items-center justify-center shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Exact soft institutional empty container from Image 1 */
          <div className="relative rounded-2xl bg-gradient-to-r from-blue-50 via-slate-50 to-blue-50 dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900 border border-blue-100/80 dark:border-white/10 p-5 text-center shadow-2xs">
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
              No course has been profiled for your department...
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                onClick={() => onNavigate('practice')}
                className="px-4 py-2 bg-[#1a429b] hover:bg-[#15347a] text-white font-bold text-xs rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Browse All Available Courses</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          SECTION 5: KPI METRICS & STATS
          ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4" id="kpi-metrics-grid">
        
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Solved</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1e3a8a] border border-blue-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{totalCompleted}</p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Questions completed</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mock CBTs</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1565c0] border border-blue-100 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{mockCbtsCount}</p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Timed exam simulations</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Average Score</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-[#b45309] border border-amber-100 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{avgScore}%</p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Overall accuracy</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Study Streak</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-[#be123c] border border-rose-100 flex items-center justify-center">
              <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{streakInfo.streak}d</p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">{streakInfo.practicedToday ? 'Active today' : 'Pending practice'}</p>
        </div>

      </div>

      {/* Featured Banner: Pre-JAMB CBT Simulation */}
      <div className="w-full">
        <PreJambCbtCard
          onStartTest={() => onNavigate('pre_jamb')}
          onStartGuestMode={() => onNavigate('pre_jamb')}
        />
      </div>

      {/* Structured Two-Column Grid Layout for Dashboard Menu Items */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1a429b]"></span>
            Study & Examination Modules
          </h2>
          <span className="text-xs font-medium text-slate-500">
            6 Specialized CBT Tools
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5" id="dashboard-menu-grid">
          
          {/* Menu Item 1: Practice Questions */}
          <div
            onClick={() => onNavigate('practice')}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] hover:border-blue-500/50 rounded-xl p-5 sm:p-6 shadow-2xs hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
            id="menu-card-practice"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-11 h-11 rounded-lg bg-blue-50 text-[#1a429b] border border-blue-100 dark:bg-blue-950/40 dark:border-blue-800/40 dark:text-blue-300 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-xs font-black px-3 py-1 rounded-md bg-[#1a429b] dark:bg-blue-700 text-white shadow-2xs uppercase tracking-wide">
                  UTME & Degree
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-[#1a429b] transition-colors">
                Practice Questions
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Practice verified past questions filtered by Nigerian University, Faculty, Department, and Course. Get immediate step-by-step solutions and explanations.
              </p>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1a429b] flex items-center gap-1">
                Start Practice Mode
              </span>
              <div className="w-7 h-7 rounded-md bg-blue-50 text-[#1a429b] group-hover:bg-[#1a429b] group-hover:text-white transition-colors flex items-center justify-center">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Menu Item 2: Mock Exam Simulation */}
          <div
            onClick={() => onNavigate('mock_cbt')}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] hover:border-blue-500/50 rounded-xl p-5 sm:p-6 shadow-2xs hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
            id="menu-card-mock-cbt"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-11 h-11 rounded-lg bg-blue-50 text-[#1565c0] border border-blue-100 dark:bg-blue-950/40 dark:border-blue-800/40 dark:text-blue-300 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <span className="text-xs font-black px-3 py-1 rounded-md bg-blue-700 dark:bg-blue-600 text-white shadow-2xs uppercase tracking-wide">
                  Timed Exam Hall
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-[#1565c0] transition-colors">
                Mock Exam Simulation
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Experience full examination conditions with official countdown timer, authentic 8-key question palette, randomized questions, and instant score computation.
              </p>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1565c0] flex items-center gap-1">
                Launch Timed CBT Exam
              </span>
              <div className="w-7 h-7 rounded-md bg-blue-50 text-[#1565c0] group-hover:bg-[#1565c0] group-hover:text-white transition-colors flex items-center justify-center">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Menu Item 3: Classroom & Study Notes */}
          <div
            onClick={() => onNavigate('materials')}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] hover:border-amber-500/50 rounded-xl p-5 sm:p-6 shadow-2xs hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
            id="menu-card-classroom"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-11 h-11 rounded-lg bg-amber-50 text-[#b45309] border border-amber-100 dark:bg-amber-950/40 dark:border-amber-800/40 dark:text-amber-300 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <span className="text-xs font-black px-3 py-1 rounded-md bg-amber-700 dark:bg-amber-600 text-white shadow-2xs uppercase tracking-wide">
                  Notes & Handouts
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-[#b45309] transition-colors">
                Classroom & Study Notes
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Access verified university lecture summaries, key formula cheat sheets, syllabus revision guides, and step-by-step video lessons taught by top tutors.
              </p>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#b45309] flex items-center gap-1">
                Open Classroom Resources
              </span>
              <div className="w-7 h-7 rounded-md bg-amber-50 text-[#b45309] group-hover:bg-[#b45309] group-hover:text-white transition-colors flex items-center justify-center">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Menu Item 4: Question Search & Past Papers */}
          <div
            onClick={() => onNavigate('practice')}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] hover:border-indigo-500/50 rounded-xl p-5 sm:p-6 shadow-2xs hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
            id="menu-card-question-search"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-11 h-11 rounded-lg bg-indigo-50 text-[#4338ca] border border-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-800/40 dark:text-indigo-300 flex items-center justify-center">
                  <Search className="w-5 h-5" />
                </div>
                <span className="text-xs font-black px-3 py-1 rounded-md bg-indigo-700 dark:bg-indigo-600 text-white shadow-2xs uppercase tracking-wide">
                  Direct Search
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-[#4338ca] transition-colors">
                Question Search & Vault
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Search thousands of past questions by keyword, topic, subject code, or examination year. Target difficult concepts and review specific questions on demand.
              </p>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#4338ca] flex items-center gap-1">
                Search Past Questions
              </span>
              <div className="w-7 h-7 rounded-md bg-indigo-50 text-[#4338ca] group-hover:bg-[#4338ca] group-hover:text-white transition-colors flex items-center justify-center">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Menu Item 5: Performance Analysis */}
          <div
            onClick={() => onNavigate('performance')}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] hover:border-blue-500/50 rounded-xl p-5 sm:p-6 shadow-2xs hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
            id="menu-card-performance"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-11 h-11 rounded-lg bg-blue-50 text-[#0f766e] border border-blue-100 dark:bg-blue-950/40 dark:border-blue-800/40 dark:text-blue-300 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <span className="text-xs font-black px-3 py-1 rounded-md bg-blue-700 dark:bg-blue-600 text-white shadow-2xs uppercase tracking-wide">
                  Analytics & Score
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-[#0f766e] transition-colors">
                Performance Analysis
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Detailed diagnostic report of your practice sessions: accuracy per subject, average speed per question, topic mastery breakdown, and weakness alerts.
              </p>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#0f766e] flex items-center gap-1">
                View Full Diagnostics
              </span>
              <div className="w-7 h-7 rounded-md bg-blue-50 text-[#0f766e] group-hover:bg-[#0f766e] group-hover:text-white transition-colors flex items-center justify-center">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Menu Item 6: Leaderboard & Challenges */}
          <div
            onClick={() => onNavigate('leaderboard')}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] hover:border-rose-500/50 rounded-xl p-5 sm:p-6 shadow-2xs hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
            id="menu-card-leaderboard"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-11 h-11 rounded-lg bg-rose-50 text-[#be123c] border border-rose-100 dark:bg-rose-950/40 dark:border-rose-800/40 dark:text-rose-300 flex items-center justify-center">
                  <Award className="w-5 h-5" />
                </div>
                <span className="text-xs font-black px-3 py-1 rounded-md bg-rose-700 dark:bg-rose-600 text-white shadow-2xs uppercase tracking-wide">
                  National Ranking
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-[#be123c] transition-colors">
                Student Leaderboard & Contests
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Compare your scores with UTME and university students nationwide. Track weekly rankings, study streaks, and participate in peer challenges.
              </p>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#be123c] flex items-center gap-1">
                View National Leaderboard
              </span>
              <div className="w-7 h-7 rounded-md bg-rose-50 text-[#be123c] group-hover:bg-[#be123c] group-hover:text-white transition-colors flex items-center justify-center">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Two-Column Lower Content: Recent History + Study Streak & Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left Column: Recent Exam History (2 spans) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              Recent Practice & Exam History
            </h3>
            <button
              onClick={() => onNavigate('performance')}
              className="text-xs font-bold text-[#1a429b] hover:underline cursor-pointer"
            >
              View All History
            </button>
          </div>

          {recentSessions.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 bg-slate-50 dark:bg-white/[0.01] rounded-lg border border-dashed border-slate-200 dark:border-white/[0.06]">
              <p className="font-medium text-slate-700 dark:text-slate-300">No test attempts recorded yet.</p>
              <p className="text-slate-500 mt-0.5">Start your first practice session or mock exam to view your scores here.</p>
              <button
                onClick={() => onNavigate('practice')}
                className="mt-3 px-4 py-1.5 bg-[#1a429b] text-white font-semibold text-xs rounded-md shadow-2xs cursor-pointer"
              >
                Start First Practice
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3 bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-lg border border-slate-200 dark:border-white/[0.06] flex items-center justify-between text-xs transition-colors"
                >
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-200">{session.courseCode}: {session.courseTitle}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                      {session.type === 'mock_cbt' ? 'Mock CBT Exam' : 'Practice Mode'} • {session.totalQuestions} questions • {new Date(session.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold inline-block whitespace-nowrap ${
                      session.percentage >= 70
                        ? 'bg-blue-50 text-[#1a429b] border border-blue-200'
                        : session.percentage >= 50
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {session.score}/{session.totalQuestions} ({session.percentage}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Daily Streak Card & Bookmarks (1 span) */}
        <div className="space-y-5">
          
          {/* Daily Study Streak Banner */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl p-5 shadow-2xs" id="daily-study-streak-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                Daily Study Streak
              </span>
              <span className={`px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider shadow-2xs ${
                streakInfo.practicedToday
                  ? 'bg-blue-800 dark:bg-blue-700 text-white'
                  : 'bg-slate-800 dark:bg-slate-700 text-white'
              }`}>
                {streakInfo.practicedToday ? 'Saved Today' : 'Pending'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {streakInfo.streak} {streakInfo.streak === 1 ? 'Day' : 'Days'}
              </h3>
              <span className="text-xs text-slate-500 font-medium">consecutive</span>
            </div>

            {/* 7-Day Activity Matrix */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center justify-between">
                {weekDays.map((day, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1">
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold transition-all ${
                        day.isPracticed
                          ? 'bg-amber-100 border border-amber-300 text-amber-900'
                          : day.isToday
                          ? 'bg-slate-100 border-2 border-[#1a429b] text-[#1a429b]'
                          : 'bg-slate-100 border border-slate-200 text-slate-400'
                      }`}
                      title={`${day.dateStr} - ${day.isPracticed ? 'Practiced' : 'No Practice'}`}
                    >
                      {day.isPracticed ? (
                        <Flame className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
                      ) : (
                        <span>{day.dayNum}</span>
                      )}
                    </div>
                    <span className={`text-[9px] font-medium ${day.isToday ? 'text-[#1a429b] font-bold' : 'text-slate-500'}`}>
                      {day.dayName}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {!streakInfo.practicedToday && (
              <button
                onClick={() => onNavigate('practice')}
                className="mt-3.5 w-full py-2 bg-[#1a429b] hover:bg-[#143680] text-white font-bold text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                id="extend-streak-btn"
              >
                <Flame className="w-3.5 h-3.5 fill-white" />
                <span>Practice 1 Question to Keep Streak</span>
              </button>
            )}
          </div>

          {/* Bookmarks Quick Access */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-[#1a429b]" />
                Saved Bookmarks
              </h4>
              <span className="text-xs font-black px-2.5 py-1 rounded-md bg-slate-800 dark:bg-slate-700 text-white shadow-2xs">
                {user.bookmarks.length} saved
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 font-normal">
              Review difficult questions and formulas you marked for revision.
            </p>
            <button
              onClick={() => onNavigate('bookmarks')}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-slate-200 text-xs font-bold rounded-lg border border-slate-200 dark:border-white/[0.08] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>View Bookmarked Questions</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
