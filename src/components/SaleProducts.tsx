/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import { Tag, Clock, ArrowRight, Star, Flame, Sparkles, Percent, ChevronLeft, ChevronRight } from 'lucide-react';
import CountdownTimer from './CountdownTimer';
import { getProductDiscountInfo } from '../utils/productUtils';
import { cleanDescriptionExcerpt } from '../utils/formatDescription';
import { CurrencyType, formatPrice } from '../lib/currency';
import LazyImage from './LazyImage';

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
                <div
                  key={product.id}
                  onClick={() => onProductClick(product)}
                  className="snap-start shrink-0 w-[270px] xs:w-[300px] sm:w-[320px] md:w-[340px] lg:w-[360px] flex flex-col justify-between rounded-2xl border border-rose-100/50 dark:border-rose-950/60 bg-[#fffdfd]/80 dark:bg-slate-900 p-5 cursor-pointer transition-all duration-300 hover:shadow-[0_16px_32px_rgba(220,38,38,0.08)] dark:hover:shadow-[0_16px_32px_rgba(0,0,0,0.5)] hover:border-rose-200 dark:hover:border-rose-500/40 hover:bg-white dark:hover:bg-slate-850"
                >
                  <div>
                    {/* Category & Custom Savings Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="inline-flex items-center rounded-md bg-gray-50 dark:bg-slate-800 px-2 py-0.5 text-[9px] font-mono font-bold text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                        {product.category}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-black text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-100/60 dark:border-rose-900/60">
                        <span className="bg-rose-600 text-white text-[8px] font-sans font-black px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5">
                          <Sparkles className="h-2 w-2" />
                          ON SALE
                        </span>
                        -{discountPercent}%
                      </span>
                    </div>

                    {/* High Quality Render Block */}
                    <div className="relative h-56 w-full overflow-hidden rounded-xl bg-gray-50 dark:bg-slate-950 border border-rose-50/20 dark:border-slate-800 flex items-center justify-center p-2">
                      <LazyImage
                        src={product.imageUrl}
                        alt={product.name}
                        width={320}
                        height={224}
                        aspectRatio="320/224"
                        responsiveType="carousel"
                        className="h-full w-full object-contain object-center transition-transform duration-500 hover:scale-105"
                      />
                      
                      {/* Visual Flare badge */}
                      <div className="absolute top-3 left-3 rounded bg-indigo-950/90 backdrop-blur-sm text-white font-mono text-[8px] font-bold px-2 py-0.5 tracking-wider uppercase flex items-center gap-1">
                        <Sparkles className="h-2.5 w-2.5 text-amber-400" />
                        Premium Grade
                      </div>
                    </div>

                    {/* Meta Descriptions */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[9px] text-gray-400 dark:text-slate-500">SKU: {product.sku}</span>
                        {product.stock !== null && (
                          <span className={`text-[10px] font-mono font-semibold ${isLowStock ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-slate-500'}`}>
                            {product.stock} Units
                          </span>
                        )}
                      </div>

                      <h3 className="font-display font-medium text-sm text-gray-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors mt-1.5">
                        {product.name}
                      </h3>
                      
                      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400 line-clamp-2 font-extralight leading-relaxed">
                        {cleanDescriptionExcerpt(product.shortDescription || product.description, 120)}
                      </p>

                      {/* Stock level visual bar */}
                      {product.stock !== null && (
                        <div className="mt-4">
                          <div className="h-1 w-full bg-rose-50 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${isLowStock ? 'bg-amber-500' : 'bg-rose-500'}`} 
                              style={{ width: `${Math.min(100, Math.max(10, (product.stock / 100) * 100))}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Ratings & Countdown */}
                      <div className="mt-3.5 flex items-center justify-between bg-rose-50/10 dark:bg-slate-800/40 rounded-lg p-2 border border-rose-100/10 dark:border-slate-800">
                        {product.reviewsCount > 0 && product.rating > 0 ? (
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            <span className="text-[11px] font-semibold text-gray-700 dark:text-slate-300">{product.rating.toFixed(1)}</span>
                            <span className="text-[10px] text-gray-400 dark:text-slate-500 font-extralight">({product.reviewsCount})</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">Unrated</span>
                        )}
                        {product.saleEndDate ? (
                          <CountdownTimer endDate={product.saleEndDate} compact className="scale-95 origin-right" />
                        ) : (
                          <span className="text-[8px] font-mono text-rose-500 dark:text-rose-400 font-bold tracking-widest uppercase">
                            Limited Term
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pricing Block with clear crossed-out original pricing */}
                  <div className="mt-5 pt-4 border-t border-rose-50/50 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex flex-col">
                      {previousPrice && previousPrice > product.price && (
                        <span className="font-mono text-[10px] line-through text-gray-400 dark:text-slate-500">
                          {formatPrice(previousPrice, currency)}
                        </span>
                      )}
                      <span className="font-mono font-bold text-base text-rose-600 dark:text-rose-400">
                        {formatPrice(product.price, currency)}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 transition-colors">
                      Acquire Term <ArrowRight className="h-3 w-3 transition-transform hover:translate-x-0.5" />
                    </span>
                  </div>
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
