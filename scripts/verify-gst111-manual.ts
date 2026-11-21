import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { createApp } from '../server.js';
import {
  assertGst111OnlyTarget,
  Gst111RestrictionError,
  isGst111CourseCode,
  normalizeCourseCode,
} from '../src/server/lib/gst111.js';

async function run() {
  console.log('[GST111 Manual Activation Verification] 1. Testing course code restriction helpers...');
  assert.equal(normalizeCourseCode('GST 111'), 'GST111');
  assert.equal(normalizeCourseCode('  gst  111 '), 'GST111');
  assert.equal(normalizeCourseCode('BIO 101'), 'BIO101');

  assert.equal(isGst111CourseCode('GST 111'), true);
  assert.equal(isGst111CourseCode('gst111'), true);
  assert.equal(isGst111CourseCode('  Gst  111 '), true);
  assert.equal(isGst111CourseCode('BIO 101'), false);
  assert.equal(isGst111CourseCode('MTH 101'), false);
  assert.equal(isGst111CourseCode('GST 112'), false);
  assert.equal(isGst111CourseCode(''), false);
  assert.equal(isGst111CourseCode(null), false);

  const resolvedGst111Course = {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'GST 111',
    title: 'Communication in English',
    level: '100 Level',
    registrationFee: 2350,
    currency: 'NGN',
    publicationStatus: 'published',
    isActive: true,
  };

  // Should pass for GST 111
  assertGst111OnlyTarget({
    requestedCourseCode: 'GST 111',
    requestedCourseId: '11111111-1111-4111-8111-111111111111',
    resolvedGst111Course,
  });

  // Must reject non-GST 111 course codes with 403 GST111_ONLY_RESTRICTED
  for (const forbiddenCode of ['BIO 101', 'MTH 101', 'PHY 101', 'CHM 101', 'GST 112']) {
    assert.throws(
      () => assertGst111OnlyTarget({ requestedCourseCode: forbiddenCode }),
      (err: unknown) =>
        err instanceof Gst111RestrictionError &&
        err.statusCode === 403 &&
        err.code === 'GST111_ONLY_RESTRICTED'
    );
  }

  // Must reject mismatched courseId
  assert.throws(
    () =>
      assertGst111OnlyTarget({
        requestedCourseCode: 'GST 111',
        requestedCourseId: '22222222-2222-4222-8222-222222222222',
        resolvedGst111Course,
      }),
    (err: unknown) =>
      err instanceof Gst111RestrictionError &&
      err.statusCode === 403 &&
      err.code === 'GST111_ONLY_RESTRICTED'
  );

  console.log('[GST111 Manual Activation Verification] 2. Auditing SQL migration & server safety invariants...');
  const migrationSql = await fs.readFile(
    path.resolve(process.cwd(), 'migrations/0013_gst111_manual_subscription_activation.sql'),
    'utf-8'
  );
  assert.ok(migrationSql.includes('registration_code'));
  assert.ok(migrationSql.includes('activation_source'));
  assert.ok(migrationSql.includes('gst111_activation_history'));
  assert.equal(migrationSql.toUpperCase().includes('DROP TABLE'), false);

  const gst111ServiceSrc = await fs.readFile(
    path.resolve(process.cwd(), 'src/server/lib/gst111.ts'),
    'utf-8'
  );
  // Must NEVER create fake Paystack payments on manual activation
  assert.equal(/INSERT\s+INTO\s+payments/i.test(gst111ServiceSrc), false);
  assert.ok(gst111ServiceSrc.includes('admin_manual'));
  assert.ok(gst111ServiceSrc.includes('pg_advisory_xact_lock'));
  assert.ok(gst111ServiceSrc.includes('gst111_activation_history'));

  const catalogSrc = await fs.readFile(
    path.resolve(process.cwd(), 'src/server/routes/catalog.ts'),
    'utf-8'
  );
  assert.ok(catalogSrc.includes("eq(courseRegistrations.activationSource, 'admin_manual')"));
  assert.ok(catalogSrc.includes("= 'GST111'"));

  const examsSrc = await fs.readFile(
    path.resolve(process.cwd(), 'src/server/routes/exams.ts'),
    'utf-8'
  );
  assert.ok(examsSrc.includes("eq(courseRegistrations.activationSource, 'admin_manual')"));
  assert.ok(examsSrc.includes("= 'GST111'"));

  console.log('[GST111 Manual Activation Verification] 3. Auditing UI status labels & zero client-storage authorization...');
  const panelSrc = await fs.readFile(
    path.resolve(process.cwd(), 'src/components/cbt/Gst111ManualActivationPanel.tsx'),
    'utf-8'
  );
  assert.ok(panelSrc.includes('Manual Subscription Activation'));
  assert.ok(panelSrc.includes('Activate Subscription'));
  assert.ok(panelSrc.includes('Deactivate Subscription'));
  assert.ok(panelSrc.includes('Confirm Deactivation'));

  const homeSrc = await fs.readFile(
    path.resolve(process.cwd(), 'src/components/cbt/HomeDashboard.tsx'),
    'utf-8'
  );
  assert.ok(homeSrc.includes('RewardChallengeDashboardCard'));
  assert.equal(homeSrc.includes('GST 111 – Subscription Active'), false);

  const regViewSrc = await fs.readFile(
    path.resolve(process.cwd(), 'src/components/cbt/CourseRegistrationView.tsx'),
    'utf-8'
  );
  assert.ok(regViewSrc.includes('GST 111 – Subscription Active'));
  assert.ok(regViewSrc.includes('Payment Status: Successful'));
  assert.ok(regViewSrc.includes('Admin Activated'));

  const myCoursesSrc = await fs.readFile(
    path.resolve(process.cwd(), 'src/components/cbt/MyRegisteredCoursesView.tsx'),
    'utf-8'
  );
  assert.ok(myCoursesSrc.includes('GST 111 – Subscription Active'));
  assert.ok(myCoursesSrc.includes('Admin Activated'));

  for (const uiFile of [panelSrc, homeSrc, regViewSrc, myCoursesSrc]) {
    assert.equal(uiFile.includes('localStorage'), false);
    assert.equal(uiFile.includes('sessionStorage'), false);
  }

  console.log('[GST111 Manual Activation Verification] 4. Verifying HTTP admin endpoints enforce auth & role guards...');
  const app = await createApp({ skipVite: true });
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object');
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const listRes = await fetch(`${baseUrl}/api/admin/gst111/students`);
    assert.ok(listRes.status === 401 || listRes.status === 503);

    const activateRes = await fetch(`${baseUrl}/api/admin/gst111/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: '11111111-1111-4111-8111-111111111111' }),
    });
    assert.ok(activateRes.status === 401 || activateRes.status === 503);

    const deactivateRes = await fetch(`${baseUrl}/api/admin/gst111/deactivate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: '11111111-1111-4111-8111-111111111111' }),
    });
    assert.ok(deactivateRes.status === 401 || deactivateRes.status === 503);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('[GST111 Manual Activation Verification] PASSED.');
}

run().catch((err) => {
  console.error('[GST111 Manual Activation Verification] FAILED:', err);
  process.exit(1);
});
