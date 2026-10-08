/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { 
  getSqliteUserByEmail, 
  getSqliteUserById,
  saveSqliteUser, 
  getSqlitePendingRegistration, 
  saveSqlitePendingRegistration, 
  deleteSqlitePendingRegistration, 
  updateSqlitePendingRegistrationAttempts, 
  getFlaggedDuplicateAccounts,
  saveSqliteCustomer,
  saveSqlitePasswordReset,
  getSqliteActivePasswordReset,
  markSqlitePasswordResetUsed,
  incrementSqlitePasswordResetAttempts,
  updateSqliteUserPassword
} from '../../src/lib/sqlite-db';
import { validateBody } from '../middleware/validate';
import { createRateLimiter } from '../middleware/rateLimit';
import { createAccessToken, createRefreshToken, verifySignedToken } from '../middleware/auth';
import { sendEmail } from '../email/transporter';
import { renderRegistrationOtpEmail, renderPasswordResetEmail, renderPasswordChangedEmail } from '../email/templates';
import { config } from '../config';
import {
  requestPasswordReset,
  resetPasswordWithToken,
  GENERIC_FORGOT_PASSWORD_MESSAGE
} from '../services/passwordResetService';

const router = Router();

// Validation Schemas
const EmailField = z.string().transform(val => val.trim().toLowerCase()).pipe(z.string().email('Please enter a valid email address.'));
const OtpField = z.string().transform(val => val.trim()).pipe(z.string().regex(/^\d{6}$/, 'OTP must be a 6-digit code.'));

const RegisterSchema = z.object({
  email: EmailField,
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
});

const VerifyOtpSchema = z.object({
  email: EmailField,
  otp: OtpField,
});

const ResendOtpSchema = z.object({
  email: EmailField,
});

const LoginSchema = z.object({
  email: z.string().optional(),
  username: z.string().optional(),
  password: z.string().min(1, 'Password is required.'),
});

const ForgotPasswordSchema = z.object({
  email: EmailField,
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Password reset token is required.').optional(),
  otp: z.string().optional(),
  email: EmailField.optional(),
  password: z.string().min(8, 'Password must be at least 8 characters long.').optional(),
  new_password: z.string().min(8, 'Password must be at least 8 characters long.').optional(),
  confirmPassword: z.string().optional(),
  confirm_password: z.string().optional(),
}).refine(
  (data) => {
    const rawToken = data.token || data.otp;
    const pwd = data.password || data.new_password;
    if (!rawToken || !pwd) return false;
    const confirm = data.confirmPassword || data.confirm_password;
    if (confirm && confirm !== pwd) return false;
    return true;
  },
  {
    message: 'Valid token and matching passwords (min 8 characters) are required.',
    path: ['token'],
  }
);

// Security & Crypto Helpers
function normalizeEmail(email: string | undefined | null): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function hashOtp(otp: string): string {
  return crypto.createHmac('sha256', config.secrets.otpHmac).update(otp.trim()).digest('hex');
}

function verifyOtpHash(inputOtp: string, storedHash: string): boolean {
  try {
    const inputHash = hashOtp(inputOtp);
    const bufA = Buffer.from(inputHash, 'hex');
    const bufB = Buffer.from(storedHash, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (!storedHash) return false;
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, originalHash] = parts;
    const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    const bufA = Buffer.from(computedHash, 'hex');
    const bufB = Buffer.from(originalHash, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// Rate limiters
const registerRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many registration requests from this IP address. Please wait 15 minutes before trying again.'
});

const verifyOtpRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many verification attempts. Please wait 15 minutes before trying again.',
  keyGenerator: (req) => {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
    const email = normalizeEmail(req.body?.email);
    return `${ip}_${email}`;
  }
});

// 1. POST /api/auth/register
router.post(
  ['/register', '/register/'],
  registerRateLimiter,
  validateBody(RegisterSchema),
  async (req: Request, res: Response) => {
    try {
      const { email, password, username, first_name, last_name, phone } = req.body;
      const normalizedEmail = normalizeEmail(email);
      const cleanUsername = String(username || normalizedEmail.split('@')[0] || 'user').trim();
      const cleanFirstName = String(first_name || '').trim();
      const cleanLastName = String(last_name || '').trim();
      const cleanPhone = String(phone || '').trim();

      // Check if account already exists
      const existingUser = await getSqliteUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email already exists.',
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists. Please sign in or reset your password.'
        });
      }

      // Generate cryptographically secure 6-digit OTP
      const isDev = config.isDev;
      const testOtpHeader = req.headers['x-test-otp'];
      const otp = (isDev && testOtpHeader && typeof testOtpHeader === 'string' && /^\d{6}$/.test(testOtpHeader))
        ? testOtpHeader
        : crypto.randomInt(100000, 1000000).toString();

      const otpHash = hashOtp(otp);
      const passwordHash = hashPassword(password);
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();

      // Overwrite any existing pending registration for this normalized email
      await saveSqlitePendingRegistration({
        email: normalizedEmail,
        username: cleanUsername,
        first_name: cleanFirstName,
        last_name: cleanLastName,
        password_hash: passwordHash,
        phone: cleanPhone,
        otp_hash: otpHash,
        otp_expires_at: otpExpiresAt,
        attempts: 0,
        max_attempts: 5,
        last_sent_at: new Date().toISOString(),
        resend_count: 0,
        resend_window_start: new Date().toISOString(),
        ip_address: clientIp
      });

      // Dispatch Transactional Email
      try {
        const emailContent = renderRegistrationOtpEmail({
          name: cleanFirstName || 'Valued Customer',
          email: normalizedEmail,
          otp: otp,
          expiresInMinutes: 10
        });

        await sendEmail({
          to: normalizedEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text
        });
      } catch (mailErr) {
        console.error('[Registration Email Error]:', mailErr);
        await deleteSqlitePendingRegistration(normalizedEmail);
        return res.status(500).json({
          success: false,
          error: 'Unable to send verification email at this time. Please check your email address and try again.',
          code: 'EMAIL_SEND_FAILED'
        });
      }

      return res.status(200).json({
        success: true,
        requires_otp: true,
        message: `A 6-digit verification code has been dispatched to ${normalizedEmail}.`,
        email: normalizedEmail,
        expires_in_seconds: 600,
        cooldown_seconds: 60
      });
    } catch (err: any) {
      console.error('[Auth Register Error]:', err);
      return res.status(500).json({ success: false, error: err.message || 'Registration failed', code: 'SERVER_ERROR' });
    }
  }
);

// 2. POST /api/auth/verify-otp
router.post(
  ['/verify-otp', '/verify-otp/'],
  verifyOtpRateLimiter,
  validateBody(VerifyOtpSchema),
  async (req: Request, res: Response) => {
    try {
      const { email, otp } = req.body;
      const normalizedEmail = normalizeEmail(email);

      const pending = await getSqlitePendingRegistration(normalizedEmail);
      if (!pending) {
        return res.status(400).json({
          success: false,
          error: 'No pending registration found or session has expired. Please register again.',
          code: 'SESSION_NOT_FOUND'
        });
      }

      // Expiration check (10 minutes)
      if (new Date(pending.otp_expires_at).getTime() < Date.now()) {
        await deleteSqlitePendingRegistration(normalizedEmail);
        return res.status(400).json({
          success: false,
          error: 'Verification code has expired. Please request a new code.',
          code: 'OTP_EXPIRED'
        });
      }

      // Max attempts lockout (5 attempts)
      if (pending.attempts >= pending.max_attempts) {
        await deleteSqlitePendingRegistration(normalizedEmail);
        return res.status(400).json({
          success: false,
          error: 'Too many incorrect attempts. For your security, this verification code has been invalidated. Please request a new code.',
          code: 'TOO_MANY_ATTEMPTS'
        });
      }

      // Constant-time OTP comparison
      const isCodeValid = verifyOtpHash(otp, pending.otp_hash);
      if (!isCodeValid) {
        const newAttempts = pending.attempts + 1;
        await updateSqlitePendingRegistrationAttempts(normalizedEmail, newAttempts);

        if (newAttempts >= pending.max_attempts) {
          await deleteSqlitePendingRegistration(normalizedEmail);
          return res.status(400).json({
            success: false,
            error: 'Incorrect verification code. Maximum attempts reached. Please request a new code.',
            code: 'TOO_MANY_ATTEMPTS',
            remaining_attempts: 0
          });
        }

        const remaining = pending.max_attempts - newAttempts;
        return res.status(400).json({
          success: false,
          error: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
          code: 'INVALID_OTP',
          remaining_attempts: remaining
        });
      }

      // Check unique constraint race condition
      const duplicateCheck = await getSqliteUserByEmail(normalizedEmail);
      if (duplicateCheck) {
        await deleteSqlitePendingRegistration(normalizedEmail);
        return res.status(409).json({
          success: false,
          error: 'An account with this email already exists.',
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists. Please log in or reset your password.'
        });
      }

      // Create authoritative user in database
      const newUserId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      let savedUser: any;
      try {
        savedUser = await saveSqliteUser({
          id: newUserId,
          username: pending.username,
          email: normalizedEmail,
          password_hash: pending.password_hash,
          first_name: pending.first_name,
          last_name: pending.last_name,
          phone: pending.phone,
          is_staff: 0,
          is_superuser: 0,
          email_verified: 1,
          referral_code: `REF-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          partner_tier: 'Silver',
        });
      } catch (dbErr: any) {
        await deleteSqlitePendingRegistration(normalizedEmail);
        return res.status(409).json({
          success: false,
          error: 'An account with this email already exists.',
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists. Please log in or reset your password.'
        });
      }

      // Delete single-use pending registration
      await deleteSqlitePendingRegistration(normalizedEmail);

      // Create CRM customer record
      try {
        await saveSqliteCustomer({
          name: `${savedUser.first_name} ${savedUser.last_name}`.trim() || savedUser.username,
          first_name: savedUser.first_name || '',
          last_name: savedUser.last_name || '',
          email: savedUser.email,
          phone: savedUser.phone || '',
          is_registered: 1
        });
      } catch (_) {}

      const userPayload = {
        id: savedUser.id,
        username: savedUser.username,
        email: savedUser.email,
        first_name: savedUser.first_name || '',
        last_name: savedUser.last_name || '',
        phone: savedUser.phone || '',
        is_staff: false,
        is_superuser: false,
        email_verified: true,
        role: 'customer'
      };

      return res.status(200).json({
        success: true,
        verified: true,
        message: 'Email verified successfully! Welcome to Ropenix Collections.',
        access: `access-token-${savedUser.id}-${Date.now()}`,
        refresh: `refresh-token-${savedUser.id}-${Date.now()}`,
        user: userPayload,
        role: 'customer'
      });
    } catch (err: any) {
      console.error('[Auth Verify OTP Error]:', err);
      return res.status(500).json({ success: false, error: err.message || 'OTP verification failed', code: 'SERVER_ERROR' });
    }
  }
);

// 3. POST /api/auth/resend-otp
router.post(
  ['/resend-otp', '/resend-otp/'],
  validateBody(ResendOtpSchema),
  async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      const normalizedEmail = normalizeEmail(email);

      const pending = await getSqlitePendingRegistration(normalizedEmail);
      if (!pending) {
        return res.status(404).json({
          success: false,
          error: 'No pending registration found for this email. Please submit the registration form again.',
          code: 'SESSION_NOT_FOUND'
        });
      }

      const isTestOrDev = config.isDev || process.env.NODE_ENV === 'test' || Boolean(req.headers['x-test-otp']);

      // 60-second cooldown check (bypassed in test/dev with test header)
      const secondsSinceLastSent = (Date.now() - new Date(pending.last_sent_at).getTime()) / 1000;
      if (!isTestOrDev && secondsSinceLastSent < 60) {
        const remainingSeconds = Math.ceil(60 - secondsSinceLastSent);
        return res.status(429).json({
          success: false,
          error: `Please wait ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'} before requesting another code.`,
          code: 'COOLDOWN_ACTIVE',
          retry_after_seconds: remainingSeconds
        });
      }

      // 1-hour rolling cap (max 3 resends per hour)
      const windowAgeSeconds = (Date.now() - new Date(pending.resend_window_start).getTime()) / 1000;
      let currentResendCount = pending.resend_count;
      let currentWindowStart = pending.resend_window_start;

      if (windowAgeSeconds > 3600) {
        currentResendCount = 0;
        currentWindowStart = new Date().toISOString();
      }

      if (currentResendCount >= 3) {
        return res.status(429).json({
          success: false,
          error: 'You have reached the maximum number of resend requests (3 per hour). Please wait before requesting another code.',
          code: 'RESEND_LIMIT_EXCEEDED'
        });
      }

      const isDev = config.isDev;
      const testOtpHeader = req.headers['x-test-otp'];
      const newOtp = (isDev && testOtpHeader && typeof testOtpHeader === 'string' && /^\d{6}$/.test(testOtpHeader))
        ? testOtpHeader
        : crypto.randomInt(100000, 1000000).toString();

      const newOtpHash = hashOtp(newOtp);
      const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await saveSqlitePendingRegistration({
        ...pending,
        otp_hash: newOtpHash,
        otp_expires_at: newExpiresAt,
        attempts: 0,
        last_sent_at: new Date().toISOString(),
        resend_count: currentResendCount + 1,
        resend_window_start: currentWindowStart
      });

      // Dispatch fresh OTP email
      try {
        const emailContent = renderRegistrationOtpEmail({
          name: pending.first_name || 'Valued Customer',
          email: normalizedEmail,
          otp: newOtp,
          expiresInMinutes: 10
        });

        await sendEmail({
          to: normalizedEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text
        });
      } catch (mailErr) {
        console.error('[Resend OTP Email Error]:', mailErr);
        return res.status(500).json({
          success: false,
          error: 'Unable to send verification email. Please try again in a few moments.',
          code: 'EMAIL_SEND_FAILED'
        });
      }

      return res.status(200).json({
        success: true,
        message: `A new verification code has been dispatched to ${normalizedEmail}.`,
        cooldown_seconds: 60,
        resend_count: currentResendCount + 1
      });
    } catch (err: any) {
      console.error('[Auth Resend OTP Error]:', err);
      return res.status(500).json({ success: false, error: err.message || 'Resend failed', code: 'SERVER_ERROR' });
    }
  }
);

// 4. POST /api/auth/login & /api/auth/token (Password-only, no OTP)
async function handleUserLogin(req: Request, res: Response) {
  try {
    const { username, email, password } = req.body || {};
    const userIdentifier = normalizeEmail(email || username);

    if (!userIdentifier || !password) {
      return res.status(400).json({ success: false, error: 'Email/username and password are required.', code: 'MISSING_CREDENTIALS' });
    }

    const user = await getSqliteUserByEmail(userIdentifier);
    if (!user || !user.password_hash || typeof user.password_hash !== 'string' || !user.password_hash.includes(':')) {
      return res.status(401).json({ success: false, error: 'Invalid email or password. Please check your credentials.', code: 'INVALID_CREDENTIALS' });
    }

    const isMatch = verifyPassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password. Please check your credentials.', code: 'INVALID_CREDENTIALS' });
    }

    const userProfile = {
      id: String(user.id),
      username: user.username,
      email: user.email,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      is_staff: Boolean(user.is_staff),
      is_superuser: Boolean(user.is_superuser),
      email_verified: Boolean(user.email_verified),
      role: user.is_superuser || user.is_staff ? ('admin' as const) : ('customer' as const)
    };

    const access = createAccessToken(userProfile);
    const refresh = createRefreshToken(userProfile);

    return res.json({
      success: true,
      access,
      refresh,
      user: userProfile,
      is_superuser: Boolean(user.is_superuser),
      is_staff: Boolean(user.is_staff),
      role: userProfile.role
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Login failed', code: 'SERVER_ERROR' });
  }
}

router.post(['/login', '/login/'], validateBody(LoginSchema), handleUserLogin);
router.post(['/token', '/token/'], validateBody(LoginSchema), handleUserLogin);

// 5. POST /api/auth/superuser-login
router.post(['/superuser-login', '/superuser-login/'], async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body || {};
    const cleanUser = normalizeEmail(email || username);

    if (!cleanUser || !password) {
      return res.status(400).json({ success: false, error: 'Username/email and password are required.', code: 'MISSING_CREDENTIALS' });
    }

    const superuser = await getSqliteUserByEmail(cleanUser);
    if (!superuser || (!superuser.is_superuser && !superuser.is_staff)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid superuser credentials. Please check username and password.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    if (!superuser.password_hash || typeof superuser.password_hash !== 'string' || !superuser.password_hash.includes(':')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid superuser credentials. Please check username and password.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const isMatch = verifyPassword(password, superuser.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid superuser credentials. Please check username and password.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const userProfile = {
      id: String(superuser.id),
      username: superuser.username,
      email: superuser.email,
      first_name: superuser.first_name || '',
      last_name: superuser.last_name || '',
      phone: superuser.phone || '',
      is_staff: true,
      is_superuser: true,
      email_verified: Boolean(superuser.email_verified),
      role: 'admin' as const
    };

    const access = createAccessToken(userProfile);
    const refresh = createRefreshToken(userProfile);

    return res.json({
      success: true,
      message: 'Superuser authenticated successfully.',
      access,
      refresh,
      user: userProfile
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Superuser login failed', code: 'SERVER_ERROR' });
  }
});

// 6. POST /api/auth/token/refresh
router.post(['/token/refresh', '/token/refresh/'], async (req: Request, res: Response) => {
  try {
    const refresh =
      req.body?.refresh ||
      req.headers['x-refresh-token'] ||
      (req.headers.cookie ? req.headers.cookie.match(/(?:refresh_token|veloce_refresh_token)=([^;]+)/)?.[1] : null);

    if (!refresh || typeof refresh !== 'string') {
      return res.status(400).json({ success: false, error: 'Refresh token is required.', code: 'MISSING_TOKEN' });
    }

    const payload = verifySignedToken(refresh.trim());
    if (!payload || payload.type !== 'refresh' || !payload.sub) {
      return res.status(401).json({ success: false, error: 'Invalid or expired refresh token.', code: 'INVALID_TOKEN' });
    }

    const user = await getSqliteUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User account not found.', code: 'INVALID_TOKEN' });
    }

    const userProfile = {
      id: String(user.id),
      username: user.username,
      email: user.email,
      is_staff: Boolean(user.is_staff),
      is_superuser: Boolean(user.is_superuser),
      role: user.is_superuser || user.is_staff ? ('admin' as const) : ('customer' as const)
    };

    const newAccess = createAccessToken(userProfile);
    const newRefresh = createRefreshToken(userProfile);

    return res.json({
      success: true,
      access: newAccess,
      refresh: newRefresh,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Token refresh failed', code: 'SERVER_ERROR' });
  }
});

// Rate limiters for password reset endpoints
const forgotPasswordRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many password reset requests. Please try again in 15 minutes.',
  keyGenerator: (req) => {
    const email = (req.body?.email || '').trim().toLowerCase();
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    return `forgot_pwd_${ip}_${email}`;
  }
});

const resetPasswordRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many password reset attempts. Please try again in 15 minutes.',
  keyGenerator: (req) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    return `reset_pwd_${ip}`;
  }
});

// 7. POST /api/auth/forgot-password & /api/auth/password-reset/request
async function handleForgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body || {};
    const clientHost = req.get('host') || 'localhost:3000';
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const originUrl = `${protocol}://${clientHost}`;

    const result = await requestPasswordReset(email, String(req.ip || ''), originUrl);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[Forgot Password Error]:', err);
    return res.status(200).json({
      success: true,
      message: GENERIC_FORGOT_PASSWORD_MESSAGE
    });
  }
}

router.post(
  ['/forgot-password', '/forgot-password/', '/password-reset/request'],
  forgotPasswordRateLimiter,
  validateBody(ForgotPasswordSchema),
  handleForgotPassword
);

// 8. POST /api/auth/reset-password & /api/auth/password-reset/confirm
async function handleResetPassword(req: Request, res: Response) {
  try {
    const { token, otp, password, new_password, confirmPassword, confirm_password } = req.body || {};
    const rawToken = (token || otp || '').trim();
    const newPassword = password || new_password;

    if (!rawToken) {
      return res.status(400).json({
        success: false,
        error: 'Password reset token is required.',
        code: 'MISSING_TOKEN'
      });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long.',
        code: 'WEAK_PASSWORD'
      });
    }

    const confirm = confirmPassword || confirm_password;
    if (confirm && confirm !== newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match.',
        code: 'PASSWORD_MISMATCH'
      });
    }

    const resetRes = await resetPasswordWithToken(rawToken, newPassword, String(req.ip || ''));
    if (!resetRes.success) {
      const statusCode = resetRes.code === 'WEAK_PASSWORD' ? 400 : (resetRes.code === 'TOKEN_ALREADY_USED' ? 409 : 400);
      return res.status(statusCode).json(resetRes);
    }

    // Invalidate user sessions / cookies
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.clearCookie('token');

    return res.status(200).json({
      success: true,
      message: 'Password updated. Please log in.'
    });
  } catch (err: any) {
    console.error('[Reset Password Error]:', err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while resetting your password.',
      code: 'SERVER_ERROR'
    });
  }
}

router.post(
  ['/reset-password', '/reset-password/', '/password-reset/confirm'],
  resetPasswordRateLimiter,
  validateBody(ResetPasswordSchema),
  handleResetPassword
);

// 9. POST /api/auth/logout
router.post(['/logout', '/logout/'], (_req: Request, res: Response) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.clearCookie('token');
  return res.json({ success: true, message: 'Successfully signed out.' });
});

export default router;

