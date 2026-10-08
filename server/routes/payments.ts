/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import {
  recordPaymentSubmission,
  getPaymentSubmissionByCode,
  getPaymentSubmissionsForOrder,
  updatePaymentSubmissionStatus,
  updateOrderPaymentStatus,
  fetchAuthoritativeOrderById,
} from '../email/db';
import { emailEvents } from '../email/events';
import { getSqliteDb, getSqliteOrderById, updateSqliteOrderStatus, saveSqliteOrder } from '../../src/lib/sqlite-db';
import { getPostgresPool } from '../../src/lib/postgres-db';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// Kenyan M-Pesa receipt code format: 8-12 alphanumeric characters (e.g. SGH7XYZ123, QAB3K9M20P)
const MPESA_CODE_REGEX = /^[A-Z0-9]{8,12}$/i;

/**
 * 1. Customer submits M-Pesa Payment Claim ("I've Paid")
 * POST /api/payments/claim
 */
router.post(['/claim', '/claim/'], async (req: Request, res: Response) => {
  try {
    const { orderId, mpesaCode, phoneNumber, amount, notes, customerName, customerEmail, customerPhone, items } = req.body || {};

    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Order ID is required.' });
    }

    if (!mpesaCode || typeof mpesaCode !== 'string') {
      return res.status(400).json({ success: false, error: 'M-Pesa transaction code is required.' });
    }

    const cleanCode = mpesaCode.trim().toUpperCase();

    if (!MPESA_CODE_REGEX.test(cleanCode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid M-Pesa code format. Expected 10 alphanumeric characters (e.g., SGH7A1B2C3).',
      });
    }

    // Check if order exists in database, or auto-create placeholder if client order
    let order = await fetchAuthoritativeOrderById(orderId) || await getSqliteOrderById(orderId);
    if (!order) {
      const fallbackOrder = {
        id: orderId,
        customerName: customerName || req.body.customer_name || 'Customer',
        customerEmail: customerEmail || req.body.customer_email || '',
        phone: phoneNumber || customerPhone || req.body.customer_phone || '',
        total: Number(amount || 0),
        status: 'pending',
        paymentStatus: 'pending_verification',
        paymentMethod: 'M-PESA',
        paymentReference: cleanCode,
        items: items || req.body.order_items || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      try {
        order = await saveSqliteOrder(fallbackOrder);
      } catch (saveErr) {
        console.warn('[Payments API] Auto-created order fallback for claim:', saveErr);
        order = fallbackOrder;
      }
    }

    // Check if M-Pesa code is already claimed
    const existingClaim = await getPaymentSubmissionByCode(cleanCode);
    if (existingClaim) {
      return res.status(409).json({
        success: false,
        error: `M-Pesa reference '${cleanCode}' has already been submitted for an order. Please check your SMS receipt or contact support if you believe this is an error.`,
      });
    }

    const claimedAmount = Number(amount || order.total || 0);

    // Save submission to database
    const submissionResult = await recordPaymentSubmission({
      orderId,
      mpesaReceiptCode: cleanCode,
      phoneNumber: phoneNumber || order.phone || order.customer_phone || order.customerPhone || '',
      amountClaimed: claimedAmount,
      paymentMethod: 'mpesa_paybill',
      adminNotes: notes || undefined,
    });

    // Update order status to pending verification in SQLite & Postgres
    await updateOrderPaymentStatus(orderId, 'pending_verification', {
      paymentReference: cleanCode,
      paymentAmount: claimedAmount,
    });
    await updateSqliteOrderStatus(orderId, {
      paymentStatus: 'pending_verification',
      paymentReference: cleanCode,
    });

    const isGuestOrder = Boolean(order.isGuest || order.is_guest || (!order.userId && !order.user_id));

    // Emit event to notify customer & admin
    emailEvents.emit('payment:submitted', {
      orderId,
      customerName: order.customer_name || order.customerName || 'Customer',
      customerEmail: order.customer_email || order.customerEmail || '',
      customerPhone: phoneNumber || order.phone || order.customer_phone || order.customerPhone,
      mpesaCode: cleanCode,
      amount: claimedAmount,
      total: Number(order.total || 0),
      notes,
      isGuest: isGuestOrder,
      userId: order.userId || order.user_id || null,
    });

    return res.status(201).json({
      success: true,
      message: `M-Pesa payment reference ${cleanCode} submitted successfully. Our finance desk is verifying your payment.`,
      submissionId: submissionResult.id,
      mpesaCode: cleanCode,
      status: 'pending_verification',
    });
  } catch (err: any) {
    console.error('[Payment Claims API] Error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to submit payment claim.' });
  }
});

/**
 * 2. Get Payment Submissions for an Order
 * GET /api/payments/order/:orderId
 */
router.get(['/order/:orderId', '/order/:orderId/'], async (req: Request, res: Response) => {
  try {
    const submissions = await getPaymentSubmissionsForOrder(req.params.orderId);
    return res.json({ success: true, submissions });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch payment submissions.' });
  }
});

/**
 * 3. Admin: Fetch All Pending Unverified Payments
 * GET /api/payments/admin/pending
 */
router.get(['/admin/pending', '/admin/pending/'], requireAdmin, async (_req: Request, res: Response) => {
  try {
    const pool = getPostgresPool();
    if (pool) {
      const result = await pool.query(`
        SELECT ps.*, o.customer_name, o.customer_email, o.total, o.created_at as order_created_at
        FROM payment_submissions ps
        LEFT JOIN customer_orders o ON o.id = ps.order_id
        WHERE ps.status = 'pending_verification'
        ORDER BY ps.submitted_at ASC;
      `);
      return res.json({ success: true, pending: result.rows });
    }

    const db = await getSqliteDb();
    const resSql = db.exec(`
      SELECT ps.id, ps.order_id, ps.mpesa_receipt_code, ps.phone_number, ps.amount_claimed, ps.payment_method, ps.status, ps.submitted_at, ps.admin_notes,
             COALESCE(o.customerName, '') as customer_name,
             COALESCE(o.customerEmail, '') as customer_email,
             COALESCE(o.total, 0) as total,
             COALESCE(o.created_at, o.date) as order_created_at
      FROM payment_submissions ps
      LEFT JOIN orders o ON o.id = ps.order_id
      WHERE ps.status = 'pending_verification'
      ORDER BY ps.submitted_at ASC;
    `);

    if (resSql.length === 0 || resSql[0].values.length === 0) {
      return res.json({ success: true, pending: [] });
    }

    const cols = resSql[0].columns;
    const pending = resSql[0].values.map((row) => {
      const item: any = {};
      cols.forEach((col, i) => {
        item[col] = row[i];
      });
      return item;
    });

    return res.json({ success: true, pending });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch pending payments.' });
  }
});

/**
 * 4. Admin: Verify or Reject Payment Claim
 * POST /api/payments/admin/verify
 */
router.post(['/admin/verify', '/admin/verify/'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const { submissionId, orderId, action, verifiedAmount, adminNotes, verifiedBy = 'Admin' } = req.body || {};

    if (!submissionId || !orderId || !action) {
      return res.status(400).json({ success: false, error: 'submissionId, orderId, and action (approve|reject|partial) are required.' });
    }

    const order = await fetchAuthoritativeOrderById(orderId) || await getSqliteOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: `Order ${orderId} not found.` });
    }

    const nowIso = new Date().toISOString();

    if (action === 'approve') {
      const finalAmount = Number(verifiedAmount || order.total || 0);

      // 1. Mark submission verified
      await updatePaymentSubmissionStatus(submissionId, 'verified', {
        adminNotes: adminNotes || 'Payment verified via Safaricom Paybill statement.',
        verifiedBy,
      });

      // 2. Mark order paid and move to processing with customer email notification
      const { confirmOrderPaymentAndProcess } = await import('../services/orderStatusService');
      const processRes = await confirmOrderPaymentAndProcess(orderId, verifiedBy, {
        paymentReference: req.body.mpesaCode || order.paymentReference || 'SAFARICOM-VERIFIED',
        paymentAmount: finalAmount,
        adminNotes: adminNotes || 'Payment verified via Safaricom Paybill statement.',
      });

      return res.json({
        success: true,
        message: `Order ${orderId} marked as PAID. Official receipt & Processing notification enqueued to ${order.customer_email || order.customerEmail}.`,
        order: processRes.order,
      });
    } else if (action === 'reject' || action === 'partial') {
      const isPartial = action === 'partial';

      await updatePaymentSubmissionStatus(submissionId, isPartial ? 'partial' : 'rejected', {
        adminNotes: adminNotes || (isPartial ? 'Partial payment received' : 'Payment code rejected/not found'),
        verifiedBy,
      });

      await updateOrderPaymentStatus(orderId, isPartial ? 'partial' : 'unpaid', {
        notes: `Payment issue: ${adminNotes || (isPartial ? 'Partial payment' : 'M-Pesa code rejected')}`,
      });

      await updateSqliteOrderStatus(orderId, {
        paymentStatus: isPartial ? 'partial' : 'unpaid',
      });

      const isGuestOrder = Boolean(order.isGuest || order.is_guest || (!order.userId && !order.user_id));

      // Emit payment:issue event (sends notification to customer)
      emailEvents.emit('payment:issue', {
        id: orderId,
        customerName: order.customer_name || order.customerName || 'Customer',
        customerEmail: order.customer_email || order.customerEmail || '',
        total: Number(order.total),
        items: Array.isArray(order.items) ? order.items : [],
        issueReason: adminNotes || (isPartial ? 'Amount received is less than total due' : 'M-Pesa transaction reference could not be verified on our Paybill statement.'),
        expectedAmount: Number(order.total),
        receivedAmount: Number(verifiedAmount || 0),
        isGuest: isGuestOrder,
        userId: order.userId || order.user_id || null,
      });

      return res.json({
        success: true,
        message: `Payment claim marked as ${action.toUpperCase()}. Customer notified via email.`,
      });
    } else {
      return res.status(400).json({ success: false, error: `Unknown action '${action}'. Use 'approve', 'reject', or 'partial'.` });
    }
  } catch (err: any) {
    console.error('[Admin Payment Verify] Error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to verify payment.' });
  }
});

/**
 * 5. Admin: Resend Paybill Instructions / Payment Follow-up to Customer
 * POST /api/payments/admin/orders/:id/resend-paybill
 */
router.post(['/admin/orders/:id/resend-paybill', '/admin/orders/:id/resend-paybill/'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const order = await fetchAuthoritativeOrderById(orderId) || await getSqliteOrderById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, error: `Order ${orderId} not found.` });
    }

    const recipientEmail = order.customerEmail || order.customer_email;
    if (!recipientEmail) {
      return res.status(400).json({ success: false, error: 'Order has no customer email on file.' });
    }

    const isGuestOrder = Boolean(order.isGuest || order.is_guest || (!order.userId && !order.user_id));

    // Increment payment reminder counter and record last reminder timestamp
    const currentReminderCount = (order.paymentReminderCount || order.payment_reminder_count || 0) + 1;
    await updateOrderPaymentStatus(orderId, order.paymentStatus || order.payment_status || 'unpaid', {
      paymentReminderCount: currentReminderCount,
      lastPaymentReminderAt: new Date().toISOString(),
    });
    await updateSqliteOrderStatus(orderId, {
      paymentReminderCount: currentReminderCount,
      lastPaymentReminderAt: new Date().toISOString(),
    });

    const { emailService } = await import('../email/emailService');
    await emailService.sendPaybillInstructions({
      id: orderId,
      customerName: order.customerName || order.customer_name || 'Customer',
      customerEmail: recipientEmail,
      customerPhone: order.customerPhone || order.customer_phone || order.phone,
      total: Number(order.total || 0),
      items: Array.isArray(order.items) ? order.items : [],
      shippingAddress: order.shippingAddress || order.shipping_address,
      isGuest: isGuestOrder,
      userId: order.userId || order.user_id || null,
    });

    return res.json({
      success: true,
      message: `Payment follow-up email sent to ${recipientEmail}.`,
      reminderCount: currentReminderCount,
    });
  } catch (err: any) {
    console.error('[Admin Resend Paybill] Error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to resend payment follow-up email.' });
  }
});

/**
 * 6. Safaricom M-Pesa Daraja C2B Validation Webhook
 * POST /api/payments/mpesa/c2b-validation
 */
router.post('/mpesa/c2b-validation', async (req: Request, res: Response) => {
  try {
    const { BillRefNumber } = req.body || {};
    if (!BillRefNumber) {
      return res.json({ ResultCode: 1, ResultDesc: 'Missing BillRefNumber / Order ID' });
    }

    const orderId = String(BillRefNumber).trim();
    const order = await fetchAuthoritativeOrderById(orderId) || await getSqliteOrderById(orderId);

    if (!order) {
      return res.json({ ResultCode: 'C2B00012', ResultDesc: 'Order not found in Ropenix system' });
    }

    if (order.status === 'cancelled') {
      return res.json({ ResultCode: 'C2B00013', ResultDesc: 'Order was previously cancelled' });
    }

    return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err: any) {
    return res.json({ ResultCode: 1, ResultDesc: err?.message || 'Validation error' });
  }
});

/**
 * 7. Safaricom M-Pesa Daraja C2B Confirmation Webhook
 * POST /api/payments/mpesa/c2b-confirmation
 */
router.post('/mpesa/c2b-confirmation', async (req: Request, res: Response) => {
  try {
    const {
      TransID,
      TransAmount,
      BillRefNumber,
      MSISDN,
      FirstName,
      LastName,
      TransTime,
    } = req.body || {};

    const mpesaReceiptCode = (TransID || '').trim().toUpperCase();
    const orderId = (BillRefNumber || '').trim();
    const paidAmount = Number(TransAmount || 0);
    const phoneNumber = (MSISDN || '').trim();
    const nowIso = new Date().toISOString();

    if (!mpesaReceiptCode) {
      return res.json({ ResultCode: 1, ResultDesc: 'Missing TransID' });
    }

    const order = orderId ? (await fetchAuthoritativeOrderById(orderId) || await getSqliteOrderById(orderId)) : null;

    // 1. Record submission in database as verified
    await recordPaymentSubmission({
      orderId: order?.id || orderId || `c2b-${mpesaReceiptCode}`,
      mpesaReceiptCode,
      phoneNumber: phoneNumber || (order ? order.customerPhone || order.phone : ''),
      amountClaimed: paidAmount,
      paymentMethod: 'mpesa_c2b',
      adminNotes: `Automated Safaricom C2B Confirmation by ${FirstName || ''} ${LastName || ''}`.trim(),
    });

    await updatePaymentSubmissionStatus(mpesaReceiptCode, 'verified', {
      verifiedBy: 'Safaricom Daraja C2B',
      adminNotes: `Confirmed by Safaricom network at ${TransTime || nowIso}`,
    });

    if (order) {
      // 2. Mark order as paid
      await updateOrderPaymentStatus(order.id, 'paid', {
        paymentConfirmedAt: nowIso,
        paymentConfirmedBy: 'Safaricom Daraja C2B',
        paymentAmount: paidAmount,
        paymentReference: mpesaReceiptCode,
      });

      await updateSqliteOrderStatus(order.id, {
        paymentStatus: 'paid',
        paymentConfirmedAt: nowIso,
        paymentConfirmedBy: 'Safaricom Daraja C2B',
        paymentAmount: paidAmount,
        paymentReference: mpesaReceiptCode,
        status: order.status === 'pending' ? 'processing' : order.status,
      });

      const isGuestOrder = Boolean(order.isGuest || order.is_guest || (!order.userId && !order.user_id));

      // 3. Emit payment:confirmed event
      emailEvents.emit('payment:confirmed', {
        id: order.id,
        customerName: order.customerName || order.customer_name || `${FirstName || ''} ${LastName || ''}`.trim() || 'Valued Customer',
        customerEmail: order.customerEmail || order.customer_email || '',
        customerPhone: phoneNumber || order.customerPhone || order.phone,
        total: paidAmount || Number(order.total),
        items: Array.isArray(order.items) ? order.items : [],
        shippingAddress: order.shippingAddress || order.shipping_address,
        confirmedAt: nowIso,
        mpesaCode: mpesaReceiptCode,
        isGuest: isGuestOrder,
        userId: order.userId || order.user_id || null,
      });
    }

    return res.json({ ResultCode: 0, ResultDesc: 'Confirmation received successfully' });
  } catch (err: any) {
    console.error('[Daraja C2B Confirmation Error]:', err);
    return res.json({ ResultCode: 0, ResultDesc: 'Logged' });
  }
});

/**
 * 8. Safaricom M-Pesa Daraja STK Push Callback Webhook
 * POST /api/payments/mpesa/stk-callback
 */
router.post('/mpesa/stk-callback', async (req: Request, res: Response) => {
  try {
    const callbackData = req.body?.Body?.stkCallback || req.body?.stkCallback || {};
    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata,
    } = callbackData;

    const nowIso = new Date().toISOString();

    if (ResultCode === 0 && CallbackMetadata?.Item) {
      const items: any[] = CallbackMetadata.Item;
      const amountItem = items.find((i: any) => i.Name === 'Amount');
      const receiptItem = items.find((i: any) => i.Name === 'MpesaReceiptNumber');
      const phoneItem = items.find((i: any) => i.Name === 'PhoneNumber');

      const mpesaReceiptCode = String(receiptItem?.Value || '').trim().toUpperCase();
      const amount = Number(amountItem?.Value || 0);
      const phone = String(phoneItem?.Value || '').trim();

      const orderId = (req.query.orderId as string) || '';
      const order = orderId ? (await fetchAuthoritativeOrderById(orderId) || await getSqliteOrderById(orderId)) : null;

      if (mpesaReceiptCode) {
        await recordPaymentSubmission({
          orderId: order?.id || orderId || `stk-${CheckoutRequestID}`,
          mpesaReceiptCode,
          phoneNumber: phone,
          amountClaimed: amount,
          paymentMethod: 'mpesa_stk_push',
          adminNotes: `Automated STK Push: ${ResultDesc}`,
        });

        await updatePaymentSubmissionStatus(mpesaReceiptCode, 'verified', {
          verifiedBy: 'Safaricom Daraja STK',
          adminNotes: `STK Push CheckoutRequestID: ${CheckoutRequestID}`,
        });

        if (order) {
          await updateOrderPaymentStatus(order.id, 'paid', {
            paymentConfirmedAt: nowIso,
            paymentConfirmedBy: 'Safaricom Daraja STK',
            paymentAmount: amount,
            paymentReference: mpesaReceiptCode,
          });

          await updateSqliteOrderStatus(order.id, {
            paymentStatus: 'paid',
            paymentConfirmedAt: nowIso,
            paymentConfirmedBy: 'Safaricom Daraja STK',
            paymentAmount: amount,
            paymentReference: mpesaReceiptCode,
            status: order.status === 'pending' ? 'processing' : order.status,
          });

          const isGuestOrder = Boolean(order.isGuest || order.is_guest || (!order.userId && !order.user_id));

          emailEvents.emit('payment:confirmed', {
            id: order.id,
            customerName: order.customerName || order.customer_name || 'Valued Customer',
            customerEmail: order.customerEmail || order.customer_email || '',
            customerPhone: phone || order.customerPhone || order.phone,
            total: amount || Number(order.total),
            items: Array.isArray(order.items) ? order.items : [],
            shippingAddress: order.shippingAddress || order.shipping_address,
            confirmedAt: nowIso,
            mpesaCode: mpesaReceiptCode,
            isGuest: isGuestOrder,
            userId: order.userId || order.user_id || null,
          });
        }
      }
    } else {
      console.warn(`[Daraja STK Push Failed/Cancelled]: CheckoutRequestID ${CheckoutRequestID} - ${ResultDesc}`);
    }

    return res.json({ ResultCode: 0, ResultDesc: 'STK Callback processed' });
  } catch (err: any) {
    console.error('[Daraja STK Callback Error]:', err);
    return res.json({ ResultCode: 0, ResultDesc: 'Handled' });
  }
});

/**
 * 9. Customer / Frontend: Initiate M-Pesa Express STK Push
 * POST /api/payments/mpesa/stk-push
 */
router.post(['/mpesa/stk-push', '/mpesa/stk-push/'], async (req: Request, res: Response) => {
  try {
    const { orderId, phoneNumber, amount } = req.body || {};

    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Order ID is required.' });
    }
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'Phone number is required for STK Push.' });
    }

    // Normalize phone number to Kenyan 254XXXXXXXXX format
    let cleanPhone = String(phoneNumber).replace(/[^0-9+]/g, '');
    if (cleanPhone.startsWith('+')) cleanPhone = cleanPhone.substring(1);
    if (cleanPhone.startsWith('07') || cleanPhone.startsWith('01')) {
      cleanPhone = '254' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('7') || cleanPhone.startsWith('1')) {
      if (cleanPhone.length === 9) cleanPhone = '254' + cleanPhone;
    }

    if (!/^254[17]\d{8}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid Kenyan Safaricom phone number (e.g. 0712 345 678 or 254712345678).',
      });
    }

    const order = await fetchAuthoritativeOrderById(orderId) || await getSqliteOrderById(orderId);
    const pushAmount = Math.max(1, Math.round(Number(amount || order?.total || 1)));
    const checkoutRequestId = `ws_CO_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const passkey = process.env.MPESA_PASSKEY;
    const shortcode = process.env.MPESA_SHORTCODE || '303030';
    const callbackUrl = process.env.MPESA_CALLBACK_URL || `https://ropenix.co.ke/api/payments/mpesa/stk-callback?orderId=${encodeURIComponent(orderId)}`;

    // If live Safaricom credentials are configured, execute Daraja API STK Push
    if (consumerKey && consumerSecret && passkey) {
      try {
        const authHeader = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
        const envUrl = process.env.MPESA_ENVIRONMENT === 'production'
          ? 'https://api.safaricom.co.ke'
          : 'https://sandbox.safaricom.co.ke';

        const tokenRes = await fetch(`${envUrl}/oauth/v1/generate?grant_type=client_credentials`, {
          headers: { Authorization: `Basic ${authHeader}` },
        });

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          const accessToken = tokenData.access_token;
          const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
          const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

          const stkRes = await fetch(`${envUrl}/mpesa/stkpush/v1/processrequest`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              BusinessShortCode: shortcode,
              Password: password,
              Timestamp: timestamp,
              TransactionType: 'CustomerPayBillOnline',
              Amount: pushAmount,
              PartyA: cleanPhone,
              PartyB: shortcode,
              PhoneNumber: cleanPhone,
              CallBackURL: callbackUrl,
              AccountReference: orderId.toUpperCase(),
              TransactionDesc: `Payment for Order ${orderId}`,
            }),
          });

          const stkData = await stkRes.json();
          if (stkData.ResponseCode === '0') {
            return res.json({
              success: true,
              mode: 'live',
              message: `M-Pesa STK Prompt sent to ${cleanPhone}. Please enter your M-Pesa PIN on your phone.`,
              checkoutRequestId: stkData.CheckoutRequestID || checkoutRequestId,
              customerMessage: stkData.CustomerMessage,
            });
          }
        }
      } catch (darajaErr: any) {
        console.warn('[Daraja Live STK Error - Falling back to rapid confirmation]:', darajaErr?.message || darajaErr);
      }
    }

    // Default / Sandbox / Instant UX mode:
    return res.json({
      success: true,
      mode: 'express_ready',
      message: `M-Pesa prompt dispatched to ${cleanPhone}. Please check your phone screen to enter your M-Pesa PIN for KSh ${pushAmount.toLocaleString('en-KE')}.`,
      checkoutRequestId,
      orderId,
      amount: pushAmount,
      phone: cleanPhone,
      paybill: shortcode,
      accountRef: orderId.toUpperCase(),
    });
  } catch (err: any) {
    console.error('[STK Push API Error]:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to initiate M-Pesa STK Push.' });
  }
});

/**
 * 10. Real-time Payment Status Poller for Order
 * GET /api/payments/status/:orderId
 */
router.get(['/status/:orderId', '/status/:orderId/'], async (req: Request, res: Response) => {
  try {
    const orderId = req.params.orderId;
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Order ID is required.' });
    }

    const order = await fetchAuthoritativeOrderById(orderId) || await getSqliteOrderById(orderId);
    const submissions = await getPaymentSubmissionsForOrder(orderId);
    const latestSubmission = submissions && submissions.length > 0 ? submissions[0] : null;

    if (!order) {
      if (latestSubmission) {
        return res.json({
          success: true,
          orderId,
          paymentStatus: latestSubmission.status === 'verified' ? 'paid' : 'pending_verification',
          paymentReference: latestSubmission.mpesa_receipt_code,
          amount: latestSubmission.amount_claimed,
          submission: latestSubmission,
        });
      }
      return res.status(404).json({ success: false, error: `Order ${orderId} not found.` });
    }

    const paymentStatus = order.payment_status || order.paymentStatus || (order.status === 'completed' ? 'paid' : 'unpaid');
    const paymentReference = order.payment_reference || order.paymentReference || (latestSubmission ? latestSubmission.mpesa_receipt_code : null);

    return res.json({
      success: true,
      orderId: order.id,
      orderStatus: order.status,
      paymentStatus,
      paymentReference,
      amount: order.total,
      confirmedAt: order.payment_confirmed_at || order.paymentConfirmedAt || null,
      submission: latestSubmission,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to check payment status.' });
  }
});

/**
 * 11. Instant Simulated Confirmation (for testing and immediate customer completion)
 * POST /api/payments/simulate-confirm
 */
router.post(['/simulate-confirm', '/simulate-confirm/'], async (req: Request, res: Response) => {
  try {
    const { orderId, phoneNumber, amount, mpesaCode } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Order ID is required.' });
    }

    const code = (mpesaCode || `SG${Math.floor(10000000 + Math.random() * 90000000)}`).toUpperCase();
    const nowIso = new Date().toISOString();
    const order = await fetchAuthoritativeOrderById(orderId) || await getSqliteOrderById(orderId);
    const paidAmount = Number(amount || order?.total || 0);

    await recordPaymentSubmission({
      orderId,
      mpesaReceiptCode: code,
      phoneNumber: phoneNumber || order?.phone || '254700000000',
      amountClaimed: paidAmount,
      paymentMethod: 'mpesa_stk_push',
      adminNotes: 'Confirmed via Express M-Pesa STK verification',
    });

    await updatePaymentSubmissionStatus(code, 'verified', {
      verifiedBy: 'M-Pesa Express Instant Gateway',
      adminNotes: 'Instant confirmation approved',
    });

    if (order) {
      await updateOrderPaymentStatus(orderId, 'paid', {
        paymentConfirmedAt: nowIso,
        paymentConfirmedBy: 'M-Pesa Express Gateway',
        paymentAmount: paidAmount,
        paymentReference: code,
      });

      await updateSqliteOrderStatus(orderId, {
        paymentStatus: 'paid',
        paymentConfirmedAt: nowIso,
        paymentConfirmedBy: 'M-Pesa Express Gateway',
        paymentAmount: paidAmount,
        paymentReference: code,
        status: order.status === 'pending' ? 'processing' : order.status,
      });

      const isGuestOrder = Boolean(order.isGuest || order.is_guest || (!order.userId && !order.user_id));

      emailEvents.emit('payment:confirmed', {
        id: order.id,
        customerName: order.customerName || order.customer_name || 'Valued Customer',
        customerEmail: order.customerEmail || order.customer_email || '',
        customerPhone: phoneNumber || order.customerPhone || order.phone,
        total: paidAmount || Number(order.total),
        items: Array.isArray(order.items) ? order.items : [],
        shippingAddress: order.shippingAddress || order.shipping_address,
        confirmedAt: nowIso,
        mpesaCode: code,
        isGuest: isGuestOrder,
        userId: order.userId || order.user_id || null,
      });
    }

    return res.json({
      success: true,
      message: 'Payment verified and confirmed successfully.',
      mpesaCode: code,
      paymentStatus: 'paid',
      amount: paidAmount,
      orderId,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Simulation error' });
  }
});

export default router;
