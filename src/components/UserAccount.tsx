/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  User,
  ShieldCheck,
  Mail,
  Key,
  ShoppingBag,
  FileText,
  Check,
  Copy,
  Heart,
  LogOut,
  Printer,
  RefreshCw,
  Clock,
  Truck,
  MapPin,
  ShoppingCart,
  Edit2,
  Trash2,
  MessageSquare,
  Search,
  X,
  Download,
  Settings,
  Bell,
  AlertCircle,
  Sun,
  Moon,
  Type,
  ArrowRight,
  Ticket,
  PlusCircle,
  LifeBuoy,
  Send,
  HelpCircle,
  CheckCircle,
  Package,
  List,
  Grid,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  CreditCard,
  ExternalLink,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { Order, Product, OrderStatusHistoryEntry, CartItem, ReturnRequest } from '../types';
import { CurrencyType, formatPrice } from '../lib/currency';
import { getProductDiscountInfo } from '../utils/productUtils';
import OrderReceiptModal from './OrderReceiptModal';
import TaxInvoiceModal from './TaxInvoiceModal';
import ReturnRequestModal from './ReturnRequestModal';
import CustomerPaymentClaimModal from './CustomerPaymentClaimModal';
import EditProfileModal from './EditProfileModal';
import { exportSingleReceiptPDF, exportOrderHistoryPDF } from '../lib/pdfGenerator';
import api, { authService, setAuthTokens } from '../services/api';
import { usersApi } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface UserAccountProps {
  orders: Order[];
  products: Product[];
  onAddToCart: (product: Product, quantity: number, vars: Record<string, string>) => void;
  setCurrentTab?: (tab: string) => void;
  onTrackOrder?: (orderId?: string) => void;
  onUpdateOrderNote?: (orderId: string, note: string, notesHistory?: { id: string; text: string; timestamp: string }[]) => void;
  onUpdateOrderStatus?: (orderId: string, status: 'pending' | 'completed' | 'cancelled' | 'pending-cancellation' | 'shipped') => void;
  onTriggerEmailToast?: (order: Order, status: string) => void;
  onLeaveReview?: (product: Product, customerName: string) => void;
  wishlist?: string[];
  cart?: CartItem[];
  onToggleWishlist?: (productId: string) => void;
  onClearWishlist?: () => void;
  onClearCart?: () => void;
  onAddCoupon?: (code: string, percent: number) => void;
  onAddOrder?: (order: Order) => void;
  onTriggerCustomEmail?: (subject: string, body: string, status?: string) => void;
  onDismissProductNotification?: (id: string, type: 'price' | 'stock') => void;
  darkMode?: boolean;
  fontSize?: string;
  onChangeFontSize?: (size: string) => void;
  currency?: CurrencyType;
  returnRequests?: ReturnRequest[];
  onCreateReturnRequest?: (request: ReturnRequest) => void;
  onUpdateReturnRequestStatus?: (requestId: string, status: ReturnRequest['status'], adminNote?: string, trackingNumber?: string) => void;
}

export default function UserAccount({
  orders = [],
  products = [],
  onAddToCart,
  setCurrentTab,
  onTrackOrder,
  onUpdateOrderNote,
  onUpdateOrderStatus = () => {},
  onTriggerEmailToast,
  onLeaveReview,
  wishlist = [],
  cart = [],
  onToggleWishlist = () => {},
  onClearWishlist = () => {},
  onClearCart = () => {},
  onAddCoupon,
  onAddOrder,
  onTriggerCustomEmail,
  onDismissProductNotification = () => {},
  darkMode = false,
  fontSize = 'normal',
  onChangeFontSize = () => {},
  currency = 'KSh',
  returnRequests = [],
  onCreateReturnRequest = () => {},
  onUpdateReturnRequestStatus = () => {},
}: UserAccountProps) {
  const { t } = useLanguage();
  const { user, isAuthenticated, login: authLogin, logout: authLogout, updateProfile: authUpdateProfile } = useAuth();

  // Auth & Profile state
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return Boolean(isAuthenticated && user);
  });
  const [email, setEmail] = useState(() => (isAuthenticated && user?.email) ? user.email : '');
  const [name, setName] = useState(() => (isAuthenticated && user?.name) ? user.name : '');
  const [phone, setPhone] = useState(() => (isAuthenticated && user?.phone) ? user.phone : '');
  const [address, setAddress] = useState(() => (isAuthenticated && user?.shippingAddress) ? user.shippingAddress : '');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Active navigation tab with reload retention and URL parameter support
  const [activeDashboardTab, setActiveDashboardTab] = useState<'orders' | 'wishlist' | 'returns' | 'tickets' | 'settings'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sub = (params.get('subtab') || params.get('section') || params.get('tab') || localStorage.getItem('veloce_user_subtab') || '').toLowerCase();
      if (['orders', 'wishlist', 'returns', 'tickets', 'settings'].includes(sub)) {
        return sub as any;
      }
    }
    return 'orders';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('veloce_user_subtab', activeDashboardTab);
      const url = new URL(window.location.href);
      if (url.pathname.includes('/user') || url.pathname.includes('/account') || url.pathname.includes('/orders')) {
        url.searchParams.set('subtab', activeDashboardTab);
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [activeDashboardTab]);

  // Order filters and view state
  const [orderViewMode, setOrderViewMode] = useState<'list' | 'cards'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'shipped' | 'completed' | 'cancelled'>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [editingNoteOrderId, setEditingNoteOrderId] = useState<string | null>(null);
  const [tempNoteText, setTempNoteText] = useState('');
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Modals state
  const [selectedPrintOrder, setSelectedPrintOrder] = useState<Order | null>(null);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [autoPrintOnce, setAutoPrintOnce] = useState(false);
  const [returnOrder, setReturnOrder] = useState<Order | null>(null);
  const [claimPaymentOrder, setClaimPaymentOrder] = useState<Order | null>(null);

  // Wishlist state
  const [wishlistViewMode, setWishlistViewMode] = useState<'grid' | 'list'>('grid');
  const [showClearWishlistConfirm, setShowClearWishlistConfirm] = useState(false);
  const [showMoveAllToCartConfirm, setShowMoveAllToCartConfirm] = useState(false);

  // Notifications & Toast
  const [reorderNotification, setReorderNotification] = useState<{ show: boolean; message: string; orderId: string } | null>(null);

  // Wishlist email notification preferences
  const [wishlistEmailEnabled, setWishlistEmailEnabled] = useState(() => localStorage.getItem('veloce_wishlist_email_notifications_enabled') !== 'false');
  const [wishlistPriceEnabled, setWishlistPriceEnabled] = useState(() => localStorage.getItem('veloce_wishlist_price_drops_enabled') !== 'false');
  const [wishlistRestockEnabled, setWishlistRestockEnabled] = useState(() => localStorage.getItem('veloce_wishlist_restocks_enabled') !== 'false');

  // Support Tickets State
  const [tickets, setTickets] = useState<any[]>(() => {
    const saved = localStorage.getItem('customer_support_tickets');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });
  const [isRaisingNewTicket, setIsRaisingNewTicket] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketCategory, setNewTicketCategory] = useState('Orders & Delivery');
  const [newTicketPriority, setNewTicketPriority] = useState('medium');
  const [newTicketDescription, setNewTicketDescription] = useState('');
  const [ticketReplyText, setTicketReplyText] = useState('');

  // Unauthenticated Login / Register / OTP states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [isRegistering, setIsRegistering] = useState(() => typeof window !== 'undefined' && localStorage.getItem('veloce_open_auth_mode') === 'register');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Forgot Password state
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Sync state with AuthContext
  useEffect(() => {
    const loggedIn = Boolean(isAuthenticated && user);
    setIsLoggedIn(loggedIn);
    if (loggedIn && user) {
      if (user.email) setEmail(user.email);
      if (user.name) setName(user.name);
      if (user.phone !== undefined) setPhone(user.phone || '');
      if (user.shippingAddress !== undefined) setAddress(user.shippingAddress || '');
    } else {
      setEmail('');
      setName('');
      setPhone('');
      setAddress('');
    }
  }, [user, isAuthenticated]);

  useEffect(() => {
    const handleAuthChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ action: string; user?: any }>;
      if (customEvent.detail?.action === 'logout') {
        setIsLoggedIn(false);
        setEmail('');
        setName('');
        setPhone('');
        setAddress('');
      } else if (customEvent.detail?.action === 'login' || customEvent.detail?.action === 'update') {
        setIsLoggedIn(true);
        if (customEvent.detail?.user) {
          const u = customEvent.detail.user;
          if (u.email) setEmail(u.email);
          if (u.name) setName(u.name);
          if (u.phone !== undefined) setPhone(u.phone || '');
          if (u.shippingAddress !== undefined) setAddress(u.shippingAddress || '');
        }
      }
    };
    window.addEventListener('veloce_auth_changed', handleAuthChange);
    return () => window.removeEventListener('veloce_auth_changed', handleAuthChange);
  }, []);

  useEffect(() => {
    if (isLoggedIn && email) localStorage.setItem('veloce_login_email', email);
    if (isLoggedIn && name) localStorage.setItem('veloce_login_name', name);
    if (isLoggedIn && phone) localStorage.setItem('veloce_login_phone', phone);
    if (isLoggedIn && address) localStorage.setItem('veloce_login_address', address);
  }, [isLoggedIn, email, name, phone, address]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const saveTickets = (updatedTickets: any[]) => {
    setTickets(updatedTickets);
    localStorage.setItem('customer_support_tickets', JSON.stringify(updatedTickets));
  };

  // Profile save handler
  const handleSaveProfile = async (updatedProfile: { name: string; email: string; phone: string; address: string }) => {
    setName(updatedProfile.name);
    setEmail(updatedProfile.email);
    setPhone(updatedProfile.phone);
    setAddress(updatedProfile.address);

    authUpdateProfile({
      name: updatedProfile.name,
      email: updatedProfile.email,
      phone: updatedProfile.phone,
      shippingAddress: updatedProfile.address
    });

    try {
      await usersApi.updateProfile({
        first_name: updatedProfile.name,
        email: updatedProfile.email,
        phone: updatedProfile.phone,
        shipping_address: updatedProfile.address
      });
    } catch (err: any) {
      console.warn('[UserAccount] Profile update backend sync:', err);
    }
  };

  const handleSignOut = () => {
    authLogout();
    setEmail('');
    setName('');
    setPhone('');
    setAddress('');
    setIsLoggedIn(false);
  };

  const handleTrackOrder = (orderId?: string) => {
    if (onTrackOrder) {
      onTrackOrder(orderId);
    } else if (setCurrentTab) {
      if (orderId && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('veloce_open_tracking', { detail: orderId }));
      }
      setCurrentTab('track');
    }
  };

  // Reorder action
  const handleReorderItems = (order: Order) => {
    order.items.forEach((item) => {
      const match = products.find((p) => p.id === item.productId);
      const productObj: Product = match || {
        id: item.productId,
        sku: 'REORDER-' + item.productId,
        name: item.name,
        description: 'Reordered item from reference order.',
        price: item.price,
        category: 'Reordered',
        tags: [],
        type: item.type,
        imageUrl: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=500&auto=format&fit=crop&q=60',
        stock: 999,
        rating: 0,
        reviewsCount: 0,
        reviews: [],
      };
      onAddToCart(productObj, item.quantity, item.selectedVariations || {});
    });

    setReorderNotification({
      show: true,
      message: `Items from order #${order.id.slice(0, 8).toUpperCase()} were added to your shopping cart.`,
      orderId: order.id,
    });

    setTimeout(() => {
      setReorderNotification((prev) => (prev?.orderId === order.id ? null : prev));
    }, 5000);
  };

  // Bulk add wishlist to cart
  const handleAddAllToCart = () => {
    const savedProducts = products.filter((p) => wishlist.includes(p.id));
    if (savedProducts.length === 0) return;

    savedProducts.forEach((p) => {
      onAddToCart(p, 1, {});
    });

    setReorderNotification({
      show: true,
      message: `Added all ${savedProducts.length} wishlist item(s) to your cart!`,
      orderId: 'wishlist-bulk-add',
    });

    setTimeout(() => {
      setReorderNotification((prev) => (prev?.orderId === 'wishlist-bulk-add' ? null : prev));
    }, 5000);
  };

  // Authentication Handlers
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail) return;
    const finalEmail = loginEmail.trim();
    const finalName = isRegistering ? (registerName.trim() || finalEmail.split('@')[0]) : (name || finalEmail.split('@')[0]);

    setAuthError(null);
    setAuthLoading(true);

    if (isRegistering) {
      if (!loginPass || loginPass.length < 8) {
        setAuthError('Password must be at least 8 characters long.');
        setAuthLoading(false);
        return;
      }

      try {
        const cleanUsername = finalEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'user';
        const res = await authService.register({
          username: cleanUsername,
          email: finalEmail,
          password: loginPass,
          first_name: finalName,
          last_name: ''
        });

        if (res.requires_otp || res.success) {
          setIsVerifyingOtp(true);
          setOtpEmail(finalEmail);
          setOtpDigits(['', '', '', '', '', '']);
          setResendCooldown(res.cooldown_seconds || 60);
          setOtpError(null);
          setOtpSuccess(`A 6-digit verification code has been dispatched to ${finalEmail}.`);
          setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
        } else {
          setAuthError(res.error || res.message || 'Registration failed. Please try again.');
        }
      } catch (err: any) {
        const data = err?.response?.data;
        setAuthError(data?.message || data?.error || err?.message || 'An error occurred during registration.');
      } finally {
        setAuthLoading(false);
      }
    } else {
      try {
        const res = await authService.login({
          username: finalEmail,
          email: finalEmail,
          password: loginPass
        });

        if (res.success || res.access || res.user) {
          if (res.access) {
            setAuthTokens(res.access, res.refresh);
          }
          const userName = res.user?.first_name ? `${res.user.first_name} ${res.user.last_name}`.trim() : (finalName || finalEmail.split('@')[0]);
          authLogin(finalEmail, 'customer', {
            name: userName,
            phone: res.user?.phone || phone,
            address: address
          });
          setEmail(finalEmail);
          setName(userName);
          setIsLoggedIn(true);
          setLoginPass('');
          setAuthError(null);

          const pendingId = localStorage.getItem('veloce_pending_wishlist_product_id');
          if (pendingId) {
            localStorage.removeItem('veloce_pending_wishlist_product_id');
            onToggleWishlist(pendingId);
          }
        } else {
          setAuthError(res.error || res.message || 'Invalid email or password. Please check your credentials.');
        }
      } catch (err: any) {
        const data = err?.response?.data;
        setAuthError(data?.error || data?.message || err?.message || 'Invalid email or password. Please check your credentials.');
      } finally {
        setAuthLoading(false);
      }
    }
  };

  const handleOtpDigitChange = (index: number, val: string) => {
    const cleanDigits = val.replace(/\D/g, '');
    if (cleanDigits.length > 1) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = cleanDigits[i] || '';
      }
      setOtpDigits(newDigits);
      setOtpError(null);
      const lastFilledIndex = Math.min(cleanDigits.length - 1, 5);
      otpInputRefs.current[lastFilledIndex]?.focus();
      if (cleanDigits.length >= 6) {
        handleVerifyOtpSubmitWithCode(newDigits.join(''));
      }
      return;
    }

    const char = cleanDigits.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);
    setOtpError(null);

    if (char && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtpSubmitWithCode = async (code: string) => {
    if (code.length !== 6) {
      setOtpError('Please enter all 6 digits of your verification code.');
      return;
    }
    setAuthLoading(true);
    setOtpError(null);
    try {
      const res = await authService.verifyOtp({ email: otpEmail, otp: code });
      if (res.success && res.user) {
        if (res.access) {
          setAuthTokens(res.access, res.refresh);
        }
        const userName = res.user.first_name ? `${res.user.first_name} ${res.user.last_name}`.trim() : (registerName || otpEmail.split('@')[0]);
        authLogin(otpEmail, 'customer', {
          name: userName,
          phone: res.user.phone || phone,
          address: address
        });
        setEmail(otpEmail);
        setName(userName);
        setIsLoggedIn(true);
        setIsVerifyingOtp(false);
        setOtpDigits(['', '', '', '', '', '']);
        setLoginPass('');

        const pendingId = localStorage.getItem('veloce_pending_wishlist_product_id');
        if (pendingId) {
          localStorage.removeItem('veloce_pending_wishlist_product_id');
          onToggleWishlist(pendingId);
        }
      } else {
        setOtpError(res.error || res.message || 'Invalid verification code.');
      }
    } catch (err: any) {
      const data = err?.response?.data;
      setOtpError(data?.error || data?.message || err?.message || 'Verification failed. Please check the code and try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || authLoading) return;
    setAuthLoading(true);
    setOtpError(null);
    setOtpSuccess(null);
    try {
      const res = await authService.resendOtp({ email: otpEmail });
      if (res.success) {
        setResendCooldown(res.cooldown_seconds || 60);
        setOtpDigits(['', '', '', '', '', '']);
        setOtpSuccess(`A fresh verification code has been dispatched to ${otpEmail}.`);
        otpInputRefs.current[0]?.focus();
      } else {
        setOtpError(res.error || res.message || 'Failed to resend code.');
      }
    } catch (err: any) {
      const data = err?.response?.data;
      setOtpError(data?.error || data?.message || err?.message || 'Unable to resend verification code.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setForgotError('Please enter a valid email address.');
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);
    try {
      const res = await api.post('/auth/forgot-password', { email: cleanEmail });
      setForgotSuccess(
        res.data?.message || 'If an account is associated with that email address, you will receive a password reset link shortly.'
      );
    } catch (err: any) {
      // Show generic message even on failure to avoid leaking user presence
      setForgotSuccess('If an account is associated with that email address, you will receive a password reset link shortly.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Filter Customer Orders
  const customerOrders = useMemo(() => {
    if (!email && !phone) return [];
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim().replace(/\D/g, '');

    return (orders || []).filter((order) => {
      if (!order) return false;
      const orderEmail = (order.customerEmail || '').trim().toLowerCase();
      const orderPhone = (order.phone || order.mpesaPhone || '').trim().replace(/\D/g, '');

      const matchesEmail = Boolean(normalizedEmail && orderEmail && orderEmail === normalizedEmail);
      const matchesPhone = Boolean(normalizedPhone && orderPhone && orderPhone.length >= 9 && orderPhone === normalizedPhone);

      return matchesEmail || matchesPhone;
    });
  }, [orders, email, phone]);

  const filteredOrders = useMemo(() => {
    return customerOrders.filter((order) => {
      if (!order) return false;
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesId = (order.id || '').toLowerCase().includes(query);
        const matchesProduct = (order.items || []).some((item) => (item?.name || '').toLowerCase().includes(query));
        if (!matchesId && !matchesProduct) return false;
      }
      return true;
    });
  }, [customerOrders, statusFilter, searchQuery]);

  // Statistics calculation
  const totalSpend = useMemo(() => {
    return customerOrders.reduce((sum, o) => {
      const orderTotal = o.total || o.items?.reduce((s, it) => s + it.price * it.quantity, 0) || 0;
      return sum + orderTotal;
    }, 0);
  }, [customerOrders]);

  const activeDeliveriesCount = useMemo(() => {
    return customerOrders.filter((o) => o.status === 'pending' || o.status === 'shipped').length;
  }, [customerOrders]);

  const userReturns = useMemo(() => {
    return returnRequests.filter((req) => req.customerEmail.toLowerCase() === email.toLowerCase());
  }, [returnRequests, email]);

  const wishlistProducts = useMemo(() => {
    return products.filter((p) => wishlist.includes(p.id));
  }, [products, wishlist]);

  // Copy Order ID helper
  const copyOrderId = (orderId: string) => {
    navigator.clipboard.writeText(orderId);
    setCopiedOrderId(orderId);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  // CSV Export helper
  const handleDownloadCSV = () => {
    if (filteredOrders.length === 0) return;
    const headers = ['Order ID', 'Date', 'Customer Name', 'Customer Email', 'Items', 'Total Price', 'Status', 'Payment Status'];
    const rows = filteredOrders.map((o) => [
      `"${o.id}"`,
      `"${o.date}"`,
      `"${o.customerName || name}"`,
      `"${o.customerEmail || email}"`,
      `"${o.items.map((i) => `${i.name} x${i.quantity}`).join('; ')}"`,
      `"${o.total || 0}"`,
      `"${o.status}"`,
      `"${o.paymentStatus || 'unpaid'}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ---------------------------------------------------------------------------
  // Unauthenticated State (Login / Register / OTP)
  // ---------------------------------------------------------------------------
  if (!isLoggedIn) {
    const pendingWishlistId = typeof window !== 'undefined' ? localStorage.getItem('veloce_pending_wishlist_product_id') : null;
    const pendingWishlistProduct = pendingWishlistId ? products.find((p) => p.id === pendingWishlistId) : null;

    if (isVerifyingOtp) {
      return (
        <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-4">
                <Mail className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Verify Your Email</h2>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-light leading-relaxed">
                Enter the 6-digit code sent to <strong className="font-semibold text-slate-800 dark:text-slate-200">{otpEmail}</strong>
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsVerifyingOtp(false);
                  setOtpError(null);
                  setOtpSuccess(null);
                  setOtpDigits(['', '', '', '', '', '']);
                }}
                className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium inline-flex items-center gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Change email address
              </button>
            </div>

            {otpSuccess && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{otpSuccess}</span>
              </div>
            )}

            {otpError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleVerifyOtpSubmitWithCode(otpDigits.join('')); }} className="mt-6 space-y-5">
              <div className="flex justify-center items-center gap-2">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { otpInputRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    autoFocus={idx === 0}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="h-12 w-10 sm:h-12 sm:w-11 rounded-xl text-center text-lg font-mono font-bold border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={authLoading || otpDigits.join('').length !== 6}
                className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                {authLoading ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>Verify & Continue</span>}
              </button>
            </form>

            <div className="mt-5 text-center">
              {resendCooldown > 0 ? (
                <span className="text-xs text-slate-400 font-mono">Resend available in {resendCooldown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={authLoading}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                >
                  Resend verification code
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (isForgotPassword) {
      return (
        <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
            <div className="text-center mb-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-3">
                <Key className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Reset Your Password
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-light">
                Enter your account email address and we will send you a link to reset your password.
              </p>
            </div>

            {forgotError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{forgotSuccess}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setForgotSuccess(null);
                    setForgotError(null);
                  }}
                  className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute top-3 left-3 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => {
                        setForgotEmail(e.target.value);
                        if (forgotError) setForgotError(null);
                      }}
                      placeholder="name@company.com"
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 pl-9.5 pr-4 text-xs text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-600 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-xs mt-2"
                >
                  {forgotLoading ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Send Reset Link</span>
                  )}
                </button>

                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setForgotError(null);
                    }}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Cancel and Return to Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
          {pendingWishlistProduct && (
            <div className="mb-5 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-150 dark:border-indigo-900 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-white dark:bg-slate-800 p-1 shrink-0 overflow-hidden border border-indigo-100">
                <img src={pendingWishlistProduct.imageUrl || '/placeholder-product.png'} alt={pendingWishlistProduct.name} className="h-full w-full object-cover" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{pendingWishlistProduct.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Sign in to save this product to your wishlist.</p>
              </div>
            </div>
          )}

          <div className="text-center mb-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-3">
              <User className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {isRegistering ? 'Create Your Account' : 'Welcome Back'}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-light">
              {isRegistering ? 'Sign up to track orders, manage returns, and save favorites.' : 'Sign in to access your orders, saved items, and settings.'}
            </p>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  placeholder="e.g., Sarah Vance"
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 text-xs text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-600 focus:outline-none transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email address</label>
              <div className="relative">
                <Mail className="absolute top-3 left-3 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => { setLoginEmail(e.target.value); if (authError) setAuthError(null); }}
                  placeholder="name@company.com"
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 pl-9.5 pr-4 text-xs text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Key className="absolute top-3 left-3 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={loginPass}
                  onChange={(e) => { setLoginPass(e.target.value); if (authError) setAuthError(null); }}
                  placeholder="••••••••••••"
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 pl-9.5 pr-4 text-xs text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-600 focus:outline-none transition-colors"
                />
              </div>
              {!isRegistering && (
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setForgotEmail(loginEmail);
                      setForgotSuccess(null);
                      setForgotError(null);
                    }}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline cursor-pointer font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-xs mt-2"
            >
              {authLoading ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>{isRegistering ? 'Create Account' : 'Sign In'}</span>}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-center text-xs">
            <button
              onClick={() => { setIsRegistering(!isRegistering); setAuthError(null); }}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
            >
              {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Register"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Authenticated Main User Portal
  // ---------------------------------------------------------------------------
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* =================================================================== */}
        {/* LEFT SIDEBAR NAVIGATION (Desktop Sticky) */}
        {/* =================================================================== */}
        <aside className="lg:col-span-3 xl:col-span-3 space-y-4 lg:sticky lg:top-24">
          {/* User Mini Profile Identity Card */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 shadow-xs transition-all">
            <div className="flex items-center gap-3.5">
              <div className="relative shrink-0">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-display text-lg font-bold shadow-xs">
                  {name ? name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" title="Active Account" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {name || 'Customer'}
                  </h2>
                  <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40 shrink-0">
                    <ShieldCheck className="h-2.5 w-2.5" /> Verified
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5" title={email}>
                  {email}
                </p>
              </div>
            </div>

            {/* Optional contact metadata */}
            {(phone || address) && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                {phone && (
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-slate-400">📞</span>
                    <span className="truncate">{phone}</span>
                  </div>
                )}
                {address && (
                  <div className="flex items-center gap-2 truncate" title={address}>
                    <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="truncate">{address}</span>
                  </div>
                )}
              </div>
            )}

            {/* Edit Profile Quick Action */}
            <button
              onClick={() => setIsEditingProfile(true)}
              className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2 transition-all cursor-pointer shadow-2xs"
            >
              <Edit2 className="h-3.5 w-3.5 text-slate-500" />
              <span>Edit Profile</span>
            </button>
          </div>

          {/* Side Nav Menu (Desktop) */}
          <div className="hidden lg:block rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-2 shadow-xs">
            <div className="px-3 pt-2 pb-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Account Navigation
            </div>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveDashboardTab('orders')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer text-left ${
                  activeDashboardTab === 'orders'
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className={`h-4 w-4 ${activeDashboardTab === 'orders' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                  <span>My Orders</span>
                </div>
                {customerOrders.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                    activeDashboardTab === 'orders'
                      ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {customerOrders.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveDashboardTab('wishlist')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer text-left ${
                  activeDashboardTab === 'wishlist'
                    ? 'bg-rose-50/70 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Heart className={`h-4 w-4 ${activeDashboardTab === 'wishlist' ? 'text-rose-500 fill-rose-500' : 'text-slate-400'}`} />
                  <span>Saved Wishlist</span>
                </div>
                {wishlist.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                    activeDashboardTab === 'wishlist'
                      ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {wishlist.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveDashboardTab('returns')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer text-left ${
                  activeDashboardTab === 'returns'
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <RefreshCw className={`h-4 w-4 ${activeDashboardTab === 'returns' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                  <span>Returns & Refunds</span>
                </div>
                {userReturns.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                    activeDashboardTab === 'returns'
                      ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {userReturns.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveDashboardTab('tickets')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer text-left ${
                  activeDashboardTab === 'tickets'
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LifeBuoy className={`h-4 w-4 ${activeDashboardTab === 'tickets' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                  <span>Support Desk</span>
                </div>
                {tickets.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                    activeDashboardTab === 'tickets'
                      ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {tickets.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveDashboardTab('settings')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer text-left ${
                  activeDashboardTab === 'settings'
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Settings className={`h-4 w-4 ${activeDashboardTab === 'settings' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                  <span>Account Settings</span>
                </div>
              </button>

              <button
                onClick={() => handleTrackOrder()}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 transition-all cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5">
                  <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>Track Your Order</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-blue-500" />
              </button>

              <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50/60 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </nav>
          </div>
        </aside>

        {/* =================================================================== */}
        {/* RIGHT MAIN CONTENT AREA */}
        {/* =================================================================== */}
        <main className="lg:col-span-9 xl:col-span-9 space-y-6 min-w-0">
          {/* Mobile Tab Navigation Bar (Hidden on desktop where side nav is active) */}
          <div className="lg:hidden flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px scrollbar-none">
            <button
              onClick={() => setActiveDashboardTab('orders')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeDashboardTab === 'orders'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Orders</span>
              {customerOrders.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                  {customerOrders.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveDashboardTab('wishlist')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeDashboardTab === 'wishlist'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${activeDashboardTab === 'wishlist' ? 'text-rose-500 fill-rose-500' : ''}`} />
              <span>Wishlist</span>
              {wishlist.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-mono">
                  {wishlist.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveDashboardTab('returns')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeDashboardTab === 'returns'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Returns & Refunds</span>
              {userReturns.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-mono">
                  {userReturns.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveDashboardTab('tickets')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeDashboardTab === 'tickets'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <LifeBuoy className="h-3.5 w-3.5" />
              <span>Support</span>
              {tickets.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                  {tickets.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveDashboardTab('settings')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeDashboardTab === 'settings'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Settings</span>
            </button>

            <button
              onClick={() => handleTrackOrder()}
              className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 border-transparent text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-all cursor-pointer whitespace-nowrap"
            >
              <Truck className="h-3.5 w-3.5" />
              <span>Track Orders</span>
            </button>
          </div>

          {/* Sleek KPI Metric Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <button
              onClick={() => { setActiveDashboardTab('orders'); setStatusFilter('all'); }}
              className="text-left p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Orders</span>
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <ShoppingBag className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">{customerOrders.length}</span>
                <span className="text-[11px] text-slate-400 font-mono">({formatPrice(totalSpend, currency)})</span>
              </div>
            </button>

            <button
              onClick={() => {
                const inTransitOrder = customerOrders.find((o) => o.status === 'shipped' || o.status === 'processing');
                handleTrackOrder(inTransitOrder?.id);
              }}
              className="text-left p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">In Transit</span>
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Truck className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">{activeDeliveriesCount}</span>
                <span className="text-[11px] text-slate-400">active package{activeDeliveriesCount === 1 ? '' : 's'}</span>
              </div>
            </button>

            <button
              onClick={() => setActiveDashboardTab('wishlist')}
              className="text-left p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-800 hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Saved Wishlist</span>
                <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                  <Heart className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">{wishlist.length}</span>
                <span className="text-[11px] text-slate-400">item{wishlist.length === 1 ? '' : 's'}</span>
              </div>
            </button>

            <button
              onClick={() => setActiveDashboardTab('returns')}
              className="text-left p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Returns & Claims</span>
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <RefreshCw className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">{userReturns.length}</span>
                <span className="text-[11px] text-slate-400">request{userReturns.length === 1 ? '' : 's'}</span>
              </div>
            </button>
          </div>

          {/* Global Action Banner (e.g., Reorder feedback) */}
          {reorderNotification?.show && (
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Check className="h-4 w-4" />
                </div>
                <p className="text-xs font-semibold text-indigo-950 dark:text-indigo-200">{reorderNotification.message}</p>
              </div>
              {setCurrentTab && (
                <button
                  onClick={() => setCurrentTab('checkout')}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3.5 py-1.5 transition-colors cursor-pointer shrink-0"
                >
                  Go to Cart & Checkout →
                </button>
              )}
            </div>
          )}

      {/* ----------------------------------------------------------------------- */}
      {/* 4. ORDERS TAB VIEW */}
      {/* ----------------------------------------------------------------------- */}
      {activeDashboardTab === 'orders' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Filter, Search & View Mode Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            {/* Search query box */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by order ID or product..."
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 pl-8.5 pr-7 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-600 focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(['all', 'pending', 'shipped', 'completed', 'cancelled'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === status
                      ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* View Mode Toggle & Exports */}
            <div className="flex items-center gap-2 shrink-0">
              {/* List / Cards View Toggle */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700">
                <button
                  onClick={() => setOrderViewMode('list')}
                  className={`p-1.5 rounded-md transition-all cursor-pointer ${
                    orderViewMode === 'list'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                  title="List view (Compact)"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setOrderViewMode('cards')}
                  className={`p-1.5 rounded-md transition-all cursor-pointer ${
                    orderViewMode === 'cards'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                  title="Cards view"
                >
                  <Grid className="h-3.5 w-3.5" />
                </button>
              </div>

              {filteredOrders.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleDownloadCSV}
                    className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                    title="Export orders to CSV"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-400" />
                    <span className="hidden md:inline">CSV</span>
                  </button>
                  <button
                    onClick={() => exportOrderHistoryPDF(filteredOrders, email)}
                    className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                    title="Download PDF statement"
                  >
                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                    <span className="hidden md:inline">PDF</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Orders Empty State */}
          {filteredOrders.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 mb-3">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No Orders Found</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto font-light">
                {customerOrders.length === 0
                  ? "You haven't placed any orders yet. Visit the catalog to discover products!"
                  : "No orders match your search and filter criteria. Try resetting filters."}
              </p>
              {setCurrentTab && customerOrders.length === 0 && (
                <button
                  onClick={() => setCurrentTab('store')}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-4 py-2 transition-colors cursor-pointer"
                >
                  <ShoppingBag className="h-3.5 w-3.5" /> Start Shopping
                </button>
              )}
            </div>
          ) : orderViewMode === 'list' ? (
            /* ----------------------------------------------------------------- */
            /* 4A. SLEEK HORIZONTAL LIST VIEW (Default) */
            /* ----------------------------------------------------------------- */
            <div className="space-y-2.5">
              {/* Desktop Table Header */}
              <div className="hidden xl:flex items-center justify-between px-5 py-2.5 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-150/60 dark:border-slate-800 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-28 shrink-0">Order & Date</div>
                  <div className="flex-1 pl-3.5">Items Summary</div>
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  <div className="w-32 text-center">Status</div>
                  <div className="w-24 text-right">Total</div>
                  <div className="w-48 text-right pr-1">Actions</div>
                </div>
              </div>

              {/* Order Rows */}
              {filteredOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const orderTotal = order.total || order.items.reduce((s, it) => s + it.price * it.quantity, 0);
                const totalItemCount = order.items.reduce((sum, it) => sum + it.quantity, 0);

                const statusStyles = {
                  completed: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/40',
                  shipped: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200/60 dark:border-blue-900/40',
                  pending: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/40',
                  'pending-cancellation': 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/40',
                  cancelled: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                };

                const visibleThumbnails = order.items.slice(0, 3);
                const extraItemsCount = order.items.length - visibleThumbnails.length;

                return (
                  <div
                    key={order.id}
                    className={`rounded-2xl border transition-all duration-150 overflow-hidden bg-white dark:bg-slate-900 shadow-xs ${
                      isExpanded
                        ? 'border-indigo-300 dark:border-indigo-800 ring-1 ring-indigo-500/10'
                        : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Row Main Bar */}
                    <div className="p-4 sm:p-4.5 flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 sm:gap-4">
                      {/* Left: Order ID, Date & Items Preview */}
                      <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
                        {/* Order ID & Date */}
                        <div className="shrink-0 space-y-1 min-w-[105px]">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => copyOrderId(order.id)}
                              className="inline-flex items-center gap-1 font-mono text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                              title="Click to copy full Order ID"
                            >
                              <span>#{order.id.slice(0, 10).toUpperCase()}</span>
                              {copiedOrderId === order.id ? (
                                <Check className="h-3 w-3 text-emerald-600 shrink-0" />
                              ) : (
                                <Copy className="h-3 w-3 text-slate-400 shrink-0" />
                              )}
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                            {order.date}
                          </p>
                        </div>

                        {/* Items Summary Preview */}
                        <div className="flex items-center gap-3 min-w-0 flex-1 border-l border-slate-150 dark:border-slate-800 pl-3.5">
                          {/* Thumbnails Cluster */}
                          <div className="flex items-center -space-x-2 shrink-0">
                            {visibleThumbnails.map((item, idx) => {
                              const matchedProduct = products.find((p) => p.id === item.productId);
                              const imgUrl = matchedProduct?.imageUrl || 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=100&auto=format&fit=crop&q=60';
                              return (
                                <div
                                  key={idx}
                                  className="h-8.5 w-8.5 rounded-lg bg-white dark:bg-slate-800 overflow-hidden border-2 border-white dark:border-slate-900 shadow-xs shrink-0"
                                  title={item.name}
                                >
                                  <img src={imgUrl} alt={item.name} className="h-full w-full object-cover" />
                                </div>
                              );
                            })}
                            {extraItemsCount > 0 && (
                              <div className="h-8.5 w-8.5 rounded-lg bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                                +{extraItemsCount}
                              </div>
                            )}
                          </div>

                          {/* Item Name Snippet */}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate leading-snug">
                              {order.items[0]?.name || 'Item'}
                              {order.items.length > 1 && (
                                <span className="text-slate-400 font-normal"> +{order.items.length - 1} more</span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Right: Status Badges, Total Price & Actions */}
                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2.5 xl:pt-0 border-t xl:border-t-0 border-slate-100 dark:border-slate-800/80">
                        {/* Status & Payment Badges */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize border ${statusStyles[order.status] || statusStyles.pending}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {order.status}
                          </span>

                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                            order.paymentStatus === 'paid'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/30'
                              : order.paymentStatus === 'pending_verification'
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/30'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200/50 dark:border-rose-900/30'
                          }`}>
                            {order.paymentStatus === 'paid' ? 'Paid' : order.paymentStatus === 'pending_verification' ? 'In Review' : 'Unpaid'}
                          </span>
                        </div>

                        {/* Total Price */}
                        <div className="text-right shrink-0 min-w-[85px]">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-mono whitespace-nowrap block">
                            {formatPrice(orderTotal, currency)}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleTrackOrder(order.id)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40 px-2.5 text-xs font-semibold hover:bg-blue-100/60 transition-colors cursor-pointer whitespace-nowrap"
                            title="Track live delivery status"
                          >
                            <Truck className="h-3.5 w-3.5" />
                            <span>Track</span>
                          </button>

                          {order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
                            <button
                              onClick={() => setClaimPaymentOrder(order)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 text-xs font-semibold transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                              title="Submit M-Pesa transaction confirmation"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              <span>Pay M-Pesa</span>
                            </button>
                          )}

                          <button
                            onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                            className={`inline-flex h-8 items-center gap-1 text-xs font-medium px-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
                              isExpanded
                                ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
                            }`}
                            title="Toggle order breakdown details"
                          >
                            <span>{isExpanded ? 'Hide' : 'Details'}</span>
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Accordion Expandable Details Drawer */}
                    {isExpanded && (
                      <div className="p-5 bg-slate-50/50 dark:bg-slate-800/30 space-y-4 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-150">
                        {/* Delivery Details & Order Notes Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-2xs">
                            <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1.5">
                              <MapPin className="h-3.5 w-3.5 text-indigo-600" /> Delivery Details
                            </span>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-light">
                              {order.shippingAddress || address || 'Standard doorstep delivery destination on file.'}
                            </p>
                            <p className="text-slate-400 dark:text-slate-500 text-[11px] font-mono mt-2">
                              Fulfillment Mode: {order.fulfillmentType === 'pickup' ? 'Store Pickup' : 'Courier Delivery'}
                            </p>
                          </div>

                          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-2xs">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <MessageSquare className="h-3.5 w-3.5 text-indigo-600" /> Order Notes
                              </span>
                              {editingNoteOrderId !== order.id && (
                                <button
                                  onClick={() => {
                                    setEditingNoteOrderId(order.id);
                                    setTempNoteText(order.customNote || '');
                                  }}
                                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                                >
                                  {order.customNote ? 'Edit note' : '+ Add note'}
                                </button>
                              )}
                            </div>

                            {editingNoteOrderId === order.id ? (
                              <div className="space-y-2 mt-2">
                                <textarea
                                  value={tempNoteText}
                                  onChange={(e) => setTempNoteText(e.target.value)}
                                  placeholder="Add instructions or delivery notes..."
                                  rows={2}
                                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setEditingNoteOrderId(null)}
                                    className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (onUpdateOrderNote) {
                                        const newHistory = [
                                          ...(order.notesHistory || []),
                                          {
                                            id: `note-${Date.now()}`,
                                            text: tempNoteText.trim(),
                                            timestamp: new Date().toLocaleDateString()
                                          }
                                        ];
                                        onUpdateOrderNote(order.id, tempNoteText.trim(), newHistory);
                                      }
                                      setEditingNoteOrderId(null);
                                    }}
                                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium cursor-pointer"
                                  >
                                    Save Note
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-light italic">
                                {order.customNote || 'No custom notes logged for this order.'}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Itemized Table Breakdown */}
                        <div className="border border-slate-200/70 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                            <span>Itemized Products</span>
                            <span>Line Total</span>
                          </div>
                          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                            {order.items.map((item, idx) => {
                              const matchedProduct = products.find((p) => p.id === item.productId);
                              const imgUrl = matchedProduct?.imageUrl || 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=100&auto=format&fit=crop&q=60';
                              return (
                                <div key={idx} className="p-3.5 flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-10 w-10 rounded-lg bg-slate-50 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200/60 dark:border-slate-700">
                                      <img src={imgUrl} alt={item.name} className="h-full w-full object-cover" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium text-slate-900 dark:text-white truncate">{item.name}</p>
                                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                        Qty: {item.quantity} × {formatPrice(item.price, currency)}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
                                    {formatPrice(item.price * item.quantity, currency)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Expanded Drawer Action Toolbar */}
                        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => exportSingleReceiptPDF(order)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                              title="Download PDF Receipt"
                            >
                              <FileText className="h-3.5 w-3.5 text-slate-400" />
                              <span>Receipt</span>
                            </button>

                            <button
                              onClick={() => setSelectedInvoiceOrder(order)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                              title="Download Tax Invoice"
                            >
                              <FileText className="h-3.5 w-3.5 text-slate-400" />
                              <span>Invoice</span>
                            </button>

                            <button
                              onClick={() => {
                                setSelectedPrintOrder(order);
                                setAutoPrintOnce(true);
                              }}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                              title="Print Receipt"
                            >
                              <Printer className="h-3.5 w-3.5 text-slate-400" />
                              <span>Print</span>
                            </button>

                            <button
                              onClick={() => handleReorderItems(order)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                              title="Reorder items"
                            >
                              <ShoppingCart className="h-3.5 w-3.5 text-slate-400" />
                              <span>Reorder</span>
                            </button>

                            {order.status === 'completed' && (
                              <button
                                onClick={() => setReturnOrder(order)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                              >
                                <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                                <span>Return / Exchange</span>
                              </button>
                            )}
                          </div>

                          {order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
                            <button
                              onClick={() => setClaimPaymentOrder(order)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              <span>Submit M-Pesa Code</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ----------------------------------------------------------------- */
            /* 4B. CARDS VIEW (Optional view) */
            /* ----------------------------------------------------------------- */
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const orderTotal = order.total || order.items.reduce((s, it) => s + it.price * it.quantity, 0);

                const statusStyles = {
                  completed: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/40',
                  shipped: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200/60 dark:border-blue-900/40',
                  pending: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/40',
                  'pending-cancellation': 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/40',
                  cancelled: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                };

                return (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all"
                  >
                    {/* Order Card Header */}
                    <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/80">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <button
                            onClick={() => copyOrderId(order.id)}
                            className="inline-flex items-center gap-1 font-mono text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            title="Click to copy Order ID"
                          >
                            <span>#{order.id.slice(0, 10).toUpperCase()}</span>
                            {copiedOrderId === order.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-slate-400" />}
                          </button>

                          <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                            {order.date}
                          </span>

                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize border ${statusStyles[order.status] || statusStyles.pending}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {order.status}
                          </span>

                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                            order.paymentStatus === 'paid'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/30'
                              : order.paymentStatus === 'pending_verification'
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/30'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200/50 dark:border-rose-900/30'
                          }`}>
                            {order.paymentStatus === 'paid' ? 'Paid' : order.paymentStatus === 'pending_verification' ? 'Payment in review' : 'Unpaid'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3">
                          <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-mono">
                            {formatPrice(orderTotal, currency)}
                          </span>

                          <button
                            onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <span>{isExpanded ? 'Less' : 'Details'}</span>
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Items Preview Row */}
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex flex-wrap items-center gap-3">
                        {order.items.map((item, idx) => {
                          const matchedProduct = products.find((p) => p.id === item.productId);
                          const imgUrl = matchedProduct?.imageUrl || 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=200&auto=format&fit=crop&q=60';

                          return (
                            <div key={idx} className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-150/60 dark:border-slate-800 text-xs">
                              <div className="h-9 w-9 rounded-lg bg-white dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200/60 dark:border-slate-700">
                                <img src={imgUrl} alt={item.name} className="h-full w-full object-cover" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[140px] text-[11px] leading-tight">{item.name}</p>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  Qty: {item.quantity} • {formatPrice(item.price, currency)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Action Toolbar */}
                      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleTrackOrder(order.id)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40 px-3 text-xs font-semibold hover:bg-blue-100/60 transition-colors cursor-pointer"
                          >
                            <Truck className="h-3.5 w-3.5" />
                            <span>Track Package</span>
                          </button>

                          <button
                            onClick={() => exportSingleReceiptPDF(order)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                            title="Download PDF Receipt"
                          >
                            <FileText className="h-3.5 w-3.5 text-slate-400" />
                            <span>Receipt</span>
                          </button>

                          <button
                            onClick={() => setSelectedInvoiceOrder(order)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                            title="Download Tax Invoice"
                          >
                            <FileText className="h-3.5 w-3.5 text-slate-400" />
                            <span>Invoice</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedPrintOrder(order);
                              setAutoPrintOnce(true);
                            }}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                            title="Print Receipt"
                          >
                            <Printer className="h-3.5 w-3.5 text-slate-400" />
                            <span>Print</span>
                          </button>

                          <button
                            onClick={() => handleReorderItems(order)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                            title="Reorder items"
                          >
                            <ShoppingCart className="h-3.5 w-3.5 text-slate-400" />
                            <span>Reorder</span>
                          </button>

                          {order.status === 'completed' && (
                            <button
                              onClick={() => setReturnOrder(order)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                            >
                              <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                              <span>Return / Exchange</span>
                            </button>
                          )}
                        </div>

                        {order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
                          <button
                            onClick={() => setClaimPaymentOrder(order)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>Submit M-Pesa Code</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Order Details Panel */}
                    {isExpanded && (
                      <div className="p-5 sm:p-6 bg-slate-50/50 dark:bg-slate-800/30 space-y-4 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-150">
                        {/* Delivery address & Notes */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                            <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1.5">
                              <MapPin className="h-3.5 w-3.5 text-indigo-600" /> Delivery Details
                            </span>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-light">
                              {order.shippingAddress || address || 'Standard doorstep delivery destination on file.'}
                            </p>
                            <p className="text-slate-400 dark:text-slate-500 text-[11px] font-mono mt-2">
                              Fulfillment Mode: {order.fulfillmentType === 'pickup' ? 'Store Pickup' : 'Courier Delivery'}
                            </p>
                          </div>

                          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <MessageSquare className="h-3.5 w-3.5 text-indigo-600" /> Order Notes
                              </span>
                              {editingNoteOrderId !== order.id && (
                                <button
                                  onClick={() => {
                                    setEditingNoteOrderId(order.id);
                                    setTempNoteText(order.customNote || '');
                                  }}
                                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                                >
                                  {order.customNote ? 'Edit note' : '+ Add note'}
                                </button>
                              )}
                            </div>

                            {editingNoteOrderId === order.id ? (
                              <div className="space-y-2 mt-2">
                                <textarea
                                  value={tempNoteText}
                                  onChange={(e) => setTempNoteText(e.target.value)}
                                  placeholder="Add instructions or delivery notes..."
                                  rows={2}
                                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setEditingNoteOrderId(null)}
                                    className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (onUpdateOrderNote) {
                                        const newHistory = [
                                          ...(order.notesHistory || []),
                                          {
                                            id: `note-${Date.now()}`,
                                            text: tempNoteText.trim(),
                                            timestamp: new Date().toLocaleDateString()
                                          }
                                        ];
                                        onUpdateOrderNote(order.id, tempNoteText.trim(), newHistory);
                                      }
                                      setEditingNoteOrderId(null);
                                    }}
                                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium cursor-pointer"
                                  >
                                    Save Note
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-light italic">
                                {order.customNote || 'No custom notes logged for this order.'}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Itemized Table Breakdown */}
                        <div className="border border-slate-200/70 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            Itemized Breakdown
                          </div>
                          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="p-3.5 flex items-center justify-between">
                                <div>
                                  <span className="font-medium text-slate-900 dark:text-white">{item.name}</span>
                                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                    Qty: {item.quantity} × {formatPrice(item.price, currency)}
                                  </div>
                                </div>
                                <div className="font-mono font-semibold text-slate-900 dark:text-white">
                                  {formatPrice(item.price * item.quantity, currency)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* 5. WISHLIST TAB VIEW */}
      {/* ----------------------------------------------------------------------- */}
      {activeDashboardTab === 'wishlist' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-500 fill-rose-500" /> Saved Wishlist ({wishlistProducts.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-light mt-0.5">
                Saved items are stored in your profile for quick reordering and stock updates.
              </p>
            </div>

            {wishlistProducts.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <button
                    onClick={() => setWishlistViewMode('grid')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      wishlistViewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-xs' : 'text-slate-400'
                    }`}
                    title="Grid view"
                  >
                    <Grid className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setWishlistViewMode('list')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      wishlistViewMode === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-xs' : 'text-slate-400'
                    }`}
                    title="List view"
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => setShowClearWishlistConfirm(true)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:border-rose-200 transition-colors cursor-pointer"
                >
                  Clear All
                </button>

                <button
                  onClick={() => setShowMoveAllToCartConfirm(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  Move All to Cart
                </button>
              </div>
            )}
          </div>

          {/* Confirmations */}
          {showClearWishlistConfirm && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900 flex items-center justify-between gap-3 text-xs">
              <span className="text-rose-900 dark:text-rose-300">Are you sure you want to remove all saved items from your wishlist?</span>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setShowClearWishlistConfirm(false)} className="px-3 py-1 text-slate-600 hover:text-slate-900 cursor-pointer">Cancel</button>
                <button
                  onClick={() => { onClearWishlist(); setShowClearWishlistConfirm(false); }}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium cursor-pointer"
                >
                  Clear Wishlist
                </button>
              </div>
            </div>
          )}

          {showMoveAllToCartConfirm && (
            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900 flex items-center justify-between gap-3 text-xs">
              <span className="text-indigo-900 dark:text-indigo-300">Move all {wishlistProducts.length} saved products to your active cart?</span>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setShowMoveAllToCartConfirm(false)} className="px-3 py-1 text-slate-600 hover:text-slate-900 cursor-pointer">Cancel</button>
                <button
                  onClick={() => { handleAddAllToCart(); setShowMoveAllToCartConfirm(false); }}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium cursor-pointer"
                >
                  Confirm Move
                </button>
              </div>
            </div>
          )}

          {/* Wishlist Grid / List */}
          {wishlistProducts.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 mb-3">
                <Heart className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Your Wishlist is Empty</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto font-light">
                Explore the store catalog and tap the heart icon on items you'd like to save for later!
              </p>
              {setCurrentTab && (
                <button
                  onClick={() => setCurrentTab('store')}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-4 py-2 transition-colors cursor-pointer"
                >
                  <ShoppingBag className="h-3.5 w-3.5" /> Explore Products
                </button>
              )}
            </div>
          ) : wishlistViewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {wishlistProducts.map((p) => {
                const { hasDiscount, originalPrice, discountPercent } = getProductDiscountInfo(p);
                const isOutOfStock = p.stock !== null && p.stock === 0;
                const isInCart = cart.some((item) => item.product.id === p.id);

                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all shadow-xs group"
                  >
                    <div>
                      <div className="relative aspect-square rounded-xl bg-slate-50 dark:bg-slate-800 overflow-hidden mb-3 border border-slate-100 dark:border-slate-800">
                        <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        {hasDiscount && (
                          <span className="absolute top-2 left-2 bg-rose-600 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                            -{discountPercent}%
                          </span>
                        )}
                        <button
                          onClick={() => onToggleWishlist(p.id)}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 text-slate-400 hover:text-rose-600 hover:scale-110 transition-all cursor-pointer shadow-xs"
                          title="Remove from wishlist"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 font-mono">
                        <span>{p.category}</span>
                        {isOutOfStock ? (
                          <span className="text-rose-500 font-semibold">Out of stock</span>
                        ) : (
                          <span className="text-emerald-600 font-medium">In stock</span>
                        )}
                      </div>

                      <h3 className="text-xs font-semibold text-slate-900 dark:text-white truncate" title={p.name}>
                        {p.name}
                      </h3>

                      <div className="mt-2 flex items-baseline gap-2 font-mono">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {formatPrice(p.price, currency)}
                        </span>
                        {hasDiscount && originalPrice && (
                          <span className="text-xs text-slate-400 line-through">
                            {formatPrice(originalPrice, currency)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                      <button
                        onClick={() => onAddToCart(p, 1, {})}
                        disabled={isOutOfStock}
                        className={`flex-1 h-8.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          isOutOfStock
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                            : isInCart
                            ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                        }`}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        <span>{isInCart ? 'Add Another' : 'Add to Cart'}</span>
                      </button>

                      {setCurrentTab && (
                        <button
                          onClick={() => setCurrentTab('store')}
                          className="h-8.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {wishlistProducts.map((p) => {
                const { hasDiscount, originalPrice, discountPercent } = getProductDiscountInfo(p);
                const isOutOfStock = p.stock !== null && p.stock === 0;

                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="h-14 w-14 rounded-xl bg-slate-50 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-100 dark:border-slate-800">
                        <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 uppercase font-semibold">{p.category}</span>
                        <h4 className="text-xs font-semibold text-slate-900 dark:text-white truncate">{p.name}</h4>
                        <div className="flex items-baseline gap-2 font-mono mt-0.5">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{formatPrice(p.price, currency)}</span>
                          {hasDiscount && originalPrice && (
                            <span className="text-[11px] text-slate-400 line-through">{formatPrice(originalPrice, currency)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => onAddToCart(p, 1, {})}
                        disabled={isOutOfStock}
                        className="h-8 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Add to Cart
                      </button>
                      <button
                        onClick={() => onToggleWishlist(p.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* 6. RETURNS & REFUNDS TAB VIEW */}
      {/* ----------------------------------------------------------------------- */}
      {activeDashboardTab === 'returns' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-indigo-600" /> Returns & Exchanges Center
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-light mt-0.5">
                Track warranty claims, return requests, and merchant approvals.
              </p>
            </div>

            {userReturns.length === 0 ? (
              <div className="py-14 text-center max-w-sm mx-auto">
                <div className="h-12 w-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3 mx-auto">
                  <Package className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No Return Requests</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-light mt-1 leading-relaxed">
                  To request a return or exchange, go to the <button onClick={() => setActiveDashboardTab('orders')} className="text-indigo-600 underline font-medium">Orders</button> tab and click "Return / Exchange" next to any completed order.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {userReturns.map((req) => (
                  <div key={req.id} className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded">
                          {req.id}
                        </span>
                        <span className="text-xs text-slate-400">Order: #{req.orderId.slice(0, 8).toUpperCase()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-mono">{req.dateSubmitted}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          req.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' : req.status === 'approved' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300">
                      <span className="font-medium">Returning: </span>
                      {req.items.map((i) => `${i.name} (x${i.quantity})`).join(', ')}
                    </div>

                    {req.reasonDetails && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg">
                        "{req.reasonDetails}"
                      </p>
                    )}

                    {req.adminNote && (
                      <div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-150 text-xs text-indigo-900 dark:text-indigo-200">
                        <span className="font-semibold block mb-0.5">Merchant Note:</span>
                        {req.adminNote}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* 7. SUPPORT DESK TAB VIEW */}
      {/* ----------------------------------------------------------------------- */}
      {activeDashboardTab === 'tickets' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            {!isRaisingNewTicket && !selectedTicketId && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <LifeBuoy className="h-4 w-4 text-indigo-600" /> Customer Support Center
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-light mt-0.5">
                      Need help with an order, billing, or shipping? Open a ticket below.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsRaisingNewTicket(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 cursor-pointer shadow-xs transition-colors"
                  >
                    <PlusCircle className="h-3.5 w-3.5" /> Raise Ticket
                  </button>
                </div>

                {tickets.length === 0 ? (
                  <div className="py-14 text-center max-w-sm mx-auto">
                    <HelpCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No Support Tickets</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-light mt-1">
                      Have questions or need assistance? Click "Raise Ticket" to reach out to our team.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tickets.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTicketId(t.id)}
                        className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all cursor-pointer flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{t.id}</span>
                            <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">{t.subject}</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{t.description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            t.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {t.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {isRaisingNewTicket && (
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Create Support Request</h3>
                  <button onClick={() => setIsRaisingNewTicket(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newTicketSubject.trim() || !newTicketDescription.trim()) return;
                    const id = `TCK-${Math.floor(1000 + Math.random() * 9000)}`;
                    const newTicket = {
                      id,
                      subject: newTicketSubject.trim(),
                      category: newTicketCategory,
                      priority: newTicketPriority,
                      status: 'Open',
                      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
                      description: newTicketDescription.trim(),
                      messages: [{ sender: 'user', text: newTicketDescription.trim(), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]
                    };
                    saveTickets([newTicket, ...tickets]);
                    setNewTicketSubject('');
                    setNewTicketDescription('');
                    setIsRaisingNewTicket(false);
                    setSelectedTicketId(id);
                  }}
                  className="space-y-4 text-xs"
                >
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                    <input
                      type="text"
                      required
                      value={newTicketSubject}
                      onChange={(e) => setNewTicketSubject(e.target.value)}
                      placeholder="Brief description of the issue..."
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white focus:border-indigo-600 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                      <select
                        value={newTicketCategory}
                        onChange={(e) => setNewTicketCategory(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white focus:outline-none cursor-pointer"
                      >
                        <option>Orders & Delivery</option>
                        <option>Billing & Payment</option>
                        <option>Product Inquiry</option>
                        <option>General Support</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                      <select
                        value={newTicketPriority}
                        onChange={(e) => setNewTicketPriority(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white focus:outline-none cursor-pointer"
                      >
                        <option value="low">Low - General Inquiry</option>
                        <option value="medium">Medium - Standard</option>
                        <option value="high">High - Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Detailed Message</label>
                    <textarea
                      required
                      rows={4}
                      value={newTicketDescription}
                      onChange={(e) => setNewTicketDescription(e.target.value)}
                      placeholder="Please provide complete context regarding your inquiry..."
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white focus:border-indigo-600 focus:outline-none leading-relaxed"
                    />
                  </div>

                  <button
                    type="submit"
                    className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs cursor-pointer transition-colors shadow-xs"
                  >
                    Submit Ticket
                  </button>
                </form>
              </div>
            )}

            {selectedTicketId && (
              (() => {
                const activeTicket = tickets.find((t) => t.id === selectedTicketId);
                if (!activeTicket) return null;

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <button onClick={() => setSelectedTicketId(null)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium mb-1 block">
                          ← Back to tickets
                        </button>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{activeTicket.subject}</h3>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        activeTicket.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {activeTicket.status}
                      </span>
                    </div>

                    <div className="space-y-3 min-h-[160px] max-h-[320px] overflow-y-auto p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                      {activeTicket.messages?.map((m: any, idx: number) => (
                        <div key={idx} className={`flex flex-col max-w-[85%] ${m.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                          <span className="text-[10px] text-slate-400 mb-1">{m.sender === 'user' ? 'You' : 'Support Team'} • {m.timestamp}</span>
                          <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                            m.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none'
                          }`}>
                            {m.text}
                          </div>
                        </div>
                      ))}
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!ticketReplyText.trim()) return;
                        const userMsg = { sender: 'user', text: ticketReplyText.trim(), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
                        saveTickets(tickets.map((t) => t.id === activeTicket.id ? { ...t, messages: [...t.messages, userMsg] } : t));
                        setTicketReplyText('');
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={ticketReplyText}
                        onChange={(e) => setTicketReplyText(e.target.value)}
                        placeholder="Type reply..."
                        className="h-10 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600"
                      />
                      <button type="submit" className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-xs cursor-pointer">
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* 8. ACCOUNT SETTINGS & PREFERENCES TAB VIEW */}
      {/* ----------------------------------------------------------------------- */}
      {activeDashboardTab === 'settings' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Profile Overview Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <User className="h-4 w-4 text-indigo-600" /> Personal Information
                </h3>
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                >
                  Edit Profile
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-500">Name</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{name || 'Not set'}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-500">Email</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{email}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-500">Phone</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{phone || 'Not set'}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-500">Default Address</span>
                  <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]" title={address}>
                    {address || 'Not set'}
                  </span>
                </div>
              </div>
            </div>

            {/* Display & App Preferences */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="h-4 w-4 text-indigo-600" /> Interface & Notifications
              </h3>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <div className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white block">Theme Mode</span>
                    <span className="text-slate-500 text-[11px]">Currently active workspace theme</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5">
                    {darkMode ? <Moon className="h-3.5 w-3.5 text-indigo-400" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
                    {darkMode ? 'Dark Mode' : 'Light Mode'}
                  </span>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white block">Font Scale</span>
                    <span className="text-slate-500 text-[11px]">Interface zoom scale</span>
                  </div>
                  <button
                    onClick={() => {
                      const sizes = ['small', 'normal', 'medium', 'large'];
                      const nextIndex = (sizes.indexOf(fontSize) + 1) % sizes.length;
                      onChangeFontSize(sizes[nextIndex]);
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 capitalize cursor-pointer transition-colors"
                  >
                    {fontSize}
                  </button>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white block">Wishlist Price Drop Alerts</span>
                    <span className="text-slate-500 text-[11px]">Get notified when saved items go on sale</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={wishlistPriceEnabled}
                    onChange={(e) => {
                      setWishlistPriceEnabled(e.target.checked);
                      localStorage.setItem('veloce_wishlist_price_drops_enabled', String(e.target.checked));
                    }}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </main>
      </div>

      {/* ----------------------------------------------------------------------- */}
      {/* 9. MODALS INTEGRATION */}
      {/* ----------------------------------------------------------------------- */}
      {selectedPrintOrder && (
        <OrderReceiptModal
          order={orders.find((o) => o.id === selectedPrintOrder.id) || selectedPrintOrder}
          onClose={() => { setSelectedPrintOrder(null); setAutoPrintOnce(false); }}
          autoPrint={autoPrintOnce}
          shippingStatus={selectedPrintOrder.status === 'completed' ? 'delivered' : 'processing'}
          onReorder={handleReorderItems}
          allOrders={orders}
        />
      )}

      {selectedInvoiceOrder && (
        <TaxInvoiceModal
          order={orders.find((o) => o.id === selectedInvoiceOrder.id) || selectedInvoiceOrder}
          products={products}
          onClose={() => setSelectedInvoiceOrder(null)}
        />
      )}

      <EditProfileModal
        isOpen={isEditingProfile}
        onClose={() => setIsEditingProfile(false)}
        currentProfile={{ name, email, phone, address }}
        onSaveProfile={handleSaveProfile}
      />

      {returnOrder && (
        <ReturnRequestModal
          isOpen={!!returnOrder}
          onClose={() => setReturnOrder(null)}
          order={returnOrder}
          onSubmit={(request) => {
            if (onCreateReturnRequest) onCreateReturnRequest(request);
            setActiveDashboardTab('returns');
          }}
        />
      )}

      {claimPaymentOrder && (
        <CustomerPaymentClaimModal
          isOpen={!!claimPaymentOrder}
          onClose={() => setClaimPaymentOrder(null)}
          orderId={claimPaymentOrder.id}
          orderTotal={claimPaymentOrder.total}
          customerName={claimPaymentOrder.customerName || name}
          customerEmail={claimPaymentOrder.customerEmail || email}
          customerPhone={claimPaymentOrder.phone || phone}
          currency={currency}
          onNavigateToOrders={() => { setClaimPaymentOrder(null); setActiveDashboardTab('orders'); }}
          onClaimSuccess={() => { setClaimPaymentOrder(null); setActiveDashboardTab('orders'); }}
        />
      )}
    </div>
  );
}
