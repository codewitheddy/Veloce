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
} from '../../src/lib/sqlite-db';
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

// 1. Public Order Tracking
router.get('/track/:orderId', trackingRateLimiter, async (req: Request, res: Response) => {
  const { orderId } = req.params;
  try {
    const order = await fetchAuthoritativeOrderById(orderId) || await getSqliteOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    const trackingNumber = order.trackingNumber || `ROP-TRK-${String(order.id).slice(-6).toUpperCase()}`;
    return res.json({
      success: true,
      id: order.id,
      orderId: order.id,
      customerName: order.customerName,
      customerEmail: order.customerEmail || '',
      phone: order.phone || order.mpesaPhone || '',
      status: order.status,
      paymentStatus: order.paymentStatus,
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
      items: Array.isArray(order.items)
        ? order.items
        : typeof order.items === 'string'
        ? (() => { try { return JSON.parse(order.items); } catch { return []; } })()
        : [],
      date: order.date || order.createdAt || new Date().toISOString(),
      isGuest: Boolean(order.isGuest),
      checkpoints: [
        { status: 'Order Placed', timestamp: order.createdAt || order.date || new Date().toISOString(), completed: true },
        { status: 'Payment Verified', timestamp: order.paymentConfirmedAt || null, completed: order.paymentStatus === 'paid' },
        { status: 'Fulfillment & Packaging', timestamp: null, completed: ['processing', 'shipped', 'delivered'].includes(order.status) },
        { status: 'Dispatched with Courier', timestamp: null, completed: ['shipped', 'delivered'].includes(order.status) },
        { status: 'Delivered', timestamp: null, completed: order.status === 'delivered' }
      ]
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

    if (user.is_staff || user.is_superuser || user.role === 'admin') {
      const allOrders = await getAllSqliteOrders();
      return res.json(allOrders);
    }

    const userOrders = await getSqliteOrdersByUser(user.email, user.id);
    return res.json(userOrders);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve orders';
    return res.status(500).json({ success: false, error: message });
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

    return res.json(order);
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
    const customerEmail = (orderData.customerEmail || orderData.customer_email || user?.email || '').trim().toLowerCase();
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

    // 1. If confirming payment directly
    if (req.body.confirmPayment === true || req.body.paymentStatus === 'paid' || req.body.payment_status === 'paid' || req.body.isPaid === true) {
      const payResult = await confirmOrderPaymentAndProcess(orderId, adminUser, {
        paymentReference: req.body.paymentReference || req.body.payment_reference,
        paymentAmount: req.body.paymentAmount || req.body.amount,
        adminNotes: req.body.adminNotes || req.body.notes,
      });

      if (!payResult.success) {
        return res.status(400).json({ success: false, error: payResult.error });
      }

      return res.json({
        success: true,
        message: `Order #${orderId} payment confirmed. Status automatically updated to Processing and customer notified.`,
        order: payResult.order,
      });
    }

    // 2. If confirming delivery directly
    if (req.body.confirmDelivery === true || req.body.isDeliveryConfirmed === true) {
      const delivResult = await confirmOrderDelivery(orderId, adminUser, {
        deliveryPerson: req.body.deliveryPerson || req.body.courier_name,
        deliveryNote: req.body.deliveryNote || req.body.notes,
        deliveredAt: req.body.deliveredAt,
      });

      if (!delivResult.success) {
        return res.status(delivResult.statusCode || 400).json({ success: false, error: delivResult.error });
      }

      return res.json({
        success: true,
        message: `Delivery confirmed for order #${orderId}. Ready for completion.`,
        order: delivResult.order,
      });
    }

    // 3. If transitioning status
    if (req.body.status && req.body.status !== existing.status) {
      const isDelivConf = Boolean(req.body.isDeliveryConfirmed || req.body.deliveryConfirmed || existing.deliveryConfirmed || req.body.status === 'completed');
      const transitionResult = await transitionOrderStatus(orderId, req.body.status, adminUser, {
        trackingNumber: req.body.trackingNumber || req.body.tracking_number,
        courierName: req.body.courierName || req.body.courier_name,
        deliveryPerson: req.body.deliveryPerson,
        deliveryNote: req.body.deliveryNote,
        isDeliveryConfirmed: isDelivConf,
        note: req.body.notes || req.body.note,
      });

      if (!transitionResult.success) {
        return res.status(transitionResult.statusCode || 400).json({
          success: false,
          error: transitionResult.error,
        });
      }

      return res.json({
        success: true,
        message: `Order #${orderId} status successfully updated to ${req.body.status}. Customer notification enqueued.`,
        order: transitionResult.order,
      });
    }

    // 4. Metadata updates (tracking number, notes, etc. without status change)
    const updated = await updateSqliteOrderStatus(orderId, req.body);
    return res.json({ success: true, message: 'Order details updated successfully.', order: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update order';
    return res.status(500).json({ success: false, error: message });
  }
});

router.patch(['/:id', '/:id/'], requireAdmin, async (req: Request, res: Response) => {
  // Delegate patch to put handler for maximum frontend compatibility
  return (router as any).handle(Object.assign(req, { method: 'PUT' }), res);
});

// 5b. Dedicated Endpoint: Confirm Payment (Admin only)
router.post(['/:id/confirm-payment', '/:id/confirm-payment/'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const adminUser = (req as any).user?.email || (req as any).user?.username || 'Admin';
    const result = await confirmOrderPaymentAndProcess(orderId, adminUser, req.body);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      message: `Payment confirmed for order #${orderId}. Order is now Processing. Customer notified.`,
      order: result.order,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to confirm payment';
    return res.status(500).json({ success: false, error: message });
  }
});

// 5c. Dedicated Endpoint: Confirm Delivery (Admin only)
router.post(['/:id/confirm-delivery', '/:id/confirm-delivery/'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const adminUser = (req as any).user?.email || (req as any).user?.username || 'Admin';
    const result = await confirmOrderDelivery(orderId, adminUser, req.body);

    if (!result.success) {
      return res.status(result.statusCode || 400).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      message: `Delivery confirmed for order #${orderId} by ${req.body.deliveryPerson || 'Courier'}.`,
      order: result.order,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to confirm delivery';
    return res.status(500).json({ success: false, error: message });
  }
});

// 5d. Dedicated Endpoint: Transition Status (Admin only)
router.post(['/:id/transition-status', '/:id/transition-status/'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const adminUser = (req as any).user?.email || (req as any).user?.username || 'Admin';
    const result = await transitionOrderStatus(orderId, req.body.status, adminUser, req.body);

    if (!result.success) {
      return res.status(result.statusCode || 400).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      message: `Order #${orderId} moved to ${req.body.status}.`,
      order: result.order,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to transition order status';
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
