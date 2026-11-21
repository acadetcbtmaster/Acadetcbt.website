import {
  Award,
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  FileQuestion,
  Play,
  Trophy,
} from 'lucide-react';
import React from 'react';
import type { RewardChallengeDisplayStatus, RewardChallengeSummary } from '../../types/cbt';

interface RewardChallengeDashboardCardProps {
  challenge: RewardChallengeSummary | null;
  loading?: boolean;
  starting?: boolean;
  onStartChallenge: (challengeId: string) => void;
  onOpenChallengeHub: (initialView?: 'overview' | 'leaderboard' | 'winner') => void;
}

export function formatWatDateTimeDisplay(iso: string | null | undefined): string {
  if (!iso) return 'Not scheduled';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return (
    new Intl.DateTimeFormat('en-NG', {
      timeZone: 'Africa/Lagos',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date) + ' WAT'
  );
}

export function getStatusStyles(status: RewardChallengeDisplayStatus): string {
  switch (status) {
    case 'Examination in Progress':
      return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700';
    case 'Active':
      return 'bg-blue-100 dark:bg-blue-950/60 text-[#0b337a] dark:text-blue-200 border-[#9dc0f5] dark:border-blue-700';
    case 'Winner Announced':
      return 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700';
    case 'Examination Completed':
      return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700';
    case 'Challenge Closed':
      return 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800';
    default:
      return 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800';
  }
}

export const RewardChallengeDashboardCard: React.FC<RewardChallengeDashboardCardProps> = ({
  challenge,
  loading = false,
  starting = false,
  onStartChallenge,
  onOpenChallengeHub,
}) => {
  if (loading && !challenge) {
    return (
      <section className="rounded-2xl border border-[#c6daf7] dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4 shadow-sm animate-pulse">
        <div className="h-5 w-56 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
        <div className="h-4 w-72 bg-slate-100 dark:bg-slate-800 rounded" />
      </section>
    );
  }

  if (!challenge) {
    return (
      <section className="rounded-2xl border border-[#c6daf7] dark:border-slate-700 bg-gradient-to-r from-white via-[#f7faff] to-[#eff5ff] dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/30 px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#0b337a] text-amber-300 flex items-center justify-center shrink-0 shadow-xs">
            <Trophy className="w-6 h-6" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-[#082252] dark:text-white">
                Acadet Reward CBT Challenge
              </h2>
              <span className="px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-200 text-[11px] font-extrabold">
                Upcoming
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
              Compete in timed academic examinations, climb the live leaderboard, and win cash rewards. Next competition schedule will appear here once published.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onOpenChallengeHub('overview')}
            className="px-3.5 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold inline-flex items-center gap-1.5 min-h-[40px]"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Start Challenge</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenChallengeHub('leaderboard')}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#9dc0f5] dark:border-slate-700 text-[#0b337a] dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-slate-700 text-xs font-extrabold inline-flex items-center gap-1.5 min-h-[40px]"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Leaderboard</span>
          </button>
        </div>
      </section>
    );
  }

  const attempt = challenge.myParticipation.attempt;
  const isInProgress = attempt?.status === 'in_progress';
  const isSubmitted =
    attempt?.status === 'submitted' || attempt?.status === 'auto_submitted';
  const rewardLabel = `₦${Math.round(challenge.rewardAmount).toLocaleString('en-NG')}`;

  return (
    <section
      data-testid="reward-challenge-dashboard-card"
      className="rounded-2xl border border-[#9dc0f5] dark:border-blue-800/80 bg-gradient-to-r from-white via-[#f5f9ff] to-[#e8f1ff] dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/50 px-4 py-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm"
    >
      <div className="flex items-start gap-3.5 min-w-0">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0b337a] to-[#0a58ed] text-amber-300 flex items-center justify-center shrink-0 shadow-sm">
          <Trophy className="w-6 h-6" />
        </div>

        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0a58ed] dark:text-blue-300">
              ACADET REWARD CBT CHALLENGE
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-extrabold ${getStatusStyles(challenge.displayStatus)}`}
            >
              {challenge.displayStatus}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-[11px] font-extrabold tabular-nums">
              <Award className="w-3 h-3" />
              Reward: {rewardLabel}
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-extrabold text-[#082252] dark:text-white leading-snug">
            {challenge.title}
          </h2>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#0a58ed] shrink-0" />
              <span>Exam Start: {formatWatDateTimeDisplay(challenge.settings.examStartAt)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <FileQuestion className="w-3.5 h-3.5 text-[#0a58ed] shrink-0" />
              <span>{challenge.settings.questionCount} Questions</span>
            </span>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Clock className="w-3.5 h-3.5 text-[#0a58ed] shrink-0" />
              <span>{challenge.settings.durationMinutes} Mins</span>
            </span>
          </div>

          {challenge.hasWinner && challenge.winner && (
            <div className="text-xs font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 pt-0.5">
              <Trophy className="w-3.5 h-3.5 shrink-0" />
              <span>
                {challenge.winner.isCurrentUserWinner
                  ? 'Congratulations! You won this challenge — submit your bank details to claim your reward.'
                  : `Winner Announced: ${challenge.winner.studentName} (${challenge.winner.score}/${challenge.winner.totalQuestions})`}
              </span>
            </div>
          )}

          {!challenge.hasWinner && isSubmitted && (
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 pt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                Exam submitted — your score and live ranking are available in the Challenge Hub.
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
        {isInProgress ? (
          <button
            type="button"
            disabled={starting}
            onClick={() => onStartChallenge(challenge.id)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-1.5 min-h-[42px] shadow-xs transition-colors"
          >
            <Play className="w-4 h-4" />
            <span>{starting ? 'Resuming...' : 'Resume Challenge'}</span>
          </button>
        ) : challenge.canStartExam && !isSubmitted ? (
          <button
            type="button"
            disabled={starting}
            onClick={() => onStartChallenge(challenge.id)}
            className="px-4 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-1.5 min-h-[42px] shadow-xs transition-colors"
          >
            <Play className="w-4 h-4" />
            <span>{starting ? 'Starting...' : 'Start Challenge'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              onOpenChallengeHub(challenge.hasWinner ? 'winner' : 'overview')
            }
            className="px-4 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-1.5 min-h-[42px] shadow-xs transition-colors"
          >
            <Trophy className="w-4 h-4" />
            <span>
              {challenge.winner?.isCurrentUserWinner
                ? 'Claim Reward'
                : isSubmitted
                  ? 'Challenge Status'
                  : 'Start Challenge'}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onOpenChallengeHub('leaderboard')}
          className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-[#9dc0f5] dark:border-slate-700 text-[#0b337a] dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-slate-700 text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-1.5 min-h-[42px] transition-colors"
        >
          <BarChart2 className="w-4 h-4 text-[#0a58ed] dark:text-blue-400" />
          <span>Leaderboard</span>
        </button>
      </div>
    </section>
  );
};
