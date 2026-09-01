/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Interactive D3.js Multi-series comparative chart displaying Sales Revenue & Order Volume Trends.
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import * as d3 from 'd3';
import { motion } from 'motion/react';
import { Order, Product } from '../types';
import { Activity, DollarSign, ShoppingBag, ArrowUpRight } from 'lucide-react';

interface ComparativeD3ChartProps {
  orders: Order[];
  days?: number;
  selectedCategory?: string | null;
  products?: Product[];
  darkMode?: boolean;
}

interface ChartDataNode {
  dateObj: Date;
  dateStr: string;
  label: string;
  salesRevenue: number;
  orderCount: number;
  unitsSold: number;
  movingAverageSales?: number;
}

export default function ComparativeD3Chart({
  orders,
  days = 30,
  selectedCategory = null,
  products = [],
  darkMode = false
}: ComparativeD3ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(750);
  const height = 280;

  const gridColor = darkMode ? '#1e293b' : '#f1f5f9';
  const axisColor = darkMode ? '#334155' : '#cbd5e1';
  const tickColor = darkMode ? '#94a3b8' : '#64748b';
  const rulerColor = darkMode ? '#475569' : '#cbd5e1';

  // Track hover states for interactive tooltips
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Toggle view for Moving Average Trendlines
  const [showTrendlines, setShowTrendlines] = useState<boolean>(true);

  // Dynamically observe dimension changes to be fully responsive
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Initial measure
    setWidth(containerRef.current.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setWidth(entry.contentRect.width);
        }
      }
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Product to Category Map for fast lookup
  const productCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach(p => map.set(p.id, p.category));
    return map;
  }, [products]);

  // Compile the time series dataset with adaptive moving average values
  const chartData = useMemo<ChartDataNode[]>(() => {
    const dataList: ChartDataNode[] = [];
    const now = new Date();
    
    const anchorDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(anchorDate);
      d.setDate(anchorDate.getDate() - i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dayVal = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dayVal}`;
      
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      let orderCount = 0;
      let salesRevenue = 0;
      let unitsSold = 0;

      orders.forEach((o) => {
        if (o.status === 'completed' || o.status === 'processing') {
          const oDateStr = o.date.split(' ')[0].split('T')[0];
          if (oDateStr === dateStr) {
            if (selectedCategory) {
              let categoryMatch = false;
              o.items.forEach((item) => {
                const prodCat = productCategoryMap.get(item.productId);
                if (prodCat === selectedCategory) {
                  salesRevenue += item.price * item.quantity;
                  unitsSold += item.quantity;
                  categoryMatch = true;
                }
              });
              if (categoryMatch) {
                orderCount++;
              }
            } else {
              salesRevenue += o.total;
              orderCount++;
              unitsSold += o.items.reduce((s, itm) => s + itm.quantity, 0);
            }
          }
        }
      });

      dataList.push({
        dateObj: d,
        dateStr,
        label,
        salesRevenue,
        orderCount,
        unitsSold
      });
    }

    // Adapt window size dynamically (K=3 for 7d, K=5 for 30d, K=7 for 90d)
    const windowSize = days === 7 ? 3 : days === 30 ? 5 : 7;
    for (let i = 0; i < dataList.length; i++) {
      const startIdx = Math.max(0, i - windowSize + 1);
      const count = i - startIdx + 1;

      let sumSales = 0;
      for (let j = startIdx; j <= i; j++) {
        sumSales += dataList[j].salesRevenue;
      }
      
      dataList[i].movingAverageSales = sumSales / count;
    }

    return dataList;
  }, [orders, days, selectedCategory, productCategoryMap]);

  // Dimensions & padding margins setup
  const margin = { top: 25, right: 35, bottom: 35, left: 55 };
  const innerWidth = Math.max(50, width - margin.left - margin.right);
  const innerHeight = Math.max(50, height - margin.top - margin.bottom);

  // Compute Scales
  const xScale = useMemo(() => {
    return d3.scaleTime()
      .domain(d3.extent(chartData, (d: ChartDataNode) => d.dateObj) as [Date, Date])
      .range([0, innerWidth]);
  }, [chartData, innerWidth]);

  const yScale = useMemo(() => {
    const maxVal = d3.max(chartData, (d: ChartDataNode) => d.salesRevenue) || 1000;
    return d3.scaleLinear()
      .domain([0, maxVal * 1.15])
      .range([innerHeight, 0]);
  }, [chartData, innerHeight]);

  // D3 Grid Ticks Selection
  const yAxisTicks = useMemo(() => yScale.ticks(6), [yScale]);
  const xAxisTicks = useMemo(() => xScale.ticks(6), [xScale]);

  // Curved Shape Path Generators
  const pathDataSales = useMemo(() => {
    const lineGenerator = d3.line<ChartDataNode>()
      .x(d => xScale(d.dateObj))
      .y(d => yScale(d.salesRevenue))
      .curve(d3.curveMonotoneX);
    return lineGenerator(chartData) || '';
  }, [chartData, xScale, yScale]);

  // Moving Average Path Generator
  const pathDataMovingAverage = useMemo(() => {
    const lineGenerator = d3.line<ChartDataNode>()
      .x(d => xScale(d.dateObj))
      .y(d => yScale(d.movingAverageSales || 0))
      .curve(d3.curveMonotoneX);
    return lineGenerator(chartData) || '';
  }, [chartData, xScale, yScale]);

  // Translucent Area wave
  const areaDataSales = useMemo(() => {
    const areaGenerator = d3.area<ChartDataNode>()
      .x(d => xScale(d.dateObj))
      .y0(innerHeight)
      .y1(d => yScale(d.salesRevenue))
      .curve(d3.curveMonotoneX);
    return areaGenerator(chartData) || '';
  }, [chartData, xScale, yScale, innerHeight]);

  // Total sums of active range
  const rangeTotals = useMemo(() => {
    return chartData.reduce(
      (acc, curr) => {
        acc.sales += curr.salesRevenue;
        acc.orders += curr.orderCount;
        acc.units += curr.unitsSold;
        return acc;
      },
      { sales: 0, orders: 0, units: 0 }
    );
  }, [chartData]);

  // Bisector to translate raw pointer event coordinates to closest date node
  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - rect.left - margin.left;
    if (mouseX < 0 || mouseX > innerWidth) return;

    const domainDate = xScale.invert(mouseX);
    const bisect = d3.bisector<ChartDataNode, Date>((d) => d.dateObj).center;
    const index = bisect(chartData, domainDate);
    
    if (index >= 0 && index < chartData.length) {
      setHoveredIndex(index);
    }
  };

  const activeNode = hoveredIndex !== null ? chartData[hoveredIndex] : null;

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Header Metric Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-1">
        {/* Sales Revenue card */}
        <div className="bg-indigo-50/20 border border-indigo-100/50 rounded-xl p-3.5 flex items-center justify-between text-left select-none">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 block animate-pulse"></span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">Gross Sales ({days}d)</span>
            </div>
            <strong className="text-xl font-black text-gray-950 font-sans block mt-1 tracking-tight">KSh {rangeTotals.sales.toLocaleString('en-KE')}</strong>
            <span className="text-[10px] text-indigo-700 block font-semibold mt-1 font-mono uppercase">{rangeTotals.orders} Direct orders completed</span>
          </div>
          <div className="rounded-lg bg-indigo-50 p-2.5 text-indigo-700">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>

        {/* Order Volume card */}
        <div className="bg-emerald-50/15 border border-emerald-100/30 rounded-xl p-3.5 flex items-center justify-between text-left select-none">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block animate-pulse"></span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">Units Sold ({days}d)</span>
            </div>
            <strong className="text-xl font-black text-gray-950 font-sans block mt-1 tracking-tight">{rangeTotals.units.toLocaleString()} Units</strong>
            <span className="text-[10px] text-emerald-700 block font-semibold mt-1 font-mono uppercase">{rangeTotals.orders} Orders processed</span>
          </div>
          <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700">
            <ShoppingBag className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Moving Average Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-gray-50/70 border border-gray-100 p-2.5 px-4 rounded-xl">
        <div className="flex items-center gap-1.5 font-medium text-gray-700">
          <Activity className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
          <span className="font-sans font-semibold text-gray-800">Sales Trendlines & Moving Average</span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input 
            type="checkbox" 
            checked={showTrendlines} 
            onChange={(e) => setShowTrendlines(e.target.checked)}
            className="w-3.5 h-3.5 accent-indigo-650 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-[11px] font-bold font-mono text-gray-600 uppercase tracking-wider">
            Display {days === 7 ? '3-Day' : days === 30 ? '5-Day' : '7-Day'} MA Trendlines
          </span>
        </label>
      </div>

      {/* SVG Container Framed Card */}
      <div ref={containerRef} className="relative w-full border border-gray-100 bg-white rounded-xl p-2 md:p-3 shadow-3xs">
        <svg 
          width={width} 
          height={height} 
          className="overflow-visible select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          

          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Horizontal Grid lines */}
            {yAxisTicks.map((tick, idx) => (
              <line
                key={`grid-y-${idx}`}
                x1={0}
                y1={yScale(tick)}
                x2={innerWidth}
                y2={yScale(tick)}
                stroke={gridColor}
                strokeWidth={1}
              />
            ))}

            {/* Area Chart wave */}
            {areaDataSales && (
              <path
                d={areaDataSales}
                fill="#4f46e5"
                fillOpacity={0.12}
                className="pointer-events-none transition-all duration-500 ease-in-out"
              />
            )}

            {/* Sales Line */}
            {pathDataSales && (
              <path
                d={pathDataSales}
                fill="none"
                stroke="#4f46e5"
                strokeWidth={2.5}
                strokeLinecap="round"
                className="pointer-events-none transition-all duration-500 ease-in-out"
              />
            )}

            {/* Moving Average line */}
            {showTrendlines && pathDataMovingAverage && (
              <path 
                d={pathDataMovingAverage} 
                fill="none" 
                stroke="#818cf8" 
                strokeWidth={2} 
                strokeDasharray="4,4" 
                strokeLinecap="round" 
                className="pointer-events-none opacity-80 transition-all duration-500 ease-in-out" 
              />
            )}

            {/* X-Axis Ticks & Labels */}
            {xAxisTicks.map((tickDate, idx) => {
              const xPos = xScale(tickDate);
              return (
                <g key={`x-tick-${idx}`} transform={`translate(${xPos}, ${innerHeight})`}>
                  <line y2={6} stroke={axisColor} />
                  <text
                    y={18}
                    textAnchor="middle"
                    fontSize={10}
                    fill={tickColor}
                    className="font-mono font-medium"
                  >
                    {d3.timeFormat('%b %d')(tickDate)}
                  </text>
                </g>
              );
            })}

            {/* Y-Axis Ticks & Labels */}
            {yAxisTicks.map((tickVal, idx) => {
              const yPos = yScale(tickVal);
              return (
                <g key={`y-tick-${idx}`} transform={`translate(0, ${yPos})`}>
                  <text
                    x={-8}
                    y={3}
                    textAnchor="end"
                    fontSize={9.5}
                    fill={tickColor}
                    className="font-mono font-medium"
                  >
                    {tickVal >= 1000 ? `${(tickVal / 1000).toFixed(0)}k` : tickVal}
                  </text>
                </g>
              );
            })}

            {/* Hover crosshair & points */}
            {activeNode && (
              <g className="pointer-events-none">
                <line
                  x1={xScale(activeNode.dateObj)}
                  y1={0}
                  x2={xScale(activeNode.dateObj)}
                  y2={innerHeight}
                  stroke={rulerColor}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />

                <circle
                  cx={xScale(activeNode.dateObj)}
                  cy={yScale(activeNode.salesRevenue)}
                  r={5}
                  fill="#4f46e5"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              </g>
            )}
          </g>
        </svg>

        {/* Hover Tooltip Card */}
        {activeNode && (
          <div 
            className="absolute top-4 right-4 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-xl text-xs border border-slate-700/80 z-20 pointer-events-none animate-in fade-in zoom-in-95 duration-150 min-w-[200px]"
          >
            <div className="font-bold text-slate-300 border-b border-slate-800 pb-1 mb-2 font-mono flex items-center justify-between">
              <span>{activeNode.label}</span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">Day Stats</span>
            </div>
            
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-indigo-300">
                <span className="flex items-center gap-1 font-medium">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
                  Gross Sales:
                </span>
                <span className="font-bold font-mono text-white">KSh {activeNode.salesRevenue.toLocaleString('en-KE')}</span>
              </div>

              <div className="flex items-center justify-between gap-3 text-emerald-300">
                <span className="flex items-center gap-1 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  Orders / Units:
                </span>
                <span className="font-bold font-mono text-white">{activeNode.orderCount} ord / {activeNode.unitsSold} units</span>
              </div>

              {showTrendlines && activeNode.movingAverageSales !== undefined && (
                <div className="pt-1 mt-1 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Rolling Avg:</span>
                  <span className="font-mono text-slate-200">KSh {Math.round(activeNode.movingAverageSales).toLocaleString('en-KE')}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
