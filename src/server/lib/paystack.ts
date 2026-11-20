import crypto from 'node:crypto';

export class PaystackNotConfiguredError extends Error {
  constructor(
    message = 'Paystack payment gateway is not configured. Set PAYSTACK_SECRET_KEY on the server.'
  ) {
    super(message);
    this.name = 'PaystackNotConfiguredError';
  }
}

export class PaystackGatewayError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = 'PaystackGatewayError';
    this.statusCode = statusCode;
  }
}

export class PaystackReferenceNotFoundError extends Error {
  constructor(message = 'We could not locate this payment reference on Paystack.') {
    super(message);
    this.name = 'PaystackReferenceNotFoundError';
  }
}

export function isValidPaymentReferenceFormat(reference: string): boolean {
  const trimmed = String(reference || '').trim();
  return /^[A-Za-z0-9._-]{4,120}$/.test(trimmed);
}

export function isPaystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY?.trim());
}

export function getPaystackPublicKey(): string | null {
  return process.env.PAYSTACK_PUBLIC_KEY?.trim() || null;
}

function getPaystackSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) {
    throw new PaystackNotConfiguredError();
  }
  return key;
}

export function getPaystackWebhookSecret(): string | null {
  return (
    process.env.PAYSTACK_WEBHOOK_SECRET?.trim() ||
    process.env.PAYSTACK_SECRET_KEY?.trim() ||
    null
  );
}

export function generatePaymentReference(prefix = 'ACD'): string {
  const year = new Date().getFullYear();
  const cleanPrefix = prefix.replace(/[^A-Za-z0-9-]/g, '').toUpperCase() || 'ACD';
  return `${cleanPrefix}-${year}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

export function nairaToKobo(amountNaira: number | string): number {
  const numeric = typeof amountNaira === 'string' ? Number(amountNaira) : amountNaira;
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error('Invalid payment amount.');
  }
  return Math.round(numeric * 100);
}

export function verifyPaystackWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined
): boolean {
  const secret = getPaystackWebhookSecret();
  if (!secret || !signatureHeader) return false;

  const expectedHex = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedHex, 'utf8');
  const providedBuf = Buffer.from(signatureHeader.trim().toLowerCase(), 'utf8');

  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export interface PaystackInitializeInput {
  email: string;
  amountKobo: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}

export interface PaystackInitializeResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export async function initializePaystackTransaction(
  input: PaystackInitializeInput
): Promise<PaystackInitializeResult> {
  const secretKey = getPaystackSecretKey();

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    status?: boolean;
    message?: string;
    data?: PaystackInitializeResult;
  } | null;

  if (!response.ok || !payload?.status || !payload.data?.authorization_url) {
    throw new PaystackGatewayError(
      payload?.message || `Paystack initialization failed (HTTP ${response.status}).`,
      response.status >= 400 && response.status < 500 ? 400 : 502
    );
  }

  return payload.data;
}

export interface PaystackVerifyData {
  id: number | string;
  status: string;
  reference: string;
  amount: number;
  fees?: number | null;
  currency: string;
  paid_at?: string | null;
  channel?: string | null;
  gateway_response?: string;
  authorization?: {
    country_code?: string;
    channel?: string;
    card_type?: string;
    bank?: string;
  } | null;
  customer?: {
    email?: string;
  };
  metadata?: Record<string, unknown>;
}

export async function verifyPaystackTransaction(
  reference: string
): Promise<PaystackVerifyData> {
  const secretKey = getPaystackSecretKey();

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const payload = (await response.json().catch(() => null)) as {
    status?: boolean;
    message?: string;
    data?: PaystackVerifyData;
  } | null;

  if (!response.ok || !payload?.status || !payload.data) {
    const msg = payload?.message || `Paystack verification failed (HTTP ${response.status}).`;
    const lowerMsg = msg.toLowerCase();
    if (
      response.status === 404 ||
      lowerMsg.includes('not found') ||
      lowerMsg.includes('does not exist') ||
      lowerMsg.includes('invalid key') === false && response.status === 400 && lowerMsg.includes('reference')
    ) {
      throw new PaystackReferenceNotFoundError(msg);
    }
    throw new PaystackGatewayError(
      msg,
      response.status >= 400 && response.status < 500 ? 400 : 502
    );
  }

  return payload.data;
}
