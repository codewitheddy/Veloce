/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getEmailConfig } from './config';
import {
  getUnpaidOrders,
  hasUnprocessedPaymentSubmission,
  hasScheduledTaskRun,
  logScheduledTaskRun,
  updateOrderPaymentStatus,
  getDbPool,
} from './db';
import { enqueueEmail } from './queue';
import { emailEvents } from './events';
import { formatKES } from './urlHelper';

let schedulerInterval: NodeJS.Timeout | null = null;
let isSchedulerRunning = false;
let isExecutingCron = false;

/**
 * Returns current Date components in Africa/Nairobi timezone (UTC+3)
 */
function getNairobiTime(): {
  dateStr: string; // YYYY-MM-DD
  hour: number;    // 0-23
  minute: number;  // 0-59
  fullStr: string;
} {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = parseInt(getPart('hour'), 10);
  const minute = parseInt(getPart('minute'), 10);

  return {
    dateStr: `${year}-${month}-${day}`,
    hour,
    minute,
    fullStr: `${year}-${month}-${day} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} EAT`,
  };
}

/**
 * Fetches all pending unverified payment submissions from DB
 */
async function getPendingPaymentSubmissions(): Promise<any[]> {
  try {
    const pool = await getDbPool();
    const [rows]: any = await pool.query(`
      SELECT ps.id, ps.order_id as orderId, ps.mpesa_receipt_code as mpesaCode, ps.amount_claimed as amount, ps.phone_number, ps.submitted_at as submittedAt,
             o.customer_name as customerName, o.customer_email as customerEmail, o.total
      FROM payment_submissions ps
      LEFT JOIN customer_orders o ON o.id = ps.order_id
      WHERE ps.status = 'pending_verification'
      ORDER BY ps.submitted_at ASC
    `);
    return rows || [];
  } catch {
    return [];
  }
}

/**
 * 1. Process Admin Daily Payment Digests (08:00 EAT and 17:00 EAT)
 */
async function processDailyDigest(nairobiTime: ReturnType<typeof getNairobiTime>): Promise<void> {
  const config = getEmailConfig();
  if (!config.admin.email) return;

  const isMorningSlot = nairobiTime.hour === 8 && nairobiTime.minute <= 5;
  const isEveningSlot = nairobiTime.hour === 17 && nairobiTime.minute <= 5;

  if (!isMorningSlot && !isEveningSlot) return;

  const slot = isMorningSlot ? 'morning' : 'evening';
  const taskKey = `admin_digest_${slot}_${nairobiTime.dateStr}`;

  if (await hasScheduledTaskRun(taskKey)) return;

  try {
    const pendingSubmissions = await getPendingPaymentSubmissions();
    const unpaidOrders = await getUnpaidOrders(1); // unpaid orders older than 1 hour

    const unpaidFormatted = unpaidOrders.map((u) => {
      const created = new Date(u.created_at).getTime();
      const hoursUnpaid = Math.max(1, Math.round((Date.now() - created) / 3600000));
      return {
        orderId: u.id,
        customerName: u.customer_name || 'Customer',
        total: u.total || 0,
        createdAt: u.created_at,
        hoursUnpaid,
      };
    });

    await enqueueEmail({
      emailType: 'admin_payment_digest',
      recipient: config.admin.email,
      subject: `📊 [DIGEST ${slot === 'morning' ? '08:00 EAT' : '17:00 EAT'}] ${pendingSubmissions.length} Pending Payments, ${unpaidFormatted.length} Unpaid Orders`,
      payload: {
        slot,
        pendingSubmissions,
        unpaidOrders: unpaidFormatted,
      },
      dedupeKey: taskKey,
    });

    await logScheduledTaskRun(taskKey, {
      slot,
      date: nairobiTime.dateStr,
      pendingCount: pendingSubmissions.length,
      unpaidCount: unpaidFormatted.length,
    });

    console.log(`[Scheduler] 📧 Enqueued daily ${slot} payment digest to ${config.admin.email}`);
  } catch (err) {
    console.error(`[Scheduler] Error running daily ${slot} digest:`, err);
  }
}

/**
 * 2. Process Payment Reminders for Unpaid Orders (+12h and +24h)
 */
async function processPaymentReminders(): Promise<void> {
  try {
    const unpaidOrders = await getUnpaidOrders(12); // placed >= 12h ago

    for (const order of unpaidOrders) {
      // CRITICAL: Skip if customer has already submitted a payment claim awaiting verification
      const hasClaim = await hasUnprocessedPaymentSubmission(order.id);
      if (hasClaim) {
        continue;
      }

      const orderEmail = order.customerEmail || order.customer_email;
      if (!orderEmail) continue;

      const customerName = order.customerName || order.customer_name || 'Customer';
      const createdDateStr = order.createdAt || order.created_at || order.date;
      const created = createdDateStr ? new Date(createdDateStr).getTime() : Date.now();
      const hoursAgo = (Date.now() - created) / 3600000;
      const currentReminderCount = order.paymentReminderCount || order.payment_reminder_count || 0;
      const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;

      // Reminder 1: 12h to 24h
      if (hoursAgo >= 12 && hoursAgo < 24 && currentReminderCount === 0) {
        await enqueueEmail({
          emailType: 'payment_reminder',
          recipient: orderEmail,
          subject: `Friendly Reminder: Complete Payment for Order ${shortId}`,
          payload: {
            ...order,
            id: order.id,
            customerName,
            customerEmail: orderEmail,
            total: Number(order.total || 0),
            reminderNumber: 1,
          },
          dedupeKey: `payment_reminder_1:${order.id}`,
        });

        await updateOrderPaymentStatus(order.id, 'unpaid', {
          paymentReminderCount: 1,
          lastPaymentReminderAt: new Date().toISOString(),
        });
      }

      // Reminder 2: >= 24h
      else if (hoursAgo >= 24 && currentReminderCount === 1) {
        await enqueueEmail({
          emailType: 'payment_reminder',
          recipient: orderEmail,
          subject: `⚠️ Final Notice: Complete Payment for Order ${shortId}`,
          payload: {
            ...order,
            id: order.id,
            customerName,
            customerEmail: orderEmail,
            total: Number(order.total || 0),
            reminderNumber: 2,
          },
          dedupeKey: `payment_reminder_2:${order.id}`,
        });

        await updateOrderPaymentStatus(order.id, 'unpaid', {
          paymentReminderCount: 2,
          lastPaymentReminderAt: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error processing payment reminders:', err);
  }
}

/**
 * 3. Process Auto-cancellation for Unpaid Orders Past Deadline
 */
async function processAutoCancellations(): Promise<void> {
  const config = getEmailConfig();
  if (!config.schedule.autoCancelUnpaidHours || config.schedule.autoCancelUnpaidHours <= 0) return;

  const cancelThresholdHours = config.schedule.autoCancelUnpaidHours;

  try {
    const overdueOrders = await getUnpaidOrders(cancelThresholdHours);

    for (const order of overdueOrders) {
      // CRITICAL: STRICTLY SKIP any order with a pending payment claim
      const hasClaim = await hasUnprocessedPaymentSubmission(order.id);
      if (hasClaim) {
        continue;
      }

      console.log(`[Scheduler] 🛑 Auto-cancelling overdue unpaid order ${order.id} (placed > ${cancelThresholdHours}h ago without payment claim)`);

      // Cancel order
      await updateOrderPaymentStatus(order.id, 'cancelled', {
        notes: `Auto-cancelled by system after ${cancelThresholdHours} hours without payment.`,
      });

      // Emit cancellation event
      emailEvents.emit('order:cancelled', {
        ...order,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        cancellationReason: `Order automatically cancelled after ${cancelThresholdHours} hours without payment receipt.`,
      });
    }
  } catch (err) {
    console.error('[Scheduler] Error processing auto-cancellations:', err);
  }
}

/**
 * Runs one tick of the Nairobi-time scheduler
 */
export async function runSchedulerTick(): Promise<void> {
  if (isExecutingCron) return;
  isExecutingCron = true;

  try {
    const nairobiTime = getNairobiTime();

    // 1. Daily digests at 08:00 & 17:00 EAT
    await processDailyDigest(nairobiTime);

    // 2. Unpaid payment reminders
    await processPaymentReminders();

    // 3. Auto-cancellations of overdue orders
    await processAutoCancellations();
  } catch (err) {
    console.error('[Scheduler] Tick execution error:', err);
  } finally {
    isExecutingCron = false;
  }
}

/**
 * Starts the Nairobi-time background scheduler
 */
export function startEmailScheduler(intervalMs = 60000): void {
  if (isSchedulerRunning) return;
  isSchedulerRunning = true;
  console.log('[Scheduler] ⏰ Africa/Nairobi transactional scheduler started.');

  // Immediate initial tick
  runSchedulerTick().catch(() => {});

  schedulerInterval = setInterval(() => {
    runSchedulerTick().catch(() => {});
  }, intervalMs);
}

/**
 * Stops the scheduler
 */
export function stopEmailScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  isSchedulerRunning = false;
  console.log('[Scheduler] 🛑 Africa/Nairobi transactional scheduler stopped.');
}
