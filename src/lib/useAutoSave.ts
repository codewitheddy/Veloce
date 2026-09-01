import { useEffect, useRef } from 'react';
import { safeLocalStorageSetItem } from './storage';

/**
 * A custom hook that automatically saves state key-value pairs to localStorage 
 * at a specified interval (defaulting to 30 seconds) to prevent data loss.
 *
 * @param stateToSave Object mapping localStorage keys to their current state values
 * @param intervalMs How often to perform the save in milliseconds (defaults to 30000ms)
 * @param onSave Optional callback triggered after a successful auto-save
 */
export function useAutoSave(
  stateToSave: Record<string, any>,
  intervalMs: number = 30000,
  onSave?: () => void
) {
  const stateRef = useRef(stateToSave);

  // Always keep the ref up-to-date with the latest state values without re-triggering the interval effect
  useEffect(() => {
    stateRef.current = stateToSave;
  }, [stateToSave]);

  useEffect(() => {
    const interval = setInterval(() => {
      Object.entries(stateRef.current).forEach(([key, value]) => {
        try {
          if (value === null || value === undefined) {
            localStorage.removeItem(key);
          } else {
            const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
            safeLocalStorageSetItem(key, serialized);
          }
        } catch (error) {
          console.error(`[AutoSave] Failed to save key "${key}" to localStorage:`, error);
        }
      });
      if (onSave) {
        onSave();
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs, onSave]);
}
