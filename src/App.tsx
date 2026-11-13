import React, { useCallback, useEffect, useState } from 'react';
import { AdminConsole } from './components/cbt/AdminConsole';
import { AuthScreen } from './components/cbt/AuthScreen';
import { CourseAccessRequiredModal } from './components/cbt/CourseAccessRequiredModal';
import { CourseRegistrationView } from './components/cbt/CourseRegistrationView';
import { ExamHall } from './components/cbt/ExamHall';
import { HelpSupportView } from './components/cbt/HelpSupportView';
import { HomeDashboard } from './components/cbt/HomeDashboard';
import { MyRegisteredCoursesView } from './components/cbt/MyRegisteredCoursesView';
import { NotificationsView } from './components/cbt/NotificationsView';
import { PaymentVerificationBanner } from './components/cbt/PaymentVerificationBanner';
import { PracticeExamsView } from './components/cbt/PracticeExamsView';
import { ResultsView } from './components/cbt/ResultsView';
import { SettingsDrawer } from './components/cbt/SettingsDrawer';
import { StudyMaterialsView } from './components/cbt/StudyMaterialsView';
import { TopHeader } from './components/cbt/TopHeader';
import { WorkspaceSidebar, type WorkspaceTab } from './components/cbt/WorkspaceSidebar';
import { api, ApiError } from './lib/api';
import type {
  ActiveExamQuestion,
  ActiveExamSession,
  ActivitySummary,
  AnnouncementItem,
  CourseCatalogueItem,
  DifficultyLevel,
  GradedExamQuestion,
  PaymentVerifyOutcome,
  SafeUser,
  StudentNotificationItem,
  UserPreferences,
} from './types/cbt';

export default function App() {
  const [booting, setBooting] = useState(true);
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
  const [myCoursesRefreshKey, setMyCoursesRefreshKey] = useState(0);

  const [verifyingRef, setVerifyingRef] = useState<string | null>(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [paymentOutcome, setPaymentOutcome] = useState<PaymentVerifyOutcome | null>(null);
  const [paymentVerifyError, setPaymentVerifyError] = useState<string | null>(null);

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
    };
    window.addEventListener('acadet:account-suspended', onSuspended);
    return () => window.removeEventListener('acadet:account-suspended', onSuspended);
  }, []);

  const verifyPaystackReturnReference = useCallback(
    async (reference: string, activeUser: SafeUser | null) => {
      if (!activeUser) return;
      setVerifyingRef(reference);
      setIsVerifyingPayment(true);
      setPaymentOutcome(null);
      setPaymentVerifyError(null);
      try {
        const outcome = await api.payments.verify(reference);
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
        const health = await api.health();
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
  }, [loadWorkspaceData, verifyPaystackReturnReference]);

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
              registrationFee: Number(coursePayload.registrationFee ?? 2000),
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

  if (booting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#eef3fb] dark:bg-[#0a0f1e] text-slate-700 dark:text-slate-200">
        <div className="w-10 h-10 rounded-full border-4 border-[#0a58ed] border-t-transparent animate-spin" />
        <p className="mt-4 text-sm font-bold">Loading Acadet CBT...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        onAuthenticated={handleAuthenticated}
        dbConfigured={healthState.dbConfigured}
        dbConnected={healthState.dbConnected}
        dbError={healthState.dbError}
        suspensionNotice={suspensionNotice}
      />
    );
  }

  // Active CBT Examination Hall Mode
  if (activeExam) {
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
                    onCatalogUpdated={async () => {
                      await loadWorkspaceData(user);
                      setMyCoursesRefreshKey((k) => k + 1);
                    }}
                  />
                )}
            </div>
          </main>
        </div>
      )}

      {/* Deep Navy Footer */}
      <footer className="bg-[#0b337a] text-white/90 text-xs sm:text-sm py-3.5 px-4 sm:px-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2025 Acadet CBT. All rights reserved.</span>
          <span className="sm:border-l sm:border-white/25 sm:pl-4">
            Powered by Acadet Learning Hub
          </span>
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
}
