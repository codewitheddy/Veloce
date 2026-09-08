/**
 * Maps & Distance Calculation Service
 * 100% Free Open-Source Geospatial Stack:
 * - OSRM (Open Source Routing Machine) for real driving road network distance & polyline geometry
 * - Nominatim (OpenStreetMap) for free address geocoding, autocomplete, and reverse geocoding
 * - Built-in Haversine + 1.3x road factor zero-latency offline fallback
 * - High performance in-memory caching with TTL
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeocodedLocation {
  displayName: string;
  shortName: string;
  lat: number;
  lng: number;
  city?: string;
  county?: string;
  country?: string;
}

export interface DistanceResult {
  distanceKm: number;
  durationMinutes: number;
  isCached: boolean;
  source: 'osrm_open_source_routing' | 'calculated_haversine_driving' | 'google_maps';
  routeCoordinates?: [number, number][]; // [lat, lng] pairs for Leaflet Polyline
}

// Default Store Location (Ropenix Nairobi CBD Central Hub: -1.286389, 36.817223)
export const DEFAULT_STORE_LOCATION: Coordinates = {
  lat: -1.286389,
  lng: 36.817223
};

// Preset Popular Kenyan Store & Delivery Hubs
export const PRESET_KENYA_HUBS: { name: string; category: string; coords: Coordinates }[] = [
  { name: 'Ropenix Central Hub (Nairobi CBD)', category: 'Store Origin', coords: { lat: -1.286389, lng: 36.817223 } },
  { name: 'Westlands / Sarit Centre', category: 'Inner Ring (0-8 km)', coords: { lat: -1.2642, lng: 36.8048 } },
  { name: 'Kilimani / Yaya Centre', category: 'Inner Ring (0-8 km)', coords: { lat: -1.2917, lng: 36.7877 } },
  { name: 'Parklands / Diamond Plaza', category: 'Inner Ring (0-8 km)', coords: { lat: -1.2615, lng: 36.8202 } },
  { name: 'Upper Hill / Hospital Zone', category: 'Inner Ring (0-8 km)', coords: { lat: -1.2989, lng: 36.8144 } },
  { name: 'Karen Shopping Centre', category: 'Suburbs (8-20 km)', coords: { lat: -1.3197, lng: 36.7062 } },
  { name: 'Gigiri / Village Market', category: 'Suburbs (8-20 km)', coords: { lat: -1.2301, lng: 36.8052 } },
  { name: 'Runda Estate Gate', category: 'Suburbs (8-20 km)', coords: { lat: -1.2185, lng: 36.8234 } },
  { name: 'Langata / Galleria Mall', category: 'Suburbs (8-20 km)', coords: { lat: -1.3482, lng: 36.7725 } },
  { name: 'Embakasi / JKIA Airport Hub', category: 'Suburbs (8-20 km)', coords: { lat: -1.3192, lng: 36.9275 } },
  { name: 'Ruaka Town / Two Rivers Mall', category: 'Suburbs (8-20 km)', coords: { lat: -1.2064, lng: 36.7788 } },
  { name: 'Thika Town Centre', category: 'Outskirts (20-50 km)', coords: { lat: -1.0333, lng: 37.0693 } },
  { name: 'Ruiru / Eastern Bypass', category: 'Outskirts (20-50 km)', coords: { lat: -1.1461, lng: 36.9602 } },
  { name: 'Kitengela Town (Namanga Rd)', category: 'Outskirts (20-50 km)', coords: { lat: -1.4820, lng: 36.9580 } },
  { name: 'Ongata Rongai / Magadi Rd', category: 'Outskirts (20-50 km)', coords: { lat: -1.3965, lng: 36.7607 } },
  { name: 'Kikuyu Town Centre', category: 'Outskirts (20-50 km)', coords: { lat: -1.2464, lng: 36.6633 } },
  { name: 'Naivasha Town (Out of Range)', category: 'Regional Out-of-Range', coords: { lat: -0.7171, lng: 36.4310 } },
  { name: 'Mombasa Island / Nyali', category: 'Coast Region', coords: { lat: -4.0435, lng: 39.6682 } }
];

// In-memory cache for distance & route results to eliminate redundant network roundtrips
const distanceCache = new Map<string, { result: DistanceResult; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 Hours Cache TTL

/**
 * Generates cache key for store origin and customer destination coordinates
 */
export function getDistanceCacheKey(origin: Coordinates, destination: Coordinates): string {
  const oLat = origin.lat.toFixed(4);
  const oLng = origin.lng.toFixed(4);
  const dLat = destination.lat.toFixed(4);
  const dLng = destination.lng.toFixed(4);
  return `${oLat},${oLng}->${dLat},${dLng}`;
}

/**
 * Instant Haversine straight-line distance with a 1.3x road curvature factor
 * (Used as instant zero-latency offline fallback)
 */
export function calculateDrivingDistanceHaversine(
  origin: Coordinates,
  destination: Coordinates
): { distanceKm: number; durationMinutes: number; routeCoordinates: [number, number][] } {
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
  const distanceKm = Math.max(0.1, Math.round(straightLineKm * drivingFactor * 100) / 100);

  // Estimated driving duration (average 32 km/h city speed + 5 min dispatch buffer)
  const durationMinutes = Math.max(10, Math.round((distanceKm / 32) * 60) + 5);

  // Simplified 2-point straight line for Leaflet polyline fallback
  const routeCoordinates: [number, number][] = [
    [origin.lat, origin.lng],
    [destination.lat, destination.lng]
  ];

  return { distanceKm, durationMinutes, routeCoordinates };
}

/**
 * Fetch real driving road route & distance using Open Source Routing Machine (OSRM)
 * 100% Free - No API key required
 */
export async function getOsrmDrivingRoute(
  origin: Coordinates,
  destination: Coordinates
): Promise<DistanceResult> {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM responded with status ${response.status}`);
    }

    const data = await response.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const primaryRoute = data.routes[0];
      const distanceMeters = primaryRoute.distance || 0;
      const durationSeconds = primaryRoute.duration || 0;

      const distanceKm = Math.max(0.1, Math.round((distanceMeters / 1000) * 10) / 10);
      const durationMinutes = Math.max(5, Math.round(durationSeconds / 60) + 5); // +5 min buffer

      // Convert GeoJSON [lng, lat] coordinates to Leaflet [lat, lng] format
      let routeCoordinates: [number, number][] = [];
      if (primaryRoute.geometry && primaryRoute.geometry.coordinates) {
        routeCoordinates = primaryRoute.geometry.coordinates.map((pt: [number, number]) => [pt[1], pt[0]]);
      }

      return {
        distanceKm,
        durationMinutes,
        isCached: false,
        source: 'osrm_open_source_routing',
        routeCoordinates
      };
    }
  } catch (err) {
    console.warn('[MapsService] OSRM fetch failed or timed out, falling back to Haversine model:', err);
  }

  // Graceful fallback to Haversine calculation
  const fallback = calculateDrivingDistanceHaversine(origin, destination);
  return {
    distanceKm: fallback.distanceKm,
    durationMinutes: fallback.durationMinutes,
    isCached: false,
    source: 'calculated_haversine_driving',
    routeCoordinates: fallback.routeCoordinates
  };
}

/**
 * Calculates driving distance with in-memory caching and OSRM routing
 */
export async function calculateDrivingDistance(
  destination: Coordinates,
  origin: Coordinates = DEFAULT_STORE_LOCATION,
  options?: { bypassCache?: boolean }
): Promise<DistanceResult> {
  const cacheKey = getDistanceCacheKey(origin, destination);

  // 1. Return cached result if valid
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

  // 2. Fetch OSRM driving distance & route geometry
  const result = await getOsrmDrivingRoute(origin, destination);

  // 3. Store result in cache
  distanceCache.set(cacheKey, {
    result,
    timestamp: Date.now()
  });

  return result;
}

export async function getDrivingDistance(
  origin: Coordinates,
  destination: Coordinates,
  options?: { bypassCache?: boolean }
): Promise<DistanceResult> {
  return calculateDrivingDistance(destination, origin, options);
}

/**
 * Free Address Autocomplete & Geocoding via Nominatim (OpenStreetMap)
 * 100% Free - No API key required
 */
export async function searchNominatimAddresses(
  query: string,
  countryCodes = 'ke'
): Promise<GeocodedLocation[]> {
  const clean = query.trim();
  if (!clean || clean.length < 2) return [];

  // Check matching presets first for instant response
  const lower = clean.toLowerCase();
  const matchedPresets = PRESET_KENYA_HUBS.filter((p) => p.name.toLowerCase().includes(lower));

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean)}&addressdetails=1&limit=6${countryCodes ? `&countrycodes=${countryCodes}` : ''}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'RopenixCommercePlatform/1.0'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item: any) => {
          const addr = item.address || {};
          const shortName = addr.suburb || addr.neighbourhood || addr.city_district || addr.town || addr.village || addr.city || item.display_name.split(',')[0];
          return {
            displayName: item.display_name,
            shortName,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            city: addr.city || addr.town || addr.county || 'Nairobi',
            county: addr.county || addr.state || 'Kenya',
            country: addr.country || 'Kenya'
          };
        });
      }
    }
  } catch (err) {
    console.warn('[MapsService] Nominatim search timed out or was throttled:', err);
  }

  // Fallback to presets if online geocoding fails
  if (matchedPresets.length > 0) {
    return matchedPresets.map((p) => ({
      displayName: `${p.name}, Nairobi, Kenya`,
      shortName: p.name,
      lat: p.coords.lat,
      lng: p.coords.lng,
      city: 'Nairobi',
      county: 'Nairobi',
      country: 'Kenya'
    }));
  }

  return [];
}

/**
 * Reverse Geocode coordinates to address string via Nominatim
 */
export async function reverseGeocodeNominatim(coords: Coordinates): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&addressdetails=1`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'RopenixCommercePlatform/1.0'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        const addr = data.address || {};
        const parts = [
          addr.suburb || addr.neighbourhood || addr.road,
          addr.city || addr.town || addr.county,
          addr.country
        ].filter(Boolean);

        return parts.length > 0 ? parts.join(', ') : data.display_name;
      }
    }
  } catch (err) {
    console.warn('[MapsService] Reverse geocoding failed:', err);
  }

  // Fallback to nearest preset or coordinates string
  const nearest = PRESET_KENYA_HUBS.find(
    (p) => Math.abs(p.coords.lat - coords.lat) < 0.03 && Math.abs(p.coords.lng - coords.lng) < 0.03
  );

  return nearest ? `${nearest.name}, Nairobi` : `Coordinates (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;
}

/**
 * Clears all cached distance calculations
 */
export function clearDistanceCache(): void {
  distanceCache.clear();
}

/**
 * Returns diagnostic statistics regarding the distance calculation cache
 */
export function getDistanceCacheStats(): { cachedEntriesCount: number; cacheTtlHours: number } {
  return {
    cachedEntriesCount: distanceCache.size,
    cacheTtlHours: CACHE_TTL_MS / (1000 * 60 * 60)
  };
}
