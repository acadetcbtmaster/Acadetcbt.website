import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { UserPreferences } from '../../db/schema.js';
import { DEFAULT_USER_PREFERENCES } from '../../db/schema.js';

export type UserRole = 'student' | 'admin' | 'super_admin';
export type AccountStatus = 'active' | 'suspended';

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
  email: string;
  ver?: number;
}

export interface SafeUser {
  id: string;
  fullName: string;
  email: string;
  username: string;
  registrationCode: string | null;
  role: UserRole;
  examTarget: string;
  whatsappNumber: string | null;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  isActive: boolean;
  accountStatus: AccountStatus;
  suspendedReason: string | null;
  suspendedAt: Date | null;
  preferences: UserPreferences;
  createdAt: Date;
}

let cachedFallbackSecret: string | null = null;
let warnedMissingSecret = false;

function getJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured && configured.length >= 16) {
    return configured;
  }

  if (!cachedFallbackSecret) {
    const seedMaterial = process.env.DATABASE_URL?.trim() || process.cwd();
    cachedFallbackSecret = crypto
      .createHmac('sha256', 'acadet-cbt-session-key')
      .update(seedMaterial)
      .digest('hex');

    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn(
        '[Auth] JWT_SECRET is not set (or under 16 chars); using derived session secret. Set JWT_SECRET in production environment variables.'
      );
    }
  }

  return cachedFallbackSecret;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn,
    issuer: 'acadet-cbt',
  });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret(), {
    issuer: 'acadet-cbt',
  });

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof decoded.sub !== 'string' ||
    typeof (decoded as { role?: unknown }).role !== 'string'
  ) {
    throw new Error('Invalid token payload');
  }

  const rawVer = (decoded as { ver?: unknown }).ver;

  return {
    sub: decoded.sub,
    role: (decoded as { role: UserRole }).role,
    email:
      typeof (decoded as { email?: unknown }).email === 'string'
        ? (decoded as { email: string }).email
        : '',
    ...(typeof rawVer === 'number' && Number.isFinite(rawVer) ? { ver: rawVer } : {}),
  };
}

export function sanitizeUser(row: {
  id: string;
  fullName: string;
  email: string;
  username: string;
  registrationCode?: string | null;
  role: string;
  examTarget: string;
  whatsappNumber?: string | null;
  emailVerified?: boolean | null;
  emailVerifiedAt?: Date | null;
  isActive: boolean;
  accountStatus?: string | null;
  suspendedReason?: string | null;
  suspendedAt?: Date | null;
  preferences: UserPreferences | null;
  createdAt: Date;
}): SafeUser {
  const resolvedAccountStatus: AccountStatus =
    row.accountStatus === 'suspended' || !row.isActive ? 'suspended' : 'active';

  const resolvedRegCode =
    row.registrationCode?.trim() ||
    `ACD-${row.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    username: row.username,
    registrationCode: resolvedRegCode,
    role: (row.role as UserRole) || 'student',
    examTarget: row.examTarget,
    whatsappNumber: row.whatsappNumber ?? null,
    emailVerified: Boolean(row.emailVerified),
    emailVerifiedAt: row.emailVerifiedAt ?? null,
    isActive: row.isActive && resolvedAccountStatus === 'active',
    accountStatus: resolvedAccountStatus,
    suspendedReason: row.suspendedReason ?? null,
    suspendedAt: row.suspendedAt ?? null,
    preferences: {
      ...DEFAULT_USER_PREFERENCES,
      ...(row.preferences || {}),
    },
    createdAt: row.createdAt,
  };
}
