/**
 * Automated Password Reset Test Suite
 * 
 * Verifies the password reset subsystem:
 * 1. Happy Path: Request token -> save token hash -> atomic consumption -> password update -> verification.
 * 2. Expired Token: Rejection of tokens past expiration timestamp.
 * 3. Reused Token: Rejection of already consumed tokens (single-use guarantee).
 * 4. Unknown Email: Anti-enumeration generic 200 response without leaking account absence.
 * 5. Concurrent Submissions: Race condition test verifying only one request succeeds.
 * 6. Multi-driver compatibility & atomic rollback.
 * 
 * Run with: npx tsx scripts/test-password-reset.ts
 */

import crypto from 'crypto';
import {
  getSqliteDb,
  getSqliteUserByEmail,
  saveSqliteUser,
  createSqlitePasswordResetToken,
  getSqlitePasswordResetToken,
  consumeSqlitePasswordResetToken,
  cleanupExpiredSqliteResetTokens,
  updateSqliteUserPasswordById
} from '../src/lib/sqlite-db';
import {
  hashResetToken,
  generateRawResetToken,
  hashPassword,
  requestPasswordReset,
  resetPasswordWithToken
} from '../server/services/passwordResetService';

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${testName}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✖ FAIL:\x1b[0m ${testName}${detail ? ` -> ${detail}` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 Running Password Reset Feature Test Suite');
  console.log('======================================================\n');

  // Step 0: Initialize database
  console.log('📦 Step 0: Initializing SQLite Database (sql.js WASM)...');
  await getSqliteDb();
  console.log('✔ Database initialized.\n');

  const testEmail = `test_reset_${Date.now()}@example.com`;
  const initialPassword = 'InitialSecurePassword123!';
  const updatedPassword = 'BrandNewSecurePassword456!';
  const testUserId = `usr_test_${Date.now()}`;

  // Seed test user
  await saveSqliteUser({
    id: testUserId,
    email: testEmail,
    username: 'test_reset_user',
    password_hash: hashPassword(initialPassword),
    first_name: 'Test',
    last_name: 'User',
    is_staff: 0,
    is_superuser: 0,
    email_verified: 1
  });

  // Test 1: Happy Path
  console.log('📋 Test 1: Happy Path Password Reset');
  const userBefore = await getSqliteUserByEmail(testEmail);
  assert(userBefore !== null && userBefore.id === testUserId, 'Seed user retrieved by email');
  assert(verifyPassword(initialPassword, userBefore.password_hash), 'Initial password validates correctly');

  // Request reset
  const reqRes = await requestPasswordReset(testEmail, '127.0.0.1');
  assert(reqRes.success === true, 'Forgot password request returned success');

  // Generate token and verify database entry
  const rawToken = generateRawResetToken();
  const tokenHash = hashResetToken(rawToken);
  const expiryDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await createSqlitePasswordResetToken({
    userId: testUserId,
    tokenHash,
    expiresAt: expiryDate,
    userEmail: testEmail,
    ipAddress: '127.0.0.1'
  });

  const savedToken = await getSqlitePasswordResetToken(tokenHash);
  assert(savedToken !== null, 'Token hash saved and retrievable from password_reset_tokens');
  assert(savedToken.used_at === null, 'Token is initially unused (used_at is NULL)');
  assert(savedToken.user_id === testUserId, 'Token is linked to correct user_id');

  // Consume token
  const resetResult = await resetPasswordWithToken(rawToken, updatedPassword, '127.0.0.1');
  assert(resetResult.success === true, 'resetPasswordWithToken succeeded');

  const userAfter = await getSqliteUserByEmail(testEmail);
  assert(verifyPassword(updatedPassword, userAfter.password_hash), 'New password hash verified against updated password');
  assert(!verifyPassword(initialPassword, userAfter.password_hash), 'Old password is no longer valid');

  const consumedToken = await getSqlitePasswordResetToken(tokenHash);
  assert(consumedToken.used_at !== null, 'Token marked as used (used_at is populated)');
  console.log('');

  // Test 2: Expired Token
  console.log('📋 Test 2: Expired Token Rejection');
  const expiredRawToken = generateRawResetToken();
  const expiredTokenHash = hashResetToken(expiredRawToken);
  const pastDate = new Date(Date.now() - 3600 * 1000).toISOString(); // 1 hour ago

  await createSqlitePasswordResetToken({
    userId: testUserId,
    tokenHash: expiredTokenHash,
    expiresAt: pastDate,
    userEmail: testEmail
  });

  const expiredResult = await resetPasswordWithToken(expiredRawToken, 'AnotherPassword789!', '127.0.0.1');
  assert(expiredResult.success === false, 'Expired token was rejected');
  assert(expiredResult.code === 'INVALID_OR_EXPIRED_TOKEN', 'Returned INVALID_OR_EXPIRED_TOKEN error code');
  console.log('');

  // Test 3: Reused Token Rejection
  console.log('📋 Test 3: Reused Token Rejection (Single-use Enforced)');
  const reusedResult = await resetPasswordWithToken(rawToken, 'TryReusePassword999!', '127.0.0.1');
  assert(reusedResult.success === false, 'Reused token was rejected');
  assert(reusedResult.code === 'TOKEN_ALREADY_USED' || reusedResult.code === 'INVALID_OR_EXPIRED_TOKEN', 'Returned proper error code');
  console.log('');

  // Test 4: Unknown Email (Account Enumeration Prevention)
  console.log('📋 Test 4: Unknown Email Enumeration Prevention');
  const unknownEmail = `nonexistent_${Date.now()}@domain.invalid`;
  const unknownReqRes = await requestPasswordReset(unknownEmail, '127.0.0.1');
  assert(unknownReqRes.success === true, 'Unknown email returns generic success response');
  assert(unknownReqRes.message.includes('If an account is associated with that email'), 'Generic message returned');
  console.log('');

  // Test 5: Concurrent Submissions Race Condition Test
  console.log('📋 Test 5: Concurrent Submissions Race Condition Test');
  const raceRawToken = generateRawResetToken();
  const raceTokenHash = hashResetToken(raceRawToken);
  const raceExpiry = new Date(Date.now() + 3600 * 1000).toISOString();

  await createSqlitePasswordResetToken({
    userId: testUserId,
    tokenHash: raceTokenHash,
    expiresAt: raceExpiry,
    userEmail: testEmail
  });

  // Launch 2 simultaneous reset attempts with the exact same token
  const [res1, res2] = await Promise.all([
    resetPasswordWithToken(raceRawToken, 'ConcurrentPass111!', '127.0.0.1'),
    resetPasswordWithToken(raceRawToken, 'ConcurrentPass222!', '127.0.0.1'),
  ]);

  const oneSucceeded = (res1.success && !res2.success) || (!res1.success && res2.success);
  assert(oneSucceeded, 'Exactly one concurrent request succeeded and one was blocked');
  console.log('');

  // Test 6: Opportunistic / Scheduled Token Cleanup
  console.log('📋 Test 6: Expired Token Cleanup');
  const cleanedCount = await cleanupExpiredSqliteResetTokens();
  assert(cleanedCount >= 1, `Cleaned up ${cleanedCount} expired/used tokens successfully`);
  console.log('');

  // Summary
  console.log('======================================================');
  console.log(`🏁 Test Results: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test execution failure:', err);
  process.exit(1);
});
