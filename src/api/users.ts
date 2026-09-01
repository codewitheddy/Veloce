import api from './client';

export interface CustomerProfile {
  id?: number | string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  shipping_address?: string;
  role?: 'customer' | 'admin';
}

export interface UserNotificationItem {
  id: string | number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link_url?: string;
  created_at: string;
}

export const usersApi = {
  /**
   * Retrieves authenticated user's profile
   */
  getMe: async (): Promise<CustomerProfile> => {
    const response = await api.get('/users/me/');
    return response.data;
  },

  /**
   * Updates authenticated user profile details
   */
  updateProfile: async (profileData: Partial<CustomerProfile>): Promise<CustomerProfile> => {
    const response = await api.put('/users/me/', profileData);
    return response.data;
  },

  /**
   * Retrieves in-app notification alerts for the current user
   */
  getNotifications: async (): Promise<UserNotificationItem[]> => {
    const response = await api.get('/users/notifications/');
    const data = response.data;
    return Array.isArray(data) ? data : (data?.results || []);
  },

  /**
   * Marks a notification as read
   */
  markNotificationRead: async (id: string | number): Promise<{ success: boolean }> => {
    const response = await api.post(`/users/notifications/${id}/read/`);
    return response.data;
  },
};
