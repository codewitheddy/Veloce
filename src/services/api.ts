import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// Retrieve API Base URL from environment variable or default to relative /api endpoint on current server
const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && !envUrl.includes('127.0.0.1:8000') && !envUrl.includes('localhost:8000')) {
    return envUrl;
  }
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

// Create configured Axios instance with HttpOnly cookie credentials & CSRF protection
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Helper utilities for managing optional memory/fallback tokens
export const TOKEN_KEYS = {
  ACCESS: 'veloce_access_token',
  REFRESH: 'veloce_refresh_token',
};

export const getAccessToken = (): string | null => {
  return null; // Prefer HttpOnly cookies
};

export const getRefreshToken = (): string | null => {
  return null; // Prefer HttpOnly cookies
};

export const setAuthTokens = (access?: string, refresh?: string): void => {
  // Authentication tokens are securely managed via HttpOnly, SameSite cookies
};

export const clearAuthTokens = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEYS.ACCESS);
    localStorage.removeItem(TOKEN_KEYS.REFRESH);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  } catch {}
};

// Request Interceptor: CSRF protection and headers
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.withCredentials = true;
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Track token refresh state to prevent loop conditions
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

// Response Interceptor: Handle errors, auto refresh JWT via cookies, and standardize error formats
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized errors and attempt cookie-based JWT token refresh
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/token/refresh/') || originalRequest.url?.includes('/auth/login/')) {
        clearAuthTokens();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(
          `${API_BASE_URL}/auth/token/refresh/`,
          {},
          { withCredentials: true }
        );

        const { access } = response.data;
        processQueue(null, access || 'ok');
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        clearAuthTokens();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Standardized log/notification handling for common HTTP errors
    if (error.response) {
      const { status, data } = error.response;
      switch (status) {
        case 400:
          console.warn('[API 400 Bad Request]:', data);
          break;
        case 403:
          console.warn('[API 403 Forbidden]: You do not have permission to perform this action.');
          break;
        case 404:
          console.warn('[API 404 Not Found]: The requested resource was not found.');
          break;
        case 500:
          console.error('[API 500 Server Error]: Internal server error on Django backend.');
          break;
        default:
          console.error(`[API ${status} Error]:`, data);
      }
    } else if (error.request) {
      console.warn('[API Network Warning]: Unable to connect to remote API server. Utilizing local fallback mode.');
    }

    return Promise.reject(error);
  }
);

// Typed API Helper Modules for Django Endpoints
export const mapBackendProductToFrontend = (item: any): any => {
  if (!item) return null;

  const rawImages = item.images || item.gallery_images;
  let parsedImages: string[] = [];
  if (Array.isArray(rawImages)) {
    parsedImages = rawImages.filter((img) => typeof img === 'string' && img.trim().length > 0);
  } else if (typeof rawImages === 'string' && rawImages.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(rawImages);
      if (Array.isArray(parsed)) {
        parsedImages = parsed.filter((img) => typeof img === 'string' && img.trim().length > 0);
      }
    } catch {
      parsedImages = rawImages.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  } else if (typeof rawImages === 'string' && rawImages.trim()) {
    parsedImages = [rawImages.trim()];
  }

  const primaryImg = item.image_url || item.imageUrl || parsedImages[0] || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=600';
  if (parsedImages.length === 0 && primaryImg) {
    parsedImages = [primaryImg];
  } else if (parsedImages.length > 0 && !parsedImages.includes(primaryImg)) {
    parsedImages = [primaryImg, ...parsedImages];
  }

  return {
    id: String(item.id || ''),
    sku: item.sku || '',
    name: item.name || 'Untitled Product',
    description: item.description || '',
    price: typeof item.price === 'string' ? parseFloat(item.price) : Number(item.price || 0),
    basePrice: item.basePrice || (typeof item.price === 'string' ? parseFloat(item.price) : Number(item.price || 0)),
    salePrice: item.salePrice || (item.original_price ? Number(item.price) : null),
    costPrice: item.cost_price !== undefined && item.cost_price !== null 
      ? (typeof item.cost_price === 'string' ? parseFloat(item.cost_price) : Number(item.cost_price))
      : (item.costPrice !== undefined && item.costPrice !== null ? Number(item.costPrice) : undefined),
    cost_price: item.cost_price !== undefined && item.cost_price !== null 
      ? (typeof item.cost_price === 'string' ? parseFloat(item.cost_price) : Number(item.cost_price))
      : (item.costPrice !== undefined && item.costPrice !== null ? Number(item.costPrice) : undefined),
    previousPrice: item.original_price !== undefined && item.original_price !== null 
      ? (typeof item.original_price === 'string' ? parseFloat(item.original_price) : Number(item.original_price))
      : (item.previousPrice !== undefined && item.previousPrice !== null ? Number(item.previousPrice) : undefined),
    originalPrice: item.original_price !== undefined && item.original_price !== null 
      ? (typeof item.original_price === 'string' ? parseFloat(item.original_price) : Number(item.original_price))
      : (item.originalPrice !== undefined && item.originalPrice !== null ? Number(item.originalPrice) : (item.previousPrice !== undefined && item.previousPrice !== null ? Number(item.previousPrice) : undefined)),
    category: item.category || 'General',
    tags: Array.isArray(item.tags) 
      ? item.tags 
      : (typeof item.tags === 'string' && item.tags ? item.tags.split(',').map((t: string) => t.trim()) : ['Catalog']),
    type: item.type || 'physical',
    imageUrl: primaryImg,
    images: parsedImages,
    stock: item.stock !== undefined && item.stock !== null ? Number(item.stock) : 10,
    lowStockThreshold: item.low_stock_threshold || item.lowStockThreshold || 5,
    rating: item.rating || 4.8,
    reviewsCount: item.reviewsCount || (Array.isArray(item.reviews) ? item.reviews.length : 0),
    reviews: Array.isArray(item.reviews) ? item.reviews : [],
    status: item.status || 'Active',
    hasVariants: item.has_variants !== undefined ? Boolean(item.has_variants) : Boolean(item.hasVariants),
    variations: item.variations || [],
    variantMatrix: item.variant_matrix || item.variantMatrix || [],
    unitMeasurement: item.unit_measurement || item.unitMeasurement || '',
    unitValue: item.unit_value !== undefined ? item.unit_value : item.unitValue,
    weight: item.weight || '',
    length: item.length || '',
  };
};

export const fetchProducts = async (params?: { 
  status?: string; 
  category?: string; 
  search?: string; 
  type?: string; 
  on_sale?: boolean | string;
  onSale?: boolean | string;
  min_price?: number;
  max_price?: number;
}): Promise<any[]> => {
  const response = await api.get('/products/', { params });
  const rawData = response.data;
  const items = Array.isArray(rawData) ? rawData : (rawData && Array.isArray(rawData.results) ? rawData.results : []);
  return items.map(mapBackendProductToFrontend);
};

export const authService = {
  login: async (credentials: { username?: string; email?: string; password?: string }) => {
    const response = await api.post('/auth/login/', credentials);
    return response.data;
  },

  superuserLogin: async (credentials: { username: string; password: string }) => {
    const response = await api.post('/auth/superuser-login/', credentials);
    return response.data;
  },

  register: async (userData: { username: string; email: string; password?: string; first_name?: string; last_name?: string }) => {
    const response = await api.post('/auth/register/', userData);
    return response.data;
  },

  refreshToken: async (refresh?: string) => {
    const response = await api.post('/auth/token/refresh/', refresh ? { refresh } : {});
    return response.data;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout/');
    } catch {}
    clearAuthTokens();
  },

  getMe: async () => {
    const response = await api.get('/users/me/');
    return response.data;
  },

  updateProfile: async (profileData: any) => {
    const response = await api.put('/users/me/', profileData);
    return response.data;
  }
};

export const productService = {
  getProducts: async (params?: { 
    status?: string; 
    category?: string; 
    search?: string; 
    type?: string; 
    on_sale?: boolean | string;
    onSale?: boolean | string;
  }) => {
    const response = await api.get('/products/', { params });
    return response.data;
  },

  fetchProducts: async (params?: { 
    status?: string; 
    category?: string; 
    search?: string; 
    type?: string; 
    on_sale?: boolean | string;
    onSale?: boolean | string;
  }): Promise<any[]> => {
    return fetchProducts(params);
  },

  getProductById: async (id: string) => {
    const response = await api.get(`/products/${id}/`);
    return response.data;
  },

  createProduct: async (productData: any) => {
    const costVal = productData.costPrice !== undefined && productData.costPrice !== null && productData.costPrice !== ''
      ? Number(productData.costPrice)
      : productData.cost_price !== undefined && productData.cost_price !== null && productData.cost_price !== ''
      ? Number(productData.cost_price)
      : null;

    const originalPriceVal = productData.previousPrice !== undefined && productData.previousPrice !== null
      ? Number(productData.previousPrice)
      : productData.originalPrice !== undefined && productData.originalPrice !== null
      ? Number(productData.originalPrice)
      : productData.original_price !== undefined && productData.original_price !== null
      ? Number(productData.original_price)
      : productData.basePrice && productData.price && Number(productData.basePrice) > Number(productData.price)
      ? Number(productData.basePrice)
      : null;

    const rawImagesList = Array.isArray(productData.images) && productData.images.length > 0
      ? productData.images
      : (productData.imageUrl || productData.image_url ? [productData.imageUrl || productData.image_url] : []);

    const primaryImg = productData.imageUrl || productData.image_url || rawImagesList[0] || '';

    const payload = {
      id: productData.id,
      sku: productData.sku,
      name: productData.name,
      description: productData.description || '',
      price: productData.price,
      original_price: originalPriceVal,
      previousPrice: originalPriceVal,
      cost_price: costVal,
      costPrice: costVal,
      category: productData.category || 'General',
      type: productData.type || 'physical',
      status: productData.status || 'Active',
      image_url: primaryImg,
      imageUrl: primaryImg,
      images: rawImagesList,
      gallery_images: rawImagesList,
      stock: productData.stock !== undefined ? productData.stock : 10,
      low_stock_threshold: productData.lowStockThreshold || productData.low_stock_threshold || 5,
      tags: Array.isArray(productData.tags) ? productData.tags.join(', ') : (productData.tags || ''),
      has_variants: productData.hasVariants !== undefined ? productData.hasVariants : productData.has_variants,
      variations: productData.variations || [],
      variant_matrix: productData.variantMatrix || productData.variant_matrix || [],
      unit_measurement: productData.unitMeasurement || productData.unit_measurement || '',
      unit_value: productData.unitValue !== undefined ? productData.unitValue : productData.unit_value,
      weight: productData.weight || '',
      length: productData.length || '',
    };
    const response = await api.post('/products/', payload);
    return response.data;
  },

  updateProduct: async (id: string, productData: any) => {
    const costVal = productData.costPrice !== undefined && productData.costPrice !== null && productData.costPrice !== ''
      ? Number(productData.costPrice)
      : productData.cost_price !== undefined && productData.cost_price !== null && productData.cost_price !== ''
      ? Number(productData.cost_price)
      : undefined;

    const originalPriceVal = productData.previousPrice !== undefined && productData.previousPrice !== null
      ? Number(productData.previousPrice)
      : productData.originalPrice !== undefined && productData.originalPrice !== null
      ? Number(productData.originalPrice)
      : productData.original_price !== undefined && productData.original_price !== null
      ? Number(productData.original_price)
      : productData.basePrice && productData.price && Number(productData.basePrice) > Number(productData.price)
      ? Number(productData.basePrice)
      : undefined;

    const imagesVal = productData.images !== undefined
      ? (Array.isArray(productData.images) ? productData.images : (typeof productData.images === 'string' ? [productData.images] : []))
      : undefined;

    const primaryImg = productData.imageUrl || productData.image_url || (imagesVal && imagesVal[0]);

    const payload = {
      ...productData,
      ...(costVal !== undefined ? { cost_price: costVal, costPrice: costVal } : {}),
      ...(originalPriceVal !== undefined ? { original_price: originalPriceVal, previousPrice: originalPriceVal } : {}),
      ...(imagesVal !== undefined ? { images: imagesVal, gallery_images: imagesVal } : {}),
      ...(primaryImg !== undefined ? { image_url: primaryImg, imageUrl: primaryImg } : {}),
      variant_matrix: productData.variantMatrix || productData.variant_matrix || [],
      unit_measurement: productData.unitMeasurement || productData.unit_measurement || '',
      unit_value: productData.unitValue !== undefined ? productData.unitValue : productData.unit_value,
      has_variants: productData.hasVariants !== undefined ? productData.hasVariants : productData.has_variants,
    };
    const response = await api.put(`/products/${id}/`, payload);
    return response.data;
  },

  deleteProduct: async (id: string) => {
    const response = await api.delete(`/products/${id}/`);
    return response.data;
  },

  bulkAction: async (payload: {
    product_ids: string[];
    action: 'archive' | 'delete' | 'update_status';
    status?: 'Active' | 'Inactive' | 'Draft' | 'Archived';
  }) => {
    const response = await api.post('/products/bulk_action/', payload);
    return response.data;
  },
};

export const categoriesApi = {
  getCategories: async () => {
    // 1. Try local server first
    try {
      const res = await axios.get('/api/products/categories/', { validateStatus: () => true });
      if (res.status === 200 && res.data) {
        const data = res.data;
        if (Array.isArray(data) && data.length > 0) return data;
        if (Array.isArray(data.results) && data.results.length > 0) return data.results;
        if (Array.isArray(data.categories) && data.categories.length > 0) return data.categories;
        if (Array.isArray(data)) return data;
      }
    } catch {}

    try {
      const res2 = await axios.get('/api/categories/', { validateStatus: () => true });
      if (res2.status === 200 && res2.data) {
        const data = res2.data;
        if (Array.isArray(data) && data.length > 0) return data;
        if (Array.isArray(data.results) && data.results.length > 0) return data.results;
        if (Array.isArray(data.categories) && data.categories.length > 0) return data.categories;
      }
    } catch {}

    // 2. Try Django backend
    try {
      const djangoRes = await axios.get('http://127.0.0.1:8000/api/products/categories/', { validateStatus: () => true });
      if (djangoRes.status === 200 && djangoRes.data) {
        const d = djangoRes.data;
        if (Array.isArray(d) && d.length > 0) return d;
        if (Array.isArray(d.results) && d.results.length > 0) return d.results;
        if (Array.isArray(d.categories) && d.categories.length > 0) return d.categories;
      }
    } catch {}

    return null;
  },

  createCategory: async (categoryData: any) => {
    const payload = {
      id: categoryData.id,
      name: categoryData.name,
      slug: categoryData.slug,
      parentId: categoryData.parentId || null,
      parent_id: categoryData.parentId || null,
      description: categoryData.description || '',
      imageUrl: categoryData.imageUrl || '',
      image_url: categoryData.imageUrl || '',
      status: categoryData.status || 'Active',
      displayOrder: categoryData.displayOrder || 0,
      display_order: categoryData.displayOrder || 0,
      previousSlugs: categoryData.previousSlugs || [],
      previous_slugs: categoryData.previousSlugs || [],
    };

    // Try local endpoint first
    try {
      const res = await axios.post('/api/products/categories/', payload, { validateStatus: () => true });
      if (res.status === 200 || res.status === 201) return res.data;
    } catch {}

    // Try Django backend
    try {
      const djangoRes = await axios.post('http://127.0.0.1:8000/api/products/categories/', payload, { validateStatus: () => true });
      if (djangoRes.status === 200 || djangoRes.status === 201) return djangoRes.data;
    } catch {}

    return { message: 'Category created locally', category: categoryData };
  },

  updateCategory: async (id: string, categoryData: any) => {
    const payload = {
      name: categoryData.name,
      slug: categoryData.slug,
      parentId: categoryData.parentId || null,
      parent_id: categoryData.parentId || null,
      description: categoryData.description || '',
      imageUrl: categoryData.imageUrl || '',
      image_url: categoryData.imageUrl || '',
      status: categoryData.status || 'Active',
      displayOrder: categoryData.displayOrder || 0,
      display_order: categoryData.displayOrder || 0,
      previousSlugs: categoryData.previousSlugs || [],
      previous_slugs: categoryData.previousSlugs || [],
    };

    // Try local endpoint first
    try {
      const res = await axios.put(`/api/products/categories/${id}/`, payload, { validateStatus: () => true });
      if (res.status === 200) return res.data;
    } catch {}

    // Try Django backend
    try {
      const djangoRes = await axios.put(`http://127.0.0.1:8000/api/products/categories/${id}/`, payload, { validateStatus: () => true });
      if (djangoRes.status === 200) return djangoRes.data;
    } catch {}

    return { message: 'Category updated locally', category: categoryData };
  },

  deleteCategory: async (id: string) => {
    try {
      const res = await axios.delete(`/api/products/categories/${id}/`, { validateStatus: () => true });
      if (res.status === 200) return res.data;
    } catch {}

    try {
      const djangoRes = await axios.delete(`http://127.0.0.1:8000/api/products/categories/${id}/`, { validateStatus: () => true });
      if (djangoRes.status === 200) return djangoRes.data;
    } catch {}

    return { message: 'Category deleted' };
  },

  bulkSyncCategories: async (categories: any[]) => {
    try {
      const res = await axios.post('/api/products/categories/bulk_sync/', categories, { validateStatus: () => true });
      if (res.status === 200) return res.data;
    } catch {}

    try {
      const djangoRes = await axios.post('http://127.0.0.1:8000/api/products/categories/bulk_sync/', categories, { validateStatus: () => true });
      if (djangoRes.status === 200) return djangoRes.data;
    } catch {}

    return { message: 'Categories synced', categories };
  },
};

export const pushOrderToBackend = async (orderData: any) => {
  const payload = {
    id: orderData.id || undefined,
    customer_name: (orderData.customerName || orderData.customer_name || 'Customer').trim(),
    customer_email: (orderData.customerEmail || orderData.customer_email || '').trim(),
    customer_phone: (orderData.phone || orderData.customerPhone || orderData.customer_phone || orderData.pickupContactPhone || '').trim(),
    subtotal: typeof orderData.subtotal === 'number' ? orderData.subtotal : parseFloat(orderData.subtotal || '0'),
    discount: typeof (orderData.discountAmount ?? orderData.discount) === 'number' ? (orderData.discountAmount ?? orderData.discount) : parseFloat(orderData.discountAmount || orderData.discount || '0'),
    shipping_fee: typeof (orderData.shippingFee ?? orderData.shipping_fee) === 'number' ? (orderData.shippingFee ?? orderData.shipping_fee) : parseFloat(orderData.shippingFee || orderData.shipping_fee || '0'),
    tax_amount: typeof (orderData.taxTotal ?? orderData.tax) === 'number' ? (orderData.taxTotal ?? orderData.tax) : parseFloat(orderData.taxTotal || orderData.tax || '0'),
    total: typeof orderData.total === 'number' ? orderData.total : parseFloat(orderData.total || '0'),
    status: orderData.status === 'completed' ? 'Processing' : (orderData.status ? orderData.status.charAt(0).toUpperCase() + orderData.status.slice(1) : 'Pending'),
    payment_method: orderData.paymentMethod === 'cod' ? 'Cash on Delivery' : (orderData.paymentMethod || orderData.payment_method || 'M-PESA'),
    payment_reference: orderData.paymentReference || orderData.stkRef || orderData.mpesaReceipt || orderData.payment_reference || '',
    shipping_address: orderData.shippingAddress || orderData.shipping_address || (orderData.fulfillmentType === 'pickup' ? `Self-Pickup: ${orderData.pickupLocation || 'Main Hub'}` : ''),
    affiliate_code: orderData.couponCode || orderData.affiliate_code || '',
    notes: orderData.notes || orderData.customNote || (orderData.fulfillmentType === 'pickup' ? `Fulfillment: Self-Pickup at ${orderData.pickupLocation || 'Station'}. Ready time: ${orderData.pickupEstimatedTime || 'Same Day'}. Collector Phone: ${orderData.pickupContactPhone || orderData.phone || ''}` : ''),
    items: Array.isArray(orderData.items)
      ? orderData.items.map((item: any) => ({
          product_name: item.name || item.product_name || 'Product',
          product_sku: item.product_sku || item.sku || item.productId || '',
          quantity: Number(item.quantity || 1),
          unit_price: typeof item.price === 'number' ? item.price : parseFloat(item.unit_price || item.price || '0'),
          selected_variations: item.selectedVariations || item.selected_variations || {},
        }))
      : [],
  };

  const response = await api.post('/orders/', payload);
  return response.data;
};

export const orderService = {
  getOrders: async () => {
    const response = await api.get('/orders/');
    return response.data;
  },

  createOrder: async (orderData: any) => {
    return pushOrderToBackend(orderData);
  },

  syncOrders: async (orders: any[]) => {
    const response = await api.post('/orders/sync', { orders });
    return response.data;
  },

  pushOrderToBackend,
};

export const cartService = {
  getCart: async (userId?: string) => {
    const response = await api.get('/cart', { params: { userId } });
    return response.data;
  },

  syncCart: async (items: any[], userId?: string) => {
    const response = await api.post('/cart/sync', { items, userId });
    return response.data;
  },

  saveCart: async (items: any[], userId?: string) => {
    const response = await api.post('/cart', { items, userId });
    return response.data;
  },

  clearCart: async (userId?: string) => {
    const response = await api.delete('/cart', { params: { userId } });
    return response.data;
  },
};

export const inventoryService = {
  getInventory: async () => {
    const response = await api.get('/inventory');
    return response.data;
  },

  syncInventory: async (inventoryData: Array<{ id: string; stock: number; status?: string }>) => {
    const response = await api.post('/inventory/sync', { inventory: inventoryData });
    return response.data;
  },

  updateStock: async (productId: string, stock: number) => {
    const response = await api.post('/inventory/sync', {
      inventory: [{ id: productId, stock }],
    });
    return response.data;
  },
};

export const stateSyncService = {
  syncStateToBackend: async (payload: {
    cart?: any[];
    orders?: any[];
    inventory?: any[];
    products?: any[];
  }) => {
    const response = await api.post('/state/sync-push', payload);
    return response.data;
  },

  pullStateFromBackend: async () => {
    const response = await api.get('/state/sync-pull');
    return response.data;
  },
};

export const userService = {
  getCurrentUser: async () => {
    const response = await api.get('/users/me/');
    return response.data;
  },
  updateProfile: async (profileData: any) => {
    const response = await api.put('/users/me/', profileData);
    return response.data;
  },
};

export const emailService = {
  getConfig: async () => {
    const response = await api.get('/email/config');
    return response.data;
  },
  sendEmail: async (data: { to: string; subject: string; html?: string; text?: string; category?: string; templateType?: string; isPromotional?: boolean }) => {
    const response = await api.post('/email/send', data);
    return response.data;
  },
  testDiagnostics: async (recipientEmail: string) => {
    const response = await api.post('/email/diagnose-smtp', { to: recipientEmail });
    return response.data;
  },
  validateConfig: async () => {
    const response = await api.get('/email/validate-config');
    return response.data;
  },
  updateConfig: async (configData: { host?: string; port?: number; user?: string; password?: string; defaultFrom?: string; useSsl?: boolean }) => {
    const response = await api.post('/email/update-config', configData);
    return response.data;
  },
  unsubscribe: async (email: string, reason?: string) => {
    const response = await api.post('/email/unsubscribe', { email, reason });
    return response.data;
  },
  resubscribe: async (email: string) => {
    const response = await api.post('/email/resubscribe', { email });
    return response.data;
  },
  getUnsubscribeStatus: async (email: string) => {
    const response = await api.get('/email/unsubscribe-status', { params: { email } });
    return response.data;
  },
  getUnsubscribedList: async () => {
    const response = await api.get('/email/unsubscribed-list');
    return response.data;
  },
  sendPasswordResetEmail: async (email: string) => {
    const response = await api.post('/auth/password-reset', { email });
    return response.data;
  },
};

export const newsletterService = {
  subscribe: async (data: {
    email: string;
    firstName?: string;
    preferences?: string[];
    source?: string;
    forceResubscribe?: boolean;
  }) => {
    const response = await api.post('/newsletter/subscribe', data);
    return response.data;
  },
  getSubscribers: async () => {
    const response = await api.get('/newsletter/subscribers');
    return response.data;
  },
  unsubscribe: async (email: string, reason?: string) => {
    const response = await api.post('/email/unsubscribe', { email, reason });
    return response.data;
  },
};

export const contactService = {
  sendMessage: async (data: {
    name: string;
    email: string;
    phone?: string;
    subject?: string;
    message: string;
    hp_field?: string;
  }) => {
    const response = await api.post('/contact/', data);
    return response.data;
  },
};

export const sqliteService = {
  getStatus: async () => {
    const response = await api.get('/sqlite/status');
    return response.data;
  },
  seedProducts: async (products?: any[]) => {
    const response = await api.post('/sqlite/seed', { products });
    return response.data;
  },
  syncPush: async (payload: any) => {
    const response = await api.post('/sqlite/sync-push', payload);
    return response.data;
  },
  syncPull: async () => {
    const response = await api.get('/sqlite/sync-pull');
    return response.data;
  },
  purgeAll: async () => {
    const response = await api.post('/sqlite/purge-all');
    return response.data;
  },
};

export default api;


