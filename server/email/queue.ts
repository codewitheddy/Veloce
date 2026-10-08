/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  enqueueEmailJob,
  fetchDueEmailJobs,
  updateEmailJobStatus,
  logEmail,
  isRecipientOptedOut,
  EmailJobRecord,
} from './db';
import { sendEmail } from './transporter';
import * as templates from './templates';

const BACKOFF_SECONDS = [30, 120, 600, 1800, 7200];

let isWorkerRunning = false;
let workerTimer: NodeJS.Timeout | null = null;
let isProcessingBatch = false;

/**
 * Calculates next attempt ISO string based on attempt count
 */
function calculateNextRetry(attempts: number): string {
  const index = Math.min(Math.max(0, attempts - 1), BACKOFF_SECONDS.length - 1);
  const delaySec = BACKOFF_SECONDS[index];
  return new Date(Date.now() + delaySec * 1000).toISOString();
}

/**
 * Resolves rendered HTML, text, and subject for a given job
 */
function renderJobContent(job: EmailJobRecord): { subject: string; html: string; text: string } {
  const payload = job.payload || {};

  switch (job.email_type) {
    // Account templates
    case 'welcome':
      return templates.renderWelcomeEmail(payload);
    case 'verify_email':
      return templates.renderVerifyEmail(payload);
    case 'password_reset':
      return templates.renderPasswordResetEmail(payload);
    case 'password_changed':
      return templates.renderPasswordChangedEmail(payload);

    // Order templates
    case 'order_confirmation':
      return templates.renderOrderConfirmationEmail(payload);
    case 'paybill_instructions':
      return templates.renderPaybillInstructionsEmail(payload);
    case 'payment_submission_received':
      return templates.renderPaymentSubmissionReceivedEmail(payload);
    case 'payment_receipt':
      return templates.renderPaymentReceiptEmail(payload);
    case 'payment_reminder':
      return templates.renderPaymentReminderEmail(payload);
    case 'payment_issue':
      return templates.renderPaymentIssueEmail(payload);
    case 'order_shipped':
      return templates.renderOrderShippedEmail(payload);
    case 'order_delivered':
      return templates.renderOrderDeliveredEmail(payload);
    case 'order_cancelled':
      return templates.renderOrderCancelledEmail(payload);
    case 'refund_processed':
      return templates.renderRefundProcessedEmail(payload);

    // Admin templates
    case 'admin_new_order':
      return templates.renderAdminNewOrderEmail(payload);
    case 'admin_payment_submitted':
      return templates.renderAdminPaymentSubmissionEmail(payload);
    case 'admin_payment_digest':
      return templates.renderAdminPaymentDigestEmail(payload);
    case 'admin_return_request':
      return templates.renderAdminReturnRequestEmail(payload);
    case 'admin_low_stock':
      return templates.renderAdminLowStockEmail(payload);

    // Engagement
    case 'review_request':
      return templates.renderReviewRequestEmail(payload);
    case 'abandoned_cart':
      return templates.renderAbandonedCartEmail(payload);

    // Direct / pre-rendered fallback
    default:
      return {
        subject: job.subject || payload.subject || 'Notification from Ropenix Collections',
        html: payload.html || `<p>${payload.text || 'Notification'}</p>`,
        text: payload.text || 'Notification',
      };
  }
}

/**
 * Processes a single email job with preference check, rate limiting, and backoff
 */
export async function processJob(job: EmailJobRecord): Promise<boolean> {
  const currentAttempts = (job.attempts || 0) + 1;

  try {
    // 1. Check opt-out preference for non-essential transactional emails
    const optedOut = await isRecipientOptedOut(job.recipient, job.email_type);
    if (optedOut) {
      console.log(`[Email Queue] 🛑 Recipient ${job.recipient} opted out of ${job.email_type}. Skipping job ${job.id}.`);
      await updateEmailJobStatus(job.id, 'sent', { errorMessage: 'Skipped: recipient opted out' });
      await logEmail({
        recipient: job.recipient,
        email_type: job.email_type,
        subject: job.subject,
        status: 'skipped_opt_out',
        attempts: currentAttempts,
        related_order_id: job.payload?.id || job.payload?.orderId,
        dedupe_key: job.dedupe_key,
      });
      return true;
    }

    // 2. Mark job as sending
    await updateEmailJobStatus(job.id, 'sending', { attempts: currentAttempts });

    // 3. Render template
    const rendered = renderJobContent(job);

    // 4. Send via Nodemailer transporter
    const sendResult = await sendEmail({
      to: job.recipient,
      subject: rendered.subject || job.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: job.payload?.replyTo,
    });

    if (sendResult.success) {
      await updateEmailJobStatus(job.id, 'sent', { attempts: currentAttempts });
      await logEmail({
        recipient: job.recipient,
        email_type: job.email_type,
        subject: rendered.subject || job.subject,
        status: 'sent',
        attempts: currentAttempts,
        related_order_id: job.payload?.id || job.payload?.orderId,
        dedupe_key: job.dedupe_key,
        sent_at: new Date().toISOString(),
      });
      console.log(`[Email Queue] ✅ Sent ${job.email_type} to ${job.recipient} (Job: ${job.id})`);
      return true;
    } else {
      throw new Error(sendResult.error || 'Nodemailer returned failure');
    }
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.warn(`[Email Queue] ⚠️ Failed attempt ${currentAttempts}/${job.max_attempts} for job ${job.id} (${job.email_type} -> ${job.recipient}): ${errorMsg}`);

    if (currentAttempts >= job.max_attempts) {
      // Reached max retries - mark as failed
      await updateEmailJobStatus(job.id, 'failed', {
        attempts: currentAttempts,
        errorMessage: errorMsg,
      });
      await logEmail({
        recipient: job.recipient,
        email_type: job.email_type,
        subject: job.subject,
        status: 'failed',
        attempts: currentAttempts,
        error_message: errorMsg,
        related_order_id: job.payload?.id || job.payload?.orderId,
        dedupe_key: job.dedupe_key,
      });
    } else {
      // Schedule exponential backoff retry
      const nextRetryIso = calculateNextRetry(currentAttempts);
      await updateEmailJobStatus(job.id, 'queued', {
        attempts: currentAttempts,
        nextAttemptAt: nextRetryIso,
        errorMessage: errorMsg,
      });
    }

    return false;
  }
}

/**
 * Polls and processes one batch of due jobs
 */
export async function processQueueBatch(limit = 5): Promise<number> {
  if (isProcessingBatch) return 0;
  isProcessingBatch = true;

  try {
    const jobs = await fetchDueEmailJobs(limit);
    if (jobs.length === 0) return 0;

    let successCount = 0;
    for (const job of jobs) {
      const ok = await processJob(job);
      if (ok) successCount++;
    }
    return successCount;
  } catch (err) {
    console.error('[Email Queue Worker] Batch processing error:', err);
    return 0;
  } finally {
    isProcessingBatch = false;
  }
}

/**
 * Starts the continuous background queue worker
 */
export function startEmailQueueWorker(pollIntervalMs = 4000): void {
  if (isWorkerRunning) return;
  isWorkerRunning = true;
  console.log('[Email Queue Worker] 🚀 Background queue processor started.');

  // Immediate first run
  processQueueBatch().catch(() => {});

  workerTimer = setInterval(() => {
    processQueueBatch().catch(() => {});
  }, pollIntervalMs);
}

/**
 * Stops the queue worker gracefully
 */
export function stopEmailQueueWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
  isWorkerRunning = false;
  console.log('[Email Queue Worker] 🛑 Background queue processor stopped.');
}

/**
 * Helper to enqueue an email job directly and trigger immediate processing
 */
export async function enqueueEmail(options: {
  emailType: string;
  recipient: string;
  subject: string;
  payload: any;
  dedupeKey?: string;
  delaySeconds?: number;
  maxAttempts?: number;
}): Promise<string | null> {
  const res = await enqueueEmailJob(options);
  if (!options.delaySeconds || options.delaySeconds <= 0) {
    setImmediate(() => {
      processQueueBatch().catch(() => {});
    });
  }
  return res;
}
