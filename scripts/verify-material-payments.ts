import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createApp } from '../server.js';
import {
  signMaterialDownloadToken,
  verifyMaterialDownloadToken,
} from '../src/server/lib/jwt.js';
import {
  MATERIAL_REF_PREFIX,
  MaterialPaymentError,
  validateMaterialPriceNaira,
} from '../src/server/lib/materialPayments.js';
import { generatePaymentReference } from '../src/server/lib/paystack.js';

async function run() {
  console.log('[Material Access & Payments Verification] 1. Checking migrations 0016 and 0017...');
  const migration16Sql = await fs.readFile(
    path.resolve(process.cwd(), 'migrations/0016_study_material_pricing_and_purchases.sql'),
    'utf-8'
  );
  assert.ok(migration16Sql.includes('ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2)'));
  assert.ok(migration16Sql.includes('CREATE TABLE IF NOT EXISTS study_material_purchases'));
  assert.ok(migration16Sql.includes('study_material_purchases_active_student_mat_idx'));

  const migration17Sql = await fs.readFile(
    path.resolve(process.cwd(), 'migrations/0017_study_material_access_control_and_analytics.sql'),
    'utf-8'
  );
  assert.ok(migration17Sql.includes('ADD COLUMN IF NOT EXISTS faculty'));
  assert.ok(migration17Sql.includes('ADD COLUMN IF NOT EXISTS department'));
  assert.ok(migration17Sql.includes('ADD COLUMN IF NOT EXISTS semester'));
  assert.ok(migration17Sql.includes('ADD COLUMN IF NOT EXISTS publication_status'));
  assert.ok(migration17Sql.includes('Lecture Notes'));
  assert.ok(migration17Sql.includes('Handouts'));
  assert.ok(migration17Sql.includes('Practical Guides'));
  assert.ok(migration17Sql.includes('CREATE TABLE IF NOT EXISTS study_material_download_logs'));

  console.log('[Material Access & Payments Verification] 2. Testing price validation rules (0 or >= ₦100)...');
  assert.equal(validateMaterialPriceNaira(undefined), 0);
  assert.equal(validateMaterialPriceNaira(''), 0);
  assert.equal(validateMaterialPriceNaira(0), 0);
  assert.equal(validateMaterialPriceNaira('0'), 0);
  assert.equal(validateMaterialPriceNaira(100), 100);
  assert.equal(validateMaterialPriceNaira('1500.5'), 1500.5);

  for (const invalidPrice of [-1, -100, 1, 50, 99.99, 500001, 'abc']) {
    assert.throws(
      () => validateMaterialPriceNaira(invalidPrice),
      (err: unknown) => err instanceof MaterialPaymentError
    );
  }

  console.log('[Material Access & Payments Verification] 3. Testing payment reference & signed download JWTs...');
  const matRef = generatePaymentReference(MATERIAL_REF_PREFIX);
  const courseRef = generatePaymentReference();
  assert.ok(matRef.startsWith('ACD-MAT-'));
  assert.ok(courseRef.startsWith('ACD-') && !courseRef.startsWith('ACD-MAT-'));

  const studentToken = signMaterialDownloadToken('mat-123', 'bio101.pdf', {
    isAdmin: false,
    userId: 'student-1',
  });
  const verifiedStudent = verifyMaterialDownloadToken(studentToken, 'mat-123');
  assert.ok(verifiedStudent);
  assert.equal(verifiedStudent.materialId, 'mat-123');
  assert.equal(verifiedStudent.filename, 'bio101.pdf');
  assert.equal(verifiedStudent.isAdmin, false);
  assert.equal(verifiedStudent.userId, 'student-1');
  assert.equal(verifyMaterialDownloadToken(studentToken, 'mat-999'), null);

  const adminToken = signMaterialDownloadToken('mat-123', 'bio101.pdf', {
    isAdmin: true,
    userId: 'admin-1',
  });
  const verifiedAdmin = verifyMaterialDownloadToken(adminToken, 'mat-123');
  assert.ok(verifiedAdmin);
  assert.equal(verifiedAdmin.isAdmin, true);

  console.log('[Material Access & Payments Verification] 4. Auditing dual-gate backend enforcement & UI safety...');
  const materialPaymentsLib = await fs.readFile(
    path.resolve(process.cwd(), 'src/server/lib/materialPayments.ts'),
    'utf-8'
  );
  assert.ok(materialPaymentsLib.includes('isStudentRegisteredForCourse'));
  assert.ok(materialPaymentsLib.includes('getStudentRegisteredCourseIds'));
  assert.ok(materialPaymentsLib.includes('COURSE_REGISTRATION_REQUIRED'));
  assert.ok(materialPaymentsLib.includes("mat.publication_status !== 'published'"));
  assert.ok(materialPaymentsLib.includes('recordMaterialDownloadAuthorization'));

  const materialsRoute = await fs.readFile(
    path.resolve(process.cwd(), 'src/server/routes/materials.ts'),
    'utf-8'
  );
  assert.ok(materialsRoute.includes('courseRegistrationRequired'));
  assert.ok(materialsRoute.includes('isStudentRegisteredForCourse'));
  assert.ok(materialsRoute.includes('MATERIAL_PAYMENT_REQUIRED'));
  assert.ok(materialsRoute.includes('MATERIAL_UNPUBLISHED'));
  assert.ok(materialsRoute.includes('/my-purchases'));
  assert.ok(materialsRoute.includes('recordMaterialDownloadAuthorization'));

  const adminRoute = await fs.readFile(
    path.resolve(process.cwd(), 'src/server/routes/admin.ts'),
    'utf-8'
  );
  assert.ok(adminRoute.includes('/materials/:id/replace-file'));
  assert.ok(adminRoute.includes('/materials/sales'));
  assert.ok(adminRoute.includes('/materials/sales/export'));
  assert.ok(adminRoute.includes('publicationStatus'));

  const webhooksRoute = await fs.readFile(
    path.resolve(process.cwd(), 'src/server/routes/webhooks.ts'),
    'utf-8'
  );
  assert.ok(webhooksRoute.includes('settleStudyMaterialPaystackTransaction'));
  assert.ok(webhooksRoute.includes('study_material_purchases'));

  const paymentsRoute = await fs.readFile(
    path.resolve(process.cwd(), 'src/server/routes/payments.ts'),
    'utf-8'
  );
  assert.ok(paymentsRoute.includes('verifyAndSettleMaterialReference'));

  for (const uiFile of [
    'src/components/cbt/StudyMaterialsView.tsx',
    'src/components/cbt/StudentMaterialPurchasesView.tsx',
    'src/components/cbt/AdminConsole.tsx',
  ]) {
    const src = await fs.readFile(path.resolve(process.cwd(), uiFile), 'utf-8');
    assert.equal(src.includes('window.open'), false, `${uiFile} must not use window.open`);
    assert.equal(src.includes('window.alert'), false, `${uiFile} must not use window.alert`);
    assert.equal(src.includes('localStorage'), false, `${uiFile} must not use localStorage`);
  }

  const materialsView = await fs.readFile(
    path.resolve(process.cwd(), 'src/components/cbt/StudyMaterialsView.tsx'),
    'utf-8'
  );
  assert.ok(materialsView.includes('Registration Required'));
  assert.ok(materialsView.includes('Register Now'));
  assert.ok(materialsView.includes('Buy Now'));

  console.log('[Material Access & Payments Verification] 5. Checking live HTTP endpoint auth guards...');
  const app = await createApp({ skipVite: true });
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object');
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    for (const check of [
      { method: 'GET', url: `${baseUrl}/api/materials/my-purchases` },
      { method: 'POST', url: `${baseUrl}/api/materials/11111111-1111-4111-8111-111111111111/pay` },
      { method: 'POST', url: `${baseUrl}/api/materials/verify-payment` },
      { method: 'POST', url: `${baseUrl}/api/materials/11111111-1111-4111-8111-111111111111/download` },
      { method: 'GET', url: `${baseUrl}/api/admin/materials` },
      { method: 'GET', url: `${baseUrl}/api/admin/materials/sales` },
      { method: 'GET', url: `${baseUrl}/api/admin/materials/sales/export` },
      { method: 'PATCH', url: `${baseUrl}/api/admin/materials/11111111-1111-4111-8111-111111111111` },
      { method: 'POST', url: `${baseUrl}/api/admin/materials/11111111-1111-4111-8111-111111111111/replace-file` },
    ]) {
      const resp = await fetch(check.url, { method: check.method });
      assert.ok(
        resp.status === 401 || resp.status === 503,
        `${check.method} ${check.url} returned ${resp.status}, expected 401 or 503`
      );
    }

    // Tampered/missing signed download token should be rejected (401/403/503)
    const fileResp = await fetch(
      `${baseUrl}/api/materials/11111111-1111-4111-8111-111111111111/file?token=invalid.jwt.token`
    );
    assert.ok(fileResp.status === 401 || fileResp.status === 403 || fileResp.status === 503);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('[Material Access & Payments Verification] PASSED.');
}

run().catch((err) => {
  console.error('[Material Access & Payments Verification] FAILED:', err);
  process.exit(1);
});
