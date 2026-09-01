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
import { Product } from '../types';
import LazyImage from './LazyImage';
import { getProductDiscountInfo } from '../utils/productUtils';

interface BestSellersNewArrivalsCarouselProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onAddToCart?: (product: Product, quantity: number, vars: Record<string, string>) => void;
  wishlist?: string[];
  onToggleWishlist?: (productId: string) => void;
  className?: string;
  darkMode?: boolean;
}

export default function BestSellersNewArrivalsCarousel({
  products,
  onSelectProduct,
  onAddToCart,
  wishlist = [],
  onToggleWishlist = () => {},
  className = '',
  darkMode = false,
}: BestSellersNewArrivalsCarouselProps) {
  const [activeTab, setActiveTab] = useState<'bestsellers' | 'newarrivals' | 'all'>('bestsellers');
  const [addedToastId, setAddedToastId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Compute Best Sellers (Top rated & most reviewed)
  const bestSellers = React.useMemo(() => {
    return [...products]
      .filter(p => p.status !== 'Draft' && p.status !== 'Archived')
      .sort((a, b) => {
        const scoreA = (a.rating || 4.5) * 20 + (a.reviewsCount || 0) * 3;
        const scoreB = (b.rating || 4.5) * 20 + (b.reviewsCount || 0) * 3;
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

  const handleQuickAdd = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (onAddToCart) {
      const defaultVars: Record<string, string> = {};
      if (product.variations) {
        product.variations.forEach(v => {
          if (v.options && v.options.length > 0) {
            defaultVars[v.name] = v.options[0];
          }
        });
      }
      onAddToCart(product, 1, defaultVars);
      setAddedToastId(product.id);
      setTimeout(() => setAddedToastId(null), 1800);
    } else {
      onSelectProduct(product);
    }
  };

  return (
    <section 
      className={`rounded-2xl border border-indigo-100/70 dark:border-gray-800 bg-linear-to-b from-indigo-50/30 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 p-5 sm:p-7 shadow-[0_4px_24px_rgba(37,44,139,0.03)] dark:shadow-none font-sans ${className}`}
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
        <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap">
          
          {/* Tabs Selector */}
          <div className="flex items-center gap-1 bg-gray-100/80 dark:bg-gray-800/90 p-1 rounded-xl text-xs border border-gray-200/60 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setActiveTab('bestsellers')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'bestsellers'
                  ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
              id="btn-tab-best-sellers"
            >
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              <span>Best Sellers</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('newarrivals')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'newarrivals'
                  ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
              id="btn-tab-new-arrivals"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-300" />
              <span>New Arrivals</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
              id="btn-tab-all-featured"
            >
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <span>All Featured</span>
            </button>
          </div>

          {/* Left / Right Chevron Controls */}
          <div className="flex items-center gap-1.5">
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
            const isJustAdded = addedToastId === p.id;
            const { hasDiscount, originalPrice: originalPriceVal, discountPercent } = getProductDiscountInfo(p);

            return (
              <motion.div
                key={`${activeTab}-${p.id}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.25) }}
                onClick={() => onSelectProduct(p)}
                className="snap-start shrink-0 w-[280px] sm:w-[300px] group flex flex-col justify-between rounded-xl border border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 transition-all duration-300 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-[0_8px_30px_rgba(79,70,229,0.08)] cursor-pointer relative"
              >
                <div>
                  {/* Top Image Box */}
                  <div className="relative aspect-4/3 w-full overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-950">
                    <LazyImage
                      src={p.imageUrl}
                      alt={p.name}
                      className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Badge Overlay */}
                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
                      {activeTab === 'bestsellers' || (activeTab === 'all' && isBestSeller) ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500 text-white px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider shadow-xs">
                          <Flame className="h-3 w-3 fill-current" />
                          #{index + 1} Best Seller
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-600 text-white px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider shadow-xs">
                          <Sparkles className="h-3 w-3" />
                          New Arrival
                        </span>
                      )}

                      {hasDiscount && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500 text-white px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider shadow-xs">
                          <Sparkles className="h-2.5 w-2.5" />
                          ON SALE -{discountPercent}%
                        </span>
                      )}
                    </div>

                    {/* Quick Wishlist Bookmark Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWishlist(p.id);
                      }}
                      className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 dark:bg-gray-950/90 backdrop-blur-xs shadow-xs hover:bg-white dark:hover:bg-gray-850 text-gray-400 hover:text-rose-500 transition-all cursor-pointer border border-gray-100 dark:border-gray-800"
                      title={isSaved ? "Saved to Wishlist" : "Save for later"}
                    >
                      <Heart
                        className={`h-4 w-4 transition-all ${
                          isSaved
                            ? 'fill-current text-rose-500'
                            : 'text-gray-400 dark:text-gray-500 hover:text-rose-500'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Product Details Header */}
                  <div className="mt-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase font-mono">
                        {p.category}
                      </span>
                      
                      {/* Rating Stars */}
                      <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                        <Star className="h-3 w-3 fill-current" />
                        <span>{p.rating.toFixed(1)}</span>
                        <span className="text-[9px] text-gray-400 font-normal">({p.reviewsCount})</span>
                      </div>
                    </div>

                    <h3 className="font-display font-bold text-sm text-gray-900 dark:text-white mt-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                      {p.name}
                    </h3>
                    
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed font-light">
                      {p.description}
                    </p>
                  </div>
                </div>

                {/* Pricing & Add To Cart Button */}
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    {hasDiscount && originalPriceVal && (
                      <span className="text-[10px] font-mono text-gray-400 line-through">
                        KSh {originalPriceVal.toLocaleString('en-KE')}
                      </span>
                    )}
                    <span className="font-mono text-base font-bold text-gray-900 dark:text-white">
                      KSh {p.price.toLocaleString('en-KE')}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleQuickAdd(e, p)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-3xs ${
                      isJustAdded
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white'
                    }`}
                    title="Add to cart"
                  >
                    {isJustAdded ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Added!
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="h-3.5 w-3.5" /> Add
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
