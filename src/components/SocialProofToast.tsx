import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, X, CheckCircle2, MapPin, TrendingUp, Flame } from 'lucide-react';
import { Product } from '../types';

interface SocialProofToastProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  darkMode?: boolean;
  userRole?: 'customer' | 'admin';
  currentTab?: string;
}

interface MockPurchase {
  id: string;
  buyerName: string;
  location: string;
  product: Product;
  timeAgo: string;
}

const BUYERS = [
  // East African names
  'Wanjiku M.', 'Otieno O.', 'Kamau N.', 'Fatuma A.', 'Kiprop K.', 'Nafula S.', 'Mwangi J.', 
  'Njoroge K.', 'Amina Y.', 'Mutesi J.', 'Kipkemboi E.', 'Ondiek A.', 'Chacha S.',
  // European names
  'Julian R.', 'Hana V.', 'Marcus T.', 'Sarah J.', 'Pierre L.', 'Emma B.', 'Lukas S.', 
  'Sophie D.', 'Mateo G.', 'Elena N.', 'Amelie K.',
  // North & South American names
  'Aria S.', 'Devin C.', 'Chloe W.', 'James L.', 'Liam N.', 'Oliver H.', 'Maya P.', 
  'Jackson F.', 'Isabella R.', 'Mateo C.', 'Gabriela S.',
  // Asian, Oceanian & Middle Eastern names
  'Kenji T.', 'Mei Ling C.', 'Rahul S.', 'Yusuf Al-F.', 'Priya N.', 'Min-jun K.', 
  'Aisha H.', 'Lachlan M.', 'Zoe C.'
];

const LOCATIONS = [
  // African Hubs
  'Nairobi, Kenya', 'Mombasa, Kenya', 'Kisumu, Kenya', 'Nakuru, Kenya', 'Eldoret, Kenya',
  'Dar es Salaam, Tanzania', 'Kampala, Uganda', 'Kigali, Rwanda', 'Addis Ababa, Ethiopia',
  'Johannesburg, South Africa', 'Lagos, Nigeria', 'Cairo, Egypt',
  // Europe
  'London, United Kingdom', 'Manchester, United Kingdom', 'Paris, France', 'Berlin, Germany', 
  'Amsterdam, Netherlands', 'Rome, Italy', 'Madrid, Spain', 'Stockholm, Sweden',
  // Americas
  'New York, United States', 'San Francisco, United States', 'Seattle, United States', 
  'Toronto, Canada', 'Vancouver, Canada', 'São Paulo, Brazil', 'Mexico City, Mexico',
  // Asia & Oceania
  'Sydney, Australia', 'Melbourne, Australia', 'Auckland, New Zealand', 'Tokyo, Japan', 
  'Singapore, Singapore', 'Dubai, UAE', 'Mumbai, India', 'Seoul, South Korea'
];

const TIMES = [
  'Just now', '1 min ago', '2 mins ago', '3 mins ago', '5 mins ago', '8 mins ago', '12 mins ago'
];

export default function SocialProofToast({
  products,
  onSelectProduct,
  darkMode = false,
  userRole = 'customer',
  currentTab = 'home'
}: SocialProofToastProps) {
  const [currentPurchase, setCurrentPurchase] = useState<MockPurchase | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('veloce_mute_social_proof') === 'true';
  });
  const [salesCount, setSalesCount] = useState(() => {
    const saved = localStorage.getItem('veloce_simulated_sales_count');
    return saved ? parseInt(saved, 10) : 34;
  });
  const [dismissedSales, setDismissedSales] = useState<string[]>([]);
  const [productShowcaseCounts, setProductShowcaseCounts] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('veloce_product_showcase_counts');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      // ignore
    }
    const preseeded: Record<string, number> = {};
    if (products.length > 0) {
      const shuffled = [...products].sort(() => 0.5 - Math.random());
      const hotCount = Math.min(2, shuffled.length);
      for (let i = 0; i < hotCount; i++) {
        preseeded[shuffled[i].id] = 4;
      }
    }
    return preseeded;
  });

  const isAdminSide = userRole === 'admin' || currentTab === 'admin';

  // Pick a random purchase event
  const triggerRandomNotification = () => {
    if (isMuted || isAdminSide || products.length === 0) return;

    // Increment simulated sales count
    setSalesCount((prev) => {
      const next = prev >= 50 ? 30 : prev + 1;
      localStorage.setItem('veloce_simulated_sales_count', next.toString());
      return next;
    });

    // Pick a random product & buyer details, avoiding recently dismissed combinations
    let randomProduct = products[Math.floor(Math.random() * products.length)];
    let randomBuyer = BUYERS[Math.floor(Math.random() * BUYERS.length)];
    let randomLocation = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
    let randomTime = TIMES[Math.floor(Math.random() * TIMES.length)];

    let key = `${randomBuyer}-${randomProduct.id}`;
    let attempts = 0;
    while (dismissedSales.includes(key) && attempts < 15) {
      randomProduct = products[Math.floor(Math.random() * products.length)];
      randomBuyer = BUYERS[Math.floor(Math.random() * BUYERS.length)];
      randomLocation = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
      key = `${randomBuyer}-${randomProduct.id}`;
      attempts++;
    }

    const purchase: MockPurchase = {
      id: `mock-purch-${Math.random().toString(36).substr(2, 9)}`,
      buyerName: randomBuyer,
      location: randomLocation,
      product: randomProduct,
      timeAgo: randomTime,
    };

    // Increment product showcase frequency
    setProductShowcaseCounts((prev) => {
      const currentCount = prev[randomProduct.id] || 0;
      const updated = { ...prev, [randomProduct.id]: currentCount + 1 };
      try {
        localStorage.setItem('veloce_product_showcase_counts', JSON.stringify(updated));
      } catch (e) {
        // ignore
      }
      return updated;
    });

    // If already visible, fade/slide it out first, then load the next one
    if (isVisible) {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentPurchase(purchase);
        setIsVisible(true);
      }, 400); // Allow exit transition to complete gracefully
    } else {
      setCurrentPurchase(purchase);
      setIsVisible(true);
    }
  };

  useEffect(() => {
    if (isMuted || isAdminSide) {
      setIsVisible(false);
      return;
    }

    // Initial trigger after 12 seconds
    const initialTimer = setTimeout(() => {
      triggerRandomNotification();
    }, 12000);

    // Repeat every 35-50 seconds
    const intervalTimer = setInterval(() => {
      triggerRandomNotification();
    }, 42000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [products, isMuted, isAdminSide]);

  // Handle automatic toast dismiss after 7 seconds
  useEffect(() => {
    if (isVisible) {
      const dismissTimer = setTimeout(() => {
        setIsVisible(false);
      }, 7000);
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

  return (
    <AnimatePresence>
      {isVisible && currentPurchase && (
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0.8, right: 0.8 }}
          onDragEnd={(event, info) => {
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
                  <CheckCircle2 className="h-3 w-3" /> Verified Order
                </span>
                {((productShowcaseCounts[currentPurchase.product.id] || 0) > 3) && (
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
                <MapPin className="h-2.5 w-2.5" /> {currentPurchase.location}
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
                  <TrendingUp className="h-3 w-3 inline" /> Sales Velocity
                </span>
                <span className="font-mono text-gray-500 dark:text-gray-400 font-bold">
                  {Math.min(100, Math.round((salesCount / 50) * 100))}% Peak ({salesCount}/50 Limit)
                </span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.round((salesCount / 50) * 100))}%` }}
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
