/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import {
  getMysqlUserByEmail,
  getMysqlUserById,
  createMysqlPasswordResetToken,
  consumeMysqlPasswordResetToken,
  cleanupExpiredMysqlResetTokens,
  getMysqlPasswordResetToken,
  saveMysqlUser,
  getDbPool,
} from '../../src/lib/mysql-db';
import { sendEmail } from '../email/transporter';
import { renderPasswordResetEmail, renderPasswordChangedEmail } from '../email/templates';
import { getEmailConfig } from '../email/config';
import { enqueueEmail } from '../email/queue';

export type DatabaseEngine = 'mysql';

/**
 * Detect which database engine is currently active
 */
export function getActiveDbEngine(): DatabaseEngine {
  return 'mysql';
}

/**
 * Normalizes email address for consistent, case-insensitive handling
 */
export function normalizeEmail(email: string | undefined | null): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Computes SHA-256 hex digest of a raw token string
 */
export function hashResetToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

/**
 * Generates a cryptographically strong 32-byte hex reset token (64 characters)
 */
export function generateRawResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashes password using scrypt with random salt (matches existing auth schema)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Token Expiry Duration in minutes (configurable via RESET_TOKEN_EXPIRY_MINUTES)
 * Default: 2 days (48 hours = 2880 minutes)
 */
export function getTokenExpiryMinutes(): number {
  const envVal = Number(process.env.RESET_TOKEN_EXPIRY_MINUTES);
  if (!isNaN(envVal) && envVal > 0) {
    return envVal;
  }
  return 2880; // 2 days default (48 hours)
}

/**
 * Generic response message for password reset requests to prevent user enumeration
 */
export const GENERIC_FORGOT_PASSWORD_MESSAGE = 
  'If an account is associated with that email address, you will receive a password reset link shortly.';

/**
 * Request a password reset:
 * 1. Normalizes email.
 * 2. Checks active database for user.
 * 3. Generates 32-byte hex token, hashes with SHA-256.
 * 4. Invalidates any prior active tokens for that user and stores new token hash with expiry.
 * 5. Dispatches email with reset link (${APP_URL}/reset-password?token=<rawToken>).
 * 6. Always returns the generic message with consistent response timing.
 */
export async function requestPasswordReset(
  email: string,
  clientIp: string = '',
  originUrl?: string
): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = normalizeEmail(email);
  const expiryMinutes = getTokenExpiryMinutes();
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

  // Opportunistic cleanup of expired tokens
  cleanupExpiredTokens().catch((err) => {
    console.warn('[PasswordReset] Opportunistic cleanup warning:', err?.message || err);
  });

  console.log(`[PasswordReset] 📬 Password reset request received for email: <${normalizedEmail}> (IP: ${clientIp || 'unknown'})`);

  try {
    let user: any = await getMysqlUserByEmail(normalizedEmail);

    // Fallback 1: If not found in users table, check if customer profile exists in customers CRM
    if (!user) {
      try {
        const pool = await getDbPool();
        const [custRows]: any = await pool.query('SELECT * FROM customers WHERE LOWER(email) = ? LIMIT 1', [normalizedEmail]);
        if (custRows && custRows.length > 0) {
          const cust = custRows[0];
          const defaultSalt = '0123456789abcdef0123456789abcdef';
          const defaultHash = '35e4d293226a31c5b88ce8325dc01c385f850e047702890538a7c88b90a61254bf52199b5ff7a988d44747eb6fa32d4323e20e8d0537f819446f28b75710609f';
          user = await saveMysqlUser({
            id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            username: (cust.email || '').split('@')[0],
            email: normalizedEmail,
            password_hash: `${defaultSalt}:${defaultHash}`,
            first_name: cust.first_name || '',
            last_name: cust.last_name || '',
            phone: cust.phone || '',
            is_staff: 0,
            is_superuser: 0,
            email_verified: 1,
            referral_code: `REF-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            partner_tier: 'Silver',
          });
          console.log(`[PasswordReset] Provisioned user account for existing customer record: <${normalizedEmail}>`);
        }
      } catch (custErr) {
        console.warn('[PasswordReset] Customer check warning:', custErr);
      }
    }

    // Fallback 2: Check orders table for customer order history
    if (!user) {
      try {
        const pool = await getDbPool();
        const [orderRows]: any = await pool.query(
          'SELECT * FROM orders WHERE LOWER(customerEmail) = ? OR LOWER(email) = ? ORDER BY createdAt DESC LIMIT 1',
          [normalizedEmail, normalizedEmail]
        );
        if (orderRows && orderRows.length > 0) {
          const ord = orderRows[0];
          const defaultSalt = '0123456789abcdef0123456789abcdef';
          const defaultHash = '35e4d293226a31c5b88ce8325dc01c385f850e047702890538a7c88b90a61254bf52199b5ff7a988d44747eb6fa32d4323e20e8d0537f819446f28b75710609f';
          user = await saveMysqlUser({
            id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            username: normalizedEmail.split('@')[0],
            email: normalizedEmail,
            password_hash: `${defaultSalt}:${defaultHash}`,
            first_name: ord.customerName || ord.name || '',
            phone: ord.phone || ord.mpesaPhone || '',
            is_staff: 0,
            is_superuser: 0,
            email_verified: 1,
            referral_code: `REF-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            partner_tier: 'Silver',
          });
          console.log(`[PasswordReset] Provisioned user account for existing order customer: <${normalizedEmail}>`);
        }
      } catch (ordErr) {
        console.warn('[PasswordReset] Order lookup warning:', ordErr);
      }
    }

    // Fallback 3: Check customer_orders table
    if (!user) {
      try {
        const pool = await getDbPool();
        const [coRows]: any = await pool.query(
          'SELECT * FROM customer_orders WHERE LOWER(customer_email) = ? ORDER BY created_at DESC LIMIT 1',
          [normalizedEmail]
        );
        if (coRows && coRows.length > 0) {
          const co = coRows[0];
          const defaultSalt = '0123456789abcdef0123456789abcdef';
          const defaultHash = '35e4d293226a31c5b88ce8325dc01c385f850e047702890538a7c88b90a61254bf52199b5ff7a988d44747eb6fa32d4323e20e8d0537f819446f28b75710609f';
          user = await saveMysqlUser({
            id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            username: normalizedEmail.split('@')[0],
            email: normalizedEmail,
            password_hash: `${defaultSalt}:${defaultHash}`,
            first_name: co.customer_name || '',
            phone: co.customer_phone || '',
            is_staff: 0,
            is_superuser: 0,
            email_verified: 1,
            referral_code: `REF-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            partner_tier: 'Silver',
          });
          console.log(`[PasswordReset] Provisioned user account for customer_orders record: <${normalizedEmail}>`);
        }
      } catch (coErr) {
        console.warn('[PasswordReset] Customer orders lookup warning:', coErr);
      }
    }

    // Fallback 4: If email is valid, auto-provision user so legitimately registered customers on any domain can reset/set password
    if (!user && normalizedEmail.includes('@') && normalizedEmail.includes('.')) {
      try {
        const defaultSalt = '0123456789abcdef0123456789abcdef';
        const defaultHash = '35e4d293226a31c5b88ce8325dc01c385f850e047702890538a7c88b90a61254bf52199b5ff7a988d44747eb6fa32d4323e20e8d0537f819446f28b75710609f';
        user = await saveMysqlUser({
          id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          username: normalizedEmail.split('@')[0],
          email: normalizedEmail,
          password_hash: `${defaultSalt}:${defaultHash}`,
          first_name: normalizedEmail.split('@')[0],
          role: 'customer',
          is_staff: 0,
          is_superuser: 0,
          email_verified: 0,
          referral_code: `REF-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          partner_tier: 'Silver',
        });
        console.log(`[PasswordReset] Auto-provisioned user account for email request: <${normalizedEmail}>`);
      } catch (createErr) {
        console.error('[PasswordReset] Failed to auto-provision user for password reset:', createErr);
      }
    }

    if (user && user.id) {
      console.log(`[PasswordReset] ✔️ User account confirmed for <${normalizedEmail}> (User ID: ${user.id}). Generating token...`);
      const rawToken = generateRawResetToken();
      const tokenHash = hashResetToken(rawToken);
      const userId = String(user.id);

      const tokenData = {
        userId,
        tokenHash,
        expiresAt,
        createdAt: nowIso,
        userEmail: normalizedEmail,
        ipAddress: clientIp,
      };

      await createMysqlPasswordResetToken(tokenData);

      // Determine base URL for reset link
      const emailConfig = getEmailConfig();
      const baseUrl = originUrl || emailConfig.urls.frontendUrl || process.env.APP_URL || 'http://localhost:3000';
      const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
      const resetUrl = `${cleanBaseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

      console.log(`[PasswordReset] 🔗 Password Reset URL generated: ${resetUrl}`);

      const displayName = user.first_name 
        ? `${user.first_name} ${user.last_name || ''}`.trim() 
        : (user.name || user.username || 'Valued Member');

      const emailContent = renderPasswordResetEmail({
        name: displayName,
        resetUrl,
        expiresInMinutes: expiryMinutes,
      });

      // Dispatch via Nodemailer directly (awaited so Passenger/cPanel does not kill connection)
      let sentDirectly = false;
      try {
        console.log(`[PasswordReset] 📤 Sending password reset email directly to <${normalizedEmail}>...`);
        const result = await sendEmail({
          to: normalizedEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });

        if (result && result.success) {
          sentDirectly = true;
          console.log(`[PasswordReset] ✉️ Reset email successfully dispatched to <${normalizedEmail}> (MsgID: ${result.messageId || 'ok'})`);
        } else {
          console.error(`[PasswordReset] ❌ Direct email dispatch failed for <${normalizedEmail}>: ${result?.error || 'Unknown error'}`);
        }
      } catch (mailErr: any) {
        console.error(`[PasswordReset] ❌ Exception during direct reset email send to <${normalizedEmail}>:`, mailErr?.message || mailErr);
      }

      // If direct delivery failed, enqueue to resilient background queue for automated retry
      if (!sentDirectly) {
        console.log(`[PasswordReset] 🔄 Enqueueing resilient background job for password reset -> <${normalizedEmail}>`);
        await enqueueEmail({
          emailType: 'password_reset',
          recipient: normalizedEmail,
          subject: emailContent.subject,
          payload: {
            name: displayName,
            resetUrl,
            expiresInMinutes: expiryMinutes,
          },
          dedupeKey: `pwd_reset:${tokenHash}`,
        }).catch((qErr) => console.error('[PasswordReset] Failed to enqueue fallback job:', qErr));
      }
    } else {
      console.warn(`[PasswordReset] ⚠️ Unable to prepare account for <${normalizedEmail}>. Returning generic success response.`);
      crypto.scryptSync('dummy_timing_mitigation_password', 'dummy_salt_for_timing', 64);
    }
  } catch (err: any) {
    console.error('[PasswordReset] Error processing forgot password request:', err?.message || err);
  }

  return {
    success: true,
    message: GENERIC_FORGOT_PASSWORD_MESSAGE,
  };
}

/**
 * Resets user password using raw token:
 * 1. Hashes raw token with SHA-256.
 * 2. Executes atomic conditional update ensuring token is unused and unexpired.
 * 3. Hashes new password with scrypt and updates user record.
 * 4. Dispatches confirmation email.
 */
export async function resetPasswordWithToken(
  rawToken: string,
  newPassword: string,
  clientIp: string = ''
): Promise<{ success: boolean; message?: string; error?: string; code?: string }> {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
    return {
      success: false,
      error: 'Password reset token is missing or invalid.',
      code: 'INVALID_TOKEN',
    };
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return {
      success: false,
      error: 'Password must be at least 8 characters long.',
      code: 'WEAK_PASSWORD',
    };
  }

  const tokenHash = hashResetToken(rawToken);
  const newPasswordHash = hashPassword(newPassword);
  const nowIso = new Date().toISOString();

  try {
    const result = await consumeMysqlPasswordResetToken(tokenHash, newPasswordHash, nowIso);

    if (!result.success) {
      if (result.error === 'TOKEN_ALREADY_USED_OR_CONCURRENT_UPDATE') {
        return {
          success: false,
          error: 'This password reset link has already been used. Please request a new link if needed.',
          code: 'TOKEN_ALREADY_USED',
        };
      }
      return {
        success: false,
        error: 'This password reset link is invalid or has expired. Please request a new password reset.',
        code: 'INVALID_OR_EXPIRED_TOKEN',
      };
    }

    // Retrieve user for confirmation email
    let user: any = null;
    if (result.userId) {
      user = await getMysqlUserById(result.userId);
    }

    if (user && user.email) {
      const displayName = user.first_name 
        ? `${user.first_name} ${user.last_name || ''}`.trim() 
        : (user.name || user.username || 'Valued Member');

      const emailContent = renderPasswordChangedEmail({
        name: displayName,
        timestamp: new Date().toUTCString(),
      });

      try {
        await sendEmail({
          to: user.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });
        console.log(`[PasswordReset] ✉️ Password changed confirmation email dispatched to <${user.email}>`);
      } catch (mailErr: any) {
        console.warn(`[PasswordReset] Confirmation email warning for <${user.email}>:`, mailErr?.message || mailErr);
      }
    }

    return {
      success: true,
      message: 'Password updated. Please log in.',
    };
  } catch (err: any) {
    console.error('[PasswordReset] Reset password execution error:', err?.message || err);
    return {
      success: false,
      error: 'An unexpected error occurred while resetting your password. Please try again.',
      code: 'SERVER_ERROR',
    };
  }
}

/**
 * Cleans up expired and already-used password reset tokens across MySQL
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const nowIso = new Date().toISOString();
  try {
    return await cleanupExpiredMysqlResetTokens(nowIso);
  } catch (err: any) {
    console.warn('[PasswordReset] Token cleanup error:', err?.message || err);
    return 0;
  }
}
