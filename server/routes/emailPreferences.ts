/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { getEmailConfig } from '../email/config';
import { sendEmail, getMailTransporter } from '../email/transporter';
import { isRecipientOptedOut } from '../email/db';
import { getDbPool } from '../../src/lib/mysql-db';

const router = Router();

/**
 * GET /api/email/preferences
 */
router.get(['/preferences', '/preferences/'], async (req: Request, res: Response) => {
  try {
    const email = (req.query.email as string || '').toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email parameter is required.' });
    }

    const pool = await getDbPool();
    const [rows]: any = await pool.query('SELECT * FROM email_preferences WHERE email = ? LIMIT 1', [email]);
    if (rows && rows.length > 0) {
      return res.json({ success: true, preferences: rows[0] });
    }

    // Default preferences
    return res.json({
      success: true,
      preferences: {
        email,
        allow_marketing: true,
        allow_review_requests: true,
        allow_abandoned_cart: true,
        allow_price_drop: true,
        unsubscribed_all: false,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch email preferences.' });
  }
});

/**
 * POST /api/email/preferences
 */
router.post(['/preferences', '/preferences/'], async (req: Request, res: Response) => {
  try {
    const { email, allow_marketing, allow_review_requests, allow_abandoned_cart, allow_price_drop, unsubscribed_all } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const nowIso = new Date().toISOString();
    const id = `pref-${Date.now()}`;

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
         updated_at = VALUES(updated_at);`,
      [
        id,
        cleanEmail,
        allow_marketing ? 1 : 0,
        allow_review_requests ? 1 : 0,
        allow_abandoned_cart ? 1 : 0,
        allow_price_drop ? 1 : 0,
        unsubscribed_all ? 1 : 0,
        nowIso,
      ]
    );

    return res.json({ success: true, message: 'Email preferences updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to update preferences.' });
  }
});

/**
 * One-click Unsubscribe endpoint (HTML)
 * GET /api/email/unsubscribe
 */
router.get(['/unsubscribe', '/unsubscribe/'], async (req: Request, res: Response) => {
  try {
    const email = (req.query.email as string || '').toLowerCase().trim();
    if (!email) {
      return res.status(400).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 40px;">
            <h2>Invalid Unsubscribe Link</h2>
            <p>Missing email address parameter.</p>
          </body>
        </html>
      `);
    }

    const nowIso = new Date().toISOString();
    const id = `pref-${Date.now()}`;

    const pool = await getDbPool();
    await pool.query(
      `INSERT INTO email_preferences (id, email, allow_marketing, allow_review_requests, allow_abandoned_cart, allow_price_drop, unsubscribed_all, updated_at)
       VALUES (?, ?, 0, 0, 0, 0, 1, ?)
       ON DUPLICATE KEY UPDATE
         allow_marketing = 0,
         allow_review_requests = 0,
         allow_abandoned_cart = 0,
         allow_price_drop = 0,
         unsubscribed_all = 1,
         updated_at = VALUES(updated_at);`,
      [id, email, nowIso]
    );

    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribed - Ropenix Collections</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 80vh; margin: 0; padding: 20px; }
            .card { background: #ffffff; max-width: 480px; width: 100%; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
            h2 { color: #0f172a; margin-top: 0; }
            p { color: #475569; font-size: 14px; line-height: 1.6; }
            .btn { display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 13px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>You Have Been Unsubscribed</h2>
            <p>You will no longer receive marketing promotions, abandoned cart reminders, or product review requests for <strong>${email}</strong>.</p>
            <p style="font-size: 12px; color: #94a3b8;">Note: Critical transactional receipts and M-Pesa order confirmations will still be delivered when you place orders.</p>
            <a href="/" class="btn">Return to Storefront</a>
          </div>
        </body>
      </html>
    `);
  } catch (err: any) {
    return res.status(500).send(`Failed to process unsubscribe request: ${err?.message}`);
  }
});

/**
 * POST /api/email/unsubscribe (JSON API)
 */
router.post(['/unsubscribe', '/unsubscribe/'], async (req: Request, res: Response) => {
  try {
    const email = (req.body.email as string || '').toLowerCase().trim();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email address required.' });
    }

    const nowIso = new Date().toISOString();
    const id = `pref-${Date.now()}`;

    const pool = await getDbPool();
    await pool.query(
      `INSERT INTO email_preferences (id, email, allow_marketing, allow_review_requests, allow_abandoned_cart, allow_price_drop, unsubscribed_all, updated_at)
       VALUES (?, ?, 0, 0, 0, 0, 1, ?)
       ON DUPLICATE KEY UPDATE
         allow_marketing = 0,
         allow_review_requests = 0,
         allow_abandoned_cart = 0,
         allow_price_drop = 0,
         unsubscribed_all = 1,
         updated_at = VALUES(updated_at);`,
      [id, email, nowIso]
    );

    return res.json({
      success: true,
      email,
      unsubscribed: true,
      message: `Successfully unsubscribed ${email} from promotional and marketing communications.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to unsubscribe.' });
  }
});

/**
 * POST /api/email/resubscribe (JSON API)
 */
router.post(['/resubscribe', '/resubscribe/'], async (req: Request, res: Response) => {
  try {
    const email = (req.body.email as string || '').toLowerCase().trim();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email address required.' });
    }

    const nowIso = new Date().toISOString();
    const id = `pref-${Date.now()}`;

    const pool = await getDbPool();
    await pool.query(
      `INSERT INTO email_preferences (id, email, allow_marketing, allow_review_requests, allow_abandoned_cart, allow_price_drop, unsubscribed_all, updated_at)
       VALUES (?, ?, 1, 1, 1, 1, 0, ?)
       ON DUPLICATE KEY UPDATE
         allow_marketing = 1,
         allow_review_requests = 1,
         allow_abandoned_cart = 1,
         allow_price_drop = 1,
         unsubscribed_all = 0,
         updated_at = VALUES(updated_at);`,
      [id, email, nowIso]
    );

    return res.json({
      success: true,
      email,
      unsubscribed: false,
      message: `Successfully re-subscribed ${email} to Ropenix Collections updates.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to resubscribe.' });
  }
});

/**
 * GET /api/email/unsubscribe-status
 */
router.get(['/unsubscribe-status', '/unsubscribe-status/'], async (req: Request, res: Response) => {
  try {
    const email = (req.query.email as string || '').toLowerCase().trim();
    if (!email) {
      return res.json({ email: '', unsubscribed: false });
    }

    const pool = await getDbPool();
    const [rows]: any = await pool.query('SELECT unsubscribed_all FROM email_preferences WHERE email = ? LIMIT 1', [email]);
    return res.json({ email, unsubscribed: rows && rows.length > 0 ? Boolean(rows[0].unsubscribed_all) : false });
  } catch {
    return res.json({ email: '', unsubscribed: false });
  }
});

/**
 * GET /api/email/unsubscribed-list
 */
router.get(['/unsubscribed-list', '/unsubscribed-list/'], async (_req: Request, res: Response) => {
  try {
    const pool = await getDbPool();
    const [rows]: any = await pool.query('SELECT email FROM email_preferences WHERE unsubscribed_all = 1');
    const emails = (rows || []).map((r: any) => r.email);
    return res.json({ count: emails.length, emails });
  } catch {
    return res.json({ count: 0, emails: [] });
  }
});

/**
 * GET /api/email/config
 */
router.get(['/config', '/config/'], (_req: Request, res: Response) => {
  const config = getEmailConfig();
  return res.json({
    configured: Boolean(config.smtp.pass),
    host: config.smtp.host,
    port: config.smtp.port,
    user: config.smtp.user,
    defaultFrom: config.smtp.defaultFrom,
    useSsl: config.smtp.secure,
    replyTo: config.smtp.replyTo,
    adminEmail: config.admin.email,
    devMode: config.dev.isDevMode,
    paybill: config.paybill,
  });
});

/**
 * GET /api/email/validate-config
 */
router.get(['/validate-config', '/validate-config/'], async (_req: Request, res: Response) => {
  try {
    const config = getEmailConfig();
    const transporter = getMailTransporter();
    await transporter.verify();
    return res.json({
      valid: true,
      message: `Successfully authenticated with ${config.smtp.host}:${config.smtp.port} as ${config.smtp.user}`,
      host: config.smtp.host,
      port: config.smtp.port,
    });
  } catch (err: any) {
    return res.status(500).json({
      valid: false,
      error: err?.message || 'Failed to authenticate with SMTP server.',
    });
  }
});

/**
 * POST /api/email/send (Client-side dispatch helper with opt-out checks)
 */
router.post(['/send', '/send/'], async (req: Request, res: Response) => {
  try {
    const { to, subject, html, text, category, isPromotional } = req.body || {};

    if (!to || !subject) {
      return res.status(400).json({ success: false, error: "Recipient ('to') and 'subject' are required." });
    }

    const cleanTo = String(to).toLowerCase().trim();
    const isMarketing = isPromotional === true || category === 'marketing';

    // Opt-out check
    if (isMarketing) {
      const optedOut = await isRecipientOptedOut(cleanTo, 'marketing');
      if (optedOut) {
        return res.json({
          success: false,
          unsubscribed: true,
          skipped: true,
          message: `Recipient (${cleanTo}) has opted out of promotional communications.`,
        });
      }
    }

    const result = await sendEmail({
      to: cleanTo,
      subject: String(subject).trim(),
      html: html || `<p>${text || subject}</p>`,
      text: text,
      category: isMarketing ? 'marketing' : 'transactional',
    });

    return res.json({
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      recipient: cleanTo,
      message: result.success ? 'Email dispatched successfully.' : result.error,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to transmit email.' });
  }
});

/**
 * POST /api/email/diagnose-smtp
 */
router.post(['/diagnose-smtp', '/diagnose-smtp/'], async (req: Request, res: Response) => {
  try {
    const { to } = req.body || {};
    const config = getEmailConfig();
    const recipient = (to || config.admin.email || config.smtp.user).trim();

    const transporter = getMailTransporter();
    await transporter.verify();

    const testHtml = `
      <div style="font-family: sans-serif; padding: 24px; border: 1px solid #4f46e5; border-radius: 12px; max-width: 550px; margin: 0 auto;">
        <h2 style="color: #4f46e5; margin-top: 0;">✅ Ropenix Collections SMTP Diagnostic Succeeded</h2>
        <p style="color: #334155; line-height: 1.5;">Your mail server at <strong>${config.smtp.host}:${config.smtp.port}</strong> is fully operational and successfully transmitting transactional messages.</p>
        <div style="background: #f8fafc; padding: 12px; border-radius: 6px; font-size: 12px; color: #64748b;">
          <strong>Target Recipient:</strong> ${recipient}<br/>
          <strong>Sender:</strong> ${config.smtp.defaultFrom}<br/>
          <strong>Timestamp:</strong> ${new Date().toISOString()}
        </div>
      </div>
    `;

    const sendRes = await sendEmail({
      to: recipient,
      subject: '🧪 Ropenix SMTP Node Diagnostic Test - Active',
      html: testHtml,
      text: 'Ropenix SMTP Diagnostic Test Succeeded.',
    });

    return res.json({
      success: sendRes.success,
      message: `Diagnostic test email delivered to ${recipient}`,
      messageId: sendRes.messageId,
      error: sendRes.error,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Diagnostic test failed.' });
  }
});

export default router;
