/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { WifiOff, Package } from 'lucide-react';
import { Product, Order, CartItem } from '../types';
import DailyOffersSection from './DailyOffersSection';
import BestSellersNewArrivalsCarousel from './BestSellersNewArrivalsCarousel';
import BestSellingByCategory from './BestSellingByCategory';
import SaleProducts from './SaleProducts';

import { CurrencyType } from '../lib/currency';

interface LandingHomeProps {
  featuredProducts: Product[];
  orders?: Order[];
  setCurrentTab: (tab: string) => void;
  onProductClick: (product: Product) => void;
  onSelectCategory?: (category: string, subcategory?: string) => void;
  onSelectSale?: () => void;
  onTriggerEmailToast?: (mockOrder: Order, status: string) => void;
  onTriggerCustomEmail?: (subject: string, body: string, status?: string) => void;
  onAddToCart?: (product: Product, quantity: number, vars: Record<string, string>) => void;
  cart?: CartItem[];
  wishlist?: string[];
  onToggleWishlist?: (productId: string) => void;
  darkMode?: boolean;
  currency?: CurrencyType;
}

export default function LandingHome({
  featuredProducts,
  orders = [],
  setCurrentTab,
  onProductClick,
  onSelectCategory,
  onSelectSale,
  onTriggerEmailToast,
  onTriggerCustomEmail,
  onAddToCart,
  cart = [],
  wishlist = [],
  onToggleWishlist = () => {},
  darkMode = false,
  currency = 'KSh',
}: LandingHomeProps) {

  if (!featuredProducts || featuredProducts.length === 0) {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    return (
      <div className="bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mb-4 text-indigo-500 border border-indigo-100 dark:border-indigo-900/40">
          {isOffline ? <WifiOff className="w-7 h-7 text-rose-500" /> : <Package className="w-7 h-7 text-gray-400" />}
        </div>
        <h2 className="text-lg sm:text-xl font-bold mb-2">
          {isOffline ? 'No Internet Connection' : 'No Products Available'}
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-md mb-6 leading-relaxed">
          {isOffline
            ? 'Unable to connect to the live catalog. Please check your internet connection and try again.'
            : 'The product catalog is currently being updated. Please check back shortly.'}
        </p>
        {isOffline ? (
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            Retry Connection
          </button>
        ) : (
          <button
            onClick={() => setCurrentTab('store')}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            Browse Store
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 min-h-screen transition-colors duration-200 w-full max-w-full">
      {/* Daily Offers Carousel Section */}
      <DailyOffersSection
        products={featuredProducts}
        onProductClick={onProductClick}
        setCurrentTab={setCurrentTab}
        onSelectSale={onSelectSale}
        currency={currency}
      />

      {/* Curated Showcase: Best Selling Products & New Arrivals */}
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <BestSellersNewArrivalsCarousel
          products={featuredProducts}
          onSelectProduct={onProductClick}
          onAddToCart={onAddToCart}
          cart={cart}
          onViewCart={() => setCurrentTab('checkout')}
          wishlist={wishlist}
          onToggleWishlist={onToggleWishlist}
          darkMode={darkMode}
          currency={currency}
          className="shadow-xs"
        />
      </div>

      {/* Best Sellers by Category (CATEGORY LEADERS) */}
      <BestSellingByCategory
        products={featuredProducts}
        orders={orders}
        onProductClick={onProductClick}
        setCurrentTab={setCurrentTab}
        onSelectCategory={onSelectCategory}
        currency={currency}
      />

      {/* Exclusive Archival Offerings (Sale Section) */}
      <SaleProducts
        products={featuredProducts}
        onProductClick={onProductClick}
        setCurrentTab={setCurrentTab}
        onSelectSale={onSelectSale}
        currency={currency}
      />
    </div>
  );
}
