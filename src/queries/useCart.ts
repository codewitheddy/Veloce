import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cartApi } from '../api/cart';
import { queryKeys } from './keys';
import { CartItem } from '../types';

/**
 * Reusable hook for fetching user server cart.
 */
export const useCart = (userId?: string) => {
  return useQuery({
    queryKey: queryKeys.cart.items(userId),
    queryFn: () => cartApi.getCart(userId),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

/**
 * Mutation hook for syncing cart items to server.
 */
export const useSyncCart = (userId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: CartItem[]) => cartApi.syncCart(items, userId),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.cart.items(userId), data.items);
    },
  });
};

/**
 * Mutation hook for clearing cart on checkout completion.
 */
export const useClearCart = (userId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => cartApi.clearCart(userId),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.cart.items(userId), []);
    },
  });
};
