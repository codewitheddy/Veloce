/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Product, Order } from '../types';
import { HeroBannerSlider } from './HeroBannerSlider';
import DailyOffersSection from './DailyOffersSection';
import BestSellingByCategory from './BestSellingByCategory';
import SaleProducts from './SaleProducts';

interface LandingHomeProps {
  featuredProducts: Product[];
  orders?: Order[];
  setCurrentTab: (tab: string) => void;
  onProductClick: (product: Product) => void;
  onSelectCategory?: (category: string, subcategory?: string) => void;
  onSelectSale?: () => void;
  onTriggerEmailToast?: (mockOrder: Order, status: string) => void;
  onTriggerCustomEmail?: (subject: string, body: string, status?: string) => void;
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
      />

      {/* Best Sellers by Category */}
      <BestSellingByCategory
        products={featuredProducts}
        orders={orders}
        onProductClick={onProductClick}
        setCurrentTab={setCurrentTab}
        onSelectCategory={onSelectCategory}
      />

      {/* Exclusive Archival Offerings (Sale Section) */}
      <SaleProducts
        products={featuredProducts}
        onProductClick={onProductClick}
        setCurrentTab={setCurrentTab}
        onSelectSale={onSelectSale}
      />
    </div>
  );
}
