/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShoppingBag,
  LayoutDashboard,
  User,
  Compass,
  Layers,
  BookOpen,
  Sparkles,
  Sun,
  Moon,
  Heart,
  Search,
  X,
  Menu,
  Globe,
  MapPin,
  Truck,
  RotateCcw,
  ChevronDown,
  Type,
  Tag,
  Check,
  Percent,
  Flame,
  ArrowRight,
  Edit3
} from 'lucide-react';
import { Product, Category } from '../types';
import { loadCategoriesFromStorage, fetchCategoriesFromBackend } from '../utils/categoryUtils';
import { CurrencyType, formatPrice } from '../lib/currency';
import { useLanguage } from '../context/LanguageContext';
import { getProductDiscountInfo } from '../utils/productUtils';
import RealTimeCurrencyConverter from './RealTimeCurrencyConverter';
import VeloceLogo from './VeloceLogo';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  cartCount: number;
  userRole: 'customer' | 'admin';
  setUserRole: (role: 'customer' | 'admin') => void;
  wishlistCount: number;
  products?: Product[];
  onSelectProduct?: (product: Product) => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  fontSize?: string;
  onChangeFontSize?: (size: string) => void;
  currency?: CurrencyType;
  onChangeCurrency?: (currency: CurrencyType) => void;
  searchQuery?: string;
  onSearchQueryChange?: (val: string) => void;
  onSelectCategory?: (category: string, subcategory?: string) => void;
  onSelectSale?: () => void;
  activeCategory?: string;
  activeType?: string;
}

const DELIVERY_LOCATIONS = [
  { city: 'Nairobi', country: 'Kenya', flag: '🇰🇪' },
  { city: 'Mombasa', country: 'Kenya', flag: '🇰🇪' },
  { city: 'Kisumu', country: 'Kenya', flag: '🇰🇪' },
  { city: 'Nakuru', country: 'Kenya', flag: '🇰🇪' },
  { city: 'Eldoret', country: 'Kenya', flag: '🇰🇪' },
  { city: 'Dubai', country: 'UAE', flag: '🇦🇪' },
  { city: 'London', country: 'UK', flag: '🇬🇧' },
  { city: 'New York', country: 'USA', flag: '🇺🇸' },
];

export default function Header({
  currentTab,
  setCurrentTab,
  cartCount,
  userRole,
  setUserRole,
  wishlistCount,
  products = [],
  onSelectProduct = () => {},
  darkMode = false,
  onToggleDarkMode = () => {},
  fontSize = 'normal',
  onChangeFontSize = () => {},
  currency = 'KSh',
  onChangeCurrency = () => {},
  searchQuery: searchQueryProp,
  onSearchQueryChange,
  onSelectCategory,
  onSelectSale,
  activeCategory,
  activeType,
}: HeaderProps) {
  const { language, setLanguage, t } = useLanguage();
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const searchQuery = searchQueryProp !== undefined ? searchQueryProp : localSearchQuery;

  const setSearchQuery = (val: string) => {
    setLocalSearchQuery(val);
    if (onSearchQueryChange) {
      onSearchQueryChange(val);
    }
  };

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileSearchSelected, setIsMobileSearchSelected] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  const [isCurrencyConverterOpen, setIsCurrencyConverterOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLocationMenuOpen, setIsLocationMenuOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(DELIVERY_LOCATIONS[0]);
  const [storedCategories, setStoredCategories] = useState<Category[]>(() => loadCategoriesFromStorage());

  useEffect(() => {
    fetchCategoriesFromBackend().then((cats) => {
      if (cats && Array.isArray(cats)) {
        setStoredCategories(cats);
      }
    });

    const handleCategoriesChanged = (e?: Event) => {
      const customEvent = e as CustomEvent<Category[]>;
      if (customEvent && customEvent.detail && Array.isArray(customEvent.detail)) {
        setStoredCategories(customEvent.detail);
      } else {
        fetchCategoriesFromBackend().then((cats) => {
          if (cats && Array.isArray(cats)) {
            setStoredCategories(cats);
          }
        });
      }
    };

    window.addEventListener('storage', handleCategoriesChanged);
    window.addEventListener('veloce_categories_updated', handleCategoriesChanged);
    return () => {
      window.removeEventListener('storage', handleCategoriesChanged);
      window.removeEventListener('veloce_categories_updated', handleCategoriesChanged);
    };
  }, []);

  const rootCategories = useMemo(() => {
    // Strictly return active root categories created by admin in storedCategories
    return storedCategories.filter((c) => !c.parentId && c.status === 'Active');
  }, [storedCategories]);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const locationMenuRef = useRef<HTMLDivElement>(null);
  const categoryDrawerRef = useRef<HTMLDivElement>(null);
  const categoryButtonRef = useRef<HTMLButtonElement>(null);

  // Close menus on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsSearchOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
      if (locationMenuRef.current && !locationMenuRef.current.contains(target)) {
        setIsLocationMenuOpen(false);
      }
      if (
        categoryDrawerRef.current &&
        !categoryDrawerRef.current.contains(target) &&
        categoryButtonRef.current &&
        !categoryButtonRef.current.contains(target)
      ) {
        setIsCategoryDrawerOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsCategoryDrawerOpen(false);
        setIsSearchOpen(false);
        setIsUserMenuOpen(false);
        setIsLocationMenuOpen(false);
        setIsMobileMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Filter products for live search dropdown
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products
      .filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(q);
        const skuMatch = p.sku?.toLowerCase().includes(q);
        const catMatch = p.category?.toLowerCase().includes(q);
        return nameMatch || skuMatch || catMatch;
      })
      .slice(0, 6);
  }, [products, searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setCurrentTab('store');
      setIsSearchOpen(false);
    }
  };

  const handleCategoryClick = (categoryName?: string, subcategoryName?: string) => {
    if (onSearchQueryChange) {
      onSearchQueryChange('');
    }
    if (onSelectCategory) {
      onSelectCategory(categoryName || 'All', subcategoryName || 'All');
    }
    setCurrentTab('store');
    setIsCategoryDrawerOpen(false);
    setIsMobileMenuOpen(false);
  };

  const handleSaleClick = () => {
    if (onSearchQueryChange) {
      onSearchQueryChange('');
    }
    if (onSelectSale) {
      onSelectSale();
    }
    setCurrentTab('store');
    setIsCategoryDrawerOpen(false);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full flex flex-col shadow-xs font-sans">
      {/* 1. TOP UTILITY BAR (Subtle Slate-900 / Slate-950) */}
      <div className="w-full bg-slate-900 text-slate-300 text-xs px-4 sm:px-6 lg:px-8 py-1.5 border-b border-slate-800 transition-colors">
        <div className="w-full max-w-[1440px] mx-auto flex items-center justify-between">
          {/* Left: Location & Quick Services */}
          <div className="flex items-center gap-3 sm:gap-5 overflow-x-auto scrollbar-none py-0.5">
            {/* Location Selector */}
            <div className="relative" ref={locationMenuRef}>
              <button
                type="button"
                onClick={() => setIsLocationMenuOpen(!isLocationMenuOpen)}
                className="flex items-center gap-1.5 text-slate-300 hover:text-white font-medium cursor-pointer transition-colors text-[11px] sm:text-xs whitespace-nowrap"
              >
                <span className="text-slate-400">Deliver to</span>
                <span className="font-bold text-white flex items-center gap-1">
                  <span>{selectedLocation.flag}</span>
                  <span>{selectedLocation.city}</span>
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isLocationMenuOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-48 bg-slate-900 border border-slate-750 rounded-lg shadow-2xl z-50 py-1.5 animate-in fade-in">
                  <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 mb-1">
                    Select Destination
                  </div>
                  {DELIVERY_LOCATIONS.map((loc) => (
                    <button
                      key={loc.city}
                      onClick={() => {
                        setSelectedLocation(loc);
                        setIsLocationMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-800 transition-colors ${
                        selectedLocation.city === loc.city ? 'text-indigo-400 font-bold bg-slate-800/80' : 'text-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{loc.flag}</span>
                        <span>{loc.city}, {loc.country}</span>
                      </span>
                      {selectedLocation.city === loc.city && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Express Delivery */}
            <div className="hidden md:flex items-center gap-1.5 text-slate-400 font-medium text-[11px] sm:text-xs whitespace-nowrap">
              <Truck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Express Delivery</span>
            </div>

            {/* Free Returns */}
            <div className="hidden lg:flex items-center gap-1.5 text-slate-400 font-medium text-[11px] sm:text-xs whitespace-nowrap">
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Free Returns</span>
            </div>

            {/* Our Location */}
            <button
              onClick={() => setCurrentTab('support')}
              className="hidden lg:flex items-center gap-1.5 text-slate-400 hover:text-white font-medium text-[11px] sm:text-xs whitespace-nowrap cursor-pointer transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              <span>Our Location</span>
            </button>
          </div>

          {/* Right: Dark Mode Toggle, Currency, Language */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Dark/Light Mode Pill Switch */}
            <button
              type="button"
              onClick={onToggleDarkMode}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-full px-2 py-0.5 text-[11px] text-slate-200 transition-all cursor-pointer"
            >
              {darkMode ? (
                <>
                  <Moon className="w-3 h-3 text-indigo-400" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3 h-3 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              )}
            </button>

            {/* Currency Selector */}
            <div className="relative">
              <select
                value={currency}
                onChange={(e) => onChangeCurrency(e.target.value as CurrencyType)}
                className="bg-slate-800 border border-slate-700 hover:border-slate-500 rounded px-2 py-0.5 text-[11px] font-bold text-white cursor-pointer focus:outline-none appearance-none pr-5"
              >
                <option value="KSh" className="bg-slate-900 text-white">KES (KSh)</option>
                <option value="USD" className="bg-slate-900 text-white">USD ($)</option>
                <option value="EUR" className="bg-slate-900 text-white">EUR (€)</option>
                <option value="GBP" className="bg-slate-900 text-white">GBP (£)</option>
                <option value="AED" className="bg-slate-900 text-white">AED (د.إ)</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Language Selector */}
            <div className="relative">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="bg-slate-800 border border-slate-700 hover:border-slate-500 rounded px-2 py-0.5 text-[11px] font-bold text-white cursor-pointer focus:outline-none appearance-none pr-5"
              >
                <option value="en" className="bg-slate-900 text-white">🌐 English</option>
                <option value="sw" className="bg-slate-900 text-white">🌐 Kiswahili</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN NAVBAR (Crisp Surface Background with Indigo Brand Elements) */}
      <div className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white px-4 sm:px-6 lg:px-8 py-3 transition-colors">
        <div className="w-full max-w-[1440px] mx-auto flex items-center justify-between gap-4 md:gap-8">
          {/* Brand Logo: VELOCE */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setCurrentTab('home')}
              className="flex items-center gap-2 cursor-pointer text-left focus:outline-none select-none group"
            >
              <VeloceLogo size="md" light={false} />
            </button>
          </div>

          {/* Center Search Bar with Integrated Primary CTA Button */}
          <div className="flex-1 max-w-2xl relative hidden md:block" ref={searchContainerRef}>
            <form onSubmit={handleSearchSubmit} className="flex items-stretch w-full">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  placeholder="What are you looking for?"
                  className="w-full h-11 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm px-4 rounded-l-md focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                aria-label="Search catalog"
                className="h-11 px-5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-r-md flex items-center justify-center cursor-pointer transition-colors shadow-xs border-y border-r border-indigo-600 hover:border-indigo-700"
              >
                <Search className="w-5 h-5 text-white stroke-[2.5]" />
              </button>
            </form>

            {/* Live Search Autocomplete Dropdown */}
            {isSearchOpen && searchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xl overflow-hidden z-50 max-h-96 overflow-y-auto">
                <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850">
                  <span>Products matching "{searchQuery}"</span>
                  <span className="font-semibold">{filteredProducts.length} results</span>
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    No products found. Press enter to search full catalog.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => {
                          onSelectProduct(product);
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="w-full p-2.5 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <img
                          src={product.images?.[0] || (product as any).image || '/placeholder-product.png'}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 object-contain rounded bg-slate-50 dark:bg-slate-800 p-0.5 shrink-0 border border-slate-200 dark:border-slate-700"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{product.name}</p>
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-mono">{product.category}</span>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end">
                          {(() => {
                            const { hasDiscount, originalPrice: originalPriceVal } = getProductDiscountInfo(product);
                            return (
                              <>
                                {hasDiscount && originalPriceVal && (
                                  <div className="flex items-center gap-1">
                                    <span className="bg-rose-500 text-white text-[8px] font-mono font-bold px-1 rounded uppercase">SALE</span>
                                    <span className="font-mono text-[10px] text-slate-400 line-through">
                                      {formatPrice(originalPriceVal, currency)}
                                    </span>
                                  </div>
                                )}
                                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                  {formatPrice(product.price, currency)}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Action Icons: User Account, Wishlist, Your Cart */}
          <div className="flex items-center gap-4 sm:gap-6 shrink-0">
            {/* Mobile Search Toggle Button */}
            <button
              onClick={() => setIsMobileSearchSelected(true)}
              aria-label="Open mobile search"
              className="flex md:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* User Account & Roles Portal */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer focus:outline-none select-none py-1 transition-colors"
                aria-label="User account menu"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200">
                  <User className="w-4 h-4" />
                </div>
                <div className="hidden lg:flex flex-col items-start leading-tight">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    {typeof window !== 'undefined' && localStorage.getItem('veloce_login_name') ? 'Welcome' : 'Account'}
                  </span>
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-900 dark:text-white flex items-center gap-1">
                    {typeof window !== 'undefined' && localStorage.getItem('veloce_login_name') ? `HELLO ${localStorage.getItem('veloce_login_name')?.split(' ')[0].toUpperCase()}` : 'MY ACCOUNT'} <ChevronDown className="w-3 h-3 text-slate-400" />
                  </span>
                </div>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-2 text-sm text-slate-700 dark:text-slate-200 animate-in fade-in">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {typeof window !== 'undefined' && (localStorage.getItem('ropenix_login_name') || localStorage.getItem('veloce_login_name')) ? (localStorage.getItem('ropenix_login_name') || localStorage.getItem('veloce_login_name')) : 'Store Customer'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {typeof window !== 'undefined' && (localStorage.getItem('ropenix_login_email') || localStorage.getItem('veloce_login_email')) ? (localStorage.getItem('ropenix_login_email') || localStorage.getItem('veloce_login_email')) : 'customer@ropenix.co.ke'}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setCurrentTab('order-lookup');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <Truck className="w-4 h-4 text-emerald-500" />
                    <span>Track Orders</span>
                  </button>

                  <button
                    onClick={() => {
                      setCurrentTab('user');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <User className="w-4 h-4 text-indigo-500" />
                    <span>Customer Profile</span>
                  </button>

                  {/* Font Scaling Options */}
                  <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="px-3 py-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1.5"><Type className="w-3.5 h-3.5" /> Text Size</span>
                      <select
                        value={fontSize}
                        onChange={(e) => onChangeFontSize(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[10px] rounded px-1.5 py-0.5 border border-slate-200 dark:border-slate-700 focus:outline-none"
                      >
                        <option value="small">Small</option>
                        <option value="normal">Normal</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* WISHLIST with Badge */}
            <button
              onClick={() => setCurrentTab('user')}
              className="flex flex-col items-center justify-center cursor-pointer group focus:outline-none select-none relative"
            >
              <div className="relative">
                <Heart className="w-6 h-6 text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-indigo-600 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {wishlistCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 mt-1 transition-colors">
                WISHLIST
              </span>
            </button>

            {/* YOUR CART with Badge */}
            <button
              onClick={() => setCurrentTab('checkout')}
              className="flex flex-col items-center justify-center cursor-pointer group focus:outline-none select-none relative"
            >
              <div className="relative">
                <ShoppingBag className="w-6 h-6 text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                <span className="absolute -top-1.5 -right-2 bg-indigo-600 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {cartCount > 0 ? cartCount : 1}
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 mt-1 transition-colors">
                YOUR CART
              </span>
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex lg:hidden p-2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 3. CATEGORY & SPECIALS SUB-NAVBAR */}
      <div className="w-full bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-4 sm:px-6 lg:px-8 py-1 select-none shadow-2xs">
        <div className="w-full max-w-[1440px] mx-auto flex items-center justify-between gap-3 lg:gap-6">
          {/* Left Category Button & Navigation Links */}
          <div className="flex items-center gap-2 lg:gap-3 overflow-x-auto scrollbar-none min-w-0 flex-1 py-0.5">
            {/* ALL CATEGORIES Button */}
            <button
              ref={categoryButtonRef}
              onClick={() => setIsCategoryDrawerOpen(!isCategoryDrawerOpen)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm px-3.5 sm:px-4 py-1.5 rounded-md cursor-pointer transition-all shrink-0 shadow-xs border border-indigo-700"
            >
              <Menu className="w-4 h-4 text-indigo-100" />
              <span className="uppercase tracking-wider whitespace-nowrap">ALL CATEGORIES</span>
            </button>

            {/* Category Links */}
            <div className="hidden sm:flex items-center gap-1 xl:gap-2 overflow-x-auto scrollbar-none">
              {rootCategories.length > 0 ? (
                rootCategories.map((cat) => {
                  const isCatActive = currentTab === 'store' && activeType !== 'sale' && activeCategory === cat.name;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryClick(cat.name)}
                      className={`px-2.5 lg:px-3 py-1 text-[11px] lg:text-xs xl:text-[13px] font-semibold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                        isCatActive
                          ? 'bg-indigo-600 text-white font-bold shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40'
                      }`}
                    >
                      <span>{cat.name}</span>
                    </button>
                  );
                })
              ) : (
                <button
                  onClick={() => handleCategoryClick()}
                  className="px-2.5 lg:px-3 py-1 text-[11px] lg:text-xs xl:text-[13px] font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 rounded transition-colors whitespace-nowrap shrink-0"
                >
                  CATALOG STORE
                </button>
              )}
            </div>
          </div>

          {/* Right Highlights: NEW RELEASES & CLEARANCE SALE Tabs */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 pl-2">
            <button
              onClick={() => handleCategoryClick('All')}
              className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] sm:text-xs px-2.5 sm:px-3.5 py-1.5 rounded uppercase tracking-wider cursor-pointer shadow-3xs transition-colors whitespace-nowrap"
            >
              NEW RELEASES
            </button>
            <button
              onClick={handleSaleClick}
              className={`font-bold text-[10px] sm:text-xs px-2.5 sm:px-3.5 py-1.5 rounded uppercase tracking-wider cursor-pointer shadow-xs transition-colors whitespace-nowrap ${
                currentTab === 'store' && activeType === 'sale'
                  ? 'bg-amber-600 text-white ring-2 ring-amber-400'
                  : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white'
              }`}
            >
              CLEARANCE SALE
            </button>
          </div>
        </div>
      </div>

      {/* ALL CATEGORIES DROPDOWN DRAWER */}
      {isCategoryDrawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setIsCategoryDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={categoryDrawerRef}
            className="relative z-50 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 p-6 shadow-2xl animate-in slide-in-from-top-2 duration-200 max-h-[80vh] overflow-y-auto"
          >
            <div className="w-full max-w-[1440px] mx-auto">
              {rootCategories.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {rootCategories.map((rootCat) => {
                    const childSubs = storedCategories.filter(
                      (c) => c.parentId === rootCat.id && c.status === 'Active'
                    );
                    return (
                      <div key={rootCat.id} className="space-y-2">
                        <h4 className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400 uppercase mb-2 flex items-center gap-2">
                          <button
                            onClick={() => handleCategoryClick(rootCat.name)}
                            className="hover:text-indigo-800 dark:hover:text-indigo-300 text-left font-bold transition-colors flex items-center gap-1.5 group cursor-pointer"
                          >
                            <span className="group-hover:underline">{rootCat.name}</span>
                          </button>
                        </h4>
                        {childSubs.length > 0 ? (
                          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                            {childSubs.map((sub) => (
                              <li key={sub.id}>
                                <button
                                  onClick={() => handleCategoryClick(rootCat.name, sub.name)}
                                  className="hover:text-indigo-600 dark:hover:text-indigo-300 text-left cursor-pointer transition-colors hover:translate-x-0.5 transform block"
                                >
                                  {sub.name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Catalog collection</p>
                        )}
                      </div>
                    );
                  })}

                  <div className="space-y-2">
                    <h4 className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400 uppercase mb-2 flex items-center gap-2">
                      Quick Portals
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <li>
                        <button
                          onClick={() => {
                            handleCategoryClick();
                          }}
                          className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                        >
                          All Products Catalog
                        </button>
                      </li>
                      <li>
                        <button
                          onClick={() => {
                            setCurrentTab('services');
                            setIsCategoryDrawerOpen(false);
                          }}
                          className="hover:text-indigo-600 dark:hover:text-indigo-300 font-semibold cursor-pointer"
                        >
                          Custom Services
                        </button>
                      </li>
                      <li>
                        <button
                          onClick={() => {
                            setCurrentTab('blog');
                            setIsCategoryDrawerOpen(false);
                          }}
                          className="hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer"
                        >
                          Insights & News
                        </button>
                      </li>
                      <li>
                        <button
                          onClick={() => {
                            setCurrentTab('contact');
                            setIsCategoryDrawerOpen(false);
                          }}
                          className="hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer"
                        >
                          Contact & Support
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center flex flex-col items-center justify-center gap-2">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No custom categories created yet.
                  </p>
                  <p className="text-xs text-slate-500 max-w-md">
                    Categories created in the Admin Dashboard will automatically appear here.
                  </p>
                  <button
                    onClick={() => {
                      setCurrentTab('store');
                      setIsCategoryDrawerOpen(false);
                    }}
                    className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    Browse Store Catalog
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* MOBILE FULL DRAWER */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-slate-900 border-t border-slate-800 text-white p-4 space-y-4 animate-in slide-in-from-top-2">
          {/* Navigation Links */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setCurrentTab('home'); setIsMobileMenuOpen(false); }}
              className="p-3 bg-slate-800 rounded-lg text-left font-bold text-xs hover:bg-slate-750 text-slate-100 hover:text-white"
            >
              Home
            </button>
            <button
              onClick={() => { setCurrentTab('store'); setIsMobileMenuOpen(false); }}
              className="p-3 bg-slate-800 rounded-lg text-left font-bold text-xs hover:bg-slate-750 text-slate-100 hover:text-white"
            >
              Store & Catalog
            </button>
            <button
              onClick={() => { setCurrentTab('services'); setIsMobileMenuOpen(false); }}
              className="p-3 bg-slate-800 rounded-lg text-left font-bold text-xs hover:bg-slate-750 text-slate-100 hover:text-white"
            >
              Services
            </button>
            <button
              onClick={() => { setCurrentTab('blog'); setIsMobileMenuOpen(false); }}
              className="p-3 bg-slate-800 rounded-lg text-left font-bold text-xs hover:bg-slate-750 text-slate-100 hover:text-white"
            >
              Insights & Blog
            </button>
          </div>

          {/* Admin Categories Section in Mobile Menu */}
          {rootCategories.length > 0 && (
            <div className="pt-2 border-t border-slate-800">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
                Browse Categories
              </p>
              <div className="flex flex-wrap gap-1.5">
                {rootCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryClick(cat.name)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile Search Overlay Modal */}
      {isMobileSearchSelected && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-sm flex flex-col p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <input
                type="text"
                autoFocus
                placeholder="What are you looking for?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-4 focus:outline-none focus:border-indigo-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setIsMobileSearchSelected(false)}
              className="text-sm font-bold text-slate-300 hover:text-white px-2 py-1 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onSelectProduct(p);
                  setIsMobileSearchSelected(false);
                  setSearchQuery('');
                }}
                className="w-full p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center gap-3 text-left hover:bg-slate-850"
              >
                <img
                  src={p.images?.[0] || (p as any).image || '/placeholder-product.png'}
                  alt={p.name}
                  className="w-12 h-12 object-contain bg-white rounded p-1 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{p.name}</p>
                  <p className="text-xs text-indigo-400 font-mono">{p.category}</p>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end">
                  {(() => {
                    const { hasDiscount, originalPrice: originalPriceVal } = getProductDiscountInfo(p);
                    return (
                      <>
                        {hasDiscount && originalPriceVal && (
                          <div className="flex items-center gap-1">
                            <span className="bg-rose-500 text-white text-[8px] font-mono font-bold px-1 rounded uppercase">SALE</span>
                            <span className="font-mono text-xs text-slate-400 line-through">
                              {formatPrice(originalPriceVal, currency)}
                            </span>
                          </div>
                        )}
                        <span className="font-mono text-sm font-bold text-white">
                          {formatPrice(p.price, currency)}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <RealTimeCurrencyConverter
        isOpen={isCurrencyConverterOpen}
        onClose={() => setIsCurrencyConverterOpen(false)}
        activeCurrency={currency}
        onChangeCurrency={onChangeCurrency}
      />
    </header>
  );
}
