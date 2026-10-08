/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { enqueueEmail } from './queue';
import { getEmailConfig } from './config';
import { OrderEmailData } from './templates/types';
import { formatKES } from './urlHelper';

class EmailEventEmitter extends EventEmitter {}

export const emailEvents = new EmailEventEmitter();

// Increase max listeners for heavy traffic
emailEvents.setMaxListeners(50);

/**
 * Register all domain event listeners
 */
export function registerEmailEventListeners(): void {
  const config = getEmailConfig();
  const adminEmail = config.admin.email;

  // 1. Order Placed / Created
  emailEvents.on('order:created', async (order: OrderEmailData) => {
    try {
      const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
      const totalFormatted = formatKES(order.total);

      // Customer confirmation
      if (order.customerEmail) {
        await enqueueEmail({
          emailType: 'order_confirmation',
          recipient: order.customerEmail,
          subject: `Order Confirmed: ${shortId} (${totalFormatted}) - Ropenix Collections`,
          payload: order,
          dedupeKey: `order_confirmation:${order.id}`,
        });
      }

      // Admin alert
      if (adminEmail) {
        await enqueueEmail({
          emailType: 'admin_new_order',
          recipient: adminEmail,
          subject: `🔔 [NEW ORDER] ${shortId} by ${order.customerName} (${totalFormatted})`,
          payload: order,
          dedupeKey: `admin_new_order:${order.id}`,
        });
      }
    } catch (err) {
      console.error('[Email Events] Error handling order:created:', err);
    }
  });

  // 2. Customer Submitted Payment Code ("I've Paid")
  emailEvents.on('payment:submitted', async (data: {
    orderId: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    mpesaCode: string;
    amount: number;
    total: number;
    notes?: string;
  }) => {
    try {
      const shortId = data.orderId.startsWith('ROP-') ? data.orderId : `ROP-${data.orderId.slice(-6).toUpperCase()}`;

      // Customer acknowledgment
      if (data.customerEmail) {
        await enqueueEmail({
          emailType: 'payment_submission_received',
          recipient: data.customerEmail,
          subject: `Payment Claim Received: ${data.mpesaCode} for Order ${shortId}`,
          payload: data,
          dedupeKey: `payment_submitted_cust:${data.orderId}:${data.mpesaCode}`,
        });
      }

      // Admin alert to verify
      if (adminEmail) {
        await enqueueEmail({
          emailType: 'admin_payment_submitted',
          recipient: adminEmail,
          subject: `💰 [VERIFY PAYMENT] M-Pesa ${data.mpesaCode.toUpperCase()} for Order ${shortId}`,
          payload: data,
          dedupeKey: `payment_submitted_admin:${data.orderId}:${data.mpesaCode}`,
        });
      }
    } catch (err) {
      console.error('[Email Events] Error handling payment:submitted:', err);
    }
  });

  // 3. Admin Verified Payment (Order Paid)
  emailEvents.on('payment:confirmed', async (order: OrderEmailData & { mpesaCode?: string; confirmedAt?: string }) => {
    try {
      const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
      const totalFormatted = formatKES(order.total);

      if (order.customerEmail) {
        await enqueueEmail({
          emailType: 'payment_receipt',
          recipient: order.customerEmail,
          subject: `Payment Confirmed & Official Receipt: ${shortId} (${totalFormatted})`,
          payload: order,
          dedupeKey: `payment_receipt:${order.id}`,
        });
      }
    } catch (err) {
      console.error('[Email Events] Error handling payment:confirmed:', err);
    }
  });

  // 4. Admin Flagged Payment Issue
  emailEvents.on('payment:issue', async (order: OrderEmailData & {
    issueReason: string;
    expectedAmount?: number;
    receivedAmount?: number;
    instructions?: string;
  }) => {
    try {
      const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;

      if (order.customerEmail) {
        await enqueueEmail({
          emailType: 'payment_issue',
          recipient: order.customerEmail,
          subject: `Action Needed: Payment Verification Issue for Order ${shortId}`,
          payload: order,
          // Dedupe per timestamp to allow re-sending if subsequent issues occur
          dedupeKey: `payment_issue:${order.id}:${Date.now()}`,
        });
      }
    } catch (err) {
      console.error('[Email Events] Error handling payment:issue:', err);
    }
  });

  // 5. Order Dispatched / Shipped
  emailEvents.on('order:shipped', async (order: OrderEmailData & {
    trackingNumber?: string;
    courierName?: string;
    estimatedDelivery?: string;
  }) => {
    try {
      const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;

      if (order.customerEmail) {
        await enqueueEmail({
          emailType: 'order_shipped',
          recipient: order.customerEmail,
          subject: `🚚 Your Order is on the Way: ${shortId}`,
          payload: order,
          dedupeKey: `order_shipped:${order.id}`,
        });
      }
    } catch (err) {
      console.error('[Email Events] Error handling order:shipped:', err);
    }
  });

  // 6. Order Delivered
  emailEvents.on('order:delivered', async (order: OrderEmailData & { reviewUrl?: string }) => {
    try {
      const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;

      if (order.customerEmail) {
        await enqueueEmail({
          emailType: 'order_delivered',
          recipient: order.customerEmail,
          subject: `🎉 Order Delivered: ${shortId} - Enjoy Your Items!`,
          payload: order,
          dedupeKey: `order_delivered:${order.id}`,
        });
      }
    } catch (err) {
      console.error('[Email Events] Error handling order:delivered:', err);
    }
  });

  // 7. Order Cancelled
  emailEvents.on('order:cancelled', async (order: OrderEmailData & { cancellationReason?: string }) => {
    try {
      const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;

      if (order.customerEmail) {
        await enqueueEmail({
          emailType: 'order_cancelled',
          recipient: order.customerEmail,
          subject: `Order Cancellation Notice: ${shortId} - Ropenix Collections`,
          payload: order,
          dedupeKey: `order_cancelled:${order.id}`,
        });
      }
    } catch (err) {
      console.error('[Email Events] Error handling order:cancelled:', err);
    }
  });

  // 8. Refund Processed
  emailEvents.on('refund:processed', async (order: OrderEmailData & {
    refundAmount: number;
    refundReference?: string;
    refundMethod?: string;
  }) => {
    try {
      const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
      const refundFormatted = formatKES(order.refundAmount);

      if (order.customerEmail) {
        await enqueueEmail({
          emailType: 'refund_processed',
          recipient: order.customerEmail,
          subject: `Refund Processed: ${shortId} (${refundFormatted}) - Ropenix Collections`,
          payload: order,
          dedupeKey: `refund_processed:${order.id}:${order.refundReference || Date.now()}`,
        });
      }
    } catch (err) {
      console.error('[Email Events] Error handling refund:processed:', err);
    }
  });

  // 9. User Registration
  emailEvents.on('auth:registered', async (data: { name: string; email: string; verificationUrl?: string }) => {
    try {
      if (data.email) {
        await enqueueEmail({
          emailType: 'welcome',
          recipient: data.email,
          subject: `Welcome to Ropenix Collections, ${data.name}! 🎉`,
          payload: data,
          dedupeKey: `welcome:${data.email}`,
        });
      }
    } catch (err) {
      console.error('[Email Events] Error handling auth:registered:', err);
    }
  });

  // 10. Password Reset
  emailEvents.on('auth:password_reset', async (data: { name: string; email: string; resetUrl: string; expiresInMinutes?: number }) => {
    try {
      if (data.email) {
        await enqueueEmail({
          emailType: 'password_reset',
          recipient: data.email,
          subject: 'Reset your password - Ropenix Collections',
          payload: data,
          dedupeKey: `pwd_reset:${data.email}:${Date.now()}`,
        });
      }
    } catch (err) {
      console.error('[Email Events] Error handling auth:password_reset:', err);
    }
  });

  // 11. Password Changed
  emailEvents.on('auth:password_changed', async (data: { name: string; email: string; timestamp?: string }) => {
    try {
      if (data.email) {
        await enqueueEmail({
          emailType: 'password_changed',
          recipient: data.email,
          subject: 'Security Alert: Password Changed - Ropenix Collections',
          payload: data,
          dedupeKey: `pwd_changed:${data.email}:${Date.now()}`,
        });
      }
    } catch (err) {
      console.error('[Email Events] Error handling auth:password_changed:', err);
    }
  });

  console.log('[Email Events] 🔗 Domain event listeners registered.');
}
