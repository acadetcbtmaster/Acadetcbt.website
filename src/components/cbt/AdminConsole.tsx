import {
  AlertCircle,
  BookCheck,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  Download,
  Edit3,
  Eye,
  FileText,
  Lock,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api, getClientAuthToken } from '../../lib/api';
import type {
  AdminCourseItem,
  AdminOverview,
  AdminPaymentRecord,
  AdminQuestionItem,
  AdminRegistrationItem,
  AdminStudentProfile,
  AnnouncementItem,
  MaterialCategory,
  OptionLetter,
  PaymentStatus,
  PublicationStatus,
  QuestionDifficulty,
  SafeUser,
  StudyMaterialItem,
} from '../../types/cbt';
import { formatCurrency } from './CourseRegistrationView';

interface AdminConsoleProps {
  onCatalogUpdated: () => Promise<void>;
}

type AdminSection =
  | 'overview'
  | 'courses'
  | 'registrations'
  | 'payments'
  | 'questions'
  | 'materials'
  | 'announcements'
  | 'users';

function StatusBadge({ status }: { status: PaymentStatus }) {
  if (status === 'successful') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold capitalize">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Successful
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-xs font-extrabold capitalize">
        <Clock className="w-3.5 h-3.5" />
        Pending
      </span>
    );
  }
  if (status === 'refunded') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 text-xs font-extrabold capitalize">
        Refunded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300 text-xs font-extrabold capitalize">
      <AlertCircle className="w-3.5 h-3.5" />
      Failed
    </span>
  );
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({ onCatalogUpdated }) => {
  const [section, setSection] = useState<AdminSection>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [courses, setCourses] = useState<AdminCourseItem[]>([]);
  const [questions, setQuestions] = useState<AdminQuestionItem[]>([]);
  const [materials, setMaterials] = useState<StudyMaterialItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [registrations, setRegistrations] = useState<AdminRegistrationItem[]>([]);
  const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);

  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  // Course form (create / edit)
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [cCode, setCCode] = useState('');
  const [cTitle, setCTitle] = useState('');
  const [cLevel, setCLevel] = useState('100 Level');
  const [cFee, setCFee] = useState('2000');
  const [cPubStatus, setCPubStatus] = useState<PublicationStatus>('published');
  const [cDuration, setCDuration] = useState('60');
  const [cDesc, setCDesc] = useState('');

  // Registration filters & modal
  const [regSearch, setRegSearch] = useState('');
  const [regCourseId, setRegCourseId] = useState('');
  const [regPayStatus, setRegPayStatus] = useState<PaymentStatus | ''>('');
  const [regDateFrom, setRegDateFrom] = useState('');
  const [regDateTo, setRegDateTo] = useState('');
  const [selectedReg, setSelectedReg] = useState<AdminRegistrationItem | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Payment filters & modal
  const [paySearch, setPaySearch] = useState('');
  const [payStatus, setPayStatus] = useState<PaymentStatus | ''>('');
  const [payCourseId, setPayCourseId] = useState('');
  const [payDateFrom, setPayDateFrom] = useState('');
  const [payDateTo, setPayDateTo] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<AdminPaymentRecord | null>(null);

  // Student Profile modal
  const [studentProfile, setStudentProfile] = useState<AdminStudentProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Question form
  const [qCourseId, setQCourseId] = useState('');
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
  const [matCourseId, setMatCourseId] = useState('');
  const [matDesc, setMatDesc] = useState('');
  const [matFile, setMatFile] = useState<File | null>(null);

  // Announcement form
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annPinned, setAnnPinned] = useState(true);

  const loadRegistrations = async () => {
    const res = await api.admin.listRegistrations({
      search: regSearch || undefined,
      courseId: regCourseId || undefined,
      paymentStatus: regPayStatus || undefined,
      dateFrom: regDateFrom || undefined,
      dateTo: regDateTo || undefined,
    });
    setRegistrations(res.registrations);
  };

  const loadPayments = async () => {
    const res = await api.admin.listPayments({
      status: payStatus || undefined,
      courseId: payCourseId || undefined,
      search: paySearch || undefined,
      dateFrom: payDateFrom || undefined,
      dateTo: payDateTo || undefined,
    });
    setPayments(res.payments);
  };

  const loadAllAdminData = async () => {
    const [ov, cRes, qRes, matRes, annRes, usrRes, regRes, payRes] =
      await Promise.allSettled([
        api.admin.getOverview(),
        api.admin.listCourses(),
        api.admin.listQuestions(),
        api.materials.list(),
        api.admin.listAnnouncements(),
        api.admin.listUsers(),
        api.admin.listRegistrations(),
        api.admin.listPayments(),
      ]);

    const errors: string[] = [];

    if (ov.status === 'fulfilled') setOverview(ov.value.overview);
    else errors.push(ov.reason instanceof Error ? ov.reason.message : 'overview');

    if (cRes.status === 'fulfilled') {
      setCourses(cRes.value.courses);
      if (!qCourseId && cRes.value.courses[0]) {
        setQCourseId(cRes.value.courses[0].id);
      }
    } else {
      errors.push(cRes.reason instanceof Error ? cRes.reason.message : 'courses');
    }

    if (qRes.status === 'fulfilled') setQuestions(qRes.value.questions);
    else errors.push(qRes.reason instanceof Error ? qRes.reason.message : 'questions');

    if (matRes.status === 'fulfilled') setMaterials(matRes.value.materials);
    else errors.push(matRes.reason instanceof Error ? matRes.reason.message : 'materials');

    if (annRes.status === 'fulfilled') setAnnouncements(annRes.value.announcements);
    else errors.push(annRes.reason instanceof Error ? annRes.reason.message : 'announcements');

    if (usrRes.status === 'fulfilled') setUsers(usrRes.value.users);
    else errors.push(usrRes.reason instanceof Error ? usrRes.reason.message : 'users');

    if (regRes.status === 'fulfilled') setRegistrations(regRes.value.registrations);
    else errors.push(regRes.reason instanceof Error ? regRes.reason.message : 'registrations');

    if (payRes.status === 'fulfilled') setPayments(payRes.value.payments);
    else errors.push(payRes.reason instanceof Error ? payRes.reason.message : 'payments');

    if (errors.length > 0) {
      setFeedback({ type: 'err', text: errors[0] });
    }
  };

  useEffect(() => {
    void loadAllAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (courses.length === 0) {
      if (qCourseId) setQCourseId('');
      return;
    }
    if (!qCourseId || !courses.some((c) => c.id === qCourseId)) {
      setQCourseId(courses[0].id);
    }
  }, [courses, qCourseId]);

  const resetCourseForm = () => {
    setEditingCourseId(null);
    setCCode('');
    setCTitle('');
    setCLevel('100 Level');
    setCFee('2000');
    setCPubStatus('published');
    setCDuration('60');
    setCDesc('');
  };

  const startEditCourse = (c: AdminCourseItem) => {
    setEditingCourseId(c.id);
    setCCode(c.code);
    setCTitle(c.title);
    setCLevel(c.level);
    setCFee(String(c.registrationFee));
    setCPubStatus(c.publicationStatus);
    setCDuration(String(c.defaultDurationMinutes));
    setCDesc(c.description);
    setFeedback(null);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const feeNum = Number(cFee);
      const durNum = Number(cDuration) || 60;
      if (editingCourseId) {
        await api.admin.updateCourse(editingCourseId, {
          code: cCode.trim().toUpperCase(),
          title: cTitle.trim(),
          level: cLevel.trim(),
          description: cDesc.trim(),
          registrationFee: Number.isFinite(feeNum) ? feeNum : 0,
          publicationStatus: cPubStatus,
          defaultDurationMinutes: durNum,
        });
        setFeedback({ type: 'ok', text: `Course "${cCode.toUpperCase()}" updated in PostgreSQL.` });
      } else {
        await api.admin.createCourse({
          code: cCode.trim().toUpperCase(),
          title: cTitle.trim(),
          level: cLevel.trim() || '100 Level',
          description: cDesc.trim(),
          registrationFee: Number.isFinite(feeNum) ? feeNum : 2000,
          currency: 'NGN',
          publicationStatus: cPubStatus,
          defaultDurationMinutes: durNum,
        });
        setFeedback({ type: 'ok', text: `Course "${cCode.toUpperCase()}" created in PostgreSQL.` });
      }
      resetCourseForm();
      await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save course.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePublication = async (course: AdminCourseItem) => {
    setBusy(true);
    setFeedback(null);
    const nextStatus: PublicationStatus =
      course.publicationStatus === 'published' ? 'draft' : 'published';
    try {
      await api.admin.updateCourse(course.id, { publicationStatus: nextStatus });
      setFeedback({
        type: 'ok',
        text: `Course ${course.code} is now ${nextStatus}.`,
      });
      await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to update course visibility.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleExportRegistrationsCsv = async () => {
    setExportingCsv(true);
    setFeedback(null);
    try {
      const url = api.admin.getRegistrationsExportUrl({
        search: regSearch || undefined,
        courseId: regCourseId || undefined,
        paymentStatus: regPayStatus || undefined,
        dateFrom: regDateFrom || undefined,
        dateTo: regDateTo || undefined,
      });
      const token = getClientAuthToken();
      const resp = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!resp.ok) {
        throw new Error('Failed to export course registrations CSV.');
      }
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `acadet-course-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'CSV export failed.',
      });
    } finally {
      setExportingCsv(false);
    }
  };

  const handleReverifyPayment = async (paymentId: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      const outcome = await api.admin.reverifyPayment(paymentId);
      setFeedback({
        type: outcome.paymentStatus === 'successful' ? 'ok' : 'err',
        text: outcome.message,
      });
      await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
      setSelectedPayment((prev) =>
        prev && prev.id === paymentId
          ? {
              ...prev,
              paymentStatus: outcome.paymentStatus,
              paidAt: outcome.payment.paidAt,
              gatewayTransactionId: outcome.payment.gatewayTransactionId,
            }
          : prev
      );
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Paystack re-verification failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const openStudentProfile = async (studentId: string) => {
    setLoadingProfile(true);
    setFeedback(null);
    try {
      const profile = await api.admin.getStudentProfile(studentId);
      setStudentProfile(profile);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load student profile.',
      });
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qCourseId) return;
    setBusy(true);
    setFeedback(null);
    try {
      await api.admin.createQuestion({
        courseId: qCourseId,
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
    if (!qCourseId || !aiTopic.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.generateQuestions({
        courseId: qCourseId,
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
      if (matCourseId) fd.append('courseId', matCourseId);

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
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'registrations', label: 'Registrations', icon: ClipboardList },
    { id: 'payments', label: 'Payments', icon: CreditCard },
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

        {/* OVERVIEW */}
        {section === 'overview' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Users', val: overview?.totalUsers ?? 0 },
              { label: 'Courses', val: overview?.totalCourses ?? 0 },
              { label: 'Active Registrations', val: overview?.totalActiveRegistrations ?? 0 },
              {
                label: 'Total Revenue',
                val: formatCurrency(overview?.totalRevenueNaira ?? 0, 'NGN'),
              },
              { label: 'Successful Payments', val: overview?.totalSuccessfulPayments ?? 0 },
              { label: 'CBT Questions', val: overview?.totalQuestions ?? 0 },
              { label: 'Study Materials', val: overview?.totalMaterials ?? 0 },
              { label: 'Submitted Exams', val: overview?.totalSubmittedExams ?? 0 },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-4 text-center"
              >
                <div className="text-xl sm:text-2xl font-extrabold text-[#0b337a] dark:text-blue-400 tabular-nums">
                  {stat.val}
                </div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* COURSE MANAGEMENT */}
        {section === 'courses' && (
          <div className="space-y-5">
            <form
              onSubmit={handleSaveCourse}
              className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#082252] dark:text-white">
                  {editingCourseId ? 'Edit Course Details & Fee' : 'Create New Course'}
                </h3>
                {editingCourseId && (
                  <button
                    type="button"
                    onClick={resetCourseForm}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Course Code (e.g. CSC 101)"
                  value={cCode}
                  onChange={(e) => setCCode(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-semibold"
                />
                <input
                  type="text"
                  required
                  placeholder="Course Title"
                  value={cTitle}
                  onChange={(e) => setCTitle(e.target.value)}
                  className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Level (e.g. 100 Level)"
                  value={cLevel}
                  onChange={(e) => setCLevel(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                />
                <div>
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    placeholder="Fee (₦)"
                    value={cFee}
                    onChange={(e) => setCFee(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-bold tabular-nums"
                  />
                </div>
                <select
                  value={cPubStatus}
                  onChange={(e) => setCPubStatus(e.target.value as PublicationStatus)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-semibold"
                >
                  <option value="published">Published (Visible)</option>
                  <option value="draft">Draft (Hidden)</option>
                  <option value="archived">Archived</option>
                </select>
                <input
                  type="number"
                  min={5}
                  max={240}
                  placeholder="Duration (mins)"
                  value={cDuration}
                  onChange={(e) => setCDuration(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm tabular-nums"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Course description"
                  value={cDesc}
                  onChange={(e) => setCDesc(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white font-bold text-sm px-5 py-2 flex items-center justify-center gap-1.5 min-h-[40px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>{editingCourseId ? 'Save Course Changes' : 'Add Course'}</span>
                </button>
              </div>
            </form>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3">Fee</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Questions</th>
                    <th className="px-4 py-3">Registrations</th>
                    <th className="px-4 py-3">Revenue</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {courses.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {c.code} — {c.title}
                        </div>
                        {c.description && (
                          <div className="text-xs text-slate-500 line-clamp-1">
                            {c.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {c.level}
                      </td>
                      <td className="px-4 py-3 font-extrabold tabular-nums text-[#082252] dark:text-blue-300">
                        {formatCurrency(c.registrationFee, c.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleTogglePublication(c)}
                          className={`px-2.5 py-1 rounded-md text-xs font-extrabold capitalize ${
                            c.publicationStatus === 'published'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                          title="Click to toggle Published/Draft"
                        >
                          {c.publicationStatus}
                        </button>
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold">
                        {c.questionCount}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-bold">
                        {c.totalRegistrations}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-extrabold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(c.totalRevenue, c.currency)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => startEditCourse(c)}
                          className="p-1.5 text-[#0a58ed] hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg mr-1"
                          title="Edit course"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            setFeedback(null);
                            try {
                              await api.admin.deleteCourse(c.id);
                              setFeedback({ type: 'ok', text: `Deleted course "${c.code}".` });
                              await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
                            } catch (err) {
                              setFeedback({
                                type: 'err',
                                text:
                                  err instanceof Error
                                    ? err.message
                                    : 'Failed to delete course.',
                              });
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg disabled:opacity-50"
                          title="Safe delete course"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* COURSE REGISTRATIONS */}
        {section === 'registrations' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/70 border border-[#d6e4fa] dark:border-slate-700 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-[#082252] dark:text-white">
                  Course Registrations
                </h3>
                <button
                  type="button"
                  disabled={exportingCsv}
                  onClick={handleExportRegistrationsCsv}
                  className="px-3.5 py-2 rounded-lg bg-[#0b337a] hover:bg-[#072459] text-white text-xs font-extrabold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{exportingCsv ? 'Exporting...' : 'Export CSV'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                <div className="relative lg:col-span-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={regSearch}
                    onChange={(e) => setRegSearch(e.target.value)}
                    placeholder="Search student name, email, or WhatsApp..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                  />
                </div>
                <select
                  value={regCourseId}
                  onChange={(e) => setRegCourseId(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold"
                >
                  <option value="">All Courses</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
                <select
                  value={regPayStatus}
                  onChange={(e) => setRegPayStatus(e.target.value as PaymentStatus | '')}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold"
                >
                  <option value="">All Statuses</option>
                  <option value="successful">Successful</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
                <input
                  type="date"
                  value={regDateFrom}
                  onChange={(e) => setRegDateFrom(e.target.value)}
                  aria-label="Date from"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs"
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={regDateTo}
                    onChange={(e) => setRegDateTo(e.target.value)}
                    aria-label="Date to"
                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => void loadRegistrations()}
                    className="px-3 py-2 rounded-lg bg-[#0a58ed] text-white text-xs font-bold"
                  >
                    Filter
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">WhatsApp Number</th>
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Payment Status</th>
                    <th className="px-4 py-3">Registration Date</th>
                    <th className="px-4 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {registrations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                        No course registrations match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    registrations.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                          <button
                            type="button"
                            onClick={() => void openStudentProfile(r.studentId)}
                            className="hover:underline text-left text-[#0a58ed] dark:text-blue-400"
                          >
                            {r.studentName}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                          {r.studentEmail}
                        </td>
                        <td className="px-4 py-3 text-xs font-bold tabular-nums text-slate-800 dark:text-slate-200">
                          {r.whatsappNumber || '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {r.courseCode} — {r.courseTitle}
                        </td>
                        <td className="px-4 py-3 font-extrabold tabular-nums">
                          {formatCurrency(r.amount, r.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={r.paymentStatus} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                          {new Date(r.registeredAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedReg(r)}
                            className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PAYMENT RECORDS */}
        {section === 'payments' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/70 border border-[#d6e4fa] dark:border-slate-700 p-4 space-y-3">
              <h3 className="text-sm font-extrabold text-[#082252] dark:text-white">
                Payment Records
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                <div className="relative lg:col-span-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={paySearch}
                    onChange={(e) => setPaySearch(e.target.value)}
                    placeholder="Search student, email, or reference..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                  />
                </div>
                <select
                  value={payStatus}
                  onChange={(e) => setPayStatus(e.target.value as PaymentStatus | '')}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold"
                >
                  <option value="">All Statuses</option>
                  <option value="successful">Successful</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
                <select
                  value={payCourseId}
                  onChange={(e) => setPayCourseId(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold"
                >
                  <option value="">All Courses</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={payDateFrom}
                  onChange={(e) => setPayDateFrom(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs"
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={payDateTo}
                    onChange={(e) => setPayDateTo(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => void loadPayments()}
                    className="px-3 py-2 rounded-lg bg-[#0a58ed] text-white text-xs font-bold"
                  >
                    Filter
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Gateway</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                        No payment transactions match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {p.studentName}
                          </div>
                          <div className="text-xs text-slate-500">{p.studentEmail}</div>
                          {p.whatsappNumber && (
                            <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                              WhatsApp: {p.whatsappNumber}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {p.courseCode} — {p.courseTitle}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{p.paymentReference}</td>
                        <td className="px-4 py-3 font-extrabold tabular-nums">
                          {formatCurrency(p.amount, p.currency)}
                        </td>
                        <td className="px-4 py-3 capitalize text-xs font-bold">{p.gateway}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                          {new Date(p.paidAt || p.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={p.paymentStatus} />
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedPayment(p)}
                            className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* QUESTIONS */}
        {section === 'questions' && (
          <div className="space-y-5">
            {courses.length === 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-200">
                No courses found yet. Create a course in the Courses tab before adding questions.
              </div>
            )}
            <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/70 border border-[#d6e4fa] dark:border-slate-700 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Sparkles className="w-5 h-5 text-[#0a58ed] shrink-0" />
              <select
                value={qCourseId}
                onChange={(e) => setQCourseId(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Topic for AI generation (e.g. Algorithms)"
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
                disabled={busy || !aiTopic.trim() || !qCourseId}
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
                  value={qCourseId}
                  onChange={(e) => setQCourseId(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
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
                disabled={busy || !qCourseId}
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
                      [{q.courseCode} · {q.difficulty}] {q.questionText}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {q.courseTitle} · Correct: {q.correctOption} · Topic: {q.topic}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setFeedback(null);
                      try {
                        await api.admin.deleteQuestion(q.id);
                        setFeedback({ type: 'ok', text: 'Question deleted.' });
                        await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
                      } catch (err) {
                        setFeedback({
                          type: 'err',
                          text: err instanceof Error ? err.message : 'Failed to delete question.',
                        });
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg shrink-0 disabled:opacity-50"
                    title="Delete question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MATERIALS */}
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
                value={matCourseId}
                onChange={(e) => setMatCourseId(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="">General (All Courses)</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
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
                      {m.category}
                      {m.courseCode ? ` · ${m.courseCode}` : ''} · {m.fileType} · {m.downloadCount} downloads
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setFeedback(null);
                      try {
                        await api.admin.deleteMaterial(m.id);
                        setFeedback({ type: 'ok', text: 'Study material deleted.' });
                        await loadAllAdminData();
                      } catch (err) {
                        setFeedback({
                          type: 'err',
                          text: err instanceof Error ? err.message : 'Failed to delete material.',
                        });
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    title="Delete material"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ANNOUNCEMENTS */}
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
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setFeedback(null);
                      try {
                        await api.admin.deleteAnnouncement(a.id);
                        setFeedback({ type: 'ok', text: 'Announcement deleted.' });
                        await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
                      } catch (err) {
                        setFeedback({
                          type: 'err',
                          text: err instanceof Error ? err.message : 'Failed to delete announcement.',
                        });
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    title="Delete announcement"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* USERS & STUDENT PROFILE HISTORY */}
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
                  <div className="text-xs text-slate-500">
                    {u.email}
                    {u.whatsappNumber ? ` · WhatsApp: ${u.whatsappNumber}` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={loadingProfile}
                    onClick={() => void openStudentProfile(u.id)}
                    className="px-3 py-1 rounded-lg bg-[#eff5ff] dark:bg-slate-800 text-[#0b337a] dark:text-blue-300 border border-[#c6daf7] dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 hover:bg-blue-100 dark:hover:bg-slate-700"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>View Courses & Payments</span>
                  </button>
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-bold uppercase">
                    {u.role}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setFeedback(null);
                      try {
                        await api.admin.updateUser(u.id, { isActive: !u.isActive });
                        setFeedback({
                          type: 'ok',
                          text: `Updated ${u.fullName} to ${!u.isActive ? 'Active' : 'Disabled'}.`,
                        });
                        await loadAllAdminData();
                      } catch (err) {
                        setFeedback({
                          type: 'err',
                          text: err instanceof Error ? err.message : 'Failed to update user.',
                        });
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold disabled:opacity-50 ${
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

      {/* Registration Details Modal */}
      {selectedReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="bg-[#0b337a] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookCheck className="w-5 h-5" />
                <h3 className="text-base font-extrabold">Registration Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReg(null)}
                className="p-1.5 rounded-lg hover:bg-white/15"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-2.5 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Student Name</span>
                <span className="font-bold">{selectedReg.studentName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Email</span>
                <span className="font-medium">{selectedReg.studentEmail}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">WhatsApp Number</span>
                <span className="font-bold tabular-nums">
                  {selectedReg.whatsappNumber || '—'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Course</span>
                <span className="font-bold text-right">
                  {selectedReg.courseCode} — {selectedReg.courseTitle}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Amount Paid</span>
                <span className="font-extrabold tabular-nums">
                  {formatCurrency(selectedReg.amount, selectedReg.currency)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Payment Reference</span>
                <span className="font-mono text-xs">{selectedReg.paymentReference}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Payment Status</span>
                <StatusBadge status={selectedReg.paymentStatus} />
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Registered At</span>
                <span className="text-xs">
                  {new Date(selectedReg.registeredAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Transaction Details Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[1px]">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="bg-[#0b337a] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                <h3 className="text-base font-extrabold">Transaction Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="p-1.5 rounded-lg hover:bg-white/15"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-slate-500 block">Student</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedPayment.studentName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">WhatsApp Number</span>
                  <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                    {selectedPayment.whatsappNumber || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Course</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedPayment.courseCode} — {selectedPayment.courseTitle}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Reference</span>
                  <span className="font-mono font-semibold">
                    {selectedPayment.paymentReference}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Amount</span>
                  <span className="font-extrabold tabular-nums">
                    {formatCurrency(selectedPayment.amount, selectedPayment.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status</span>
                  <StatusBadge status={selectedPayment.paymentStatus} />
                </div>
                <div>
                  <span className="text-slate-500 block">Gateway Tx ID</span>
                  <span className="font-mono">
                    {selectedPayment.gatewayTransactionId || '—'}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                  Paystack Gateway Metadata
                </div>
                <pre className="rounded-xl bg-slate-900 text-slate-100 p-3 text-xs overflow-x-auto max-h-48">
                  {JSON.stringify(selectedPayment.gatewayResponse || {}, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleReverifyPayment(selectedPayment.id)}
                  className="px-4 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
                  <span>Verify with Paystack</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPayment(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Student Profile Modal (Student Course Registration History) */}
      {studentProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-[1px]">
          <div className="w-full max-w-3xl max-h-[90vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-[#0b337a] text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-5 h-5" />
                <div>
                  <h3 className="font-extrabold text-base">
                    Student Course Registration History
                  </h3>
                  <p className="text-xs text-blue-100">
                    {studentProfile.student.fullName} · {studentProfile.student.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStudentProfile(null)}
                className="p-1.5 rounded-lg hover:bg-white/15"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Student Metadata */}
              <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/80 border border-[#d6e4fa] dark:border-slate-700 p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Full Name</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {studentProfile.student.fullName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Email</span>
                  <span className="font-semibold break-all">
                    {studentProfile.student.email}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">WhatsApp Number</span>
                  <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                    {studentProfile.student.whatsappNumber || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Registration Date</span>
                  <span className="font-semibold">
                    {new Date(studentProfile.student.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Account Status</span>
                  <span
                    className={`font-extrabold ${
                      studentProfile.student.isActive
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-600'
                    }`}
                  >
                    {studentProfile.student.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-3">
                  <div className="text-xl font-extrabold text-[#0b337a] dark:text-blue-400 tabular-nums">
                    {studentProfile.summary.totalCoursesRegistered}
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    Courses Registered
                  </div>
                </div>
                <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-3">
                  <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {studentProfile.summary.totalSuccessfulPayments}
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    Successful Payments
                  </div>
                </div>
                <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-3">
                  <div className="text-xl font-extrabold text-[#082252] dark:text-white tabular-nums">
                    {formatCurrency(studentProfile.summary.totalAmountPaid, 'NGN')}
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    Total Amount Paid
                  </div>
                </div>
                <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-3">
                  <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                    {studentProfile.summary.outstandingCourseRegistrations}
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    Outstanding Courses
                  </div>
                </div>
              </div>

              {/* Per-Course Checklist */}
              <div>
                <h4 className="text-sm font-extrabold text-[#082252] dark:text-white mb-2.5">
                  Registered Courses Checklist
                </h4>
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  {studentProfile.coursesStatus.map((cs) => (
                    <div
                      key={cs.courseId}
                      className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
                    >
                      <div>
                        <span className="font-extrabold">
                          {cs.code} — {cs.title}
                        </span>
                        <span className="text-xs text-slate-500 ml-2 tabular-nums">
                          ({formatCurrency(cs.amountPaid ?? cs.registrationFee, cs.currency)})
                        </span>
                      </div>
                      {cs.isRegistered ? (
                        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          Registered ✓
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
                          <Lock className="w-3.5 h-3.5" />
                          Not Registered
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
