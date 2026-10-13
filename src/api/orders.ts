import api from './client';
import { Order } from '../types';

export interface OrderQueryParams {
  page?: number;
  status?: string;
  search?: string;
  ordering?: string;
}

export interface PaginatedOrdersResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Order[];
}

export const mapBackendOrderToFrontend = (ord: any): Order => {
  if (!ord) return {} as Order;
  const rawStatus = String(ord.payment_status || ord.paymentStatus || '').toLowerCase();
  const rawRef = String(ord.payment_reference || ord.paymentReference || '').trim();
  const isPaid =
    rawStatus === 'paid' ||
    Boolean(ord.isPaid) ||
    Boolean(ord.is_paid) ||
    (rawRef !== '' && !rawRef.toUpperCase().includes('PENDING') && !rawRef.toUpperCase().includes('UNPAID'));

  const paymentStatus = isPaid ? 'paid' : (rawStatus === 'partial' ? 'partial' : 'unpaid');
  const rawMethod = String(ord.payment_method || ord.paymentMethod || '').toLowerCase();
  const paymentMethod: 'cod' | 'mpesa' = (rawMethod === 'cod' || rawMethod.includes('cash') || rawMethod.includes('delivery')) ? 'cod' : 'mpesa';

  // Normalize status
  let status = String(ord.status || 'order_received').toLowerCase();
  if (status === 'pending') {
    status = 'order_received';
  } else if (status === 'delivered') {
    status = paymentMethod === 'cod' ? 'payment_received' : 'shipped';
  }

  return {
    id: String(ord.id || ''),
    customerName: ord.customer_name || ord.customerName || 'Customer',
    customerEmail: ord.customer_email || ord.customerEmail || '',
    phone: ord.customer_phone || ord.phone || ord.mpesaPhone || '',
    total: typeof ord.total === 'number' ? ord.total : parseFloat(ord.total || '0'),
    subtotal: ord.subtotal ? parseFloat(ord.subtotal) : undefined,
    shippingFee: ord.shipping_fee ? parseFloat(ord.shipping_fee) : (ord.shippingFee ? parseFloat(ord.shippingFee) : undefined),
    tax: ord.tax_amount ? parseFloat(ord.tax_amount) : (ord.tax ? parseFloat(ord.tax) : undefined),
    discount: ord.discount ? parseFloat(ord.discount) : undefined,
    status: status as Order['status'],
    paymentStatus: paymentStatus as any,
    paidAt: ord.paid_at || ord.paidAt || ord.payment_confirmed_at || (isPaid ? (ord.updated_at || ord.created_at) : undefined),
    paymentReference: rawRef || undefined,
    date: ord.created_at ? ord.created_at.split('T')[0] : (ord.date ? ord.date.split('T')[0] : new Date().toISOString().split('T')[0]),
    shippingAddress: typeof ord.shipping_address === 'string' ? ord.shipping_address : (typeof ord.shippingAddress === 'string' ? ord.shippingAddress : (ord.shippingAddress ? JSON.stringify(ord.shippingAddress) : '')),
    paymentMethod,
    couponCode: ord.affiliate_code || ord.couponCode || '',
    trackingNumber: ord.tracking_number || ord.trackingNumber || '',
    notes: ord.notes || '',
    deliveryConfirmed: Boolean(
      ord.deliveryConfirmed === true ||
      ord.deliveryConfirmed === 1 ||
      ord.delivery_confirmed === true ||
      ord.delivery_confirmed === 1 ||
      (status === 'completed')
    ),
    deliveredAt: ord.deliveredAt || ord.delivered_at || undefined,
    deliveryPerson: ord.deliveryPerson || ord.delivery_person || ord.payment_collected_by || undefined,
    deliveryNote: ord.deliveryNote || ord.delivery_note || undefined,
    cancellationReason: ord.cancellation_reason || ord.cancellationReason || undefined,
    cancelledBy: ord.cancelled_by || ord.cancelledBy || undefined,
    cancelledAt: ord.cancelled_at || ord.cancelledAt || undefined,
    paymentCollectedBy: ord.payment_collected_by || ord.paymentCollectedBy || undefined,
    paymentCollectedAt: ord.payment_collected_at || ord.paymentCollectedAt || undefined,
    paymentConfirmedBy: ord.payment_confirmed_by || ord.paymentConfirmedBy || undefined,
    paymentConfirmedAt: ord.payment_confirmed_at || ord.paymentConfirmedAt || undefined,
    paymentAmount: ord.payment_amount ? Number(ord.payment_amount) : (ord.paymentAmount ? Number(ord.paymentAmount) : undefined),
    refundClaim: ord.refundClaim || null,
    items: Array.isArray(ord.items)
      ? ord.items.map((it: any) => ({
          productId: String(it.productId || it.product || it.id || ''),
          name: it.product_name || it.name || 'Product Item',
          price: typeof it.unit_price === 'number' ? it.unit_price : (typeof it.price === 'number' ? it.price : parseFloat(it.unit_price || it.price || '0')),
          quantity: Number(it.quantity || 1),
          selectedVariations: it.selected_variations || it.selectedVariations || {},
          type: 'physical',
        }))
      : [],
    statusHistory: ord.status_history || ord.statusHistory || [
      {
        status: status,
        timestamp: ord.created_at || new Date().toISOString(),
        note: `Order recorded with status: ${status}`,
      },
    ],
  };
};

export const ordersApi = {
  /**
   * Retrieves orders list with optional pagination & filtering
   */
  getOrders: async (params?: OrderQueryParams): Promise<PaginatedOrdersResponse> => {
    const response = await api.get('/orders/', { params });
    const data = response.data;

    if (Array.isArray(data)) {
      const mapped = data.map(mapBackendOrderToFrontend);
      return {
        count: mapped.length,
        next: null,
        previous: null,
        results: mapped,
      };
    }

    const rawResults = Array.isArray(data?.results) ? data.results : [];
    return {
      count: Number(data?.count || rawResults.length),
      next: data?.next || null,
      previous: data?.previous || null,
      results: rawResults.map(mapBackendOrderToFrontend),
    };
  },

  /**
   * Retrieves order detail by ID
   */
  getOrder: async (id: string): Promise<Order> => {
    const response = await api.get(`/orders/${id}/`);
    return mapBackendOrderToFrontend(response.data);
  },

  /**
   * Creates a new order
   */
  createOrder: async (orderData: Partial<Order>): Promise<Order> => {
    const payload = {
      id: orderData.id || undefined,
      customer_name: (orderData.customerName || 'Customer').trim(),
      customerName: (orderData.customerName || 'Customer').trim(),
      customer_email: (orderData.customerEmail || (orderData as any).customer_email || (orderData as any).email || '').trim(),
      customerEmail: (orderData.customerEmail || (orderData as any).customer_email || (orderData as any).email || '').trim(),
      email: (orderData.customerEmail || (orderData as any).customer_email || (orderData as any).email || '').trim(),
      customer_phone: (orderData.phone || '').trim(),
      subtotal: orderData.subtotal,
      discount: orderData.discount || 0,
      shipping_fee: orderData.shippingFee || 0,
      tax_amount: orderData.tax || 0,
      total: orderData.total,
      status: 'order_received',
      payment_method: orderData.paymentMethod === 'cod' ? 'Cash on Delivery' : 'M-PESA',
      shipping_address: orderData.shippingAddress || '',
      affiliate_code: orderData.couponCode || '',
      notes: orderData.notes || '',
      items: Array.isArray(orderData.items)
        ? orderData.items.map((item: any) => ({
            product_name: item.name || item.product_name,
            quantity: Number(item.quantity || 1),
            unit_price: typeof item.price === 'number' ? item.price : parseFloat(item.unit_price || item.price || '0'),
            selected_variations: item.selectedVariations || {},
          }))
        : [],
    };

    const response = await api.post('/orders/', payload);
    return mapBackendOrderToFrontend(response.data);
  },

  /**
   * Strict status transition using backend transition map
   */
  transitionOrderStatus: async (
    orderId: string,
    targetStatus: string,
    options?: {
      notes?: string;
      transactionCode?: string;
      amount?: number;
      phone?: string;
      collectedBy?: string;
      cancellationReason?: string;
      trackingNumber?: string;
      courierName?: string;
    }
  ): Promise<{ order: Order; refundClaim?: any }> => {
    const response = await api.post(`/orders/${orderId}/transition`, {
      status: targetStatus,
      note: options?.notes,
      transactionCode: options?.transactionCode,
      amount: options?.amount,
      phone: options?.phone,
      collectedBy: options?.collectedBy,
      cancellationReason: options?.cancellationReason,
      trackingNumber: options?.trackingNumber,
      courierName: options?.courierName,
    });
    return {
      order: mapBackendOrderToFrontend(response.data.order || response.data),
      refundClaim: response.data.refundClaim || null,
    };
  },

  /**
   * Cancel an order (with required cancellation reason)
   */
  cancelOrder: async (
    orderId: string,
    reason: string
  ): Promise<{ order: Order; refundClaim?: any }> => {
    const response = await api.post(`/orders/${orderId}/cancel`, {
      cancellationReason: reason,
      reason,
    });
    return {
      order: mapBackendOrderToFrontend(response.data.order || response.data),
      refundClaim: response.data.refundClaim || null,
    };
  },

  /**
   * Fetch full lifecycle audit timeline for an order
   */
  getOrderHistory: async (orderId: string): Promise<any[]> => {
    const response = await api.get(`/orders/${orderId}/history`);
    return response.data?.history || [];
  },

  /**
   * Fetch valid next transitions for an order given its status and payment method
   */
  getValidTransitions: async (orderId: string): Promise<{ validNext: string[]; currentStatus: string; paymentMethod: string }> => {
    const response = await api.get(`/orders/${orderId}/valid-transitions`);
    return {
      validNext: response.data?.validNext || [],
      currentStatus: response.data?.currentStatus || '',
      paymentMethod: response.data?.paymentMethod || 'mpesa',
    };
  },

  /**
   * Fetch refund claim linked to an order
   */
  getOrderRefundClaim: async (orderId: string): Promise<any | null> => {
    const response = await api.get(`/orders/${orderId}/refund-claim`);
    return response.data?.refundClaim || null;
  },

  /**
   * Fetch all refund claims (Admin)
   */
  getAdminRefunds: async (statusFilter?: string): Promise<any[]> => {
    const response = await api.get('/orders/refunds', { params: { status: statusFilter } });
    return response.data?.refunds || [];
  },

  /**
   * Action on a refund claim (Admin approve/reject/pay)
   */
  processRefundClaim: async (
    claimId: string,
    action: 'approve' | 'reject' | 'pay',
    payload?: { refundPaymentReference?: string; rejectionReason?: string }
  ): Promise<any> => {
    const response = await api.post(`/orders/refunds/${claimId}/action`, {
      action,
      ...payload,
    });
    return response.data?.claim || response.data;
  },

  /**
   * Compatibility wrapper: Updates status of an existing order
   */
  updateOrderStatus: async (
    orderId: string,
    status: string,
    options?: string | {
      trackingNumber?: string;
      courierName?: string;
      notes?: string;
      deliveryPerson?: string;
      deliveryNote?: string;
      isDeliveryConfirmed?: boolean;
    }
  ): Promise<Order> => {
    const opts = typeof options === 'string' ? { trackingNumber: options } : (options || {});
    const res = await ordersApi.transitionOrderStatus(orderId, status, {
      notes: opts.notes,
      trackingNumber: opts.trackingNumber,
      courierName: opts.courierName,
      collectedBy: opts.deliveryPerson,
    });
    return res.order;
  },

  /**
   * Admin confirms payment for an order (M-Pesa payment_confirmed)
   */
  confirmPayment: async (
    orderId: string,
    options?: { paymentReference?: string; paymentAmount?: number; phone?: string; adminNotes?: string }
  ): Promise<Order> => {
    const res = await ordersApi.transitionOrderStatus(orderId, 'payment_confirmed', {
      transactionCode: options?.paymentReference || 'CONFIRMED-BY-ADMIN',
      amount: options?.paymentAmount,
      phone: options?.phone,
      notes: options?.adminNotes || 'Payment confirmed by administrator',
    });
    return res.order;
  },

  /**
   * Admin marks order as Shipped
   */
  markShipped: async (
    orderId: string,
    options?: { trackingNumber?: string; courierName?: string; notes?: string }
  ): Promise<Order> => {
    const res = await ordersApi.transitionOrderStatus(orderId, 'shipped', {
      trackingNumber: options?.trackingNumber,
      courierName: options?.courierName,
      notes: options?.notes,
    });
    return res.order;
  },

  /**
   * Admin/Delivery agent marks COD payment received
   */
  confirmCodPaymentReceived: async (
    orderId: string,
    options: { amount: number; collectedBy: string; notes?: string }
  ): Promise<Order> => {
    const res = await ordersApi.transitionOrderStatus(orderId, 'payment_received', {
      amount: options.amount,
      collectedBy: options.collectedBy,
      notes: options.notes,
    });
    return res.order;
  },

  /**
   * Admin marks delivery confirmation
   */
  confirmDelivery: async (orderId: string, data: { deliveryPerson?: string; deliveryNote?: string }): Promise<Order> => {
    const response = await api.put(`/orders/${orderId}/`, {
      deliveryPerson: data.deliveryPerson,
      deliveryNote: data.deliveryNote,
      deliveryConfirmed: true,
    });
    return mapBackendOrderToFrontend(response.data.order || response.data);
  },

  /**
   * Admin marks order as Completed
   */
  markCompleted: async (orderId: string, notes?: string): Promise<Order> => {
    const res = await ordersApi.transitionOrderStatus(orderId, 'completed', {
      notes,
    });
    return res.order;
  },

  /**
   * Updates payment status of an existing order
   */
  updateOrderPaymentStatus: async (orderId: string, paymentStatus: 'unpaid' | 'paid', paidNote?: string): Promise<Order> => {
    if (paymentStatus === 'paid') {
      return ordersApi.confirmPayment(orderId, { adminNotes: paidNote });
    }
    const response = await api.patch(`/orders/${orderId}/`, {
      payment_status: paymentStatus,
      paymentStatus: paymentStatus,
      notes: paidNote || `Payment marked as ${paymentStatus.toUpperCase()} by admin.`,
    });
    return mapBackendOrderToFrontend(response.data.order || response.data);
  },

  /**
   * Triggers asynchronous order confirmation email resend
   */
  resendConfirmation: async (orderId: string): Promise<{ success: boolean; task_id: string; message: string }> => {
    const response = await api.post(`/orders/${orderId}/resend-confirmation/`);
    return response.data;
  },
};
