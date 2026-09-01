import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
  UseQueryOptions,
} from '@tanstack/react-query';
import { productsApi, ProductQueryParams, PaginatedProductsResponse } from '../api/products';
import { queryKeys } from './keys';
import { Product } from '../types';

/**
 * Reusable query hook for fetching paginated/filtered products.
 * Uses placeholderData: keepPreviousData to prevent UI flashes during pagination/filter changes.
 */
export const useProducts = (
  params?: ProductQueryParams,
  options?: Omit<UseQueryOptions<PaginatedProductsResponse, Error, PaginatedProductsResponse, any>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.products.list(params),
    queryFn: () => productsApi.getProducts(params),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...options,
  });
};

/**
 * Reusable query hook for fetching a single product detail with caching.
 */
export const useProduct = (
  idOrSlug: string | undefined,
  options?: Omit<UseQueryOptions<Product, Error, Product, any>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.products.detail(idOrSlug || ''),
    queryFn: () => productsApi.getProduct(idOrSlug!),
    enabled: Boolean(idOrSlug),
    staleTime: 1000 * 60 * 10, // 10 minutes for individual product specifications
    ...options,
  });
};

/**
 * Infinite query hook for infinite scrolling product catalogs.
 */
export const useInfiniteProducts = (params?: Omit<ProductQueryParams, 'page'>) => {
  return useInfiniteQuery({
    queryKey: queryKeys.products.infinite(params),
    queryFn: ({ pageParam = 1 }) =>
      productsApi.getProducts({ ...params, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.next) {
        return allPages.length + 1;
      }
      return undefined;
    },
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Helper hook to prefetch product details on user hover or search result focus.
 */
export const usePrefetchProduct = () => {
  const queryClient = useQueryClient();
  return (idOrSlug: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.products.detail(idOrSlug),
      queryFn: () => productsApi.getProduct(idOrSlug),
      staleTime: 1000 * 60 * 10,
    });
  };
};

/**
 * Mutation hook for creating a product. Invalidates product lists.
 */
export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productData: Partial<Product>) => productsApi.createProduct(productData),
    onSuccess: (newProduct) => {
      // Invalidate all product queries so the listing reflects the new product
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
      queryClient.setQueryData(queryKeys.products.detail(newProduct.id), newProduct);
    },
  });
};

/**
 * Mutation hook for updating a product. Updates cache and invalidates lists.
 */
export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) =>
      productsApi.updateProduct(id, data),
    onSuccess: (updatedProduct) => {
      queryClient.setQueryData(queryKeys.products.detail(updatedProduct.id), updatedProduct);
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
    },
  });
};

/**
 * Mutation hook for deleting a product.
 */
export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => productsApi.deleteProduct(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.products.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
    },
  });
};

/**
 * Mutation hook for bulk product updates.
 */
export const useBulkProductAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      product_ids: string[];
      action: 'archive' | 'delete' | 'update_status';
      status?: 'Active' | 'Inactive' | 'Draft' | 'Archived';
    }) => productsApi.bulkAction(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
};
