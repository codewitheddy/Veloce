/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Home, ShoppingBag, Search, Heart, User, Sparkles } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface MobileBottomNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  cartCount: number;
  wishlistCount: number;
  onOpenSearch?: () => void;
  onOpenStoreWithCategory?: (category: string) => void;
  darkMode?: boolean;
}

export default function MobileBottomNav({
  currentTab,
  onTabChange,
  cartCount,
  wishlistCount,
  onOpenSearch,
  onOpenStoreWithCategory,
  darkMode = false,
}: MobileBottomNavProps) {
  const { t } = useLanguage();
  const { user, isAuthenticated } = useAuth();

  const isHomeActive = currentTab === 'home';
  const isStoreActive = currentTab === 'store';
  const isWishlistActive = currentTab === 'wishlist' || (currentTab === 'user' && false);
  const isCartActive = currentTab === 'checkout';
  const isUserActive = currentTab === 'user';

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_25px_rgba(0,0,0,0.4)] transition-all select-none"
      style={{
        paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom, 0.4rem))',
      }}
    >
      <div className="max-w-md mx-auto px-2 pt-1.5 pb-1 flex items-center justify-around">
        
        {/* 1. HOME */}
        <button
          type="button"
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer relative min-w-[56px] ${
            isHomeActive
              ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <Home className={`w-5 h-5 transition-transform ${isHomeActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            {isHomeActive && (
              <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1 leading-none">
            {t('home') || 'Home'}
          </span>
        </button>

        {/* 2. SHOP / CATALOG */}
        <button
          type="button"
          onClick={() => {
            if (onOpenStoreWithCategory) {
              onOpenStoreWithCategory('All');
            } else {
              onTabChange('store');
            }
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer relative min-w-[56px] ${
            isStoreActive
              ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <Sparkles className={`w-5 h-5 transition-transform ${isStoreActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            {isStoreActive && (
              <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1 leading-none">
            {t('store') || 'Shop'}
          </span>
        </button>

        {/* 3. INSTANT SEARCH */}
        <button
          type="button"
          onClick={() => {
            if (onOpenSearch) {
              onOpenSearch();
            } else {
              onTabChange('store');
            }
          }}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium transition-all cursor-pointer min-w-[56px]"
          aria-label="Open search"
        >
          <div className="w-9 h-9 -mt-1 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 active:scale-95 transition-transform">
            <Search className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="text-[9.5px] font-bold text-slate-600 dark:text-slate-300 mt-0.5 leading-none">
            Search
          </span>
        </button>

        {/* 4. CART with live Badge */}
        <button
          type="button"
          onClick={() => onTabChange('checkout')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer relative min-w-[56px] ${
            isCartActive
              ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <ShoppingBag className={`w-5 h-5 transition-transform ${isCartActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-indigo-600 text-white font-bold text-[9px] min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center shadow-xs border border-white dark:border-slate-950 animate-in zoom-in duration-200">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
            {isCartActive && (
              <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1 leading-none">
            {t('yourCart') || 'Cart'}
          </span>
        </button>

        {/* 5. ACCOUNT / ORDERS */}
        <button
          type="button"
          onClick={() => onTabChange('user')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer relative min-w-[56px] ${
            isUserActive
              ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <User className={`w-5 h-5 transition-transform ${isUserActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            {isAuthenticated && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-slate-950" />
            )}
            {wishlistCount > 0 && !isAuthenticated && (
              <span className="absolute -top-1 -right-2 bg-rose-500 text-white font-bold text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center">
                {wishlistCount}
              </span>
            )}
            {isUserActive && (
              <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1 leading-none">
            {isAuthenticated ? (user?.name?.split(' ')[0] || 'Account') : (t('account') || 'Account')}
          </span>
        </button>

      </div>
    </nav>
  );
}
