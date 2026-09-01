/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Edit3,
  Search,
  Plus,
  Package,
  Layers,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Filter,
  ExternalLink,
  Copy,
  DollarSign,
  Tag,
  ArrowUpDown,
  FolderTree,
  Eye,
  Sliders,
  Boxes,
  List,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import { Product } from '../types';
import { formatPrice, CurrencyType } from '../lib/currency';
import { getProductDiscountInfo } from '../utils/productUtils';

interface ProductEditHubProps {
  products: Product[];
  categories: string[];
  currency?: CurrencyType;
  onSelectProductToEdit: (product: Product) => void;
  onCreateNewProduct: () => void;
  onDuplicateProduct?: (product: Product) => void;
  onViewProductOnSite?: (product: Product) => void;
}

export default function ProductEditHub({
  products,
  categories,
  currency = 'KSh',
  onSelectProductToEdit,
  onCreateNewProduct,
  onDuplicateProduct,
  onViewProductOnSite,
}: ProductEditHubProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'low-stock' | 'out-of-stock'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Draft' | 'Inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price-asc' | 'price-desc' | 'stock-asc' | 'stock-desc' | 'sku'>('name');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(15);

  // Stats calculation
  const totalCount = products.length;
  const activeCount = products.filter((p) => (p.status as any) !== 'Draft' && (p.status as any) !== 'Inactive').length;
  const lowStockCount = products.filter((p) => p.stock !== null && p.stock <= (p.lowStockThreshold || 5) && p.stock > 0).length;
  const outOfStockCount = products.filter((p) => p.stock !== null && p.stock <= 0).length;

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        !searchQuery.trim() ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (product.sku && product.sku.toLowerCase().includes(searchQuery.toLowerCase().trim())) ||
        (product.category && product.category.toLowerCase().includes(searchQuery.toLowerCase().trim())) ||
        (product.id && product.id.toLowerCase().includes(searchQuery.toLowerCase().trim()));

      const matchesCategory =
        selectedCategory === 'all' || product.category === selectedCategory;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'Active' && (product.status === 'Active' || !product.status)) ||
        product.status === statusFilter;

      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'in-stock' && (product.stock === null || product.stock > (product.lowStockThreshold || 5))) ||
        (stockFilter === 'low-stock' && product.stock !== null && product.stock <= (product.lowStockThreshold || 5) && product.stock > 0) ||
        (stockFilter === 'out-of-stock' && product.stock !== null && product.stock <= 0);

      return matchesSearch && matchesCategory && matchesStatus && matchesStock;
    }).sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'stock-asc') return (a.stock ?? 999) - (b.stock ?? 999);
      if (sortBy === 'stock-desc') return (b.stock ?? 0) - (a.stock ?? 0);
      if (sortBy === 'sku') return (a.sku || '').localeCompare(b.sku || '');
      return 0;
    });
  }, [products, searchQuery, selectedCategory, statusFilter, stockFilter, sortBy]);

  // Reset pagination on filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, stockFilter, statusFilter, sortBy, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const getStatusBadge = (status?: string) => {
    const st = status || 'Active';
    switch (st) {
      case 'Active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            ACTIVE
          </span>
        );
      case 'Draft':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            DRAFT
          </span>
        );
      case 'Inactive':
      case 'Archived':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
            {st.toUpperCase()}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {st.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-6 pb-16 font-sans text-gray-900 dark:text-white" id="product-specification-editor-hub">
      {/* 1. Standard Admin Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-850 pb-5">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 shadow-2xs">
            <Edit3 className="h-6 w-6" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                Product Specification Editor
              </h2>
              <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-mono text-[10px] font-bold rounded-md">
                SPECIFICATION MATRIX STUDIO
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-2xl">
              Inspect and configure detailed product decks (pricing, variants, inventory thresholds, media assets, SEO, and shipping specs) in an interactive table view.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            id="btn-create-new-product-hub"
            onClick={onCreateNewProduct}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Product</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs transition-all hover:border-indigo-200 dark:hover:border-indigo-800">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">Total Catalog</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Package className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black font-display text-gray-900 dark:text-white">
            {totalCount}
          </div>
          <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Total product specifications
          </div>
        </div>

        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs transition-all hover:border-emerald-200 dark:hover:border-emerald-800">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">Active Products</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black font-display text-emerald-600 dark:text-emerald-400">
            {activeCount}
          </div>
          <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Live on public storefront
          </div>
        </div>

        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs transition-all hover:border-amber-200 dark:hover:border-amber-800">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">Low Stock Alert</span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black font-display text-amber-600 dark:text-amber-400">
            {lowStockCount}
          </div>
          <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Items at or below threshold
          </div>
        </div>

        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs transition-all hover:border-rose-200 dark:hover:border-rose-800">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">Out of Stock</span>
            <span className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <Boxes className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black font-display text-rose-600 dark:text-rose-400">
            {outOfStockCount}
          </div>
          <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Depleted catalog inventory
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Toolbar */}
      <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full lg:w-96">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              id="input-search-product-editor"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, SKU, category, or ID..."
              className="h-10 w-full pl-10 pr-10 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:bg-white dark:focus:bg-gray-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Category Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-400 uppercase font-mono text-[10px]">Cat:</span>
              <select
                id="select-category-product-editor"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all cursor-pointer"
              >
                <option value="all">All Categories ({categories.length})</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Stock Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-400 uppercase font-mono text-[10px]">Stock:</span>
              <select
                id="select-stock-filter-editor"
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as any)}
                className="h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all cursor-pointer"
              >
                <option value="all">All Inventory</option>
                <option value="in-stock">In Stock</option>
                <option value="low-stock">Low Stock (≤ threshold)</option>
                <option value="out-of-stock">Out of Stock (0)</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-400 uppercase font-mono text-[10px]">Sort:</span>
              <select
                id="select-sort-product-editor"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all cursor-pointer"
              >
                <option value="name">Title (A-Z)</option>
                <option value="price-asc">Price (Low → High)</option>
                <option value="price-desc">Price (High → Low)</option>
                <option value="stock-asc">Stock (Low → High)</option>
                <option value="stock-desc">Stock (High → Low)</option>
                <option value="sku">SKU Code</option>
              </select>
            </div>

            {/* View Mode Switcher */}
            <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-800 p-0.5 bg-gray-50 dark:bg-gray-900">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
                title="Table List View"
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline text-[11px]">Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
                title="Cards Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline text-[11px]">Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Active Filter Status Row & Items Count */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-850/60 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-gray-900 dark:text-white">{filteredProducts.length}</strong> of {products.length} products
            </span>
            {(searchQuery || selectedCategory !== 'all' || stockFilter !== 'all' || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setStockFilter('all');
                  setStatusFilter('all');
                }}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer text-xs"
              >
                Reset Filters
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-400 font-mono uppercase">Status:</span>
            {(['all', 'Active', 'Draft'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Products Display (Table List Format or Grid Format) */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-12 text-center shadow-3xs">
          <Package className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">No products found</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search criteria or create a brand new product specification.
          </p>
          <button
            type="button"
            onClick={onCreateNewProduct}
            className="mt-4 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
          >
            <Plus className="h-4 w-4" /> Create Product Now
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE LIST FORMAT */
        <div className="overflow-hidden rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 shadow-3xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700 dark:text-gray-300">
              <thead className="bg-gray-50/80 dark:bg-gray-900/80 text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-850">
                <tr>
                  <th className="px-4 py-3.5">Product / Specification</th>
                  <th className="px-4 py-3.5">SKU & Category</th>
                  <th className="px-4 py-3.5">Price & Margin</th>
                  <th className="px-4 py-3.5">Inventory Stock</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Variants & Matrix</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-850/60">
                {paginatedProducts.map((product) => {
                  const { hasDiscount, originalPrice: originalPriceVal, discountPercent } = getProductDiscountInfo(product);

                  const isLowStock =
                    product.stock !== null &&
                    product.stock <= (product.lowStockThreshold || 5) &&
                    product.stock > 0;
                  const isOutOfStock = product.stock !== null && product.stock <= 0;

                  return (
                    <tr
                      key={product.id}
                      onClick={() => onSelectProductToEdit(product)}
                      className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors group"
                    >
                      {/* Product Thumbnail & Title */}
                      <td className="px-4 py-3.5 max-w-[280px]">
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-900 overflow-hidden shrink-0 border border-gray-200/80 dark:border-gray-800 shadow-3xs">
                            <img
                              src={product.imageUrl || product.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300'}
                              alt={product.name}
                              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-200"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                            {product.type && (
                              <span className="absolute bottom-0.5 left-0.5 px-1 py-0.2 rounded bg-black/75 text-white font-mono text-[7px] uppercase font-bold">
                                {product.type}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3
                              className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1 text-xs"
                              title={product.name}
                            >
                              {product.name}
                            </h3>
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-mono mt-0.5">
                              <span>ID: {product.id.slice(0, 10)}</span>
                              {product.brand && <span>• {product.brand}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* SKU & Category */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-mono font-bold border border-gray-200 dark:border-gray-700">
                            {product.sku || 'NO-SKU'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold border border-indigo-100 dark:border-indigo-900/40 truncate max-w-[130px]">
                            {product.category || 'Uncategorized'}
                          </span>
                        </div>
                      </td>

                      {/* Price & Discount */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-black text-gray-900 dark:text-white">
                              {formatPrice(product.price, currency)}
                            </span>
                            {discountPercent > 0 && (
                              <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-900/40 px-1 py-0.2 rounded font-mono">
                                -{discountPercent}%
                              </span>
                            )}
                          </div>
                          {hasDiscount && originalPriceVal && (
                            <span className="text-[10px] text-gray-400 line-through font-mono">
                              {formatPrice(originalPriceVal, currency)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Stock Inventory */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {product.stock === null ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-800/40">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                              UNLIMITED
                            </span>
                          ) : isOutOfStock ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              0 OUT OF STOCK
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              {product.stock} (LOW)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              {product.stock} IN STOCK
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        {getStatusBadge(product.status)}
                      </td>

                      {/* Variants & Matrix */}
                      <td className="px-4 py-3.5">
                        <span className="text-[11px] font-mono text-gray-600 dark:text-gray-300">
                          {product.variantMatrix && product.variantMatrix.length > 0 ? (
                            <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold border border-purple-200/60 dark:border-purple-800/40">
                              {product.variantMatrix.length} Matrix Types
                            </span>
                          ) : product.variations && product.variations.length > 0 ? (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold border border-blue-200/60 dark:border-blue-800/40">
                              {product.variations.length} Options
                            </span>
                          ) : (
                            <span className="text-gray-400">Standard</span>
                          )}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            id={`btn-edit-spec-${product.id}`}
                            onClick={() => onSelectProductToEdit(product)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-3xs cursor-pointer transition-all"
                            title="Edit Full Specification Deck"
                          >
                            <Edit3 className="h-3 w-3" />
                            <span>Edit Specs</span>
                          </button>

                          {onDuplicateProduct && (
                            <button
                              type="button"
                              id={`btn-duplicate-card-${product.id}`}
                              onClick={() => onDuplicateProduct(product)}
                              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                              title="Clone product specification"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {onViewProductOnSite && (
                            <button
                              type="button"
                              id={`btn-view-site-${product.id}`}
                              onClick={() => onViewProductOnSite(product)}
                              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                              title="Preview on storefront"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          <div className="px-4 py-3.5 border-t border-gray-100 dark:border-gray-850 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/50">
            <div className="flex items-center gap-2">
              <span>
                Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length} specifications
              </span>
              <span className="text-gray-300 dark:text-gray-700">|</span>
              <div className="flex items-center gap-1">
                <span>Per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-2 py-0.5 rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-semibold cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <span className="font-mono font-bold text-gray-800 dark:text-gray-200 px-2 text-xs">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer flex items-center gap-1"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedProducts.map((product) => {
            const { hasDiscount, originalPrice: originalPriceVal, discountPercent } = getProductDiscountInfo(product);

            const isLowStock =
              product.stock !== null &&
              product.stock <= (product.lowStockThreshold || 5) &&
              product.stock > 0;
            const isOutOfStock = product.stock !== null && product.stock <= 0;

            return (
              <div
                key={product.id}
                id={`card-product-edit-${product.id}`}
                className="bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-850 rounded-2xl p-4 sm:p-5 shadow-4xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Badges & Image Preview */}
                  <div className="flex items-start gap-3.5 mb-3.5">
                    <div className="relative w-20 h-20 rounded-xl bg-gray-100 dark:bg-gray-900 overflow-hidden shrink-0 border border-gray-200/80 dark:border-gray-800">
                      <img
                        src={product.imageUrl || product.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300'}
                        alt={product.name}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      {product.type && (
                        <span className="absolute bottom-1 left-1 px-1 py-0.2 rounded bg-black/70 text-white font-mono text-[8px] uppercase">
                          {product.type}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[10px] font-mono font-bold">
                          {product.sku || 'NO-SKU'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold truncate max-w-[120px]">
                          {product.category || 'Uncategorized'}
                        </span>
                        {getStatusBadge(product.status)}
                      </div>

                      <h3
                        onClick={() => onSelectProductToEdit(product)}
                        className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors"
                        title={product.name}
                      >
                        {product.name}
                      </h3>

                      {/* Pricing */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-sm font-black text-gray-900 dark:text-white">
                          {formatPrice(product.price, currency)}
                        </span>
                        {hasDiscount && originalPriceVal && (
                          <span className="text-xs text-gray-400 line-through">
                            {formatPrice(originalPriceVal, currency)}
                          </span>
                        )}
                        {discountPercent > 0 && (
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-1 rounded">
                            -{discountPercent}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stock & Attribute Highlights */}
                  <div className="grid grid-cols-2 gap-2 py-2.5 border-y border-gray-100 dark:border-gray-850 text-xs mb-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400 text-[11px]">Stock:</span>
                      {product.stock === null ? (
                        <span className="font-semibold text-gray-600 dark:text-gray-300 font-mono">Unlimited</span>
                      ) : isOutOfStock ? (
                        <span className="font-bold text-rose-600 font-mono flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> 0 (Out)
                        </span>
                      ) : isLowStock ? (
                        <span className="font-bold text-amber-600 font-mono flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {product.stock} (Low)
                        </span>
                      ) : (
                        <span className="font-bold text-emerald-600 font-mono">
                          {product.stock} units
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="text-gray-400 text-[11px]">Variants:</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300 font-mono">
                        {product.variantMatrix && product.variantMatrix.length > 0
                          ? `${product.variantMatrix.length} types`
                          : product.variations && product.variations.length > 0
                          ? `${product.variations.length} options`
                          : 'Standard'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    id={`btn-edit-spec-${product.id}`}
                    onClick={() => onSelectProductToEdit(product)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-4xs cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Edit Specification</span>
                  </button>

                  {onDuplicateProduct && (
                    <button
                      type="button"
                      id={`btn-duplicate-card-${product.id}`}
                      onClick={() => onDuplicateProduct(product)}
                      className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                      title="Clone as new draft"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {onViewProductOnSite && (
                    <button
                      type="button"
                      id={`btn-view-site-${product.id}`}
                      onClick={() => onViewProductOnSite(product)}
                      className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                      title="Preview on storefront"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
