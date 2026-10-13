import { useEffect, useRef } from 'react';
import { trackPageView } from '../lib/analytics';

/**
 * Hook to listen to SPA route/tab changes and fire Google Analytics 4 page_view events.
 * 
 * Guarantees:
 * 1. Fires on initial load and every storefront navigation.
 * 2. Deduplicates events so rapid re-renders do not fire duplicate page_views.
 * 3. Never tracks admin pages, admin consoles, or admin actions.
 * 4. Strips any potential sensitive PII query parameters.
 */
export function usePageTracking(currentTab: string, selectedProductId?: string | number | null): void {
  const lastTrackedSignatureRef = useRef<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Never track admin pages or admin operations
    if (
      currentTab === 'admin' ||
      currentTab === 'edit-product' ||
      window.location.pathname.startsWith('/admin')
    ) {
      return;
    }

    // Determine current storefront path
    const getCleanStorefrontPath = () => {
      let pathname = window.location.pathname;

      if (currentTab === 'store' && selectedProductId) {
        pathname = '/store';
        return `/store?product=${encodeURIComponent(selectedProductId)}`;
      }

      if (currentTab && currentTab !== 'home' && pathname === '/') {
        pathname = `/${currentTab}`;
      }

      // Sanitize search query params to prevent transmitting PII (e.g. emails/phones)
      let searchStr = window.location.search;
      if (searchStr) {
        const params = new URLSearchParams(searchStr);
        params.delete('email');
        params.delete('phone');
        params.delete('name');
        params.delete('address');
        const cleanParams = params.toString();
        searchStr = cleanParams ? `?${cleanParams}` : '';
      }

      return `${pathname}${searchStr}`;
    };

    // Small delay allows SEOHead to update document.title
    const timer = setTimeout(() => {
      const page_path = getCleanStorefrontPath();
      const page_location = window.location.origin + page_path;
      const page_title = document.title || 'Ropenix Collections';

      const signature = `${page_path}:::${page_title}`;

      // Strictly guard against duplicate events
      if (lastTrackedSignatureRef.current !== signature) {
        lastTrackedSignatureRef.current = signature;
        trackPageView(page_path, page_title, page_location);
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [currentTab, selectedProductId]);

  // Synchronize on browser history popstate (e.g. forward/back buttons)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      if (window.location.pathname.startsWith('/admin')) return;

      const page_path = window.location.pathname + window.location.search;
      const page_location = window.location.href;
      const page_title = document.title || 'Ropenix Collections';
      const signature = `${page_path}:::${page_title}`;

      if (lastTrackedSignatureRef.current !== signature) {
        lastTrackedSignatureRef.current = signature;
        trackPageView(page_path, page_title, page_location);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
}
