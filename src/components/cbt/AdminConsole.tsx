import {
  BookOpen,
  FileText,
  Megaphone,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type {
  AdminOverview,
  AdminQuestionItem,
  AnnouncementItem,
  MaterialCategory,
  OptionLetter,
  QuestionDifficulty,
  SafeUser,
  StudyMaterialItem,
  SubjectSummary,
} from '../../types/cbt';

interface AdminConsoleProps {
  onCatalogUpdated: () => Promise<void>;
}

type AdminSection =
  | 'overview'
  | 'subjects'
  | 'questions'
  | 'materials'
  | 'announcements'
  | 'users';

export const AdminConsole: React.FC<AdminConsoleProps> = ({ onCatalogUpdated }) => {
  const [section, setSection] = useState<AdminSection>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [questions, setQuestions] = useState<AdminQuestionItem[]>([]);
  const [materials, setMaterials] = useState<StudyMaterialItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  // Subject form
  const [subjName, setSubjName] = useState('');
  const [subjCode, setSubjCode] = useState('');
  const [subjSlug, setSubjSlug] = useState('');
  const [subjDesc, setSubjDesc] = useState('');

  // Question form
  const [qSubjectId, setQSubjectId] = useState('');
  const [qText, setQText] = useState('');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qOptD, setQOptD] = useState('');
  const [qCorrect, setQCorrect] = useState<OptionLetter>('A');
  const [qDiff, setQDiff] = useState<QuestionDifficulty>('Medium');
  const [qTopic, setQTopic] = useState('General');
  const [qExplanation, setQExplanation] = useState('');

  // AI Draft form
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(3);

  // Material upload form
  const [matTitle, setMatTitle] = useState('');
  const [matCategory, setMatCategory] = useState<MaterialCategory>('Notes');
  const [matSubjectId, setMatSubjectId] = useState('');
  const [matDesc, setMatDesc] = useState('');
  const [matFile, setMatFile] = useState<File | null>(null);

  // Announcement form
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annPinned, setAnnPinned] = useState(true);

  const loadAllAdminData = async () => {
    try {
      const [ov, subRes, qRes, matRes, annRes, usrRes] = await Promise.all([
        api.admin.getOverview(),
        api.admin.listSubjects(),
        api.admin.listQuestions(),
        api.materials.list(),
        api.admin.listAnnouncements(),
        api.admin.listUsers(),
      ]);
      setOverview(ov.overview);
      setSubjects(subRes.subjects);
      setQuestions(qRes.questions);
      setMaterials(matRes.materials);
      setAnnouncements(annRes.announcements);
      setUsers(usrRes.users);
      if (!qSubjectId && subRes.subjects[0]) {
        setQSubjectId(subRes.subjects[0].id);
      }
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load admin console.',
      });
    }
  };

  useEffect(() => {
    void loadAllAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await api.admin.createSubject({
        name: subjName,
        code: subjCode.toUpperCase(),
        slug:
          subjSlug.trim() ||
          subjName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, ''),
        description: subjDesc,
      });
      setSubjName('');
      setSubjCode('');
      setSubjSlug('');
      setSubjDesc('');
      setFeedback({ type: 'ok', text: 'Subject created in PostgreSQL.' });
      await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to create subject.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qSubjectId) return;
    setBusy(true);
    setFeedback(null);
    try {
      await api.admin.createQuestion({
        subjectId: qSubjectId,
        questionText: qText,
        optionA: qOptA,
        optionB: qOptB,
        optionC: qOptC,
        optionD: qOptD,
        correctOption: qCorrect,
        difficulty: qDiff,
        topic: qTopic,
        explanation: qExplanation,
      });
      setQText('');
      setQOptA('');
      setQOptB('');
      setQOptC('');
      setQOptD('');
      setQExplanation('');
      setFeedback({ type: 'ok', text: 'Question saved to PostgreSQL.' });
      await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save question.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!qSubjectId || !aiTopic.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.generateQuestions({
        subjectId: qSubjectId,
        topic: aiTopic,
        difficulty: qDiff,
        count: aiCount,
      });
      setAiTopic('');
      setFeedback({
        type: 'ok',
        text: `Generated and saved ${res.questions.length} questions into PostgreSQL.`,
      });
      await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'AI question generation failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matFile) {
      setFeedback({ type: 'err', text: 'Select a PDF, DOC, or image file to upload.' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const fd = new FormData();
      fd.append('file', matFile);
      fd.append('title', matTitle);
      fd.append('category', matCategory);
      fd.append('description', matDesc);
      if (matSubjectId) fd.append('subjectId', matSubjectId);

      await api.admin.uploadMaterial(fd);
      setMatTitle('');
      setMatDesc('');
      setMatFile(null);
      setFeedback({
        type: 'ok',
        text: 'Study material uploaded to object storage and indexed in PostgreSQL.',
      });
      await loadAllAdminData();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Material upload failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await api.admin.createAnnouncement({
        title: annTitle,
        body: annBody,
        isPinned: annPinned,
      });
      setAnnTitle('');
      setAnnBody('');
      setFeedback({ type: 'ok', text: 'Announcement published.' });
      await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to publish announcement.',
      });
    } finally {
      setBusy(false);
    }
  };

  const tabs: Array<{
    id: AdminSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'subjects', label: 'Subjects', icon: BookOpen },
    { id: 'questions', label: 'Questions', icon: FileText },
    { id: 'materials', label: 'Materials', icon: Upload },
    { id: 'announcements', label: 'Notices', icon: Megaphone },
    { id: 'users', label: 'Users', icon: Users },
  ];

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="bg-[#0b337a] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5" />
          <h2 className="text-lg font-extrabold tracking-tight">
            Admin Console (PostgreSQL)
          </h2>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSection(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  section === t.id
                    ? 'bg-white text-[#0b337a]'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {feedback && (
          <div
            className={`rounded-xl px-4 py-3 text-sm font-medium border ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {section === 'overview' && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Users', val: overview?.totalUsers ?? 0 },
              { label: 'Subjects', val: overview?.totalSubjects ?? 0 },
              { label: 'Questions', val: overview?.totalQuestions ?? 0 },
              { label: 'Materials', val: overview?.totalMaterials ?? 0 },
              { label: 'Submitted Exams', val: overview?.totalSubmittedExams ?? 0 },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-4 text-center"
              >
                <div className="text-2xl font-extrabold text-[#0b337a] dark:text-blue-400 tabular-nums">
                  {stat.val}
                </div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {section === 'subjects' && (
          <div className="space-y-5">
            <form
              onSubmit={handleCreateSubject}
              className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 grid grid-cols-1 sm:grid-cols-4 gap-3"
            >
              <input
                type="text"
                required
                placeholder="Subject Name (e.g. Economics)"
                value={subjName}
                onChange={(e) => setSubjName(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                placeholder="Code (e.g. ECN)"
                value={subjCode}
                onChange={(e) => setSubjCode(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Description"
                value={subjDesc}
                onChange={(e) => setSubjDesc(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white font-bold text-sm px-4 py-2 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Subject</span>
              </button>
            </form>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {subjects.map((sub) => (
                <div
                  key={sub.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <span className="font-extrabold">{sub.name}</span>{' '}
                    <span className="text-xs text-slate-500">({sub.code})</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.admin.deleteSubject(sub.id);
                      await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
                    }}
                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                    title="Delete subject"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'questions' && (
          <div className="space-y-5">
            <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/70 border border-[#d6e4fa] dark:border-slate-700 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Sparkles className="w-5 h-5 text-[#0a58ed] shrink-0" />
              <select
                value={qSubjectId}
                onChange={(e) => setQSubjectId(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Topic for AI generation (e.g. Quadratic Equations)"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={1}
                max={10}
                value={aiCount}
                onChange={(e) => setAiCount(Number(e.target.value))}
                className="w-20 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={busy || !aiTopic.trim() || !qSubjectId}
                onClick={handleGenerateQuestions}
                className="px-4 py-2 rounded-lg bg-[#0b337a] hover:bg-[#072459] text-white text-xs font-bold whitespace-nowrap disabled:opacity-50"
              >
                Generate via AI
              </button>
            </div>

            <form
              onSubmit={handleCreateQuestion}
              className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={qSubjectId}
                  onChange={(e) => setQSubjectId(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={qDiff}
                  onChange={(e) => setQDiff(e.target.value as QuestionDifficulty)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                >
                  {(['Easy', 'Medium', 'Hard'] as const).map((d) => (
                    <option key={d} value={d}>
                      Difficulty: {d}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Topic"
                  value={qTopic}
                  onChange={(e) => setQTopic(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>

              <textarea
                required
                rows={2}
                placeholder="Question prompt"
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  required
                  placeholder="Option A"
                  value={qOptA}
                  onChange={(e) => setQOptA(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                />
                <input
                  required
                  placeholder="Option B"
                  value={qOptB}
                  onChange={(e) => setQOptB(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                />
                <input
                  required
                  placeholder="Option C"
                  value={qOptC}
                  onChange={(e) => setQOptC(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                />
                <input
                  required
                  placeholder="Option D"
                  value={qOptD}
                  onChange={(e) => setQOptD(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                <select
                  value={qCorrect}
                  onChange={(e) => setQCorrect(e.target.value as OptionLetter)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-bold"
                >
                  {(['A', 'B', 'C', 'D'] as const).map((letter) => (
                    <option key={letter} value={letter}>
                      Correct Answer: {letter}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Explanation (shown only after submission)"
                  value={qExplanation}
                  onChange={(e) => setQExplanation(e.target.value)}
                  className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={busy || !qSubjectId}
                className="px-4 py-2 rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white text-sm font-bold"
              >
                Save Question
              </button>
            </form>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
              {questions.map((q) => (
                <div key={q.id} className="px-4 py-3 flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white">
                      [{q.subjectName} · {q.difficulty}] {q.questionText}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Correct: {q.correctOption} · Topic: {q.topic}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.admin.deleteQuestion(q.id);
                      await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
                    }}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'materials' && (
          <div className="space-y-5">
            <form
              onSubmit={handleUploadMaterial}
              className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <input
                required
                placeholder="Material Title"
                value={matTitle}
                onChange={(e) => setMatTitle(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <select
                value={matCategory}
                onChange={(e) => setMatCategory(e.target.value as MaterialCategory)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
              >
                {(['Tutorials', 'Notes', 'Past Questions', 'Guides'] as const).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={matSubjectId}
                onChange={(e) => setMatSubjectId(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="">General (All Subjects)</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="Short description"
                value={matDesc}
                onChange={(e) => setMatDesc(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <input
                type="file"
                required
                accept=".pdf,.doc,.docx,image/*"
                onChange={(e) => setMatFile(e.target.files?.[0] || null)}
                className="sm:col-span-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="sm:col-span-2 px-4 py-2.5 rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white font-bold text-sm"
              >
                Upload to External Object Storage
              </button>
            </form>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {materials.map((m) => (
                <div key={m.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-bold">{m.title}</div>
                    <div className="text-xs text-slate-500">
                      {m.category} · {m.fileType} · {m.downloadCount} downloads
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.admin.deleteMaterial(m.id);
                      await loadAllAdminData();
                    }}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'announcements' && (
          <div className="space-y-5">
            <form
              onSubmit={handleCreateAnnouncement}
              className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
            >
              <input
                required
                placeholder="Announcement Title"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <textarea
                required
                rows={3}
                placeholder="Announcement Body"
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={annPinned}
                    onChange={(e) => setAnnPinned(e.target.checked)}
                  />
                  <span>Pin to Home Important Notice</span>
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-[#0a58ed] text-white text-sm font-bold"
                >
                  Publish Notice
                </button>
              </div>
            </form>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {announcements.map((a) => (
                <div key={a.id} className="px-4 py-3 flex items-start justify-between gap-3 text-sm">
                  <div>
                    <div className="font-bold">{a.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{a.body}</div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.admin.deleteAnnouncement(a.id);
                      await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
                    }}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'users' && (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {users.map((u) => (
              <div
                key={u.id}
                className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm"
              >
                <div>
                  <div className="font-bold">
                    {u.fullName}{' '}
                    <span className="text-xs font-semibold text-slate-500">
                      (@{u.username})
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-bold uppercase">
                    {u.role}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.admin.updateUser(u.id, { isActive: !u.isActive });
                      await loadAllAdminData();
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${
                      u.isActive
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {u.isActive ? 'Active' : 'Disabled'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
