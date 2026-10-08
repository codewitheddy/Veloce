/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { escapeHtml, renderBaseEmailLayout, renderEmailButton } from './baseLayout';
import { OrderEmailData, RenderedEmail } from './types';
import { buildAdminUrl, formatKES, formatEATDate } from '../urlHelper';

/**
 * 1. Admin Alert: New Order Placed
 */
export function renderAdminNewOrderEmail(order: OrderEmailData): RenderedEmail {
  const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const totalFormatted = formatKES(order.total);
  const adminUrl = buildAdminUrl('/orders');
  const subject = `🔔 [NEW ORDER] ${shortId} by ${escapeHtml(order.customerName)} (${totalFormatted})`;

  const itemsListHtml = order.items.map((it) => {
    const itemName = it.name || (it as any).product_name || 'Product Item';
    const itemPrice = it.price !== undefined ? it.price : (it as any).unit_price || 0;
    const qty = it.quantity || 1;
    return `
    <tr>
      <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b;">
        <strong>${escapeHtml(itemName)}</strong> (x${qty})
      </td>
      <td align="right" style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 700; color: #0f172a;">
        ${formatKES(itemPrice * qty)}
      </td>
    </tr>
  `;
  }).join('');

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      <strong>Attn: Store Administrator / Fulfillment Team</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      A new order <strong>${escapeHtml(shortId)}</strong> has just been placed on the storefront and is awaiting payment/processing.
    </p>

    <!-- Details Box -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 16px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #64748b; width: 35%;"><strong>Customer:</strong></td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">${escapeHtml(order.customerName)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b;"><strong>Email:</strong></td>
          <td style="padding: 4px 0; color: #0f172a;"><a href="mailto:${escapeHtml(order.customerEmail)}" style="color: #4f46e5;">${escapeHtml(order.customerEmail)}</a></td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b;"><strong>Phone:</strong></td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 700;"><a href="tel:${escapeHtml(order.customerPhone || '')}" style="color: #0f172a;">${escapeHtml(order.customerPhone || 'N/A')}</a></td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b;"><strong>Payment Method:</strong></td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 600;">${escapeHtml(order.paymentMethod || 'M-PESA Paybill')}</td>
        </tr>
        ${order.shippingAddress ? `
        <tr>
          <td style="padding: 4px 0; color: #64748b; vertical-align: top;"><strong>Shipping Address:</strong></td>
          <td style="padding: 4px 0; color: #0f172a;">${escapeHtml(order.shippingAddress)}</td>
        </tr>
        ` : ''}
      </table>
    </div>

    <h4 style="margin: 20px 0 8px 0; font-size: 14px; color: #0f172a;">Items Breakdown:</h4>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
      ${itemsListHtml}
      <tr>
        <td style="padding: 10px 8px; font-weight: 800; font-size: 15px; color: #0f172a;">Total Order Amount:</td>
        <td align="right" style="padding: 10px 8px; font-weight: 800; font-size: 16px; color: #0f172a;">${totalFormatted}</td>
      </tr>
    </table>

    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton('Open Order in Admin Panel', adminUrl, 'indigo')}
    </div>
  `;

  const html = renderBaseEmailLayout({
    title: `Admin Alert: New Order ${shortId}`,
    heading: `New Order Placed: ${shortId}`,
    badgeText: 'Admin Notice',
    badgeColor: 'indigo',
    bodyHtml,
  });

  const text = `Admin Alert: New Order ${shortId} placed by ${order.customerName} (${order.customerEmail})\nTotal: ${totalFormatted}\nPhone: ${order.customerPhone || 'N/A'}\nOpen Admin: ${adminUrl}`;

  return { subject, html, text };
}

/**
 * 2. Admin Alert: Customer Submitted M-Pesa Code for Verification
 */
export function renderAdminPaymentSubmissionEmail(data: {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  mpesaCode: string;
  amount: number;
  total: number;
  submittedAt?: string;
  notes?: string;
}): RenderedEmail {
  const shortId = data.orderId.startsWith('ROP-') ? data.orderId : `ROP-${data.orderId.slice(-6).toUpperCase()}`;
  const amountFormatted = formatKES(data.amount);
  const totalFormatted = formatKES(data.total);
  const adminUrl = buildAdminUrl('/orders');
  const subject = `💰 [VERIFY PAYMENT] M-Pesa ${escapeHtml(data.mpesaCode.toUpperCase())} for Order ${shortId}`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      <strong>Attn: Accounts & Admin Team</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      A customer has submitted an M-Pesa payment claim for Order <strong>${escapeHtml(shortId)}</strong>. Please cross-reference this code with your Safaricom M-Pesa Paybill statement and approve or flag.
    </p>

    <!-- Payment Claim Box -->
    <div style="background-color: #ecfdf5; border: 2px solid #10b981; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="padding: 6px 0; color: #065f46; width: 40%;"><strong>M-Pesa Reference Code:</strong></td>
          <td style="padding: 6px 0; color: #065f46; font-size: 18px; font-weight: 800; font-family: monospace; letter-spacing: 1px;">
            ${escapeHtml(data.mpesaCode.toUpperCase())}
          </td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>Amount Submitted:</strong></td>
          <td style="padding: 4px 0; color: #065f46; font-size: 15px; font-weight: 700;">${amountFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>Order Total:</strong></td>
          <td style="padding: 4px 0; color: #065f46; font-size: 14px;">${totalFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>Customer Name:</strong></td>
          <td style="padding: 4px 0; color: #065f46; font-weight: 600;">${escapeHtml(data.customerName)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>Customer Phone:</strong></td>
          <td style="padding: 4px 0; color: #065f46; font-weight: 700;"><a href="tel:${escapeHtml(data.customerPhone || '')}" style="color: #065f46;">${escapeHtml(data.customerPhone || 'N/A')}</a></td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>Customer Email:</strong></td>
          <td style="padding: 4px 0; color: #065f46;">${escapeHtml(data.customerEmail)}</td>
        </tr>
        ${data.notes ? `
        <tr>
          <td style="padding: 4px 0; color: #065f46; vertical-align: top;"><strong>Customer Notes:</strong></td>
          <td style="padding: 4px 0; color: #065f46; font-style: italic;">"${escapeHtml(data.notes)}"</td>
        </tr>
        ` : ''}
      </table>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton('Verify Payment in Admin Panel', adminUrl, 'emerald')}
    </div>
  `;

  const html = renderBaseEmailLayout({
    title: `Verify Payment ${data.mpesaCode}`,
    heading: `M-Pesa Payment Claim: ${shortId}`,
    badgeText: 'Payment Verification',
    badgeColor: 'emerald',
    bodyHtml,
  });

  const text = `Verify Payment Claim:\nOrder: ${shortId}\nM-Pesa Code: ${data.mpesaCode}\nAmount: ${amountFormatted}\nCustomer: ${data.customerName} (${data.customerPhone || ''})\n\nOpen Admin Panel: ${adminUrl}`;

  return { subject, html, text };
}

/**
 * 3. Daily Pending-Payments & Unpaid Orders Digest (08:00 EAT and 17:00 EAT)
 */
export function renderAdminPaymentDigestEmail(data: {
  slot: 'morning' | 'evening';
  pendingSubmissions: Array<{
    orderId: string;
    customerName: string;
    mpesaCode: string;
    amount: number;
    submittedAt: string;
  }>;
  unpaidOrders: Array<{
    orderId: string;
    customerName: string;
    total: number;
    createdAt: string;
    hoursUnpaid: number;
  }>;
}): RenderedEmail {
  const slotName = data.slot === 'morning' ? 'Morning (08:00 EAT)' : 'Evening (17:00 EAT)';
  const adminUrl = buildAdminUrl('/orders');
  const subject = `📊 [DIGEST ${slotName}] ${data.pendingSubmissions.length} Pending Payments, ${data.unpaidOrders.length} Unpaid Orders`;

  const submissionsHtml = data.pendingSubmissions.length > 0
    ? data.pendingSubmissions.map((s) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px;">
          <strong>ROP-${s.orderId.slice(-6).toUpperCase()}</strong> (${escapeHtml(s.customerName)})
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-family: monospace; font-weight: 700; color: #16a34a; font-size: 13px;">
          ${escapeHtml(s.mpesaCode.toUpperCase())}
        </td>
        <td align="right" style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: 700; font-size: 13px;">
          ${formatKES(s.amount)}
        </td>
      </tr>
    `).join('')
    : `<tr><td colspan="3" style="padding: 12px; text-align: center; color: #16a34a; font-size: 13px;">✅ All customer payment submissions have been verified!</td></tr>`;

  const unpaidHtml = data.unpaidOrders.length > 0
    ? data.unpaidOrders.map((u) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px;">
          <strong>ROP-${u.orderId.slice(-6).toUpperCase()}</strong> (${escapeHtml(u.customerName)})
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #64748b;">
          ${u.hoursUnpaid}h ago
        </td>
        <td align="right" style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: 700; font-size: 13px;">
          ${formatKES(u.total)}
        </td>
      </tr>
    `).join('')
    : `<tr><td colspan="3" style="padding: 12px; text-align: center; color: #64748b; font-size: 13px;">No pending unpaid orders.</td></tr>`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Here is your scheduled <strong>${escapeHtml(slotName)}</strong> operational payment summary:
    </p>

    <h3 style="margin: 20px 0 8px 0; font-size: 15px; color: #166534; border-bottom: 2px solid #bbf7d0; padding-bottom: 6px;">
      1. Payments Awaiting Verification (${data.pendingSubmissions.length})
    </h3>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #f0fdf4; font-size: 11px; text-transform: uppercase; color: #166534;">
          <th align="left" style="padding: 8px;">Order & Customer</th>
          <th align="left" style="padding: 8px;">M-Pesa Code</th>
          <th align="right" style="padding: 8px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${submissionsHtml}
      </tbody>
    </table>

    <h3 style="margin: 24px 0 8px 0; font-size: 15px; color: #9a3412; border-bottom: 2px solid #fed7aa; padding-bottom: 6px;">
      2. Unpaid Orders Awaiting Customer Action (${data.unpaidOrders.length})
    </h3>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #fff7ed; font-size: 11px; text-transform: uppercase; color: #9a3412;">
          <th align="left" style="padding: 8px;">Order & Customer</th>
          <th align="left" style="padding: 8px;">Placed</th>
          <th align="right" style="padding: 8px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${unpaidHtml}
      </tbody>
    </table>

    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton('Manage Orders in Admin Panel', adminUrl, 'indigo')}
    </div>
  `;

  const html = renderBaseEmailLayout({
    title: `Payment Digest - ${slotName}`,
    heading: `Store Operations Digest (${slotName})`,
    badgeText: 'Daily Digest',
    badgeColor: 'indigo',
    bodyHtml,
  });

  const text = `Store Operations Digest (${slotName}):\n- ${data.pendingSubmissions.length} payments awaiting verification\n- ${data.unpaidOrders.length} unpaid orders pending\n\nAdmin Panel: ${adminUrl}`;

  return { subject, html, text };
}

/**
 * 4. Admin Alert: Customer Submitted Return/Refund/Exchange Request
 */
export function renderAdminReturnRequestEmail(data: {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  reason: string;
  items?: Array<{ id?: string; name: string; quantity: number; price?: number }>;
  returnId?: string;
}): RenderedEmail {
  const shortId = data.orderId.startsWith('ROP-') ? data.orderId : `ROP-${data.orderId.slice(-6).toUpperCase()}`;
  const adminUrl = buildAdminUrl('/orders');
  const subject = `↩️ [RETURN REQUEST] Order ${shortId} by ${escapeHtml(data.customerName)}`;

  const itemsHtml = data.items && data.items.length > 0
    ? `
      <h4 style="margin: 16px 0 8px 0; font-size: 13px; color: #0f172a; text-transform: uppercase;">Items to Return / Exchange:</h4>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
        ${data.items.map((it) => `
          <tr>
            <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b;">
              <strong>${escapeHtml(it.name)}</strong> (x${it.quantity || 1})
            </td>
            <td align="right" style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 700;">
              ${it.price ? formatKES(it.price * (it.quantity || 1)) : ''}
            </td>
          </tr>
        `).join('')}
      </table>
    `
    : '';

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      <strong>Attn: Customer Care & Returns Desk</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      A customer has submitted a return/exchange request for order <strong>${escapeHtml(shortId)}</strong>.
    </p>

    <!-- Return Details Box -->
    <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; padding: 16px; margin: 16px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #9f1239; width: 35%;"><strong>Customer:</strong></td>
          <td style="padding: 4px 0; color: #881337; font-weight: 700;">${escapeHtml(data.customerName)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #9f1239;"><strong>Email:</strong></td>
          <td style="padding: 4px 0; color: #881337;"><a href="mailto:${escapeHtml(data.customerEmail)}" style="color: #9f1239;">${escapeHtml(data.customerEmail)}</a></td>
        </tr>
        ${data.customerPhone ? `
        <tr>
          <td style="padding: 4px 0; color: #9f1239;"><strong>Phone:</strong></td>
          <td style="padding: 4px 0; color: #881337; font-weight: 700;"><a href="tel:${escapeHtml(data.customerPhone)}" style="color: #881337;">${escapeHtml(data.customerPhone)}</a></td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 4px 0; color: #9f1239; vertical-align: top;"><strong>Reason Given:</strong></td>
          <td style="padding: 4px 0; color: #881337; font-style: italic;">"${escapeHtml(data.reason)}"</td>
        </tr>
      </table>
    </div>

    ${itemsHtml}

    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton('Review Return Request in Admin', adminUrl, 'rose')}
    </div>
  `;

  const html = renderBaseEmailLayout({
    title: `Return Request - Order ${shortId}`,
    heading: `Return Request: ${shortId}`,
    badgeText: 'Return / Exchange',
    badgeColor: 'rose',
    bodyHtml,
  });

  const text = `Admin Alert: Return Request for Order ${shortId}\nCustomer: ${data.customerName} (${data.customerEmail})\nReason: ${data.reason}\nAdmin Panel: ${adminUrl}`;

  return { subject, html, text };
}

/**
 * 5. Admin Alert: Low Stock Warning
 */
export function renderAdminLowStockEmail(data: {
  productId: string;
  productName: string;
  sku?: string;
  currentStock: number;
  threshold: number;
}): RenderedEmail {
  const adminUrl = buildAdminUrl('/inventory');
  const subject = `⚠️ [LOW STOCK ALERT] ${escapeHtml(data.productName)} (${data.currentStock} units remaining)`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      <strong>Attn: Inventory & Restocking Team</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      The stock level for <strong>${escapeHtml(data.productName)}</strong> has dropped to or below the minimum threshold.
    </p>

    <!-- Stock Box -->
    <div style="background-color: #fefce8; border: 2px solid #facc15; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #854d0e; width: 40%;"><strong>Product Name:</strong></td>
          <td style="padding: 6px 0; color: #713f12; font-weight: 700;">${escapeHtml(data.productName)}</td>
        </tr>
        ${data.sku ? `
        <tr>
          <td style="padding: 4px 0; color: #854d0e;"><strong>SKU:</strong></td>
          <td style="padding: 4px 0; color: #713f12; font-family: monospace;">${escapeHtml(data.sku)}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 4px 0; color: #854d0e;"><strong>Current Stock:</strong></td>
          <td style="padding: 4px 0; color: #dc2626; font-size: 18px; font-weight: 800;">${data.currentStock} units</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #854d0e;"><strong>Alert Threshold:</strong></td>
          <td style="padding: 4px 0; color: #713f12; font-weight: 600;">${data.threshold} units</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton('Update Inventory / Restock', adminUrl, 'amber')}
    </div>
  `;

  const html = renderBaseEmailLayout({
    title: `Low Stock Alert - ${data.productName}`,
    heading: `Low Stock Warning: ${escapeHtml(data.productName)}`,
    badgeText: 'Low Stock Alert',
    badgeColor: 'amber',
    bodyHtml,
  });

  const text = `Low Stock Alert:\nProduct: ${data.productName}\nSKU: ${data.sku || 'N/A'}\nCurrent Stock: ${data.currentStock} units (Threshold: ${data.threshold})\nRestock Link: ${adminUrl}`;

  return { subject, html, text };
}
