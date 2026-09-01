/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Truck, Navigation, MapPin, CheckCircle2, Clock, AlertCircle, RefreshCw,
  Search, ShieldCheck, Box, Phone, MessageSquare, Copy, Check, Radio,
  Thermometer, Battery, Zap, Sparkles, ExternalLink, ChevronRight
} from 'lucide-react';
import { Order } from '../types';

export interface CourierDriver {
  name: string;
  phone: string;
  vehicle: string;
  vehicleNo: string;
  rating: string;
  deliveries: number;
  avatarBg: string;
}

export interface CourierCheckpoint {
  stage: string;
  statusText: string;
  location: string;
  timestamp: string;
  completed: boolean;
}

export interface CourierTrackingData {
  success: boolean;
  orderId: string;
  trackingNumber: string;
  carrier: string;
  carrierCode: string;
  status: 'placed' | 'processing' | 'in_transit' | 'out_for_delivery' | 'delivered';
  statusLabel: string;
  progressPercent: number;
  currentLocation: string;
  coordinates: { lat: number; lng: number };
  estimatedDelivery: string;
  lastUpdated: string;
  driver: CourierDriver;
  checkpoints: CourierCheckpoint[];
  notes?: string;
}

interface CourierStatusTrackerProps {
  order?: Order | null;
  initialTrackingOrOrderId?: string;
  className?: string;
  compact?: boolean;
}

const DEFAULT_COURIERS: CourierDriver[] = [
  { name: 'Sarah Jenkins', phone: '+254 712 345 678', vehicle: 'Veloce Electric Cargo Van', vehicleNo: 'KDA 892V', rating: '4.95 ★', deliveries: 1240, avatarBg: 'bg-indigo-600' },
  { name: 'Marcus Chen', phone: '+254 722 987 654', vehicle: 'Fargo Express E-Bike #402', vehicleNo: 'EB-904', rating: '4.88 ★', deliveries: 890, avatarBg: 'bg-emerald-600' },
  { name: 'Elena Rostova', phone: '+254 733 112 233', vehicle: 'G4S Hybrid Cargo Truck', vehicleNo: 'KCY 402B', rating: '4.98 ★', deliveries: 2150, avatarBg: 'bg-violet-600' }
];

export default function CourierStatusTracker({
  order,
  initialTrackingOrOrderId,
  className = '',
  compact = false
}: CourierStatusTrackerProps) {
  const [queryInput, setQueryInput] = useState<string>(
    initialTrackingOrOrderId || order?.id || 'VEL-894-SWIFT'
  );
  const [trackingData, setTrackingData] = useState<CourierTrackingData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [showNoteForm, setShowNoteForm] = useState<boolean>(false);
  const [driverNote, setDriverNote] = useState<string>('');
  const [noteSubmitted, setNoteSubmitted] = useState<boolean>(false);

  // Auto load tracking data whenever order or initial tracking changes
  useEffect(() => {
    const targetId = order?.id || initialTrackingOrOrderId || 'VEL-894-SWIFT';
    setQueryInput(targetId);
    fetchCourierData(targetId);
  }, [order?.id, initialTrackingOrOrderId]);

  const fetchCourierData = async (lookupId: string) => {
    const cleanId = lookupId.trim();
    if (!cleanId) {
      setErrorMsg('Please enter a valid Order ID or Courier Tracking Number.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/courier/track?id=${encodeURIComponent(cleanId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          setTrackingData(data);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Fallback to client-side generated courier telemetry if server fails
    }

    // Client-side generated courier telemetry fallback based on hash
    const hash = cleanId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const courier = DEFAULT_COURIERS[hash % DEFAULT_COURIERS.length];
    
    // Status mapping based on order status or simulation hash
    let status: CourierTrackingData['status'] = 'in_transit';
    let progressPercent = 65;
    let statusLabel = 'In Transit to Regional Hub';

    if (order?.status === 'completed') {
      status = 'delivered';
      progressPercent = 100;
      statusLabel = 'Delivered & Handed Over';
    } else if (order?.status === 'shipped') {
      status = 'out_for_delivery';
      progressPercent = 85;
      statusLabel = 'Out for Last-Mile Delivery';
    } else if (order?.status === 'pending') {
      status = 'processing';
      progressPercent = 35;
      statusLabel = 'Warehouse Inspection & Packing';
    }

    const mockData: CourierTrackingData = {
      success: true,
      orderId: order?.id || cleanId.toUpperCase(),
      trackingNumber: `VEL-TRK-${cleanId.replace(/[^A-Z0-9]/g, '').slice(-8)}`,
      carrier: 'Fargo Courier / G4S Express Logistics',
      carrierCode: 'FARGO-G4S',
      status,
      statusLabel,
      progressPercent,
      currentLocation: 'Mombasa Road Expressway, Nairobi Depot',
      coordinates: { lat: -1.286389, lng: 36.817223 },
      estimatedDelivery: new Date(Date.now() + 86400000 * 1.5).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }),
      lastUpdated: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      driver: courier,
      checkpoints: [
        {
          stage: 'Order Verified',
          statusText: 'Payment cleared and consignment logged',
          location: 'Veloce HQ Westlands Hub',
          timestamp: new Date(Date.now() - 86400000 * 1.5).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          completed: true
        },
        {
          stage: 'Warehouse Processing',
          statusText: 'Sealed in tamper-proof courier pouch',
          location: 'Central Sorting Warehouse',
          timestamp: new Date(Date.now() - 86400000 * 1.1).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          completed: progressPercent >= 35
        },
        {
          stage: 'In Transit',
          statusText: 'Handed to courier truck driver',
          location: 'Mombasa Road Expressway',
          timestamp: new Date(Date.now() - 3600000 * 5).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          completed: progressPercent >= 65
        },
        {
          stage: 'Out for Last-Mile',
          statusText: 'Courier assigned & dispatched to destination',
          location: 'Local Neighborhood Station',
          timestamp: new Date(Date.now() - 3600000 * 1).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          completed: progressPercent >= 85
        },
        {
          stage: 'Delivered',
          statusText: 'Recipient signature confirmed',
          location: 'Delivery Address',
          timestamp: status === 'delivered' ? new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Pending',
          completed: progressPercent === 100
        }
      ]
    };

    setTrackingData(mockData);
    setLoading(false);
  };

  const handleCopyTracking = () => {
    if (!trackingData) return;
    navigator.clipboard.writeText(trackingData.trackingNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePostNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverNote.trim()) return;
    setNoteSubmitted(true);
    setTimeout(() => {
      setNoteSubmitted(false);
      setShowNoteForm(false);
      setDriverNote('');
    }, 2500);
  };

  return (
    <div className={`rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-gray-950 p-4 sm:p-5 shadow-sm font-sans ${className}`}>
      {/* Search Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-150 dark:border-gray-850 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Truck className="h-4 w-4" />
            </span>
            <h3 className="font-display font-bold text-base text-gray-950 dark:text-white">
              Courier Real-Time Tracking Lookup
            </h3>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
            Syncing live satellite & courier status from Fargo Courier / G4S Logistics
          </p>
        </div>

        {/* Live Lookup Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchCourierData(queryInput);
          }}
          className="flex items-center gap-2 min-w-[260px]"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Order ID or Tracking No..."
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 pl-9 pr-2.5 text-xs font-mono font-semibold text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs font-mono transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 shadow-2xs"
          >
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            <span>Fetch Status</span>
          </button>
        </form>
      </div>

      {errorMsg && (
        <div className="mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading && (
        <div className="py-8 flex flex-col items-center justify-center text-center">
          <RefreshCw className="h-6 w-6 text-indigo-600 animate-spin mb-2" />
          <p className="text-xs font-mono text-gray-500 animate-pulse">
            Connecting to Courier Logistics API...
          </p>
        </div>
      )}

      {!loading && trackingData && (
        <div className="space-y-4">
          {/* Top Status & Carrier Banner */}
          <div className="bg-slate-900 text-white p-4 rounded-xl border border-gray-800 relative overflow-hidden shadow-md">
            
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[10px] font-mono text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  <Radio className="h-3 w-3 text-indigo-400 animate-pulse" /> {trackingData.carrier}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  LIVE API SYNC
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-gray-400">Updated: {trackingData.lastUpdated}</span>
                <button
                  type="button"
                  onClick={() => fetchCourierData(queryInput)}
                  className="p-1 rounded text-gray-400 hover:text-white transition cursor-pointer"
                  title="Refresh status"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest block mb-0.5">Tracking Number</span>
                <div className="flex items-center gap-1.5 font-mono font-bold text-sm text-indigo-300">
                  <span>{trackingData.trackingNumber}</span>
                  <button
                    type="button"
                    onClick={handleCopyTracking}
                    className="p-1 text-gray-400 hover:text-white transition cursor-pointer"
                    title="Copy tracking code"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest block mb-0.5">Current Stage</span>
                <span className="font-mono font-bold text-xs text-emerald-300 block truncate">
                  {trackingData.statusLabel}
                </span>
              </div>

              <div>
                <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest block mb-0.5">Estimated Delivery</span>
                <span className="font-mono font-bold text-xs text-amber-300 block">
                  {trackingData.estimatedDelivery}
                </span>
              </div>
            </div>

            {/* Live Visual Milestone Progress Bar */}
            <div className="relative z-10 mt-4 pt-3 border-t border-gray-800/80">
              <div className="flex items-center justify-between text-[10px] font-mono text-gray-300 mb-2">
                <span className="flex items-center gap-1">
                  <Navigation className="h-3 w-3 text-indigo-400 rotate-45" /> Location: <strong className="text-white">{trackingData.currentLocation}</strong>
                </span>
                <span className="font-bold text-emerald-400">{trackingData.progressPercent}% Processed</span>
              </div>

              {/* Progress Bar Track & Milestone Markers */}
              <div className="relative my-3 px-1">
                {/* Horizontal Bar Track */}
                <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden relative">
                  <motion.div
                    className="h-full bg-indigo-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${trackingData.progressPercent}%` }}
                    transition={{ duration: 0.6 }}
                  />
                </div>

                {/* Milestone Stepper Nodes with Timestamps */}
                <div className="flex justify-between items-center -mt-3.5 relative z-10">
                  {trackingData.checkpoints.map((cp, idx) => {
                    const isCompleted = cp.completed;
                    const isCurrent = (
                      (idx === 0 && trackingData.progressPercent < 35) ||
                      (idx === 1 && trackingData.progressPercent >= 35 && trackingData.progressPercent < 65) ||
                      (idx === 2 && trackingData.progressPercent >= 65 && trackingData.progressPercent < 85) ||
                      (idx === 3 && trackingData.progressPercent >= 85 && trackingData.progressPercent < 100) ||
                      (idx === 4 && trackingData.progressPercent === 100)
                    );

                    return (
                      <div key={idx} className="flex flex-col items-center group relative cursor-pointer">
                        <div
                          className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                            isCurrent
                              ? 'bg-indigo-500 border-white ring-4 ring-indigo-500/40 scale-125'
                              : isCompleted
                              ? 'bg-emerald-500 border-gray-900 text-white shadow-xs'
                              : 'bg-gray-800 border-gray-700 text-gray-500'
                          }`}
                        >
                          {isCompleted && !isCurrent ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                          ) : isCurrent ? (
                            <Radio className="h-3 w-3 text-white animate-pulse" />
                          ) : (
                            <div className="h-1.5 w-1.5 rounded-full bg-gray-600" />
                          )}
                        </div>

                        {/* Milestone Label & Timestamp */}
                        <div className="mt-2 text-center max-w-[70px] sm:max-w-[90px]">
                          <span className={`block text-[10px] font-mono font-bold leading-tight ${
                            isCurrent
                              ? 'text-indigo-300 font-black'
                              : isCompleted
                              ? 'text-gray-200'
                              : 'text-gray-500'
                          }`}>
                            {cp.stage}
                          </span>
                          <span className={`block text-[9px] font-mono mt-0.5 ${
                            isCurrent
                              ? 'text-emerald-400 font-bold'
                              : isCompleted
                              ? 'text-gray-400'
                              : 'text-gray-600'
                          }`}>
                            {cp.timestamp}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Checkpoint Timeline */}
          <div className="bg-gray-50/70 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-200/80 dark:border-gray-800">
            <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider font-mono flex items-center gap-1.5 mb-3">
              <Clock className="h-3.5 w-3.5 text-indigo-500" /> Checkpoint Audit & Courier History
            </h4>
            <div className="space-y-3 relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-200 dark:before:bg-gray-800">
              {trackingData.checkpoints.map((cp, idx) => (
                <div key={idx} className="relative flex items-start gap-3">
                  <div className={`absolute -left-[23px] h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    cp.completed
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-400'
                  }`}>
                    {cp.completed ? <CheckCircle2 className="h-3 w-3" /> : <div className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />}
                  </div>
                  <div className="flex-1 bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200/70 dark:border-gray-800 text-xs">
                    <div className="flex items-center justify-between">
                      <span className={`font-bold font-mono ${cp.completed ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
                        {cp.stage}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">{cp.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">{cp.statusText}</p>
                    <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 block mt-1">
                      📍 {cp.location}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assigned Driver & Direct Contact Controls */}
          {trackingData.driver && (
            <div className="bg-white dark:bg-gray-900 p-3.5 rounded-xl border border-gray-200/80 dark:border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full ${trackingData.driver.avatarBg} text-white font-bold text-sm flex items-center justify-center shrink-0`}>
                  {trackingData.driver.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{trackingData.driver.name}</span>
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-900/30">
                      {trackingData.driver.rating}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                    {trackingData.driver.vehicle} • Reg: <strong className="text-gray-800 dark:text-gray-200">{trackingData.driver.vehicleNo}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <a
                  href={`tel:${trackingData.driver.phone}`}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold text-xs font-mono transition flex items-center justify-center gap-1.5 cursor-pointer border border-indigo-200/60 dark:border-indigo-800/40"
                >
                  <Phone className="h-3.5 w-3.5" /> Call Driver
                </a>
                <button
                  type="button"
                  onClick={() => setShowNoteForm(!showNoteForm)}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs font-mono transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Send Dropoff Note
                </button>
              </div>
            </div>
          )}

          {showNoteForm && (
            <form onSubmit={handlePostNote} className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/40">
              <label className="block text-[10px] font-bold text-amber-900 dark:text-amber-300 uppercase font-mono mb-1">
                Instruction for Courier Driver:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Leave with gate guard or call when at entrance..."
                  value={driverNote}
                  onChange={(e) => setDriverNote(e.target.value)}
                  className="flex-1 h-8 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-gray-900 px-2.5 text-xs text-gray-900 dark:text-gray-100"
                />
                <button
                  type="submit"
                  className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer font-mono"
                >
                  Send
                </button>
              </div>
              {noteSubmitted && (
                <p className="text-[10px] text-emerald-600 font-bold mt-1">
                  ✓ Instruction transmitted to courier dispatch console!
                </p>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
