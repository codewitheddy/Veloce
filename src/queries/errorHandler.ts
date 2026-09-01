/**
 * Centralized Error-Handling Utility for TanStack Query
 * Intercepts HTTP status codes (401, 403, 400, 422, 429, 500), extracts backend validation errors
 * from Django REST Framework responses, and displays accessible, user-friendly toast notifications.
 */

import { AxiosError } from 'axios';
import { Query, Mutation } from '@tanstack/react-query';
import { toast, ToastAction } from '../lib/toast';
import { purgeUserQueriesOnLogout } from '../providers/QueryProvider';

export interface ExtractedApiError {
  statusCode: number;
  title: string;
  message: string;
  details?: string[];
  validationFields?: Record<string, string[]>;
  isAuthError: boolean;
  isPermissionError: boolean;
  isValidationError: boolean;
  isNetworkError: boolean;
}

export interface QueryErrorMeta {
  suppressGlobalErrorToast?: boolean;
  errorMessage?: string;
  errorTitle?: string;
  action?: ToastAction;
  onAuthError?: () => void;
}

/**
 * Parses raw Axios or runtime errors into structured backend validation and status details.
 */
export function parseQueryError(error: unknown, fallbackMessage?: string): ExtractedApiError {
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosError = error as AxiosError<any>;
    const statusCode = axiosError.response?.status || (axiosError.code === 'ERR_NETWORK' ? 0 : 500);
    const data = axiosError.response?.data;
    const details: string[] = [];
    const validationFields: Record<string, string[]> = {};

    let title = 'Request Failed';
    let message = fallbackMessage || 'An unexpected error occurred. Please try again.';

    // 1. Check for specific HTTP Status Codes
    if (statusCode === 401) {
      title = 'Session Expired';
      message = 'Your session has expired or you are not logged in. Please sign in to continue.';
      if (typeof data === 'object' && data?.detail) {
        message = String(data.detail);
      }
    } else if (statusCode === 403) {
      title = 'Access Denied';
      message = 'You do not have permission to access this resource or perform this action.';
      if (typeof data === 'object' && data?.detail) {
        message = String(data.detail);
      }
    } else if (statusCode === 404) {
      title = 'Not Found';
      message = 'The requested item or resource could not be found.';
      if (typeof data === 'object' && data?.detail) {
        message = String(data.detail);
      }
    } else if (statusCode === 429) {
      title = 'Rate Limit Exceeded';
      message = 'Too many requests were sent in a short period. Please wait a moment and try again.';
    } else if (statusCode >= 500) {
      title = 'Server Error';
      message = 'The server encountered an error processing your request. Please try again later.';
    } else if (statusCode === 0 || axiosError.code === 'ERR_NETWORK') {
      title = 'Connection Error';
      message = 'Unable to connect to the server. Please check your internet connection.';
    } else if (statusCode === 400 || statusCode === 422) {
      title = 'Validation Error';
      message = 'Please check the information provided and correct any errors below.';
    }

    // 2. Extract detailed field errors from Django REST Framework response format
    if (data && typeof data === 'object') {
      // Direct string fields: { detail: "...", message: "...", error: "..." }
      if (data.message && typeof data.message === 'string' && statusCode !== 401 && statusCode !== 403) {
        message = data.message;
      } else if (data.detail && typeof data.detail === 'string' && statusCode !== 401 && statusCode !== 403) {
        message = data.detail;
      } else if (data.error && typeof data.error === 'string') {
        message = data.error;
      }

      // Non-field errors from Django DRF: { non_field_errors: ["..."] }
      if (Array.isArray(data.non_field_errors)) {
        data.non_field_errors.forEach((err: any) => {
          if (typeof err === 'string') {
            details.push(err);
            if (message.startsWith('Please check')) {
              message = err;
            }
          }
        });
      }

      // Field-specific validation map: { email: ["Invalid email format"], quantity: ["Must be > 0"] }
      Object.entries(data).forEach(([key, val]) => {
        if (key === 'detail' || key === 'message' || key === 'error' || key === 'non_field_errors') {
          return;
        }

        const formattedKey = key
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());

        if (Array.isArray(val)) {
          const stringErrors = val.map(String);
          validationFields[key] = stringErrors;
          stringErrors.forEach((v) => details.push(`${formattedKey}: ${v}`));
        } else if (typeof val === 'string') {
          validationFields[key] = [val];
          details.push(`${formattedKey}: ${val}`);
        } else if (typeof val === 'object' && val !== null) {
          // Nested object error
          const nestedMsg = JSON.stringify(val);
          validationFields[key] = [nestedMsg];
          details.push(`${formattedKey}: ${nestedMsg}`);
        }
      });
    } else if (typeof data === 'string' && data.length > 0 && !data.includes('<!DOCTYPE')) {
      message = data;
    }

    return {
      statusCode,
      title,
      message,
      details: details.length > 0 ? details : undefined,
      validationFields: Object.keys(validationFields).length > 0 ? validationFields : undefined,
      isAuthError: statusCode === 401,
      isPermissionError: statusCode === 403,
      isValidationError: statusCode === 400 || statusCode === 422 || details.length > 0,
      isNetworkError: statusCode === 0 || axiosError.code === 'ERR_NETWORK',
    };
  }

  // Generic Error object handling
  const errMsg = error instanceof Error ? error.message : String(error || fallbackMessage || 'An unknown error occurred.');
  return {
    statusCode: 500,
    title: 'Unexpected Error',
    message: errMsg,
    isAuthError: false,
    isPermissionError: false,
    isValidationError: false,
    isNetworkError: false,
  };
}

/**
 * Intercepts and processes 401 Unauthorized states globally:
 * - Purges sensitive user query caches
 * - Dispatches a window custom event so UI can react (e.g. open auth dialog or prompt re-login)
 */
export function handleAuthError(errorDetails: ExtractedApiError) {
  if (errorDetails.isAuthError) {
    try {
      purgeUserQueriesOnLogout();
      // Dispatch browser custom event for UI components to listen to
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('veloce:auth-expired', {
            detail: { message: errorDetails.message },
          })
        );
      }
    } catch (e) {
      console.warn('Could not purge user queries on 401:', e);
    }
  }
}

/**
 * Global TanStack Query Cache Error Handler
 * Invoked whenever a `useQuery` encounters a failed fetch.
 */
export function handleQueryError(error: unknown, query: Query<any, any, any, any>) {
  const meta = (query.meta || {}) as QueryErrorMeta;

  // If the query explicitly requested suppressing the global toast, skip toast
  if (meta.suppressGlobalErrorToast) {
    return;
  }

  const parsed = parseQueryError(error, meta.errorMessage);

  // If 401 Unauthorized, perform token/cache cleanup & notify
  if (parsed.isAuthError) {
    handleAuthError(parsed);
    meta.onAuthError?.();
  }

  // Dispatch toast notification
  toast.show({
    type: parsed.isAuthError || parsed.isPermissionError ? 'warning' : 'error',
    title: meta.errorTitle || parsed.title,
    message: meta.errorMessage || parsed.message,
    details: parsed.details,
    statusCode: parsed.statusCode,
    action: meta.action,
  });
}

/**
 * Global TanStack Mutation Cache Error Handler
 * Invoked whenever a `useMutation` encounters an error during execution.
 */
export function handleMutationError(
  error: unknown,
  _variables: unknown,
  _context: unknown,
  mutation: Mutation<any, any, any, any>
) {
  const meta = (mutation.meta || {}) as QueryErrorMeta;

  if (meta.suppressGlobalErrorToast) {
    return;
  }

  const parsed = parseQueryError(error, meta.errorMessage);

  if (parsed.isAuthError) {
    handleAuthError(parsed);
    meta.onAuthError?.();
  }

  // Display user-friendly notification with validation breakdown if available
  toast.show({
    type: parsed.isAuthError || parsed.isPermissionError ? 'warning' : 'error',
    title: meta.errorTitle || parsed.title,
    message: meta.errorMessage || parsed.message,
    details: parsed.details,
    statusCode: parsed.statusCode,
    action: meta.action,
  });
}
