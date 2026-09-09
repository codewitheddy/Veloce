/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Star, ShoppingBag, Check, ShieldCheck, Scale, Award, Info, ArrowRightLeft, Sparkles } from 'lucide-react';
import { Product } from '../types';
import { getProductDiscountInfo } from '../utils/productUtils';
import { CurrencyType, formatPrice } from '../lib/currency';

interface ProductCompareModalProps {
  products: Product[];
  initialLeftProductId?: string;
  initialRightProductId?: string;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, vars: Record<string, string>) => void;
  currency?: CurrencyType;
}

interface ProductSpec {
  dimensions: string;
  weight: string;
  material: string;
  warranty: string;
  origin: string;
  specialFeature: string;
}

// Generates beautiful realistic specifications based on product properties
export function getProductSpecs(product: Product): ProductSpec {
  switch (product.type) {
    case 'physical':
      if (product.id === 'phys-1') {
        return {
          dimensions: '23.8" W x 8.6" D x 4.5" H',
          weight: '4.8 lbs / 2.18 kg',
          material: 'Solid American White Oak & Steel',
          warranty: '5 Years Manufacturer',
          origin: 'Handcrafted in Portland, USA',
          specialFeature: 'Built-in dual magnetic alignment pads'
        };
      }
      if (product.id === 'phys-2') {
        return {
          dimensions: '5.4" Long x 0.45" Diameter',
          weight: '1.48 oz / 42 grams',
          material: 'Solid CZ121 Lead-Free Brass',
          warranty: 'Lifetime Structural',
          origin: 'CNC precision turned in Bristol, UK',
          specialFeature: 'Custom Schmidt fluid refill system'
        };
      }
      return {
        dimensions: '35.4" L x 11.8" W x 0.15" H',
        weight: '1.1 lbs / 0.5 kg',
        material: 'German Merino Wool & Natural Cork',
        warranty: '2 Years Manufacturer',
        origin: 'Sourced from Bavaria, Germany',
        specialFeature: 'Water-resistant felt with cork bottom'
      };
    case 'digital':
      if (product.id === 'dig-1') {
        return {
          dimensions: 'Direct Download (ZIP format)',
          weight: '48.5 MB download size',
          material: 'Figma Components & Vector assets',
          warranty: 'Lifetime Free Updates',
          origin: 'Veloce Digital Cloud Server',
          specialFeature: '140+ premium custom dark-mode SVG icons'
        };
      }
      return {
        dimensions: 'Immediate PDF & EPUB access',
        weight: '15.2 MB digital booklet',
        material: 'High-resolution printable guide sheets',
        warranty: 'Lifetime Access & PDF Copy',
        origin: 'Instant Cloud Delivery',
        specialFeature: 'Includes professional audiobook narration module'
      };
    case 'service':
      if (product.id === 'srv-1') {
        return {
          dimensions: '45-minute Live Interactive session',
          weight: '1-on-1 private video connection',
          material: 'Zoom / Google Meet digital workspace',
          warranty: '100% Satisfaction Guarantee',
          origin: 'Live session consultation',
          specialFeature: 'Review on lighting, posture & custom furniture'
        };
      }
      return {
        dimensions: '3-day Intensive deep sprint',
        weight: 'Collaborative Figma workspace',
        material: 'Live interactive workspace boards',
        warranty: '14 days post-sprint optimization',
        origin: 'Coordinated brand workshop',
        specialFeature: 'Minimal logomark design & typography maps'
      };
    default:
      return {
        dimensions: 'Varies',
        weight: 'Varies',
        material: 'Premium Grade',
        warranty: '1 Year Standard',
        origin: 'Imported',
        specialFeature: 'N/A'
      };
  }
}

export default function ProductCompareModal({
  products,
  initialLeftProductId,
  initialRightProductId,
  onClose,
  onAddToCart,
  currency = 'KSh',
}: ProductCompareModalProps) {
  // Try to default Left product
  const [leftProduct, setLeftProduct] = useState<Product | null>(() => {
    if (initialLeftProductId) {
      return products.find(p => p.id === initialLeftProductId) || products[0] || null;
    }
    return products[0] || null;
  });

  // Try to default Right product (make it different than Left if possible)
  const [rightProduct, setRightProduct] = useState<Product | null>(() => {
    if (initialRightProductId) {
      return products.find(p => p.id === initialRightProductId) || null;
    }
    const leftId = initialLeftProductId || (products[0] ? products[0].id : '');
    const otherProduct = products.find(p => p.id !== leftId);
    return otherProduct || products[1] || null;
  });

  // Keep track of add to cart toast states for each side
  const [addedLeftCart, setAddedLeftCart] = useState(false);
  const [addedRightCart, setAddedRightCart] = useState(false);

  // Active view tab on small screens ("left" | "right" | "side-by-side")
  const [mobileActiveTab, setMobileActiveTab] = useState<'left' | 'right' | 'table'>('table');

  const handleLeftAdd = () => {
    if (!leftProduct) return;
    const initialVars: Record<string, string> = {};
    if (leftProduct.variations) {
      leftProduct.variations.forEach(v => {
        initialVars[v.name] = v.options[0];
      });
    }
    onAddToCart(leftProduct, 1, initialVars);
    setAddedLeftCart(true);
    setTimeout(() => setAddedLeftCart(false), 2000);
  };

  const handleRightAdd = () => {
    if (!rightProduct) return;
    const initialVars: Record<string, string> = {};
    if (rightProduct.variations) {
      rightProduct.variations.forEach(v => {
        initialVars[v.name] = v.options[0];
      });
    }
    onAddToCart(rightProduct, 1, initialVars);
    setAddedRightCart(true);
    setTimeout(() => setAddedRightCart(false), 2000);
  };

  const leftSpecs = leftProduct ? getProductSpecs(leftProduct) : null;
  const rightSpecs = rightProduct ? getProductSpecs(rightProduct) : null;

  // Highlights/Comparisons
  const leftCheaper = leftProduct && rightProduct && leftProduct.price < rightProduct.price;
  const rightCheaper = leftProduct && rightProduct && rightProduct.price < leftProduct.price;
  const pricesEqual = leftProduct && rightProduct && leftProduct.price === rightProduct.price;

  const leftBetterRating = leftProduct && rightProduct && leftProduct.rating > rightProduct.rating;
  const rightBetterRating = leftProduct && rightProduct && rightProduct.rating > leftProduct.rating;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-base text-gray-950">Side-by-Side Product Comparison</h2>
              <p className="text-[10px] text-gray-500 font-mono tracking-tight uppercase">Analyze and compare specifications, pricing, and ratings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-gray-200 transition-colors flex items-center justify-center text-gray-400 hover:text-gray-700 cursor-pointer border border-transparent hover:border-gray-150"
            title="Close comparator"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mobile Selection Tab Control wrapper */}
        <div className="flex md:hidden border-b border-gray-100 bg-gray-50 p-2 gap-1.5 shrink-0">
          <button
            onClick={() => setMobileActiveTab('left')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all border ${
              mobileActiveTab === 'left' ? 'bg-indigo-600 border-indigo-600 text-white shadow-3xs' : 'bg-white border-gray-150 text-gray-600'
            }`}
          >
            {leftProduct ? leftProduct.name.split(' ').slice(1, 3).join(' ') || 'Product A' : 'Select Product A'}
          </button>
          <button
            onClick={() => setMobileActiveTab('table')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all border ${
              mobileActiveTab === 'table' ? 'bg-indigo-600 border-indigo-600 text-white shadow-3xs' : 'bg-white border-gray-150 text-gray-600'
            }`}
          >
            Specs Matrix
          </button>
          <button
            onClick={() => setMobileActiveTab('right')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all border ${
              mobileActiveTab === 'right' ? 'bg-indigo-600 border-indigo-600 text-white shadow-3xs' : 'bg-white border-gray-150 text-gray-600'
            }`}
          >
            {rightProduct ? rightProduct.name.split(' ').slice(1, 3).join(' ') || 'Product B' : 'Select Product B'}
          </button>
        </div>

        {/* Modal Scrollable Workspace */}
        <div className="overflow-y-auto p-4 md:p-6 flex-1 space-y-6">
          
          {/* Pickers Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 pb-4 border-b border-gray-100">
            {/* Left Picker */}
            <div className={`space-y-2 ${(mobileActiveTab !== 'left' && mobileActiveTab !== 'table') ? 'hidden md:block' : ''}`}>
              <label className="block text-[9px] font-mono font-extrabold text-indigo-500 uppercase tracking-widest">Compare Object Left</label>
              <select
                value={leftProduct?.id || ''}
                onChange={(e) => {
                  const found = products.find(p => p.id === e.target.value);
                  if (found) setLeftProduct(found);
                }}
                className="w-full text-xs font-medium rounded-xl border border-indigo-105 bg-indigo-50/5 hover:bg-white px-3.5 py-2.5 text-gray-800 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-3xs"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id} disabled={rightProduct?.id === p.id}>
                    [{p.type.toUpperCase()}] {p.name} — {formatPrice(p.price, currency)}
                  </option>
                ))}
              </select>
            </div>

            {/* Right Picker */}
            <div className={`space-y-2 ${(mobileActiveTab !== 'right' && mobileActiveTab !== 'table') ? 'hidden md:block' : ''}`}>
              <label className="block text-[9px] font-mono font-extrabold text-indigo-500 uppercase tracking-widest">Compare Object Right</label>
              <select
                value={rightProduct?.id || ''}
                onChange={(e) => {
                  const found = products.find(p => p.id === e.target.value);
                  if (found) setRightProduct(found);
                }}
                className="w-full text-xs font-medium rounded-xl border border-indigo-105 bg-indigo-50/5 hover:bg-white px-3.5 py-2.5 text-gray-800 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-3xs"
              >
                <option value="" disabled>-- Select secondary product --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id} disabled={leftProduct?.id === p.id}>
                    [{p.type.toUpperCase()}] {p.name} — {formatPrice(p.price, currency)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cards Split Showcase */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            {/* Left Product Display */}
            {leftProduct && (mobileActiveTab === 'left' || mobileActiveTab === 'table') && (
              <div className="rounded-2xl border border-gray-150 bg-white p-4 relative flex flex-col justify-between">
                <div>
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                    <img
                      src={leftProduct.imageUrl}
                      alt={leftProduct.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute top-2.5 left-2.5 bg-indigo-650 text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded shadow-sm border border-indigo-500 uppercase">
                      {leftProduct.type}
                    </span>
                    {leftCheaper && (
                      <span className="absolute top-2.5 right-2.5 bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-sm border border-emerald-400 uppercase flex items-center gap-1">
                        <Award className="h-3 w-3" /> Best Price
                      </span>
                    )}
                    {(() => {
                      const { hasDiscount, discountPercent } = getProductDiscountInfo(leftProduct);
                      if (!hasDiscount) return null;
                      return (
                        <span className={`absolute ${leftCheaper ? 'bottom-2.5 left-2.5' : 'top-2.5 right-2.5'} bg-rose-600 text-white text-[9px] font-mono font-black px-2 py-0.5 rounded shadow-sm uppercase flex items-center gap-1 z-10`}>
                          <Sparkles className="h-2.5 w-2.5" /> ON SALE -{discountPercent}%
                        </span>
                      );
                    })()}
                  </div>
                  
                  <div className="mt-4">
                    <span className="text-[10px] font-bold tracking-wider text-indigo-500 uppercase font-mono">{leftProduct.category}</span>
                    <h3 className="font-display font-semibold text-base text-gray-900 mt-1 uppercase tracking-tight">{leftProduct.name}</h3>
                    <p className="text-xs text-gray-500 font-light mt-1.5 leading-relaxed line-clamp-3">{leftProduct.description}</p>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  {(() => {
                    const { hasDiscount, originalPrice: originalPriceVal } = getProductDiscountInfo(leftProduct);
                    return (
                      <div className="flex flex-col">
                        {hasDiscount && originalPriceVal && (
                          <span className="font-mono text-xs text-gray-400 line-through">
                            {formatPrice(originalPriceVal, currency)}
                          </span>
                        )}
                        <span className="text-lg font-mono font-bold text-gray-950">{formatPrice(leftProduct.price, currency)}</span>
                      </div>
                    );
                  })()}
                  <button
                    onClick={handleLeftAdd}
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold px-4 py-2.5 text-xs text-white transition-all shadow-3xs cursor-pointer flex items-center justify-center gap-2 hover:scale-102"
                  >
                    {addedLeftCart ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-300" />
                        Added to Basket
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="h-3.5 w-3.5" />
                        Add left item to cart
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Right Product Display */}
            {rightProduct && (mobileActiveTab === 'right' || mobileActiveTab === 'table') && (
              <div className="rounded-2xl border border-gray-150 bg-white p-4 relative flex flex-col justify-between">
                <div>
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                    <img
                      src={rightProduct.imageUrl}
                      alt={rightProduct.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute top-2.5 left-2.5 bg-indigo-650 text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded shadow-sm border border-indigo-500 uppercase">
                      {rightProduct.type}
                    </span>
                    {rightCheaper && (
                      <span className="absolute top-2.5 right-2.5 bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-sm border border-emerald-400 uppercase flex items-center gap-1">
                        <Award className="h-3 w-3" /> Best Price
                      </span>
                    )}
                    {(() => {
                      const { hasDiscount, discountPercent } = getProductDiscountInfo(rightProduct);
                      if (!hasDiscount) return null;
                      return (
                        <span className={`absolute ${rightCheaper ? 'bottom-2.5 left-2.5' : 'top-2.5 right-2.5'} bg-rose-600 text-white text-[9px] font-mono font-black px-2 py-0.5 rounded shadow-sm uppercase flex items-center gap-1 z-10`}>
                          <Sparkles className="h-2.5 w-2.5" /> ON SALE -{discountPercent}%
                        </span>
                      );
                    })()}
                  </div>
                  
                  <div className="mt-4">
                    <span className="text-[10px] font-bold tracking-wider text-indigo-500 uppercase font-mono">{rightProduct.category}</span>
                    <h3 className="font-display font-semibold text-base text-gray-900 mt-1 uppercase tracking-tight">{rightProduct.name}</h3>
                    <p className="text-xs text-gray-500 font-light mt-1.5 leading-relaxed line-clamp-3">{rightProduct.description}</p>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  {(() => {
                    const { hasDiscount, originalPrice: originalPriceVal } = getProductDiscountInfo(rightProduct);
                    return (
                      <div className="flex flex-col">
                        {hasDiscount && originalPriceVal && (
                          <span className="font-mono text-xs text-gray-400 line-through">
                            {formatPrice(originalPriceVal, currency)}
                          </span>
                        )}
                        <span className="text-lg font-mono font-bold text-gray-950">{formatPrice(rightProduct.price, currency)}</span>
                      </div>
                    );
                  })()}
                  <button
                    onClick={handleRightAdd}
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold px-4 py-2.5 text-xs text-white transition-all shadow-3xs cursor-pointer flex items-center justify-center gap-2 hover:scale-102"
                  >
                    {addedRightCart ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-300" />
                        Added to Basket
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="h-3.5 w-3.5" />
                        Add right item to cart
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Matrix Specifications List - Shows on Desktop or mobile specs tab */}
          {leftProduct && rightProduct && (mobileActiveTab === 'table') && (
            <div className="rounded-2xl border border-gray-150 bg-white overflow-hidden shadow-3xs">
              <div className="bg-gray-50/70 p-3.5 border-b border-gray-150 flex items-center gap-1.5">
                <Scale className="h-4 w-4 text-indigo-500" />
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">Detailed specs matrix</span>
              </div>
              
              <div className="divide-y divide-gray-100 text-xs text-gray-700">
                
                {/* Sale Price block */}
                <div className="grid grid-cols-12 md:gap-4 p-4 items-center">
                  <div className="col-span-12 md:col-span-4 font-bold text-gray-500 uppercase text-[9px] font-mono">Retail Price</div>
                  <div className="col-span-6 md:col-span-4 mt-1 md:mt-0">
                    <span className={`font-mono font-bold text-sm ${leftCheaper ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {formatPrice(leftProduct.price, currency)}
                    </span>
                    {leftCheaper && <span className="ml-1.5 text-[9px] font-mono text-emerald-600 bg-emerald-50 px-1 py-0.1 rounded font-bold uppercase">Better value</span>}
                    {pricesEqual && <span className="ml-1.5 text-[9px] font-mono text-gray-500 bg-gray-50 px-1 py-0.1 rounded font-semibold uppercase">Tie</span>}
                  </div>
                  <div className="col-span-6 md:col-span-4 mt-1 md:mt-0 text-right md:text-left">
                    <span className={`font-mono font-bold text-sm ${rightCheaper ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {formatPrice(rightProduct.price, currency)}
                    </span>
                    {rightCheaper && <span className="ml-1.5 text-[9px] font-mono text-emerald-600 bg-emerald-50 px-1 py-0.1 rounded font-bold uppercase">Better value</span>}
                    {pricesEqual && <span className="ml-1.5 text-[9px] font-mono text-gray-500 bg-gray-50 px-1 py-0.1 rounded font-semibold uppercase">Tie</span>}
                  </div>
                </div>

                {/* Rating block */}
                <div className="grid grid-cols-12 md:gap-4 p-4 items-center">
                  <div className="col-span-12 md:col-span-4 font-bold text-gray-500 uppercase text-[9px] font-mono">Customer Rating</div>
                  <div className="col-span-6 md:col-span-4 mt-1 md:mt-0 flex items-center gap-1.5">
                    <div className="flex items-center text-amber-500">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="font-bold ml-1">{leftProduct.rating.toFixed(2)}</span>
                    </div>
                    <span className="text-gray-400 font-mono text-[10px]">({leftProduct.reviewsCount} reviews)</span>
                    {leftBetterRating && <span className="text-[8px] bg-amber-50 border border-amber-200 text-amber-800 rounded px-1.5 py-0.1 font-bold uppercase ml-1 block sm:inline-block">Top Choice</span>}
                  </div>
                  <div className="col-span-6 md:col-span-4 mt-1 md:mt-0 text-right md:text-left flex items-center justify-end md:justify-start gap-1.5">
                    <div className="flex items-center text-amber-500">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="font-bold ml-1">{rightProduct.rating.toFixed(2)}</span>
                    </div>
                    <span className="text-gray-400 font-mono text-[10px]">({rightProduct.reviewsCount} reviews)</span>
                    {rightBetterRating && <span className="text-[8px] bg-amber-50 border border-amber-200 text-amber-800 rounded px-1.5 py-0.1 font-bold uppercase ml-1 block sm:inline-block">Top Choice</span>}
                  </div>
                </div>

                {/* Dimension & scale */}
                <div className="grid grid-cols-12 md:gap-4 p-4 items-center">
                  <div className="col-span-12 md:col-span-4 font-bold text-gray-500 uppercase text-[9px] font-mono">Scale / Dimensions</div>
                  <div className="col-span-6 md:col-span-4 mt-1 md:mt-0 text-gray-850 font-medium">
                    {leftSpecs?.dimensions}
                  </div>
                  <div className="col-span-6 md:col-span-4 mt-1 md:mt-0 text-right md:text-left text-gray-850 font-medium font-medium">
                    {rightSpecs?.dimensions}
                  </div>
                </div>

                {/* Weight / file size */}
                <div className="grid grid-cols-12 md:gap-4 p-4 items-center">
                  <div className="col-span-12 md:col-span-4 font-bold text-gray-500 uppercase text-[9px] font-mono">Weight / Payload size</div>
                  <div className="col-span-6 md:col-span-4 mt-1 md:mt-0 text-gray-800">
                    {leftSpecs?.weight}
                  </div>
                  <div className="col-span-6 md:col-span-4 mt-1 md:mt-0 text-right md:text-left text-gray-800">
                    {rightSpecs?.weight}
                  </div>
                </div>

                {/* Core materials */}
                <div className="grid grid-cols-12 md:gap-4 p-4 items-center">
                  <div className="col-span-12 md:col-span-4 font-bold text-gray-500 uppercase text-[9px] font-mono">Core Construction / Materials</div>
                  <div className="col-span-6 md:col-span-4 mt-1 md:mt-0 text-gray-800">
                    {leftSpecs?.material}
                  </div>
                  <div className="col-span-6 md:col-span-4 mt-1 md:mt-0 text-right md:text-left text-gray-800">
                    {rightSpecs?.material}
                  </div>
                </div>

                {/* Crafting origin */}
                <div className="grid grid-cols-12 md:gap-4 p-4 items-center">
                  <div className="col-span-12 md:col-span-4 font-bold text-gray-500 uppercase text-[9px] font-mono">Region of Manufacture</div>
                  <div className="col-span-6 md:col-span-4 mt-1 md:mt-0 text-gray-850">
                    {leftSpecs?.origin}
                  </div>
                  <div className="col-span-6 md:col-span-4 mt-1 md:mt-0 text-right md:text-left text-gray-850">
                    {rightSpecs?.origin}
                  </div>
                </div>

                {/* Guarantee range */}
                <div className="grid grid-cols-12 md:gap-4 p-4 items-center">
                  <div className="col-span-12 md:col-span-4 font-bold text-gray-500 uppercase text-[9px] font-mono">Guarantee / Warranty</div>
                  <div className="col-span-6 md:col-span-4 mt-1 md:mt-0 text-gray-800 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    <span>{leftSpecs?.warranty}</span>
                  </div>
                  <div className="col-span-6 md:col-span-4 mt-1 md:mt-0 text-right md:text-left text-gray-800 flex items-center justify-end md:justify-start gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    <span>{rightSpecs?.warranty}</span>
                  </div>
                </div>

                {/* Key feature */}
                <div className="grid grid-cols-12 md:gap-4 p-4 items-center">
                  <div className="col-span-12 md:col-span-4 font-bold text-gray-500 uppercase text-[9px] font-mono">Distinctive Highlight</div>
                  <div className="col-span-6 md:col-span-4 mt-1 md:mt-0 text-gray-900 font-semibold italic bg-indigo-50/20 p-2 rounded">
                    {leftSpecs?.specialFeature}
                  </div>
                  <div className="col-span-6 md:col-span-4 mt-1 md:mt-0 text-right md:text-left text-gray-900 font-semibold italic bg-indigo-50/20 p-2 rounded">
                    {rightSpecs?.specialFeature}
                  </div>
                </div>

                {/* Stock availability */}
                <div className="grid grid-cols-12 md:gap-4 p-4 items-center">
                  <div className="col-span-12 md:col-span-4 font-bold text-gray-500 uppercase text-[9px] font-mono">Fulfillment Status</div>
                  <div className="col-span-6 md:col-span-4 mt-1 md:mt-0">
                    {leftProduct.type === 'physical' ? (
                      leftProduct.stock === 0 ? (
                        <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-mono font-bold text-[10px]">Sold Out</span>
                      ) : (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono font-bold text-[10px]">Ready (Qty {leftProduct.stock})</span>
                      )
                    ) : (
                      <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-mono font-bold text-[10px]">Instant Access</span>
                    )}
                  </div>
                  <div className="col-span-6 md:col-span-4 mt-1 md:mt-0 text-right md:text-left">
                    {rightProduct.type === 'physical' ? (
                      rightProduct.stock === 0 ? (
                        <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-mono font-bold text-[10px]">Sold Out</span>
                      ) : (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono font-bold text-[10px]">Ready (Qty {rightProduct.stock})</span>
                      )
                    ) : (
                      <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-mono font-bold text-[10px]">Instant Access</span>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Modal Footer helper */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1 font-sans">
            <Info className="h-4 w-4 text-indigo-500" />
            Pricing are list prices and exclude seasonal promo coupons.
          </span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-gray-905 text-white bg-indigo-900 hover:bg-black font-semibold shadow-xs cursor-pointer text-center"
          >
            Confirm & Exit Comparator
          </button>
        </div>

      </div>
    </div>
  );
}
