import React, { ReactNode } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
  QueryFunction,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AxiosError } from 'axios';
import { queryKeys } from '../queries/keys';
import { handleQueryError, handleMutationError } from '../queries/errorHandler';
import { ToastContainer } from '../components/ui/ToastNotification';
import { useProductSync } from '../hooks/useProductSync';
import { productsApi } from '../api/products';
import { categoriesApi } from '../api/categories';
import { ordersApi } from '../api/orders';
import { reviewsApi } from '../api/reviews';
import { usersApi } from '../api/users';
import { wishlistApi } from '../api/wishlist';
import { cartApi } from '../api/cart';

/**
 * Internal component that activates product sync
 * Must be inside QueryClientProvider context
 */
const ProductSyncActivator: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Activate product sync with polling
  useProductSync({
    enabled: true,
    pollIntervalMs: 10000, // Poll every 10 seconds
    enableConsoleLogging: import.meta.env.DEV,
  });

  return <>{children}</>;
};

/**
 * Default Query Function to resolve cached or invalidated queries
 * that were initialized without an explicit queryFn (e.g. via setQueryData).
 */
export const defaultQueryFn: QueryFunction = async ({ queryKey }) => {
  if (!Array.isArray(queryKey) || queryKey.length === 0) {
    throw new Error(`Invalid queryKey: ${JSON.stringify(queryKey)}`);
  }

  const [domain, action, param] = queryKey;

  // Products
  if (domain === 'products') {
    if (action === 'detail' && typeof param === 'string' && param.length > 0) {
      return productsApi.getProduct(param);
    }
    if (action === 'list' || action === 'infinite') {
      return productsApi.getProducts(param as any);
    }
  }

  // Categories
  if (domain === 'categories') {
    if (action === 'list') {
      return categoriesApi.getCategories();
    }
    if (action === 'detail' && typeof param === 'string' && param.length > 0) {
      return categoriesApi.getCategory(param);
    }
  }

  // Reviews
  if (domain === 'reviews') {
    if (action === 'list' && typeof param === 'string' && param.length > 0) {
      return reviewsApi.getProductReviews(param);
    }
  }

  // Orders
  if (domain === 'orders') {
    if (action === 'list') {
      return ordersApi.getOrders(param as any);
    }
    if (action === 'detail' && typeof param === 'string' && param.length > 0) {
      return ordersApi.getOrder(param);
    }
  }

  // Users & Profile
  if (domain === 'users') {
    if (action === 'me') {
      return usersApi.getMe();
    }
    if (action === 'notifications') {
      return usersApi.getNotifications();
    }
  }

  // Wishlist
  if (domain === 'wishlist') {
    if (action === 'list') {
      return wishlistApi.getWishlist();
    }
  }

  // Cart
  if (domain === 'cart') {
    if (action === 'items') {
      return cartApi.getCart(param !== 'guest' ? (param as string) : undefined);
    }
  }

  throw new Error(`Missing queryFn for queryKey: '${JSON.stringify(queryKey)}'`);
};

/**
 * Creates and configures a production-grade QueryClient tailored for eCommerce operations.
 */
export const createQueryClient = (): QueryClient => {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Global query error logging
        if (import.meta.env.DEV) {
          console.warn(`[Query Error] ${query.queryKey.join(' > ')}:`, error);
        }
        // Centralized Toast and 401/403 Interception
        handleQueryError(error, query);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, variables, context, mutation) => {
        // Global mutation error logging
        if (import.meta.env.DEV) {
          console.error(`[Mutation Error]:`, error, mutation);
        }
        // Centralized Toast and Validation Error Interception
        handleMutationError(error, variables, context, mutation);
      },
    }),
    defaultOptions: {
      queries: {
        queryFn: defaultQueryFn,
        // 5 minutes stale time for catalog items (prevents unnecessary re-fetching on rapid navigation)
        staleTime: 1000 * 60 * 5,
        // Keep inactive cache items for 15 minutes in memory
        gcTime: 1000 * 60 * 15,
        // Disable aggressive window focus refetching on storefront browsing
        refetchOnWindowFocus: false,
        // Automatically sync fresh data when network recovers
        refetchOnReconnect: true,
        // Intelligent retry strategy: Do not retry 4xx client errors (400, 401, 403, 404)
        retry: (failureCount, error) => {
          if (failureCount >= 2) return false;
          if (error && typeof error === 'object' && 'isAxiosError' in error) {
            const axiosError = error as AxiosError;
            const status = axiosError.response?.status;
            if (status && status >= 400 && status < 500) {
              return false; // Do not retry client auth/validation errors
            }
          }
          return true;
        },
      },
      mutations: {
        // Never automatically retry mutations (especially payments & orders) to avoid duplicate transactions
        retry: false,
      },
    },
  });
};

// Global singleton client for the application lifecycle
export const queryClient = createQueryClient();

/**
 * Utility function to completely clear user-specific query caches upon logout
 * Prevents account data leaks between sessions.
 */
export const purgeUserQueriesOnLogout = () => {
  queryClient.removeQueries({ queryKey: queryKeys.orders.all });
  queryClient.removeQueries({ queryKey: queryKeys.users.all });
  queryClient.removeQueries({ queryKey: queryKeys.wishlist.all });
  queryClient.removeQueries({ queryKey: queryKeys.cart.all });
  queryClient.removeQueries({ queryKey: queryKeys.reports.all });
};

interface QueryProviderProps {
  children: ReactNode;
  client?: QueryClient;
}

export const QueryProvider: React.FC<QueryProviderProps> = ({ children, client = queryClient }) => {
  return (
    <QueryClientProvider client={client}>
      <ProductSyncActivator>
        {children}
        <ToastContainer />
        {import.meta.env.DEV && (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
        )}
      </ProductSyncActivator>
    </QueryClientProvider>
  );
};

export default QueryProvider;
