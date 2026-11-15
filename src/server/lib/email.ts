import crypto from 'node:crypto';
import { getPool, isDatabaseConfigured } from '../../db/index.js';
import { getPublicBrandingAndFounder } from './branding.js';

export type EmailServiceConnectionStatus =
  | 'connected'
  | 'unconfigured'
  | 'connection_failed'
  | 'unknown';

export type TransactionalEmailType =
  | 'verification'
  | 'password_reset'
  | 'password_changed'
  | 'admin_test';

export type EmailDeliveryStatus =
  | 'queued'
  | 'delivered'
  | 'bounced'
  | 'sent'
  | 'failed'
  | 'skipped_unconfigured';

export interface EmailServiceConfigSummary {
  provider: 'Resend Transactional Email API';
  configured: boolean;
  missingVariables: string[];
  validationErrors: string[];
  apiUrl: string | null;
  apiKeyMasked: string | null;
  fromEmail: string | null;
  replyToEmail: string | null;
  appBaseUrl: string;
  connectionStatus: EmailServiceConnectionStatus;
  lastCheckedAt: string | null;
  lastError: string | null;
}

export interface EmailSendResult {
  sent: boolean;
  accepted: boolean;
  deliveredConfirmed: boolean;
  status: EmailDeliveryStatus;
  messageId?: string;
  providerMessageUuid?: string;
  providerMessageStatus?: string;
  deliveryCheckNote?: string;
  error?: string;
}

export const REQUIRED_EMAIL_ENV_VARS = [
  'RESEND_API_KEY',
  'SMTP_FROM_EMAIL',
  'APP_BASE_URL',
] as const;

export const DEFAULT_RESEND_API_URL = 'https://api.resend.com';

const FREE_CONSUMER_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'ymail.com',
  'mail.com',
]);

let runtimeConnectionStatus: EmailServiceConnectionStatus = 'unknown';
let runtimeLastCheckedAt: string | null = null;
let runtimeLastError: string | null = null;

function sanitizeEmailApiErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || 'Resend email API request failed');
  let cleaned = raw;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey && apiKey.length >= 6) {
    cleaned = cleaned.split(apiKey).join('[REDACTED_API_KEY]');
  }

  cleaned = cleaned
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [REDACTED]')
    .replace(/\bre_[A-Za-z0-9_\-]{6,}/gi, '[REDACTED_RESEND_KEY]');

  return cleaned.slice(0, 500);
}

function maskApiKey(raw: string | undefined): string | null {
  const val = raw?.trim();
  if (!val) return null;
  if (val.length <= 10) return '****';
  return `${val.slice(0, 7)}...${val.slice(-4)}`;
}

/**
 * Extracts a bare local@domain email address if configured with display-name syntax
 * (e.g. "Acadet CBT <noreply@acadetcbt.website>" -> "noreply@acadetcbt.website").
 */
export function extractBareEmailAddress(raw: string | undefined | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const angleMatch = trimmed.match(/<([^<>\s]+@[^<>\s]+)>/);
  const candidate = (angleMatch ? angleMatch[1] : trimmed).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
    return null;
  }
  return candidate;
}

function isNoReplyAddress(email: string): boolean {
  const local = (email.split('@')[0] || '').toLowerCase();
  return /^(no-?reply|donotreply|do-not-reply|mailer-daemon)$/.test(local);
}

export function resolveReplyToAddress(
  fromEmail: string | null,
  preferredContactEmail?: string | null
): string {
  const candidates = [
    extractBareEmailAddress(process.env.EMAIL_REPLY_TO),
    extractBareEmailAddress(preferredContactEmail),
    'support@acadetcbt.website',
  ];

  for (const candidate of candidates) {
    if (
      candidate &&
      !isNoReplyAddress(candidate) &&
      (!fromEmail || candidate.toLowerCase() !== fromEmail.toLowerCase())
    ) {
      return candidate;
    }
  }

  if (fromEmail && fromEmail.includes('@')) {
    const domain = fromEmail.split('@')[1]?.toLowerCase();
    if (domain && !FREE_CONSUMER_EMAIL_DOMAINS.has(domain)) {
      return `support@${domain}`;
    }
  }

  return 'support@acadetcbt.website';
}

/**
 * Normalizes RESEND_API_URL to Resend's canonical base URL
 * (e.g. "https://api.resend.com"). Handles accidental trailing "/" or "/emails".
 */
export function normalizeResendApiBaseUrl(rawUrl: string | undefined): string {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return DEFAULT_RESEND_API_URL;
  return trimmed.replace(/\/+$/, '').replace(/\/emails$/i, '');
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

export function getEmailConfigSummary(): EmailServiceConfigSummary {
  const apiKey = process.env.RESEND_API_KEY?.trim() || null;
  const rawApiUrl = process.env.RESEND_API_URL?.trim();
  const apiUrl = normalizeResendApiBaseUrl(rawApiUrl);
  // SMTP_FROM_EMAIL is used strictly as the verified Resend sender email address (no SMTP).
  const rawFromEmail = process.env.SMTP_FROM_EMAIL?.trim() || null;
  const fromEmail = extractBareEmailAddress(rawFromEmail) || rawFromEmail;
  const appBaseUrlEnv = process.env.APP_BASE_URL?.trim() || null;

  const missingVariables: string[] = [];
  if (!apiKey) missingVariables.push('RESEND_API_KEY');
  if (!fromEmail) missingVariables.push('SMTP_FROM_EMAIL');
  if (!appBaseUrlEnv) missingVariables.push('APP_BASE_URL');

  const validationErrors: string[] = [];
  if (rawApiUrl && !/^https?:\/\//i.test(apiUrl)) {
    validationErrors.push(
      'RESEND_API_URL must start with https:// or http:// (e.g. https://api.resend.com).'
    );
  }
  if (fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
    validationErrors.push(
      'SMTP_FROM_EMAIL must be a valid verified sender email address (e.g. noreply@acadetcbt.website).'
    );
  } else if (fromEmail) {
    const senderDomain = fromEmail.split('@')[1]?.toLowerCase() || '';
    if (FREE_CONSUMER_EMAIL_DOMAINS.has(senderDomain)) {
      validationErrors.push(
        `SMTP_FROM_EMAIL (${fromEmail}) uses a public email domain (@${senderDomain}). Set SMTP_FROM_EMAIL=noreply@acadetcbt.website (a verified domain in Resend).`
      );
    }
  }
  if (appBaseUrlEnv && !/^https?:\/\//i.test(appBaseUrlEnv)) {
    validationErrors.push('APP_BASE_URL must start with https:// or http://.');
  }

  const coreApiPresent = Boolean(
    apiKey && apiUrl && fromEmail && validationErrors.length === 0
  );

  const connectionStatus: EmailServiceConnectionStatus = !coreApiPresent
    ? 'unconfigured'
    : runtimeConnectionStatus === 'unconfigured'
      ? 'unknown'
      : runtimeConnectionStatus;

  return {
    provider: 'Resend Transactional Email API',
    configured: coreApiPresent,
    missingVariables,
    validationErrors,
    apiUrl,
    apiKeyMasked: maskApiKey(apiKey || undefined),
    fromEmail,
    replyToEmail: fromEmail ? resolveReplyToAddress(fromEmail) : null,
    appBaseUrl: resolveAppBaseUrl(),
    connectionStatus,
    lastCheckedAt: runtimeLastCheckedAt,
    lastError: coreApiPresent
      ? runtimeLastError
      : validationErrors.length > 0
        ? validationErrors.join(' ')
        : `Missing required environment variables: ${missingVariables.join(', ')}`,
  };
}

export function isEmailConfigured(): boolean {
  return getEmailConfigSummary().configured;
}

export function validateEmailStartup(): EmailServiceConfigSummary {
  const summary = getEmailConfigSummary();
  if (!summary.configured) {
    console.warn(
      `[Email / Resend Warning] Transactional emails are not active. Missing or invalid Render environment variables: ${
        [...summary.missingVariables, ...summary.validationErrors].join('; ') || 'unknown'
      }. Required variables: ${REQUIRED_EMAIL_ENV_VARS.join(', ')}.`
    );
  } else {
    console.log(
      `[Email / Resend API] Configured for POST ${summary.apiUrl}/emails (from=${summary.fromEmail}, base=${summary.appBaseUrl}).`
    );
  }
  return summary;
}

interface ResendErrorBody {
  statusCode?: number;
  name?: string;
  message?: string;
  error?: string;
}

function formatResendHttpError(status: number, body: ResendErrorBody | null): {
  code?: string;
  message: string;
  retryable: boolean;
} {
  const code = typeof body?.name === 'string' ? body.name : undefined;
  const detail =
    (typeof body?.message === 'string' && body.message) ||
    (typeof body?.error === 'string' && body.error) ||
    `Resend API returned HTTP ${status}`;

  if (status === 401 && /restricted|only send emails/i.test(detail)) {
    return {
      code: code || 'restricted_api_key',
      message: sanitizeEmailApiErrorMessage(`Resend API key scope restriction (401): ${detail}`),
      retryable: false,
    };
  }
  if (status === 401 || code === 'invalid_api_Key' || code === 'missing_api_key') {
    return {
      code: code || 'invalid_api_key',
      message: 'Resend API authentication failed (401). Please verify RESEND_API_KEY.',
      retryable: false,
    };
  }
  if (status === 403) {
    return {
      code: code || 'forbidden',
      message: sanitizeEmailApiErrorMessage(
        `Resend API permission or domain verification error (403): ${detail}`
      ),
      retryable: false,
    };
  }
  if (status === 422 || status === 400) {
    return {
      code,
      message: sanitizeEmailApiErrorMessage(`Resend rejected email payload (${status}): ${detail}`),
      retryable: false,
    };
  }
  if (status === 429) {
    return {
      code: code || 'rate_limit_exceeded',
      message: sanitizeEmailApiErrorMessage(
        `Resend API rate limit or daily quota reached (429): ${detail}`
      ),
      retryable: true,
    };
  }

  return {
    code,
    message: sanitizeEmailApiErrorMessage(`Resend API error (${status}): ${detail}`),
    retryable: status >= 500,
  };
}

export async function verifyEmailServiceConnection(): Promise<
  EmailServiceConfigSummary & { scopeNote?: string }
> {
  const summary = getEmailConfigSummary();
  runtimeLastCheckedAt = new Date().toISOString();

  if (!summary.configured || !summary.apiUrl) {
    runtimeConnectionStatus = 'unconfigured';
    runtimeLastError = summary.lastError;
    return getEmailConfigSummary();
  }

  const apiKey = process.env.RESEND_API_KEY?.trim() || '';

  try {
    const response = await fetch(`${summary.apiUrl}/domains`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    let parsedBody: Record<string, unknown> | null = null;
    try {
      parsedBody = (await response.json()) as Record<string, unknown>;
    } catch {
      parsedBody = null;
    }

    if (response.ok) {
      const domainsList = Array.isArray(parsedBody?.data)
        ? (parsedBody.data as Array<{ name?: string; status?: string }>)
        : [];
      const fromDomain = summary.fromEmail?.split('@')[1]?.toLowerCase() || '';
      const matchedDomain = fromDomain
        ? domainsList.find((d) => String(d.name || '').toLowerCase() === fromDomain)
        : undefined;

      runtimeConnectionStatus = 'connected';
      runtimeLastError = null;
      if (matchedDomain && matchedDomain.status && matchedDomain.status !== 'verified') {
        return {
          ...getEmailConfigSummary(),
          scopeNote: `Resend API connected, but domain "${fromDomain}" status is "${matchedDomain.status}" (DNS verification still pending in Resend).`,
        };
      }
      return getEmailConfigSummary();
    }

    // Sending-access-only Resend keys return 401/403 on GET /domains with a restriction message.
    const rawMsg = typeof parsedBody?.message === 'string' ? parsedBody.message : '';
    const rawName = typeof parsedBody?.name === 'string' ? parsedBody.name : '';
    if (
      (response.status === 401 || response.status === 403) &&
      (/restricted|only send emails/i.test(rawMsg) || rawName === 'restricted_api_key')
    ) {
      runtimeConnectionStatus = 'connected';
      runtimeLastError = null;
      return {
        ...getEmailConfigSummary(),
        scopeNote:
          'Resend Bearer API key authenticated (scoped to Sending access). Dispatch a test email to confirm end-to-end delivery.',
      };
    }

    const formatted = formatResendHttpError(
      response.status,
      (parsedBody as ResendErrorBody | null) ?? null
    );
    runtimeConnectionStatus = 'connection_failed';
    runtimeLastError = formatted.message;
    console.error('[Email / Resend Connection Check Failed]', runtimeLastError);
  } catch (err) {
    runtimeConnectionStatus = 'connection_failed';
    runtimeLastError = sanitizeEmailApiErrorMessage(err);
    console.error('[Email / Resend Connection Check Failed]', runtimeLastError);
  }

  return getEmailConfigSummary();
}

async function lookupResendMessageStatus(params: {
  apiUrl: string;
  apiKey: string;
  emailId: string;
}): Promise<{
  checked: boolean;
  status?: string;
  error?: string;
}> {
  try {
    const response = await fetch(
      `${params.apiUrl}/emails/${encodeURIComponent(params.emailId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      return { checked: false };
    }

    const data = (await response.json()) as Record<string, unknown>;
    const lastEvent =
      typeof data.last_event === 'string' ? data.last_event.toLowerCase() : undefined;
    const error =
      typeof data.error === 'string'
        ? data.error
        : typeof data.reason === 'string'
          ? data.reason
          : undefined;
    return { checked: true, status: lastEvent, error };
  } catch {
    return { checked: false };
  }
}

async function recordEmailDeliveryAttempt(params: {
  userId?: string | null;
  recipientEmail: string;
  emailType: TransactionalEmailType;
  subject: string;
  deliveryStatus: EmailDeliveryStatus;
  messageId?: string | null;
  providerMessageUuid?: string | null;
  providerStatus?: string | null;
  errorMessage?: string | null;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO email_delivery_logs (
         user_id, recipient_email, email_type, subject, delivery_status, message_id, provider_message_uuid, provider_status, error_message
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        params.userId ?? null,
        params.recipientEmail.toLowerCase(),
        params.emailType,
        params.subject,
        params.deliveryStatus,
        params.messageId ?? null,
        params.providerMessageUuid ?? null,
        params.providerStatus ?? null,
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

async function postResendSend(params: {
  apiUrl: string;
  apiKey: string;
  idempotencyKey: string;
  from: string;
  replyTo?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{
  ok: boolean;
  providerMessageUuid?: string;
  messageId?: string;
  providerStatus?: string;
  error?: string;
}> {
  const endpoint = `${params.apiUrl}/emails`;
  const formattedFrom = params.from.includes('<') ? params.from : `Acadet CBT <${params.from}>`;
  const payloadObj: Record<string, unknown> = {
    from: formattedFrom,
    to: [params.to],
    subject: params.subject,
    html: params.html,
    text: params.text,
  };
  if (params.replyTo) {
    payloadObj.reply_to = params.replyTo;
  }
  const payload = JSON.stringify(payloadObj);

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          'Idempotency-Key': params.idempotencyKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: payload,
        signal: AbortSignal.timeout(12000),
      });

      const rawText = await response.text();
      let jsonBody: Record<string, unknown> | null = null;
      if (rawText) {
        try {
          jsonBody = JSON.parse(rawText) as Record<string, unknown>;
        } catch {
          jsonBody = null;
        }
      }

      if (response.ok) {
        const providerMessageUuid =
          typeof jsonBody?.id === 'string' && jsonBody.id ? jsonBody.id : undefined;
        return {
          ok: true,
          providerMessageUuid,
          messageId: providerMessageUuid,
          providerStatus: 'queued',
        };
      }

      const formatted = formatResendHttpError(
        response.status,
        (jsonBody as ResendErrorBody | null) ?? null
      );

      if (formatted.retryable && attempt < maxAttempts) {
        const retryAfterRaw = response.headers.get('retry-after');
        const retryAfterSec = retryAfterRaw ? Number(retryAfterRaw) : NaN;
        const waitMs =
          Number.isFinite(retryAfterSec) && retryAfterSec > 0 && retryAfterSec <= 2
            ? retryAfterSec * 1000
            : 350;
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      return { ok: false, error: formatted.message };
    } catch (err) {
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }
      return { ok: false, error: sanitizeEmailApiErrorMessage(err) };
    }
  }

  return { ok: false, error: 'Resend email API request failed.' };
}

async function sendTransactionalEmail(params: {
  userId?: string | null;
  toEmail: string;
  emailType: TransactionalEmailType;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  verifyDeliveryAfterAccept?: boolean;
}): Promise<EmailSendResult> {
  const summary = getEmailConfigSummary();
  if (!summary.configured || !summary.apiUrl || !summary.fromEmail) {
    const errMsg = `Resend email service not configured (${summary.missingVariables.join(', ') || summary.validationErrors.join('; ') || 'invalid settings'}).`;
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
      accepted: false,
      deliveredConfirmed: false,
      status: 'skipped_unconfigured',
      error: errMsg,
    };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim() || '';
  const idempotencyKey = `acadet-${params.emailType}-${crypto.randomUUID()}`;
  const replyTo = resolveReplyToAddress(summary.fromEmail, params.replyTo);

  const apiOutcome = await postResendSend({
    apiUrl: summary.apiUrl,
    apiKey,
    idempotencyKey,
    from: summary.fromEmail,
    replyTo,
    to: params.toEmail,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  if (!apiOutcome.ok) {
    const cleanErr = apiOutcome.error || 'Resend email submission failed.';
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
      accepted: false,
      deliveredConfirmed: false,
      status: 'failed',
      error: cleanErr,
    };
  }

  let finalStatus: EmailDeliveryStatus = 'queued';
  let deliveredConfirmed = false;
  let providerStatus = apiOutcome.providerStatus || 'queued';
  let deliveryCheckNote: string | undefined;

  if (params.verifyDeliveryAfterAccept && apiOutcome.providerMessageUuid) {
    await new Promise((r) => setTimeout(r, 600));
    const lookup = await lookupResendMessageStatus({
      apiUrl: summary.apiUrl,
      apiKey,
      emailId: apiOutcome.providerMessageUuid,
    });

    if (lookup.checked && lookup.status) {
      providerStatus = lookup.status;
      if (lookup.status === 'delivered') {
        finalStatus = 'delivered';
        deliveredConfirmed = true;
      } else if (
        lookup.status === 'bounced' ||
        lookup.status === 'failed' ||
        lookup.status === 'canceled' ||
        lookup.status === 'complained'
      ) {
        finalStatus = lookup.status === 'bounced' ? 'bounced' : 'failed';
        const bounceErr = sanitizeEmailApiErrorMessage(
          lookup.error || `Resend reported message status: ${lookup.status}.`
        );
        await recordEmailDeliveryAttempt({
          userId: params.userId,
          recipientEmail: params.toEmail,
          emailType: params.emailType,
          subject: params.subject,
          deliveryStatus: finalStatus,
          messageId: apiOutcome.messageId || null,
          providerMessageUuid: apiOutcome.providerMessageUuid || null,
          providerStatus,
          errorMessage: bounceErr,
        });
        return {
          sent: false,
          accepted: true,
          deliveredConfirmed: false,
          status: finalStatus,
          messageId: apiOutcome.messageId,
          providerMessageUuid: apiOutcome.providerMessageUuid,
          providerMessageStatus: providerStatus,
          error: bounceErr,
        };
      } else {
        deliveryCheckNote = `Resend reported status "${lookup.status}".`;
      }
    } else {
      deliveryCheckNote =
        'Resend accepted the email for delivery; check the recipient mailbox or Resend Logs for final inbox confirmation.';
    }
  }

  runtimeConnectionStatus = 'connected';
  runtimeLastCheckedAt = new Date().toISOString();
  runtimeLastError = null;

  await recordEmailDeliveryAttempt({
    userId: params.userId,
    recipientEmail: params.toEmail,
    emailType: params.emailType,
    subject: params.subject,
    deliveryStatus: finalStatus,
    messageId: apiOutcome.messageId || null,
    providerMessageUuid: apiOutcome.providerMessageUuid || null,
    providerStatus,
  });

  return {
    sent: true,
    accepted: true,
    deliveredConfirmed,
    status: finalStatus,
    messageId: apiOutcome.messageId,
    providerMessageUuid: apiOutcome.providerMessageUuid,
    providerMessageStatus: providerStatus,
    deliveryCheckNote,
  };
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

  const { html, contactEmail } = await buildBrandedEmailHtml({
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
    replyTo: contactEmail,
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

  const { html, contactEmail } = await buildBrandedEmailHtml({
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
    replyTo: contactEmail,
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

  const { html, contactEmail } = await buildBrandedEmailHtml({
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
    replyTo: contactEmail,
  });
}

export async function sendAdminTestEmail(params: {
  adminUserId: string;
  toEmail: string;
  adminName: string;
  requestBaseUrl?: string;
}): Promise<EmailSendResult> {
  const baseUrl = resolveAppBaseUrl(params.requestBaseUrl);
  const subject = 'Acadet CBT – Resend Email Delivery Test';

  const { html, contactEmail } = await buildBrandedEmailHtml({
    baseUrl,
    preheader: 'Acadet CBT transactional email test submitted via Resend API.',
    badgeText: 'Admin Diagnostics',
    heading: 'Resend Email Diagnostic Test',
    greetingName: params.adminName,
    bodyParagraphs: [
      'This diagnostic email was submitted through the Resend Transactional Email API (POST /emails) from the Acadet CBT Admin Console.',
      'Receiving this message in your inbox confirms end-to-end delivery from noreply@acadetcbt.website.',
    ],
    securityNote: 'Sent from the Acadet CBT Admin Console diagnostic tool.',
  });

  const text = [
    `Hello ${params.adminName},`,
    '',
    'This diagnostic email confirms end-to-end delivery through the Resend Transactional Email API.',
  ].join('\n');

  return sendTransactionalEmail({
    userId: params.adminUserId,
    toEmail: params.toEmail,
    emailType: 'admin_test',
    subject,
    html,
    text,
    replyTo: contactEmail,
    verifyDeliveryAfterAccept: true,
  });
}

export interface AdminEmailStatusOverview {
  emailService: EmailServiceConfigSummary;
  delivery: {
    totalAcceptedQueued: number;
    totalDeliveredConfirmed: number;
    totalSent: number;
    totalFailed: number;
    totalSkippedUnconfigured: number;
    lastSuccessfulAttemptAt: string | null;
    lastDeliveredConfirmedAt: string | null;
    lastFailedAttemptAt: string | null;
    lastFailureReason: string | null;
    recentLogs: Array<{
      id: string;
      recipientEmail: string;
      emailType: string;
      subject: string;
      deliveryStatus: string;
      messageId: string | null;
      providerMessageUuid: string | null;
      providerStatus: string | null;
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
  const emailService = verifyLiveConnection
    ? await verifyEmailServiceConnection()
    : getEmailConfigSummary();

  const pool = getPool();

  const [deliveryAggRes, recentLogsRes, verifUsersRes, verifTokensRes, resetTokensRes] =
    await Promise.all([
      pool.query<{
        totalQueued: number;
        totalDelivered: number;
        totalFailed: number;
        totalSkipped: number;
        lastAcceptedAt: Date | null;
        lastDeliveredAt: Date | null;
        lastFailedAt: Date | null;
        lastFailureReason: string | null;
      }>(`
        SELECT
          COUNT(*) FILTER (WHERE delivery_status IN ('queued', 'sent'))::int AS "totalQueued",
          COUNT(*) FILTER (WHERE delivery_status = 'delivered')::int AS "totalDelivered",
          COUNT(*) FILTER (WHERE delivery_status IN ('failed', 'bounced'))::int AS "totalFailed",
          COUNT(*) FILTER (WHERE delivery_status = 'skipped_unconfigured')::int AS "totalSkipped",
          MAX(created_at) FILTER (WHERE delivery_status IN ('queued', 'delivered', 'sent')) AS "lastAcceptedAt",
          MAX(created_at) FILTER (WHERE delivery_status = 'delivered') AS "lastDeliveredAt",
          MAX(created_at) FILTER (WHERE delivery_status IN ('failed', 'bounced')) AS "lastFailedAt",
          (
            SELECT error_message
            FROM email_delivery_logs
            WHERE delivery_status IN ('failed', 'bounced') AND error_message IS NOT NULL
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
        messageId: string | null;
        providerMessageUuid: string | null;
        providerStatus: string | null;
        errorMessage: string | null;
        createdAt: Date;
      }>(`
        SELECT
          id,
          recipient_email AS "recipientEmail",
          email_type AS "emailType",
          subject,
          delivery_status AS "deliveryStatus",
          message_id AS "messageId",
          provider_message_uuid AS "providerMessageUuid",
          provider_status AS "providerStatus",
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

  const totalQueued = Number(dAgg?.totalQueued ?? 0);
  const totalDelivered = Number(dAgg?.totalDelivered ?? 0);

  return {
    emailService,
    delivery: {
      totalAcceptedQueued: totalQueued,
      totalDeliveredConfirmed: totalDelivered,
      totalSent: totalQueued + totalDelivered,
      totalFailed: Number(dAgg?.totalFailed ?? 0),
      totalSkippedUnconfigured: Number(dAgg?.totalSkipped ?? 0),
      lastSuccessfulAttemptAt: dAgg?.lastAcceptedAt
        ? new Date(dAgg.lastAcceptedAt).toISOString()
        : null,
      lastDeliveredConfirmedAt: dAgg?.lastDeliveredAt
        ? new Date(dAgg.lastDeliveredAt).toISOString()
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
