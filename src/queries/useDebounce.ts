import { useState, useEffect } from 'react';

/**
 * Custom hook for debouncing fast-changing inputs (e.g. live search bar keystrokes)
 * Prevents firing API requests on every individual character change.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
