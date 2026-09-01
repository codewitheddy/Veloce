import { Category, CategoryAuditLog, Product } from '../types';
import { generateSlug } from '../components/ProductFormEditor';
import { categoriesApi } from '../services/api';

export const DEFAULT_CATEGORY_OBJECTS: Category[] = [
  {
    id: 'cat-1',
    name: 'Electronics',
    slug: 'electronics',
    parentId: null,
    description: 'Smartphones, Audio, Computing and Smart Tech',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
    status: 'Active',
    displayOrder: 1,
    previousSlugs: [],
    productCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cat-2',
    name: 'Fashion',
    slug: 'fashion',
    parentId: null,
    description: 'Men & Women Apparel, Shoes, and Accessories',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
    status: 'Active',
    displayOrder: 2,
    previousSlugs: [],
    productCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cat-3',
    name: 'Home & Living',
    slug: 'home-living',
    parentId: null,
    description: 'Furniture, Decor, Kitchen and Smart Appliances',
    imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600',
    status: 'Active',
    displayOrder: 3,
    previousSlugs: [],
    productCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cat-4',
    name: 'Beauty & Fragrances',
    slug: 'beauty-fragrances',
    parentId: null,
    description: 'Skincare, Makeup, Perfumes and Personal Care',
    imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600',
    status: 'Active',
    displayOrder: 4,
    previousSlugs: [],
    productCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cat-5',
    name: 'Sports & Outdoor',
    slug: 'sports-outdoor',
    parentId: null,
    description: 'Fitness Gear, Activewear, and Equipment',
    imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600',
    status: 'Active',
    displayOrder: 5,
    previousSlugs: [],
    productCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cat-6',
    name: 'Food & Beverages',
    slug: 'food-beverages',
    parentId: null,
    description: 'Gourmet Snacks, Organic Groceries, and Beverages',
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600',
    status: 'Active',
    displayOrder: 6,
    previousSlugs: [],
    productCount: 0,
    createdAt: new Date().toISOString(),
  },
];

const STORAGE_KEY_CATEGORIES = 'veloce_categories_v2';
const STORAGE_KEY_AUDIT_LOGS = 'veloce_category_audit_logs';

/**
 * Fetch categories from Django/Node backend API, with fallback to local storage
 */
export async function fetchCategoriesFromBackend(): Promise<Category[]> {
  try {
    const backendCategories = await categoriesApi.getCategories();
    // Only cache if backend returns a valid non-empty array
    if (backendCategories !== null && Array.isArray(backendCategories) && backendCategories.length > 0) {
      const normalized: Category[] = backendCategories.map((c: any) => ({
        id: String(c.id),
        name: c.name,
        slug: c.slug || String(c.name).toLowerCase().replace(/\s+/g, '-'),
        parentId: c.parentId || c.parent_id || null,
        description: c.description || '',
        imageUrl: c.imageUrl || c.image_url || '',
        status: c.status === 'Inactive' ? 'Inactive' : 'Active',
        displayOrder: typeof c.displayOrder === 'number' ? c.displayOrder : (typeof c.display_order === 'number' ? c.display_order : 0),
        previousSlugs: Array.isArray(c.previousSlugs) ? c.previousSlugs : (Array.isArray(c.previous_slugs) ? c.previous_slugs : []),
        productCount: typeof c.productCount === 'number' ? c.productCount : 0,
        createdAt: c.createdAt || c.created_at || new Date().toISOString(),
      }));

      // Cache normalized categories to localStorage
      try {
        localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(normalized));
        const uniqueNames = Array.from(new Set(normalized.map((c) => c.name)));
        localStorage.setItem('veloce_custom_categories', JSON.stringify(uniqueNames));
        localStorage.removeItem('veloce_categories_cleared');
      } catch {}

      return normalized;
    }
  } catch (err) {
    console.warn('[CategoryUtils] Backend fetch failed, falling back to cached storage:', err);
  }
  return loadCategoriesFromStorage();
}

/**
 * Load categories from localStorage, preserving existing categories, auto-recovering from products, or seeding defaults
 */
export function loadCategoriesFromStorage(): Category[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CATEGORIES);

    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    // Auto-Recovery 1: Recover from custom categories string array if present
    const customCatsRaw = localStorage.getItem('veloce_custom_categories');
    if (customCatsRaw) {
      try {
        const customCats = JSON.parse(customCatsRaw);
        if (Array.isArray(customCats) && customCats.length > 0) {
          const recovered: Category[] = customCats.map((name: string, idx: number) => ({
            id: `cat-rec-${idx + 1}`,
            name: String(name),
            slug: String(name).toLowerCase().replace(/\s+/g, '-'),
            parentId: null,
            description: `${name} products and accessories`,
            imageUrl: '',
            status: 'Active',
            displayOrder: idx + 1,
            previousSlugs: [],
            productCount: 0,
            createdAt: new Date().toISOString(),
          }));
          try {
            localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(recovered));
          } catch {}
          return recovered;
        }
      } catch {}
    }

    // Auto-Recovery 2: Recover from existing product catalog in localStorage
    const productsRaw = localStorage.getItem('veloce_products');
    if (productsRaw) {
      try {
        const prods = JSON.parse(productsRaw);
        if (Array.isArray(prods) && prods.length > 0) {
          const catNames = Array.from(new Set(prods.map((p: any) => p.category).filter(Boolean))) as string[];
          if (catNames.length > 0) {
            const recovered: Category[] = catNames.map((name: string, idx: number) => ({
              id: `cat-prod-${idx + 1}`,
              name: String(name),
              slug: String(name).toLowerCase().replace(/\s+/g, '-'),
              parentId: null,
              description: `${name} catalog category`,
              imageUrl: '',
              status: 'Active',
              displayOrder: idx + 1,
              previousSlugs: [],
              productCount: prods.filter((p: any) => p.category === name).length,
              createdAt: new Date().toISOString(),
            }));
            try {
              localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(recovered));
              localStorage.setItem('veloce_custom_categories', JSON.stringify(catNames));
            } catch {}
            return recovered;
          }
        }
      } catch {}
    }
  } catch (err) {
    console.warn('[CategoryUtils] Failed to load categories from storage:', err);
  }
  return DEFAULT_CATEGORY_OBJECTS;
}

/**
 * Save categories array to localStorage AND synchronize to backend
 */
export function saveCategoriesToStorage(categories: Category[]) {
  try {
    try {
      localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(categories));
    } catch (quotaErr) {
      console.warn('[CategoryUtils] localStorage quota exceeded, saving lightweight category payload without large images:', quotaErr);
      // Strip large image data for localStorage cache to prevent quota exceeded errors
      const safeCategories = categories.map((c) => ({
        ...c,
        imageUrl: c.imageUrl && c.imageUrl.startsWith('data:') && c.imageUrl.length > 5000 ? '' : c.imageUrl,
      }));
      try {
        localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(safeCategories));
      } catch (innerErr) {
        console.warn('[CategoryUtils] Still exceeded quota, saving names only:', innerErr);
      }
    }

    const uniqueNames = Array.from(new Set(categories.map((c) => c.name)));
    try {
      localStorage.setItem('veloce_custom_categories', JSON.stringify(uniqueNames));
    } catch {}

    if (categories.length === 0) {
      localStorage.setItem('veloce_categories_cleared', 'true');
    } else {
      localStorage.removeItem('veloce_categories_cleared');
    }

    // Broadcast category update event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('veloce_categories_updated', { detail: categories }));
    }

    // Background sync to backend API (Node server / Django backend)
    categoriesApi.bulkSyncCategories(categories).catch((err) => {
      console.warn('[CategoryUtils] Background backend bulkSync failed:', err);
    });
  } catch (err) {
    console.error('[CategoryUtils] Failed to save categories:', err);
  }
}

/**
 * Audit Log Storage Management
 */
export function loadCategoryAuditLogs(): CategoryAuditLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUDIT_LOGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[CategoryUtils] Failed to load category audit logs:', err);
  }
  return [];
}

export function addCategoryAuditLog(
  categoryId: string,
  categoryName: string,
  action: CategoryAuditLog['action'],
  changes: string,
  changedBy: string = 'Admin'
) {
  try {
    const logs = loadCategoryAuditLogs();
    const newLog: CategoryAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      categoryId,
      categoryName,
      action,
      changes,
      changedBy,
      timestamp: new Date().toISOString(),
    };
    const updated = [newLog, ...logs].slice(0, 200); // keep last 200 logs
    localStorage.setItem(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(updated));
    return newLog;
  } catch (err) {
    console.error('[CategoryUtils] Failed to write audit log:', err);
  }
}

/**
 * Check if targetId is a descendant of ancestorId in the category tree
 */
export function isDescendant(categories: Category[], ancestorId: string, targetId: string): boolean {
  if (!ancestorId || !targetId) return false;
  if (ancestorId === targetId) return true;

  const children = categories.filter((c) => c.parentId === ancestorId);
  for (const child of children) {
    if (child.id === targetId || isDescendant(categories, child.id, targetId)) {
      return true;
    }
  }
  return false;
}

/**
 * Get all child category IDs recursively
 */
export function getAllDescendantCategoryIds(categories: Category[], parentId: string): string[] {
  const result: string[] = [];
  const children = categories.filter((c) => c.parentId === parentId);
  for (const child of children) {
    result.push(child.id);
    result.push(...getAllDescendantCategoryIds(categories, child.id));
  }
  return result;
}

/**
 * Get category depth (0 for root, 1 for subcategory, 2 for sub-subcategory, etc.)
 */
export function getCategoryDepth(categories: Category[], categoryId: string): number {
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat || !cat.parentId) return 0;
  return 1 + getCategoryDepth(categories, cat.parentId);
}

/**
 * Get breadcrumb path array from root down to category
 */
export function getCategoryPath(categories: Category[], categoryId: string): Category[] {
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return [];
  if (!cat.parentId) return [cat];
  return [...getCategoryPath(categories, cat.parentId), cat];
}

/**
 * Find root ancestor category
 */
export function getRootCategory(categories: Category[], categoryId: string): Category | null {
  const path = getCategoryPath(categories, categoryId);
  return path.length > 0 ? path[0] : null;
}

/**
 * Check if a category and all its ancestors are Active
 */
export function isCategoryActiveInHierarchy(categories: Category[], categoryIdentifier: string): boolean {
  if (!categoryIdentifier) return true;
  // Match by ID or Name
  const cat = categories.find((c) => c.id === categoryIdentifier || c.name.toLowerCase() === categoryIdentifier.toLowerCase());
  if (!cat) return true; // default active if unknown
  if (cat.status === 'Inactive') return false;
  if (cat.parentId) {
    return isCategoryActiveInHierarchy(categories, cat.parentId);
  }
  return true;
}

/**
 * Validate uniqueness of category name at its parent level
 */
export function validateCategoryUniqueness(
  categories: Category[],
  name: string,
  parentId: string | null = null,
  excludeCategoryId?: string
): { isValid: boolean; errorMessage?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { isValid: false, errorMessage: 'Category name cannot be empty.' };
  }

  const siblings = categories.filter(
    (c) => (c.parentId || null) === (parentId || null) && c.id !== excludeCategoryId
  );

  const duplicate = siblings.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
  if (duplicate) {
    const levelName = parentId ? 'within this parent category' : 'at top-level';
    return {
      isValid: false,
      errorMessage: `A category named "${trimmed}" already exists ${levelName}.`,
    };
  }

  return { isValid: true };
}

/**
 * Check if a product is affected by an inactive category
 */
export function isProductInInactiveCategory(product: Product, categories: Category[]): boolean {
  if (!product.category) return false;
  const isCatActive = isCategoryActiveInHierarchy(categories, product.category);
  if (!isCatActive) return true;
  if (product.subcategoryId) {
    const isSubActive = isCategoryActiveInHierarchy(categories, product.subcategoryId);
    if (!isSubActive) return true;
  }
  return false;
}

/**
 * Generate clean URL-safe slug from category name
 */
export function generateCategorySlug(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export interface SlugResolutionResult {
  category: Category;
  isRedirect: boolean;
  primarySlug: string;
  matchedSlug: string;
}

/**
 * Find category by primary slug or historical redirect slug
 */
export function findCategoryBySlugOrRedirect(
  categories: Category[],
  targetSlug: string
): SlugResolutionResult | null {
  if (!targetSlug) return null;
  const cleanTarget = targetSlug.toLowerCase().trim().replace(/^\/+|\/+$/g, '');

  // 1. Check primary slug match first
  const primaryMatch = categories.find((c) => (c.slug || '').toLowerCase() === cleanTarget);
  if (primaryMatch) {
    return {
      category: primaryMatch,
      isRedirect: false,
      primarySlug: primaryMatch.slug,
      matchedSlug: primaryMatch.slug,
    };
  }

  // 2. Check previous/historical slugs for redirect
  const redirectMatch = categories.find((c) =>
    (c.previousSlugs || []).some((ps) => ps.toLowerCase() === cleanTarget)
  );

  if (redirectMatch) {
    return {
      category: redirectMatch,
      isRedirect: true,
      primarySlug: redirectMatch.slug,
      matchedSlug: cleanTarget,
    };
  }

  return null;
}

export interface CategoryRedirectMapping {
  categoryId: string;
  categoryName: string;
  oldSlug: string;
  currentSlug: string;
  status: 'Active' | 'Inactive';
}

/**
 * Get all active redirect mappings across all categories
 */
export function getAllCategoryRedirectMappings(categories: Category[]): CategoryRedirectMapping[] {
  const mappings: CategoryRedirectMapping[] = [];

  categories.forEach((cat) => {
    if (cat.previousSlugs && Array.isArray(cat.previousSlugs)) {
      cat.previousSlugs.forEach((oldSlug) => {
        if (oldSlug && oldSlug !== cat.slug) {
          mappings.push({
            categoryId: cat.id,
            categoryName: cat.name,
            oldSlug,
            currentSlug: cat.slug,
            status: cat.status,
          });
        }
      });
    }
  });

  return mappings;
}

/**
 * Remove a historical slug redirect mapping from a category
 */
export function removePreviousSlugRedirect(
  categories: Category[],
  categoryId: string,
  slugToRemove: string
): Category[] {
  return categories.map((cat) => {
    if (cat.id === categoryId && cat.previousSlugs) {
      return {
        ...cat,
        previousSlugs: cat.previousSlugs.filter((s) => s.toLowerCase() !== slugToRemove.toLowerCase()),
        updatedAt: new Date().toISOString(),
      };
    }
    return cat;
  });
}

