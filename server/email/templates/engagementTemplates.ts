/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { escapeHtml, renderBaseEmailLayout, renderEmailButton } from './baseLayout';
import { OrderEmailData, RenderedEmail } from './types';
import { buildUrl, formatKES } from '../urlHelper';

/**
 * Review request sent after delivery
 */
export function renderReviewRequestEmail(order: OrderEmailData & {
  reviewUrl?: string;
  unsubscribeUrl?: string;
}): RenderedEmail {
  const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const reviewUrl = order.reviewUrl || buildUrl(`/shop`);
  const subject = `How was your recent purchase with Ropenix Collections? (${shortId})`;

  const itemsList = order.items.map((it) => `
    <div style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
      <strong>${escapeHtml(it.name)}</strong> (x${it.quantity || 1})
    </div>
  `).join('');

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || 'Customer')}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      We hope you are thoroughly enjoying your recent order <strong>${escapeHtml(shortId)}</strong>!
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 20px 0;">
      <h4 style="margin: 0 0 8px 0; color: #0f172a; font-size: 13px; text-transform: uppercase;">Items in your order:</h4>
      ${itemsList}
    </div>

    <p style="margin: 16px 0; line-height: 1.6; color: #334155;">
      Could you take 30 seconds to rate your experience and the quality of your items? Your review helps our artisan creators and fellow shoppers across Kenya.
    </p>

    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton('Write a Review ⭐⭐⭐⭐⭐', reviewUrl, 'amber')}
    </div>
  `;

  const html = renderBaseEmailLayout({
    title: `Review Your Purchase - ${shortId}`,
    heading: 'How Was Your Experience?',
    badgeText: 'Feedback Request',
    badgeColor: 'amber',
    bodyHtml,
    isMarketing: true,
    unsubscribeUrl: order.unsubscribeUrl,
  });

  const text = `Dear ${order.customerName},\n\nWe hope you love your recent order ${shortId}.\nPlease take 30 seconds to leave a review: ${reviewUrl}`;

  return { subject, html, text };
}

/**
 * Abandoned cart recovery reminder
 */
export function renderAbandonedCartEmail(data: {
  customerName: string;
  items: Array<{ name: string; price: number; quantity: number }>;
  checkoutUrl: string;
  unsubscribeUrl?: string;
}): RenderedEmail {
  const name = data.customerName || 'Customer';
  const subject = `Did you leave something behind at Ropenix Collections?`;

  const itemsList = data.items.map((it) => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px;">
        <strong>${escapeHtml(it.name)}</strong> (x${it.quantity || 1})
      </td>
      <td align="right" style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: 700; font-size: 13px;">
        ${formatKES((it.price || 0) * (it.quantity || 1))}
      </td>
    </tr>
  `).join('');

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(name)}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      You left some great items in your shopping bag! We've saved your selections so you can pick right back up where you left off.
    </p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0;">
      ${itemsList}
    </table>

    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton('Complete Your Order', data.checkoutUrl, 'indigo')}
    </div>
  `;

  const html = renderBaseEmailLayout({
    title: 'Your Saved Shopping Bag',
    heading: 'Your Bag is Waiting For You',
    badgeText: 'Cart Reminder',
    badgeColor: 'indigo',
    bodyHtml,
    isMarketing: true,
    unsubscribeUrl: data.unsubscribeUrl,
  });

  const text = `Dear ${name},\n\nYou left items in your shopping bag on Ropenix Collections.\nComplete your order here: ${data.checkoutUrl}`;

  return { subject, html, text };
}
