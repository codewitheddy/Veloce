import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, X, CheckCircle2, MapPin, TrendingUp, Flame, Radio } from 'lucide-react';
import { Product, Order } from '../types';
import { useOrders } from '../context/OrdersContext';
import { orderService } from '../services/api';
import { mapBackendOrderToFrontend } from '../api/orders';

interface SocialProofToastProps {
  products: Product[];
  orders?: Order[];
  onSelectProduct: (product: Product) => void;
  darkMode?: boolean;
  userRole?: 'customer' | 'admin';
  currentTab?: string;
}

export interface PurchaseEvent {
  id: string;
  orderId?: string;
  buyerName: string;
  location: string;
  product: Product;
  timeAgo: string;
  isRealOrder: boolean;
  isLiveOrder?: boolean;
}

// Fallback seed buyers if catalog has zero historical orders
const FALLBACK_BUYERS = [
  'Wanjiku M.', 'Otieno O.', 'Kamau N.', 'Fatuma A.', 'Kiprop K.', 
  'Nafula S.', 'Mwangi J.', 'Njoroge K.', 'Amina Y.', 'Mutesi J.',
  'Marcus T.', 'Sarah J.', 'Pierre L.', 'Emma B.', 'Kenji T.'
];

const FALLBACK_LOCATIONS = [
  'Westlands, Nairobi', 'Kilimani, Nairobi', 'Nyali, Mombasa', 
  'Milimani, Kisumu', 'Nakuru, Kenya', 'Eldoret, Kenya', 
  'Karen, Nairobi', 'Diani, Mombasa', 'Thika, Kenya'
];

/**
 * Clean & format customer name for social proof privacy and authenticity
 * e.g. "Sarah Jenkins" -> "Sarah J.", "Otieno" -> "Otieno"
 */
export function formatCustomerName(rawName?: string, email?: string): string {
  const clean = (rawName || '').trim();
  if (!clean || clean.toLowerCase() === 'customer' || clean.toLowerCase() === 'guest') {
    if (email && email.includes('@')) {
      const emailPrefix = email.split('@')[0].replace(/[._0-9-]/g, ' ').trim();
      const capitalized = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
      return capitalized || 'Verified Buyer';
    }
    return 'Verified Buyer';
  }

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0];
  }

  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

/**
 * Intelligently parse real customer origin from shipping address or pickup point
 */
export function extractCustomerOrigin(shippingAddress?: string, pickupLocation?: string): string {
  const raw = (shippingAddress || pickupLocation || '').trim();
  if (!raw) return 'Nairobi, Kenya';

  const lower = raw.toLowerCase();

  // Kenyan Towns and Nairobi Neighborhoods
  const NAIROBI_HOODS = [
    'westlands', 'kilimani', 'kileleshwa', 'lavington', 'karen', 'runda', 
    'parklands', 'south b', 'south c', 'langata', 'eastleigh', 'ruaka', 
    'gigiri', 'muthaiga', 'kasarani', 'roysambu', 'ngong'
  ];

  for (const hood of NAIROBI_HOODS) {
    if (lower.includes(hood)) {
      const formatted = hood.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return `${formatted}, Nairobi`;
    }
  }

  const COAST_AREAS = ['nyali', 'bamburi', 'changamwe', 'likoni', 'diani', 'malindi', 'miritini'];
  for (const coast of COAST_AREAS) {
    if (lower.includes(coast)) {
      const formatted = coast.charAt(0).toUpperCase() + coast.slice(1);
      return `${formatted}, Mombasa`;
    }
  }

  const MAJOR_TOWNS = [
    'nairobi', 'mombasa', 'kisumu', 'nakuru', 'eldoret', 'thika', 'kiambu', 
    'naivasha', 'nyeri', 'machakos', 'kitale', 'kericho', 'meru', 'kakamega',
    'garissa', 'lamu', 'kilifi', 'embu', 'kisii', 'kajiado', 'nanyuki'
  ];

  for (const town of MAJOR_TOWNS) {
    if (lower.includes(town)) {
      const formatted = town.charAt(0).toUpperCase() + town.slice(1);
      return `${formatted}, Kenya`;
    }
  }

  // Global Hubs
  const GLOBAL_HUBS: Record<string, string> = {
    'london': 'London, UK',
    'manchester': 'Manchester, UK',
    'dubai': 'Dubai, UAE',
    'new york': 'New York, USA',
    'kampala': 'Kampala, Uganda',
    'kigali': 'Kigali, Rwanda',
    'dar es salaam': 'Dar es Salaam, Tanzania',
    'johannesburg': 'Johannesburg, South Africa',
    'cairo': 'Cairo, Egypt',
    'lagos': 'Lagos, Nigeria'
  };

  for (const [key, label] of Object.entries(GLOBAL_HUBS)) {
    if (lower.includes(key)) {
      return label;
    }
  }

  // If comma-delimited, take meaningful locality parts
  const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const loc = parts[parts.length - 2].replace(/[0-9#-]/g, '').trim();
    const region = parts[parts.length - 1].replace(/[0-9#-]/g, '').trim();
    if (loc && region) {
      return `${loc}, ${region}`;
    }
  }

  const cleaned = raw.replace(/[0-9#-]/g, '').trim();
  return cleaned.length > 2 && cleaned.length < 30 ? cleaned : 'Nairobi, Kenya';
}

/**
 * Format timestamp into natural relative time
 */
export function formatOrderTimeAgo(timestampStr?: string): string {
  if (!timestampStr) return 'Recently';

  try {
    const now = Date.now();
    const orderTime = new Date(timestampStr).getTime();
    if (isNaN(orderTime)) return 'Recently';

    const diffMs = Math.max(0, now - orderTime);
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return `${Math.floor(diffDays / 7)}w ago`;
  } catch {
    return 'Recently';
  }
}

/**
 * Ensure a fully-typed Product object is resolved for any ordered item
 */
function resolveProductForItem(
  item: { productId?: string; name: string; price: number; type?: any },
  productsList: Product[]
): Product {
  const found = productsList.find(
    (p) => p.id === item.productId || p.name.toLowerCase() === item.name.toLowerCase()
  );
  if (found) return found;

  return {
    id: item.productId || `prod-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    sku: `SKU-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    name: item.name,
    description: item.name,
    price: Number(item.price || 0),
    category: 'Store Item',
    tags: ['featured'],
    type: item.type === 'digital' || item.type === 'service' ? item.type : 'physical',
    imageUrl: productsList[0]?.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
    stock: 10,
    rating: 5,
    reviewsCount: 1,
    reviews: []
  };
}

export default function SocialProofToast({
  products,
  orders: propOrders,
  onSelectProduct,
  darkMode = false,
  userRole = 'customer',
  currentTab = 'home'
}: SocialProofToastProps) {
  // Safe context hook fallback
  let contextOrders: Order[] = [];
  try {
    const ordersCtx = useOrders();
    contextOrders = ordersCtx.orders || [];
  } catch {
    // ignore if outside provider
  }

  const [liveOrders, setLiveOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('veloce_orders');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return propOrders || contextOrders || [];
  });

  const [currentPurchase, setCurrentPurchase] = useState<PurchaseEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('veloce_mute_social_proof') === 'true';
  });

  const [dismissedSales, setDismissedSales] = useState<string[]>([]);
  const [productShowcaseCounts, setProductShowcaseCounts] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('veloce_product_showcase_counts');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {};
  });

  const isAdminSide = userRole === 'admin' || currentTab === 'admin';

  // Sync orders from backend and props
  useEffect(() => {
    if (propOrders && propOrders.length > 0) {
      setLiveOrders(propOrders);
    } else if (contextOrders && contextOrders.length > 0) {
      setLiveOrders(contextOrders);
    } else {
      orderService.getOrders().then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLiveOrders(data.map(mapBackendOrderToFrontend));
        }
      }).catch(() => {});
    }
  }, [propOrders, contextOrders]);

  // Listen for real-time live order broadcasts across tabs & window
  useEffect(() => {
    const handleNewOrder = (order: Order) => {
      if (!order || !order.items || order.items.length === 0) return;

      setLiveOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);

      if (isMuted || isAdminSide) return;

      // Extract product
      const item = order.items[0];
      const matchedProduct = resolveProductForItem(item, products);

      const liveEvent: PurchaseEvent = {
        id: `live-${order.id}-${Date.now()}`,
        orderId: order.id,
        buyerName: formatCustomerName(order.customerName, order.customerEmail),
        location: extractCustomerOrigin(order.shippingAddress, order.pickupLocation),
        product: matchedProduct,
        timeAgo: 'Just now',
        isRealOrder: true,
        isLiveOrder: true
      };

      // Instantly pop up new real order
      setIsVisible(false);
      setTimeout(() => {
        setCurrentPurchase(liveEvent);
        setIsVisible(true);
      }, 350);
    };

    // 1. Listen via CustomEvent
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<Order>;
      if (customEvent && customEvent.detail) {
        handleNewOrder(customEvent.detail);
      }
    };
    window.addEventListener('veloce_new_order', handleCustomEvent);

    // 2. Listen via BroadcastChannel
    let broadcastChannel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        broadcastChannel = new BroadcastChannel('veloce_order_notifications_channel');
        broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'NEW_ORDER_PLACED' && event.data.order) {
            handleNewOrder(event.data.order);
          }
        };
      } catch (err) {
        console.warn('[SocialProofToast] BroadcastChannel init error:', err);
      }
    }

    // 3. Listen via Storage event
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'veloce_latest_new_order' && e.newValue) {
        try {
          const payload = JSON.parse(e.newValue);
          if (payload && payload.order) {
            handleNewOrder(payload.order);
          }
        } catch {
          // ignore
        }
      } else if (e.key === 'veloce_orders' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setLiveOrders(parsed);
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener('veloce_new_order', handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, [products, isMuted, isAdminSide]);

  // Compile real purchase events from live orders & products
  const realPurchaseEvents = useMemo<PurchaseEvent[]>(() => {
    if (!liveOrders || liveOrders.length === 0) return [];

    const validOrders = liveOrders.filter((ord) => ord.status !== 'cancelled' && ord.items && ord.items.length > 0);
    const events: PurchaseEvent[] = [];

    for (const order of validOrders) {
      for (const item of order.items) {
        const matchedProduct = resolveProductForItem(item, products);
        const timestamp = order.date || order.statusHistory?.[0]?.timestamp;

        events.push({
          id: `order-item-${order.id}-${item.productId}`,
          orderId: order.id,
          buyerName: formatCustomerName(order.customerName, order.customerEmail),
          location: extractCustomerOrigin(order.shippingAddress, order.pickupLocation),
          product: matchedProduct,
          timeAgo: formatOrderTimeAgo(timestamp),
          isRealOrder: true
        });
      }
    }

    return events;
  }, [liveOrders, products]);

  // Trigger social proof rotation
  const triggerNotification = useCallback(() => {
    if (isMuted || isAdminSide || products.length === 0) return;

    let selectedPurchase: PurchaseEvent;

    // Prioritize 100% real customer orders whenever present
    if (realPurchaseEvents.length > 0) {
      // Pick a real purchase event that wasn't recently dismissed
      const available = realPurchaseEvents.filter(
        (ev) => !dismissedSales.includes(`${ev.buyerName}-${ev.product.id}`)
      );
      const pool = available.length > 0 ? available : realPurchaseEvents;
      selectedPurchase = pool[Math.floor(Math.random() * pool.length)];
    } else {
      // Graceful fallback for brand-new store with zero orders yet
      const randomProduct = products[Math.floor(Math.random() * products.length)];
      const randomBuyer = FALLBACK_BUYERS[Math.floor(Math.random() * FALLBACK_BUYERS.length)];
      const randomLocation = FALLBACK_LOCATIONS[Math.floor(Math.random() * FALLBACK_LOCATIONS.length)];

      selectedPurchase = {
        id: `mock-seed-${Math.random().toString(36).substr(2, 9)}`,
        buyerName: randomBuyer,
        location: randomLocation,
        product: randomProduct,
        timeAgo: 'Recently',
        isRealOrder: false
      };
    }

    // Increment showcase frequency
    setProductShowcaseCounts((prev) => {
      const currentCount = prev[selectedPurchase.product.id] || 0;
      const updated = { ...prev, [selectedPurchase.product.id]: currentCount + 1 };
      try {
        localStorage.setItem('veloce_product_showcase_counts', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    if (isVisible) {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentPurchase(selectedPurchase);
        setIsVisible(true);
      }, 400);
    } else {
      setCurrentPurchase(selectedPurchase);
      setIsVisible(true);
    }
  }, [isMuted, isAdminSide, products, realPurchaseEvents, dismissedSales, isVisible]);

  // Timer scheduling
  useEffect(() => {
    if (isMuted || isAdminSide) {
      setIsVisible(false);
      return;
    }

    // Initial trigger after 10 seconds
    const initialTimer = setTimeout(() => {
      triggerNotification();
    }, 10000);

    // Periodic rotation every 38 seconds
    const intervalTimer = setInterval(() => {
      triggerNotification();
    }, 38000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [triggerNotification, isMuted, isAdminSide]);

  // Auto dismiss after 7.5 seconds
  useEffect(() => {
    if (isVisible) {
      const dismissTimer = setTimeout(() => {
        setIsVisible(false);
      }, 7500);
      return () => clearTimeout(dismissTimer);
    }
  }, [isVisible, currentPurchase]);

  const handleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(true);
    setIsVisible(false);
    localStorage.setItem('veloce_mute_social_proof', 'true');
  };

  const handleViewProduct = () => {
    if (currentPurchase) {
      onSelectProduct(currentPurchase.product);
      setIsVisible(false);
    }
  };

  if (isMuted || isAdminSide) return null;

  const totalOrdersCount = Math.max(liveOrders.length, realPurchaseEvents.length, 1);
  const velocityPercentage = Math.min(100, Math.round((totalOrdersCount / Math.max(totalOrdersCount + 10, 25)) * 100));

  return (
    <AnimatePresence>
      {isVisible && currentPurchase && (
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0.8, right: 0.8 }}
          onDragEnd={(_, info) => {
            const threshold = 80;
            const velocityThreshold = 300;
            if (Math.abs(info.offset.x) > threshold || Math.abs(info.velocity.x) > velocityThreshold) {
              if (currentPurchase) {
                setDismissedSales((prev) => [...prev, `${currentPurchase.buyerName}-${currentPurchase.product.id}`]);
              }
              setIsVisible(false);
            }
          }}
          initial={{ opacity: 0, x: -40, y: 15, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 15, scale: 0.92 }}
          whileHover={{ scale: 1.02, y: -2, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
          transition={{ type: 'spring', stiffness: 280, damping: 22, mass: 0.85 }}
          className="fixed bottom-20 left-4 z-50 max-w-sm w-[340px] rounded-xl border border-indigo-100/80 dark:border-indigo-950/80 bg-white/95 dark:bg-gray-900/95 shadow-lg backdrop-blur-md p-3.5 flex gap-3 cursor-pointer select-none font-sans group transition-colors duration-250 touch-none hover:border-indigo-300 dark:hover:border-indigo-800"
          onTap={handleViewProduct}
        >
          {/* Product Thumbnail image with glow overlay on hover */}
          <div className="relative h-14 w-14 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 flex-shrink-0 overflow-hidden">
            <img
              src={currentPurchase.product.imageUrl}
              alt={currentPurchase.product.name}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-indigo-900/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            {/* HOT BADGE OVERLAY ON THUMBNAIL */}
            {((productShowcaseCounts[currentPurchase.product.id] || 0) > 3) && (
              <div className="absolute top-0 left-0 bg-rose-600 text-white text-[7.5px] font-extrabold uppercase font-mono tracking-wider px-1 py-0.5 rounded-br-md flex items-center gap-0.5 shadow-md z-10">
                <Flame className="h-2 w-2 text-amber-300 fill-amber-300 animate-pulse" /> Hot
              </div>
            )}
          </div>

          {/* Details Column */}
          <div className="flex-1 min-w-0">
            {/* Verified Header & Actions */}
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="flex items-center gap-1 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 font-mono tracking-wider uppercase">
                  <CheckCircle2 className="h-3 w-3" /> {currentPurchase.isLiveOrder ? 'Live Verified Order' : 'Verified Order'}
                </span>
                {currentPurchase.isLiveOrder && (
                  <span className="flex items-center gap-0.5 text-[8px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1 py-0.2 rounded font-mono uppercase tracking-wider animate-pulse">
                    <Radio className="h-2 w-2 text-red-500 animate-ping" /> Live
                  </span>
                )}
                {((productShowcaseCounts[currentPurchase.product.id] || 0) > 3) && !currentPurchase.isLiveOrder && (
                  <span className="flex items-center gap-0.5 text-[8px] font-extrabold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/35 px-1 py-0.5 rounded border border-rose-100 dark:border-rose-900/30 font-mono uppercase tracking-wider animate-pulse">
                    <Flame className="h-2 w-2 text-orange-500 fill-orange-500" /> Hot Item
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 opacity-45 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={handleMute}
                  className="text-[9px] font-mono hover:text-rose-600 font-semibold px-1 rounded hover:bg-rose-50/50 dark:hover:bg-rose-950/20 cursor-pointer"
                  title="Mute notifications"
                >
                  Mute
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsVisible(false);
                  }}
                  className="text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 p-0.5 rounded cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Notification Body Text */}
            <p className="text-[11.5px] text-gray-800 dark:text-gray-200 mt-1.5 leading-normal">
              <strong className="font-extrabold text-gray-950 dark:text-white">{currentPurchase.buyerName}</strong> from{' '}
              <span className="inline-flex items-center gap-0.5 text-indigo-900 dark:text-indigo-350 font-medium">
                <MapPin className="h-2.5 w-2.5 shrink-0" /> {currentPurchase.location}
              </span>{' '}
              purchased <span className="font-semibold text-indigo-700 dark:text-indigo-400 underline decoration-indigo-200 group-hover:decoration-indigo-500 transition-colors">{currentPurchase.product.name}</span>
            </p>

            {/* Timestamp & Icon Action */}
            <div className="mt-2 flex items-center justify-between text-[9px] text-gray-400 dark:text-gray-500 font-mono font-medium">
              <span>{currentPurchase.timeAgo}</span>
              <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold uppercase group-hover:translate-x-0.5 transition-transform">
                <ShoppingBag className="h-2.5 w-2.5" /> View Product →
              </span>
            </div>

            {/* Dynamic Sales Velocity indicator and progress bar */}
            <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="flex items-center gap-1 font-bold text-indigo-650 dark:text-indigo-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  <TrendingUp className="h-3 w-3 inline" /> Store Activity
                </span>
                <span className="font-mono text-gray-500 dark:text-gray-400 font-bold">
                  {totalOrdersCount} {totalOrdersCount === 1 ? 'Order' : 'Orders'} Recorded ({velocityPercentage}% Velocity)
                </span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${velocityPercentage}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full bg-indigo-600 rounded-full"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
