import type { PoolClient } from 'pg';
import { getPool, isDatabaseConfigured } from '../../db/index.js';
import { ensureMigrated } from '../../db/migrate.js';
import { syncChallengeAutomations } from './rewardChallenge.js';

const SCHEDULER_LOCK_KEY = 82749103;
const INTERVAL_MS = 15_000;

let timerHandle: NodeJS.Timeout | null = null;
let isTickRunning = false;

async function runSchedulerTick(): Promise<void> {
  if (!isDatabaseConfigured() || isTickRunning) return;
  isTickRunning = true;

  let lockClient: PoolClient | null = null;
  try {
    await ensureMigrated();
    const pool = getPool();
    lockClient = await pool.connect();

    const lockRes = await lockClient.query<{ acquired: boolean }>(
      `SELECT pg_try_advisory_lock($1) AS acquired`,
      [SCHEDULER_LOCK_KEY]
    );
    if (!lockRes.rows[0]?.acquired) {
      return;
    }

    try {
      await syncChallengeAutomations();
    } finally {
      await lockClient.query(`SELECT pg_advisory_unlock($1)`, [SCHEDULER_LOCK_KEY]).catch(() => {
        // Ignore unlock errors on closing connection
      });
    }
  } catch (err) {
    console.error('[RewardChallengeScheduler]', err instanceof Error ? err.message : err);
  } finally {
    if (lockClient) {
      lockClient.release();
    }
    isTickRunning = false;
  }
}

export function startRewardChallengeScheduler(): () => void {
  if (timerHandle) {
    return () => stopRewardChallengeScheduler();
  }

  void runSchedulerTick();
  timerHandle = setInterval(() => {
    void runSchedulerTick();
  }, INTERVAL_MS);

  if (typeof timerHandle.unref === 'function') {
    timerHandle.unref();
  }

  console.log('[Acadet CBT] Reward Challenge automated scheduler active (15s cadence, Africa/Lagos WAT)');
  return () => stopRewardChallengeScheduler();
}

export function stopRewardChallengeScheduler(): void {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
}
