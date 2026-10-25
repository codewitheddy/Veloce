/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import { Tag, Clock, ArrowRight, Star, Flame, Sparkles, Percent, ChevronLeft, ChevronRight } from 'lucide-react';
import CountdownTimer from './CountdownTimer';
import { getProductDiscountInfo } from '../utils/productUtils';
import { CurrencyType, formatPrice } from '../lib/currency';
import LazyImage from './LazyImage';
import ProductCard from './ProductCard';

interface SaleProductsProps {
  products: Product[];
  onProductClick: (product: Product) => void;
  setCurrentTab: (tab: string) => void;
  onSelectSale?: () => void;
  currency?: CurrencyType;
}

export default function SaleProducts({
  products,
  onProductClick,
  setCurrentTab,
  onSelectSale,
  currency = 'KSh',
}: SaleProductsProps) {
  // Filter active products that are on sale (have a valid previousPrice greater than current price)
  const saleProducts = products.filter(
    (p) =>
      p.status !== 'Draft' &&
      p.status !== 'Archived' &&
      getProductDiscountInfo(p).isOnSale
  );

  // Stateful countdown timer for FOMO and polish
  const [timeLeft, setTimeLeft] = useState({ hours: 14, minutes: 25, seconds: 40 });
  
  // Carousel state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    // Standard countdown timer simulating campaign ending tonight
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const updateTimer = () => {
      const current = new Date();
      const diff = endOfDay.getTime() - current.getTime();
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
      } else {
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeft({ hours, minutes, seconds });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  // Carousel scroll state tracking
  const checkScrollState = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScrollState();
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', checkScrollState);
      window.addEventListener('resize', checkScrollState);
      return () => {
        scrollContainer.removeEventListener('scroll', checkScrollState);
        window.removeEventListener('resize', checkScrollState);
      };
    }
  }, [saleProducts]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 340;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Format with leading zeros
  const fNum = (n: number) => n.toString().padStart(2, '0');

  if (saleProducts.length === 0) return null;

  return (
    <section className="py-8 bg-gradient-to-b from-slate-50 via-rose-50/20 to-slate-50 dark:from-[#090D16] dark:via-rose-950/20 dark:to-[#090D16] border-t border-rose-100/40 dark:border-rose-950/40 transition-colors w-full max-w-full overflow-hidden">
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">
              <Flame className="h-4 w-4" />
              <span>Limited-Time Price Cuts</span>
            </div>
            <h2 className="mt-1 text-2xl font-display font-bold text-gray-900 dark:text-white tracking-tight">
              Exclusive Archival Offerings
            </h2>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400 font-extralight leading-relaxed">
              Strictly limited campaigns on premium hardware, design systems, and analog desk-bound instruments. Relinquished with exceptional terms.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 lg:self-end">
            {/* Elegant Segmented Countdown Clock */}
            <div className="bg-rose-50/30 dark:bg-rose-950/30 border border-rose-100/40 dark:border-rose-900/40 rounded-2xl p-3 flex items-center gap-4">
              <span className="text-[9px] font-mono text-rose-600 dark:text-rose-400 font-bold uppercase tracking-widest leading-none block max-w-[80px]">
                Campaign Ends In:
              </span>
              <div className="flex items-center gap-1.5">
                <div className="flex flex-col items-center">
                  <div className="bg-rose-950 text-rose-100 font-mono text-sm font-bold h-9 w-10 rounded-lg flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] border border-rose-800/30">
                    {fNum(timeLeft.hours)}
                  </div>
                  <span className="text-[8px] text-rose-500 font-mono mt-1 font-bold tracking-wider uppercase">Hrs</span>
                </div>
                <span className="text-rose-500 font-bold -mt-4 animate-pulse">:</span>
                <div className="flex flex-col items-center">
                  <div className="bg-rose-950 text-rose-100 font-mono text-sm font-bold h-9 w-10 rounded-lg flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] border border-rose-800/30">
                    {fNum(timeLeft.minutes)}
                  </div>
                  <span className="text-[8px] text-rose-500 font-mono mt-1 font-bold tracking-wider uppercase">Min</span>
                </div>
                <span className="text-rose-500 font-bold -mt-4 animate-pulse">:</span>
                <div className="flex flex-col items-center">
                  <div className="bg-rose-600 text-white font-mono text-sm font-bold h-9 w-10 rounded-lg flex items-center justify-center shadow-[0_2px_8px_rgba(220,38,38,0.25)] border border-rose-500 animate-pulse">
                    {fNum(timeLeft.seconds)}
                  </div>
                  <span className="text-[8px] text-rose-600 font-mono mt-1 font-bold tracking-wider uppercase">Sec</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (onSelectSale) {
                  onSelectSale();
                } else if (setCurrentTab) {
                  setCurrentTab('store');
                }
              }}
              className="group flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 bg-transparent py-2 transition-colors self-start sm:self-auto cursor-pointer"
            >
              Browse All On-Sale Items <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        {/* Sales Carousel */}
        <div className="relative px-0 sm:px-8 lg:px-12 py-4 sm:py-6 overflow-hidden">
          {/* Left Scroll Button */}
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className="hidden sm:flex absolute -left-2 lg:-left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 sm:w-12 sm:h-12 items-center justify-center rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-rose-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6 text-gray-900 dark:text-white" />
          </button>

          {/* Carousel Container */}
          <div
            ref={scrollContainerRef}
            className="flex gap-5 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-smooth"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {saleProducts.map((product) => {
              const { originalPrice: previousPrice, discountPercent } = getProductDiscountInfo(product);
              const originalDisplayPrice = previousPrice || product.price;
              
              // Stock scarcity calculation
              const currentStock = product.stock !== null ? product.stock : 10;
              const isLowStock = currentStock < 20;

              return (
                <div key={product.id} className="snap-start shrink-0 w-[260px] sm:w-[280px]">
                  <ProductCard
                    product={product}
                    onSelectProduct={onProductClick}
                    currency={currency}
                    className="h-full"
                  />
                </div>
              );
            })}
          </div>

          {/* Right Scroll Button */}
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className="hidden sm:flex absolute -right-2 lg:-right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 sm:w-12 sm:h-12 items-center justify-center rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-rose-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 text-gray-900 dark:text-white" />
          </button>
        </div>
      </div>
    </section>
  );
}
