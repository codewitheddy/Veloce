/**
 * Maps & Distance Calculation Service
 * Calculates driving distance between store locations and customer coordinates with built-in caching.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DistanceResult {
  distanceKm: number;
  durationMinutes: number;
  isCached: boolean;
  source: 'google_maps' | 'calculated_haversine_driving';
}

// Default Store Location (e.g., Nairobi CBD Central Hub: -1.286389, 36.817223)
export const DEFAULT_STORE_LOCATION: Coordinates = {
  lat: -1.286389,
  lng: 36.817223
};

// In-memory cache for distance results to optimize performance and minimize API/computation overhead
const distanceCache = new Map<string, { result: DistanceResult; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 Hours Cache TTL

/**
 * Generates a cache key for store and customer coordinates using rounded precision (4 decimal places ~ 11m accuracy).
 */
export function getDistanceCacheKey(origin: Coordinates, destination: Coordinates): string {
  const oLat = origin.lat.toFixed(4);
  const oLng = origin.lng.toFixed(4);
  const dLat = destination.lat.toFixed(4);
  const dLng = destination.lng.toFixed(4);
  return `${oLat},${oLng}->${dLat},${dLng}`;
}

/**
 * Calculates straight-line distance using Haversine formula and applies a driving factor multiplier (~1.3x)
 * to accurately estimate real-world driving distance and travel time.
 */
export function calculateDrivingDistanceHaversine(
  origin: Coordinates,
  destination: Coordinates
): { distanceKm: number; durationMinutes: number } {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((destination.lat - origin.lat) * Math.PI) / 180;
  const dLng = ((destination.lng - origin.lng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((origin.lat * Math.PI) / 180) *
      Math.cos((destination.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLineKm = R * c;

  // Driving factor multiplier (~1.3x for city/suburban road curvature)
  const drivingFactor = 1.3;
  const distanceKm = Math.round(straightLineKm * drivingFactor * 100) / 100;

  // Estimated driving duration (average 30 km/h speed in traffic + 5 min preparation buffer)
  const durationMinutes = Math.round((distanceKm / 30) * 60) + 5;

  return { distanceKm, durationMinutes };
}

/**
 * Calculates driving distance between an origin and a destination coordinate with cached lookup.
 *
 * @param origin Origin coordinates { lat, lng }
 * @param destination Destination coordinates { lat, lng }
 * @param options Configuration options, e.g., bypassCache
 */
export async function getDrivingDistance(
  origin: Coordinates,
  destination: Coordinates,
  options?: { bypassCache?: boolean }
): Promise<DistanceResult> {
  return calculateDrivingDistance(destination, origin, options);
}

/**
 * Calculates driving distance between a store location and customer coordinates, with cached lookup.
 *
 * @param destination Customer location coordinates { lat, lng }
 * @param origin Store location coordinates (defaults to DEFAULT_STORE_LOCATION)
 * @param options Configuration options, e.g., bypassCache
 */
export async function calculateDrivingDistance(
  destination: Coordinates,
  origin: Coordinates = DEFAULT_STORE_LOCATION,
  options?: { bypassCache?: boolean }
): Promise<DistanceResult> {
  const cacheKey = getDistanceCacheKey(origin, destination);

  // 1. Return cached result if valid and caching is enabled
  if (!options?.bypassCache && distanceCache.has(cacheKey)) {
    const cached = distanceCache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return {
        ...cached.result,
        isCached: true
      };
    } else {
      distanceCache.delete(cacheKey);
    }
  }

  // 2. Perform distance calculation
  const { distanceKm, durationMinutes } = calculateDrivingDistanceHaversine(origin, destination);

  const result: DistanceResult = {
    distanceKm,
    durationMinutes,
    isCached: false,
    source: 'calculated_haversine_driving'
  };

  // 3. Store result in cache
  distanceCache.set(cacheKey, {
    result,
    timestamp: Date.now()
  });

  return result;
}

/**
 * Clears all cached distance calculations.
 */
export function clearDistanceCache(): void {
  distanceCache.clear();
}

/**
 * Returns diagnostic statistics regarding the distance calculation cache.
 */
export function getDistanceCacheStats(): { cachedEntriesCount: number; cacheTtlHours: number } {
  return {
    cachedEntriesCount: distanceCache.size,
    cacheTtlHours: CACHE_TTL_MS / (1000 * 60 * 60)
  };
}
