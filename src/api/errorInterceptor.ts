/**
 * Axios Error Interceptor
 * Intercepts HTTP 401 Unauthorized and 403 Forbidden status codes,
 * clears authentication tokens when unauthenticated, and triggers toast notifications.
 */

import { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import { clearAuthTokens } from '../services/api';
import { toast } from '../lib/toast';

export interface ErrorInterceptorOptions {
  onUnauthorized?: () => void;
  onForbidden?: () => void;
  showToasts?: boolean;
}

/**
 * Extracts a descriptive error message from the response payload
 */
const extractMessage = (data: any, defaultMessage: string): string => {
  if (!data) return defaultMessage;
  if (typeof data === 'string') return data;
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data.message === 'string') return data.message;
  if (typeof data.error === 'string') return data.error;
  return defaultMessage;
};

/**
 * Core response error handler logic for Axios
 */
export const errorResponseInterceptor = (
  error: AxiosError<any>,
  options: ErrorInterceptorOptions = { showToasts: true }
) => {
  if (error.response) {
    const { status, data } = error.response;

    // Handle 401 Unauthorized: token expired, invalid token, or not logged in
    if (status === 401) {
      // Clear persistent and in-memory auth tokens
      clearAuthTokens();

      const message = extractMessage(
        data,
        'Your session has expired or you are not authorized. Please log in again.'
      );

      if (options.showToasts !== false) {
        toast.warning('Session Expired', message, {
          statusCode: 401,
        });
      }

      // Dispatch custom window event for reactive UI authentication sync
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('veloce:auth-expired', {
            detail: { message },
          })
        );
      }

      options.onUnauthorized?.();
    }

    // Handle 403 Forbidden: insufficient permissions
    if (status === 403) {
      const message = extractMessage(
        data,
        'You do not have permission to perform this action or view this resource.'
      );

      if (options.showToasts !== false) {
        toast.error('Access Denied', message, {
          statusCode: 403,
        });
      }

      options.onForbidden?.();
    }
  }

  return Promise.reject(error);
};

/**
 * Registers the error response interceptor on an Axios instance
 */
export const setupErrorInterceptor = (
  axiosInstance: AxiosInstance,
  options?: ErrorInterceptorOptions
): number => {
  return axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => errorResponseInterceptor(error, options)
  );
};

export default setupErrorInterceptor;
