import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { createApp } from '../server.js';
import { checkDatabaseHealth, getPool, isDatabaseConfigured } from '../src/db/index.js';
import {
  EMAIL_VERIFICATION_TTL_HOURS,
  PASSWORD_RESET_TTL_MINUTES,
  generateRawAuthToken,
  hashAuthToken,
  validateNewPasswordStrength,
} from '../src/server/lib/emailAuth.js';
import {
  getEmailConfigSummary,
  normalizeLockallyApiBaseUrl,
  sendAdminTestEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  validateEmailStartup,
  verifyEmailServiceConnection,
} from '../src/server/lib/email.js';

interface CapturedLockallyRequest {
  method: string;
  url: string;
  authorization: string;
  idempotencyKey: string;
  contentType: string;
  body: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    text: string;
  };
}

type ServerMode =
  | 'ok_queued'
  | 'ok_delivered_via_lookup'
  | 'accepted_then_bounced'
  | 'send_write_only_403_domains'
  | 'invalid_key'
  | 'unprocessable'
  | 'retry_once_500';

async function startLocalLockallyTestServer(): Promise<{
  baseUrlV1: string;
  requests: CapturedLockallyRequest[];
  setMode: (mode: ServerMode) => void;
  close: () => Promise<void>;
}> {
  const requests: CapturedLockallyRequest[] = [];
  let mode: ServerMode = 'ok_queued';
  let transientFailuresRemaining = 0;
  const messageStatuses = new Map<string, { status: string; error?: string }>();

  const server = http.createServer((req, res) => {
    const auth = req.headers.authorization || '';
    const url = req.url || '/';

    if (req.method === 'GET' && url === '/v1/domains') {
      if (mode === 'invalid_key') {
        res.writeHead(401, { 'Content-Type': 'application/problem+json' });
        res.end(
          JSON.stringify({
            type: 'about:blank',
            status: 401,
            title: 'Unauthorized',
            detail: 'The API key provided is invalid or expired.',
            code: 'invalid_api_key',
            request_id: 'req-401-domains',
          })
        );
        return;
      }

      if (mode === 'send_write_only_403_domains') {
        res.writeHead(403, { 'Content-Type': 'application/problem+json' });
        res.end(
          JSON.stringify({
            type: 'about:blank',
            status: 403,
            title: 'Forbidden',
            detail: 'Token scope send:write does not include domains:read.',
            code: 'insufficient_scope',
            request_id: 'req-403-domains',
          })
        );
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          data: [{ domain: 'acadetcbt.website', verified: true }],
        })
      );
      return;
    }

    if (req.method === 'GET' && url.startsWith('/v1/messages/')) {
      const msgId = decodeURIComponent(url.slice('/v1/messages/'.length));
      if (mode === 'send_write_only_403_domains') {
        res.writeHead(403, { 'Content-Type': 'application/problem+json' });
        res.end(
          JSON.stringify({
            type: 'about:blank',
            status: 403,
            title: 'Forbidden',
            detail: 'Token scope send:write cannot read messages.',
            code: 'insufficient_scope',
          })
        );
        return;
      }
      const st = messageStatuses.get(msgId);
      if (!st) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Message not found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: msgId, ...st }));
      return;
    }

    if (req.method === 'POST' && url === '/v1/send') {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        const idempotencyKey = String(req.headers['idempotency-key'] || '');
        const contentType = String(req.headers['content-type'] || '');

        if (!auth.startsWith('Bearer ') || mode === 'invalid_key') {
          res.writeHead(401, { 'Content-Type': 'application/problem+json' });
          res.end(
            JSON.stringify({
              type: 'about:blank',
              status: 401,
              title: 'Unauthorized',
              detail: 'The API key provided is invalid or expired.',
              code: 'invalid_api_key',
              request_id: 'req-401-send',
            })
          );
          return;
        }

        if (!idempotencyKey) {
          res.writeHead(422, { 'Content-Type': 'application/problem+json' });
          res.end(
            JSON.stringify({
              type: 'about:blank',
              status: 422,
              title: 'Unprocessable Entity',
              detail: 'Idempotency-Key header is required.',
              code: 'missing_idempotency_key',
              request_id: 'req-422-idemp',
            })
          );
          return;
        }

        if (mode === 'unprocessable') {
          res.writeHead(422, { 'Content-Type': 'application/problem+json' });
          res.end(
            JSON.stringify({
              type: 'about:blank',
              status: 422,
              title: 'Unprocessable Entity',
              detail: 'Sender domain is not verified.',
              code: 'unverified_domain',
              request_id: 'req-422-domain',
            })
          );
          return;
        }

        if (mode === 'retry_once_500' && transientFailuresRemaining > 0) {
          transientFailuresRemaining -= 1;
          res.writeHead(500, { 'Content-Type': 'application/problem+json' });
          res.end(
            JSON.stringify({
              type: 'about:blank',
              status: 500,
              title: 'Internal Server Error',
              detail: 'Temporary queue outage.',
              code: 'internal_error',
              request_id: 'req-500-retry',
            })
          );
          return;
        }

        const parsedBody = JSON.parse(raw) as CapturedLockallyRequest['body'];
        requests.push({
          method: req.method || 'POST',
          url,
          authorization: auth,
          idempotencyKey,
          contentType,
          body: parsedBody,
        });

        const msgUuid = `msg_${requests.length}`;
        if (mode === 'ok_delivered_via_lookup') {
          messageStatuses.set(msgUuid, { status: 'delivered' });
        } else if (mode === 'accepted_then_bounced') {
          messageStatuses.set(msgUuid, {
            status: 'bounced',
            error: '550 5.1.1 The email account does not exist.',
          });
        } else {
          messageStatuses.set(msgUuid, { status: 'queued' });
        }

        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: msgUuid,
            message_id: `<${msgUuid}@lockally.com>`,
            status: 'queued',
          })
        );
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');

  return {
    baseUrlV1: `http://127.0.0.1:${addr.port}/v1`,
    requests,
    setMode: (next) => {
      mode = next;
      transientFailuresRemaining = next === 'retry_once_500' ? 1 : 0;
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

function saveAndClearEmailEnv() {
  const keys = [
    'LOCKALLY_API_KEY',
    'LOCKALLY_API_URL',
    'SMTP_FROM_EMAIL',
    'APP_BASE_URL',
  ] as const;

  const backup: Record<string, string | undefined> = {};
  for (const k of keys) {
    backup[k] = process.env[k];
    delete process.env[k];
  }
  return () => {
    for (const k of keys) {
      if (backup[k] === undefined) delete process.env[k];
      else process.env[k] = backup[k];
    }
  };
}

async function verifyEmailAndRecovery() {
  console.log('[Email & Recovery Verification] 1. Testing token cryptography, password rules & /v1 URL normalization...');
  assert.equal(PASSWORD_RESET_TTL_MINUTES, 20);
  assert.equal(EMAIL_VERIFICATION_TTL_HOURS, 24);
  assert.equal(normalizeLockallyApiBaseUrl('https://api.lockally.com/v1'), 'https://api.lockally.com/v1');
  assert.equal(normalizeLockallyApiBaseUrl('https://api.lockally.com/v1/'), 'https://api.lockally.com/v1');
  assert.equal(normalizeLockallyApiBaseUrl('https://api.lockally.com/v1/send'), 'https://api.lockally.com/v1');
  assert.equal(normalizeLockallyApiBaseUrl('https://api.lockally.com'), 'https://api.lockally.com/v1');

  const raw1 = generateRawAuthToken();
  const raw2 = generateRawAuthToken();
  assert.notEqual(raw1, raw2);
  assert.ok(raw1.length >= 32, 'Reset/verification raw token should have >= 256-bit entropy');
  const hash1 = hashAuthToken(raw1);
  assert.equal(hash1.length, 64, 'Token hash must be SHA-256 hex digest');
  assert.notEqual(hash1, raw1);
  assert.equal(hashAuthToken(raw1), hashAuthToken(`  ${raw1}  `));

  assert.equal(validateNewPasswordStrength('StrongPass123').valid, true);
  assert.equal(validateNewPasswordStrength('short1A').valid, false);
  assert.equal(validateNewPasswordStrength('alllowercase123').valid, false);
  assert.equal(validateNewPasswordStrength('ALLUPPERCASE123').valid, false);
  assert.equal(validateNewPasswordStrength('NoDigitsHere').valid, false);

  console.log('[Email & Recovery Verification] 2. Checking frontend zero-secret & zero-SMTP hygiene...');
  const clientFilesToCheck = [
    'src/App.tsx',
    'src/lib/api.ts',
    'src/components/cbt/AuthScreen.tsx',
    'src/components/cbt/ResetPasswordScreen.tsx',
    'src/components/cbt/VerifyEmailScreen.tsx',
    'src/components/cbt/AdminEmailStatusPanel.tsx',
    'src/components/cbt/HomeDashboard.tsx',
  ];
  for (const rel of clientFilesToCheck) {
    const src = await fs.readFile(path.resolve(process.cwd(), rel), 'utf-8');
    assert.equal(
      src.includes('LOCKALLY_API_KEY') ||
        src.includes('SMTP_PASSWORD') ||
        src.includes('nodemailer'),
      false,
      `Frontend file ${rel} must never reference LOCKALLY_API_KEY, SMTP_PASSWORD, or nodemailer`
    );
  }
  const emailServerSrc = await fs.readFile(path.resolve(process.cwd(), 'src/server/lib/email.ts'), 'utf-8');
  assert.equal(emailServerSrc.includes('nodemailer'), false, 'email.ts must not use nodemailer/SMTP');

  console.log('[Email & Recovery Verification] 3. Testing missing Lockally credentials graceful handling...');
  const restoreEmailEnv = saveAndClearEmailEnv();
  try {
    const startupMissing = validateEmailStartup();
    assert.equal(startupMissing.configured, false);
    assert.equal(startupMissing.connectionStatus, 'unconfigured');
    assert.deepEqual(startupMissing.missingVariables, [
      'LOCKALLY_API_KEY',
      'LOCKALLY_API_URL',
      'SMTP_FROM_EMAIL',
      'APP_BASE_URL',
    ]);

    const skippedSend = await sendPasswordResetEmail({
      userId: '11111111-1111-4111-8111-111111111111',
      toEmail: 'student@example.com',
      fullName: 'Adaeze Okafor',
      rawToken: raw1,
    });
    assert.equal(skippedSend.sent, false);
    assert.equal(skippedSend.accepted, false);
    assert.equal(skippedSend.deliveredConfirmed, false);
    assert.equal(skippedSend.status, 'skipped_unconfigured');

    console.log('[Email & Recovery Verification] 4. Testing unreachable Lockally endpoint & secret redaction...');
    process.env.LOCKALLY_API_KEY = 'lk_live_prefix99_SECRET_TOKEN_SHOULD_NOT_APPEAR_ANYWHERE';
    process.env.LOCKALLY_API_URL = 'http://127.0.0.1:19/v1';
    process.env.SMTP_FROM_EMAIL = 'noreply@acadetcbt.website';
    process.env.APP_BASE_URL = 'https://acadetcbt.website';

    const summaryMasked = getEmailConfigSummary();
    assert.equal(summaryMasked.apiKeyMasked, 'lk_live_...HERE');
    assert.equal(JSON.stringify(summaryMasked).includes('SECRET_TOKEN_SHOULD_NOT_APPEAR_ANYWHERE'), false);

    const failedConn = await verifyEmailServiceConnection();
    assert.equal(failedConn.configured, true);
    assert.equal(failedConn.connectionStatus, 'connection_failed');
    assert.ok(failedConn.lastError);
    assert.equal(
      (failedConn.lastError || '').includes('SECRET_TOKEN_SHOULD_NOT_APPEAR_ANYWHERE'),
      false,
      'LOCKALLY_API_KEY must be redacted from error messages'
    );

    console.log('[Email & Recovery Verification] 5. Testing Lockally POST /v1/send HTTP API, send:write scope & queued vs delivered truthfulness...');
    const lockallyServer = await startLocalLockallyTestServer();
    try {
      process.env.LOCKALLY_API_URL = lockallyServer.baseUrlV1;

      // 5a. Token scoped strictly to send:write (403 on /v1/domains) authenticates cleanly
      lockallyServer.setMode('send_write_only_403_domains');
      const scopedConn = await verifyEmailServiceConnection();
      assert.equal(scopedConn.connectionStatus, 'connected');
      assert.ok(scopedConn.scopeNote?.includes('send:write'));

      // 5a-2. Send email with send:write-only token -> 202 queued, NOT claiming deliveredConfirmed
      const scopedSend = await sendAdminTestEmail({
        adminUserId: '22222222-2222-4222-8222-222222222222',
        toEmail: 'admin@acadetcbt.website',
        adminName: 'Admin',
      });
      assert.equal(scopedSend.sent, true);
      assert.equal(scopedSend.accepted, true);
      assert.equal(scopedSend.deliveredConfirmed, false);
      assert.equal(scopedSend.status, 'queued');

      // 5b. 401 unauthorized test (no secret leak)
      lockallyServer.setMode('invalid_key');
      const unauthConn = await verifyEmailServiceConnection();
      assert.equal(unauthConn.connectionStatus, 'connection_failed');
      assert.ok((unauthConn.lastError || '').includes('401'));
      assert.equal(
        (unauthConn.lastError || '').includes('SECRET_TOKEN_SHOULD_NOT_APPEAR_ANYWHERE'),
        false
      );

      // 5c. 422 payload/domain error test (non-retryable)
      lockallyServer.setMode('unprocessable');
      const unprocRes = await sendAdminTestEmail({
        adminUserId: '22222222-2222-4222-8222-222222222222',
        toEmail: 'admin@acadetcbt.website',
        adminName: 'Admin',
      });
      assert.equal(unprocRes.sent, false);
      assert.equal(unprocRes.accepted, false);
      assert.equal(unprocRes.deliveredConfirmed, false);
      assert.ok((unprocRes.error || '').includes('422'));

      // 5d. 202 Accepted followed by bounced lookup MUST NOT report success!
      lockallyServer.setMode('accepted_then_bounced');
      const bouncedRes = await sendAdminTestEmail({
        adminUserId: '22222222-2222-4222-8222-222222222222',
        toEmail: 'bounced@example.com',
        adminName: 'Admin',
      });
      assert.equal(bouncedRes.accepted, true);
      assert.equal(bouncedRes.sent, false);
      assert.equal(bouncedRes.deliveredConfirmed, false);
      assert.equal(bouncedRes.status, 'bounced');
      assert.ok((bouncedRes.error || '').includes('550'));

      // 5e. 202 Accepted followed by confirmed delivered lookup
      lockallyServer.setMode('ok_delivered_via_lookup');
      const deliveredRes = await sendAdminTestEmail({
        adminUserId: '22222222-2222-4222-8222-222222222222',
        toEmail: 'admin@acadetcbt.website',
        adminName: 'Admin',
      });
      assert.equal(deliveredRes.sent, true);
      assert.equal(deliveredRes.accepted, true);
      assert.equal(deliveredRes.deliveredConfirmed, true);
      assert.equal(deliveredRes.status, 'delivered');

      // 5f. 500 transient error retries safely with identical Idempotency-Key
      lockallyServer.setMode('retry_once_500');
      const retrySuccess = await sendAdminTestEmail({
        adminUserId: '22222222-2222-4222-8222-222222222222',
        toEmail: 'admin@acadetcbt.website',
        adminName: 'Acadet Admin',
      });
      assert.equal(retrySuccess.sent, true);
      assert.equal(retrySuccess.accepted, true);
      assert.equal(retrySuccess.deliveredConfirmed, false);
      assert.equal(retrySuccess.status, 'queued');

      // 5g. Send verification, password reset & password changed notifications (status = queued from 202 Accepted)
      lockallyServer.setMode('ok_queued');
      const verifyToken = generateRawAuthToken();
      const resetToken = generateRawAuthToken();

      const verifyRes = await sendVerificationEmail({
        userId: '11111111-1111-4111-8111-111111111111',
        toEmail: 'verify-student@example.com',
        fullName: 'Chinedu Eze',
        rawToken: verifyToken,
      });
      assert.equal(verifyRes.sent, true);
      assert.equal(verifyRes.accepted, true);
      assert.equal(verifyRes.deliveredConfirmed, false);
      assert.equal(verifyRes.status, 'queued');

      const resetRes = await sendPasswordResetEmail({
        userId: '11111111-1111-4111-8111-111111111111',
        toEmail: 'reset-student@example.com',
        fullName: 'Zainab Bello',
        rawToken: resetToken,
      });
      assert.equal(resetRes.sent, true);
      assert.equal(resetRes.accepted, true);
      assert.equal(resetRes.deliveredConfirmed, false);
      assert.equal(resetRes.status, 'queued');

      const changedRes = await sendPasswordChangedEmail({
        userId: '11111111-1111-4111-8111-111111111111',
        toEmail: 'reset-student@example.com',
        fullName: 'Zainab Bello',
      });
      assert.equal(changedRes.sent, true);
      assert.equal(changedRes.accepted, true);
      assert.equal(changedRes.status, 'queued');

      // Total accepted POST /v1/send calls = scoped(1) + bounced(1) + delivered(1) + retry(1) + verify(1) + reset(1) + changed(1) = 7
      assert.equal(lockallyServer.requests.length, 7);

      const reqVerify = lockallyServer.requests[4];
      assert.equal(reqVerify.url, '/v1/send');
      assert.equal(reqVerify.authorization, `Bearer ${process.env.LOCKALLY_API_KEY}`);
      assert.ok(reqVerify.idempotencyKey.startsWith('acadet-verification-'));
      assert.equal(reqVerify.contentType, 'application/json');
      assert.equal(reqVerify.body.from, 'noreply@acadetcbt.website');
      assert.deepEqual(reqVerify.body.to, ['verify-student@example.com']);
      assert.equal(reqVerify.body.subject, 'Verify Your Acadet CBT Account');
      assert.ok(
        reqVerify.body.html.includes(
          `https://acadetcbt.website/verify-email?token=${encodeURIComponent(verifyToken)}`
        )
      );
      assert.ok(reqVerify.body.html.includes('https://acadetcbt.website/acadet-logo.png'));

      const reqReset = lockallyServer.requests[5];
      assert.equal(reqReset.url, '/v1/send');
      assert.ok(reqReset.idempotencyKey.startsWith('acadet-password_reset-'));
      assert.equal(reqReset.body.from, 'noreply@acadetcbt.website');
      assert.deepEqual(reqReset.body.to, ['reset-student@example.com']);
      assert.equal(reqReset.body.subject, 'Acadet CBT – Password Reset Request');
      assert.ok(
        reqReset.body.html.includes(
          `https://acadetcbt.website/reset-password?token=${encodeURIComponent(resetToken)}`
        )
      );
      assert.ok(reqReset.body.html.includes('20 minutes'));
      assert.equal(
        reqReset.body.html.includes('SECRET_TOKEN_SHOULD_NOT_APPEAR_ANYWHERE'),
        false
      );

      const reqChanged = lockallyServer.requests[6];
      assert.equal(reqChanged.url, '/v1/send');
      assert.ok(reqChanged.idempotencyKey.startsWith('acadet-password_changed-'));
      assert.equal(reqChanged.body.from, 'noreply@acadetcbt.website');
      assert.deepEqual(reqChanged.body.to, ['reset-student@example.com']);
      assert.equal(reqChanged.body.subject, 'Acadet CBT – Password Successfully Changed');

      console.log('[Email & Recovery Verification] 6. Testing Express routes, SEO gates & auth guards...');
      const app = await createApp({ skipVite: true });
      const httpServer = await new Promise<http.Server>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });

      try {
        const httpAddr = httpServer.address();
        assert.ok(httpAddr && typeof httpAddr === 'object');
        const baseUrl = `http://127.0.0.1:${httpAddr.port}`;

        const healthRes = await fetch(`${baseUrl}/api/health`);
        assert.equal(healthRes.status, 200);
        const healthBody = (await healthRes.json()) as {
          email?: { configured: boolean; provider?: string };
        };
        assert.equal(healthBody.email?.configured, true);
        assert.equal(healthBody.email?.provider, 'lockally');

        for (const privRoute of ['/forgot-password', '/reset-password', '/verify-email']) {
          const r = await fetch(`${baseUrl}${privRoute}`, { redirect: 'manual' });
          assert.equal(r.status, 200, `${privRoute} must return HTTP 200`);
          const html = await r.text();
          assert.ok(html.includes('noindex, nofollow'), `${privRoute} must be marked noindex, nofollow`);
        }

        const robotsTxt = await (await fetch(`${baseUrl}/robots.txt`)).text();
        assert.ok(
          robotsTxt.includes('Disallow: /forgot-password') &&
            robotsTxt.includes('Disallow: /reset-password') &&
            robotsTxt.includes('Disallow: /verify-email')
        );

        const sitemapXml = await (await fetch(`${baseUrl}/sitemap.xml`)).text();
        assert.equal(sitemapXml.includes('/forgot-password'), false);
        assert.equal(sitemapXml.includes('/reset-password'), false);
        assert.equal(sitemapXml.includes('/verify-email'), false);

        const adminEmailStatusRes = await fetch(`${baseUrl}/api/admin/email/status`);
        assert.ok(adminEmailStatusRes.status === 401 || adminEmailStatusRes.status === 503);

        const adminEmailConnRes = await fetch(`${baseUrl}/api/admin/email/test-connection`, {
          method: 'POST',
        });
        assert.ok(adminEmailConnRes.status === 401 || adminEmailConnRes.status === 503);

        const dbHealth = await checkDatabaseHealth();
        if (isDatabaseConfigured() && dbHealth.connected) {
          console.log('[Email & Recovery Verification] 7. Database connected — executing full live PostgreSQL lifecycle tests...');
          const pool = getPool();
          const testEmail = `e2e.recovery.${Date.now()}@acadetcbt-test.local`;
          const initialPassword = 'OldPassword123!';
          const nextPassword = 'NewSecurePassword456!';

          const regRes = await fetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullName: 'E2E Test Student',
              email: testEmail,
              password: initialPassword,
              examTarget: 'Acadet 100 Level',
            }),
          });
          assert.equal(regRes.status, 201);
          const regJson = (await regRes.json()) as {
            token: string;
            user: { id: string; emailVerified: boolean };
            verificationEmailSent: boolean;
          };
          assert.equal(regJson.user.emailVerified, false);
          assert.equal(regJson.verificationEmailSent, true);

          try {
            const dbTokenCheck = await pool.query<{ tokenHash: string }>(
              'SELECT token_hash AS "tokenHash" FROM email_verification_tokens WHERE user_id = $1',
              [regJson.user.id]
            );
            assert.equal(dbTokenCheck.rowCount, 1);

            const capturedVerify = lockallyServer.requests.find(
              (r) =>
                r.body.subject === 'Verify Your Acadet CBT Account' &&
                r.body.to.includes(testEmail)
            );
            assert.ok(capturedVerify);
            const verifyMatch = capturedVerify.body.html.match(
              /\/verify-email\?token=([A-Za-z0-9_%\-]+)/
            );
            assert.ok(verifyMatch);
            const extractedVerifyToken = decodeURIComponent(verifyMatch[1]);
            assert.notEqual(dbTokenCheck.rows[0].tokenHash, extractedVerifyToken);

            const doVerifyRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: extractedVerifyToken }),
            });
            assert.equal(doVerifyRes.status, 200);

            const forgotRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: testEmail }),
            });
            assert.equal(forgotRes.status, 200);

            const capturedReset = lockallyServer.requests.find(
              (r) =>
                r.body.subject === 'Acadet CBT – Password Reset Request' &&
                r.body.to.includes(testEmail)
            );
            assert.ok(capturedReset);
            const resetMatch = capturedReset.body.html.match(
              /\/reset-password\?token=([A-Za-z0-9_%\-]+)/
            );
            assert.ok(resetMatch);
            const extractedResetToken = decodeURIComponent(resetMatch[1]);

            const resetDoRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: extractedResetToken,
                newPassword: nextPassword,
                confirmPassword: nextPassword,
              }),
            });
            assert.equal(resetDoRes.status, 200);

            const oldJwtRes = await fetch(`${baseUrl}/api/auth/me`, {
              headers: { Authorization: `Bearer ${regJson.token}` },
            });
            assert.equal(oldJwtRes.status, 401);

            const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ identifier: testEmail, password: nextPassword }),
            });
            assert.equal(newLoginRes.status, 200);

            const pwRow = await pool.query<{ passwordHash: string }>(
              'SELECT password_hash AS "passwordHash" FROM users WHERE id = $1',
              [regJson.user.id]
            );
            assert.equal(await bcrypt.compare(nextPassword, pwRow.rows[0].passwordHash), true);
          } finally {
            await pool.query('DELETE FROM users WHERE id = $1', [regJson.user.id]);
          }
        } else {
          console.log('[Email & Recovery Verification] Database not connected in local sandbox; live DB lifecycle skipped (verified crypto/Lockally API/HTTP routes).');
        }
      } finally {
        httpServer.closeAllConnections();
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      }
    } finally {
      await lockallyServer.close();
    }
  } finally {
    restoreEmailEnv();
  }

  console.log('[Email & Recovery Verification] PASSED.');
}

verifyEmailAndRecovery().catch((err) => {
  console.error('[Email & Recovery Verification] FAILED:', err);
  process.exit(1);
});
