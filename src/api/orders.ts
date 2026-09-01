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
  return {
    id: String(ord.id || ''),
    customerName: ord.customer_name || ord.customerName || 'Customer',
    customerEmail: ord.customer_email || ord.customerEmail || '',
    phone: ord.customer_phone || ord.phone || '',
    total: typeof ord.total === 'number' ? ord.total : parseFloat(ord.total || '0'),
    subtotal: ord.subtotal ? parseFloat(ord.subtotal) : undefined,
    shippingFee: ord.shipping_fee ? parseFloat(ord.shipping_fee) : undefined,
    tax: ord.tax_amount ? parseFloat(ord.tax_amount) : undefined,
    discount: ord.discount ? parseFloat(ord.discount) : undefined,
    status: (ord.status ? ord.status.toLowerCase() : 'pending') as Order['status'],
    date: ord.created_at ? ord.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
    shippingAddress: ord.shipping_address || '',
    paymentMethod: ord.payment_method === 'Cash on Delivery' ? 'cod' : 'mpesa',
    couponCode: ord.affiliate_code || '',
    trackingNumber: ord.tracking_number || '',
    notes: ord.notes || '',
    items: Array.isArray(ord.items)
      ? ord.items.map((it: any) => ({
          productId: String(it.product || it.id || ''),
          name: it.product_name || 'Product Item',
          price: typeof it.unit_price === 'number' ? it.unit_price : parseFloat(it.unit_price || '0'),
          quantity: Number(it.quantity || 1),
          selectedVariations: it.selected_variations || {},
          type: 'physical',
        }))
      : [],
    statusHistory: ord.status_history || [
      {
        status: ord.status || 'pending',
        timestamp: ord.created_at || new Date().toISOString(),
        note: `Order recorded with status: ${ord.status || 'pending'}`,
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
   * Creates a new order (with atomic inventory locking and Celery on-commit hooks)
   */
  createOrder: async (orderData: Partial<Order>): Promise<Order> => {
    const payload = {
      id: orderData.id || undefined,
      customer_name: (orderData.customerName || 'Customer').trim(),
      customer_email: (orderData.customerEmail || '').trim(),
      customer_phone: (orderData.phone || '').trim(),
      subtotal: orderData.subtotal,
      discount: orderData.discount || 0,
      shipping_fee: orderData.shippingFee || 0,
      tax_amount: orderData.tax || 0,
      total: orderData.total,
      status: orderData.status === 'completed' ? 'Processing' : (orderData.status ? orderData.status.charAt(0).toUpperCase() + orderData.status.slice(1) : 'Pending'),
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
   * Updates status of an existing order
   */
  updateOrderStatus: async (orderId: string, status: string, trackingNumber?: string): Promise<Order> => {
    const response = await api.patch(`/orders/${orderId}/`, {
      status,
      tracking_number: trackingNumber,
    });
    return mapBackendOrderToFrontend(response.data);
  },

  /**
   * Triggers Celery asynchronous order confirmation email resend
   */
  resendConfirmation: async (orderId: string): Promise<{ success: boolean; task_id: string; message: string }> => {
    const response = await api.post(`/orders/${orderId}/resend-confirmation/`);
    return response.data;
  },
};
