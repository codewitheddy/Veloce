import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Navigation,
  Search,
  Crosshair,
  Truck,
  Zap,
  CheckCircle2,
  Clock,
  Layers,
  RotateCcw,
  Sparkles,
  Info,
  Loader2
} from 'lucide-react';
import {
  Coordinates,
  DEFAULT_STORE_LOCATION,
  PRESET_KENYA_HUBS,
  calculateDrivingDistance,
  searchNominatimAddresses,
  reverseGeocodeNominatim,
  DistanceResult,
  GeocodedLocation
} from '../services/maps';
import { ShippingZone, HappyHourWindow } from '../types/shipping';
import { calculate_delivery_fee, DeliveryCalculationResult } from '../services/deliveryEngine';

export interface InteractiveDeliveryMapProps {
  storeLocation?: Coordinates;
  initialCustomerLocation?: Coordinates;
  zones?: ShippingZone[];
  happyHours?: HappyHourWindow[];
  orderSubtotal?: number;
  isExpress?: boolean;
  freeThreshold?: number;
  onLocationSelected?: (location: {
    lat: number;
    lng: number;
    address: string;
    distanceResult: DistanceResult;
    feeResult: DeliveryCalculationResult;
  }) => void;
  className?: string;
  height?: string;
  showZoneCircles?: boolean;
  showSearchBar?: boolean;
  showHud?: boolean;
  compactMode?: boolean;
}

// Zone Color Palette for visual radius circles
const ZONE_COLORS = [
  { stroke: '#10b981', fill: '#10b981', name: 'Inner Ring (0-8 km)' },
  { stroke: '#3b82f6', fill: '#3b82f6', name: 'Suburbs (8-20 km)' },
  { stroke: '#f59e0b', fill: '#f59e0b', name: 'Outskirts (20-50 km)' },
  { stroke: '#8b5cf6', fill: '#8b5cf6', name: 'Regional (> 50 km)' }
];

export function InteractiveDeliveryMap({
  storeLocation = DEFAULT_STORE_LOCATION,
  initialCustomerLocation = { lat: -1.2642, lng: 36.8048 }, // Westlands
  zones = [],
  happyHours = [],
  orderSubtotal = 3500,
  isExpress = false,
  freeThreshold = 5000,
  onLocationSelected,
  className = '',
  height = '460px',
  showZoneCircles = true,
  showSearchBar = true,
  showHud = true,
  compactMode = false
}: InteractiveDeliveryMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const storeMarkerRef = useRef<L.Marker | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const zoneCirclesRef = useRef<L.Circle[]>([]);

  // State
  const [customerCoords, setCustomerCoords] = useState<Coordinates>(initialCustomerLocation);
  const [resolvedAddress, setResolvedAddress] = useState<string>('Westlands / Sarit Centre, Nairobi');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<GeocodedLocation[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isRouting, setIsRouting] = useState<boolean>(false);
  const [distanceData, setDistanceData] = useState<DistanceResult | null>(null);
  const [feeData, setFeeData] = useState<DeliveryCalculationResult | null>(null);
  const [showPresetsDropdown, setShowPresetsDropdown] = useState<boolean>(false);

  // Calculate route and update fee
  const updateRouteAndCalculations = useCallback(
    async (dest: Coordinates, addressLabel?: string) => {
      setIsRouting(true);

      // 1. Calculate driving distance & road route
      const distResult = await calculateDrivingDistance(dest, storeLocation);
      setDistanceData(distResult);

      // 2. Resolve address if not provided
      let finalAddress = addressLabel;
      if (!finalAddress) {
        finalAddress = await reverseGeocodeNominatim(dest);
      }
      setResolvedAddress(finalAddress);

      // 3. Compute dynamic delivery fee
      const feeResult = calculate_delivery_fee({
        orderSubtotal,
        distanceKm: distResult.distanceKm,
        isExpress,
        freeDeliveryThreshold: freeThreshold,
        zones,
        happyHours,
        selectedRegion: finalAddress
      });
      setFeeData(feeResult);
      setIsRouting(false);

      // 4. Update route polyline on Leaflet map
      if (mapInstanceRef.current) {
        if (routePolylineRef.current) {
          routePolylineRef.current.remove();
        }

        const polyCoords = distResult.routeCoordinates || [
          [storeLocation.lat, storeLocation.lng],
          [dest.lat, dest.lng]
        ];

        routePolylineRef.current = L.polyline(polyCoords, {
          color: '#4f46e5',
          weight: 4.5,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: distResult.source === 'calculated_haversine_driving' ? '8, 8' : undefined
        }).addTo(mapInstanceRef.current);
      }

      // Notify parent callback
      if (onLocationSelected) {
        onLocationSelected({
          lat: dest.lat,
          lng: dest.lng,
          address: finalAddress,
          distanceResult: distResult,
          feeResult
        });
      }
    },
    [storeLocation, orderSubtotal, isExpress, freeThreshold, zones, happyHours, onLocationSelected]
  );

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy existing instance to prevent re-initialization error
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // 1. Create Leaflet Map Instance
    const map = L.map(mapContainerRef.current, {
      center: [storeLocation.lat, storeLocation.lng],
      zoom: 12,
      zoomControl: false
    });

    // 2. Add Zoom Control to bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // 3. Add Free OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    mapInstanceRef.current = map;

    // 4. Create Custom HTML Icons
    const storeIcon = L.divIcon({
      className: 'store-origin-marker',
      html: `
        <div style="background-color: #4f46e5; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.4); border: 2.5px solid white; font-weight: bold; position: relative;">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    const customerIcon = L.divIcon({
      className: 'customer-dest-marker',
      html: `
        <div style="background-color: #ef4444; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.5); border: 2.5px solid white; animation: bounce 1.5s infinite;">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    // 5. Add Store Marker
    const storeMarker = L.marker([storeLocation.lat, storeLocation.lng], { icon: storeIcon }).addTo(map);
    storeMarker.bindPopup(`
      <div style="font-family: sans-serif; font-size: 12px; padding: 2px;">
        <strong style="color: #4f46e5; font-size: 13px;">🏪 Veloce Central Store Hub</strong><br/>
        <span style="color: #6b7280;">Nairobi CBD Dispatch Center</span>
      </div>
    `);
    storeMarkerRef.current = storeMarker;

    // 6. Add Draggable Customer Marker
    const customerMarker = L.marker([customerCoords.lat, customerCoords.lng], {
      icon: customerIcon,
      draggable: true
    }).addTo(map);

    customerMarker.on('dragend', () => {
      const pos = customerMarker.getLatLng();
      const newCoords = { lat: pos.lat, lng: pos.lng };
      setCustomerCoords(newCoords);
      updateRouteAndCalculations(newCoords);
    });

    customerMarkerRef.current = customerMarker;

    // 7. Click on map to move destination pin
    map.on('click', (e: L.LeafletMouseEvent) => {
      const newCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
      customerMarker.setLatLng(e.latlng);
      setCustomerCoords(newCoords);
      updateRouteAndCalculations(newCoords);
    });

    // Initial calculation
    updateRouteAndCalculations(customerCoords);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Zone Circles overlay when zones prop changes
  useEffect(() => {
    if (!mapInstanceRef.current || !showZoneCircles) return;

    // Clear old circles
    zoneCirclesRef.current.forEach((c) => c.remove());
    zoneCirclesRef.current = [];

    // Render active zone circles
    const activeZones = zones.filter((z) => z.isActive && z.maxDistanceKm > 0);
    const sortedZones = [...activeZones].sort((a, b) => b.maxDistanceKm - a.maxDistanceKm);

    sortedZones.forEach((zone, idx) => {
      const colorScheme = ZONE_COLORS[idx % ZONE_COLORS.length];
      const circle = L.circle([storeLocation.lat, storeLocation.lng], {
        radius: zone.maxDistanceKm * 1000, // km to meters
        color: colorScheme.stroke,
        fillColor: colorScheme.fill,
        fillOpacity: 0.05 + idx * 0.03,
        weight: 1.5,
        dashArray: '4, 6'
      }).addTo(mapInstanceRef.current!);

      circle.bindTooltip(`<strong>${zone.name}</strong> (${zone.minDistanceKm}-${zone.maxDistanceKm} km) • Base KSh ${zone.baseFee}`, {
        sticky: true,
        className: 'zone-tooltip'
      });

      zoneCirclesRef.current.push(circle);
    });
  }, [zones, showZoneCircles, storeLocation]);

  // Handle location search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    const results = await searchNominatimAddresses(searchQuery);
    setSearchResults(results);
    setIsSearching(false);
  };

  // Select location from search or preset
  const handleSelectLocation = (loc: { lat: number; lng: number; displayName: string }) => {
    setCustomerCoords({ lat: loc.lat, lng: loc.lng });
    setResolvedAddress(loc.displayName);
    setSearchResults([]);
    setSearchQuery('');
    setShowPresetsDropdown(false);

    if (customerMarkerRef.current) {
      customerMarkerRef.current.setLatLng([loc.lat, loc.lng]);
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([loc.lat, loc.lng], 13, { duration: 1.2 });
    }

    updateRouteAndCalculations({ lat: loc.lat, lng: loc.lng }, loc.displayName);
  };

  // Geolocation trigger
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        handleSelectLocation({
          lat: coords.lat,
          lng: coords.lng,
          displayName: 'Your Current GPS Location'
        });
      },
      (err) => {
        alert(`Unable to retrieve GPS location: ${err.message}`);
      }
    );
  };

  return (
    <div className={`relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm ${className}`}>
      {/* Top Search & Preset Controls Header */}
      {showSearchBar && (
        <div className="p-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex flex-col md:flex-row items-center justify-between gap-2.5 z-20 relative">
          <form onSubmit={handleSearch} className="relative flex-1 w-full flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Kenyan address, mall, estate, or town (e.g., Sarit Centre, Karen, Ruiru)..."
                className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-gray-100"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-indigo-600 animate-spin" />
              )}
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <Search className="h-3.5 w-3.5" /> Search
            </button>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              title="Locate Me (GPS)"
              className="px-2.5 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
            >
              <Crosshair className="h-3.5 w-3.5 text-indigo-500" /> GPS
            </button>
          </form>

          {/* Quick Hub Presets Button */}
          <div className="relative shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setShowPresetsDropdown((prev) => !prev)}
              className="w-full md:w-auto px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <MapPin className="h-3.5 w-3.5 text-rose-500" /> Quick Area Presets
            </button>

            {/* Presets Dropdown */}
            {showPresetsDropdown && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-30 p-2 max-h-64 overflow-y-auto">
                <div className="text-[10px] font-bold uppercase text-gray-400 font-mono px-2 py-1">
                  Preset Locations
                </div>
                {PRESET_KENYA_HUBS.map((hub) => (
                  <button
                    key={hub.name}
                    type="button"
                    onClick={() =>
                      handleSelectLocation({
                        lat: hub.coords.lat,
                        lng: hub.coords.lng,
                        displayName: hub.name
                      })
                    }
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-between group transition-colors cursor-pointer"
                  >
                    <span className="font-medium text-gray-800 dark:text-gray-200 group-hover:text-indigo-600">
                      {hub.name}
                    </span>
                    <span className="text-[9px] font-mono text-gray-400">{hub.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Results Dropdown Overlay */}
      {searchResults.length > 0 && (
        <div className="absolute top-14 left-4 right-4 md:right-auto md:w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-30 p-2 max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-400 font-mono px-2 py-1 border-b border-gray-100 dark:border-gray-700">
            <span>Search Results ({searchResults.length})</span>
            <button
              type="button"
              onClick={() => setSearchResults([])}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              Close
            </button>
          </div>
          {searchResults.map((loc, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelectLocation(loc)}
              className="w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-gray-800 dark:text-gray-200 transition-colors border-b border-gray-50 dark:border-gray-800 last:border-0 cursor-pointer"
            >
              <div className="font-semibold text-gray-900 dark:text-white">{loc.shortName}</div>
              <div className="text-[10px] text-gray-400 truncate">{loc.displayName}</div>
            </button>
          ))}
        </div>
      )}

      {/* Leaflet Map Canvas */}
      <div
        ref={mapContainerRef}
        style={{ height }}
        className="w-full z-10 relative bg-gray-100 dark:bg-gray-950"
      />

      {/* Drag Pin Floating Instruction Banner */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-gray-900/80 text-white text-[10px] font-medium px-3 py-1.5 rounded-full backdrop-blur-md shadow-md pointer-events-none flex items-center gap-1.5">
        <MapPin className="h-3 w-3 text-rose-400 animate-bounce" /> Click map or drag red pin to reposition customer destination
      </div>

      {/* Live Distance & Fee Costing HUD (Bottom Overlay) */}
      {showHud && (
        <div className="p-3.5 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 z-20 relative font-sans">
          {/* Destination & Zone */}
          <div className="min-w-0 max-w-sm">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                {resolvedAddress}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-gray-500 dark:text-gray-400">
              {feeData?.matchedZone && (
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  Zone: {feeData.matchedZone.name}
                </span>
              )}
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {feeData?.estimatedTimeframe || '30-45 mins'}
              </span>
            </div>
          </div>

          {/* Metrics & Fee */}
          <div className="flex items-center gap-3 ml-auto">
            {/* Driving Distance Metric */}
            <div className="text-right">
              <div className="text-[10px] uppercase font-mono text-gray-400 font-bold">Driving Distance</div>
              <div className="text-xs font-extrabold text-gray-900 dark:text-white flex items-center justify-end gap-1">
                <Navigation className="h-3 w-3 text-indigo-500" />
                {distanceData ? `${distanceData.distanceKm} km` : 'Calculating...'}
              </div>
            </div>

            {/* Live Calculated Fee Badge */}
            <div className="bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 rounded-xl px-3.5 py-1.5 text-right">
              <div className="text-[9px] uppercase font-mono text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-end gap-1">
                {feeData?.isFreeDelivery ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-bold">
                    <CheckCircle2 className="h-2.5 w-2.5" /> 100% Free
                  </span>
                ) : feeData?.isHappyHourApplied ? (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5 font-bold animate-pulse">
                    <Zap className="h-2.5 w-2.5 fill-amber-400" /> Happy Hour
                  </span>
                ) : (
                  'Delivery Fee'
                )}
              </div>
              <div className="text-sm font-extrabold text-gray-950 dark:text-white">
                {feeData?.isFreeDelivery ? (
                  <span className="text-emerald-600 dark:text-emerald-400">KSh 0.00</span>
                ) : (
                  <>
                    {feeData && feeData.discount > 0 && (
                      <span className="text-[10px] text-gray-400 line-through mr-1 font-normal">
                        KSh {feeData.originalFee}
                      </span>
                    )}
                    <span>KSh {feeData?.fee.toLocaleString('en-KE') || '0'}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default InteractiveDeliveryMap;
