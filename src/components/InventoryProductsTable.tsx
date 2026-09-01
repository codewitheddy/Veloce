/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Upload,
  Download,
  Edit2,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  AlertTriangle,
  Layers,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ArrowUpDown,
  Tag,
  Boxes,
  Minus,
  Sparkles,
  Percent,
  X
} from 'lucide-react';
import { Product, Order } from '../types';
import { CurrencyType, formatPrice } from '../lib/currency';

interface InventoryProductsTableProps {
  products: Product[];
  orders?: Order[];
  onAddProductClick: () => void;
  onEditProduct: (product: Product) => void;
  onDuplicateProduct?: (product: Product) => void;
  onDeleteProduct: (id: string, type?: 'proprietary' | 'affiliate', skipConfirm?: boolean) => void;
  onUpdateProductStock: (id: string, newStock: number) => void;
  onUpdateProductSku: (id: string, newSku: string) => void;
  onUpdateProductThreshold: (id: string, newThreshold: number) => void;
  onUpdateProductPrice?: (id: string, newPrice: number, previousPrice?: number | null) => void;
  onUpdateProductStatus?: (id: string, newStatus: 'Active' | 'Inactive' | 'Draft' | 'Archived') => void;
  onBulkUploadClick?: () => void;
  onExportCatalogCSV?: () => void;
  onBulkPriceStudioClick?: () => void;
  availableCategories?: string[];
  currency?: CurrencyType;
  darkMode?: boolean;
}

export default function InventoryProductsTable({
  products,
  orders = [],
  onAddProductClick,
  onEditProduct,
  onDuplicateProduct,
  onDeleteProduct,
  onUpdateProductStock,
  onUpdateProductSku,
  onUpdateProductThreshold,
  onUpdateProductPrice,
  onUpdateProductStatus,
  onBulkUploadClick,
  onExportCatalogCSV,
  onBulkPriceStudioClick,
  availableCategories = [],
  currency = 'KSh',
  darkMode = false,
}: InventoryProductsTableProps) {
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'all' | 'sku' | 'name'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'low_stock' | 'out_of_stock' | 'draft' | 'archived'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'physical' | 'digital' | 'service'>('all');
  const [sortField, setSortField] = useState<'name' | 'sku' | 'price' | 'stock' | 'category'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStockAction, setBulkStockAction] = useState<number>(10);
  const [bulkNotification, setBulkNotification] = useState<string | null>(null);

  // Inline Stock & SKU Editing Cache
  const [inlineStockValues, setInlineStockValues] = useState<Record<string, number>>({});
  const [inlineEditingSkuId, setInlineEditingSkuId] = useState<string | null>(null);
  const [inlineTempSku, setInlineTempSku] = useState('');
  const [copiedSkuId, setCopiedSkuId] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<Product | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Safe product list fallback
  const safeProducts = useMemo(() => (Array.isArray(products) ? products : []), [products]);

  // Categories computed
  const allCategories = useMemo(() => {
    const set = new Set<string>(availableCategories);
    safeProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [safeProducts, availableCategories]);

  // Counts for quick filter pills
  const counts = useMemo(() => {
    const total = safeProducts.length;
    const active = safeProducts.filter((p) => !p.status || p.status === 'Active').length;
    const lowStock = safeProducts.filter(
      (p) => p.type === 'physical' && p.stock !== null && p.stock !== undefined && p.stock > 0 && p.stock <= (p.lowStockThreshold ?? 5)
    ).length;
    const outOfStock = safeProducts.filter(
      (p) => p.type === 'physical' && (p.stock === null || p.stock === undefined || p.stock === 0)
    ).length;
    const draft = safeProducts.filter((p) => p.status === 'Draft' || p.status === 'Inactive').length;
    return { total, active, lowStock, outOfStock, draft };
  }, [safeProducts]);

  // Filtered and Sorted Products
  const filteredProducts = useMemo(() => {
    return safeProducts.filter((p) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (searchMode === 'sku') {
          if (!p.sku?.toLowerCase().includes(q)) return false;
        } else if (searchMode === 'name') {
          if (!p.name?.toLowerCase().includes(q)) return false;
        } else {
          const matchSku = p.sku?.toLowerCase().includes(q);
          const matchName = p.name?.toLowerCase().includes(q);
          const matchCategory = p.category?.toLowerCase().includes(q);
          const matchDesc = p.description?.toLowerCase().includes(q);
          if (!matchSku && !matchName && !matchCategory && !matchDesc) return false;
        }
      }

      // Status
      if (statusFilter === 'active') {
        if (p.status && p.status !== 'Active') return false;
      } else if (statusFilter === 'low_stock') {
        if (p.type !== 'physical' || (p.stock ?? 0) > (p.lowStockThreshold ?? 5) || (p.stock ?? 0) === 0) return false;
      } else if (statusFilter === 'out_of_stock') {
        if (p.type !== 'physical' || (p.stock ?? 0) > 0) return false;
      } else if (statusFilter === 'draft') {
        if (p.status !== 'Draft' && p.status !== 'Inactive') return false;
      } else if (statusFilter === 'archived') {
        if (p.status !== 'Archived') return false;
      }

      // Category
      if (categoryFilter !== 'all' && p.category !== categoryFilter) {
        return false;
      }

      // Type
      if (typeFilter !== 'all' && p.type !== typeFilter) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '');
      } else if (sortField === 'sku') {
        comparison = (a.sku || '').localeCompare(b.sku || '');
      } else if (sortField === 'price') {
        comparison = (a.price || 0) - (b.price || 0);
      } else if (sortField === 'stock') {
        const stockA = a.type === 'physical' ? (a.stock ?? 0) : 999999;
        const stockB = b.type === 'physical' ? (b.stock ?? 0) : 999999;
        comparison = stockA - stockB;
      } else if (sortField === 'category') {
        comparison = (a.category || '').localeCompare(b.category || '');
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [products, searchQuery, searchMode, statusFilter, categoryFilter, typeFilter, sortField, sortDirection]);

  // Paginated Slices
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  // Selection handlers
  const isAllSelected = paginatedProducts.length > 0 && paginatedProducts.every((p) => selectedIds.includes(p.id));
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      const pageIds = new Set(paginatedProducts.map((p) => p.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const combined = new Set([...selectedIds, ...paginatedProducts.map((p) => p.id)]);
      setSelectedIds(Array.from(combined));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  // Bulk Quick Actions
  const handleBulkStockDelta = (delta: number) => {
    if (selectedIds.length === 0) return;
    let count = 0;
    selectedIds.forEach((id) => {
      const prod = safeProducts.find((p) => p.id === id);
      if (prod && prod.type === 'physical') {
        const current = prod.stock ?? 0;
        const next = Math.max(0, current + delta);
        onUpdateProductStock(id, next);
        count++;
      }
    });
    setBulkNotification(`Updated stock by ${delta > 0 ? '+' : ''}${delta} for ${count} physical product(s).`);
    setTimeout(() => setBulkNotification(null), 3500);
  };

  const handleBulkStatusChange = (status: 'Active' | 'Inactive' | 'Draft' | 'Archived') => {
    if (selectedIds.length === 0 || !onUpdateProductStatus) return;
    selectedIds.forEach((id) => {
      onUpdateProductStatus(id, status);
    });
    setBulkNotification(`Set status to "${status}" for ${selectedIds.length} product(s).`);
    setTimeout(() => setBulkNotification(null), 3500);
  };

  const handleExecuteBulkDelete = () => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach((id) => {
      onDeleteProduct(id, 'proprietary', true);
    });
    setSelectedIds([]);
    setIsBulkDeleteModalOpen(false);
    setBulkNotification(`Deleted ${selectedIds.length} product(s) from inventory.`);
    setTimeout(() => setBulkNotification(null), 3500);
  };

  // Inline SKU editing
  const handleStartEditSku = (prod: Product) => {
    setInlineEditingSkuId(prod.id);
    setInlineTempSku(prod.sku || '');
  };

  const handleSaveInlineSku = (id: string) => {
    if (inlineTempSku.trim()) {
      onUpdateProductSku(id, inlineTempSku.trim().toUpperCase());
    }
    setInlineEditingSkuId(null);
  };

  const handleCopySku = (sku: string, id: string) => {
    if (!sku) return;
    navigator.clipboard?.writeText(sku);
    setCopiedSkuId(id);
    setTimeout(() => setCopiedSkuId(null), 2000);
  };

  // Stock stepper
  const handleQuickStockChange = (prod: Product, delta: number) => {
    if (prod.type !== 'physical') return;
    const current = prod.stock ?? 0;
    const next = Math.max(0, current + delta);
    onUpdateProductStock(prod.id, next);
  };

  const handleCustomStockSave = (prod: Product) => {
    const val = inlineStockValues[prod.id];
    if (val !== undefined && !isNaN(val)) {
      onUpdateProductStock(prod.id, Math.max(0, Math.floor(val)));
      setInlineStockValues((prev) => {
        const next = { ...prev };
        delete next[prod.id];
        return next;
      });
    }
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-2xs font-sans">
      {/* Header & Primary Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-bold text-gray-900 flex items-center gap-2">
              <Boxes className="h-5 w-5 text-indigo-600" /> Catalog Products & Inventory Ledger
            </h3>
            <span className="rounded-full bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <p className="text-xs text-gray-500 font-light mt-0.5">
            Manage real-time catalog items, monitor physical stock levels, update SKU mappings, and adjust pricing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onBulkUploadClick && (
            <button
              type="button"
              onClick={onBulkUploadClick}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-750 px-3.5 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              title="Upload products in bulk via CSV spreadsheet"
              id="btn-inventory-bulk-upload"
            >
              <Upload className="h-4 w-4 text-emerald-600" />
              <span>Import CSV</span>
            </button>
          )}

          {onExportCatalogCSV && (
            <button
              type="button"
              onClick={onExportCatalogCSV}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-750 px-3.5 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              title="Download entire catalog dataset as CSV"
              id="btn-inventory-export-csv"
            >
              <Download className="h-4 w-4 text-indigo-600" />
              <span>Export CSV</span>
            </button>
          )}

          {onBulkPriceStudioClick && (
            <button
              type="button"
              onClick={onBulkPriceStudioClick}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-800 dark:text-indigo-200 px-3.5 text-xs font-bold shadow-2xs transition-all cursor-pointer"
              title="Open Bulk Catalog Price Adjustment Studio"
              id="btn-inventory-bulk-price"
            >
              <Percent className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Bulk Price Studio</span>
            </button>
          )}

          <button
            type="button"
            onClick={onAddProductClick}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4 text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
            id="btn-inventory-add-product"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Quick Filter Status Tabs */}
      <div className="flex flex-wrap items-center gap-2 py-3 border-b border-gray-50">
        <button
          type="button"
          onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>All Products</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${statusFilter === 'all' ? 'bg-indigo-700 text-white' : 'bg-gray-200 text-gray-700'}`}>
            {counts.total}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('active'); setCurrentPage(1); }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            statusFilter === 'active'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Active</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${statusFilter === 'active' ? 'bg-emerald-700 text-white' : 'bg-emerald-200 text-emerald-900'}`}>
            {counts.active}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('low_stock'); setCurrentPage(1); }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            statusFilter === 'low_stock'
              ? 'bg-amber-500 text-white shadow-2xs'
              : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Low Stock Warning</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${statusFilter === 'low_stock' ? 'bg-amber-600 text-white' : 'bg-amber-200 text-amber-900'}`}>
            {counts.lowStock}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('out_of_stock'); setCurrentPage(1); }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            statusFilter === 'out_of_stock'
              ? 'bg-rose-600 text-white shadow-2xs'
              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
          }`}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Out of Stock</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${statusFilter === 'out_of_stock' ? 'bg-rose-700 text-white' : 'bg-rose-200 text-rose-900'}`}>
            {counts.outOfStock}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('draft'); setCurrentPage(1); }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            statusFilter === 'draft'
              ? 'bg-slate-700 text-white shadow-2xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <span>Draft / Inactive</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${statusFilter === 'draft' ? 'bg-slate-800 text-white' : 'bg-slate-300 text-slate-800'}`}>
            {counts.draft}
          </span>
        </button>
      </div>

      {/* Search & Secondary Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 py-3 items-center">
        {/* Search Bar */}
        <div className="lg:col-span-5 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Title, SKU, Category, or description..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-9 rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-8 text-xs font-semibold text-gray-850 focus:bg-white focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            id="input-inventory-search"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-hidden"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search Mode */}
        <div className="lg:col-span-2">
          <select
            value={searchMode}
            onChange={(e) => setSearchMode(e.target.value as any)}
            className="w-full h-9 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs font-semibold text-gray-700 focus:bg-white focus:border-indigo-500 focus:outline-hidden cursor-pointer"
            id="select-search-mode"
          >
            <option value="all">Search: All Fields</option>
            <option value="sku">Search: SKU Only</option>
            <option value="name">Search: Name Only</option>
          </select>
        </div>

        {/* Category Filter */}
        <div className="lg:col-span-3">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-9 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs font-semibold text-gray-700 focus:bg-white focus:border-indigo-500 focus:outline-hidden cursor-pointer"
            id="select-inventory-category-filter"
          >
            <option value="all">All Categories ({allCategories.length})</option>
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div className="lg:col-span-2">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="w-full h-9 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs font-semibold text-gray-700 focus:bg-white focus:border-indigo-500 focus:outline-hidden cursor-pointer"
            id="select-inventory-type-filter"
          >
            <option value="all">All Product Types</option>
            <option value="physical">Physical Items</option>
            <option value="digital">Digital Assets</option>
            <option value="service">Services / Custom</option>
          </select>
        </div>
      </div>

      {/* Notification Toast */}
      {bulkNotification && (
        <div className="mb-3 rounded-lg bg-indigo-50 border border-indigo-200 px-3.5 py-2 text-xs font-semibold text-indigo-900 flex items-center justify-between gap-2 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>{bulkNotification}</span>
          </div>
          <button
            type="button"
            onClick={() => setBulkNotification(null)}
            className="text-indigo-500 hover:text-indigo-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Multi-Selection Bulk Action Banner */}
      {selectedIds.length > 0 && (
        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
              {selectedIds.length}
            </span>
            <span className="text-xs font-bold text-indigo-950">
              Product{selectedIds.length > 1 ? 's' : ''} selected for bulk operation
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-[11px] text-indigo-700 hover:underline cursor-pointer ml-2"
            >
              Clear selection
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Bulk Stock Steppers */}
            <div className="flex items-center gap-1 bg-white border border-indigo-200 rounded-lg p-1">
              <span className="text-[10px] font-bold text-gray-500 px-1 uppercase font-mono">Stock:</span>
              <button
                type="button"
                onClick={() => handleBulkStockDelta(10)}
                className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-[11px] font-bold text-indigo-700 transition-colors cursor-pointer"
                title="Add 10 units to each selected physical product"
              >
                +10
              </button>
              <button
                type="button"
                onClick={() => handleBulkStockDelta(25)}
                className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-[11px] font-bold text-indigo-700 transition-colors cursor-pointer"
                title="Add 25 units to each selected physical product"
              >
                +25
              </button>
              <button
                type="button"
                onClick={() => handleBulkStockDelta(-10)}
                className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-[11px] font-bold text-indigo-700 transition-colors cursor-pointer"
                title="Subtract 10 units from each selected physical product"
              >
                -10
              </button>
            </div>

            {/* Quick Bulk Status */}
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkStatusChange(e.target.value as any);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="h-8 rounded-lg border border-indigo-200 bg-white px-2.5 text-xs font-bold text-indigo-900 focus:outline-none cursor-pointer"
            >
              <option value="" disabled>Set Status...</option>
              <option value="Active">Mark Active</option>
              <option value="Draft">Mark Draft</option>
              <option value="Inactive">Mark Inactive</option>
              <option value="Archived">Mark Archived</option>
            </select>

            {/* Bulk Delete */}
            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              title="Delete all selected products from the database"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Inventory Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-3xs">
        <table className="w-full text-left text-xs text-slate-800 dark:text-slate-100" id="table-inventory-products">
          <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] uppercase tracking-wider font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 font-mono">
            <tr>
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleToggleSelectAll}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  title="Select all on this page"
                />
              </th>
              <th
                onClick={() => handleSort('name')}
                className="p-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Product Details</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('sku')}
                className="p-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>SKU & Identifiers</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('category')}
                className="p-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Category</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('price')}
                className="p-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Price ({currency})</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('stock')}
                className="p-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Stock & Inventory</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {paginatedProducts.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-12 text-center text-slate-700 dark:text-slate-300">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Package className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">No products found</span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm font-medium">
                      {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' || typeFilter !== 'all'
                        ? 'No products matched your active filters. Try clearing your filters or search terms.'
                        : 'Your inventory catalog is currently empty. Click "Add New Product" to register your first item.'}
                    </p>
                    {(searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' || typeFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setStatusFilter('all');
                          setCategoryFilter('all');
                          setTypeFilter('all');
                        }}
                        className="mt-2 inline-flex items-center gap-1 rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="h-3 w-3" /> Reset all filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedProducts.map((product) => {
                const isSelected = selectedIds.includes(product.id);
                const isEditingSku = inlineEditingSkuId === product.id;
                const isCopied = copiedSkuId === product.id;
                const isPhysical = product.type === 'physical';
                const currentStock = product.stock ?? 0;
                const threshold = product.lowStockThreshold ?? 5;
                const isLowStock = isPhysical && currentStock > 0 && currentStock <= threshold;
                const isOutOfStock = isPhysical && currentStock === 0;

                const customStockInputVal = inlineStockValues[product.id];

                return (
                  <tr
                    key={product.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      isSelected ? 'bg-indigo-50/30' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectOne(product.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>

                    {/* Product Details */}
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-lg bg-gray-100 border border-gray-200 flex-shrink-0 overflow-hidden relative">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="h-full w-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-gray-400">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-900 dark:text-slate-100 line-clamp-1 text-xs">
                            {product.name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider font-mono ${
                                product.type === 'physical'
                                  ? 'bg-slate-150 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                                  : product.type === 'digital'
                                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                  : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              }`}
                            >
                              {product.type || 'physical'}
                            </span>
                            {product.brand && (
                              <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium truncate max-w-[100px]">
                                {product.brand}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* SKU & Identifiers */}
                    <td className="p-3">
                      {isEditingSku ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={inlineTempSku}
                            onChange={(e) => setInlineTempSku(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveInlineSku(product.id);
                              if (e.key === 'Escape') setInlineEditingSkuId(null);
                            }}
                            className="h-7 w-28 rounded border border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-1.5 text-xs font-mono font-bold uppercase focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveInlineSku(product.id)}
                            className="p-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                            title="Save SKU"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setInlineEditingSkuId(null)}
                            className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer"
                            title="Cancel"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 group">
                          <span
                            onClick={() => handleCopySku(product.sku, product.id)}
                            className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
                            title="Click to copy SKU"
                          >
                            {product.sku || 'NO-SKU'}
                            {isCopied ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3 text-slate-400 group-hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStartEditSku(product)}
                            className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="Quick edit SKU"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Category */}
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 text-[11px] font-bold text-slate-800 dark:text-slate-200">
                        <Tag className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                        {product.category || 'General'}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 dark:text-white font-display text-xs">
                          {currency} {(product.price || 0).toLocaleString('en-KE')}
                        </span>
                        {product.originalPrice && product.originalPrice > product.price && (
                          <span className="text-[10px] text-slate-500 font-mono line-through">
                            {currency} {product.originalPrice.toLocaleString('en-KE')}
                          </span>
                        )}
                        {product.costPrice !== undefined && product.costPrice > 0 && (
                          <span className="text-[9px] text-slate-600 dark:text-slate-400 font-mono font-semibold">
                            Cost: {currency} {product.costPrice.toLocaleString('en-KE')}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Stock & Quick Controls */}
                    <td className="p-3">
                      {isPhysical ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                                isOutOfStock
                                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                                  : isLowStock
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 animate-pulse'
                                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  isOutOfStock ? 'bg-rose-600' : isLowStock ? 'bg-amber-600' : 'bg-emerald-600'
                                }`}
                              />
                              {currentStock} in stock
                            </span>
                            <span className="text-[9px] text-slate-600 dark:text-slate-400 font-mono font-bold">
                              (Min: {threshold})
                            </span>
                          </div>

                          {/* Quick Inline Steppers */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleQuickStockChange(product, -1)}
                              disabled={currentStock <= 0}
                              className="h-6 w-6 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-gray-600 transition-colors cursor-pointer"
                              title="Decrease stock by 1"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickStockChange(product, 1)}
                              className="h-6 w-6 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors cursor-pointer"
                              title="Increase stock by 1"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickStockChange(product, 10)}
                              className="h-6 px-1.5 rounded border border-gray-200 bg-indigo-50/60 hover:bg-indigo-100 text-[10px] font-bold text-indigo-700 transition-colors cursor-pointer"
                              title="Add +10 units"
                            >
                              +10
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickStockChange(product, 25)}
                              className="h-6 px-1.5 rounded border border-gray-200 bg-indigo-50/60 hover:bg-indigo-100 text-[10px] font-bold text-indigo-700 transition-colors cursor-pointer"
                              title="Add +25 units"
                            >
                              +25
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-blue-50 text-blue-700 border border-blue-150">
                          <Sparkles className="h-3 w-3 text-blue-500" /> Unlimited
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-3">
                      {onUpdateProductStatus ? (
                        <select
                          value={product.status || 'Active'}
                          onChange={(e) => onUpdateProductStatus(product.id, e.target.value as any)}
                          className={`h-7 rounded-md border text-[11px] font-bold px-1.5 cursor-pointer focus:outline-none ${
                            (!product.status || product.status === 'Active')
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : product.status === 'Draft'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : product.status === 'Inactive'
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                        >
                          <option value="Active">Active</option>
                          <option value="Draft">Draft</option>
                          <option value="Inactive">Inactive</option>
                          <option value="Archived">Archived</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            (!product.status || product.status === 'Active')
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {product.status || 'Active'}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEditProduct(product)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                          title="Edit product specification"
                          id={`btn-edit-product-${product.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>

                        {onDuplicateProduct && (
                          <button
                            type="button"
                            onClick={() => onDuplicateProduct(product)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="Clone/Duplicate product"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setDeleteConfirmTarget(product)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete product"
                          id={`btn-delete-product-${product.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-gray-100 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span>
            Showing <strong className="text-gray-900">{filteredProducts.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> to{' '}
            <strong className="text-gray-900">{Math.min(currentPage * itemsPerPage, filteredProducts.length)}</strong> of{' '}
            <strong className="text-gray-900">{filteredProducts.length}</strong> products
          </span>

          <div className="flex items-center gap-1 ml-3 border-l border-gray-200 pl-3">
            <span className="text-[11px] text-gray-400">Rows per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-7 rounded border border-gray-200 bg-gray-50 text-[11px] font-semibold px-1.5 text-gray-700 cursor-pointer focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-700 cursor-pointer"
            title="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="px-2 font-mono text-xs font-bold text-gray-800">
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-700 cursor-pointer"
            title="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Single Product Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900">Delete Product</h4>
                <p className="text-xs text-gray-500 font-mono">{deleteConfirmTarget.sku}</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed mb-4">
              Are you sure you want to delete <strong className="text-gray-950">"{deleteConfirmTarget.name}"</strong>? This will permanently remove this item from the active store catalog and all inventory records.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteProduct(deleteConfirmTarget.id, 'proprietary', true);
                  setDeleteConfirmTarget(null);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900">Confirm Bulk Deletion</h4>
                <p className="text-xs text-rose-700 font-semibold">{selectedIds.length} items will be deleted</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed mb-4">
              You are about to permanently delete <strong className="text-gray-950">{selectedIds.length} products</strong> from your catalog. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkDelete}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Delete Selected Products
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
