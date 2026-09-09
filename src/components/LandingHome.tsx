/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Product, Order, CartItem } from '../types';
import { HeroBannerSlider } from './HeroBannerSlider';
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

  return (
    <div className="bg-[#f8faff] min-h-screen">
      {/* Dynamic Hero Section Banner */}
      <HeroBannerSlider
        onNavigateTab={setCurrentTab}
        onSelectCategory={onSelectCategory}
        onSelectSale={onSelectSale}
        onProductClick={(prodId) => {
          const matched = featuredProducts.find((p) => p.id === prodId || p.slug === prodId);
          if (matched) {
            onProductClick(matched);
          }
        }}
      />

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
