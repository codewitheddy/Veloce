/**
 * Delivery Engine Service
 * Calculates layered delivery fees based on order threshold, distance, happy hour promotions, and delivery urgency.
 */

export type DeliveryReasonCode = 'happy_hour' | 'free_threshold' | 'distance_based' | 'out_of_range';

export interface DeliveryCalculationParams {
  orderSubtotal: number;
  distanceKm: number;
  isHappyHour?: boolean;
  orderTime?: Date | string;
  isExpress?: boolean;
  freeDeliveryThreshold?: number; // Default: 5000 KES
  baseDistanceKm?: number;        // Default: 5 km
  baseFee?: number;               // Default: 200 KES
  perKmRate?: number;             // Default: 30 KES/km after base distance
  maxDistanceKm?: number;         // Default: 50 km
}

export interface DeliveryCalculationResult {
  fee: number;
  originalFee: number;
  discount: number;
  reason: string;
  reasonCode: DeliveryReasonCode;
  isFreeDelivery: boolean;
  isHappyHourApplied: boolean;
  estimatedTimeframe: string;
  estimatedMinutesMin: number;
  estimatedMinutesMax: number;
  breakdown: {
    baseFee: number;
    distanceFee: number;
    expressSurcharge: number;
    discountAmount: number;
  };
}

/**
 * Helper to check if a given date or current time falls within Happy Hour window (e.g., 14:00 - 16:00).
 */
export function isCurrentHappyHour(time?: Date | string): boolean {
  const dateObj = time ? new Date(time) : new Date();
  const hours = dateObj.getHours();
  // Happy Hour: 2 PM (14:00) to 4 PM (16:00)
  return hours >= 14 && hours < 16;
}

/**
 * Calculates delivery fee incorporating layered rules:
 * Layer 1: Distance-based calculation (Base fee + per-km rate above base distance)
 * Layer 2: Free Threshold evaluation (e.g. Orders >= KES 5,000 get 100% free delivery)
 * Layer 3: Happy Hour promotion discount (e.g. 50% off delivery fee during happy hour)
 */
export function calculate_delivery_fee(params: DeliveryCalculationParams): DeliveryCalculationResult {
  const {
    orderSubtotal,
    distanceKm,
    isExpress = false,
    freeDeliveryThreshold = 5000,
    baseDistanceKm = 5,
    baseFee = 200,
    perKmRate = 30,
    maxDistanceKm = 50
  } = params;

  const validDistance = Math.max(0, distanceKm);
  const validSubtotal = Math.max(0, orderSubtotal);

  // Check out of range
  if (validDistance > maxDistanceKm) {
    return {
      fee: 0,
      originalFee: 0,
      discount: 0,
      reason: `Location is beyond maximum delivery radius (${maxDistanceKm} km)`,
      reasonCode: 'out_of_range',
      isFreeDelivery: false,
      isHappyHourApplied: false,
      estimatedTimeframe: 'Delivery Unavailable',
      estimatedMinutesMin: 0,
      estimatedMinutesMax: 0,
      breakdown: {
        baseFee: 0,
        distanceFee: 0,
        expressSurcharge: 0,
        discountAmount: 0
      }
    };
  }

  // 1. Layer 1: Base Distance Calculation
  const calculatedBase = baseFee;
  const extraKm = Math.max(0, validDistance - baseDistanceKm);
  const distanceFee = Math.round(extraKm * perKmRate);
  const expressSurcharge = isExpress ? 150 : 0;

  const grossFee = calculatedBase + distanceFee + expressSurcharge;

  // Check Happy Hour
  const happyHourActive = params.isHappyHour !== undefined
    ? params.isHappyHour
    : isCurrentHappyHour(params.orderTime);

  let finalFee = grossFee;
  let discountAmount = 0;
  let reason = '';
  let reasonCode: DeliveryReasonCode = 'distance_based';
  let isFreeDelivery = false;
  let isHappyHourApplied = false;

  // 2. Layer 2: Free Delivery Threshold
  if (validSubtotal >= freeDeliveryThreshold) {
    isFreeDelivery = true;
    discountAmount = grossFee;
    finalFee = 0;
    reasonCode = 'free_threshold';
    reason = `Free Delivery applied for orders over KES ${freeDeliveryThreshold.toLocaleString('en-KE')}`;
  } 
  // 3. Layer 3: Happy Hour Discount (50% off delivery fee)
  else if (happyHourActive) {
    isHappyHourApplied = true;
    discountAmount = Math.round(grossFee * 0.5);
    finalFee = grossFee - discountAmount;
    reasonCode = 'happy_hour';
    reason = `Happy Hour 50% discount applied! (Saved KES ${discountAmount.toLocaleString('en-KE')})`;
  } else {
    reasonCode = 'distance_based';
    if (validDistance <= baseDistanceKm) {
      reason = `Standard Local Delivery within ${baseDistanceKm} km zone`;
    } else {
      reason = `Standard Distance Delivery (${validDistance.toFixed(1)} km)`;
    }
    if (isExpress) {
      reason += ' (Express Rush Service)';
    }
  }

  // 4. Timeframe Estimation
  let minutesMin = 30;
  let minutesMax = 45;
  let timeframeText = '30-45 minutes';

  if (validDistance <= 3) {
    minutesMin = 20;
    minutesMax = 35;
    timeframeText = '20-35 minutes';
  } else if (validDistance <= 8) {
    minutesMin = 35;
    minutesMax = 50;
    timeframeText = '35-50 minutes';
  } else if (validDistance <= 15) {
    minutesMin = 60;
    minutesMax = 90;
    timeframeText = '1-1.5 hours';
  } else {
    minutesMin = 120;
    minutesMax = 180;
    timeframeText = '2-3 hours (Same-day regional)';
  }

  if (isExpress) {
    minutesMin = Math.max(15, Math.round(minutesMin * 0.65));
    minutesMax = Math.max(25, Math.round(minutesMax * 0.65));
    timeframeText = `${minutesMin}-${minutesMax} minutes (Express Priority)`;
  }

  return {
    fee: finalFee,
    originalFee: grossFee,
    discount: discountAmount,
    reason,
    reasonCode,
    isFreeDelivery,
    isHappyHourApplied,
    estimatedTimeframe: timeframeText,
    estimatedMinutesMin: minutesMin,
    estimatedMinutesMax: minutesMax,
    breakdown: {
      baseFee: calculatedBase,
      distanceFee,
      expressSurcharge,
      discountAmount
    }
  };
}

// CamelCase alias for versatility
export const calculateDeliveryFee = calculate_delivery_fee;
