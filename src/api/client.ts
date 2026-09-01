/**
 * Centralized API Client Interface
 * Re-exports and extends the configured Axios instance with JWT authentication,
 * request/response interceptors, standardized error handling, and token lifecycle management.
 */

import api, {
  TOKEN_KEYS,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
  clearAuthTokens,
  mapBackendProductToFrontend,
} from '../services/api';
import { AxiosError } from 'axios';
import { setupErrorInterceptor, errorResponseInterceptor } from './errorInterceptor';

// Register the 401/403 error response interceptor on the centralized axios instance
setupErrorInterceptor(api);

export interface ApiErrorResponse {
  message: string;
  statusCode: number;
  errors?: Record<string, string[] | string>;
  raw?: any;
}

/**
 * Checks if an error corresponds to an authentication failure (HTTP 401)
 */
export const isAuthError = (error: unknown): boolean => {
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    return (error as AxiosError).response?.status === 401;
  }
  return false;
};

/**
 * Checks if an error corresponds to an authorization / permission failure (HTTP 403)
 */
export const isPermissionError = (error: unknown): boolean => {
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    return (error as AxiosError).response?.status === 403;
  }
  return false;
};

/**
 * Checks if an error corresponds to a client-side validation failure (HTTP 400, 422)
 */
export const isValidationError = (error: unknown): boolean => {
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const status = (error as AxiosError).response?.status;
    return status === 400 || status === 422;
  }
  return false;
};

/**
 * Transforms raw Axios errors into a predictable, user-friendly frontend format.
 */
export const formatApiError = (error: unknown): ApiErrorResponse => {
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosErr = error as AxiosError<any>;
    const statusCode = axiosErr.response?.status || 500;
    const responseData = axiosErr.response?.data;

    let message = 'An unexpected network error occurred. Please try again.';

    if (responseData) {
      if (typeof responseData === 'string') {
        message = responseData;
      } else if (responseData.detail) {
        message = String(responseData.detail);
      } else if (responseData.message) {
        message = String(responseData.message);
      } else if (responseData.error) {
        message = String(responseData.error);
      } else if (typeof responseData === 'object') {
        // Collect field validation errors from DRF
        const fieldErrors = Object.entries(responseData)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
          .join('; ');
        if (fieldErrors) {
          message = fieldErrors;
        }
      }
    } else if (axiosErr.message) {
      message = axiosErr.message;
    }

    return {
      message,
      statusCode,
      errors: typeof responseData === 'object' ? responseData : undefined,
      raw: responseData,
    };
  }

  return {
    message: error instanceof Error ? error.message : 'Unknown error occurred.',
    statusCode: 500,
  };
};

export {
  api,
  TOKEN_KEYS,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
  clearAuthTokens,
  mapBackendProductToFrontend,
  setupErrorInterceptor,
  errorResponseInterceptor,
};

export default api;
