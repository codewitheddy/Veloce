/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Product, Order } from '../types';
import { Star, TrendingUp, ArrowRight, ShoppingBag, Award } from 'lucide-react';
import { getProductDiscountInfo } from '../utils/productUtils';
import { cleanDescriptionExcerpt } from '../utils/formatDescription';
import { CurrencyType, formatPrice } from '../lib/currency';

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
  const [expandedDescIds, setExpandedDescIds] = React.useState<Record<string, boolean>>({});

  const toggleExpandedDesc = (productId: string) => {
    setExpandedDescIds(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  const getParagraphs = (desc: string) => {
    if (!desc) return [];
    const cleanDesc = cleanDescriptionExcerpt(desc);
    const rawParas = cleanDesc
      .split(/\n+/)
      .map(p => p.trim())
      .filter(Boolean);
    if (rawParas.length <= 1 && cleanDesc.length > 90) {
      const sentences = cleanDesc.match(/[^.!?]+[.!?]+/g) || [cleanDesc];
      if (sentences.length > 1) {
        const mid = Math.ceil(sentences.length / 2);
        return [
          sentences.slice(0, mid).join(' ').trim(),
          sentences.slice(mid).join(' ').trim(),
        ].slice(0, 2);
      }
    }
    return rawParas.slice(0, 2);
  };

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

    // Calculate sum of display or real sales for sorting categories
    const displayCategorySales = topFive.reduce((sum, p) => {
      const realSales = salesMap[p.id] || 0;
      const fallback = Math.floor((p.rating - 3.8) * 8) + Math.floor(p.reviewsCount * 1.2) + 2;
      return sum + (realSales > 0 ? realSales : Math.max(1, fallback));
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
    <section className="bg-slate-50/50 py-16 border-t border-indigo-50" id="best-selling-by-category-section">
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between border-b border-indigo-100 pb-5 mb-10">
          <div>
            <span className="font-mono text-[10px] tracking-widest text-indigo-600 uppercase font-bold">CATEGORY LEADERS</span>
            <h2 className="mt-1 font-display text-2xl font-bold text-gray-900">Best Sellers by Category</h2>
            <p className="mt-1.5 text-xs text-gray-400 font-extralight leading-relaxed">
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
            className="mt-4 md:mt-0 group flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-transparent self-start md:self-auto cursor-pointer"
          >
            Browse entire collection <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Categories Grid */}
        <div className="space-y-12">
          {categorizedBestSellers.map(({ category, products: categoryProducts }) => (
            <div key={category} className="bg-white rounded-2xl border border-indigo-50/60 p-5 sm:p-7 lg:p-8 shadow-[0_4px_20px_rgba(37,44,139,0.02)]">
              {/* Category Sub-Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-indigo-50/50">
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectCategory) {
                      onSelectCategory(category);
                    } else {
                      setCurrentTab('store');
                    }
                  }}
                  className="flex items-center gap-2 group cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500"></span>
                  <h3 className="font-display font-bold text-lg text-gray-800 tracking-tight group-hover:text-indigo-600 transition-colors">
                    {category}
                  </h3>
                  <ArrowRight className="h-4 w-4 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                  className="font-mono text-[10px] font-bold text-indigo-500 uppercase tracking-wider bg-indigo-50/70 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                >
                  View All {category} &rarr;
                </button>
              </div>

              {/* Products Row (Grid layout - 2 on mobile, 3 on md, 4 on lg, 5 on xl desktop) */}
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-4 lg:gap-5">
                {categoryProducts.map((product, index) => {
                  const realSales = salesMap[product.id] || 0;
                  const fallbackSales = Math.floor((product.rating - 3.8) * 8) + Math.floor(product.reviewsCount * 1.2) + 2;
                  const displaySales = realSales > 0 ? realSales : Math.max(1, fallbackSales);

                  const { hasDiscount: isSale, originalPrice: originalPriceVal, discountPercent } = getProductDiscountInfo(product);

                  // Define rank styling colors
                  const rankStyles = [
                    { bg: 'bg-amber-500', text: 'text-white', label: '#1 Top' },
                    { bg: 'bg-slate-700', text: 'text-white', label: '#2 Pick' },
                    { bg: 'bg-indigo-600', text: 'text-white', label: '#3 Hot' },
                    { bg: 'bg-emerald-600', text: 'text-white', label: '#4 Fav' },
                    { bg: 'bg-purple-600', text: 'text-white', label: '#5 Hit' }
                  ];
                  const currentRank = rankStyles[index] || { bg: 'bg-indigo-100', text: 'text-indigo-800', label: `#${index + 1}` };

                  return (
                    <div
                      key={product.id}
                      onClick={() => onProductClick(product)}
                      className="group relative flex flex-col justify-between rounded-xl border border-indigo-50 bg-[#fbfcfd]/40 p-2.5 sm:p-4 cursor-pointer transition-all duration-300 hover:shadow-[0_8px_24px_rgba(37,44,139,0.04)] hover:border-indigo-200/60 hover:bg-white"
                    >
                      <div>
                        {/* Image Container with Rank Badge */}
                        <div className="relative h-32 sm:h-44 w-full overflow-hidden rounded-lg bg-gray-50 border border-indigo-50/30">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                          
                          {/* Rank Badge */}
                          <div className={`absolute top-1.5 sm:top-2.5 left-1.5 sm:left-2.5 px-1.5 sm:px-2 py-0.5 rounded text-[7.5px] sm:text-[9px] font-bold uppercase tracking-wider shadow-xs ${currentRank.bg} ${currentRank.text} flex items-center gap-0.5 sm:gap-1 font-mono`}>
                            <Award className="h-2.5 w-2.5" />
                            <span>{currentRank.label}</span>
                          </div>

                          {/* Sale Discount Tag */}
                          {isSale && (
                            <div className="absolute top-1.5 sm:top-2.5 right-1.5 sm:right-2.5 px-1 sm:px-1.5 py-0.5 rounded bg-amber-500 text-white text-[7.5px] sm:text-[9px] font-mono font-black uppercase shadow-xs">
                              -{discountPercent}%
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="mt-2 sm:mt-3.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[8.5px] sm:text-[10px] font-bold uppercase font-mono tracking-wider text-indigo-500 truncate">
                              {product.category}
                            </span>
                            <div className="flex items-center text-amber-500 text-xs font-bold shrink-0">
                              <Star className="h-2.5 w-2.5 fill-current" />
                              <span className="ml-0.5 text-[8.5px] sm:text-[10px]">{product.rating.toFixed(1)}</span>
                            </div>
                          </div>

                          <h4 className="font-display font-semibold text-[11px] sm:text-xs text-gray-900 mt-0.5 sm:mt-1 uppercase tracking-tight line-clamp-1 group-hover:text-indigo-600 transition-colors">
                            {product.name}
                          </h4>
                          
                          {/* Description block with max 2 paragraphs and read more toggle */}
                          {(() => {
                            const isExpanded = Boolean(expandedDescIds[product.id]);
                            const paras = getParagraphs(product.description || '');
                            if (paras.length === 0) return null;

                            return (
                              <div className="mt-1 space-y-1">
                                {isExpanded ? (
                                  <div className="space-y-1.5 text-[9.5px] sm:text-[11px] text-gray-500 font-extralight leading-relaxed animate-in fade-in duration-200">
                                    {paras.map((para, pIdx) => (
                                      <p key={pIdx} className="leading-snug">{para}</p>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleExpandedDesc(product.id);
                                      }}
                                      className="text-[8.5px] sm:text-[9.5px] font-bold text-indigo-600 hover:text-indigo-800 underline block cursor-pointer pt-0.5"
                                    >
                                      Read less
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-[9.5px] sm:text-[11px] text-gray-500 font-extralight leading-snug">
                                    <p className="line-clamp-2">{paras[0]}</p>
                                    {(paras.length > 1 || (paras[0] && paras[0].length > 60)) && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleExpandedDesc(product.id);
                                        }}
                                        className="text-[8.5px] sm:text-[9.5px] font-bold text-indigo-600 hover:text-indigo-800 underline inline-block mt-0.5 cursor-pointer"
                                      >
                                        Read more
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Ratings info */}
                          <div className="mt-1.5 sm:mt-3 flex items-center gap-1">
                            <div className="flex items-center">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-2.5 w-2.5 sm:h-3 sm:w-3 ${
                                    i < Math.floor(product.rating)
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-gray-200'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-[8.5px] sm:text-[10px] font-semibold text-gray-700 ml-0.5 sm:ml-1">{product.rating}</span>
                            <span className="text-[8px] sm:text-[9px] text-gray-400">({product.reviewsCount})</span>
                          </div>
                        </div>
                      </div>

                      {/* Pricing Footer */}
                      <div className="mt-2.5 sm:mt-4 pt-2 sm:pt-3 border-t border-indigo-50/50 flex items-center justify-between gap-1">
                        <div className="flex flex-col">
                          {isSale && originalPriceVal && (
                            <span className="font-mono text-[8px] sm:text-[10px] line-through text-gray-400">
                              {formatPrice(originalPriceVal, currency)}
                            </span>
                          )}
                          <span className="font-mono font-bold text-[11px] sm:text-sm text-indigo-950">
                            {formatPrice(product.price, currency)}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-0.5 text-[8px] sm:text-[10px] font-bold text-indigo-600 group-hover:text-indigo-850 transition-colors shrink-0">
                          <span className="hidden sm:inline">View details</span>
                          <span className="sm:hidden">View</span>
                          <ArrowRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
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
