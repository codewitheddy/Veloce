/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Star,
  Check,
  Trash2,
  Tag,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Product, CartItem } from '../types';
import { CurrencyType, formatPrice } from '../lib/currency';
import LazyImage from './LazyImage';
import ProductCard from './ProductCard';
import { getProductDiscountInfo } from '../utils/productUtils';

interface RecentlyViewedSliderProps {
  products?: Product[];
  cart?: CartItem[];
  onSelectProduct?: (product: Product) => void;
  onAddToCart?: (product: Product, quantity: number, vars: Record<string, string>) => void;
  onViewCart?: () => void;
  currency?: CurrencyType;
  className?: string;
  onExploreStore?: () => void;
}

export const RecentlyViewedSlider: React.FC<RecentlyViewedSliderProps> = ({
  products = [],
  cart = [],
  onSelectProduct,
  onAddToCart,
  onViewCart,
  currency = 'KSh',
  className = '',
  onExploreStore,
}) => {
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('veloce_recently_viewed');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [addedProductIds, setAddedProductIds] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Sync state if localStorage changes in other tabs or components
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem('veloce_recently_viewed');
        if (saved) {
          setRecentlyViewedIds(JSON.parse(saved));
        } else {
          setRecentlyViewedIds([]);
        }
      } catch {}
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Prune deleted/nonexistent products from recently viewed IDs when catalog changes
  useEffect(() => {
    if (!Array.isArray(products) || products.length === 0) {
      if (recentlyViewedIds.length > 0) {
        setRecentlyViewedIds([]);
        try {
          localStorage.removeItem('veloce_recently_viewed');
        } catch {}
      }
      return;
    }

    const validProductIds = new Set(products.map((p) => String(p.id).toLowerCase()));
    const validRecentlyViewed = recentlyViewedIds.filter((id) => validProductIds.has(String(id).toLowerCase()));

    if (validRecentlyViewed.length !== recentlyViewedIds.length) {
      setRecentlyViewedIds(validRecentlyViewed);
      try {
        if (validRecentlyViewed.length === 0) {
          localStorage.removeItem('veloce_recently_viewed');
        } else {
          localStorage.setItem('veloce_recently_viewed', JSON.stringify(validRecentlyViewed));
        }
      } catch {}
    }
  }, [products]);

  // All available catalog products (only live products, no hardcoded mock fallbacks)
  const catalogProducts = useMemo(() => {
    return Array.isArray(products) ? products : [];
  }, [products]);

  // Map recently viewed product IDs to active catalog items
  const displayedProducts = useMemo(() => {
    if (!catalogProducts || catalogProducts.length === 0) {
      return [];
    }

    const matched = recentlyViewedIds
      .map((id) => catalogProducts.find((p) => String(p.id).toLowerCase() === String(id).toLowerCase()))
      .filter((p): p is Product => Boolean(p && p.status !== 'Draft' && p.status !== 'Archived'));

    // Return only actual matched items from the current catalog
    return matched;
  }, [recentlyViewedIds, catalogProducts]);

  // Update scroll navigation buttons state
  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      const isLeft = el.scrollLeft > 10;
      const isRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 10;
      setCanScrollLeft(isLeft);
      setCanScrollRight(isRight);
    }
  }, []);

  useEffect(() => {
    // Check initial scrollability after render
    const timer = setTimeout(checkScroll, 100);
    window.addEventListener('resize', checkScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkScroll);
    };
  }, [displayedProducts, checkScroll]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (el) {
      const scrollAmount = el.clientWidth * 0.75;
      el.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(checkScroll, 350);
    }
  };

  const handleClearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentlyViewedIds([]);
    try {
      localStorage.removeItem('veloce_recently_viewed');
    } catch {}
  };

  const handleQuickAdd = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (
      product.type === 'physical' &&
      product.stock !== null &&
      product.stock !== undefined &&
      product.stock <= 0
    ) {
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
      setAddedProductIds((prev) => new Set(prev).add(product.id));
      setTimeout(() => {
        setAddedProductIds((prev) => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        });
      }, 1500);
    } else if (onSelectProduct) {
      onSelectProduct(product);
    }
  };

  if (displayedProducts.length === 0) {
    return null;
  }

  const isShowingHistory = recentlyViewedIds.length > 0;

  return (
    <section
      className={`w-full max-w-full overflow-hidden mt-10 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-gradient-to-b from-slate-50/60 via-white to-white dark:from-slate-900/60 dark:via-slate-900/40 dark:to-slate-900/80 p-4 sm:p-7 shadow-xs ${className}`}
      id="recently-viewed-slider"
    >
      {/* SECTION HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-5">
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100/60 dark:border-indigo-900/40 shadow-xs">
            {isShowingHistory ? <Clock className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {isShowingHistory ? 'Recently Viewed Products' : 'Recommended For You'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                {displayedProducts.length} {displayedProducts.length === 1 ? 'Item' : 'Items'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isShowingHistory
                ? 'Pick up where you left off with your recently explored store items'
                : 'Popular products curated based on trending store items'}
            </p>
          </div>
        </div>

        {/* CONTROLS (CLEAR HISTORY & SLIDER ARROWS) */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          {isShowingHistory && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50/60 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/30 transition-all cursor-pointer border border-transparent hover:border-rose-200/60 dark:hover:border-rose-900/40"
              title="Clear recently viewed history"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 pl-1">
            <button
              type="button"
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:border-indigo-200 dark:hover:border-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-3xs active:scale-95"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:border-indigo-200 dark:hover:border-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-3xs active:scale-95"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* HORIZONTAL CAROUSEL CONTAINER */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className="flex items-stretch gap-4 sm:gap-5 overflow-x-auto pb-4 pt-1 px-1 scroll-smooth snap-x snap-mandatory scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {displayedProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onSelectProduct={onSelectProduct}
            onAddToCart={onAddToCart}
            cart={cart}
            onViewCart={onViewCart}
            currency={currency}
            className="shrink-0 w-[260px] sm:w-[280px] snap-start"
          />
        ))}
      </div>
    </section>
  );
};

export default RecentlyViewedSlider;
