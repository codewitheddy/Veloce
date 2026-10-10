/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Ropenix Email & Transactional DB Services (MySQL Standalone)
 * Backed solely by the central MySQL database.
 */

import crypto from 'crypto';
import { getDbPool } from '../../src/lib/mysql-db';
export { getDbPool };

export interface EmailLogRecord {
  id: string;
  recipient: string;
  email_type: string;
  subject: string;
  status: 'sent' | 'failed' | 'queued' | 'skipped_opt_out' | 'skipped_duplicate';
  attempts: number;
  error_message?: string;
  related_order_id?: string;
  related_user_id?: string;
  dedupe_key?: string;
  metadata?: any;
  created_at: string;
  sent_at?: string;
}

export interface EmailJobRecord {
  id: string;
  email_type: string;
  recipient: string;
  subject: string;
  payload: any;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  error_message?: string;
  dedupe_key?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentSubmissionRecord {
  id: string;
  order_id: string;
  mpesa_receipt_code: string;
  phone_number: string;
  amount_claimed?: number;
  payment_method: string;
  status: 'pending_verification' | 'verified' | 'rejected' | 'partial';
  admin_notes?: string;
  submitted_at: string;
  verified_at?: string;
  verified_by?: string;
}

export interface EmailPreferencesRecord {
  id: string;
  email: string;
  allow_marketing: boolean;
  allow_review_requests: boolean;
  allow_abandoned_cart: boolean;
  allow_price_drop: boolean;
  unsubscribed_all: boolean;
  updated_at: string;
}

// ============================================================================
// 1. EMAIL LOGS & DEDUPLICATION (MySQL)
// ============================================================================

export async function logEmail(record: Omit<EmailLogRecord, 'id' | 'created_at'>): Promise<string> {
  const id = `elog-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();
  const metadataStr = record.metadata ? (typeof record.metadata === 'string' ? record.metadata : JSON.stringify(record.metadata)) : null;

  try {
    const pool = await getDbPool();
    await pool.query(
      `INSERT INTO email_logs (id, recipient, email_type, subject, status, attempts, error_message, related_order_id, related_user_id, dedupe_key, metadata, created_at, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         attempts = email_logs.attempts + 1,
         error_message = VALUES(error_message),
         sent_at = VALUES(sent_at);`,
      [
        id,
        record.recipient,
        record.email_type,
        record.subject,
        record.status,
        record.attempts || 1,
        record.error_message || null,
        record.related_order_id || null,
        record.related_user_id || null,
        record.dedupe_key || null,
        metadataStr,
        now,
        record.sent_at || (record.status === 'sent' ? now : null),
      ]
    );
  } catch (err: any) {
    console.warn('[Email DB] MySQL logEmail warning:', err?.message || err);
  }

  return id;
}

export async function isDedupeKeyProcessed(dedupeKey: string): Promise<boolean> {
  if (!dedupeKey) return false;

  try {
    const pool = await getDbPool();
    const [rows]: any = await pool.query(
      `SELECT id FROM email_logs WHERE dedupe_key = ? AND status = 'sent' LIMIT 1`,
      [dedupeKey]
    );
    return Boolean(rows && rows.length > 0);
  } catch (err: any) {
    console.warn('[Email DB] isDedupeKeyProcessed check warning:', err?.message || err);
    return false;
  }
}

// ============================================================================
// 2. EMAIL QUEUE & JOBS (MySQL)
// ============================================================================

export async function enqueueEmailJob(job: {
  emailType: string;
  recipient: string;
  subject: string;
  payload: any;
  dedupeKey?: string;
  delaySeconds?: number;
  maxAttempts?: number;
}): Promise<string | null> {
  const dedupeKey = job.dedupeKey || null;

  if (dedupeKey && (await isDedupeKeyProcessed(dedupeKey))) {
    console.log(`[Email Queue] ⏭️ Skipping enqueue: dedupeKey "${dedupeKey}" already sent.`);
    return null;
  }

  const id = `job-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date();
  const nextAttempt = new Date(now.getTime() + (job.delaySeconds || 0) * 1000).toISOString();
  const nowIso = now.toISOString();
  const payloadStr = typeof job.payload === 'string' ? job.payload : JSON.stringify(job.payload || {});

  try {
    const pool = await getDbPool();
    await pool.query(
      `INSERT INTO email_jobs (id, email_type, recipient, subject, payload, status, attempts, max_attempts, next_attempt_at, dedupe_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = id;`,
      [
        id,
        job.emailType,
        job.recipient,
        job.subject,
        payloadStr,
        job.maxAttempts || 5,
        nextAttempt,
        dedupeKey,
        nowIso,
        nowIso,
      ]
    );
    return id;
  } catch (err: any) {
    console.warn('[Email Queue] MySQL enqueue warning:', err?.message || err);
    return null;
  }
}

export async function fetchDueEmailJobs(limit = 10): Promise<EmailJobRecord[]> {
  const now = new Date();
  const nowIso = now.toISOString();
  const staleThresholdIso = new Date(now.getTime() - 2 * 60 * 1000).toISOString();

  try {
    const pool = await getDbPool();
    const [rows]: any = await pool.query(
      `SELECT id, email_type, recipient, subject, payload, status, attempts, max_attempts, next_attempt_at, error_message, dedupe_key, created_at, updated_at
       FROM email_jobs
       WHERE (status = 'queued' AND next_attempt_at <= ?)
          OR (status = 'sending' AND updated_at <= ?)
       ORDER BY next_attempt_at ASC
       LIMIT ?`,
      [nowIso, staleThresholdIso, limit]
    );

    if (!rows || rows.length === 0) return [];

    return rows.map((r: any) => {
      let payload = r.payload;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          payload = {};
        }
      }
      return {
        ...r,
        payload,
      } as EmailJobRecord;
    });
  } catch (err: any) {
    console.warn('[Email DB] fetchDueEmailJobs error:', err?.message || err);
    return [];
  }
}

export async function updateEmailJobStatus(
  jobId: string,
  status: 'queued' | 'sending' | 'sent' | 'failed',
  details?: { attempts?: number; nextAttemptAt?: string; errorMessage?: string }
): Promise<void> {
  const nowIso = new Date().toISOString();

  try {
    const pool = await getDbPool();
    await pool.query(
      `UPDATE email_jobs SET
        status = ?,
        attempts = COALESCE(?, attempts),
        next_attempt_at = COALESCE(?, next_attempt_at),
        error_message = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        status,
        details?.attempts ?? null,
        details?.nextAttemptAt || null,
        details?.errorMessage ?? null,
        nowIso,
        jobId,
      ]
    );
  } catch (err: any) {
    console.warn('[Email DB] MySQL updateEmailJobStatus warning:', err?.message || err);
  }
}

export async function fetchEmailJobs(status?: string, limit = 50): Promise<EmailJobRecord[]> {
  try {
    const pool = await getDbPool();
    const query = status
      ? `SELECT * FROM email_jobs WHERE status = ? ORDER BY created_at DESC LIMIT ?`
      : `SELECT * FROM email_jobs ORDER BY created_at DESC LIMIT ?`;
    const params = status ? [status, limit] : [limit];
    const [rows]: any = await pool.query(query, params);

    if (!rows || rows.length === 0) return [];

    return rows.map((r: any) => ({
      ...r,
      payload: typeof r.payload === 'string' ? JSON.parse(r.payload || '{}') : r.payload,
    }));
  } catch (err: any) {
    console.warn('[Email DB] fetchEmailJobs error:', err?.message || err);
    return [];
  }
}

export async function retryFailedJobs(): Promise<number> {
  const nowIso = new Date().toISOString();
  try {
    const pool = await getDbPool();
    const [result]: any = await pool.query(
      `UPDATE email_jobs SET status = 'queued', attempts = 0, next_attempt_at = ?, updated_at = ? WHERE status = 'failed'`,
      [nowIso, nowIso]
    );
    return result?.affectedRows || 0;
  } catch (err: any) {
    console.warn('[Email DB] retryFailedJobs error:', err?.message || err);
    return 0;
  }
}

// ============================================================================
// 3. PAYMENT SUBMISSIONS ("I'VE PAID" CLAIM FLOW - MySQL)
// ============================================================================

export async function createPaymentSubmission(submission: {
  orderId: string;
  mpesaReceiptCode: string;
  phoneNumber: string;
  amountClaimed?: number;
  paymentMethod?: string;
  adminNotes?: string;
}): Promise<{ success: boolean; id?: string; error?: string; duplicate?: boolean }> {
  const cleanCode = submission.mpesaReceiptCode.trim().toUpperCase();
  const cleanPhone = submission.phoneNumber.trim().replace(/\s+/g, '');
  const id = `claim-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const nowIso = new Date().toISOString();

  // Verify code uniqueness
  const existing = await getPaymentSubmissionByMpesaCode(cleanCode);
  if (existing) {
    return {
      success: false,
      duplicate: true,
      error: `M-Pesa Transaction Code "${cleanCode}" has already been submitted for Order #${existing.order_id}. Duplicate payment claims are rejected.`,
    };
  }

  try {
    const pool = await getDbPool();
    await pool.query(
      `INSERT INTO payment_submissions (id, order_id, mpesa_receipt_code, phone_number, amount_claimed, payment_method, status, admin_notes, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending_verification', ?, ?)`,
      [
        id,
        submission.orderId,
        cleanCode,
        cleanPhone,
        submission.amountClaimed || null,
        submission.paymentMethod || 'mpesa_paybill',
        submission.adminNotes || null,
        nowIso,
      ]
    );
    return { success: true, id };
  } catch (err: any) {
    if (String(err?.message || '').includes('Duplicate entry') || String(err?.message || '').includes('UNIQUE')) {
      return { success: false, duplicate: true, error: `M-Pesa code "${cleanCode}" has already been used.` };
    }
    return { success: false, error: err?.message || 'Failed to save payment submission' };
  }
}

export async function getPaymentSubmissionByMpesaCode(code: string): Promise<PaymentSubmissionRecord | null> {
  const cleanCode = code.trim().toUpperCase();

  try {
    const pool = await getDbPool();
    const [rows]: any = await pool.query(
      `SELECT id, order_id, mpesa_receipt_code, phone_number, amount_claimed, payment_method, status, admin_notes, submitted_at, verified_at, verified_by
       FROM payment_submissions WHERE UPPER(mpesa_receipt_code) = UPPER(?) LIMIT 1`,
      [cleanCode]
    );
    if (!rows || rows.length === 0) return null;
    return rows[0] as PaymentSubmissionRecord;
  } catch {
    return null;
  }
}

export async function getPaymentSubmissionsForOrder(orderId: string): Promise<PaymentSubmissionRecord[]> {
  try {
    const pool = await getDbPool();
    const [rows]: any = await pool.query(
      `SELECT id, order_id, mpesa_receipt_code, phone_number, amount_claimed, payment_method, status, admin_notes, submitted_at, verified_at, verified_by
       FROM payment_submissions WHERE order_id = ? ORDER BY submitted_at DESC`,
      [orderId]
    );
    return rows || [];
  } catch {
    return [];
  }
}

export async function getAllPendingPaymentSubmissions(): Promise<PaymentSubmissionRecord[]> {
  try {
    const pool = await getDbPool();
    const [rows]: any = await pool.query(
      `SELECT id, order_id, mpesa_receipt_code, phone_number, amount_claimed, payment_method, status, admin_notes, submitted_at, verified_at, verified_by
       FROM payment_submissions WHERE status = 'pending_verification' ORDER BY submitted_at ASC`
    );
    return rows || [];
  } catch {
    return [];
  }
}

export async function updatePaymentSubmissionStatus(
  submissionId: string,
  status: 'verified' | 'rejected' | 'partial',
  details: { verifiedBy: string; adminNotes?: string }
): Promise<void> {
  const nowIso = new Date().toISOString();

  try {
    const pool = await getDbPool();
    await pool.query(
      `UPDATE payment_submissions SET
        status = ?,
        verified_at = ?,
        verified_by = ?,
        admin_notes = COALESCE(?, admin_notes)
       WHERE id = ?`,
      [status, nowIso, details.verifiedBy, details.adminNotes || null, submissionId]
    );
  } catch (err: any) {
    console.warn('[Email DB] MySQL updatePaymentSubmissionStatus warning:', err?.message || err);
  }
}

// ============================================================================
// 4. EMAIL PREFERENCES & OPT-OUTS (MySQL)
// ============================================================================

export async function getEmailPreferences(email: string): Promise<EmailPreferencesRecord> {
  const cleanEmail = email.trim().toLowerCase();
  const defaultPrefs: EmailPreferencesRecord = {
    id: `pref-${cleanEmail}`,
    email: cleanEmail,
    allow_marketing: true,
    allow_review_requests: true,
    allow_abandoned_cart: true,
    allow_price_drop: true,
    unsubscribed_all: false,
    updated_at: new Date().toISOString(),
  };

  try {
    const pool = await getDbPool();
    const [rows]: any = await pool.query(
      `SELECT id, email, allow_marketing, allow_review_requests, allow_abandoned_cart, allow_price_drop, unsubscribed_all, updated_at
       FROM email_preferences WHERE email = ? LIMIT 1`,
      [cleanEmail]
    );

    if (rows && rows.length > 0) {
      const r = rows[0];
      return {
        id: r.id,
        email: r.email,
        allow_marketing: Boolean(r.allow_marketing),
        allow_review_requests: Boolean(r.allow_review_requests),
        allow_abandoned_cart: Boolean(r.allow_abandoned_cart),
        allow_price_drop: Boolean(r.allow_price_drop),
        unsubscribed_all: Boolean(r.unsubscribed_all),
        updated_at: r.updated_at,
      };
    }
    return defaultPrefs;
  } catch {
    return defaultPrefs;
  }
}

export async function isEmailOptedOut(email: string, category: 'marketing' | 'review' | 'abandoned_cart' | 'price_drop'): Promise<boolean> {
  const prefs = await getEmailPreferences(email);
  if (prefs.unsubscribed_all) return true;

  if (category === 'marketing' && !prefs.allow_marketing) return true;
  if (category === 'review' && !prefs.allow_review_requests) return true;
  if (category === 'abandoned_cart' && !prefs.allow_abandoned_cart) return true;
  if (category === 'price_drop' && !prefs.allow_price_drop) return true;

  return false;
}

export async function updateEmailPreferences(
  email: string,
  updates: Partial<Omit<EmailPreferencesRecord, 'id' | 'email' | 'updated_at'>>
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const current = await getEmailPreferences(cleanEmail);
  const next = { ...current, ...updates, updated_at: new Date().toISOString() };

  try {
    const pool = await getDbPool();
    await pool.query(
      `INSERT INTO email_preferences (id, email, allow_marketing, allow_review_requests, allow_abandoned_cart, allow_price_drop, unsubscribed_all, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        allow_marketing = VALUES(allow_marketing),
        allow_review_requests = VALUES(allow_review_requests),
        allow_abandoned_cart = VALUES(allow_abandoned_cart),
        allow_price_drop = VALUES(allow_price_drop),
        unsubscribed_all = VALUES(unsubscribed_all),
        updated_at = VALUES(updated_at)`,
      [
        next.id,
        next.email,
        next.allow_marketing ? 1 : 0,
        next.allow_review_requests ? 1 : 0,
        next.allow_abandoned_cart ? 1 : 0,
        next.allow_price_drop ? 1 : 0,
        next.unsubscribed_all ? 1 : 0,
        next.updated_at,
      ]
    );
  } catch (err: any) {
    console.warn('[Email DB] MySQL updateEmailPreferences warning:', err?.message || err);
  }
}

// ============================================================================
// 5. SCHEDULED TASK EXECUTION DEDUPLICATION (MySQL)
// ============================================================================

export async function wasScheduledTaskExecuted(dedupeKey: string): Promise<boolean> {
  try {
    const pool = await getDbPool();
    const [rows]: any = await pool.query(
      `SELECT id FROM scheduled_task_logs WHERE dedupe_key = ? AND status = 'success' LIMIT 1`,
      [dedupeKey]
    );
    return Boolean(rows && rows.length > 0);
  } catch {
    return false;
  }
}

export async function recordScheduledTaskExecution(taskName: string, dedupeKey: string, details?: string): Promise<void> {
  const id = `task-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const nowIso = new Date().toISOString();

  try {
    const pool = await getDbPool();
    await pool.query(
      `INSERT INTO scheduled_task_logs (id, task_name, dedupe_key, executed_at, status, details)
       VALUES (?, ?, ?, ?, 'success', ?)
       ON DUPLICATE KEY UPDATE executed_at = VALUES(executed_at), details = VALUES(details);`,
      [id, taskName, dedupeKey, nowIso, details || null]
    );
  } catch (err: any) {
    console.warn('[Email DB] MySQL recordScheduledTaskExecution warning:', err?.message || err);
  }
}

// Export Aliases
export const recordPaymentSubmission = createPaymentSubmission;
export const getPaymentSubmissionByCode = getPaymentSubmissionByMpesaCode;
export const hasScheduledTaskRun = wasScheduledTaskExecuted;

export async function logScheduledTaskRun(dedupeKey: string, details?: any): Promise<void> {
  return recordScheduledTaskExecution('scheduled_task', dedupeKey, details ? JSON.stringify(details) : undefined);
}

export async function isRecipientOptedOut(email: string, emailType: string): Promise<boolean> {
  const category = emailType.includes('marketing')
    ? 'marketing'
    : emailType.includes('review')
    ? 'review'
    : emailType.includes('cart')
    ? 'abandoned_cart'
    : null;
  if (!category) return false;
  return isEmailOptedOut(email, category as any);
}

export async function updateOrderPaymentStatus(
  orderId: string,
  status: string,
  details?: {
    paymentReference?: string;
    paymentAmount?: number;
    paymentConfirmedAt?: string;
    paymentConfirmedBy?: string;
    paymentReminderCount?: number;
    lastPaymentReminderAt?: string;
    notes?: string;
  }
): Promise<void> {
  const nowIso = new Date().toISOString();

  try {
    const pool = await getDbPool();
    await pool.query(
      `UPDATE orders SET
        paymentStatus = ?,
        paymentReference = COALESCE(?, paymentReference),
        total = COALESCE(?, total),
        paidAt = COALESCE(?, paidAt),
        deliveryNote = COALESCE(?, deliveryNote),
        updated_at = ?
       WHERE id = ?`,
      [
        status,
        details?.paymentReference || null,
        details?.paymentAmount || null,
        details?.paymentConfirmedAt || (status === 'paid' ? nowIso : null),
        details?.notes || null,
        nowIso,
        orderId,
      ]
    );

    // Also update customer_orders table if exists
    try {
      await pool.query(
        `UPDATE customer_orders SET
          payment_status = ?,
          payment_reference = COALESCE(?, payment_reference),
          payment_amount = COALESCE(?, payment_amount),
          payment_confirmed_at = COALESCE(?, payment_confirmed_at),
          payment_confirmed_by = COALESCE(?, payment_confirmed_by),
          payment_reminder_count = COALESCE(?, payment_reminder_count),
          last_payment_reminder_at = COALESCE(?, last_payment_reminder_at),
          updated_at = ?
         WHERE id = ?`,
        [
          status,
          details?.paymentReference || null,
          details?.paymentAmount || null,
          details?.paymentConfirmedAt || (status === 'paid' ? nowIso : null),
          details?.paymentConfirmedBy || null,
          details?.paymentReminderCount ?? null,
          details?.lastPaymentReminderAt || null,
          nowIso,
          orderId,
        ]
      );
    } catch (_) {}
  } catch (e: any) {
    console.warn('[Email DB] MySQL updateOrderPaymentStatus warning:', e?.message || e);
  }
}

/**
 * Normalizes an order record from DB into a unified structure
 */
function normalizeOrderRecord(row: any): any {
  if (!row) return null;
  let items = row.items || [];
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }

  const customerName = row.customerName || row.customer_name || 'Customer';
  const customerEmail = row.customerEmail || row.customer_email || '';
  const customerPhone = row.customerPhone || row.phone || row.customer_phone || row.mpesaPhone || '';
  const total = Number(row.total || 0);
  const status = row.status || 'pending';
  const paymentStatus = row.paymentStatus || row.payment_status || 'unpaid';
  const paymentReference = row.paymentReference || row.payment_reference || '';
  const paymentReminderCount = Number(row.paymentReminderCount || row.payment_reminder_count || 0);
  const lastPaymentReminderAt = row.lastPaymentReminderAt || row.last_payment_reminder_at || null;
  const shippingAddress = row.shippingAddress || row.shipping_address || '';
  const createdAt = row.date || row.created_at || row.createdAt || new Date().toISOString();

  return {
    id: row.id,
    customerName,
    customer_name: customerName,
    customerEmail,
    customer_email: customerEmail,
    customerPhone,
    customer_phone: customerPhone,
    phone: customerPhone,
    total,
    status,
    paymentStatus,
    payment_status: paymentStatus,
    paymentReference,
    payment_reference: paymentReference,
    paymentReminderCount,
    payment_reminder_count: paymentReminderCount,
    lastPaymentReminderAt,
    last_payment_reminder_at: lastPaymentReminderAt,
    shippingAddress,
    shipping_address: shippingAddress,
    items,
    createdAt,
    created_at: createdAt,
    date: createdAt,
  };
}

/**
 * Fetches an order authoritatively from MySQL
 */
export async function fetchAuthoritativeOrderById(orderId: string): Promise<any | null> {
  if (!orderId) return null;
  const cleanId = String(orderId).trim();

  try {
    const pool = await getDbPool();
    const [rows]: any = await pool.query(`SELECT * FROM orders WHERE UPPER(id) = UPPER(?) LIMIT 1`, [cleanId]);
    if (rows && rows.length > 0) {
      return normalizeOrderRecord(rows[0]);
    }

    const [cRows]: any = await pool.query(`SELECT * FROM customer_orders WHERE UPPER(id) = UPPER(?) LIMIT 1`, [cleanId]);
    if (cRows && cRows.length > 0) {
      return normalizeOrderRecord(cRows[0]);
    }

    return null;
  } catch {
    return null;
  }
}

export async function getUnpaidOrders(olderThanHours = 0): Promise<any[]> {
  const thresholdIso = new Date(Date.now() - olderThanHours * 3600 * 1000).toISOString();
  const resultMap = new Map<string, any>();

  try {
    const pool = await getDbPool();
    const [rows]: any = await pool.query(
      `SELECT * FROM orders
       WHERE (paymentStatus = 'unpaid' OR paymentStatus = 'pending' OR paymentStatus IS NULL)
         AND status NOT IN ('cancelled', 'completed', 'delivered')
         AND date <= ?
       ORDER BY date ASC`,
      [thresholdIso]
    );

    for (const r of rows || []) {
      const norm = normalizeOrderRecord(r);
      if (norm && !resultMap.has(norm.id)) resultMap.set(norm.id, norm);
    }

    try {
      const [cRows]: any = await pool.query(
        `SELECT * FROM customer_orders
         WHERE (payment_status = 'unpaid' OR payment_status = 'pending' OR payment_status IS NULL)
           AND status NOT IN ('cancelled', 'completed', 'delivered')
           AND (created_at <= ? OR placed_at <= ?)
         ORDER BY created_at ASC`,
        [thresholdIso, thresholdIso]
      );
      for (const r of cRows || []) {
        const norm = normalizeOrderRecord(r);
        if (norm && !resultMap.has(norm.id)) resultMap.set(norm.id, norm);
      }
    } catch (_) {}

    return Array.from(resultMap.values());
  } catch (err: any) {
    console.warn('[Email DB] getUnpaidOrders error:', err?.message || err);
    return [];
  }
}

export async function hasUnprocessedPaymentSubmission(orderId: string): Promise<boolean> {
  try {
    const pool = await getDbPool();
    const [rows]: any = await pool.query(
      `SELECT id FROM payment_submissions WHERE order_id = ? AND status = 'pending_verification' LIMIT 1`,
      [orderId]
    );
    return Boolean(rows && rows.length > 0);
  } catch {
    return false;
  }
}
