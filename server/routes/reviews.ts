/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getSqliteReviewsByProduct,
  getAllSqliteReviews,
  saveSqliteReview,
  updateSqliteReview,
  deleteSqliteReview,
  toggleSqliteReviewHelpful,
  updateSqliteReviewStatus,
  getSqliteOrdersByUser,
  recomputeSqliteProductRating,
  getSqliteReviewRequestLogs,
  getSqliteReviewRequestSettings,
  saveSqliteReviewRequestSettings,
  addSqliteReviewOptOut,
  getSqliteReviewOptOutsCount,
} from '../../src/lib/sqlite-db';
import { requireAuth, requireAdmin, getAuthTokenFromRequest, extractUserFromToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createRateLimiter } from '../middleware/rateLimit';

const router = Router();

export interface ReviewRecord {
  id: string;
  productId: string;
  orderId?: string;
  userId?: string | null;
  userEmail: string;
  userName: string;
  reviewerDisplayName: string;
  rating: number;
  title: string;
  comment: string;
  mediaUrls: string[];
  verifiedPurchase: boolean;
  status: 'Published' | 'Pending' | 'Hidden' | 'Removed';
  date: string;
  createdAt: string;
  updatedAt?: string;
  helpfulVotes: number;
  helpfulUserIds: string[];
  purchasedVariant?: string;
  isEdited: boolean;
}

const reviewSubmissionRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Rate limit exceeded. Maximum 10 review submissions per hour allowed.'
});

const CreateReviewSchema = z.object({
  productId: z.string().min(1, 'Product ID is required.'),
  rating: z.number().min(1).max(5),
  title: z.string().optional(),
  comment: z.string().min(10, 'Review statement must be at least 10 characters long.').max(2000),
  orderId: z.string().optional(),
  mediaUrls: z.array(z.string()).max(5).optional(),
  reviewerDisplayName: z.string().optional(),
  purchasedVariant: z.string().optional(),
  userEmail: z.string().optional(),
  userId: z.union([z.string(), z.number()]).optional(),
  userName: z.string().optional(),
});

// 1. Fetch Reviews for a Product (Public)
router.get(['/product/:productId', '/:productId/reviews', '/:productId/reviews/'], async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { rating, sort } = req.query;

    const result = await getSqliteReviewsByProduct(productId, {
      rating: rating ? Number(rating) : undefined,
      sort: typeof sort === 'string' ? sort : undefined,
    });

    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve reviews';
    res.status(500).json({ success: false, error: message });
  }
});

// 2. Check Customer Eligibility to Review a Product
router.post(['/check-eligibility', '/check-eligibility/'], async (req: Request, res: Response) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const tokenUser = token ? await extractUserFromToken(token) : null;
    const { userEmail: bodyEmail, userId: bodyUserId, productId, sku } = req.body || {};

    const userEmail = (tokenUser?.email || bodyEmail || '').trim().toLowerCase();
    const userId = tokenUser?.id || bodyUserId || undefined;

    if (!userEmail && !userId) {
      return res.json({
        eligible: false,
        reason: 'NOT_LOGGED_IN',
        message: 'Please log in to your customer account to leave a verified review.',
      });
    }

    if (!productId) {
      return res.status(400).json({
        eligible: false,
        reason: 'NOT_PURCHASED',
        message: 'Product ID is required to verify purchase.',
      });
    }

    const orders = await getSqliteOrdersByUser(userEmail, userId ? String(userId) : undefined);
    const normalizedProdId = String(productId).trim().toLowerCase();
    const normalizedSku = sku ? String(sku).trim().toLowerCase() : '';

    let matchingOrder: any = null;
    let purchasedVariant: string | undefined = undefined;

    for (const order of orders) {
      const status = String(order.status || '').toLowerCase();
      if (status === 'cancelled' || status === 'canceled' || status === 'refunded') {
        continue;
      }

      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const itemId = String(item.id || item.productId || '').trim().toLowerCase();
        const itemSku = String(item.sku || item.product_sku || '').trim().toLowerCase();
        if (
          (normalizedProdId && itemId === normalizedProdId) ||
          (normalizedSku && itemSku === normalizedSku) ||
          (normalizedProdId && itemSku === normalizedProdId)
        ) {
          matchingOrder = order;
          purchasedVariant = item.selectedVariant || item.selectedVariations
            ? (typeof item.selectedVariations === 'object' ? Object.values(item.selectedVariations).join(' / ') : String(item.selectedVariations))
            : undefined;
          break;
        }
      }
      if (matchingOrder) break;
    }

    if (!matchingOrder) {
      return res.json({
        eligible: false,
        reason: 'NOT_PURCHASED',
        message: 'Only verified customers who have bought this product can leave a review.',
      });
    }

    // Check if user already submitted a review
    const { reviews: existingReviews } = await getSqliteReviewsByProduct(productId);
    const existing = existingReviews.find((r: any) =>
      (userEmail && r.userEmail && r.userEmail.toLowerCase() === userEmail) ||
      (userId && r.userId && String(r.userId) === String(userId))
    );

    if (existing) {
      return res.json({
        eligible: false,
        reason: 'ALREADY_REVIEWED',
        message: 'You have already submitted a review for this product.',
        existingReview: existing,
        orderId: matchingOrder.id,
        purchasedVariant,
      });
    }

    return res.json({
      eligible: true,
      reason: 'ELIGIBLE',
      message: 'Verified Purchaser: You are eligible to review this product.',
      orderId: matchingOrder.id,
      purchasedVariant,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to verify purchase eligibility';
    return res.status(500).json({ eligible: false, reason: 'NOT_PURCHASED', message });
  }
});

// 3. Submit Review (Verified Customers Only)
router.post('/', reviewSubmissionRateLimiter, validateBody(CreateReviewSchema), async (req: Request, res: Response) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const tokenUser = token ? await extractUserFromToken(token) : null;
    const {
      productId,
      rating,
      title,
      comment,
      mediaUrls,
      orderId,
      reviewerDisplayName,
      purchasedVariant,
      userEmail: bodyEmail,
      userId: bodyUserId,
      userName: bodyUserName,
    } = req.body;

    const userEmail = (tokenUser?.email || bodyEmail || '').trim().toLowerCase();
    const userId = tokenUser?.id || bodyUserId || undefined;
    const userName = tokenUser
      ? `${tokenUser.first_name || ''} ${tokenUser.last_name || ''}`.trim() || tokenUser.username
      : (bodyUserName || 'Verified Customer');

    if (!userEmail && !userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please log in to post a review.',
      });
    }

    // Verify customer actually ordered the product
    const orders = await getSqliteOrdersByUser(userEmail, userId ? String(userId) : undefined);
    const normalizedProdId = String(productId).trim().toLowerCase();

    let matchingOrder: any = null;
    for (const order of orders) {
      const status = String(order.status || '').toLowerCase();
      if (status === 'cancelled' || status === 'canceled' || status === 'refunded') continue;

      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const itemId = String(item.id || item.productId || '').trim().toLowerCase();
        const itemSku = String(item.sku || item.product_sku || '').trim().toLowerCase();
        if (itemId === normalizedProdId || itemSku === normalizedProdId) {
          matchingOrder = order;
          break;
        }
      }
      if (matchingOrder) break;
    }

    if (!matchingOrder && !orderId) {
      return res.status(403).json({
        success: false,
        error: 'Review submission denied: Only verified customers who purchased this product can leave a review.',
      });
    }

    const newReview = {
      id: `rev-${Date.now()}`,
      productId: String(productId).trim(),
      orderId: matchingOrder ? matchingOrder.id : (orderId || undefined),
      userId: userId ? String(userId) : null,
      userEmail,
      userName,
      reviewerDisplayName: reviewerDisplayName || userName,
      rating: Number(rating),
      title: title ? String(title).trim() : '',
      comment: String(comment).trim(),
      mediaUrls: Array.isArray(mediaUrls) ? mediaUrls.slice(0, 5) : [],
      verifiedPurchase: true,
      status: 'Published',
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      helpfulVotes: 0,
      helpfulUserIds: [],
      purchasedVariant: purchasedVariant || undefined,
      isEdited: false,
    };

    const saved = await saveSqliteReview(newReview);
    await recomputeSqliteProductRating(productId);

    res.status(201).json({
      success: true,
      message: 'Verified customer review published successfully!',
      review: saved,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit review';
    res.status(500).json({ success: false, error: message });
  }
});

// 3. Update Existing Review (Authenticated Owner)
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const { rating, title, comment, mediaUrls, reviewerDisplayName } = req.body || {};

    const all = await getAllSqliteReviews();
    const existing = all.find((r) => r.id === id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Review not found.' });
    }

    // Ownership verification
    if (!user.is_superuser && !user.is_staff && existing.userEmail.toLowerCase() !== user.email.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Forbidden: You can only edit your own reviews.' });
    }

    const updated = await updateSqliteReview(id, {
      rating: rating ? Number(rating) : existing.rating,
      title: title !== undefined ? String(title).trim() : existing.title,
      comment: comment !== undefined ? String(comment).trim() : existing.comment,
      mediaUrls: Array.isArray(mediaUrls) ? mediaUrls.slice(0, 5) : existing.mediaUrls,
      reviewerDisplayName: reviewerDisplayName || existing.reviewerDisplayName,
    });

    res.json({
      success: true,
      message: 'Review updated successfully.',
      review: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update review';
    res.status(500).json({ success: false, error: message });
  }
});

// 4. Delete Review (Authenticated Owner or Admin)
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const all = await getAllSqliteReviews();
    const existing = all.find((r) => r.id === id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Review not found.' });
    }

    if (!user.is_superuser && !user.is_staff && existing.userEmail.toLowerCase() !== user.email.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Forbidden: You can only delete your own reviews.' });
    }

    await deleteSqliteReview(id);
    res.json({ success: true, message: 'Review removed successfully.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete review';
    res.status(500).json({ success: false, error: message });
  }
});

// 5. Helpful Vote Toggle
router.post('/:id/helpful', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const token = getAuthTokenFromRequest(req);
    const voterId = token ? `user-${token.slice(0, 10)}` : String(req.ip || 'ip');

    const result = await toggleSqliteReviewHelpful(id, voterId);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Review not found.' });
    }

    res.json({
      success: true,
      helpfulVotes: result.helpfulVotes,
      voted: result.voted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to register vote';
    res.status(500).json({ success: false, error: message });
  }
});

// 6. Admin Review Moderation Endpoints
router.get('/admin/list', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const reviews = await getAllSqliteReviews();
    res.json({ success: true, reviews });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch reviews list';
    res.status(500).json({ success: false, error: message });
  }
});

router.put('/admin/:id/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await updateSqliteReviewStatus(id, status);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Review not found.' });
    }

    res.json({
      success: true,
      message: `Review status updated to '${status}'.`,
      review: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update review status';
    res.status(500).json({ success: false, error: message });
  }
});

// 7. Review Request Automation & Funnel Tracking
router.get(['/admin/requests/logs', '/admin/review-requests/logs', '/requests/logs'], requireAdmin, async (_req: Request, res: Response) => {
  try {
    const logs = await getSqliteReviewRequestLogs();
    const settings = await getSqliteReviewRequestSettings();
    const optOutsCount = await getSqliteReviewOptOutsCount();

    const totalRequestsSent = logs.length;
    const totalReviewed = logs.filter((l: any) => l.status === 'reviewed').length;
    const conversionRatePercent = totalRequestsSent > 0 ? Math.round((totalReviewed / totalRequestsSent) * 1000) / 10 : 0;

    res.json({
      success: true,
      logs,
      settings,
      optOutsCount,
      funnel: {
        totalRequestsSent,
        totalReviewed,
        conversionRatePercent,
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch review request logs';
    res.status(500).json({ success: false, error: message });
  }
});

router.get(['/admin/requests/settings', '/admin/review-requests/settings', '/requests/settings'], requireAdmin, async (_req: Request, res: Response) => {
  try {
    const settings = await getSqliteReviewRequestSettings();
    res.json({ success: true, settings });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch review settings';
    res.status(500).json({ success: false, error: message });
  }
});

router.put(['/admin/requests/settings', '/admin/review-requests/settings', '/requests/settings'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const { enabled, delayDays, autoTriggerOnDelivery, incentiveDiscountPercent } = req.body || {};
    if (delayDays !== undefined && (Number(delayDays) < 0 || Number(delayDays) > 30)) {
      return res.status(400).json({ success: false, error: 'Delay days must be between 0 and 30 days.' });
    }

    const updated = await saveSqliteReviewRequestSettings({
      enabled: enabled !== undefined ? Boolean(enabled) : undefined,
      delayDays: delayDays !== undefined ? Number(delayDays) : undefined,
      autoTriggerOnDelivery: autoTriggerOnDelivery !== undefined ? Boolean(autoTriggerOnDelivery) : undefined,
      incentiveDiscountPercent: incentiveDiscountPercent !== undefined ? Number(incentiveDiscountPercent) : undefined,
    });

    res.json({ success: true, settings: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update review settings';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/requests/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { email } = req.body || {};
    if (!email || !String(email).includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email address is required to unsubscribe.' });
    }
    await addSqliteReviewOptOut(String(email));
    res.json({
      success: true,
      message: 'You have been unsubscribed from post-delivery review request emails.'
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process unsubscribe';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
