/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getAllSqliteHeroBanners,
  saveSqliteHeroBanners,
  getSqliteCustomClothingRequests,
  getSqliteCustomClothingRequestById,
  saveSqliteCustomClothingRequest,
  updateSqliteCustomClothingRequestStatus,
  getSqliteWishlist,
  addToSqliteWishlist,
  removeFromSqliteWishlist,
  getSqliteCart,
  saveSqliteCart,
  clearSqliteCart,
} from '../../src/lib/sqlite-db';
import { requireAdmin, getAuthTokenFromRequest, extractUserFromToken } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimit';

const router = Router();

const customClothingRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many custom clothing submissions from your connection. Please wait an hour before submitting again.'
});

// ==========================================
// Hero Banners Endpoints
// ==========================================
router.get(['/', '/hero-banners'], async (req: Request, res: Response) => {
  try {
    const showAll = req.query.all === 'true' || req.query.all === '1';
    let banners = await getAllSqliteHeroBanners();
    if (!showAll) {
      const now = new Date();
      banners = banners.filter((b: any) => {
        const isActive = b.is_active !== undefined ? b.is_active : b.active !== false;
        if (!isActive) return false;
        if (b.start_date) {
          const s = new Date(b.start_date);
          if (!isNaN(s.getTime()) && now < s) return false;
        }
        if (b.end_date) {
          const e = new Date(b.end_date);
          if (!isNaN(e.getTime()) && now > e) return false;
        }
        return true;
      });
    }
    res.json(banners);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch hero banners.';
    res.status(500).json({ success: false, error: message });
  }
});

router.post(['/reorder', '/hero-banners/reorder'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const orderList = req.body?.order || [];
    if (!Array.isArray(orderList)) {
      return res.status(400).json({ success: false, error: 'Order must be an array of IDs.' });
    }
    const current = await getAllSqliteHeroBanners();
    const updated = current.map((b) => {
      const idx = orderList.indexOf(b.id);
      return idx !== -1 ? { ...b, display_order: idx + 1, displayOrder: idx + 1 } : b;
    }).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    await saveSqliteHeroBanners(updated);
    res.json({ success: true, status: 'reordered', total: orderList.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to reorder banners.';
    res.status(500).json({ success: false, error: message });
  }
});

router.post(['/', '/hero-banners'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const banner = req.body || {};
    if (!banner.id) {
      banner.id = `hero-banner-${Date.now()}`;
    }
    const current = await getAllSqliteHeroBanners();
    const existingIndex = current.findIndex(b => b.id === banner.id);
    let updated;
    if (existingIndex !== -1) {
      updated = current.map(b => b.id === banner.id ? { ...b, ...banner, updated_at: new Date().toISOString() } : b);
    } else {
      updated = [...current, { ...banner, created_at: new Date().toISOString() }];
    }
    const saved = await saveSqliteHeroBanners(updated);
    const result = saved.find(b => b.id === banner.id) || banner;
    res.status(201).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save hero banner.';
    res.status(500).json({ success: false, error: message });
  }
});

const handleUpdateHeroBanner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const banner = req.body || {};
    banner.id = id;
    const current = await getAllSqliteHeroBanners();
    const existing = current.find(b => b.id === id);
    let updated;
    if (existing) {
      updated = current.map(b => b.id === id ? { ...b, ...banner, updated_at: new Date().toISOString() } : b);
    } else {
      updated = [...current, banner];
    }
    const saved = await saveSqliteHeroBanners(updated);
    const result = saved.find(b => b.id === id) || banner;
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update hero banner.';
    res.status(500).json({ success: false, error: message });
  }
};

router.put(['/:id', '/hero-banners/:id'], requireAdmin, handleUpdateHeroBanner);
router.patch(['/:id', '/hero-banners/:id'], requireAdmin, handleUpdateHeroBanner);

router.delete(['/:id', '/hero-banners/:id'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const current = await getAllSqliteHeroBanners();
    const updated = current.filter(b => b.id !== id);
    await saveSqliteHeroBanners(updated);
    res.json({ success: true, message: 'Hero banner deleted successfully.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete hero banner.';
    res.status(500).json({ success: false, error: message });
  }
});

// ==========================================
// Custom Clothing Bespoke Services
// ==========================================
router.get('/services/custom-clothing', async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;
    const results = await getSqliteCustomClothingRequests({
      status: typeof status === 'string' ? status : undefined,
      search: typeof search === 'string' ? search : undefined,
    });
    res.json({ success: true, count: results.length, requests: results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch custom clothing requests.';
    res.status(500).json({ success: false, error: message });
  }
});

router.get('/services/custom-clothing/:id', async (req: Request, res: Response) => {
  try {
    const result = await getSqliteCustomClothingRequestById(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Custom clothing request not found.' });
    }
    res.json({ success: true, request: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch custom clothing request.';
    res.status(500).json({ success: false, error: message });
  }
});

router.put('/services/custom-clothing/:id/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.body || {};
    if (!status || typeof status !== 'string') {
      return res.status(400).json({ success: false, error: 'Status is required.' });
    }
    const updated = await updateSqliteCustomClothingRequestStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Custom clothing request not found.' });
    }
    res.json({ success: true, request: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update custom clothing request status.';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/services/custom-clothing', customClothingRateLimiter, async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      email,
      phone,
      garmentType,
      otherGarmentType,
      materialSamples = [],
      designImages = [],
      designVideos = [],
      designLinks = [],
      measurements,
      preferredDeadline,
      budgetRange = '',
      additionalNotes = '',
      deliveryLocation = ''
    } = req.body || {};

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({ success: false, error: 'Full Name is required.' });
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'A valid email address is required.' });
    }

    if (!garmentType || typeof garmentType !== 'string' || !garmentType.trim()) {
      return res.status(400).json({ success: false, error: 'Garment type is required.' });
    }

    const newRequestPayload = {
      id: `req-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      referenceNo: `ROP-CC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: (phone || '').trim(),
      garmentType: garmentType === 'Other' && otherGarmentType ? otherGarmentType.trim() : garmentType.trim(),
      otherGarmentType: otherGarmentType || '',
      materialSamples: Array.isArray(materialSamples) ? materialSamples : [],
      designImages: Array.isArray(designImages) ? designImages : [],
      designVideos: Array.isArray(designVideos) ? designVideos : [],
      designLinks: Array.isArray(designLinks) ? designLinks : [],
      measurements: measurements || {},
      preferredDeadline: preferredDeadline || null,
      budgetRange: (budgetRange || '').trim(),
      additionalNotes: (additionalNotes || '').trim(),
      deliveryLocation: (deliveryLocation || '').trim(),
      status: 'Pending Review',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await saveSqliteCustomClothingRequest(newRequestPayload);
    res.status(201).json({ success: true, message: 'Custom clothing request submitted successfully.', request: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit custom clothing request.';
    res.status(500).json({ success: false, error: message });
  }
});

// ==========================================
// Wishlist Endpoints (Persisted in SQLite)
// ==========================================
router.get('/wishlist', async (req: Request, res: Response) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const key = user?.id || (req.query.userId || req.query.sessionId || 'default') as string;

    const items = await getSqliteWishlist(String(key));
    res.json(items);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve wishlist';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/wishlist', async (req: Request, res: Response) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const key = user?.id || (req.body.userId || req.body.sessionId || 'default') as string;
    const { product_id } = req.body || {};

    const updated = await addToSqliteWishlist(String(key), String(product_id || ''));
    res.json({ success: true, product_ids: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to add item to wishlist';
    res.status(500).json({ success: false, error: message });
  }
});

router.delete('/wishlist/:id', async (req: Request, res: Response) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const key = user?.id || (req.query.userId || req.body?.userId || 'default') as string;
    const { id } = req.params;

    const updated = await removeFromSqliteWishlist(String(key), String(id));
    res.json({ success: true, product_ids: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to remove item from wishlist';
    res.status(500).json({ success: false, error: message });
  }
});

// ==========================================
// Shopping Cart Endpoints (Persisted in SQLite)
// ==========================================
router.get('/cart', async (req: Request, res: Response) => {
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

router.post('/cart', async (req: Request, res: Response) => {
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

router.post('/cart/sync', async (req: Request, res: Response) => {
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

router.delete('/cart', async (req: Request, res: Response) => {
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
