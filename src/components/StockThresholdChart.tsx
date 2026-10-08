/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';
import { Product } from '../types';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  Search, 
  SlidersHorizontal, 
  Truck, 
  Plus, 
  RefreshCw, 
  Sparkles, 
  Info,
  Download,
  Filter,
  Layers,
  Boxes,
  ChevronDown,
  Check,
  RotateCcw,
  Tag,
  FileSpreadsheet,
  AlertCircle,
  X,
  Zap,
  DollarSign
} from 'lucide-react';
import { CurrencyType, formatPrice } from '../lib/currency';

interface StockThresholdChartProps {
  products: Product[];
  onUpdateProductStock: (id: string, newStock: number) => void;
  availableCategories?: string[];
  currency?: CurrencyType;
  darkMode?: boolean;
}

type FilterType = 'all' | 'low' | 'warning' | 'healthy';
type SortType = 'priority' | 'stock-asc' | 'stock-desc' | 'threshold-desc' | 'name-asc';

export default function StockThresholdChart({
  products,
  onUpdateProductStock,
  availableCategories = [],
  currency = 'KSh',
  darkMode = false
}: StockThresholdChartProps) {
  // Computed style properties based on active theme
  const gridColor = darkMode ? '#334155' : '#E5E7EB';
  const tickColor = darkMode ? '#94a3b8' : '#4B5563';
  const axisStroke = darkMode ? '#475569' : '#D1D5DB';
  const tooltipCursorColor = darkMode ? 'rgba(51, 65, 85, 0.4)' : 'rgba(243, 244, 246, 0.5)';

  // Filter and Sort states
  const [filterMode, setFilterMode] = useState<FilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortType>('priority');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Restock interactive simulation input
  const [restockAmounts, setRestockAmounts] = useState<Record<string, string>>({});
  const [successRestockId, setSuccessRestockId] = useState<string | null>(null);

  // Category Batch Restock Modal & Actions State
  const [isCategoryActionOpen, setIsCategoryActionOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [categoryActionNotification, setCategoryActionNotification] = useState<string | null>(null);

  // Extract physical products with valid stock configurations
  const physicalProducts = useMemo(() => {
    return products.filter((p) => p.type === 'physical' && p.stock !== null);
  }, [products]);

  // Compute all available categories from products and availableCategories prop
  const allCategories = useMemo(() => {
    const set = new Set<string>(availableCategories.filter(Boolean));
    physicalProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [physicalProducts, availableCategories]);

  // Per-category stock health summary counts
  const categoryStats = useMemo(() => {
    const stats: Record<string, { total: number; lowStock: number; outOfStock: number; deficit: number; restockCost: number }> = {};
    
    // Overall all
    let allTotal = 0;
    let allLow = 0;
    let allOut = 0;
    let allDeficit = 0;
    let allCost = 0;

    allCategories.forEach((cat) => {
      stats[cat] = { total: 0, lowStock: 0, outOfStock: 0, deficit: 0, restockCost: 0 };
    });

    physicalProducts.forEach((p) => {
      const cat = p.category || 'Uncategorized';
      if (!stats[cat]) {
        stats[cat] = { total: 0, lowStock: 0, outOfStock: 0, deficit: 0, restockCost: 0 };
      }
      const stock = p.stock ?? 0;
      const threshold = p.lowStockThreshold ?? 5;
      const deficit = Math.max(0, threshold - stock);
      const isOut = stock === 0;
      const isLow = stock <= threshold;
      const estimatedCost = deficit * (p.costPrice || p.price * 0.6 || 0);

      stats[cat].total += 1;
      allTotal += 1;

      if (isOut) {
        stats[cat].outOfStock += 1;
        allOut += 1;
      }
      if (isLow) {
        stats[cat].lowStock += 1;
        allLow += 1;
      }
      if (deficit > 0) {
        stats[cat].deficit += deficit;
        stats[cat].restockCost += estimatedCost;
        allDeficit += deficit;
        allCost += estimatedCost;
      }
    });

    return {
      byCategory: stats,
      all: { total: allTotal, lowStock: allLow, outOfStock: allOut, deficit: allDeficit, restockCost: allCost }
    };
  }, [physicalProducts, allCategories]);

  // Process and shape data for filtering, sorting, and visualization
  const processedData = useMemo(() => {
    const formatted = physicalProducts.map((p) => {
      const stock = p.stock ?? 0;
      const threshold = p.lowStockThreshold ?? 5;
      const deficit = threshold - stock;
      const ratio = threshold > 0 ? stock / threshold : 1;
      
      // Safety and Priority levels
      let status: 'out' | 'critical' | 'warning' | 'healthy' = 'healthy';
      let priorityScore = 0; // Higher score = higher restock priority

      if (stock === 0) {
        status = 'out';
        priorityScore = 100 + threshold; // absolute emergency
      } else if (stock <= threshold) {
        status = 'critical';
        priorityScore = 80 + (deficit / (threshold || 1)) * 20; // deficit fraction
      } else if (stock <= threshold * 1.5) {
        status = 'warning';
        priorityScore = 30 + (1.5 - ratio) * 40;
      } else {
        status = 'healthy';
        priorityScore = Math.max(0, 10 - ratio);
      }

      return {
        id: p.id,
        name: p.name,
        sku: p.sku || p.id.slice(0, 8).toUpperCase(),
        stock,
        threshold,
        deficit,
        ratio,
        status,
        priorityScore,
        category: p.category || 'Uncategorized',
        imageUrl: p.imageUrl,
        price: p.price,
        costPrice: p.costPrice || (p.price * 0.6)
      };
    });

    // 1. Apply Search Query Filter
    let filtered = formatted;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }

    // 2. Apply Category Filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((item) => item.category === categoryFilter);
    }

    // 3. Apply Safety Status Filter
    if (filterMode === 'low') {
      filtered = filtered.filter((item) => item.status === 'out' || item.status === 'critical');
    } else if (filterMode === 'warning') {
      filtered = filtered.filter((item) => item.status === 'warning');
    } else if (filterMode === 'healthy') {
      filtered = filtered.filter((item) => item.status === 'healthy');
    }

    // 4. Apply Sorting Option
    return filtered.sort((a, b) => {
      if (sortMode === 'priority') {
        return b.priorityScore - a.priorityScore; // descending restock priority
      }
      if (sortMode === 'stock-asc') {
        return a.stock - b.stock; // lowest stock first
      }
      if (sortMode === 'stock-desc') {
        return b.stock - a.stock; // highest stock first
      }
      if (sortMode === 'threshold-desc') {
        return b.threshold - a.threshold; // highest threshold first
      }
      if (sortMode === 'name-asc') {
        return a.name.localeCompare(b.name); // alphabetical
      }
      return 0;
    });
  }, [physicalProducts, categoryFilter, filterMode, sortMode, searchQuery]);

  // Handle Quick Restock Single Product Submission
  const handleQuickRestock = (productId: string, currentStock: number) => {
    const amountStr = restockAmounts[productId];
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) return;

    const newStock = currentStock + amount;
    onUpdateProductStock(productId, newStock);

    setRestockAmounts((prev) => ({ ...prev, [productId]: '' }));
    setSuccessRestockId(productId);
    setTimeout(() => {
      setSuccessRestockId(null);
    }, 2500);
  };

  // Handle Batch Restock Action for Category / Filtered items
  const handleBatchCategoryRestock = (type: 'add10' | 'add25' | 'fill-threshold') => {
    const targetItems = processedData.filter((item) => {
      if (type === 'fill-threshold') {
        return item.stock < item.threshold;
      }
      return true;
    });

    if (targetItems.length === 0) {
      setCategoryActionNotification('No items required restocking under the selected criteria.');
      setTimeout(() => setCategoryActionNotification(null), 3500);
      return;
    }

    let updatedCount = 0;
    let totalUnitsAdded = 0;

    targetItems.forEach((item) => {
      let nextStock = item.stock;
      if (type === 'add10') {
        nextStock += 10;
        totalUnitsAdded += 10;
      } else if (type === 'add25') {
        nextStock += 25;
        totalUnitsAdded += 25;
      } else if (type === 'fill-threshold') {
        const added = Math.max(0, item.threshold - item.stock);
        nextStock = item.threshold;
        totalUnitsAdded += added;
      }

      if (nextStock !== item.stock) {
        onUpdateProductStock(item.id, nextStock);
        updatedCount += 1;
      }
    });

    const catName = categoryFilter === 'all' ? 'all categories' : `"${categoryFilter}"`;
    setCategoryActionNotification(
      `Restocked ${updatedCount} items in ${catName} (+${totalUnitsAdded} total units added).`
    );
    setIsCategoryActionOpen(false);
    setTimeout(() => setCategoryActionNotification(null), 4000);
  };

  // CSV Export Utility Helpers
  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str}"`;
    }
    return str;
  };

  const triggerCsvDownload = (filename: string, csvContent: string) => {
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Stock Telemetry CSV Reports
  const handleExportStockCSV = (exportMode: 'current_view' | 'critical_deficits' | 'full_audit') => {
    const dateStamp = new Date().toISOString().split('T')[0];
    let itemsToExport = processedData;
    let filenamePrefix = 'stock_telemetry_report';

    if (exportMode === 'critical_deficits') {
      itemsToExport = physicalProducts
        .filter((p) => (p.stock ?? 0) <= (p.lowStockThreshold ?? 5))
        .map((p) => {
          const stock = p.stock ?? 0;
          const threshold = p.lowStockThreshold ?? 5;
          return {
            id: p.id,
            name: p.name,
            sku: p.sku || p.id.slice(0, 8).toUpperCase(),
            stock,
            threshold,
            deficit: threshold - stock,
            ratio: threshold > 0 ? stock / threshold : 1,
            status: stock === 0 ? 'out' : 'critical' as const,
            priorityScore: stock === 0 ? 100 : 80,
            category: p.category || 'Uncategorized',
            imageUrl: p.imageUrl,
            price: p.price,
            costPrice: p.costPrice || (p.price * 0.6)
          };
        });
      filenamePrefix = 'restock_procurement_dispatch_worksheet';
    } else if (exportMode === 'full_audit') {
      itemsToExport = physicalProducts.map((p) => {
        const stock = p.stock ?? 0;
        const threshold = p.lowStockThreshold ?? 5;
        const deficit = threshold - stock;
        let status: 'out' | 'critical' | 'warning' | 'healthy' = 'healthy';
        if (stock === 0) status = 'out';
        else if (stock <= threshold) status = 'critical';
        else if (stock <= threshold * 1.5) status = 'warning';

        return {
          id: p.id,
          name: p.name,
          sku: p.sku || p.id.slice(0, 8).toUpperCase(),
          stock,
          threshold,
          deficit,
          ratio: threshold > 0 ? stock / threshold : 1,
          status,
          priorityScore: status === 'out' ? 100 : status === 'critical' ? 80 : 10,
          category: p.category || 'Uncategorized',
          imageUrl: p.imageUrl,
          price: p.price,
          costPrice: p.costPrice || (p.price * 0.6)
        };
      });
      filenamePrefix = 'full_inventory_stock_audit';
    }

    const headers = [
      "SKU",
      "Product Name",
      "Category",
      "Current Stock Level",
      "Safety Reorder Threshold",
      "Inventory Status",
      "Deficit / Surplus Units",
      "Safety Stock Margin (%)",
      "Suggested Restock Quantity",
      `Unit Price (${currency})`,
      `Estimated Cost (${currency})`,
      `Stock Valuation (${currency})`
    ];

    const rows = itemsToExport.map((item) => {
      const suggestedRestock = Math.max(15, item.threshold * 3 - item.stock);
      const marginPct = Math.round(item.ratio * 100);
      let statusLabel = 'HEALTHY & SECURE';
      if (item.status === 'out') statusLabel = 'OUT OF STOCK';
      else if (item.status === 'critical') statusLabel = 'CRITICAL DEFICIT';
      else if (item.status === 'warning') statusLabel = 'NEAR SAFETY LIMIT';

      const valuation = (item.stock * item.price).toFixed(2);
      const estCost = (item.costPrice || 0).toFixed(2);

      return [
        item.sku,
        item.name,
        item.category,
        item.stock,
        item.threshold,
        statusLabel,
        item.deficit > 0 ? `-${item.deficit}` : `+${Math.abs(item.deficit)}`,
        `${marginPct}%`,
        suggestedRestock,
        item.price.toFixed(2),
        estCost,
        valuation
      ].map(escapeCsv).join(',');
    });

    const csvContent = [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
    const catSuffix = categoryFilter !== 'all' ? `_${categoryFilter.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : '';
    const filename = `veloce_${filenamePrefix}${catSuffix}_${dateStamp}.csv`;

    triggerCsvDownload(filename, csvContent);
    setIsExportDropdownOpen(false);
    setCategoryActionNotification(`Exported ${itemsToExport.length} stock item(s) to ${filename}.`);
    setTimeout(() => setCategoryActionNotification(null), 3500);
  };

  // Restock Recommendations List (Top 5 critical products in current filter)
  const topPriorityItems = useMemo(() => {
    return processedData
      .filter((item) => item.status === 'out' || item.status === 'critical' || item.status === 'warning')
      .slice(0, 5);
  }, [processedData]);

  // Color mappings for chart bars and statuses
  const getColorForStatus = (status: 'out' | 'critical' | 'warning' | 'healthy', opacity: number = 1) => {
    switch (status) {
      case 'out':
        return `rgba(239, 68, 68, ${opacity})`; // red-500
      case 'critical':
        return `rgba(249, 115, 22, ${opacity})`; // orange-500
      case 'warning':
        return `rgba(245, 158, 11, ${opacity})`; // amber-500
      case 'healthy':
        return `rgba(16, 185, 129, ${opacity})`; // emerald-500
      default:
        return `rgba(99, 102, 241, ${opacity})`; // indigo-500
    }
  };

  const activeCategoryStats = categoryFilter === 'all' 
    ? categoryStats.all 
    : (categoryStats.byCategory[categoryFilter] || { total: 0, lowStock: 0, outOfStock: 0, deficit: 0, restockCost: 0 });

  return (
    <div className="rounded-xl border border-gray-150 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xs font-sans animate-in fade-in duration-300" id="stock-threshold-comparison-module">
      {/* Module Header & Action Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-150 dark:border-slate-800">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-bold text-gray-950 dark:text-white flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Stock Levels vs. Reorder Thresholds Analytical Bar Chart
            </h3>
            <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 font-mono">
              {processedData.length} {processedData.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 font-light">
            Monitor real-time physical inventory, analyze threshold safety margins, filter by category, and execute restocking workflows.
          </p>
        </div>

        {/* Global Action Buttons: Export & Batch Category Actions */}
        <div className="flex flex-wrap items-center gap-2 relative">
          {/* Category Batch Restock Actions Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsCategoryActionOpen(!isCategoryActionOpen);
                setIsExportDropdownOpen(false);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-850 bg-amber-50/80 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-3 text-xs font-bold shadow-2xs transition-all cursor-pointer"
              title="Execute batch restocking for the active category"
              id="btn-stock-category-actions"
            >
              <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>Category Actions</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </button>

            {isCategoryActionOpen && (
              <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-gray-200 dark:border-slate-750 bg-white dark:bg-slate-850 p-2 shadow-xl animate-in fade-in zoom-in-95 duration-150 font-sans">
                <div className="px-2.5 py-1.5 border-b border-gray-100 dark:border-slate-800">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400">
                    Category: {categoryFilter === 'all' ? 'All Categories' : categoryFilter}
                  </span>
                  <p className="text-[11px] text-gray-600 dark:text-slate-300 font-semibold mt-0.5">
                    {activeCategoryStats.lowStock} understocked items ({activeCategoryStats.deficit} units deficit)
                  </p>
                </div>

                <div className="py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => handleBatchCategoryRestock('fill-threshold')}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold text-gray-800 dark:text-slate-100 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                      Refill All to Safety Threshold
                    </span>
                    <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 px-1.5 py-0.5 rounded">
                      +{activeCategoryStats.deficit} units
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBatchCategoryRestock('add10')}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold text-gray-800 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-750 flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Plus className="h-3.5 w-3.5 text-emerald-600" />
                      Add +10 Units to All in View
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">+10/ea</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBatchCategoryRestock('add25')}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold text-gray-800 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-750 flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Plus className="h-3.5 w-3.5 text-emerald-600" />
                      Add +25 Units to All in View
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">+25/ea</span>
                  </button>
                </div>

                <div className="pt-1.5 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryFilter('all');
                      setIsCategoryActionOpen(false);
                    }}
                    className="text-[10px] font-mono font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset Filter
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCategoryActionOpen(false)}
                    className="text-[10px] text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Export Stock CSV Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsExportDropdownOpen(!isExportDropdownOpen);
                setIsCategoryActionOpen(false);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-850 bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 px-3 text-xs font-bold shadow-2xs transition-all cursor-pointer"
              title="Download Stock Management data as CSV"
              id="btn-stock-export-csv"
            >
              <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Export CSV</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </button>

            {isExportDropdownOpen && (
              <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-gray-200 dark:border-slate-750 bg-white dark:bg-slate-850 p-2 shadow-xl animate-in fade-in zoom-in-95 duration-150 font-sans">
                <div className="px-2.5 py-1.5 border-b border-gray-100 dark:border-slate-800">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400">
                    Stock Telemetry Export Studio
                  </span>
                  <p className="text-[11px] text-gray-500 dark:text-slate-300 font-light mt-0.5">
                    Generate formatted CSV spreadsheets for warehouse or procurement.
                  </p>
                </div>

                <div className="py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => handleExportStockCSV('current_view')}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold text-gray-800 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                      <div>
                        <span className="block font-bold">Export Current Viewable View</span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-400 font-normal">
                          {processedData.length} items (matches category & filters)
                        </span>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportStockCSV('critical_deficits')}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold text-gray-800 dark:text-slate-100 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-800 dark:hover:text-red-300 flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-red-600" />
                      <div>
                        <span className="block font-bold">Restock Procurement Worksheet</span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-400 font-normal">
                          Only understocked deficit items ({categoryStats.all.lowStock} items)
                        </span>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportStockCSV('full_audit')}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold text-gray-800 dark:text-slate-100 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-indigo-600" />
                      <div>
                        <span className="block font-bold">Full Physical Stock Audit</span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-400 font-normal">
                          All {physicalProducts.length} physical catalog products
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {categoryActionNotification && (
        <div className="mt-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-3.5 py-2 text-xs font-semibold text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-2 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>{categoryActionNotification}</span>
          </div>
          <button
            type="button"
            onClick={() => setCategoryActionNotification(null)}
            className="text-indigo-500 hover:text-indigo-800 dark:hover:text-indigo-200 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Interactive Category Quick-Filter Pills Bar */}
      <div className="mt-4 pb-3 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 shrink-0 flex items-center gap-1 mr-1">
          <Filter className="h-3 w-3" /> Categories:
        </span>

        {/* All Categories Pill */}
        <button
          type="button"
          onClick={() => setCategoryFilter('all')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer ${
            categoryFilter === 'all'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
          }`}
        >
          <span>All Categories</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
            categoryFilter === 'all' ? 'bg-indigo-700 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
          }`}>
            {physicalProducts.length}
          </span>
          {categoryStats.all.lowStock > 0 && (
            <span className={`px-1 py-0.2 rounded text-[9px] font-mono font-bold ${
              categoryFilter === 'all' ? 'bg-amber-400 text-amber-950' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}>
              {categoryStats.all.lowStock} low
            </span>
          )}
        </button>

        {/* Individual Category Pills */}
        {allCategories.map((cat) => {
          const stats = categoryStats.byCategory[cat] || { total: 0, lowStock: 0, outOfStock: 0, deficit: 0 };
          const isSelected = categoryFilter === cat;

          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>{cat}</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                isSelected ? 'bg-indigo-700 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
              }`}>
                {stats.total}
              </span>
              {stats.lowStock > 0 && (
                <span className={`px-1 py-0.2 rounded text-[9px] font-mono font-bold ${
                  isSelected ? 'bg-amber-400 text-amber-950' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}>
                  {stats.lowStock} low
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Grid containing Interactive Filters, Main Chart and Restock Ledger Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mt-4">
        
        {/* Left Column: Controls & Category Insights Sidebar (Span 1 on large screens) */}
        <div className="flex flex-col gap-4 bg-gray-50/50 dark:bg-slate-850/40 border border-gray-150 dark:border-slate-800 p-4 rounded-xl xl:col-span-1">
          <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider font-mono border-b border-gray-200/60 dark:border-slate-750 pb-2">
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-500" /> Chart Filters & Sort
            </span>
            {(categoryFilter !== 'all' || filterMode !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('all');
                  setFilterMode('all');
                  setSearchQuery('');
                }}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer lowercase"
              >
                reset
              </button>
            )}
          </div>

          {/* Search bar */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold font-mono text-gray-400 dark:text-slate-400 uppercase">Search Product / SKU</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Type name, sku, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 pl-8 pr-7 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 outline-none transition focus:border-indigo-500 shadow-3xs"
                id="stock-chart-search"
              />
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Category Dropdown Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold font-mono text-gray-400 dark:text-slate-400 uppercase">Filter By Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 px-2.5 py-1.5 text-xs text-gray-800 dark:text-slate-200 font-medium outline-none transition focus:border-indigo-500 shadow-3xs cursor-pointer"
              id="select-stock-category-filter"
            >
              <option value="all">All Categories ({physicalProducts.length} items)</option>
              {allCategories.map((cat) => {
                const count = categoryStats.byCategory[cat]?.total || 0;
                const low = categoryStats.byCategory[cat]?.lowStock || 0;
                return (
                  <option key={cat} value={cat}>
                    {cat} ({count} items{low > 0 ? ` • ${low} low` : ''})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Safety Status Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold font-mono text-gray-400 dark:text-slate-400 uppercase">Fulfillment Safety Status</label>
            <div className="grid grid-cols-2 gap-1 bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg border border-gray-200 dark:border-slate-700">
              {(['all', 'low', 'warning', 'healthy'] as FilterType[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilterMode(mode)}
                  className={`py-1 px-2 text-[10px] font-bold rounded transition-all capitalize cursor-pointer text-center ${
                    filterMode === mode
                      ? 'bg-white dark:bg-slate-900 text-indigo-950 dark:text-indigo-300 shadow-3xs font-extrabold'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {mode === 'low' ? 'Low / Out' : mode}
                </button>
              ))}
            </div>
          </div>

          {/* Sort Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold font-mono text-gray-400 dark:text-slate-400 uppercase">Sort Order</label>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortType)}
              className="w-full bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 px-2.5 py-1.5 text-xs text-gray-800 dark:text-slate-200 font-medium outline-none transition focus:border-indigo-500 shadow-3xs cursor-pointer"
            >
              <option value="priority">🔥 Restock Priority</option>
              <option value="stock-asc">📉 Stock Level: Low to High</option>
              <option value="stock-desc">📈 Stock Level: High to Low</option>
              <option value="threshold-desc">🛡️ Threshold: High to Low</option>
              <option value="name-asc">🔤 Product Name: A to Z</option>
            </select>
          </div>

          {/* Quick Category & Stock Insights Summary Card */}
          <div className="mt-1 p-3 bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-lg text-xs font-sans">
            <div className="flex items-center justify-between mb-2 border-b border-indigo-100 dark:border-indigo-900/50 pb-1.5">
              <span className="text-[10px] font-extrabold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider font-mono flex items-center gap-1">
                <Info className="h-3 w-3 text-indigo-600" /> Stock Health Insights
              </span>
              <span className="text-[9px] font-mono font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-100/70 dark:bg-indigo-900/60 px-1.5 py-0.2 rounded truncate max-w-[100px]">
                {categoryFilter === 'all' ? 'All Catalog' : categoryFilter}
              </span>
            </div>
            
            <div className="space-y-1.5 text-[11px] leading-relaxed text-gray-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span>Items in Scope:</span>
                <strong className="font-mono text-gray-900 dark:text-white">{activeCategoryStats.total}</strong>
              </div>
              <div className="flex justify-between">
                <span>Critical / Low Items:</span>
                <strong className={`font-mono ${activeCategoryStats.lowStock > 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-emerald-600'}`}>
                  {activeCategoryStats.lowStock}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Deficit Units Needed:</span>
                <strong className={`font-mono ${activeCategoryStats.deficit > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-gray-900 dark:text-white'}`}>
                  {activeCategoryStats.deficit} units
                </strong>
              </div>
              {activeCategoryStats.restockCost > 0 && (
                <div className="flex justify-between pt-1 border-t border-indigo-100 dark:border-indigo-900/30 text-[10px]">
                  <span className="text-gray-500">Est. Restock Budget:</span>
                  <strong className="font-mono text-indigo-700 dark:text-indigo-300">
                    {formatPrice(activeCategoryStats.restockCost, currency)}
                  </strong>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Middle Columns: Chart Visualization (Span 2) */}
        <div className="xl:col-span-2 flex flex-col gap-4 border border-gray-150 dark:border-slate-800 p-4 rounded-xl bg-gray-50/20 dark:bg-slate-850/20 min-h-[380px]">
          <div className="flex flex-wrap justify-between items-center pb-2 border-b border-gray-100 dark:border-slate-800 text-xs gap-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-slate-400 font-medium">
                Displaying <strong className="font-bold text-indigo-950 dark:text-indigo-300 font-mono">{processedData.length}</strong> items
              </span>
              {categoryFilter !== 'all' && (
                <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 text-[10px] font-mono text-indigo-700 dark:text-indigo-300">
                  {categoryFilter}
                </span>
              )}
            </div>
            {processedData.length > 0 && (
              <span className="text-[10px] text-gray-450 dark:text-slate-500 italic font-light">
                Hover bars for safety margins & restock telemetry
              </span>
            )}
          </div>

          {processedData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
              <AlertTriangle className="h-10 w-10 text-amber-500 mb-3 animate-bounce" />
              <h4 className="text-sm font-bold text-gray-700 dark:text-slate-200">No Inventory Match Found</h4>
              <p className="text-xs max-w-xs mt-1 leading-normal dark:text-slate-400">
                Adjust active filters, clear search terms, or switch the category to display stock levels.
              </p>
              {(searchQuery || filterMode !== 'all' || categoryFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterMode('all');
                    setCategoryFilter('all');
                  }}
                  className="mt-3 text-xs bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-lg px-3 py-1 font-bold hover:bg-indigo-100 transition cursor-pointer"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 w-full min-w-0" style={{ width: '100%', height: 340, minHeight: 340, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height={340} minWidth={0} minHeight={340} debounce={50}>
                <BarChart
                  data={processedData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                  barGap={2}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis
                    dataKey="sku"
                    tick={{ fill: tickColor, fontSize: 10, fontFamily: 'monospace' }}
                    axisLine={{ stroke: axisStroke }}
                    tickLine={{ stroke: axisStroke }}
                  />
                  <YAxis
                    tick={{ fill: tickColor, fontSize: 10 }}
                    axisLine={{ stroke: axisStroke }}
                    tickLine={{ stroke: axisStroke }}
                  />
                  <Tooltip
                    cursor={{ fill: tooltipCursorColor }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      const restockSuggested = d.threshold * 3 - d.stock;

                      return (
                        <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 p-3.5 rounded-xl shadow-md text-xs font-sans max-w-[250px] z-50">
                          <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-gray-100 dark:border-slate-800">
                            {d.imageUrl && (
                              <img src={d.imageUrl} alt={d.name} className="h-7 w-7 rounded object-cover border dark:border-slate-800" />
                            )}
                            <div className="min-w-0">
                              <span className="font-mono text-[9px] font-extrabold text-indigo-600 dark:text-indigo-400 block">{d.sku}</span>
                              <h5 className="font-bold text-gray-900 dark:text-white truncate leading-tight mt-0.5">{d.name}</h5>
                              <span className="text-[9px] text-gray-400 dark:text-slate-400 block">{d.category}</span>
                            </div>
                          </div>
                          
                          <div className="space-y-1.5 font-sans">
                            <div className="flex justify-between text-gray-500 dark:text-slate-400">
                              <span>Current Stock:</span>
                              <strong className={`font-mono ${d.stock <= d.threshold ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-900 dark:text-slate-200'}`}>
                                {d.stock} units
                              </strong>
                            </div>
                            <div className="flex justify-between text-gray-500 dark:text-slate-400">
                              <span>Min Threshold:</span>
                              <strong className="font-mono text-gray-900 dark:text-slate-200">{d.threshold} units</strong>
                            </div>
                            <div className="flex justify-between text-gray-500 dark:text-slate-400">
                              <span>Safety Margin:</span>
                              {d.deficit >= 0 ? (
                                <span className="font-mono text-red-600 dark:text-red-400 font-bold">Deficit (-{d.deficit})</span>
                              ) : (
                                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">Secure (+{Math.abs(d.deficit)})</span>
                              )}
                            </div>
                            
                            <div className="pt-2 mt-1.5 border-t border-gray-100/80 dark:border-slate-800">
                              <span className="block text-[8px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-1 font-mono">Suggested Refill</span>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">Replenish Qty:</span>
                                <strong className="font-mono text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.2 rounded border border-indigo-100 dark:border-indigo-900/60">
                                  {restockSuggested > 0 ? restockSuggested : 15} units
                                </strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36}
                    iconSize={10}
                    formatter={(val) => val === 'stock' ? 'Current Stock Count' : 'Safety Reorder Threshold Limit'}
                    wrapperStyle={{ fontSize: 11, fontWeight: 500, color: darkMode ? '#cbd5e1' : '#374151' }}
                  />
                  
                  {/* Current Stock Level Bar */}
                  <Bar dataKey="stock" fill="#6366F1" radius={[4, 4, 0, 0]}>
                    {processedData.map((entry, index) => (
                      <Cell 
                        key={`cell-stock-${index}`} 
                        fill={getColorForStatus(entry.status, 0.85)} 
                        stroke={getColorForStatus(entry.status, 1)}
                        strokeWidth={1}
                      />
                    ))}
                  </Bar>
                  
                  {/* Low Stock Safety Threshold Reference Bar */}
                  <Bar dataKey="threshold" fill="#D1D5DB" stroke="#9CA3AF" strokeDasharray="3 3" radius={[4, 4, 0, 0]} opacity={0.65} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Right Column: Restock Action Ledger Sidebar (Span 1) */}
        <div className="flex flex-col gap-4 border border-gray-150 dark:border-slate-800 p-4 rounded-xl bg-gray-50/20 dark:bg-slate-850/20 xl:col-span-1">
          <div className="flex items-center justify-between border-b border-gray-200/60 dark:border-slate-750 pb-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider font-mono">
              <Truck className="h-3.5 w-3.5 text-amber-500 shrink-0" /> Restock Dispatch
            </span>
            <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold">
              {topPriorityItems.length} Urgent
            </span>
          </div>

          <p className="text-[10px] text-gray-500 dark:text-slate-400 leading-normal font-light">
            Top priority items requiring stock replenishment in {categoryFilter === 'all' ? 'the catalog' : `"${categoryFilter}"`}.
          </p>

          {topPriorityItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center border border-dashed border-gray-200 dark:border-slate-750 rounded-lg bg-white dark:bg-slate-900">
              <CheckCircle2 className="h-7 w-7 text-emerald-500 mb-2" />
              <span className="text-xs font-bold text-gray-800 dark:text-white">All Stock Levels Secure</span>
              <span className="text-[10px] text-gray-400 dark:text-slate-400 mt-1">
                Zero products in this view are currently flagging low stock warnings!
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5 flex-1 overflow-y-auto max-h-[300px] xl:max-h-none pr-1">
              {topPriorityItems.map((item) => {
                const isSuccess = successRestockId === item.id;
                const recQty = item.threshold * 3 - item.stock;
                const finalRecQty = recQty > 0 ? recQty : 15;

                return (
                  <div 
                    key={item.id} 
                    className={`rounded-lg border p-3 transition-all duration-300 relative bg-white dark:bg-slate-900 ${
                      isSuccess 
                        ? 'border-emerald-300 bg-emerald-50/20 ring-1 ring-emerald-100' 
                        : item.status === 'out' 
                        ? 'border-red-200 dark:border-red-900/50 shadow-3xs' 
                        : 'border-amber-200 dark:border-amber-900/50 shadow-3xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5 mb-1.5">
                      <div className="min-w-0">
                        <span className="font-mono text-[8px] font-extrabold text-gray-400 dark:text-slate-500 block tracking-wider uppercase leading-none">{item.sku}</span>
                        <h5 className="font-sans text-[11px] font-bold text-gray-900 dark:text-white truncate mt-1 leading-tight">{item.name}</h5>
                        <span className="text-[9px] text-gray-400 dark:text-slate-400">{item.category}</span>
                      </div>
                      <span className={`text-[8px] font-extrabold font-mono px-1.5 py-0.2 rounded shrink-0 uppercase tracking-wider ${
                        item.status === 'out'
                          ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}>
                        {item.status === 'out' ? 'OUT OF STOCK' : 'LOW STOCK'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] mb-2.5 font-sans">
                      <div className="bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded">
                        <span className="text-gray-400 dark:text-slate-400 block text-[8px] uppercase tracking-wider font-mono">Current Stock</span>
                        <strong className={`font-mono text-xs ${item.stock === 0 ? 'text-red-600 font-extrabold' : 'text-gray-900 dark:text-white'}`}>
                          {item.stock} / <span className="text-gray-400 font-normal text-[10px]">{item.threshold} threshold</span>
                        </strong>
                      </div>
                      <div className="bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded">
                        <span className="text-gray-400 dark:text-slate-400 block text-[8px] uppercase tracking-wider font-mono">Suggested Refill</span>
                        <strong className="font-mono text-xs text-indigo-700 dark:text-indigo-400 font-extrabold">
                          +{finalRecQty} units
                        </strong>
                      </div>
                    </div>

                    {/* Inline Quick Action Panel */}
                    <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-slate-800">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          placeholder={`Add (e.g. ${finalRecQty})`}
                          value={restockAmounts[item.id] || ''}
                          onChange={(e) => setRestockAmounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 px-1.5 py-1 text-[10px] outline-none focus:border-indigo-500 pr-4 font-mono font-bold text-gray-900 dark:text-white"
                          id={`input-quick-restock-${item.id}`}
                        />
                        <span className="absolute right-1 top-1.5 text-[8px] font-mono text-gray-400 font-bold uppercase">Qty</span>
                      </div>
                      <button
                        onClick={() => handleQuickRestock(item.id, item.stock)}
                        disabled={!restockAmounts[item.id]}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded font-bold text-[10px] px-2.5 py-1.5 transition shrink-0 cursor-pointer flex items-center gap-1"
                        id={`btn-submit-quick-restock-${item.id}`}
                      >
                        {isSuccess ? (
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        ) : (
                          <>
                            <Plus className="h-3 w-3" /> Restock
                          </>
                        )}
                      </button>
                    </div>

                    {isSuccess && (
                      <div className="absolute inset-0 bg-emerald-500/10 rounded-lg flex items-center justify-center backdrop-blur-[0.5px] pointer-events-none animate-in fade-in zoom-in duration-200">
                        <div className="bg-white dark:bg-slate-800 px-2 py-1 rounded-md border border-emerald-100 dark:border-emerald-800 shadow-xs flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-[9px] font-extrabold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Stock Updated!</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
