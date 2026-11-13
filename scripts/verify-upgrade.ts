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
import {
  COURSE_VALUE_KOBO,
  TOTAL_STUDENT_PAYABLE_KOBO,
  computeApplicablePaystackFeeKobo,
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
  getSeoMetaForPath,
} from '../src/server/lib/branding.js';

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

  console.log('[Upgrade Verification] Checking Paystack crypto & kobo helpers...');
  assert.equal(nairaToKobo(2350), 235000);
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
    settlementSrc.includes('actualKobo > TOTAL_STUDENT_PAYABLE_KOBO') &&
      settlementSrc.includes('isPaystackFeePassThrough'),
    'Settlement must reject unauthorized charges above TOTAL_STUDENT_PAYABLE_KOBO while permitting exact Paystack pass-through recovery'
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

  console.log('[Upgrade Verification] Auditing official logo PNGs, favicons & Organization JSON-LD...');
  for (const imgRel of ['public/acadet-logo.png', 'public/favicon-48x48.png']) {
    const buf = await fs.readFile(path.resolve(process.cwd(), imgRel));
    assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${imgRel} must have valid PNG signature`);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    assert.ok(width >= 48 && height >= 48 && width === height, `${imgRel} must be square >= 48x48 (got ${width}x${height})`);
  }
  const icoBuf = await fs.readFile(path.resolve(process.cwd(), 'public/favicon.ico'));
  assert.equal(icoBuf.subarray(0, 4).toString('hex'), '00000100', 'public/favicon.ico must have valid ICO header');

  const orgJsonLd = buildOrganizationJsonLd(
    'https://acadetcbt.website',
    DEFAULT_SITE_BRANDING,
    DEFAULT_FOUNDER_PROFILE
  ) as Record<string, unknown>;
  assert.equal(orgJsonLd['@type'], 'Organization');
  assert.equal(orgJsonLd.name, 'Acadet CBT');
  assert.equal(orgJsonLd.alternateName, 'Acadet Learning Hub');
  assert.equal((orgJsonLd.founder as Record<string, unknown>)?.name, 'ISAIAH (MENMEX)');
  assert.equal('aggregateRating' in orgJsonLd, false, 'Organization JSON-LD must never include fake ratings');
  assert.equal('review' in orgJsonLd, false, 'Organization JSON-LD must never include fake reviews');

  const founderSeo = getSeoMetaForPath(
    '/founder',
    'https://acadetcbt.website',
    DEFAULT_SITE_BRANDING,
    DEFAULT_FOUNDER_PROFILE
  );
  assert.equal(founderSeo.ogType, 'profile');
  assert.equal(founderSeo.robots, 'index, follow');

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
        robotsTxt.includes('Allow: /founder'),
      'robots.txt must allow /founder and disallow private routes'
    );

    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(sitemapRes.status, 200);
    const sitemapXml = await sitemapRes.text();
    for (const locPath of ['/about', '/courses', '/how-it-works', '/founder', '/contact']) {
      assert.ok(sitemapXml.includes(locPath), `sitemap.xml missing ${locPath}`);
    }
    assert.equal(sitemapXml.includes('/admin'), false, 'sitemap.xml must exclude /admin');
    assert.equal(sitemapXml.includes('/login'), false, 'sitemap.xml must exclude /login');

    // Unauthenticated admin branding & full payment reset endpoints must reject access
    const adminBrandRes = await fetch(`${baseUrl}/api/admin/branding`);
    assert.ok(adminBrandRes.status === 401 || adminBrandRes.status === 503);

    const resetAllRes = await fetch(`${baseUrl}/api/admin/payments/reset-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.ok(resetAllRes.status === 401 || resetAllRes.status === 503);
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
