/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { escapeHtml, renderBaseEmailLayout, renderEmailButton, renderPaybillBox } from './baseLayout';
import { OrderEmailData, RenderedEmail } from './types';
import { buildUrl, buildTrackUrl, formatKES, formatEATDate } from '../urlHelper';

/**
 * Renders an HTML table of items in an order
 */
function renderOrderItemsTable(items: OrderEmailData['items']): string {
  if (!items || items.length === 0) {
    return `<p style="color: #64748b; font-size: 13px;">No item details available.</p>`;
  }

  const rows = items.map((item) => {
    const rawPrice = item.price !== undefined ? item.price : (item as any).unit_price;
    const unitPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice) || '0');
    const itemName = item.name || (item as any).product_name || 'Product Item';
    const qty = item.quantity || 1;
    const lineTotal = unitPrice * qty;
    const variationsObj = item.selectedVariations || (item as any).selected_variations;
    const variations = variationsObj && Object.keys(variationsObj).length > 0
      ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${Object.entries(variationsObj).map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(String(v))}`).join(' | ')}</div>`
      : '';

    return `
      <tr>
        <td style="padding: 12px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle;">
          <div style="font-weight: 600; color: #1e293b; font-size: 13px;">${escapeHtml(itemName)}</div>
          ${variations}
        </td>
        <td align="center" style="padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 13px; vertical-align: middle;">
          ${qty}
        </td>
        <td align="right" style="padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 13px; vertical-align: middle;">
          ${formatKES(unitPrice)}
        </td>
        <td align="right" style="padding: 12px 8px; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #0f172a; font-size: 13px; vertical-align: middle;">
          ${formatKES(lineTotal)}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0; border-collapse: collapse;">
      <thead>
        <tr style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
          <th align="left" style="padding: 10px 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Item Description</th>
          <th align="center" style="padding: 10px 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; width: 50px;">Qty</th>
          <th align="right" style="padding: 10px 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; width: 90px;">Price</th>
          <th align="right" style="padding: 10px 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; width: 95px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Renders totals breakdown (subtotal, shipping, discount, total)
 */
function renderOrderTotals(order: OrderEmailData): string {
  const subtotal = order.subtotal !== undefined ? order.subtotal : order.total;
  const shipping = order.shippingFee || 0;
  const discount = order.discount || 0;
  const total = order.total;

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 12px; margin-bottom: 20px;">
      <tr>
        <td style="width: 50%;"></td>
        <td style="width: 50%;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; color: #475569;">
            ${order.subtotal !== undefined ? `
            <tr>
              <td style="padding: 4px 8px; text-align: right;">Subtotal:</td>
              <td style="padding: 4px 8px; text-align: right; font-weight: 600; color: #334155;">${formatKES(subtotal)}</td>
            </tr>
            ` : ''}
            ${shipping > 0 ? `
            <tr>
              <td style="padding: 4px 8px; text-align: right;">Shipping / Delivery:</td>
              <td style="padding: 4px 8px; text-align: right; font-weight: 600; color: #334155;">${formatKES(shipping)}</td>
            </tr>
            ` : ''}
            ${discount > 0 ? `
            <tr>
              <td style="padding: 4px 8px; text-align: right; color: #16a34a;">Discount:</td>
              <td style="padding: 4px 8px; text-align: right; font-weight: 600; color: #16a34a;">-${formatKES(discount)}</td>
            </tr>
            ` : ''}
            <tr style="border-top: 2px solid #0f172a;">
              <td style="padding: 10px 8px; text-align: right; font-size: 15px; font-weight: 800; color: #0f172a;">Total Due:</td>
              <td style="padding: 10px 8px; text-align: right; font-size: 16px; font-weight: 800; color: #0f172a;">${formatKES(total)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

/**
 * 1. Order Confirmation Email (Sent immediately on order creation)
 */
export function renderOrderConfirmationEmail(order: OrderEmailData): RenderedEmail {
  const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const totalFormatted = formatKES(order.total);
  const trackUrl = buildTrackUrl(order.id);
  const isGuest = Boolean(order.isGuest || !order.userId);
  const subject = `Order Confirmed: ${shortId} (${totalFormatted}) - Ropenix Collections`;

  const method = (order.paymentMethod || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const isMpesa = !method || method.includes('mpesa') || method.includes('paybill') || method === 'manual' || method === 'cod' || method === 'pending';

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || 'Customer')}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      Thank you for shopping with <strong>Ropenix Collections</strong>! We have received your order <strong>${escapeHtml(shortId)}</strong> and our team is preparing it for fulfillment.
    </p>

    <!-- Order Metadata Box -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 20px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #64748b; width: 40%;"><strong>Order Reference:</strong></td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 700; font-family: monospace;">${escapeHtml(shortId)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b;"><strong>Order Date:</strong></td>
          <td style="padding: 4px 0; color: #0f172a;">${formatEATDate(order.createdAt || new Date())}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b;"><strong>Payment Method:</strong></td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 600;">${escapeHtml(order.paymentMethod || 'M-PESA Paybill')}</td>
        </tr>
        ${order.paymentReference ? `
        <tr>
          <td style="padding: 4px 0; color: #64748b;"><strong>Payment Reference:</strong></td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 700; font-family: monospace;">${escapeHtml(order.paymentReference)}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 4px 0; color: #64748b;"><strong>Payment Status:</strong></td>
          <td style="padding: 4px 0; color: #0284c7; font-weight: 700;">Pending Admin Verification</td>
        </tr>
        ${order.shippingAddress ? `
        <tr>
          <td style="padding: 4px 0; color: #64748b; vertical-align: top;"><strong>Delivery Address:</strong></td>
          <td style="padding: 4px 0; color: #0f172a;">${escapeHtml(order.shippingAddress)}</td>
        </tr>
        ` : ''}
      </table>
    </div>

    <!-- Items Table & Totals -->
    <h3 style="margin: 24px 0 8px 0; font-size: 15px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Order Breakdown</h3>
    ${renderOrderItemsTable(order.items)}
    ${renderOrderTotals(order)}

    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton('Track Order Status', trackUrl, 'indigo')}
    </div>

    <p style="margin: 20px 0 0 0; font-size: 13px; color: #475569; line-height: 1.6;">
      Our store administration will verify your payment details and update the order status. You will receive an email update once your order is processed. If you have any questions, reply directly to this email.
    </p>
  `;

  const html = renderBaseEmailLayout({
    title: `Order Confirmation ${shortId}`,
    heading: `Order Received: ${shortId}`,
    badgeText: 'Order Placed',
    badgeColor: 'indigo',
    bodyHtml,
  });

  const text = `Dear ${order.customerName},\n\nThank you for your order ${shortId} on Ropenix Collections.\nTotal: ${totalFormatted}\n\nOur store administration will verify your payment and update the status.\n\nTrack order: ${trackUrl}\n\nThank you!`;

  return { subject, html, text };
}

/**
 * 2. Paybill Instructions Resend Email
 */
export function renderPaybillInstructionsEmail(order: OrderEmailData): RenderedEmail {
  const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const totalFormatted = formatKES(order.total);
  const trackUrl = buildTrackUrl(order.id);
  const isGuest = Boolean(order.isGuest || !order.userId);
  const subject = `Payment Instructions for Order ${shortId} (${totalFormatted}) - Ropenix Collections`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || 'Customer')}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      Here are the official M-Pesa Paybill payment instructions for your order <strong>${escapeHtml(shortId)}</strong> totaling <strong>${totalFormatted}</strong>.
    </p>

    ${renderPaybillBox(totalFormatted, shortId)}

    ${isGuest ? `
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin: 20px 0; text-align: center; font-size: 13px; color: #475569;">
      💳 After completing your M-Pesa payment, please reply directly to this email with your Safaricom transaction code or call <strong>+254 182 180 965</strong>.
    </div>
    ` : `
    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton('Submit M-Pesa Code', trackUrl, 'emerald')}
    </div>
    `}

    <p style="margin: 20px 0 0 0; font-size: 13px; color: #475569; line-height: 1.6;">
      Need assistance? Reply directly to this email or call our hotline at <strong>+254 182 180 965</strong>.
    </p>
  `;

  const html = renderBaseEmailLayout({
    title: `Payment Instructions ${shortId}`,
    heading: `M-Pesa Payment Details: ${shortId}`,
    badgeText: 'Payment Required',
    badgeColor: 'amber',
    bodyHtml,
  });

  const text = isGuest
    ? `Dear ${order.customerName},\n\nM-Pesa payment instructions for order ${shortId}:\n\nPaybill: 303030\nAccount: 2047728455 (Fixed shared account)\nAmount: ${totalFormatted}\nAccount Name: ROPENIX INVESTMENTS LTD\n\nReply to this email with your M-Pesa transaction code once paid.`
    : `Dear ${order.customerName},\n\nM-Pesa payment instructions for order ${shortId}:\n\nPaybill: 303030\nAccount: 2047728455 (Fixed shared account)\nAmount: ${totalFormatted}\nAccount Name: ROPENIX INVESTMENTS LTD\n\nSubmit your transaction code here: ${trackUrl}`;

  return { subject, html, text };
}

/**
 * 3. Payment Submission Received Email (Customer submitted M-Pesa code via "I've paid" form)
 */
export function renderPaymentSubmissionReceivedEmail(data: {
  orderId: string;
  customerName: string;
  customerEmail?: string;
  isGuest?: boolean;
  userId?: string | null;
  mpesaCode: string;
  amount: number;
  total: number;
}): RenderedEmail {
  const shortId = data.orderId.startsWith('ROP-') ? data.orderId : `ROP-${data.orderId.slice(-6).toUpperCase()}`;
  const amountFormatted = formatKES(data.amount);
  const trackUrl = buildTrackUrl(data.orderId);
  const isGuest = data.isGuest !== undefined ? Boolean(data.isGuest) : !(data as any).userId;
  const subject = `Payment Claim Received: ${escapeHtml(data.mpesaCode)} for Order ${shortId}`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(data.customerName || 'Customer')}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      We have successfully received your payment submission for Order <strong>${escapeHtml(shortId)}</strong>!
    </p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 18px; margin: 20px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #166534; width: 45%;"><strong>M-Pesa Transaction Code:</strong></td>
          <td style="padding: 4px 0; color: #14532d; font-weight: 800; font-family: monospace; font-size: 15px;">${escapeHtml(data.mpesaCode.toUpperCase())}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #166534;"><strong>Amount Reported:</strong></td>
          <td style="padding: 4px 0; color: #14532d; font-weight: 700;">${amountFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #166534;"><strong>Status:</strong></td>
          <td style="padding: 4px 0; color: #15803d; font-weight: 700;">⏳ Awaiting Admin Verification</td>
        </tr>
      </table>
    </div>

    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      Our accounts team is cross-checking this reference with our Safaricom Paybill statement. Once verified, your order status will automatically update to <strong>Paid</strong> and enter immediate packaging and dispatch.
    </p>

    ${isGuest ? `
    <div style="text-align: center; margin: 20px 0; padding: 14px 18px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 13px; color: #475569;">
      📬 You will receive your official payment confirmation receipt directly at <strong>${escapeHtml(data.customerEmail || 'this email address')}</strong> once verification is complete.
    </div>
    ` : `
    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton('View Order Status', trackUrl, 'indigo')}
    </div>
    `}
  `;

  const html = renderBaseEmailLayout({
    title: `Payment Claim Received - ${shortId}`,
    heading: 'Payment Claim Received',
    badgeText: 'Under Verification',
    badgeColor: 'amber',
    bodyHtml,
  });

  const text = isGuest
    ? `Dear ${data.customerName},\n\nWe received your M-Pesa transaction reference (${data.mpesaCode}) for order ${shortId} (${amountFormatted}).\nOur finance team is verifying this with Safaricom. You will receive an official receipt via email upon confirmation.`
    : `Dear ${data.customerName},\n\nWe received your M-Pesa transaction reference (${data.mpesaCode}) for order ${shortId} (${amountFormatted}).\nOur finance team is verifying this with Safaricom. You will receive an official receipt upon confirmation.\n\nTrack order: ${trackUrl}`;

  return { subject, html, text };
}

/**
 * 4. Payment Receipt / Confirmed Email (Sent when Admin marks payment as verified)
 */
export function renderPaymentReceiptEmail(order: OrderEmailData & {
  mpesaCode?: string;
  confirmedAt?: string;
}): RenderedEmail {
  const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const totalFormatted = formatKES(order.total);
  const trackUrl = buildTrackUrl(order.id);
  const isGuest = Boolean(order.isGuest || !order.userId);
  const subject = `Payment Confirmed & Official Receipt: ${shortId} (${totalFormatted})`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || 'Customer')}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      Great news! Your payment of <strong>${totalFormatted}</strong> for order <strong>${escapeHtml(shortId)}</strong> has been <span style="color: #16a34a; font-weight: 700;">successfully verified and cleared</span>.
    </p>

    <!-- Receipt Highlight Box -->
    <div style="background-color: #ecfdf5; border: 2px solid #10b981; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #065f46; width: 45%;"><strong>Payment Status:</strong></td>
          <td style="padding: 4px 0; color: #047857; font-weight: 800; font-size: 14px;">✅ PAID IN FULL</td>
        </tr>
        ${order.mpesaCode ? `
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>M-Pesa Reference:</strong></td>
          <td style="padding: 4px 0; color: #065f46; font-family: monospace; font-weight: 800; font-size: 14px;">${escapeHtml(order.mpesaCode.toUpperCase())}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>Amount Cleared:</strong></td>
          <td style="padding: 4px 0; color: #065f46; font-weight: 800;">${totalFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>Verification Date:</strong></td>
          <td style="padding: 4px 0; color: #065f46;">${formatEATDate(order.confirmedAt || new Date())}</td>
        </tr>
      </table>
    </div>

    <!-- Items Summary -->
    <h3 style="margin: 24px 0 8px 0; font-size: 15px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Items In Fulfillment</h3>
    ${renderOrderItemsTable(order.items)}
    ${renderOrderTotals(order)}

    ${isGuest ? `
    <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 14px 18px; margin: 24px 0; text-align: center; font-size: 13px; color: #065f46;">
      📦 <strong>Fulfillment Notice:</strong> Your package is being picked and prepared. We will send you an email confirmation with courier dispatch details as soon as it leaves our warehouse.
    </div>
    ` : `
    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton('Track Packaging & Dispatch', trackUrl, 'emerald')}
    </div>
    `}

    <p style="margin: 20px 0 0 0; font-size: 13px; color: #475569; line-height: 1.6;">
      Our fulfillment warehouse is currently picking and securely boxing your items. You will receive tracking details once your package is handed over to our courier partner.
    </p>
  `;

  const html = renderBaseEmailLayout({
    title: `Payment Receipt ${shortId}`,
    heading: 'Payment Confirmed & Verified',
    badgeText: 'Paid & Processing',
    badgeColor: 'emerald',
    bodyHtml,
  });

  const text = isGuest
    ? `Dear ${order.customerName},\n\nYour payment of ${totalFormatted} for order ${shortId} has been confirmed.\n${order.mpesaCode ? `M-Pesa Ref: ${order.mpesaCode}\n` : ''}Your package is now in fulfillment. Dispatch updates will be sent to ${order.customerEmail}.`
    : `Dear ${order.customerName},\n\nYour payment of ${totalFormatted} for order ${shortId} has been confirmed.\n${order.mpesaCode ? `M-Pesa Ref: ${order.mpesaCode}\n` : ''}Your package is now in fulfillment.\n\nTrack order: ${trackUrl}`;

  return { subject, html, text };
}

/**
 * 5. Payment Reminder Email (+12h / +24h for unpaid orders)
 */
export function renderPaymentReminderEmail(order: OrderEmailData & {
  reminderNumber: number;
  hoursRemaining?: number;
}): RenderedEmail {
  const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const totalFormatted = formatKES(order.total);
  const trackUrl = buildTrackUrl(order.id);
  const isGuest = Boolean(order.isGuest || !order.userId);
  const isFinal = order.reminderNumber >= 2;
  const subject = isFinal
    ? `⚠️ Final Reminder: Complete Payment for Order ${shortId} (${totalFormatted})`
    : `Friendly Reminder: Your Order ${shortId} is Awaiting Payment`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || 'Customer')}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      We noticed you haven't completed payment for your order <strong>${escapeHtml(shortId)}</strong> totaling <strong>${totalFormatted}</strong>.
      ${isFinal ? '<br /><strong style="color: #e11d48;">Please complete payment promptly to prevent your reserved items from being released back to inventory.</strong>' : 'Your items are currently reserved for you.'}
    </p>

    ${renderPaybillBox(totalFormatted, shortId)}

    ${isGuest ? `
    <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 18px; margin: 20px 0; text-align: center; font-size: 13px; color: #92400e;">
      💡 After paying, simply reply to this email with your M-Pesa transaction reference code to verify your order.
    </div>
    ` : `
    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton('I Have Paid - Submit Code', trackUrl, 'amber')}
    </div>
    `}

    <p style="margin: 20px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.6;">
      <em>If you have already paid, please send your transaction code so we can match your payment right away. If you wish to cancel this order, simply reply to let us know.</em>
    </p>
  `;

  const html = renderBaseEmailLayout({
    title: `Payment Reminder - ${shortId}`,
    heading: isFinal ? `Final Notice: Order ${shortId}` : `Payment Reminder: Order ${shortId}`,
    badgeText: isFinal ? 'Action Required' : 'Payment Reminder',
    badgeColor: isFinal ? 'rose' : 'amber',
    bodyHtml,
  });

  const text = isGuest
    ? `Dear ${order.customerName},\n\nPayment reminder for order ${shortId} (${totalFormatted}).\n\nPaybill: 303030\nAccount: 2047728455\nAmount: ${totalFormatted}\n\nReply to this email with your M-Pesa code once paid.`
    : `Dear ${order.customerName},\n\nPayment reminder for order ${shortId} (${totalFormatted}).\n\nPaybill: 303030\nAccount: 2047728455\nAmount: ${totalFormatted}\n\nSubmit your payment code here: ${trackUrl}`;

  return { subject, html, text };
}

/**
 * 6. Payment Issue / Partial Payment Email (Admin flagged mismatch, wrong code, or underpayment)
 */
export function renderPaymentIssueEmail(order: OrderEmailData & {
  issueReason: string;
  expectedAmount?: number;
  receivedAmount?: number;
  instructions?: string;
}): RenderedEmail {
  const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const totalFormatted = formatKES(order.total);
  const trackUrl = buildTrackUrl(order.id);
  const isGuest = Boolean(order.isGuest || !order.userId);
  const subject = `Action Needed: Payment Verification Issue for Order ${shortId}`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || 'Customer')}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      While verifying the payment for your order <strong>${escapeHtml(shortId)}</strong>, our finance team encountered an issue that requires your clarification:
    </p>

    <!-- Issue Notice Box -->
    <div style="background-color: #fff1f2; border: 2px solid #f43f5e; border-radius: 10px; padding: 18px; margin: 20px 0;">
      <h4 style="margin: 0 0 8px 0; color: #9f1239; font-size: 14px;">Reason for Verification Hold:</h4>
      <p style="margin: 0 0 10px 0; color: #881337; font-size: 13px; line-height: 1.5;">
        ${escapeHtml(order.issueReason)}
      </p>
      ${order.receivedAmount !== undefined && order.expectedAmount !== undefined ? `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 12px; border-top: 1px solid #fecdd3; padding-top: 8px; color: #9f1239;">
        <tr>
          <td><strong>Expected Amount:</strong> ${formatKES(order.expectedAmount)}</td>
          <td><strong>Amount Received:</strong> ${formatKES(order.receivedAmount)}</td>
          <td><strong>Balance Due:</strong> ${formatKES(Math.max(0, order.expectedAmount - order.receivedAmount))}</td>
        </tr>
      </table>
      ` : ''}
    </div>

    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      ${escapeHtml(order.instructions || 'Please review your M-Pesa SMS confirmation and re-submit the valid transaction code or clear any outstanding balance.')}
    </p>

    ${renderPaybillBox(totalFormatted, shortId)}

    ${isGuest ? `
    <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; padding: 14px 18px; margin: 20px 0; text-align: center; font-size: 13px; color: #9f1239;">
      ⚠️ Please reply directly to this email with your valid M-Pesa SMS confirmation code or call support at <strong>+254 182 180 965</strong>.
    </div>
    ` : `
    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton('Update Payment Information', trackUrl, 'rose')}
    </div>
    `}

    <p style="margin: 20px 0 0 0; font-size: 13px; color: #475569; line-height: 1.6;">
      Need direct help? Contact our finance desk directly at <a href="mailto:admin@ropenix.co.ke" style="color: #e11d48;">admin@ropenix.co.ke</a> or call <strong>+254 182 180 965</strong> quoting order <strong>${escapeHtml(shortId)}</strong>.
    </p>
  `;

  const html = renderBaseEmailLayout({
    title: `Payment Issue - ${shortId}`,
    heading: 'Payment Verification Attention Required',
    badgeText: 'Payment Issue',
    badgeColor: 'rose',
    bodyHtml,
  });

  const text = isGuest
    ? `Dear ${order.customerName},\n\nPayment verification issue for order ${shortId}:\n${order.issueReason}\n\nPlease reply to this email with your updated M-Pesa details or contact us.`
    : `Dear ${order.customerName},\n\nPayment verification issue for order ${shortId}:\n${order.issueReason}\n\nPlease update your payment details or contact us: ${trackUrl}`;

  return { subject, html, text };
}

/**
 * 7. Order Shipped / Dispatched Email
 */
export function renderOrderShippedEmail(order: OrderEmailData & {
  trackingNumber?: string;
  courierName?: string;
  estimatedDelivery?: string;
}): RenderedEmail {
  const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const trackUrl = buildTrackUrl(order.id);
  const isGuest = Boolean(order.isGuest || !order.userId);
  const courier = order.courierName || 'Ropenix Express Courier';
  const trackingNo = order.trackingNumber || 'Pending Dispatch Code';
  const subject = `🚚 Your Order is on the Way: ${shortId} (${courier})`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || 'Customer')}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      Exciting news! Your order <strong>${escapeHtml(shortId)}</strong> has been packaged and dispatched with our delivery partner.
    </p>

    <!-- Courier Tracking Box -->
    <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px; margin: 20px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #64748b; width: 40%;"><strong>Courier Service:</strong></td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">${escapeHtml(courier)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b;"><strong>Tracking Number:</strong></td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 800; font-family: monospace;">${escapeHtml(trackingNo)}</td>
        </tr>
        ${order.estimatedDelivery ? `
        <tr>
          <td style="padding: 4px 0; color: #64748b;"><strong>Estimated Delivery:</strong></td>
          <td style="padding: 4px 0; color: #16a34a; font-weight: 700;">${escapeHtml(order.estimatedDelivery)}</td>
        </tr>
        ` : ''}
        ${order.shippingAddress ? `
        <tr>
          <td style="padding: 4px 0; color: #64748b; vertical-align: top;"><strong>Destination:</strong></td>
          <td style="padding: 4px 0; color: #0f172a;">${escapeHtml(order.shippingAddress)}</td>
        </tr>
        ` : ''}
      </table>
    </div>

    <h3 style="margin: 24px 0 8px 0; font-size: 15px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Items In Transit</h3>
    ${renderOrderItemsTable(order.items)}

    ${isGuest ? `
    <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px 18px; margin: 24px 0; text-align: center; font-size: 13px; color: #334155;">
      🚚 <strong>Courier Handover Complete:</strong> Your rider will contact your phone number (<strong>${escapeHtml(order.customerPhone || 'on file')}</strong>) prior to arriving at your delivery location.
    </div>
    ` : `
    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton('Track Delivery Live', trackUrl, 'indigo')}
    </div>
    `}

    <p style="margin: 20px 0 0 0; font-size: 13px; color: #475569; line-height: 1.6;">
      Our rider will contact your phone number (<strong>${escapeHtml(order.customerPhone || 'on file')}</strong>) prior to arriving at your location.
    </p>
  `;

  const html = renderBaseEmailLayout({
    title: `Order Dispatched - ${shortId}`,
    heading: 'Your Order Has Been Dispatched!',
    badgeText: 'In Transit',
    badgeColor: 'indigo',
    bodyHtml,
  });

  const text = isGuest
    ? `Dear ${order.customerName},\n\nYour order ${shortId} has been dispatched via ${courier}.\nTracking Number: ${trackingNo}\nDestination: ${order.shippingAddress || 'Nairobi, Kenya'}\nOur rider will contact you prior to arrival.`
    : `Dear ${order.customerName},\n\nYour order ${shortId} has been dispatched via ${courier}.\nTracking Number: ${trackingNo}\n\nTrack order live: ${trackUrl}`;

  return { subject, html, text };
}

/**
 * 8. Order Delivered Email
 */
export function renderOrderDeliveredEmail(order: OrderEmailData & {
  reviewUrl?: string;
}): RenderedEmail {
  const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const reviewUrl = order.reviewUrl || buildUrl(`/shop`);
  const subject = `🎉 Order Delivered: ${shortId} - Enjoy Your Items!`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || 'Customer')}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      Our courier records show that your order <strong>${escapeHtml(shortId)}</strong> was successfully delivered!
    </p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 18px; margin: 20px 0; text-align: center;">
      <span style="font-size: 28px;">📦✨</span>
      <h3 style="margin: 8px 0 4px 0; color: #166534; font-size: 16px;">We hope you love your purchase!</h3>
      <p style="margin: 0; font-size: 13px; color: #15803d;">
        All eligible items carry our 14-day warranty against manufacturing defects.
      </p>
    </div>

    <p style="margin: 16px 0; line-height: 1.6; color: #334155;">
      Your feedback helps fellow Kenyan shoppers find the best items. Please take 30 seconds to share your experience:
    </p>

    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton('Leave a Product Review ⭐⭐⭐⭐⭐', reviewUrl, 'amber')}
    </div>
  `;

  const html = renderBaseEmailLayout({
    title: `Order Delivered - ${shortId}`,
    heading: 'Delivered Successfully!',
    badgeText: 'Delivered',
    badgeColor: 'emerald',
    bodyHtml,
  });

  const text = `Dear ${order.customerName},\n\nYour order ${shortId} has been delivered!\nWe hope you love your purchase. Please rate your experience: ${reviewUrl}`;

  return { subject, html, text };
}

/**
 * 9. Order Cancelled Email
 */
export function renderOrderCancelledEmail(order: OrderEmailData & {
  cancellationReason?: string;
}): RenderedEmail {
  const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const shopUrl = buildUrl('/shop');
  const subject = `Order Cancellation Notice: ${shortId} - Ropenix Collections`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || 'Customer')}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      This email is to inform you that order <strong>${escapeHtml(shortId)}</strong> has been cancelled.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 13px; color: #475569;">
      <strong>Reason for cancellation:</strong><br />
      ${escapeHtml(order.cancellationReason || 'Payment not completed within reservation timeframe / Cancelled per request.')}
    </div>

    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      If you already sent an M-Pesa payment for this order, please contact our support team immediately with your M-Pesa transaction reference and we will gladly re-instate your order or process a full refund.
    </p>

    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton('Continue Browsing Store', shopUrl, 'indigo')}
    </div>
  `;

  const html = renderBaseEmailLayout({
    title: `Order Cancelled - ${shortId}`,
    heading: 'Order Cancellation Notice',
    badgeText: 'Cancelled',
    badgeColor: 'rose',
    bodyHtml,
  });

  const text = `Dear ${order.customerName},\n\nOrder ${shortId} has been cancelled.\nReason: ${order.cancellationReason || 'Payment timeout / customer request'}.\nIf you have already paid, contact us at concierge@ropenix.co.ke or +254 182 180 965.`;

  return { subject, html, text };
}

/**
 * 10. Refund Processed Email
 */
export function renderRefundProcessedEmail(order: OrderEmailData & {
  refundAmount: number;
  refundReference?: string;
  refundMethod?: string;
}): RenderedEmail {
  const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const refundFormatted = formatKES(order.refundAmount);
  const subject = `Refund Processed: ${shortId} (${refundFormatted}) - Ropenix Collections`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || 'Customer')}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      We have successfully processed a refund of <strong>${refundFormatted}</strong> for your order <strong>${escapeHtml(shortId)}</strong>.
    </p>

    <div style="background-color: #ecfdf5; border: 1px solid #10b981; border-radius: 10px; padding: 18px; margin: 20px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #065f46; width: 45%;"><strong>Refund Amount:</strong></td>
          <td style="padding: 4px 0; color: #047857; font-weight: 800; font-size: 15px;">${refundFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>Method:</strong></td>
          <td style="padding: 4px 0; color: #065f46;">${escapeHtml(order.refundMethod || 'Direct M-Pesa Reversal')}</td>
        </tr>
        ${order.refundReference ? `
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>Reference ID:</strong></td>
          <td style="padding: 4px 0; color: #065f46; font-family: monospace; font-weight: 700;">${escapeHtml(order.refundReference)}</td>
        </tr>
        ` : ''}
      </table>
    </div>

    <p style="margin: 16px 0 0 0; font-size: 13px; color: #475569; line-height: 1.6;">
      M-Pesa refunds are typically reflected in your mobile wallet within a few minutes to 1 business day depending on Safaricom clearance.
    </p>
  `;

  const html = renderBaseEmailLayout({
    title: `Refund Processed - ${shortId}`,
    heading: 'Refund Processed Successfully',
    badgeText: 'Refund Complete',
    badgeColor: 'emerald',
    bodyHtml,
  });

  const text = `Dear ${order.customerName},\n\nA refund of ${refundFormatted} for order ${shortId} has been processed via ${order.refundMethod || 'M-Pesa'}.\nRef: ${order.refundReference || 'N/A'}`;

  return { subject, html, text };
}
