import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { DEFAULT_USER_PREFERENCES } from '../src/db/schema.js';
import { sanitizeUser, signAuthToken, verifyAuthToken } from '../src/server/lib/jwt.js';

async function verifyPhase2() {
  console.log('[Phase 2 Verification] Testing password hashing & verification...');
  const hash = await bcrypt.hash('StrongPass123!', 10);
  assert.ok(hash.startsWith('$2'), 'Expected bcrypt hash');
  assert.equal(await bcrypt.compare('StrongPass123!', hash), true);
  assert.equal(await bcrypt.compare('WrongPass', hash), false);

  console.log('[Phase 2 Verification] Testing JWT signing & verification...');
  const token = signAuthToken({
    sub: '11111111-1111-4111-8111-111111111111',
    role: 'student',
    email: 'student@acadet.test',
  });
  const decoded = verifyAuthToken(token);
  assert.equal(decoded.sub, '11111111-1111-4111-8111-111111111111');
  assert.equal(decoded.role, 'student');
  assert.equal(decoded.email, 'student@acadet.test');

  console.log('[Phase 2 Verification] Testing user sanitization removes passwordHash...');
  const rawRow = {
    id: '11111111-1111-4111-8111-111111111111',
    fullName: 'Ada Lovelace',
    email: 'ada@acadet.test',
    username: 'adalovelace',
    passwordHash: hash,
    role: 'student',
    examTarget: 'JAMB UTME Practice Exam',
    isActive: true,
    preferences: DEFAULT_USER_PREFERENCES,
    createdAt: new Date(),
  };
  const safe = sanitizeUser(rawRow) as unknown as Record<string, unknown>;
  assert.equal(safe.passwordHash, undefined, 'passwordHash must never be exposed');
  assert.equal(safe.role, 'student');

  console.log('[Phase 2 Verification] PASSED.');
}

verifyPhase2().catch((err) => {
  console.error('[Phase 2 Verification] FAILED:', err);
  process.exit(1);
});
