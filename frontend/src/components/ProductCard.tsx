'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star, Zap } from 'lucide-react';
import { Product } from '@/types';
import { useCartStore } from '@/store/useCartStore';

export default function ProductCard({ product }: { product: Product }) {
  const { formatPrice, addItem } = useCartStore();
  const slug = product.slug || product.id;

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
      <div>
        {/* Product Image */}
        <div className="relative aspect-square w-full bg-slate-50 overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold">
              VELOCE
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {product.is_featured && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow-xs">
                FEATURED
              </span>
            )}
            {product.stock <= product.low_stock_threshold && product.stock > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                ONLY {product.stock} LEFT
              </span>
            )}
          </div>
        </div>

        {/* Product Details */}
        <div className="p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono mb-1">
            <span>{product.category || 'Veloce Essential'}</span>
            <span>•</span>
            <div className="flex items-center text-amber-500 font-bold">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400 mr-0.5" />
              <span>{product.rating || 5.0}</span>
            </div>
          </div>

          <Link href={`/products/${slug}`} className="block">
            <h3 className="font-semibold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors line-clamp-2">
              {product.name}
            </h3>
          </Link>
        </div>
      </div>

      <div className="p-4 pt-0">
        <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-50">
          <div>
            <span className="text-xs text-slate-400 block -mb-0.5 font-mono">Price</span>
            <span className="text-base font-black text-slate-900 font-mono">
              {formatPrice(Number(product.price))}
            </span>
          </div>

          <button
            onClick={() => addItem(product, 1)}
            disabled={product.stock <= 0}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600 disabled:bg-slate-200 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            {product.stock > 0 ? 'Add to Bag' : 'Out of Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}
