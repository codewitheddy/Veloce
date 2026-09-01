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
  ArrowUpRight, 
  Search, 
  SlidersHorizontal, 
  TrendingDown, 
  Truck, 
  ChevronRight, 
  TrendingUp, 
  ShoppingBag,
  Plus,
  RefreshCw,
  Sparkles,
  Info
} from 'lucide-react';

interface StockThresholdChartProps {
  products: Product[];
  onUpdateProductStock: (id: string, newStock: number) => void;
  darkMode?: boolean;
}

type FilterType = 'all' | 'low' | 'warning' | 'healthy';
type SortType = 'priority' | 'stock-asc' | 'stock-desc' | 'threshold-desc' | 'name-asc';

export default function StockThresholdChart({
  products,
  onUpdateProductStock,
  darkMode = false
}: StockThresholdChartProps) {
  // Computed style properties based on active theme
  const gridColor = darkMode ? '#334155' : '#E5E7EB';
  const tickColor = darkMode ? '#94a3b8' : '#4B5563';
  const axisStroke = darkMode ? '#475569' : '#D1D5DB';
  const tooltipCursorColor = darkMode ? 'rgba(51, 65, 85, 0.4)' : 'rgba(243, 244, 246, 0.5)';
  // Filter and Sort states
  const [filterMode, setFilterMode] = useState<FilterType>('all');
  const [sortMode, setSortMode] = useState<SortType>('priority');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredProductId, setHoveredProductId] = useState<string | null>(null);

  // Quick Restock interactive simulation input
  const [restockAmounts, setRestockAmounts] = useState<Record<string, string>>({});
  const [successRestockId, setSuccessRestockId] = useState<string | null>(null);

  // Extract physical products with valid stock configurations
  const physicalProducts = useMemo(() => {
    return products.filter((p) => p.type === 'physical' && p.stock !== null);
  }, [products]);

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
        priorityScore = 100 + threshold; // absolute emergency, scaled by threshold size
      } else if (stock <= threshold) {
        status = 'critical';
        priorityScore = 80 + (deficit / threshold) * 20; // deficit fraction gets weighted
      } else if (stock <= threshold * 1.5) {
        status = 'warning';
        priorityScore = 30 + (1.5 - ratio) * 40;
      } else {
        status = 'healthy';
        priorityScore = Math.max(0, 10 - ratio); // very low priority
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
        category: p.category,
        imageUrl: p.imageUrl,
        price: p.price
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

    // 2. Apply Safety Status Filter
    if (filterMode === 'low') {
      filtered = filtered.filter((item) => item.status === 'out' || item.status === 'critical');
    } else if (filterMode === 'warning') {
      filtered = filtered.filter((item) => item.status === 'warning');
    } else if (filterMode === 'healthy') {
      filtered = filtered.filter((item) => item.status === 'healthy');
    }

    // 3. Apply Sorting Option
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
  }, [physicalProducts, filterMode, sortMode, searchQuery]);

  // Handle Quick Restock Submission
  const handleQuickRestock = (productId: string, currentStock: number) => {
    const amountStr = restockAmounts[productId];
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) return;

    const newStock = currentStock + amount;
    onUpdateProductStock(productId, newStock);

    // Clear input & trigger temporary success toast animation
    setRestockAmounts((prev) => ({ ...prev, [productId]: '' }));
    setSuccessRestockId(productId);
    setTimeout(() => {
      setSuccessRestockId(null);
    }, 2500);
  };

  // Restock Recommendations List (Top 5 critical products that need replenishing)
  const topPriorityItems = useMemo(() => {
    return physicalProducts
      .map((p) => {
        const stock = p.stock ?? 0;
        const threshold = p.lowStockThreshold ?? 5;
        const deficit = threshold - stock;
        const ratio = threshold > 0 ? stock / threshold : 1;
        
        let priority: 'high' | 'medium' | 'low' = 'low';
        let priorityScore = 0;

        if (stock === 0) {
          priority = 'high';
          priorityScore = 100 + threshold;
        } else if (stock <= threshold) {
          priority = 'high';
          priorityScore = 80 + deficit;
        } else if (stock <= threshold * 1.5) {
          priority = 'medium';
          priorityScore = 40 + deficit;
        } else {
          priorityScore = 0;
        }

        return {
          product: p,
          stock,
          threshold,
          deficit,
          priority,
          priorityScore
        };
      })
      .filter((item) => item.priorityScore > 0)
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 5);
  }, [physicalProducts]);

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

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-2xs font-sans animate-in fade-in duration-300" id="stock-threshold-comparison-module">
      {/* Module Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-150">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-sm font-semibold text-gray-950 flex items-center gap-2">
            <Package className="h-4.5 w-4.5 text-indigo-600" />
            Stock Levels vs. Reorder Thresholds Analytical Bar Chart
          </h3>
          <p className="text-[11px] font-light text-gray-400">
            Compare active physical catalog stock counts against established minimum thresholds to prioritize replenishment workflows.
          </p>
        </div>

        {/* Quick status indicators ledger */}
        <div className="flex flex-wrap items-center gap-3 bg-gray-50/50 border border-gray-100 px-3.5 py-1.5 rounded-lg text-[10px] font-mono">
          <span className="text-gray-400 font-bold uppercase mr-1">Ledger:</span>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-gray-700">Out of Stock</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            <span className="text-gray-700">Critical Low</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-gray-700">Near Limit</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-gray-700">Secure</span>
          </div>
        </div>
      </div>

      {/* Grid containing Interactive Filters and Chart with Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Left Column: Controls (Span 1 on large screens) */}
        <div className="flex flex-col gap-4 bg-gray-50/30 border border-gray-100 p-4 rounded-xl xl:col-span-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wider font-mono border-b border-gray-200/60 pb-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-500" /> Chart Filters & Sort
          </div>

          {/* Search bar */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold font-mono text-gray-400 uppercase">Search Product / SKU</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Type name, sku, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white rounded-lg border border-gray-200 pl-8 pr-3 py-1.5 text-xs text-gray-900 placeholder:text-gray-405 outline-none transition focus:border-indigo-500 shadow-3xs"
                id="stock-chart-search"
              />
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
            </div>
          </div>

          {/* Safety Status Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold font-mono text-gray-400 uppercase">Fulfillment Safety Status</label>
            <div className="grid grid-cols-2 gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200">
              {(['all', 'low', 'warning', 'healthy'] as FilterType[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={`py-1 px-2 text-[10px] font-bold rounded transition-all capitalize cursor-pointer text-center ${
                    filterMode === mode
                      ? 'bg-white text-indigo-950 shadow-3xs font-extrabold'
                      : 'text-gray-550 hover:text-gray-900'
                  }`}
                >
                  {mode === 'low' ? 'Low/Out' : mode}
                </button>
              ))}
            </div>
          </div>

          {/* Sort Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold font-mono text-gray-400 uppercase">Sort Order</label>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortType)}
              className="w-full bg-white rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 font-medium outline-none transition focus:border-indigo-500 shadow-3xs cursor-pointer"
            >
              <option value="priority">🔥 Restock Priority</option>
              <option value="stock-asc">📉 Stock Level: Low to High</option>
              <option value="stock-desc">📈 Stock Level: High to Low</option>
              <option value="threshold-desc">🛡️ Threshold: High to Low</option>
              <option value="name-asc">🔤 Product Name: A to Z</option>
            </select>
          </div>

          {/* Quick Metrics Statistics Overview */}
          <div className="mt-2 p-3 bg-indigo-50/20 border border-indigo-100/50 rounded-lg text-xs font-sans">
            <span className="block text-[10px] font-extrabold text-indigo-900 uppercase tracking-wider mb-2 font-mono flex items-center gap-1">
              <Info className="h-3 w-3" /> Quick Stock Insights
            </span>
            <div className="space-y-1.5 text-[11px] leading-relaxed text-gray-600">
              <div className="flex justify-between">
                <span>Total Catalog Items:</span>
                <strong className="font-mono text-gray-900">{physicalProducts.length}</strong>
              </div>
              <div className="flex justify-between">
                <span>Active Low Stock Items:</span>
                <strong className="font-mono text-red-600">
                  {physicalProducts.filter(p => (p.stock ?? 0) <= (p.lowStockThreshold ?? 5)).length}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Deficit Units Needed:</span>
                <strong className="font-mono text-orange-600">
                  {physicalProducts.reduce((acc, p) => acc + Math.max(0, (p.lowStockThreshold ?? 5) - (p.stock ?? 0)), 0)}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Columns: Chart Visualization (Span 2) */}
        <div className="xl:col-span-2 flex flex-col gap-4 border border-gray-150 p-4 rounded-xl bg-gray-50/10 min-h-[380px]">
          <div className="flex justify-between items-center pb-2 border-b border-gray-100 text-xs">
            <span className="text-gray-500 font-medium">
              Displaying <strong className="font-bold text-indigo-950 font-mono">{processedData.length}</strong> physical items
            </span>
            {processedData.length > 0 && (
              <span className="text-[10px] text-gray-450 italic font-light">Hover bars to view full ledger details</span>
            )}
          </div>

          {processedData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
              <AlertTriangle className="h-10 w-10 text-amber-500 mb-3 animate-bounce" />
              <h4 className="text-sm font-bold text-gray-700">No Inventory Match Found</h4>
              <p className="text-xs max-w-xs mt-1 leading-normal">
                Adjust your active filters, clear the search parameters, or seed new physical products to display stock levels.
              </p>
              {(searchQuery || filterMode !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterMode('all');
                  }}
                  className="mt-3 text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg px-3 py-1 font-bold hover:bg-indigo-100 transition"
                >
                  Reset Active Filters
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
                        <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 p-3.5 rounded-xl shadow-md text-xs font-sans max-w-[240px] z-50">
                          <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-gray-100 dark:border-slate-800">
                            {d.imageUrl && (
                              <img src={d.imageUrl} alt={d.name} className="h-6 w-6 rounded object-cover border dark:border-slate-800" />
                            )}
                            <div className="min-w-0">
                              <span className="font-mono text-[9px] font-extrabold text-indigo-600 dark:text-indigo-400 block">{d.sku}</span>
                              <h5 className="font-bold text-gray-900 dark:text-white truncate leading-tight mt-0.5">{d.name}</h5>
                            </div>
                          </div>
                          
                          <div className="space-y-1.5 font-sans">
                            <div className="flex justify-between text-gray-500 dark:text-slate-400">
                              <span>Current Stock:</span>
                              <strong className={`font-mono ${d.stock <= d.threshold ? 'text-red-650 dark:text-red-400 font-bold' : 'text-gray-900 dark:text-slate-200'}`}>
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
                                <span className="font-mono text-red-600 dark:text-red-450 font-bold">Deficit (-{d.deficit})</span>
                              ) : (
                                <span className="font-mono text-emerald-600 dark:text-emerald-450 font-semibold">Secure (+{Math.abs(d.deficit)})</span>
                              )}
                            </div>
                            
                            <div className="pt-2 mt-1.5 border-t border-gray-100/80 dark:border-slate-850">
                              <span className="block text-[8px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-1 font-mono">Suggested Restock</span>
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
                    wrapperStyle={{ fontSize: 11, fontWeight: 500, color: '#374151' }}
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
        <div className="flex flex-col gap-4 border border-gray-150 p-4 rounded-xl bg-gray-50/15 xl:col-span-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wider font-mono border-b border-gray-200/60 pb-2">
            <Truck className="h-3.5 w-3.5 text-amber-500 shrink-0" /> Restock Dispatch Ledger
          </div>

          <p className="text-[10px] text-gray-500 leading-normal font-light">
            Below are products with the highest restock priority. Simulate restocking directly to instantly update the telemetry charts.
          </p>

          {topPriorityItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center border border-dashed border-gray-200 rounded-lg bg-white">
              <CheckCircle2 className="h-7 w-7 text-emerald-500 mb-2" />
              <span className="text-xs font-bold text-gray-800">Perfect Stock Health</span>
              <span className="text-[10px] text-gray-400 mt-1">
                Zero products are currently flagging restock or low stock warnings. All shelves are secure!
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5 flex-1 overflow-y-auto max-h-[300px] xl:max-h-none pr-1">
              {topPriorityItems.map((item) => {
                const isSuccess = successRestockId === item.product.id;
                const recQty = item.threshold * 3 - item.stock;
                const finalRecQty = recQty > 0 ? recQty : 15;

                return (
                  <div 
                    key={item.product.id} 
                    className={`rounded-lg border p-3 transition-all duration-300 relative bg-white ${
                      isSuccess 
                        ? 'border-emerald-300 bg-emerald-50/20 ring-1 ring-emerald-100' 
                        : item.priority === 'high' 
                        ? 'border-red-150 hover:border-red-250 shadow-3xs' 
                        : 'border-amber-150 hover:border-amber-250 shadow-3xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5 mb-1.5">
                      <div className="min-w-0">
                        <span className="font-mono text-[8px] font-extrabold text-gray-400 block tracking-wider uppercase leading-none">{item.product.sku}</span>
                        <h5 className="font-sans text-[11px] font-bold text-gray-900 truncate mt-1 leading-tight">{item.product.name}</h5>
                      </div>
                      <span className={`text-[8px] font-extrabold font-mono px-1.5 py-0.2 rounded shrink-0 uppercase tracking-wider ${
                        item.priority === 'high'
                          ? 'bg-red-50 text-red-650 border border-red-100'
                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {item.stock === 0 ? 'OUT OF STOCK' : `${item.priority} Priority`}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] mb-2.5 font-sans">
                      <div className="bg-gray-50 px-2 py-1 rounded">
                        <span className="text-gray-450 block text-[8px] uppercase tracking-wider font-mono">Current Stock</span>
                        <strong className={`font-mono text-xs ${item.stock === 0 ? 'text-red-600 font-extrabold' : 'text-gray-900'}`}>
                          {item.stock} / <span className="text-gray-400 font-normal text-[10px]">{item.threshold} threshold</span>
                        </strong>
                      </div>
                      <div className="bg-gray-50 px-2 py-1 rounded">
                        <span className="text-gray-450 block text-[8px] uppercase tracking-wider font-mono">Suggested Refill</span>
                        <strong className="font-mono text-xs text-indigo-700 font-extrabold">
                          +{finalRecQty} units
                        </strong>
                      </div>
                    </div>

                    {/* Inline Quick Action Panel */}
                    <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          placeholder={`Add (e.g. ${finalRecQty})`}
                          value={restockAmounts[item.product.id] || ''}
                          onChange={(e) => setRestockAmounts(prev => ({ ...prev, [item.product.id]: e.target.value }))}
                          className="w-full bg-white rounded border border-gray-200 px-1.5 py-1 text-[10px] outline-none focus:border-indigo-500 pr-4 font-mono font-bold"
                          id={`input-quick-restock-${item.product.id}`}
                        />
                        <span className="absolute right-1 top-1.5 text-[8px] font-mono text-gray-400 font-bold uppercase">Qty</span>
                      </div>
                      <button
                        onClick={() => handleQuickRestock(item.product.id, item.stock)}
                        disabled={!restockAmounts[item.product.id]}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded font-bold text-[10px] px-2.5 py-1.5 transition shrink-0 cursor-pointer flex items-center gap-1"
                        id={`btn-submit-quick-restock-${item.product.id}`}
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
                        <div className="bg-white px-2 py-1 rounded-md border border-emerald-100 shadow-xs flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-[9px] font-extrabold text-emerald-800 uppercase tracking-wider">Stock Telemetry Updated!</span>
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
