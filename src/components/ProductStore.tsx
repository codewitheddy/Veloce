/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import DOMPurify from 'dompurify';
import { Search, Filter, Star, Plus, Check, ShoppingBag, X, FileText, Sparkles, User, Heart, ArrowLeft, Tag, Share2, Clock, ArrowRightLeft, Twitter, Linkedin, Bell, Mail, ArrowUpDown, Package, Layers, ChevronLeft, ChevronRight, ChevronDown, ShoppingCart, FolderTree, Edit2, Edit3, Flame } from 'lucide-react';
import { Product, CartItem, Review } from '../types';
import {
  isProductHiddenFromStorefront,
  getCategoryType,
  getExpiryStatus,
  getSubcategoriesForCategory,
  getProductDiscountInfo,
} from '../utils/productUtils';
import { loadCategoriesFromStorage, fetchCategoriesFromBackend } from '../utils/categoryUtils';

import ProductShareModal from './ProductShareModal';
import ProductCompareModal from './ProductCompareModal';
import { CurrencyType, formatPrice } from '../lib/currency';
import BestSellersNewArrivalsCarousel from './BestSellersNewArrivalsCarousel';
import ProductReviewsView from './ProductReviewsView';
import LazyImage from './LazyImage';
import { formatRichDescription, cleanDescriptionExcerpt } from '../utils/formatDescription';

interface ProductStoreProps {
  products: Product[];
  cart?: CartItem[];
  onAddToCart: (product: Product, quantity: number, vars: Record<string, string>) => void;
  onUpdateCartQty?: (productId: string, vars: Record<string, string>, qty: number) => void;
  onRemoveFromCart?: (productId: string, vars: Record<string, string>) => void;
  onBuyNow?: (product: Product, quantity: number, vars: Record<string, string>) => void;
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
  }, [search, activeCategory, activeSubcategory, activeType, sortBy]);

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

  // Review form states
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerRating, setReviewerRating] = useState(5);
  const [reviewerComment, setReviewerComment] = useState('');
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState('');

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
      setReviewerName(prefilledReviewerName);
      setReviewSuccessMsg('');
      setReviewerComment('');
      setReviewerRating(5);
      setNotifyEmail('');
      setNotifySuccessMsg('');
      setNotifyErrorMsg('');
      setActiveImageIndex(0);
      setDetailActiveTab('description');
      setQuantity(1);
      setAddedToCartToast(false);

      const initialVars: Record<string, string> = {};
      if (selectedProduct.variations) {
        selectedProduct.variations.forEach((v) => {
          if (v.options && v.options.length > 0) {
            initialVars[v.name] = v.options[0];
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
    return matchesSearch && matchesCategory && matchesSubcategory && matchesType;
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
    setReviewSuccessMsg('');
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

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !reviewerName || !reviewerComment) return;

    const newReview: Review = {
      id: 'rev-usr-' + Date.now(),
      userName: reviewerName,
      rating: reviewerRating,
      comment: reviewerComment,
      date: new Date().toISOString().split('T')[0]
    };

    onAddReview(selectedProduct.id, newReview);
    setReviewerName('');
    setReviewerComment('');
    setReviewSuccessMsg('Your review was successfully authenticated and logged!');
  };

  const handleCartAdd = () => {
    if (!selectedProduct) return;
    onAddToCart(selectedProduct, quantity, selectedVars);
    setAddedToCartToast(true);
    setTimeout(() => {
      setAddedToCartToast(false);
    }, 3000);
  };

  const handleBuyNow = () => {
    if (!selectedProduct) return;
    if (onBuyNow) {
      onBuyNow(selectedProduct, quantity, selectedVars);
    } else {
      onAddToCart(selectedProduct, quantity, selectedVars);
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
          
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-mono text-gray-400 dark:text-gray-500">
              <span className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer" onClick={() => setSelectedProduct(null)}>Catalog</span>
              <span>/</span>
              <span className="text-gray-500 lowercase">{selectedProduct.category}</span>
              <span>/</span>
              <span className="text-gray-900 dark:text-gray-100 font-semibold">{selectedProduct.name}</span>
            </div>
            
            <div className="flex items-center gap-2">
              {onEditProduct && (
                <button
                  type="button"
                  id="btn-admin-edit-product-detail"
                  onClick={() => onEditProduct(selectedProduct)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-3 text-xs font-bold text-amber-800 dark:text-amber-300 transition-all hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer shadow-3xs hover:scale-102"
                  title="Edit full specification in Product Editor"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Edit Product (Admin)</span>
                </button>
              )}

              <button
                onClick={() => handleShareProduct(selectedProduct)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-100 dark:border-gray-800 bg-indigo-50/10 dark:bg-indigo-950/20 px-3 text-xs font-semibold text-indigo-700 dark:text-indigo-350 transition-all hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-200 dark:hover:border-indigo-750 cursor-pointer shadow-3xs hover:scale-102"
                title="Share this product"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Share Product</span>
              </button>

              <button
                onClick={() => onToggleWishlist(selectedProduct.id)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 text-xs transition-all hover:bg-gray-50 dark:hover:bg-gray-850 cursor-pointer text-gray-600 dark:text-gray-300 shadow-3xs"
              >
                <Heart className={`h-4 w-4 ${wishlist.includes(selectedProduct.id) ? 'fill-current text-rose-500' : 'text-gray-400 dark:text-gray-500'}`} />
                {wishlist.includes(selectedProduct.id) ? 'Saved' : 'Save for Later'}
              </button>
            </div>
          </div>
        </div>

        {/* Dedicated Two-Column Visual Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Left Column: Splash Cover Graphic & Technical Attributes */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {(() => {
              const productImages = selectedProduct.images && selectedProduct.images.length > 0 
                ? selectedProduct.images 
                : [selectedProduct.imageUrl];
              const currentImageSrc = productImages[activeImageIndex] || selectedProduct.imageUrl;

              return (
                <>
                  <div 
                    className="group relative overflow-hidden rounded-none border border-indigo-100 bg-gray-50/50 p-4 shadow-[0_2px_8px_rgba(37,44,139,0.03)] selection:bg-none cursor-zoom-in"
                    onMouseEnter={() => setIsZoomed(true)}
                    onMouseLeave={() => setIsZoomed(false)}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                      const y = ((e.clientY - rect.top) / rect.height) * 100;
                      setZoomPosition({ x, y });
                    }}
                  >
                    <div className="relative w-full overflow-hidden rounded-none bg-white">
                      <LazyImage
                        src={currentImageSrc}
                        alt={selectedProduct.name}
                        className="w-full h-auto max-h-[480px] object-cover rounded-none shadow-xs transition-transform duration-150 ease-out"
                        style={{
                          transform: isZoomed ? 'scale(2.25)' : 'scale(1)',
                          transformOrigin: isZoomed ? `${zoomPosition.x}% ${zoomPosition.y}%` : 'center',
                        }}
                      />
                    </div>
                    
                    <div className="absolute top-6 left-6 rounded-none bg-indigo-600/90 backdrop-blur-xs px-2.5 py-1 text-[10px] font-mono font-extrabold text-white uppercase tracking-wider border border-white/10 shadow-xs pointer-events-none select-none">
                      {selectedProduct.type} Edition
                    </div>
                    
                    <div className="absolute top-6 right-6 rounded-none bg-gray-950/75 backdrop-blur-xs px-2.5 py-1 text-[9px] font-medium text-white flex items-center gap-1 border border-white/10 shadow-xs pointer-events-none transition-all duration-300 group-hover:scale-95 group-hover:opacity-0">
                      <svg className="h-3 w-3 animate-pulse text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                      </svg>
                      <span className="font-mono tracking-tight font-bold uppercase text-[8.5px]">Hover to zoom</span>
                    </div>

                    {/* Left & Right Overlay Buttons */}
                    {productImages.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveImageIndex((prev) => (prev === 0 ? productImages.length - 1 : prev - 1));
                          }}
                          className="absolute left-6 top-1/2 -translate-y-1/2 bg-gray-950/70 hover:bg-indigo-600 border border-white/10 text-white p-2 hover:scale-105 transition-all cursor-pointer flex items-center justify-center rounded-none shadow-md z-10"
                          aria-label="Previous image"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveImageIndex((prev) => (prev === productImages.length - 1 ? 0 : prev + 1));
                          }}
                          className="absolute right-6 top-1/2 -translate-y-1/2 bg-gray-950/70 hover:bg-indigo-600 border border-white/10 text-white p-2 hover:scale-105 transition-all cursor-pointer flex items-center justify-center rounded-none shadow-md z-10"
                          aria-label="Next image"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Horizontal Thumbnail Gallery */}
                  {productImages.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {productImages.map((imgUrl, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setActiveImageIndex(index)}
                          className={`relative w-16 h-16 border bg-white cursor-pointer transition-all focus:outline-none rounded-none p-0.5 overflow-hidden ${
                            activeImageIndex === index
                              ? 'border-indigo-600 ring-2 ring-indigo-100'
                              : 'border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          <LazyImage
                            src={imgUrl}
                            alt={`${selectedProduct.name} thumbnail ${index + 1}`}
                            className="w-full h-full object-cover rounded-none"
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
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-[10px] uppercase tracking-widest font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">{selectedProduct.category}</span>
                <h1 className="font-display font-bold text-3xl text-gray-900 dark:text-gray-50 tracking-tight mt-1 leading-tight">{selectedProduct.name}</h1>
                
                <div className="mt-3 flex items-center gap-2 flex-wrap">
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
                    <span>{selectedProduct.rating.toFixed(2)} rating ({selectedProduct.reviewsCount} verified audits)</span>
                    <span className="bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded text-[10px] text-indigo-700 dark:text-indigo-300">View Reviews &rarr;</span>
                  </button>
                </div>

                {/* Price Display & On Sale Badge */}
                {(() => {
                  const { hasDiscount, originalPrice: modalOriginalPrice, discountPercent: modalDiscountPercent } = getProductDiscountInfo(selectedProduct);
                  return (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex flex-col">
                        {hasDiscount && modalOriginalPrice && (
                          <span className="font-mono text-xs text-gray-400 dark:text-gray-500 line-through">
                            KSh {modalOriginalPrice.toLocaleString('en-KE')}
                          </span>
                        )}
                        <span className="font-mono font-bold text-xl sm:text-2xl text-indigo-950 dark:text-indigo-300">
                          KSh {selectedProduct.price.toLocaleString('en-KE')}
                        </span>
                      </div>
                      {hasDiscount && (
                        <span className="rounded-md bg-rose-600 text-white px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-wider shadow-xs flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>ON SALE</span>
                          <span>-{modalDiscountPercent}%</span>
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div 
                className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-normal py-2 space-y-2"
                dangerouslySetInnerHTML={{
                  __html: formatRichDescription(selectedProduct.shortDescription || selectedProduct.description)
                }}
              />              {/* Variant Matrix Selection (Size, Color, Weight/Capacity in kg/lt/ml, Length/Dimensions in cm/m/in, Custom) */}
              {selectedProduct.variantMatrix && selectedProduct.variantMatrix.length > 0 && (() => {
                const attrKeys = Array.from(
                  new Set(selectedProduct.variantMatrix.flatMap((v) => Object.keys(v.attributes || {})))
                );

                const getLabel = (k: string) => {
                  if (k === 'size') return 'Size';
                  if (k === 'color') return 'Color';
                  if (k === 'weight') return 'Weight / Capacity (kg, g, lt, ml)';
                  if (k === 'length') return 'Length / Dimensions (cm, m, in)';
                  return k.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                };

                return (
                  <div className="border-t border-indigo-50/50 dark:border-gray-800/50 pt-5">
                    <h4 className="font-display text-[10px] font-bold uppercase tracking-wider text-indigo-700/85 dark:text-indigo-400 mb-3.5 font-mono flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-indigo-600" /> Select Product Variant & Measurements
                    </h4>
                    <div className="flex flex-col gap-4">
                      {attrKeys.map((key) => {
                        const options = Array.from(
                          new Set(
                            selectedProduct.variantMatrix!
                              .map((v) => v.attributes[key])
                              .filter(Boolean)
                          )
                        );

                        return (
                          <div key={key} className="flex flex-col gap-2">
                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide font-mono text-[10px]">
                              {getLabel(key)}
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {options.map((opt) => {
                                const isSelected = selectedVars[key] === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setSelectedVars((prev) => ({ ...prev, [key]: opt }))}
                                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors cursor-pointer font-mono font-bold ${
                                      isSelected
                                        ? key === 'weight'
                                          ? 'border-amber-500 bg-amber-50/40 text-amber-950 dark:bg-amber-950/30 dark:text-amber-200 shadow-3xs'
                                          : key === 'length'
                                          ? 'border-cyan-500 bg-cyan-50/40 text-cyan-950 dark:bg-cyan-950/30 dark:text-cyan-200 shadow-3xs'
                                          : 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/25 text-indigo-900 dark:text-indigo-200 shadow-3xs'
                                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Variations Selection */}
              {(!selectedProduct.variantMatrix || selectedProduct.variantMatrix.length === 0) && selectedProduct.variations && selectedProduct.variations.length > 0 && (
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
                              onClick={() => setSelectedVars((prev) => ({ ...prev, [v.name]: opt }))}
                              className={`rounded-md border px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                                selectedVars[v.name] === opt
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
              )}

              {/* Stock Inventory Notice */}
              {selectedProduct.type === 'physical' && selectedProduct.stock !== null && (
                <div className="border-t border-indigo-50/50 dark:border-gray-800/50 pt-5 text-xs font-mono">
                  {selectedProduct.stock === 0 ? (
                    <span className="text-red-700 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 px-3 py-1.5 rounded-lg flex items-center gap-2 w-fit">
                      ✕ Out of Stock
                    </span>
                  ) : selectedProduct.stock <= 5 ? (
                    <span className="text-amber-700 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/20 rounded-lg px-3 py-1.5 flex items-center gap-2 w-fit border border-amber-150 dark:border-amber-900/50 animate-pulse">
                      Warning: Highly sought-after. Only {selectedProduct.stock} reserved units remaining in local shop inventory.
                    </span>
                  ) : (
                    <span className="text-emerald-700 dark:text-emerald-450 font-medium bg-emerald-50 dark:bg-emerald-950/15 rounded-lg px-3 py-1.5 flex items-center gap-2 w-fit border border-emerald-100/50 dark:border-emerald-900/40">
                      ✓ In Stock
                    </span>
                  )}
                </div>
              )}

              {/* Volume Discount Module */}
              <div id="volume-discount-module" className="border-t border-indigo-50/50 dark:border-gray-800/50 pt-5 flex flex-col gap-3">
                <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/15 dark:bg-emerald-950/10 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wide font-mono">
                      <Tag className="h-4 w-4 text-emerald-600 dark:text-emerald-500 fill-emerald-100 dark:fill-emerald-950/35" />
                      Bulk Buy Volume Discount
                    </span>
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 text-[9px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      15% SAVINGS UNLOCKED @ &gt;5 UNITS
                    </span>
                  </div>
                  
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-extralight leading-relaxed">
                    Optimize unit margins securely. Order 6 or more units of this item, and an automatic <strong className="font-semibold text-emerald-700 dark:text-emerald-400">15% discount</strong> applies to the entirety of this batch in your checkout ledger!
                  </p>

                  {/* Quantity interactive progress tracker */}
                  <div className="flex flex-col gap-1.5 mt-1">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-gray-400 dark:text-gray-500">Current Order: <strong className="text-gray-700 dark:text-gray-300">{quantity} units</strong></span>
                      {quantity > 5 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          🎉 15% DISCOUNT IN EFFECT! (Saved KSh {(selectedProduct.price * quantity * 0.15).toLocaleString('en-KE')})
                        </span>
                      ) : (
                        <span className="text-indigo-650 font-medium">
                          Add {6 - quantity} more to unlock 15% discount
                        </span>
                      )}
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden border border-gray-150 dark:border-gray-750">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ease-out ${quantity > 5 ? 'bg-emerald-550 bg-emerald-500' : 'bg-indigo-500'}`}
                        style={{ width: `${Math.min(100, (quantity / 6) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Purchase Box */}
              <div className="mt-3 rounded-2xl border border-indigo-100/80 dark:border-gray-800/85 bg-indigo-50/10 dark:bg-indigo-950/20 p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 shadow-[0_2px_4px_rgba(37,44,139,0.02)]">
                <div>
                  <span className="text-[10px] text-indigo-650 dark:text-indigo-400 font-mono font-bold tracking-widest block uppercase">TOTAL AMOUNT</span>
                  {(() => {
                    const { hasDiscount: modalHasDiscount, originalPrice: modalOriginalPrice } = getProductDiscountInfo(selectedProduct);
                    
                    if (quantity > 5) {
                      return (
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-gray-400 dark:text-gray-500 line-through">KSh {(selectedProduct.price * quantity).toLocaleString('en-KE')}</span>
                          <span className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">KSh {(selectedProduct.price * quantity * 0.85).toLocaleString('en-KE')}</span>
                          <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 tracking-tight mt-0.5 animate-pulse">15% VOLUME SAVINGS INCLUDED</span>
                        </div>
                      );
                    }

                    if (modalHasDiscount && modalOriginalPrice) {
                      return (
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-gray-400 dark:text-gray-500 line-through">KSh {(modalOriginalPrice * quantity).toLocaleString('en-KE')}</span>
                          <span className="font-mono text-2xl font-black text-indigo-900 dark:text-indigo-350">KSh {(selectedProduct.price * quantity).toLocaleString('en-KE')}</span>
                        </div>
                      );
                    }

                    return (
                      <span className="font-mono text-2xl font-black text-indigo-900 dark:text-indigo-350">KSh {(selectedProduct.price * quantity).toLocaleString('en-KE')}</span>
                    );
                  })()}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {selectedProduct.type === 'physical' && selectedProduct.stock !== null && (
                    <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-1">
                      <button
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="px-2.5 py-1 text-sm font-semibold text-gray-750 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-850 rounded cursor-pointer disabled:opacity-30"
                        disabled={selectedProduct.stock === 0}
                      >
                        -
                      </button>
                      <span className="px-3.5 font-mono text-xs font-semibold text-gray-800 dark:text-gray-250">{quantity}</span>
                      <button
                        onClick={() => setQuantity((q) => Math.min(selectedProduct.stock !== null && selectedProduct.stock !== undefined ? selectedProduct.stock : 999, q + 1))}
                        className="px-2.5 py-1 text-sm font-semibold text-gray-750 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-850 rounded cursor-pointer disabled:opacity-30"
                        disabled={selectedProduct.stock === 0}
                      >
                        +
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleCartAdd}
                    disabled={selectedProduct.type === 'physical' && selectedProduct.stock === 0}
                    className="flex-1 sm:flex-none inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#111827] dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 px-6 font-display text-xs font-bold text-white transition-all disabled:opacity-40 cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Add to Cart
                  </button>

                  <button
                    onClick={handleBuyNow}
                    disabled={selectedProduct.type === 'physical' && selectedProduct.stock === 0}
                    className="flex-1 sm:flex-none inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-650 px-6 font-display text-xs font-bold text-white transition-all disabled:opacity-40 cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    <Sparkles className="h-4 w-4" />
                    Buy Now
                  </button>
                </div>
              </div>

              {/* Product Specifications, Features, and Detailed Overview Tabs */}
              <div className="border-t border-indigo-50/50 dark:border-gray-800/50 pt-6">
                <div className="flex border-b border-gray-200 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => setDetailActiveTab('description')}
                    className={`pb-3 text-xs font-bold font-mono uppercase tracking-wider border-b-2 px-3 transition-colors ${
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
                    className={`pb-3 text-xs font-bold font-mono uppercase tracking-wider border-b-2 px-3 transition-colors ${
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
                    className={`pb-3 text-xs font-bold font-mono uppercase tracking-wider border-b-2 px-3 transition-colors ${
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
                    className={`pb-3 text-xs font-bold font-mono uppercase tracking-wider border-b-2 px-3 transition-colors ${
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
                    className={`pb-3 text-xs font-bold font-mono uppercase tracking-wider border-b-2 px-3 transition-colors ${
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
                      {(selectedProduct.detailedDescription || selectedProduct.description) ? (
                        <div 
                          className="prose prose-sm max-w-none dark:prose-invert space-y-2 text-gray-650 dark:text-gray-300"
                          dangerouslySetInnerHTML={{ 
                            __html: formatRichDescription(selectedProduct.detailedDescription || selectedProduct.description) 
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
                      {selectedProduct.features && selectedProduct.features.length > 0 ? (
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
                        {catType === 'general' && !selectedProduct.hasExpiryDate && (
                          <p className="text-xs text-slate-500 italic">No additional category safety or compliance disclosures required for this standard item.</p>
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
                  <span className="font-medium">Success: {quantity}x {selectedProduct.name} appended to your Checkout Cart!</span>
                </div>
              )}



              {/* Price-Drop Alerts Widget */}
              <div className="rounded-xl border border-rose-100/60 dark:border-rose-950 bg-rose-50/15 dark:bg-rose-950/5 p-4.5 flex flex-col gap-3.5 shadow-3xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-xs font-bold text-gray-950 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
                    <Bell className="h-4 w-4 text-rose-500 animate-pulse" /> Price-Drop Surveillance
                  </h4>
                  <span className="text-[8px] bg-rose-100/80 dark:bg-rose-950 text-rose-700 dark:text-rose-400 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider uppercase">
                    Active
                  </span>
                </div>
                
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-extralight leading-relaxed font-sans">
                  Enter your address to receive system alerts if <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedProduct.name}</span> decreases below its current price of <span className="font-mono text-gray-800 dark:text-gray-200 font-bold">KSh {selectedProduct.price.toLocaleString('en-KE')}</span>.
                </p>

                <form onSubmit={(e) => handleRegisterPriceDrop(e, selectedProduct.id)} className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                    <input
                      type="email"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      placeholder="Enter your professional email..."
                      className="h-8.5 w-full rounded-lg border border-gray-250 dark:border-gray-800 bg-white dark:bg-gray-900 pl-8 pr-2.5 text-[11px] text-gray-750 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-rose-500 placeholder-gray-300 dark:placeholder-gray-700 font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    className="h-8.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-mono text-[9px] font-bold uppercase tracking-wider px-3.5 rounded-lg transition-all shadow-3xs cursor-pointer inline-flex items-center gap-1 shrink-0"
                  >
                    <Bell className="h-3 w-3" />
                    Track Price
                  </button>
                </form>

                {notifySuccessMsg && (
                  <div className="p-2.5 rounded-lg text-[9.5px] font-mono leading-relaxed bg-emerald-50 text-emerald-800 border border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/30 animate-in fade-in duration-200">
                    ✓ {notifySuccessMsg}
                  </div>
                )}

                {notifyErrorMsg && (
                  <div className="p-2.5 rounded-lg text-[9.5px] font-mono leading-relaxed bg-red-50 text-red-800 border border-red-150 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/30 animate-in fade-in duration-200">
                    ✕ {notifyErrorMsg}
                  </div>
                )}

                {/* Show currently active price trackers registered by this user for this product */}
                {priceTrackers[selectedProduct.id] && priceTrackers[selectedProduct.id].length > 0 && (
                  <div className="mt-1 pt-2.5 border-t border-dashed border-gray-150 dark:border-gray-850 flex flex-col gap-1.5">
                    <span className="text-[8px] font-extrabold text-gray-450 dark:text-gray-500 uppercase tracking-widest pl-0.5 font-mono">
                      Your Registered Alerts ({priceTrackers[selectedProduct.id].length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {priceTrackers[selectedProduct.id].map((email) => (
                        <div
                          key={email}
                          className="inline-flex items-center gap-1.5 bg-slate-900 dark:bg-gray-900 text-indigo-100 dark:text-rose-100 font-mono text-[9px] pl-2 pr-1 py-0.5 rounded-full border border-slate-900 dark:border-gray-800 group/tracker hover:bg-red-950 dark:hover:bg-red-950/50 hover:border-red-900 transition-all shadow-3xs"
                        >
                          <span className="truncate max-w-[140px]">{email}</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePriceDrop(selectedProduct.id, email)}
                            className="h-4 w-4 bg-slate-800 dark:bg-gray-800 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 text-slate-450 dark:text-gray-400 rounded-full flex items-center justify-center transition-colors cursor-pointer text-[8px]"
                            title="Cancel email alert tracking"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Review Logs Section */}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-7">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-gray-900 dark:text-white text-base">Customer Reviews & Audits</h3>
                <button
                  onClick={() => setReviewsViewProduct(selectedProduct)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer font-mono"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Open Reviews Page ({selectedProduct.reviewsCount})
                </button>
              </div>

              {selectedProduct.reviews.length === 0 ? (
                <p className="text-xs text-gray-400 font-extralight italic mb-5">Be the first verified customer to write feedback for this product.</p>
              ) : (
                <div className="flex flex-col gap-4 mb-6">
                  {selectedProduct.reviews.map((rev) => (
                    <div key={rev.id} className="rounded-xl bg-white p-4 border border-indigo-50/50 shadow-3xs flex flex-col gap-2">
                       <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px]">
                            {rev.userName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-gray-800 block leading-none">{rev.userName}</span>
                            <div className="flex items-center text-amber-500 mt-0.5">
                              {Array.from({ length: 5 }).map((_, idx) => (
                                <Star
                                  key={idx}
                                  className={`h-3 w-3 ${idx < Math.floor(rev.rating) ? 'fill-current text-amber-500' : 'text-gray-200'}`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400 font-semibold font-mono">{rev.date}</span>
                      </div>
                      <p className="text-xs text-gray-650 font-extralight mt-1.5 leading-relaxed italic">"{rev.comment}"</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Submission Form */}
              <form onSubmit={handleReviewSubmit} className="border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 bg-white dark:bg-slate-900 shadow-xs">
                <h4 className="font-display text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5 mb-3.5 uppercase tracking-wide font-mono">
                  <Sparkles className="h-4 w-4 text-indigo-600" /> Post Verified Customer Audit
                </h4>
                {reviewSuccessMsg && (
                  <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 text-xs font-medium">
                    {reviewSuccessMsg}
                  </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider mb-1 font-mono">Auditor Name</label>
                    <input
                      type="text"
                      required
                      value={reviewerName}
                      onChange={(e) => setReviewerName(e.target.value)}
                      placeholder="e.g., Jane Sterling"
                      className="h-10 w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3.5 text-xs font-light text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:border-indigo-500 focus:outline-hidden bg-white dark:bg-gray-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider mb-1 font-mono">Metric Score</label>
                    <select
                      value={reviewerRating}
                      onChange={(e) => setReviewerRating(Number(e.target.value))}
                      className="h-10 w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 text-xs font-semibold text-gray-850 dark:text-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-550 focus:outline-hidden bg-white dark:bg-gray-950 cursor-pointer"
                    >
                      <option value={5}>5 Stars - Elite Grade</option>
                      <option value={4}>4 Stars - High Quality</option>
                      <option value={3}>3 Stars - Fair/Decent</option>
                      <option value={2}>2 Stars - Underperforming</option>
                      <option value={1}>1 Star - Flawed</option>
                    </select>
                  </div>
                </div>
                
                <div className="mb-4.5">
                  <label className="block text-[10px] font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider mb-1 font-mono">Detailed Statement</label>
                  <textarea
                    required
                    value={reviewerComment}
                    onChange={(e) => setReviewerComment(e.target.value)}
                    placeholder="Enter your experience details with our structural workshop objects..."
                    rows={4}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3.5 py-2.5 text-xs font-light text-gray-800 dark:text-gray-100 focus:border-indigo-500 focus:outline-hidden bg-white dark:bg-gray-950"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full h-10 rounded-lg bg-[#111827] dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 font-display text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
                >
                  Publish Verified Review
                </button>
              </form>
            </div>
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

        {/* Recently Viewed Component */}
        {recentlyViewed.length > 0 && (
          <div className="mt-16 pt-10 border-t border-gray-100">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-500" />
                <h3 className="font-display text-sm font-semibold text-gray-900">Recently Viewed Objects</h3>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRecentlyViewed([]);
                  try {
                    localStorage.removeItem('veloce_recently_viewed');
                  } catch {}
                }}
                className="text-[10px] font-mono font-bold text-rose-500 hover:text-rose-750 bg-transparent cursor-pointer transition-colors hover:underline"
              >
                Clear History
              </button>
            </div>
            
            <div className="flex items-stretch gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-indigo-100 scrollbar-track-transparent snap-x">
              {recentlyViewed
                .map(id => products.find(p => p.id === id))
                .filter((p): p is Product => !!p)
                .map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleProductSelect(p)}
                    className="flex-shrink-0 w-64 bg-white border border-gray-100 rounded-xl p-3 hover:border-indigo-100 hover:shadow-2xs transition-all cursor-pointer snap-start flex flex-col justify-between"
                  >
                    <div className="flex gap-3 items-center">
                      <LazyImage
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-14 h-14 object-cover rounded-md border border-gray-150 flex-shrink-0 bg-gray-50"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-bold text-indigo-500 font-mono tracking-wide uppercase">{p.category}</span>
                        <h4 className="font-display font-semibold text-xs text-gray-900 truncate mt-0.5" title={p.name}>
                          {p.name}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-mono font-bold mt-1">KSh {p.price.toLocaleString('en-KE')}</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Side: Sidebar Filter Column */}
        <div className="lg:col-span-1">
          {/* Mobile Filter Toggle Drawer Action */}
          <div className="flex items-center justify-between lg:hidden bg-indigo-50/30 border border-indigo-100 rounded-xl p-3 mb-4">
            <button
              onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
              className="flex items-center gap-2 text-xs font-semibold text-indigo-900 focus:outline-hidden hover:text-indigo-600 transition-colors cursor-pointer"
            >
              <Filter className="h-4 w-4" />
              {isMobileFiltersOpen ? 'Hide Catalog Filters' : 'Show Catalog Filters'}
              {(activeCategory !== 'All' || activeType !== 'All' || search !== '') && (
                <span className="h-2 w-2 rounded-full bg-indigo-600 inline-block animate-ping"></span>
              )}
            </button>
            <span className="text-[10px] font-mono text-gray-500 font-bold bg-white px-2 py-0.5 rounded-md border border-gray-150">
              {filteredProducts.length} items
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
            {(activeCategory !== 'All' || activeSubcategory !== 'All' || activeType !== 'All' || search !== '') && (
              <button
                onClick={() => {
                  setSearch('');
                  setActiveCategory('All');
                  setActiveSubcategory('All');
                  setActiveType('All');
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
                        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800/60">
                          <LazyImage
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-102"
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
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <div className="flex items-center text-amber-500">
                              <Star className="h-2.5 w-2.5 fill-current" />
                              <span className="text-[9px] sm:text-[10px] font-bold ml-0.5">{product.rating.toFixed(1)}</span>
                            </div>
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
                                  KSh {originalPriceVal.toLocaleString('en-KE')}
                                </span>
                              )}
                              <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white whitespace-nowrap">
                                KSh {product.price.toLocaleString('en-KE')}
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
                      <div className="relative aspect-video md:aspect-square w-full md:w-44 h-auto md:h-44 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800/60 shrink-0">
                        <LazyImage
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-102"
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
                            <span className="text-slate-300 dark:text-slate-700 font-bold">•</span>
                            <div className="flex items-center text-amber-500">
                              <Star className="h-2.5 w-2.5 fill-current" />
                              <span className="text-[9px] sm:text-[10px] font-bold ml-0.5">{product.rating.toFixed(1)}</span>
                            </div>
                          </div>
                          
                          <h3 className="font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-tight truncate max-w-xl">
                            {product.name}
                          </h3>
                          
                          <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed font-normal">
                            {product.description}
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
                                    KSh {originalPriceVal.toLocaleString('en-KE')}
                                  </span>
                                )}
                                <span className="font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-white whitespace-nowrap">
                                  KSh {product.price.toLocaleString('en-KE')}
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

      {/* Recently Viewed Component */}
      {recentlyViewed.length > 0 && (
        <div className="mt-16 pt-10 border-t border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-500" />
              <h3 className="font-display text-sm font-semibold text-gray-900">Recently Viewed Objects</h3>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRecentlyViewed([]);
                try {
                  localStorage.removeItem('veloce_recently_viewed');
                } catch {}
              }}
              className="text-[10px] font-mono font-bold text-rose-500 hover:text-rose-750 bg-transparent cursor-pointer transition-colors hover:underline"
            >
              Clear History
            </button>
          </div>
          
          <div className="flex items-stretch gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-indigo-100 scrollbar-track-transparent snap-x">
            {recentlyViewed
              .map(id => products.find(p => p.id === id))
              .filter((p): p is Product => !!p)
              .map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleProductSelect(p)}
                  className="flex-shrink-0 w-64 bg-white border border-gray-100 rounded-xl p-3 hover:border-indigo-100 hover:shadow-2xs transition-all cursor-pointer snap-start flex flex-col justify-between"
                >
                  <div className="flex gap-3 items-center">
                    <LazyImage
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-14 h-14 object-cover rounded-md border border-gray-150 flex-shrink-0 bg-gray-50"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-bold text-indigo-500 font-mono tracking-wide uppercase">{p.category}</span>
                      <h4 className="font-display font-semibold text-xs text-gray-900 truncate mt-0.5" title={p.name}>
                        {p.name}
                      </h4>
                      <p className="text-[10px] text-gray-400 font-mono font-bold mt-1">KSh {p.price.toLocaleString('en-KE')}</p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

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
                      <p className="mt-1 text-[11px] text-gray-550 dark:text-gray-400 line-clamp-2 leading-snug font-extralight">{p.description}</p>
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
                              KSh {originalPriceVal.toLocaleString('en-KE')}
                            </span>
                          )}
                          <span className="font-mono font-bold text-xs text-indigo-950 dark:text-indigo-300">
                            KSh {p.price.toLocaleString('en-KE')}
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
        />
      )}
    </div>
  );
}
