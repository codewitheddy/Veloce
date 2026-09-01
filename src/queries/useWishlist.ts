import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wishlistApi } from '../api/wishlist';
import { queryKeys } from './keys';

/**
 * Reusable hook for fetching user wishlist product IDs.
 */
export const useWishlist = () => {
  return useQuery({
    queryKey: queryKeys.wishlist.list(),
    queryFn: () => wishlistApi.getWishlist(),
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Mutation hook for toggling a product in the wishlist with Optimistic Updates & Rollback.
 */
export const useToggleWishlist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, inWishlist }: { productId: string; inWishlist: boolean }) =>
      wishlistApi.toggleWishlist(productId, inWishlist),

    // Optimistic Update: Immediately update cache before network request completes
    onMutate: async ({ productId, inWishlist }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.wishlist.list() });

      const previousWishlist = queryClient.getQueryData<string[]>(queryKeys.wishlist.list()) || [];

      const nextWishlist = inWishlist
        ? previousWishlist.filter((id) => id !== productId)
        : [...previousWishlist, productId];

      queryClient.setQueryData(queryKeys.wishlist.list(), nextWishlist);

      // Return context with rollback snapshot
      return { previousWishlist };
    },

    // Rollback to previous state if API call fails
    onError: (_err, _variables, context) => {
      if (context?.previousWishlist) {
        queryClient.setQueryData(queryKeys.wishlist.list(), context.previousWishlist);
      }
    },

    // Always re-sync with server state after mutation settles
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.list() });
    },
  });
};
