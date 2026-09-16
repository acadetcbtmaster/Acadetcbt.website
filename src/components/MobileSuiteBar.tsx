import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Zap,
  BookOpen,
  FolderDown,
  Menu,
  X,
  Smartphone,
  Download,
  Award,
  Users,
  BarChart3,
  Bookmark,
  Sun,
  Moon,
  Shield,
  User,
  LogOut,
  Sparkles,
  Flame,
  FileText,
  CreditCard,
  Crown,
  Bell
} from 'lucide-react';
import { UserProfile } from '../types';
import { getEffectiveStreak } from '../utils/streak';
import brandLogo from '../assets/images/exact_acadet_cbt_logo_1786225425882.jpg';

interface MobileSuiteBarProps {
  currentUser: UserProfile | null;
  activeTab: string;
  onNavigate: (tab: string) => void;
  onOpenAuth: (mode?: 'register' | 'login' | 'admin' | 'forgot') => void;
  onOpenSubscribe: () => void;
  onOpenInstallModal: () => void;
  onOpenEditProfile?: () => void;
  onOpenAbout?: () => void;
  onOpenFeaturesPdf?: () => void;
  onOpenNotificationCenter?: () => void;
  onLogout: () => void;
  themeMode: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const MobileSuiteBar: React.FC<MobileSuiteBarProps> = ({
  currentUser,
  activeTab,
  onNavigate,
  onOpenAuth,
  onOpenSubscribe,
  onOpenInstallModal,
  onOpenEditProfile,
  onOpenAbout,
  onOpenFeaturesPdf,
  onOpenNotificationCenter,
  onLogout,
  themeMode,
  onToggleTheme,
}) => {
  const [suiteMenuOpen, setSuiteMenuOpen] = useState(false);
  const isLoggedIn = !!currentUser;
  const isStudent = currentUser?.role === 'student';
  const isAdmin = currentUser?.role === 'admin';
  const streakData = currentUser ? getEffectiveStreak(currentUser) : null;

  useEffect(() => {
    if (suiteMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [suiteMenuOpen]);

  return (
    <>
      {/* Bottom Floating Mobile Suite Navigation Bar */}
      <nav
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-xl transition-colors duration-200 ${
          themeMode === 'light'
            ? 'bg-white/95 border-slate-200 text-slate-800 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]'
            : 'bg-slate-950/95 border-slate-800/90 text-slate-200 shadow-[0_-4px_25px_rgba(0,0,0,0.5)]'
        }`}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
        id="mobile-suite-bottom-bar"
      >
        <div className="max-w-md mx-auto px-2 py-1.5 grid grid-cols-5 gap-1 items-center justify-around">
          
          {/* Tab 1: Home / Dashboard */}
          <button
            onClick={() => {
              if (isLoggedIn) {
                onNavigate(isAdmin ? 'admin' : 'dashboard');
              } else {
                onNavigate('landing');
              }
            }}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'dashboard' || activeTab === 'landing' || activeTab === 'admin'
                ? themeMode === 'light'
                  ? 'text-[#1e3a8a] font-bold'
                  : 'text-blue-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            id="mobile-nav-tab-home"
          >
            <div className="relative p-1">
              <LayoutDashboard className="w-5 h-5" />
              {(activeTab === 'dashboard' || activeTab === 'landing' || activeTab === 'admin') && (
                <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#1e3a8a] dark:bg-blue-400"></span>
              )}
            </div>
            <span className="text-[10px] tracking-tight whitespace-nowrap">
              {isAdmin ? 'Admin' : isLoggedIn ? 'Dashboard' : 'Home'}
            </span>
          </button>

          {/* Tab 2: Practice */}
          <button
            onClick={() => {
              if (isLoggedIn) {
                onNavigate('practice');
              } else {
                onOpenAuth('login');
              }
            }}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'practice'
                ? themeMode === 'light'
                  ? 'text-[#1e3a8a] font-bold'
                  : 'text-blue-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            id="mobile-nav-tab-practice"
          >
            <div className="relative p-1">
              <Zap className="w-5 h-5" />
              {activeTab === 'practice' && (
                <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#1e3a8a] dark:bg-blue-400"></span>
              )}
            </div>
            <span className="text-[10px] tracking-tight whitespace-nowrap">Practice</span>
          </button>

          {/* Tab 3: Mock CBT / Pre-JAMB */}
          <button
            onClick={() => {
              if (isLoggedIn) {
                onNavigate('mock_cbt');
              } else {
                onNavigate('pre_jamb');
              }
            }}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'mock_cbt' || activeTab === 'pre_jamb'
                ? themeMode === 'light'
                  ? 'text-[#1e3a8a] font-bold'
                  : 'text-blue-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            id="mobile-nav-tab-mock"
          >
            <div className="relative p-1">
              <BookOpen className="w-5 h-5" />
              {(activeTab === 'mock_cbt' || activeTab === 'pre_jamb') && (
                <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#1e3a8a] dark:bg-blue-400"></span>
              )}
            </div>
            <span className="text-[10px] tracking-tight whitespace-nowrap">
              Mock CBT
            </span>
          </button>

          {/* Tab 4: Materials */}
          <button
            onClick={() => {
              if (isLoggedIn) {
                onNavigate('materials');
              } else {
                onOpenAuth('login');
              }
            }}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'materials'
                ? themeMode === 'light'
                  ? 'text-[#1e3a8a] font-bold'
                  : 'text-blue-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            id="mobile-nav-tab-materials"
          >
            <div className="relative p-1">
              <FolderDown className="w-5 h-5" />
              {activeTab === 'materials' && (
                <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#1e3a8a] dark:bg-blue-400"></span>
              )}
            </div>
            <span className="text-[10px] tracking-tight whitespace-nowrap">Materials</span>
          </button>

          {/* Tab 5: Suite Menu (Opens Full Mobile Suite Drawer) */}
          <button
            onClick={() => setSuiteMenuOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-1 rounded-xl text-slate-500 hover:text-[#1e3a8a] dark:text-slate-400 dark:hover:text-blue-400 transition-all cursor-pointer"
            id="mobile-nav-tab-suite-menu"
          >
            <div className="relative p-1">
              <Menu className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500"></span>
            </div>
            <span className="text-[10px] tracking-tight whitespace-nowrap">Suite Menu</span>
          </button>

        </div>
      </nav>

      {/* Full-Screen Mobile Suite Menu Display */}
      {suiteMenuOpen && (
        <div
          className={`md:hidden fixed inset-0 z-[10000] w-full h-[100dvh] flex flex-col overflow-hidden animate-in fade-in ${
            themeMode === 'light'
              ? 'bg-white text-slate-900'
              : 'bg-[#0b0f19] text-slate-100'
          }`}
          id="mobile-suite-drawer-overlay"
        >
          {/* Top Sticky Header */}
          <div className={`shrink-0 px-4 py-3 border-b flex items-center justify-between shadow-xs ${
            themeMode === 'light'
              ? 'bg-slate-50 border-slate-200'
              : 'bg-slate-900 border-slate-800'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-blue-50 border border-blue-200 text-[#1e3a8a] flex items-center justify-center overflow-hidden shadow-xs">
                <img
                  src={brandLogo}
                  alt="Logo"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight truncate">
                  ACADET CBT MASTER
                </h3>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-tight truncate mt-0.5">
                  Nigerian University Learning & CBT Practice Engine
                </p>
              </div>
            </div>

            <button
              onClick={() => setSuiteMenuOpen(false)}
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0 transition-colors"
              id="close-mobile-suite-drawer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5 text-rose-500" />
            </button>
          </div>

          {/* Action Bar: Notifications & Install App */}
          <div className={`shrink-0 px-4 py-2 border-b flex items-center gap-2 ${
            themeMode === 'light'
              ? 'bg-slate-100/70 border-slate-200'
              : 'bg-slate-900/60 border-slate-800/80'
          }`} id="mobile-suite-drawer-action-icons">
            <button
              type="button"
              onClick={() => {
                setSuiteMenuOpen(false);
                if (onOpenNotificationCenter) onOpenNotificationCenter();
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 text-xs font-bold cursor-pointer transition-colors"
              title="Notifications"
            >
              <Bell className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Notifications</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSuiteMenuOpen(false);
                onOpenInstallModal();
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-xs font-bold cursor-pointer transition-colors"
              title="Install Mobile App"
            >
              <Smartphone className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Install App</span>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer transition-colors"
              title="Toggle Theme"
            >
              {themeMode === 'light' ? (
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
              )}
              <span>{themeMode === 'light' ? 'Light' : 'Dark'}</span>
            </button>
          </div>

          {/* Full-Height Scrollable Content Body */}
          <div
            className="flex-1 overflow-y-auto p-4 space-y-4 pb-28 custom-scrollbar"
            id="mobile-suite-drawer-content"
          >

            {/* High-Priority Download / Install Mobile App Banner Button */}
            <button
              onClick={() => {
                setSuiteMenuOpen(false);
                onOpenInstallModal();
              }}
              className="w-full py-3 px-4 bg-[#1e3a8a] hover:bg-[#172554] text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-between transition-all cursor-pointer"
              id="mobile-drawer-install-app-btn"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-white/15">
                  <Smartphone className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-white">Download & Install Mobile App</p>
                  <p className="text-[10px] text-blue-100 font-normal">Add to Home Screen for Offline CBT</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-white" />
            </button>

            {/* Streak card if available */}
            {streakData && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>{streakData.streak} Day Learning Streak Active</span>
              </div>
            )}

            {/* Navigation Sections */}
            <div className="space-y-1 text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1">
                Learning Modules
              </span>

              <button
                onClick={() => {
                  setSuiteMenuOpen(false);
                  onNavigate('pre_jamb');
                }}
                className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-[#1e3a8a] dark:text-blue-300 font-bold flex items-center gap-2.5"
              >
                <Award className="w-4 h-4 text-[#1e3a8a]" />
                <span>Pre-JAMB CBT Academy</span>
              </button>

              <button
                onClick={() => {
                  setSuiteMenuOpen(false);
                  onNavigate('leaderboard');
                }}
                className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-amber-300 font-bold flex items-center gap-2.5"
              >
                <Award className="w-4 h-4 text-amber-500" />
                <span>Student Leaderboard</span>
              </button>

              <button
                onClick={() => {
                  setSuiteMenuOpen(false);
                  onNavigate('community');
                }}
                className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-indigo-300 font-bold flex items-center gap-2.5"
              >
                <Users className="w-4 h-4 text-indigo-500" />
                <span>Learning Community</span>
              </button>

              <button
                onClick={() => {
                  setSuiteMenuOpen(false);
                  onNavigate('performance');
                }}
                className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium flex items-center gap-2.5"
              >
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <span>Performance Analytics</span>
              </button>

              <button
                onClick={() => {
                  setSuiteMenuOpen(false);
                  onNavigate('bookmarks');
                }}
                className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium flex items-center gap-2.5"
              >
                <Bookmark className="w-4 h-4 text-amber-500" />
                <span>Saved Bookmarks</span>
              </button>

              <button
                onClick={() => {
                  setSuiteMenuOpen(false);
                  onNavigate('founder');
                }}
                className="w-full text-left p-2.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-500/10 text-amber-900 dark:text-amber-300 font-bold flex items-center gap-2.5"
              >
                <Award className="w-4 h-4 text-amber-500" />
                <span>Founder: Menmex</span>
              </button>
            </div>

            {/* Account & Profile Operations */}
            <div className={`pt-2 border-t space-y-1.5 ${
              themeMode === 'light' ? 'border-slate-100' : 'border-slate-800'
            }`}>
              {isLoggedIn ? (
                <>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{currentUser.email}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-[#1e3a8a] border border-blue-200 font-bold">
                      {currentUser.role}
                    </span>
                  </div>

                  {isStudent && onOpenEditProfile && (
                    <button
                      onClick={() => {
                        setSuiteMenuOpen(false);
                        onOpenEditProfile();
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 flex items-center gap-2"
                    >
                      <User className="w-4 h-4 text-[#1e3a8a]" />
                      <span>Edit Profile</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setSuiteMenuOpen(false);
                      onOpenSubscribe();
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-[#ea580c] flex items-center gap-2 font-bold"
                  >
                    <Crown className="w-4 h-4 text-[#ea580c]" />
                    <span>Subscription Plans & Upgrade</span>
                  </button>

                  {onOpenFeaturesPdf && (
                    <button
                      onClick={() => {
                        setSuiteMenuOpen(false);
                        onOpenFeaturesPdf();
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4 text-slate-500" />
                      <span>Download Features PDF</span>
                    </button>
                  )}

                  {onOpenAbout && (
                    <button
                      onClick={() => {
                        setSuiteMenuOpen(false);
                        onOpenAbout();
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4 text-slate-500" />
                      <span>About Acadet CBT MASTER</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setSuiteMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs text-rose-600 font-bold flex items-center gap-2 mt-1"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out of Account</span>
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      setSuiteMenuOpen(false);
                      onOpenAuth('login');
                    }}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg border border-slate-300 text-center cursor-pointer"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      setSuiteMenuOpen(false);
                      onOpenAuth('register');
                    }}
                    className="py-2 px-3 bg-[#1e3a8a] hover:bg-[#172554] text-white font-bold text-xs rounded-lg text-center shadow-xs cursor-pointer"
                  >
                    Get Started
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
};
