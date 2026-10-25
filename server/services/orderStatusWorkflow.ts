/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Order Status Workflow Engine for MySQL
 * Strict Payment Lifecycles: M-Pesa (Prepaid) vs Cash on Delivery (COD)
 * Handles Transitions, Validation, MySQL Transactions, Audit History,
 * Conditional Refund Claims, and Inventory Restocking.
 */

import { getDbPool, OrderStatusHistoryRecord, RefundClaimRecord } from '../../src/lib/mysql-db';
import { sendRawMail, SendMailResult } from '../email/transporter';
import { renderBaseEmailLayout, renderEmailButton, escapeHtml } from '../email/templates/baseLayout';
import { buildTrackUrl, formatKES, formatEATDate } from '../email/urlHelper';

// Strict M-Pesa Prepaid Lifecycle:
// pending / order_received -> confirmed -> payment_confirmed -> processing -> shipped -> completed
export const MPESA_TRANSITION_MAP: Record<string, string[]> = {
  pending: ['confirmed', 'payment_confirmed', 'processing', 'cancelled'],
  order_received: ['confirmed', 'payment_confirmed', 'processing', 'cancelled'],
  confirmed: ['payment_confirmed', 'processing', 'cancelled'],
  payment_confirmed: ['confirmed', 'processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['completed', 'cancelled'],
  completed: [], // Terminal
  cancelled: [], // Terminal
};

// Strict Cash on Delivery Lifecycle:
// pending / order_received -> confirmed -> processing -> shipped -> payment_received -> completed
export const COD_TRANSITION_MAP: Record<string, string[]> = {
  pending: ['confirmed', 'processing', 'cancelled'],
  order_received: ['confirmed', 'processing', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['payment_received', 'completed', 'cancelled'],
  payment_received: ['completed', 'cancelled'],
  completed: [], // Terminal
  cancelled: [], // Terminal
};

/**
 * Normalizes payment method identifier into 'mpesa' or 'cod'
 */
export function normalizePaymentMethod(method?: string): 'mpesa' | 'cod' {
  const m = (method || '').toLowerCase().trim();
  if (m === 'cod' || m.includes('cash') || m.includes('delivery')) {
    return 'cod';
  }
  return 'mpesa';
}

/**
 * Normalizes order status including legacy database strings
 */
export function normalizeOrderStatus(status: string | undefined, paymentMethod: 'mpesa' | 'cod'): string {
  const s = (status || '').toLowerCase().trim();
  if (!s || s === 'awaiting_delivery_quote' || s === 'delivery_quoted') {
    return 'pending';
  }
  if (s === 'delivered') {
    return paymentMethod === 'cod' ? 'payment_received' : 'shipped';
  }
  if (s === 'paid' && paymentMethod === 'mpesa') {
    return 'payment_confirmed';
  }
  return s;
}

/**
 * Get valid next statuses for an order
 */
export function getValidNextStatuses(currentStatus: string, paymentMethod: 'mpesa' | 'cod'): string[] {
  const normalizedStatus = normalizeOrderStatus(currentStatus, paymentMethod);
  const map = paymentMethod === 'cod' ? COD_TRANSITION_MAP : MPESA_TRANSITION_MAP;
  return map[normalizedStatus] || [];
}

/**
 * Validates whether an order status transition is allowed
 */
export function validateWorkflowTransition(
  order: any,
  targetStatus: string,
  payload?: {
    transactionCode?: string;
    amount?: number;
    phone?: string;
    collectedBy?: string;
    cancellationReason?: string;
  }
): {
  valid: boolean;
  error?: string;
  fromStatus: string;
  toStatus: string;
  paymentMethod: 'mpesa' | 'cod';
} {
  if (!order) {
    return { valid: false, error: 'Order not found.', fromStatus: '', toStatus: targetStatus, paymentMethod: 'mpesa' };
  }

  const paymentMethod = normalizePaymentMethod(order.paymentMethod || order.payment_method);
  const fromStatus = normalizeOrderStatus(order.status, paymentMethod);
  const toStatus = normalizeOrderStatus(targetStatus, paymentMethod);
  const map = paymentMethod === 'cod' ? COD_TRANSITION_MAP : MPESA_TRANSITION_MAP;
  const pmLabel = paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'M-Pesa Prepaid';

  // Terminal state protections
  if (fromStatus === 'completed') {
    return {
      valid: false,
      error: `Invalid status transition: Order #${order.id} is already COMPLETED. Completed orders cannot be changed.`,
      fromStatus,
      toStatus,
      paymentMethod,
    };
  }

  if (fromStatus === 'cancelled') {
    return {
      valid: false,
      error: `Invalid status transition: Order #${order.id} has been CANCELLED. Cancelled orders cannot be reopened.`,
      fromStatus,
      toStatus,
      paymentMethod,
    };
  }

  // Same status check
  if (fromStatus === toStatus) {
    return {
      valid: false,
      error: `Order #${order.id} is already in '${toStatus}' status.`,
      fromStatus,
      toStatus,
      paymentMethod,
    };
  }

  // Check transition matrix
  const allowedNext = map[fromStatus] || [];
  if (!allowedNext.includes(toStatus)) {
    return {
      valid: false,
      error: `Invalid status transition: Cannot move order #${order.id} from '${fromStatus}' to '${toStatus}' for ${pmLabel}. Allowed next steps: ${allowedNext.length > 0 ? allowedNext.join(', ') : 'None (Terminal state)'}.`,
      fromStatus,
      toStatus,
      paymentMethod,
    };
  }

  // Precondition validations
  if (toStatus === 'cancelled') {
    const reason = (payload?.cancellationReason || order.cancellationReason || '').trim();
    if (!reason) {
      return {
        valid: false,
        error: `Cancellation reason is required to cancel order #${order.id}.`,
        fromStatus,
        toStatus,
        paymentMethod,
      };
    }
  }

  if (paymentMethod === 'mpesa') {
    if (toStatus === 'payment_confirmed') {
      const txCode = (payload?.transactionCode || order.paymentReference || '').trim();
      if (!txCode) {
        return {
          valid: false,
          error: `M-Pesa transaction code is required to confirm payment for order #${order.id}.`,
          fromStatus,
          toStatus,
          paymentMethod,
        };
      }
    }
    if (toStatus === 'processing' && (fromStatus === 'order_received' || fromStatus === 'pending')) {
      const isPaid = Boolean(
        order.isPaid ||
        order.paymentStatus === 'paid' ||
        (order.paymentReference && !order.paymentReference.toUpperCase().includes('PENDING') && !order.paymentReference.toUpperCase().includes('UNPAID'))
      );
      if (!isPaid) {
        return {
          valid: false,
          error: `M-Pesa payment must be verified or order confirmed before order #${order.id} can move to processing.`,
          fromStatus,
          toStatus,
          paymentMethod,
        };
      }
    }
  } else if (paymentMethod === 'cod') {
    if (toStatus === 'payment_received') {
      const collectedBy = (payload?.collectedBy || '').trim();
      if (!collectedBy) {
        return {
          valid: false,
          error: `Delivery agent or collector name is required when marking cash payment received for order #${order.id}.`,
          fromStatus,
          toStatus,
          paymentMethod,
        };
      }
    }
    if (toStatus === 'completed') {
      const isPaid = Boolean(
        order.isPaid ||
        order.is_paid ||
        order.paymentStatus === 'paid' ||
        order.payment_status === 'paid' ||
        fromStatus === 'payment_received' ||
        (order.paymentReference && !order.paymentReference.toUpperCase().includes('PENDING') && !order.paymentReference.toUpperCase().includes('UNPAID'))
      );
      if (!isPaid && fromStatus !== 'shipped' && fromStatus !== 'payment_received') {
        return {
          valid: false,
          error: `Order #${order.id} must be marked as shipped or have payment confirmed before it can be completed.`,
          fromStatus,
          toStatus,
          paymentMethod,
        };
      }
    }
  }

  return { valid: true, fromStatus, toStatus, paymentMethod };
}

/**
 * Execute Order Status Transition Atomically with MySQL Transactions
 */
export async function executeOrderTransition(
  orderId: string,
  targetStatus: string,
  changedBy: string = 'Admin',
  options?: {
    note?: string;
    transactionCode?: string;
    amount?: number;
    phone?: string;
    collectedBy?: string;
    cancellationReason?: string;
    trackingNumber?: string;
    courierName?: string;
  }
): Promise<{
  success: boolean;
  order?: any;
  refundClaim?: RefundClaimRecord | null;
  error?: string;
  statusCode?: number;
}> {
  const pool = await getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Lock order row for update
    const [rows]: any = await connection.query(
      'SELECT * FROM orders WHERE id = ? FOR UPDATE',
      [orderId]
    );

    if (!rows || rows.length === 0) {
      await connection.rollback();
      connection.release();
      return { success: false, error: `Order #${orderId} not found.`, statusCode: 404 };
    }

    const currentOrder = rows[0];
    const validation = validateWorkflowTransition(currentOrder, targetStatus, {
      transactionCode: options?.transactionCode,
      amount: options?.amount,
      phone: options?.phone,
      collectedBy: options?.collectedBy,
      cancellationReason: options?.cancellationReason,
    });

    if (!validation.valid) {
      await connection.rollback();
      connection.release();
      return { success: false, error: validation.error, statusCode: 400 };
    }

    const { fromStatus, toStatus, paymentMethod } = validation;
    const nowIso = new Date().toISOString();
    let refundClaim: RefundClaimRecord | null = null;

    // Fields to update on orders
    const updateSets: string[] = ['status = ?', 'updated_at = ?'];
    const updateVals: any[] = [toStatus, nowIso];

    // Status-specific state updates
    if (toStatus === 'confirmed') {
      if (options?.transactionCode) {
        updateSets.push('paymentReference = ?');
        updateVals.push(options.transactionCode.trim().toUpperCase());
      }
    } else if (toStatus === 'payment_confirmed') {
      const txCode = (options?.transactionCode || currentOrder.paymentReference || 'MANUAL-ADMIN').trim().toUpperCase();
      const phone = options?.phone || currentOrder.mpesaPhone || currentOrder.customerPhone || '';
      const amount = options?.amount !== undefined ? Number(options.amount) : Number(currentOrder.total);

      updateSets.push('paymentStatus = ?', 'isPaid = 1', 'paidAt = ?', 'paymentReference = ?', 'mpesaReceiptNumber = ?');
      updateVals.push('paid', nowIso, txCode, txCode);

      updateSets.push('payment_confirmed_at = ?', 'payment_confirmed_by = ?', 'payment_amount = ?');
      updateVals.push(nowIso, changedBy, amount);

      if (phone) {
        updateSets.push('mpesaPhone = ?');
        updateVals.push(phone);
      }
    } else if (toStatus === 'payment_received') {
      const collector = (options?.collectedBy || changedBy).trim();
      const amount = options?.amount !== undefined ? Number(options.amount) : Number(currentOrder.total);

      updateSets.push('paymentStatus = ?', 'isPaid = 1', 'paidAt = ?');
      updateVals.push('paid', nowIso);

      updateSets.push('payment_collected_by = ?', 'payment_collected_at = ?', 'payment_amount = ?');
      updateVals.push(collector, nowIso, amount);
    } else if (toStatus === 'shipped') {
      const trk = options?.trackingNumber || currentOrder.trackingNumber || `ROP-TRK-${String(orderId).slice(-6).toUpperCase()}`;
      updateSets.push('trackingNumber = ?');
      updateVals.push(trk);
    } else if (toStatus === 'completed') {
      updateSets.push('deliveryConfirmed = 1');
      if (!currentOrder.deliveredAt) {
        updateSets.push('deliveredAt = ?');
        updateVals.push(nowIso);
      }
      if (!currentOrder.isPaid) {
        updateSets.push('isPaid = 1', 'paymentStatus = ?');
        updateVals.push('paid');
      }
    } else if (toStatus === 'cancelled') {
      const reason = (options?.cancellationReason || options?.note || 'Cancelled by ' + changedBy).trim();
      updateSets.push('cancellation_reason = ?', 'cancelled_by = ?', 'cancelled_at = ?');
      updateVals.push(reason, changedBy, nowIso);

      // RESTOCK INVENTORY IN TRANSACTION
      let items: any[] = [];
      try {
        items = typeof currentOrder.items === 'string' ? JSON.parse(currentOrder.items) : currentOrder.items || [];
      } catch {
        items = [];
      }

      for (const it of items) {
        const prodId = it.productId || it.product || it.id;
        const qty = Number(it.quantity || 1);
        if (prodId && qty > 0) {
          // Increment product stock
          await connection.query(
            'UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?',
            [qty, nowIso, prodId]
          );

          // Get updated stock for audit log
          const [pRows]: any = await connection.query('SELECT name, sku, stock FROM products WHERE id = ? LIMIT 1', [prodId]);
          const p = pRows?.[0];
          const auditId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

          await connection.query(
            `INSERT INTO inventory_audit_logs (id, productId, productName, productSku, timestamp, changeQuantity, newStock, reason, details)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              auditId,
              String(prodId),
              p?.name || it.name || 'Product',
              p?.sku || it.sku || null,
              nowIso,
              qty,
              p?.stock !== undefined ? Number(p.stock) : 0,
              'Order Cancelled Restock',
              `Auto-restocked ${qty} units due to cancellation of Order #${orderId}. Reason: ${reason}`
            ]
          );
        }
      }

      // CONDITIONAL REFUND CLAIM CREATION:
      // If the order was already paid (M-Pesa after payment_confirmed, or COD after payment_received)
      const rawRef = String(currentOrder.paymentReference || currentOrder.mpesaReceiptNumber || '').trim();
      const hasValidRef = rawRef !== '' && !rawRef.toUpperCase().includes('PENDING') && !rawRef.toUpperCase().includes('UNPAID');
      const isPaidOrder = Boolean(
        currentOrder.isPaid === 1 ||
        currentOrder.paymentStatus === 'paid' ||
        hasValidRef ||
        fromStatus === 'payment_confirmed' ||
        (paymentMethod === 'mpesa' && ['confirmed', 'processing', 'shipped'].includes(fromStatus) && (currentOrder.isPaid || currentOrder.paymentStatus === 'paid' || hasValidRef)) ||
        fromStatus === 'payment_received'
      );

      if (isPaidOrder) {
        const claimId = `ref-claim-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const refundAmount = Number(currentOrder.payment_amount || currentOrder.total || 0);
        const paymentRef = currentOrder.paymentReference || currentOrder.mpesaReceiptNumber || 'M-PESA';

        await connection.query(
          `INSERT INTO refund_claims (
            id, order_id, amount, reason, payment_reference, status,
            customer_name, customer_email, customer_phone, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            claimId,
            orderId,
            refundAmount,
            reason,
            paymentRef,
            'refund_requested',
            currentOrder.customerName || 'Customer',
            (currentOrder.customerEmail || '').trim().toLowerCase(),
            currentOrder.customerPhone || currentOrder.phone || currentOrder.mpesaPhone || '',
            nowIso,
            nowIso,
          ]
        );

        refundClaim = {
          id: claimId,
          order_id: orderId,
          amount: refundAmount,
          reason,
          payment_reference: paymentRef,
          status: 'refund_requested',
          customer_name: currentOrder.customerName,
          customer_email: currentOrder.customerEmail,
          customer_phone: currentOrder.customerPhone,
          created_at: nowIso,
          updated_at: nowIso,
        };
      }
    }

    // 2. Persist order status change
    updateVals.push(orderId);
    await connection.query(
      `UPDATE orders SET ${updateSets.join(', ')} WHERE id = ?`,
      updateVals
    );

    // 3. Log status change in order_status_history
    const historyId = `osh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const historyNote = options?.note || (
      toStatus === 'confirmed'
        ? `Order confirmed by ${changedBy}. Ready for payment verification & processing.`
        : toStatus === 'payment_confirmed'
        ? `M-Pesa payment confirmed. Ref: ${options?.transactionCode || currentOrder.paymentReference}`
        : toStatus === 'payment_received'
        ? `Cash collected by ${options?.collectedBy || changedBy}. Amount: KES ${options?.amount || currentOrder.total}`
        : toStatus === 'cancelled'
        ? `Order cancelled: ${options?.cancellationReason || 'No reason specified'}`
        : `Status transitioned from ${fromStatus} to ${toStatus}`
    );

    const historyMetadata = {
      paymentMethod,
      transactionCode: options?.transactionCode,
      amount: options?.amount,
      collectedBy: options?.collectedBy,
      cancellationReason: options?.cancellationReason,
      trackingNumber: options?.trackingNumber,
      refundClaimId: refundClaim?.id || null,
    };

    await connection.query(
      `INSERT INTO order_status_history (id, order_id, from_status, to_status, changed_by, note, metadata, created_at, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        historyId,
        orderId,
        fromStatus,
        toStatus,
        changedBy,
        historyNote,
        JSON.stringify(historyMetadata),
        nowIso,
        nowIso,
      ]
    );

    // 4. Commit MySQL transaction
    await connection.commit();
    connection.release();

    // 5. Fetch updated order for response & notifications
    const [updatedRows]: any = await pool.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
    const updatedOrder = updatedRows[0];

    // Parse JSON fields
    if (updatedOrder) {
      if (typeof updatedOrder.items === 'string') {
        try { updatedOrder.items = JSON.parse(updatedOrder.items); } catch {}
      }
      if (typeof updatedOrder.shippingAddress === 'string') {
        try { updatedOrder.shippingAddress = JSON.parse(updatedOrder.shippingAddress); } catch {}
      }
    }

    // 6. Asynchronous email notification to customer (non-blocking)
    try {
      sendWorkflowStatusEmail(updatedOrder, toStatus, {
        note: historyNote,
        refundClaim,
        cancellationReason: options?.cancellationReason,
        trackingNumber: options?.trackingNumber || updatedOrder.trackingNumber,
      }).catch(err => console.warn('[WorkflowEmail] Warning:', err?.message || err));
    } catch (_) {}

    return {
      success: true,
      order: updatedOrder,
      refundClaim,
      statusCode: 200,
    };
  } catch (err: any) {
    await connection.rollback();
    connection.release();
    console.error(`[OrderTransition Error] Order #${orderId} -> ${targetStatus}:`, err);
    return {
      success: false,
      error: err?.message || 'Database transaction failure during status transition.',
      statusCode: 500,
    };
  }
}

/**
 * Customer Self-Service Order Cancellation
 * Permitted only if the order is order_received or processing
 */
export async function customerCancelOrder(
  orderId: string,
  customerEmail: string,
  cancellationReason: string
): Promise<{
  success: boolean;
  order?: any;
  refundClaim?: RefundClaimRecord | null;
  error?: string;
  statusCode?: number;
}> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
  if (!rows || rows.length === 0) {
    return { success: false, error: 'Order not found.', statusCode: 404 };
  }

  const order = rows[0];
  const orderEmail = (order.customerEmail || '').trim().toLowerCase();
  const reqEmail = (customerEmail || '').trim().toLowerCase();

  if (orderEmail !== reqEmail) {
    return { success: false, error: 'Unauthorized: You can only cancel your own orders.', statusCode: 403 };
  }

  const paymentMethod = normalizePaymentMethod(order.paymentMethod);
  const currentStatus = normalizeOrderStatus(order.status, paymentMethod);

  // Hard Rule: Storefront cancellation allowed only when pending, order_received, confirmed, or processing
  if (currentStatus !== 'order_received' && currentStatus !== 'pending' && currentStatus !== 'confirmed' && currentStatus !== 'processing' && currentStatus !== 'payment_confirmed') {
    return {
      success: false,
      error: `Cancellation not allowed: Order #${orderId} is currently '${currentStatus}'. Orders that are already shipped or completed cannot be cancelled directly.`,
      statusCode: 400,
    };
  }

  const reason = (cancellationReason || 'Customer requested cancellation from storefront.').trim();
  return executeOrderTransition(orderId, 'cancelled', `Customer (${customerEmail})`, {
    cancellationReason: reason,
    note: `Cancelled by customer: ${reason}`,
  });
}

/**
 * Admin Process Refund Claim
 * refund_requested -> refund_approved -> refund_paid (or refund_rejected)
 */
export async function processRefundClaimAction(
  claimId: string,
  action: 'approve' | 'reject' | 'pay',
  adminUser: string = 'Admin',
  payload?: {
    refundPaymentReference?: string;
    rejectionReason?: string;
  }
): Promise<{
  success: boolean;
  claim?: RefundClaimRecord;
  error?: string;
  statusCode?: number;
}> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM refund_claims WHERE id = ? LIMIT 1', [claimId]);
  if (!rows || rows.length === 0) {
    return { success: false, error: 'Refund claim not found.', statusCode: 404 };
  }

  const claim = rows[0];
  const nowIso = new Date().toISOString();

  if (claim.status === 'refund_paid') {
    return { success: false, error: 'Refund claim is already completed and paid.', statusCode: 400 };
  }
  if (claim.status === 'refund_rejected') {
    return { success: false, error: 'Refund claim has already been rejected.', statusCode: 400 };
  }

  if (action === 'approve') {
    if (claim.status !== 'refund_requested') {
      return { success: false, error: `Cannot approve claim currently in status '${claim.status}'.`, statusCode: 400 };
    }
    await pool.query(
      'UPDATE refund_claims SET status = ?, approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?',
      ['refund_approved', adminUser, nowIso, nowIso, claimId]
    );
  } else if (action === 'pay') {
    const refCode = (payload?.refundPaymentReference || '').trim();
    if (!refCode) {
      return { success: false, error: 'M-Pesa transaction reference is required to mark refund as paid.', statusCode: 400 };
    }
    await pool.query(
      'UPDATE refund_claims SET status = ?, refund_payment_reference = ?, refunded_by = ?, refunded_at = ?, updated_at = ? WHERE id = ?',
      ['refund_paid', refCode.toUpperCase(), adminUser, nowIso, nowIso, claimId]
    );
  } else if (action === 'reject') {
    const reason = (payload?.rejectionReason || 'Rejected by administrator').trim();
    await pool.query(
      'UPDATE refund_claims SET status = ?, rejected_by = ?, rejected_at = ?, rejection_reason = ?, updated_at = ? WHERE id = ?',
      ['refund_rejected', adminUser, nowIso, reason, nowIso, claimId]
    );
  } else {
    return { success: false, error: `Invalid action '${action}'.`, statusCode: 400 };
  }

  const [updatedRows]: any = await pool.query('SELECT * FROM refund_claims WHERE id = ? LIMIT 1', [claimId]);
  const updatedClaim = updatedRows[0];
  if (updatedClaim) {
    updatedClaim.amount = Number(updatedClaim.amount);
  }

  return { success: true, claim: updatedClaim, statusCode: 200 };
}

/**
 * Send Transactional Email for Workflow Status Events
 */
async function sendWorkflowStatusEmail(
  order: any,
  status: string,
  extra: {
    note?: string;
    refundClaim?: RefundClaimRecord | null;
    cancellationReason?: string;
    trackingNumber?: string;
  }
): Promise<void> {
  const customerEmail = order.customerEmail || order.customer_email;
  if (!customerEmail) return;

  const shortId = String(order.id).slice(-8).toUpperCase();
  const customerName = order.customerName || 'Valued Customer';
  const trackUrl = buildTrackUrl(order.id);

  let subject = `Order Update: #${shortId} is ${status.replace(/_/g, ' ').toUpperCase()}`;
  let heading = `Order Status: ${status.replace(/_/g, ' ').toUpperCase()}`;
  let badgeColor: 'indigo' | 'emerald' | 'amber' | 'rose' = 'indigo';
  let message = `Your order status has been updated to <strong>${escapeHtml(status.replace(/_/g, ' '))}</strong>.`;

  if (status === 'confirmed') {
    badgeColor = 'indigo';
    subject = `Order Confirmed: #${shortId} has been Confirmed`;
    heading = 'Order Confirmed';
    message = `Thank you! Your order <strong>#${escapeHtml(shortId)}</strong> has been confirmed by our team. We are checking details and preparing it for fulfillment.`;
  } else if (status === 'payment_confirmed') {
    badgeColor = 'emerald';
    subject = `Payment Confirmed: Order #${shortId} is Verified!`;
    heading = 'Payment Verified & Confirmed';
    message = `Thank you! Your M-Pesa payment for order <strong>#${escapeHtml(shortId)}</strong> has been verified. We are now preparing your order for fulfillment.`;
  } else if (status === 'processing') {
    badgeColor = 'indigo';
    subject = `Order #${shortId} is Now Processing`;
    heading = 'Order in Preparation';
    message = `Great news! Order <strong>#${escapeHtml(shortId)}</strong> is actively being processed and packaged at our fulfillment hub.`;
  } else if (status === 'shipped') {
    badgeColor = 'indigo';
    subject = `Order Dispatched: #${shortId} is On the Way!`;
    heading = 'Order Dispatched with Courier';
    message = `Your package for order <strong>#${escapeHtml(shortId)}</strong> is on the way! Tracking code: <strong>${escapeHtml(extra.trackingNumber || 'Available in tracking')}</strong>.`;
  } else if (status === 'payment_received') {
    badgeColor = 'emerald';
    subject = `Cash Payment Received: Order #${shortId}`;
    heading = 'Payment Collected';
    message = `Cash on delivery collection has been recorded for order <strong>#${escapeHtml(shortId)}</strong>. Thank you for shopping with Ropenix!`;
  } else if (status === 'completed') {
    badgeColor = 'emerald';
    subject = `Order Completed: #${shortId} — Thank You!`;
    heading = 'Order Delivered & Completed';
    message = `Your order <strong>#${escapeHtml(shortId)}</strong> has been successfully delivered and completed. We hope you love your purchase!`;
  } else if (status === 'cancelled') {
    badgeColor = 'rose';
    subject = `Order #${shortId} has been Cancelled`;
    heading = 'Order Cancellation Notice';
    message = `This email is to notify you that order <strong>#${escapeHtml(shortId)}</strong> has been cancelled.`;
    if (extra.cancellationReason) {
      message += `<br><br><strong>Reason:</strong> ${escapeHtml(extra.cancellationReason)}`;
    }
    if (extra.refundClaim) {
      message += `<br><br><em>A refund claim of KES ${extra.refundClaim.amount.toLocaleString()} has been automatically registered (Status: ${extra.refundClaim.status}). Our finance desk will process your M-Pesa reversal shortly.</em>`;
    }
  }

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(customerName)}</strong>,
    </p>
    <p style="margin: 0 0 20px 0; line-height: 1.6; color: #334155;">
      ${message}
    </p>
    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton('Track Live Order Status', trackUrl, badgeColor)}
    </div>
  `;

  const html = renderBaseEmailLayout({
    title: subject,
    heading,
    badgeText: status.replace(/_/g, ' ').toUpperCase(),
    badgeColor,
    bodyHtml,
  });

  await sendRawMail({
    to: customerEmail,
    subject,
    html,
    category: 'transactional',
  });
}
