import { Order, Review, ReviewRequestSettings, ReviewRequestLog } from '../types';
import { buildPostDeliveryReviewRequestEmail } from './emailNotifier';
import { EmailNotification } from '../components/EmailToaster';

export function isReviewRequestOptedOut(customerEmail?: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    // 1. Global preference
    if (localStorage.getItem('veloce_opt_out_review_requests') === 'true') {
      return true;
    }
    // 2. Specific email preference
    if (customerEmail) {
      const cleanEmail = customerEmail.toLowerCase().trim();
      if (!cleanEmail) return false;

      if (localStorage.getItem(`veloce_opt_out_review_requests_${cleanEmail}`) === 'true') {
        return true;
      }

      const listRaw = localStorage.getItem('veloce_review_opt_out_emails');
      if (listRaw) {
        const list: string[] = JSON.parse(listRaw);
        if (Array.isArray(list) && list.includes(cleanEmail)) {
          return true;
        }
      }
    }
  } catch (e) {
    // Fail safe
  }
  return false;
}

export async function processReviewRequestAutomation(
  orders: Order[],
  reviews: Review[],
  settings: ReviewRequestSettings,
  onTriggerEmailToast?: (toast: EmailNotification) => void,
  onUpdateOrder?: (updatedOrder: Order) => void
): Promise<{ processedCount: number; newlySentOrders: Order[] }> {
  if (!settings || !settings.enabled) {
    return { processedCount: 0, newlySentOrders: [] };
  }

  const newlySentOrders: Order[] = [];
  const now = Date.now();

  for (const order of orders) {
    const statusLower = String(order.status || '').toLowerCase();
    
    // 6.1 Trigger: Delivered / Completed orders only
    if (statusLower !== 'delivered' && statusLower !== 'completed') {
      continue;
    }

    // 6.3 Safeguard: Idempotency check - sent only once per order
    if (order.review_request_sent_at) {
      continue;
    }

    // 6.3 Safeguard: Respect opt-out preference stored in localStorage
    if (isReviewRequestOptedOut(order.customerEmail)) {
      const updatedOrder: Order = {
        ...order,
        review_request_sent_at: new Date().toISOString(),
        review_request_status: 'opted_out',
      };
      if (onUpdateOrder) onUpdateOrder(updatedOrder);
      continue;
    }

    // Determine delivery timestamp from status history or order date
    let deliveredTimeMs = now;
    if (order.statusHistory && order.statusHistory.length > 0) {
      const deliveredEntry = order.statusHistory.find(
        (h) => h.status === 'delivered' || h.status === 'processing' || h.status === 'shipped'
      );
      if (deliveredEntry && deliveredEntry.timestamp) {
        deliveredTimeMs = new Date(deliveredEntry.timestamp).getTime();
      } else {
        deliveredTimeMs = new Date(order.date).getTime();
      }
    } else if (order.date) {
      deliveredTimeMs = new Date(order.date).getTime();
    }

    // Calculate delay window
    const elapsedDays = (now - deliveredTimeMs) / (1000 * 60 * 60 * 24);
    const requiredDelay = settings.delayDays || 0; // 0 for instant test mode

    if (elapsedDays < requiredDelay) {
      // Delay window not met yet
      continue;
    }

    // 6.3 Safeguard: Check if customer already reviewed all items in this order
    const orderItemIds = (order.items || []).map((i) => i.productId);
    const customerEmailLower = String(order.customerEmail || '').toLowerCase().trim();

    const existingReviewsForOrder = reviews.filter((r) => {
      const sameOrder = r.orderId === order.id;
      const sameEmail = r.userEmail && r.userEmail.toLowerCase() === customerEmailLower;
      const activeStatus = r.status !== 'Removed';
      return (sameOrder || sameEmail) && activeStatus && orderItemIds.includes(r.productId || '');
    });

    const reviewedProductIds = new Set(existingReviewsForOrder.map((r) => r.productId));
    const allItemsReviewed = orderItemIds.every((id) => reviewedProductIds.has(id));

    if (allItemsReviewed && orderItemIds.length > 0) {
      // Already reviewed all items
      const updatedOrder: Order = {
        ...order,
        review_request_sent_at: new Date().toISOString(),
        review_request_status: 'already_reviewed',
      };
      if (onUpdateOrder) onUpdateOrder(updatedOrder);
      continue;
    }

    // Order is eligible for Post-Delivery Review Request Email!
    const sentTimestamp = new Date().toISOString();
    const updatedOrder: Order = {
      ...order,
      review_request_sent_at: sentTimestamp,
      review_request_status: 'sent',
    };

    // Build email notification
    const emailToast = buildPostDeliveryReviewRequestEmail(updatedOrder, settings.delayDays);
    if (onTriggerEmailToast) {
      onTriggerEmailToast(emailToast);
    }

    // Try logging to server if backend is active
    try {
      await fetch('/api/admin/review-requests/track-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          sentAt: sentTimestamp,
          delayDays: settings.delayDays,
          itemsCount: order.items.length,
        }),
      });
    } catch (e) {
      // Silent catch for offline mode
    }

    newlySentOrders.push(updatedOrder);
    if (onUpdateOrder) {
      onUpdateOrder(updatedOrder);
    }
  }

  return { processedCount: newlySentOrders.length, newlySentOrders };
}
