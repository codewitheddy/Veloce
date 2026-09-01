import React, { useState, useMemo, useEffect } from 'react';
import {
  MapPin,
  Layers,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  GripVertical,
  Sliders,
  Map,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Info,
  Check,
  X,
  Compass,
  Building2,
  Zap,
  Globe
} from 'lucide-react';
import { ShippingZone } from '../types/shipping';
import ZoneValidationVisualizer from './ZoneValidationVisualizer';

export interface ShippingZonesPanelProps {
  initialZones?: ShippingZone[];
  onZonesChange?: (zones: ShippingZone[]) => void;
  maxRadiusKm?: number;
  className?: string;
}

// Master list of Counties / Administrative Regions for coverage tracking
export interface CountyRegion {
  id: string;
  countyName: string;
  provinceOrRegion: string;
  suggestedMinKm: number;
  suggestedMaxKm: number;
  subLocations: string[];
}

export const MASTER_KENYA_COUNTIES: CountyRegion[] = [
  {
    id: 'cnt-nbo-cbd',
    countyName: 'Nairobi CBD & Inner Ring',
    provinceOrRegion: 'Nairobi Central',
    suggestedMinKm: 0,
    suggestedMaxKm: 8,
    subLocations: ['CBD', 'Westlands', 'Kilimani', 'Parklands', 'Upper Hill', 'Kileleshwa', 'Lavington']
  },
  {
    id: 'cnt-nbo-suburb',
    countyName: 'Nairobi Suburbs & Outer Ring',
    provinceOrRegion: 'Nairobi County',
    suggestedMinKm: 8,
    suggestedMaxKm: 20,
    subLocations: ['Karen', 'Langata', 'Runda', 'Gigiri', 'Embakasi', 'Kasarani', 'Roysambu', 'South C']
  },
  {
    id: 'cnt-kmb',
    countyName: 'Kiambu County',
    provinceOrRegion: 'Central Metro',
    suggestedMinKm: 15,
    suggestedMaxKm: 35,
    subLocations: ['Thika', 'Ruiru', 'Kikuyu', 'Ruaka', 'Kiambu Town', 'Limuru', 'Juja']
  },
  {
    id: 'cnt-mks',
    countyName: 'Machakos County',
    provinceOrRegion: 'Eastern Metro',
    suggestedMinKm: 20,
    suggestedMaxKm: 45,
    subLocations: ['Syokimau', 'Athi River', 'Mlolongo', 'Mavoko', 'Machakos Town']
  },
  {
    id: 'cnt-kjd',
    countyName: 'Kajiado County',
    provinceOrRegion: 'Rift Valley Metro',
    suggestedMinKm: 22,
    suggestedMaxKm: 50,
    subLocations: ['Kitengela', 'Ngong', 'Ongata Rongai', 'Kajiado Town']
  },
  {
    id: 'cnt-nkr',
    countyName: 'Nakuru County',
    provinceOrRegion: 'Rift Valley',
    suggestedMinKm: 50,
    suggestedMaxKm: 90,
    subLocations: ['Naivasha', 'Nakuru City', 'Gilgil', 'Molo']
  },
  {
    id: 'cnt-mba',
    countyName: 'Mombasa County',
    provinceOrRegion: 'Coast Region',
    suggestedMinKm: 450,
    suggestedMaxKm: 500,
    subLocations: ['Mombasa Island', 'Nyali', 'Bamburi', 'Changamwe', 'Likoni']
  }
];

export interface CoverageGapIssue {
  id: string;
  type: 'gap' | 'overlap' | 'unassigned_county' | 'uncovered_radius';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  gapStartKm?: number;
  gapEndKm?: number;
  affectedZoneIds?: string[];
  affectedCountyIds?: string[];
}

export function ShippingZonesPanel({
  initialZones,
  onZonesChange,
  maxRadiusKm = 50,
  className = ''
}: ShippingZonesPanelProps) {
  // Local state for shipping zones
  const [zones, setZones] = useState<ShippingZone[]>(() => {
    if (initialZones && initialZones.length > 0) return initialZones;
    const saved = localStorage.getItem('veloce_shipping_zones');
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: 'zone-1',
            name: 'Nairobi CBD & Inner Ring',
            description: 'Central Business District, Westlands, Kilimani, Parklands',
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
            description: 'Thika, Ruiru, Kikuyu, Kitengela, Ngong, Syokimau',
            minDistanceKm: 20,
            maxDistanceKm: 50,
            baseFee: 400,
            perKmRate: 35,
            isActive: true,
            regions: ['Thika', 'Ruiru', 'Kikuyu', 'Kitengela', 'Ngong', 'Syokimau'],
            estimatedDeliveryTime: '1-2 hours'
          }
        ];
  });

  // Drag and Drop state
  const [draggedZoneIndex, setDraggedZoneIndex] = useState<number | null>(null);
  const [draggedCountyId, setDraggedCountyId] = useState<string | null>(null);

  // Modal & Form States
  const [editingZone, setEditingZone] = useState<ShippingZone | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formMinKm, setFormMinKm] = useState(0);
  const [formMaxKm, setFormMaxKm] = useState(15);
  const [formBaseFee, setFormBaseFee] = useState(200);
  const [formPerKmRate, setFormPerKmRate] = useState(25);
  const [formEstTime, setFormEstTime] = useState('30-45 mins');
  const [formRegions, setFormRegions] = useState('');

  // Selected county view tab
  const [viewTab, setViewTab] = useState<'grid' | 'counties' | 'coverage_map'>('grid');

  // Sync state changes to parent or local storage
  const updateZones = (newZones: ShippingZone[]) => {
    setZones(newZones);
    localStorage.setItem('veloce_shipping_zones', JSON.stringify(newZones));
    if (onZonesChange) {
      onZonesChange(newZones);
    }
  };

  // COVERAGE GAP VALIDATION ENGINE
  const gapAnalysis = useMemo(() => {
    const issues: CoverageGapIssue[] = [];
    const activeZones = zones.filter((z) => z.isActive);

    if (activeZones.length === 0) {
      issues.push({
        id: 'no-active-zones',
        type: 'gap',
        severity: 'high',
        title: 'No Active Delivery Zones Configured',
        description: 'All shipping zones are disabled. Customers will be unable to calculate delivery fees.'
      });
      return { issues, isHealthy: false, maxCoveredKm: 0, coveragePercentage: 0 };
    }

    // Sort active zones by minDistanceKm ascending
    const sorted = [...activeZones].sort((a, b) => a.minDistanceKm - b.minDistanceKm);

    // 1. Check if delivery starts at 0 KM
    if (sorted[0].minDistanceKm > 0) {
      issues.push({
        id: 'gap-start-0',
        type: 'gap',
        severity: 'high',
        title: `Coverage Gap at Origin (0 - ${sorted[0].minDistanceKm} KM)`,
        description: `Deliveries right around the hub (0 to ${sorted[0].minDistanceKm} KM) are currently unassigned to any zone.`,
        gapStartKm: 0,
        gapEndKm: sorted[0].minDistanceKm,
        affectedZoneIds: [sorted[0].id]
      });
    }

    // 2. Check for intermediate distance gaps & overlaps
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      if (current.maxDistanceKm < next.minDistanceKm) {
        // Distance Gap!
        issues.push({
          id: `gap-${current.id}-${next.id}`,
          type: 'gap',
          severity: 'high',
          title: `Delivery Radius Gap (${current.maxDistanceKm.toFixed(1)} KM - ${next.minDistanceKm.toFixed(1)} KM)`,
          description: `No active delivery zone covers distances between ${current.maxDistanceKm.toFixed(1)} KM and ${next.minDistanceKm.toFixed(1)} KM.`,
          gapStartKm: current.maxDistanceKm,
          gapEndKm: next.minDistanceKm,
          affectedZoneIds: [current.id, next.id]
        });
      } else if (current.maxDistanceKm > next.minDistanceKm) {
        // Overlap!
        issues.push({
          id: `overlap-${current.id}-${next.id}`,
          type: 'overlap',
          severity: 'medium',
          title: `Radius Overlap between '${current.name}' and '${next.name}'`,
          description: `Distance range ${next.minDistanceKm.toFixed(1)} KM - ${current.maxDistanceKm.toFixed(1)} KM is covered by multiple zones.`,
          gapStartKm: next.minDistanceKm,
          gapEndKm: current.maxDistanceKm,
          affectedZoneIds: [current.id, next.id]
        });
      }
    }

    // 3. Check for target max radius coverage
    const maxCoveredKm = Math.max(...sorted.map((z) => z.maxDistanceKm));
    if (maxCoveredKm < maxRadiusKm) {
      issues.push({
        id: 'uncovered-outer-radius',
        type: 'uncovered_radius',
        severity: 'low',
        title: `Outer Perimeter Uncovered (${maxCoveredKm.toFixed(1)} KM - ${maxRadiusKm} KM)`,
        description: `Deliveries beyond ${maxCoveredKm.toFixed(1)} KM up to the ${maxRadiusKm} KM regional border will trigger out-of-range rates.`,
        gapStartKm: maxCoveredKm,
        gapEndKm: maxRadiusKm
      });
    }

    // 4. Check unassigned counties
    const assignedRegionsList = activeZones.flatMap((z) => z.regions || []).map((r) => r.toLowerCase().trim());
    const unassignedCounties = MASTER_KENYA_COUNTIES.filter((county) => {
      // Check if county or any of its sublocations match assigned regions
      const isCountyAssigned = assignedRegionsList.some((r) => r.includes(county.countyName.toLowerCase()));
      const hasSubLocationAssigned = county.subLocations.some((sub) =>
        assignedRegionsList.some((r) => r.includes(sub.toLowerCase()))
      );
      return !isCountyAssigned && !hasSubLocationAssigned;
    });

    if (unassignedCounties.length > 0) {
      issues.push({
        id: 'unassigned-counties',
        type: 'unassigned_county',
        severity: 'medium',
        title: `Unassigned Regional County Hubs (${unassignedCounties.length})`,
        description: `Key regional hubs like ${unassignedCounties.map((c) => c.countyName).slice(0, 3).join(', ')} are not explicitly assigned to a zone.`,
        affectedCountyIds: unassignedCounties.map((c) => c.id)
      });
    }

    const coveragePercentage = Math.min(100, Math.round((maxCoveredKm / maxRadiusKm) * 100));
    const isHealthy = issues.filter((i) => i.severity === 'high').length === 0;

    return {
      issues,
      isHealthy,
      maxCoveredKm,
      coveragePercentage,
      unassignedCounties
    };
  }, [zones, maxRadiusKm]);

  // AUTO-FIX COVERAGE GAPS
  const handleAutoBridgeGaps = () => {
    const activeZones = [...zones].filter((z) => z.isActive);
    if (activeZones.length === 0) return;

    // Sort active zones by minDistance
    const sorted = activeZones.sort((a, b) => a.minDistanceKm - b.minDistanceKm);

    // Fix 1: First zone starts at 0 KM
    if (sorted[0].minDistanceKm > 0) {
      sorted[0].minDistanceKm = 0;
    }

    // Fix 2: Bridge intermediate gaps
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].maxDistanceKm !== sorted[i + 1].minDistanceKm) {
        // Set next zone's minDistance equal to current zone's maxDistance
        sorted[i + 1].minDistanceKm = sorted[i].maxDistanceKm;
      }
    }

    // Merge modified active zones back with inactive zones
    const inactive = zones.filter((z) => !z.isActive);
    const resolvedZones = [...sorted, ...inactive];

    updateZones(resolvedZones);
  };

  // Re-ordering zones via Drag & Drop
  const handleDragStartZone = (index: number) => {
    setDraggedZoneIndex(index);
  };

  const handleDragOverZone = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedZoneIndex === null || draggedZoneIndex === targetIndex) return;

    const updated = [...zones];
    const [movedZone] = updated.splice(draggedZoneIndex, 1);
    updated.splice(targetIndex, 0, movedZone);

    setDraggedZoneIndex(targetIndex);
    setZones(updated);
  };

  const handleDragEndZone = () => {
    setDraggedZoneIndex(null);
    updateZones(zones);
  };

  // Assign county to zone via drop
  const handleAssignCountyToZone = (countyName: string, targetZoneId: string) => {
    const updated = zones.map((z) => {
      if (z.id === targetZoneId) {
        const existing = z.regions || [];
        if (!existing.includes(countyName)) {
          return { ...z, regions: [...existing, countyName] };
        }
      } else {
        // Remove from other zones if present
        if (z.regions) {
          return { ...z, regions: z.regions.filter((r) => r !== countyName) };
        }
      }
      return z;
    });
    updateZones(updated);
  };

  // Toggle Zone Active state
  const handleToggleActive = (id: string) => {
    const updated = zones.map((z) => (z.id === id ? { ...z, isActive: !z.isActive } : z));
    updateZones(updated);
  };

  // Open Modal to Create/Edit
  const handleOpenModal = (zone?: ShippingZone) => {
    if (zone) {
      setEditingZone(zone);
      setFormName(zone.name);
      setFormDesc(zone.description || '');
      setFormMinKm(zone.minDistanceKm);
      setFormMaxKm(zone.maxDistanceKm);
      setFormBaseFee(zone.baseFee);
      setFormPerKmRate(zone.perKmRate);
      setFormEstTime(zone.estimatedDeliveryTime || '30-45 mins');
      setFormRegions((zone.regions || []).join(', '));
    } else {
      setEditingZone(null);
      setFormName('');
      setFormDesc('');
      setFormMinKm(0);
      setFormMaxKm(15);
      setFormBaseFee(200);
      setFormPerKmRate(25);
      setFormEstTime('30-45 mins');
      setFormRegions('');
    }
    setIsModalOpen(true);
  };

  // Save Modal Form
  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const parsedRegions = formRegions
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);

    if (editingZone) {
      const updated = zones.map((z) =>
        z.id === editingZone.id
          ? {
              ...z,
              name: formName,
              description: formDesc,
              minDistanceKm: Number(formMinKm),
              maxDistanceKm: Number(formMaxKm),
              baseFee: Number(formBaseFee),
              perKmRate: Number(formPerKmRate),
              estimatedDeliveryTime: formEstTime,
              regions: parsedRegions
            }
          : z
      );
      updateZones(updated);
    } else {
      const newZone: ShippingZone = {
        id: `zone-${Date.now()}`,
        name: formName,
        description: formDesc,
        minDistanceKm: Number(formMinKm),
        maxDistanceKm: Number(formMaxKm),
        baseFee: Number(formBaseFee),
        perKmRate: Number(formPerKmRate),
        isActive: true,
        estimatedDeliveryTime: formEstTime,
        regions: parsedRegions
      };
      updateZones([...zones, newZone]);
    }
    setIsModalOpen(false);
  };

  // Delete Zone
  const handleDeleteZone = (id: string) => {
    if (confirm('Are you sure you want to delete this shipping zone?')) {
      const updated = zones.filter((z) => z.id !== id);
      updateZones(updated);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* SECTION HEADER & VIEW TAB TOGGLES */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-gray-950 dark:text-white">
              Shipping Zones & Radius Coverage Matrix
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-extralight">
              Configure delivery radius, county regional assignments, and fee schedules with real-time coverage gap detection.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-800 text-xs">
            <button
              type="button"
              onClick={() => setViewTab('grid')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewTab === 'grid'
                  ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Zone Cards
            </button>
            <button
              type="button"
              onClick={() => setViewTab('counties')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewTab === 'counties'
                  ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              County Assignments
            </button>
            <button
              type="button"
              onClick={() => setViewTab('coverage_map')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewTab === 'coverage_map'
                  ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Coverage Spectrum
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Zone
          </button>
        </div>
      </div>

      {/* COVERAGE GAP & SYSTEM HEALTH ALERT BANNER */}
      <div
        className={`p-4 rounded-2xl border transition-all ${
          gapAnalysis.isHealthy
            ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
            : 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                gapAnalysis.isHealthy
                  ? 'bg-emerald-500 text-white'
                  : 'bg-amber-500 text-white animate-bounce'
              }`}
            >
              {gapAnalysis.isHealthy ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <ShieldAlert className="h-5 w-5" />
              )}
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm">
                  {gapAnalysis.isHealthy
                    ? 'Seamless Delivery Radius Coverage'
                    : `Coverage Map Warning: ${gapAnalysis.issues.length} Issues Detected`}
                </h4>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-white/60 dark:bg-black/40 font-bold">
                  {gapAnalysis.maxCoveredKm.toFixed(0)} KM Max Radius ({gapAnalysis.coveragePercentage}% Covered)
                </span>
              </div>
              <p className="text-xs opacity-90 font-light">
                {gapAnalysis.isHealthy
                  ? 'All radius zones fit seamlessly from 0 KM up to outer borders with no unassigned distance gaps.'
                  : 'Gaps or overlapping radii were detected in your shipping zones which may cause unpredictable delivery fee calculations.'}
              </p>
            </div>
          </div>

          {!gapAnalysis.isHealthy && (
            <button
              type="button"
              onClick={handleAutoBridgeGaps}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-all shrink-0 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-200" />
              Auto-Bridge Distance Gaps
            </button>
          )}
        </div>

        {/* Detailed Issue Cards List */}
        {gapAnalysis.issues.length > 0 && (
          <div className="mt-3.5 pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-2">
            {gapAnalysis.issues.map((issue) => (
              <div
                key={issue.id}
                className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 bg-white/80 dark:bg-gray-900/80 ${
                  issue.severity === 'high'
                    ? 'border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                    : 'border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                }`}
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                <div className="space-y-0.5 min-w-0">
                  <span className="font-bold block truncate">{issue.title}</span>
                  <p className="text-[11px] font-light opacity-90 leading-snug">
                    {issue.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* VISUAL RADIUS COVERAGE SPECTRUM BAR */}
      <div className="bg-gray-50 dark:bg-gray-900/70 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-gray-800 dark:text-gray-200">
          <span className="flex items-center gap-1.5">
            <Compass className="h-4 w-4 text-indigo-500" /> Radius Spectrum Map (0 KM - {maxRadiusKm} KM)
          </span>
          <span className="font-mono text-[10px] text-gray-400">
            Click zone segments or drag card order below
          </span>
        </div>

        {/* Multi-segmented Radius Bar */}
        <div className="relative h-10 w-full bg-gray-200 dark:bg-gray-800 rounded-xl overflow-hidden flex border border-gray-300 dark:border-gray-700">
          {zones
            .filter((z) => z.isActive)
            .sort((a, b) => a.minDistanceKm - b.minDistanceKm)
            .map((zone, idx) => {
              const widthPct = Math.min(
                100,
                Math.max(2, ((zone.maxDistanceKm - zone.minDistanceKm) / maxRadiusKm) * 100)
              );
              const colorClasses = [
                'bg-indigo-600 text-indigo-100 border-indigo-500',
                'bg-emerald-600 text-emerald-100 border-emerald-500',
                'bg-amber-600 text-amber-100 border-amber-500',
                'bg-cyan-600 text-cyan-100 border-cyan-500'
              ];
              const bgClass = colorClasses[idx % colorClasses.length];

              return (
                <div
                  key={zone.id}
                  style={{ width: `${widthPct}%` }}
                  onClick={() => handleOpenModal(zone)}
                  className={`h-full border-r relative group cursor-pointer transition-all hover:brightness-110 flex items-center justify-center p-1 text-[10px] font-mono font-bold truncate ${bgClass}`}
                  title={`${zone.name}: ${zone.minDistanceKm} - ${zone.maxDistanceKm} KM`}
                >
                  <span className="truncate">{zone.name}</span>
                  <div className="absolute inset-x-0 bottom-0.5 text-[8px] text-center opacity-80 font-normal">
                    {zone.minDistanceKm}-{zone.maxDistanceKm} KM
                  </div>
                </div>
              );
            })}
        </div>

        <div className="flex justify-between text-[10px] font-mono text-gray-400 px-1">
          <span>0 KM (Hub Origin)</span>
          <span>10 KM</span>
          <span>25 KM</span>
          <span>{maxRadiusKm} KM (Limit)</span>
        </div>
      </div>

      {/* VIEW TAB 1: ZONE CARDS WITH DRAG & DROP REORDERING */}
      {viewTab === 'grid' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
            <span>Configured Delivery Zones ({zones.length})</span>
            <span>Drag handles to re-order priority</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {zones.map((zone, index) => (
              <div
                key={zone.id}
                draggable
                onDragStart={() => handleDragStartZone(index)}
                onDragOver={(e) => handleDragOverZone(e, index)}
                onDragEnd={handleDragEndZone}
                className={`bg-white dark:bg-gray-800 rounded-2xl border p-4 shadow-xs transition-all space-y-3 relative group ${
                  draggedZoneIndex === index ? 'opacity-40 border-indigo-500' : ''
                } ${
                  zone.isActive
                    ? 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                    : 'border-dashed border-gray-300 dark:border-gray-700 opacity-60 bg-gray-50/50'
                }`}
              >
                {/* Card Top Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1"
                      title="Drag to reorder zone priority"
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-gray-950 dark:text-white flex items-center gap-1.5">
                        {zone.name}
                      </h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 font-light line-clamp-1">
                        {zone.description || 'No description provided.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleActive(zone.id)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase transition-colors cursor-pointer ${
                      zone.isActive
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                    }`}
                  >
                    {zone.isActive ? 'Active' : 'Disabled'}
                  </button>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-900/60 p-2.5 rounded-xl border border-gray-150 dark:border-gray-800 text-xs font-mono">
                  <div>
                    <span className="block text-[9px] text-gray-400 uppercase">Radius Range</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {zone.minDistanceKm} - {zone.maxDistanceKm} KM
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-gray-400 uppercase">Base Zone Fee</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      KES {zone.baseFee}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-gray-400 uppercase">Per KM Rate</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      KES {zone.perKmRate}/KM
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-gray-400 uppercase">Est. SLA</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {zone.estimatedDeliveryTime || '30-45 mins'}
                    </span>
                  </div>
                </div>

                {/* Assigned County Regions Badges */}
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Assigned Hub Regions ({zone.regions?.length || 0})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(zone.regions || []).map((reg, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-medium"
                      >
                        {reg}
                      </span>
                    ))}
                    {(!zone.regions || zone.regions.length === 0) && (
                      <span className="text-[10px] text-gray-400 italic">No explicit regions added.</span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700/80 pt-3">
                  <span className="text-[10px] font-mono text-gray-400">
                    Priority #{index + 1}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenModal(zone)}
                      className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                      title="Edit Zone"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteZone(zone.id)}
                      className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                      title="Delete Zone"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW TAB 2: COUNTY & REGIONAL ASSIGNMENT MATRIX */}
      {viewTab === 'counties' && (
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-1">
            <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-indigo-500" /> Administrative County Hub Assignments
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-light">
              Assign major counties to delivery zones. Drag counties or click the dropdown selector to reassign zones.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MASTER_KENYA_COUNTIES.map((county) => {
              // Find which zone currently covers this county
              const assignedZone = zones.find((z) =>
                (z.regions || []).some(
                  (r) =>
                    r.toLowerCase().includes(county.countyName.toLowerCase()) ||
                    county.subLocations.some((sub) => r.toLowerCase().includes(sub.toLowerCase()))
                )
              );

              return (
                <div
                  key={county.id}
                  className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h5 className="font-bold text-xs text-gray-900 dark:text-white">
                        {county.countyName}
                      </h5>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {county.provinceOrRegion} ({county.suggestedMinKm}-{county.suggestedMaxKm} KM)
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        assignedZone
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}
                    >
                      {assignedZone ? assignedZone.name : 'Unassigned'}
                    </span>
                  </div>

                  {/* Sub-locations Chips */}
                  <div className="flex flex-wrap gap-1">
                    {county.subLocations.map((sub, sIdx) => (
                      <span
                        key={sIdx}
                        className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 text-[9.5px]"
                      >
                        {sub}
                      </span>
                    ))}
                  </div>

                  {/* Dropdown to assign to zone */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700/80">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                      Assigned Zone Target
                    </label>
                    <select
                      value={assignedZone ? assignedZone.id : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAssignCountyToZone(county.countyName, e.target.value);
                        }
                      }}
                      className="h-8 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-xs font-medium text-gray-900 dark:text-white"
                    >
                      <option value="">-- Unassigned --</option>
                      {zones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name} ({z.minDistanceKm}-{z.maxDistanceKm} KM)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW TAB 3: COVERAGE SPECTRUM ANALYZER & REAL-TIME VALIDATION VISUALIZER */}
      {viewTab === 'coverage_map' && (
        <ZoneValidationVisualizer
          zones={zones}
          onUpdateZones={(newZones) => updateZones(newZones)}
          maxRadiusKm={maxRadiusKm}
        />
      )}

      {/* MODAL: CREATE / EDIT SHIPPING ZONE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                {editingZone ? 'Edit Shipping Zone' : 'Create New Shipping Zone'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Zone Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Nairobi CBD & Inner Ring"
                  className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="e.g. Central hubs, Westlands, Kilimani"
                  className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Min Distance (KM)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={formMinKm}
                    onChange={(e) => setFormMinKm(Number(e.target.value))}
                    className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Max Distance (KM)
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.5}
                    value={formMaxKm}
                    onChange={(e) => setFormMaxKm(Number(e.target.value))}
                    className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Base Zone Fee (KES)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={formBaseFee}
                    onChange={(e) => setFormBaseFee(Number(e.target.value))}
                    className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Per-KM Rate (KES)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={formPerKmRate}
                    onChange={(e) => setFormPerKmRate(Number(e.target.value))}
                    className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Est. Delivery Time / SLA
                </label>
                <input
                  type="text"
                  value={formEstTime}
                  onChange={(e) => setFormEstTime(e.target.value)}
                  placeholder="e.g. 20-35 mins"
                  className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Assigned Regions / Sub-locations (Comma separated)
                </label>
                <input
                  type="text"
                  value={formRegions}
                  onChange={(e) => setFormRegions(e.target.value)}
                  placeholder="e.g. CBD, Westlands, Kilimani, Lavington"
                  className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 h-9 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                >
                  Save Zone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShippingZonesPanel;
