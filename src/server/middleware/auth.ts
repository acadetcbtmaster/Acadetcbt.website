import { eq } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { DatabaseNotConfiguredError, getDb, isDatabaseConfigured } from '../../db/index.js';
import { ensureMigrated } from '../../db/migrate.js';
import { users } from '../../db/schema.js';
import { type SafeUser, type UserRole, sanitizeUser, verifyAuthToken } from '../lib/jwt.js';

export const AUTH_COOKIE_NAME = 'acadet_token';

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}

export function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.trim().length > 0) {
    return cookieToken.trim();
  }

  return null;
}

export async function requireDb(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!isDatabaseConfigured()) {
    res.status(503).json({
      error: 'PostgreSQL database is not configured. Set DATABASE_URL to enable data operations.',
      code: 'DATABASE_NOT_CONFIGURED',
    });
    return;
  }

  try {
    await ensureMigrated();
    next();
  } catch (err) {
    handleApiError(res, err, 'initializing database schema');
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!isDatabaseConfigured()) {
    res.status(503).json({
      error: 'PostgreSQL database is not configured. Set DATABASE_URL to enable authentication.',
      code: 'DATABASE_NOT_CONFIGURED',
    });
    return;
  }

  const token = extractTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  try {
    await ensureMigrated();
    const payload = verifyAuthToken(token);
    const db = getDb();
    const [foundUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!foundUser || !foundUser.isActive) {
      res.status(401).json({ error: 'Your account session is invalid or deactivated.' });
      return;
    }

    req.user = sanitizeUser(foundUser);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!isDatabaseConfigured()) {
    next();
    return;
  }

  const token = extractTokenFromRequest(req);
  if (!token) {
    next();
    return;
  }

  try {
    await ensureMigrated();
    const payload = verifyAuthToken(token);
    const db = getDb();
    const [foundUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (foundUser && foundUser.isActive) {
      req.user = sanitizeUser(foundUser);
    }
  } catch {
    // Ignore invalid optional tokens
  }
  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'You do not have permission to perform this action.',
      });
      return;
    }

    next();
  };
}

export function handleApiError(res: Response, error: unknown, context: string): void {
  if (error instanceof DatabaseNotConfiguredError) {
    res.status(503).json({
      error: error.message,
      code: 'DATABASE_NOT_CONFIGURED',
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: error.issues[0]?.message || 'Invalid request payload',
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  const pgCode =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : undefined;

  if (pgCode === '23505') {
    res.status(409).json({ error: 'A record with that unique value already exists.' });
    return;
  }
  if (pgCode === '23503') {
    res.status(400).json({ error: 'Referenced parent record does not exist.' });
    return;
  }
  if (pgCode === '22P02') {
    res.status(400).json({ error: 'Invalid identifier format.' });
    return;
  }

  console.error(`[API Error - ${context}]`, error);
  res.status(500).json({ error: `Internal server error while processing ${context}.` });
}
