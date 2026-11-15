import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
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
  getSmtpConfigSummary,
  sendAdminTestEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  validateSmtpStartup,
  verifySmtpConnection,
} from '../src/server/lib/email.js';

interface CapturedSmtpMessage {
  mailFrom: string;
  rcptTo: string[];
  rawData: string;
  subject: string;
}

function decodeRfc2047AndBody(raw: string): { subject: string; bodyText: string } {
  const splitIdx = raw.indexOf('\n\n');
  const headerBlock = splitIdx >= 0 ? raw.slice(0, splitIdx) : raw;
  const bodyBlock = splitIdx >= 0 ? raw.slice(splitIdx + 2) : raw;

  // Unfold RFC 5322 folded headers (CRLF/LF followed by whitespace)
  const unfoldedHeaders = headerBlock.replace(/\r?\n[ \t]+/g, ' ');
  const subjectMatch = unfoldedHeaders.match(/^Subject:\s*(.+)$/im);
  let subject = subjectMatch ? subjectMatch[1].trim() : '';

  // Remove inter-word whitespace between adjacent =?...?= encoded words and decode UTF-8 Q-encoding
  subject = subject
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/=\?UTF-8\?Q\?([^?]+)\?=/gi, (_, encoded: string) => {
      const bytes: number[] = [];
      const spaced = encoded.replace(/_/g, ' ');
      for (let i = 0; i < spaced.length; i++) {
        if (spaced[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(spaced.slice(i + 1, i + 3))) {
          bytes.push(parseInt(spaced.slice(i + 1, i + 3), 16));
          i += 2;
        } else {
          bytes.push(...Buffer.from(spaced[i], 'utf8'));
        }
      }
      return Buffer.from(bytes).toString('utf8');
    });

  // Decode quoted-printable soft line breaks & bytes in body
  const bodyBytes: number[] = [];
  const joinedBody = bodyBlock.replace(/=\r?\n/g, '');
  for (let i = 0; i < joinedBody.length; i++) {
    if (joinedBody[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(joinedBody.slice(i + 1, i + 3))) {
      bodyBytes.push(parseInt(joinedBody.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bodyBytes.push(...Buffer.from(joinedBody[i], 'utf8'));
    }
  }

  return {
    subject,
    bodyText: Buffer.from(bodyBytes).toString('utf8'),
  };
}

async function startLocalSmtpTestServer(): Promise<{
  port: number;
  messages: CapturedSmtpMessage[];
  close: () => Promise<void>;
}> {
  const messages: CapturedSmtpMessage[] = [];

  const server = net.createServer((socket) => {
    socket.setEncoding('utf8');
    let buffer = '';
    let inDataMode = false;
    let currentFrom = '';
    let currentRcpt: string[] = [];
    let currentData = '';
    let authStage: 'none' | 'user' | 'pass' = 'none';

    const writeLine = (line: string) => {
      if (!socket.destroyed) {
        socket.write(`${line}\r\n`);
      }
    };

    writeLine('220 localhost ESMTP AcadetTestMail');

    socket.on('data', (chunk: string) => {
      buffer += chunk;

      while (true) {
        const lineEnd = buffer.indexOf('\n');
        if (lineEnd === -1) break;

        let line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 1);
        if (line.endsWith('\r')) {
          line = line.slice(0, -1);
        }

        if (inDataMode) {
          if (line === '.') {
            inDataMode = false;
            const parsed = decodeRfc2047AndBody(currentData);
            messages.push({
              mailFrom: currentFrom,
              rcptTo: [...currentRcpt],
              rawData: parsed.bodyText,
              subject: parsed.subject,
            });
            currentFrom = '';
            currentRcpt = [];
            currentData = '';
            writeLine('250 2.0.0 OK queued');
          } else {
            currentData += (line.startsWith('..') ? line.slice(1) : line) + '\n';
          }
          continue;
        }

        if (authStage === 'user') {
          authStage = 'pass';
          writeLine('334 UGFzc3dvcmQ6'); // Password:
          continue;
        }
        if (authStage === 'pass') {
          authStage = 'none';
          writeLine('235 2.7.0 Authentication successful');
          continue;
        }

        const upper = line.toUpperCase();
        if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
          writeLine('250-localhost Hello');
          writeLine('250-SIZE 10485760');
          writeLine('250 AUTH PLAIN LOGIN');
        } else if (upper.startsWith('AUTH PLAIN')) {
          writeLine('235 2.7.0 Authentication successful');
        } else if (upper.startsWith('AUTH LOGIN')) {
          authStage = 'user';
          writeLine('334 VXNlcm5hbWU6'); // Username:
        } else if (upper.startsWith('MAIL FROM:')) {
          currentFrom = line.slice(10).trim();
          writeLine('250 2.1.0 Originator OK');
        } else if (upper.startsWith('RCPT TO:')) {
          currentRcpt.push(line.slice(8).trim());
          writeLine('250 2.1.5 Recipient OK');
        } else if (upper === 'DATA') {
          inDataMode = true;
          currentData = '';
          writeLine('354 End data with <CR><LF>.<CR><LF>');
        } else if (upper === 'NOOP') {
          writeLine('250 OK');
        } else if (upper === 'RSET') {
          currentFrom = '';
          currentRcpt = [];
          currentData = '';
          writeLine('250 OK');
        } else if (upper === 'QUIT') {
          writeLine('221 2.0.0 Bye');
          socket.end();
        } else {
          writeLine('250 OK');
        }
      }
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');

  return {
    port: addr.port,
    messages,
    close: async () => {
      server.close();
    },
  };
}

function saveAndClearSmtpEnv() {
  const keys = [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM_EMAIL',
    'SMTP_SECURE',
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
  console.log('[Email & Recovery Verification] 1. Testing token cryptography & password rules...');
  assert.equal(PASSWORD_RESET_TTL_MINUTES, 20);
  assert.equal(EMAIL_VERIFICATION_TTL_HOURS, 24);

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

  console.log('[Email & Recovery Verification] 2. Checking frontend zero-secret hygiene...');
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
      src.includes('SMTP_PASSWORD') || src.includes('nodemailer'),
      false,
      `Frontend file ${rel} must never reference SMTP_PASSWORD or nodemailer`
    );
  }

  console.log('[Email & Recovery Verification] 3. Testing missing SMTP credentials graceful handling...');
  const restoreSmtpEnv = saveAndClearSmtpEnv();
  try {
    const startupMissing = validateSmtpStartup();
    assert.equal(startupMissing.configured, false);
    assert.equal(startupMissing.connectionStatus, 'unconfigured');
    assert.deepEqual(startupMissing.missingVariables, [
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASSWORD',
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
    assert.equal(skippedSend.status, 'skipped_unconfigured');

    console.log('[Email & Recovery Verification] 4. Testing unreachable SMTP failure & secret redaction...');
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = '19'; // Unbound / closed local port
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'acadet_smtp_secret_user';
    process.env.SMTP_PASSWORD = 'SUPER_SECRET_PASSWORD_DO_NOT_LEAK';
    process.env.SMTP_FROM_EMAIL = 'support@acadetcbt.website';
    process.env.APP_BASE_URL = 'https://acadetcbt.website';

    const failedConn = await verifySmtpConnection();
    assert.equal(failedConn.configured, true);
    assert.equal(failedConn.connectionStatus, 'connection_failed');
    assert.ok(failedConn.lastError, 'Unreachable SMTP must record sanitized diagnostic error');
    assert.equal(
      (failedConn.lastError || '').includes('SUPER_SECRET_PASSWORD_DO_NOT_LEAK'),
      false,
      'SMTP_PASSWORD must be redacted from errors'
    );

    console.log('[Email & Recovery Verification] 5. Testing real Nodemailer SMTP delivery over TCP...');
    const smtpServer = await startLocalSmtpTestServer();
    try {
      process.env.SMTP_PORT = String(smtpServer.port);

      const liveConn = await verifySmtpConnection();
      assert.equal(liveConn.connectionStatus, 'connected');
      assert.equal(liveConn.lastError, null);

      const verifyToken = generateRawAuthToken();
      const resetToken = generateRawAuthToken();

      const verifyRes = await sendVerificationEmail({
        userId: '11111111-1111-4111-8111-111111111111',
        toEmail: 'verify-student@example.com',
        fullName: 'Chinedu Eze',
        rawToken: verifyToken,
      });
      assert.equal(verifyRes.sent, true);
      assert.equal(verifyRes.status, 'sent');

      const resetRes = await sendPasswordResetEmail({
        userId: '11111111-1111-4111-8111-111111111111',
        toEmail: 'reset-student@example.com',
        fullName: 'Zainab Bello',
        rawToken: resetToken,
      });
      assert.equal(resetRes.sent, true);
      assert.equal(resetRes.status, 'sent');

      const changedRes = await sendPasswordChangedEmail({
        userId: '11111111-1111-4111-8111-111111111111',
        toEmail: 'reset-student@example.com',
        fullName: 'Zainab Bello',
      });
      assert.equal(changedRes.sent, true);

      const adminTestRes = await sendAdminTestEmail({
        adminUserId: '22222222-2222-4222-8222-222222222222',
        toEmail: 'admin@acadetcbt.website',
        adminName: 'Acadet Admin',
      });
      assert.equal(adminTestRes.sent, true);

      assert.equal(smtpServer.messages.length, 4);

      const msgVerify = smtpServer.messages[0];
      assert.equal(msgVerify.subject, 'Verify Your Acadet CBT Account');
      assert.ok(msgVerify.rawData.includes(`https://acadetcbt.website/verify-email?token=${encodeURIComponent(verifyToken)}`));
      assert.ok(msgVerify.rawData.includes('https://acadetcbt.website/acadet-logo.png'));
      assert.ok(msgVerify.rawData.includes('24 hours'));

      const msgReset = smtpServer.messages[1];
      assert.equal(msgReset.subject, 'Acadet CBT – Password Reset Request');
      assert.ok(msgReset.rawData.includes(`https://acadetcbt.website/reset-password?token=${encodeURIComponent(resetToken)}`));
      assert.ok(msgReset.rawData.includes('https://acadetcbt.website/acadet-logo.png'));
      assert.ok(msgReset.rawData.includes('20 minutes'));
      assert.equal(msgReset.rawData.includes('SUPER_SECRET_PASSWORD_DO_NOT_LEAK'), false);

      const msgChanged = smtpServer.messages[2];
      assert.equal(msgChanged.subject, 'Acadet CBT – Password Successfully Changed');
      assert.ok(msgChanged.rawData.includes('https://acadetcbt.website/login'));

      const msgAdmin = smtpServer.messages[3];
      assert.equal(msgAdmin.subject, 'Acadet CBT – SMTP Configuration Test');

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
        const healthBody = (await healthRes.json()) as { email?: { configured: boolean } };
        assert.equal(healthBody.email?.configured, true);

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

        // Live DB E2E test automatically runs if PostgreSQL DATABASE_URL is connected
        const dbHealth = await checkDatabaseHealth();
        if (isDatabaseConfigured() && dbHealth.connected) {
          console.log('[Email & Recovery Verification] 7. Database connected — executing full live PostgreSQL lifecycle tests...');
          const pool = getPool();
          const testEmail = `e2e.recovery.${Date.now()}@acadetcbt-test.local`;
          const initialPassword = 'OldPassword123!';
          const nextPassword = 'NewSecurePassword456!';

          // 7a. Register new student -> verify email sent
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
            // Confirm raw token is NOT stored in DB
            const dbTokenCheck = await pool.query<{ tokenHash: string }>(
              'SELECT token_hash AS "tokenHash" FROM email_verification_tokens WHERE user_id = $1',
              [regJson.user.id]
            );
            assert.equal(dbTokenCheck.rowCount, 1);

            const capturedVerify = smtpServer.messages.find(
              (m) =>
                m.subject === 'Verify Your Acadet CBT Account' &&
                m.rcptTo.some((r) => r.includes(testEmail))
            );
            assert.ok(capturedVerify, 'Registration must dispatch real SMTP verification email');
            const verifyMatch = capturedVerify.rawData.match(/\/verify-email\?token=([A-Za-z0-9_%\-]+)/);
            assert.ok(verifyMatch, 'Verification email must contain token URL');
            const extractedVerifyToken = decodeURIComponent(verifyMatch[1]);
            assert.notEqual(dbTokenCheck.rows[0].tokenHash, extractedVerifyToken);

            // 7b. Consume verification token
            const doVerifyRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: extractedVerifyToken }),
            });
            assert.equal(doVerifyRes.status, 200);

            const meAfterVerify = await (
              await fetch(`${baseUrl}/api/auth/me`, {
                headers: { Authorization: `Bearer ${regJson.token}` },
              })
            ).json();
            assert.equal(meAfterVerify.user.emailVerified, true);

            // 7c. Forgot password -> reset email sent
            const forgotRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: testEmail }),
            });
            assert.equal(forgotRes.status, 200);

            const capturedReset = smtpServer.messages.find(
              (m) =>
                m.subject === 'Acadet CBT – Password Reset Request' &&
                m.rcptTo.some((r) => r.includes(testEmail))
            );
            assert.ok(capturedReset, 'Forgot password must dispatch reset email');
            const resetMatch = capturedReset.rawData.match(/\/reset-password\?token=([A-Za-z0-9_%\-]+)/);
            assert.ok(resetMatch);
            const extractedResetToken = decodeURIComponent(resetMatch[1]);

            // Validate reset token endpoint succeeds
            const valRes = await fetch(
              `${baseUrl}/api/auth/reset-password/validate?token=${encodeURIComponent(extractedResetToken)}`
            );
            assert.equal(valRes.status, 200);

            // Perform reset
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

            // Confirm password changed notification was sent
            const capturedChanged = smtpServer.messages.find(
              (m) =>
                m.subject === 'Acadet CBT – Password Successfully Changed' &&
                m.rcptTo.some((r) => r.includes(testEmail))
            );
            assert.ok(capturedChanged, 'Password reset must send confirmation email');

            // Token reuse must fail
            const reuseRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: extractedResetToken,
                newPassword: nextPassword,
                confirmPassword: nextPassword,
              }),
            });
            assert.equal(reuseRes.status, 400);
            const reuseJson = (await reuseRes.json()) as { code?: string };
            assert.equal(reuseJson.code, 'TOKEN_ALREADY_USED');

            // Prior JWT session must be invalidated immediately
            const oldJwtRes = await fetch(`${baseUrl}/api/auth/me`, {
              headers: { Authorization: `Bearer ${regJson.token}` },
            });
            assert.equal(oldJwtRes.status, 401);

            // Old password login rejected
            const oldLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ identifier: testEmail, password: initialPassword }),
            });
            assert.equal(oldLoginRes.status, 401);

            // New password login succeeds
            const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ identifier: testEmail, password: nextPassword }),
            });
            assert.equal(newLoginRes.status, 200);

            // Confirm expired token rejection via expired row test
            const expiredRaw = generateRawAuthToken();
            const expiredHash = hashAuthToken(expiredRaw);
            await pool.query(
              `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
               VALUES ($1, $2, NOW() - INTERVAL '1 minute')`,
              [regJson.user.id, expiredHash]
            );
            const expCheckRes = await fetch(
              `${baseUrl}/api/auth/reset-password/validate?token=${encodeURIComponent(expiredRaw)}`
            );
            assert.equal(expCheckRes.status, 400);
            const expCheckJson = (await expCheckRes.json()) as { status?: string };
            assert.equal(expCheckJson.status, 'expired');

            // Confirm password_hash actually changed via bcrypt check
            const pwRow = await pool.query<{ passwordHash: string }>(
              'SELECT password_hash AS "passwordHash" FROM users WHERE id = $1',
              [regJson.user.id]
            );
            assert.equal(await bcrypt.compare(nextPassword, pwRow.rows[0].passwordHash), true);
          } finally {
            await pool.query('DELETE FROM users WHERE id = $1', [regJson.user.id]);
          }
        } else {
          console.log('[Email & Recovery Verification] Database not connected in local sandbox; live DB lifecycle skipped (verified static/crypto/SMTP/HTTP routes).');
        }
      } finally {
        httpServer.closeAllConnections();
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      }
    } finally {
      await smtpServer.close();
    }
  } finally {
    restoreSmtpEnv();
  }

  console.log('[Email & Recovery Verification] PASSED.');
}

verifyEmailAndRecovery().catch((err) => {
  console.error('[Email & Recovery Verification] FAILED:', err);
  process.exit(1);
});
