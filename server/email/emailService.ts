/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { emailEvents } from './events';
import { enqueueEmail } from './queue';
import { OrderEmailData } from './templates/types';
import { formatKES } from './urlHelper';

export const emailService = {
  /**
   * Triggers order confirmation email for newly created order
   */
  async sendOrderConfirmation(order: OrderEmailData): Promise<void> {
    emailEvents.emit('order:created', order);
  },

  /**
   * Resends Paybill instructions to customer
   */
  async sendPaybillInstructions(order: OrderEmailData): Promise<string | null> {
    const shortId = order.id.startsWith('ROP-') ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
    const totalFormatted = formatKES(order.total);
    return enqueueEmail({
      emailType: 'paybill_instructions',
      recipient: order.customerEmail,
      subject: `Payment Instructions for Order ${shortId} (${totalFormatted}) - Ropenix Collections`,
      payload: order,
    });
  },

  /**
   * Triggers acknowledgment to customer & alert to admin upon customer payment submission
   */
  async sendPaymentClaimSubmitted(data: {
    orderId: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    mpesaCode: string;
    amount: number;
    total: number;
    notes?: string;
  }): Promise<void> {
    emailEvents.emit('payment:submitted', data);
  },

  /**
   * Triggers official receipt when admin verifies payment
   */
  async sendPaymentReceipt(order: OrderEmailData & { mpesaCode?: string; confirmedAt?: string }): Promise<void> {
    emailEvents.emit('payment:confirmed', order);
  },

  /**
   * Triggers payment issue notification
   */
  async sendPaymentIssue(order: OrderEmailData & {
    issueReason: string;
    expectedAmount?: number;
    receivedAmount?: number;
    instructions?: string;
  }): Promise<void> {
    emailEvents.emit('payment:issue', order);
  },

  /**
   * Triggers order dispatched notification
   */
  async sendOrderShipped(order: OrderEmailData & {
    trackingNumber?: string;
    courierName?: string;
    estimatedDelivery?: string;
  }): Promise<void> {
    emailEvents.emit('order:shipped', order);
  },

  /**
   * Triggers order delivered notification
   */
  async sendOrderDelivered(order: OrderEmailData & { reviewUrl?: string }): Promise<void> {
    emailEvents.emit('order:delivered', order);
  },

  /**
   * Triggers order cancelled notification
   */
  async sendOrderCancelled(order: OrderEmailData & { cancellationReason?: string }): Promise<void> {
    emailEvents.emit('order:cancelled', order);
  },

  /**
   * Triggers refund processed notification
   */
  async sendRefundProcessed(order: OrderEmailData & {
    refundAmount: number;
    refundReference?: string;
    refundMethod?: string;
  }): Promise<void> {
    emailEvents.emit('refund:processed', order);
  },

  /**
   * Triggers welcome email for new user registration
   */
  async sendWelcome(data: { name: string; email: string; verificationUrl?: string }): Promise<void> {
    emailEvents.emit('auth:registered', data);
  },

  /**
   * Triggers password reset email
   */
  async sendPasswordReset(data: { name: string; email: string; resetUrl: string; expiresInMinutes?: number }): Promise<void> {
    emailEvents.emit('auth:password_reset', data);
  },

  /**
   * Triggers password changed security notification
   */
  async sendPasswordChanged(data: { name: string; email: string; timestamp?: string }): Promise<void> {
    emailEvents.emit('auth:password_changed', data);
  },
};
