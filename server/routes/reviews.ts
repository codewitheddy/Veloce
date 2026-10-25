/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Product Reviews Domain API Routes (MySQL Authoritative)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getMysqlReviewsByProduct,
  checkMysqlReviewEligibility,
  createMysqlReview,
  updateMysqlReview,
  deleteMysqlReview,
  adminUpdateMysqlReviewStatus,
  getMysqlAllReviewsForAdmin,
} from '../../src/lib/mysql-db';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Rate limiter: Max 15 review submissions / updates per hour per IP/user
const reviewRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 15,
  message: 'Review rate limit exceeded. Please try again later.',
});

// Validation Schemas
const CreateReviewSchema = z.object({
  orderItemId: z.string().min(1, 'Order Item ID is required.'),
  rating: z.number().int().min(1, 'Rating must be between 1 and 5.').max(5, 'Rating must be between 1 and 5.'),
  title: z.string().max(120, 'Title cannot exceed 120 characters.').optional(),
  body: z.string().min(10, 'Review must be at least 10 characters long.').max(2000, 'Review cannot exceed 2000 characters.'),
});

const UpdateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().max(120).optional(),
  body: z.string().min(10).max(2000).optional(),
});

const AdminStatusSchema = z.object({
  status: z.enum(['published', 'hidden']),
});

// ============================================================================
// 1. Public: Fetch Reviews for a Product
// ============================================================================
router.get(['/product/:productId', '/:productId/reviews', '/:productId/reviews/'], async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { rating, sort } = req.query;

    const result = await getMysqlReviewsByProduct(productId, {
      rating: rating ? Number(rating) : undefined,
      sort: typeof sort === 'string' ? sort : undefined,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve reviews';
    res.status(500).json({ success: false, error: message });
  }
});

// ============================================================================
// 2. Authenticated: Check Customer Eligibility for an Order Item
// ============================================================================
router.get(['/eligibility/:orderItemId', '/order-item/:orderItemId/eligibility'], requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { orderItemId } = req.params;

    const result = await checkMysqlReviewEligibility(
      { id: user.id, email: user.email },
      orderItemId
    );

    res.json({
      success: true,
      item: (result as any).orderItem,
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to verify review eligibility';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/check-eligibility', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const orderItemId = req.body?.orderItemId;
    if (!orderItemId) {
      return res.status(400).json({ success: false, error: 'orderItemId is required' });
    }

    const result = await checkMysqlReviewEligibility(
      { id: user.id, email: user.email },
      orderItemId
    );

    res.json({
      success: true,
      item: (result as any).orderItem,
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to verify review eligibility';
    res.status(500).json({ success: false, error: message });
  }
});

// ============================================================================
// 3. Authenticated: Submit Verified Review (Owner Only, Rate Limited)
// ============================================================================
router.post('/', requireAuth, reviewRateLimiter, validateBody(CreateReviewSchema), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { orderItemId, rating, title, body } = req.body;

    const review = await createMysqlReview({
      userId: user.id,
      userEmail: user.email,
      orderItemId,
      rating,
      title,
      body,
    });

    res.status(201).json({
      success: true,
      message: 'Review published successfully!',
      review,
    });
  } catch (err: any) {
    const statusCode = err.status || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to submit review',
      code: err.code || 'REVIEW_SUBMISSION_FAILED',
    });
  }
});

// ============================================================================
// 4. Authenticated: Edit Review (Owner or Admin Only, Rate Limited)
// ============================================================================
router.put('/:id', requireAuth, reviewRateLimiter, validateBody(UpdateReviewSchema), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { rating, title, body } = req.body;

    const isAdmin = Boolean(user.is_superuser || user.is_staff || user.role === 'admin');
    const updated = await updateMysqlReview(
      id,
      user.id,
      { rating, title, body },
      isAdmin
    );

    res.json({
      success: true,
      message: 'Review updated successfully.',
      review: updated,
    });
  } catch (err: any) {
    const statusCode = err.status || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to update review',
    });
  }
});

// ============================================================================
// 5. Authenticated: Delete Review (Owner or Admin Only)
// ============================================================================
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const isAdmin = Boolean(user.is_superuser || user.is_staff || user.role === 'admin');
    const result = await deleteMysqlReview(id, user.id, isAdmin);

    res.json({
      success: true,
      message: 'Review removed successfully.',
      ...result,
    });
  } catch (err: any) {
    const statusCode = err.status || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to delete review',
    });
  }
});

// ============================================================================
// 6. Admin: List All Reviews with Moderation Info
// ============================================================================
router.get('/admin/list', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, limit, offset } = req.query;
    const result = await getMysqlAllReviewsForAdmin({
      status: typeof status === 'string' ? status : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch reviews list';
    res.status(500).json({ success: false, error: message });
  }
});

// ============================================================================
// 7. Admin: Toggle Review Status (Published / Hidden)
// ============================================================================
router.put('/admin/:id/status', requireAdmin, validateBody(AdminStatusSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await adminUpdateMysqlReviewStatus(id, status);

    res.json({
      success: true,
      message: `Review status changed to '${status}'.`,
      ...result,
    });
  } catch (err: any) {
    const statusCode = err.status || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to update review status',
    });
  }
});

export default router;
