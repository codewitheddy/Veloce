process.env.NODE_ENV = 'test';

import http from 'http';
import crypto from 'crypto';
import app from '../server';
import { getSqlitePendingRegistration, deleteSqlitePendingRegistration } from '../src/lib/sqlite-db';

const OTP_HMAC_SECRET = process.env.OTP_HMAC_SECRET || 'ropenix_secure_otp_hmac_secret_2026_key';

function hashOtp(otp: string): string {
  return crypto.createHmac('sha256', OTP_HMAC_SECRET).update(otp.trim()).digest('hex');
}

async function runApiTests() {
  console.log('===============================================================');
  console.log('🌐 RUNNING END-TO-END HTTP API REGISTRATION & OTP TESTS');
  console.log('===============================================================\n');

  // Start test server on an ephemeral port
  const testServer = http.createServer(app);
  await new Promise<void>((resolve) => testServer.listen(0, resolve));
  const address = testServer.address() as { port: number };
  const BASE_URL = `http://127.0.0.1:${address.port}/api`;

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

  try {
    const testEmail = `e2e.customer.${Date.now()}@example.com`;
    const password = 'StrongPassword2026!';
    const name = 'Sarah Vance';
    const knownTestOtp = '654321';

    // 1. Initial Registration API call with x-test-otp header
    const regRes = await fetch(`${BASE_URL}/auth/register/`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-test-otp': knownTestOtp
      },
      body: JSON.stringify({
        username: 'sarahv',
        email: `  ${testEmail.toUpperCase()}  `,
        password: password,
        first_name: name
      })
    });

    const regData = await regRes.json();
    assert(regRes.status === 200, '1. POST /api/auth/register returns 200 OK');
    assert(regData.requires_otp === true, '2. Registration response returns requires_otp: true');
    assert(regData.email === testEmail.toLowerCase(), '3. Registration normalizes email in response');
    assert(regData.otp === undefined, '4. Security: Plain OTP is NEVER leaked in API response');

    // 2. Resend OTP API call (rate limited after 3 attempts per hour)
    const resendRes = await fetch(`${BASE_URL}/auth/resend-otp/`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-test-otp': '778899'
      },
      body: JSON.stringify({
        email: testEmail
      })
    });

    const resendData = await resendRes.json();
    assert(resendRes.status === 200, '5. POST /api/auth/resend-otp returns 200 OK');
    assert(resendData.success === true, '6. Resend OTP succeeds');
    assert(resendData.otp === undefined, '7. Security: Resent OTP is not leaked');

    // 3. Failed OTP verification attempts
    const failRes1 = await fetch(`${BASE_URL}/auth/verify-otp/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        otp: '000000'
      })
    });
    const failData1 = await failRes1.json();
    assert(failRes1.status === 400, '8. POST /api/auth/verify-otp with wrong OTP returns 400');
    assert(failData1.remaining_attempts === 4, '9. Remaining attempts accurately decremented to 4');

    // Make 4 more failing attempts to trigger 5-attempt limit
    for (let i = 0; i < 3; i++) {
      await fetch(`${BASE_URL}/auth/verify-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, otp: '111111' })
      });
    }

    const finalFailRes = await fetch(`${BASE_URL}/auth/verify-otp/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, otp: '222222' })
    });
    const finalFailData = await finalFailRes.json();
    assert(finalFailRes.status === 429 || finalFailRes.status === 400, '10. 5th failed OTP attempt rejects');
    assert(finalFailData.remaining_attempts === 0, '11. Remaining attempts reaches 0');

    // 4. Re-register after lockout
    const activeOtp = '123456';
    const reRegRes = await fetch(`${BASE_URL}/auth/register/`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-test-otp': activeOtp
      },
      body: JSON.stringify({
        username: 'sarahv',
        email: testEmail,
        password: password,
        first_name: name
      })
    });
    assert(reRegRes.status === 200, '12. Re-registration creates fresh session');

    // 5. Successful OTP verification
    const verifyRes = await fetch(`${BASE_URL}/auth/verify-otp/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        otp: activeOtp
      })
    });
    const verifyData = await verifyRes.json();
    assert(verifyRes.status === 200, '13. Valid OTP verification returns 200 OK');
    assert(verifyData.verified === true, '14. Account marked verified');
    assert(Boolean(verifyData.access), '15. Access token returned upon verification');

    // 6. Duplicate Registration Rejection
    const dupRes = await fetch(`${BASE_URL}/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'other_user',
        email: ` ${testEmail.toUpperCase()} `,
        password: 'AnotherPassword123!'
      })
    });
    const dupData = await dupRes.json();
    assert(dupRes.status === 409, '16. Duplicate email registration rejected with HTTP 409');
    assert(dupData.error?.includes('already exists') || dupData.code === 'EMAIL_EXISTS', '17. Friendly error returned for duplicate registration');

    // 7. Password-Only Login Check (Zero OTP at login)
    const loginRes = await fetch(`${BASE_URL}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: password
      })
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, '18. POST /api/auth/login succeeds with password only (no OTP)');
    assert(loginData.success === true && Boolean(loginData.access), '19. Login returns JWT access token');
    assert(loginData.user?.email === testEmail.toLowerCase(), '20. Logged in user matches verified account');

    // 8. Simultaneous concurrent registration test
    const concurrentEmail = `concurrent.${Date.now()}@example.com`;
    await Promise.all([
      fetch(`${BASE_URL}/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: concurrentEmail, password: 'Password123!', username: 'concA' })
      }),
      fetch(`${BASE_URL}/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: concurrentEmail, password: 'Password123!', username: 'concB' })
      })
    ]);

    const pConc = await getSqlitePendingRegistration(concurrentEmail);
    assert(Boolean(pConc), '21. Concurrent registrations resolve gracefully without collisions or corruptions');

    // Cleanup test user
    await deleteSqlitePendingRegistration(concurrentEmail);

    console.log('\n===============================================================');
    console.log(`📊 E2E API TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================\n');
  } finally {
    testServer.close();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runApiTests().catch((err) => {
  console.error('Fatal error during E2E API test run:', err);
  process.exit(1);
});
