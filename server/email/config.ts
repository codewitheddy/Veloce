/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
dotenv.config();

export interface EmailSystemConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    requireTls: boolean;
    user: string;
    pass: string;
    defaultFrom: string;
    from: string; // alias
    replyTo: string;
  };
  paybill: {
    number: string;
    accountNumber: string;
    accountName: string;
  };
  urls: {
    frontendUrl: string;
    adminUrl: string;
  };
  behavior: {
    enabled: boolean;
    devMode: boolean;
    devRedirectTo?: string;
    timezone: string;
    currency: string;
  };
  admin: {
    email: string;
  };
  dev: {
    isDevMode: boolean;
    redirectTo?: string;
  };
  schedule: {
    autoCancelUnpaidHours: number;
    reminderHours: number;
  };
  digest: {
    enabled: boolean;
    times: string[]; // e.g. ['08:00', '17:00']
    recipients: string[];
    sendWhenEmpty: boolean;
    urgentPendingHours: number;
  };
  rules: {
    paymentReminderHours: number;
    maxPaymentReminders: number;
    autoCancelEnabled: boolean;
    autoCancelHours: number;
    reviewRequestDays: number;
    abandonedCartEnabled: boolean;
    abandonedCartHours: number[];
  };
}

export function getEmailConfig(): EmailSystemConfig {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtppro.zoho.com';
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT) || 465;
  const secure = process.env.EMAIL_USE_SSL !== 'false' && (process.env.EMAIL_USE_SSL === 'true' || port === 465);
  const requireTls = process.env.EMAIL_USE_TLS === 'true';
  const user = process.env.SMTP_USER || process.env.EMAIL_HOST_USER || 'admin@ropenix.co.ke';
  const pass = process.env.SMTP_PASS || process.env.EMAIL_HOST_PASSWORD || '';
  const rawFrom = process.env.EMAIL_FROM || process.env.DEFAULT_FROM_EMAIL || `"Ropenix Collections" <${user}>`;
  const defaultFrom = rawFrom.replace(/\\"/g, '"').replace(/^"/, '').replace(/"$/, '').trim();
  const replyTo = process.env.REPLY_TO_EMAIL || process.env.ADMIN_EMAIL || 'ropenixkenya@gmail.com';
  const adminEmail = (process.env.ADMIN_EMAIL || replyTo || user).trim();

  const paybillNumber = process.env.PAYBILL_NUMBER || '303030';
  const paybillAccountNumber = process.env.PAYBILL_ACCOUNT_NUMBER || '2047728455';
  const paybillAccountName = process.env.PAYBILL_ACCOUNT_NAME || 'ROPENIX INVESTMENTS LTD';

  const frontendUrl = (process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const adminUrl = (process.env.ADMIN_URL || frontendUrl).replace(/\/+$/, '');

  const enabled = process.env.EMAIL_ENABLED !== 'false';
  const isDev = process.env.NODE_ENV !== 'production';
  const devMode = process.env.EMAIL_DEV_MODE !== undefined ? process.env.EMAIL_DEV_MODE === 'true' : isDev;
  const devRedirectTo = process.env.EMAIL_DEV_REDIRECT_TO || (devMode ? replyTo : undefined);

  const digestEnabled = process.env.ADMIN_DIGEST_ENABLED !== 'false';
  const digestTimesRaw = process.env.ADMIN_DIGEST_TIMES || '08:00,17:00';
  const digestTimes = digestTimesRaw.split(',').map((t) => t.trim()).filter(Boolean);

  const digestRecipientsRaw = process.env.ADMIN_DIGEST_RECIPIENTS || `${user},${replyTo}`;
  const digestRecipients = digestRecipientsRaw.split(',').map((r) => r.trim()).filter(Boolean);
  const digestSendWhenEmpty = process.env.ADMIN_DIGEST_SEND_WHEN_EMPTY === 'true';
  const urgentPendingHours = Number(process.env.PENDING_VERIFICATION_ALERT_HOURS) || 4;

  const paymentReminderHours = Number(process.env.PAYMENT_REMINDER_HOURS) || 24;
  const maxPaymentReminders = Number(process.env.MAX_PAYMENT_REMINDERS) || 2;
  const autoCancelEnabled = process.env.AUTO_CANCEL_ENABLED === 'true';
  const autoCancelHours = Number(process.env.AUTO_CANCEL_HOURS) || 48;
  const reviewRequestDays = Number(process.env.REVIEW_REQUEST_DAYS) || 7;
  const abandonedCartEnabled = process.env.ABANDONED_CART_ENABLED === 'true';

  return {
    smtp: {
      host,
      port,
      secure,
      requireTls,
      user,
      pass,
      defaultFrom,
      from: defaultFrom,
      replyTo,
    },
    admin: {
      email: adminEmail,
    },
    dev: {
      isDevMode: devMode,
      redirectTo: devRedirectTo,
    },
    schedule: {
      autoCancelUnpaidHours: autoCancelHours,
      reminderHours: paymentReminderHours,
    },
    paybill: {
      number: paybillNumber,
      accountNumber: paybillAccountNumber,
      accountName: paybillAccountName,
    },
    urls: {
      frontendUrl,
      adminUrl,
    },
    behavior: {
      enabled,
      devMode,
      devRedirectTo,
      timezone: 'Africa/Nairobi',
      currency: 'KES',
    },
    digest: {
      enabled: digestEnabled,
      times: digestTimes,
      recipients: digestRecipients,
      sendWhenEmpty: digestSendWhenEmpty,
      urgentPendingHours,
    },
    rules: {
      paymentReminderHours,
      maxPaymentReminders,
      autoCancelEnabled,
      autoCancelHours,
      reviewRequestDays,
      abandonedCartEnabled,
      abandonedCartHours: [2, 24, 72],
    },
  };
}
