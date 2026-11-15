import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getPool } from '../../db/index.js';

export const PASSWORD_RESET_TTL_MINUTES = 20;
export const EMAIL_VERIFICATION_TTL_HOURS = 24;

const RESET_WINDOW_MS = 15 * 60 * 1000;
const RESET_MAX_PER_EMAIL = 3;
const RESET_MAX_PER_IP = 8;
const RESET_COOLDOWN_MS = 45 * 1000;

const VERIFY_WINDOW_MS = 15 * 60 * 1000;
const VERIFY_MAX_PER_EMAIL = 4;
const VERIFY_COOLDOWN_MS = 60 * 1000;

const memoryBuckets = new Map<string, number[]>();

export function generateRawAuthToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashAuthToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

export function validateNewPasswordStrength(password: string): {
  valid: boolean;
  message?: string;
} {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (password.length > 128) {
    return { valid: false, message: 'Password must not exceed 128 characters.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must include at least one lowercase letter.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must include at least one uppercase letter.' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, message: 'Password must include at least one number.' };
  }
  return { valid: true };
}

function checkMemoryRateLimit(
  key: string,
  windowMs: number,
  maxHits: number,
  cooldownMs: number
): { allowed: boolean; retryAfterSeconds?: number; reason?: string } {
  const now = Date.now();
  const hits = (memoryBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
  if (hits.length > 0 && now - hits[hits.length - 1] < cooldownMs) {
    const retryAfterSeconds = Math.ceil((cooldownMs - (now - hits[hits.length - 1])) / 1000);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
      reason: `Please wait ${Math.max(1, retryAfterSeconds)} seconds before requesting another email.`,
    };
  }
  if (hits.length >= maxHits) {
    const oldest = hits[0];
    const retryAfterSeconds = Math.ceil((windowMs - (now - oldest)) / 1000);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
      reason: 'Too many requests. Please wait a few minutes before trying again.',
    };
  }
  return { allowed: true };
}

function recordMemoryHit(key: string, windowMs: number): void {
  const now = Date.now();
  const hits = (memoryBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
  hits.push(now);
  memoryBuckets.set(key, hits);
}

export async function checkPasswordResetRateLimit(params: {
  email: string;
  ipAddress?: string;
}): Promise<{ allowed: boolean; retryAfterSeconds?: number; message?: string }> {
  const normEmail = params.email.trim().toLowerCase();
  const ip = (params.ipAddress || '').trim();

  const memEmail = checkMemoryRateLimit(
    `reset:email:${normEmail}`,
    RESET_WINDOW_MS,
    RESET_MAX_PER_EMAIL,
    RESET_COOLDOWN_MS
  );
  if (!memEmail.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: memEmail.retryAfterSeconds,
      message: memEmail.reason,
    };
  }

  if (ip) {
    const memIp = checkMemoryRateLimit(
      `reset:ip:${ip}`,
      RESET_WINDOW_MS,
      RESET_MAX_PER_IP,
      1000
    );
    if (!memIp.allowed) {
      return {
        allowed: false,
        retryAfterSeconds: memIp.retryAfterSeconds,
        message: 'Too many password recovery attempts from your connection. Please try again later.',
      };
    }
  }

  const pool = getPool();
  if (ip) {
    const ipCountRes = await pool.query<{ cnt: number }>(
      `SELECT COUNT(*)::int AS cnt
       FROM password_reset_tokens
       WHERE request_ip = $1 AND created_at >= NOW() - INTERVAL '15 minutes'`,
      [ip]
    );
    if (Number(ipCountRes.rows[0]?.cnt ?? 0) >= RESET_MAX_PER_IP) {
      return {
        allowed: false,
        retryAfterSeconds: 300,
        message: 'Too many password recovery attempts from your connection. Please try again later.',
      };
    }
  }

  const userDbRes = await pool.query<{ cnt: number; lastCreated: Date | null }>(
    `SELECT COUNT(*)::int AS cnt, MAX(prt.created_at) AS "lastCreated"
     FROM password_reset_tokens prt
     JOIN users u ON u.id = prt.user_id
     WHERE LOWER(u.email) = $1
       AND prt.created_at >= NOW() - INTERVAL '15 minutes'`,
    [normEmail]
  );

  const dbRow = userDbRes.rows[0];
  if (dbRow?.lastCreated) {
    const elapsedMs = Date.now() - new Date(dbRow.lastCreated).getTime();
    if (elapsedMs < RESET_COOLDOWN_MS) {
      const wait = Math.max(1, Math.ceil((RESET_COOLDOWN_MS - elapsedMs) / 1000));
      return {
        allowed: false,
        retryAfterSeconds: wait,
        message: `Please wait ${wait} seconds before requesting another reset link.`,
      };
    }
  }
  if (Number(dbRow?.cnt ?? 0) >= RESET_MAX_PER_EMAIL) {
    return {
      allowed: false,
      retryAfterSeconds: 300,
      message: 'Too many password reset requests. Please wait a few minutes and check your inbox.',
    };
  }

  return { allowed: true };
}

export function recordPasswordResetRateHit(params: { email: string; ipAddress?: string }): void {
  const normEmail = params.email.trim().toLowerCase();
  recordMemoryHit(`reset:email:${normEmail}`, RESET_WINDOW_MS);
  if (params.ipAddress?.trim()) {
    recordMemoryHit(`reset:ip:${params.ipAddress.trim()}`, RESET_WINDOW_MS);
  }
}

export async function checkVerificationResendRateLimit(params: {
  email: string;
  userId?: string;
}): Promise<{ allowed: boolean; retryAfterSeconds?: number; message?: string }> {
  const normEmail = params.email.trim().toLowerCase();
  const mem = checkMemoryRateLimit(
    `verify:email:${normEmail}`,
    VERIFY_WINDOW_MS,
    VERIFY_MAX_PER_EMAIL,
    VERIFY_COOLDOWN_MS
  );
  if (!mem.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: mem.retryAfterSeconds,
      message: mem.reason,
    };
  }

  const pool = getPool();
  const res = await pool.query<{ cnt: number; lastCreated: Date | null }>(
    `SELECT COUNT(*)::int AS cnt, MAX(created_at) AS "lastCreated"
     FROM email_verification_tokens
     WHERE ${params.userId ? 'user_id = $1' : 'LOWER(email) = $1'}
       AND created_at >= NOW() - INTERVAL '15 minutes'`,
    [params.userId || normEmail]
  );

  const row = res.rows[0];
  if (row?.lastCreated) {
    const elapsedMs = Date.now() - new Date(row.lastCreated).getTime();
    if (elapsedMs < VERIFY_COOLDOWN_MS) {
      const wait = Math.max(1, Math.ceil((VERIFY_COOLDOWN_MS - elapsedMs) / 1000));
      return {
        allowed: false,
        retryAfterSeconds: wait,
        message: `Please wait ${wait} seconds before resending another verification email.`,
      };
    }
  }
  if (Number(row?.cnt ?? 0) >= VERIFY_MAX_PER_EMAIL) {
    return {
      allowed: false,
      retryAfterSeconds: 300,
      message: 'Too many verification emails requested. Please try again in a few minutes.',
    };
  }

  return { allowed: true };
}

export function recordVerificationResendHit(email: string): void {
  recordMemoryHit(`verify:email:${email.trim().toLowerCase()}`, VERIFY_WINDOW_MS);
}

export async function issuePasswordResetToken(params: {
  userId: string;
  requestIp?: string;
}): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = generateRawAuthToken();
  const tokenHash = hashAuthToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Automatically clean/invalidate stale or previously unused tokens for this user
    await client.query(
      `UPDATE password_reset_tokens
       SET invalidated_at = NOW()
       WHERE used_at IS NULL
         AND invalidated_at IS NULL
         AND (user_id = $1 OR expires_at <= NOW())`,
      [params.userId]
    );

    await client.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, request_ip)
       VALUES ($1, $2, $3, $4)`,
      [params.userId, tokenHash, expiresAt, params.requestIp || null]
    );

    await client.query('COMMIT');
    return { rawToken, expiresAt };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function issueEmailVerificationToken(params: {
  userId: string;
  email: string;
  requestIp?: string;
}): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = generateRawAuthToken();
  const tokenHash = hashAuthToken(rawToken);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Automatically invalidate prior unconsumed tokens & expired tokens
    await client.query(
      `UPDATE email_verification_tokens
       SET invalidated_at = NOW()
       WHERE used_at IS NULL
         AND invalidated_at IS NULL
         AND (user_id = $1 OR expires_at <= NOW())`,
      [params.userId]
    );

    await client.query(
      `INSERT INTO email_verification_tokens (user_id, token_hash, email, expires_at, request_ip)
       VALUES ($1, $2, $3, $4, $5)`,
      [params.userId, tokenHash, params.email.toLowerCase(), expiresAt, params.requestIp || null]
    );

    await client.query('COMMIT');
    return { rawToken, expiresAt };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export type TokenValidationStatus =
  | 'valid'
  | 'invalid'
  | 'expired'
  | 'already_used'
  | 'suspended';

export async function inspectPasswordResetToken(rawToken: string): Promise<{
  status: TokenValidationStatus;
  expiresAt?: string;
}> {
  const trimmed = rawToken.trim();
  if (!trimmed || trimmed.length < 20) {
    return { status: 'invalid' };
  }

  const tokenHash = hashAuthToken(trimmed);
  const pool = getPool();
  const res = await pool.query<{
    usedAt: Date | null;
    invalidatedAt: Date | null;
    expiresAt: Date;
    isActive: boolean;
    accountStatus: string;
  }>(
    `SELECT
       prt.used_at AS "usedAt",
       prt.invalidated_at AS "invalidatedAt",
       prt.expires_at AS "expiresAt",
       u.is_active AS "isActive",
       u.account_status AS "accountStatus"
     FROM password_reset_tokens prt
     JOIN users u ON u.id = prt.user_id
     WHERE prt.token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );

  const row = res.rows[0];
  if (!row) {
    return { status: 'invalid' };
  }
  if (row.usedAt) {
    return { status: 'already_used' };
  }
  if (row.invalidatedAt || new Date(row.expiresAt).getTime() <= Date.now()) {
    return { status: 'expired' };
  }
  if (!row.isActive || row.accountStatus === 'suspended') {
    return { status: 'suspended' };
  }
  return {
    status: 'valid',
    expiresAt: new Date(row.expiresAt).toISOString(),
  };
}

export async function consumePasswordResetToken(params: {
  rawToken: string;
  newPassword: string;
  usedIp?: string;
}): Promise<
  | {
      ok: true;
      user: {
        id: string;
        fullName: string;
        email: string;
      };
    }
  | {
      ok: false;
      code: 'INVALID_TOKEN' | 'TOKEN_ALREADY_USED' | 'TOKEN_EXPIRED' | 'ACCOUNT_SUSPENDED';
      message: string;
    }
> {
  const trimmed = params.rawToken.trim();
  if (!trimmed || trimmed.length < 20) {
    return {
      ok: false,
      code: 'INVALID_TOKEN',
      message: 'This password reset link is invalid.',
    };
  }

  const tokenHash = hashAuthToken(trimmed);
  const passwordHash = await bcrypt.hash(params.newPassword, 12);
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const lockRes = await client.query<{
      tokenId: string;
      userId: string;
      expiresAt: Date;
      usedAt: Date | null;
      invalidatedAt: Date | null;
      fullName: string;
      email: string;
      isActive: boolean;
      accountStatus: string;
    }>(
      `SELECT
         prt.id AS "tokenId",
         prt.user_id AS "userId",
         prt.expires_at AS "expiresAt",
         prt.used_at AS "usedAt",
         prt.invalidated_at AS "invalidatedAt",
         u.full_name AS "fullName",
         u.email AS "email",
         u.is_active AS "isActive",
         u.account_status AS "accountStatus"
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1
       FOR UPDATE OF prt, u`,
      [tokenHash]
    );

    const row = lockRes.rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        code: 'INVALID_TOKEN',
        message: 'This password reset link is invalid or could not be found.',
      };
    }

    if (row.usedAt) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        code: 'TOKEN_ALREADY_USED',
        message: 'This password reset link has already been used. Please request a new reset link.',
      };
    }

    if (row.invalidatedAt || new Date(row.expiresAt).getTime() <= Date.now()) {
      if (!row.invalidatedAt) {
        await client.query(
          'UPDATE password_reset_tokens SET invalidated_at = NOW() WHERE id = $1',
          [row.tokenId]
        );
        await client.query('COMMIT');
      } else {
        await client.query('ROLLBACK');
      }
      return {
        ok: false,
        code: 'TOKEN_EXPIRED',
        message: 'This password reset link has expired or been replaced. Please request a new one.',
      };
    }

    if (!row.isActive || row.accountStatus === 'suspended') {
      await client.query('ROLLBACK');
      return {
        ok: false,
        code: 'ACCOUNT_SUSPENDED',
        message: 'This account is suspended. Please contact Acadet CBT administration.',
      };
    }

    // Consume current token and invalidate all other unconsumed tokens for user
    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW(), used_ip = $2
       WHERE id = $1`,
      [row.tokenId, params.usedIp || null]
    );

    await client.query(
      `UPDATE password_reset_tokens
       SET invalidated_at = NOW()
       WHERE user_id = $1 AND id <> $2 AND used_at IS NULL AND invalidated_at IS NULL`,
      [row.userId, row.tokenId]
    );

    // Update password and bump session_version to revoke all prior JWT sessions
    await client.query(
      `UPDATE users
       SET password_hash = $1,
           session_version = COALESCE(session_version, 1) + 1,
           updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, row.userId]
    );

    await client.query('COMMIT');

    return {
      ok: true,
      user: {
        id: row.userId,
        fullName: row.fullName,
        email: row.email,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function consumeEmailVerificationToken(rawToken: string): Promise<
  | {
      ok: true;
      user: {
        id: string;
        fullName: string;
        email: string;
      };
    }
  | {
      ok: false;
      code:
        | 'INVALID_TOKEN'
        | 'TOKEN_ALREADY_USED'
        | 'TOKEN_EXPIRED'
        | 'ALREADY_VERIFIED';
      message: string;
    }
> {
  const trimmed = rawToken.trim();
  if (!trimmed || trimmed.length < 20) {
    return {
      ok: false,
      code: 'INVALID_TOKEN',
      message: 'This email verification link is invalid.',
    };
  }

  const tokenHash = hashAuthToken(trimmed);
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const lockRes = await client.query<{
      tokenId: string;
      userId: string;
      tokenEmail: string;
      expiresAt: Date;
      usedAt: Date | null;
      invalidatedAt: Date | null;
      fullName: string;
      userEmail: string;
      emailVerified: boolean;
    }>(
      `SELECT
         evt.id AS "tokenId",
         evt.user_id AS "userId",
         evt.email AS "tokenEmail",
         evt.expires_at AS "expiresAt",
         evt.used_at AS "usedAt",
         evt.invalidated_at AS "invalidatedAt",
         u.full_name AS "fullName",
         u.email AS "userEmail",
         u.email_verified AS "emailVerified"
       FROM email_verification_tokens evt
       JOIN users u ON u.id = evt.user_id
       WHERE evt.token_hash = $1
       FOR UPDATE OF evt, u`,
      [tokenHash]
    );

    const row = lockRes.rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        code: 'INVALID_TOKEN',
        message: 'This verification link is invalid or could not be found.',
      };
    }

    if (row.usedAt) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        code: row.emailVerified ? 'ALREADY_VERIFIED' : 'TOKEN_ALREADY_USED',
        message: row.emailVerified
          ? 'Your email address has already been verified. You can sign in normally.'
          : 'This verification link has already been used. Please request a new one if needed.',
      };
    }

    if (row.invalidatedAt || new Date(row.expiresAt).getTime() <= Date.now()) {
      if (!row.invalidatedAt) {
        await client.query(
          'UPDATE email_verification_tokens SET invalidated_at = NOW() WHERE id = $1',
          [row.tokenId]
        );
        await client.query('COMMIT');
      } else {
        await client.query('ROLLBACK');
      }
      return {
        ok: false,
        code: 'TOKEN_EXPIRED',
        message: 'This verification link has expired or been replaced. Please request a new verification email.',
      };
    }

    await client.query(
      `UPDATE email_verification_tokens
       SET used_at = NOW()
       WHERE id = $1`,
      [row.tokenId]
    );

    await client.query(
      `UPDATE email_verification_tokens
       SET invalidated_at = NOW()
       WHERE user_id = $1 AND id <> $2 AND used_at IS NULL AND invalidated_at IS NULL`,
      [row.userId, row.tokenId]
    );

    await client.query(
      `UPDATE users
       SET email_verified = TRUE,
           email_verified_at = COALESCE(email_verified_at, NOW()),
           updated_at = NOW()
       WHERE id = $1`,
      [row.userId]
    );

    await client.query('COMMIT');

    return {
      ok: true,
      user: {
        id: row.userId,
        fullName: row.fullName,
        email: row.userEmail,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
