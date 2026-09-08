import React, { useState, useEffect } from 'react';
import {
  Truck,
  MapPin,
  Clock,
  DollarSign,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  Zap,
  Check,
  Sparkles,
  Calculator,
  Layers,
  Save,
  RotateCcw,
  Navigation,
  Globe
} from 'lucide-react';
import { ShippingZone, ShippingRate, HappyHourWindow } from '../types/shipping';
import { calculate_delivery_fee, DeliveryCalculationResult } from '../services/deliveryEngine';
import { getDrivingDistance, getDistanceCacheStats, clearDistanceCache, DEFAULT_STORE_LOCATION } from '../services/maps';
import { RateTestingTool } from './RateTestingTool';
import ShippingZonesPanel from './ShippingZonesPanel';
import ZoneValidationVisualizer from './ZoneValidationVisualizer';
import InteractiveDeliveryMap from './InteractiveDeliveryMap';

// Initial Mock Shipping Zones
const DEFAULT_SHIPPING_ZONES: ShippingZone[] = [
  {
    id: 'zone-1',
    name: 'Nairobi CBD & Inner Ring',
    description: 'Central Business District, Westlands, Kilimani, Parklands, Kileleshwa',
    minDistanceKm: 0,
    maxDistanceKm: 8,
    baseFee: 150,
    perKmRate: 20,
    isActive: true,
    regions: ['CBD', 'Westlands', 'Kilimani', 'Parklands'],
    estimatedDeliveryTime: '20-35 mins'
  },
  {
    id: 'zone-2',
    name: 'Nairobi Metro & Suburbs',
    description: 'Karen, Langata, Runda, Gigiri, Lavington, Kasarani, Embakasi',
    minDistanceKm: 8,
    maxDistanceKm: 20,
    baseFee: 250,
    perKmRate: 30,
    isActive: true,
    regions: ['Karen', 'Langata', 'Runda', 'Gigiri', 'Embakasi'],
    estimatedDeliveryTime: '35-50 mins'
  },
  {
    id: 'zone-3',
    name: 'Greater Nairobi Outskirts',
    description: 'Thika, Ruiru, Kikuyu, Kitengela, Ngong, Machakos Junction',
    minDistanceKm: 20,
    maxDistanceKm: 50,
    baseFee: 400,
    perKmRate: 35,
    isActive: true,
    regions: ['Thika', 'Ruiru', 'Kikuyu', 'Kitengela', 'Ngong'],
    estimatedDeliveryTime: '1-2 hours'
  }
];

// Initial Mock Happy Hour Windows
const DEFAULT_HAPPY_HOUR_WINDOWS: HappyHourWindow[] = [
  {
    id: 'hh-1',
    name: 'Afternoon Rush Happy Hour',
    startTime: '14:00',
    endTime: '16:00',
    daysOfWeek: [1, 2, 3, 4, 5], // Mon - Fri
    discountPercentage: 50,
    isActive: true,
    description: '50% Off Delivery Fee on all weekday afternoon orders placed between 2 PM - 4 PM!'
  },
  {
    id: 'hh-2',
    name: 'Weekend Brunch Special',
    startTime: '10:00',
    endTime: '12:00',
    daysOfWeek: [0, 6], // Sun, Sat
    discountPercentage: 30,
    isActive: false,
    description: '30% Off Delivery Fee for weekend morning coffee & goods orders.'
  }
];

export function ShippingSettingsPanel() {
  // Persistence state
  const [zones, setZones] = useState<ShippingZone[]>(() => {
    try {
      const saved = localStorage.getItem('veloce_shipping_zones');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SHIPPING_ZONES;
  });

  const [happyHours, setHappyHours] = useState<HappyHourWindow[]>(() => {
    try {
      const saved = localStorage.getItem('veloce_happy_hour_windows');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_HAPPY_HOUR_WINDOWS;
  });

  // Global thresholds & rates
  const [freeThreshold, setFreeThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('veloce_free_delivery_threshold');
      if (saved) return Number(saved);
    } catch {}
    return 5000;
  });

  const [expressSurcharge, setExpressSurcharge] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('veloce_express_surcharge');
      if (saved) return Number(saved);
    } catch {}
    return 150;
  });

  const [defaultBaseDistance, setDefaultBaseDistance] = useState<number>(5);
  const [defaultBaseFee, setDefaultBaseFee] = useState<number>(200);
  const [defaultPerKmRate, setDefaultPerKmRate] = useState<number>(30);
  const [maxRadiusKm, setMaxRadiusKm] = useState<number>(50);

  // Active Sub View
  const [activeTab, setActiveTab] = useState<'zones' | 'map_routing' | 'validation' | 'rates' | 'happy_hour' | 'simulator'>('zones');

  // Status & Notification
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

  // Editing state for Happy Hour
  const [editingHappyHour, setEditingHappyHour] = useState<HappyHourWindow | null>(null);
  const [showAddHHModal, setShowAddHHModal] = useState(false);
  const [hhName, setHhName] = useState('');
  const [hhStart, setHhStart] = useState('14:00');
  const [hhEnd, setHhEnd] = useState('16:00');
  const [hhDiscount, setHhDiscount] = useState(50);
  const [hhDesc, setHhDesc] = useState('');
  const [hhDays, setHhDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Save changes to local storage & broadcast event
  const handleSaveChanges = () => {
    localStorage.setItem('veloce_shipping_zones', JSON.stringify(zones));
    localStorage.setItem('veloce_happy_hour_windows', JSON.stringify(happyHours));
    localStorage.setItem('veloce_free_delivery_threshold', freeThreshold.toString());
    localStorage.setItem('veloce_express_surcharge', expressSurcharge.toString());

    // Dispatch custom event for immediate checkout synchronization
    window.dispatchEvent(
      new CustomEvent('veloce_shipping_settings_updated', {
        detail: { zones, happyHours, freeThreshold, expressSurcharge }
      })
    );

    setSaveSuccessMsg('✓ Shipping & delivery settings saved successfully!');
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // Reset to defaults
  const handleResetDefaults = () => {
    if (confirm('Are you sure you want to reset all shipping settings to default system configurations?')) {
      setZones(DEFAULT_SHIPPING_ZONES);
      setHappyHours(DEFAULT_HAPPY_HOUR_WINDOWS);
      setFreeThreshold(5000);
      setExpressSurcharge(150);
      localStorage.removeItem('veloce_shipping_zones');
      localStorage.removeItem('veloce_happy_hour_windows');
      localStorage.removeItem('veloce_free_delivery_threshold');
      localStorage.removeItem('veloce_express_surcharge');
      setSaveSuccessMsg('✓ Shipping settings reset to default.');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    }
  };

  // Toggle Happy Hour
  const handleToggleHappyHour = (id: string) => {
    setHappyHours(prev => prev.map(h => h.id === id ? { ...h, isActive: !h.isActive } : h));
  };

  // Delete Happy Hour
  const handleDeleteHappyHour = (id: string) => {
    if (confirm('Delete this Happy Hour window?')) {
      setHappyHours(prev => prev.filter(h => h.id !== id));
    }
  };

  // Save Happy Hour
  const handleSaveHappyHour = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hhName.trim()) return;

    if (editingHappyHour) {
      setHappyHours(prev => prev.map(h => h.id === editingHappyHour.id ? {
        ...h,
        name: hhName,
        startTime: hhStart,
        endTime: hhEnd,
        discountPercentage: Number(hhDiscount),
        description: hhDesc,
        daysOfWeek: hhDays
      } : h));
    } else {
      const newHH: HappyHourWindow = {
        id: `hh-${Date.now()}`,
        name: hhName,
        startTime: hhStart,
        endTime: hhEnd,
        discountPercentage: Number(hhDiscount),
        isActive: true,
        description: hhDesc,
        daysOfWeek: hhDays
      };
      setHappyHours(prev => [...prev, newHH]);
    }

    setShowAddHHModal(false);
    setEditingHappyHour(null);
    resetHHForm();
  };

  const resetHHForm = () => {
    setHhName('');
    setHhStart('14:00');
    setHhEnd('16:00');
    setHhDiscount(50);
    setHhDesc('');
    setHhDays([1, 2, 3, 4, 5]);
  };

  const handleStartEditHH = (h: HappyHourWindow) => {
    setEditingHappyHour(h);
    setHhName(h.name);
    setHhStart(h.startTime);
    setHhEnd(h.endTime);
    setHhDiscount(h.discountPercentage);
    setHhDesc(h.description || '');
    setHhDays(h.daysOfWeek || [1, 2, 3, 4, 5]);
    setShowAddHHModal(true);
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6 font-sans text-left animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-150 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
              <Truck className="h-5 w-5" />
            </span>
            <h2 className="font-display text-xl font-bold text-gray-950 dark:text-white tracking-tight">
              Shipping & Delivery Settings
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-extralight mt-1">
            Configure delivery zones, distance pricing matrices, free shipping thresholds, Happy Hour windows, and live simulation testing with free OpenStreetMap routing.
          </p>
        </div>

        {/* Global Save Controls */}
        <div className="flex items-center gap-2">
          {saveSuccessMsg && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-pulse">
              <Check className="h-4 w-4 text-emerald-600" /> {saveSuccessMsg}
            </span>
          )}

          <button
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
            title="Reset settings to original system defaults"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset Defaults
          </button>

          <button
            onClick={handleSaveChanges}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
          >
            <Save className="h-3.5 w-3.5" /> Save Configuration
          </button>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
        <button
          onClick={() => setActiveTab('zones')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'zones'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <MapPin className="h-4 w-4" />
          <span>Shipping Zones ({zones.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('map_routing')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'map_routing'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <Globe className="h-4 w-4 text-emerald-400" />
          <span>Live Map & OSRM Routing</span>
          <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[8.5px] font-mono uppercase font-bold">
            Free Map
          </span>
        </button>

        <button
          onClick={() => setActiveTab('validation')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'validation'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          <span>Zone Validation Visualizer</span>
        </button>

        <button
          onClick={() => setActiveTab('rates')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'rates'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          <span>Pricing Matrix & Thresholds</span>
        </button>

        <button
          onClick={() => setActiveTab('happy_hour')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'happy_hour'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Happy Hour Windows ({happyHours.length})</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-amber-950 text-[8.5px] font-mono uppercase font-bold">
            Promo
          </span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'simulator'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <Calculator className="h-4 w-4" />
          <span>Live Rate Simulator</span>
        </button>
      </div>

      {/* TAB 1: SHIPPING ZONES */}
      {activeTab === 'zones' && (
        <ShippingZonesPanel
          initialZones={zones}
          onZonesChange={(newZones) => setZones(newZones)}
          maxRadiusKm={maxRadiusKm}
        />
      )}

      {/* TAB 2: LIVE MAP & OSRM ROUTING SIMULATOR */}
      {activeTab === 'map_routing' && (
        <div className="space-y-4">
          <div className="bg-indigo-50/60 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Free OpenStreetMap (OSM) & OSRM Routing Engine
              </h3>
              <p className="text-xs text-indigo-800/80 dark:text-indigo-300/80 font-light mt-0.5">
                Real-world road distance calculation and live delivery costing without requiring any paid Google Maps API keys.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" /> 100% Free & Open Source
              </span>
            </div>
          </div>

          <InteractiveDeliveryMap
            storeLocation={DEFAULT_STORE_LOCATION}
            zones={zones}
            happyHours={happyHours}
            orderSubtotal={3500}
            freeThreshold={freeThreshold}
            height="520px"
          />
        </div>
      )}

      {/* TAB 3: REAL-TIME VALIDATION VISUALIZER */}
      {activeTab === 'validation' && (
        <ZoneValidationVisualizer
          zones={zones}
          onUpdateZones={(newZones) => setZones(newZones)}
          maxRadiusKm={maxRadiusKm}
        />
      )}

      {/* TAB 4: GLOBAL RATES & FREE THRESHOLDS */}
      {activeTab === 'rates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free Shipping & Express Thresholds */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-2xs space-y-5">
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">
              <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-display text-sm font-bold text-gray-950 dark:text-white uppercase tracking-wider">
                Free Delivery & Express Rules
              </h3>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Free Delivery Order Subtotal Threshold (KSh)
              </label>
              <p className="text-[11px] text-gray-400 mb-2">
                Orders with a cart subtotal equal to or above this amount automatically qualify for 100% free delivery.
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-gray-400">
                  KSh
                </span>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={freeThreshold}
                  onChange={(e) => setFreeThreshold(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-gray-200 dark:border-gray-700 pl-12 pr-3 text-sm font-mono font-bold text-gray-950 dark:text-white bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Express Priority Rush Surcharge (KSh)
              </label>
              <p className="text-[11px] text-gray-400 mb-2">
                Additional fee added when customers choose Express Rush delivery at checkout.
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-gray-400">
                  KSh
                </span>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={expressSurcharge}
                  onChange={(e) => setExpressSurcharge(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-gray-200 dark:border-gray-700 pl-12 pr-3 text-sm font-mono font-bold text-gray-950 dark:text-white bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Distance Calculation Matrix Defaults */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-2xs space-y-5">
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">
              <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-display text-sm font-bold text-gray-950 dark:text-white uppercase tracking-wider">
                Fallback Distance Matrix Defaults
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase font-mono mb-1">
                  Base Distance Radius (KM)
                </label>
                <input
                  type="number"
                  min={1}
                  value={defaultBaseDistance}
                  onChange={(e) => setDefaultBaseDistance(Number(e.target.value))}
                  className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 text-xs font-mono font-bold text-gray-950 dark:text-white bg-white dark:bg-gray-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase font-mono mb-1">
                  Base Delivery Fee (KSh)
                </label>
                <input
                  type="number"
                  min={0}
                  value={defaultBaseFee}
                  onChange={(e) => setDefaultBaseFee(Number(e.target.value))}
                  className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 text-xs font-mono font-bold text-gray-950 dark:text-white bg-white dark:bg-gray-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase font-mono mb-1">
                  Per-KM Surcharge Rate (KSh/KM)
                </label>
                <input
                  type="number"
                  min={0}
                  value={defaultPerKmRate}
                  onChange={(e) => setDefaultPerKmRate(Number(e.target.value))}
                  className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 text-xs font-mono font-bold text-gray-950 dark:text-white bg-white dark:bg-gray-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase font-mono mb-1">
                  Max Delivery Radius Limit (KM)
                </label>
                <input
                  type="number"
                  min={5}
                  value={maxRadiusKm}
                  onChange={(e) => setMaxRadiusKm(Number(e.target.value))}
                  className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 text-xs font-mono font-bold text-gray-950 dark:text-white bg-white dark:bg-gray-900"
                />
              </div>
            </div>

            <div className="bg-indigo-50/50 dark:bg-indigo-950/30 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900 text-[11px] text-indigo-900 dark:text-indigo-200 leading-relaxed">
              💡 <strong>Matrix Calculation Formula:</strong> Gross Delivery Fee = <code>Base Fee + (Max(0, Distance - Base Distance) * Per-KM Rate) + Express Surcharge</code>.
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: HAPPY HOUR WINDOWS */}
      {activeTab === 'happy_hour' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-extralight">
              Set automated Happy Hour discount schedules for delivery fees during quiet hours.
            </p>
            <button
              onClick={() => {
                setEditingHappyHour(null);
                resetHHForm();
                setShowAddHHModal(true);
              }}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold hover:bg-indigo-100 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Add Happy Hour Window
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {happyHours.map((hh) => (
              <div
                key={hh.id}
                className={`bg-white dark:bg-gray-800 rounded-2xl border p-5 shadow-2xs transition-all relative flex flex-col justify-between ${
                  hh.isActive ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/10' : 'border-gray-200 dark:border-gray-800 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {hh.startTime} - {hh.endTime}
                      </span>
                      <h4 className="font-display text-sm font-bold text-gray-950 dark:text-white mt-0.5">
                        {hh.name}
                      </h4>
                    </div>

                    <button
                      onClick={() => handleToggleHappyHour(hh.id)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                        hh.isActive
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300'
                          : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {hh.isActive ? 'Active Schedule' : 'Disabled'}
                    </button>
                  </div>

                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-light mt-2">
                    {hh.description || 'No promotional description provided.'}
                  </p>

                  <div className="mt-4 flex items-center justify-between bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-150 dark:border-gray-800 text-xs">
                    <div>
                      <span className="block text-[9px] font-mono font-bold text-gray-400 uppercase">Discount Rate</span>
                      <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                        {hh.discountPercentage}% OFF Delivery
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="block text-[9px] font-mono font-bold text-gray-400 uppercase">Active Days</span>
                      <div className="flex gap-1 mt-0.5">
                        {dayNames.map((day, idx) => (
                          <span
                            key={idx}
                            className={`text-[9px] font-mono px-1 rounded ${
                              hh.daysOfWeek.includes(idx)
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                            }`}
                          >
                            {day}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleStartEditHH(hh)}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-indigo-500" /> Edit
                  </button>
                  <button
                    onClick={() => handleDeleteHappyHour(hh.id)}
                    className="p-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: FEE SIMULATOR & TESTING TOOL */}
      {activeTab === 'simulator' && (
        <RateTestingTool zones={zones} happyHours={happyHours} />
      )}

      {/* MODAL: ADD / EDIT HAPPY HOUR */}
      {showAddHHModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700 space-y-4 animate-in fade-in zoom-in duration-200">
            <h3 className="font-display text-base font-bold text-gray-950 dark:text-white">
              {editingHappyHour ? 'Edit Happy Hour Schedule' : 'Create Happy Hour Window'}
            </h3>

            <form onSubmit={handleSaveHappyHour} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Window Name</label>
                <input
                  type="text"
                  required
                  value={hhName}
                  onChange={(e) => setHhName(e.target.value)}
                  placeholder="e.g. Afternoon Rush 50% Off"
                  className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 font-bold bg-white dark:bg-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Start Time (24h)</label>
                  <input
                    type="time"
                    required
                    value={hhStart}
                    onChange={(e) => setHhStart(e.target.value)}
                    className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 font-mono font-bold bg-white dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">End Time (24h)</label>
                  <input
                    type="time"
                    required
                    value={hhEnd}
                    onChange={(e) => setHhEnd(e.target.value)}
                    className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 font-mono font-bold bg-white dark:bg-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Discount Rate (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={hhDiscount}
                    onChange={(e) => setHhDiscount(Number(e.target.value))}
                    className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 font-mono font-bold bg-white dark:bg-gray-900"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-gray-400 font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Active Days of Week</label>
                <div className="flex gap-1.5 mt-1">
                  {dayNames.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setHhDays((prev) =>
                          prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
                        );
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        hhDays.includes(i)
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-gray-100 dark:bg-gray-900 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Promotional Description</label>
                <textarea
                  rows={2}
                  value={hhDesc}
                  onChange={(e) => setHhDesc(e.target.value)}
                  placeholder="e.g. Save 50% on all deliveries between 2 PM and 4 PM!"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 p-2 text-xs bg-white dark:bg-gray-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddHHModal(false)}
                  className="h-9 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default ShippingSettingsPanel;
