/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line
} from 'recharts';
import { Order } from '../types';
import { 
  TrendingUp, 
  ShoppingBag, 
  DollarSign, 
  Layers, 
  Calendar, 
  ArrowUpRight, 
  Activity, 
  FileText 
} from 'lucide-react';

const cleanDecimals = (val: number | string, maxDecimals: number = 2): string => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return typeof val === 'string' ? val : '';
  const formatted = num.toFixed(maxDecimals);
  return formatted.replace(/\.0+$/, '').replace(/(\.\d*?[1-9])0+$/, '$1');
};

interface Monthly6MonthTrendsProps {
  orders: Order[];
}

export default function Monthly6MonthTrends({ orders }: Monthly6MonthTrendsProps) {
  const [statusFilter, setStatusFilter] = useState<'completed' | 'all'>('completed');
  const [volumeMetric, setVolumeMetric] = useState<'units' | 'orders'>('units');

  // Compute the last 6 months dynamically based on the current date
  const monthlyData = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dataset: {
      monthKey: string;
      monthLabel: string;
      revenue: number;
      unitsSold: number;
      orderCount: number;
    }[] = [];

    const today = new Date();
    
    // Generate 6 month slots ending in current month
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthLabel = `${monthNames[month]} ${year}`;

      dataset.push({
        monthKey,
        monthLabel,
        revenue: 0,
        unitsSold: 0,
        orderCount: 0,
      });
    }

    // Populate data based on existing orders
    orders.forEach((order) => {
      // Respect the completed or all status filter
      if (statusFilter === 'completed' && order.status !== 'completed') {
        return;
      }
      if (order.status === 'cancelled') {
        return; // Always exclude cancelled orders for health/revenue purposes
      }

      const orderDate = new Date(order.date);
      if (!isNaN(orderDate.getTime())) {
        const year = orderDate.getFullYear();
        const month = orderDate.getMonth();
        const key = `${year}-${String(month + 1).padStart(2, '0')}`;

        const datasetItem = dataset.find(item => item.monthKey === key);
        if (datasetItem) {
          datasetItem.revenue += order.total;
          datasetItem.orderCount += 1;
          
          // Sum up item quantities for volume
          const totalQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
          datasetItem.unitsSold += totalQty;
        }
      }
    });

    // Format numbers
    return dataset.map((item) => ({
      ...item,
      revenue: Number(item.revenue.toFixed(2)),
    }));
  }, [orders, statusFilter]);

  // Calculate high-level summary & MOM changes
  const summaryMetrics = useMemo(() => {
    let totalRevenue = 0;
    let totalUnitsSold = 0;
    let totalOrderCount = 0;

    monthlyData.forEach(d => {
      totalRevenue += d.revenue;
      totalUnitsSold += d.unitsSold;
      totalOrderCount += d.orderCount;
    });

    const averageOrderValue = totalOrderCount > 0 ? totalRevenue / totalOrderCount : 0;

    // Calculate month-over-month growth for the last month relative to the previous month
    let momRevenueGrowth = 0;
    let momVolumeGrowth = 0;

    if (monthlyData.length >= 2) {
      const currentMonth = monthlyData[monthlyData.length - 1];
      const previousMonth = monthlyData[monthlyData.length - 2];

      if (previousMonth.revenue > 0) {
        momRevenueGrowth = ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue) * 100;
      } else if (currentMonth.revenue > 0) {
        momRevenueGrowth = 100; // 100% growth if starting from 0
      }

      const prevVolume = volumeMetric === 'units' ? previousMonth.unitsSold : previousMonth.orderCount;
      const currVolume = volumeMetric === 'units' ? currentMonth.unitsSold : currentMonth.orderCount;

      if (prevVolume > 0) {
        momVolumeGrowth = ((currVolume - prevVolume) / prevVolume) * 100;
      } else if (currVolume > 0) {
        momVolumeGrowth = 100;
      }
    }

    return {
      totalRevenue,
      totalUnitsSold,
      totalOrderCount,
      averageOrderValue,
      momRevenueGrowth,
      momVolumeGrowth
    };
  }, [monthlyData, volumeMetric]);

  return (
    <div id="monthly-6month-trends-section" className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm mt-8 animate-in fade-in duration-200">
      
      {/* Header Block */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-150 pb-4 mb-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></span>
            <h3 className="font-display text-sm font-bold text-gray-950 flex items-center gap-1.5 font-sans uppercase tracking-wider">
              <Layers className="h-4 w-4 text-indigo-600" /> 6-Month Sales & Revenue Trend Matrix
            </h3>
          </div>
          <p className="text-[11px] font-light text-gray-400">
            Dynamically aggregates sales volume and cumulative revenues across the previous 6 calendar months.
          </p>
        </div>

        {/* Controller Toggles */}
        <div className="flex flex-wrap items-center gap-3.5 self-start lg:self-auto font-sans">
          {/* Order Status Filter */}
          <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-2.5 py-1 font-semibold rounded-md transition-all cursor-pointer ${
                statusFilter === 'completed'
                  ? 'bg-white text-indigo-950 shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Completed Only
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 font-semibold rounded-md transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-indigo-950 shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              All Paid/Pending
            </button>
          </div>

          {/* Volume Metric Selection */}
          <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
            <button
              onClick={() => setVolumeMetric('units')}
              className={`px-2.5 py-1 font-semibold rounded-md transition-all cursor-pointer ${
                volumeMetric === 'units'
                  ? 'bg-white text-indigo-950 shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              title="Show sum of item quantities"
            >
              Units Sold
            </button>
            <button
              onClick={() => setVolumeMetric('orders')}
              className={`px-2.5 py-1 font-semibold rounded-md transition-all cursor-pointer ${
                volumeMetric === 'orders'
                  ? 'bg-white text-indigo-950 shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              title="Show number of transactions"
            >
              Order Count
            </button>
          </div>
        </div>
      </div>

      {/* Grid of KPI Metrics and the Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Left Side: Summary Widget Column */}
        <div className="xl:col-span-1 flex flex-col gap-4">
          
          {/* Revenue Summary */}
          <div className="rounded-xl border border-gray-100 bg-indigo-50/10 p-4 relative overflow-hidden">
            <div className="absolute right-3 top-3 opacity-15">
              <DollarSign className="h-10 w-10 text-indigo-600" />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">6M Gross Revenue</span>
            <strong className="text-2xl font-black text-gray-900 block mt-1 tracking-tight">
              KSh {summaryMetrics.totalRevenue.toLocaleString('en-KE')}
            </strong>
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              {summaryMetrics.momRevenueGrowth >= 0 ? (
                <span className="font-bold text-emerald-600 flex items-center gap-0.5 font-mono">
                  +{cleanDecimals(summaryMetrics.momRevenueGrowth, 1)}% MoM
                </span>
              ) : (
                <span className="font-bold text-rose-600 flex items-center gap-0.5 font-mono">
                  {cleanDecimals(summaryMetrics.momRevenueGrowth, 1)}% MoM
                </span>
              )}
              <span className="text-gray-450 text-[10px] text-gray-400">last month delta</span>
            </div>
          </div>

          {/* Volume Summary */}
          <div className="rounded-xl border border-gray-100 bg-emerald-50/10 p-4 relative overflow-hidden">
            <div className="absolute right-3 top-3 opacity-15">
              <ShoppingBag className="h-10 w-10 text-emerald-600" />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
              {volumeMetric === 'units' ? 'Total Units Sold' : 'Total Transactions'}
            </span>
            <strong className="text-2xl font-black text-gray-900 block mt-1 tracking-tight">
              {volumeMetric === 'units' 
                ? summaryMetrics.totalUnitsSold.toLocaleString() 
                : summaryMetrics.totalOrderCount.toLocaleString()
              }
            </strong>
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              {summaryMetrics.momVolumeGrowth >= 0 ? (
                <span className="font-bold text-emerald-600 flex items-center gap-0.5 font-mono">
                  +{cleanDecimals(summaryMetrics.momVolumeGrowth, 1)}% MoM
                </span>
              ) : (
                <span className="font-bold text-rose-600 flex items-center gap-0.5 font-mono">
                  {cleanDecimals(summaryMetrics.momVolumeGrowth, 1)}% MoM
                </span>
              )}
              <span className="text-gray-450 text-[10px] text-gray-400">volume speed</span>
            </div>
          </div>

          {/* Average Order Value (AOV) */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 relative overflow-hidden">
            <div className="absolute right-3 top-3 opacity-15">
              <Activity className="h-10 w-10 text-gray-500" />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">Average Order Value (AOV)</span>
            <strong className="text-2xl font-black text-gray-900 block mt-1 tracking-tight">
              KSh {summaryMetrics.averageOrderValue.toLocaleString('en-KE')}
            </strong>
            <span className="block text-[9.5px] text-gray-400 mt-2 font-mono uppercase tracking-widest">
              6M Ledger Efficiency
            </span>
          </div>

        </div>

        {/* Right Side: Composite Chart */}
        <div className="xl:col-span-3 border border-gray-100 bg-slate-50/5 rounded-xl p-4 flex flex-col">
          
          <div className="w-full h-[300px] min-w-0" style={{ width: '100%', height: 300, minWidth: 0, minHeight: 300 }}>
            <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={300} debounce={50}>
              <ComposedChart
                data={monthlyData}
                margin={{ top: 15, right: 10, left: -10, bottom: 0 }}
              >
                

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                
                <XAxis 
                  dataKey="monthLabel" 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
                />

                {/* Left Y Axis for Revenue */}
                <YAxis 
                  yAxisId="left"
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => `KSh ${Number(val).toLocaleString('en-KE')}`}
                  tick={{ fill: '#4f46e5', fontSize: 10, fontFamily: 'monospace' }}
                  label={{ value: 'Revenue (KSh)', angle: -90, position: 'insideLeft', style: { fill: '#4f46e5', fontSize: 9, fontWeight: 'bold', fontFamily: 'monospace' }, offset: 0 }}
                />

                {/* Right Y Axis for Volume */}
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => `${val}`}
                  tick={{ fill: '#059669', fontSize: 10, fontFamily: 'monospace' }}
                  label={{ value: volumeMetric === 'units' ? 'Units Sold' : 'Order Count', angle: 90, position: 'insideRight', style: { fill: '#059669', fontSize: 9, fontWeight: 'bold', fontFamily: 'monospace' }, offset: 0 }}
                />

                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '0px',
                    fontSize: '11px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)'
                  }} 
                  labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}
                  formatter={(value: any, name: any) => {
                    if (name === 'revenue') return [`KSh ${Number(value).toLocaleString('en-KE')}`, 'Revenue (KSh)'];
                    if (name === 'volume') return [value, volumeMetric === 'units' ? 'Units Sold' : 'Orders Handled'];
                    return [value, name];
                  }}
                />

                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="circle"
                  formatter={(value) => {
                    if (value === 'revenue') return <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider mr-4">Revenues (KSh)</span>;
                    if (value === 'volume') return <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-wider">{volumeMetric === 'units' ? 'Units Sold' : 'Transactions'}</span>;
                    return value;
                  }}
                />

                {/* Revenue Area representation (Left Y-Axis) */}
                <Area 
                  yAxisId="left"
                  name="revenue"
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#4f46e5" 
                  strokeWidth={2.5}
                  fill="#4f46e5" 
                  fillOpacity={0.12} 
                />

                {/* Volume Bar representation (Right Y-Axis) */}
                <Bar 
                  yAxisId="right"
                  name="volume" 
                  dataKey={volumeMetric === 'units' ? 'unitsSold' : 'orderCount'} 
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={28}
                  fillOpacity={0.8}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

        </div>

      </div>

      {/* Bottom Summary Table */}
      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-150">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-150">
              <th className="p-3 font-semibold text-gray-700">Month Period</th>
              <th className="p-3 font-semibold text-gray-700 text-right">Gross Sales Revenue</th>
              <th className="p-3 font-semibold text-gray-700 text-right">Units Sold</th>
              <th className="p-3 font-semibold text-gray-700 text-right">Completed Transactions</th>
              <th className="p-3 font-semibold text-gray-700 text-right">Average Order Value (AOV)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {monthlyData.map((m) => {
              const aov = m.orderCount > 0 ? m.revenue / m.orderCount : 0;
              return (
                <tr key={m.monthKey} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-3 font-medium text-gray-900 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    {m.monthLabel}
                  </td>
                  <td className="p-3 font-mono font-bold text-indigo-650 text-right text-indigo-700">
                    KSh {m.revenue.toLocaleString('en-KE')}
                  </td>
                  <td className="p-3 font-mono text-gray-600 text-right">{m.unitsSold} units</td>
                  <td className="p-3 font-mono text-gray-600 text-right">{m.orderCount} tx</td>
                  <td className="p-3 font-mono text-emerald-700 font-semibold text-right">
                    KSh {aov.toLocaleString('en-KE')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
