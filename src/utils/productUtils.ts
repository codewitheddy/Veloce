import { Product } from '../types';

export type CategoryClassification = 'clothing' | 'food' | 'beauty' | 'general';

export const COMMON_ALLERGENS = [
  'Peanuts',
  'Tree Nuts',
  'Milk / Dairy',
  'Gluten / Wheat',
  'Soy / Soybeans',
  'Eggs',
  'Fish',
  'Shellfish / Crustaceans',
  'Sesame Seeds',
  'Mustard',
  'Celery',
  'Lupin',
  'Sulphites',
  'Molluscs',
];

export const COMMON_COUNTRIES = [
  'Kenya',
  'United Kingdom',
  'United States',
  'Germany',
  'France',
  'Italy',
  'Switzerland',
  'China',
  'Japan',
  'South Korea',
  'India',
  'South Africa',
  'United Arab Emirates',
  'Turkey',
  'Brazil',
  'Canada',
  'Australia',
  'Netherlands',
];

export const COMMON_SIZES = [
  'XS',
  'S',
  'M',
  'L',
  'XL',
  '2XL',
  '3XL',
  'EU 36',
  'EU 37',
  'EU 38',
  'EU 39',
  'EU 40',
  'EU 41',
  'EU 42',
  'EU 43',
  'EU 44',
  'EU 45',
  'UK 5',
  'UK 6',
  'UK 7',
  'UK 8',
  'UK 9',
  'UK 10',
  'US 6',
  'US 7',
  'US 8',
  'US 9',
  'US 10',
  'US 11',
];

/**
 * Determine the category type (Clothing, Food, Beauty, or General)
 */
export const getCategoryType = (categoryName: string = ''): CategoryClassification => {
  const lower = categoryName.toLowerCase().trim();
  if (
    lower.includes('cloth') ||
    lower.includes('wear') ||
    lower.includes('apparel') ||
    lower.includes('footwear') ||
    lower.includes('shoe') ||
    lower.includes('shirt') ||
    lower.includes('jacket') ||
    lower.includes('dress') ||
    lower.includes('trousers') ||
    lower.includes('pants')
  ) {
    return 'clothing';
  }
  if (
    lower.includes('food') ||
    lower.includes('beverage') ||
    lower.includes('drink') ||
    lower.includes('grocery') ||
    lower.includes('snack') ||
    lower.includes('supermarket') ||
    lower.includes('coffee') ||
    lower.includes('tea') ||
    lower.includes('edible')
  ) {
    return 'food';
  }
  if (
    lower.includes('perfume') ||
    lower.includes('beauty') ||
    lower.includes('cosmetics') ||
    lower.includes('skincare') ||
    lower.includes('fragrance') ||
    lower.includes('makeup') ||
    lower.includes('personal care') ||
    lower.includes('lotion') ||
    lower.includes('body care')
  ) {
    return 'beauty';
  }
  return 'general';
};

/**
 * Standard category to subcategories taxonomy mapping
 */
export const DEFAULT_CATEGORY_SUBCATEGORIES: Record<string, string[]> = {
  'Food & Beverages': [
    'Dry Food (Grains, Pasta, Cereals)',
    'Fresh Food (Produce, Dairy, Meat)',
    'Perishables & Bakery',
    'Cold Beverages & Juices',
    'Hot Beverages (Coffee & Tea)',
    'Snacks & Confectionery',
    'Canned & Packaged Goods',
    'Condiments, Sauces & Spices',
  ],
  'Food': [
    'Dry Food (Grains, Pasta, Cereals)',
    'Fresh Food (Produce, Dairy, Meat)',
    'Perishables & Bakery',
    'Cold Beverages & Juices',
    'Hot Beverages (Coffee & Tea)',
    'Snacks & Confectionery',
    'Canned & Packaged Goods',
    'Condiments, Sauces & Spices',
  ],
  'Clothes & Wearables': [
    "Men's Clothing",
    "Women's Clothing",
    "Footwear & Sneakers",
    'Outerwear & Jackets',
    'Bags & Fashion Accessories',
    'Activewear & Sportswear',
    'Kids & Baby Wear',
  ],
  'Clothing': [
    "Men's Clothing",
    "Women's Clothing",
    "Footwear & Sneakers",
    'Outerwear & Jackets',
    'Bags & Fashion Accessories',
    'Activewear & Sportswear',
    'Kids & Baby Wear',
  ],
  'Perfumes & Beauty Products': [
    'Perfumes & Fine Fragrances',
    'Skincare & Facial Serums',
    'Hair Care & Styling Products',
    'Makeup & Decorative Cosmetics',
    'Body Care & Bath Essences',
    'Personal Hygiene & Grooming',
  ],
  'Beauty': [
    'Perfumes & Fine Fragrances',
    'Skincare & Facial Serums',
    'Hair Care & Styling Products',
    'Makeup & Decorative Cosmetics',
    'Body Care & Bath Essences',
    'Personal Hygiene & Grooming',
  ],
  'Electronics & Tech': [
    'Smartphones & Accessories',
    'Audio, Headphones & Speakers',
    'Laptops & Computers',
    'Wearables & Smartwatches',
    'Smart Home Devices',
    'Cameras & Photography',
  ],
  'Electronics': [
    'Smartphones & Accessories',
    'Audio, Headphones & Speakers',
    'Laptops & Computers',
    'Wearables & Smartwatches',
    'Smart Home Devices',
    'Cameras & Photography',
  ],
  'Home & Living': [
    'Kitchenware & Appliances',
    'Furniture & Home Decor',
    'Bedding & Bath Linens',
    'Storage & Home Organization',
  ],
  'Sports & Outdoors': [
    'Fitness & Gym Equipment',
    'Outdoor & Camping Gear',
    'Sports Apparel & Protection',
  ],
  'Digital & Services': [
    'Software & Subscriptions',
    'E-Books & Digital Downloads',
    'Consulting & Professional Services',
  ],
};

/**
 * Retrieve suggested subcategories for a given category name
 */
export const getSubcategoriesForCategory = (categoryName: string = ''): string[] => {
  if (!categoryName) return [];

  const catTrim = categoryName.trim();
  if (DEFAULT_CATEGORY_SUBCATEGORIES[catTrim]) {
    return DEFAULT_CATEGORY_SUBCATEGORIES[catTrim];
  }

  const catLower = catTrim.toLowerCase();
  for (const [key, list] of Object.entries(DEFAULT_CATEGORY_SUBCATEGORIES)) {
    if (
      key.toLowerCase() === catLower ||
      catLower.includes(key.toLowerCase()) ||
      key.toLowerCase().includes(catLower)
    ) {
      return list;
    }
  }

  const type = getCategoryType(categoryName);
  if (type === 'food') return DEFAULT_CATEGORY_SUBCATEGORIES['Food & Beverages'];
  if (type === 'clothing') return DEFAULT_CATEGORY_SUBCATEGORIES['Clothes & Wearables'];
  if (type === 'beauty') return DEFAULT_CATEGORY_SUBCATEGORIES['Perfumes & Beauty Products'];

  return [];
};

/**
 * Calculate the number of days remaining until expiry date.
 * Returns negative numbers if already expired.
 */
export const getDaysUntilExpiry = (expiryDateStr?: string): number | null => {
  if (!expiryDateStr) return null;
  const expiry = new Date(expiryDateStr);
  if (isNaN(expiry.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export interface ExpiryStatus {
  hasExpiry: boolean;
  daysRemaining: number | null;
  isExpired: boolean;
  isNearExpiry: boolean; // <= 8 days
  isHiddenFromStorefront: boolean;
  badgeLabel: string;
  badgeColorClass: string;
}

/**
 * Get comprehensive expiry status for inventory management & display
 */
export const getExpiryStatus = (product: Product): ExpiryStatus => {
  if (!product.hasExpiryDate || !product.expiryDate) {
    return {
      hasExpiry: false,
      daysRemaining: null,
      isExpired: false,
      isNearExpiry: false,
      isHiddenFromStorefront: false,
      badgeLabel: 'No Expiry Date',
      badgeColorClass: 'bg-gray-100 text-gray-600 border-gray-200',
    };
  }

  const days = getDaysUntilExpiry(product.expiryDate);
  if (days === null) {
    return {
      hasExpiry: true,
      daysRemaining: null,
      isExpired: false,
      isNearExpiry: false,
      isHiddenFromStorefront: false,
      badgeLabel: 'Invalid Expiry Date',
      badgeColorClass: 'bg-amber-100 text-amber-700 border-amber-200',
    };
  }

  const isExpired = days <= 0;
  const isNearExpiry = days <= 8; // Spec rule: <= 8 days triggers automatic storefront removal

  let badgeLabel = '';
  let badgeColorClass = '';

  if (isExpired) {
    badgeLabel = `Expired (${Math.abs(days)}d ago) - Removed from Storefront`;
    badgeColorClass = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
  } else if (isNearExpiry) {
    badgeLabel = `⚠️ Expiry Alert: ${days} day${days === 1 ? '' : 's'} left - Removed from Storefront`;
    badgeColorClass = 'bg-amber-100 text-amber-900 border-amber-300 font-bold animate-pulse';
  } else if (days <= 30) {
    badgeLabel = `Expires in ${days} days`;
    badgeColorClass = 'bg-yellow-50 text-yellow-800 border-yellow-200';
  } else {
    badgeLabel = `Expires: ${product.expiryDate} (${days}d remaining)`;
    badgeColorClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }

  return {
    hasExpiry: true,
    daysRemaining: days,
    isExpired,
    isNearExpiry,
    isHiddenFromStorefront: isNearExpiry,
    badgeLabel,
    badgeColorClass,
  };
};

/**
 * Storefront Visibility Rule:
 * Hide non-active statuses OR products with <= 8 days remaining to expiry date.
 */
export const isProductHiddenFromStorefront = (product: Product): boolean => {
  if (product.status && product.status !== 'Active' && product.status !== 'Inactive') {
    return true;
  }
  if (product.hasExpiryDate && product.expiryDate) {
    const days = getDaysUntilExpiry(product.expiryDate);
    if (days !== null && days <= 8) {
      return true; // Automatically hidden from frontend when 8 days or fewer to expiry
    }
  }
  return false;
};

/**
 * Auto-generate a unique SKU code based on selected category and product name.
 * Pattern: [CAT-CODE]-[PROD-CODE]-[COUNTER]
 * Example: "Food & Beverages" + "Arabica Coffee Beans" -> "FOD-ARCO-101"
 */
export const generateSku = (
  categoryName: string = '',
  productName: string = '',
  existingProducts: Product[] = []
): string => {
  // 1. Category Prefix (3 chars)
  let catPrefix = 'GEN';
  const cleanCatName = categoryName.trim();

  if (cleanCatName) {
    const type = getCategoryType(cleanCatName);
    if (type === 'food') catPrefix = 'FOD';
    else if (type === 'clothing') catPrefix = 'CLO';
    else if (type === 'beauty') catPrefix = 'BEA';
    else {
      const cleanCat = cleanCatName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (cleanCat.length >= 3) {
        catPrefix = cleanCat.substring(0, 3);
      } else if (cleanCat.length > 0) {
        catPrefix = cleanCat.padEnd(3, 'X');
      }
    }
  }

  // 2. Product Name Prefix (3-4 chars)
  let prodPrefix = 'PROD';
  if (productName.trim()) {
    const noiseWords = new Set(['A', 'AN', 'THE', 'AND', 'FOR', 'WITH', 'OF', 'IN', 'ON', 'TO', 'BY', 'IS', 'AT', 'IT', 'OR']);
    const words = productName
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 0 && !noiseWords.has(w));

    if (words.length >= 2) {
      const w1 = words[0].substring(0, 2);
      const w2 = words[1].substring(0, 2);
      prodPrefix = (w1 + w2).padEnd(4, 'X');
    } else if (words.length === 1) {
      prodPrefix = words[0].substring(0, 4).padEnd(4, 'X');
    }
  }

  const baseSkuPattern = `${catPrefix}-${prodPrefix}`;

  // 3. Find unique suffix against existing products
  const existingSkus = new Set(
    existingProducts
      .map((p) => p.sku?.toUpperCase().trim())
      .filter(Boolean)
  );

  let counter = 101;
  let candidateSku = `${baseSkuPattern}-${counter}`;

  while (existingSkus.has(candidateSku)) {
    counter++;
    candidateSku = `${baseSkuPattern}-${counter}`;
  }

  return candidateSku;
};

/**
 * Universal product discount resolver
 * Accurately extracts current price, strikethrough original price, discount percentage and on-sale state
 */
export interface ProductDiscountInfo {
  hasDiscount: boolean;
  currentPrice: number;
  originalPrice: number | null;
  discountPercent: number;
  isOnSale: boolean;
}

export const getProductDiscountInfo = (product: Product | any): ProductDiscountInfo => {
  if (!product) {
    return { hasDiscount: false, currentPrice: 0, originalPrice: null, discountPercent: 0, isOnSale: false };
  }
  const currentPrice = Number(product.price || 0);

  // Check for sale dates validity
  const now = Date.now();
  if (product.saleEndAt && !isNaN(new Date(product.saleEndAt).getTime()) && new Date(product.saleEndAt).getTime() < now) {
    return { hasDiscount: false, currentPrice, originalPrice: null, discountPercent: 0, isOnSale: false };
  }
  if (product.saleEndDate && !isNaN(new Date(product.saleEndDate).getTime()) && new Date(product.saleEndDate).getTime() < now) {
    return { hasDiscount: false, currentPrice, originalPrice: null, discountPercent: 0, isOnSale: false };
  }
  if (product.saleStartAt && !isNaN(new Date(product.saleStartAt).getTime()) && new Date(product.saleStartAt).getTime() > now) {
    return { hasDiscount: false, currentPrice, originalPrice: null, discountPercent: 0, isOnSale: false };
  }

  const rawOriginalPrice = 
    product.previousPrice !== undefined && product.previousPrice !== null && Number(product.previousPrice) > currentPrice
      ? Number(product.previousPrice)
      : product.originalPrice !== undefined && product.originalPrice !== null && Number(product.originalPrice) > currentPrice
      ? Number(product.originalPrice)
      : product.original_price !== undefined && product.original_price !== null && Number(product.original_price) > currentPrice
      ? Number(product.original_price)
      : product.basePrice !== undefined && product.basePrice !== null && Number(product.basePrice) > currentPrice
      ? Number(product.basePrice)
      : null;

  const hasDiscount = Boolean(rawOriginalPrice && rawOriginalPrice > currentPrice && currentPrice > 0);
  const discountPercent = hasDiscount && rawOriginalPrice 
    ? Math.round(((rawOriginalPrice - currentPrice) / rawOriginalPrice) * 100)
    : 0;

  const isOnSale = hasDiscount || (Boolean(product.isDailyDeal || product.onSale) && Boolean(rawOriginalPrice && rawOriginalPrice > currentPrice));

  return {
    hasDiscount,
    currentPrice,
    originalPrice: hasDiscount ? rawOriginalPrice : null,
    discountPercent,
    isOnSale,
  };
};

