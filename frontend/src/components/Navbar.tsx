'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBag, Search, ShieldCheck, Zap, Globe } from 'lucide-react';
import { useCartStore, CURRENCY_RATES } from '@/store/useCartStore';
import { Currency } from '@/types';

export default function Navbar() {
  const [mounted, setMounted] = useState(false);
  const { items, currency, setCurrency, getItemCount } = useCartStore();
  const count = mounted ? getItemCount() : 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/90 border-b border-slate-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <img
                src="/ropenix_logo.png"
                alt="Ropenix Collections Logo"
                className="h-9 w-auto max-h-10 object-contain shrink-0"
              />
            </Link>

            {/* Navigation links */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-650">
              <Link href="/categories/apparel" className="hover:text-indigo-600 transition-colors">
                Apparel & Wear
              </Link>
              <Link href="/categories/electronics" className="hover:text-indigo-600 transition-colors">
                Electronics
              </Link>
              <Link href="/categories/accessories" className="hover:text-indigo-600 transition-colors">
                Accessories
              </Link>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                <Zap className="w-3 h-3" /> Flash Sales
              </span>
            </nav>
          </div>

          {/* Right actions: Currency Selector & Cart */}
          <div className="flex items-center gap-4">
            {/* Currency Selector */}
            <div className="relative inline-flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono font-semibold text-slate-700">
              <Globe className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="bg-transparent focus:outline-hidden cursor-pointer"
              >
                {Object.keys(CURRENCY_RATES).map((curr) => (
                  <option key={curr} value={curr}>
                    {curr}
                  </option>
                ))}
              </select>
            </div>

            {/* Cart Icon */}
            <Link
              href="/cart"
              className="relative p-2 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
            >
              <ShoppingBag className="w-5 h-5" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
