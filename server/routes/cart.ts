/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateCart } from '../services/cartValidation';
import { cartStreamManager } from '../services/cartStream';
import { getAuthTokenFromRequest, extractUserFromToken } from '../middleware/auth';
import {
  getSqliteCart,
  saveSqliteCart,
  clearSqliteCart,
} from '../../src/lib/sqlite-db';

const router = Router();

// Validation schema for incoming cart validation requests
const CartValidateSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().or(z.number()),
      variantId: z.string().optional(),
      selectedVariations: z.record(z.string(), z.any()).optional(),
      quantity: z.number().optional().default(1),
      clientPrice: z.number().optional(),
      price: z.number().optional(),
      name: z.string().optional(),
    }).passthrough()
  ).optional().default([]),
  couponCode: z.string().optional(),
  clientTotal: z.number().optional(),
});

// ==========================================
// 1. Single-Batch Server Cart Validation Endpoint
// ==========================================
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const parseResult = CartValidateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid cart payload format.',
        details: parseResult.error.format(),
      });
    }

    const { items, couponCode, clientTotal } = parseResult.data;

    const validation = await validateCart(
      items.map(item => ({
        productId: String(item.productId),
        variantId: item.variantId,
        selectedVariations: item.selectedVariations,
        quantity: item.quantity,
        clientPrice: item.clientPrice ?? item.price,
        name: item.name,
      })),
      couponCode,
      clientTotal
    );

    res.json({
      success: true,
      valid: validation.valid,
      items: validation.items,
      outOfStockItems: validation.outOfStockItems,
      subtotal: validation.subtotal,
      discountAmount: validation.discountAmount,
      total: validation.total,
      couponCode: validation.couponCode,
      isCouponValid: validation.isCouponValid,
      couponDiscountPercent: validation.couponDiscountPercent,
      changes: validation.changes,
      validatedAt: validation.validatedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Cart validation failed.';
    res.status(500).json({ success: false, error: message });
  }
});

// ==========================================
// 2. Real-Time Push SSE Stream Endpoint
// ==========================================
router.get('/stream', (req: Request, res: Response) => {
  const rawProductIds = (req.query.productIds as string) || '';
  const initialProductIds = rawProductIds.split(',').map(s => s.trim()).filter(Boolean);

  cartStreamManager.addClient(req, res, initialProductIds);
});

// Update SSE subscriptions on the fly
router.post('/stream/subscribe', (req: Request, res: Response) => {
  const { clientId, productIds } = req.body || {};
  if (!clientId || !Array.isArray(productIds)) {
    return res.status(400).json({ success: false, error: 'clientId and productIds array are required.' });
  }

  const updated = cartStreamManager.updateSubscriptions(clientId, productIds);
  res.json({ success: updated, subscribedCount: productIds.length });
});

// ==========================================
// 3. Persistent Cart Storage Endpoints (SQLite Backed)
// ==========================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const cartKey = user?.id || (req.query.userId || req.query.sessionId || 'guest_default') as string;

    const items = await getSqliteCart(String(cartKey));
    res.json({ success: true, items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch cart';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const cartKey = user?.id || (req.body.userId || req.body.sessionId || req.query.userId || 'guest_default') as string;
    const items = Array.isArray(req.body.items) ? req.body.items : (Array.isArray(req.body) ? req.body : []);

    const saved = await saveSqliteCart(String(cartKey), items);
    res.json({ success: true, message: 'Cart updated successfully', items: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save cart';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/sync', async (req: Request, res: Response) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const cartKey = user?.id || (req.body.userId || req.body.sessionId || 'guest_default') as string;
    const items = Array.isArray(req.body.items) ? req.body.items : (Array.isArray(req.body.cart) ? req.body.cart : []);

    const saved = await saveSqliteCart(String(cartKey), items);
    res.json({ success: true, message: 'Cart synchronized with backend database', items: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to sync cart';
    res.status(500).json({ success: false, error: message });
  }
});

router.delete('/', async (req: Request, res: Response) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const cartKey = user?.id || (req.query.userId || req.body?.userId || 'guest_default') as string;

    await clearSqliteCart(String(cartKey));
    res.json({ success: true, message: 'Cart cleared successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to clear cart';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
