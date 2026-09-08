import React, { useState, useEffect } from 'react';
import {
  Calculator,
  MapPin,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Info,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  Search,
  Navigation,
  Globe
} from 'lucide-react';
import { calculate_delivery_fee, DeliveryCalculationResult, isCurrentHappyHour } from '../services/deliveryEngine';
import { getDrivingDistance, DEFAULT_STORE_LOCATION, DistanceResult, PRESET_KENYA_HUBS } from '../services/maps';
import { ShippingZone, HappyHourWindow } from '../types/shipping';
import InteractiveDeliveryMap from './InteractiveDeliveryMap';

export interface RateTestingToolProps {
  zones?: ShippingZone[];
  happyHours?: HappyHourWindow[];
  className?: string;
  onFeeCalculated?: (result: DeliveryCalculationResult) => void;
}

// Common Nairobi Area Preset Addresses for quick testing
const ADDRESS_PRESETS = [
  { name: 'Nairobi CBD (Kenyatta Ave)', lat: -1.286389, lng: 36.817223, distanceKm: 2.5 },
  { name: 'Westlands (Sarit Centre)', lat: -1.2642, lng: 36.8048, distanceKm: 4.8 },
  { name: 'Kilimani (Yaya Centre)', lat: -1.2917, lng: 36.7877, distanceKm: 5.2 },
  { name: 'Karen (Shopping Centre)', lat: -1.3197, lng: 36.7062, distanceKm: 16.5 },
  { name: 'Ruiru / Thika Road', lat: -1.1461, lng: 36.9602, distanceKm: 26.0 },
  { name: 'Kitengela (Namanga Rd)', lat: -1.4820, lng: 36.9580, distanceKm: 34.5 },
  { name: 'Naivasha Town (Out of Range)', lat: -0.7171, lng: 36.4310, distanceKm: 88.0 }
];

export function RateTestingTool({
  zones = [],
  happyHours = [],
  className = '',
  onFeeCalculated
}: RateTestingToolProps) {
  // Input States
  const [deliveryAddress, setDeliveryAddress] = useState('Westlands (Sarit Centre), Nairobi');
  const [customerLat, setCustomerLat] = useState<number>(-1.2642);
  const [customerLng, setCustomerLng] = useState<number>(36.8048);
  const [cartSubtotal, setCartSubtotal] = useState<number>(3500);

  // Datetime simulation state (defaulting to current date/time in local format)
  const [simDatetime, setSimDatetime] = useState<string>(() => {
    const now = new Date();
    const isoStr = now.toISOString();
    return isoStr.substring(0, 16); // YYYY-MM-DDTHH:mm
  });

  const [distanceKm, setDistanceKm] = useState<number>(4.8);
  const [isExpress, setIsExpress] = useState<boolean>(false);
  const [forceHappyHour, setForceHappyHour] = useState<'auto' | 'force_on' | 'force_off'>('auto');
  const [showInteractiveMap, setShowInteractiveMap] = useState<boolean>(true);

  // Rate System Configurations (loaded from localStorage if present)
  const [freeThreshold, setFreeThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('veloce_free_delivery_threshold');
    return saved ? Number(saved) : 5000;
  });
  const [baseDistanceKm, setBaseDistanceKm] = useState<number>(5);
  const [baseFee, setBaseFee] = useState<number>(200);
  const [perKmRate, setPerKmRate] = useState<number>(30);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(50);

  // Status & Calculations
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [geoNotice, setGeoNotice] = useState<string>('');
  const [result, setResult] = useState<DeliveryCalculationResult | null>(null);

  // Evaluate Happy Hour status based on simulated datetime or force selection
  const evaluatedHappyHour = React.useMemo(() => {
    if (forceHappyHour === 'force_on') return true;
    if (forceHappyHour === 'force_off') return false;
    // Auto evaluation based on simulated datetime
    if (!simDatetime) return isCurrentHappyHour();
    const dateObj = new Date(simDatetime);
    const hours = dateObj.getHours();
    return hours >= 14 && hours < 16; // 14:00 - 16:00
  }, [simDatetime, forceHappyHour]);

  // Recalculate fee whenever parameters update
  useEffect(() => {
    const calcResult = calculate_delivery_fee({
      orderSubtotal: cartSubtotal,
      distanceKm: distanceKm,
      isHappyHour: evaluatedHappyHour,
      orderTime: simDatetime ? new Date(simDatetime) : undefined,
      isExpress: isExpress,
      freeDeliveryThreshold: freeThreshold,
      baseDistanceKm: baseDistanceKm,
      baseFee: baseFee,
      perKmRate: perKmRate,
      maxDistanceKm: maxDistanceKm,
      zones,
      happyHours,
      selectedRegion: deliveryAddress
    });

    setResult(calcResult);
    if (onFeeCalculated) {
      onFeeCalculated(calcResult);
    }
  }, [
    cartSubtotal,
    distanceKm,
    evaluatedHappyHour,
    simDatetime,
    isExpress,
    freeThreshold,
    baseDistanceKm,
    baseFee,
    perKmRate,
    maxDistanceKm,
    zones,
    happyHours,
    deliveryAddress,
    onFeeCalculated
  ]);

  // Address preset selection
  const handleSelectPreset = (preset: typeof ADDRESS_PRESETS[0]) => {
    setDeliveryAddress(preset.name);
    setCustomerLat(preset.lat);
    setCustomerLng(preset.lng);
    setDistanceKm(preset.distanceKm);
    setGeoNotice(`Selected preset: ${preset.name} (${preset.distanceKm} km from Hub)`);
  };

  // Calculate distance from map service
  const handleCalculateMapDistance = async () => {
    setIsGeocoding(true);
    setGeoNotice('Querying OSRM road routing engine...');
    try {
      const res: DistanceResult = await getDrivingDistance(DEFAULT_STORE_LOCATION, {
        lat: customerLat,
        lng: customerLng
      });
      setDistanceKm(res.distanceKm);
      setGeoNotice(`Driving route verified: ${res.distanceKm} km (~${res.durationMinutes} mins) via ${res.source}`);
    } catch {
      setGeoNotice('Error calculating driving route distance. Using manual slider input.');
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-150 dark:border-gray-700 pb-4 mb-6 gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-gray-950 dark:text-white">
              Rate Testing & Fee Simulation Engine
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-extralight">
              Test multi-layered delivery matrix rules with address presets, custom cart subtotals, OpenStreetMap routing, and time travel simulations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInteractiveMap((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
              showInteractiveMap
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            {showInteractiveMap ? 'Hide Interactive Map' : 'Show Interactive Map'}
          </button>
        </div>
      </div>

      {/* Optional Embedded Interactive Map */}
      {showInteractiveMap && (
        <div className="mb-6">
          <InteractiveDeliveryMap
            storeLocation={DEFAULT_STORE_LOCATION}
            initialCustomerLocation={{ lat: customerLat, lng: customerLng }}
            zones={zones}
            happyHours={happyHours}
            orderSubtotal={cartSubtotal}
            isExpress={isExpress}
            freeThreshold={freeThreshold}
            height="360px"
            onLocationSelected={(loc) => {
              setCustomerLat(loc.lat);
              setCustomerLng(loc.lng);
              setDeliveryAddress(loc.address);
              setDistanceKm(loc.distanceResult.distanceKm);
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: INPUT CONTROLS & ADDRESS PARAMETERS (7 COLS) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Quick Address Presets */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
              <span>Quick Test Address Presets</span>
              <span className="text-[10px] font-mono text-gray-400 font-normal">Click to apply</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ADDRESS_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1 ${
                    distanceKm === preset.distanceKm
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
                      : 'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span>{preset.name}</span>
                  <span className={`text-[10px] font-mono ${distanceKm === preset.distanceKm ? 'text-indigo-100' : 'text-gray-400'}`}>
                    ({preset.distanceKm} km)
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Delivery Address & Coordinates */}
          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-150 dark:border-gray-800 space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Delivery Address Description
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="e.g. Apartment 4B, Kilimani Road, Nairobi"
                  className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 pl-8 pr-3 text-xs font-medium text-gray-950 dark:text-white bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase font-mono mb-1">
                  Latitude
                </label>
                <input
                  type="number"
                  step={0.0001}
                  value={customerLat}
                  onChange={(e) => setCustomerLat(Number(e.target.value))}
                  className="h-8 w-full rounded-lg border border-gray-200 dark:border-gray-700 px-2 font-mono font-bold bg-white dark:bg-gray-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase font-mono mb-1">
                  Longitude
                </label>
                <input
                  type="number"
                  step={0.0001}
                  value={customerLng}
                  onChange={(e) => setCustomerLng(Number(e.target.value))}
                  className="h-8 w-full rounded-lg border border-gray-200 dark:border-gray-700 px-2 font-mono font-bold bg-white dark:bg-gray-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleCalculateMapDistance}
                disabled={isGeocoding}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold hover:bg-indigo-100 cursor-pointer disabled:opacity-50"
              >
                <Navigation className={`h-3.5 w-3.5 ${isGeocoding ? 'animate-spin' : ''}`} />
                {isGeocoding ? 'Calculating Route...' : 'Recalculate Maps Distance'}
              </button>

              {geoNotice && (
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                  {geoNotice}
                </span>
              )}
            </div>
          </div>

          {/* Distance Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-indigo-500" />
                Driving Distance Radius Override
              </label>
              <span className={`font-mono font-bold ${distanceKm > maxDistanceKm ? 'text-red-600' : 'text-indigo-600'}`}>
                {distanceKm.toFixed(1)} KM
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={80}
              step={0.5}
              value={distanceKm}
              onChange={(e) => setDistanceKm(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-gray-400">
              <span>0 KM (Hub)</span>
              <span>5 KM (Base Zone)</span>
              <span>{maxDistanceKm} KM (Max Limit)</span>
              <span>80 KM</span>
            </div>
          </div>

          {/* Subtotal & Simulation Datetime */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Cart Subtotal (KSh)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-gray-400">
                  KSh
                </span>
                <input
                  type="number"
                  min={0}
                  step={250}
                  value={cartSubtotal}
                  onChange={(e) => setCartSubtotal(Number(e.target.value))}
                  className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 pl-12 pr-3 text-xs font-mono font-bold text-gray-950 dark:text-white bg-white dark:bg-gray-900"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Free threshold trigger set to KSh {freeThreshold.toLocaleString('en-KE')}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                Simulation Datetime
              </label>
              <input
                type="datetime-local"
                value={simDatetime}
                onChange={(e) => setSimDatetime(e.target.value)}
                className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 text-xs font-mono text-gray-950 dark:text-white bg-white dark:bg-gray-900"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Simulate peak/off-peak or happy hour windows
              </p>
            </div>
          </div>

          {/* Service Toggles & Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${
              isExpress ? 'bg-amber-50/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
            }`}>
              <input
                type="checkbox"
                checked={isExpress}
                onChange={(e) => setIsExpress(e.target.checked)}
                className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5 text-amber-500" /> Express Rush Priority
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 block">
                  +KSh 150 Surcharge & Faster SLA
                </span>
              </div>
            </label>

            <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 space-y-1">
              <label className="text-xs font-bold text-gray-900 dark:text-white block">
                Happy Hour Promo Override
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setForceHappyHour('auto')}
                  className={`flex-1 py-1 text-[10px] font-bold rounded cursor-pointer ${
                    forceHappyHour === 'auto' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => setForceHappyHour('force_on')}
                  className={`flex-1 py-1 text-[10px] font-bold rounded cursor-pointer ${
                    forceHappyHour === 'force_on' ? 'bg-amber-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  Force ON
                </button>
                <button
                  type="button"
                  onClick={() => setForceHappyHour('force_off')}
                  className={`flex-1 py-1 text-[10px] font-bold rounded cursor-pointer ${
                    forceHappyHour === 'force_off' ? 'bg-gray-700 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  Force OFF
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CALCULATION RESULTS & EXPLANATION (5 COLS) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md space-y-4">

            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Calculation Summary
              </span>

              {result && (
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                  result.reasonCode === 'out_of_range'
                    ? 'bg-rose-600 text-white'
                    : result.reasonCode === 'free_threshold'
                    ? 'bg-emerald-600 text-white'
                    : result.reasonCode === 'happy_hour'
                    ? 'bg-amber-600 text-white'
                    : 'bg-indigo-600 text-white'
                }`}>
                  {result.reasonCode === 'out_of_range'
                    ? 'Out of Range'
                    : result.reasonCode === 'free_threshold'
                    ? 'Free Threshold'
                    : result.reasonCode === 'happy_hour'
                    ? 'Happy Hour'
                    : result.matchedZone ? result.matchedZone.name : 'Standard Rate'}
                </span>
              )}
            </div>

            {/* Range Error Warning Banner */}
            {result?.reasonCode === 'out_of_range' && (
              <div className="bg-rose-950/80 border border-rose-800/80 p-3.5 rounded-xl text-rose-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Out of Deliverable Radius</span>
                </div>
                <p className="text-[11px] text-rose-200/90 font-light">
                  {result.reason}
                </p>
              </div>
            )}

            {/* Fee Figures */}
            {result && result.reasonCode !== 'out_of_range' && (
              <div className="flex items-end justify-between pt-1">
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">
                    Final Delivery Fee
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="font-mono text-3xl font-black text-white">
                      KSh {result.fee.toLocaleString('en-KE')}
                    </span>
                    {result.discount > 0 && (
                      <span className="font-mono text-xs text-slate-400 line-through">
                        KSh {result.originalFee.toLocaleString('en-KE')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">
                    Estimated Timeframe
                  </span>
                  <span className="font-bold text-xs text-emerald-400 flex items-center justify-end gap-1 mt-0.5">
                    <Clock className="h-3 w-3" /> {result.estimatedTimeframe}
                  </span>
                </div>
              </div>
            )}

            {/* Breakdown Table */}
            {result && (
              <div className="bg-slate-950/70 rounded-xl p-3.5 space-y-2 border border-slate-800/80 text-xs font-mono">
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Base Fare ({result.matchedZone ? result.matchedZone.name : `Up to ${baseDistanceKm} km`}):</span>
                  <span className="text-slate-200">KSh {result.breakdown.baseFee}</span>
                </div>

                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Distance Charge:</span>
                  <span className="text-slate-200">+KSh {result.breakdown.distanceFee}</span>
                </div>

                {isExpress && (
                  <div className="flex justify-between text-amber-400 text-[11px]">
                    <span>Express Priority Surcharge:</span>
                    <span>+KSh {result.breakdown.expressSurcharge}</span>
                  </div>
                )}

                {result.discount > 0 && (
                  <div className="flex justify-between text-emerald-400 text-[11px] font-bold border-t border-slate-800 pt-1.5">
                    <span>
                      {result.isFreeDelivery ? 'Free Delivery Discount:' : 'Happy Hour Discount:'}
                    </span>
                    <span>-KSh {result.discount.toLocaleString('en-KE')}</span>
                  </div>
                )}

                <div className="flex justify-between text-white font-bold border-t border-slate-700/80 pt-2 text-sm">
                  <span>Payable Shipping Total:</span>
                  <span className="text-indigo-400">KSh {result.fee.toLocaleString('en-KE')}</span>
                </div>
              </div>
            )}

            {/* Reason Explanation */}
            {result && (
              <div className="text-[11px] text-slate-400 bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/50 flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <span>{result.reason}</span>
              </div>
            )}

            {/* Free Shipping Progress Indicator */}
            {result && result.amountRemainingForFreeShipping > 0 && (
              <div className="bg-indigo-950/60 border border-indigo-800/60 p-3 rounded-xl space-y-1.5">
                <div className="flex justify-between text-[10px] font-mono text-indigo-300">
                  <span>Free Shipping Progress</span>
                  <span>Add KSh {result.amountRemainingForFreeShipping.toLocaleString('en-KE')} more</span>
                </div>
                <div className="h-1.5 w-full bg-indigo-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.round((cartSubtotal / freeThreshold) * 100))}%`
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default RateTestingTool;
