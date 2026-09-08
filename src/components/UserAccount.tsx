/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { User, ShieldCheck, Mail, Key, ShoppingBag, FileText, Check, Award, Copy, Heart, Users, LogOut, Printer, RefreshCw, Clock, Truck, MapPin, ShoppingCart, Edit2, Trash2, MessageSquare, History, Plus, Calendar, Filter, Sparkles, Search, X, Download, Settings, Bell, TrendingDown, AlertCircle, Tag, Trophy, Medal, Sun, Moon, Type, ArrowRight, Navigation, Ticket, PlusCircle, LifeBuoy, Send, HelpCircle, CheckCircle, Package, Eye, List, Grid, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Order, Product, OrderStatusHistoryEntry, CartItem, ReturnRequest } from '../types';
import { formatPrice } from '../lib/currency';
import { getProductDiscountInfo } from '../utils/productUtils';
import OrderReceiptModal from './OrderReceiptModal';
import TaxInvoiceModal from './TaxInvoiceModal';
import ReturnRequestModal from './ReturnRequestModal';
import { useLanguage } from '../context/LanguageContext';

import OrderStatusModal from './OrderStatusModal';
import CourierStatusTracker from './CourierStatusTracker';
import EditProfileModal from './EditProfileModal';
import { exportSingleReceiptPDF, exportOrderHistoryPDF } from '../lib/pdfGenerator';
import { useAutoSave } from '../lib/useAutoSave';
import { authService } from '../services/api';
import { usersApi } from '../api/users';

interface UserAccountProps {
  orders: Order[];
  products: Product[];
  onAddToCart: (product: Product, quantity: number, vars: Record<string, string>) => void;
  setCurrentTab?: (tab: string) => void;
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
  returnRequests?: ReturnRequest[];
  onCreateReturnRequest?: (request: ReturnRequest) => void;
  onUpdateReturnRequestStatus?: (requestId: string, status: ReturnRequest['status'], adminNote?: string, trackingNumber?: string) => void;
}

interface CourierSimulation {
  status: 'Processing' | 'In Transit' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
  percent: number;
  courier: string;
  trackingNumber: string;
  estimatedDelivery: string;
  events: Array<{ time: string; status: string; location: string; description: string }>;
}

const getCourierTracking = (orderId: string, orderDateStr: string, orderStatus: string): CourierSimulation => {
  const parsedDate = new Date(orderDateStr);
  const orderTime = parsedDate.getTime();
  
  // Use the local time of: 2026-06-23T13:30:15-07:00 as current/reference time
  const nowTime = new Date('2026-06-23T13:30:15-07:00').getTime();
  const diffMs = nowTime - orderTime;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const dayVal = parsedDate.getDate();
  const day = String(dayVal).padStart(2, '0');

  // Couriers list
  const couriers = ["Veloce Express Cargo", "FedEx Workspace Premium", "DHL Global Precision", "UPS Red Line"];
  const courierIdx = orderId.charCodeAt(0) % couriers.length;
  const courier = couriers[courierIdx];
  const trackingNumber = `VEL-${courier.slice(0,2).toUpperCase()}-${orderId.slice(4).toUpperCase() || '1042'}`;

  if (orderStatus === 'cancelled') {
    return {
      status: 'Cancelled',
      percent: 0,
      courier,
      trackingNumber,
      estimatedDelivery: 'Shipment Voided',
      events: [
        {
          time: `${year}-${month}-${day} 12:20`,
          status: 'Canceled & Voided',
          location: 'Central Control Gateway',
          description: 'Standard ledger cancellation signed request compiled successfully.'
        }
      ]
    };
  }

  // If order status is pending or elapsed time is < 0.6 days (about 14 hours)
  if (orderStatus === 'pending' || diffDays < 0.6) {
    return {
      status: 'Processing',
      percent: 25,
      courier,
      trackingNumber,
      estimatedDelivery: 'Arriving in 3-4 business days',
      events: [
        {
          time: `${year}-${month}-${day} 16:40`,
          status: 'Crated & Structured',
          location: 'San Jose Warehouse B12',
          description: 'Item boxed with double-layered high-vis protective inserts. Assembly line signed off.'
        },
        {
          time: `${year}-${month}-${day} 11:32`,
          status: 'Order Acknowledged',
          location: 'Veloce Global Ingestion Gateway',
          description: 'Payment token approved. Dynamic physical warehouse stock reserved successfully.'
        }
      ]
    };
  }

  // If elapsed time is between 0.6 and 1.8 days
  if (diffDays >= 0.6 && diffDays < 1.8) {
    const transitDay = String(Math.min(28, dayVal + 1)).padStart(2, '0');
    return {
      status: 'In Transit',
      percent: 50,
      courier,
      trackingNumber,
      estimatedDelivery: 'Arriving in 1-2 business days',
      events: [
        {
          time: `${year}-${month}-${transitDay} 10:15`,
          status: 'In Transit',
          location: 'Fremont Consolidated Logistic Lane',
          description: 'Item transited on high-speed cargo connection. Dynamic package status healthy and safe.'
        },
        {
          time: `${year}-${month}-${day} 14:40`,
          status: 'Order Dispatched',
          location: 'Main San Jose Warehouse B12',
          description: 'Tracking labels successfully printed and bound. Physical pallet verified and passed packaging check.'
        }
      ]
    };
  }

  // If elapsed time is between 1.8 and 3.0 days
  if (diffDays >= 1.8 && diffDays < 3.0) {
    const dispatchDay = String(Math.min(28, dayVal + 1)).padStart(2, '0');
    const outDay = String(Math.min(28, dayVal + 2)).padStart(2, '0');
    return {
      status: 'Out for Delivery',
      percent: 75,
      courier,
      trackingNumber,
      estimatedDelivery: 'Delivering today by 5:00 PM',
      events: [
        {
          time: `${year}-${month}-${outDay} 08:30`,
          status: 'Out for Delivery',
          location: 'San Francisco Sortation Depot',
          description: 'Placed onto regional cargo delivery vehicle. Courier route dispatched under optimal electric transit routing.'
        },
        {
          time: `${year}-${month}-${dispatchDay} 21:05`,
          status: 'Arrived at Facility',
          location: 'San Francisco Hub (Central Node-5)',
          description: 'Local scan completed. Checked in with no physical discrepancies reported.'
        },
        {
          time: `${year}-${month}-${day} 14:40`,
          status: 'Order Dispatched',
          location: 'Main San Jose Warehouse B12',
          description: 'Tracking labels successfully printed and bound. Physical pallet verified and passed packaging check.'
        }
      ]
    };
  }

  // If elapsed time is >= 3.0 days or status is completed
  const dispatchDay = String(Math.min(28, dayVal + 1)).padStart(2, '0');
  const deliveryDay = String(Math.min(28, dayVal + 3)).padStart(2, '0');
  return {
    status: 'Delivered',
    percent: 100,
    courier,
    trackingNumber,
    estimatedDelivery: `Delivered on ${year}-${month}-${deliveryDay}`,
    events: [
      {
        time: `${year}-${month}-${deliveryDay} 14:32`,
        status: 'Delivered',
        location: 'Customer Residential Address - Signed',
        description: 'Package delivered and left in secure parcel box or handed directly to customer.'
      },
      {
        time: `${year}-${month}-${deliveryDay} 08:30`,
        status: 'Out for Delivery',
        location: 'San Francisco Sortation Depot',
        description: 'Placed onto regional cargo delivery vehicle. Courier route dispatched.'
      },
      {
        time: `${year}-${month}-${dispatchDay} 21:05`,
        status: 'In Transit',
        location: 'San Francisco Hub (Central Node-5)',
        description: 'Arrived at sorting hub. Routed for final delivery.'
      },
      {
        time: `${year}-${month}-${day} 14:40`,
        status: 'Order Dispatched',
        location: 'Main San Jose Warehouse B12',
        description: 'Tracking labels successfully printed and bound. Physical pallet verified and passed packaging check.'
      }
    ]
  };
};

export default function UserAccount({
  orders,
  products,
  onAddToCart,
  setCurrentTab,
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
  returnRequests = [],
  onCreateReturnRequest = () => {},
  onUpdateReturnRequestStatus = () => {},
}: UserAccountProps) {
  const { t } = useLanguage();
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return Boolean(localStorage.getItem('veloce_login_email') || localStorage.getItem('veloce_auth_token'));
  });
  const [email, setEmail] = useState(() => {
    return localStorage.getItem('veloce_login_email') || '';
  });
  const [password, setPassword] = useState('**************');
  const [name, setName] = useState(() => {
    return localStorage.getItem('veloce_login_name') || '';
  });
  const [phone, setPhone] = useState(() => {
    return localStorage.getItem('veloce_login_phone') || '';
  });
  const [address, setAddress] = useState(() => {
    return localStorage.getItem('veloce_login_address') || '';
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  React.useEffect(() => {
    localStorage.setItem('veloce_login_email', email);
  }, [email]);

  React.useEffect(() => {
    localStorage.setItem('veloce_login_name', name);
  }, [name]);

  React.useEffect(() => {
    localStorage.setItem('veloce_login_phone', phone);
  }, [phone]);

  React.useEffect(() => {
    localStorage.setItem('veloce_login_address', address);
  }, [address]);

  const [activeDashboardTab, setActiveDashboardTab] = useState<'orders' | 'tickets' | 'wishlist' | 'returns'>('orders');
  const userNavTabsRef = React.useRef<HTMLDivElement>(null);

  const scrollUserTabs = (direction: 'left' | 'right') => {
    if (userNavTabsRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      userNavTabsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Wishlist notification settings state
  const [wishlistEmailEnabled, setWishlistEmailEnabled] = useState(() => {
    return localStorage.getItem('veloce_wishlist_email_notifications_enabled') !== 'false';
  });
  const [wishlistPriceEnabled, setWishlistPriceEnabled] = useState(() => {
    return localStorage.getItem('veloce_wishlist_price_drops_enabled') !== 'false';
  });
  const [wishlistRestockEnabled, setWishlistRestockEnabled] = useState(() => {
    return localStorage.getItem('veloce_wishlist_restocks_enabled') !== 'false';
  });
  const [notificationEmail, setNotificationEmail] = useState(() => {
    return localStorage.getItem('veloce_wishlist_notification_email') || localStorage.getItem('veloce_login_email') || '';
  });

  // Support Tickets State - clean initial empty state
  const [tickets, setTickets] = useState<any[]>(() => {
    const saved = localStorage.getItem('customer_support_tickets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return [];
  });

  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketCategory, setNewTicketCategory] = useState('Orders & Delivery');
  const [newTicketPriority, setNewTicketPriority] = useState('medium');
  const [newTicketDescription, setNewTicketDescription] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketReplyText, setTicketReplyText] = useState('');
  const [isRaisingNewTicket, setIsRaisingNewTicket] = useState(false);

  // Hook to automatically save user account state to localStorage every 30 seconds
  useAutoSave({
    'veloce_login_email': email,
    'veloce_login_name': name,
    'customer_support_tickets': tickets,
  }, 30000, () => {
    console.log('[AutoSave] User account and ticket states saved successfully.');
  });

  // Helper to persist tickets
  const saveTickets = (updatedTickets: any[]) => {
    setTickets(updatedTickets);
    localStorage.setItem('customer_support_tickets', JSON.stringify(updatedTickets));
  };

  // Input states for form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [isRegistering, setIsRegistering] = useState(() => {
    return typeof window !== 'undefined' && localStorage.getItem('veloce_open_auth_mode') === 'register';
  });

  React.useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('veloce_open_auth_mode') === 'register') {
      setIsRegistering(true);
    }
  }, []);

  // Selected order print modal state
  const [selectedPrintOrder, setSelectedPrintOrder] = useState<Order | null>(null);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [autoPrintOnce, setAutoPrintOnce] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [returnOrder, setReturnOrder] = useState<Order | null>(null);

  // Reorder toast message state
  const [reorderNotification, setReorderNotification] = useState<{
    show: boolean;
    message: string;
    orderId: string;
  } | null>(null);

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
        rating: 5,
        reviewsCount: 0,
        reviews: [],
      };
      onAddToCart(productObj, item.quantity, item.selectedVariations);
    });

    setReorderNotification({
      show: true,
      message: `Order VL-${order.id.slice(0, 8).toUpperCase()} items successfully added to your cart.`,
      orderId: order.id,
    });

    setTimeout(() => {
      setReorderNotification((prev) => (prev?.orderId === order.id ? null : prev));
    }, 6000);
  };

  // Order Custom Note editing local state
  const [editingNoteOrderId, setEditingNoteOrderId] = useState<string | null>(null);
  const [tempNoteText, setTempNoteText] = useState<string>('');

  // Filter state for sorting/filtering order queue records
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'cancelled' | 'shipped'>('all');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [orderViewMode, setOrderViewMode] = useState<'table' | 'cards'>('table');

  // CSV Export customization states
  const [showExportSettings, setShowExportSettings] = useState(false);
  const [exportColumns, setExportColumns] = useState<Record<string, { label: string; active: boolean }>>({
    id: { label: 'Order ID', active: true },
    date: { label: 'Date', active: true },
    customerName: { label: 'Customer Name', active: true },
    customerEmail: { label: 'Customer Email', active: true },
    itemsList: { label: 'Items (Quantity)', active: true },
    totalPrice: { label: 'Total Price ($)', active: true },
    couponCode: { label: 'Coupon Code', active: true },
    status: { label: 'Status', active: true },
    customNote: { label: 'Audit Note', active: true },
  });

  // Tracking Log State mapping Order ID -> Tracking details with real-time loads
  const [trackingLogs, setTrackingLogs] = useState<Record<string, {
    loading: boolean;
    fetched: boolean;
    progressText: string;
    events: Array<{
      time: string;
      status: string;
      location: string;
      description: string;
    }>;
  }>>({});

  // Local real-time shipping status state mapping Order ID -> 'ordered' | 'processing' | 'shipped' | 'delivered'
  const [localShippingStatuses, setLocalShippingStatuses] = useState<Record<string, 'ordered' | 'processing' | 'shipped' | 'delivered'>>({});

  // Dynamic fallback generator to build realistic statusHistory if an order doesn't have it
  const getOrderStatusHistory = (order: Order) => {
    // If order already has statusHistory set, let's use it
    if (order.statusHistory && order.statusHistory.length > 0) {
      // Let's check if we have simulator override
      const simStage = localShippingStatuses[order.id];
      if (simStage) {
        // If there's a simulator override, let's reflect that in the history dynamically
        const stages: Array<'pending' | 'processing' | 'shipped' | 'delivered'> = ['pending', 'processing', 'shipped', 'delivered'];
        const currentIdx = stages.indexOf(simStage === 'ordered' ? 'pending' : simStage as any);
        const orderTime = new Date(order.date).getTime();
        const history: OrderStatusHistoryEntry[] = [];
        for (let i = 0; i <= currentIdx; i++) {
          const st = stages[i];
          let offset = 0;
          let note = '';
          if (st === 'pending') {
            offset = 0;
            note = 'Order placed and payment validated.';
          } else if (st === 'processing') {
            offset = 4 * 3600 * 1000;
            note = 'Order has been compiled and is in sorting.';
          } else if (st === 'shipped') {
            offset = 24 * 3600 * 1000;
            note = 'Dispatched from sorting hub. Package in transit.';
          } else if (st === 'delivered') {
            offset = 48 * 3600 * 1000;
            note = 'Delivered safely to recipient.';
          }
          history.push({
            status: st,
            timestamp: new Date(orderTime + offset).toISOString().replace('T', ' ').slice(0, 16),
            note
          });
        }
        return history;
      }
      return order.statusHistory;
    }

    // Fallback: build based on actual order status or simulator status
    const currentStage = localShippingStatuses[order.id] || (order.status === 'completed' ? 'delivered' : order.status === 'shipped' ? 'shipped' : 'processing');
    const stages: Array<'pending' | 'processing' | 'shipped' | 'delivered'> = ['pending', 'processing', 'shipped', 'delivered'];
    let currentIdx = stages.indexOf(currentStage === 'ordered' ? 'pending' : currentStage as any);
    if (currentIdx === -1) {
      if (order.status === 'completed') currentIdx = 3;
      else if (order.status === 'shipped') currentIdx = 2;
      else currentIdx = 1; // processing
    }

    const orderTime = new Date(order.date).getTime();
    const history: OrderStatusHistoryEntry[] = [];
    for (let i = 0; i <= currentIdx; i++) {
      const st = stages[i];
      let offset = 0;
      let note = '';
      if (st === 'pending') {
        offset = 0;
        note = 'Order placed and payment validated.';
      } else if (st === 'processing') {
        offset = 4 * 3600 * 1000;
        note = 'Order has been compiled and is in sorting.';
      } else if (st === 'shipped') {
        offset = 24 * 3600 * 1000;
        note = 'Dispatched from sorting hub. Package in transit.';
      } else if (st === 'delivered') {
        offset = 48 * 3600 * 1000;
        note = 'Delivered safely to recipient.';
      }
      history.push({
        status: st,
        timestamp: new Date(orderTime + offset).toISOString().replace('T', ' ').slice(0, 16),
        note
      });
    }

    if (order.status === 'cancelled') {
      history.push({
        status: 'cancelled',
        timestamp: new Date(orderTime + 30 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 16),
        note: 'Order has been cancelled and voided.'
      });
    } else if (order.status === 'pending-cancellation') {
      history.push({
        status: 'pending-cancellation',
        timestamp: new Date(orderTime + 2 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16),
        note: 'Cancellation requested by user.'
      });
    }

    return history;
  };

  // Confirmation state to empty the wishlist
  const [showClearWishlistConfirm, setShowClearWishlistConfirm] = useState(false);
  const [showMoveAllToCartConfirm, setShowMoveAllToCartConfirm] = useState(false);
  const [wishlistViewMode, setWishlistViewMode] = useState<'list' | 'grid'>('list');

  const handleReorder = (order: Order) => {
    // Clear cart first
    if (onClearCart) {
      onClearCart();
    }

    // Add each item to cart
    order.items.forEach((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (product) {
        onAddToCart(product, item.quantity, item.selectedVariations || {});
      } else {
        // Construct fallback product
        const fallbackProduct: Product = {
          id: item.productId,
          sku: `SKU-${item.productId.slice(0, 6).toUpperCase()}`,
          name: item.name,
          description: 'Reordered product from previous purchase',
          price: item.price,
          category: 'Reordered Items',
          tags: ['reordered'],
          type: item.type || 'physical',
          imageUrl: '',
          stock: 100,
          rating: 5,
          reviewsCount: 0,
          reviews: [],
        };
        onAddToCart(fallbackProduct, item.quantity, item.selectedVariations || {});
      }
    });

    // Redirect to checkout
    if (setCurrentTab) {
      setCurrentTab('checkout');
    }
  };

  const handleFetchTracking = (orderId: string, status: string, orderDateStr: string) => {
    // Initialise the loading sequence
    setTrackingLogs((prev) => ({
      ...prev,
      [orderId]: {
        loading: true,
        fetched: false,
        progressText: 'Establishing secure handshake with Veloce Logistics Dispatch API...',
        events: []
      }
    }));

    // Start a multi-step simulated load sequence for rich layout feedback
    setTimeout(() => {
      setTrackingLogs((prev) => {
        if (!prev[orderId]) return prev;
        return {
          ...prev,
          [orderId]: {
            ...prev[orderId],
            progressText: 'Polling terminal nodes for RFID barcode signatures... (40%)'
          }
        };
      });
    }, 450);

    setTimeout(() => {
      setTrackingLogs((prev) => {
        if (!prev[orderId]) return prev;
        return {
          ...prev,
          [orderId]: {
            ...prev[orderId],
            progressText: 'Matching secure warehouse ledger tracking coordinates... (78%)'
          }
        };
      });
    }, 900);

    setTimeout(() => {
      const simulation = getCourierTracking(orderId, orderDateStr, status);

      setTrackingLogs((prev) => ({
        ...prev,
        [orderId]: {
          loading: false,
          fetched: true,
          progressText: 'Sync Completed.',
          events: simulation.events
        }
      }));
    }, 1400);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail) return;
    const finalEmail = loginEmail.trim();
    const finalName = isRegistering ? (registerName.trim() || finalEmail.split('@')[0]) : (name || finalEmail.split('@')[0]);

    localStorage.setItem('veloce_login_email', finalEmail);
    localStorage.setItem('veloce_login_name', finalName);
    localStorage.removeItem('veloce_open_auth_mode');

    setEmail(finalEmail);
    setName(finalName);
    setIsLoggedIn(true);

    try {
      if (isRegistering) {
        await authService.register({
          username: finalEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'user',
          email: finalEmail,
          password: loginPass || 'Password123!',
          first_name: finalName,
          last_name: ''
        });
      } else {
        await authService.login({
          username: finalEmail,
          email: finalEmail,
          password: loginPass
        });
      }
    } catch (err: any) {
      console.warn('[UserAccount] Backend auth registration/login notification:', err);
    }

    // Auto-save pending wishlist product upon registration/login
    const pendingId = localStorage.getItem('veloce_pending_wishlist_product_id');
    if (pendingId) {
      localStorage.removeItem('veloce_pending_wishlist_product_id');
      onToggleWishlist(pendingId);
    }
  };

  const handleSaveProfile = async (updatedProfile: { name: string; email: string; phone: string; address: string }) => {
    setName(updatedProfile.name);
    setEmail(updatedProfile.email);
    setPhone(updatedProfile.phone);
    setAddress(updatedProfile.address);

    localStorage.setItem('veloce_login_name', updatedProfile.name);
    localStorage.setItem('veloce_login_email', updatedProfile.email);
    localStorage.setItem('veloce_login_phone', updatedProfile.phone);
    localStorage.setItem('veloce_login_address', updatedProfile.address);

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
    localStorage.removeItem('veloce_login_email');
    localStorage.removeItem('veloce_login_name');
    localStorage.removeItem('veloce_auth_token');
    localStorage.removeItem('veloce_pending_wishlist_product_id');
    localStorage.removeItem('veloce_open_auth_mode');
    setEmail('');
    setName('');
    setIsLoggedIn(false);
  };

  const handleAddAllToCart = () => {
    const savedProducts = products.filter((p) => wishlist.includes(p.id));
    if (savedProducts.length === 0) return;

    savedProducts.forEach((p) => {
      onAddToCart(p, 1, {});
    });

    setReorderNotification({
      show: true,
      message: `Successfully added all ${savedProducts.length} saved item(s) to your shopping cart!`,
      orderId: 'wishlist-bulk-add',
    });

    setTimeout(() => {
      setReorderNotification((prev) => (prev?.orderId === 'wishlist-bulk-add' ? null : prev));
    }, 6000);
  };

  if (!isLoggedIn) {
    const pendingWishlistId = typeof window !== 'undefined' ? localStorage.getItem('veloce_pending_wishlist_product_id') : null;
    const pendingWishlistProduct = pendingWishlistId ? products.find((p) => p.id === pendingWishlistId) : null;

    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6 font-sans">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm md:p-8">
          
          {/* Informative Pending Wishlist Banner */}
          {pendingWishlistProduct && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 flex items-center gap-3.5 shadow-3xs animate-in fade-in slide-in-from-top-2">
              <div className="relative h-12 w-12 rounded-lg bg-white dark:bg-slate-800 p-1 shrink-0 overflow-hidden border border-amber-200/80">
                <img
                  src={pendingWishlistProduct.images?.[0] || pendingWishlistProduct.imageUrl || '/placeholder-product.png'}
                  alt={pendingWishlistProduct.name}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                  <Heart className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                  Save Item to Wishlist
                </div>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                  {pendingWishlistProduct.name}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  {isRegistering
                    ? 'Register your account below and this item will be automatically saved to your wishlist!'
                    : 'Sign in to your account to automatically save this item.'}
                </p>
              </div>
            </div>
          )}

          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50">
              <User className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="mt-4 font-display text-xl font-bold text-slate-900 dark:text-white">
              {isRegistering ? 'Register Customer Account' : 'Sign in to your account'}
            </h2>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-light">
              {isRegistering
                ? 'Create a free account to save items to your wishlist, manage orders, and track deliveries.'
                : 'Sign in to access your saved wishlist, orders, and support tickets.'}
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="mt-8 flex flex-col gap-4">
            {isRegistering && (
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1 font-mono">Your Full Name</label>
                <input
                  type="text"
                  required
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  placeholder="e.g., Sarah Vance"
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-normal text-slate-900 dark:text-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none bg-white dark:bg-slate-800"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1 font-mono">Email address</label>
              <div className="relative">
                <Mail className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 pl-9 pr-4 text-xs font-normal text-slate-900 dark:text-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1 font-mono">Password</label>
              <div className="relative">
                <Key className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="••••••••••••"
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 pl-9 pr-4 text-xs font-normal text-slate-900 dark:text-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-2 h-10 w-full rounded-xl bg-indigo-600 font-semibold text-xs text-white transition-colors hover:bg-indigo-700 cursor-pointer shadow-xs"
            >
              {isRegistering ? 'Create Customer Account & Continue' : 'Sign In & Continue'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs">
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
            >
              {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Register Here"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filtered orders array computed based on status selection, date range, and search query
  const filteredOrders = orders.filter((order) => {
    // 1. Status Filter
    if (statusFilter !== 'all' && order.status !== statusFilter) {
      return false;
    }

    // 2. Date Range Filter
    if (order.date) {
      const orderDateOnly = order.date.split(' ')[0]; // Extract YYYY-MM-DD
      if (startDateFilter && orderDateOnly < startDateFilter) {
        return false;
      }
      if (endDateFilter && orderDateOnly > endDateFilter) {
        return false;
      }
    }

    // 3. Search Query Filter (Order ID or Product Name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesId = order.id.toLowerCase().includes(query);
      const matchesProduct = order.items.some((item) =>
        item.name.toLowerCase().includes(query)
      );
      if (!matchesId && !matchesProduct) {
        return false;
      }
    }

    return true;
  });

  const activeSelectedOrderId = selectedOrderId || filteredOrders[0]?.id || null;

  const handleDownloadCSV = () => {
    if (filteredOrders.length === 0) return;

    // Get selected column keys in order
    const selectedKeys = Object.keys(exportColumns).filter(key => exportColumns[key].active);

    if (selectedKeys.length === 0) {
      alert("Please select at least one column to export!");
      return;
    }

    // Create headers based on active selection
    const headers = selectedKeys.map(key => exportColumns[key].label);

    // Create rows
    const rows = filteredOrders.map((order) => {
      // Escape quotes and commas in text values for CSV safety
      const escapeCsvValue = (val: string | number | undefined | null) => {
        if (val === undefined || val === null) return '';
        const stringified = String(val);
        if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
          return `"${stringified.replace(/"/g, '""')}"`;
        }
        return stringified;
      };

      const totalPrice = order.total || order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const itemsStr = order.items
        .map((item) => `${item.name} x${item.quantity}`)
        .join('; ');

      const columnValues: Record<string, string> = {
        id: escapeCsvValue(order.id),
        date: escapeCsvValue(order.date),
        customerName: escapeCsvValue(order.customerName),
        customerEmail: escapeCsvValue(order.customerEmail),
        itemsList: escapeCsvValue(itemsStr),
        totalPrice: escapeCsvValue(totalPrice.toFixed(2)),
        couponCode: escapeCsvValue(order.couponCode || 'None'),
        status: escapeCsvValue(order.status),
        customNote: escapeCsvValue(order.customNote || '')
      };

      return selectedKeys.map(key => columnValues[key]);
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(','))
    ].join('\n');

    // Create blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `order_history_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Active user portal
  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 py-8 sm:px-6 lg:px-8 font-sans">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-100 dark:border-gray-800 pb-5 gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-semibold text-gray-900 dark:text-white">Customer Portal</h1>
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Verified Customer
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-extralight mt-1 leading-relaxed">
            Hello, {name}. Manage orders, support tickets, and parcel tracking. You have <strong className="text-rose-600 font-semibold">{wishlist.length} item{wishlist.length === 1 ? '' : 's'}</strong> on your wishlist.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end md:self-start shrink-0">
          {wishlist.length > 0 && (
            <button
              onClick={() => setActiveDashboardTab('wishlist')}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-rose-100 bg-rose-50/50 hover:bg-rose-50 px-3 text-xs font-medium text-rose-700 transition-colors cursor-pointer shadow-3xs"
              title="View Wishlist Tab"
            >
              <Heart className="h-3.5 w-3.5 fill-current text-rose-500 animate-pulse" />
              <span>Wishlist ({wishlist.length})</span>
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-955/20 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </div>



      {reorderNotification?.show && (
        <div className="mt-4 rounded-lg bg-indigo-50 border border-indigo-150 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start sm:items-center gap-2.5">
            <span className="shrink-0 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 p-1">
              <Check className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-indigo-950">{reorderNotification.message}</p>
              <p className="text-[10px] text-indigo-650 mt-0.5 font-light">
                {reorderNotification.orderId === 'wishlist-bulk-add'
                  ? 'All of your saved products have been successfully prepared and loaded into your cart.'
                  : 'The items from this past order have been appended to your active shopping cart.'}
              </p>
            </div>
          </div>
          {setCurrentTab && (
            <button
              onClick={() => setCurrentTab('checkout')}
              className="shrink-0 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-3.5 py-1.5 transition-colors uppercase font-sans tracking-wide cursor-pointer"
            >
              Go to Cart & Checkout
            </button>
          )}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: General Profile and refer tracker code */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Main User Card */}
          <div className="rounded-xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-5 shadow-3xs transition-all hover:border-indigo-200 dark:hover:border-indigo-900/60">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-indigo-600 flex items-center justify-center font-display font-bold text-white shadow-xs">
                {name.charAt(0)}
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">{name}</h3>
                <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono block">{email}</span>
              </div>
            </div>

            <div className="mt-5 border-t border-gray-100 dark:border-gray-850 pt-4 flex flex-col gap-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400 dark:text-gray-500 font-normal">Secured Node:</span>
                <span className="font-mono text-gray-900 dark:text-gray-200 font-bold flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> VERIFIED</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 dark:text-gray-500 font-normal">Phone:</span>
                <span className="font-mono text-gray-900 dark:text-gray-200 font-bold">{phone}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-400 dark:text-gray-500 font-normal shrink-0">Address:</span>
                <span className="font-mono text-gray-900 dark:text-gray-200 font-bold text-right truncate max-w-[150px]" title={address}>{address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 dark:text-gray-500 font-normal">Registration Date:</span>
                <span className="font-mono text-gray-800 dark:text-gray-300">2026-05-27 (Today)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 dark:text-gray-500 font-normal">Active Theme (stored):</span>
                <span className="font-mono text-[10px] font-bold inline-flex items-center gap-1 bg-indigo-50/70 dark:bg-gray-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-100/40 dark:border-gray-800">
                  {darkMode ? (
                    <>
                      <Moon className="h-3 w-3 text-indigo-400 shrink-0" /> Dark Mode
                    </>
                  ) : (
                    <>
                      <Sun className="h-3 w-3 text-amber-500 shrink-0" /> Light Mode
                    </>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 dark:text-gray-500 font-normal">Interface Zoom (cached):</span>
                <button
                  onClick={() => {
                    const sizes = ['small', 'normal', 'medium', 'large', 'extra-large'];
                    const currentIndex = sizes.indexOf(fontSize);
                    const nextIndex = (currentIndex + 1) % sizes.length;
                    onChangeFontSize(sizes[nextIndex]);
                  }}
                  className="font-mono text-[10px] font-bold inline-flex items-center gap-1 bg-indigo-50/70 dark:bg-gray-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-100/40 dark:border-gray-800 hover:bg-indigo-100/80 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  title="Click to cycle app text sizes"
                >
                  <Type className="h-3 w-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="capitalize">{fontSize}</span>
                </button>
              </div>
              <div className="flex justify-between items-center pt-2 mt-1 border-t border-dashed border-gray-100 dark:border-gray-800">
                <span className="text-gray-400 dark:text-gray-500 font-normal flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500/10" /> Wishlist Items:
                </span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded text-[10px] border border-rose-100 dark:border-rose-900/30">
                  {wishlist.length} item{wishlist.length === 1 ? '' : 's'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsEditingProfile(true)}
                className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-3xs hover:scale-101 cursor-pointer transition-all"
              >
                <Settings className="h-3.5 w-3.5" /> Edit Profile Details
              </button>
            </div>
          </div>

              {/* Real-Time Parcel Logistics Tracker */}
              <div className="rounded-md border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-gray-950 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200 flex items-center gap-1.5 mb-2 font-mono">
                  <Truck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Live Parcel Tracking
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-extralight leading-relaxed mb-4">
                  Monitor routing status, carrier dispatch nodes, and estimated delivery dates for your proprietary orders.
                </p>

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const orderIdVal = fd.get('trackOrderId') as string;
                    if (orderIdVal && orderIdVal.trim()) {
                      setTrackingOrderId(orderIdVal.trim());
                      setIsTrackingModalOpen(true);
                      // Reset form field
                      e.currentTarget.reset();
                    }
                  }} 
                  className="flex flex-col gap-2.5"
                >
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      type="text"
                      name="trackOrderId"
                      placeholder="Enter Order ID (e.g. VEL-...)"
                      className="h-10 sm:h-8 w-full min-h-[44px] sm:min-h-0 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 pl-8.5 pr-2 text-xs font-mono focus:border-indigo-500 focus:outline-none text-gray-800 dark:text-gray-200"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="h-10 sm:h-8 min-h-[44px] sm:min-h-0 w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Navigation className="h-3.5 w-3.5" /> Search Cargo Status
                  </button>
                </form>

                {orders.length > 0 && (
                  <div className="mt-4 pt-3.5 border-t border-gray-100 dark:border-gray-800/80">
                    <span className="block text-[8px] font-mono font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                      Quick Track Active Shipments
                    </span>
                    <div className="space-y-1.5">
                      {orders.slice(0, 3).map((order) => (
                        <button
                          key={order.id}
                          onClick={() => {
                            setTrackingOrderId(order.id);
                            setIsTrackingModalOpen(true);
                          }}
                          className="w-full text-left flex items-center justify-between p-1.5 rounded bg-gray-50 dark:bg-gray-900/60 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 border border-gray-100 dark:border-gray-800/60 text-[11px] transition-colors cursor-pointer group"
                        >
                          <span className="font-mono font-semibold text-gray-800 dark:text-gray-200 group-hover:text-indigo-650 dark:group-hover:text-indigo-400">
                            {order.id.toUpperCase()}
                          </span>
                          <span className="text-[9px] font-mono text-gray-400 dark:text-gray-500 flex items-center gap-1">
                            Track <ArrowRight className="h-2.5 w-2.5" />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

        {/* Right Side: Active orders, Affiliate Center, or Support Tickets */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Main Dashboard Segmented Tabs */}
          <div className="relative group/usertabs">
            {/* Left Scroll Arrow */}
            <button
              type="button"
              onClick={() => scrollUserTabs('left')}
              className="absolute left-1 top-1/2 -translate-y-1/2 z-20 h-7 w-7 bg-white/95 dark:bg-gray-800/95 text-gray-700 dark:text-gray-200 rounded-full shadow-md border border-gray-200 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-gray-700 cursor-pointer flex items-center justify-center transition-all opacity-80 hover:opacity-100 focus:outline-hidden"
              title="Scroll tabs left"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            <div 
              ref={userNavTabsRef}
              className="bg-gray-100 dark:bg-gray-900/40 p-1.5 px-8 rounded-xl flex items-center gap-1.5 custom-tab-scroll border border-gray-200/40 dark:border-gray-800/45 shadow-3xs"
            >
              <button
                type="button"
                onClick={() => setActiveDashboardTab('orders')}
                className={`shrink-0 min-w-max flex items-center justify-center gap-2 py-2 px-3.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  activeDashboardTab === 'orders'
                    ? 'bg-white dark:bg-gray-950 text-indigo-600 dark:text-indigo-400 shadow-3xs border border-gray-150 dark:border-gray-850/60 font-bold'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/45 dark:hover:bg-gray-950/20'
                }`}
              >
                <ShoppingBag className="h-4 w-4" />
                <span>Orders & Spend</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveDashboardTab('tickets')}
                className={`shrink-0 min-w-max flex items-center justify-center gap-2 py-2 px-3.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  activeDashboardTab === 'tickets'
                    ? 'bg-white dark:bg-gray-950 text-indigo-600 dark:text-indigo-400 shadow-3xs border border-gray-150 dark:border-gray-850/60 font-bold'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/45 dark:hover:bg-gray-950/20'
                }`}
              >
                <Ticket className="h-4 w-4" />
                <span>Support Desk</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveDashboardTab('wishlist')}
                className={`shrink-0 min-w-max flex items-center justify-center gap-1.5 py-2 px-3.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  activeDashboardTab === 'wishlist'
                    ? 'bg-white dark:bg-gray-950 text-indigo-600 dark:text-indigo-400 shadow-3xs border border-gray-150 dark:border-gray-850/60 font-bold'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/45 dark:hover:bg-gray-950/20'
                }`}
              >
                <Heart className={`h-4 w-4 ${activeDashboardTab === 'wishlist' ? 'text-rose-500 fill-rose-500' : 'text-gray-400 hover:text-rose-500'}`} />
                <span>My Wishlist</span>
                {products.filter((p) => wishlist.includes(p.id)).length > 0 && (
                  <span className="text-[9px] bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-extrabold px-1.5 py-0.2 rounded-full font-mono ml-0.5">
                    {products.filter((p) => wishlist.includes(p.id)).length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveDashboardTab('returns')}
                className={`shrink-0 min-w-max flex items-center justify-center gap-1.5 py-2 px-3.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  activeDashboardTab === 'returns'
                    ? 'bg-white dark:bg-gray-950 text-indigo-600 dark:text-indigo-400 shadow-3xs border border-gray-150 dark:border-gray-850/60 font-bold'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/45 dark:hover:bg-gray-950/20'
                }`}
              >
                <RefreshCw className={`h-4 w-4 ${activeDashboardTab === 'returns' ? 'text-indigo-550' : 'text-gray-400'}`} />
                <span>Returns</span>
                {returnRequests.filter(req => req.customerEmail === email).length > 0 && (
                  <span className="text-[9px] bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-extrabold px-1.5 py-0.2 rounded-full font-mono ml-0.5">
                    {returnRequests.filter(req => req.customerEmail === email).length}
                  </span>
                )}
              </button>
            </div>

            {/* Right Scroll Arrow */}
            <button
              type="button"
              onClick={() => scrollUserTabs('right')}
              className="absolute right-1 top-1/2 -translate-y-1/2 z-20 h-7 w-7 bg-white/95 dark:bg-gray-800/95 text-gray-700 dark:text-gray-200 rounded-full shadow-md border border-gray-200 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-gray-700 cursor-pointer flex items-center justify-center transition-all opacity-80 hover:opacity-100 focus:outline-hidden"
              title="Scroll tabs right"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {activeDashboardTab === 'orders' && (
            <>
          {/* Order history */}
          <div className="rounded-xl border border-gray-100 dark:border-gray-850 bg-white dark:bg-gray-950 p-5">
            <div className="flex flex-col gap-4 pb-4 border-b border-gray-100 dark:border-gray-850 mb-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <ShoppingBag className="h-4.5 w-4.5 text-gray-400" /> Proprietary Orders Log
                  </h3>
                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 p-0.5 rounded-lg border border-gray-200 dark:border-gray-800">
                    <button
                      onClick={() => setOrderViewMode('table')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                        orderViewMode === 'table'
                          ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-3xs font-bold'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                      }`}
                      title="Display orders in structured table format"
                    >
                      <List className="h-3.5 w-3.5" />
                      <span>Table View</span>
                    </button>
                    <button
                      onClick={() => setOrderViewMode('cards')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                        orderViewMode === 'cards'
                          ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-3xs font-bold'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                      }`}
                      title="Display orders in card grid format"
                    >
                      <Grid className="h-3.5 w-3.5" />
                      <span>Cards View</span>
                    </button>
                  </div>
                </div>
                {filteredOrders.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setShowExportSettings(!showExportSettings)}
                      className={`inline-flex min-h-[44px] sm:min-h-0 h-11 sm:h-8 items-center gap-1.5 rounded border px-3 text-[11px] font-semibold transition-all cursor-pointer ${
                        showExportSettings
                          ? 'border-indigo-300 dark:border-indigo-850 bg-indigo-55/10 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-450 hover:bg-gray-50'
                      }`}
                      title="Select which specific columns are included in downloaded CSV"
                    >
                      <Settings className="h-3.5 w-3.5 text-gray-400" /> Configure CSV
                    </button>
                    <button
                      onClick={handleDownloadCSV}
                      className="inline-flex min-h-[44px] sm:min-h-0 h-11 sm:h-8 items-center gap-1.5 rounded border border-gray-205 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 px-3 text-xs font-semibold text-indigo-650 dark:text-indigo-401 hover:text-indigo-850 transition-all shadow-5xs cursor-pointer"
                      title="Export currently filtered orders to CSV"
                    >
                      <Download className="h-3.5 w-3.5" /> Export CSV
                    </button>
                    <button
                      onClick={() => exportOrderHistoryPDF(filteredOrders, email)}
                      className="inline-flex min-h-[44px] sm:min-h-0 h-11 sm:h-8 items-center gap-1.5 rounded border border-indigo-205 dark:border-indigo-800 bg-white dark:bg-gray-900 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 px-3 text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 transition-all shadow-5xs cursor-pointer"
                      title="Export currently filtered order history to a PDF Report"
                    >
                      <FileText className="h-3.5 w-3.5 text-indigo-500" /> Export History PDF
                    </button>
                    <button
                      onClick={() => {
                        const currentSelectedOrder = orders.find((o) => o.id === activeSelectedOrderId) || filteredOrders[0];
                        if (currentSelectedOrder) {
                          exportSingleReceiptPDF(currentSelectedOrder);
                        }
                      }}
                      className="inline-flex min-h-[44px] sm:min-h-0 h-11 sm:h-8 items-center gap-1.5 rounded border border-rose-205 dark:border-rose-900 bg-white dark:bg-gray-900 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 px-3 text-xs font-semibold text-rose-700 dark:text-rose-450 transition-all shadow-5xs cursor-pointer"
                      title="Download PDF Receipt/Invoice for the active selected order"
                      disabled={!activeSelectedOrderId}
                    >
                      <FileText className="h-3.5 w-3.5 text-rose-500" /> Download PDF Receipt
                    </button>
                    <button
                      onClick={() => {
                        const currentSelectedOrder = orders.find((o) => o.id === activeSelectedOrderId) || filteredOrders[0];
                        if (currentSelectedOrder) {
                          setSelectedPrintOrder(currentSelectedOrder);
                          setAutoPrintOnce(true);
                        }
                      }}
                      className="inline-flex min-h-[44px] sm:min-h-0 h-11 sm:h-8 items-center gap-1.5 rounded border border-gray-205 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 px-3 text-xs font-semibold text-gray-750 dark:text-gray-300 transition-all shadow-5xs cursor-pointer"
                      title="Print a cleanly formatted receipt of the specific order using window.print()"
                      disabled={!activeSelectedOrderId}
                    >
                      <Printer className="h-3.5 w-3.5 text-gray-500" /> Print Receipt
                    </button>
                  </div>
                )}
              </div>

              {/* Export Column Customization Panel */}
              {showExportSettings && filteredOrders.length > 0 && (
                <div className="bg-gray-50/30 dark:bg-gray-900/10 rounded-lg p-3.5 border border-indigo-100 dark:border-indigo-950/50 animate-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                      <Settings className="h-3.5 w-3.5 animate-spin-slow" /> Customize columns to export ({Object.keys(exportColumns).filter(k => exportColumns[k].active).length} selected)
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const updated = { ...exportColumns };
                          Object.keys(updated).forEach(k => { updated[k].active = true; });
                          setExportColumns(updated);
                        }}
                        className="text-[9px] font-extrabold text-blue-600 dark:text-blue-400 uppercase hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-gray-305 dark:text-gray-700 text-[10px] select-none">|</span>
                      <button
                        onClick={() => {
                          const updated = { ...exportColumns };
                          Object.keys(updated).forEach(k => { updated[k].active = false; });
                          setExportColumns(updated);
                        }}
                        className="text-[9px] font-extrabold text-gray-500 dark:text-gray-400 uppercase hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {Object.keys(exportColumns).map((key) => {
                      const col = exportColumns[key];
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            setExportColumns({
                              ...exportColumns,
                              [key]: { ...col, active: !col.active }
                            });
                          }}
                          className={`h-7 px-2.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
                            col.active
                              ? 'bg-indigo-600/10 border-indigo-200 text-indigo-700 dark:text-indigo-300 dark:border-indigo-900/50 font-semibold'
                              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 hover:text-gray-650'
                          }`}
                        >
                          <div className={`h-2 w-2 rounded-full ${col.active ? 'bg-indigo-650 dark:bg-indigo-400' : 'bg-gray-300 dark:bg-gray-750'}`} />
                          {col.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Advanced Filter Suite */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-gray-50/40 dark:bg-gray-900/10 p-3 rounded-lg border border-gray-100 dark:border-gray-900">
                {/* Search query box */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Order ID or item..."
                    className="h-8 w-full rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 pl-8.5 pr-8 text-xs font-medium text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Status Filter Dropdown */}
                <div className="flex items-center gap-2">
                  <label htmlFor="select-order-status-filter" className="text-[10px] font-mono font-bold text-gray-400 dark:text-gray-500 uppercase select-none">
                    Filter by Status:
                  </label>
                  <div className="relative">
                    <select
                      id="select-order-status-filter"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="h-8 rounded border border-gray-250 dark:border-gray-800 bg-white dark:bg-gray-900 pl-3 pr-8 text-xs font-semibold text-gray-750 dark:text-gray-250 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer appearance-none"
                    >
                      <option value="all">All ({orders.length})</option>
                      <option value="pending">Pending ({orders.filter(o => o.status === 'pending').length})</option>
                      <option value="shipped">Shipped ({orders.filter(o => o.status === 'shipped').length})</option>
                      <option value="completed">Completed ({orders.filter(o => o.status === 'completed').length})</option>
                      <option value="cancelled">Cancelled ({orders.filter(o => o.status === 'cancelled').length})</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 dark:text-gray-500">
                      <Filter className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Date Filters Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50/20 dark:bg-gray-900/5 rounded-md p-1.5 border border-gray-100/50 dark:border-gray-900 animate-in fade-in duration-150">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[10px] font-mono font-bold text-gray-400 dark:text-gray-500 uppercase flex items-center gap-1 select-none">
                    <Calendar className="h-3.5 w-3.5 text-indigo-550 dark:text-indigo-400" /> Created Period:
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">From</span>
                    <input
                      type="date"
                      value={startDateFilter}
                      onChange={(e) => setStartDateFilter(e.target.value)}
                      className="h-[28px] rounded border border-gray-250 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 text-[11px] font-medium text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">To</span>
                    <input
                      type="date"
                      value={endDateFilter}
                      onChange={(e) => setEndDateFilter(e.target.value)}
                      className="h-[28px] rounded border border-gray-250 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 text-[11px] font-medium text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>

                {(startDateFilter || endDateFilter || searchQuery) && (
                  <button
                    onClick={() => {
                      setStartDateFilter('');
                      setEndDateFilter('');
                      setSearchQuery('');
                    }}
                    className="h-[26px] rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 px-2 py-0 text-[10px] font-semibold text-gray-550 dark:text-gray-405 hover:text-red-655 dark:hover:text-red-400 hover:border-red-100 transition-colors cursor-pointer"
                  >
                    Reset Overrides
                  </button>
                )}
              </div>
            </div>

            {/* Live Order Tracking Quick-lookup Dashboard */}
            <div className="bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-150/40 dark:border-indigo-900/30 rounded-xl p-4 md:p-4.5 mb-5 font-sans animate-in fade-in duration-200">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <Truck className="h-4 w-4 text-indigo-600 dark:text-indigo-400 animate-pulse" /> Live Order Tracking Console
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-extralight mt-0.5 leading-relaxed">
                    Access visual, real-time logistics tracking maps, courier telemetry, and dispatch milestones. Search by Order ID or item name.
                  </p>
                </div>
                
                {/* Embedded Tracking Search Console Input */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto lg:max-w-md flex-1 justify-end">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-indigo-400/85 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search order ID or product name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8.5 w-full rounded-lg border border-indigo-150/80 dark:border-indigo-900/50 bg-white dark:bg-gray-900 pl-9 pr-8 text-xs font-medium text-gray-750 dark:text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-indigo-550/20 focus:border-indigo-550 focus:outline-none transition-all shadow-3xs"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        title="Clear search index query"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (searchQuery.trim()) {
                        const matching = orders.find(o => 
                          o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          o.items.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
                        );
                        if (matching) {
                          setTrackingOrderId(matching.id);
                        } else {
                          setTrackingOrderId(searchQuery); // Pass raw search query to try and simulate
                        }
                      } else if (orders.length > 0) {
                        setTrackingOrderId(orders[0].id);
                      }
                      setIsTrackingModalOpen(true);
                    }}
                    className="inline-flex h-8.5 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 px-4 text-xs font-semibold cursor-pointer shadow-3xs transition-all hover:scale-102 whitespace-nowrap"
                  >
                    <Truck className="h-3.5 w-3.5" /> Track Shipment
                  </button>
                </div>
              </div>

              {/* If there's a search query, show matched items inside the console dashboard */}
              {searchQuery.trim() && (
                <div className="mt-3.5 pt-3 border-t border-indigo-100/50 dark:border-indigo-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[10.5px] animate-in slide-in-from-top-1 duration-150">
                  <div className="text-gray-500 dark:text-gray-450">
                    Showing <strong className="text-indigo-950 dark:text-indigo-300 font-semibold">{filteredOrders.length}</strong> matched record{filteredOrders.length === 1 ? '' : 's'} for query "<span className="font-mono text-indigo-700 dark:text-indigo-400 font-bold">{searchQuery}</span>"
                  </div>
                  {filteredOrders.length > 0 && (
                    <div className="flex gap-1.5 items-center flex-wrap">
                      <span className="text-gray-400 text-[10px]">Instant tracker jump:</span>
                      <div className="flex flex-wrap gap-1">
                        {filteredOrders.slice(0, 3).map(o => (
                          <button
                            key={`jump-${o.id}`}
                            onClick={() => {
                              setTrackingOrderId(o.id);
                              setIsTrackingModalOpen(true);
                            }}
                            className="bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-950/50 hover:border-indigo-300 dark:hover:border-indigo-800 px-2 py-0.5 rounded font-mono text-[9px] text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50/50 transition-colors cursor-pointer"
                            title={`Jump straight to tracking visualizer for ${o.id}`}
                          >
                            {o.id}
                          </button>
                        ))}
                        {filteredOrders.length > 3 && (
                          <span className="text-gray-400 font-mono text-[9px] px-1">+{filteredOrders.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="py-12 text-center animate-in fade-in duration-200">
                <p className="text-xs text-gray-400 dark:text-gray-550 font-mono italic">
                  {orders.length === 0 
                    ? "No local orders logged yet. Visit the checkout tab to place orders!" 
                    : (startDateFilter || endDateFilter || searchQuery || statusFilter !== 'all')
                    ? "No active orders found matching your search index, status state, or date filters."
                    : `No active orders found for status: "${statusFilter}".`}
                </p>
                {(startDateFilter || endDateFilter || statusFilter !== 'all' || searchQuery) && (
                  <button
                    onClick={() => {
                      setStatusFilter('all');
                      setStartDateFilter('');
                      setEndDateFilter('');
                      setSearchQuery('');
                    }}
                    className="mt-3 inline-flex items-center gap-1 rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-750 dark:text-gray-300 cursor-pointer shadow-3xs transition-colors"
                  >
                    <Filter className="h-3 w-3 text-indigo-550" /> Reset All Filters
                  </button>
                )}
              </div>
            ) : orderViewMode === 'table' ? (
              <div className="flex flex-col gap-6">
                {/* Desktop Orders Table Format */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-3xs">
                  <table className="w-full text-left border-collapse text-xs font-sans">
                    <thead>
                      <tr className="bg-gray-50/80 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-800 text-[10.5px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono">
                        <th className="py-3.5 px-4">Order ID</th>
                        <th className="py-3.5 px-4">Date</th>
                        <th className="py-3.5 px-4">Items Summary</th>
                        <th className="py-3.5 px-4 text-right">Total Amount</th>
                        <th className="py-3.5 px-4 text-center">Status</th>
                        <th className="py-3.5 px-4 text-center">Track Order</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 dark:divide-gray-850">
                      {filteredOrders.map((order) => {
                        const isSelected = order.id === activeSelectedOrderId;
                        const totalAmount = order.total || order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
                        const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);

                        return (
                          <tr
                            key={order.id}
                            onClick={() => setSelectedOrderId(order.id)}
                            className={`transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-l-indigo-600 dark:border-l-indigo-400 font-medium'
                                : 'hover:bg-gray-50/90 dark:hover:bg-gray-900/50'
                            }`}
                          >
                            {/* Order ID */}
                            <td className="py-3.5 px-4 font-mono text-xs whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-900 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-800">
                                  {order.id.toUpperCase()}
                                </span>
                                {order.isGuest && (
                                  <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 text-[9px] font-bold px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-900/30 uppercase">
                                    GUEST
                                  </span>
                                )}
                                {isSelected && (
                                  <span className="inline-flex items-center gap-0.5 text-[8.5px] bg-indigo-600 dark:bg-indigo-500 text-white font-mono font-bold px-1.5 py-0.2 rounded uppercase tracking-wider animate-pulse">
                                    ● Viewing Status
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Date */}
                            <td className="py-3.5 px-4 text-gray-600 dark:text-gray-400 font-mono text-[11px] whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-indigo-500 shrink-0" />
                                {order.date}
                              </div>
                            </td>

                            {/* Items Summary */}
                            <td className="py-3.5 px-4 text-gray-800 dark:text-gray-200">
                              <div className="font-medium text-xs truncate max-w-[220px]" title={order.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}>
                                {order.items[0]?.name}
                                {order.items.length > 1 && (
                                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold ml-1.5 text-[11px]">
                                    +{order.items.length - 1} more
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                                {totalUnits} unit{totalUnits === 1 ? '' : 's'} ({order.items.length} SKU{order.items.length === 1 ? '' : 's'})
                              </div>
                            </td>

                            {/* Total Amount */}
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                              KSh {totalAmount.toLocaleString('en-KE')}
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 rounded px-2.5 py-0.5 font-mono text-[9.5px] font-bold uppercase border ${
                                order.status === 'completed'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40'
                                  : order.status === 'shipped'
                                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/40'
                                  : order.status === 'pending'
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40'
                                  : order.status === 'pending-cancellation'
                                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40 animate-pulse'
                                  : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40'
                              }`}>
                                ● {order.status === 'pending-cancellation' ? 'pending cancel' : order.status}
                              </span>
                            </td>

                            {/* Track Order Button */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => {
                                  setTrackingOrderId(order.id);
                                  setIsTrackingModalOpen(true);
                                }}
                                className="min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-semibold text-xs transition-all shadow-3xs hover:scale-102 cursor-pointer"
                                title={`Track order ${order.id} shipment`}
                              >
                                <Truck className="h-3.5 w-3.5" />
                                <span>Track Order</span>
                              </button>
                            </td>

                            {/* Actions Column */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setSelectedOrderId(order.id)}
                                  className={`min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-1 px-3 py-2 sm:py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-3xs'
                                      : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                                  }`}
                                  title="Select order to view status timeline & details"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>{isSelected ? 'Viewing' : 'View Status'}</span>
                                </button>
                                <button
                                  onClick={() => exportSingleReceiptPDF(order)}
                                  className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-2 sm:p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer flex items-center justify-center"
                                  title="Download PDF Receipt"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Stacked Card View (Dual-Mode Mobile Layout) */}
                <div className="block md:hidden space-y-3">
                  {filteredOrders.map((order) => {
                    const isSelected = order.id === activeSelectedOrderId;
                    const totalAmount = order.total || order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
                    const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);

                    return (
                      <div
                        key={order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        className={`rounded-2xl border p-4 transition-all cursor-pointer space-y-3 ${
                          isSelected
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/30'
                            : 'bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-850 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-900 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-800">
                              {order.id.toUpperCase()}
                            </span>
                            {order.isGuest && (
                              <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 text-[9px] font-bold px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-900/30 uppercase">
                                GUEST
                              </span>
                            )}
                          </div>
                          <span className={`inline-flex items-center gap-1 rounded px-2.5 py-1 font-mono text-[10px] font-bold uppercase border ${
                            order.status === 'completed'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40'
                              : order.status === 'shipped'
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/40'
                              : order.status === 'pending'
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40'
                              : order.status === 'pending-cancellation'
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40 animate-pulse'
                              : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40'
                          }`}>
                            ● {order.status === 'pending-cancellation' ? 'pending cancel' : order.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-400 text-[9px] font-mono uppercase block">Date</span>
                            <span className="font-mono text-gray-700 dark:text-gray-300 font-semibold">{order.date}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 text-[9px] font-mono uppercase block">Total Value</span>
                            <span className="font-mono font-bold text-gray-900 dark:text-gray-100">KSh {totalAmount.toLocaleString('en-KE')}</span>
                          </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-900/40 p-2.5 rounded-xl border border-gray-100 dark:border-gray-850 text-xs">
                          <span className="text-gray-400 text-[9px] font-mono uppercase block mb-1">Items ({totalUnits} units)</span>
                          <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{order.items[0]?.name}</p>
                          {order.items.length > 1 && (
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold text-[11px] block mt-0.5">
                              +{order.items.length - 1} additional SKU(s)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setTrackingOrderId(order.id);
                              setIsTrackingModalOpen(true);
                            }}
                            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-2xs cursor-pointer"
                          >
                            <Truck className="h-4 w-4" />
                            <span>Track Parcel</span>
                          </button>
                          <button
                            onClick={() => setSelectedOrderId(order.id)}
                            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-bold text-xs cursor-pointer"
                          >
                            <Eye className="h-4 w-4" />
                            <span>{isSelected ? 'Viewing' : 'Details'}</span>
                          </button>
                          <button
                            onClick={() => exportSingleReceiptPDF(order)}
                            className="min-h-[44px] min-w-[44px] p-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-rose-600 dark:text-rose-400 flex items-center justify-center cursor-pointer"
                            title="Download Receipt"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Order Status & Fulfillment Console */}
                {(() => {
                  const selectedOrder = orders.find((o) => o.id === activeSelectedOrderId) || filteredOrders[0];
                  if (!selectedOrder) return null;

                  const totalAmount = selectedOrder.total || selectedOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
                  const simulation = getCourierTracking(selectedOrder.id, selectedOrder.date, selectedOrder.status);

                  return (
                    <div className="rounded-xl border-2 border-indigo-500/30 dark:border-indigo-500/40 bg-white dark:bg-gray-950 p-5 md:p-6 shadow-sm transition-all animate-in fade-in duration-200">
                      {/* Header */}
                      <div className="flex flex-wrap items-center justify-between border-b border-gray-150 dark:border-gray-850 pb-4 gap-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-sm font-bold text-gray-900 dark:text-gray-100 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-800">
                            ORDER #{selectedOrder.id.toUpperCase()}
                          </span>
                          <span className={`rounded-md px-2.5 py-1 font-mono text-xs font-bold uppercase border ${
                            selectedOrder.status === 'completed'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40'
                              : selectedOrder.status === 'shipped'
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/40'
                              : selectedOrder.status === 'pending'
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40'
                              : selectedOrder.status === 'pending-cancellation'
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40 animate-pulse'
                              : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40'
                          }`}>
                            ● {selectedOrder.status === 'pending-cancellation' ? 'pending cancel' : selectedOrder.status}
                          </span>
                          {selectedOrder.isGuest && (
                            <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                              GUEST
                            </span>
                          )}
                          <span className="text-gray-400 text-xs font-mono ml-2">Date Placed: {selectedOrder.date}</span>
                        </div>

                        {/* Top Action Buttons for Selected Order */}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => {
                              setTrackingOrderId(selectedOrder.id);
                              setIsTrackingModalOpen(true);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold text-xs shadow-3xs transition-all hover:scale-102 cursor-pointer"
                            title="Open full shipment tracking modal"
                          >
                            <Truck className="h-4 w-4" />
                            <span>Track Order Shipment</span>
                          </button>

                          {selectedOrder.status === 'pending' && (
                            <button
                              onClick={() => {
                                if (onUpdateOrderStatus) {
                                  onUpdateOrderStatus(selectedOrder.id, 'pending-cancellation');
                                }
                              }}
                              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-rose-250 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100 text-xs font-bold transition-all cursor-pointer"
                            >
                              Request Cancellation
                            </button>
                          )}

                          {selectedOrder.status === 'completed' && (
                            (() => {
                              const existingReq = returnRequests.find((r) => r.orderId === selectedOrder.id);
                              if (existingReq) {
                                return (
                                  <span className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold uppercase ${
                                    existingReq.status === 'pending'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : existingReq.status === 'approved'
                                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                      : existingReq.status === 'resolved'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-red-50 text-red-700 border-red-200'
                                  }`}>
                                    Return {existingReq.status}
                                  </span>
                                );
                              }
                              return (
                                <button
                                  onClick={() => setReturnOrder(selectedOrder)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 text-xs font-bold transition-all cursor-pointer"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" /> Return / Exchange
                                </button>
                              );
                            })()
                          )}
                        </div>
                      </div>

                      {/* Live Courier API Real-Time Tracking Component */}
                      <div className="mt-5">
                        <CourierStatusTracker order={selectedOrder} />
                      </div>

                      {/* Fulfillment Journey Timeline */}
                      <div className="mt-5">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-indigo-500" /> Fulfillment Journey & Live Stage Tracker
                          </h4>
                          <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                            Current Stage: <strong className="text-indigo-600 dark:text-indigo-400 capitalize">{localShippingStatuses[selectedOrder.id] || selectedOrder.status}</strong>
                          </span>
                        </div>

                        {/* Interactive Stage Simulation Bar */}
                        <div className="bg-gray-50/70 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-150 dark:border-gray-850">
                          <div className="flex items-center justify-between text-[11px] font-mono mb-2">
                            <span className="font-semibold text-gray-500">STAGE PROGRESSION</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{simulation.percent}%</span>
                          </div>
                          <div className="h-2 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mb-4">
                            <div
                              className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-500"
                              style={{ width: `${simulation.percent}%` }}
                            />
                          </div>

                          {/* Order Status History Stages */}
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                            {(() => {
                              const history = getOrderStatusHistory(selectedOrder);
                              const stages = [
                                { id: 'pending', label: 'Order Placed', desc: 'Validated & Logged' },
                                { id: 'processing', label: 'Processing', desc: 'Warehouse Sorting' },
                                { id: 'shipped', label: 'In Transit', desc: 'On Courier Truck' },
                                { id: 'delivered', label: 'Delivered', desc: 'Received & Confirmed' }
                              ];

                              return stages.map((stg) => {
                                const isDone = history.some(h => h.status === stg.id);
                                return (
                                  <div
                                    key={stg.id}
                                    className={`p-3 rounded-lg border transition-all ${
                                      isDone
                                        ? 'bg-white dark:bg-gray-950 border-indigo-200 dark:border-indigo-900/60 shadow-3xs'
                                        : 'bg-gray-100/50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-850 opacity-60'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <div className={`h-2 w-2 rounded-full ${isDone ? 'bg-indigo-600 dark:bg-indigo-400 animate-pulse' : 'bg-gray-300 dark:bg-gray-700'}`} />
                                      <span className="font-bold text-xs text-gray-900 dark:text-gray-100">{stg.label}</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{stg.desc}</p>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Itemized Receipt Breakdown */}
                      <div className="mt-6">
                        <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-3 font-mono">
                          Purchased Items ({selectedOrder.items.length})
                        </h4>
                        <div className="divide-y divide-gray-100 dark:divide-gray-850 border border-gray-150 dark:border-gray-850 rounded-xl overflow-hidden bg-white dark:bg-gray-950">
                          {selectedOrder.items.map((item, idx) => (
                            <div key={idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <div className="flex-1">
                                <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">{item.name}</span>
                                <div className="flex items-center gap-2 mt-0.5 text-gray-500 font-mono text-[11px]">
                                  <span>Qty: {item.quantity}</span>
                                  <span>•</span>
                                  <span>KSh {item.price.toLocaleString('en-KE')} each</span>
                                  {Object.entries(item.selectedVariations || {}).length > 0 && (
                                    <>
                                      <span>•</span>
                                      <span>Var: {Object.entries(item.selectedVariations).map(([k, v]) => `${k}:${v}`).join(', ')}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="text-right font-mono font-bold text-gray-900 dark:text-gray-100 text-sm">
                                KSh {(item.price * item.quantity).toLocaleString('en-KE')}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="mt-6 pt-4 border-t border-gray-150 dark:border-gray-850 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => exportSingleReceiptPDF(selectedOrder)}
                            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3.5 text-xs font-bold text-rose-700 dark:text-rose-400 hover:bg-rose-100 transition-colors cursor-pointer"
                          >
                            <FileText className="h-3.5 w-3.5 text-rose-500" /> Download PDF Receipt
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPrintOrder(selectedOrder);
                              setAutoPrintOnce(true);
                            }}
                            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            <Printer className="h-3.5 w-3.5 text-gray-500" /> Print Receipt
                          </button>
                          <button
                            onClick={() => setSelectedInvoiceOrder(selectedOrder)}
                            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-teal-200 dark:border-teal-900/60 bg-teal-50 dark:bg-teal-950/30 px-3.5 text-xs font-bold text-teal-700 dark:text-teal-400 hover:bg-teal-100 transition-colors cursor-pointer"
                          >
                            <FileText className="h-3.5 w-3.5" /> Download Tax Invoice
                          </button>
                          <button
                            onClick={() => handleReorderItems(selectedOrder)}
                            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/30 px-3.5 text-xs font-bold text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 transition-colors cursor-pointer"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" /> Reorder Items
                          </button>
                        </div>

                        <div className="font-mono text-sm font-bold text-gray-900 dark:text-gray-100">
                          ORDER TOTAL: <span className="text-indigo-600 dark:text-indigo-400">KSh {totalAmount.toLocaleString('en-KE')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filteredOrders.map((order) => {
                  const isSelected = order.id === activeSelectedOrderId;
                  return (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className={`order-history-item rounded-lg border p-4 font-light transition-all cursor-pointer relative ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/5 dark:border-indigo-500 ring-1 ring-indigo-500/20'
                          : 'border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-indigo-300 dark:hover:border-indigo-900/60'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between border-b border-gray-100 dark:border-gray-850 pb-2.5 gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/50 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-800">
                            {order.id.toUpperCase()}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase border ${
                            order.status === 'completed'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30'
                              : order.status === 'shipped'
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30'
                              : order.status === 'pending'
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30'
                              : order.status === 'pending-cancellation'
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/30 animate-pulse'
                              : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/30'
                          }`}>
                            ● {order.status === 'pending-cancellation' ? 'pending cancel' : order.status}
                          </span>
                          {order.isGuest && (
                            <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase">
                              GUEST
                            </span>
                          )}
                          <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase border ${
                            order.fulfillmentType === 'pickup'
                              ? 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40'
                              : 'bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/40'
                          }`}>
                            {order.fulfillmentType === 'pickup' ? '🏬 Pickup' : '🚚 Delivery'}
                          </span>
                          <span className="text-gray-300 dark:text-gray-800">|</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-550 font-mono">{order.date}</span>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {isSelected && (
                            <span className="inline-flex items-center gap-1 text-[9px] bg-rose-600 dark:bg-rose-500 text-white font-mono font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider select-none animate-pulse">
                              <FileText className="h-2.5 w-2.5" /> PDF Target
                            </span>
                          )}
                          {order.status === 'pending' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onUpdateOrderStatus) {
                                  onUpdateOrderStatus(order.id, 'pending-cancellation');
                                }
                              }}
                              className="inline-flex h-7 items-center gap-1 rounded border border-rose-250 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100/80 px-2.5 text-[10px] font-bold transition-all cursor-pointer shadow-3xs hover:scale-102"
                              title="Submit cancellation request for this pending order"
                            >
                              Request Cancellation
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              exportSingleReceiptPDF(order);
                            }}
                            className="inline-flex h-7 items-center gap-1 rounded border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 px-2.5 text-[10px] font-bold text-rose-700 dark:text-rose-450 hover:bg-rose-100 dark:hover:bg-rose-950/65 transition-all cursor-pointer shadow-3xs"
                            title="Download formatted order details PDF invoice/receipt"
                          >
                            <FileText className="h-3 w-3 text-rose-600 dark:text-rose-400" /> PDF Receipt
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPrintOrder(order);
                              setAutoPrintOnce(true);
                            }}
                            className="inline-flex h-7 items-center gap-1 rounded border border-gray-250 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 px-2.5 text-[10px] font-bold text-gray-700 dark:text-gray-300 transition-all cursor-pointer shadow-3xs hover:scale-102"
                            title="Print a cleanly formatted receipt of this specific order using window.print()"
                          >
                            <Printer className="h-3 w-3 text-gray-500 dark:text-gray-400" /> Print Receipt
                          </button>
                          {order.status === 'completed' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReorderItems(order);
                              }}
                              className="inline-flex h-7 items-center gap-1 rounded border border-emerald-250 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/35 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/65 px-2.5 text-[10px] font-bold transition-all cursor-pointer shadow-3xs hover:scale-102"
                              title="Instantly add all items from this completed order back into your active shopping cart without clearing your current cart"
                            >
                              <Plus className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Quick Reorder
                            </button>
                          )}
                          {order.status === 'completed' && (
                            (() => {
                              const existingReq = returnRequests.find((r) => r.orderId === order.id);
                              if (existingReq) {
                                return (
                                  <span className={`inline-flex h-7 items-center gap-1 rounded border px-2.5 text-[10px] font-bold uppercase tracking-wide ${
                                    existingReq.status === 'pending'
                                      ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30'
                                      : existingReq.status === 'approved'
                                      ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30'
                                      : existingReq.status === 'resolved'
                                      ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30'
                                      : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/30'
                                  }`}>
                                    Return {existingReq.status}
                                  </span>
                                );
                              }
                              return (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReturnOrder(order);
                                  }}
                                  className="inline-flex h-7 items-center gap-1 rounded border border-indigo-250 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/35 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/65 px-2.5 text-[10px] font-bold transition-all cursor-pointer shadow-3xs hover:scale-102"
                                  title="Submit a return or replacement request for items in this completed order"
                                >
                                  <RefreshCw className="h-3 w-3 text-indigo-600 dark:text-indigo-400" /> Return / Exchange
                                </button>
                              );
                            })()
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReorder(order);
                            }}
                            className="inline-flex h-7 items-center gap-1 rounded border border-indigo-200 dark:border-indigo-900 bg-indigo-550 hover:bg-indigo-650 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 px-2.5 text-[10px] font-bold transition-all cursor-pointer shadow-3xs"
                            title="Recreate cart with items from this order and go to checkout page"
                          >
                            <ShoppingCart className="h-3 w-3" /> Reorder
                          </button>
                        </div>
                      </div>

                    <div className="mt-3 flex flex-col gap-2.5">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-xs text-gray-600 border-b border-gray-50 dark:border-gray-900 last:border-0 pb-2 last:pb-0">
                          <div>
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{item.name}</span>
                            <span className="text-gray-400 font-mono text-[10px] ml-1.5">x{item.quantity}</span>
                            {Object.entries(item.selectedVariations).length > 0 && (
                              <span className="block text-[10px] text-gray-400 font-extralight mt-0.5">
                                Var: {Object.entries(item.selectedVariations).map(([k, v]) => `${k}:${v}`).join(', ')}
                              </span>
                            )}
                            
                            {/* Leave a Review Button */}
                            {order.status === 'completed' && (item.type === 'physical' || item.type === 'digital') && (
                              <div className="mt-1.5 flex items-center">
                                <button
                                  onClick={() => {
                                    const prod = products.find(p => p.id === item.productId);
                                    if (prod && onLeaveReview) {
                                      onLeaveReview(prod, order.customerName);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-650 dark:text-indigo-405 hover:text-indigo-850 dark:hover:text-indigo-305 transition-colors bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100/60 dark:border-indigo-900/40 px-2 py-0.5 rounded cursor-pointer"
                                  title={`Leave a verification review for ${item.name}`}
                                >
                                  <Sparkles className="h-2.5 w-2.5 text-indigo-555" /> Leave a Review
                                </button>
                              </div>
                            )}
                          </div>
                          <span className="font-mono">KSh {(item.price * item.quantity).toLocaleString('en-KE')}</span>
                        </div>
                      ))}
                    </div>
                                         {/* Progress Tracker for Active Orders */}
                    {order.status !== 'cancelled' && order.status !== 'pending-cancellation' ? (
                      <div className="mt-5 border-t border-gray-150 dark:border-gray-800 pt-4 pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                          <div>
                            <span className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-mono">
                              Fulfillment Journey Tracker
                            </span>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 font-light mt-0.5">
                              Current Segment: <span className="font-mono font-bold text-indigo-750 dark:text-indigo-400 uppercase">
                                {localShippingStatuses[order.id] || (order.status === 'completed' ? 'delivered' : order.status === 'shipped' ? 'shipped' : 'processing')}
                              </span>
                            </div>
                          </div>
                          
                          {/* Live Interactive Simulator pills */}
                          <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-lg p-1 select-none self-start sm:self-auto shadow-3xs">
                            <span className="text-[9px] font-mono font-bold text-gray-400 uppercase px-1.5 flex items-center gap-1">
                              <Sparkles className="h-2.5 w-2.5 text-indigo-500" /> Simulate:
                            </span>
                            {(['ordered', 'processing', 'shipped', 'delivered'] as const).map((stage) => {
                              const isStageActive = (localShippingStatuses[order.id] || (order.status === 'completed' ? 'delivered' : order.status === 'shipped' ? 'shipped' : 'processing')) === stage;
                              return (
                                <button
                                  key={stage}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentStage = localShippingStatuses[order.id] || (order.status === 'completed' ? 'delivered' : order.status === 'shipped' ? 'shipped' : 'processing');
                                    if (currentStage !== stage) {
                                      setLocalShippingStatuses(prev => ({
                                        ...prev,
                                        [order.id]: stage
                                      }));
                                      if (onTriggerEmailToast) {
                                        onTriggerEmailToast(order, stage);
                                      }
                                    }
                                  }}
                                  className={`rounded-md px-2.5 py-1 text-[10px] font-mono font-bold capitalize transition-all cursor-pointer ${
                                    isStageActive
                                      ? 'bg-indigo-600 text-white shadow-sm'
                                      : 'text-gray-400 hover:text-gray-750 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                  }`}
                                >
                                  {stage === 'ordered' ? 'placed' : stage}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Visual step-by-step progress timeline component */}
                        <div className="mt-6 mb-5 bg-gray-50/30 dark:bg-gray-900/10 rounded-xl border border-gray-100 dark:border-gray-850 p-5 font-sans">
                          <div className="flex items-center gap-2 mb-6 pb-3 border-b border-gray-100 dark:border-gray-800">
                            <History className="h-4.5 w-4.5 text-indigo-500" />
                            <div>
                              <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                                Order Fulfillment Timeline
                              </h4>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 font-light">
                                Verified chronological milestones from the logistics ledger
                              </p>
                            </div>
                          </div>

                          <div className="relative pl-6 border-l-2 border-gray-200 dark:border-gray-800 space-y-6">
                            {(() => {
                              const history = getOrderStatusHistory(order);
                              const currentStage = localShippingStatuses[order.id] || (order.status === 'completed' ? 'delivered' : order.status === 'shipped' ? 'shipped' : 'processing');
                              
                              const timelineSteps = [
                                {
                                  key: 'pending',
                                  label: 'Order Placed',
                                  icon: ShoppingBag,
                                  desc: 'Your checkout transaction is verified and logged in the Veloce database system.',
                                  completedDesc: 'Your order has been parsed and queued at our primary fulfillment center.',
                                  color: 'indigo'
                                },
                                {
                                  key: 'processing',
                                  label: 'Under Processing',
                                  icon: RefreshCw,
                                  desc: 'Our logistics crew picks, scans, and packs your order in durable cargo enclosure packages.',
                                  completedDesc: 'Cargo sealed, inventory adjusted, and dispatched to courier terminal.',
                                  color: 'indigo'
                                },
                                {
                                  key: 'shipped',
                                  label: 'Shipped & En Route',
                                  icon: Truck,
                                  desc: 'In transit to your destination via Veloce Logistics Express Carrier services.',
                                  completedDesc: 'Carrier departed. Active GPS tracking and satellite telemetry broadcast enabled.',
                                  color: 'indigo'
                                },
                                {
                                  key: 'delivered',
                                  label: 'Delivered',
                                  icon: CheckCircle,
                                  desc: 'Awaiting courier arrival at the designated delivery address.',
                                  completedDesc: 'Fulfillment completed. Shipment hand-delivered and safely received.',
                                  color: 'emerald'
                                }
                              ];

                              const stageKeys = ['pending', 'processing', 'shipped', 'delivered'];
                              const activeIdx = stageKeys.indexOf(currentStage === 'ordered' ? 'pending' : currentStage);

                              return timelineSteps.map((step, idx) => {
                                const stepHistoryEntry = history.find(h => h.status === step.key || (step.key === 'pending' && (h.status as string) === 'ordered'));
                                const isCompleted = !!stepHistoryEntry || idx < activeIdx;
                                const isActive = currentStage === step.key || (step.key === 'pending' && currentStage === 'ordered');
                                const StepIcon = step.icon;

                                return (
                                  <div key={step.key} className="relative group/timeline-step">
                                    {/* Vertical Connecting Line Overlay */}
                                    <div className={`absolute -left-[31px] top-4 bottom-[-32px] w-[2px] transition-all duration-500 last:hidden ${
                                      isCompleted ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-gray-200 dark:bg-gray-800'
                                    }`} />

                                    {/* Timeline Node Badge with Icon */}
                                    <div className={`absolute -left-[38px] top-1 h-[24px] w-[24px] rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all duration-300 z-10 ${
                                      isCompleted
                                        ? step.color === 'emerald'
                                          ? 'border-emerald-500 bg-emerald-500 text-white shadow-md'
                                          : 'border-indigo-650 bg-indigo-650 text-white shadow-md'
                                        : isActive
                                        ? 'border-indigo-600 bg-white dark:bg-gray-950 text-indigo-600 ring-4 ring-indigo-50 dark:ring-indigo-950/40 scale-110'
                                        : 'border-gray-200 bg-white dark:bg-gray-900 text-gray-400 dark:border-gray-800'
                                    }`}>
                                      <StepIcon className={`h-3 w-3 ${isActive && !isCompleted ? 'animate-spin' : ''}`} />
                                    </div>

                                    {/* Timeline Step Content Card */}
                                    <div className={`rounded-xl border p-3.5 transition-all duration-200 ${
                                      isActive 
                                        ? 'border-indigo-200 bg-indigo-50/15 dark:bg-indigo-950/20 dark:border-indigo-900/50 shadow-2xs' 
                                        : isCompleted 
                                        ? 'border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950' 
                                        : 'border-gray-100 dark:border-gray-900/60 bg-transparent opacity-60'
                                    }`}>
                                      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-1.5">
                                        <div className="flex items-center gap-2">
                                          <span className={`text-[12px] font-bold ${
                                            isActive 
                                              ? 'text-indigo-650 dark:text-indigo-400' 
                                              : isCompleted 
                                              ? 'text-gray-900 dark:text-gray-200' 
                                              : 'text-gray-400 dark:text-gray-550'
                                          }`}>
                                            {step.label}
                                          </span>
                                          <span className={`text-[8px] font-bold font-mono px-1.5 py-0.2 rounded-sm border ${
                                            isCompleted
                                              ? step.color === 'emerald'
                                                ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-100 text-emerald-700 dark:text-emerald-400'
                                                : 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-100 text-indigo-700 dark:text-indigo-400'
                                              : isActive
                                              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 text-amber-700 dark:text-amber-400 animate-pulse'
                                              : 'bg-gray-50 dark:bg-gray-900 border-gray-100 text-gray-400 dark:text-gray-600'
                                          }`}>
                                            {isCompleted ? 'COMPLETED' : isActive ? 'ACTIVE' : 'PENDING'}
                                          </span>
                                        </div>

                                        {stepHistoryEntry && (
                                          <span className="text-[10px] font-mono text-gray-450 dark:text-gray-500 flex items-center gap-1 font-light">
                                            <Clock className="h-3 w-3" /> {stepHistoryEntry.timestamp}
                                          </span>
                                        )}
                                      </div>

                                      <p className={`text-[11px] leading-relaxed font-light ${
                                        isActive || isCompleted 
                                          ? 'text-gray-600 dark:text-gray-300' 
                                          : 'text-gray-400'
                                      }`}>
                                        {isCompleted ? step.completedDesc : step.desc}
                                      </p>

                                      {/* Verified Handshake Ledger Note if exists */}
                                      {stepHistoryEntry && (
                                        <div className="mt-2 pt-2 border-t border-gray-100/60 dark:border-gray-800/60 flex items-start gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50/30 dark:bg-gray-900/10 px-2.5 py-1.5 rounded-md border border-gray-100/50 dark:border-gray-850/50 font-mono">
                                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                          <div className="flex-1">
                                            <span className="font-extrabold text-[9px] text-indigo-600 dark:text-indigo-400 block mb-0.5 uppercase tracking-wider">
                                              Ledger Handshake Verified
                                            </span>
                                            {stepHistoryEntry.note || 'Milestone checked and logged via automated satellite RFID scan.'}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 border-t border-gray-150 dark:border-gray-800 pt-4 pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                          <div>
                            <span className="block text-[10px] font-bold text-red-500 uppercase tracking-widest font-mono">
                              {order.status === 'pending-cancellation' ? 'Cancellation Pending Review' : 'Transaction Terminated'}
                            </span>
                            <div className="text-[11px] text-gray-550 dark:text-gray-400 font-light mt-0.5">
                              This order is <span className="font-mono font-bold text-red-650 dark:text-red-400 uppercase">{order.status === 'pending-cancellation' ? 'Pending Cancellation' : 'Cancelled'}</span>.
                            </div>
                          </div>
                        </div>

                        {/* Visual step-by-step progress timeline component for Cancelled / Pending-Cancellation */}
                        <div className="mt-6 mb-5 bg-gray-50/30 dark:bg-gray-900/10 rounded-xl border border-gray-150 dark:border-gray-850 p-5 font-sans">
                          <div className="flex items-center gap-2 mb-6 pb-3 border-b border-gray-150 dark:border-gray-800">
                            <History className="h-4.5 w-4.5 text-red-500" />
                            <div>
                              <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                                Order Cancellation Timeline
                              </h4>
                              <p className="text-[10px] text-gray-400 dark:text-gray-550 mt-0.5 font-light">
                                Transaction termination lifecycle status
                              </p>
                            </div>
                          </div>

                          <div className="relative pl-6 border-l-2 border-gray-200 dark:border-gray-800 space-y-6">
                            {(() => {
                              const history = getOrderStatusHistory(order);
                              
                              const timelineSteps = [
                                {
                                  key: 'pending',
                                  label: 'Order Placed',
                                  icon: ShoppingBag,
                                  desc: 'Checkout transaction successfully processed and logged.',
                                  color: 'indigo'
                                },
                                {
                                  key: 'processing',
                                  label: 'Under Processing',
                                  icon: RefreshCw,
                                  desc: 'Fulfillment and preparation queued.',
                                  color: 'indigo'
                                },
                                {
                                  key: 'pending-cancellation',
                                  label: 'Cancellation Requested',
                                  icon: AlertCircle,
                                  desc: 'Customer submitted an official cancellation inquiry for review.',
                                  color: 'amber'
                                },
                                {
                                  key: 'cancelled',
                                  label: 'Transaction Terminated',
                                  icon: X,
                                  desc: 'Merchant processed cancellation and initiated payment refund sequence.',
                                  color: 'red'
                                }
                              ];

                              return timelineSteps.map((step, idx) => {
                                const stepHistoryEntry = history.find(h => 
                                  h.status === step.key || 
                                  (step.key === 'pending' && (h.status as string) === 'ordered') ||
                                  (step.key === 'cancelled' && h.status === 'cancelled')
                                );
                                
                                const isCompleted = !!stepHistoryEntry || (step.key === 'cancelled' && order.status === 'cancelled') || (step.key === 'pending-cancellation' && (order.status === 'pending-cancellation' || order.status === 'cancelled'));
                                const isActive = order.status === step.key;
                                const StepIcon = step.icon;

                                return (
                                  <div key={step.key} className="relative group/timeline-step">
                                    {/* Vertical Connecting Line Highlight */}
                                    <div className={`absolute -left-[31px] top-4 bottom-[-32px] w-[2px] transition-all duration-500 last:hidden ${
                                      isCompleted ? 'bg-red-500' : 'bg-gray-200 dark:bg-gray-800'
                                    }`} />

                                    {/* Node Icon */}
                                    <div className={`absolute -left-[38px] top-1 h-[24px] w-[24px] rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all duration-305 z-10 ${
                                      isCompleted
                                        ? step.color === 'red'
                                          ? 'border-red-500 bg-red-500 text-white shadow-md'
                                          : step.color === 'amber'
                                          ? 'border-amber-500 bg-amber-500 text-white shadow-md'
                                          : 'border-indigo-650 bg-indigo-650 text-white shadow-md'
                                        : 'border-gray-200 bg-white dark:bg-gray-900 text-gray-400 dark:border-gray-800'
                                    }`}>
                                      <StepIcon className="h-3 w-3" />
                                    </div>

                                    {/* Step Detail Card */}
                                    <div className={`rounded-xl border p-3.5 transition-all duration-200 ${
                                      isActive 
                                        ? 'border-red-200 bg-red-50/10 dark:bg-red-950/20 dark:border-red-900/50 shadow-2xs' 
                                        : isCompleted 
                                        ? 'border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950' 
                                        : 'border-gray-100 dark:border-gray-900/60 bg-transparent opacity-60'
                                    }`}>
                                      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-1.5">
                                        <div className="flex items-center gap-2">
                                          <span className={`text-[12px] font-bold ${
                                            isActive 
                                              ? 'text-red-600 dark:text-red-400' 
                                              : isCompleted 
                                              ? 'text-gray-900 dark:text-gray-200' 
                                              : 'text-gray-400 dark:text-gray-500'
                                          }`}>
                                            {step.label}
                                          </span>
                                          <span className={`text-[8px] font-bold font-mono px-1.5 py-0.2 rounded-sm border ${
                                            isCompleted
                                              ? step.color === 'red'
                                                ? 'bg-red-50/50 dark:bg-red-950/30 border-red-100 text-red-700 dark:text-red-400'
                                                : step.color === 'amber'
                                                ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-100 text-amber-700 dark:text-amber-400'
                                                : 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-100 text-indigo-700 dark:text-indigo-400'
                                              : 'bg-gray-50 dark:bg-gray-900 border-gray-100 text-gray-400'
                                          }`}>
                                            {isCompleted ? 'VERIFIED' : 'PASSED'}
                                          </span>
                                        </div>

                                        {stepHistoryEntry && (
                                          <span className="text-[10px] font-mono text-gray-450 dark:text-gray-555 flex items-center gap-1 font-light">
                                            <Clock className="h-3 w-3" /> {stepHistoryEntry.timestamp}
                                          </span>
                                        )}
                                      </div>

                                      <p className="text-[11px] leading-relaxed font-light text-gray-600 dark:text-gray-350">
                                        {step.desc}
                                      </p>

                                      {stepHistoryEntry && (
                                        <div className="mt-2 pt-2 border-t border-gray-100/60 dark:border-gray-800/60 flex items-start gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50/30 dark:bg-gray-900/10 px-2.5 py-1.5 rounded-md border border-gray-100/50 dark:border-gray-850/50 font-mono">
                                          <ShieldCheck className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                                          <div className="flex-1">
                                            <span className="font-extrabold text-[9px] text-red-600 dark:text-red-400 block mb-0.5 uppercase tracking-wider">
                                              Ledger Handshake Verified
                                            </span>
                                            {stepHistoryEntry.note || 'Milestone checked and logged via automated satellite RFID scan.'}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </div>
                    )}

                        {/* Interactive Tracking History Log */}
                        {(() => {
                          const simulation = getCourierTracking(order.id, order.date, order.status);
                          const statusColors = {
                            'Processing': 'bg-amber-55/10 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40',
                            'In Transit': 'bg-blue-55/10 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/40',
                            'Out for Delivery': 'bg-purple-55/10 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/40',
                            'Delivered': 'bg-emerald-55/10 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40',
                            'Cancelled': 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-750'
                          };
                          const statusIcon = {
                            'Processing': <Clock className="h-3 w-3 animate-spin text-amber-500" />,
                            'In Transit': <Truck className="h-3 w-3 animate-pulse text-blue-500" />,
                            'Out for Delivery': <Navigation className="h-3 w-3 text-purple-500 animate-bounce" />,
                            'Delivered': <Check className="h-3 w-3 text-emerald-500" />,
                            'Cancelled': <AlertCircle className="h-3 w-3 text-gray-400" />
                          };

                          return (
                            <div className="mt-5 rounded-lg border border-gray-150 dark:border-gray-850 bg-gray-50/40 dark:bg-gray-900/40 p-4.5 leading-normal">
                              {/* Header & Query Button */}
                              <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4 border-b border-gray-150 dark:border-gray-800 pb-3">
                                <span className="text-[10px] font-bold text-gray-750 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                                  <Truck className="h-3.5 w-3.5 text-indigo-500 animate-pulse" /> Veloce Courier Routing Service
                                </span>
                                
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFetchTracking(order.id, order.status, order.date);
                                  }}
                                  disabled={trackingLogs[order.id]?.loading}
                                  className="inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-650 dark:text-indigo-400 hover:text-indigo-850 dark:hover:text-indigo-300 disabled:opacity-50 transition-all cursor-pointer font-sans bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 px-2.5 py-1.5 rounded-md shadow-3xs"
                                >
                                  <RefreshCw className={`h-3 w-3 ${trackingLogs[order.id]?.loading ? 'animate-spin' : ''}`} />
                                  {trackingLogs[order.id]?.fetched ? 'Re-Sync Dispatch' : 'Sync Live Dispatch Logs'}
                                </button>
                              </div>

                              {/* Smart Courier State Banner based on Order Timestamp */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-850/85 rounded-xl p-3.5 shadow-2xs font-sans">
                                <div className="flex items-start gap-2.5 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-900 pb-2.5 md:pb-0 md:pr-3">
                                  <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center shrink-0">
                                    <Truck className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-mono font-bold text-gray-400 uppercase">Assigned Courier</span>
                                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{simulation.courier}</span>
                                    <span className="text-[10px] font-mono text-indigo-655 dark:text-indigo-400 mt-0.5">{simulation.trackingNumber}</span>
                                  </div>
                                </div>

                                <div className="flex items-start gap-2.5 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-900 pb-2.5 md:pb-0 md:pr-3">
                                  <div className="h-8 w-8 rounded-full bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center shrink-0">
                                    <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-mono font-bold text-gray-400 uppercase">Est. Delivery Window</span>
                                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{simulation.estimatedDelivery}</span>
                                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 mt-0.5">Order logged: {order.date}</span>
                                  </div>
                                </div>

                                <div className="flex items-start gap-2.5">
                                  <div className="h-8 w-8 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center shrink-0">
                                    <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-450" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-mono font-bold text-gray-400 uppercase">Courier Status</span>
                                    <div className={`mt-0.5 inline-flex items-center gap-1 border px-2 py-0.5 rounded-full text-[9.5px] font-bold ${statusColors[simulation.status]}`}>
                                      {statusIcon[simulation.status]}
                                      {simulation.status}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Progress bar specific to Courier Status */}
                              <div className="bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-850/80 rounded-xl p-3.5 mb-4 shadow-3xs font-sans">
                                <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-555 mb-2 font-mono">
                                  <span className="font-bold text-gray-500">COURIER TRANSIT PATHWAY</span>
                                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{simulation.percent}% Completed</span>
                                </div>
                                <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-700 ease-out"
                                    style={{ width: `${simulation.percent}%` }}
                                  />
                                </div>
                                <div className="flex justify-between items-center text-[9px] text-gray-400 dark:text-gray-500 mt-2 font-mono uppercase tracking-wider">
                                  <span className={simulation.status !== 'Cancelled' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>Processed</span>
                                  <span className={(simulation.status === 'In Transit' || simulation.status === 'Out for Delivery' || simulation.status === 'Delivered') ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>Transit</span>
                                  <span className={(simulation.status === 'Out for Delivery' || simulation.status === 'Delivered') ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>Out For Delivery</span>
                                  <span className={simulation.status === 'Delivered' ? 'text-emerald-600 dark:text-emerald-450 font-bold' : ''}>Delivered</span>
                                </div>
                              </div>

                              {/* Stylized Geographical Transit Map */}
                              {(() => {
                                if (order.status === 'cancelled') return null;

                                const pct = simulation.percent || 0;
                                const t = pct / 100;

                                // Bezier control points for the physical route
                                const p0 = { x: 50, y: 110 };  // San Jose Depot
                                const p1 = { x: 200, y: 30 };  // Fremont Hub
                                const p2 = { x: 350, y: 80 };  // SF Destination

                                // Calculate position along Bezier curve
                                const courierX = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
                                const courierY = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;

                                // Compute angle/heading of the vehicle along the path (B' derivative tangent)
                                const tx = 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
                                const ty = 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
                                const angle = Math.atan2(ty, tx) * (180 / Math.PI);

                                return (
                                  <div className="bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-850/80 rounded-xl p-3.5 mb-4 shadow-3xs font-sans overflow-hidden animate-in fade-in duration-350">
                                    <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-2 font-mono">
                                      <span className="font-bold flex items-center gap-1">
                                        <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                                        LIVE DISPATCH TELEMETRY MAP
                                      </span>
                                      <span className="font-mono text-gray-400 dark:text-gray-550 text-[9px]">
                                        SJC ➔ FRE ➔ SFO • GPS Active
                                      </span>
                                    </div>

                                    {/* Map Graphic Container */}
                                    <div className="relative h-44 bg-slate-50 dark:bg-[#0c111d] rounded-lg border border-gray-100 dark:border-gray-900 overflow-hidden select-none">
                                      {/* Decorative Grid Background */}
                                      <div className="absolute inset-0 bg-slate-50/50 dark:bg-slate-900/50" />
                                      
                                      {/* Compass Rose Accent */}
                                      <div className="absolute top-2.5 right-2.5 opacity-30 text-[8px] font-mono font-bold text-gray-400 dark:text-gray-600 flex flex-col items-center">
                                        <div className="border border-gray-300 dark:border-gray-700 rounded-full p-1 flex items-center justify-center h-6 w-6">
                                          N
                                        </div>
                                      </div>

                                      {/* Telemetry HUD overlays */}
                                      <div className="absolute bottom-2 left-2.5 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xs border border-gray-150 dark:border-gray-800 rounded px-2 py-1 text-[9px] font-mono leading-tight shadow-3xs">
                                        <div className="text-gray-400">LAT: <span className="text-gray-700 dark:text-gray-200">37.{(3340 + t * 440).toFixed(0)}° N</span></div>
                                        <div className="text-gray-400">LON: <span className="text-gray-700 dark:text-gray-200">122.{(4194 - t * 150).toFixed(0)}° W</span></div>
                                      </div>

                                      <div className="absolute bottom-2 right-2.5 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xs border border-gray-150 dark:border-gray-800 rounded px-2 py-1 text-[9px] font-mono text-right leading-tight shadow-3xs">
                                        <div className="text-gray-400">SPEED: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{simulation.status === 'Delivered' ? '0' : simulation.status === 'Out for Delivery' ? '32' : '65'} MPH</span></div>
                                        <div className="text-gray-400">HEADING: <span className="text-gray-700 dark:text-gray-200">{angle.toFixed(0)}° ({angle > 0 ? 'SE' : 'NW'})</span></div>
                                      </div>

                                      {/* SVG Geographical Overlay Map */}
                                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 160" preserveAspectRatio="none">
                                        {/* Simulated Geographic bay outline or shipping corridor zone */}
                                        <path 
                                          d="M -10,130 C 100,140 120,90 200,80 C 260,70 300,50 410,50" 
                                          fill="none" 
                                          stroke="rgba(99, 102, 241, 0.05)" 
                                          strokeWidth="32" 
                                          strokeLinecap="round" 
                                        />
                                        <path 
                                          d="M -10,130 C 100,140 120,90 200,80 C 260,70 300,50 410,50" 
                                          fill="none" 
                                          stroke="rgba(99, 102, 241, 0.03)" 
                                          strokeWidth="60" 
                                          strokeLinecap="round" 
                                        />

                                        {/* Faint connecting local route meshes */}
                                        <path d="M 40,80 L 120,130 M 180,20 L 220,120 M 300,140 L 370,40" stroke="currentColor" className="text-gray-200 dark:text-gray-800/40" strokeWidth="1" strokeDasharray="2 3" />

                                        {/* The Actual Curved Transit Path */}
                                        <path 
                                          d="M 50,110 Q 200,30 350,80" 
                                          fill="none" 
                                          stroke="currentColor" 
                                          className="text-gray-200 dark:text-gray-800" 
                                          strokeWidth="3" 
                                          strokeLinecap="round" 
                                        />
                                        
                                        {/* Animated active path (gradient glow overlay that grows with transit percentage) */}
                                        <path 
                                          d="M 50,110 Q 200,30 350,80" 
                                          fill="none" 
                                          stroke="#4f46e5" 
                                          strokeWidth="3" 
                                          strokeLinecap="round" 
                                          strokeDasharray="315" 
                                          strokeDashoffset={315 * (1 - t)}
                                          className="transition-all duration-700 ease-out animate-pulse"
                                        />

                                        

                                        {/* Pulse Glow for Origin Node */}
                                        <circle cx="50" cy="110" r="16" fill="#818cf8" fillOpacity={0.2} className="animate-pulse" />
                                        {/* Origin Node Anchor */}
                                        <circle cx="50" cy="110" r="5" className="fill-indigo-600 dark:fill-indigo-400 stroke-white dark:stroke-gray-950 stroke-2" />

                                        {/* Pulse Glow for Destination Node */}
                                        <circle cx="350" cy="80" r="18" fill="#10b981" fillOpacity={0.2} className={pct > 75 ? "animate-pulse" : "opacity-30"} />
                                        {/* Destination Node Anchor */}
                                        <circle cx="350" cy="80" r="5" className={`${pct >= 100 ? 'fill-emerald-550 dark:fill-emerald-450' : 'fill-gray-405 dark:fill-gray-600'} stroke-white dark:stroke-gray-950 stroke-2`} />

                                        {/* Stylized Courier Indicator Marker (Vehicle) */}
                                        <g 
                                          transform={`translate(${courierX}, ${courierY}) rotate(${angle})`} 
                                          className="transition-all duration-700 ease-out"
                                        >
                                          {/* Courier ring pulse */}
                                          {simulation.status !== 'Delivered' && (
                                            <circle cx="0" cy="0" r="12" fill="none" className="stroke-indigo-500/40 animate-ping" strokeWidth="1" />
                                          )}
                                          
                                          {/* Vehicle marker background box/circle */}
                                          <circle cx="0" cy="0" r="8" className="fill-indigo-600 dark:fill-indigo-500 stroke-white dark:stroke-gray-950 stroke-1.5 shadow-sm" />
                                          
                                          {/* Mini vehicle arrowhead to show direction of transit */}
                                          <polygon points="-3,-3 5,0 -3,3" className="fill-white" />
                                        </g>
                                      </svg>

                                      {/* Floating Geographical Map Marker Card Labels */}
                                      <div 
                                        className="absolute left-[30px] top-[122px] -translate-x-1/2 bg-white/95 dark:bg-gray-900/95 border border-gray-150 dark:border-gray-800 rounded px-1.5 py-0.5 text-[8px] font-bold text-gray-700 dark:text-gray-300 shadow-3xs"
                                      >
                                        SJC Warehouse
                                      </div>

                                      <div 
                                        className="absolute left-[350px] top-[92px] -translate-x-1/2 bg-white/95 dark:bg-gray-900/95 border border-gray-150 dark:border-gray-800 rounded px-1.5 py-0.5 text-[8px] font-bold text-gray-700 dark:text-gray-300 shadow-3xs"
                                      >
                                        {simulation.status === 'Delivered' ? 'Delivered 🎉' : 'Destination'}
                                      </div>

                                      {/* Real-time status update tag overlay */}
                                      <div className="absolute top-2.5 left-2.5 bg-indigo-600 dark:bg-indigo-550 text-white font-mono font-bold text-[8.5px] px-2 py-0.5 rounded shadow-2xs tracking-wider uppercase flex items-center gap-1">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                                        Courier: {simulation.status === 'Delivered' ? 'Arrived' : simulation.status === 'Out for Delivery' ? 'Near Stop' : 'En Route'}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Dynamic Fetch Details Container */}
                              {!trackingLogs[order.id] ? (
                                <div className="py-2.5 text-center bg-white dark:bg-gray-950 rounded-xl border border-dashed border-gray-250 dark:border-gray-800 p-4">
                                  <p className="text-[10.5px] text-gray-400 dark:text-gray-505 font-sans italic leading-relaxed mb-2.5">
                                    Secure ledger handshakes and checkpoint RFID barcode scans are loaded upon validation.
                                  </p>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFetchTracking(order.id, order.status, order.date);
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-650 dark:hover:bg-indigo-700 px-3.5 py-1.5 text-[10px] font-bold text-white transition-all cursor-pointer shadow-xs font-sans"
                                  >
                                    <RefreshCw className="h-3 w-3" /> Fetch Dispatch Handshake History
                                  </button>
                                </div>
                              ) : trackingLogs[order.id].loading ? (
                                <div className="py-6 flex flex-col items-center justify-center text-center bg-white dark:bg-gray-950 rounded-xl border border-gray-150 dark:border-gray-850">
                                  <RefreshCw className="h-5 w-5 text-indigo-600 animate-spin mb-2" />
                                  <span className="text-[10px] font-mono font-bold text-indigo-700 dark:text-indigo-400 animate-pulse">
                                    {trackingLogs[order.id].progressText}
                                  </span>
                                  <span className="text-[8px] text-gray-400 font-mono mt-0.5">Decrypting TLS tunnel node signatures...</span>
                                </div>
                              ) : (
                                <div className="space-y-4 mt-3 bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-850/80 rounded-xl p-4 shadow-3xs animate-in fade-in duration-300">
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono bg-emerald-55/10 text-emerald-800 dark:text-emerald-400 px-2 py-1 rounded border border-emerald-100 dark:border-emerald-900/30 w-fit mb-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                    Live Sync Active (ID: {simulation.trackingNumber})
                                  </div>
                                  
                                  <div className="relative pl-3.5 border-l-2 border-indigo-100 dark:border-indigo-900/40 space-y-4 font-sans">
                                    {trackingLogs[order.id].events.map((evt, evtIdx) => (
                                      <div key={evtIdx} className="relative">
                                        {/* Timeline dot marker */}
                                        <div className={`absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full border-2 ${
                                          evtIdx === 0 
                                            ? 'bg-indigo-600 border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500 ring-4 ring-indigo-50 dark:ring-indigo-950/45 animate-pulse' 
                                            : 'bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-800'
                                        }`} />
                                        
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-[11px] gap-1">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className={`font-semibold ${evtIdx === 0 ? 'text-indigo-950 dark:text-indigo-200 font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                                              {evt.status}
                                            </span>
                                            <span className="text-[9px] font-mono text-gray-400 dark:text-gray-505 bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-800 px-1.5 py-0.2 rounded inline-flex items-center gap-1 font-light">
                                              <MapPin className="h-2.5 w-2.5 text-gray-500" /> {evt.location}
                                            </span>
                                          </div>
                                          
                                          <span className="text-[9px] font-mono text-gray-400 dark:text-gray-505 flex items-center gap-1 shrink-0">
                                            <Clock className="h-2.5 w-2.5" /> {evt.time}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-light mt-0.5 leading-relaxed">
                                          {evt.description}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                    {/* Custom Reference Note Section */}
                    <div className="mt-4 border-t border-gray-100 dark:border-gray-850 pt-3.5 pb-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                          <MessageSquare className="h-3.5 w-3.5 text-gray-400" /> Custom Order Record Note
                        </span>
                        
                        {editingNoteOrderId !== order.id && (
                          <button
                            onClick={() => {
                              setEditingNoteOrderId(order.id);
                              setTempNoteText(order.customNote || '');
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors cursor-pointer bg-transparent border-0 py-0.5 px-1.5 rounded"
                          >
                            <Edit2 className="h-3 w-3" />
                            {order.customNote ? 'Edit Note' : 'Add Note'}
                          </button>
                        )}
                      </div>

                      {editingNoteOrderId === order.id ? (
                        <div className="space-y-2 mt-2 animate-in fade-in duration-200">
                          <textarea
                            value={tempNoteText}
                            onChange={(e) => setTempNoteText(e.target.value.slice(0, 400))}
                            placeholder="Enter delivery guidelines, reference code, bespoke assembly requirements, or general notes for this order..."
                            rows={3}
                            className="w-full rounded border border-gray-250 dark:border-gray-800 bg-white dark:bg-gray-900 p-2.5 text-xs font-sans text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 shadow-3xs"
                          />
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-mono text-gray-400 dark:text-gray-500">
                              {tempNoteText.length}/400 characters
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditingNoteOrderId(null)}
                                className="px-2.5 py-1 text-[10px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  if (onUpdateOrderNote) {
                                    onUpdateOrderNote(order.id, tempNoteText.trim());
                                  }
                                  setEditingNoteOrderId(null);
                                }}
                                className="px-3 py-1 text-[10px] font-bold bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors cursor-pointer shadow-3xs"
                              >
                                Save Note
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : order.customNote ? (
                        <div className="group relative rounded border border-gray-150 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 p-2.5 leading-relaxed text-xs text-gray-600 dark:text-gray-350 font-sans flex items-start justify-between gap-3 animate-in fade-in duration-200">
                          <div className="flex-1 break-words italic pr-4">
                            &ldquo;{order.customNote}&rdquo;
                          </div>
                          <button
                            onClick={() => {
                              const isIframe = window.self !== window.top;
                              if (isIframe || confirm('Are you sure you want to remove this custom note?')) {
                                if (onUpdateOrderNote) onUpdateOrderNote(order.id, '');
                              }
                            }}
                            className="text-gray-400 hover:text-red-650 dark:hover:text-red-400 p-0.5 rounded transition-all shrink-0 cursor-pointer self-start opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Remove Note"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-sans italic leading-none pl-0.5">
                          No active custom note recorded for this order.
                        </p>
                      )}

                      {/* Chronological Notes History Log */}
                      <div className="mt-4 border-t border-dashed border-gray-150 dark:border-gray-800 pt-3">
                        <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold text-gray-500 dark:text-gray-450 uppercase tracking-wider font-mono">
                          <History className="h-3.5 w-3.5 text-indigo-550 dark:text-indigo-400" /> Logged Notes Chronicle ({order.notesHistory?.length || 0})
                        </div>

                        {order.notesHistory && order.notesHistory.length > 0 ? (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {order.notesHistory.map((noteEntry) => (
                              <div
                                key={noteEntry.id}
                                className="group/note flex items-start justify-between gap-3 rounded bg-gray-50/60 dark:bg-gray-950/40 border border-gray-100 dark:border-gray-900/80 p-2.5 text-xs inline-flex w-full leading-relaxed animate-in fade-in duration-150"
                              >
                                <div className="flex-1">
                                  <p className="text-gray-700 dark:text-gray-300 break-words font-sans">
                                    {noteEntry.text}
                                  </p>
                                  <span className="block text-[9px] text-gray-400 dark:text-gray-500 font-mono mt-1">
                                    Added on {noteEntry.timestamp}
                                  </span>
                                </div>
                                <button
                                  onClick={() => {
                                    const isIframe = window.self !== window.top;
                                    if (isIframe || confirm('Are you sure you want to delete this historical note log entry?')) {
                                      const filteredHistory = order.notesHistory?.filter((n) => n.id !== noteEntry.id) || [];
                                      if (onUpdateOrderNote) {
                                        onUpdateOrderNote(order.id, order.customNote || '', filteredHistory);
                                      }
                                    }
                                  }}
                                  className="text-gray-400 hover:text-red-500 p-0.5 cursor-pointer rounded shrink-0 transition-all opacity-0 group-hover/note:opacity-100 focus/note:opacity-100"
                                  title="Delete historical note"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-sans italic pl-0.5">
                            No archived note history records.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 border-t border-gray-50 pt-2.5 flex items-center justify-between gap-4 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setSelectedPrintOrder(order)}
                          className="inline-flex h-8 items-center gap-1.5 rounded border border-gray-200 bg-white px-3 text-[10px] font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <Printer className="h-3.5 w-3.5" /> Print Receipt
                        </button>

                        <button
                          onClick={() => exportSingleReceiptPDF(order)}
                          className="inline-flex h-8 items-center gap-1.5 rounded border border-rose-200 bg-rose-50 px-3 text-[10px] font-bold text-rose-700 hover:bg-rose-100 hover:text-rose-900 transition-colors cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5" /> Download PDF
                        </button>

                        <button
                          onClick={() => setSelectedInvoiceOrder(order)}
                          className="inline-flex h-8 items-center gap-1.5 rounded border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950/30 px-3 text-[10px] font-bold text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-950/60 transition-colors cursor-pointer animate-pulse-subtle"
                          title="Generate professional tax invoice (KRA compliant)"
                          id={`btn-download-invoice-${order.id}`}
                        >
                          <FileText className="h-3.5 w-3.5" /> Download Invoice
                        </button>

                        <button
                          onClick={() => handleReorderItems(order)}
                          className="inline-flex h-8 items-center gap-1.5 rounded border border-indigo-200 bg-indigo-50 px-3 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900 transition-colors cursor-pointer"
                          title="Reorder items from this past order to your cart"
                        >
                          <ShoppingCart className="h-3.5 w-3.5" /> Reorder Items
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTrackingOrderId(order.id);
                            setIsTrackingModalOpen(true);
                          }}
                          className="inline-flex h-8 items-center gap-1.5 rounded border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-3 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition-colors cursor-pointer shadow-3xs"
                          title="Track physical dispatch shipment, courier path, and live terminal handshake events"
                        >
                          <Truck className="h-3.5 w-3.5 animate-pulse" /> Track Shipment
                        </button>
                      </div>
                      <div className="flex items-center gap-2 font-semibold">
                        <span className="text-gray-400 font-medium leading-none text-[10px]">ORDER TOTAL:</span>
                        <span className="font-mono font-bold text-gray-900 text-sm">KSh {order.total.toLocaleString('en-KE')}</span>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
          </>)}

          {/* Support Tickets Tab Component */}
          {activeDashboardTab === 'tickets' && (
            <div className="flex flex-col gap-6">
              {/* If we are not raising a new ticket and no ticket is actively selected, show list */}
              {!isRaisingNewTicket && !selectedTicketId && (
                <div className="rounded-xl border border-gray-100 dark:border-gray-850 bg-white dark:bg-gray-950 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-850 pb-4 mb-4">
                    <div>
                      <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <LifeBuoy className="h-4.5 w-4.5 text-indigo-500" /> Customer Support Center
                      </h3>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 font-extralight mt-0.5">
                        Open queries, raise issues regarding your delivery route, or simulate live agent chat handshakes.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsRaisingNewTicket(true)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3.5 cursor-pointer shadow-3xs transition-all hover:scale-102"
                    >
                      <PlusCircle className="h-3.5 w-3.5" /> Raise New Ticket
                    </button>
                  </div>

                  {tickets.length === 0 ? (
                    <div className="py-12 text-center">
                      <HelpCircle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-400 italic">No support tickets found. Click "Raise New Ticket" to ask for assistance.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {tickets.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTicketId(t.id)}
                          className="p-4 rounded-xl border border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-indigo-200 dark:hover:border-indigo-900/40 hover:bg-indigo-50/5 dark:hover:bg-indigo-950/5 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-mono text-[10px] font-bold text-gray-450 dark:text-gray-500 bg-gray-50 dark:bg-gray-900 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-850">
                                {t.id}
                              </span>
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${
                                t.status === 'Resolved'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30'
                                  : t.status === 'In Progress'
                                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30'
                                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30 animate-pulse'
                              }`}>
                                ● {t.status}
                              </span>
                              <span className="text-[10px] text-gray-455 font-mono">{t.date}</span>
                            </div>
                            <h4 className="text-xs font-semibold text-gray-900 dark:text-white truncate">{t.subject}</h4>
                            <p className="text-[11px] text-gray-550 dark:text-gray-400 truncate mt-0.5">{t.description}</p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                            <span className={`text-[9px] font-mono uppercase font-bold px-1.5 py-0.5 rounded ${
                              t.priority === 'high' ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400'
                            }`}>
                              {t.priority}
                            </span>
                            <span className="text-gray-200 dark:text-gray-800">|</span>
                            <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                              {t.messages.length} message{t.messages.length === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Raise New Ticket view */}
              {isRaisingNewTicket && (
                <div className="rounded-xl border border-gray-100 dark:border-gray-850 bg-white dark:bg-gray-950 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-850 pb-4 mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <LifeBuoy className="h-4.5 w-4.5 text-indigo-500" /> Raise Support Ticket
                    </h3>
                    <button
                      onClick={() => setIsRaisingNewTicket(false)}
                      className="text-xs text-gray-400 hover:text-gray-650 cursor-pointer"
                    >
                      Cancel
                    </button>
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
                        messages: [
                          { sender: 'user', text: newTicketDescription.trim(), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
                        ]
                      };

                      const updated = [newTicket, ...tickets];
                      saveTickets(updated);

                      // Reset form
                      setNewTicketSubject('');
                      setNewTicketDescription('');
                      setIsRaisingNewTicket(false);
                      setSelectedTicketId(id); // auto select newly raised ticket

                      // Trigger simulated instant agent handshake notification
                      setTimeout(() => {
                        const userNameGreeting = name ? name.split(' ')[0] : 'there';
                        const automaticReply = {
                          sender: 'agent',
                          text: `Hi ${userNameGreeting}! Thank you for raising support query ${id}. A technical service assistant has been assigned to your issue regarding "${newTicketSubject}". We are reviewing your ticket now.`,
                          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        };

                        setTickets(prev => prev.map(t => {
                          if (t.id === id) {
                            return { ...t, messages: [...t.messages, automaticReply], status: 'In Progress' };
                          }
                          return t;
                        }));
                      }, 1200);
                    }}
                    className="flex flex-col gap-4 text-xs"
                  >
                    <div>
                      <label className="block font-mono font-bold text-[10px] text-gray-400 uppercase tracking-wider mb-1">Ticket Subject / Title</label>
                      <input
                        type="text"
                        required
                        value={newTicketSubject}
                        onChange={(e) => setNewTicketSubject(e.target.value)}
                        placeholder="e.g., Request to update shipment delivery note..."
                        className="h-9 w-full rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 font-semibold text-gray-805 dark:text-gray-105 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-mono font-bold text-[10px] text-gray-400 uppercase tracking-wider mb-1">Inquiry Category</label>
                        <select
                          value={newTicketCategory}
                          onChange={(e) => setNewTicketCategory(e.target.value)}
                          className="h-9 w-full rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 font-semibold text-gray-805 dark:text-gray-105 focus:outline-none cursor-pointer"
                        >
                          <option>Orders & Delivery</option>
                          <option>Billing</option>
                          <option>Technical Support</option>
                          <option>Partnership</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-mono font-bold text-[10px] text-gray-400 uppercase tracking-wider mb-1">Priority Urgency</label>
                        <select
                          value={newTicketPriority}
                          onChange={(e) => setNewTicketPriority(e.target.value)}
                          className="h-9 w-full rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 font-semibold text-gray-805 dark:text-gray-105 focus:outline-none cursor-pointer"
                        >
                          <option value="low">Low - General Inquiry</option>
                          <option value="medium">Medium - Standard Issue</option>
                          <option value="high">High - Urgent Case</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-mono font-bold text-[10px] text-gray-400 uppercase tracking-wider mb-1">Message Description</label>
                      <textarea
                        required
                        rows={4}
                        value={newTicketDescription}
                        onChange={(e) => setNewTicketDescription(e.target.value)}
                        placeholder="Please elaborate on your inquiry in detail..."
                        className="w-full rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 font-semibold text-gray-805 dark:text-gray-105 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                      />
                    </div>

                    <button
                      type="submit"
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs cursor-pointer shadow-3xs"
                    >
                      <Send className="h-3.5 w-3.5" /> Submit Support Ticket
                    </button>
                  </form>
                </div>
              )}

              {/* Conversational Ticket detail view */}
              {selectedTicketId && (
                (() => {
                  const activeTicket = tickets.find(t => t.id === selectedTicketId);
                  if (!activeTicket) return null;

                  return (
                    <div className="rounded-xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex flex-col gap-4">
                      {/* Ticket Header details */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-850 pb-4">
                        <div className="min-w-0">
                          <button
                            onClick={() => setSelectedTicketId(null)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer uppercase mb-1"
                          >
                            &larr; Back to Ticket Logs
                          </button>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[10px] font-bold text-gray-450 dark:text-gray-500 bg-gray-50 dark:bg-gray-900 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-850">
                              {activeTicket.id}
                            </span>
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${
                              activeTicket.status === 'Resolved'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30'
                                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30'
                            }`}>
                              {activeTicket.status}
                            </span>
                            <span className="text-[10px] font-mono text-gray-400">Raised: {activeTicket.date}</span>
                          </div>
                          <h4 className="text-xs font-bold text-gray-900 dark:text-white mt-1.5 leading-tight">{activeTicket.subject}</h4>
                          <p className="text-[10px] font-mono text-gray-455 mt-0.5 uppercase tracking-wider">Category: {activeTicket.category}</p>
                        </div>

                        {/* Interactive Status control */}
                        <div className="flex items-center gap-2 shrink-0">
                          {activeTicket.status !== 'Resolved' ? (
                            <button
                              onClick={() => {
                                const updated = tickets.map(t => {
                                  if (t.id === activeTicket.id) {
                                    return { ...t, status: 'Resolved' };
                                  }
                                  return t;
                                });
                                saveTickets(updated);
                              }}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-250 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450 hover:bg-emerald-100 px-3 text-[10.5px] font-bold transition-all cursor-pointer shadow-3xs"
                            >
                              <CheckCircle className="h-3.5 w-3.5" /> Mark as Resolved
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                const updated = tickets.map(t => {
                                  if (t.id === activeTicket.id) {
                                    return { ...t, status: 'Open' };
                                  }
                                  return t;
                                });
                                saveTickets(updated);
                              }}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-250 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-450 hover:bg-blue-100 px-3 text-[10.5px] font-bold transition-all cursor-pointer shadow-3xs"
                            >
                              <RefreshCw className="h-3.5 w-3.5" /> Re-open Ticket
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Chat messages stream */}
                      <div className="bg-gray-50/50 dark:bg-gray-900/10 border border-gray-100 dark:border-gray-900 rounded-xl p-4 min-h-[200px] max-h-[360px] overflow-y-auto flex flex-col gap-3">
                        {activeTicket.messages.map((m, mIdx) => {
                          const isUser = m.sender === 'user';
                          return (
                            <div
                              key={mIdx}
                              className={`flex flex-col max-w-[85%] ${isUser ? 'self-end items-end' : 'self-start items-start'}`}
                            >
                              <div className="flex items-center gap-1 mb-0.5 text-[9px] font-mono font-bold text-gray-400 uppercase select-none">
                                <span>{isUser ? `You (${name ? name.split(' ')[0] : 'Customer'})` : 'Support Desk'}</span>
                                <span>•</span>
                                <span>{m.timestamp}</span>
                              </div>
                              <div className={`p-3 rounded-2xl text-[11px] leading-relaxed font-sans font-normal ${
                                isUser
                                  ? 'bg-indigo-600 text-white rounded-tr-none'
                                  : 'bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none'
                              }`}>
                                {m.text}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Interactive sandbox reply simulator box */}
                      {activeTicket.status !== 'Resolved' && (
                        <div className="bg-indigo-50/30 dark:bg-indigo-950/5 border border-indigo-100/50 dark:border-indigo-900/30 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="flex-1">
                            <span className="block text-[9px] font-bold text-indigo-900 dark:text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-1">
                              <Sparkles className="h-3.5 w-3.5 text-indigo-500 animate-pulse" /> Live Support Handshake
                            </span>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-light leading-normal">
                              Simulate an immediate technical support helper reply to test conversational loops.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const userNameFirst = name ? name.split(' ')[0] : 'there';
                              const simulatedReplies = [
                                `Hi ${userNameFirst}! I've run a physical status audit with our Nairobi depot and can confirm your parcel dispatch timeline is healthy.`,
                                `Thank you for the update ${userNameFirst}, our support representative is reviewing this information as we speak.`,
                                `Got it! Your ticket notes and preferences have been successfully synced and updated.`,
                                `Our core technician is analyzing the request. We've updated your support log chronicle.`
                              ];
                              const randomReply = simulatedReplies[Math.floor(Math.random() * simulatedReplies.length)];

                              const automatedResponse = {
                                sender: 'agent',
                                text: randomReply,
                                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              };

                              setTickets(prev => prev.map(t => {
                                if (t.id === activeTicket.id) {
                                  return {
                                    ...t,
                                    messages: [...t.messages, automatedResponse],
                                    status: 'In Progress'
                                  };
                                }
                                return t;
                              }));
                            }}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 text-[10.5px] font-bold shadow-3xs cursor-pointer select-none transition-all hover:scale-102 whitespace-nowrap self-stretch sm:self-auto"
                          >
                            <Sparkles className="h-3.5 w-3.5" /> Simulate Support Reply
                          </button>
                        </div>
                      )}

                      {/* Message Input bar */}
                      {activeTicket.status !== 'Resolved' ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!ticketReplyText.trim()) return;

                            const userMsg = {
                              sender: 'user',
                              text: ticketReplyText.trim(),
                              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            };

                            const nextTickets = tickets.map(t => {
                              if (t.id === activeTicket.id) {
                                return {
                                  ...t,
                                  messages: [...t.messages, userMsg],
                                  status: 'Open'
                                };
                              }
                              return t;
                            });
                            saveTickets(nextTickets);
                            setTicketReplyText('');
                          }}
                          className="flex gap-2"
                        >
                          <input
                            type="text"
                            value={ticketReplyText}
                            onChange={(e) => setTicketReplyText(e.target.value)}
                            placeholder="Type reply message here..."
                            className="h-9.5 w-full rounded-xl border border-gray-200 dark:border-gray-850 bg-white dark:bg-gray-950 px-3 text-xs font-semibold text-gray-800 dark:text-gray-105 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <button
                            type="submit"
                            className="h-9.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center cursor-pointer transition-colors"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      ) : (
                        <div className="py-2.5 text-center bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-150 rounded-xl">
                          <p className="text-xs text-gray-400 italic">This ticket is marked resolved. Re-open it above to send replies.</p>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* Wishlist Tab Component */}
          {activeDashboardTab === 'wishlist' && (
            <div className="flex flex-col gap-6">
              <div className="rounded-xl border border-gray-100 dark:border-gray-850 bg-white dark:bg-gray-950 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-850 pb-4 mb-4">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Heart className="h-4.5 w-4.5 text-rose-500 fill-rose-500 animate-pulse" /> {t('mySavedWishlist')}
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-extralight mt-0.5">
                      {t('wishlistDesc')}
                    </p>
                  </div>
                  {products.filter((p) => wishlist.includes(p.id)).length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {/* View Mode Toggle: List vs Grid */}
                      <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-850 p-1 rounded-lg border border-gray-200/80 dark:border-gray-800">
                        <button
                          type="button"
                          onClick={() => setWishlistViewMode('list')}
                          className={`px-2.5 py-1 text-xs font-bold rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                            wishlistViewMode === 'list'
                              ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                          }`}
                          title="Display saved items in a clean list view"
                          id="btn-wishlist-view-list"
                        >
                          <List className="h-3.5 w-3.5" />
                          <span>List</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWishlistViewMode('grid')}
                          className={`px-2.5 py-1 text-xs font-bold rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                            wishlistViewMode === 'grid'
                              ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                          }`}
                          title="Display saved items in a grid view"
                          id="btn-wishlist-view-grid"
                        >
                          <Grid className="h-3.5 w-3.5" />
                          <span>Grid</span>
                        </button>
                      </div>

                      <button
                        onClick={() => setShowClearWishlistConfirm(true)}
                        className="rounded-lg border border-gray-200 dark:border-gray-800 hover:border-rose-300 dark:hover:border-rose-900 hover:bg-rose-50/35 dark:hover:bg-rose-950/20 text-gray-600 dark:text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 font-semibold text-xs px-3.5 py-1.5 transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Empty all saved products from your wishlist"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> {t('clearAll')}
                      </button>
                      <button
                        onClick={() => setShowMoveAllToCartConfirm(true)}
                        className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3.5 py-1.5 transition-colors flex items-center gap-1.5 cursor-pointer shadow-3xs"
                        title="Move all saved items to shopping cart"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" /> {t('moveAllToCart')}
                      </button>
                    </div>
                  )}
                </div>

                {showClearWishlistConfirm && products.filter((p) => wishlist.includes(p.id)).length > 0 && (
                  <div className="mb-4 rounded-xl border border-rose-100 dark:border-rose-950/50 bg-rose-50/30 dark:bg-rose-950/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4.5 w-4.5 text-rose-500 shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300 font-medium">
                        Are you sure you want to empty your entire saved wishlist (<strong className="text-gray-900 dark:text-white font-bold">{products.filter((p) => wishlist.includes(p.id)).length} items</strong>)? This action cannot be undone.
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setShowClearWishlistConfirm(false)}
                        className="rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-850 px-3 py-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          onClearWishlist();
                          setShowClearWishlistConfirm(false);
                        }}
                        className="rounded bg-rose-600 hover:bg-rose-700 text-white px-3 py-1 text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        Confirm Clear
                      </button>
                    </div>
                  </div>
                )}

                {showMoveAllToCartConfirm && products.filter((p) => wishlist.includes(p.id)).length > 0 && (
                  <div className="mb-4 rounded-xl border border-indigo-150 dark:border-indigo-950/50 bg-indigo-50/30 dark:bg-indigo-950/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-4.5 w-4.5 text-indigo-500 shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300 font-medium">
                        Are you sure you want to move all <strong className="text-gray-900 dark:text-white font-bold">{products.filter((p) => wishlist.includes(p.id)).length} saved items</strong> from your wishlist to your shopping cart?
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setShowMoveAllToCartConfirm(false)}
                        className="rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-850 px-3 py-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          handleAddAllToCart();
                          setShowMoveAllToCartConfirm(false);
                        }}
                        className="rounded bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        Confirm Move
                      </button>
                    </div>
                  </div>
                )}

                {/* Main Wishlist grid */}
                {products.filter((p) => wishlist.includes(p.id)).length === 0 ? (
                  <div className="py-12 text-center max-w-md mx-auto">
                    <div className="relative mx-auto w-40 h-40 mb-5 overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 shadow-[0_8px_24px_rgba(0,0,0,0.02)] bg-gray-50/50 dark:bg-gray-900/50">
                      <img
                        src="/src/assets/images/empty_wishlist_illustration_1784573147113.jpg"
                        alt="Empty Wishlist Illustration"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">{t('noSavedWishlist')}</h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs mx-auto mb-5 leading-relaxed font-extralight">
                      Explore the Veloce Store catalog, find products you love, and toggle the heart icon to save them here for quick access!
                    </p>
                    {setCurrentTab && (
                      <button
                        onClick={() => setCurrentTab('store')}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 cursor-pointer shadow-md shadow-indigo-500/10 transition-all hover:scale-102"
                      >
                        <ShoppingBag className="h-4 w-4" /> Go to Store Now
                      </button>
                    )}
                  </div>
                ) : wishlistViewMode === 'list' ? (
                  <div className="flex flex-col gap-3">
                    {products.filter((p) => wishlist.includes(p.id)).map((p) => {
                      const { hasDiscount: hasPriceDrop, originalPrice: previousPriceVal, discountPercent: discountPercentage } = getProductDiscountInfo(p);
                      const isLowStock = p.stock !== null && p.stock > 0 && p.stock <= 5;
                      const isOutOfStock = p.stock !== null && p.stock === 0;
                      const isInCart = cart.some((item) => item.product.id === p.id);

                      return (
                        <div
                          key={`wishlist-list-${p.id}`}
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-700/60 transition-all gap-4 shadow-2xs group"
                        >
                          {/* Left Section: Image + Info */}
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200/60 dark:border-gray-800">
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                referrerPolicy="no-referrer"
                              />
                              {hasPriceDrop && (
                                <span className="absolute left-1 top-1 bg-emerald-600 text-white font-mono font-extrabold text-[8px] px-1 py-0.2 rounded shadow-xs animate-pulse">
                                  -{discountPercentage}%
                                </span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-100/50 dark:border-indigo-900/30">
                                  {p.category}
                                </span>
                                {p.sku && (
                                  <span className="text-[9px] font-mono text-gray-400 dark:text-gray-500">
                                    SKU: {p.sku}
                                  </span>
                                )}
                              </div>

                              <h4 className="text-sm font-bold text-gray-900 dark:text-white mt-1 truncate">
                                {p.name}
                              </h4>

                              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                <div className="flex flex-col font-mono">
                                  {hasPriceDrop && previousPriceVal && (
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 line-through">
                                      KSh {previousPriceVal.toLocaleString('en-KE')}
                                    </span>
                                  )}
                                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                                    KSh {p.price.toLocaleString('en-KE')}
                                  </span>
                                </div>

                                {hasPriceDrop && (
                                  <span className="inline-flex items-center gap-1 font-mono font-black text-[9px] text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-150 dark:border-rose-900/40 uppercase">
                                    <Sparkles className="h-2.5 w-2.5" /> ON SALE -{discountPercentage}%
                                  </span>
                                )}

                                {/* Stock status badge */}
                                {isOutOfStock ? (
                                  <span className="inline-flex items-center gap-1 font-mono font-bold text-[10px] text-rose-600 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded border border-rose-100/30">
                                    OUT OF STOCK
                                  </span>
                                ) : isLowStock ? (
                                  <span className="inline-flex items-center gap-1 font-mono font-bold text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded border border-amber-100/30 animate-pulse">
                                    LOW STOCK ({p.stock})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-mono font-bold text-[10px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-100/30">
                                    IN STOCK
                                  </span>
                                )}

                                {isInCart && (
                                  <span className="inline-flex items-center gap-1 font-mono font-bold text-[10px] text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-100/40">
                                    <ShoppingCart className="h-3 w-3 fill-current" /> IN CART
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right Section: Actions */}
                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
                            {setCurrentTab && (
                              <button
                                onClick={() => setCurrentTab('store')}
                                className="h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-all cursor-pointer shadow-5xs"
                                title="View details in store catalog"
                              >
                                View Details
                              </button>
                            )}

                            <button
                              onClick={() => onAddToCart(p, 1, {})}
                              disabled={isOutOfStock}
                              className={`h-8 px-3.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer ${
                                isOutOfStock
                                  ? 'bg-gray-100 dark:bg-gray-900 text-gray-400 cursor-not-allowed border border-transparent'
                                  : isInCart
                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-100/30'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              }`}
                            >
                              {isInCart ? (
                                <>
                                  <Check className="h-3.5 w-3.5" /> Add More
                                </>
                              ) : (
                                <>
                                  <ShoppingCart className="h-3.5 w-3.5" /> Add to Cart
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => onToggleWishlist(p.id)}
                              className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all cursor-pointer border border-transparent"
                              title="Remove from saved wishlist"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {products.filter((p) => wishlist.includes(p.id)).map((p) => {
                      const { hasDiscount: hasPriceDrop, originalPrice: previousPriceVal, discountPercent: discountPercentage } = getProductDiscountInfo(p);
                      const isLowStock = p.stock !== null && p.stock > 0 && p.stock <= 5;
                      const isOutOfStock = p.stock !== null && p.stock === 0;
                      const isInCart = cart.some((item) => item.product.id === p.id);

                      return (
                        <div key={`wishlist-card-${p.id}`} className="flex flex-col justify-between border border-gray-100 dark:border-gray-850 bg-gray-50/20 dark:bg-gray-900/40 rounded-xl p-4 hover:shadow-xs hover:border-gray-200 dark:hover:border-gray-800 transition-all group relative">
                          <div className="flex gap-4">
                            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-55/15 dark:bg-gray-950 border border-indigo-50/50 dark:border-gray-800">
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                referrerPolicy="no-referrer"
                              />
                              {hasPriceDrop && (
                                <span className="absolute left-1 top-1 bg-rose-600 text-white font-mono font-extrabold text-[8px] px-1.5 py-0.5 rounded shadow-xs flex items-center gap-0.5 z-10">
                                  <Sparkles className="h-2 w-2" /> ON SALE -{discountPercentage}%
                                </span>
                              )}
                              {isInCart && (
                                <span className="absolute right-1 top-1 bg-indigo-600 text-white font-mono font-extrabold text-[8px] px-1 py-0.2 rounded shadow-xs flex items-center gap-0.5">
                                  <ShoppingCart className="h-2 w-2 fill-current" />
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div>
                                <div className="flex items-start justify-between gap-1">
                                  <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate pr-6">{p.name}</h4>
                                  <button
                                    onClick={() => onToggleWishlist(p.id)}
                                    className="absolute right-3 top-3 p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 rounded-md transition-all cursor-pointer border border-transparent"
                                    title="Remove from saved items"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <span className="inline-block text-[9px] font-mono uppercase tracking-wider text-indigo-500 dark:text-indigo-400 font-bold mb-1">
                                  {p.category}
                                </span>
                                {p.sku && (
                                  <span className="block text-[8px] font-mono text-gray-400 dark:text-gray-500">
                                    SKU: {p.sku}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-col mt-1">
                                {hasPriceDrop && previousPriceVal && (
                                  <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 line-through">
                                    KSh {previousPriceVal.toLocaleString('en-KE')}
                                  </span>
                                )}
                                <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">
                                  KSh {p.price.toLocaleString('en-KE')}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-850 flex items-center justify-between gap-2">
                            <div className="text-[10px] flex items-center gap-1.5 flex-wrap">
                              {isOutOfStock ? (
                                <span className="inline-flex items-center gap-1 font-mono font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded border border-rose-100/30">
                                  OUT OF STOCK
                                </span>
                              ) : isLowStock ? (
                                <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-100/30 animate-pulse">
                                  LOW STOCK ({p.stock})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-750 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-100/30">
                                  IN STOCK
                                </span>
                              )}
                              {isInCart && (
                                <span className="inline-flex items-center gap-1 font-mono font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 px-1.5 py-0.5 rounded border border-indigo-100/30 dark:border-indigo-900/40">
                                  <ShoppingCart className="h-2.5 w-2.5 fill-current" /> IN CART
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {setCurrentTab && (
                                <button
                                  onClick={() => setCurrentTab('store')}
                                  className="h-7 px-2.5 rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-[10px] font-bold text-gray-700 dark:text-gray-300 transition-all cursor-pointer shadow-5xs"
                                  title="View product details in catalog"
                                >
                                  View Details
                                </button>
                              )}
                              <button
                                onClick={() => onAddToCart(p, 1, {})}
                                disabled={isOutOfStock}
                                className={`h-7 px-3 rounded text-[10px] font-bold flex items-center gap-1 transition-all shadow-5xs cursor-pointer ${
                                  isOutOfStock
                                    ? 'bg-gray-100 dark:bg-gray-900 text-gray-400 cursor-not-allowed border border-transparent'
                                    : isInCart
                                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-100/30'
                                      : 'bg-indigo-600 hover:bg-indigo-700 text-white font-bold'
                                }`}
                              >
                                {isInCart ? (
                                  <>
                                    <Check className="h-3 w-3" /> Add More
                                  </>
                                ) : (
                                  <>
                                    <ShoppingCart className="h-3 w-3" /> Add to Cart
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeDashboardTab === 'returns' && (
            <div className="rounded-xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] animate-in fade-in duration-200">
              <div className="border-b border-gray-100 dark:border-gray-850 pb-4 mb-5">
                <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <RefreshCw className="h-4.5 w-4.5 text-indigo-600 animate-spin-slow" /> Returns, Exchanges & Refunds Center
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-extralight mt-0.5">
                  Manage reverse logistic streams, track shipping labels, and inspect active exchange requests.
                </p>
              </div>

              {(() => {
                const userReturns = returnRequests.filter(req => req.customerEmail.toLowerCase() === email.toLowerCase());
                
                if (userReturns.length === 0) {
                  return (
                    <div className="py-14 text-center flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="h-12 w-12 rounded-full bg-gray-50 dark:bg-gray-900/60 flex items-center justify-center text-gray-400 mb-4 border border-gray-100 dark:border-gray-850">
                        <Package className="h-6 w-6" />
                      </div>
                      <h4 className="text-xs font-bold text-gray-950 dark:text-gray-200">No Return Log Found</h4>
                      <p className="text-[11px] text-gray-450 dark:text-gray-400 font-light mt-1.5 leading-relaxed">
                        To submit a refund or replacement request, please go to the <button onClick={() => setActiveDashboardTab('orders')} className="text-indigo-600 dark:text-indigo-400 font-semibold underline focus:outline-hidden hover:text-indigo-700">Orders & Spend</button> tab and click the <strong className="font-semibold text-indigo-950 dark:text-gray-200">"Return / Exchange"</strong> button next to any completed order.
                      </p>
                    </div>
                  );
                }

                const totalRequests = userReturns.length;
                const pendingCount = userReturns.filter(r => r.status === 'pending').length;
                const approvedCount = userReturns.filter(r => r.status === 'approved' || r.status === 'resolved').length;

                return (
                  <div className="space-y-6">
                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg border border-gray-100 dark:border-gray-850 bg-gray-50/50 dark:bg-gray-900/10 p-3 text-center">
                        <span className="block text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase font-mono tracking-wide">Total Submissions</span>
                        <span className="block text-base font-bold text-gray-900 dark:text-white mt-0.5 font-mono">{totalRequests}</span>
                      </div>
                      <div className="rounded-lg border border-gray-150 dark:border-gray-850 bg-amber-500/5 p-3 text-center">
                        <span className="block text-[9px] font-bold text-amber-600 dark:text-amber-500 uppercase font-mono tracking-wide">Awaiting Review</span>
                        <span className="block text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5 font-mono">{pendingCount}</span>
                      </div>
                      <div className="rounded-lg border border-gray-150 dark:border-gray-850 bg-emerald-500/5 p-3 text-center">
                        <span className="block text-[9px] font-bold text-emerald-600 dark:text-emerald-500 uppercase font-mono tracking-wide">Approved & Resolved</span>
                        <span className="block text-base font-bold text-emerald-600 dark:text-emerald-450 mt-0.5 font-mono">{approvedCount}</span>
                      </div>
                    </div>

                    {/* Returns List */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase font-mono tracking-wider">Active Return Tickets</h4>
                      
                      {userReturns.map((req) => (
                        <div key={req.id} className="rounded-lg border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs hover:border-indigo-150 dark:hover:border-indigo-950 transition-all">
                          {/* Ticket Header */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 dark:border-gray-900/50 pb-2.5 mb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-100/30">
                                {req.id}
                              </span>
                              <span className="text-gray-300 dark:text-gray-800">|</span>
                              <span className="text-[10.5px] text-gray-500 dark:text-gray-400">
                                Order: <span className="font-mono text-gray-700 dark:text-gray-300 font-semibold">{req.orderId}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 font-mono">{req.dateSubmitted}</span>
                              <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase border ${
                                req.status === 'resolved'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30'
                                  : req.status === 'approved'
                                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30'
                                  : req.status === 'pending'
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30'
                                  : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/30'
                              }`}>
                                {req.status}
                              </span>
                            </div>
                          </div>

                          {/* Items returned details */}
                          <div className="space-y-2 mb-3 bg-gray-50/50 dark:bg-gray-900/10 p-2.5 rounded-lg border border-gray-100 dark:border-gray-850">
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase font-mono tracking-wider">Returning Items</p>
                            {req.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs">
                                <div className="text-left">
                                  <span className="font-medium text-gray-800 dark:text-gray-200">{item.name}</span>
                                  {item.selectedVariations && Object.entries(item.selectedVariations).length > 0 && (
                                    <span className="block text-[9.5px] text-gray-400">
                                      {Object.entries(item.selectedVariations).map(([k, v]) => `${k}:${v}`).join(', ')}
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono text-gray-500 dark:text-gray-400 shrink-0 ml-4">
                                  {item.quantity} x {formatPrice(item.price)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Reason Comments */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 text-xs border-b border-gray-50 dark:border-gray-900/50 pb-3">
                            <div>
                              <span className="text-gray-400 block text-[9.5px] uppercase font-mono tracking-wider mb-0.5">Return Reason</span>
                              <span className="font-semibold text-gray-700 dark:text-gray-300">
                                {req.reason === 'bad_fit' && 'Wrong size / Color Fit'}
                                {req.reason === 'defective' && 'Damaged / Defective piece'}
                                {req.reason === 'wrong_item' && 'Wrong Item Sent / Not as described'}
                                {req.reason === 'changed_mind' && 'No longer needed / Changed mind'}
                                {req.reason === 'other' && 'Other Reason'}
                              </span>
                              {req.reasonDetails && (
                                <p className="text-[10.5px] text-gray-500 dark:text-gray-400 font-extralight italic mt-1 bg-gray-50/30 p-1.5 rounded">
                                  "{req.reasonDetails}"
                                </p>
                              )}
                            </div>
                            <div className="md:border-l md:border-gray-100 md:dark:border-gray-850/50 md:pl-3">
                              <span className="text-gray-400 block text-[9.5px] uppercase font-mono tracking-wider mb-0.5">Method & Replacement</span>
                              <span className="font-semibold capitalize text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                <RefreshCw className="h-3.5 w-3.5" /> {req.type} Requested
                              </span>
                              {req.exchangeVariant && (
                                <p className="text-[10.5px] text-gray-500 dark:text-gray-400 font-medium mt-1">
                                  Exchange Choice: <span className="text-gray-800 dark:text-gray-300 font-semibold">{req.exchangeVariant}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Merchant Decision Note */}
                          {req.adminNote && (
                            <div className="mb-3.5 p-3 rounded-lg bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100/30 dark:border-indigo-950/40 text-xs text-indigo-850 dark:text-indigo-300 animate-in fade-in duration-150 text-left">
                              <strong className="font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-1 mb-1">
                                <CheckCircle className="h-4 w-4 text-indigo-500" /> Merchant Feedback Action
                              </strong>
                              <p className="font-light">{req.adminNote}</p>
                            </div>
                          )}

                          {/* Return Shipping Tracking Pipeline */}
                          {req.trackingNumber && (
                            <div className="bg-gray-50/50 dark:bg-gray-900/20 p-3 rounded-lg border border-gray-100 dark:border-gray-850 text-xs space-y-2.5">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-gray-400 text-[10px] uppercase font-mono tracking-wider">Reverse Logistics Tracker</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[10px] text-gray-700 dark:text-gray-300">
                                    Label: <strong className="font-semibold">{req.trackingNumber}</strong>
                                  </span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(req.trackingNumber || '');
                                    }}
                                    className="p-1 rounded bg-white hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 border border-gray-150 dark:border-gray-800 text-gray-400 hover:text-gray-600 cursor-pointer transition-all"
                                    title="Copy shipping tracking code"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Progress bar stream */}
                              <div className="pt-2">
                                <div className="relative flex items-center justify-between">
                                  {/* Line background */}
                                  <div className="absolute left-1/10 right-1/10 top-2.5 h-0.5 bg-gray-200 dark:bg-gray-800 z-0" />
                                  <div
                                    className="absolute left-1/10 top-2.5 h-0.5 bg-indigo-550 dark:bg-indigo-500 z-0 transition-all duration-500"
                                    style={{
                                      width: 
                                        req.status === 'pending' ? '0%' :
                                        req.status === 'approved' ? '50%' :
                                        req.status === 'resolved' ? '100%' : '100%'
                                    }}
                                  />

                                  {/* Steps */}
                                  <div className="flex flex-col items-center z-10">
                                    <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold border transition-colors ${
                                      req.status !== 'rejected' 
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-red-50 text-red-500 border-red-500'
                                    }`}>
                                      1
                                    </div>
                                    <span className="text-[9px] text-gray-500 font-mono mt-1 font-semibold">Submitted</span>
                                  </div>

                                  <div className="flex flex-col items-center z-10">
                                    <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold border transition-colors ${
                                      req.status === 'approved' || req.status === 'resolved'
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white dark:bg-gray-900 text-gray-450 border-gray-200 dark:border-gray-800'
                                    }`}>
                                      2
                                    </div>
                                    <span className="text-[9px] text-gray-500 font-mono mt-1 font-semibold">Label Issued</span>
                                  </div>

                                  <div className="flex flex-col items-center z-10">
                                    <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold border transition-colors ${
                                      req.status === 'resolved'
                                        ? 'bg-emerald-500 text-white border-emerald-500'
                                        : 'bg-white dark:bg-gray-900 text-gray-450 border-gray-200 dark:border-gray-800'
                                    }`}>
                                      3
                                    </div>
                                    <span className="text-[9px] text-gray-500 font-mono mt-1 font-semibold">Processed</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {selectedPrintOrder && (
        <OrderReceiptModal
          order={orders.find((o) => o.id === selectedPrintOrder.id) || selectedPrintOrder}
          onClose={() => {
            setSelectedPrintOrder(null);
            setAutoPrintOnce(false);
          }}
          autoPrint={autoPrintOnce}
          shippingStatus={localShippingStatuses[selectedPrintOrder.id] || (selectedPrintOrder.status === 'completed' ? 'delivered' : 'processing')}
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

      <OrderStatusModal
        isOpen={isTrackingModalOpen}
        onClose={() => {
          setIsTrackingModalOpen(false);
          setTrackingOrderId(null);
        }}
        orders={orders}
        products={products}
        initialOrderId={trackingOrderId}
      />

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
            if (onCreateReturnRequest) {
              onCreateReturnRequest(request);
            }
            setActiveDashboardTab('returns');
          }}
        />
      )}
    </div>
  );
}
