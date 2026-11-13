import bcrypt from 'bcryptjs';
import { eq, or, sql } from 'drizzle-orm';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/index.js';
import { ensureBootstrapAdmin, seedDatabaseIfEmpty } from '../../db/seed.js';
import { DEFAULT_USER_PREFERENCES, users } from '../../db/schema.js';
import { writeAuditLog } from '../lib/audit.js';
import { sanitizeUser, signAuthToken } from '../lib/jwt.js';
import {
  AUTH_COOKIE_NAME,
  handleApiError,
  requireAuth,
  requireDb,
} from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
  email: z.string().trim().email('Please provide a valid email address').max(160),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(40)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, numbers, dots, underscores, or hyphens'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  examTarget: z.string().trim().min(2).max(120).optional(),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  examTarget: z.string().trim().min(2).max(120).optional(),
  whatsappNumber: z
    .string()
    .transform((v) => v.trim().replace(/[\s()-]/g, ''))
    .refine((v) => /^\+?\d{10,15}$/.test(v), {
      message: 'Please input your correct WhatsApp number (10 to 15 digits).',
    })
    .optional(),
});

const updatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  fontSize: z.enum(['small', 'medium', 'large']).optional(),
  soundNotifications: z.boolean().optional(),
  autoNextQuestion: z.boolean().optional(),
  showQuestionPalette: z.boolean().optional(),
  defaultCourseId: z.string().uuid().nullable().optional(),
  defaultSubjectId: z.string().uuid().nullable().optional(),
  defaultDifficulty: z.enum(['All Levels', 'Easy', 'Medium', 'Hard']).optional(),
});

function isHttpsRequest(req: Request): boolean {
  return (
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production'
  );
}

function setAuthCookie(req: Request, res: Response, token: string): void {
  const secure = isHttpsRequest(req);
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    secure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

router.post('/register', requireDb, async (req, res) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const db = getDb();

    const normalizedEmail = parsed.email.toLowerCase();
    const normalizedUsername = parsed.username.toLowerCase();

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(
        or(
          sql`LOWER(${users.email}) = ${normalizedEmail}`,
          sql`LOWER(${users.username}) = ${normalizedUsername}`
        )
      )
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({
        error: 'An account with this email or username already exists.',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.password, 12);
    const [created] = await db
      .insert(users)
      .values({
        fullName: parsed.fullName,
        email: normalizedEmail,
        username: normalizedUsername,
        passwordHash,
        role: 'student',
        examTarget: parsed.examTarget || 'Acadet CBT Examination',
        isActive: true,
        preferences: DEFAULT_USER_PREFERENCES,
      })
      .returning();

    const safeUser = sanitizeUser(created);
    const token = signAuthToken({
      sub: safeUser.id,
      role: safeUser.role,
      email: safeUser.email,
    });

    setAuthCookie(req, res, token);
    void seedDatabaseIfEmpty().catch(() => {});
    await writeAuditLog({
      actorUserId: safeUser.id,
      action: 'user.register',
      entityType: 'user',
      entityId: safeUser.id,
      ipAddress: req.ip,
    });

    res.status(201).json({ token, user: safeUser });
  } catch (err) {
    handleApiError(res, err, 'user registration');
  }
});

router.post('/login', requireDb, async (req, res) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const db = getDb();
    const ident = parsed.identifier.toLowerCase();

    const envAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const envAdminUser = (process.env.ADMIN_USERNAME?.trim() || 'admin').toLowerCase();
    if (envAdminEmail && (ident === envAdminEmail || ident === envAdminUser)) {
      await ensureBootstrapAdmin();
    }

    const [found] = await db
      .select()
      .from(users)
      .where(
        or(
          sql`LOWER(${users.email}) = ${ident}`,
          sql`LOWER(${users.username}) = ${ident}`
        )
      )
      .limit(1);

    if (!found) {
      res.status(401).json({ error: 'Invalid email/username or password.' });
      return;
    }

    if (!found.isActive) {
      res.status(403).json({ error: 'This account has been deactivated. Please contact support.' });
      return;
    }

    const passwordMatches = await bcrypt.compare(parsed.password, found.passwordHash);
    if (!passwordMatches) {
      res.status(401).json({ error: 'Invalid email/username or password.' });
      return;
    }

    const safeUser = sanitizeUser(found);
    const token = signAuthToken({
      sub: safeUser.id,
      role: safeUser.role,
      email: safeUser.email,
    });

    setAuthCookie(req, res, token);
    await writeAuditLog({
      actorUserId: safeUser.id,
      action: 'user.login',
      entityType: 'user',
      entityId: safeUser.id,
      ipAddress: req.ip,
    });

    res.json({ token, user: safeUser });
  } catch (err) {
    handleApiError(res, err, 'user login');
  }
});

router.post('/logout', (req, res) => {
  const secure = isHttpsRequest(req);
  res.clearCookie(AUTH_COOKIE_NAME, {
    path: '/',
    sameSite: secure ? 'none' : 'lax',
    secure,
  });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.patch('/me', requireAuth, async (req, res) => {
  try {
    const parsed = updateProfileSchema.parse(req.body);
    const db = getDb();

    const [updated] = await db
      .update(users)
      .set({
        ...(parsed.fullName ? { fullName: parsed.fullName } : {}),
        ...(parsed.examTarget ? { examTarget: parsed.examTarget } : {}),
        ...(parsed.whatsappNumber ? { whatsappNumber: parsed.whatsappNumber } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.user!.id))
      .returning();

    res.json({ user: sanitizeUser(updated) });
  } catch (err) {
    handleApiError(res, err, 'profile update');
  }
});

router.patch('/preferences', requireAuth, async (req, res) => {
  try {
    const parsed = updatePreferencesSchema.parse(req.body);
    const db = getDb();

    const mergedPreferences = {
      ...DEFAULT_USER_PREFERENCES,
      ...req.user!.preferences,
      ...parsed,
    };

    const [updated] = await db
      .update(users)
      .set({
        preferences: mergedPreferences,
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.user!.id))
      .returning();

    res.json({ user: sanitizeUser(updated) });
  } catch (err) {
    handleApiError(res, err, 'preferences update');
  }
});

export default router;
