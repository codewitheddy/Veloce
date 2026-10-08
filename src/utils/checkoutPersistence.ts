/**
 * Checkout Session Persistence
 * Saves and restores checkout state to localStorage to maintain session on page refresh
 */

export interface CheckoutSessionState {
  activeStep: 1 | 2 | 3 | 4;
  fulfillmentMethod: 'delivery' | 'pickup';
  selectedWarehouseId: string;
  // Customer info
  firstName: string;
  lastName: string;
  customerEmail: string;
  customerPhone: string;
  isGuest: boolean;
  // Shipping info
  shippingAddress: string;
  shippingCity: string;
  shippingZip: string;
  areaEstate?: string;
  landmark?: string;
  preferredCourier?: string;
  pickupMtaaniPoint?: string;
  // Delivery options
  isExpressDelivery: boolean;
  customDistanceKm: number | null;
  // Pickup info
  pickupContactName: string;
  pickupContactPhone: string;
  // Payment
  paymentMethod: string;
  mpesaPhone: string;
  // Coupon
  appliedCouponCode: string;
  // Timestamps
  savedAt: number;
}

const CHECKOUT_SESSION_KEY = 'ropenix_checkout_session';
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Save current checkout state to localStorage
 */
export function saveCheckoutSession(state: Partial<CheckoutSessionState>): void {
  try {
    const sessionData: CheckoutSessionState = {
      activeStep: state.activeStep || 1,
      fulfillmentMethod: state.fulfillmentMethod || 'delivery',
      selectedWarehouseId: state.selectedWarehouseId || 'nairobi-central',
      firstName: state.firstName || '',
      lastName: state.lastName || '',
      customerEmail: state.customerEmail || '',
      customerPhone: state.customerPhone || '',
      isGuest: state.isGuest !== undefined ? state.isGuest : true,
      shippingAddress: state.shippingAddress || '',
      shippingCity: state.shippingCity || 'Nairobi',
      shippingZip: state.shippingZip || '00100',
      areaEstate: state.areaEstate || '',
      landmark: state.landmark || '',
      preferredCourier: state.preferredCourier || 'any',
      pickupMtaaniPoint: state.pickupMtaaniPoint || '',
      isExpressDelivery: state.isExpressDelivery || false,
      customDistanceKm: state.customDistanceKm || null,
      pickupContactName: state.pickupContactName || '',
      pickupContactPhone: state.pickupContactPhone || '',
      paymentMethod: state.paymentMethod || 'mpesa',
      mpesaPhone: state.mpesaPhone || '',
      appliedCouponCode: state.appliedCouponCode || '',
      savedAt: Date.now()
    };

    localStorage.setItem(CHECKOUT_SESSION_KEY, JSON.stringify(sessionData));
  } catch (error) {
    console.warn('[CheckoutPersistence] Failed to save checkout session:', error);
  }
}

/**
 * Restore checkout state from localStorage
 * Returns null if no valid session is found or session has expired
 */
export function restoreCheckoutSession(): CheckoutSessionState | null {
  try {
    const stored = localStorage.getItem(CHECKOUT_SESSION_KEY);
    if (!stored) {
      return null;
    }

    const session: CheckoutSessionState = JSON.parse(stored);

    // Check if session has expired
    if (Date.now() - session.savedAt > SESSION_EXPIRY_MS) {
      clearCheckoutSession();
      return null;
    }

    return session;
  } catch (error) {
    console.warn('[CheckoutPersistence] Failed to restore checkout session:', error);
    return null;
  }
}

/**
 * Check if user is currently in checkout session
 */
export function hasCheckoutSession(): boolean {
  try {
    const stored = localStorage.getItem(CHECKOUT_SESSION_KEY);
    if (!stored) {
      return false;
    }

    const session: CheckoutSessionState = JSON.parse(stored);
    // Check if not expired
    return Date.now() - session.savedAt < SESSION_EXPIRY_MS;
  } catch {
    return false;
  }
}

/**
 * Clear checkout session from localStorage
 */
export function clearCheckoutSession(): void {
  try {
    localStorage.removeItem(CHECKOUT_SESSION_KEY);
  } catch (error) {
    console.warn('[CheckoutPersistence] Failed to clear checkout session:', error);
  }
}

/**
 * Get only the active step from saved session
 */
export function getSavedCheckoutStep(): 1 | 2 | 3 | 4 | null {
  const session = restoreCheckoutSession();
  return session?.activeStep || null;
}
