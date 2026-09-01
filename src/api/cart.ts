import api from './client';
import { CartItem } from '../types';

export const cartApi = {
  /**
   * Retrieves server-persisted cart for authenticated user
   */
  getCart: async (userId?: string): Promise<CartItem[]> => {
    try {
      const response = await api.get('/cart', { params: { userId } });
      const data = response.data;
      return Array.isArray(data) ? data : (data?.items || []);
    } catch {
      const local = localStorage.getItem('veloce_cart');
      return local ? JSON.parse(local) : [];
    }
  },

  /**
   * Synchronizes entire cart items array with server
   */
  syncCart: async (items: CartItem[], userId?: string): Promise<{ success: boolean; items: CartItem[] }> => {
    try {
      const response = await api.post('/cart/sync', { items, userId });
      return { success: true, items: response.data?.items || items };
    } catch {
      localStorage.setItem('veloce_cart', JSON.stringify(items));
      return { success: true, items };
    }
  },

  /**
   * Clears server cart
   */
  clearCart: async (userId?: string): Promise<{ success: boolean }> => {
    try {
      await api.delete('/cart', { params: { userId } });
    } catch {
      localStorage.removeItem('veloce_cart');
    }
    return { success: true };
  },
};
