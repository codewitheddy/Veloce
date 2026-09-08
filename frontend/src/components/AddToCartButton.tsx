'use client';

import React, { useState } from 'react';
import { ShoppingBag, Check, Zap, Loader2 } from 'lucide-react';
import { Product } from '@/types';
import { useCartStore } from '@/store/useCartStore';

export default function AddToCartButton({ product }: { product: Product }) {
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const { addItem, formatPrice } = useCartStore();

  const handleAdd = () => {
    addItem(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (product.stock <= 0) {
    return (
      <div className="w-full py-4 px-6 rounded-2xl bg-slate-100 text-slate-400 font-bold text-center text-sm">
        Currently Out of Stock
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {/* Quantity selector */}
        <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-slate-600 hover:bg-white transition-colors"
          >
            -
          </button>
          <span className="w-10 text-center font-mono font-bold text-sm text-slate-900">
            {quantity}
          </span>
          <button
            onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-slate-600 hover:bg-white transition-colors"
          >
            +
          </button>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={handleAdd}
          className={`flex-1 py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
            added
              ? 'bg-emerald-600 text-white shadow-emerald-200'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 hover:scale-[1.01]'
          }`}
        >
          {added ? (
            <>
              <Check className="w-4 h-4" /> Added to Shopping Bag
            </>
          ) : (
            <>
              <ShoppingBag className="w-4 h-4" /> Add to Bag • {formatPrice(Number(product.price) * quantity)}
            </>
          )}
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs font-mono text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
        <Zap className="w-4 h-4 shrink-0" />
        <span>In Stock & Ready for Same-Day Dispatch in Nairobi / 24-48hr Regional Transit</span>
      </div>
    </div>
  );
}
