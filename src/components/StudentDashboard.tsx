import React from 'react';
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
  AlertCircle,
  Smartphone,
  Download,
  WifiOff,
  Search,
  GraduationCap,
  ChevronRight,
  BarChart3,
  Clock,
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
  onNavigate,
  onOpenSubscribe,
  onOpenEditProfile,
  onOpenSignUp,
  onOpenInstallModal,
}) => {
  const isGuest = user?.isGuest ?? false;
  const isPremium = user?.subscription?.isPremium ?? false;
  const questionsUsed = user?.subscription?.questionsAttemptedCount ?? 0;
  const freeLimit = user?.subscription?.freeLimit ?? 30;
  const freeRemaining = Math.max(0, freeLimit - questionsUsed);

  // Streak calculations
  const streakInfo = getEffectiveStreak(user);
  const weekDays = getLast7DaysStreakStatus(user);

  // Calculate metrics
  const totalCompleted = results.reduce((acc, r) => acc + (r.totalQuestions || 0), 0) + questionsUsed;
  const mockCbtsCount = results.filter((r) => r.type === 'mock_cbt').length;
  
  const avgScore = results.length > 0
    ? Math.round(results.reduce((acc, r) => acc + (r.percentage || 0), 0) / results.length)
    : 78;

  const highestScore = results.length > 0
    ? results.reduce((max, r) => Math.max(max, r.percentage || 0), 0)
    : 92;

  const recentSessions = results.slice(0, 4);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6" id="student-dashboard">
      
      {/* Top Welcome & Quick Actions Bar */}
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl p-5 sm:p-6 shadow-xs"
        id="dashboard-welcome-banner"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-md text-xs font-black flex items-center gap-1.5 bg-[#1e3a8a] text-white shadow-xs tracking-wide">
                <Crown className="w-3.5 h-3.5 text-amber-300" />
                UTME & Nigerian University CBT Portal
              </span>
              {isPremium && (
                <span className="px-2.5 py-1 rounded-md text-xs font-black bg-amber-600 text-white shadow-xs uppercase tracking-wider">
                  Premium Student
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 mt-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Welcome back, {user.name}!
              </h1>
              {onOpenEditProfile && (
                <button
                  onClick={onOpenEditProfile}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-slate-300 dark:hover:text-white text-xs font-medium rounded-md border border-slate-200 dark:border-white/[0.08] transition-colors cursor-pointer"
                  title="Edit Profile"
                  id="dashboard-edit-profile-btn"
                >
                  Edit Profile
                </button>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-xl font-normal leading-relaxed">
              Prepare for UTME, Post-UTME, and 100-Level University examinations with verified past questions and timed CBT simulations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {!isPremium ? (
              <button
                onClick={onOpenSubscribe}
                className="px-4 py-2.5 bg-[#ea580c] hover:bg-[#c2410c] text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                id="dashboard-upgrade-btn"
              >
                <Crown className="w-4 h-4 text-amber-200" />
                <span>Upgrade to Premium</span>
              </button>
            ) : (
              <div className="px-3.5 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-[#1e3a8a] font-bold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Unlimited Access Active</span>
              </div>
            )}
            <button
              onClick={() => onNavigate('practice')}
              className="px-5 py-2.5 bg-[#1e3a8a] hover:bg-[#172554] text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              id="dashboard-quick-practice-btn"
            >
              <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
              <span>Continue Practice</span>
            </button>
          </div>
        </div>

        {/* Free Trial Usage Bar (if not premium) */}
        {!isPremium && (
          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-white/[0.08] space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white">Free Practice Allowance:</span>
                <span className={`text-xs px-2.5 py-1 rounded-md font-black shadow-xs cbt-badge-white !text-white ${
                  questionsUsed >= freeLimit
                    ? 'bg-rose-700 dark:bg-rose-600'
                    : questionsUsed >= Math.floor(freeLimit * 0.8)
                    ? 'bg-amber-700 dark:bg-amber-600'
                    : 'bg-[#1e3a8a] dark:bg-blue-700'
                }`}>
                  {freeRemaining} Questions Remaining
                </span>
              </div>
              <span className="text-slate-500">
                Limit: <strong className="text-slate-800 dark:text-slate-200">{freeLimit} Questions</strong> • Used: <strong className={questionsUsed >= freeLimit ? 'text-rose-600' : 'text-slate-800 dark:text-slate-200'}>{questionsUsed}</strong>
              </span>
            </div>

            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-white/[0.06]">
              <div
                className={`h-full transition-all duration-500 ${
                  questionsUsed >= freeLimit
                    ? 'bg-rose-500'
                    : questionsUsed >= Math.floor(freeLimit * 0.8)
                    ? 'bg-amber-500'
                    : 'bg-[#1e3a8a]'
                }`}
                style={{ width: `${Math.min(100, (questionsUsed / freeLimit) * 100)}%` }}
              ></div>
            </div>

            {questionsUsed >= Math.floor(freeLimit * 0.8) && questionsUsed < freeLimit && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <p className="text-amber-900 font-medium">
                    You have used <strong>{questionsUsed} of {freeLimit}</strong> free questions. Upgrade to Premium for unrestricted test access.
                  </p>
                </div>
                <button
                  onClick={onOpenSubscribe}
                  className="px-3.5 py-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white font-bold rounded-md text-xs shrink-0 cursor-pointer"
                >
                  Upgrade Now
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4" id="kpi-metrics-grid">
        
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Solved</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1e3a8a] border border-blue-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{totalCompleted}</p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Questions completed</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mock CBTs</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1565c0] border border-blue-100 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{mockCbtsCount}</p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Timed exam simulations</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Average Score</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-[#b45309] border border-amber-100 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{avgScore}%</p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Overall accuracy</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 sm:p-5 shadow-xs">
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
            <span className="w-2.5 h-2.5 rounded-full bg-[#1e3a8a]"></span>
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
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] hover:border-blue-500/50 rounded-xl p-5 sm:p-6 shadow-xs hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
            id="menu-card-practice"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-11 h-11 rounded-lg bg-blue-50 text-[#1e3a8a] border border-blue-100 dark:bg-blue-950/40 dark:border-blue-800/40 dark:text-blue-300 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-xs font-black px-3 py-1 rounded-md bg-[#1e3a8a] dark:bg-blue-700 text-white shadow-xs uppercase tracking-wide">
                  UTME & Degree
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-[#1e3a8a] transition-colors">
                Practice Questions
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Practice verified past questions filtered by Nigerian University, Faculty, Department, and Course. Get immediate step-by-step solutions and explanations.
              </p>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1e3a8a] flex items-center gap-1">
                Start Practice Mode
              </span>
              <div className="w-7 h-7 rounded-md bg-blue-50 text-[#1e3a8a] group-hover:bg-[#1e3a8a] group-hover:text-white transition-colors flex items-center justify-center">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Menu Item 2: Mock Exam Simulation */}
          <div
            onClick={() => onNavigate('mock_cbt')}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] hover:border-blue-500/50 rounded-xl p-5 sm:p-6 shadow-xs hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
            id="menu-card-mock-cbt"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-11 h-11 rounded-lg bg-blue-50 text-[#1565c0] border border-blue-100 dark:bg-blue-950/40 dark:border-blue-800/40 dark:text-blue-300 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <span className="text-xs font-black px-3 py-1 rounded-md bg-blue-700 dark:bg-blue-600 text-white shadow-xs uppercase tracking-wide">
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
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] hover:border-amber-500/50 rounded-xl p-5 sm:p-6 shadow-xs hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
            id="menu-card-classroom"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-11 h-11 rounded-lg bg-amber-50 text-[#b45309] border border-amber-100 dark:bg-amber-950/40 dark:border-amber-800/40 dark:text-amber-300 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <span className="text-xs font-black px-3 py-1 rounded-md bg-amber-700 dark:bg-amber-600 text-white shadow-xs uppercase tracking-wide">
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
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] hover:border-indigo-500/50 rounded-xl p-5 sm:p-6 shadow-xs hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
            id="menu-card-question-search"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-11 h-11 rounded-lg bg-indigo-50 text-[#4338ca] border border-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-800/40 dark:text-indigo-300 flex items-center justify-center">
                  <Search className="w-5 h-5" />
                </div>
                <span className="text-xs font-black px-3 py-1 rounded-md bg-indigo-700 dark:bg-indigo-600 text-white shadow-xs uppercase tracking-wide">
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
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] hover:border-blue-500/50 rounded-xl p-5 sm:p-6 shadow-xs hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
            id="menu-card-performance"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-11 h-11 rounded-lg bg-blue-50 text-[#0f766e] border border-blue-100 dark:bg-blue-950/40 dark:border-blue-800/40 dark:text-blue-300 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <span className="text-xs font-black px-3 py-1 rounded-md bg-blue-700 dark:bg-blue-600 text-white shadow-xs uppercase tracking-wide">
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
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] hover:border-rose-500/50 rounded-xl p-5 sm:p-6 shadow-xs hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
            id="menu-card-leaderboard"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-11 h-11 rounded-lg bg-rose-50 text-[#be123c] border border-rose-100 dark:bg-rose-950/40 dark:border-rose-800/40 dark:text-rose-300 flex items-center justify-center">
                  <Award className="w-5 h-5" />
                </div>
                <span className="text-xs font-black px-3 py-1 rounded-md bg-rose-700 dark:bg-rose-600 text-white shadow-xs uppercase tracking-wide">
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
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              Recent Practice & Exam History
            </h3>
            <button
              onClick={() => onNavigate('performance')}
              className="text-xs font-bold text-[#1e3a8a] hover:underline cursor-pointer"
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
                className="mt-3 px-4 py-1.5 bg-[#1e3a8a] text-white font-semibold text-xs rounded-md shadow-xs cursor-pointer"
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
                        ? 'bg-blue-50 text-[#1e3a8a] border border-blue-200'
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

        {/* Right Column: Daily Streak Card & Offline App (1 span) */}
        <div className="space-y-5">
          
          {/* Daily Study Streak Banner */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl p-5 shadow-xs" id="daily-study-streak-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                Daily Study Streak
              </span>
              <span className={`px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider shadow-xs ${
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
                          ? 'bg-slate-100 border-2 border-[#1e3a8a] text-[#1e3a8a]'
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
                    <span className={`text-[9px] font-medium ${day.isToday ? 'text-[#1e3a8a] font-bold' : 'text-slate-500'}`}>
                      {day.dayName}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {!streakInfo.practicedToday && (
              <button
                onClick={() => onNavigate('practice')}
                className="mt-3.5 w-full py-2 bg-[#1e3a8a] hover:bg-[#172554] text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                id="extend-streak-btn"
              >
                <Flame className="w-3.5 h-3.5 fill-white" />
                <span>Practice 1 Question to Keep Streak</span>
              </button>
            )}
          </div>

          {/* Bookmarks Quick Access */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-[#1e3a8a]" />
                Saved Bookmarks
              </h4>
              <span className="text-xs font-black px-2.5 py-1 rounded-md bg-slate-800 dark:bg-slate-700 text-white shadow-xs">
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

          {/* Mobile Suite App Card */}
          {onOpenInstallModal && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-blue-50 text-[#1e3a8a] border border-blue-100 flex items-center justify-center">
                    <Smartphone className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Mobile CBT App</h4>
                    <p className="text-[10px] text-[#1e3a8a] font-bold flex items-center gap-1">
                      <WifiOff className="w-2.5 h-2.5" /> Works 100% Offline
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black bg-[#1e3a8a] dark:bg-blue-700 text-white shadow-xs px-2.5 py-1 rounded-md uppercase tracking-wider">
                  Free
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 font-normal">
                Install Acadet CBT MASTER to your Android, iOS, or PC for zero-latency practice.
              </p>
              <button
                onClick={onOpenInstallModal}
                className="w-full py-2 bg-[#1e3a8a] hover:bg-[#172554] text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                id="dashboard-download-app-btn"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install & Download App</span>
              </button>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
