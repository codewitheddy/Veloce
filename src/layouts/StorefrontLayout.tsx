/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Suspense } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CookieConsent from '../components/CookieConsent';
import SocialProofToast from '../components/SocialProofToast';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ArrowUp, Loader2, AlertTriangle, X } from 'lucide-react';
import { CurrencyType } from '../lib/currency';
import { Product, CartItem, Order } from '../types';
import { useSiteSettings } from '../context/SiteSettingsContext';

interface StorefrontLayoutProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  cart: CartItem[];
  wishlist: string[];
  products: Product[];
  orders?: Order[];
  onSelectProduct: (product: Product | null) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  fontSize: string;
  onChangeFontSize: (size: string) => void;
  currency: CurrencyType;
  onChangeCurrency: (currency: CurrencyType) => void;
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  onSelectCategory?: (category: string, subcategory?: string) => void;
  onSelectSale?: () => void;
  activeCategory?: string;
  activeType?: string;
  promoBanner: { active: boolean; text: string; code: string; discountPercent?: number };
  userRole: 'customer' | 'admin';
  setUserRole: (role: 'customer' | 'admin') => void;
  children: React.ReactNode;
}

export default function StorefrontLayout({
  currentTab,
  onTabChange,
  cart,
  wishlist,
  products,
  orders,
  onSelectProduct,
  darkMode,
  onToggleDarkMode,
  fontSize,
  onChangeFontSize,
  currency,
  onChangeCurrency,
  searchQuery,
  onSearchQueryChange,
  onSelectCategory,
  onSelectSale,
  activeCategory,
  activeType,
  promoBanner,
  userRole,
  setUserRole,
  children,
}: StorefrontLayoutProps) {
  const [showBackToTop, setShowBackToTop] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      if (typeof window !== 'undefined') {
        setShowBackToTop(window.scrollY > 300);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const { settings } = useSiteSettings();
  const [maintenanceDismissed, setMaintenanceDismissed] = useState(false);

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className={`min-h-screen bg-[#F9FAFB] dark:bg-gray-950 text-[#111827] dark:text-gray-100 flex flex-col justify-between font-sans selection:bg-[#111827] dark:selection:bg-indigo-650 selection:text-white transition-colors duration-200 ${darkMode ? 'dark' : ''}`}>
      <div>
        {/* Dynamic Maintenance Mode Notice */}
        {settings.general.maintenance_mode && !maintenanceDismissed && (
          <div className="bg-amber-500 text-amber-950 px-4 py-2 text-center text-xs font-bold font-sans flex items-center justify-center gap-2 shadow-sm relative no-print animate-in slide-in-from-top">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-900" />
            <span>
              <strong>Platform Notice:</strong> {settings.general.maintenance_message || 'Scheduled maintenance is currently in progress.'}
            </span>
            <button
              type="button"
              onClick={() => setMaintenanceDismissed(true)}
              className="ml-4 p-1 rounded-md hover:bg-amber-600/30 transition-colors cursor-pointer"
              title="Dismiss banner"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Customer Storefront Navigation Header */}
        <Header
          currentTab={currentTab}
          setCurrentTab={onTabChange}
          cartCount={totalCartCount}
          userRole={userRole}
          setUserRole={setUserRole}
          wishlistCount={wishlist.length}
          products={products}
          onSelectProduct={(p) => {
            onSelectProduct(p);
            onTabChange('store');
          }}
          darkMode={darkMode}
          onToggleDarkMode={onToggleDarkMode}
          fontSize={fontSize}
          onChangeFontSize={onChangeFontSize}
          currency={currency}
          onChangeCurrency={onChangeCurrency}
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          onSelectCategory={onSelectCategory}
          onSelectSale={onSelectSale}
          activeCategory={activeCategory}
          activeType={activeType}
        />

        {/* Dynamic Promotional Discount Banner */}
        {promoBanner.active && (
          <div className="bg-[#111827] border-b border-gray-800 text-gray-200 px-4 py-2 text-center text-[11px] font-semibold font-sans tracking-wide flex items-center justify-center gap-2 relative no-print animate-in slide-in-from-top duration-300">
            <span className="flex h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span>
              {promoBanner.text} Apply coupon code{' '}
              <strong className="font-mono bg-white/10 text-[#F9FAFB] px-1.5 py-0.5 rounded border border-white/10 uppercase tracking-widest">
                {promoBanner.code}
              </strong>{' '}
              at Checkout!
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(promoBanner.code);
              }}
              className="ml-3 text-[9px] font-mono tracking-widest uppercase bg-amber-500 text-gray-950 font-bold hover:bg-amber-400 px-2 py-0.5 rounded transition-all cursor-pointer"
            >
              Copy Code
            </button>
          </div>
        )}

        {/* Main Customer Page Content */}
        <main className="animate-in fade-in duration-300">
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="min-h-[50vh] flex flex-col items-center justify-center py-20 px-4 text-center">
                  <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mb-3 animate-bounce">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                  <p className="text-xs font-mono text-gray-500 dark:text-gray-400 animate-pulse">
                    Loading View...
                  </p>
                </div>
              }
            >
              {children}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* Floating Back to Top Button */}
      {showBackToTop && (
        <div className="fixed bottom-5 right-5 z-40 font-sans">
          <button
            onClick={scrollToTop}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 dark:bg-indigo-500 text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)] hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all hover:scale-105 active:scale-95 cursor-pointer animate-in fade-in slide-in-from-bottom-4 duration-300"
            title="Back to Top"
            id="btn-back-to-top"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Customer Storefront Footer */}
      <Footer setCurrentTab={onTabChange} />

      {/* Social Proof Real-time Sales Activity Toaster */}
      {userRole === 'customer' && (
        <SocialProofToast
          products={products}
          orders={orders}
          userRole={userRole}
          currentTab={currentTab}
          onSelectProduct={(p) => {
            onSelectProduct(p);
            onTabChange('store');
          }}
          darkMode={darkMode}
        />
      )}

      {/* Customer Cookie Consent Banner */}
      <CookieConsent />
    </div>
  );
}
