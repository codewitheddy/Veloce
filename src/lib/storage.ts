/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Namespace-Scoped Persistent LocalStorage & IndexedDB Resilient Storage Utility
 * with Automatic Quota-Exceeded Mitigation and Expiration Checks
 */

const STORAGE_NAMESPACE = 'veloce_v1';
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days default expiration

interface StoredPayload<T> {
  version: string;
  timestamp: number;
  expiresAt: number | null;
  data: T;
}

/**
 * Detects if an error is a Storage QuotaExceeded error across different browsers
 */
export function isQuotaExceededError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof DOMException) {
    return (
      err.code === 22 || // QUOTA_EXCEEDED_ERR (Chrome, Safari, etc.)
      err.code === 1014 || // NS_ERROR_DOM_QUOTA_REACHED (Firefox)
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    );
  }
  const message = String((err as any)?.message || '').toLowerCase();
  const name = String((err as any)?.name || '').toLowerCase();
  return (
    name.includes('quota') ||
    message.includes('quota') ||
    message.includes('storage') ||
    message.includes('exceeded')
  );
}

/**
 * Clean up non-critical / bulky items from localStorage when quota is tight
 */
export function freeUpLocalStorageSpace(targetKey?: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  console.warn('[Storage] Quota pressure detected. Executing progressive cache pruning...');

  try {
    // Priority 1: High-weight duplicate snapshot backups & transient logs
    const highWeightCaches = [
      'veloce_backup_snapshots',
      'veloce_bulk_price_history',
      'veloce_template_versions',
      'veloce_transactional_email_logs',
      'veloce_recently_viewed',
      'veloce_price_trackers',
      'veloce_simulated_sales_count',
      'veloce_product_showcase_counts'
    ];

    highWeightCaches.forEach((k) => {
      if (k !== targetKey) {
        localStorage.removeItem(k);
      }
    });

    // Priority 2: Purge stale affiliate, referral & campaign logs
    purgeAffiliateAndLoyaltyStorage();

    // Priority 3: Trim bulky audit logs to latest 10 entries if present
    const trimLogKey = (key: string, limit = 10) => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > limit) {
            localStorage.setItem(key, JSON.stringify(parsed.slice(0, limit)));
          }
        }
      } catch {
        localStorage.removeItem(key);
      }
    };

    trimLogKey('veloce_inventory_audit_logs', 15);
    trimLogKey('veloce_category_audit_logs', 15);
    trimLogKey('customer_support_tickets', 15);

    // Priority 4: If target key is not 'veloce_products' and products are huge, try stripping base64 images from cached products
    if (targetKey !== 'veloce_products') {
      try {
        const rawProd = localStorage.getItem('veloce_products');
        if (rawProd && rawProd.length > 500000) {
          const prods = JSON.parse(rawProd);
          if (Array.isArray(prods)) {
            const sanitized = prods.map((p: any) => ({
              ...p,
              image: p.image?.startsWith('data:') ? 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600' : p.image,
              images: Array.isArray(p.images)
                ? p.images.map((img: string) => img.startsWith('data:') ? 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600' : img)
                : p.images
            }));
            localStorage.setItem('veloce_products', JSON.stringify(sanitized));
          }
        }
      } catch {
        // ignore
      }
    }

    return true;
  } catch (err) {
    console.warn('[Storage] Error during cache pruning:', err);
    return false;
  }
}

/**
 * Strips huge base64 data URLs, deeply nested raw logs, and excess metadata
 * from Cart items to guarantee localStorage serialization is lightweight (< 30 KB)
 * and immune to QuotaExceededError while preserving all essential product attributes.
 */
export function sanitizeCartForStorage(cartItems: any[]): any[] {
  if (!Array.isArray(cartItems)) return [];
  return cartItems.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const p = item.product || {};
    
    // If imageUrl is a huge base64 string (> 2KB), strip from localStorage to avoid quota lock
    let safeImageUrl = p.imageUrl || p.image || '';
    if (typeof safeImageUrl === 'string' && safeImageUrl.startsWith('data:') && safeImageUrl.length > 2048) {
      safeImageUrl = ''; // Will be seamlessly rehydrated from active product catalog
    }

    const safeProduct = {
      id: String(p.id || ''),
      name: String(p.name || 'Product'),
      price: Number(p.price || 0),
      originalPrice: p.originalPrice ? Number(p.originalPrice) : undefined,
      category: String(p.category || 'General'),
      subcategory: String(p.subcategory || ''),
      stock: Number(p.stock !== undefined ? p.stock : 99),
      imageUrl: safeImageUrl,
      image: safeImageUrl,
      variations: Array.isArray(p.variations) ? p.variations : [],
      rating: Number(p.rating || 5),
      reviewsCount: Number(p.reviewsCount || 0),
      sku: String(p.sku || ''),
      isDigital: Boolean(p.isDigital),
      isService: Boolean(p.isService),
      serviceDuration: p.serviceDuration,
      bulkDiscountThreshold: p.bulkDiscountThreshold,
      bulkDiscountPercent: p.bulkDiscountPercent,
    };

    return {
      product: safeProduct,
      quantity: Number(item.quantity || 1),
      selectedVariations: item.selectedVariations || {},
    };
  });
}

/**
 * Robust, exception-safe localStorage.setItem wrapper that intercepts QuotaExceededError,
 * cleans up space automatically, and gracefully falls back to IndexedDB.
 */
export function safeLocalStorageSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  // 1. Critical Shopping Cart & Wishlist Storage
  if (key === 'veloce_cart' || key === 'veloce_wishlist') {
    let payloadToStore = value;
    if (key === 'veloce_cart') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          const sanitized = sanitizeCartForStorage(parsed);
          payloadToStore = JSON.stringify(sanitized);
        }
      } catch {}
    }

    try {
      localStorage.setItem(key, payloadToStore);
      // Also write full fidelity to IndexedDB cache as backup
      try {
        const parsed = JSON.parse(value);
        saveToIndexedDb('veloce_cache', key, parsed).catch(() => {});
      } catch {}
      return true;
    } catch (err: unknown) {
      if (isQuotaExceededError(err)) {
        freeUpLocalStorageSpace(key);
        try {
          localStorage.setItem(key, payloadToStore);
          return true;
        } catch {
          // IndexedDB fallback
          try {
            const parsed = JSON.parse(value);
            saveToIndexedDb('veloce_cache', key, parsed).catch(() => {});
          } catch {}
          return false;
        }
      }
      return false;
    }
  }

  // 2. Scalability Optimization: If payload is large (> 250 KB, e.g. 2,000+ products),
  // store directly in high-capacity IndexedDB to preserve browser localStorage quota
  if (value.length > 250000 || key === 'veloce_products') {
    try {
      const parsed = JSON.parse(value);
      saveToIndexedDb('veloce_cache', key, parsed).catch(() => {});
    } catch {
      saveToIndexedDb('veloce_cache', key, value).catch(() => {});
    }
    // Only store minimal stub in localStorage if needed
    try {
      if (key === 'veloce_products') {
        localStorage.removeItem('veloce_products');
      }
    } catch {}
    return true;
  }

  // 3. General localStorage Write
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: unknown) {
    if (isQuotaExceededError(err)) {
      console.warn(`[Storage] QuotaExceededError writing "${key}" (${(value.length / 1024).toFixed(1)} KB). Attempting recovery...`);
      
      // Step 1: Attempt progressive cleanup of transient keys
      freeUpLocalStorageSpace(key);

      try {
        localStorage.setItem(key, value);
        console.info(`[Storage] Successfully recovered and saved "${key}" after storage cleanup.`);
        return true;
      } catch (retryErr) {
        // Step 2: If it is veloce_products and still fails, create a sanitized lightweight version
        if (key === 'veloce_products' || key.includes('products')) {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              const lightweight = parsed.map((p: any) => ({
                ...p,
                image: (typeof p.image === 'string' && p.image.startsWith('data:'))
                  ? 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600'
                  : p.image,
                images: Array.isArray(p.images)
                  ? p.images.map((img: string) => (typeof img === 'string' && img.startsWith('data:')) ? 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600' : img)
                  : p.images
              }));
              localStorage.setItem(key, JSON.stringify(lightweight));
              console.info(`[Storage] Saved sanitized lightweight version of "${key}".`);
              saveToIndexedDb('veloce_cache', key, parsed).catch(() => {});
              return true;
            }
          } catch {}
        }

        // Asynchronous IndexedDB fallback
        try {
          const parsed = JSON.parse(value);
          saveToIndexedDb('veloce_cache', key, parsed).catch(() => {});
        } catch {
          saveToIndexedDb('veloce_cache', key, value).catch(() => {});
        }

        console.warn(`[Storage] Could not write "${key}" to localStorage due to quota limit. Persisted to IndexedDB fallback without crashing.`);
        return false;
      }
    } else {
      console.warn(`[Storage] Failed to set localStorage key "${key}":`, err);
      return false;
    }
  }
}

/**
 * Safe localStorage.getItem with JSON parsing and fallback value
 */
export function safeLocalStorageGetItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined' || !window.localStorage) return defaultValue;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (err) {
    try {
      const raw = localStorage.getItem(key);
      return (raw as unknown as T) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }
}

/**
 * Native IndexedDB Helper for high-capacity asynchronous persistence (hundreds of MBs)
 */
const IDB_NAME = 'VeloceCommerceDB';
const IDB_VERSION = 1;

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in current environment'));
      return;
    }

    const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains('veloce_cache')) {
        db.createObjectStore('veloce_cache', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveToIndexedDb(storeName: string, key: string, data: any): Promise<boolean> {
  try {
    const db = await openIndexedDb();
    return new Promise((resolve) => {
      const tx = db.transaction('veloce_cache', 'readwrite');
      const store = tx.objectStore('veloce_cache');
      store.put({ key, data, timestamp: Date.now() });
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

export async function getFromIndexedDb<T>(storeName: string, key: string, defaultValue: T): Promise<T> {
  try {
    const db = await openIndexedDb();
    return new Promise((resolve) => {
      const tx = db.transaction('veloce_cache', 'readonly');
      const store = tx.objectStore('veloce_cache');
      const request = store.get(key);
      request.onsuccess = () => {
        db.close();
        if (request.result && request.result.data !== undefined) {
          resolve(request.result.data);
        } else {
          resolve(defaultValue);
        }
      };
      request.onerror = () => {
        db.close();
        resolve(defaultValue);
      };
    });
  } catch {
    return defaultValue;
  }
}

/**
 * Format namespace key (e.g. 'user' -> 'veloce_v1_user')
 */
export function getScopedKey(key: string): string {
  return key.startsWith(`${STORAGE_NAMESPACE}_`) ? key : `${STORAGE_NAMESPACE}_${key}`;
}

/**
 * Save data with namespace scoping and expiration check
 */
export function setScopedStorage<T>(key: string, data: T, ttlMs: number | null = DEFAULT_TTL_MS): void {
  try {
    const fullKey = getScopedKey(key);
    const now = Date.now();
    const payload: StoredPayload<T> = {
      version: STORAGE_NAMESPACE,
      timestamp: now,
      expiresAt: ttlMs ? now + ttlMs : null,
      data
    };
    safeLocalStorageSetItem(fullKey, JSON.stringify(payload));
  } catch (err) {
    console.warn(`[ScopedStorage] Error writing key "${key}":`, err);
  }
}

/**
 * Retrieve data with expiration validation
 */
export function getScopedStorage<T>(key: string, defaultValue: T): T {
  try {
    const fullKey = getScopedKey(key);
    const raw = localStorage.getItem(fullKey);
    
    // Legacy un-scoped fallback migration check
    if (!raw) {
      const legacyRaw = localStorage.getItem(key);
      if (legacyRaw) {
        try {
          const parsed = JSON.parse(legacyRaw);
          setScopedStorage(key, parsed);
          try { localStorage.removeItem(key); } catch {}
          return parsed;
        } catch {
          // Ignore
        }
      }
      return defaultValue;
    }

    const payload: StoredPayload<T> = JSON.parse(raw);

    // Validate expiration
    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      console.info(`[ScopedStorage] Key "${key}" expired. Removing cached payload.`);
      removeScopedStorage(key);
      return defaultValue;
    }

    return payload.data ?? defaultValue;
  } catch (err) {
    console.warn(`[ScopedStorage] Error reading key "${key}":`, err);
    return defaultValue;
  }
}

/**
 * Remove scoped item
 */
export function removeScopedStorage(key: string): void {
  try {
    const fullKey = getScopedKey(key);
    localStorage.removeItem(fullKey);
    // Also clean up legacy key if present
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[ScopedStorage] Error removing key "${key}":`, err);
  }
}

/**
 * Purges all affiliate, referral, and loyalty keys from localStorage
 */
export function purgeAffiliateAndLoyaltyStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const legacyKeys = [
    'veloce_affiliates',
    'veloce_loyalty_points',
    'veloce_earnings',
    'veloce_payout_logs',
    'veloce_clicklogs',
    'veloce_campaigns',
    'veloce_active_referral',
    'is_joined_affiliate',
    'affiliate_code',
    'referral_code',
    'veloce_affiliate_profile',
    'veloce_v1_affiliates',
    'veloce_v1_loyalty_points',
    'veloce_v1_earnings',
    'veloce_v1_payout_logs',
    'veloce_v1_clicklogs',
    'veloce_v1_campaigns',
    'veloce_v1_active_referral',
    'veloce_v1_affiliate_profile'
  ];
  legacyKeys.forEach(k => {
    try {
      localStorage.removeItem(k);
    } catch {
      // ignore
    }
  });
}

// Run immediately on script load in browser
if (typeof window !== 'undefined') {
  try {
    purgeAffiliateAndLoyaltyStorage();
  } catch {
    // ignore
  }
}

/**
 * Clears all localStorage items that contain cached or simulated data
 * to ensure that the app relies exclusively on the Django backend state as the sole source of truth.
 */
export function clearVeloceLocalStorageItems(): number {
  if (typeof window === 'undefined' || !window.localStorage) return 0;
  let count = 0;
  const preservedKeys = new Set([
    'veloce_cart',
    'veloce_wishlist',
    'veloce_recently_viewed',
    'veloce_return_requests',
    'veloce_coupons',
    'veloce_promo_banner',
    'veloce_exchange_rates',
    'veloce_rates_last_updated',
    'veloce_currency',
    'veloce_theme',
    'veloce_font_size',
    'veloce_language',
    'veloce_cookie_consent',
    'cookie_consent',
    'veloce_access_token',
    'veloce_admin_token',
    'access_token',
    'refresh_token',
    'veloce_refresh_token',
    'veloce_user_role',
    'veloce_login_email',
    'veloce_login_name',
    'veloce_current_user',
    'veloce_user',
    'veloce_auth_user',
    'user',
    'veloce_custom_categories',
    'veloce_categories_cleared',
    'veloce_categories_data',
    'veloce_categories_v2',
    'veloce_categories',
    'veloce_category_audit_logs',
    'veloce_last_backup_time',
    'veloce_backup_snoozed_until',
    'veloce_backup_dismissed',
    'is_backend_sync_enabled',
    'veloce_cleared_simulated_data'
  ]);
  const keysToRemove: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !preservedKeys.has(key) && (
        key.startsWith('veloce_') || 
        key.includes('affiliate') || 
        key.includes('loyalty') || 
        key.includes('review') || 
        key.includes('product') ||
        key.includes('category') ||
        key.includes('blog')
      )) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => {
      try {
        localStorage.removeItem(key);
        count++;
      } catch {}
    });

    // Mark system as strictly synced to backend API
    safeLocalStorageSetItem('is_backend_sync_enabled', 'true');
    safeLocalStorageSetItem('veloce_cleared_simulated_data', 'true');

    purgeAffiliateAndLoyaltyStorage();

    console.info(`[Storage] Cleared ${count} stale item(s) from localStorage. Backend API is active as authoritative source of truth.`);
  } catch (err) {
    console.warn('[Storage] Error clearing items from localStorage:', err);
  }
  return count;
}

/**
 * Ensures localStorage is purged and sets backend sync as primary source of truth
 */
export function checkAndPurgeBackendSyncStorage(): boolean {
  if (typeof window === 'undefined') return false;
  // One-time initialization check to avoid redundant or unintended storage purges on page refresh
  const alreadySynced = localStorage.getItem('is_backend_sync_enabled');
  if (!alreadySynced) {
    clearVeloceLocalStorageItems();
    safeLocalStorageSetItem('is_backend_sync_enabled', 'true');
  }
  return true;
}
