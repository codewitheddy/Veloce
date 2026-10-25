/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Tag, Star, ShoppingBag, Check, Heart, Edit2, SlidersHorizontal } from 'lucide-react';
import { Product, CartItem } from '../types';
import LazyImage from './LazyImage';
import { getProductDiscountInfo, checkProductHasVariants } from '../utils/productUtils';
import { CurrencyType, formatPrice } from '../lib/currency';

export interface ProductCardProps {
  product: Product;
  onSelectProduct?: (product: Product) => void;
  onAddToCart?: (product: Product, quantity: number, vars: Record<string, string>) => void;
  cart?: CartItem[];
  wishlist?: string[];
  onToggleWishlist?: (productId: string) => void;
  onEditProduct?: (product: Product) => void;
  onViewCart?: () => void;
  currency?: CurrencyType;
  className?: string;
  extraBadge?: React.ReactNode;
}

export default function ProductCard({
  product,
  onSelectProduct,
  onAddToCart,
  cart = [],
  wishlist = [],
  onToggleWishlist,
  onEditProduct,
  onViewCart,
  currency = 'KSh',
  className = '',
  extraBadge,
}: ProductCardProps) {
  const [isAdded, setIsAdded] = useState(false);

  const isOutOfStock =
    product.type === 'physical' &&
    product.stock !== null &&
    product.stock !== undefined &&
    product.stock <= 0;

  const hasVariants = Boolean(
    checkProductHasVariants(product) ||
    (Array.isArray(product.options) && product.options.length > 0) ||
    (Array.isArray(product.variations) && product.variations.length > 0) ||
    (Array.isArray(product.variantMatrix) && product.variantMatrix.length > 0)
  );

  const isInCart = cart.some((item) => item.product.id === product.id);
  const isWishlisted = wishlist.includes(product.id);
  const showViewCart = isInCart && !isAdded;
  const { hasDiscount, originalPrice: origPrice, discountPercent } = getProductDiscountInfo(product);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;

    // For products with variants (sizes, colors, options), open the selection view
    if (hasVariants) {
      onSelectProduct?.(product);
      return;
    }

    if (onAddToCart) {
      onAddToCart(product, 1, {});
      setIsAdded(true);
      setTimeout(() => {
        setIsAdded(false);
      }, 1500);
    } else if (onSelectProduct) {
      onSelectProduct(product);
    }
  };

  return (
    <div
      onClick={() => onSelectProduct?.(product)}
      className={`group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/85 dark:border-slate-800/90 bg-white dark:bg-slate-900 cursor-pointer transition-all duration-300 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-lg hover:-translate-y-0.5 ${className}`}
    >
      <div>
        {/* Product Image Box (Edge-to-Edge Flush) */}
        <div className="relative aspect-square w-full overflow-hidden bg-slate-50 dark:bg-slate-950/80 border-b border-slate-100 dark:border-slate-800/80">
          <LazyImage
            src={product.imageUrl || product.images?.[0] || ''}
            alt={product.name}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          />

          {/* Top-Left Badges Overlay */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
            {hasDiscount && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9.5px] font-mono font-bold bg-rose-600 text-white shadow-xs">
                <Tag className="w-2.5 h-2.5" />
                <span>-{discountPercent}%</span>
              </span>
            )}
            {product.type && product.type !== 'physical' && (
              <span className="px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-300 uppercase shadow-xs border border-slate-200/50 dark:border-slate-800/50 w-fit">
                {product.type}
              </span>
            )}
            {extraBadge}
          </div>

          {/* Top-Right Heart / Wishlist Button */}
          {onToggleWishlist && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleWishlist(product.id);
              }}
              className="absolute top-2.5 right-2.5 z-10 flex h-7.5 w-7.5 items-center justify-center rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs shadow-xs hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 transition-all cursor-pointer border border-slate-200/60 dark:border-slate-700/60"
              title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
            >
              <Heart
                className={`h-4 w-4 transition-all ${
                  isWishlisted
                    ? 'fill-current text-rose-500'
                    : 'text-slate-400 dark:text-slate-500 hover:text-rose-500'
                }`}
              />
            </button>
          )}

          {/* Top-Right Admin Edit Button */}
          {onEditProduct && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditProduct(product);
              }}
              className="absolute top-11 right-2.5 z-10 flex h-7.5 w-7.5 items-center justify-center rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs shadow-xs hover:bg-indigo-50 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 transition-all cursor-pointer border border-slate-200/60 dark:border-slate-700/60"
              title="Edit product specification"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Bottom-Left Category Pill */}
          {product.category && (
            <span className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg text-[10.5px] sm:text-[11px] font-medium bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 backdrop-blur-xs border border-slate-200/60 dark:border-slate-700/60 truncate max-w-[150px] shadow-xs">
              {product.category}
            </span>
          )}
        </div>

        {/* Title & Ratings */}
        <div className="p-3.5 sm:p-4 pb-0">
          <h4
            className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
            title={product.name}
          >
            {product.name}
          </h4>

          {/* Rating line */}
          <div className="flex items-center gap-1.5 mt-2">
            <div className="flex items-center text-amber-400">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1 font-mono">
                {(product.rating || 5.0).toFixed(1)}
              </span>
            </div>
            <span className="text-[10.5px] text-slate-400 dark:text-slate-500 font-mono">
              ({product.reviewsCount || product.reviews?.length || 12})
            </span>
          </div>
        </div>
      </div>

      {/* Price & Quick Add Button */}
      <div className="p-3.5 sm:p-4 pt-3 mt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex flex-col">
          {hasDiscount && origPrice && (
            <span className="line-through text-[10.5px] sm:text-xs text-slate-400 dark:text-slate-500 font-mono leading-none mb-0.5">
              {formatPrice(origPrice, currency)}
            </span>
          )}
          <span className="text-sm sm:text-base font-bold text-slate-950 dark:text-white font-mono">
            {formatPrice(product.price, currency)}
          </span>
        </div>

        {isOutOfStock ? (
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200/60 dark:border-slate-700/60 shadow-none whitespace-nowrap"
            title="This item is currently out of stock"
          >
            <ShoppingBag className="w-3.5 h-3.5 opacity-50" />
            <span>Out of Stock</span>
          </button>
        ) : isAdded ? (
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white ring-2 ring-emerald-400/50 animate-pulse shadow-xs whitespace-nowrap"
            title="Added to cart!"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Added</span>
          </button>
        ) : showViewCart && onViewCart ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewCart();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white ring-1 ring-emerald-400/40 shadow-xs cursor-pointer active:scale-95 transition-all whitespace-nowrap"
            title="View item in your cart"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>View Cart &rarr;</span>
          </button>
        ) : hasVariants ? (
          <button
            type="button"
            onClick={handleQuickAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 shadow-xs cursor-pointer active:scale-95 bg-slate-900 hover:bg-indigo-600 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-indigo-400 dark:hover:text-white whitespace-nowrap"
            title="Select options (sizes, colors, etc.)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Select</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleQuickAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 shadow-xs cursor-pointer active:scale-95 bg-slate-900 hover:bg-indigo-600 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-indigo-400 dark:hover:text-white whitespace-nowrap"
            title="Add item to cart"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        )}
      </div>
    </div>
  );
}
