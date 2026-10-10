/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import {
  getAllSqliteCategories,
  saveSqliteCategories,
  saveMysqlCategory,
  deleteSqliteCategory,
  deleteSqliteCategoriesBulk,
} from '../../src/lib/mysql-db';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// 1. GET all categories
router.get(['/', '', '/categories', '/categories/'], async (_req: Request, res: Response) => {
  try {
    const cats = await getAllSqliteCategories();
    res.json(cats);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch categories.';
    res.status(500).json({ success: false, error: message });
  }
});

// 2. GET category by ID or slug
router.get(['/:id', '/:id/'], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cats = await getAllSqliteCategories();
    const cat = cats.find(c => String(c.id) === String(id) || String(c.slug) === String(id));
    if (!cat) {
      return res.status(404).json({ success: false, error: `Category '${id}' not found.` });
    }
    res.json(cat);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch category.';
    res.status(500).json({ success: false, error: message });
  }
});

// 3. POST Bulk Sync
router.post(['/bulk_sync', '/bulk_sync/'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const categoriesData = req.body;
    if (!Array.isArray(categoriesData)) {
      return res.status(400).json({ success: false, error: 'Expected an array of categories.' });
    }
    await saveSqliteCategories(categoriesData);
    const fresh = await getAllSqliteCategories();
    res.json({ success: true, message: `Synchronized ${fresh.length} categories successfully.`, categories: fresh });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to sync categories.';
    res.status(500).json({ success: false, error: message });
  }
});

// 4. POST Bulk Action
router.post(['/bulk_action', '/bulk_action/'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const { category_ids, ids, action, status: newStatus } = req.body || {};
    const catIds: string[] = (Array.isArray(category_ids) ? category_ids : Array.isArray(ids) ? ids : []).map(id => String(id));

    if (catIds.length === 0) {
      return res.status(400).json({ success: false, error: 'category_ids array is required.' });
    }

    const currentCats = await getAllSqliteCategories();
    let affectedCount = 0;

    if (action === 'delete') {
      await deleteSqliteCategoriesBulk(catIds);
      affectedCount = catIds.length;
    } else if (action === 'status_active' || (action === 'update_status' && newStatus === 'Active')) {
      for (const id of catIds) {
        const c = currentCats.find(item => String(item.id) === String(id));
        if (c) await saveMysqlCategory({ ...c, is_active: 1, status: 'Active' });
      }
      affectedCount = catIds.length;
    } else if (action === 'status_inactive' || (action === 'update_status' && newStatus === 'Inactive')) {
      for (const id of catIds) {
        const c = currentCats.find(item => String(item.id) === String(id));
        if (c) await saveMysqlCategory({ ...c, is_active: 0, status: 'Inactive' });
      }
      affectedCount = catIds.length;
    }

    const updated = await getAllSqliteCategories();
    res.json({
      success: true,
      message: `Category bulk action '${action}' completed successfully for ${affectedCount} categories.`,
      affected_count: affectedCount,
      categories: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to execute category bulk action.';
    res.status(500).json({ success: false, error: message });
  }
});

// 5. POST Create Category
router.post(['/', ''], requireAdmin, async (req: Request, res: Response) => {
  try {
    const cat = req.body || {};
    if (!cat.id) {
      cat.id = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    }
    if (!cat.slug && cat.name) {
      cat.slug = String(cat.name).toLowerCase().replace(/\s+/g, '-');
    }
    const createdCat = await saveMysqlCategory(cat);
    res.status(201).json({ success: true, message: 'Category created successfully.', category: createdCat });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create category.';
    res.status(500).json({ success: false, error: message });
  }
});

// 6. PUT Update Category
router.put(['/:id', '/:id/'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cat = req.body || {};
    cat.id = id;
    const updatedCat = await saveMysqlCategory(cat);
    res.json({ success: true, message: 'Category updated successfully.', category: updatedCat });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update category.';
    res.status(500).json({ success: false, error: message });
  }
});

// 7. DELETE Category
router.delete(['/:id', '/:id/'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deleteSqliteCategory(id);
    res.json({ success: true, message: 'Category deleted successfully.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete category.';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
