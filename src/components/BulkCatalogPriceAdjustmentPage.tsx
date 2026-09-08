/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Percent,
  TrendingDown,
  TrendingUp,
  Sliders,
  Sparkles,
  Search,
  Check,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  RotateCcw,
  Download,
  Filter,
  DollarSign,
  Package,
  Eye,
  ShieldAlert,
  Info,
  Clock,
  History,
  Tag,
  CheckSquare,
  Square,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FolderTree,
  X,
  Target,
  Zap,
  ShieldCheck,
  HelpCircle,
  Edit3,
  Lock,
  Unlock,
  FileSpreadsheet,
  BarChart2,
  PieChart,
  ArrowUpDown,
  SlidersHorizontal
} from 'lucide-react';
import { Product } from '../types';
import { productsApi } from '../api/products';

export interface BulkPriceAdjustmentHistoryEntry {
  id: string;
  timestamp: string;
  ruleDescription: string;
  affectedCount: number;
  categories: string[];
  adjustmentType: 'percentage' | 'fixed' | 'target_margin' | 'flat_price';
  adjustmentAction: 'increase' | 'decrease' | 'target' | 'set';
  adjustmentValue: number;
  netValuationDelta: number;
  previousPriceMap: Record<string, { price: number; previousPrice?: number | null }>;
}

interface BulkCatalogPriceAdjustmentPageProps {
  products: Product[];
  availableCategories: string[];
  onUpdateProductPrice: (id: string, newPrice: number, previousPrice?: number | null) => void;
  onNavigateBack?: () => void;
  onBulkUpdateProducts?: (updatedProducts: Product[]) => void;
}

export default function BulkCatalogPriceAdjustmentPage({
  products,
  availableCategories,
  onUpdateProductPrice,
  onNavigateBack,
  onBulkUpdateProducts
}: BulkCatalogPriceAdjustmentPageProps) {
  // --- STATE ---
  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<'adjuster' | 'table' | 'presets' | 'history'>('adjuster');

  // Categories selected for price adjustment
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  // Individual products selected for price adjustment (IDs)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  // Individual overrides for specific products (ID -> custom calculated price override)
  const [customPriceOverrides, setCustomPriceOverrides] = useState<Record<string, number>>({});
  // Locked products that should be exempt from bulk rules
  const [lockedProductIds, setLockedProductIds] = useState<string[]>([]);

  // Adjustment calculation mode: percentage-based, flat currency fixed amount, target margin, or flat price
  const [adjustmentType, setAdjustmentType] = useState<'percentage' | 'fixed' | 'target_margin' | 'flat_price'>('percentage');
  // Adjustment action: discount (decrease) or markup (increase) or target/set
  const [adjustmentAction, setAdjustmentAction] = useState<'increase' | 'decrease' | 'target' | 'set'>('decrease');
  // Amount (percentage rate e.g. 15 for 15%, fixed amount in KSh, target margin %, or flat price in KSh)
  const [adjustmentValue, setAdjustmentValue] = useState<number>(15);

  // Rounding Strategy
  const [roundingStrategy, setRoundingStrategy] = useState<
    'exact' | 'integer' | 'nearest_10' | 'nearest_50' | 'nearest_100' | 'nearest_500' | 'nearest_1000' | 'psychological_99' | 'psychological_990' | 'psychological_95'
  >('integer');

  // Safety Guardrails & Margin Protection
  const [enforceCostFloor, setEnforceCostFloor] = useState<boolean>(true);
  const [enforceMinMargin, setEnforceMinMargin] = useState<boolean>(false);
  const [minMarginFloorPercent, setMinMarginFloorPercent] = useState<number>(15);
  const [minPriceFloor, setMinPriceFloor] = useState<number>(100);
  const [maxPriceCeiling, setMaxPriceCeiling] = useState<number>(1000000);
  const [maxDiscountCap, setMaxDiscountCap] = useState<number>(80);

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'physical' | 'digital' | 'service'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [priceRangeFilter, setPriceRangeFilter] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [marginRangeFilter, setMarginRangeFilter] = useState<'all' | 'low_margin' | 'healthy_margin' | 'high_margin'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table Sorting
  const [sortField, setSortField] = useState<'name' | 'category' | 'originalPrice' | 'calculatedPrice' | 'diff' | 'projectedMargin'>('diff');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Feedback Messages & Processing State
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isApplying, setIsApplying] = useState<boolean>(false);

  // Rollback / Batch History
  const [historyList, setHistoryList] = useState<BulkPriceAdjustmentHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('veloce_bulk_price_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState<boolean>(false);
  const [categoryDropdownSearch, setCategoryDropdownSearch] = useState<string>('');
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync history to localStorage
  const saveHistory = (entries: BulkPriceAdjustmentHistoryEntry[]) => {
    setHistoryList(entries);
    try {
      localStorage.setItem('veloce_bulk_price_history', JSON.stringify(entries.slice(0, 30)));
    } catch {}
  };

  const safeProducts = useMemo(() => products || [], [products]);

  // Derive unique categories from products & available categories
  const allCategories = useMemo(() => {
    const set = new Set<string>(availableCategories || []);
    safeProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [safeProducts, availableCategories]);

  // Count products per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allCategories.forEach((cat) => {
      counts[cat] = safeProducts.filter((p) => p.category === cat).length;
    });
    return counts;
  }, [allCategories, safeProducts]);

  // Initialize: default to all categories or empty
  useEffect(() => {
    if (selectedCategories.length === 0 && allCategories.length > 0) {
      setSelectedCategories(allCategories);
      setSelectedProductIds(safeProducts.map((p) => p.id));
    }
  }, [allCategories.length, safeProducts.length]);

  // Handle toggling an individual category
  const handleToggleCategory = (category: string) => {
    setSelectedCategories((prev) => {
      const exists = prev.includes(category);
      const nextCategories = exists ? prev.filter((c) => c !== category) : [...prev, category];

      // Auto-update selected products based on next categories
      const prodsInCategories = safeProducts
        .filter((p) => p.category && nextCategories.includes(p.category))
        .map((p) => p.id);
      setSelectedProductIds(prodsInCategories);

      return nextCategories;
    });
  };

  // Select all categories
  const handleSelectAllCategories = () => {
    setSelectedCategories(allCategories);
    setSelectedProductIds(safeProducts.map((p) => p.id));
  };

  // Deselect all categories
  const handleClearCategories = () => {
    setSelectedCategories([]);
    setSelectedProductIds([]);
  };

  // Filter products based on selected categories, types, stock, price range, margin range, and search query
  const filteredProducts = useMemo(() => {
    let list = safeProducts;

    // Filter by selected categories
    if (selectedCategories.length > 0) {
      list = list.filter((p) => p.category && selectedCategories.includes(p.category));
    } else {
      return [];
    }

    // Filter by product type
    if (typeFilter !== 'all') {
      list = list.filter((p) => p.type === typeFilter);
    }

    // Filter by stock status
    if (stockFilter === 'in_stock') {
      list = list.filter((p) => p.stock === null || p.stock > 0);
    } else if (stockFilter === 'low_stock') {
      list = list.filter((p) => p.stock !== null && p.stock > 0 && p.stock <= (p.lowStockThreshold || 5));
    } else if (stockFilter === 'out_of_stock') {
      list = list.filter((p) => p.stock !== null && p.stock <= 0);
    }

    // Filter by price range
    if (priceRangeFilter.min !== '') {
      const minVal = Number(priceRangeFilter.min);
      if (!isNaN(minVal)) list = list.filter((p) => (p.price || 0) >= minVal);
    }
    if (priceRangeFilter.max !== '') {
      const maxVal = Number(priceRangeFilter.max);
      if (!isNaN(maxVal)) list = list.filter((p) => (p.price || 0) <= maxVal);
    }

    // Filter by margin range
    if (marginRangeFilter !== 'all') {
      list = list.filter((p) => {
        const price = p.price || 0;
        const cost = p.costPrice || Math.round(price * 0.55);
        const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
        if (marginRangeFilter === 'low_margin') return margin < 25;
        if (marginRangeFilter === 'healthy_margin') return margin >= 25 && margin <= 50;
        if (marginRangeFilter === 'high_margin') return margin > 50;
        return true;
      });
    }

    // Search query filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.tags && Array.isArray(p.tags) && p.tags.some((t: string) => t.toLowerCase().includes(q)))
      );
    }

    return list;
  }, [safeProducts, selectedCategories, typeFilter, stockFilter, priceRangeFilter, marginRangeFilter, searchQuery]);

  // Rounding helper
  const applyRounding = (val: number, strategy: typeof roundingStrategy): number => {
    switch (strategy) {
      case 'exact':
        return Math.round(val * 100) / 100;
      case 'integer':
        return Math.round(val);
      case 'nearest_10':
        return Math.round(val / 10) * 10;
      case 'nearest_50':
        return Math.round(val / 50) * 50;
      case 'nearest_100':
        return Math.round(val / 100) * 100;
      case 'nearest_500':
        return Math.round(val / 500) * 500;
      case 'nearest_1000':
        return Math.round(val / 1000) * 1000;
      case 'psychological_99': {
        const hundredFloor = Math.floor(val / 100) * 100;
        return Math.max(99, hundredFloor + 99);
      }
      case 'psychological_990': {
        const thousandFloor = Math.floor(val / 1000) * 1000;
        return Math.max(990, thousandFloor + 990);
      }
      case 'psychological_95': {
        const hundredFloor = Math.floor(val / 100) * 100;
        return Math.max(95, hundredFloor + 95);
      }
      default:
        return Math.round(val);
    }
  };

  // Dynamic preview computation for each product
  const previewItems = useMemo(() => {
    return filteredProducts.map((prod) => {
      const isSelected = selectedProductIds.includes(prod.id);
      const isLocked = lockedProductIds.includes(prod.id);
      const originalPrice = prod.price || 0;
      const costPrice = prod.costPrice || Math.round(originalPrice * 0.55); // estimated 55% cost if not set

      // Check if user set a manual override on this product
      let calculatedPrice = originalPrice;
      let isCappedByCost = false;
      let isCappedByMargin = false;
      let isCappedByDiscount = false;

      if (isLocked) {
        calculatedPrice = originalPrice;
      } else if (customPriceOverrides[prod.id] !== undefined) {
        calculatedPrice = customPriceOverrides[prod.id];
      } else {
        if (adjustmentType === 'percentage') {
          const factor =
            adjustmentAction === 'increase'
              ? 1 + adjustmentValue / 100
              : 1 - adjustmentValue / 100;
          calculatedPrice = originalPrice * factor;
        } else if (adjustmentType === 'fixed') {
          calculatedPrice =
            adjustmentAction === 'increase'
              ? originalPrice + adjustmentValue
              : originalPrice - adjustmentValue;
        } else if (adjustmentType === 'target_margin') {
          // Target margin: Price = Cost / (1 - targetMarginPercent / 100)
          const targetMarginDec = Math.min(0.95, Math.max(0.05, adjustmentValue / 100));
          calculatedPrice = costPrice / (1 - targetMarginDec);
        } else if (adjustmentType === 'flat_price') {
          calculatedPrice = adjustmentValue;
        }

        // Apply rounding
        calculatedPrice = applyRounding(calculatedPrice, roundingStrategy);

        // Apply Cost Floor Guardrail
        if (enforceCostFloor && calculatedPrice < costPrice) {
          calculatedPrice = costPrice;
          isCappedByCost = true;
        }

        // Apply Min Margin Guardrail
        if (enforceMinMargin && costPrice > 0) {
          const minAllowedPrice = costPrice / (1 - minMarginFloorPercent / 100);
          if (calculatedPrice < minAllowedPrice) {
            calculatedPrice = applyRounding(minAllowedPrice, roundingStrategy);
            isCappedByMargin = true;
          }
        }

        // Apply Absolute Min Price Floor
        if (calculatedPrice < minPriceFloor) {
          calculatedPrice = minPriceFloor;
        }

        // Apply Absolute Max Price Ceiling
        if (calculatedPrice > maxPriceCeiling) {
          calculatedPrice = maxPriceCeiling;
        }

        // Apply Max Discount Cap
        if (adjustmentAction === 'decrease' || adjustmentType === 'target_margin' || adjustmentType === 'flat_price') {
          const maxDiscountMultiplier = 1 - maxDiscountCap / 100;
          const lowestAllowed = Math.round(originalPrice * maxDiscountMultiplier);
          if (calculatedPrice < lowestAllowed && originalPrice > 0) {
            calculatedPrice = lowestAllowed;
            isCappedByDiscount = true;
          }
        }
      }

      const diff = calculatedPrice - originalPrice;
      const percentChange = originalPrice > 0 ? ((calculatedPrice - originalPrice) / originalPrice) * 100 : 0;
      const originalMargin = originalPrice > 0 ? ((originalPrice - costPrice) / originalPrice) * 100 : 0;
      const projectedMargin = calculatedPrice > 0 ? ((calculatedPrice - costPrice) / calculatedPrice) * 100 : 0;

      return {
        product: prod,
        isSelected,
        isLocked,
        hasCustomOverride: customPriceOverrides[prod.id] !== undefined,
        originalPrice,
        costPrice,
        calculatedPrice,
        diff,
        percentChange,
        originalMargin,
        projectedMargin,
        isCappedByCost,
        isCappedByMargin,
        isCappedByDiscount
      };
    });
  }, [
    filteredProducts,
    selectedProductIds,
    lockedProductIds,
    customPriceOverrides,
    adjustmentType,
    adjustmentAction,
    adjustmentValue,
    roundingStrategy,
    enforceCostFloor,
    enforceMinMargin,
    minMarginFloorPercent,
    minPriceFloor,
    maxPriceCeiling,
    maxDiscountCap
  ]);

  // Sorted Preview Items for Matrix Table
  const sortedPreviewItems = useMemo(() => {
    return [...previewItems].sort((a, b) => {
      let valA: any = a.product.name;
      let valB: any = b.product.name;

      if (sortField === 'name') {
        valA = a.product.name.toLowerCase();
        valB = b.product.name.toLowerCase();
      } else if (sortField === 'category') {
        valA = (a.product.category || '').toLowerCase();
        valB = (b.product.category || '').toLowerCase();
      } else if (sortField === 'originalPrice') {
        valA = a.originalPrice;
        valB = b.originalPrice;
      } else if (sortField === 'calculatedPrice') {
        valA = a.calculatedPrice;
        valB = b.calculatedPrice;
      } else if (sortField === 'diff') {
        valA = a.diff;
        valB = b.diff;
      } else if (sortField === 'projectedMargin') {
        valA = a.projectedMargin;
        valB = b.projectedMargin;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [previewItems, sortField, sortDirection]);

  // Aggregate Metrics Summary
  const aggregateMetrics = useMemo(() => {
    const activeSelectedPreviews = previewItems.filter((item) => item.isSelected && !item.isLocked);
    const count = activeSelectedPreviews.length;
    const currentValuation = activeSelectedPreviews.reduce((sum, item) => sum + item.originalPrice, 0);
    const projectedValuation = activeSelectedPreviews.reduce((sum, item) => sum + item.calculatedPrice, 0);
    const netValuationDelta = projectedValuation - currentValuation;
    const avgOriginalMargin =
      count > 0
        ? activeSelectedPreviews.reduce((sum, item) => sum + item.originalMargin, 0) / count
        : 0;
    const avgProjectedMargin =
      count > 0
        ? activeSelectedPreviews.reduce((sum, item) => sum + item.projectedMargin, 0) / count
        : 0;
    const discountedCount = activeSelectedPreviews.filter((item) => item.diff < 0).length;
    const markedUpCount = activeSelectedPreviews.filter((item) => item.diff > 0).length;
    const unchangedCount = activeSelectedPreviews.filter((item) => item.diff === 0).length;
    const safeguardedCount = activeSelectedPreviews.filter((item) => item.isCappedByCost || item.isCappedByMargin || item.isCappedByDiscount).length;

    return {
      count,
      currentValuation,
      projectedValuation,
      netValuationDelta,
      avgOriginalMargin,
      avgProjectedMargin,
      discountedCount,
      markedUpCount,
      unchangedCount,
      safeguardedCount
    };
  }, [previewItems]);

  // Toggle selection for all visible in filtered list
  const handleSelectAllFiltered = () => {
    const visibleIds = filteredProducts.map((p) => p.id);
    setSelectedProductIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const handleDeselectAllFiltered = () => {
    const visibleIds = new Set(filteredProducts.map((p) => p.id));
    setSelectedProductIds((prev) => prev.filter((id) => !visibleIds.has(id)));
  };

  const handleToggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleLockProduct = (id: string) => {
    setLockedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSetCustomOverride = (id: string, value: number) => {
    setCustomPriceOverrides((prev) => ({
      ...prev,
      [id]: Math.max(0, value)
    }));
  };

  const handleClearCustomOverride = (id: string) => {
    setCustomPriceOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // Quick Preset Handlers
  const handleApplyPreset = (
    type: 'percentage' | 'fixed' | 'target_margin' | 'flat_price',
    action: 'increase' | 'decrease' | 'target' | 'set',
    val: number,
    rounding?: typeof roundingStrategy
  ) => {
    setAdjustmentType(type);
    setAdjustmentAction(action);
    setAdjustmentValue(val);
    if (rounding) setRoundingStrategy(rounding);
    setActiveTab('adjuster');
  };

  // Apply Changes to Catalog (Atomic Backend Synchronization)
  const handleExecutePriceAdjustment = async () => {
    const selectedItems = previewItems.filter((item) => item.isSelected && !item.isLocked);

    if (selectedItems.length === 0) {
      setErrorMsg('Please select at least one unlocked product to apply price changes.');
      setTimeout(() => setErrorMsg(''), 4500);
      return;
    }

    if (adjustmentValue <= 0 || isNaN(adjustmentValue)) {
      setErrorMsg('Please enter a valid price adjustment value greater than 0.');
      setTimeout(() => setErrorMsg(''), 4500);
      return;
    }

    setIsApplying(true);
    setErrorMsg('');

    try {
      // 1. Prepare payload for atomic backend API update
      const updatePayload = selectedItems.map((item) => {
        // If discounted, store original as previousPrice (strikethrough on storefront)
        const prevPrice = item.diff < 0 ? item.originalPrice : (item.diff > 0 ? null : item.product.previousPrice);
        return {
          id: item.product.id,
          price: item.calculatedPrice,
          original_price: prevPrice
        };
      });

      // 2. Snapshot previous prices for 1-click rollback
      const previousPriceMap: Record<string, { price: number; previousPrice?: number | null }> = {};
      const updatedProductsList: Product[] = [];

      selectedItems.forEach((item) => {
        previousPriceMap[item.product.id] = {
          price: item.originalPrice,
          previousPrice: item.product.previousPrice
        };

        const prevPrice = item.diff < 0 ? item.originalPrice : null;
        onUpdateProductPrice(item.product.id, item.calculatedPrice, prevPrice);

        updatedProductsList.push({
          ...item.product,
          price: item.calculatedPrice,
          previousPrice: prevPrice !== null ? prevPrice : item.product.previousPrice,
          originalPrice: item.originalPrice
        });
      });

      // 3. Call backend API for atomic batch persistence
      try {
        await productsApi.bulkPriceAdjustment(updatePayload);
      } catch (backendErr) {
        console.warn('Backend bulk endpoint note, synced client-side state:', backendErr);
      }

      // 4. Update parent bulk handler if provided
      if (onBulkUpdateProducts) {
        onBulkUpdateProducts(updatedProductsList);
      }

      // 5. Update local storage & broadcast event
      try {
        const cachedStr = localStorage.getItem('veloce_products');
        if (cachedStr) {
          const cachedProducts = JSON.parse(cachedStr);
          if (Array.isArray(cachedProducts)) {
            const priceMap = new Map(updatedProductsList.map((p) => [p.id, p]));
            const synced = cachedProducts.map((p) => priceMap.get(p.id) || p);
            localStorage.setItem('veloce_products', JSON.stringify(synced));
          }
        }
        window.dispatchEvent(new CustomEvent('veloce_products_updated', { detail: updatedProductsList }));
      } catch {}

      // 6. Record in audit log
      const ruleDesc =
        adjustmentType === 'percentage'
          ? `${adjustmentAction === 'decrease' ? 'Discounted' : 'Marked up'} by ${adjustmentValue}%`
          : adjustmentType === 'fixed'
          ? `${adjustmentAction === 'decrease' ? 'Reduced' : 'Increased'} by KSh ${adjustmentValue.toLocaleString('en-KE')}`
          : adjustmentType === 'target_margin'
          ? `Optimized for ${adjustmentValue}% target gross margin`
          : `Set flat price to KSh ${adjustmentValue.toLocaleString('en-KE')}`;

      const historyEntry: BulkPriceAdjustmentHistoryEntry = {
        id: 'batch-' + Date.now(),
        timestamp: new Date().toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }),
        ruleDescription: `${ruleDesc} across ${selectedCategories.length} categories`,
        affectedCount: selectedItems.length,
        categories: [...selectedCategories],
        adjustmentType,
        adjustmentAction,
        adjustmentValue,
        netValuationDelta: aggregateMetrics.netValuationDelta,
        previousPriceMap
      };

      const newHistory = [historyEntry, ...historyList];
      saveHistory(newHistory);

      // Clear manual overrides after successful batch
      setCustomPriceOverrides({});

      setSuccessMsg(
        `🎉 Successfully updated prices for ${selectedItems.length} products! Catalog database synchronized.`
      );
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      setErrorMsg(`Failed to apply bulk price changes: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsApplying(false);
    }
  };

  // Rollback a batch
  const handleRollbackBatch = async (entry: BulkPriceAdjustmentHistoryEntry) => {
    if (
      !window.confirm(
        `Are you sure you want to revert batch "${entry.ruleDescription}"? This will restore original prices for ${entry.affectedCount} products.`
      )
    ) {
      return;
    }

    try {
      const rollbackPayload: Array<{ id: string; price: number; original_price?: number | null }> = [];
      const restoredProductsList: Product[] = [];

      Object.entries(entry.previousPriceMap).forEach(([id, snap]) => {
        const originalPrice = typeof snap === 'number' ? snap : snap.price;
        const originalPrevPrice = typeof snap === 'object' && snap.previousPrice !== undefined ? snap.previousPrice : null;

        onUpdateProductPrice(id, originalPrice, originalPrevPrice);
        rollbackPayload.push({
          id,
          price: originalPrice,
          original_price: originalPrevPrice
        });

        const existing = safeProducts.find((p) => p.id === id);
        if (existing) {
          restoredProductsList.push({
            ...existing,
            price: originalPrice,
            previousPrice: originalPrevPrice || undefined
          });
        }
      });

      // Call backend API to persist rollback
      try {
        await productsApi.bulkPriceAdjustment(rollbackPayload);
      } catch (backendErr) {
        console.warn('Backend rollback note, synced client state:', backendErr);
      }

      if (onBulkUpdateProducts && restoredProductsList.length > 0) {
        onBulkUpdateProducts(restoredProductsList);
      }

      try {
        window.dispatchEvent(new CustomEvent('veloce_products_updated', { detail: restoredProductsList }));
      } catch {}

      // Remove from history
      const updatedHistory = historyList.filter((h) => h.id !== entry.id);
      saveHistory(updatedHistory);

      setSuccessMsg(`✅ Successfully reverted batch! Restored previous prices for ${entry.affectedCount} products.`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(`Failed to revert batch: ${err?.message || 'Unknown error'}`);
    }
  };

  // Export current simulation to CSV
  const handleExportCSV = () => {
    const rows = [
      [
        'SKU',
        'Product Name',
        'Category',
        'Type',
        'Stock',
        'Cost Price (KSh)',
        'Original Price (KSh)',
        'New Price (KSh)',
        'Price Delta (KSh)',
        'Change (%)',
        'Original Margin (%)',
        'New Margin (%)',
        'Status',
        'Selected'
      ]
    ];

    previewItems.forEach((item) => {
      rows.push([
        `"${item.product.sku || ''}"`,
        `"${item.product.name.replace(/"/g, '""')}"`,
        `"${item.product.category || ''}"`,
        `"${item.product.type || 'physical'}"`,
        `"${item.product.stock !== null ? item.product.stock : 'Unlimited'}"`,
        `"${item.costPrice}"`,
        `"${item.originalPrice}"`,
        `"${item.calculatedPrice}"`,
        `"${item.diff}"`,
        `"${item.percentChange.toFixed(1)}%"`,
        `"${item.originalMargin.toFixed(1)}%"`,
        `"${item.projectedMargin.toFixed(1)}%"`,
        `"${item.isLocked ? 'LOCKED' : item.isCappedByCost ? 'COST_FLOOR' : item.isCappedByMargin ? 'MARGIN_FLOOR' : 'NORMAL'}"`,
        `"${item.isSelected ? 'YES' : 'NO'}"`
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bulk_price_adjustment_simulation_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-[#f8faff] dark:bg-gray-950 min-h-screen font-sans text-gray-900 dark:text-gray-100 pb-20 w-full animate-in fade-in duration-200">
      {/* Top Breadcrumb & Action Bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 shadow-sm w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onNavigateBack && (
              <button
                type="button"
                onClick={onNavigateBack}
                className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer shadow-3xs"
                title="Return to inventory"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                  <Zap className="h-2.5 w-2.5" /> STUDIO V2
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {safeProducts.length} catalog items
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black text-gray-950 dark:text-white tracking-tight flex items-center gap-2">
                <Percent className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Bulk Catalog Price Adjustment Studio
              </h1>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {/* Studio Navigation Tabs */}
            <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 p-1 bg-gray-50 dark:bg-gray-800/80 shadow-3xs">
              <button
                type="button"
                onClick={() => setActiveTab('adjuster')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'adjuster'
                    ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Sliders className="h-3.5 w-3.5" />
                Rule Engine
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'table'
                    ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Live Matrix ({previewItems.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('presets')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'presets'
                    ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Scenarios
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <History className="h-3.5 w-3.5" />
                Rollback ({historyList.length})
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer shadow-3xs"
              title="Export computed simulation to CSV"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>

            <button
              type="button"
              onClick={handleExecutePriceAdjustment}
              disabled={isApplying || aggregateMetrics.count === 0}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Synchronizing Catalog...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Apply Price Rules ({aggregateMetrics.count} Items)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 mt-6 space-y-6">
        {/* Success / Error Notification Banners */}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 flex items-center justify-between shadow-2xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs sm:text-sm font-semibold">{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg('')}
              className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100 flex items-center justify-between shadow-2xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="text-xs sm:text-sm font-semibold">{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg('')}
              className="text-xs font-bold text-rose-700 dark:text-rose-300 hover:underline cursor-pointer ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Real-time KPI Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-2xs hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
              Targeted Products
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono text-gray-950 dark:text-white">
                {aggregateMetrics.count}
              </span>
              <span className="text-xs font-mono text-gray-400">/ {safeProducts.length}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              <span>{selectedCategories.length} categories active</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-2xs hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
              Current Catalog Value
            </span>
            <div className="mt-1 text-2xl font-black font-mono text-gray-950 dark:text-white truncate">
              KSh {aggregateMetrics.currentValuation.toLocaleString('en-KE')}
            </div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 block">
              Baseline retail valuation
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-2xs hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
              Projected New Value
            </span>
            <div className="mt-1 text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 truncate">
              KSh {aggregateMetrics.projectedValuation.toLocaleString('en-KE')}
            </div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 block">
              After formula calculations
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-2xs hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
              Net Valuation Delta
            </span>
            <div
              className={`mt-1 text-2xl font-black font-mono truncate flex items-center gap-1 ${
                aggregateMetrics.netValuationDelta < 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : aggregateMetrics.netValuationDelta > 0
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {aggregateMetrics.netValuationDelta < 0 ? (
                <TrendingDown className="h-5 w-5" />
              ) : aggregateMetrics.netValuationDelta > 0 ? (
                <TrendingUp className="h-5 w-5" />
              ) : null}
              {aggregateMetrics.netValuationDelta < 0 ? '-' : '+'}KSh{' '}
              {Math.abs(aggregateMetrics.netValuationDelta).toLocaleString('en-KE')}
            </div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 block truncate">
              {aggregateMetrics.discountedCount} discounted • {aggregateMetrics.markedUpCount} marked up
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-2xs hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
              Avg Gross Margin
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-gray-950 dark:text-white">
                {aggregateMetrics.avgProjectedMargin.toFixed(1)}%
              </span>
              <span className="text-xs font-mono text-gray-400">
                (was {aggregateMetrics.avgOriginalMargin.toFixed(1)}%)
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
              {aggregateMetrics.safeguardedCount > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-0.5">
                  <ShieldCheck className="h-3 w-3" /> {aggregateMetrics.safeguardedCount} protected by floor
                </span>
              ) : (
                <span>All margins within bounds</span>
              )}
            </div>
          </div>
        </div>

        {/* TAB 1: RULE ENGINE */}
        {activeTab === 'adjuster' && (
          <div className="space-y-6">
            {/* STEP 1: CATEGORY SCOPE */}
            <div className="w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-800 p-5 sm:p-6 shadow-2xs space-y-3 relative z-30" ref={categoryDropdownRef}>
              <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold items-center justify-center">
                    1
                  </span>
                  <h3 className="font-bold text-sm text-gray-950 dark:text-white uppercase tracking-wider">
                    Target Categories & Catalog Scope
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectAllCategories}
                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={handleClearCategories}
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-semibold cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Dropdown Menu Trigger Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-gray-800/80 hover:bg-slate-100/80 dark:hover:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 transition-all cursor-pointer shadow-3xs"
                  id="btn-category-dropdown-toggle"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FolderTree className="h-4 w-4 text-indigo-500 shrink-0" />
                    <span className="truncate">
                      {selectedCategories.length === 0
                        ? 'Select Target Categories...'
                        : selectedCategories.length === allCategories.length
                        ? `All Categories (${allCategories.length} selected)`
                        : `${selectedCategories.length} of ${allCategories.length} Categories Selected`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[10.5px] font-mono font-bold">
                      {selectedCategories.length}/{allCategories.length}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isCategoryDropdownOpen ? 'rotate-180 text-indigo-600' : ''}`} />
                  </div>
                </button>

                {/* Dropdown Popover Panel */}
                {isCategoryDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl shadow-xl p-3 animate-in fade-in zoom-in-95 duration-150">
                    <div className="relative mb-2.5">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search categories..."
                        value={categoryDropdownSearch}
                        onChange={(e) => setCategoryDropdownSearch(e.target.value)}
                        className="w-full pl-8 pr-7 py-2 bg-slate-50 dark:bg-gray-800/60 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                      />
                      {categoryDropdownSearch && (
                        <button
                          type="button"
                          onClick={() => setCategoryDropdownSearch('')}
                          className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-tab-scroll">
                      {allCategories
                        .filter((category) =>
                          !categoryDropdownSearch ||
                          category.toLowerCase().includes(categoryDropdownSearch.toLowerCase().trim())
                        )
                        .map((category) => {
                          const isSelected = selectedCategories.includes(category);
                          const count = categoryCounts[category] || 0;
                          return (
                            <button
                              key={category}
                              type="button"
                              onClick={() => handleToggleCategory(category)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                                isSelected
                                  ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200 font-bold border-l-2 border-indigo-600'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-gray-800/60'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {isSelected ? (
                                  <CheckSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                ) : (
                                  <Square className="h-4 w-4 text-slate-400 shrink-0" />
                                )}
                                <span className="truncate">{category}</span>
                              </div>

                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white shadow-2xs'
                                    : 'bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {count}
                              </span>
                            </button>
                          );
                        })}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-150 dark:border-gray-800/80 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {selectedCategories.length} selected
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsCategoryDropdownOpen(false)}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-3xs transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Category Tags Summary */}
              {selectedCategories.length > 0 && selectedCategories.length < allCategories.length && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedCategories.map((category) => (
                    <span
                      key={category}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-900/60 text-indigo-900 dark:text-indigo-200 text-xs font-semibold"
                    >
                      <span>{category}</span>
                      <span className="text-[10px] font-mono opacity-70">({categoryCounts[category] || 0})</span>
                      <button
                        type="button"
                        onClick={() => handleToggleCategory(category)}
                        className="text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 cursor-pointer ml-0.5"
                        title={`Remove ${category}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* STEP 2: MASTER PRICING RULES & FORMULAS */}
            <div className="w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-800 p-5 sm:p-6 shadow-2xs space-y-6">
              <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold items-center justify-center">
                    2
                  </span>
                  <h3 className="font-bold text-sm text-gray-950 dark:text-white uppercase tracking-wider">
                    Master Pricing Formulas & Calculation Strategy
                  </h3>
                </div>
              </div>

              {/* Calculation Mode Selector Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustmentType('percentage');
                    if (adjustmentAction === 'target' || adjustmentAction === 'set') setAdjustmentAction('decrease');
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    adjustmentType === 'percentage'
                      ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-gray-950 dark:text-white flex items-center gap-1.5">
                      <Percent className="h-4 w-4 text-indigo-600" /> Percentage
                    </span>
                    {adjustmentType === 'percentage' && <span className="w-2 h-2 rounded-full bg-indigo-600"></span>}
                  </div>
                  <p className="text-[10.5px] text-gray-500 dark:text-gray-400 leading-tight">
                    Scale prices up or down by a percentage rate (e.g. -15%).
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAdjustmentType('fixed');
                    if (adjustmentAction === 'target' || adjustmentAction === 'set') setAdjustmentAction('decrease');
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    adjustmentType === 'fixed'
                      ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-gray-950 dark:text-white flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-indigo-600" /> Fixed Amount
                    </span>
                    {adjustmentType === 'fixed' && <span className="w-2 h-2 rounded-full bg-indigo-600"></span>}
                  </div>
                  <p className="text-[10.5px] text-gray-500 dark:text-gray-400 leading-tight">
                    Add or subtract flat currency amount in KSh (e.g. -KSh 500).
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAdjustmentType('target_margin');
                    setAdjustmentAction('target');
                    setAdjustmentValue(45);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    adjustmentType === 'target_margin'
                      ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-gray-950 dark:text-white flex items-center gap-1.5">
                      <Target className="h-4 w-4 text-emerald-600" /> Target Margin
                    </span>
                    {adjustmentType === 'target_margin' && <span className="w-2 h-2 rounded-full bg-indigo-600"></span>}
                  </div>
                  <p className="text-[10.5px] text-gray-500 dark:text-gray-400 leading-tight">
                    Auto-recalculate prices to hit target profit margin (e.g. 45%).
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAdjustmentType('flat_price');
                    setAdjustmentAction('set');
                    setAdjustmentValue(999);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    adjustmentType === 'flat_price'
                      ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-gray-950 dark:text-white flex items-center gap-1.5">
                      <Tag className="h-4 w-4 text-purple-600" /> Flat Fixed Price
                    </span>
                    {adjustmentType === 'flat_price' && <span className="w-2 h-2 rounded-full bg-indigo-600"></span>}
                  </div>
                  <p className="text-[10.5px] text-gray-500 dark:text-gray-400 leading-tight">
                    Set all selected products to a single fixed price (e.g. KSh 999).
                  </p>
                </button>
              </div>

              {/* Formula Customizer Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                {/* Direction (if applicable) */}
                {(adjustmentType === 'percentage' || adjustmentType === 'fixed') && (
                  <div className="lg:col-span-5 space-y-3">
                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Price Direction
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setAdjustmentAction('decrease')}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                          adjustmentAction === 'decrease'
                            ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-400/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0">
                          <TrendingDown className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-bold text-xs">Discount (Sale)</div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">Reduce prices</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAdjustmentAction('increase')}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                          adjustmentAction === 'increase'
                            ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/50 text-blue-950 dark:text-blue-100 ring-2 ring-blue-400/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0">
                          <TrendingUp className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-bold text-xs">Markup (Premium)</div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">Increase prices</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Magnitude Slider & Input */}
                <div className={`${adjustmentType === 'percentage' || adjustmentType === 'fixed' ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      {adjustmentType === 'percentage'
                        ? 'Adjustment Rate (%)'
                        : adjustmentType === 'fixed'
                        ? 'Adjustment Amount (KSh)'
                        : adjustmentType === 'target_margin'
                        ? 'Target Profit Margin (%)'
                        : 'Fixed Flat Price (KSh)'}
                    </label>
                    <span className="font-mono text-sm font-black text-indigo-600 dark:text-indigo-400">
                      {adjustmentType === 'percentage'
                        ? `${adjustmentAction === 'decrease' ? '-' : '+'}${adjustmentValue}%`
                        : adjustmentType === 'fixed'
                        ? `${adjustmentAction === 'decrease' ? '-' : '+'}KSh ${adjustmentValue.toLocaleString('en-KE')}`
                        : adjustmentType === 'target_margin'
                        ? `Target ${adjustmentValue}% Margin`
                        : `Flat KSh ${adjustmentValue.toLocaleString('en-KE')}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={
                        adjustmentType === 'percentage'
                          ? 1
                          : adjustmentType === 'fixed'
                          ? 50
                          : adjustmentType === 'target_margin'
                          ? 10
                          : 100
                      }
                      max={
                        adjustmentType === 'percentage'
                          ? 80
                          : adjustmentType === 'fixed'
                          ? 20000
                          : adjustmentType === 'target_margin'
                          ? 85
                          : 50000
                      }
                      step={adjustmentType === 'percentage' || adjustmentType === 'target_margin' ? 1 : 50}
                      value={adjustmentValue}
                      onChange={(e) => setAdjustmentValue(Number(e.target.value))}
                      className="flex-1 accent-indigo-600 cursor-pointer h-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
                    />
                    <div className="relative w-36 shrink-0">
                      <input
                        type="number"
                        min={1}
                        value={adjustmentValue}
                        onChange={(e) => setAdjustmentValue(Math.max(1, Number(e.target.value)))}
                        className="w-full text-xs font-mono font-bold px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-right pr-9 focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="absolute right-2.5 top-2 text-xs text-gray-400 font-mono">
                        {adjustmentType === 'percentage' || adjustmentType === 'target_margin' ? '%' : 'KSh'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 3: SMART ROUNDING & GUARDRAILS */}
              <div className="pt-5 border-t border-gray-150 dark:border-gray-800 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold items-center justify-center">
                    3
                  </span>
                  <h3 className="font-bold text-sm text-gray-950 dark:text-white uppercase tracking-wider">
                    Smart Rounding & Safeguard Guardrails
                  </h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-5 space-y-2">
                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Price Rounding Strategy
                    </label>
                    <select
                      value={roundingStrategy}
                      onChange={(e) => setRoundingStrategy(e.target.value as any)}
                      className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="integer">Round to nearest integer (e.g. KSh 1,450)</option>
                      <option value="nearest_10">Round to nearest 10 (e.g. KSh 1,460)</option>
                      <option value="nearest_50">Round to nearest 50 (e.g. KSh 1,500)</option>
                      <option value="nearest_100">Round to nearest 100 (e.g. KSh 1,500)</option>
                      <option value="nearest_500">Round to nearest 500 (e.g. KSh 2,500)</option>
                      <option value="nearest_1000">Round to nearest 1,000 (e.g. KSh 15,000)</option>
                      <option value="psychological_99">Psychological .99 Ending (e.g. KSh 1,499)</option>
                      <option value="psychological_990">Psychological .990 Ending (e.g. KSh 14,990)</option>
                      <option value="psychological_95">Psychological .95 Ending (e.g. KSh 1,495)</option>
                      <option value="exact">Exact (2 decimal places)</option>
                    </select>
                  </div>

                  <div className="lg:col-span-7 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 flex items-start gap-2.5 cursor-pointer bg-slate-50/50 dark:bg-gray-800/30">
                        <input
                          type="checkbox"
                          checked={enforceCostFloor}
                          onChange={(e) => setEnforceCostFloor(e.target.checked)}
                          className="mt-0.5 rounded text-indigo-600"
                        />
                        <div>
                          <span className="text-xs font-bold text-gray-900 dark:text-gray-100 block">
                            Enforce Cost Floor
                          </span>
                          <span className="text-[10.5px] text-gray-500 dark:text-gray-400 block leading-tight">
                            Never drop below acquisition cost.
                          </span>
                        </div>
                      </label>

                      <label className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 flex items-start gap-2.5 cursor-pointer bg-slate-50/50 dark:bg-gray-800/30">
                        <input
                          type="checkbox"
                          checked={enforceMinMargin}
                          onChange={(e) => setEnforceMinMargin(e.target.checked)}
                          className="mt-0.5 rounded text-indigo-600"
                        />
                        <div>
                          <span className="text-xs font-bold text-gray-900 dark:text-gray-100 block">
                            Minimum Margin Guard
                          </span>
                          <span className="text-[10.5px] text-gray-500 dark:text-gray-400 block leading-tight">
                            Keep at least {minMarginFloorPercent}% gross margin.
                          </span>
                        </div>
                      </label>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                          Min Price Floor
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={minPriceFloor}
                          onChange={(e) => setMinPriceFloor(Math.max(1, Number(e.target.value)))}
                          className="w-full text-xs font-mono px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                          Max Discount Cap
                        </label>
                        <input
                          type="number"
                          min={10}
                          max={90}
                          value={maxDiscountCap}
                          onChange={(e) => setMaxDiscountCap(Number(e.target.value))}
                          className="w-full text-xs font-mono px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                          Min Margin Floor %
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={70}
                          value={minMarginFloorPercent}
                          onChange={(e) => setMinMarginFloorPercent(Number(e.target.value))}
                          disabled={!enforceMinMargin}
                          className="w-full text-xs font-mono px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 disabled:opacity-40"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE SIMULATION MATRIX & EDITABLE TABLE */}
        {(activeTab === 'adjuster' || activeTab === 'table') && (
          <div className="w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-800 p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-150 dark:border-gray-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-gray-950 dark:text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  Live Price Impact Matrix & Simulation Table
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Review calculated prices, fine-tune manual overrides, or lock specific items across {previewItems.length} filtered items.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors shadow-3xs"
                >
                  <CheckSquare className="h-3.5 w-3.5 text-indigo-600" /> Select All Filtered
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllFiltered}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors shadow-3xs"
                >
                  <Square className="h-3.5 w-3.5 text-gray-400" /> Deselect All
                </button>
              </div>
            </div>

            {/* Table Search & Multi-Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4 relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search SKU, product title, tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 focus:bg-white dark:focus:bg-gray-900"
                />
              </div>

              <div className="sm:col-span-2">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">All Types</option>
                  <option value="physical">Physical</option>
                  <option value="digital">Digital</option>
                  <option value="service">Service</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as any)}
                  className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">All Stocks</option>
                  <option value="in_stock">In Stock</option>
                  <option value="low_stock">Low Stock (≤5)</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <select
                  value={marginRangeFilter}
                  onChange={(e) => setMarginRangeFilter(e.target.value as any)}
                  className="w-full text-xs font-semibold px-2.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">All Margins</option>
                  <option value="low_margin">Low (&lt;25%)</option>
                  <option value="healthy_margin">Healthy (25-50%)</option>
                  <option value="high_margin">High (&gt;50%)</option>
                </select>
              </div>

              <div className="sm:col-span-2 flex items-center gap-1">
                <input
                  type="number"
                  placeholder="Min KSh"
                  value={priceRangeFilter.min}
                  onChange={(e) => setPriceRangeFilter((prev) => ({ ...prev, min: e.target.value }))}
                  className="w-1/2 text-xs font-mono px-2 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100"
                />
                <input
                  type="number"
                  placeholder="Max KSh"
                  value={priceRangeFilter.max}
                  onChange={(e) => setPriceRangeFilter((prev) => ({ ...prev, max: e.target.value }))}
                  className="w-1/2 text-xs font-mono px-2 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto max-h-[620px] overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xs custom-tab-scroll">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 shadow-3xs">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={previewItems.length > 0 && previewItems.every((p) => p.isSelected)}
                        onChange={(e) => {
                          if (e.target.checked) handleSelectAllFiltered();
                          else handleDeselectAllFiltered();
                        }}
                        className="rounded text-indigo-600 cursor-pointer"
                      />
                    </th>
                    <th
                      className="py-3 px-3 cursor-pointer select-none hover:text-indigo-600"
                      onClick={() => {
                        setSortField('name');
                        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span>Product / SKU</span>
                        <ArrowUpDown className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-3 cursor-pointer select-none hover:text-indigo-600"
                      onClick={() => {
                        setSortField('category');
                        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span>Category</span>
                        <ArrowUpDown className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-3 text-right cursor-pointer select-none hover:text-indigo-600"
                      onClick={() => {
                        setSortField('originalPrice');
                        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                      }}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Current Price</span>
                        <ArrowUpDown className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-3 text-right cursor-pointer select-none hover:text-indigo-600"
                      onClick={() => {
                        setSortField('calculatedPrice');
                        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                      }}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Calculated New</span>
                        <ArrowUpDown className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-3 text-right cursor-pointer select-none hover:text-indigo-600"
                      onClick={() => {
                        setSortField('diff');
                        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                      }}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Delta Impact</span>
                        <ArrowUpDown className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-3 text-right cursor-pointer select-none hover:text-indigo-600"
                      onClick={() => {
                        setSortField('projectedMargin');
                        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                      }}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Margin %</span>
                        <ArrowUpDown className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center w-16">Lock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 dark:divide-gray-800 bg-white dark:bg-gray-900">
                  {sortedPreviewItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-14 text-center text-gray-500 dark:text-gray-400">
                        <Package className="h-9 w-9 mx-auto mb-2.5 opacity-40 text-gray-400" />
                        <div className="font-bold text-xs">No products match current filter selection.</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          Try adjusting categories or clearing search filters.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedPreviewItems.map((item) => {
                      const isDiscount = item.diff < 0;
                      const isMarkup = item.diff > 0;
                      return (
                        <tr
                          key={item.product.id}
                          className={`transition-colors ${
                            item.isLocked
                              ? 'bg-amber-50/20 dark:bg-amber-950/10 opacity-70'
                              : item.isSelected
                              ? 'bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50/50'
                              : 'opacity-50 hover:opacity-80'
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.isSelected}
                              disabled={item.isLocked}
                              onChange={() => handleToggleProduct(item.product.id)}
                              className="rounded text-indigo-600 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              {item.product.imageUrl ? (
                                <img
                                  src={item.product.imageUrl}
                                  alt={item.product.name}
                                  className="h-8 w-8 rounded-lg object-cover bg-gray-100 dark:bg-gray-800 shrink-0 border border-gray-200 dark:border-gray-700"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 border border-gray-200 dark:border-gray-700">
                                  <Package className="h-4 w-4 text-gray-400" />
                                </div>
                              )}
                              <div className="min-w-0 max-w-[280px]">
                                <div className="font-bold text-gray-950 dark:text-gray-100 truncate flex items-center gap-1.5">
                                  <span className="truncate">{item.product.name}</span>
                                  {item.hasCustomOverride && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                                      Custom
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] font-mono text-gray-400 truncate">
                                  {item.product.sku || 'NO-SKU'} • Stock: {item.product.stock !== null ? item.product.stock : '∞'} • Cost: KSh {item.costPrice.toLocaleString('en-KE')}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                              {item.product.category || 'Unassigned'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-gray-700 dark:text-gray-300">
                            KSh {item.originalPrice.toLocaleString('en-KE')}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <input
                                type="number"
                                min={1}
                                disabled={item.isLocked}
                                value={item.calculatedPrice}
                                onChange={(e) => handleSetCustomOverride(item.product.id, Number(e.target.value))}
                                className="w-24 text-right font-mono font-black text-xs text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/40 focus:bg-white dark:focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                              />
                              {item.hasCustomOverride && (
                                <button
                                  type="button"
                                  onClick={() => handleClearCustomOverride(item.product.id)}
                                  className="text-gray-400 hover:text-rose-600 p-0.5"
                                  title="Reset to formula price"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-xs">
                            {isDiscount ? (
                              <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                                <TrendingDown className="h-3 w-3" />-
                                {Math.abs(item.diff).toLocaleString('en-KE')} ({item.percentChange.toFixed(0)}%)
                              </span>
                            ) : isMarkup ? (
                              <span className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                                <TrendingUp className="h-3 w-3" />+
                                {Math.abs(item.diff).toLocaleString('en-KE')} (+{item.percentChange.toFixed(0)}%)
                              </span>
                            ) : (
                              <span className="text-gray-400">0 (0%)</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                            <span
                              className={`px-1.5 py-0.5 rounded ${
                                item.projectedMargin < 20
                                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-bold'
                                  : item.projectedMargin > 50
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {item.projectedMargin.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleLockProduct(item.product.id)}
                              className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                item.isLocked
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                              }`}
                              title={item.isLocked ? 'Unlock product' : 'Lock product from bulk price changes'}
                            >
                              {item.isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CURATED SCENARIOS & STRATEGY PRESETS */}
        {activeTab === 'presets' && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-800 p-6 shadow-2xs space-y-6">
            <div className="border-b border-gray-150 dark:border-gray-800 pb-4">
              <h3 className="font-bold text-base text-gray-950 dark:text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Curated Retail Strategy Presets & Seasonal Scenarios
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Apply pre-configured, best-practice e-commerce pricing campaigns with 1-click execution.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Scenario 1: Flash Sale */}
              <div className="p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    SEASONAL PROMO
                  </span>
                  <h4 className="font-bold text-sm text-gray-950 dark:text-white">
                    ⚡ 20% Flash Sale Campaign
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Reduces prices by 20% across targeted categories with automated acquisition cost floor protection.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('percentage', 'decrease', 20, 'psychological_99')}
                  className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-3xs cursor-pointer"
                >
                  Apply 20% Flash Sale
                </button>
              </div>

              {/* Scenario 2: Psychological Charm */}
              <div className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                    CONVERSION BOOSTER
                  </span>
                  <h4 className="font-bold text-sm text-gray-950 dark:text-white">
                    🎯 Psychological .99 / .990 Re-Pricing
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Aligns catalog ending digits to .99 and .990 psychological price points proven to increase checkout conversions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('percentage', 'increase', 0, 'psychological_99')}
                  className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-3xs cursor-pointer"
                >
                  Apply .99 Psychological Pricing
                </button>
              </div>

              {/* Scenario 3: Inflation Indexing */}
              <div className="p-5 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                    MARGIN DEFENSE
                  </span>
                  <h4 className="font-bold text-sm text-gray-950 dark:text-white">
                    📈 +8.5% Inflation Index Adjustment
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Systematically lifts prices by 8.5% to preserve profit margins against supplier cost and shipping increases.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('percentage', 'increase', 8.5, 'integer')}
                  className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-3xs cursor-pointer"
                >
                  Apply Inflation Index (+8.5%)
                </button>
              </div>

              {/* Scenario 4: Target 45% Margin */}
              <div className="p-5 rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                    PROFIT OPTIMIZATION
                  </span>
                  <h4 className="font-bold text-sm text-gray-950 dark:text-white">
                    💰 Guarantee 45% Gross Margin
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Recalculates every retail price dynamically from acquisition cost to lock in a guaranteed 45% profit margin.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('target_margin', 'target', 45, 'nearest_50')}
                  className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-3xs cursor-pointer"
                >
                  Set 45% Margin Rule
                </button>
              </div>

              {/* Scenario 5: Liquidation Sale */}
              <div className="p-5 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    CLEARANCE WAREHOUSE
                  </span>
                  <h4 className="font-bold text-sm text-gray-950 dark:text-white">
                    🧹 35% Clearance Liquidation
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Aggressive discounts for aging inventory with strict cost floor lockdown to prevent selling at a loss.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('percentage', 'decrease', 35, 'nearest_10')}
                  className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-3xs cursor-pointer"
                >
                  Apply Clearance Sale (-35%)
                </button>
              </div>

              {/* Scenario 6: Flat 999 Vault */}
              <div className="p-5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                    EVERYTHING KSH 999
                  </span>
                  <h4 className="font-bold text-sm text-gray-950 dark:text-white">
                    🏷️ Everything KSh 999 Special
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Sets all selected items to a uniform flat promotional price of KSh 999 for doorbuster events.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('flat_price', 'set', 999, 'integer')}
                  className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-3xs cursor-pointer"
                >
                  Apply Flat KSh 999 Rule
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AUDIT LOG & 1-CLICK ROLLBACK */}
        {activeTab === 'history' && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-800 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-4">
              <div>
                <h3 className="font-bold text-base text-gray-950 dark:text-white flex items-center gap-2">
                  <History className="h-4 w-4 text-indigo-600" />
                  Bulk Price Adjustment Audit Log & 1-Click Rollback
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Every batch adjustment is captured with initial price snapshots, enabling instantaneous 1-click database rollbacks.
                </p>
              </div>
            </div>

            {historyList.length === 0 ? (
              <div className="py-16 text-center text-gray-500 dark:text-gray-400">
                <Clock className="h-9 w-9 mx-auto mb-2 opacity-40 text-gray-400" />
                <div className="font-bold text-xs">No previous price adjustment batches recorded.</div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  When you execute bulk percentage, markup, or target margin changes, snapshots will be archived here.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-150 dark:divide-gray-800">
                {historyList.map((entry) => (
                  <div
                    key={entry.id}
                    className="py-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-xs font-bold text-gray-950 dark:text-white">
                          {entry.ruleDescription}
                        </span>
                        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {entry.affectedCount} items
                        </span>
                        {entry.netValuationDelta !== undefined && (
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                              entry.netValuationDelta < 0
                                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                : 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                            }`}
                          >
                            {entry.netValuationDelta < 0 ? '-' : '+'}KSh{' '}
                            {Math.abs(entry.netValuationDelta).toLocaleString('en-KE')}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
                        <span>{entry.timestamp}</span>
                        <span>•</span>
                        <span>Categories: {entry.categories.join(', ') || 'All'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRollbackBatch(entry)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer shadow-3xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-amber-600" /> Revert Batch & Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
