import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
  Sliders,
  Wrench,
  Info,
  ArrowRight,
  Layers,
  Zap,
  RotateCcw,
  Plus,
  Check,
  X,
  Compass,
  MapPin,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { ShippingZone } from '../types/shipping';

export interface ZoneValidationVisualizerProps {
  zones: ShippingZone[];
  onUpdateZones: (newZones: ShippingZone[]) => void;
  maxRadiusKm?: number;
  className?: string;
}

export interface ZoneConflict {
  id: string;
  type: 'overlap' | 'gap' | 'origin_gap' | 'outer_gap';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  startKm: number;
  endKm: number;
  primaryZoneId?: string;
  secondaryZoneId?: string;
  suggestedFixes: {
    label: string;
    description: string;
    action: () => void;
  }[];
}

export function ZoneValidationVisualizer({
  zones,
  onUpdateZones,
  maxRadiusKm = 50,
  className = ''
}: ZoneValidationVisualizerProps) {
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(null);
  const [hoveredKm, setHoveredKm] = useState<number | null>(null);
  const [showFixDetails, setShowFixDetails] = useState<boolean>(true);
  const [resolveNotification, setResolveNotification] = useState<{
    title: string;
    details: string;
    timestamp: string;
  } | null>(null);

  // Active zones sorted by min distance
  const activeZones = useMemo(() => {
    return zones.filter(z => z.isActive).sort((a, b) => a.minDistanceKm - b.minDistanceKm);
  }, [zones]);

  // Compute total maximum distance across active zones or default maxRadiusKm
  const effectiveMaxKm = useMemo(() => {
    const maxZoneDist = Math.max(...zones.map(z => z.maxDistanceKm), 0);
    return Math.max(maxZoneDist, maxRadiusKm, 10);
  }, [zones, maxRadiusKm]);

  // REAL-TIME CONFLICT ANALYSIS ENGINE
  const analysis = useMemo(() => {
    const conflicts: ZoneConflict[] = [];

    if (activeZones.length === 0) {
      conflicts.push({
        id: 'no-active-zones',
        type: 'gap',
        severity: 'critical',
        title: '🔴 Complete Shipping System Blackout',
        description: 'No active shipping zones are enabled. Customers will receive "Delivery Not Available" errors at checkout.',
        startKm: 0,
        endKm: effectiveMaxKm,
        suggestedFixes: [
          {
            label: 'Enable All Disabled Zones',
            description: 'Turn on all existing shipping zones to restore delivery coverage.',
            action: () => {
              const updated = zones.map(z => ({ ...z, isActive: true }));
              onUpdateZones(updated);
            }
          }
        ]
      });

      return {
        conflicts,
        overlapKmCount: effectiveMaxKm,
        gapKmCount: effectiveMaxKm,
        coveredKmCount: 0,
        coveragePercentage: 0,
        isHealthy: false
      };
    }

    // 1. Check for origin gap (0 KM to first zone's min KM)
    if (activeZones[0].minDistanceKm > 0) {
      const startG = 0;
      const endG = activeZones[0].minDistanceKm;
      const gapDist = endG - startG;

      conflicts.push({
        id: 'origin-gap',
        type: 'origin_gap',
        severity: 'critical',
        title: `🔴 Origin Coverage Gap (0.0 KM – ${endG.toFixed(1)} KM)`,
        description: `Orders placed within ${endG.toFixed(1)} KM of your central hub cannot be fulfilled because Zone '${activeZones[0].name}' starts at ${endG.toFixed(1)} KM.`,
        startKm: startG,
        endKm: endG,
        primaryZoneId: activeZones[0].id,
        suggestedFixes: [
          {
            label: `Extend '${activeZones[0].name}' down to 0 KM`,
            description: `Set '${activeZones[0].name}' minimum distance to 0 KM so central hub orders are covered.`,
            action: () => {
              const updated = zones.map(z =>
                z.id === activeZones[0].id ? { ...z, minDistanceKm: 0 } : z
              );
              onUpdateZones(updated);
            }
          },
          {
            label: `Create Hub Express Zone (0.0 – ${endG.toFixed(1)} KM)`,
            description: `Add a dedicated local hub zone covering 0 to ${endG.toFixed(1)} KM.`,
            action: () => {
              const newZone: ShippingZone = {
                id: `zone-hub-${Date.now()}`,
                name: 'Central Hub Express Zone',
                description: 'Immediate local neighborhood delivery radius',
                minDistanceKm: 0,
                maxDistanceKm: endG,
                baseFee: 100,
                perKmRate: 15,
                isActive: true,
                regions: ['Central Hub', 'CBD'],
                estimatedDeliveryTime: '15-25 mins'
              };
              onUpdateZones([newZone, ...zones]);
            }
          }
        ]
      });
    }

    // 2. Check intermediate zone gaps & overlaps
    for (let i = 0; i < activeZones.length - 1; i++) {
      const z1 = activeZones[i];
      const z2 = activeZones[i + 1];

      // OVERLAP DETECTED
      if (z1.maxDistanceKm > z2.minDistanceKm) {
        const overlapStart = z2.minDistanceKm;
        const overlapEnd = Math.min(z1.maxDistanceKm, z2.maxDistanceKm);
        const overlapDist = overlapEnd - overlapStart;

        conflicts.push({
          id: `overlap-${z1.id}-${z2.id}`,
          type: 'overlap',
          severity: 'critical',
          title: `🔴 Zone Overlap Conflict (${overlapStart.toFixed(1)} KM – ${overlapEnd.toFixed(1)} KM)`,
          description: `Distance interval ${overlapStart.toFixed(1)} KM to ${overlapEnd.toFixed(1)} KM is covered by both '${z1.name}' (max ${z1.maxDistanceKm} KM) and '${z2.name}' (min ${z2.minDistanceKm} KM). This causes fee calculation ambiguity.`,
          startKm: overlapStart,
          endKm: overlapEnd,
          primaryZoneId: z1.id,
          secondaryZoneId: z2.id,
          suggestedFixes: [
            {
              label: `Trim '${z1.name}' max radius to ${z2.minDistanceKm.toFixed(1)} KM`,
              description: `Cap '${z1.name}' at ${z2.minDistanceKm.toFixed(1)} KM so '${z2.name}' takes over seamlessly.`,
              action: () => {
                const updated = zones.map(z =>
                  z.id === z1.id ? { ...z, maxDistanceKm: z2.minDistanceKm } : z
                );
                onUpdateZones(updated);
              }
            },
            {
              label: `Raise '${z2.name}' min radius to ${z1.maxDistanceKm.toFixed(1)} KM`,
              description: `Shift '${z2.name}' to start at ${z1.maxDistanceKm.toFixed(1)} KM where '${z1.name}' ends.`,
              action: () => {
                const updated = zones.map(z =>
                  z.id === z2.id ? { ...z, minDistanceKm: z1.maxDistanceKm } : z
                );
                onUpdateZones(updated);
              }
            },
            {
              label: `Split boundary evenly at ${((z1.maxDistanceKm + z2.minDistanceKm) / 2).toFixed(1)} KM`,
              description: `Set '${z1.name}' max and '${z2.name}' min to ${((z1.maxDistanceKm + z2.minDistanceKm) / 2).toFixed(1)} KM.`,
              action: () => {
                const mid = Number(((z1.maxDistanceKm + z2.minDistanceKm) / 2).toFixed(1));
                const updated = zones.map(z => {
                  if (z.id === z1.id) return { ...z, maxDistanceKm: mid };
                  if (z.id === z2.id) return { ...z, minDistanceKm: mid };
                  return z;
                });
                onUpdateZones(updated);
              }
            }
          ]
        });
      }

      // FRAGMENTATION / GAP DETECTED
      if (z1.maxDistanceKm < z2.minDistanceKm) {
        const gapStart = z1.maxDistanceKm;
        const gapEnd = z2.minDistanceKm;

        conflicts.push({
          id: `gap-${z1.id}-${z2.id}`,
          type: 'gap',
          severity: 'critical',
          title: `🔴 Fragmented Radius Gap (${gapStart.toFixed(1)} KM – ${gapEnd.toFixed(1)} KM)`,
          description: `No active shipping zone covers deliveries between ${gapStart.toFixed(1)} KM and ${gapEnd.toFixed(1)} KM. Customers in this range will get delivery error messages.`,
          startKm: gapStart,
          endKm: gapEnd,
          primaryZoneId: z1.id,
          secondaryZoneId: z2.id,
          suggestedFixes: [
            {
              label: `Bridge Gap: Extend '${z1.name}' to ${gapEnd.toFixed(1)} KM`,
              description: `Increase '${z1.name}' max distance to reach '${z2.name}'.`,
              action: () => {
                const updated = zones.map(z =>
                  z.id === z1.id ? { ...z, maxDistanceKm: gapEnd } : z
                );
                onUpdateZones(updated);
              }
            },
            {
              label: `Bridge Gap: Lower '${z2.name}' to ${gapStart.toFixed(1)} KM`,
              description: `Decrease '${z2.name}' min distance to touch '${z1.name}'.`,
              action: () => {
                const updated = zones.map(z =>
                  z.id === z2.id ? { ...z, minDistanceKm: gapStart } : z
                );
                onUpdateZones(updated);
              }
            },
            {
              label: `Create Filler Zone (${gapStart.toFixed(1)} – ${gapEnd.toFixed(1)} KM)`,
              description: `Insert a new intermediate zone to cover this gap.`,
              action: () => {
                const newZone: ShippingZone = {
                  id: `zone-gap-${Date.now()}`,
                  name: `Intermediate Zone (${gapStart.toFixed(0)}-${gapEnd.toFixed(0)} KM)`,
                  description: 'Auto-created filler shipping zone',
                  minDistanceKm: gapStart,
                  maxDistanceKm: gapEnd,
                  baseFee: Math.round((z1.baseFee + z2.baseFee) / 2),
                  perKmRate: Math.round((z1.perKmRate + z2.perKmRate) / 2),
                  isActive: true,
                  estimatedDeliveryTime: '30-50 mins'
                };
                onUpdateZones([...zones, newZone]);
              }
            }
          ]
        });
      }
    }

    // 3. Outer perimeter gap check
    const maxCovered = Math.max(...activeZones.map(z => z.maxDistanceKm));
    if (maxCovered < effectiveMaxKm) {
      conflicts.push({
        id: 'outer-perimeter-gap',
        type: 'outer_gap',
        severity: 'warning',
        title: `⚠️ Unserviced Outer Perimeter (${maxCovered.toFixed(1)} KM – ${effectiveMaxKm.toFixed(1)} KM)`,
        description: `Deliveries beyond ${maxCovered.toFixed(1)} KM up to your store limit of ${effectiveMaxKm.toFixed(1)} KM are not assigned to a zone.`,
        startKm: maxCovered,
        endKm: effectiveMaxKm,
        primaryZoneId: activeZones[activeZones.length - 1]?.id,
        suggestedFixes: [
          {
            label: `Extend '${activeZones[activeZones.length - 1]?.name}' to ${effectiveMaxKm} KM`,
            description: `Expand the outer zone to cover up to ${effectiveMaxKm} KM.`,
            action: () => {
              const lastId = activeZones[activeZones.length - 1]?.id;
              if (lastId) {
                const updated = zones.map(z =>
                  z.id === lastId ? { ...z, maxDistanceKm: effectiveMaxKm } : z
                );
                onUpdateZones(updated);
              }
            }
          }
        ]
      });
    }

    // Calculate spectrum metrics
    let overlapKmCount = 0;
    let gapKmCount = 0;

    conflicts.forEach(c => {
      const dist = c.endKm - c.startKm;
      if (c.type === 'overlap') overlapKmCount += dist;
      if (c.type === 'gap' || c.type === 'origin_gap' || c.type === 'outer_gap') gapKmCount += dist;
    });

    const coveredKmCount = Math.max(0, effectiveMaxKm - gapKmCount);
    const coveragePercentage = Math.min(100, Math.round((coveredKmCount / effectiveMaxKm) * 100));
    const isHealthy = conflicts.filter(c => c.severity === 'critical').length === 0;

    return {
      conflicts,
      overlapKmCount,
      gapKmCount,
      coveredKmCount,
      coveragePercentage,
      isHealthy
    };
  }, [zones, activeZones, effectiveMaxKm, onUpdateZones]);

  // Action 1: Auto-Resolve by Recalibrating Existing Zone Boundaries
  const handleAutoResolveBoundaries = () => {
    if (activeZones.length === 0) return;

    const sorted = activeZones.map(z => ({ ...z })).sort((a, b) => a.minDistanceKm - b.minDistanceKm);

    // 1. Force first zone minDistance to 0 KM
    sorted[0].minDistanceKm = 0;

    // 2. Calculate adjacent boundary coordinates seamlessly
    for (let i = 0; i < sorted.length - 1; i++) {
      sorted[i + 1].minDistanceKm = sorted[i].maxDistanceKm;
    }

    // 3. Extend last zone to maxRadiusKm
    if (sorted[sorted.length - 1].maxDistanceKm < maxRadiusKm) {
      sorted[sorted.length - 1].maxDistanceKm = maxRadiusKm;
    }

    const finalBoundaries = sorted.map(z => `${z.name} (${z.minDistanceKm.toFixed(1)}–${z.maxDistanceKm.toFixed(1)} KM)`).join(', ');

    const inactive = zones.filter(z => !z.isActive);
    onUpdateZones([...sorted, ...inactive]);

    setResolveNotification({
      title: '✅ Auto-Resolved Boundaries & Eliminated Coverage Gaps!',
      details: `Recalibrated boundary coordinates for ${sorted.length} active zone(s). Seamless radius coverage: ${finalBoundaries}`,
      timestamp: new Date().toLocaleTimeString()
    });
  };

  // Action 2: Auto-Resolve by Calculating Gaps & Generating New Filler Zone Coordinates
  const handleAutoGenerateFillerZones = () => {
    if (activeZones.length === 0) return;

    const sortedActive = activeZones.map(z => ({ ...z })).sort((a, b) => a.minDistanceKm - b.minDistanceKm);
    const newZonesToInsert: ShippingZone[] = [];

    // 1. Origin Gap Check
    if (sortedActive[0].minDistanceKm > 0) {
      const gapStart = 0;
      const gapEnd = sortedActive[0].minDistanceKm;
      newZonesToInsert.push({
        id: `zone-filler-origin-${Date.now()}`,
        name: `Hub Express Zone (${gapStart}–${gapEnd} KM)`,
        description: `Auto-generated filler zone for central hub origin gap`,
        minDistanceKm: gapStart,
        maxDistanceKm: gapEnd,
        baseFee: Math.max(50, Math.round(sortedActive[0].baseFee * 0.8)),
        perKmRate: sortedActive[0].perKmRate,
        isActive: true,
        regions: ['Central Hub', 'CBD'],
        estimatedDeliveryTime: '15-25 mins'
      });
    }

    // 2. Intermediate Gaps Calculation
    for (let i = 0; i < sortedActive.length - 1; i++) {
      const z1 = sortedActive[i];
      const z2 = sortedActive[i + 1];

      // Handle Overlap
      if (z1.maxDistanceKm > z2.minDistanceKm) {
        z2.minDistanceKm = z1.maxDistanceKm;
      }

      // Handle Gap by Generating New Boundary Zone
      if (z1.maxDistanceKm < z2.minDistanceKm) {
        const gapStart = z1.maxDistanceKm;
        const gapEnd = z2.minDistanceKm;

        newZonesToInsert.push({
          id: `zone-filler-gap-${i}-${Date.now()}`,
          name: `Bridge Zone (${gapStart.toFixed(1)}–${gapEnd.toFixed(1)} KM)`,
          description: `Auto-generated zone bridging gap between ${z1.name} and ${z2.name}`,
          minDistanceKm: gapStart,
          maxDistanceKm: gapEnd,
          baseFee: Math.round((z1.baseFee + z2.baseFee) / 2),
          perKmRate: Math.round((z1.perKmRate + z2.perKmRate) / 2),
          isActive: true,
          estimatedDeliveryTime: '30-45 mins'
        });
      }
    }

    // 3. Outer Perimeter Gap
    const currentMax = Math.max(
      ...sortedActive.map(z => z.maxDistanceKm),
      ...newZonesToInsert.map(z => z.maxDistanceKm)
    );
    if (currentMax < effectiveMaxKm) {
      const gapStart = currentMax;
      const gapEnd = effectiveMaxKm;
      const lastZone = sortedActive[sortedActive.length - 1];

      newZonesToInsert.push({
        id: `zone-filler-outer-${Date.now()}`,
        name: `Outer Extended Zone (${gapStart.toFixed(1)}–${gapEnd.toFixed(1)} KM)`,
        description: `Auto-generated zone covering outer perimeter up to ${effectiveMaxKm} KM`,
        minDistanceKm: gapStart,
        maxDistanceKm: gapEnd,
        baseFee: Math.round(lastZone.baseFee * 1.3),
        perKmRate: Math.round(lastZone.perKmRate * 1.2),
        isActive: true,
        estimatedDeliveryTime: '60-90 mins'
      });
    }

    const inactive = zones.filter(z => !z.isActive);
    onUpdateZones([...sortedActive, ...newZonesToInsert, ...inactive]);

    setResolveNotification({
      title: '⚡ Auto-Generated Filler Zones for Unassigned Gaps!',
      details: `Created ${newZonesToInsert.length} new shipping zone(s) with calculated boundary coordinates to achieve 100% full coverage.`,
      timestamp: new Date().toLocaleTimeString()
    });
  };

  // Helper to test if a specific zone has conflicts
  const getZoneConflicts = (zoneId: string) => {
    return analysis.conflicts.filter(
      c => c.primaryZoneId === zoneId || c.secondaryZoneId === zoneId
    );
  };

  // Generate distance step ticks for the scale
  const distanceTicks = useMemo(() => {
    const step = effectiveMaxKm <= 20 ? 2 : effectiveMaxKm <= 50 ? 5 : 10;
    const ticks: number[] = [];
    for (let d = 0; d <= effectiveMaxKm; d += step) {
      ticks.push(d);
    }
    return ticks;
  }, [effectiveMaxKm]);

  return (
    <div className={`space-y-6 text-left ${className}`}>
      {/* HEADER BAR WITH LIVE HEALTH BADGE & MASTER AUTO-FIX */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xs gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`p-3 rounded-2xl font-black text-white shrink-0 ${
              analysis.isHealthy
                ? 'bg-emerald-600 shadow-emerald-500/20 shadow-lg'
                : 'bg-rose-600 shadow-rose-500/30 shadow-lg animate-pulse'
            }`}
          >
            {analysis.isHealthy ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <AlertTriangle className="h-6 w-6" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-lg text-gray-950 dark:text-white">
                Real-Time Zone Validation Visualizer
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
                  analysis.isHealthy
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                    : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                }`}
              >
                {analysis.isHealthy ? '🟢 100% Contiguous Coverage' : `🔴 ${analysis.conflicts.length} Conflict(s) Detected`}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-extralight mt-0.5">
              Live distance spectrum analyzer. Overlapping or fragmented gaps are highlighted in red with instant 1-click resolution fixes.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!analysis.isHealthy && (
            <>
              <button
                onClick={handleAutoResolveBoundaries}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
                title="Automatically recalculate existing boundary coordinates to bridge gaps and remove overlaps"
              >
                <Sparkles className="h-4 w-4 text-rose-200" />
                <span>Auto-Resolve Boundaries</span>
              </button>

              <button
                onClick={handleAutoGenerateFillerZones}
                className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
                title="Calculate missing gap distances and synthesize brand new filler shipping zones"
              >
                <Plus className="h-4 w-4 text-indigo-200" />
                <span>Fill Gaps with New Zones</span>
              </button>
            </>
          )}

          <button
            onClick={() => setShowFixDetails(!showFixDetails)}
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
          >
            <Wrench className="h-4 w-4 text-indigo-500" />
            <span>{showFixDetails ? 'Hide Diagnostics' : 'Show Diagnostics'}</span>
          </button>
        </div>
      </div>

      {/* AUTO-RESOLVE NOTIFICATION BANNER */}
      {resolveNotification && (
        <div className="bg-emerald-50 dark:bg-emerald-950/80 border-2 border-emerald-400 dark:border-emerald-700 p-4 rounded-2xl flex items-start justify-between gap-3 shadow-md animate-in fade-in duration-300">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-emerald-950 dark:text-emerald-100">
                  {resolveNotification.title}
                </h4>
                <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
                  {resolveNotification.timestamp}
                </span>
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-200 mt-0.5 leading-relaxed font-light">
                {resolveNotification.details}
              </p>
            </div>
          </div>

          <button
            onClick={() => setResolveNotification(null)}
            className="p-1 text-emerald-700 hover:text-emerald-950 dark:text-emerald-300 hover:bg-emerald-200/50 rounded-lg cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* STATS SUMMARY BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700">
          <span className="block text-[10px] font-mono font-bold text-gray-400 uppercase">Effective Radius</span>
          <span className="font-mono text-base font-black text-gray-900 dark:text-white">
            0.0 – {effectiveMaxKm} KM
          </span>
        </div>

        <div className={`p-3.5 rounded-xl border ${
          analysis.gapKmCount > 0
            ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900 text-rose-950 dark:text-rose-200'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}>
          <span className="block text-[10px] font-mono font-bold text-gray-400 uppercase">Fragmented Gap Distance</span>
          <span className={`font-mono text-base font-black ${analysis.gapKmCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'}`}>
            {analysis.gapKmCount.toFixed(1)} KM
          </span>
        </div>

        <div className={`p-3.5 rounded-xl border ${
          analysis.overlapKmCount > 0
            ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900 text-rose-950 dark:text-rose-200'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}>
          <span className="block text-[10px] font-mono font-bold text-gray-400 uppercase">Overlapping Radius</span>
          <span className={`font-mono text-base font-black ${analysis.overlapKmCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'}`}>
            {analysis.overlapKmCount.toFixed(1)} KM
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700">
          <span className="block text-[10px] font-mono font-bold text-gray-400 uppercase">Coverage Efficiency</span>
          <span className="font-mono text-base font-black text-indigo-600 dark:text-indigo-400">
            {analysis.coveragePercentage}%
          </span>
        </div>
      </div>

      {/* REAL-TIME DISTANCE SPECTRUM CANVAS & HIGH-VISIBILITY RED CONFLICT MAP */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700/80 pb-3">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h4 className="font-display text-sm font-bold text-gray-950 dark:text-white uppercase tracking-wider">
              Interactive Radius Spectrum Canvas (0 KM – {effectiveMaxKm} KM)
            </h4>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono font-semibold">
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <span className="h-3 w-3 rounded bg-emerald-500 inline-block"></span> Active Zone
            </span>
            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
              <span className="h-3 w-3 rounded bg-rose-600 animate-pulse inline-block"></span> Overlap (Red)
            </span>
            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
              <span className="h-3 w-3 rounded bg-rose-950/20 border border-dashed border-rose-500 inline-block"></span> Gap (Red)
            </span>
          </div>
        </div>

        {/* SPECTRUM STACK VISUALIZER */}
        <div className="relative pt-2 pb-6">
          {/* Main Spectrum Container */}
          <div className="relative h-16 w-full bg-gray-100 dark:bg-gray-900 rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 flex shadow-inner">
            
            {/* Render Conflict Highlights (Gaps & Overlaps) as absolute overlays */}
            {analysis.conflicts.map(conflict => {
              const leftPct = (conflict.startKm / effectiveMaxKm) * 100;
              const widthPct = Math.max(1, ((conflict.endKm - conflict.startKm) / effectiveMaxKm) * 100);

              if (conflict.type === 'overlap') {
                return (
                  <div
                    key={`vis-overlap-${conflict.id}`}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    onClick={() => setSelectedConflictId(conflict.id)}
                    className="absolute top-0 bottom-0 z-30 bg-rose-600/90 text-white border-2 border-rose-400 cursor-pointer flex flex-col items-center justify-center p-1 font-mono font-black text-[10px] text-center shadow-lg animate-pulse hover:scale-105 transition-transform"
                    title={`🔴 OVERLAP CONFLICT: ${conflict.startKm.toFixed(1)} - ${conflict.endKm.toFixed(1)} KM. Click to view fix.`}
                  >
                    <span className="bg-black/40 px-1 rounded truncate">🔴 OVERLAP</span>
                    <span className="text-[8.5px] truncate">{conflict.startKm.toFixed(1)}-{conflict.endKm.toFixed(1)} KM</span>
                  </div>
                );
              }

              if (conflict.type === 'gap' || conflict.type === 'origin_gap' || conflict.type === 'outer_gap') {
                return (
                  <div
                    key={`vis-gap-${conflict.id}`}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    onClick={() => setSelectedConflictId(conflict.id)}
                    className="absolute top-0 bottom-0 z-30 bg-rose-950/80 dark:bg-rose-950/90 border-2 border-dashed border-rose-500 text-rose-300 cursor-pointer flex flex-col items-center justify-center p-1 font-mono font-bold text-[10px] text-center hover:bg-rose-900 transition-colors"
                    title={`🔴 FRAGMENTED GAP: ${conflict.startKm.toFixed(1)} - ${conflict.endKm.toFixed(1)} KM. Click to view fix.`}
                  >
                    <span className="text-rose-400 font-extrabold truncate">🔴 GAP UNCOVERED</span>
                    <span className="text-[8.5px] text-rose-300 truncate">{conflict.startKm.toFixed(1)}-{conflict.endKm.toFixed(1)} KM</span>
                  </div>
                );
              }

              return null;
            })}

            {/* Render Active Zones in the background layer */}
            {activeZones.map((zone, idx) => {
              const leftPct = (zone.minDistanceKm / effectiveMaxKm) * 100;
              const widthPct = Math.max(1, ((zone.maxDistanceKm - zone.minDistanceKm) / effectiveMaxKm) * 100);
              const zoneConflicts = getZoneConflicts(zone.id);
              const hasCriticalConflict = zoneConflicts.some(c => c.severity === 'critical');

              const bgPalette = [
                'bg-emerald-600 text-emerald-50 border-emerald-500',
                'bg-indigo-600 text-indigo-50 border-indigo-500',
                'bg-cyan-600 text-cyan-50 border-cyan-500',
                'bg-amber-600 text-amber-50 border-amber-500'
              ];
              const zoneColor = hasCriticalConflict
                ? 'bg-rose-700/80 text-rose-100 border-rose-500'
                : bgPalette[idx % bgPalette.length];

              return (
                <div
                  key={`vis-zone-${zone.id}`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  className={`absolute top-0 bottom-0 z-10 border-r-2 flex flex-col justify-between p-1.5 transition-all group ${zoneColor}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-[11px] truncate font-sans">{zone.name}</span>
                    {hasCriticalConflict && (
                      <span className="bg-red-500 text-white text-[8px] font-black px-1 rounded animate-bounce shrink-0">
                        CONFLICT
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-end text-[9px] font-mono opacity-90">
                    <span>{zone.minDistanceKm} KM</span>
                    <span>KES {zone.baseFee}</span>
                    <span>{zone.maxDistanceKm} KM</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Distance Axis Scale Numbers */}
          <div className="relative mt-2 h-6 w-full">
            {distanceTicks.map(tick => {
              const tickPct = (tick / effectiveMaxKm) * 100;
              return (
                <div
                  key={`tick-${tick}`}
                  style={{ left: `${tickPct}%` }}
                  className="absolute -translate-x-1/2 flex flex-col items-center"
                >
                  <div className="h-2 w-0.5 bg-gray-300 dark:bg-gray-700"></div>
                  <span className="text-[10px] font-mono font-bold text-gray-400">
                    {tick}k
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* DIAGNOSTICS & SMART SUGGESTION CONFLICT RESOLUTION CARDS */}
      {showFixDetails && analysis.conflicts.length > 0 && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-2">
            <h4 className="font-display text-sm font-bold text-gray-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600" />
              Conflict Diagnosis & Recommended Fixes ({analysis.conflicts.length})
            </h4>
            <span className="text-xs text-gray-400 font-mono">
              Click any 'Apply Fix' button to resolve instantly
            </span>
          </div>

          <div className="space-y-4">
            {analysis.conflicts.map(conflict => {
              const isSelected = selectedConflictId === conflict.id;

              return (
                <div
                  key={`card-${conflict.id}`}
                  className={`p-5 rounded-2xl border transition-all ${
                    conflict.severity === 'critical'
                      ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900 shadow-xs'
                      : 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900 shadow-xs'
                  } ${isSelected ? 'ring-2 ring-rose-500 scale-[1.01]' : ''}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-rose-600 text-white shrink-0 font-bold">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div>
                        <h5 className="font-display font-bold text-sm text-gray-950 dark:text-white">
                          {conflict.title}
                        </h5>
                        <p className="text-xs text-gray-700 dark:text-gray-300 font-light mt-0.5 leading-relaxed">
                          {conflict.description}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="inline-block px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-900 text-rose-900 dark:text-rose-200 font-mono text-xs font-black border border-rose-300 dark:border-rose-800">
                        {conflict.startKm.toFixed(1)} KM – {conflict.endKm.toFixed(1)} KM
                      </span>
                    </div>
                  </div>

                  {/* SUGGESTED FIX ACTION BUTTONS */}
                  <div className="mt-4 space-y-2">
                    <span className="block text-[10px] font-mono font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-indigo-500" /> Suggested Resolution Actions:
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {conflict.suggestedFixes.map((fix, fIdx) => (
                        <div
                          key={`fix-${fIdx}`}
                          className="bg-white dark:bg-gray-900 p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 flex flex-col justify-between gap-3 shadow-2xs hover:border-indigo-400 transition-colors"
                        >
                          <div>
                            <span className="font-bold text-xs text-gray-950 dark:text-white block">
                              Option #{fIdx + 1}: {fix.label}
                            </span>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-light mt-1 leading-snug">
                              {fix.description}
                            </p>
                          </div>

                          <button
                            onClick={fix.action}
                            className="w-full inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                          >
                            <Check className="h-3.5 w-3.5" /> Apply Fix
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* REAL-TIME ZONE DISTANCE SLIDER TESTING LIST */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700/80 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h4 className="font-display text-sm font-bold text-gray-950 dark:text-white uppercase tracking-wider">
              Live Zone Radius Tuning Sliders
            </h4>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            Adjust min/max sliders to watch validation update instantly
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {zones.map((zone) => {
            const zConflicts = getZoneConflicts(zone.id);
            const isHasConflict = zConflicts.length > 0;

            return (
              <div
                key={`slider-card-${zone.id}`}
                className={`p-4 rounded-xl border transition-all space-y-3 ${
                  isHasConflict
                    ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900 ring-1 ring-rose-400'
                    : 'bg-gray-50 dark:bg-gray-900/60 border-gray-200 dark:border-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-xs text-gray-950 dark:text-white flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-indigo-500" /> {zone.name}
                    </h5>
                    <span className="text-[10px] text-gray-400 font-mono">
                      Fee: KES {zone.baseFee} + KES {zone.perKmRate}/KM
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      isHasConflict
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    {isHasConflict ? `🔴 ${zConflicts.length} Conflict` : '🟢 Seamless'}
                  </span>
                </div>

                {/* Range Sliders */}
                <div className="space-y-2 pt-1 text-xs font-mono">
                  <div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500">Min Distance:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{zone.minDistanceKm} KM</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={effectiveMaxKm}
                      step={0.5}
                      value={zone.minDistanceKm}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const updated = zones.map(z => z.id === zone.id ? { ...z, minDistanceKm: Math.min(val, zone.maxDistanceKm - 0.5) } : z);
                        onUpdateZones(updated);
                      }}
                      className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500">Max Distance:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{zone.maxDistanceKm} KM</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={effectiveMaxKm}
                      step={0.5}
                      value={zone.maxDistanceKm}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const updated = zones.map(z => z.id === zone.id ? { ...z, maxDistanceKm: Math.max(val, zone.minDistanceKm + 0.5) } : z);
                        onUpdateZones(updated);
                      }}
                      className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ZoneValidationVisualizer;
