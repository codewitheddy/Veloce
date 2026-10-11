/**
 * Hook to integrate ProductSync service with React Query
 * Automatically invalidates product caches when changes are detected
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getProductSyncService, ProductSyncEvent } from '../services/productSync';
import { queryKeys } from '../queries/keys';

interface UseProductSyncOptions {
  enabled?: boolean;
  pollIntervalMs?: number;
  enableConsoleLogging?: boolean;
}

/**
 * Hook that connects ProductSync service to React Query cache invalidation
 * Automatically invalidates relevant query caches when product changes are detected
 */
export function useProductSync(options: UseProductSyncOptions = {}) {
  const { enabled = true, pollIntervalMs = 10000, enableConsoleLogging = false } = options;
  const queryClient = useQueryClient();
  const subscriptionIdRef = useRef<string | null>(null);
  const syncServiceRef = useRef(getProductSyncService({ pollIntervalMs, enableConsoleLogging }));

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const syncService = syncServiceRef.current;

    // Subscribe to product sync events
    const subscriptionId = syncService.subscribe((event: ProductSyncEvent) => {
      console.log('[useProductSync] Received sync event:', event.type, `(${event.productIds.length} products)`);

      // Invalidate product list queries to force refetch
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.lists(),
        refetchType: 'active',
      });

      // Invalidate infinite queries
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.products.all, 'infinite'],
        refetchType: 'active',
      });

      // Synchronize individual product detail caches
      for (const productId of event.productIds) {
        if (event.type === 'products-deleted') {
          // Remove deleted product from cache
          queryClient.removeQueries({
            queryKey: queryKeys.products.detail(productId),
          });
        } else {
          // If we have full updated product data from sync event, update cache directly
          const product = event.products?.find((p) => p.id === productId);
          if (product) {
            queryClient.setQueryData(queryKeys.products.detail(productId), product);
          } else {
            // Only invalidate if we do not already have the data, and only active observers
            queryClient.invalidateQueries({
              queryKey: queryKeys.products.detail(productId),
              refetchType: 'active',
            });
          }
        }
      }

      // Invalidate search queries to ensure search results are fresh
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.includes('search');
        },
        refetchType: 'active',
      });
    });

    subscriptionIdRef.current = subscriptionId;

    // Start polling
    if (!syncService.isActive()) {
      syncService.startPolling();
    }

    // Cleanup
    return () => {
      if (subscriptionIdRef.current) {
        syncService.unsubscribe(subscriptionIdRef.current);
        subscriptionIdRef.current = null;
      }
    };
  }, [enabled, queryClient, pollIntervalMs, enableConsoleLogging]);

  // Return control functions for testing/manual control
  return {
    forcePoll: () => syncServiceRef.current.forcePoll(),
    stopPolling: () => syncServiceRef.current.stopPolling(),
    startPolling: () => syncServiceRef.current.startPolling(),
    isActive: () => syncServiceRef.current.isActive(),
  };
}
