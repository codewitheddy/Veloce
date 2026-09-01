/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ComposedChart
} from 'recharts';
import { Order, Product } from '../types';
import { TrendingUp, TrendingDown, ShoppingBag, BarChart3, Activity, Award, HelpCircle, ChevronDown, Check } from 'lucide-react';

interface RechartsAnalyticsProps {
  orders: Order[];
  days?: number;
  products?: Product[];
  dateRange?: { start: string; end: string } | null;
  darkMode?: boolean;
}

export default function RechartsAnalytics({
  orders,
  days = 30,
  products = [],
  dateRange = null,
  darkMode = false
}: RechartsAnalyticsProps) {
  const [activeChartTab, setActiveChartTab] = useState<'monthlyProfit' | 'revenueGrowth' | 'monthly'>('monthlyProfit');
  const [revenueGrowthDays, setRevenueGrowthDays] = useState<7 | 30 | 90>(30);
  const [isChartDropdownOpen, setIsChartDropdownOpen] = useState(false);
  const chartDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (chartDropdownRef.current && !chartDropdownRef.current.contains(e.target as Node)) {
        setIsChartDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  // Filter orders by date range if provided
  const filteredOrders = useMemo(() => {
    if (!dateRange) return orders;
    const start = new Date(dateRange.start).getTime();
    const end = new Date(dateRange.end).getTime();
    return orders.filter((o) => {
      const oDate = new Date(o.date).getTime();
      return !isNaN(oDate) && oDate >= start && oDate <= end;
    });
  }, [orders, dateRange]);

  // Product cost map for calculating margins
  const productCostMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      if (p.costPrice !== undefined && p.costPrice !== null) {
        map.set(p.id, Number(p.costPrice));
      }
    });
    return map;
  }, [products]);

  // 1. Daily Revenue Growth Dataset
  const dailyGrowthData = useMemo(() => {
    const daysCount = revenueGrowthDays;
    const result = [];
    const now = new Date();
    const anchorDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(anchorDate);
      d.setDate(anchorDate.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${day}`;
      const displayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      let orderRevenue = 0;
      let orderCount = 0;
      let unitsCount = 0;

      filteredOrders.forEach((o) => {
        if (o.status === 'completed' || o.status === 'processing') {
          const oDateStr = (o.date || '').split(' ')[0].split('T')[0];
          if (oDateStr === dateKey) {
            orderRevenue += o.total;
            orderCount++;
            unitsCount += o.items.reduce((s, itm) => s + itm.quantity, 0);
          }
        }
      });

      result.push({
        date: dateKey,
        dayLabel: displayLabel,
        revenue: Math.round(orderRevenue),
        orders: orderCount,
        units: unitsCount
      });
    }

    return result;
  }, [filteredOrders, revenueGrowthDays]);

  // 2. 6-Month Monthly Dataset
  const monthlyDataset = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const result = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const year = d.getFullYear();
      const monthLabel = `${months[mIdx]} ${year}`;
      const monthKey = `${year}-${String(mIdx + 1).padStart(2, '0')}`;

      let revenue = 0;
      let cogs = 0;
      let orderCount = 0;
      let itemsSold = 0;

      filteredOrders.forEach((o) => {
        if (o.status === 'completed' || o.status === 'processing') {
          const oDate = o.date || '';
          if (oDate.startsWith(monthKey)) {
            revenue += o.total;
            orderCount++;
            o.items.forEach((item) => {
              itemsSold += item.quantity;
              const cost = productCostMap.get(item.productId) ?? item.price * 0.55;
              cogs += cost * item.quantity;
            });
          }
        }
      });

      const netProfit = Math.max(0, revenue - cogs);

      result.push({
        month: monthLabel,
        monthKey,
        revenue: Math.round(revenue),
        cogs: Math.round(cogs),
        profit: Math.round(netProfit),
        orders: orderCount,
        itemsSold
      });
    }

    return result;
  }, [filteredOrders, productCostMap]);

  // Total Summary KPIs
  const totalStats = useMemo(() => {
    const totalRev = filteredOrders.reduce((sum, o) => (o.status === 'completed' || o.status === 'processing' ? sum + o.total : sum), 0);
    const totalOrders = filteredOrders.filter((o) => o.status === 'completed' || o.status === 'processing').length;
    const totalUnits = filteredOrders
      .filter((o) => o.status === 'completed' || o.status === 'processing')
      .reduce((sum, o) => sum + o.items.reduce((s, itm) => s + itm.quantity, 0), 0);

    const totalProfit = monthlyDataset.reduce((sum, m) => sum + m.profit, 0);

    return {
      totalRev,
      totalOrders,
      totalUnits,
      totalProfit
    };
  }, [filteredOrders, monthlyDataset]);

  return (
    <div className="space-y-6">
      {/* Visual Analytics Navigation & Overview Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg flex items-center gap-2">
              Performance Intelligence & Charts
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Interactive financial and sales volume visual analytics
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl self-start lg:self-auto overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveChartTab('monthlyProfit')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeChartTab === 'monthlyProfit'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            6-Month Profit Trends
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('revenueGrowth')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeChartTab === 'revenueGrowth'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Daily Revenue Growth
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('monthly')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeChartTab === 'monthly'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Monthly Order Volume
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
            Total Revenue
          </span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            KSh {totalStats.totalRev.toLocaleString('en-KE')}
          </p>
          <span className="text-xs text-emerald-600 font-semibold mt-1 inline-flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" /> Gross sales tracked
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
            Total Completed Orders
          </span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {totalStats.totalOrders} Orders
          </p>
          <span className="text-xs text-indigo-600 font-semibold mt-1 inline-flex items-center gap-1">
            <ShoppingBag className="h-3.5 w-3.5" /> {totalStats.totalUnits} Units fulfilled
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
            Est. 6-Month Gross Profit
          </span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            KSh {totalStats.totalProfit.toLocaleString('en-KE')}
          </p>
          <span className="text-xs text-slate-500 font-semibold mt-1 block">
            After COGS deduction
          </span>
        </div>
      </div>

      {/* Chart Canvas Card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {activeChartTab === 'monthlyProfit' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  6-Month Revenue vs Net Profit
                </h4>
                <p className="text-xs text-slate-500">
                  Monthly gross sales vs estimated net profits after cost of goods
                </p>
              </div>
            </div>

            <div className="h-[320px] w-full min-w-0" style={{ width: '100%', height: 320, minWidth: 0, minHeight: 320 }}>
              <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={320} debounce={50}>
                <BarChart data={monthlyDataset} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#f1f5f9'} />
                  <XAxis dataKey="month" stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={11} />
                  <YAxis stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickFormatter={(v) => `KSh ${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                      borderColor: darkMode ? '#334155' : '#e2e8f0',
                      borderRadius: '0.75rem',
                      fontSize: '12px'
                    }}
                    formatter={(value: any) => [`KSh ${Number(value).toLocaleString('en-KE')}`, '']}
                  />
                  <Legend />
                  <Bar dataKey="revenue" name="Gross Revenue" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="profit" name="Net Profit" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeChartTab === 'revenueGrowth' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Daily Revenue & Sales Trend
                </h4>
                <p className="text-xs text-slate-500">
                  Rolling daily sales over the selected timeframe
                </p>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-start sm:self-auto">
                {([7, 30, 90] as const).map((daysVal) => (
                  <button
                    key={daysVal}
                    type="button"
                    onClick={() => setRevenueGrowthDays(daysVal)}
                    className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-md transition-all cursor-pointer ${
                      revenueGrowthDays === daysVal
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {daysVal}d
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[320px] w-full min-w-0" style={{ width: '100%', height: 320, minWidth: 0, minHeight: 320 }}>
              <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={320} debounce={50}>
                <AreaChart data={dailyGrowthData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#f1f5f9'} />
                  <XAxis dataKey="dayLabel" stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={11} />
                  <YAxis stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={11} tickFormatter={(v) => `KSh ${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                      borderColor: darkMode ? '#334155' : '#e2e8f0',
                      borderRadius: '0.75rem',
                      fontSize: '12px'
                    }}
                    formatter={(value: any, name: any) => [
                      name === 'revenue' ? `KSh ${Number(value).toLocaleString('en-KE')}` : value,
                      name === 'revenue' ? 'Sales Revenue' : 'Orders'
                    ]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2.5} fill="#4f46e5" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeChartTab === 'monthly' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Monthly Order Count & Units Sold
                </h4>
                <p className="text-xs text-slate-500">
                  Volume comparison across the last 6 months
                </p>
              </div>
            </div>

            <div className="h-[320px] w-full min-w-0" style={{ width: '100%', height: 320, minWidth: 0, minHeight: 320 }}>
              <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={320} debounce={50}>
                <ComposedChart data={monthlyDataset} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#f1f5f9'} />
                  <XAxis dataKey="month" stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={11} />
                  <YAxis stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                      borderColor: darkMode ? '#334155' : '#e2e8f0',
                      borderRadius: '0.75rem',
                      fontSize: '12px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="orders" name="Total Orders" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  <Line type="monotone" dataKey="itemsSold" name="Units Sold" stroke="#f59e0b" strokeWidth={2.5} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
