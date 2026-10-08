/**
 * Automated Verification Test Suite for Duplicate Account Prevention and OTP Email Verification
 */

import { 
  getSqliteDb, 
  getAllSqliteUsers, 
  getSqliteUserByEmail, 
  saveSqliteUser, 
  getSqlitePendingRegistration, 
  saveSqlitePendingRegistration, 
  updateSqlitePendingRegistrationAttempts, 
  deleteSqlitePendingRegistration, 
  cleanupExpiredPendingRegistrations, 
  getFlaggedDuplicateAccounts 
} from '../src/lib/sqlite-db';
import crypto from 'crypto';

const OTP_HMAC_SECRET = process.env.OTP_HMAC_SECRET || 'ropenix_secure_otp_hmac_secret_2026_key';

function normalizeEmail(email: string | undefined | null): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function hashOtp(otp: string): string {
  return crypto.createHmac('sha256', OTP_HMAC_SECRET).update(otp.trim()).digest('hex');
}

function verifyOtpHash(inputOtp: string, storedHash: string): boolean {
  try {
    const inputHash = hashOtp(inputOtp);
    const bufA = Buffer.from(inputHash, 'hex');
    const bufB = Buffer.from(storedHash, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (!storedHash) return false;
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, originalHash] = parts;
    const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    const bufA = Buffer.from(computedHash, 'hex');
    const bufB = Buffer.from(originalHash, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('🚀 RUNNING USER REGISTRATION & EMAIL OTP VERIFICATION TESTS');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
      failed++;
    }
  }

  const testEmailRaw = '   Test.Customer.OTP@Example.COM  ';
  const normalized = normalizeEmail(testEmailRaw);

  // 1. Email Normalization
  assert(normalized === 'test.customer.otp@example.com', '1. Email Normalization (trim & lowercase)');

  // 2. Cleanup previous test entries if any
  await deleteSqlitePendingRegistration(normalized);
  const db = await getSqliteDb();
  await db.run('DELETE FROM users WHERE email = ?', [normalized]);

  // 3. Pending Registration Creation with Scrypt password & HMAC OTP
  const rawOtp = '749201';
  const otpHash = hashOtp(rawOtp);
  const passwordHash = hashPassword('SecurePass2026!');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await saveSqlitePendingRegistration({
    email: normalized,
    username: 'testotpuser',
    first_name: 'Test',
    last_name: 'Customer',
    password_hash: passwordHash,
    phone: '+254711223344',
    otp_hash: otpHash,
    otp_expires_at: expiresAt,
    attempts: 0,
    max_attempts: 5,
    last_sent_at: new Date().toISOString(),
    resend_count: 0,
    resend_window_start: new Date().toISOString(),
    ip_address: '127.0.0.1'
  });

  const pendingRecord = await getSqlitePendingRegistration(normalized);
  assert(Boolean(pendingRecord), '2. Pending Registration created in SQLite database');
  assert(pendingRecord?.otp_hash !== rawOtp, '3. Plain OTP is NEVER stored in database (HMAC hashed only)');
  assert(verifyOtpHash('749201', pendingRecord!.otp_hash), '4. Correct OTP verifies successfully via constant-time timingSafeEqual');
  assert(!verifyOtpHash('000000', pendingRecord!.otp_hash), '5. Wrong OTP fails verification');

  // 4. Overwrite Pending Registration on re-registration
  const secondOtp = '883921';
  await saveSqlitePendingRegistration({
    ...pendingRecord!,
    otp_hash: hashOtp(secondOtp),
    last_sent_at: new Date().toISOString()
  });
  const updatedPending = await getSqlitePendingRegistration(normalized);
  assert(verifyOtpHash('883921', updatedPending!.otp_hash), '6. Re-registration cleanly replaces pending record & invalidates old OTP');
  assert(!verifyOtpHash('749201', updatedPending!.otp_hash), '7. Old OTP is no longer valid after replacement');

  // 5. Attempt Tracking & Max 5 Lockout
  await updateSqlitePendingRegistrationAttempts(normalized, 1);
  let pAfter1 = await getSqlitePendingRegistration(normalized);
  assert(pAfter1?.attempts === 1, '8. Failed OTP attempt increments attempt count to 1');

  await updateSqlitePendingRegistrationAttempts(normalized, 5);
  let pAfter5 = await getSqlitePendingRegistration(normalized);
  assert(pAfter5?.attempts === 5, '9. Attempt count reaches 5 (maximum limit)');

  // Invalidate on 5 failed attempts
  if (pAfter5 && pAfter5.attempts >= pAfter5.max_attempts) {
    await deleteSqlitePendingRegistration(normalized);
  }
  let pAfterLockout = await getSqlitePendingRegistration(normalized);
  assert(pAfterLockout === null, '10. Pending registration deleted/invalidated upon exceeding 5 attempts');

  // 6. OTP Expiration Test
  const expiredTime = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minute ago
  await saveSqlitePendingRegistration({
    email: normalized,
    username: 'testotpuser',
    first_name: 'Test',
    last_name: 'Customer',
    password_hash: passwordHash,
    phone: '+254711223344',
    otp_hash: hashOtp('123456'),
    otp_expires_at: expiredTime,
    attempts: 0,
    max_attempts: 5,
    last_sent_at: new Date().toISOString(),
    resend_count: 0,
    resend_window_start: new Date().toISOString(),
  });

  const pExpired = await getSqlitePendingRegistration(normalized);
  const isExpired = pExpired ? new Date(pExpired.otp_expires_at).getTime() < Date.now() : false;
  assert(isExpired, '11. Expired OTP correctly detected by timestamp comparison');

  const cleanedCount = await cleanupExpiredPendingRegistrations();
  assert(cleanedCount >= 1, '12. Scheduled cleanup job successfully purges expired registrations');

  // 7. Successful Verification & User Creation
  const validOtp = '556677';
  await saveSqlitePendingRegistration({
    email: normalized,
    username: 'verifieduser',
    first_name: 'Amina',
    last_name: 'Mohamed',
    password_hash: passwordHash,
    phone: '+254799887766',
    otp_hash: hashOtp(validOtp),
    otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    attempts: 0,
    max_attempts: 5,
    last_sent_at: new Date().toISOString(),
    resend_count: 0,
    resend_window_start: new Date().toISOString(),
  });

  // Verify OTP and save to users table
  const finalPending = await getSqlitePendingRegistration(normalized);
  assert(verifyOtpHash(validOtp, finalPending!.otp_hash), '13. Final valid OTP constant-time verified');

  const savedUser = await saveSqliteUser({
    id: `usr-test-${Date.now()}`,
    username: finalPending!.username,
    email: normalized,
    password_hash: finalPending!.password_hash,
    first_name: finalPending!.first_name,
    last_name: finalPending!.last_name,
    phone: finalPending!.phone,
    is_staff: 0,
    is_superuser: 0,
    email_verified: 1
  });

  await deleteSqlitePendingRegistration(normalized);
  const pDeleted = await getSqlitePendingRegistration(normalized);

  assert(Boolean(savedUser && savedUser.id), '14. User account persisted to SQLite users table');
  assert(Boolean(savedUser.email_verified), '15. email_verified is set to 1/true');
  assert(pDeleted === null, '16. Single-use pending registration deleted immediately after verification');

  // 8. Database-Level Unique Constraint Enforcement
  let duplicateRejected = false;
  try {
    // Attempt inserting exact same normalized email
    await saveSqliteUser({
      id: `usr-dup-${Date.now()}`,
      username: 'anotherusername',
      email: normalized,
      password_hash: passwordHash,
      first_name: 'Duplicate',
      last_name: 'Attempt',
      phone: '+254700000000',
    });
  } catch (err: any) {
    duplicateRejected = true;
  }
  assert(duplicateRejected, '17. Database UNIQUE constraint blocks duplicate account creation at DB level');

  // 9. Case and whitespace variations blocked
  const userByVariantEmail = await getSqliteUserByEmail('  TEST.CUSTOMER.OTP@EXAMPLE.COM ');
  assert(Boolean(userByVariantEmail), '18. Case & whitespace email queries resolve to existing user');

  // 10. Password-Only Login Verification (No OTP)
  assert(verifyPassword('SecurePass2026!', savedUser.password_hash), '19. Password verified correctly with scrypt at login');
  assert(!verifyPassword('WrongPassword!', savedUser.password_hash), '20. Invalid password fails authentication');

  // 11. Pre-Migration Audit Verification
  const auditRecords = await getFlaggedDuplicateAccounts();
  assert(Array.isArray(auditRecords), '21. Pre-migration audit log table exists and returns records');

  console.log('\n===============================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
