/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getAllSqliteCategories,
  saveSqliteCategories,
  pullSyncDataSqlite,
  pushSyncDataSqlite,
  getSqliteDb,
  saveSqliteDb,
  getSqliteInventoryAuditLogs,
  addSqliteInventoryAuditLog,
  getSqliteReviewsByProduct,
  deleteSqliteProduct,
  deleteSqliteProductsBulk,
  deleteSqliteCategory,
  deleteSqliteCategoriesBulk,
  updateSqliteCategoriesBulk,
  getMysqlProducts,
  saveMysqlProduct,
} from '../../src/lib/mysql-db';
import { requireAdmin } from '../middleware/auth';
import { cartStreamManager } from '../services/cartStream';

const router = Router();

// In-Memory cache for low-latency storefront queries, synchronized with MySQL
let productsCache: any[] = [];
let isCacheLoaded = false;

export async function loadProductsCache(force: boolean = false): Promise<any[]> {
  if (isCacheLoaded && !force && productsCache.length > 0) {
    return productsCache;
  }
  try {
    const products = await getMysqlProducts();
    if (products && Array.isArray(products) && products.length > 0) {
      productsCache = products;
      isCacheLoaded = true;
    }
  } catch (err) {
    console.warn('[Products Router] Error loading products from MySQL:', err);
  }
  return productsCache;
}

export async function persistProductsCache(): Promise<void> {
  try {
    for (const p of productsCache) {
      if (p.id) {
        await saveMysqlProduct(p);
      }
    }
  } catch (err) {
    console.error('[Products Router] Failed to persist products cache:', err);
  }
}

export function normalizeProductVariants(p: any): any {
  if (!p) return p;
  const opts = Array.isArray(p.options)
    ? p.options
    : typeof p.options === 'string' && p.options.trim().startsWith('[')
    ? (() => { try { return JSON.parse(p.options); } catch { return []; } })()
    : [];
  const matrix = Array.isArray(p.variantMatrix || p.variant_matrix)
    ? p.variantMatrix || p.variant_matrix
    : typeof (p.variantMatrix || p.variant_matrix) === 'string' && (p.variantMatrix || p.variant_matrix).trim().startsWith('[')
    ? (() => { try { return JSON.parse(p.variantMatrix || p.variant_matrix); } catch { return []; } })()
    : [];
  const vars = Array.isArray(p.variants)
    ? p.variants
    : typeof p.variants === 'string' && p.variants.trim().startsWith('[')
    ? (() => { try { return JSON.parse(p.variants); } catch { return []; } })()
    : [];
  const variations = Array.isArray(p.variations)
    ? p.variations
    : typeof p.variations === 'string' && p.variations.trim().startsWith('[')
    ? (() => { try { return JSON.parse(p.variations); } catch { return []; } })()
    : [];
  const colorImgs = (p.colorImages || p.color_images) && typeof (p.colorImages || p.color_images) === 'object'
    ? p.colorImages || p.color_images
    : typeof (p.colorImages || p.color_images) === 'string' && (p.colorImages || p.color_images).trim().startsWith('{')
    ? (() => { try { return JSON.parse(p.colorImages || p.color_images); } catch { return {}; } })()
    : {};

  const hasVar = Boolean(
    p.hasVariants === true ||
    p.has_variants === true ||
    p.hasVariants === 1 ||
    p.has_variants === 1 ||
    p.hasVariants === 'true' ||
    p.has_variants === 'true' ||
    opts.length > 0 ||
    matrix.length > 0 ||
    vars.length > 0 ||
    variations.length > 0 ||
    Object.keys(colorImgs || {}).length > 0
  );

  return {
    ...p,
    hasVariants: hasVar,
    has_variants: hasVar,
  };
}

// ==========================================
// Category Endpoints
// ==========================================
router.get(['/categories', '/categories/'], async (_req: Request, res: Response) => {
  try {
    const cats = await getAllSqliteCategories();
    res.json(cats);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch categories.';
    res.status(500).json({ success: false, error: message });
  }
});

router.post(['/categories/bulk_sync', '/categories/bulk_sync/'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const categoriesData = req.body;
    if (!Array.isArray(categoriesData)) {
      return res.status(400).json({ success: false, error: 'Expected an array of categories.' });
    }
    const saved = await saveSqliteCategories(categoriesData);
    res.json({ success: true, message: `Synchronized ${saved.length} categories successfully.`, categories: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to sync categories.';
    res.status(500).json({ success: false, error: message });
  }
});

router.post(['/categories/bulk_action', '/categories/bulk_action/'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const { category_ids, ids, action, status: newStatus, target_parent_id, resolution_mode } = req.body || {};
    const catIds: string[] = (Array.isArray(category_ids) ? category_ids : Array.isArray(ids) ? ids : []).map(id => String(id));

    if (catIds.length === 0) {
      return res.status(400).json({ success: false, error: 'category_ids array is required.' });
    }

    let currentCats = await getAllSqliteCategories();
    let affectedCount = 0;

    if (action === 'delete') {
      if (resolution_mode === 'cascade') {
        const toDeleteSet = new Set<string>(catIds);
        let addedNew = true;
        while (addedNew) {
          addedNew = false;
          for (const c of currentCats) {
            if (c.parentId && toDeleteSet.has(String(c.parentId)) && !toDeleteSet.has(String(c.id))) {
              toDeleteSet.add(String(c.id));
              addedNew = true;
            }
          }
        }
        const finalDeleteArray = Array.from(toDeleteSet);
        currentCats = currentCats.filter(c => !toDeleteSet.has(String(c.id)));
        await deleteSqliteCategoriesBulk(finalDeleteArray);
        affectedCount = finalDeleteArray.length;
      } else {
        const targetParentVal = target_parent_id || null;
        currentCats = currentCats.map(c => {
          if (c.parentId && catIds.includes(String(c.parentId)) && !catIds.includes(String(c.id))) {
            return { ...c, parentId: targetParentVal, updatedAt: new Date().toISOString() };
          }
          return c;
        }).filter(c => !catIds.includes(String(c.id)));
        
        await deleteSqliteCategoriesBulk(catIds);
        affectedCount = catIds.length;
      }
      await saveSqliteCategories(currentCats);
    } else if (action === 'status_active' || (action === 'update_status' && newStatus === 'Active')) {
      currentCats = currentCats.map(c => catIds.includes(String(c.id)) ? { ...c, status: 'Active', updatedAt: new Date().toISOString() } : c);
      await saveSqliteCategories(currentCats);
      affectedCount = catIds.length;
    } else if (action === 'status_inactive' || (action === 'update_status' && newStatus === 'Inactive')) {
      currentCats = currentCats.map(c => catIds.includes(String(c.id)) ? { ...c, status: 'Inactive', updatedAt: new Date().toISOString() } : c);
      await saveSqliteCategories(currentCats);
      affectedCount = catIds.length;
    } else if (action === 'reparent') {
      const parentVal = target_parent_id || null;
      currentCats = currentCats.map(c => catIds.includes(String(c.id)) ? { ...c, parentId: parentVal, updatedAt: new Date().toISOString() } : c);
      await saveSqliteCategories(currentCats);
      affectedCount = catIds.length;
    }

    res.json({
      success: true,
      message: `Category bulk action '${action}' completed successfully for ${affectedCount} categories.`,
      affected_count: affectedCount,
      categories: currentCats,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to execute category bulk action.';
    res.status(500).json({ success: false, error: message });
  }
});

router.post(['/categories', '/categories/'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const cat = req.body || {};
    if (!cat.id) {
      cat.id = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    }
    if (!cat.slug && cat.name) {
      cat.slug = String(cat.name).toLowerCase().replace(/\s+/g, '-');
    }
    const current = await getAllSqliteCategories();
    const updated = [...current.filter(c => String(c.id) !== String(cat.id)), cat];
    const saved = await saveSqliteCategories(updated);
    const createdCat = saved.find(c => String(c.id) === String(cat.id)) || cat;
    res.status(201).json({ success: true, message: 'Category created successfully.', category: createdCat });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create category.';
    res.status(500).json({ success: false, error: message });
  }
});

router.put(['/categories/:id', '/categories/:id/'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cat = req.body || {};
    cat.id = id;
    const current = await getAllSqliteCategories();
    const updated = current.map(c => String(c.id) === String(id) ? { ...c, ...cat, updatedAt: new Date().toISOString() } : c);
    const saved = await saveSqliteCategories(updated);
    const updatedCat = saved.find(c => String(c.id) === String(id)) || cat;
    res.json({ success: true, message: 'Category updated successfully.', category: updatedCat });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update category.';
    res.status(500).json({ success: false, error: message });
  }
});

router.delete(['/categories/:id', '/categories/:id/'], requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deleteSqliteCategory(id);
    const current = await getAllSqliteCategories();
    const updated = current.filter(c => String(c.id) !== String(id));
    await saveSqliteCategories(updated);
    res.json({ success: true, message: 'Category deleted successfully.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete category.';
    res.status(500).json({ success: false, error: message });
  }
});

// ==========================================
// Bulk Products Actions
// ==========================================
router.post(['/bulk_action', '/bulk_action/'], requireAdmin, async (req: Request, res: Response) => {
  const { product_ids, action, status: newStatus } = req.body || {};
  if (!Array.isArray(product_ids)) {
    return res.status(400).json({ success: false, error: 'product_ids array required.' });
  }

  await loadProductsCache();
  let affectedCount = 0;

  if (action === 'archive') {
    productsCache = productsCache.map(p => {
      if (product_ids.includes(p.id)) {
        affectedCount++;
        return { ...p, status: 'Archived' };
      }
      return p;
    });
  } else if (action === 'delete') {
    const initialLen = productsCache.length;
    const pidsSet = new Set(product_ids.map((id: any) => String(id)));
    productsCache = productsCache.filter(p => !pidsSet.has(String(p.id)));
    affectedCount = initialLen - productsCache.length;

    // Explicitly delete from SQLite table directly too
    try {
      await deleteSqliteProductsBulk(product_ids.map(id => String(id)));
    } catch (dbErr) {
      console.warn('[Products API] Bulk delete SQLite table notice:', dbErr);
    }
  } else if (action === 'update_status' && newStatus) {
    productsCache = productsCache.map(p => {
      if (product_ids.includes(p.id)) {
        affectedCount++;
        return { ...p, status: newStatus };
      }
      return p;
    });
  }

  await persistProductsCache();

  // Broadcast real-time changes to active cart streams
  for (const pid of product_ids) {
    const updatedProd = productsCache.find(p => p.id === pid);
    if (updatedProd) {
      cartStreamManager.broadcastProductChange(pid, {
        status: updatedProd.status,
        stock: updatedProd.stock,
      });
    } else if (action === 'delete') {
      cartStreamManager.broadcastProductChange(pid, {
        status: 'deleted',
        deleted: true,
        stock: 0,
      });
    }
  }

  res.json({ success: true, message: `Bulk action '${action}' completed.`, affected_count: affectedCount });
});

// ==========================================
// Product Variants Endpoints
// ==========================================
router.get('/:id/variants', async (req: Request, res: Response) => {
  await loadProductsCache();
  const product = productsCache.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  res.json({
    productId: product.id,
    hasVariants: product.hasVariants || product.has_variants || false,
    options: product.options || [],
    colorImages: product.colorImages || product.color_images || {},
    variants: product.variants || product.variantMatrix || product.variant_matrix || [],
  });
});

router.put('/:id/options', requireAdmin, async (req: Request, res: Response) => {
  await loadProductsCache();
  const idx = productsCache.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  const options = req.body.options || [];
  const hasVariants = req.body.hasVariants !== undefined ? req.body.hasVariants : true;

  const optionNames = options.map((opt: any) => (opt.name || '').trim().toLowerCase()).filter(Boolean);
  const uniqueNames = new Set(optionNames);
  if (uniqueNames.size !== optionNames.length) {
    return res.status(400).json({ success: false, error: 'Option names must be unique.' });
  }

  for (const opt of options) {
    const valNames = (opt.values || []).map((v: any) => (typeof v === 'string' ? v : v.name || '').trim().toLowerCase()).filter(Boolean);
    const uniqueVals = new Set(valNames);
    if (uniqueVals.size !== valNames.length) {
      return res.status(400).json({ success: false, error: `Duplicate values found in option "${opt.name}".` });
    }
  }

  productsCache[idx].options = options;
  productsCache[idx].hasVariants = hasVariants;
  productsCache[idx].has_variants = hasVariants;
  productsCache[idx].updated_at = new Date().toISOString();

  await persistProductsCache();
  cartStreamManager.broadcastProductChange(productsCache[idx].id, {
    options,
    hasVariants,
  });
  res.json({ success: true, message: 'Options updated successfully.', options, hasVariants });
});

router.post('/:id/variants/generate', requireAdmin, async (req: Request, res: Response) => {
  await loadProductsCache();
  const product = productsCache.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  const options: any[] = req.body.options || product.options || [];
  const validOptions = options.filter(o => o.name && o.values && o.values.length > 0);

  if (validOptions.length === 0) {
    return res.status(400).json({ success: false, error: 'Cannot generate variant matrix without defined options and values.' });
  }

  const optionValueArrays = validOptions.map(opt =>
    opt.values.map((v: any) => ({
      optionKey: opt.name.toLowerCase().trim().replace(/\s+/g, '_'),
      valueName: typeof v === 'string' ? v.trim() : (v.name || '').trim(),
    }))
  );

  const cartesian = (arrays: any[][]): any[][] => {
    return arrays.reduce((acc, curr) =>
      acc.flatMap(d => curr.map(e => [...d, e])),
      [[]] as any[][]
    );
  };

  const combinations = cartesian(optionValueArrays);
  const existingVariants = product.variants || product.variantMatrix || product.variant_matrix || [];
  const basePrice = Number(req.body.basePrice || product.price || 0);
  const baseSku = (req.body.baseSku || product.sku || 'SKU').toUpperCase();

  const newVariants = combinations.map(combo => {
    const attributes: Record<string, string> = {};
    combo.forEach(c => {
      attributes[c.optionKey] = c.valueName;
    });

    const existing = existingVariants.find((v: any) => {
      const keysA = Object.keys(v.attributes || {});
      const keysB = Object.keys(attributes);
      if (keysA.length !== keysB.length) return false;
      return keysB.every(k => (v.attributes[k] || '').toLowerCase() === (attributes[k] || '').toLowerCase());
    });

    if (existing) {
      return {
        ...existing,
        attributes,
      };
    }

    const skuSuffix = Object.values(attributes)
      .map(val => val.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase())
      .join('-');

    return {
      id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sku: `${baseSku}-${skuSuffix || 'DEF'}`,
      attributes,
      price: basePrice,
      priceOverride: null,
      compareAtPrice: null,
      stockQty: 10,
      active: true,
    };
  });

  res.json({ success: true, variants: newVariants });
});

router.put('/:id/variants', requireAdmin, async (req: Request, res: Response) => {
  await loadProductsCache();
  const idx = productsCache.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  const variants: any[] = req.body.variants || [];
  const hasVariants = req.body.hasVariants !== undefined ? req.body.hasVariants : true;

  if (hasVariants && variants.length === 0) {
    return res.status(400).json({ success: false, error: 'At least one variant must be created when variants are enabled.' });
  }

  const skus = variants.map(v => (v.sku || '').trim());
  if (skus.some(s => !s)) {
    return res.status(400).json({ success: false, error: 'All variants must have a valid SKU code.' });
  }

  const uniqueSkus = new Set(skus);
  if (uniqueSkus.size !== skus.length) {
    return res.status(400).json({ success: false, error: 'Duplicate SKUs found among variants.' });
  }

  for (const v of variants) {
    if (v.price !== null && v.price !== undefined && Number(v.price) < 0) {
      return res.status(400).json({ success: false, error: `Variant "${v.sku}" has a negative price.` });
    }
    if (v.stockQty !== undefined && Number(v.stockQty) < 0) {
      return res.status(400).json({ success: false, error: `Variant "${v.sku}" has a negative stock quantity.` });
    }
  }

  if (hasVariants && !variants.some(v => v.active !== false)) {
    return res.status(400).json({ success: false, error: 'At least one variant must be active.' });
  }

  productsCache[idx].hasVariants = hasVariants;
  productsCache[idx].has_variants = hasVariants;
  productsCache[idx].variant_matrix = variants;
  productsCache[idx].variantMatrix = variants;
  productsCache[idx].variants = variants;
  productsCache[idx].updated_at = new Date().toISOString();

  await persistProductsCache();
  cartStreamManager.broadcastProductChange(productsCache[idx].id, {
    variants,
    variant_matrix: variants,
    hasVariants,
  });
  res.json({ success: true, message: 'Variants updated successfully.', variants, hasVariants });
});

// ==========================================
// Primary Products CRUD Endpoints
// ==========================================
router.get('/', async (req: Request, res: Response) => {
  await loadProductsCache();
  let result = productsCache.map(normalizeProductVariants);
  const { status: statusFilter, category, search, type, on_sale, onSale } = req.query;

  if (statusFilter && typeof statusFilter === 'string') {
    result = result.filter(p => p.status?.toLowerCase() === statusFilter.toLowerCase());
  }

  if (category && typeof category === 'string' && category.toLowerCase() !== 'all') {
    try {
      const allCats = await getAllSqliteCategories();
      const matchedCat = allCats.find(c =>
        c.name.toLowerCase() === category.toLowerCase() ||
        c.slug.toLowerCase() === category.toLowerCase() ||
        c.id === category
      );
      if (matchedCat) {
        const subCats = allCats.filter(c => c.parentId === matchedCat.id);
        const validNames = new Set([matchedCat.name.toLowerCase(), ...subCats.map(s => s.name.toLowerCase())]);
        const validSlugs = new Set([matchedCat.slug.toLowerCase(), ...subCats.map(s => s.slug.toLowerCase())]);
        const validIds = new Set([matchedCat.id, ...subCats.map(s => s.id)]);

        result = result.filter(p => {
          const pCat = (p.category || '').toLowerCase();
          const pSub = (p.subcategoryId || '').toLowerCase();
          return validNames.has(pCat) || validSlugs.has(pCat) || validIds.has(p.category) || validIds.has(p.subcategoryId) || validNames.has(pSub);
        });
      } else {
        result = result.filter(p => p.category?.toLowerCase() === category.toLowerCase());
      }
    } catch {
      result = result.filter(p => p.category?.toLowerCase() === category.toLowerCase());
    }
  }

  if (type && typeof type === 'string' && type.toLowerCase() !== 'all') {
    result = result.filter(p => p.type?.toLowerCase() === type.toLowerCase());
  }

  const isOnSale = on_sale === 'true' || on_sale === '1' || onSale === 'true' || onSale === '1';
  if (isOnSale) {
    result = result.filter(p => {
      const orig = Number(p.original_price || p.originalPrice || p.previousPrice || 0);
      const pr = Number(p.price || 0);
      return orig > pr && pr > 0;
    });
  }

  if (search && typeof search === 'string') {
    const s = search.toLowerCase();
    result = result.filter(p =>
      p.name?.toLowerCase().includes(s) ||
      p.sku?.toLowerCase().includes(s) ||
      p.description?.toLowerCase().includes(s) ||
      p.tags?.toLowerCase().includes(s)
    );
  }

  // Ensure categories and catalog always return latest/newest products first by default
  const sortParam = (req.query.sort as string) || (req.query.sortBy as string) || 'latest';
  if (sortParam === 'price-asc') {
    result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  } else if (sortParam === 'price-desc') {
    result.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  } else if (sortParam === 'alpha-asc') {
    result.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  } else if (sortParam === 'alpha-desc') {
    result.sort((a, b) => String(b.name || '').localeCompare(String(a.name || '')));
  } else {
    // Default: 'latest' / 'newest'
    result.sort((a, b) => {
      const timeA = a.created_at || a.createdAt ? new Date(a.created_at || a.createdAt).getTime() : 0;
      const timeB = b.created_at || b.createdAt ? new Date(b.created_at || b.createdAt).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      const numA = parseInt(String(a.id || '').replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(String(b.id || '').replace(/\D/g, ''), 10) || 0;
      if (numA !== numB) return numB - numA;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }

  res.json(result);
});

router.get('/:id', async (req: Request, res: Response) => {
  await loadProductsCache();
  const item = productsCache.find(p => p.id === req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  res.json(normalizeProductVariants(item));
});

router.post('/', requireAdmin, async (req: Request, res: Response) => {
  await loadProductsCache();
  const rawImages = req.body.images || req.body.gallery_images;
  let parsedImages: string[] = [];
  if (Array.isArray(rawImages)) {
    parsedImages = rawImages.filter((img: any) => typeof img === 'string' && img.trim().length > 0);
  } else if (typeof rawImages === 'string' && rawImages.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(rawImages);
      if (Array.isArray(parsed)) parsedImages = parsed.filter((img: any) => typeof img === 'string' && img.trim().length > 0);
    } catch {
      parsedImages = rawImages.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  } else if (typeof rawImages === 'string' && rawImages.trim()) {
    parsedImages = [rawImages.trim()];
  }

  const primaryImg = req.body.image_url || req.body.imageUrl || parsedImages[0] || '';
  if (parsedImages.length === 0 && primaryImg) {
    parsedImages = [primaryImg];
  } else if (parsedImages.length > 0 && !parsedImages.includes(primaryImg)) {
    parsedImages = [primaryImg, ...parsedImages];
  }

  const rawOpts = req.body.options || [];
  const rawMatrix = req.body.variant_matrix || req.body.variantMatrix || req.body.variants || [];
  const rawVars = req.body.variants || req.body.variantMatrix || req.body.variant_matrix || [];
  const rawVariations = req.body.variations || [];
  const rawColorImgs = req.body.color_images || req.body.colorImages || {};

  const hasVariantsComputed = Boolean(
    req.body.has_variants === true ||
    req.body.hasVariants === true ||
    req.body.has_variants === 1 ||
    req.body.hasVariants === 1 ||
    req.body.has_variants === 'true' ||
    req.body.hasVariants === 'true' ||
    (Array.isArray(rawOpts) && rawOpts.length > 0) ||
    (Array.isArray(rawMatrix) && rawMatrix.length > 0) ||
    (Array.isArray(rawVars) && rawVars.length > 0) ||
    (Array.isArray(rawVariations) && rawVariations.length > 0) ||
    (rawColorImgs && typeof rawColorImgs === 'object' && Object.keys(rawColorImgs).length > 0)
  );

  const newProduct = {
    id: req.body.id || `prod-${Date.now()}`,
    sku: req.body.sku || `SKU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    name: req.body.name || 'New Product',
    brand: req.body.brand || '',
    countryOfOrigin: req.body.countryOfOrigin || req.body.country_of_origin || '',
    country_of_origin: req.body.country_of_origin || req.body.countryOfOrigin || '',
    description: req.body.description || '',
    price: Number(req.body.price || 0),
    original_price: req.body.original_price ? Number(req.body.original_price) : null,
    cost_price: req.body.cost_price !== undefined && req.body.cost_price !== null && req.body.cost_price !== ''
      ? Number(req.body.cost_price)
      : req.body.costPrice !== undefined && req.body.costPrice !== null && req.body.costPrice !== ''
      ? Number(req.body.costPrice)
      : null,
    costPrice: req.body.costPrice !== undefined && req.body.costPrice !== null && req.body.costPrice !== ''
      ? Number(req.body.costPrice)
      : req.body.cost_price !== undefined && req.body.cost_price !== null && req.body.cost_price !== ''
      ? Number(req.body.cost_price)
      : null,
    category: req.body.category || 'General',
    type: req.body.type || 'physical',
    status: req.body.status || 'Active',
    image_url: primaryImg,
    imageUrl: primaryImg,
    images: parsedImages,
    gallery_images: parsedImages,
    stock: req.body.stock !== undefined ? Number(req.body.stock) : 10,
    low_stock_threshold: req.body.low_stock_threshold ? Number(req.body.low_stock_threshold) : 5,
    track_stock: req.body.track_stock !== false,
    is_featured: Boolean(req.body.is_featured),
    tags: typeof req.body.tags === 'string' ? req.body.tags : (Array.isArray(req.body.tags) ? req.body.tags.join(', ') : ''),
    has_variants: hasVariantsComputed,
    hasVariants: hasVariantsComputed,
    options: rawOpts,
    color_images: rawColorImgs,
    colorImages: rawColorImgs,
    variations: rawVariations,
    variant_matrix: rawMatrix,
    variantMatrix: rawMatrix,
    variants: rawVars,
    unit_measurement: req.body.unit_measurement || req.body.unitMeasurement || '',
    unit_value: req.body.unit_value !== undefined ? req.body.unit_value : req.body.unitValue,
    weight: req.body.weight || '',
    length: req.body.length || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  productsCache.unshift(newProduct);
  await persistProductsCache();

  // Record initial inventory audit log
  if (newProduct.stock !== undefined && newProduct.stock !== null) {
    try {
      await addSqliteInventoryAuditLog({
        productId: newProduct.id,
        productName: newProduct.name,
        productSku: newProduct.sku,
        changeQuantity: Number(newProduct.stock),
        newStock: Number(newProduct.stock),
        reason: 'Initial Stock Creation',
        details: `Initial stock of ${newProduct.stock} units recorded upon product creation.`,
      });
    } catch (auditErr) {
      console.warn('[Products API] Failed to record initial inventory audit log:', auditErr);
    }
  }

  res.status(201).json({ success: true, message: 'Product created successfully.', product: newProduct });
});

router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  await loadProductsCache();
  const idx = productsCache.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  const previousStock = productsCache[idx].stock !== undefined ? Number(productsCache[idx].stock) : 0;
  const rawImages = req.body.images || req.body.gallery_images;
  let parsedImages = productsCache[idx].images;
  if (Array.isArray(rawImages)) {
    parsedImages = rawImages.filter((img: any) => typeof img === 'string' && img.trim().length > 0);
  } else if (typeof rawImages === 'string' && rawImages.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(rawImages);
      if (Array.isArray(parsed)) parsedImages = parsed.filter((img: any) => typeof img === 'string' && img.trim().length > 0);
    } catch {
      parsedImages = rawImages.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }

  const primaryImg = req.body.image_url || req.body.imageUrl || (parsedImages && parsedImages[0]) || productsCache[idx].imageUrl;

  const costVal = req.body.cost_price !== undefined && req.body.cost_price !== null && req.body.cost_price !== ''
    ? Number(req.body.cost_price)
    : (req.body.costPrice !== undefined && req.body.costPrice !== null && req.body.costPrice !== ''
      ? Number(req.body.costPrice)
      : (productsCache[idx].costPrice !== undefined && productsCache[idx].costPrice !== null ? productsCache[idx].costPrice : productsCache[idx].cost_price));

  const rawOpts = req.body.options !== undefined ? req.body.options : (productsCache[idx].options || []);
  const rawMatrix = req.body.variant_matrix || req.body.variantMatrix || req.body.variants || productsCache[idx].variant_matrix || productsCache[idx].variantMatrix || productsCache[idx].variants || [];
  const rawVars = req.body.variants || req.body.variantMatrix || req.body.variant_matrix || productsCache[idx].variants || productsCache[idx].variantMatrix || productsCache[idx].variant_matrix || [];
  const rawVariations = req.body.variations || productsCache[idx].variations || [];
  const rawColorImgs = req.body.color_images || req.body.colorImages || productsCache[idx].color_images || productsCache[idx].colorImages || {};

  const hasVariantsComputed = Boolean(
    req.body.has_variants === true ||
    req.body.hasVariants === true ||
    req.body.has_variants === 1 ||
    req.body.hasVariants === 1 ||
    req.body.has_variants === 'true' ||
    req.body.hasVariants === 'true' ||
    (Array.isArray(rawOpts) && rawOpts.length > 0) ||
    (Array.isArray(rawMatrix) && rawMatrix.length > 0) ||
    (Array.isArray(rawVars) && rawVars.length > 0) ||
    (Array.isArray(rawVariations) && rawVariations.length > 0) ||
    (rawColorImgs && typeof rawColorImgs === 'object' && Object.keys(rawColorImgs).length > 0) ||
    productsCache[idx].hasVariants === true ||
    productsCache[idx].has_variants === true
  );

  const updatedStock = req.body.stock !== undefined ? Number(req.body.stock) : productsCache[idx].stock;

  productsCache[idx] = {
    ...productsCache[idx],
    ...req.body,
    stock: updatedStock,
    cost_price: costVal !== undefined ? costVal : null,
    costPrice: costVal !== undefined ? costVal : null,
    image_url: primaryImg,
    imageUrl: primaryImg,
    images: parsedImages || (primaryImg ? [primaryImg] : []),
    gallery_images: parsedImages || (primaryImg ? [primaryImg] : []),
    has_variants: hasVariantsComputed,
    hasVariants: hasVariantsComputed,
    options: rawOpts,
    color_images: rawColorImgs,
    colorImages: rawColorImgs,
    variant_matrix: rawMatrix,
    variantMatrix: rawMatrix,
    variants: rawVars,
    unit_measurement: req.body.unit_measurement || req.body.unitMeasurement || productsCache[idx].unit_measurement || '',
    unit_value: req.body.unit_value !== undefined ? req.body.unit_value : (req.body.unitValue !== undefined ? req.body.unitValue : productsCache[idx].unit_value),
    updated_at: new Date().toISOString(),
  };

  await persistProductsCache();

  // Broadcast real-time changes to active cart streams
  cartStreamManager.broadcastProductChange(productsCache[idx].id, {
    price: productsCache[idx].price,
    original_price: productsCache[idx].original_price,
    stock: productsCache[idx].stock,
    status: productsCache[idx].status,
    name: productsCache[idx].name,
    images: productsCache[idx].images,
    image_url: productsCache[idx].image_url,
    imageUrl: productsCache[idx].imageUrl,
    variants: productsCache[idx].variants,
  });

  // Record inventory change if stock was adjusted
  if (req.body.stock !== undefined && Number(req.body.stock) !== previousStock) {
    const diff = Number(req.body.stock) - previousStock;
    try {
      await addSqliteInventoryAuditLog({
        productId: productsCache[idx].id,
        productName: productsCache[idx].name,
        productSku: productsCache[idx].sku,
        changeQuantity: diff,
        newStock: Number(req.body.stock),
        reason: req.body.stockAdjustmentReason || 'Admin Manual Adjustment',
        details: `Stock changed from ${previousStock} to ${req.body.stock} (${diff > 0 ? `+${diff}` : diff}).`,
      });
    } catch (auditErr) {
      console.warn('[Products API] Failed to record stock change audit log:', auditErr);
    }
  }

  res.json({ success: true, message: 'Product updated successfully.', product: productsCache[idx] });
});

router.delete(['/:id', '/:id/'], requireAdmin, async (req: Request, res: Response) => {
  await loadProductsCache();
  const pid = String(req.params.id);
  const idx = productsCache.findIndex(p => String(p.id) === pid);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  const deleted = productsCache.splice(idx, 1)[0];
  try {
    await deleteSqliteProduct(pid);
  } catch (dbErr) {
    console.warn('[Products API] Delete SQLite notice:', dbErr);
  }
  await persistProductsCache();

  // Broadcast deletion to all carts
  cartStreamManager.broadcastProductChange(deleted.id, {
    status: 'deleted',
    deleted: true,
    stock: 0,
  });

  res.json({ success: true, message: `Product "${deleted.name}" deleted successfully.` });
});

// ==========================================
// Inventory Audit Logs & Stock Adjustment Endpoints
// ==========================================
router.get('/inventory/logs', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const logs = await getSqliteInventoryAuditLogs(limit);
    res.json({ success: true, logs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch inventory audit logs';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/inventory/adjust', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { productId, changeQuantity, newStock, reason = 'Manual Stock Adjustment', details = '' } = req.body || {};
    if (!productId) {
      return res.status(400).json({ success: false, error: 'productId is required' });
    }

    await loadProductsCache();
    const idx = productsCache.findIndex(p => p.id === productId);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const currentStock = Number(productsCache[idx].stock || 0);
    let targetStock = currentStock;
    let effectiveChange = 0;

    if (newStock !== undefined && newStock !== null) {
      targetStock = Number(newStock);
      effectiveChange = targetStock - currentStock;
    } else if (changeQuantity !== undefined && changeQuantity !== null) {
      effectiveChange = Number(changeQuantity);
      targetStock = currentStock + effectiveChange;
    } else {
      return res.status(400).json({ success: false, error: 'Either changeQuantity or newStock must be provided.' });
    }

    productsCache[idx].stock = targetStock;
    productsCache[idx].updated_at = new Date().toISOString();
    await persistProductsCache();

    // Broadcast stock change to active carts
    cartStreamManager.broadcastProductChange(productId, {
      stock: targetStock,
    });

    const auditEntry = await addSqliteInventoryAuditLog({
      productId,
      productName: productsCache[idx].name,
      productSku: productsCache[idx].sku,
      changeQuantity: effectiveChange,
      newStock: targetStock,
      reason,
      details: details || `Stock adjusted by ${effectiveChange > 0 ? `+${effectiveChange}` : effectiveChange} to ${targetStock}.`,
    });

    res.json({
      success: true,
      message: 'Inventory stock adjusted successfully.',
      currentStock: targetStock,
      audit: auditEntry,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to adjust inventory stock';
    res.status(500).json({ success: false, error: message });
  }
});

// Fetch verified reviews for a specific product
router.get(['/:productId/reviews', '/:productId/reviews/'], async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { rating, sort } = req.query;

    const result = await getSqliteReviewsByProduct(productId, {
      rating: rating ? Number(rating) : undefined,
      sort: typeof sort === 'string' ? sort : undefined,
    });

    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve product reviews';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
