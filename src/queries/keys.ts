import { ProductQueryParams } from '../api/products';
import { OrderQueryParams } from '../api/orders';

/**
 * Centralized, Hierarchical Query Key Factory Architecture
 * Ensures consistent query key generation and targeted cache invalidations across the eCommerce platform.
 */
export const queryKeys = {
  // Products
  products: {
    all: ['products'] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    list: (filters?: ProductQueryParams) => [...queryKeys.products.lists(), filters || {}] as const,
    infinite: (filters?: ProductQueryParams) => [...queryKeys.products.all, 'infinite', filters || {}] as const,
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (idOrSlug: string) => [...queryKeys.products.details(), idOrSlug] as const,
    search: (query: string) => [...queryKeys.products.all, 'search', query] as const,
  },

  // Categories
  categories: {
    all: ['categories'] as const,
    list: () => [...queryKeys.categories.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.categories.all, 'detail', id] as const,
  },

  // Orders
  orders: {
    all: ['orders'] as const,
    lists: () => [...queryKeys.orders.all, 'list'] as const,
    list: (filters?: OrderQueryParams) => [...queryKeys.orders.lists(), filters || {}] as const,
    details: () => [...queryKeys.orders.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.orders.details(), id] as const,
  },

  // Users & Customer Profile
  users: {
    all: ['users'] as const,
    me: () => [...queryKeys.users.all, 'me'] as const,
    notifications: () => [...queryKeys.users.all, 'notifications'] as const,
  },

  // Wishlist
  wishlist: {
    all: ['wishlist'] as const,
    list: () => [...queryKeys.wishlist.all, 'list'] as const,
  },

  // Cart
  cart: {
    all: ['cart'] as const,
    items: (userId?: string) => [...queryKeys.cart.all, 'items', userId || 'guest'] as const,
  },

  // Reviews
  reviews: {
    all: ['reviews'] as const,
    list: (productId: string) => [...queryKeys.reviews.all, 'list', productId] as const,
  },

  // Analytics & Background Jobs
  reports: {
    all: ['reports'] as const,
    sales: (params?: Record<string, any>) => [...queryKeys.reports.all, 'sales', params || {}] as const,
    inventory: () => [...queryKeys.reports.all, 'inventory'] as const,
    job: (jobId: string) => [...queryKeys.reports.all, 'job', jobId] as const,
  },
};
