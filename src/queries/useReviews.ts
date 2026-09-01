import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewsApi } from '../api/reviews';
import { queryKeys } from './keys';
import { Review } from '../types';

/**
 * Reusable hook for fetching approved reviews for a product.
 */
export const useProductReviews = (productId: string | undefined) => {
  return useQuery({
    queryKey: queryKeys.reviews.list(productId || ''),
    queryFn: () => reviewsApi.getProductReviews(productId!),
    enabled: Boolean(productId),
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Mutation hook for submitting a new review.
 * Invalidates both reviews list and product detail cache (for rating recalculation).
 */
export const useAddReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, review }: { productId: string; review: Partial<Review> }) =>
      reviewsApi.addReview(productId, review),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.list(productId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(productId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
    },
  });
};

/**
 * Mutation hook for casting helpful votes on reviews.
 */
export const useVoteHelpfulReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reviewId: string) => reviewsApi.voteHelpful(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all });
    },
  });
};
