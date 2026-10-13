/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order } from '../types';

const BROADCAST_CHANNEL_NAME = 'ropenix_order_notifications_channel';

// In-memory de-duplication caches
const recentlyNotifiedOrders = new Set<string>();
const recentlyReceivedPayloads = new Map<string, number>();

// Web Audio API Synthesized Chime sound for new order alert
let lastSoundPlayTime = 0;
export function playNewOrderSound() {
  try {
    const now = Date.now();
    // Throttle sound to prevent overlapping dual playback
    if (now - lastSoundPlayTime < 1500) {
      return;
    }
    lastSoundPlayTime = now;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    
    // First tone (E5 ~ 659Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.4);

    // Second tone (G5 ~ 783.99Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
    gain2.gain.setValueAtTime(0.4, ctx.currentTime + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.2);
    osc2.stop(ctx.currentTime + 0.8);

    // Third high tone (C6 ~ 1046.5Hz)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.4);
    gain3.gain.setValueAtTime(0.5, ctx.currentTime + 0.4);
    gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(ctx.currentTime + 0.4);
    osc3.stop(ctx.currentTime + 1.2);

  } catch (err) {
    console.warn('[OrderNotification] Audio synth error:', err);
  }
}

/**
 * Request system/browser notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('[OrderNotification] Window Notification API not supported');
    return 'denied';
  }

  try {
    if (Notification.permission === 'granted') {
      return 'granted';
    }
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('[OrderNotification] Permission request error:', err);
    return 'denied';
  }
}

export interface ShowDesktopNotificationOptions {
  isCustomerConfirmation?: boolean;
  timeoutMs?: number;
}

/**
 * Trigger a native Browser Desktop / Window Notification with de-duplication and automatic timeout
 */
export function showDesktopNotification(order: Order, options?: ShowDesktopNotificationOptions) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (!order || !order.id) return;

  // 1. De-duplicate: Ensure the exact same order does not spawn multiple notifications within 15 seconds
  const dedupeKey = `order-${order.id}-${options?.isCustomerConfirmation ? 'customer' : 'admin'}`;
  if (recentlyNotifiedOrders.has(dedupeKey)) {
    return;
  }
  recentlyNotifiedOrders.add(dedupeKey);
  setTimeout(() => {
    recentlyNotifiedOrders.delete(dedupeKey);
  }, 15000);

  if (Notification.permission === 'granted') {
    try {
      const itemsCount = order.items?.reduce((acc, i) => acc + i.quantity, 0) || order.items?.length || 1;
      const formattedTotal = `KSh ${(order.total || 0).toLocaleString()}`;
      
      const title = options?.isCustomerConfirmation
        ? `🎉 Order Confirmed! #${order.id}`
        : `📦 New Order Received! #${order.id}`;

      const body = options?.isCustomerConfirmation
        ? `Thank you for your order!\nTotal: ${formattedTotal} (${itemsCount} items)\nStatus: Processing order`
        : `Customer: ${order.customerName || 'Guest Customer'}\nTotal: ${formattedTotal} (${itemsCount} items)\nPayment: ${(order.paymentMethod || 'm-pesa').toUpperCase()}`;

      const notification = new Notification(title, {
        body,
        icon: '/ropenix_icon.png',
        badge: '/favicon-32x32.png',
        tag: `order-${order.id}`, // Stable tag (without timestamp) so the OS collapses any duplicate notifications
        requireInteraction: false, // Auto-dismisses normally in OS notification center
      });

      // 2. Explicit JavaScript Auto-dismiss timeout (default: 5 seconds)
      const timeoutMs = options?.timeoutMs || 5000;
      const timer = setTimeout(() => {
        try {
          notification.close();
        } catch (e) {}
      }, timeoutMs);

      notification.onclick = () => {
        clearTimeout(timer);
        try {
          window.focus();
          window.dispatchEvent(
            new CustomEvent('veloce_navigate_admin_orders', {
              detail: { orderId: order.id }
            })
          );
          notification.close();
        } catch (e) {}
      };
    } catch (err) {
      console.error('[OrderNotification] Desktop notification spawn error:', err);
    }
  }
}

/**
 * Broadcasts a newly placed customer order across all browser windows and tabs
 */
export function broadcastNewOrderEvent(order: Order) {
  if (!order || !order.id) return;

  const payload = {
    type: 'NEW_ORDER_PLACED',
    order,
    timestamp: Date.now()
  };

  // 1. Send via BroadcastChannel (primary channel for modern browsers)
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage(payload);
      channel.close();
    } catch (e) {
      console.warn('[OrderNotification] BroadcastChannel post error:', e);
    }
  }

  // 2. Set in localStorage (fallback sync for other tabs)
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('ropenix_latest_new_order', JSON.stringify(payload));
      localStorage.setItem('veloce_latest_new_order', JSON.stringify(payload)); // backwards compatibility
    } catch (e) {
      console.warn('[OrderNotification] localStorage setItem error:', e);
    }
  }

  // 3. Dispatch local window event for same-tab listening
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ropenix_order_placed_local', { detail: payload }));
    window.dispatchEvent(new CustomEvent('veloce_order_placed_local', { detail: payload }));
  }
}

/**
 * Normalizes incoming raw order object from backend SSE / polling stream to standard Order
 */
function normalizeNotificationOrder(raw: any): Order {
  if (!raw) return {} as Order;
  const items = Array.isArray(raw.items)
    ? raw.items.map((it: any) => ({
        productId: String(it.productId || it.product || it.id || ''),
        name: it.product_name || it.name || 'Store Item',
        price: typeof it.unit_price === 'number' ? it.unit_price : (typeof it.price === 'number' ? it.price : parseFloat(it.unit_price || it.price || '0')),
        quantity: Number(it.quantity || 1),
        selectedVariations: it.selected_variations || it.selectedVariations || {},
        type: 'physical' as const,
      }))
    : [];

  const rawMethod = String(raw.paymentMethod || raw.payment_method || 'mpesa').toLowerCase();
  const paymentMethod = (rawMethod.includes('cod') || rawMethod.includes('cash') || rawMethod.includes('delivery')) ? 'cod' : 'mpesa';

  return {
    id: String(raw.id || ''),
    customerName: raw.customerName || raw.customer_name || 'Customer',
    customerEmail: raw.customerEmail || raw.customer_email || raw.email || '',
    phone: raw.phone || raw.customerPhone || raw.customer_phone || '',
    total: typeof raw.total === 'number' ? raw.total : parseFloat(raw.total || '0'),
    subtotal: raw.subtotal ? parseFloat(raw.subtotal) : undefined,
    shippingFee: raw.shipping_fee ? parseFloat(raw.shipping_fee) : (raw.shippingFee ? parseFloat(raw.shippingFee) : undefined),
    discount: raw.discount ? parseFloat(raw.discount) : undefined,
    status: raw.status || 'pending',
    date: raw.created_at ? String(raw.created_at).split('T')[0] : (raw.date ? String(raw.date).split('T')[0] : new Date().toISOString().split('T')[0]),
    paymentMethod,
    items,
  };
}

/**
 * Subscribe to new order broadcasts from any tab, window, or remote customer device via SSE & Polling
 */
export function subscribeToOrderNotifications(
  onOrderReceived: (order: Order, isCrossTab: boolean) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  let broadcastChannel: BroadcastChannel | null = null;
  let eventSource: EventSource | null = null;
  let pollingInterval: any = null;

  // Handler for incoming order payloads with multi-channel de-duplication
  const handleIncomingPayload = (payload: any, isCrossTab: boolean) => {
    if (!payload || payload.type !== 'NEW_ORDER_PLACED' || !payload.order?.id) {
      return;
    }

    const orderId = String(payload.order.id);
    const now = Date.now();
    const lastSeen = recentlyReceivedPayloads.get(orderId);

    // Suppress duplicate events arriving from redundant channels within 5 seconds
    if (lastSeen && now - lastSeen < 5000) {
      return;
    }
    recentlyReceivedPayloads.set(orderId, now);

    // Clean up old entries
    if (recentlyReceivedPayloads.size > 100) {
      for (const [id, time] of recentlyReceivedPayloads.entries()) {
        if (now - time > 30000) {
          recentlyReceivedPayloads.delete(id);
        }
      }
    }

    const normalizedOrder = normalizeNotificationOrder(payload.order);
    onOrderReceived(normalizedOrder, isCrossTab);

    // Dispatch global event so other components / caches can re-fetch orders
    try {
      window.dispatchEvent(new CustomEvent('veloce_new_order_received', { detail: { order: normalizedOrder } }));
      window.dispatchEvent(new CustomEvent('veloce_orders_updated'));
    } catch (_) {}
  };

  // 1. Primary Real-Time Channel: Server-Sent Events (SSE) from Express backend
  try {
    eventSource = new EventSource('/api/orders/live-stream');
    eventSource.addEventListener('new_order', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data?.order) {
          handleIncomingPayload(data, true);
        }
      } catch (err) {
        console.warn('[OrderNotification] Failed to parse SSE event data:', err);
      }
    });

    eventSource.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data?.type === 'NEW_ORDER_PLACED' && data?.order) {
          handleIncomingPayload(data, true);
        }
      } catch (_) {}
    };

    eventSource.onerror = (err) => {
      // EventSource automatically handles exponential backoff reconnection
      console.debug('[OrderNotification] SSE reconnecting...', err);
    };
  } catch (err) {
    console.warn('[OrderNotification] SSE initialization error:', err);
  }

  // 2. High-Reliability Polling Fallback (ensures delivery across proxy/CDN drops)
  const initialKnownIds = new Set<string>();
  let isFirstPoll = true;

  const pollLatestOrders = async () => {
    try {
      const res = await fetch('/api/orders/latest?limit=10', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = await res.json();
      const orders: any[] = json.orders || [];

      if (isFirstPoll) {
        orders.forEach((o) => {
          if (o?.id) initialKnownIds.add(String(o.id));
        });
        isFirstPoll = false;
        return;
      }

      for (const ord of orders) {
        if (!ord?.id) continue;
        const idStr = String(ord.id);
        if (!initialKnownIds.has(idStr)) {
          initialKnownIds.add(idStr);
          // Only notify if order was created within the last 15 minutes
          const orderTime = new Date(ord.created_at || ord.createdAt || ord.date || Date.now()).getTime();
          if (Date.now() - orderTime < 15 * 60 * 1000) {
            handleIncomingPayload(
              {
                type: 'NEW_ORDER_PLACED',
                order: ord,
                timestamp: Date.now(),
              },
              true
            );
          }
        }
      }
    } catch (_) {}
  };

  pollLatestOrders();
  pollingInterval = setInterval(pollLatestOrders, 12000);

  // 3. Listen to BroadcastChannel (instant same-machine cross-tab sync)
  if ('BroadcastChannel' in window) {
    try {
      broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      broadcastChannel.onmessage = (event) => {
        handleIncomingPayload(event.data, true);
      };
    } catch (err) {
      console.warn('[OrderNotification] BroadcastChannel subscribe error:', err);
    }
  }

  // 4. Listen to storage event (Fallback for cross-tab sync)
  const handleStorageEvent = (e: StorageEvent) => {
    if ((e.key === 'ropenix_latest_new_order' || e.key === 'veloce_latest_new_order') && e.newValue) {
      try {
        const payload = JSON.parse(e.newValue);
        handleIncomingPayload(payload, true);
      } catch (err) {
        console.error('[OrderNotification] Storage event parse error:', err);
      }
    }
  };

  // 5. Listen to local same-tab window event
  const handleLocalEvent = (e: any) => {
    if (e.detail) {
      handleIncomingPayload(e.detail, false);
    }
  };

  window.addEventListener('storage', handleStorageEvent);
  window.addEventListener('ropenix_order_placed_local', handleLocalEvent);
  window.addEventListener('veloce_order_placed_local', handleLocalEvent);

  return () => {
    if (eventSource) {
      eventSource.close();
    }
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    if (broadcastChannel) {
      broadcastChannel.close();
    }
    window.removeEventListener('storage', handleStorageEvent);
    window.removeEventListener('ropenix_order_placed_local', handleLocalEvent);
    window.removeEventListener('veloce_order_placed_local', handleLocalEvent);
  };
}
