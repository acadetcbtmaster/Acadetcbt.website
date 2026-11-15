import nodemailer from 'nodemailer';
import { getPool, isDatabaseConfigured } from '../../db/index.js';
import { getPublicBrandingAndFounder } from './branding.js';

export type SmtpConnectionStatus =
  | 'connected'
  | 'unconfigured'
  | 'connection_failed'
  | 'unknown';

export type TransactionalEmailType =
  | 'verification'
  | 'password_reset'
  | 'password_changed'
  | 'admin_test';

export interface SmtpConfigSummary {
  configured: boolean;
  missingVariables: string[];
  validationErrors: string[];
  host: string | null;
  port: number | null;
  secure: boolean;
  userMasked: string | null;
  fromEmail: string | null;
  appBaseUrl: string;
  connectionStatus: SmtpConnectionStatus;
  lastCheckedAt: string | null;
  lastError: string | null;
}

export interface EmailSendResult {
  sent: boolean;
  status: 'sent' | 'failed' | 'skipped_unconfigured';
  messageId?: string;
  error?: string;
}

export const REQUIRED_SMTP_ENV_VARS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM_EMAIL',
  'APP_BASE_URL',
] as const;

let runtimeConnectionStatus: SmtpConnectionStatus = 'unknown';
let runtimeLastCheckedAt: string | null = null;
let runtimeLastError: string | null = null;

function sanitizeSmtpErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || 'SMTP operation failed');
  const password = process.env.SMTP_PASSWORD?.trim();
  const user = process.env.SMTP_USER?.trim();
  let cleaned = raw;
  if (password && password.length >= 3) {
    cleaned = cleaned.split(password).join('[REDACTED]');
  }
  if (user && user.length >= 6) {
    cleaned = cleaned.split(user).join('[SMTP_USER]');
  }
  return cleaned.slice(0, 300);
}

function maskEmailOrUser(raw: string | undefined): string | null {
  const val = raw?.trim();
  if (!val) return null;
  const atIdx = val.indexOf('@');
  if (atIdx > 1) {
    return `${val.slice(0, 2)}***${val.slice(atIdx)}`;
  }
  if (val.length <= 4) return '****';
  return `${val.slice(0, 2)}***${val.slice(-2)}`;
}

export function resolveAppBaseUrl(requestBaseUrl?: string): string {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }
  if (requestBaseUrl && requestBaseUrl.trim()) {
    return requestBaseUrl.trim().replace(/\/+$/, '');
  }
  const fallback = process.env.APP_URL?.trim();
  if (fallback) {
    return fallback.replace(/\/+$/, '');
  }
  return 'https://acadetcbt.website';
}

export function getSmtpConfigSummary(): SmtpConfigSummary {
  const host = process.env.SMTP_HOST?.trim() || null;
  const rawPort = process.env.SMTP_PORT?.trim() || '';
  const user = process.env.SMTP_USER?.trim() || null;
  const password = process.env.SMTP_PASSWORD?.trim() || null;
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim() || null;
  const appBaseUrlEnv = process.env.APP_BASE_URL?.trim() || null;

  const missingVariables: string[] = [];
  if (!host) missingVariables.push('SMTP_HOST');
  if (!rawPort) missingVariables.push('SMTP_PORT');
  if (!user) missingVariables.push('SMTP_USER');
  if (!password) missingVariables.push('SMTP_PASSWORD');
  if (!fromEmail) missingVariables.push('SMTP_FROM_EMAIL');
  if (!appBaseUrlEnv) missingVariables.push('APP_BASE_URL');

  const validationErrors: string[] = [];
  let port: number | null = null;
  if (rawPort) {
    const parsed = Number(rawPort);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      validationErrors.push('SMTP_PORT must be a valid TCP port number (e.g. 465 or 587).');
    } else {
      port = parsed;
    }
  }

  if (fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
    validationErrors.push('SMTP_FROM_EMAIL must be a valid email address.');
  }

  if (appBaseUrlEnv && !/^https?:\/\//i.test(appBaseUrlEnv)) {
    validationErrors.push('APP_BASE_URL must start with https:// or http://.');
  }

  const coreSmtpPresent = Boolean(
    host && port !== null && user && password && fromEmail && validationErrors.length === 0
  );

  const secureEnv = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure =
    secureEnv === 'true' ? true : secureEnv === 'false' ? false : port === 465;

  const connectionStatus: SmtpConnectionStatus = !coreSmtpPresent
    ? 'unconfigured'
    : runtimeConnectionStatus === 'unconfigured'
      ? 'unknown'
      : runtimeConnectionStatus;

  return {
    configured: coreSmtpPresent,
    missingVariables,
    validationErrors,
    host,
    port,
    secure,
    userMasked: maskEmailOrUser(user || undefined),
    fromEmail,
    appBaseUrl: resolveAppBaseUrl(),
    connectionStatus,
    lastCheckedAt: runtimeLastCheckedAt,
    lastError: coreSmtpPresent
      ? runtimeLastError
      : `Missing required environment variables: ${missingVariables.join(', ')}`,
  };
}

export function isSmtpConfigured(): boolean {
  return getSmtpConfigSummary().configured;
}

export function validateSmtpStartup(): SmtpConfigSummary {
  const summary = getSmtpConfigSummary();
  if (!summary.configured) {
    console.warn(
      `[Email / SMTP Warning] Transactional emails are not active. Missing or invalid Render environment variables: ${
        [...summary.missingVariables, ...summary.validationErrors].join('; ') || 'unknown'
      }. Required variables: ${REQUIRED_SMTP_ENV_VARS.join(', ')}.`
    );
  } else {
    console.log(
      `[Email / SMTP] Configured for ${summary.host}:${summary.port} (secure=${summary.secure}, from=${summary.fromEmail}, base=${summary.appBaseUrl}).`
    );
  }
  return summary;
}

function createTransporter() {
  const summary = getSmtpConfigSummary();
  if (!summary.configured || !summary.host || !summary.port || !summary.fromEmail) {
    return null;
  }

  const authUser = process.env.SMTP_USER?.trim() || '';
  const authPass = process.env.SMTP_PASSWORD?.trim() || '';
  const allowInsecureLocal =
    summary.host === '127.0.0.1' || summary.host === 'localhost';
  const rejectUnauthorized = allowInsecureLocal
    ? false
    : process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false';

  return nodemailer.createTransport({
    host: summary.host,
    port: summary.port,
    secure: summary.secure,
    auth: {
      user: authUser,
      pass: authPass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized,
    },
  });
}

export async function verifySmtpConnection(): Promise<SmtpConfigSummary> {
  const summary = getSmtpConfigSummary();
  runtimeLastCheckedAt = new Date().toISOString();

  if (!summary.configured) {
    runtimeConnectionStatus = 'unconfigured';
    runtimeLastError = summary.lastError;
    return getSmtpConfigSummary();
  }

  const transporter = createTransporter();
  if (!transporter) {
    runtimeConnectionStatus = 'unconfigured';
    runtimeLastError = 'SMTP configuration is incomplete.';
    return getSmtpConfigSummary();
  }

  try {
    await transporter.verify();
    runtimeConnectionStatus = 'connected';
    runtimeLastError = null;
  } catch (err) {
    runtimeConnectionStatus = 'connection_failed';
    runtimeLastError = sanitizeSmtpErrorMessage(err);
    console.error('[Email / SMTP Connection Verification Failed]', runtimeLastError);
  } finally {
    if (typeof transporter.close === 'function') {
      transporter.close();
    }
  }

  return getSmtpConfigSummary();
}

async function recordEmailDeliveryAttempt(params: {
  userId?: string | null;
  recipientEmail: string;
  emailType: TransactionalEmailType;
  subject: string;
  deliveryStatus: 'sent' | 'failed' | 'skipped_unconfigured';
  messageId?: string | null;
  errorMessage?: string | null;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO email_delivery_logs (
         user_id, recipient_email, email_type, subject, delivery_status, message_id, error_message
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        params.userId ?? null,
        params.recipientEmail.toLowerCase(),
        params.emailType,
        params.subject,
        params.deliveryStatus,
        params.messageId ?? null,
        params.errorMessage ? params.errorMessage.slice(0, 500) : null,
      ]
    );
  } catch (logErr) {
    console.warn('[Email Delivery Log Warning]', logErr);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function buildBrandedEmailHtml(params: {
  baseUrl: string;
  preheader: string;
  badgeText: string;
  heading: string;
  greetingName: string;
  bodyParagraphs: string[];
  actionLabel?: string;
  actionUrl?: string;
  expiryNotice?: string;
  securityNote: string;
}): Promise<{ html: string; siteName: string; contactEmail: string }> {
  let siteName = 'Acadet CBT';
  let tagline = '...Learn, Practice, Excel';
  let contactEmail = 'support@acadetcbt.website';
  let logoPathOrUrl = '/acadet-logo.png';

  try {
    const { branding } = await getPublicBrandingAndFounder();
    siteName = branding.siteName || siteName;
    tagline = branding.tagline || tagline;
    contactEmail = branding.contactEmail || contactEmail;
    logoPathOrUrl = branding.logoUrl || logoPathOrUrl;
  } catch {
    // Use safe branding defaults
  }

  const cleanBase = params.baseUrl.replace(/\/+$/, '');
  const logoUrl = /^https?:\/\//i.test(logoPathOrUrl)
    ? logoPathOrUrl
    : `${cleanBase}${logoPathOrUrl.startsWith('/') ? logoPathOrUrl : `/${logoPathOrUrl}`}`;

  const paragraphsHtml = params.bodyParagraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(
          p
        )}</p>`
    )
    .join('');

  const ctaHtml =
    params.actionLabel && params.actionUrl
      ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 18px 0;">
        <tr>
          <td align="center" bgcolor="#0a58ed" style="border-radius:10px;">
            <a href="${escapeHtml(params.actionUrl)}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
              ${escapeHtml(params.actionLabel)}
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 14px 0;font-size:12px;line-height:1.5;color:#64748b;word-break:break-all;">
        If the button above does not work, copy and paste this link into your browser:<br />
        <a href="${escapeHtml(params.actionUrl)}" style="color:#0a58ed;text-decoration:underline;">${escapeHtml(
          params.actionUrl
        )}</a>
      </p>`
      : '';

  const expiryHtml = params.expiryNotice
    ? `<div style="margin:14px 0;padding:11px 14px;border-radius:10px;background-color:#eff5ff;border:1px solid #bfdbfe;font-size:13px;line-height:1.5;color:#082252;">
         <strong>Time Limit:</strong> ${escapeHtml(params.expiryNotice)}
       </div>`
    : '';

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(params.heading)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#eef3fb;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(
      params.preheader
    )}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef3fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background-color:#ffffff;border:1px solid #dce6f5;border-radius:16px;overflow:hidden;">
            <tr>
              <td bgcolor="#0b337a" style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.12);">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="52" valign="middle">
                      <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(siteName)} logo" width="44" height="44" style="display:block;width:44px;height:44px;border-radius:10px;background-color:#ffffff;padding:2px;object-fit:contain;" />
                    </td>
                    <td valign="middle" style="padding-left:12px;">
                      <div style="font-size:19px;font-weight:800;color:#ffffff;line-height:1.2;">${escapeHtml(
                        siteName
                      )}</div>
                      <div style="font-size:12px;font-style:italic;color:#dbeafe;margin-top:2px;">${escapeHtml(
                        tagline
                      )}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 24px 20px 24px;">
                <div style="display:inline-block;padding:4px 10px;border-radius:6px;background-color:#eff5ff;color:#0b337a;font-size:11px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:12px;">
                  ${escapeHtml(params.badgeText)}
                </div>
                <h1 style="margin:0 0 14px 0;font-size:21px;line-height:1.3;font-weight:800;color:#082252;">
                  ${escapeHtml(params.heading)}
                </h1>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#1e293b;">
                  Hello <strong>${escapeHtml(params.greetingName)}</strong>,
                </p>
                ${paragraphsHtml}
                ${ctaHtml}
                ${expiryHtml}
                <div style="margin-top:18px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:13px;line-height:1.55;color:#475569;">
                  <strong style="color:#0f172a;">Security Notice:</strong> ${escapeHtml(
                    params.securityNote
                  )}
                </div>
              </td>
            </tr>
            <tr>
              <td bgcolor="#f8fafc" style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#64748b;text-align:center;">
                <div style="font-weight:700;color:#0b337a;">${escapeHtml(siteName)} · Acadet Learning Hub</div>
                <div style="margin-top:4px;">Need assistance? Contact <a href="mailto:${escapeHtml(
                  contactEmail
                )}" style="color:#0a58ed;text-decoration:none;">${escapeHtml(contactEmail)}</a></div>
                <div style="margin-top:4px;">© ${new Date().getFullYear()} ${escapeHtml(
                  siteName
                )}. All rights reserved.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { html, siteName, contactEmail };
}

async function sendTransactionalEmail(params: {
  userId?: string | null;
  toEmail: string;
  emailType: TransactionalEmailType;
  subject: string;
  html: string;
  text: string;
}): Promise<EmailSendResult> {
  const summary = getSmtpConfigSummary();
  if (!summary.configured || !summary.fromEmail) {
    const errMsg = `SMTP not configured (${summary.missingVariables.join(', ') || 'invalid settings'}).`;
    runtimeConnectionStatus = 'unconfigured';
    runtimeLastError = errMsg;
    await recordEmailDeliveryAttempt({
      userId: params.userId,
      recipientEmail: params.toEmail,
      emailType: params.emailType,
      subject: params.subject,
      deliveryStatus: 'skipped_unconfigured',
      errorMessage: errMsg,
    });
    return {
      sent: false,
      status: 'skipped_unconfigured',
      error: errMsg,
    };
  }

  const transporter = createTransporter();
  if (!transporter) {
    const errMsg = 'Unable to initialize SMTP transporter.';
    await recordEmailDeliveryAttempt({
      userId: params.userId,
      recipientEmail: params.toEmail,
      emailType: params.emailType,
      subject: params.subject,
      deliveryStatus: 'failed',
      errorMessage: errMsg,
    });
    return { sent: false, status: 'failed', error: errMsg };
  }

  try {
    const info = await transporter.sendMail({
      from: `Acadet CBT <${summary.fromEmail}>`,
      to: params.toEmail,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });

    runtimeConnectionStatus = 'connected';
    runtimeLastCheckedAt = new Date().toISOString();
    runtimeLastError = null;

    await recordEmailDeliveryAttempt({
      userId: params.userId,
      recipientEmail: params.toEmail,
      emailType: params.emailType,
      subject: params.subject,
      deliveryStatus: 'sent',
      messageId: info.messageId || null,
    });

    return {
      sent: true,
      status: 'sent',
      messageId: info.messageId,
    };
  } catch (err) {
    const cleanErr = sanitizeSmtpErrorMessage(err);
    runtimeConnectionStatus = 'connection_failed';
    runtimeLastCheckedAt = new Date().toISOString();
    runtimeLastError = cleanErr;
    console.error(`[Email Send Failed:${params.emailType}]`, cleanErr);

    await recordEmailDeliveryAttempt({
      userId: params.userId,
      recipientEmail: params.toEmail,
      emailType: params.emailType,
      subject: params.subject,
      deliveryStatus: 'failed',
      errorMessage: cleanErr,
    });

    return {
      sent: false,
      status: 'failed',
      error: cleanErr,
    };
  } finally {
    if (typeof transporter.close === 'function') {
      transporter.close();
    }
  }
}

export async function sendPasswordResetEmail(params: {
  userId: string;
  toEmail: string;
  fullName: string;
  rawToken: string;
  requestBaseUrl?: string;
}): Promise<EmailSendResult> {
  const baseUrl = resolveAppBaseUrl(params.requestBaseUrl);
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(params.rawToken)}`;
  const subject = 'Acadet CBT – Password Reset Request';

  const { html } = await buildBrandedEmailHtml({
    baseUrl,
    preheader: 'Use this single-use link within 20 minutes to reset your Acadet CBT password.',
    badgeText: 'Password Recovery',
    heading: 'Reset Your Acadet CBT Password',
    greetingName: params.fullName,
    bodyParagraphs: [
      'We received a request to reset the password for your Acadet CBT account.',
      'Click the button below to choose a new secure password. For your protection, Acadet CBT never stores or emails your existing password.',
    ],
    actionLabel: 'Reset Password',
    actionUrl: resetUrl,
    expiryNotice:
      'This password reset link expires in 20 minutes and can only be used once.',
    securityNote:
      'If you did not request a password reset, you can safely ignore this email—your existing password remains unchanged.',
  });

  const text = [
    `Hello ${params.fullName},`,
    '',
    'We received a request to reset your Acadet CBT password.',
    `Open this link within 20 minutes to set a new password: ${resetUrl}`,
    '',
    'This link is single-use and expires after 20 minutes.',
    'If you did not request this, you can ignore this email safely.',
    '',
    'Acadet CBT · Acadet Learning Hub',
  ].join('\n');

  return sendTransactionalEmail({
    userId: params.userId,
    toEmail: params.toEmail,
    emailType: 'password_reset',
    subject,
    html,
    text,
  });
}

export async function sendVerificationEmail(params: {
  userId: string;
  toEmail: string;
  fullName: string;
  rawToken: string;
  requestBaseUrl?: string;
}): Promise<EmailSendResult> {
  const baseUrl = resolveAppBaseUrl(params.requestBaseUrl);
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(params.rawToken)}`;
  const subject = 'Verify Your Acadet CBT Account';

  const { html } = await buildBrandedEmailHtml({
    baseUrl,
    preheader: 'Confirm your email address to verify your Acadet CBT student account.',
    badgeText: 'Email Verification',
    heading: 'Verify Your Acadet CBT Email Address',
    greetingName: params.fullName,
    bodyParagraphs: [
      'Welcome to Acadet CBT! Please verify your email address so you can recover your account safely if you ever forget your password and receive official account updates.',
      'Click the button below to confirm your email address.',
    ],
    actionLabel: 'Verify My Email',
    actionUrl: verifyUrl,
    expiryNotice: 'This verification link expires in 24 hours and can only be used once.',
    securityNote:
      'If you did not create an Acadet CBT account with this email address, no further action is required.',
  });

  const text = [
    `Hello ${params.fullName},`,
    '',
    'Welcome to Acadet CBT! Confirm your email address using the link below:',
    verifyUrl,
    '',
    'This verification link expires in 24 hours and is single-use.',
    '',
    'Acadet CBT · Acadet Learning Hub',
  ].join('\n');

  return sendTransactionalEmail({
    userId: params.userId,
    toEmail: params.toEmail,
    emailType: 'verification',
    subject,
    html,
    text,
  });
}

export async function sendPasswordChangedEmail(params: {
  userId: string;
  toEmail: string;
  fullName: string;
  requestBaseUrl?: string;
}): Promise<EmailSendResult> {
  const baseUrl = resolveAppBaseUrl(params.requestBaseUrl);
  const loginUrl = `${baseUrl}/login`;
  const subject = 'Acadet CBT – Password Successfully Changed';

  let supportContactEmail = 'support@acadetcbt.website';
  try {
    const { branding } = await getPublicBrandingAndFounder();
    if (branding.contactEmail) {
      supportContactEmail = branding.contactEmail;
    }
  } catch {
    // Use default support email fallback
  }

  const { html } = await buildBrandedEmailHtml({
    baseUrl,
    preheader: 'Your Acadet CBT account password has been updated.',
    badgeText: 'Security Confirmation',
    heading: 'Your Password Was Changed Successfully',
    greetingName: params.fullName,
    bodyParagraphs: [
      'This is a confirmation that the password for your Acadet CBT account has just been changed.',
      'All previous active sign-in sessions have been signed out automatically for your security. You can now sign in with your new password.',
    ],
    actionLabel: 'Sign In to Acadet CBT',
    actionUrl: loginUrl,
    securityNote: `If you did not authorize this password change, immediately reset your password or contact Acadet CBT support at ${supportContactEmail}.`,
  });

  const text = [
    `Hello ${params.fullName},`,
    '',
    'Your Acadet CBT account password has been changed successfully.',
    'All previous sessions have been signed out for security.',
    `Sign in here: ${loginUrl}`,
    '',
    'If you did not perform this change, please contact Acadet CBT support immediately.',
  ].join('\n');

  return sendTransactionalEmail({
    userId: params.userId,
    toEmail: params.toEmail,
    emailType: 'password_changed',
    subject,
    html,
    text,
  });
}

export async function sendAdminTestEmail(params: {
  adminUserId: string;
  toEmail: string;
  adminName: string;
  requestBaseUrl?: string;
}): Promise<EmailSendResult> {
  const baseUrl = resolveAppBaseUrl(params.requestBaseUrl);
  const subject = 'Acadet CBT – SMTP Configuration Test';

  const { html } = await buildBrandedEmailHtml({
    baseUrl,
    preheader: 'Acadet CBT transactional SMTP email delivery verification succeeded.',
    badgeText: 'Admin Diagnostics',
    heading: 'SMTP Email Delivery Is Active',
    greetingName: params.adminName,
    bodyParagraphs: [
      'This diagnostic test email confirms that Acadet CBT SMTP configuration, TLS authentication, and branded email templates are working properly on your Render deployment.',
      'Email verification links and password recovery emails are ready for students.',
    ],
    securityNote: 'Sent from the Acadet CBT Admin Console diagnostic tool.',
  });

  const text = [
    `Hello ${params.adminName},`,
    '',
    'Your Acadet CBT SMTP email configuration is active and delivering messages cleanly.',
  ].join('\n');

  return sendTransactionalEmail({
    userId: params.adminUserId,
    toEmail: params.toEmail,
    emailType: 'admin_test',
    subject,
    html,
    text,
  });
}

export interface AdminEmailStatusOverview {
  smtp: SmtpConfigSummary;
  delivery: {
    totalSent: number;
    totalFailed: number;
    totalSkippedUnconfigured: number;
    lastSuccessfulAttemptAt: string | null;
    lastFailedAttemptAt: string | null;
    lastFailureReason: string | null;
    recentLogs: Array<{
      id: string;
      recipientEmail: string;
      emailType: string;
      subject: string;
      deliveryStatus: string;
      errorMessage: string | null;
      createdAt: string;
    }>;
  };
  verificationStats: {
    totalUsers: number;
    verifiedUsers: number;
    unverifiedUsers: number;
    activePendingTokens: number;
    totalVerificationsCompleted: number;
  };
  passwordRecoveryStats: {
    requestsLast24h: number;
    requestsTotal: number;
    completedResetsTotal: number;
    activePendingTokens: number;
    expiredOrInvalidatedTokens: number;
  };
}

export async function getAdminEmailStatusOverview(
  verifyLiveConnection = false
): Promise<AdminEmailStatusOverview> {
  const smtp = verifyLiveConnection
    ? await verifySmtpConnection()
    : getSmtpConfigSummary();

  const pool = getPool();

  const [deliveryAggRes, recentLogsRes, verifUsersRes, verifTokensRes, resetTokensRes] =
    await Promise.all([
      pool.query<{
        totalSent: number;
        totalFailed: number;
        totalSkipped: number;
        lastSuccessAt: Date | null;
        lastFailedAt: Date | null;
        lastFailureReason: string | null;
      }>(`
        SELECT
          COUNT(*) FILTER (WHERE delivery_status = 'sent')::int AS "totalSent",
          COUNT(*) FILTER (WHERE delivery_status = 'failed')::int AS "totalFailed",
          COUNT(*) FILTER (WHERE delivery_status = 'skipped_unconfigured')::int AS "totalSkipped",
          MAX(created_at) FILTER (WHERE delivery_status = 'sent') AS "lastSuccessAt",
          MAX(created_at) FILTER (WHERE delivery_status = 'failed') AS "lastFailedAt",
          (
            SELECT error_message
            FROM email_delivery_logs
            WHERE delivery_status = 'failed' AND error_message IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1
          ) AS "lastFailureReason"
        FROM email_delivery_logs
      `),
      pool.query<{
        id: string;
        recipientEmail: string;
        emailType: string;
        subject: string;
        deliveryStatus: string;
        errorMessage: string | null;
        createdAt: Date;
      }>(`
        SELECT
          id,
          recipient_email AS "recipientEmail",
          email_type AS "emailType",
          subject,
          delivery_status AS "deliveryStatus",
          error_message AS "errorMessage",
          created_at AS "createdAt"
        FROM email_delivery_logs
        ORDER BY created_at DESC
        LIMIT 10
      `),
      pool.query<{
        totalUsers: number;
        verifiedUsers: number;
        unverifiedUsers: number;
      }>(`
        SELECT
          COUNT(*)::int AS "totalUsers",
          COUNT(*) FILTER (WHERE email_verified = TRUE)::int AS "verifiedUsers",
          COUNT(*) FILTER (WHERE email_verified = FALSE)::int AS "unverifiedUsers"
        FROM users
      `),
      pool.query<{
        activePending: number;
        completedCount: number;
      }>(`
        SELECT
          COUNT(*) FILTER (WHERE used_at IS NULL AND invalidated_at IS NULL AND expires_at > NOW())::int AS "activePending",
          COUNT(*) FILTER (WHERE used_at IS NOT NULL)::int AS "completedCount"
        FROM email_verification_tokens
      `),
      pool.query<{
        requestsLast24h: number;
        requestsTotal: number;
        completedTotal: number;
        activePending: number;
        expiredOrInvalidated: number;
      }>(`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS "requestsLast24h",
          COUNT(*)::int AS "requestsTotal",
          COUNT(*) FILTER (WHERE used_at IS NOT NULL)::int AS "completedTotal",
          COUNT(*) FILTER (WHERE used_at IS NULL AND invalidated_at IS NULL AND expires_at > NOW())::int AS "activePending",
          COUNT(*) FILTER (WHERE used_at IS NULL AND (invalidated_at IS NOT NULL OR expires_at <= NOW()))::int AS "expiredOrInvalidated"
        FROM password_reset_tokens
      `),
    ]);

  const dAgg = deliveryAggRes.rows[0];
  const vUsers = verifUsersRes.rows[0];
  const vTokens = verifTokensRes.rows[0];
  const rTokens = resetTokensRes.rows[0];

  return {
    smtp,
    delivery: {
      totalSent: Number(dAgg?.totalSent ?? 0),
      totalFailed: Number(dAgg?.totalFailed ?? 0),
      totalSkippedUnconfigured: Number(dAgg?.totalSkipped ?? 0),
      lastSuccessfulAttemptAt: dAgg?.lastSuccessAt
        ? new Date(dAgg.lastSuccessAt).toISOString()
        : null,
      lastFailedAttemptAt: dAgg?.lastFailedAt
        ? new Date(dAgg.lastFailedAt).toISOString()
        : null,
      lastFailureReason: dAgg?.lastFailureReason ?? null,
      recentLogs: recentLogsRes.rows.map((row) => ({
        ...row,
        createdAt: new Date(row.createdAt).toISOString(),
      })),
    },
    verificationStats: {
      totalUsers: Number(vUsers?.totalUsers ?? 0),
      verifiedUsers: Number(vUsers?.verifiedUsers ?? 0),
      unverifiedUsers: Number(vUsers?.unverifiedUsers ?? 0),
      activePendingTokens: Number(vTokens?.activePending ?? 0),
      totalVerificationsCompleted: Number(vTokens?.completedCount ?? 0),
    },
    passwordRecoveryStats: {
      requestsLast24h: Number(rTokens?.requestsLast24h ?? 0),
      requestsTotal: Number(rTokens?.requestsTotal ?? 0),
      completedResetsTotal: Number(rTokens?.completedTotal ?? 0),
      activePendingTokens: Number(rTokens?.activePending ?? 0),
      expiredOrInvalidatedTokens: Number(rTokens?.expiredOrInvalidated ?? 0),
    },
  };
}
