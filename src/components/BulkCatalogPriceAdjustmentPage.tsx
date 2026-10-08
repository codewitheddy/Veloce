/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Percent,
  TrendingDown,
  TrendingUp,
  Sliders,
  Sparkles,
  Search,
  Check,
  CheckCircle2,
  ArrowLeft,
  RotateCcw,
  Download,
  Filter,
  DollarSign,
  Package,
  ShieldCheck,
  Clock,
  History,
  Tag,
  CheckSquare,
  Square,
  AlertCircle,
  FileSpreadsheet,
  Lock,
  Unlock,
  RefreshCw,
  Zap,
  ChevronRight,
  Layers
} from 'lucide-react';
import { Product } from '../types';
import { productsApi } from '../api/products';

export interface BulkPriceAdjustmentHistoryEntry {
  id: string;
  timestamp: string;
  ruleDescription: string;
  affectedCount: number;
  categories: string[];
  adjustmentType: 'percentage' | 'fixed' | 'target_margin' | 'flat_price';
  adjustmentAction: 'increase' | 'decrease' | 'target' | 'set';
  adjustmentValue: number;
  netValuationDelta: number;
  previousPriceMap: Record<string, { price: number; previousPrice?: number | null }>;
}

interface BulkCatalogPriceAdjustmentPageProps {
  products: Product[];
  availableCategories: string[];
  onUpdateProductPrice: (id: string, newPrice: number, previousPrice?: number | null) => void;
  onNavigateBack?: () => void;
  onBulkUpdateProducts?: (updatedProducts: Product[]) => void;
}

export default function BulkCatalogPriceAdjustmentPage({
  products,
  availableCategories,
  onUpdateProductPrice,
  onNavigateBack,
  onBulkUpdateProducts
}: BulkCatalogPriceAdjustmentPageProps) {
  // Main view toggle: live preview vs rollback history
  const [activeView, setActiveView] = useState<'preview' | 'history'>('preview');

  // Selected categories (empty = all)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  // Selected product IDs
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  // Excluded/Locked product IDs
  const [lockedProductIds, setLockedProductIds] = useState<string[]>([]);

  // Adjustment rule settings
  const [adjustmentType, setAdjustmentType] = useState<'percentage' | 'fixed' | 'flat_price'>('percentage');
  const [adjustmentAction, setAdjustmentAction] = useState<'decrease' | 'increase'>('decrease');
  const [adjustmentValue, setAdjustmentValue] = useState<number>(15);

  // Rounding Strategy
  const [roundingStrategy, setRoundingStrategy] = useState<
    'exact' | 'integer' | 'nearest_10' | 'nearest_50' | 'nearest_100' | 'psychological_99' | 'psychological_990'
  >('integer');

  // Safety guardrails
  const [enforceCostFloor, setEnforceCostFloor] = useState<boolean>(true);
  const [minPriceFloor, setMinPriceFloor] = useState<number>(50);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;

  // Processing & Confirmation States
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // History State
  const [historyList, setHistoryList] = useState<BulkPriceAdjustmentHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('veloce_bulk_price_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const saveHistory = (entries: BulkPriceAdjustmentHistoryEntry[]) => {
    setHistoryList(entries);
    try {
      localStorage.setItem('veloce_bulk_price_history', JSON.stringify(entries.slice(0, 30)));
    } catch {}
  };

  const safeProducts = useMemo(() => products || [], [products]);

  // Derived unique categories
  const allCategories = useMemo(() => {
    const set = new Set<string>(availableCategories || []);
    safeProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [safeProducts, availableCategories]);

  // Initialize all products as selected by default
  useEffect(() => {
    if (selectedProductIds.length === 0 && safeProducts.length > 0) {
      setSelectedProductIds(safeProducts.map((p) => p.id));
    }
  }, [safeProducts.length]);

  // Category selection handler
  const handleToggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      const exists = prev.includes(cat);
      const next = exists ? prev.filter((c) => c !== cat) : [...prev, cat];
      return next;
    });
  };

  const handleSelectAllCategories = () => {
    setSelectedCategories([]);
  };

  // Filter products by selected categories, stock, and search query
  const filteredProducts = useMemo(() => {
    let list = safeProducts;

    // Filter by categories if specific ones are selected
    if (selectedCategories.length > 0) {
      list = list.filter((p) => p.category && selectedCategories.includes(p.category));
    }

    // Filter by stock
    if (stockFilter === 'in_stock') {
      list = list.filter((p) => p.stock === null || p.stock > 0);
    } else if (stockFilter === 'low_stock') {
      list = list.filter((p) => p.stock !== null && p.stock > 0 && p.stock <= (p.lowStockThreshold || 5));
    } else if (stockFilter === 'out_of_stock') {
      list = list.filter((p) => p.stock !== null && p.stock <= 0);
    }

    // Search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
      );
    }

    return list;
  }, [safeProducts, selectedCategories, stockFilter, searchQuery]);

  // Rounding computation
  const applyRounding = (val: number): number => {
    switch (roundingStrategy) {
      case 'exact':
        return Math.round(val * 100) / 100;
      case 'integer':
        return Math.round(val);
      case 'nearest_10':
        return Math.round(val / 10) * 10;
      case 'nearest_50':
        return Math.round(val / 50) * 50;
      case 'nearest_100':
        return Math.round(val / 100) * 100;
      case 'psychological_99': {
        const hundredFloor = Math.floor(val / 100) * 100;
        return Math.max(99, hundredFloor + 99);
      }
      case 'psychological_990': {
        const thousandFloor = Math.floor(val / 1000) * 1000;
        return Math.max(990, thousandFloor + 990);
      }
      default:
        return Math.round(val);
    }
  };

  // Preview calculations for all filtered products
  const previewItems = useMemo(() => {
    return filteredProducts.map((prod) => {
      const isSelected = selectedProductIds.includes(prod.id);
      const isLocked = lockedProductIds.includes(prod.id);
      const originalPrice = prod.price || 0;
      const costPrice = prod.costPrice || Math.round(originalPrice * 0.55);

      let calculatedPrice = originalPrice;
      let isCappedByCost = false;

      if (isLocked) {
        calculatedPrice = originalPrice;
      } else if (adjustmentType === 'percentage') {
        const factor = adjustmentAction === 'increase' ? 1 + adjustmentValue / 100 : 1 - adjustmentValue / 100;
        calculatedPrice = originalPrice * factor;
      } else if (adjustmentType === 'fixed') {
        calculatedPrice = adjustmentAction === 'increase' ? originalPrice + adjustmentValue : originalPrice - adjustmentValue;
      } else if (adjustmentType === 'flat_price') {
        calculatedPrice = adjustmentValue;
      }

      calculatedPrice = applyRounding(calculatedPrice);

      // Apply guardrails
      if (enforceCostFloor && calculatedPrice < costPrice) {
        calculatedPrice = costPrice;
        isCappedByCost = true;
      }

      if (calculatedPrice < minPriceFloor) {
        calculatedPrice = minPriceFloor;
      }

      const diff = calculatedPrice - originalPrice;
      const percentChange = originalPrice > 0 ? (diff / originalPrice) * 100 : 0;
      const projectedMargin = calculatedPrice > 0 ? ((calculatedPrice - costPrice) / calculatedPrice) * 100 : 0;

      return {
        product: prod,
        isSelected,
        isLocked,
        originalPrice,
        costPrice,
        calculatedPrice,
        diff,
        percentChange,
        projectedMargin,
        isCappedByCost,
      };
    });
  }, [
    filteredProducts,
    selectedProductIds,
    lockedProductIds,
    adjustmentType,
    adjustmentAction,
    adjustmentValue,
    roundingStrategy,
    enforceCostFloor,
    minPriceFloor,
  ]);

  // Aggregate Metrics
  const aggregateMetrics = useMemo(() => {
    const activePreview = previewItems.filter((i) => i.isSelected && !i.isLocked);
    const count = activePreview.length;

    let currentValuation = 0;
    let projectedValuation = 0;
    let totalOriginalPrice = 0;
    let totalCalculatedPrice = 0;

    activePreview.forEach((item) => {
      const stockQty = item.product.stock !== null && item.product.stock > 0 ? item.product.stock : 1;
      currentValuation += item.originalPrice * stockQty;
      projectedValuation += item.calculatedPrice * stockQty;
      totalOriginalPrice += item.originalPrice;
      totalCalculatedPrice += item.calculatedPrice;
    });

    const netValuationDelta = projectedValuation - currentValuation;
    const valuationPercentChange = currentValuation > 0 ? (netValuationDelta / currentValuation) * 100 : 0;
    const avgOriginalPrice = count > 0 ? totalOriginalPrice / count : 0;
    const avgCalculatedPrice = count > 0 ? totalCalculatedPrice / count : 0;

    return {
      count,
      currentValuation,
      projectedValuation,
      netValuationDelta,
      valuationPercentChange,
      avgOriginalPrice,
      avgCalculatedPrice,
    };
  }, [previewItems]);

  // Paginated Preview Items
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return previewItems.slice(start, start + pageSize);
  }, [previewItems, page]);

  const totalPages = Math.ceil(previewItems.length / pageSize) || 1;

  // Toggle selection
  const handleToggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleSelectAllVisible = () => {
    const allFilteredIds = filteredProducts.map((p) => p.id);
    const allSelected = allFilteredIds.every((id) => selectedProductIds.includes(id));
    if (allSelected) {
      setSelectedProductIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedProductIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleToggleLockProduct = (id: string) => {
    setLockedProductIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  // Execute Price Adjustment
  const handleExecutePriceAdjustment = async () => {
    const selectedItems = previewItems.filter((i) => i.isSelected && !i.isLocked);
    if (selectedItems.length === 0) {
      setErrorMsg('No active products are selected for price adjustment.');
      return;
    }

    setIsApplying(true);
    setErrorMsg('');
    setSuccessMsg('');
    setShowConfirmModal(false);

    try {
      const updatePayload: Array<{ id: string; price: number; original_price?: number | null }> = [];
      const updatedProductsList: Product[] = [];
      const previousPriceMap: Record<string, { price: number; previousPrice?: number | null }> = {};

      selectedItems.forEach((item) => {
        const prevPrice = item.product.price !== item.calculatedPrice ? item.originalPrice : item.product.previousPrice || null;

        previousPriceMap[item.product.id] = {
          price: item.originalPrice,
          previousPrice: item.product.previousPrice || null,
        };

        updatePayload.push({
          id: item.product.id,
          price: item.calculatedPrice,
          original_price: prevPrice,
        });

        onUpdateProductPrice(item.product.id, item.calculatedPrice, prevPrice);

        updatedProductsList.push({
          ...item.product,
          price: item.calculatedPrice,
          previousPrice: prevPrice !== null ? prevPrice : item.product.previousPrice,
          originalPrice: item.originalPrice,
        });
      });

      // Synchronize with backend
      try {
        await productsApi.bulkPriceAdjustment(updatePayload);
      } catch (backendErr) {
        console.warn('Backend bulk sync note:', backendErr);
      }

      if (onBulkUpdateProducts) {
        onBulkUpdateProducts(updatedProductsList);
      }

      try {
        window.dispatchEvent(new CustomEvent('veloce_products_updated', { detail: updatedProductsList }));
      } catch {}

      // Save History Entry
      const ruleDesc =
        adjustmentType === 'percentage'
          ? `${adjustmentAction === 'decrease' ? 'Discounted' : 'Marked up'} by ${adjustmentValue}%`
          : adjustmentType === 'fixed'
          ? `${adjustmentAction === 'decrease' ? 'Reduced' : 'Increased'} by KSh ${adjustmentValue.toLocaleString('en-KE')}`
          : `Set flat price to KSh ${adjustmentValue.toLocaleString('en-KE')}`;

      const historyEntry: BulkPriceAdjustmentHistoryEntry = {
        id: 'batch-' + Date.now(),
        timestamp: new Date().toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }),
        ruleDescription: `${ruleDesc} on ${selectedItems.length} products`,
        affectedCount: selectedItems.length,
        categories: selectedCategories.length > 0 ? [...selectedCategories] : ['All Categories'],
        adjustmentType,
        adjustmentAction,
        adjustmentValue,
        netValuationDelta: aggregateMetrics.netValuationDelta,
        previousPriceMap,
      };

      saveHistory([historyEntry, ...historyList]);

      setSuccessMsg(`🎉 Successfully updated prices for ${selectedItems.length} products!`);
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      setErrorMsg(`Failed to apply bulk price changes: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsApplying(false);
    }
  };

  // Rollback a previous batch
  const handleRollbackBatch = async (entry: BulkPriceAdjustmentHistoryEntry) => {
    if (!window.confirm(`Are you sure you want to revert batch "${entry.ruleDescription}"? This will restore original prices for ${entry.affectedCount} products.`)) {
      return;
    }

    try {
      const rollbackPayload: Array<{ id: string; price: number; original_price?: number | null }> = [];
      const restoredProductsList: Product[] = [];

      Object.entries(entry.previousPriceMap).forEach(([id, snap]) => {
        const originalPrice = typeof snap === 'number' ? snap : snap.price;
        const originalPrevPrice = typeof snap === 'object' && snap.previousPrice !== undefined ? snap.previousPrice : null;

        onUpdateProductPrice(id, originalPrice, originalPrevPrice);
        rollbackPayload.push({
          id,
          price: originalPrice,
          original_price: originalPrevPrice,
        });

        const existing = safeProducts.find((p) => p.id === id);
        if (existing) {
          restoredProductsList.push({
            ...existing,
            price: originalPrice,
            previousPrice: originalPrevPrice || undefined,
          });
        }
      });

      try {
        await productsApi.bulkPriceAdjustment(rollbackPayload);
      } catch (backendErr) {
        console.warn('Backend rollback note:', backendErr);
      }

      if (onBulkUpdateProducts && restoredProductsList.length > 0) {
        onBulkUpdateProducts(restoredProductsList);
      }

      try {
        window.dispatchEvent(new CustomEvent('veloce_products_updated', { detail: restoredProductsList }));
      } catch {}

      const updatedHistory = historyList.filter((h) => h.id !== entry.id);
      saveHistory(updatedHistory);

      setSuccessMsg(`✅ Successfully reverted batch! Restored previous prices for ${entry.affectedCount} products.`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(`Failed to revert batch: ${err?.message || 'Unknown error'}`);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const rows = [
      ['SKU', 'Product Name', 'Category', 'Stock', 'Cost Price (KSh)', 'Current Price (KSh)', 'New Price (KSh)', 'Difference (KSh)', 'Change (%)', 'New Margin (%)', 'Selected']
    ];

    previewItems.forEach((item) => {
      rows.push([
        `"${item.product.sku || ''}"`,
        `"${item.product.name.replace(/"/g, '""')}"`,
        `"${item.product.category || ''}"`,
        `"${item.product.stock !== null ? item.product.stock : 'Unlimited'}"`,
        `"${item.costPrice}"`,
        `"${item.originalPrice}"`,
        `"${item.calculatedPrice}"`,
        `"${item.diff}"`,
        `"${item.percentChange.toFixed(1)}%"`,
        `"${item.projectedMargin.toFixed(1)}%"`,
        `"${item.isSelected ? 'YES' : 'NO'}"`
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bulk_price_adjustment_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-[#f8faff] dark:bg-slate-950 min-h-screen font-sans text-slate-900 dark:text-slate-100 pb-20 w-full animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onNavigateBack && (
              <button
                type="button"
                onClick={onNavigateBack}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title="Back to Catalog"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900 flex items-center gap-1">
                  <Zap className="h-2.5 w-2.5" /> STUDIO
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {safeProducts.length} Catalog Items
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-950 dark:text-white tracking-tight flex items-center gap-2">
                <Percent className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Bulk Catalog Price Adjustment Studio
              </h1>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {/* View Switcher: Live Preview vs History */}
            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 p-1 bg-slate-100 dark:bg-slate-800/80">
              <button
                type="button"
                onClick={() => setActiveView('preview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeView === 'preview'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Live Matrix ({previewItems.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveView('history')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeView === 'history'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <History className="h-3.5 w-3.5" />
                Rollback History ({historyList.length})
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
              title="Export simulation to CSV"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>

            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={isApplying || aggregateMetrics.count === 0}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Applying Changes...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Apply Price Rules ({aggregateMetrics.count} Items)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="mx-4 sm:mx-6 lg:px-8 mt-4 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mx-4 sm:mx-6 lg:px-8 mt-4 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="w-full px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8">
        {activeView === 'preview' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN: Rule Control Deck (4 cols on lg) */}
            <div className="lg:col-span-4 space-y-5">
              
              {/* Card 1: Target Categories */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                      1. Target Scope
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAllCategories}
                    className={`text-[11px] font-bold transition-colors cursor-pointer ${
                      selectedCategories.length === 0
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {selectedCategories.length === 0 ? '✓ All Selected' : 'Reset to All'}
                  </button>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Select specific categories to adjust or leave as All Catalog items.
                </p>

                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={handleSelectAllCategories}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
                      selectedCategories.length === 0
                        ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    All Categories ({safeProducts.length})
                  </button>
                  {allCategories.map((cat) => {
                    const isSelected = selectedCategories.includes(cat);
                    const count = safeProducts.filter((p) => p.category === cat).length;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleToggleCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-2xs'
                            : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {cat} <span className="opacity-70 text-[10px]">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card 2: Price Adjustment Rule */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                    2. Adjustment Strategy
                  </h3>
                </div>

                {/* Mode Selector */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setAdjustmentAction('decrease')}
                    className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      adjustmentAction === 'decrease'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <TrendingDown className="w-3.5 h-3.5" />
                    Discount (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentAction('increase')}
                    className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      adjustmentAction === 'increase'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    Markup (+)
                  </button>
                </div>

                {/* Calculation Unit Type */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase font-mono mb-1.5">
                    Adjustment Unit
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAdjustmentType('percentage')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                        adjustmentType === 'percentage'
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      % Percentage
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustmentType('fixed')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                        adjustmentType === 'fixed'
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      KSh Amount
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustmentType('flat_price')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                        adjustmentType === 'flat_price'
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Set Exact
                    </button>
                  </div>
                </div>

                {/* Value Input */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase font-mono mb-1.5">
                    {adjustmentType === 'percentage' ? 'Percentage Rate (%)' : adjustmentType === 'fixed' ? 'Fixed Currency Amount (KSh)' : 'Target Exact Price (KSh)'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={adjustmentValue}
                      onChange={(e) => setAdjustmentValue(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full h-11 px-3.5 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base font-bold focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                      {adjustmentType === 'percentage' ? '%' : 'KSh'}
                    </span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                    Quick Presets
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {adjustmentType === 'percentage' ? (
                      <>
                        {[5, 10, 15, 20, 25, 30, 50].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setAdjustmentValue(val)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                              adjustmentValue === val
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {val}%
                          </button>
                        ))}
                      </>
                    ) : (
                      <>
                        {[50, 100, 200, 500, 1000, 2500].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setAdjustmentValue(val)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                              adjustmentValue === val
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {val.toLocaleString()}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* Rounding Strategy */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase font-mono mb-1.5">
                    Price Rounding Strategy
                  </label>
                  <select
                    value={roundingStrategy}
                    onChange={(e: any) => setRoundingStrategy(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:border-indigo-600 focus:outline-none"
                  >
                    <option value="integer">Whole Integer (e.g. 1,450)</option>
                    <option value="nearest_10">Nearest 10 (e.g. 1,450)</option>
                    <option value="nearest_50">Nearest 50 (e.g. 1,450)</option>
                    <option value="nearest_100">Nearest 100 (e.g. 1,500)</option>
                    <option value="psychological_99">Psychological ending in .99 (e.g. 1,499)</option>
                    <option value="psychological_990">Psychological ending in .990 (e.g. 4,990)</option>
                    <option value="exact">Exact (Two decimal places)</option>
                  </select>
                </div>

                {/* Guardrails Check */}
                <div className="pt-2 border-t border-slate-150 dark:border-slate-800 space-y-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={enforceCostFloor}
                      onChange={(e) => setEnforceCostFloor(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      Cost Floor Protection (Never sell below cost)
                    </span>
                  </label>
                </div>

                {/* Apply Button in Side Deck */}
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={isApplying || aggregateMetrics.count === 0}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer mt-3"
                >
                  <Check className="w-4 h-4" />
                  Apply To {aggregateMetrics.count} Products
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: Live Impact Strip & Product Matrix (8 cols on lg) */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Financial Impact KPIs Bar - Perfectly Equal Sizing & Spacing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                
                {/* Card 1: Target Products */}
                <div className="h-full min-h-[142px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
                  <div className="h-9 flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase font-mono tracking-wider">
                      Targeted Items
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="my-auto py-0.5">
                    <div className="text-2xl font-bold font-mono text-slate-950 dark:text-white flex items-baseline gap-1.5 leading-tight">
                      <span>{aggregateMetrics.count}</span>
                      <span className="text-xs text-slate-400 font-normal">/ {safeProducts.length}</span>
                    </div>
                  </div>
                  <div className="h-6 flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span>{Math.round((aggregateMetrics.count / (safeProducts.length || 1)) * 100)}% of catalog</span>
                  </div>
                </div>

                {/* Card 2: Current Catalog Valuation */}
                <div className="h-full min-h-[142px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
                  <div className="h-9 flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase font-mono tracking-wider">
                      Current Value
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0">
                      <DollarSign className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="my-auto py-0.5">
                    <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white leading-tight">
                      KSh {Math.round(aggregateMetrics.currentValuation).toLocaleString('en-KE')}
                    </div>
                  </div>
                  <div className="h-6 flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                    Avg. KSh {Math.round(aggregateMetrics.avgOriginalPrice).toLocaleString('en-KE')} / item
                  </div>
                </div>

                {/* Card 3: Projected Catalog Valuation */}
                <div className="h-full min-h-[142px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
                  <div className="h-9 flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase font-mono tracking-wider">
                      Projected Value
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="my-auto py-0.5">
                    <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400 leading-tight">
                      KSh {Math.round(aggregateMetrics.projectedValuation).toLocaleString('en-KE')}
                    </div>
                  </div>
                  <div className="h-6 flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                    Avg. KSh {Math.round(aggregateMetrics.avgCalculatedPrice).toLocaleString('en-KE')} / item
                  </div>
                </div>

                {/* Card 4: Net Valuation Delta */}
                <div className="h-full min-h-[142px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
                  <div className="h-9 flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase font-mono tracking-wider">
                      Net Price Shift
                    </span>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      aggregateMetrics.netValuationDelta >= 0
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/40'
                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/40'
                    }`}>
                      {aggregateMetrics.netValuationDelta >= 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                  <div className="my-auto py-0.5">
                    <div className={`text-2xl font-bold font-mono leading-tight flex items-baseline gap-1 ${
                      aggregateMetrics.netValuationDelta >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      <span>{aggregateMetrics.netValuationDelta >= 0 ? '+' : ''}</span>
                      <span>KSh {Math.round(Math.abs(aggregateMetrics.netValuationDelta)).toLocaleString('en-KE')}</span>
                    </div>
                  </div>
                  <div className="h-6 flex items-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${
                      aggregateMetrics.valuationPercentChange >= 0
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                    }`}>
                      {aggregateMetrics.valuationPercentChange >= 0 ? '+' : ''}
                      {aggregateMetrics.valuationPercentChange.toFixed(1)}% shift
                    </span>
                  </div>
                </div>

              </div>

              {/* Product Matrix Container */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
                
                {/* Search & Action Bar */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Filter by product name, SKU, or category..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setPage(1);
                        }}
                        className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <select
                      value={stockFilter}
                      onChange={(e: any) => {
                        setStockFilter(e.target.value);
                        setPage(1);
                      }}
                      className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none"
                    >
                      <option value="all">All Stock Status</option>
                      <option value="in_stock">In Stock Only</option>
                      <option value="low_stock">Low Stock Only</option>
                      <option value="out_of_stock">Out of Stock Only</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleSelectAllVisible}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    >
                      Toggle All Visible ({filteredProducts.length})
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      <tr>
                        <th className="py-3 px-4 w-10 text-center">
                          <span className="sr-only">Select</span>
                        </th>
                        <th className="py-3 px-4">Product Details</th>
                        <th className="py-3 px-4 text-right">Cost Price</th>
                        <th className="py-3 px-4 text-right">Current Price</th>
                        <th className="py-3 px-4 text-right">New Price</th>
                        <th className="py-3 px-4 text-right">Delta</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 dark:divide-slate-800">
                      {paginatedItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            No products match your active search &amp; category filters.
                          </td>
                        </tr>
                      ) : (
                        paginatedItems.map((item) => (
                          <tr
                            key={item.product.id}
                            className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                              item.isLocked ? 'opacity-50 bg-slate-50/40 dark:bg-slate-900/40' : !item.isSelected ? 'opacity-40' : ''
                            }`}
                          >
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleSelectProduct(item.product.id)}
                                className="text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                              >
                                {item.isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </td>

                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                {item.product.images?.[0] ? (
                                  <img
                                    src={item.product.images[0]}
                                    alt={item.product.name}
                                    className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 font-bold text-[10px]">
                                    IMG
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 dark:text-white truncate max-w-[220px] sm:max-w-xs">
                                    {item.product.name}
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                    <span>{item.product.category || 'Uncategorized'}</span>
                                    {item.product.sku && (
                                      <>
                                        <span>•</span>
                                        <span className="font-mono">{item.product.sku}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4 text-right font-mono text-slate-500">
                              KSh {item.costPrice.toLocaleString()}
                            </td>

                            <td className="py-3 px-4 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                              KSh {item.originalPrice.toLocaleString()}
                            </td>

                            <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              KSh {item.calculatedPrice.toLocaleString()}
                            </td>

                            <td className="py-3 px-4 text-right font-mono font-bold">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] ${
                                  item.diff > 0
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                                    : item.diff < 0
                                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}
                              >
                                {item.diff > 0 ? '+' : ''}
                                {item.diff.toLocaleString()} ({item.percentChange.toFixed(0)}%)
                              </span>
                            </td>

                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleLockProduct(item.product.id)}
                                title={item.isLocked ? 'Unlock product' : 'Lock/exempt product from changes'}
                                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                  item.isLocked
                                    ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 border-amber-200 dark:border-amber-800'
                                    : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {item.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                    <div>
                      Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, previewItems.length)} of {previewItems.length} items
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      >
                        Previous
                      </button>
                      <span className="px-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {page} / {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        ) : (
          /* ROLLBACK & HISTORY VIEW */
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Bulk Price Adjustment History &amp; 1-Click Rollback
                  </h2>
                  <p className="text-xs text-slate-500">
                    Review past batch executions and safely restore previous prices if needed.
                  </p>
                </div>
              </div>
            </div>

            {historyList.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">No Previous Batches</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  When you execute bulk price updates, previous prices are saved here with instant rollback capabilities.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-150 dark:divide-slate-800">
                {historyList.map((entry) => (
                  <div key={entry.id} className="py-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {entry.ruleDescription}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900 font-mono text-[10px] font-bold">
                          {entry.affectedCount} Products
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-3">
                        <span>{entry.timestamp}</span>
                        <span>•</span>
                        <span>Scope: {entry.categories.join(', ')}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRollbackBatch(entry)}
                      className="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Rollback This Batch
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Percent className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Apply Price Updates?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                You are about to update prices for <strong className="text-slate-900 dark:text-white">{aggregateMetrics.count} active products</strong>. 
                Original prices will be archived for 1-click rollback.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Adjustment Action:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">
                  {adjustmentAction === 'decrease' ? 'Discount (-)' : 'Markup (+)'} ({adjustmentValue}{adjustmentType === 'percentage' ? '%' : ' KSh'})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Net Valuation Impact:</span>
                <span className={`font-mono font-bold ${aggregateMetrics.netValuationDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {aggregateMetrics.netValuationDelta >= 0 ? '+' : ''}KSh {Math.round(aggregateMetrics.netValuationDelta).toLocaleString('en-KE')}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePriceAdjustment}
                className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-xs transition cursor-pointer"
              >
                Confirm &amp; Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
