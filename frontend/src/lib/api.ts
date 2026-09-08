import { Product, TaxCalculationResult } from '@/types';

const getBaseUrl = () => {
  if (typeof window === 'undefined') {
    // Server-side execution (Node.js runtime in Docker / local server)
    return process.env.INTERNAL_BACKEND_URL || 'http://127.0.0.1:8000';
  }
  // Client-side execution in browser
  return '';
};

export async function fetchProducts(params: {
  query?: string;
  category?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ hits: Product[]; totalHits: number; page: number; pageSize: number }> {
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.set('q', params.query);
  if (params.category) searchParams.set('category', params.category);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.pageSize) searchParams.set('page_size', String(params.pageSize));

  const url = `${getBaseUrl()}/api/v1/search/products/?${searchParams.toString()}`;
  
  try {
    const res = await fetch(url, {
      next: { revalidate: 60 }, // ISR: Cache for 60 seconds
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch products: ${res.statusText}`);
    }
    return await res.json();
  } catch (error) {
    console.error('[fetchProducts error]:', error);
    return { hits: [], totalHits: 0, page: 1, pageSize: 24 };
  }
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const url = `${getBaseUrl()}/api/products/${slug}/`;
  
  try {
    const res = await fetch(url, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      // Fallback search by slug query
      const searchRes = await fetchProducts({ query: slug });
      const found = searchRes.hits.find((p) => p.slug === slug || p.id === slug);
      return found || null;
    }
    return await res.json();
  } catch (error) {
    console.error(`[fetchProductBySlug error for ${slug}]:`, error);
    return null;
  }
}

export async function calculateTax(payload: {
  country_code: string;
  subtotal: number;
  discount_amount?: number;
  shipping_fee?: number;
}): Promise<TaxCalculationResult> {
  const url = `${getBaseUrl()}/api/v1/pricing/calculate-tax/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Failed to compute VAT');
  }
  return await res.json();
}

export async function reserveInventory(cartId: string, items: Array<{ sku: string; quantity: number }>) {
  const url = `${getBaseUrl()}/api/v1/inventory/reserve/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cart_id: cartId, items }),
  });
  return await res.json();
}

export async function initiateMpesaStkPush(payload: {
  order_id: string;
  phone: string;
  amount: number;
  reservation_token?: string;
}) {
  const url = `${getBaseUrl()}/api/v1/payments/mpesa/stk-push/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return await res.json();
}
