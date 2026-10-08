/**
 * Phase 1 Security Verification Test Suite
 * Tests all requirements specified in Phase 1 of the refactoring plan.
 */

import http from 'http';
import app from '../server';
import { 
  getSqliteDb, 
  saveSqliteUser, 
  getSqliteUserByEmail, 
  getSqliteActivePasswordReset,
  saveSqliteSiteSettings 
} from '../src/lib/sqlite-db';
import { createAccessToken } from '../server/middleware/auth';
import { DEFAULT_SITE_SETTINGS } from '../server/routes/settings';

const TEST_PORT = 3198;

function makeRequest(
  method: string, 
  path: string, 
  body?: any, 
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const reqHeaders: Record<string, string> = {
      ...headers,
    };
    if (body) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = data;
          try {
            parsed = JSON.parse(data);
          } catch (_) {}
          resolve({ status: res.statusCode || 0, body: parsed, headers: res.headers });
        });
      }
    );

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING PHASE 1 SECURITY TEST SUITE ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  const server = app.listen(TEST_PORT);
  await new Promise((r) => setTimeout(r, 600));

  try {
    // 1. Check DEFAULT_SITE_SETTINGS has zero secrets
    console.log('\n[1. Testing Secrets in DEFAULT_SITE_SETTINGS]');
    assert(
      !DEFAULT_SITE_SETTINGS.payments?.mpesa_consumer_key &&
      !DEFAULT_SITE_SETTINGS.payments?.mpesa_consumer_secret &&
      !DEFAULT_SITE_SETTINGS.payments?.mpesa_passkey &&
      !DEFAULT_SITE_SETTINGS.receipts?.etims_client_secret,
      'DEFAULT_SITE_SETTINGS has all secrets removed'
    );

    // 2. Test GET /api/settings redaction
    console.log('\n[2. Testing GET /api/settings Redaction]');
    await saveSqliteSiteSettings({
      ...DEFAULT_SITE_SETTINGS,
      payments: {
        ...DEFAULT_SITE_SETTINGS.payments,
        mpesa_consumer_key: 'live_test_secret_key',
        mpesa_consumer_secret: 'live_test_secret_val',
        mpesa_passkey: 'live_test_passkey',
      },
      receipts: {
        ...DEFAULT_SITE_SETTINGS.receipts,
        etims_client_secret: 'live_etims_secret',
      }
    });

    const publicSettingsRes = await makeRequest('GET', '/api/settings');
    assert(publicSettingsRes.status === 200, 'Public GET /api/settings returns 200');
    assert(
      !publicSettingsRes.body.payments?.mpesa_consumer_key &&
      !publicSettingsRes.body.payments?.mpesa_consumer_secret &&
      !publicSettingsRes.body.receipts?.etims_client_secret,
      'Public GET /api/settings redacts M-PESA and eTIMS secrets'
    );

    // 3. Test Admin bypass vs Substring token attack
    console.log('\n[3. Testing Substring Fake Token Rejection]');
    const fakeTokenRes = await makeRequest('GET', '/api/admin/email/stats', undefined, {
      Authorization: 'Bearer admin-token-fake-12345',
    });
    assert(fakeTokenRes.status === 401 || fakeTokenRes.status === 403, 'Substring "admin" token is strictly rejected (401/403)');

    const fakeSuperuserRes = await makeRequest('GET', '/api/admin/email/stats', undefined, {
      Authorization: 'Bearer superuser_fake_session',
    });
    assert(fakeSuperuserRes.status === 401 || fakeSuperuserRes.status === 403, 'Substring "superuser" token is strictly rejected (401/403)');

    // 4. Test User Login with empty / invalid password_hash
    console.log('\n[4. Testing Login Password Hash Validation]');
    // Create an account with empty password_hash
    await saveSqliteUser({
      id: 'usr-empty-hash-test',
      username: 'empty_hash_user',
      email: 'emptyhash@test.ropenix.co.ke',
      password_hash: '',
      is_staff: 0,
      is_superuser: 0,
      email_verified: 1,
    });

    const emptyHashLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'emptyhash@test.ropenix.co.ke',
      password: 'AnyPassword123!',
    });
    assert(emptyHashLoginRes.status === 401, 'Account with empty password_hash is rejected on login');

    // 5. Test Superuser Login with fake substring
    console.log('\n[5. Testing Superuser Login Hardening]');
    const superuserBypassRes = await makeRequest('POST', '/api/auth/superuser-login', {
      email: 'admin',
      password: 'WrongPassword!',
    });
    assert(superuserBypassRes.status === 401, 'Superuser login with wrong password rejected');

    // 6. Test Valid Login and Signed JWT Issuance
    console.log('\n[6. Testing Valid Authentication & Signed JWT Issuance]');
    // Seed real admin user
    const crypto = await import('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const validHash = `${salt}:${crypto.scryptSync('SecureAdminPass123!', salt, 64).toString('hex')}`;
    await saveSqliteUser({
      id: 'usr-admin-test-real',
      username: 'admin_test',
      email: 'admin_security_test@ropenix.co.ke',
      password_hash: validHash,
      is_staff: 1,
      is_superuser: 1,
      email_verified: 1,
    });

    const validLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'admin_security_test@ropenix.co.ke',
      password: 'SecureAdminPass123!',
    });
    assert(validLoginRes.status === 200, 'Valid credentials authenticate successfully (200)');
    assert(typeof validLoginRes.body.access === 'string' && validLoginRes.body.access.split('.').length === 3, 'Issues valid HMAC-SHA256 signed JWT (3 segments)');

    const adminJwt = validLoginRes.body.access;

    // 7. Test requireAdmin protection on Admin routes using verified JWT
    console.log('\n[7. Testing requireAdmin Protection Across Endpoints]');
    const adminEmailStatsRes = await makeRequest('GET', '/api/admin/email/stats', undefined, {
      Authorization: `Bearer ${adminJwt}`,
    });
    assert(adminEmailStatsRes.status === 200, 'Admin can access /api/admin/email/stats with signed JWT');

    const adminPurgeRes = await makeRequest('POST', '/api/sqlite/purge-all', undefined, {
      Authorization: `Bearer ${adminJwt}`,
    });
    assert(adminPurgeRes.status === 200, 'Admin can access /api/sqlite/purge-all with signed JWT');

    const unauthPurgeRes = await makeRequest('POST', '/api/sqlite/purge-all');
    assert(unauthPurgeRes.status === 401, 'Unauthenticated /api/sqlite/purge-all is rejected with 401');

    const unauthCustomersRes = await makeRequest('GET', '/api/customers');
    assert(unauthCustomersRes.status === 401, 'Unauthenticated /api/customers is rejected with 401');

    const unauthSuppliersRes = await makeRequest('GET', '/api/suppliers');
    assert(unauthSuppliersRes.status === 401, 'Unauthenticated /api/suppliers is rejected with 401');

    // 8. Test Password Reset Flow Security
    console.log('\n[8. Testing Secure Password Reset Flow]');
    const resetSalt = crypto.randomBytes(16).toString('hex');
    const resetUserHash = `${resetSalt}:${crypto.scryptSync('SecureAdminPass123!', resetSalt, 64).toString('hex')}`;
    await saveSqliteUser({
      id: 'usr-admin-test-real',
      username: 'admin_security_test',
      email: 'admin_security_test@ropenix.co.ke',
      password_hash: resetUserHash,
      is_staff: 1,
      is_superuser: 1,
      email_verified: 1,
    });

    const forgotRes = await makeRequest('POST', '/api/auth/forgot-password', {
      email: 'admin_security_test@ropenix.co.ke',
    });
    assert(forgotRes.status === 200, 'POST /api/auth/forgot-password returns 200');
    assert(!forgotRes.body.otp && !forgotRes.body.code && !forgotRes.body.token && !forgotRes.body.otpCode, 'Zero OTP or reset token leaked in API response');

    const activeReset = await getSqliteActivePasswordReset('admin_security_test@ropenix.co.ke');
    assert(Boolean(activeReset && activeReset.token_hash), 'Reset token hash successfully stored in SQLite');

    // Test invalid code
    const invalidResetRes = await makeRequest('POST', '/api/auth/reset-password', {
      email: 'admin_security_test@ropenix.co.ke',
      otp: '000000',
      new_password: 'BrandNewPassword123!',
    });
    assert(invalidResetRes.status === 400, 'Invalid reset code rejected with 400');

    // Test successful reset by saving a known raw token and sha256 hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const { createSqlitePasswordResetToken } = await import('../src/lib/sqlite-db');
    const expiresAt = new Date(Date.now() + 600000).toISOString();
    await createSqlitePasswordResetToken({
      userId: 'usr-admin-test-real',
      tokenHash,
      expiresAt,
      ipAddress: '127.0.0.1',
      userEmail: 'admin_security_test@ropenix.co.ke',
    });

    const validResetRes = await makeRequest('POST', '/api/auth/reset-password', {
      token: rawToken,
      new_password: 'BrandNewPassword123!',
    });
    assert(validResetRes.status === 200, 'Valid reset code updates password successfully');

    // Verify old password no longer works
    const oldPassLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'admin_security_test@ropenix.co.ke',
      password: 'SecureAdminPass123!',
    });
    assert(oldPassLoginRes.status === 401, 'Old password no longer valid after reset');

    // Verify new password works
    const newPassLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'admin_security_test@ropenix.co.ke',
      password: 'BrandNewPassword123!',
    });
    assert(newPassLoginRes.status === 200, 'New password successfully authenticates');

  } catch (err) {
    console.error('Test Execution Exception:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log(`\n--- TEST SUMMARY: ${passed} Passed, ${failed} Failed ---`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
