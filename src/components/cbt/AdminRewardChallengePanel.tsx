import {
  AlertTriangle,
  Award,
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit3,
  Eye,
  FileText,
  Plus,
  Power,
  RefreshCw,
  Save,
  Settings,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type {
  OptionLetter,
  QuestionPublicationStatus,
  RewardChallengeAdminOverview,
  RewardChallengeAdminParticipantItem,
  RewardChallengeAdminQuestion,
  RewardChallengeAdminWinnerPayment,
  RewardChallengeAiDraftQuestion,
  RewardChallengeLeaderboardResponse,
  RewardChallengePaymentData,
  RewardChallengeSelectionMode,
  RewardChallengeSummary,
} from '../../types/cbt';
import {
  formatWatDateTimeDisplay,
  getStatusStyles,
} from './RewardChallengeDashboardCard';

type AdminSubSection =
  | 'overview'
  | 'settings'
  | 'questions'
  | 'schedule'
  | 'participants'
  | 'leaderboard'
  | 'winner'
  | 'payments';

function formatIsoToWatInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map = new Map(parts.map((p) => [p.type, p.value]));
  const yr = map.get('year') || '2026';
  const mo = map.get('month') || '01';
  const dy = map.get('day') || '01';
  const hrRaw = map.get('hour') || '00';
  const hr = hrRaw === '24' ? '00' : hrRaw;
  const mi = map.get('minute') || '00';
  return `${yr}-${mo}-${dy}T${hr}:${mi}`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m === 0 ? `${s}s` : `${m}m ${String(s).padStart(2, '0')}s`;
}

interface AdminRewardChallengePanelProps {
  onUpdated?: () => Promise<void> | void;
}

export const AdminRewardChallengePanel: React.FC<AdminRewardChallengePanelProps> = ({
  onUpdated,
}) => {
  const [challenges, setChallenges] = useState<RewardChallengeSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [overview, setOverview] = useState<RewardChallengeAdminOverview | null>(null);
  const [activeChallenge, setActiveChallenge] = useState<RewardChallengeSummary | null>(null);

  const [subSection, setSubSection] = useState<AdminSubSection>('overview');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Create new competition modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createReward, setCreateReward] = useState('10000');
  const [createDuration, setCreateDuration] = useState('20');
  const [createQCount, setCreateQCount] = useState('20');

  // Settings & Schedule edit state
  const [setTitle, setSetTitle] = useState('');
  const [setDescription, setSetDescription] = useState('');
  const [setRewardAmount, setSetRewardAmount] = useState('10000');
  const [setIsFeatured, setSetIsFeatured] = useState(true);
  const [schOpenAt, setSchOpenAt] = useState('');
  const [schExamStartAt, setSchExamStartAt] = useState('');
  const [schExamEndAt, setSchExamEndAt] = useState('');
  const [schDurationMins, setSchDurationMins] = useState('20');
  const [schQuestionCount, setSchQuestionCount] = useState('20');
  const [schSelectionMode, setSchSelectionMode] =
    useState<RewardChallengeSelectionMode>('random');
  const [schWinnerAnnounceAt, setSchWinnerAnnounceAt] = useState('');
  const [schCloseAt, setSchCloseAt] = useState('');

  // Question Bank state
  const [questions, setQuestions] = useState<RewardChallengeAdminQuestion[]>([]);
  const [previewQuestion, setPreviewQuestion] = useState<RewardChallengeAdminQuestion | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<RewardChallengeAdminQuestion | null>(null);
  const [qText, setQText] = useState('');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qOptD, setQOptD] = useState('');
  const [qCorrect, setQCorrect] = useState<OptionLetter>('A');
  const [qExpl, setQExpl] = useState('');
  const [qCategory, setQCategory] = useState('General');
  const [qStatus, setQStatus] = useState<QuestionPublicationStatus>('published');

  // Bulk Upload & AI Question Generation state
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkStatus, setBulkStatus] = useState<QuestionPublicationStatus>('published');
  const [aiCount, setAiCount] = useState('10');
  const [aiCategory, setAiCategory] = useState('General');
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiDocFile, setAiDocFile] = useState<File | null>(null);
  const [aiDrafts, setAiDrafts] = useState<RewardChallengeAiDraftQuestion[]>([]);

  // Participants, Leaderboard, Winner & Payment state
  const [participants, setParticipants] = useState<RewardChallengeAdminParticipantItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<RewardChallengeLeaderboardResponse | null>(null);
  const [winnerPayment, setWinnerPayment] = useState<RewardChallengeAdminWinnerPayment | null>(null);
  const [allPayments, setAllPayments] = useState<RewardChallengePaymentData[]>([]);
  const [payReference, setPayReference] = useState('');
  const [payAdminNote, setPayAdminNote] = useState('');
  const [confirmPaidOpen, setConfirmPaidOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const populateFormsFromChallenge = (ch: RewardChallengeSummary) => {
    setSetTitle(ch.title);
    setSetDescription(ch.description);
    setSetRewardAmount(String(ch.rewardAmount));
    setSetIsFeatured(ch.isFeatured);
    setSchOpenAt(formatIsoToWatInput(ch.settings.challengeOpenAt));
    setSchExamStartAt(formatIsoToWatInput(ch.settings.examStartAt));
    setSchExamEndAt(formatIsoToWatInput(ch.settings.examEndAt));
    setSchDurationMins(String(ch.settings.durationMinutes));
    setSchQuestionCount(String(ch.settings.questionCount));
    setSchSelectionMode(ch.settings.selectionMode);
    setSchWinnerAnnounceAt(formatIsoToWatInput(ch.settings.winnerAnnouncementAt));
    setSchCloseAt(formatIsoToWatInput(ch.settings.challengeCloseAt));
  };

  const loadChallenges = useCallback(
    async (preferredId?: string) => {
      setLoading(true);
      try {
        const [listRes, allPayRes] = await Promise.all([
          api.admin.rewardChallenges.list(),
          api.admin.rewardChallenges.listAllPayments(),
        ]);
        setChallenges(listRes.challenges);
        setAllPayments(allPayRes.payments);

        const pickId = preferredId || selectedId || listRes.challenges[0]?.id || '';
        if (pickId) {
          setSelectedId(pickId);
          const [ovRes, qRes, partRes, lbRes, wpRes] = await Promise.all([
            api.admin.rewardChallenges.getOverview(pickId),
            api.admin.rewardChallenges.listQuestions(pickId),
            api.admin.rewardChallenges.listParticipants(pickId),
            api.admin.rewardChallenges.getLeaderboard(pickId),
            api.admin.rewardChallenges.getWinnerPayment(pickId),
          ]);
          setActiveChallenge(ovRes.challenge);
          setOverview(ovRes.overview);
          populateFormsFromChallenge(ovRes.challenge);
          setQuestions(qRes.questions);
          setParticipants(partRes.participants);
          setLeaderboard(lbRes);
          setWinnerPayment(wpRes.winnerPayment);
          setPayReference(wpRes.winnerPayment?.paymentReference || '');
          setPayAdminNote(wpRes.winnerPayment?.adminNote || '');
        } else {
          setActiveChallenge(null);
          setOverview(null);
          setQuestions([]);
          setParticipants([]);
          setLeaderboard(null);
          setWinnerPayment(null);
        }
      } catch (err) {
        setFeedback({
          type: 'err',
          text: err instanceof Error ? err.message : 'Unable to load Reward Challenge admin data.',
        });
      } finally {
        setLoading(false);
      }
    },
    [selectedId]
  );

  useEffect(() => {
    void loadChallenges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.rewardChallenges.create({
        title: createTitle.trim(),
        description: createDesc.trim(),
        rewardAmount: Number(createReward) || 0,
        durationMinutes: Math.max(1, Number(createDuration) || 20),
        questionCount: Math.max(1, Number(createQCount) || 20),
        featureImmediately: true,
      });
      setShowCreateModal(false);
      setCreateTitle('');
      setCreateDesc('');
      setFeedback({ type: 'ok', text: `Created competition "${res.challenge.title}". Configure questions & schedule before activating.` });
      await loadChallenges(res.challenge.id);
      await onUpdated?.();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to create competition.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSettingsOrSchedule = async (e: React.FormEvent, mode: 'settings' | 'schedule') => {
    e.preventDefault();
    if (!activeChallenge) return;
    setBusy(true);
    setFeedback(null);
    try {
      const payload =
        mode === 'settings'
          ? {
              title: setTitle.trim(),
              description: setDescription.trim(),
              rewardAmount: Math.max(0, Number(setRewardAmount) || 0),
              isFeatured: setIsFeatured,
            }
          : {
              challengeOpenAt: schOpenAt,
              examStartAt: schExamStartAt,
              examEndAt: schExamEndAt,
              durationMinutes: Math.max(1, Number(schDurationMins) || 20),
              questionCount: Math.max(1, Number(schQuestionCount) || 20),
              selectionMode: schSelectionMode,
              winnerAnnouncementAt: schWinnerAnnounceAt,
              challengeCloseAt: schCloseAt.trim() ? schCloseAt.trim() : null,
            };

      const res = await api.admin.rewardChallenges.updateSettings(activeChallenge.id, payload);
      setFeedback({ type: 'ok', text: res.message });
      await loadChallenges(activeChallenge.id);
      await onUpdated?.();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to save challenge configuration.',
      });
    } finally {
      setBusy(false);
    }
  };

  const [forceEndAttemptsOnFinalize, setForceEndAttemptsOnFinalize] = useState(false);

  const handleActivateChallenge = async () => {
    if (!activeChallenge) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.rewardChallenges.activate(activeChallenge.id);
      setFeedback({ type: 'ok', text: res.message });
      await loadChallenges(activeChallenge.id);
      await onUpdated?.();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to activate challenge.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeactivateChallenge = async () => {
    if (!activeChallenge) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.rewardChallenges.deactivate(activeChallenge.id);
      setFeedback({ type: 'ok', text: res.message });
      await loadChallenges(activeChallenge.id);
      await onUpdated?.();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to deactivate challenge.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAnnounceWinnerNow = async () => {
    if (!activeChallenge) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.rewardChallenges.announceWinner(
        activeChallenge.id,
        forceEndAttemptsOnFinalize
      );
      setFeedback({ type: 'ok', text: res.message });
      await loadChallenges(activeChallenge.id);
      await onUpdated?.();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to finalize and announce winner.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleApplyQuickNowSchedule = () => {
    const now = Date.now();
    setSchOpenAt(formatIsoToWatInput(new Date(now - 60_000).toISOString()));
    setSchExamStartAt(formatIsoToWatInput(new Date(now - 60_000).toISOString()));
    setSchExamEndAt(formatIsoToWatInput(new Date(now + 120 * 60_000).toISOString()));
    setSchWinnerAnnounceAt(formatIsoToWatInput(new Date(now + 125 * 60_000).toISOString()));
    setSchCloseAt('');
    setFeedback({
      type: 'ok',
      text: 'Schedule fields prefilled in Africa/Lagos (WAT) to open immediately for 2 hours. Click "Save Schedule & Examination Rules" to apply.',
    });
  };

  const resetQuestionEditor = () => {
    setEditingQuestion(null);
    setQText('');
    setQOptA('');
    setQOptB('');
    setQOptC('');
    setQOptD('');
    setQCorrect('A');
    setQExpl('');
    setQCategory('General');
    setQStatus('published');
  };

  const handleSaveManualQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChallenge) return;
    setBusy(true);
    setFeedback(null);
    try {
      if (editingQuestion) {
        await api.admin.rewardChallenges.updateQuestion(
          activeChallenge.id,
          editingQuestion.id,
          {
            questionText: qText.trim(),
            optionA: qOptA.trim(),
            optionB: qOptB.trim(),
            optionC: qOptC.trim(),
            optionD: qOptD.trim(),
            correctOption: qCorrect,
            explanation: qExpl.trim(),
            subjectCategory: qCategory.trim() || 'General',
            publicationStatus: qStatus,
          }
        );
        setFeedback({ type: 'ok', text: 'Challenge question updated.' });
      } else {
        await api.admin.rewardChallenges.createQuestion(activeChallenge.id, {
          questionText: qText.trim(),
          optionA: qOptA.trim(),
          optionB: qOptB.trim(),
          optionC: qOptC.trim(),
          optionD: qOptD.trim(),
          correctOption: qCorrect,
          explanation: qExpl.trim(),
          subjectCategory: qCategory.trim() || 'General',
          publicationStatus: qStatus,
        });
        setFeedback({ type: 'ok', text: 'Challenge question added to bank.' });
      }
      resetQuestionEditor();
      await loadChallenges(activeChallenge.id);
      await onUpdated?.();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to save question.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!activeChallenge) return;
    setBusy(true);
    try {
      await api.admin.rewardChallenges.deleteQuestion(activeChallenge.id, qId);
      setFeedback({ type: 'ok', text: 'Challenge question deleted.' });
      await loadChallenges(activeChallenge.id);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to delete question.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handlePublishAllDrafts = async () => {
    if (!activeChallenge) return;
    setBusy(true);
    try {
      const res = await api.admin.rewardChallenges.publishQuestionsBatch(activeChallenge.id, {
        publishAllDrafts: true,
      });
      setFeedback({ type: 'ok', text: res.message });
      await loadChallenges(activeChallenge.id);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to publish draft questions.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChallenge || !bulkFile) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.rewardChallenges.bulkUploadQuestions(
        activeChallenge.id,
        bulkFile,
        bulkStatus
      );
      setBulkFile(null);
      setFeedback({ type: 'ok', text: res.message });
      await loadChallenges(activeChallenge.id);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Bulk question upload failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAiGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChallenge) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.rewardChallenges.aiGenerateQuestions(activeChallenge.id, {
        count: Math.max(1, Math.min(60, Number(aiCount) || 10)),
        subjectCategory: aiCategory.trim() || 'General',
        instructions: aiInstructions.trim(),
        document: aiDocFile,
      });
      setAiDrafts(res.drafts);
      setFeedback({ type: 'ok', text: res.message });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'AI question generation failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAiDrafts = async (pubStatus: QuestionPublicationStatus) => {
    if (!activeChallenge || aiDrafts.length === 0) return;
    setBusy(true);
    try {
      const res = await api.admin.rewardChallenges.aiSaveBatch(activeChallenge.id, {
        questions: aiDrafts.map((d) => ({ ...d, publicationStatus: pubStatus })),
        sourceType: 'ai_generated',
        publicationStatus: pubStatus,
      });
      setAiDrafts([]);
      setFeedback({ type: 'ok', text: res.message });
      await loadChallenges(activeChallenge.id);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to save AI questions.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handlePaymentStatusUpdate = async (next: 'payment_pending' | 'payment_processing') => {
    if (!activeChallenge) return;
    setBusy(true);
    try {
      const res = await api.admin.rewardChallenges.updatePaymentStatus(activeChallenge.id, {
        paymentStatus: next,
        paymentReference: payReference.trim() || undefined,
        adminNote: payAdminNote.trim() || undefined,
      });
      setFeedback({ type: 'ok', text: res.message });
      await loadChallenges(activeChallenge.id);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to update payment status.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmMarkPaid = async () => {
    if (!activeChallenge) return;
    setBusy(true);
    try {
      const res = await api.admin.rewardChallenges.markPaymentPaid(activeChallenge.id, {
        confirmedTransfer: true,
        paymentReference: payReference.trim() || undefined,
        adminNote: payAdminNote.trim() || undefined,
      });
      setConfirmPaidOpen(false);
      setFeedback({ type: 'ok', text: res.message });
      await loadChallenges(activeChallenge.id);
      await onUpdated?.();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to mark payment as completed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmResetResults = async () => {
    if (!activeChallenge) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.admin.rewardChallenges.resetResults(activeChallenge.id);
      setConfirmResetOpen(false);
      setFeedback({ type: 'ok', text: res.message });
      await loadChallenges(activeChallenge.id);
      await onUpdated?.();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to reset challenge results.',
      });
    } finally {
      setBusy(false);
    }
  };

  const subTabs: Array<{
    id: AdminSubSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'overview', label: '1. Challenge Overview', icon: Trophy },
    { id: 'settings', label: '2. Challenge Settings', icon: Settings },
    { id: 'questions', label: '3. Question Management', icon: FileText },
    { id: 'schedule', label: '4. Exam Scheduling', icon: Calendar },
    { id: 'participants', label: '5. Participants', icon: Users },
    { id: 'leaderboard', label: '6. Results & Leaderboard', icon: BarChart2 },
    { id: 'winner', label: '7. Winner Management', icon: Award },
    { id: 'payments', label: '8. Reward Payments', icon: CreditCard },
  ];

  const draftQuestionsCount = questions.filter((q) => q.publicationStatus === 'draft').length;

  return (
    <div className="space-y-4">
      {/* Competition Selector & Header */}
      <div className="rounded-xl border border-[#c6daf7] dark:border-slate-800 bg-[#eff5ff]/80 dark:bg-slate-800/60 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#0b337a] text-amber-300 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-extrabold text-[#082252] dark:text-white">
              Acadet Reward CBT Challenge Management
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Manage multiple competition editions independently (questions, WAT schedule, leaderboard, winners & payouts).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {challenges.length > 0 && (
            <select
              value={selectedId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedId(nextId);
                void loadChallenges(nextId);
              }}
              aria-label="Select competition"
              className="rounded-xl border border-[#9dc0f5] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-extrabold text-slate-900 dark:text-white"
            >
              {challenges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} · {c.displayStatus} {c.isActive ? '(Live)' : '(Inactive)'}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold inline-flex items-center gap-1.5 min-h-[38px]"
          >
            <Plus className="w-4 h-4" />
            <span>New Competition</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => void loadChallenges(selectedId)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold inline-flex items-center gap-1.5 min-h-[38px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold border ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {!activeChallenge ? (
        <div className="py-12 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
          <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-base font-extrabold text-slate-800 dark:text-white">
            No Reward CBT Challenge Competitions Created Yet
          </div>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Click <strong>New Competition</strong> to create your first Acadet Reward CBT Challenge, upload or generate questions, configure schedule dates in WAT, and activate.
          </p>
        </div>
      ) : (
        <>
          {/* 8 Sub-section Pills */}
          <div className="flex flex-wrap gap-1.5 pb-1">
            {subTabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSubSection(t.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors ${
                    subSection === t.id
                      ? 'bg-[#0b337a] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* 1. CHALLENGE OVERVIEW */}
          {subSection === 'overview' && overview && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-extrabold text-[#082252] dark:text-white">
                      {activeChallenge.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md border text-[11px] font-extrabold ${getStatusStyles(activeChallenge.displayStatus)}`}
                    >
                      {activeChallenge.displayStatus}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                        activeChallenge.isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {activeChallenge.isActive ? 'Activated (Visible)' : 'Inactive / Hidden'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    Reward Prize: <strong>₦{Math.round(activeChallenge.rewardAmount).toLocaleString('en-NG')}</strong> · Exam Window: {formatWatDateTimeDisplay(overview.scheduledExamStartAt)} to {formatWatDateTimeDisplay(overview.scheduledExamEndAt)}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || activeChallenge.isActive}
                    onClick={() => void handleActivateChallenge()}
                    className="px-3.5 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 min-h-[40px] text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45"
                  >
                    <Power className="w-4 h-4" />
                    <span>Activate Challenge</span>
                  </button>

                  <button
                    type="button"
                    disabled={busy || !activeChallenge.isActive}
                    onClick={() => void handleDeactivateChallenge()}
                    className="px-3.5 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 min-h-[40px] text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-45"
                  >
                    <Power className="w-4 h-4" />
                    <span>Deactivate Challenge</span>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const res = await api.admin.rewardChallenges.sync(activeChallenge.id);
                        setFeedback({ type: 'ok', text: res.message });
                        await loadChallenges(activeChallenge.id);
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-extrabold inline-flex items-center gap-1.5 min-h-[40px]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Run Automation Check</span>
                  </button>

                  {(activeChallenge.submittedCount > 0 ||
                    activeChallenge.hasWinner ||
                    activeChallenge.settings.winnerAnnouncedAt !== null) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmResetOpen(true)}
                      className="px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100 text-xs font-extrabold inline-flex items-center gap-1.5 min-h-[40px]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Reset Attempts &amp; Winner (Reopen)</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Registered Students', val: overview.totalRegisteredStudents },
                  { label: 'Challenge Participants', val: overview.totalParticipants },
                  { label: 'Submitted / Completed', val: `${overview.totalSubmittedExaminations} / ${overview.totalCompletedExaminations}` },
                  { label: 'Questions (Published / All)', val: `${overview.publishedQuestionsCount} / ${overview.uploadedQuestionsCount}` },
                  { label: 'Current Challenge Status', val: overview.currentStatus },
                  { label: 'Winner Announcement', val: overview.winnerAnnouncementStatus },
                  { label: 'Reward Payment Status', val: overview.rewardPaymentStatus.replace(/_/g, ' ').toUpperCase() },
                  { label: 'Duration / Count', val: `${activeChallenge.settings.durationMinutes}m / ${activeChallenge.settings.questionCount} Qs` },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-3.5 bg-white dark:bg-slate-900"
                  >
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {stat.label}
                    </div>
                    <div className="text-sm sm:text-base font-extrabold text-[#082252] dark:text-white mt-1 tabular-nums break-words">
                      {stat.val}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. CHALLENGE SETTINGS */}
          {subSection === 'settings' && (
            <form
              onSubmit={(e) => void handleSaveSettingsOrSchedule(e, 'settings')}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <h4 className="text-sm font-extrabold text-[#082252] dark:text-white">
                  Challenge Identity, Prize Reward & Visibility
                </h4>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || activeChallenge.isActive}
                    onClick={() => void handleActivateChallenge()}
                    className="px-3 py-1.5 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 inline-flex items-center gap-1.5"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Activate Challenge</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy || !activeChallenge.isActive}
                    onClick={() => void handleDeactivateChallenge()}
                    className="px-3 py-1.5 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-45 inline-flex items-center gap-1.5"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Deactivate Challenge</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Challenge Title
                  </label>
                  <input
                    type="text"
                    required
                    value={setTitle}
                    onChange={(e) => setSetTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Reward Prize Amount (₦ NGN)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={setRewardAmount}
                    onChange={(e) => setSetRewardAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm font-bold tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Student Rules
                </label>
                <textarea
                  rows={3}
                  value={setDescription}
                  onChange={(e) => setSetDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={setIsFeatured}
                  onChange={(e) => setSetIsFeatured(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span>Feature this competition on student dashboards</span>
              </label>

              <div>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Settings</span>
                </button>
              </div>
            </form>
          )}

          {/* 3. QUESTION MANAGEMENT (MANUAL + BULK UPLOAD + AI GENERATOR) */}
          {subSection === 'questions' && (
            <div className="space-y-4">
              {/* Method 1: Manual Add / Edit Question */}
              <form
                onSubmit={handleSaveManualQuestion}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-extrabold text-[#082252] dark:text-white">
                    {editingQuestion ? 'Edit Challenge Question' : 'Add Challenge Question Manually'}
                  </h4>
                  {editingQuestion && (
                    <button
                      type="button"
                      onClick={resetQuestionEditor}
                      className="text-xs font-bold text-slate-500 underline"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Question Text
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={qText}
                    onChange={(e) => setQText(e.target.value)}
                    placeholder="Enter competition question..."
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold mb-1">Option A</label>
                    <input
                      type="text"
                      required
                      value={qOptA}
                      onChange={(e) => setQOptA(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Option B</label>
                    <input
                      type="text"
                      required
                      value={qOptB}
                      onChange={(e) => setQOptB(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Option C</label>
                    <input
                      type="text"
                      required
                      value={qOptC}
                      onChange={(e) => setQOptC(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Option D</label>
                    <input
                      type="text"
                      required
                      value={qOptD}
                      onChange={(e) => setQOptD(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold mb-1">Correct Option</label>
                    <select
                      value={qCorrect}
                      onChange={(e) => setQCorrect(e.target.value as OptionLetter)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-bold"
                    >
                      {(['A', 'B', 'C', 'D'] as const).map((l) => (
                        <option key={l} value={l}>
                          Option {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Subject / Category</label>
                    <input
                      type="text"
                      value={qCategory}
                      onChange={(e) => setQCategory(e.target.value)}
                      placeholder="e.g. General Knowledge / GST 111"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Status</label>
                    <select
                      value={qStatus}
                      onChange={(e) => setQStatus(e.target.value as QuestionPublicationStatus)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-bold"
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Explanation (Optional)</label>
                  <input
                    type="text"
                    value={qExpl}
                    onChange={(e) => setQExpl(e.target.value)}
                    placeholder="Reason why correct option is accurate (revealed only after winner announcement)"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{editingQuestion ? 'Save Question Changes' : 'Add to Challenge Bank'}</span>
                </button>
              </form>

              {/* Method 2 & 3 Side by Side: Bulk Upload & AI Question Generator */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <form
                  onSubmit={handleBulkUpload}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
                >
                  <div className="flex items-center gap-2 font-extrabold text-sm text-[#082252] dark:text-white">
                    <Upload className="w-4 h-4 text-[#0a58ed]" />
                    <span>Bulk Upload Questions (PDF, DOCX, TXT, CSV, JSON)</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Supports structured Q&amp;A blocks, CSV columns, JSON arrays, or PDF/DOCX extraction using Acadet&apos;s backend AI parser.
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.csv,.json"
                    onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                    className="w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:font-bold file:bg-[#eff5ff] file:text-[#0b337a]"
                  />
                  {bulkFile && (
                    <div className="text-[11px] font-semibold text-[#0b337a] dark:text-blue-300 truncate">
                      Selected file: {bulkFile.name}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={bulkStatus}
                      onChange={(e) => setBulkStatus(e.target.value as QuestionPublicationStatus)}
                      className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                    >
                      <option value="published">Import as Published</option>
                      <option value="draft">Import as Draft</option>
                    </select>
                    <button
                      type="submit"
                      disabled={busy || !bulkFile}
                      className="px-4 py-2 rounded-xl bg-[#0b337a] hover:bg-[#082252] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload &amp; Import</span>
                    </button>
                  </div>
                </form>

                <form
                  onSubmit={handleAiGenerate}
                  className="rounded-xl border border-[#9dc0f5] dark:border-blue-800 bg-[#eff5ff]/50 dark:bg-slate-900 p-4 space-y-3"
                >
                  <div className="flex items-center gap-2 font-extrabold text-sm text-[#082252] dark:text-white">
                    <Sparkles className="w-4 h-4 text-[#0a58ed]" />
                    <span>AI Question Generator (Uses Existing Gemini Backend Key)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={aiCount}
                      onChange={(e) => setAiCount(e.target.value)}
                      placeholder="Count"
                      className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                    />
                    <input
                      type="text"
                      value={aiCategory}
                      onChange={(e) => setAiCategory(e.target.value)}
                      placeholder="Subject / Category"
                      className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={aiInstructions}
                    onChange={(e) => setAiInstructions(e.target.value)}
                    placeholder="Paste learning material, syllabus topics, or instructions..."
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                  />
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => setAiDocFile(e.target.files?.[0] || null)}
                    className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:font-bold file:bg-white file:text-[#0b337a]"
                  />
                  {aiDocFile && (
                    <div className="text-[11px] font-semibold text-[#0b337a] dark:text-blue-300 truncate">
                      Attached document: {aiDocFile.name}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{busy ? 'Generating...' : 'Generate Challenge Questions'}</span>
                  </button>
                </form>
              </div>

              {/* AI Draft Review Table */}
              {aiDrafts.length > 0 && (
                <div className="rounded-xl border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-extrabold text-[#082252] dark:text-white">
                      Review AI-Generated Questions ({aiDrafts.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSaveAiDrafts('draft')}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-extrabold"
                      >
                        Save All as Draft
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSaveAiDrafts('published')}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-extrabold"
                      >
                        Approve &amp; Publish All
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {aiDrafts.map((d, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-1"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {i + 1}. {d.questionText}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setAiDrafts((prev) => prev.filter((_, idx) => idx !== i))
                            }
                            className="text-rose-600 font-bold shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="text-slate-600 dark:text-slate-400">
                          A: {d.optionA} | B: {d.optionB} | C: {d.optionC} | D: {d.optionD} ·{' '}
                          <strong>Ans: {d.correctOption}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Existing Challenge Questions Bank */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-4 py-3 bg-[#eff5ff] dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs sm:text-sm font-extrabold text-[#082252] dark:text-white">
                    Challenge Question Bank ({questions.length} total ·{' '}
                    {questions.filter((q) => q.publicationStatus === 'published').length} published)
                  </div>
                  {draftQuestionsCount > 0 && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handlePublishAllDrafts}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-extrabold"
                    >
                      Publish All Drafts ({draftQuestionsCount})
                    </button>
                  )}
                </div>

                {questions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No challenge questions uploaded yet. Add manually, bulk upload, or generate with AI above.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {questions.map((q, idx) => (
                      <div
                        key={q.id}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-extrabold text-[#0b337a] dark:text-blue-300">
                              Q{idx + 1}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                q.publicationStatus === 'published'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {q.publicationStatus}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                              {q.subjectCategory}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">
                              Ans: {q.correctOption}
                            </span>
                          </div>
                          <div className="font-semibold text-slate-900 dark:text-white line-clamp-2">
                            {q.questionText}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewQuestion(q)}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                            title="Preview question"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingQuestion(q);
                              setQText(q.questionText);
                              setQOptA(q.optionA);
                              setQOptB(q.optionB);
                              setQOptC(q.optionC);
                              setQOptD(q.optionD);
                              setQCorrect(q.correctOption);
                              setQExpl(q.explanation);
                              setQCategory(q.subjectCategory);
                              setQStatus(q.publicationStatus);
                            }}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                            title="Edit question"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteQuestion(q.id)}
                            className="p-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                            title="Delete question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. EXAMINATION SCHEDULING */}
          {subSection === 'schedule' && (
            <form
              onSubmit={(e) => void handleSaveSettingsOrSchedule(e, 'schedule')}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
            >
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-extrabold text-[#082252] dark:text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#0a58ed]" />
                    <span>Competition Schedule & Examination Parameters (Nigeria WAT · Africa/Lagos)</span>
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    All date/time fields operate strictly in West Africa Time (Africa/Lagos, UTC+1) and drive automated openings, exam enforcement, auto-submission, and winner announcements.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleApplyQuickNowSchedule}
                  className="px-3 py-1.5 rounded-xl border border-[#9dc0f5] bg-[#eff5ff] dark:bg-slate-800 text-[#0b337a] dark:text-blue-200 text-xs font-extrabold hover:bg-blue-100"
                >
                  Quick Fill: Open Immediately (2 Hours WAT)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Challenge Opening (WAT)</label>
                  <input
                    type="datetime-local"
                    required
                    value={schOpenAt}
                    onChange={(e) => setSchOpenAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Exam Date &amp; Start Time (WAT)</label>
                  <input
                    type="datetime-local"
                    required
                    value={schExamStartAt}
                    onChange={(e) => setSchExamStartAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Exam Closing Time (WAT)</label>
                  <input
                    type="datetime-local"
                    required
                    value={schExamEndAt}
                    onChange={(e) => setSchExamEndAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Winner Announcement (WAT)</label>
                  <input
                    type="datetime-local"
                    required
                    value={schWinnerAnnounceAt}
                    onChange={(e) => setSchWinnerAnnounceAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Challenge Closing Date/Time (Optional WAT)</label>
                  <input
                    type="datetime-local"
                    value={schCloseAt}
                    onChange={(e) => setSchCloseAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Question Selection Mode</label>
                  <select
                    value={schSelectionMode}
                    onChange={(e) =>
                      setSchSelectionMode(e.target.value as RewardChallengeSelectionMode)
                    }
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                  >
                    <option value="random">Random Selection</option>
                    <option value="ordered">Ordered Bank Sequence</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Exam Duration (Minutes)</label>
                  <input
                    type="number"
                    min={1}
                    max={360}
                    required
                    value={schDurationMins}
                    onChange={(e) => setSchDurationMins(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Number of Questions</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    required
                    value={schQuestionCount}
                    onChange={(e) => setSchQuestionCount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold tabular-nums"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 text-xs space-y-1.5">
                <div className="font-bold text-slate-700 dark:text-slate-200">
                  Current Server Time (WAT):{' '}
                  <span className="font-mono text-[#0b337a] dark:text-blue-300">
                    {formatWatDateTimeDisplay(activeChallenge.serverNow)}
                  </span>
                </div>
                {(!activeChallenge.isActive || activeChallenge.publishedQuestionCount === 0) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-amber-800 dark:text-amber-300 font-semibold">
                    <span>
                      {activeChallenge.publishedQuestionCount === 0
                        ? 'Action required: Publish at least 1 question in Question Management before activating, otherwise the CBT cannot display to students.'
                        : 'Reminder: This challenge is currently INACTIVE. Save your schedule, then click Activate Challenge so students can start the CBT at the scheduled time.'}
                    </span>
                    {!activeChallenge.isActive && activeChallenge.publishedQuestionCount > 0 && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleActivateChallenge()}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1"
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>Activate Challenge Now</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Save Schedule &amp; Examination Rules</span>
              </button>
            </form>
          )}

          {/* 5. PARTICIPANTS */}
          {subSection === 'participants' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 bg-[#eff5ff] dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-sm font-extrabold text-[#082252] dark:text-white">
                Challenge Participants ({participants.length})
              </div>
              {participants.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No students have joined this challenge yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/70 font-extrabold border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2.5 px-3">Student Name</th>
                        <th className="py-2.5 px-3">Reg Code</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Attempt</th>
                        <th className="py-2.5 px-3">Score</th>
                        <th className="py-2.5 px-3">Time Taken</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {participants.map((p) => (
                        <tr key={p.participantId}>
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                            {p.fullName}
                            <div className="text-[11px] font-normal text-slate-500">{p.email}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono">{p.registrationCode || '—'}</td>
                          <td className="py-2.5 px-3 capitalize font-bold">{p.status.replace('_', ' ')}</td>
                          <td className="py-2.5 px-3 capitalize">{p.attemptStatus.replace('_', ' ')}</td>
                          <td className="py-2.5 px-3 tabular-nums font-bold">
                            {p.score !== null ? `${p.score}/${p.totalQuestions} (${p.percentage}%)` : '—'}
                          </td>
                          <td className="py-2.5 px-3 tabular-nums">
                            {formatDuration(p.completionTimeSeconds)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 6. RESULTS AND LEADERBOARD */}
          {subSection === 'leaderboard' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 bg-[#eff5ff] dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-sm font-extrabold text-[#082252] dark:text-white">
                  Challenge Results &amp; Ranked Leaderboard
                </span>
                <span className="text-xs font-extrabold text-[#0b337a] dark:text-blue-300">
                  {leaderboard?.isFinal ? 'Official Final' : 'Live Provisional'}
                </span>
              </div>
              {!leaderboard || leaderboard.entries.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No completed challenge attempts yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/70 font-extrabold border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2.5 px-3">Rank</th>
                        <th className="py-2.5 px-3">Student</th>
                        <th className="py-2.5 px-3">Score</th>
                        <th className="py-2.5 px-3">Completion Time</th>
                        <th className="py-2.5 px-3">Submitted At (WAT)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {leaderboard.entries.map((entry) => (
                        <tr key={entry.studentId}>
                          <td className="py-2.5 px-3 font-extrabold tabular-nums">#{entry.position}</td>
                          <td className="py-2.5 px-3 font-bold">{entry.studentName}</td>
                          <td className="py-2.5 px-3 tabular-nums font-extrabold">
                            {entry.score}/{entry.totalQuestions} ({entry.percentage}%)
                          </td>
                          <td className="py-2.5 px-3 tabular-nums">
                            {formatDuration(entry.completionTimeSeconds)}
                          </td>
                          <td className="py-2.5 px-3">
                            {formatWatDateTimeDisplay(entry.submittedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 7. WINNER MANAGEMENT */}
          {subSection === 'winner' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <h4 className="text-sm font-extrabold text-[#082252] dark:text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <span>Winner Management</span>
              </h4>
              {!activeChallenge.winner ? (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-3">
                  <div>
                    {activeChallenge.noValidParticipants
                      ? 'Examination ended with zero valid submitted attempts; no winner was recorded.'
                      : `Winner has not been announced yet. Scheduled automatic announcement: ${formatWatDateTimeDisplay(activeChallenge.settings.winnerAnnouncementAt)}.`}
                  </div>
                  {!activeChallenge.noValidParticipants && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2.5">
                      <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={forceEndAttemptsOnFinalize}
                          onChange={(e) => setForceEndAttemptsOnFinalize(e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        <span>Force-submit any currently open in-progress attempts before announcing winner</span>
                      </label>
                      <div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleAnnounceWinnerNow()}
                          className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                        >
                          <Award className="w-4 h-4" />
                          <span>Finalize Results &amp; Announce Winner Now</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/30 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="text-slate-500 font-bold">Official 1st Place Winner</div>
                    <div className="text-sm font-extrabold text-[#082252] dark:text-white mt-0.5">
                      {activeChallenge.winner.studentName}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-bold">Score &amp; Speed</div>
                    <div className="font-extrabold mt-0.5 tabular-nums">
                      {activeChallenge.winner.score}/{activeChallenge.winner.totalQuestions} (
                      {activeChallenge.winner.percentage}%) ·{' '}
                      {formatDuration(activeChallenge.winner.completionTimeSeconds)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-bold">Submitted Bank Details</div>
                    <div className="font-bold mt-0.5">
                      {winnerPayment?.bankName
                        ? `${winnerPayment.bankName} · ${winnerPayment.accountNumber} (${winnerPayment.accountName})`
                        : 'Awaiting winner bank submission'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-bold">Reward Payout Status</div>
                    <div className="font-extrabold uppercase mt-0.5 text-[#0a58ed]">
                      {winnerPayment?.paymentStatus.replace(/_/g, ' ') || 'PAYMENT PENDING'}
                    </div>
                  </div>
                </div>
              )}

              {(activeChallenge.submittedCount > 0 ||
                activeChallenge.hasWinner ||
                activeChallenge.settings.winnerAnnouncedAt !== null) && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmResetOpen(true)}
                    className="px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100 text-xs font-extrabold inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset Attempts &amp; Winner (Reopen Competition)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 8. WINNER REWARD PAYMENT MANAGEMENT */}
          {subSection === 'payments' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                <h4 className="text-sm font-extrabold text-[#082252] dark:text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#0a58ed]" />
                  <span>Winner Reward Payment Management</span>
                </h4>

                {!winnerPayment ? (
                  <div className="text-xs text-slate-500 py-4">
                    No reward payment record exists yet. Payment records are created automatically when a 1st Place winner is announced.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                        <div className="text-slate-500 font-bold">Winner</div>
                        <div className="font-extrabold text-sm mt-0.5">{winnerPayment.studentName}</div>
                        <div className="text-[11px] text-slate-500">{winnerPayment.studentEmail}</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                        <div className="text-slate-500 font-bold">Reward Amount</div>
                        <div className="font-extrabold text-sm text-emerald-700 dark:text-emerald-400 mt-0.5 tabular-nums">
                          ₦{Math.round(winnerPayment.rewardAmount).toLocaleString('en-NG')}
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                        <div className="text-slate-500 font-bold">Bank Account Provided</div>
                        {winnerPayment.bankName ? (
                          <div className="mt-0.5 space-y-0.5">
                            <div className="font-extrabold">{winnerPayment.bankName}</div>
                            <div className="font-mono font-bold">{winnerPayment.accountNumber}</div>
                            <div>{winnerPayment.accountName}</div>
                          </div>
                        ) : (
                          <div className="text-amber-700 font-bold mt-0.5">Not submitted yet</div>
                        )}
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                        <div className="text-slate-500 font-bold">Current Status</div>
                        <div className="font-extrabold uppercase mt-0.5 text-[#0b337a] dark:text-blue-300">
                          {winnerPayment.paymentStatus.replace(/_/g, ' ')}
                        </div>
                        {winnerPayment.paidAt && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Paid {formatWatDateTimeDisplay(winnerPayment.paidAt)}
                          </div>
                        )}
                      </div>
                    </div>

                    {winnerPayment.paymentStatus !== 'payment_completed' && (
                      <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold mb-1">
                              Transfer / Bank Reference (Optional)
                            </label>
                            <input
                              type="text"
                              value={payReference}
                              onChange={(e) => setPayReference(e.target.value)}
                              placeholder="e.g. NIP-20261121-9842"
                              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold mb-1">
                              Admin Note (Optional)
                            </label>
                            <input
                              type="text"
                              value={payAdminNote}
                              onChange={(e) => setPayAdminNote(e.target.value)}
                              placeholder="Internal verification memo..."
                              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handlePaymentStatusUpdate('payment_processing')}
                            className="px-3.5 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold"
                          >
                            Set Status: PAYMENT PROCESSING
                          </button>

                          <button
                            type="button"
                            disabled={busy || !winnerPayment.bankName}
                            onClick={() => setConfirmPaidOpen(true)}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>MARK AS PAID / PAYMENT COMPLETED</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Historical All-Competition Reward Payments */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-4 py-3 bg-[#eff5ff] dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-extrabold text-[#082252] dark:text-white">
                  All Competition Reward Payment Records ({allPayments.length})
                </div>
                {allPayments.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No reward payout records across competitions yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/70 font-extrabold border-b border-slate-200 dark:border-slate-700">
                          <th className="py-2.5 px-3">Challenge</th>
                          <th className="py-2.5 px-3">Winner</th>
                          <th className="py-2.5 px-3">Bank Account</th>
                          <th className="py-2.5 px-3">Reward</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Paid By / At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {allPayments.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2.5 px-3 font-bold">{p.challengeTitle}</td>
                            <td className="py-2.5 px-3">{p.studentName}</td>
                            <td className="py-2.5 px-3 font-mono">
                              {p.bankName ? `${p.bankName} · ${p.accountNumber}` : 'Pending'}
                            </td>
                            <td className="py-2.5 px-3 font-extrabold tabular-nums">
                              ₦{Math.round(p.rewardAmount).toLocaleString('en-NG')}
                            </td>
                            <td className="py-2.5 px-3 uppercase font-bold">
                              {p.paymentStatus.replace(/_/g, ' ')}
                            </td>
                            <td className="py-2.5 px-3">
                              {p.paidAt
                                ? `${p.paidByAdminName || 'Admin'} · ${formatWatDateTimeDisplay(p.paidAt)}`
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* New Competition Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="bg-[#0b337a] text-white px-5 py-3.5 flex items-center justify-between">
              <span className="font-extrabold text-sm">Create New Reward CBT Challenge</span>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg hover:bg-white/15"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateChallenge} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1">Challenge Title</label>
                <input
                  type="text"
                  required
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="e.g. Acadet CBT Weekly Scholarship Challenge #2"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="Competition rules and academic scope..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold mb-1">Reward (₦)</label>
                  <input
                    type="number"
                    min={0}
                    value={createReward}
                    onChange={(e) => setCreateReward(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Duration (m)</label>
                  <input
                    type="number"
                    min={1}
                    value={createDuration}
                    onChange={(e) => setCreateDuration(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Questions</label>
                  <input
                    type="number"
                    min={1}
                    value={createQCount}
                    onChange={(e) => setCreateQCount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-[#0a58ed] text-white text-xs font-extrabold"
                >
                  {busy ? 'Creating...' : 'Create Competition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Question Modal */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="bg-[#0b337a] text-white px-5 py-3.5 flex items-center justify-between">
              <span className="font-extrabold text-sm">Question Preview</span>
              <button
                type="button"
                onClick={() => setPreviewQuestion(null)}
                className="p-1 rounded-lg hover:bg-white/15"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="font-bold text-slate-900 dark:text-white">
                {previewQuestion.questionText}
              </div>
              <div className="space-y-1.5 text-xs">
                {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                  const val =
                    letter === 'A'
                      ? previewQuestion.optionA
                      : letter === 'B'
                        ? previewQuestion.optionB
                        : letter === 'C'
                          ? previewQuestion.optionC
                          : previewQuestion.optionD;
                  return (
                    <div
                      key={letter}
                      className={`p-2 rounded-lg border ${
                        previewQuestion.correctOption === letter
                          ? 'border-emerald-400 bg-emerald-50 font-bold text-emerald-900'
                          : 'border-slate-200'
                      }`}
                    >
                      {letter}. {val} {previewQuestion.correctOption === letter ? '(Correct)' : ''}
                    </div>
                  );
                })}
              </div>
              {previewQuestion.explanation && (
                <div className="text-xs text-slate-600">
                  <strong>Explanation:</strong> {previewQuestion.explanation}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mark As Paid Confirmation Modal */}
      {confirmPaidOpen && winnerPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 shadow-2xl overflow-hidden">
            <div className="bg-emerald-700 text-white px-5 py-3.5 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-300" />
              <span className="font-extrabold text-sm">Confirm Reward Bank Transfer</span>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Have you successfully transferred the reward to the winner&apos;s provided bank account?
              </p>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-xs space-y-1">
                <div>
                  <strong>Winner:</strong> {winnerPayment.studentName}
                </div>
                <div>
                  <strong>Amount:</strong> ₦{Math.round(winnerPayment.rewardAmount).toLocaleString('en-NG')}
                </div>
                <div>
                  <strong>Bank:</strong> {winnerPayment.bankName} · {winnerPayment.accountNumber} ({winnerPayment.accountName})
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmPaidOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleConfirmMarkPaid()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold"
                >
                  {busy ? 'Confirming...' : 'Yes, Mark as Paid'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Challenge Results & Reopen Confirmation Modal */}
      {confirmResetOpen && activeChallenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 shadow-2xl overflow-hidden">
            <div className="bg-amber-600 text-white px-5 py-3.5 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-white" />
              <span className="font-extrabold text-sm">Reset Attempts &amp; Winner?</span>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                This will clear all prior test/exam attempts, leaderboard rankings, winner announcement records, and bank payout requests for <strong>{activeChallenge.title}</strong>, keeping your uploaded question bank intact so students can sit the challenge on the scheduled window.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmResetOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleConfirmResetResults()}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold"
                >
                  {busy ? 'Resetting...' : 'Yes, Reset & Reopen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
