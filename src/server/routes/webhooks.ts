import { Router } from 'express';
import { getPool, isDatabaseConfigured } from '../../db/index.js';
import {
  PaymentValidationError,
  settlePaystackTransaction,
} from '../lib/paymentSettlement.js';
import {
  verifyPaystackWebhookSignature,
  type PaystackVerifyData,
} from '../lib/paystack.js';

const router = Router();

router.post('/paystack', async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));

  const signature = req.header('x-paystack-signature');
  if (!verifyPaystackWebhookSignature(rawBody, signature)) {
    res.status(401).json({ error: 'Invalid Paystack webhook signature.' });
    return;
  }

  if (!isDatabaseConfigured()) {
    res.status(503).json({ error: 'Database is not configured.' });
    return;
  }

  let parsedBody: {
    event?: string;
    data?: Record<string, unknown>;
  };
  try {
    parsedBody = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      data?: Record<string, unknown>;
    };
  } catch {
    res.status(400).json({ error: 'Malformed webhook JSON payload.' });
    return;
  }

  const eventType = String(parsedBody.event || 'unknown');
  const data = (parsedBody.data || {}) as Record<string, unknown>;
  const dataId = data.id !== undefined && data.id !== null ? String(data.id) : 'noid';
  const reference =
    typeof data.reference === 'string'
      ? data.reference
      : typeof data.transaction_reference === 'string'
        ? data.transaction_reference
        : '';

  const eventReference = `${eventType}:${dataId}:${reference || 'noref'}`;
  const pool = getPool();

  // Deduplicate webhook delivery atomically using payment_webhook_events unique constraint
  const insertEvent = await pool.query<{ id: string }>(
    `INSERT INTO payment_webhook_events (event_reference, event_type, payment_reference, processing_status, payload)
     VALUES ($1, $2, $3, 'received', $4::jsonb)
     ON CONFLICT (event_reference) DO NOTHING
     RETURNING id`,
    [eventReference, eventType, reference || null, JSON.stringify(parsedBody)]
  );

  if (insertEvent.rows.length === 0) {
    res.status(200).json({ ok: true, duplicate: true });
    return;
  }

  const webhookEventId = insertEvent.rows[0].id;

  try {
    if ((eventType === 'charge.success' || eventType === 'charge.failed') && reference) {
      const normalizedData: PaystackVerifyData = {
        id: data.id as string | number,
        status: eventType === 'charge.success' ? 'success' : String(data.status || 'failed'),
        reference,
        amount: Number(data.amount ?? 0),
        fees:
          data.fees !== undefined && data.fees !== null && Number.isFinite(Number(data.fees))
            ? Number(data.fees)
            : null,
        currency: String(data.currency || 'NGN'),
        paid_at: typeof data.paid_at === 'string' ? data.paid_at : null,
        channel: typeof data.channel === 'string' ? data.channel : null,
        authorization:
          (data.authorization as PaystackVerifyData['authorization']) || null,
        metadata: (data.metadata as Record<string, unknown> | undefined) || undefined,
      };

      await settlePaystackTransaction({
        paystackData: normalizedData,
        source: 'webhook',
        ipAddress: req.ip,
      });

      await pool.query(
        `UPDATE payment_webhook_events
         SET processing_status = 'processed', processed_at = NOW()
         WHERE id = $1`,
        [webhookEventId]
      );
      res.status(200).json({ ok: true, processed: true });
      return;
    }

    if (eventType === 'refund.processed' && reference) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const payRes = await client.query<{ id: string }>(
          `UPDATE payments
           SET payment_status = 'refunded',
               gateway_response = $2::jsonb,
               updated_at = NOW()
           WHERE payment_reference = $1
           RETURNING id`,
          [reference, JSON.stringify(data)]
        );
        if (payRes.rows[0]) {
          await client.query(
            `UPDATE course_registrations
             SET registration_status = 'revoked', updated_at = NOW()
             WHERE payment_id = $1 AND registration_status = 'active'`,
            [payRes.rows[0].id]
          );
        }
        await client.query('COMMIT');
      } catch (refundErr) {
        await client.query('ROLLBACK');
        throw refundErr;
      } finally {
        client.release();
      }

      await pool.query(
        `UPDATE payment_webhook_events
         SET processing_status = 'processed', processed_at = NOW()
         WHERE id = $1`,
        [webhookEventId]
      );
      res.status(200).json({ ok: true, processed: true });
      return;
    }

    await pool.query(
      `UPDATE payment_webhook_events
       SET processing_status = 'ignored', processed_at = NOW()
       WHERE id = $1`,
      [webhookEventId]
    );
    res.status(200).json({ ok: true, ignored: true });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Webhook processing error';
    await pool.query(
      `UPDATE payment_webhook_events
       SET processing_status = 'failed', error_message = $2, processed_at = NOW()
       WHERE id = $1`,
      [webhookEventId, errMsg]
    );
    if (err instanceof PaymentValidationError) {
      res.status(400).json({ error: errMsg });
      return;
    }
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

export default router;
