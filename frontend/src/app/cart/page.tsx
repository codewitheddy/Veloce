'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBag, Trash2, ArrowRight, ShieldCheck, Zap, Globe } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';

export default function CartPage() {
  const [mounted, setMounted] = useState(false);
  const { items, currency, removeItem, updateQuantity, clearCart, formatPrice, getRawSubtotal } = useCartStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const subtotal = getRawSubtotal();

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-md shadow-indigo-100">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black font-display text-slate-900">Your Bag is Empty</h1>
          <p className="text-sm text-slate-500 font-light">
            Explore our latest high-performance releases and gear up today.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-200 transition-all hover:scale-105"
        >
          <span>Start Shopping</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <h1 className="text-3xl font-black font-display text-slate-900 tracking-tight">
        Shopping Bag ({items.reduce((acc, i) => acc + i.quantity, 0)})
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
        {/* Cart Item List */}
        <div className="lg:col-span-2 space-y-4">
          {items.map(({ product, quantity }) => (
            <div
              key={product.id}
              className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-xs flex items-center gap-6"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-50 overflow-hidden shrink-0 border border-slate-100">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-xs">
                    VELOCE
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  {product.category || 'Gear'}
                </span>
                <h3 className="font-semibold text-slate-900 text-sm truncate">
                  {product.name}
                </h3>
                <span className="text-sm font-bold font-mono text-slate-900 block">
                  {formatPrice(Number(product.price))}
                </span>
              </div>

              {/* Quantity controls */}
              <div className="flex items-center gap-2 border border-slate-200 rounded-xl bg-slate-50 p-1">
                <button
                  onClick={() => updateQuantity(product.id, quantity - 1)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-slate-600 hover:bg-white transition-colors"
                >
                  -
                </button>
                <span className="w-6 text-center font-mono font-bold text-xs text-slate-900">
                  {quantity}
                </span>
                <button
                  onClick={() => updateQuantity(product.id, quantity + 1)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-slate-600 hover:bg-white transition-colors"
                >
                  +
                </button>
              </div>

              {/* Remove button */}
              <button
                onClick={() => removeItem(product.id)}
                className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                title="Remove item"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={clearCart}
              className="text-xs font-mono font-bold text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
            >
              Clear Entire Bag
            </button>
            <Link
              href="/"
              className="text-xs font-mono font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              + Continue Shopping
            </Link>
          </div>
        </div>

        {/* Order Summary & Checkout Trigger */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-md space-y-6">
          <h3 className="text-lg font-black font-display text-slate-900">
            Order Summary
          </h3>

          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-mono font-bold text-slate-900">
                {formatPrice(subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>VAT & Regional Taxes</span>
              <span>Calculated at checkout</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Shipping</span>
              <span className="text-emerald-600 font-bold">Standard Regional</span>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 flex justify-between items-baseline">
            <span className="text-base font-bold text-slate-900">Estimated Total</span>
            <span className="text-2xl font-black font-mono text-slate-900">
              {formatPrice(subtotal)}
            </span>
          </div>

          <Link
            href="/checkout"
            className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all hover:scale-[1.01]"
          >
            <span>Proceed to Checkout</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <div className="pt-2 flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>15-minute stock hold locks automatically upon proceeding.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
