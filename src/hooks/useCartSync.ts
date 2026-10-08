/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { CartItem } from '../types';

export type CartChangeType =
  | 'PRICE_CHANGED'
  | 'OUT_OF_STOCK'
  | 'QUANTITY_ADJUSTED'
  | 'COUPON_INVALID'
  | 'PRODUCT_REMOVED'
  | 'DETAILS_UPDATED';

export interface CartChangeNotice {
  id: string;
  type: CartChangeType;
  productId?: string;
  productName?: string;
  oldValue?: any;
  newValue?: any;
  message: string;
  timestamp: number;
  acknowledged?: boolean;
}

export interface ValidatedItem {
  productId: string;
  variantId?: string;
  sku?: string;
  name: string;
  imageUrl?: string;
  price: number;
  originalPrice?: number | null;
  stock: number;
  stockStatus: 'in_stock' | 'out_of_stock' | 'backorder';
  quantity: number;
  lineTotal: number;
  isAvailable: boolean;
  selectedVariations?: Record<string, string>;
  detailsChanged?: boolean;
}

export interface ValidationResponse {
  success: boolean;
  valid?: boolean;
  items: ValidatedItem[];
  subtotal: number;
  discount: number;
  total: number;
  volumeDiscountApplied?: boolean;
  volumeDiscountAmount?: number;
  appliedCoupon?: {
    code: string;
    discountType: string;
    discountValue: number;
    discountAmount: number;
  } | null;
  changes: Array<{
    type: CartChangeType;
    productId: string;
    productName: string;
    oldValue: any;
    newValue: any;
    message: string;
  }>;
  hasConflict: boolean;
}

interface UseCartSyncOptions {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  appliedCoupon?: string;
  setAppliedCoupon?: (coupon: string) => void;
  enabled?: boolean;
}

export function useCartSync({
  cart,
  setCart,
  appliedCoupon = '',
  setAppliedCoupon,
  enabled = true,
}: UseCartSyncOptions) {
  const [notices, setNotices] = useState<CartChangeNotice[]>(() => {
    try {
      const saved = sessionStorage.getItem('veloce_cart_notices');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isStreamConnected, setIsStreamConnected] = useState<boolean>(false);
  const [priceHistory, setPriceHistory] = useState<Record<string, { oldPrice: number; newPrice: number }>>({});
  const [stockInfo, setStockInfo] = useState<Record<string, { stock: number; isOutOfStock: boolean; isLowStock: boolean }>>({});
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());

  const eventSourceRef = useRef<EventSource | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackPollRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const cartRef = useRef<CartItem[]>(cart);
  const couponRef = useRef<string>(appliedCoupon);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    couponRef.current = appliedCoupon;
  }, [appliedCoupon]);

  // Persist notices to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('veloce_cart_notices', JSON.stringify(notices));
    } catch {
      // Ignore storage write errors
    }
  }, [notices]);

  const dismissNotice = useCallback((id: string) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAllNotices = useCallback(() => {
    setNotices([]);
  }, []);

  const addNotice = useCallback((change: {
    type: CartChangeType;
    productId?: string;
    productName?: string;
    oldValue?: any;
    newValue?: any;
    message: string;
  }) => {
    const noticeId = `ntf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newNotice: CartChangeNotice = {
      id: noticeId,
      type: change.type,
      productId: change.productId,
      productName: change.productName,
      oldValue: change.oldValue,
      newValue: change.newValue,
      message: change.message,
      timestamp: Date.now(),
      acknowledged: false,
    };

    setNotices((prev) => {
      // Deduplicate recent notices with the exact same message within 5 seconds
      const isDuplicate = prev.some(
        (n) => n.message === change.message && Date.now() - n.timestamp < 5000
      );
      if (isDuplicate) return prev;
      return [newNotice, ...prev.slice(0, 19)]; // Keep max 20 notices
    });

    if (change.productId) {
      setHighlightedIds((prev) => {
        const next = new Set(prev);
        next.add(change.productId!);
        return next;
      });

      setTimeout(() => {
        if (isMountedRef.current) {
          setHighlightedIds((prev) => {
            const next = new Set(prev);
            next.delete(change.productId!);
            return next;
          });
        }
      }, 3500);
    }
  }, []);

  // Batched Authoritative Validation Request
  const validateCartNow = useCallback(async (customCoupon?: string): Promise<ValidationResponse | null> => {
    const currentCart = cartRef.current;
    if (!currentCart || currentCart.length === 0) {
      return null;
    }

    setIsValidating(true);
    try {
      const activeCoupon = customCoupon !== undefined ? customCoupon : couponRef.current;
      const payload = {
        items: currentCart.map((item) => ({
          productId: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          selectedVariations: item.selectedVariations || {},
          expectedPrice: item.product.price,
        })),
        couponCode: activeCoupon || '',
      };

      const res = await fetch('/api/cart/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Validation failed with status ${res.status}`);
      }

      const data: ValidationResponse = await res.json();
      if (!isMountedRef.current || !data) return null;

      // 1. Process returned changes and add customer notices
      if (Array.isArray(data.changes) && data.changes.length > 0) {
        data.changes.forEach((ch) => {
          addNotice(ch);

          if (ch.type === 'PRICE_CHANGED' && ch.productId) {
            setPriceHistory((prev) => ({
              ...prev,
              [ch.productId]: {
                oldPrice: Number(ch.oldValue || 0),
                newPrice: Number(ch.newValue || 0),
              },
            }));
          }

          if (ch.type === 'COUPON_INVALID' && setAppliedCoupon) {
            setAppliedCoupon('');
          }
        });
      }

      // Automatically purge outdated removal/out-of-stock notices when validation confirms items are valid
      if (data.valid || (!data.changes || data.changes.length === 0)) {
        setNotices([]);
        try {
          sessionStorage.removeItem('veloce_cart_notices');
        } catch {}
      } else if (Array.isArray(data.items) && data.items.length > 0) {
        const activeValidIds = new Set(data.items.filter(i => i.isAvailable && i.stockStatus !== 'out_of_stock').map(i => i.productId));
        setNotices((prev) =>
          prev.filter((n) => {
            if ((n.type === 'PRODUCT_REMOVED' || n.type === 'OUT_OF_STOCK') && n.productId && activeValidIds.has(n.productId)) {
              return false;
            }
            if (n.type === 'PRICE_CHANGED' && n.productId === 'total' && (!data.changes || !data.changes.some((c) => c.productId === 'total'))) {
              return false;
            }
            return true;
          })
        );
      }

      // 2. Update stock tracking map for line item warnings
      if (Array.isArray(data.items)) {
        const stockMap: Record<string, { stock: number; isOutOfStock: boolean; isLowStock: boolean }> = {};
        data.items.forEach((item) => {
          stockMap[item.productId] = {
            stock: item.stock,
            isOutOfStock: item.stock <= 0 || item.stockStatus === 'out_of_stock',
            isLowStock: item.stock > 0 && item.stock <= 5,
          };
        });
        setStockInfo(stockMap);

        // 3. Reconcile Cart State non-destructively
        setCart((prevCart) => {
          let hasDiff = false;
          const reconciled: CartItem[] = [];

          for (const prevItem of prevCart) {
            const serverItem = data.items.find((si) => si.productId === prevItem.product.id);
            if (!serverItem || serverItem.stockStatus === 'out_of_stock' || serverItem.stock <= 0) {
              // Product removed or completely out of stock
              hasDiff = true;
              continue;
            }

            const clampedQty = Math.min(prevItem.quantity, serverItem.stock);
            const priceChanged = prevItem.product.price !== serverItem.price;
            const qtyChanged = prevItem.quantity !== clampedQty;
            const nameChanged = prevItem.product.name !== serverItem.name;
            const imgChanged = serverItem.imageUrl && prevItem.product.imageUrl !== serverItem.imageUrl;

            if (priceChanged || qtyChanged || nameChanged || imgChanged) {
              hasDiff = true;
              reconciled.push({
                ...prevItem,
                quantity: clampedQty,
                product: {
                  ...prevItem.product,
                  name: serverItem.name,
                  price: serverItem.price,
                  originalPrice: serverItem.originalPrice !== null ? serverItem.originalPrice : prevItem.product.originalPrice,
                  stock: serverItem.stock,
                  imageUrl: serverItem.imageUrl || prevItem.product.imageUrl,
                },
              });
            } else {
              reconciled.push(prevItem);
            }
          }

          if (hasDiff) {
            try {
              localStorage.setItem('veloce_cart', JSON.stringify(reconciled));
            } catch {
              // Ignore storage errors
            }
            return reconciled;
          }
          return prevCart;
        });
      }

      return data;
    } catch (err) {
      console.warn('[useCartSync] Cart validation check failed:', err);
      return null;
    } finally {
      if (isMountedRef.current) {
        setIsValidating(false);
      }
    }
  }, [addNotice, setCart, setAppliedCoupon]);

  // Debounced trigger helper for SSE updates
  const scheduleValidation = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      validateCartNow();
    }, 350);
  }, [validateCartNow]);

  // Connect Server-Sent Events (SSE) Stream
  const connectSSE = useCallback(() => {
    if (!enabled || typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    const currentCart = cartRef.current;
    if (!currentCart || currentCart.length === 0) {
      setIsStreamConnected(false);
      return;
    }

    // Close any previous stream before reconnecting
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const productIds = Array.from(new Set(currentCart.map((i) => i.product.id))).filter(Boolean);
    if (productIds.length === 0) return;

    const streamUrl = `/api/cart/stream?productIds=${encodeURIComponent(productIds.join(','))}`;

    try {
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (isMountedRef.current) {
          setIsStreamConnected(true);
          reconnectAttemptsRef.current = 0;
        }
      };

      // Heartbeat ping
      es.addEventListener('ping', () => {
        // Heartbeat received, connection is active
      });

      // Product changed event from backend
      es.addEventListener('product:updated', (e: MessageEvent) => {
        try {
          scheduleValidation();
        } catch (err) {
          console.warn('[useCartSync] Error handling product:updated SSE event:', err);
        }
      });

      // General message event
      es.onmessage = () => {
        scheduleValidation();
      };

      es.onerror = () => {
        if (isMountedRef.current) {
          setIsStreamConnected(false);
        }
        es.close();
        eventSourceRef.current = null;

        // Exponential backoff reconnect
        const attempts = reconnectAttemptsRef.current;
        const delay = Math.min(30000, Math.pow(2, attempts) * 1500 + Math.random() * 1000);
        reconnectAttemptsRef.current += 1;

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            connectSSE();
            validateCartNow(); // Validate upon reconnecting
          }
        }, delay);
      };
    } catch (err) {
      console.warn('[useCartSync] Failed to initialize SSE EventSource:', err);
      setIsStreamConnected(false);
    }
  }, [enabled, scheduleValidation, validateCartNow]);

  // Initial Mount Validation & SSE Subscription
  useEffect(() => {
    isMountedRef.current = true;

    if (cart.length > 0) {
      validateCartNow();
      connectSSE();
    }

    return () => {
      isMountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (fallbackPollRef.current) clearInterval(fallbackPollRef.current);
    };
  }, []);

  // Update SSE subscription when product IDs in cart change
  const productIdsString = cart.map((i) => i.product.id).sort().join(',');
  useEffect(() => {
    if (cart.length > 0) {
      connectSSE();
    } else {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsStreamConnected(false);
    }
  }, [productIdsString, connectSSE, cart.length]);

  // Fallback Polling (Every 25s when stream is disconnected or tab in background)
  useEffect(() => {
    if (fallbackPollRef.current) {
      clearInterval(fallbackPollRef.current);
    }

    fallbackPollRef.current = setInterval(() => {
      if (cartRef.current.length > 0 && (!isStreamConnected || document.visibilityState === 'visible')) {
        validateCartNow();
      }
    }, 25000);

    return () => {
      if (fallbackPollRef.current) {
        clearInterval(fallbackPollRef.current);
      }
    };
  }, [isStreamConnected, validateCartNow]);

  // Window Focus & Visibility Change triggers immediate sync
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && cartRef.current.length > 0) {
        validateCartNow();
        if (!eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED) {
          connectSSE();
        }
      }
    };

    const handleWindowFocus = () => {
      if (cartRef.current.length > 0) {
        validateCartNow();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [validateCartNow, connectSSE]);

  // Handle 409 Conflict from checkout order placement
  const handle409OrderConflict = useCallback((conflictData: any) => {
    if (!conflictData) return;

    if (Array.isArray(conflictData.changes)) {
      conflictData.changes.forEach((ch: any) => addNotice(ch));
    } else if (conflictData.message) {
      addNotice({
        type: 'DETAILS_UPDATED',
        message: conflictData.message,
      });
    }

    // Force immediate re-validation
    validateCartNow();
  }, [addNotice, validateCartNow]);

  // Check if any cart item currently has blocking issues (e.g. 0 stock)
  const hasBlockingChanges = cart.some((item) => {
    const info = stockInfo[item.product.id];
    return info && (info.isOutOfStock || info.stock < item.quantity);
  });

  return {
    notices,
    dismissNotice,
    clearAllNotices,
    isValidating,
    isStreamConnected,
    priceHistory,
    stockInfo,
    highlightedIds,
    hasBlockingChanges,
    validateCartNow,
    handle409OrderConflict,
  };
}
