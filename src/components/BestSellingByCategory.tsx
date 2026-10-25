/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Product, Order } from '../types';
import { Star, TrendingUp, ArrowRight, ShoppingBag, Award } from 'lucide-react';
import { getProductDiscountInfo } from '../utils/productUtils';
import { CurrencyType, formatPrice } from '../lib/currency';
import LazyImage from './LazyImage';
import ProductCard from './ProductCard';

interface BestSellingByCategoryProps {
  products: Product[];
  orders: Order[];
  onProductClick: (product: Product) => void;
  setCurrentTab: (tab: string) => void;
  onSelectCategory?: (category: string) => void;
  currency?: CurrencyType;
}

export default function BestSellingByCategory({
  products,
  orders,
  onProductClick,
  setCurrentTab,
  onSelectCategory,
  currency = 'KSh',
}: BestSellingByCategoryProps) {
  // 1. Calculate sales volume for each product
  const salesMap: Record<string, number> = {};
  orders.forEach(order => {
    if (order.status !== 'cancelled') {
      order.items.forEach(item => {
        salesMap[item.productId] = (salesMap[item.productId] || 0) + item.quantity;
      });
    }
  });

  // 2. Filter out Draft/Archived items
  const activeProducts = products.filter(p => p.status !== 'Draft' && p.status !== 'Archived');

  // 3. Group by category
  const categories = Array.from(new Set(activeProducts.map(p => p.category)));

  // Calculate top 3 best-sellers for each category
  const categorizedBestSellers = categories.map(category => {
    const categoryProducts = activeProducts.filter(p => p.category === category);
    
    // Sort products by sales volume first, then rating, then review count
    const sorted = [...categoryProducts].sort((a, b) => {
      const salesA = salesMap[a.id] || 0;
      const salesB = salesMap[b.id] || 0;
      if (salesB !== salesA) return salesB - salesA;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.reviewsCount - a.reviewsCount;
    });

    const topFive = sorted.slice(0, 5);

    // Calculate sum of real sales for sorting categories
    const displayCategorySales = topFive.reduce((sum, p) => {
      const realSales = salesMap[p.id] || 0;
      return sum + realSales;
    }, 0);

    return {
      category,
      products: topFive,
      categoryWeight: displayCategorySales,
    };
  }).filter(group => group.products.length > 0)
    .sort((a, b) => b.categoryWeight - a.categoryWeight);

  if (categorizedBestSellers.length === 0) {
    return null;
  }

  return (
    <section className="bg-slate-50/50 dark:bg-[#090D16] py-16 border-t border-slate-200 dark:border-slate-800 transition-colors w-full max-w-full overflow-hidden" id="best-selling-by-category-section">
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between border-b border-slate-200 dark:border-slate-800 pb-5 mb-10">
          <div>
            <span className="font-mono text-[10px] tracking-widest text-indigo-600 dark:text-indigo-400 uppercase font-bold">CATEGORY LEADERS</span>
            <h2 className="mt-1 font-display text-2xl font-bold text-gray-900 dark:text-white">Best Sellers by Category</h2>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400 font-extralight leading-relaxed">
              Analyzing real-time order history to determine the top 5 high-performance objects in each category.
            </p>
          </div>
          <button
            onClick={() => {
              if (onSelectCategory) {
                onSelectCategory('All');
              } else {
                setCurrentTab('store');
              }
            }}
            className="mt-4 md:mt-0 group flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-transparent self-start md:self-auto cursor-pointer"
          >
            Browse entire collection <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Categories Grid */}
        <div className="space-y-12">
          {categorizedBestSellers.map(({ category, products: categoryProducts }) => (
            <div key={category} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-6 lg:p-8 shadow-[0_4px_20px_rgba(37,44,139,0.02)] dark:shadow-none">
              {/* Category Sub-Header */}
              <div className="flex items-center justify-between gap-2.5 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectCategory) {
                      onSelectCategory(category);
                    } else {
                      setCurrentTab('store');
                    }
                  }}
                  className="flex items-center gap-2 min-w-0 group cursor-pointer hover:opacity-80 transition-opacity text-left"
                >
                  <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500 shrink-0"></span>
                  <h3 className="font-display font-bold text-sm sm:text-base md:text-lg text-gray-800 dark:text-white tracking-tight truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {category}
                  </h3>
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hidden sm:inline-block" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectCategory) {
                      onSelectCategory(category);
                    } else {
                      setCurrentTab('store');
                    }
                  }}
                  className="font-mono text-[9.5px] sm:text-[10px] font-bold text-indigo-600 dark:text-indigo-300 uppercase tracking-wider bg-indigo-50/70 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 px-2 sm:px-2.5 py-1 rounded-md border border-indigo-100/60 dark:border-indigo-800 transition-colors cursor-pointer shrink-0 whitespace-nowrap inline-flex items-center gap-1"
                >
                  <span>View All<span className="hidden sm:inline"> {category}</span></span>
                  <span>&rarr;</span>
                </button>
              </div>

              {/* Products Row (Grid layout - 2 on mobile, 3 on md, 4 on lg, 5 on xl desktop) */}
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-4 lg:gap-5">
                {categoryProducts.map((product, index) => {
                  const { hasDiscount: isSale, originalPrice: originalPriceVal, discountPercent } = getProductDiscountInfo(product);

                  // Define rank styling colors
                  const rankStyles = [
                    { bg: 'bg-amber-500', text: 'text-white', label: '#1 Top' },
                    { bg: 'bg-slate-700 dark:bg-slate-600', text: 'text-white', label: '#2 Pick' },
                    { bg: 'bg-indigo-600', text: 'text-white', label: '#3 Hot' },
                    { bg: 'bg-emerald-600', text: 'text-white', label: '#4 Fav' },
                    { bg: 'bg-purple-600', text: 'text-white', label: '#5 Hit' }
                  ];
                  const currentRank = rankStyles[index] || { bg: 'bg-indigo-100 dark:bg-indigo-950', text: 'text-indigo-800 dark:text-indigo-300', label: `#${index + 1}` };

                  const extraBadge = (
                    <div className={`px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold uppercase tracking-wider shadow-xs ${currentRank.bg} ${currentRank.text} flex items-center gap-0.5 sm:gap-1 font-mono w-fit`}>
                      <Award className="h-2.5 w-2.5" />
                      <span>{currentRank.label}</span>
                    </div>
                  );

                  return (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onSelectProduct={onProductClick}
                      currency={currency}
                      extraBadge={extraBadge}
                      className="h-full"
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
