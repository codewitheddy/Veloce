/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, BlogPost, Order, InventoryAuditLog, CouponItem, ReturnRequest } from './types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-oak-riser',
    sku: 'DSK-OAK-001',
    slug: 'solid-walnut-dual-monitor-riser',
    name: 'Solid Walnut Dual Monitor Riser with MagSafe Slot',
    brand: 'Veloce Woodcraft',
    countryOfOrigin: 'Kenya',
    country_of_origin: 'Kenya',
    description: 'Handcrafted from sustainable solid American walnut timber. Integrated magnetic wireless charging dock, dual display capacity, and premium anodized aluminum risers.',
    shortDescription: 'Handcrafted solid walnut dual monitor stand with integrated MagSafe charging pad.',
    detailedDescription: 'Elevate your workspace ergonomics and aesthetic with the Veloce Solid Walnut Dual Monitor Riser. Masterfully carved from kiln-dried Grade-A American Walnut, this desk shelf accommodates two 27-inch displays or an ultrawide monitor with zero flex. Features a recessed magnetic charging bay for Qi/MagSafe devices and felt-padded aluminum feet to protect premium desk surfaces.',
    price: 11900,
    costPrice: 6500,
    cost_price: 6500,
    originalPrice: 13500,
    original_price: 13500,
    previousPrice: 13500,
    category: 'Home & Living',
    tags: ['Desk Setup', 'Walnut', 'Ergonomic', 'Workspace', 'Handmade'],
    type: 'physical',
    imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=800',
    images: [
      'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=800'
    ],
    stock: 14,
    lowStockThreshold: 5,
    rating: 0,
    reviewsCount: 0,
    status: 'Active',
    features: [
      'Solid kiln-dried American Walnut',
      'Integrated 15W Qi/MagSafe charging channel',
      'Holds up to 50kg dual monitor setups',
      'Cork-lined under-shelf organization slot'
    ],
    specifications: [
      { key: 'Dimensions', value: '115cm x 23cm x 11cm' },
      { key: 'Weight', value: '4.2 kg' },
      { key: 'Material', value: 'American Black Walnut & Matte Aluminum' }
    ],
    whatsInTheBox: '1x Solid Walnut Shelf, 2x Anodized Aluminum Risers, 1x MagSafe Fast-Charging Cable, 4x Anti-slip Wool Felt Pads',
    hasVariants: false,
    options: [],
    colorImages: {},
    variantMatrix: [],
    variants: [],
    reviews: []
  },
  {
    id: 'prod-mag-keyboard',
    sku: 'KB-TITAN-75',
    slug: 'veloce-titan-75-cnc-magnetic-keyboard',
    name: 'Veloce Titan 75% CNC Magnetic Hall-Effect Keyboard',
    brand: 'Veloce Tech',
    countryOfOrigin: 'Kenya',
    country_of_origin: 'Kenya',
    description: 'Aerospace-grade CNC aluminum housing, rapid-trigger Hall effect magnetic analog switches, and dynamic per-key RGB backlighting.',
    shortDescription: 'Precision CNC 75% gaming & typing keyboard with magnetic rapid-trigger switches.',
    detailedDescription: 'The Veloce Titan 75 is engineered for uncompromising speed, tactile feedback, and endurance. Built inside an anodized 6063 aerospace aluminum case with custom sound-dampening poron foam gaskets. Features adjustable magnetic switch actuation from 0.1mm to 4.0mm with dynamic RT (Rapid Trigger) capability.',
    price: 24500,
    costPrice: 14500,
    cost_price: 14500,
    originalPrice: 28000,
    original_price: 28000,
    previousPrice: 28000,
    category: 'Electronics',
    tags: ['Keyboard', 'Hall-Effect', 'Gaming', 'Electronics', 'CNC Aluminum'],
    type: 'physical',
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=800',
    images: [
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=800'
    ],
    stock: 19,
    lowStockThreshold: 4,
    rating: 0,
    reviewsCount: 0,
    status: 'Active',
    features: [
      'Rapid Trigger analog magnetic switches',
      '0.1mm - 4.0mm customizable actuation depth',
      'Full CNC 6063 aluminum chassis with brass weight',
      '8000Hz polling rate with ultra-low 0.125ms latency'
    ],
    specifications: [
      { key: 'Layout', value: '75% Compact (82 Keys)' },
      { key: 'Connectivity', value: 'Type-C Detachable Braided Cable + 2.4GHz Wireless' },
      { key: 'Weight', value: '1.85 kg' }
    ],
    whatsInTheBox: '1x Titan 75 Keyboard, 1x Custom Aviator Coiled Cable, 1x 2-in-1 Switch & Keycap Puller, 4x Spare Magnetic Switches',
    hasVariants: false,
    options: [],
    colorImages: {},
    variantMatrix: [],
    variants: [],
    reviews: []
  },
  {
    id: 'prod-streetwear-hoodie',
    sku: 'APP-HDY-480',
    slug: 'ropenix-heavyweight-480gsm-french-terry-hoodie',
    name: 'Ropenix Heavyweight 480GSM French Terry Hoodie',
    brand: 'Ropenix Atelier',
    countryOfOrigin: 'Kenya',
    country_of_origin: 'Kenya',
    description: 'Custom milled 100% organic combed cotton in 480 GSM ultra-heavyweight knit. Double-layered structured hood and signature dropped shoulder fit.',
    shortDescription: 'Luxury heavyweight 480GSM organic cotton oversized streetwear hoodie.',
    detailedDescription: 'Crafted in Nairobi with obsessive attention to fabric weight, drape, and longevity. Milled from sustainably sourced East African organic long-staple cotton, pre-shrunk to guarantee zero size change after washing. Designed with double-needle reverse coverstitching, kangaroo pocket with reinforced bartacks, and seamless ribbed cuffs.',
    price: 6800,
    costPrice: 3200,
    cost_price: 3200,
    originalPrice: 8000,
    original_price: 8000,
    previousPrice: 8000,
    category: 'Fashion',
    tags: ['Streetwear', 'Hoodie', 'Apparel', 'Fashion', 'Organic Cotton'],
    type: 'physical',
    imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&q=80&w=800',
    images: [
      'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&q=80&w=800'
    ],
    stock: 32,
    lowStockThreshold: 8,
    rating: 0,
    reviewsCount: 0,
    status: 'Active',
    features: [
      'Ultra-heavy 480 GSM 100% organic combed French Terry',
      'Double-lined structured hood with zero drawstrings',
      'Pre-shrunk fabric with lint-free soft brushed interior',
      'Relaxed boxy silhouette with dropped shoulders'
    ],
    specifications: [
      { key: 'Material', value: '100% Organic Combed Cotton (480 GSM)' },
      { key: 'Care', value: 'Machine wash cold inside-out, hang dry' },
      { key: 'Origin', value: 'Ethically crafted in Kenya' }
    ],
    whatsInTheBox: '1x Ropenix Heavyweight Hoodie in branded dust bag with authentication card',
    hasVariants: false,
    options: [],
    colorImages: {},
    variantMatrix: [],
    variants: [],
    reviews: []
  },
  {
    id: 'prod-candle-coconut',
    sku: 'BEA-CNDL-01',
    slug: 'swahili-coast-coconut-amber-candle',
    name: 'Swahili Coast Coconut & Amber Hand-Poured Candle',
    brand: 'Kilifi Artisans',
    countryOfOrigin: 'Kenya',
    country_of_origin: 'Kenya',
    description: 'Hand-poured coconut wax with crackling wood wick and aromatic amber fragrance notes from the Kenyan coast.',
    shortDescription: 'Artisanal coconut wax candle with crackling wood wick and coastal amber aroma.',
    detailedDescription: 'Handcrafted in Kilifi using 100% natural coconut soy wax blended with pure essential oils and fragrance essences inspired by the Indian Ocean coastline. Features a sustainable FSC-certified cherry wood wick that crackles soothingly as it burns for up to 60 clean hours.',
    price: 2600,
    costPrice: 1200,
    cost_price: 1200,
    originalPrice: 3200,
    original_price: 3200,
    previousPrice: 3200,
    category: 'Beauty & Fragrances',
    tags: ['Candle', 'Fragrance', 'Handmade', 'Eco-friendly', 'Kilifi'],
    type: 'physical',
    imageUrl: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&q=80&w=800',
    images: [
      'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&q=80&w=800'
    ],
    stock: 22,
    lowStockThreshold: 6,
    rating: 0,
    reviewsCount: 0,
    status: 'Active',
    features: [
      '60+ hours burn time with zero soot',
      'FSC-certified crackling wood wick',
      'Re-usable amber glass apothecary jar with aluminium lid',
      'Non-toxic, phthalate-free, vegan formula'
    ],
    specifications: [
      { key: 'Wax Weight', value: '280g / 9.8 oz' },
      { key: 'Burn Time', value: '55 - 65 hours' },
      { key: 'Vessel', value: 'Amber Apothecary Glass' }
    ],
    whatsInTheBox: '1x Hand-Poured Amber Candle with wooden matchbox',
    hasVariants: false,
    options: [],
    colorImages: {},
    variantMatrix: [],
    variants: [],
    reviews: []
  }
];

export const INITIAL_BLOGS: BlogPost[] = [];

export const INITIAL_ORDERS: Order[] = [];

export const COUPONS: Record<string, CouponItem> = {};

/**
 * Checks if a coupon date string or coupon item has passed the current time.
 */
export function isCouponExpired(couponOrExpiry?: string | number | CouponItem): boolean {
  if (!couponOrExpiry) return false;
  if (typeof couponOrExpiry === 'number') return false;
  const expiryDate = typeof couponOrExpiry === 'string' ? couponOrExpiry : couponOrExpiry.expiryDate;
  if (!expiryDate) return false;
  try {
    const expiry = new Date(expiryDate);
    if (isNaN(expiry.getTime())) return false;
    // If only YYYY-MM-DD was provided, allow until 23:59:59.999 of that day
    if (expiryDate.length === 10) {
      expiry.setHours(23, 59, 59, 999);
    }
    return Date.now() > expiry.getTime();
  } catch {
    return false;
  }
}

/**
 * Checks if a coupon is active (not manually disabled and not expired).
 */
export function isCouponActive(coupon: number | CouponItem | undefined): boolean {
  if (coupon === undefined || coupon === null) return false;
  if (typeof coupon === 'number') return true;
  if (coupon.active === false || coupon.isActive === false) return false;
  if (isCouponExpired(coupon)) return false;
  return true;
}

/**
 * Checks if a coupon was manually toggled off/disabled by an administrator.
 */
export function isCouponManuallyDisabled(coupon: number | CouponItem | undefined): boolean {
  if (coupon === undefined || coupon === null) return false;
  if (typeof coupon === 'number') return false;
  return coupon.active === false || coupon.isActive === false;
}

/**
 * Extracts percentage number from numeric or object coupon.
 */
export function getCouponPercent(coupon: number | CouponItem | undefined): number {
  if (coupon === undefined || coupon === null) return 0;
  if (typeof coupon === 'number') return coupon;
  return typeof coupon.percent === 'number' ? coupon.percent : 0;
}

/**
 * Extracts expiryDate string from numeric or object coupon.
 */
export function getCouponExpiry(coupon: number | CouponItem | undefined): string | undefined {
  if (coupon === undefined || coupon === null || typeof coupon === 'number') return undefined;
  return coupon.expiryDate;
}

/**
 * Formats expiry date for readable UI display.
 */
export function formatCouponExpiry(expiryDate?: string): string {
  if (!expiryDate) return 'No expiry';
  try {
    const d = new Date(expiryDate);
    if (isNaN(d.getTime())) return expiryDate;
    return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return expiryDate;
  }
}

export const INITIAL_AUDIT_LOGS: InventoryAuditLog[] = [];

export const INITIAL_RETURN_REQUESTS: ReturnRequest[] = [
  {
    id: 'RET-2026-0811',
    orderId: 'ORD-90214',
    customerName: 'Wanjiku Mwangi',
    customerEmail: 'wanjiku.mwangi@example.com',
    customerPhone: '+254 712 849 201',
    mpesaPhoneNumber: '0712849201',
    type: 'refund',
    resolutionType: 'refund',
    refundMethod: 'mpesa',
    reason: 'damaged_defective',
    reasonDetails: 'Minor transit dent on the left anodized aluminum riser corner upon unboxing from courier.',
    status: 'pending',
    dateSubmitted: '2026-10-04',
    items: [
      {
        productId: 'prod-oak-riser',
        name: 'Solid Walnut Dual Monitor Riser with MagSafe Slot',
        quantity: 1,
        price: 11900,
        conditionReported: 'opened_unused',
        reason: 'damaged_defective'
      }
    ],
    evidenceImages: [
      'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=800'
    ]
  },
  {
    id: 'RET-2026-0794',
    orderId: 'ORD-89302',
    customerName: 'Brian Kiprop',
    customerEmail: 'brian.kiprop@example.com',
    customerPhone: '+254 722 551 093',
    mpesaPhoneNumber: '0722551093',
    type: 'exchange',
    resolutionType: 'replacement',
    reason: 'size_fit_issue',
    reasonDetails: 'Requested swap for full-size numpad edition instead of 75% compact format.',
    status: 'approved',
    trackingNumber: 'RET-G4S-NBO-88192',
    dateSubmitted: '2026-10-03',
    adminNote: 'Pickup scheduled via G4S Express Courier Nairobi. Replacement reserved.',
    items: [
      {
        productId: 'prod-mag-keyboard',
        name: 'Titan Pro 75% Wireless Mechanical Keyboard',
        quantity: 1,
        price: 8500,
        conditionReported: 'opened_unused',
        reason: 'size_fit_issue'
      }
    ],
    evidenceImages: [
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=600'
    ]
  },
  {
    id: 'RET-2026-0780',
    orderId: 'ORD-88190',
    customerName: 'Fatuma Hassan',
    customerEmail: 'fatuma.hassan@example.com',
    customerPhone: '+254 733 902 411',
    mpesaPhoneNumber: '0733902411',
    type: 'refund',
    resolutionType: 'refund',
    refundMethod: 'mpesa',
    reason: 'wrong_item',
    reasonDetails: 'Ordered Navy Blue 42R, but received Charcoal Grey 40R from warehouse batch.',
    status: 'in_transit',
    trackingNumber: 'RET-FARGO-MSA-10492',
    dateSubmitted: '2026-10-01',
    adminNote: 'Parcel en route from Mombasa Depot to Central Inspection Facility.',
    items: [
      {
        productId: 'prod-suit-blazer',
        name: 'Italian Wool Executive Slim-Fit Blazer',
        quantity: 1,
        price: 14500,
        conditionReported: 'unopened',
        reason: 'wrong_item'
      }
    ],
    evidenceImages: [
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&q=80&w=800'
    ]
  },
  {
    id: 'RET-2026-0752',
    orderId: 'ORD-86412',
    customerName: 'David Ochieng',
    customerEmail: 'david.ochieng@example.com',
    customerPhone: '+254 701 448 392',
    mpesaPhoneNumber: '0701448392',
    type: 'refund',
    resolutionType: 'refund',
    refundMethod: 'mpesa',
    reason: 'not_as_described',
    reasonDetails: 'Customer noted fabric mesh finish differs slightly from high-gloss catalog photo.',
    status: 'resolved',
    trackingNumber: 'RET-SENDY-NBO-49102',
    adminNote: 'Item inspected at Nairobi Central Depot. M-Pesa B2C instant payout executed (Ref: MPESA-B2C-982104). Restocked as Grade A.',
    dateSubmitted: '2026-09-28',
    items: [
      {
        productId: 'prod-desk-chair',
        name: 'Ergonomic Lumbar Executive Task Chair',
        quantity: 1,
        price: 18900,
        conditionReported: 'opened_unused',
        reason: 'not_as_described'
      }
    ],
    evidenceImages: [
      'https://images.unsplash.com/photo-1580481077197-28564e9a65d5?auto=format&fit=crop&q=80&w=800'
    ]
  },
  {
    id: 'RET-2026-0731',
    orderId: 'ORD-85109',
    customerName: 'Mercy Chebet',
    customerEmail: 'mercy.chebet@example.com',
    customerPhone: '+254 718 203 910',
    mpesaPhoneNumber: '0718203910',
    type: 'refund',
    resolutionType: 'refund',
    refundMethod: 'mpesa',
    reason: 'changed_mind',
    reasonDetails: 'Claim submitted 22 days after delivery (exceeds 7-day return policy window).',
    status: 'rejected',
    adminNote: 'Claim exceeds 7-day return policy terms. Customer advised on warranty repair service.',
    dateSubmitted: '2026-09-25',
    items: [
      {
        productId: 'prod-headset-studio',
        name: 'Wireless Noise-Cancelling Studio Headset',
        quantity: 1,
        price: 9200,
        conditionReported: 'used',
        reason: 'changed_mind'
      }
    ],
    evidenceImages: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=800'
    ]
  }
];

