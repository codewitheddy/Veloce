/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Review Reminder Automated Runner Service
 * 
 * Requirements:
 * 1. Counts reminder days (REVIEW_REMINDER_DAYS) from the order's creation date.
 * 2. If the order is not yet delivered/completed, skips it WITHOUT marking review_reminder_sent_at
 *    so it is automatically picked up on a subsequent run once delivered.
 * 3. Claims orders one at a time via atomic UPDATE:
 *    UPDATE orders SET review_reminder_sent_at = NOW() WHERE id = ? AND review_reminder_sent_at IS NULL
 *    Sends ONLY if affectedRows = 1.
 * 4. Resets review_reminder_sent_at = NULL on send failure so it can be retried.
 * 5. Respects users.marketing_emails_opt_out.
 * 6. Includes unsubscribe link in email.
 * 7. Rate-limits sending with an inter-email delay to respect shared-hosting SMTP limits.
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import { getDbPool, getMysqlOrderItemsByOrderId } from '../../src/lib/mysql-db';
import { renderReviewRequestEmail } from '../email/templates/engagementTemplates';
import { sendRawMail } from '../email/transporter';
import { buildUrl } from '../email/urlHelper';

dotenv.config();

export interface ReminderRunnerOptions {
  days?: number;
  batchSize?: number;
  delayMs?: number;
  dryRun?: boolean;
  dbName?: string;
}

export interface ReminderRunnerStats {
  inspectedOrders: number;
  eligibleOrders: number;
  claimedOrders: number;
  sentReminders: number;
  skippedNotDelivered: number;
  skippedOptedOut: number;
  skippedIneligibleStatus: number;
  failedDeliveries: number;
  claimedAndResetOrders: number;
  errors: Array<{ orderId: string; error: string }>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function processReviewReminders(options: ReminderRunnerOptions = {}): Promise<ReminderRunnerStats> {
  const reminderDays = Math.max(1, options.days || Number(process.env.REVIEW_REMINDER_DAYS) || 7);
  const batchSize = Math.max(1, Math.min(100, options.batchSize || Number(process.env.REMINDER_BATCH_SIZE) || 25));
  const delayMs = options.delayMs !== undefined ? options.delayMs : (Number(process.env.REMINDER_DELAY_MS) || 1500);
  const dryRun = Boolean(options.dryRun);

  console.log(`\n=========================================================`);
  console.log(`[Review Reminders] Starting reminder runner`);
  console.log(`[Review Reminders] Mode: ${dryRun ? 'DRY-RUN (No emails/writes)' : 'LIVE'}`);
  console.log(`[Review Reminders] Reminder threshold: ${reminderDays} days from purchase date`);
  console.log(`[Review Reminders] Batch limit: ${batchSize} orders | Delay: ${delayMs}ms`);
  console.log(`=========================================================`);

  const pool = await getDbPool();

  const stats: ReminderRunnerStats = {
    inspectedOrders: 0,
    eligibleOrders: 0,
    claimedOrders: 0,
    sentReminders: 0,
    skippedNotDelivered: 0,
    skippedOptedOut: 0,
    skippedIneligibleStatus: 0,
    failedDeliveries: 0,
    claimedAndResetOrders: 0,
    errors: [],
  };

  // 1. Fetch candidate orders whose creation date is at least `reminderDays` old
  //    and review_reminder_sent_at IS NULL
  const [candidateOrders]: any = await pool.query(
    `SELECT o.id, o.customerName, o.customerEmail, o.customerPhone, o.items, o.total,
            o.status, o.date, o.deliveryConfirmed, o.deliveredAt, o.created_at,
            u.marketing_emails_opt_out, u.id as user_id
     FROM orders o
     LEFT JOIN users u ON (LOWER(u.email) = LOWER(o.customerEmail))
     WHERE o.review_reminder_sent_at IS NULL
       AND (
         (o.created_at IS NOT NULL AND o.created_at <= DATE_SUB(NOW(), INTERVAL ? DAY))
         OR (o.created_at IS NULL AND o.date <= DATE_SUB(NOW(), INTERVAL ? DAY))
       )
     ORDER BY o.created_at ASC
     LIMIT ?`,
    [reminderDays, reminderDays, batchSize]
  );

  stats.inspectedOrders = candidateOrders?.length || 0;
  console.log(`[Review Reminders] Candidate orders found: ${stats.inspectedOrders}`);

  if (stats.inspectedOrders === 0) {
    console.log(`[Review Reminders] No pending orders match the ${reminderDays}-day reminder window.`);
    return stats;
  }

  const appBaseUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'https://ropenix.co.ke';

  for (const order of candidateOrders) {
    const orderId = String(order.id);
    const orderStatus = String(order.status || '').toLowerCase();

    // 2. Filter out ineligible statuses (cancelled, canceled, refunded)
    if (orderStatus === 'cancelled' || orderStatus === 'canceled' || orderStatus === 'refunded') {
      stats.skippedIneligibleStatus++;
      // Mark as processed so we don't query it again, but do NOT send email
      if (!dryRun) {
        await pool.query(
          `UPDATE orders SET review_reminder_sent_at = NOW() WHERE id = ? AND review_reminder_sent_at IS NULL`,
          [orderId]
        );
      }
      continue;
    }

    // 3. Delivery check: If order is NOT yet delivered/completed,
    //    SKIP WITHOUT marking review_reminder_sent_at so it is picked up once delivered!
    const isDelivered = orderStatus === 'completed' || Boolean(order.deliveryConfirmed) || Boolean(order.deliveredAt);
    if (!isDelivered) {
      stats.skippedNotDelivered++;
      console.log(`  - Order ${orderId}: Not delivered yet (status: ${order.status}). Skipped without marking reminder.`);
      continue;
    }

    // 4. Marketing opt-out check: If user has opted out, mark reminder as processed and skip email
    if (Boolean(order.marketing_emails_opt_out)) {
      stats.skippedOptedOut++;
      console.log(`  - Order ${orderId}: Customer <${order.customerEmail}> opted out of marketing emails. Skipped.`);
      if (!dryRun) {
        await pool.query(
          `UPDATE orders SET review_reminder_sent_at = NOW() WHERE id = ? AND review_reminder_sent_at IS NULL`,
          [orderId]
        );
      }
      continue;
    }

    stats.eligibleOrders++;

    if (dryRun) {
      console.log(`  - [DRY-RUN] Would claim Order ${orderId} and send reminder to <${order.customerEmail}>.`);
      stats.sentReminders++;
      continue;
    }

    // 5. Claim order atomically: UPDATE orders SET review_reminder_sent_at = NOW() WHERE id = ? AND review_reminder_sent_at IS NULL
    const [claimResult]: any = await pool.query(
      `UPDATE orders SET review_reminder_sent_at = NOW() WHERE id = ? AND review_reminder_sent_at IS NULL`,
      [orderId]
    );

    if (!claimResult || claimResult.affectedRows !== 1) {
      console.log(`  - Order ${orderId}: Already claimed by concurrent worker. Skipped.`);
      continue;
    }

    stats.claimedOrders++;

    // 6. Retrieve order items for deep link
    let orderItems = await getMysqlOrderItemsByOrderId(orderId);
    if (!orderItems || orderItems.length === 0) {
      try {
        orderItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      } catch (_) {
        orderItems = [];
      }
    }

    const firstItem = orderItems && orderItems.length > 0 ? orderItems[0] : null;
    const firstItemId = firstItem ? (firstItem.id || `oi_${orderId}_0`) : '0';

    const customerEmail = String(order.customerEmail || '').trim().toLowerCase();
    const unsubscribeUrl = `${appBaseUrl}/api/marketing/unsubscribe?email=${encodeURIComponent(customerEmail)}`;
    const reviewDeepLink = `${appBaseUrl}/orders/${orderId}/review/${firstItemId}`;

    // 7. Render and send reminder email
    try {
      const emailContent = renderReviewRequestEmail({
        id: orderId,
        customerName: order.customerName || 'Valued Customer',
        customerEmail,
        total: Number(order.total || 0),
        createdAt: order.created_at || order.date || new Date().toISOString(),
        items: (orderItems || []).map((it: any) => ({
          name: it.name || 'Ordered Product',
          price: Number(it.price || 0),
          quantity: Number(it.quantity || 1),
        })),
        reviewUrl: reviewDeepLink,
        unsubscribeUrl,
      });

      const sendRes = await sendRawMail({
        to: customerEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        category: 'marketing',
        listUnsubscribeUrl: unsubscribeUrl,
      });

      if (!sendRes.success) {
        throw new Error(sendRes.error || 'SMTP delivery reported failure');
      }

      stats.sentReminders++;
      console.log(`  ✅ Sent review reminder for Order ${orderId} to <${customerEmail}>.`);
    } catch (sendErr: any) {
      // 8. On send failure, RESET review_reminder_sent_at = NULL so it can be retried!
      stats.failedDeliveries++;
      stats.claimedAndResetOrders++;
      stats.errors.push({ orderId, error: sendErr.message || String(sendErr) });

      console.error(`  ❌ Failed to send reminder for Order ${orderId}: ${sendErr.message}`);
      await pool.query(
        `UPDATE orders SET review_reminder_sent_at = NULL WHERE id = ?`,
        [orderId]
      );
      console.log(`  🔄 Reset review_reminder_sent_at = NULL for Order ${orderId} for future retry.`);
    }

    // 9. Delay between emails to respect shared-hosting limits
    if (delayMs > 0) {
      await delay(delayMs);
    }
  }

  console.log(`\n[Review Reminders] Run complete:`);
  console.log(`  - Inspected candidate orders:  ${stats.inspectedOrders}`);
  console.log(`  - Eligible orders:             ${stats.eligibleOrders}`);
  console.log(`  - Skipped (not delivered yet): ${stats.skippedNotDelivered}`);
  console.log(`  - Skipped (marketing opt-out): ${stats.skippedOptedOut}`);
  console.log(`  - Sent reminders:              ${stats.sentReminders}`);
  console.log(`  - Failed & reset for retry:    ${stats.failedDeliveries}`);
  console.log(`=========================================================\n`);

  return stats;
}
