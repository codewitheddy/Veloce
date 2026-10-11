import React, { useState, useCallback } from 'react';
import {
  Truck,
  MapPin,
  Clock,
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  AlertCircle,
  Check,
  Zap,
  Navigation,
  TrendingUp
} from 'lucide-react';

interface DeliveryZone {
  id: string;
  name: string;
  minDistanceKm: number;
  maxDistanceKm: number;
  baseFee: number;
  perKmRate: number;
  isActive: boolean;
}

interface HappyHourWindow {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  discountPercentage: number;
  isActive: boolean;
}

interface DeliverySettings {
  zones: DeliveryZone[];
  happyHours: HappyHourWindow[];
  freeShippingThreshold: number;
  expressSurcharge: number;
  maxDeliveryRadius: number;
}

const DEFAULT_ZONES: DeliveryZone[] = [
  {
    id: '1',
    name: 'Inner City',
    minDistanceKm: 0,
    maxDistanceKm: 5,
    baseFee: 0,
    perKmRate: 25,
    isActive: true
  },
  {
    id: '2',
    name: 'Suburbs',
    minDistanceKm: 5,
    maxDistanceKm: 15,
    baseFee: 150,
    perKmRate: 20,
    isActive: true
  },
  {
    id: '3',
    name: 'Outskirts',
    minDistanceKm: 15,
    maxDistanceKm: 50,
    baseFee: 300,
    perKmRate: 15,
    isActive: true
  }
];

const DEFAULT_HAPPY_HOURS: HappyHourWindow[] = [
  {
    id: '1',
    name: 'Afternoon Rush',
    startTime: '14:00',
    endTime: '16:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    discountPercentage: 50,
    isActive: true
  },
  {
    id: '2',
    name: 'Weekend Brunch',
    startTime: '10:00',
    endTime: '12:00',
    daysOfWeek: [0, 6],
    discountPercentage: 30,
    isActive: true
  }
];

export function SimplifiedShippingSettings() {
  const [settings, setSettings] = useState<DeliverySettings>(() => {
    try {
      const saved = localStorage.getItem('veloce_delivery_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      zones: DEFAULT_ZONES,
      happyHours: DEFAULT_HAPPY_HOURS,
      freeShippingThreshold: 5000,
      expressSurcharge: 150,
      maxDeliveryRadius: 50
    };
  });

  const [activeTab, setActiveTab] = useState<'zones' | 'happy_hours' | 'global' | 'simulator'>('zones');
  const [message, setMessage] = useState('');
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [editingHH, setEditingHH] = useState<HappyHourWindow | null>(null);
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [showHHForm, setShowHHForm] = useState(false);
  const [testLocation, setTestLocation] = useState({ lat: -1.2921, lng: 36.8219, distance: 5 });

  // Save settings to localStorage
  const save = useCallback(() => {
    localStorage.setItem('veloce_delivery_settings', JSON.stringify(settings));
    setMessage('✓ Settings saved successfully!');
    setTimeout(() => setMessage(''), 3000);
  }, [settings]);

  // Zone management
  const addZone = (zone: DeliveryZone) => {
    setSettings(s => ({
      ...s,
      zones: [...s.zones, { ...zone, id: Date.now().toString() }]
    }));
    setShowZoneForm(false);
    save();
  };

  const updateZone = (zone: DeliveryZone) => {
    setSettings(s => ({
      ...s,
      zones: s.zones.map(z => z.id === zone.id ? zone : z)
    }));
    setEditingZone(null);
    save();
  };

  const deleteZone = (id: string) => {
    setSettings(s => ({
      ...s,
      zones: s.zones.filter(z => z.id !== id)
    }));
    save();
  };

  // Happy Hour management
  const addHappyHour = (hh: HappyHourWindow) => {
    setSettings(s => ({
      ...s,
      happyHours: [...s.happyHours, { ...hh, id: Date.now().toString() }]
    }));
    setShowHHForm(false);
    save();
  };

  const updateHappyHour = (hh: HappyHourWindow) => {
    setSettings(s => ({
      ...s,
      happyHours: s.happyHours.map(h => h.id === hh.id ? hh : h)
    }));
    setEditingHH(null);
    save();
  };

  const deleteHappyHour = (id: string) => {
    setSettings(s => ({
      ...s,
      happyHours: s.happyHours.filter(h => h.id !== id)
    }));
    save();
  };

  // Simulator: Calculate delivery fee
  const calculateDeliveryFee = () => {
    const zone = settings.zones.find(
      z => testLocation.distance >= z.minDistanceKm && testLocation.distance <= z.maxDistanceKm
    );
    
    if (!zone) return null;

    let fee = zone.baseFee + (testLocation.distance * zone.perKmRate);
    
    // Apply free shipping threshold
    if (fee === 0 && testLocation.distance > 0) {
      fee = Math.max(0, zone.baseFee);
    }

    // Check if Happy Hour applies (mock current time)
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();
    const isHappyHour = settings.happyHours.some(
      hh => hh.isActive && 
      hh.daysOfWeek.includes(currentDay) &&
      Number(hh.startTime.split(':')[0]) <= currentHour && 
      Number(hh.endTime.split(':')[0]) > currentHour
    );

    if (isHappyHour) {
      const discount = settings.happyHours.find(
        hh => hh.isActive && hh.daysOfWeek.includes(currentDay)
      )?.discountPercentage || 0;
      fee = fee * (1 - discount / 100);
    }

    return { fee, zone, isHappyHour };
  };

  const simulationResult = calculateDeliveryFee();

  return (
    <div className="w-full max-w-6xl mx-auto p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-2xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Truck className="h-8 w-8 text-indigo-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Shipping & Delivery Settings</h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Configure delivery zones, pricing, free shipping thresholds, and promotional windows
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-200 text-sm flex items-center gap-2">
          <Check className="h-4 w-4" />
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-white dark:bg-slate-800 p-2 rounded-xl border border-gray-200 dark:border-gray-700">
        {(['zones', 'happy_hours', 'global', 'simulator'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === tab
                ? 'bg-indigo-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            {tab === 'zones' && <MapPin className="inline h-4 w-4 mr-2" />}
            {tab === 'happy_hours' && <Zap className="inline h-4 w-4 mr-2" />}
            {tab === 'global' && <DollarSign className="inline h-4 w-4 mr-2" />}
            {tab === 'simulator' && <Navigation className="inline h-4 w-4 mr-2" />}
            {tab.replace(/_/g, ' ').toUpperCase()}
          </button>
        ))}
      </div>

      {/* ZONES TAB */}
      {activeTab === 'zones' && (
        <div className="space-y-4">
          <button
            onClick={() => setShowZoneForm(true)}
            className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition"
          >
            <Plus className="h-4 w-4" />
            Add Delivery Zone
          </button>

          {/* Zone List */}
          <div className="space-y-3">
            {settings.zones.map(zone => (
              <div
                key={zone.id}
                className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-start justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-gray-900 dark:text-white">{zone.name}</h3>
                    {zone.isActive ? (
                      <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-semibold rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <div>
                      <MapPin className="inline h-3 w-3 mr-1" />
                      {zone.minDistanceKm}km - {zone.maxDistanceKm}km
                    </div>
                    <div>
                      <DollarSign className="inline h-3 w-3 mr-1" />
                      Base: {zone.baseFee} | /km: {zone.perKmRate}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingZone(zone)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
                  >
                    <Edit2 className="h-4 w-4 text-blue-600" />
                  </button>
                  <button
                    onClick={() => deleteZone(zone.id)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Zone Form Modal */}
          {(showZoneForm || editingZone) && (
            <ZoneFormModal
              zone={editingZone}
              onSave={editingZone ? updateZone : addZone}
              onClose={() => {
                setShowZoneForm(false);
                setEditingZone(null);
              }}
            />
          )}
        </div>
      )}

      {/* HAPPY HOURS TAB */}
      {activeTab === 'happy_hours' && (
        <div className="space-y-4">
          <button
            onClick={() => setShowHHForm(true)}
            className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition"
          >
            <Plus className="h-4 w-4" />
            Add Happy Hour Window
          </button>

          {/* Happy Hour List */}
          <div className="space-y-3">
            {settings.happyHours.map(hh => (
              <div
                key={hh.id}
                className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-start justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <h3 className="font-bold text-gray-900 dark:text-white">{hh.name}</h3>
                    {hh.isActive && (
                      <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300 text-xs font-semibold rounded-full">
                        {hh.discountPercentage}% OFF
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <div>
                      <Clock className="inline h-3 w-3 mr-1" />
                      {hh.startTime} - {hh.endTime}
                    </div>
                    <div>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                        .map((day, i) => hh.daysOfWeek.includes(i) ? day : '')
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingHH(hh)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
                  >
                    <Edit2 className="h-4 w-4 text-blue-600" />
                  </button>
                  <button
                    onClick={() => deleteHappyHour(hh.id)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Happy Hour Form Modal */}
          {(showHHForm || editingHH) && (
            <HappyHourFormModal
              hh={editingHH}
              onSave={editingHH ? updateHappyHour : addHappyHour}
              onClose={() => {
                setShowHHForm(false);
                setEditingHH(null);
              }}
            />
          )}
        </div>
      )}

      {/* GLOBAL SETTINGS TAB */}
      {activeTab === 'global' && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Free Shipping Threshold
            </label>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-gray-400" />
              <input
                type="number"
                value={settings.freeShippingThreshold}
                onChange={(e) => setSettings(s => ({ ...s, freeShippingThreshold: Number(e.target.value) }))}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">(KSh)</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Orders above this amount get free delivery</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Express Surcharge
            </label>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-gray-400" />
              <input
                type="number"
                value={settings.expressSurcharge}
                onChange={(e) => setSettings(s => ({ ...s, expressSurcharge: Number(e.target.value) }))}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">(KSh)</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Extra charge for same-day delivery requests</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Max Delivery Radius
            </label>
            <div className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-gray-400" />
              <input
                type="number"
                value={settings.maxDeliveryRadius}
                onChange={(e) => setSettings(s => ({ ...s, maxDeliveryRadius: Number(e.target.value) }))}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">(km)</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Maximum distance for deliveries</p>
          </div>

          <button
            onClick={save}
            className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition"
          >
            <Save className="h-4 w-4" />
            Save Global Settings
          </button>
        </div>
      )}

      {/* SIMULATOR TAB */}
      {activeTab === 'simulator' && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Test Distance (km)
            </label>
            <input
              type="number"
              step="0.1"
              value={testLocation.distance}
              onChange={(e) => setTestLocation(l => ({ ...l, distance: Number(e.target.value) }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white"
            />
          </div>

          {simulationResult && (
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 rounded-lg p-6 border border-indigo-200 dark:border-indigo-800">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Delivery Fee Calculation</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Zone:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{simulationResult.zone.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Base Fee:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">KSh {simulationResult.zone.baseFee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Distance Charge:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    KSh {(testLocation.distance * simulationResult.zone.perKmRate).toLocaleString()}
                  </span>
                </div>
                {simulationResult.isHappyHour && (
                  <div className="flex justify-between text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 -mx-4 px-4 py-2 rounded">
                    <span>Happy Hour Discount (50%):</span>
                    <span className="font-bold">-KSh {(simulationResult.fee / 2).toLocaleString()}</span>
                  </div>
                )}
                <div className="border-t border-indigo-200 dark:border-indigo-800 pt-3 flex justify-between font-bold text-lg">
                  <span>Total Fee:</span>
                  <span className="text-indigo-600 dark:text-indigo-400">
                    KSh {simulationResult.fee.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-900 dark:text-blue-200">
              This simulator calculates fees based on your current configuration. Test different distances to verify pricing works as expected.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Zone Form Modal Component
function ZoneFormModal({ zone, onSave, onClose }: any) {
  const [form, setForm] = useState(zone || {
    name: '',
    minDistanceKm: 0,
    maxDistanceKm: 5,
    baseFee: 0,
    perKmRate: 25,
    isActive: true
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {zone ? 'Edit Zone' : 'Add Zone'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Zone name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Min distance"
              value={form.minDistanceKm}
              onChange={(e) => setForm({ ...form, minDistanceKm: Number(e.target.value) })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white text-sm"
            />
            <input
              type="number"
              placeholder="Max distance"
              value={form.maxDistanceKm}
              onChange={(e) => setForm({ ...form, maxDistanceKm: Number(e.target.value) })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Base fee"
              value={form.baseFee}
              onChange={(e) => setForm({ ...form, baseFee: Number(e.target.value) })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white text-sm"
            />
            <input
              type="number"
              placeholder="Per km rate"
              value={form.perKmRate}
              onChange={(e) => setForm({ ...form, perKmRate: Number(e.target.value) })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white text-sm"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
          </label>
        </div>

        <div className="flex gap-2 pt-4">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// Happy Hour Form Modal Component
function HappyHourFormModal({ hh, onSave, onClose }: any) {
  const [form, setForm] = useState(hh || {
    name: '',
    startTime: '14:00',
    endTime: '16:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    discountPercentage: 50,
    isActive: true
  });

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleDay = (day: number) => {
    setForm({
      ...form,
      daysOfWeek: form.daysOfWeek.includes(day)
        ? form.daysOfWeek.filter((d: number) => d !== day)
        : [...form.daysOfWeek, day]
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {hh ? 'Edit Happy Hour' : 'Add Happy Hour'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Window name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Start</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">End</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Discount %</label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.discountPercentage}
              onChange={(e) => setForm({ ...form, discountPercentage: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Days</label>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`py-2 rounded font-bold text-xs transition ${
                    form.daysOfWeek.includes(i)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
