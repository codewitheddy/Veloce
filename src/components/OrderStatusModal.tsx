/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Search, Truck, MapPin, CheckCircle2, Clock, AlertCircle, RefreshCw,
  Sparkles, Navigation, User, ShieldCheck, Box, Package, Phone, MessageSquare,
  Copy, Check, Share2, Compass, Radio, Thermometer, Battery, Zap, ArrowRight,
  Play, Info, ChevronRight, CheckCircle
} from 'lucide-react';
import { Order, Product } from '../types';
import { CurrencyType, formatPrice } from '../lib/currency';

interface OrderStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  products: Product[];
  initialOrderId?: string | null;
  currency?: CurrencyType;
}

interface Courier {
  name: string;
  phone: string;
  vehicle: string;
  vehicleNo: string;
  rating: string;
  deliveries: number;
  avatarBg: string;
}

const COURIERS: Courier[] = [
  { name: 'Sarah Jenkins', phone: '+254 712 345 678', vehicle: 'Veloce Electric Cargo Van', vehicleNo: 'KDA 892V', rating: '4.95 ★', deliveries: 1240, avatarBg: 'bg-indigo-600' },
  { name: 'Marcus Chen', phone: '+254 722 987 654', vehicle: 'Eco-Express E-Bike #402', vehicleNo: 'EB-904', rating: '4.88 ★', deliveries: 890, avatarBg: 'bg-emerald-600' },
  { name: 'Elena Rostova', phone: '+254 733 112 233', vehicle: 'Swift-Cargo Hybrid Truck', vehicleNo: 'KCY 402B', rating: '4.98 ★', deliveries: 2150, avatarBg: 'bg-violet-600' }
];

interface Checkpoint {
  stage: string;
  location: string;
  timestamp: string;
  statusText: string;
  completed: boolean;
}

export default function OrderStatusModal({
  isOpen,
  onClose,
  orders,
  products,
  initialOrderId,
  currency = 'KSh',
}: OrderStatusModalProps) {
  const [searchId, setSearchId] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [isSimulated, setIsSimulated] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDriverContact, setShowDriverContact] = useState(false);
  const [driverInstruction, setDriverInstruction] = useState('');
  const [instructionSaved, setInstructionSaved] = useState(false);

  // Simulation Step states (0 to 4)
  // 0: Placed, 1: Processing, 2: In Transit, 3: Out for Delivery, 4: Delivered
  const [simStep, setSimStep] = useState(2);
  const [selectedCourier, setSelectedCourier] = useState<Courier>(COURIERS[0]);
  const [apiCheckpoints, setApiCheckpoints] = useState<Checkpoint[] | null>(null);
  const [carrierName, setCarrierName] = useState('Fargo Courier / Veloce Express');

  // Handle setting initial tracking order if provided
  useEffect(() => {
    if (isOpen) {
      if (initialOrderId) {
        setSearchId(initialOrderId);
        handleTrackOrder(initialOrderId);
      } else if (orders.length > 0) {
        setSearchId(orders[0].id);
        handleTrackOrder(orders[0].id);
      } else {
        setSearchId('');
        setTrackedOrder(null);
      }
    }
  }, [isOpen, initialOrderId]);

  if (!isOpen) return null;

  const fetchServerTracking = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/track/${encodeURIComponent(orderId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.checkpoints) {
          setCarrierName(data.carrier || 'Fargo Courier / Veloce Express');
          return data;
        }
      }
    } catch {
      // Ignore network errors and fallback to local simulation
    }
    return null;
  };

  const handleTrackOrder = async (orderId: string) => {
    const trimmedId = orderId.trim();
    if (!trimmedId) {
      setErrorMsg('Please enter a valid Order ID.');
      return;
    }

    // Try server tracking first
    const serverData = await fetchServerTracking(trimmedId);

    // Search real orders list
    const found = orders.find(
      (o) => o.id.toLowerCase() === trimmedId.toLowerCase()
    );

    if (found) {
      setTrackedOrder(found);
      setIsSimulated(false);
      setErrorMsg('');

      if (found.status === 'completed') {
        setSimStep(4);
      } else if (found.status === 'cancelled') {
        setSimStep(0);
      } else {
        setSimStep(2);
      }

      const hash = trimmedId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      setSelectedCourier(COURIERS[hash % COURIERS.length]);
    } else if (serverData) {
      setTrackedOrder(serverData);
      setIsSimulated(false);
      setErrorMsg('');
      const hash = trimmedId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      setSelectedCourier(COURIERS[hash % COURIERS.length]);
      setSimStep(serverData.status === 'completed' ? 4 : (serverData.status === 'cancelled' ? 0 : 2));
    } else {
      setTrackedOrder(null);
      setIsSimulated(false);
      setErrorMsg(`No active order found matching "${trimmedId}". Please check your order reference and try again.`);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      if (simStep < 4) {
        setSimStep((prev) => prev + 1);
      } else {
        setSimStep(4);
      }
    }, 700);
  };

  const handleCopyTracking = () => {
    if (!trackedOrder) return;
    navigator.clipboard.writeText(`https://veloce.io/track/${trackedOrder.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveInstruction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverInstruction.trim()) return;
    setInstructionSaved(true);
    setTimeout(() => setInstructionSaved(false), 3000);
  };

  const steps = [
    { title: 'Order Confirmed', desc: 'Verified & assigned to dispatch hub', icon: CheckCircle2, loc: 'Westlands Central Depot' },
    { title: 'Processing & Packaged', desc: 'Inspected and sealed in tamper-proof container', icon: Package, loc: 'Main Logistics Hub' },
    { title: 'In Transit', desc: 'Departed regional sorting terminal', icon: Truck, loc: 'Mombasa Road Expressway' },
    { title: 'Out for Last-Mile Delivery', desc: 'Courier dispatched to your neighborhood', icon: Navigation, loc: 'Local Dispatch Zone' },
    { title: 'Delivered & Handed Over', desc: 'Dropoff completed with recipient signature', icon: MapPin, loc: 'Recipient Address' }
  ];

  const getMilestoneTimestamp = (stepIdx: number) => {
    if (!trackedOrder) return 'Pending';
    const baseDate = new Date(trackedOrder.date || Date.now());
    if (isNaN(baseDate.getTime())) {
      baseDate.setTime(Date.now() - 86400000);
    }
    const offsetsInHours = [0, 4, 18, 28, 36];
    const targetDate = new Date(baseDate.getTime() + offsetsInHours[stepIdx] * 3600 * 1000);

    if (simStep > stepIdx) {
      return targetDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } else if (simStep === stepIdx) {
      return `Current • ${targetDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return `Est. ${targetDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' })}`;
    }
  };

  const getStepStatus = (index: number) => {
    if (simStep > index) return 'completed';
    if (simStep === index) return 'active';
    return 'pending';
  };

  const getEstimatedDelivery = () => {
    if (!trackedOrder) return '';
    const baseDate = new Date(trackedOrder.date);
    if (simStep === 4) {
      return `Delivered on ${baseDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at 11:42 AM`;
    }
    baseDate.setDate(baseDate.getDate() + 1);
    const formatted = baseDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    return `Estimated Delivery: ${formatted} by 4:30 PM`;
  };

  return (
    <div id="order-status-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5">
      {/* Backdrop overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-gray-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col md:flex-row h-[92vh] md:h-auto max-h-[92vh] z-10"
      >
        {/* Left Sidebar: Live Telemetry, GPS Map & Courier Panel */}
        <div className="w-full md:w-5/12 bg-gray-50/90 dark:bg-gray-950/60 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto">
          <div>
            {/* Header Badge */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                <Truck className="h-4 w-4" />
                <span className="font-mono text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                  Satellite Telemetry
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> GPS LOCKED
              </span>
            </div>

            <h3 className="font-display font-black text-xl text-gray-950 dark:text-white leading-tight mb-3">
              Real-Time Parcel Locator
            </h3>

            {/* Tracking Search Form */}
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter Order ID..."
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTrackOrder(searchId)}
                  className="h-10 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 pl-9 pr-3 text-xs font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 shadow-2xs"
                />
              </div>
              <button
                type="button"
                onClick={() => handleTrackOrder(searchId)}
                className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
              >
                Track
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {isSimulated && trackedOrder && (
              <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2 leading-relaxed">
                <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Sandbox Mode:</span> Tracking order <span className="font-mono bg-amber-500/20 px-1 py-0.5 rounded font-bold">{trackedOrder.id}</span>. Tap Refresh to advance status.
                </div>
              </div>
            )}

            {trackedOrder && (
              <div className="space-y-3.5">
                {/* Interactive Simulated GPS Radar Display */}
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-900 text-white p-4 relative overflow-hidden shadow-md">
                  {/* Grid overlay */}
                  
                  
                  <div className="relative z-10 flex items-center justify-between text-[10px] font-mono text-gray-400 mb-2.5 border-b border-gray-800 pb-2">
                    <span className="flex items-center gap-1">
                      <Radio className="h-3 w-3 text-indigo-400 animate-pulse" /> {carrierName}
                    </span>
                    <span className="text-indigo-400 font-bold">5G TELEMETRY</span>
                  </div>

                  {/* Route Visualizer with Milestone Nodes & Timestamps */}
                  <div className="relative my-4 px-2">
                    {/* Line */}
                    <div className="h-1.5 bg-gray-800 rounded-full w-full overflow-hidden relative">
                      <motion.div
                        className="bg-indigo-600 h-full rounded-full"
                        animate={{ width: `${(simStep / 4) * 100}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>

                    {/* Nodes along line */}
                    <div className="flex justify-between items-center -mt-3 relative z-10">
                      {[0, 1, 2, 3, 4].map((stepIdx) => {
                        const isDone = simStep >= stepIdx;
                        const isCurrent = simStep === stepIdx;
                        const milestoneTs = getMilestoneTimestamp(stepIdx);

                        return (
                          <div
                            key={stepIdx}
                            onClick={() => setSimStep(stepIdx)}
                            className="flex flex-col items-center group cursor-pointer"
                            title={`Jump to Stage ${stepIdx + 1}: ${steps[stepIdx].title} (${milestoneTs})`}
                          >
                            <div
                              className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                isCurrent
                                  ? 'bg-indigo-500 border-white ring-4 ring-indigo-500/40 scale-125'
                                  : isDone
                                  ? 'bg-emerald-500 border-gray-900 text-white'
                                  : 'bg-gray-800 border-gray-700'
                              }`}
                            >
                              {isDone && !isCurrent && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                              {isCurrent && <Navigation className="h-2.5 w-2.5 text-white rotate-45" />}
                            </div>
                            <span className={`text-[9px] font-mono mt-1 ${isCurrent ? 'text-indigo-300 font-bold' : isDone ? 'text-gray-300' : 'text-gray-600'}`}>
                              {stepIdx === 0 ? 'Placed' : stepIdx === 1 ? 'Packed' : stepIdx === 2 ? 'Transit' : stepIdx === 3 ? 'Out' : 'Done'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Radar Status Badge */}
                  <div className="relative z-10 bg-gray-950/80 rounded-xl p-2.5 border border-gray-800 flex items-center justify-between text-[11px] font-mono mt-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-gray-200 font-bold">{steps[simStep].title}</span>
                    </div>
                    <span className="text-gray-400 text-[10px]">{steps[simStep].loc}</span>
                  </div>

                  {/* Telemetry Metrics Row */}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-gray-800/80 text-[10px] font-mono text-gray-400 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Zap className="h-3 w-3 text-amber-400" />
                      <span>{simStep === 4 ? '0 km/h' : '42 km/h'}</span>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Thermometer className="h-3 w-3 text-indigo-400" />
                      <span>19.5°C</span>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Battery className="h-3 w-3 text-emerald-400" />
                      <span>94%</span>
                    </div>
                  </div>
                </div>

                {/* Driver / Courier Contact Card */}
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2 mb-2.5">
                    <span className="text-[10px] font-mono font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                      Assigned Courier Node
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                      DISPATCH ACTIVE
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full ${selectedCourier.avatarBg} text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs`}>
                      {selectedCourier.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">{selectedCourier.name}</span>
                        <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.2 rounded-md">{selectedCourier.rating}</span>
                      </div>
                      <span className="block text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {selectedCourier.vehicle} • <span className="font-mono font-semibold">{selectedCourier.vehicleNo}</span>
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                    <a
                      href={`tel:${selectedCourier.phone}`}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Phone className="h-3.5 w-3.5" /> Call Driver
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowDriverContact(!showDriverContact)}
                      className="py-1.5 px-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> Note
                    </button>
                  </div>

                  {showDriverContact && (
                    <form onSubmit={handleSaveInstruction} className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800">
                      <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                        Delivery Instruction for Driver:
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="e.g. Leave with gate security guard..."
                          value={driverInstruction}
                          onChange={(e) => setDriverInstruction(e.target.value)}
                          className="flex-1 h-8 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-2.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="submit"
                          className="h-8 px-3 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors cursor-pointer"
                        >
                          Send
                        </button>
                      </div>
                      {instructionSaved && (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                          ✓ Instruction sent to courier console!
                        </p>
                      )}
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-gray-200 dark:border-gray-800 text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed font-mono">
            Encrypted Cargo Protocol • Fargo & Veloce Logistics Network
          </div>
        </div>

        {/* Right Pane: Delivery Timeline Stepper & Package Ledger */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto flex flex-col justify-between bg-white dark:bg-gray-900">
          <div>
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 mb-4 shrink-0">
              {trackedOrder ? (
                <div>
                  <span className="block text-[9px] font-mono font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    Consignment ID
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-mono font-bold text-gray-950 dark:text-white">
                      {trackedOrder.id}
                    </span>
                    <button
                      onClick={handleCopyTracking}
                      className="p-1 rounded-md text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                      title="Copy Tracking Link"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              ) : (
                <span className="text-sm font-bold text-gray-900 dark:text-white">No Active Order</span>
              )}

              <div className="flex items-center gap-2">
                {trackedOrder && (
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    title="Advance / Poll Satellite Status"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
                    <span>Poll Status</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  aria-label="Close Order Status Tracking Modal"
                  className="h-8 w-8 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {trackedOrder ? (
              <div className="space-y-5">
                {/* Delivery Status Banner */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50 p-4 shadow-2xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Live Checkpoint
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold font-mono uppercase ${
                      simStep === 4
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                    }`}>
                      {steps[simStep].title}
                    </span>
                  </div>
                  <h4 className="font-display font-black text-lg text-gray-950 dark:text-white leading-tight">
                    {getEstimatedDelivery()}
                  </h4>
                </div>

                {/* Vertical Interactive Stepper */}
                <div className="space-y-4 relative pl-7 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-200 dark:before:bg-gray-800">
                  {steps.map((step, idx) => {
                    const status = getStepStatus(idx);
                    const StepIcon = step.icon;
                    const timestampStr = getMilestoneTimestamp(idx);

                    return (
                      <div
                        key={idx}
                        onClick={() => setSimStep(idx)}
                        className="relative flex gap-3.5 items-start text-xs cursor-pointer group"
                      >
                        {/* Marker Circle */}
                        <div className={`absolute -left-[27px] h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                          status === 'completed'
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                            : status === 'active'
                            ? 'bg-white dark:bg-gray-900 border-indigo-600 text-indigo-600 shadow-md ring-4 ring-indigo-100 dark:ring-indigo-950 scale-110'
                            : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-400'
                        }`}>
                          <StepIcon className="h-3.5 w-3.5" />
                        </div>

                        <div className="flex-1 min-w-0 bg-gray-50/50 dark:bg-gray-950/30 p-2.5 rounded-xl border border-transparent group-hover:border-gray-200 dark:group-hover:border-gray-800 transition-all">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <div className="flex items-center gap-2">
                              <span className={`block font-bold ${
                                status === 'active'
                                  ? 'text-indigo-600 dark:text-indigo-400 font-black text-sm'
                                  : status === 'completed'
                                  ? 'text-gray-900 dark:text-gray-100'
                                  : 'text-gray-400'
                              }`}>
                                {step.title}
                              </span>
                              <span className={`px-2 py-0.2 rounded-full text-[9px] font-mono font-bold uppercase ${
                                status === 'completed'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                  : status === 'active'
                                  ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 animate-pulse'
                                  : 'bg-gray-100 dark:bg-gray-900 text-gray-400'
                              }`}>
                                {status === 'completed' ? '✓ Done' : status === 'active' ? '● In Progress' : '⏳ Pending'}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/30">
                              {timestampStr}
                            </span>
                          </div>
                          <p className={`text-[11px] mt-1 ${
                            status === 'active'
                              ? 'text-gray-700 dark:text-gray-300 font-medium'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {step.desc}
                          </p>
                          <span className="text-[10px] font-mono text-gray-400 block mt-0.5">
                            📍 {step.loc}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Parcel Contents List */}
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-2 text-[10px] font-mono font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    <span>Consignment Contents</span>
                    <span>{trackedOrder.items.length} Item(s)</span>
                  </div>

                  <div className="max-h-32 overflow-y-auto space-y-2 pr-1">
                    {trackedOrder.items.map((item, idx) => {
                      const pr = products.find((p) => p.id === item.productId);
                      return (
                        <div key={idx} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-950 p-2 rounded-xl border border-gray-200/60 dark:border-gray-800 text-xs">
                          <div className="h-9 w-9 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center shrink-0 overflow-hidden">
                            {pr?.imageUrl ? (
                              <img src={pr.imageUrl} alt={item.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Box className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="block font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {item.name}
                            </span>
                            <span className="block text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                              QTY: {item.quantity} × {formatPrice(item.price, currency)}
                            </span>
                          </div>
                          <div className="text-right font-mono font-bold text-gray-900 dark:text-white shrink-0">
                            {formatPrice(item.price * item.quantity, currency)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <Box className="h-10 w-10 text-gray-300 mb-2 animate-pulse" />
                <p className="text-xs text-gray-500 font-mono italic">
                  Enter any Order ID to track physical parcel shipments in real-time.
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
