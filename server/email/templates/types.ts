/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OrderItemEmailData {
  name: string;
  quantity: number;
  price: number;
  selectedVariations?: Record<string, any>;
  sku?: string;
  image?: string;
}

export interface OrderEmailData {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: OrderItemEmailData[];
  subtotal?: number;
  shippingFee?: number;
  discount?: number;
  tax?: number;
  total: number;
  paymentMethod?: string;
  paymentStatus?: string;
  shippingAddress?: string;
  trackingNumber?: string;
  courierName?: string;
  estimatedDelivery?: string;
  notes?: string;
  createdAt?: string;
  isGuest?: boolean;
  userId?: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}
