import React, { useCallback, useEffect, useState } from 'react';
import { AdminConsole } from './components/cbt/AdminConsole';
import { AuthScreen } from './components/cbt/AuthScreen';
import { ExamHall } from './components/cbt/ExamHall';
import { HelpSupportView } from './components/cbt/HelpSupportView';
import { HomeDashboard } from './components/cbt/HomeDashboard';
import { PracticeExamsView } from './components/cbt/PracticeExamsView';
import { ResultsView } from './components/cbt/ResultsView';
import { SettingsDrawer } from './components/cbt/SettingsDrawer';
import { StudyMaterialsView } from './components/cbt/StudyMaterialsView';
import { TopHeader } from './components/cbt/TopHeader';
import { WorkspaceSidebar, type WorkspaceTab } from './components/cbt/WorkspaceSidebar';
import { api } from './lib/api';
import type {
  ActiveExamQuestion,
  ActiveExamSession,
  ActivitySummary,
  AnnouncementItem,
  DifficultyLevel,
  GradedExamQuestion,
  SafeUser,
  SubjectSummary,
  UserPreferences,
} from './types/cbt';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [healthState, setHealthState] = useState<{
    dbConfigured: boolean;
    dbConnected: boolean;
    dbError?: string;
    objectStorageConfigured: boolean;
  }>({
    dbConfigured: false,
    dbConnected: false,
    objectStorageConfigured: false,
  });

  const [user, setUser] = useState<SafeUser | null>(null);
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [activity, setActivity] = useState<ActivitySummary | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

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
    const [subjRes, annRes, actRes] = await Promise.allSettled([
      api.catalog.getSubjects(),
      api.catalog.getAnnouncements(),
      api.catalog.getActivity(),
    ]);

    if (subjRes.status === 'fulfilled') {
      const list = subjRes.value.subjects;
      setSubjects(list);
      setSelectedSubjectId((prev) => {
        if (prev && list.some((s) => s.id === prev)) return prev;
        const prefId = authenticatedUser.preferences.defaultSubjectId;
        if (prefId && list.some((s) => s.id === prefId)) return prefId;
        return list[0]?.id || null;
      });
    }

    if (annRes.status === 'fulfilled') {
      setAnnouncements(annRes.value.announcements);
    }

    if (actRes.status === 'fulfilled') {
      setActivity(actRes.value);
    }
  }, []);

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
        });

        if (health.database.configured && health.database.connected) {
          try {
            const me = await api.auth.me();
            if (!active) return;
            setUser(me.user);
            await loadWorkspaceData(me.user);
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
  }, [loadWorkspaceData]);

  // Countdown tick while inside active CBT exam
  useEffect(() => {
    if (!activeExam) return;
    const interval = window.setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeExam]);

  const handleAuthenticated = async (signedInUser: SafeUser) => {
    setUser(signedInUser);
    setActiveTab('home');
    await loadWorkspaceData(signedInUser);
  };

  const handleLogout = async () => {
    await api.auth.logout();
    setUser(null);
    setActiveExam(null);
    setLatestResult(null);
    setSubjects([]);
    setAnnouncements([]);
    setActivity(null);
    setActiveTab('home');
  };

  const handleSavePreferences = async (nextPrefs: UserPreferences) => {
    if (!user) return;
    setSavingSettings(true);
    try {
      const res = await api.auth.updatePreferences(nextPrefs);
      setUser(res.user);
      if (nextPrefs.defaultSubjectId) {
        setSelectedSubjectId(nextPrefs.defaultSubjectId);
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const handleStartExam = async (params: {
    subjectId: string;
    difficulty: DifficultyLevel;
    questionCount: number;
  }) => {
    setStartingExam(true);
    try {
      const started = await api.exams.start(params);
      setLatestResult(null);
      setActiveExam(started);
      setRemainingSeconds(started.session.timeLimitSeconds);
      setEndExamConfirmOpen(false);
    } finally {
      setStartingExam(false);
    }
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
      />
    );
  }

  // Active CBT Examination Hall Mode (Matches Screenshots 3 & 5)
  if (activeExam) {
    return (
      <div className="min-h-screen flex flex-col bg-[#eef3fb] dark:bg-[#0a0f1e]">
        <TopHeader
          user={user}
          subjects={subjects}
          selectedSubjectId={activeExam.session.subjectId}
          onSelectSubject={setSelectedSubjectId}
          onNavigateHome={() => setEndExamConfirmOpen(true)}
          onLogout={handleLogout}
          examMode={{
            remainingSeconds,
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
          subjects={subjects}
          selectedSubjectId={selectedSubjectId}
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
        subjects={subjects}
        selectedSubjectId={selectedSubjectId}
        onSelectSubject={setSelectedSubjectId}
        onNavigateHome={() => setActiveTab('home')}
        onOpenAdmin={
          user.role === 'admin' || user.role === 'super_admin'
            ? () => setActiveTab('admin')
            : undefined
        }
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
            onCloseMobile={() => setMobileMenuOpen(false)}
            onSelectTab={setActiveTab}
            onOpenSettings={() => setSettingsOpen(true)}
            onLogout={handleLogout}
          />
          <main className="flex-1 flex flex-col">
            <HomeDashboard
              subjects={subjects}
              selectedSubjectId={selectedSubjectId}
              defaultDifficulty={user.preferences.defaultDifficulty}
              announcements={announcements}
              activity={activity}
              onSelectSubject={setSelectedSubjectId}
              onStartExam={handleStartExam}
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
            onCloseMobile={() => setMobileMenuOpen(false)}
            onSelectTab={setActiveTab}
            onOpenSettings={() => setSettingsOpen(true)}
            onLogout={handleLogout}
          />

          <main className="flex-1 min-w-0 p-3 sm:p-6">
            <div className="max-w-7xl mx-auto">
              {activeTab === 'results' && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                  <div className="xl:col-span-7">
                    <ResultsView
                      subjects={subjects}
                      initialSessionResult={latestResult}
                      onClearInitialSessionResult={() => setLatestResult(null)}
                    />
                  </div>
                  <div className="xl:col-span-5">
                    <StudyMaterialsView
                      selectedSubjectId={selectedSubjectId}
                      compact
                      onExploreMore={() => setActiveTab('materials')}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'materials' && (
                <StudyMaterialsView selectedSubjectId={selectedSubjectId} />
              )}

              {activeTab === 'practice' && (
                <PracticeExamsView
                  subjects={subjects}
                  defaultDifficulty={user.preferences.defaultDifficulty}
                  onStartExam={handleStartExam}
                  startingExam={startingExam}
                />
              )}

              {activeTab === 'help' && (
                <HelpSupportView
                  dbConfigured={healthState.dbConfigured}
                  dbConnected={healthState.dbConnected}
                  objectStorageConfigured={healthState.objectStorageConfigured}
                />
              )}

              {activeTab === 'admin' &&
                (user.role === 'admin' || user.role === 'super_admin') && (
                  <AdminConsole
                    onCatalogUpdated={() => loadWorkspaceData(user)}
                  />
                )}
            </div>
          </main>
        </div>
      )}

      {/* Deep Navy Footer (Matching Screenshot 1) */}
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
        subjects={subjects}
        selectedSubjectId={selectedSubjectId}
        onSavePreferences={handleSavePreferences}
        saving={savingSettings}
      />
    </div>
  );
}
