/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Flame, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Star, 
  ShoppingBag, 
  Heart, 
  TrendingUp, 
  Clock, 
  ArrowRight,
  Tag,
  Check,
  Zap
} from 'lucide-react';
import { Product, CartItem } from '../types';
import LazyImage from './LazyImage';
import ProductCard from './ProductCard';
import { getProductDiscountInfo } from '../utils/productUtils';
import { CurrencyType, formatPrice } from '../lib/currency';

interface BestSellersNewArrivalsCarouselProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onAddToCart?: (product: Product, quantity: number, vars: Record<string, string>) => void;
  cart?: CartItem[];
  onViewCart?: () => void;
  wishlist?: string[];
  onToggleWishlist?: (productId: string) => void;
  className?: string;
  darkMode?: boolean;
  currency?: CurrencyType;
}

export default function BestSellersNewArrivalsCarousel({
  products,
  onSelectProduct,
  onAddToCart,
  cart = [],
  onViewCart,
  wishlist = [],
  onToggleWishlist = () => {},
  className = '',
  darkMode = false,
  currency = 'KSh',
}: BestSellersNewArrivalsCarouselProps) {
  const [activeTab, setActiveTab] = useState<'bestsellers' | 'newarrivals' | 'all'>('bestsellers');
  const [addedToastId, setAddedToastId] = useState<string | null>(null);
  const [addedProductIds, setAddedProductIds] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Compute Best Sellers (Top rated & most reviewed)
  const bestSellers = React.useMemo(() => {
    return [...products]
      .filter(p => p.status !== 'Draft' && p.status !== 'Archived')
      .sort((a, b) => {
        const scoreA = (a.rating || 0) * 20 + (a.reviewsCount || 0) * 3;
        const scoreB = (b.rating || 0) * 20 + (b.reviewsCount || 0) * 3;
        return scoreB - scoreA;
      })
      .slice(0, 8);
  }, [products]);

  // Compute New Arrivals (Latest items / digital assets / recently updated)
  const newArrivals = React.useMemo(() => {
    return [...products]
      .filter(p => p.status !== 'Draft' && p.status !== 'Archived')
      .reverse()
      .slice(0, 8);
  }, [products]);

  // Select active list according to tab
  const displayedProducts = React.useMemo(() => {
    if (activeTab === 'bestsellers') return bestSellers;
    if (activeTab === 'newarrivals') return newArrivals;
    // 'all' combines both unique products
    const combined = [...bestSellers, ...newArrivals];
    const uniqueMap = new Map<string, Product>();
    combined.forEach(p => uniqueMap.set(p.id, p));
    return Array.from(uniqueMap.values()).slice(0, 10);
  }, [activeTab, bestSellers, newArrivals]);

  // Scroll handler verification
  const checkScrollState = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScrollState();
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener('scroll', checkScrollState);
      return () => el.removeEventListener('scroll', checkScrollState);
    }
  }, [displayedProducts, activeTab]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      scrollContainerRef.current.scrollBy({
        left: scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const isItemInCart = (prodId: string) => {
    return Boolean(
      cart &&
      cart.some(
        (item) => item.product?.id === prodId || (item as any).productId === prodId
      )
    );
  };

  const handleActionClick = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (
      product.type === 'physical' &&
      product.stock !== null &&
      product.stock !== undefined &&
      product.stock <= 0
    ) {
      return;
    }

    const isInCart = isItemInCart(product.id);

    // If already in cart and not in brief 'Added!' success flash, navigate directly to cart
    if (isInCart && addedToastId !== product.id) {
      if (onViewCart) {
        onViewCart();
      } else {
        onSelectProduct(product);
      }
      return;
    }

    if (onAddToCart) {
      const defaultVars: Record<string, string> = {};
      if (product.variations) {
        product.variations.forEach((v) => {
          if (v.options && v.options.length > 0) {
            defaultVars[v.name] = v.options[0];
          }
        });
      }
      onAddToCart(product, 1, defaultVars);
      setAddedToastId(product.id);
      setAddedProductIds((prev) => {
        const next = new Set(prev);
        next.add(product.id);
        return next;
      });
      setTimeout(() => setAddedToastId(null), 1500);
    } else {
      onSelectProduct(product);
    }
  };

  if (displayedProducts.length === 0) {
    return null;
  }

  return (
    <section 
      className={`rounded-2xl border border-indigo-100/70 dark:border-gray-800 bg-linear-to-b from-indigo-50/30 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-7 shadow-[0_4px_24px_rgba(37,44,139,0.03)] dark:shadow-none font-sans w-full max-w-full overflow-hidden ${className}`}
      id="best-sellers-new-arrivals-carousel"
    >
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-indigo-50 dark:border-gray-800 mb-6">
        
        {/* Title & Tagline */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs dark:bg-indigo-500">
            {activeTab === 'bestsellers' ? (
              <Flame className="h-5 w-5 animate-bounce" />
            ) : activeTab === 'newarrivals' ? (
              <Sparkles className="h-5 w-5 text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
            ) : (
              <Zap className="h-5 w-5 text-amber-300" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                CURATED SHOWCASE
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight">
              {activeTab === 'bestsellers' 
                ? 'Best Selling Products' 
                : activeTab === 'newarrivals' 
                  ? 'New Arrivals & Fresh Releases' 
                  : 'Trending Catalog Spotlight'}
            </h2>
          </div>
        </div>

        {/* Tab Controls & Slide Chevron Nav */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto">
          
          {/* Tabs Selector */}
          <div className="flex items-center gap-1 bg-gray-100/80 dark:bg-gray-800/90 p-1 rounded-xl text-xs border border-gray-200/60 dark:border-gray-700 overflow-x-auto scrollbar-none max-w-full shrink">
            <button
              type="button"
              onClick={() => setActiveTab('bestsellers')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap text-[11px] sm:text-xs ${
                activeTab === 'bestsellers'
                  ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
              id="btn-tab-best-sellers"
            >
              <Flame className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>Best Sellers</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('newarrivals')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap text-[11px] sm:text-xs ${
                activeTab === 'newarrivals'
                  ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
              id="btn-tab-new-arrivals"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-300 shrink-0" />
              <span>New Arrivals</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
              id="btn-tab-all-featured"
            >
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>All Featured</span>
            </button>
          </div>

          {/* Left / Right Chevron Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleScroll('left')}
              disabled={!canScrollLeft}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 shadow-3xs transition-all hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Scroll left"
              id="btn-carousel-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => handleScroll('right')}
              disabled={!canScrollRight}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 shadow-3xs transition-all hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Scroll right"
              id="btn-carousel-next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Track Carousel Slider */}
      <div className="relative">
        <div
          ref={scrollContainerRef}
          className="flex gap-5 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-indigo-200 dark:scrollbar-thumb-gray-800 scroll-smooth"
        >
          {displayedProducts.map((p, index) => {
            const isSaved = wishlist.includes(p.id);
            const isBestSeller = bestSellers.some(bs => bs.id === p.id);
            const isNewArrival = newArrivals.some(na => na.id === p.id);
            const isOutOfStock = p.type === 'physical' && p.stock !== null && p.stock !== undefined && p.stock <= 0;
            const isJustAdded = addedToastId === p.id;
            const isInCart = isItemInCart(p.id);
            const showViewCart = isInCart && !isJustAdded;
            const { hasDiscount, originalPrice: originalPriceVal, discountPercent } = getProductDiscountInfo(p);

            const extraBadge = (activeTab === 'bestsellers' || (activeTab === 'all' && isBestSeller)) ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500 text-white px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider shadow-xs">
                <Flame className="h-3 w-3 fill-current" />
                #{index + 1} Best Seller
              </span>
            ) : null;

            return (
              <motion.div
                key={`${activeTab}-${p.id}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.25) }}
                className="snap-start shrink-0 w-[260px] sm:w-[280px]"
              >
                <ProductCard
                  product={p}
                  onSelectProduct={onSelectProduct}
                  onAddToCart={onAddToCart}
                  cart={cart}
                  wishlist={wishlist}
                  onToggleWishlist={onToggleWishlist}
                  onViewCart={onViewCart}
                  currency={currency}
                  extraBadge={extraBadge}
                  className="h-full"
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
