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
 * Subscribe to new order broadcasts from any tab or window
 */
export function subscribeToOrderNotifications(
  onOrderReceived: (order: Order, isCrossTab: boolean) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  let broadcastChannel: BroadcastChannel | null = null;

  // Handler for incoming order payloads with multi-channel de-duplication
  const handleIncomingPayload = (payload: any, isCrossTab: boolean) => {
    if (!payload || payload.type !== 'NEW_ORDER_PLACED' || !payload.order?.id) {
      return;
    }

    const orderId = payload.order.id;
    const now = Date.now();
    const lastSeen = recentlyReceivedPayloads.get(orderId);

    // Suppress duplicate events arriving from redundant channels (BroadcastChannel + storage event) within 5 seconds
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

    onOrderReceived(payload.order, isCrossTab);
  };

  // 1. Listen to BroadcastChannel
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

  // 2. Listen to storage event (Fallback for cross-tab sync)
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

  // 3. Listen to local same-tab window event
  const handleLocalEvent = (e: any) => {
    if (e.detail) {
      handleIncomingPayload(e.detail, false);
    }
  };

  window.addEventListener('storage', handleStorageEvent);
  window.addEventListener('ropenix_order_placed_local', handleLocalEvent);
  window.addEventListener('veloce_order_placed_local', handleLocalEvent);

  return () => {
    if (broadcastChannel) {
      broadcastChannel.close();
    }
    window.removeEventListener('storage', handleStorageEvent);
    window.removeEventListener('ropenix_order_placed_local', handleLocalEvent);
    window.removeEventListener('veloce_order_placed_local', handleLocalEvent);
  };
}
