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
  ChevronUp,
  AlertOctagon,
  RotateCcw,
  DollarSign,
  X,
  Loader2,
  Star,
} from 'lucide-react';
import { Order, Product, RefundClaim } from '../types';
import { CurrencyType, formatPrice } from '../lib/currency';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { generateColorRamp } from '../services/siteSettingsApi';
import { ordersApi } from '../api/orders';

interface OrderTrackingPageProps {
  initialOrderId?: string | null;
  orders: Order[];
  products: Product[];
  currency?: CurrencyType;
  onBackToAccount?: () => void;
  onBackToStore?: () => void;
  onSelectProduct?: (product: Product) => void;
  onWriteReview?: (orderId: string, orderItemId: string) => void;
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
  onWriteReview,
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

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReasonInput, setCancellationReasonInput] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

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
        const isPaidOrder = serverData.paymentStatus === 'paid' || serverData.status === 'completed' || serverData.status === 'payment_confirmed' || serverData.status === 'payment_received' || Boolean(serverData.isPaid);
        const rawStatus = String(serverData.status || localMatch?.status || 'pending').trim().toLowerCase();
        const cleanStatus = (rawStatus === 'awaiting_delivery_quote' || rawStatus === 'delivery_quoted' || rawStatus === 'order_received')
          ? 'pending'
          : (serverData.status || localMatch?.status || 'pending');

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
          status: cleanStatus as any,
          paymentStatus: isPaidOrder ? 'paid' : (serverData.paymentStatus || localMatch?.paymentStatus || 'unpaid'),
          isPaid: isPaidOrder,
          paymentMethod: serverData.paymentMethod || localMatch?.paymentMethod || 'mpesa',
          paymentReference: serverData.paymentReference || localMatch?.paymentReference,
          shippingFee: Number(serverData.shippingFee || localMatch?.shippingFee || 0),
          fulfillmentType: serverData.fulfillmentType || localMatch?.fulfillmentType || 'delivery',
          areaEstate: serverData.areaEstate || localMatch?.areaEstate || '',
          landmark: serverData.landmark || localMatch?.landmark || '',
          quotedCourier: serverData.quotedCourier || localMatch?.quotedCourier || '',
          trackingNumber: serverData.trackingNumber || localMatch?.trackingNumber || '',
          shippingAddress: serverData.shippingAddress || localMatch?.shippingAddress || '',
          date: serverData.date || localMatch?.date || new Date().toISOString(),
          isGuest: Boolean(serverData.isGuest ?? localMatch?.isGuest),
          cancellationReason: serverData.cancellationReason || localMatch?.cancellationReason,
          cancelledBy: serverData.cancelledBy || localMatch?.cancelledBy,
          cancelledAt: serverData.cancelledAt || localMatch?.cancelledAt,
          canCancel: serverData.canCancel ?? Boolean(!['completed', 'cancelled', 'shipped', 'delivered', 'payment_received'].includes((serverData.status || '').toLowerCase())),
          refundClaim: serverData.refundClaim || localMatch?.refundClaim,
          statusHistory: serverData.history || localMatch?.statusHistory || [],
        };
        setTrackedOrder(normalized);
        setErrorMsg('');
      } else if (localMatch) {
        const rawStatus = String(localMatch.status || 'pending').trim().toLowerCase();
        const cleanStatus = (rawStatus === 'awaiting_delivery_quote' || rawStatus === 'delivery_quoted' || rawStatus === 'order_received')
          ? 'pending'
          : (localMatch.status || 'pending');
        setTrackedOrder({ ...localMatch, status: cleanStatus as any });
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

  const handleCustomerCancelOrder = async () => {
    if (!trackedOrder?.id) return;
    if (!cancellationReasonInput.trim()) {
      setCancelError('Please provide a reason for cancelling your order.');
      return;
    }
    setIsCancelling(true);
    setCancelError('');
    try {
      const res = await ordersApi.cancelOrder(trackedOrder.id, cancellationReasonInput.trim());
      setTrackedOrder(prev => prev ? ({
        ...prev,
        ...res.order,
        status: 'cancelled',
        cancellationReason: cancellationReasonInput.trim(),
        cancelledBy: 'Customer',
        refundClaim: res.refundClaim || prev.refundClaim,
        canCancel: false,
      }) : null);
      setShowCancelModal(false);
      setCancellationReasonInput('');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to cancel order.';
      setCancelError(msg);
    } finally {
      setIsCancelling(false);
    }
  };

  const isCod = (trackedOrder?.paymentMethod || '').toLowerCase().includes('cod') || (trackedOrder?.paymentMethod || '').toLowerCase().includes('cash');

  // M-Pesa: 1: order_received, 2: payment_confirmed, 3: processing, 4: shipped, 5: completed
  // COD: 1: order_received, 2: processing, 3: shipped, 4: payment_received, 5: completed
  const getStageIndex = (status?: string): number => {
    const s = (status || '').toLowerCase();
    if (s === 'cancelled') return -1;
    if (isCod) {
      if (s === 'completed') return 5;
      if (s === 'payment_received' || s === 'delivered') return 4;
      if (s === 'shipped' || s === 'out_for_delivery' || s === 'in_transit') return 3;
      if (s === 'processing' || s === 'packaged') return 2;
      return 1;
    } else {
      if (s === 'completed') return 5;
      if (s === 'shipped' || s === 'delivered' || s === 'out_for_delivery' || s === 'in_transit') return 4;
      if (s === 'processing' || s === 'packaged') return 3;
      if (s === 'payment_confirmed' || (s === 'pending' && (trackedOrder?.paymentStatus === 'paid' || trackedOrder?.isPaid))) return 2;
      return 1;
    }
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

    if (isCod) {
      return [
        {
          id: 'cp-completed',
          title: 'Order Completed',
          description: 'Package delivered and cash payment confirmed.',
          timestamp: `${getFormattedDate(baseDate, 36)}, ${getFormattedTime(baseDate, 36)}`,
          status: currentStage >= 5 ? 'completed' : 'pending',
          icon: 'delivered',
        },
        {
          id: 'cp-payment-received',
          title: 'Cash Payment Received',
          description: 'Cash payment collected upon delivery by courier rider.',
          timestamp: `${getFormattedDate(baseDate, 30)}, ${getFormattedTime(baseDate, 30)}`,
          status: currentStage >= 4 ? (currentStage === 4 ? 'current' : 'completed') : 'pending',
          icon: 'delivered',
        },
        {
          id: 'cp-delivery',
          title: 'Out for Delivery / Shipped',
          description: trackedOrder.fulfillmentType === 'pickup'
            ? 'Package is ready for collection at the logistics hub.'
            : `Package dispatched with ${trackedOrder.quotedCourier || 'courier'} to ${trackedOrder.shippingAddress || 'your address'}.`,
          timestamp: `${getFormattedDate(baseDate, 24)}, ${getFormattedTime(baseDate, 24)}`,
          status: currentStage >= 3 ? (currentStage === 3 ? 'current' : 'completed') : 'pending',
          icon: 'delivery',
        },
        {
          id: 'cp-processing',
          title: 'Processing Order',
          description: "We're packing and quality-inspecting your items.",
          timestamp: `${getFormattedDate(baseDate, 4)}, ${getFormattedTime(baseDate, 4)}`,
          status: currentStage >= 2 ? (currentStage === 2 ? 'current' : 'completed') : 'pending',
          icon: 'processing',
        },
        {
          id: 'cp-placed',
          title: 'Order Received (Cash on Delivery)',
          description: 'Order placed successfully. Payment will be collected upon delivery.',
          timestamp: `${getFormattedDate(baseDate, 0)}, ${getFormattedTime(baseDate, 0)}`,
          status: 'completed',
          icon: 'placed',
        },
      ];
    }

    return [
      {
        id: 'cp-completed',
        title: 'Order Completed',
        description: 'Thank you for shopping with us! Order has been fulfilled.',
        timestamp: `${getFormattedDate(baseDate, 36)}, ${getFormattedTime(baseDate, 36)}`,
        status: currentStage >= 5 ? 'completed' : 'pending',
        icon: 'delivered',
      },
      {
        id: 'cp-delivery',
        title: 'Shipped / In Transit',
        description: `Package dispatched with ${trackedOrder.quotedCourier || 'courier'} with tracking code ${trackedOrder.trackingNumber || 'assigned'}.`,
        timestamp: `${getFormattedDate(baseDate, 24)}, ${getFormattedTime(baseDate, 24)}`,
        status: currentStage >= 4 ? (currentStage === 4 ? 'current' : 'completed') : 'pending',
        icon: 'delivery',
      },
      {
        id: 'cp-processing',
        title: 'Processing Order',
        description: "Payment confirmed. We're packing and preparing your items.",
        timestamp: `${getFormattedDate(baseDate, 6)}, ${getFormattedTime(baseDate, 6)}`,
        status: currentStage >= 3 ? (currentStage === 3 ? 'current' : 'completed') : 'pending',
        icon: 'processing',
      },
      {
        id: 'cp-confirmed',
        title: 'Payment Confirmed',
        description: 'M-Pesa payment verified. Order sent to warehouse fulfillment.',
        timestamp: `${getFormattedDate(baseDate, 2)}, ${getFormattedTime(baseDate, 2)}`,
        status: currentStage >= 2 ? (currentStage === 2 ? 'current' : 'completed') : 'pending',
        icon: 'confirmed',
      },
      {
        id: 'cp-placed',
        title: 'Order Received',
        description: 'Order received. Awaiting M-Pesa payment confirmation.',
        timestamp: `${getFormattedDate(baseDate, 0)}, ${getFormattedTime(baseDate, 0)}`,
        status: 'completed',
        icon: 'placed',
      },
    ];
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

              {/* Status & Actions */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Cancellation Button (Customer allowed if order_received or processing) */}
                {trackedOrder.canCancel && trackedOrder.status !== 'cancelled' && trackedOrder.status !== 'completed' && (
                  <button
                    type="button"
                    onClick={() => {
                      setCancelError('');
                      setShowCancelModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-semibold transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Cancel Order</span>
                  </button>
                )}

                {/* Status Pill */}
                {trackedOrder.status === 'cancelled' ? (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-400">
                    <AlertOctagon className="w-3.5 h-3.5" />
                    <span>Cancelled</span>
                  </span>
                ) : isCod ? (
                  trackedOrder.status === 'payment_received' || trackedOrder.status === 'completed' || trackedOrder.paymentStatus === 'paid' ? (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Cash Paid on Delivery</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-700 dark:text-amber-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Cash on Delivery (Unpaid)</span>
                    </span>
                  )
                ) : (
                  trackedOrder.paymentStatus === 'paid' || trackedOrder.status === 'completed' || trackedOrder.status === 'payment_confirmed' || trackedOrder.isPaid ? (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Paid &amp; Confirmed {trackedOrder.paymentReference ? `(${trackedOrder.paymentReference})` : ''}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-700 dark:text-amber-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {trackedOrder.paymentReference
                          ? `Payment Pending Verification (${trackedOrder.paymentReference})`
                          : 'Payment Pending'}
                      </span>
                    </span>
                  )
                )}
              </div>
            </div>

            {/* Cancellation Notice Banner */}
            {trackedOrder.status === 'cancelled' && (
              <div className="mx-6 sm:mx-8 mt-6 p-4 sm:p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
                    <AlertOctagon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                      This order was cancelled {trackedOrder.cancelledBy ? `by ${trackedOrder.cancelledBy}` : ''}
                    </h4>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                      {trackedOrder.cancellationReason ? `Reason: "${trackedOrder.cancellationReason}"` : 'No cancellation reason provided.'}
                      {trackedOrder.cancelledAt && ` • ${new Date(trackedOrder.cancelledAt).toLocaleString()}`}
                    </p>
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                      ✓ Reserved product items have been automatically returned to inventory.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Linked Refund Claim Banner */}
            {trackedOrder.refundClaim && (
              <div className="mx-6 sm:mx-8 mt-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border border-purple-200 dark:border-purple-800/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Refund Claim #{trackedOrder.refundClaim.id}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          trackedOrder.refundClaim.status === 'refund_paid'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : trackedOrder.refundClaim.status === 'refund_approved'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                            : trackedOrder.refundClaim.status === 'refund_rejected'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}>
                          {trackedOrder.refundClaim.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                        Claim Amount: <strong className="font-mono">{formatPrice(trackedOrder.refundClaim.amount, currency)}</strong>
                        {trackedOrder.refundClaim.paymentReference && ` • Original Ref: ${trackedOrder.refundClaim.paymentReference}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {trackedOrder.refundClaim.status === 'refund_paid' ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        ✓ Disbursed via M-Pesa{trackedOrder.refundClaim.payoutReference ? ` (${trackedOrder.refundClaim.payoutReference})` : ''}
                      </span>
                    ) : trackedOrder.refundClaim.status === 'refund_approved' ? (
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">
                        Approved by finance • Payout in progress
                      </span>
                    ) : trackedOrder.refundClaim.status === 'refund_rejected' ? (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold">
                        Claim Rejected: {trackedOrder.refundClaim.adminNotes || 'Contact support'}
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        Under review by finance team
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Horizontal Milestone Stepper (5 Dynamic Stages) */}
            <div className="px-4 sm:px-10 pt-8 pb-10 sm:pb-12 border-b border-slate-100 dark:border-slate-800">
              <div className="relative">
                {/* Connecting Progress Line */}
                <div className="absolute top-5 sm:top-6 left-6 sm:left-12 right-6 sm:right-12 h-1 bg-slate-200 dark:bg-slate-800 -z-0">
                  <div
                    className="h-full transition-all duration-700 ease-out rounded-full"
                    style={{
                      backgroundColor: trackedOrder.status === 'cancelled' ? '#f43f5e' : primaryColor,
                      width: trackedOrder.status === 'cancelled'
                        ? '0%'
                        : currentStage >= 5
                        ? '100%'
                        : currentStage === 4
                        ? '75%'
                        : currentStage === 3
                        ? '50%'
                        : currentStage === 2
                        ? '25%'
                        : '0%',
                    }}
                  />
                </div>

                {/* 5 Stepper Milestones */}
                <div className="grid grid-cols-5 relative z-10 gap-1 sm:gap-2">
                  {/* Step 1: Order Received (Both Flows) */}
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
                        currentStage >= 1 && trackedOrder.status !== 'cancelled'
                          ? 'text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                      style={currentStage >= 1 && trackedOrder.status !== 'cancelled' ? {
                        backgroundColor: primaryColor,
                        boxShadow: `0 4px 14px ${primaryColor}40`,
                      } : undefined}
                    >
                      <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                    </div>
                    <span className="mt-2 sm:mt-3 text-[10px] sm:text-xs font-bold text-slate-900 dark:text-white leading-tight">
                      Received
                    </span>
                    <span className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      {getFormattedDate(trackedOrder.date, 0)}
                    </span>
                  </div>

                  {/* Step 2: Payment Confirmed (M-Pesa) OR Processing (COD) */}
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
                        currentStage >= 2 && trackedOrder.status !== 'cancelled'
                          ? 'text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                      style={currentStage >= 2 && trackedOrder.status !== 'cancelled' ? {
                        backgroundColor: primaryColor,
                        boxShadow: `0 4px 14px ${primaryColor}40`,
                      } : undefined}
                    >
                      {isCod ? (
                        <Package className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                      )}
                    </div>
                    <span
                      className={`mt-2 sm:mt-3 text-[10px] sm:text-xs font-bold leading-tight ${
                        currentStage >= 2 && trackedOrder.status !== 'cancelled'
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {isCod ? 'Processing' : 'Paid Confirmed'}
                    </span>
                    <span className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      {currentStage >= 2 && trackedOrder.status !== 'cancelled'
                        ? isCod
                          ? 'In preparation'
                          : 'M-Pesa verified'
                        : isCod
                        ? 'Pending'
                        : 'Awaiting M-Pesa'}
                    </span>
                  </div>

                  {/* Step 3: Processing (M-Pesa) OR Shipped (COD) */}
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
                        currentStage >= 3 && trackedOrder.status !== 'cancelled'
                          ? 'text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                      style={currentStage >= 3 && trackedOrder.status !== 'cancelled' ? {
                        backgroundColor: primaryColor,
                        boxShadow: `0 4px 14px ${primaryColor}40`,
                      } : undefined}
                    >
                      {isCod ? (
                        <Truck className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                      ) : (
                        <Package className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                      )}
                    </div>
                    <span
                      className={`mt-2 sm:mt-3 text-[10px] sm:text-xs font-bold leading-tight ${
                        currentStage >= 3 && trackedOrder.status !== 'cancelled'
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {isCod ? 'Shipped' : 'Processing'}
                    </span>
                    <span className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      {currentStage >= 3 && trackedOrder.status !== 'cancelled'
                        ? isCod
                          ? 'With courier'
                          : 'Packing goods'
                        : 'Upcoming'}
                    </span>
                  </div>

                  {/* Step 4: Shipped (M-Pesa) OR Payment Received (COD) */}
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
                        currentStage >= 4 && trackedOrder.status !== 'cancelled'
                          ? 'text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                      style={currentStage >= 4 && trackedOrder.status !== 'cancelled' ? {
                        backgroundColor: primaryColor,
                        boxShadow: `0 4px 14px ${primaryColor}40`,
                      } : undefined}
                    >
                      {isCod ? (
                        <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                      ) : (
                        <Truck className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                      )}
                    </div>
                    <span
                      className={`mt-2 sm:mt-3 text-[10px] sm:text-xs font-bold leading-tight ${
                        currentStage >= 4 && trackedOrder.status !== 'cancelled'
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {isCod ? 'Cash Collected' : 'Shipped'}
                    </span>
                    <span className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      {currentStage >= 4 && trackedOrder.status !== 'cancelled'
                        ? isCod
                          ? 'Paid to rider'
                          : 'On the way'
                        : isCod
                        ? 'Upon delivery'
                        : 'Dispatched'}
                    </span>
                  </div>

                  {/* Step 5: Completed (Both Flows) */}
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
                        currentStage >= 5 && trackedOrder.status !== 'cancelled'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Home className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                    </div>
                    <span
                      className={`mt-2 sm:mt-3 text-[10px] sm:text-xs font-bold leading-tight ${
                        currentStage >= 5 && trackedOrder.status !== 'cancelled'
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      Completed
                    </span>
                    <span className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      {currentStage >= 5 && trackedOrder.status !== 'cancelled'
                        ? 'Fulfilled'
                        : 'Final stage'}
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

              {/* "How was your order?" banner for delivered orders */}
              {(() => {
                const isDelivered = (
                  trackedOrder.status === 'completed' ||
                  trackedOrder.status === 'delivered' ||
                  Boolean(trackedOrder.deliveryConfirmed)
                ) && trackedOrder.status !== 'cancelled' && trackedOrder.status !== 'refunded';

                if (!isDelivered) return null;

                return (
                  <div className="mt-8 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200/80 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
                    <div className="flex items-center gap-3.5">
                      <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Star className="h-5 w-5 fill-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">How was your order?</h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Share your experience and verified feedback to help other customers!
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Order Items Toggle Breakdown */}
              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
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
                      const isDelivered = (
                        trackedOrder.status === 'completed' ||
                        trackedOrder.status === 'delivered' ||
                        Boolean(trackedOrder.deliveryConfirmed)
                      ) && trackedOrder.status !== 'cancelled' && trackedOrder.status !== 'refunded';
                      const hasRev = item.hasReviewed || item.hasReview || item.reviewId;

                      const handleItemReview = () => {
                        if (onWriteReview) {
                          onWriteReview(trackedOrder.id, item.id || item.productId);
                        } else {
                          window.dispatchEvent(
                            new CustomEvent('veloce_open_review', {
                              detail: {
                                orderId: trackedOrder.id,
                                orderItemId: item.id || item.productId,
                              },
                            })
                          );
                        }
                      };

                      return (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
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
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-700/60">
                            {isDelivered && (
                              hasRev ? (
                                <button
                                  type="button"
                                  onClick={handleItemReview}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 px-2.5 py-1 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
                                  title="Edit your review for this product"
                                >
                                  <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                                  <span>Edit review ({item.rating || item.review?.rating || 5}★)</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleItemReview}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-amber-500 hover:bg-amber-600 px-2.5 py-1 rounded-lg transition-colors shadow-2xs cursor-pointer"
                                  title="Write review for this product"
                                >
                                  <Star className="h-3 w-3 fill-white text-white" />
                                  <span>Write a review</span>
                                </button>
                              )
                            )}

                            <div className="font-mono font-bold text-slate-900 dark:text-white text-right">
                              {formatPrice(item.price * item.quantity, currency)}
                            </div>
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

      {/* Customer Cancel Order Modal */}
      {showCancelModal && trackedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Cancel Order #{trackedOrder.id.replace(/^#/, '')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {trackedOrder.isPaid || trackedOrder.paymentStatus === 'paid' ? 'Paid Order Cancellation' : 'Unpaid Order Cancellation'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl space-y-1.5 border border-slate-200/60 dark:border-slate-700/60">
              <p>
                • <strong>Restocking:</strong> Items in this order will be automatically returned to store inventory.
              </p>
              {trackedOrder.isPaid || trackedOrder.paymentStatus === 'paid' ? (
                <p className="text-indigo-600 dark:text-indigo-400 font-medium">
                  • <strong>Refund Claim:</strong> A refund claim for {formatPrice(totalAmount, currency)} will be created automatically and sent to finance for review and M-Pesa disbursement.
                </p>
              ) : (
                <p className="text-slate-500">
                  • <strong>No Payment Collected:</strong> Since this order is unpaid, no refund claim is needed.
                </p>
              )}
            </div>

            {cancelError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {cancelError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Cancellation <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={cancellationReasonInput}
                onChange={(e) => setCancellationReasonInput(e.target.value)}
                placeholder="e.g., Placed by mistake, changed mind, want to change address or payment method..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleCustomerCancelOrder}
                disabled={isCancelling || !cancellationReasonInput.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition disabled:opacity-50 cursor-pointer"
              >
                {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
