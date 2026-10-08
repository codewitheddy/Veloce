/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { escapeHtml, renderBaseEmailLayout, renderEmailButton } from './baseLayout';
import { RenderedEmail } from './types';
import { buildUrl } from '../urlHelper';

export function renderWelcomeEmail(data: {
  name: string;
  email: string;
  verificationUrl?: string;
}): RenderedEmail {
  const name = data.name || 'Valued Customer';
  const shopUrl = buildUrl('/shop');
  const subject = `Welcome to Ropenix Collections, ${name}! 🎉`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(name)}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      We are thrilled to welcome you to <strong>Ropenix Collections</strong>, Kenya's premier shopping destination for curated electronics, bespoke lifestyle essentials, and artisan goods.
    </p>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">What you can do with your account:</h3>
      <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.8;">
        <li>⚡ <strong>Faster Checkout:</strong> Save your delivery addresses and preferences.</li>
        <li>📦 <strong>Real-time Order Tracking:</strong> Track every package from fulfillment to delivery.</li>
        <li>📱 <strong>Direct M-Pesa Verification:</strong> Seamless instant payment clearance via Paybill.</li>
        <li>💎 <strong>Exclusive Member Perks:</strong> Early access to curated drops, flash promotions, and bespoke offers.</li>
      </ul>
    </div>
    ${data.verificationUrl ? `
    <p style="margin: 0 0 12px 0; color: #334155;">
      To verify your email address and activate all account security features, please confirm below:
    </p>
    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton('Verify Email Address', data.verificationUrl, 'indigo')}
    </div>
    <p style="font-size: 12px; color: #64748b;">
      Or copy and paste this verification link into your browser:<br />
      <a href="${escapeHtml(data.verificationUrl)}" style="color: #4f46e5; word-break: break-all;">${escapeHtml(data.verificationUrl)}</a>
    </p>
    ` : `
    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton('Start Exploring Collections', shopUrl, 'indigo')}
    </div>
    `}
    <p style="margin: 24px 0 0 0; color: #475569; font-size: 13px; line-height: 1.6;">
      If you have any questions or need custom styling assistance, our concierge team is always available at <a href="mailto:concierge@ropenix.co.ke" style="color: #4f46e5;">concierge@ropenix.co.ke</a> or hotline <strong>+254 182 180 965</strong>.
    </p>
  `;

  const html = renderBaseEmailLayout({
    title: 'Welcome to Ropenix Collections',
    heading: `Welcome to the Family, ${escapeHtml(name)}!`,
    badgeText: 'New Member Account',
    badgeColor: 'indigo',
    bodyHtml,
  });

  const text = `Dear ${name},\n\nWelcome to Ropenix Collections! We are thrilled to have you join our premier shopping community.\n\n` +
    (data.verificationUrl ? `Please verify your email address here: ${data.verificationUrl}\n\n` : `Explore our collections: ${shopUrl}\n\n`) +
    `Need assistance? Contact our concierge at concierge@ropenix.co.ke or call +254 182 180 965.\n\nWarm regards,\nThe Ropenix Collections Team`;

  return { subject, html, text };
}

export function renderVerifyEmail(data: {
  name: string;
  email: string;
  verificationUrl: string;
}): RenderedEmail {
  const name = data.name || 'Customer';
  const subject = 'Verify your email address - Ropenix Collections';

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Hello <strong>${escapeHtml(name)}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      Thank you for registering with Ropenix Collections. To ensure account security and receive order confirmations, please verify your email address (<strong>${escapeHtml(data.email)}</strong>).
    </p>
    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton('Confirm Email Address', data.verificationUrl, 'indigo')}
    </div>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 12px; color: #64748b;">
      <strong>Link not working?</strong> Copy and paste this URL into your browser:<br />
      <a href="${escapeHtml(data.verificationUrl)}" style="color: #4f46e5; word-break: break-all;">${escapeHtml(data.verificationUrl)}</a>
      <br /><br />
      <em>This verification link will expire in 24 hours. If you did not create this account, you can safely ignore this email.</em>
    </div>
  `;

  const html = renderBaseEmailLayout({
    title: 'Verify Your Email',
    heading: 'Verify Your Email Address',
    badgeText: 'Security Verification',
    badgeColor: 'indigo',
    bodyHtml,
  });

  const text = `Hello ${name},\n\nPlease verify your email address (${data.email}) for Ropenix Collections by clicking this link:\n${data.verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you did not request this, please ignore this email.`;

  return { subject, html, text };
}

export function renderPasswordResetEmail(data: {
  name: string;
  resetUrl: string;
  code?: string;
  expiresInMinutes?: number;
}): RenderedEmail {
  const name = data.name || 'Customer';
  const minutes = data.expiresInMinutes || 15;
  const subject = data.code 
    ? `Password Reset Code: ${data.code} - Ropenix Collections`
    : 'Reset your password - Ropenix Collections';

  const codeSnippet = data.code ? `
    <div style="text-align: center; margin: 24px 0 16px 0;">
      <div style="display: inline-block; background-color: #f8fafc; border: 2px dashed #f59e0b; border-radius: 12px; padding: 14px 32px; letter-spacing: 8px; font-size: 28px; font-weight: 800; font-family: 'Courier New', Courier, monospace; color: #0f172a; user-select: all;">
        ${escapeHtml(data.code)}
      </div>
      <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">Or use the direct button below:</p>
    </div>
  ` : '';

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Hello <strong>${escapeHtml(name)}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      We received a request to reset the password associated with your Ropenix Collections account. You can enter the verification code or click the button below to choose a new password:
    </p>
    ${codeSnippet}
    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton('Reset My Password', data.resetUrl, 'amber')}
    </div>
    <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 12px; color: #92400e;">
      ⚠️ <strong>Security Notice:</strong> This password reset code and link are valid for <strong>${minutes} minutes</strong> and can only be used once.<br />
      If you did not request a password reset, please ignore this email.
    </div>
    <p style="font-size: 12px; color: #64748b;">
      Direct link: <a href="${escapeHtml(data.resetUrl)}" style="color: #d97706; word-break: break-all;">${escapeHtml(data.resetUrl)}</a>
    </p>
  `;

  const html = renderBaseEmailLayout({
    title: 'Password Reset Request',
    heading: 'Reset Your Password',
    badgeText: 'Account Security',
    badgeColor: 'amber',
    bodyHtml,
  });

  const text = `Hello ${name},\n\nWe received a request to reset your Ropenix Collections password.${data.code ? `\n\nYour reset verification code is: ${data.code}` : ''}\n\nReset your password here:\n${data.resetUrl}\n\nThis link is valid for ${minutes} minutes.\nIf you did not request this, please ignore this message.`;

  return { subject, html, text };
}

export function renderRegistrationOtpEmail(data: {
  name: string;
  email: string;
  otp: string;
  expiresInMinutes?: number;
}): RenderedEmail {
  const name = data.name || 'Valued Customer';
  const minutes = data.expiresInMinutes || 10;
  const subject = `Your Verification Code: ${data.otp} - Ropenix Collections`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Hello <strong>${escapeHtml(name)}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      Thank you for registering with <strong>Ropenix Collections</strong>. To complete your account registration and verify your email address, please enter the following 6-digit verification code:
    </p>
    <div style="text-align: center; margin: 28px 0;">
      <div style="display: inline-block; background-color: #f8fafc; border: 2px dashed #4f46e5; border-radius: 12px; padding: 16px 36px; letter-spacing: 10px; font-size: 32px; font-weight: 800; font-family: 'Courier New', Courier, monospace; color: #0f172a; user-select: all;">
        ${escapeHtml(data.otp)}
      </div>
    </div>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 13px; color: #475569; line-height: 1.6;">
      ⏱️ <strong>Expiration Notice:</strong> This code will expire in <strong>${minutes} minutes</strong>.<br />
      🔒 <strong>Security Warning:</strong> Never share this verification code with anyone. Ropenix staff will never ask for your code.<br />
      ℹ️ If you didn't request this, ignore this email.
    </div>
    <p style="margin: 20px 0 0 0; color: #64748b; font-size: 12px;">
      Code requested for: <strong>${escapeHtml(data.email)}</strong>
    </p>
  `;

  const html = renderBaseEmailLayout({
    title: 'Verify Your Email',
    heading: 'Your Verification Code',
    badgeText: 'One-Time Verification Code',
    badgeColor: 'indigo',
    bodyHtml,
  });

  const text = `Hello ${name},\n\nYour Ropenix Collections verification code is: ${data.otp}\n\nThis code will expire in ${minutes} minutes.\n\nIf you didn't request this, ignore this email.`;

  return { subject, html, text };
}

export function renderPasswordChangedEmail(data: {
  name: string;
  timestamp?: string;
}): RenderedEmail {
  const name = data.name || 'Customer';
  const timestamp = data.timestamp || new Date().toUTCString();
  const resetUrl = buildUrl('/reset-password');
  const subject = 'Security Alert: Password Changed - Ropenix Collections';

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Hello <strong>${escapeHtml(name)}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      This email confirms that the password for your Ropenix Collections account was successfully updated on <strong>${escapeHtml(timestamp)}</strong>.
    </p>
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 13px; color: #166534;">
      ✅ <strong>Your account is secure.</strong> If you made this change, no further action is required.
    </div>
    <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 12px; color: #9f1239;">
      🚨 <strong>Did not make this change?</strong> Your account may be compromised. Please <a href="${escapeHtml(resetUrl)}" style="color: #e11d48; font-weight: 700;">reset your password immediately</a> and contact our security team at <a href="mailto:admin@ropenix.co.ke" style="color: #e11d48;">admin@ropenix.co.ke</a> or hotline <strong>+254 182 180 965</strong>.
    </div>
  `;

  const html = renderBaseEmailLayout({
    title: 'Password Updated',
    heading: 'Password Successfully Changed',
    badgeText: 'Security Alert',
    badgeColor: 'emerald',
    bodyHtml,
  });

  const text = `Hello ${name},\n\nYour Ropenix Collections password was successfully updated on ${timestamp}.\n\nIf you made this change, no further action is needed.\nIf you did NOT make this change, please reset your password immediately at ${resetUrl} or contact support at +254 182 180 965.`;

  return { subject, html, text };
}
