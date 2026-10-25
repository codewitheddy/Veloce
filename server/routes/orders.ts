/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getAllSqliteOrders,
  getSqliteOrderById,
  getSqliteOrdersByUser,
  saveSqliteOrder,
  updateSqliteOrderStatus,
  deleteSqliteOrder,
  syncSqliteOrders,
  getMysqlOrderStatusHistory,
  getMysqlRefundClaimByOrderId,
  getAllMysqlRefundClaims,
  getMysqlRefundClaimById,
  enrichOrdersWithReviewEligibility,
} from '../../src/lib/sqlite-db';
import {
  executeOrderTransition,
  customerCancelOrder,
  processRefundClaimAction,
  normalizePaymentMethod,
  normalizeOrderStatus,
  getValidNextStatuses,
  MPESA_TRANSITION_MAP,
  COD_TRANSITION_MAP,
} from '../services/orderStatusWorkflow';
import { fetchAuthoritativeOrderById } from '../email/db';
import { emailEvents } from '../email/events';
import { requireAuth, requireAdmin, getAuthTokenFromRequest, extractUserFromToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { validateCart } from '../services/cartValidation';
import { cartStreamManager } from '../services/cartStream';
import { loadProductsCache, persistProductsCache } from './products';
import { trackingRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Zod validation schema for order creation
const OrderItemSchema = z.object({
  id: z.string().or(z.number()).optional(),
  productId: z.string().or(z.number()).optional(),
  name: z.string().optional(),
  product_name: z.string().optional(),
  title: z.string().optional(),
  price: z.number().nonnegative().optional(),
  unit_price: z.number().nonnegative().optional(),
  quantity: z.number().optional().default(1),
  image: z.string().optional(),
  imageUrl: z.string().optional(),
  sku: z.string().optional(),
  product_sku: z.string().optional(),
  selectedVariant: z.any().optional(),
  selectedVariations: z.any().optional(),
  selected_variations: z.any().optional(),
  selectedColor: z.string().optional(),
  selectedSize: z.string().optional(),
}).passthrough();

const CreateOrderSchema = z.object({
  id: z.string().optional(),
  customerName: z.string().optional(),
  customer_name: z.string().optional(),
  customerEmail: z.string().optional(),
  customer_email: z.string().optional(),
  phone: z.string().optional(),
  customerPhone: z.string().optional(),
  customer_phone: z.string().optional(),
  shippingAddress: z.string().optional(),
  shipping_address: z.string().optional(),
  paymentMethod: z.string().optional(),
  payment_method: z.string().optional(),
  paymentStatus: z.string().optional(),
  payment_status: z.string().optional(),
  status: z.string().optional(),
  items: z.array(OrderItemSchema).optional().default([]),
  total: z.number().nonnegative().optional(),
  subtotal: z.number().nonnegative().optional(),
  shippingFee: z.number().nonnegative().optional(),
  shipping_fee: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  customNote: z.string().optional(),
}).passthrough();

// 1. Public Order Tracking (Payment Method Aware)
router.get('/track/:orderId', trackingRateLimiter, async (req: Request, res: Response) => {
  const { orderId } = req.params;
  try {
    const order = await fetchAuthoritativeOrderById(orderId) || await getSqliteOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const paymentMethod = normalizePaymentMethod(order.paymentMethod || order.payment_method);
    const normalizedStatus = normalizeOrderStatus(order.status, paymentMethod);
    const trackingNumber = order.trackingNumber || `ROP-TRK-${String(order.id).slice(-6).toUpperCase()}`;

    // Fetch refund claim if order was cancelled and paid
    const refundClaim = await getMysqlRefundClaimByOrderId(order.id);
    const history = await getMysqlOrderStatusHistory(order.id);

    // Build checkpoints tailored to payment method lifecycle
    let checkpoints: any[] = [];
    if (paymentMethod === 'cod') {
      // COD flow: order_received -> processing -> shipped -> payment_received -> completed
      const isReceived = true;
      const isProcessing = ['processing', 'shipped', 'payment_received', 'completed'].includes(normalizedStatus);
      const isShipped = ['shipped', 'payment_received', 'completed'].includes(normalizedStatus);
      const isPaid = ['payment_received', 'completed'].includes(normalizedStatus) || Boolean(order.isPaid);
      const isCompleted = normalizedStatus === 'completed';

      checkpoints = [
        { status: 'Order Received', code: 'order_received', timestamp: order.createdAt || order.date || null, completed: isReceived },
        { status: 'Processing & Packaging', code: 'processing', timestamp: null, completed: isProcessing },
        { status: 'Dispatched with Courier', code: 'shipped', timestamp: null, completed: isShipped },
        { status: 'Cash Payment Received', code: 'payment_received', timestamp: order.payment_collected_at || order.paidAt || null, completed: isPaid },
        { status: 'Delivered & Completed', code: 'completed', timestamp: order.deliveredAt || null, completed: isCompleted },
      ];
    } else {
      // M-Pesa flow: order_received -> payment_confirmed -> processing -> shipped -> completed
      const isReceived = true;
      const isConfirmed = ['payment_confirmed', 'processing', 'shipped', 'completed'].includes(normalizedStatus) || Boolean(order.isPaid || order.paymentStatus === 'paid');
      const isProcessing = ['processing', 'shipped', 'completed'].includes(normalizedStatus);
      const isShipped = ['shipped', 'completed'].includes(normalizedStatus);
      const isCompleted = normalizedStatus === 'completed';

      checkpoints = [
        { status: 'Order Received', code: 'order_received', timestamp: order.createdAt || order.date || null, completed: isReceived },
        { status: 'M-Pesa Payment Confirmed', code: 'payment_confirmed', timestamp: order.payment_confirmed_at || order.paidAt || null, completed: isConfirmed },
        { status: 'Processing & Packaging', code: 'processing', timestamp: null, completed: isProcessing },
        { status: 'Dispatched with Courier', code: 'shipped', timestamp: null, completed: isShipped },
        { status: 'Delivered & Completed', code: 'completed', timestamp: order.deliveredAt || null, completed: isCompleted },
      ];
    }

    const canCancel = normalizedStatus === 'order_received' || normalizedStatus === 'processing' || normalizedStatus === 'payment_confirmed';

    return res.json({
      success: true,
      id: order.id,
      orderId: order.id,
      customerName: order.customerName,
      customerEmail: order.customerEmail || '',
      phone: order.phone || order.mpesaPhone || '',
      status: normalizedStatus,
      rawStatus: order.status,
      paymentMethod,
      paymentStatus: order.paymentStatus,
      isPaid: Boolean(order.isPaid || order.paymentStatus === 'paid'),
      fulfillmentType: order.fulfillmentType || 'delivery',
      shippingFee: Number(order.shippingFee || 0),
      quotedCourier: order.quotedCourier || '',
      areaEstate: order.areaEstate || '',
      landmark: order.landmark || '',
      trackingNumber,
      carrier: order.quotedCourier ? `${order.quotedCourier} Courier` : 'Ropenix Express Courier',
      shippingAddress: order.shippingAddress || '',
      total: Number(order.total || 0),
      subtotal: Number(order.subtotal || order.total || 0),
      cancellationReason: order.cancellation_reason || order.cancellationReason || null,
      cancelledBy: order.cancelled_by || order.cancelledBy || null,
      cancelledAt: order.cancelled_at || order.cancelledAt || null,
      canCancel,
      refundClaim: refundClaim || null,
      history: history.length > 0 ? history : undefined,
      items: Array.isArray(order.items)
        ? order.items
        : typeof order.items === 'string'
        ? (() => { try { return JSON.parse(order.items); } catch { return []; } })()
        : [],
      date: order.date || order.createdAt || new Date().toISOString(),
      isGuest: Boolean(order.isGuest),
      checkpoints,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error retrieving tracking information';
    return res.status(500).json({ success: false, error: message });
  }
});

// 2. List Orders (Admin gets all, Authenticated customer gets their own)
router.get('/', async (req: Request, res: Response) => {
  try {
    const token = getAuthTokenFromRequest(req);
    if (!token) {
      // Unauthenticated request returns empty array for storefront safety
      return res.json([]);
    }

    const user = await extractUserFromToken(token);
    if (!user) {
      return res.json([]);
    }

    let orders: any[] = [];
    if (user.is_staff || user.is_superuser || user.role === 'admin') {
      orders = await getAllSqliteOrders();
    } else {
      orders = await getSqliteOrdersByUser(user.email || user.id);
    }

    // Enrich all orders with review state using single batch query (LEFT JOIN reviews)
    orders = await enrichOrdersWithReviewEligibility(orders);

    // Support ?needsReview=true filter (preserving pagination)
    if (req.query.needsReview === 'true' || req.query.needsReview === '1') {
      orders = orders.filter((o: any) => (o.unreviewedCount || 0) > 0);
    }

    if (req.query.page && req.query.limit) {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
      const total = orders.length;
      const offset = (page - 1) * limit;
      const paginatedOrders = orders.slice(offset, offset + limit);

      return res.json({
        count: total,
        next: page * limit < total ? `/api/orders/?page=${page + 1}&limit=${limit}${req.query.needsReview ? '&needsReview=true' : ''}` : null,
        previous: page > 1 ? `/api/orders/?page=${page - 1}&limit=${limit}${req.query.needsReview ? '&needsReview=true' : ''}` : null,
        results: paginatedOrders,
      });
    }

    return res.json(orders);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve orders';
    return res.status(500).json({ success: false, error: message });
  }
});

// Live SSE client pool for real-time admin order alerts
const adminSseClients = new Set<Response>();

export function broadcastOrderToAdmin(order: any): void {
  const payload = JSON.stringify({
    type: 'NEW_ORDER_PLACED',
    order,
    timestamp: Date.now(),
  });

  for (const client of adminSseClients) {
    try {
      client.write(`event: new_order\ndata: ${payload}\n\n`);
    } catch (_) {
      adminSseClients.delete(client);
    }
  }
}

// 2a. Real-time Order Stream (Server-Sent Events) for Admin Dashboard
router.get('/live-stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(`event: connected\ndata: {"status":"connected","timestamp":${Date.now()}}\n\n`);
  adminSseClients.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (_) {
      clearInterval(heartbeat);
      adminSseClients.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    adminSseClients.delete(res);
  });
});

// 2b. Recent Orders Polling Fallback
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const allOrders = await getAllSqliteOrders();
    const sorted = (allOrders || []).sort((a: any, b: any) => {
      const timeA = new Date(a.created_at || a.date || 0).getTime();
      const timeB = new Date(b.created_at || b.date || 0).getTime();
      return timeB - timeA;
    });
    return res.json({ success: true, orders: sorted.slice(0, limit) });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve latest orders' });
  }
});

// 3. Get Order by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const order = await getSqliteOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const isAdmin = Boolean(user && (user.is_staff || user.is_superuser || user.role === 'admin'));

    if (!isAdmin) {
      const userEmail = user?.email?.toLowerCase().trim();
      const orderEmail = (order.customerEmail || order.customer_email || '').toLowerCase().trim();
      const orderUserId = order.userId ? String(order.userId) : '';
      const authUserId = user?.id ? String(user.id) : '';

      if (!user || (userEmail !== orderEmail && (!orderUserId || orderUserId !== authUserId))) {
        return res.status(403).json({ success: false, error: 'Access denied. You do not have permission to view this order.' });
      }
    }

    const [enrichedOrder] = await enrichOrdersWithReviewEligibility([order]);
    return res.json(enrichedOrder || order);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve order';
    return res.status(500).json({ success: false, error: message });
  }
});

// 4. Create Order with Server-Side Verification, Authoritative Cart Validation & Transactional Email
router.post('/', validateBody(CreateOrderSchema), async (req: Request, res: Response) => {
  try {
    const orderData = req.body;
    const orderId = orderData.id || `ord-${Date.now()}`;
    const token = getAuthTokenFromRequest(req);
    const isGuestOrder = Boolean(orderData.isGuest || !token);
    const user = (!isGuestOrder && token) ? await extractUserFromToken(token) : null;

    // Derive customer info: Explicit checkout form details take top priority
    const customerEmail = (orderData.customerEmail || orderData.customer_email || orderData.email || user?.email || '').trim().toLowerCase();
    const customerName = (orderData.customerName || orderData.customer_name || (user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : 'Valued Customer')).trim();
    const customerPhone = (orderData.phone || orderData.customerPhone || orderData.customer_phone || user?.phone || '').trim();

    const incomingItems = Array.isArray(orderData.items) ? orderData.items : [];
    const couponCode = orderData.couponCode || orderData.coupon || orderData.promoCode || '';
    const clientExpectedTotal = orderData.total !== undefined && !isNaN(Number(orderData.total)) ? Number(orderData.total) : undefined;

    // Run Authoritative Server-Side Cart Validation (No client prices trusted)
    const validation = await validateCart({
      items: incomingItems,
      couponCode,
      expectedTotal: clientExpectedTotal,
    });

    // Guard: If any item is out of stock, quantity changed, price changed, or coupon invalid -> 409 Conflict
    if (validation.hasConflict || validation.changes.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'CART_CONFLICT',
        message: 'Cart items, prices, or inventory have updated. Please review before proceeding.',
        validation,
        changes: validation.changes,
      });
    }

    if (validation.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'EMPTY_CART',
        message: 'Your cart is empty or items are no longer available.',
      });
    }

    // Atomically decrement stock for each item in the validated cart
    const products = await loadProductsCache();
    for (const item of validation.items) {
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        if (item.variantId && Array.isArray(prod.variants || prod.variantMatrix)) {
          const vList = prod.variants || prod.variantMatrix;
          const v = vList.find((vItem: any) => vItem.id === item.variantId || vItem.sku === item.sku);
          if (v && v.stockQty !== undefined) {
            v.stockQty = Math.max(0, Number(v.stockQty) - item.quantity);
          }
        }
        const currentStock = Number(prod.stock || 0);
        prod.stock = Math.max(0, currentStock - item.quantity);
        prod.updated_at = new Date().toISOString();

        // Broadcast real-time stock change via cartStreamManager
        cartStreamManager.broadcastProductChange(prod.id, {
          stock: prod.stock,
          variants: prod.variants || prod.variantMatrix,
        });
      }
    }
    await persistProductsCache();

    // Authoritative totals & line item price snapshots
    const calculatedSubtotal = validation.subtotal;
    const authoritativeDiscount = validation.discount;
    const shippingFee = orderData.shippingFee !== undefined && !isNaN(Number(orderData.shippingFee))
      ? Number(orderData.shippingFee)
      : (calculatedSubtotal > 5000 ? 0 : 350);
    const finalTotal = Math.max(0, calculatedSubtotal + shippingFee - authoritativeDiscount);

    const snapshotItems = validation.items.map(it => ({
      ...it,
      price: it.price,
      unit_price: it.price,
      original_price: it.originalPrice,
      lineTotal: it.lineTotal,
    }));

    const newOrderPayload = {
      ...orderData,
      id: orderId,
      userId: (!isGuestOrder && user?.id) ? user.id : null,
      isGuest: isGuestOrder,
      customerName,
      customer_name: customerName,
      customerEmail,
      customer_email: customerEmail,
      email: customerEmail,
      phone: customerPhone,
      customerPhone,
      customer_phone: customerPhone,
      items: snapshotItems,
      subtotal: calculatedSubtotal,
      shippingFee,
      discount: authoritativeDiscount,
      total: finalTotal,
      couponCode: validation.appliedCoupon?.code || null,
      status: orderData.status || 'pending',
      paymentStatus: 'pending', // Hard rule: Payment status is never marked 'paid' directly from client
      paymentMethod: orderData.paymentMethod || orderData.payment_method || 'M-PESA',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const savedOrder = await saveSqliteOrder(newOrderPayload);

    // Broadcast in real-time to active admin browser dashboards (desktop window alert + audio chime)
    try {
      broadcastOrderToAdmin(savedOrder);
    } catch (sseErr) {
      console.warn('[Orders API] Real-time admin SSE broadcast warning:', sseErr);
    }

    // Trigger Decoupled Domain Transactional Email Pipeline
    try {
      emailEvents.emit('order:created', {
        id: orderId,
        customerName,
        customerEmail,
        customerPhone,
        total: finalTotal,
        subtotal: calculatedSubtotal,
        shippingFee,
        discount: authoritativeDiscount,
        paymentMethod: savedOrder.paymentMethod,
        shippingAddress: savedOrder.shippingAddress || '',
        items: snapshotItems,
        createdAt: savedOrder.created_at,
        isGuest: isGuestOrder,
        userId: savedOrder.userId,
      });
    } catch (emailErr) {
      console.warn('[Orders API] Email dispatch emit warning:', emailErr);
    }

    res.status(201).json({ success: true, order: savedOrder, message: 'Order created and notifications queued.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save order';
    console.error('[Express Orders Error]:', err);
    res.status(500).json({ success: false, error: message });
  }
});

import {
  validateStatusTransition,
  sendOrderStatusEmail,
  confirmOrderPaymentAndProcess,
  transitionOrderStatus,
  confirmOrderDelivery
} from '../services/orderStatusService';

// 5. Update Order Status & Workflow (Admin only)
router.put(['/:id', '/:id/'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const existing = await getSqliteOrderById(orderId);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Order #${orderId} not found.` });
    }

    const adminUser = (req as any).user?.email || (req as any).user?.username || 'Admin';

    // 1. If transitioning status (Strict Workflow Transition takes highest priority)
    if (req.body.status && req.body.status !== existing.status) {
      const transitionResult = await executeOrderTransition(orderId, req.body.status, adminUser, {
        note: req.body.notes || req.body.note,
        transactionCode: req.body.transactionCode || req.body.transaction_code || req.body.paymentReference || req.body.payment_reference,
        amount: req.body.amount || req.body.paymentAmount || req.body.payment_amount,
        phone: req.body.phone || req.body.mpesaPhone || req.body.mpesa_phone,
        collectedBy: req.body.collectedBy || req.body.collected_by || req.body.deliveryPerson || adminUser,
        cancellationReason: req.body.cancellationReason || req.body.cancellation_reason || req.body.reason || req.body.notes,
        trackingNumber: req.body.trackingNumber || req.body.tracking_number,
        courierName: req.body.courierName || req.body.courier_name,
      });

      if (!transitionResult.success) {
        return res.status(transitionResult.statusCode || 400).json({
          success: false,
          error: transitionResult.error,
        });
      }

      return res.json({
        success: true,
        message: `Order #${orderId} status successfully transitioned to ${req.body.status}.`,
        order: transitionResult.order,
        refundClaim: transitionResult.refundClaim || null,
      });
    }

    // 2. Metadata updates (tracking number, notes, etc. without status change)
    const targetTracking = req.body.trackingNumber || req.body.tracking_number || existing.trackingNumber;
    const targetPaymentStatus = req.body.paymentStatus || req.body.payment_status || existing.paymentStatus;

    const updatedPayload = {
      ...existing,
      ...req.body,
      status: existing.status,
      paymentStatus: targetPaymentStatus,
      trackingNumber: targetTracking,
      updated_at: new Date().toISOString(),
    };
    const updated = await saveSqliteOrder(updatedPayload);
    return res.json({ success: true, message: 'Order details updated successfully.', order: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update order';
    return res.status(500).json({ success: false, error: message });
  }
});

router.patch(['/:id', '/:id/'], requireAdmin, async (req: Request, res: Response) => {
  return (router as any).handle(Object.assign(req, { method: 'PUT' }), res);
});

// 5b. Dedicated Workflow Transition Endpoint
router.post(['/:id/transition', '/:id/transition/'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const adminUser = (req as any).user?.email || (req as any).user?.username || 'Admin';
    const targetStatus = req.body.status;

    if (!targetStatus) {
      return res.status(400).json({ success: false, error: 'Target status is required.' });
    }

    const result = await executeOrderTransition(orderId, targetStatus, adminUser, {
      note: req.body.note || req.body.notes,
      transactionCode: req.body.transactionCode || req.body.transaction_code || req.body.paymentReference,
      amount: req.body.amount || req.body.paymentAmount,
      phone: req.body.phone || req.body.mpesaPhone,
      collectedBy: req.body.collectedBy || req.body.collected_by || adminUser,
      cancellationReason: req.body.cancellationReason || req.body.cancellation_reason || req.body.reason,
      trackingNumber: req.body.trackingNumber || req.body.tracking_number,
      courierName: req.body.courierName || req.body.courier_name,
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      message: `Order #${orderId} moved to ${targetStatus}.`,
      order: result.order,
      refundClaim: result.refundClaim || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to transition order status';
    return res.status(500).json({ success: false, error: message });
  }
});

// 5c. Dedicated Cancel Order Endpoint (Customer & Admin)
router.post(['/:id/cancel', '/:id/cancel/'], async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const reason = (req.body.cancellationReason || req.body.cancellation_reason || req.body.reason || req.body.notes || '').trim();

    if (!reason) {
      return res.status(400).json({ success: false, error: 'A cancellation reason is required to cancel this order.' });
    }

    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const isAdmin = Boolean(user && (user.is_staff || user.is_superuser || user.role === 'admin'));

    if (isAdmin) {
      const adminUser = user?.email || user?.username || 'Admin';
      const result = await executeOrderTransition(orderId, 'cancelled', adminUser, {
        cancellationReason: reason,
        note: `Cancelled by admin (${adminUser}): ${reason}`,
      });
      if (!result.success) {
        return res.status(result.statusCode || 400).json({ success: false, error: result.error });
      }
      return res.json({
        success: true,
        message: `Order #${orderId} has been cancelled.`,
        order: result.order,
        refundClaim: result.refundClaim || null,
      });
    }

    // Customer cancellation
    const existing = await getSqliteOrderById(orderId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    const customerEmail = user?.email || req.body.customerEmail || existing.customerEmail;
    const result = await customerCancelOrder(orderId, customerEmail, reason);

    if (!result.success) {
      return res.status(result.statusCode || 400).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      message: `Your order #${orderId} has been cancelled.`,
      order: result.order,
      refundClaim: result.refundClaim || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to cancel order';
    return res.status(500).json({ success: false, error: message });
  }
});

// 5d. Order Lifecycle History Timeline (Database backed)
router.get(['/:id/history', '/:id/history/'], async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const history = await getMysqlOrderStatusHistory(orderId);
    if (history && history.length > 0) {
      return res.json({ success: true, orderId, history });
    }

    // Fallback to order's statusHistory JSON column if table has not populated yet
    const order = await getSqliteOrderById(orderId);
    const fallbackHistory = Array.isArray(order?.statusHistory) ? order.statusHistory : [];
    return res.json({ success: true, orderId, history: fallbackHistory });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch order history';
    return res.status(500).json({ success: false, error: message });
  }
});

// 5e. Valid Next Actions for Order (Context aware for UI)
router.get(['/:id/valid-transitions', '/:id/valid-transitions/'], async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const order = await getSqliteOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    const paymentMethod = normalizePaymentMethod(order.paymentMethod);
    const normalizedStatus = normalizeOrderStatus(order.status, paymentMethod);
    const validNext = getValidNextStatuses(normalizedStatus, paymentMethod);

    return res.json({
      success: true,
      orderId,
      currentStatus: normalizedStatus,
      rawStatus: order.status,
      paymentMethod,
      validNext,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve valid transitions';
    return res.status(500).json({ success: false, error: message });
  }
});

// 5f. Refund Claim Linked to Order
router.get(['/:id/refund-claim', '/:id/refund-claim/'], async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const claim = await getMysqlRefundClaimByOrderId(orderId);
    return res.json({ success: true, orderId, refundClaim: claim || null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve refund claim';
    return res.status(500).json({ success: false, error: message });
  }
});

// 5g. Admin Refund Claims Management List
router.get(['/refunds', '/admin/refunds'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const statusFilter = req.query.status as string | undefined;
    const claims = await getAllMysqlRefundClaims(statusFilter);
    return res.json({ success: true, count: claims.length, refunds: claims });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list refund claims';
    return res.status(500).json({ success: false, error: message });
  }
});

// 5h. Admin Action on Refund Claim (Approve, Pay with M-Pesa ref, Reject)
router.post(['/refunds/:id/action', '/admin/refunds/:id/action'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const claimId = req.params.id;
    const adminUser = (req as any).user?.email || (req as any).user?.username || 'Admin';
    const action = req.body.action as 'approve' | 'reject' | 'pay';

    if (!['approve', 'reject', 'pay'].includes(action)) {
      return res.status(400).json({ success: false, error: "Invalid action. Supported actions: 'approve', 'reject', 'pay'." });
    }

    const result = await processRefundClaimAction(claimId, action, adminUser, {
      refundPaymentReference: req.body.refundPaymentReference || req.body.mpesaReference || req.body.paymentReference,
      rejectionReason: req.body.rejectionReason || req.body.reason,
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      message: `Refund claim #${claimId} action '${action}' completed successfully.`,
      claim: result.claim,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process refund claim action';
    return res.status(500).json({ success: false, error: message });
  }
});

router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const existing = await getSqliteOrderById(orderId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    await deleteSqliteOrder(orderId);
    res.json({ success: true, message: `Order ${orderId} deleted successfully.` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete order';
    res.status(500).json({ success: false, error: message });
  }
});

// 6. Bulk Orders Sync (Admin only)
router.post('/sync', requireAdmin, async (req: Request, res: Response) => {
  try {
    const incomingOrders = Array.isArray(req.body.orders) ? req.body.orders : (Array.isArray(req.body) ? req.body : []);
    await syncSqliteOrders(incomingOrders);
    const allOrders = await getAllSqliteOrders();
    res.json({ success: true, message: 'Orders synced successfully', totalOrders: allOrders.length, orders: allOrders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to sync orders';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
