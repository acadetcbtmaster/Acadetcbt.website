import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createApp } from '../server.js';
import {
  generatePaymentReference,
  isValidPaymentReferenceFormat,
  nairaToKobo,
  verifyPaystackWebhookSignature,
} from '../src/server/lib/paystack.js';
import {
  COURSE_VALUE_KOBO,
  TOTAL_STUDENT_PAYABLE_KOBO,
  computeApplicablePaystackFeeKobo,
  deriveDefaultCourseValueNaira,
  reconcileCoursePayment,
} from '../src/server/lib/pricing.js';
import {
  buildPaymentSuccessNotificationContent,
  normalizeWhatsappGroupLink,
} from '../src/server/lib/notifications.js';
import {
  DEFAULT_FOUNDER_PROFILE,
  DEFAULT_SITE_BRANDING,
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
  getSeoMetaForPath,
} from '../src/server/lib/branding.js';
import {
  CBT_RECOMMENDED_MIN_QUESTIONS,
  getCourseCbtReadiness,
  isQuestionBreakdownReconciled,
  normalizeQuestionDifficulty,
} from '../src/server/lib/questionStats.js';

async function verifyUpgrade() {
  console.log('[Upgrade Verification] Checking standardized pricing & Paystack fee reconciliation...');
  assert.equal(TOTAL_STUDENT_PAYABLE_KOBO, 235000);
  assert.equal(COURSE_VALUE_KOBO, 230000);

  // Local NGN ₦2,350 uses Paystack 1.5% (₦100 flat waived < ₦2,500) = 3525 kobo (₦35.25), not hardcoded ₦50
  const localFee = computeApplicablePaystackFeeKobo({
    amountKobo: TOTAL_STUDENT_PAYABLE_KOBO,
    currency: 'NGN',
    countryCode: 'NG',
  });
  assert.equal(localFee.paystackFeeKobo, 3525);
  assert.equal(localFee.feeSource, 'schedule_computed');

  const localRec = reconcileCoursePayment({
    totalChargedKobo: TOTAL_STUDENT_PAYABLE_KOBO,
    currency: 'NGN',
    countryCode: 'NG',
  });
  assert.equal(localRec.netSettlementKobo, 231475);
  assert.equal(localRec.coversCourseValue, true);
  assert.equal(localRec.reconciliationStatus, 'reconciled');
  assert.equal(localRec.settlementVarianceNaira, 14.75);

  // Paystack actual reported fees take precedence
  const actualRec = reconcileCoursePayment({
    totalChargedKobo: TOTAL_STUDENT_PAYABLE_KOBO,
    currency: 'NGN',
    gatewayReportedFeesKobo: 3525,
  });
  assert.equal(actualRec.feeSource, 'paystack_actual');
  assert.equal(actualRec.reconciliationStatus, 'reconciled');

  // Higher gateway fee creating net settlement below ₦2,300 triggers shortfall
  const shortfallActualRec = reconcileCoursePayment({
    totalChargedKobo: TOTAL_STUDENT_PAYABLE_KOBO,
    currency: 'NGN',
    gatewayReportedFeesKobo: 6000,
  });
  assert.equal(shortfallActualRec.netSettlementKobo, 229000);
  assert.equal(shortfallActualRec.coversCourseValue, false);
  assert.equal(shortfallActualRec.reconciliationStatus, 'shortfall');

  // International card fee schedule (3.9% + ₦100 = 19165 kobo) triggers shortfall
  const intlRec = reconcileCoursePayment({
    totalChargedKobo: TOTAL_STUDENT_PAYABLE_KOBO,
    currency: 'NGN',
    countryCode: 'US',
  });
  assert.equal(intlRec.paystackFeeKobo, 19165);
  assert.equal(intlRec.coversCourseValue, false);
  assert.equal(intlRec.reconciliationStatus, 'shortfall');

  // Custom per-course pricing reconciliation (e.g. ₦1,500 below and ₦5,000 above default ₦2,350)
  assert.equal(deriveDefaultCourseValueNaira(2350), 2300);
  const lowValue = deriveDefaultCourseValueNaira(1500);
  assert.equal(lowValue, 1477.5);
  const lowRec = reconcileCoursePayment({
    totalChargedKobo: nairaToKobo(1500),
    courseValueKobo: nairaToKobo(lowValue),
    currency: 'NGN',
    countryCode: 'NG',
  });
  assert.equal(lowRec.coversCourseValue, true);
  assert.equal(lowRec.reconciliationStatus, 'reconciled');

  const highValue = deriveDefaultCourseValueNaira(5000);
  assert.equal(highValue, 4825);
  const highRec = reconcileCoursePayment({
    totalChargedKobo: nairaToKobo(5000),
    courseValueKobo: nairaToKobo(highValue),
    currency: 'NGN',
    countryCode: 'NG',
  });
  assert.equal(highRec.coversCourseValue, true);
  assert.equal(highRec.reconciliationStatus, 'reconciled');

  console.log('[Upgrade Verification] Checking Paystack crypto & kobo helpers...');
  assert.equal(nairaToKobo(2350), 235000);
  assert.equal(nairaToKobo('2500.50'), 250050);
  assert.throws(() => nairaToKobo(-100));

  const ref1 = generatePaymentReference();
  const ref2 = generatePaymentReference();
  assert.notEqual(ref1, ref2);
  assert.ok(ref1.startsWith('ACD-'), `Expected reference to start with ACD-, got ${ref1}`);
  assert.equal(isValidPaymentReferenceFormat(ref1), true);
  assert.equal(isValidPaymentReferenceFormat('ACD-2026-ABCDEF1234'), true);
  assert.equal(isValidPaymentReferenceFormat('ACDT-2026-LEGACY01'), true);
  assert.equal(isValidPaymentReferenceFormat('ab'), false);
  assert.equal(isValidPaymentReferenceFormat('bad ref with spaces!'), false);

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

  console.log('[Upgrade Verification] Checking payment success notification & WhatsApp group links...');
  assert.equal(
    normalizeWhatsappGroupLink('https://chat.whatsapp.com/ABC123xyz'),
    'https://chat.whatsapp.com/ABC123xyz'
  );
  assert.equal(normalizeWhatsappGroupLink('  '), null);
  assert.equal(normalizeWhatsappGroupLink('javascript:alert(1)'), null);

  const withLink = buildPaymentSuccessNotificationContent({
    studentName: 'Chidi Okonkwo',
    courseTitle: 'Use of English',
    courseCode: 'GST 101',
    totalAmountChargedNaira: 2350,
    paymentReference: ref1,
    whatsappGroupLink: 'https://chat.whatsapp.com/AcadetGst101',
  });
  assert.ok(withLink.title.includes('GST 101'));
  assert.ok(withLink.message.includes('Chidi Okonkwo'));
  assert.ok(withLink.message.includes('₦2,350'));
  assert.ok(withLink.message.includes('unlocked'));
  assert.equal(withLink.actionUrl, 'https://chat.whatsapp.com/AcadetGst101');
  assert.equal(withLink.actionLabel, 'Join GST 101 Tutorial Group');

  const withoutLink = buildPaymentSuccessNotificationContent({
    studentName: 'Amina Yusuf',
    courseTitle: 'General Biology',
    courseCode: 'BIO 101',
    totalAmountChargedNaira: 2350,
    paymentReference: ref2,
    whatsappGroupLink: null,
  });
  assert.equal(withoutLink.actionUrl, null);
  assert.equal(withoutLink.actionLabel, null);
  assert.ok(!withoutLink.message.includes('chat.whatsapp.com'));

  // Paystack dashboard "Pass fees to customers" recovery math (238579 charged, 3579 fee -> 235000 settled)
  const passThroughRec = reconcileCoursePayment({
    totalChargedKobo: 238579,
    currency: 'NGN',
    gatewayReportedFeesKobo: 3579,
  });
  assert.equal(passThroughRec.netSettlementKobo, 235000);
  assert.equal(passThroughRec.coversCourseValue, true);
  assert.equal(passThroughRec.reconciliationStatus, 'reconciled');

  console.log('[Upgrade Verification] Auditing payment settlement & user lifecycle protections...');
  const settlementSrc = await fs.readFile(
    path.resolve(process.cwd(), 'src/server/lib/paymentSettlement.ts'),
    'utf-8'
  );
  assert.ok(
    settlementSrc.includes('FOR UPDATE'),
    'Settlement must lock payment row with SELECT ... FOR UPDATE'
  );
  assert.ok(
    settlementSrc.includes('actualKobo > expectedKobo') &&
      settlementSrc.includes('isPaystackFeePassThrough'),
    'Settlement must reject unauthorized charges above course expectedKobo while permitting exact Paystack pass-through recovery'
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
  assert.ok(
    settlementSrc.includes("outcome.paymentStatus === 'successful'") &&
      settlementSrc.includes('outcome.unlocked') &&
      settlementSrc.includes('generatePaymentSuccessNotification'),
    'Payment settlement must trigger notification strictly on successful unlock'
  );

  const authMiddlewareSrc = await fs.readFile(
    path.resolve(process.cwd(), 'src/server/middleware/auth.ts'),
    'utf-8'
  );
  const authRoutesSrc = await fs.readFile(
    path.resolve(process.cwd(), 'src/server/routes/auth.ts'),
    'utf-8'
  );
  assert.ok(
    authMiddlewareSrc.includes("code: 'ACCOUNT_SUSPENDED'") &&
      authRoutesSrc.includes("code: 'ACCOUNT_SUSPENDED'"),
    'Auth login and protected middleware must enforce 403 ACCOUNT_SUSPENDED'
  );

  const adminRoutesSrc = await fs.readFile(
    path.resolve(process.cwd(), 'src/server/routes/admin.ts'),
    'utf-8'
  );
  assert.ok(
    adminRoutesSrc.includes("code: 'CANNOT_DELETE_LAST_SUPER_ADMIN'") &&
      adminRoutesSrc.includes('deleted_student_ref') &&
      adminRoutesSrc.includes('LEFT JOIN users'),
    'Admin routes must guard last super admin, anonymize financial records, and LEFT JOIN users on payments'
  );

  const catalogRoutesSrc = await fs.readFile(
    path.resolve(process.cwd(), 'src/server/routes/catalog.ts'),
    'utf-8'
  );
  const publicCoursesSection = catalogRoutesSrc.split("router.get('/my-courses'")[0];
  assert.equal(
    publicCoursesSection.includes('whatsappGroupLink'),
    false,
    'Public /api/catalog/courses must never expose course WhatsApp group links before payment'
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

  assert.ok(
    adminRoutesSrc.includes("requireRole('super_admin')") &&
      adminRoutesSrc.includes('/payments/reset-all') &&
      adminRoutesSrc.includes("'RESET ALL PAYMENTS'") &&
      adminRoutesSrc.includes('acknowledgeConsequences') &&
      adminRoutesSrc.includes('preserved_payment_ref'),
    'Admin routes must restrict full payment reset & branding mutations to super_admin with backup confirmation and preserve course_registrations'
  );

  console.log('[Upgrade Verification] Auditing Payment Reference Verification, Receipt & Admin Review controls...');
  assert.ok(
    settlementSrc.includes('verifyAndSettleStudentReference') &&
      settlementSrc.includes('buildPaymentReceiptById') &&
      settlementSrc.includes('resolveAdminVerificationLog') &&
      settlementSrc.includes('duplicateTx') &&
      settlementSrc.includes('already been used for another course registration') &&
      settlementSrc.includes('awaiting_admin_review') &&
      settlementSrc.includes('unauthorized_or_mismatch'),
    'paymentSettlement.ts must enforce ownership, duplicate tx rejection, recovery review, and receipt guards'
  );
  assert.ok(
    paymentsRouteSrc.includes("router.post('/verify'") &&
      paymentsRouteSrc.includes("router.get('/:id/receipt'"),
    'payments.ts must expose manual reference POST /verify and GET /:id/receipt'
  );
  assert.ok(
    adminRoutesSrc.includes("router.get('/verification-logs'") &&
      adminRoutesSrc.includes("router.post('/verification-logs/:id/reverify'") &&
      adminRoutesSrc.includes("router.post('/verification-logs/:id/resolve'"),
    'admin.ts must expose verification-logs monitoring, live re-query, and controlled review endpoints'
  );

  const [copyBtnSrc, receiptModalSrc, verifyViewSrc, historyViewSrc, adminConsoleSrc] =
    await Promise.all([
      fs.readFile(path.resolve(process.cwd(), 'src/components/cbt/CopyReferenceButton.tsx'), 'utf-8'),
      fs.readFile(path.resolve(process.cwd(), 'src/components/cbt/PaymentReceiptModal.tsx'), 'utf-8'),
      fs.readFile(path.resolve(process.cwd(), 'src/components/cbt/PaymentVerificationView.tsx'), 'utf-8'),
      fs.readFile(path.resolve(process.cwd(), 'src/components/cbt/PaymentHistoryView.tsx'), 'utf-8'),
      fs.readFile(path.resolve(process.cwd(), 'src/components/cbt/AdminConsole.tsx'), 'utf-8'),
    ]);

  assert.ok(
    copyBtnSrc.includes('Payment reference copied successfully.'),
    'CopyReferenceButton must display confirmation text'
  );
  assert.ok(
    receiptModalSrc.includes('OFFICIAL PAYMENT RECEIPT') &&
      receiptModalSrc.includes('DOWNLOAD RECEIPT') &&
      receiptModalSrc.includes('PRINT RECEIPT') &&
      !receiptModalSrc.includes('window.open') &&
      !receiptModalSrc.includes('window.alert'),
    'PaymentReceiptModal must include receipt actions without window.open or window.alert'
  );
  assert.ok(
    verifyViewSrc.includes('Verify Your Payment') &&
      verifyViewSrc.includes('Enter Payment Reference') &&
      verifyViewSrc.includes('VERIFY PAYMENT'),
    'PaymentVerificationView must include exact verification UI copy'
  );
  assert.ok(
    historyViewSrc.includes('MY PAYMENT HISTORY'),
    'PaymentHistoryView must include MY PAYMENT HISTORY heading'
  );
  assert.ok(
    adminConsoleSrc.includes('PAYMENT VERIFICATION LOGS') &&
      adminConsoleSrc.includes('Confirm Verified Payment'),
    'AdminConsole must include PAYMENT VERIFICATION LOGS and Paystack-backed activation controls'
  );

  console.log('[Upgrade Verification] Auditing official logo PNGs, favicons & Organization JSON-LD...');
  const expectedIconDims: Array<[string, number]> = [
    ['public/acadet-logo.png', 1024],
    ['public/logo.png', 1024],
    ['public/favicon.png', 48],
    ['public/favicon-16x16.png', 16],
    ['public/favicon-32x32.png', 32],
    ['public/favicon-48x48.png', 48],
    ['public/favicon-96x96.png', 96],
    ['public/apple-touch-icon.png', 180],
    ['public/favicon-192x192.png', 192],
    ['public/favicon-512x512.png', 512],
  ];
  for (const [imgRel, expectedSize] of expectedIconDims) {
    const buf = await fs.readFile(path.resolve(process.cwd(), imgRel));
    assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${imgRel} must have valid PNG signature`);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    assert.equal(width, expectedSize, `${imgRel} width must be ${expectedSize} (got ${width})`);
    assert.equal(height, expectedSize, `${imgRel} height must be ${expectedSize} (got ${height})`);
  }
  const icoBuf = await fs.readFile(path.resolve(process.cwd(), 'public/favicon.ico'));
  assert.equal(icoBuf.subarray(0, 4).toString('hex'), '00000100', 'public/favicon.ico must have valid ICO header');
  const icoCount = icoBuf.readUInt16LE(4);
  const icoDims: number[] = [];
  for (let i = 0; i < icoCount; i++) {
    const o = 6 + i * 16;
    icoDims.push(icoBuf[o] || 256);
  }
  assert.ok(
    icoDims.includes(16) && icoDims.includes(32) && icoDims.includes(48),
    `public/favicon.ico must contain 16, 32, and 48px icons (got ${icoDims.join(',')})`
  );

  assert.equal(
    DEFAULT_SITE_BRANDING.seoTitle,
    'Acadet CBT – Online CBT Practice and Learning Platform'
  );

  const orgJsonLd = buildOrganizationJsonLd(
    'https://acadetcbt.website',
    DEFAULT_SITE_BRANDING,
    DEFAULT_FOUNDER_PROFILE
  ) as Record<string, unknown>;
  assert.equal(orgJsonLd['@type'], 'Organization');
  assert.equal(orgJsonLd.name, 'Acadet CBT');
  assert.ok(Array.isArray(orgJsonLd.alternateName) && orgJsonLd.alternateName.includes('Acadet Learning Hub'));
  assert.equal((orgJsonLd.founder as Record<string, unknown>)?.name, 'ISAIAH (MENMEX)');
  assert.equal('aggregateRating' in orgJsonLd, false, 'Organization JSON-LD must never include fake ratings');
  assert.equal('review' in orgJsonLd, false, 'Organization JSON-LD must never include fake reviews');

  const websiteJsonLd = buildWebsiteJsonLd(
    'https://acadetcbt.website',
    DEFAULT_SITE_BRANDING
  ) as Record<string, unknown>;
  assert.equal(websiteJsonLd['@type'], 'WebSite');
  assert.equal(websiteJsonLd.name, 'Acadet CBT');
  assert.equal(websiteJsonLd.url, 'https://acadetcbt.website/');
  assert.equal(websiteJsonLd.inLanguage, 'en-NG');
  assert.equal('aggregateRating' in websiteJsonLd, false);

  const homeSeo = getSeoMetaForPath(
    '/',
    'https://acadetcbt.website',
    DEFAULT_SITE_BRANDING,
    DEFAULT_FOUNDER_PROFILE
  );
  assert.equal(homeSeo.title, 'Acadet CBT – Online CBT Practice and Learning Platform');
  assert.equal(homeSeo.jsonLd.length, 2);

  const founderSeo = getSeoMetaForPath(
    '/founder',
    'https://acadetcbt.website',
    DEFAULT_SITE_BRANDING,
    DEFAULT_FOUNDER_PROFILE
  );
  assert.equal(founderSeo.ogType, 'profile');
  assert.equal(founderSeo.robots, 'index, follow');
  assert.equal(founderSeo.jsonLd.length, 3);

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
    'src/components/cbt/NotificationsView.tsx',
    'src/components/cbt/CopyReferenceButton.tsx',
    'src/components/cbt/PaymentReceiptModal.tsx',
    'src/components/cbt/PaymentVerificationView.tsx',
    'src/components/cbt/PaymentHistoryView.tsx',
    'src/components/cbt/PaymentVerificationBanner.tsx',
    'src/components/cbt/QuestionStatsDashboard.tsx',
    'src/components/cbt/AdminEmailStatusPanel.tsx',
    'src/components/cbt/ResetPasswordScreen.tsx',
    'src/components/cbt/VerifyEmailScreen.tsx',
    'src/components/cbt/AdminConsole.tsx',
    'src/components/cbt/AuthScreen.tsx',
    'src/components/cbt/ExamHall.tsx',
    'src/components/public/PublicShell.tsx',
    'src/components/public/FounderView.tsx',
    'src/components/public/PublicPages.tsx',
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

  console.log('[Upgrade Verification] Auditing Question Statistics Dashboard & Difficulty Breakdown logic...');
  assert.equal(normalizeQuestionDifficulty('Easy'), 'Easy');
  assert.equal(normalizeQuestionDifficulty('  medium '), 'Medium');
  assert.equal(normalizeQuestionDifficulty('Hard'), 'Hard');
  assert.equal(normalizeQuestionDifficulty('difficult'), 'Hard');
  assert.equal(normalizeQuestionDifficulty('unknown'), 'Uncategorized');

  assert.equal(CBT_RECOMMENDED_MIN_QUESTIONS, 20);
  assert.equal(getCourseCbtReadiness(0).status, 'empty');
  assert.equal(getCourseCbtReadiness(19).status, 'low');
  assert.equal(getCourseCbtReadiness(20).status, 'ready');
  assert.equal(getCourseCbtReadiness(20).ready, true);

  assert.equal(
    isQuestionBreakdownReconciled({
      questionCount: 300,
      easyCount: 100,
      mediumCount: 120,
      hardCount: 80,
      uncategorizedCount: 0,
    }),
    true
  );
  assert.equal(
    isQuestionBreakdownReconciled({
      questionCount: 300,
      easyCount: 100,
      mediumCount: 100,
      hardCount: 80,
      uncategorizedCount: 0,
    }),
    false
  );

  assert.ok(
    adminRoutesSrc.includes("router.get('/questions/stats'") &&
      adminRoutesSrc.includes('easyCount') &&
      adminRoutesSrc.includes('mediumCount') &&
      adminRoutesSrc.includes('hardCount') &&
      adminRoutesSrc.includes('uncategorizedCount') &&
      adminRoutesSrc.includes('admin.question.update'),
    'admin.ts must expose real-time PostgreSQL difficulty stats and audit-logged question updates'
  );
  assert.ok(
    adminConsoleSrc.includes('QuestionStatsDashboard') &&
      adminConsoleSrc.includes('Update Question') &&
      adminConsoleSrc.includes('Question Breakdown'),
    'AdminConsole must render QuestionStatsDashboard, course Question Breakdown, and Question Edit UI'
  );

  console.log('[Upgrade Verification] Testing HTTP webhook signature rejection, SEO endpoints & auth gates...');
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

    // Unauthenticated notifications route blocked (401 or 503 when DB unconfigured, never 404)
    const notifRes = await fetch(`${baseUrl}/api/notifications`);
    assert.ok(notifRes.status === 401 || notifRes.status === 503);

    // Public site data endpoint exposes branding + founder + courses without PII or WhatsApp invite links
    const publicSiteRes = await fetch(`${baseUrl}/api/public/site-data`);
    assert.equal(publicSiteRes.status, 200);
    const siteData = (await publicSiteRes.json()) as {
      branding: { siteName: string };
      founder: { fullName: string };
      courses: Array<Record<string, unknown>>;
    };
    assert.equal(siteData.branding.siteName, 'Acadet CBT');
    assert.equal(siteData.founder.fullName, 'ISAIAH (MENMEX)');
    assert.ok(Array.isArray(siteData.courses));
    assert.equal(JSON.stringify(siteData.courses).includes('whatsappGroupLink'), false);

    // Dynamic robots.txt & sitemap.xml
    const robotsRes = await fetch(`${baseUrl}/robots.txt`);
    assert.equal(robotsRes.status, 200);
    const robotsTxt = await robotsRes.text();
    assert.ok(
      robotsTxt.includes('Disallow: /api/') &&
        robotsTxt.includes('Disallow: /admin') &&
        robotsTxt.includes('Disallow: /exam') &&
        robotsTxt.includes('Disallow: /404.html') &&
        robotsTxt.includes('Allow: /founder') &&
        robotsTxt.includes('Allow: /faq') &&
        robotsTxt.includes('Allow: /privacy') &&
        robotsTxt.includes('Allow: /terms'),
      'robots.txt must allow public pages and disallow private routes & /404.html'
    );

    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(sitemapRes.status, 200);
    const sitemapXml = await sitemapRes.text();
    for (const locPath of ['/courses', '/about', '/how-it-works', '/founder', '/faq', '/contact', '/privacy', '/terms']) {
      assert.ok(sitemapXml.includes(locPath), `sitemap.xml missing ${locPath}`);
    }
    assert.equal(sitemapXml.includes('/admin'), false, 'sitemap.xml must exclude /admin');
    assert.equal(sitemapXml.includes('/login'), false, 'sitemap.xml must exclude /login');
    assert.equal(sitemapXml.includes('/404'), false, 'sitemap.xml must exclude /404');

    // Canonical base resolution enforces https://acadetcbt.website on custom & onrender domains
    const prevAppUrl = process.env.APP_URL;
    delete process.env.APP_URL;
    try {
      const { resolveBaseUrl } = await import('../src/server/lib/branding.js');
      assert.equal(
        resolveBaseUrl({
          protocol: 'https',
          get: (h: string) => (h === 'host' ? 'acadet-cbt.onrender.com' : undefined),
        }),
        'https://acadetcbt.website'
      );
      assert.equal(
        resolveBaseUrl({
          protocol: 'http',
          get: (h: string) => (h === 'host' ? 'www.acadetcbt.website' : undefined),
        }),
        'https://acadetcbt.website'
      );

      // Every indexable public page returns HTTP 200 without redirects
      for (const pubPath of ['/', '/courses', '/about', '/how-it-works', '/founder', '/faq', '/contact', '/privacy', '/terms']) {
        const pageRes = await fetch(`${baseUrl}${pubPath}`, { redirect: 'manual' });
        assert.equal(pageRes.status, 200, `Expected 200 OK on public route ${pubPath}, got ${pageRes.status}`);
        const pageHtml = await pageRes.text();
        assert.ok(
          pageHtml.includes('<meta name="robots" content="index, follow" />'),
          `Expected index, follow meta on ${pubPath}`
        );
        assert.ok(
          pageHtml.includes('<meta property="og:site_name" content="Acadet CBT" />'),
          `Expected og:site_name on ${pubPath}`
        );
        assert.ok(
          pageHtml.includes('id="acadet-org-jsonld"') && pageHtml.includes('id="acadet-website-jsonld"'),
          `Expected Organization and WebSite JSON-LD scripts on ${pubPath}`
        );
        assert.ok(
          pageHtml.includes(`<link rel="canonical" href="${baseUrl}${pubPath === '/' ? '/' : pubPath}"`),
          `Expected canonical tag on ${pubPath}`
        );
        if (pubPath === '/') {
          assert.ok(
            pageHtml.includes('<title>Acadet CBT – Online CBT Practice and Learning Platform</title>'),
            'Homepage HTML must serve updated Acadet CBT SEO title'
          );
          for (const requiredIconTag of [
            'href="/favicon.ico"',
            'href="/favicon-16x16.png"',
            'href="/favicon-32x32.png"',
            `href="${baseUrl}/favicon-48x48.png"`,
            'href="/favicon-96x96.png"',
            'href="/favicon-192x192.png"',
            'href="/apple-touch-icon.png"',
            'href="/manifest.json"',
          ]) {
            assert.ok(
              pageHtml.includes(requiredIconTag),
              `Homepage HTML must include favicon link ${requiredIconTag}`
            );
          }
          assert.equal(
            pageHtml.match(/sizes="48x48"/g)?.length,
            1,
            'Homepage HTML must not duplicate 48x48 favicon link'
          );
        }
      }

      const robotsRes = await fetch(`${baseUrl}/robots.txt`);
      assert.equal(robotsRes.status, 200);
      const robotsTxt = await robotsRes.text();
      for (const allowedIcon of [
        'Allow: /favicon.ico',
        'Allow: /favicon-48x48.png',
        'Allow: /favicon-96x96.png',
        'Allow: /apple-touch-icon.png',
        'Allow: /acadet-logo.png',
      ]) {
        assert.ok(robotsTxt.includes(allowedIcon), `robots.txt must include ${allowedIcon}`);
      }

      // Legacy /404.html, nonexistent routes, and nonexistent assets must return real HTTP 404 (not 200 or redirect)
      const static404Res = await fetch(`${baseUrl}/404.html`, { redirect: 'manual' });
      assert.equal(static404Res.status, 404, '/404.html must return HTTP 404');
      const static404Html = await static404Res.text();
      assert.equal(static404Html.includes('location.replace'), false, '/404.html must not contain JS redirect');

      const missingPageRes = await fetch(`${baseUrl}/nonexistent-old-page`, { redirect: 'manual' });
      assert.equal(missingPageRes.status, 404, 'Unknown path must return HTTP 404');
      const missingPageHtml = await missingPageRes.text();
      assert.ok(missingPageHtml.includes('noindex, nofollow'), '404 HTML must carry noindex, nofollow');
      assert.equal(missingPageHtml.includes('<link rel="canonical"'), false, '404 HTML must omit canonical link');

      const missingAssetRes = await fetch(`${baseUrl}/assets/nonexistent-bundle.js`, { redirect: 'manual' });
      assert.equal(missingAssetRes.status, 404, 'Missing static JS asset must return HTTP 404');

      // Trailing slash on known public route & /index.html normalize cleanly via single-hop 301
      const slashRes = await fetch(`${baseUrl}/about/`, { redirect: 'manual' });
      assert.equal(slashRes.status, 301);
      assert.equal(slashRes.headers.get('location'), '/about');

      const indexHtmlRes = await fetch(`${baseUrl}/index.html`, { redirect: 'manual' });
      assert.equal(indexHtmlRes.status, 301);
      assert.equal(indexHtmlRes.headers.get('location'), '/');
    } finally {
      if (prevAppUrl === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = prevAppUrl;
    }

    // Unauthenticated admin branding & full payment reset endpoints must reject access
    const adminBrandRes = await fetch(`${baseUrl}/api/admin/branding`);
    assert.ok(adminBrandRes.status === 401 || adminBrandRes.status === 503);

    const resetAllRes = await fetch(`${baseUrl}/api/admin/payments/reset-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.ok(resetAllRes.status === 401 || resetAllRes.status === 503);

    // Unauthenticated payment verification, receipt, and admin verification logs endpoints must reject access
    const manualVerifyRes = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: 'ACD-2026-1234567890' }),
    });
    assert.ok(manualVerifyRes.status === 401 || manualVerifyRes.status === 503);

    const receiptRes = await fetch(
      `${baseUrl}/api/payments/11111111-1111-4111-8111-111111111111/receipt`
    );
    assert.ok(receiptRes.status === 401 || receiptRes.status === 503);

    const verifLogsRes = await fetch(`${baseUrl}/api/admin/verification-logs`);
    assert.ok(verifLogsRes.status === 401 || verifLogsRes.status === 503);

    const verifResolveRes = await fetch(
      `${baseUrl}/api/admin/verification-logs/11111111-1111-4111-8111-111111111111/resolve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_activate', resolutionNote: 'test' }),
      }
    );
    assert.ok(verifResolveRes.status === 401 || verifResolveRes.status === 503);

    const qStatsRes = await fetch(`${baseUrl}/api/admin/questions/stats`);
    assert.ok(qStatsRes.status === 401 || qStatsRes.status === 503);
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
