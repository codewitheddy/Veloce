/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Product, Order } from '../types';
import { DollarSign, ShoppingBag, Users, Package, AlertTriangle } from 'lucide-react';
import { formatPrice } from '../lib/currency';

interface SimplifiedAnalyticsProps {
  products: Product[];
  orders: Order[];
  darkMode?: boolean;
}

export default function SimplifiedAnalytics({
  products,
  orders,
  darkMode = false,
}: SimplifiedAnalyticsProps) {
  // Calculate basic metrics
  const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  const totalOrders = orders.length;
  const paidOrders = orders.filter(o => o.paymentStatus === 'paid').length;
  const totalProducts = products.length;
  const outOfStockProducts = products.filter(p => p.stock === 0).length;
  const lowStockProducts = products.filter(p => p.stock && p.stock > 0 && p.stock <= (p.lowStockThreshold || 5)).length;

  // Calculate average order value
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const StatCard = ({ 
    icon: Icon, 
    label, 
    value, 
    unit = '', 
    color = 'indigo',
    warning = false 
  }: { 
    icon: any;
    label: string; 
    value: string | number; 
    unit?: string;
    color?: string;
    warning?: boolean;
  }) => {
    const colorClasses = {
      indigo: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400',
      emerald: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400',
      blue: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400',
      amber: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400',
      rose: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400',
    };

    return (
      <div className={`rounded-xl border p-6 bg-white dark:bg-gray-900 ${warning ? 'border-red-200 dark:border-red-800' : 'border-gray-200 dark:border-gray-800'}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{label}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
              {unit && <span className="text-sm text-gray-500 dark:text-gray-400">{unit}</span>}
            </div>
          </div>
          <div className={`rounded-lg p-3 border ${warning ? 'bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-800 text-red-600 dark:text-red-400' : colorClasses[color as keyof typeof colorClasses]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Alert for out of stock products */}
      {outOfStockProducts > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-red-900 dark:text-red-100">
                {outOfStockProducts} {outOfStockProducts === 1 ? 'Product' : 'Products'} Out of Stock
              </h3>
              <p className="text-xs text-red-800 dark:text-red-200 mt-1">
                {lowStockProducts} additional {lowStockProducts === 1 ? 'product' : 'products'} are running low on inventory.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value={formatPrice(totalRevenue)}
          color="emerald"
        />
        <StatCard
          icon={ShoppingBag}
          label="Total Orders"
          value={totalOrders}
          unit={`${paidOrders} paid`}
          color="blue"
        />
        <StatCard
          icon={Package}
          label="Products in Catalog"
          value={totalProducts}
          unit={`${outOfStockProducts} out of stock`}
          color="indigo"
        />
        <StatCard
          icon={Users}
          label="Avg Order Value"
          value={formatPrice(averageOrderValue)}
          color="amber"
        />
      </div>

      {/* Orders Summary */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Orders Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{totalOrders}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Total Orders</div>
          </div>
          <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{paidOrders}</div>
            <div className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">Paid Orders</div>
          </div>
          <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{totalOrders - paidOrders}</div>
            <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">Pending Payment</div>
          </div>
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatPrice(totalRevenue / (totalOrders || 1))}</div>
            <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">Avg Order Value</div>
          </div>
        </div>
      </div>

      {/* Inventory Summary */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Inventory Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Products</span>
            <span className="font-bold text-gray-900 dark:text-white">{totalProducts}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">In Stock</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-300">{totalProducts - outOfStockProducts}</span>
          </div>
          {lowStockProducts > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800">
              <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Low Stock</span>
              <span className="font-bold text-yellow-700 dark:text-yellow-300">{lowStockProducts}</span>
            </div>
          )}
          {outOfStockProducts > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800">
              <span className="text-sm font-medium text-red-700 dark:text-red-300">Out of Stock</span>
              <span className="font-bold text-red-700 dark:text-red-300">{outOfStockProducts}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
