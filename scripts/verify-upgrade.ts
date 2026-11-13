import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createApp } from '../server.js';
import {
  generatePaymentReference,
  nairaToKobo,
  verifyPaystackWebhookSignature,
} from '../src/server/lib/paystack.js';

async function verifyUpgrade() {
  console.log('[Upgrade Verification] Checking Paystack crypto & kobo helpers...');
  assert.equal(nairaToKobo(2000), 200000);
  assert.equal(nairaToKobo('2500.50'), 250050);
  assert.throws(() => nairaToKobo(-100));

  const ref1 = generatePaymentReference();
  const ref2 = generatePaymentReference();
  assert.notEqual(ref1, ref2);
  assert.ok(ref1.startsWith('ACDT-'));

  // TEST 5: Webhook signature validation
  const prevSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
  process.env.PAYSTACK_WEBHOOK_SECRET = 'test_webhook_secret_12345';
  try {
    const samplePayload = Buffer.from(
      JSON.stringify({
        event: 'charge.success',
        data: { reference: ref1, amount: 200000, currency: 'NGN', status: 'success' },
      })
    );
    const validSig = crypto
      .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
      .update(samplePayload)
      .digest('hex');

    assert.equal(verifyPaystackWebhookSignature(samplePayload, validSig), true);
    assert.equal(verifyPaystackWebhookSignature(samplePayload, 'deadbeef'.repeat(16)), false);
    assert.equal(verifyPaystackWebhookSignature(samplePayload, undefined), false);

    // Tampered payload must fail HMAC check
    const tamperedPayload = Buffer.from(samplePayload.toString().replace('200000', '100'));
    assert.equal(verifyPaystackWebhookSignature(tamperedPayload, validSig), false);
  } finally {
    if (prevSecret === undefined) delete process.env.PAYSTACK_WEBHOOK_SECRET;
    else process.env.PAYSTACK_WEBHOOK_SECRET = prevSecret;
  }

  console.log('[Upgrade Verification] Auditing payment settlement & duplicate/tamper protections...');
  const settlementSrc = await fs.readFile(
    path.resolve(process.cwd(), 'src/server/lib/paymentSettlement.ts'),
    'utf-8'
  );
  assert.ok(
    settlementSrc.includes('FOR UPDATE'),
    'Settlement must lock payment row with SELECT ... FOR UPDATE'
  );
  assert.ok(
    settlementSrc.includes('actualKobo !== expectedKobo'),
    'TEST 4: Must reject amount mismatches in kobo'
  );
  assert.ok(
    settlementSrc.includes('actualCurrency !== expectedCurrency'),
    'TEST 4: Must reject currency mismatches'
  );
  assert.ok(
    settlementSrc.includes("gatewayStatus === 'failed'") &&
      settlementSrc.includes('unlocked: false'),
    'TEST 3: Failed/pending payments must never unlock course access'
  );

  const migration2 = await fs.readFile(
    path.resolve(process.cwd(), 'migrations/0002_course_registration_payments.sql'),
    'utf-8'
  );
  assert.ok(
    migration2.includes('course_registrations_payment_unique_idx') &&
      migration2.includes('course_registrations_active_student_course_idx'),
    'TEST 6: Schema must enforce 1-payment-per-registration and 1-active-registration-per-course'
  );

  const paymentsRouteSrc = await fs.readFile(
    path.resolve(process.cwd(), 'src/server/routes/payments.ts'),
    'utf-8'
  );
  assert.ok(
    paymentsRouteSrc.includes('whatsappNumber') &&
      paymentsRouteSrc.includes('WHATSAPP_NUMBER_REGEX') &&
      paymentsRouteSrc.includes('whatsapp_number'),
    'Payments initialization must validate and persist WhatsApp number'
  );
  assert.ok(
    settlementSrc.includes('whatsapp_number') &&
      settlementSrc.includes('whatsappNumber'),
    'Payment settlement must carry whatsapp_number into course_registrations'
  );
  const courseRegViewSrc = await fs.readFile(
    path.resolve(process.cwd(), 'src/components/cbt/CourseRegistrationView.tsx'),
    'utf-8'
  );
  assert.ok(
    courseRegViewSrc.includes('Input your correct WhatsApp number') &&
      courseRegViewSrc.includes('course-reg-whatsapp'),
    'CourseRegistrationView must require students to input their correct WhatsApp number'
  );

  console.log('[Upgrade Verification] Auditing UI components for Course terminology...');
  const uiFiles = [
    'src/components/cbt/WorkspaceSidebar.tsx',
    'src/components/cbt/TopHeader.tsx',
    'src/components/cbt/HomeDashboard.tsx',
    'src/components/cbt/PracticeExamsView.tsx',
    'src/components/cbt/ResultsView.tsx',
    'src/components/cbt/StudyMaterialsView.tsx',
    'src/components/cbt/SettingsDrawer.tsx',
    'src/components/cbt/CourseRegistrationView.tsx',
    'src/components/cbt/MyRegisteredCoursesView.tsx',
    'src/components/cbt/CourseAccessRequiredModal.tsx',
    'src/components/cbt/AdminConsole.tsx',
  ];

  for (const relPath of uiFiles) {
    const content = await fs.readFile(path.resolve(process.cwd(), relPath), 'utf-8');
    // Ignore technical fallback field defaultSubjectId; check visible Subject UI strings
    const stripped = content.replace(/defaultSubjectId/g, '');
    assert.equal(
      /\bSubject\b|\bSubjects\b/.test(stripped),
      false,
      `Found user-facing "Subject" label in ${relPath}`
    );
  }

  console.log('[Upgrade Verification] Testing HTTP webhook signature rejection & auth gates...');
  process.env.PAYSTACK_WEBHOOK_SECRET = 'test_webhook_secret_12345';
  const app = await createApp({ skipVite: true });
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object');
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    // TEST 5: Invalid webhook signature returns 401
    const webhookRes = await fetch(`${baseUrl}/api/webhooks/paystack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': 'invalid_signature',
      },
      body: JSON.stringify({ event: 'charge.success', data: { reference: 'FAKE' } }),
    });
    assert.equal(webhookRes.status, 401);

    // Unauthenticated payment initialization blocked
    const payInitRes = await fetch(`${baseUrl}/api/payments/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: '11111111-1111-4111-8111-111111111111' }),
    });
    assert.ok(payInitRes.status === 401 || payInitRes.status === 503);

    // Unauthenticated exam start blocked
    const examStartRes = await fetch(`${baseUrl}/api/exams/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: '11111111-1111-4111-8111-111111111111' }),
    });
    assert.ok(examStartRes.status === 401 || examStartRes.status === 503);
  } finally {
    delete process.env.PAYSTACK_WEBHOOK_SECRET;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('[Upgrade Verification] PASSED.');
}

verifyUpgrade().catch((err) => {
  console.error('[Upgrade Verification] FAILED:', err);
  process.exit(1);
});
