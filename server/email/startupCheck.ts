/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getEmailConfig } from './config';

export interface StartupCheckResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  safeToSend: boolean;
}

/**
 * Validates critical environment settings upon server boot
 */
export function runEmailStartupCheck(): StartupCheckResult {
  const config = getEmailConfig();
  const isProduction = process.env.NODE_ENV === 'production';
  const warnings: string[] = [];
  const errors: string[] = [];
  let safeToSend = config.behavior.enabled;

  console.log('\n======================================================');
  console.log('   ROPENIX TRANSACTIONAL EMAIL SYSTEM INITIALIZING    ');
  console.log('======================================================');
  console.log(`• Node Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`• Email Active:     ${config.behavior.enabled ? 'YES' : 'NO'}`);
  console.log(`• Dev Safe Mode:    ${config.behavior.devMode ? 'ENABLED (Test/Redirect Mode)' : 'DISABLED (Real Recipients)'}`);
  console.log(`• SMTP Server:      ${config.smtp.host}:${config.smtp.port} (SSL: ${config.smtp.secure})`);
  console.log(`• Sender (From):    ${config.smtp.defaultFrom}`);
  console.log(`• Reply-To:         ${config.smtp.replyTo}`);
  console.log(`• Frontend URL:     ${config.urls.frontendUrl}`);
  console.log(`• Admin URL:        ${config.urls.adminUrl}`);
  console.log(`• Shared Paybill:   ${config.paybill.number} (Acc: ${config.paybill.accountNumber} - ${config.paybill.accountName})`);
  console.log('======================================================\n');

  // Check 1: Frontend URL in production
  if (isProduction) {
    if (!process.env.FRONTEND_URL || config.urls.frontendUrl.includes('localhost') || config.urls.frontendUrl.includes('127.0.0.1')) {
      const err = `🚨 CRITICAL CONFIG ERROR: NODE_ENV is 'production' but FRONTEND_URL (${config.urls.frontendUrl}) is unset or points to localhost! Real customers will receive broken email links.`;
      errors.push(err);
      console.error(err);
      safeToSend = false;
    }
  }

  // Check 2: Dev Mode notice
  if (config.behavior.devMode) {
    warnings.push(`EMAIL_DEV_MODE is active. Emails to customer addresses will be logged or redirected to: ${config.behavior.devRedirectTo || config.smtp.replyTo}`);
  }

  // Check 3: SMTP Credentials
  if (!config.smtp.pass) {
    warnings.push('EMAIL_HOST_PASSWORD is missing in .env. Outgoing SMTP emails will fail authentication.');
    safeToSend = false;
  }

  if (errors.length > 0) {
    console.error('❌ Email system initialization encountered blockers.');
  } else {
    console.log('✅ Email system startup validation passed.');
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    safeToSend,
  };
}

export const validateEmailConfigOnStartup = runEmailStartupCheck;
