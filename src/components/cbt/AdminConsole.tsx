import {
  AlertCircle,
  AlertTriangle,
  Archive,
  Ban,
  Bell,
  BookCheck,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Image as ImageIcon,
  Lock,
  Megaphone,
  MessageCircle,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
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
  AccountStatus,
  AdminCourseItem,
  AdminNotificationRecord,
  AdminOverview,
  AdminPaymentRecord,
  AdminQuestionItem,
  AdminRegistrationItem,
  AdminStudentProfile,
  AnnouncementItem,
  FounderProfileData,
  MaterialCategory,
  NotificationType,
  OptionLetter,
  PaymentBackupSummary,
  PaymentResetPreview,
  PaymentStatus,
  PublicationStatus,
  QuestionDifficulty,
  ReconciliationStatus,
  SafeUser,
  SiteBrandingData,
  SocialLinksMap,
  StudyMaterialItem,
} from '../../types/cbt';
import {
  AcadetCrest,
  DEFAULT_CLIENT_BRANDING,
  DEFAULT_CLIENT_FOUNDER,
  useBranding,
} from './AcadetLogo';
import { formatCurrency } from './CourseRegistrationView';

interface AdminConsoleProps {
  onCatalogUpdated: () => Promise<void>;
  userRole?: SafeUser['role'];
  onNavigatePublic?: (path: string) => void;
}

type AdminSection =
  | 'overview'
  | 'courses'
  | 'registrations'
  | 'payments'
  | 'questions'
  | 'materials'
  | 'announcements'
  | 'notifications'
  | 'users'
  | 'branding';

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

function ReconciliationBadge({ status }: { status?: ReconciliationStatus }) {
  if (status === 'reconciled') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Reconciled
      </span>
    );
  }
  if (status === 'shortfall') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300 text-xs font-extrabold">
        <AlertCircle className="w-3.5 h-3.5" />
        Shortfall
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-xs font-extrabold">
        <Clock className="w-3.5 h-3.5" />
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold">
      N/A
    </span>
  );
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  onCatalogUpdated,
  userRole = 'admin',
  onNavigatePublic,
}) => {
  const { refreshBranding } = useBranding();
  const isSuperAdmin = userRole === 'super_admin';

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
  const [cFee, setCFee] = useState('2350');
  const [cPubStatus, setCPubStatus] = useState<PublicationStatus>('published');
  const [cDuration, setCDuration] = useState('60');
  const [cDesc, setCDesc] = useState('');
  const [cWhatsappLink, setCWhatsappLink] = useState('');

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

  // User Management filters & lifecycle modals
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<AccountStatus | ''>('');
  const [studentProfile, setStudentProfile] = useState<AdminStudentProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<SafeUser | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SafeUser | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  // Notifications Management + Individual Student Notification Composer
  const [adminNotifications, setAdminNotifications] = useState<AdminNotificationRecord[]>([]);
  const [notifSearch, setNotifSearch] = useState('');
  const [notifTypeFilter, setNotifTypeFilter] = useState<NotificationType | ''>('');
  const [notifyTarget, setNotifyTarget] = useState<SafeUser | null>(null);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');

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

  // Payment Record Reset & Backup state
  const [resetPreview, setResetPreview] = useState<PaymentResetPreview | null>(null);
  const [paymentBackups, setPaymentBackups] = useState<PaymentBackupSummary[]>([]);
  const [backupLabel, setBackupLabel] = useState('');
  const [resetAllModalOpen, setResetAllModalOpen] = useState(false);
  const [resetBackupId, setResetBackupId] = useState('');
  const [resetAcknowledge, setResetAcknowledge] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [exportingBackupId, setExportingBackupId] = useState<string | null>(null);

  // Website Branding, SEO & Founder Profile state (Super Admin)
  const [brandingForm, setBrandingForm] = useState<SiteBrandingData>(DEFAULT_CLIENT_BRANDING);
  const [founderForm, setFounderForm] = useState<FounderProfileData>(DEFAULT_CLIENT_FOUNDER);
  const [uploadingSlot, setUploadingSlot] = useState<'logo' | 'favicon' | 'founder-photo' | null>(null);

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

  const loadUsersFiltered = async (
    nextSearch = userSearch,
    nextStatus = userStatusFilter
  ) => {
    const res = await api.admin.listUsers({
      search: nextSearch || undefined,
      status: nextStatus || undefined,
    });
    setUsers(res.users);
  };

  const loadNotificationsFiltered = async (
    nextSearch = notifSearch,
    nextType = notifTypeFilter
  ) => {
    const res = await api.admin.listNotifications({
      search: nextSearch || undefined,
      type: nextType || undefined,
    });
    setAdminNotifications(res.notifications);
  };

  const loadPaymentResetData = async () => {
    const res = await api.admin.getPaymentResetPreview();
    setResetPreview(res.preview);
    setPaymentBackups(res.backups);
    setResetBackupId((prev) => prev || res.backups[0]?.id || '');
  };

  const loadAllAdminData = async () => {
    const [
      ov,
      cRes,
      qRes,
      matRes,
      annRes,
      usrRes,
      regRes,
      payRes,
      notifRes,
      resetRes,
      brandRes,
    ] = await Promise.allSettled([
      api.admin.getOverview(),
      api.admin.listCourses(),
      api.admin.listQuestions(),
      api.materials.list(),
      api.admin.listAnnouncements(),
      api.admin.listUsers({
        search: userSearch || undefined,
        status: userStatusFilter || undefined,
      }),
      api.admin.listRegistrations(),
      api.admin.listPayments(),
      api.admin.listNotifications({
        search: notifSearch || undefined,
        type: notifTypeFilter || undefined,
      }),
      api.admin.getPaymentResetPreview(),
      api.admin.getBranding(),
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

    if (notifRes.status === 'fulfilled') setAdminNotifications(notifRes.value.notifications);

    if (resetRes.status === 'fulfilled') {
      setResetPreview(resetRes.value.preview);
      setPaymentBackups(resetRes.value.backups);
      setResetBackupId((prev) => prev || resetRes.value.backups[0]?.id || '');
    }

    if (brandRes.status === 'fulfilled') {
      setBrandingForm(brandRes.value.branding);
      setFounderForm(brandRes.value.founder);
    }

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
    setCFee('2350');
    setCPubStatus('published');
    setCDuration('60');
    setCDesc('');
    setCWhatsappLink('');
  };

  const startEditCourse = (c: AdminCourseItem) => {
    setEditingCourseId(c.id);
    setCCode(c.code);
    setCTitle(c.title);
    setCLevel(c.level);
    setCFee('2350');
    setCPubStatus(c.publicationStatus);
    setCDuration(String(c.defaultDurationMinutes));
    setCDesc(c.description);
    setCWhatsappLink(c.whatsappGroupLink || '');
    setFeedback(null);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const durNum = Number(cDuration) || 60;
      const trimmedGroupLink = cWhatsappLink.trim();
      if (editingCourseId) {
        await api.admin.updateCourse(editingCourseId, {
          code: cCode.trim().toUpperCase(),
          title: cTitle.trim(),
          level: cLevel.trim(),
          description: cDesc.trim(),
          registrationFee: 2350,
          publicationStatus: cPubStatus,
          defaultDurationMinutes: durNum,
          whatsappGroupLink: trimmedGroupLink || null,
        });
        setFeedback({ type: 'ok', text: `Course "${cCode.toUpperCase()}" updated in PostgreSQL.` });
      } else {
        await api.admin.createCourse({
          code: cCode.trim().toUpperCase(),
          title: cTitle.trim(),
          level: cLevel.trim() || '100 Level',
          description: cDesc.trim(),
          registrationFee: 2350,
          currency: 'NGN',
          publicationStatus: cPubStatus,
          defaultDurationMinutes: durNum,
          whatsappGroupLink: trimmedGroupLink || null,
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
              courseValue: outcome.payment.courseValue
                ? Number(outcome.payment.courseValue)
                : prev.courseValue,
              totalAmountCharged: outcome.payment.totalAmountCharged
                ? Number(outcome.payment.totalAmountCharged)
                : prev.totalAmountCharged,
              gatewayFee:
                outcome.payment.gatewayFee !== undefined && outcome.payment.gatewayFee !== null
                  ? Number(outcome.payment.gatewayFee)
                  : prev.gatewayFee,
              gatewayFeeSource: outcome.payment.gatewayFeeSource ?? prev.gatewayFeeSource,
              netSettlementAmount:
                outcome.payment.netSettlementAmount !== undefined &&
                outcome.payment.netSettlementAmount !== null
                  ? Number(outcome.payment.netSettlementAmount)
                  : prev.netSettlementAmount,
              settlementVariance:
                outcome.payment.settlementVariance !== undefined &&
                outcome.payment.settlementVariance !== null
                  ? Number(outcome.payment.settlementVariance)
                  : prev.settlementVariance,
              reconciliationStatus:
                outcome.payment.reconciliationStatus ?? prev.reconciliationStatus,
              feeAbsorbedBy: outcome.payment.feeAbsorbedBy ?? prev.feeAbsorbedBy,
              paymentChannel: outcome.payment.paymentChannel ?? prev.paymentChannel,
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

  const handleConfirmSuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspendTarget) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.suspendUser(
        suspendTarget.id,
        suspendReason.trim() || undefined
      );
      setFeedback({ type: 'ok', text: res.message });
      setSuspendTarget(null);
      setSuspendReason('');
      await loadUsersFiltered();
      if (studentProfile?.student.id === res.user.id) {
        await openStudentProfile(res.user.id);
      }
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to suspend account.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleReactivateUser = async (targetUser: SafeUser) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.reactivateUser(targetUser.id);
      setFeedback({ type: 'ok', text: res.message });
      await loadUsersFiltered();
      if (studentProfile?.student.id === targetUser.id) {
        await openStudentProfile(targetUser.id);
      }
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to reactivate account.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmPermanentDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.deleteUser(deleteTarget.id, {
        confirmation: deleteConfirmationText.trim(),
        confirmEmail: deleteConfirmationText.trim(),
      });
      setFeedback({
        type: 'ok',
        text: `${res.message} (Ref: ${res.deletedStudentRef})`,
      });
      setDeleteTarget(null);
      setDeleteConfirmationText('');
      if (studentProfile?.student.id === res.deletedId) {
        setStudentProfile(null);
      }
      await loadAllAdminData();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to permanently delete account.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSendStudentNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyTarget) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.sendUserNotification(notifyTarget.id, {
        title: notifyTitle.trim(),
        message: notifyMessage.trim(),
      });
      setFeedback({ type: 'ok', text: res.message });
      setNotifyTarget(null);
      setNotifyTitle('');
      setNotifyMessage('');
      await loadNotificationsFiltered();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to send notification.',
      });
    } finally {
      setBusy(false);
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

  const handleCreatePaymentBackup = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.createPaymentBackup(backupLabel.trim() || undefined);
      setResetPreview(res.preview);
      setPaymentBackups(res.backups);
      setResetBackupId(res.backup.id);
      setBackupLabel('');
      setFeedback({ type: 'ok', text: res.message });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to create payment backup.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadPaymentBackup = async (backup: PaymentBackupSummary) => {
    setExportingBackupId(backup.id);
    setFeedback(null);
    try {
      const url = api.admin.getPaymentBackupExportUrl(backup.id);
      const token = getClientAuthToken();
      const resp = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!resp.ok) {
        throw new Error('Failed to export payment backup JSON.');
      }
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `acadet-payment-backup-${backup.id.slice(0, 8)}-${new Date(backup.createdAt).toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Backup download failed.',
      });
    } finally {
      setExportingBackupId(null);
    }
  };

  const handleResetTestPayments = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.resetTestPayments();
      setResetPreview(res.preview);
      setPaymentBackups(res.backups);
      setResetBackupId(res.backupId);
      setFeedback({ type: 'ok', text: res.message });
      await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to clean test payment records.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleResetAllPayments = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.resetAllPayments({
        backupId: resetBackupId,
        acknowledgeConsequences: resetAcknowledge,
        confirmation: resetConfirmText.trim(),
      });
      setResetPreview(res.preview);
      setPaymentBackups(res.backups);
      setResetAllModalOpen(false);
      setResetAcknowledge(false);
      setResetConfirmText('');
      setFeedback({ type: 'ok', text: res.message });
      await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Full payment reset failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.updateBranding({
        siteName: brandingForm.siteName,
        tagline: brandingForm.tagline,
        siteDescription: brandingForm.siteDescription,
        seoTitle: brandingForm.seoTitle,
        seoDescription: brandingForm.seoDescription,
        seoKeywords: brandingForm.seoKeywords,
        logoUrl: brandingForm.logoUrl,
        faviconUrl: brandingForm.faviconUrl,
        contactEmail: brandingForm.contactEmail,
        contactPhone: brandingForm.contactPhone || null,
        contactWhatsapp: brandingForm.contactWhatsapp || null,
        socialLinks: brandingForm.socialLinks,
      });
      setBrandingForm(res.branding);
      setFounderForm(res.founder);
      await refreshBranding?.();
      setFeedback({ type: 'ok', text: res.message });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save branding configuration.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveFounder = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.updateFounder({
        fullName: founderForm.fullName,
        positionTitle: founderForm.positionTitle,
        biography: founderForm.biography,
        founderMessage: founderForm.founderMessage,
        visionStatement: founderForm.visionStatement,
        missionStatement: founderForm.missionStatement,
        backgroundStory: founderForm.backgroundStory,
        photoUrl: founderForm.photoUrl || null,
        socialLinks: founderForm.socialLinks,
      });
      setBrandingForm(res.branding);
      setFounderForm(res.founder);
      await refreshBranding?.();
      setFeedback({ type: 'ok', text: res.message });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save founder profile.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleUploadBrandingAsset = async (
    slot: 'logo' | 'favicon' | 'founder-photo',
    file: File | null
  ) => {
    if (!file) return;
    setUploadingSlot(slot);
    setFeedback(null);
    try {
      const res = await api.admin.uploadBrandingAsset(slot, file);
      setBrandingForm(res.branding);
      setFounderForm(res.founder);
      await refreshBranding?.();
      setFeedback({ type: 'ok', text: res.message });
    } catch (err) {
      setFeedback({
        type: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Upload failed. Ensure Object Storage is configured or enter an image URL directly.',
      });
    } finally {
      setUploadingSlot(null);
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
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'users', label: 'Users', icon: Users },
    ...(isSuperAdmin
      ? [{ id: 'branding' as AdminSection, label: 'Branding & Founder', icon: Palette }]
      : []),
  ];

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="bg-[#0b337a] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <AcadetCrest className="w-8 h-8 sm:w-9 sm:h-9" />
          <Shield className="w-5 h-5 shrink-0" />
          <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
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
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
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

      <div className="p-3 sm:p-4 space-y-4">
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Users', val: overview?.totalUsers ?? 0 },
                { label: 'Courses', val: overview?.totalCourses ?? 0 },
                { label: 'Active Registrations', val: overview?.totalActiveRegistrations ?? 0 },
                { label: 'Successful Payments', val: overview?.totalSuccessfulPayments ?? 0 },
                { label: 'CBT Questions', val: overview?.totalQuestions ?? 0 },
                { label: 'Study Materials', val: overview?.totalMaterials ?? 0 },
                { label: 'Submitted Exams', val: overview?.totalSubmittedExams ?? 0 },
                {
                  label: 'Reconciled / Shortfalls',
                  val: `${overview?.totalReconciledPayments ?? 0} / ${overview?.totalShortfallPayments ?? 0}`,
                },
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

            {/* Financial Reporting Summary */}
            <div className="rounded-xl border border-[#d6e4fa] dark:border-slate-800 bg-[#eff5ff]/70 dark:bg-slate-800/40 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-[#082252] dark:text-white">
                  Financial Settlement & Charge Reconciliation
                </h3>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Standardized: ₦2,300 Course Value · Paystack Fees Absorbed by Acadet CBT · ₦2,350 Student Payable
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 p-3.5">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Gross Collections
                  </div>
                  <div className="text-lg font-extrabold text-[#082252] dark:text-white tabular-nums mt-0.5">
                    {formatCurrency(overview?.totalRevenueNaira ?? 0, 'NGN')}
                  </div>
                </div>
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 p-3.5">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Course Value Total
                  </div>
                  <div className="text-lg font-extrabold text-[#0b337a] dark:text-blue-400 tabular-nums mt-0.5">
                    {formatCurrency(overview?.totalCourseValueNaira ?? 0, 'NGN')}
                  </div>
                </div>
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 p-3.5">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Paystack Fees Absorbed
                  </div>
                  <div className="text-lg font-extrabold text-amber-700 dark:text-amber-400 tabular-nums mt-0.5">
                    {formatCurrency(overview?.totalPaystackFeesNaira ?? 0, 'NGN')}
                  </div>
                </div>
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 p-3.5">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Net Settlement
                  </div>
                  <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
                    {formatCurrency(overview?.totalNetSettlementNaira ?? 0, 'NGN')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* COURSE MANAGEMENT */}
        {section === 'courses' && (
          <div className="space-y-5">
            <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/70 border border-[#d6e4fa] dark:border-slate-700 px-4 py-3 text-xs font-semibold text-[#082252] dark:text-blue-200">
              All courses use standardized pricing: ₦2,300 course value + processing fees absorbed by Acadet CBT = ₦2,350 total payable.
            </div>

            <form
              onSubmit={handleSaveCourse}
              className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#082252] dark:text-white">
                  {editingCourseId ? 'Edit Course Details' : 'Create New Course'}
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
                <div
                  title="Standardized pricing locked at ₦2,350 student payable (₦2,300 course value)"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-3 py-2 text-sm font-extrabold text-[#082252] dark:text-blue-300 tabular-nums flex items-center justify-between"
                >
                  <span>₦{Number(cFee || 2350).toLocaleString()}</span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    ₦2,300 value
                  </span>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Course description"
                  value={cDesc}
                  onChange={(e) => setCDesc(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                />
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <MessageCircle className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      placeholder="WhatsApp Tutorial Group Link (optional, https://...)"
                      value={cWhatsappLink}
                      onChange={(e) => setCWhatsappLink(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                    />
                  </div>
                  {cWhatsappLink && (
                    <button
                      type="button"
                      onClick={() => setCWhatsappLink('')}
                      title="Remove group link"
                      className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
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
                    <th className="px-4 py-3">Value / Payable</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Group Invite</th>
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
                      <td className="px-4 py-3 tabular-nums">
                        <div className="font-extrabold text-[#082252] dark:text-blue-300">
                          {formatCurrency(2350, c.currency)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Value: {formatCurrency(c.courseValue ?? 2300, c.currency)}
                        </div>
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
                      <td className="px-4 py-3 text-xs">
                        {c.whatsappGroupLink ? (
                          <a
                            href={c.whatsappGroupLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Configured</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400 font-medium">None</span>
                        )}
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
            {/* Payment Record Reset & Backup Console */}
            <div className="rounded-xl border border-[#d6e4fa] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Archive className="w-4 h-4 text-[#0b337a] dark:text-blue-400 shrink-0" />
                  <div>
                    <h3 className="text-sm font-extrabold text-[#082252] dark:text-white">
                      Payment Record Backup &amp; Safe Reset
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Student accounts, exam attempts, results, and registered courses are always preserved.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void loadPaymentResetData()}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Inspect Records</span>
                </button>
              </div>

              {resetPreview && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {[
                    { label: 'Total Records', value: resetPreview.totalPayments },
                    { label: 'Successful', value: resetPreview.successfulCount },
                    { label: 'Pending', value: resetPreview.pendingCount },
                    { label: 'Failed', value: resetPreview.failedCount },
                    { label: 'Test / Stale', value: resetPreview.testAndStaleCount },
                    { label: 'Active Courses', value: resetPreview.activeRegistrationsCount },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 px-3 py-2 text-center"
                    >
                      <div className="text-base sm:text-lg font-extrabold text-[#082252] dark:text-white tabular-nums">
                        {item.value}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between pt-1">
                <div className="flex flex-1 gap-2">
                  <input
                    type="text"
                    value={backupLabel}
                    onChange={(e) => setBackupLabel(e.target.value)}
                    placeholder="Backup snapshot label (e.g. Pre-Launch Reset)"
                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleCreatePaymentBackup}
                    className="px-3.5 py-2 rounded-lg bg-[#0b337a] hover:bg-[#072459] text-white text-xs font-extrabold whitespace-nowrap inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Create Backup Snapshot</span>
                  </button>
                </div>

                {isSuperAdmin ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleResetTestPayments}
                      className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold whitespace-nowrap inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Clean Test &amp; Stale</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setResetAcknowledge(false);
                        setResetConfirmText('');
                        setResetBackupId((prev) => prev || paymentBackups[0]?.id || '');
                        setResetAllModalOpen(true);
                      }}
                      className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold whitespace-nowrap inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Reset All Payments</span>
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Super Admin required for payment deletion.
                  </span>
                )}
              </div>

              {paymentBackups.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5 space-y-1.5">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Verified Payment Backups ({paymentBackups.length})
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {paymentBackups.map((bk) => (
                      <div
                        key={bk.id}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            {bk.backupLabel}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 ml-2 tabular-nums">
                            {bk.totalPaymentsCount} payments · {bk.successfulCount} live · {bk.testCount} test ·{' '}
                            {new Date(bk.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={exportingBackupId === bk.id}
                          onClick={() => void handleDownloadPaymentBackup(bk)}
                          className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>{exportingBackupId === bk.id ? 'Downloading...' : 'Export JSON'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

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
                    <th className="px-4 py-3">Total Charged</th>
                    <th className="px-4 py-3">Course Value</th>
                    <th className="px-4 py-3">Paystack Fee</th>
                    <th className="px-4 py-3">Net Settlement</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Reconciliation</th>
                    <th className="px-4 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
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
                          {formatCurrency(p.totalAmountCharged ?? p.amount, p.currency)}
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                          {formatCurrency(p.courseValue ?? 2300, p.currency)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {p.gatewayFee !== null && p.gatewayFee !== undefined ? (
                            <div>
                              <div className="font-bold text-amber-700 dark:text-amber-400">
                                {formatCurrency(p.gatewayFee, p.currency)}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {p.gatewayFeeSource === 'paystack_actual' ? 'Actual' : 'Schedule'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                          {p.netSettlementAmount !== null && p.netSettlementAmount !== undefined
                            ? formatCurrency(p.netSettlementAmount, p.currency)
                            : '—'}
                        </td>
                        <td className="px-4 py-3 capitalize text-xs font-bold text-slate-600 dark:text-slate-300">
                          {p.paymentChannel || p.gateway}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={p.paymentStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <ReconciliationBadge status={p.reconciliationStatus} />
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

        {/* ADMIN NOTIFICATIONS MANAGEMENT */}
        {section === 'notifications' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/70 border border-[#d6e4fa] dark:border-slate-700 p-3.5 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={notifSearch}
                  onChange={(e) => setNotifSearch(e.target.value)}
                  placeholder="Search notifications by student name, email, or title..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-semibold"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={notifTypeFilter}
                  onChange={(e) => {
                    const nextType = e.target.value as NotificationType | '';
                    setNotifTypeFilter(nextType);
                    void loadNotificationsFiltered(notifSearch, nextType);
                  }}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold"
                >
                  <option value="">All Types</option>
                  <option value="admin_direct">Admin Direct</option>
                  <option value="payment_success">Payment Confirmation (Auto)</option>
                  <option value="system">System</option>
                </select>
                <button
                  type="button"
                  onClick={() => void loadNotificationsFiltered()}
                  className="px-3.5 py-2 rounded-lg bg-[#0a58ed] text-white text-xs font-bold"
                >
                  Filter
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3.5 py-2.5">Recipient</th>
                    <th className="px-3.5 py-2.5">Type</th>
                    <th className="px-3.5 py-2.5">Title & Message</th>
                    <th className="px-3.5 py-2.5">Sender</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {adminNotifications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        No sent notifications match the current filters.
                      </td>
                    </tr>
                  ) : (
                    adminNotifications.map((n) => (
                      <tr key={n.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-3.5 py-2.5">
                          <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                            {n.recipientName}
                          </div>
                          <div className="text-[11px] text-slate-500">{n.recipientEmail}</div>
                        </td>
                        <td className="px-3.5 py-2.5 text-xs font-bold">
                          {n.notificationType === 'payment_success' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Payment Auto
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[#0a58ed] dark:text-blue-400">
                              <Send className="w-3.5 h-3.5" />
                              Admin Direct
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 max-w-sm">
                          <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                            {n.title}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                            {n.message}
                          </div>
                          {n.actionUrl && (
                            <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                              Group CTA: {n.actionLabel || 'Tutorial Group Link'}
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {n.senderName}
                        </td>
                        <td className="px-3.5 py-2.5 text-xs font-bold">
                          {n.isRead ? (
                            <span className="text-emerald-700 dark:text-emerald-400">Read</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">Unread</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                          {new Date(n.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* USERS & STUDENT LIFECYCLE MANAGEMENT */}
        {section === 'users' && (
          <div className="space-y-3.5">
            <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/70 border border-[#d6e4fa] dark:border-slate-700 p-3.5 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void loadUsersFiltered();
                    }
                  }}
                  placeholder="Search by full name, email, username, or WhatsApp..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-semibold"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  {(
                    [
                      { id: '', label: 'All' },
                      { id: 'active', label: 'Active' },
                      { id: 'suspended', label: 'Suspended' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.label}
                      type="button"
                      onClick={() => {
                        setUserStatusFilter(tab.id);
                        void loadUsersFiltered(userSearch, tab.id);
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                        userStatusFilter === tab.id
                          ? 'bg-[#0a58ed] text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => void loadUsersFiltered()}
                  className="px-3.5 py-2 rounded-lg bg-[#0a58ed] text-white text-xs font-bold"
                >
                  Search
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {users.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  No accounts match your search or status filter.
                </div>
              ) : (
                users.map((u) => {
                  const isSuspended = !u.isActive || u.accountStatus === 'suspended';
                  return (
                    <div
                      key={u.id}
                      className={`px-3.5 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-sm ${
                        isSuspended ? 'bg-red-50/35 dark:bg-red-950/10' : ''
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            {u.fullName}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            (@{u.username})
                          </span>
                          <span className="text-[11px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
                            · {u.role}
                          </span>
                          {isSuspended ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 text-xs font-extrabold">
                              <Ban className="w-3 h-3" />
                              Suspended
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold">
                              <CheckCircle2 className="w-3 h-3" />
                              Active
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums">
                          <span>{u.email}</span>
                          {u.whatsappNumber && <span>WhatsApp: {u.whatsappNumber}</span>}
                          <span>Joined {new Date(u.createdAt).toLocaleDateString()}</span>
                          {typeof u.registeredCoursesCount === 'number' && (
                            <span>{u.registeredCoursesCount} Courses</span>
                          )}
                          {typeof u.submittedExamsCount === 'number' && (
                            <span>{u.submittedExamsCount} Exams</span>
                          )}
                        </div>

                        {isSuspended && u.suspendedReason && (
                          <div className="text-[11px] text-red-700 dark:text-red-400 font-medium">
                            Suspension note: {u.suspendedReason}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={loadingProfile}
                          onClick={() => void openStudentProfile(u.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#eff5ff] dark:bg-slate-800 text-[#0b337a] dark:text-blue-300 border border-[#c6daf7] dark:border-slate-700 text-xs font-bold inline-flex items-center gap-1 hover:bg-blue-100 dark:hover:bg-slate-700"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>View Profile</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setNotifyTarget(u);
                            setNotifyTitle('');
                            setNotifyMessage('');
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 text-[#0a58ed] dark:text-blue-300 text-xs font-bold inline-flex items-center gap-1 hover:bg-blue-50 dark:hover:bg-slate-800"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Notify</span>
                        </button>

                        {isSuspended ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleReactivateUser(u)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reactivate</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setSuspendTarget(u);
                              setSuspendReason('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Suspend</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setDeleteTarget(u);
                            setDeleteConfirmationText('');
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
                          title="Permanently Delete Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* BRANDING, SEO & FOUNDER MANAGEMENT (SUPER ADMIN) */}
        {section === 'branding' && isSuperAdmin && (
          <div className="space-y-6">
            {/* Panel 1: Official Website Branding, Logo, Favicon & SEO */}
            <form
              onSubmit={handleSaveBranding}
              className="rounded-xl border border-[#d6e4fa] dark:border-slate-800 p-4 sm:p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <AcadetCrest src={brandingForm.logoUrl} className="w-9 h-9" />
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-[#082252] dark:text-white">
                      Official Branding, Logo, Favicon &amp; SEO
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Consistent across website header, dashboards, exams, results, payments, and footer.
                    </p>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold inline-flex items-center gap-1.5 min-h-[38px]"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{busy ? 'Saving...' : 'Save Branding & SEO'}</span>
                </button>
              </div>

              {/* Logo & Favicon Uploaders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl bg-[#eff5ff]/70 dark:bg-slate-800/50 border border-[#d6e4fa] dark:border-slate-700 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-[#082252] dark:text-white">
                      Official Website Logo
                    </span>
                    <AcadetCrest src={brandingForm.logoUrl} className="w-10 h-10" />
                  </div>
                  <input
                    type="text"
                    value={brandingForm.logoUrl}
                    onChange={(e) =>
                      setBrandingForm((p) => ({ ...p, logoUrl: e.target.value }))
                    }
                    placeholder="/acadet-logo.png"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono"
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                    <ImageIcon className="w-3.5 h-3.5 text-[#0a58ed]" />
                    <span>
                      {uploadingSlot === 'logo' ? 'Uploading Logo...' : 'Upload Logo (PNG/SVG/WEBP)'}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) =>
                        void handleUploadBrandingAsset('logo', e.target.files?.[0] || null)
                      }
                    />
                  </label>
                </div>

                <div className="rounded-xl bg-[#eff5ff]/70 dark:bg-slate-800/50 border border-[#d6e4fa] dark:border-slate-700 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-[#082252] dark:text-white">
                      Browser Favicon (≥ 48×48)
                    </span>
                    <img
                      src={brandingForm.faviconUrl || '/favicon-48x48.png'}
                      alt="Favicon preview"
                      className="w-9 h-9 rounded-lg bg-white p-0.5 border border-slate-200 object-contain"
                    />
                  </div>
                  <input
                    type="text"
                    value={brandingForm.faviconUrl}
                    onChange={(e) =>
                      setBrandingForm((p) => ({ ...p, faviconUrl: e.target.value }))
                    }
                    placeholder="/favicon-48x48.png"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono"
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Upload className="w-3.5 h-3.5 text-[#0a58ed]" />
                    <span>
                      {uploadingSlot === 'favicon' ? 'Uploading Favicon...' : 'Upload Favicon (PNG/ICO)'}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
                      className="hidden"
                      onChange={(e) =>
                        void handleUploadBrandingAsset('favicon', e.target.files?.[0] || null)
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Website Name
                  </label>
                  <input
                    type="text"
                    required
                    value={brandingForm.siteName}
                    onChange={(e) =>
                      setBrandingForm((p) => ({ ...p, siteName: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Brand Tagline
                  </label>
                  <input
                    type="text"
                    required
                    value={brandingForm.tagline}
                    onChange={(e) =>
                      setBrandingForm((p) => ({ ...p, tagline: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Website Description (Public Homepage &amp; Organization Schema)
                </label>
                <textarea
                  rows={2}
                  required
                  value={brandingForm.siteDescription}
                  onChange={(e) =>
                    setBrandingForm((p) => ({ ...p, siteDescription: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    SEO Page Title (&lt;title&gt;)
                  </label>
                  <input
                    type="text"
                    required
                    value={brandingForm.seoTitle}
                    onChange={(e) =>
                      setBrandingForm((p) => ({ ...p, seoTitle: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    SEO Keywords
                  </label>
                  <input
                    type="text"
                    value={brandingForm.seoKeywords}
                    onChange={(e) =>
                      setBrandingForm((p) => ({ ...p, seoKeywords: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  SEO Meta Description
                </label>
                <textarea
                  rows={2}
                  required
                  value={brandingForm.seoDescription}
                  onChange={(e) =>
                    setBrandingForm((p) => ({ ...p, seoDescription: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    required
                    value={brandingForm.contactEmail}
                    onChange={(e) =>
                      setBrandingForm((p) => ({ ...p, contactEmail: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Phone (Optional)
                  </label>
                  <input
                    type="text"
                    value={brandingForm.contactPhone || ''}
                    onChange={(e) =>
                      setBrandingForm((p) => ({ ...p, contactPhone: e.target.value || null }))
                    }
                    placeholder="+234..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Support WhatsApp (Optional)
                  </label>
                  <input
                    type="text"
                    value={brandingForm.contactWhatsapp || ''}
                    onChange={(e) =>
                      setBrandingForm((p) => ({
                        ...p,
                        contactWhatsapp: e.target.value || null,
                      }))
                    }
                    placeholder="+234..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Website Social Media Links (Schema sameAs &amp; Footer)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {(
                    [
                      'facebook',
                      'twitter',
                      'instagram',
                      'youtube',
                      'linkedin',
                      'whatsapp',
                      'tiktok',
                      'website',
                    ] as Array<keyof SocialLinksMap>
                  ).map((net) => (
                    <input
                      key={net}
                      type="url"
                      placeholder={`${net} URL (https://...)`}
                      value={brandingForm.socialLinks?.[net] || ''}
                      onChange={(e) =>
                        setBrandingForm((p) => ({
                          ...p,
                          socialLinks: {
                            ...(p.socialLinks || {}),
                            [net]: e.target.value || undefined,
                          },
                        }))
                      }
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs"
                    />
                  ))}
                </div>
              </div>
            </form>

            {/* Panel 2: Founder & Creator Profile Editor (/founder) */}
            <form
              onSubmit={handleSaveFounder}
              className="rounded-xl border border-[#d6e4fa] dark:border-slate-800 p-4 sm:p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#082252] dark:text-white">
                    Founder &amp; Creator Profile (/founder)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Manage founder biography, vision, mission, photograph, and social profiles.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {onNavigatePublic && (
                    <button
                      type="button"
                      onClick={() => onNavigatePublic('/founder')}
                      className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Preview /founder</span>
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-2 rounded-lg bg-[#0b337a] hover:bg-[#072459] text-white text-xs font-extrabold inline-flex items-center gap-1.5 min-h-[38px]"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{busy ? 'Saving...' : 'Save Founder Profile'}</span>
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-[#eff5ff]/70 dark:bg-slate-800/50 border border-[#d6e4fa] dark:border-slate-700 p-3.5 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#0a58ed] to-[#0b337a] text-white font-extrabold text-xl flex items-center justify-center overflow-hidden shrink-0">
                  {founderForm.photoUrl ? (
                    <img
                      src={founderForm.photoUrl}
                      alt={founderForm.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>IM</span>
                  )}
                </div>
                <div className="flex-1 w-full space-y-2">
                  <input
                    type="text"
                    value={founderForm.photoUrl || ''}
                    onChange={(e) =>
                      setFounderForm((p) => ({ ...p, photoUrl: e.target.value || null }))
                    }
                    placeholder="Founder photo URL (or upload below)"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono"
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Upload className="w-3.5 h-3.5 text-[#0a58ed]" />
                    <span>
                      {uploadingSlot === 'founder-photo'
                        ? 'Uploading Photo...'
                        : 'Upload Founder Photo'}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) =>
                        void handleUploadBrandingAsset(
                          'founder-photo',
                          e.target.files?.[0] || null
                        )
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Founder Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={founderForm.fullName}
                    onChange={(e) =>
                      setFounderForm((p) => ({ ...p, fullName: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Position / Title
                  </label>
                  <input
                    type="text"
                    required
                    value={founderForm.positionTitle}
                    onChange={(e) =>
                      setFounderForm((p) => ({ ...p, positionTitle: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Biography
                </label>
                <textarea
                  rows={3}
                  required
                  value={founderForm.biography}
                  onChange={(e) =>
                    setFounderForm((p) => ({ ...p, biography: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Founder&apos;s Message
                </label>
                <textarea
                  rows={3}
                  required
                  value={founderForm.founderMessage}
                  onChange={(e) =>
                    setFounderForm((p) => ({ ...p, founderMessage: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Vision Statement
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={founderForm.visionStatement}
                    onChange={(e) =>
                      setFounderForm((p) => ({ ...p, visionStatement: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mission Statement
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={founderForm.missionStatement}
                    onChange={(e) =>
                      setFounderForm((p) => ({ ...p, missionStatement: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Acadet CBT Background Story
                </label>
                <textarea
                  rows={2}
                  required
                  value={founderForm.backgroundStory}
                  onChange={(e) =>
                    setFounderForm((p) => ({ ...p, backgroundStory: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Founder Social Links
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {(
                    [
                      'facebook',
                      'twitter',
                      'instagram',
                      'youtube',
                      'linkedin',
                      'whatsapp',
                      'tiktok',
                      'website',
                    ] as Array<keyof SocialLinksMap>
                  ).map((net) => (
                    <input
                      key={net}
                      type="url"
                      placeholder={`${net} URL (https://...)`}
                      value={founderForm.socialLinks?.[net] || ''}
                      onChange={(e) =>
                        setFounderForm((p) => ({
                          ...p,
                          socialLinks: {
                            ...(p.socialLinks || {}),
                            [net]: e.target.value || undefined,
                          },
                        }))
                      }
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs"
                    />
                  ))}
                </div>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Registration Details Modal */}
      {selectedReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="bg-[#0b337a] text-white px-5 py-3.5 flex items-center justify-between">
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
            <div className="p-4 space-y-2 text-sm">
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
          <div className="w-full max-w-lg max-h-[92dvh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-[#0b337a] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
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
            <div className="p-4 space-y-3 text-sm overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
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
                  <span className="text-slate-500 block">Total Charged</span>
                  <span className="font-extrabold tabular-nums">
                    {formatCurrency(
                      selectedPayment.totalAmountCharged ?? selectedPayment.amount,
                      selectedPayment.currency
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Course Value</span>
                  <span className="font-bold tabular-nums">
                    {formatCurrency(selectedPayment.courseValue ?? 2300, selectedPayment.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Paystack Fee Absorbed</span>
                  <span className="font-bold tabular-nums text-amber-700 dark:text-amber-400">
                    {selectedPayment.gatewayFee !== null && selectedPayment.gatewayFee !== undefined
                      ? `${formatCurrency(selectedPayment.gatewayFee, selectedPayment.currency)} (${
                          selectedPayment.gatewayFeeSource === 'paystack_actual'
                            ? 'Actual'
                            : 'Schedule'
                        })`
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Net Settlement</span>
                  <span className="font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {selectedPayment.netSettlementAmount !== null &&
                    selectedPayment.netSettlementAmount !== undefined
                      ? formatCurrency(
                          selectedPayment.netSettlementAmount,
                          selectedPayment.currency
                        )
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status</span>
                  <StatusBadge status={selectedPayment.paymentStatus} />
                </div>
                <div>
                  <span className="text-slate-500 block">Reconciliation</span>
                  <ReconciliationBadge status={selectedPayment.reconciliationStatus} />
                </div>
                <div>
                  <span className="text-slate-500 block">Channel</span>
                  <span className="font-bold capitalize">
                    {selectedPayment.paymentChannel || selectedPayment.gateway}
                  </span>
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
                <pre className="rounded-xl bg-slate-900 text-slate-100 p-3 text-xs overflow-x-auto max-h-40">
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

      {/* Admin Student Profile Modal (Courses, Payments History, Exam History, Lifecycle Actions) */}
      {studentProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/60 backdrop-blur-[1px]">
          <div className="w-full max-w-3xl max-h-[92dvh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-[#0b337a] text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <UserCheck className="w-5 h-5 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm sm:text-base truncate">
                    Student Profile & Academic Record
                  </h3>
                  <p className="text-xs text-blue-100 truncate">
                    {studentProfile.student.fullName} · {studentProfile.student.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStudentProfile(null)}
                className="p-1.5 rounded-lg hover:bg-white/15 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4">
              {/* Quick Profile Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  {studentProfile.student.accountStatus === 'suspended' ||
                  !studentProfile.student.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 text-xs font-extrabold">
                      <Ban className="w-3.5 h-3.5" />
                      Account Suspended
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Active Account
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNotifyTarget(studentProfile.student);
                      setNotifyTitle('');
                      setNotifyMessage('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Notification</span>
                  </button>

                  {studentProfile.student.accountStatus === 'suspended' ||
                  !studentProfile.student.isActive ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleReactivateUser(studentProfile.student)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reactivate Account</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setSuspendTarget(studentProfile.student);
                        setSuspendReason('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Suspend Account</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setDeleteTarget(studentProfile.student);
                      setDeleteConfirmationText('');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Delete</span>
                  </button>
                </div>
              </div>

              {/* Student Metadata */}
              <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/80 border border-[#d6e4fa] dark:border-slate-700 p-3 grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
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
                  <span className="font-semibold tabular-nums">
                    {new Date(studentProfile.student.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Account Status</span>
                  <span
                    className={`font-extrabold ${
                      studentProfile.student.isActive &&
                      studentProfile.student.accountStatus !== 'suspended'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {studentProfile.student.isActive &&
                    studentProfile.student.accountStatus !== 'suspended'
                      ? 'Active'
                      : 'Suspended'}
                  </span>
                </div>
              </div>

              {/* Payment & Academic Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-2.5">
                  <div className="text-lg font-extrabold text-[#0b337a] dark:text-blue-400 tabular-nums">
                    {studentProfile.summary.totalCoursesRegistered}
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    Courses Registered
                  </div>
                </div>
                <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-2.5">
                  <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {studentProfile.summary.totalSuccessfulPayments}
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    Successful Payments
                  </div>
                </div>
                <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-2.5">
                  <div className="text-lg font-extrabold text-[#082252] dark:text-white tabular-nums">
                    {formatCurrency(studentProfile.summary.totalAmountPaid, 'NGN')}
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    Total Paid
                  </div>
                </div>
                <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-2.5">
                  <div className="text-lg font-extrabold text-blue-700 dark:text-blue-400 tabular-nums">
                    {studentProfile.summary.totalSubmittedExams ?? 0}
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    Submitted Exams
                  </div>
                </div>
              </div>

              {/* Per-Course Checklist */}
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-[#082252] dark:text-white mb-2">
                  Registered Courses Status
                </h4>
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  {studentProfile.coursesStatus.map((cs) => (
                    <div
                      key={cs.courseId}
                      className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs sm:text-sm"
                    >
                      <div className="min-w-0">
                        <span className="font-extrabold">
                          {cs.code} — {cs.title}
                        </span>
                        <span className="text-xs text-slate-500 ml-2 tabular-nums">
                          ({formatCurrency(cs.amountPaid ?? cs.registrationFee, cs.currency)})
                        </span>
                      </div>
                      {cs.isRegistered ? (
                        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-400 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Registered ✓
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 shrink-0">
                          <Lock className="w-3 h-3" />
                          Not Registered
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment History */}
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-[#082252] dark:text-white mb-2">
                  Payment History ({studentProfile.payments.length})
                </h4>
                {studentProfile.payments.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-4 text-xs text-slate-500 text-center">
                    No payment transactions recorded for this student yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/70 font-extrabold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-3 py-2">Course</th>
                          <th className="px-3 py-2">Reference</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {studentProfile.payments.map((p) => (
                          <tr key={p.id}>
                            <td className="px-3 py-2 font-bold">
                              {p.courseCode} — {p.courseTitle}
                            </td>
                            <td className="px-3 py-2 font-mono">{p.paymentReference}</td>
                            <td className="px-3 py-2 font-extrabold tabular-nums">
                              {formatCurrency(p.totalAmountCharged ?? p.amount, p.currency)}
                            </td>
                            <td className="px-3 py-2">
                              <StatusBadge status={p.paymentStatus} />
                            </td>
                            <td className="px-3 py-2 text-slate-500 tabular-nums whitespace-nowrap">
                              {new Date(p.paidAt || p.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Examination History */}
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-[#082252] dark:text-white mb-2">
                  Examination History ({studentProfile.examHistory?.length ?? 0})
                </h4>
                {!studentProfile.examHistory || studentProfile.examHistory.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-4 text-xs text-slate-500 text-center">
                    No CBT examinations attempted by this student yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/70 font-extrabold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-3 py-2">Course</th>
                          <th className="px-3 py-2">Difficulty</th>
                          <th className="px-3 py-2">Score</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {studentProfile.examHistory.map((ex) => (
                          <tr key={ex.id}>
                            <td className="px-3 py-2 font-bold">
                              {ex.courseCode ? `${ex.courseCode} — ` : ''}
                              {ex.courseTitle || ex.examTitle}
                            </td>
                            <td className="px-3 py-2">{ex.difficultyFilter}</td>
                            <td className="px-3 py-2 font-extrabold tabular-nums">
                              {ex.scorePercentage !== null
                                ? `${ex.scorePercentage}% (${ex.correctCount ?? 0}/${ex.totalQuestions})`
                                : `— (${ex.totalQuestions} Qs)`}
                            </td>
                            <td className="px-3 py-2 capitalize font-semibold">
                              {ex.status.replace('_', ' ')}
                            </td>
                            <td className="px-3 py-2 text-slate-500 tabular-nums whitespace-nowrap">
                              {new Date(ex.submittedAt || ex.startedAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Account Confirmation Modal */}
      {suspendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="bg-amber-600 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5" />
                <h3 className="text-sm sm:text-base font-extrabold">Suspend Account</h3>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setSuspendTarget(null)}
                className="p-1 rounded-lg hover:bg-white/15"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleConfirmSuspend} className="p-4 space-y-3">
              <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-1">
                <p>
                  Suspending <strong>{suspendTarget.fullName}</strong> ({suspendTarget.email}) immediately blocks login, CBT exams, and new payments while preserving all course registrations, payment receipts, and exam history.
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Suspension Reason (optional)
                </label>
                <textarea
                  rows={2}
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="e.g. Account under administrative review..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setSuspendTarget(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold"
                >
                  {busy ? 'Suspending...' : 'Confirm Suspension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permanent Account Deletion Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/65 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 shadow-2xl overflow-hidden">
            <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-sm sm:text-base font-extrabold">
                  Permanently Delete Account
                </h3>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setDeleteTarget(null)}
                className="p-1 rounded-lg hover:bg-white/15"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleConfirmPermanentDelete} className="p-4 space-y-3">
              <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 text-xs text-red-800 dark:text-red-200 space-y-1">
                <div className="font-extrabold">This action cannot be undone.</div>
                <p>
                  Personal account data, registrations, exam sessions, and notifications for{' '}
                  <strong>{deleteTarget.fullName}</strong> ({deleteTarget.email}) will be permanently removed. Financial payment records remain in anonymized audit form.
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Type <strong>DELETE</strong> or the user&apos;s email to confirm
                </label>
                <input
                  type="text"
                  required
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full rounded-xl border border-red-300 dark:border-red-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-bold"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDeleteTarget(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    busy ||
                    (deleteConfirmationText.trim().toUpperCase() !== 'DELETE' &&
                      deleteConfirmationText.trim().toLowerCase() !==
                        deleteTarget.email.toLowerCase())
                  }
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-extrabold"
                >
                  {busy ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Individual Student Notification Composer Modal */}
      {notifyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="bg-[#0b337a] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Send className="w-4 h-4 shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-extrabold truncate">
                    Send Notification
                  </h3>
                  <p className="text-[11px] text-blue-100 truncate">
                    Recipient: {notifyTarget.fullName} ({notifyTarget.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setNotifyTarget(null)}
                className="p-1 rounded-lg hover:bg-white/15"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSendStudentNotification} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notification Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={180}
                  value={notifyTitle}
                  onChange={(e) => setNotifyTitle(e.target.value)}
                  placeholder="e.g. Exam Schedule Update"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  minLength={2}
                  maxLength={3000}
                  value={notifyMessage}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  placeholder="Write a direct message for this student..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setNotifyTarget(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !notifyTitle.trim() || !notifyMessage.trim()}
                  className="px-4 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{busy ? 'Sending...' : 'Send Notification'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Production Payment Record Reset Confirmation Modal (Super Admin) */}
      {resetAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 shadow-2xl overflow-hidden">
            <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-sm sm:text-base font-extrabold">
                  Full Payment Record Reset (Super Admin)
                </h3>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setResetAllModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/15"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetAllPayments} className="p-4 space-y-3">
              <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 text-xs text-red-800 dark:text-red-200 space-y-1.5">
                <div className="font-extrabold">Read Consequences Carefully:</div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    All payment transaction rows and Paystack webhook event logs will be removed from the active dashboard, resetting revenue statistics to zero.
                  </li>
                  <li>
                    Student accounts, exam attempts, results, and previously registered courses remain intact with preserved reference metadata.
                  </li>
                  <li>A verified JSON backup snapshot is required before proceeding.</li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Verified Backup Snapshot
                </label>
                {paymentBackups.length === 0 ? (
                  <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-900 dark:text-amber-200">
                    No backup exists yet. Close this dialog and click{' '}
                    <strong>Create Backup Snapshot</strong> first.
                  </div>
                ) : (
                  <select
                    required
                    value={resetBackupId}
                    onChange={(e) => setResetBackupId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
                  >
                    {paymentBackups.map((bk) => (
                      <option key={bk.id} value={bk.id}>
                        {bk.backupLabel} ({bk.totalPaymentsCount} records · {new Date(bk.createdAt).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetAcknowledge}
                  onChange={(e) => setResetAcknowledge(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-600"
                />
                <span>
                  I understand this clears active payment transaction history and confirm a verified backup has been created.
                </span>
              </label>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Type <strong>RESET ALL PAYMENTS</strong> to confirm
                </label>
                <input
                  type="text"
                  required
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="RESET ALL PAYMENTS"
                  className="w-full rounded-xl border border-red-300 dark:border-red-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-extrabold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setResetAllModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    busy ||
                    !resetBackupId ||
                    !resetAcknowledge ||
                    resetConfirmText.trim().toUpperCase() !== 'RESET ALL PAYMENTS'
                  }
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-extrabold"
                >
                  {busy ? 'Resetting...' : 'Execute Full Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
