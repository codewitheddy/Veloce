/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getEmailConfig } from '../config';
import { buildUrl } from '../urlHelper';

export interface BaseLayoutOptions {
  title?: string;
  preheader?: string;
  heading?: string;
  badgeText?: string;
  badgeColor?: 'indigo' | 'emerald' | 'amber' | 'rose';
  bodyHtml: string;
  unsubscribeUrl?: string;
  isMarketing?: boolean;
}

/**
 * Escapes HTML characters to prevent XSS / HTML injection in email templates
 */
export function escapeHtml(unsafe: string | number | undefined | null): string {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Reusable Paybill Instruction Box Component
 */
export function renderPaybillBox(totalFormatted: string, orderNumber: string): string {
  const config = getEmailConfig();
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0; background-color: #f0fdf4; border: 2px dashed #16a34a; border-radius: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding-bottom: 12px;">
                <span style="display: inline-block; background-color: #16a34a; color: #ffffff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                  📱 M-PESA PAYBILL PAYMENT INSTRUCTIONS
                </span>
              </td>
            </tr>
            <tr>
              <td style="font-size: 13px; line-height: 1.6; color: #166534;">
                Please complete your payment via M-Pesa to initiate immediate dispatch:
              </td>
            </tr>
            <tr>
              <td style="padding-top: 12px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 8px; border: 1px solid #bbf7d0;">
                  <tr>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #dcfce7; font-size: 13px; color: #374151; width: 40%;"><strong>1. Paybill (Business No):</strong></td>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #dcfce7; font-size: 14px; font-family: monospace; font-weight: 700; color: #15803d;">${config.paybill.number}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #dcfce7; font-size: 13px; color: #374151;"><strong>2. Account Number:</strong></td>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #dcfce7; font-size: 14px; font-family: monospace; font-weight: 700; color: #15803d;">
                      ${config.paybill.accountNumber} <span style="font-size: 11px; font-weight: normal; color: #6b7280;">(Fixed shared account)</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #dcfce7; font-size: 13px; color: #374151;"><strong>3. Exact Amount:</strong></td>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #dcfce7; font-size: 15px; font-weight: 800; color: #111827;">${totalFormatted}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 14px; font-size: 13px; color: #374151;"><strong>4. Verified Business Name:</strong></td>
                    <td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #065f46;">
                      "${config.paybill.accountName}"
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 14px; font-size: 12px; line-height: 1.5; color: #15803d;">
                💡 <strong>Important Note:</strong> The Account Number (<code>${config.paybill.accountNumber}</code>) is the same for all customers, and your M-Pesa SMS confirmation will show <strong>${config.paybill.accountName}</strong>. 
                <br />
                Once paid, click <strong>"I've Paid"</strong> on your order page to submit your M-Pesa transaction code, or reply quoting your Order Number (<strong>${escapeHtml(orderNumber)}</strong>).
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Reusable Button Component for Email Templates
 */
export function renderEmailButton(text: string, url: string, color: 'indigo' | 'emerald' | 'amber' | 'rose' = 'indigo'): string {
  const bg = color === 'emerald' ? '#16a34a' : color === 'amber' ? '#d97706' : color === 'rose' ? '#e11d48' : '#4f46e5';
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td align="center" style="border-radius: 8px; background: ${bg};">
          <a href="${escapeHtml(url)}" target="_blank" style="font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #ffffff; text-decoration: none; border-radius: 8px; padding: 12px 26px; border: 1px solid ${bg}; display: inline-block; font-weight: 700; letter-spacing: 0.3px;">
            ${escapeHtml(text)} &rarr;
          </a>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Standard Responsive HTML Base Email Layout
 */
export function renderBaseEmailLayout(options: BaseLayoutOptions): string {
  const config = getEmailConfig();
  const storeUrl = buildUrl('/');
  const logoUrl = buildUrl('/favicon.svg');
  const supportEmail = config.smtp.replyTo;
  const unsubscribeUrl = options.unsubscribeUrl || buildUrl('/unsubscribe');

  const badgeBg = options.badgeColor === 'emerald' ? '#ecfdf5' : options.badgeColor === 'amber' ? '#fffbeb' : options.badgeColor === 'rose' ? '#fff1f2' : '#eef2ff';
  const badgeText = options.badgeColor === 'emerald' ? '#065f46' : options.badgeColor === 'amber' ? '#92400e' : options.badgeColor === 'rose' ? '#9f1239' : '#3730a3';
  const badgeBorder = options.badgeColor === 'emerald' ? '#a7f3d0' : options.badgeColor === 'amber' ? '#fde68a' : options.badgeColor === 'rose' ? '#fecdd3' : '#c7d2fe';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(options.title || 'Ropenix Collections Notification')}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; margin: auto !important; }
      .fluid-padding { padding-left: 16px !important; padding-right: 16px !important; }
    }
  </style>
</head>
<body style="background-color: #f8fafc; margin: 0; padding: 0;">
  <!-- Preheader preview text in email clients -->
  <div style="display: none; font-size: 1px; color: #f8fafc; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${escapeHtml(options.preheader || options.heading || 'Update from Ropenix Collections')}
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 24px 0 32px 0;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px 32px; text-align: center; border-bottom: 3px solid #4f46e5;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(storeUrl)}" target="_blank" style="text-decoration: none;">
                      <span style="color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; display: inline-block;">
                        ROPENIX <span style="color: #818cf8;">COLLECTIONS</span>
                      </span>
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 4px;">
                    <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                      Kenya's Premier Online Hub
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Heading & Badge Area -->
          ${(options.heading || options.badgeText) ? `
          <tr>
            <td style="padding: 24px 32px 8px 32px;" class="fluid-padding">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                ${options.badgeText ? `
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeText}; border: 1px solid ${badgeBorder}; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                      ${escapeHtml(options.badgeText)}
                    </span>
                  </td>
                </tr>
                ` : ''}
                ${options.heading ? `
                <tr>
                  <td style="font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                    ${escapeHtml(options.heading)}
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Body Content Area -->
          <tr>
            <td style="padding: 16px 32px 32px 32px; font-size: 14px; line-height: 1.6; color: #334155;" class="fluid-padding">
              ${options.bodyHtml}
            </td>
          </tr>

          <!-- Footer Area -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 24px 32px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;" class="fluid-padding">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="font-size: 12px; color: #475569; font-weight: 600; padding-bottom: 8px;">
                    Need assistance with your order?
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size: 12px; color: #64748b; padding-bottom: 12px;">
                    Email: <a href="mailto:${escapeHtml(supportEmail)}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">${escapeHtml(supportEmail)}</a> &bull; Hotline: <strong style="color: #334155;">+254 182 180 965</strong>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="border-top: 1px solid #cbd5e1; padding-top: 12px; font-size: 11px; color: #94a3b8;">
                    <strong>${escapeHtml(config.paybill.accountName)}</strong> &bull; Nairobi, Kenya
                    <br />
                    Storefront: <a href="${escapeHtml(storeUrl)}" style="color: #64748b; text-decoration: underline;">${escapeHtml(config.urls.frontendUrl)}</a>
                  </td>
                </tr>
                ${options.isMarketing ? `
                <tr>
                  <td align="center" style="padding-top: 8px; font-size: 11px; color: #94a3b8;">
                    You are receiving this email because you opted into updates. <a href="${escapeHtml(unsubscribeUrl)}" style="color: #64748b; text-decoration: underline;">Unsubscribe</a>
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
