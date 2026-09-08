import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CartItem, Currency, Product } from '@/types';

export const CURRENCY_RATES: Record<Currency, { symbol: string; rate: number; name: string }> = {
  KES: { symbol: 'KSh', rate: 1.0, name: 'Kenya Shilling' },
  UGX: { symbol: 'USh', rate: 28.5, name: 'Ugandan Shilling' },
  TZS: { symbol: 'TSh', rate: 20.0, name: 'Tanzanian Shilling' },
  RWF: { symbol: 'FRw', rate: 10.2, name: 'Rwandan Franc' },
};

interface CartState {
  items: CartItem[];
  currency: Currency;
  couponCode: string | null;
  discountAmount: number;
  reservationToken: string | null;
  reservationExpiresAt: number | null;
  
  // Actions
  setCurrency: (currency: Currency) => void;
  addItem: (product: Product, quantity?: number, selectedVariations?: Record<string, string>) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string, discount: number) => void;
  removeCoupon: () => void;
  setReservation: (token: string, expiresInSeconds: number) => void;
  clearReservation: () => void;
  
  // Computations
  getItemCount: () => number;
  getRawSubtotal: () => number;
  formatPrice: (amountInKes: number) => string;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      currency: 'KES',
      couponCode: null,
      discountAmount: 0,
      reservationToken: null,
      reservationExpiresAt: null,

      setCurrency: (currency: Currency) => set({ currency }),

      addItem: (product: Product, quantity = 1, selectedVariations) => {
        set((state) => {
          const existingIndex = state.items.findIndex(
            (item) => item.product.id === product.id
          );

          if (existingIndex > -1) {
            const updated = [...state.items];
            updated[existingIndex].quantity += quantity;
            return { items: updated };
          }

          return {
            items: [...state.items, { product, quantity, selectedVariations }],
          };
        });
      },

      removeItem: (productId: string) => {
        set((state) => ({
          items: state.items.filter((item) => item.product.id !== productId),
        }));
      },

      updateQuantity: (productId: string, quantity: number) => {
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter((item) => item.product.id !== productId),
            };
          }
          return {
            items: state.items.map((item) =>
              item.product.id === productId ? { ...item, quantity } : item
            ),
          };
        });
      },

      clearCart: () => {
        set({
          items: [],
          couponCode: null,
          discountAmount: 0,
          reservationToken: null,
          reservationExpiresAt: null,
        });
      },

      applyCoupon: (code: string, discount: number) => {
        set({ couponCode: code, discountAmount: discount });
      },

      removeCoupon: () => {
        set({ couponCode: null, discountAmount: 0 });
      },

      setReservation: (token: string, expiresInSeconds: number) => {
        set({
          reservationToken: token,
          reservationExpiresAt: Date.now() + expiresInSeconds * 1000,
        });
      },

      clearReservation: () => {
        set({ reservationToken: null, reservationExpiresAt: null });
      },

      getItemCount: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getRawSubtotal: () => {
        return get().items.reduce(
          (total, item) => total + Number(item.product.price) * item.quantity,
          0
        );
      },

      formatPrice: (amountInKes: number) => {
        const { currency } = get();
        const config = CURRENCY_RATES[currency] || CURRENCY_RATES.KES;
        const converted = amountInKes * config.rate;
        return `${config.symbol} ${converted.toLocaleString('en-KE', {
          minimumFractionDigits: currency === 'UGX' || currency === 'TZS' ? 0 : 2,
          maximumFractionDigits: 2,
        })}`;
      },
    }),
    {
      name: 'veloce-cart-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
