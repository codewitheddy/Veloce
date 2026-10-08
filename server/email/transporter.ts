/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import nodemailer from 'nodemailer';
import { getEmailConfig } from './config';

let transporterInstance: nodemailer.Transporter | null = null;

/**
 * Retrieves or initializes the singleton Nodemailer transporter for Zoho SMTP
 */
export function getMailTransporter(): nodemailer.Transporter {
  if (transporterInstance) {
    return transporterInstance;
  }

  const config = getEmailConfig();

  const options: any = {
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5, // Throttle to 5 emails/second to respect Zoho rate limits
  };

  transporterInstance = nodemailer.createTransport(options);
  return transporterInstance;
}

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  category?: 'transactional' | 'marketing' | 'security' | 'admin';
  listUnsubscribeUrl?: string;
}

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  response?: string;
  recipient: string;
  originalRecipient?: string;
  error?: string;
  devModeRedirected?: boolean;
}

/**
 * Sends an email through Zoho Mail SMTP with dev-mode redirection and comprehensive error handling
 */
export async function sendRawMail(options: SendMailOptions): Promise<SendMailResult> {
  const config = getEmailConfig();
  const transporter = getMailTransporter();

  if (!config.behavior.enabled) {
    console.log(`[Email System] ℹ️ Email dispatch disabled via EMAIL_ENABLED=false. Skipped: "${options.subject}" to ${options.to}`);
    return {
      success: true,
      messageId: `mock-disabled-${Date.now()}`,
      response: 'EMAIL_ENABLED=false (Mock Delivery)',
      recipient: Array.isArray(options.to) ? options.to.join(', ') : options.to,
    };
  }

  const rawRecipient = Array.isArray(options.to) ? options.to.join(', ') : options.to;
  let targetRecipient = rawRecipient;
  let devModeRedirected = false;

  // In development mode, protect real user inboxes by redirecting or logging
  if (config.behavior.devMode) {
    const isTestAccount = rawRecipient.includes('ropenix') || rawRecipient.includes('admin') || rawRecipient.includes('localhost');
    if (!isTestAccount && config.behavior.devRedirectTo) {
      targetRecipient = config.behavior.devRedirectTo;
      devModeRedirected = true;
      console.log(`[Email Dev Mode] 🛡️ Redirecting email originally destined for <${rawRecipient}> to dev inbox: <${targetRecipient}>`);
    }
  }

  const mailOptions: nodemailer.SendMailOptions = {
    from: config.smtp.defaultFrom,
    to: targetRecipient,
    replyTo: options.replyTo || config.smtp.replyTo,
    subject: devModeRedirected ? `[DEV - for: ${rawRecipient}] ${options.subject}` : options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim(),
    headers: {
      'X-Entity-Ref-ID': `ropenix-${Date.now()}`,
      'X-Store-Name': 'Ropenix Collections',
      ...(options.headers || {}),
    },
  };

  if (options.listUnsubscribeUrl) {
    mailOptions.list = {
      unsubscribe: {
        url: options.listUnsubscribeUrl,
        comment: 'Unsubscribe from Ropenix Notifications',
      },
    };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email System] ✉️ Successfully sent "${options.subject}" to ${targetRecipient} (MsgID: ${info.messageId})`);
    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
      recipient: targetRecipient,
      originalRecipient: rawRecipient,
      devModeRedirected,
    };
  } catch (err: any) {
    console.error(`[Email System] ❌ Failed to dispatch email "${options.subject}" to ${targetRecipient}:`, err?.message || err);
    return {
      success: false,
      recipient: targetRecipient,
      originalRecipient: rawRecipient,
      error: err?.message || 'SMTP transmission error',
      devModeRedirected,
    };
  }
}

export const sendEmail = sendRawMail;
