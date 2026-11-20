import {
  AlertCircle,
  AlertTriangle,
  Archive,
  Ban,
  BarChart3,
  Bell,
  BookCheck,
  BookOpen,
  Bot,
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
  KeyRound,
  Lock,
  Mail,
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
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { api, getClientAuthToken } from '../../lib/api';
import type {
  AccountStatus,
  AdminCourseItem,
  AdminEmailStatusOverview,
  AdminNotificationRecord,
  AdminOverview,
  AdminPaymentRecord,
  AdminPaymentVerificationLog,
  AdminQuestionItem,
  AdminRegistrationItem,
  AdminStudentProfile,
  AnnouncementItem,
  CourseQuestionStatsItem,
  FounderProfileData,
  MaterialCategory,
  NotificationType,
  OptionLetter,
  PaymentBackupSummary,
  PaymentReceiptData,
  PaymentResetPreview,
  PaymentStatus,
  PaymentVerificationResult,
  PublicationStatus,
  QuestionDifficulty,
  QuestionImageItem,
  QuestionPublicationStatus,
  QuestionStatsSummary,
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
import { AdminEmailStatusPanel } from './AdminEmailStatusPanel';
import { AiQuestionGeneratorPanel } from './AiQuestionGeneratorPanel';
import { AiSettingsPanel } from './AiSettingsPanel';
import { CopyReferenceButton } from './CopyReferenceButton';
import { formatCurrency } from './CourseRegistrationView';
import { Gst111ManualActivationPanel } from './Gst111ManualActivationPanel';
import { PaymentReceiptModal } from './PaymentReceiptModal';
import { QuestionStatsDashboard } from './QuestionStatsDashboard';

interface AdminConsoleProps {
  onCatalogUpdated: () => Promise<void>;
  userRole?: SafeUser['role'];
  userEmail?: string;
  onNavigatePublic?: (path: string) => void;
}

type AdminSection =
  | 'overview'
  | 'courses'
  | 'registrations'
  | 'gst111'
  | 'payments'
  | 'verifications'
  | 'questions'
  | 'ai_generator'
  | 'ai_settings'
  | 'materials'
  | 'announcements'
  | 'notifications'
  | 'users'
  | 'email'
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

function VerificationResultBadge({ result }: { result: PaymentVerificationResult }) {
  const styles: Record<PaymentVerificationResult, { bg: string; label: string }> = {
    successful: {
      bg: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300',
      label: 'Successful',
    },
    already_registered: {
      bg: 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300',
      label: 'Already Registered',
    },
    pending: {
      bg: 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300',
      label: 'Pending',
    },
    failed: {
      bg: 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300',
      label: 'Failed',
    },
    not_found: {
      bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
      label: 'Not Found',
    },
    awaiting_admin_review: {
      bg: 'bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300',
      label: 'Awaiting Review',
    },
    unauthorized_or_mismatch: {
      bg: 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300',
      label: 'Mismatch / Blocked',
    },
  };
  const cfg = styles[result] || styles.not_found;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-extrabold ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  onCatalogUpdated,
  userRole = 'admin',
  userEmail = '',
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
  const [cValue, setCValue] = useState('2300');
  const [cValueCustom, setCValueCustom] = useState(false);
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
  const [adminReceipt, setAdminReceipt] = useState<PaymentReceiptData | null>(null);

  // Payment Verification Logs & Admin Review
  const [verificationLogs, setVerificationLogs] = useState<AdminPaymentVerificationLog[]>([]);
  const [verificationSummary, setVerificationSummary] = useState<{
    total: number;
    counts: Record<string, number>;
  }>({ total: 0, counts: {} });
  const [verifResultFilter, setVerifResultFilter] = useState<PaymentVerificationResult | ''>('');
  const [verifCourseId, setVerifCourseId] = useState('');
  const [verifSearch, setVerifSearch] = useState('');
  const [loadingVerifLogs, setLoadingVerifLogs] = useState(false);
  const [inspectingLog, setInspectingLog] = useState<AdminPaymentVerificationLog | null>(null);
  const [resolveStudentId, setResolveStudentId] = useState('');
  const [resolveCourseId, setResolveCourseId] = useState('');
  const [resolveNote, setResolveNote] = useState('');

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

  // Question Stats & Bank filtering/editing
  const [questionStatsSummary, setQuestionStatsSummary] =
    useState<QuestionStatsSummary | null>(null);
  const [courseQuestionStats, setCourseQuestionStats] = useState<CourseQuestionStatsItem[]>([]);
  const [statsRefreshing, setStatsRefreshing] = useState(false);
  const [selectedStatsCourseId, setSelectedStatsCourseId] = useState('');
  const [selectedCourseDetailId, setSelectedCourseDetailId] = useState<string | null>(null);
  const [qFilterDifficulty, setQFilterDifficulty] = useState<QuestionDifficulty | ''>('');
  const [qFilterStatus, setQFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [qFilterPubStatus, setQFilterPubStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [qFilterSearch, setQFilterSearch] = useState('');
  const questionFormRef = useRef<HTMLFormElement | null>(null);
  const manualImageInputRef = useRef<HTMLInputElement | null>(null);

  // Question form (create / edit)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
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
  const [qIsActive, setQIsActive] = useState(true);
  const [qPublicationStatus, setQPublicationStatus] =
    useState<QuestionPublicationStatus>('published');
  const [qNewImageFiles, setQNewImageFiles] = useState<File[]>([]);
  const [qNewImagePreviews, setQNewImagePreviews] = useState<string[]>([]);
  const [qExistingImages, setQExistingImages] = useState<QuestionImageItem[]>([]);
  const [uploadingManualImage, setUploadingManualImage] = useState(false);
  const [replacingManualImageId, setReplacingManualImageId] = useState<string | null>(null);

  // Material upload form & inline editor
  const [matTitle, setMatTitle] = useState('');
  const [matCategory, setMatCategory] = useState<MaterialCategory>('Notes');
  const [matCourseId, setMatCourseId] = useState('');
  const [matDesc, setMatDesc] = useState('');
  const [matPrice, setMatPrice] = useState('0');
  const [matFile, setMatFile] = useState<File | null>(null);
  const matFileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editMatTitle, setEditMatTitle] = useState('');
  const [editMatPrice, setEditMatPrice] = useState('0');
  const [editMatCourseId, setEditMatCourseId] = useState('');
  const [editMatCategory, setEditMatCategory] = useState<MaterialCategory>('Notes');
  const [editMatDesc, setEditMatDesc] = useState('');

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

  // SMTP Email, Verification & Password Recovery Overview
  const [emailStatusOverview, setEmailStatusOverview] =
    useState<AdminEmailStatusOverview | null>(null);

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

  const loadVerificationLogs = async (
    nextResult: PaymentVerificationResult | '' = verifResultFilter,
    nextCourseId: string = verifCourseId,
    nextSearch: string = verifSearch
  ) => {
    setLoadingVerifLogs(true);
    try {
      const res = await api.admin.listVerificationLogs({
        result: nextResult || undefined,
        courseId: nextCourseId || undefined,
        search: nextSearch || undefined,
      });
      setVerificationLogs(res.logs);
      setVerificationSummary(res.summary);
    } finally {
      setLoadingVerifLogs(false);
    }
  };

  const loadQuestionStats = async () => {
    setStatsRefreshing(true);
    try {
      const res = await api.admin.getQuestionStats();
      setQuestionStatsSummary(res.summary);
      setCourseQuestionStats(res.courses);
    } finally {
      setStatsRefreshing(false);
    }
  };

  const loadFilteredQuestions = async (
    nextCourseId: string = selectedStatsCourseId,
    nextDifficulty: QuestionDifficulty | '' = qFilterDifficulty,
    nextStatus: 'all' | 'active' | 'inactive' = qFilterStatus,
    nextSearch: string = qFilterSearch,
    nextPubStatus: 'all' | 'published' | 'draft' = qFilterPubStatus
  ) => {
    const res = await api.admin.listQuestions({
      courseId: nextCourseId || undefined,
      difficulty: nextDifficulty || undefined,
      status: nextStatus,
      publicationStatus: nextPubStatus,
      search: nextSearch.trim() || undefined,
    });
    setQuestions(res.questions);
  };

  const loadAllAdminData = async () => {
    const [
      ov,
      cRes,
      qRes,
      qStatsRes,
      matRes,
      annRes,
      usrRes,
      regRes,
      payRes,
      notifRes,
      resetRes,
      brandRes,
      verifRes,
      emailStatusRes,
    ] = await Promise.allSettled([
      api.admin.getOverview(),
      api.admin.listCourses(),
      api.admin.listQuestions({
        courseId: selectedStatsCourseId || undefined,
        difficulty: qFilterDifficulty || undefined,
        status: qFilterStatus,
        publicationStatus: qFilterPubStatus,
        search: qFilterSearch.trim() || undefined,
      }),
      api.admin.getQuestionStats(),
      api.admin.listMaterials(),
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
      api.admin.listVerificationLogs({
        result: verifResultFilter || undefined,
        courseId: verifCourseId || undefined,
        search: verifSearch || undefined,
      }),
      api.admin.getEmailStatus(false),
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

    if (qStatsRes.status === 'fulfilled') {
      setQuestionStatsSummary(qStatsRes.value.summary);
      setCourseQuestionStats(qStatsRes.value.courses);
    }

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

    if (verifRes.status === 'fulfilled') {
      setVerificationLogs(verifRes.value.logs);
      setVerificationSummary(verifRes.value.summary);
    }

    if (emailStatusRes.status === 'fulfilled') {
      setEmailStatusOverview(emailStatusRes.value);
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

  const derivePreviewCourseValue = (feeNaira: number): number => {
    if (!Number.isFinite(feeNaira) || feeNaira <= 0) return 0;
    const cleanFee = Number(feeNaira.toFixed(2));
    if (Math.abs(cleanFee - 2350) < 0.01) return 2300;
    const amountKobo = Math.round(cleanFee * 100);
    const percentageFee = Math.round(amountKobo * 0.015);
    const flatFee = amountKobo < 250_000 ? 0 : 10_000;
    const gatewayFee = Math.min(200_000, percentageFee + flatFee);
    return Number((Math.max(0, amountKobo - gatewayFee) / 100).toFixed(2));
  };

  const handleCourseFeeChange = (nextFeeStr: string) => {
    setCFee(nextFeeStr);
    if (!cValueCustom) {
      const parsedFee = Number(nextFeeStr);
      if (Number.isFinite(parsedFee) && parsedFee > 0) {
        setCValue(String(derivePreviewCourseValue(parsedFee)));
      } else {
        setCValue('');
      }
    }
  };

  const resetCourseForm = () => {
    setEditingCourseId(null);
    setCCode('');
    setCTitle('');
    setCLevel('100 Level');
    setCFee('2350');
    setCValue('2300');
    setCValueCustom(false);
    setCPubStatus('published');
    setCDuration('60');
    setCDesc('');
    setCWhatsappLink('');
  };

  const startEditCourse = (c: AdminCourseItem) => {
    const existingFee = Number(c.registrationFee ?? 2350);
    const autoValue = derivePreviewCourseValue(existingFee);
    const existingVal = Number(c.courseValue ?? autoValue);
    setEditingCourseId(c.id);
    setCCode(c.code);
    setCTitle(c.title);
    setCLevel(c.level);
    setCFee(String(existingFee));
    setCValue(String(existingVal));
    setCValueCustom(Math.abs(existingVal - autoValue) > 0.01);
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
      const feeNum = Number(cFee);
      if (!Number.isFinite(feeNum) || feeNum < 100) {
        setFeedback({ type: 'err', text: 'Course registration price must be at least ₦100.' });
        setBusy(false);
        return;
      }
      const valNum =
        cValue.trim() !== '' ? Number(cValue) : derivePreviewCourseValue(feeNum);
      if (!Number.isFinite(valNum) || valNum < 0 || valNum > feeNum) {
        setFeedback({
          type: 'err',
          text: 'Net course value must be between ₦0 and the student registration price.',
        });
        setBusy(false);
        return;
      }

      const durNum = Number(cDuration) || 60;
      const trimmedGroupLink = cWhatsappLink.trim();
      if (editingCourseId) {
        await api.admin.updateCourse(editingCourseId, {
          code: cCode.trim().toUpperCase(),
          title: cTitle.trim(),
          level: cLevel.trim(),
          description: cDesc.trim(),
          registrationFee: Number(feeNum.toFixed(2)),
          courseValue: Number(valNum.toFixed(2)),
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
          registrationFee: Number(feeNum.toFixed(2)),
          courseValue: Number(valNum.toFixed(2)),
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
      setSelectedPayment((prev) => {
        if (!prev || prev.id !== paymentId || !outcome.payment) return prev;
        const nextPay = outcome.payment;
        const nextStatus: PaymentStatus =
          outcome.paymentStatus !== 'not_found' ? outcome.paymentStatus : prev.paymentStatus;
        return {
          ...prev,
          paymentStatus: nextStatus,
          paidAt: nextPay.paidAt,
          gatewayTransactionId: nextPay.gatewayTransactionId,
          courseValue: nextPay.courseValue
            ? Number(nextPay.courseValue)
            : prev.courseValue,
          totalAmountCharged: nextPay.totalAmountCharged
            ? Number(nextPay.totalAmountCharged)
            : prev.totalAmountCharged,
          gatewayFee:
            nextPay.gatewayFee !== undefined && nextPay.gatewayFee !== null
              ? Number(nextPay.gatewayFee)
              : prev.gatewayFee,
          gatewayFeeSource: nextPay.gatewayFeeSource ?? prev.gatewayFeeSource,
          netSettlementAmount:
            nextPay.netSettlementAmount !== undefined &&
            nextPay.netSettlementAmount !== null
              ? Number(nextPay.netSettlementAmount)
              : prev.netSettlementAmount,
          settlementVariance:
            nextPay.settlementVariance !== undefined &&
            nextPay.settlementVariance !== null
              ? Number(nextPay.settlementVariance)
              : prev.settlementVariance,
          reconciliationStatus:
            nextPay.reconciliationStatus ?? prev.reconciliationStatus,
          feeAbsorbedBy: nextPay.feeAbsorbedBy ?? prev.feeAbsorbedBy,
          paymentChannel: nextPay.paymentChannel ?? prev.paymentChannel,
        };
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Paystack re-verification failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleOpenAdminReceipt = async (paymentId: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.payments.getReceipt(paymentId);
      setAdminReceipt(res.receipt);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load official payment receipt.',
      });
    } finally {
      setBusy(false);
    }
  };

  const openInspectLog = (log: AdminPaymentVerificationLog) => {
    setInspectingLog(log);
    setResolveNote(log.resolutionNote || '');
    const emailMatch = log.paystackCustomerEmail
      ? users.find((u) => u.email.toLowerCase() === log.paystackCustomerEmail?.toLowerCase())?.id
      : undefined;
    setResolveStudentId(log.studentId || emailMatch || '');
    setResolveCourseId(log.courseId || '');
  };

  const handleRequeryLogLive = async (logId: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.reverifyVerificationLog(logId);
      setFeedback({
        type: res.paystackStatus.toLowerCase() === 'success' ? 'ok' : 'err',
        text: res.message,
      });
      setInspectingLog((prev) =>
        prev && prev.id === logId
          ? {
              ...prev,
              paystackStatus: res.paystackStatus,
              paystackAmountKobo: res.paystackAmountKobo,
              paystackCurrency: res.paystackCurrency,
              paystackCustomerEmail: res.paystackCustomerEmail,
              paystackTransactionId: res.paystackTransactionId,
              paystackPayload: res.paystackPayload,
            }
          : prev
      );
      if (!resolveStudentId && res.paystackCustomerEmail) {
        const matched = users.find(
          (u) => u.email.toLowerCase() === res.paystackCustomerEmail?.toLowerCase()
        );
        if (matched) setResolveStudentId(matched.id);
      }
      await loadVerificationLogs();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to query Paystack.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleResolveVerificationLog = async (action: 'approve_activate' | 'reject') => {
    if (!inspectingLog) return;
    if (resolveNote.trim().length < 3) {
      setFeedback({
        type: 'err',
        text: 'Please provide a brief resolution note explaining the review decision.',
      });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.resolveVerificationLog(inspectingLog.id, {
        action,
        studentId: resolveStudentId || undefined,
        courseId: resolveCourseId || undefined,
        resolutionNote: resolveNote.trim(),
        reverifyLive: action === 'approve_activate',
      });
      setFeedback({
        type: action === 'approve_activate' ? 'ok' : 'err',
        text: res.message,
      });
      setInspectingLog(null);
      await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to resolve verification log.',
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

  const resetQuestionForm = (keepCourse = true) => {
    setEditingQuestionId(null);
    if (!keepCourse && courses[0]) setQCourseId(courses[0].id);
    setQText('');
    setQOptA('');
    setQOptB('');
    setQOptC('');
    setQOptD('');
    setQCorrect('A');
    setQDiff('Medium');
    setQTopic('General');
    setQExplanation('');
    setQIsActive(true);
    setQPublicationStatus('published');
    setQNewImagePreviews((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
    setQNewImageFiles([]);
    setQExistingImages([]);
    if (manualImageInputRef.current) {
      manualImageInputRef.current.value = '';
    }
  };

  const startEditQuestion = (q: AdminQuestionItem) => {
    setEditingQuestionId(q.id);
    if (q.courseId) setQCourseId(q.courseId);
    setQText(q.questionText);
    setQOptA(q.optionA);
    setQOptB(q.optionB);
    setQOptC(q.optionC);
    setQOptD(q.optionD);
    setQCorrect(q.correctOption);
    setQDiff(q.difficulty);
    setQTopic(q.topic || 'General');
    setQExplanation(q.explanation || '');
    setQIsActive(q.isActive);
    setQPublicationStatus(q.publicationStatus || 'published');
    setQExistingImages(q.images || []);
    setQNewImagePreviews((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
    setQNewImageFiles([]);
    setFeedback(null);
    questionFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSelectStatsCourse = (courseId: string) => {
    setSelectedStatsCourseId(courseId);
    if (courseId) setQCourseId(courseId);
    void loadFilteredQuestions(courseId, qFilterDifficulty, qFilterStatus, qFilterSearch);
  };

  const handleQuickAddForCourse = (courseId: string) => {
    resetQuestionForm(true);
    setQCourseId(courseId);
    setSelectedStatsCourseId(courseId);
    void loadFilteredQuestions(courseId, qFilterDifficulty, qFilterStatus, qFilterSearch);
    questionFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleManualImageSelection = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    if (manualImageInputRef.current) {
      manualImageInputRef.current.value = '';
    }
    const allowed = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
    const invalid = files.find((f) => !allowed.has(f.type.toLowerCase()));
    if (invalid) {
      setFeedback({
        type: 'err',
        text: `Unsupported image "${invalid.name}". Only JPG, JPEG, PNG, and WEBP are allowed.`,
      });
      return;
    }
    const tooLarge = files.find((f) => f.size > 5 * 1024 * 1024);
    if (tooLarge) {
      setFeedback({
        type: 'err',
        text: `Image "${tooLarge.name}" exceeds the 5 MB limit.`,
      });
      return;
    }

    if (editingQuestionId) {
      setUploadingManualImage(true);
      setFeedback(null);
      try {
        const res = await api.admin.uploadQuestionImages(editingQuestionId, files);
        setQExistingImages(res.images);
        setFeedback({ type: 'ok', text: res.message });
        await loadFilteredQuestions();
      } catch (err) {
        setFeedback({
          type: 'err',
          text: err instanceof Error ? err.message : 'Failed to attach image(s).',
        });
      } finally {
        setUploadingManualImage(false);
      }
      return;
    }

    const nextFiles = [...qNewImageFiles, ...files].slice(0, 5);
    const nextUrls = nextFiles.map((f) => URL.createObjectURL(f));
    setQNewImagePreviews((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u));
      return nextUrls;
    });
    setQNewImageFiles(nextFiles);
  };

  const handleRemoveQueuedManualImage = (index: number) => {
    const nextFiles = qNewImageFiles.filter((_, idx) => idx !== index);
    const nextUrls = nextFiles.map((f) => URL.createObjectURL(f));
    setQNewImagePreviews((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u));
      return nextUrls;
    });
    setQNewImageFiles(nextFiles);
  };

  const handleReplaceExistingQuestionImage = async (imageId: string, file: File) => {
    if (!editingQuestionId) return;
    setReplacingManualImageId(imageId);
    setFeedback(null);
    try {
      const res = await api.admin.replaceQuestionImage(editingQuestionId, imageId, file);
      setQExistingImages(res.images);
      setFeedback({ type: 'ok', text: res.message });
      await loadFilteredQuestions();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to replace question image.',
      });
    } finally {
      setReplacingManualImageId(null);
    }
  };

  const handleDeleteExistingQuestionImage = async (imageId: string) => {
    if (!editingQuestionId) return;
    setReplacingManualImageId(imageId);
    setFeedback(null);
    try {
      await api.admin.deleteQuestionImage(editingQuestionId, imageId);
      setQExistingImages((prev) => prev.filter((img) => img.id !== imageId));
      setFeedback({ type: 'ok', text: 'Question image removed.' });
      await loadFilteredQuestions();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to remove question image.',
      });
    } finally {
      setReplacingManualImageId(null);
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qCourseId) return;
    setBusy(true);
    setFeedback(null);
    try {
      if (editingQuestionId) {
        await api.admin.updateQuestion(editingQuestionId, {
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
          isActive: qPublicationStatus === 'draft' ? false : qIsActive,
          publicationStatus: qPublicationStatus,
        });
        resetQuestionForm(true);
        setFeedback({
          type: 'ok',
          text: 'Question updated and difficulty statistics synchronized.',
        });
      } else if (qNewImageFiles.length > 0) {
        const fd = new FormData();
        fd.append('courseId', qCourseId);
        fd.append('questionText', qText);
        fd.append('optionA', qOptA);
        fd.append('optionB', qOptB);
        fd.append('optionC', qOptC);
        fd.append('optionD', qOptD);
        fd.append('correctOption', qCorrect);
        fd.append('difficulty', qDiff);
        fd.append('topic', qTopic || 'General');
        fd.append('explanation', qExplanation);
        fd.append('publicationStatus', qPublicationStatus);
        qNewImageFiles.forEach((f) => fd.append('images', f));
        await api.admin.createQuestion(fd);
        resetQuestionForm(true);
        setFeedback({
          type: 'ok',
          text:
            qPublicationStatus === 'draft'
              ? 'Question and image(s) saved as draft.'
              : 'Question and image(s) published to PostgreSQL and statistics updated.',
        });
      } else {
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
          publicationStatus: qPublicationStatus,
        });
        resetQuestionForm(true);
        setFeedback({
          type: 'ok',
          text:
            qPublicationStatus === 'draft'
              ? 'Question saved as draft in PostgreSQL.'
              : 'Question published to PostgreSQL and statistics updated.',
        });
      }
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

  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matFile) {
      setFeedback({ type: 'err', text: 'Select a PDF, DOC, or image file to upload.' });
      return;
    }
    const parsedPrice = Number(matPrice.trim() === '' ? '0' : matPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0 || (parsedPrice > 0 && parsedPrice < 100)) {
      setFeedback({
        type: 'err',
        text: 'Material price must be ₦0 (Free) or at least ₦100 for Paystack checkout.',
      });
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
      fd.append('price', String(Number(parsedPrice.toFixed(2))));
      if (matCourseId) fd.append('courseId', matCourseId);

      await api.admin.uploadMaterial(fd);
      setMatTitle('');
      setMatDesc('');
      setMatPrice('0');
      setMatFile(null);
      if (matFileInputRef.current) {
        matFileInputRef.current.value = '';
      }
      setFeedback({
        type: 'ok',
        text:
          parsedPrice > 0
            ? `Paid study material (₦${parsedPrice.toLocaleString()}) uploaded and saved.`
            : 'Free study material uploaded and saved to PostgreSQL.',
      });
      await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Material upload failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const startEditMaterial = (mat: StudyMaterialItem) => {
    setEditingMaterialId(mat.id);
    setEditMatTitle(mat.title);
    setEditMatPrice(String(mat.price ?? 0));
    setEditMatCourseId(mat.courseId || '');
    setEditMatCategory(mat.category);
    setEditMatDesc(mat.description || '');
    setFeedback(null);
  };

  const handleSaveMaterialEdit = async (materialId: string) => {
    const parsedPrice = Number(editMatPrice.trim() === '' ? '0' : editMatPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0 || (parsedPrice > 0 && parsedPrice < 100)) {
      setFeedback({
        type: 'err',
        text: 'Material price must be ₦0 (Free) or at least ₦100 for Paystack checkout.',
      });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.updateMaterial(materialId, {
        title: editMatTitle.trim(),
        description: editMatDesc.trim(),
        category: editMatCategory,
        courseId: editMatCourseId || null,
        price: Number(parsedPrice.toFixed(2)),
      });
      setEditingMaterialId(null);
      setFeedback({ type: 'ok', text: res.message });
      await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update material.',
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
    badgeCount?: number;
  }> = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'registrations', label: 'Registrations', icon: ClipboardList },
    { id: 'gst111', label: 'Manual Activation', icon: KeyRound },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    {
      id: 'verifications',
      label: 'Verification Logs',
      icon: ShieldCheck,
      badgeCount: verificationSummary.counts.awaiting_admin_review || 0,
    },
    { id: 'questions', label: 'Questions', icon: FileText },
    { id: 'ai_generator', label: 'AI Question Generator', icon: Sparkles },
    { id: 'ai_settings', label: 'AI API Settings', icon: Sliders },
    { id: 'materials', label: 'Materials', icon: Upload },
    { id: 'announcements', label: 'Notices', icon: Megaphone },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'email', label: 'Email & Recovery', icon: Mail },
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
                {typeof t.badgeCount === 'number' && t.badgeCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-400 text-[#082252] text-[10px] font-extrabold leading-none tabular-nums">
                    {t.badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-3 sm:p-4 space-y-4">
        {feedback && (
          <div
            className={`rounded-xl px-4 py-3 text-sm font-medium border break-words [overflow-wrap:anywhere] ${
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
                {
                  label: 'CBT Questions (Active)',
                  val: overview?.totalActiveQuestions ?? overview?.totalQuestions ?? 0,
                  sub: `Easy ${overview?.totalEasyQuestions ?? 0} · Med ${overview?.totalMediumQuestions ?? 0} · Diff ${overview?.totalHardQuestions ?? 0}`,
                },
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
                  {'sub' in stat && stat.sub && (
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                      {stat.sub}
                    </div>
                  )}
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
                  Per-Course Configured Pricing · Paystack Fees Absorbed by Acadet CBT
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
              Set the student registration price (₦) for each course below (minimum ₦100). Net course value updates automatically after Paystack fee reserve, or you can fine-tune it manually.
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
                  placeholder="Course Code (e.g. MTH 101)"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <label className="space-y-1">
                  <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Academic Level
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Level (e.g. 100 Level)"
                    value={cLevel}
                    onChange={(e) => setCLevel(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                  />
                </label>

                <label className="space-y-1">
                  <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Registration Price (₦)
                  </span>
                  <input
                    type="number"
                    required
                    min={100}
                    max={1000000}
                    step="1"
                    placeholder="e.g. 2350"
                    value={cFee}
                    onChange={(e) => handleCourseFeeChange(e.target.value)}
                    className="w-full rounded-lg border border-[#0a58ed]/40 dark:border-blue-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-extrabold text-[#082252] dark:text-blue-300 tabular-nums"
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      Net Course Value (₦)
                    </span>
                    {cValueCustom && (
                      <button
                        type="button"
                        onClick={() => {
                          setCValueCustom(false);
                          const parsedFee = Number(cFee);
                          if (Number.isFinite(parsedFee) && parsedFee > 0) {
                            setCValue(String(derivePreviewCourseValue(parsedFee)));
                          }
                        }}
                        className="text-[10px] font-extrabold text-[#0a58ed] dark:text-blue-400 hover:underline"
                      >
                        Auto
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    step="0.01"
                    placeholder="Net value"
                    value={cValue}
                    onChange={(e) => {
                      setCValueCustom(true);
                      setCValue(e.target.value);
                    }}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums"
                  />
                </label>

                <label className="space-y-1">
                  <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Publication Status
                  </span>
                  <select
                    value={cPubStatus}
                    onChange={(e) => setCPubStatus(e.target.value as PublicationStatus)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-semibold"
                  >
                    <option value="published">Published (Visible)</option>
                    <option value="draft">Draft (Hidden)</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Duration (mins)
                  </span>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    placeholder="Duration (mins)"
                    value={cDuration}
                    onChange={(e) => setCDuration(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm tabular-nums"
                  />
                </label>
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

            {selectedCourseDetailId && (() => {
              const detailCourse = courses.find((item) => item.id === selectedCourseDetailId);
              if (!detailCourse) return null;
              const total = detailCourse.questionCount;
              const pctOf = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
              return (
                <div className="rounded-xl border border-[#0a58ed]/40 bg-[#f8fbff] dark:bg-slate-900 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                        <span className="text-[#0b337a] dark:text-blue-300 font-extrabold">
                          {detailCourse.code}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{detailCourse.level}</span>
                        <span aria-hidden="true">·</span>
                        <span>{detailCourse.cbtReady ? 'CBT Ready (20+)' : 'Low Bank (< 20)'}</span>
                      </div>
                      <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                        {detailCourse.title} — Question Statistics Breakdown
                      </h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSection('questions');
                          handleSelectStatsCourse(detailCourse.id);
                        }}
                        className="px-3 py-2 rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-bold flex items-center gap-1.5 min-h-[38px]"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Manage Questions</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCourseDetailId(null)}
                        className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-3">
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        Total Questions
                      </div>
                      <div className="text-xl font-extrabold text-[#082252] dark:text-white tabular-nums">
                        {detailCourse.questionCount}
                      </div>
                      {detailCourse.inactiveCount > 0 && (
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          +{detailCourse.inactiveCount} inactive
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-slate-800/60 p-3">
                      <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        Easy
                      </div>
                      <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {detailCourse.easyCount}
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {pctOf(detailCourse.easyCount)}% of bank
                      </div>
                    </div>
                    <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-slate-800/60 p-3">
                      <div className="text-xs font-bold text-amber-700 dark:text-amber-300">
                        Medium
                      </div>
                      <div className="text-xl font-extrabold text-amber-700 dark:text-amber-400 tabular-nums">
                        {detailCourse.mediumCount}
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {pctOf(detailCourse.mediumCount)}% of bank
                      </div>
                    </div>
                    <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-800/60 p-3">
                      <div className="text-xs font-bold text-rose-700 dark:text-rose-300">
                        Difficult
                      </div>
                      <div className="text-xl font-extrabold text-rose-700 dark:text-rose-400 tabular-nums">
                        {detailCourse.hardCount}
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {pctOf(detailCourse.hardCount)}% of bank
                      </div>
                    </div>
                  </div>

                  {detailCourse.uncategorizedCount > 0 && (
                    <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                      Note: {detailCourse.uncategorizedCount} active question(s) have no matching Easy/Medium/Difficult label.
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3">Value / Payable</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Group Invite</th>
                    <th className="px-4 py-3">Question Breakdown</th>
                    <th className="px-4 py-3">Registrations</th>
                    <th className="px-4 py-3">Revenue</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {courses.map((c) => {
                    const isDetailOpen = selectedCourseDetailId === c.id;
                    return (
                      <tr
                        key={c.id}
                        className={`transition-colors ${
                          isDetailOpen
                            ? 'bg-[#eff5ff]/80 dark:bg-blue-950/20'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedCourseDetailId(isDetailOpen ? null : c.id)
                            }
                            className="text-left group"
                            title="Click to view question difficulty distribution"
                          >
                            <div className="font-extrabold text-slate-900 dark:text-white group-hover:text-[#0a58ed] transition-colors">
                              {c.code} — {c.title}
                            </div>
                            {c.description && (
                              <div className="text-xs text-slate-500 line-clamp-1">
                                {c.description}
                              </div>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {c.level}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          <div className="font-extrabold text-[#082252] dark:text-blue-300">
                            {formatCurrency(c.registrationFee, c.currency)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Value: {formatCurrency(c.courseValue ?? c.registrationFee, c.currency)}
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
                        <td className="px-4 py-3 tabular-nums">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedCourseDetailId(isDetailOpen ? null : c.id)
                            }
                            className="text-left hover:opacity-90"
                            title="Inspect Easy, Medium & Difficult question counts"
                          >
                            <div className="flex items-center gap-1.5 font-extrabold text-[#082252] dark:text-white text-xs">
                              <span>Total: {c.questionCount}</span>
                              <span
                                className={
                                  c.cbtReady
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : c.questionCount > 0
                                      ? 'text-amber-700 dark:text-amber-400'
                                      : 'text-rose-700 dark:text-rose-400'
                                }
                              >
                                · {c.cbtReady ? 'CBT Ready' : c.questionCount > 0 ? 'Low Bank' : 'Empty'}
                              </span>
                            </div>
                            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-0.5 whitespace-nowrap">
                              <span className="text-emerald-700 dark:text-emerald-400">
                                Easy {c.easyCount ?? 0}
                              </span>
                              <span aria-hidden="true"> · </span>
                              <span className="text-amber-700 dark:text-amber-400">
                                Med {c.mediumCount ?? 0}
                              </span>
                              <span aria-hidden="true"> · </span>
                              <span className="text-rose-700 dark:text-rose-400">
                                Diff {c.hardCount ?? 0}
                              </span>
                              {(c.uncategorizedCount ?? 0) > 0 && (
                                <span className="text-slate-500"> · Uncat {c.uncategorizedCount}</span>
                              )}
                            </div>
                          </button>
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
                            onClick={() =>
                              setSelectedCourseDetailId(isDetailOpen ? null : c.id)
                            }
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg mr-1"
                            title="Question breakdown"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </button>
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
                                if (selectedCourseDetailId === c.id) {
                                  setSelectedCourseDetailId(null);
                                }
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
                    );
                  })}
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
                    placeholder="Search reg code, name, email, or WhatsApp..."
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
                          {r.activationSource === 'admin_manual' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-[#0b337a] dark:text-blue-300 text-xs font-extrabold">
                              Admin Activated
                            </span>
                          ) : (
                            formatCurrency(r.amount, r.currency)
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={r.paymentStatus} />
                            {r.activationSource === 'admin_manual' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 border border-[#c6daf7] dark:border-blue-800 text-[#0b337a] dark:text-blue-300 text-[10px] font-extrabold">
                                Admin Activated
                              </span>
                            )}
                          </div>
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

        {/* MANUAL SUBSCRIPTION ACTIVATION (GST 111 ONLY) */}
        {section === 'gst111' && (
          <Gst111ManualActivationPanel
            onCatalogUpdated={onCatalogUpdated}
            onOpenFullProfile={(studentId) => void openStudentProfile(studentId)}
          />
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
                          <div className="inline-flex items-center gap-1.5">
                            {p.paymentStatus === 'successful' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleOpenAdminReceipt(p.id)}
                                className="px-2.5 py-1 rounded-lg bg-[#eff5ff] dark:bg-blue-950/40 text-[#0b337a] dark:text-blue-300 border border-[#c6daf7] dark:border-blue-800 text-xs font-bold hover:bg-[#dcebff] inline-flex items-center gap-1"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Receipt</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedPayment(p)}
                              className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Inspect</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PAYMENT VERIFICATION LOGS */}
        {section === 'verifications' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/70 border border-[#d6e4fa] dark:border-slate-700 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#082252] dark:text-white tracking-tight">
                    PAYMENT VERIFICATION LOGS
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Audit Paystack callbacks, student manual reference verifications, unrecorded payments, and review escalations.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loadingVerifLogs}
                  onClick={() => void loadVerificationLogs()}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-[#c6daf7] dark:border-slate-700 text-xs font-extrabold text-[#0b337a] dark:text-blue-300 inline-flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingVerifLogs ? 'animate-spin' : ''}`} />
                  <span>Refresh Logs</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {(
                  [
                    { key: '', label: 'All Logs', count: verificationSummary.total },
                    {
                      key: 'successful',
                      label: 'Successful',
                      count: verificationSummary.counts.successful || 0,
                    },
                    {
                      key: 'already_registered',
                      label: 'Already Reg.',
                      count: verificationSummary.counts.already_registered || 0,
                    },
                    {
                      key: 'pending',
                      label: 'Pending',
                      count: verificationSummary.counts.pending || 0,
                    },
                    {
                      key: 'failed',
                      label: 'Failed',
                      count: verificationSummary.counts.failed || 0,
                    },
                    {
                      key: 'not_found',
                      label: 'Not Found',
                      count: verificationSummary.counts.not_found || 0,
                    },
                    {
                      key: 'awaiting_admin_review',
                      label: 'Admin Review',
                      count: verificationSummary.counts.awaiting_admin_review || 0,
                    },
                    {
                      key: 'unauthorized_or_mismatch',
                      label: 'Blocked',
                      count: verificationSummary.counts.unauthorized_or_mismatch || 0,
                    },
                  ] as Array<{
                    key: PaymentVerificationResult | '';
                    label: string;
                    count: number;
                  }>
                ).map((item) => {
                  const active = verifResultFilter === item.key;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setVerifResultFilter(item.key);
                        void loadVerificationLogs(item.key, verifCourseId, verifSearch);
                      }}
                      className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                        active
                          ? 'bg-[#0b337a] border-[#0b337a] text-white'
                          : 'bg-white dark:bg-slate-900 border-[#d6e4fa] dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-base font-extrabold tabular-nums leading-tight">
                        {item.count}
                      </div>
                      <div
                        className={`text-[11px] font-bold truncate ${
                          active ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {item.label}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="relative lg:col-span-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={verifSearch}
                    onChange={(e) => setVerifSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void loadVerificationLogs();
                      }
                    }}
                    placeholder="Search reference, student name, email, or course..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                  />
                </div>
                <select
                  value={verifResultFilter}
                  onChange={(e) => {
                    const nextVal = e.target.value as PaymentVerificationResult | '';
                    setVerifResultFilter(nextVal);
                    void loadVerificationLogs(nextVal, verifCourseId, verifSearch);
                  }}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold"
                >
                  <option value="">All Verification Results</option>
                  <option value="successful">Successful</option>
                  <option value="already_registered">Already Registered</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="not_found">Not Found</option>
                  <option value="awaiting_admin_review">Awaiting Admin Review</option>
                  <option value="unauthorized_or_mismatch">Unauthorized / Mismatch</option>
                </select>
                <div className="flex gap-2">
                  <select
                    value={verifCourseId}
                    onChange={(e) => {
                      const nextCourse = e.target.value;
                      setVerifCourseId(nextCourse);
                      void loadVerificationLogs(verifResultFilter, nextCourse, verifSearch);
                    }}
                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold"
                  >
                    <option value="">All Courses</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void loadVerificationLogs()}
                    className="px-3 py-2 rounded-lg bg-[#0a58ed] text-white text-xs font-bold shrink-0"
                  >
                    Filter
                  </button>
                </div>
              </div>
            </div>

            {verificationLogs.length === 0 ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-10 text-center text-sm text-slate-500">
                No payment verification attempts match the selected filters.
              </div>
            ) : (
              <>
                {/* Mobile Verification Cards */}
                <div className="md:hidden space-y-2.5">
                  {verificationLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2 bg-white dark:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                            {log.studentName || log.paystackCustomerEmail || 'Unmatched Payer'}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {log.studentEmail || log.paystackCustomerEmail || 'No email recorded'}
                          </div>
                        </div>
                        <VerificationResultBadge result={log.verificationResult} />
                      </div>

                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Course:{' '}
                        {log.courseCode
                          ? `${log.courseCode} — ${log.courseTitle}`
                          : 'Pending Course Assignment'}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg px-2.5 py-2">
                        <span className="font-mono text-xs font-bold break-all">
                          {log.paymentReference}
                        </span>
                        <CopyReferenceButton
                          reference={log.paymentReference}
                          compact
                          label="COPY"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                        <div>
                          Payment Status:{' '}
                          <strong className="uppercase text-slate-800 dark:text-slate-200">
                            {log.paymentStatus || log.paystackStatus || '—'}
                          </strong>
                        </div>
                        <div>
                          Registration:{' '}
                          <strong className="uppercase text-slate-800 dark:text-slate-200">
                            {log.registrationStatus || 'not_active'}
                          </strong>
                        </div>
                        <div className="col-span-2 tabular-nums">
                          {new Date(log.createdAt).toLocaleString()} · Source:{' '}
                          {log.verificationSource.replace('_', ' ')}
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => openInspectLog(log)}
                          className="px-3 py-1.5 rounded-lg bg-[#0b337a] text-white text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect &amp; Review</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/70 text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-3.5 py-2.5">Student Name</th>
                        <th className="px-3.5 py-2.5">Payment Reference</th>
                        <th className="px-3.5 py-2.5">Course</th>
                        <th className="px-3.5 py-2.5">Verification Date</th>
                        <th className="px-3.5 py-2.5">Verification Result</th>
                        <th className="px-3.5 py-2.5">Payment Status</th>
                        <th className="px-3.5 py-2.5">Registration Status</th>
                        <th className="px-3.5 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {verificationLogs.map((log) => (
                        <tr
                          key={log.id}
                          className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 ${
                            log.verificationResult === 'awaiting_admin_review' && !log.resolvedAt
                              ? 'bg-orange-50/40 dark:bg-orange-950/10'
                              : ''
                          }`}
                        >
                          <td className="px-3.5 py-2.5">
                            <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                              {log.studentName || log.paystackCustomerEmail || 'Unmatched Payer'}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {log.studentEmail || log.paystackCustomerEmail || '—'}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                              {log.paymentReference}
                            </div>
                            <div className="text-[11px] text-slate-500 capitalize">
                              {log.verificationSource.replace('_', ' ')}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 text-xs font-semibold">
                            {log.courseCode ? (
                              <span>
                                {log.courseCode} — {log.courseTitle}
                              </span>
                            ) : (
                              <span className="text-slate-400">Pending Match</span>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <VerificationResultBadge result={log.verificationResult} />
                          </td>
                          <td className="px-3.5 py-2.5 text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300">
                            {log.paymentStatus || log.paystackStatus || '—'}
                          </td>
                          <td className="px-3.5 py-2.5 text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300">
                            {log.registrationStatus || 'inactive'}
                          </td>
                          <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openInspectLog(log)}
                              className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* QUESTIONS & QUESTION STATISTICS DASHBOARD */}
        {section === 'questions' && (
          <div className="space-y-5">
            {courses.length === 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-200">
                No courses found yet. Create a course in the Courses tab before adding questions.
              </div>
            )}

            <QuestionStatsDashboard
              summary={questionStatsSummary}
              courseStats={courseQuestionStats}
              selectedCourseId={selectedStatsCourseId}
              onSelectCourse={handleSelectStatsCourse}
              onQuickAddForCourse={handleQuickAddForCourse}
              onRefresh={async () => {
                await Promise.all([loadQuestionStats(), loadFilteredQuestions()]);
              }}
              refreshing={statsRefreshing}
            />

            <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/70 border border-[#d6e4fa] dark:border-slate-700 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Bot className="w-5 h-5 text-[#0a58ed] shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-extrabold text-[#082252] dark:text-white">
                    AI Question Generator &amp; Draft Review Workspace
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Upload PDFs, Word documents (.docx), diagram/OCR images, or paste lecture notes to generate reviewable CBT drafts before publishing.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSection('ai_settings')}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>AI API Settings</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSection('ai_generator')}
                  className="px-3.5 py-2 rounded-lg bg-[#0b337a] hover:bg-[#072459] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Open AI Generator</span>
                </button>
              </div>
            </div>

            <form
              ref={questionFormRef}
              onSubmit={handleSaveQuestion}
              className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-[#082252] dark:text-white">
                  {editingQuestionId ? 'Edit CBT Question' : 'Manual CBT Question Upload'}
                </h3>
                {editingQuestionId && (
                  <button
                    type="button"
                    onClick={() => resetQuestionForm(true)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel Edit</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <select
                  value={qCourseId}
                  onChange={(e) => setQCourseId(e.target.value)}
                  className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm min-h-[40px]"
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
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-semibold min-h-[40px]"
                >
                  <option value="Easy">Difficulty: Easy</option>
                  <option value="Medium">Difficulty: Medium</option>
                  <option value="Hard">Difficulty: Difficult</option>
                </select>
                <input
                  type="text"
                  placeholder="Topic"
                  value={qTopic}
                  onChange={(e) => setQTopic(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm min-h-[40px]"
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

              {/* Optional Question Image Attachments */}
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <ImageIcon className="w-4 h-4 text-[#0a58ed]" />
                    <span>Optional Diagram / Specimen / Graph Attachment (JPG, PNG, WEBP · Max 5 MB)</span>
                  </div>
                  <label className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingManualImage ? 'Uploading...' : 'Attach Image(s)'}</span>
                    <input
                      ref={manualImageInputRef}
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      disabled={uploadingManualImage}
                      onChange={(e) => void handleManualImageSelection(e.target.files)}
                      className="hidden"
                    />
                  </label>
                </div>

                {editingQuestionId && qExistingImages.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {qExistingImages.map((img, idx) => (
                      <div
                        key={img.id}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 space-y-2"
                      >
                        <img
                          src={img.url}
                          alt={img.caption || `Attachment ${idx + 1}`}
                          className="w-full h-28 object-contain rounded bg-slate-50 dark:bg-slate-800"
                        />
                        <div className="flex items-center justify-between gap-1 text-[11px]">
                          <span className="truncate font-semibold text-slate-600 dark:text-slate-300">
                            {img.fileName}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <label className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                              {replacingManualImageId === img.id ? '...' : 'Replace'}
                              <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) void handleReplaceExistingQuestionImage(img.id, f);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              disabled={replacingManualImageId === img.id}
                              onClick={() => void handleDeleteExistingQuestionImage(img.id)}
                              className="px-2 py-1 rounded border border-red-200 dark:border-red-900 text-red-600 font-bold hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!editingQuestionId && qNewImageFiles.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {qNewImageFiles.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 space-y-1.5"
                      >
                        {qNewImagePreviews[idx] && (
                          <img
                            src={qNewImagePreviews[idx]}
                            alt={file.name}
                            className="w-full h-24 object-contain rounded bg-slate-50 dark:bg-slate-800"
                          />
                        )}
                        <div className="flex items-center justify-between gap-1 text-[11px]">
                          <span className="truncate font-medium text-slate-600 dark:text-slate-300">
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveQueuedManualImage(idx)}
                            className="text-red-600 hover:underline font-bold shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  required
                  placeholder="Option A"
                  value={qOptA}
                  onChange={(e) => setQOptA(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm min-h-[40px]"
                />
                <input
                  required
                  placeholder="Option B"
                  value={qOptB}
                  onChange={(e) => setQOptB(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm min-h-[40px]"
                />
                <input
                  required
                  placeholder="Option C"
                  value={qOptC}
                  onChange={(e) => setQOptC(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm min-h-[40px]"
                />
                <input
                  required
                  placeholder="Option D"
                  value={qOptD}
                  onChange={(e) => setQOptD(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm min-h-[40px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                <select
                  value={qCorrect}
                  onChange={(e) => setQCorrect(e.target.value as OptionLetter)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-bold min-h-[40px]"
                >
                  {(['A', 'B', 'C', 'D'] as const).map((letter) => (
                    <option key={letter} value={letter}>
                      Correct Answer: {letter}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Question publication status"
                  value={qPublicationStatus}
                  onChange={(e) =>
                    setQPublicationStatus(e.target.value as QuestionPublicationStatus)
                  }
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-bold min-h-[40px]"
                >
                  <option value="published">Publish Immediately</option>
                  <option value="draft">Save as Draft</option>
                </select>
                <input
                  placeholder="Explanation (shown only after submission)"
                  value={qExplanation}
                  onChange={(e) => setQExplanation(e.target.value)}
                  className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm min-h-[40px]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                {editingQuestionId ? (
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={qIsActive && qPublicationStatus === 'published'}
                      disabled={qPublicationStatus === 'draft'}
                      onChange={(e) => setQIsActive(e.target.checked)}
                      className="rounded border-slate-300 text-[#0a58ed] focus:ring-[#0a58ed]"
                    />
                    <span>Active in live CBT examination bank</span>
                  </label>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Questions are saved under the selected course, difficulty category, and optional diagram attachments.
                  </span>
                )}

                <button
                  type="submit"
                  disabled={busy || !qCourseId}
                  className="px-4 py-2 rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white text-sm font-bold flex items-center gap-1.5 min-h-[40px]"
                >
                  {editingQuestionId ? (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Update Question</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>{qPublicationStatus === 'draft' ? 'Save Draft' : 'Save Question'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Question Bank Explorer & Filters */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-800/70 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold text-[#082252] dark:text-white">
                    Question Bank
                  </h4>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                    ({questions.length} shown)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2">
                  <select
                    aria-label="Filter questions by course"
                    value={selectedStatsCourseId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedStatsCourseId(val);
                      if (val) setQCourseId(val);
                      void loadFilteredQuestions(val, qFilterDifficulty, qFilterStatus, qFilterSearch, qFilterPubStatus);
                    }}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold min-h-[38px]"
                  >
                    <option value="">All Courses</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} ({c.questionCount})
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter questions by difficulty"
                    value={qFilterDifficulty}
                    onChange={(e) => {
                      const val = e.target.value as QuestionDifficulty | '';
                      setQFilterDifficulty(val);
                      void loadFilteredQuestions(selectedStatsCourseId, val, qFilterStatus, qFilterSearch, qFilterPubStatus);
                    }}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold min-h-[38px]"
                  >
                    <option value="">All Difficulties</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Difficult</option>
                  </select>

                  <select
                    aria-label="Filter questions by publication state"
                    value={qFilterPubStatus}
                    onChange={(e) => {
                      const val = e.target.value as 'all' | 'published' | 'draft';
                      setQFilterPubStatus(val);
                      void loadFilteredQuestions(selectedStatsCourseId, qFilterDifficulty, qFilterStatus, qFilterSearch, val);
                    }}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold min-h-[38px]"
                  >
                    <option value="all">Published &amp; Drafts</option>
                    <option value="published">Published Only</option>
                    <option value="draft">Drafts Only</option>
                  </select>

                  <select
                    aria-label="Filter questions by status"
                    value={qFilterStatus}
                    onChange={(e) => {
                      const val = e.target.value as 'all' | 'active' | 'inactive';
                      setQFilterStatus(val);
                      void loadFilteredQuestions(selectedStatsCourseId, qFilterDifficulty, val, qFilterSearch, qFilterPubStatus);
                    }}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold min-h-[38px]"
                  >
                    <option value="all">Active &amp; Inactive</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                  </select>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={qFilterSearch}
                      onChange={(e) => setQFilterSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void loadFilteredQuestions(
                            selectedStatsCourseId,
                            qFilterDifficulty,
                            qFilterStatus,
                            qFilterSearch,
                            qFilterPubStatus
                          );
                        }
                      }}
                      placeholder="Search question or topic..."
                      className="flex-1 sm:w-44 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs min-h-[38px]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void loadFilteredQuestions(
                          selectedStatsCourseId,
                          qFilterDifficulty,
                          qFilterStatus,
                          qFilterSearch,
                          qFilterPubStatus
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-[#0b337a] hover:bg-[#072459] text-white text-xs font-bold min-h-[38px]"
                    >
                      Filter
                    </button>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[28rem] overflow-y-auto">
                {questions.length === 0 ? (
                  <div className="py-8 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                    No questions found matching your filters.
                  </div>
                ) : (
                  questions.map((q) => {
                    const diffLabel = q.difficulty === 'Hard' ? 'Difficult' : q.difficulty;
                    const diffTextCls =
                      q.difficulty === 'Easy'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : q.difficulty === 'Medium'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-rose-700 dark:text-rose-400';
                    const isDraft = q.publicationStatus === 'draft';
                    const imgCount = q.images?.length ?? 0;
                    return (
                      <div
                        key={q.id}
                        className={`px-4 py-3 flex items-start justify-between gap-3 text-sm ${
                          editingQuestionId === q.id ? 'bg-[#eff5ff]/70 dark:bg-blue-950/30' : ''
                        }`}
                      >
                        <div className="min-w-0 space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                            <span className="text-[#0b337a] dark:text-blue-300">{q.courseCode}</span>
                            <span aria-hidden="true">·</span>
                            <span className={diffTextCls}>{diffLabel}</span>
                            <span aria-hidden="true">·</span>
                            <span className="text-slate-500 dark:text-slate-400">{q.topic}</span>
                            {isDraft && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold uppercase">
                                Draft
                              </span>
                            )}
                            {q.aiGenerated && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-[#0b337a] dark:text-blue-300 text-[10px] font-extrabold uppercase">
                                AI
                              </span>
                            )}
                            {imgCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-extrabold">
                                <ImageIcon className="w-3 h-3" />
                                {imgCount} {imgCount === 1 ? 'Image' : 'Images'}
                              </span>
                            )}
                            {!isDraft && !q.isActive && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-slate-500">Inactive</span>
                              </>
                            )}
                          </div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {q.questionText}
                          </div>
                          {imgCount > 0 && q.images && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {q.images.slice(0, 3).map((img) => (
                                <img
                                  key={img.id}
                                  src={img.url}
                                  alt={img.fileName}
                                  className="h-12 w-16 object-contain rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                />
                              ))}
                            </div>
                          )}
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {q.courseTitle} · Correct: {q.correctOption}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isDraft && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={async () => {
                                setBusy(true);
                                setFeedback(null);
                                try {
                                  await api.admin.publishQuestion(q.id);
                                  setFeedback({
                                    type: 'ok',
                                    text: 'Draft question published to live CBT exam bank.',
                                  });
                                  await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
                                } catch (err) {
                                  setFeedback({
                                    type: 'err',
                                    text:
                                      err instanceof Error
                                        ? err.message
                                        : 'Failed to publish draft.',
                                  });
                                } finally {
                                  setBusy(false);
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold disabled:opacity-50"
                            >
                              Publish
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => startEditQuestion(q)}
                            className="p-2 text-[#0a58ed] hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50"
                            title="Edit question"
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
                                await api.admin.deleteQuestion(q.id);
                                if (editingQuestionId === q.id) {
                                  resetQuestionForm(true);
                                }
                                setFeedback({
                                  type: 'ok',
                                  text: 'Question deleted and course statistics updated.',
                                });
                                await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
                              } catch (err) {
                                setFeedback({
                                  type: 'err',
                                  text:
                                    err instanceof Error
                                      ? err.message
                                      : 'Failed to delete question.',
                                });
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg disabled:opacity-50"
                            title="Delete question"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* AI QUESTION GENERATOR & DRAFT APPROVAL WORKSPACE */}
        {section === 'ai_generator' && (
          <AiQuestionGeneratorPanel
            courses={courses}
            onPublishedOrChanged={async () => {
              await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
            }}
            onOpenAiSettings={() => setSection('ai_settings')}
          />
        )}

        {/* AI API SETTINGS */}
        {section === 'ai_settings' && <AiSettingsPanel />}

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
              <div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-500">
                    ₦
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={500000}
                    step="50"
                    placeholder="Price (0 = Free, or >= 100)"
                    value={matPrice}
                    onChange={(e) => setMatPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-7 pr-3 py-2 text-sm font-bold tabular-nums"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Enter <strong>0</strong> for Free PDF, or <strong>₦100+</strong> for Paystack paid PDF.
                </p>
              </div>
              <input
                placeholder="Short description"
                value={matDesc}
                onChange={(e) => setMatDesc(e.target.value)}
                className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <input
                ref={matFileInputRef}
                type="file"
                required
                accept=".pdf,.doc,.docx,image/*"
                onChange={(e) => setMatFile(e.target.files?.[0] || null)}
                className="sm:col-span-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="sm:col-span-2 px-4 py-2.5 rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white font-bold text-sm disabled:opacity-50"
              >
                Upload Study Material
              </button>
            </form>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {materials.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No study materials uploaded yet.
                </div>
              ) : (
                materials.map((m) => {
                  const isEditing = editingMaterialId === m.id;
                  const priceNum = Number(m.price ?? 0);
                  return (
                    <div key={m.id} className="px-4 py-3 space-y-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white break-words">
                              {m.title}
                            </span>
                            {priceNum <= 0 ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold">
                                Free
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-[#0b337a] dark:text-blue-300 text-xs font-extrabold tabular-nums">
                                {formatCurrency(priceNum, m.currency)}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {m.courseCode ? `${m.courseCode} — ${m.courseTitle}` : 'General (All Courses)'} ·{' '}
                            {m.category} · {m.fileType} · {m.downloadCount} downloads
                            {priceNum > 0 && (
                              <>
                                {' '}
                                · {m.purchaseCount ?? 0} purchases (
                                {formatCurrency(m.totalRevenue ?? 0, m.currency)})
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              isEditing ? setEditingMaterialId(null) : startEditMaterial(m)
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 disabled:opacity-50"
                            title="Adjust price or details"
                          >
                            {isEditing ? (
                              <>
                                <X className="w-3.5 h-3.5" />
                                <span>Cancel</span>
                              </>
                            ) : (
                              <>
                                <Edit3 className="w-3.5 h-3.5 text-[#0a58ed]" />
                                <span>Adjust Price</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              setFeedback(null);
                              try {
                                await api.admin.deleteMaterial(m.id);
                                setFeedback({ type: 'ok', text: 'Study material deleted.' });
                                await Promise.all([loadAllAdminData(), onCatalogUpdated()]);
                              } catch (err) {
                                setFeedback({
                                  type: 'err',
                                  text:
                                    err instanceof Error
                                      ? err.message
                                      : 'Failed to delete material.',
                                });
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg disabled:opacity-50"
                            title="Delete material"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {isEditing && (
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                              Price (₦ NGN, 0 = Free)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={500000}
                              step="50"
                              value={editMatPrice}
                              onChange={(e) => setEditMatPrice(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-bold tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                              Course
                            </label>
                            <select
                              value={editMatCourseId}
                              onChange={(e) => setEditMatCourseId(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold"
                            >
                              <option value="">General (All Courses)</option>
                              {courses.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.code} — {c.title}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                              Category
                            </label>
                            <select
                              value={editMatCategory}
                              onChange={(e) =>
                                setEditMatCategory(e.target.value as MaterialCategory)
                              }
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold"
                            >
                              {(['Tutorials', 'Notes', 'Past Questions', 'Guides'] as const).map(
                                (c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                              Title
                            </label>
                            <input
                              value={editMatTitle}
                              onChange={(e) => setEditMatTitle(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold"
                            />
                          </div>
                          <div className="sm:col-span-2 lg:col-span-3">
                            <input
                              placeholder="Short description"
                              value={editMatDesc}
                              onChange={(e) => setEditMatDesc(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                            />
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleSaveMaterialEdit(m.id)}
                              className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Save Changes</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
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
                  placeholder="Search by registration code, full name, email, username, or WhatsApp..."
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
                          {u.registrationCode && (
                            <span className="px-2 py-0.5 rounded bg-[#eff5ff] dark:bg-slate-800 border border-[#c6daf7] dark:border-slate-700 font-mono text-[11px] font-extrabold text-[#0b337a] dark:text-blue-300">
                              {u.registrationCode}
                            </span>
                          )}
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

        {/* SMTP EMAIL, VERIFICATION & PASSWORD RECOVERY MONITORING */}
        {section === 'email' && (
          <AdminEmailStatusPanel
            status={emailStatusOverview}
            adminEmail={userEmail}
            onUpdated={setEmailStatusOverview}
          />
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
              {selectedReg.studentRegistrationCode && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Registration Code</span>
                  <span className="font-mono text-xs font-extrabold text-[#0b337a] dark:text-blue-300">
                    {selectedReg.studentRegistrationCode}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Course</span>
                <span className="font-bold text-right">
                  {selectedReg.courseCode} — {selectedReg.courseTitle}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Amount / Authorization</span>
                <span className="font-extrabold tabular-nums">
                  {selectedReg.activationSource === 'admin_manual'
                    ? 'Admin Activated (No Paystack charge)'
                    : formatCurrency(selectedReg.amount, selectedReg.currency)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Reference</span>
                <span className="font-mono text-xs">{selectedReg.paymentReference}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Payment Status</span>
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={selectedReg.paymentStatus} />
                  {selectedReg.activationSource === 'admin_manual' && (
                    <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 border border-[#c6daf7] dark:border-blue-800 text-[#0b337a] dark:text-blue-300 text-[11px] font-extrabold">
                      Admin Activated
                    </span>
                  )}
                </div>
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

              <div className="flex flex-wrap justify-end gap-2.5 pt-1">
                {selectedPayment.paymentStatus === 'successful' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleOpenAdminReceipt(selectedPayment.id)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Official Receipt</span>
                  </button>
                )}
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

      {/* Payment Verification Log Inspector & Controlled Review Modal */}
      {inspectingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/65 backdrop-blur-[1px]">
          <div className="w-full max-w-2xl max-h-[92dvh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-[#0b337a] text-white px-4 py-3 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-extrabold truncate">
                    Verification Log Inspector &amp; Paystack Review
                  </h3>
                  <p className="text-[11px] text-blue-100 font-mono truncate">
                    {inspectingLog.paymentReference}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setInspectingLog(null)}
                className="p-1.5 rounded-lg hover:bg-white/15 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs sm:text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[11px] font-bold uppercase text-slate-500">
                    Payment Reference
                  </div>
                  <div className="font-mono font-extrabold text-slate-900 dark:text-white break-all">
                    {inspectingLog.paymentReference}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CopyReferenceButton reference={inspectingLog.paymentReference} compact />
                  <VerificationResultBadge result={inspectingLog.verificationResult} />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-[#eff5ff]/70 dark:bg-slate-800/60 border border-[#d6e4fa] dark:border-slate-700 rounded-xl p-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Paystack Status</span>
                  <span className="font-extrabold uppercase text-slate-900 dark:text-white">
                    {inspectingLog.paystackStatus || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Paystack Amount</span>
                  <span className="font-extrabold tabular-nums text-slate-900 dark:text-white">
                    {inspectingLog.paystackAmountKobo !== null
                      ? formatCurrency(
                          inspectingLog.paystackAmountKobo / 100,
                          inspectingLog.paystackCurrency || 'NGN'
                        )
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Paystack Currency</span>
                  <span className="font-extrabold">{inspectingLog.paystackCurrency || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Paystack Customer Email</span>
                  <span className="font-semibold break-all">
                    {inspectingLog.paystackCustomerEmail || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Gateway Tx ID</span>
                  <span className="font-mono font-semibold">
                    {inspectingLog.paystackTransactionId || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Verification Source</span>
                  <span className="font-semibold capitalize">
                    {inspectingLog.verificationSource.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-1">
                <div className="font-extrabold text-slate-700 dark:text-slate-200">
                  Verification Outcome Message
                </div>
                <p className="text-slate-600 dark:text-slate-300">{inspectingLog.reason}</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Raw Paystack Payload Snapshot
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRequeryLogLive(inspectingLog.id)}
                  className="px-3 py-1.5 rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
                  <span>Re-Query Paystack Live</span>
                </button>
              </div>
              <pre className="rounded-xl bg-slate-900 text-slate-100 p-3 text-[11px] overflow-x-auto max-h-36">
                {JSON.stringify(inspectingLog.paystackPayload || {}, null, 2)}
              </pre>

              {inspectingLog.resolvedAt && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 text-xs space-y-1">
                  <div className="font-extrabold text-emerald-800 dark:text-emerald-300">
                    Resolved by {inspectingLog.resolvedByName || 'Administrator'} on{' '}
                    {new Date(inspectingLog.resolvedAt).toLocaleString()}
                  </div>
                  {inspectingLog.resolutionNote && (
                    <div className="text-emerald-900 dark:text-emerald-200">
                      Note: {inspectingLog.resolutionNote}
                    </div>
                  )}
                </div>
              )}

              {(!inspectingLog.resolvedAt ||
                inspectingLog.verificationResult === 'awaiting_admin_review') && (
                <div className="rounded-xl border border-[#c6daf7] dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3.5 space-y-3">
                  <div className="text-xs font-extrabold text-[#082252] dark:text-white">
                    Administrator Controlled Review &amp; Course Activation
                  </div>
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                    Strict Rule: Course activation requires Paystack live status = SUCCESS, valid NGN amount, non-reused Gateway Transaction ID, and both matched Student &amp; Course. Unverified payments cannot be activated.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Student Account
                      </label>
                      <select
                        value={resolveStudentId}
                        onChange={(e) => setResolveStudentId(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-semibold"
                      >
                        <option value="">Select Student...</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.fullName} ({u.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Course to Activate
                      </label>
                      <select
                        value={resolveCourseId}
                        onChange={(e) => setResolveCourseId(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-semibold"
                      >
                        <option value="">Select Course...</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} — {c.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Resolution Note <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={resolveNote}
                      onChange={(e) => setResolveNote(e.target.value)}
                      placeholder="Explain audit verification finding (min 3 characters)..."
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={busy || resolveNote.trim().length < 3}
                      onClick={() => void handleResolveVerificationLog('reject')}
                      className="px-3.5 py-2 rounded-xl border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-extrabold disabled:opacity-50"
                    >
                      Mark Rejected
                    </button>
                    <button
                      type="button"
                      disabled={
                        busy ||
                        inspectingLog.paystackStatus?.toLowerCase() !== 'success' ||
                        !resolveStudentId ||
                        !resolveCourseId ||
                        resolveNote.trim().length < 3
                      }
                      onClick={() => void handleResolveVerificationLog('approve_activate')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold"
                    >
                      Confirm Verified Payment &amp; Activate Course
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold"
              >
                Close
              </button>
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
              <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/80 border border-[#d6e4fa] dark:border-slate-700 p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                <div>
                  <span className="text-slate-500 block">Full Name</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {studentProfile.student.fullName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Registration Code</span>
                  <span className="font-mono font-extrabold text-[#0b337a] dark:text-blue-300">
                    {studentProfile.student.registrationCode || '—'}
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
                          {cs.activationSource === 'admin_manual'
                            ? '(Admin Activated)'
                            : `(${formatCurrency(cs.amountPaid ?? cs.registrationFee, cs.currency)})`}
                        </span>
                      </div>
                      {cs.isRegistered ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {cs.activationSource === 'admin_manual' && (
                            <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 border border-[#c6daf7] dark:border-blue-800 text-[#0b337a] dark:text-blue-300 text-[11px] font-extrabold">
                              Admin Activated
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Registered ✓
                          </span>
                        </div>
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

      <PaymentReceiptModal
        receipt={adminReceipt}
        onClose={() => setAdminReceipt(null)}
      />
    </div>
  );
};
