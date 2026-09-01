/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Product, Order } from '../types';
import {
  X,
  TrendingUp,
  Sliders,
  Sparkles,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Package,
  ArrowRight,
  Info,
  Layers,
  Truck,
  Plus,
  ArrowUpRight,
  ShoppingCart,
  Clock
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

interface SuggestRestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  orders: Order[];
  onUpdateProductStock: (id: string, newStock: number) => void;
}

type HorizonType = '7' | '14' | '30' | '90' | 'all';

export default function SuggestRestockModal({
  isOpen,
  onClose,
  product,
  orders,
  onUpdateProductStock
}: SuggestRestockModalProps) {
  if (!isOpen || !product) return null;

  // Horizon state
  const [horizon, setHorizon] = useState<HorizonType>('30');
  // Days of supply targets
  const [targetDaysOfSupply, setTargetDaysOfSupply] = useState<number>(30);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(7);
  // Custom manual entry of restock quantity
  const [manualQty, setManualQty] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // 1. Analyze historical order sales for the selected product
  const productSales = useMemo(() => {
    // Filter out cancelled orders
    const validOrders = orders.filter(
      (o) => o.status !== 'cancelled' && o.status !== 'pending-cancellation'
    );

    const sales: { orderId: string; customer: string; date: Date; dateStr: string; quantity: number }[] = [];

    validOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (item.productId === product.id) {
          sales.push({
            orderId: order.id,
            customer: order.customerName,
            date: new Date(order.date.replace(' ', 'T')),
            dateStr: order.date,
            quantity: item.quantity
          });
        }
      });
    });

    // Sort sales newest first
    return sales.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [orders, product.id]);

  // 2. Filter sales based on calculation horizon
  const filteredSales = useMemo(() => {
    if (horizon === 'all') return productSales;

    const daysLimit = parseInt(horizon, 10);
    const now = new Date('2026-07-09T11:53:15-07:00'); // Use system reference time
    const cutoffDate = new Date(now.getTime() - daysLimit * 24 * 60 * 60 * 1000);

    return productSales.filter((sale) => sale.date >= cutoffDate);
  }, [productSales, horizon]);

  // 3. Compute metrics
  const analysisMetrics = useMemo(() => {
    const totalUnitsSold = filteredSales.reduce((acc, s) => acc + s.quantity, 0);
    const totalOrdersCount = filteredSales.length;

    // Number of days in active calculation span
    let daysInPeriod = 30;
    if (horizon !== 'all') {
      daysInPeriod = parseInt(horizon, 10);
    } else {
      // Find range of all order sales
      if (productSales.length > 0) {
        const earliestDate = productSales[productSales.length - 1].date;
        const latestDate = new Date('2026-07-09T11:53:15-07:00');
        const diffTime = Math.abs(latestDate.getTime() - earliestDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        daysInPeriod = Math.max(1, diffDays);
      } else {
        daysInPeriod = 30; // default baseline fallback
      }
    }

    const averageDailyConsumption = totalUnitsSold / daysInPeriod;

    // Calculate Recommended Reorder Quantity
    // Reorder Quantity = (Daily consumption * (Target Days + Lead Time)) - Current Stock
    const currentStock = product.stock ?? 0;
    const safetyStockThreshold = product.lowStockThreshold ?? 5;
    
    const requiredBuffer = averageDailyConsumption * (targetDaysOfSupply + leadTimeDays);
    const rawRecommended = Math.ceil(requiredBuffer - currentStock);

    // If sales velocity is extremely low/zero, we recommend enough units to bring stock back up to low stock safety margin
    let recommendedQty = 0;
    let reasonCode: 'velocity' | 'baseline' | 'excess' = 'excess';

    if (rawRecommended > 0) {
      recommendedQty = rawRecommended;
      reasonCode = 'velocity';
    } else if (currentStock <= safetyStockThreshold) {
      // Fallback baseline suggestion if stock is low but sales are slow
      recommendedQty = Math.max(0, safetyStockThreshold * 2 - currentStock);
      reasonCode = 'baseline';
    } else {
      recommendedQty = 0;
      reasonCode = 'excess';
    }

    return {
      totalUnitsSold,
      totalOrdersCount,
      daysInPeriod,
      averageDailyConsumption,
      recommendedQty,
      reasonCode,
      requiredBuffer,
      currentStock,
      safetyStockThreshold
    };
  }, [filteredSales, horizon, productSales, product, targetDaysOfSupply, leadTimeDays]);

  // 4. Initialize manual input field whenever suggestion changes
  React.useEffect(() => {
    setManualQty(analysisMetrics.recommendedQty.toString());
  }, [analysisMetrics.recommendedQty]);

  // 5. Prepare Daily sales chart data for the past 14 days or chosen horizon
  const dailyChartData = useMemo(() => {
    // Generate an array of dates ending today (July 9, 2026)
    const dataPoints: { dateLabel: string; quantity: number }[] = [];
    const now = new Date('2026-07-09T11:53:15-07:00');
    
    // Determine how many days to plot (cap at 14 for visual clarity)
    const plotDays = horizon === '7' ? 7 : 14;

    for (let i = plotDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateString = d.toISOString().split('T')[0];
      
      // Sum sales for this day
      const dailyTotal = productSales
        .filter((sale) => sale.dateStr.startsWith(dateString))
        .reduce((sum, s) => sum + s.quantity, 0);

      const dayLabel = d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
      dataPoints.push({
        dateLabel: dayLabel,
        quantity: dailyTotal
      });
    }

    return dataPoints;
  }, [productSales, horizon]);

  // Handle Apply Restock
  const handleApplyRestock = () => {
    const qty = parseInt(manualQty, 10);
    if (isNaN(qty) || qty < 0) return;

    const currentStock = product.stock ?? 0;
    const newStock = currentStock + qty;

    onUpdateProductStock(product.id, newStock);
    setSuccessMsg(`Success! Restocked +${qty} units. New Stock: ${newStock} units.`);
    
    setTimeout(() => {
      setSuccessMsg('');
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans animate-fade-in">
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col scale-in">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-150 dark:border-gray-850 bg-gray-50/50 dark:bg-gray-900/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-650 dark:text-indigo-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                AI Stock Velocity & Suggest Restock
              </h3>
              <p className="text-[11px] font-light text-gray-400">
                Analyze past consumption speeds to optimize inventory buffers.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-900 transition cursor-pointer"
            id="btn-close-suggest-restock"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Modal Body Scroll Container */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          
          {/* Product Profile Panel */}
          <div className="bg-indigo-50/35 dark:bg-indigo-950/20 rounded-xl border border-indigo-100/50 dark:border-indigo-900/30 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="h-10 w-10 rounded-lg object-cover border border-gray-200 dark:border-gray-800 shrink-0" referrerPolicy="no-referrer" />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-850 flex items-center justify-center text-gray-400 shrink-0">
                  <Package className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                <span className="text-[9px] font-mono font-bold bg-indigo-100 dark:bg-indigo-900/55 text-indigo-750 dark:text-indigo-300 px-1.5 py-0.5 rounded uppercase">
                  SKU: {product.sku || product.id.slice(0, 8).toUpperCase()}
                </span>
                <h4 className="font-sans font-bold text-gray-900 dark:text-gray-100 text-xs truncate mt-1">{product.name}</h4>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono shrink-0">
              <div className="bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-150 dark:border-gray-850">
                <span className="text-[9px] text-gray-400 block uppercase font-sans">Current Stock</span>
                <strong className={`text-sm ${analysisMetrics.currentStock <= analysisMetrics.safetyStockThreshold ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-gray-900 dark:text-gray-100'}`}>
                  {analysisMetrics.currentStock} units
                </strong>
              </div>
              <div className="bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-150 dark:border-gray-850">
                <span className="text-[9px] text-gray-400 block uppercase font-sans">Low stock limit</span>
                <strong className="text-sm text-gray-700 dark:text-gray-300">
                  {analysisMetrics.safetyStockThreshold} units
                </strong>
              </div>
            </div>
          </div>

          {/* Interactive Parameters and Visual Results */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Col: Analysis Horizon & Buffer Sliders (Span 1) */}
            <div className="lg:col-span-1 flex flex-col gap-4.5 bg-gray-50/50 dark:bg-gray-900/10 border border-gray-150 dark:border-gray-850 p-5 rounded-xl">
              <span className="text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider block border-b border-gray-200/60 dark:border-gray-800 pb-2">
                Velocity Model Parameters
              </span>

              {/* Sales Horizon Picker */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Historical Sales Horizon
                </label>
                <div className="grid grid-cols-4 gap-1 bg-gray-100 dark:bg-gray-900 p-0.5 rounded-lg border border-gray-200 dark:border-gray-800">
                  {(['7', '14', '30', 'all'] as HorizonType[]).map((hOption) => (
                    <button
                      key={hOption}
                      type="button"
                      onClick={() => setHorizon(hOption)}
                      className={`py-1 text-[10px] font-bold rounded transition capitalize cursor-pointer text-center ${
                        horizon === hOption
                          ? 'bg-white dark:bg-gray-800 text-indigo-950 dark:text-indigo-400 shadow-3xs font-extrabold'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {hOption === 'all' ? 'Max' : `${hOption}d`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Days of Supply Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3 text-indigo-500" /> Target Inventory Duration</span>
                  <span className="font-mono text-indigo-650 dark:text-indigo-400">{targetDaysOfSupply} days</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="90"
                  step="5"
                  value={targetDaysOfSupply}
                  onChange={(e) => setTargetDaysOfSupply(Number(e.target.value))}
                  className="w-full accent-indigo-600 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[9px] text-gray-400 leading-tight italic">
                  Keep shelves stocked for {targetDaysOfSupply} days of sales.
                </span>
              </div>

              {/* Lead Time Days Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-amber-500" /> Supplier Lead Time</span>
                  <span className="font-mono text-amber-600">{leadTimeDays} days</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="1"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                  className="w-full accent-indigo-600 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[9px] text-gray-400 leading-tight italic">
                  Estimated duration for supplier cargo delivery: {leadTimeDays} days.
                </span>
              </div>
            </div>

            {/* Right Col: Bento Analytical Dash & Recommendation (Span 2) */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              
              {/* Top Row: Mini Analytics KPI Blocks */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50/50 dark:bg-gray-900/20 border border-gray-150 dark:border-gray-850 p-3 rounded-xl">
                  <span className="text-[9px] text-gray-400 uppercase tracking-wider block font-medium">Units Sold</span>
                  <strong className="text-sm font-mono font-bold text-gray-900 dark:text-gray-100 block mt-1">
                    {analysisMetrics.totalUnitsSold} units
                  </strong>
                  <span className="text-[8.5px] text-gray-450 mt-0.5 block leading-none">In last {analysisMetrics.daysInPeriod} days</span>
                </div>
                
                <div className="bg-gray-50/50 dark:bg-gray-900/20 border border-gray-150 dark:border-gray-850 p-3 rounded-xl">
                  <span className="text-[9px] text-gray-400 uppercase tracking-wider block font-medium">Orders Count</span>
                  <strong className="text-sm font-mono font-bold text-indigo-750 dark:text-indigo-400 block mt-1">
                    {analysisMetrics.totalOrdersCount} sales
                  </strong>
                  <span className="text-[8.5px] text-gray-450 mt-0.5 block leading-none">Non-cancelled orders</span>
                </div>

                <div className="bg-gray-50/50 dark:bg-gray-900/20 border border-gray-150 dark:border-gray-850 p-3 rounded-xl">
                  <span className="text-[9px] text-gray-400 uppercase tracking-wider block font-medium">Velocity (ADR)</span>
                  <strong className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 block mt-1">
                    {analysisMetrics.averageDailyConsumption.toFixed(3)}
                  </strong>
                  <span className="text-[8.5px] text-gray-450 mt-0.5 block leading-none">Units consumed / day</span>
                </div>
              </div>

              {/* Middle Row: Recommended Reorder Result Banner */}
              <div className="rounded-xl border border-indigo-150 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-slate-900 p-5 flex items-start gap-4 shadow-3xs">
                <div className="p-3 bg-indigo-600 text-white rounded-xl">
                  <Truck className="h-6 w-6" />
                </div>
                
                <div className="flex-1 min-w-0 font-sans">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-black font-mono text-indigo-600 dark:text-indigo-400 uppercase tracking-widest leading-none">
                      Analytical Recommendation
                    </span>
                    <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded border ${
                      analysisMetrics.reasonCode === 'velocity' 
                        ? 'bg-emerald-55/10 border-emerald-200 text-emerald-700 dark:text-emerald-400' 
                        : analysisMetrics.reasonCode === 'baseline'
                        ? 'bg-amber-55/10 border-amber-200 text-amber-700 dark:text-amber-400'
                        : 'bg-indigo-55/10 border-indigo-200 text-indigo-700 dark:text-indigo-400'
                    }`}>
                      {analysisMetrics.reasonCode === 'velocity' ? 'Velocity Demand' : analysisMetrics.reasonCode === 'baseline' ? 'Safety Stock Baseline' : 'Stock Secure'}
                    </span>
                  </div>

                  <h5 className="text-xl font-black text-gray-950 dark:text-white mt-2 font-mono flex items-baseline gap-1">
                    +{analysisMetrics.recommendedQty} <span className="text-xs text-gray-500 font-sans font-normal">units recommended</span>
                  </h5>

                  <p className="text-[11px] text-gray-550 dark:text-gray-400 font-normal leading-relaxed mt-1.5">
                    {analysisMetrics.reasonCode === 'velocity' ? (
                      `Based on an average daily consumption of ${analysisMetrics.averageDailyConsumption.toFixed(2)} units/day, you will require a minimum of ${Math.ceil(analysisMetrics.requiredBuffer)} units to sustain operations across the ${targetDaysOfSupply}-day safety limit & ${leadTimeDays}-day delivery delay.`
                    ) : analysisMetrics.reasonCode === 'baseline' ? (
                      `Sales are currently slow (average ${analysisMetrics.averageDailyConsumption.toFixed(2)} units/day), but because your stock (${analysisMetrics.currentStock}) is below the low threshold limit (${analysisMetrics.safetyStockThreshold}), we recommend a baseline reorder to secure physical shelf presence.`
                    ) : (
                      `Your current stock level of ${analysisMetrics.currentStock} units is fully sufficient to cover the requested safety supply duration. No urgent replenishment action is recommended at this time.`
                    )}
                  </p>
                </div>
              </div>

              {/* Past 14 Days Visual Sales Bar Chart */}
              {productSales.length > 0 && (
                <div className="border border-gray-150 dark:border-gray-850 rounded-xl p-4 bg-gray-50/10 dark:bg-gray-900/10 w-full min-w-0" style={{ width: '100%', height: 140, minWidth: 0, minHeight: 140 }}>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-2 font-mono">
                    Recent Sales Activity Bar-chart ({horizon === '7' ? '7' : '14'} Days)
                  </span>
                  <ResponsiveContainer width="100%" height={90} minWidth={0} minHeight={90} debounce={50}>
                    <BarChart data={dailyChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEEEEE" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 8, fill: '#9CA3AF' }} />
                      <YAxis tick={{ fontSize: 8, fill: '#9CA3AF' }} />
                      <Tooltip contentStyle={{ fontSize: 10, background: '#1F2937', color: '#FFF', border: 'none', borderRadius: '4px' }} />
                      <Bar dataKey="quantity" fill="#6366F1" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

            </div>
          </div>

          {/* Table: Historical Order Logs of this item */}
          <div className="border border-gray-150 dark:border-gray-850 rounded-xl bg-white dark:bg-gray-900/30 overflow-hidden">
            <div className="bg-gray-50/50 dark:bg-gray-900/40 px-4 py-2.5 border-b border-gray-150 dark:border-gray-850 flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-650 dark:text-gray-300 font-mono uppercase tracking-wider">
                Historical Order Log Ledger ({productSales.length} Total Sales)
              </span>
              <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold italic">Excludes cancelled transactions</span>
            </div>

            <div className="max-h-[160px] overflow-auto">
              {productSales.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-450 italic">
                  Zero sales transactions recorded for this product SKU yet.
                </div>
              ) : (
                <table className="w-full text-left text-xs text-gray-600 dark:text-gray-400 font-sans">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-850 text-gray-400 font-mono text-[9px] uppercase tracking-wider bg-gray-50/30 dark:bg-gray-950/20">
                      <th className="px-4 py-2">Order ID</th>
                      <th className="px-4 py-2">Customer</th>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2 text-right">Qty Purchased</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-850">
                    {productSales.map((sale, sIdx) => (
                      <tr key={`${sale.orderId}-${sIdx}`} className="hover:bg-gray-50/40 dark:hover:bg-gray-900/30">
                        <td className="px-4 py-2 font-mono text-gray-900 dark:text-gray-200 uppercase font-semibold">{sale.orderId}</td>
                        <td className="px-4 py-2 truncate max-w-[150px]">{sale.customer}</td>
                        <td className="px-4 py-2 font-mono text-[10px] text-gray-400">{sale.dateStr}</td>
                        <td className="px-4 py-2 font-mono text-right text-gray-900 dark:text-gray-200 font-bold">+{sale.quantity} units</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer / Action Controls */}
        <div className="p-5 border-t border-gray-150 dark:border-gray-850 bg-gray-50 dark:bg-gray-900/40 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex flex-col text-left">
              <span className="text-[9px] font-black font-mono text-gray-400 uppercase tracking-wider">Confirm Order Qty</span>
              <div className="relative mt-1.5">
                <input
                  type="number"
                  min="0"
                  value={manualQty}
                  onChange={(e) => setManualQty(Math.max(0, parseInt(e.target.value, 10) || 0).toString())}
                  className="w-32 h-9 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-center font-mono text-xs rounded-lg focus:ring-1 focus:ring-indigo-500 font-bold text-gray-850 dark:text-gray-200 outline-none"
                  id="input-suggest-restock-qty"
                />
                <span className="absolute right-2 top-2.5 text-[10px] text-gray-400 font-mono font-bold uppercase">Qty</span>
              </div>
            </div>
            
            <div className="flex flex-col text-left">
              <span className="text-[9px] font-black font-mono text-gray-400 uppercase tracking-wider">Estimated Cost</span>
              <span className="text-xs font-mono font-bold text-gray-650 dark:text-gray-300 mt-2">
                KSh {((product.costPrice ?? 0) * (parseInt(manualQty, 10) || 0)).toLocaleString('en-KE')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-250 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-850 text-gray-750 dark:text-gray-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyRestock}
              disabled={!manualQty || parseInt(manualQty, 10) === 0 || !!successMsg}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
              id="btn-apply-suggested-restock"
            >
              <CheckCircle2 className="h-4 w-4" /> Apply Suggested Restock
            </button>
          </div>

        </div>

        {/* Optional Success overlay toast */}
        {successMsg && (
          <div className="absolute inset-0 bg-emerald-550/15 backdrop-blur-[1px] flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-emerald-150 shadow-xl flex flex-col items-center gap-2 text-center max-w-xs animate-in zoom-in duration-200">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 animate-bounce" />
              <h5 className="text-xs font-extrabold text-emerald-900 dark:text-emerald-400 uppercase tracking-wider">Inventory Ledger updated!</h5>
              <p className="text-[11px] text-gray-550 dark:text-gray-400 font-medium leading-normal">
                {successMsg}
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
