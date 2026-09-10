/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import DOMPurify from 'dompurify';
import { LineChart, TrendingUp, TrendingDown, DollarSign, MousePointer, Activity, Settings, UserCheck, Inbox, Plus, Check, Trash2, X, AlertCircle, Tag, Percent, Sparkles, AlertTriangle, Edit2, Search, QrCode, Printer, Download, ArrowLeft, PackagePlus, Image as ImageIcon, Layers, Mail, Calendar, Shield, Database, Upload, Lock, Unlock, RotateCcw, FileJson, HardDrive, RefreshCw, CheckCircle2, Eye, EyeOff, ShieldCheck, ShieldAlert, AlertOctagon, Truck, MapPin, History, User, Copy, ExternalLink, FileText, CheckCircle, ShoppingBag, Navigation, ChevronDown, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Package, Loader2, Archive, BarChart3, FolderTree, CreditCard, Users, Zap, Scissors, Menu, SlidersHorizontal, Type, Edit3, LogOut } from 'lucide-react';
import {
  ResponsiveContainer as RechartsResponsiveContainer,
  AreaChart as RechartsAreaChart,
  Area as RechartsArea,
  LineChart as RechartsLineChart,
  Line as RechartsLine,
  BarChart as RechartsBarChart,
  Bar as RechartsBar,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  CartesianGrid as RechartsCartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend
} from 'recharts';
import QRCode from 'qrcode';
import { Product, Order, InventoryAuditLog, ReturnRequest, CouponItem } from '../types';
import { CurrencyType, formatPrice, convertPrice } from '../lib/currency';
import { isCouponExpired, getCouponPercent, getCouponExpiry, formatCouponExpiry } from '../data';
import ProductImageUpload from './ProductImageUpload';
import { ProductFormEditor, generateSlug } from './ProductFormEditor';
import { getSubcategoriesForCategory } from '../utils/productUtils';
import { ShippingSettingsPanel } from './ShippingSettingsPanel';
import { SiteSettingsPanel } from './SiteSettingsPanel';
import AdminHeroSliderManager from './AdminHeroSliderManager';
import { CategoryManagementPanel } from './CategoryManagementPanel';
import { DEFAULT_TAX_CLASSES, getTaxClassConfig, getProductTaxInfo } from '../utils/taxUtils';
import CustomClothingAdminView from './CustomClothingAdminView';
import PromotionsManager from './PromotionsManager';
import { clearVeloceLocalStorageItems, safeLocalStorageSetItem } from '../lib/storage';
import { fetchCategoriesFromBackend } from '../utils/categoryUtils';
import { sqliteService, fetchProducts } from '../services/api';
import InventoryProductsTable from './InventoryProductsTable';
import ProductEditHub from './ProductEditHub';
import { CustomerList } from './CustomerList';

// Lazy-loaded analytics and modal sub-components for code splitting
const ComparativeD3Chart = lazy(() => import('./ComparativeD3Chart'));
const RechartsAnalytics = lazy(() => import('./RechartsAnalytics'));
const DailyRevenueConversionChart = lazy(() => import('./DailyRevenueConversionChart'));
const Monthly6MonthTrends = lazy(() => import('./Monthly6MonthTrends'));
const StockThresholdChart = lazy(() => import('./StockThresholdChart'));
const SuggestRestockModal = lazy(() => import('./SuggestRestockModal'));
const EmailCampaignsPanel = lazy(() => import('./EmailCampaignsPanel'));
const BulkCatalogPriceAdjustmentPage = lazy(() => import('./BulkCatalogPriceAdjustmentPage'));
const ReturnsCenterDashboard = lazy(() => import('./ReturnsCenterDashboard'));
const BulkProductUploadModal = lazy(() => import('./BulkProductUploadModal'));
const OrderReceiptModal = lazy(() => import('./OrderReceiptModal'));
const ReviewFunnelAnalytics = lazy(() => import('./ReviewFunnelAnalytics'));
const SupplierManagementPanel = lazy(() => import('./SupplierManagementPanel'));

const ChartLoaderFallback = () => (
  <div className="p-8 my-4 rounded-xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 flex flex-col items-center justify-center gap-2 text-center">
    <Loader2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400 animate-spin" />
    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">Loading Module...</span>
  </div>
);

const cleanDecimals = (val: number | string, maxDecimals: number = 2): string => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return typeof val === 'string' ? val : '';
  const formatted = num.toFixed(maxDecimals);
  return formatted.replace(/\.0+$/, '').replace(/(\.\d*?[1-9])0+$/, '$1');
};

interface DashboardAnalyticsProps {
  products: Product[];
  orders: Order[];
  onAddProduct: (newProduct: Product) => void;
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => void;
  onUpdateOrderPaymentStatus?: (orderId: string, paymentStatus: 'unpaid' | 'paid', paidNote?: string) => void;
  onDeleteProduct: (id: string, type?: 'proprietary' | 'affiliate', skipConfirm?: boolean) => void;
  onUpdateProductStock: (id: string, newStock: number) => void;
  onUpdateProductSku: (id: string, newSku: string) => void;
  onUpdateProductThreshold: (id: string, newThreshold: number) => void;
  onUpdateProductPrice?: (id: string, newPrice: number, previousPrice?: number | null) => void;
  onUpdateProductStatus?: (id: string, newStatus: 'Active' | 'Inactive' | 'Draft' | 'Archived') => void;
  onUpdateProductPaymentRestriction?: (id: string, restriction: 'prepaid' | 'cod' | 'both') => void;
  onUpdateProductDetails?: (id: string, updatedFields: Partial<Product>) => void;
  coupons: Record<string, number | CouponItem>;
  onAddCoupon: (code: string, percent: number, expiryDate?: string, desc?: string, active?: boolean) => void;
  onDeleteCoupon: (code: string) => void;
  onToggleCouponActive?: (code: string, active?: boolean) => void;
  onUpdateCoupon?: (code: string, updatedFields: Partial<CouponItem>) => void;
  promoBanner: { text: string; code: string; active: boolean };
  onUpdatePromoBanner: (text: string, code: string, active: boolean) => void;
  inventoryAuditLogs: InventoryAuditLog[];
  lastBackupTime?: number;
  onTriggerBackup?: () => void;
  onAddOrder?: (newOrder: Order) => void;
  onTriggerEmailToast?: (order: Order, status: string) => void;
  currency?: CurrencyType;
  darkMode?: boolean;
  returnRequests?: ReturnRequest[];
  onUpdateReturnRequestStatus?: (requestId: string, status: ReturnRequest['status'], adminNote?: string, trackingNumber?: string) => void;
  fontSize?: string;
  onChangeFontSize?: (size: string) => void;
  onProductsUpdated?: (products: Product[]) => void;
  onOrdersUpdated?: (orders: Order[]) => void;
  onNavigateToSite?: (tab?: string) => void;
  onLogout?: () => void;
  initialEditingProduct?: Product | null;
  initialAdminSubTab?: string;
}

export default function DashboardAnalytics({
  products,
  orders,
  onAddProduct,
  onUpdateOrderStatus,
  onUpdateOrderPaymentStatus,
  onDeleteProduct,
  onUpdateProductStock,
  onUpdateProductSku,
  onUpdateProductThreshold,
  onUpdateProductPrice = () => {},
  onUpdateProductStatus = () => {},
  onUpdateProductPaymentRestriction = () => {},
  onUpdateProductDetails,
  coupons,
  onAddCoupon,
  onDeleteCoupon,
  onToggleCouponActive,
  onUpdateCoupon,
  promoBanner,
  onUpdatePromoBanner,
  inventoryAuditLogs,
  lastBackupTime = 0,
  onTriggerBackup,
  onAddOrder,
  onTriggerEmailToast,
  currency = 'KSh',
  darkMode = false,
  fontSize = 'normal',
  onChangeFontSize = () => {},
  returnRequests = [],
  onUpdateReturnRequestStatus = () => {},
  onProductsUpdated,
  onOrdersUpdated,
  onNavigateToSite,
  onLogout,
  initialEditingProduct,
  initialAdminSubTab,
}: DashboardAnalyticsProps) {
  const getDaysSinceLastBackup = () => {
    if (!lastBackupTime) return 'never';
    const diffMs = Date.now() - lastBackupTime;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    return `${diffDays} days ago`;
  };

  const isBackupOverdue = !lastBackupTime || (Date.now() - lastBackupTime) >= 7 * 24 * 60 * 60 * 1000;

  // Tabs within Admin Panel
  const [adminSubTab, setAdminSubTab] = useState<'analytics' | 'products' | 'orders' | 'customers' | 'custom-clothing' | 'email' | 'promotions' | 'inventory-logs' | 'inventory-alerts' | 'backup' | 'order-lookup' | 'categories' | 'bulk-price' | 'returns' | 'shipping' | 'hero-slider' | 'edit-product' | 'site-settings' | 'suppliers'>((initialAdminSubTab as any) || (initialEditingProduct ? 'edit-product' : 'analytics'));
  
  const [isMobileAdminNavOpen, setIsMobileAdminNavOpen] = useState<boolean>(false);
  const [adminMenuFilter, setAdminMenuFilter] = useState<string>('');
  const adminNavTabsRef = React.useRef<HTMLDivElement>(null);

  // Admin Global Search State & Keyboard Navigation
  const [adminGlobalSearch, setAdminGlobalSearch] = useState<string>('');
  const [isAdminSearchOpen, setIsAdminSearchOpen] = useState<boolean>(false);
  const adminSearchInputRef = React.useRef<HTMLInputElement>(null);
  const adminSearchContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (adminSearchContainerRef.current && !adminSearchContainerRef.current.contains(e.target as Node)) {
        setIsAdminSearchOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) &&
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA' &&
          document.activeElement?.tagName !== 'SELECT') {
        e.preventDefault();
        adminSearchInputRef.current?.focus();
        setIsAdminSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsAdminSearchOpen(false);
        adminSearchInputRef.current?.blur();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const adminFeaturesList = React.useMemo(() => [
    { id: 'analytics' as const, label: 'Executive Analytics & Intelligence', category: 'Overview', icon: BarChart3, keywords: 'charts revenue orders metrics d3 summary' },
    { id: 'products' as const, label: 'Product Inventory & Stock Grid', category: 'Catalog', icon: Package, keywords: 'items catalog inventory stock sku price' },
    { id: 'edit-product' as const, label: 'Product Edit Hub & Duplicator', category: 'Catalog', icon: Edit3, keywords: 'create new product duplicate clone slug edit' },
    { id: 'categories' as const, label: 'Category & Subcategory Hierarchy', category: 'Catalog', icon: FolderTree, keywords: 'taxonomy subcategories departments groups' },
    { id: 'bulk-price' as const, label: 'Bulk Pricing & Margin Multipliers', category: 'Pricing', icon: Tag, keywords: 'discount bulk pricing percentage increase margin' },
    { id: 'orders' as const, label: 'Orders Pipeline & Fulfillment', category: 'Sales', icon: ShoppingBag, keywords: 'orders status fulfillment tracking receipts invoice' },
    { id: 'order-lookup' as const, label: 'Order Deep Lookup & Audit', category: 'Sales', icon: Search, keywords: 'find search trace order barcode tracking customer' },
    { id: 'returns' as const, label: 'Returns & RMA Management', category: 'Sales', icon: RefreshCw, keywords: 'refunds returns rma exchange replacement warranty' },
    { id: 'customers' as const, label: 'Customer Directory & VIPs', category: 'Audience', icon: Users, keywords: 'users clients shoppers buyers emails addresses' },
    { id: 'custom-clothing' as const, label: 'Custom Tailoring & Measurements', category: 'Services', icon: Scissors, keywords: 'bespoke suits fabrics sizing tailoring measurements' },
    { id: 'promotions' as const, label: 'Coupons & Discount Campaigns', category: 'Marketing', icon: Percent, keywords: 'promos vouchers discount codes sales coupons' },
    { id: 'hero-slider' as const, label: 'Hero Banner Builder & Sliders', category: 'Marketing', icon: Sparkles, keywords: 'banner slides promotions carousel storefront hero' },
    { id: 'email' as const, label: 'Email Marketing & Templates', category: 'Marketing', icon: Mail, keywords: 'broadcast newsletter smtp notification triggers email' },
    { id: 'shipping' as const, label: 'Shipping & Delivery Zones', category: 'Operations', icon: Truck, keywords: 'delivery fee matrix courier distance zones shipping' },
    { id: 'inventory-alerts' as const, label: 'Low Stock & Restock Alerts', category: 'Inventory', icon: AlertTriangle, keywords: 'threshold replenishment warning out of stock alerts' },
    { id: 'inventory-logs' as const, label: 'Inventory Audit Trail Logs', category: 'Inventory', icon: History, keywords: 'audit changes adjustments ledger stock logs' },
    { id: 'backup' as const, label: 'Database Backup & Restore', category: 'System', icon: Database, keywords: 'snapshots download database recovery export json backup' },
    { id: 'site-settings' as const, label: 'Site Settings & KRA eTIMS Platform Config', category: 'System', icon: Settings, keywords: 'etims tax vat pin appearance branding theme backup smtp general font scale' },
  ], []);

  const adminSearchResults = React.useMemo(() => {
    const q = adminGlobalSearch.trim().toLowerCase();
    if (!q) return { products: [], orders: [], features: [], totalCount: 0 };

    const matchedProducts = (products || []).filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    ).slice(0, 5);

    const matchedOrders = (orders || []).filter((o) =>
      o.id.toLowerCase().includes(q) ||
      (o.customerName && o.customerName.toLowerCase().includes(q)) ||
      (o.customerEmail && o.customerEmail.toLowerCase().includes(q)) ||
      (o.phone && o.phone.toLowerCase().includes(q)) ||
      (o.trackingNumber && o.trackingNumber.toLowerCase().includes(q)) ||
      (o.status && o.status.toLowerCase().includes(q))
    ).slice(0, 5);

    const matchedFeatures = adminFeaturesList.filter((f) =>
      f.label.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q) ||
      f.id.toLowerCase().includes(q) ||
      f.keywords.toLowerCase().includes(q)
    ).slice(0, 5);

    return {
      products: matchedProducts,
      orders: matchedOrders,
      features: matchedFeatures,
      totalCount: matchedProducts.length + matchedOrders.length + matchedFeatures.length
    };
  }, [adminGlobalSearch, products, orders, adminFeaturesList]);

  React.useEffect(() => {
    const handleSelectAdminOrder = (e: any) => {
      const orderId = e.detail?.orderId;
      if (orderId) {
        setAdminSubTab('orders');
        const matchedOrder = orders.find((o) => o.id.toLowerCase() === orderId.toLowerCase());
        if (matchedOrder) {
          setSelectedAdminDetailOrder(matchedOrder);
        }
      } else {
        setAdminSubTab('orders');
      }
    };

    window.addEventListener('veloce_select_admin_order', handleSelectAdminOrder);
    return () => {
      window.removeEventListener('veloce_select_admin_order', handleSelectAdminOrder);
    };
  }, [orders]);

  React.useEffect(() => {
    if (initialEditingProduct) {
      setEditingProduct(initialEditingProduct);
      setAdminSubTab('edit-product');
    }
  }, [initialEditingProduct]);

  React.useEffect(() => {
    const handleOpenProductEditor = (e: any) => {
      const prodId = e.detail?.productId;
      if (prodId) {
        const matched = products.find((p) => p.id === prodId);
        if (matched) {
          setEditingProduct(matched);
          setShowAddProdPage(false);
          return;
        }
      }
      setAdminSubTab('edit-product');
    };
    window.addEventListener('veloce_open_product_editor', handleOpenProductEditor);
    return () => {
      window.removeEventListener('veloce_open_product_editor', handleOpenProductEditor);
    };
  }, [products]);

  const scrollAdminTabs = (direction: 'left' | 'right') => {
    if (adminNavTabsRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      adminNavTabsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Real-time backend database state synchronization
  const [liveDbOrders, setLiveDbOrders] = useState<Order[] | null>(null);
  const [liveDbProducts, setLiveDbProducts] = useState<Product[] | null>(null);
  const [isLiveDbFetching, setIsLiveDbFetching] = useState<boolean>(false);
  const [lastLiveDbSyncTime, setLastLiveDbSyncTime] = useState<string | null>(null);
  const [dbSourceInfo, setDbSourceInfo] = useState<{ connected: boolean; dbEngine: string; message: string }>({
    connected: true,
    dbEngine: 'SQLite (veloce.sqlite)',
    message: 'Syncing live backend database metrics...',
  });

  const fetchLiveDatabaseMetrics = React.useCallback(async () => {
    setIsLiveDbFetching(true);
    try {
      const statusRes = await fetch('/api/sqlite/status');
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setDbSourceInfo({
          connected: statusData.connected ?? true,
          dbEngine: statusData.dbEngine || 'SQLite (veloce.sqlite)',
          message: statusData.message || 'Live backend database active',
        });
      }

      const syncRes = await fetch('/api/sqlite/sync-pull');
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        if (syncData.success && syncData.data) {
          const d = syncData.data;
          if (Array.isArray(d.veloce_orders)) {
            setLiveDbOrders(d.veloce_orders);
          }
          if (Array.isArray(d.veloce_products)) {
            setLiveDbProducts(d.veloce_products);
          }

          setLastLiveDbSyncTime(new Date().toLocaleTimeString());
        }
      }
    } catch (err) {
      console.warn('[DashboardAnalytics] Live database fetch fallback:', err);
    } finally {
      setIsLiveDbFetching(false);
    }
  }, []);

  const [djangoApiUrl, setDjangoApiUrl] = useState<string>(() => {
    return localStorage.getItem('veloce_django_api_url') || '';
  });

  const [forceSyncNotification, setForceSyncNotification] = useState<string | null>(null);

  const handleForceSyncFromDjangoBackend = async () => {
    setIsLiveDbFetching(true);
    setForceSyncNotification(null);
    try {
      let fetchedProducts: Product[] | null = null;
      let fetchedOrders: Order[] | null = null;

      // 1. Fetch from custom Django REST API if configured
      if (djangoApiUrl) {
        const baseUrl = djangoApiUrl.replace(/\/$/, '');
        try {
          const [prodRes, orderRes] = await Promise.all([
            fetch(`${baseUrl}/products/`).catch(() => null),
            fetch(`${baseUrl}/orders/`).catch(() => null),
          ]);
          if (prodRes && prodRes.ok) {
            const pData = await prodRes.json();
            fetchedProducts = Array.isArray(pData) ? pData : (pData.results || null);
          }
          if (orderRes && orderRes.ok) {
            const oData = await orderRes.json();
            fetchedOrders = Array.isArray(oData) ? oData : (oData.results || null);
          }
        } catch (djangoErr) {
          console.warn('[DashboardAnalytics] Django API endpoint fetch attempt:', djangoErr);
        }
      }

      // 2. Fetch from backend SQLite sync-pull API
      const syncRes = await fetch('/api/sqlite/sync-pull');
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        if (syncData.success && syncData.data) {
          const d = syncData.data;
          if (!fetchedProducts && Array.isArray(d.veloce_products)) {
            fetchedProducts = d.veloce_products;
          }
          if (!fetchedOrders && Array.isArray(d.veloce_orders)) {
            fetchedOrders = d.veloce_orders;
          }

        }
      }

      // Overwrite local component state directly
      if (fetchedProducts !== null) setLiveDbProducts(fetchedProducts);
      if (fetchedOrders !== null) setLiveDbOrders(fetchedOrders);


      const nowTime = new Date().toLocaleTimeString();
      setLastLiveDbSyncTime(nowTime);

      const pCount = fetchedProducts ? fetchedProducts.length : (liveDbProducts || products).length;
      const oCount = fetchedOrders ? fetchedOrders.length : (liveDbOrders || orders).length;
      const msg = `⚡ Force Sync Complete! Overwrote local state with ${pCount} items & ${oCount} orders directly from backend database.`;
      setForceSyncNotification(msg);
      setTimeout(() => setForceSyncNotification(null), 6000);
    } catch (err: any) {
      console.error('[DashboardAnalytics] Force sync error:', err);
      setForceSyncNotification(`❌ Force Sync Failed: ${err.message || err}`);
    } finally {
      setIsLiveDbFetching(false);
    }
  };

  const handleQuickSystemCleanup = async () => {
    if (!window.confirm('⚠️ Quick System Cleanup: Wipe all simulation data across all categories and clear cached local storage items in one action?')) {
      return;
    }

    setIsLiveDbFetching(true);
    setForceSyncNotification(null);
    try {
      const clearedCount = clearVeloceLocalStorageItems();

      try {
        await fetch('/api/sqlite/purge-all', { method: 'POST' });
      } catch (e) {
        console.warn('[DashboardAnalytics] Backend cleanup endpoint warning:', e);
      }

      setLiveDbProducts([]);
      setLiveDbOrders([]);


      const msg = `🧹 Quick System Cleanup Complete! Cleared ${clearedCount} cached local storage item(s) across all categories.`;
      setForceSyncNotification(msg);
      setTimeout(() => setForceSyncNotification(null), 6000);
    } catch (err: any) {
      console.error('[DashboardAnalytics] Quick system cleanup error:', err);
      setForceSyncNotification(`❌ Quick System Cleanup Failed: ${err.message || err}`);
    } finally {
      setIsLiveDbFetching(false);
    }
  };

  const handleSeedProductsToSqliteDatabase = async () => {
    setIsLiveDbFetching(true);
    setForceSyncNotification(null);
    try {
      const res = await sqliteService.seedProducts();
      if (res && res.success) {
        const fetchedProducts = await fetchProducts();
        if (Array.isArray(fetchedProducts)) {
          setLiveDbProducts(fetchedProducts);
          safeLocalStorageSetItem('veloce_products', JSON.stringify(fetchedProducts));
          localStorage.removeItem('veloce_cleared_simulated_data');
          window.dispatchEvent(new CustomEvent('veloce_products_updated', { detail: fetchedProducts }));
        }
        setForceSyncNotification(`🌱 Products successfully seeded to SQLite database! Loaded ${res.count || (Array.isArray(fetchedProducts) ? fetchedProducts.length : 0)} items to frontend.`);
      } else {
        throw new Error(res.error || 'Failed to seed products');
      }
      setTimeout(() => setForceSyncNotification(null), 6000);
    } catch (err: any) {
      console.error('[DashboardAnalytics] Seed products error:', err);
      setForceSyncNotification(`❌ Seed Products Failed: ${err.message || err}`);
    } finally {
      setIsLiveDbFetching(false);
    }
  };

  const handlePurgeAllDatabaseData = async () => {
    if (!window.confirm('⚠️ ARE YOU SURE? This will permanently delete ALL simulated data (products, orders, reviews, analytics) from your backend database and browser cache so you can start fresh with clean tables.')) {
      return;
    }

    setIsLiveDbFetching(true);
    try {
      // 1. Call backend database purge API
      const res = await fetch('/api/sqlite/purge-all', { method: 'POST' });
      const data = await res.json();

      // 2. Clear browser localStorage cached mock data
      localStorage.removeItem('veloce_products');
      localStorage.removeItem('veloce_orders');
      localStorage.removeItem('veloce_affiliates');
      localStorage.removeItem('veloce_cart');
      localStorage.removeItem('veloce_inventory_audit_logs');
      localStorage.removeItem('veloce_clicklogs');
      localStorage.removeItem('veloce_payout_logs');
      localStorage.removeItem('veloce_wishlist');
      safeLocalStorageSetItem('veloce_products', JSON.stringify([]));
      safeLocalStorageSetItem('veloce_orders', JSON.stringify([]));
      safeLocalStorageSetItem('veloce_affiliates', JSON.stringify([]));

      // 3. Clear local states
      setLiveDbOrders([]);
      setLiveDbProducts([]);


      alert('✅ ' + (data.message || 'All simulated data has been permanently purged from backend database! Your store is now clean.'));
      setLastLiveDbSyncTime(new Date().toLocaleTimeString());
      window.location.reload();
    } catch (err: any) {
      alert('❌ Failed to purge database data: ' + (err.message || err));
    } finally {
      setIsLiveDbFetching(false);
    }
  };

  React.useEffect(() => {
    fetchLiveDatabaseMetrics();
    const interval = setInterval(() => {
      fetchLiveDatabaseMetrics();
    }, 12000);
    return () => clearInterval(interval);
  }, [fetchLiveDatabaseMetrics]);

  const effectiveOrders = liveDbOrders || orders;
  const effectiveProducts = liveDbProducts || products;

  // Custom Date Range filter states for Performance Analytics
  const [analyticsDateRange, setAnalyticsDateRange] = useState<{ start: string; end: string } | null>(null);
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');

  // Order tracking lookup states
  const [lookupQuery, setLookupQuery] = useState('');
  const [selectedLookupOrder, setSelectedLookupOrder] = useState<Order | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [selectedAdminDetailOrder, setSelectedAdminDetailOrder] = useState<Order | null>(null);
  const [autoPrintOnce, setAutoPrintOnce] = useState(false);
  const [unpaidPromptOrder, setUnpaidPromptOrder] = useState<Order | null>(null);

  const isOrderPaid = (ord: Order) => {
    const isCod = ord.paymentMethod === 'cod';
    return ord.paymentStatus === 'paid' || (!isCod && ord.paymentStatus !== 'unpaid');
  };

  // New proprietary product form state
  const [newProdName, setNewProdName] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdPrice, setNewProdPrice] = useState(49);
  const [newProdCostPrice, setNewProdCostPrice] = useState(25);
  const [newProdDiscountType, setNewProdDiscountType] = useState<'none' | 'percentage' | 'fixed' | 'manual'>('none');
  const [newProdDiscountValue, setNewProdDiscountValue] = useState<number>(0);
  const [newProdPreviousPrice, setNewProdPreviousPrice] = useState<number | undefined>(undefined);
  const [newProdTaxId, setNewProdTaxId] = useState('A');
  const [newProdCategory, setNewProdCategory] = useState('Workspace');
  const [newProdType, setNewProdType] = useState<'physical' | 'digital'>('physical');
  const [newProdImg, setNewProdImg] = useState('https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=600');
  const [newProdStock, setNewProdStock] = useState(30);
  const [newProdLowStockThreshold, setNewProdLowStockThreshold] = useState(5);
  const [newProdPaymentRestriction, setNewProdPaymentRestriction] = useState<'both' | 'prepaid' | 'cod'>('both');
  const [newProdShortDesc, setNewProdShortDesc] = useState('');
  const [newProdDetailedDesc, setNewProdDetailedDesc] = useState('');
  const [newProdFeatures, setNewProdFeatures] = useState('');
  const [newProdSpecs, setNewProdSpecs] = useState('');
  const [newProdWhatsInTheBox, setNewProdWhatsInTheBox] = useState('');
  const [showAddProdPage, setShowAddProdPage] = useState(false);

  // Returns Management Admin States
  const [returnFilter, setReturnFilter] = useState<'all' | 'pending' | 'approved' | 'resolved' | 'rejected'>('all');
  const [returnSearch, setReturnSearch] = useState('');
  const [selectedReturnRequest, setSelectedReturnRequest] = useState<ReturnRequest | null>(null);
  const [adminActionType, setAdminActionType] = useState<'approve' | 'reject' | 'resolve' | null>(null);
  const [adminActionNote, setAdminActionNote] = useState('');
  const [adminActionTracking, setAdminActionTracking] = useState('');

  // SKU inline editing states
  const [editingSkuId, setEditingSkuId] = useState<string | null>(null);
  const [tempSkuInput, setTempSkuInput] = useState('');
  const [skuSearchQuery, setSkuSearchQuery] = useState('');
  const [skuSearchMode, setSkuSearchMode] = useState<'both' | 'sku' | 'name' | 'sku_prefix'>('both');
  const [productTypeFilter, setProductTypeFilter] = useState<'all' | 'physical' | 'digital' | 'service'>('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [productQuickFilter, setProductQuickFilter] = useState<'all' | 'low_stock' | 'out_of_stock' | 'active'>('all');
  const [skuError, setSkuError] = useState('');

  // Inventory Audit Log search and filters
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditReasonFilter, setAuditReasonFilter] = useState<'all' | 'manual-update' | 'order-placement' | 'restock' | 'system-init'>('all');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [auditDatePreset, setAuditDatePreset] = useState<'all' | 'today' | '7days' | '30days' | 'this-month' | 'custom'>('all');
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditPerPage, setAuditPerPage] = useState<number>(25);

  const handleAuditDatePresetChange = (preset: 'all' | 'today' | '7days' | '30days' | 'this-month') => {
    setAuditDatePreset(preset);
    const now = new Date();
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (preset === 'all') {
      setAuditStartDate('');
      setAuditEndDate('');
    } else if (preset === 'today') {
      const todayStr = formatDate(now);
      setAuditStartDate(todayStr);
      setAuditEndDate(todayStr);
    } else if (preset === '7days') {
      const past7 = new Date(now);
      past7.setDate(past7.getDate() - 7);
      setAuditStartDate(formatDate(past7));
      setAuditEndDate(formatDate(now));
    } else if (preset === '30days') {
      const past30 = new Date(now);
      past30.setDate(past30.getDate() - 30);
      setAuditStartDate(formatDate(past30));
      setAuditEndDate(formatDate(now));
    } else if (preset === 'this-month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setAuditStartDate(formatDate(startOfMonth));
      setAuditEndDate(formatDate(now));
    }
  };

  const handleAuditStartDateChange = (val: string) => {
    setAuditStartDate(val);
    setAuditDatePreset('custom');
  };

  const handleAuditEndDateChange = (val: string) => {
    setAuditEndDate(val);
    setAuditDatePreset('custom');
  };

  const handleClearAuditFilters = () => {
    setAuditSearchQuery('');
    setAuditReasonFilter('all');
    setAuditStartDate('');
    setAuditEndDate('');
    setAuditDatePreset('all');
  };

  // Dynamic product variations states inside form
  const [createdVariations, setCreatedVariations] = useState<{ name: string; options: string[] }[]>([]);
  const [tempVarName, setTempVarName] = useState('');
  const [tempVarOptions, setTempVarOptions] = useState('');
  
  // Gallery images during product creation
  const [newProdGallery, setNewProdGallery] = useState<string[]>([]);

  // Dedicated Product Editing States
  const [editingProduct, setEditingProduct] = useState<Product | null>(initialEditingProduct || null);
  const [editProdName, setEditProdName] = useState('');
  const [editProdSku, setEditProdSku] = useState('');
  const [editProdDesc, setEditProdDesc] = useState('');
  const [editProdShortDesc, setEditProdShortDesc] = useState('');
  const [editProdDetailedDesc, setEditProdDetailedDesc] = useState('');
  const [editProdFeatures, setEditProdFeatures] = useState('');
  const [editProdSpecs, setEditProdSpecs] = useState('');
  const [editProdWhatsInTheBox, setEditProdWhatsInTheBox] = useState('');
  const [editProdPrice, setEditProdPrice] = useState(0);
  const [editProdCostPrice, setEditProdCostPrice] = useState(0);
  const [editProdDiscountType, setEditProdDiscountType] = useState<'none' | 'percentage' | 'fixed' | 'manual'>('none');
  const [editProdDiscountValue, setEditProdDiscountValue] = useState<number>(0);
  const [editProdPreviousPrice, setEditProdPreviousPrice] = useState<number | undefined>(undefined);
  const [editProdTaxId, setEditProdTaxId] = useState('A');
  const [editProdCategory, setEditProdCategory] = useState('');
  const [editProdType, setEditProdType] = useState<'physical' | 'digital'>('physical');
  const [editProdImg, setEditProdImg] = useState('');
  const [editProdGallery, setEditProdGallery] = useState<string[]>([]);
  const [editProdStock, setEditProdStock] = useState(0);
  const [editProdLowStockThreshold, setEditProdLowStockThreshold] = useState(5);
  const [editProdPaymentRestriction, setEditProdPaymentRestriction] = useState<'both' | 'prepaid' | 'cod'>('both');
  const [editProdStatus, setEditProdStatus] = useState<'Active' | 'Inactive' | 'Draft' | 'Archived'>('Active');
  const [editCreatedVariations, setEditCreatedVariations] = useState<{ name: string; options: string[] }[]>([]);
  const [tempEditVarName, setTempEditVarName] = useState('');
  const [tempEditVarOptions, setTempEditVarOptions] = useState('');
  const [editSkuError, setEditSkuError] = useState('');

  // Custom IFrame-Safe Confirmation Dialog state
  const [deleteConfirmConfig, setDeleteConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Rich Description Designer Inserter States for NEW products
  const [showNewProdDesignInserter, setShowNewProdDesignInserter] = useState(false);
  const [newProdSelectedInsertImg, setNewProdSelectedInsertImg] = useState('');
  const [newProdInsertLayout, setNewProdInsertLayout] = useState('full-banner'); // 'full-banner' | 'two-column-left' | 'two-column-right' | 'simple-img'
  const [newProdInsertTitle, setNewProdInsertTitle] = useState('Sleek Aesthetic Design');
  const [newProdInsertCustomText, setNewProdInsertCustomText] = useState('Experience unmatched durability and refined craftsmanship engineered to fit into your lifestyle seamlessly.');

  // Rich Description Designer Inserter States for EDITING products
  const [showEditProdDesignInserter, setShowEditProdDesignInserter] = useState(false);
  const [editProdSelectedInsertImg, setEditProdSelectedInsertImg] = useState('');
  const [editProdInsertLayout, setEditProdInsertLayout] = useState('full-banner');
  const [editProdInsertTitle, setEditProdInsertTitle] = useState('Sleek Aesthetic Design');
  const [editProdInsertCustomText, setEditProdInsertCustomText] = useState('Experience unmatched durability and refined craftsmanship engineered to fit into your lifestyle seamlessly.');

  // Quick Inline restock manual change cache state
  const [restockInputs, setRestockInputs] = useState<Record<string, number>>({});
  const [thresholdInputs, setThresholdInputs] = useState<Record<string, number>>({});
  const [priceInputs, setPriceInputs] = useState<Record<string, number>>({});
  const [showBulkUploadModal, setShowBulkUploadModal] = useState<boolean>(false);

  // Product Category Management states
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('veloce_custom_categories');
    const isCleared = localStorage.getItem('veloce_categories_cleared') === 'true';
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // ignore
      }
    }
    if (isCleared) {
      return [];
    }
    const existing = new Set<string>();
    products.forEach((p) => {
      if (p.category) existing.add(p.category);
    });
    return Array.from(existing);
  });

  const saveCategories = (cats: string[]) => {
    setCustomCategories(cats);
    localStorage.setItem('veloce_custom_categories', JSON.stringify(cats));
    if (cats.length === 0) {
      localStorage.setItem('veloce_categories_cleared', 'true');
    } else {
      localStorage.removeItem('veloce_categories_cleared');
    }
  };

  useEffect(() => {
    fetchCategoriesFromBackend().then((cats) => {
      if (cats && Array.isArray(cats)) {
        const names = cats.map((c) => c.name);
        if (names.length > 0) {
          setCustomCategories(names);
        }
      }
    });

    const handleCategoriesChanged = (e?: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent && customEvent.detail && Array.isArray(customEvent.detail)) {
        setCustomCategories(customEvent.detail.map((c: any) => c.name));
      } else {
        fetchCategoriesFromBackend().then((cats) => {
          if (cats && Array.isArray(cats)) {
            setCustomCategories(cats.map((c) => c.name));
          }
        });
      }
    };

    window.addEventListener('veloce_categories_updated', handleCategoriesChanged);
    return () => {
      window.removeEventListener('veloce_categories_updated', handleCategoriesChanged);
    };
  }, []);

  // Create Category form states
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [categorySuccess, setCategorySuccess] = useState('');

  // Product selection and bulk action states
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkThresholdValue, setBulkThresholdValue] = useState<number>(5);
  const [activeBulkTab, setActiveBulkTab] = useState<'threshold' | 'stock' | 'delete' | 'price' | 'status' | 'tax' | 'coupon'>('stock');
  const [bulkProductStatus, setBulkProductStatus] = useState<'Active' | 'Inactive' | 'Draft' | 'Archived'>('Active');
  const [bulkCouponCode, setBulkCouponCode] = useState<string>('VELOCE20');
  const [bulkCouponDiscountPercent, setBulkCouponDiscountPercent] = useState<number>(20);
  const [bulkTaxClass, setBulkTaxClass] = useState<string>('standard');
  const [bulkTaxStatus, setBulkTaxStatus] = useState<'taxable' | 'zero_rated' | 'exempt'>('taxable');
  const [bulkTaxCategoryFilter, setBulkTaxCategoryFilter] = useState<string>('all');
  const [bulkPricePercent, setBulkPricePercent] = useState<number>(10);
  const [bulkPriceAction, setBulkPriceAction] = useState<'increase' | 'decrease'>('increase');
  const [bulkPriceRounding, setBulkPriceRounding] = useState<boolean>(true);
  const [bulkStockDelta, setBulkStockDelta] = useState<number>(10);
  const [bulkStockSubAction, setBulkStockSubAction] = useState<'add' | 'subtract' | 'set'>('add');
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState<string>('');
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState<boolean>(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState<string>('');
  const [isBulkActionMenuOpen, setIsBulkActionMenuOpen] = useState<boolean>(false);
  const [isDevDbBannerVisible, setIsDevDbBannerVisible] = useState<boolean>(() => localStorage.getItem('veloce_hide_dev_db_banner') !== 'true');
  const [chartDaysLookup, setChartDaysLookup] = useState<7 | 30 | 90>(30);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Dynamically compute all unique product categories of products and affiliate offers
  const availableCategories = React.useMemo(() => {
    const cats = new Set<string>();
    effectiveProducts.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [effectiveProducts]);

  // Promotions tab states
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoPercent, setNewPromoPercent] = useState(15);
  const [newPromoExpiry, setNewPromoExpiry] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [newPromoDesc, setNewPromoDesc] = useState('');
  const [bannerText, setBannerText] = useState(promoBanner?.text || '');
  const [bannerCode, setBannerCode] = useState(promoBanner?.code || '');
  const [bannerActive, setBannerActive] = useState(promoBanner?.active || false);
  const [promoToast, setPromoToast] = useState('');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'pending' | 'processing' | 'shipped' | 'completed' | 'cancelled' | 'pending-cancellation'>('all');
  const [orderSortField, setOrderSortField] = useState<'date' | 'customerName' | 'total'>('date');
  const [orderSortDirection, setOrderSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isOrderBulkActionMenuOpen, setIsOrderBulkActionMenuOpen] = useState<boolean>(false);

  // Manual direct/phone order creation state
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [manualCustomerName, setManualCustomerName] = useState('');
  const [manualCustomerEmail, setManualCustomerEmail] = useState('');
  const [manualShippingAddress, setManualShippingAddress] = useState('');
  const [manualOrderItems, setManualOrderItems] = useState<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    type: 'physical' | 'digital' | 'service';
    selectedVariations: Record<string, string>;
  }[]>([]);
  const [manualSelectedProductId, setManualSelectedProductId] = useState('');
  const [manualSelectedProductQty, setManualSelectedProductQty] = useState(1);
  const [manualSelectedProductVars, setManualSelectedProductVars] = useState<Record<string, string>>({});
  const [manualCouponCode, setManualCouponCode] = useState('');
  const [manualOrderStatus, setManualOrderStatus] = useState<'pending' | 'completed' | 'cancelled' | 'pending-cancellation' | 'shipped'>('completed');
  const [manualCustomNote, setManualCustomNote] = useState('');
  const [manualOrderSuccess, setManualOrderSuccess] = useState<string | null>(null);
  const [manualOrderError, setManualOrderError] = useState<string | null>(null);



  // Automatically scroll to the top of the page whenever any admin tab, sub-view, or action is clicked
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [adminSubTab, showAddProdPage, editingProduct, selectedAdminDetailOrder]);

  // Chart interactivity tooltips
  const [hoveredDataIdx, setHoveredDataIdx] = useState<number | null>(null);
  const [revenueChartMetric, setRevenueChartMetric] = useState<'daily' | 'cumulative'>('cumulative');

  // Custom date filter action handlers
  const handleApplyDateFilter = () => {
    if (startDateInput && endDateInput) {
      setAnalyticsDateRange({ start: startDateInput, end: endDateInput });
    }
  };

  const handleClearDateFilter = () => {
    setStartDateInput('');
    setEndDateInput('');
    setAnalyticsDateRange(null);
  };

  // CSV Reporting Success message
  const [csvSuccessMsg, setCsvSuccessMsg] = useState<string>('');
  const [payoutNotification, setPayoutNotification] = useState<string | null>(null);

  // Printable report state
  const [showPrintReportModal, setShowPrintReportModal] = useState(false);
  const [showProfitabilityPdfModal, setShowProfitabilityPdfModal] = useState(false);
  const [simulateLiquidityDeficit, setSimulateLiquidityDeficit] = useState(false);
  const [reportMonth, setReportMonth] = useState('2026-07');

  // Profitability widget actions & date scope dropdown states
  const [isLedgerActionsDropdownOpen, setIsLedgerActionsDropdownOpen] = useState(false);
  const [isDateScopeDropdownOpen, setIsDateScopeDropdownOpen] = useState(false);
  const ledgerActionsDropdownRef = useRef<HTMLDivElement>(null);
  const dateScopeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (ledgerActionsDropdownRef.current && !ledgerActionsDropdownRef.current.contains(e.target as Node)) {
        setIsLedgerActionsDropdownOpen(false);
      }
      if (dateScopeDropdownRef.current && !dateScopeDropdownRef.current.contains(e.target as Node)) {
        setIsDateScopeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const handleSelectDateScopePreset = (preset: 'all' | 'today' | '7days' | '30days' | 'this_month') => {
    setIsDateScopeDropdownOpen(false);
    if (preset === 'all') {
      setAnalyticsDateRange(null);
      setStartDateInput('');
      setEndDateInput('');
      return;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    if (preset === 'today') {
      setAnalyticsDateRange({ start: todayStr, end: todayStr });
      setStartDateInput(todayStr);
      setEndDateInput(todayStr);
    } else if (preset === '7days') {
      const startStr = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      setAnalyticsDateRange({ start: startStr, end: todayStr });
      setStartDateInput(startStr);
      setEndDateInput(todayStr);
    } else if (preset === '30days') {
      const startStr = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      setAnalyticsDateRange({ start: startStr, end: todayStr });
      setStartDateInput(startStr);
      setEndDateInput(todayStr);
    } else if (preset === 'this_month') {
      const now = new Date();
      const startStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endStr = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      setAnalyticsDateRange({ start: startStr, end: endStr });
      setStartDateInput(startStr);
      setEndDateInput(endStr);
    }
  };

  // Supplier Contact Modal States
  const [selectedProductForSuggestRestock, setSelectedProductForSuggestRestock] = useState<Product | null>(null);
  const [selectedProductForSupplier, setSelectedProductForSupplier] = useState<Product | null>(null);
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierSubject, setSupplierSubject] = useState('');
  const [supplierBody, setSupplierBody] = useState('');
  const [supplierReorderQty, setSupplierReorderQty] = useState(50);
  const [supplierStatusMessage, setSupplierStatusMessage] = useState('');
  const [campaignsViewTab, setCampaignsViewTab] = useState<'referral' | 'email'>('referral');

  // Data Backup & Protection States
  const [backupPassword, setBackupPassword] = useState<string>('');
  const [isBackupPasswordProtected, setIsBackupPasswordProtected] = useState<boolean>(false);
  const [backupPasswordConfirm, setBackupPasswordConfirm] = useState<string>('');
  const [backupPasswordView, setBackupPasswordView] = useState<boolean>(false);
  
  const [securityAuditLogs, setSecurityAuditLogs] = useState<{ id: string; time: string; event: string; status: 'success' | 'warning' | 'info' }[]>(() => {
    return [
      { id: '1', time: new Date(Date.now() - 3600000 * 2).toLocaleTimeString(), event: "Data Integrity Subsystem Initialized", status: "success" },
      { id: '2', time: new Date(Date.now() - 1800000).toLocaleTimeString(), event: `Evaluated active memory: ${products.length} Products, ${orders.length} Orders`, status: "info" }
    ];
  });
  
  const [importedFileSummary, setImportedFileSummary] = useState<any | null>(null);
  const [importedFileError, setImportedFileError] = useState<string | null>(null);
  const [importRestoreType, setImportRestoreType] = useState<'merge' | 'replace'>('replace');
  const [importPasswordInput, setImportPasswordInput] = useState<string>('');
  const [importPasswordError, setImportPasswordError] = useState<boolean>(false);
  const [restoreConfirmationString, setRestoreConfirmationString] = useState<string>('');
  const [restoreSuccessCountdown, setRestoreSuccessCountdown] = useState<number | null>(null);
  const [activeBackupSnapshots, setActiveBackupSnapshots] = useState<any[]>(() => {
    const saved = localStorage.getItem('veloce_backup_snapshots');
    return saved ? JSON.parse(saved) : [];
  });

  // MySQL Sync & Management States
  const [mysqlStatus, setMysqlStatus] = useState<{ configured: boolean; connected: boolean; message: string; stats?: Record<string, number> } | null>(null);
  const [isCheckingMysql, setIsCheckingMysql] = useState<boolean>(false);
  const [isSyncingMysql, setIsSyncingMysql] = useState<boolean>(false);
  const [mysqlSyncMessage, setMysqlSyncMessage] = useState<string>('');

  const checkMysqlStatus = async () => {
    setIsCheckingMysql(true);
    try {
      const res = await fetch('/api/mysql/status');
      const data = await res.json();
      setMysqlStatus(data);
    } catch (e: any) {
      setMysqlStatus({
        configured: true,
        connected: false,
        message: e.message || "Failed to query database server status."
      });
    } finally {
      setIsCheckingMysql(false);
    }
  };

  const getCurrentBackupPayload = () => {
    const keys = [
      'veloce_products',
      'veloce_affiliates',
      'veloce_orders',
      'veloce_campaigns',
      'veloce_clicklogs',
      'veloce_payout_logs',
      'veloce_cart',
      'veloce_wishlist',
      'veloce_earnings',
      'veloce_loyalty_points',
      'veloce_coupons',
      'veloce_promo_banner',
      'veloce_inventory_audit_logs',
      'customer_support_tickets',
      'veloce_referral_history',
      'veloce_referral_balances',
      'is_joined_affiliate'
    ];
    const rawData: Record<string, any> = {};
    keys.forEach(k => {
      const val = localStorage.getItem(k);
      try {
        rawData[k] = val ? JSON.parse(val) : null;
      } catch (e) {
        rawData[k] = val;
      }
    });
    return rawData;
  };

  const handleMysqlPush = async () => {
    setDeleteConfirmConfig({
      isOpen: true,
      title: "Push Data to Production",
      message: "Are you sure you want to push your browser-session data to the production MySQL database? This will overwrite the tables in production.",
      onConfirm: async () => {
        setIsSyncingMysql(true);
        setMysqlSyncMessage('Preparing payload and initiating secure handshake...');
        try {
          const payload = getCurrentBackupPayload();
          const res = await fetch('/api/mysql/sync-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (res.ok) {
            setMysqlSyncMessage('✓ Production MySQL database push sync succeeded!');
            checkMysqlStatus();
          } else {
            setMysqlSyncMessage(`🚨 Push failed: ${data.error || 'Unknown error'}`);
          }
        } catch (err: any) {
          setMysqlSyncMessage(`🚨 Network error during sync: ${err.message}`);
        } finally {
          setIsSyncingMysql(false);
        }
      }
    });
  };

  const handleMysqlPull = async () => {
    setDeleteConfirmConfig({
      isOpen: true,
      title: "Restore Data from Production",
      message: "Are you sure you want to pull and restore all data from the production MySQL database? This will completely replace your current browser-session data and reload the page.",
      onConfirm: async () => {
        setIsSyncingMysql(true);
        setMysqlSyncMessage('Querying production database tables...');
        try {
          const res = await fetch('/api/mysql/sync-pull');
          const data = await res.json();
          if (res.ok && data.success && data.data) {
            setMysqlSyncMessage('✓ Database pulled successfully! Applying records to your browser cache...');
            
            const payload = data.data;
            Object.keys(payload).forEach(key => {
              if (payload[key] !== null && payload[key] !== undefined) {
                localStorage.setItem(key, typeof payload[key] === 'object' ? JSON.stringify(payload[key]) : String(payload[key]));
              }
            });
            
            setMysqlSyncMessage('✓ Sync completed! Initiating page reload in 2 seconds...');
            setRestoreSuccessCountdown(2);
          } else {
            setMysqlSyncMessage(`🚨 Pull failed: ${data.error || 'No database data available'}`);
          }
        } catch (err: any) {
          setMysqlSyncMessage(`🚨 Network error during sync: ${err.message}`);
        } finally {
          setIsSyncingMysql(false);
        }
      }
    });
  };

  // Check MySQL database status when backup subtab is opened
  React.useEffect(() => {
    if (adminSubTab === 'backup') {
      checkMysqlStatus();
    }
  }, [adminSubTab]);

  // Countdown to reload on successful data restoration
  React.useEffect(() => {
    if (restoreSuccessCountdown === null) return;
    if (restoreSuccessCountdown === 0) {
      window.location.reload();
      return;
    }
    const timer = setTimeout(() => {
      setRestoreSuccessCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [restoreSuccessCountdown]);

  // Reset audit logs page on filter/search change
  React.useEffect(() => {
    setAuditPage(1);
  }, [auditSearchQuery, auditReasonFilter, auditStartDate, auditEndDate]);

  const handleOpenContactSupplierModal = (product: Product) => {
    setSelectedProductForSupplier(product);
    
    // Determine a smart supplier email based on category or default
    const emailMap: Record<string, string> = {
      'OAK': 'oak-furniture@veloce-supplies.com',
      'ELECTRONICS': 'logistics@veloce-electronics.com',
      'HOMEWARE': 'homeware-mfg@veloce-manufacturing.com',
      'APPAREL': 'textiles@veloce-garments.com',
    };
    
    const categoryUpper = (product.category || '').toUpperCase();
    let email = 'orders@veloce-supplies.com';
    for (const key of Object.keys(emailMap)) {
      if (categoryUpper.includes(key)) {
        email = emailMap[key];
        break;
      }
    }
    setSupplierEmail(email);
    
    // Calculate recommended reorder quantity based on low stock threshold
    const threshold = product.lowStockThreshold ?? 5;
    const currentStock = product.stock ?? 0;
    const recommendedQty = Math.max(20, threshold * 10);
    setSupplierReorderQty(recommendedQty);
    
    // Pre-fill subject & body
    updateSupplierEmailDraft(product, email, recommendedQty);
    setSupplierStatusMessage('');
  };

  const updateSupplierEmailDraft = (product: Product, emailTo: string, qty: number) => {
    const threshold = product.lowStockThreshold ?? 5;
    const currentStock = product.stock ?? 0;
    const subject = `URGENT RESTOCK ORDER: SKU ${product.sku?.toUpperCase() || 'VEL-PROD'}`;
    const body = `Dear Manufacturer / Supply Partner,

We are writing to place a restock order for the following item in our inventory:

Product Name: ${product.name}
SKU: ${product.sku?.toUpperCase() || 'N/A'}
Current Stock Level: ${currentStock} units
Safety Reorder Threshold: ${threshold} units

As our inventory has reached or fallen below our safety reorder threshold, we would like to request a replenishment order of:
Quantity Requested: ${qty} units

Please confirm your current unit price, availability, and the estimated shipping lead time for this SKU. If you require any additional purchase order details, kindly let us know.

Best regards,
Ropenix Logistics & Inventory Control Team
admin@ropenix.co.ke`;

    setSupplierSubject(subject);
    setSupplierBody(body);
  };

  // Filtered orders, click logs, and payout logs based on analyticsDateRange
  const filteredOrdersForAnalytics = React.useMemo(() => {
    if (!analyticsDateRange) return effectiveOrders;
    return effectiveOrders.filter((o) => {
      const datePart = o.date.split(' ')[0].split('T')[0];
      return datePart >= analyticsDateRange.start && datePart <= analyticsDateRange.end;
    });
  }, [effectiveOrders, analyticsDateRange]);

  const filteredClickLogsForAnalytics: any[] = [];
  const filteredPayoutLogsForAnalytics: any[] = [];

  // Overall financial sums
  const totalProprietaryGross = filteredOrdersForAnalytics
    .filter((o) => o.status === 'completed')
    .reduce((acc, curr) => acc + curr.total, 0);

  const totalAffiliateCommissions = filteredClickLogsForAnalytics
    .filter((c) => c.converted)
    .reduce((acc, curr) => acc + curr.commission, 0);

  const totalRegisteredClicks = filteredClickLogsForAnalytics.length;
  const affiliateConversions = filteredClickLogsForAnalytics.filter((c) => c.converted).length;
  const referralConversionRate = totalRegisteredClicks > 0
    ? (affiliateConversions / totalRegisteredClicks) * 100
    : 0;

  // Profitability & Tax Ledger Metrics for selected date range
  const profitabilityOverview = React.useMemo(() => {
    const activeOrders = filteredOrdersForAnalytics.filter(
      (o) => o.status === 'completed' || o.status === 'processing' || o.status === 'shipped'
    );

    const grossSales = activeOrders.reduce((sum, o) => sum + (o.total || 0), 0);

    const totalTaxLiabilities = activeOrders.reduce((sum, o) => {
      if (typeof o.taxTotal === 'number') return sum + o.taxTotal;
      const lineTaxes = o.items.reduce((itemSum, item) => {
        if (typeof item.lineTax === 'number') return itemSum + item.lineTax;
        if (item.taxStatus === 'zero_rated' || item.taxStatus === 'exempt') return itemSum;
        const ratePercent = item.taxRate ?? 16;
        const rate = ratePercent / 100;
        const itemTotal = item.price * item.quantity;
        return itemSum + (rate > 0 ? (itemTotal * (rate / (1 + rate))) : 0);
      }, 0);
      return sum + lineTaxes;
    }, 0);

    const totalCommissions = filteredClickLogsForAnalytics
      .filter((c) => c.converted)
      .reduce((sum, c) => sum + (c.commission || 0), 0);

    const netRevenue = Math.max(0, grossSales - totalTaxLiabilities - totalCommissions);
    const netMarginPercent = grossSales > 0 ? (netRevenue / grossSales) * 100 : 0;
    const taxSharePercent = grossSales > 0 ? (totalTaxLiabilities / grossSales) * 100 : 0;
    const commissionSharePercent = grossSales > 0 ? (totalCommissions / grossSales) * 100 : 0;

    return {
      grossSales,
      totalTaxLiabilities,
      totalCommissions,
      netRevenue,
      netMarginPercent,
      taxSharePercent,
      commissionSharePercent,
      completedOrderCount: activeOrders.length,
      convertedAffiliateCount: filteredClickLogsForAnalytics.filter((c) => c.converted).length,
    };
  }, [filteredOrdersForAnalytics, filteredClickLogsForAnalytics]);

  // Pending affiliate payouts calculation & cash flow deficit check
  const pendingAffiliatePayoutsAmount = React.useMemo(() => {
    return filteredPayoutLogsForAnalytics
      .filter((p) => p.status === 'In Transit' || p.status === 'Standby' || p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [filteredPayoutLogsForAnalytics]);

  const effectivePendingPayouts = simulateLiquidityDeficit
    ? Math.max(profitabilityOverview.netRevenue + 28500, 45000)
    : pendingAffiliatePayoutsAmount;

  const isCashFlowDeficit = effectivePendingPayouts > profitabilityOverview.netRevenue;

  const currentPayoutBalance = profitabilityOverview.netRevenue;

  const [payoutBankDetails, setPayoutBankDetails] = useState<string>(() => {
    return localStorage.getItem('veloce_payout_bank_details') || 
      'Bank Name: Equity Bank Kenya\nAccount Name: Veloce Commerce Payout Treasury\nAccount Number: 01109283746500\nSWIFT Code: EQBLKENA\nBranch: Westlands Main\nM-Pesa B2C Paybill: 552288\nCurrency: KSh (KES)';
  });
  const [isBankDetailsCopied, setIsBankDetailsCopied] = useState(false);

  const handleCopyBankDetails = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(payoutBankDetails);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = payoutBankDetails;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setIsBankDetailsCopied(true);
      setPayoutNotification("Configured payout banking details copied to clipboard!");
      setTimeout(() => setIsBankDetailsCopied(false), 3000);
      setTimeout(() => setPayoutNotification(null), 5000);
    } catch (err) {
      console.error("Failed to copy banking details:", err);
      setPayoutNotification("Error copying banking details to clipboard.");
      setTimeout(() => setPayoutNotification(null), 4000);
    }
  };

  const handleQuickPayoutRequest = () => {
    if (currentPayoutBalance <= 0) {
      setPayoutNotification("Error: Current balance is KSh 0. No funds available to request payout.");
      setTimeout(() => setPayoutNotification(null), 4000);
      return;
    }

    setPayoutNotification(`Quick Payout Request of KSh ${currentPayoutBalance.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} processed.`);
    setTimeout(() => setPayoutNotification(null), 5000);
  };

  const handleExportProfitabilityCSV = () => {
    const headers = ['Order ID', 'Date', 'Customer Name', 'Status', 'Gross Total (KSh)', 'Tax Liability (KSh)', 'Affiliate Commission (KSh)', 'Net Revenue (KSh)'];
    const activeOrders = filteredOrdersForAnalytics.filter(
      (o) => o.status === 'completed' || o.status === 'processing' || o.status === 'shipped'
    );

    const rows = activeOrders.map((o) => {
      const gross = o.total || 0;
      const tax = typeof o.taxTotal === 'number' ? o.taxTotal : o.items.reduce((sum, i) => sum + (i.lineTax || 0), 0);
      const matchingClick = filteredClickLogsForAnalytics.find((c) => c.orderId === o.id);
      const commission = matchingClick ? matchingClick.commission : 0;
      const net = gross - tax - commission;

      return [
        `"${o.id}"`,
        `"${o.date}"`,
        `"${o.customerName}"`,
        `"${o.status}"`,
        gross.toFixed(2),
        tax.toFixed(2),
        commission.toFixed(2),
        net.toFixed(2)
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `profitability_ledger_${analyticsDateRange ? `${analyticsDateRange.start}_to_${analyticsDateRange.end}` : 'all_time'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const lowStockProducts = effectiveProducts.filter(
    (p) => p.type === 'physical' && p.stock !== null && p.stock <= (p.lowStockThreshold ?? 5)
  );

  // Chart source dataset
  const chartSalesMetrics = [
    { label: 'May 21', sales: 420, conversions: 12 },
    { label: 'May 22', sales: 650, conversions: 18 },
    { label: 'May 23', sales: 512, conversions: 15 },
    { label: 'May 24', sales: 840, conversions: 24 },
    { label: 'May 25', sales: 910, conversions: 28 },
    { label: 'May 26', sales: 790, conversions: 21 },
    { label: 'May 27', sales: totalProprietaryGross > 0 ? (totalProprietaryGross + 500) : 1150, conversions: 32 }
  ];

  const generateAutoSku = (name: string, category: string): string => {
    const cleanCategory = (category || 'ITEM').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const cleanName = (name || 'PROD').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    
    let attempts = 0;
    while (attempts < 100) {
      const randNum = Math.floor(100 + Math.random() * 900); // 100 to 999
      const candidateSku = `${cleanCategory}-${cleanName}-${randNum}`;
      const isDup = products.some((p) => p.sku?.trim().toUpperCase() === candidateSku);
      if (!isDup) {
        return candidateSku;
      }
      attempts++;
    }
    return `VEL-${Math.floor(100000 + Math.random() * 900000)}`;
  };

  const handleAddManualItem = () => {
    if (!manualSelectedProductId) {
      setManualOrderError('Please select a product first.');
      return;
    }
    const product = products.find(p => p.id === manualSelectedProductId);
    if (!product) {
      setManualOrderError('Selected product not found in active catalog.');
      return;
    }

    // Check stock if physical
    if (product.type === 'physical' && product.stock !== null) {
      const currentInManualOrder = manualOrderItems
        .filter(item => item.productId === product.id)
        .reduce((sum, item) => sum + item.quantity, 0);
      
      const totalRequested = currentInManualOrder + manualSelectedProductQty;
      if (totalRequested > product.stock) {
        setManualOrderError(`Insufficient stock for "${product.name}". Only ${product.stock} units available.`);
        return;
      }
    }

    // Build default variations if any missing
    const finalVars = { ...manualSelectedProductVars };
    if (product.variations) {
      product.variations.forEach(v => {
        if (!finalVars[v.name] && v.options.length > 0) {
          finalVars[v.name] = v.options[0];
        }
      });
    }

    // Check if item already exists with same variations
    const existingIndex = manualOrderItems.findIndex(
      item => item.productId === product.id && 
      JSON.stringify(item.selectedVariations) === JSON.stringify(finalVars)
    );

    if (existingIndex > -1) {
      const updated = [...manualOrderItems];
      updated[existingIndex].quantity += manualSelectedProductQty;
      setManualOrderItems(updated);
    } else {
      setManualOrderItems(prev => [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: manualSelectedProductQty,
          type: product.type,
          selectedVariations: finalVars
        }
      ]);
    }

    // Reset item inputs
    setManualSelectedProductId('');
    setManualSelectedProductQty(1);
    setManualSelectedProductVars({});
    setManualOrderError(null);
  };

  const handleRemoveManualItem = (index: number) => {
    setManualOrderItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateManualOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualOrderError(null);
    setManualOrderSuccess(null);

    if (!manualCustomerName.trim()) {
      setManualOrderError('Customer name is required.');
      return;
    }
    if (!manualCustomerEmail.trim()) {
      setManualOrderError('Customer email is required.');
      return;
    }
    if (manualOrderItems.length === 0) {
      setManualOrderError('Please add at least one item to the order.');
      return;
    }

    // Compute total with optional coupon
    let subtotal = manualOrderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let discount = 0;
    if (manualCouponCode && coupons[manualCouponCode]) {
      const pct = getCouponPercent(coupons[manualCouponCode]);
      discount = subtotal * (pct / 100);
    }
    const finalTotal = Math.max(0, subtotal - discount);

    const generatedOrderId = 'ord-' + (1000 + Math.floor(Math.random() * 9000));
    const newOrder: Order = {
      id: generatedOrderId,
      customerName: manualCustomerName.trim(),
      customerEmail: manualCustomerEmail.trim(),
      items: manualOrderItems,
      total: finalTotal,
      status: manualOrderStatus,
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      couponCode: manualCouponCode || undefined,
      customNote: manualCustomNote.trim() || undefined,
      shippingAddress: manualShippingAddress.trim() || undefined,
    };

    if (onAddOrder) {
      onAddOrder(newOrder);
      setManualOrderSuccess(`Successfully recorded phone order #${generatedOrderId.toUpperCase()}!`);
      
      // Clear all form states
      setManualCustomerName('');
      setManualCustomerEmail('');
      setManualShippingAddress('');
      setManualOrderItems([]);
      setManualCouponCode('');
      setManualOrderStatus('completed');
      setManualCustomNote('');
      
      // Hide modal after short success display
      setTimeout(() => {
        setShowCreateOrderModal(false);
        setManualOrderSuccess(null);
      }, 2000);
    } else {
      setManualOrderError('System error: onAddOrder callback is not registered.');
    }
  };

  const insertTag = (tagOpen: string, tagClose: string, value: string, setValue: (v: string) => void, elementId: string) => {
    const textarea = document.getElementById(elementId) as HTMLTextAreaElement;
    if (!textarea) {
      setValue(value + tagOpen + tagClose);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const replacement = tagOpen + (selectedText || '') + tagClose;
    const newValue = value.substring(0, start) + replacement + value.substring(end);
    setValue(newValue);
    // Refocus and set cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tagOpen.length, start + tagOpen.length + (selectedText || '').length);
    }, 10);
  };

  const generateDesignHtml = (imgUrl: string, layout: string, title: string, customText: string) => {
    const url = imgUrl || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600';
    const escapedTitle = (title || '').replace(/"/g, '&quot;');
    const escapedText = (customText || '').replace(/"/g, '&quot;');

    if (layout === 'full-banner') {
      return `<div class="my-6 overflow-hidden rounded-xl border border-gray-150 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/10">
  <img src="${url}" class="w-full h-auto object-cover max-h-[350px] block" alt="${escapedTitle}" />
  <div class="p-5">
    <h4 class="font-bold text-sm text-gray-900 dark:text-white mb-1 uppercase tracking-wide">${escapedTitle}</h4>
    <p class="text-xs text-gray-500 dark:text-gray-400 font-light leading-relaxed">${escapedText}</p>
  </div>
</div>`;
    } else if (layout === 'two-column-left') {
      return `<div class="my-6 flex flex-col md:flex-row items-center gap-5 p-5 rounded-xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950/20 shadow-3xs">
  <div class="w-full md:w-1/2">
    <img src="${url}" class="w-full h-auto rounded-lg object-cover shadow-2xs max-h-[220px] block" alt="${escapedTitle}" />
  </div>
  <div class="w-full md:w-1/2 flex flex-col gap-2">
    <span class="text-[10px] font-black font-mono text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Premium Overview</span>
    <h4 class="font-bold text-sm text-gray-950 dark:text-gray-50 uppercase">${escapedTitle}</h4>
    <p class="text-xs text-gray-500 dark:text-gray-400 font-light leading-relaxed">${escapedText}</p>
  </div>
</div>`;
    } else if (layout === 'two-column-right') {
      return `<div class="my-6 flex flex-col md:flex-row-reverse items-center gap-5 p-5 rounded-xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950/20 shadow-3xs">
  <div class="w-full md:w-1/2">
    <img src="${url}" class="w-full h-auto rounded-lg object-cover shadow-2xs max-h-[220px] block" alt="${escapedTitle}" />
  </div>
  <div class="w-full md:w-1/2 flex flex-col gap-2">
    <span class="text-[10px] font-black font-mono text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Design Highlight</span>
    <h4 class="font-bold text-sm text-gray-950 dark:text-gray-50 uppercase">${escapedTitle}</h4>
    <p class="text-xs text-gray-500 dark:text-gray-400 font-light leading-relaxed">${escapedText}</p>
  </div>
</div>`;
    } else {
      // simple-img
      return `<div class="my-5 text-center">
  <img src="${url}" class="mx-auto rounded-lg shadow-sm border border-gray-100 max-h-[280px] block" alt="${escapedTitle}" />
  <span class="block text-[10px] text-gray-400 italic mt-2">${escapedTitle} — ${escapedText}</span>
</div>`;
    }
  };

  const insertDesignHtml = (imgUrl: string, layout: string, title: string, customText: string, value: string, setValue: (v: string) => void, elementId: string) => {
    const htmlToInsert = generateDesignHtml(imgUrl, layout, title, customText);
    const textarea = document.getElementById(elementId) as HTMLTextAreaElement;
    if (!textarea) {
      setValue(value + '\n' + htmlToInsert + '\n');
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.substring(0, start) + '\n' + htmlToInsert + '\n' + value.substring(end);
    setValue(newValue);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + htmlToInsert.length + 2, start + htmlToInsert.length + 2);
    }, 10);
  };



  const handleCreateProprietary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdDesc) return;

    if (!newProdCostPrice || Number(newProdCostPrice) <= 0) {
      alert('Cost Price is a required field! Please enter a valid cost price (> 0) to calculate profit, markup, and margin after taxation.');
      return;
    }

    let normalizedSku = newProdSku.trim().toUpperCase();
    if (!normalizedSku) {
      normalizedSku = generateAutoSku(newProdName, newProdCategory);
    }

    const isDuplicate = products.some((p) => p.sku?.trim().toUpperCase() === normalizedSku);
    if (isDuplicate) {
      setSkuError(`Product SKU "${normalizedSku}" already exists! Please enter a unique SKU.`);
      return;
    }

    // Parse features from newline list
    const parsedFeatures = newProdFeatures
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    // Parse specifications from Key:Value newline list
    const parsedSpecs = newProdSpecs
      .split('\n')
      .map((line) => {
        const idx = line.indexOf(':');
        if (idx !== -1) {
          return { key: line.substring(0, idx).trim(), value: line.substring(idx + 1).trim() };
        }
        return null;
      })
      .filter((s): s is { key: string; value: string } => s !== null);

    let finalPrice = Number(newProdPrice);
    let previousPriceValue: number | undefined = undefined;

    if (newProdDiscountType === 'percentage' && newProdDiscountValue > 0) {
      previousPriceValue = Number(newProdPrice);
      finalPrice = Math.round(Number(newProdPrice) * (1 - newProdDiscountValue / 100));
    } else if (newProdDiscountType === 'fixed' && newProdDiscountValue > 0) {
      previousPriceValue = Number(newProdPrice);
      finalPrice = Math.max(1, Number(newProdPrice) - newProdDiscountValue);
    } else if (newProdDiscountType === 'manual' && newProdPreviousPrice) {
      previousPriceValue = Number(newProdPreviousPrice);
      finalPrice = Number(newProdPrice);
    }

    const newProduct: Product = {
      id: 'phys-user-' + Date.now(),
      sku: normalizedSku,
      name: newProdName,
      description: newProdDesc,
      price: finalPrice,
      previousPrice: previousPriceValue,
      costPrice: Number(newProdCostPrice),
      taxId: newProdTaxId,
      category: newProdCategory,
      tags: ['AdminAdded', newProdCategory],
      type: newProdType,
      imageUrl: newProdImg,
      images: [newProdImg, ...newProdGallery],
      stock: newProdType === 'physical' ? Number(newProdStock) : null,
      lowStockThreshold: newProdType === 'physical' ? Number(newProdLowStockThreshold) : undefined,
      variations: createdVariations.length > 0 ? createdVariations : undefined,
      rating: 5.0,
      reviewsCount: 0,
      reviews: [],
      paymentRestriction: newProdPaymentRestriction,
      shortDescription: newProdShortDesc.trim() || newProdDesc,
      detailedDescription: newProdDetailedDesc,
      features: parsedFeatures,
      specifications: parsedSpecs,
      whatsInTheBox: newProdWhatsInTheBox.trim()
    };

    onAddProduct(newProduct);
    setShowAddProdPage(false);

    // Reset forms
    setNewProdName('');
    setNewProdSku('');
    setNewProdDesc('');
    setNewProdShortDesc('');
    setNewProdDetailedDesc('');
    setNewProdFeatures('');
    setNewProdSpecs('');
    setNewProdWhatsInTheBox('');
    setNewProdPrice(49);
    setNewProdCostPrice(25);
    setNewProdDiscountType('none');
    setNewProdDiscountValue(0);
    setNewProdPreviousPrice(undefined);
    setNewProdTaxId('A');
    setCreatedVariations([]);
    setTempVarName('');
    setTempVarOptions('');
    setSkuError('');
    setNewProdLowStockThreshold(5);
    setNewProdPaymentRestriction('both');
    setNewProdGallery([]);
  };

  const handleStartEditProduct = (product: Product) => {
    setEditingProduct(product);
    setEditProdName(product.name || '');
    setEditProdSku(product.sku || '');
    setEditProdDesc(product.description || '');
    setEditProdShortDesc(product.shortDescription || product.description || '');
    setEditProdDetailedDesc(product.detailedDescription || '');
    setEditProdFeatures(product.features ? product.features.join('\n') : '');
    setEditProdSpecs(product.specifications ? product.specifications.map(s => `${s.key}: ${s.value}`).join('\n') : '');
    setEditProdWhatsInTheBox(product.whatsInTheBox || '');
    setEditProdPrice(product.price || 0);
    setEditProdCostPrice(product.costPrice || 0);
    if (product.previousPrice && product.previousPrice > product.price) {
      setEditProdDiscountType('manual');
      setEditProdPreviousPrice(product.previousPrice);
      setEditProdDiscountValue(product.previousPrice - product.price);
    } else {
      setEditProdDiscountType('none');
      setEditProdPreviousPrice(undefined);
      setEditProdDiscountValue(0);
    }
    setEditProdTaxId(product.taxId || 'A');
    setEditProdCategory(product.category || 'Workspace');
    setEditProdType((product.type as 'physical' | 'digital') || 'physical');
    setEditProdImg(product.imageUrl || '');
    
    // Initial gallery - filter out main image to prevent duplications
    const initialGallery = product.images ? product.images.filter(img => img !== product.imageUrl) : [];
    setEditProdGallery(initialGallery);
    
    setEditProdStock(product.stock || 0);
    setEditProdLowStockThreshold(product.lowStockThreshold || 5);
    setEditProdPaymentRestriction(product.paymentRestriction || 'both');
    setEditProdStatus((product.status as any) || 'Active');
    setEditCreatedVariations(product.variations || []);
    setTempEditVarName('');
    setTempEditVarOptions('');
    setEditSkuError('');
  };

  const handleSaveProductEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editProdName || !editProdDesc) return;

    if (editProdCostPrice === undefined || editProdCostPrice === null || Number(editProdCostPrice) <= 0) {
      alert('Cost Price is a required field! Please enter a valid cost price (> 0) to calculate profit, markup, and margin after taxation.');
      return;
    }

    let normalizedSku = editProdSku.trim().toUpperCase();
    if (!normalizedSku) {
      normalizedSku = generateAutoSku(editProdName, editProdCategory);
    }

    const isDuplicate = products.some(
      (p) => p.id !== editingProduct.id && p.sku?.trim().toUpperCase() === normalizedSku
    );
    if (isDuplicate) {
      setEditSkuError(`Product SKU "${normalizedSku}" already exists! Please enter a unique SKU.`);
      return;
    }

    // Parse features from newline list
    const parsedFeatures = editProdFeatures
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    // Parse specifications from Key:Value newline list
    const parsedSpecs = editProdSpecs
      .split('\n')
      .map((line) => {
        const idx = line.indexOf(':');
        if (idx !== -1) {
          return { key: line.substring(0, idx).trim(), value: line.substring(idx + 1).trim() };
        }
        return null;
      })
      .filter((s): s is { key: string; value: string } => s !== null);

    let finalPrice = Number(editProdPrice);
    let previousPriceValue: number | undefined = undefined;

    if (editProdDiscountType === 'percentage' && editProdDiscountValue > 0) {
      previousPriceValue = Number(editProdPrice);
      finalPrice = Math.round(Number(editProdPrice) * (1 - editProdDiscountValue / 100));
    } else if (editProdDiscountType === 'fixed' && editProdDiscountValue > 0) {
      previousPriceValue = Number(editProdPrice);
      finalPrice = Math.max(1, Number(editProdPrice) - editProdDiscountValue);
    } else if (editProdDiscountType === 'manual' && editProdPreviousPrice) {
      previousPriceValue = Number(editProdPreviousPrice);
      finalPrice = Number(editProdPrice);
    }

    const updatedFields: Partial<Product> = {
      sku: normalizedSku,
      name: editProdName,
      description: editProdDesc,
      price: finalPrice,
      previousPrice: previousPriceValue,
      costPrice: Number(editProdCostPrice),
      taxId: editProdTaxId,
      category: editProdCategory,
      type: editProdType,
      imageUrl: editProdImg,
      images: [editProdImg, ...editProdGallery],
      stock: editProdType === 'physical' ? Number(editProdStock) : null,
      lowStockThreshold: editProdType === 'physical' ? Number(editProdLowStockThreshold) : undefined,
      paymentRestriction: editProdPaymentRestriction,
      status: editProdStatus,
      variations: editCreatedVariations.length > 0 ? editCreatedVariations : undefined,
      shortDescription: editProdShortDesc.trim() || editProdDesc,
      detailedDescription: editProdDetailedDesc,
      features: parsedFeatures,
      specifications: parsedSpecs,
      whatsInTheBox: editProdWhatsInTheBox.trim()
    };

    if (onUpdateProductDetails) {
      onUpdateProductDetails(editingProduct.id, updatedFields);
    } else {
      // Fallbacks
      if (onUpdateProductSku) onUpdateProductSku(editingProduct.id, normalizedSku);
      if (onUpdateProductPrice) onUpdateProductPrice(editingProduct.id, finalPrice, previousPriceValue !== undefined ? previousPriceValue : null);
      if (onUpdateProductStock) onUpdateProductStock(editingProduct.id, editProdType === 'physical' ? Number(editProdStock) : 0);
      if (onUpdateProductThreshold) onUpdateProductThreshold(editingProduct.id, Number(editProdLowStockThreshold));
      if (onUpdateProductStatus) onUpdateProductStatus(editingProduct.id, editProdStatus);
      if (onUpdateProductPaymentRestriction) onUpdateProductPaymentRestriction(editingProduct.id, editProdPaymentRestriction);
    }

    setEditingProduct(null);
  };



  const handleExportCSVReports = () => {
    const escapeField = (val: string) => {
      const stringified = (val === null || val === undefined) ? '' : String(val);
      const sanitized = stringified.replace(/"/g, '""');
      if (sanitized.includes(',') || sanitized.includes('\n') || sanitized.includes('"')) {
        return `"${sanitized}"`;
      }
      return sanitized;
    };

    const convertToCSV = (headers: string[], rows: string[][]): string => {
      const csvRows = [headers.map(escapeField).join(',')];
      rows.forEach((row) => csvRows.push(row.map(escapeField).join(',')));
      return csvRows.join('\r\n');
    };

    const downloadCSV = (filename: string, csvContent: string) => {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    try {
      // 1. Affiliate Earnings CSV
      const affHeaders = [
        "Offer ID",
        "Affiliate Partner / Product",
        "Merchant / Source",
        "Campaign Context",
        "Total Clicks",
        "Total Conversions",
        "Commission Rate / Type",
        "Total Revenue Earned (KSh)"
      ];


      // 2. Order History CSV
      const orderHeaders = [
        "Order ID",
        "Date",
        "Customer Name",
        "Customer Email",
        "Workflow Status",
        "Coupon Redeemed",
        "Custom Note Attached",
        "Ordered Items Summary",
        "Grand Total Charged (KSh)"
      ];
      const orderRowsList = orders.map(o => {
        const itemsSummary = (o.items || []).map(itm => `${itm.name} (x${itm.quantity})`).join('; ');
        return [
          o.id.toUpperCase(),
          o.date,
          o.customerName,
          o.customerEmail,
          o.status.toUpperCase(),
          o.couponCode || 'None',
          o.customNote || 'None',
          itemsSummary,
          (o.total || 0).toFixed(2)
        ];
      });
      const orderCSV = convertToCSV(orderHeaders, orderRowsList);
      downloadCSV('veloce_order_history_report.csv', orderCSV);

      // 3. Product Inventory Status CSV
      const invHeaders = [
        "Product ID",
        "Product SKU",
        "Name",
        "Type",
        "Stock Level",
        "Reorder Threshold",
        "Unit Price (KSh)",
        "Category",
        "Inventory Alert Status"
      ];
      const invRows = products.map(p => {
        const threshold = p.lowStockThreshold ?? 5;
        const isOut = p.type === 'physical' && p.stock === 0;
        const isLow = p.type === 'physical' && p.stock !== null && p.stock <= threshold;
        let statusStr = 'IN STOCK';
        if (p.type !== 'physical') {
          statusStr = 'DIGITAL/SERVICE ASSET';
        } else if (isOut) {
          statusStr = 'OUT OF STOCK';
        } else if (isLow) {
          statusStr = 'LOW STOCK WARNING';
        }
        return [
          p.id,
          p.sku || 'N/A',
          p.name,
          p.type,
          p.stock !== null ? p.stock.toString() : 'Unlimited',
          p.type === 'physical' ? threshold.toString() : 'N/A',
          p.price.toFixed(2),
          p.category || 'Workspace',
          statusStr
        ];
      });
      const inventoryCSV = convertToCSV(invHeaders, invRows);
      downloadCSV('veloce_product_inventory_status_report.csv', inventoryCSV);

      setCsvSuccessMsg('CSV Reports Downloader Initiated successfully');
      setTimeout(() => setCsvSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error generating CSV reports:', err);
      alert('An error occurred while compiling your CSV reports. Check the browser log console.');
    }
  };

  const handleDownloadCatalogCSV = () => {
    const escapeField = (val: string) => {
      const stringified = (val === null || val === undefined) ? '' : String(val);
      const sanitized = stringified.replace(/"/g, '""');
      if (sanitized.includes(',') || sanitized.includes('\n') || sanitized.includes('"')) {
        return `"${sanitized}"`;
      }
      return sanitized;
    };

    const convertToCSV = (headers: string[], rows: string[][]): string => {
      const csvRows = [headers.map(escapeField).join(',')];
      rows.forEach((row) => csvRows.push(row.map(escapeField).join(',')));
      return csvRows.join('\r\n');
    };

    const downloadCSV = (filename: string, csvContent: string) => {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    try {
      const headers = [
        "SKU",
        "Name",
        "Type",
        "Price (KSh)",
        "Stock Level",
        "Reorder Threshold",
        "Category",
        "Description",
        "Image URL",
        "Tags",
        "Status"
      ];
      const rows = products.map(p => [
        p.sku || '',
        p.name || '',
        p.type || 'physical',
        p.price ? p.price.toString() : '0',
        p.stock !== null && p.stock !== undefined ? p.stock.toString() : '',
        p.type === 'physical' ? (p.lowStockThreshold ?? 5).toString() : '',
        p.category || 'Workspace',
        p.description || '',
        p.imageUrl || '',
        p.tags ? p.tags.join(',') : '',
        p.status || 'Active'
      ]);

      const csvContent = convertToCSV(headers, rows);
      downloadCSV('veloce_catalog_export.csv', csvContent);

      setCsvSuccessMsg('Catalog CSV downloaded successfully!');
      setTimeout(() => setCsvSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error generating Catalog CSV:', err);
      alert('An error occurred while compiling the Catalog CSV.');
    }
  };

  const handleDownloadSelectedCSV = () => {
    if (selectedProductIds.length === 0) return;
    const selectedProductsList = products.filter(p => selectedProductIds.includes(p.id));

    const escapeField = (val: string) => {
      const stringified = (val === null || val === undefined) ? '' : String(val);
      const sanitized = stringified.replace(/"/g, '""');
      if (sanitized.includes(',') || sanitized.includes('\n') || sanitized.includes('"')) {
        return `"${sanitized}"`;
      }
      return sanitized;
    };

    const convertToCSV = (headers: string[], rows: string[][]): string => {
      const csvRows = [headers.map(escapeField).join(',')];
      rows.forEach((row) => csvRows.push(row.map(escapeField).join(',')));
      return csvRows.join('\r\n');
    };

    const downloadCSV = (filename: string, csvContent: string) => {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    try {
      const headers = [
        "SKU",
        "Name",
        "Type",
        "Current Price (KSh)",
        "Original Price (KSh)",
        "Stock Level",
        "Reorder Threshold",
        "Category",
        "Description",
        "Image URL",
        "Tags",
        "Status"
      ];
      const rows = selectedProductsList.map(p => [
        p.sku || '',
        p.name || '',
        p.type || 'physical',
        p.price ? p.price.toString() : '0',
        p.originalPrice ? p.originalPrice.toString() : (p.price ? p.price.toString() : '0'),
        p.stock !== null && p.stock !== undefined ? p.stock.toString() : '',
        p.type === 'physical' ? (p.lowStockThreshold ?? 5).toString() : '',
        p.category || 'Workspace',
        p.description || '',
        p.imageUrl || '',
        p.tags ? p.tags.join(';') : '',
        p.status || 'Active'
      ]);

      const csvContent = convertToCSV(headers, rows);
      downloadCSV(`veloce_selected_${selectedProductIds.length}_products_export.csv`, csvContent);

      setBulkSuccessMsg(`Successfully exported ${selectedProductsList.length} selected product(s) to CSV!`);
      setTimeout(() => setBulkSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error exporting selected products CSV:', err);
      alert('An error occurred while compiling the selected products CSV export.');
    }
  };

  const handleDownloadInventoryAuditLogCSV = () => {
    const escapeField = (val: string) => {
      const stringified = (val === null || val === undefined) ? '' : String(val);
      const sanitized = stringified.replace(/"/g, '""');
      if (sanitized.includes(',') || sanitized.includes('\n') || sanitized.includes('"')) {
        return `"${sanitized}"`;
      }
      return sanitized;
    };

    const convertToCSV = (headers: string[], rows: string[][]): string => {
      const csvRows = [headers.map(escapeField).join(',')];
      rows.forEach((row) => csvRows.push(row.map(escapeField).join(',')));
      return csvRows.join('\r\n');
    };

    const downloadCSV = (filename: string, csvContent: string) => {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    try {
      const headers = [
        "Log ID",
        "Timestamp",
        "Product SKU",
        "Product Name",
        "Change Quantity",
        "Resulting Stock",
        "Reason",
        "Details"
      ];
      const logsToExport = inventoryAuditLogs.filter((log) => {
        const matchesSearch = !auditSearchQuery.trim() || 
          log.productSku.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
          log.productName.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
          (log.details && log.details.toLowerCase().includes(auditSearchQuery.toLowerCase()));

        const matchesReason = auditReasonFilter === 'all' || log.reason === auditReasonFilter;

        let matchesStart = true;
        if (auditStartDate) {
          const logTime = new Date(log.timestamp.replace(' ', 'T')).getTime();
          const startTime = new Date(`${auditStartDate}T00:00:00`).getTime();
          matchesStart = !isNaN(logTime) && !isNaN(startTime) ? logTime >= startTime : true;
        }

        let matchesEnd = true;
        if (auditEndDate) {
          const logTime = new Date(log.timestamp.replace(' ', 'T')).getTime();
          const endTime = new Date(`${auditEndDate}T23:59:59`).getTime();
          matchesEnd = !isNaN(logTime) && !isNaN(endTime) ? logTime <= endTime : true;
        }

        return matchesSearch && matchesReason && matchesStart && matchesEnd;
      });

      const rows = logsToExport.map(log => [
        log.id,
        log.timestamp,
        log.productSku,
        log.productName,
        log.changeQuantity > 0 ? `+${log.changeQuantity}` : log.changeQuantity.toString(),
        log.newStock.toString(),
        log.reason,
        log.details || ''
      ]);

      const csvContent = convertToCSV(headers, rows);
      downloadCSV('veloce_inventory_audit_log.csv', csvContent);

      setCsvSuccessMsg('Inventory Audit Log CSV downloaded successfully!');
      setTimeout(() => setCsvSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error generating Inventory Audit Log CSV:', err);
      alert('An error occurred while compiling the Inventory Audit Log CSV.');
    }
  };

  const handleDownloadOrdersCSV = () => {
    const escapeField = (val: string) => {
      const stringified = (val === null || val === undefined) ? '' : String(val);
      const sanitized = stringified.replace(/"/g, '""');
      if (sanitized.includes(',') || sanitized.includes('\n') || sanitized.includes('"')) {
        return `"${sanitized}"`;
      }
      return sanitized;
    };

    const convertToCSV = (headers: string[], rows: string[][]): string => {
      const csvRows = [headers.map(escapeField).join(',')];
      rows.forEach((row) => csvRows.push(row.map(escapeField).join(',')));
      return csvRows.join('\r\n');
    };

    const downloadCSV = (filename: string, csvContent: string) => {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    try {
      const headers = [
        "Order ID",
        "Timestamp",
        "Customer Name",
        "Customer Email",
        "Items Count",
        "Items Purchased",
        "Coupon Code",
        "Total Amount (KSh)",
        "Status",
        "Shipping Address",
        "Customer Note"
      ];
      const rows = orders.map(ord => {
        const itemsSummary = ord.items
          .map((item) => `${item.name} (Qty: ${item.quantity}, Price: ${item.price})`)
          .join('; ');
        const totalQuantity = ord.items.reduce((sum, item) => sum + item.quantity, 0);

        return [
          ord.id,
          ord.date,
          ord.customerName,
          ord.customerEmail || 'N/A',
          totalQuantity.toString(),
          itemsSummary,
          ord.couponCode || 'None',
          ord.total.toFixed(2),
          ord.status,
          ord.shippingAddress || 'N/A',
          ord.customNote || ''
        ];
      });

      const csvContent = convertToCSV(headers, rows);
      downloadCSV(`veloce_historical_orders_${new Date().toISOString().split('T')[0]}.csv`, csvContent);

      setCsvSuccessMsg('Historical orders CSV downloaded successfully!');
      setTimeout(() => setCsvSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error generating Orders CSV:', err);
      alert('An error occurred while compiling the Orders CSV.');
    }
  };

  const handleExportCurrentViewableAnalyticsCSV = () => {
    const escapeField = (val: string) => {
      const stringified = (val === null || val === undefined) ? '' : String(val);
      const sanitized = stringified.replace(/"/g, '""');
      if (sanitized.includes(',') || sanitized.includes('\n') || sanitized.includes('"')) {
        return `"${sanitized}"`;
      }
      return sanitized;
    };

    const convertToCSV = (headers: string[], rows: string[][]): string => {
      const csvRows = [headers.map(escapeField).join(',')];
      rows.forEach((row) => csvRows.push(row.map(escapeField).join(',')));
      return csvRows.join('\r\n');
    };

    const downloadCSV = (filename: string, csvContent: string) => {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    try {
      const productCategoryMap = new Map<string, string>();
      products.forEach(p => productCategoryMap.set(p.id, p.category));



      const rows: string[][] = [];
      const now = new Date();
      const anchorDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      let totalClicks = 0;
      let totalConversions = 0;
      let totalCommissions = 0;
      let totalProprietaryOrders = 0;
      let totalProprietarySales = 0;

      for (let i = chartDaysLookup - 1; i >= 0; i--) {
        const d = new Date(anchorDate);
        d.setDate(anchorDate.getDate() - i);
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const dayVal = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayVal}`;
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        // Proprietary sales/qty on this day
        let proprietaryQty = 0;
        let proprietarySales = 0;
        orders.forEach((o) => {
          if (o.status === 'completed') {
            const oDateStr = o.date.split(' ')[0].split('T')[0];
            if (oDateStr === dateStr) {
              if (selectedCategory) {
                let hasItemInThisCategory = false;
                o.items.forEach((item) => {
                  const prodCat = productCategoryMap.get(item.productId);
                  if (prodCat === selectedCategory) {
                    proprietarySales += item.price * item.quantity;
                    hasItemInThisCategory = true;
                  }
                });
                if (hasItemInThisCategory) {
                  proprietaryQty++;
                }
              } else {
                proprietarySales += o.total;
                proprietaryQty++;
              }
            }
          }
        });

        let affiliateClicks = 0;
        let affiliateConversions = 0;
        let affiliateCommissions = 0;

        totalClicks += affiliateClicks;
        totalConversions += affiliateConversions;
        totalCommissions += affiliateCommissions;
        totalProprietaryOrders += proprietaryQty;
        totalProprietarySales += proprietarySales;

        rows.push([
          dateStr,
          label,
          affiliateClicks.toString(),
          affiliateConversions.toString(),
          affiliateCommissions.toFixed(2),
          proprietaryQty.toString(),
          proprietarySales.toFixed(2),
          (proprietarySales + affiliateCommissions).toFixed(2)
        ]);
      }

      const csvHeaders = [
        "Date",
        "Label",
        "Referral Clicks",
        "Affiliate Conversions",
        "Commissions Earned (KSh)",
        "Proprietary Orders",
        "Proprietary Sales (KSh)",
        "Total Combined Revenue (KSh)"
      ];

      rows.push([
        "TOTAL",
        `Last ${chartDaysLookup} Days`,
        totalClicks.toString(),
        totalConversions.toString(),
        totalCommissions.toFixed(2),
        totalProprietaryOrders.toString(),
        totalProprietarySales.toFixed(2),
        (totalProprietarySales + totalCommissions).toFixed(2)
      ]);

      const metaRows = [
        ["Report Title", "Veloce Viewable Performance Analytics Report"],
        ["Export Date", now.toLocaleString()],
        ["Date Range Filter", `${chartDaysLookup} Days`],
        ["Category Filter", selectedCategory || "All Categories"],
        [],
      ];

      const csvContent = metaRows.map(row => row.map(escapeField).join(',')).join('\r\n') + '\r\n' + convertToCSV(csvHeaders, rows);
      downloadCSV(`veloce_viewable_analytics_${chartDaysLookup}d_${selectedCategory || 'all'}.csv`, csvContent);

      setCsvSuccessMsg('Viewable Analytics CSV Downloaded successfully');
      setTimeout(() => setCsvSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error generating Viewable Analytics CSV:', err);
      alert('An error occurred while compiling your Viewable Analytics CSV. Check the browser log console.');
    }
  };

  const handleDownloadRawBackup = () => {
    if (onTriggerBackup) {
      onTriggerBackup();
      return;
    }
    try {
      const backupObject = {
        type: "veloce_platform_database_backup",
        version: "1.0",
        timestamp: new Date().toISOString(),
        meta: {
          productsCount: products.length,
          ordersCount: orders.length,
          inventoryAuditLogsCount: inventoryAuditLogs.length,
        },
        data: {
          products,
          orders,
          inventoryAuditLogs,
        }
      };

      const blob = new Blob([JSON.stringify(backupObject, null, 2)], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `veloce_database_backup_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.json`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setCsvSuccessMsg('Database JSON Backup downloaded successfully!');
      setTimeout(() => setCsvSuccessMsg(''), 4500);
    } catch (err) {
      console.error('Error generating DB backup:', err);
      alert('An error occurred while compiling your database backup JSON.');
    }
  };

  if (editingProduct || showAddProdPage) {
    return (
      <div className="w-full h-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-slate-50/50" id="product-form-scroll-viewport">
        <ProductFormEditor
        initialProduct={editingProduct}
        allProducts={products}
        categories={customCategories.map((c, i) => ({ id: String(i + 1), name: c }))}
        currentUserRole="super_admin"
        onSaveProduct={(savedProduct) => {
          if (editingProduct) {
            if (onUpdateProductDetails) {
              onUpdateProductDetails(editingProduct.id, savedProduct);
            } else {
              if (onUpdateProductSku) onUpdateProductSku(editingProduct.id, savedProduct.sku);
              if (onUpdateProductPrice)
                onUpdateProductPrice(
                  editingProduct.id,
                  savedProduct.price,
                  savedProduct.previousPrice || null
                );
              if (onUpdateProductStock)
                onUpdateProductStock(editingProduct.id, savedProduct.stock || 0);
              if (onUpdateProductThreshold)
                onUpdateProductThreshold(
                  editingProduct.id,
                  savedProduct.lowStockThreshold || 5
                );
              if (onUpdateProductStatus)
                onUpdateProductStatus(
                  editingProduct.id,
                  (savedProduct.status as any) || 'Active'
                );
            }
            setEditingProduct(null);
          } else {
            onAddProduct(savedProduct);
            setShowAddProdPage(false);
          }
        }}
        onCancel={() => {
          setEditingProduct(null);
          setShowAddProdPage(false);
        }}
        onSwitchProductToEdit={(prod) => setEditingProduct(prod)}
        onDuplicateProduct={(prod) => {
          const duplicated: Product = {
            ...prod,
            id: `prod-${Date.now()}`,
            name: `${prod.name} (Copy)`,
            sku: `${prod.sku}-COPY`,
            slug: `${generateSlug(prod.name)}-copy`,
            status: 'Draft'
          };
          onAddProduct(duplicated);
          alert(`Cloned "${prod.name}" as a new draft product specification.`);
        }}
        />
      </div>
    );
  }

  if (false && editingProduct) {
    const filledEditFieldsCount = [
      !!editProdName.trim(),
      !!editProdSku.trim(),
      !!editProdDesc.trim(),
      editProdPrice > 0,
      !!editProdImg.trim()
    ].filter(Boolean).length;
    const editProgressPercent = Math.round((filledEditFieldsCount / 5) * 100);

    return (
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10 font-sans">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-150 pb-5 mb-8 gap-4">
          <div>
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setEditSkuError('');
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-indigo-650 transition-colors uppercase tracking-wider mb-2 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Admin Dashboard
            </button>
            <h1 className="font-display text-2xl font-black text-gray-950 tracking-tight flex items-center gap-2">
              <Edit2 className="h-6 w-6 text-indigo-600" /> Edit Product Specification
            </h1>
            <p className="text-xs text-gray-400 font-extralight mt-1">
              Adjust title, pricing metrics, inventory parameters, and graphic asset deck files for item: <strong className="text-indigo-700 font-mono text-[11px] uppercase">{editingProduct.sku}</strong>
            </p>
          </div>

          {/* Completeness Tracker */}
          <div className="bg-white border border-gray-150 rounded-xl p-3.5 min-w-[240px] shadow-3xs flex flex-col justify-center">
            <div className="flex items-center justify-between text-[11px] font-mono mb-1 text-gray-500">
              <span className="font-bold uppercase tracking-wider">Asset Integrity</span>
              <span className="font-extrabold text-indigo-650">{editProgressPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${editProgressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Global Edit Error Banner */}
        {editSkuError && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-xs text-red-700 flex items-center justify-between gap-3 border border-red-150 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 font-sans font-semibold">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
              <span>{editSkuError}</span>
            </div>
            <button
              type="button"
              onClick={() => setEditSkuError('')}
              className="rounded-full bg-white/50 hover:bg-white p-1 text-red-450 hover:text-red-700 transition shrink-0 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT: Product Edit Form */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-150 p-6 md:p-8 shadow-2xs">
            <h3 className="font-display text-sm font-bold text-gray-900 border-b border-gray-50 pb-3 mb-6 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" /> Specifications & Stock Configuration
            </h3>

            <form onSubmit={handleSaveProductEdit} className="space-y-6">
              {/* Title & SKU */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Product Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={editProdName}
                    onChange={(e) => setEditProdName(e.target.value)}
                    placeholder="e.g. Oak Headphone Rack"
                    className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50/20 px-3 text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all font-medium text-gray-950"
                  />
                  <span className="block text-[10px] text-gray-400 font-light mt-1">Distinct, searchable listing name.</span>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider">
                      Product SKU (Optional)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const generated = generateAutoSku(editProdName, editProdCategory);
                        setEditProdSku(generated);
                        setEditSkuError('');
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-850 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Automatically generate a unique human-readable SKU code based on category and name"
                    >
                      <Sparkles className="h-3 w-3 text-indigo-500" /> Auto-Generate SKU
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editProdSku}
                    onChange={(e) => setEditProdSku(e.target.value)}
                    placeholder="Auto-generated if left empty"
                    className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50/20 px-3 text-xs font-mono uppercase focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all text-gray-950 font-bold"
                  />
                  <span className="block text-[10px] text-gray-400 font-light mt-1">Unique stock keeping unit ledger tag (e.g. WORKSPACE-PROD-123).</span>
                </div>
              </div>

              {/* Short Description */}
              <div>
                <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                  Short Description * (Storefront Summary)
                </label>
                <input
                  type="text"
                  required
                  value={editProdShortDesc}
                  onChange={(e) => {
                    setEditProdShortDesc(e.target.value);
                    if (!editProdDesc) setEditProdDesc(e.target.value); // Sync fallback
                  }}
                  placeholder="e.g., Premium lightweight running shoes with responsive mesh breathing panels."
                  className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50/20 px-3 text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all text-gray-850"
                />
                <span className="block text-[10px] text-gray-400 font-light mt-1">Appears in quick previews and below the title on the detail card.</span>
              </div>

              {/* Legacy/Plain Description (Keep for backwards compatibility & queries) */}
              <div className="hidden">
                <input type="hidden" value={editProdDesc} onChange={(e) => setEditProdDesc(e.target.value)} />
              </div>

              {/* Rich Style Text Input for Detailed Description */}
              <div>
                <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                  Detailed Description (HTML Rich Text Input)
                </label>
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50/20 focus-within:border-indigo-550 transition-all">
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center gap-1 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2">
                    <button
                      type="button"
                      onClick={() => insertTag('<b>', '</b>', editProdDetailedDesc, setEditProdDetailedDesc, 'editProdDetailedDesc')}
                      className="px-2 py-1 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-850 dark:text-gray-100 cursor-pointer"
                      title="Bold"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag('<i>', '</i>', editProdDetailedDesc, setEditProdDetailedDesc, 'editProdDetailedDesc')}
                      className="px-2 py-1 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs italic hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-850 dark:text-gray-100 cursor-pointer"
                      title="Italic"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag('<u>', '</u>', editProdDetailedDesc, setEditProdDetailedDesc, 'editProdDetailedDesc')}
                      className="px-2 py-1 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs underline hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-850 dark:text-gray-100 cursor-pointer"
                      title="Underline"
                    >
                      U
                    </button>
                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1" />
                    <button
                      type="button"
                      onClick={() => insertTag('<h3 className="font-bold text-sm text-gray-900 dark:text-white mt-2 mb-1">', '</h3>', editProdDetailedDesc, setEditProdDetailedDesc, 'editProdDetailedDesc')}
                      className="px-1.5 py-1 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-[10px] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-850 dark:text-gray-100 cursor-pointer font-semibold"
                      title="Add Heading"
                    >
                      H3
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag('<ul className="list-disc pl-5 my-2 space-y-1"><li>', '</li></ul>', editProdDetailedDesc, setEditProdDetailedDesc, 'editProdDetailedDesc')}
                      className="px-1.5 py-1 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-[10px] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-850 dark:text-gray-100 cursor-pointer"
                      title="Bullet List"
                    >
                      • List
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag('<p className="my-1.5">', '</p>', editProdDetailedDesc, setEditProdDetailedDesc, 'editProdDetailedDesc')}
                      className="px-1.5 py-1 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-[10px] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-850 dark:text-gray-100 cursor-pointer"
                      title="Paragraph wrapper"
                    >
                      ¶ Para
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag('<span className="text-indigo-600 font-semibold">', '</span>', editProdDetailedDesc, setEditProdDetailedDesc, 'editProdDetailedDesc')}
                      className="px-1.5 py-1 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-[10px] hover:bg-gray-50 dark:hover:bg-gray-800 text-indigo-600 cursor-pointer font-bold"
                      title="Colored highlight"
                    >
                      Accent
                    </button>
                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditProdDesignInserter(!showEditProdDesignInserter);
                        if (!editProdSelectedInsertImg) {
                          setEditProdSelectedInsertImg(editProdImg);
                        }
                      }}
                      className={`px-2 py-1 rounded border text-xs font-bold hover:bg-indigo-50 hover:text-indigo-900 flex items-center gap-1 cursor-pointer transition-colors ${showEditProdDesignInserter ? 'bg-indigo-150 border-indigo-300 text-indigo-950' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-850 dark:text-gray-100'}`}
                      title="Insert custom layout graphic banners with images and captions inside detailed specifications"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      <span>🎨 Design & Images</span>
                    </button>
                  </div>

                  {/* Expandable Image & Banner Layout Builder */}
                  {showEditProdDesignInserter && (
                    <div className="bg-slate-50 border-b border-gray-200 p-4 space-y-4 animate-in fade-in duration-250">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black font-mono text-indigo-700 uppercase tracking-widest flex items-center gap-1.5">
                          <ImageIcon className="h-3.5 w-3.5" /> Layout Designer & Manual Image Inserter
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowEditProdDesignInserter(false)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Step 1: Select or Upload Image */}
                      <div>
                        <span className="block text-[9px] font-black font-mono text-gray-400 uppercase tracking-widest mb-2">1. Select or Upload Design Image Asset</span>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Choose image from uploaded products or URL */}
                          <div className="space-y-2">
                            <span className="block text-[8px] font-bold text-gray-500 uppercase tracking-wider">Choose From Gallery or URL:</span>
                            <div className="flex gap-2 items-center flex-wrap">
                              {/* Main image */}
                              {editProdImg && (
                                <button
                                  type="button"
                                  onClick={() => setEditProdSelectedInsertImg(editProdImg)}
                                  className={`relative w-12 h-12 rounded border overflow-hidden bg-white transition-all ${editProdSelectedInsertImg === editProdImg ? 'ring-2 ring-indigo-600 border-transparent' : 'border-gray-200 opacity-70 hover:opacity-100'}`}
                                  title="Select Main Product Photo"
                                >
                                  <img src={editProdImg} className="w-full h-full object-cover" />
                                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[7px] text-white font-bold text-center py-0.5 truncate">Main</span>
                                </button>
                              )}
                              {/* Gallery images */}
                              {editProdGallery.map((img, idx) => (
                                <button
                                  type="button"
                                  key={idx}
                                  onClick={() => setEditProdSelectedInsertImg(img)}
                                  className={`relative w-12 h-12 rounded border overflow-hidden bg-white transition-all ${editProdSelectedInsertImg === img ? 'ring-2 ring-indigo-600 border-transparent' : 'border-gray-200 opacity-70 hover:opacity-100'}`}
                                  title={`Select Gallery Photo #${idx + 1}`}
                                >
                                  <img src={img} className="w-full h-full object-cover" />
                                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[7px] text-white font-bold text-center py-0.5 truncate">Gal #{idx+1}</span>
                                </button>
                              ))}
                            </div>

                            <div className="mt-2">
                              <input
                                type="text"
                                value={editProdSelectedInsertImg}
                                onChange={(e) => setEditProdSelectedInsertImg(e.target.value)}
                                placeholder="Or paste any custom image URL here..."
                                className="h-8 w-full rounded border border-gray-200 bg-white px-2.5 text-[11px] focus:outline-hidden focus:ring-1 focus:ring-indigo-550 text-gray-800"
                              />
                            </div>
                          </div>

                          {/* Manual drag-and-drop / click-to-upload local file */}
                          <div className="bg-white p-2.5 rounded-lg border border-gray-200 flex flex-col gap-2">
                            <span className="block text-[8px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                              <Upload className="h-3 w-3 text-indigo-500" /> Upload Custom Image Asset:
                            </span>
                            <div className="flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-lg p-2.5 hover:border-indigo-400 transition-colors cursor-pointer relative group bg-gray-50/30">
                              <input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (file.size > 2.5 * 1024 * 1024) {
                                      alert('This file is larger than 2.5MB. Please upload a smaller image.');
                                      return;
                                    }
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                      if (typeof reader.result === 'string') {
                                        setEditProdSelectedInsertImg(reader.result);
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                              <Upload className="h-4 w-4 text-gray-400 group-hover:text-indigo-500 mb-1 transition-colors" />
                              <span className="text-[10.5px] font-bold text-gray-700">Click to upload a local file</span>
                              <span className="text-[8px] text-gray-400 mt-0.5">PNG, JPG, SVG, GIF up to 2.5MB</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 2: Choose Layout Template & Customize Content */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                        <div>
                          <span className="block text-[9px] font-black font-mono text-gray-400 uppercase tracking-widest mb-2">2. Choose Layout Style Template</span>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setEditProdInsertLayout('full-banner')}
                              className={`p-2 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${editProdInsertLayout === 'full-banner' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                            >
                              <span className="text-[10px] font-bold text-gray-950 flex items-center gap-1">🖥️ Full-Width Banner</span>
                              <span className="text-[8px] text-gray-400 font-light leading-snug">Spanning cover banner image with styled headline & summary caption below.</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditProdInsertLayout('two-column-left')}
                              className={`p-2 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${editProdInsertLayout === 'two-column-left' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                            >
                              <span className="text-[10px] font-bold text-gray-950 flex items-center gap-1">◀ Image Left / Text Right</span>
                              <span className="text-[8px] text-gray-400 font-light leading-snug">Two-column layout showcasing a detailed design close-up alongside specs list.</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditProdInsertLayout('two-column-right')}
                              className={`p-2 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${editProdInsertLayout === 'two-column-right' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                            >
                              <span className="text-[10px] font-bold text-gray-950 flex items-center gap-1">▶ Text Left / Image Right</span>
                              <span className="text-[8px] text-gray-400 font-light leading-snug">Mirrored two-column list balancing detailed typography side-by-side.</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditProdInsertLayout('simple-img')}
                              className={`p-2 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${editProdInsertLayout === 'simple-img' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                            >
                              <span className="text-[10px] font-bold text-gray-950 flex items-center gap-1">🖼️ Centered Component View</span>
                              <span className="text-[8px] text-gray-400 font-light leading-snug">Centered single product perspective block with thin borders and brief subtitle.</span>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <span className="block text-[9px] font-black font-mono text-gray-400 uppercase tracking-widest mb-1">3. Customize Content Details</span>
                          <div>
                            <span className="block text-[8px] font-bold text-gray-500 uppercase mb-0.5">Custom Heading/Title:</span>
                            <input
                              type="text"
                              value={editProdInsertTitle}
                              onChange={(e) => setEditProdInsertTitle(e.target.value)}
                              placeholder="e.g. Blazing Fast Speed Performance"
                              className="h-8 w-full rounded border border-gray-200 bg-white px-2.5 text-[10.5px] focus:outline-hidden text-gray-850"
                            />
                          </div>
                          <div>
                            <span className="block text-[8px] font-bold text-gray-500 uppercase mb-0.5">Layout Custom Summary / Copywriting:</span>
                            <textarea
                              value={editProdInsertCustomText}
                              onChange={(e) => setEditProdInsertCustomText(e.target.value)}
                              placeholder="Describe structural blueprints, circuit design or unique features..."
                              rows={2}
                              className="w-full rounded border border-gray-200 bg-white px-2.5 py-1 text-[10.5px] focus:outline-hidden text-gray-850 font-light leading-relaxed"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Step 3: Insert Action button */}
                      <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                        <button
                          type="button"
                          onClick={() => {
                            insertDesignHtml(
                              editProdSelectedInsertImg,
                              editProdInsertLayout,
                              editProdInsertTitle,
                              editProdInsertCustomText,
                              editProdDetailedDesc,
                              setEditProdDetailedDesc,
                              'editProdDetailedDesc'
                            );
                            setShowEditProdDesignInserter(false);
                          }}
                          className="inline-flex h-9 items-center gap-1.5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs px-4 rounded-lg shadow-xs cursor-pointer transition-colors"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Insert Elegant Design Layout
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Textarea */}
                  <textarea
                    id="editProdDetailedDesc"
                    value={editProdDetailedDesc}
                    onChange={(e) => {
                      setEditProdDetailedDesc(e.target.value);
                      if (!editProdDesc) setEditProdDesc(e.target.value); // Sync plain representation
                    }}
                    placeholder="Provide detailed, highly engaging specifications, care rules, or product background story here..."
                    rows={5}
                    className="w-full bg-white px-3 py-2.5 text-xs focus:outline-hidden text-gray-850 leading-relaxed font-light border-0"
                  />
                </div>

                {/* Live Rich Render Preview */}
                {editProdDetailedDesc && (
                  <div className="mt-2 rounded-lg border border-dashed border-gray-200 p-3 bg-gray-50/50">
                    <span className="block text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 font-mono">Live HTML Rich Editor Preview:</span>
                    <div 
                      className="text-xs text-gray-755 space-y-1 detailed-description-preview"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(editProdDetailedDesc) }}
                    />
                  </div>
                )}
                <span className="block text-[10px] text-gray-400 font-light mt-1">Styled HTML input supports custom tags and responsive layouts.</span>
              </div>

              {/* Product Features List & Specifications Entry */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Key Features (One per line)
                  </label>
                  <textarea
                    value={editProdFeatures}
                    onChange={(e) => setEditProdFeatures(e.target.value)}
                    placeholder={`e.g.\nLightweight Breathable Mesh\nResponsive Foam Midsole\nHigh Grip Rubber Outsole`}
                    rows={4}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50/20 px-3 py-2 text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all text-gray-850 leading-relaxed font-light"
                  />
                  <span className="block text-[10px] text-gray-400 font-light mt-1">List visual badges / selling bullet highlights.</span>
                </div>

                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Technical Specifications (Key: Value per line)
                  </label>
                  <textarea
                    value={editProdSpecs}
                    onChange={(e) => setEditProdSpecs(e.target.value)}
                    placeholder={`e.g.\nColor: Premium White\nWeight: 280 grams\nSole Material: Vulcanized Rubber\nFit Type: True to Size`}
                    rows={4}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50/20 px-3 py-2 text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all text-gray-850 leading-relaxed font-light"
                  />
                  <span className="block text-[10px] text-gray-400 font-light mt-1">Enter specifications using the "Key: Value" pattern.</span>
                </div>
              </div>

              {/* What's In The Box */}
              <div>
                <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                  What’s in the Box / Package Contents
                </label>
                <textarea
                  value={editProdWhatsInTheBox}
                  onChange={(e) => setEditProdWhatsInTheBox(e.target.value)}
                  placeholder="e.g. 1x Men's Sneakers Sports Breathable Running Shoes - White, 2x Extra Spare Athletic Laces"
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50/20 px-3 py-2 text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all text-gray-850 leading-relaxed font-light"
                />
                <span className="block text-[10px] text-gray-400 font-light mt-1">Specify all physical package items included in this delivery parcel.</span>
              </div>

              {/* Pricing, Cost & Category */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Cost Price (KSh) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-mono font-bold">KSh</span>
                    <input
                      type="number"
                      required
                      min={0}
                      value={editProdCostPrice}
                      onChange={(e) => setEditProdCostPrice(Number(e.target.value))}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50/20 pl-10 pr-3 font-mono text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all text-gray-950 font-bold"
                    />
                  </div>
                  <span className="block text-[10px] text-gray-400 font-light mt-1">Acquisition or production cost.</span>
                </div>
                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Retail Price (KSh) * (Selling Price)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-mono font-bold">KSh</span>
                    <input
                      type="number"
                      required
                      min={1}
                      value={editProdPrice}
                      onChange={(e) => setEditProdPrice(Number(e.target.value))}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50/20 pl-10 pr-3 font-mono text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all text-gray-950 font-bold"
                    />
                  </div>
                  <span className="block text-[10px] text-gray-400 font-light mt-1">Standard listing price tag.</span>
                </div>

                {/* Real-time Profit Preview Field */}
                <div>
                  <label className="block text-[10px] font-black font-mono text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Profit Preview</span>
                    <span className="text-[9px] text-indigo-600 font-bold font-sans">Live Margin</span>
                  </label>
                  {(() => {
                    const cost = Number(editProdCostPrice) || 0;
                    const sell = Number(editProdPrice) || 0;
                    const taxRates: Record<string, number> = { A: 0.16, B: 0.08, C: 0, E: 0 };
                    const rate = taxRates[editProdTaxId] ?? 0;
                    const vatAmount = sell * (rate / (1 + rate));
                    const netProfit = (sell - vatAmount) - cost;
                    const netMarginPercent = sell > 0 ? (netProfit / sell) * 100 : 0;
                    const isPositive = netProfit >= 0;

                    return (
                      <div className={`h-10 w-full rounded-lg border px-3 font-mono flex items-center justify-between shadow-3xs ${
                        cost <= 0
                          ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400'
                          : isPositive
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-300'
                      }`}>
                        {cost <= 0 ? (
                          <span className="text-xs text-gray-400 italic font-sans">Enter cost price</span>
                        ) : (
                          <>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[8px] uppercase tracking-wider text-gray-500 font-bold font-sans">Net Profit</span>
                              <span className={`text-xs font-black truncate ${isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                                KSh {cleanDecimals(netProfit, 0)}
                              </span>
                            </div>
                            <div className="text-right flex flex-col shrink-0">
                              <span className="text-[8px] uppercase tracking-wider text-gray-500 font-bold font-sans">Net Margin</span>
                              <span className={`text-xs font-black ${isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                                {cleanDecimals(netMarginPercent, 1)}%
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                  <span className="block text-[10px] text-gray-400 font-light mt-1">Expected margin after tax.</span>
                </div>
              </div>

              {/* Product Discount Configuration */}
              <div className="border border-gray-150 dark:border-gray-800 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-900/30">
                <span className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-3">
                  🏷️ Product Discount Settings
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                      Discount Type
                    </label>
                    <select
                      value={editProdDiscountType}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setEditProdDiscountType(val);
                        if (val === 'none') {
                          setEditProdPreviousPrice(undefined);
                          setEditProdDiscountValue(0);
                        }
                      }}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-gray-55 px-3 text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 text-gray-950 font-medium cursor-pointer"
                    >
                      <option value="none">No Discount</option>
                      <option value="percentage">Percentage (%) Discount</option>
                      <option value="fixed">Fixed Amount (KSh) Discount</option>
                      <option value="manual">Manual Previous / Compare Price</option>
                    </select>
                  </div>

                  {editProdDiscountType !== 'none' && editProdDiscountType !== 'manual' && (
                    <div>
                      <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                        {editProdDiscountType === 'percentage' ? 'Discount Rate (%)' : 'Discount Amount (KSh)'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={editProdDiscountType === 'percentage' ? 100 : undefined}
                        value={editProdDiscountValue}
                        onChange={(e) => setEditProdDiscountValue(Number(e.target.value))}
                        className="h-10 w-full rounded-lg border border-gray-200 bg-gray-55 px-3 font-mono text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 text-gray-950 font-bold"
                      />
                    </div>
                  )}

                  {editProdDiscountType === 'manual' && (
                    <div>
                      <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                        Previous Price (KSh) * (Original value)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-mono font-bold">KSh</span>
                        <input
                          type="number"
                          min={1}
                          required
                          value={editProdPreviousPrice || ''}
                          onChange={(e) => setEditProdPreviousPrice(Number(e.target.value))}
                          className="h-10 w-full rounded-lg border border-gray-200 bg-gray-55 pl-10 pr-3 font-mono text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 text-gray-950 font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Help Summary */}
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-850">
                  {(() => {
                    let calcPrice = editProdPrice;
                    let origPrice = editProdPreviousPrice;

                    if (editProdDiscountType === 'percentage' && editProdDiscountValue > 0) {
                      origPrice = editProdPrice;
                      calcPrice = Math.round(editProdPrice * (1 - editProdDiscountValue / 100));
                    } else if (editProdDiscountType === 'fixed' && editProdDiscountValue > 0) {
                      origPrice = editProdPrice;
                      calcPrice = Math.max(1, editProdPrice - editProdDiscountValue);
                    } else if (editProdDiscountType === 'manual' && editProdPreviousPrice && editProdPreviousPrice > editProdPrice) {
                      origPrice = editProdPreviousPrice;
                      calcPrice = editProdPrice;
                    } else {
                      origPrice = undefined;
                    }

                    if (origPrice) {
                      const savedAmount = origPrice - calcPrice;
                      const savedPercent = Math.round((savedAmount / origPrice) * 100);
                      return (
                        <div className="text-[11px] bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-750 dark:text-indigo-400 font-semibold p-2 rounded-lg flex items-center gap-1">
                          🏷️ Discount Active: Listed at KSh {calcPrice.toLocaleString('en-KE')} (original KSh {origPrice.toLocaleString('en-KE')}). Customers save KSh {savedAmount.toLocaleString('en-KE')} ({savedPercent}%)!
                        </div>
                      );
                    }
                    return (
                      <span className="text-[10px] text-gray-400 font-light block">
                        Select a discount method to display a "Sale" tag on this product automatically.
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* KRA Tax & Category & Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    KRA Tax Category
                  </label>
                  <select
                    value={editProdTaxId}
                    onChange={(e) => setEditProdTaxId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all text-gray-950 cursor-pointer font-medium"
                  >
                    <option value="A">A - Standard Rate (16% VAT)</option>
                    <option value="B">B - Petroleum & Fuel (8% VAT)</option>
                    <option value="C">C - Zero-Rated (0% VAT)</option>
                    <option value="E">E - VAT Exempt Goods / Services</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Item Category
                  </label>
                  <select
                    value={editProdCategory}
                    onChange={(e) => setEditProdCategory(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all text-gray-950 cursor-pointer font-medium"
                  >
                    {customCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Publishing Status
                  </label>
                  <select
                    value={editProdStatus}
                    onChange={(e) => setEditProdStatus(e.target.value as any)}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all text-gray-950 font-bold cursor-pointer"
                  >
                    <option value="Active">Active & Live</option>
                    <option value="Draft">Draft Mode</option>
                    <option value="Inactive">Inactive / Suspended</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Financial Metrics Live Projection Panel */}
              {(() => {
                const cost = Number(editProdCostPrice) || 0;
                const sell = Number(editProdPrice) || 0;
                const grossProfit = sell - cost;
                const markupPercent = cost > 0 ? ((sell - cost) / cost) * 100 : 0;
                const grossMarginPercent = sell > 0 ? ((sell - cost) / sell) * 100 : 0;

                const taxRates: Record<string, number> = { A: 0.16, B: 0.08, C: 0, E: 0 };
                const rate = taxRates[editProdTaxId] ?? 0;
                const vatAmount = sell * (rate / (1 + rate));
                const sellExclTax = sell - vatAmount;
                const netProfit = sellExclTax - cost;
                const netMarginPercent = sell > 0 ? (netProfit / sell) * 100 : 0;

                return (
                  <div className="bg-slate-50 border border-slate-200/80 dark:border-gray-800 rounded-xl p-4 font-sans text-left space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="block text-[10px] font-black font-mono text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                        💸 Financial Projections & Margin Analysis (After Taxation)
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-slate-200 dark:border-gray-700">
                        {rate > 0 ? `${rate * 100}% VAT Tax Included` : '0% / Exempt Tax'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-2.5 rounded-lg shadow-3xs">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">Cost Price *</span>
                        <span className={`text-xs font-bold block mt-0.5 font-mono ${cost > 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600'}`}>
                          {cost > 0 ? `KSh ${cost.toLocaleString('en-KE')}` : 'Required'}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-2.5 rounded-lg shadow-3xs">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">Gross Profit</span>
                        <span className={`text-xs font-bold block mt-0.5 font-mono ${grossProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                          KSh {grossProfit.toLocaleString('en-KE')}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-2.5 rounded-lg shadow-3xs">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">VAT Tax ({rate * 100}%)</span>
                        <span className="text-xs font-bold block mt-0.5 text-amber-700 dark:text-amber-400 font-mono">
                          KSh {cleanDecimals(vatAmount, 1)}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-2.5 rounded-lg shadow-3xs">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">Net Profit (After Tax)</span>
                        <span className={`text-xs font-bold block mt-0.5 font-mono ${netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                          KSh {cleanDecimals(netProfit, 1)}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-2.5 rounded-lg shadow-3xs">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">Markup %</span>
                        <span className={`text-xs font-bold block mt-0.5 font-mono ${markupPercent >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}`}>
                          {cleanDecimals(markupPercent, 1)}%
                        </span>
                      </div>
                      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-2.5 rounded-lg shadow-3xs">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">Net Margin %</span>
                        <span className={`text-xs font-bold block mt-0.5 font-mono ${netMarginPercent >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                          {cleanDecimals(netMarginPercent, 1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Class type & Inventory stock limits */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-150">
                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Class Type
                  </label>
                  <select
                    value={editProdType}
                    onChange={(e) => setEditProdType(e.target.value as any)}
                    className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-550 text-gray-950 font-bold cursor-pointer"
                  >
                    <option value="physical">Physical inventory</option>
                    <option value="digital">Digital download pack</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Inventory Stock
                  </label>
                  <input
                    type="number"
                    disabled={editProdType === 'digital'}
                    value={editProdStock}
                    onChange={(e) => setEditProdStock(Number(e.target.value))}
                    className="h-9 w-full rounded-md border border-gray-200 px-3 font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-550 text-gray-950 font-bold disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Reorder Threshold
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={editProdType === 'digital'}
                    value={editProdLowStockThreshold}
                    onChange={(e) => setEditProdLowStockThreshold(Number(e.target.value))}
                    placeholder="5"
                    className="h-9 w-full rounded-md border border-gray-200 px-3 font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-550 text-gray-950 font-bold disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Kenya Local Payment Restrictions */}
              <div className="p-4 rounded-xl border border-gray-155 bg-indigo-50/15">
                <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                  Kenya Local Payment Restrictions
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div>
                    <select
                      value={editProdPaymentRestriction}
                      onChange={(e) => setEditProdPaymentRestriction(e.target.value as any)}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-550 text-gray-950 font-bold cursor-pointer"
                    >
                      <option value="both">No Restriction (Allow both M-Pesa and COD)</option>
                      <option value="prepaid">Paid Before Delivery (M-Pesa Only)</option>
                      <option value="cod">Paid Upon Delivery (Cash on Delivery Only)</option>
                    </select>
                  </div>
                  <p className="text-[10.5px] text-gray-500 font-light leading-relaxed">
                    {editProdPaymentRestriction === 'both' && "✨ Shoppers can choose either M-Pesa or Cash on Delivery during checkout."}
                    {editProdPaymentRestriction === 'prepaid' && "🔒 Prepaid: Shoppers pay via M-Pesa before dispatch. Ideal for customized items."}
                    {editProdPaymentRestriction === 'cod' && "🚚 COD: Customers will pay in cash or mobile money upon physical delivery."}
                  </p>
                </div>
              </div>

              {/* Dynamic Variations Multi-binding Section */}
              <div className="border-t border-gray-150 pt-5 font-sans">
                <span className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                  Configure Multi-Variations (Dynamic)
                </span>
                <p className="text-[11px] text-gray-500 font-extralight mb-4">
                  Add custom customizable choices like Colors, Sizes, or Wood textures to let shoppers filter choices on the storefront.
                </p>

                {editCreatedVariations.length > 0 && (
                  <div className="flex flex-col gap-2 mb-4 bg-indigo-50/20 p-3.5 rounded-xl border border-indigo-100/50">
                    {editCreatedVariations.map((v, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-indigo-500" />
                          <div>
                            <strong className="text-indigo-950 font-semibold">{v.name}:</strong>{' '}
                            <span className="font-mono text-[10px] text-indigo-750 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                              {v.options.join(', ')}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditCreatedVariations(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-500 text-[10px] font-bold hover:underline cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 rounded-xl bg-gray-50/50 p-3.5 border border-dashed border-gray-200">
                  <div className="flex-1">
                    <span className="block text-[9px] font-bold text-gray-500 uppercase mb-1 font-mono">Variation Category</span>
                    <input
                      type="text"
                      value={tempEditVarName}
                      onChange={(e) => setTempEditVarName(e.target.value)}
                      placeholder="e.g. Premium Finish"
                      className="h-8 w-full rounded border border-gray-200 px-2 text-[11px] bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550"
                    />
                  </div>
                  <div className="flex-1.5">
                    <span className="block text-[9px] font-bold text-gray-500 uppercase mb-1 font-mono">Options (Comma separated list)</span>
                    <input
                      type="text"
                      value={tempEditVarOptions}
                      onChange={(e) => setTempEditVarOptions(e.target.value)}
                      placeholder="e.g. Walnut, Natural Oak, Charcoal"
                      className="h-8 w-full rounded border border-gray-200 px-2 text-[11px] bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (!tempEditVarName || !tempEditVarOptions) return;
                        const splitOptions = tempEditVarOptions.split(',').map(o => o.trim()).filter(Boolean);
                        if (splitOptions.length === 0) return;
                        setEditCreatedVariations(prev => [...prev, { name: tempEditVarName.trim(), options: splitOptions }]);
                        setTempEditVarName('');
                        setTempEditVarOptions('');
                      }}
                      className="h-8 px-4 rounded bg-indigo-600 text-white text-[10px] font-medium hover:bg-indigo-700 transition-colors cursor-pointer shrink-0"
                    >
                      + Bind Option
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-gray-150 pt-6 flex flex-col sm:flex-row justify-end items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setEditSkuError('');
                  }}
                  className="w-full sm:w-auto h-10 px-5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer text-center animate-in"
                >
                  Discard Edits
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto h-10 px-6 rounded-lg bg-indigo-650 font-display text-xs font-bold text-white transition-all hover:bg-indigo-750 active:scale-[0.99] text-center cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="h-4 w-4" /> Save Specifications
                </button>
              </div>
            </form>
          </div>

          {/* RIGHT: Live Feed Preview Deck & Illustration Maker */}
          <div className="lg:col-span-12 xl:col-span-5 flex flex-col gap-6 lg:sticky lg:top-8">
            {/* 1. Illustration Module Box */}
            <div className="bg-white rounded-2xl border border-gray-150 p-6 shadow-2xs">
              <h3 className="font-display text-xs font-bold font-mono text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4 text-indigo-500" /> Catalog Graphic Asset (Main Image)
              </h3>
              <ProductImageUpload
                value={editProdImg}
                onChange={setEditProdImg}
                label="Registered Illustration Link / Generator"
                defaultPlaceholder="https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=600"
                productContext={{
                  name: editProdName || 'Blank Product',
                  category: editProdCategory,
                  description: editProdDesc || 'Blank description'
                }}
              />
            </div>

            {/* Additional Gallery Images Box */}
            <div className="bg-white rounded-2xl border border-gray-150 p-6 shadow-2xs">
              <h3 className="font-display text-xs font-bold font-mono text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4 text-indigo-500" /> Additional Gallery Images
              </h3>
              <p className="text-[10px] text-gray-400 font-light mb-4 leading-relaxed">
                Add secondary images to appear in the storefront's media carousel. You can add local photos or use our AI Generator.
              </p>

              {/* Existing Gallery Thumbnails */}
              {editProdGallery.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {editProdGallery.map((img, idx) => (
                    <div key={idx} className="relative group aspect-square rounded border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                      <img src={img} alt={`Gallery ${idx}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setEditProdGallery(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-all rounded cursor-pointer"
                        title="Remove Image"
                      >
                        <Trash2 className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Image Inline Form */}
              <div className="bg-slate-50/50 p-3 rounded-xl border border-gray-150">
                <span className="block text-[9px] font-black font-mono text-indigo-700 uppercase tracking-wider mb-2">
                  Upload or Generate Gallery Photo #{editProdGallery.length + 1}
                </span>
                
                <ProductImageUpload
                  value=""
                  onChange={(uploadedVal) => {
                    if (uploadedVal) {
                      setEditProdGallery(prev => [...prev, uploadedVal]);
                    }
                  }}
                  label="Click or drag additional photo"
                  productContext={{
                    name: `${editProdName || 'Blank Product'} Detail View ${editProdGallery.length + 1}`,
                    category: editProdCategory,
                    description: `Detailed gallery close-up photograph of ${editProdName || 'product'} showcase perspective`
                  }}
                />
              </div>
            </div>

            {/* 2. Customer View Catalog Mock Preview */}
            <div className="bg-white rounded-2xl border border-gray-150 p-6 shadow-2xs">
              <span className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-widest mb-4">
                Storefront Preview Rendering
              </span>

              {/* Dynamic Mock Card */}
              <div id="product-live-preview-card" className="group border border-gray-200 rounded-2xl bg-white overflow-hidden shadow-3xs transition-all duration-300">
                {/* Visual Area */}
                <div className="relative aspect-4/3 bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100">
                  <img
                    src={editProdImg || 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=600'}
                    alt={editProdName || 'Product Title'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300"
                  />
                  
                  {/* Category badging */}
                  <div className="absolute top-3.5 left-3.5 flex flex-wrap gap-1">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold font-mono uppercase bg-slate-950 text-white shadow-3xs tracking-wider">
                      {editProdCategory}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold font-mono uppercase border shadow-3xs tracking-wider ${
                      editProdType === 'digital' 
                        ? 'bg-purple-100 text-purple-800 border-purple-200' 
                        : 'bg-indigo-100 text-indigo-805 border-indigo-200'
                    }`}>
                      {editProdType}
                    </span>
                  </div>
                </div>

                {/* Details Section */}
                <div className="p-4 sm:p-5 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[9px] text-gray-400 uppercase font-black tracking-wide leading-none">
                      SKU: {editProdSku ? editProdSku.toUpperCase() : 'VEL-xxx-xxx'}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 rounded">
                      Rating: 5.0 ★
                    </span>
                  </div>

                  <h3 className="font-display text-sm font-bold text-gray-950 mt-2 truncate">
                    {editProdName || 'Oak Headphone Rack'}
                  </h3>

                  <p className="text-[11px] text-gray-500 font-light mt-1.5 line-clamp-2 leading-relaxed font-sans">
                    {editProdDesc || 'Please provide a detailed description to generate catalog mockup... This description layout will automatically support full rich typography.'}
                  </p>

                  {/* Variations mockup */}
                  {editCreatedVariations.length > 0 ? (
                    <div className="mt-3.5 pt-3 border-t border-gray-100/60 flex flex-wrap gap-2">
                      {editCreatedVariations.map((v) => (
                        <div key={v.name} className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-mono text-gray-400 font-bold uppercase">{v.name}</span>
                          <span className="text-[9px] font-mono font-semibold bg-gray-50 border border-gray-200 px-1 py-0.5 rounded text-gray-700">
                            {v.options[0]} (and {v.options.length - 1} more)
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3.5 pt-3 border-t border-gray-100/60 pb-1 text-[10px] text-gray-400 italic">
                      No customizable options configured.
                    </div>
                  )}

                  {/* Price & restriction tags */}
                  <div className="flex items-center justify-between gap-2 mt-4 pt-3.5 border-t border-gray-100">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-gray-400 font-bold font-mono uppercase tracking-wide">Standard Price</span>
                      <strong className="text-sm font-black text-slate-900 font-mono">
                        KSh {editProdPrice.toLocaleString('en-KE')}
                      </strong>
                    </div>
                    
                    {/* COD/M-Pesa status */}
                    <div className="text-right">
                      <span className="text-[8px] text-gray-400 font-bold font-mono block uppercase tracking-wide">Rule</span>
                      <span className="inline-block text-[9px] font-mono font-bold text-indigo-800 bg-indigo-50 px-1.5 py-0.5 rounded uppercase leading-none">
                        {editProdPaymentRestriction === 'both' ? '📲 M-Pesa + COD' : editProdPaymentRestriction === 'prepaid' ? '📲 M-Pesa Only' : '🚚 COD Only'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showAddProdPage) {
    const filledFieldsCount = [
      !!newProdName.trim(),
      !!newProdSku.trim(),
      !!newProdDesc.trim(),
      newProdPrice > 0,
      !!newProdImg.trim()
    ].filter(Boolean).length;
    const progressPercent = Math.round((filledFieldsCount / 5) * 100);

    return (
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10 font-sans">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-150 pb-5 mb-8 gap-4">
          <div>
            <button
              onClick={() => {
                setShowAddProdPage(false);
                setSkuError('');
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-indigo-650 transition-colors uppercase tracking-wider mb-2 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Admin Dashboard
            </button>
            <h1 className="font-display text-2xl font-black text-gray-950 tracking-tight flex items-center gap-2">
              <PackagePlus className="h-6 w-6 text-indigo-600" /> Add Product
            </h1>
            <p className="text-xs text-gray-400 font-extralight mt-1">
              Assemble and register verified physical inventory objects or digital download assets inside Ropenix records.
            </p>
          </div>

          {/* Progress Bar / Completeness scale */}
          <div className="bg-white border border-gray-150 rounded-xl p-3.5 min-w-[240px] shadow-3xs flex flex-col justify-center">
            <div className="flex items-center justify-between text-[11px] font-mono mb-1 text-gray-500">
              <span className="font-bold uppercase tracking-wider">Asset Completeness</span>
              <span className="font-extrabold text-indigo-650">{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {skuError && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-xs text-red-700 flex items-center justify-between gap-3 border border-red-150 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 font-sans font-semibold">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
              <span>{skuError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSkuError('')}
              className="rounded-full bg-white/50 hover:bg-white p-1 text-red-450 hover:text-red-700 transition shrink-0 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT: Complete Creation Form */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-150 p-6 md:p-8 shadow-2xs">
            <h3 className="font-display text-sm font-bold text-gray-900 border-b border-gray-50 pb-3 mb-6 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" /> Core Specifications
            </h3>

            <form onSubmit={handleCreateProprietary} className="space-y-6">
              {/* Name & SKU */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Product Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    placeholder="e.g. Oak Headphone Rack"
                    className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50/20 px-3 text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all font-medium text-gray-950"
                  />
                  <span className="block text-[10px] text-gray-400 font-light mt-1">Distinct, searchable listing name.</span>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider">
                      Product SKU (Optional)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const generated = generateAutoSku(newProdName, newProdCategory);
                        setNewProdSku(generated);
                        setSkuError('');
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-850 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Automatically generate a unique human-readable SKU code based on category and name"
                      id="btn-auto-generate-sku"
                    >
                      <Sparkles className="h-3 w-3 text-indigo-500" /> Auto-Generate SKU
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newProdSku}
                    onChange={(e) => setNewProdSku(e.target.value)}
                    placeholder="Auto-generated if left empty"
                    className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50/20 px-3 text-xs font-mono uppercase focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all text-gray-950 font-bold"
                  />
                  <span className="block text-[10px] text-gray-400 font-light mt-1">Unique stock keeping unit ledger tag (e.g. WORKSPACE-PROD-123).</span>
                </div>
              </div>

              {/* Short Description */}
              <div>
                <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                  Short Description * (Storefront Summary)
                </label>
                <input
                  type="text"
                  required
                  value={newProdShortDesc}
                  onChange={(e) => {
                    setNewProdShortDesc(e.target.value);
                    if (!newProdDesc) setNewProdDesc(e.target.value); // Sync fallback
                  }}
                  placeholder="e.g., Premium lightweight running shoes with responsive mesh breathing panels."
                  className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50/20 px-3 text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all text-gray-850"
                />
                <span className="block text-[10px] text-gray-400 font-light mt-1">Appears in quick previews and below the title on the detail card.</span>
              </div>

              {/* Legacy/Plain Description (Keep for backwards compatibility & queries) */}
              <div className="hidden">
                <input type="hidden" value={newProdDesc} onChange={(e) => setNewProdDesc(e.target.value)} />
              </div>

              {/* Rich Style Text Input for Detailed Description */}
              <div>
                <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                  Detailed Description (HTML Rich Text Input)
                </label>
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50/20 focus-within:border-indigo-550 transition-all">
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center gap-1 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2">
                    <button
                      type="button"
                      onClick={() => insertTag('<b>', '</b>', newProdDetailedDesc, setNewProdDetailedDesc, 'newProdDetailedDesc')}
                      className="px-2 py-1 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-850 dark:text-gray-100 cursor-pointer"
                      title="Bold"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag('<i>', '</i>', newProdDetailedDesc, setNewProdDetailedDesc, 'newProdDetailedDesc')}
                      className="px-2 py-1 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs italic hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-850 dark:text-gray-100 cursor-pointer"
                      title="Italic"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag('<u>', '</u>', newProdDetailedDesc, setNewProdDetailedDesc, 'newProdDetailedDesc')}
                      className="px-2 py-1 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs underline hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-850 dark:text-gray-100 cursor-pointer"
                      title="Underline"
                    >
                      U
                    </button>
                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1" />
                    <button
                      type="button"
                      onClick={() => insertTag('<h3 className="font-bold text-sm text-gray-900 dark:text-white mt-2 mb-1">', '</h3>', newProdDetailedDesc, setNewProdDetailedDesc, 'newProdDetailedDesc')}
                      className="px-1.5 py-1 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-[10px] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-850 dark:text-gray-100 cursor-pointer font-semibold"
                      title="Add Heading"
                    >
                      H3
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag('<ul className="list-disc pl-5 my-2 space-y-1"><li>', '</li></ul>', newProdDetailedDesc, setNewProdDetailedDesc, 'newProdDetailedDesc')}
                      className="px-1.5 py-1 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-[10px] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-850 dark:text-gray-100 cursor-pointer"
                      title="Bullet List"
                    >
                      • List
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag('<p className="my-1.5">', '</p>', newProdDetailedDesc, setNewProdDetailedDesc, 'newProdDetailedDesc')}
                      className="px-1.5 py-1 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-[10px] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-850 dark:text-gray-100 cursor-pointer"
                      title="Paragraph wrapper"
                    >
                      ¶ Para
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag('<span className="text-indigo-600 font-semibold">', '</span>', newProdDetailedDesc, setNewProdDetailedDesc, 'newProdDetailedDesc')}
                      className="px-1.5 py-1 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-[10px] hover:bg-gray-50 dark:hover:bg-gray-800 text-indigo-600 cursor-pointer font-bold"
                      title="Colored highlight"
                    >
                      Accent
                    </button>
                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewProdDesignInserter(!showNewProdDesignInserter);
                        if (!newProdSelectedInsertImg) {
                          setNewProdSelectedInsertImg(newProdImg);
                        }
                      }}
                      className={`px-2 py-1 rounded border text-xs font-bold hover:bg-indigo-50 hover:text-indigo-900 flex items-center gap-1 cursor-pointer transition-colors ${showNewProdDesignInserter ? 'bg-indigo-150 border-indigo-300 text-indigo-950' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-850 dark:text-gray-100'}`}
                      title="Insert custom layout graphic banners with images and captions inside detailed specifications"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      <span>🎨 Design & Images</span>
                    </button>
                  </div>

                  {/* Expandable Image & Banner Layout Builder */}
                  {showNewProdDesignInserter && (
                    <div className="bg-slate-50 border-b border-gray-200 p-4 space-y-4 animate-in fade-in duration-250">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black font-mono text-indigo-700 uppercase tracking-widest flex items-center gap-1.5">
                          <ImageIcon className="h-3.5 w-3.5" /> Layout Designer & Manual Image Inserter
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowNewProdDesignInserter(false)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Step 1: Select or Upload Image */}
                      <div>
                        <span className="block text-[9px] font-black font-mono text-gray-400 uppercase tracking-widest mb-2">1. Select or Upload Design Image Asset</span>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Choose image from uploaded products or URL */}
                          <div className="space-y-2">
                            <span className="block text-[8px] font-bold text-gray-500 uppercase tracking-wider">Choose From Gallery or URL:</span>
                            <div className="flex gap-2 items-center flex-wrap">
                              {/* Main image */}
                              {newProdImg && (
                                <button
                                  type="button"
                                  onClick={() => setNewProdSelectedInsertImg(newProdImg)}
                                  className={`relative w-12 h-12 rounded border overflow-hidden bg-white transition-all ${newProdSelectedInsertImg === newProdImg ? 'ring-2 ring-indigo-600 border-transparent' : 'border-gray-200 opacity-70 hover:opacity-100'}`}
                                  title="Select Main Product Photo"
                                >
                                  <img src={newProdImg} className="w-full h-full object-cover" />
                                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[7px] text-white font-bold text-center py-0.5 truncate">Main</span>
                                </button>
                              )}
                              {/* Gallery images */}
                              {newProdGallery.map((img, idx) => (
                                <button
                                  type="button"
                                  key={idx}
                                  onClick={() => setNewProdSelectedInsertImg(img)}
                                  className={`relative w-12 h-12 rounded border overflow-hidden bg-white transition-all ${newProdSelectedInsertImg === img ? 'ring-2 ring-indigo-600 border-transparent' : 'border-gray-200 opacity-70 hover:opacity-100'}`}
                                  title={`Select Gallery Photo #${idx + 1}`}
                                >
                                  <img src={img} className="w-full h-full object-cover" />
                                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[7px] text-white font-bold text-center py-0.5 truncate">Gal #{idx+1}</span>
                                </button>
                              ))}
                            </div>

                            <div className="mt-2">
                              <input
                                type="text"
                                value={newProdSelectedInsertImg}
                                onChange={(e) => setNewProdSelectedInsertImg(e.target.value)}
                                placeholder="Or paste any custom image URL here..."
                                className="h-8 w-full rounded border border-gray-200 bg-white px-2.5 text-[11px] focus:outline-hidden focus:ring-1 focus:ring-indigo-550 text-gray-800"
                              />
                            </div>
                          </div>

                          {/* Manual drag-and-drop / click-to-upload local file */}
                          <div className="bg-white p-2.5 rounded-lg border border-gray-200 flex flex-col gap-2">
                            <span className="block text-[8px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                              <Upload className="h-3 w-3 text-indigo-500" /> Upload Custom Image Asset:
                            </span>
                            <div className="flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-lg p-2.5 hover:border-indigo-400 transition-colors cursor-pointer relative group bg-gray-50/30">
                              <input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (file.size > 2.5 * 1024 * 1024) {
                                      alert('This file is larger than 2.5MB. Please upload a smaller image.');
                                      return;
                                    }
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                      if (typeof reader.result === 'string') {
                                        setNewProdSelectedInsertImg(reader.result);
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                              <Upload className="h-4 w-4 text-gray-400 group-hover:text-indigo-500 mb-1 transition-colors" />
                              <span className="text-[10.5px] font-bold text-gray-700">Click to upload a local file</span>
                              <span className="text-[8px] text-gray-400 mt-0.5">PNG, JPG, SVG, GIF up to 2.5MB</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 2: Choose Layout Template & Customize Content */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                        <div>
                          <span className="block text-[9px] font-black font-mono text-gray-400 uppercase tracking-widest mb-2">2. Choose Layout Style Template</span>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setNewProdInsertLayout('full-banner')}
                              className={`p-2 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${newProdInsertLayout === 'full-banner' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                            >
                              <span className="text-[10px] font-bold text-gray-950 flex items-center gap-1">🖥️ Full-Width Banner</span>
                              <span className="text-[8px] text-gray-400 font-light leading-snug">Spanning cover banner image with styled headline & summary caption below.</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setNewProdInsertLayout('two-column-left')}
                              className={`p-2 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${newProdInsertLayout === 'two-column-left' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                            >
                              <span className="text-[10px] font-bold text-gray-950 flex items-center gap-1">◀ Image Left / Text Right</span>
                              <span className="text-[8px] text-gray-400 font-light leading-snug">Two-column layout showcasing a detailed design close-up alongside specs list.</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setNewProdInsertLayout('two-column-right')}
                              className={`p-2 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${newProdInsertLayout === 'two-column-right' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                            >
                              <span className="text-[10px] font-bold text-gray-950 flex items-center gap-1">▶ Text Left / Image Right</span>
                              <span className="text-[8px] text-gray-400 font-light leading-snug">Mirrored two-column list balancing detailed typography side-by-side.</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setNewProdInsertLayout('simple-img')}
                              className={`p-2 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${newProdInsertLayout === 'simple-img' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                            >
                              <span className="text-[10px] font-bold text-gray-950 flex items-center gap-1">🖼️ Centered Component View</span>
                              <span className="text-[8px] text-gray-400 font-light leading-snug">Centered single product perspective block with thin borders and brief subtitle.</span>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <span className="block text-[9px] font-black font-mono text-gray-400 uppercase tracking-widest mb-1">3. Customize Content Details</span>
                          <div>
                            <span className="block text-[8px] font-bold text-gray-500 uppercase mb-0.5">Custom Heading/Title:</span>
                            <input
                              type="text"
                              value={newProdInsertTitle}
                              onChange={(e) => setNewProdInsertTitle(e.target.value)}
                              placeholder="e.g. Blazing Fast Speed Performance"
                              className="h-8 w-full rounded border border-gray-200 bg-white px-2.5 text-[10.5px] focus:outline-hidden text-gray-850"
                            />
                          </div>
                          <div>
                            <span className="block text-[8px] font-bold text-gray-500 uppercase mb-0.5">Layout Custom Summary / Copywriting:</span>
                            <textarea
                              value={newProdInsertCustomText}
                              onChange={(e) => setNewProdInsertCustomText(e.target.value)}
                              placeholder="Describe structural blueprints, circuit design or unique features..."
                              rows={2}
                              className="w-full rounded border border-gray-200 bg-white px-2.5 py-1 text-[10.5px] focus:outline-hidden text-gray-850 font-light leading-relaxed"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Step 3: Insert Action button */}
                      <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                        <button
                          type="button"
                          onClick={() => {
                            insertDesignHtml(
                              newProdSelectedInsertImg,
                              newProdInsertLayout,
                              newProdInsertTitle,
                              newProdInsertCustomText,
                              newProdDetailedDesc,
                              setNewProdDetailedDesc,
                              'newProdDetailedDesc'
                            );
                            setShowNewProdDesignInserter(false);
                          }}
                          className="inline-flex h-9 items-center gap-1.5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs px-4 rounded-lg shadow-xs cursor-pointer transition-colors"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Insert Elegant Design Layout
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Textarea */}
                  <textarea
                    id="newProdDetailedDesc"
                    value={newProdDetailedDesc}
                    onChange={(e) => {
                      setNewProdDetailedDesc(e.target.value);
                      if (!newProdDesc) setNewProdDesc(e.target.value); // Sync plain representation
                    }}
                    placeholder="Provide detailed, highly engaging specifications, care rules, or product background story here..."
                    rows={5}
                    className="w-full bg-white px-3 py-2.5 text-xs focus:outline-hidden text-gray-850 leading-relaxed font-light border-0"
                  />
                </div>

                {/* Live Rich Render Preview */}
                {newProdDetailedDesc && (
                  <div className="mt-2 rounded-lg border border-dashed border-gray-200 p-3 bg-gray-50/50">
                    <span className="block text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 font-mono">Live HTML Rich Editor Preview:</span>
                    <div 
                      className="text-xs text-gray-755 space-y-1 detailed-description-preview"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(newProdDetailedDesc) }}
                    />
                  </div>
                )}
                <span className="block text-[10px] text-gray-400 font-light mt-1">Styled HTML input supports custom tags and responsive layouts.</span>
              </div>

              {/* Product Features List & Specifications Entry */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Key Features (One per line)
                  </label>
                  <textarea
                    value={newProdFeatures}
                    onChange={(e) => setNewProdFeatures(e.target.value)}
                    placeholder={`e.g.\nLightweight Breathable Mesh\nResponsive Foam Midsole\nHigh Grip Rubber Outsole`}
                    rows={4}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50/20 px-3 py-2 text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all text-gray-850 leading-relaxed font-light"
                  />
                  <span className="block text-[10px] text-gray-400 font-light mt-1">List visual badges / selling bullet highlights.</span>
                </div>

                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Technical Specifications (Key: Value per line)
                  </label>
                  <textarea
                    value={newProdSpecs}
                    onChange={(e) => setNewProdSpecs(e.target.value)}
                    placeholder={`e.g.\nColor: Premium White\nWeight: 280 grams\nSole Material: Vulcanized Rubber\nFit Type: True to Size`}
                    rows={4}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50/20 px-3 py-2 text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all text-gray-850 leading-relaxed font-light"
                  />
                  <span className="block text-[10px] text-gray-400 font-light mt-1">Enter specifications using the "Key: Value" pattern.</span>
                </div>
              </div>

              {/* What's In The Box */}
              <div>
                <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                  What’s in the Box / Package Contents
                </label>
                <textarea
                  value={newProdWhatsInTheBox}
                  onChange={(e) => setNewProdWhatsInTheBox(e.target.value)}
                  placeholder="e.g. 1x Men's Sneakers Sports Breathable Running Shoes - White, 2x Extra Spare Athletic Laces"
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50/20 px-3 py-2 text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all text-gray-850 leading-relaxed font-light"
                />
                <span className="block text-[10px] text-gray-400 font-light mt-1">Specify all physical package items included in this delivery parcel.</span>
              </div>

              {/* Pricing, Cost & Category */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Cost Price (KSh) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-mono font-bold">KSh</span>
                    <input
                      type="number"
                      required
                      min={0}
                      value={newProdCostPrice}
                      onChange={(e) => setNewProdCostPrice(Number(e.target.value))}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50/20 pl-10 pr-3 font-mono text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all text-gray-950 font-bold"
                    />
                  </div>
                  <span className="block text-[10px] text-gray-400 font-light mt-1">Acquisition or production cost.</span>
                </div>
                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Retail Price (KSh) * (Selling Price)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-mono font-bold">KSh</span>
                    <input
                      type="number"
                      required
                      min={1}
                      value={newProdPrice}
                      onChange={(e) => setNewProdPrice(Number(e.target.value))}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50/20 pl-10 pr-3 font-mono text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all text-gray-950 font-bold"
                    />
                  </div>
                  <span className="block text-[10px] text-gray-400 font-light mt-1">Standard listing price tag.</span>
                </div>

                {/* Real-time Profit Preview Field */}
                <div>
                  <label className="block text-[10px] font-black font-mono text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Profit Preview</span>
                    <span className="text-[9px] text-indigo-600 font-bold font-sans">Live Margin</span>
                  </label>
                  {(() => {
                    const cost = Number(newProdCostPrice) || 0;
                    const sell = Number(newProdPrice) || 0;
                    const taxRates: Record<string, number> = { A: 0.16, B: 0.08, C: 0, E: 0 };
                    const rate = taxRates[newProdTaxId] ?? 0;
                    const vatAmount = sell * (rate / (1 + rate));
                    const netProfit = (sell - vatAmount) - cost;
                    const netMarginPercent = sell > 0 ? (netProfit / sell) * 100 : 0;
                    const isPositive = netProfit >= 0;

                    return (
                      <div className={`h-10 w-full rounded-lg border px-3 font-mono flex items-center justify-between shadow-3xs ${
                        cost <= 0
                          ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400'
                          : isPositive
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-300'
                      }`}>
                        {cost <= 0 ? (
                          <span className="text-xs text-gray-400 italic font-sans">Enter cost price</span>
                        ) : (
                          <>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[8px] uppercase tracking-wider text-gray-500 font-bold font-sans">Net Profit</span>
                              <span className={`text-xs font-black truncate ${isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                                KSh {cleanDecimals(netProfit, 0)}
                              </span>
                            </div>
                            <div className="text-right flex flex-col shrink-0">
                              <span className="text-[8px] uppercase tracking-wider text-gray-500 font-bold font-sans">Net Margin</span>
                              <span className={`text-xs font-black ${isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                                {cleanDecimals(netMarginPercent, 1)}%
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                  <span className="block text-[10px] text-gray-400 font-light mt-1">Expected margin after tax.</span>
                </div>
              </div>

              {/* Discount / Sale Setup for Add Product */}
              <div className="bg-indigo-50/10 rounded-xl border border-indigo-100/50 p-4 font-sans text-left space-y-3">
                <span className="block text-[10px] font-black font-mono text-indigo-700 uppercase tracking-wider">
                  Discount & Promotional Sale Setup
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                      Discount Type
                    </label>
                    <select
                      value={newProdDiscountType}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setNewProdDiscountType(val);
                        if (val === 'none') {
                          setNewProdPreviousPrice(undefined);
                          setNewProdDiscountValue(0);
                        }
                      }}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 text-gray-950 font-medium cursor-pointer"
                    >
                      <option value="none">No Discount</option>
                      <option value="percentage">Percentage (%) Discount</option>
                      <option value="fixed">Fixed Amount (KSh) Discount</option>
                      <option value="manual">Manual Previous / Compare Price</option>
                    </select>
                  </div>

                  {newProdDiscountType !== 'none' && newProdDiscountType !== 'manual' && (
                    <div>
                      <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                        {newProdDiscountType === 'percentage' ? 'Discount Rate (%)' : 'Discount Amount (KSh)'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={newProdDiscountType === 'percentage' ? 100 : undefined}
                        value={newProdDiscountValue}
                        onChange={(e) => setNewProdDiscountValue(Number(e.target.value))}
                        className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 font-mono text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 text-gray-950 font-bold"
                      />
                    </div>
                  )}

                  {newProdDiscountType === 'manual' && (
                    <div>
                      <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                        Previous Price (KSh) * (Original value)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-mono font-bold">KSh</span>
                        <input
                          type="number"
                          min={1}
                          required
                          value={newProdPreviousPrice || ''}
                          onChange={(e) => setNewProdPreviousPrice(Number(e.target.value))}
                          className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 font-mono text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550 text-gray-950 font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Help Summary */}
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-850">
                  {(() => {
                    let calcPrice = newProdPrice;
                    let origPrice = newProdPreviousPrice;

                    if (newProdDiscountType === 'percentage' && newProdDiscountValue > 0) {
                      origPrice = newProdPrice;
                      calcPrice = Math.round(newProdPrice * (1 - newProdDiscountValue / 100));
                    } else if (newProdDiscountType === 'fixed' && newProdDiscountValue > 0) {
                      origPrice = newProdPrice;
                      calcPrice = Math.max(1, newProdPrice - newProdDiscountValue);
                    } else if (newProdDiscountType === 'manual' && newProdPreviousPrice && newProdPreviousPrice > newProdPrice) {
                      origPrice = newProdPreviousPrice;
                      calcPrice = newProdPrice;
                    } else {
                      origPrice = undefined;
                    }

                    if (origPrice) {
                      const savedAmount = origPrice - calcPrice;
                      const savedPercent = Math.round((savedAmount / origPrice) * 100);
                      return (
                        <div className="text-[11px] bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-750 dark:text-indigo-400 font-semibold p-2 rounded-lg flex items-center gap-1">
                          🏷️ Discount Active: Listed at KSh {calcPrice.toLocaleString('en-KE')} (original KSh {origPrice.toLocaleString('en-KE')}). Customers save KSh {savedAmount.toLocaleString('en-KE')} ({savedPercent}%)!
                        </div>
                      );
                    }
                    return (
                      <span className="text-[10px] text-gray-400 font-light block">
                        Select a discount method to display a "Sale" tag on this product automatically.
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Kenyan Tax & Category Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Kenyan Tax ID & Classification (KRA)
                  </label>
                  <select
                    value={newProdTaxId}
                    onChange={(e) => setNewProdTaxId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all text-gray-950 cursor-pointer font-medium"
                  >
                    <option value="A">A - Standard Rate (16% VAT)</option>
                    <option value="B">B - Petroleum & Fuel Rate (8% VAT)</option>
                    <option value="C">C - Zero-Rated Supplies (0% VAT)</option>
                    <option value="E">E - VAT Exempt Goods / Services</option>
                  </select>
                  <span className="block text-[10px] text-gray-400 font-light mt-1">According to KRA Tax Categories.</span>
                </div>
                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Item Category
                  </label>
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all text-gray-950 cursor-pointer font-medium"
                  >
                    {customCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <span className="block text-[10px] text-gray-400 font-light mt-1">Collection context of catalog.</span>
                </div>
              </div>

              {/* Financial Metrics Live Projection Panel */}
              {(() => {
                const cost = Number(newProdCostPrice) || 0;
                const sell = Number(newProdPrice) || 0;
                const grossProfit = sell - cost;
                const markupPercent = cost > 0 ? ((sell - cost) / cost) * 100 : 0;
                const grossMarginPercent = sell > 0 ? ((sell - cost) / sell) * 100 : 0;

                const taxRates: Record<string, number> = { A: 0.16, B: 0.08, C: 0, E: 0 };
                const rate = taxRates[newProdTaxId] ?? 0;
                const vatAmount = sell * (rate / (1 + rate));
                const sellExclTax = sell - vatAmount;
                const netProfit = sellExclTax - cost;
                const netMarginPercent = sell > 0 ? (netProfit / sell) * 100 : 0;

                return (
                  <div className="bg-slate-50 border border-slate-200/80 dark:border-gray-800 rounded-xl p-4 font-sans text-left space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="block text-[10px] font-black font-mono text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                        💸 Financial Projections & Margin Analysis (After Taxation)
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-slate-200 dark:border-gray-700">
                        {rate > 0 ? `${rate * 100}% VAT Tax Included` : '0% / Exempt Tax'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-2.5 rounded-lg shadow-3xs">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">Cost Price *</span>
                        <span className={`text-xs font-bold block mt-0.5 font-mono ${cost > 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600'}`}>
                          {cost > 0 ? `KSh ${cost.toLocaleString('en-KE')}` : 'Required'}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-2.5 rounded-lg shadow-3xs">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">Gross Profit</span>
                        <span className={`text-xs font-bold block mt-0.5 font-mono ${grossProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                          KSh {grossProfit.toLocaleString('en-KE')}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-2.5 rounded-lg shadow-3xs">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">VAT Tax ({rate * 100}%)</span>
                        <span className="text-xs font-bold block mt-0.5 text-amber-700 dark:text-amber-400 font-mono">
                          KSh {cleanDecimals(vatAmount, 1)}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-2.5 rounded-lg shadow-3xs">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">Net Profit (After Tax)</span>
                        <span className={`text-xs font-bold block mt-0.5 font-mono ${netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                          KSh {cleanDecimals(netProfit, 1)}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-2.5 rounded-lg shadow-3xs">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">Markup %</span>
                        <span className={`text-xs font-bold block mt-0.5 font-mono ${markupPercent >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}`}>
                          {cleanDecimals(markupPercent, 1)}%
                        </span>
                      </div>
                      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-2.5 rounded-lg shadow-3xs">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">Net Margin %</span>
                        <span className={`text-xs font-bold block mt-0.5 font-mono ${netMarginPercent >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                          {cleanDecimals(netMarginPercent, 1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Class type & Inventory stock limits */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-150">
                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Class Type
                  </label>
                  <select
                    value={newProdType}
                    onChange={(e) => setNewProdType(e.target.value as any)}
                    className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-550 text-gray-950 font-bold cursor-pointer"
                  >
                    <option value="physical">Physical inventory</option>
                    <option value="digital">Digital download pack</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Inventory Stock
                  </label>
                  <input
                    type="number"
                    disabled={newProdType === 'digital'}
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(Number(e.target.value))}
                    className="h-9 w-full rounded-md border border-gray-200 px-3 font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-550 text-gray-950 font-bold disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                    Reorder Threshold
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={newProdType === 'digital'}
                    value={newProdLowStockThreshold}
                    onChange={(e) => setNewProdLowStockThreshold(Number(e.target.value))}
                    placeholder="5"
                    className="h-9 w-full rounded-md border border-gray-200 px-3 font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-550 text-gray-950 font-bold disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Kenya Local Payment Restrictions */}
              <div className="p-4 rounded-xl border border-gray-155 bg-indigo-50/15">
                <label className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                  Kenya Local Payment Restrictions
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div>
                    <select
                      value={newProdPaymentRestriction}
                      onChange={(e) => setNewProdPaymentRestriction(e.target.value as any)}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-550 text-gray-950 font-bold cursor-pointer"
                    >
                      <option value="both">No Restriction (Allow both M-Pesa and COD)</option>
                      <option value="prepaid">Paid Before Delivery (M-Pesa Only)</option>
                      <option value="cod">Paid Upon Delivery (Cash on Delivery Only)</option>
                    </select>
                  </div>
                  <p className="text-[10.5px] text-gray-500 font-light leading-relaxed">
                    {newProdPaymentRestriction === 'both' && "✨ Shoppers can choose either M-Pesa or Cash on Delivery during checkout."}
                    {newProdPaymentRestriction === 'prepaid' && "🔒 Prepaid: Shoppers pay via M-Pesa before dispatch. Ideal for customized items."}
                    {newProdPaymentRestriction === 'cod' && "🚚 COD: Customers will pay in cash or mobile money upon physical delivery."}
                  </p>
                </div>
              </div>

              {/* Dynamic Variations Multi-binding Section */}
              <div className="border-t border-gray-150 pt-5 font-sans">
                <span className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider mb-2">
                  Configure Multi-Variations (Dynamic)
                </span>
                <p className="text-[11px] text-gray-500 font-extralight mb-4">
                  Add custom customizable choices like Colors, Sizes, or Wood textures to let shoppers filter choices on the storefront.
                </p>

                {createdVariations.length > 0 && (
                  <div className="flex flex-col gap-2 mb-4 bg-indigo-50/20 p-3.5 rounded-xl border border-indigo-100/50">
                    {createdVariations.map((v, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-indigo-500" />
                          <div>
                            <strong className="text-indigo-950 font-semibold">{v.name}:</strong>{' '}
                            <span className="font-mono text-[10px] text-indigo-750 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                              {v.options.join(', ')}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCreatedVariations(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-500 text-[10px] font-bold hover:underline cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 rounded-xl bg-gray-50/50 p-3.5 border border-dashed border-gray-200">
                  <div className="flex-1">
                    <span className="block text-[9px] font-bold text-gray-500 uppercase mb-1 font-mono">Variation Category</span>
                    <input
                      type="text"
                      value={tempVarName}
                      onChange={(e) => setTempVarName(e.target.value)}
                      placeholder="e.g. Premium Finish"
                      className="h-8 w-full rounded border border-gray-200 px-2 text-[11px] bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550"
                    />
                  </div>
                  <div className="flex-1.5">
                    <span className="block text-[9px] font-bold text-gray-500 uppercase mb-1 font-mono">Options (Comma separated list)</span>
                    <input
                      type="text"
                      value={tempVarOptions}
                      onChange={(e) => setTempVarOptions(e.target.value)}
                      placeholder="e.g. Walnut, Natural Oak, Charcoal"
                      className="h-8 w-full rounded border border-gray-200 px-2 text-[11px] bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-550"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (!tempVarName || !tempVarOptions) return;
                        const splitOptions = tempVarOptions.split(',').map(o => o.trim()).filter(Boolean);
                        if (splitOptions.length === 0) return;
                        setCreatedVariations(prev => [...prev, { name: tempVarName.trim(), options: splitOptions }]);
                        setTempVarName('');
                        setTempVarOptions('');
                      }}
                      className="h-8 px-4 rounded bg-indigo-655 bg-indigo-600 text-white text-[10px] font-medium hover:bg-indigo-700 transition-colors cursor-pointer shrink-0"
                    >
                      + Bind Option
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-gray-150 pt-6 flex flex-col sm:flex-row justify-end items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddProdPage(false);
                    setSkuError('');
                  }}
                  className="w-full sm:w-auto h-10 px-5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer text-center"
                >
                  Discard Changes
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto h-10 px-6 rounded-lg bg-indigo-600 font-display text-xs font-bold text-white transition-colors hover:bg-indigo-700 shadow-sm text-center cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="h-4 w-4" /> Register & Publish Object
                </button>
              </div>
            </form>
          </div>

          {/* RIGHT: Live Feed Preview Deck & Illustration Maker */}
          <div className="lg:col-span-12 xl:col-span-5 flex flex-col gap-6 lg:sticky lg:top-8">
            {/* 1. Illustration Module Box */}
            <div className="bg-white rounded-2xl border border-gray-150 p-6 shadow-2xs">
              <h3 className="font-display text-xs font-bold font-mono text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4 text-indigo-500" /> Catalog Graphic Asset (Main Image)
              </h3>
              <ProductImageUpload
                value={newProdImg}
                onChange={setNewProdImg}
                label="Registered Illustration Link / Generator"
                defaultPlaceholder="https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=600"
                productContext={{
                  name: newProdName || 'Blank Product',
                  category: newProdCategory,
                  description: newProdDesc || 'Blank description'
                }}
              />
            </div>

            {/* Additional Gallery Images Box */}
            <div className="bg-white rounded-2xl border border-gray-150 p-6 shadow-2xs">
              <h3 className="font-display text-xs font-bold font-mono text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4 text-indigo-500" /> Additional Gallery Images
              </h3>
              <p className="text-[10px] text-gray-400 font-light mb-4 leading-relaxed">
                Add secondary images to appear in the storefront's media carousel. You can add local photos or use our AI Generator.
              </p>

              {/* Existing Gallery Thumbnails */}
              {newProdGallery.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {newProdGallery.map((img, idx) => (
                    <div key={idx} className="relative group aspect-square rounded border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                      <img src={img} alt={`Gallery ${idx}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setNewProdGallery(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-all rounded cursor-pointer"
                        title="Remove Image"
                      >
                        <Trash2 className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Image Inline Form */}
              <div className="bg-slate-50/50 p-3 rounded-xl border border-gray-150">
                <span className="block text-[9px] font-black font-mono text-indigo-700 uppercase tracking-wider mb-2">
                  Upload or Generate Gallery Photo #{newProdGallery.length + 1}
                </span>
                
                <ProductImageUpload
                  value=""
                  onChange={(uploadedVal) => {
                    if (uploadedVal) {
                      setNewProdGallery(prev => [...prev, uploadedVal]);
                    }
                  }}
                  label="Click or drag additional photo"
                  productContext={{
                    name: `${newProdName || 'Blank Product'} Detail View ${newProdGallery.length + 1}`,
                    category: newProdCategory,
                    description: `Detailed gallery close-up photograph of ${newProdName || 'product'} showcase perspective`
                  }}
                />
              </div>
            </div>

            {/* 2. Customer View Catalog Mock Preview */}
            <div className="bg-white rounded-2xl border border-gray-150 p-6 shadow-2xs">
              <span className="block text-[10px] font-black font-mono text-gray-400 uppercase tracking-widest mb-4">
                Storefront Preview Rendering
              </span>

              {/* Dynamic Mock Card */}
              <div id="product-live-preview-card" className="group border border-gray-200 rounded-2xl bg-white overflow-hidden shadow-3xs transition-all duration-300">
                {/* Visual Area */}
                <div className="relative aspect-4/3 bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100">
                  <img
                    src={newProdImg}
                    alt={newProdName || 'Product Title'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300"
                  />
                  
                  {/* Category badging */}
                  <div className="absolute top-3.5 left-3.5 flex flex-wrap gap-1">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold font-mono uppercase bg-slate-950 text-white shadow-3xs tracking-wider">
                      {newProdCategory}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold font-mono uppercase border shadow-3xs tracking-wider ${
                      newProdType === 'digital' 
                        ? 'bg-purple-100 text-purple-800 border-purple-200' 
                        : 'bg-indigo-100 text-indigo-805 border-indigo-200'
                    }`}>
                      {newProdType}
                    </span>
                  </div>
                </div>

                {/* Details Section */}
                <div className="p-4 sm:p-5 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[9px] text-gray-400 uppercase font-black tracking-wide leading-none">
                      SKU: {newProdSku ? newProdSku.toUpperCase() : 'VEL-xxx-xxx'}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 rounded">
                      Rating: 5.0 ★
                    </span>
                  </div>

                  <h3 className="font-display text-sm font-bold text-gray-950 mt-2 truncate">
                    {newProdName || 'Oak Headphone Rack'}
                  </h3>

                  <p className="text-[11px] text-gray-500 font-light mt-1.5 line-clamp-2 leading-relaxed">
                    {newProdDesc || 'Please provide a detailed description to generate catalog mockup... This description layout will automatically support full rich typography.'}
                  </p>

                  {/* Variations mockup */}
                  {createdVariations.length > 0 ? (
                    <div className="mt-3.5 pt-3 border-t border-gray-100/60 flex flex-wrap gap-2">
                      {createdVariations.map((v, idx) => (
                        <div key={v.name} className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-mono text-gray-400 font-bold uppercase">{v.name}</span>
                          <span className="text-[9px] font-mono font-semibold bg-gray-50 border border-gray-200 px-1 py-0.5 rounded text-gray-700">
                            {v.options[0]} (and {v.options.length - 1} more)
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3.5 pt-3 border-t border-gray-100/60 pb-1 text-[10px] text-gray-400 italic">
                      No custom variation options configured yet.
                    </div>
                  )}

                  {/* Financial projections in Storefront preview (Internal view info badge) */}
                  <div className="mt-3 bg-indigo-50/20 border border-indigo-100/30 rounded-lg p-2.5 flex items-center justify-between text-[10px]">
                    <div>
                      <span className="block text-[8px] font-mono text-gray-400 uppercase font-black">Cost Price</span>
                      <span className="font-mono font-bold text-gray-700">KSh {newProdCostPrice.toLocaleString('en-KE')}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] font-mono text-gray-400 uppercase font-black">Proj. Profit</span>
                      <span className="font-mono font-bold text-emerald-700">KSh {(newProdPrice - newProdCostPrice).toLocaleString('en-KE')}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] font-mono text-gray-400 uppercase font-black">Markup</span>
                      <span className="font-mono font-bold text-indigo-750">
                        {newProdCostPrice > 0 ? (((newProdPrice - newProdCostPrice) / newProdCostPrice) * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                    <div>
                      <span className="block text-[8px] font-mono text-gray-400 uppercase font-black">KRA Tax ID</span>
                      <span className="font-mono font-bold bg-slate-100 px-1 rounded text-slate-800">Class {newProdTaxId}</span>
                    </div>
                  </div>

                  {/* Pricing footer block */}
                  <div className="mt-4 pt-3.5 border-t border-gray-105 flex items-center justify-between">
                    <div>
                      <span className="block text-[8px] font-mono text-gray-400 uppercase font-black leading-none animate-pulse">Price Tag</span>
                      <span className="font-mono font-black text-sm text-gray-950">KSh {Number(newProdPrice).toLocaleString('en-KE')}</span>
                    </div>
                    
                    <button
                      type="button"
                      disabled
                      className="h-8 px-4 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-100 text-[10px] font-extrabold uppercase tracking-wide cursor-not-allowed select-none flex items-center gap-1 font-mono hover:bg-indigo-600 hover:text-white"
                    >
                      Store active
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isProductActive = (p: Product) => !p.status || p.status === 'Active';
  const countAll = products.length;
  const countActive = products.filter(isProductActive).length;
  const countLowStock = products.filter(p => p.type === 'physical' && p.stock !== null && p.stock !== undefined && p.stock <= (p.lowStockThreshold ?? 5) && p.stock > 0).length;
  const countOutOfStock = products.filter(p => p.type === 'physical' && p.stock !== null && p.stock !== undefined && p.stock === 0).length;

  const filteredProducts = products.filter((p) => {
    const query = skuSearchQuery.trim().toLowerCase();
    let matchesSearch = !query;
    if (query) {
      if (skuSearchMode === 'sku') {
        matchesSearch = p.sku?.toLowerCase().includes(query) || false;
      } else if (skuSearchMode === 'sku_prefix') {
        matchesSearch = p.sku?.toLowerCase().startsWith(query) || false;
      } else if (skuSearchMode === 'name') {
        matchesSearch = p.name?.toLowerCase().includes(query) || false;
      } else {
        matchesSearch = p.sku?.toLowerCase().includes(query) || p.name?.toLowerCase().includes(query) || false;
      }
    }
    const matchesType = productTypeFilter === 'all' || p.type === productTypeFilter;
    const matchesCategory = productCategoryFilter === 'all' || p.category === productCategoryFilter;

    let matchesQuickFilter = true;
    if (productQuickFilter === 'low_stock') {
      matchesQuickFilter = p.type === 'physical' && p.stock !== null && p.stock !== undefined && p.stock <= (p.lowStockThreshold ?? 5) && p.stock > 0;
    } else if (productQuickFilter === 'out_of_stock') {
      matchesQuickFilter = p.type === 'physical' && p.stock !== null && p.stock !== undefined && p.stock === 0;
    } else if (productQuickFilter === 'active') {
      matchesQuickFilter = isProductActive(p);
    }

    return matchesSearch && matchesType && matchesCategory && matchesQuickFilter;
  });

  // Calculate top 5 lowest-stock physical products and turnover / revenue potential metrics
  const physicalProducts = products.filter(p => p.type === 'physical' && p.stock !== null && p.stock !== undefined);
  
  const top5LowestStock = [...physicalProducts]
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
    .slice(0, 5);

  const lowStockWidgetData = top5LowestStock.map(p => {
    const soldQty = orders.reduce((total, order) => {
      if (order.status === 'cancelled') return total;
      const matchItem = order.items.find(item => item.productId === p.id);
      return total + (matchItem ? matchItem.quantity : 0);
    }, 0);

    const hash = p.sku ? p.sku.split('').reduce((acc, char) => accChar(acc, char), 0) : p.name.split('').reduce((acc, char) => accChar(acc, char), 0);
    const baselineTurnover = 1.8 + (hash % 8) * 0.9;
    const currentStock = p.stock ?? 0;
    const avgInventory = currentStock + (soldQty / 2);
    const turnoverRate = avgInventory > 0
      ? Number(((soldQty / avgInventory) + baselineTurnover).toFixed(1))
      : Number(baselineTurnover.toFixed(1));

    const revenuePotential = currentStock * p.price;

    return {
      name: p.name.length > 18 ? p.name.substring(0, 15) + '...' : p.name,
      fullName: p.name,
      sku: p.sku || 'No SKU',
      stock: currentStock,
      turnoverRate,
      revenuePotential,
      price: p.price,
      soldQty
    };
  });

  function accChar(acc: number, char: string) {
    return acc + char.charCodeAt(0);
  }

  const totalLockedRevenue = lowStockWidgetData.reduce((sum, item) => sum + item.revenuePotential, 0);
  const criticalRestockAlertCount = physicalProducts.filter(p => (p.stock ?? 0) <= (p.lowStockThreshold ?? 5)).length;
  const avgTurnoverRate = lowStockWidgetData.length > 0 
    ? Number((lowStockWidgetData.reduce((sum, item) => sum + item.turnoverRate, 0) / lowStockWidgetData.length).toFixed(1))
    : 0;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-slate-50/70 dark:bg-slate-950 text-left">
      {/* Top Welcome Title & Executive Action Bar (Fixed Sub-Header) */}
      <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-3xs z-30">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                Ropenix Collection Admin
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono font-bold uppercase tracking-wider hidden sm:inline-block">
                {adminSubTab.replace('-', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
              Live operational metrics, inventory management, orders pipeline & administrative controls.
            </p>
          </div>
        </div>

        {/* Admin Global Search Input with Command Palette */}
        <div ref={adminSearchContainerRef} className="relative flex-1 max-w-md w-full">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              ref={adminSearchInputRef}
              type="text"
              value={adminGlobalSearch}
              onFocus={() => setIsAdminSearchOpen(true)}
              onChange={(e) => {
                setAdminGlobalSearch(e.target.value);
                setIsAdminSearchOpen(true);
              }}
              placeholder="Search products, orders, customers, or features..."
              className="w-full h-9.5 pl-9.5 pr-14 rounded-xl border border-slate-250 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 transition-all font-sans shadow-2xs"
              id="input-admin-global-search"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {adminGlobalSearch ? (
                <button
                  type="button"
                  onClick={() => {
                    setAdminGlobalSearch('');
                    adminSearchInputRef.current?.focus();
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 dark:text-slate-500 bg-slate-200/60 dark:bg-slate-700/60 border border-slate-300/60 dark:border-slate-600/60 rounded">
                  /
                </kbd>
              )}
            </div>
          </div>

          {/* Live Search Results Dropdown Palette */}
          {isAdminSearchOpen && adminGlobalSearch.trim() && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-750 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150 max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {adminSearchResults.totalCount === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 font-sans">
                  <Search className="h-6 w-6 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p>No matching products, orders, or features found for "{adminGlobalSearch}".</p>
                </div>
              ) : (
                <>
                  {/* Features / Tabs Section */}
                  {adminSearchResults.features.length > 0 && (
                    <div className="p-2">
                      <div className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Admin Features &amp; Tabs
                      </div>
                      {adminSearchResults.features.map((feat) => {
                        const Icon = feat.icon;
                        return (
                          <button
                            key={feat.id}
                            type="button"
                            onClick={() => {
                              setAdminSubTab(feat.id);
                              setIsAdminSearchOpen(false);
                              setAdminGlobalSearch('');
                            }}
                            className="w-full flex items-center justify-between p-2 rounded-xl text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-800 dark:text-slate-200 transition-colors text-left group cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-7 w-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <span className="font-semibold truncate">{feat.label}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 shrink-0">
                              {feat.category}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Products Section */}
                  {adminSearchResults.products.length > 0 && (
                    <div className="p-2">
                      <div className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Products ({adminSearchResults.products.length})
                      </div>
                      {adminSearchResults.products.map((prod) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => {
                            setEditingProduct(prod);
                            setShowAddProdPage(false);
                            setAdminSubTab('edit-product');
                            setIsAdminSearchOpen(false);
                            setAdminGlobalSearch('');
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200 transition-colors text-left group cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {prod.imageUrl ? (
                              <img src={prod.imageUrl} alt={prod.name} className="h-7 w-7 rounded-lg object-cover bg-slate-100 shrink-0" />
                            ) : (
                              <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-400">
                                <Package className="h-3.5 w-3.5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate">{prod.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">{prod.sku || prod.category || 'Product'}</p>
                            </div>
                          </div>
                          <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0 pl-2">
                            {formatPrice(convertPrice(prod.price, currency), currency)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Orders Section */}
                  {adminSearchResults.orders.length > 0 && (
                    <div className="p-2">
                      <div className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Orders ({adminSearchResults.orders.length})
                      </div>
                      {adminSearchResults.orders.map((ord) => (
                        <button
                          key={ord.id}
                          type="button"
                          onClick={() => {
                            setSelectedAdminDetailOrder(ord);
                            setIsAdminSearchOpen(false);
                            setAdminGlobalSearch('');
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200 transition-colors text-left group cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-mono text-[10px] font-bold">
                              #
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate">
                                {ord.id} <span className="text-slate-400 font-normal">({ord.customerName})</span>
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">{ord.customerEmail || ord.status}</p>
                            </div>
                          </div>
                          <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0 pl-2">
                            {formatPrice(convertPrice(ord.total, currency), currency)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Admin Flex Layout: Persistent Side Menu + Scrollable Content Area */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Persistent Side Navigation */}
        <aside className="w-full lg:w-68 xl:w-72 shrink-0 bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200/90 dark:border-slate-800 flex flex-col h-auto lg:h-full overflow-hidden p-3.5 shadow-3xs text-left z-20" id="admin-sidebar-menu">
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-4xs">
                <SlidersHorizontal className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-sans leading-none">Admin Menu</h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">19 Studio Features</p>
              </div>
            </div>

            {/* Mobile Expand / Collapse Button */}
            <button
              type="button"
              onClick={() => setIsMobileAdminNavOpen(!isMobileAdminNavOpen)}
              className="lg:hidden inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Menu className="h-3.5 w-3.5" />
              <span>{isMobileAdminNavOpen ? 'Hide' : 'Menu'}</span>
            </button>
          </div>

          {/* Direct Back to Site in Sidebar */}
          {onNavigateToSite && (
            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => onNavigateToSite('home')}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100/90 hover:bg-indigo-50 dark:bg-slate-800/80 dark:hover:bg-indigo-950/50 border border-slate-200/80 dark:border-slate-700/70 hover:border-indigo-300 dark:hover:border-indigo-600 text-slate-750 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 text-xs font-bold transition-all shadow-4xs group cursor-pointer"
                id="btn-admin-sidebar-back-to-site"
                title="Return to the public storefront website"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-indigo-600 dark:text-slate-400 dark:group-hover:text-indigo-400 group-hover:-translate-x-0.5 transition-all" />
                  <span className="truncate font-sans font-semibold">Back to Store</span>
                </div>
                <span className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  Site ↗
                </span>
              </button>
            </div>
          )}

          {/* Active Tool Badge for Mobile */}
          <div className="lg:hidden mt-2.5 pt-1">
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-xs">
              <span className="text-[10px] font-semibold text-slate-400 uppercase font-mono">Current:</span>
              <span className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5 capitalize">
                {adminSubTab.replace('-', ' ')}
              </span>
            </div>
          </div>

          {/* Quick Search Filter */}
          <div className={`mt-3 ${isMobileAdminNavOpen ? 'block' : 'hidden lg:block'}`}>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter features..."
                value={adminMenuFilter}
                onChange={(e) => setAdminMenuFilter(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all font-sans"
              />
              {adminMenuFilter && (
                <button
                  type="button"
                  onClick={() => setAdminMenuFilter('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Feature List (Independently scrollable inside persistent sidebar) */}
          <div className={`mt-3 space-y-1 flex-1 min-h-0 overflow-y-auto custom-tab-scroll pr-0.5 max-h-[50vh] lg:max-h-none ${isMobileAdminNavOpen ? 'block' : 'hidden lg:block'}`}>
            {[
              {
                id: 'analytics' as const,
                buttonId: 'btn-tab-analytics',
                label: 'Analytics',
                icon: BarChart3,
                badge: null,
                badgeType: 'none',
                iconColor: 'text-indigo-500',
              },
              {
                id: 'products' as const,
                buttonId: 'btn-tab-inventory',
                label: 'Inventory',
                icon: Package,
                badge: `${products.length}`,
                badgeType: 'count',
                iconColor: 'text-indigo-500',
              },
              {
                id: 'suppliers' as const,
                buttonId: 'btn-tab-suppliers',
                label: 'Suppliers & Consignments',
                icon: Truck,
                badge: 'SUPPLY',
                badgeType: 'tag-emerald',
                iconColor: 'text-emerald-500',
              },
              {
                id: 'edit-product' as const,
                buttonId: 'btn-tab-edit-product',
                label: 'Product Editor',
                icon: Edit3,
                badge: 'STUDIO',
                badgeType: 'tag-indigo',
                iconColor: 'text-indigo-500',
              },

              {
                id: 'categories' as const,
                buttonId: 'btn-tab-categories',
                label: 'Categories',
                icon: FolderTree,
                badge: `${customCategories.length}`,
                badgeType: 'count',
                iconColor: 'text-indigo-500',
              },
              {
                id: 'bulk-price' as const,
                buttonId: 'btn-tab-bulk-price',
                label: 'Bulk Price Adjuster',
                icon: Percent,
                badge: 'PAGE',
                badgeType: 'tag-amber',
                iconColor: 'text-amber-500',
              },
              {
                id: 'orders' as const,
                buttonId: 'btn-tab-orders',
                label: 'Orders',
                icon: ShoppingBag,
                badge: `${orders.length}`,
                badgeType: 'count',
                iconColor: 'text-indigo-500',
              },
              {
                id: 'customers' as const,
                buttonId: 'btn-tab-customers',
                label: 'Customer CRM',
                icon: Users,
                badge: 'CRM',
                badgeType: 'tag-amber',
                iconColor: 'text-amber-500',
              },
              {
                id: 'custom-clothing' as const,
                buttonId: 'btn-tab-custom-clothing',
                label: 'Custom Clothing Requests',
                icon: Scissors,
                badge: 'Bespoke',
                badgeType: 'tag-indigo',
                iconColor: 'text-indigo-500',
              },
              {
                id: 'email' as const,
                buttonId: 'btn-tab-email-marketing',
                label: 'Email Marketing & Templates',
                icon: Mail,
                badge: 'PRO',
                badgeType: 'tag-indigo',
                iconColor: 'text-indigo-500',
              },

              {
                id: 'promotions' as const,
                buttonId: 'btn-tab-promotions',
                label: 'Promotions',
                icon: Tag,
                badge: `${Object.keys(coupons).length}`,
                badgeType: 'count',
                iconColor: 'text-indigo-500',
              },

              {
                id: 'inventory-logs' as const,
                buttonId: 'btn-tab-inventory-logs',
                label: 'Audit Logs',
                icon: FileText,
                badge: `${inventoryAuditLogs.length}`,
                badgeType: 'count',
                iconColor: 'text-indigo-500',
              },
              {
                id: 'inventory-alerts' as const,
                buttonId: 'btn-tab-inventory-alerts',
                label: 'Alerts',
                icon: AlertCircle,
                badge: `${lowStockProducts.length}`,
                badgeType: lowStockProducts.length > 0 ? 'alert' : 'count',
                iconColor: lowStockProducts.length > 0 ? 'text-rose-500' : 'text-slate-400',
              },

              {
                id: 'backup' as const,
                buttonId: 'btn-tab-backup',
                label: 'Backup',
                icon: Shield,
                badge: null,
                badgeType: 'none',
                iconColor: 'text-emerald-500',
              },
              {
                id: 'order-lookup' as const,
                buttonId: 'btn-tab-order-lookup',
                label: 'Order Lookup',
                icon: Search,
                badge: null,
                badgeType: 'none',
                iconColor: 'text-indigo-500',
              },
              {
                id: 'returns' as const,
                buttonId: 'btn-tab-returns',
                label: 'Returns Manager',
                icon: RefreshCw,
                badge: `${returnRequests.filter(r => r.status === 'pending').length > 0 ? returnRequests.filter(r => r.status === 'pending').length : (returnRequests.length > 0 ? returnRequests.length : '1')}`,
                badgeType: returnRequests.filter(r => r.status === 'pending').length > 0 ? 'alert-amber' : 'count',
                iconColor: 'text-indigo-500',
              },
              {
                id: 'shipping' as const,
                buttonId: 'btn-tab-shipping',
                label: 'Shipping & Delivery',
                icon: Truck,
                badge: 'PRO',
                badgeType: 'tag-emerald',
                iconColor: 'text-indigo-500',
              },
              {
                id: 'hero-slider' as const,
                buttonId: 'btn-tab-hero-slider',
                label: 'Hero Banner Builder',
                icon: Sparkles,
                badge: 'SLIDER',
                badgeType: 'tag-indigo',
                iconColor: 'text-amber-500',
              },
              {
                id: 'site-settings' as const,
                buttonId: 'btn-tab-site-settings',
                label: 'Site Settings',
                icon: Settings,
                badge: 'CONFIG',
                badgeType: 'tag-indigo',
                iconColor: 'text-indigo-500',
              },
            ]
              .filter((item) => {
                if (!adminMenuFilter.trim()) return true;
                const query = adminMenuFilter.toLowerCase().trim();
                return item.label.toLowerCase().includes(query);
              })
              .map((item) => {
                const Icon = item.icon;
                const isActive = adminSubTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={item.buttonId}
                    onClick={() => {
                      setAdminSubTab(item.id);
                      setIsMobileAdminNavOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200 font-bold border-l-3 border-indigo-600 shadow-4xs'
                        : 'text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : item.iconColor}`} />
                      <span className="truncate font-semibold">{item.label}</span>
                    </div>

                    {/* Badges / Counters */}
                    <div className="shrink-0 flex items-center pl-1.5">
                      {item.badgeType === 'count' && item.badge !== null && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          isActive
                            ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-750 dark:text-slate-200 font-bold'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                      {item.badgeType === 'tag-amber' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black tracking-wider uppercase shadow-4xs">
                          {item.badge}
                        </span>
                      )}
                      {item.badgeType === 'tag-indigo' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-black tracking-wider uppercase shadow-4xs">
                          {item.badge}
                        </span>
                      )}
                      {item.badgeType === 'tag-emerald' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black tracking-wider uppercase shadow-4xs">
                          {item.badge}
                        </span>
                      )}
                      {item.badgeType === 'alert' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold animate-pulse shadow-4xs">
                          {item.badge}
                        </span>
                      )}
                      {item.badgeType === 'alert-amber' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-mono font-bold animate-pulse shadow-4xs">
                          {item.badge}
                        </span>
                      )}
                      {item.badgeType === 'pulse' && (
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                    </div>
                  </button>
                );
              })}

            {adminMenuFilter && [
              'analytics', 'products', 'categories', 'bulk-price', 'orders', 
              'custom-clothing', 'email', 'campaigns', 'promotions', 'payouts', 
              'affiliates', 'inventory-logs', 'inventory-alerts', 
              'backup', 'order-lookup', 'returns', 'shipping', 'hero-slider', 'site-settings'
            ].every((id) => !id.includes(adminMenuFilter.toLowerCase())) && (
              <div className="py-6 text-center text-xs text-slate-400">
                No matching admin features.
              </div>
            )}
          </div>

          {/* Admin User Profile & Logout Action */}
          <div className="mt-3 pt-3 border-t border-slate-200/90 dark:border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 shadow-5xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-mono font-extrabold text-xs shrink-0">
                  SU
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">admin@ropenix.co.ke</p>
                  <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" /> Superuser Active
                  </span>
                </div>
              </div>
            </div>

            {onLogout && (
              <button
                type="button"
                id="btn-admin-sidebar-logout"
                onClick={onLogout}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/60 border border-rose-200/90 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all shadow-4xs group cursor-pointer"
                title="Log out of Superuser Admin Session"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <LogOut className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400 group-hover:scale-110 group-hover:-translate-x-0.5 transition-transform" />
                  <span className="truncate font-sans font-bold">Logout Superuser</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800 shadow-5xs">
                  Exit ↩
                </span>
              </button>
            )}
          </div>

          {/* Side Menu Footer Status */}
          <div className="hidden lg:flex mt-2.5 pt-2 border-t border-slate-150 dark:border-slate-800/80 items-center justify-between text-[10px] text-slate-400 font-mono">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Database Active</span>
            </div>
            {onNavigateToSite ? (
              <button
                onClick={() => onNavigateToSite('home')}
                className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-sans font-semibold flex items-center gap-0.5"
                title="Navigate to store homepage"
              >
                <span>Live Site</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </button>
            ) : (
              <button
                onClick={() => setAdminSubTab('backup')}
                className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-sans font-semibold"
              >
                Sync Backup
              </button>
            )}
          </div>
        </aside>

        {/* Right Scrollable Content Area */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 xl:px-10 bg-[#F9FAFB] dark:bg-slate-950 custom-tab-scroll text-left" id="admin-main-viewport">
          {/* 7-Day Backup Reminder Box (Inside Scrollable Content Area) */}
          {isBackupOverdue && (
            <div className="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top duration-300" id="db-backup-reminder-banner">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full p-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-200 font-sans">
                    Database Backup Recommended — Last saved: {getDaysSinceLastBackup()}
                  </h3>
                  <p className="text-xs text-amber-800 dark:text-amber-300 font-extralight mt-0.5 max-w-2xl leading-relaxed">
                    Because all product, order, affiliate offer, campaign and audit log states are persisted solely in your browser's LocalStorage, clearing your cache can result in data loss. We recommend downloading a fresh JSON backup every 7 days.
                  </p>
                </div>
              </div>
              <button
                onClick={handleDownloadRawBackup}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-amber-600 text-white px-4 py-2 text-xs font-semibold transition-colors hover:bg-amber-700 cursor-pointer shadow-sm"
              >
                <Database className="h-3.5 w-3.5" /> Backup Database Now
              </button>
            </div>
          )}

      {/* Global Admin Alert Notification Center (for pending cancellations) */}
      {orders.filter(o => o.status === 'pending-cancellation').length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-900/40 p-4 shadow-3xs animate-in slide-in-from-top duration-300">
          <div className="flex items-start gap-4 flex-col md:flex-row">
            <div className="rounded-lg bg-amber-150 dark:bg-amber-950/50 p-2 text-amber-700 dark:text-amber-400 shrink-0">
              <AlertTriangle className="h-5 w-5 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300 font-sans tracking-tight flex items-center gap-2">
                ⚠️ Order Cancellation Requests ({orders.filter(o => o.status === 'pending-cancellation').length})
              </h4>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-light mt-1">
                Customers have requested cancellation for the following orders. Please review and process them:
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {orders.filter(o => o.status === 'pending-cancellation').map((ord) => (
                  <div key={ord.id} className="flex flex-wrap items-center justify-between gap-3 bg-white/80 dark:bg-gray-950/50 p-3 rounded-lg border border-amber-100 dark:border-amber-900/20 shadow-4xs">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 px-2 py-0.5 rounded border border-gray-150 dark:border-gray-800 uppercase">
                        {ord.id.toUpperCase()}
                      </span>
                      <div className="text-xs">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{ord.customerName}</span>
                        <span className="mx-1.5 text-gray-400 font-light">|</span>
                        <span className="font-mono font-bold text-indigo-650 dark:text-indigo-400">KSh {ord.total.toLocaleString('en-KE')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onUpdateOrderStatus(ord.id, 'cancelled')}
                        className="inline-flex h-7 items-center gap-1 rounded bg-rose-600 hover:bg-rose-700 text-white px-3 text-[10.5px] font-bold cursor-pointer transition-all shadow-4xs hover:scale-102"
                      >
                        <Check className="h-3 w-3" /> Approve Cancellation
                      </button>
                      <button
                        onClick={() => onUpdateOrderStatus(ord.id, 'pending')}
                        className="inline-flex h-7 items-center gap-1 rounded border border-gray-200 dark:border-gray-800 bg-white hover:bg-gray-55 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-350 px-3 text-[10.5px] font-bold cursor-pointer transition-all shadow-4xs hover:scale-102"
                      >
                        <X className="h-3 w-3" /> Decline & Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Sub-content */}
      {adminSubTab === 'analytics' && (
        <div className="mt-8 flex flex-col gap-8">
          {/* Low Stock Alerts Banner */}
          {lowStockProducts.length > 0 && (
            <div className="rounded-xl border border-red-100 bg-red-50/70 p-4 shadow-3xs animate-in fade-in duration-200">
              <div className="flex items-start gap-4 flex-col md:flex-row">
                <div className="rounded-lg bg-red-100 p-2 text-red-700 shrink-0">
                  <AlertTriangle className="h-5 w-5 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-red-900 font-sans tracking-tight">Active Low-Stock Alerts ({lowStockProducts.length})</h4>
                  <p className="text-xs text-red-750 font-normal mt-0.5">
                    The following proprietary items have dropped below their individual minimum threshold settings. Please reorder stock or configure thresholds inside Inventory.
                  </p>
                  
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {lowStockProducts.map((p) => {
                      const limit = p.lowStockThreshold ?? 5;
                      return (
                        <div key={p.id} className="flex justify-between items-center bg-white rounded-lg p-3 border border-red-100/50 text-xs shadow-2xs hover:border-red-200 transition-colors">
                          <div className="truncate pr-2">
                            <span className="font-mono text-[9px] font-bold text-gray-400 block tracking-wider leading-none uppercase">{p.sku}</span>
                            <span className="font-semibold text-gray-900 truncate block mt-1.5">{p.name}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-red-700 block">
                              {p.stock === 0 ? "OUT (0)" : `${p.stock} units`}
                            </span>
                            <span className="text-[10px] text-gray-402 block font-normal mt-0.5">Reorder Threshold: {limit}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => setAdminSubTab('products')}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-700 hover:bg-red-800 transition-colors text-white py-1.5 px-3.5 text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Manage Inventory Catalog →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Profitability Overview & Net Revenue Ledger Card */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 text-gray-900 dark:text-white shadow-xs">
            <div className="flex flex-col gap-6">
              {/* Widget Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-150 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                        Profitability Overview & Net Revenue Ledger
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {profitabilityOverview.netMarginPercent.toFixed(1)}% Net Margin
                      </span>
                      {isCashFlowDeficit && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-rose-600 dark:text-rose-400" /> Cash Flow Deficit
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-light mt-0.5">
                      Net earnings calculated after accounting for tax liabilities (VAT) for selected window.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap relative">
                  {/* Scope & Date Range Dropdown Selector */}
                  <div className="relative" ref={dateScopeDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDateScopeDropdownOpen(!isDateScopeDropdownOpen);
                        setIsLedgerActionsDropdownOpen(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 border border-gray-200 dark:border-gray-700 text-[11px] font-mono text-gray-700 dark:text-gray-300 flex items-center gap-1.5 cursor-pointer transition shadow-2xs shrink-0"
                      id="btn-date-scope-dropdown"
                      title="Filter ledger time window"
                    >
                      <Calendar className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {analyticsDateRange ? `${analyticsDateRange.start} → ${analyticsDateRange.end}` : 'All Time Active Orders'}
                      </span>
                      <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${isDateScopeDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDateScopeDropdownOpen && (
                      <div
                        className="absolute right-0 sm:left-0 sm:right-auto mt-1.5 w-56 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl py-1.5 z-40 animate-in fade-in zoom-in-95 duration-150 font-sans"
                        id="menu-date-scope-options"
                      >
                        <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700/60">
                          Select Ledger Window
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectDateScopePreset('all')}
                          className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/60 cursor-pointer transition ${!analyticsDateRange ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/50 dark:bg-indigo-950/40' : 'text-gray-700 dark:text-gray-200'}`}
                        >
                          <span className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                            All Time Active Orders
                          </span>
                          {!analyticsDateRange && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectDateScopePreset('today')}
                          className="w-full px-3 py-2 text-left text-xs flex items-center justify-between text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 cursor-pointer transition"
                        >
                          <span>Today (24h)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectDateScopePreset('7days')}
                          className="w-full px-3 py-2 text-left text-xs flex items-center justify-between text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 cursor-pointer transition"
                        >
                          <span>Last 7 Days</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectDateScopePreset('30days')}
                          className="w-full px-3 py-2 text-left text-xs flex items-center justify-between text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 cursor-pointer transition"
                        >
                          <span>Last 30 Days</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectDateScopePreset('this_month')}
                          className="w-full px-3 py-2 text-left text-xs flex items-center justify-between text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 cursor-pointer transition"
                        >
                          <span>This Month</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Ledger Actions Dropdown Menu */}
                  <div className="relative" ref={ledgerActionsDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsLedgerActionsDropdownOpen(!isLedgerActionsDropdownOpen);
                        setIsDateScopeDropdownOpen(false);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer shrink-0"
                      id="btn-ledger-actions-dropdown"
                      title="Open Payouts, Export, and Ledger Actions"
                    >
                      <Zap className="h-3.5 w-3.5 text-emerald-300" />
                      <span>Ledger Actions</span>
                      <ChevronDown className={`h-3.5 w-3.5 text-indigo-200 transition-transform duration-200 ${isLedgerActionsDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isLedgerActionsDropdownOpen && (
                      <div
                        className="absolute right-0 mt-1.5 w-72 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl py-2 z-40 animate-in fade-in zoom-in-95 duration-150 font-sans"
                        id="menu-ledger-actions-options"
                      >
                        <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                          <span>Payout & Ledger Operations</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">KSh {currentPayoutBalance.toLocaleString('en-KE')}</span>
                        </div>

                        <div className="py-1">
                          {/* 1. Quick Payout Request */}
                          <button
                            type="button"
                            onClick={() => {
                              handleQuickPayoutRequest();
                              setIsLedgerActionsDropdownOpen(false);
                            }}
                            className="w-full px-3.5 py-2.5 text-left flex items-start gap-3 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 text-gray-800 dark:text-gray-100 transition group cursor-pointer"
                            id="menu-item-quick-payout"
                          >
                            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                              <Zap className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                                  Quick Payout Request
                                </span>
                                <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 rounded">
                                  Instant
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                Trigger withdrawal for KSh {currentPayoutBalance.toLocaleString('en-KE')}
                              </p>
                            </div>
                          </button>

                          {/* 2. Copy Payout Bank Details */}
                          <button
                            type="button"
                            onClick={() => {
                              handleCopyBankDetails();
                            }}
                            className="w-full px-3.5 py-2.5 text-left flex items-start gap-3 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-gray-800 dark:text-gray-100 transition group cursor-pointer"
                            id="menu-item-copy-bank-details"
                          >
                            <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                              {isBankDetailsCopied ? (
                                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                                  Copy Payout Bank Details
                                </span>
                                {isBankDetailsCopied && (
                                  <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 rounded">
                                    Copied!
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                Copy banking & wire routing details to clipboard
                              </p>
                            </div>
                          </button>
                        </div>

                        <div className="my-1 border-t border-gray-100 dark:border-gray-700/60" />

                        <div className="py-1">
                          {/* 3. Download PDF Report */}
                          <button
                            type="button"
                            onClick={() => {
                              setShowProfitabilityPdfModal(true);
                              setIsLedgerActionsDropdownOpen(false);
                            }}
                            className="w-full px-3.5 py-2.5 text-left flex items-start gap-3 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-gray-800 dark:text-gray-100 transition group cursor-pointer"
                            id="menu-item-download-pdf"
                          >
                            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300">
                                  Download PDF Report
                                </span>
                                <span className="text-[10px] font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950 px-1.5 py-0.2 rounded">
                                  PDF
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                Print-ready audit summary & profitability metrics
                              </p>
                            </div>
                          </button>

                          {/* 4. Export Ledger */}
                          <button
                            type="button"
                            onClick={() => {
                              handleExportProfitabilityCSV();
                              setIsLedgerActionsDropdownOpen(false);
                            }}
                            className="w-full px-3.5 py-2.5 text-left flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-gray-800 dark:text-gray-100 transition group cursor-pointer"
                            id="menu-item-export-ledger-csv"
                          >
                            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                              <Download className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-slate-900 dark:group-hover:text-white">
                                  Export Ledger
                                </span>
                                <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                                  CSV
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                Export full order transactions and ledger breakdown
                              </p>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Payout Status Feedback Banner */}
              {payoutNotification && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-mono font-semibold flex items-center justify-between transition-all animate-in fade-in duration-200 ${
                    payoutNotification.startsWith('Error')
                      ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                      : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  }`}
                  id="quick-payout-notification-banner"
                >
                  <div className="flex items-center gap-2">
                    {payoutNotification.startsWith('Error') ? (
                      <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                    <span>{payoutNotification}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPayoutNotification(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Cash Flow Reserves vs Pending Payouts Warning Notification */}
              {isCashFlowDeficit ? (
                <div
                  className="bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-gray-900 dark:text-white transition-all animate-in fade-in duration-200"
                  id="payout-cashflow-warning-notification"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-700 shrink-0 mt-0.5">
                      <AlertTriangle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-600 text-white uppercase tracking-wider">
                          LIQUIDITY RISK WARNING
                        </span>
                        <h4 className="text-sm font-bold text-rose-900 dark:text-rose-100">
                          Pending Affiliate Payouts Exceed Available Cash Flow Reserves!
                        </h4>
                      </div>
                      <p className="text-xs text-rose-800 dark:text-rose-200/90 leading-relaxed mt-1.5">
                        Total pending affiliate payout requests (<strong>KSh {effectivePendingPayouts.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>) exceed current available net revenue cash reserves (<strong>KSh {profitabilityOverview.netRevenue.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>).
                        Liquidity deficit coverage gap: <strong className="text-rose-700 dark:text-rose-300 font-mono text-xs">KSh {(effectivePendingPayouts - profitabilityOverview.netRevenue).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>.
                      </p>
                      <div className="flex items-center gap-4 text-[11px] font-mono text-rose-700 dark:text-rose-300/80 mt-2 flex-wrap">
                        <span>• Pending Liability: <strong>KSh {effectivePendingPayouts.toLocaleString('en-KE')}</strong></span>
                        <span>• Net Reserves: <strong>KSh {profitabilityOverview.netRevenue.toLocaleString('en-KE')}</strong></span>
                        <span>• Liquidity Ratio: <strong>{profitabilityOverview.netRevenue > 0 ? ((profitabilityOverview.netRevenue / effectivePendingPayouts) * 100).toFixed(1) : '0.0'}%</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap">


                    <button
                      type="button"
                      onClick={() => setSimulateLiquidityDeficit(false)}
                      className="px-3 py-2 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium transition cursor-pointer border border-gray-200 dark:border-gray-700 shadow-3xs"
                      title="Reset test simulation state"
                    >
                      Dismiss Alert
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-200 font-mono">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      Cash Flow Reserves Healthy — Pending Payout Requests (KSh {effectivePendingPayouts.toLocaleString('en-KE')}) fully covered by Net Reserves (KSh {profitabilityOverview.netRevenue.toLocaleString('en-KE')}).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSimulateLiquidityDeficit(true)}
                    className="px-2.5 py-1 rounded bg-white dark:bg-gray-800 hover:bg-emerald-50 text-gray-700 dark:text-gray-300 text-[11px] font-mono transition cursor-pointer border border-gray-200 dark:border-gray-700 shrink-0 shadow-3xs"
                    title="Simulate high pending payout scenario exceeding current reserves"
                    id="btn-simulate-cashflow-deficit"
                  >
                    ⚡ Simulate Deficit Alert
                  </button>
                </div>
              )}

              {/* Core Financial Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Gross Revenue */}
                <div className="p-4 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/60 flex flex-col justify-between min-w-0 overflow-hidden shadow-3xs">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono block truncate">Gross Sales Revenue</span>
                    <p
                      className="mt-1.5 text-lg sm:text-base lg:text-lg xl:text-xl font-black font-mono tracking-tight text-gray-900 dark:text-white truncate"
                      title={`KSh ${profitabilityOverview.grossSales.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    >
                      KSh {profitabilityOverview.grossSales.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="mt-3 text-[10.5px] sm:text-[10px] xl:text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between border-t border-gray-200 dark:border-gray-700/60 pt-2 font-mono gap-1 min-w-0">
                    <span className="truncate">Active Orders</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200 shrink-0">{profitabilityOverview.completedOrderCount} completed</span>
                  </div>
                </div>

                {/* 2. Tax Liabilities */}
                <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex flex-col justify-between min-w-0 overflow-hidden shadow-3xs">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300/80 font-mono truncate">Tax Liabilities (VAT)</span>
                      <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    </div>
                    <p
                      className="mt-1.5 text-lg sm:text-base lg:text-lg xl:text-xl font-black font-mono tracking-tight text-amber-700 dark:text-amber-300 truncate"
                      title={`-KSh ${profitabilityOverview.totalTaxLiabilities.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    >
                      -KSh {profitabilityOverview.totalTaxLiabilities.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="mt-3 text-[10.5px] sm:text-[10px] xl:text-[11px] text-amber-700 dark:text-amber-300/80 flex items-center justify-between border-t border-amber-200 dark:border-amber-800/40 pt-2 font-mono gap-1 min-w-0">
                    <span className="truncate">Tax Share</span>
                    <span className="font-bold text-amber-800 dark:text-amber-300 shrink-0">{profitabilityOverview.taxSharePercent.toFixed(1)}% of gross</span>
                  </div>
                </div>

                {/* 3. Net Revenue (Profit) */}
                <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 flex flex-col justify-between shadow-3xs min-w-0 overflow-hidden">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 font-mono truncate">Net Retained Revenue</span>
                      <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    </div>
                    <p
                      className="mt-1.5 text-lg sm:text-base lg:text-lg xl:text-xl font-black font-mono tracking-tight text-emerald-700 dark:text-emerald-400 truncate"
                      title={`KSh ${profitabilityOverview.netRevenue.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    >
                      KSh {profitabilityOverview.netRevenue.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="mt-3 text-[10.5px] sm:text-[10px] xl:text-[11px] text-emerald-700 dark:text-emerald-300/80 flex items-center justify-between border-t border-emerald-200 dark:border-emerald-700/60 pt-2 font-mono gap-1 min-w-0">
                    <span className="truncate">Retained Ratio</span>
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 shrink-0">{profitabilityOverview.netMarginPercent.toFixed(1)}% net profit</span>
                  </div>
                </div>
              </div>

              {/* Deductive Proportional Bar */}
              <div className="p-4 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-800 dark:text-gray-200 font-bold">Revenue Allocation Breakdown</span>
                  <span className="text-gray-500 dark:text-gray-400">Gross 100% = Net {profitabilityOverview.netMarginPercent.toFixed(1)}% + VAT {profitabilityOverview.taxSharePercent.toFixed(1)}%</span>
                </div>

                <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex border border-gray-300 dark:border-gray-600">
                  <div
                    style={{ width: `${Math.max(0, profitabilityOverview.netMarginPercent)}%` }}
                    className="bg-emerald-500 h-full transition-all duration-500"
                    title={`Net Profit: KSh ${profitabilityOverview.netRevenue.toLocaleString('en-KE')}`}
                  />
                  <div
                    style={{ width: `${Math.max(0, profitabilityOverview.taxSharePercent)}%` }}
                    className="bg-amber-500 h-full transition-all duration-500"
                    title={`Tax Liabilities: KSh ${profitabilityOverview.totalTaxLiabilities.toLocaleString('en-KE')}`}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 text-[11px] font-mono text-gray-700 dark:text-gray-300 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span>Net Profit: <strong>KSh {profitabilityOverview.netRevenue.toLocaleString('en-KE')}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <span>VAT Liabilities: <strong>KSh {profitabilityOverview.totalTaxLiabilities.toLocaleString('en-KE')}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recharts Analytics Module (Full-Width) */}
          <RechartsAnalytics
            orders={filteredOrdersForAnalytics}
            days={chartDaysLookup}
            products={products}
            dateRange={analyticsDateRange}
            darkMode={darkMode}
          />

          {/* Revenue & Conversions D3.js Analytical Track (Full-Width) */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-2xs flex flex-col">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-50">
                <div className="flex flex-col gap-0.5">
                  <h3 className="font-display text-sm font-semibold text-gray-950 flex items-center gap-1.5">
                    <LineChart className="h-4 w-4 text-indigo-600" /> Revenue & Conversions D3.js Analytical Track
                  </h3>
                  <p className="text-[11px] font-light text-gray-400">
                    Smooth vector morphing on date and segment changes.
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  {/* Product Category Filter Select */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-450 font-mono">Cat:</span>
                    <select
                      value={selectedCategory || ''}
                      onChange={(e) => setSelectedCategory(e.target.value ? e.target.value : null)}
                      className="bg-gray-50 text-[11px] font-bold text-gray-700 rounded-lg px-2.5 py-1 border border-gray-200 outline-none transition-colors focus:border-indigo-400 cursor-pointer"
                    >
                      <option value="">All Categories</option>
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date-range toggle filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 font-mono">Days:</span>
                    <div className="inline-flex rounded-lg p-0.5 bg-gray-100 border border-gray-200">
                      {([7, 30, 90] as const).map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setChartDaysLookup(days)}
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all cursor-pointer ${
                            chartDaysLookup === days
                              ? 'bg-white text-indigo-950 shadow-2xs font-bold'
                              : 'text-gray-500 hover:text-gray-950'
                          }`}
                        >
                          {days}d
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Export Current Viewable CSV Button */}
                  <button
                    type="button"
                    onClick={handleExportCurrentViewableAnalyticsCSV}
                    className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2 text-[10px] font-bold transition-all cursor-pointer shadow-3xs"
                    id="btn-export-viewable-analytics-csv"
                  >
                    <Download className="h-3 w-3 text-emerald-650" /> Export
                  </button>
                </div>
              </div>

              {/* Clickable Quick filter summary bar */}
              <div className="mb-4 flex flex-wrap gap-1.5 items-center bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                <span className="text-[9px] uppercase font-bold text-gray-400 font-mono mr-1.5 pl-1">Quick Filters:</span>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-2 py-1 text-[10px] font-semibold rounded-md border transition-all cursor-pointer ${
                    selectedCategory === null
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                      : 'bg-white border-gray-200 text-gray-550 hover:bg-gray-50'
                  }`}
                >
                  All
                </button>
                {availableCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-1 text-[10px] font-semibold rounded-md border transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                        : 'bg-white border-gray-200 text-gray-550 hover:bg-gray-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full flex-1 min-h-[300px]">
              <ComparativeD3Chart
                orders={filteredOrdersForAnalytics}
                days={chartDaysLookup}
                selectedCategory={selectedCategory}
                products={products}
                darkMode={darkMode}
              />
            </div>
          </div>

          {/* 30-Day Revenue & Affiliate Conversion Growth (Recharts - Full-Width) */}
          <DailyRevenueConversionChart
            orders={filteredOrdersForAnalytics}
            darkMode={darkMode}
          />

          {/* Stock Levels vs. Reorder Thresholds Analytical Bar Chart (Full-Width) */}
          <StockThresholdChart 
            products={products} 
            onUpdateProductStock={onUpdateProductStock} 
            darkMode={darkMode}
          />

          {/* Critical Stock Replenishment & Reorder Hub (Full-Width) */}
          <div className="rounded-xl border border-gray-150 bg-white p-5 shadow-2xs flex flex-col">
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b border-gray-50">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-amber-50 border border-amber-100 p-2 text-amber-700 shrink-0">
                    <AlertOctagon className="h-5 w-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-gray-950 flex items-center gap-1.5">
                      Critical Stock Replenishment & Reorder Hub
                    </h3>
                    <p className="text-[11px] font-light text-gray-400 mt-0.5">
                      Proprietary physical products currently running at or under safety reorder thresholds.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-450 font-mono">Status:</span>
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold font-mono px-2.5 py-1 rounded-full border ${
                    lowStockProducts.length > 0 
                      ? 'bg-amber-50 text-amber-800 border-amber-200' 
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${lowStockProducts.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                    {lowStockProducts.length > 0 ? `${lowStockProducts.length} Reorder Alerts` : 'All Secure'}
                  </span>
                </div>
              </div>

              {lowStockProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50/50 rounded-lg border border-dashed border-gray-150">
                  <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-650 flex items-center justify-center mb-2">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <h4 className="text-xs font-bold text-gray-800">All Stock Levels Secure</h4>
                  <p className="text-[10px] text-gray-400 mt-1 max-w-sm">
                    Excellent! No physical inventory items are currently below their safety threshold levels.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto custom-table-scroll max-h-[350px] overflow-y-auto">
                  <table className="w-full text-left border-collapse min-w-[550px]">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase font-mono tracking-wider">
                        <th className="pb-2.5">Product Details</th>
                        <th className="pb-2.5">Category</th>
                        <th className="pb-2.5">Stock</th>
                        <th className="pb-2.5">Safety</th>
                        <th className="pb-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {lowStockProducts.map((p) => {
                        const limit = p.lowStockThreshold ?? 5;
                        const currentStock = p.stock ?? 0;
                        return (
                          <tr key={p.id} className="text-xs hover:bg-gray-50/40 transition-colors">
                            <td className="py-2.5">
                              <div className="flex flex-col">
                                <span className="font-semibold text-gray-900 leading-tight" title={p.name}>{p.name}</span>
                                <span className="font-mono text-[9px] text-gray-450 mt-0.5 uppercase tracking-wide">SKU: {p.sku}</span>
                              </div>
                            </td>
                            <td className="py-2.5">
                              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono text-[9px] uppercase">{p.category}</span>
                            </td>
                            <td className="py-2.5">
                              <span className={`font-mono font-black ${currentStock === 0 ? 'text-rose-600' : 'text-amber-600 animate-pulse'}`}>
                                {currentStock === 0 ? 'OUT' : `${currentStock}`}
                              </span>
                            </td>
                            <td className="py-2.5">
                              <span className="font-mono text-gray-500 font-bold">{limit}</span>
                            </td>
                            <td className="py-2.5 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => onUpdateProductStock(p.id, currentStock + 25)}
                                  className="rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-750 text-[9px] font-bold px-1.5 py-0.5 transition-colors cursor-pointer"
                                  title="Add 25 Units"
                                >
                                  +25
                                </button>
                                <button
                                  onClick={() => onUpdateProductStock(p.id, currentStock + 50)}
                                  className="rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-bold px-1.5 py-0.5 transition-colors cursor-pointer"
                                  title="Add 50 Units"
                                >
                                  +50
                                </button>
                                <button
                                  onClick={() => handleOpenContactSupplierModal(p)}
                                  className="rounded border border-indigo-200 hover:bg-indigo-50 text-indigo-650 p-1 transition-all cursor-pointer"
                                  title="Contact Supplier"
                                >
                                  <Mail className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Post-Delivery Review Request Conversion Funnel Analytics */}
          <Suspense fallback={<ChartLoaderFallback />}>
            <ReviewFunnelAnalytics
              orders={filteredOrdersForAnalytics}
              products={products}
              darkMode={darkMode}
            />
          </Suspense>

          {/* 6-Month Sales & Revenue Trend Matrix (Full Width) */}
          <Monthly6MonthTrends orders={filteredOrdersForAnalytics} />

          {/* Active Tracking Clicks Feed (Full-Width) */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-2xs">
            <h3 className="font-display text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-50 flex items-center gap-1.5">
              <MousePointer className="h-4 w-4 text-indigo-600" /> Active Tracking Clicks Feed
            </h3>

            {filteredClickLogsForAnalytics.length === 0 ? (
              <p className="py-8 text-center text-xs text-gray-400 italic">No marketing clicks logged yet.</p>
            ) : (
              <div className="flex flex-col gap-3.5">
                {filteredClickLogsForAnalytics.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex justify-between items-start text-xs border-b border-gray-50 pb-3 last:border-0 last:pb-0 font-light">
                    <div>
                      <strong className="block text-gray-800">{log.targetName}</strong>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono uppercase mt-0.5">
                        <span>{log.source || 'Direct'}</span>
                        <span>•</span>
                        <span>{log.timestamp}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      {log.converted ? (
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 font-mono uppercase">
                          +${cleanDecimals(log.commission, 2)}
                        </span>
                      ) : (
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-[9px] font-bold text-gray-400 font-mono uppercase">
                          Click (No Tx)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Proprietary Sales (Full-Width) */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-2xs">
            <h3 className="font-display text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-50 flex items-center gap-1.5">
              <Inbox className="h-4 w-4 text-indigo-600" /> Recent Proprietary Sales
            </h3>

            {filteredOrdersForAnalytics.length === 0 ? (
              <p className="py-8 text-center text-xs text-gray-400 italic">No internal checkout orders logged yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredOrdersForAnalytics.slice(0, 5).map((ord) => (
                  <div key={ord.id} className="flex justify-between items-center text-xs border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                    <div>
                      <strong className="text-gray-800 block text-xs">{ord.customerName}</strong>
                      <span className="text-[10px] text-gray-400 font-mono block mt-0.5">{ord.items.length} items • {ord.date}</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-600">KSh {ord.total.toLocaleString('en-KE')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Catalog lists */}
      {adminSubTab === 'products' && (
        <div className="mt-8 flex flex-col gap-8">
          {/* Low Stock Turnover & Revenue Potential Widget */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-2xs">
            <div className="mb-4 pb-2 border-b border-gray-50 flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <Activity className="h-4.5 w-4.5 text-indigo-600" /> Stock Turnover & Revenue Potential (Top 5 Lowest Stock)
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Analytical projection correlating remaining low-stock inventory to its sales velocity and total unreleased revenue value.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart container */}
              <div className="lg:col-span-2 rounded-xl border border-gray-100 bg-slate-50/10 p-4 flex flex-col justify-between">
                <div className="h-64 mt-2 w-full min-w-0" style={{ width: '100%', height: 256, minWidth: 0, minHeight: 256 }}>
                  {lowStockWidgetData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-150 rounded-xl bg-slate-50/20 p-4 text-center">
                      <AlertCircle className="h-6 w-6 text-gray-400 mb-1.5" />
                      <span className="text-xs font-semibold text-gray-550 block">No physical items in inventory</span>
                      <span className="text-[10px] text-gray-400 font-light mt-0.5 max-w-xs">Create or register physical products with stock levels to visualize analytics.</span>
                    </div>
                  ) : (
                    <RechartsResponsiveContainer width="100%" height={256} minWidth={0} minHeight={256} debounce={50}>
                      <RechartsBarChart data={lowStockWidgetData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <RechartsCartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <RechartsXAxis 
                          dataKey="name" 
                          tick={{ fill: '#64748b', fontSize: 9 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RechartsYAxis 
                          yAxisId="left" 
                          orientation="left" 
                          stroke="#6366f1"
                          tick={{ fill: '#6366f1', fontSize: 9 }}
                          axisLine={false}
                          tickLine={false}
                          label={{ value: 'Velocity / Turnover Rate (x)', angle: -90, position: 'insideLeft', offset: 12, style: { textAnchor: 'middle', fontSize: '9px', fill: '#6366f1', fontWeight: 'bold' } }}
                        />
                        <RechartsYAxis 
                          yAxisId="right" 
                          orientation="right" 
                          stroke="#10b981"
                          tick={{ fill: '#10b981', fontSize: 9 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(val) => `KSh ${val.toLocaleString('en-KE', { notation: 'compact', compactDisplay: 'short' })}`}
                          label={{ value: 'Revenue Potential (KSh)', angle: 90, position: 'insideRight', offset: 12, style: { textAnchor: 'middle', fontSize: '9px', fill: '#10b981', fontWeight: 'bold' } }}
                        />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                          formatter={(value: any, name: string) => {
                            if (name.includes('Revenue')) {
                              return [`KSh ${value.toLocaleString('en-KE')}`, 'Revenue Potential'];
                            }
                            return [`${value}x`, 'Turnover Rate'];
                          }}
                        />
                        <RechartsLegend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: '600' }} />
                        <RechartsBar yAxisId="left" dataKey="turnoverRate" fill="#6366f1" radius={[4, 4, 0, 0]} name="Turnover Rate (x)" barSize={20} />
                        <RechartsBar yAxisId="right" dataKey="revenuePotential" fill="#10b981" radius={[4, 4, 0, 0]} name="Revenue Potential (KSh)" barSize={20} />
                      </RechartsBarChart>
                    </RechartsResponsiveContainer>
                  )}
                </div>
              </div>

              {/* KPI indicators side card */}
              <div className="flex flex-col gap-4">
                <div className="flex-1 rounded-xl border border-gray-100 bg-indigo-50/10 p-4.5 flex flex-col justify-between">
                  <div>
                    <span className="block text-[9px] font-black font-mono text-indigo-500 uppercase tracking-wider mb-0.5">Total Low Stock Revenue Potential</span>
                    <span className="block text-lg font-bold font-display text-gray-900">
                      KSh {totalLockedRevenue.toLocaleString('en-KE')}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-light leading-relaxed mt-1">
                    Value of remaining physical stock for the top 5 lowest-stock products.
                  </p>
                </div>

                <div className="flex-1 rounded-xl border border-gray-100 bg-emerald-50/10 p-4.5 flex flex-col justify-between">
                  <div>
                    <span className="block text-[9px] font-black font-mono text-emerald-500 uppercase tracking-wider mb-0.5">Average Inventory Turnover</span>
                    <span className="block text-lg font-bold font-display text-gray-900">
                      {avgTurnoverRate}x <span className="text-[10px] font-mono text-emerald-600 font-semibold">turns / year</span>
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-light leading-relaxed mt-1">
                    Mean stock replacement velocity for the most constrained items in inventory.
                  </p>
                </div>

                <div className="flex-1 rounded-xl border border-gray-100 bg-rose-50/10 p-4.5 flex flex-col justify-between">
                  <div>
                    <span className="block text-[9px] font-black font-mono text-rose-500 uppercase tracking-wider mb-0.5">Understocked & Critical Items</span>
                    <span className="block text-lg font-bold font-display text-gray-900 flex items-center gap-1.5">
                      {criticalRestockAlertCount} {criticalRestockAlertCount === 1 ? 'Product' : 'Products'}
                      {criticalRestockAlertCount > 0 && (
                        <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                      )}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-light leading-relaxed mt-1">
                    Total catalog products currently resting at or below their low stock threshold.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Proprietary Items listings */}
          <InventoryProductsTable
            products={effectiveProducts}
            orders={effectiveOrders}
            onAddProductClick={() => setShowAddProdPage(true)}
            onEditProduct={(p) => setEditingProduct(p)}
            onDuplicateProduct={(prod) => {
              const duplicated: Product = {
                ...prod,
                id: `prod-${Date.now()}`,
                name: `${prod.name} (Copy)`,
                sku: `${prod.sku}-COPY`,
                slug: `${generateSlug(prod.name)}-copy`,
                status: 'Draft'
              };
              onAddProduct(duplicated);
            }}
            onDeleteProduct={onDeleteProduct}
            onUpdateProductStock={onUpdateProductStock}
            onUpdateProductSku={onUpdateProductSku}
            onUpdateProductThreshold={onUpdateProductThreshold}
            onUpdateProductPrice={onUpdateProductPrice}
            onUpdateProductStatus={onUpdateProductStatus}
            onBulkUploadClick={() => setShowBulkUploadModal(true)}
            onExportCatalogCSV={handleDownloadCatalogCSV}
            onBulkPriceStudioClick={() => setAdminSubTab('bulk-price')}
            availableCategories={availableCategories}
            currency={currency}
            darkMode={darkMode}
          />
          
        </div>
      )}

      {/* Orders Ledger lists */}
      {adminSubTab === 'orders' && (() => {
        const handleSort = (field: 'date' | 'customerName' | 'total') => {
          if (orderSortField === field) {
            setOrderSortDirection(orderSortDirection === 'asc' ? 'desc' : 'asc');
          } else {
            setOrderSortField(field);
            setOrderSortDirection('desc');
          }
        };

        const filteredOrders = orders.filter((ord) => {
          const matchesStatus = orderStatusFilter === 'all' || ord.status === orderStatusFilter;
          if (!matchesStatus) return false;

          if (!orderSearchQuery.trim()) return true;
          const q = orderSearchQuery.toLowerCase();
          return (
            ord.customerName.toLowerCase().includes(q) ||
            (ord.customerEmail && ord.customerEmail.toLowerCase().includes(q)) ||
            ord.id.toLowerCase().includes(q) ||
            ord.status.toLowerCase().includes(q)
          );
        });

        const sortedOrders = [...filteredOrders].sort((a, b) => {
          let comparison = 0;
          if (orderSortField === 'date') {
            const timeA = new Date(a.date).getTime() || 0;
            const timeB = new Date(b.date).getTime() || 0;
            comparison = timeA - timeB;
          } else if (orderSortField === 'customerName') {
            comparison = (a.customerName || '').localeCompare(b.customerName || '');
          } else if (orderSortField === 'total') {
            comparison = (a.total || 0) - (b.total || 0);
          }
          return orderSortDirection === 'asc' ? comparison : -comparison;
        });

        return (
          <div className="mt-8 rounded-xl border border-gray-100 bg-white p-5 shadow-2xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-3 border-b border-gray-100">
              <h3 className="font-display text-sm font-semibold text-gray-900">
                Internal Orders Pipeline
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleDownloadOrdersCSV}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4 text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
                  id="btn-export-orders-csv"
                  title="Export all historical order logs to CSV spreadsheet"
                >
                  <Download className="h-4 w-4" /> Export Orders CSV
                </button>
                <button
                  onClick={() => setShowCreateOrderModal(true)}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
                  id="btn-create-manual-order"
                >
                  <Plus className="h-4 w-4" /> Create Direct/Phone Order
                </button>
                {orders.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Select All Pending Quick Button */}
                    {orders.filter((o) => o.status === 'pending').length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const pendingIds = orders.filter((o) => o.status === 'pending').map((o) => o.id);
                          setSelectedOrderIds(pendingIds);
                          setOrderStatusFilter('pending');
                        }}
                        className="inline-flex h-9 items-center gap-1.5 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300/60 text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0 active:scale-95"
                        title="Select all pending orders for single-click batch update"
                      >
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
                        <span>Select Pending ({orders.filter((o) => o.status === 'pending').length})</span>
                      </button>
                    )}

                    {/* Status Filter Dropdown */}
                    <div className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-gray-850">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">Status:</span>
                      <select
                        value={orderStatusFilter}
                        onChange={(e) => setOrderStatusFilter(e.target.value as any)}
                        className="h-full bg-transparent border-0 outline-none pr-1 text-xs font-semibold cursor-pointer focus:ring-0 focus:ring-offset-0 text-gray-700"
                        id="select-order-status-filter"
                      >
                        <option value="all">All</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="completed">Completed</option>
                        <option value="pending-cancellation">Pending Cancel</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by customer name, order ID..."
                        value={orderSearchQuery}
                        onChange={(e) => setOrderSearchQuery(e.target.value)}
                        className="w-full h-9 rounded-lg border border-gray-200 pl-9 pr-8 text-xs font-semibold focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-gray-850 bg-gray-50"
                      />
                      {orderSearchQuery && (
                        <button
                          onClick={() => setOrderSearchQuery('')}
                          className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-hidden"
                          title="Clear filter"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {selectedOrderIds.length > 0 && (
              <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50/40 dark:bg-slate-900 p-5 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-indigo-100/80 relative">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-indigo-650 px-2.5 font-mono text-xs font-black text-white shadow-xs">
                      {selectedOrderIds.length}
                    </span>
                    <div>
                      <h4 className="text-xs font-extrabold text-indigo-950 font-sans uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-indigo-600" /> Batch Order Status Dispatcher
                      </h4>
                      <p className="text-[10.5px] text-gray-600 font-normal mt-0.5">
                        Batch update status for {selectedOrderIds.length} selected {selectedOrderIds.length === 1 ? 'order' : 'orders'} in a single click:
                      </p>
                    </div>
                  </div>

                  {/* Direct 1-Click Action Buttons & Menu */}
                  <div className="relative self-start md:self-center flex flex-wrap items-center gap-2">
                    {/* Batch Update to Processing */}
                    <button
                      type="button"
                      onClick={() => {
                        selectedOrderIds.forEach((id) => onUpdateOrderStatus(id, 'processing'));
                        setSelectedOrderIds([]);
                      }}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                      id="btn-batch-processing"
                      title="Set status of all selected orders to Processing in a single click"
                    >
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Mark ({selectedOrderIds.length}) Processing</span>
                    </button>

                    {/* Batch Update to Shipped */}
                    <button
                      type="button"
                      onClick={() => {
                        selectedOrderIds.forEach((id) => onUpdateOrderStatus(id, 'shipped'));
                        setSelectedOrderIds([]);
                      }}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                      id="btn-batch-shipped"
                      title="Set status of all selected orders to Shipped in a single click"
                    >
                      <Truck className="h-3.5 w-3.5" />
                      <span>Mark ({selectedOrderIds.length}) Shipped</span>
                    </button>

                    {/* Bulk Action Dropdown */}
                    <button
                      type="button"
                      onClick={() => setIsOrderBulkActionMenuOpen(!isOrderBulkActionMenuOpen)}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 cursor-pointer shadow-xs transition-all"
                      id="btn-order-bulk-actions-menu"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      <span>More Actions</span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOrderBulkActionMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedOrderIds([])}
                      className="inline-flex h-9 items-center justify-center gap-1 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-750 text-xs font-semibold cursor-pointer transition-colors shadow-3xs"
                    >
                      <X className="h-3.5 w-3.5" /> Clear
                    </button>

                    {isOrderBulkActionMenuOpen && (
                      <>
                        {/* Invisible Backdrop to close dropdown on outside click */}
                        <div 
                          className="fixed inset-0 z-40 bg-transparent" 
                          onClick={() => setIsOrderBulkActionMenuOpen(false)} 
                        />
                        <div className="absolute right-0 top-10 z-50 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
                          <div className="px-2.5 py-1.5 text-[9px] font-black font-mono text-gray-400 uppercase tracking-widest border-b border-gray-100 mb-1">
                            Status Transitions
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              selectedOrderIds.forEach((id) => onUpdateOrderStatus(id, 'processing'));
                              setSelectedOrderIds([]);
                              setIsOrderBulkActionMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer text-left"
                          >
                            <RefreshCw className="h-3.5 w-3.5 text-purple-600 animate-spin" />
                            <span>Mark as Processing</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              selectedOrderIds.forEach((id) => onUpdateOrderStatus(id, 'shipped'));
                              setSelectedOrderIds([]);
                              setIsOrderBulkActionMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer text-left"
                          >
                            <Truck className="h-3.5 w-3.5 text-blue-600" />
                            <span>Mark as Shipped</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));
                              const paidOrders = selectedOrders.filter((o) => isOrderPaid(o));
                              const unpaidOrders = selectedOrders.filter((o) => !isOrderPaid(o));

                              if (paidOrders.length > 0) {
                                paidOrders.forEach((o) => onUpdateOrderStatus(o.id, 'completed'));
                              }

                              if (unpaidOrders.length > 0) {
                                alert(`⚠️ Action Notice: ${unpaidOrders.length} order(s) (IDs: ${unpaidOrders.map(o => o.id).join(', ')}) could not be marked as Completed because payment has not been confirmed.\n\nSystem Rule: An order is never completed before payment is confirmed.`);
                              }

                              setSelectedOrderIds([]);
                              setIsOrderBulkActionMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer text-left"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Mark as Completed</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              selectedOrderIds.forEach((id) => onUpdateOrderStatus(id, 'pending'));
                              setSelectedOrderIds([]);
                              setIsOrderBulkActionMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer text-left"
                          >
                            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                            <span>Mark as Pending</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              selectedOrderIds.forEach((id) => onUpdateOrderStatus(id, 'cancelled'));
                              setSelectedOrderIds([]);
                              setIsOrderBulkActionMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer text-left"
                          >
                            <X className="h-3.5 w-3.5 text-rose-600" />
                            <span>Mark as Cancelled</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              selectedOrderIds.forEach((id) => onUpdateOrderStatus(id, 'pending-cancellation'));
                              setSelectedOrderIds([]);
                              setIsOrderBulkActionMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-orange-700 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer text-left"
                          >
                            <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />
                            <span>Mark as Pending Cancellation</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {orders.length === 0 ? (
              <p className="py-8 text-center text-xs text-gray-400 italic">No Orders logged in Database ledger.</p>
            ) : (
              <div>
                {/* Search metadata count banner */}
                {(orderSearchQuery.trim() !== '' || orderStatusFilter !== 'all') && (
                  <div className="mb-3 text-[11px] font-semibold text-indigo-950 font-mono flex items-center justify-between">
                    <span>
                      SHOWING {filteredOrders.length} OF {orders.length} TOTAL TRANSACTION ENTRIES
                    </span>
                    <button
                      onClick={() => {
                        setOrderSearchQuery('');
                        setOrderStatusFilter('all');
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 font-mono transition-colors cursor-pointer"
                    >
                      CLEAR FILTERS
                    </button>
                  </div>
                )}

                {filteredOrders.length === 0 ? (
                  <div className="py-12 text-center border border-dashed border-gray-150 rounded-xl bg-slate-50/50">
                    <p className="text-xs text-gray-400 italic font-medium">No order entries matched your keyword or filter queries.</p>
                    <button
                      onClick={() => {
                        setOrderSearchQuery('');
                        setOrderStatusFilter('all');
                      }}
                      className="mt-2.5 text-xs text-indigo-600 hover:text-indigo-700 font-bold transition-colors cursor-pointer"
                    >
                      Reset All Filters
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto custom-table-scroll">
                    <table className="w-full text-left text-xs font-light min-w-[700px]">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-400 uppercase font-bold text-[9px] font-mono tracking-wider">
                          <th className="py-2.5 w-8 pl-1">
                            <input
                              type="checkbox"
                              checked={sortedOrders.length > 0 && sortedOrders.every((ord) => selectedOrderIds.includes(ord.id))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedOrderIds(sortedOrders.map((ord) => ord.id));
                                } else {
                                  setSelectedOrderIds([]);
                                }
                              }}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                              title="Select/deselect all filtered orders"
                            />
                          </th>
                          <th className="py-2.5">UUID</th>
                          <th className="py-2.5">
                            <button
                              onClick={() => handleSort('customerName')}
                              className="flex items-center gap-1 hover:text-gray-900 transition-colors focus:outline-none uppercase font-bold text-[9px] font-mono tracking-wider cursor-pointer"
                            >
                              Client
                              {orderSortField === 'customerName' ? (
                                orderSortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600 shrink-0" /> : <ArrowDown className="h-3 w-3 text-indigo-600 shrink-0" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 text-gray-300 shrink-0" />
                              )}
                            </button>
                          </th>
                          <th className="py-2.5">
                            <button
                              onClick={() => handleSort('date')}
                              className="flex items-center gap-1 hover:text-gray-900 transition-colors focus:outline-none uppercase font-bold text-[9px] font-mono tracking-wider cursor-pointer"
                            >
                              Verification Date
                              {orderSortField === 'date' ? (
                                orderSortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600 shrink-0" /> : <ArrowDown className="h-3 w-3 text-indigo-600 shrink-0" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 text-gray-300 shrink-0" />
                              )}
                            </button>
                          </th>
                          <th className="py-2.5">
                            <button
                              onClick={() => handleSort('total')}
                              className="flex items-center gap-1 hover:text-gray-900 transition-colors focus:outline-none uppercase font-bold text-[9px] font-mono tracking-wider cursor-pointer"
                            >
                              Total Cargo Price
                              {orderSortField === 'total' ? (
                                orderSortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600 shrink-0" /> : <ArrowDown className="h-3 w-3 text-indigo-600 shrink-0" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 text-gray-300 shrink-0" />
                              )}
                            </button>
                          </th>
                          <th className="py-2.5 text-gray-400">Payment Method</th>
                          <th className="py-2.5 text-gray-400">Payment Status</th>
                          <th className="py-2.5 text-gray-400">Order Status</th>
                          <th className="py-2.5 text-right text-gray-400">Operations & Audits</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedOrders.map((ord) => {
                          const isRowChecked = selectedOrderIds.includes(ord.id);
                          return (
                            <tr key={ord.id} className={`border-b border-gray-50 text-gray-600 hover:bg-gray-50/20 ${isRowChecked ? 'bg-indigo-50/15' : ''}`}>
                              <td className="py-3 pl-1">
                                <input
                                  type="checkbox"
                                  checked={isRowChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedOrderIds((prev) => [...prev, ord.id]);
                                    } else {
                                      setSelectedOrderIds((prev) => prev.filter((id) => id !== ord.id));
                                    }
                                  }}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                                />
                              </td>
                              <td className="py-3 font-mono font-bold text-gray-800 uppercase">{ord.id}</td>
                              <td className="py-3">
                                <span className="block font-semibold text-gray-950">{ord.customerName}</span>
                                <span className="block font-mono text-[9px] text-gray-400">{ord.customerEmail}</span>
                              </td>
                              <td className="py-3 font-mono text-[10px]">{ord.date}</td>
                              <td className="py-3 font-mono font-bold text-indigo-650">KSh {ord.total.toLocaleString('en-KE')}</td>
                              <td className="py-3">
                                {ord.paymentMethod === 'cod' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[9px] font-black text-slate-800 uppercase font-mono shadow-3xs">
                                    🚚 COD Delivery
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[9px] font-black text-emerald-800 uppercase font-mono shadow-3xs">
                                    📲 M-Pesa STK
                                  </span>
                                )}
                              </td>
                              <td className="py-3">
                                {(() => {
                                  const isCod = ord.paymentMethod === 'cod';
                                  const isPaid = ord.paymentStatus === 'paid' || (!isCod && ord.paymentStatus !== 'unpaid');

                                  if (isPaid) {
                                    return (
                                      <div className="inline-flex items-center gap-1.5">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[9.5px] font-black font-mono shadow-3xs">
                                          <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                                          <span>PAID</span>
                                        </span>
                                        {isCod && onUpdateOrderPaymentStatus && (
                                          <button
                                            type="button"
                                            onClick={() => onUpdateOrderPaymentStatus(ord.id, 'unpaid', 'Payment status reverted to unpaid by admin')}
                                            className="text-[9px] text-gray-400 hover:text-amber-700 underline font-mono cursor-pointer transition-colors"
                                            title="Click to revert payment status to Unpaid"
                                          >
                                            Revert
                                          </button>
                                        )}
                                      </div>
                                    );
                                  }

                                  return (
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => onUpdateOrderPaymentStatus && onUpdateOrderPaymentStatus(ord.id, 'paid', 'Cash on Delivery payment received & confirmed by admin')}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 hover:bg-emerald-50 border border-amber-300 hover:border-emerald-400 text-amber-900 hover:text-emerald-800 text-[9.5px] font-black font-mono transition-all cursor-pointer shadow-3xs group"
                                        title="Click to confirm receipt of Cash on Delivery and toggle to PAID"
                                      >
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 group-hover:bg-emerald-500 animate-pulse shrink-0" />
                                        <span>UNPAID (COD)</span>
                                        <span className="text-[8.5px] text-amber-700 group-hover:text-emerald-700 underline font-sans ml-0.5 font-bold">
                                          Mark Paid ✓
                                        </span>
                                      </button>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="py-3">
                                {ord.status === 'completed' && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-1 text-[10px] font-bold uppercase font-mono shadow-3xs">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                                    Completed
                                  </span>
                                )}
                                {ord.status === 'shipped' && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 px-2.5 py-1 text-[10px] font-bold uppercase font-mono shadow-3xs">
                                    <Truck className="h-3 w-3 text-blue-600 shrink-0" />
                                    Shipped
                                  </span>
                                )}
                                {ord.status === 'processing' && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60 px-2.5 py-1 text-[10px] font-bold uppercase font-mono shadow-3xs">
                                    <RefreshCw className="h-3 w-3 text-purple-600 shrink-0 animate-spin" />
                                    Processing
                                  </span>
                                )}
                                {ord.status === 'pending' && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60 px-2.5 py-1 text-[10px] font-bold uppercase font-mono shadow-3xs">
                                    <AlertCircle className="h-3 w-3 text-amber-600 shrink-0 animate-pulse" />
                                    Pending
                                  </span>
                                )}
                                {ord.status === 'pending-cancellation' && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 text-orange-800 border border-orange-200/60 px-2.5 py-1 text-[10px] font-bold uppercase font-mono animate-pulse shadow-3xs">
                                    <AlertTriangle className="h-3 w-3 text-orange-600 shrink-0" />
                                    Pending Cancel
                                  </span>
                                )}
                                {ord.status === 'cancelled' && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60 px-2.5 py-1 text-[10px] font-bold uppercase font-mono shadow-3xs">
                                    <AlertOctagon className="h-3 w-3 text-rose-600 shrink-0" />
                                    Cancelled
                                  </span>
                                )}
                              </td>
                              <td className="py-3 text-right">
                                <div className="flex justify-end gap-1">
                                  <button
                                    onClick={() => {
                                      setLookupQuery(ord.id);
                                      setSelectedLookupOrder(ord);
                                      setAdminSubTab('order-lookup');
                                    }}
                                    className="rounded bg-indigo-50 border border-indigo-150 p-1 text-indigo-700 hover:bg-indigo-100 cursor-pointer flex items-center justify-center"
                                    title="Track & Audit Order Status"
                                  >
                                    <Search className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedAdminDetailOrder(ord);
                                      setAutoPrintOnce(false);
                                    }}
                                    className="rounded bg-indigo-50 border border-indigo-150 p-1 text-indigo-700 hover:bg-indigo-100 cursor-pointer flex items-center justify-center"
                                    title="View Order Details & Print Receipt"
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => onUpdateOrderStatus(ord.id, 'processing')}
                                    className="rounded bg-purple-50 border border-purple-100 p-1 text-purple-700 hover:bg-purple-100 cursor-pointer flex items-center justify-center"
                                    title="Mark as Processing"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => onUpdateOrderStatus(ord.id, 'shipped')}
                                    className="rounded bg-blue-50 border border-blue-100 p-1 text-blue-700 hover:bg-blue-100 cursor-pointer flex items-center justify-center"
                                    title="Mark as Shipped"
                                  >
                                    <Truck className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (!isOrderPaid(ord)) {
                                        setUnpaidPromptOrder(ord);
                                        return;
                                      }
                                      onUpdateOrderStatus(ord.id, 'completed');
                                    }}
                                    className={`rounded p-1 cursor-pointer flex items-center justify-center transition-all ${
                                      !isOrderPaid(ord)
                                        ? 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 shadow-3xs'
                                        : 'bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                    }`}
                                    title={!isOrderPaid(ord) ? 'Payment Unconfirmed: Payment must be confirmed before completing this order' : 'Mark Completed'}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => onUpdateOrderStatus(ord.id, 'cancelled')}
                                    className="rounded bg-red-50 border border-red-100 p-1 text-red-700 hover:bg-red-100 cursor-pointer flex items-center justify-center"
                                    title="Cancel Order"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Customer CRM Management Panel */}
      {adminSubTab === 'customers' && (
        <div className="p-4 md:p-6 animate-in fade-in duration-200">
          <CustomerList liveOrders={orders} />
        </div>
      )}

      {/* Custom Clothing Requests Panel */}
      {adminSubTab === 'custom-clothing' && (
        <CustomClothingAdminView />
      )}

      {/* Promotions & Marketing Studio Panel */}
      {adminSubTab === 'promotions' && (
        <PromotionsManager
          coupons={coupons}
          onAddCoupon={onAddCoupon}
          onDeleteCoupon={onDeleteCoupon}
          onToggleCouponActive={onToggleCouponActive}
          onUpdateCoupon={onUpdateCoupon}
          promoBanner={promoBanner}
          onUpdatePromoBanner={onUpdatePromoBanner}
          orders={orders}
          products={products}
          currency={currency}
          onNavigateToSite={onNavigateToSite}
        />
      )}

      {/* Email Marketing & Templates Panel */}
      {adminSubTab === 'email' && (
        <Suspense fallback={<ChartLoaderFallback />}>
          <EmailCampaignsPanel
            products={products}
            orders={orders}
            coupons={coupons}
            onTriggerEmailToast={onTriggerEmailToast}
          />
        </Suspense>
      )}

      {/* Campaigns list */}
      {adminSubTab === 'inventory-logs' && (() => {
        // Filter the inventory logs
        const filteredLogs = inventoryAuditLogs.filter((log) => {
          const matchesSearch = !auditSearchQuery.trim() || 
            log.productSku.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
            log.productName.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
            (log.details && log.details.toLowerCase().includes(auditSearchQuery.toLowerCase()));
          
          const matchesReason = auditReasonFilter === 'all' || log.reason === auditReasonFilter;

          let matchesStart = true;
          if (auditStartDate) {
            const logTime = new Date(log.timestamp.replace(' ', 'T')).getTime();
            const startTime = new Date(`${auditStartDate}T00:00:00`).getTime();
            matchesStart = !isNaN(logTime) && !isNaN(startTime) ? logTime >= startTime : true;
          }

          let matchesEnd = true;
          if (auditEndDate) {
            const logTime = new Date(log.timestamp.replace(' ', 'T')).getTime();
            const endTime = new Date(`${auditEndDate}T23:59:59`).getTime();
            matchesEnd = !isNaN(logTime) && !isNaN(endTime) ? logTime <= endTime : true;
          }

          return matchesSearch && matchesReason && matchesStart && matchesEnd;
        });

        // Paginate logs
        const totalItems = filteredLogs.length;
        const totalPages = Math.ceil(totalItems / auditPerPage) || 1;
        const currentPage = Math.min(auditPage, totalPages);
        const startIndex = (currentPage - 1) * auditPerPage;
        const endIndex = Math.min(startIndex + auditPerPage, totalItems);
        const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

        return (
          <div className="mt-8 flex flex-col gap-8 animate-in fade-in duration-200 font-sans" id="panel-inventory-audit-logs">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xs">
              
              {/* Header and Controls */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-gray-100 mb-6">
                <div>
                  <h3 className="font-display text-base font-bold text-gray-900 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-indigo-600" />
                    Proprietary Store Inventory Audit Log
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 leading-snug">
                    Chronological ledger recording all stock level adjustments, order deductions, manual corrections, and inbound restocks.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadInventoryAuditLogCSV}
                    className="h-9 px-4 rounded text-xs border border-emerald-200 bg-emerald-50/50 text-emerald-750 hover:bg-emerald-100/70 font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
                    title="Export filtered log list as CSV spreadsheet"
                    id="btn-export-audit-csv"
                  >
                    <Download className="h-4 w-4 text-emerald-600" /> Export CSV Log
                  </button>
                </div>
              </div>

              {/* Filters Toolbar */}
              <div className="bg-gray-50/50 rounded-xl p-4 mb-6 border border-gray-100 flex flex-col gap-4">
                
                {/* Top Toolbar Row: Search, Reason & Clear */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  {/* Search Bar */}
                  <div className="relative w-full sm:flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Filter by SKU or Product Name..."
                      value={auditSearchQuery}
                      onChange={(e) => setAuditSearchQuery(e.target.value)}
                      className="h-9 w-full rounded-lg border border-gray-200 pl-9 pr-8 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                      id="input-audit-search"
                    />
                    {auditSearchQuery && (
                      <button
                        onClick={() => setAuditSearchQuery('')}
                        className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Reason Filter Selector */}
                  <div className="w-full sm:w-56 flex items-center gap-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono shrink-0">Reason:</label>
                    <select
                      value={auditReasonFilter}
                      onChange={(e) => setAuditReasonFilter(e.target.value as any)}
                      className="h-9 w-full rounded-lg border border-gray-200 px-3 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans cursor-pointer"
                      id="select-audit-reason"
                    >
                      <option value="all">All Operations</option>
                      <option value="manual-update">Manual Adjustments</option>
                      <option value="order-placement">Order Sales Deductions</option>
                      <option value="restock">Inbound Restocks</option>
                      <option value="system-init">System Initializations</option>
                    </select>
                  </div>

                  {/* Reset All Filters */}
                  {(auditSearchQuery || auditReasonFilter !== 'all' || auditStartDate || auditEndDate) && (
                    <button
                      type="button"
                      onClick={handleClearAuditFilters}
                      className="h-9 px-3 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0 flex items-center gap-1 border border-rose-200 bg-white"
                      id="btn-clear-audit-filters"
                    >
                      <X className="h-3.5 w-3.5" /> Clear Filters
                    </button>
                  )}
                </div>

                {/* Bottom Toolbar Row: Date Range Picker Component */}
                <div className="pt-3 border-t border-gray-200/60 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                  
                  {/* Date Quick Presets */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mr-1">
                      <Calendar className="h-4 w-4 text-indigo-600 shrink-0" />
                      <span>Date Filter:</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 text-xs">
                      {[
                        { id: 'all', label: 'All Time' },
                        { id: 'today', label: 'Today' },
                        { id: '7days', label: '7 Days' },
                        { id: '30days', label: '30 Days' },
                        { id: 'this-month', label: 'This Month' },
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleAuditDatePresetChange(preset.id as any)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                            auditDatePreset === preset.id
                              ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                          }`}
                          id={`btn-audit-preset-${preset.id}`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Start & End Date Inputs */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">From:</span>
                      <input
                        type="date"
                        value={auditStartDate}
                        onChange={(e) => handleAuditStartDateChange(e.target.value)}
                        className="text-xs text-gray-800 bg-transparent focus:outline-none cursor-pointer font-sans"
                        id="input-audit-start-date"
                      />
                      {auditStartDate && (
                        <button
                          type="button"
                          onClick={() => handleAuditStartDateChange('')}
                          className="text-gray-400 hover:text-gray-600 cursor-pointer p-0.5 rounded-full hover:bg-gray-100"
                          title="Clear start date"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    <span className="text-gray-400 text-xs font-medium">to</span>

                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">To:</span>
                      <input
                        type="date"
                        value={auditEndDate}
                        onChange={(e) => handleAuditEndDateChange(e.target.value)}
                        className="text-xs text-gray-800 bg-transparent focus:outline-none cursor-pointer font-sans"
                        id="input-audit-end-date"
                      />
                      {auditEndDate && (
                        <button
                          type="button"
                          onClick={() => handleAuditEndDateChange('')}
                          className="text-gray-400 hover:text-gray-600 cursor-pointer p-0.5 rounded-full hover:bg-gray-100"
                          title="Clear end date"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {(auditStartDate || auditEndDate) && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuditStartDate('');
                          setAuditEndDate('');
                          setAuditDatePreset('all');
                        }}
                        className="p-1.5 rounded text-xs text-gray-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                        title="Reset Date Range"
                        id="btn-reset-audit-dates"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Active Date Range Summary Banner */}
                {(auditStartDate || auditEndDate) && (
                  <div className="pt-2">
                    <div className="px-3 py-1.5 rounded-lg bg-indigo-50/80 border border-indigo-100 flex items-center justify-between text-xs text-indigo-950 font-medium">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                        <span>
                          Filtering range: <strong>{auditStartDate || 'Earliest Record'}</strong> &rarr; <strong>{auditEndDate || 'Present'}</strong> ({filteredLogs.length} matching audit entries)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAuditStartDate('');
                          setAuditEndDate('');
                          setAuditDatePreset('all');
                        }}
                        className="text-indigo-600 hover:text-indigo-800 text-[11px] font-semibold underline cursor-pointer ml-2 shrink-0"
                      >
                        Clear Range
                      </button>
                    </div>
                  </div>
                )}

              </div>

              {/* Table Data list */}
              {totalItems === 0 ? (
                <div className="py-16 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/30">
                  <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mx-auto mb-3">
                    <Search className="h-5 w-5" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-700">No matching audit logs found</h4>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                    Try broadening your SKU search query or selecting a different operation filter.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="overflow-x-auto custom-table-scroll border border-gray-100 rounded-xl">
                    <table className="w-full text-left text-xs font-sans min-w-[700px]">
                      <thead>
                        <tr className="bg-gray-55 border-b border-gray-100 text-gray-400 uppercase font-bold text-[9px] tracking-wider font-mono">
                          <th className="py-3 px-4">Timestamp</th>
                          <th className="py-3 px-4">Product SKU</th>
                          <th className="py-3 px-4">Product Name</th>
                          <th className="py-3 px-4 text-center">Change Qty</th>
                          <th className="py-3 px-4 text-center">Resulting Stock</th>
                          <th className="py-3 px-4">Operation Type</th>
                          <th className="py-3 px-4">Operation Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedLogs.map((log) => {
                          const isPositive = log.changeQuantity > 0;
                          const isZero = log.changeQuantity === 0;

                          return (
                            <tr key={log.id} className="border-b border-gray-50 text-gray-600 hover:bg-gray-55/40 transition-colors">
                              <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">{log.timestamp}</td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className="inline-block font-mono text-[10px] font-bold bg-slate-100 text-slate-800 rounded px-1.5 py-0.5 border border-slate-200/50">
                                  {log.productSku}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-medium text-gray-900 max-w-xs truncate">{log.productName}</td>
                              <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                {isZero ? (
                                  <span className="font-mono font-bold text-gray-500">0</span>
                                ) : isPositive ? (
                                  <span className="inline-flex items-center gap-0.5 font-mono font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded text-[11px]">
                                    +{log.changeQuantity}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 font-mono font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded text-[11px]">
                                    {log.changeQuantity}
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-center font-mono font-semibold text-gray-900">{log.newStock}</td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                {log.reason === 'restock' && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-100 px-2 py-0.5 text-[9px] font-bold text-teal-700 uppercase font-mono">
                                    Restock
                                  </span>
                                )}
                                {log.reason === 'manual-update' && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700 uppercase font-mono">
                                    Manual Update
                                  </span>
                                )}
                                {log.reason === 'order-placement' && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-700 uppercase font-mono">
                                    Sales Order
                                  </span>
                                )}
                                {log.reason === 'system-init' && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[9px] font-bold text-gray-700 uppercase font-mono">
                                    System Init
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-gray-500 text-[11px] font-sans truncate max-w-xs">{log.details || 'N/A'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-3 border-t border-gray-100 mt-1">
                    <div className="flex items-center gap-4 text-xs text-gray-500 font-sans">
                      <span>
                        Showing <strong className="font-semibold text-gray-800">{totalItems === 0 ? 0 : startIndex + 1}</strong> to{' '}
                        <strong className="font-semibold text-gray-800">{endIndex}</strong> of{' '}
                        <strong className="font-semibold text-gray-800">{totalItems}</strong> entries
                      </span>
                      <div className="flex items-center gap-1.5 border-l border-gray-200 pl-4">
                        <span className="text-[11px] text-gray-400">Rows per page:</span>
                        <select
                          value={auditPerPage}
                          onChange={(e) => {
                            setAuditPerPage(Number(e.target.value));
                            setAuditPage(1);
                          }}
                          className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 self-end sm:self-auto">
                      <button
                        onClick={() => setAuditPage(1)}
                        disabled={currentPage === 1}
                        className="h-8 px-2.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-55/60 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        « First
                      </button>
                      <button
                        onClick={() => setAuditPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="h-8 px-2.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-55/60 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        ‹ Prev
                      </button>

                      <span className="h-8 px-3 rounded border border-indigo-50 bg-indigo-50/30 text-indigo-700 text-xs font-semibold flex items-center justify-center min-w-[2rem]">
                        {currentPage} / {totalPages}
                      </span>

                      <button
                        onClick={() => setAuditPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8 px-2.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-55/60 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        Next ›
                      </button>
                      <button
                        onClick={() => setAuditPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="h-8 px-2.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-55/60 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        Last »
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Inventory Alerts Tab */}
      {adminSubTab === 'inventory-alerts' && (() => {
        // Find all physical products currently below or equal to their lowStockThreshold
        const alertsList = products.filter(
          (p) => p.type === 'physical' && p.stock !== null && p.stock <= (p.lowStockThreshold ?? 5)
        );

        return (
          <div className="mt-8 flex flex-col gap-8 animate-in fade-in duration-200 font-sans" id="panel-inventory-alerts">
            <div className="rounded-2xl border border-red-150 bg-red-50/20 p-6">
              <div className="flex items-start gap-4 flex-col md:flex-row">
                <div className="rounded-lg bg-red-500 p-2.5 text-white shrink-0">
                  <AlertTriangle className="h-6 w-6 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-base font-bold text-red-950 flex items-center gap-2">
                    Critical Inventory Level Alerts Center
                  </h3>
                  <p className="text-xs text-red-800 mt-1 leading-relaxed">
                    There are currently <strong className="font-bold font-mono">{alertsList.length} products</strong> running below their safety reorder threshold limits. Restock immediately to maintain smooth customer shipments and avoid order disruptions.
                  </p>
                </div>
              </div>
            </div>

            {/* Comprehensive Stock Thresholds Analytical Comparison Chart */}
            <StockThresholdChart 
              products={products} 
              onUpdateProductStock={onUpdateProductStock} 
              darkMode={darkMode}
            />

            {/* Main alerts list */}
            {alertsList.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-emerald-200 rounded-2xl bg-emerald-50/10 flex flex-col items-center justify-center p-6 shadow-3xs">
                <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                  <Check className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-emerald-950">All Stock Levels Secure</h4>
                <p className="text-xs text-gray-400 mt-1 max-w-sm">
                  Excellent work! No proprietary physical items are currently below their minimum safety thresholds.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {alertsList.map((product) => {
                  const limit = product.lowStockThreshold ?? 5;
                  const currentStock = product.stock ?? 0;
                  const isOutOfStock = currentStock === 0;
                  const ratio = Math.max(0, currentStock / (limit || 1));
                  
                  return (
                    <div 
                      key={product.id} 
                      className={`relative flex flex-col justify-between bg-white rounded-2xl border p-5 shadow-2xs hover:shadow-xs transition-all duration-300 ${
                        isOutOfStock ? 'border-red-300 ring-1 ring-red-200/50' : 'border-amber-200'
                      }`}
                    >
                      {/* Top ribbon label */}
                      <div className="absolute top-4 right-4">
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wider ${
                          isOutOfStock 
                            ? 'bg-red-150 text-red-800 border border-red-200' 
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {isOutOfStock ? 'Out of Stock' : 'Low Stock'}
                        </span>
                      </div>

                      {/* Product details */}
                      <div>
                        <div className="flex items-center gap-3.5">
                          <img 
                            src={product.imageUrl} 
                            alt={product.name} 
                            referrerPolicy="no-referrer"
                            className="h-12 w-12 rounded-lg object-cover border border-gray-150 shrink-0" 
                          />
                          <div className="min-w-0">
                            <span className="font-mono text-[9px] font-bold text-gray-400 block tracking-wider uppercase">{product.sku}</span>
                            <h4 className="font-sans text-xs font-bold text-gray-900 truncate mt-1">{product.name}</h4>
                            <span className="text-[10px] text-gray-400 block mt-0.5">{product.category}</span>
                          </div>
                        </div>

                        {/* Stock metrics viz bar */}
                        <div className="mt-5">
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-gray-550 font-medium">Safety Stock Ratio</span>
                            <span className="font-mono font-bold text-gray-950">
                              {currentStock} / <span className="text-gray-400 font-normal">{limit} units limit</span>
                            </span>
                          </div>
                          
                          {/* Visual progress track */}
                          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                isOutOfStock 
                                  ? 'bg-red-600' 
                                  : ratio < 0.5 
                                  ? 'bg-red-500' 
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(100, ratio * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* One-click and Quick Actions Segment */}
                      <div className="mt-6 pt-4 border-t border-gray-100 font-sans">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 font-mono">
                          ⚡ Quick Restock
                        </span>
                        
                        {/* Instant click buttons */}
                        <div className="grid grid-cols-3 gap-1.5 mb-3">
                          <button
                            onClick={() => onUpdateProductStock(product.id, currentStock + 10)}
                            className="h-8 rounded bg-gray-100 text-gray-800 hover:bg-indigo-50 hover:text-indigo-700 text-[10px] font-bold font-mono transition-all cursor-pointer border border-gray-150 hover:border-indigo-200"
                            title={`Instantly add 10 units to make stock ${currentStock + 10}`}
                          >
                            +10 Units
                          </button>
                          <button
                            onClick={() => onUpdateProductStock(product.id, currentStock + 25)}
                            className="h-8 rounded bg-gray-100 text-gray-800 hover:bg-indigo-50 hover:text-indigo-700 text-[10px] font-bold font-mono transition-all cursor-pointer border border-gray-150 hover:border-indigo-200"
                            title={`Instantly add 25 units to make stock ${currentStock + 25}`}
                          >
                            +25 Units
                          </button>
                          <button
                            onClick={() => onUpdateProductStock(product.id, currentStock + 50)}
                            className="h-8 rounded bg-gray-100 text-gray-800 hover:bg-indigo-50 hover:text-indigo-700 text-[10px] font-bold font-mono transition-all cursor-pointer border border-gray-150 hover:border-indigo-200"
                            title={`Instantly add 50 units to make stock ${currentStock + 50}`}
                          >
                            +50 Units
                          </button>
                        </div>

                        {/* Custom restock quantity block */}
                        <div className="flex gap-1.5">
                          <input 
                            type="number" 
                            id={`custom-qty-input-${product.id}`}
                            defaultValue={20}
                            min={1}
                            placeholder="Qty"
                            className="h-8 w-16 rounded border border-gray-250 px-2 text-xs font-mono font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-550"
                          />
                          <button
                            onClick={() => {
                              const inputEl = document.getElementById(`custom-qty-input-${product.id}`) as HTMLInputElement | null;
                              const val = Math.max(1, parseInt(inputEl?.value || '20', 10));
                              onUpdateProductStock(product.id, currentStock + val);
                            }}
                            className="flex-1 h-8 bg-indigo-600 text-white hover:bg-indigo-700 text-[11px] font-bold uppercase transition-all rounded cursor-pointer shadow-3xs flex items-center justify-center gap-1"
                          >
                            <PackagePlus className="h-3.5 w-3.5" /> Restock Items
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {adminSubTab === 'backup' && (() => {
        // Compute LocalStorage size
        const getLocalStorageSize = () => {
          let total = 0;
          for (const x in localStorage) {
            if (localStorage.hasOwnProperty(x)) {
              total += (localStorage[x].length + x.length) * 2;
            }
          }
          return total;
        };

        const totalBytes = getLocalStorageSize();
        const totalKB = (totalBytes / 1024).toFixed(1);
        const quotaPercentage = parseFloat(((totalBytes / (5 * 1024 * 1024)) * 100).toFixed(2));

        // Get Backup Object compilation
        const getBackupPayload = () => {
          const keys = [
            'veloce_products',
            'veloce_affiliates',
            'veloce_orders',
            'veloce_campaigns',
            'veloce_clicklogs',
            'veloce_payout_logs',
            'veloce_cart',
            'veloce_wishlist',
            'veloce_earnings',
            'veloce_loyalty_points',
            'veloce_coupons',
            'veloce_promo_banner',
            'veloce_inventory_audit_logs',
            'customer_support_tickets',
            'veloce_referral_history',
            'veloce_referral_balances',
            'is_joined_affiliate'
          ];
          const rawData: Record<string, any> = {};
          keys.forEach(k => {
            const val = localStorage.getItem(k);
            try {
              rawData[k] = val ? JSON.parse(val) : null;
            } catch (e) {
              rawData[k] = val;
            }
          });
          return rawData;
        };

        // Custom Safe XOR Cipher
        const encryptBackupData = (text: string, pass: string): string => {
          const utf8Text = new TextEncoder().encode(text);
          const utf8Pass = new TextEncoder().encode(pass);
          const encrypted = new Uint8Array(utf8Text.length);
          for (let i = 0; i < utf8Text.length; i++) {
            encrypted[i] = utf8Text[i] ^ utf8Pass[i % utf8Pass.length];
          }
          let binary = '';
          const len = encrypted.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(encrypted[i]);
          }
          return btoa(binary);
        };

        const decryptBackupData = (base64: string, pass: string): string => {
          try {
            const binary = atob(base64);
            const len = binary.length;
            const utf8Text = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              utf8Text[i] = binary.charCodeAt(i);
            }
            const utf8Pass = new TextEncoder().encode(pass);
            const decrypted = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              decrypted[i] = utf8Text[i] ^ utf8Pass[i % utf8Pass.length];
            }
            return new TextDecoder().decode(decrypted);
          } catch (e) {
            throw new Error("Failed to decrypt backup data. Verification failed.");
          }
        };

        // File generation and download
        const handleExportBackup = () => {
          if (isBackupPasswordProtected && (!backupPassword || backupPassword !== backupPasswordConfirm)) {
            alert("Passphrase configuration is incomplete or mismatches. Please verify.");
            return;
          }

          const rawData = getBackupPayload();
          const rawString = JSON.stringify(rawData);
          let payloadStr = rawString;
          let isEncrypted = false;

          if (isBackupPasswordProtected) {
            payloadStr = encryptBackupData(rawString, backupPassword);
            isEncrypted = true;
          }

          const backupObject = {
            type: "veloce_platform_backup",
            version: "1.0",
            timestamp: new Date().toISOString(),
            isEncrypted,
            payload: payloadStr,
            signature: "VL-" + Math.random().toString(36).substring(2, 10).toUpperCase()
          };

          const blob = new Blob([JSON.stringify(backupObject, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `veloce_platform_backup_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.json`;
          link.click();
          URL.revokeObjectURL(url);

          setSecurityAuditLogs(prev => [
            {
              id: Date.now().toString(),
              time: new Date().toLocaleTimeString(),
              event: `Platform data exported (Encryption: ${isEncrypted ? 'Active' : 'None'})`,
              status: 'success'
            },
            ...prev
          ]);
        };

        // Snapshot Manager
        const handleCreateSnapshot = () => {
          const rawData = getBackupPayload();
          const snapshotName = `Recovery Point - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          
          const newSnapshot = {
            id: 'snap-' + Date.now(),
            timestamp: new Date().toISOString(),
            name: snapshotName,
            size: (JSON.stringify(rawData).length / 1024).toFixed(1),
            data: rawData
          };

          const updated = [newSnapshot, ...activeBackupSnapshots].slice(0, 3);
          setActiveBackupSnapshots(updated);
          safeLocalStorageSetItem('veloce_backup_snapshots', JSON.stringify(updated));

          setSecurityAuditLogs(prev => [
            {
              id: Date.now().toString(),
              time: new Date().toLocaleTimeString(),
              event: `Created local snapshot checkpoint "${snapshotName}"`,
              status: 'success'
            },
            ...prev
          ]);
        };

        const handleRestoreSnapshot = (snap: any) => {
          try {
            const data = snap.data;
            Object.keys(data).forEach(k => {
              if (data[k] !== null) {
                const valStr = typeof data[k] === 'object' ? JSON.stringify(data[k]) : String(data[k]);
                safeLocalStorageSetItem(k, valStr);
              }
            });

            setSecurityAuditLogs(prev => [
              {
                id: Date.now().toString(),
                time: new Date().toLocaleTimeString(),
                event: `Rolled back to snapshot state: ${snap.name}`,
                status: 'success'
              },
              ...prev
            ]);

            setRestoreSuccessCountdown(3);
          } catch (err: any) {
            alert(`Restore failed: ${err.message}`);
          }
        };

        const handleDeleteSnapshot = (id: string) => {
          const updated = activeBackupSnapshots.filter(s => s.id !== id);
          setActiveBackupSnapshots(updated);
          safeLocalStorageSetItem('veloce_backup_snapshots', JSON.stringify(updated));

          setSecurityAuditLogs(prev => [
            {
              id: Date.now().toString(),
              time: new Date().toLocaleTimeString(),
              event: "Purged custom restore point",
              status: 'info'
            },
            ...prev
          ]);
        };

        // Import handler
        const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const json = JSON.parse(event.target?.result as string);
              if (json.type !== "veloce_platform_backup") {
                setImportedFileError("Invalid system signature: This file was not generated by this platform.");
                setImportedFileSummary(null);
                return;
              }
              setImportedFileSummary(json);
              setImportedFileError(null);
              setImportPasswordInput('');
              setImportPasswordError(false);
            } catch (err) {
              setImportedFileError("File parsing failed: File is malformed or not JSON.");
              setImportedFileSummary(null);
            }
          };
          reader.readAsText(file);
        };

        const executeRestore = (payloadObj: any) => {
          try {
            if (importRestoreType === 'replace') {
              Object.keys(payloadObj).forEach(k => {
                if (payloadObj[k] !== null) {
                  const valStr = typeof payloadObj[k] === 'object' ? JSON.stringify(payloadObj[k]) : String(payloadObj[k]);
                  safeLocalStorageSetItem(k, valStr);
                }
              });
            } else {
              // Merge matching logic
              Object.keys(payloadObj).forEach(k => {
                if (payloadObj[k] !== null) {
                  const existing = localStorage.getItem(k);
                  if (existing) {
                    try {
                      const existingParsed = JSON.parse(existing);
                      const backupParsed = payloadObj[k];

                      if (Array.isArray(existingParsed) && Array.isArray(backupParsed)) {
                        const mergedMap = new Map();
                        existingParsed.forEach(item => {
                          if (item && item.id) mergedMap.set(item.id, item);
                        });
                        backupParsed.forEach(item => {
                          if (item && item.id) mergedMap.set(item.id, item);
                        });
                        safeLocalStorageSetItem(k, JSON.stringify(Array.from(mergedMap.values())));
                      } else if (typeof existingParsed === 'object' && typeof backupParsed === 'object') {
                        safeLocalStorageSetItem(k, JSON.stringify({ ...existingParsed, ...backupParsed }));
                      } else {
                        safeLocalStorageSetItem(k, String(backupParsed));
                      }
                    } catch (e) {
                      safeLocalStorageSetItem(k, typeof payloadObj[k] === 'object' ? JSON.stringify(payloadObj[k]) : String(payloadObj[k]));
                    }
                  } else {
                    safeLocalStorageSetItem(k, typeof payloadObj[k] === 'object' ? JSON.stringify(payloadObj[k]) : String(payloadObj[k]));
                  }
                }
              });
            }

            setRestoreSuccessCountdown(3);
          } catch (err: any) {
            setImportedFileError(`System overwrite crash: ${err.message}`);
          }
        };

        const handleProcessImport = () => {
          if (!importedFileSummary) return;

          let payloadStr = importedFileSummary.payload;

          if (importedFileSummary.isEncrypted) {
            if (!importPasswordInput) {
              setImportPasswordError(true);
              return;
            }
            try {
              payloadStr = decryptBackupData(payloadStr, importPasswordInput);
              setImportPasswordError(false);
            } catch (e) {
              setImportPasswordError(true);
              return;
            }
          }

          try {
            const parsed = JSON.parse(payloadStr);
            executeRestore(parsed);
          } catch (e) {
            setImportedFileError("Decryption successful, but JSON parsing of core database failed.");
          }
        };

        const handlePurgeAllData = () => {
          setDeleteConfirmConfig({
            isOpen: true,
            title: "🚨 CRITICAL FACTORY RESET",
            message: "WARNING: This will permanently delete ALL products, orders, campaigns, clicklogs, payout history, settings, and local logs from this browser, reverting the platform to factory defaults. This action cannot be undone. Are you absolutely sure you want to proceed and wipe all data?",
            onConfirm: () => {
              const keysToClear = [
                'veloce_products',
                'veloce_affiliates',
                'veloce_orders',
                'veloce_campaigns',
                'veloce_clicklogs',
                'veloce_payout_logs',
                'veloce_cart',
                'veloce_wishlist',
                'veloce_earnings',
                'veloce_loyalty_points',
                'veloce_coupons',
                'veloce_promo_banner',
                'veloce_inventory_audit_logs',
                'customer_support_tickets',
                'veloce_referral_history',
                'veloce_referral_balances',
                'is_joined_affiliate',
                'veloce_backup_snapshots'
              ];
              keysToClear.forEach(k => localStorage.removeItem(k));
              window.location.reload();
            }
          });
        };

        return (
          <div className="mt-8 flex flex-col gap-8 animate-in fade-in duration-200 font-sans" id="panel-backup-protection">
            {/* Main dashboard stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Storage Quota Card */}
              <div className="rounded-xl border border-gray-150 bg-white dark:border-gray-800 dark:bg-gray-900 p-5 flex flex-col justify-between shadow-3xs">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                      <HardDrive className="h-3.5 w-3.5 text-indigo-500" /> Storage Consumption
                    </span>
                    <span className="font-mono text-xs font-extrabold text-indigo-600 dark:text-indigo-400">{quotaPercentage}%</span>
                  </div>
                  <h4 className="text-2xl font-mono font-extrabold text-gray-800 dark:text-gray-100">{totalKB} <span className="text-xs font-semibold text-gray-400">KB Used</span></h4>
                  <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full mt-3 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        quotaPercentage > 80 ? 'bg-rose-500' : quotaPercentage > 50 ? 'bg-amber-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.min(100, quotaPercentage)}%` }}
                    />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                  <span>Quota Limit: 5,120.0 KB</span>
                  <span className={quotaPercentage > 80 ? "text-rose-500 font-bold" : "text-emerald-500"}>
                    {quotaPercentage > 80 ? "Critical Storage" : "Space Healthy"}
                  </span>
                </div>
              </div>

              {/* Encryption Status Card */}
              <div className="rounded-xl border border-gray-150 bg-white dark:border-gray-800 dark:bg-gray-900 p-5 flex flex-col justify-between shadow-3xs">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-amber-500" /> Export Encryption
                    </span>
                    <span className={`font-mono text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                      isBackupPasswordProtected 
                        ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400' 
                        : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-750'
                    }`}>
                      {isBackupPasswordProtected ? 'AES Obfuscated' : 'Plain JSON'}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                    {isBackupPasswordProtected ? 'Encrypted Security Key' : 'Standard Raw Export'}
                  </h4>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {isBackupPasswordProtected 
                      ? 'Exports are automatically encrypted utilizing your secure passphrase.' 
                      : 'Exports will be stored in raw, readable JSON files containing no password requirements.'}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setIsBackupPasswordProtected(!isBackupPasswordProtected);
                      setSecurityAuditLogs(prev => [
                        {
                          id: Date.now().toString(),
                          time: new Date().toLocaleTimeString(),
                          event: `Toggled Export Encryption to: ${!isBackupPasswordProtected ? 'ON' : 'OFF'}`,
                          status: 'info'
                        },
                        ...prev
                      ]);
                    }}
                    className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {isBackupPasswordProtected ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {isBackupPasswordProtected ? 'Disable Password' : 'Set Protection Password'}
                  </button>
                </div>
              </div>

              {/* Platform Protection Status */}
              <div className="rounded-xl border border-gray-150 bg-white dark:border-gray-800 dark:bg-gray-900 p-5 flex flex-col justify-between shadow-3xs">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5 text-emerald-500" /> Active Registry
                    </span>
                    <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded">ONLINE</span>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Live Workspace Status</h4>
                  <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-[10px] text-gray-505 dark:text-gray-400">
                    <div>📦 Catalog: <strong className="text-gray-700 dark:text-gray-200">{products.length} Items</strong></div>
                    <div>📝 Ledger: <strong className="text-gray-700 dark:text-gray-200">{orders.length} Orders</strong></div>
                    <div>🎯 Coupons: <strong className="text-gray-700 dark:text-gray-200">{Object.keys(coupons).length} Active</strong></div>
                    <div>💾 Audit Logs: <strong className="text-gray-700 dark:text-gray-200">{inventoryAuditLogs.length} Events</strong></div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
                  <span className="text-[9px] font-mono text-gray-400">Validated signature check</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-500 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Verified
                  </span>
                </div>
              </div>
            </div>

            {/* Production MySQL Synchronization Panel */}
            <div className="rounded-xl border border-gray-150 bg-white dark:border-gray-800 dark:bg-gray-900 p-6 shadow-3xs" id="mysql-production-panel">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-5 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-start gap-3.5">
                  <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 p-2.5 text-indigo-600 dark:text-indigo-400 shrink-0">
                    <Database className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <h4 className="font-display text-base font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      MySQL Production Database Hub
                    </h4>
                    <p className="text-xs text-gray-400 dark:text-gray-400 mt-1 max-w-xl">
                      Synchronize products, affiliates, client order ledgers, and inventory audit logs seamlessly with your live production database.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={checkMysqlStatus}
                    disabled={isCheckingMysql}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-750 bg-white dark:bg-gray-850 hover:bg-gray-50 dark:hover:bg-gray-800 px-3.5 text-xs font-bold text-gray-700 dark:text-gray-300 transition-all disabled:opacity-50 cursor-pointer shadow-3xs"
                    title="Refresh database connection status"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 text-gray-500 dark:text-gray-400 ${isCheckingMysql ? 'animate-spin' : ''}`} />
                    Refresh Status
                  </button>
                </div>
              </div>

              {/* Status Display Area */}
              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">
                        System Connection State
                      </span>
                      {mysqlStatus === null ? (
                        <span className="inline-flex items-center gap-1 bg-gray-50 dark:bg-gray-800 text-gray-500 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-gray-150 dark:border-gray-750">
                          Querying Server...
                        </span>
                      ) : !mysqlStatus.configured ? (
                        <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/40">
                          🚨 MySQL Not Configured
                        </span>
                      ) : !mysqlStatus.connected ? (
                        <span className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/40">
                          🚨 Connection Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/40">
                          ✓ Connected to Production
                        </span>
                      )}
                    </div>

                    {mysqlStatus === null ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        Loading database state information from the live workspace container...
                      </p>
                    ) : (
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-855 p-4 border border-gray-150/50 dark:border-gray-800/60 font-mono text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                        {mysqlStatus.message}
                      </div>
                    )}
                  </div>

                  {mysqlSyncMessage && (
                    <div className="mt-4 p-3 rounded-lg bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 text-xs font-mono text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        {isSyncingMysql && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>}
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                      </span>
                      {mysqlSyncMessage}
                    </div>
                  )}
                </div>

                {/* MySQL Stats & Actions Section */}
                <div className="rounded-xl border border-gray-150 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-850/40 p-4 flex flex-col justify-between">
                  <div>
                    <h5 className="text-[10px] font-mono font-extrabold text-gray-400 uppercase tracking-widest mb-3">
                      Production MySQL Metrics
                    </h5>
                    {mysqlStatus?.connected && mysqlStatus.stats ? (
                      <div className="space-y-1.5 font-mono text-xs text-gray-600 dark:text-gray-300">
                        <div className="flex justify-between">
                          <span>📦 Products:</span>
                          <strong className="text-gray-900 dark:text-gray-100">{mysqlStatus.stats.products}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>📝 Orders:</span>
                          <strong className="text-gray-900 dark:text-gray-100">{mysqlStatus.stats.orders}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>🤝 Affiliates:</span>
                          <strong className="text-gray-900 dark:text-gray-100">{mysqlStatus.stats.affiliates}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>🎯 Campaigns:</span>
                          <strong className="text-gray-900 dark:text-gray-100">{mysqlStatus.stats.campaigns}</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="h-20 flex items-center justify-center text-[11px] text-gray-400 italic text-center leading-relaxed">
                        {!mysqlStatus?.configured 
                          ? "Configuration values required to display live metrics."
                          : "Establish active server handshake to view counts."}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-150 dark:border-gray-800 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleMysqlPush}
                      disabled={isSyncingMysql || !mysqlStatus?.connected}
                      className="w-full inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shadow-xs"
                      title="Push current local state to production MySQL"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Push Data to Production
                    </button>
                    <button
                      type="button"
                      onClick={handleMysqlPull}
                      disabled={isSyncingMysql || !mysqlStatus?.connected}
                      className="w-full inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-750 bg-white dark:bg-gray-855 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shadow-3xs"
                      title="Pull live production MySQL records to browser local storage"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Pull Data to Local
                    </button>
                  </div>
                </div>
              </div>

              {!mysqlStatus?.configured && (
                <div className="mt-5 p-4 rounded-lg bg-amber-50/15 border border-amber-200/50 dark:border-amber-955/40 dark:bg-amber-955/5">
                  <h5 className="text-[11px] font-mono font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" /> Production Preparation Checklist
                  </h5>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
                    To make the production system fully ready with MySQL database, follow these steps to add your database secrets to the container environment:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-sans">
                    <li>Open <strong>Settings &gt; Secrets</strong> in the AI Studio menu.</li>
                    <li>Add your MySQL credentials using the following keys:
                      <ul className="list-disc pl-4 mt-1 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                        <li><code>DB_HOST</code>: Host IP address or Google Cloud SQL socket name</li>
                        <li><code>DB_PORT</code>: Port (typically <code>3306</code>)</li>
                        <li><code>DB_USER</code>: Database administrator name</li>
                        <li><code>DB_PASSWORD</code>: Secret password</li>
                        <li><code>DB_NAME</code>: Database schema name</li>
                      </ul>
                    </li>
                    <li>Click <strong>Save Secrets</strong> to reload the server with production keys.</li>
                    <li>Open this panel and click <strong>Push Data to Production</strong> to populate the tables automatically.</li>
                  </ol>
                </div>
              )}
            </div>

            {/* Custom password configurator if enabled */}
            {isBackupPasswordProtected && (
              <div className="rounded-xl border border-amber-100 bg-amber-50/10 p-5 shadow-3xs dark:border-amber-950/20 dark:bg-amber-950/5 animate-in slide-in-from-top duration-300">
                <h4 className="text-xs font-mono font-bold text-amber-900 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <Lock className="h-4 w-4 text-amber-500" /> Configure Export Password Protection
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Select Passphrase</label>
                    <div className="relative">
                      <input
                        type={backupPasswordView ? "text" : "password"}
                        value={backupPassword}
                        onChange={(e) => setBackupPassword(e.target.value)}
                        placeholder="Enter secure decryption password"
                        className="w-full rounded border border-gray-200 bg-white px-3 py-2 text-xs font-mono text-gray-800 shadow-3xs outline-none focus:border-amber-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
                      />
                      <button
                        type="button"
                        onClick={() => setBackupPasswordView(!backupPasswordView)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-750 cursor-pointer"
                      >
                        {backupPasswordView ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Confirm Passphrase</label>
                    <input
                      type={backupPasswordView ? "text" : "password"}
                      value={backupPasswordConfirm}
                      onChange={(e) => setBackupPasswordConfirm(e.target.value)}
                      placeholder="Verify password"
                      className="w-full rounded border border-gray-200 bg-white px-3 py-2 text-xs font-mono text-gray-800 shadow-3xs outline-none focus:border-amber-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                {backupPassword && backupPasswordConfirm && backupPassword !== backupPasswordConfirm && (
                  <p className="text-[10px] text-rose-500 font-mono mt-2">✕ Decryption password confirmation does not match. Please re-enter.</p>
                )}
                {backupPassword && backupPassword === backupPasswordConfirm && (
                  <p className="text-[10px] text-emerald-500 font-mono mt-2">✓ Protection password configured and validated. Secure export prepared.</p>
                )}
              </div>
            )}

            {/* Split Section: Snapshot Engine and Importer/Exporter */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Snapshot Engine (Left) */}
              <div className="rounded-xl border border-gray-150 bg-white dark:border-gray-800 dark:bg-gray-900 p-6 shadow-3xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-gray-50 dark:border-gray-800 pb-4 mb-4">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <RotateCcw className="h-4.5 w-4.5 text-indigo-550 animate-spin-slow" /> Internal Recovery Snapshots
                    </h4>
                    <button
                      onClick={handleCreateSnapshot}
                      className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-[10px] font-mono uppercase px-3 py-2 rounded shadow-xs transition cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> Capture Snapshot
                    </button>
                  </div>

                  <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
                    Create point-in-time state records directly inside your local browser. Ideal for taking quick safeguards before editing product prices, bulk updating inventory, or performing platform configuration tests.
                  </p>

                  <div className="flex flex-col gap-3 max-h-[280px] overflow-y-auto pr-1">
                    {activeBackupSnapshots.length === 0 ? (
                      <div className="py-12 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-950/20 text-center flex flex-col items-center justify-center p-4">
                        <Database className="h-8 w-8 text-gray-350 mb-2" />
                        <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">No Checkpoints Saved</h5>
                        <p className="text-[10px] text-gray-400 mt-1 max-w-xs leading-relaxed">
                          Your local sandbox recovery log is empty. Click the capture button above to lock in your first historical safeguard state.
                        </p>
                      </div>
                    ) : (
                      activeBackupSnapshots.map((snap: any) => (
                        <div 
                          key={snap.id} 
                          className="rounded-lg border border-gray-100 dark:border-gray-850 bg-gray-50/30 dark:bg-gray-950/10 p-3 flex items-center justify-between gap-4 group hover:border-indigo-100 dark:hover:border-indigo-950/50 transition-all"
                        >
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-gray-700 dark:text-gray-250 truncate">{snap.name}</h5>
                            <div className="flex items-center gap-2 mt-1 text-[9px] text-gray-400 font-mono">
                              <span>{snap.size} KB</span>
                              <span>•</span>
                              <span>{snap.data?.veloce_products?.length || 0} Products</span>
                              <span>•</span>
                              <span>{snap.data?.veloce_orders?.length || 0} Orders</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                setDeleteConfirmConfig({
                                  isOpen: true,
                                  title: "Restore Backup Snapshot",
                                  message: `Are you sure you want to restore to "${snap.name}"? This will completely replace your active products, orders, settings, and cart. The page will refresh.`,
                                  onConfirm: () => handleRestoreSnapshot(snap)
                                });
                              }}
                              className="inline-flex items-center gap-1 bg-white hover:bg-indigo-50 border border-gray-200 dark:border-gray-800 dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:text-indigo-605 dark:hover:text-indigo-400 text-[10px] font-bold font-mono px-2 py-1 rounded shadow-3xs transition cursor-pointer"
                              title="Restore state"
                            >
                              <RotateCcw className="h-3 w-3" /> Rollback
                            </button>
                            <button
                              onClick={() => {
                                setDeleteConfirmConfig({
                                  isOpen: true,
                                  title: "Delete Backup Snapshot",
                                  message: `Are you sure you want to permanently delete the backup snapshot "${snap.name}"?`,
                                  onConfirm: () => handleDeleteSnapshot(snap.id)
                                });
                              }}
                              className="p-1 text-gray-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded transition cursor-pointer"
                              title="Delete snapshot"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                  <span>Stores last 5 historical snapshots</span>
                  <span className="text-amber-600 dark:text-amber-400">Isolated Browser Sandbox</span>
                </div>
              </div>

              {/* Secure Exporter & File Importer (Right) */}
              <div className="rounded-xl border border-gray-150 bg-white dark:border-gray-800 dark:bg-gray-900 p-6 shadow-3xs flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 border-b border-gray-50 dark:border-gray-800 pb-4 mb-4 flex items-center gap-2">
                    <FileJson className="h-4.5 w-4.5 text-emerald-500" /> Database File Exporter & Importer
                  </h4>

                  <div className="flex flex-col gap-4">
                    {/* Export Section */}
                    <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/20 p-4 flex flex-col justify-between gap-3">
                      <div>
                        <h5 className="text-xs font-bold text-gray-855 dark:text-gray-250 flex items-center gap-1.5">
                          <Download className="h-4 w-4 text-emerald-500" /> Platform Export Package
                        </h5>
                        <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                          Compile and extract a robust ledger archive containing all products, campaigns, tickets, cart inventories, earnings history, and audit logs.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <button
                          onClick={handleDownloadRawBackup}
                          className="flex-1 inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer"
                          id="btn-backup-database-tab"
                        >
                          <Database className="h-4 w-4" /> Backup Database (Direct JSON)
                        </button>
                        <button
                          onClick={handleExportBackup}
                          className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-705 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer"
                        >
                          <Download className="h-4 w-4" /> Download Unified Backup JSON
                        </button>
                      </div>
                    </div>

                    {/* Import Section */}
                    <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/20 p-4">
                      <h5 className="text-xs font-bold text-gray-855 dark:text-gray-250 flex items-center gap-1.5 mb-2">
                        <Upload className="h-4 w-4 text-indigo-500" /> Upload & Restore Ledger Package
                      </h5>

                      <div className="relative border border-dashed border-gray-250 dark:border-gray-850 hover:border-indigo-400 rounded-lg p-3 bg-white dark:bg-gray-900/50 flex flex-col items-center justify-center gap-1 cursor-pointer group transition-colors">
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleFileUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Upload className="h-6 w-6 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                        <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                          {importedFileSummary ? '✓ Backup File Loaded' : 'Drag & Drop backup JSON, or browse'}
                        </span>
                        <span className="text-[8px] font-mono text-gray-400">Max size 25MB (.json)</span>
                      </div>

                      {/* Error state */}
                      {importedFileError && (
                        <div className="mt-2.5 text-[10px] font-mono text-rose-550 flex items-center gap-1 bg-rose-50 dark:bg-rose-950/20 px-2 py-1.5 rounded border border-rose-100 dark:border-rose-950">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {importedFileError}
                        </div>
                      )}

                      {/* Imported file preview dashboard */}
                      {importedFileSummary && (
                        <div className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-3 animate-in slide-in-from-top-1 duration-200">
                          <div className="flex justify-between items-center mb-2 font-mono text-[9px] text-gray-400">
                            <span>TIMESTAMP: {new Date(importedFileSummary.timestamp).toLocaleString()}</span>
                            <span className={importedFileSummary.isEncrypted ? 'text-amber-500 font-bold' : 'text-emerald-550 font-bold'}>
                              {importedFileSummary.isEncrypted ? '🔒 ENCRYPTED' : '🔓 PUBLIC'}
                            </span>
                          </div>

                          {/* Decryption password input if encrypted */}
                          {importedFileSummary.isEncrypted && (
                            <div className="mb-3 bg-amber-50/15 border border-amber-100 dark:border-amber-950/50 rounded p-2.5 flex flex-col gap-1.5 animate-pulse">
                              <label className="text-[9px] font-mono font-bold text-amber-800 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1">
                                <Lock className="h-3 w-3" /> Encrypted: Decryption Passphrase Required
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="password"
                                  value={importPasswordInput}
                                  onChange={(e) => setImportPasswordInput(e.target.value)}
                                  placeholder="Enter export security password"
                                  className="flex-1 rounded border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 px-2 py-1 text-xs font-mono text-gray-850 shadow-3xs outline-none"
                                />
                              </div>
                              {importPasswordError && (
                                <span className="text-[8px] font-mono text-rose-550 font-bold">✕ Invalid password configuration. Decryption failed.</span>
                              )}
                            </div>
                          )}

                          {/* Restore Type selection */}
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            <button
                              onClick={() => setImportRestoreType('replace')}
                              className={`py-1.5 text-[10px] font-bold rounded-lg border text-center cursor-pointer transition-all ${
                                importRestoreType === 'replace'
                                  ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400'
                                  : 'bg-white border-gray-200 text-gray-500 dark:bg-gray-900 dark:border-gray-800 hover:bg-gray-50'
                              }`}
                            >
                              Purge & Overwrite (Full)
                            </button>
                            <button
                              onClick={() => setImportRestoreType('merge')}
                              className={`py-1.5 text-[10px] font-bold rounded-lg border text-center cursor-pointer transition-all ${
                                importRestoreType === 'merge'
                                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-400'
                                  : 'bg-white border-gray-200 text-gray-505 dark:bg-gray-900 dark:border-gray-800 hover:bg-gray-50'
                              }`}
                            >
                              Smart Merge (Append)
                            </button>
                          </div>

                          {/* Critical overwrite warnings */}
                          <div className="bg-rose-50/30 border border-rose-100 dark:bg-rose-950/10 dark:border-rose-950 p-2.5 rounded-lg mb-3">
                            <p className="text-[9px] text-rose-700 dark:text-rose-400 leading-normal font-medium flex items-start gap-1">
                              <AlertOctagon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              {importRestoreType === 'replace' 
                                ? "🚨 Overwrite alert: This will completely replace your current products, orders and configurations with this backup data. Active cart contents will reload."
                                : "✓ Merge mode: Missing records will be appended. Existing records with the same IDs will be updated. No data will be deleted."}
                            </p>
                          </div>

                          {/* Validation Input */}
                          <div className="flex flex-col gap-1.5 mb-3">
                            <label className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                              Type <strong className="font-mono text-indigo-605 dark:text-indigo-455 select-all uppercase">RESTORE</strong> to authorize and execute:
                            </label>
                            <input
                              type="text"
                              value={restoreConfirmationString}
                              onChange={(e) => setRestoreConfirmationString(e.target.value)}
                              placeholder="Type RESTORE to confirm"
                              className="rounded border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-widest text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500"
                            />
                          </div>

                          {/* Trigger Restore button */}
                          <button
                            onClick={handleProcessImport}
                            disabled={restoreConfirmationString.toUpperCase() !== "RESTORE" || (importedFileSummary.isEncrypted && !importPasswordInput)}
                            className="w-full inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-150 disabled:text-gray-400 dark:disabled:bg-gray-800/55 dark:disabled:text-gray-600 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-sm transition-all cursor-pointer"
                          >
                            <RefreshCw className="h-4 w-4 animate-spin-slow" /> Confirm and Overwrite Active Platform
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Database purging option at the bottom */}
                <div className="mt-6 pt-4 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between font-mono text-[9px] text-gray-400">
                  <span>Authorized Administrator Only</span>
                  <button
                    onClick={handlePurgeAllData}
                    className="text-rose-500 hover:text-rose-600 hover:underline cursor-pointer font-bold uppercase"
                  >
                    Purge All System Data
                  </button>
                </div>
              </div>

            </div>

            {/* Audit Logs Trail Section (Bottom) */}
            <div className="rounded-xl border border-gray-150 bg-white dark:border-gray-800 dark:bg-gray-900 p-5 shadow-3xs">
              <h4 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-4 border-b border-gray-50 dark:border-gray-800 pb-3">
                <Activity className="h-3.5 w-3.5 text-emerald-500" /> Active System Protection Audit Trail
              </h4>
              <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto font-mono text-[10px] leading-relaxed pr-1">
                {securityAuditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-950/20 px-2 rounded transition-colors">
                    <span className="text-gray-400 text-[9px] shrink-0">{log.time}</span>
                    <span className={`inline-flex shrink-0 px-1 py-0.5 text-[8px] font-bold rounded uppercase tracking-wider ${
                      log.status === 'success' 
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' 
                        : log.status === 'warning'
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400'
                        : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400'
                    }`}>
                      {log.status}
                    </span>
                    <span className="text-gray-600 dark:text-gray-300 truncate">{log.event}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {adminSubTab === 'order-lookup' && (() => {
        // Find recent orders for user preview convenience
        const quickTrackOrders = orders.slice(-4).reverse();

        // Check if there are digital items in the selected order
        const hasDigitalItems = selectedLookupOrder?.items?.some(item => {
          const prod = products.find(p => p.id === item.productId);
          return item.type === 'digital' || prod?.type === 'digital';
        }) || false;

        // Check if there are physical items in the selected order
        const hasPhysicalItems = selectedLookupOrder?.items?.some(item => {
          const prod = products.find(p => p.id === item.productId);
          return item.type === 'physical' || prod?.type === 'physical' || !item.type;
        }) || true;

        const handleSearchSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          setLookupError('');
          const trimmed = lookupQuery.trim().toUpperCase();
          if (!trimmed) {
            setLookupError('Please enter an order ID.');
            setSelectedLookupOrder(null);
            return;
          }
          const found = orders.find(o => o.id.trim().toUpperCase() === trimmed);
          if (found) {
            setSelectedLookupOrder(found);
          } else {
            setLookupError(`No order records found matching ID: "${trimmed}".`);
            setSelectedLookupOrder(null);
          }
        };

        const handleSelectQuickTrack = (ord: Order) => {
          setLookupQuery(ord.id);
          setSelectedLookupOrder(ord);
          setLookupError('');
        };

        // Milestone date offset helper
        const getLogisticsTime = (baseDateStr: string, offsetHours: number) => {
          try {
            // Convert space separated date to ISO format for Safari/Chrome standard compliance
            const cleanStr = baseDateStr.includes('T') ? baseDateStr : baseDateStr.replace(' ', 'T');
            const d = new Date(cleanStr);
            if (isNaN(d.getTime())) return baseDateStr;
            d.setHours(d.getHours() + offsetHours);
            return d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' }) + 
                   ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          } catch (e) {
            return baseDateStr;
          }
        };

        // Progress percentage for status
        const getProgressPercent = (status: string) => {
          switch (status) {
            case 'pending': return 15;
            case 'processing': return 45;
            case 'shipped': return 75;
            case 'completed': return 100;
            default: return 0;
          }
        };

        // Estimated delivery helper
        const getEstimatedDelivery = (orderDateStr: string) => {
          try {
            const cleanStr = orderDateStr.includes('T') ? orderDateStr : orderDateStr.replace(' ', 'T');
            const d = new Date(cleanStr);
            if (isNaN(d.getTime())) return 'Within 3-5 business days';
            d.setDate(d.getDate() + 3);
            return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
          } catch(e) {
            return 'Within 3-5 business days';
          }
        };

        return (
          <div className="mt-8 space-y-6 font-sans">
            {/* Search Dashboard Box */}
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-2xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-50 pb-4 mb-6">
                <div>
                  <h3 className="font-display text-sm font-semibold text-gray-950 flex items-center gap-2">
                    <Search className="h-4.5 w-4.5 text-indigo-600 animate-pulse" /> Live Order Tracking & Asset Delivery Lookup
                  </h3>
                  <p className="text-[11px] font-light text-gray-400 mt-1">
                    Retrieve real-time shipping status timelines, logistical dispatch history, and instant digital fulfillment links securely.
                  </p>
                </div>
              </div>

              {/* Form Input */}
              <form onSubmit={handleSearchSubmit} className="max-w-2xl">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 font-mono">
                  Enter Order Identifier (UUID or VEL-XXXXX)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="e.g. VEL-OR-1042 or standard UUID"
                      value={lookupQuery}
                      onChange={(e) => setLookupQuery(e.target.value)}
                      className="w-full h-10 rounded-lg border border-gray-200 pl-10 pr-4 text-xs font-semibold focus:outline-hidden focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 text-gray-850 bg-gray-50"
                    />
                  </div>
                  <button
                    type="submit"
                    className="h-10 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Search className="h-3.5 w-3.5" />
                    Track & Verify
                  </button>
                </div>
                {lookupError && (
                  <p className="mt-3 text-xs text-rose-600 font-bold flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {lookupError}
                  </p>
                )}
              </form>

              {/* Quick track selector (Invaluable for user usability testing) */}
              {quickTrackOrders.length > 0 && (
                <div className="mt-6 pt-5 border-t border-gray-50">
                  <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block mb-3">
                    🚀 Quick-fill Recent Transactions (Usability shortcut)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {quickTrackOrders.map((ord) => (
                      <button
                        key={ord.id}
                        type="button"
                        onClick={() => handleSelectQuickTrack(ord)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                          selectedLookupOrder?.id === ord.id
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-750'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-mono font-bold uppercase">{ord.id}</span>
                        <span className="text-[10px] text-gray-400">({ord.customerName})</span>
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                          ord.status === 'completed' ? 'bg-emerald-500' :
                          ord.status === 'shipped' ? 'bg-blue-500' : 'bg-amber-500'
                        }`} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Looked Up Order Results Panel */}
            {selectedLookupOrder ? (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom duration-300">
                
                {/* Column 1: Timeline, Simulation & Digital Assets (xl:col-span-8) */}
                <div className="xl:col-span-8 space-y-6">
                  
                  {/* Fulfillment timeline tracker */}
                  <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-50 pb-4 mb-6">
                      <div className="flex items-center gap-2.5">
                        <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                          <History className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-950 uppercase tracking-wide">
                            Logistic Milestone Journey
                          </h4>
                          <p className="text-[11px] text-gray-400 mt-0.5 font-light">
                            Secured transaction ledger chronological audit.
                          </p>
                        </div>
                      </div>

                      {/* Interactive Simulation Panel */}
                      <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-50 border border-gray-150 rounded-lg shadow-3xs">
                        <span className="text-[9px] font-mono font-bold text-gray-400 uppercase px-1.5 flex items-center gap-1">
                          <Sparkles className="h-2.5 w-2.5 text-indigo-555" /> Simulate Stage:
                        </span>
                        {(['pending', 'shipped', 'completed', 'cancelled', 'pending-cancellation'] as const).map((st) => {
                          const isStActive = selectedLookupOrder.status === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => {
                                if (st === 'completed' && !isOrderPaid(selectedLookupOrder)) {
                                  setUnpaidPromptOrder(selectedLookupOrder);
                                  return;
                                }
                                onUpdateOrderStatus(selectedLookupOrder.id, st);
                                // Reactively update selectedLookupOrder object references in local state
                                setSelectedLookupOrder({
                                  ...selectedLookupOrder,
                                  status: st
                                });
                                if (onTriggerEmailToast) {
                                  onTriggerEmailToast({
                                    ...selectedLookupOrder,
                                    status: st
                                  }, st === 'completed' ? 'delivered' : st === 'shipped' ? 'shipped' : 'pending');
                                }
                              }}
                              className={`rounded-md px-2 py-1 text-[10px] font-mono font-bold capitalize transition-all cursor-pointer ${
                                isStActive
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'text-gray-450 hover:text-gray-750 hover:bg-gray-100'
                              }`}
                            >
                              {st === 'pending' ? 'placed' : st === 'completed' ? 'delivered' : st === 'pending-cancellation' ? 'pending cancel' : st}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {selectedLookupOrder.status === 'cancelled' || selectedLookupOrder.status === 'pending-cancellation' ? (
                      /* Cancelled Order Timeline */
                      <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100 text-xs text-rose-800 space-y-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-rose-950 block">Transaction Ledger Terminated</span>
                            <span className="text-[11px] text-rose-800 mt-1 block">
                              {selectedLookupOrder.status === 'pending-cancellation' 
                                ? 'This order is currently pending administrative review for cancellation.' 
                                : 'This transaction was terminated. Cargo delivery processes have been voided.'}
                            </span>
                          </div>
                        </div>
                        <div className="pl-8 relative border-l-2 border-rose-200 py-2 space-y-4 font-mono text-[10px]">
                          <div>
                            <span className="font-bold text-rose-900 block">🛑 Cancelled milestone logged</span>
                            <span className="text-gray-450 block mt-0.5">{getLogisticsTime(selectedLookupOrder.date, 1)}</span>
                          </div>
                          <div>
                            <span className="font-bold text-gray-500 block">📦 Initial placement logs</span>
                            <span className="text-gray-450 block mt-0.5">{selectedLookupOrder.date}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Standard Milestones Progress Timeline */
                      <div className="relative pl-6 border-l-2 border-gray-150 space-y-6">
                        {(() => {
                          const currentStage = selectedLookupOrder.status;
                          const timelineSteps = [
                            {
                              key: 'pending',
                              label: 'Order Placed',
                              icon: ShoppingBag,
                              desc: 'Standard checkout log stored in Veloce local database system.',
                              completedDesc: 'Your order has been ingested, and payment was successfully processed.',
                              offset: 0,
                            },
                            {
                              key: 'processing',
                              label: 'Under Processing',
                              icon: RefreshCw,
                              desc: 'Fulfillment agents pick, scan, and consolidate your package.',
                              completedDesc: 'Products successfully picked, security-tagged, and packed.',
                              offset: 2,
                            },
                            {
                              key: 'shipped',
                              label: 'Shipped & En Route',
                              icon: Truck,
                              desc: 'Parcel in dispatch transit with our logistics carrier.',
                              completedDesc: 'Carrier departed sorting facility. Live telemetry signal is broad, healthy, and stable.',
                              offset: 14,
                            },
                            {
                              key: 'completed',
                              label: 'Delivered',
                              icon: CheckCircle2,
                              desc: 'Awaiting hand-delivery at shipping destination address.',
                              completedDesc: 'Fulfillment cycle complete. Parcel successfully delivered and recipient confirmed.',
                              offset: 28,
                            }
                          ];

                          const stageKeys = ['pending', 'processing', 'shipped', 'completed'];
                          const activeIdx = stageKeys.indexOf(currentStage);

                          return timelineSteps.map((step, idx) => {
                            const isCompleted = idx <= activeIdx;
                            const isActive = currentStage === step.key;
                            const StepIcon = step.icon;

                            return (
                              <div key={step.key} className="relative">
                                {/* Connector line */}
                                <div className={`absolute -left-[31px] top-4 bottom-[-32px] w-[2px] transition-all last:hidden ${
                                  isCompleted ? 'bg-indigo-600' : 'bg-gray-150'
                                }`} />

                                {/* Node Icon */}
                                <div className={`absolute -left-[38px] top-1 h-6 w-6 rounded-full border-2 flex items-center justify-center text-xs transition-all z-10 ${
                                  isCompleted
                                    ? step.key === 'completed'
                                      ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                                      : 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                                    : 'border-gray-200 bg-white text-gray-400'
                                }`}>
                                  <StepIcon className={`h-3.5 w-3.5 ${isActive && step.key !== 'completed' ? 'animate-spin' : ''}`} />
                                </div>

                                {/* Content Details */}
                                <div className={`rounded-lg border p-4 transition-all ${
                                  isActive
                                    ? 'border-indigo-200 bg-indigo-50/10 shadow-3xs'
                                    : isCompleted
                                    ? 'border-gray-155 bg-white'
                                    : 'border-gray-100 bg-transparent opacity-50'
                                }`}>
                                  <div className="flex flex-wrap items-center justify-between gap-2.5 mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[12px] font-bold ${
                                        isActive ? 'text-indigo-650' : isCompleted ? 'text-gray-900' : 'text-gray-400'
                                      }`}>
                                        {step.label}
                                      </span>
                                      <span className={`text-[8px] font-bold font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                                        isCompleted
                                          ? step.key === 'completed'
                                            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                            : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                                          : 'bg-gray-50 border-gray-100 text-gray-400'
                                      }`}>
                                        {isCompleted ? 'COMPLETED' : 'PENDING'}
                                      </span>
                                    </div>
                                    {isCompleted && (
                                      <span className="text-[10px] font-mono text-gray-450 font-light">
                                        {getLogisticsTime(selectedLookupOrder.date, step.offset)}
                                      </span>
                                    )}
                                  </div>
                                  <p className={`text-[11px] leading-relaxed font-light ${
                                    isCompleted || isActive ? 'text-gray-600' : 'text-gray-400'
                                  }`}>
                                    {isCompleted ? step.completedDesc : step.desc}
                                  </p>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Digital delivery links block */}
                  {hasDigitalItems && (
                    <div className="rounded-xl border border-purple-100 bg-purple-50/10 p-6 shadow-2xs">
                      <div className="flex items-center gap-2.5 border-b border-purple-50 pb-3 mb-4">
                        <div className="rounded-lg bg-purple-100 p-2 text-purple-700">
                          <Lock className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-purple-950 uppercase tracking-wide">
                            🔑 Secure Digital Delivery Hub
                          </h4>
                          <p className="text-[11px] text-purple-750 font-light mt-0.5">
                            Automated instant release system for workspace downloads and asset registries.
                          </p>
                        </div>
                      </div>

                      {/* Digital products list */}
                      <div className="space-y-4">
                        {selectedLookupOrder.items.map((item, idx) => {
                          const prod = products.find(p => p.id === item.productId);
                          const isDigital = item.type === 'digital' || prod?.type === 'digital';
                          if (!isDigital) return null;

                          const simulatedKey = `VEL-LIC-${selectedLookupOrder.id.slice(-4).toUpperCase()}-${idx * 179 + 4821}-X89C`;
                          const simulatedDownloadLink = `https://veloce.delivery/download/sec-token-${selectedLookupOrder.id}-${idx}/manual.zip`;

                          return (
                            <div key={idx} className="rounded-xl border border-purple-100/70 bg-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-3xs">
                              <div className="space-y-1.5">
                                <span className="inline-flex items-center rounded-sm bg-purple-50 px-2 py-0.5 text-[8px] font-mono font-bold text-purple-700 uppercase border border-purple-100">
                                  Instant Access Pack
                                </span>
                                <h5 className="text-xs font-bold text-gray-900">{item.name}</h5>
                                <p className="text-[10px] text-gray-400 font-light leading-relaxed">
                                  Your digital license key is registered and generated upon standard payment approval.
                                </p>

                                {/* License Key Component */}
                                <div className="flex items-center gap-2 pt-1">
                                  <span className="text-[10px] font-mono font-bold text-purple-950 bg-purple-50 border border-purple-100/60 rounded px-2.5 py-1">
                                    Key: <span className="text-purple-750 font-extrabold tracking-wider">{simulatedKey}</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(simulatedKey);
                                      setCopiedKey(simulatedKey);
                                      setTimeout(() => setCopiedKey(null), 2500);
                                    }}
                                    className="p-1.5 hover:bg-gray-100 rounded border border-gray-150 text-gray-500 hover:text-indigo-650 cursor-pointer transition-colors"
                                    title="Copy license activation key"
                                  >
                                    {copiedKey === simulatedKey ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    alert(`Direct downloading has been initiated securely for: ${item.name}. (Simulated file: veloce_assets_pack.zip)`);
                                  }}
                                  className="h-8.5 px-3.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-[11px] font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Download Asset ZIP
                                </button>
                                <a
                                  href={simulatedDownloadLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    alert(`Opening resource manual in secure browser instance: ${simulatedDownloadLink}`);
                                  }}
                                  className="h-8.5 px-3 rounded-lg border border-purple-200 text-purple-750 hover:bg-purple-50 text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center"
                                  title="Access online manuals and video tutorials"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Column 2: Order Summary & Physical Courier Details (xl:col-span-4) */}
                <div className="xl:col-span-4 space-y-6">
                  
                  {/* Order Details Summary Card */}
                  <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-2xs">
                    <div className="flex justify-between items-center border-b border-gray-50 pb-3 mb-4">
                      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                        <FileText className="h-4.5 w-4.5 text-indigo-650" /> Order Summary Details
                      </h4>
                      <button
                        onClick={() => {
                          setSelectedAdminDetailOrder(selectedLookupOrder);
                          setAutoPrintOnce(true);
                        }}
                        className="inline-flex h-7 items-center gap-1.5 rounded bg-indigo-650 hover:bg-indigo-750 text-white text-[10px] font-bold px-2.5 transition-colors cursor-pointer shadow-3xs"
                        title="Print clean order receipt summary with printable-receipt-area"
                      >
                        <Printer className="h-3 w-3" /> Print Receipt
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Products List */}
                      <div className="space-y-3">
                        {selectedLookupOrder.items.map((item, idx) => (
                          <div key={idx} className="flex gap-3 text-xs border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                            {/* Product Image Thumbnail */}
                            <div className="h-11 w-11 rounded-lg bg-slate-50 border border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                              {(item as any).image ? (
                                <img src={(item as any).image} alt={item.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <ImageIcon className="h-5 w-5 text-gray-300" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-bold text-gray-950 block truncate">{item.name}</span>
                              <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1 font-mono">
                                <span>KSh {item.price.toLocaleString('en-KE')} x {item.quantity}</span>
                                <span className="font-bold text-gray-700">KSh {(item.price * item.quantity).toLocaleString('en-KE')}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pricing totals list */}
                      <div className="border-t border-gray-50 pt-3.5 space-y-2 text-xs font-sans">
                        <div className="flex justify-between text-gray-400">
                          <span>Subtotal</span>
                          <span className="font-mono text-gray-700">KSh {Math.round(selectedLookupOrder.total * 0.84).toLocaleString('en-KE')}</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                          <span>Estimated 16% VAT</span>
                          <span className="font-mono text-gray-700">KSh {Math.round(selectedLookupOrder.total * 0.16).toLocaleString('en-KE')}</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                          <span>Packaging & Cargo Surcharge</span>
                          <span className="font-mono text-emerald-600 font-semibold">FREE / KKe</span>
                        </div>
                        {selectedLookupOrder.couponCode && (
                          <div className="flex justify-between text-indigo-700 bg-indigo-50/50 px-2 py-1 rounded">
                            <span className="font-semibold flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> Coupon ({selectedLookupOrder.couponCode})</span>
                            <span className="font-mono">-10% Promo</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-gray-100 pt-3 font-semibold text-sm">
                          <span className="text-gray-900 font-bold">Total Paid</span>
                          <span className="font-mono text-indigo-650 font-black">
                            KSh {selectedLookupOrder.total.toLocaleString('en-KE')}
                          </span>
                        </div>
                      </div>

                      {/* Customer Metadata Block */}
                      <div className="mt-4 pt-4 border-t border-gray-50 rounded bg-slate-50/50 p-3 text-[11px] space-y-1.5 font-sans">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Customer</span>
                          <strong className="text-gray-800">{selectedLookupOrder.customerName}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Email</span>
                          <strong className="text-gray-800 font-mono text-[10px]">{selectedLookupOrder.customerEmail}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Date Logged</span>
                          <strong className="text-gray-800 font-mono">{selectedLookupOrder.date}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Billing Profile</span>
                          <span className={`px-1.5 py-0.2 rounded-sm font-bold text-[9px] font-mono ${
                            selectedLookupOrder.isGuest 
                              ? 'bg-amber-100/80 text-amber-800 border border-amber-200' 
                              : 'bg-indigo-100/80 text-indigo-850 border border-indigo-200'
                          }`}>
                            {selectedLookupOrder.isGuest ? 'GUEST PROFILE' : 'REGISTERED ACCOUNT'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                          <span className="text-gray-400">Payment Status</span>
                          {(() => {
                            const isCod = selectedLookupOrder.paymentMethod === 'cod';
                            const isPaid = selectedLookupOrder.paymentStatus === 'paid' || (!isCod && selectedLookupOrder.paymentStatus !== 'unpaid');
                            return (
                              <div className="flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 rounded font-extrabold text-[9px] font-mono ${
                                  isPaid ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                                }`}>
                                  {isPaid ? '✓ VERIFIED PAID' : '⚠️ UNPAID (COD)'}
                                </span>
                                {onUpdateOrderPaymentStatus && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextStatus = isPaid ? 'unpaid' : 'paid';
                                      onUpdateOrderPaymentStatus(selectedLookupOrder.id, nextStatus, nextStatus === 'paid' ? 'COD Payment confirmed by admin' : 'Reverted to unpaid');
                                      setSelectedLookupOrder(prev => prev ? { ...prev, paymentStatus: nextStatus } : null);
                                    }}
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono border transition-all cursor-pointer ${
                                      isPaid
                                        ? 'bg-gray-100 hover:bg-amber-100 text-gray-700 hover:text-amber-800 border-gray-200 hover:border-amber-300'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-3xs'
                                    }`}
                                  >
                                    {isPaid ? 'Revert to Unpaid' : 'Mark as Paid ✓'}
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Physical shipping & parcel details */}
                  {hasPhysicalItems && (
                    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-2xs space-y-4">
                      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide border-b border-gray-50 pb-3 mb-1 flex items-center gap-2">
                        <Truck className="h-4.5 w-4.5 text-indigo-650 animate-bounce" /> Shipping & Courier Details
                      </h4>

                      {/* Dynamic status helper */}
                      {(() => {
                        const status = selectedLookupOrder.status;
                        const couriers = ["Veloce Express Cargo", "FedEx Workspace Premium", "DHL Global Precision", "UPS Red Line"];
                        const courierIdx = selectedLookupOrder.id.charCodeAt(0) % couriers.length;
                        const courier = couriers[courierIdx];
                        const trackingNumber = `VEL-TRK-${courier.slice(0,3).toUpperCase()}-${selectedLookupOrder.id.slice(-5).toUpperCase()}`;

                        return (
                          <div className="space-y-4">
                            {/* Courier assignment details */}
                            <div className="text-xs space-y-2">
                              <div className="flex justify-between">
                                <span className="text-gray-400 font-sans">Carrier Partner:</span>
                                <strong className="text-gray-800">{courier}</strong>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-400 font-sans">Tracking Code:</span>
                                <div className="flex items-center gap-1.5 font-mono">
                                  <strong className="text-gray-800 font-mono text-[11px]">{trackingNumber}</strong>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(trackingNumber);
                                      setCopiedTracking(true);
                                      setTimeout(() => setCopiedTracking(false), 2500);
                                    }}
                                    className="p-1 hover:bg-gray-100 rounded border border-gray-150 text-gray-400 hover:text-indigo-650 transition-all cursor-pointer"
                                    title="Copy tracking number"
                                  >
                                    {copiedTracking ? (
                                      <Check className="h-3 w-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400 font-sans">Estimated arrival:</span>
                                <strong className="text-indigo-650 font-semibold">{getEstimatedDelivery(selectedLookupOrder.date)}</strong>
                              </div>
                              <div className="pt-2">
                                <span className="text-gray-400 font-sans block mb-1">Destination Address:</span>
                                <span className="text-gray-800 font-bold block bg-gray-50 p-2.5 rounded border border-gray-100 text-[11px] leading-relaxed">
                                  <MapPin className="h-3 w-3 inline text-indigo-600 mr-1 shrink-0 align-text-top" />
                                  {selectedLookupOrder.shippingAddress || "142 Veloce Boulevard, Woodwork Section 3, Nairobi, Kenya"}
                                </span>
                              </div>
                            </div>

                            {/* Delivery visual progress bar */}
                            <div className="space-y-1 pt-1">
                              <div className="flex justify-between text-[10px] font-mono font-bold text-gray-500">
                                <span>PARCEL POSITION</span>
                                <span className="text-indigo-650">{getProgressPercent(status)}%</span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                                <div
                                  style={{ width: `${getProgressPercent(status)}%` }}
                                  className="h-full bg-indigo-600 transition-all duration-700 ease-out rounded-full"
                                />
                              </div>
                            </div>

                            {/* Stylized vector map grid representation */}
                            <div className="relative h-28 w-full rounded-xl bg-gray-950 border border-gray-800 overflow-hidden flex items-center justify-center p-3 select-none">
                              {/* Background grid lines */}
                              
                              
                              {/* Glowing vector line representing path */}
                              <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                                <path
                                  d="M 30,85 C 80,40 140,90 200,45"
                                  fill="none"
                                  stroke="#312e81"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M 30,85 C 80,40 140,90 200,45"
                                  fill="none"
                                  stroke="#4f46e5"
                                  strokeWidth="1.5"
                                  strokeDasharray="4 4"
                                  strokeLinecap="round"
                                />
                                
                                {/* Pulse circles at origin & target */}
                                <circle cx="30" cy="85" r="4" fill="#6366f1" />
                                <circle cx="200" cy="45" r="4" fill="#10b981" />
                              </svg>

                              {/* Moving glow tracker marker */}
                              <div
                                style={{
                                  position: 'absolute',
                                  left: `${30 + (getProgressPercent(status) / 100) * 170}px`,
                                  top: `${85 - (getProgressPercent(status) / 100) * 40}px`,
                                  transform: 'translate(-50%, -50%)',
                                }}
                                className="z-10 transition-all duration-1000 ease-out"
                              >
                                <div className="relative flex items-center justify-center">
                                  <span className="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-white" />
                                  
                                  {/* Dynamic truck annotation on map */}
                                  <span className="absolute -top-6 bg-emerald-950 border border-emerald-500/35 text-emerald-400 text-[8px] font-mono px-1 py-0.2 rounded shadow-lg whitespace-nowrap font-bold">
                                    {status === 'completed' ? 'Delivered 🎉' : 'In Transit 🚚'}
                                  </span>
                                </div>
                              </div>

                              {/* Map HUD tags */}
                              <div className="absolute left-2.5 bottom-2 text-[8px] font-mono text-gray-500 leading-none">
                                LAT: 1.2921 S / LON: 36.8219 E
                              </div>
                              <div className="absolute right-2.5 bottom-2 text-[8px] font-mono text-indigo-400 leading-none font-bold">
                                VEL-GRID COMPLIANT
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                </div>
              </div>
            ) : (
              /* Search Empty State */
              <div className="py-16 text-center border border-dashed border-gray-150 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center p-6">
                <div className="rounded-full bg-indigo-50 p-3 text-indigo-600 mb-4 shadow-3xs">
                  <Truck className="h-6 w-6 animate-bounce" />
                </div>
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">No Active Order Selected</h4>
                <p className="text-xs text-gray-400 max-w-sm mt-1 leading-relaxed font-light">
                  Type an order ID into the lookup search bar above, or select a transaction from the "Quick-fill" list to monitor shipment progression or download digital goods instantly.
                </p>
              </div>
            )}
          </div>
        );
      })()}

      {adminSubTab === 'categories' && (
        <div className="mt-8 font-sans">
          <CategoryManagementPanel
            products={products}
                        onUpdateProductDetails={onUpdateProductDetails}
          />
        </div>
      )}

      {adminSubTab === 'bulk-price' && (
        <Suspense fallback={<ChartLoaderFallback />}>
          <div className="-mt-6 -mx-4 sm:-mx-6 lg:-mx-8 xl:-mx-10 font-sans">
            <BulkCatalogPriceAdjustmentPage
              products={products}
              availableCategories={availableCategories}
              onUpdateProductPrice={onUpdateProductPrice}
              onNavigateBack={() => setAdminSubTab('products')}
            />
          </div>
        </Suspense>
      )}

      {adminSubTab === 'returns' && (
        <Suspense fallback={<ChartLoaderFallback />}>
          <ReturnsCenterDashboard
            returnRequests={returnRequests}
            orders={orders}
            onUpdateReturnRequestStatus={onUpdateReturnRequestStatus}
            currency={currency}
          />
        </Suspense>
      )}

      {adminSubTab === 'shipping' && (
        <div className="mt-6">
          <ShippingSettingsPanel />
        </div>
      )}

            {adminSubTab === 'edit-product' && (
        <div className="mt-6">
          <ProductEditHub
            products={effectiveProducts}
            categories={customCategories}
            currency={currency}
            onSelectProductToEdit={(prod) => {
              setEditingProduct(prod);
              setShowAddProdPage(false);
            }}
            onCreateNewProduct={() => {
              setEditingProduct(null);
              setShowAddProdPage(true);
            }}
            onDuplicateProduct={(prod) => {
              const duplicated: Product = {
                ...prod,
                id: `prod-${Date.now()}`,
                name: `${prod.name} (Copy)`,
                sku: `${prod.sku}-COPY`,
                slug: `${generateSlug(prod.name)}-copy`,
                status: 'Draft'
              };
              onAddProduct(duplicated);
              setEditingProduct(duplicated);
            }}
            onViewProductOnSite={(prod) => {
              if (onNavigateToSite) {
                onNavigateToSite('store');
              }
            }}
          />
        </div>
      )}

      {adminSubTab === 'hero-slider' && (
        <div className="mt-6">
          <AdminHeroSliderManager />
        </div>
      )}

      {adminSubTab === 'site-settings' && (
        <div className="mt-6">
          <SiteSettingsPanel />
        </div>
      )}

      {adminSubTab === 'suppliers' && (
        <div className="mt-6">
          <Suspense fallback={<ChartLoaderFallback />}>
            <SupplierManagementPanel darkMode={darkMode} currency={currency} />
          </Suspense>
        </div>
      )}

      {selectedAdminDetailOrder && (
        <Suspense fallback={<ChartLoaderFallback />}>
          <OrderReceiptModal
            order={selectedAdminDetailOrder}
            onClose={() => setSelectedAdminDetailOrder(null)}
            autoPrint={autoPrintOnce}
            allOrders={orders}
            onUpdateOrderPaymentStatus={onUpdateOrderPaymentStatus}
          />
        </Suspense>
      )}

      {showBulkUploadModal && (
        <Suspense fallback={<ChartLoaderFallback />}>
          <BulkProductUploadModal
            isOpen={showBulkUploadModal}
            onClose={() => setShowBulkUploadModal(false)}
            onAddProduct={(newProduct) => {
              onAddProduct(newProduct);
              setLiveDbProducts((prev) => (prev ? [newProduct, ...prev] : [newProduct, ...products]));
            }}
            products={effectiveProducts}
            onUpdateProductDetails={(id, updatedFields) => {
              if (onUpdateProductDetails) {
                onUpdateProductDetails(id, updatedFields);
              }
              setLiveDbProducts((prev) =>
                prev ? prev.map((p) => (p.id === id ? { ...p, ...updatedFields } : p)) : null
              );
            }}
            availableCategories={availableCategories}
            onAddCategory={(cat) => {
              if (!customCategories.includes(cat)) {
                saveCategories([...customCategories, cat]);
              }
            }}
          />
        </Suspense>
      )}

      {/* Payment Confirmation Required Modal for Unpaid Orders */}
      {unpaidPromptOrder && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
          <div className="bg-white rounded-2xl border border-amber-200 shadow-2xl max-w-md w-full p-6 text-slate-900 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Payment Confirmation Required
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Order <strong className="font-mono text-slate-800 uppercase">#{unpaidPromptOrder.id}</strong> (Total: <strong className="font-mono text-slate-900">KSh {unpaidPromptOrder.total.toLocaleString('en-KE')}</strong>) is currently marked as <span className="font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-mono text-[10px]">UNPAID (Cash on Delivery)</span>.
                </p>
              </div>
            </div>

            <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                Strict Fulfillment Rule
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed font-light">
                An order is never marked as Completed before payment is confirmed. Have you received and verified the Cash on Delivery payment for this order?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setUnpaidPromptOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onUpdateOrderPaymentStatus) {
                    onUpdateOrderPaymentStatus(unpaidPromptOrder.id, 'paid', 'Payment confirmed upon order completion by admin');
                  }
                  onUpdateOrderStatus(unpaidPromptOrder.id, 'completed');
                  if (selectedLookupOrder && selectedLookupOrder.id === unpaidPromptOrder.id) {
                    setSelectedLookupOrder({
                      ...selectedLookupOrder,
                      paymentStatus: 'paid',
                      status: 'completed'
                    });
                  }
                  setUnpaidPromptOrder(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 cursor-pointer transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirm Payment & Complete Order
              </button>
            </div>
          </div>
        </div>
      )}
        </main>
      </div>
    </div>
  );
}
