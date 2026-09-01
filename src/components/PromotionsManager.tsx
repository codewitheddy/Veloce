import React, { useState, useMemo } from 'react';
import {
  Tag,
  Percent,
  Sparkles,
  Plus,
  Trash2,
  Copy,
  Check,
  Calendar,
  Clock,
  AlertTriangle,
  TrendingUp,
  Megaphone,
  Eye,
  Flame,
  Gift,
  Search,
  Filter,
  ArrowRight,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShoppingBag,
  Sliders,
  DollarSign,
  HelpCircle,
  Power,
  ToggleLeft,
  ToggleRight,
  Edit2,
  ArrowUpDown,
  Layers,
  Info,
  CheckCircle
} from 'lucide-react';
import { CouponItem, Order, Product } from '../types';
import { CurrencyType } from '../lib/currency';
import {
  isCouponExpired,
  isCouponActive,
  isCouponManuallyDisabled,
  getCouponPercent,
  getCouponExpiry,
  formatCouponExpiry
} from '../data';
import { useHappyHourStatus } from '../hooks/useHappyHourStatus';

interface PromotionsManagerProps {
  coupons: Record<string, number | CouponItem>;
  onAddCoupon: (code: string, percent: number, expiryDate?: string, desc?: string, active?: boolean) => void;
  onDeleteCoupon: (code: string) => void;
  onToggleCouponActive?: (code: string, active?: boolean) => void;
  onUpdateCoupon?: (code: string, updatedFields: Partial<CouponItem>) => void;
  promoBanner: { text: string; code: string; active: boolean };
  onUpdatePromoBanner: (text: string, code: string, active: boolean) => void;
  orders?: Order[];
  products?: Product[];
  currency?: CurrencyType;
  onNavigateToSite?: (tab?: string) => void;
}

export default function PromotionsManager({
  coupons,
  onAddCoupon,
  onDeleteCoupon,
  onToggleCouponActive,
  onUpdateCoupon,
  promoBanner,
  onUpdatePromoBanner,
  orders = [],
  products = [],
  currency = 'KSh',
  onNavigateToSite,
}: PromotionsManagerProps) {
  // Banner edit state
  const [bannerText, setBannerText] = useState(promoBanner.text);
  const [bannerCode, setBannerCode] = useState(promoBanner.code);
  const [bannerActive, setBannerActive] = useState(promoBanner.active);
  const [bannerSaveSuccess, setBannerSaveSuccess] = useState(false);

  // New coupon modal / form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCouponCode, setEditingCouponCode] = useState<string | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newPercent, setNewPercent] = useState<number>(15);
  const [newExpiry, setNewExpiry] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [newDesc, setNewDesc] = useState('');
  const [newIsActive, setNewIsActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filter, search, and sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expired' | 'high-value'>('all');
  const [sortBy, setSortBy] = useState<'status' | 'discount-desc' | 'discount-asc' | 'expiry' | 'redemptions'>('status');

  // Simulator state
  const [simCartTotal, setSimCartTotal] = useState<number>(5000);
  const [simSelectedCoupon, setSimSelectedCoupon] = useState<string>('VELOCE10');
  const [simApplyHappyHour, setSimApplyHappyHour] = useState<boolean>(false);

  // Happy Hour live hook
  const happyHour = useHappyHourStatus();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3000);
  };

  // Normalize coupon entries from coupons state
  const couponList = useMemo(() => {
    return Object.entries(coupons).map(([code, data]) => {
      const percent = getCouponPercent(data);
      const expiryDate = getCouponExpiry(data);
      const expired = isCouponExpired(data);
      const isManuallyOff = isCouponManuallyDisabled(data);
      const active = typeof data === 'object' && data !== null
        ? (data.active !== undefined ? data.active !== false : (data.isActive !== undefined ? data.isActive !== false : true))
        : true;
      
      const desc = typeof data === 'object' && data !== null ? data.desc : undefined;
      const minSpend = typeof data === 'object' && data !== null ? data.minSpend : undefined;
      const maxDiscount = typeof data === 'object' && data !== null ? data.maxDiscount : undefined;

      // Status determination
      const isCurrentlyActive = active && !expired && !isManuallyOff;

      // Calculate real redemptions from orders
      const redemptions = orders.filter(
        (o) => o.couponCode && o.couponCode.toUpperCase() === code.toUpperCase()
      ).length;

      const totalSavingsGenerated = orders
        .filter((o) => o.couponCode && o.couponCode.toUpperCase() === code.toUpperCase())
        .reduce((sum, o) => sum + (o.discountAmount || 0), 0);

      return {
        code,
        percent,
        expiryDate,
        expired,
        active,
        isCurrentlyActive,
        isManuallyOff,
        desc: desc || `${percent}% off promotional discount`,
        minSpend,
        maxDiscount,
        redemptions,
        totalSavingsGenerated,
      };
    });
  }, [coupons, orders]);

  // Overall Promo Performance Metrics
  const metrics = useMemo(() => {
    const totalCoupons = couponList.length;
    const activeCoupons = couponList.filter((c) => c.isCurrentlyActive).length;
    const inactiveCoupons = couponList.filter((c) => c.isManuallyOff && !c.expired).length;
    const expiredCoupons = couponList.filter((c) => c.expired).length;
    
    const totalRedemptions = orders.filter((o) => !!o.couponCode).length;
    const totalDiscountsGiven = orders.reduce((sum, o) => sum + (o.discountAmount || 0), 0);
    const avgDiscountPercent =
      couponList.length > 0
        ? Math.round(couponList.reduce((sum, c) => sum + c.percent, 0) / couponList.length)
        : 0;

    return {
      totalCoupons,
      activeCoupons,
      inactiveCoupons,
      expiredCoupons,
      totalRedemptions,
      totalDiscountsGiven,
      avgDiscountPercent,
    };
  }, [couponList, orders]);

  // Filtered & Sorted coupons
  const filteredCoupons = useMemo(() => {
    const list = couponList.filter((item) => {
      const matchesSearch =
        item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${item.percent}%`.includes(searchQuery.trim());

      if (!matchesSearch) return false;

      if (statusFilter === 'active') return item.isCurrentlyActive;
      if (statusFilter === 'inactive') return item.isManuallyOff;
      if (statusFilter === 'expired') return item.expired;
      if (statusFilter === 'high-value') return item.percent >= 20;
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'status') {
        // Active first, then inactive, then expired
        if (a.isCurrentlyActive && !b.isCurrentlyActive) return -1;
        if (!a.isCurrentlyActive && b.isCurrentlyActive) return 1;
        if (!a.expired && b.expired) return -1;
        if (a.expired && !b.expired) return 1;
        return b.percent - a.percent;
      }
      if (sortBy === 'discount-desc') return b.percent - a.percent;
      if (sortBy === 'discount-asc') return a.percent - b.percent;
      if (sortBy === 'redemptions') return b.redemptions - a.redemptions;
      if (sortBy === 'expiry') {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      }
      return 0;
    });
  }, [couponList, searchQuery, statusFilter, sortBy]);

  // Toggle single coupon active status
  const handleToggleCoupon = (code: string, currentActive: boolean) => {
    const nextState = !currentActive;
    if (onToggleCouponActive) {
      onToggleCouponActive(code, nextState);
    } else if (onUpdateCoupon) {
      onUpdateCoupon(code, { active: nextState, isActive: nextState });
    }
    showToast(`Promotion "${code}" is now ${nextState ? 'Active & Ready for Checkout' : 'Paused / Inactive'}.`);
  };

  // Bulk activate all
  const handleActivateAll = () => {
    couponList.forEach((c) => {
      if (!c.active || c.isManuallyOff) {
        if (onToggleCouponActive) {
          onToggleCouponActive(c.code, true);
        } else if (onUpdateCoupon) {
          onUpdateCoupon(c.code, { active: true, isActive: true });
        }
      }
    });
    showToast('All promotions have been activated.');
  };

  // Bulk deactivate all
  const handleDeactivateAll = () => {
    couponList.forEach((c) => {
      if (c.active && !c.isManuallyOff) {
        if (onToggleCouponActive) {
          onToggleCouponActive(c.code, false);
        } else if (onUpdateCoupon) {
          onUpdateCoupon(c.code, { active: false, isActive: false });
        }
      }
    });
    showToast('All promotions have been paused.');
  };

  // Quick extend validity by 30 days
  const handleExtendValidity = (code: string) => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    const newDateStr = d.toISOString().split('T')[0];

    if (onUpdateCoupon) {
      onUpdateCoupon(code, { expiryDate: newDateStr, active: true, isActive: true });
    } else if (onToggleCouponActive) {
      onToggleCouponActive(code, true);
    }
    showToast(`Promotion "${code}" extended to ${formatCouponExpiry(newDateStr)} & activated.`);
  };

  // Copy code handler
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Generate random promo code
  const handleGenerateCode = () => {
    const prefixes = ['VELOCE', 'VIP', 'FLASH', 'SAVE', 'LUXURY', 'SUMMER', 'DEAL'];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomNum = Math.floor(Math.random() * 80 + 10);
    setNewCode(`${randomPrefix}${randomNum}`);
  };

  // Open Edit Modal
  const handleOpenEdit = (coupon: typeof couponList[0]) => {
    setEditingCouponCode(coupon.code);
    setNewCode(coupon.code);
    setNewPercent(coupon.percent);
    setNewExpiry(coupon.expiryDate || '');
    setNewDesc(coupon.desc);
    setNewIsActive(coupon.active);
    setFormError('');
    setShowAddModal(true);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingCouponCode(null);
    handleGenerateCode();
    setNewPercent(15);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setNewExpiry(d.toISOString().split('T')[0]);
    setNewDesc('');
    setNewIsActive(true);
    setFormError('');
    setShowAddModal(true);
  };

  // Save/Create coupon submit handler
  const handleSaveCouponForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanCode = newCode.trim().toUpperCase();
    if (!cleanCode) {
      setFormError('Please enter a valid promotional coupon code.');
      return;
    }

    if (!editingCouponCode && coupons[cleanCode]) {
      setFormError(`Coupon code "${cleanCode}" already exists. Please choose a unique name.`);
      return;
    }

    if (newPercent < 1 || newPercent > 95) {
      setFormError('Discount percentage must be between 1% and 95%.');
      return;
    }

    if (editingCouponCode) {
      // If code changed, delete old and add new
      if (editingCouponCode !== cleanCode) {
        onDeleteCoupon(editingCouponCode);
        onAddCoupon(cleanCode, newPercent, newExpiry || undefined, newDesc.trim() || undefined, newIsActive);
      } else if (onUpdateCoupon) {
        onUpdateCoupon(cleanCode, {
          percent: newPercent,
          expiryDate: newExpiry || undefined,
          desc: newDesc.trim() || undefined,
          active: newIsActive,
          isActive: newIsActive,
        });
      } else {
        onAddCoupon(cleanCode, newPercent, newExpiry || undefined, newDesc.trim() || undefined, newIsActive);
      }
      showToast(`Promotion "${cleanCode}" updated successfully.`);
    } else {
      onAddCoupon(cleanCode, newPercent, newExpiry || undefined, newDesc.trim() || undefined, newIsActive);
      showToast(`Promotion "${cleanCode}" created & activated.`);
    }

    setShowAddModal(false);
    setEditingCouponCode(null);
    setNewCode('');
    setNewDesc('');
    setNewPercent(15);
  };

  // Save Banner Changes
  const handleSaveBanner = () => {
    onUpdatePromoBanner(bannerText.trim(), bannerCode.trim().toUpperCase(), bannerActive);
    setBannerSaveSuccess(true);
    setTimeout(() => setBannerSaveSuccess(false), 2500);
    showToast('Storefront announcement banner updated live!');
  };

  // Banner Presets
  const bannerPresets = [
    {
      label: 'Flash Sale (10%)',
      text: '⚡ FLASH SALE: Get 10% off your entire order with code VELOCE10!',
      code: 'VELOCE10',
    },
    {
      label: 'Summer Special (30%)',
      text: '☀️ SUMMER SPECIAL: Enjoy 30% off summer items with code SUMMER30!',
      code: 'SUMMER30',
    },
    {
      label: 'Free Delivery Offer',
      text: '🚚 FREE EXPRESS SHIPPING: On all luxury orders over 5,000 KSh this week!',
      code: '',
    },
    {
      label: 'Happy Hour Alert',
      text: '🔥 DAILY HAPPY HOUR: Special automatic discounts active between 2:00 PM and 4:00 PM!',
      code: 'HAPPY15',
    },
  ];

  // Simulator calculations
  const simulatorMath = useMemo(() => {
    const baseAmount = Number(simCartTotal) || 0;
    const couponData = coupons[simSelectedCoupon.toUpperCase()];
    const couponDiscountPct = couponData ? getCouponPercent(couponData) : 0;
    const isCouponUsable = couponData ? isCouponActive(couponData) : false;
    const isCouponPaused = couponData ? isCouponManuallyDisabled(couponData) : false;
    const isCouponExp = couponData ? isCouponExpired(couponData) : false;

    const couponDeduction = isCouponUsable ? (baseAmount * couponDiscountPct) / 100 : 0;
    const happyHourDeduction = simApplyHappyHour ? (baseAmount * (happyHour.discountPercentage || 15)) / 100 : 0;

    const totalSavings = couponDeduction + happyHourDeduction;
    const finalAmount = Math.max(0, baseAmount - totalSavings);

    return {
      baseAmount,
      couponDiscountPct,
      isCouponUsable,
      isCouponPaused,
      isCouponExp,
      couponDeduction,
      happyHourDeduction,
      totalSavings,
      finalAmount,
    };
  }, [simCartTotal, simSelectedCoupon, simApplyHappyHour, coupons, happyHour]);

  return (
    <div className="space-y-6 pb-12" id="promotions-marketing-studio">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 text-white border border-slate-700 shadow-xl text-xs font-medium">
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-850 pb-5">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 shadow-2xs">
            <Sparkles className="h-6 w-6" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                Promotions & Discount Studio
              </h2>
              <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-mono text-[10px] font-bold rounded-md">
                MARKETING & GROWTH ENGINE
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-2xl">
              Monitor active coupon codes fetched in real time from store state, toggle promotion activation switches on demand, manage header broadcasts, and simulate checkout discount math.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {onNavigateToSite && (
            <button
              type="button"
              onClick={() => onNavigateToSite('home')}
              className="px-3.5 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
              title="Preview promotions on public storefront"
            >
              <Eye className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
              <span>Store Preview</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            id="btn-create-new-promo-coupon"
          >
            <Plus className="h-4 w-4" />
            <span>Create Promo Coupon</span>
          </button>
        </div>
      </div>


      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        
        {/* Metric 1: Active & Live Promotions */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-3xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase font-mono tracking-wider">Active Promotions</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Tag className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {metrics.activeCoupons}
            </span>
            <span className="text-xs text-slate-400 font-sans">of {metrics.totalCoupons} total</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live at Checkout</span>
          </div>
        </div>

        {/* Metric 2: Paused / Inactive */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-3xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase font-mono tracking-wider">Paused / Inactive</span>
            <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Power className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {metrics.inactiveCoupons}
            </span>
            <span className="text-xs text-slate-400 font-sans">
              {metrics.expiredCoupons > 0 ? `(+${metrics.expiredCoupons} expired)` : 'toggled off'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            <span>Disabled by Admin</span>
          </div>
        </div>

        {/* Metric 3: Top Announcement Bar */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-3xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase font-mono tracking-wider">Top Banner</span>
            <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${promoBanner.active ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
              <Megaphone className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-base font-bold font-sans uppercase tracking-tight ${promoBanner.active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
              {promoBanner.active ? 'Broadcasting' : 'Hidden'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 truncate">
            {promoBanner.code ? `Code: ${promoBanner.code}` : 'Storewide'}
          </div>
        </div>

        {/* Metric 4: Customer Savings */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-3xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase font-mono tracking-wider">Total Savings</span>
            <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Gift className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
              {currency} {metrics.totalDiscountsGiven.toLocaleString()}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-sans">
            Across {metrics.totalRedemptions} redemptions
          </div>
        </div>

        {/* Metric 5: Happy Hour Flash */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-3xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase font-mono tracking-wider">Daily Flash</span>
            <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${happyHour.isActive ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
              <Flame className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-base font-bold font-sans ${happyHour.isActive ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {happyHour.isActive ? '🔥 15% Live' : '2:00 PM - 4:00 PM'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-mono truncate">
            {happyHour.isActive ? happyHour.timeRemaining.formatted + ' remaining' : 'Daily auto flash'}
          </div>
        </div>

      </div>

      {/* Main Grid: Left Column (Announcement Bar & Simulator) & Right Column (Active Promotions List & Toggle Suite) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* Right Column (7 Cols on desktop, 12 on mobile): Active Promotions List */}
        <div className="xl:col-span-7 space-y-6 order-1 xl:order-2" id="active-promotions-section">
          
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-3xs text-left">
            
            {/* Header & Quick Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-150 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white font-sans flex items-center gap-2">
                    <span>Active Promotions</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-mono font-bold border border-indigo-100 dark:border-indigo-900">
                      {couponList.length} Total
                    </span>
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold border border-emerald-200 dark:border-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {metrics.activeCoupons} Live
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-1">
                  Fetched directly from store state. Use activation switches to enable or pause discounts in real time.
                </p>
              </div>

              {/* Header Action Buttons */}
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={handleActivateAll}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                  title="Enable all promotions"
                >
                  Activate All
                </button>
                <button
                  type="button"
                  onClick={handleDeactivateAll}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                  title="Pause all promotions"
                >
                  Pause All
                </button>
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  id="btn-add-coupon-modal-open"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Promo</span>
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search promotions by code, discount %, or note..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 font-sans"
                  id="input-search-coupons"
                />
              </div>

              {/* Sort Selection */}
              <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
                <span className="text-[11px] font-mono text-slate-400 font-medium whitespace-nowrap">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer w-full sm:w-auto"
                >
                  <option value="status">Status (Active First)</option>
                  <option value="discount-desc">Highest Discount (-%)</option>
                  <option value="discount-asc">Lowest Discount (-%)</option>
                  <option value="redemptions">Most Redemptions</option>
                  <option value="expiry">Expiry Date</option>
                </select>
              </div>
            </div>

            {/* Status Filter Chips */}
            <div className="mt-3 flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl overflow-x-auto custom-tab-scroll">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-3xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All ({couponList.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  statusFilter === 'active'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-3xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Active ({metrics.activeCoupons})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  statusFilter === 'inactive'
                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-3xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <span>Paused ({metrics.inactiveCoupons})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('expired')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  statusFilter === 'expired'
                    ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-3xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <span>Expired ({metrics.expiredCoupons})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('high-value')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === 'high-value'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-3xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                20%+ High Discount
              </button>
            </div>

            {/* Active Promotions Cards Container */}
            <div className="mt-4 space-y-3" id="active-promotions-list">
              {filteredCoupons.length === 0 ? (
                <div className="py-12 px-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                  <Tag className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No promotions match the current filter</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {searchQuery ? 'Try adjusting your search terms or filter selection.' : 'Create your first promotional discount coupon to boost store sales.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenCreate}
                    className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create Promo Coupon</span>
                  </button>
                </div>
              ) : (
                filteredCoupons.map((coupon) => {
                  const isLive = coupon.isCurrentlyActive;
                  const isPaused = coupon.isManuallyOff;
                  const isExp = coupon.expired;

                  return (
                    <div
                      key={coupon.code}
                      className={`p-4 rounded-2xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                        !isLive
                          ? isExp
                            ? 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 opacity-80'
                            : 'bg-amber-50/20 dark:bg-amber-950/10 border-amber-200/60 dark:border-amber-900/40'
                          : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 shadow-4xs'
                      }`}
                      id={`promo-row-${coupon.code}`}
                    >
                      {/* Left: Discount Badge & Info */}
                      <div className="flex items-start gap-3.5 min-w-0">
                        {/* Discount Percent Tile */}
                        <div className={`p-3 rounded-2xl flex flex-col items-center justify-center shrink-0 min-w-[70px] shadow-3xs ${
                          isLive
                            ? 'bg-indigo-600 text-white shadow-indigo-200 dark:shadow-none'
                            : isExp
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                        }`}>
                          <span className="text-lg font-bold font-mono leading-none">-{coupon.percent}%</span>
                          <span className="text-[9px] font-mono uppercase font-bold mt-1 tracking-wider opacity-90">OFF</span>
                        </div>

                        {/* Details */}
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Copyable Code */}
                            <button
                              type="button"
                              onClick={() => handleCopyCode(coupon.code)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-mono font-bold text-xs tracking-wider border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer group"
                              title="Click to copy promo code"
                            >
                              <span>{coupon.code}</span>
                              {copiedCode === coupon.code ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
                              )}
                            </button>

                            {/* Status Badges */}
                            {isLive ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold font-mono flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active & Live
                              </span>
                            ) : isPaused ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-semibold font-mono flex items-center gap-1">
                                <Power className="h-3 w-3 text-amber-600" />
                                Paused by Admin
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px] font-semibold font-mono">
                                Expired
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-700 dark:text-slate-300 font-normal leading-relaxed">
                            {coupon.desc}
                          </p>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono flex-wrap pt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              {coupon.expiryDate ? (
                                <span className={isExp ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}>
                                  {isExp ? 'Expired on ' : 'Expires: '}{formatCouponExpiry(coupon.expiryDate)}
                                </span>
                              ) : (
                                'Never Expires'
                              )}
                            </span>
                            <span>•</span>
                            <span>{coupon.redemptions} {coupon.redemptions === 1 ? 'Order' : 'Orders'}</span>
                            {coupon.totalSavingsGenerated > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-sans font-medium">
                                  Saved {currency} {coupon.totalSavingsGenerated.toLocaleString()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Activation Switch & Actions */}
                      <div className="flex items-center gap-3 shrink-0 self-end lg:self-center pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800 w-full lg:w-auto justify-between lg:justify-end">
                        
                        {/* Master Activation Toggle Switch */}
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none" htmlFor={`toggle-active-${coupon.code}`}>
                            {coupon.active && !isPaused ? 'Active' : 'Paused'}
                          </label>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              id={`toggle-active-${coupon.code}`}
                              checked={coupon.active && !isPaused}
                              onChange={() => handleToggleCoupon(coupon.code, coupon.active && !isPaused)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                          </label>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5">
                          {/* If expired or close to expiry: Extend button */}
                          {(isExp || !coupon.expiryDate) && (
                            <button
                              type="button"
                              onClick={() => handleExtendValidity(coupon.code)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                              title="Extend validity by 30 days & activate"
                            >
                              +30 Days
                            </button>
                          )}

                          {/* Simulate in Cart */}
                          <button
                            type="button"
                            onClick={() => {
                              setSimSelectedCoupon(coupon.code);
                              showToast(`Loaded "${coupon.code}" into discount simulator.`);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-semibold transition-colors cursor-pointer"
                            title="Load into discount simulator"
                          >
                            Simulate
                          </button>

                          {/* Edit Details */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(coupon)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
                            title="Edit promotion details"
                            id={`btn-edit-coupon-${coupon.code}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          {/* Delete Promo */}
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to permanently delete the promo code "${coupon.code}"?`)) {
                                onDeleteCoupon(coupon.code);
                                showToast(`Promotion "${coupon.code}" deleted.`);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                            title="Delete coupon"
                            id={`btn-delete-coupon-${coupon.code}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                      </div>

                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* Recent Coupon Redemptions Audit Log */}
          {orders.filter((o) => !!o.couponCode).length > 0 && (
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-3xs text-left" id="coupon-redemptions-audit">
              <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-4xs">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white font-sans">Recent Promo Redemptions</h3>
                    <p className="text-[11px] text-slate-400">Live order audit with attached promotional vouchers</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500">
                  {orders.filter((o) => !!o.couponCode).length} Total Uses
                </span>
              </div>

              <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800/80 max-h-60 overflow-y-auto custom-tab-scroll">
                {orders
                  .filter((o) => !!o.couponCode)
                  .slice(0, 10)
                  .map((order) => (
                    <div key={order.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{order.id}</span>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] font-bold">
                            {order.couponCode}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {order.customerName || 'Customer'} • {order.date ? new Date(order.date).toLocaleDateString() : 'Recent'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          -{currency} {(order.discountAmount || 0).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Total: {currency} {order.total.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

        </div>

        {/* Left Column (5 Cols on desktop, 12 on mobile): Top Announcement Bar Manager & Simulator */}
        <div className="xl:col-span-5 space-y-6 order-2 xl:order-1">
          
          {/* SECTION: Site-Wide Top Announcement Bar Manager */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-3xs text-left" id="promo-banner-admin-panel">
            <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-4xs">
                  <Megaphone className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-sans">Storefront Announcement Bar</h3>
                  <p className="text-[11px] text-slate-400">Header banner shown to all storefront visitors</p>
                </div>
              </div>

              {/* Master Toggle */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={bannerActive}
                  onChange={(e) => setBannerActive(e.target.checked)}
                  className="sr-only peer"
                  id="toggle-promo-banner-active"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                <span className="ml-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  {bannerActive ? 'Active' : 'Off'}
                </span>
              </label>
            </div>

            {/* Banner Live Preview */}
            <div className="mt-4">
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono tracking-wider">Live Preview</label>
              <div className={`mt-1.5 p-3 rounded-xl border transition-all text-center flex flex-col sm:flex-row items-center justify-center gap-2 shadow-2xs ${
                bannerActive
                  ? 'bg-slate-900 dark:bg-slate-950 text-white border-slate-800'
                  : 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 border-dashed border-slate-300 dark:border-slate-700'
              }`}>
                <span className="text-xs font-medium">{bannerText || 'Enter announcement message...'}</span>
                {bannerCode && (
                  <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-mono font-bold tracking-wider uppercase">
                    Code: {bannerCode}
                  </span>
                )}
                {!bannerActive && (
                  <span className="text-[10px] text-amber-500 font-mono font-bold">(Currently Disabled)</span>
                )}
              </div>
            </div>

            {/* Form Inputs */}
            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 font-sans mb-1">
                  Announcement Message
                </label>
                <input
                  type="text"
                  value={bannerText}
                  onChange={(e) => setBannerText(e.target.value)}
                  placeholder="e.g. FLASH SALE: Get 10% off your entire order with code VELOCE10!"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 font-sans"
                  id="input-promo-banner-text"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 font-sans mb-1">
                  Attached Promo Code (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={bannerCode}
                    onChange={(e) => setBannerCode(e.target.value.toUpperCase())}
                    placeholder="e.g. VELOCE10"
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 font-mono uppercase"
                    id="input-promo-banner-code"
                  />
                  {/* Dropdown of existing coupons */}
                  <select
                    onChange={(e) => {
                      if (e.target.value) setBannerCode(e.target.value);
                    }}
                    value=""
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
                  >
                    <option value="" disabled>Pick Code...</option>
                    {couponList.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.percent}%) {!c.isCurrentlyActive ? '[Inactive]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase font-mono tracking-wider mb-1.5">
                  Quick Message Templates
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {bannerPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setBannerText(preset.text);
                        setBannerCode(preset.code);
                        setBannerActive(true);
                      }}
                      className="px-2.5 py-1.5 text-left rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-slate-200/80 dark:border-slate-700/60 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-2 flex items-center justify-between">
                {bannerSaveSuccess ? (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in">
                    <Check className="h-4 w-4" /> Announcement Updated Live!
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">Updates storefront header immediately</span>
                )}
                <button
                  type="button"
                  onClick={handleSaveBanner}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  id="btn-save-promo-banner"
                >
                  Save & Publish Banner
                </button>
              </div>
            </div>
          </div>

          {/* SECTION: Discount Calculator & Simulator */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-3xs text-left" id="promo-discount-simulator">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-150 dark:border-slate-800">
              <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-4xs">
                <Percent className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-sans">Coupon Math & Cart Simulator</h3>
                <p className="text-[11px] text-slate-400">Test how active promo codes & flash deals compute at checkout</p>
              </div>
            </div>

            <div className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 font-sans mb-1">
                    Cart Subtotal ({currency})
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={simCartTotal}
                    onChange={(e) => setSimCartTotal(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 font-sans mb-1">
                    Select Coupon Code
                  </label>
                  <select
                    value={simSelectedCoupon}
                    onChange={(e) => setSimSelectedCoupon(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500 font-mono"
                  >
                    <option value="">None (No Coupon)</option>
                    {couponList.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} (-{c.percent}% {!c.isCurrentlyActive ? (c.expired ? '[EXPIRED]' : '[PAUSED]') : ''})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stack with Happy Hour toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-xs">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-rose-500" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Include Happy Hour Flash Discount (15%)</span>
                </div>
                <input
                  type="checkbox"
                  checked={simApplyHappyHour}
                  onChange={(e) => setSimApplyHappyHour(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                />
              </div>

              {/* Calculated Results Card */}
              <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Gross Order Amount:</span>
                  <span className="font-mono">{currency} {simulatorMath.baseAmount.toLocaleString()}</span>
                </div>

                {simSelectedCoupon && (
                  <div className="flex justify-between text-indigo-700 dark:text-indigo-300 font-medium">
                    <span>
                      Promo Code ({simSelectedCoupon}) -{simulatorMath.couponDiscountPct}%:
                    </span>
                    <span className="font-mono">
                      {simulatorMath.isCouponUsable
                        ? `-${currency} ${Math.round(simulatorMath.couponDeduction).toLocaleString()}`
                        : simulatorMath.isCouponPaused
                        ? 'PAUSED / DISABLED (0)'
                        : 'EXPIRED (0)'}
                    </span>
                  </div>
                )}

                {simApplyHappyHour && (
                  <div className="flex justify-between text-rose-600 dark:text-rose-400 font-medium">
                    <span>Happy Hour Flash Sale (-15%):</span>
                    <span className="font-mono">-{currency} {Math.round(simulatorMath.happyHourDeduction).toLocaleString()}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-indigo-200/70 dark:border-indigo-800/70 flex justify-between items-baseline font-bold text-slate-900 dark:text-white">
                  <span className="text-sm">Final Shopper Payable:</span>
                  <span className="text-base font-mono text-indigo-900 dark:text-indigo-200">
                    {currency} {Math.round(simulatorMath.finalAmount).toLocaleString()}
                  </span>
                </div>

                {simulatorMath.totalSavings > 0 ? (
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold text-right">
                    Customer saves {currency} {Math.round(simulatorMath.totalSavings).toLocaleString()} ({Math.round((simulatorMath.totalSavings / simulatorMath.baseAmount) * 100)}% overall)
                  </div>
                ) : simSelectedCoupon && !simulatorMath.isCouponUsable ? (
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold text-right">
                    ⚠️ Selected coupon is currently {simulatorMath.isCouponPaused ? 'inactive/paused' : 'expired'} and will not deduct discounts.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* CREATE / EDIT COUPON MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Tag className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-sans">
                    {editingCouponCode ? `Edit Promotion (${editingCouponCode})` : 'Create Promotional Coupon'}
                  </h3>
                  <p className="text-xs text-slate-400">Configure discount percentage and activation state</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCouponForm} className="mt-4 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Coupon Code Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 font-sans">
                    Promo Code <span className="text-rose-500">*</span>
                  </label>
                  {!editingCouponCode && (
                    <button
                      type="button"
                      onClick={handleGenerateCode}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" /> Auto-Generate
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                  placeholder="e.g. SUMMER25, VIP20"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white uppercase focus:outline-hidden focus:border-indigo-500"
                  id="input-new-coupon-code"
                />
              </div>

              {/* Discount Percentage */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 font-sans">
                    Discount Percentage <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {newPercent}% OFF
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="90"
                  step="5"
                  value={newPercent}
                  onChange={(e) => setNewPercent(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                  <span>5%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>90%</span>
                </div>
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 font-sans mb-1">
                  Expiration Date
                </label>
                <input
                  type="date"
                  value={newExpiry}
                  onChange={(e) => setNewExpiry(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500 font-sans"
                  id="input-new-coupon-expiry"
                />
                {/* Expiry Presets */}
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 7);
                      setNewExpiry(d.toISOString().split('T')[0]);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                  >
                    +7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 30);
                      setNewExpiry(d.toISOString().split('T')[0]);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                  >
                    +30 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 90);
                      setNewExpiry(d.toISOString().split('T')[0]);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                  >
                    +90 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewExpiry('')}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                  >
                    No Expiry
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 font-sans mb-1">
                  Campaign Description / Note
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="e.g. 20% off Summer clearance promotion"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 font-sans"
                  id="input-new-coupon-desc"
                />
              </div>

              {/* Activation Status Initial Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Initial Activation State</span>
                  <span className="text-[11px] text-slate-400">Coupon will be immediately usable at checkout</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsActive}
                    onChange={(e) => setNewIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  id="btn-submit-create-coupon"
                >
                  {editingCouponCode ? 'Save Changes' : 'Create & Activate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
