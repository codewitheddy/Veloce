import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { ordersApi, OrderQueryParams } from '../api/orders';
import { queryKeys } from './keys';
import { Order } from '../types';

/**
 * Reusable hook for fetching orders with 30-second stale time for timely status tracking.
 */
export const useOrders = (params?: OrderQueryParams) => {
  return useQuery({
    queryKey: queryKeys.orders.list(params),
    queryFn: () => ordersApi.getOrders(params),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30, // 30 seconds
  });
};

/**
 * Reusable hook for fetching individual order details.
 */
export const useOrder = (id: string | undefined) => {
  return useQuery({
    queryKey: queryKeys.orders.detail(id || ''),
    queryFn: () => ordersApi.getOrder(id!),
    enabled: Boolean(id),
    staleTime: 1000 * 30,
  });
};

/**
 * Mutation hook for placing an order.
 * Invalidates orders, products (for stock reduction), and user notifications.
 */
export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderData: Partial<Order>) => ordersApi.createOrder(orderData),
    onSuccess: (newOrder) => {
      // Invalidate orders list
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      // Invalidate catalog to refresh remaining stock
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      // Invalidate user notifications
      queryClient.invalidateQueries({ queryKey: queryKeys.users.notifications() });
      // Set new order directly in cache
      queryClient.setQueryData(queryKeys.orders.detail(newOrder.id), newOrder);
    },
  });
};

/**
 * Mutation hook for changing order status (e.g. Processing -> Shipped).
 */
export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      status,
      trackingNumber,
    }: {
      orderId: string;
      status: string;
      trackingNumber?: string;
    }) => ordersApi.updateOrderStatus(orderId, status, trackingNumber),
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData(queryKeys.orders.detail(updatedOrder.id), updatedOrder);
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
    },
  });
};

/**
 * Mutation hook for triggering asynchronous order confirmation email resend.
 */
export const useResendOrderConfirmation = () => {
  return useMutation({
    mutationFn: (orderId: string) => ordersApi.resendConfirmation(orderId),
  });
};
