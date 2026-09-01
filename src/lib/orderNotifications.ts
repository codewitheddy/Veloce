/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order } from '../types';

const BROADCAST_CHANNEL_NAME = 'veloce_order_notifications_channel';

// Web Audio API Synthesized Chime sound for new order alert
export function playNewOrderSound() {
  try {
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

/**
 * Trigger a native Browser Desktop / Window Notification
 */
export function showDesktopNotification(order: Order) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      const itemsCount = order.items?.reduce((acc, i) => acc + i.quantity, 0) || order.items?.length || 1;
      const formattedTotal = `KSh ${(order.total || 0).toLocaleString()}`;
      
      const notification = new Notification(`📦 New Order Received! #${order.id}`, {
        body: `Customer: ${order.customerName || 'Guest Customer'}\nTotal: ${formattedTotal} (${itemsCount} items)\nPayment: ${(order.paymentMethod || 'm-pesa').toUpperCase()}`,
        icon: '/favicon.ico',
        tag: `order-${order.id}-${Date.now()}`,
        requireInteraction: true, // Remains on screen until user interacts!
      });

      notification.onclick = () => {
        window.focus();
        window.dispatchEvent(
          new CustomEvent('veloce_navigate_admin_orders', {
            detail: { orderId: order.id }
          })
        );
        notification.close();
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
  const payload = {
    type: 'NEW_ORDER_PLACED',
    order,
    timestamp: Date.now()
  };

  // 1. Send via BroadcastChannel (for modern browsers)
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage(payload);
      channel.close();
    } catch (e) {
      console.warn('[OrderNotification] BroadcastChannel post error:', e);
    }
  }

  // 2. Set in localStorage to trigger storage events in all other tabs
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('veloce_latest_new_order', JSON.stringify(payload));
    } catch (e) {
      console.warn('[OrderNotification] localStorage setItem error:', e);
    }
  }

  // 3. Dispatch local window event for same-tab listening
  if (typeof window !== 'undefined') {
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

  // Handler for incoming order payloads
  const handleIncomingPayload = (payload: any, isCrossTab: boolean) => {
    if (payload && payload.type === 'NEW_ORDER_PLACED' && payload.order) {
      onOrderReceived(payload.order, isCrossTab);
    }
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
    if (e.key === 'veloce_latest_new_order' && e.newValue) {
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
  window.addEventListener('veloce_order_placed_local', handleLocalEvent);

  return () => {
    if (broadcastChannel) {
      broadcastChannel.close();
    }
    window.removeEventListener('storage', handleStorageEvent);
    window.removeEventListener('veloce_order_placed_local', handleLocalEvent);
  };
}
