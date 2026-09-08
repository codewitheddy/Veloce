/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { Tag, Clock, ArrowRight, Star, Flame, Sparkles, Percent } from 'lucide-react';
import CountdownTimer from './CountdownTimer';
import { getProductDiscountInfo } from '../utils/productUtils';

interface SaleProductsProps {
  products: Product[];
  onProductClick: (product: Product) => void;
  setCurrentTab: (tab: string) => void;
  onSelectSale?: () => void;
}

export default function SaleProducts({
  products,
  onProductClick,
  setCurrentTab,
  onSelectSale,
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

  // Format with leading zeros
  const formatTime = (num: number) => String(num).padStart(2, '0');

  if (saleProducts.length === 0) {
    return null; // Don't render the section if no products are on sale
  }

  return (
    <section className="bg-slate-50 dark:bg-slate-900/60 py-16 border-t border-slate-200/80 dark:border-slate-800" id="promotional-sales-section">
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Editorial Promotion Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between border-b border-rose-100 pb-8 mb-10 gap-6">
          <div className="max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-mono font-bold text-rose-600 uppercase tracking-wider">
                <Flame className="h-3 w-3 text-rose-500 animate-pulse" />
                Limited Valuations
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] font-mono text-rose-700 bg-rose-50/50 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Active Offer
              </span>
            </div>
            <h2 className="mt-2.5 font-display text-2xl font-bold text-gray-900 tracking-tight">
              Exclusive Archival Offerings
            </h2>
            <p className="mt-1.5 text-xs text-gray-400 font-extralight leading-relaxed">
              Strictly limited campaigns on premium hardware, design systems, and analog desk-bound instruments. Relinquished with exceptional terms.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 lg:self-end">
            {/* Elegant Segmented Countdown Clock */}
            <div className="bg-rose-50/30 border border-rose-100/40 rounded-2xl p-3 flex items-center gap-4">
              <span className="text-[9px] font-mono text-rose-600 font-bold uppercase tracking-widest leading-none block max-w-[80px]">
                Campaign Ends In:
              </span>
              <div className="flex items-center gap-1.5">
                <div className="flex flex-col items-center">
                  <div className="bg-rose-950 text-rose-100 font-mono text-sm font-bold h-9 w-10 rounded-lg flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] border border-rose-800/30">
                    {formatTime(timeLeft.hours)}
                  </div>
                  <span className="text-[8px] text-rose-500 font-mono mt-1 font-bold tracking-wider uppercase">Hrs</span>
                </div>
                <span className="text-rose-500 font-bold -mt-4 animate-pulse">:</span>
                <div className="flex flex-col items-center">
                  <div className="bg-rose-950 text-rose-100 font-mono text-sm font-bold h-9 w-10 rounded-lg flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] border border-rose-800/30">
                    {formatTime(timeLeft.minutes)}
                  </div>
                  <span className="text-[8px] text-rose-500 font-mono mt-1 font-bold tracking-wider uppercase">Min</span>
                </div>
                <span className="text-rose-500 font-bold -mt-4 animate-pulse">:</span>
                <div className="flex flex-col items-center">
                  <div className="bg-rose-600 text-white font-mono text-sm font-bold h-9 w-10 rounded-lg flex items-center justify-center shadow-[0_2px_8px_rgba(220,38,38,0.25)] border border-rose-500 animate-pulse">
                    {formatTime(timeLeft.seconds)}
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
              className="group flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 bg-transparent py-2 transition-colors self-start sm:self-auto cursor-pointer"
            >
              Browse All On-Sale Items <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        {/* Sales Grid */}
        <div className="grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-3 xl:gap-x-8">
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
                className="group relative flex flex-col justify-between rounded-2xl border border-rose-100/50 bg-[#fffdfd]/80 p-5 cursor-pointer transition-all duration-300 hover:shadow-[0_16px_32px_rgba(220,38,38,0.03)] hover:border-rose-200 hover:bg-white"
              >
                <div>
                  {/* Category & Custom Savings Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 text-[9px] font-mono font-bold text-gray-500 uppercase tracking-wider">
                      {product.category}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100/60">
                      <span className="bg-rose-600 text-white text-[8px] font-sans font-black px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5">
                        <Sparkles className="h-2 w-2" />
                        ON SALE
                      </span>
                      -{discountPercent}%
                    </span>
                  </div>

                  {/* High Quality Render Block */}
                  <div className="relative h-56 w-full overflow-hidden rounded-xl bg-gray-50 border border-rose-50/20">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-103"
                      referrerPolicy="no-referrer"
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
                      <span className="font-mono text-[9px] text-gray-400">SKU: {product.sku}</span>
                      {product.stock !== null && (
                        <span className={`text-[10px] font-mono font-semibold ${isLowStock ? 'text-amber-600' : 'text-gray-400'}`}>
                          {product.stock} Units Remaining
                        </span>
                      )}
                    </div>

                    <h3 className="font-display font-medium text-sm text-gray-900 group-hover:text-rose-700 transition-colors mt-1.5">
                      {product.name}
                    </h3>
                    
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2 font-extralight leading-relaxed">
                      {product.description}
                    </p>

                    {/* Stock level visual bar */}
                    {product.stock !== null && (
                      <div className="mt-4">
                        <div className="h-1 w-full bg-rose-50 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${isLowStock ? 'bg-amber-500' : 'bg-rose-500'}`} 
                            style={{ width: `${Math.min(100, Math.max(10, (product.stock / 100) * 100))}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Ratings & Countdown */}
                    <div className="mt-3.5 flex items-center justify-between bg-rose-50/10 rounded-lg p-2 border border-rose-100/10">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span className="text-[11px] font-semibold text-gray-700">{product.rating}</span>
                        <span className="text-[10px] text-gray-400 font-extralight">({product.reviewsCount} reviews)</span>
                      </div>
                      {product.saleEndDate ? (
                        <CountdownTimer endDate={product.saleEndDate} compact className="scale-95 origin-right" />
                      ) : (
                        <span className="text-[8px] font-mono text-rose-500 font-bold tracking-widest uppercase">
                          Limited Term
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pricing Block with clear crossed-out original pricing */}
                <div className="mt-5 pt-4 border-t border-rose-50/50 flex items-center justify-between">
                  <div className="flex flex-col">
                    {previousPrice && previousPrice > product.price && (
                      <span className="font-mono text-[10px] line-through text-gray-400">
                        KSh {previousPrice.toLocaleString('en-KE')}
                      </span>
                    )}
                    <span className="font-mono font-bold text-base text-rose-600">
                      KSh {product.price.toLocaleString('en-KE')}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-600 group-hover:text-rose-800 transition-colors">
                    Acquire Term <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
