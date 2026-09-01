/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import StorefrontLayout from './layouts/StorefrontLayout';
import LandingHome from './components/LandingHome';
import EmailToaster, { EmailNotification } from './components/EmailToaster';
import { Database, AlertTriangle, X, Clock, Loader2 } from 'lucide-react';
import { CurrencyType, formatPrice, convertPrice } from './lib/currency';
import { useAutoSave } from './lib/useAutoSave';
import { emailService } from './services/api';
import UnsubscribeView from './components/UnsubscribeView';
import { broadcastNewOrderEvent } from './lib/orderNotifications';
import {
  buildOrderConfirmationEmail,
  buildAdminNewOrderEmail,
  buildPaymentNotificationEmail,
  buildShippingConfirmationEmail,
  buildDeliveryConfirmationEmail,
  buildRefundCancellationNoticeEmail,
  buildAdminReturnRequestAlertEmail,
  createEmailId,
  getCurrentTimestamp,
} from './lib/emailNotifier';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SEOHead } from './components/SEOHead';

// Helper for resilient lazy loading with auto-retry and chunk error handling
function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  retriesLeft = 2,
  interval = 400
): React.LazyExoticComponent<T> {
  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remaining: number) => {
        componentImport()
          .then(resolve)
          .catch((error) => {
            if (remaining > 0) {
              setTimeout(() => {
                attempt(remaining - 1);
              }, interval);
            } else {
              console.warn('[lazyWithRetry] Module load failed:', error);
              reject(error);
            }
          });
      };
      attempt(retriesLeft);
    })
  );
}

// Lazy-loaded major route components for code splitting & optimal performance
const ProductStore = lazyWithRetry(() => import('./components/ProductStore'));
const ServicesPanel = lazyWithRetry(() => import('./components/ServicesPanel'));
const BlogPanel = lazyWithRetry(() => import('./components/BlogPanel'));
const UserAccount = lazyWithRetry(() => import('./components/UserAccount'));
const CheckoutFlow = lazyWithRetry(() => import('./components/CheckoutFlow'));
const ContactAbout = lazyWithRetry(() => import('./components/ContactAbout'));
const PrivacyPolicy = lazyWithRetry(() => import('./components/PrivacyPolicy'));
const AdminLayout = lazyWithRetry(() => import('./layouts/AdminLayout'));

import {
  Product,
  CartItem,
  BlogPost,
  Order,
  Review,
  InventoryAuditLog,
  ReturnRequest,
  CouponItem,
  AffiliateProduct
} from './types';

import {
  INITIAL_PRODUCTS,
  INITIAL_BLOGS,
  INITIAL_ORDERS,
  COUPONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_AFFILIATE_PRODUCTS
} from './data';
import api, { fetchProducts, productService, pushOrderToBackend, orderService, mapBackendProductToFrontend } from './services/api';
import { mapBackendOrderToFrontend } from './api/orders';
import { clearVeloceLocalStorageItems, checkAndPurgeBackendSyncStorage, safeLocalStorageSetItem, safeLocalStorageGetItem, saveToIndexedDb } from './lib/storage';

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [fontSize, setFontSize] = useState<string>(() => {
    return localStorage.getItem('app-font-size') || 'normal';
  });

  const [showBackToTop, setShowBackToTop] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      if (typeof window !== 'undefined') {
        setShowBackToTop(window.scrollY > 300);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const html = document.documentElement;
    let scale = '100%';
    if (fontSize === 'small') {
      scale = '92%';
    } else if (fontSize === 'normal') {
      scale = '100%';
    } else if (fontSize === 'medium') {
      scale = '108%';
    } else if (fontSize === 'large') {
      scale = '116%';
    } else if (fontSize === 'extra-large') {
      scale = '125%';
    }
    html.style.fontSize = scale;
    localStorage.setItem('app-font-size', fontSize);
  }, [fontSize]);

  // Tabs: 'home' | 'store' | 'affiliate' | 'services' | 'blog' | 'contact' | 'user' | 'checkout' | 'admin' | 'unsubscribe'
  const [currentTab, setCurrentTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/admin')) return 'admin';
      if (path === '/unsubscribe') return 'unsubscribe';
    }
    return 'home';
  });

  // Helper to switch tabs and synchronize browser URL for /admin
  const handleTabChange = (tab: string) => {
    if (tab === 'store') {
      setSelectedProduct(null);
      setSearchQuery('');
    }
    setCurrentTab(tab);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      if (window.history.pushState) {
        if (tab === 'admin') {
          if (!window.location.pathname.startsWith('/admin')) {
            window.history.pushState({}, '', '/admin');
          }
        } else if (window.location.pathname.startsWith('/admin')) {
          window.history.pushState({}, '', '/');
        }
      }
    }
  };

  // Dedicated helper to directly open a product's detail page
  const handleOpenProductDetail = (product: Product) => {
    setSelectedProduct(product);
    setCurrentTab('store');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      if (window.history.pushState) {
        if (window.location.pathname.startsWith('/admin')) {
          window.history.pushState({}, '', '/');
        }
      }
    }
  };

  // Global link click handler ensuring every anchor/navigation interaction scrolls to top
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    const handleGlobalLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a');
      if (anchor) {
        const href = anchor.getAttribute('href');
        // If it's a valid in-page hash anchor with an element, allow browser smooth scrolling to it
        if (href && href.startsWith('#') && href.length > 1) {
          const el = document.getElementById(href.slice(1));
          if (el) return;
        }
        // If external new tab, ignore
        if (anchor.target === '_blank') return;
        
        // Scroll to top
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    };

    window.addEventListener('click', handleGlobalLinkClick, { capture: true });
    return () => window.removeEventListener('click', handleGlobalLinkClick, { capture: true });
  }, []);

  const [userRole, setUserRole] = useState<'customer' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('veloce_admin_token');
      const saved = localStorage.getItem('veloce_user_role');
      if (token && saved === 'admin') return 'admin';
    }
    return 'customer';
  });

  useEffect(() => {
    localStorage.setItem('veloce_user_role', userRole);
  }, [userRole]);

  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState<boolean>(false);
  const [adminEditingProduct, setAdminEditingProduct] = useState<Product | null>(null);

  const handleEditProduct = (product: Product) => {
    setUserRole('admin');
    setAdminEditingProduct(product);
    handleTabChange('admin');
  };

  useEffect(() => {
    if (!showLogoutConfirmModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLogoutConfirmModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLogoutConfirmModal]);

  const [lastBackupTime, setLastBackupTime] = useState<number>(() => {
    const saved = localStorage.getItem('veloce_last_backup_time');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [hasSnoozedBackup, setHasSnoozedBackup] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const snoozedUntil = localStorage.getItem('veloce_backup_snoozed_until');
    if (snoozedUntil && Date.now() < parseInt(snoozedUntil, 10)) {
      return true;
    }
    const sessionSnooze = sessionStorage.getItem('veloce_backup_snoozed');
    if (sessionSnooze === 'true') {
      return true;
    }
    return false;
  });

  const handleSnoozeBackup = () => {
    setHasSnoozedBackup(true);
    try {
      const snoozeUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
      localStorage.setItem('veloce_backup_snoozed_until', snoozeUntil.toString());
      sessionStorage.setItem('veloce_backup_snoozed', 'true');
    } catch {
      // ignore
    }
  };

  const [currency, setCurrency] = useState<CurrencyType>(() => {
    const saved = localStorage.getItem('veloce_currency');
    return (saved as CurrencyType) || 'KSh';
  });

  const handleCurrencyChange = (newCurrency: CurrencyType) => {
    setCurrency(newCurrency);
    localStorage.setItem('veloce_currency', newCurrency);
  };

  // Unified global storage states
  const isClearedData = () => {
    if (typeof window === 'undefined') return false;
    return (
      localStorage.getItem('veloce_cleared_simulated_data') === 'true' ||
      localStorage.getItem('is_backend_sync_enabled') === 'true'
    );
  };

  const [products, setProducts] = useState<Product[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const cat = params.get('category');
      if (cat) return cat;
    }
    return 'All';
  });

  const [selectedSubcategory, setSelectedSubcategory] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sub = params.get('subcategory');
      if (sub) return sub;
    }
    return 'All';
  });

  const [storeFilterType, setStoreFilterType] = useState<'All' | 'physical' | 'digital' | 'service' | 'wishlist' | 'sale'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('on_sale') === 'true' || params.get('onSale') === 'true' || params.get('filter') === 'sale') {
        return 'sale';
      }
      const type = params.get('type') as any;
      if (['physical', 'digital', 'service', 'wishlist', 'sale'].includes(type)) {
        return type;
      }
    }
    return 'All';
  });

  // Check URL path & query parameters for routing on mount & popstate
  useEffect(() => {
    const handleLocationRouting = () => {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        const params = new URLSearchParams(window.location.search);
        if (path.startsWith('/admin')) {
          setCurrentTab('admin');
        } else if (params.get('unsubscribe') || params.get('email') || path === '/unsubscribe') {
          setCurrentTab('unsubscribe');
        } else if (params.get('category') || params.get('on_sale') === 'true' || params.get('onSale') === 'true' || params.get('filter') === 'sale' || path === '/store') {
          setCurrentTab('store');
          if (params.get('category')) {
            setSelectedCategory(params.get('category') || 'All');
          }
          if (params.get('subcategory')) {
            setSelectedSubcategory(params.get('subcategory') || 'All');
          }
          if (params.get('on_sale') === 'true' || params.get('onSale') === 'true' || params.get('filter') === 'sale') {
            setStoreFilterType('sale');
          } else if (params.get('type')) {
            setStoreFilterType((params.get('type') as any) || 'All');
          }
        }
      }
    };
    handleLocationRouting();
    window.addEventListener('popstate', handleLocationRouting);
    return () => window.removeEventListener('popstate', handleLocationRouting);
  }, []);

  // Fetch products, orders & inventory state directly from Django backend API as primary source of truth
  useEffect(() => {
    // Purge 'veloce_' prefixed items from localStorage if is_backend_sync_enabled flag is set
    checkAndPurgeBackendSyncStorage();

    let isMounted = true;
    const loadBackendData = async () => {
      // 1. Authoritative Products from Django Backend
      try {
        const fetchedProducts = await fetchProducts();
        if (isMounted && Array.isArray(fetchedProducts)) {
          setProducts(fetchedProducts);
        }
      } catch (err) {
        console.warn('[App] Could not fetch products from Django backend API:', err);
      }

      // 2. Authoritative Orders from Django Backend
      try {
        const backendOrders = await orderService.getOrders();
        if (isMounted && Array.isArray(backendOrders)) {
          const mappedOrders = backendOrders.map(mapBackendOrderToFrontend);
          setOrders(mappedOrders);
        }
      } catch (err) {
        console.warn('[App] Could not fetch orders from Django backend API:', err);
      }

      // 3. Authoritative Inventory Audit Logs from Django Backend
      try {
        const logsRes = await api.get('/inventory/logs/');
        if (isMounted && Array.isArray(logsRes.data) && logsRes.data.length > 0) {
          const mappedLogs: InventoryAuditLog[] = logsRes.data.map((l: any) => ({
            id: String(l.id || ''),
            productId: String(l.product || l.productId || ''),
            productName: l.product_name || l.productName || 'Product',
            productSku: l.product_sku || l.productSku || '',
            timestamp: l.created_at || l.timestamp || new Date().toISOString().replace('T', ' ').slice(0, 16),
            changeQuantity: Number(l.change_quantity || l.change || 0),
            newStock: Number(l.new_stock || l.newStock || 0),
            reason: (l.reason || 'manual-update') as any,
            details: l.details || l.reason || '',
          }));
          setInventoryAuditLogs(mappedLogs);
        }
      } catch (err) {
        // silent fallback
      }

      // 4. Trigger backend inventory expiry check
      try {
        await fetch('/api/admin/expiry-check', { method: 'POST' });
      } catch (e) {
        // Silent catch for offline or dev mode
      }
    };

    loadBackendData();

    const handleProductsUpdated = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setProducts(e.detail);
      }
    };
    window.addEventListener('veloce_products_updated', handleProductsUpdated);

    return () => {
      isMounted = false;
      window.removeEventListener('veloce_products_updated', handleProductsUpdated);
    };
  }, []);



  const [orders, setOrders] = useState<Order[]>(() => {
    return safeLocalStorageGetItem('veloce_orders', isClearedData() ? [] : INITIAL_ORDERS);
  });

  const [inventoryAuditLogs, setInventoryAuditLogs] = useState<InventoryAuditLog[]>(() => {
    return safeLocalStorageGetItem('veloce_inventory_audit_logs', isClearedData() ? [] : INITIAL_AUDIT_LOGS);
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    return safeLocalStorageGetItem('veloce_cart', []);
  });

  const [wishlist, setWishlist] = useState<string[]>(() => {
    return safeLocalStorageGetItem('veloce_wishlist', []);
  });

  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>(() => {
    return safeLocalStorageGetItem<ReturnRequest[]>('veloce_return_requests', []);
  });

  useEffect(() => {
    safeLocalStorageSetItem('veloce_return_requests', JSON.stringify(returnRequests));
  }, [returnRequests]);

  // Selected product state for Store deep-sheet modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Enforce page loading from top first on initial load, tab changes, product selections, or role changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [currentTab, selectedProduct, userRole]);

  // Prefilled reviewer name when coming from User Account completed order logs
  const [prefilledReviewerName, setPrefilledReviewerName] = useState<string>('');



  const [emailToasts, setEmailToasts] = useState<EmailNotification[]>([]);

  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
    if (query.trim() && currentTab !== 'store' && currentTab !== 'admin') {
      setCurrentTab('store');
    }
  };

  const handleSelectCategory = (category: string, subcategory: string = 'All') => {
    setSelectedCategory(category);
    setSelectedSubcategory(subcategory);
    setStoreFilterType('All');
    setSearchQuery('');
    setSelectedProduct(null);
    handleTabChange('store');

    if (typeof window !== 'undefined' && window.history.pushState) {
      const url = new URL(window.location.href);
      if (category && category !== 'All') {
        url.searchParams.set('category', category);
      } else {
        url.searchParams.delete('category');
      }
      if (subcategory && subcategory !== 'All') {
        url.searchParams.set('subcategory', subcategory);
      } else {
        url.searchParams.delete('subcategory');
      }
      url.searchParams.delete('on_sale');
      url.searchParams.delete('filter');
      url.searchParams.delete('type');
      window.history.pushState({}, '', url.toString());
    }
  };

  const handleSelectSale = () => {
    setStoreFilterType('sale');
    setSelectedCategory('All');
    setSelectedSubcategory('All');
    setSearchQuery('');
    setSelectedProduct(null);
    handleTabChange('store');

    if (typeof window !== 'undefined' && window.history.pushState) {
      const url = new URL(window.location.href);
      url.searchParams.set('on_sale', 'true');
      url.searchParams.delete('category');
      url.searchParams.delete('subcategory');
      url.searchParams.delete('filter');
      url.searchParams.delete('type');
      window.history.pushState({}, '', url.toString());
    }
  };

  const handleStoreCategoryChange = (category: string, subcategory: string = 'All') => {
    setSelectedCategory(category);
    setSelectedSubcategory(subcategory);
    if (typeof window !== 'undefined' && window.history.replaceState) {
      const url = new URL(window.location.href);
      if (category && category !== 'All') {
        url.searchParams.set('category', category);
      } else {
        url.searchParams.delete('category');
      }
      if (subcategory && subcategory !== 'All') {
        url.searchParams.set('subcategory', subcategory);
      } else {
        url.searchParams.delete('subcategory');
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleStoreFilterTypeChange = (filterType: 'All' | 'physical' | 'digital' | 'service' | 'wishlist' | 'sale') => {
    setStoreFilterType(filterType);
    if (typeof window !== 'undefined' && window.history.replaceState) {
      const url = new URL(window.location.href);
      if (filterType === 'sale') {
        url.searchParams.set('on_sale', 'true');
        url.searchParams.delete('type');
      } else if (filterType !== 'All') {
        url.searchParams.set('type', filterType);
        url.searchParams.delete('on_sale');
      } else {
        url.searchParams.delete('on_sale');
        url.searchParams.delete('type');
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  const triggerReturnRequestEmailNotification = (
    req: ReturnRequest,
    newStatus: ReturnRequest['status'],
    adminNote?: string,
    trackingNumber?: string
  ) => {
    const emailId = 'email-' + Math.random().toString(36).substring(2, 9);
    const customer = req.customerName || 'Customer';
    const customerEmail = req.customerEmail || 'customer@example.com';
    const claimType = req.type === 'refund' ? 'Refund' : 'Exchange';

    let subject = '';
    let body = '';

    const effectiveTracking = trackingNumber || req.trackingNumber;
    const effectiveNote = adminNote || req.adminNote;

    switch (newStatus) {
      case 'approved':
        subject = `✅ Return Request #${req.id} APPROVED (${claimType})`;
        body = `Hi ${customer},\n\n` +
          `Great news! Your return request #${req.id} for Order Ref: ${req.orderId} (${claimType}) has been APPROVED by our merchant team.\n\n` +
          (effectiveTracking ? `Return Shipping Tracking Number: ${effectiveTracking}\n\n` : '') +
          `Please safely package your returned items and drop off at your local courier.\n` +
          (effectiveNote ? `\nMerchant Note: "${effectiveNote}"\n` : '') +
          `\nThank you for choosing Veloce Hub!\n\nBest regards,\nThe Veloce Hub Returns Team`;
        break;

      case 'rejected':
        subject = `❌ Return Request #${req.id} REJECTED`;
        body = `Hi ${customer},\n\n` +
          `We have completed the review of your return request #${req.id} for Order Ref: ${req.orderId}.\n\n` +
          `Regrettably, your return request has been REJECTED at this time.\n` +
          (effectiveNote ? `\nReason / Merchant Note: "${effectiveNote}"\n` : '') +
          `\nIf you have questions or additional details to provide, please contact our support desk.\n\nBest regards,\nThe Veloce Hub Returns Team`;
        break;

      case 'resolved':
        subject = `🎉 Return Request #${req.id} RESOLVED & FINALIZED`;
        body = `Hi ${customer},\n\n` +
          `Your return claim #${req.id} for Order Ref: ${req.orderId} has been successfully RESOLVED and finalized.\n\n` +
          (req.type === 'refund' 
            ? `Your refund has been authorized and returned to your account statement.` 
            : `Your replacement package has been dispatched.`) +
          (effectiveNote ? `\n\nMerchant Note: "${effectiveNote}"` : '') +
          `\n\nThank you for shopping with Veloce Hub!\n\nBest regards,\nThe Veloce Hub Returns Team`;
        break;

      case 'received':
        subject = `🚚 Return Request #${req.id} IN TRANSIT / RECEIVED`;
        body = `Hi ${customer},\n\n` +
          `Your returned package for Order Ref: ${req.orderId} (Ticket #${req.id}) is now IN TRANSIT and received at our facility for inspection.\n\n` +
          (effectiveNote ? `Merchant Note: "${effectiveNote}"\n\n` : '') +
          `We will keep you updated as processing progresses.\n\nBest regards,\nThe Veloce Hub Logistics Team`;
        break;

      default:
        subject = `ℹ️ Return Request #${req.id} Updated to ${newStatus.toUpperCase()}`;
        body = `Hi ${customer},\n\n` +
          `The status of your return request #${req.id} for Order Ref: ${req.orderId} is now: ${newStatus.toUpperCase()}.\n\n` +
          (effectiveNote ? `Merchant Note: "${effectiveNote}"\n\n` : '') +
          `Best regards,\nThe Veloce Hub Returns Team`;
    }

    const newToast: EmailNotification = {
      id: emailId,
      orderId: req.orderId,
      customerName: customer,
      customerEmail,
      subject,
      body,
      status: `return-${newStatus}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    setEmailToasts((prev) => [newToast, ...prev]);
  };

  const handleDismissEmailToast = (id: string) => {
    setEmailToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const triggerLowStockEmail = (product: Product, currentStock: number, threshold: number) => {
    const emailId = 'email-' + Math.random().toString(36).substring(2, 9);
    
    const subject = `⚠️ ALERT: Low Stock Warning for [${product.sku}] ${product.name}`;
    const body = `Urgent System Alert: Inventory Level Compromised\n\n` +
      `Product: ${product.name}\n` +
      `SKU: ${product.sku.toUpperCase()}\n` +
      `Category: ${product.category.toUpperCase()}\n\n` +
      `Current Stock: ${currentStock} units remaining\n` +
      `Predefined Reorder Threshold: ${threshold} units\n\n` +
      `Status: Below Minimum Safety Limit\n\n` +
      `Please navigate to the Inventory panel in your Admin Dashboard to schedule a resupply order and replenish units immediately.\n\n` +
      `Veloce Logistics Systems & Automation`;

    const newToast: EmailNotification = {
      id: emailId,
      orderId: `low-stock-${product.id}`,
      customerName: 'System Administrator',
      customerEmail: 'admin@veloce-ledger.com',
      subject,
      body,
      status: 'low-stock',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    setEmailToasts((prev) => [newToast, ...prev]);
  };

  const triggerPriceDropEmail = (product: Product, oldPrice: number, newPrice: number, recipientEmail: string, recipientName: string) => {
    const emailId = 'email-' + Math.random().toString(36).substring(2, 9);
    const percentage = Math.round(((oldPrice - newPrice) / oldPrice) * 100);

    const subject = `🔥 Price Drop Alert: [${product.name}] is now ${percentage}% OFF!`;
    const body = `Hi ${recipientName},\n\n` +
      `Great news! An item on your wishlist / price watch list has just received a price reduction!\n\n` +
      `Product: ${product.name}\n` +
      `SKU: ${product.sku ? product.sku.toUpperCase() : 'N/A'}\n\n` +
      `Original Price: KSh ${oldPrice.toLocaleString('en-KE')}\n` +
      `New Price: KSh ${newPrice.toLocaleString('en-KE')} (${percentage}% discount!)\n\n` +
      `Don't miss out on this deal. Head over to our store and secure yours before stock runs out!\n\n` +
      `Best regards,\n` +
      `The Veloce Hub Merchandising Team`;

    const newToast: EmailNotification = {
      id: emailId,
      orderId: `price-drop-${product.id}-${emailId}`,
      customerName: recipientName,
      customerEmail: recipientEmail,
      subject,
      body,
      status: 'price-drop',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    setEmailToasts((prev) => [newToast, ...prev]);
  };

  const triggerBackInStockEmail = (product: Product, newStock: number, recipientEmail: string, recipientName: string) => {
    const emailId = 'email-' + Math.random().toString(36).substring(2, 9);

    const subject = `✨ Back in Stock Alert: [${product.name}] is Available Now!`;
    const body = `Hi ${recipientName},\n\n` +
      `Great news! An item on your wishlist has just been restocked and is available for purchase again!\n\n` +
      `Product: ${product.name}\n` +
      `SKU: ${product.sku ? product.sku.toUpperCase() : 'N/A'}\n\n` +
      `Current Price: KSh ${product.price.toLocaleString('en-KE')}\n` +
      `Available Stock: ${newStock} units remaining\n\n` +
      `Hurry up! Head over to our store and secure yours before it sells out again!\n\n` +
      `Best regards,\n` +
      `The Veloce Hub Inventory Team`;

    const newToast: EmailNotification = {
      id: emailId,
      orderId: `back-in-stock-${product.id}-${emailId}`,
      customerName: recipientName,
      customerEmail: recipientEmail,
      subject,
      body,
      status: 'back-in-stock',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    setEmailToasts((prev) => [newToast, ...prev]);
  };

  const triggerCustomEmail = (
    subjectOrPayload: string | { subject?: string; title?: string; body?: string; message?: string; status?: string; type?: string },
    bodyArg?: string,
    statusArg: string = 'loyalty'
  ) => {
    const emailId = 'email-' + Math.random().toString(36).substring(2, 9);
    const recipientName = typeof window !== 'undefined' ? localStorage.getItem('veloce_login_name') || 'Customer' : 'Customer';
    const recipientEmail = typeof window !== 'undefined' ? localStorage.getItem('veloce_login_email') || '' : '';

    let subject = '';
    let body = '';
    let status = statusArg;

    if (typeof subjectOrPayload === 'object' && subjectOrPayload !== null) {
      subject = subjectOrPayload.subject || subjectOrPayload.title || 'System Notification';
      body = subjectOrPayload.body || subjectOrPayload.message || '';
      status = subjectOrPayload.status || subjectOrPayload.type || statusArg;
    } else {
      subject = String(subjectOrPayload || 'System Notification');
      body = String(bodyArg || '');
      status = statusArg;
    }

    const newToast: EmailNotification = {
      id: emailId,
      orderId: `custom-${status}-${emailId}`,
      customerName: recipientName,
      customerEmail: recipientEmail,
      subject,
      body,
      status,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    setEmailToasts((prev) => [newToast, ...prev]);
  };

  const prevProductsRef = useRef<Product[]>([]);

  useEffect(() => {
    if (prevProductsRef.current.length > 0) {
      products.forEach((p) => {
        const prevP = prevProductsRef.current.find((prev) => prev.id === p.id);
        if (prevP) {
          // 1. Price drop detection
          if (p.price < prevP.price) {
            const wishlistEmailEnabled = localStorage.getItem('veloce_wishlist_email_notifications_enabled') !== 'false';
            const wishlistPriceEnabled = localStorage.getItem('veloce_wishlist_price_drops_enabled') !== 'false';
            
            if (wishlist.includes(p.id) && wishlistEmailEnabled && wishlistPriceEnabled) {
              const recipientEmail = localStorage.getItem('veloce_wishlist_notification_email') || localStorage.getItem('veloce_login_email') || '';
              const recipientName = localStorage.getItem('veloce_login_name') || 'Customer';
              if (recipientEmail) {
                triggerPriceDropEmail(p, prevP.price, p.price, recipientEmail, recipientName);
              }
            }

            // Also check for other price trackers
            try {
              const savedTrackers = localStorage.getItem('veloce_price_trackers');
              if (savedTrackers) {
                const trackersMap = JSON.parse(savedTrackers);
                const registeredEmails = trackersMap[p.id];
                if (Array.isArray(registeredEmails)) {
                  registeredEmails.forEach((email: string) => {
                    const userEmail = localStorage.getItem('veloce_login_email') || '';
                    if (email.toLowerCase() !== userEmail.toLowerCase()) {
                      const namePart = email.split('@')[0];
                      const capitalizedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
                      triggerPriceDropEmail(p, prevP.price, p.price, email, capitalizedName);
                    }
                  });
                }
              }
            } catch (err) {
              console.error('Error handling price trackers email notifications:', err);
            }
          }

          // 2. Restock detection (stock goes from 0 to > 0)
          const wasOutOfStock = prevP.stock === 0;
          const isNowInStock = p.stock !== null && p.stock !== undefined && p.stock > 0;
          if (wasOutOfStock && isNowInStock) {
            const wishlistEmailEnabled = localStorage.getItem('veloce_wishlist_email_notifications_enabled') !== 'false';
            const wishlistRestockEnabled = localStorage.getItem('veloce_wishlist_restocks_enabled') !== 'false';

            if (wishlist.includes(p.id) && wishlistEmailEnabled && wishlistRestockEnabled) {
              const recipientEmail = localStorage.getItem('veloce_wishlist_notification_email') || localStorage.getItem('veloce_login_email') || '';
              const recipientName = localStorage.getItem('veloce_login_name') || 'Customer';
              if (recipientEmail) {
                triggerBackInStockEmail(p, p.stock!, recipientEmail, recipientName);
              }
            }
          }
        }
      });
    }
    prevProductsRef.current = products;
  }, [products, wishlist]);

  const prevStocksRef = useRef<Record<string, number | null>>({});

  useEffect(() => {
    products.forEach((p) => {
      if (p.type === 'physical' && p.stock !== null) {
        const threshold = p.lowStockThreshold ?? 5;
        const prevStock = prevStocksRef.current[p.id];
        
        if (prevStock !== undefined) {
          // If the stock level has decreased AND it is now <= threshold, and previously it was > threshold
          if (p.stock < prevStock && p.stock <= threshold && prevStock > threshold) {
            triggerLowStockEmail(p, p.stock, threshold);
          }
        }
        
        prevStocksRef.current[p.id] = p.stock;
      }
    });
  }, [products]);



  const [coupons, setCoupons] = useState<Record<string, CouponItem>>(() => {
    const saved = localStorage.getItem('veloce_coupons');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const normalized: Record<string, CouponItem> = {};
        Object.entries(parsed).forEach(([k, v]) => {
          if (typeof v === 'number') {
            normalized[k] = { percent: v, expiryDate: '2027-12-31', desc: `${v}% promotional code`, active: true, isActive: true };
          } else if (v && typeof v === 'object') {
            const isAct = (v as any).active !== undefined ? (v as any).active !== false : ((v as any).isActive !== undefined ? (v as any).isActive !== false : true);
            normalized[k] = {
              percent: (v as any).percent || 0,
              expiryDate: (v as any).expiryDate || '2027-12-31',
              desc: (v as any).desc,
              minSpend: (v as any).minSpend,
              maxDiscount: (v as any).maxDiscount,
              active: isAct,
              isActive: isAct,
            };
          }
        });
        return Object.keys(normalized).length > 0 ? normalized : COUPONS;
      } catch {
        return COUPONS;
      }
    }
    return COUPONS;
  });

  const [promoBanner, setPromoBanner] = useState<{ text: string; code: string; active: boolean }>(() => {
    const saved = localStorage.getItem('veloce_promo_banner');
    return saved ? JSON.parse(saved) : { text: '', code: '', active: false };
  });

  // Synchronize product state to IndexedDB cache
  useEffect(() => {
    saveToIndexedDb('veloce_cache', 'veloce_products', products).catch(() => {});
  }, [products]);

  useEffect(() => {
    safeLocalStorageSetItem('veloce_orders', JSON.stringify(orders));
    saveToIndexedDb('veloce_cache', 'veloce_orders', orders).catch(() => {});
  }, [orders]);

  useEffect(() => {
    safeLocalStorageSetItem('veloce_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    safeLocalStorageSetItem('veloce_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    safeLocalStorageSetItem('veloce_coupons', JSON.stringify(coupons));
  }, [coupons]);

  useEffect(() => {
    safeLocalStorageSetItem('veloce_promo_banner', JSON.stringify(promoBanner));
  }, [promoBanner]);

  useEffect(() => {
    safeLocalStorageSetItem('veloce_inventory_audit_logs', JSON.stringify(inventoryAuditLogs));
  }, [inventoryAuditLogs]);

  // Force-save application state before window/tab unloads or refreshes
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        safeLocalStorageSetItem('veloce_cart', JSON.stringify(cart));
        safeLocalStorageSetItem('veloce_orders', JSON.stringify(orders));
        safeLocalStorageSetItem('veloce_inventory_audit_logs', JSON.stringify(inventoryAuditLogs));
        saveToIndexedDb('veloce_cache', 'veloce_products', products).catch(() => {});
        safeLocalStorageSetItem('veloce_wishlist', JSON.stringify(wishlist));
        safeLocalStorageSetItem('veloce_return_requests', JSON.stringify(returnRequests));
        safeLocalStorageSetItem('veloce_coupons', JSON.stringify(coupons));
        safeLocalStorageSetItem('veloce_promo_banner', JSON.stringify(promoBanner));
      } catch (err) {
        console.error('Failed to force-save state on beforeunload:', err);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [cart, orders, inventoryAuditLogs, products, wishlist, returnRequests, coupons, promoBanner]);

  // Hook to automatically save the current cart and related states to localStorage every 30 seconds
  useAutoSave({
    'veloce_cart': cart,
    'veloce_orders': orders,
    'veloce_wishlist': wishlist,
  }, 30000, () => {
    console.log('[AutoSave] Cart and transactional states saved successfully.');
  });

  // Real-time operations
  const handleAddToCart = (product: Product, quantity: number, vars: Record<string, string>) => {
    setCart((prevCart) => {
      // Find matching item by ID and exact variations match
      const existingIdx = prevCart.findIndex(
        (item) =>
          item.product.id === product.id &&
          JSON.stringify(item.selectedVariations) === JSON.stringify(vars)
      );

      if (existingIdx > -1) {
        const updated = [...prevCart];
        updated[existingIdx].quantity += quantity;
        return updated;
      } else {
        return [...prevCart, { product, quantity, selectedVariations: vars }];
      }
    });
  };

  const handleUpdateCartQty = (productId: string, vars: Record<string, string>, qty: number) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.product.id === productId &&
        JSON.stringify(item.selectedVariations) === JSON.stringify(vars)
          ? { ...item, quantity: qty }
          : item
      )
    );
  };

  const handleRemoveFromCart = (productId: string, vars: Record<string, string>) => {
    setCart((prevCart) =>
      prevCart.filter(
        (item) =>
          !(
            item.product.id === productId &&
            JSON.stringify(item.selectedVariations) === JSON.stringify(vars)
          )
      )
    );
  };

  const handleClearCart = () => setCart([]);

  const handleBulkMoveToWishlist = (productIds: string[]) => {
    // Add all of these productIds to the wishlist if they aren't already there
    setWishlist((prev) => {
      const updated = [...prev];
      productIds.forEach((id) => {
        if (!updated.includes(id)) {
          updated.push(id);
        }
      });
      return updated;
    });

    // Remove these products from the cart
    setCart((prevCart) => prevCart.filter((item) => !productIds.includes(item.product.id)));
  };

  const handlePlaceOrder = async (order: Order) => {
    // Attempt backend POST request to push local cart order data to Django API
    try {
      const backendResponse = await pushOrderToBackend(order);
      console.log('[App] Order pushed to Django backend successfully:', backendResponse);
    } catch (err) {
      console.warn('[App] Could not push order to Django backend, preserving local order state:', err);
    }

    // Append Order with initial statusHistory
    const orderWithHistory: Order = {
      ...order,
      statusHistory: [
        {
          status: 'pending',
          timestamp: order.date || new Date().toISOString().replace('T', ' ').slice(0, 16),
          note: 'Order placed and payment validated.'
        }
      ]
    };
    setOrders((prev) => [orderWithHistory, ...prev]);

    // Broadcast new order event to trigger real-time desktop window popup and sound alert
    broadcastNewOrderEvent(orderWithHistory);

    // 1. Dispatch Customer Order Confirmation email (sends email & creates on-screen customer receipt toast)
    const customerEmailToast = buildOrderConfirmationEmail(orderWithHistory);

    // 2. Dispatch Admin Notification email silently via SMTP to ropenixkenya@gmail.com
    buildAdminNewOrderEmail(orderWithHistory);

    // Register only customer toast for public storefront display
    setEmailToasts((prev) => [customerEmailToast, ...prev]);



    // Log stock changes for order items
    order.items.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (prod && prod.stock !== null) {
        const newStock = Math.max(0, prod.stock - item.quantity);
        const newLog: InventoryAuditLog = {
          id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          productId: prod.id,
          productName: prod.name,
          productSku: prod.sku,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
          changeQuantity: -item.quantity,
          newStock,
          reason: 'order-placement',
          details: `Order #${order.id.slice(-6).toUpperCase()}`
        };
        setInventoryAuditLogs((prevLogs) => [newLog, ...prevLogs]);
      }
    });

    // Deduct stock levels of physical products inside store memory
    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        const purchasedItem = order.items.find((item) => item.productId === p.id);
        if (purchasedItem && p.stock !== null) {
          return {
            ...p,
            stock: Math.max(0, p.stock - purchasedItem.quantity)
          };
        }
        return p;
      })
    );

    // Remove purchased items from the wishlist
    const purchasedProductIds = order.items.map((item) => item.productId);
    setWishlist((prev) => prev.filter((id) => !purchasedProductIds.includes(id)));
  };



  const handleUpdateOrderNote = (orderId: string, note: string, notesHistory?: { id: string; text: string; timestamp: string }[]) => {
    setOrders((prevOrders) =>
      prevOrders.map((order) => {
        if (order.id === orderId) {
          let updatedHistory = notesHistory;
          if (updatedHistory === undefined) {
            const currentHistory = order.notesHistory || [];
            const trimmed = note.trim();
            if (trimmed) {
              const newNoteEntry = {
                id: 'note-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                text: trimmed,
                timestamp: new Date().toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              };
              updatedHistory = [newNoteEntry, ...currentHistory];
            } else {
              updatedHistory = currentHistory;
            }
          }
          return {
            ...order,
            customNote: note,
            notesHistory: updatedHistory,
          };
        }
        return order;
      })
    );
  };

  const handleDownloadRawBackup = () => {
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

      const now = Date.now();
      setLastBackupTime(now);
      localStorage.setItem('veloce_last_backup_time', now.toString());
      setHasSnoozedBackup(true);
      const snoozeUntil = now + 7 * 24 * 60 * 60 * 1000;
      localStorage.setItem('veloce_backup_snoozed_until', snoozeUntil.toString());
      sessionStorage.setItem('veloce_backup_snoozed', 'true');
    } catch (err) {
      console.error('Error generating DB backup:', err);
      alert('An error occurred while compiling your database backup JSON.');
    }
  };

  // Admin Catalog operations
  const handleAddProduct = (newProduct: Product) => {
    setProducts((prev) => {
      const updated = [newProduct, ...prev.filter((p) => p.id !== newProduct.id)];
      return updated;
    });

    // Asynchronously push to backend SQLite API so product is saved server-side
    productService.createProduct(newProduct).catch((err) => {
      console.warn('[App] Failed to save new product to backend API endpoint:', err);
    });
  };

  const handleUpdateProductStock = (id: string, newStock: number) => {
    const prod = products.find((p) => p.id === id);
    if (prod && prod.stock !== null) {
      const diff = newStock - prod.stock;
      if (diff !== 0) {
        const newLog: InventoryAuditLog = {
          id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          productId: id,
          productName: prod.name,
          productSku: prod.sku,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
          changeQuantity: diff,
          newStock: newStock,
          reason: diff > 0 ? 'restock' : 'manual-update',
          details: diff > 0 ? 'Manual Restock' : 'Manual Stock Adjustment'
        };
        setInventoryAuditLogs((prevLogs) => [newLog, ...prevLogs]);
      }
    }

    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        if (p.id === id) {
          // If product is out of stock (stock is 0) and new stock is > 0, trigger backInStockAlert
          const wasOutOfStock = p.stock === 0;
          const isNowInStock = newStock > 0;
          return {
            ...p,
            stock: newStock,
            backInStockAlert: wasOutOfStock && isNowInStock ? true : p.backInStockAlert,
          };
        }
        return p;
      })
    );
    setSelectedProduct((prev) => {
      if (prev && prev.id === id) {
        const wasOutOfStock = prev.stock === 0;
        const isNowInStock = newStock > 0;
        return {
          ...prev,
          stock: newStock,
          backInStockAlert: wasOutOfStock && isNowInStock ? true : prev.backInStockAlert,
        };
      }
      return prev;
    });
    // Persist directly to backend SQLite database
    productService.updateProduct(id, { stock: newStock }).catch((err) => {
      console.warn('[App] Failed to update product stock on backend:', err);
    });
  };

  const handleUpdateProductPrice = (id: string, newPrice: number, previousPrice?: number | null) => {
    const calculatedPreviousPrice = (p: Product) =>
      previousPrice !== undefined
        ? (previousPrice === null ? undefined : previousPrice)
        : (newPrice < p.price ? p.price : p.previousPrice);

    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        if (p.id === id) {
          const prevP = calculatedPreviousPrice(p);
          return {
            ...p,
            previousPrice: prevP,
            price: newPrice,
          };
        }
        return p;
      })
    );
    setSelectedProduct((prev) => {
      if (prev && prev.id === id) {
        const prevP = calculatedPreviousPrice(prev);
        return {
          ...prev,
          previousPrice: prevP,
          price: newPrice,
        };
      }
      return prev;
    });
    // Persist directly to backend SQLite database
    const targetProd = products.find(p => p.id === id);
    const finalPrevPrice = targetProd ? calculatedPreviousPrice(targetProd) : previousPrice;
    productService.updateProduct(id, { price: newPrice, previousPrice: finalPrevPrice || null }).catch((err) => {
      console.warn('[App] Failed to update product price on backend:', err);
    });
  };

  const handleDismissProductNotification = (id: string, type: 'price' | 'stock') => {
    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        if (p.id === id) {
          if (type === 'price') {
            return { ...p, previousPrice: undefined };
          } else {
            return { ...p, backInStockAlert: false };
          }
        }
        return p;
      })
    );
    setSelectedProduct((prev) => {
      if (prev && prev.id === id) {
        if (type === 'price') {
          return { ...prev, previousPrice: undefined };
        } else {
          return { ...prev, backInStockAlert: false };
        }
      }
      return prev;
    });
    // Persist directly to backend SQLite database
    productService.updateProduct(id, type === 'price' ? { previousPrice: null } : { backInStockAlert: false }).catch(() => {});
  };

  const handleUpdateProductSku = (id: string, newSku: string) => {
    setProducts((prevProducts) =>
      prevProducts.map((p) => (p.id === id ? { ...p, sku: newSku } : p))
    );
    setSelectedProduct((prev) => {
      if (prev && prev.id === id) {
        return { ...prev, sku: newSku };
      }
      return prev;
    });
    // Persist directly to backend SQLite database
    productService.updateProduct(id, { sku: newSku }).catch((err) => {
      console.warn('[App] Failed to update product SKU on backend:', err);
    });
  };

  const handleUpdateProductPaymentRestriction = (id: string, restriction: 'prepaid' | 'cod' | 'both') => {
    setProducts((prevProducts) =>
      prevProducts.map((p) => (p.id === id ? { ...p, paymentRestriction: restriction } : p))
    );
    setSelectedProduct((prev) => {
      if (prev && prev.id === id) {
        return { ...prev, paymentRestriction: restriction };
      }
      return prev;
    });
    // Persist directly to backend SQLite database
    productService.updateProduct(id, { paymentRestriction: restriction }).catch((err) => {
      console.warn('[App] Failed to update payment restriction on backend:', err);
    });
  };

  const handleUpdateProductThreshold = (id: string, newThreshold: number) => {
    setProducts((prevProducts) =>
      prevProducts.map((p) => (p.id === id ? { ...p, lowStockThreshold: newThreshold } : p))
    );
    setSelectedProduct((prev) => {
      if (prev && prev.id === id) {
        return { ...prev, lowStockThreshold: newThreshold };
      }
      return prev;
    });
    // Persist directly to backend SQLite database
    productService.updateProduct(id, { lowStockThreshold: newThreshold }).catch((err) => {
      console.warn('[App] Failed to update low stock threshold on backend:', err);
    });
  };

  const handleUpdateProductStatus = (id: string, newStatus: 'Active' | 'Inactive' | 'Draft' | 'Archived') => {
    setProducts((prevProducts) =>
      prevProducts.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
    );
    setSelectedProduct((prev) => {
      if (prev && prev.id === id) {
        return { ...prev, status: newStatus };
      }
      return prev;
    });
    // Persist directly to backend SQLite database
    productService.updateProduct(id, { status: newStatus }).catch((err) => {
      console.warn('[App] Failed to update status on backend:', err);
    });
  };

  const handleUpdateProductDetails = (id: string, updatedFields: Partial<Product>) => {
    setProducts((prevProducts) => {
      const updatedList = prevProducts.map((p) => (p.id === id ? { ...p, ...updatedFields } : p));
      return updatedList;
    });
    setSelectedProduct((prev) => {
      if (prev && prev.id === id) {
        return { ...prev, ...updatedFields };
      }
      return prev;
    });
    // Persist directly to backend SQLite database
    productService.updateProduct(id, updatedFields).catch((err) => {
      console.warn('[App] Failed to update product details on backend:', err);
    });
  };

  const handleAddCoupon = (code: string, percent: number, expiryDate?: string, desc?: string, active: boolean = true) => {
    const cleanCode = code.trim().toUpperCase();
    const defaultExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setCoupons((prev) => ({
      ...prev,
      [cleanCode]: {
        percent,
        expiryDate: expiryDate || defaultExpiry,
        desc: desc || `${percent}% custom discount coupon`,
        active: active,
        isActive: active,
      },
    }));
  };

  const handleToggleCouponActive = (code: string, active?: boolean) => {
    const cleanCode = code.trim().toUpperCase();
    setCoupons((prev) => {
      const existing = prev[cleanCode];
      if (!existing) return prev;
      const currentActive = typeof existing === 'object' && existing !== null && (existing as any).active !== undefined
        ? (existing as any).active !== false && (existing as any).isActive !== false
        : true;
      const nextActive = active !== undefined ? active : !currentActive;

      if (typeof existing === 'number') {
        return {
          ...prev,
          [cleanCode]: {
            percent: existing,
            expiryDate: '2027-12-31',
            desc: `${existing}% promotional code`,
            active: nextActive,
            isActive: nextActive,
          },
        };
      }

      return {
        ...prev,
        [cleanCode]: {
          ...existing,
          active: nextActive,
          isActive: nextActive,
        },
      };
    });
  };

  const handleUpdateCoupon = (code: string, updatedFields: Partial<CouponItem>) => {
    const cleanCode = code.trim().toUpperCase();
    setCoupons((prev) => {
      const existing = prev[cleanCode];
      if (!existing) return prev;
      const base: CouponItem = typeof existing === 'number'
        ? { percent: existing, expiryDate: '2027-12-31', desc: `${existing}% promotional code`, active: true, isActive: true }
        : existing;
      return {
        ...prev,
        [cleanCode]: {
          ...base,
          ...updatedFields,
        },
      };
    });
  };

  const handleDeleteCoupon = (code: string) => {
    setCoupons((prev) => {
      const copy = { ...prev };
      delete copy[code.toUpperCase()];
      return copy;
    });
  };

  const handleUpdatePromoBanner = (text: string, code: string, active: boolean) => {
    setPromoBanner({ text, code, active });
  };



  const handleUpdateOrderStatus = (orderId: string, status: Order['status']) => {
    // Find target order
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    // Strict Enforcement: An order can NEVER be completed before payment is confirmed
    const isCod = targetOrder.paymentMethod === 'cod';
    const isPaid = targetOrder.paymentStatus === 'paid' || (!isCod && targetOrder.paymentStatus !== 'unpaid');

    if (status === 'completed' && !isPaid) {
      console.warn(`[Order Lifecycle] Blocked attempt to mark unpaid order #${orderId} as completed. Payment confirmation required.`);
      const warnToast: EmailNotification = {
        id: `unpaid-block-${Date.now()}`,
        orderId: targetOrder.id,
        customerName: targetOrder.customerName || 'Customer',
        customerEmail: targetOrder.customerEmail || 'customer@example.com',
        subject: `⚠️ Action Blocked: Cannot Complete Order #${targetOrder.id} Without Confirmed Payment`,
        body: `Order #${targetOrder.id} cannot be marked as Completed because Cash on Delivery payment has not been confirmed. Please confirm payment receipt before completing.`,
        status: 'blocked',
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        recipientType: 'admin',
        category: 'order'
      };
      setEmailToasts((t) => [warnToast, ...t]);
      return;
    }

    // Persist status change directly to Django backend
    api.put(`/orders/${orderId}/`, { status }).catch((err) => {
      console.warn('[App] Failed to update order status on backend:', err);
    });

    setOrders((prev) => {
      return prev.map((o) => {
        if (o.id === orderId) {
          let history = o.statusHistory ? [...o.statusHistory] : [];
          if (history.length === 0) {
            history.push({
              status: 'pending',
              timestamp: o.date || new Date().toISOString().replace('T', ' ').slice(0, 16),
              note: 'Order placed and payment validated.'
            });
          }
          
          const mappedStatus = (status === 'completed' ? 'delivered' : status) as any;
          if (history[history.length - 1]?.status !== mappedStatus) {
            let note = '';
            if (mappedStatus === 'processing') note = 'Order has been compiled and is in sorting.';
            else if (mappedStatus === 'shipped') {
              note = 'Dispatched from sorting hub. Package in transit.';
              const shipToast = buildShippingConfirmationEmail(o, o.trackingNumber);
              setEmailToasts((t) => [shipToast, ...t]);
            }
            else if (mappedStatus === 'delivered') {
              note = 'Delivered safely to recipient.';
              const delivToast = buildDeliveryConfirmationEmail(o);
              setEmailToasts((t) => [delivToast, ...t]);
            }
            else if (mappedStatus === 'cancelled') {
              note = 'Order has been cancelled and voided.';
              const cancelToast = buildRefundCancellationNoticeEmail(
                o.customerName,
                o.customerEmail,
                o.id,
                'cancelled',
                'Order has been cancelled by store administrator.'
              );
              setEmailToasts((t) => [cancelToast, ...t]);
            }
            else if (mappedStatus === 'pending-cancellation') note = 'Cancellation requested by user.';

            history.push({
              status: mappedStatus as any,
              timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
              note
            });
          }
          return { ...o, status, statusHistory: history };
        }
        return o;
      });
    });
  };

  const handleUpdateOrderPaymentStatus = (orderId: string, paymentStatus: 'unpaid' | 'paid', paidNote?: string) => {
    // Persist payment status update to backend API
    api.patch(`/orders/${orderId}/`, {
      payment_reference: paymentStatus === 'paid' ? 'COD-PAYMENT-CONFIRMED' : 'COD-PENDING-UNPAID',
      notes: paidNote || `Payment marked as ${paymentStatus.toUpperCase()} by admin.`
    }).catch((err) => {
      console.warn('[App] Failed to update order payment status on backend:', err);
    });

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const isMarkingPaid = paymentStatus === 'paid';
          const updatedHistory = o.statusHistory ? [...o.statusHistory] : [];
          updatedHistory.push({
            status: o.status as any,
            timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
            note: paidNote || (isMarkingPaid
              ? `Payment confirmed and marked as PAID by administrator (${o.paymentMethod === 'cod' ? 'Cash on Delivery Collected' : 'Payment Verified'}).`
              : 'Payment status reverted to UNPAID / Pending Collection.')
          });

          const updatedOrder: Order = {
            ...o,
            paymentStatus,
            paidAt: isMarkingPaid ? (o.paidAt || new Date().toISOString()) : undefined,
            statusHistory: updatedHistory,
          };

          // If transitioning to paid, dispatch official payment confirmation receipt to customer
          if (isMarkingPaid) {
            const paymentReceiptToast = buildPaymentNotificationEmail(updatedOrder, true);
            setEmailToasts((t) => [paymentReceiptToast, ...t]);
          }

          return updatedOrder;
        }
        return o;
      })
    );
  };

  const handleCreateReturnRequest = (request: ReturnRequest) => {
    setReturnRequests((prev) => [request, ...prev]);

    // Dispatch email notifications:
    // 1. Customer notice
    const custNotice = buildRefundCancellationNoticeEmail(
      request.customerName,
      request.customerEmail,
      request.orderId,
      'pending',
      'Return request received and pending admin review.'
    );
    // 2. Owner/Admin notice
    const adminNotice = buildAdminReturnRequestAlertEmail(request);

    setEmailToasts((t) => [adminNotice, custNotice, ...t]);

    // Append a statusHistory entry to the target order
    setOrders((prevOrders) =>
      prevOrders.map((o) => {
        if (o.id === request.orderId) {
          const updatedHistory = o.statusHistory ? [...o.statusHistory] : [];
          updatedHistory.push({
            status: 'pending-cancellation' as any,
            timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
            note: `Submitted return request (${request.type === 'refund' ? 'Refund' : 'Exchange'}): ${request.id}`
          });
          return { ...o, statusHistory: updatedHistory };
        }
        return o;
      })
    );
  };

  const handleUpdateReturnRequestStatus = (
    requestId: string,
    status: ReturnRequest['status'],
    adminNote?: string,
    trackingNumber?: string
  ) => {
    // Check existing request to trigger email notification if status changes
    const existingReq = returnRequests.find((r) => r.id === requestId);
    if (existingReq && existingReq.status !== status) {
      triggerReturnRequestEmailNotification(existingReq, status, adminNote, trackingNumber);
    }

    setReturnRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          const updated = {
            ...req,
            status,
            adminNote: adminNote ?? req.adminNote,
            trackingNumber: trackingNumber ?? req.trackingNumber
          };
          
          // Also append history entry to target order
          setOrders((prevOrders) =>
            prevOrders.map((o) => {
              if (o.id === req.orderId) {
                const updatedHistory = o.statusHistory ? [...o.statusHistory] : [];
                let note = `Return request ${req.id} status updated to ${status.toUpperCase()}.`;
                if (adminNote) {
                  note += ` Note: ${adminNote}`;
                }
                if (trackingNumber) {
                  note += ` Return tracking: ${trackingNumber}`;
                }
                updatedHistory.push({
                  status: (status === 'resolved' ? (req.type === 'refund' ? 'cancelled' : o.status) : o.status) as any,
                  timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
                  note
                });

                let orderStatus = o.status;
                if (status === 'resolved' && req.type === 'refund') {
                  orderStatus = 'cancelled';
                }
                return { ...o, status: orderStatus, statusHistory: updatedHistory };
              }
              return o;
            })
          );
          return updated;
        }
        return req;
      })
    );
  };

  const handleDeleteProduct = (id: string, type: 'proprietary' | 'affiliate' = 'proprietary', skipConfirm = false) => {
    if (!skipConfirm) {
      let confirmed = false;
      try {
        const prod = products.find((p) => p.id === id);
        const name = prod ? prod.name : 'this product';
        confirmed = window.confirm(`Are you sure you want to permanently delete the product "${name}"? This action cannot be undone.`);
      } catch (e) {
        console.warn('Iframe blocked native window.confirm, auto-confirming action.', e);
        confirmed = true;
      }
      if (!confirmed) return;
    }

    setProducts((prev) => {
      const next = prev.filter((p) => p.id !== id);
      return next;
    });
    productService.deleteProduct(id).catch(() => {});
  };

  // Review submission calculation
  const handleAddReview = (productId: string, review: Review) => {
    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        if (p.id === productId) {
          const updatedReviews = [review, ...p.reviews];
          const totalRating = updatedReviews.reduce((acc, curr) => acc + curr.rating, 0);
          const newAvgRating = totalRating / updatedReviews.length;
          return {
            ...p,
            reviews: updatedReviews,
            reviewsCount: updatedReviews.length,
            rating: Number(newAvgRating.toFixed(2))
          };
        }
        return p;
      })
    );

    // Also update detail overlay if selected
    setSelectedProduct((prev) => {
      if (prev && prev.id === productId) {
        const updatedReviews = [review, ...prev.reviews];
        const totalRating = updatedReviews.reduce((acc, curr) => acc + curr.rating, 0);
        const newAvgRating = totalRating / updatedReviews.length;
        return {
          ...prev,
          reviews: updatedReviews,
          reviewsCount: updatedReviews.length,
          rating: Number(newAvgRating.toFixed(2))
        };
      }
      return prev;
    });
  };

  const handleToggleWishlist = (productId: string) => {
    const userEmail = typeof window !== 'undefined' ? localStorage.getItem('veloce_login_email') : '';
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('veloce_auth_token') : '';
    const isRegistered = Boolean(userEmail || authToken);

    if (!isRegistered) {
      // Unregistered guest: store pending wishlist product & set register mode
      try {
        localStorage.setItem('veloce_pending_wishlist_product_id', productId);
        localStorage.setItem('veloce_open_auth_mode', 'register');
      } catch (e) {}

      handleTabChange('user');
      return;
    }

    setWishlist((prev) => {
      const exists = prev.includes(productId);
      return exists
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
    });
  };

  const handleClearWishlist = () => {
    setWishlist([]);
  };

  const hasDataToBackup = products.length > 0 || orders.length > 0;
  const isBackupOverdue = hasDataToBackup && (!lastBackupTime || (Date.now() - lastBackupTime) >= 7 * 24 * 60 * 60 * 1000);
  const showBackupPromptModal = userRole === 'admin' && currentTab === 'admin' && isBackupOverdue && !hasSnoozedBackup;

  const getDaysSinceLastBackupStr = () => {
    if (!lastBackupTime) return 'never';
    const diffMs = Date.now() - lastBackupTime;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    return `${diffDays} days ago`;
  };

  // Render storefront content
  const renderStorefrontContent = () => {
    switch (currentTab) {
      case 'home':
        return (
          <LandingHome
            featuredProducts={products}
            orders={orders}
            setCurrentTab={handleTabChange}
            onProductClick={handleOpenProductDetail}
            onSelectCategory={handleSelectCategory}
            onSelectSale={handleSelectSale}
            onTriggerCustomEmail={triggerCustomEmail}
          />
        );
      case 'store':
        return (
          <ProductStore
            products={products}
            cart={cart}
            onAddToCart={handleAddToCart}
            onUpdateCartQty={handleUpdateCartQty}
            onRemoveFromCart={handleRemoveFromCart}
            onBuyNow={(product, quantity, vars) => {
              handleAddToCart(product, quantity, vars);
              handleTabChange('checkout');
            }}
            onAddReview={handleAddReview}
            selectedProduct={selectedProduct}
            setSelectedProduct={setSelectedProduct}
            prefilledReviewerName={prefilledReviewerName}
            wishlist={wishlist}
            onToggleWishlist={handleToggleWishlist}
            darkMode={darkMode}
            currency={currency}
            searchQuery={searchQuery}
            onSearchQueryChange={handleSearchQueryChange}
            initialCategory={selectedCategory}
            initialSubcategory={selectedSubcategory}
            initialFilterType={storeFilterType}
            onCategoryChange={handleStoreCategoryChange}
            onFilterTypeChange={handleStoreFilterTypeChange}
            currentUserEmail={localStorage.getItem('veloce_login_email') || ''}
            currentUserName={localStorage.getItem('veloce_login_name') || ''}
            onOpenAuthModal={() => handleTabChange('account')}
            onProductUpdate={(updatedProd) => {
              setProducts((prev) => prev.map((p) => (p.id === updatedProd.id ? updatedProd : p)));
              if (selectedProduct && selectedProduct.id === updatedProd.id) {
                setSelectedProduct(updatedProd);
              }
            }}
            onTriggerEmailToast={(toast) => setEmailToasts((prev) => [toast, ...prev])}
            onEditProduct={userRole === 'admin' ? handleEditProduct : undefined}
          />
        );
      case 'services':
        return <ServicesPanel products={products} onAddToCart={handleAddToCart} setCurrentTab={handleTabChange} />;
      case 'blog':
        return <BlogPanel blogs={INITIAL_BLOGS} />;
      case 'user':
        return (
          <UserAccount
            orders={orders}
            products={products}
            onAddToCart={handleAddToCart}
            setCurrentTab={handleTabChange}
            onUpdateOrderNote={handleUpdateOrderNote}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onLeaveReview={(product, customerName) => {
              setPrefilledReviewerName(customerName);
              handleOpenProductDetail(product);
            }}
            wishlist={wishlist}
            cart={cart}
            onToggleWishlist={handleToggleWishlist}
            onClearWishlist={handleClearWishlist}
            onClearCart={handleClearCart}
            onAddCoupon={handleAddCoupon}
            onAddOrder={(order) => setOrders((prev) => [order, ...prev])}
            onTriggerCustomEmail={triggerCustomEmail}
            onDismissProductNotification={handleDismissProductNotification}
            darkMode={darkMode}
            fontSize={fontSize}
            onChangeFontSize={setFontSize}
            returnRequests={returnRequests}
            onCreateReturnRequest={handleCreateReturnRequest}
            onUpdateReturnRequestStatus={handleUpdateReturnRequestStatus}
          />
        );
      case 'checkout':
        return (
          <CheckoutFlow
            cart={cart}
            onUpdateCartQty={handleUpdateCartQty}
            onRemoveFromCart={handleRemoveFromCart}
            onPlaceOrder={handlePlaceOrder}
            onClearCart={handleClearCart}
            coupons={coupons}
            onBulkMoveToWishlist={handleBulkMoveToWishlist}
            currency={currency}
            setCurrentTab={handleTabChange}
            onSwitchTab={handleTabChange}
          />
        );
      case 'privacy':
        return <PrivacyPolicy setCurrentTab={handleTabChange} />;
      case 'unsubscribe':
        return <UnsubscribeView onBackToStore={() => handleTabChange('store')} />;
      case 'contact':
      default:
        return <ContactAbout onTriggerEmailToast={(toast) => setEmailToasts((prev) => [toast, ...prev])} />;
    }
  };

  // Dedicated Admin Portal branch
  if (currentTab === 'admin' || currentTab === 'edit-product') {
    return (
      <>
        <SEOHead
          currentTab={currentTab}
          selectedProduct={selectedProduct}
          selectedCategory={selectedCategory}
          selectedSubcategory={selectedSubcategory}
          searchQuery={searchQuery}
          products={products}
          blogs={INITIAL_BLOGS}
        />
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white font-sans">
                <div className="p-4 rounded-2xl bg-emerald-950/40 text-emerald-400 mb-3 animate-pulse">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
                <p className="text-xs font-mono text-emerald-400">Loading Django Admin Suite...</p>
              </div>
            }
          >
            <AdminLayout
              userRole={userRole}
              setUserRole={setUserRole}
              onNavigateToSite={handleTabChange}
              products={products}
              setProducts={setProducts}
              orders={orders}
              setOrders={setOrders}
              inventoryAuditLogs={inventoryAuditLogs}
              returnRequests={returnRequests}
              coupons={coupons}
              promoBanner={promoBanner}
              onUpdatePromoBanner={handleUpdatePromoBanner}
              lastBackupTime={lastBackupTime}
              currency={currency}
              darkMode={darkMode}
              fontSize={fontSize}
              onChangeFontSize={setFontSize}
              onAddProduct={handleAddProduct}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onDeleteProduct={handleDeleteProduct}
              onUpdateProductStock={handleUpdateProductStock}
              onUpdateProductSku={handleUpdateProductSku}
              onUpdateProductThreshold={handleUpdateProductThreshold}
              onUpdateProductPrice={handleUpdateProductPrice}
              onUpdateProductStatus={handleUpdateProductStatus}
              onUpdateProductPaymentRestriction={handleUpdateProductPaymentRestriction}
              onUpdateProductDetails={handleUpdateProductDetails}
              onAddCoupon={handleAddCoupon}
              onDeleteCoupon={handleDeleteCoupon}
              onToggleCouponActive={handleToggleCouponActive}
              onUpdateCoupon={handleUpdateCoupon}
              onTriggerBackup={handleDownloadRawBackup}
              onAddOrder={handlePlaceOrder}
              onUpdateOrderPaymentStatus={handleUpdateOrderPaymentStatus}
              onUpdateReturnRequestStatus={handleUpdateReturnRequestStatus}
              initialEditingProduct={adminEditingProduct}
            />
          </Suspense>
        </ErrorBoundary>
        <EmailToaster toasts={emailToasts} onDismiss={handleDismissEmailToast} isAdminView={true} />
        {showBackupPromptModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans animate-in fade-in duration-300" id="db-backup-prompt-modal">
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <button
                onClick={handleSnoozeBackup}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                title="Close"
                id="btn-close-backup-modal"
              >
                <X className="h-4.5 w-4.5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-full p-2.5 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-6 w-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                    Database Backup Required
                  </h3>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    Last Backup: {getDaysSinceLastBackupStr()}
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-600 dark:text-gray-300 font-extralight leading-relaxed mb-6">
                Because all products, customer orders, and system audit logs are persisted inside your database, we recommend downloading a fresh JSON backup copy regularly.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <button
                  onClick={handleSnoozeBackup}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer"
                  id="btn-snooze-backup"
                >
                  Remind Me Later
                </button>
                <button
                  onClick={handleDownloadRawBackup}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-5 text-xs font-bold transition-all cursor-pointer shadow-sm"
                  id="btn-confirm-backup"
                >
                  <Database className="h-3.5 w-3.5" /> Backup Database Now
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Public Storefront layout
  return (
    <>
      <SEOHead
        currentTab={currentTab}
        selectedProduct={selectedProduct}
        selectedCategory={selectedCategory}
        selectedSubcategory={selectedSubcategory}
        searchQuery={searchQuery}
        products={products}
        blogs={INITIAL_BLOGS}
      />
      <StorefrontLayout
        currentTab={currentTab}
        onTabChange={handleTabChange}
        cart={cart}
        wishlist={wishlist}
        products={products}
        onSelectProduct={(p) => {
          setSelectedProduct(p);
          handleTabChange('store');
        }}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        fontSize={fontSize}
        onChangeFontSize={setFontSize}
        currency={currency}
        onChangeCurrency={handleCurrencyChange}
        searchQuery={searchQuery}
        onSearchQueryChange={handleSearchQueryChange}
        onSelectCategory={handleSelectCategory}
        onSelectSale={handleSelectSale}
        activeCategory={selectedCategory}
        activeType={storeFilterType}
        promoBanner={promoBanner}
        userRole={userRole}
        setUserRole={setUserRole}
      >
        {renderStorefrontContent()}
      </StorefrontLayout>
      <EmailToaster toasts={emailToasts} onDismiss={handleDismissEmailToast} isAdminView={false} />
    </>
  );
}
