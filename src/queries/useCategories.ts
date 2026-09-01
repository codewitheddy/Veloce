import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '../api/categories';
import { queryKeys } from './keys';
import { Category } from '../types';

/**
 * Reusable hook for fetching categories with 10-minute caching.
 */
export const useCategories = () => {
  return useQuery({
    queryKey: queryKeys.categories.list(),
    queryFn: () => categoriesApi.getCategories(),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

/**
 * Reusable hook for fetching a single category.
 */
export const useCategory = (id: string | undefined) => {
  return useQuery({
    queryKey: queryKeys.categories.detail(id || ''),
    queryFn: () => categoriesApi.getCategory(id!),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 10,
  });
};

/**
 * Mutation hook for creating a category.
 */
export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryData: Partial<Category>) => categoriesApi.createCategory(categoryData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
};

/**
 * Mutation hook for updating a category.
 */
export const useUpdateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Category> }) =>
      categoriesApi.updateCategory(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.categories.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.list() });
    },
  });
};
