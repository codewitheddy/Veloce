/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { getSqliteDb, saveSqliteDb } from '../../src/lib/sqlite-db';
import { getPostgresPool } from '../../src/lib/postgres-db';

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

function isPostgresActive(): boolean {
  const pool = getPostgresPool();
  return Boolean(pool);
}

// ============================================================================
// 1. EMAIL LOGS & DEDUPLICATION
// ============================================================================

export async function logEmail(record: Omit<EmailLogRecord, 'id' | 'created_at'>): Promise<string> {
  const id = `elog-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();
  const metadataStr = record.metadata ? JSON.stringify(record.metadata) : null;

  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      await pool.query(
        `INSERT INTO email_logs (id, recipient, email_type, subject, status, attempts, error_message, related_order_id, related_user_id, dedupe_key, metadata, created_at, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (dedupe_key) DO UPDATE SET
           status = EXCLUDED.status,
           attempts = email_logs.attempts + 1,
           error_message = EXCLUDED.error_message,
           sent_at = EXCLUDED.sent_at`,
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
          metadataStr ? JSON.parse(metadataStr) : null,
          now,
          record.sent_at || (record.status === 'sent' ? now : null),
        ]
      );
      return id;
    } catch (err: any) {
      console.warn('[Email DB] PG logEmail warning:', err?.message);
    }
  }

  // SQLite Fallback
  try {
    const db = await getSqliteDb();
    if (record.dedupe_key) {
      const existing = db.exec("SELECT id FROM email_logs WHERE dedupe_key = ?;", [record.dedupe_key]);
      if (existing.length > 0 && existing[0].values.length > 0) {
        db.run(
          `UPDATE email_logs SET status = ?, attempts = attempts + 1, error_message = ?, sent_at = ? WHERE dedupe_key = ?;`,
          [record.status, record.error_message || null, record.sent_at || (record.status === 'sent' ? now : null), record.dedupe_key]
        );
        saveSqliteDb(db);
        return String(existing[0].values[0][0]);
      }
    }

    db.run(
      `INSERT INTO email_logs (id, recipient, email_type, subject, status, attempts, error_message, related_order_id, related_user_id, dedupe_key, metadata, created_at, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
    saveSqliteDb(db);
  } catch (err: any) {
    console.warn('[Email DB] SQLite logEmail warning:', err?.message);
  }

  return id;
}

export async function isDedupeKeyProcessed(dedupeKey: string): Promise<boolean> {
  if (!dedupeKey) return false;

  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      const res = await pool.query(
        `SELECT id FROM email_logs WHERE dedupe_key = $1 AND status = 'sent' LIMIT 1`,
        [dedupeKey]
      );
      return res.rows.length > 0;
    } catch {
      return false;
    }
  }

  try {
    const db = await getSqliteDb();
    const res = db.exec("SELECT id FROM email_logs WHERE dedupe_key = ? AND status = 'sent' LIMIT 1;", [dedupeKey]);
    return res.length > 0 && res[0].values.length > 0;
  } catch {
    return false;
  }
}

// ============================================================================
// 2. EMAIL QUEUE & JOBS
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

  // Check if job or sent email already exists for this dedupe key
  if (dedupeKey && (await isDedupeKeyProcessed(dedupeKey))) {
    console.log(`[Email Queue] ⏭️ Skipping enqueue: dedupeKey "${dedupeKey}" already sent.`);
    return null;
  }

  const id = `job-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date();
  const nextAttempt = new Date(now.getTime() + (job.delaySeconds || 0) * 1000).toISOString();
  const nowIso = now.toISOString();
  const payloadStr = JSON.stringify(job.payload || {});

  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      const query = `
        INSERT INTO email_jobs (id, email_type, recipient, subject, payload, status, attempts, max_attempts, next_attempt_at, dedupe_key, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'queued', 0, $6, $7, $8, $9, $9)
        ON CONFLICT (dedupe_key) DO NOTHING
        RETURNING id;
      `;
      const res = await pool.query(query, [
        id,
        job.emailType,
        job.recipient,
        job.subject,
        JSON.parse(payloadStr),
        job.maxAttempts || 5,
        nextAttempt,
        dedupeKey,
        nowIso,
      ]);
      return res.rows[0]?.id || null;
    } catch (err: any) {
      console.warn('[Email Queue] PG enqueue warning:', err?.message);
    }
  }

  // SQLite Fallback
  try {
    const db = await getSqliteDb();
    if (dedupeKey) {
      const existing = db.exec("SELECT id, status FROM email_jobs WHERE dedupe_key = ?;", [dedupeKey]);
      if (existing.length > 0 && existing[0].values.length > 0) {
        return null;
      }
    }

    db.run(
      `INSERT INTO email_jobs (id, email_type, recipient, subject, payload, status, attempts, max_attempts, next_attempt_at, dedupe_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?, ?, ?);`,
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
    saveSqliteDb(db);
    return id;
  } catch (err: any) {
    console.warn('[Email Queue] SQLite enqueue warning:', err?.message);
    return null;
  }
}

export async function fetchDueEmailJobs(limit = 10): Promise<EmailJobRecord[]> {
  const nowIso = new Date().toISOString();

  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      const query = `
        SELECT id, email_type, recipient, subject, payload, status, attempts, max_attempts, next_attempt_at, error_message, dedupe_key, created_at, updated_at
        FROM email_jobs
        WHERE status = 'queued' AND next_attempt_at <= $1
        ORDER BY next_attempt_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED;
      `;
      const res = await pool.query(query, [nowIso, limit]);
      return res.rows.map((r) => ({
        ...r,
        payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
      }));
    } catch {
      // Fallback without FOR UPDATE if not supported
      const query = `
        SELECT id, email_type, recipient, subject, payload, status, attempts, max_attempts, next_attempt_at, error_message, dedupe_key, created_at, updated_at
        FROM email_jobs
        WHERE status = 'queued' AND next_attempt_at <= $1
        ORDER BY next_attempt_at ASC
        LIMIT $2;
      `;
      const res = await pool.query(query, [nowIso, limit]);
      return res.rows.map((r) => ({
        ...r,
        payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
      }));
    }
  }

  // SQLite
  try {
    const db = await getSqliteDb();
    const res = db.exec(
      "SELECT id, email_type, recipient, subject, payload, status, attempts, max_attempts, next_attempt_at, error_message, dedupe_key, created_at, updated_at FROM email_jobs WHERE status = 'queued' AND next_attempt_at <= ? ORDER BY next_attempt_at ASC LIMIT ?;",
      [nowIso, limit]
    );

    if (res.length === 0 || res[0].values.length === 0) return [];

    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: any = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      try {
        obj.payload = JSON.parse(obj.payload);
      } catch {
        obj.payload = {};
      }
      return obj as EmailJobRecord;
    });
  } catch {
    return [];
  }
}

export async function updateEmailJobStatus(
  jobId: string,
  status: 'queued' | 'sending' | 'sent' | 'failed',
  details?: { attempts?: number; nextAttemptAt?: string; errorMessage?: string }
): Promise<void> {
  const nowIso = new Date().toISOString();

  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      await pool.query(
        `UPDATE email_jobs SET
          status = $1,
          attempts = COALESCE($2, attempts),
          next_attempt_at = COALESCE($3, next_attempt_at),
          error_message = $4,
          updated_at = $5
         WHERE id = $6`,
        [
          status,
          details?.attempts ?? null,
          details?.nextAttemptAt ? new Date(details.nextAttemptAt) : null,
          details?.errorMessage ?? null,
          nowIso,
          jobId,
        ]
      );
      return;
    } catch (err: any) {
      console.warn('[Email DB] PG updateEmailJobStatus warning:', err?.message);
    }
  }

  try {
    const db = await getSqliteDb();
    db.run(
      `UPDATE email_jobs SET
        status = ?,
        attempts = CASE WHEN ? IS NOT NULL THEN ? ELSE attempts END,
        next_attempt_at = CASE WHEN ? IS NOT NULL THEN ? ELSE next_attempt_at END,
        error_message = ?,
        updated_at = ?
       WHERE id = ?;`,
      [
        status,
        details?.attempts ?? null,
        details?.attempts ?? null,
        details?.nextAttemptAt ?? null,
        details?.nextAttemptAt ?? null,
        details?.errorMessage ?? null,
        nowIso,
        jobId,
      ]
    );
    saveSqliteDb(db);
  } catch (err: any) {
    console.warn('[Email DB] SQLite updateEmailJobStatus warning:', err?.message);
  }
}

export async function fetchEmailJobs(status?: string, limit = 50): Promise<EmailJobRecord[]> {
  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      const query = status
        ? `SELECT * FROM email_jobs WHERE status = $1 ORDER BY created_at DESC LIMIT $2`
        : `SELECT * FROM email_jobs ORDER BY created_at DESC LIMIT $1`;
      const params = status ? [status, limit] : [limit];
      const res = await pool.query(query, params);
      return res.rows.map((r) => ({
        ...r,
        payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
      }));
    } catch {
      return [];
    }
  }

  try {
    const db = await getSqliteDb();
    const query = status
      ? `SELECT id, email_type, recipient, subject, payload, status, attempts, max_attempts, next_attempt_at, error_message, dedupe_key, created_at, updated_at FROM email_jobs WHERE status = ? ORDER BY created_at DESC LIMIT ?;`
      : `SELECT id, email_type, recipient, subject, payload, status, attempts, max_attempts, next_attempt_at, error_message, dedupe_key, created_at, updated_at FROM email_jobs ORDER BY created_at DESC LIMIT ?;`;
    const params = status ? [status, limit] : [limit];
    const res = db.exec(query, params);
    if (res.length === 0 || res[0].values.length === 0) return [];

    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: any = {};
      cols.forEach((col, idx) => { obj[col] = row[idx]; });
      try { obj.payload = JSON.parse(obj.payload); } catch { obj.payload = {}; }
      return obj as EmailJobRecord;
    });
  } catch {
    return [];
  }
}

export async function retryFailedJobs(): Promise<number> {
  const nowIso = new Date().toISOString();
  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      const res = await pool.query(
        `UPDATE email_jobs SET status = 'queued', attempts = 0, next_attempt_at = $1, updated_at = $1 WHERE status = 'failed' RETURNING id;`,
        [nowIso]
      );
      return res.rowCount || 0;
    } catch {
      return 0;
    }
  }

  try {
    const db = await getSqliteDb();
    const countRes = db.exec("SELECT count(*) FROM email_jobs WHERE status = 'failed';");
    const count = countRes.length > 0 && countRes[0].values.length > 0 ? Number(countRes[0].values[0][0]) : 0;
    if (count > 0) {
      db.run("UPDATE email_jobs SET status = 'queued', attempts = 0, next_attempt_at = ?, updated_at = ? WHERE status = 'failed';", [nowIso, nowIso]);
      saveSqliteDb(db);
    }
    return count;
  } catch {
    return 0;
  }
}

// ============================================================================
// 3. PAYMENT SUBMISSIONS ("I'VE PAID" CLAIM FLOW)
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

  // 1. Verify code uniqueness
  const existing = await getPaymentSubmissionByMpesaCode(cleanCode);
  if (existing) {
    return {
      success: false,
      duplicate: true,
      error: `M-Pesa Transaction Code "${cleanCode}" has already been submitted for Order #${existing.order_id}. Duplicate payment claims are rejected.`,
    };
  }

  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      await pool.query(
        `INSERT INTO payment_submissions (id, order_id, mpesa_receipt_code, phone_number, amount_claimed, payment_method, status, admin_notes, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending_verification', $7, $8)`,
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
      if (err?.code === '23505') {
        return { success: false, duplicate: true, error: `M-Pesa code "${cleanCode}" has already been used.` };
      }
      return { success: false, error: err?.message || 'Failed to record payment submission' };
    }
  }

  // SQLite Fallback
  try {
    const db = await getSqliteDb();
    db.run(
      `INSERT INTO payment_submissions (id, order_id, mpesa_receipt_code, phone_number, amount_claimed, payment_method, status, admin_notes, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending_verification', ?, ?);`,
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
    saveSqliteDb(db);
    return { success: true, id };
  } catch (err: any) {
    if (String(err?.message || '').includes('UNIQUE') || String(err?.message || '').includes('constraint')) {
      return { success: false, duplicate: true, error: `M-Pesa code "${cleanCode}" is already in use.` };
    }
    return { success: false, error: err?.message || 'Failed to save payment claim' };
  }
}

export async function getPaymentSubmissionByMpesaCode(code: string): Promise<PaymentSubmissionRecord | null> {
  const cleanCode = code.trim().toUpperCase();

  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      const res = await pool.query(
        `SELECT id, order_id, mpesa_receipt_code, phone_number, amount_claimed, payment_method, status, admin_notes, submitted_at, verified_at, verified_by
         FROM payment_submissions WHERE UPPER(mpesa_receipt_code) = $1 LIMIT 1`,
        [cleanCode]
      );
      return (res.rows[0] as PaymentSubmissionRecord) || null;
    } catch {
      return null;
    }
  }

  try {
    const db = await getSqliteDb();
    const res = db.exec(
      "SELECT id, order_id, mpesa_receipt_code, phone_number, amount_claimed, payment_method, status, admin_notes, submitted_at, verified_at, verified_by FROM payment_submissions WHERE UPPER(mpesa_receipt_code) = ? LIMIT 1;",
      [cleanCode]
    );
    if (res.length === 0 || res[0].values.length === 0) return null;
    const row = res[0].values[0];
    const cols = res[0].columns;
    const obj: any = {};
    cols.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj as PaymentSubmissionRecord;
  } catch {
    return null;
  }
}

export async function getPaymentSubmissionsForOrder(orderId: string): Promise<PaymentSubmissionRecord[]> {
  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      const res = await pool.query(
        `SELECT id, order_id, mpesa_receipt_code, phone_number, amount_claimed, payment_method, status, admin_notes, submitted_at, verified_at, verified_by
         FROM payment_submissions WHERE order_id = $1 ORDER BY submitted_at DESC`,
        [orderId]
      );
      return res.rows as PaymentSubmissionRecord[];
    } catch {
      return [];
    }
  }

  try {
    const db = await getSqliteDb();
    const res = db.exec(
      "SELECT id, order_id, mpesa_receipt_code, phone_number, amount_claimed, payment_method, status, admin_notes, submitted_at, verified_at, verified_by FROM payment_submissions WHERE order_id = ? ORDER BY submitted_at DESC;",
      [orderId]
    );
    if (res.length === 0 || res[0].values.length === 0) return [];
    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: any = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj as PaymentSubmissionRecord;
    });
  } catch {
    return [];
  }
}

export async function getAllPendingPaymentSubmissions(): Promise<PaymentSubmissionRecord[]> {
  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      const res = await pool.query(
        `SELECT id, order_id, mpesa_receipt_code, phone_number, amount_claimed, payment_method, status, admin_notes, submitted_at, verified_at, verified_by
         FROM payment_submissions WHERE status = 'pending_verification' ORDER BY submitted_at ASC`
      );
      return res.rows as PaymentSubmissionRecord[];
    } catch {
      return [];
    }
  }

  try {
    const db = await getSqliteDb();
    const res = db.exec(
      "SELECT id, order_id, mpesa_receipt_code, phone_number, amount_claimed, payment_method, status, admin_notes, submitted_at, verified_at, verified_by FROM payment_submissions WHERE status = 'pending_verification' ORDER BY submitted_at ASC;"
    );
    if (res.length === 0 || res[0].values.length === 0) return [];
    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: any = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj as PaymentSubmissionRecord;
    });
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

  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      await pool.query(
        `UPDATE payment_submissions SET
          status = $1,
          verified_at = $2,
          verified_by = $3,
          admin_notes = COALESCE($4, admin_notes)
         WHERE id = $5`,
        [status, nowIso, details.verifiedBy, details.adminNotes || null, submissionId]
      );
      return;
    } catch (err: any) {
      console.warn('[Email DB] PG updatePaymentSubmissionStatus warning:', err?.message);
    }
  }

  try {
    const db = await getSqliteDb();
    db.run(
      `UPDATE payment_submissions SET
        status = ?,
        verified_at = ?,
        verified_by = ?,
        admin_notes = CASE WHEN ? IS NOT NULL THEN ? ELSE admin_notes END
       WHERE id = ?;`,
      [status, nowIso, details.verifiedBy, details.adminNotes || null, details.adminNotes || null, submissionId]
    );
    saveSqliteDb(db);
  } catch (err: any) {
    console.warn('[Email DB] SQLite updatePaymentSubmissionStatus warning:', err?.message);
  }
}

// ============================================================================
// 4. EMAIL PREFERENCES & OPT-OUTS
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

  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      const res = await pool.query(
        `SELECT id, email, allow_marketing, allow_review_requests, allow_abandoned_cart, allow_price_drop, unsubscribed_all, updated_at
         FROM email_preferences WHERE email = $1 LIMIT 1`,
        [cleanEmail]
      );
      if (res.rows.length > 0) {
        return {
          ...res.rows[0],
          allow_marketing: Boolean(res.rows[0].allow_marketing),
          allow_review_requests: Boolean(res.rows[0].allow_review_requests),
          allow_abandoned_cart: Boolean(res.rows[0].allow_abandoned_cart),
          allow_price_drop: Boolean(res.rows[0].allow_price_drop),
          unsubscribed_all: Boolean(res.rows[0].unsubscribed_all),
        };
      }
      return defaultPrefs;
    } catch {
      return defaultPrefs;
    }
  }

  try {
    const db = await getSqliteDb();
    const res = db.exec(
      "SELECT id, email, allow_marketing, allow_review_requests, allow_abandoned_cart, allow_price_drop, unsubscribed_all, updated_at FROM email_preferences WHERE email = ? LIMIT 1;",
      [cleanEmail]
    );
    if (res.length > 0 && res[0].values.length > 0) {
      const row = res[0].values[0];
      return {
        id: String(row[0]),
        email: String(row[1]),
        allow_marketing: Boolean(row[2]),
        allow_review_requests: Boolean(row[3]),
        allow_abandoned_cart: Boolean(row[4]),
        allow_price_drop: Boolean(row[5]),
        unsubscribed_all: Boolean(row[6]),
        updated_at: String(row[7]),
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

  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      await pool.query(
        `INSERT INTO email_preferences (id, email, allow_marketing, allow_review_requests, allow_abandoned_cart, allow_price_drop, unsubscribed_all, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (email) DO UPDATE SET
          allow_marketing = EXCLUDED.allow_marketing,
          allow_review_requests = EXCLUDED.allow_review_requests,
          allow_abandoned_cart = EXCLUDED.allow_abandoned_cart,
          allow_price_drop = EXCLUDED.allow_price_drop,
          unsubscribed_all = EXCLUDED.unsubscribed_all,
          updated_at = EXCLUDED.updated_at`,
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
      return;
    } catch (err: any) {
      console.warn('[Email DB] PG updateEmailPreferences warning:', err?.message);
    }
  }

  try {
    const db = await getSqliteDb();
    db.run(
      `INSERT INTO email_preferences (id, email, allow_marketing, allow_review_requests, allow_abandoned_cart, allow_price_drop, unsubscribed_all, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (email) DO UPDATE SET
        allow_marketing = excluded.allow_marketing,
        allow_review_requests = excluded.allow_review_requests,
        allow_abandoned_cart = excluded.allow_abandoned_cart,
        allow_price_drop = excluded.allow_price_drop,
        unsubscribed_all = excluded.unsubscribed_all,
        updated_at = excluded.updated_at;`,
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
    saveSqliteDb(db);
  } catch (err: any) {
    console.warn('[Email DB] SQLite updateEmailPreferences warning:', err?.message);
  }
}

// ============================================================================
// 5. SCHEDULED TASK EXECUTION DEDUPLICATION
// ============================================================================

export async function wasScheduledTaskExecuted(dedupeKey: string): Promise<boolean> {
  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      const res = await pool.query(
        `SELECT id FROM scheduled_task_logs WHERE dedupe_key = $1 AND status = 'success' LIMIT 1`,
        [dedupeKey]
      );
      return res.rows.length > 0;
    } catch {
      return false;
    }
  }

  try {
    const db = await getSqliteDb();
    const res = db.exec("SELECT id FROM scheduled_task_logs WHERE dedupe_key = ? AND status = 'success' LIMIT 1;", [dedupeKey]);
    return res.length > 0 && res[0].values.length > 0;
  } catch {
    return false;
  }
}

export async function recordScheduledTaskExecution(taskName: string, dedupeKey: string, details?: string): Promise<void> {
  const id = `task-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const nowIso = new Date().toISOString();

  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      await pool.query(
        `INSERT INTO scheduled_task_logs (id, task_name, dedupe_key, executed_at, status, details)
         VALUES ($1, $2, $3, $4, 'success', $5)
         ON CONFLICT (dedupe_key) DO UPDATE SET executed_at = EXCLUDED.executed_at, details = EXCLUDED.details`,
        [id, taskName, dedupeKey, nowIso, details || null]
      );
      return;
    } catch (err: any) {
      console.warn('[Email DB] PG recordScheduledTaskExecution warning:', err?.message);
    }
  }

  try {
    const db = await getSqliteDb();
    db.run(
      `INSERT INTO scheduled_task_logs (id, task_name, dedupe_key, executed_at, status, details)
       VALUES (?, ?, ?, ?, 'success', ?)
       ON CONFLICT (dedupe_key) DO UPDATE SET executed_at = excluded.executed_at, details = excluded.details;`,
      [id, taskName, dedupeKey, nowIso, details || null]
    );
    saveSqliteDb(db);
  } catch (err: any) {
    console.warn('[Email DB] SQLite recordScheduledTaskExecution warning:', err?.message);
  }
}

// Aliases and Scheduled Task Helpers
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
  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      // 1. Update main orders table
      await pool.query(
        `UPDATE orders SET
          payment_status = $1,
          payment_reference = COALESCE($2, payment_reference),
          payment_amount = COALESCE($3, payment_amount),
          payment_confirmed_at = COALESCE($4, payment_confirmed_at),
          payment_confirmed_by = COALESCE($5, payment_confirmed_by),
          payment_reminder_count = COALESCE($6, payment_reminder_count),
          last_payment_reminder_at = COALESCE($7, last_payment_reminder_at)
         WHERE id = $8`,
        [
          status,
          details?.paymentReference || null,
          details?.paymentAmount || null,
          details?.paymentConfirmedAt || (status === 'paid' ? nowIso : null),
          details?.paymentConfirmedBy || null,
          details?.paymentReminderCount ?? null,
          details?.lastPaymentReminderAt || null,
          orderId,
        ]
      ).catch(() => {});

      // 2. Also update customer_orders table if exists
      await pool.query(
        `UPDATE customer_orders SET
          payment_status = $1,
          payment_reference = COALESCE($2, payment_reference),
          payment_amount = COALESCE($3, payment_amount),
          payment_confirmed_at = COALESCE($4, payment_confirmed_at),
          payment_confirmed_by = COALESCE($5, payment_confirmed_by),
          payment_reminder_count = COALESCE($6, payment_reminder_count),
          last_payment_reminder_at = COALESCE($7, last_payment_reminder_at)
         WHERE id = $8`,
        [
          status,
          details?.paymentReference || null,
          details?.paymentAmount || null,
          details?.paymentConfirmedAt || (status === 'paid' ? nowIso : null),
          details?.paymentConfirmedBy || null,
          details?.paymentReminderCount ?? null,
          details?.lastPaymentReminderAt || null,
          orderId,
        ]
      ).catch(() => {});
      return;
    } catch (e: any) {
      console.warn('[Email DB] PG updateOrderPaymentStatus warning:', e?.message);
    }
  }

  try {
    const db = await getSqliteDb();
    // 1. Update main orders table
    try {
      db.run(
        `UPDATE orders SET
          paymentStatus = ?,
          paymentReference = CASE WHEN ? IS NOT NULL THEN ? ELSE paymentReference END,
          paymentAmount = CASE WHEN ? IS NOT NULL THEN ? ELSE paymentAmount END,
          paymentConfirmedAt = CASE WHEN ? IS NOT NULL THEN ? ELSE paymentConfirmedAt END,
          paymentConfirmedBy = CASE WHEN ? IS NOT NULL THEN ? ELSE paymentConfirmedBy END,
          paymentReminderCount = CASE WHEN ? IS NOT NULL THEN ? ELSE paymentReminderCount END,
          lastPaymentReminderAt = CASE WHEN ? IS NOT NULL THEN ? ELSE lastPaymentReminderAt END
         WHERE id = ?;`,
        [
          status,
          details?.paymentReference || null,
          details?.paymentReference || null,
          details?.paymentAmount || null,
          details?.paymentAmount || null,
          details?.paymentConfirmedAt || (status === 'paid' ? nowIso : null),
          details?.paymentConfirmedAt || (status === 'paid' ? nowIso : null),
          details?.paymentConfirmedBy || null,
          details?.paymentConfirmedBy || null,
          details?.paymentReminderCount ?? null,
          details?.paymentReminderCount ?? null,
          details?.lastPaymentReminderAt || null,
          details?.lastPaymentReminderAt || null,
          orderId,
        ]
      );
    } catch (err1) {}

    // 2. Update customer_orders table
    try {
      db.run(
        `UPDATE customer_orders SET
          payment_status = ?,
          payment_reference = CASE WHEN ? IS NOT NULL THEN ? ELSE payment_reference END,
          payment_amount = CASE WHEN ? IS NOT NULL THEN ? ELSE payment_amount END,
          payment_confirmed_at = CASE WHEN ? IS NOT NULL THEN ? ELSE payment_confirmed_at END,
          payment_confirmed_by = CASE WHEN ? IS NOT NULL THEN ? ELSE payment_confirmed_by END,
          payment_reminder_count = CASE WHEN ? IS NOT NULL THEN ? ELSE payment_reminder_count END,
          last_payment_reminder_at = CASE WHEN ? IS NOT NULL THEN ? ELSE last_payment_reminder_at END
         WHERE id = ?;`,
        [
          status,
          details?.paymentReference || null,
          details?.paymentReference || null,
          details?.paymentAmount || null,
          details?.paymentAmount || null,
          details?.paymentConfirmedAt || (status === 'paid' ? nowIso : null),
          details?.paymentConfirmedAt || (status === 'paid' ? nowIso : null),
          details?.paymentConfirmedBy || null,
          details?.paymentConfirmedBy || null,
          details?.paymentReminderCount ?? null,
          details?.paymentReminderCount ?? null,
          details?.lastPaymentReminderAt || null,
          details?.lastPaymentReminderAt || null,
          orderId,
        ]
      );
    } catch (err2) {}

    saveSqliteDb(db);
  } catch (e: any) {
    console.warn('[Email DB] SQLite updateOrderPaymentStatus warning:', e?.message);
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
  const customerPhone = row.phone || row.customerPhone || row.customer_phone || row.mpesaPhone || '';
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
 * Fetches an order authoritatively from Postgres or SQLite across both orders and customer_orders tables
 */
export async function fetchAuthoritativeOrderById(orderId: string): Promise<any | null> {
  if (!orderId) return null;
  const cleanId = String(orderId).trim();

  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      const res1 = await pool.query(`SELECT * FROM orders WHERE UPPER(id) = UPPER($1) LIMIT 1`, [cleanId]);
      if (res1.rows.length > 0) return normalizeOrderRecord(res1.rows[0]);

      const res2 = await pool.query(`SELECT * FROM customer_orders WHERE UPPER(id) = UPPER($1) LIMIT 1`, [cleanId]);
      if (res2.rows.length > 0) return normalizeOrderRecord(res2.rows[0]);
    } catch {
      // Fall through to SQLite
    }
  }

  try {
    const db = await getSqliteDb();
    
    // 1. Try orders table
    try {
      const res1 = db.exec("SELECT * FROM orders WHERE UPPER(id) = UPPER(?) LIMIT 1;", [cleanId]);
      if (res1.length > 0 && res1[0].values.length > 0) {
        const cols = res1[0].columns;
        const obj: any = {};
        cols.forEach((c, idx) => { obj[c] = res1[0].values[0][idx]; });
        return normalizeOrderRecord(obj);
      }
    } catch {}

    // 2. Try customer_orders table
    try {
      const res2 = db.exec("SELECT * FROM customer_orders WHERE UPPER(id) = UPPER(?) LIMIT 1;", [cleanId]);
      if (res2.length > 0 && res2[0].values.length > 0) {
        const cols = res2[0].columns;
        const obj: any = {};
        cols.forEach((c, idx) => { obj[c] = res2[0].values[0][idx]; });
        return normalizeOrderRecord(obj);
      }
    } catch {}

    return null;
  } catch {
    return null;
  }
}

export async function getUnpaidOrders(olderThanHours = 0): Promise<any[]> {
  const thresholdIso = new Date(Date.now() - olderThanHours * 3600 * 1000).toISOString();
  const resultMap = new Map<string, any>();

  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      const res1 = await pool.query(
        `SELECT * FROM orders
         WHERE (payment_status = 'unpaid' OR payment_status IS NULL)
           AND status NOT IN ('cancelled', 'completed', 'delivered')
           AND created_at <= $1
         ORDER BY created_at ASC`,
        [thresholdIso]
      );
      for (const r of res1.rows) {
        const norm = normalizeOrderRecord(r);
        if (norm && !resultMap.has(norm.id)) resultMap.set(norm.id, norm);
      }
    } catch {}

    try {
      const res2 = await pool.query(
        `SELECT * FROM customer_orders
         WHERE (payment_status = 'unpaid' OR payment_status IS NULL)
           AND status NOT IN ('cancelled', 'completed', 'delivered')
           AND created_at <= $1
         ORDER BY created_at ASC`,
        [thresholdIso]
      );
      for (const r of res2.rows) {
        const norm = normalizeOrderRecord(r);
        if (norm && !resultMap.has(norm.id)) resultMap.set(norm.id, norm);
      }
    } catch {}

    if (resultMap.size > 0) return Array.from(resultMap.values());
  }

  try {
    const db = await getSqliteDb();

    // 1. Query orders table (Web store orders)
    try {
      const res1 = db.exec(
        `SELECT id, customerName, customerEmail, total, status,
                COALESCE(paymentStatus, 'unpaid') as paymentStatus,
                COALESCE(paymentReminderCount, 0) as paymentReminderCount,
                lastPaymentReminderAt,
                date, items, shippingAddress
         FROM orders
         WHERE (paymentStatus = 'unpaid' OR paymentStatus IS NULL)
           AND status NOT IN ('cancelled', 'completed', 'delivered')
           AND date <= ?
         ORDER BY date ASC;`,
        [thresholdIso]
      );
      if (res1.length > 0 && res1[0].values.length > 0) {
        const cols = res1[0].columns;
        for (const val of res1[0].values) {
          const obj: any = {};
          cols.forEach((c, idx) => { obj[c] = val[idx]; });
          const norm = normalizeOrderRecord(obj);
          if (norm && !resultMap.has(norm.id)) resultMap.set(norm.id, norm);
        }
      }
    } catch (e1) {
      console.warn('[Email DB] getUnpaidOrders orders query note:', e1);
    }

    // 2. Query customer_orders table (POS / ledger orders)
    try {
      const res2 = db.exec(
        `SELECT id, customer_name, customer_email, total, status,
                payment_status, payment_reminder_count, last_payment_reminder_at,
                COALESCE(created_at, placed_at) as created_at
         FROM customer_orders
         WHERE (payment_status = 'unpaid' OR payment_status IS NULL)
           AND status NOT IN ('cancelled', 'completed', 'delivered')
           AND (created_at <= ? OR placed_at <= ?);`,
        [thresholdIso, thresholdIso]
      );
      if (res2.length > 0 && res2[0].values.length > 0) {
        const cols = res2[0].columns;
        for (const val of res2[0].values) {
          const obj: any = {};
          cols.forEach((c, idx) => { obj[c] = val[idx]; });
          const norm = normalizeOrderRecord(obj);
          if (norm && !resultMap.has(norm.id)) resultMap.set(norm.id, norm);
        }
      }
    } catch (e2) {
      console.warn('[Email DB] getUnpaidOrders customer_orders query note:', e2);
    }

    return Array.from(resultMap.values());
  } catch {
    return [];
  }
}

export async function hasUnprocessedPaymentSubmission(orderId: string): Promise<boolean> {
  if (isPostgresActive()) {
    const pool = getPostgresPool()!;
    try {
      const res = await pool.query(
        `SELECT id FROM payment_submissions WHERE order_id = $1 AND status = 'pending_verification' LIMIT 1`,
        [orderId]
      );
      return res.rows.length > 0;
    } catch {
      return false;
    }
  }

  try {
    const db = await getSqliteDb();
    const res = db.exec(
      "SELECT id FROM payment_submissions WHERE order_id = ? AND status = 'pending_verification' LIMIT 1;",
      [orderId]
    );
    return res.length > 0 && res[0].values.length > 0;
  } catch {
    return false;
  }
}

