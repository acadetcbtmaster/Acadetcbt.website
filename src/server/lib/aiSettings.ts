import crypto from 'node:crypto';
import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { eq } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../../db/index.js';
import { aiProviderSettings } from '../../db/schema.js';

export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';
export const SUPPORTED_GEMINI_MODELS = [
  'gemini-4-hydrogen',
  'gemini-4-neon',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
] as const;

export type SupportedGeminiModel = (typeof SUPPORTED_GEMINI_MODELS)[number];

export type AiConnectionStatus = 'connected' | 'failed' | 'unconfigured' | 'unknown';
export type AiKeySource = 'database' | 'environment' | 'none';

export interface AiSettingsSummary {
  configured: boolean;
  source: AiKeySource;
  maskedKey: string | null;
  modelName: string;
  connectionStatus: AiConnectionStatus;
  lastTestedAt: string | null;
  lastTestMessage: string | null;
  updatedAt: string | null;
}

function deriveEncryptionKey(): Buffer {
  const secret =
    process.env.AI_KEY_ENCRYPTION_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    'acadet-cbt-backend-gemini-key-secret-v1';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptApiKey(plainKey: string): string {
  const key = deriveEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptApiKey(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const parts = payload.split(':');
  if (parts.length !== 3) return null;
  try {
    const [ivHex, tagHex, dataHex] = parts;
    const key = deriveEncryptionKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    const trimmed = decrypted.toString('utf8').trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

export function normalizeGeminiApiKey(rawKey: string): string {
  let clean = rawKey.trim();
  // Strip accidental surrounding quotes from .env or clipboard copy
  if (
    (clean.startsWith('"') && clean.endsWith('"')) ||
    (clean.startsWith("'") && clean.endsWith("'"))
  ) {
    clean = clean.slice(1, -1).trim();
  }
  // Strip accidental GEMINI_API_KEY= or Bearer prefix if pasted from config
  clean = clean.replace(/^(?:GEMINI_API_KEY|API_KEY)\s*=\s*/i, '').trim();
  clean = clean.replace(/^Bearer\s+/i, '').trim();
  if (
    (clean.startsWith('"') && clean.endsWith('"')) ||
    (clean.startsWith("'") && clean.endsWith("'"))
  ) {
    clean = clean.slice(1, -1).trim();
  }

  if (clean.length < 15 || clean.length > 1000 || /\s/.test(clean)) {
    throw new Error(
      'Invalid Gemini API key format. Paste only your API key (at least 15 characters, with no spaces).'
    );
  }
  return clean;
}

export function maskApiKey(rawKey: string | null | undefined): string | null {
  if (!rawKey) return null;
  const trimmed = rawKey.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}••••${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 6)}••••••••${trimmed.slice(-4)}`;
}

export function maskSensitiveKeysInMessage(rawMessage: string): string {
  return rawMessage
    .replace(/AIza[0-9A-Za-z_-]{8,}/g, 'AIza••••••••')
    .replace(/AQ\.[0-9A-Za-z._-]{8,}/g, 'AQ.••••••••');
}

export function formatGeminiErrorMessage(err: unknown): string {
  let rawMsg = err instanceof Error ? err.message : String(err || 'Gemini API request failed.');

  // Google SDK errors frequently embed JSON payloads inside Error.message
  const jsonStart = rawMsg.indexOf('{');
  if (jsonStart !== -1) {
    const candidateJson = rawMsg.slice(jsonStart);
    try {
      const parsed = JSON.parse(candidateJson) as {
        error?: { message?: string; status?: string; code?: number };
        message?: string;
      };
      const nestedMsg = parsed?.error?.message || parsed?.message;
      if (typeof nestedMsg === 'string' && nestedMsg.trim()) {
        rawMsg = nestedMsg.trim();
      }
    } catch {
      // Keep original string if not valid JSON
    }
  }

  const sanitized = maskSensitiveKeysInMessage(rawMsg).trim();
  const lower = sanitized.toLowerCase();

  if (
    lower.includes('api key not valid') ||
    lower.includes('api_key_invalid') ||
    lower.includes('invalid api key')
  ) {
    return 'Google rejected this API key as invalid for both Gemini Developer API and Vertex AI Express Mode. Verify that you copied the full key from Google AI Studio or Google Cloud Console, and check that it has no HTTP-referrer restrictions (backend servers require unrestricted or API-only key restrictions).';
  }

  if (lower.includes('referer') || lower.includes('referrer') || lower.includes('ip_address')) {
    return 'This API key has HTTP-referrer or IP restrictions that block server-side requests. In Google Cloud Console, set Application Restrictions to "None" for backend server usage.';
  }

  if (lower.includes('permission_denied') || lower.includes('permission denied')) {
    return `Permission denied by Google API: ${sanitized}`;
  }

  if (lower.includes('resource_exhausted') || lower.includes('quota')) {
    return `Gemini API quota or rate limit exceeded: ${sanitized}`;
  }

  if (
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('unavailable') ||
    lower.includes('503')
  ) {
    return `${sanitized} All fallback Gemini models were temporarily busy; please retry in a few seconds (existing data was not changed).`;
  }

  return sanitized || 'Gemini API request failed.';
}

export function sanitizeModelName(modelName?: string | null): string {
  const candidate = (modelName || '').trim();
  if ((SUPPORTED_GEMINI_MODELS as readonly string[]).includes(candidate)) {
    return candidate;
  }
  return DEFAULT_GEMINI_MODEL;
}

export function createGeminiClient(apiKey: string, options?: { vertexai?: boolean }): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    ...(options?.vertexai ? { vertexai: true } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isModelUnavailableError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
  return (
    msg.includes('not_found') ||
    msg.includes('not found') ||
    msg.includes('is not supported for generatecontent') ||
    msg.includes('unknown model') ||
    msg.includes('404')
  );
}

function isTransientOverloadError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
  return (
    msg.includes('high demand') ||
    msg.includes('experiencing high demand') ||
    msg.includes('overloaded') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('try again later') ||
    msg.includes('unavailable') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('504') ||
    msg.includes('500') ||
    msg.includes('internal') ||
    msg.includes('resource_exhausted') ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('deadline_exceeded') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed')
  );
}

function isEndpointOrKeyAuthError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
  return (
    msg.includes('api key not valid') ||
    msg.includes('api_key_invalid') ||
    msg.includes('api keys are not supported') ||
    msg.includes('invalid_argument') ||
    msg.includes('unauthenticated') ||
    msg.includes('permission_denied') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('400')
  );
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes a Gemini `generateContent` call supporting:
 * 1) Standard Google AI Studio Gemini API keys (`generativelanguage.googleapis.com`)
 * 2) Google Cloud Vertex AI Express Mode keys (`AQ.*` with `vertexai: true`)
 * 3) Exponential backoff retries + automatic failover across healthy Gemini models
 *    (`gemini-3.1-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-4-hydrogen`)
 *    whenever a model hits 503 high demand, rate-limits, or is unavailable on an external key.
 */
export async function executeGeminiGenerateContent(params: {
  apiKey: string;
  modelName: string;
  contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'];
  config?: Parameters<GoogleGenAI['models']['generateContent']>[0]['config'];
}): Promise<{
  response: GenerateContentResponse;
  usedModel: string;
  usedVertexExpress: boolean;
}> {
  const cleanKey = params.apiKey.trim();
  const primaryModel = sanitizeModelName(params.modelName);
  const candidateModels = Array.from(
    new Set([
      primaryModel,
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-4-hydrogen',
    ])
  );

  // Try Vertex Express Mode first for AQ.* keys and standard Developer API first for AIza* keys
  const modes: Array<{ vertexai: boolean }> = cleanKey.startsWith('AQ.')
    ? [{ vertexai: true }, { vertexai: false }]
    : [{ vertexai: false }, { vertexai: true }];

  let lastErr: unknown = null;
  let lastNonAuthErr: unknown = null;

  for (const mode of modes) {
    const ai = createGeminiClient(cleanKey, { vertexai: mode.vertexai });
    let sawOnlyAuthErrorsInMode = true;

    for (let i = 0; i < candidateModels.length; i += 1) {
      const model = candidateModels[i];
      // Retry primary model briefly before failing over; retry fallback model once if it's the last option
      const maxAttemptsForModel = i === 0 || i === candidateModels.length - 1 ? 2 : 1;

      for (let attempt = 0; attempt < maxAttemptsForModel; attempt += 1) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: params.contents,
            ...(params.config ? { config: params.config } : {}),
          });
          return {
            response,
            usedModel: model,
            usedVertexExpress: mode.vertexai,
          };
        } catch (err) {
          lastErr = err;
          if (!isEndpointOrKeyAuthError(err)) {
            sawOnlyAuthErrorsInMode = false;
            lastNonAuthErr = err;
          }

          if (isTransientOverloadError(err)) {
            if (attempt + 1 < maxAttemptsForModel) {
              await sleepMs(attempt === 0 ? 700 : 1400);
              continue;
            }
            // Move immediately to the next fallback model on sustained high demand / 503 / 429
            break;
          }

          // If model isn't enabled on this key/endpoint, try next candidate model in same mode
          if (isModelUnavailableError(err)) {
            break;
          }

          // If endpoint/key auth failed (e.g. Vertex Express AQ. key sent to Developer API), switch mode
          if (isEndpointOrKeyAuthError(err)) {
            break;
          }

          throw err;
        }
      }

      // If endpoint/key auth failed on this mode, no need to test remaining models in this same mode
      if (isEndpointOrKeyAuthError(lastErr) && sawOnlyAuthErrorsInMode) {
        break;
      }
    }

    // If this mode successfully authenticated (errors were 503/rate-limit, not auth),
    // don't fall back to the incompatible auth endpoint where it would fail with 401/400.
    if (!sawOnlyAuthErrorsInMode && !isModelUnavailableError(lastNonAuthErr)) {
      break;
    }
  }

  const finalErr = lastNonAuthErr ?? lastErr;
  throw finalErr instanceof Error ? finalErr : new Error('Gemini API request failed.');
}

export async function getConfiguredGeminiCredentials(): Promise<{
  apiKey: string | null;
  source: AiKeySource;
  modelName: string;
  keyHint: string | null;
  lastTestedAt: Date | null;
  lastTestStatus: AiConnectionStatus;
  lastTestMessage: string | null;
  updatedAt: Date | null;
}> {
  const envKey = process.env.GEMINI_API_KEY?.trim() || null;

  if (!isDatabaseConfigured()) {
    return {
      apiKey: envKey,
      source: envKey ? 'environment' : 'none',
      modelName: DEFAULT_GEMINI_MODEL,
      keyHint: maskApiKey(envKey),
      lastTestedAt: null,
      lastTestStatus: envKey ? 'unknown' : 'unconfigured',
      lastTestMessage: envKey
        ? 'Loaded from server environment variable (GEMINI_API_KEY).'
        : 'No Gemini API key configured yet.',
      updatedAt: null,
    };
  }

  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(aiProviderSettings)
      .where(eq(aiProviderSettings.id, 'default'))
      .limit(1);

    const dbKey = decryptApiKey(row?.encryptedApiKey);
    const activeKey = dbKey || envKey;
    const source: AiKeySource = dbKey ? 'database' : envKey ? 'environment' : 'none';
    const modelName = sanitizeModelName(row?.modelName);

    const connectionStatus: AiConnectionStatus = !activeKey
      ? 'unconfigured'
      : row?.lastTestStatus === 'connected' ||
          row?.lastTestStatus === 'failed' ||
          row?.lastTestStatus === 'unknown'
        ? row.lastTestStatus
        : 'unknown';

    return {
      apiKey: activeKey,
      source,
      modelName,
      keyHint: dbKey ? row?.keyHint || maskApiKey(dbKey) : maskApiKey(envKey),
      lastTestedAt: row?.lastTestedAt ?? null,
      lastTestStatus: connectionStatus,
      lastTestMessage:
        row?.lastTestMessage ??
        (source === 'environment'
          ? 'Using server environment GEMINI_API_KEY.'
          : source === 'none'
            ? 'Enter and save your Gemini API key to enable AI Question Generation.'
            : null),
      updatedAt: row?.updatedAt ?? null,
    };
  } catch {
    return {
      apiKey: envKey,
      source: envKey ? 'environment' : 'none',
      modelName: DEFAULT_GEMINI_MODEL,
      keyHint: maskApiKey(envKey),
      lastTestedAt: null,
      lastTestStatus: envKey ? 'unknown' : 'unconfigured',
      lastTestMessage: null,
      updatedAt: null,
    };
  }
}

export async function getAiSettingsSummary(): Promise<AiSettingsSummary> {
  const creds = await getConfiguredGeminiCredentials();
  return {
    configured: Boolean(creds.apiKey),
    source: creds.source,
    maskedKey: creds.keyHint,
    modelName: creds.modelName,
    connectionStatus: creds.lastTestStatus,
    lastTestedAt: creds.lastTestedAt ? creds.lastTestedAt.toISOString() : null,
    lastTestMessage: creds.lastTestMessage,
    updatedAt: creds.updatedAt ? creds.updatedAt.toISOString() : null,
  };
}

export async function saveGeminiApiSettings(params: {
  apiKey?: string;
  clearStoredKey?: boolean;
  modelName?: string;
  adminUserId: string;
}): Promise<AiSettingsSummary> {
  const db = getDb();
  await db.insert(aiProviderSettings).values({ id: 'default' }).onConflictDoNothing();

  const updateValues: Record<string, unknown> = {
    updatedBy: params.adminUserId,
    updatedAt: new Date(),
  };

  if (params.modelName !== undefined) {
    updateValues.modelName = sanitizeModelName(params.modelName);
  }

  if (params.clearStoredKey) {
    updateValues.encryptedApiKey = null;
    updateValues.keyHint = null;
    updateValues.lastTestStatus = 'unknown';
    updateValues.lastTestMessage = 'Stored database API key cleared.';
    updateValues.lastTestedAt = null;
  } else if (params.apiKey !== undefined && params.apiKey.trim() !== '') {
    const cleanKey = normalizeGeminiApiKey(params.apiKey);
    updateValues.encryptedApiKey = encryptApiKey(cleanKey);
    updateValues.keyHint = maskApiKey(cleanKey);
    updateValues.lastTestStatus = 'unknown';
    updateValues.lastTestMessage = 'New API key saved securely. Verifying connection...';
    updateValues.lastTestedAt = null;
  }

  await db
    .update(aiProviderSettings)
    .set(updateValues)
    .where(eq(aiProviderSettings.id, 'default'));

  return getAiSettingsSummary();
}

export async function testGeminiConnection(params?: {
  candidateApiKey?: string;
  modelName?: string;
  adminUserId?: string;
}): Promise<{
  ok: boolean;
  message: string;
  summary: AiSettingsSummary;
}> {
  const creds = await getConfiguredGeminiCredentials();
  let candidate: string | undefined;
  if (params?.candidateApiKey !== undefined && params.candidateApiKey.trim() !== '') {
    try {
      candidate = normalizeGeminiApiKey(params.candidateApiKey);
    } catch (validationErr) {
      const summary = await getAiSettingsSummary();
      return {
        ok: false,
        message:
          validationErr instanceof Error
            ? validationErr.message
            : 'Invalid Gemini API key format.',
        summary,
      };
    }
  }

  const keyToTest = candidate || creds.apiKey;
  const modelToUse = sanitizeModelName(params?.modelName || creds.modelName);

  if (!keyToTest) {
    const summary = await getAiSettingsSummary();
    return {
      ok: false,
      message: 'No Gemini API key is configured. Enter an API key first.',
      summary,
    };
  }

  let ok = false;
  let message = '';
  let resolvedModel = modelToUse;

  try {
    const { response, usedModel, usedVertexExpress } = await executeGeminiGenerateContent({
      apiKey: keyToTest,
      modelName: modelToUse,
      contents: 'Reply concisely with the two words: Connection OK',
    });
    resolvedModel = usedModel;
    const text = (response.text || '').trim();
    const endpointLabel = usedVertexExpress ? 'Vertex AI Express Mode' : 'Google AI Gemini API';
    const modelNote =
      usedModel !== modelToUse
        ? `${usedModel} (auto-selected because ${modelToUse} is unavailable on this key)`
        : usedModel;
    ok = true;
    message =
      text.length > 0
        ? `Connected successfully via ${endpointLabel} using model ${modelNote}.`
        : `Gemini API responded cleanly via ${endpointLabel} using model ${modelNote}.`;
  } catch (err) {
    message = formatGeminiErrorMessage(err);
    ok = false;
  }

  // Persist test result (and auto-selected working model if fallback succeeded) when testing the saved configuration
  if (isDatabaseConfigured() && !candidate) {
    try {
      const db = getDb();
      await db.insert(aiProviderSettings).values({ id: 'default' }).onConflictDoNothing();
      await db
        .update(aiProviderSettings)
        .set({
          ...(ok && resolvedModel !== creds.modelName ? { modelName: resolvedModel } : {}),
          lastTestedAt: new Date(),
          lastTestStatus: ok ? 'connected' : 'failed',
          lastTestMessage: message,
          ...(params?.adminUserId ? { updatedBy: params.adminUserId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(aiProviderSettings.id, 'default'));
    } catch {
      // Ignore status update errors if migration hasn't run yet
    }
  }

  const summary = await getAiSettingsSummary();
  return { ok, message, summary };
}
