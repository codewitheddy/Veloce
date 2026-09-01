import api from './client';

export const wishlistApi = {
  /**
   * Retrieves wishlist product IDs for the current user
   */
  getWishlist: async (): Promise<string[]> => {
    try {
      const response = await api.get('/wishlist/');
      const data = response.data;
      if (Array.isArray(data)) {
        return data.map((item: any) => (typeof item === 'string' ? item : String(item.product_id || item.id)));
      }
      return data?.product_ids || [];
    } catch {
      // Fallback to local storage if unauthenticated guest
      const local = localStorage.getItem('veloce_wishlist');
      return local ? JSON.parse(local) : [];
    }
  },

  /**
   * Adds an item to user's server wishlist
   */
  addToWishlist: async (productId: string): Promise<{ success: boolean; productId: string }> => {
    try {
      await api.post('/wishlist/', { product_id: productId });
    } catch {
      // Guest local sync fallback
      const local = localStorage.getItem('veloce_wishlist');
      const list: string[] = local ? JSON.parse(local) : [];
      if (!list.includes(productId)) {
        localStorage.setItem('veloce_wishlist', JSON.stringify([...list, productId]));
      }
    }
    return { success: true, productId };
  },

  /**
   * Removes an item from user's server wishlist
   */
  removeFromWishlist: async (productId: string): Promise<{ success: boolean; productId: string }> => {
    try {
      await api.delete(`/wishlist/${productId}/`);
    } catch {
      const local = localStorage.getItem('veloce_wishlist');
      if (local) {
        const list: string[] = JSON.parse(local);
        localStorage.setItem('veloce_wishlist', JSON.stringify(list.filter((id) => id !== productId)));
      }
    }
    return { success: true, productId };
  },

  /**
   * Toggles product in wishlist
   */
  toggleWishlist: async (productId: string, currentlyInWishlist: boolean): Promise<{ success: boolean; inWishlist: boolean; productId: string }> => {
    if (currentlyInWishlist) {
      await wishlistApi.removeFromWishlist(productId);
      return { success: true, inWishlist: false, productId };
    } else {
      await wishlistApi.addToWishlist(productId);
      return { success: true, inWishlist: true, productId };
    }
  },
};
