/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { getEmailConfig } from '../email/config';
import { sendEmail, getMailTransporter } from '../email/transporter';
import { fetchEmailJobs, retryFailedJobs } from '../email/db';
import { processQueueBatch } from '../email/queue';
import { getDbPool } from '../../src/lib/mysql-db';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// Enforce administrative privileges on all email configuration and diagnostics
router.use(requireAdmin);

/**
 * GET /api/admin/email/stats
 */
router.get(['/stats', '/stats/'], async (_req: Request, res: Response) => {
  try {
    const config = getEmailConfig();
    let queuedJobsCount = 0;
    let failedJobsCount = 0;
    let sentLogsCount = 0;
    let recentLogs: any[] = [];

    try {
      const pool = await getDbPool();
      const [qRows]: any = await pool.query(`SELECT status, count(*) as count FROM email_jobs GROUP BY status`);
      (qRows || []).forEach((r: any) => {
        if (r.status === 'queued') queuedJobsCount = parseInt(r.count, 10);
        if (r.status === 'failed') failedJobsCount = parseInt(r.count, 10);
      });

      const [lRows]: any = await pool.query(`SELECT count(*) as count FROM email_logs WHERE status = 'sent'`);
      sentLogsCount = parseInt(lRows[0]?.count || '0', 10);

      const [recRows]: any = await pool.query(`SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 30`);
      recentLogs = recRows || [];
    } catch (dbErr) {
      console.warn('[Email Diagnostics] MySQL query notice:', dbErr);
    }

    return res.json({
      success: true,
      config: {
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        user: config.smtp.user,
        from: config.smtp.from,
        replyTo: config.smtp.replyTo,
        adminEmail: config.admin.email,
        devMode: config.dev.isDevMode,
        redirectTo: config.dev.redirectTo,
        paybill: config.paybill,
        digest: config.digest,
        schedule: config.schedule,
      },
      stats: {
        queuedJobs: queuedJobsCount,
        failedJobs: failedJobsCount,
        sentTotal: sentLogsCount,
      },
      recentLogs,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch email diagnostics.' });
  }
});

/**
 * GET /api/admin/email/queue
 */
router.get(['/queue', '/queue/'], async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = Number(req.query.limit) || 50;
    const jobs = await fetchEmailJobs(status, limit);
    return res.json({ success: true, count: jobs.length, jobs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch email queue.' });
  }
});

/**
 * POST /api/admin/email/flush-queue
 */
router.post(['/flush-queue', '/flush-queue/'], async (_req: Request, res: Response) => {
  try {
    const processedCount = await processQueueBatch(20);
    return res.json({ success: true, message: `Successfully processed ${processedCount} queued email job(s).`, processedCount });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to flush email queue.' });
  }
});

/**
 * POST /api/admin/email/retry-failed
 */
router.post(['/retry-failed', '/retry-failed/'], async (_req: Request, res: Response) => {
  try {
    const retriedCount = await retryFailedJobs();
    if (retriedCount > 0) {
      processQueueBatch(10).catch(() => {});
    }
    return res.json({ success: true, message: `Re-queued ${retriedCount} failed email job(s) for delivery.`, retriedCount });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to retry failed email jobs.' });
  }
});

/**
 * POST /api/admin/email/test
 */
router.post(['/test', '/test/'], async (req: Request, res: Response) => {
  try {
    const { toEmail } = req.body || {};
    const config = getEmailConfig();
    const target = toEmail || config.admin.email || config.smtp.user;

    if (!target) {
      return res.status(400).json({ success: false, error: 'Recipient target email required.' });
    }

    const testHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 580px; margin: 0 auto; background: #ffffff;">
        <div style="border-bottom: 3px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 20px;">🧪 Ropenix Collections — SMTP Diagnostic Verification</h2>
          <p style="color: #64748b; font-size: 12px; margin: 4px 0 0 0;">Outbound Zoho Mail SMTP Engine (${config.smtp.host}:${config.smtp.port})</p>
        </div>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          This email confirms that your outgoing transactional email pipeline is fully connected, authenticated, and ready to deliver customer order receipts and administrative alerts.
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 13px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; color: #64748b; width: 35%;"><strong>Sender (From):</strong></td><td style="padding: 4px 0; color: #0f172a;">${config.smtp.defaultFrom}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;"><strong>Reply-To:</strong></td><td style="padding: 4px 0; color: #0f172a;">${config.smtp.replyTo}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;"><strong>Target Recipient:</strong></td><td style="padding: 4px 0; color: #0f172a; font-weight: 600;">${target}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;"><strong>Paybill Account:</strong></td><td style="padding: 4px 0; color: #16a34a; font-weight: 700;">${config.paybill.number} (A/C ${config.paybill.accountNumber})</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;"><strong>Timestamp:</strong></td><td style="padding: 4px 0; color: #0f172a;">${new Date().toISOString()}</td></tr>
          </table>
        </div>
        <p style="color: #94a3b8; font-size: 11px; margin: 0; text-align: center;">
          ${config.paybill.accountName} • Nairobi, Kenya
        </p>
      </div>
    `;

    const result = await sendEmail({
      to: target,
      subject: `🧪 Ropenix SMTP Test - ${new Date().toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi' })} EAT`,
      html: testHtml,
      text: `Ropenix SMTP Test dispatched successfully to ${target} at ${new Date().toISOString()}`,
    });

    return res.json({ success: result.success, messageId: result.messageId, recipient: target, error: result.error });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'SMTP test failed.' });
  }
});

export default router;
