import api, { mapBackendProductToFrontend } from './client';
import { Product } from '../types';

export interface ProductQueryParams {
  page?: number;
  page_size?: number;
  search?: string;
  category?: string;
  brand?: string;
  ordering?: string;
  status?: string;
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
}

export interface PaginatedProductsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  page?: number;
  results: Product[];
}

export const productsApi = {
  /**
   * Fetches paginated or list products from Django REST backend
   */
  getProducts: async (params?: ProductQueryParams): Promise<PaginatedProductsResponse> => {
    const response = await api.get('/products/', { params });
    const data = response.data;

    // Support both Django DRF PageNumberPagination and raw array responses
    if (Array.isArray(data)) {
      const mapped = data.map(mapBackendProductToFrontend);
      return {
        count: mapped.length,
        next: null,
        previous: null,
        results: mapped,
      };
    }

    const rawResults = Array.isArray(data?.results) ? data.results : [];
    return {
      count: Number(data?.count || rawResults.length),
      next: data?.next || null,
      previous: data?.previous || null,
      results: rawResults.map(mapBackendProductToFrontend),
    };
  },

  /**
   * Fetches a single product by ID or SKU
   */
  getProduct: async (idOrSlug: string): Promise<Product> => {
    const response = await api.get(`/products/${idOrSlug}/`);
    return mapBackendProductToFrontend(response.data);
  },

  /**
   * Creates a new product on the catalog
   */
  createProduct: async (productData: Partial<Product>): Promise<Product> => {
    const payload = {
      sku: productData.sku,
      name: productData.name,
      description: productData.description || '',
      price: productData.price,
      original_price: productData.previousPrice || productData.originalPrice || null,
      category: productData.category || 'General',
      type: productData.type || 'physical',
      status: productData.status || 'Active',
      image_url: productData.imageUrl || '',
      stock: productData.stock !== undefined && productData.stock !== null ? productData.stock : 10,
      low_stock_threshold: productData.lowStockThreshold || 5,
      tags: Array.isArray(productData.tags) ? productData.tags.join(', ') : (productData.tags || ''),
      has_variants: Boolean(productData.hasVariants),
      variations: productData.variations || [],
      variant_matrix: productData.variantMatrix || [],
    };
    const response = await api.post('/products/', payload);
    return mapBackendProductToFrontend(response.data);
  },

  /**
   * Updates an existing product
   */
  updateProduct: async (id: string, productData: Partial<Product>): Promise<Product> => {
    const response = await api.put(`/products/${id}/`, productData);
    return mapBackendProductToFrontend(response.data);
  },

  /**
   * Deletes a product by ID
   */
  deleteProduct: async (id: string): Promise<{ success: boolean; id: string }> => {
    await api.delete(`/products/${id}/`);
    return { success: true, id };
  },

  /**
   * Executes bulk catalog batch operations
   */
  bulkAction: async (payload: {
    product_ids: string[];
    action: 'archive' | 'delete' | 'update_status';
    status?: 'Active' | 'Inactive' | 'Draft' | 'Archived';
  }): Promise<{ success: boolean; affected: number }> => {
    const response = await api.post('/products/bulk_action/', payload);
    return response.data;
  },

  /**
   * Executes atomic bulk price adjustments across multiple catalog products
   */
  bulkPriceAdjustment: async (items: Array<{
    id: string;
    price: number;
    original_price?: number | null;
  }>): Promise<{ message: string; affected_count: number }> => {
    const response = await api.post('/products/bulk_price_adjustment/', { items });
    return response.data;
  },
};
