/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Centralized utility for accessing and managing authentication tokens across storage mechanisms.
 */

export const TOKEN_STORAGE_KEYS = [
  'veloce_admin_token',
  'veloce_auth_token',
  'access_token',
  'token',
] as const;

export const REFRESH_TOKEN_STORAGE_KEYS = [
  'veloce_refresh_token',
  'refresh_token',
] as const;

/**
 * Retrieves the currently active JWT token from browser localStorage
 */
export function getStoredAuthToken(): string {
  if (typeof window === 'undefined') return '';
  for (const key of TOKEN_STORAGE_KEYS) {
    const token = localStorage.getItem(key);
    if (token && typeof token === 'string' && token.trim().length > 0) {
      return token.trim();
    }
  }
  return '';
}

/**
 * Returns standard Authorization header object if a token is present
 */
export function getAuthHeaders(existingHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getStoredAuthToken();
  if (token) {
    return {
      ...existingHeaders,
      Authorization: `Bearer ${token}`,
    };
  }
  return { ...existingHeaders };
}

export const ROLE_STORAGE_KEYS = [
  'veloce_user_role',
  'veloce_admin_email',
  'veloce_remember_admin',
] as const;

/**
 * Checks whether a JWT string is structurally valid and not expired
 */
export function isJwtExpired(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return true;
  try {
    const parts = token.trim().split('.');
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    // Expired if current time exceeds expiration (with 2 second leeway)
    return Date.now() >= (payload.exp * 1000) - 2000;
  } catch {
    return true;
  }
}

/**
 * Retrieves valid unexpired token, or returns empty string if missing or expired
 */
export function getValidStoredAuthToken(): string {
  const token = getStoredAuthToken();
  if (!token) return '';
  if (isJwtExpired(token)) {
    return '';
  }
  return token;
}

/**
 * Returns true if an unexpired admin JWT is stored in localStorage
 */
export function hasValidAdminSession(): boolean {
  const token = getValidStoredAuthToken();
  return Boolean(token && token.length > 0);
}

/**
 * Clears all authentication tokens from localStorage
 */
export function clearAllStoredAuthTokens(): void {
  if (typeof window === 'undefined') return;
  TOKEN_STORAGE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  });
  REFRESH_TOKEN_STORAGE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  });
  ROLE_STORAGE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  });
}

