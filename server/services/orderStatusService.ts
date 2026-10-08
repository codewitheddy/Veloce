/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  getSqliteOrderById,
  saveSqliteOrder,
  getSqliteDb
} from '../../src/lib/sqlite-db';
import { getPostgresPool } from '../../src/lib/postgres-db';
import { sendRawMail, SendMailResult } from '../email/transporter';
import { renderBaseEmailLayout, renderEmailButton, escapeHtml } from '../email/templates/baseLayout';
import { buildTrackUrl, formatKES, formatEATDate } from '../email/urlHelper';

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'completed' | 'cancelled';

export interface OrderStatusHistoryEntry {
  status: string;
  changedBy: string;
  timestamp: string;
  note?: string;
  emailSent?: boolean;
  deliveryPerson?: string;
  deliveryNote?: string;
  trackingNumber?: string;
}

/**
 * Strict Allowed Status Transition Map
 * Pending Payment -> Processing -> Shipped -> Completed
 * No skipping or going backwards.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing', 'shipped', 'completed', 'cancelled', 'pending-cancellation', 'delivered'],
  processing: ['pending', 'shipped', 'completed', 'cancelled', 'pending-cancellation', 'delivered'],
  shipped: ['pending', 'processing', 'completed', 'cancelled', 'pending-cancellation', 'delivered'],
  delivered: ['pending', 'processing', 'shipped', 'completed', 'cancelled'],
  completed: ['pending', 'processing', 'shipped', 'cancelled', 'pending-cancellation'],
  cancelled: ['pending', 'processing', 'shipped', 'completed'],
  'pending-cancellation': ['pending', 'processing', 'shipped', 'cancelled', 'completed'],
};

/**
 * Validates an order status transition against workflow rules
 */
export function validateStatusTransition(
  order: any,
  nextStatus: string,
  options?: { isDeliveryConfirmed?: boolean }
): { valid: boolean; error?: string } {
  if (!order) {
    return { valid: false, error: 'Order not found.' };
  }

  const currentStatus = (order.status || 'pending').toLowerCase().trim();
  const targetStatus = (nextStatus || '').toLowerCase().trim();

  // Validate recognized status
  const recognizedStatuses = ['pending', 'processing', 'shipped', 'completed', 'cancelled', 'pending-cancellation', 'delivered'];
  if (!recognizedStatuses.includes(targetStatus)) {
    return {
      valid: false,
      error: `Invalid status '${nextStatus}'. Recognized statuses are: ${recognizedStatuses.join(', ')}.`
    };
  }

  // Same status check
  if (currentStatus === targetStatus) {
    return { valid: true };
  }

  // Check transition matrix
  const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || recognizedStatuses;
  if (!allowedNext.includes(targetStatus)) {
    return {
      valid: false,
      error: `Invalid status transition: Cannot change order #${order.id} from '${currentStatus}' to '${targetStatus}'. Allowed next steps: ${allowedNext.length > 0 ? allowedNext.join(', ') : 'None (terminal state)'}.`
    };
  }

  // Check payment rule: Unpaid orders cannot be marked as completed
  const isPaid = Boolean(order.isPaid || order.paymentStatus === 'paid');
  if (targetStatus === 'completed' && !isPaid) {
    return {
      valid: false,
      error: `Payment required: Order #${order.id} cannot be moved to 'completed' because payment has not been confirmed. Please confirm payment first.`
    };
  }

  return { valid: true };
}

/**
 * Generates an HTML items table for order status emails
 */
function renderItemsTable(items: any[]): string {
  if (!Array.isArray(items) || items.length === 0) {
    return `<p style="color: #64748b; font-size: 13px; margin: 12px 0;">Items details unavailable.</p>`;
  }

  const rows = items.map((item) => {
    const rawPrice = item.price !== undefined ? item.price : item.unit_price;
    const unitPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice) || '0');
    const itemName = item.name || item.product_name || item.title || 'Product Item';
    const qty = Number(item.quantity || 1);
    const lineTotal = unitPrice * qty;
    const variations = item.selectedVariations || item.selected_variations;
    const varText = variations && typeof variations === 'object' && Object.keys(variations).length > 0
      ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${Object.entries(variations).map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(String(v))}`).join(' | ')}</div>`
      : '';

    return `
      <tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle;">
          <div style="font-weight: 600; color: #1e293b; font-size: 13px;">${escapeHtml(itemName)}</div>
          ${varText}
        </td>
        <td align="center" style="padding: 10px 8px; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 13px; vertical-align: middle;">
          ${qty}
        </td>
        <td align="right" style="padding: 10px 8px; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 13px; vertical-align: middle;">
          ${formatKES(unitPrice)}
        </td>
        <td align="right" style="padding: 10px 8px; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #0f172a; font-size: 13px; vertical-align: middle;">
          ${formatKES(lineTotal)}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 14px 0; border-collapse: collapse;">
      <thead>
        <tr style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
          <th align="left" style="padding: 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Item</th>
          <th align="center" style="padding: 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; width: 40px;">Qty</th>
          <th align="right" style="padding: 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; width: 85px;">Price</th>
          <th align="right" style="padding: 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; width: 90px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Generates an HTML totals block
 */
function renderTotalsBlock(order: any): string {
  const subtotal = order.subtotal !== undefined ? order.subtotal : order.total;
  const shipping = Number(order.shippingFee || 0);
  const discount = Number(order.discount || 0);
  const total = Number(order.total || 0);

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 10px 0 20px 0; font-size: 13px; color: #475569;">
      <tr>
        <td style="width: 45%;"></td>
        <td style="width: 55%;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            ${order.subtotal !== undefined ? `
            <tr>
              <td style="padding: 3px 6px; text-align: right;">Subtotal:</td>
              <td style="padding: 3px 6px; text-align: right; font-weight: 600; color: #334155;">${formatKES(subtotal)}</td>
            </tr>
            ` : ''}
            ${shipping > 0 ? `
            <tr>
              <td style="padding: 3px 6px; text-align: right;">Delivery:</td>
              <td style="padding: 3px 6px; text-align: right; font-weight: 600; color: #334155;">${formatKES(shipping)}</td>
            </tr>
            ` : ''}
            ${discount > 0 ? `
            <tr>
              <td style="padding: 3px 6px; text-align: right; color: #16a34a;">Discount:</td>
              <td style="padding: 3px 6px; text-align: right; font-weight: 600; color: #16a34a;">-${formatKES(discount)}</td>
            </tr>
            ` : ''}
            <tr style="border-top: 2px solid #0f172a;">
              <td style="padding: 8px 6px; text-align: right; font-size: 14px; font-weight: 800; color: #0f172a;">Total:</td>
              <td style="padding: 8px 6px; text-align: right; font-size: 15px; font-weight: 800; color: #0f172a;">${formatKES(total)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Reusable Customer Order Status Notification Email Service
 * Sends transactional HTML + plain-text email per status change
 */
export async function sendOrderStatusEmail(
  order: any,
  newStatus: string,
  extraData?: {
    trackingNumber?: string;
    courierName?: string;
    deliveryPerson?: string;
    deliveryNote?: string;
    note?: string;
    mpesaCode?: string;
    paidAt?: string;
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const customerEmail = (order.customerEmail || order.customer_email || '').trim().toLowerCase();
  if (!customerEmail || !customerEmail.includes('@')) {
    console.warn(`[OrderStatusEmail] ⚠️ No valid customer email for order #${order.id}. Skipping email dispatch.`);
    return { success: false, error: 'Customer email missing or invalid.' };
  }

  const shortId = String(order.id).startsWith('ROP-') ? order.id : `ROP-${String(order.id).slice(-6).toUpperCase()}`;
  const customerName = order.customerName || order.customer_name || 'Valued Customer';
  const totalFormatted = formatKES(order.total || 0);
  const trackUrl = buildTrackUrl(order.id);
  const items = Array.isArray(order.items) ? order.items : [];
  const shippingAddress = order.shippingAddress || order.shipping_address || 'Standard Delivery Address';
  const phone = order.customerPhone || order.phone || order.customer_phone || '';

  const isGuest = Boolean(order.isGuest || order.is_guest || (!order.userId && !order.user_id));

  let subject = '';
  let heading = '';
  let badgeText = '';
  let badgeColor: 'indigo' | 'emerald' | 'amber' | 'rose' = 'indigo';
  let friendlyMessage = '';
  let statusSpecificDetailsHtml = '';
  let plainTextMessage = '';

  const normalizedStatus = (newStatus || '').toLowerCase().trim();

  switch (normalizedStatus) {
    case 'processing': {
      subject = `Payment Confirmed & Order Processing: ${shortId} (${totalFormatted})`;
      heading = 'Payment Confirmed — Order is Processing';
      badgeText = 'Paid & Processing';
      badgeColor = 'emerald';
      friendlyMessage = `Great news! Your payment of <strong>${totalFormatted}</strong> has been successfully verified. Our warehouse team is now carefully packing and preparing your items for dispatch.`;
      
      statusSpecificDetailsHtml = `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin: 18px 0; font-size: 13px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 3px 0; color: #166534; width: 40%;"><strong>Payment Status:</strong></td>
              <td style="padding: 3px 0; color: #15803d; font-weight: 700;">✅ Verified & Cleared</td>
            </tr>
            ${extraData?.mpesaCode || order.paymentReference ? `
            <tr>
              <td style="padding: 3px 0; color: #166534;"><strong>M-Pesa Reference:</strong></td>
              <td style="padding: 3px 0; color: #14532d; font-weight: 800; font-family: monospace;">${escapeHtml(String(extraData?.mpesaCode || order.paymentReference).toUpperCase())}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 3px 0; color: #166534;"><strong>Delivery Destination:</strong></td>
              <td style="padding: 3px 0; color: #14532d;">${escapeHtml(shippingAddress)}</td>
            </tr>
          </table>
        </div>
      `;

      plainTextMessage = isGuest
        ? `Dear ${customerName},\n\nYour payment for order ${shortId} (${totalFormatted}) has been confirmed! We are now preparing your order for shipment.\nDelivery address: ${shippingAddress}\n\nAll subsequent delivery updates and receipts will be delivered directly to your email (${customerEmail}).`
        : `Dear ${customerName},\n\nYour payment for order ${shortId} (${totalFormatted}) has been confirmed! We are now preparing your order for shipment.\nDelivery address: ${shippingAddress}\n\nTrack order status: ${trackUrl}`;
      break;
    }

    case 'shipped': {
      const trackingNumber = extraData?.trackingNumber || order.trackingNumber || `ROP-TRK-${String(order.id).slice(-6).toUpperCase()}`;
      const courierName = extraData?.courierName || 'Ropenix Express Courier';

      subject = `🚚 Your Order is on the Way: ${shortId} (Tracking: ${trackingNumber})`;
      heading = 'Your Package Has Been Dispatched!';
      badgeText = 'In Transit';
      badgeColor = 'indigo';
      friendlyMessage = `Your order has been packaged and handed over to our delivery partner. It is now on its way to you!`;

      statusSpecificDetailsHtml = `
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px; margin: 18px 0; font-size: 13px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 4px 0; color: #475569; width: 40%;"><strong>Courier Partner:</strong></td>
              <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">${escapeHtml(courierName)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #475569;"><strong>Tracking Number:</strong></td>
              <td style="padding: 4px 0; color: #4338ca; font-weight: 800; font-family: monospace; font-size: 14px;">${escapeHtml(trackingNumber)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #475569;"><strong>Delivery Destination:</strong></td>
              <td style="padding: 4px 0; color: #0f172a;">${escapeHtml(shippingAddress)}</td>
            </tr>
            ${phone ? `
            <tr>
              <td style="padding: 4px 0; color: #475569;"><strong>Recipient Phone:</strong></td>
              <td style="padding: 4px 0; color: #0f172a;">${escapeHtml(phone)}</td>
            </tr>
            ` : ''}
          </table>
        </div>
      `;

      plainTextMessage = isGuest
        ? `Dear ${customerName},\n\nYour order ${shortId} has been shipped!\nCourier: ${courierName}\nTracking Number: ${trackingNumber}\nDestination: ${shippingAddress}\n\nOur rider will contact you prior to arriving at your location.`
        : `Dear ${customerName},\n\nYour order ${shortId} has been shipped!\nCourier: ${courierName}\nTracking Number: ${trackingNumber}\nDestination: ${shippingAddress}\n\nTrack your package live: ${trackUrl}`;
      break;
    }

    case 'completed': {
      subject = `🎉 Order Delivered & Completed: ${shortId} — Thank You!`;
      heading = 'Order Delivered & Completed';
      badgeText = 'Delivered & Complete';
      badgeColor = 'emerald';
      friendlyMessage = `Your order <strong>${escapeHtml(shortId)}</strong> has been successfully delivered and completed. We hope you love your new purchase!`;

      const deliveryPerson = extraData?.deliveryPerson || order.deliveryPerson || 'Assigned Courier Rider';
      const deliveryNote = extraData?.deliveryNote || order.deliveryNote || '';

      statusSpecificDetailsHtml = `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 18px; margin: 18px 0; font-size: 13px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 4px 0; color: #166534; width: 40%;"><strong>Delivery Status:</strong></td>
              <td style="padding: 4px 0; color: #15803d; font-weight: 700;">✅ Confirmed Received by Customer</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #166534;"><strong>Delivered By:</strong></td>
              <td style="padding: 4px 0; color: #14532d; font-weight: 600;">${escapeHtml(deliveryPerson)}</td>
            </tr>
            ${deliveryNote ? `
            <tr>
              <td style="padding: 4px 0; color: #166534; vertical-align: top;"><strong>Delivery Note:</strong></td>
              <td style="padding: 4px 0; color: #14532d;">${escapeHtml(deliveryNote)}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 4px 0; color: #166534;"><strong>Completed At:</strong></td>
              <td style="padding: 4px 0; color: #14532d;">${formatEATDate(new Date())}</td>
            </tr>
          </table>
        </div>
      `;

      plainTextMessage = isGuest
        ? `Dear ${customerName},\n\nYour order ${shortId} has been delivered and marked as completed!\nDelivered by: ${deliveryPerson}\n${deliveryNote ? `Note: ${deliveryNote}\n` : ''}\nThank you for shopping with Ropenix Collections!`
        : `Dear ${customerName},\n\nYour order ${shortId} has been delivered and marked as completed!\nDelivered by: ${deliveryPerson}\n${deliveryNote ? `Note: ${deliveryNote}\n` : ''}\nThank you for shopping with Ropenix Collections!\n\nView details: ${trackUrl}`;
      break;
    }

    case 'cancelled': {
      subject = `Order Cancellation Notice: ${shortId} - Ropenix Collections`;
      heading = 'Order Cancelled';
      badgeText = 'Cancelled';
      badgeColor = 'rose';
      friendlyMessage = `This email is to notify you that order <strong>${escapeHtml(shortId)}</strong> has been cancelled.`;

      statusSpecificDetailsHtml = `
        <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 14px; margin: 18px 0; font-size: 13px; color: #9f1239;">
          <strong>Reason:</strong> ${escapeHtml(extraData?.note || order.notes || 'Order cancelled by store administrator.')}
        </div>
      `;

      plainTextMessage = `Dear ${customerName},\n\nYour order ${shortId} has been cancelled.\nReason: ${extraData?.note || order.notes || 'Cancelled by administrator.'}\n\nIf you have questions, please contact us at admin@ropenix.co.ke`;
      break;
    }

    default: {
      subject = `Order Update: ${shortId} is now ${newStatus.toUpperCase()}`;
      heading = `Order Status: ${newStatus.toUpperCase()}`;
      badgeText = newStatus.toUpperCase();
      badgeColor = 'indigo';
      friendlyMessage = `Your order <strong>${escapeHtml(shortId)}</strong> status has been updated to <strong>${escapeHtml(newStatus)}</strong>.`;
      plainTextMessage = isGuest
        ? `Dear ${customerName},\n\nYour order ${shortId} status is now: ${newStatus}.\n\nAll updates will be sent to ${customerEmail}.`
        : `Dear ${customerName},\n\nYour order ${shortId} status is now: ${newStatus}.\n\nTrack order: ${trackUrl}`;
    }
  }

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(customerName)}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      ${friendlyMessage}
    </p>

    <!-- Status Details Card -->
    ${statusSpecificDetailsHtml}

    <!-- Order Items Breakdown -->
    <h3 style="margin: 22px 0 8px 0; font-size: 14px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
      Order Summary (#${escapeHtml(shortId)})
    </h3>
    ${renderItemsTable(items)}
    ${renderTotalsBlock(order)}

    ${isGuest ? `
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin: 24px 0; text-align: center; font-size: 13px; color: #475569;">
      📬 <strong>Guest Order Notice:</strong> All delivery updates, courier arrival alerts, and receipts are delivered directly to your email (<strong>${escapeHtml(customerEmail)}</strong>).
    </div>
    ` : `
    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton('View Live Order Tracking', trackUrl, badgeColor)}
    </div>
    `}

    <p style="margin: 20px 0 0 0; font-size: 12px; color: #64748b; line-height: 1.5;">
      Need help with this order? Reply directly to this email or contact support at <a href="mailto:admin@ropenix.co.ke" style="color: #4338ca; text-decoration: underline;">admin@ropenix.co.ke</a> quoting <strong>${escapeHtml(shortId)}</strong>.
    </p>
  `;

  const html = renderBaseEmailLayout({
    title: `${subject}`,
    heading,
    badgeText,
    badgeColor,
    bodyHtml,
  });

  try {
    const mailResult: SendMailResult = await sendRawMail({
      to: customerEmail,
      subject,
      html,
      text: plainTextMessage,
      category: 'transactional',
    });

    if (mailResult.success) {
      console.log(`[OrderStatusEmail] ✉️ Customer notified for order #${shortId} -> ${newStatus} (${customerEmail})`);
      return { success: true, messageId: mailResult.messageId };
    } else {
      console.error(`[OrderStatusEmail] ⚠️ Failed to deliver email for order #${shortId}:`, mailResult.error);
      return { success: false, error: mailResult.error };
    }
  } catch (err: any) {
    console.error(`[OrderStatusEmail] ❌ Email dispatch error for order #${shortId}:`, err?.message || err);
    return { success: false, error: err?.message || 'SMTP dispatch failure' };
  }
}

/**
 * Controller Action: Confirm Payment & Move to Processing
 */
export async function confirmOrderPaymentAndProcess(
  orderId: string,
  adminUser: string = 'Admin',
  options?: {
    paymentReference?: string;
    paymentAmount?: number;
    adminNotes?: string;
  }
): Promise<{ success: boolean; order?: any; error?: string }> {
  const order = await getSqliteOrderById(orderId);
  if (!order) {
    return { success: false, error: `Order #${orderId} not found.` };
  }

  const nowIso = new Date().toISOString();
  const paymentRef = options?.paymentReference || order.paymentReference || 'CONFIRMED-BY-ADMIN';
  const paymentAmount = options?.paymentAmount !== undefined ? options.paymentAmount : order.total;

  // Build new status history entry
  const history: OrderStatusHistoryEntry[] = Array.isArray(order.statusHistory) ? [...order.statusHistory] : [];
  
  const paymentHistoryEntry: OrderStatusHistoryEntry = {
    status: 'processing',
    changedBy: adminUser,
    timestamp: nowIso,
    note: options?.adminNotes || `Payment verified (Ref: ${paymentRef}). Order moved to Processing.`,
    emailSent: false,
  };

  const updatedPayload = {
    ...order,
    isPaid: true,
    paidAt: nowIso,
    paymentStatus: 'paid',
    paymentConfirmedAt: nowIso,
    paymentConfirmedBy: adminUser,
    paymentReference: paymentRef,
    paymentAmount,
    status: 'processing',
    updated_at: nowIso,
  };

  // 1. Send transactional email to customer
  const emailRes = await sendOrderStatusEmail(updatedPayload, 'processing', {
    mpesaCode: paymentRef,
    paidAt: nowIso,
  });

  paymentHistoryEntry.emailSent = Boolean(emailRes.success);
  history.push(paymentHistoryEntry);
  updatedPayload.statusHistory = history;

  // 2. Persist to SQLite
  const savedOrder = await saveSqliteOrder(updatedPayload);

  // 3. Persist to Postgres if configured
  try {
    const pool = getPostgresPool();
    if (pool) {
      await pool.query(`
        UPDATE orders
        SET status = 'processing',
            payment_status = 'paid',
            is_paid = TRUE,
            paid_at = $1,
            payment_reference = $2,
            updated_at = $1
        WHERE id = $3;
      `, [nowIso, paymentRef, orderId]);
    }
  } catch (pgErr) {
    console.warn('[OrderStatusService] PostgreSQL sync notice:', pgErr);
  }

  return { success: true, order: savedOrder };
}

/**
 * Controller Action: Transition Order Status (Processing -> Shipped -> Completed)
 */
export async function transitionOrderStatus(
  orderId: string,
  targetStatus: string,
  adminUser: string = 'Admin',
  options?: {
    trackingNumber?: string;
    courierName?: string;
    note?: string;
    deliveryPerson?: string;
    deliveryNote?: string;
    isDeliveryConfirmed?: boolean;
  }
): Promise<{ success: boolean; order?: any; error?: string; statusCode?: number }> {
  const order = await getSqliteOrderById(orderId);
  if (!order) {
    return { success: false, error: `Order #${orderId} not found.`, statusCode: 404 };
  }

  const cleanTarget = (targetStatus || '').toLowerCase().trim();

  // Validate transition rules
  const validation = validateStatusTransition(order, cleanTarget, {
    isDeliveryConfirmed: options?.isDeliveryConfirmed
  });

  if (!validation.valid) {
    return { success: false, error: validation.error, statusCode: 400 };
  }

  const nowIso = new Date().toISOString();
  const history: OrderStatusHistoryEntry[] = Array.isArray(order.statusHistory) ? [...order.statusHistory] : [];

  const trackingNumber = options?.trackingNumber || order.trackingNumber || (cleanTarget === 'shipped' ? `ROP-TRK-${String(orderId).slice(-6).toUpperCase()}` : undefined);
  const deliveryPerson = options?.deliveryPerson || order.deliveryPerson;
  const deliveryNote = options?.deliveryNote || order.deliveryNote;

  const historyEntry: OrderStatusHistoryEntry = {
    status: cleanTarget,
    changedBy: adminUser,
    timestamp: nowIso,
    note: options?.note || `Status updated to ${cleanTarget} by ${adminUser}.`,
    trackingNumber,
    deliveryPerson,
    emailSent: false,
  };

  const updatedPayload: any = {
    ...order,
    status: cleanTarget,
    updated_at: nowIso,
  };

  if (trackingNumber) {
    updatedPayload.trackingNumber = trackingNumber;
  }
  if (options?.deliveryPerson) {
    updatedPayload.deliveryPerson = options.deliveryPerson;
  }
  if (options?.deliveryNote) {
    updatedPayload.deliveryNote = options.deliveryNote;
  }

  // If marking delivered or completed with delivery note
  if (options?.isDeliveryConfirmed || cleanTarget === 'completed') {
    updatedPayload.deliveryConfirmed = true;
    if (!updatedPayload.deliveredAt) {
      updatedPayload.deliveredAt = nowIso;
    }
  }

  // 1. Dispatch Customer Email (non-blocking if it fails)
  const emailRes = await sendOrderStatusEmail(updatedPayload, cleanTarget, {
    trackingNumber,
    courierName: options?.courierName,
    deliveryPerson,
    deliveryNote,
    note: options?.note,
  });

  historyEntry.emailSent = Boolean(emailRes.success);
  history.push(historyEntry);
  updatedPayload.statusHistory = history;

  // 2. Persist to SQLite
  const savedOrder = await saveSqliteOrder(updatedPayload);

  // 3. Persist to Postgres if configured
  try {
    const pool = getPostgresPool();
    if (pool) {
      await pool.query(`
        UPDATE orders
        SET status = $1,
            tracking_number = COALESCE($2, tracking_number),
            updated_at = $3
        WHERE id = $4;
      `, [cleanTarget, trackingNumber || null, nowIso, orderId]);
    }
  } catch (pgErr) {
    console.warn('[OrderStatusService] PostgreSQL sync notice:', pgErr);
  }

  return { success: true, order: savedOrder, statusCode: 200 };
}

/**
 * Controller Action: Mark Order as Delivered (Courier Confirmation Step)
 */
export async function confirmOrderDelivery(
  orderId: string,
  adminUser: string = 'Admin',
  data?: {
    deliveryPerson?: string;
    deliveryNote?: string;
    deliveredAt?: string;
  }
): Promise<{ success: boolean; order?: any; error?: string; statusCode?: number }> {
  const order = await getSqliteOrderById(orderId);
  if (!order) {
    return { success: false, error: `Order #${orderId} not found.`, statusCode: 404 };
  }

  if (order.status !== 'shipped' && order.status !== 'processing') {
    return {
      success: false,
      error: `Cannot confirm delivery: Order #${orderId} is currently in '${order.status}' status. It must be 'shipped' first.`,
      statusCode: 400
    };
  }

  const nowIso = data?.deliveredAt || new Date().toISOString();
  const deliveryPerson = data?.deliveryPerson || order.deliveryPerson || 'Express Delivery Rider';
  const deliveryNote = data?.deliveryNote || 'Package confirmed received by customer.';

  const history: OrderStatusHistoryEntry[] = Array.isArray(order.statusHistory) ? [...order.statusHistory] : [];
  history.push({
    status: 'delivered',
    changedBy: adminUser,
    timestamp: nowIso,
    note: `Delivery confirmed by ${deliveryPerson}. Note: ${deliveryNote}`,
    deliveryPerson,
    deliveryNote,
    emailSent: false,
  });

  const updatedPayload = {
    ...order,
    deliveryConfirmed: true,
    deliveredAt: nowIso,
    deliveryPerson,
    deliveryNote,
    statusHistory: history,
    updated_at: nowIso,
  };

  const savedOrder = await saveSqliteOrder(updatedPayload);

  return { success: true, order: savedOrder, statusCode: 200 };
}
