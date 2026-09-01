import axios, { AxiosInstance } from 'axios';
import { Product } from '../types';

// Retrieve API Base URL from VITE_API_BASE_URL or fallback to relative /api
const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && !envUrl.includes('127.0.0.1:8000') && !envUrl.includes('localhost:8000')) {
    return envUrl;
  }
  return '/api';
};

export const API_BASE_URL = getApiBaseUrl();

// Configured Axios instance specifically for PostgreSQL DB operations
export const dbAxios: AxiosInstance = axios.create({
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

// Interceptor for credentials
dbAxios.interceptors.request.use(
  (config) => {
    config.withCredentials = true;
    return config;
  },
  (error) => Promise.reject(error)
);

export interface InventoryLog {
  id: string;
  productId: string;
  productName?: string;
  change: number;
  previousStock?: number;
  newStock?: number;
  reason: string;
  user?: string;
  createdAt: string;
  updatedAt?: string;
}

export type NewInventoryLog = Omit<InventoryLog, 'id' | 'createdAt'> & { id?: string };

// ==========================================
// 1. PRODUCTS CRUD DB SERVICE
// ==========================================
export const productsDbService = {
  /**
   * Fetch all products from PostgreSQL database
   */
  getAll: async (params?: Record<string, any>): Promise<Product[]> => {
    try {
      const response = await dbAxios.get('/products', { params });
      return Array.isArray(response.data) ? response.data : (response.data?.products || []);
    } catch (error) {
      console.error('[db.ts] Failed to fetch products from DB:', error);
      throw error;
    }
  },

  /**
   * Fetch single product by ID
   */
  getById: async (id: string | number): Promise<Product> => {
    try {
      const response = await dbAxios.get(`/products/${id}`);
      return response.data;
    } catch (error) {
      console.error(`[db.ts] Failed to fetch product ${id} from DB:`, error);
      throw error;
    }
  },

  /**
   * Create a new product in PostgreSQL
   */
  create: async (product: Partial<Product>): Promise<Product> => {
    try {
      const response = await dbAxios.post('/products', product);
      return response.data?.product || response.data;
    } catch (error) {
      console.error('[db.ts] Failed to create product in DB:', error);
      throw error;
    }
  },

  /**
   * Update an existing product in PostgreSQL
   */
  update: async (id: string | number, product: Partial<Product>): Promise<Product> => {
    try {
      const response = await dbAxios.put(`/products/${id}`, product);
      return response.data?.product || response.data;
    } catch (error) {
      console.error(`[db.ts] Failed to update product ${id} in DB:`, error);
      throw error;
    }
  },

  /**
   * Delete a product from PostgreSQL
   */
  delete: async (id: string | number): Promise<boolean> => {
    try {
      await dbAxios.delete(`/products/${id}`);
      return true;
    } catch (error) {
      console.error(`[db.ts] Failed to delete product ${id} from DB:`, error);
      throw error;
    }
  },
};

// ==========================================
// 2. ORDERS CRUD DB SERVICE
// ==========================================
export const ordersDbService = {
  /**
   * Fetch all orders from PostgreSQL database
   */
  getAll: async (params?: Record<string, any>): Promise<any[]> => {
    try {
      const response = await dbAxios.get('/orders', { params });
      return Array.isArray(response.data) ? response.data : (response.data?.orders || []);
    } catch (error) {
      console.error('[db.ts] Failed to fetch orders from DB:', error);
      throw error;
    }
  },

  /**
   * Fetch single order by ID
   */
  getById: async (id: string | number): Promise<any> => {
    try {
      const response = await dbAxios.get(`/orders/${id}`);
      return response.data;
    } catch (error) {
      console.error(`[db.ts] Failed to fetch order ${id} from DB:`, error);
      throw error;
    }
  },

  /**
   * Create new order in PostgreSQL
   */
  create: async (order: any): Promise<any> => {
    try {
      const response = await dbAxios.post('/orders', order);
      return response.data?.order || response.data;
    } catch (error) {
      console.error('[db.ts] Failed to create order in DB:', error);
      throw error;
    }
  },

  /**
   * Update an existing order in PostgreSQL
   */
  update: async (id: string | number, order: Partial<any>): Promise<any> => {
    try {
      const response = await dbAxios.put(`/orders/${id}`, order);
      return response.data?.order || response.data;
    } catch (error) {
      console.error(`[db.ts] Failed to update order ${id} in DB:`, error);
      throw error;
    }
  },

  /**
   * Delete an order from PostgreSQL
   */
  delete: async (id: string | number): Promise<boolean> => {
    try {
      await dbAxios.delete(`/orders/${id}`);
      return true;
    } catch (error) {
      console.error(`[db.ts] Failed to delete order ${id} from DB:`, error);
      throw error;
    }
  },
};

// ==========================================
// 3. INVENTORY AUDIT LOGS CRUD DB SERVICE
// ==========================================
export const inventoryLogsDbService = {
  /**
   * Fetch all inventory audit logs from PostgreSQL
   */
  getAll: async (params?: { productId?: string; limit?: number }): Promise<InventoryLog[]> => {
    try {
      const response = await dbAxios.get('/inventory/logs', { params });
      return response.data?.logs || (Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('[db.ts] Failed to fetch inventory logs from DB:', error);
      throw error;
    }
  },

  /**
   * Fetch single inventory audit log entry by ID
   */
  getById: async (id: string): Promise<InventoryLog> => {
    try {
      const response = await dbAxios.get(`/inventory/logs/${id}`);
      return response.data?.log || response.data;
    } catch (error) {
      console.error(`[db.ts] Failed to fetch inventory log ${id} from DB:`, error);
      throw error;
    }
  },

  /**
   * Create a new inventory audit log entry in PostgreSQL
   */
  create: async (log: NewInventoryLog): Promise<InventoryLog> => {
    try {
      const response = await dbAxios.post('/inventory/logs', log);
      return response.data?.log || response.data;
    } catch (error) {
      console.error('[db.ts] Failed to create inventory audit log in DB:', error);
      throw error;
    }
  },

  /**
   * Update an inventory audit log entry in PostgreSQL
   */
  update: async (id: string, log: Partial<InventoryLog>): Promise<InventoryLog> => {
    try {
      const response = await dbAxios.put(`/inventory/logs/${id}`, log);
      return response.data?.log || response.data;
    } catch (error) {
      console.error(`[db.ts] Failed to update inventory audit log ${id} in DB:`, error);
      throw error;
    }
  },

  /**
   * Delete an inventory audit log entry from PostgreSQL
   */
  delete: async (id: string): Promise<boolean> => {
    try {
      await dbAxios.delete(`/inventory/logs/${id}`);
      return true;
    } catch (error) {
      console.error(`[db.ts] Failed to delete inventory log ${id} from DB:`, error);
      throw error;
    }
  },
};

// ==========================================
// 4. DATABASE STATE TRANSITION SYNC HELPERS
// ==========================================
export const dbStateSyncService = {
  /**
   * Synchronize local frontend state changes with PostgreSQL DB
   */
  syncLocalStateToDb: async (payload: {
    products?: Product[];
    orders?: any[];
    inventoryLogs?: InventoryLog[];
  }) => {
    try {
      const response = await dbAxios.post('/state/sync-push', payload);
      return response.data;
    } catch (error) {
      console.error('[db.ts] Failed to push local state transitions to DB:', error);
      throw error;
    }
  },

  /**
   * Pull latest database state from PostgreSQL DB
   */
  pullLatestDbState: async () => {
    try {
      const response = await dbAxios.get('/state/sync-pull');
      return response.data?.data || response.data;
    } catch (error) {
      console.error('[db.ts] Failed to pull latest state from DB:', error);
      throw error;
    }
  },

  /**
   * Automatically log inventory level adjustment transition to DB audit log
   */
  logStockTransition: async (
    productId: string,
    change: number,
    reason: string,
    productName?: string,
    user?: string
  ) => {
    try {
      return await inventoryLogsDbService.create({
        productId,
        productName,
        change,
        reason,
        user: user || 'Store Admin',
      });
    } catch (error) {
      console.error('[db.ts] Failed to record stock transition log:', error);
    }
  },
};

// Default export consolidating all CRUD services
export default {
  products: productsDbService,
  orders: ordersDbService,
  inventoryLogs: inventoryLogsDbService,
  sync: dbStateSyncService,
  apiBaseUrl: API_BASE_URL,
};
