import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createApp } from '../server.js';
import {
  MATERIAL_REF_PREFIX,
  MaterialPaymentError,
  validateMaterialPriceNaira,
} from '../src/server/lib/materialPayments.js';
import { generatePaymentReference } from '../src/server/lib/paystack.js';

async function run() {
  console.log('[Material Payments Verification] 1. Checking migration 0016 and schema...');
  const migrationSql = await fs.readFile(
    path.resolve(process.cwd(), 'migrations/0016_study_material_pricing_and_purchases.sql'),
    'utf-8'
  );
  assert.ok(migrationSql.includes('ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2)'));
  assert.ok(migrationSql.includes('CREATE TABLE IF NOT EXISTS study_material_purchases'));
  assert.ok(
    migrationSql.includes('study_material_purchases_active_student_mat_idx')
  );

  console.log('[Material Payments Verification] 2. Testing price validation rules (0 or >= ₦100)...');
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

  console.log('[Material Payments Verification] 3. Testing payment reference generation...');
  const matRef = generatePaymentReference(MATERIAL_REF_PREFIX);
  const courseRef = generatePaymentReference();
  assert.ok(matRef.startsWith('ACD-MAT-'));
  assert.ok(courseRef.startsWith('ACD-') && !courseRef.startsWith('ACD-MAT-'));

  console.log('[Material Payments Verification] 4. Auditing backend enforcement and UI safety...');
  const materialsRoute = await fs.readFile(
    path.resolve(process.cwd(), 'src/server/routes/materials.ts'),
    'utf-8'
  );
  assert.ok(materialsRoute.includes('hasPurchasedMaterial'));
  assert.ok(materialsRoute.includes('MATERIAL_PAYMENT_REQUIRED'));
  assert.ok(materialsRoute.includes('courseSummaries'));

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

  const materialsView = await fs.readFile(
    path.resolve(process.cwd(), 'src/components/cbt/StudyMaterialsView.tsx'),
    'utf-8'
  );
  assert.ok(materialsView.includes('openedCourseKey'));
  assert.ok(materialsView.includes('Select a Course Category'));
  assert.equal(materialsView.includes('window.open'), false);
  assert.equal(materialsView.includes('window.alert'), false);
  assert.equal(materialsView.includes('localStorage'), false);

  console.log('[Material Payments Verification] 5. Checking live HTTP endpoint auth guards...');
  const app = await createApp({ skipVite: true });
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object');
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    for (const check of [
      { method: 'POST', url: `${baseUrl}/api/materials/11111111-1111-4111-8111-111111111111/pay` },
      { method: 'POST', url: `${baseUrl}/api/materials/verify-payment` },
      { method: 'POST', url: `${baseUrl}/api/materials/11111111-1111-4111-8111-111111111111/download` },
      { method: 'GET', url: `${baseUrl}/api/admin/materials` },
      { method: 'PATCH', url: `${baseUrl}/api/admin/materials/11111111-1111-4111-8111-111111111111` },
    ]) {
      const resp = await fetch(check.url, { method: check.method });
      assert.ok(resp.status === 401 || resp.status === 503);
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('[Material Payments Verification] PASSED.');
}

run().catch((err) => {
  console.error('[Material Payments Verification] FAILED:', err);
  process.exit(1);
});
