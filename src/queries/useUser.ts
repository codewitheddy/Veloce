import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, CustomerProfile } from '../api/users';
import { queryKeys } from './keys';

/**
 * Reusable hook for fetching the authenticated user profile.
 */
export const useUserProfile = (enabled: boolean = true) => {
  return useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => usersApi.getMe(),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Mutation hook for updating customer profile details.
 */
export const useUpdateUserProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profileData: Partial<CustomerProfile>) => usersApi.updateProfile(profileData),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(queryKeys.users.me(), updatedProfile);
    },
  });
};

/**
 * Reusable hook for fetching customer notification alerts.
 */
export const useUserNotifications = (enabled: boolean = true) => {
  return useQuery({
    queryKey: queryKeys.users.notifications(),
    queryFn: () => usersApi.getNotifications(),
    enabled,
    staleTime: 1000 * 30, // 30 seconds
  });
};

/**
 * Mutation hook for marking an in-app notification as read.
 */
export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string | number) => usersApi.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.notifications() });
    },
  });
};
