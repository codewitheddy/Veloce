import React, { lazy } from 'react';

/**
 * Checks whether an error is caused by a missing/stale Vite chunk or dynamic module fetch failure.
 */
export function isDynamicImportError(error: any): boolean {
  if (!error) return false;
  const message = typeof error === 'string' ? error : (error.message || error.toString() || '');
  return (
    /failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /loading chunk/i.test(message) ||
    /importing a module script failed/i.test(message) ||
    error.name === 'ChunkLoadError'
  );
}

/**
 * Resilient lazy loading wrapper with automatic retry, exponential backoff,
 * and automatic page reload on stale module chunks / dev server restarts.
 *
 * @param componentImport Function returning the dynamic import promise
 * @param componentName Optional identifier for scoped reload tracking
 * @param retriesLeft Maximum retry attempts before falling back (default: 3)
 * @param baseInterval Initial backoff interval in ms (default: 400)
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  componentName = 'module',
  retriesLeft = 3,
  baseInterval = 400
): React.LazyExoticComponent<T> {
  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remaining: number, attemptIndex: number) => {
        componentImport()
          .then(resolve)
          .catch((error) => {
            const isImportError = isDynamicImportError(error);

            if (remaining > 0) {
              const delay = baseInterval * Math.pow(1.8, attemptIndex);
              console.warn(
                `[lazyWithRetry] Dynamic import failed for "${componentName}". Retrying (${remaining} retries left) in ${Math.round(
                  delay
                )}ms...`,
                error
              );
              setTimeout(() => {
                attempt(remaining - 1, attemptIndex + 1);
              }, delay);
            } else if (isImportError && typeof window !== 'undefined') {
              const storageKey = `retry_lazy_${componentName}_reload`;
              const lastReload = Number(sessionStorage.getItem(storageKey) || 0);
              const now = Date.now();

              // If we haven't reloaded within the last 15 seconds for this component, auto-reload to fetch the fresh bundle/module
              if (!lastReload || now - lastReload > 15000) {
                sessionStorage.setItem(storageKey, String(now));
                console.warn(
                  `[lazyWithRetry] Stale module chunk or disconnected dev server detected for "${componentName}". Triggering page refresh to fetch updated bundle...`,
                  error
                );
                window.location.reload();
                return;
              }

              console.error(`[lazyWithRetry] Persistent dynamic module load failure for "${componentName}":`, error);
              reject(error);
            } else {
              console.error(`[lazyWithRetry] Module load failed for "${componentName}":`, error);
              reject(error);
            }
          });
      };

      attempt(retriesLeft, 0);
    })
  );
}

export default lazyWithRetry;
