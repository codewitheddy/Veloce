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
  'Vietnam',
  'Tanzania',
  'Uganda',
  'Rwanda',
  'Ethiopia',
];

export const COUNTRY_FLAG_MAP: Record<string, string> = {
  'Kenya': '🇰🇪',
  'United Kingdom': '🇬🇧',
  'United States': '🇺🇸',
  'Germany': '🇩🇪',
  'France': '🇫🇷',
  'Italy': '🇮🇹',
  'Switzerland': '🇨🇭',
  'China': '🇨🇳',
  'Japan': '🇯🇵',
  'South Korea': '🇰🇷',
  'India': '🇮🇳',
  'South Africa': '🇿🇦',
  'United Arab Emirates': '🇦🇪',
  'Turkey': '🇹🇷',
  'Brazil': '🇧🇷',
  'Canada': '🇨🇦',
  'Australia': '🇦🇺',
  'Netherlands': '🇳🇱',
  'Vietnam': '🇻🇳',
  'Tanzania': '🇹🇿',
  'Uganda': '🇺🇬',
  'Rwanda': '🇷🇼',
  'Ethiopia': '🇪🇹',
};

export const COMMON_BRANDS = [
  'Veloce Kenya',
  'Ropenix Atelier',
  'Kilifi Crafts',
  'Nairobi Artisan',
  'Apple',
  'Samsung',
  'Sony',
  'Dell',
  'HP',
  'Lenovo',
  'Nike',
  'Adidas',
  'Puma',
  'Zara',
  'Gucci',
  'L\'Oréal',
  'Nivea',
  'Generic / Unbranded',
];

export const getCountryFlag = (countryName?: string): string => {
  if (!countryName) return '🌐';
  return COUNTRY_FLAG_MAP[countryName.trim()] || '🌐';
};

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

/**
 * Find matching variant from product's variantMatrix or variants array
 */
export const resolveProductVariant = (product: Product | null | undefined, selectedVars: Record<string, string> = {}) => {
  if (!product) return null;
  const matrix = product.variantMatrix || product.variants || [];
  if (matrix.length === 0) return null;

  const exact = matrix.find((v) => {
    if (!v.attributes) return false;
    return Object.entries(selectedVars).every(([k, val]) => {
      const vVal = v.attributes[k] || v.attributes[k.toLowerCase()] || v.attributes[k.toUpperCase()];
      return !vVal || vVal.toLowerCase() === val.toLowerCase();
    });
  });

  return exact || matrix[0];
};

/**
 * Resolve color-specific image gallery with fallback to general product images
 */
export const getProductColorImages = (product: Product | null | undefined, colorName?: string): string[] => {
  if (!product) return [];
  const colorMap = product.colorImages || (product as any).color_images || {};
  if (colorName) {
    // Try exact match and case-insensitive match
    const foundKey = Object.keys(colorMap).find(k => k.toLowerCase() === colorName.toLowerCase());
    if (foundKey && colorMap[foundKey] && colorMap[foundKey].length > 0) {
      const sorted = [...colorMap[foundKey]].sort((a, b) => {
        if (a.is_primary) return -1;
        if (b.is_primary) return 1;
        return (a.position ?? 0) - (b.position ?? 0);
      });
      return sorted.map((img) => img.url).filter(Boolean);
    }
  }
  if (product.images && product.images.length > 0) {
    return product.images;
  }
  return product.imageUrl ? [product.imageUrl] : [];
};

export const COLOR_HEX_MAP: Record<string, string> = {
  // Whites & Off-whites
  'white': '#FFFFFF',
  'snow white': '#FFFFFF',
  'crisp white': '#FFFFFF',
  'off white': '#F8FAFC',
  'off-white': '#F8FAFC',
  'ivory': '#FFFFF0',
  'cream': '#FFFDD0',
  'vanilla': '#F3E5AB',

  // Blacks & Darks
  'black': '#111827',
  'jet black': '#000000',
  'onyx': '#0F172A',
  'matte black': '#18181B',
  'midnight': '#0B0F19',
  'charcoal': '#334155',
  'dark charcoal': '#1E293B',
  'anthracite': '#27272A',

  // Blues
  'navy': '#1E3A8A',
  'navy blue': '#1E3A8A',
  'midnight navy': '#0F172A',
  'royal blue': '#2563EB',
  'blue': '#3B82F6',
  'sky blue': '#38BDF8',
  'light blue': '#93C5FD',
  'baby blue': '#BAE6FD',
  'denim': '#1D4ED8',
  'indigo': '#4F46E5',
  'cobalt': '#1D4ED8',
  'cyan': '#06B6D4',
  'teal': '#0D9488',
  'dark teal': '#115E59',
  'turquoise': '#14B8A6',
  'aqua': '#06B6D4',
  'ocean blue': '#0284C7',

  // Reds & Pinks
  'crimson red': '#DC2626',
  'crimson': '#DC2626',
  'red': '#EF4444',
  'dark red': '#991B1B',
  'ruby': '#BE123C',
  'ruby red': '#BE123C',
  'scarlet': '#DC2626',
  'burgundy': '#881337',
  'maroon': '#800000',
  'wine': '#722F37',
  'rose': '#F43F5E',
  'rose red': '#E11D48',
  'pink': '#EC4899',
  'light pink': '#FBCFE8',
  'hot pink': '#DB2777',
  'blush': '#FDA4AF',
  'salmon': '#FA8072',
  'coral': '#FB7185',
  'coral red': '#F43F5E',
  'magenta': '#D946EF',
  'fuchsia': '#C026D3',

  // Greens
  'green': '#16A34A',
  'dark green': '#14532D',
  'forest green': '#059669',
  'emerald': '#10B981',
  'emerald green': '#059669',
  'olive': '#65A30D',
  'olive green': '#4D7C0F',
  'army green': '#3F6212',
  'sage': '#9CA3AF',
  'sage green': '#84A98C',
  'mint': '#6EE7B7',
  'mint green': '#34D399',
  'lime': '#84CC16',
  'lime green': '#65A30D',
  'pine green': '#064E3B',
  'moss green': '#4B5320',

  // Yellows & Golds
  'yellow': '#EAB308',
  'mustard': '#CA8A04',
  'gold': '#D97706',
  'amber gold': '#D97706',
  'amber': '#F59E0B',
  'lemon': '#FDE047',
  'honey': '#EAB308',

  // Oranges & Browns
  'orange': '#F97316',
  'burnt orange': '#C2410C',
  'rust': '#9A3412',
  'terracotta': '#E07A5F',
  'peach': '#FDBA74',
  'brown': '#78350F',
  'dark brown': '#451A03',
  'chocolate': '#3E2723',
  'coffee': '#6F4E37',
  'mocha': '#795548',
  'tan': '#D2B48C',
  'beige': '#D4B996',
  'khaki': '#C3B091',
  'sand': '#E6C280',
  'camel': '#C19A6B',
  'nude': '#E8BEAC',

  // Purples
  'purple': '#9333EA',
  'dark purple': '#581C87',
  'violet': '#7C3AED',
  'lavender': '#C4B5FD',
  'plum': '#6B21A8',
  'lilac': '#DDD6FE',

  // Greys
  'grey': '#6B7280',
  'gray': '#6B7280',
  'light grey': '#D1D5DB',
  'light gray': '#D1D5DB',
  'dark grey': '#374151',
  'dark gray': '#374151',
  'heather grey': '#9CA3AF',
  'heather gray': '#9CA3AF',
  'slate': '#64748B',
  'silver': '#E2E8F0',
  'ash': '#94A3B8',
  'gunmetal': '#2A3439',
  'rose gold': '#FB7185',
};

/**
 * Resolves accurate Hex color string from an OptionValue object, hexCode, or color name string.
 */
export const resolveColorHex = (colorValueOrName: any): string => {
  if (!colorValueOrName) return '#1E3A8A';
  
  if (typeof colorValueOrName === 'object') {
    const rawHex = colorValueOrName.hexColor || colorValueOrName.hexCode || colorValueOrName.hex_code || colorValueOrName.hex;
    const name = (colorValueOrName.name || colorValueOrName.value || '').trim().toLowerCase();

    // If explicit custom hex is given and it's not the generic fallback
    if (rawHex && rawHex.trim() && rawHex.trim() !== '#6366f1' && rawHex.trim() !== '#1E3A8A') {
      return rawHex.trim();
    }

    if (COLOR_HEX_MAP[name]) return COLOR_HEX_MAP[name];
    for (const [key, hex] of Object.entries(COLOR_HEX_MAP)) {
      if (name.includes(key) || key.includes(name)) return hex;
    }
    if (rawHex && rawHex.trim()) return rawHex.trim();
    return '#1E3A8A';
  }

  const str = String(colorValueOrName).trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(str)) {
    return str;
  }
  const lower = str.toLowerCase();
  if (COLOR_HEX_MAP[lower]) return COLOR_HEX_MAP[lower];
  for (const [key, hex] of Object.entries(COLOR_HEX_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return hex;
  }
  return '#1E3A8A';
};

