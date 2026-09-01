/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sparkles, TrendingUp, Wallet, ArrowUpRight, Award } from 'lucide-react';
import { Order } from '../types';

export interface SpendingChartProps {
  orders: Order[];
}

export default function SpendingChart({ orders }: SpendingChartProps) {
  const [chartMode, setChartMode] = useState<'cumulative' | 'daily'>('cumulative');
  const [timeFilter, setTimeFilter] = useState<'all' | 'week' | 'month' | 'quarter'>('all');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Safely evaluate reference/baseline date for chronological filtering.
  // We use the most recent order date as the target reference point, or today, whichever is newer.
  // This makes sure mock / historical datasets still render perfectly when filtering by week or month.
  const getBaselineDate = () => {
    if (orders.length === 0) return new Date();
    try {
      const orderDates = orders.map(o => new Date(o.date).getTime()).filter(t => !isNaN(t));
      if (orderDates.length === 0) return new Date();
      const maxOrderTime = Math.max(...orderDates);
      const now = new Date().getTime();
      return new Date(Math.max(now, maxOrderTime));
    } catch {
      return new Date();
    }
  };

  const baselineDate = getBaselineDate();

  // Filter orders by temporal selection
  const filteredOrders = orders.filter((order) => {
    if (timeFilter === 'all') return true;
    try {
      const orderDate = new Date(order.date);
      if (isNaN(orderDate.getTime())) return true;
      const diffTime = baselineDate.getTime() - orderDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      
      if (timeFilter === 'week') {
        return diffDays <= 7;
      } else if (timeFilter === 'month') {
        return diffDays <= 30;
      } else if (timeFilter === 'quarter') {
        return diffDays <= 90;
      }
    } catch {
      return true;
    }
    return true;
  });

  // Group and list spending sorted chronologically
  const spendingByDate = filteredOrders.reduce((acc: Record<string, number>, order) => {
    const dateStr = order.date;
    acc[dateStr] = (acc[dateStr] || 0) + order.total;
    return acc;
  }, {});

  const datesChronological = Object.keys(spendingByDate).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  let cumulative = 0;
  const chartData = datesChronological.map((date) => {
    const dailySpent = spendingByDate[date];
    cumulative += dailySpent;
    return {
      date,
      daily: dailySpent,
      cumulative: cumulative,
    };
  });

  // Calculate generic high-level stats for visual cards
  const totalSpend = filteredOrders.reduce((sum, o) => sum + o.total, 0);
  const averageSpent = filteredOrders.length > 0 ? totalSpend / filteredOrders.length : 0;
  const highestOrder = filteredOrders.reduce((max, o) => (o.total > max ? o.total : max), 0);

  // SVG dimensions & grid configuration
  const width = 600;
  const height = 210;
  const paddingLeft = 60;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 35;

  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  const maxVal = chartData.length > 0
    ? Math.max(...chartData.map((d) => (chartMode === 'cumulative' ? d.cumulative : d.daily)))
    : 100;
  const safeMax = maxVal === 0 ? 10 : maxVal * 1.15; // padding top space

  // Map each data point to local coordinate system
  const points = chartData.map((d, index) => {
    const val = chartMode === 'cumulative' ? d.cumulative : d.daily;
    const x = chartData.length === 1
      ? paddingLeft + innerWidth / 2
      : paddingLeft + (index / (chartData.length - 1)) * innerWidth;
    const y = paddingTop + innerHeight - (val / safeMax) * innerHeight;
    return { x, y, ...d };
  });

  const pointsStr = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPointsStr = chartData.length > 0
    ? `${points[0].x},${paddingTop + innerHeight} ${pointsStr} ${points[points.length - 1].x},${paddingTop + innerHeight}`
    : '';

  // Grid milestones (0%, 33%, 66%, 100% labels)
  const gridLevels = [0, 0.33, 0.66, 1.0];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (chartData.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const relativeX = (mouseX / rect.width) * width;

    if (chartData.length === 1) {
      setHoveredIdx(0);
      return;
    }

    const calculatedIdx = Math.round(
      ((relativeX - paddingLeft) / innerWidth) * (chartData.length - 1)
    );
    const safeIdx = Math.max(0, Math.min(chartData.length - 1, calculatedIdx));
    setHoveredIdx(safeIdx);
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Determine filtered list of coordinates for bottom axis (max 6 dates)
  const showDateLabels = points.filter((_, idx) => {
    if (points.length <= 6) return true;
    const step = Math.floor(points.length / 5);
    return idx % step === 0 || idx === points.length - 1;
  });

  return (
    <div className="rounded-md border border-gray-100 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-gray-100 pb-4 mb-5">
        <div>
          <span className="font-mono text-[9px] font-bold text-gray-400 tracking-widest uppercase">
            Proprietary Capital Progression
          </span>
          <h3 className="font-display text-sm font-semibold text-gray-900 mt-0.5">
            Spending Over Time Ledger
          </h3>
        </div>

        {/* Filter Toolbar controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Time Filter Option buttons */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold text-gray-400 uppercase font-mono tracking-widest mr-1 sm:inline hidden">Period:</span>
            <div className="flex bg-gray-50 border border-gray-150 p-1 rounded-md text-[10px] font-semibold">
              {(['all', 'week', 'month', 'quarter'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => {
                    setTimeFilter(period);
                    setHoveredIdx(null); // Reset hover focus indicator on filter shift
                  }}
                  className={`px-2.5 py-1 rounded transition-all cursor-pointer capitalize ${
                    timeFilter === period
                      ? 'bg-white text-gray-950 shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                      : 'text-gray-400 hover:text-gray-900'
                  }`}
                >
                  {period === 'all' ? 'All Time' : period}
                </button>
              ))}
            </div>
          </div>

          {/* Chart mode selection buttons */}
          <div className="flex bg-gray-50 border border-gray-150 p-1 rounded-md text-[10px] font-semibold w-fit">
            <button
              onClick={() => setChartMode('cumulative')}
              className={`px-3 py-1 rounded transition-all cursor-pointer ${
                chartMode === 'cumulative'
                  ? 'bg-white text-gray-950 shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                  : 'text-gray-400 hover:text-gray-900'
              }`}
            >
              Cumulative Total
            </button>
            <button
              onClick={() => setChartMode('daily')}
              className={`px-3 py-1 rounded transition-all cursor-pointer ${
                chartMode === 'daily'
                  ? 'bg-white text-gray-950 shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                  : 'text-gray-400 hover:text-gray-900'
              }`}
            >
              By Checkout Day
            </button>
          </div>
        </div>
      </div>

      {/* Grid Summary Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5 bg-[#F9FAFB] border border-gray-100 rounded-md p-3.5">
        <div>
          <span className="block text-[8px] font-extrabold text-gray-400 uppercase tracking-widest font-mono">
            Total Capital Transacted
          </span>
          <span className="block text-sm font-bold text-gray-950 font-mono mt-0.5">
            ${totalSpend.toFixed(2)}
          </span>
        </div>
        <div>
          <span className="block text-[8px] font-extrabold text-gray-400 uppercase tracking-widest font-mono">
            Average Order Value
          </span>
          <span className="block text-sm font-bold text-gray-950 font-mono mt-0.5">
            ${averageSpent.toFixed(2)}
          </span>
        </div>
        <div>
          <span className="block text-[8px] font-extrabold text-gray-400 uppercase tracking-widest font-mono">
            Highest Order Ticket
          </span>
          <span className="block text-sm font-bold text-gray-950 font-mono mt-0.5">
            ${highestOrder.toFixed(2)}
          </span>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="relative h-44 w-full flex flex-col justify-center items-center border border-dashed border-gray-200 rounded-md bg-gray-50/50">
          <Wallet className="h-6 w-6 text-gray-300 mb-2" />
          <p className="text-[11px] font-medium text-gray-500 font-mono">
            {orders.length === 0
              ? 'Secure tracking pending checkout completed'
              : `No purchases logged for this Period (${timeFilter})`}
          </p>
          <p className="text-[9px] text-gray-400 text-center font-mono mt-1 px-4 leading-relaxed max-w-xs">
            {orders.length === 0
              ? 'Once you acquire bespoke woodworks, design consultation spaces, or physical parts, the active spending progression will scale automatically.'
              : 'Try selecting a broader period or checkout additional products to visualize your spending progression.'}
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Main SVG Plot */}
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height={height}
            className="overflow-visible select-none"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            

            {/* Horizontal Grid lines with numbers */}
            {gridLevels.map((level, i) => {
              const yVal = paddingTop + innerHeight - level * innerHeight;
              const priceLabel = maxVal * level;
              return (
                <g key={i} className="opacity-60">
                  <line
                    x1={paddingLeft}
                    y1={yVal}
                    x2={width - paddingRight}
                    y2={yVal}
                    stroke="#F3F4F6"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={yVal + 3.5}
                    textAnchor="end"
                    className="fill-gray-400 font-mono text-[9px] font-bold"
                  >
                    ${priceLabel.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/* Path Fill Polygon */}
            {chartData.length > 0 && areaPointsStr && (
              <polygon points={areaPointsStr} fill="#4f46e5" fillOpacity={0.12} />
            )}

            {/* Main Segment Line */}
            {chartData.length > 0 && pointsStr && (
              <polyline
                points={pointsStr}
                fill="none"
                stroke="#111827"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Tracking coordinates dots */}
            {points.map((p, idx) => (
              <circle
                key={idx}
                cx={p.x}
                cy={p.y}
                r={hoveredIdx === idx ? '5' : '2.5'}
                fill={hoveredIdx === idx ? '#111827' : '#ffffff'}
                stroke="#111827"
                strokeWidth={hoveredIdx === idx ? '1' : '1.5'}
                className="transition-all duration-75"
              />
            ))}

            {/* Selected Hover focus node line */}
            {hoveredIdx !== null && points[hoveredIdx] && (
              <g>
                <line
                  x1={points[hoveredIdx].x}
                  y1={paddingTop}
                  x2={points[hoveredIdx].x}
                  y2={paddingTop + innerHeight}
                  stroke="#E5E7EB"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={points[hoveredIdx].x}
                  cy={points[hoveredIdx].y}
                  r="7"
                  fill="#111827"
                  fillOpacity="0.08"
                />
              </g>
            )}

            {/* X-Axis Horizontal Baseline */}
            <line
              x1={paddingLeft}
              y1={paddingTop + innerHeight}
              x2={width - paddingRight}
              y2={paddingTop + innerHeight}
              stroke="#D1D5DB"
              strokeWidth="1"
            />

            {/* Bottom dates labels */}
            {showDateLabels.map((p, idx) => (
              <text
                key={idx}
                x={p.x}
                y={paddingTop + innerHeight + 16}
                textAnchor="middle"
                className="fill-gray-400 font-mono text-[9px] font-bold"
              >
                {formatDateLabel(p.date)}
              </text>
            ))}
          </svg>

          {/* Floated Realtime Data Tooltip block */}
          {hoveredIdx !== null && points[hoveredIdx] && (
            <div
              className="absolute bg-gray-900 border border-gray-800 text-white px-3 py-2 rounded shadow-xl pointer-events-none transition-all duration-100 ease-out flex flex-col gap-0.5"
              style={{
                left: `${Math.max(
                  15,
                  Math.min(85, (points[hoveredIdx].x / width) * 100)
                )}%`,
                top: `${Math.max(10, ((points[hoveredIdx].y - 55) / height) * 100)}%`,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="font-mono text-[9px] font-bold text-gray-400 capitalize whitespace-nowrap">
                Calendar: {formatDateLabel(points[hoveredIdx].date)}
              </div>
              <div className="flex justify-between items-center gap-4 text-[10px] mt-0.5">
                <span className="text-gray-400 font-light text-[9px]">Purchased Day:</span>
                <span className="font-mono font-bold text-white text-[10px]">
                  ${points[hoveredIdx].daily.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center gap-4 text-[10px]">
                <span className="text-gray-400 font-light text-[9px]">Cumulative Sum:</span>
                <span className="font-mono font-bold text-emerald-400 text-[10px]">
                  ${points[hoveredIdx].cumulative.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
