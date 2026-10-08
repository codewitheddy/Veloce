/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Phase 4 Automated Verification Suite: Payment Callbacks & Verification Security
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import paymentsRouter from '../server/routes/payments';
import ordersRouter from '../server/routes/orders';
import { createSignedToken } from '../server/middleware/auth';
import { getSqliteDb, saveSqliteOrder, getSqliteOrderById, getSqliteCart } from '../src/lib/sqlite-db';
import { getPaymentSubmissionByCode } from '../server/email/db';

async function runPhase4Tests() {
  console.log('================================================================');
  console.log('   ROPENIX BACKEND PHASE 4 PAYMENT SECURITY & CALLBACKS TEST    ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
    }
  }

  // Setup ephemeral Express app for testing payments routes
  const app = express();
  app.use(express.json());
  app.use('/api/payments', paymentsRouter);
  app.use('/api/orders', ordersRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  const db = await getSqliteDb();
  db.run(`
    INSERT OR REPLACE INTO users (
      id, username, email, password_hash, is_staff, is_superuser, email_verified, created_at, updated_at
    ) VALUES (
      'usr-admin-p4', 'admin', 'admin@ropenix.co.ke', 'dummy_hash', 1, 1, 1, '${new Date().toISOString()}', '${new Date().toISOString()}'
    );
  `);

  const adminToken = createSignedToken({
    sub: 'usr-admin-p4',
    email: 'admin@ropenix.co.ke',
    username: 'admin',
    role: 'admin',
    is_staff: true,
    is_superuser: true,
    type: 'access',
  });

  try {
    // -------------------------------------------------------------
    // 1. Admin Endpoint Authentication Guards
    // -------------------------------------------------------------
    console.log('\n[1. Testing Admin Endpoint Authentication Guards]');
    const unauthPending = await fetch(`${baseUrl}/api/payments/admin/pending`);
    assert(unauthPending.status === 401, '1.1 Unauthenticated GET /api/payments/admin/pending rejected with 401');

    const unauthVerify = await fetch(`${baseUrl}/api/payments/admin/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: 'test', orderId: 'test', action: 'approve' }),
    });
    assert(unauthVerify.status === 401, '1.2 Unauthenticated POST /api/payments/admin/verify rejected with 401');

    const authPending = await fetch(`${baseUrl}/api/payments/admin/pending`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    assert(authPending.status === 200, '1.3 Authenticated Admin GET /api/payments/admin/pending returns 200');

    // -------------------------------------------------------------
    // 2. Customer Payment Claim Submission
    // -------------------------------------------------------------
    console.log('\n[2. Testing Customer Payment Claim & Order Verification Flow]');
    const testOrderId = `ord-p4-${Date.now()}`;
    await saveSqliteOrder({
      id: testOrderId,
      customerName: 'Kiprono Cheruiyot',
      customerEmail: 'kiprono@example.com',
      phone: '+254711223344',
      total: 7500,
      status: 'pending',
      paymentStatus: 'pending',
      items: [{ name: 'Cashmere Trench', price: 7500, quantity: 1 }],
    });

    const mpesaReceiptCode = `QA${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    // Submit claim
    const claimRes = await fetch(`${baseUrl}/api/payments/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: testOrderId,
        mpesaCode: mpesaReceiptCode,
        phoneNumber: '+254711223344',
        amount: 7500,
      }),
    });
    const claimData = await claimRes.json();
    assert(claimRes.status === 201 && claimData.success === true, '2.1 Customer submits valid M-PESA claim');

    // Verify order was marked pending_verification (NEVER immediately paid)
    const orderAfterClaim = await getSqliteOrderById(testOrderId);
    assert(orderAfterClaim?.paymentStatus === 'pending_verification', '2.2 Order payment status is pending_verification');

    // Duplicate code submission is blocked
    const dupClaimRes = await fetch(`${baseUrl}/api/payments/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: testOrderId,
        mpesaCode: mpesaReceiptCode,
        phoneNumber: '+254711223344',
      }),
    });
    assert(dupClaimRes.status === 409, '2.3 Duplicate M-PESA transaction code rejected with 409 Conflict');

    // -------------------------------------------------------------
    // 3. Admin Verification Approval
    // -------------------------------------------------------------
    console.log('\n[3. Testing Admin Verification Action]');
    const verifyRes = await fetch(`${baseUrl}/api/payments/admin/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        submissionId: claimData.submissionId,
        orderId: testOrderId,
        action: 'approve',
        verifiedAmount: 7500,
        adminNotes: 'Verified via M-PESA Portal Statement',
        verifiedBy: 'Chief Accountant',
        mpesaCode: mpesaReceiptCode,
      }),
    });
    const verifyData = await verifyRes.json();
    assert(verifyRes.status === 200 && verifyData.success === true, '3.1 Admin approves payment claim');

    const orderAfterApproval = await getSqliteOrderById(testOrderId);
    assert(
      orderAfterApproval?.paymentStatus === 'paid' &&
      orderAfterApproval?.paymentConfirmedBy === 'Chief Accountant',
      '3.2 Order paymentStatus updated to paid with authoritative confirmedBy'
    );

    // -------------------------------------------------------------
    // 4. Safaricom Daraja C2B Webhook Callback Automation
    // -------------------------------------------------------------
    console.log('\n[4. Testing Safaricom Daraja C2B Webhooks]');
    const c2bOrderId = `ord-c2b-${Date.now()}`;
    await saveSqliteOrder({
      id: c2bOrderId,
      customerName: 'Faith Waweru',
      customerEmail: 'faith.w@example.com',
      phone: '+254722334455',
      total: 9200,
      status: 'pending',
      paymentStatus: 'pending',
      items: [{ name: 'Merino Wool Jumper', price: 9200, quantity: 1 }],
    });

    // 4.1 C2B Validation Webhook
    const valRes = await fetch(`${baseUrl}/api/payments/mpesa/c2b-validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BillRefNumber: c2bOrderId,
        TransAmount: '9200',
        MSISDN: '254722334455',
      }),
    });
    const valData = await valRes.json();
    assert(valData.ResultCode === 0 && valData.ResultDesc === 'Accepted', '4.1 Daraja C2B Validation accepts existing order');

    // 4.2 C2B Confirmation Webhook
    const c2bTransId = `C2B${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const confRes = await fetch(`${baseUrl}/api/payments/mpesa/c2b-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        TransID: c2bTransId,
        TransAmount: '9200',
        BillRefNumber: c2bOrderId,
        MSISDN: '254722334455',
        FirstName: 'Faith',
        LastName: 'Waweru',
        TransTime: '20261003120000',
      }),
    });
    const confData = await confRes.json();
    assert(confData.ResultCode === 0, '4.2 Daraja C2B Confirmation responds with ResultCode 0');

    const c2bOrderUpdated = await getSqliteOrderById(c2bOrderId);
    assert(
      c2bOrderUpdated?.paymentStatus === 'paid' &&
      c2bOrderUpdated?.paymentConfirmedBy === 'Safaricom Daraja C2B' &&
      c2bOrderUpdated?.paymentReference === c2bTransId,
      '4.3 Daraja C2B automatically marks order PAID with transaction reference'
    );

    // -------------------------------------------------------------
    // 5. Safaricom Daraja STK Push Callback Automation
    // -------------------------------------------------------------
    console.log('\n[5. Testing Safaricom Daraja STK Push Callback]');
    const stkOrderId = `ord-stk-${Date.now()}`;
    await saveSqliteOrder({
      id: stkOrderId,
      customerName: 'Dennis Mutua',
      customerEmail: 'dennis.m@example.com',
      phone: '+254733445566',
      total: 5400,
      status: 'pending',
      paymentStatus: 'pending',
      items: [{ name: 'Bespoke Chinos', price: 5400, quantity: 1 }],
    });

    const stkReceiptNo = `STK${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const stkRes = await fetch(`${baseUrl}/api/payments/mpesa/stk-callback?orderId=${stkOrderId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Body: {
          stkCallback: {
            MerchantRequestID: '29115-34620561-1',
            CheckoutRequestID: `ws_CO_${Date.now()}`,
            ResultCode: 0,
            ResultDesc: 'The service request is processed successfully.',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 5400 },
                { Name: 'MpesaReceiptNumber', Value: stkReceiptNo },
                { Name: 'Balance' },
                { Name: 'TransactionDate', Value: 20261003123000 },
                { Name: 'PhoneNumber', Value: 254733445566 },
              ]
            }
          }
        }
      }),
    });
    const stkData = await stkRes.json();
    assert(stkData.ResultCode === 0, '5.1 STK Push Callback parsed successfully');

    const stkOrderUpdated = await getSqliteOrderById(stkOrderId);
    assert(
      stkOrderUpdated?.paymentStatus === 'paid' &&
      stkOrderUpdated?.paymentConfirmedBy === 'Safaricom Daraja STK' &&
      stkOrderUpdated?.paymentReference === stkReceiptNo,
      '5.2 STK Push Callback marks order as PAID and stores receipt number'
    );

    console.log(`\n--- TEST SUMMARY: ${passed} Passed, ${total - passed} Failed ---\n`);
    if (total - passed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runPhase4Tests().catch((err) => {
  console.error('Fatal Test Failure:', err);
  process.exit(1);
});
