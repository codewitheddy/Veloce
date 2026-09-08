/**
 * Delivery Engine Service
 * Calculates layered delivery fees based on order subtotal threshold, distance,
 * zone-specific matrices, Happy Hour promotional schedules, and rush delivery urgency.
 */

import { ShippingZone, HappyHourWindow } from '../types/shipping';

export type DeliveryReasonCode = 'happy_hour' | 'free_threshold' | 'zone_matrix' | 'distance_based' | 'out_of_range';

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
  expressSurcharge?: number;      // Default: 150 KES
  zones?: ShippingZone[];
  happyHours?: HappyHourWindow[];
  selectedRegion?: string;
}

export interface DeliveryCalculationResult {
  fee: number;
  originalFee: number;
  discount: number;
  reason: string;
  reasonCode: DeliveryReasonCode;
  isFreeDelivery: boolean;
  isHappyHourApplied: boolean;
  activeHappyHour?: HappyHourWindow;
  matchedZone?: ShippingZone;
  amountRemainingForFreeShipping: number;
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
 * Helper to check if a given datetime falls within a specific Happy Hour Window
 */
export function isWithinHappyHourWindow(window: HappyHourWindow, time?: Date | string): boolean {
  if (!window.isActive) return false;

  const dateObj = time ? new Date(time) : new Date();
  const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // Check active days of week
  if (window.daysOfWeek && window.daysOfWeek.length > 0 && !window.daysOfWeek.includes(dayOfWeek)) {
    return false;
  }

  // Parse start and end time (e.g. "14:00", "16:00")
  const currentMinutes = dateObj.getHours() * 60 + dateObj.getMinutes();

  const [startHour, startMin] = (window.startTime || '14:00').split(':').map(Number);
  const [endHour, endMin] = (window.endTime || '16:00').split(':').map(Number);

  const startMinutes = (startHour || 0) * 60 + (startMin || 0);
  const endMinutes = (endHour || 0) * 60 + (endMin || 0);

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Returns the active Happy Hour window if current or provided time matches any schedule
 */
export function getActiveHappyHourWindow(
  happyHours?: HappyHourWindow[],
  time?: Date | string
): HappyHourWindow | undefined {
  if (!happyHours || happyHours.length === 0) return undefined;
  return happyHours.find((hh) => isWithinHappyHourWindow(hh, time));
}

/**
 * Default quick check for standard 14:00 - 16:00 happy hour
 */
export function isCurrentHappyHour(time?: Date | string): boolean {
  const dateObj = time ? new Date(time) : new Date();
  const hours = dateObj.getHours();
  return hours >= 14 && hours < 16;
}

/**
 * Match best shipping zone for a given distance and optional region name
 */
export function matchShippingZone(
  distanceKm: number,
  zones?: ShippingZone[],
  regionName?: string
): ShippingZone | undefined {
  if (!zones || zones.length === 0) return undefined;

  const activeZones = zones.filter((z) => z.isActive);

  // 1. Try matching by explicit region keyword if provided
  if (regionName) {
    const regionLower = regionName.toLowerCase();
    const regionMatch = activeZones.find((z) =>
      z.regions?.some((r) => regionLower.includes(r.toLowerCase()))
    );
    if (regionMatch) return regionMatch;
  }

  // 2. Match by distance interval [minDistanceKm, maxDistanceKm]
  return activeZones.find((z) => distanceKm >= z.minDistanceKm && distanceKm <= z.maxDistanceKm);
}

/**
 * Calculates delivery fee incorporating layered rules:
 * Layer 1: Zone matrix or Distance-based calculation (Base fee + per-km rate)
 * Layer 2: Free Threshold evaluation (e.g. Orders >= KES 5,000 get 100% free delivery)
 * Layer 3: Happy Hour promotional discounts (e.g. 50% off delivery fee during active windows)
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
    maxDistanceKm = 50,
    expressSurcharge = 150,
    zones,
    happyHours,
    selectedRegion,
    orderTime
  } = params;

  const validDistance = Math.max(0, distanceKm);
  const validSubtotal = Math.max(0, orderSubtotal);

  // Match zone
  const matchedZone = matchShippingZone(validDistance, zones, selectedRegion);
  const effectiveMaxDistance = matchedZone ? Math.max(matchedZone.maxDistanceKm, maxDistanceKm) : maxDistanceKm;

  // Check out of range
  if (validDistance > effectiveMaxDistance) {
    return {
      fee: 0,
      originalFee: 0,
      discount: 0,
      reason: `Location (${validDistance.toFixed(1)} km) is beyond maximum delivery radius (${effectiveMaxDistance} km)`,
      reasonCode: 'out_of_range',
      isFreeDelivery: false,
      isHappyHourApplied: false,
      amountRemainingForFreeShipping: Math.max(0, freeDeliveryThreshold - validSubtotal),
      estimatedTimeframe: 'Delivery Unavailable (Out of Service Area)',
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

  // 1. Layer 1: Distance & Zone Pricing Calculation
  let calculatedBase = baseFee;
  let distanceFee = 0;

  if (matchedZone) {
    calculatedBase = matchedZone.baseFee;
    const extraKmInZone = Math.max(0, validDistance - matchedZone.minDistanceKm);
    distanceFee = Math.round(extraKmInZone * (matchedZone.perKmRate || 0));
  } else {
    calculatedBase = baseFee;
    const extraKm = Math.max(0, validDistance - baseDistanceKm);
    distanceFee = Math.round(extraKm * perKmRate);
  }

  const expressCost = isExpress ? expressSurcharge : 0;
  const grossFee = calculatedBase + distanceFee + expressCost;

  // Check Happy Hour schedule
  const activeHappyHour = happyHours && happyHours.length > 0
    ? getActiveHappyHourWindow(happyHours, orderTime)
    : undefined;

  const isHappyHourActive = params.isHappyHour !== undefined
    ? params.isHappyHour
    : Boolean(activeHappyHour) || isCurrentHappyHour(orderTime);

  let finalFee = grossFee;
  let discountAmount = 0;
  let reason = '';
  let reasonCode: DeliveryReasonCode = 'distance_based';
  let isFreeDelivery = false;
  let isHappyHourApplied = false;

  // 2. Layer 2: Free Delivery Threshold
  if (freeDeliveryThreshold > 0 && validSubtotal >= freeDeliveryThreshold) {
    isFreeDelivery = true;
    discountAmount = grossFee;
    finalFee = 0;
    reasonCode = 'free_threshold';
    reason = `Free Delivery applied on orders over KSh ${freeDeliveryThreshold.toLocaleString('en-KE')}`;
  }
  // 3. Layer 3: Happy Hour Promotional Window
  else if (isHappyHourActive) {
    isHappyHourApplied = true;
    const discountPct = activeHappyHour ? activeHappyHour.discountPercentage : 50;
    const flatDiscount = activeHappyHour?.flatDiscount || 0;

    if (flatDiscount > 0) {
      discountAmount = Math.min(grossFee, flatDiscount);
    } else {
      discountAmount = Math.round(grossFee * (discountPct / 100));
    }

    finalFee = Math.max(0, grossFee - discountAmount);
    reasonCode = 'happy_hour';
    reason = activeHappyHour
      ? `⚡ ${activeHappyHour.name} applied: ${discountPct}% off (Saved KSh ${discountAmount.toLocaleString('en-KE')})`
      : `⚡ Happy Hour 50% discount applied! (Saved KSh ${discountAmount.toLocaleString('en-KE')})`;
  } else {
    reasonCode = matchedZone ? 'zone_matrix' : 'distance_based';
    if (matchedZone) {
      reason = `${matchedZone.name} Rate (${validDistance.toFixed(1)} km)`;
    } else if (validDistance <= baseDistanceKm) {
      reason = `Standard Local Delivery within ${baseDistanceKm} km`;
    } else {
      reason = `Distance-based Delivery (${validDistance.toFixed(1)} km)`;
    }

    if (isExpress) {
      reason += ' • Express Priority';
    }
  }

  // 4. Timeframe Estimation
  let minutesMin = 25;
  let minutesMax = 45;
  let timeframeText = matchedZone?.estimatedDeliveryTime || '30-45 minutes';

  if (!matchedZone?.estimatedDeliveryTime) {
    if (validDistance <= 4) {
      minutesMin = 20;
      minutesMax = 35;
      timeframeText = '20-35 minutes';
    } else if (validDistance <= 10) {
      minutesMin = 35;
      minutesMax = 50;
      timeframeText = '35-50 minutes';
    } else if (validDistance <= 22) {
      minutesMin = 60;
      minutesMax = 90;
      timeframeText = '1-1.5 hours';
    } else {
      minutesMin = 120;
      minutesMax = 180;
      timeframeText = '2-3 hours (Regional Express)';
    }
  }

  if (isExpress) {
    minutesMin = Math.max(15, Math.round(minutesMin * 0.6));
    minutesMax = Math.max(25, Math.round(minutesMax * 0.6));
    timeframeText = `${minutesMin}-${minutesMax} mins (Express Priority)`;
  }

  const amountRemainingForFreeShipping = Math.max(0, freeDeliveryThreshold - validSubtotal);

  return {
    fee: finalFee,
    originalFee: grossFee,
    discount: discountAmount,
    reason,
    reasonCode,
    isFreeDelivery,
    isHappyHourApplied,
    activeHappyHour,
    matchedZone,
    amountRemainingForFreeShipping,
    estimatedTimeframe: timeframeText,
    estimatedMinutesMin: minutesMin,
    estimatedMinutesMax: minutesMax,
    breakdown: {
      baseFee: calculatedBase,
      distanceFee,
      expressSurcharge: expressCost,
      discountAmount
    }
  };
}

export const calculateDeliveryFee = calculate_delivery_fee;
