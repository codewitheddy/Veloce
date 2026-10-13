/**
 * Google Analytics 4 (GA4) Analytics Integration
 * Measurement ID: G-XY15BE6DS1
 * 
 * Safe helper checking window.gtag exists before calling it so nothing breaks
 * if an ad blocker or privacy extension stops the script.
 * 
 * Strict Privacy Guidelines:
 * - Storefront pages and user actions only (admin actions/pages are completely excluded).
 * - No Personal Identifiable Information (PII) such as customer names, phone numbers,
 *   emails, or delivery addresses are ever passed to GA4.
 * - Standardized currency "KES" used across all events.
 */

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

export const GA_MEASUREMENT_ID = 'G-XY15BE6DS1';
export const GA_CURRENCY = 'KES';

/**
 * Generic safe event dispatcher.
 * Checks window.gtag exists before invocation.
 */
export function trackEvent(name: string, params: Record<string, any> = {}): void {
  if (typeof window === 'undefined') return;

  // Safeguard: Never track administrative operations or console paths
  if (window.location.pathname.startsWith('/admin')) {
    return;
  }

  if (typeof window.gtag === 'function') {
    try {
      window.gtag('event', name, params);
    } catch (err) {
      console.warn('[GA4] Event dispatch notice:', name, err);
    }
  }
}

/**
 * SPA Page View tracking event
 */
export function trackPageView(page_path?: string, page_title?: string, page_location?: string): void {
  if (typeof window === 'undefined') return;

  // Never track admin pages
  if (window.location.pathname.startsWith('/admin')) {
    return;
  }

  const path = page_path || (window.location.pathname + window.location.search);
  const location = page_location || window.location.href;
  const title = page_title || (typeof document !== 'undefined' ? document.title : '');

  trackEvent('page_view', {
    page_path: path,
    page_location: location,
    page_title: title,
  });
}

export interface GA4Item {
  item_id: string;
  item_name: string;
  price?: number;
  quantity?: number;
  item_category?: string;
  item_variant?: string;
  currency?: string;
  index?: number;
}

/**
 * Formats product details to standard GA4 item object without PII
 */
export function formatProductToGA4Item(
  product: { id: string | number; name: string; price?: number | string; category?: string },
  quantity = 1,
  selectedVars?: Record<string, string>,
  index?: number
): GA4Item {
  const item: GA4Item = {
    item_id: String(product.id),
    item_name: product.name,
    price: Number(product.price) || 0,
    quantity: quantity > 0 ? quantity : 1,
    currency: GA_CURRENCY,
  };

  if (product.category) {
    item.item_category = product.category;
  }

  if (selectedVars && Object.keys(selectedVars).length > 0) {
    item.item_variant = Object.entries(selectedVars)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
  }

  if (typeof index === 'number') {
    item.index = index;
  }

  return item;
}

/**
 * 1. view_item_list (Product listing pages / collections)
 */
export function trackViewItemList(
  products: Array<{ id: string | number; name: string; price?: number | string; category?: string }>,
  listName = 'Catalog',
  listId = 'store_catalog'
): void {
  if (!products || products.length === 0) return;

  trackEvent('view_item_list', {
    item_list_name: listName,
    item_list_id: listId,
    items: products.slice(0, 30).map((p, idx) => formatProductToGA4Item(p, 1, undefined, idx + 1)),
  });
}

/**
 * 2. view_item (Product detail pages)
 */
export function trackViewItem(
  product: { id: string | number; name: string; price?: number | string; category?: string },
  selectedVars?: Record<string, string>
): void {
  if (!product) return;

  const price = Number(product.price) || 0;
  trackEvent('view_item', {
    currency: GA_CURRENCY,
    value: price,
    items: [formatProductToGA4Item(product, 1, selectedVars)],
  });
}

/**
 * 3. add_to_cart
 */
export function trackAddToCart(
  product: { id: string | number; name: string; price?: number | string; category?: string },
  quantity = 1,
  selectedVars?: Record<string, string>
): void {
  if (!product) return;

  const qty = quantity > 0 ? quantity : 1;
  const price = Number(product.price) || 0;
  trackEvent('add_to_cart', {
    currency: GA_CURRENCY,
    value: price * qty,
    items: [formatProductToGA4Item(product, qty, selectedVars)],
  });
}

/**
 * 4. remove_from_cart
 */
export function trackRemoveFromCart(
  product: { id: string | number; name: string; price?: number | string; category?: string },
  quantity = 1,
  selectedVars?: Record<string, string>
): void {
  if (!product) return;

  const qty = quantity > 0 ? quantity : 1;
  const price = Number(product.price) || 0;
  trackEvent('remove_from_cart', {
    currency: GA_CURRENCY,
    value: price * qty,
    items: [formatProductToGA4Item(product, qty, selectedVars)],
  });
}

/**
 * 5. view_cart
 */
export function trackViewCart(
  cartItems: Array<{
    product: { id: string | number; name: string; price?: number | string; category?: string };
    quantity: number;
    selectedVariations?: Record<string, string>;
  }>,
  totalValue?: number
): void {
  if (!cartItems || cartItems.length === 0) return;

  const items = cartItems.map((ci) => formatProductToGA4Item(ci.product, ci.quantity, ci.selectedVariations));
  const calculatedTotal = cartItems.reduce((acc, ci) => acc + (Number(ci.product.price) || 0) * ci.quantity, 0);

  trackEvent('view_cart', {
    currency: GA_CURRENCY,
    value: totalValue !== undefined ? Number(totalValue) : calculatedTotal,
    items,
  });
}

/**
 * 6. begin_checkout
 */
export function trackBeginCheckout(
  cartItems: Array<{
    product: { id: string | number; name: string; price?: number | string; category?: string };
    quantity: number;
    selectedVariations?: Record<string, string>;
  }>,
  totalValue?: number
): void {
  if (!cartItems || cartItems.length === 0) return;

  const items = cartItems.map((ci) => formatProductToGA4Item(ci.product, ci.quantity, ci.selectedVariations));
  const calculatedTotal = cartItems.reduce((acc, ci) => acc + (Number(ci.product.price) || 0) * ci.quantity, 0);

  trackEvent('begin_checkout', {
    currency: GA_CURRENCY,
    value: totalValue !== undefined ? Number(totalValue) : calculatedTotal,
    items,
  });
}

/**
 * 7. add_payment_info
 * Fired when the payment method is selected (e.g. M-Pesa or Cash on Delivery)
 */
export function trackAddPaymentInfo(
  cartItems: Array<{
    product: { id: string | number; name: string; price?: number | string; category?: string };
    quantity: number;
    selectedVariations?: Record<string, string>;
  }>,
  totalValue: number,
  paymentType: 'M-Pesa' | 'Cash on Delivery' | string
): void {
  const items = (cartItems || []).map((ci) => formatProductToGA4Item(ci.product, ci.quantity, ci.selectedVariations));

  trackEvent('add_payment_info', {
    currency: GA_CURRENCY,
    value: Number(totalValue) || 0,
    payment_type: paymentType,
    items,
  });
}

/**
 * 8. purchase
 * Fires once per order on the order confirmation step.
 * Guarded with sessionStorage to strictly avoid duplicate firing on page reload.
 * No customer name, email, phone, or address is transmitted.
 */
const GA4_TRACKED_PURCHASES_KEY = 'ga4_purchases_tracked';

function getTrackedPurchases(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(GA4_TRACKED_PURCHASES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function recordPurchaseTracked(orderId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getTrackedPurchases();
    if (!list.includes(orderId)) {
      list.push(orderId);
      sessionStorage.setItem(GA4_TRACKED_PURCHASES_KEY, JSON.stringify(list));
    }
  } catch {}
}

export function isPurchaseTracked(orderId: string | number): boolean {
  return getTrackedPurchases().includes(String(orderId));
}

export function trackPurchase(order: {
  id: string | number;
  total: number;
  tax?: number;
  deliveryFee?: number;
  couponCode?: string;
  items: Array<{
    product: { id: string | number; name: string; price?: number | string; category?: string };
    quantity: number;
    selectedVariations?: Record<string, string>;
  }>;
}): boolean {
  if (!order || !order.id) return false;
  const orderIdStr = String(order.id);

  // Guard against duplicate firing on page refresh
  if (isPurchaseTracked(orderIdStr)) {
    return false;
  }

  const items = (order.items || []).map((ci) => ({
    item_id: String(ci.product.id),
    item_name: ci.product.name,
    price: Number(ci.product.price) || 0,
    quantity: ci.quantity,
    item_category: ci.product.category || undefined,
  }));

  trackEvent('purchase', {
    transaction_id: orderIdStr,
    value: Number(order.total) || 0,
    currency: GA_CURRENCY,
    tax: order.tax !== undefined ? Number(order.tax) : undefined,
    shipping: order.deliveryFee !== undefined ? Number(order.deliveryFee) : undefined,
    coupon: order.couponCode || undefined,
    items,
  });

  recordPurchaseTracked(orderIdStr);
  return true;
}
