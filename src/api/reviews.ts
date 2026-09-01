import api from './client';
import { Review } from '../types';

export const reviewsApi = {
  /**
   * Retrieves approved reviews for a given product
   */
  getProductReviews: async (productId: string): Promise<Review[]> => {
    const response = await api.get(`/products/${productId}/reviews/`);
    const data = response.data;
    return Array.isArray(data) ? data : (data?.results || []);
  },

  /**
   * Submits a verified review for a product
   */
  addReview: async (productId: string, review: Partial<Review>): Promise<Review> => {
    const response = await api.post(`/products/${productId}/reviews/`, {
      title: review.title || '',
      comment: review.comment,
      rating: review.rating,
      user_name: review.userName,
      user_email: review.userEmail,
      order_id: review.orderId,
      media_urls: review.mediaUrls || [],
    });
    return response.data;
  },

  /**
   * Casts a helpful vote for a customer review
   */
  voteHelpful: async (reviewId: string): Promise<{ success: boolean; helpfulVotes: number }> => {
    const response = await api.post(`/reviews/${reviewId}/vote-helpful/`);
    return response.data;
  },
};
