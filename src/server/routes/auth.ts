import bcrypt from 'bcryptjs';
import { eq, or, sql } from 'drizzle-orm';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/index.js';
import { ensureBootstrapAdmin, seedDatabaseIfEmpty } from '../../db/seed.js';
import { DEFAULT_USER_PREFERENCES, users } from '../../db/schema.js';
import { writeAuditLog } from '../lib/audit.js';
import { resolveBaseUrl } from '../lib/branding.js';
import {
  isEmailConfigured,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '../lib/email.js';
import {
  checkPasswordResetRateLimit,
  checkVerificationResendRateLimit,
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  inspectPasswordResetToken,
  issueEmailVerificationToken,
  issuePasswordResetToken,
  recordPasswordResetRateHit,
  recordVerificationResendHit,
  validateNewPasswordStrength,
} from '../lib/emailAuth.js';
import { sanitizeUser, signAuthToken } from '../lib/jwt.js';
import {
  AUTH_COOKIE_NAME,
  handleApiError,
  optionalAuth,
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
      ver: Number(created.sessionVersion ?? 1),
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

    let verificationEmailSent = false;
    let verificationNotice: string | null = null;
    try {
      const issued = await issueEmailVerificationToken({
        userId: safeUser.id,
        email: safeUser.email,
        requestIp: req.ip,
      });
      const emailOutcome = await sendVerificationEmail({
        userId: safeUser.id,
        toEmail: safeUser.email,
        fullName: safeUser.fullName,
        rawToken: issued.rawToken,
        requestBaseUrl: resolveBaseUrl(req),
      });
      verificationEmailSent = emailOutcome.sent;
      if (!emailOutcome.sent) {
        verificationNotice =
          'Your account was created, but we could not send a verification email right now. You can resend it later from your dashboard.';
      }
    } catch (verifyErr) {
      console.warn('[Auth Register Verification Warning]', verifyErr);
      verificationNotice =
        'Your account was created. You can request an email verification link from your dashboard.';
    }

    res.status(201).json({
      token,
      user: safeUser,
      verificationEmailSent,
      ...(verificationNotice ? { verificationNotice } : {}),
    });
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

    if (!found.isActive || found.accountStatus === 'suspended') {
      const reasonSuffix = found.suspendedReason ? ` Reason: ${found.suspendedReason}` : '';
      res.status(403).json({
        error: `Your account has been suspended. Please contact Acadet CBT administration.${reasonSuffix}`,
        code: 'ACCOUNT_SUSPENDED',
        reason: found.suspendedReason ?? null,
      });
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
      ver: Number(found.sessionVersion ?? 1),
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

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.').max(160),
});

router.post('/forgot-password', requireDb, async (req, res) => {
  try {
    const parsed = forgotPasswordSchema.parse(req.body ?? {});
    const normalizedEmail = parsed.email.toLowerCase();

    const rateCheck = await checkPasswordResetRateLimit({
      email: normalizedEmail,
      ipAddress: req.ip,
    });
    if (!rateCheck.allowed) {
      if (rateCheck.retryAfterSeconds) {
        res.setHeader('Retry-After', String(rateCheck.retryAfterSeconds));
      }
      res.status(429).json({
        error:
          rateCheck.message ||
          'Too many password recovery requests. Please wait before trying again.',
        code: 'RATE_LIMIT_EXCEEDED',
      });
      return;
    }

    recordPasswordResetRateHit({ email: normalizedEmail, ipAddress: req.ip });

    if (!isEmailConfigured()) {
      console.warn(
        '[Password Reset] Cannot dispatch recovery email because Lockally email environment variables are incomplete.'
      );
      res.status(503).json({
        error:
          'Password recovery email delivery is temporarily unavailable because the email service has not been configured yet. Please contact Acadet CBT support.',
        code: 'EMAIL_NOT_CONFIGURED',
      });
      return;
    }

    const db = getDb();
    const [found] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.email}) = ${normalizedEmail}`)
      .limit(1);

    if (found && found.isActive && found.accountStatus !== 'suspended') {
      const issued = await issuePasswordResetToken({
        userId: found.id,
        requestIp: req.ip,
      });

      const sendResult = await sendPasswordResetEmail({
        userId: found.id,
        toEmail: found.email,
        fullName: found.fullName,
        rawToken: issued.rawToken,
        requestBaseUrl: resolveBaseUrl(req),
      });

      await writeAuditLog({
        actorUserId: found.id,
        action: sendResult.sent
          ? 'user.password_reset_requested'
          : 'user.password_reset_email_failed',
        entityType: 'user',
        entityId: found.id,
        metadata: {
          deliveryStatus: sendResult.status,
          expiresAt: issued.expiresAt.toISOString(),
        },
        ipAddress: req.ip,
      });

      if (!sendResult.sent) {
        res.status(503).json({
          error:
            'We could not deliver the password reset email right now. Please try again shortly or contact Acadet CBT support.',
          code: 'EMAIL_DELIVERY_FAILED',
        });
        return;
      }
    }

    // Never reveal whether an email address exists in the database
    res.json({
      ok: true,
      message:
        'If an active Acadet CBT account matches that email address, a password reset link has been queued for delivery. Please check your inbox and spam folder. The link expires in 20 minutes.',
    });
  } catch (err) {
    handleApiError(res, err, 'forgot password request');
  }
});

router.get('/reset-password/validate', requireDb, async (req, res) => {
  try {
    const rawToken = typeof req.query.token === 'string' ? req.query.token : '';
    const inspection = await inspectPasswordResetToken(rawToken);
    if (inspection.status === 'valid') {
      res.json({ valid: true, status: 'valid', expiresAt: inspection.expiresAt });
      return;
    }
    const messages: Record<string, string> = {
      invalid: 'This password reset link is invalid.',
      already_used:
        'This password reset link has already been used. Please request a new reset link.',
      expired: 'This password reset link has expired. Please request a new reset link.',
      suspended: 'This account is suspended. Please contact Acadet CBT administration.',
    };
    res.status(400).json({
      valid: false,
      status: inspection.status,
      error: messages[inspection.status] || 'Invalid password reset link.',
    });
  } catch (err) {
    handleApiError(res, err, 'password reset token validation');
  }
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(10, 'Reset token is required.'),
  newPassword: z.string().min(1, 'New password is required.').max(128),
  confirmPassword: z.string().min(1, 'Please confirm your new password.').max(128),
});

router.post('/reset-password', requireDb, async (req, res) => {
  try {
    const parsed = resetPasswordSchema.parse(req.body ?? {});

    if (parsed.newPassword !== parsed.confirmPassword) {
      res.status(400).json({
        error: 'New password and confirmation password do not match.',
        code: 'PASSWORDS_MISMATCH',
      });
      return;
    }

    const strength = validateNewPasswordStrength(parsed.newPassword);
    if (!strength.valid) {
      res.status(400).json({
        error: strength.message || 'Password does not meet security requirements.',
        code: 'WEAK_PASSWORD',
      });
      return;
    }

    const result = await consumePasswordResetToken({
      rawToken: parsed.token,
      newPassword: parsed.newPassword,
      usedIp: req.ip,
    });

    if (result.ok === false) {
      const status = result.code === 'ACCOUNT_SUSPENDED' ? 403 : 400;
      res.status(status).json({ error: result.message, code: result.code });
      return;
    }

    const secure = isHttpsRequest(req);
    res.clearCookie(AUTH_COOKIE_NAME, {
      path: '/',
      sameSite: secure ? 'none' : 'lax',
      secure,
    });

    await writeAuditLog({
      actorUserId: result.user.id,
      action: 'user.password_reset_completed',
      entityType: 'user',
      entityId: result.user.id,
      ipAddress: req.ip,
    });

    const confirmationEmail = await sendPasswordChangedEmail({
      userId: result.user.id,
      toEmail: result.user.email,
      fullName: result.user.fullName,
      requestBaseUrl: resolveBaseUrl(req),
    });

    res.json({
      ok: true,
      message:
        'Your password has been reset successfully. You can now sign in with your new password.',
      confirmationEmailSent: confirmationEmail.sent,
    });
  } catch (err) {
    handleApiError(res, err, 'password reset');
  }
});

const verifyEmailSchema = z.object({
  token: z.string().trim().min(10, 'Verification token is required.'),
});

router.post('/verify-email', requireDb, async (req, res) => {
  try {
    const parsed = verifyEmailSchema.parse(req.body ?? {});
    const outcome = await consumeEmailVerificationToken(parsed.token);

    if (outcome.ok === false) {
      if (outcome.code === 'ALREADY_VERIFIED') {
        res.json({
          ok: true,
          alreadyVerified: true,
          message: outcome.message,
        });
        return;
      }
      res.status(400).json({ error: outcome.message, code: outcome.code });
      return;
    }

    await writeAuditLog({
      actorUserId: outcome.user.id,
      action: 'user.email_verified',
      entityType: 'user',
      entityId: outcome.user.id,
      ipAddress: req.ip,
    });

    res.json({
      ok: true,
      emailVerified: true,
      message: 'Your email address has been verified successfully.',
    });
  } catch (err) {
    handleApiError(res, err, 'email verification');
  }
});

const resendVerificationSchema = z.object({
  email: z.string().trim().email('Please provide a valid email address.').max(160).optional(),
});

router.post('/resend-verification', requireDb, optionalAuth, async (req, res) => {
  try {
    const parsed = resendVerificationSchema.parse(req.body ?? {});
    const authedUser = req.user;
    const targetEmail = (authedUser?.email || parsed.email || '').trim().toLowerCase();

    if (!targetEmail) {
      res.status(400).json({ error: 'Please provide your registered email address.' });
      return;
    }

    const rateCheck = await checkVerificationResendRateLimit({
      email: targetEmail,
      userId: authedUser?.id,
    });
    if (!rateCheck.allowed) {
      if (rateCheck.retryAfterSeconds) {
        res.setHeader('Retry-After', String(rateCheck.retryAfterSeconds));
      }
      res.status(429).json({
        error:
          rateCheck.message ||
          'Please wait before requesting another verification email.',
        code: 'RATE_LIMIT_EXCEEDED',
      });
      return;
    }

    recordVerificationResendHit(targetEmail);

    if (!isEmailConfigured()) {
      res.status(503).json({
        error:
          'Email delivery is temporarily unavailable because the email service has not been configured yet. Please contact Acadet CBT support.',
        code: 'EMAIL_NOT_CONFIGURED',
      });
      return;
    }

    const db = getDb();
    const [found] = await db
      .select()
      .from(users)
      .where(
        authedUser
          ? eq(users.id, authedUser.id)
          : sql`LOWER(${users.email}) = ${targetEmail}`
      )
      .limit(1);

    if (found && found.isActive && found.accountStatus !== 'suspended') {
      if (found.emailVerified) {
        res.json({
          ok: true,
          alreadyVerified: true,
          message: authedUser
            ? 'Your email address is already verified.'
            : 'If your account exists and requires verification, a verification email has been sent.',
        });
        return;
      }

      const issued = await issueEmailVerificationToken({
        userId: found.id,
        email: found.email,
        requestIp: req.ip,
      });

      const emailOutcome = await sendVerificationEmail({
        userId: found.id,
        toEmail: found.email,
        fullName: found.fullName,
        rawToken: issued.rawToken,
        requestBaseUrl: resolveBaseUrl(req),
      });

      await writeAuditLog({
        actorUserId: found.id,
        action: emailOutcome.sent
          ? 'user.verification_email_resent'
          : 'user.verification_email_failed',
        entityType: 'user',
        entityId: found.id,
        metadata: { deliveryStatus: emailOutcome.status },
        ipAddress: req.ip,
      });

      if (!emailOutcome.sent) {
        res.status(503).json({
          error:
            'We could not deliver the verification email right now. Please try again shortly or contact Acadet CBT support.',
          code: 'EMAIL_DELIVERY_FAILED',
        });
        return;
      }
    }

    res.json({
      ok: true,
      message: authedUser
        ? `A fresh verification link has been queued for delivery to ${authedUser.email}. Please check your inbox and spam folder shortly.`
        : 'If an unverified account matches that email address, a verification link has been queued for delivery.',
    });
  } catch (err) {
    handleApiError(res, err, 'resending verification email');
  }
});

export default router;
