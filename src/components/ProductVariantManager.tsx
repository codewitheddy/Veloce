import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Layers, Plus, Trash2, Image as ImageIcon, Sparkles, Check, AlertCircle,
  UploadCloud, Star, ArrowLeft, ArrowRight, RefreshCw, Eye, EyeOff,
  Filter, CheckCircle2, ChevronDown, ChevronUp, Edit3, X, AlertTriangle, Info, Sliders
} from 'lucide-react';
import { ProductOption, OptionValue, OptionValueImage, ProductVariant } from '../types';
import { uploadImageToCloudinary } from '../lib/cloudinary';
import { resolveColorHex } from '../utils/productUtils';

export interface ProductVariantManagerProps {
  basePrice: number;
  baseSku: string;
  productName: string;
  currency?: string;
  hasVariants: boolean;
  onHasVariantsChange: (has: boolean) => void;
  options: ProductOption[];
  onOptionsChange: (options: ProductOption[]) => void;
  colorImages: Record<string, OptionValueImage[]>;
  onColorImagesChange: (colorImages: Record<string, OptionValueImage[]>) => void;
  variants: ProductVariant[];
  onVariantsChange: (variants: ProductVariant[]) => void;
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
}

const COMMON_COLORS = [
  { name: 'Black', hex: '#111827' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Heather Grey', hex: '#9CA3AF' },
  { name: 'Navy', hex: '#1E3A8A' },
  { name: 'Royal Blue', hex: '#2563EB' },
  { name: 'Crimson Red', hex: '#DC2626' },
  { name: 'Forest Green', hex: '#059669' },
  { name: 'Olive Green', hex: '#4D7C0F' },
  { name: 'Amber Gold', hex: '#D97706' },
  { name: 'Rose Gold', hex: '#FB7185' },
  { name: 'Charcoal', hex: '#334155' },
  { name: 'Beige', hex: '#D4B996' },
];

const SIZE_PRESETS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const SHOE_SIZE_PRESETS = ['38', '39', '40', '41', '42', '43', '44', '45'];

export const ProductVariantManager: React.FC<ProductVariantManagerProps> = ({
  basePrice,
  baseSku,
  productName,
  currency = 'KES',
  hasVariants,
  onHasVariantsChange,
  options,
  onOptionsChange,
  colorImages,
  onColorImagesChange,
  variants,
  onVariantsChange,
  onValidationChange,
}) => {
  // Active Color Tab for Image Management
  const [activeColorTab, setActiveColorTab] = useState<string>('');
  
  // Option Input State
  const [newOptionName, setNewOptionName] = useState<string>('');
  const [newOptionValue, setNewOptionValue] = useState<Record<string, string>>({});
  const [newColorHex, setNewColorHex] = useState<string>('#1E3A8A');
  const [newColorName, setNewColorName] = useState<string>('');

  // Bulk Edit State
  const [bulkFilterOption, setBulkFilterOption] = useState<string>('all');
  const [bulkFilterValue, setBulkFilterValue] = useState<string>('all');
  const [bulkPrice, setBulkPrice] = useState<string>('');
  const [bulkCompareAt, setBulkCompareAt] = useState<string>('');
  const [bulkStock, setBulkStock] = useState<string>('');
  const [bulkSearchQuery, setBulkSearchQuery] = useState<string>('');

  // Upload Progress & Errors
  const [uploadingColor, setUploadingColor] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageToEditAlt, setImageToEditAlt] = useState<{ colorKey: string; imageId: string; alt: string } | null>(null);

  // Table Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 25;

  // Extract all color values from options
  const colorOption = useMemo(() => {
    return options.find(o => o.name.toLowerCase().trim() === 'color' || o.name.toLowerCase().trim() === 'colour');
  }, [options]);

  const colorValues = useMemo(() => {
    return colorOption ? colorOption.values : [];
  }, [colorOption]);

  // Auto-enable variations if options, matrix, or color galleries exist
  useEffect(() => {
    if (!hasVariants && (options.length > 0 || variants.length > 0 || Object.keys(colorImages).length > 0)) {
      onHasVariantsChange(true);
    }
  }, [hasVariants, options.length, variants.length, colorImages, onHasVariantsChange]);

  // Set default active color tab
  useEffect(() => {
    if (colorValues.length > 0 && (!activeColorTab || !colorValues.some(c => c.name.toLowerCase() === activeColorTab.toLowerCase()))) {
      setActiveColorTab(colorValues[0].name);
    }
  }, [colorValues, activeColorTab]);

  // Validation Logic
  const validationResult = useMemo(() => {
    const errors: string[] = [];
    if (!hasVariants) return { isValid: true, errors };

    if (options.length === 0) {
      errors.push('At least one option (e.g., Size or Color) must be configured.');
    }

    if (variants.length === 0) {
      errors.push('Variant matrix is empty. Click "Generate Variant Matrix" to create SKU combinations.');
    }

    // Check duplicate SKUs
    const skuMap = new Map<string, number>();
    variants.forEach(v => {
      const s = (v.sku || '').trim().toUpperCase();
      if (!s) {
        errors.push('All variants must have a non-empty SKU code.');
      } else {
        skuMap.set(s, (skuMap.get(s) || 0) + 1);
      }
    });

    skuMap.forEach((count, s) => {
      if (count > 1) {
        errors.push(`Duplicate SKU "${s}" detected across multiple variants.`);
      }
    });

    // Check negative values
    variants.forEach(v => {
      if (v.price !== null && v.price !== undefined && Number(v.price) < 0) {
        errors.push(`Variant "${v.sku}" cannot have a negative price.`);
      }
      if (v.stockQty !== undefined && Number(v.stockQty) < 0) {
        errors.push(`Variant "${v.sku}" cannot have a negative stock quantity.`);
      }
    });

    // Check active variants
    if (variants.length > 0 && !variants.some(v => v.active !== false)) {
      errors.push('At least one variant must be enabled and active.');
    }

    return {
      isValid: errors.length === 0,
      errors: Array.from(new Set(errors)),
    };
  }, [hasVariants, options, variants]);

  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(validationResult.isValid, validationResult.errors);
    }
  }, [validationResult, onValidationChange]);

  // -------------------------------------------------------------
  // Option & Value Management
  // -------------------------------------------------------------
  const handleAddOption = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (options.some(o => o.name.toLowerCase() === trimmed.toLowerCase())) {
      alert(`Option "${trimmed}" already exists.`);
      return;
    }

    const newOpt: ProductOption = {
      id: `opt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      position: options.length,
      values: [],
    };

    onOptionsChange([...options, newOpt]);
    setNewOptionName('');
  };

  const handleRemoveOption = (optionId: string) => {
    const optToRemove = options.find(o => o.id === optionId);
    if (!optToRemove) return;

    if (confirm(`Remove option "${optToRemove.name}" and clean up affected variants?`)) {
      const updatedOptions = options.filter(o => o.id !== optionId);
      onOptionsChange(updatedOptions);

      // Clean up orphaned color images if removing Color
      if (optToRemove.name.toLowerCase() === 'color' || optToRemove.name.toLowerCase() === 'colour') {
        onColorImagesChange({});
      }
    }
  };

  const handleAddValueToOption = (optionId: string, valName: string, hex?: string) => {
    const trimmed = valName.trim();
    if (!trimmed) return;

    const optIndex = options.findIndex(o => o.id === optionId);
    if (optIndex === -1) return;

    const opt = options[optIndex];
    if (opt.values.some(v => v.name.toLowerCase() === trimmed.toLowerCase())) {
      alert(`Value "${trimmed}" already exists in option "${opt.name}".`);
      return;
    }

    const isColorOpt = opt.name.toLowerCase() === 'color' || opt.name.toLowerCase() === 'colour';
    const determinedHex = isColorOpt ? (hex || resolveColorHex(trimmed)) : (hex || undefined);

    const newVal: OptionValue = {
      id: `val-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      hexColor: determinedHex,
      hexCode: determinedHex,
      hex_code: determinedHex,
      position: opt.values.length,
      images: [],
    };

    const updated = [...options];
    updated[optIndex] = {
      ...opt,
      values: [...opt.values, newVal],
    };

    onOptionsChange(updated);
    setNewOptionValue(prev => ({ ...prev, [optionId]: '' }));
  };

  const handleRemoveValueFromOption = (optionId: string, valId: string) => {
    const optIndex = options.findIndex(o => o.id === optionId);
    if (optIndex === -1) return;

    const opt = options[optIndex];
    const valToRemove = opt.values.find(v => v.id === valId);
    const updated = [...options];
    updated[optIndex] = {
      ...opt,
      values: opt.values.filter(v => v.id !== valId),
    };

    onOptionsChange(updated);

    // If color, remove color images
    if (valToRemove && (opt.name.toLowerCase() === 'color' || opt.name.toLowerCase() === 'colour')) {
      const updatedColorImages = { ...colorImages };
      delete updatedColorImages[valToRemove.name.toLowerCase()];
      delete updatedColorImages[valToRemove.name];
      onColorImagesChange(updatedColorImages);
    }
  };

  // -------------------------------------------------------------
  // Variant Matrix Generation & Smart Reconciliation
  // -------------------------------------------------------------
  const handleGenerateMatrix = () => {
    const validOptions = options.filter(o => o.name && o.values && o.values.length > 0);
    if (validOptions.length === 0) {
      alert('Please add at least one option and option value before generating the variant matrix.');
      return;
    }

    const arrays = validOptions.map(opt =>
      opt.values.map(v => ({
        optionKey: opt.name.toLowerCase().trim().replace(/\s+/g, '_'),
        valueName: v.name.trim(),
        hexColor: v.hexColor,
      }))
    );

    const cartesian = (arrs: any[][]): any[][] => {
      return arrs.reduce((acc, curr) => acc.flatMap(d => curr.map(e => [...d, e])), [[]] as any[][]);
    };

    const combinations = cartesian(arrays);
    const prefix = (baseSku || 'SKU').trim().toUpperCase();

    const generated: ProductVariant[] = combinations.map(combo => {
      const attributes: Record<string, string> = {};
      combo.forEach(c => {
        attributes[c.optionKey] = c.valueName;
      });

      // Match existing variant to preserve price, stock, SKU, active state
      const existing = variants.find(v => {
        const vKeys = Object.keys(v.attributes || {});
        const aKeys = Object.keys(attributes);
        if (vKeys.length !== aKeys.length) return false;
        return aKeys.every(k => (v.attributes[k] || '').toLowerCase() === (attributes[k] || '').toLowerCase());
      });

      if (existing) {
        return {
          ...existing,
          attributes,
        };
      }

      // Generate clean abbreviation SKU suffix
      const skuSuffix = Object.values(attributes)
        .map(val => val.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase())
        .join('-');

      return {
        id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sku: `${prefix}-${skuSuffix || 'DEF'}`,
        attributes,
        price: basePrice || 0,
        priceOverride: null,
        compareAtPrice: null,
        compare_at_price: null,
        stockQty: 10,
        stock: 10,
        active: true,
      };
    });

    onVariantsChange(generated);
  };

  // -------------------------------------------------------------
  // Bulk Editing
  // -------------------------------------------------------------
  const filteredVariants = useMemo(() => {
    return variants.filter(v => {
      if (bulkFilterOption !== 'all' && bulkFilterValue !== 'all') {
        const optKey = bulkFilterOption.toLowerCase().trim().replace(/\s+/g, '_');
        if ((v.attributes[optKey] || '').toLowerCase() !== bulkFilterValue.toLowerCase()) {
          return false;
        }
      }
      if (bulkSearchQuery.trim()) {
        const query = bulkSearchQuery.toLowerCase().trim();
        const skuMatch = (v.sku || '').toLowerCase().includes(query);
        const attrMatch = Object.values(v.attributes || {}).some(val => val.toLowerCase().includes(query));
        if (!skuMatch && !attrMatch) return false;
      }
      return true;
    });
  }, [variants, bulkFilterOption, bulkFilterValue, bulkSearchQuery]);

  const paginatedVariants = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredVariants.slice(start, start + itemsPerPage);
  }, [filteredVariants, currentPage]);

  const totalPages = Math.ceil(filteredVariants.length / itemsPerPage) || 1;

  const handleApplyBulkPrice = () => {
    if (bulkPrice === '') return;
    const num = Number(bulkPrice);
    if (isNaN(num) || num < 0) {
      alert('Please enter a valid non-negative price.');
      return;
    }

    const updated = variants.map(v => {
      if (bulkFilterOption !== 'all' && bulkFilterValue !== 'all') {
        const optKey = bulkFilterOption.toLowerCase().trim().replace(/\s+/g, '_');
        if ((v.attributes[optKey] || '').toLowerCase() !== bulkFilterValue.toLowerCase()) {
          return v;
        }
      }
      return { ...v, price: num, priceOverride: num };
    });

    onVariantsChange(updated);
    setBulkPrice('');
  };

  const handleApplyBulkCompareAt = () => {
    const num = bulkCompareAt === '' ? null : Number(bulkCompareAt);
    if (num !== null && (isNaN(num) || num < 0)) {
      alert('Please enter a valid non-negative compare-at price.');
      return;
    }

    const updated = variants.map(v => {
      if (bulkFilterOption !== 'all' && bulkFilterValue !== 'all') {
        const optKey = bulkFilterOption.toLowerCase().trim().replace(/\s+/g, '_');
        if ((v.attributes[optKey] || '').toLowerCase() !== bulkFilterValue.toLowerCase()) {
          return v;
        }
      }
      return { ...v, compareAtPrice: num, compare_at_price: num };
    });

    onVariantsChange(updated);
    setBulkCompareAt('');
  };

  const handleApplyBulkStock = () => {
    if (bulkStock === '') return;
    const num = parseInt(bulkStock, 10);
    if (isNaN(num) || num < 0) {
      alert('Please enter a valid non-negative stock number.');
      return;
    }

    const updated = variants.map(v => {
      if (bulkFilterOption !== 'all' && bulkFilterValue !== 'all') {
        const optKey = bulkFilterOption.toLowerCase().trim().replace(/\s+/g, '_');
        if ((v.attributes[optKey] || '').toLowerCase() !== bulkFilterValue.toLowerCase()) {
          return v;
        }
      }
      return { ...v, stockQty: num, stock: num };
    });

    onVariantsChange(updated);
    setBulkStock('');
  };

  const handleBulkToggleActive = (active: boolean) => {
    const updated = variants.map(v => {
      if (bulkFilterOption !== 'all' && bulkFilterValue !== 'all') {
        const optKey = bulkFilterOption.toLowerCase().trim().replace(/\s+/g, '_');
        if ((v.attributes[optKey] || '').toLowerCase() !== bulkFilterValue.toLowerCase()) {
          return v;
        }
      }
      return { ...v, active };
    });

    onVariantsChange(updated);
  };

  // -------------------------------------------------------------
  // Image Management Per Color
  // -------------------------------------------------------------
  const getColorImages = (colorName: string): OptionValueImage[] => {
    if (!colorName) return [];
    return colorImages[colorName.toLowerCase()] || colorImages[colorName] || [];
  };

  const handleImageUpload = async (files: FileList | null, targetColorName: string) => {
    if (!files || files.length === 0 || !targetColorName) return;

    setUploadError(null);
    setUploadingColor(targetColorName);
    setUploadProgress(10);

    const currentImgs = getColorImages(targetColorName);
    if (currentImgs.length + files.length > 10) {
      setUploadError(`Maximum 10 images allowed per color. (${currentImgs.length} already exist, tried to add ${files.length}).`);
      setUploadingColor(null);
      return;
    }

    const newImages: OptionValueImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // 1. Format check
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setUploadError(`File "${file.name}" is not a valid format. Please upload JPG, PNG, or WebP.`);
        setUploadingColor(null);
        return;
      }

      // 2. Size check (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setUploadError(`File "${file.name}" exceeds 5 MB limit.`);
        setUploadingColor(null);
        return;
      }

      // 3. Dimension check (Minimum 800x800 px)
      try {
        const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          const img = new Image();
          img.src = URL.createObjectURL(file);
          img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
          };
          img.onerror = reject;
        });

        if (dimensions.width < 800 || dimensions.height < 800) {
          console.warn(`[Image Dimension Warning] "${file.name}" is ${dimensions.width}x${dimensions.height}px (Recommended min: 800x800px).`);
        }
      } catch (err) {
        console.warn('Could not inspect image dimensions:', err);
      }

      // 4. Upload with progress simulation
      setUploadProgress(Math.round(((i + 0.5) / files.length) * 100));
      
      try {
        const res = await uploadImageToCloudinary(file, {
          folder: `veloce_products/${targetColorName.toLowerCase().replace(/\s+/g, '_')}`,
          tags: ['product_variant', targetColorName],
        });

        if (res && (res.secureUrl || res.url)) {
          newImages.push({
            id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            url: res.secureUrl || res.url,
            alt: `${productName || 'Product'} - ${targetColorName}`,
            position: currentImgs.length + newImages.length,
            isPrimary: currentImgs.length === 0 && newImages.length === 0,
          });
        }
      } catch (err: any) {
        setUploadError(`Failed to upload "${file.name}": ${err.message || 'Network error'}`);
        setUploadingColor(null);
        return;
      }
    }

    setUploadProgress(100);

    const merged = [...currentImgs, ...newImages].map((img, idx) => ({
      ...img,
      position: idx,
      isPrimary: idx === 0,
    }));

    const updatedColorImages = {
      ...colorImages,
      [targetColorName.toLowerCase()]: merged,
      [targetColorName]: merged,
    };

    onColorImagesChange(updatedColorImages);
    setUploadingColor(null);
    setUploadProgress(0);
  };

  const handleSetPrimaryImage = (colorName: string, imageId: string) => {
    const currentImgs = getColorImages(colorName);
    const imgIndex = currentImgs.findIndex(img => img.id === imageId);
    if (imgIndex <= 0) return; // Already primary

    const reordered = [...currentImgs];
    const [selected] = reordered.splice(imgIndex, 1);
    reordered.unshift(selected);

    const updated = reordered.map((img, idx) => ({
      ...img,
      position: idx,
      isPrimary: idx === 0,
    }));

    onColorImagesChange({
      ...colorImages,
      [colorName.toLowerCase()]: updated,
      [colorName]: updated,
    });
  };

  const handleMoveImage = (colorName: string, index: number, direction: 'left' | 'right') => {
    const currentImgs = [...getColorImages(colorName)];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentImgs.length) return;

    const temp = currentImgs[index];
    currentImgs[index] = currentImgs[targetIndex];
    currentImgs[targetIndex] = temp;

    const updated = currentImgs.map((img, idx) => ({
      ...img,
      position: idx,
      isPrimary: idx === 0,
    }));

    onColorImagesChange({
      ...colorImages,
      [colorName.toLowerCase()]: updated,
      [colorName]: updated,
    });
  };

  const handleDeleteImage = (colorName: string, imageId: string) => {
    const currentImgs = getColorImages(colorName).filter(img => img.id !== imageId);
    const updated = currentImgs.map((img, idx) => ({
      ...img,
      position: idx,
      isPrimary: idx === 0,
    }));

    onColorImagesChange({
      ...colorImages,
      [colorName.toLowerCase()]: updated,
      [colorName]: updated,
    });
  };

  const handleSaveAltText = () => {
    if (!imageToEditAlt) return;
    const { colorKey, imageId, alt } = imageToEditAlt;

    const currentImgs = getColorImages(colorKey).map(img => {
      if (img.id === imageId) {
        return { ...img, alt: alt.trim() };
      }
      return img;
    });

    onColorImagesChange({
      ...colorImages,
      [colorKey.toLowerCase()]: currentImgs,
      [colorKey]: currentImgs,
    });

    setImageToEditAlt(null);
  };

  // -------------------------------------------------------------
  // Render
  // -------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Master Toggle Bar */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 text-indigo-400">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Product Variants & Matrix Engine
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/20">
                v2.0
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5 max-w-xl">
              Configure options (Size, Color swatches), color-specific image galleries, and auto-generate the SKU variant pricing matrix.
            </p>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hasVariants}
            onChange={(e) => onHasVariantsChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
          <span className="ml-3 text-xs font-mono font-bold text-white uppercase tracking-wider">
            {hasVariants ? 'Enabled' : 'Disabled'}
          </span>
        </label>
      </div>

      {hasVariants && (
        <div className="space-y-8">
          {/* Validation Banner if errors */}
          {!validationResult.isValid && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1 text-xs">
              <div className="flex items-center gap-2 font-bold font-mono uppercase tracking-wider text-rose-800">
                <AlertCircle className="h-4 w-4" /> Please resolve the following variant settings:
              </div>
              <ul className="list-disc list-inside space-y-0.5 pl-1 text-[11px] text-rose-700">
                {validationResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 1: OPTIONS SETUP (Size, Color Swatches, Material)     */}
          {/* ========================================================= */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-900 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                  Product Options & Values
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Define customer choices. Colors support rich hex swatches and dedicated image galleries.
                </p>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Add Preset:</span>
                <button
                  type="button"
                  onClick={() => handleAddOption('Size')}
                  className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-mono font-bold cursor-pointer"
                >
                  + Size
                </button>
                <button
                  type="button"
                  onClick={() => handleAddOption('Color')}
                  className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-mono font-bold cursor-pointer"
                >
                  + Color
                </button>
                <button
                  type="button"
                  onClick={() => handleAddOption('Material')}
                  className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-mono font-bold cursor-pointer"
                >
                  + Material
                </button>
              </div>
            </div>

            {/* List of Configured Options */}
            <div className="space-y-4">
              {options.length === 0 && (
                <div className="p-6 text-center rounded-xl bg-slate-50 border border-dashed border-slate-300 text-slate-500">
                  <Sliders className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                  <p className="text-xs font-bold text-slate-700">No Options Added Yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click a preset above or enter a custom option name below (e.g. Size, Color, Capacity).
                  </p>
                </div>
              )}

              {options.map((opt) => {
                const isColor = opt.name.toLowerCase() === 'color' || opt.name.toLowerCase() === 'colour';

                return (
                  <div
                    key={opt.id}
                    className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md font-mono text-xs font-extrabold uppercase bg-white border border-slate-200 text-slate-900 shadow-2xs">
                          {opt.name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          ({opt.values.length} value{opt.values.length !== 1 ? 's' : ''})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveOption(opt.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer transition"
                        title="Delete this option"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Values Pills */}
                    <div className="flex flex-wrap items-center gap-2">
                      {opt.values.map((val) => (
                        <div
                          key={val.id}
                          className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-white border border-slate-200 shadow-2xs text-xs font-mono font-bold text-slate-800"
                        >
                          {isColor && (
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-slate-300 shadow-3xs inline-block shrink-0"
                              style={{ backgroundColor: resolveColorHex(val) }}
                            />
                          )}
                          <span>{val.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveValueFromOption(opt.id, val.id)}
                            className="p-0.5 text-slate-300 hover:text-rose-500 rounded cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add Value Controls */}
                    {isColor ? (
                      /* Color Swatch Add Controls */
                      <div className="pt-2 border-t border-slate-200/60 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                            <input
                              type="color"
                              value={newColorHex}
                              onChange={(e) => setNewColorHex(e.target.value)}
                              className="h-6 w-6 rounded border-0 cursor-pointer p-0 bg-transparent"
                            />
                            <input
                              type="text"
                              value={newColorHex}
                              onChange={(e) => setNewColorHex(e.target.value)}
                              placeholder="#000000"
                              className="w-20 text-[11px] font-mono uppercase font-bold text-slate-700 outline-none"
                            />
                          </div>

                          <input
                            type="text"
                            value={newColorName}
                            onChange={(e) => setNewColorName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (newColorName.trim()) {
                                  handleAddValueToOption(opt.id, newColorName, newColorHex);
                                  setNewColorName('');
                                }
                              }
                            }}
                            placeholder="Color name (e.g. Midnight Navy)"
                            className="flex-1 min-w-[160px] h-8 px-3 rounded-lg border border-slate-200 text-xs font-mono bg-white focus:ring-2 focus:ring-indigo-500"
                          />

                          <button
                            type="button"
                            onClick={() => {
                              if (newColorName.trim()) {
                                handleAddValueToOption(opt.id, newColorName, newColorHex);
                                setNewColorName('');
                              }
                            }}
                            className="h-8 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold text-xs flex items-center gap-1 cursor-pointer transition shadow-2xs"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add Color
                          </button>
                        </div>

                        {/* Quick Color Swatches Palette */}
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          <span className="text-[10px] text-slate-400 font-mono font-bold uppercase mr-1">Quick Swatch:</span>
                          {COMMON_COLORS.map((c) => (
                            <button
                              key={c.name}
                              type="button"
                              onClick={() => {
                                setNewColorName(c.name);
                                setNewColorHex(c.hex);
                              }}
                              className="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:border-indigo-400 text-[10.5px] font-mono font-medium flex items-center gap-1.5 cursor-pointer shadow-3xs"
                            >
                              <span className="h-2.5 w-2.5 rounded-full border border-slate-300" style={{ backgroundColor: c.hex }} />
                              <span>{c.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* Standard Option Value Input (Size, Material, etc.) */
                      <div className="pt-2 border-t border-slate-200/60 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newOptionValue[opt.id] || ''}
                            onChange={(e) => setNewOptionValue({ ...newOptionValue, [opt.id]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const val = (newOptionValue[opt.id] || '').trim();
                                if (val) {
                                  // Support comma-separated batch adding
                                  if (val.includes(',')) {
                                    val.split(',').forEach(v => handleAddValueToOption(opt.id, v));
                                  } else {
                                    handleAddValueToOption(opt.id, val);
                                  }
                                }
                              }
                            }}
                            placeholder={`Add value to ${opt.name} (e.g. S, M, L or comma-separated)`}
                            className="flex-1 h-8 px-3 rounded-lg border border-slate-200 text-xs font-mono bg-white focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = (newOptionValue[opt.id] || '').trim();
                              if (val) {
                                if (val.includes(',')) {
                                  val.split(',').forEach(v => handleAddValueToOption(opt.id, v));
                                } else {
                                  handleAddValueToOption(opt.id, val);
                                }
                              }
                            }}
                            className="h-8 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-mono font-bold text-xs flex items-center gap-1 cursor-pointer transition shadow-2xs"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add
                          </button>
                        </div>

                        {/* Size Quick Chips */}
                        {opt.name.toLowerCase().includes('size') && (
                          <div className="flex flex-wrap items-center gap-1 pt-1">
                            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase mr-1">Apparel Sizes:</span>
                            {SIZE_PRESETS.map((sz) => (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => handleAddValueToOption(opt.id, sz)}
                                className="px-2 py-0.5 rounded bg-white hover:bg-indigo-50 border border-slate-200 text-[10px] font-mono font-bold text-slate-700 cursor-pointer"
                              >
                                + {sz}
                              </button>
                            ))}
                            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase mx-1">Shoes:</span>
                            {SHOE_SIZE_PRESETS.slice(0, 5).map((sz) => (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => handleAddValueToOption(opt.id, sz)}
                                className="px-2 py-0.5 rounded bg-white hover:bg-indigo-50 border border-slate-200 text-[10px] font-mono font-bold text-slate-700 cursor-pointer"
                              >
                                + {sz}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add Custom Option Form */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <input
                  type="text"
                  value={newOptionName}
                  onChange={(e) => setNewOptionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOption(newOptionName);
                    }
                  }}
                  placeholder="Custom Option Name (e.g. Finish, Length, Weight, Scent)"
                  className="flex-1 w-full h-9 px-3.5 rounded-xl border border-slate-200 text-xs font-mono bg-white focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddOption(newOptionName)}
                  className="w-full sm:w-auto h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
                >
                  <Plus className="h-4 w-4" /> Add Option
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* STEP 2: IMAGE MANAGEMENT PER COLOR (The Core Requirement) */}
          {/* ========================================================= */}
          {colorValues.length > 0 && (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5">
              <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-900 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">2</span>
                    Color-Specific Image Galleries
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Images belong to each Color option. Uploading photos for "Red" automatically applies to Red/S, Red/M, Red/L, etc.
                  </p>
                </div>

                <div className="text-[11px] font-mono text-slate-400">
                  Max 10 images / color &bull; JPG, PNG, WebP &bull; Min 800x800px
                </div>
              </div>

              {/* Color Tabs Header */}
              <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3">
                {colorValues.map((val) => {
                  const imgs = getColorImages(val.name);
                  const isSelected = activeColorTab.toLowerCase() === val.name.toLowerCase();
                  const hasZeroImages = imgs.length === 0;

                  return (
                    <button
                      key={val.id}
                      type="button"
                      onClick={() => setActiveColorTab(val.name)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-2xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-slate-300 shadow-3xs inline-block"
                        style={{ backgroundColor: resolveColorHex(val) }}
                      />
                      <span>{val.name}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          hasZeroImages
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {imgs.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Color Image Gallery Card */}
              {activeColorTab && (() => {
                const activeVal = colorValues.find(c => c.name.toLowerCase() === activeColorTab.toLowerCase());
                const currentImages = getColorImages(activeColorTab);

                return (
                  <div className="space-y-4">
                    {/* Zero Image Warning Banner */}
                    {currentImages.length === 0 && (
                      <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 flex items-start gap-2.5 text-xs">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">No images assigned for {activeColorTab}</p>
                          <p className="text-[11px] text-amber-700 mt-0.5">
                            This color will fall back to the primary product catalog image until custom photos are uploaded.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Upload Error Banner */}
                    {uploadError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                          <span>{uploadError}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUploadError(null)}
                          className="p-1 hover:bg-rose-100 rounded text-rose-600 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Drag and Drop Uploader Zone */}
                    <label
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          handleImageUpload(e.dataTransfer.files, activeColorTab);
                        }
                      }}
                      className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                        uploadingColor === activeColorTab
                          ? 'border-indigo-500 bg-indigo-50/50'
                          : 'border-slate-300 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/20'
                      }`}
                    >
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => handleImageUpload(e.target.files, activeColorTab)}
                        className="sr-only"
                        disabled={uploadingColor !== null}
                      />

                      <div className="p-3 bg-white rounded-full border border-slate-200 shadow-2xs text-indigo-600">
                        <UploadCloud className="h-6 w-6" />
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-800 font-mono">
                          Drag & drop photos for <span className="text-indigo-600 font-bold">"{activeColorTab}"</span> or click to browse
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          First uploaded image becomes primary thumbnail for this color variant.
                        </p>
                      </div>

                      {uploadingColor === activeColorTab && (
                        <div className="w-full max-w-xs mt-2 space-y-1">
                          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 transition-all duration-200"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-indigo-700 font-bold">
                            Uploading... {uploadProgress}%
                          </span>
                        </div>
                      )}
                    </label>

                    {/* Image Cards Grid */}
                    {currentImages.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 pt-2">
                        {currentImages.map((img, idx) => (
                          <div
                            key={img.id}
                            className={`group relative rounded-xl border bg-white p-2 shadow-2xs transition-all overflow-hidden flex flex-col justify-between ${
                              img.isPrimary
                                ? 'border-indigo-600 ring-2 ring-indigo-100'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="relative aspect-square w-full rounded-lg bg-slate-100 overflow-hidden mb-2">
                              <img
                                src={img.url}
                                alt={img.alt || `${productName} - ${activeColorTab}`}
                                className="h-full w-full object-cover"
                              />

                              {/* Primary Badge */}
                              {img.isPrimary ? (
                                <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-indigo-600 text-white font-mono text-[9px] font-extrabold shadow-xs flex items-center gap-1">
                                  <Star className="h-2.5 w-2.5 fill-white" /> PRIMARY
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSetPrimaryImage(activeColorTab, img.id)}
                                  className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 hover:bg-indigo-600 text-white font-mono text-[9px] font-bold opacity-0 group-hover:opacity-100 transition shadow-xs cursor-pointer"
                                  title="Set as primary thumbnail for this color"
                                >
                                  Make Primary
                                </button>
                              )}

                              {/* Delete button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteImage(activeColorTab, img.id)}
                                className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition shadow-xs cursor-pointer"
                                title="Delete image"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>

                            {/* Card Footer: Reorder & Alt Text Controls */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                                <span>#{idx + 1}</span>
                                <button
                                  type="button"
                                  onClick={() => setImageToEditAlt({ colorKey: activeColorTab, imageId: img.id, alt: img.alt || '' })}
                                  className="hover:text-indigo-600 flex items-center gap-1 font-bold cursor-pointer"
                                  title="Edit image alt text"
                                >
                                  <Edit3 className="h-2.5 w-2.5" /> Alt Text
                                </button>
                              </div>

                              <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveImage(activeColorTab, idx, 'left')}
                                  className="p-1 rounded bg-slate-50 hover:bg-slate-100 disabled:opacity-30 text-slate-700 text-[10px] cursor-pointer"
                                  title="Move Left"
                                >
                                  <ArrowLeft className="h-3 w-3" />
                                </button>
                                <span className="text-[9.5px] text-slate-400 font-mono truncate max-w-[80px]">
                                  {img.alt || 'No alt text'}
                                </span>
                                <button
                                  type="button"
                                  disabled={idx === currentImages.length - 1}
                                  onClick={() => handleMoveImage(activeColorTab, idx, 'right')}
                                  className="p-1 rounded bg-slate-50 hover:bg-slate-100 disabled:opacity-30 text-slate-700 text-[10px] cursor-pointer"
                                  title="Move Right"
                                >
                                  <ArrowRight className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3: VARIANT MATRIX & BULK EDITING                     */}
          {/* ========================================================= */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-900 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">3</span>
                  Variant Matrix & Stock Registry
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Multi-attribute combinations (Size x Color). Each variant maintains individual SKU, pricing, compare-at, and stock.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateMatrix}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition"
                >
                  <Sparkles className="h-4 w-4" /> Generate Variant Matrix
                </button>

                {variants.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Clear all generated variants?')) {
                        onVariantsChange([]);
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-mono font-bold text-xs cursor-pointer transition"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Matrix Status & Bulk Edit Toolbar */}
            {variants.length > 0 && (
              <div className="space-y-4">
                {/* Bulk Controls Bar */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-700 text-[11px] uppercase flex items-center gap-1">
                        <Filter className="h-3.5 w-3.5 text-indigo-600" /> Filter Bulk Target:
                      </span>

                      {/* Filter by Option Name */}
                      <select
                        value={bulkFilterOption}
                        onChange={(e) => {
                          setBulkFilterOption(e.target.value);
                          setBulkFilterValue('all');
                        }}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800"
                      >
                        <option value="all">All Variants ({variants.length})</option>
                        {options.map((opt) => (
                          <option key={opt.id} value={opt.name}>{opt.name}</option>
                        ))}
                      </select>

                      {/* Filter by Specific Value */}
                      {bulkFilterOption !== 'all' && (() => {
                        const targetOpt = options.find(o => o.name.toLowerCase() === bulkFilterOption.toLowerCase());
                        return (
                          <select
                            value={bulkFilterValue}
                            onChange={(e) => setBulkFilterValue(e.target.value)}
                            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800"
                          >
                            <option value="all">All {bulkFilterOption}s</option>
                            {targetOpt?.values.map((val) => (
                              <option key={val.id} value={val.name}>{val.name}</option>
                            ))}
                          </select>
                        );
                      })()}
                    </div>

                    {/* Search Box */}
                    <input
                      type="text"
                      value={bulkSearchQuery}
                      onChange={(e) => {
                        setBulkSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search SKU or attribute..."
                      className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-mono w-48"
                    />
                  </div>

                  {/* Bulk Inputs */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60 text-xs font-mono">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase">Apply to Filtered:</span>

                    <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
                      <input
                        type="number"
                        placeholder={`Price (${currency})`}
                        value={bulkPrice}
                        onChange={(e) => setBulkPrice(e.target.value)}
                        className="w-24 h-7 px-2 border-0 text-xs font-bold font-mono outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleApplyBulkPrice}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded font-bold text-[10px] cursor-pointer"
                      >
                        Set Price
                      </button>
                    </div>

                    <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
                      <input
                        type="number"
                        placeholder="Compare-At Price"
                        value={bulkCompareAt}
                        onChange={(e) => setBulkCompareAt(e.target.value)}
                        className="w-28 h-7 px-2 border-0 text-xs font-bold font-mono outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleApplyBulkCompareAt}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded font-bold text-[10px] cursor-pointer"
                      >
                        Set Compare-At
                      </button>
                    </div>

                    <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
                      <input
                        type="number"
                        placeholder="Stock Qty"
                        value={bulkStock}
                        onChange={(e) => setBulkStock(e.target.value)}
                        className="w-20 h-7 px-2 border-0 text-xs font-bold font-mono outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleApplyBulkStock}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded font-bold text-[10px] cursor-pointer"
                      >
                        Set Stock
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto">
                      <button
                        type="button"
                        onClick={() => handleBulkToggleActive(true)}
                        className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold cursor-pointer"
                      >
                        Enable All
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBulkToggleActive(false)}
                        className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-bold cursor-pointer"
                      >
                        Disable All
                      </button>
                    </div>
                  </div>
                </div>

                {/* Matrix Table */}
                <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-2xs">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="p-3 w-12 text-center">Active</th>
                        <th className="p-3">Variant Combination</th>
                        <th className="p-3">SKU Code</th>
                        <th className="p-3">Price ({currency})</th>
                        <th className="p-3">Compare-At ({currency})</th>
                        <th className="p-3 text-center">Stock</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedVariants.map((v, i) => {
                        const globalIndex = (currentPage - 1) * itemsPerPage + i;
                        const currentPrice = v.price !== null && v.price !== undefined ? v.price : (v.priceOverride !== null && v.priceOverride !== undefined ? v.priceOverride : basePrice);
                        const comparePrice = v.compareAtPrice !== null && v.compareAtPrice !== undefined ? v.compareAtPrice : (v.compare_at_price !== null && v.compare_at_price !== undefined ? v.compare_at_price : null);
                        const discountPercent = comparePrice && comparePrice > currentPrice ? Math.round(((comparePrice - currentPrice) / comparePrice) * 100) : 0;

                        return (
                          <tr
                            key={v.id}
                            className={`hover:bg-slate-50/80 transition ${
                              v.active === false ? 'opacity-50 bg-slate-50/50' : ''
                            }`}
                          >
                            {/* Active Toggle */}
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={v.active !== false}
                                onChange={(e) => {
                                  const updated = [...variants];
                                  const targetIdx = variants.findIndex(item => item.id === v.id);
                                  if (targetIdx !== -1) {
                                    updated[targetIdx].active = e.target.checked;
                                    onVariantsChange(updated);
                                  }
                                }}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>

                            {/* Attributes Badges */}
                            <td className="p-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {Object.entries(v.attributes).map(([k, val]) => {
                                  const isColor = k === 'color' || k === 'colour';
                                  const colorObj = colorValues.find(c => c.name.toLowerCase() === val.toLowerCase());

                                  return (
                                    <span
                                      key={k}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border bg-white border-slate-200 text-slate-800 shadow-3xs"
                                    >
                                      {isColor && (
                                        <span
                                          className="h-2.5 w-2.5 rounded-full border border-slate-300 inline-block"
                                          style={{ backgroundColor: resolveColorHex(colorObj || val) }}
                                        />
                                      )}
                                      <span className="text-slate-400 font-normal">{k}:</span>
                                      <strong>{val}</strong>
                                    </span>
                                  );
                                })}
                              </div>
                            </td>

                            {/* SKU */}
                            <td className="p-3">
                              <input
                                type="text"
                                value={v.sku}
                                onChange={(e) => {
                                  const updated = [...variants];
                                  const targetIdx = variants.findIndex(item => item.id === v.id);
                                  if (targetIdx !== -1) {
                                    updated[targetIdx].sku = e.target.value.toUpperCase();
                                    onVariantsChange(updated);
                                  }
                                }}
                                className="h-8 px-2 rounded-lg border border-slate-200 text-xs font-mono font-bold uppercase w-36 text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500"
                              />
                            </td>

                            {/* Price */}
                            <td className="p-3">
                              <input
                                type="number"
                                step="any"
                                value={v.price !== null && v.price !== undefined ? v.price : ''}
                                placeholder={String(basePrice || 0)}
                                onChange={(e) => {
                                  const updated = [...variants];
                                  const targetIdx = variants.findIndex(item => item.id === v.id);
                                  if (targetIdx !== -1) {
                                    const val = e.target.value === '' ? null : Number(e.target.value);
                                    updated[targetIdx].price = val;
                                    updated[targetIdx].priceOverride = val;
                                    onVariantsChange(updated);
                                  }
                                }}
                                className="h-8 px-2 rounded-lg border border-slate-200 text-xs font-mono font-bold w-24 text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500"
                              />
                            </td>

                            {/* Compare At Price */}
                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  step="any"
                                  placeholder="Optional"
                                  value={comparePrice !== null ? comparePrice : ''}
                                  onChange={(e) => {
                                    const updated = [...variants];
                                    const targetIdx = variants.findIndex(item => item.id === v.id);
                                    if (targetIdx !== -1) {
                                      const val = e.target.value === '' ? null : Number(e.target.value);
                                      updated[targetIdx].compareAtPrice = val;
                                      updated[targetIdx].compare_at_price = val;
                                      onVariantsChange(updated);
                                    }
                                  }}
                                  className="h-8 px-2 rounded-lg border border-slate-200 text-xs font-mono w-24 text-slate-600 bg-white focus:ring-2 focus:ring-indigo-500"
                                />
                                {discountPercent > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[9px] font-bold">
                                    -{discountPercent}%
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Stock */}
                            <td className="p-3 text-center">
                              <input
                                type="number"
                                min={0}
                                value={v.stockQty ?? v.stock ?? 0}
                                onChange={(e) => {
                                  const updated = [...variants];
                                  const targetIdx = variants.findIndex(item => item.id === v.id);
                                  if (targetIdx !== -1) {
                                    const val = Number(e.target.value);
                                    updated[targetIdx].stockQty = val;
                                    updated[targetIdx].stock = val;
                                    onVariantsChange(updated);
                                  }
                                }}
                                className={`h-8 px-2 rounded-lg border text-xs font-mono font-bold w-16 text-center bg-white ${
                                  (v.stockQty ?? 0) === 0
                                    ? 'border-rose-300 text-rose-600 bg-rose-50/50'
                                    : 'border-slate-200 text-slate-900 focus:ring-2 focus:ring-indigo-500'
                                }`}
                              />
                            </td>

                            {/* Action */}
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  onVariantsChange(variants.filter(item => item.id !== v.id));
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer transition"
                                title="Delete variant row"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between text-xs font-mono text-slate-500 pt-2">
                    <span>
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredVariants.length)} of {filteredVariants.length} variants
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        className="px-2.5 py-1 rounded border border-slate-200 bg-white disabled:opacity-40 cursor-pointer"
                      >
                        Previous
                      </button>
                      <span className="px-2 font-bold">{currentPage} / {totalPages}</span>
                      <button
                        type="button"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        className="px-2.5 py-1 rounded border border-slate-200 bg-white disabled:opacity-40 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alt Text Edit Modal */}
      {imageToEditAlt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 font-mono">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="text-xs font-bold uppercase text-slate-900 flex items-center gap-1.5">
                <Edit3 className="h-4 w-4 text-indigo-600" /> Edit Image Alt Text
              </h4>
              <button
                type="button"
                onClick={() => setImageToEditAlt(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase">
                Alt Text (Accessible Description for SEO & Screen Readers)
              </label>
              <input
                type="text"
                value={imageToEditAlt.alt}
                onChange={(e) => setImageToEditAlt({ ...imageToEditAlt, alt: e.target.value })}
                placeholder="e.g. Front view of Navy Blue Classic Cotton T-Shirt"
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-sans text-slate-900 focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setImageToEditAlt(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAltText}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-xs"
              >
                Save Alt Text
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductVariantManager;
