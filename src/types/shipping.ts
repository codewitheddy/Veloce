/**
 * Shipping & Delivery Pricing Engine Types
 */

export interface ShippingZone {
  id: string;
  name: string;
  description?: string;
  minDistanceKm: number;
  maxDistanceKm: number;
  baseFee: number;
  perKmRate: number;
  isActive: boolean;
  regions?: string[];
  estimatedDeliveryTime?: string;
}

export interface ShippingRate {
  id: string;
  zoneId: string;
  name: string;
  minOrderSubtotal: number;
  maxOrderSubtotal?: number;
  rateFee: number;
  freeThreshold?: number;
  isExpress?: boolean;
  expressSurcharge?: number;
}

export interface HappyHourWindow {
  id: string;
  name: string;
  startTime: string; // HH:mm format, e.g. "14:00"
  endTime: string;   // HH:mm format, e.g. "16:00"
  daysOfWeek: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  discountPercentage: number; // e.g. 50 for 50% discount
  flatDiscount?: number;
  isActive: boolean;
  description?: string;
}

export interface DeliveryFeeCalculation {
  subtotal: number;
  distanceKm: number;
  zone?: ShippingZone;
  happyHour?: HappyHourWindow;
  fee: number;
  originalFee: number;
  discount: number;
  reason: 'happy_hour' | 'free_threshold' | 'distance_based' | 'out_of_range';
  reasonDescription: string;
  isFreeDelivery: boolean;
  isHappyHourApplied: boolean;
  estimatedTimeframe: string;
}
