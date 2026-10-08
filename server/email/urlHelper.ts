/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getEmailConfig } from './config';

/**
 * Builds an absolute storefront URL from relative path and optional parameters
 */
export function buildUrl(path: string = '', params?: Record<string, string | number | boolean | undefined>): string {
  const config = getEmailConfig();
  const base = config.urls.frontendUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : path ? `/${path}` : '';
  let url = `${base}${cleanPath || '/'}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  return url;
}

/**
 * Builds an absolute order tracking URL that is universally compatible with Django / Nginx / cPanel
 * backend routing (which serves the homepage on /) while automatically triggering the React Order Status modal.
 */
export function buildTrackUrl(orderId: string): string {
  return buildUrl('/', { trackOrder: orderId });
}

/**
 * Builds an absolute admin portal URL
 */
export function buildAdminUrl(path: string = '', params?: Record<string, string | number | boolean | undefined>): string {
  const config = getEmailConfig();
  const base = config.urls.adminUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  let url = `${base}${cleanPath}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  return url;
}

/**
 * Formats a monetary amount in Kenya Shillings (KES)
 * Example: formatKES(1500) -> "KES 1,500"
 */
export function formatKES(amount: number | string | undefined | null): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount || '0'));
  if (isNaN(num)) return 'KES 0';
  return `KES ${Math.round(num).toLocaleString('en-KE')}`;
}

/**
 * Formats a date/timestamp to East Africa Time (Africa/Nairobi) string
 * Example: formatEATDate("2026-09-29T00:15:00Z") -> "29 Sep 2026, 03:15 AM EAT"
 */
export function formatEATDate(dateInput: string | Date | number | undefined | null): string {
  if (!dateInput) return 'N/A';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return String(dateInput);

    return new Intl.DateTimeFormat('en-KE', {
      timeZone: 'Africa/Nairobi',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date) + ' EAT';
  } catch {
    return String(dateInput);
  }
}
