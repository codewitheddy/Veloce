import React, { useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Flame } from 'lucide-react';
import { Product } from '../types';
import { formatPrice, CurrencyType } from '../lib/currency';
import { getProductDiscountInfo } from '../utils/productUtils';

interface DailyOffersSectionProps {
  products?: Product[];
  onProductClick?: (product: Product) => void;
  setCurrentTab?: (tab: string) => void;
  onSelectSale?: () => void;
  currency?: CurrencyType;
}

export default function DailyOffersSection({
  products = [],
  onProductClick,
  setCurrentTab,
  onSelectSale,
  currency = 'KSh'
}: DailyOffersSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter ONLY products that are active and on sale (discounted)
  const saleProducts = useMemo(() => {
    return (products || []).filter((p) => {
      if (p.status === 'Draft' || p.status === 'Archived') return false;
      return getProductDiscountInfo(p).isOnSale;
    });
  }, [products]);

  // If no products are currently on sale, do not render this section
  if (saleProducts.length === 0) {
    return null;
  }

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="w-full bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white py-8 px-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-slate-800 font-sans">
      <div className="w-full max-w-[1440px] mx-auto">
        {/* Header Title, See More & Slider Controls */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wide text-slate-900 dark:text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500 fill-amber-500" />
              DAILY OFFERS
            </h2>
            <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] sm:text-xs font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {saleProducts.length} On Sale
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => {
                if (onSelectSale) {
                  onSelectSale();
                } else if (setCurrentTab) {
                  setCurrentTab('store');
                }
              }}
              className="text-xs sm:text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer hover:underline"
            >
              See all offers &rarr;
            </button>

            {/* Slider Navigation Buttons */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-850 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-3xs">
              <button
                onClick={() => scroll('left')}
                aria-label="Previous daily offers"
                className="w-8 h-8 rounded-md bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-indigo-600 flex items-center justify-center transition-all cursor-pointer shadow-3xs active:scale-95 border border-slate-200/80 dark:border-slate-700"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => scroll('right')}
                aria-label="Next daily offers"
                className="w-8 h-8 rounded-md bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-indigo-600 flex items-center justify-center transition-all cursor-pointer shadow-3xs active:scale-95 border border-slate-200/80 dark:border-slate-700"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Carousel Container with vertical overflow room to prevent hover clipping */}
        <div className="relative">
          {/* Products Horizontal Slider (with pt-3 pb-4 to give hover translation and shadow space) */}
          <div
            ref={scrollRef}
            className="flex items-stretch gap-3.5 sm:gap-5 overflow-x-auto scrollbar-none pt-3 pb-4 px-1 -mx-1 scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {saleProducts.map((item) => {
              const { hasDiscount, originalPrice: originalPriceVal, discountPercent: discountPct } = getProductDiscountInfo(item);

              return (
                <div
                  key={item.id}
                  onClick={() => onProductClick && onProductClick(item)}
                  className="w-[240px] sm:w-[260px] md:w-[280px] shrink-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600 p-3 sm:p-4 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:shadow-md hover:-translate-y-1 group/card select-none"
                >
                  {/* Top Image & Badge Box */}
                  <div>
                    <div className="relative w-full h-[180px] sm:h-[200px] bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-800">
                      {/* Discount & On Sale Badges */}
                      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                        <span className="bg-amber-500 text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded shadow-3xs flex items-center gap-1 uppercase tracking-wider">
                          <Sparkles className="w-2.5 h-2.5" />
                          ON SALE
                        </span>
                        {discountPct > 0 && (
                          <span className="bg-slate-900/90 dark:bg-slate-950/90 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-3xs uppercase tracking-wide">
                            -{discountPct}% OFF
                          </span>
                        )}
                      </div>

                      <img
                        src={item.images?.[0] || item.imageUrl || '/placeholder-product.png'}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain group-hover/card:scale-105 transition-transform duration-300"
                      />
                    </div>

                    {/* Product Title */}
                    <h3 className="mt-3 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover/card:text-indigo-600 dark:group-hover/card:text-indigo-400 transition-colors">
                      {item.name}
                    </h3>

                    {/* Category Pill */}
                    {item.category && (
                      <div className="mt-2.5">
                        <span className="inline-block bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md">
                          {item.category}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Pricing */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col">
                      {hasDiscount && originalPriceVal && (
                        <span className="text-xs text-slate-400 dark:text-slate-500 line-through font-mono">
                          {formatPrice(originalPriceVal, currency)}
                        </span>
                      )}
                      <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono">
                        {formatPrice(item.price, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
