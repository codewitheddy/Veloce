/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Search, Filter, Star, Plus, Check, CheckCircle2, ShoppingBag, X, FileText, Sparkles, User, Heart, ArrowLeft, Tag, Share2, Clock, ArrowRightLeft, Twitter, Linkedin, Bell, Mail, ArrowUpDown, Package, Layers, ChevronLeft, ChevronRight, ChevronDown, ShoppingCart, FolderTree, Edit2, Edit3, Flame, ShieldCheck, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { Product, CartItem, Review } from '../types';
import {
  isProductHiddenFromStorefront,
  getCategoryType,
  getExpiryStatus,
  getSubcategoriesForCategory,
  getProductDiscountInfo,
  getCountryFlag,
  resolveProductVariant,
  getProductColorImages,
  resolveColorHex,
} from '../utils/productUtils';
import { loadCategoriesFromStorage, fetchCategoriesFromBackend } from '../utils/categoryUtils';

import ProductShareModal from './ProductShareModal';
import ProductCompareModal from './ProductCompareModal';
import { CurrencyType, formatPrice } from '../lib/currency';
import BestSellersNewArrivalsCarousel from './BestSellersNewArrivalsCarousel';
import ProductReviewsView from './ProductReviewsView';
import LazyImage from './LazyImage';
import RecentlyViewedSlider from './RecentlyViewedSlider';
import { formatRichDescription, cleanDescriptionExcerpt } from '../utils/formatDescription';

interface ProductStoreProps {
  products: Product[];
  cart?: CartItem[];
  onAddToCart: (product: Product, quantity: number, vars: Record<string, string>) => void;
  onUpdateCartQty?: (productId: string, vars: Record<string, string>, qty: number) => void;
  onRemoveFromCart?: (productId: string, vars: Record<string, string>) => void;
  onBuyNow?: (product: Product, quantity: number, vars: Record<string, string>) => void;
  onViewCart?: () => void;
  onAddReview: (productId: string, review: Review) => void;
  selectedProduct: Product | null;
  setSelectedProduct: (product: Product | null) => void;
  prefilledReviewerName?: string;
  wishlist?: string[];
  onToggleWishlist?: (productId: string) => void;
  darkMode?: boolean;
  currency?: CurrencyType;
  searchQuery?: string;
  onSearchQueryChange?: (val: string) => void;
  currentUserEmail?: string;
  currentUserName?: string;
  currentUserId?: string | number;
  initialDeepLinkRating?: number;
  initialDeepLinkOrderId?: string;
  initialCategory?: string;
  initialSubcategory?: string;
  initialFilterType?: 'All' | 'physical' | 'digital' | 'service' | 'wishlist' | 'sale';
  onCategoryChange?: (category: string, subcategory?: string) => void;
  onFilterTypeChange?: (filterType: 'All' | 'physical' | 'digital' | 'service' | 'wishlist' | 'sale') => void;
  onOpenAuthModal?: () => void;
  onProductUpdate?: (updatedProduct: Product) => void;
  onTriggerEmailToast?: (toast: any) => void;
  onEditProduct?: (product: Product) => void;
}

export default function ProductStore({
  products,
  cart = [],
  onAddToCart,
  onUpdateCartQty,
  onRemoveFromCart,
  onBuyNow,
  onViewCart,
  onAddReview,
  selectedProduct,
  setSelectedProduct,
  prefilledReviewerName = '',
  wishlist = [],
  onToggleWishlist = () => {},
  darkMode = false,
  currency = 'KSh',
  searchQuery,
  onSearchQueryChange,
  currentUserEmail,
  currentUserName,
  currentUserId,
  initialDeepLinkRating,
  initialDeepLinkOrderId,
  initialCategory,
  initialSubcategory,
  initialFilterType,
  onCategoryChange,
  onFilterTypeChange,
  onOpenAuthModal,
  onProductUpdate,
  onTriggerEmailToast,
  onEditProduct,
}: ProductStoreProps) {
  const [localSearch, setLocalSearch] = useState('');
  const search = searchQuery !== undefined ? searchQuery : localSearch;
  const setSearch = onSearchQueryChange !== undefined ? onSearchQueryChange : setLocalSearch;

  const [reviewsViewProduct, setReviewsViewProduct] = useState<Product | null>(null);

  const [activeCategory, setActiveCategory] = useState(initialCategory || 'All');
  const [activeSubcategory, setActiveSubcategory] = useState(initialSubcategory || 'All');
  const [activeType, setActiveType] = useState<'All' | 'physical' | 'digital' | 'service' | 'wishlist' | 'sale'>(
    initialFilterType || 'All'
  );
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>('featured');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(12);
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');

  // Price Filter States
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');

  const getPaginationItems = (current: number, total: number): (number | 'ellipsis')[] => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis', total];
    }
    if (current >= total - 3) {
      return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
  };

  React.useEffect(() => {
    if (initialCategory !== undefined && initialCategory !== activeCategory) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory]);

  React.useEffect(() => {
    if (initialSubcategory !== undefined && initialSubcategory !== activeSubcategory) {
      setActiveSubcategory(initialSubcategory);
    }
  }, [initialSubcategory]);

  React.useEffect(() => {
    if (initialFilterType !== undefined && initialFilterType !== activeType) {
      setActiveType(initialFilterType);
    }
  }, [initialFilterType]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, activeCategory, activeSubcategory, activeType, sortBy, minPrice, maxPrice]);

  const [storedCategories, setStoredCategories] = useState(() => loadCategoriesFromStorage());

  React.useEffect(() => {
    fetchCategoriesFromBackend().then((cats) => {
      if (cats && Array.isArray(cats)) {
        setStoredCategories(cats);
      }
    });

    const handleCategoriesChanged = (e?: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent && customEvent.detail && Array.isArray(customEvent.detail)) {
        setStoredCategories(customEvent.detail);
      } else {
        fetchCategoriesFromBackend().then((cats) => {
          if (cats && Array.isArray(cats)) {
            setStoredCategories(cats);
          }
        });
      }
    };

    window.addEventListener('storage', handleCategoriesChanged);
    window.addEventListener('veloce_categories_updated', handleCategoriesChanged);
    return () => {
      window.removeEventListener('storage', handleCategoriesChanged);
      window.removeEventListener('veloce_categories_updated', handleCategoriesChanged);
    };
  }, []);

  React.useEffect(() => {
    if (!selectedProduct) {
      setReviewsViewProduct(null);
    }
  }, [selectedProduct]);
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('veloce_recently_viewed');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Price-drop notifications state
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySuccessMsg, setNotifySuccessMsg] = useState('');
  const [notifyErrorMsg, setNotifyErrorMsg] = useState('');
  const [priceTrackers, setPriceTrackers] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('veloce_price_trackers');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [detailActiveTab, setDetailActiveTab] = useState<'description' | 'specifications' | 'features' | 'whatsInTheBox' | 'categoryInfo'>('description');

  const handleQuickIncrement = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    const existingItems = cart.filter(item => item.product.id === product.id);
    if (existingItems.length > 0) {
      // Increment the first item
      const firstItem = existingItems[0];
      const maxStock = product.stock !== null && product.stock !== undefined ? product.stock : 999;
      if (firstItem.quantity < maxStock && onUpdateCartQty) {
        onUpdateCartQty(product.id, firstItem.selectedVariations, firstItem.quantity + 1);
      }
    } else {
      // Add new with default variations
      const defaultVars: Record<string, string> = {};
      if (product.variations) {
        product.variations.forEach(v => {
          if (v.options && v.options.length > 0) {
            defaultVars[v.name] = v.options[0];
          }
        });
      }
      onAddToCart(product, 1, defaultVars);
    }
  };

  const handleQuickDecrement = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    const existingItems = cart.filter(item => item.product.id === product.id);
    if (existingItems.length > 0) {
      const firstItem = existingItems[0];
      if (firstItem.quantity > 1 && onUpdateCartQty) {
        onUpdateCartQty(product.id, firstItem.selectedVariations, firstItem.quantity - 1);
      } else if (firstItem.quantity === 1 && onRemoveFromCart) {
        onRemoveFromCart(product.id, firstItem.selectedVariations);
      }
    }
  };

  React.useEffect(() => {
    if (selectedProduct) {
      setNotifyEmail('');
      setNotifySuccessMsg('');
      setNotifyErrorMsg('');
      setActiveImageIndex(0);
      setDetailActiveTab('description');
      setQuantity(1);
      setAddedToCartToast(false);

      const initialVars: Record<string, string> = {};
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

      const optionsList = selectedProduct.options || [];
      const variantsList = selectedProduct.variantMatrix || selectedProduct.variants || [];

      if (optionsList.length > 0) {
        optionsList.forEach((opt) => {
          const key = opt.name.toLowerCase().trim().replace(/\s+/g, '_');
          const paramVal = urlParams.get(key) || urlParams.get(opt.name);
          if (paramVal && opt.values.some((v) => v.name.toLowerCase() === paramVal.toLowerCase())) {
            const matched = opt.values.find((v) => v.name.toLowerCase() === paramVal.toLowerCase());
            if (matched) initialVars[opt.name.toLowerCase()] = matched.name;
          } else if (opt.values.length > 0) {
            initialVars[opt.name.toLowerCase()] = opt.values[0].name;
          }
        });
      } else if (variantsList.length > 0) {
        const firstAvailable = variantsList.find((v) => v.active !== false && (v.stockQty > 0 || (v.stock ?? 0) > 0)) || variantsList[0];
        if (firstAvailable?.attributes) {
          Object.entries(firstAvailable.attributes).forEach(([k, val]) => {
            const paramVal = urlParams.get(k.toLowerCase()) || urlParams.get(k);
            initialVars[k.toLowerCase()] = paramVal || val;
          });
        }
      } else if (selectedProduct.variations) {
        selectedProduct.variations.forEach((v) => {
          if (v.options && v.options.length > 0) {
            const paramVal = urlParams.get(v.name.toLowerCase()) || urlParams.get(v.name);
            initialVars[v.name.toLowerCase()] = paramVal || v.options[0];
          }
        });
      }
      setSelectedVars(initialVars);

      setRecentlyViewed((prev) => {
        const filtered = prev.filter((id) => id !== selectedProduct.id);
        const updated = [selectedProduct.id, ...filtered].slice(0, 5);
        try {
          localStorage.setItem('veloce_recently_viewed', JSON.stringify(updated));
        } catch (e) {
          console.error(e);
        }
        return updated;
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedProduct, prefilledReviewerName]);

  // Selected variation state for detailed overlay
  const [selectedVars, setSelectedVars] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [addedToCartToast, setAddedToCartToast] = useState(false);
  const [bulkAddedToast, setBulkAddedToast] = useState(false);
  const [detailAddedIds, setDetailAddedIds] = useState<Set<string>>(new Set());

  // Automatically update browser URL search params to reflect active variant selections for seamless sharing
  React.useEffect(() => {
    if (!selectedProduct || typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('product', selectedProduct.id);
      Object.entries(selectedVars).forEach(([k, v]) => {
        if (v) {
          url.searchParams.set(k.toLowerCase().trim().replace(/\s+/g, '_'), v);
        }
      });
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      // ignore
    }
  }, [selectedProduct, selectedVars]);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareTargetProduct, setShareTargetProduct] = useState<Product | null>(null);

  const handleShareProduct = async (product: Product, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const shareUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Check out this incredible workspace item: ${product.name} — ${product.description.substring(0, 100)}...`,
          url: shareUrl,
        });
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.warn('Web Share failed, displaying sharing modal:', err);
          setShareTargetProduct(product);
          setIsShareModalOpen(true);
        }
      }
    } else {
      setShareTargetProduct(product);
      setIsShareModalOpen(true);
    }
  };

  // Split-screen product comparison states
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareLeftId, setCompareLeftId] = useState<string | undefined>(undefined);
  const [compareRightId, setCompareRightId] = useState<string | undefined>(undefined);

  // Hover to zoom image states
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [isZoomed, setIsZoomed] = useState(false);

  // 'Recommended for You' recommendation engine based on wishlist items
  const recommendedProducts = React.useMemo(() => {
    const wishlistSet = new Set(wishlist);
    const wishlistItems = products.filter((p) => wishlistSet.has(p.id));
    
    // If the wishlist is empty, suggest the top rated/featured items excluding items in wishlist
    if (wishlistItems.length === 0) {
      return [...products]
        .sort((a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount)
        .slice(0, 8);
    }

    const wishlistCategories = new Set(wishlistItems.map((p) => p.category));
    const wishlistTags = new Set(wishlistItems.flatMap((p) => p.tags || []));

    // Calculate score for each non-wishlist product
    const scoredProducts = products
      .filter((p) => !wishlistSet.has(p.id))
      .map((p) => {
        let score = 0;
        
        // 1. Same category matches
        if (wishlistCategories.has(p.category)) {
          score += 10;
        }

        // 2. Tag overlaps matches
        if (p.tags) {
          p.tags.forEach((tag) => {
            if (wishlistTags.has(tag)) {
              score += 3;
            }
          });
        }

        // 3. Rating & popularity boost
        score += p.rating * 0.5 + (p.reviewsCount || 0) * 0.1;

        return { product: p, score };
      });

    // Sort by score descending and take top 8
    const topScored = scoredProducts
      .sort((a, b) => b.score - a.score)
      .map((item) => item.product);

    // If we have fewer than 8 items, fill in with general top products that aren't in the wishlist
    if (topScored.length < 8) {
      const topScoredIds = new Set(topScored.map((p) => p.id));
      const fallbacks = [...products]
        .filter((p) => !wishlistSet.has(p.id) && !topScoredIds.has(p.id))
        .sort((a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount)
        .slice(0, 8 - topScored.length);
      return [...topScored, ...fallbacks];
    }

    return topScored.slice(0, 8);
  }, [products, wishlist]);

  // Helper function for matching products against selected categories (including parent/child subcategory hierarchies)
  const matchesCategoryForProduct = (p: Product, targetCategory: string) => {
    if (!targetCategory || targetCategory === 'All') return true;

    const targetNorm = targetCategory.trim().toLowerCase();
    const pCatNorm = (p.category || '').trim().toLowerCase();
    const pSubNorm = (p.subcategoryId || '').trim().toLowerCase();

    // 1. Direct exact match
    if (pCatNorm === targetNorm || pSubNorm === targetNorm) {
      return true;
    }

    // 2. Match via stored categories hierarchy (parent with active child subcategories)
    const matchingCatObj = storedCategories.find((c) =>
      c.name.trim().toLowerCase() === targetNorm ||
      c.slug.trim().toLowerCase() === targetNorm ||
      c.id === targetCategory
    );

    if (matchingCatObj) {
      // Find all direct child subcategories belonging to this category
      const childSubs = storedCategories.filter(
        (c) => c.parentId === matchingCatObj.id && c.status === 'Active'
      );
      
      const allowedNames = new Set([
        matchingCatObj.name.trim().toLowerCase(),
        ...childSubs.map((c) => c.name.trim().toLowerCase()),
      ]);
      const allowedSlugs = new Set([
        matchingCatObj.slug.trim().toLowerCase(),
        ...childSubs.map((c) => c.slug.trim().toLowerCase()),
        ...(matchingCatObj.previousSlugs || []).map((s) => s.trim().toLowerCase()),
      ]);
      const allowedIds = new Set([
        matchingCatObj.id,
        ...childSubs.map((c) => c.id),
      ]);

      if (
        allowedNames.has(pCatNorm) ||
        allowedSlugs.has(pCatNorm) ||
        allowedNames.has(pSubNorm) ||
        allowedSlugs.has(pSubNorm) ||
        allowedIds.has(p.category) ||
        allowedIds.has(p.subcategoryId || '')
      ) {
        return true;
      }
    }

    // 3. Clean slug matching fallback (e.g. "thrift-shoes" vs "Thrift Shoes")
    const targetSlug = targetNorm.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const pCatSlug = pCatNorm.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const pSubSlug = pSubNorm.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    return pCatSlug === targetSlug || pSubSlug === targetSlug;
  };

  const matchesSubcategoryForProduct = (p: Product, targetSub: string) => {
    if (!targetSub || targetSub === 'All') return true;
    const targetNorm = targetSub.trim().toLowerCase();
    const pSubNorm = (p.subcategoryId || '').trim().toLowerCase();
    const pCatNorm = (p.category || '').trim().toLowerCase();

    if (pSubNorm === targetNorm || pCatNorm === targetNorm) {
      return true;
    }

    const subObj = storedCategories.find(
      (c) => c.name.trim().toLowerCase() === targetNorm || c.slug.trim().toLowerCase() === targetNorm || c.id === targetSub
    );

    if (subObj) {
      if (
        pSubNorm === subObj.name.trim().toLowerCase() ||
        pSubNorm === subObj.slug.trim().toLowerCase() ||
        pCatNorm === subObj.name.trim().toLowerCase() ||
        pCatNorm === subObj.slug.trim().toLowerCase() ||
        p.subcategoryId === subObj.id ||
        p.category === subObj.id
      ) {
        return true;
      }
    }

    const targetSlug = targetNorm.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const pSubSlug = pSubNorm.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return pSubSlug === targetSlug;
  };

  // Catalog price boundaries
  const catalogPriceBounds = React.useMemo(() => {
    const validProducts = products.filter((p) => !isProductHiddenFromStorefront(p));
    if (validProducts.length === 0) {
      return { min: 0, max: 100000 };
    }
    const prices = validProducts.map((p) => p.price);
    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices)),
    };
  }, [products]);

  // Dynamic price presets based on catalog boundaries
  const pricePresets = React.useMemo(() => {
    const { min, max } = catalogPriceBounds;
    if (max <= min) return [];

    if (max <= 5000) {
      return [
        { label: `Under ${formatPrice(1000, currency)}`, min: '' as const, max: 1000 },
        { label: `${formatPrice(1000, currency)} – ${formatPrice(2500, currency)}`, min: 1000, max: 2500 },
        { label: `${formatPrice(2500, currency)} – ${formatPrice(5000, currency)}`, min: 2500, max: 5000 },
        { label: `Over ${formatPrice(5000, currency)}`, min: 5000, max: '' as const },
      ];
    } else if (max <= 25000) {
      return [
        { label: `Under ${formatPrice(3000, currency)}`, min: '' as const, max: 3000 },
        { label: `${formatPrice(3000, currency)} – ${formatPrice(8000, currency)}`, min: 3000, max: 8000 },
        { label: `${formatPrice(8000, currency)} – ${formatPrice(15000, currency)}`, min: 8000, max: 15000 },
        { label: `Over ${formatPrice(15000, currency)}`, min: 15000, max: '' as const },
      ];
    } else {
      return [
        { label: `Under ${formatPrice(5000, currency)}`, min: '' as const, max: 5000 },
        { label: `${formatPrice(5000, currency)} – ${formatPrice(15000, currency)}`, min: 5000, max: 15000 },
        { label: `${formatPrice(15000, currency)} – ${formatPrice(35000, currency)}`, min: 15000, max: 35000 },
        { label: `Over ${formatPrice(35000, currency)}`, min: 35000, max: '' as const },
      ];
    }
  }, [catalogPriceBounds, currency]);

  // Filter items
  const filteredProducts = products.filter((p) => {
    // Hide Draft / Archived products & products with <= 8 days to expiry (Spec Automation Rule)
    if (isProductHiddenFromStorefront(p)) {
      return false;
    }
    const searchLower = search.trim().toLowerCase();
    const matchesSearch = !searchLower ||
                          (p.name && p.name.toLowerCase().includes(searchLower)) ||
                          (p.category && p.category.toLowerCase().includes(searchLower)) ||
                          (p.sku && p.sku.toLowerCase().includes(searchLower)) ||
                          (p.description && p.description.toLowerCase().includes(searchLower)) ||
                          (p.tags && p.tags.some((t) => t.toLowerCase().includes(searchLower)));
    const matchesCategory = matchesCategoryForProduct(p, activeCategory);
    const matchesSubcategory = matchesSubcategoryForProduct(p, activeSubcategory);
    const matchesType =
      activeType === 'All' ||
      (activeType === 'wishlist'
        ? wishlist.includes(p.id)
        : activeType === 'sale'
        ? getProductDiscountInfo(p).isOnSale
        : p.type === activeType);
    const matchesPrice =
      (minPrice === '' || p.price >= Number(minPrice)) &&
      (maxPrice === '' || p.price <= Number(maxPrice));
    return matchesSearch && matchesCategory && matchesSubcategory && matchesType && matchesPrice;
  });

  const sortedAndFilteredProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'price-asc') {
      return a.price - b.price;
    }
    if (sortBy === 'price-desc') {
      return b.price - a.price;
    }
    if (sortBy === 'alpha-asc') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'alpha-desc') {
      return b.name.localeCompare(a.name);
    }
    return 0;
  });

  const totalItems = sortedAndFilteredProducts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const paginatedProducts = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedAndFilteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedAndFilteredProducts, currentPage, itemsPerPage]);

  const categories = React.useMemo(() => {
    const stored = storedCategories.filter((c) => c.status === 'Active' && !c.parentId).map((c) => c.name);
    return ['All', ...stored];
  }, [storedCategories]);

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
    if (initialCategory && initialCategory !== 'All') {
      return { [initialCategory]: true };
    }
    return {};
  });

  React.useEffect(() => {
    if (activeCategory && activeCategory !== 'All') {
      setExpandedCategories((prev) => ({ ...prev, [activeCategory]: true }));
    }
  }, [activeCategory]);

  const getSubcategoriesList = React.useCallback((catName: string): string[] => {
    if (!catName || catName === 'All') return [];

    // 1. From storedCategories child items
    const catObj = storedCategories.find(
      (c) =>
        (c.name.trim().toLowerCase() === catName.trim().toLowerCase() ||
         c.slug.trim().toLowerCase() === catName.trim().toLowerCase() ||
         c.id === catName) &&
        (!c.parentId || c.parentId === null)
    );

    if (catObj) {
      const childSubs = storedCategories
        .filter((c) => c.parentId === catObj.id && c.status === 'Active')
        .map((c) => c.name);
      if (childSubs.length > 0) {
        return childSubs;
      }
    }

    // 2. From default/configured subcategories
    const fallback = getSubcategoriesForCategory(catName);
    if (fallback && fallback.length > 0) {
      return fallback;
    }

    // 3. From products matching this category that specify subcategoryId
    const productSubs = Array.from(
      new Set(
        products
          .filter((p) => matchesCategoryForProduct(p, catName) && p.subcategoryId)
          .map((p) => p.subcategoryId as string)
      )
    );
    return productSubs;
  }, [storedCategories, products]);

  const getSubcategoryProductCount = React.useCallback((catName: string, subName: string): number => {
    return products.filter(
      (p) => !isProductHiddenFromStorefront(p) && matchesCategoryForProduct(p, catName) && matchesSubcategoryForProduct(p, subName)
    ).length;
  }, [products, storedCategories]);

  const relevantSubcategories = React.useMemo(() => {
    if (activeCategory !== 'All') {
      return getSubcategoriesList(activeCategory);
    }
    const allStoredSubs = storedCategories.filter((c) => c.parentId && c.status === 'Active').map((c) => c.name);
    return allStoredSubs.length > 0 ? allStoredSubs : [];
  }, [activeCategory, storedCategories, getSubcategoriesList]);

  // When opening a product, initialize variations to first options
  const handleProductSelect = (p: Product) => {
    setSelectedProduct(p);
    setQuantity(1);
    setAddedToCartToast(false);
    const initialVars: Record<string, string> = {};
    if (p.variations) {
      p.variations.forEach((v) => {
        initialVars[v.name] = v.options[0];
      });
    }
    setSelectedVars(initialVars);

    setRecentlyViewed((prev) => {
      const filtered = prev.filter((id) => id !== p.id);
      const updated = [p.id, ...filtered].slice(0, 5);
      try {
        localStorage.setItem('veloce_recently_viewed', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    // Scroll to top of viewport
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRegisterPriceDrop = (e: React.FormEvent, productId: string) => {
    e.preventDefault();
    setNotifySuccessMsg('');
    setNotifyErrorMsg('');

    const email = notifyEmail.trim().toLowerCase();
    if (!email) {
      setNotifyErrorMsg('Please specify a secure, valid email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setNotifyErrorMsg('Invalid email format. Please provide a standard address.');
      return;
    }

    setPriceTrackers((prev) => {
      const currentList = prev[productId] || [];
      if (currentList.includes(email)) {
        setNotifyErrorMsg('This email address is already registered to track this product.');
        return prev;
      }

      const updatedList = [...currentList, email];
      const updated = { ...prev, [productId]: updatedList };

      try {
        localStorage.setItem('veloce_price_trackers', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }

      setNotifySuccessMsg(`Success! ${email} registered for real-time price-drop alerts.`);
      setNotifyEmail('');
      return updated;
    });
  };

  const handleRemovePriceDrop = (productId: string, email: string) => {
    setPriceTrackers((prev) => {
      const currentList = prev[productId] || [];
      const updatedList = currentList.filter((e) => e !== email);
      
      let updated;
      if (updatedList.length === 0) {
        const { [productId]: _, ...rest } = prev;
        updated = rest;
      } else {
        updated = { ...prev, [productId]: updatedList };
      }

      try {
        localStorage.setItem('veloce_price_trackers', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }

      setNotifySuccessMsg(`Removed registration for ${email}.`);
      return updated;
    });
  };

  const handleCartAdd = () => {
    if (!selectedProduct) return;
    onAddToCart(selectedProduct, 1, selectedVars);
    setAddedToCartToast(true);
    setDetailAddedIds((prev) => new Set(prev).add(selectedProduct.id));
    setTimeout(() => {
      setAddedToCartToast(false);
    }, 1500);
  };

  const handleBulkAdd = () => {
    if (!selectedProduct) return;
    onAddToCart(selectedProduct, 6, selectedVars);
    setBulkAddedToast(true);
    setDetailAddedIds((prev) => new Set(prev).add(selectedProduct.id));
    setTimeout(() => {
      setBulkAddedToast(false);
    }, 1800);
  };

  const handleViewCart = () => {
    if (onViewCart) {
      onViewCart();
    } else if (onBuyNow && selectedProduct) {
      onBuyNow(selectedProduct, 0, selectedVars);
    } else {
      window.dispatchEvent(new CustomEvent('veloce_navigate_tab', { detail: 'checkout' }));
    }
  };

  if (reviewsViewProduct) {
    return (
      <ProductReviewsView
        product={reviewsViewProduct}
        userEmail={currentUserEmail || localStorage.getItem('veloce_login_email') || ''}
        userName={currentUserName || localStorage.getItem('veloce_login_name') || ''}
        userId={currentUserId}
        currency={currency}
        initialRating={initialDeepLinkRating}
        initialOrderId={initialDeepLinkOrderId}
        initialOpenForm={Boolean(initialDeepLinkRating || initialDeepLinkOrderId)}
        onBack={() => setReviewsViewProduct(null)}
        onOpenAuthModal={onOpenAuthModal}
        onProductUpdate={(updatedProd) => {
          if (onProductUpdate) onProductUpdate(updatedProd);
        }}
        onTriggerEmailToast={onTriggerEmailToast}
      />
    );
  }

  if (selectedProduct) {
    return (
      <div className="w-full max-w-[1440px] mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Back navigation & Title */}
        <div className="border-b border-gray-150 dark:border-gray-800 pb-5 mb-8 flex flex-col gap-2 relative">
          <button
            onClick={() => setSelectedProduct(null)}
            className="group inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer w-fit"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Catalog Grid
          </button>
          
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            {/* Breadcrumb path */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-mono text-gray-400 dark:text-gray-500 overflow-x-auto scrollbar-none whitespace-nowrap min-w-0 py-0.5">
              <button
                type="button"
                className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer shrink-0 font-medium"
                onClick={() => setSelectedProduct(null)}
              >
                Catalog
              </button>
              <span className="text-slate-300 dark:text-slate-700 shrink-0">/</span>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory(selectedProduct.category);
                  setSelectedProduct(null);
                }}
                className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer shrink-0"
              >
                {selectedProduct.category}
              </button>
              <span className="text-slate-300 dark:text-slate-700 shrink-0">/</span>
              <span className="text-gray-900 dark:text-gray-100 font-semibold truncate max-w-[150px] xs:max-w-[200px] sm:max-w-[320px] md:max-w-none">
                {selectedProduct.name}
              </span>
            </nav>
            
            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0 overflow-x-auto scrollbar-none pt-1 sm:pt-0">
              {onEditProduct && (
                <button
                  type="button"
                  id="btn-admin-edit-product-detail"
                  onClick={() => onEditProduct(selectedProduct)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-2.5 sm:px-3 text-xs font-bold text-amber-800 dark:text-amber-300 transition-all hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer shadow-3xs shrink-0 whitespace-nowrap"
                  title="Edit full specification in Product Editor"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Edit Product</span>
                  <span className="xs:hidden">Edit</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleShareProduct(selectedProduct)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-100 dark:border-gray-800 bg-indigo-50/10 dark:bg-indigo-950/20 px-2.5 sm:px-3 text-xs font-semibold text-indigo-700 dark:text-indigo-350 transition-all hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-200 dark:hover:border-indigo-750 cursor-pointer shadow-3xs shrink-0 whitespace-nowrap"
                title="Share this product"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Share</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleWishlist(selectedProduct.id)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 sm:px-3 text-xs transition-all hover:bg-gray-50 dark:hover:bg-gray-850 cursor-pointer text-gray-600 dark:text-gray-300 shadow-3xs shrink-0 whitespace-nowrap"
              >
                <Heart className={`h-4 w-4 ${wishlist.includes(selectedProduct.id) ? 'fill-current text-rose-500' : 'text-gray-400 dark:text-gray-500'}`} />
                <span>{wishlist.includes(selectedProduct.id) ? 'Saved' : 'Save'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dedicated Two-Column Visual Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Left Column: Color-Aware Dynamic Image Gallery & System Spec Sheet */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {(() => {
              const selectedColorName = selectedVars['color'] || selectedVars['Color'] || '';
              const productImages = getProductColorImages(selectedProduct, selectedColorName);
              const currentImageSrc = productImages[activeImageIndex] || productImages[0] || selectedProduct.imageUrl;

              return (
                <>
                  <div 
                    className="group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900 p-3 sm:p-4 shadow-sm selection:bg-none cursor-zoom-in aspect-square flex items-center justify-center w-full"
                    onMouseEnter={() => setIsZoomed(true)}
                    onMouseLeave={() => setIsZoomed(false)}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                      const y = ((e.clientY - rect.top) / rect.height) * 100;
                      setZoomPosition({ x, y });
                    }}
                  >
                    <div className="relative w-full h-full overflow-hidden rounded-xl bg-white dark:bg-slate-950 flex items-center justify-center p-2 sm:p-4">
                      <LazyImage
                        src={currentImageSrc}
                        alt={`${selectedProduct.name}${selectedColorName ? ` - ${selectedColorName}` : ''}`}
                        className="w-full h-full object-contain object-center rounded-none shadow-xs transition-transform duration-150 ease-out"
                        style={{
                          transform: isZoomed ? 'scale(2.25)' : 'scale(1)',
                          transformOrigin: isZoomed ? `${zoomPosition.x}% ${zoomPosition.y}%` : 'center',
                        }}
                      />
                    </div>
                    
                    <div className="absolute top-5 left-5 rounded-md bg-indigo-600/90 backdrop-blur-xs px-2.5 py-1 text-[10px] font-mono font-extrabold text-white uppercase tracking-wider border border-white/10 shadow-xs pointer-events-none select-none z-10">
                      {selectedColorName ? `${selectedColorName} • ` : ''}{selectedProduct.type} Edition
                    </div>
                    
                    <div className="absolute top-5 right-5 rounded-md bg-gray-950/75 backdrop-blur-xs px-2.5 py-1 text-[9px] font-medium text-white flex items-center gap-1 border border-white/10 shadow-xs pointer-events-none transition-all duration-300 group-hover:scale-95 group-hover:opacity-0 z-10">
                      <svg className="h-3 w-3 animate-pulse text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                      </svg>
                      <span className="font-mono tracking-tight font-bold uppercase text-[8.5px]">Hover to zoom</span>
                    </div>
                  </div>

                  {/* Horizontal Thumbnail Gallery */}
                  {productImages.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {productImages.map((imgUrl, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setActiveImageIndex(index)}
                          className={`relative w-16 h-16 border bg-white dark:bg-slate-900 cursor-pointer transition-all focus:outline-none rounded-lg p-0.5 overflow-hidden ${
                            activeImageIndex === index
                              ? 'border-indigo-600 ring-2 ring-indigo-100 dark:ring-indigo-900'
                              : 'border-gray-200 dark:border-slate-800 hover:border-gray-400 dark:hover:border-slate-600'
                          }`}
                        >
                          <LazyImage
                            src={imgUrl}
                            alt={`${selectedProduct.name} thumbnail ${index + 1}`}
                            className="w-full h-full object-contain object-center rounded-md"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}

            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-5 font-sans leading-relaxed text-xs text-slate-500 dark:text-slate-400">
              <h4 className="font-display font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 text-[10px] mb-2.5 font-mono">System Spec Sheet</h4>
              <ul className="flex flex-col gap-2 font-mono text-[11px]">
                <li className="flex justify-between border-b border-indigo-50/40 dark:border-gray-800/30 pb-1.5">
                  <span className="text-gray-400 dark:text-gray-500">Category:</span>
                  <span className="text-gray-800 dark:text-gray-200 font-bold">{selectedProduct.category}</span>
                </li>
                <li className="flex justify-between border-b border-indigo-50/40 dark:border-gray-800/30 pb-1.5">
                  <span className="text-gray-400 dark:text-gray-500 font-mono">Fulfillment:</span>
                  <span className="text-gray-800 dark:text-gray-200 font-semibold">{selectedProduct.type === 'digital' ? 'Instant Access Link' : 'Secure Parcel Transport'}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-400 dark:text-gray-500 font-mono">Stock Level:</span>
                  <span className="text-gray-800 dark:text-gray-200 font-semibold">
                    {selectedProduct.type === 'physical' ? `${selectedProduct.stock ?? 'Infinite'} units` : 'Instant Access Unlocked'}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column: Copywriting, Purchase Engine & Review Logs */}
          <div className="lg:col-span-7 flex flex-col gap-8">
            {(() => {
              const activeVariant = resolveProductVariant(selectedProduct, selectedVars);
              const effectivePrice = activeVariant?.price !== undefined ? activeVariant.price : selectedProduct.price;
              const effectiveCompareAt = activeVariant?.compareAtPrice !== undefined 
                ? activeVariant.compareAtPrice 
                : (selectedProduct.compareAtPrice || (selectedProduct as any).compare_at_price);
              const effectiveStock = activeVariant?.stockQty !== undefined 
                ? activeVariant.stockQty 
                : (activeVariant?.stock !== undefined ? activeVariant.stock : selectedProduct.stock);
              const effectiveSku = activeVariant?.sku || selectedProduct.sku;
              const isVariantInactive = activeVariant ? activeVariant.active === false : false;
              const isOutOfStock = (selectedProduct.type === 'physical' && effectiveStock !== null && effectiveStock <= 0) || isVariantInactive;

              const hasDiscount = Boolean(effectiveCompareAt && effectiveCompareAt > effectivePrice);
              const discountPercent = hasDiscount && effectiveCompareAt
                ? Math.round(((effectiveCompareAt - effectivePrice) / effectiveCompareAt) * 100)
                : 0;

              // Helper to check if choosing a specific option value results in an out-of-stock combination
              const checkOptionValueStock = (optKey: string, valName: string) => {
                const testVars = { ...selectedVars, [optKey.toLowerCase()]: valName };
                const matched = resolveProductVariant(selectedProduct, testVars);
                if (!matched) return false;
                if (matched.active === false) return true;
                const stock = matched.stockQty !== undefined ? matched.stockQty : matched.stock;
                return stock !== undefined && stock !== null && stock <= 0;
              };

              return (
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-[10px] uppercase tracking-widest font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                        {selectedProduct.category}
                      </span>
                      {selectedProduct.brand && (
                        <>
                          <span className="text-gray-300 dark:text-gray-700 font-mono">•</span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-750 dark:text-gray-200 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200/70 dark:border-gray-700">
                            <Tag className="h-3 w-3 text-indigo-500" />
                            {selectedProduct.brand}
                          </span>
                        </>
                      )}
                      {effectiveSku && (
                        <>
                          <span className="text-gray-300 dark:text-gray-700 font-mono">•</span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-gray-600 dark:text-gray-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            <span className="text-gray-400">SKU:</span>
                            <span className="font-bold">{effectiveSku}</span>
                          </span>
                        </>
                      )}
                      {(selectedProduct.countryOfOrigin || (selectedProduct as any).country_of_origin) && (
                        <>
                          <span className="text-gray-300 dark:text-gray-700 font-mono">•</span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 dark:text-emerald-300 font-mono bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/60">
                            <span>{getCountryFlag(selectedProduct.countryOfOrigin || (selectedProduct as any).country_of_origin)}</span>
                            <span>Origin: {selectedProduct.countryOfOrigin || (selectedProduct as any).country_of_origin}</span>
                          </span>
                        </>
                      )}
                    </div>
                    <h1 className="font-display font-bold text-3xl text-gray-900 dark:text-gray-50 tracking-tight mt-1 leading-tight">{selectedProduct.name}</h1>
                    
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {selectedProduct.reviewsCount > 0 && selectedProduct.rating > 0 ? (
                        <>
                          <div className="flex items-center text-amber-500">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < Math.floor(selectedProduct.rating) ? 'text-amber-500 fill-amber-500' : 'text-gray-200 dark:text-gray-800'
                                }`}
                              />
                            ))}
                          </div>
                          <button
                            onClick={() => setReviewsViewProduct(selectedProduct)}
                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1 font-mono"
                          >
                            <span>{selectedProduct.rating.toFixed(1)} rating ({selectedProduct.reviewsCount} verified review{selectedProduct.reviewsCount === 1 ? '' : 's'})</span>
                            <span className="bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded text-[10px] text-indigo-700 dark:text-indigo-300">View Reviews &rarr;</span>
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">No reviews yet</span>
                          <button
                            onClick={() => setReviewsViewProduct(selectedProduct)}
                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1 font-mono bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg"
                          >
                            <span>Write a review</span>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Price Display & On Sale Badge */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex flex-col">
                        {hasDiscount && effectiveCompareAt && (
                          <span className="font-mono text-xs text-gray-400 dark:text-gray-500 line-through">
                            {formatPrice(effectiveCompareAt, currency)}
                          </span>
                        )}
                        <span className="font-mono font-bold text-xl sm:text-2xl text-indigo-950 dark:text-indigo-300">
                          {formatPrice(effectivePrice, currency)}
                        </span>
                      </div>
                      {hasDiscount && (
                        <span className="rounded-md bg-rose-600 text-white px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-wider shadow-xs flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>ON SALE</span>
                          <span>-{discountPercent}%</span>
                        </span>
                      )}
                    </div>
                  </div>

              {/* Short description overview */}
              {(() => {
                const rawShort = (selectedProduct.shortDescription || (selectedProduct as any).short_description)?.trim();
                const content = rawShort || cleanDescriptionExcerpt(selectedProduct.description, 180);
                if (!content) return null;

                return (
                  <div 
                    className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-normal py-2 space-y-2"
                    dangerouslySetInnerHTML={{
                      __html: formatRichDescription(content)
                    }}
                  />
                );
              })()}

                  {/* Dynamic Variant Options (Color Swatches with Hex & Photo counts, Sizes with Sold Out status) */}
                  {selectedProduct.options && selectedProduct.options.length > 0 ? (
                    <div className="border-t border-indigo-50/50 dark:border-gray-800/50 pt-5 flex flex-col gap-4">
                      {selectedProduct.options.map((opt) => {
                        const optKey = opt.name.toLowerCase().trim().replace(/\s+/g, '_');
                        const isColorOption = optKey === 'color' || opt.name.toLowerCase() === 'colour';
                        const currentVal = selectedVars[optKey] || selectedVars[opt.name.toLowerCase()] || '';

                        return (
                          <div key={opt.id || opt.name} className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide font-mono text-[10px]">
                                {opt.name}: <span className="text-indigo-600 dark:text-indigo-400 font-bold ml-1">{currentVal || 'Select'}</span>
                              </span>
                              {isColorOption && (
                                <span className="text-[10px] text-gray-400 font-mono">
                                  Color-matched gallery
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {opt.values.map((val) => {
                                const isSelected = currentVal.toLowerCase() === val.name.toLowerCase();
                                const isSoldOut = !isColorOption && checkOptionValueStock(optKey, val.name);

                                if (isColorOption) {
                                  const colorImgCount = (selectedProduct.colorImages || (selectedProduct as any).color_images || {})[val.name]?.length || 0;
                                  return (
                                    <button
                                      key={val.id || val.name}
                                      type="button"
                                      onClick={() => {
                                        setSelectedVars((prev) => ({
                                          ...prev,
                                          [optKey]: val.name,
                                          color: val.name,
                                        }));
                                        setActiveImageIndex(0);
                                      }}
                                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-mono font-bold transition-all cursor-pointer shadow-3xs ${
                                        isSelected
                                          ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 ring-2 ring-indigo-500/20'
                                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-850'
                                      }`}
                                    >
                                      <span
                                        className="h-4 w-4 rounded-full border border-black/15 shadow-inner flex-shrink-0"
                                        style={{ backgroundColor: resolveColorHex(val) }}
                                      />
                                      <span>{val.name}</span>
                                      {colorImgCount > 0 && (
                                        <span className="text-[9.5px] font-normal text-gray-400">({colorImgCount})</span>
                                      )}
                                    </button>
                                  );
                                }

                                return (
                                  <button
                                    key={val.id || val.name}
                                    type="button"
                                    onClick={() => setSelectedVars((prev) => ({ ...prev, [optKey]: val.name }))}
                                    className={`relative inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-mono font-bold transition-all cursor-pointer shadow-3xs ${
                                      isSelected
                                        ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 ring-2 ring-indigo-500/20'
                                        : isSoldOut
                                        ? 'border-dashed border-gray-300 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-gray-400 dark:text-gray-600 hover:border-gray-400'
                                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-850'
                                    }`}
                                  >
                                    <span className={isSoldOut ? 'line-through opacity-70' : ''}>{val.name}</span>
                                    {isSoldOut && (
                                      <span className="text-[8.5px] uppercase font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-1 rounded">
                                        Sold out
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : selectedProduct.variantMatrix && selectedProduct.variantMatrix.length > 0 ? (
                    <div className="border-t border-indigo-50/50 dark:border-gray-800/50 pt-5">
                      <h4 className="font-display text-[10px] font-bold uppercase tracking-wider text-indigo-700/85 dark:text-indigo-400 mb-3.5 font-mono flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-indigo-600" /> Select Product Variant & Measurements
                      </h4>
                      <div className="flex flex-col gap-4">
                        {Array.from(new Set(selectedProduct.variantMatrix.flatMap((v) => Object.keys(v.attributes || {})))).map((key) => {
                          const options = Array.from(
                            new Set(selectedProduct.variantMatrix!.map((v) => v.attributes[key]).filter(Boolean))
                          );
                          const isColorKey = key.toLowerCase() === 'color' || key.toLowerCase() === 'colour';

                          return (
                            <div key={key} className="flex flex-col gap-2">
                              <span className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide font-mono text-[10px]">
                                {key.charAt(0).toUpperCase() + key.slice(1)}
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {options.map((opt) => {
                                  const isSelected = selectedVars[key] === opt || selectedVars[key.toLowerCase()] === opt;
                                  const isSoldOut = !isColorKey && checkOptionValueStock(key, opt);

                                  return (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => {
                                        setSelectedVars((prev) => ({ ...prev, [key]: opt, [key.toLowerCase()]: opt }));
                                        if (isColorKey) setActiveImageIndex(0);
                                      }}
                                      className={`rounded-lg border px-3 py-1.5 text-xs transition-colors cursor-pointer font-mono font-bold flex items-center gap-1.5 ${
                                        isSelected
                                          ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/25 text-indigo-900 dark:text-indigo-200 shadow-3xs'
                                          : isSoldOut
                                          ? 'border-dashed border-gray-300 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-gray-400 dark:text-gray-600'
                                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850'
                                      }`}
                                    >
                                      <span className={isSoldOut ? 'line-through' : ''}>{opt}</span>
                                      {isSoldOut && (
                                        <span className="text-[8.5px] uppercase font-bold text-rose-600 dark:text-rose-400">Sold out</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : selectedProduct.variations && selectedProduct.variations.length > 0 ? (
                    <div className="border-t border-indigo-50/50 dark:border-gray-800/50 pt-5">
                      <h4 className="font-display text-[10px] font-bold uppercase tracking-wider text-indigo-700/85 dark:text-indigo-400 mb-3.5 font-mono">Select Configuration Option</h4>
                      <div className="flex flex-col gap-4.5">
                        {selectedProduct.variations.map((v) => (
                          <div key={v.name} className="flex flex-col gap-2">
                            <span className="text-xs font-bold text-gray-850 dark:text-gray-300 uppercase tracking-wide font-mono text-[10px]">{v.name}</span>
                            <div className="flex flex-wrap gap-2">
                              {v.options.map((opt) => (
                                <button
                                  key={opt}
                                  onClick={() => setSelectedVars((prev) => ({ ...prev, [v.name]: opt, [v.name.toLowerCase()]: opt }))}
                                  className={`rounded-md border px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                                    selectedVars[v.name] === opt || selectedVars[v.name.toLowerCase()] === opt
                                      ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/25 text-indigo-900 dark:text-indigo-200 font-semibold shadow-3xs'
                                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-855 hover:border-gray-300 dark:hover:border-gray-700'
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Stock Inventory Notice */}
                  {selectedProduct.type === 'physical' && (
                    <div className="border-t border-indigo-50/50 dark:border-gray-800/50 pt-5 text-xs font-mono">
                      {isOutOfStock ? (
                        <span className="text-red-700 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 px-3 py-1.5 rounded-lg flex items-center gap-2 w-fit">
                          ✕ {isVariantInactive ? 'Option Unavailable' : 'Out of Stock'}
                        </span>
                      ) : (
                        <span className={`font-medium rounded-lg px-3 py-1.5 flex items-center gap-2 w-fit border ${
                          effectiveStock !== null && effectiveStock <= 5
                            ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
                            : 'text-emerald-700 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/15 border-emerald-100/50 dark:border-emerald-900/40'
                        }`}>
                          ✓ {effectiveStock !== null ? `${effectiveStock} units available` : 'In stock & ready to ship'}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Purchase Box */}
                  <div className="mt-4 rounded-2xl border border-indigo-100/80 dark:border-gray-800/85 bg-indigo-50/10 dark:bg-indigo-950/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-[0_2px_4px_rgba(37,44,139,0.02)]">
                    <div>
                      <span className="text-[10px] text-indigo-650 dark:text-indigo-400 font-mono font-bold tracking-widest block uppercase">TOTAL AMOUNT</span>
                      <div className="flex flex-col">
                        {hasDiscount && effectiveCompareAt && (
                          <span className="font-mono text-xs text-gray-400 dark:text-gray-500 line-through">{formatPrice(effectiveCompareAt, currency)}</span>
                        )}
                        <span className="font-mono text-2xl font-black text-indigo-900 dark:text-indigo-350">{formatPrice(effectivePrice, currency)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      {isOutOfStock ? (
                        <button
                          type="button"
                          disabled
                          className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gray-200 dark:bg-gray-800 px-8 font-display text-xs font-bold text-gray-400 dark:text-gray-500 cursor-not-allowed shadow-xs whitespace-nowrap"
                        >
                          <ShoppingBag className="h-4.5 w-4.5 opacity-50" />
                          <span>{isVariantInactive ? 'Unavailable' : 'Out of Stock'}</span>
                        </button>
                      ) : (() => {
                        const isJustAdded = addedToCartToast;
                        const isInCart = selectedProduct
                          ? (cart && cart.some((item) => item.product?.id === selectedProduct.id || (item as any).productId === selectedProduct.id))
                          : false;
                        const showViewCart = isInCart && !isJustAdded;

                        return (
                          <button
                            type="button"
                            id="btn-detail-add-view-cart"
                            onClick={showViewCart ? handleViewCart : handleCartAdd}
                            className={`w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2.5 rounded-xl px-8 font-display text-sm font-bold transition-all cursor-pointer shadow-md active:scale-95 whitespace-nowrap ${
                              isJustAdded
                                ? 'bg-emerald-600 dark:bg-emerald-500 text-white ring-2 ring-emerald-400/60 shadow-emerald-600/25 animate-pulse'
                                : showViewCart
                                ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white shadow-emerald-600/20 hover:shadow-emerald-600/30 ring-1 ring-emerald-500/50'
                                : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white shadow-indigo-600/25 hover:shadow-indigo-600/35 hover:scale-101'
                            }`}
                            title={isJustAdded ? 'Added to cart successfully!' : showViewCart ? 'Click to proceed to cart and checkout' : 'Add product to cart'}
                          >
                            {isJustAdded ? (
                              <>
                                <Check className="h-4.5 w-4.5 stroke-[2.5]" />
                                <span>Added to Cart!</span>
                              </>
                            ) : showViewCart ? (
                              <>
                                <ShoppingBag className="h-4.5 w-4.5" />
                                <span>View Cart &rarr;</span>
                              </>
                            ) : (
                              <>
                                <ShoppingBag className="h-4.5 w-4.5" />
                                <span>Add to Cart</span>
                              </>
                            )}
                          </button>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Floating Sticky Mobile Buy Bar */}
                  <div className="fixed bottom-14 sm:bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 py-2.5 sm:hidden flex items-center justify-between gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
                    <div className="flex flex-col min-w-0">
                      <span className="font-mono text-[9px] text-slate-400 dark:text-slate-500 uppercase font-bold truncate max-w-[140px]">
                        {selectedProduct.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-base text-indigo-950 dark:text-indigo-300">
                          {formatPrice(effectivePrice, currency)}
                        </span>
                        {hasDiscount && (
                          <span className="text-[9px] font-mono text-rose-500 font-bold">-{discountPercent}%</span>
                        )}
                      </div>
                    </div>
                    {isOutOfStock ? (
                      <button
                        type="button"
                        disabled
                        className="px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200/60 dark:border-slate-700/60 shrink-0"
                      >
                        <ShoppingBag className="h-4 w-4 opacity-50" />
                        <span>{isVariantInactive ? 'Unavailable' : 'Out of Stock'}</span>
                      </button>
                    ) : (() => {
                      const isJustAdded = addedToCartToast;
                      const isInCart = selectedProduct
                        ? (cart && cart.some((item) => item.product?.id === selectedProduct.id || (item as any).productId === selectedProduct.id))
                        : false;
                      const showViewCart = isInCart && !isJustAdded;

                      return (
                        <button
                          type="button"
                          onClick={showViewCart ? handleViewCart : handleCartAdd}
                          className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 active:scale-95 cursor-pointer ${
                            isJustAdded
                              ? 'bg-emerald-600 text-white animate-pulse'
                              : showViewCart
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          {isJustAdded ? (
                            <>
                              <Check className="h-4 w-4 stroke-[2.5]" />
                              <span>Added!</span>
                            </>
                          ) : showViewCart ? (
                            <>
                              <ShoppingBag className="h-4 w-4" />
                              <span>View Cart &rarr;</span>
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="h-4 w-4" />
                              <span>Add to Cart</span>
                            </>
                          )}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}

              {/* Product Specifications, Features, and Detailed Overview Tabs */}
              <div className="border-t border-indigo-50/50 dark:border-gray-800/50 pt-6">
                <div className="flex border-b border-gray-200 dark:border-gray-800 overflow-x-auto scrollbar-none gap-1 sm:gap-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                  <button
                    type="button"
                    onClick={() => setDetailActiveTab('description')}
                    className={`pb-3 text-xs font-bold font-mono uppercase tracking-wider border-b-2 px-3 transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                      detailActiveTab === 'description'
                        ? 'border-indigo-600 text-indigo-705 dark:border-indigo-400 dark:text-indigo-400 font-bold'
                        : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailActiveTab('features')}
                    className={`pb-3 text-xs font-bold font-mono uppercase tracking-wider border-b-2 px-3 transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                      detailActiveTab === 'features'
                        ? 'border-indigo-600 text-indigo-705 dark:border-indigo-400 dark:text-indigo-400 font-bold'
                        : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                  >
                    Features
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailActiveTab('specifications')}
                    className={`pb-3 text-xs font-bold font-mono uppercase tracking-wider border-b-2 px-3 transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                      detailActiveTab === 'specifications'
                        ? 'border-indigo-600 text-indigo-705 dark:border-indigo-400 dark:text-indigo-400 font-bold'
                        : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                  >
                    Specs
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailActiveTab('whatsInTheBox')}
                    className={`pb-3 text-xs font-bold font-mono uppercase tracking-wider border-b-2 px-3 transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                      detailActiveTab === 'whatsInTheBox'
                        ? 'border-indigo-600 text-indigo-705 dark:border-indigo-400 dark:text-indigo-400 font-bold'
                        : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                  >
                    In the Box
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailActiveTab('categoryInfo')}
                    className={`pb-3 text-xs font-bold font-mono uppercase tracking-wider border-b-2 px-3 transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                      detailActiveTab === 'categoryInfo'
                        ? 'border-indigo-600 text-indigo-705 dark:border-indigo-400 dark:text-indigo-400 font-bold'
                        : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                  >
                    Care & Info
                  </button>
                </div>

                <div className="py-5 text-xs text-gray-600 dark:text-gray-350 leading-relaxed font-sans">
                  {detailActiveTab === 'description' && (
                    <div className="flex flex-col gap-3">
                      <h4 className="font-display text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Detailed Description</h4>
                      {(selectedProduct.detailedDescription || (selectedProduct as any).detailed_description || selectedProduct.description) ? (
                        <div 
                          className="prose prose-sm max-w-none dark:prose-invert space-y-2 text-gray-650 dark:text-gray-300"
                          dangerouslySetInnerHTML={{ 
                            __html: formatRichDescription(selectedProduct.detailedDescription || (selectedProduct as any).detailed_description || selectedProduct.description) 
                          }} 
                        />
                      ) : (
                        <p className="font-extralight text-gray-500 italic">No detailed overview provided for this product.</p>
                      )}
                    </div>
                  )}

                  {detailActiveTab === 'features' && (
                    <div className="flex flex-col gap-3">
                      <h4 className="font-display text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Key Highlights & Features</h4>
                      {Array.isArray(selectedProduct.features) && selectedProduct.features.length > 0 ? (
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                          {selectedProduct.features.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs font-normal text-gray-700 dark:text-gray-300">
                              <Check className="h-3.5 w-3.5 text-emerald-550 dark:text-emerald-400 mt-0.5 shrink-0" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="font-extralight text-gray-500 italic">No features listed yet.</p>
                      )}
                    </div>
                  )}

                  {detailActiveTab === 'specifications' && (
                    <div className="flex flex-col gap-3">
                      <h4 className="font-display text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Technical Specifications</h4>
                      {selectedProduct.specifications && selectedProduct.specifications.length > 0 ? (
                        <div className="border border-gray-150 dark:border-gray-800 rounded-xl overflow-hidden shadow-3xs mt-1">
                          <table className="w-full text-left text-xs border-collapse">
                            <tbody>
                              {selectedProduct.specifications.map((spec, idx) => (
                                <tr 
                                  key={idx} 
                                  className={`border-b border-gray-100 dark:border-gray-850/60 ${
                                    idx % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-900/30' : 'bg-white dark:bg-gray-950/20'
                                  }`}
                                >
                                  <td className="py-2.5 px-4 font-mono text-[10px] uppercase font-bold text-gray-400 w-1/3 shrink-0">
                                    {spec.key}
                                  </td>
                                  <td className="py-2.5 px-4 font-semibold text-gray-800 dark:text-gray-250">
                                    {spec.value}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="font-extralight text-gray-500 italic">No detailed specifications logged.</p>
                      )}
                    </div>
                  )}

                  {detailActiveTab === 'whatsInTheBox' && (
                    <div className="flex flex-col gap-3">
                      <h4 className="font-display text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">What’s in the box</h4>
                      {selectedProduct.whatsInTheBox ? (
                        <div className="flex items-start gap-3 rounded-xl border border-indigo-50/80 bg-indigo-50/10 dark:border-gray-800 dark:bg-indigo-950/10 p-4.5 mt-1">
                          <Package className="h-5 w-5 text-indigo-550 dark:text-indigo-400 mt-0.5 shrink-0" />
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 font-mono">Package Ship Contents:</span>
                            <p className="text-xs font-semibold text-gray-750 dark:text-gray-300 leading-relaxed whitespace-pre-line">{selectedProduct.whatsInTheBox}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="font-extralight text-gray-500 italic">Package inventory details not specified.</p>
                      )}
                    </div>
                  )}

                  {detailActiveTab === 'categoryInfo' && (() => {
                    const catType = getCategoryType(selectedProduct.category);
                    return (
                      <div className="flex flex-col gap-4">
                        <h4 className="font-display text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                          Product Disclosures & Care Information
                        </h4>

                        {/* Expiry Badge if applicable */}
                        {selectedProduct.hasExpiryDate && selectedProduct.expiryDate && (
                          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                            <span className="font-bold text-amber-900 dark:text-amber-200">
                              Expiry Date: {selectedProduct.expiryDate}
                            </span>
                          </div>
                        )}

                        {/* Clothes & Wearables */}
                        {catType === 'clothing' && (
                          <div className="space-y-3">
                            {selectedProduct.sizeGuide && (
                              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                                <span className="font-bold text-xs text-indigo-600 block mb-1">Size Guide & Measurements:</span>
                                <p className="text-xs font-mono whitespace-pre-line">{selectedProduct.sizeGuide}</p>
                              </div>
                            )}

                            {selectedProduct.availableSizes && selectedProduct.availableSizes.length > 0 && (
                              <div>
                                <span className="font-bold text-xs text-slate-700 dark:text-slate-300 block mb-1">Available Sizes:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {selectedProduct.availableSizes.map((s) => (
                                    <span key={s} className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-200 border border-indigo-200 text-xs font-bold rounded-lg font-mono">
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {selectedProduct.material && (
                              <p className="text-xs"><strong className="text-slate-900 dark:text-white">Material:</strong> {selectedProduct.material}</p>
                            )}

                            {selectedProduct.colorOptions && selectedProduct.colorOptions.length > 0 && (
                              <div>
                                <span className="font-bold text-xs text-slate-700 dark:text-slate-300 block mb-1">Color Options:</span>
                                <div className="flex flex-wrap gap-1">
                                  {selectedProduct.colorOptions.map((c) => (
                                    <span key={c} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11px] rounded font-medium">
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {selectedProduct.careInstructions && (
                              <p className="text-xs text-slate-600 dark:text-slate-400"><strong>Care Instructions:</strong> {selectedProduct.careInstructions}</p>
                            )}
                          </div>
                        )}

                        {/* Food & Beverages */}
                        {catType === 'food' && (
                          <div className="space-y-3">
                            {selectedProduct.ingredients && (
                              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                                <span className="font-bold text-xs text-indigo-600 block mb-1">Ingredients:</span>
                                <p className="text-xs leading-relaxed">{selectedProduct.ingredients}</p>
                              </div>
                            )}

                            {selectedProduct.allergyInfo && selectedProduct.allergyInfo.length > 0 && (
                              <div>
                                <span className="font-bold text-xs text-rose-600 block mb-1">Allergy Warning:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {selectedProduct.allergyInfo.map((a) => (
                                    <span key={a} className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950 text-rose-900 dark:text-rose-200 border border-rose-200 text-xs font-bold rounded-lg">
                                      ⚠️ {a}
                                    </span>
                                  ))}
                                </div>
                                {selectedProduct.allergyTracesNotes && (
                                  <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1">{selectedProduct.allergyTracesNotes}</p>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {selectedProduct.manufacturer && (
                                <p><strong>Manufacturer:</strong> {selectedProduct.manufacturer}</p>
                              )}
                              {selectedProduct.countryOfOrigin && (
                                <p><strong>Origin:</strong> {selectedProduct.countryOfOrigin}</p>
                              )}
                            </div>

                            {selectedProduct.nutritionalInfo && (
                              <div className="text-xs"><strong>Nutritional Info:</strong> {selectedProduct.nutritionalInfo}</div>
                            )}

                            {selectedProduct.storageInstructions && (
                              <div className="text-xs text-slate-600 dark:text-slate-400"><strong>Storage:</strong> {selectedProduct.storageInstructions}</div>
                            )}
                          </div>
                        )}

                        {/* Perfumes & Beauty */}
                        {catType === 'beauty' && (
                          <div className="space-y-3">
                            {(selectedProduct.beautyIngredients || selectedProduct.ingredients) && (
                              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                                <span className="font-bold text-xs text-indigo-600 block mb-1">INCI Ingredients:</span>
                                <p className="text-xs font-mono leading-relaxed">{selectedProduct.beautyIngredients || selectedProduct.ingredients}</p>
                              </div>
                            )}

                            {selectedProduct.howToUse && (
                              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800">
                                <span className="font-bold text-xs text-purple-900 dark:text-purple-300 block mb-1">How to Use:</span>
                                <p className="text-xs leading-relaxed">{selectedProduct.howToUse}</p>
                              </div>
                            )}

                            <div className="grid grid-cols-3 gap-2 text-xs">
                              {(selectedProduct.beautyManufacturer || selectedProduct.manufacturer) && (
                                <p><strong>Manufacturer:</strong> {selectedProduct.beautyManufacturer || selectedProduct.manufacturer}</p>
                              )}
                              {(selectedProduct.beautyCountryOfOrigin || selectedProduct.countryOfOrigin) && (
                                <p><strong>Origin:</strong> {selectedProduct.beautyCountryOfOrigin || selectedProduct.countryOfOrigin}</p>
                              )}
                              {selectedProduct.volumeNetWeight && (
                                <p><strong>Volume/Net Wt:</strong> {selectedProduct.volumeNetWeight}</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* General Default */}
                        {catType === 'general' && (
                          <div className="space-y-3">
                            {(selectedProduct.brand || selectedProduct.countryOfOrigin || (selectedProduct as any).country_of_origin) && (
                              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 text-xs font-mono">
                                {selectedProduct.brand && (
                                  <div>
                                    <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-bold">Brand / Label</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedProduct.brand}</span>
                                  </div>
                                )}
                                {(selectedProduct.countryOfOrigin || (selectedProduct as any).country_of_origin) && (
                                  <div>
                                    <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-bold">Country of Origin</span>
                                    <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                      <span>{getCountryFlag(selectedProduct.countryOfOrigin || (selectedProduct as any).country_of_origin)}</span>
                                      <span>{selectedProduct.countryOfOrigin || (selectedProduct as any).country_of_origin}</span>
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                            {!selectedProduct.hasExpiryDate && !selectedProduct.brand && !selectedProduct.countryOfOrigin && (
                              <p className="text-xs text-slate-500 italic">No additional category safety or compliance disclosures required for this standard item.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Toast confirmation */}
              {addedToCartToast && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-800 animate-in fade-in duration-200">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">Success: {selectedProduct.name} appended to your Checkout Cart!</span>
                </div>
              )}



            </div>
          </div>

        {isShareModalOpen && shareTargetProduct && (
          <ProductShareModal
            product={shareTargetProduct}
            onClose={() => {
              setIsShareModalOpen(false);
              setShareTargetProduct(null);
            }}
          />
        )}

        {isCompareOpen && (
          <ProductCompareModal
            products={products}
            initialLeftProductId={compareLeftId}
            initialRightProductId={compareRightId}
            onClose={() => setIsCompareOpen(false)}
            onAddToCart={onAddToCart}
          />
        )}

        {/* Customer Feedback Section */}
        {(() => {
          const existingReviews = selectedProduct.reviews || [];
          const totalReviews = existingReviews.length;

          const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
          let sumRating = 0;

          existingReviews.forEach((r) => {
            const s = Math.min(5, Math.max(1, Math.floor(r.rating || 5)));
            counts[s] = (counts[s] || 0) + 1;
            sumRating += r.rating || 5;
          });

          const avgRating = totalReviews > 0 ? sumRating / totalReviews : 0;

          const starBreakdowns = [5, 4, 3, 2, 1].map((star) => ({
            star,
            count: counts[star] || 0,
            percent: totalReviews > 0 ? Math.round(((counts[star] || 0) / totalReviews) * 100) : 0,
          }));

          return (
            <div className="mt-14 rounded-2xl border border-gray-200/90 bg-white dark:bg-gray-900 p-6 sm:p-8 shadow-xs">
              {/* Top Header */}
              <div className="flex items-center justify-between pb-5 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-white">
                    Verified Customer Feedback
                  </h3>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    100% Real Buyers
                  </span>
                </div>
                <button
                  onClick={() => setReviewsViewProduct(selectedProduct)}
                  className="text-xs sm:text-sm font-semibold text-[#f68b1e] hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <span>{totalReviews > 0 ? 'View All & Write Review' : 'Write a Review'}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {totalReviews === 0 ? (
                <div className="text-center py-10 px-4">
                  <div className="h-12 w-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center mx-auto mb-3">
                    <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">No Customer Reviews Yet</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto leading-relaxed">
                    Only verified customers who have bought this product can submit authentic feedback. Have you purchased this item?
                  </p>
                  <button
                    onClick={() => setReviewsViewProduct(selectedProduct)}
                    className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Leave a Verified Review</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-6">
                  {/* Left Column: Verified Ratings */}
                  <div className="md:col-span-4 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      VERIFIED RATINGS ({totalReviews.toLocaleString()})
                    </h4>

                    {/* Rating Summary Box */}
                    <div className="rounded-xl bg-gray-50/90 dark:bg-gray-800/60 border border-gray-150 dark:border-gray-700 p-5 text-center space-y-1.5">
                      <div className="text-3xl sm:text-4xl font-black text-[#f68b1e] font-sans">
                        {avgRating.toFixed(1)}/5
                      </div>
                      <div className="flex items-center justify-center gap-1 text-[#f68b1e]">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star
                            key={idx}
                            className={`h-4 w-4 ${
                              idx < Math.round(avgRating)
                                ? 'fill-[#f68b1e] text-[#f68b1e]'
                                : 'fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium block">
                        {totalReviews.toLocaleString()} verified rating{totalReviews === 1 ? '' : 's'}
                      </span>
                    </div>

                    {/* Star Breakdown Rows */}
                    <div className="space-y-2 text-xs">
                      {starBreakdowns.map(({ star, count, percent }) => (
                        <div key={star} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <span className="w-16 font-mono text-[11px] text-gray-700 dark:text-gray-300 shrink-0">
                            {star} ★ ({count})
                          </span>
                          <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                            <div
                              className="h-full bg-[#f68b1e] rounded-full transition-all duration-300"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Product Reviews */}
                  <div className="md:col-span-8 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      PRODUCT REVIEWS ({totalReviews.toLocaleString()})
                    </h4>

                    <div className="space-y-5">
                      {existingReviews.map((rev, i) => (
                        <div key={rev.id || `rev-${i}`} className="pb-4 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0">
                          <div className="flex items-center gap-0.5 text-[#f68b1e]">
                            {Array.from({ length: 5 }).map((_, idx) => (
                              <Star
                                key={idx}
                                className={`h-3.5 w-3.5 ${
                                  idx < (rev.rating || 5)
                                    ? 'fill-[#f68b1e] text-[#f68b1e]'
                                    : 'fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700'
                                }`}
                              />
                            ))}
                          </div>

                          {rev.title && (
                            <h5 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white mt-1.5">
                              {rev.title}
                            </h5>
                          )}

                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                            {rev.comment}
                          </p>

                          <div className="mt-2.5 flex items-center justify-between text-[11px]">
                            <span className="text-gray-500 dark:text-gray-400 font-mono">
                              {rev.date || 'Recent'} by {rev.reviewerDisplayName || rev.userName || 'Verified Buyer'}
                            </span>

                            <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              Verified Purchase
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* You Might Also Like Component */}
        {(() => {
          const currentTags = (Array.isArray(selectedProduct.tags)
            ? selectedProduct.tags
            : (typeof selectedProduct.tags === 'string' ? (selectedProduct.tags as string).split(',') : [])
          ).map(t => t.trim().toLowerCase()).filter(Boolean);

          const matches = products
            .filter((p) => p.id !== selectedProduct.id)
            .map((p) => {
              const otherTags = (Array.isArray(p.tags)
                ? p.tags
                : (typeof p.tags === 'string' ? (p.tags as string).split(',') : [])
              ).map(t => t.trim().toLowerCase()).filter(Boolean);

              const matchCount = otherTags.filter(t => currentTags.includes(t)).length;
              return { p, matchCount };
            })
            .filter(({ p, matchCount }) => matchCount > 0 || p.category === selectedProduct.category)
            .sort((a, b) => b.matchCount - a.matchCount || b.p.rating - a.p.rating)
            .slice(0, 3);

          if (matches.length === 0) return null;

          return (
            <div className="mt-16 pt-10 border-t border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-display text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-indigo-505" /> You Might Also Like
                  </h3>
                  <p className="text-[11px] text-gray-500 font-extralight mt-0.5">
                    Recommended objects structurally tuned to your active interest by design tags and categories.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {matches.map(({ p, matchCount }) => {
                  const shareUrl = typeof window !== 'undefined' 
                    ? `${window.location.origin}${window.location.pathname}?product=${p.id}` 
                    : `https://ropenix.co.ke/catalog?product=${p.id}`;
                  
                  const shareText = `Check out this incredible ${p.name} on Ropenix Collections! Dynamic high-quality design for active systems.`;
                  const twitterShareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
                  const linkedinShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleProductSelect(p)}
                      className="group relative bg-white border border-gray-150 rounded-xl p-4.5 flex flex-col justify-between hover:border-indigo-200 hover:shadow-[0_4px_12px_rgba(79,70,229,0.04)] transition-all cursor-pointer"
                    >
                      <div>
                        {/* Upper product info row */}
                        <div className="flex gap-4 items-start">
                          <div className="w-16 h-16 rounded-lg border border-gray-100 overflow-hidden bg-gray-50 shrink-0">
                            <LazyImage
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-bold text-indigo-650 bg-indigo-50/50 px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                              {p.category}
                            </span>
                            <h4 className="font-display font-bold text-sm text-gray-950 mt-1.5 group-hover:text-indigo-655 transition-colors line-clamp-1" title={p.name}>
                              {p.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-1">
                              <div className="flex items-center text-amber-500">
                                {Array.from({ length: 5 }).map((_, idx) => (
                                  <Star
                                    key={idx}
                                    className={`h-2.5 w-2.5 ${idx < Math.floor(p.rating) ? 'fill-current text-amber-500' : 'text-gray-200'}`}
                                  />
                                ))}
                              </div>
                              <span className="text-[9px] text-gray-400 font-medium">({p.rating.toFixed(1)})</span>
                            </div>
                          </div>
                        </div>

                        {/* Product tags comparison panel */}
                        <div className="mt-4 flex flex-wrap gap-1">
                          {(Array.isArray(p.tags)
                            ? p.tags
                            : (typeof p.tags === 'string' ? (p.tags as string).split(',') : [])
                          ).map((tag) => {
                            const trimmedTag = tag.trim();
                            const isSharedTag = currentTags.includes(trimmedTag.toLowerCase());
                            return (
                              <span
                                key={trimmedTag}
                                className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-0.5 ${
                                  isSharedTag
                                    ? 'bg-indigo-600 text-white border border-indigo-600 shadow-3xs'
                                    : 'bg-gray-100 text-gray-500 border border-gray-200 font-medium'
                                }`}
                              >
                                <Tag className="h-2 w-2" />
                                {trimmedTag}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Bottom price and social share controls row */}
                      <div className="mt-5 pt-3.5 border-t border-gray-100 flex items-center justify-between">
                        <div>
                          <span className="block text-[8px] font-mono text-gray-400 uppercase tracking-wider font-semibold">Ropenix Price</span>
                          <span className="text-sm font-mono font-bold text-slate-900">KSh {p.price.toLocaleString('en-KE')}</span>
                        </div>

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[8.5px] text-gray-400 font-mono font-bold uppercase tracking-wider">Post:</span>
                          
                          <a
                            href={twitterShareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Post product to Twitter/X"
                            className="h-6.5 w-6.5 rounded-full bg-slate-50 hover:bg-sky-50 text-gray-500 hover:text-sky-600 border border-gray-150 hover:border-sky-200 flex items-center justify-center transition-colors shadow-3xs cursor-pointer"
                          >
                            <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                          </a>

                          <a
                            href={linkedinShareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Post product to LinkedIn"
                            className="h-6.5 w-6.5 rounded-full bg-slate-50 hover:bg-indigo-50 text-gray-500 hover:text-indigo-600 border border-gray-150 hover:border-indigo-200 flex items-center justify-center transition-colors shadow-3xs cursor-pointer"
                          >
                            <Linkedin className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Recently Viewed Objects Component */}
        <RecentlyViewedSlider
          products={products}
          cart={cart}
          onSelectProduct={handleProductSelect}
          onAddToCart={onAddToCart}
          onViewCart={handleViewCart}
          currency={currency}
          className="mt-14"
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Search and Filters Header */}
      <div className="border-b border-gray-100 dark:border-gray-800 pb-6 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-gray-900 dark:text-white">Ropenix Store</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-extralight mt-1">Proprietary high-end workspace objects and downloadable resources.</p>
        </div>
        
        {/* Real-time search by name, description, or tags */}
        <div className="relative w-full md:w-80">
          <Search className="absolute top-3 left-3.5 h-4 w-4 text-indigo-500 dark:text-indigo-400" />
          <input
            id="store-header-search"
            type="text"
            placeholder="Search by name, description, or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-indigo-100 dark:border-gray-800 bg-indigo-50/5 hover:bg-white dark:hover:bg-gray-850 pl-10 pr-9 text-xs font-light text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-all shadow-3xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search input"
              className="absolute right-3 top-3 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 focus:outline-hidden cursor-pointer"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile & Tablet Horizontal Category Chips Strip */}
      <div className="lg:hidden mb-4 overflow-x-auto scrollbar-none -mx-4 px-4 sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2 pb-1 min-w-max">
          <button
            type="button"
            onClick={() => {
              setActiveCategory('All');
              setActiveSubcategory('All');
              setCurrentPage(1);
              if (onCategoryChange) onCategoryChange('All', 'All');
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              activeCategory === 'All' && activeType !== 'sale'
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-300'
            }`}
          >
            <span>All</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
              activeCategory === 'All' && activeType !== 'sale'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>
              {products.filter(p => !isProductHiddenFromStorefront(p)).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveType('sale');
              setCurrentPage(1);
              if (onFilterTypeChange) onFilterTypeChange('sale');
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              activeType === 'sale'
                ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400 hover:border-amber-300'
            }`}
          >
            <Flame className="w-3.5 h-3.5 fill-current text-amber-400" />
            <span>On Sale</span>
          </button>

          {categories.filter(c => c !== 'All').map((cat) => {
            const isCatActive = activeCategory.toLowerCase() === cat.toLowerCase() && activeType !== 'sale';
            const catCount = products.filter(p => !isProductHiddenFromStorefront(p) && matchesCategoryForProduct(p, cat)).length;
            if (catCount === 0) return null;
            return (
              <button
                key={`mobile-cat-pill-${cat}`}
                type="button"
                onClick={() => {
                  setActiveCategory(cat);
                  setActiveSubcategory('All');
                  setActiveType('All');
                  setCurrentPage(1);
                  if (onCategoryChange) onCategoryChange(cat, 'All');
                  if (onFilterTypeChange) onFilterTypeChange('All');
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  isCatActive
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-300'
                }`}
              >
                <span>{cat}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isCatActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}>
                  {catCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Side: Sidebar Filter Column */}
        <div className="lg:col-span-1">
          {/* Mobile Filter Toggle Drawer Action */}
          <div className="flex items-center justify-between lg:hidden bg-indigo-50/40 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 rounded-xl p-3 mb-4 shadow-3xs">
            <button
              onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
              className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200 focus:outline-hidden hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>{isMobileFiltersOpen ? 'Hide Filters & Sorting' : 'Filter & Sort Catalog'}</span>
              {(activeCategory !== 'All' || activeType !== 'All' || search !== '' || minPrice !== '' || maxPrice !== '') && (
                <span className="bg-indigo-600 text-white text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full">
                  Active
                </span>
              )}
            </button>
            <span className="text-[10px] font-mono text-indigo-700 dark:text-indigo-300 font-bold bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md border border-indigo-100 dark:border-slate-700 shadow-2xs">
              {filteredProducts.length} results
            </span>
          </div>

          {/* Actual Filter Controls */}
          <div className={`${isMobileFiltersOpen ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-0 lg:space-y-5' : 'hidden'} lg:block lg:sticky lg:top-6 self-start`}>
            
            {/* Search Input widget */}
            <div className="rounded-xl border border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-3xs">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 font-mono mb-2">Search Catalog</h3>
              <div className="relative">
                <Search className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Keyword search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 pl-9 pr-8 text-xs font-light text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:border-indigo-500 focus:outline-hidden"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    aria-label="Clear keyword search"
                    className="absolute right-2.5 top-3 text-gray-400 hover:text-gray-600 focus:outline-hidden cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter by Type section */}
            <div className="rounded-xl border border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-3xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-800/60">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 font-mono flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-indigo-500" /> Browse by Type
                </h3>
                <span className="text-[9px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.2 rounded">
                  Live
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {[
                  { 
                    id: 'All', 
                    label: 'All Formats', 
                    description: 'Full workspace ledger items',
                    count: products.filter(p => !isProductHiddenFromStorefront(p)).length,
                    icon: <Layers className="h-4 w-4" />,
                    activeBg: 'bg-indigo-600 text-white font-semibold shadow-xs',
                    inactiveBg: 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700',
                    badgeActive: 'bg-white/20 text-white',
                    badgeInactive: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  },
                  { 
                    id: 'sale', 
                    label: 'On Sale Deals', 
                    description: 'Limited-time price markdowns',
                    count: products.filter(p => !isProductHiddenFromStorefront(p) && getProductDiscountInfo(p).isOnSale).length,
                    icon: <Flame className="h-4 w-4 text-amber-500" />,
                    activeBg: 'bg-amber-500 text-white font-semibold shadow-xs',
                    inactiveBg: 'text-slate-600 dark:text-slate-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 border border-transparent hover:border-amber-200 dark:hover:border-amber-900/30',
                    badgeActive: 'bg-white/20 text-white',
                    badgeInactive: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold'
                  },
                  { 
                    id: 'physical', 
                    label: 'Physical Products', 
                    description: 'Shipped premium parcel items',
                    count: products.filter(p => !isProductHiddenFromStorefront(p) && p.type === 'physical').length,
                    icon: <Package className="h-4 w-4" />,
                    activeBg: 'bg-indigo-600 text-white font-semibold shadow-xs',
                    inactiveBg: 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700',
                    badgeActive: 'bg-white/20 text-white',
                    badgeInactive: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  },
                  { 
                    id: 'digital', 
                    label: 'Digital Resources', 
                    description: 'Instant download guides',
                    count: products.filter(p => !isProductHiddenFromStorefront(p) && p.type === 'digital').length,
                    icon: <FileText className="h-4 w-4" />,
                    activeBg: 'bg-indigo-600 text-white font-semibold shadow-xs',
                    inactiveBg: 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700',
                    badgeActive: 'bg-white/20 text-white',
                    badgeInactive: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  },
                  { 
                    id: 'service', 
                    label: 'Services & Support', 
                    description: 'Professional consulting',
                    count: products.filter(p => !isProductHiddenFromStorefront(p) && p.type === 'service').length,
                    icon: <Sparkles className="h-4 w-4" />,
                    activeBg: 'bg-indigo-600 text-white font-semibold shadow-xs',
                    inactiveBg: 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700',
                    badgeActive: 'bg-white/20 text-white',
                    badgeInactive: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  },
                ].map((typeItem) => {
                  const isActive = activeType === typeItem.id;
                  return (
                    <button
                      key={typeItem.id}
                      onClick={() => {
                        setActiveType(typeItem.id as any);
                        if (onFilterTypeChange) {
                          onFilterTypeChange(typeItem.id as any);
                        }
                      }}
                      className={`w-full flex items-start gap-2.5 text-left rounded-lg p-2 transition-all cursor-pointer ${
                        isActive ? typeItem.activeBg : typeItem.inactiveBg
                      }`}
                      id={`sidebar-type-filter-${typeItem.id}`}
                    >
                      <div className={`p-1 rounded shrink-0 ${isActive ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                        {typeItem.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold truncate leading-tight">{typeItem.label}</span>
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                            isActive ? typeItem.badgeActive : typeItem.badgeInactive
                          }`}>
                            {typeItem.count}
                          </span>
                        </div>
                        <p className={`text-[9.5px] mt-0.5 leading-tight truncate ${isActive ? 'text-white/80' : 'text-gray-450 dark:text-gray-500 font-light'}`}>
                          {typeItem.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filter by Price Range section */}
            <div className="rounded-xl border border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-3xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-800/60">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 font-mono flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-500" /> Price Filter
                </h3>
                {(minPrice !== '' || maxPrice !== '') && (
                  <button
                    type="button"
                    onClick={() => {
                      setMinPrice('');
                      setMaxPrice('');
                      setCurrentPage(1);
                    }}
                    className="text-[10px] font-mono font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400 flex items-center gap-0.5 cursor-pointer hover:underline"
                    title="Reset price filter"
                  >
                    <RotateCcw className="h-2.5 w-2.5" /> Reset
                  </button>
                )}
              </div>

              {/* Dual Min/Max Inputs */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="block text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                    Min ({currency})
                  </label>
                  <input
                    type="number"
                    min={catalogPriceBounds.min}
                    max={maxPrice !== '' ? Number(maxPrice) : catalogPriceBounds.max}
                    placeholder={String(catalogPriceBounds.min)}
                    value={minPrice}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                      setMinPrice(val);
                      setCurrentPage(1);
                    }}
                    className="w-full h-8 px-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950 text-xs font-mono text-gray-800 dark:text-gray-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                    Max ({currency})
                  </label>
                  <input
                    type="number"
                    min={minPrice !== '' ? Number(minPrice) : catalogPriceBounds.min}
                    max={catalogPriceBounds.max}
                    placeholder={String(catalogPriceBounds.max)}
                    value={maxPrice}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                      setMaxPrice(val);
                      setCurrentPage(1);
                    }}
                    className="w-full h-8 px-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950 text-xs font-mono text-gray-800 dark:text-gray-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Quick Slider Helper */}
              <div className="space-y-1 mb-3.5">
                <input
                  type="range"
                  min={catalogPriceBounds.min}
                  max={catalogPriceBounds.max}
                  value={maxPrice !== '' ? Number(maxPrice) : catalogPriceBounds.max}
                  onChange={(e) => {
                    setMaxPrice(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex items-center justify-between text-[9px] font-mono text-gray-400">
                  <span>{formatPrice(catalogPriceBounds.min, currency)}</span>
                  <span>{formatPrice(catalogPriceBounds.max, currency)}</span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              {pricePresets.length > 0 && (
                <div className="space-y-1">
                  <span className="block text-[9px] font-mono font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                    Quick Presets
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {pricePresets.map((preset, idx) => {
                      const isPresetActive = minPrice === preset.min && maxPrice === preset.max;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (isPresetActive) {
                              setMinPrice('');
                              setMaxPrice('');
                            } else {
                              setMinPrice(preset.min);
                              setMaxPrice(preset.max);
                            }
                            setCurrentPage(1);
                          }}
                          className={`text-[10px] font-mono px-2 py-1 rounded-md border transition cursor-pointer ${
                            isPresetActive
                              ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-3xs'
                              : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-750 text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-200'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Filter by Category section */}
            <div className="rounded-xl border border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-3xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-800/60">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 font-mono flex items-center gap-1.5">
                  <FolderTree className="h-3.5 w-3.5 text-indigo-500" /> Store Categories
                </h3>
                <span className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400">
                  {categories.length - 1} Categories
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {categories.map((cat) => {
                  if (cat === 'All') {
                    const totalCount = products.filter((p) => !isProductHiddenFromStorefront(p)).length;
                    const isAllActive = activeCategory === 'All';
                    return (
                      <button
                        key="cat-all"
                        type="button"
                        onClick={() => {
                          setActiveCategory('All');
                          setActiveSubcategory('All');
                          setCurrentPage(1);
                          if (onCategoryChange) {
                            onCategoryChange('All', 'All');
                          }
                        }}
                        className={`w-full flex items-center justify-between text-left rounded-lg px-3 py-2 text-xs transition-all cursor-pointer ${
                          isAllActive
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border border-indigo-100/55 dark:border-indigo-900/45 font-semibold shadow-xs'
                            : 'text-gray-650 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850/45 hover:text-gray-900 dark:hover:text-white border border-transparent'
                        }`}
                      >
                        <span className="truncate">All Categories</span>
                        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                          isAllActive ? 'bg-indigo-200/50 dark:bg-indigo-900/50 text-indigo-900 dark:text-indigo-300 font-bold' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                        }`}>
                          {totalCount}
                        </span>
                      </button>
                    );
                  }

                  const subList = getSubcategoriesList(cat);
                  const isExpanded = !!expandedCategories[cat];
                  const isCatActive = activeCategory.toLowerCase() === cat.toLowerCase();
                  const catProductCount = products.filter(
                    (p) => !isProductHiddenFromStorefront(p) && matchesCategoryForProduct(p, cat)
                  ).length;

                  return (
                    <div key={`category-group-${cat}`} className="flex flex-col rounded-lg overflow-hidden">
                      {/* Main Category Header / Dropdown Toggle Button */}
                      <div
                        className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-all ${
                          isCatActive
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border border-indigo-100/55 dark:border-indigo-900/45 font-semibold shadow-xs'
                            : 'text-gray-650 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850/45 hover:text-gray-900 dark:hover:text-white border border-transparent'
                        }`}
                      >
                        <button
                          type="button"
                          className="flex-1 flex items-center gap-2 text-left min-w-0 cursor-pointer"
                          onClick={() => {
                            setActiveCategory(cat);
                            setActiveSubcategory('All');
                            setCurrentPage(1);
                            setExpandedCategories((prev) => ({ ...prev, [cat]: true }));
                            if (onCategoryChange) {
                              onCategoryChange(cat, 'All');
                            }
                          }}
                        >
                          <span className="truncate font-medium">{cat}</span>
                        </button>

                        <div className="flex items-center gap-1 shrink-0 ml-1.5">
                          <span
                            className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                              isCatActive
                                ? 'bg-indigo-200/50 dark:bg-indigo-900/50 text-indigo-900 dark:text-indigo-300 font-bold'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                            }`}
                          >
                            {catProductCount}
                          </span>

                          {subList.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedCategories((prev) => ({
                                  ...prev,
                                  [cat]: !prev[cat],
                                }));
                              }}
                              title={isExpanded ? `Collapse ${cat} subcategories` : `Reveal ${cat} subcategories`}
                              aria-label={isExpanded ? `Collapse ${cat} subcategories` : `Reveal ${cat} subcategories`}
                              className={`p-1 rounded-md transition-colors cursor-pointer ${
                                isCatActive
                                  ? 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/60'
                                  : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                              }`}
                            >
                              <ChevronDown
                                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Subcategories Dropdown Accordion List */}
                      {subList.length > 0 && isExpanded && (
                        <div className="ml-3 pl-2.5 my-1 border-l-2 border-indigo-200 dark:border-indigo-900/60 flex flex-col gap-0.5 animate-in slide-in-from-top-1 duration-150">
                          {/* 'All in Category' option */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCategory(cat);
                              setActiveSubcategory('All');
                              setCurrentPage(1);
                              if (onCategoryChange) {
                                onCategoryChange(cat, 'All');
                              }
                            }}
                            className={`w-full flex items-center justify-between text-left rounded-md px-2.5 py-1.5 text-[11px] transition-colors cursor-pointer ${
                              isCatActive && activeSubcategory === 'All'
                                ? 'bg-indigo-600 text-white font-bold shadow-3xs'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/25 hover:text-indigo-600 dark:hover:text-indigo-300'
                            }`}
                          >
                            <span className="truncate">All {cat}</span>
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full ${
                                isCatActive && activeSubcategory === 'All'
                                  ? 'bg-white/20 text-white font-bold'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                              }`}
                            >
                              {catProductCount}
                            </span>
                          </button>

                          {/* Subcategory items */}
                          {subList.map((sub) => {
                            const isSubSelected = isCatActive && activeSubcategory.toLowerCase() === sub.toLowerCase();
                            const subCount = getSubcategoryProductCount(cat, sub);
                            return (
                              <button
                                key={`sub-item-${cat}-${sub}`}
                                type="button"
                                onClick={() => {
                                  setActiveCategory(cat);
                                  setActiveSubcategory(sub);
                                  setCurrentPage(1);
                                  if (onCategoryChange) {
                                    onCategoryChange(cat, sub);
                                  }
                                }}
                                className={`w-full flex items-center justify-between text-left rounded-md px-2.5 py-1.5 text-[11px] transition-colors cursor-pointer ${
                                  isSubSelected
                                    ? 'bg-indigo-600 text-white font-bold shadow-3xs'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/25 hover:text-indigo-600 dark:hover:text-indigo-300'
                                }`}
                              >
                                <span className="truncate">{sub}</span>
                                <span
                                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full ${
                                    isSubSelected
                                      ? 'bg-white/20 text-white font-bold'
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                                  }`}
                                >
                                  {subCount}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Special Wishlist Filter */}
            <div className="rounded-xl border border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-3xs">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 font-mono mb-2">Catalog Bookmarks</h3>
              <button
                onClick={() => {
                  setActiveType('wishlist');
                  if (onFilterTypeChange) {
                    onFilterTypeChange('wishlist');
                  }
                }}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer border ${
                  activeType === 'wishlist'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-950 dark:text-rose-200 font-bold'
                    : 'bg-white dark:bg-gray-950 border-gray-100 dark:border-gray-850 text-gray-500 dark:text-gray-400 hover:bg-rose-50/10 dark:hover:bg-rose-950/20 hover:border-rose-100 dark:hover:border-rose-900/50'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Heart className={`h-3.5 w-3.5 ${activeType === 'wishlist' ? 'fill-current text-rose-500' : 'text-gray-400 dark:text-gray-500'}`} />
                  View Saved List
                </span>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                  activeType === 'wishlist' ? 'bg-rose-600/15 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                }`}>
                  {wishlist.length}
                </span>
              </button>
            </div>

            {/* Clear Filters helper */}
            {(activeCategory !== 'All' || activeSubcategory !== 'All' || activeType !== 'All' || search !== '' || minPrice !== '' || maxPrice !== '') && (
              <button
                onClick={() => {
                  setSearch('');
                  setActiveCategory('All');
                  setActiveSubcategory('All');
                  setActiveType('All');
                  setMinPrice('');
                  setMaxPrice('');
                  if (onCategoryChange) onCategoryChange('All', 'All');
                  if (onFilterTypeChange) onFilterTypeChange('All');
                }}
                className="w-full h-9 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-400 transition-colors text-xs font-bold text-red-600 dark:text-red-400 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" /> Clear active filters
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Product Catalog Grid */}
        <div className="lg:col-span-3">
          {filteredProducts.length > 0 && (
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold text-gray-500">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'} found in catalog
                </span>
                {activeCategory !== 'All' && (
                  <span className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50 px-2.5 py-0.5 rounded-md text-[11px] font-medium">
                    <span>{activeCategory}</span>
                    {activeSubcategory !== 'All' && (
                      <>
                        <span className="text-indigo-400 dark:text-indigo-500 font-bold">›</span>
                        <span className="font-bold text-indigo-900 dark:text-indigo-200">{activeSubcategory}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSubcategory('All');
                            setCurrentPage(1);
                            if (onCategoryChange) onCategoryChange(activeCategory, 'All');
                          }}
                          className="text-indigo-400 hover:text-red-500 cursor-pointer ml-0.5 transition-colors"
                          title="Reset to all in category"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </span>
                )}
                {(minPrice !== '' || maxPrice !== '') && (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 px-2.5 py-0.5 rounded-md text-[11px] font-medium">
                    <SlidersHorizontal className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      {minPrice !== '' && maxPrice !== ''
                        ? `${formatPrice(Number(minPrice), currency)} – ${formatPrice(Number(maxPrice), currency)}`
                        : minPrice !== ''
                        ? `≥ ${formatPrice(Number(minPrice), currency)}`
                        : `≤ ${formatPrice(Number(maxPrice), currency)}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMinPrice('');
                        setMaxPrice('');
                        setCurrentPage(1);
                      }}
                      className="text-emerald-500 hover:text-red-500 cursor-pointer ml-0.5 transition-colors"
                      title="Clear price filter"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3.5">
                {/* Layout Switcher */}
                <div className="hidden sm:flex items-center bg-gray-55 dark:bg-gray-950 border border-gray-150 dark:border-gray-850 rounded-lg p-0.5 shadow-5xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewLayout('grid')}
                    className={`p-1.5 rounded-md cursor-pointer transition-colors ${viewLayout === 'grid' ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-5xs" : "text-gray-400 dark:text-gray-500 hover:text-gray-650 dark:hover:text-gray-300"}`}
                    title="Grid View"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewLayout('list')}
                    className={`p-1.5 rounded-md cursor-pointer transition-colors ${viewLayout === 'list' ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-5xs" : "text-gray-400 dark:text-gray-500 hover:text-gray-655 dark:hover:text-gray-300"}`}
                    title="List View"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-450 dark:text-gray-500 flex items-center gap-1">
                    <ArrowUpDown className="h-3.5 w-3.5 text-indigo-500" />
                    Sort By:
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="h-8.5 rounded-lg border border-gray-250 dark:border-gray-800 bg-white dark:bg-gray-900 px-3.5 font-mono text-[11px] font-bold text-gray-700 dark:text-gray-300 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-3xs hover:border-indigo-150 transition-colors"
                  >
                  <option value="featured">Featured / Default</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="alpha-asc">Alphabetical: A to Z</option>
                  <option value="alpha-desc">Alphabetical: Z to A</option>
                </select>
              </div>
            </div>
          </div>
        )}
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-gray-200 bg-gray-55/10 bg-gray-50 dark:bg-gray-900/40 dark:border-gray-800 p-6 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mb-3 text-indigo-500">
                <FolderTree className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                {activeType === 'sale'
                  ? 'No Products On Sale'
                  : activeCategory !== 'All'
                  ? `No Products in "${activeCategory}"`
                  : activeType === 'wishlist'
                  ? 'Your Wishlist is Empty'
                  : 'No Products Found'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 font-normal text-xs max-w-md">
                {activeType === 'sale'
                  ? 'There are currently no active promotional or discounted products under this category.'
                  : activeCategory !== 'All'
                  ? `We couldn't find any products currently assigned to "${activeCategory}". Check back soon or browse other categories.`
                  : activeType === 'wishlist'
                  ? 'Save items to your wishlist using the heart icon on any product card.'
                  : 'No items matched your active search query or filter matrix.'}
              </p>
              <div className="flex items-center gap-3 mt-5">
                {activeCategory !== 'All' && (
                  <button
                    onClick={() => {
                      setActiveCategory('All');
                      setActiveSubcategory('All');
                      if (onCategoryChange) onCategoryChange('All', 'All');
                    }}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    View All Categories
                  </button>
                )}
                <button
                  onClick={() => {
                    setSearch('');
                    setActiveCategory('All');
                    setActiveSubcategory('All');
                    setActiveType('All');
                    if (onCategoryChange) onCategoryChange('All', 'All');
                    if (onFilterTypeChange) onFilterTypeChange('All');
                  }}
                  className="px-3.5 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            </div>
          ) : (
            <>
              {viewLayout === 'grid' ? (
                <div className="grid grid-cols-2 gap-y-6 gap-x-3.5 sm:gap-y-8 sm:gap-x-6 lg:grid-cols-3 font-sans">
                  {paginatedProducts.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.4), ease: "easeOut" }}
                      onClick={() => handleProductSelect(product)}
                      className="group flex flex-col justify-between rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 sm:p-4 cursor-pointer transition-all hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md"
                    >
                      <div>
                        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center p-2">
                          <LazyImage
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-contain object-center transition-transform duration-500 group-hover:scale-102"
                          />
                          {/* Heart Toggle Button */}
                          <motion.button
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.85 }}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleWishlist(product.id);
                            }}
                            className="absolute top-2 right-2 z-10 flex h-7.5 w-7.5 items-center justify-center rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-xs hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 transition-all cursor-pointer border border-slate-200 dark:border-slate-800"
                            title={wishlist.includes(product.id) ? "Remove from Wishlist" : "Add to Wishlist"}
                          >
                            <Heart
                              className={`h-4 w-4 transition-all ${
                                wishlist.includes(product.id)
                                  ? 'fill-current text-rose-500'
                                  : 'text-slate-400 dark:text-slate-500 hover:text-rose-500'
                              }`}
                            />
                          </motion.button>
                          {onEditProduct && (
                            <motion.button
                              whileHover={{ scale: 1.15 }}
                              whileTap={{ scale: 0.85 }}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditProduct(product);
                              }}
                              className="absolute top-11 right-2 z-10 flex h-7.5 w-7.5 items-center justify-center rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-xs hover:bg-indigo-50 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer border border-slate-200 dark:border-slate-800"
                              title="Edit product specification (Admin)"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </motion.button>
                          )}
                          <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                            {(() => {
                              const { hasDiscount, discountPercent } = getProductDiscountInfo(product);
                              if (!hasDiscount) return null;
                              return (
                                <div className="rounded bg-amber-500 text-white px-1.5 py-0.5 font-mono text-[8px] sm:text-[9px] font-black uppercase shadow-xs flex items-center gap-1 w-fit">
                                  <Sparkles className="h-2 w-2" />
                                  <span>ON SALE</span>
                                  <span>-{discountPercent}%</span>
                                </div>
                              );
                            })()}
                            <div className="rounded bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-1.5 py-0.5 font-mono text-[8px] sm:text-[9px] font-bold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 uppercase shadow-xs w-fit">
                              {product.type}
                            </div>
                            {product.paymentRestriction && product.paymentRestriction !== 'both' && (
                              <div className={`rounded ${
                                product.paymentRestriction === 'prepaid'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : 'bg-amber-50 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              } backdrop-blur-sm px-1.5 py-0.5 font-mono text-[8px] sm:text-[9px] font-black uppercase shadow-xs w-fit`}>
                                {product.paymentRestriction === 'prepaid' ? 'Prepaid Only' : 'COD Only'}
                              </div>
                            )}
                            {cart.some((item) => item.product.id === product.id) && (
                              <div className="rounded bg-indigo-600 text-white px-1.5 py-0.5 font-mono text-[8px] sm:text-[9px] font-black uppercase shadow-xs flex items-center gap-1 w-fit animate-pulse">
                                <ShoppingCart className="h-2.5 w-2.5 fill-current" /> In Cart
                              </div>
                            )}
                          </div>
                          {product.type === 'physical' ? (
                            product.stock === 0 ? (
                              <div className="absolute bottom-2 right-2 rounded-full bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-2 py-0.5 font-mono text-[8px] sm:text-[9px] font-bold text-red-600 dark:text-red-400">
                                Sold Out
                              </div>
                            ) : product.stock !== null && product.stock <= 5 ? (
                              <div className="absolute bottom-2 right-2 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 px-2 py-0.5 font-mono text-[8px] sm:text-[9px] font-bold text-amber-700 dark:text-amber-400 animate-pulse">
                                {product.stock} left
                              </div>
                            ) : (
                              <div className="absolute bottom-2 right-2 rounded-full bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 px-2 py-0.5 font-mono text-[8px] sm:text-[9px] font-bold text-slate-700 dark:text-slate-300">
                                Qty: {product.stock}
                              </div>
                            )
                          ) : (
                            <div className="absolute bottom-2 right-2 rounded-full bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 px-2 py-0.5 font-mono text-[8px] sm:text-[9px] font-bold text-slate-700 dark:text-slate-300">
                              {product.type === 'digital' ? 'Digital' : 'Service'}
                            </div>
                          )}
                        </div>

                        <div className="mt-3">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] sm:text-[10px] font-bold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase font-mono truncate max-w-[120px] sm:max-w-none">
                              {product.category}{product.subcategoryId ? ` / ${product.subcategoryId}` : ''}
                            </span>
                            {product.reviewsCount > 0 && product.rating > 0 ? (
                              <>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <div className="flex items-center text-amber-500">
                                  <Star className="h-2.5 w-2.5 fill-current" />
                                  <span className="text-[9px] sm:text-[10px] font-bold ml-0.5">{product.rating.toFixed(1)}</span>
                                </div>
                              </>
                            ) : null}
                          </div>
                          <h3 className="font-display font-semibold text-xs sm:text-sm text-slate-900 dark:text-white mt-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-tight line-clamp-1">{product.name}</h3>
                          <p className="mt-1 text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed font-normal">{cleanDescriptionExcerpt(product.shortDescription || product.description, 140)}</p>
                        </div>
                      </div>

                      <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-2.5 flex items-center justify-between gap-1.5">
                        {(() => {
                          const { hasDiscount, originalPrice: originalPriceVal } = getProductDiscountInfo(product);
                          return (
                            <div className="flex flex-col">
                              {hasDiscount && originalPriceVal && (
                                <span className="font-mono text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 line-through">
                                  {formatPrice(originalPriceVal, currency)}
                                </span>
                              )}
                              <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white whitespace-nowrap">
                                {formatPrice(product.price, currency)}
                              </span>
                            </div>
                          );
                        })()}
                        <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-all group-hover:translate-x-0.5">
                          View Details &rarr;
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-5 font-sans">
                  {paginatedProducts.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.4), ease: "easeOut" }}
                      onClick={() => handleProductSelect(product)}
                      className="group flex flex-col md:flex-row gap-5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 cursor-pointer transition-all hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md"
                    >
                      {/* Left Image column */}
                      <div className="relative aspect-video md:aspect-square w-full md:w-44 h-auto md:h-44 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800/60 shrink-0 flex items-center justify-center p-2">
                        <LazyImage
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-full w-full object-contain object-center transition-transform duration-500 group-hover:scale-102"
                        />
                        {/* Bookmark Button */}
                        <motion.button
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.85 }}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleWishlist(product.id);
                          }}
                          className="absolute top-2 right-2 z-10 flex h-7.5 w-7.5 items-center justify-center rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-xs hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 transition-all cursor-pointer border border-slate-200 dark:border-slate-800"
                        >
                          <Heart className={`h-4 w-4 ${wishlist.includes(product.id) ? 'fill-current text-rose-500' : 'text-slate-400 dark:text-slate-500'}`} />
                        </motion.button>
                        {onEditProduct && (
                          <motion.button
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.85 }}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditProduct(product);
                            }}
                            className="absolute top-11 right-2 z-10 flex h-7.5 w-7.5 items-center justify-center rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-xs hover:bg-indigo-50 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer border border-slate-200 dark:border-slate-800"
                            title="Edit product specification (Admin)"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </motion.button>
                        )}
                        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                          {(() => {
                            const { hasDiscount, discountPercent } = getProductDiscountInfo(product);
                            if (!hasDiscount) return null;
                            return (
                              <div className="rounded bg-amber-500 text-white px-1.5 py-0.5 font-mono text-[8px] sm:text-[9px] font-black uppercase shadow-xs flex items-center gap-1 w-fit">
                                <Sparkles className="h-2 w-2" />
                                <span>ON SALE</span>
                                <span>-{discountPercent}%</span>
                              </div>
                            );
                          })()}
                          <div className="rounded bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-1.5 py-0.5 font-mono text-[8px] sm:text-[9px] font-bold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 uppercase shadow-xs w-fit">
                            {product.type}
                          </div>
                          {product.paymentRestriction && product.paymentRestriction !== 'both' && (
                            <div className={`rounded ${
                              product.paymentRestriction === 'prepaid'
                                ? 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-amber-50 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            } backdrop-blur-sm px-1.5 py-0.5 font-mono text-[8px] sm:text-[9px] font-black uppercase shadow-xs w-fit`}>
                              {product.paymentRestriction === 'prepaid' ? 'Prepaid Only' : 'COD Only'}
                            </div>
                          )}
                          {cart.some((item) => item.product.id === product.id) && (
                            <div className="rounded bg-indigo-600 text-white px-1.5 py-0.5 font-mono text-[8px] sm:text-[9px] font-black uppercase shadow-xs flex items-center gap-1 w-fit animate-pulse">
                              <ShoppingCart className="h-2.5 w-2.5 fill-current" /> In Cart
                            </div>
                          )}
                        </div>
                        {product.type === 'physical' ? (
                          product.stock === 0 ? (
                            <div className="absolute bottom-2 right-2 rounded-full bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-2 py-0.5 font-mono text-[8px] sm:text-[9px] font-bold text-red-600 dark:text-red-400">
                              Sold Out
                            </div>
                          ) : product.stock !== null && product.stock <= 5 ? (
                            <div className="absolute bottom-2 right-2 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 px-2 py-0.5 font-mono text-[8px] sm:text-[9px] font-bold text-amber-700 dark:text-amber-400 animate-pulse">
                              {product.stock} left
                            </div>
                          ) : (
                            <div className="absolute bottom-2 right-2 rounded-full bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 px-2 py-0.5 font-mono text-[8px] sm:text-[9px] font-bold text-slate-700 dark:text-slate-300">
                              Qty: {product.stock}
                            </div>
                          )
                        ) : (
                          <div className="absolute bottom-2 right-2 rounded-full bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 px-2 py-0.5 font-mono text-[8px] sm:text-[9px] font-bold text-slate-700 dark:text-slate-300">
                            {product.type === 'digital' ? 'Digital' : 'Service'}
                          </div>
                        )}
                      </div>

                      {/* Right Detail column */}
                      <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[9px] sm:text-[10px] font-bold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase font-mono">{product.category}</span>
                            {product.reviewsCount > 0 && product.rating > 0 ? (
                              <>
                                <span className="text-slate-300 dark:text-slate-700 font-bold">•</span>
                                <div className="flex items-center text-amber-500">
                                  <Star className="h-2.5 w-2.5 fill-current" />
                                  <span className="text-[9px] sm:text-[10px] font-bold ml-0.5">{product.rating.toFixed(1)}</span>
                                </div>
                              </>
                            ) : null}
                          </div>
                          
                          <h3 className="font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-tight truncate max-w-xl">
                            {product.name}
                          </h3>
                          
                          <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed font-normal">
                            {cleanDescriptionExcerpt(product.shortDescription || product.description, 180)}
                          </p>
                        </div>

                        {/* Actions row */}
                        <div className="mt-4 md:mt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 pt-3 md:pt-0 flex flex-row items-center justify-between gap-3 flex-wrap">
                          {(() => {
                            const { hasDiscount, originalPrice: originalPriceVal } = getProductDiscountInfo(product);
                            return (
                              <div className="flex items-baseline gap-2">
                                {hasDiscount && originalPriceVal && (
                                  <span className="font-mono text-xs text-slate-400 dark:text-slate-500 line-through">
                                    {formatPrice(originalPriceVal, currency)}
                                  </span>
                                )}
                                <span className="font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-white whitespace-nowrap">
                                  {formatPrice(product.price, currency)}
                                </span>
                              </div>
                            );
                          })()}
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                          >
                            <span>View Details</span>
                            <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-slate-200/80 dark:border-slate-800 pt-6">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                  <span className="whitespace-nowrap">
                    Showing <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)}</span> to{' '}
                    <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(totalItems, currentPage * itemsPerPage)}</span> of{' '}
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{totalItems}</span> items
                  </span>
                  <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[11px]">Per page:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value={6}>6</option>
                      <option value={12}>12</option>
                      <option value={24}>24</option>
                      <option value={48}>48</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      window.scrollTo({ top: 400, behavior: 'smooth' });
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 hover:bg-indigo-50/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-slate-600 disabled:hover:border-slate-200 cursor-pointer transition-all shadow-xs"
                    title="Previous Page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {getPaginationItems(currentPage, totalPages).map((item, idx) => {
                    if (item === 'ellipsis') {
                      return (
                        <span
                          key={`ellipsis-${idx}`}
                          className="inline-flex h-8 w-6 items-center justify-center text-xs font-mono text-slate-400 dark:text-slate-600 select-none"
                        >
                          ...
                        </span>
                      );
                    }

                    const pageNum = item as number;
                    const isActive = pageNum === currentPage;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => {
                          setCurrentPage(pageNum);
                          window.scrollTo({ top: 400, behavior: 'smooth' });
                        }}
                        className={`inline-flex h-8 min-w-[32px] px-2 items-center justify-center rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
                            : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/10'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                      window.scrollTo({ top: 400, behavior: 'smooth' });
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 hover:bg-indigo-50/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-slate-600 disabled:hover:border-slate-200 cursor-pointer transition-all shadow-xs"
                    title="Next Page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </div>

      {/* Recently Viewed Objects Component */}
      <RecentlyViewedSlider
        products={products}
        cart={cart}
        onSelectProduct={handleProductSelect}
        onAddToCart={onAddToCart}
        onViewCart={onViewCart || handleViewCart}
        currency={currency}
        className="mt-14"
      />

      {/* 'Recommended for You' Section - Placed Just Above the Footer */}
      <div id="store-recommendations-section" className="mt-16 pt-10 border-t border-gray-150 dark:border-gray-800 animate-in fade-in duration-300">
        <div className="flex items-center justify-between mb-4 border-b border-indigo-50/40 dark:border-gray-800 pb-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-display text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 uppercase tracking-wider">
              <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" /> Recommended for You
            </h2>
            <p className="text-[11px] text-gray-550 dark:text-gray-400 font-extralight">
              {wishlist.length > 0 
                ? 'Tailored suggestions based on items in your bookmarked wishlist.' 
                : 'High-end curations selected from our top-tier workspace catalog.'}
            </p>
          </div>
          {wishlist.length > 0 ? (
            <span className="text-[10px] font-mono font-bold bg-indigo-55/10 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/60 px-2.5 py-0.5 rounded-full">
              {wishlist.length} Bookmark{wishlist.length === 1 ? '' : 's'} Active
            </span>
          ) : (
            <span className="text-[10px] font-mono font-bold bg-gray-50 dark:bg-gray-950/45 text-gray-400 dark:text-gray-500 border border-gray-150 dark:border-gray-800/80 px-2.5 py-0.5 rounded-full">
              Catalog Favorites
            </span>
          )}
        </div>

        {/* Horizontal Scrollable Container */}
        <div className="relative">
          <div className="flex gap-5 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800 scroll-smooth">
            {recommendedProducts.map((p, index) => {
              const isSaved = wishlist.includes(p.id);
              return (
                <motion.div
                  key={`rec-${p.id}`}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3), ease: "easeOut" }}
                  onClick={() => handleProductSelect(p)}
                  className="snap-start shrink-0 min-w-[260px] max-w-[260px] group flex flex-col justify-between rounded-xl border border-gray-100 dark:border-gray-800/60 bg-white dark:bg-gray-900 p-4.5 cursor-pointer transition-all hover:border-indigo-150 dark:hover:border-indigo-800 hover:shadow-[0_8px_30px_rgba(43,83,193,0.03)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
                >
                  <div>
                    {/* Image visual wrapper */}
                    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-950">
                      <LazyImage
                        src={p.imageUrl}
                        alt={p.name}
                        className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-103"
                      />
                      
                      {/* Interactive Heart Toggle */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleWishlist(p.id);
                        }}
                        className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 dark:bg-gray-950/95 backdrop-blur-xs shadow-3xs hover:bg-white dark:hover:bg-gray-850 text-gray-400 hover:text-rose-650 transition-all cursor-pointer border border-gray-100 dark:border-gray-800 z-10"
                        title={isSaved ? "Remove from Wishlist" : "Add to Wishlist"}
                      >
                        <Heart
                          className={`h-4 w-4 transition-all ${
                            isSaved
                              ? 'fill-current text-rose-500'
                              : 'text-gray-400 dark:text-gray-500 hover:text-rose-500'
                          }`}
                        />
                      </button>

                      {/* On Sale Badge */}
                      {(() => {
                        const { hasDiscount, discountPercent } = getProductDiscountInfo(p);
                        if (!hasDiscount) return null;
                        return (
                          <span className="absolute top-2 left-2 z-10 rounded bg-rose-600 text-white px-2 py-0.5 font-mono text-[8px] font-black uppercase tracking-wider shadow-xs flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>ON SALE</span>
                            <span>-{discountPercent}%</span>
                          </span>
                        );
                      })()}

                      {/* Item Type Badge */}
                      <span className="absolute bottom-2 left-2 rounded bg-white/95 dark:bg-gray-950/95 backdrop-blur-xs px-2 py-0.5 font-mono text-[8px] font-bold text-indigo-900 dark:text-indigo-300 border border-indigo-50 dark:border-gray-800 uppercase">
                        {p.type}
                      </span>
                    </div>

                    {/* Meta info */}
                    <div className="mt-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold tracking-wider text-indigo-505 dark:text-indigo-455 uppercase font-mono">{p.category}</span>
                        <span className="text-gray-350 dark:text-gray-700">•</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setReviewsViewProduct(p);
                          }}
                          className="flex items-center text-amber-500 hover:scale-105 transition-transform cursor-pointer"
                          title="Click to view verified reviews"
                        >
                          <Star className="h-2.5 w-2.5 fill-current" />
                          <span className="text-[9px] font-bold ml-0.5">{p.rating.toFixed(1)}</span>
                          <span className="text-[8px] font-mono text-gray-400 ml-1 hover:underline">({p.reviewsCount || 0})</span>
                        </button>
                      </div>
                      
                      <h3 className="font-display font-semibold text-xs text-gray-900 dark:text-gray-100 mt-1.5 group-hover:text-indigo-650 dark:group-hover:text-indigo-455 transition-colors uppercase tracking-tight line-clamp-1">{p.name}</h3>
                      <p className="mt-1 text-[11px] text-gray-550 dark:text-gray-400 line-clamp-2 leading-snug font-extralight">{cleanDescriptionExcerpt(p.shortDescription || p.description, 120)}</p>
                    </div>
                  </div>

                  {/* Pricing and Action row */}
                  <div className="mt-4 border-t border-indigo-50/50 dark:border-gray-800/60 pt-3 flex items-center justify-between">
                    {(() => {
                      const { hasDiscount, originalPrice: originalPriceVal } = getProductDiscountInfo(p);
                      return (
                        <div className="flex flex-col">
                          {hasDiscount && originalPriceVal && (
                            <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 line-through">
                              {formatPrice(originalPriceVal, currency)}
                            </span>
                          )}
                          <span className="font-mono font-bold text-xs text-indigo-950 dark:text-indigo-300">
                            {formatPrice(p.price, currency)}
                          </span>
                        </div>
                      );
                    })()}
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 transition-all group-hover:translate-x-0.5">
                      View Details &rarr;
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {isCompareOpen && (
        <ProductCompareModal
          products={products}
          initialLeftProductId={compareLeftId}
          initialRightProductId={compareRightId}
          onClose={() => setIsCompareOpen(false)}
          onAddToCart={onAddToCart}
          currency={currency}
        />
      )}
    </div>
  );
}
