/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, BlogPost, Order, InventoryAuditLog, CouponItem, AffiliateProduct } from './types';

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_BLOGS: BlogPost[] = [];

export const INITIAL_ORDERS: Order[] = [];

export const COUPONS: Record<string, CouponItem> = {};

/**
 * Checks if a coupon date string or coupon item has passed the current time.
 */
export function isCouponExpired(couponOrExpiry?: string | number | CouponItem): boolean {
  if (!couponOrExpiry) return false;
  if (typeof couponOrExpiry === 'number') return false;
  const expiryDate = typeof couponOrExpiry === 'string' ? couponOrExpiry : couponOrExpiry.expiryDate;
  if (!expiryDate) return false;
  try {
    const expiry = new Date(expiryDate);
    if (isNaN(expiry.getTime())) return false;
    // If only YYYY-MM-DD was provided, allow until 23:59:59.999 of that day
    if (expiryDate.length === 10) {
      expiry.setHours(23, 59, 59, 999);
    }
    return Date.now() > expiry.getTime();
  } catch {
    return false;
  }
}

/**
 * Checks if a coupon is active (not manually disabled and not expired).
 */
export function isCouponActive(coupon: number | CouponItem | undefined): boolean {
  if (coupon === undefined || coupon === null) return false;
  if (typeof coupon === 'number') return true;
  if (coupon.active === false || coupon.isActive === false) return false;
  if (isCouponExpired(coupon)) return false;
  return true;
}

/**
 * Checks if a coupon was manually toggled off/disabled by an administrator.
 */
export function isCouponManuallyDisabled(coupon: number | CouponItem | undefined): boolean {
  if (coupon === undefined || coupon === null) return false;
  if (typeof coupon === 'number') return false;
  return coupon.active === false || coupon.isActive === false;
}

/**
 * Extracts percentage number from numeric or object coupon.
 */
export function getCouponPercent(coupon: number | CouponItem | undefined): number {
  if (coupon === undefined || coupon === null) return 0;
  if (typeof coupon === 'number') return coupon;
  return typeof coupon.percent === 'number' ? coupon.percent : 0;
}

/**
 * Extracts expiryDate string from numeric or object coupon.
 */
export function getCouponExpiry(coupon: number | CouponItem | undefined): string | undefined {
  if (coupon === undefined || coupon === null || typeof coupon === 'number') return undefined;
  return coupon.expiryDate;
}

/**
 * Formats expiry date for readable UI display.
 */
export function formatCouponExpiry(expiryDate?: string): string {
  if (!expiryDate) return 'No expiry';
  try {
    const d = new Date(expiryDate);
    if (isNaN(d.getTime())) return expiryDate;
    return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return expiryDate;
  }
}

export const INITIAL_AUDIT_LOGS: InventoryAuditLog[] = [];

export const INITIAL_AFFILIATE_PRODUCTS: AffiliateProduct[] = [];

