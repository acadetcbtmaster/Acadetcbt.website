import React, { useCallback, useEffect, useState } from 'react';
import {
  AcadetCrest,
  BrandingProvider,
  DEFAULT_CLIENT_BRANDING,
  DEFAULT_CLIENT_FOUNDER,
} from './components/cbt/AcadetLogo';
import { AdminConsole } from './components/cbt/AdminConsole';
import { AuthScreen } from './components/cbt/AuthScreen';
import { CourseAccessRequiredModal } from './components/cbt/CourseAccessRequiredModal';
import { CourseRegistrationView } from './components/cbt/CourseRegistrationView';
import { ExamHall } from './components/cbt/ExamHall';
import { HelpSupportView } from './components/cbt/HelpSupportView';
import { HomeDashboard } from './components/cbt/HomeDashboard';
import { MyRegisteredCoursesView } from './components/cbt/MyRegisteredCoursesView';
import { NotificationsView } from './components/cbt/NotificationsView';
import { PaymentHistoryView } from './components/cbt/PaymentHistoryView';
import { PaymentVerificationBanner } from './components/cbt/PaymentVerificationBanner';
import { PaymentVerificationView } from './components/cbt/PaymentVerificationView';
import { PracticeExamsView } from './components/cbt/PracticeExamsView';
import { ResultsView } from './components/cbt/ResultsView';
import { SeoHead } from './components/cbt/SeoHead';
import { SettingsDrawer } from './components/cbt/SettingsDrawer';
import { StudyMaterialsView } from './components/cbt/StudyMaterialsView';
import { TopHeader } from './components/cbt/TopHeader';
import { WorkspaceSidebar, type WorkspaceTab } from './components/cbt/WorkspaceSidebar';
import { FounderView } from './components/public/FounderView';
import {
  PublicAboutView,
  PublicContactView,
  PublicCoursesView,
  PublicHomeView,
  PublicHowItWorksView,
} from './components/public/PublicPages';
import { PublicShell } from './components/public/PublicShell';
import { api, ApiError } from './lib/api';
import type {
  ActiveExamQuestion,
  ActiveExamSession,
  ActivitySummary,
  AnnouncementItem,
  CourseCatalogueItem,
  DifficultyLevel,
  FounderProfileData,
  GradedExamQuestion,
  PaymentVerifyOutcome,
  PublicCourseSummary,
  SafeUser,
  SiteBrandingData,
  StudentNotificationItem,
  UserPreferences,
} from './types/cbt';

const SUB_PUBLIC_PATHS = new Set([
  '/about',
  '/courses',
  '/how-it-works',
  '/contact',
  '/founder',
]);

const INDEXABLE_PUBLIC_PATHS = new Set(['/', ...SUB_PUBLIC_PATHS]);

function normalizePathname(raw: string): string {
  const cleaned = (raw || '/').split('?')[0].split('#')[0].replace(/\/+$/, '');
  return cleaned || '/';
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [currentPath, setCurrentPath] = useState<string>(() =>
    typeof window !== 'undefined' ? normalizePathname(window.location.pathname) : '/'
  );

  const [branding, setBranding] = useState<SiteBrandingData>(DEFAULT_CLIENT_BRANDING);
  const [founder, setFounder] = useState<FounderProfileData>(DEFAULT_CLIENT_FOUNDER);
  const [publicCourses, setPublicCourses] = useState<PublicCourseSummary[]>([]);

  const [healthState, setHealthState] = useState<{
    dbConfigured: boolean;
    dbConnected: boolean;
    dbError?: string;
    objectStorageConfigured: boolean;
    paystackConfigured: boolean;
  }>({
    dbConfigured: false,
    dbConnected: false,
    objectStorageConfigured: false,
    paystackConfigured: false,
  });

  const [user, setUser] = useState<SafeUser | null>(null);
  const [courses, setCourses] = useState<CourseCatalogueItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [notifications, setNotifications] = useState<StudentNotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [suspensionNotice, setSuspensionNotice] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivitySummary | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [startingExam, setStartingExam] = useState(false);
  const [activeExam, setActiveExam] = useState<{
    session: ActiveExamSession;
    questions: ActiveExamQuestion[];
  } | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [endExamConfirmOpen, setEndExamConfirmOpen] = useState(false);

  const [latestResult, setLatestResult] = useState<{
    session: ActiveExamSession;
    questions: GradedExamQuestion[];
  } | null>(null);

  // Course access lock & Paystack verification states
  const [courseRequiredModalCourse, setCourseRequiredModalCourse] =
    useState<CourseCatalogueItem | null>(null);
  const [pendingRegisterCourseId, setPendingRegisterCourseId] = useState<string | null>(
    null
  );
  const [pendingVerifyRef, setPendingVerifyRef] = useState<string | null>(null);
  const [myCoursesRefreshKey, setMyCoursesRefreshKey] = useState(0);

  const [verifyingRef, setVerifyingRef] = useState<string | null>(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [paymentOutcome, setPaymentOutcome] = useState<PaymentVerifyOutcome | null>(null);
  const [paymentVerifyError, setPaymentVerifyError] = useState<string | null>(null);

  const navigateTo = useCallback((targetPath: string) => {
    const next = normalizePathname(targetPath);
    if (typeof window !== 'undefined' && normalizePathname(window.location.pathname) !== next) {
      window.history.pushState({}, '', next);
    }
    setCurrentPath(next);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(normalizePathname(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const loadPublicSiteData = useCallback(async () => {
    try {
      const siteData = await api.public.getSiteData();
      setBranding(siteData.branding);
      setFounder(siteData.founder);
      setPublicCourses(siteData.courses);
    } catch {
      // Keep default client branding fallback if offline or DB initializing
    }
  }, []);

  // Sync theme & font size from PostgreSQL user preferences onto <html>
  useEffect(() => {
    const docEl = document.documentElement;
    const theme = user?.preferences.theme || 'light';
    const fontSize = user?.preferences.fontSize || 'medium';

    if (theme === 'dark') {
      docEl.classList.add('dark');
    } else {
      docEl.classList.remove('dark');
    }

    docEl.classList.remove('font-scale-small', 'font-scale-medium', 'font-scale-large');
    docEl.classList.add(`font-scale-${fontSize}`);
  }, [user?.preferences.theme, user?.preferences.fontSize]);

  const loadWorkspaceData = useCallback(async (authenticatedUser: SafeUser | null) => {
    if (!authenticatedUser) return;
    const [courseRes, annRes, actRes, notifRes] = await Promise.allSettled([
      api.catalog.getCourses(),
      api.catalog.getAnnouncements(),
      api.catalog.getActivity(),
      api.notifications.list(),
    ]);

    if (courseRes.status === 'fulfilled') {
      const list = courseRes.value.courses;
      setCourses(list);
      setSelectedCourseId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        const prefId =
          authenticatedUser.preferences.defaultCourseId ||
          authenticatedUser.preferences.defaultSubjectId;
        if (prefId && list.some((c) => c.id === prefId)) return prefId;
        const firstRegistered = list.find((c) => c.isRegistered);
        return firstRegistered?.id || list[0]?.id || null;
      });
    }

    if (annRes.status === 'fulfilled') {
      setAnnouncements(annRes.value.announcements);
    }

    if (actRes.status === 'fulfilled') {
      setActivity(actRes.value);
    }

    if (notifRes.status === 'fulfilled') {
      setNotifications(notifRes.value.notifications);
      setUnreadNotifications(notifRes.value.unreadCount);
    }
  }, []);

  useEffect(() => {
    const onSuspended = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setSuspensionNotice(
        detail?.message ||
          'Your account has been suspended. Please contact Acadet CBT administration.'
      );
      setUser(null);
      setActiveExam(null);
      setLatestResult(null);
      setCourses([]);
      setAnnouncements([]);
      setNotifications([]);
      setUnreadNotifications(0);
      setActivity(null);
      setActiveTab('home');
      navigateTo('/login');
    };
    window.addEventListener('acadet:account-suspended', onSuspended);
    return () => window.removeEventListener('acadet:account-suspended', onSuspended);
  }, [navigateTo]);

  const verifyPaystackReturnReference = useCallback(
    async (reference: string, activeUser: SafeUser | null) => {
      if (!activeUser) return;
      setVerifyingRef(reference);
      setIsVerifyingPayment(true);
      setPaymentOutcome(null);
      setPaymentVerifyError(null);
      try {
        const outcome = await api.payments.verify(reference, 'callback');
        setPaymentOutcome(outcome);
        await loadWorkspaceData(activeUser);
        setMyCoursesRefreshKey((k) => k + 1);
      } catch (err) {
        setPaymentVerifyError(
          err instanceof Error
            ? err.message
            : 'Unable to verify Paystack transaction right now.'
        );
      } finally {
        setIsVerifyingPayment(false);
      }
    },
    [loadWorkspaceData]
  );

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        const [health] = await Promise.all([api.health(), loadPublicSiteData()]);
        if (!active) return;
        setHealthState({
          dbConfigured: health.database.configured,
          dbConnected: health.database.connected,
          dbError: health.database.error,
          objectStorageConfigured: health.objectStorage.configured,
          paystackConfigured: health.paystack?.configured ?? false,
        });

        if (health.database.configured && health.database.connected) {
          try {
            const me = await api.auth.me();
            if (!active) return;
            setUser(me.user);
            await loadWorkspaceData(me.user);

            // Detect Paystack return callback (?reference=... or ?trxref=...)
            if (typeof window !== 'undefined') {
              const params = new URLSearchParams(window.location.search);
              const ref = params.get('reference') || params.get('trxref');
              if (ref && ref.trim()) {
                const cleanUrl = window.location.pathname + window.location.hash;
                window.history.replaceState({}, document.title, cleanUrl);
                void verifyPaystackReturnReference(ref.trim(), me.user);
              }
            }
          } catch {
            // Not signed in
          }
        }
      } catch {
        // Health endpoint unreachable
      } finally {
        if (active) setBooting(false);
      }
    }
    void bootstrap();
    return () => {
      active = false;
    };
  }, [loadPublicSiteData, loadWorkspaceData, verifyPaystackReturnReference]);

  // Countdown tick while inside active CBT exam
  useEffect(() => {
    if (!activeExam) return;
    const interval = window.setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeExam]);

  const handleAuthenticated = async (signedInUser: SafeUser) => {
    setSuspensionNotice(null);
    setUser(signedInUser);
    setActiveTab('home');
    if (currentPath === '/login' || currentPath === '/register') {
      navigateTo('/');
    }
    await loadWorkspaceData(signedInUser);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('reference') || params.get('trxref');
      if (ref && ref.trim()) {
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
        void verifyPaystackReturnReference(ref.trim(), signedInUser);
      }
    }
  };

  const handleLogout = async () => {
    await api.auth.logout();
    setUser(null);
    setActiveExam(null);
    setLatestResult(null);
    setCourses([]);
    setAnnouncements([]);
    setNotifications([]);
    setUnreadNotifications(0);
    setActivity(null);
    setCourseRequiredModalCourse(null);
    setPendingRegisterCourseId(null);
    setActiveTab('home');
    navigateTo('/');
  };

  const handleMarkNotificationRead = async (notificationId: string) => {
    const res = await api.notifications.markRead(notificationId);
    setNotifications((prev) => {
      const next = prev.map((n) =>
        n.id === notificationId ? { ...n, isRead: true, readAt: res.readAt } : n
      );
      setUnreadNotifications(next.filter((n) => !n.isRead).length);
      return next;
    });
  };

  const handleMarkAllNotificationsRead = async () => {
    await api.notifications.markAllRead();
    const nowIso = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.isRead ? n : { ...n, isRead: true, readAt: nowIso }))
    );
    setUnreadNotifications(0);
  };

  const handleSavePreferences = async (nextPrefs: UserPreferences) => {
    if (!user) return;
    setSavingSettings(true);
    try {
      const res = await api.auth.updatePreferences(nextPrefs);
      setUser(res.user);
      if (nextPrefs.defaultCourseId) {
        setSelectedCourseId(nextPrefs.defaultCourseId);
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const handleStartExam = async (params: {
    courseId: string;
    difficulty: DifficultyLevel;
    questionCount: number;
  }) => {
    const targetCourse = courses.find((c) => c.id === params.courseId);
    if (targetCourse && !targetCourse.isRegistered) {
      setCourseRequiredModalCourse(targetCourse);
      return;
    }

    setStartingExam(true);
    try {
      const started = await api.exams.start(params);
      setLatestResult(null);
      setActiveExam(started);
      setRemainingSeconds(started.session.timeLimitSeconds);
      setEndExamConfirmOpen(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'COURSE_REGISTRATION_REQUIRED') {
        if (targetCourse) {
          setCourseRequiredModalCourse(targetCourse);
        } else {
          const coursePayload = err.data?.course as
            | {
                id: string;
                code: string;
                title: string;
                registrationFee: number;
                currency?: string;
              }
            | undefined;
          if (coursePayload) {
            setCourseRequiredModalCourse({
              id: coursePayload.id,
              code: coursePayload.code,
              title: coursePayload.title,
              level: '100 Level',
              description: '',
              registrationFee: Number(coursePayload.registrationFee ?? 2350),
              currency: coursePayload.currency || 'NGN',
              publicationStatus: 'published',
              examCategory: 'Acadet CBT Examination',
              defaultDurationMinutes: 60,
              questionCount: 0,
              isRegistered: false,
              registrationState: 'not_registered',
              registeredAt: null,
              latestPaymentStatus: null,
              latestPaymentReference: null,
            });
          }
        }
        return;
      }
      throw err;
    } finally {
      setStartingExam(false);
    }
  };

  const handleStartCourseExamQuick = (courseId: string) => {
    if (!user) return;
    void handleStartExam({
      courseId,
      difficulty: user.preferences.defaultDifficulty,
      questionCount: 20,
    });
  };

  const handleRequireRegistration = (course: CourseCatalogueItem) => {
    setCourseRequiredModalCourse(course);
  };

  const handleRegisterNowFromModal = (courseId: string) => {
    setCourseRequiredModalCourse(null);
    setPendingRegisterCourseId(courseId);
    setActiveTab('catalogue');
  };

  const handleExamSubmitted = async (result: {
    session: ActiveExamSession;
    questions: GradedExamQuestion[];
  }) => {
    setActiveExam(null);
    setEndExamConfirmOpen(false);
    setLatestResult(result);
    setActiveTab('results');
    await loadWorkspaceData(user);
  };

  const isViewingSubPublicPage = SUB_PUBLIC_PATHS.has(currentPath);
  const isPublicIndexableRoute =
    INDEXABLE_PUBLIC_PATHS.has(currentPath) && (!user || isViewingSubPublicPage);

  const renderPublicPageContent = () => {
    if (currentPath === '/founder') {
      return <FounderView onNavigate={navigateTo} />;
    }
    if (currentPath === '/about') {
      return (
        <PublicAboutView
          courses={publicCourses}
          user={user}
          onNavigate={navigateTo}
          onOpenDashboard={() => {
            setActiveTab('home');
            navigateTo('/');
          }}
        />
      );
    }
    if (currentPath === '/courses') {
      return (
        <PublicCoursesView
          courses={publicCourses}
          user={user}
          onNavigate={navigateTo}
          onOpenDashboard={() => {
            setActiveTab('catalogue');
            navigateTo('/');
          }}
        />
      );
    }
    if (currentPath === '/how-it-works') {
      return (
        <PublicHowItWorksView
          courses={publicCourses}
          user={user}
          onNavigate={navigateTo}
          onOpenDashboard={() => {
            setActiveTab('home');
            navigateTo('/');
          }}
        />
      );
    }
    if (currentPath === '/contact') {
      return (
        <PublicContactView
          courses={publicCourses}
          user={user}
          onNavigate={navigateTo}
          onOpenDashboard={() => {
            setActiveTab('help');
            navigateTo('/');
          }}
        />
      );
    }
    return (
      <PublicHomeView
        courses={publicCourses}
        user={user}
        onNavigate={navigateTo}
        onOpenDashboard={() => {
          setActiveTab('home');
          navigateTo('/');
        }}
      />
    );
  };

  const renderMainContent = () => {
    if (booting) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#eef3fb] dark:bg-[#0a0f1e] text-slate-700 dark:text-slate-200">
          <AcadetCrest className="w-12 h-12 mb-3" />
          <div className="w-8 h-8 rounded-full border-4 border-[#0a58ed] border-t-transparent animate-spin" />
          <p className="mt-3 text-sm font-bold">Loading {branding.siteName}...</p>
        </div>
      );
    }

    // Active CBT Examination Hall Mode takes strict precedence
    if (user && activeExam) {
      return (
        <div className="min-h-screen flex flex-col bg-[#eef3fb] dark:bg-[#0a0f1e]">
          <TopHeader
            user={user}
            courses={courses}
            selectedCourseId={activeExam.session.courseId}
            onSelectCourse={setSelectedCourseId}
            onNavigateHome={() => setEndExamConfirmOpen(true)}
            onLogout={handleLogout}
            examMode={{
              remainingSeconds,
              courseLabel: `${activeExam.session.courseCode} — ${activeExam.session.courseTitle}`,
              onRequestEndExam: () => setEndExamConfirmOpen(true),
            }}
          />
          <main className="flex-1 flex flex-col">
            <ExamHall
              session={activeExam.session}
              initialQuestions={activeExam.questions}
              showQuestionPalette={user.preferences.showQuestionPalette}
              soundNotifications={user.preferences.soundNotifications}
              autoNextQuestion={user.preferences.autoNextQuestion}
              remainingSeconds={remainingSeconds}
              endExamConfirmOpen={endExamConfirmOpen}
              onCloseEndExamConfirm={() => setEndExamConfirmOpen(false)}
              onOpenEndExamConfirm={() => setEndExamConfirmOpen(true)}
              onExamSubmitted={handleExamSubmitted}
            />
          </main>
          <SettingsDrawer
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            preferences={user.preferences}
            courses={courses}
            selectedCourseId={selectedCourseId}
            onSavePreferences={handleSavePreferences}
            saving={savingSettings}
          />
        </div>
      );
    }

    // Sub-public informational pages (/about, /courses, /how-it-works, /contact, /founder)
    // remain accessible anytime (both signed out & signed in)
    if (isViewingSubPublicPage) {
      return (
        <PublicShell
          currentPath={currentPath}
          user={user}
          onNavigate={navigateTo}
          onReturnToDashboard={() => {
            setActiveTab('home');
            navigateTo('/');
          }}
        >
          {renderPublicPageContent()}
        </PublicShell>
      );
    }

    // Signed out view routing: '/' renders Public Website, '/login'|'/register'|protected render AuthScreen
    if (!user) {
      if (currentPath === '/') {
        return (
          <PublicShell currentPath={currentPath} user={null} onNavigate={navigateTo}>
            {renderPublicPageContent()}
          </PublicShell>
        );
      }

      return (
        <AuthScreen
          onAuthenticated={handleAuthenticated}
          dbConfigured={healthState.dbConfigured}
          dbConnected={healthState.dbConnected}
          dbError={healthState.dbError}
          suspensionNotice={suspensionNotice}
          initialMode={currentPath === '/register' ? 'register' : 'login'}
          onNavigatePublic={navigateTo}
        />
      );
    }

    // Signed-in Student / Admin Workspace
    return (
      <div className="min-h-screen flex flex-col bg-[#eef3fb] dark:bg-[#0a0f1e]">
        <TopHeader
          user={user}
          courses={courses}
          selectedCourseId={selectedCourseId}
          onSelectCourse={setSelectedCourseId}
          onNavigateHome={() => setActiveTab('home')}
          onOpenAdmin={
            user.role === 'admin' || user.role === 'super_admin'
              ? () => setActiveTab('admin')
              : undefined
          }
          onOpenNotifications={() => setActiveTab('notifications')}
          unreadNotifications={unreadNotifications}
          onLogout={handleLogout}
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
        />

        {activeTab === 'home' ? (
          <>
            <WorkspaceSidebar
              activeTab={activeTab}
              role={user.role}
              mobileOpen={mobileMenuOpen}
              mobileOnly
              unreadNotifications={unreadNotifications}
              onCloseMobile={() => setMobileMenuOpen(false)}
              onSelectTab={setActiveTab}
              onOpenSettings={() => setSettingsOpen(true)}
              onLogout={handleLogout}
            />
            <main className="flex-1 flex flex-col">
              <HomeDashboard
                courses={courses}
                selectedCourseId={selectedCourseId}
                defaultDifficulty={user.preferences.defaultDifficulty}
                announcements={announcements}
                activity={activity}
                onSelectCourse={setSelectedCourseId}
                onStartExam={handleStartExam}
                onRequireRegistration={handleRequireRegistration}
                onNavigateCourseRegistration={() => setActiveTab('catalogue')}
                onNavigateMyCourses={() => setActiveTab('my-courses')}
                onNavigateVerifyPayment={() => setActiveTab('payment-verification')}
                onNavigatePaymentHistory={() => setActiveTab('payment-history')}
                onNavigateViewResults={() => setActiveTab('results')}
                onNavigateStudyMaterials={() => setActiveTab('materials')}
                onOpenSettings={() => setSettingsOpen(true)}
                startingExam={startingExam}
              />
            </main>
          </>
        ) : (
          <div className="flex-1 flex min-h-0">
            <WorkspaceSidebar
              activeTab={activeTab}
              role={user.role}
              mobileOpen={mobileMenuOpen}
              unreadNotifications={unreadNotifications}
              onCloseMobile={() => setMobileMenuOpen(false)}
              onSelectTab={setActiveTab}
              onOpenSettings={() => setSettingsOpen(true)}
              onLogout={handleLogout}
            />

            <main className="flex-1 min-w-0 p-2.5 sm:p-5">
              <div className="max-w-7xl mx-auto">
                {activeTab === 'catalogue' && (
                  <CourseRegistrationView
                    user={user}
                    courses={courses}
                    onRefreshCatalog={() => loadWorkspaceData(user)}
                    onStartCourseExam={handleStartCourseExamQuick}
                    onOpenVerifyPayment={(ref) => {
                      if (ref) setPendingVerifyRef(ref);
                      setActiveTab('payment-verification');
                    }}
                    onOpenPaymentHistory={() => setActiveTab('payment-history')}
                    onWhatsappUpdated={(whatsappNumber) =>
                      setUser((prev) => (prev ? { ...prev, whatsappNumber } : prev))
                    }
                    initialRegisterCourseId={pendingRegisterCourseId}
                    onClearInitialRegisterCourseId={() => setPendingRegisterCourseId(null)}
                  />
                )}

                {activeTab === 'my-courses' && (
                  <MyRegisteredCoursesView
                    onStartExamForCourse={handleStartCourseExamQuick}
                    onBrowseCatalogue={() => setActiveTab('catalogue')}
                    refreshTrigger={myCoursesRefreshKey}
                  />
                )}

                {activeTab === 'payment-verification' && (
                  <PaymentVerificationView
                    initialReference={pendingVerifyRef}
                    onClearInitialReference={() => setPendingVerifyRef(null)}
                    onPaymentConfirmed={async () => {
                      await loadWorkspaceData(user);
                      setMyCoursesRefreshKey((k) => k + 1);
                    }}
                    onStartCourseExam={handleStartCourseExamQuick}
                    onOpenPaymentHistory={() => setActiveTab('payment-history')}
                    onOpenCourseRegistration={() => setActiveTab('catalogue')}
                  />
                )}

                {activeTab === 'payment-history' && (
                  <PaymentHistoryView
                    refreshTrigger={myCoursesRefreshKey}
                    onOpenVerifyReference={(ref) => {
                      setPendingVerifyRef(ref || null);
                      setActiveTab('payment-verification');
                    }}
                    onOpenCourseRegistration={() => setActiveTab('catalogue')}
                  />
                )}

                {activeTab === 'notifications' && (
                  <NotificationsView
                    notifications={notifications}
                    unreadCount={unreadNotifications}
                    onMarkRead={handleMarkNotificationRead}
                    onMarkAllRead={handleMarkAllNotificationsRead}
                    onStartCourseExam={handleStartCourseExamQuick}
                  />
                )}

                {activeTab === 'results' && (
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                    <div className="xl:col-span-7">
                      <ResultsView
                        courses={courses}
                        initialSessionResult={latestResult}
                        onClearInitialSessionResult={() => setLatestResult(null)}
                      />
                    </div>
                    <div className="xl:col-span-5">
                      <StudyMaterialsView
                        selectedCourseId={selectedCourseId}
                        compact
                        onExploreMore={() => setActiveTab('materials')}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'materials' && (
                  <StudyMaterialsView selectedCourseId={selectedCourseId} />
                )}

                {activeTab === 'practice' && (
                  <PracticeExamsView
                    courses={courses}
                    defaultDifficulty={user.preferences.defaultDifficulty}
                    onStartExam={handleStartExam}
                    onRequireRegistration={handleRequireRegistration}
                    startingExam={startingExam}
                  />
                )}

                {activeTab === 'help' && (
                  <HelpSupportView
                    dbConfigured={healthState.dbConfigured}
                    dbConnected={healthState.dbConnected}
                    objectStorageConfigured={healthState.objectStorageConfigured}
                    paystackConfigured={healthState.paystackConfigured}
                  />
                )}

                {activeTab === 'admin' &&
                  (user.role === 'admin' || user.role === 'super_admin') && (
                    <AdminConsole
                      userRole={user.role}
                      onNavigatePublic={navigateTo}
                      onCatalogUpdated={async () => {
                        await Promise.all([loadWorkspaceData(user), loadPublicSiteData()]);
                        setMyCoursesRefreshKey((k) => k + 1);
                      }}
                    />
                  )}
              </div>
            </main>
          </div>
        )}

        {/* Deep Navy Footer with Consistent Brand Crest & Public Links */}
        <footer className="bg-[#0b337a] text-white/90 text-xs sm:text-sm py-3.5 px-4 sm:px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <AcadetCrest className="w-6 h-6" />
              <span>
                © {new Date().getFullYear()} {branding.siteName}. All rights reserved.
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-blue-100">
              <a
                href="/about"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('/about');
                }}
                className="hover:text-white hover:underline"
              >
                About
              </a>
              <a
                href="/courses"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('/courses');
                }}
                className="hover:text-white hover:underline"
              >
                Courses
              </a>
              <a
                href="/founder"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('/founder');
                }}
                className="hover:text-white hover:underline"
              >
                Founder
              </a>
              <a
                href="/contact"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('/contact');
                }}
                className="hover:text-white hover:underline"
              >
                Contact
              </a>
              <span className="sm:border-l sm:border-white/25 sm:pl-3 text-white/90">
                Powered by Acadet Learning Hub
              </span>
            </div>
          </div>
        </footer>

        <SettingsDrawer
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          preferences={user.preferences}
          courses={courses}
          selectedCourseId={selectedCourseId}
          onSavePreferences={handleSavePreferences}
          saving={savingSettings}
        />

        <CourseAccessRequiredModal
          course={courseRequiredModalCourse}
          onClose={() => setCourseRequiredModalCourse(null)}
          onRegisterNow={handleRegisterNowFromModal}
        />

        <PaymentVerificationBanner
          verifying={isVerifyingPayment}
          reference={verifyingRef}
          outcome={paymentOutcome}
          error={paymentVerifyError}
          onRetryVerify={(ref) => void verifyPaystackReturnReference(ref, user)}
          onGoToMyCourses={() => {
            setPaymentOutcome(null);
            setPaymentVerifyError(null);
            setVerifyingRef(null);
            setActiveTab('my-courses');
          }}
          onDismiss={() => {
            setPaymentOutcome(null);
            setPaymentVerifyError(null);
            setVerifyingRef(null);
          }}
        />
      </div>
    );
  };

  return (
    <BrandingProvider
      branding={branding}
      founder={founder}
      refreshBranding={loadPublicSiteData}
    >
      <SeoHead
        pathname={currentPath}
        branding={branding}
        founder={founder}
        isPrivateAppRoute={!isPublicIndexableRoute}
      />
      {renderMainContent()}
    </BrandingProvider>
  );
}
