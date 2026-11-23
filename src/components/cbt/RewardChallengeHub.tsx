import {
  AlertCircle,
  Award,
  BarChart2,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  FileCheck2,
  History,
  Lock,
  Play,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type {
  RewardChallengeAttemptPayload,
  RewardChallengeGradedQuestion,
  RewardChallengeLeaderboardResponse,
  RewardChallengePaymentStatus,
  RewardChallengeStudentHistoryItem,
  RewardChallengeSummary,
} from '../../types/cbt';
import {
  formatWatDateTimeDisplay,
  getStatusStyles,
} from './RewardChallengeDashboardCard';

interface RewardChallengeHubProps {
  currentUserId: string;
  featuredChallenge: RewardChallengeSummary | null;
  initialSubView?: 'overview' | 'leaderboard' | 'winner';
  submissionConfirmationMessage?: string | null;
  onClearSubmissionConfirmation?: () => void;
  startErrorNotice?: string | null;
  onClearStartErrorNotice?: () => void;
  onStartOrResumeChallenge: (challengeId: string) => Promise<void>;
  onChallengeStateUpdated?: () => Promise<void> | void;
}

function formatDurationSeconds(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || sec < 0) return '0s';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatCountdownMs(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const hms = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return days > 0 ? `${days}d ${hms}` : hms;
}

function getPaymentStatusBadge(status: RewardChallengePaymentStatus) {
  switch (status) {
    case 'payment_completed':
      return {
        label: 'PAYMENT COMPLETED',
        cls: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
      };
    case 'payment_processing':
      return {
        label: 'PAYMENT PROCESSING',
        cls: 'bg-blue-100 dark:bg-blue-950/60 text-[#0b337a] dark:text-blue-200 border-[#9dc0f5] dark:border-blue-700',
      };
    default:
      return {
        label: 'PAYMENT PENDING',
        cls: 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700',
      };
  }
}

function isActiveFormInputFocused(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (el as HTMLElement).isContentEditable
  );
}

export const RewardChallengeHub: React.FC<RewardChallengeHubProps> = ({
  featuredChallenge,
  initialSubView = 'overview',
  submissionConfirmationMessage,
  onClearSubmissionConfirmation,
  startErrorNotice,
  onClearStartErrorNotice,
  onStartOrResumeChallenge,
  onChallengeStateUpdated,
}) => {
  const [subView, setSubView] = useState<'overview' | 'leaderboard' | 'winner' | 'history'>(
    initialSubView
  );
  const [challengesList, setChallengesList] = useState<RewardChallengeSummary[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(
    featuredChallenge?.id || ''
  );
  const [challenge, setChallenge] = useState<RewardChallengeSummary | null>(featuredChallenge);
  const [leaderboard, setLeaderboard] = useState<RewardChallengeLeaderboardResponse | null>(null);
  const [myHistory, setMyHistory] = useState<RewardChallengeStudentHistoryItem[]>([]);
  const [reviewAttempt, setReviewAttempt] = useState<RewardChallengeAttemptPayload | null>(null);
  const [showAnswersReview, setShowAnswersReview] = useState(false);

  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Server clock offset calculation so countdown matches Africa/Lagos server time
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [nowTickMs, setNowTickMs] = useState(() => Date.now());

  // Bank details form state for winners
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');
  const [editingBank, setEditingBank] = useState(false);

  const bankFormDirtyRef = useRef(false);
  const hydratedBankKeyRef = useRef<string | null>(null);
  const isBankFormFocusedRef = useRef(false);
  const editingBankRef = useRef(editingBank);
  editingBankRef.current = editingBank;

  useEffect(() => {
    setSubView(initialSubView);
  }, [initialSubView]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTickMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const loadData = useCallback(
    async (
      targetId?: string,
      options?: { background?: boolean; forceSyncBankForm?: boolean }
    ) => {
      if (!options?.background) {
        setLoading(true);
      }
      try {
        const [histRes, myHistRes] = await Promise.all([
          api.rewardChallenges.listHistory(),
          api.rewardChallenges.getMyHistory(),
        ]);

        setChallengesList(histRes.challenges);
        setMyHistory(myHistRes.history);

        const activeId =
          targetId ||
          selectedChallengeId ||
          featuredChallenge?.id ||
          histRes.challenges[0]?.id ||
          '';

        if (activeId) {
          setSelectedChallengeId(activeId);
          const [detailRes, lbRes] = await Promise.all([
            api.rewardChallenges.getDetail(activeId),
            api.rewardChallenges.getLeaderboard(activeId),
          ]);
          setChallenge(detailRes.challenge);
          setLeaderboard(lbRes);

          const serverDate = new Date(detailRes.challenge.serverNow).getTime();
          if (!Number.isNaN(serverDate)) {
            setServerOffsetMs(serverDate - Date.now());
          }

          const savedBank = detailRes.challenge.myParticipation.myBankDetails;
          const nextBankKey = `${detailRes.challenge.id}:${savedBank?.updatedAt || 'none'}`;
          const switchedChallenge =
            hydratedBankKeyRef.current !== null &&
            !hydratedBankKeyRef.current.startsWith(`${detailRes.challenge.id}:`);

          const shouldHydrateBankForm =
            Boolean(options?.forceSyncBankForm) ||
            (!bankFormDirtyRef.current &&
              !isBankFormFocusedRef.current &&
              !editingBankRef.current &&
              (hydratedBankKeyRef.current === null ||
                switchedChallenge ||
                hydratedBankKeyRef.current !== nextBankKey));

          if (shouldHydrateBankForm) {
            if (savedBank) {
              setBankName(savedBank.bankName);
              setAccountNumber(savedBank.accountNumber);
              setAccountName(savedBank.accountName);
            } else {
              setBankName('');
              setAccountNumber('');
              setAccountName('');
            }
            hydratedBankKeyRef.current = nextBankKey;
          }

          if (
            detailRes.challenge.myParticipation.attempt &&
            detailRes.challenge.myParticipation.attempt.status !== 'in_progress' &&
            detailRes.challenge.settings.winnerAnnouncedAt
          ) {
            try {
              const att = await api.rewardChallenges.getAttempt(activeId);
              setReviewAttempt(att);
            } catch {
              setReviewAttempt(null);
            }
          } else {
            setReviewAttempt(null);
          }
        } else {
          setChallenge(null);
          setLeaderboard(null);
          setReviewAttempt(null);
        }
      } catch (err) {
        if (!options?.background) {
          setFeedback({
            type: 'err',
            text: err instanceof Error ? err.message : 'Unable to load reward challenge details.',
          });
        }
      } finally {
        if (!options?.background) {
          setLoading(false);
        }
      }
    },
    [featuredChallenge?.id, selectedChallengeId]
  );

  useEffect(() => {
    void loadData(featuredChallenge?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featuredChallenge?.id]);

  // Periodic sync for live countdown / status transitions / leaderboard updates (never interrupts typing)
  useEffect(() => {
    if (!selectedChallengeId) return;
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (
        isBankFormFocusedRef.current ||
        bankFormDirtyRef.current ||
        editingBankRef.current ||
        isActiveFormInputFocused()
      ) {
        return;
      }
      void loadData(selectedChallengeId, { background: true });
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [selectedChallengeId, loadData]);

  const handleJoinChallenge = async () => {
    if (!challenge) return;
    setBusyAction(true);
    setFeedback(null);
    try {
      const res = await api.rewardChallenges.join(challenge.id);
      setChallenge(res.challenge);
      setFeedback({
        type: 'ok',
        text: 'You have registered for this challenge. Stay ready for the examination start window!',
      });
      await onChallengeStateUpdated?.();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to join challenge.',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleStartExam = async () => {
    if (!challenge) return;
    setBusyAction(true);
    setFeedback(null);
    try {
      await onStartOrResumeChallenge(challenge.id);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to start examination.',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleSubmitBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    setBusyAction(true);
    setFeedback(null);
    try {
      const res = await api.rewardChallenges.submitBankDetails(challenge.id, {
        bankName,
        accountNumber,
        accountName,
        ...(challenge.myParticipation.myBankDetails
          ? { correctionNote }
          : {}),
      });
      setEditingBank(false);
      setCorrectionNote('');
      bankFormDirtyRef.current = false;
      hydratedBankKeyRef.current = null;
      setFeedback({ type: 'ok', text: res.message });
      await loadData(challenge.id, { forceSyncBankForm: true });
      await onChallengeStateUpdated?.();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to submit bank details.',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const effectiveNow = nowTickMs + serverOffsetMs;
  const crossedBoundariesRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    crossedBoundariesRef.current.clear();
  }, [
    challenge?.id,
    challenge?.settings.challengeOpenAt,
    challenge?.settings.examStartAt,
    challenge?.settings.examEndAt,
    challenge?.settings.winnerAnnouncementAt,
  ]);

  useEffect(() => {
    if (!challenge || !challenge.isActive || !selectedChallengeId) return;
    const transitions = [
      { key: `open:${challenge.settings.challengeOpenAt}`, ms: new Date(challenge.settings.challengeOpenAt).getTime() },
      { key: `start:${challenge.settings.examStartAt}`, ms: new Date(challenge.settings.examStartAt).getTime() },
      { key: `end:${challenge.settings.examEndAt}`, ms: new Date(challenge.settings.examEndAt).getTime() },
      {
        key: `announce:${challenge.settings.winnerAnnouncementAt}`,
        ms: new Date(challenge.settings.winnerAnnouncementAt).getTime(),
      },
    ];
    for (const tr of transitions) {
      if (Number.isNaN(tr.ms)) continue;
      if (
        effectiveNow >= tr.ms &&
        effectiveNow - tr.ms < 60_000 &&
        !crossedBoundariesRef.current.has(tr.key)
      ) {
        crossedBoundariesRef.current.add(tr.key);
        void loadData(selectedChallengeId, { background: true });
        if (!isBankFormFocusedRef.current && !isActiveFormInputFocused()) {
          void onChallengeStateUpdated?.();
        }
      }
    }
  }, [challenge, effectiveNow, selectedChallengeId, loadData, onChallengeStateUpdated]);

  const liveChallengeMeta = (() => {
    if (!challenge) {
      return {
        displayStatus: 'Upcoming' as const,
        canStartExam: false,
        canJoinWaitingRoom: false,
        unavailableReason: null as string | null,
        effectiveAnnounced: false,
      };
    }

    const tOpen = new Date(challenge.settings.challengeOpenAt).getTime();
    const tStart = new Date(challenge.settings.examStartAt).getTime();
    const tEnd = new Date(challenge.settings.examEndAt).getTime();
    const tAnnounce = new Date(challenge.settings.winnerAnnouncementAt).getTime();
    const tClose = challenge.settings.challengeCloseAt
      ? new Date(challenge.settings.challengeCloseAt).getTime()
      : null;

    const hasFutureOrLiveWindow = effectiveNow < tEnd || effectiveNow < tAnnounce;
    const effectiveAnnounced =
      challenge.hasWinner ||
      (Boolean(challenge.settings.winnerAnnouncedAt) && !hasFutureOrLiveWindow);

    let displayStatus = challenge.displayStatus;
    let canStartExam = challenge.canStartExam;
    let canJoinWaitingRoom = challenge.canJoinWaitingRoom;
    let unavailableReason = challenge.unavailableReason;

    if (
      challenge.isActive &&
      (challenge.lifecycleStatus === 'active' || challenge.lifecycleStatus === 'closed') &&
      !effectiveAnnounced &&
      (tClose === null || effectiveNow < tClose)
    ) {
      if (effectiveNow >= tStart && effectiveNow < tEnd) {
        displayStatus = 'Examination in Progress';
        canStartExam = challenge.publishedQuestionCount > 0;
        canJoinWaitingRoom = true;
        unavailableReason =
          challenge.publishedQuestionCount > 0
            ? null
            : 'No published challenge questions are available yet.';
      } else if (effectiveNow >= tOpen && effectiveNow < tStart) {
        displayStatus = 'Active';
        canStartExam = false;
        canJoinWaitingRoom = true;
        unavailableReason = `Examination begins ${formatWatDateTimeDisplay(challenge.settings.examStartAt)}. Please wait until the scheduled start time.`;
      } else if (effectiveNow < tOpen) {
        displayStatus = 'Upcoming';
        canStartExam = false;
        canJoinWaitingRoom = true;
        unavailableReason = `Challenge portal opens ${formatWatDateTimeDisplay(challenge.settings.challengeOpenAt)}.`;
      } else if (effectiveNow >= tEnd) {
        displayStatus = 'Examination Completed';
        canStartExam = false;
        canJoinWaitingRoom = true;
        unavailableReason = `Examination entry window closed ${formatWatDateTimeDisplay(challenge.settings.examEndAt)}. Results are being finalized.`;
      }
    }

    return {
      displayStatus,
      canStartExam,
      canJoinWaitingRoom,
      unavailableReason,
      effectiveAnnounced,
    };
  })();

  const getActiveCountdown = () => {
    if (!challenge) return null;
    const tOpen = new Date(challenge.settings.challengeOpenAt).getTime();
    const tStart = new Date(challenge.settings.examStartAt).getTime();
    const tEnd = new Date(challenge.settings.examEndAt).getTime();
    const tAnnounce = new Date(challenge.settings.winnerAnnouncementAt).getTime();

    if (liveChallengeMeta.displayStatus === 'Upcoming' && effectiveNow < tOpen) {
      return {
        label: 'Portal Opens In',
        remaining: formatCountdownMs(tOpen - effectiveNow),
      };
    }
    if (liveChallengeMeta.displayStatus === 'Active' && effectiveNow < tStart) {
      return {
        label: 'Examination Starts In',
        remaining: formatCountdownMs(tStart - effectiveNow),
      };
    }
    if (liveChallengeMeta.displayStatus === 'Examination in Progress' && effectiveNow < tEnd) {
      return {
        label: 'Entry Window Closes In',
        remaining: formatCountdownMs(tEnd - effectiveNow),
      };
    }
    if (
      liveChallengeMeta.displayStatus === 'Examination Completed' &&
      !liveChallengeMeta.effectiveAnnounced &&
      effectiveNow < tAnnounce
    ) {
      return {
        label: 'Winner Announcement In',
        remaining: formatCountdownMs(tAnnounce - effectiveNow),
      };
    }
    return null;
  };

  const countdown = getActiveCountdown();

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="bg-[#0b337a] text-white px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/15 text-amber-300 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight">
                ACADET REWARD CBT CHALLENGE
              </h1>
              <p className="text-xs text-blue-100 truncate">
                Timed academic competitions, live rankings, and verified winner payouts (Africa/Lagos WAT)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {challengesList.length > 1 && (
              <select
                value={selectedChallengeId}
                onChange={(e) => {
                  const id = e.target.value;
                  bankFormDirtyRef.current = false;
                  hydratedBankKeyRef.current = null;
                  setEditingBank(false);
                  setSelectedChallengeId(id);
                  setShowAnswersReview(false);
                  void loadData(id);
                }}
                aria-label="Select competition edition"
                className="rounded-xl bg-white/10 border border-white/25 text-white text-xs font-bold px-3 py-2 focus:outline-none"
              >
                {challengesList.map((c) => (
                  <option key={c.id} value={c.id} className="text-slate-900">
                    {c.title} ({c.displayStatus})
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => void loadData(selectedChallengeId)}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-extrabold inline-flex items-center gap-1.5 min-h-[38px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Navigation Sub-tabs */}
        <div className="px-4 py-2.5 bg-[#eff5ff] dark:bg-slate-800/70 border-b border-[#dce6f5] dark:border-slate-800 flex flex-wrap gap-1.5">
          {[
            { id: 'overview' as const, label: 'Challenge & Schedule', icon: Trophy },
            { id: 'leaderboard' as const, label: 'Leaderboard', icon: BarChart2 },
            { id: 'winner' as const, label: 'Winner & Claim Reward', icon: Award },
            { id: 'history' as const, label: `My History (${myHistory.length})`, icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = subView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubView(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 min-h-[38px] transition-colors ${
                  active
                    ? 'bg-[#0a58ed] text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-[#dce6f5] dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {submissionConfirmationMessage && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-emerald-900 dark:text-emerald-200 text-sm font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>{submissionConfirmationMessage}</span>
              </div>
              {onClearSubmissionConfirmation && (
                <button
                  type="button"
                  onClick={onClearSubmissionConfirmation}
                  className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300 underline shrink-0"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

          {startErrorNotice && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 text-xs sm:text-sm font-semibold text-red-700 dark:text-red-300 flex items-center justify-between gap-3">
              <span>{startErrorNotice}</span>
              {onClearStartErrorNotice && (
                <button
                  type="button"
                  onClick={onClearStartErrorNotice}
                  className="text-xs font-extrabold underline shrink-0"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

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

          {!challenge && subView !== 'history' ? (
            <div className="py-12 text-center space-y-2.5">
              <Trophy className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <div className="text-base font-extrabold text-slate-800 dark:text-white">
                No Active Reward CBT Challenge Yet
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                When the administrator schedules and activates an Acadet Reward CBT Challenge, its schedule, question count, prize reward, and start controls will appear here.
              </p>
            </div>
          ) : (
            <>
              {/* SUB-VIEW 1: CHALLENGE OVERVIEW & WAITING ROOM */}
              {subView === 'overview' && challenge && (
                <div className="space-y-4">
                  {/* Top Banner */}
                  <div className="rounded-2xl border border-[#c6daf7] dark:border-slate-700 bg-gradient-to-br from-[#eff5ff] to-white dark:from-slate-800/80 dark:to-slate-900 p-4 sm:p-5 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-extrabold ${getStatusStyles(liveChallengeMeta.displayStatus)}`}
                          >
                            {liveChallengeMeta.displayStatus}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-extrabold tabular-nums">
                            <Award className="w-3.5 h-3.5" />
                            Grand Prize: ₦{Math.round(challenge.rewardAmount).toLocaleString('en-NG')}
                          </span>
                        </div>
                        <h2 className="text-lg sm:text-2xl font-extrabold text-[#082252] dark:text-white">
                          {challenge.title}
                        </h2>
                        {challenge.description && (
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed">
                            {challenge.description}
                          </p>
                        )}
                      </div>

                      {countdown && (
                        <div className="rounded-xl bg-[#0b337a] text-white px-4 py-3 text-center shrink-0 min-w-[170px]">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                            {countdown.label}
                          </div>
                          <div className="text-xl font-extrabold font-mono tabular-nums mt-0.5">
                            {countdown.remaining}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Strip (positioned prominently above schedule metrics for mobile visibility) */}
                    <div className="pt-1 flex flex-wrap items-center gap-3">
                      {challenge.myParticipation.attempt?.status === 'in_progress' ? (
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() => void handleStartExam()}
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold inline-flex items-center gap-2 min-h-[44px] shadow-sm"
                        >
                          <Play className="w-4 h-4" />
                          <span>Resume Examination Now</span>
                        </button>
                      ) : challenge.myParticipation.attempt ? (
                        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-extrabold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>You have completed this challenge examination</span>
                        </div>
                      ) : liveChallengeMeta.canStartExam ? (
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() => void handleStartExam()}
                          className="px-5 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-sm font-extrabold inline-flex items-center gap-2 min-h-[44px] shadow-sm"
                        >
                          <Play className="w-4 h-4" />
                          <span>{busyAction ? 'Starting...' : 'START REWARD CBT CHALLENGE'}</span>
                        </button>
                      ) : liveChallengeMeta.canJoinWaitingRoom && !challenge.myParticipation.joined ? (
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() => void handleJoinChallenge()}
                          className="px-5 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-sm font-extrabold inline-flex items-center gap-2 min-h-[44px]"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{busyAction ? 'Joining...' : 'Join Challenge Portal'}</span>
                        </button>
                      ) : challenge.myParticipation.joined ? (
                        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-[#0b337a] dark:text-blue-200 text-xs sm:text-sm font-extrabold">
                          <Clock className="w-4 h-4" />
                          <span>Registered for this challenge — awaiting exam start</span>
                        </div>
                      ) : null}

                      {liveChallengeMeta.unavailableReason && !challenge.myParticipation.attempt && (
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {liveChallengeMeta.unavailableReason}
                        </span>
                      )}
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#0a58ed]" />
                          Exam Start (WAT)
                        </div>
                        <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                          {formatWatDateTimeDisplay(challenge.settings.examStartAt)}
                        </div>
                      </div>

                      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#0a58ed]" />
                          Exam Window Closes
                        </div>
                        <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                          {formatWatDateTimeDisplay(challenge.settings.examEndAt)}
                        </div>
                      </div>

                      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <FileCheck2 className="w-3.5 h-3.5 text-[#0a58ed]" />
                          Questions / Time
                        </div>
                        <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
                          {challenge.settings.questionCount} Qs · {challenge.settings.durationMinutes} mins
                        </div>
                      </div>

                      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-[#0a58ed]" />
                          Winner Announcement
                        </div>
                        <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                          {formatWatDateTimeDisplay(challenge.settings.winnerAnnouncementAt)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Student Attempt Score Summary */}
                  {challenge.myParticipation.result && (
                    <div className="rounded-2xl border border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm sm:text-base font-extrabold text-[#082252] dark:text-white">
                          Your Challenge Performance Summary
                        </h3>
                        {challenge.myParticipation.result.position && (
                          <span className="px-3 py-1 rounded-lg bg-[#eff5ff] dark:bg-blue-950/60 text-[#0b337a] dark:text-blue-200 text-xs font-extrabold tabular-nums">
                            Rank: #{challenge.myParticipation.result.position}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800 p-3 text-center">
                          <div className="text-xl font-extrabold text-[#0a58ed] dark:text-blue-400 tabular-nums">
                            {challenge.myParticipation.result.score}/
                            {challenge.myParticipation.result.totalQuestions}
                          </div>
                          <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                            Score ({challenge.myParticipation.result.percentage}%)
                          </div>
                        </div>
                        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3 text-center">
                          <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">
                            {challenge.myParticipation.result.correctAnswers}
                          </div>
                          <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
                            Correct
                          </div>
                        </div>
                        <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-center">
                          <div className="text-xl font-extrabold text-rose-700 dark:text-rose-300 tabular-nums">
                            {challenge.myParticipation.result.wrongAnswers}
                          </div>
                          <div className="text-[11px] font-bold text-rose-800 dark:text-rose-200">
                            Wrong
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-3 text-center">
                          <div className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">
                            {formatDurationSeconds(
                              challenge.myParticipation.result.completionTimeSeconds
                            )}
                          </div>
                          <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                            Completion Time
                          </div>
                        </div>
                      </div>

                      {!challenge.settings.winnerAnnouncedAt ? (
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Question answer keys and explanations remain hidden until the official winner announcement schedule to keep competition fair.
                          </span>
                        </div>
                      ) : (
                        reviewAttempt?.answersRevealed && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setShowAnswersReview((prev) => !prev)}
                              className="px-3.5 py-2 rounded-xl bg-[#0b337a] hover:bg-[#082252] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>
                                {showAnswersReview
                                  ? 'Hide Answer Review'
                                  : 'Review Official Questions & Answers'}
                              </span>
                            </button>
                          </div>
                        )
                      )}

                      {showAnswersReview && reviewAttempt?.answersRevealed && (
                        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                          {(reviewAttempt.questions as RewardChallengeGradedQuestion[]).map(
                            (q) => (
                              <div
                                key={q.questionId}
                                className={`rounded-xl border p-3.5 text-xs sm:text-sm space-y-2 ${
                                  q.isCorrect
                                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20'
                                    : 'border-rose-200 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20'
                                }`}
                              >
                                <div className="font-extrabold text-slate-900 dark:text-white">
                                  Q{q.order}. {q.questionText}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                                  {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                                    const optText =
                                      letter === 'A'
                                        ? q.optionA
                                        : letter === 'B'
                                          ? q.optionB
                                          : letter === 'C'
                                            ? q.optionC
                                            : q.optionD;
                                    const isCorr = q.correctOption === letter;
                                    const isPicked = q.selectedOption === letter;
                                    return (
                                      <div
                                        key={letter}
                                        className={`px-2.5 py-1.5 rounded-lg border ${
                                          isCorr
                                            ? 'border-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 font-bold text-emerald-900 dark:text-emerald-200'
                                            : isPicked
                                              ? 'border-rose-400 bg-rose-100/70 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200'
                                              : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                        }`}
                                      >
                                        {letter}. {optText}
                                        {isCorr ? ' ✓' : isPicked ? ' (Your pick)' : ''}
                                      </div>
                                    );
                                  })}
                                </div>
                                {q.explanation && (
                                  <div className="text-xs text-slate-600 dark:text-slate-300">
                                    <strong>Explanation:</strong> {q.explanation}
                                  </div>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SUB-VIEW 2: LEADERBOARD */}
              {subView === 'leaderboard' && challenge && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-extrabold text-[#082252] dark:text-white">
                        {challenge.title} — Leaderboard
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Ranked strictly by highest score, then fastest completion time, then earliest submission.
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-extrabold border ${
                        leaderboard?.isFinal
                          ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-amber-300'
                      }`}
                    >
                      {leaderboard?.isFinal ? 'Official Final Leaderboard' : 'Provisional Live Ranking'}
                    </span>
                  </div>

                  {leaderboard?.winner && (
                    <div className="rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-slate-900 border border-amber-300 dark:border-amber-700 p-3.5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Trophy className="w-6 h-6 text-amber-500 shrink-0" />
                        <div className="text-xs sm:text-sm">
                          <div className="font-extrabold text-amber-950 dark:text-amber-200">
                            1st Place Official Winner: {leaderboard.winner.studentName}
                          </div>
                          <div className="text-amber-800 dark:text-amber-300 font-semibold">
                            Score: {leaderboard.winner.score}/{leaderboard.winner.totalQuestions} (
                            {leaderboard.winner.percentage}%) · Time:{' '}
                            {formatDurationSeconds(leaderboard.winner.completionTimeSeconds)}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSubView('winner')}
                        className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold"
                      >
                        {leaderboard.winner.isCurrentUserWinner
                          ? 'Claim Your Reward'
                          : 'View Winner Details'}
                      </button>
                    </div>
                  )}

                  {!leaderboard || leaderboard.entries.length === 0 ? (
                    <div className="py-10 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      No submitted competition results recorded yet. Rankings appear immediately as candidates submit.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-[#eff5ff] dark:bg-slate-800 text-[#082252] dark:text-white font-extrabold border-b border-slate-200 dark:border-slate-700">
                            <th className="py-3 px-3.5">Pos</th>
                            <th className="py-3 px-3.5">Candidate</th>
                            <th className="py-3 px-3.5">Score</th>
                            <th className="py-3 px-3.5">Completion Time</th>
                            <th className="py-3 px-3.5">Submitted At (WAT)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {leaderboard.entries.map((entry) => (
                            <tr
                              key={entry.studentId}
                              className={
                                entry.isCurrentUser
                                  ? 'bg-blue-50/80 dark:bg-blue-950/40 font-bold'
                                  : entry.position === 1
                                    ? 'bg-amber-50/60 dark:bg-amber-950/20'
                                    : 'bg-white dark:bg-slate-900'
                              }
                            >
                              <td className="py-3 px-3.5 tabular-nums font-extrabold">
                                <span className="inline-flex items-center gap-1.5">
                                  {entry.position === 1 && (
                                    <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                                  )}
                                  #{entry.position}
                                </span>
                              </td>
                              <td className="py-3 px-3.5 text-slate-900 dark:text-white font-bold">
                                {entry.studentName}
                                {entry.isCurrentUser && (
                                  <span className="ml-2 px-1.5 py-0.5 rounded bg-[#0a58ed] text-white text-[10px] font-extrabold">
                                    YOU
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3.5 tabular-nums font-extrabold text-[#0b337a] dark:text-blue-300">
                                {entry.score}/{entry.totalQuestions} ({entry.percentage}%)
                              </td>
                              <td className="py-3 px-3.5 tabular-nums text-slate-700 dark:text-slate-300">
                                {formatDurationSeconds(entry.completionTimeSeconds)}
                              </td>
                              <td className="py-3 px-3.5 text-xs text-slate-600 dark:text-slate-400">
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

              {/* SUB-VIEW 3: WINNER ANNOUNCEMENT & REWARD CLAIM */}
              {subView === 'winner' && challenge && (
                <div className="space-y-4">
                  {challenge.winner ? (
                    <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50 via-yellow-50/60 to-white dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900 p-5 text-center space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white mx-auto flex items-center justify-center shadow-md">
                        <Trophy className="w-8 h-8" />
                      </div>
                      <div className="text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                        CONGRATULATIONS!
                      </div>
                      <div className="text-sm sm:text-base font-extrabold text-[#0b337a] dark:text-amber-200">
                        🏆 ACADET REWARD CBT CHALLENGE WINNER
                      </div>
                      <h3 className="text-xl sm:text-2xl font-extrabold text-[#082252] dark:text-white">
                        Winner&apos;s Name: {challenge.winner.studentName}
                      </h3>
                      <div className="flex flex-wrap justify-center gap-3 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                        <span>Position: 1st Place</span>
                        <span>·</span>
                        <span className="tabular-nums">
                          Score: {challenge.winner.score}/{challenge.winner.totalQuestions} (
                          {challenge.winner.percentage}%)
                        </span>
                        <span>·</span>
                        <span className="tabular-nums">
                          Completion Time:{' '}
                          {formatDurationSeconds(challenge.winner.completionTimeSeconds)}
                        </span>
                        <span>·</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">
                          Prize: ₦{Math.round(challenge.winner.rewardAmount).toLocaleString('en-NG')}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 max-w-lg mx-auto font-medium">
                        Congratulations on topping the official Acadet Reward CBT Challenge leaderboard!
                      </p>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Announced: {formatWatDateTimeDisplay(challenge.winner.announcedAt)}
                      </div>
                    </div>
                  ) : challenge.noValidParticipants ? (
                    <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-6 text-center space-y-2">
                      <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                      <div className="text-base font-extrabold text-slate-800 dark:text-white">
                        Challenge Completed — No Valid Submissions
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                        The scheduled examination period ended with zero valid submitted attempts, so no winner was declared for this edition.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#c6daf7] dark:border-slate-800 bg-[#eff5ff]/70 dark:bg-slate-800/40 p-6 text-center space-y-2">
                      <Clock className="w-8 h-8 text-[#0a58ed] mx-auto" />
                      <div className="text-base font-extrabold text-[#082252] dark:text-white">
                        Winner Announcement Pending
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                        The official 1st Place winner will be automatically verified and announced on{' '}
                        <strong>
                          {formatWatDateTimeDisplay(challenge.settings.winnerAnnouncementAt)}
                        </strong>
                        .
                      </p>
                    </div>
                  )}

                  {/* Winner-Only Bank Details & Payment Status */}
                  {challenge.myParticipation.isWinner && (
                    <div className="rounded-2xl border border-[#9dc0f5] dark:border-blue-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                      <div className="bg-[#0b337a] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 font-extrabold text-sm sm:text-base">
                          <CreditCard className="w-5 h-5 text-amber-300" />
                          <span>CLAIM YOUR REWARD</span>
                        </div>
                        {challenge.myParticipation.myPayment && (
                          <span
                            className={`px-2.5 py-0.5 rounded-md border text-[11px] font-extrabold ${
                              getPaymentStatusBadge(
                                challenge.myParticipation.myPayment.paymentStatus
                              ).cls
                            }`}
                          >
                            {
                              getPaymentStatusBadge(
                                challenge.myParticipation.myPayment.paymentStatus
                              ).label
                            }
                          </span>
                        )}
                      </div>

                      <div className="p-5 space-y-4">
                        <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 leading-relaxed">
                          Congratulations on winning the Acadet Reward CBT Challenge! Please provide your bank details below so the administrator can process your reward.
                        </p>
                        {challenge.myParticipation.myPayment?.paymentStatus ===
                          'payment_completed' && (
                          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 p-4 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 space-y-1">
                            <div className="font-extrabold flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-emerald-600" />
                              Reward Payment Completed
                            </div>
                            <p>
                              Paid on{' '}
                              <strong>
                                {formatWatDateTimeDisplay(
                                  challenge.myParticipation.myPayment.paidAt
                                )}
                              </strong>
                              {challenge.myParticipation.myPayment.paymentReference && (
                                <>
                                  {' '}
                                  · Ref:{' '}
                                  <span className="font-mono">
                                    {challenge.myParticipation.myPayment.paymentReference}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        )}

                        {challenge.myParticipation.myBankDetails && !editingBank ? (
                          <div className="space-y-3">
                            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
                              <div>
                                <div className="text-[11px] font-bold text-slate-500">Bank Name</div>
                                <div className="font-extrabold text-slate-900 dark:text-white mt-0.5">
                                  {challenge.myParticipation.myBankDetails.bankName}
                                </div>
                              </div>
                              <div>
                                <div className="text-[11px] font-bold text-slate-500">
                                  Account Number
                                </div>
                                <div className="font-extrabold font-mono text-slate-900 dark:text-white mt-0.5">
                                  {challenge.myParticipation.myBankDetails.accountNumber}
                                </div>
                              </div>
                              <div>
                                <div className="text-[11px] font-bold text-slate-500">
                                  Account Name
                                </div>
                                <div className="font-extrabold text-slate-900 dark:text-white mt-0.5">
                                  {challenge.myParticipation.myBankDetails.accountName}
                                </div>
                              </div>
                            </div>

                            {!challenge.myParticipation.myBankDetails.editLocked &&
                              challenge.myParticipation.myPayment?.paymentStatus !==
                                'payment_completed' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (challenge.myParticipation.myBankDetails) {
                                      setBankName(challenge.myParticipation.myBankDetails.bankName);
                                      setAccountNumber(
                                        challenge.myParticipation.myBankDetails.accountNumber
                                      );
                                      setAccountName(
                                        challenge.myParticipation.myBankDetails.accountName
                                      );
                                    }
                                    bankFormDirtyRef.current = false;
                                    setEditingBank(true);
                                  }}
                                  className="px-3.5 py-2 rounded-xl border border-[#9dc0f5] text-[#0b337a] dark:text-blue-300 text-xs font-extrabold hover:bg-blue-50 dark:hover:bg-slate-800"
                                >
                                  Request Controlled Bank Account Correction Before Payout
                                </button>
                              )}
                          </div>
                        ) : (
                          <form
                            onSubmit={handleSubmitBankDetails}
                            onFocusCapture={() => {
                              isBankFormFocusedRef.current = true;
                            }}
                            onBlurCapture={(e) => {
                              const nextTarget = e.relatedTarget as Node | null;
                              if (!nextTarget || !e.currentTarget.contains(nextTarget)) {
                                isBankFormFocusedRef.current = false;
                              }
                            }}
                            className="space-y-3"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                  Bank Name
                                </label>
                                <div className="relative">
                                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                  <input
                                    type="text"
                                    required
                                    value={bankName}
                                    onChange={(e) => {
                                      bankFormDirtyRef.current = true;
                                      setBankName(e.target.value);
                                    }}
                                    placeholder="e.g. Access Bank / OPay"
                                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2.5 text-sm font-semibold"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                  10-Digit Account Number
                                </label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  required
                                  maxLength={10}
                                  pattern="\d{10}"
                                  value={accountNumber}
                                  onChange={(e) => {
                                    bankFormDirtyRef.current = true;
                                    setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10));
                                  }}
                                  placeholder="0123456789"
                                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm font-mono font-bold"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                  Account Name
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={accountName}
                                  onChange={(e) => {
                                    bankFormDirtyRef.current = true;
                                    setAccountName(e.target.value);
                                  }}
                                  placeholder="Full name on account"
                                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm font-semibold"
                                />
                              </div>
                            </div>

                            {challenge.myParticipation.myBankDetails && (
                              <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                  Reason for Correction (Required)
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={correctionNote}
                                  onChange={(e) => {
                                    bankFormDirtyRef.current = true;
                                    setCorrectionNote(e.target.value);
                                  }}
                                  placeholder="Explain why bank details are being corrected before payout"
                                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                                />
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="submit"
                                disabled={busyAction}
                                className="px-4 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold"
                              >
                                {busyAction ? 'Submitting...' : 'Submit Bank Details'}
                              </button>
                              {editingBank && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    bankFormDirtyRef.current = false;
                                    setCorrectionNote('');
                                    if (challenge.myParticipation.myBankDetails) {
                                      setBankName(challenge.myParticipation.myBankDetails.bankName);
                                      setAccountNumber(
                                        challenge.myParticipation.myBankDetails.accountNumber
                                      );
                                      setAccountName(
                                        challenge.myParticipation.myBankDetails.accountName
                                      );
                                    }
                                    setEditingBank(false);
                                  }}
                                  className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </form>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SUB-VIEW 4: STUDENT PARTICIPATION & REWARD HISTORY */}
              {subView === 'history' && (
                <div className="space-y-3">
                  <h3 className="text-base font-extrabold text-[#082252] dark:text-white">
                    My Acadet Reward CBT Challenge History
                  </h3>
                  {myHistory.length === 0 ? (
                    <div className="py-10 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs sm:text-sm text-slate-500">
                      You have not participated in any Reward CBT Challenge yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-[#eff5ff] dark:bg-slate-800 text-[#082252] dark:text-white font-extrabold border-b border-slate-200 dark:border-slate-700">
                            <th className="py-3 px-3.5">Competition</th>
                            <th className="py-3 px-3.5">Score</th>
                            <th className="py-3 px-3.5">Rank</th>
                            <th className="py-3 px-3.5">Time</th>
                            <th className="py-3 px-3.5">Prize & Payout Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {myHistory.map((h) => (
                            <tr key={h.attemptId} className="bg-white dark:bg-slate-900">
                              <td className="py-3 px-3.5 font-extrabold text-slate-900 dark:text-white">
                                <button
                                  type="button"
                                  onClick={() => {
                                    bankFormDirtyRef.current = false;
                                    hydratedBankKeyRef.current = null;
                                    setEditingBank(false);
                                    setSelectedChallengeId(h.challengeId);
                                    setSubView('overview');
                                    void loadData(h.challengeId);
                                  }}
                                  className="text-left hover:text-[#0a58ed] hover:underline"
                                >
                                  {h.challengeTitle}
                                </button>
                              </td>
                              <td className="py-3 px-3.5 tabular-nums font-bold">
                                {h.score !== null ? `${h.score}/${h.totalQuestions} (${h.percentage}%)` : h.status}
                              </td>
                              <td className="py-3 px-3.5 tabular-nums font-bold">
                                {h.position ? `#${h.position}` : '—'}
                              </td>
                              <td className="py-3 px-3.5 tabular-nums">
                                {formatDurationSeconds(h.completionTimeSeconds)}
                              </td>
                              <td className="py-3 px-3.5">
                                {h.isWinner ? (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-xs font-extrabold">
                                      Winner (₦{Math.round(h.rewardAmount).toLocaleString('en-NG')})
                                    </span>
                                    {h.paymentStatus && (
                                      <span
                                        className={`px-2 py-0.5 rounded border text-[11px] font-extrabold ${
                                          getPaymentStatusBadge(h.paymentStatus).cls
                                        }`}
                                      >
                                        {getPaymentStatusBadge(h.paymentStatus).label}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-500 text-xs">Participant</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
