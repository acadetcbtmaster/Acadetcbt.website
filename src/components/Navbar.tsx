import React, { useState } from 'react';
import { UserProfile } from '../types';
import brandLogo from '../assets/images/exact_acadet_cbt_logo_1786225425882.jpg';
import {
  GraduationCap,
  Sparkles,
  User,
  Shield,
  LogOut,
  Bell,
  Menu,
  X,
  ArrowLeft,
  CreditCard,
  BookOpen,
  Award,
  ChevronDown,
  Flame,
  AlertTriangle,
  AlertCircle,
  Crown,
  Users,
  FileText,
  Sun,
  Moon,
  Smartphone,
  Download,
  Bookmark,
} from 'lucide-react';
import { getEffectiveStreak } from '../utils/streak';

interface NavbarProps {
  currentUser: UserProfile | null;
  activeTab: string;
  onNavigate: (tab: string) => void;
  onOpenAuth: (mode?: 'register' | 'login' | 'admin' | 'forgot') => void;
  onOpenSubscribe: () => void;
  onLogout: () => void;
  onSwitchRole?: (role: 'student' | 'admin') => void;
  onOpenEditProfile?: () => void;
  onOpenAbout?: () => void;
  onOpenFeaturesPdf?: () => void;
  onOpenInstallModal?: () => void;
  onOpenNotificationCenter?: () => void;
  themeMode?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export function Navbar({
  currentUser,
  activeTab,
  onNavigate,
  onOpenAuth,
  onOpenSubscribe,
  onLogout,
  onSwitchRole,
  onOpenEditProfile,
  onOpenAbout,
  onOpenFeaturesPdf,
  onOpenInstallModal,
  onOpenNotificationCenter,
  themeMode = 'light',
  onToggleTheme,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [moreNavOpen, setMoreNavOpen] = useState(false);

  const isLoggedIn = !!currentUser;
  const isPremium = currentUser?.subscription?.isPremium ?? false;
  const freeLimit = currentUser?.subscription?.freeLimit ?? 30;
  const questionsAttempted = currentUser?.subscription?.questionsAttemptedCount ?? 0;
  const remaining = Math.max(0, freeLimit - questionsAttempted);
  const planName = currentUser?.subscription?.plan || 'Free Trial';

  const limit80 = Math.floor(freeLimit * 0.8);
  const isAt80Percent = !isPremium && questionsAttempted >= limit80 && questionsAttempted < freeLimit;
  const isAt100Percent = !isPremium && questionsAttempted >= freeLimit;

  const notifications = [
    ...(isAt100Percent
      ? [
          {
            id: 'n-100',
            type: 'alert_100',
            title: 'Free Trial Expired (100% Limit)',
            text: `You have completed all ${freeLimit} free questions. Subscribe to Premium for unlimited practice.`,
            isUrgent: true,
          },
        ]
      : []),
    ...(isAt80Percent
      ? [
          {
            id: 'n-80',
            type: 'alert_80',
            title: 'Free Trial Warning (80% Used)',
            text: `You have completed ${questionsAttempted}/${freeLimit} free practice questions (${remaining} remaining).`,
            isUrgent: true,
          },
        ]
      : []),
    {
      id: 'n1',
      type: 'info',
      title: 'Free Questions Counter',
      text: isPremium ? 'Unlimited CBT Access Unlocked' : `${remaining} free practice questions remaining`,
    },
    { id: 'n2', type: 'info', title: 'New Course Materials Added', text: 'GST101 & MTH101 past questions 2023/2024 published.' },
  ];

  return (
    <>
      <header className={`sticky top-0 z-40 border-b shadow-sm transition-colors duration-200 w-full ${
        themeMode === 'light'
          ? 'bg-[#1e3a8a] border-[#172554] text-white'
          : 'bg-slate-900/95 border-slate-800 text-slate-100 backdrop-blur-md'
      }`} id="cbt-navbar">
      <div className="w-full max-w-7xl mx-auto px-2 xs:px-3 sm:px-4 lg:px-6 py-1.5 min-h-[4.25rem] sm:min-h-[4.75rem] flex items-center justify-between gap-1.5 sm:gap-3">
        
        {/* Left Section: Back Button (if on sub-tab) + Brand Logo & Title */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5 min-w-0 flex-1 sm:flex-initial">
          {activeTab !== 'dashboard' && activeTab !== 'landing' && (
            <button
              onClick={() => onNavigate(isLoggedIn ? 'dashboard' : 'landing')}
              className="p-1 sm:px-2 sm:py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1 text-xs font-semibold shrink-0 cursor-pointer border border-white/20"
              id="navbar-back-btn"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-white" />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}

          <div 
            onClick={() => onNavigate(isLoggedIn ? (currentUser?.role === 'admin' ? 'admin' : 'dashboard') : 'landing')} 
            className="flex items-center cursor-pointer group min-w-0"
            id="navbar-logo"
          >
            <div className="flex flex-col items-start justify-center min-w-0">
              {/* ACADET CBT MASTER is at the top only */}
              <span className="font-black text-sm xs:text-base sm:text-lg md:text-xl tracking-tight uppercase text-white leading-tight truncate">
                ACADET CBT MASTER
              </span>

              {/* Immediately at the bottom of the name */}
              <span className="text-[10px] xs:text-[11px] sm:text-xs font-semibold text-blue-100/90 leading-tight mt-0.5 tracking-normal truncate">
                Nigerian University Learning & CBT Practice Engine
              </span>

              {/* Theme Switcher Button */}
              {onToggleTheme && (
                <div 
                  className="flex items-center mt-1"
                  id="brand-middle-action-buttons"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="inline-flex items-center p-0.5 rounded-full bg-white/20 border border-white/30 shadow-xs leading-none"
                    id="brand-middle-theme-toggle"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (themeMode !== 'light') onToggleTheme();
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black transition-all cursor-pointer leading-none ${
                        themeMode === 'light'
                          ? 'bg-white text-blue-950 shadow-xs'
                          : 'text-white/80 hover:text-white'
                      }`}
                      title="Switch to Daylight Mode"
                      id="theme-btn-day"
                    >
                      <Sun className={`w-3 h-3 ${themeMode === 'light' ? 'text-amber-500 fill-amber-500/30' : 'text-slate-300'}`} />
                      <span>Day</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (themeMode !== 'dark') onToggleTheme();
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black transition-all cursor-pointer leading-none ${
                        themeMode === 'dark'
                          ? 'bg-slate-900 text-amber-300 shadow-xs'
                          : 'text-white/80 hover:text-white'
                      }`}
                      title="Switch to Night Mode"
                      id="theme-btn-night"
                    >
                      <Moon className={`w-3 h-3 ${themeMode === 'dark' ? 'text-indigo-400 fill-indigo-400/30' : 'text-slate-300'}`} />
                      <span>Night</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Desktop & Tablet Main Navigation - fitted and responsive */}
        

        {/* Right Section Actions - in front view across viewports */}
        <div className="flex items-center space-x-1 sm:space-x-2 shrink-0 z-30 relative" id="navbar-actions">

          {/* Daily Study Streak Badge (Extra wide screens) */}
          {isLoggedIn && currentUser?.role === 'student' && (
            <button
              onClick={() => onNavigate('dashboard')}
              className="hidden 2xl:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer"
              title="Daily Study Streak"
              id="navbar-streak-pill"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>{getEffectiveStreak(currentUser).streak}d Streak</span>
            </button>
          )}

          {/* Subscription Status Pill (Extra wide screens) */}
          {isLoggedIn && currentUser?.role === 'student' && (
            <button
              onClick={onOpenSubscribe}
              className="hidden 2xl:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all bg-blue-500/10 text-blue-300 border-blue-500/30 hover:bg-blue-500/20"
              id="subscription-pill-btn"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Full Access</span>
            </button>
          )}

          {/* Quick Direct Download App Button */}
          {onOpenInstallModal && (
            <button
              onClick={onOpenInstallModal}
              className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
              title="Download & Install Mobile App Suite"
              id="navbar-download-app-btn"
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-200" />
              <span className="hidden sm:inline">Download App</span>
              <Download className="w-3 h-3 text-white/90" />
            </button>
          )}

          {/* Download Features PDF Button (Extra wide screens) */}
          {onOpenFeaturesPdf && (
            <button
              onClick={onOpenFeaturesPdf}
              className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm"
              title="Download Platform Features PDF Document"
              id="navbar-features-pdf-btn"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>PDF</span>
            </button>
          )}

          {/* User Auth or User Profile Menu */}
          {isLoggedIn && currentUser ? (
            <div className="relative shrink-0">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center space-x-1.5 p-1 sm:p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-colors shrink-0"
                id="user-profile-menu-btn"
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="text-xs font-medium text-white hidden lg:inline max-w-[80px] truncate">
                  {currentUser.name}
                </span>
                <ChevronDown className="w-3 h-3 text-white/80" />
              </button>

              {userDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-1.5 z-50 divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200 animate-in fade-in zoom-in-95"
                  id="navbar-user-dropdown"
                >
                  <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-950/40">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{currentUser.email}</p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded shadow-xs uppercase tracking-wider ${
                        currentUser.role === 'admin'
                          ? 'bg-amber-600 text-white'
                          : 'bg-indigo-600 text-white'
                      }`}>
                        {currentUser.role}
                      </span>
                      <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded shadow-xs ${
                        isPremium
                          ? 'bg-[#1e3a8a] text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {isPremium ? 'Premium Active' : 'Free Trial'}
                      </span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onNavigate(currentUser.role === 'admin' ? 'admin' : 'dashboard');
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer"
                      id="dropdown-item-dashboard"
                    >
                      <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <span>{currentUser.role === 'admin' ? 'Admin Dashboard' : 'Student Dashboard'}</span>
                    </button>
                    {currentUser.role === 'student' && (
                      <>
                        <button
                          onClick={() => {
                            setUserDropdownOpen(false);
                            if (onOpenEditProfile) onOpenEditProfile();
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer"
                          id="dropdown-item-edit-profile"
                        >
                          <User className="w-4 h-4 text-[#1e3a8a] dark:text-blue-400" />
                          <span>Edit Profile</span>
                        </button>
                        <button
                          onClick={() => {
                            setUserDropdownOpen(false);
                            onOpenSubscribe();
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer"
                          id="dropdown-item-subscription"
                        >
                          <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>Subscription & Plans</span>
                        </button>
                      </>
                    )}

                    {onOpenFeaturesPdf && (
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onOpenFeaturesPdf();
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer"
                        id="dropdown-item-features-pdf"
                      >
                        <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>Download Features PDF</span>
                      </button>
                    )}

                    {onOpenInstallModal && (
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onOpenInstallModal();
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs text-[#1e3a8a] dark:text-blue-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-900 dark:hover:text-blue-200 flex items-center gap-2.5 font-bold transition-colors cursor-pointer"
                        id="dropdown-item-install-app"
                      >
                        <Smartphone className="w-4 h-4 text-[#1e3a8a] dark:text-blue-400" />
                        <span>Install Mobile App Suite</span>
                      </button>
                    )}
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 transition-colors cursor-pointer"
                      id="dropdown-item-logout"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0" id="guest-auth-actions">
              <button
                onClick={() => onOpenAuth('login')}
                className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold text-slate-100 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 transition-colors cursor-pointer shrink-0"
                id="login-trigger-btn"
              >
                Sign In
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="hidden xs:inline-flex px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-all cursor-pointer shrink-0"
                id="register-trigger-btn"
              >
                Get Started
              </button>
            </div>
          )}

          {/* Notifications Icon Button - in front view on all viewports at top right */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenNotificationCenter) {
                onOpenNotificationCenter();
              } else {
                setNotificationsOpen(!notificationsOpen);
              }
            }}
            className="flex items-center justify-center p-1.5 sm:p-2 text-white hover:text-amber-200 rounded-lg bg-white/20 hover:bg-white/30 active:scale-95 border border-white/30 transition-all relative cursor-pointer shrink-0 shadow-sm z-30"
            id="notification-bell-btn"
            title="Notifications & Updates"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4 text-amber-200 fill-amber-200/20" />
            <span className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full ${
              isAt100Percent
                ? 'bg-rose-500 animate-ping'
                : isAt80Percent
                ? 'bg-amber-400 animate-pulse'
                : 'bg-blue-300'
            }`} />
          </button>

          {/* Side Button at the top right corner - in front view on all screen sizes */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMobileMenuOpen((prev) => !prev);
            }}
            className="flex items-center justify-center p-1.5 sm:p-2 rounded-lg bg-white/20 hover:bg-white/30 active:scale-95 text-white border border-white/30 shadow-sm shrink-0 cursor-pointer transition-all z-30"
            id="mobile-menu-toggle-btn"
            aria-label="Toggle navigation menu"
            title="Side Menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4 text-white" /> : <Menu className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>

      {/* Fitted Screen Navigation Bar - Displays all navigation items cleanly fitted on the screen */}
      <nav 
        className="w-full border-t border-white/20 dark:border-slate-800/80 bg-black/15 dark:bg-slate-950/70 backdrop-blur-xs"
        id="fitted-screen-navbar"
      >
        <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-1.5 flex items-center justify-start md:justify-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
          {isLoggedIn ? (
            <>
              {currentUser?.role === 'student' ? (
                <>
                  <button
                    onClick={() => onNavigate('dashboard')}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'dashboard'
                        ? themeMode === 'light'
                          ? 'bg-white text-[#172554] shadow-xs font-black'
                          : 'bg-[#1e3a8a] text-white shadow-xs font-black'
                        : themeMode === 'light'
                        ? 'text-blue-100 hover:text-white hover:bg-white/15'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                    id="nav-btn-dashboard"
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => onNavigate('practice')}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'practice'
                        ? themeMode === 'light'
                          ? 'bg-white text-[#172554] shadow-xs font-black'
                          : 'bg-[#1e3a8a] text-white shadow-xs font-black'
                        : themeMode === 'light'
                        ? 'text-blue-100 hover:text-white hover:bg-white/15'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                    id="nav-btn-practice"
                  >
                    Practice Mode
                  </button>
                  <button
                    onClick={() => onNavigate('mock_cbt')}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'mock_cbt'
                        ? themeMode === 'light'
                          ? 'bg-white text-[#172554] shadow-xs font-black'
                          : 'bg-[#1e3a8a] text-white shadow-xs font-black'
                        : themeMode === 'light'
                        ? 'text-blue-100 hover:text-white hover:bg-white/15'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                    id="nav-btn-mock-cbt"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Mock CBT</span>
                  </button>
                  <button
                    onClick={() => onNavigate('pre_jamb')}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'pre_jamb'
                        ? 'bg-amber-400 text-slate-950 shadow-sm border border-amber-300'
                        : 'text-amber-300 hover:text-white hover:bg-amber-500/20'
                    }`}
                    id="nav-btn-pre-jamb"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Pre-JAMB CBT</span>
                  </button>
                  <button
                    onClick={() => onNavigate('community')}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'community'
                        ? themeMode === 'light'
                          ? 'bg-white text-[#172554] shadow-xs font-black'
                          : 'bg-[#1e3a8a] text-white shadow-xs font-black'
                        : themeMode === 'light'
                        ? 'text-blue-100 hover:text-white hover:bg-white/15'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                    id="nav-btn-community"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Community</span>
                  </button>
                  <button
                    onClick={() => onNavigate('materials')}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'materials'
                        ? themeMode === 'light'
                          ? 'bg-white text-[#172554] shadow-xs font-black'
                          : 'bg-[#1e3a8a] text-white shadow-xs font-black'
                        : themeMode === 'light'
                        ? 'text-blue-100 hover:text-white hover:bg-white/15'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                    id="nav-btn-materials"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Study Materials</span>
                  </button>
                  <button
                    onClick={() => onNavigate('leaderboard')}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'leaderboard'
                        ? 'bg-amber-400 text-slate-950 shadow-sm border border-amber-300 font-black'
                        : 'text-amber-300 hover:text-white hover:bg-amber-500/20'
                    }`}
                    id="nav-btn-leaderboard"
                  >
                    <Award className="w-3.5 h-3.5 text-amber-300" />
                    <span>Leaderboard</span>
                  </button>
                  <button
                    onClick={() => onNavigate('performance')}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'performance'
                        ? themeMode === 'light'
                          ? 'bg-white text-[#172554] shadow-xs font-black'
                          : 'bg-[#1e3a8a] text-white shadow-xs font-black'
                        : themeMode === 'light'
                        ? 'text-blue-100 hover:text-white hover:bg-white/15'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                    id="nav-btn-performance"
                  >
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                    <span>Analytics</span>
                  </button>
                  <button
                    onClick={() => onNavigate('bookmarks')}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'bookmarks'
                        ? themeMode === 'light'
                          ? 'bg-white text-[#172554] shadow-xs font-black'
                          : 'bg-[#1e3a8a] text-white shadow-xs font-black'
                        : themeMode === 'light'
                        ? 'text-blue-100 hover:text-white hover:bg-white/15'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                    id="nav-btn-bookmarks"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-amber-300" />
                    <span>Saved</span>
                  </button>
                  <button
                    onClick={() => onOpenAbout && onOpenAbout()}
                    className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold text-blue-100 hover:text-white hover:bg-white/15 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                    id="nav-btn-about-menu"
                  >
                    About Acadet
                  </button>
                  <button
                    onClick={() => onNavigate('founder')}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'founder'
                        ? 'bg-amber-400 text-slate-950 shadow-sm border border-amber-300'
                        : 'text-amber-300 hover:text-white hover:bg-amber-500/20'
                    }`}
                    id="nav-btn-founder"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Founder: Menmex</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => onNavigate('admin')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'admin'
                        ? themeMode === 'light'
                          ? 'bg-white text-[#172554] shadow-xs font-black'
                          : 'bg-indigo-600 text-white shadow-xs font-black'
                        : 'text-slate-200 hover:text-white hover:bg-white/15'
                    }`}
                    id="nav-btn-admin-portal"
                  >
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span>Admin Portal</span>
                  </button>
                  <button
                    onClick={() => onOpenAbout && onOpenAbout()}
                    className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold text-slate-200 hover:text-white hover:bg-white/15 transition-all shrink-0 cursor-pointer"
                    id="nav-btn-about-admin"
                  >
                    About Acadet
                  </button>
                  <button
                    onClick={() => onNavigate('founder')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'founder'
                        ? 'bg-amber-400 text-slate-950 shadow-sm'
                        : 'text-amber-300 hover:text-white hover:bg-amber-500/20'
                    }`}
                    id="nav-btn-founder-admin"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Founder: Menmex</span>
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => onNavigate('landing')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'landing'
                    ? themeMode === 'light'
                      ? 'bg-white text-[#172554] shadow-xs font-black'
                      : 'bg-[#1e3a8a] text-white shadow-xs font-black'
                    : 'text-white/90 hover:text-white hover:bg-white/15'
                }`}
                id="nav-btn-home"
              >
                Home
              </button>
              <button
                onClick={() => onNavigate('pre_jamb')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'pre_jamb'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-amber-300 hover:text-white hover:bg-amber-500/20'
                }`}
                id="nav-btn-guest-pre-jamb"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Pre-JAMB CBT</span>
              </button>
              <button
                onClick={() => {
                  onNavigate('landing');
                  setTimeout(() => {
                    document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold text-white/90 hover:text-white hover:bg-white/15 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                id="nav-btn-features"
              >
                Features
              </button>
              <button
                onClick={() => {
                  onNavigate('landing');
                  setTimeout(() => {
                    document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold text-white/90 hover:text-white hover:bg-white/15 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                id="nav-btn-pricing"
              >
                Pricing
              </button>
              <button
                onClick={() => {
                  onNavigate('landing');
                  setTimeout(() => {
                    document.getElementById('about-acadet-section')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold text-blue-100 hover:text-white hover:bg-white/15 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                id="nav-btn-about"
              >
                About Acadet
              </button>
              <button
                onClick={() => onNavigate('founder')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'founder'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-amber-300 hover:text-white hover:bg-amber-500/20'
                }`}
                id="nav-btn-founder"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Founder: Menmex</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div
          className={`px-4 pt-2 pb-4 space-y-2 border-b animate-in slide-in-from-top-3 ${
            themeMode === 'light'
              ? 'bg-[#172554] border-[#0f172a] text-white shadow-xl'
              : 'bg-slate-900 border-slate-800 text-slate-200'
          }`}
          id="mobile-drawer"
        >
          {isLoggedIn ? (
            <>
              {currentUser?.role === 'student' ? (
                <>
                  <button
                    onClick={() => { onNavigate('dashboard'); setMobileMenuOpen(false); }}
                    className="block w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded-lg"
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => { onNavigate('practice'); setMobileMenuOpen(false); }}
                    className="block w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded-lg"
                  >
                    Practice Mode
                  </button>
                  <button
                    onClick={() => { onNavigate('pre_jamb'); setMobileMenuOpen(false); }}
                    className="block w-full text-left px-3 py-2 text-sm text-blue-300 font-bold hover:bg-slate-800 rounded-lg"
                  >
                    Pre-JAMB CBT
                  </button>
                  <button
                    onClick={() => { onNavigate('mock_cbt'); setMobileMenuOpen(false); }}
                    className="block w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded-lg"
                  >
                    Mock CBT Practice Engine
                  </button>
                  <button
                    onClick={() => { onNavigate('community'); setMobileMenuOpen(false); }}
                    className="block w-full text-left px-3 py-2 text-sm text-indigo-300 font-bold hover:bg-slate-800 rounded-lg"
                  >
                    Learning Community
                  </button>
                  <button
                    onClick={() => { onNavigate('leaderboard'); setMobileMenuOpen(false); }}
                    className="block w-full text-left px-3 py-2 text-sm text-amber-300 font-bold hover:bg-slate-800 rounded-lg"
                  >
                    Student Leaderboard
                  </button>
                  <button
                    onClick={() => { onNavigate('performance'); setMobileMenuOpen(false); }}
                    className="block w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded-lg"
                  >
                    Performance Analytics
                  </button>
                  <button
                    onClick={() => { onNavigate('bookmarks'); setMobileMenuOpen(false); }}
                    className="block w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded-lg"
                  >
                    Saved Bookmarks
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { onNavigate('admin'); setMobileMenuOpen(false); }}
                  className="block w-full text-left px-3 py-2 text-sm text-amber-300 hover:bg-slate-800 rounded-lg font-semibold"
                >
                  Admin Portal
                </button>
              )}
              {onOpenInstallModal && (
                <button
                  onClick={() => { onOpenInstallModal(); setMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-[#1e3a8a] rounded-lg flex items-center justify-between shadow"
                >
                  <span className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    Download & Install Mobile App
                  </span>
                  <Download className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => { onNavigate('founder'); setMobileMenuOpen(false); }}
                className="block w-full text-left px-3 py-2 text-sm text-amber-400 font-bold hover:bg-slate-800 rounded-lg"
              >
                Founder: Menmex
              </button>
              <button
                onClick={() => { onOpenSubscribe(); setMobileMenuOpen(false); }}
                className="block w-full text-left px-3 py-2 text-sm text-indigo-400 hover:bg-slate-800 rounded-lg font-medium"
              >
                Subscription Plans
              </button>
              <button
                onClick={() => { onLogout(); setMobileMenuOpen(false); }}
                className="block w-full text-left px-3 py-2 text-sm text-rose-400 hover:bg-slate-800 rounded-lg"
              >
                Sign Out
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2 pt-2">
              {onOpenInstallModal && (
                <button
                  onClick={() => { onOpenInstallModal(); setMobileMenuOpen(false); }}
                  className="w-full text-center px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-[#1e3a8a] hover:from-indigo-500 hover:to-blue-900 text-white font-extrabold rounded-lg text-xs flex items-center justify-center gap-2 shadow"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Download & Install Mobile App</span>
                  <Download className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => { onNavigate('founder'); setMobileMenuOpen(false); }}
                className="w-full text-center px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold rounded-lg border border-amber-500/30 text-xs flex items-center justify-center gap-1.5"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Founder: Menmex</span>
              </button>
              <button
                onClick={() => { onOpenAuth('login'); setMobileMenuOpen(false); }}
                className="w-full text-center px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg border border-slate-700 text-xs"
              >
                Sign In
              </button>
              <button
                onClick={() => { onOpenAuth('register'); setMobileMenuOpen(false); }}
                className="w-full text-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs"
              >
                Create Student Account / Get Started
              </button>
            </div>
          )}
        </div>
      )}
    </header>

    {/* Centered Notifications Popup Modal (Outside header to ensure viewport centering) */}
    {notificationsOpen && (
      <div
        className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in zoom-in-95"
        id="notifications-modal-overlay"
      >
        <div
          className="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-7 max-w-lg w-full shadow-2xl relative text-left flex flex-col space-y-4 max-h-[85vh] my-auto"
          id="notifications-modal-content"
        >
          {/* Modal Top Navigation Header Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0 z-10">
            {/* Top Left Back Arrow Button */}
            <button
              onClick={() => setNotificationsOpen(false)}
              className="p-2 text-slate-300 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-bold border border-slate-700 cursor-pointer shadow-sm"
              id="notifications-modal-back-btn"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4 text-indigo-400" />
              <span>Back</span>
            </button>

            {/* Center Title */}
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-400 animate-bounce" />
              <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight uppercase">
                Notifications ({notifications.length})
              </span>
            </div>

            {/* Top Right Cancel Button */}
            <button
              onClick={() => setNotificationsOpen(false)}
              className="p-2 text-slate-300 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-bold border border-slate-700 cursor-pointer shadow-sm"
              id="notifications-modal-cancel-btn"
              title="Cancel / Close"
            >
              <span>Cancel</span>
              <X className="w-4 h-4 text-rose-400" />
            </button>
          </div>

          {/* Notifications List Content - Fully Scrollable */}
          <div className="overflow-y-auto space-y-3.5 pr-1.5 custom-scrollbar max-h-[65vh]">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 rounded-2xl text-xs border transition-all ${
                  n.type === 'alert_100'
                    ? 'bg-rose-950/60 border-rose-500/50 text-rose-200 shadow-md shadow-rose-900/20'
                    : n.type === 'alert_80'
                    ? 'bg-amber-950/60 border-amber-500/50 text-amber-200 shadow-md shadow-amber-900/20'
                    : 'bg-slate-950/80 border-slate-800 text-slate-300 shadow-md'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="text-sm font-extrabold text-white">{n.title}</span>
                </div>
                <p className="text-slate-300 mt-2 leading-relaxed text-xs sm:text-sm">{n.text}</p>
                {(n.type === 'alert_80' || n.type === 'alert_100') && (
                  <button
                    onClick={() => {
                      setNotificationsOpen(false);
                      onOpenSubscribe();
                    }}
                    className="mt-3.5 w-full py-2.5 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Crown className="w-4 h-4 text-amber-200" />
                    Upgrade to Premium Plan
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
  </>
  );
}
