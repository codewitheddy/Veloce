/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package,
  Truck,
  Check,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ArrowRight,
  Search,
  Home,
  MapPin,
  ShieldCheck,
  Copy,
  Box,
  Mail,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Phone,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Order, Product } from '../types';
import { CurrencyType, formatPrice } from '../lib/currency';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { generateColorRamp } from '../services/siteSettingsApi';

interface OrderTrackingPageProps {
  initialOrderId?: string | null;
  orders: Order[];
  products: Product[];
  currency?: CurrencyType;
  onBackToAccount?: () => void;
  onBackToStore?: () => void;
  onSelectProduct?: (product: Product) => void;
}

interface TrackingCheckpoint {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  status: 'completed' | 'current' | 'pending';
  icon: 'placed' | 'confirmed' | 'processing' | 'delivery' | 'delivered';
}

export default function OrderTrackingPage({
  initialOrderId,
  orders,
  products,
  currency = 'KSh',
  onBackToAccount,
  onBackToStore,
}: OrderTrackingPageProps) {
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSiteSettings();

  // Dynamic Theme Colors from Admin Site Settings
  const primaryColor = settings?.appearance?.primary_color || '#4f46e5';
  const secondaryColor = settings?.appearance?.secondary_color || '#06b6d4';
  const accentColor = settings?.appearance?.accent_color || '#f59e0b';
  const siteName = settings?.general?.site_name || 'Ropenix Collections';

  const primaryRamp = useMemo(() => generateColorRamp(primaryColor), [primaryColor]);
  const primaryHover = primaryRamp?.['650'] || primaryColor;
  const primarySoft = primaryRamp?.['50'] || '#eff6ff';
  const primaryBorder = primaryRamp?.['200'] || '#bfdbfe';

  const [searchId, setSearchId] = useState(() => initialOrderId || '');
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [showItemsBreakdown, setShowItemsBreakdown] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const fetchServerTracking = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/track/${encodeURIComponent(orderId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          return data;
        }
      }
    } catch {
      // Ignore network errors and fallback to local state
    }
    return null;
  };

  const handleTrackOrder = useCallback(async (orderIdToTrack: string) => {
    const trimmedId = (orderIdToTrack || '').trim().replace(/^#/, '');
    if (!trimmedId) {
      setErrorMsg('Please enter a valid order number.');
      setTrackedOrder(null);
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      // 1. Try authoritative server tracking first
      const serverData = await fetchServerTracking(trimmedId);

      // 2. Search local memory orders if available
      const localMatch = orders.find(
        (o) => (o.id || '').toLowerCase() === trimmedId.toLowerCase()
      );

      if (serverData && serverData.success) {
        const normalized: Order = {
          id: serverData.id || serverData.orderId || trimmedId,
          customerName: serverData.customerName || localMatch?.customerName || 'Valued Customer',
          customerEmail: serverData.customerEmail || localMatch?.customerEmail || '',
          phone: serverData.phone || localMatch?.phone || '',
          items: Array.isArray(serverData.items)
            ? serverData.items
            : localMatch?.items || [],
          total: Number(serverData.total !== undefined ? serverData.total : localMatch?.total || 0),
          subtotal: Number(serverData.subtotal !== undefined ? serverData.subtotal : localMatch?.subtotal || serverData.total || 0),
          status: serverData.status || localMatch?.status || 'pending',
          paymentStatus: serverData.paymentStatus || localMatch?.paymentStatus || 'unpaid',
          shippingFee: Number(serverData.shippingFee || localMatch?.shippingFee || 0),
          fulfillmentType: serverData.fulfillmentType || localMatch?.fulfillmentType || 'delivery',
          areaEstate: serverData.areaEstate || localMatch?.areaEstate || '',
          landmark: serverData.landmark || localMatch?.landmark || '',
          quotedCourier: serverData.quotedCourier || localMatch?.quotedCourier || '',
          trackingNumber: serverData.trackingNumber || localMatch?.trackingNumber || '',
          shippingAddress: serverData.shippingAddress || localMatch?.shippingAddress || '',
          date: serverData.date || localMatch?.date || new Date().toISOString(),
          isGuest: Boolean(serverData.isGuest ?? localMatch?.isGuest),
        };
        setTrackedOrder(normalized);
        setErrorMsg('');
      } else if (localMatch) {
        setTrackedOrder(localMatch);
        setErrorMsg('');
      } else {
        setTrackedOrder(null);
        setErrorMsg(`No active order found matching "#${trimmedId}". Please verify your order number and try again.`);
      }
    } catch {
      setErrorMsg('Unable to retrieve tracking information at this moment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [orders]);

  // Initial load auto-tracking
  useEffect(() => {
    if (initialOrderId) {
      setSearchId(initialOrderId);
      handleTrackOrder(initialOrderId);
    }
  }, [initialOrderId, handleTrackOrder]);

  // Determine stage progress (0: Placed, 1: Confirmed, 2: Processing, 3: Out for Delivery, 4: Delivered)
  const getStageIndex = (status?: string): number => {
    const s = (status || '').toLowerCase();
    if (s === 'delivered' || s === 'completed') return 4;
    if (s === 'out_for_delivery' || s === 'in_transit' || s === 'shipped') return 3;
    if (s === 'processing' || s === 'packaged' || s === 'ready_for_pickup') return 2;
    if (s === 'confirmed' || s === 'paid' || s === 'pending') return 1;
    return 1;
  };

  const currentStage = getStageIndex(trackedOrder?.status);

  // Generate milestone dates and history entries
  const getFormattedDate = (baseDateStr?: string, addHours: number = 0): string => {
    const d = baseDateStr ? new Date(baseDateStr) : new Date();
    if (isNaN(d.getTime())) {
      d.setTime(Date.now() - 86400000);
    }
    const target = new Date(d.getTime() + addHours * 3600 * 1000);
    return target.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getFormattedTime = (baseDateStr?: string, addHours: number = 0): string => {
    const d = baseDateStr ? new Date(baseDateStr) : new Date();
    if (isNaN(d.getTime())) {
      d.setTime(Date.now() - 86400000);
    }
    const target = new Date(d.getTime() + addHours * 3600 * 1000);
    return target.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTimelineCheckpoints = (): TrackingCheckpoint[] => {
    if (!trackedOrder) return [];
    const baseDate = trackedOrder.date || new Date().toISOString();

    const allCheckpoints: TrackingCheckpoint[] = [
      {
        id: 'cp-delivery',
        title: 'Out for Delivery',
        description: trackedOrder.fulfillmentType === 'pickup'
          ? 'Your package is ready for collection at the logistics center.'
          : `Your package is on the way to your address${trackedOrder.shippingAddress ? ` (${trackedOrder.shippingAddress})` : ''}.`,
        timestamp: `${getFormattedDate(baseDate, 24)}, ${getFormattedTime(baseDate, 24)}`,
        status: currentStage >= 3 ? (currentStage === 3 ? 'current' : 'completed') : 'pending',
        icon: 'delivery',
      },
      {
        id: 'cp-processing',
        title: 'Processing',
        description: "We're preparing and quality-inspecting your items for shipment.",
        timestamp: `${getFormattedDate(baseDate, 4)}, ${getFormattedTime(baseDate, 4)}`,
        status: currentStage >= 2 ? (currentStage === 2 ? 'current' : 'completed') : 'pending',
        icon: 'processing',
      },
      {
        id: 'cp-confirmed',
        title: 'Order Confirmed',
        description: 'Your order has been verified and assigned to the fulfillment hub.',
        timestamp: `${getFormattedDate(baseDate, 0)}, ${getFormattedTime(baseDate, 0)}`,
        status: currentStage >= 1 ? (currentStage === 1 ? 'current' : 'completed') : 'pending',
        icon: 'confirmed',
      },
      {
        id: 'cp-placed',
        title: 'Order Placed',
        description: 'Thank you! Your order has been placed.',
        timestamp: `${getFormattedDate(baseDate, 0)}, ${getFormattedTime(baseDate, 0)}`,
        status: 'completed',
        icon: 'placed',
      },
    ];

    return allCheckpoints;
  };

  const handleCopyOrderNumber = () => {
    if (!trackedOrder?.id) return;
    navigator.clipboard.writeText(trackedOrder.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const itemCount = (trackedOrder?.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  const totalAmount = trackedOrder ? Number(trackedOrder.total || 0) : 0;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-20">
      {/* Top Breadcrumb Navigation */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <button
          type="button"
          onClick={() => {
            if (isAuthenticated && onBackToAccount) {
              onBackToAccount();
            } else if (onBackToStore) {
              onBackToStore();
            } else {
              window.dispatchEvent(new CustomEvent('veloce_navigate_tab', { detail: isAuthenticated ? 'user' : 'store' }));
            }
          }}
          style={{ color: primaryColor }}
          className="inline-flex items-center gap-2 text-sm font-semibold transition cursor-pointer group hover:opacity-85"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>{isAuthenticated ? 'Back to My Account' : 'Back to Store'}</span>
        </button>
      </div>

      {/* Hero Header Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 sm:pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Title & Search Form */}
          <div className="lg:col-span-7 space-y-4">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-950 dark:text-white tracking-tight leading-tight">
              Track Your Order
            </h1>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
              Enter your order number below to get the latest updates on your delivery.
            </p>

            {/* Order Tracking Input Box */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleTrackOrder(searchId);
              }}
              className="pt-2"
            >
              <div className="flex flex-col sm:flex-row items-stretch gap-3 max-w-xl">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Box className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    value={searchId}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    onChange={(e) => setSearchId(e.target.value)}
                    placeholder="Enter your order number (e.g. #2487)"
                    style={{
                      borderColor: isInputFocused ? primaryColor : undefined,
                      boxShadow: isInputFocused ? `0 0 0 3px ${primaryColor}25` : undefined,
                    }}
                    className="w-full h-13 pl-12 pr-4 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm sm:text-base font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none shadow-xs transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    backgroundColor: primaryColor,
                    boxShadow: `0 8px 24px -4px ${primaryColor}40`,
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) e.currentTarget.style.backgroundColor = primaryHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = primaryColor;
                  }}
                  className="h-13 px-7 rounded-xl sm:rounded-2xl text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 disabled:opacity-75"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Tracking...</span>
                    </>
                  ) : (
                    <>
                      <span>Track Order</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {orders.length > 0 && (
              <div className="pt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Quick Track:</span>
                {orders.slice(0, 3).map((ord) => (
                  <button
                    key={ord.id}
                    type="button"
                    onClick={() => {
                      setSearchId(ord.id);
                      handleTrackOrder(ord.id);
                    }}
                    style={{
                      borderColor: primaryBorder,
                      color: primaryColor,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = primarySoft;
                      e.currentTarget.style.borderColor = primaryColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = primaryBorder;
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border font-mono text-xs font-semibold transition cursor-pointer shadow-2xs"
                  >
                    #{ord.id.replace(/^#/, '')}
                  </button>
                ))}
              </div>
            )}

            {errorMsg && (
              <div className="pt-2 flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Right Column: 3D Delivery Van & Package Hero Asset */}
          <div className="lg:col-span-5 relative flex items-center justify-center lg:justify-end">
            <div className="relative w-full max-w-md lg:max-w-none rounded-2xl overflow-hidden group aspect-[800/447]">
              <picture>
                <source srcSet="/images/delivery-hero.webp" type="image/webp" />
                <img
                  src="/images/delivery-hero.webp"
                  alt={`${siteName} Express Delivery Van and Courier Parcel`}
                  width={800}
                  height={447}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover rounded-2xl shadow-xl transition-transform duration-500 group-hover:scale-[1.02]"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </picture>
            </div>
          </div>
        </div>
      </div>

      {/* Tracked Order Details Card */}
      {trackedOrder && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-sm overflow-hidden transition-all">
            {/* Card Header: Order Identifier & Meta */}
            <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white tracking-tight">
                    Order #{trackedOrder.id.replace(/^#/, '')}
                  </h2>
                  <button
                    type="button"
                    onClick={handleCopyOrderNumber}
                    title="Copy Order Number"
                    style={{ color: copied ? '#10b981' : undefined }}
                    className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
                  Placed on {getFormattedDate(trackedOrder.date, 0)} • {itemCount} {itemCount === 1 ? 'item' : 'items'} • {formatPrice(totalAmount, currency)}
                </p>
              </div>

              {/* Payment Status Pill */}
              <div className="flex items-center gap-3">
                {trackedOrder.paymentStatus === 'paid' || trackedOrder.status === 'completed' ? (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Paid &amp; Confirmed</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-700 dark:text-amber-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {trackedOrder.paymentReference
                        ? `Payment Pending Verification (${trackedOrder.paymentReference})`
                        : 'Payment Pending Admin Verification'}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Horizontal Milestone Stepper */}
            <div className="px-6 sm:px-12 pt-8 pb-10 sm:pb-12 border-b border-slate-100 dark:border-slate-800">
              <div className="relative">
                {/* Connecting Progress Line */}
                <div className="absolute top-5 sm:top-6 left-6 sm:left-12 right-6 sm:right-12 h-1 bg-slate-200 dark:bg-slate-800 -z-0">
                  <div
                    className="h-full transition-all duration-700 ease-out rounded-full"
                    style={{
                      backgroundColor: primaryColor,
                      width: currentStage >= 4 ? '100%' : currentStage === 3 ? '66%' : currentStage === 2 ? '33%' : '0%',
                    }}
                  />
                </div>

                {/* 4 Stepper Milestones */}
                <div className="grid grid-cols-4 relative z-10 gap-1 sm:gap-2">
                  {/* Step 1: Order Confirmed */}
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
                        currentStage >= 1
                          ? 'text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                      style={currentStage >= 1 ? {
                        backgroundColor: primaryColor,
                        boxShadow: `0 4px 14px ${primaryColor}40`,
                      } : undefined}
                    >
                      <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                    </div>
                    <span className="mt-2 sm:mt-3 text-[10px] sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                      Confirmed
                    </span>
                    <span className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      {getFormattedDate(trackedOrder.date, 0)}, {getFormattedTime(trackedOrder.date, 0)}
                    </span>
                  </div>

                  {/* Step 2: Processing */}
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
                        currentStage >= 2
                          ? 'text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                      style={currentStage >= 2 ? {
                        backgroundColor: primaryColor,
                        boxShadow: `0 4px 14px ${primaryColor}40`,
                      } : undefined}
                    >
                      <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                    </div>
                    <span
                      className={`mt-2 sm:mt-3 text-[10px] sm:text-sm font-bold leading-tight ${
                        currentStage >= 2 ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      Processing
                    </span>
                    <span className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      {currentStage >= 2
                        ? `${getFormattedDate(trackedOrder.date, 4)}, ${getFormattedTime(trackedOrder.date, 4)}`
                        : 'In preparation'}
                    </span>
                  </div>

                  {/* Step 3: Out for Delivery */}
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
                        currentStage >= 3
                          ? 'text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                      style={currentStage >= 3 ? {
                        backgroundColor: primaryColor,
                        boxShadow: `0 4px 14px ${primaryColor}40`,
                        outline: `4px solid ${primarySoft}`
                      } : undefined}
                    >
                      <Truck className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                    </div>
                    <span
                      className={`mt-2 sm:mt-3 text-[10px] sm:text-sm font-bold leading-tight ${
                        currentStage >= 3 ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      In Transit
                    </span>
                    <span className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      {currentStage >= 3
                        ? `${getFormattedDate(trackedOrder.date, 24)}, ${getFormattedTime(trackedOrder.date, 24)}`
                        : 'Estimated arrival'}
                    </span>
                  </div>

                  {/* Step 4: Delivered */}
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
                        currentStage >= 4
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Home className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                    </div>
                    <span
                      className={`mt-2 sm:mt-3 text-[10px] sm:text-sm font-bold leading-tight ${
                        currentStage >= 4 ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      Delivered
                    </span>
                    <span className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      {currentStage >= 4
                        ? `${getFormattedDate(trackedOrder.date, 30)}, ${getFormattedTime(trackedOrder.date, 30)}`
                        : 'Arriving soon'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tracking Updates Vertical Timeline */}
            <div className="p-6 sm:p-10">
              <h3 className="text-lg font-bold text-slate-950 dark:text-white mb-6">
                Tracking Updates
              </h3>

              <div className="space-y-6 relative before:absolute before:left-[19px] sm:before:left-[21px] before:top-3 before:bottom-3 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800">
                {getTimelineCheckpoints().map((cp) => (
                  <div key={cp.id} className="relative flex items-start gap-4 sm:gap-6 group">
                    {/* Milestone Icon Node */}
                    <div
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 transition-all z-10 ${
                        cp.status === 'completed' || cp.status === 'current'
                          ? 'text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}
                      style={cp.status === 'completed' || cp.status === 'current' ? {
                        backgroundColor: primaryColor,
                        boxShadow: `0 2px 8px ${primaryColor}30`,
                      } : undefined}
                    >
                      {cp.icon === 'delivery' ? (
                        <Truck className="w-5 h-5" />
                      ) : cp.icon === 'placed' ? (
                        <Box className="w-5 h-5" />
                      ) : (
                        <Check className="w-5 h-5 stroke-[2.5]" />
                      )}
                    </div>

                    {/* Timeline Event Content */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-4 pt-1">
                      {/* Left: Date & Time */}
                      <div className="sm:col-span-4 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 font-mono">
                        {cp.timestamp}
                      </div>

                      {/* Right: Stage Title & Description */}
                      <div className="sm:col-span-8 space-y-0.5">
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                          {cp.title}
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                          {cp.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Items Toggle Breakdown */}
              <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowItemsBreakdown(!showItemsBreakdown)}
                  className="w-full flex items-center justify-between text-left py-2 font-bold text-sm text-slate-900 dark:text-white hover:opacity-80 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-500" />
                    <span>Ordered Items &amp; Parcel Contents ({itemCount})</span>
                  </div>
                  {showItemsBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showItemsBreakdown && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {(trackedOrder.items || []).map((item, idx) => {
                      const prodMatch = products.find((p) => p.id === item.productId);
                      const img = prodMatch?.imageUrl || (prodMatch?.images && prodMatch.images[0]) || '';
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs"
                        >
                          <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                            {img ? (
                              <img
                                src={img}
                                alt={item.name}
                                width={48}
                                height={48}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Box className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <strong className="block font-semibold text-slate-900 dark:text-white truncate">
                              {item.name}
                            </strong>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 block">
                              QTY: {item.quantity} × {formatPrice(item.price, currency)}
                            </span>
                          </div>
                          <div className="font-mono font-bold text-slate-900 dark:text-white text-right">
                            {formatPrice(item.price * item.quantity, currency)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
