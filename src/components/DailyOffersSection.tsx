import React, { useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Flame } from 'lucide-react';
import { Product } from '../types';
import { formatPrice, CurrencyType } from '../lib/currency';
import { getProductDiscountInfo } from '../utils/productUtils';
import LazyImage from './LazyImage';
import ProductCard from './ProductCard';

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
    <section className="w-full max-w-full overflow-hidden bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white py-6 sm:py-8 px-3.5 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-slate-800 font-sans">
      <div className="w-full max-w-[1440px] mx-auto">
        {/* Header Title, See More & Slider Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 mb-3">
          <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-2.5">
            <h2 className="text-base sm:text-2xl font-bold uppercase tracking-wide text-slate-900 dark:text-white flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 fill-amber-500 shrink-0" />
              <span>DAILY OFFERS</span>
            </h2>
            <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[9.5px] sm:text-xs font-mono font-bold px-2 sm:px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 whitespace-nowrap">
              {saleProducts.length} On Sale
            </span>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
            <button
              onClick={() => {
                if (onSelectSale) {
                  onSelectSale();
                } else if (setCurrentTab) {
                  setCurrentTab('store');
                }
              }}
              className="text-xs sm:text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer hover:underline whitespace-nowrap"
            >
              See all offers &rarr;
            </button>

            {/* Slider Navigation Buttons */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-850 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-3xs shrink-0">
              <button
                onClick={() => scroll('left')}
                aria-label="Previous daily offers"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-indigo-600 flex items-center justify-center transition-all cursor-pointer shadow-3xs active:scale-95 border border-slate-200/80 dark:border-slate-700"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <button
                onClick={() => scroll('right')}
                aria-label="Next daily offers"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-indigo-600 flex items-center justify-center transition-all cursor-pointer shadow-3xs active:scale-95 border border-slate-200/80 dark:border-slate-700"
              >
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Carousel Container with vertical overflow room to prevent hover clipping */}
        <div className="relative">
          {/* Products Horizontal Slider (with pt-3 pb-4 to give hover translation and shadow space) */}
          <div
            ref={scrollRef}
            className="flex items-stretch gap-3.5 sm:gap-5 overflow-x-auto scrollbar-none pt-3 pb-4 px-1 scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {saleProducts.map((item) => (
              <div key={item.id} className="w-[240px] sm:w-[260px] md:w-[280px] shrink-0">
                <ProductCard
                  product={item}
                  onSelectProduct={onProductClick}
                  currency={currency}
                  className="h-full"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
