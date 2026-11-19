import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { eq } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../../db/index.js';
import { aiProviderSettings } from '../../db/schema.js';

export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';
export const SUPPORTED_GEMINI_MODELS = [
  'gemini-4-hydrogen',
  'gemini-4-neon',
] as const;

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

export function maskApiKey(rawKey: string | null | undefined): string | null {
  if (!rawKey) return null;
  const trimmed = rawKey.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}••••${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 6)}••••••••${trimmed.slice(-4)}`;
}

export function sanitizeModelName(modelName?: string | null): string {
  const candidate = (modelName || '').trim();
  if ((SUPPORTED_GEMINI_MODELS as readonly string[]).includes(candidate)) {
    return candidate;
  }
  return DEFAULT_GEMINI_MODEL;
}

export function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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
  } else if (params.apiKey !== undefined) {
    const cleanKey = params.apiKey.trim();
    if (cleanKey.length < 15 || /\s/.test(cleanKey)) {
      throw new Error(
        'Invalid Gemini API key format. Please paste a valid Gemini API key without spaces.'
      );
    }
    updateValues.encryptedApiKey = encryptApiKey(cleanKey);
    updateValues.keyHint = maskApiKey(cleanKey);
    updateValues.lastTestStatus = 'unknown';
    updateValues.lastTestMessage = 'New API key saved securely. Click "Test Connection" to verify.';
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
  const candidate = params?.candidateApiKey?.trim();
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

  try {
    const ai = createGeminiClient(keyToTest);
    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: 'Reply concisely with the two words: Connection OK',
    });
    const text = (response.text || '').trim();
    if (text.length > 0) {
      ok = true;
      message = `Connected successfully using model ${modelToUse}.`;
    } else {
      ok = true;
      message = `Gemini API responded cleanly using model ${modelToUse}.`;
    }
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : 'Gemini API request failed.';
    // Ensure we never echo back any key fragments in error messages
    message = rawMsg.replace(/AIza[0-9A-Za-z_-]{10,}/g, 'AIza••••••••');
    ok = false;
  }

  // Persist test result when testing the saved configuration (or when DB is available & no unsaved candidate differs)
  if (isDatabaseConfigured() && !candidate) {
    try {
      const db = getDb();
      await db.insert(aiProviderSettings).values({ id: 'default' }).onConflictDoNothing();
      await db
        .update(aiProviderSettings)
        .set({
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
