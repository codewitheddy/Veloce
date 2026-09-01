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
  AlertTriangle,
  Layers,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  RotateCcw,
  Download,
  Filter,
  DollarSign,
  Package,
  Eye,
  ShieldAlert,
  Info,
  Clock,
  History,
  Tag,
  CheckSquare,
  Square,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FolderTree,
  X
} from 'lucide-react';
import { Product } from '../types';

export interface BulkPriceAdjustmentHistoryEntry {
  id: string;
  timestamp: string;
  ruleDescription: string;
  affectedCount: number;
  categories: string[];
  adjustmentType: 'percentage' | 'fixed';
  adjustmentAction: 'increase' | 'decrease';
  adjustmentValue: number;
  previousPriceMap: Record<string, number>;
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
  // --- STATE ---
  // Categories selected for price adjustment
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  // Individual products selected for price adjustment (IDs)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  // Adjustment calculation mode: percentage-based or flat currency fixed amount
  const [adjustmentType, setAdjustmentType] = useState<'percentage' | 'fixed'>('percentage');
  // Adjustment action: discount (decrease) or markup (increase)
  const [adjustmentAction, setAdjustmentAction] = useState<'increase' | 'decrease'>('decrease');
  // Amount (percentage rate e.g. 15 for 15% or fixed amount in KSh)
  const [adjustmentValue, setAdjustmentValue] = useState<number>(15);
  // Rounding Strategy
  const [roundingStrategy, setRoundingStrategy] = useState<'exact' | 'integer' | 'nearest_10' | 'nearest_50' | 'nearest_100' | 'psychological_99' | 'psychological_990'>('integer');
  // Safety Guardrails
  const [enforceCostFloor, setEnforceCostFloor] = useState<boolean>(true);
  const [minPriceFloor, setMinPriceFloor] = useState<number>(100);
  const [maxDiscountCap, setMaxDiscountCap] = useState<number>(80);
  // Target field: base price or sale price
  const [targetField, setTargetField] = useState<'price' | 'salePrice'>('price');
  // Product Type Filter
  const [typeFilter, setTypeFilter] = useState<'all' | 'physical' | 'digital' | 'service'>('all');
  // Stock Status Filter
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  // Table Search Query
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Feedback Messages
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isApplying, setIsApplying] = useState<boolean>(false);

  // Rollback / Batch History
  const [historyList, setHistoryList] = useState<BulkPriceAdjustmentHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('veloce_bulk_price_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // fallback
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState<'adjuster' | 'history'>('adjuster');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState<boolean>(false);
  const [categoryDropdownSearch, setCategoryDropdownSearch] = useState<string>('');
  const categoryDropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync history to localStorage
  const saveHistory = (entries: BulkPriceAdjustmentHistoryEntry[]) => {
    setHistoryList(entries);
    try {
      localStorage.setItem('veloce_bulk_price_history', JSON.stringify(entries.slice(0, 30)));
    } catch {
      // ignore
    }
  };

  const safeProducts = useMemo(() => products || [], [products]);

  // Derive unique categories from products & available categories
  const allCategories = useMemo(() => {
    const set = new Set<string>(availableCategories || []);
    safeProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [safeProducts, availableCategories]);

  // Count products per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allCategories.forEach((cat) => {
      counts[cat] = safeProducts.filter((p) => p.category === cat).length;
    });
    return counts;
  }, [allCategories, safeProducts]);

  // Initialize: default to all categories or empty
  useEffect(() => {
    // If no category is selected, select all by default so user sees catalog immediately
    if (selectedCategories.length === 0 && allCategories.length > 0) {
      setSelectedCategories(allCategories);
      setSelectedProductIds(safeProducts.map((p) => p.id));
    }
  }, [allCategories.length, safeProducts.length]);

  // Handle toggling an individual category
  const handleToggleCategory = (category: string) => {
    setSelectedCategories((prev) => {
      const exists = prev.includes(category);
      const nextCategories = exists ? prev.filter((c) => c !== category) : [...prev, category];

      // Auto-update selected products based on next categories
      const prodsInCategories = safeProducts
        .filter((p) => p.category && nextCategories.includes(p.category))
        .map((p) => p.id);
      setSelectedProductIds(prodsInCategories);

      return nextCategories;
    });
  };

  // Select all categories
  const handleSelectAllCategories = () => {
    setSelectedCategories(allCategories);
    setSelectedProductIds(safeProducts.map((p) => p.id));
  };

  // Deselect all categories
  const handleClearCategories = () => {
    setSelectedCategories([]);
    setSelectedProductIds([]);
  };

  // Filter products based on selected categories, types, stock, and search query
  const filteredProducts = useMemo(() => {
    let list = safeProducts;

    // Filter by selected categories
    if (selectedCategories.length > 0) {
      list = list.filter((p) => p.category && selectedCategories.includes(p.category));
    } else {
      return [];
    }

    // Filter by product type
    if (typeFilter !== 'all') {
      list = list.filter((p) => p.type === typeFilter);
    }

    // Filter by stock status
    if (stockFilter === 'in_stock') {
      list = list.filter((p) => p.stock === null || p.stock > 0);
    } else if (stockFilter === 'low_stock') {
      list = list.filter((p) => p.stock !== null && p.stock > 0 && p.stock <= (p.lowStockThreshold || 5));
    } else if (stockFilter === 'out_of_stock') {
      list = list.filter((p) => p.stock !== null && p.stock <= 0);
    }

    // Search query filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q))
      );
    }

    return list;
  }, [products, selectedCategories, typeFilter, stockFilter, searchQuery]);

  // Rounding helper
  const applyRounding = (val: number, strategy: typeof roundingStrategy): number => {
    switch (strategy) {
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
        // e.g. 1450 -> 1499, 1420 -> 1399
        const hundredFloor = Math.floor(val / 100) * 100;
        return Math.max(99, hundredFloor + 99);
      }
      case 'psychological_990': {
        // e.g. 14500 -> 14990
        const thousandFloor = Math.floor(val / 1000) * 1000;
        return Math.max(990, thousandFloor + 990);
      }
      default:
        return Math.round(val);
    }
  };

  // Dynamic preview computation for each product
  const previewItems = useMemo(() => {
    return filteredProducts.map((prod) => {
      const isSelected = selectedProductIds.includes(prod.id);
      const originalPrice = prod.price || 0;
      const costPrice = prod.costPrice || Math.round(originalPrice * 0.55); // estimated 55% cost if not set

      let calculatedPrice = originalPrice;
      if (adjustmentType === 'percentage') {
        const factor =
          adjustmentAction === 'increase'
            ? 1 + adjustmentValue / 100
            : 1 - adjustmentValue / 100;
        calculatedPrice = originalPrice * factor;
      } else {
        calculatedPrice =
          adjustmentAction === 'increase'
            ? originalPrice + adjustmentValue
            : originalPrice - adjustmentValue;
      }

      // Apply rounding
      calculatedPrice = applyRounding(calculatedPrice, roundingStrategy);

      // Apply guardrails
      if (enforceCostFloor && calculatedPrice < costPrice) {
        calculatedPrice = costPrice;
      }
      if (calculatedPrice < minPriceFloor) {
        calculatedPrice = minPriceFloor;
      }

      // Max discount guardrail
      if (adjustmentAction === 'decrease') {
        const maxDiscountMultiplier = 1 - maxDiscountCap / 100;
        const lowestAllowed = Math.round(originalPrice * maxDiscountMultiplier);
        if (calculatedPrice < lowestAllowed) {
          calculatedPrice = lowestAllowed;
        }
      }

      const diff = calculatedPrice - originalPrice;
      const percentChange = originalPrice > 0 ? ((calculatedPrice - originalPrice) / originalPrice) * 100 : 0;
      const originalMargin = originalPrice > 0 ? ((originalPrice - costPrice) / originalPrice) * 100 : 0;
      const projectedMargin = calculatedPrice > 0 ? ((calculatedPrice - costPrice) / calculatedPrice) * 100 : 0;

      return {
        product: prod,
        isSelected,
        originalPrice,
        costPrice,
        calculatedPrice,
        diff,
        percentChange,
        originalMargin,
        projectedMargin
      };
    });
  }, [
    filteredProducts,
    selectedProductIds,
    adjustmentType,
    adjustmentAction,
    adjustmentValue,
    roundingStrategy,
    enforceCostFloor,
    minPriceFloor,
    maxDiscountCap
  ]);

  // Aggregate Metrics Summary
  const aggregateMetrics = useMemo(() => {
    const activeSelectedPreviews = previewItems.filter((item) => item.isSelected);
    const count = activeSelectedPreviews.length;
    const currentValuation = activeSelectedPreviews.reduce((sum, item) => sum + item.originalPrice, 0);
    const projectedValuation = activeSelectedPreviews.reduce((sum, item) => sum + item.calculatedPrice, 0);
    const netValuationDelta = projectedValuation - currentValuation;
    const avgOriginalMargin =
      count > 0
        ? activeSelectedPreviews.reduce((sum, item) => sum + item.originalMargin, 0) / count
        : 0;
    const avgProjectedMargin =
      count > 0
        ? activeSelectedPreviews.reduce((sum, item) => sum + item.projectedMargin, 0) / count
        : 0;

    return {
      count,
      currentValuation,
      projectedValuation,
      netValuationDelta,
      avgOriginalMargin,
      avgProjectedMargin
    };
  }, [previewItems]);

  // Toggle selection for all visible in filtered list
  const handleSelectAllFiltered = () => {
    const visibleIds = filteredProducts.map((p) => p.id);
    setSelectedProductIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const handleDeselectAllFiltered = () => {
    const visibleIds = new Set(filteredProducts.map((p) => p.id));
    setSelectedProductIds((prev) => prev.filter((id) => !visibleIds.has(id)));
  };

  const handleToggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Quick Preset Handlers
  const handleApplyPreset = (action: 'increase' | 'decrease', percent: number) => {
    setAdjustmentType('percentage');
    setAdjustmentAction(action);
    setAdjustmentValue(percent);
  };

  // Apply Changes to Catalog
  const handleExecutePriceAdjustment = async () => {
    const selectedItems = previewItems.filter((item) => item.isSelected);

    if (selectedItems.length === 0) {
      setErrorMsg('Please select at least one product to apply price changes.');
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    if (adjustmentValue <= 0 || isNaN(adjustmentValue)) {
      setErrorMsg('Please enter a valid price adjustment value greater than 0.');
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    setIsApplying(true);
    setErrorMsg('');

    try {
      // 1. Snapshot previous prices for rollback
      const previousPriceMap: Record<string, number> = {};
      const updatedProductsList: Product[] = [];

      selectedItems.forEach((item) => {
        previousPriceMap[item.product.id] = item.originalPrice;

        // If discounted, store original as previousPrice to trigger discount/sale badges on storefront
        const prevPrice = item.diff < 0 ? item.originalPrice : null;
        onUpdateProductPrice(item.product.id, item.calculatedPrice, prevPrice);

        updatedProductsList.push({
          ...item.product,
          price: item.calculatedPrice,
          previousPrice: prevPrice !== null ? prevPrice : item.product.previousPrice,
          originalPrice: item.originalPrice
        });
      });

      // 2. If bulk update handler is provided, invoke it
      if (onBulkUpdateProducts) {
        onBulkUpdateProducts(updatedProductsList);
      }

      // 3. Record in audit history
      const historyEntry: BulkPriceAdjustmentHistoryEntry = {
        id: 'batch-' + Date.now(),
        timestamp: new Date().toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }),
        ruleDescription: `${adjustmentAction === 'decrease' ? 'Discounted' : 'Marked up'} by ${
          adjustmentType === 'percentage' ? `${adjustmentValue}%` : `KSh ${adjustmentValue.toLocaleString('en-KE')}`
        } across ${selectedCategories.join(', ')}`,
        affectedCount: selectedItems.length,
        categories: [...selectedCategories],
        adjustmentType,
        adjustmentAction,
        adjustmentValue,
        previousPriceMap
      };

      const newHistory = [historyEntry, ...historyList];
      saveHistory(newHistory);

      const actionText = adjustmentAction === 'increase' ? 'marked up (price increase)' : 'discounted (price reduction)';
      const valueText = adjustmentType === 'percentage' ? `${adjustmentValue}%` : `KSh ${adjustmentValue.toLocaleString('en-KE')}`;
      setSuccessMsg(`🎉 Successfully ${actionText} prices for ${selectedItems.length} products by ${valueText}! Catalog updated.`);
      
      setTimeout(() => {
        setSuccessMsg('');
      }, 6000);
    } catch (err: any) {
      setErrorMsg(`Failed to apply bulk price changes: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsApplying(false);
    }
  };

  // Rollback a batch
  const handleRollbackBatch = (entry: BulkPriceAdjustmentHistoryEntry) => {
    if (
      !window.confirm(
        `Are you sure you want to revert batch "${entry.ruleDescription}"? This will restore original prices for ${entry.affectedCount} products.`
      )
    ) {
      return;
    }

    let restoredCount = 0;
    Object.entries(entry.previousPriceMap).forEach(([id, originalPrice]) => {
      onUpdateProductPrice(id, originalPrice, null);
      restoredCount++;
    });

    // Remove from history
    const updatedHistory = historyList.filter((h) => h.id !== entry.id);
    saveHistory(updatedHistory);

    setSuccessMsg(`✅ Successfully reverted batch! Restored previous prices for ${restoredCount} products.`);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  // Export current simulation to CSV
  const handleExportCSV = () => {
    const rows = [
      ['SKU', 'Product Name', 'Category', 'Stock', 'Original Price (KSh)', 'New Price (KSh)', 'Delta (KSh)', 'Change %', 'Selected']
    ];

    previewItems.forEach((item) => {
      rows.push([
        `"${item.product.sku || ''}"`,
        `"${item.product.name.replace(/"/g, '""')}"`,
        `"${item.product.category || ''}"`,
        `"${item.product.stock !== null ? item.product.stock : 'Unlimited'}"`,
        `"${item.originalPrice}"`,
        `"${item.calculatedPrice}"`,
        `"${item.diff}"`,
        `"${item.percentChange.toFixed(1)}%"`,
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
    <div className="bg-[#f8faff] dark:bg-gray-950 min-h-screen font-sans text-gray-900 dark:text-gray-100 pb-16 w-full">
      {/* Top Breadcrumb & Action Bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30 shadow-2xs w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onNavigateBack && (
              <button
                type="button"
                onClick={onNavigateBack}
                className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
                title="Return to inventory"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  CATALOG PRICING ENGINE
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {products.length} catalog items
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                <Percent className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Bulk Catalog Price Adjustment Studio
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 p-1 bg-gray-50 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setActiveTab('adjuster')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'adjuster'
                    ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                Price Rule Engine
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                <History className="h-3.5 w-3.5" />
                Audit & Rollback ({historyList.length})
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              title="Export computed simulation to CSV"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>

            <button
              type="button"
              onClick={handleExecutePriceAdjustment}
              disabled={isApplying || aggregateMetrics.count === 0}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Applying...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Apply Price Rules to {aggregateMetrics.count} Items
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 mt-6 space-y-6">
        {/* Success / Error Notification Banners */}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs sm:text-sm font-semibold">{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg('')}
              className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="text-xs sm:text-sm font-semibold">{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg('')}
              className="text-xs font-bold text-rose-700 dark:text-rose-300 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Real-time KPI Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xs">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
              Affected Products
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono text-gray-900 dark:text-white">
                {aggregateMetrics.count}
              </span>
              <span className="text-xs font-mono text-gray-400">/ {products.length}</span>
            </div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 block truncate">
              {selectedCategories.length} categories targeted
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xs">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
              Current Catalog Value
            </span>
            <div className="mt-1 text-2xl font-black font-mono text-gray-900 dark:text-white truncate">
              KSh {aggregateMetrics.currentValuation.toLocaleString('en-KE')}
            </div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 block">
              Baseline retail valuation
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xs">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
              Projected New Value
            </span>
            <div className="mt-1 text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 truncate">
              KSh {aggregateMetrics.projectedValuation.toLocaleString('en-KE')}
            </div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 block">
              After master adjustments
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xs">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
              Net Value Delta
            </span>
            <div
              className={`mt-1 text-2xl font-black font-mono truncate flex items-center gap-1 ${
                aggregateMetrics.netValuationDelta < 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : aggregateMetrics.netValuationDelta > 0
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {aggregateMetrics.netValuationDelta < 0 ? (
                <TrendingDown className="h-5 w-5" />
              ) : aggregateMetrics.netValuationDelta > 0 ? (
                <TrendingUp className="h-5 w-5" />
              ) : null}
              {aggregateMetrics.netValuationDelta < 0 ? '-' : '+'}KSh{' '}
              {Math.abs(aggregateMetrics.netValuationDelta).toLocaleString('en-KE')}
            </div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 block truncate">
              {adjustmentAction === 'decrease' ? 'Discount impact' : 'Markup impact'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xs">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
              Avg Gross Margin
            </span>
            <div className="mt-1 text-2xl font-black font-mono text-gray-900 dark:text-white">
              {aggregateMetrics.avgProjectedMargin.toFixed(1)}%
            </div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 block">
              Baseline was {aggregateMetrics.avgOriginalMargin.toFixed(1)}%
            </span>
          </div>
        </div>

        {activeTab === 'adjuster' ? (
          <div className="space-y-6">
            {/* STEP 1: CATEGORY SCOPE (FULL WIDTH) */}
            <div className="w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-2xs space-y-3 relative z-30" ref={categoryDropdownRef}>
              <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold items-center justify-center">
                    1
                  </span>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider">
                    Target Categories
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectAllCategories}
                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={handleClearCategories}
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-semibold cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Dropdown Menu Trigger Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-gray-800/80 hover:bg-slate-100/80 dark:hover:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 transition-all cursor-pointer shadow-3xs"
                  id="btn-category-dropdown-toggle"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FolderTree className="h-4 w-4 text-indigo-500 shrink-0" />
                    <span className="truncate">
                      {selectedCategories.length === 0
                        ? 'Select Target Categories...'
                        : selectedCategories.length === allCategories.length
                        ? `All Categories (${allCategories.length} selected)`
                        : `${selectedCategories.length} of ${allCategories.length} Categories Selected`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[10.5px] font-mono font-bold">
                      {selectedCategories.length}/{allCategories.length}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isCategoryDropdownOpen ? 'rotate-180 text-indigo-600' : ''}`} />
                  </div>
                </button>

                {/* Dropdown Popover Panel */}
                {isCategoryDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl shadow-xl p-3 animate-in fade-in zoom-in-95 duration-150">
                    {/* Search Bar */}
                    <div className="relative mb-2.5">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search categories..."
                        value={categoryDropdownSearch}
                        onChange={(e) => setCategoryDropdownSearch(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 bg-slate-50 dark:bg-gray-800/60 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                      />
                      {categoryDropdownSearch && (
                        <button
                          type="button"
                          onClick={() => setCategoryDropdownSearch('')}
                          className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Dropdown List */}
                    <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-tab-scroll">
                      {allCategories
                        .filter((category) =>
                          !categoryDropdownSearch ||
                          category.toLowerCase().includes(categoryDropdownSearch.toLowerCase().trim())
                        )
                        .map((category) => {
                          const isSelected = selectedCategories.includes(category);
                          const count = categoryCounts[category] || 0;
                          return (
                            <button
                              key={category}
                              type="button"
                              onClick={() => handleToggleCategory(category)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                                isSelected
                                  ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200 font-bold border-l-2 border-indigo-600'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-gray-800/60'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {isSelected ? (
                                  <CheckSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                ) : (
                                  <Square className="h-4 w-4 text-slate-400 shrink-0" />
                                )}
                                <span className="truncate">{category}</span>
                              </div>

                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white shadow-2xs'
                                    : 'bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {count}
                              </span>
                            </button>
                          );
                        })}

                      {allCategories.filter((category) =>
                        !categoryDropdownSearch ||
                        category.toLowerCase().includes(categoryDropdownSearch.toLowerCase().trim())
                      ).length === 0 && (
                        <div className="py-4 text-center text-xs text-slate-400">
                          No categories matching "{categoryDropdownSearch}"
                        </div>
                      )}
                    </div>

                    {/* Dropdown Footer Actions */}
                    <div className="mt-3 pt-2.5 border-t border-slate-150 dark:border-gray-800/80 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {selectedCategories.length} selected
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsCategoryDropdownOpen(false)}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-3xs transition-colors"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Category Tags Summary */}
              {selectedCategories.length > 0 && selectedCategories.length < allCategories.length && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedCategories.map((category) => (
                    <span
                      key={category}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-900/60 text-indigo-900 dark:text-indigo-200 text-xs font-semibold"
                    >
                      <span>{category}</span>
                      <span className="text-[10px] font-mono opacity-70">({categoryCounts[category] || 0})</span>
                      <button
                        type="button"
                        onClick={() => handleToggleCategory(category)}
                        className="text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 cursor-pointer ml-0.5"
                        title={`Remove ${category}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* STEP 2: MASTER PRICING RULES & SAFEGUARDS (FULL WIDTH) */}
            <div className="w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-2xs space-y-6">
              <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold items-center justify-center">
                    2
                  </span>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider">
                    Master Pricing Rules & Formulas
                  </h3>
                </div>
              </div>

              {/* Main Rule Builder 2-Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Half: Direction & Calculation Type */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Adjustment Direction Toggle */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Adjustment Direction
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAdjustmentAction('decrease')}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                          adjustmentAction === 'decrease'
                            ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-400'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0">
                          <TrendingDown className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-bold text-xs">Discount (Sale)</div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">
                            Reduce catalog prices
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAdjustmentAction('increase')}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                          adjustmentAction === 'increase'
                            ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/50 text-blue-950 dark:text-blue-100 ring-1 ring-blue-400'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0">
                          <TrendingUp className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-bold text-xs">Markup (Premium)</div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">
                            Increase catalog prices
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Calculation Mode Toggle */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Calculation Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAdjustmentType('percentage')}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          adjustmentType === 'percentage'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <Percent className="h-3.5 w-3.5" /> Percentage (%)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustmentType('fixed')}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          adjustmentType === 'fixed'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <DollarSign className="h-3.5 w-3.5" /> Fixed Amount (KSh)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Half: Magnitude & Presets */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Adjustment Value Input & Presets */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Adjustment Magnitude
                      </label>
                      <span className="font-mono text-sm font-black text-indigo-600 dark:text-indigo-400">
                        {adjustmentAction === 'decrease' ? '-' : '+'}
                        {adjustmentType === 'percentage'
                          ? `${adjustmentValue}%`
                          : `KSh ${adjustmentValue.toLocaleString('en-KE')}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={adjustmentType === 'percentage' ? 1 : 50}
                        max={adjustmentType === 'percentage' ? 80 : 10000}
                        step={adjustmentType === 'percentage' ? 1 : 50}
                        value={adjustmentValue}
                        onChange={(e) => setAdjustmentValue(Number(e.target.value))}
                        className="flex-1 accent-indigo-600 cursor-pointer"
                      />
                      <div className="relative w-32 shrink-0">
                        <input
                          type="number"
                          min={1}
                          value={adjustmentValue}
                          onChange={(e) => setAdjustmentValue(Math.max(1, Number(e.target.value)))}
                          className="w-full text-xs font-mono font-bold px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-right pr-8"
                        />
                        <span className="absolute right-2.5 top-2.5 text-xs text-gray-400 font-mono">
                          {adjustmentType === 'percentage' ? '%' : 'KSh'}
                        </span>
                      </div>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="pt-1">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                        Quick Standard Presets
                      </span>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                        {adjustmentAction === 'decrease' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset('decrease', 5)}
                              className="px-2 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold hover:bg-emerald-100 cursor-pointer"
                            >
                              -5% Light
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset('decrease', 10)}
                              className="px-2 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold hover:bg-emerald-100 cursor-pointer"
                            >
                              -10% Promo
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset('decrease', 15)}
                              className="px-2 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold hover:bg-emerald-100 cursor-pointer"
                            >
                              -15% Tier
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset('decrease', 20)}
                              className="px-2 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold hover:bg-emerald-100 cursor-pointer"
                            >
                              -20% Sale
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset('decrease', 30)}
                              className="px-2 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold hover:bg-emerald-100 cursor-pointer"
                            >
                              -30% Flash
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset('increase', 5)}
                              className="px-2 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 text-[10px] font-bold hover:bg-blue-100 cursor-pointer"
                            >
                              +5% Margin
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset('increase', 10)}
                              className="px-2 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 text-[10px] font-bold hover:bg-blue-100 cursor-pointer"
                            >
                              +10% Index
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset('increase', 15)}
                              className="px-2 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 text-[10px] font-bold hover:bg-blue-100 cursor-pointer"
                            >
                              +15% Cost
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset('increase', 20)}
                              className="px-2 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 text-[10px] font-bold hover:bg-blue-100 cursor-pointer"
                            >
                              +20% Prem
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset('increase', 35)}
                              className="px-2 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 text-[10px] font-bold hover:bg-blue-100 cursor-pointer"
                            >
                              +35% Surge
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-Section 3: Rounding & Guardrails */}
              <div className="pt-5 border-t border-gray-150 dark:border-gray-800 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold items-center justify-center">
                    3
                  </span>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider">
                    Smart Rounding & Safeguards
                  </h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-5">
                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Pricing Rounding Rule
                    </label>
                    <select
                      value={roundingStrategy}
                      onChange={(e) => setRoundingStrategy(e.target.value as any)}
                      className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                    >
                      <option value="integer">Round to nearest Integer (e.g. KSh 1,450)</option>
                      <option value="nearest_10">Round to nearest 10 (e.g. KSh 1,450 / 1,460)</option>
                      <option value="nearest_50">Round to nearest 50 (e.g. KSh 1,450 / 1,500)</option>
                      <option value="nearest_100">Round to nearest 100 (e.g. KSh 1,500)</option>
                      <option value="psychological_99">Psychological .99 (e.g. KSh 1,499)</option>
                      <option value="psychological_990">Psychological .990 (e.g. KSh 14,990)</option>
                      <option value="exact">Exact (2 decimal places)</option>
                    </select>
                  </div>

                  <div className="lg:col-span-7 space-y-3">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enforceCostFloor}
                        onChange={(e) => setEnforceCostFloor(e.target.checked)}
                        className="mt-0.5 rounded text-indigo-600"
                      />
                      <div>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">
                          Enforce Minimum Cost Floor Safeguard
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight block">
                          Never allow prices to drop below product estimated acquisition cost.
                        </span>
                      </div>
                    </label>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                          Absolute Minimum Floor (KSh)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={minPriceFloor}
                          onChange={(e) => setMinPriceFloor(Math.max(1, Number(e.target.value)))}
                          className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                          Max Discount Cap (%)
                        </label>
                        <input
                          type="number"
                          min={10}
                          max={90}
                          value={maxDiscountCap}
                          onChange={(e) => setMaxDiscountCap(Number(e.target.value))}
                          className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* LIVE PRICE IMPACT MATRIX & SIMULATION TABLE (FULL WIDTH, BELOW TARGET CATEGORIES & MASTER RULES) */}
            <div className="w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-150 dark:border-gray-800 pb-3">
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    Live Price Impact Matrix & Simulation Table
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Review and fine-tune individual products before committing master adjustments across {previewItems.length} filtered items.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  >
                    <CheckSquare className="h-3.5 w-3.5 text-indigo-600" /> Select All Filtered
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllFiltered}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  >
                    <Square className="h-3.5 w-3.5 text-gray-400" /> Deselect All
                  </button>
                </div>
              </div>

              {/* Table Search & Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6 relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by SKU, product name, or brand..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 focus:bg-white dark:focus:bg-gray-900"
                  />
                </div>

                <div className="sm:col-span-3">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as any)}
                    className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100"
                  >
                    <option value="all">All Product Types</option>
                    <option value="physical">Physical Only</option>
                    <option value="digital">Digital Only</option>
                    <option value="service">Service Only</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value as any)}
                    className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100"
                  >
                    <option value="all">All Stock Status</option>
                    <option value="in_stock">In Stock Only</option>
                    <option value="low_stock">Low Stock (≤5)</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={previewItems.length > 0 && previewItems.every((p) => p.isSelected)}
                          onChange={(e) => {
                            if (e.target.checked) handleSelectAllFiltered();
                            else handleDeselectAllFiltered();
                          }}
                          className="rounded text-indigo-600"
                        />
                      </th>
                      <th className="py-2.5 px-3">Product / SKU</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Current Price</th>
                      <th className="py-2.5 px-3 text-right">Calculated New</th>
                      <th className="py-2.5 px-3 text-right">Price Delta</th>
                      <th className="py-2.5 px-3 text-right">New Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 dark:divide-gray-800">
                    {previewItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-gray-500 dark:text-gray-400">
                          <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <div className="font-semibold text-xs">No products match current filter selection.</div>
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            Try selecting more categories or clearing the search query.
                          </div>
                        </td>
                      </tr>
                    ) : (
                      previewItems.map((item) => {
                        const isDiscount = item.diff < 0;
                        const isMarkup = item.diff > 0;
                        return (
                          <tr
                            key={item.product.id}
                            onClick={() => handleToggleProduct(item.product.id)}
                            className={`transition-colors cursor-pointer ${
                              item.isSelected
                                ? 'bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50/50'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 opacity-60'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={item.isSelected}
                                onChange={() => handleToggleProduct(item.product.id)}
                                className="rounded text-indigo-600"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2.5">
                                {item.product.imageUrl ? (
                                  <img
                                    src={item.product.imageUrl}
                                    alt={item.product.name}
                                    className="h-8 w-8 rounded-lg object-cover bg-gray-100 dark:bg-gray-800 shrink-0"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                                    <Package className="h-4 w-4 text-gray-400" />
                                  </div>
                                )}
                                <div className="min-w-0 max-w-[260px]">
                                  <div className="font-bold text-gray-900 dark:text-gray-100 truncate">
                                    {item.product.name}
                                  </div>
                                  <div className="text-[10px] font-mono text-gray-400 truncate">
                                    {item.product.sku || 'NO-SKU'} • Stock:{' '}
                                    {item.product.stock !== null ? item.product.stock : '∞'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                {item.product.category || 'Unassigned'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-gray-700 dark:text-gray-300">
                              KSh {item.originalPrice.toLocaleString('en-KE')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">
                              KSh {item.calculatedPrice.toLocaleString('en-KE')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-xs">
                              {isDiscount ? (
                                <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                                  <TrendingDown className="h-3 w-3" />-
                                  {Math.abs(item.diff).toLocaleString('en-KE')} ({item.percentChange.toFixed(0)}%)
                                </span>
                              ) : isMarkup ? (
                                <span className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                                  <TrendingUp className="h-3 w-3" />+
                                  {Math.abs(item.diff).toLocaleString('en-KE')} (+{item.percentChange.toFixed(0)}%)
                                </span>
                              ) : (
                                <span className="text-gray-400">0</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                              {item.projectedMargin.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* TAB 2: AUDIT & ROLLBACK HISTORY */
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-4">
              <div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                  <History className="h-4 w-4 text-indigo-600" />
                  Bulk Price Adjustment Audit Log & 1-Click Rollback
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Every bulk price adjustment batch is preserved with initial snapshots so you can revert any rule instantly.
                </p>
              </div>
            </div>

            {historyList.length === 0 ? (
              <div className="py-16 text-center text-gray-500 dark:text-gray-400">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <div className="font-semibold text-xs">No previous price adjustment batches recorded.</div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  When you apply bulk percentage or markup changes, rollback snapshots will be shown here.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-150 dark:divide-gray-800">
                {historyList.map((entry) => (
                  <div
                    key={entry.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {entry.ruleDescription}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {entry.affectedCount} items
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <span>{entry.timestamp}</span>
                        <span>•</span>
                        <span>Categories: {entry.categories.join(', ')}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRollbackBatch(entry)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-amber-600" /> Revert / Undo Batch
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
