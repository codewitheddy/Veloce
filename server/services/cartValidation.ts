/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadProductsCache, normalizeProductVariants } from '../routes/products';
import { getSqliteSiteSettings } from '../../src/lib/sqlite-db';

export interface CartValidationItemInput {
  productId: string;
  variantId?: string;
  selectedVariations?: Record<string, any>;
  quantity: number;
  clientPrice?: number;
  price?: number;
  name?: string;
}

export type CartChangeType =
  | 'PRICE_CHANGED'
  | 'OUT_OF_STOCK'
  | 'QUANTITY_ADJUSTED'
  | 'COUPON_INVALID'
  | 'PRODUCT_REMOVED'
  | 'DETAILS_UPDATED';

export interface CartItemChange {
  type: CartChangeType;
  productId: string;
  productName: string;
  oldValue?: any;
  newValue?: any;
  message: string;
}

export interface ValidatedCartItem {
  productId: string;
  variantId?: string;
  selectedVariations: Record<string, string>;
  name: string;
  sku: string;
  price: number;
  originalPrice?: number | null;
  imageUrl: string;
  quantity: number;
  stockAvailable: number | null;
  stock: number;
  lineSubtotal: number;
  lineTotal: number;
  isOutOfStock: boolean;
  isAvailable: boolean;
  stockStatus: 'in_stock' | 'out_of_stock' | 'backorder';
  status: string;
  type: 'physical' | 'digital' | 'service';
}

export interface CartValidationResult {
  valid: boolean;
  hasConflict: boolean;
  items: ValidatedCartItem[];
  outOfStockItems: ValidatedCartItem[];
  subtotal: number;
  discount: number;
  discountAmount: number;
  total: number;
  couponCode?: string;
  isCouponValid?: boolean;
  couponDiscountPercent?: number;
  appliedCoupon?: {
    code: string;
    discountType: string;
    discountValue: number;
    discountAmount: number;
  } | null;
  volumeDiscountApplied?: boolean;
  volumeDiscountAmount?: number;
  changes: CartItemChange[];
  validatedAt: string;
}

/**
 * Calculates effective unit price for a product/variant
 */
function resolveEffectivePrice(product: any, selectedVars?: Record<string, string>): { price: number; originalPrice: number | null } {
  const norm = normalizeProductVariants(product);
  let basePrice = Number(norm.price || 0);
  let originalPrice = norm.original_price ? Number(norm.original_price) : (norm.originalPrice ? Number(norm.originalPrice) : null);

  // Check if variant price override exists
  if (selectedVars && Object.keys(selectedVars).length > 0 && Array.isArray(norm.variants)) {
    const matched = norm.variants.find((v: any) => {
      if (!v.attributes) return false;
      const vKeys = Object.keys(v.attributes);
      const sKeys = Object.keys(selectedVars);
      if (vKeys.length !== sKeys.length) return false;
      return vKeys.every(k => (v.attributes[k] || '').toLowerCase() === (selectedVars[k] || '').toLowerCase());
    });

    if (matched && matched.price !== undefined && matched.price !== null && !isNaN(Number(matched.price))) {
      basePrice = Number(matched.price);
    }
  }

  return { price: basePrice, originalPrice };
}

/**
 * Resolves stock available for a product or variant
 */
function resolveAvailableStock(product: any, selectedVars?: Record<string, string>): number | null {
  const norm = normalizeProductVariants(product);
  
  if (selectedVars && Object.keys(selectedVars).length > 0 && Array.isArray(norm.variants)) {
    const matched = norm.variants.find((v: any) => {
      if (!v.attributes) return false;
      const vKeys = Object.keys(v.attributes);
      const sKeys = Object.keys(selectedVars);
      if (vKeys.length !== sKeys.length) return false;
      return vKeys.every(k => (v.attributes[k] || '').toLowerCase() === (selectedVars[k] || '').toLowerCase());
    });

    if (matched && matched.stockQty !== undefined && matched.stockQty !== null) {
      return Math.max(0, Number(matched.stockQty));
    }
  }

  if (norm.stock !== undefined && norm.stock !== null) {
    return Math.max(0, Number(norm.stock));
  }

  return null; // Unlimited stock
}

/**
 * Server-Side Cart Validator:
 * Pulls authoritative store database products, ignores client-sent prices,
 * recalculates exact totals, and identifies all state deviations.
 */
export async function validateCart(
  cartItemsOrOptions: CartValidationItemInput[] | {
    items?: CartValidationItemInput[];
    couponCode?: string;
    expectedTotal?: number;
    clientTotal?: number;
  },
  couponCodeParam?: string,
  clientTotalParam?: number
): Promise<CartValidationResult> {
  let cartItems: CartValidationItemInput[] = [];
  let couponCode = couponCodeParam;
  let clientTotal = clientTotalParam;

  if (Array.isArray(cartItemsOrOptions)) {
    cartItems = cartItemsOrOptions;
  } else if (cartItemsOrOptions && typeof cartItemsOrOptions === 'object') {
    cartItems = Array.isArray(cartItemsOrOptions.items) ? cartItemsOrOptions.items : [];
    couponCode = cartItemsOrOptions.couponCode || couponCodeParam;
    clientTotal = cartItemsOrOptions.expectedTotal ?? cartItemsOrOptions.clientTotal ?? clientTotalParam;
  }

  const allProducts = await loadProductsCache(true);
  const productMap = new Map<string, any>();
  for (const p of allProducts) {
    if (p.id) productMap.set(String(p.id).trim(), p);
    if (p.sku) productMap.set(String(p.sku).trim().toLowerCase(), p);
  }

  const changes: CartItemChange[] = [];
  const validItems: ValidatedCartItem[] = [];
  const outOfStockItems: ValidatedCartItem[] = [];

  for (const item of cartItems) {
    const rawProductId = String(item.productId || '').trim();
    let product = productMap.get(rawProductId);
    if (!product && item.name) {
      const cleanItemName = item.name.trim().toLowerCase();
      product = allProducts.find(p => p.name && p.name.trim().toLowerCase() === cleanItemName);
    }
    const productId = product ? String(product.id) : rawProductId;

    // 1. Check if product exists and is active
    const prodStatus = (product?.status || '').toLowerCase();
    const isInactive = !product || prodStatus === 'archived' || prodStatus === 'draft' || prodStatus === 'unpublished' || prodStatus === 'deleted';

    if (isInactive) {
      changes.push({
        type: 'PRODUCT_REMOVED',
        productId,
        productName: item.name || product?.name || 'Product',
        message: `"${item.name || product?.name || 'Item'}" is no longer available and was removed from your cart.`,
      });
      continue;
    }

    const selectedVars = (item.selectedVariations || {}) as Record<string, string>;
    const { price: currentPrice, originalPrice } = resolveEffectivePrice(product, selectedVars);
    const availableStock = resolveAvailableStock(product, selectedVars);
    const requestedQty = Math.max(1, Number(item.quantity || 1));
    const isOutOfStock = availableStock !== null && availableStock <= 0;

    // 2. Check Out of Stock
    if (isOutOfStock) {
      changes.push({
        type: 'OUT_OF_STOCK',
        productId,
        productName: product.name,
        oldValue: requestedQty,
        newValue: 0,
        message: `"${product.name}" is now out of stock and has been removed from your order.`,
      });

      outOfStockItems.push({
        productId,
        variantId: item.variantId,
        selectedVariations: selectedVars,
        name: product.name,
        sku: product.sku || '',
        price: currentPrice,
        originalPrice,
        imageUrl: product.imageUrl || product.image_url || '',
        quantity: 0,
        stockAvailable: 0,
        stock: 0,
        lineSubtotal: 0,
        lineTotal: 0,
        isOutOfStock: true,
        isAvailable: false,
        stockStatus: 'out_of_stock',
        status: product.status || 'Active',
        type: product.type || 'physical',
      });
      continue;
    }

    // 3. Check Quantity Adjustment (Partial Stock)
    let finalQty = requestedQty;
    if (availableStock !== null && requestedQty > availableStock) {
      finalQty = availableStock;
      changes.push({
        type: 'QUANTITY_ADJUSTED',
        productId,
        productName: product.name,
        oldValue: requestedQty,
        newValue: availableStock,
        message: `Only ${availableStock} of "${product.name}" left. We've adjusted your quantity.`,
      });
    }

    // 4. Check Price Change
    const clientPriceVal = item.clientPrice !== undefined ? item.clientPrice : item.price;
    if (clientPriceVal !== undefined && clientPriceVal !== null) {
      const clientP = Number(clientPriceVal);
      if (Math.abs(clientP - currentPrice) > 0.01) {
        changes.push({
          type: 'PRICE_CHANGED',
          productId,
          productName: product.name,
          oldValue: clientP,
          newValue: currentPrice,
          message: `Price updated: "${product.name}" changed from KES ${clientP.toLocaleString('en-KE')} to KES ${currentPrice.toLocaleString('en-KE')}.`,
        });
      }
    }

    // 5. Details updated (Name / Image)
    if (item.name && item.name !== product.name) {
      changes.push({
        type: 'DETAILS_UPDATED',
        productId,
        productName: product.name,
        oldValue: item.name,
        newValue: product.name,
        message: `Details updated for "${product.name}".`,
      });
    }

    const lineCost = currentPrice * finalQty;
    validItems.push({
      productId,
      variantId: item.variantId,
      selectedVariations: selectedVars,
      name: product.name,
      sku: product.sku || '',
      price: currentPrice,
      originalPrice,
      imageUrl: product.imageUrl || product.image_url || '',
      quantity: finalQty,
      stockAvailable: availableStock,
      stock: availableStock ?? 999,
      lineSubtotal: lineCost,
      lineTotal: lineCost,
      isOutOfStock: false,
      isAvailable: true,
      stockStatus: availableStock !== null && availableStock <= 0 ? 'out_of_stock' : 'in_stock',
      status: product.status || 'Active',
      type: product.type || 'physical',
    });
  }

  // Calculate Subtotal
  const grossSubtotal = validItems.reduce((sum, i) => sum + i.lineSubtotal, 0);

  // Automatic Volume / Threshold Discount (15% for orders >= KSh 15,000 or items >= 6 units)
  let automaticDiscount = 0;
  const hasBulkUnits = validItems.some(i => i.quantity >= 6);
  if (grossSubtotal >= 15000 || hasBulkUnits) {
    automaticDiscount = Math.round(grossSubtotal * 0.15);
  }

  // Coupon Validation
  let couponDiscount = 0;
  let isCouponValid = false;
  let couponDiscountPercent = 0;
  let appliedCouponData = null;

  if (couponCode && couponCode.trim()) {
    const cleanCode = couponCode.trim().toUpperCase();
    const VALID_COUPONS: Record<string, { percent: number; minSpend?: number }> = {
      'SAVE15': { percent: 15 },
      'WELCOME10': { percent: 10 },
      'VELOCE20': { percent: 20, minSpend: 5000 },
      'FLASH25': { percent: 25, minSpend: 10000 },
    };

    const couponDef = VALID_COUPONS[cleanCode];
    if (couponDef && (!couponDef.minSpend || grossSubtotal >= couponDef.minSpend)) {
      isCouponValid = true;
      couponDiscountPercent = couponDef.percent;
      couponDiscount = Math.round((grossSubtotal - automaticDiscount) * (couponDef.percent / 100));
      appliedCouponData = {
        code: cleanCode,
        discountType: 'percentage',
        discountValue: couponDef.percent,
        discountAmount: couponDiscount,
      };
    } else {
      changes.push({
        type: 'COUPON_INVALID',
        productId: 'coupon',
        productName: `Coupon ${cleanCode}`,
        oldValue: cleanCode,
        newValue: null,
        message: `Your discount "${cleanCode}" is no longer valid.`,
      });
    }
  }

  const totalDiscount = automaticDiscount + couponDiscount;
  const finalTotal = Math.max(0, grossSubtotal - totalDiscount);

  // If client sent an expected total that differs from server calculation -> Conflict
  if (clientTotal !== undefined && clientTotal !== null && !isNaN(Number(clientTotal))) {
    if (Math.abs(Number(clientTotal) - finalTotal) > 0.01) {
      const hasPriceOrQtyChange = changes.some(c => c.type === 'PRICE_CHANGED' || c.type === 'QUANTITY_ADJUSTED' || c.type === 'OUT_OF_STOCK');
      if (!hasPriceOrQtyChange) {
        changes.push({
          type: 'PRICE_CHANGED',
          productId: 'total',
          productName: 'Order Total',
          oldValue: clientTotal,
          newValue: finalTotal,
          message: `Your order total was recalculated from KES ${Number(clientTotal).toLocaleString('en-KE')} to KES ${finalTotal.toLocaleString('en-KE')}.`,
        });
      }
    }
  }

  const isValid = changes.length === 0;

  return {
    valid: isValid,
    hasConflict: changes.length > 0,
    items: validItems,
    outOfStockItems,
    subtotal: grossSubtotal,
    discount: totalDiscount,
    discountAmount: totalDiscount,
    total: finalTotal,
    couponCode: isCouponValid ? couponCode : undefined,
    isCouponValid,
    couponDiscountPercent,
    appliedCoupon: appliedCouponData,
    volumeDiscountApplied: automaticDiscount > 0,
    volumeDiscountAmount: automaticDiscount,
    changes,
    validatedAt: new Date().toISOString(),
  };
}
