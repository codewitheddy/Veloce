/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import {
  X,
  Sliders,
  Sparkles,
  Percent,
  TrendingUp,
  TrendingDown,
  Search,
  Check,
  CheckCircle2,
  AlertTriangle,
  Layers,
  DollarSign,
  Package,
  ArrowRight
} from 'lucide-react';

interface BulkPriceAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  availableCategories: string[];
  onUpdateProductPrice: (id: string, newPrice: number, previousPrice?: number | null) => void;
}

export default function BulkPriceAdjustmentModal({
  isOpen,
  onClose,
  products,
  availableCategories,
  onUpdateProductPrice
}: BulkPriceAdjustmentModalProps) {
  if (!isOpen) return null;

  // --- STATE ---
  // Categories selected for filtering products
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  // Individual products selected for price adjustment
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  // Adjustment calculation mode: percentage-based or flat currency fixed amount
  const [adjustmentType, setAdjustmentType] = useState<'percentage' | 'fixed'>('percentage');
  // Adjustment action type
  const [adjustmentAction, setAdjustmentAction] = useState<'increase' | 'decrease'>('decrease');
  // Amount (percentage rate or fixed amount in KSh)
  const [adjustmentPercent, setAdjustmentPercent] = useState<number>(10);
  // Round to nearest whole number
  const [roundingPrecision, setRoundingPrecision] = useState<boolean>(true);
  // Product Search Query within selected categories
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Success notification message
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Get products filtered by selected categories (or all if none selected)
  const filteredProducts = useMemo(() => {
    let list = products;
    
    // If we have selected categories, filter by them
    if (selectedCategories.length > 0) {
      list = list.filter((p) => p.category && selectedCategories.includes(p.category));
    }

    // Search query filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q))
      );
    }

    return list;
  }, [products, selectedCategories, searchQuery]);

  // Handle toggling a category
  const handleToggleCategory = (category: string) => {
    setSelectedCategories((prev) => {
      const exists = prev.includes(category);
      let nextCategories: string[];
      if (exists) {
        nextCategories = prev.filter((c) => c !== category);
      } else {
        nextCategories = [...prev, category];
      }

      // Automatically select/deselect all products in the category list
      setTimeout(() => {
        const prodInCats = products.filter(
          (p) => p.category && nextCategories.includes(p.category)
        ).map((p) => p.id);
        
        setSelectedProductIds(prodInCats);
      }, 0);

      return nextCategories;
    });
  };

  // Select all products currently visible in filtered list
  const handleSelectAllFiltered = () => {
    const visibleIds = filteredProducts.map((p) => p.id);
    setSelectedProductIds((prev) => {
      // Union of existing selections and visible filtered products
      const newSelection = Array.from(new Set([...prev, ...visibleIds]));
      return newSelection;
    });
  };

  // Deselect all products currently visible in filtered list
  const handleDeselectAllFiltered = () => {
    const visibleIds = filteredProducts.map((p) => p.id);
    setSelectedProductIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
  };

  // Toggle individual product selection
  const handleToggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Dynamic preview mapping for selected products
  const previewAdjustments = useMemo(() => {
    return selectedProductIds
      .map((id) => {
        const prod = products.find((p) => p.id === id);
        if (!prod) return null;

        let newPrice = prod.price;
        if (adjustmentType === 'percentage') {
          const factor =
            adjustmentAction === 'increase'
              ? 1 + adjustmentPercent / 100
              : 1 - adjustmentPercent / 100;
          newPrice = prod.price * factor;
        } else {
          // Fixed amount adjustment
          newPrice =
            adjustmentAction === 'increase'
              ? prod.price + adjustmentPercent
              : prod.price - adjustmentPercent;
        }

        if (roundingPrecision) {
          newPrice = Math.round(newPrice);
        }
        newPrice = Math.max(1, newPrice); // Price cannot fall below 1 KSh
        const diff = newPrice - prod.price;

        return {
          product: prod,
          oldPrice: prod.price,
          newPrice,
          diff
        };
      })
      .filter(Boolean) as { product: Product; oldPrice: number; newPrice: number; diff: number }[];
  }, [selectedProductIds, products, adjustmentAction, adjustmentPercent, adjustmentType, roundingPrecision]);

  // Apply changes to products
  const handleApplyChanges = () => {
    if (selectedProductIds.length === 0) {
      alert('Please select at least one product to apply price changes.');
      return;
    }

    if (adjustmentPercent <= 0 || isNaN(adjustmentPercent)) {
      alert('Please provide a valid value greater than 0.');
      return;
    }

    // Execute bulk update
    previewAdjustments.forEach((item) => {
      // If we decreased the price, we set previousPrice to the old price (which triggers the "On Sale" display)
      const prevPrice = item.diff < 0 ? item.oldPrice : null;
      onUpdateProductPrice(item.product.id, item.newPrice, prevPrice);
    });

    const formatStr = adjustmentType === 'percentage' ? `${adjustmentPercent}%` : `KSh ${adjustmentPercent.toLocaleString('en-KE')}`;
    const actionStr = adjustmentAction === 'increase' ? 'increased (markup)' : 'decreased (discounted)';
    setSuccessMsg(
      `🎉 Successfully ${actionStr} prices for ${selectedProductIds.length} products by ${formatStr}!`
    );

    setTimeout(() => {
      setSuccessMsg('');
      onClose();
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 font-sans overflow-y-auto">
      <div className="relative bg-white dark:bg-gray-950 rounded-2xl border border-gray-150 dark:border-gray-850 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col my-8">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-850 p-5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider">
                Bulk Catalog Price Adjustment
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Apply master percentage discounts or markup premium pricing rules by Category.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Bulk Price Adjustment Modal"
            className="p-1.5 rounded-lg text-gray-450 hover:bg-gray-50 dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-white transition cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
          
          {/* Left Column: Category Filtering & Product Selection (Span 7) */}
          <div className="lg:col-span-7 flex flex-col gap-4 min-h-0">
            
            {/* Category Filter Box */}
            <div className="border border-gray-100 dark:border-gray-850 rounded-xl p-4 bg-gray-50/40 dark:bg-gray-900/10">
              <span className="block text-[10px] font-black font-mono text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5">
                1. Select Categories ({selectedCategories.length} Active)
              </span>
              <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto pr-1">
                {availableCategories.map((cat) => {
                  const isChecked = selectedCategories.includes(cat);
                  const countInCat = products.filter((p) => p.category === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleToggleCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isChecked
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-905'
                          : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      <span>{cat}</span>
                      <span className={`text-[9px] font-mono font-black px-1.5 py-0.2 rounded-full ${isChecked ? 'bg-indigo-150 text-indigo-800' : 'bg-gray-100 text-gray-400'}`}>
                        {countInCat}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Product List Box */}
            <div className="border border-gray-150 dark:border-gray-850 rounded-xl p-4 flex-1 flex flex-col min-h-[250px]">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-850 pb-2 mb-3 shrink-0">
                <span className="text-[10px] font-black font-mono text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  2. Select Products ({selectedProductIds.length} Checked)
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="text-[10px] font-bold text-indigo-650 hover:text-indigo-800 cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={handleDeselectAllFiltered}
                    className="text-[10px] font-bold text-gray-500 hover:text-gray-750 cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Product Search Query Input */}
              <div className="relative shrink-0 mb-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter products inside selection by name or SKU..."
                  className="w-full h-8 pl-8 pr-7 text-xs rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-550"
                />
                <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-gray-400" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2 text-gray-400 hover:text-gray-650 focus:outline-hidden cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Scrollable checklist of items */}
              <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-900 pr-1 max-h-[220px]">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-8 flex flex-col items-center justify-center gap-2">
                    <Package className="h-8 w-8 text-gray-300" />
                    <p className="text-xs font-semibold text-gray-400">No products match filters</p>
                    <p className="text-[10px] text-gray-400 max-w-[200px]">
                      Select categories above or clear the search criteria to find matching store SKUs.
                    </p>
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const isChecked = selectedProductIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className="py-2.5 flex items-center justify-between hover:bg-slate-50/55 dark:hover:bg-slate-900/10 px-2 rounded-lg cursor-pointer transition select-none"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleProduct(p.id)}
                            className="rounded border-gray-350 dark:border-gray-800 text-indigo-600 focus:ring-indigo-550 h-4 w-4 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <span className="font-semibold text-xs text-gray-900 dark:text-gray-150 block truncate max-w-[260px]">{p.name}</span>
                            <span className="text-[10px] font-mono text-gray-400 block mt-0.5">
                              SKU: {p.sku || 'N/A'} • <span className="italic">{p.category || 'No Category'}</span>
                            </span>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-xs text-gray-800 dark:text-gray-300 shrink-0">
                          KSh {p.price.toLocaleString('en-KE')}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Configuration & Live Preview (Span 5) */}
          <div className="lg:col-span-5 flex flex-col gap-4 min-h-0">
                    {/* Control Params Form Box */}
            <div className="border border-gray-150 dark:border-gray-850 rounded-xl p-4 bg-white dark:bg-gray-900">
              <span className="block text-[10px] font-black font-mono text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                3. Adjustment Parameters
              </span>
              
              <div className="flex flex-col gap-4">
                {/* Rule Type Selector */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Adjustment Type</span>
                  <div className="grid grid-cols-2 gap-2 p-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-750 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustmentType('percentage');
                        setAdjustmentPercent(10);
                      }}
                      className={`py-1.5 text-xs font-bold rounded-md transition cursor-pointer flex items-center justify-center gap-1 ${
                        adjustmentType === 'percentage'
                          ? 'bg-white dark:bg-gray-950 text-indigo-750 dark:text-indigo-400 shadow-3xs'
                          : 'text-gray-400 hover:text-gray-750'
                      }`}
                    >
                      Percentage (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustmentType('fixed');
                        setAdjustmentPercent(500);
                      }}
                      className={`py-1.5 text-xs font-bold rounded-md transition cursor-pointer flex items-center justify-center gap-1 ${
                        adjustmentType === 'fixed'
                          ? 'bg-white dark:bg-gray-950 text-indigo-750 dark:text-indigo-400 shadow-3xs'
                          : 'text-gray-400 hover:text-gray-750'
                      }`}
                    >
                      Fixed Amount (KSh)
                    </button>
                  </div>
                </div>

                {/* Rule type selector */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Adjustment Direction</span>
                  <div className="grid grid-cols-2 gap-2 p-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-750 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setAdjustmentAction('decrease')}
                      className={`py-1.5 text-xs font-bold rounded-md transition cursor-pointer flex items-center justify-center gap-1 ${
                        adjustmentAction === 'decrease'
                          ? 'bg-white dark:bg-gray-950 text-rose-700 dark:text-rose-450 shadow-3xs'
                          : 'text-gray-400 hover:text-gray-750'
                      }`}
                    >
                      <TrendingDown className="h-3.5 w-3.5" /> Discount
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustmentAction('increase')}
                      className={`py-1.5 text-xs font-bold rounded-md transition cursor-pointer flex items-center justify-center gap-1 ${
                        adjustmentAction === 'increase'
                          ? 'bg-white dark:bg-gray-950 text-emerald-750 dark:text-emerald-450 shadow-3xs'
                          : 'text-gray-400 hover:text-gray-750'
                      }`}
                    >
                      <TrendingUp className="h-3.5 w-3.5" /> Markup
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Adjustment rate */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Amount</span>
                    <div className="flex items-center gap-1.5">
                      <div className="relative shrink-0">
                        <input
                          type="number"
                          min={1}
                          max={adjustmentType === 'percentage' ? 100 : undefined}
                          value={adjustmentPercent}
                          onChange={(e) => setAdjustmentPercent(Math.max(1, adjustmentType === 'percentage' ? Math.min(100, Number(e.target.value)) : Number(e.target.value)))}
                          className={`${adjustmentType === 'percentage' ? 'w-16' : 'w-24'} h-8.5 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 pr-5 text-center font-mono text-xs font-bold rounded-lg focus:ring-1 focus:ring-indigo-500 text-gray-850 dark:text-white`}
                        />
                        <span className="absolute right-1.5 top-2 text-[10px] text-gray-400 font-bold font-mono">
                          {adjustmentType === 'percentage' ? '%' : 'KSh'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 border border-gray-150 dark:border-gray-800 rounded-lg p-1 bg-gray-50/50 dark:bg-gray-900/30">
                        {adjustmentType === 'percentage' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustmentAction('increase');
                                setAdjustmentPercent(5);
                              }}
                              className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-white dark:bg-gray-950 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-800 dark:text-emerald-450 border border-gray-150 dark:border-gray-850 transition cursor-pointer"
                              title="Set to +5% Markup"
                            >
                              +5%
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustmentAction('increase');
                                setAdjustmentPercent(10);
                              }}
                              className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-white dark:bg-gray-950 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-800 dark:text-emerald-450 border border-gray-150 dark:border-gray-850 transition cursor-pointer"
                              title="Set to +10% Markup"
                            >
                              +10%
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustmentAction('decrease');
                                setAdjustmentPercent(5);
                              }}
                              className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-white dark:bg-gray-950 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-800 dark:text-rose-450 border border-gray-150 dark:border-gray-850 transition cursor-pointer"
                              title="Set to -5% Discount"
                            >
                              -5%
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustmentAction('decrease');
                                setAdjustmentPercent(10);
                              }}
                              className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-white dark:bg-gray-950 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-800 dark:text-rose-450 border border-gray-150 dark:border-gray-850 transition cursor-pointer"
                              title="Set to -10% Discount"
                            >
                              -10%
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustmentAction('increase');
                                setAdjustmentPercent(100);
                              }}
                              className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-white dark:bg-gray-950 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-800 dark:text-emerald-450 border border-gray-150 dark:border-gray-850 transition cursor-pointer"
                              title="Set to +100 KSh Markup"
                            >
                              +100
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustmentAction('increase');
                                setAdjustmentPercent(500);
                              }}
                              className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-white dark:bg-gray-950 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-800 dark:text-emerald-450 border border-gray-150 dark:border-gray-850 transition cursor-pointer"
                              title="Set to +500 KSh Markup"
                            >
                              +500
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustmentAction('decrease');
                                setAdjustmentPercent(100);
                              }}
                              className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-white dark:bg-gray-950 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-800 dark:text-rose-450 border border-gray-150 dark:border-gray-850 transition cursor-pointer"
                              title="Set to -100 KSh Discount"
                            >
                              -100
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustmentAction('decrease');
                                setAdjustmentPercent(500);
                              }}
                              className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-white dark:bg-gray-950 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-800 dark:text-rose-450 border border-gray-150 dark:border-gray-850 transition cursor-pointer"
                              title="Set to -500 KSh Discount"
                            >
                              -500
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rounding Checkbox */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Precision</span>
                    <label className="flex items-center gap-1.5 h-8.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={roundingPrecision}
                        onChange={(e) => setRoundingPrecision(e.target.checked)}
                        className="rounded border-gray-350 text-indigo-600 focus:ring-indigo-550 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span className="text-[10.5px] font-semibold text-gray-600 dark:text-gray-400">Round to integer</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Preview List Box */}
            <div className="border border-gray-150 dark:border-gray-850 rounded-xl p-4 flex-1 flex flex-col min-h-[220px]">
              <span className="block text-[10px] font-black font-mono text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5 shrink-0">
                4. Live Adjustment Preview ({selectedProductIds.length} Items)
              </span>

              <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-900 pr-1">
                {previewAdjustments.length === 0 ? (
                  <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
                    <Sparkles className="h-6 w-6 text-gray-300" />
                    <p className="text-[11px] font-semibold text-gray-400">No adjustments to preview</p>
                    <p className="text-[9.5px] text-gray-400 max-w-[170px]">
                      Select at least one product on the left to review price transformations.
                    </p>
                  </div>
                ) : (
                  previewAdjustments.map(({ product, oldPrice, newPrice, diff }) => (
                    <div key={product.id} className="py-2 flex justify-between items-center text-[11px]">
                      <div className="min-w-0 pr-4">
                        <span className="font-bold text-gray-800 dark:text-gray-200 block truncate max-w-[150px]">{product.name}</span>
                        <span className="text-[9px] font-mono text-gray-450 block">Original: KSh {oldPrice.toLocaleString('en-KE')}</span>
                      </div>
                      
                      <div className="font-mono flex items-center gap-1.5 shrink-0">
                        <span className="text-gray-900 dark:text-gray-100 font-bold">KSh {newPrice.toLocaleString('en-KE')}</span>
                        <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-md ${diff >= 0 ? 'bg-emerald-50 text-emerald-850 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-rose-50 text-rose-850 dark:bg-rose-950/30 dark:text-rose-450'}`}>
                          {diff >= 0 ? '+' : ''}
                          {adjustmentType === 'percentage' ? `${adjustmentPercent}%` : `KSh ${adjustmentPercent.toLocaleString('en-KE')}`}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Modal Success Message Banner */}
        {successMsg && (
          <div className="mx-5 mb-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-150 dark:border-emerald-900/30 text-emerald-850 dark:text-emerald-400 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-pulse">
            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="border-t border-gray-100 dark:border-gray-850 p-5 flex items-center justify-between shrink-0">
          <div className="text-[10px] text-gray-450 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <span>This updates live customer catalog database ledger instantly.</span>
          </div>
          
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-250 bg-white hover:bg-gray-55 text-gray-750 text-xs font-semibold cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyChanges}
              disabled={selectedProductIds.length === 0}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs cursor-pointer transition flex items-center gap-1.5"
            >
              <Check className="h-4 w-4" /> Apply Price Adjustments ({selectedProductIds.length})
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
