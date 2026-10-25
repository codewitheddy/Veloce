/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Standalone Production Review Reminder Cron Script (CommonJS / Plain Node)
 * 
 * Suitable for cPanel cron jobs:
 *   /usr/local/bin/node /home/username/public_html/scripts/send-review-reminders.cjs
 * 
 * Or with custom parameters:
 *   node scripts/send-review-reminders.cjs --days 7 --batch-size 25 --delay-ms 1500
 *   node scripts/send-review-reminders.cjs --dry-run
 */

const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
require('dotenv').config();

function getDbHost() {
  let host = (process.env.DB_HOST || '127.0.0.1').trim();
  if (host === 'localhhost' || host === 'localhost') host = '127.0.0.1';
  return host;
}

function getDbUser() {
  return (process.env.DB_USER || 'root').trim();
}

function getDbPassword() {
  return process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '';
}

function getDbName() {
  return (process.env.DB_NAME || 'ropenix').trim();
}

function getDbPort() {
  return Number(process.env.DB_PORT) || 3306;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMailTransporter() {
  const host = (process.env.SMTP_HOST || 'mail.ropenix.co.ke').trim();
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '').trim();
  const secure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : port === 465;

  if (!user || !pass) {
    // If SMTP credentials not provided, return a stub transporter that logs
    return {
      sendMail: async (mailOptions) => {
        console.log(`[SMTP Stub] Would send email to <${mailOptions.to}>: "${mailOptions.subject}"`);
        return { messageId: `stub-${Date.now()}` };
      },
    };
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

function renderReviewReminderHtml(data) {
  const { customerName, orderId, items, reviewUrl, unsubscribeUrl } = data;
  const itemsHtml = (items || [])
    .map(
      (it) =>
        `<tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-size: 14px;"><strong>${it.name || 'Ordered Item'}</strong></td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px; text-align: right;">Qty: ${it.quantity || 1}</td>
        </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>How was your recent purchase?</title>
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #0f172a;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Ropenix Collections</h1>
      <p style="margin: 8px 0 0; font-size: 15px; opacity: 0.9;">We would love your feedback!</p>
    </div>
    <div style="padding: 32px 24px;">
      <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">Hi ${customerName || 'Valued Customer'},</p>
      <p style="font-size: 15px; line-height: 1.6;">Thank you for your recent purchase (Order <strong>#${orderId}</strong>). We hope you are enjoying your items!</p>
      <p style="font-size: 15px; line-height: 1.6;">Could you take 60 seconds to share your experience? Your review helps other shoppers make informed decisions.</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        ${itemsHtml}
      </table>

      <div style="text-align: center; margin: 32px 0 24px;">
        <a href="${reviewUrl}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">
          Leave a Product Review ★★★★★
        </a>
      </div>

      <p style="font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5; margin: 24px 0 0;">
        You received this email because you made a purchase on Ropenix Collections.<br>
        If you prefer not to receive review reminders, you can 
        <a href="${unsubscribeUrl}" style="color: #6366f1; text-decoration: underline;">unsubscribe here</a>.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

async function processReviewReminders(options = {}) {
  const reminderDays = Math.max(1, options.days || Number(process.env.REVIEW_REMINDER_DAYS) || 7);
  const batchSize = Math.max(1, Math.min(100, options.batchSize || Number(process.env.REMINDER_BATCH_SIZE) || 25));
  const delayMs = options.delayMs !== undefined ? options.delayMs : (Number(process.env.REMINDER_DELAY_MS) || 1500);
  const dryRun = Boolean(options.dryRun);
  const targetDb = (options.dbName || getDbName()).trim();

  console.log(`\n=========================================================`);
  console.log(`[Review Reminders] Starting reminder runner on database: ${targetDb}`);
  console.log(`[Review Reminders] Mode: ${dryRun ? 'DRY-RUN (No writes / emails)' : 'LIVE EXECUTION'}`);
  console.log(`[Review Reminders] Reminder threshold: ${reminderDays} days from purchase date`);
  console.log(`[Review Reminders] Batch limit: ${batchSize} orders | Inter-email delay: ${delayMs}ms`);
  console.log(`=========================================================`);

  const pool = mysql.createPool({
    host: getDbHost(),
    user: getDbUser(),
    password: getDbPassword(),
    port: getDbPort(),
    database: targetDb,
    waitForConnections: true,
    connectionLimit: 4,
  });

  const transporter = createMailTransporter();
  const appBaseUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'https://ropenix.co.ke';
  const fromEmail = process.env.EMAIL_FROM || 'Ropenix Collections <support@ropenix.co.ke>';

  const stats = {
    database: targetDb,
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

  try {
    // 1. Fetch candidate orders whose creation date is at least `reminderDays` old
    //    and review_reminder_sent_at IS NULL
    const [candidateOrders] = await pool.query(
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

    stats.inspectedOrders = candidateOrders ? candidateOrders.length : 0;
    console.log(`[Review Reminders] Candidate orders found: ${stats.inspectedOrders}`);

    if (stats.inspectedOrders === 0) {
      console.log(`[Review Reminders] No pending orders match the ${reminderDays}-day reminder window.`);
      return stats;
    }

    for (const order of candidateOrders) {
      const orderId = String(order.id);
      const orderStatus = String(order.status || '').toLowerCase();

      // 2. Filter out ineligible statuses (cancelled, canceled, refunded)
      if (orderStatus === 'cancelled' || orderStatus === 'canceled' || orderStatus === 'refunded') {
        stats.skippedIneligibleStatus++;
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

      // 4. Marketing opt-out check: If user opted out, mark reminder processed and skip email
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
      const [claimResult] = await pool.query(
        `UPDATE orders SET review_reminder_sent_at = NOW() WHERE id = ? AND review_reminder_sent_at IS NULL`,
        [orderId]
      );

      if (!claimResult || claimResult.affectedRows !== 1) {
        console.log(`  - Order ${orderId}: Already claimed by concurrent worker. Skipped.`);
        continue;
      }

      stats.claimedOrders++;

      // 6. Retrieve order items for review deep link
      let [orderItems] = await pool.query(
        `SELECT id, name, price, quantity FROM order_items WHERE order_id = ? ORDER BY id ASC`,
        [orderId]
      );

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
        const htmlContent = renderReviewReminderHtml({
          orderId,
          customerName: order.customerName || 'Valued Customer',
          items: orderItems || [],
          reviewUrl: reviewDeepLink,
          unsubscribeUrl,
        });

        const textContent = `Hi ${order.customerName || 'Valued Customer'},\n\n` +
          `Thank you for your recent purchase from Ropenix Collections (Order #${orderId})!\n` +
          `We would love to hear your thoughts. Leave a review here: ${reviewDeepLink}\n\n` +
          `To unsubscribe from review reminders: ${unsubscribeUrl}`;

        await transporter.sendMail({
          from: fromEmail,
          to: customerEmail,
          subject: `How was your recent purchase? Review Order #${orderId}`,
          text: textContent,
          html: htmlContent,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
          },
        });

        stats.sentReminders++;
        console.log(`  ✅ Sent review reminder for Order ${orderId} to <${customerEmail}>.`);
      } catch (sendErr) {
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
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].includes('send-review-reminders')) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const daysIdx = args.indexOf('--days');
  const days = daysIdx !== -1 ? parseInt(args[daysIdx + 1], 10) : undefined;
  const batchIdx = args.indexOf('--batch-size');
  const batchSize = batchIdx !== -1 ? parseInt(args[batchIdx + 1], 10) : undefined;
  const delayIdx = args.indexOf('--delay-ms');
  const delayMs = delayIdx !== -1 ? parseInt(args[delayIdx + 1], 10) : undefined;
  const dbIdx = args.indexOf('--db');
  const dbName = dbIdx !== -1 ? args[dbIdx + 1] : undefined;

  processReviewReminders({ days, batchSize, delayMs, dryRun, dbName })
    .then(() => {
      console.log('[Cron Finished] Review reminders runner terminated normally.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Cron Error] Review reminders runner encountered fatal error:', err);
      process.exit(1);
    });
}

module.exports = { processReviewReminders };
