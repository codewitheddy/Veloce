export type Currency = 'KES' | 'UGX' | 'TZS' | 'RWF';

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  type: 'physical' | 'digital' | 'service';
  status: 'Active' | 'Inactive' | 'Draft' | 'Archived';
  price: number;
  original_price?: number | null;
  cost_price?: number | null;
  stock: number;
  low_stock_threshold: number;
  rating: number;
  reviews_count: number;
  image_url: string;
  gallery_images: string[];
  is_featured: boolean;
  tags: string;
  brand?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedVariations?: Record<string, string>;
}

export interface TaxCalculationResult {
  country_code: string;
  country_name: string;
  currency_code: Currency;
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  vat_percentage: number;
  vat_amount: number;
  shipping_fee: number;
  total_amount: number;
}
