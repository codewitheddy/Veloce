/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  Edit3,
  Eye,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Layout,
  Smartphone,
  Monitor,
  Tablet,
  Save,
  AlertCircle,
  Calendar,
  ToggleLeft,
  ToggleRight,
  Copy,
  Upload,
  X,
  Search,
  Wand2,
  CheckCircle2,
  MousePointerClick
} from 'lucide-react';
import { HeroBanner, Category } from '../types';
import { HeroBannerSlider, DEFAULT_HERO_SLIDES } from './HeroBannerSlider';
import { loadCategoriesFromStorage, fetchCategoriesFromBackend } from '../utils/categoryUtils';
import { safeLocalStorageSetItem } from '../lib/storage';

// ==========================================
// Curated One-Click Template Presets
// ==========================================
export interface HeroTemplatePreset {
  id: string;
  name: string;
  category: string;
  description: string;
  badge: string;
  accentColor: string;
  previewBg: string;
  banner: Partial<HeroBanner>;
}

export const HERO_TEMPLATE_PRESETS: HeroTemplatePreset[] = [
  {
    id: 'dark-luxury',
    name: 'Dark Luxury & Precision',
    category: 'Premium Hardware',
    description: 'Deep obsidian backdrop with gold badges and aeronautical precision imagery.',
    badge: 'LUXURY',
    accentColor: '#f59e0b',
    previewBg: '#09090b',
    banner: {
      title: 'The Vanguard Precision Workspace',
      subtitle: 'Masterpiece Engineering for Discerning Creators',
      description: 'Crafted from solid aeronautical-grade billet aluminum and sustainably harvested American Walnut. Built for decades of peak performance.',
      badge_text: 'HAUTE HORLOGERIE MEETS DESK SETUP',
      badgeText: 'HAUTE HORLOGERIE MEETS DESK SETUP',
      primary_button_text: 'Explore Prestige Collection',
      primaryButtonText: 'Explore Prestige Collection',
      primary_button_url: 'store',
      primaryButtonUrl: 'store',
      secondary_button_text: 'Bespoke Inquiries',
      secondaryButtonText: 'Bespoke Inquiries',
      secondary_button_url: 'services',
      secondaryButtonUrl: 'services',
      hero_image_url: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&q=80&w=1200',
      background_type: 'color',
      background_color: '#09090b',
      background_image_url: '',
      overlay_enabled: true,
      overlay_color: '#000000',
      overlay_opacity: 0.35,
      text_color: '#ffffff',
      is_active: true
    }
  },
  {
    id: 'cyber-tech',
    name: 'Cyber Tech & Gaming',
    category: 'Mechanical Series',
    description: 'High-energy midnight indigo with neon cyan accents and low-latency peripherals.',
    badge: 'GAMING',
    accentColor: '#06b6d4',
    previewBg: '#0f172a',
    banner: {
      title: 'Tactile Mastery. Zero Latency.',
      subtitle: 'Introducing the Apex-Pro Mechanical Series',
      description: 'Hot-swappable optical switches, sound-dampened gasket structure, and ultra-high-speed polling designed for ultimate tactile response.',
      badge_text: 'NEXT-GEN 2026 EDITION',
      badgeText: 'NEXT-GEN 2026 EDITION',
      primary_button_text: 'Shop Keyboards',
      primaryButtonText: 'Shop Keyboards',
      primary_button_url: 'category:Mechanical Keyboards',
      primaryButtonUrl: 'category:Mechanical Keyboards',
      secondary_button_text: 'Compare Switches',
      secondaryButtonText: 'Compare Switches',
      secondary_button_url: 'store',
      secondaryButtonUrl: 'store',
      hero_image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=1200',
      background_type: 'image',
      background_image_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=1800',
      background_position: 'center',
      overlay_enabled: true,
      overlay_color: '#0f172a',
      overlay_opacity: 0.75,
      text_color: '#ffffff',
      is_active: true
    }
  },
  {
    id: 'minimal-studio',
    name: 'Minimalist Studio & Ergonomics',
    category: 'Workspaces',
    description: 'Warm charcoal minimalism with understated contrast and serene focus.',
    badge: 'STUDIO',
    accentColor: '#6366f1',
    previewBg: '#18181b',
    banner: {
      title: 'Clutter-Free Ergonomic Minimalism',
      subtitle: 'Designed to inspire focus and calm',
      description: 'Elevate your monitor, route concealed cables, and keep essentials within arm\'s reach with hand-finished Scandinavian birch stands.',
      badge_text: 'MINIMALIST ESSENTIALS',
      badgeText: 'MINIMALIST ESSENTIALS',
      primary_button_text: 'View Desk Organizers',
      primaryButtonText: 'View Desk Organizers',
      primary_button_url: 'store',
      primaryButtonUrl: 'store',
      secondary_button_text: 'Read Design Guide',
      secondaryButtonText: 'Read Design Guide',
      secondary_button_url: 'blog',
      secondaryButtonUrl: 'blog',
      hero_image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=1200',
      background_type: 'color',
      background_color: '#18181b',
      background_image_url: '',
      overlay_enabled: true,
      overlay_color: '#000000',
      overlay_opacity: 0.3,
      text_color: '#f4f4f5',
      is_active: true
    }
  },
  {
    id: 'flash-clearance',
    name: 'Flash Clearance Blowout',
    category: 'Promotions',
    description: 'High-urgency crimson styling for seasonal liquidations and limited-stock sales.',
    badge: 'PROMO',
    accentColor: '#ef4444',
    previewBg: '#450a0a',
    banner: {
      title: 'Seasonal Warehouse Liquidation',
      subtitle: 'Up to 55% Off Discontinued & Overstock Items',
      description: 'Limited quantities available. Once inventory sells out, these exclusive archival editions will not be restocked. Instant dispatch across all orders.',
      badge_text: 'FINAL CLEARANCE • WHILE SUPPLIES LAST',
      badgeText: 'FINAL CLEARANCE • WHILE SUPPLIES LAST',
      primary_button_text: 'Claim Clearance Deals',
      primaryButtonText: 'Claim Clearance Deals',
      primary_button_url: 'sale',
      primaryButtonUrl: 'sale',
      secondary_button_text: 'View All Products',
      secondaryButtonText: 'View All Products',
      secondary_button_url: 'store',
      secondaryButtonUrl: 'store',
      hero_image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1200',
      background_type: 'color',
      background_color: '#450a0a',
      background_image_url: '',
      overlay_enabled: true,
      overlay_color: '#180202',
      overlay_opacity: 0.6,
      text_color: '#ffffff',
      is_active: true
    }
  },
  {
    id: 'artisan-craft',
    name: 'Artisan Heritage & Leather',
    category: 'Craftsmanship',
    description: 'Deep forest emerald with warm brass and hand-burnished leather aesthetics.',
    badge: 'HERITAGE',
    accentColor: '#10b981',
    previewBg: '#064e3b',
    banner: {
      title: 'Hand-Stitched Leather & Heavy Brass',
      subtitle: 'Archival Quality Desk Mats & Folios',
      description: 'Full-grain vegetable-tanned Italian leather that develops a rich, unique patina over years of use. Edges beveled and hand-burnished with beeswax.',
      badge_text: 'HANDCRAFTED HERITAGE',
      badgeText: 'HANDCRAFTED HERITAGE',
      primary_button_text: 'Shop Leathergoods',
      primaryButtonText: 'Shop Leathergoods',
      primary_button_url: 'store',
      primaryButtonUrl: 'store',
      secondary_button_text: 'Custom Embossing',
      secondaryButtonText: 'Custom Embossing',
      secondary_button_url: 'services',
      secondaryButtonUrl: 'services',
      hero_image_url: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&q=80&w=1200',
      background_type: 'color',
      background_color: '#064e3b',
      background_image_url: '',
      overlay_enabled: true,
      overlay_color: '#022c22',
      overlay_opacity: 0.5,
      text_color: '#ecfdf5',
      is_active: true
    }
  },
  {
    id: 'executive-command',
    name: 'Executive Command Center',
    category: 'Enterprise',
    description: 'Corporate slate blue with dual action buttons and dual-motor sit-stand styling.',
    badge: 'ENTERPRISE',
    accentColor: '#3b82f6',
    previewBg: '#0f172a',
    banner: {
      title: 'Executive Command Center 2026',
      subtitle: 'Industrial Reliability for Heavy-Duty Workflows',
      description: 'High-load motorized dual-motor sit-stand lifting columns, magnetic cable management, and anti-glare task ambient light bars.',
      badge_text: 'ENTERPRISE & PRO EDITION',
      badgeText: 'ENTERPRISE & PRO EDITION',
      primary_button_text: 'Build Your Setup',
      primaryButtonText: 'Build Your Setup',
      primary_button_url: 'store',
      primaryButtonUrl: 'store',
      secondary_button_text: 'Affiliate Program',
      secondaryButtonText: 'Affiliate Program',
      secondary_button_url: 'affiliate',
      secondaryButtonUrl: 'affiliate',
      hero_image_url: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&q=80&w=1600',
      background_type: 'image',
      background_image_url: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&q=80&w=1600',
      background_position: 'center',
      overlay_enabled: true,
      overlay_color: '#0f172a',
      overlay_opacity: 0.8,
      text_color: '#ffffff',
      is_active: true
    }
  }
];

// Preset Solid Color Palettes
const PRESET_SOLID_PALETTES = [
  { name: 'Deep Slate', bgColor: '#0f172a', textColor: '#ffffff' },
  { name: 'Zinc Charcoal', bgColor: '#18181b', textColor: '#ffffff' },
  { name: 'Midnight Indigo', bgColor: '#1e1b4b', textColor: '#ffffff' },
  { name: 'Forest Emerald', bgColor: '#064e3b', textColor: '#ffffff' },
  { name: 'Deep Burgundy', bgColor: '#4c0519', textColor: '#ffffff' },
  { name: 'Onyx Dark', bgColor: '#09090b', textColor: '#f4f4f5' },
  { name: 'Crimson Velvet', bgColor: '#450a0a', textColor: '#ffffff' },
  { name: 'Nordic Navy', bgColor: '#082f49', textColor: '#ffffff' }
];

// Preset Stock Product Images
const PRESET_PRODUCT_IMAGES = [
  { name: 'Mechanical Keyboard Set', url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=1200' },
  { name: 'Timber Desk & Stand', url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=1200' },
  { name: 'Executive Monitor Kit', url: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&q=80&w=1200' },
  { name: 'Brass Stationery Set', url: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&q=80&w=1200' },
  { name: 'Minimalist Headphones', url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1200' }
];

// Preset Stock Background Scenery Images
const PRESET_BG_IMAGES = [
  { name: 'Dark Architecture', url: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&q=80&w=1600' },
  { name: 'Modern Desk Setup', url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=1600' },
  { name: 'Minimalist Workspace', url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=1600' },
  { name: 'Neon Studio Glow', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=1800' }
];

// Standard System Navigation Destinations
const SYSTEM_PAGES = [
  { id: 'store', name: 'Catalog Store (All Products)', label: 'Store Catalog' },
  { id: 'sale', name: 'Clearance & Sale Deals', label: 'Sale & Clearance' },
  { id: 'services', name: 'Custom Branding & Services', label: 'Custom Services' },
  { id: 'blog', name: 'Insights & News Articles', label: 'Blog & Insights' },
  { id: 'affiliate', name: 'Affiliate Marketing Portal', label: 'Affiliate Portal' },
  { id: 'contact', name: 'Contact & Support Desk', label: 'Contact Us' }
];

// Helper: Calculate banner lifecycle status
export function getBannerLifecycleStatus(banner: HeroBanner): {
  status: 'live' | 'scheduled' | 'expired' | 'inactive';
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  const isActive = banner.is_active !== undefined ? banner.is_active : banner.active !== false;
  if (!isActive) {
    return {
      status: 'inactive',
      label: 'Inactive / Draft',
      badgeClass: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
      dotClass: 'bg-zinc-400'
    };
  }

  const now = new Date();
  const start = banner.start_date || banner.startDate;
  if (start) {
    const startDate = new Date(start);
    if (!isNaN(startDate.getTime()) && now < startDate) {
      return {
        status: 'scheduled',
        label: `Scheduled: ${startDate.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        badgeClass: 'bg-amber-50 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-700',
        dotClass: 'bg-amber-500 animate-pulse'
      };
    }
  }

  const end = banner.end_date || banner.endDate;
  if (end) {
    const endDate = new Date(end);
    if (!isNaN(endDate.getTime()) && now > endDate) {
      return {
        status: 'expired',
        label: `Expired: Ended ${endDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`,
        badgeClass: 'bg-rose-50 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-700',
        dotClass: 'bg-rose-500'
      };
    }
  }

  return {
    status: 'live',
    label: 'Live on Storefront',
    badgeClass: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
    dotClass: 'bg-emerald-500'
  };
}

// Convert ISO string to format suitable for <input type="datetime-local">
function toDatetimeLocal(isoStr?: string | null): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

// Helper: Compress and resize image using HTML5 Canvas
function compressImage(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        try {
          const compressed = canvas.toDataURL('image/webp', quality);
          resolve(compressed);
        } catch {
          const fallback = canvas.toDataURL('image/jpeg', quality);
          resolve(fallback);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ==========================================
// Interactive Media Dropzone Component
// ==========================================
interface MediaDropzoneProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  presetImages: { name: string; url: string }[];
  placeholder?: string;
  helperText?: string;
}

function MediaDropzone({
  label,
  value,
  onChange,
  presetImages,
  placeholder = 'https://images.unsplash.com/...',
  helperText = 'Upload from computer, choose stock preset, or paste URL.'
}: MediaDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [inputMode, setInputMode] = useState<'upload' | 'url' | 'presets'>('upload');
  const [urlInput, setUrlInput] = useState(value);

  useEffect(() => {
    setUrlInput(value);
  }, [value]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WebP, SVG).');
      return;
    }
    setIsCompressing(true);
    try {
      const compressedDataUrl = await compressImage(file, 1200, 1200, 0.82);
      onChange(compressedDataUrl);
    } catch (err) {
      console.warn('Image compression fallback:', err);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') onChange(reader.result);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
        {/* Mode Toggle Tabs */}
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-md text-[11px]">
          <button
            type="button"
            onClick={() => setInputMode('upload')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              inputMode === 'upload' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            Upload
          </button>
          <button
            type="button"
            onClick={() => setInputMode('url')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              inputMode === 'url' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            URL
          </button>
          <button
            type="button"
            onClick={() => setInputMode('presets')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              inputMode === 'presets' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            Presets
          </button>
        </div>
      </div>

      {/* Preview Thumbnail if selected */}
      {value && (
        <div className="relative group p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-black/20 shrink-0 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
              <img src={value} alt="Preview" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                {value.startsWith('data:') ? 'Custom Uploaded Image (Optimized)' : value}
              </p>
              <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                Ready for live rendering
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange('');
              setUrlInput('');
            }}
            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/80 transition-colors cursor-pointer shrink-0"
            title="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mode 1: Drag-and-drop Dropzone */}
      {inputMode === 'upload' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }}
          />
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30'
                : 'border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-500 bg-zinc-50/50 dark:bg-zinc-850/40'
            }`}
          >
            <Upload className="w-6 h-6 mx-auto text-zinc-400 mb-1" />
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              {isCompressing ? 'Optimizing image...' : (
                <>Drag and drop image here, or <span className="text-indigo-600 dark:text-indigo-400 underline">browse files</span></>
              )}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1">
              Supports PNG, JPG, WebP, SVG with automatic compression
            </p>
          </div>
        </div>
      )}

      {/* Mode 2: Direct URL Input */}
      {inputMode === 'url' && (
        <div className="flex gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={() => onChange(urlInput.trim())}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Apply
          </button>
        </div>
      )}

      {/* Mode 3: Stock Presets */}
      {inputMode === 'presets' && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {presetImages.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                onChange(preset.url);
                setUrlInput(preset.url);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all border ${
                value === preset.url
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold'
                  : 'border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// Smart CTA Destination Selector Component
// ==========================================
interface SmartCtaSelectorProps {
  label: string;
  textValue: string;
  urlValue: string;
  onTextChange: (val: string) => void;
  onUrlChange: (val: string) => void;
  categories: Category[];
  placeholderText?: string;
}

function SmartCtaSelector({
  label,
  textValue,
  urlValue,
  onTextChange,
  onUrlChange,
  categories,
  placeholderText = 'e.g. Shop Collection'
}: SmartCtaSelectorProps) {
  const getInitialType = (): 'page' | 'category' | 'custom' => {
    if (!urlValue) return 'page';
    if (urlValue.startsWith('category:')) return 'category';
    if (urlValue.startsWith('product:')) return 'custom';
    if (SYSTEM_PAGES.some((p) => p.id === urlValue.toLowerCase().replace(/^\//, ''))) return 'page';
    return 'custom';
  };

  const [destType, setDestType] = useState<'page' | 'category' | 'custom'>(getInitialType);

  const activeCategories = useMemo(() => {
    return categories.filter((c) => c.status === 'Active' || !c.status);
  }, [categories]);

  return (
    <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
          <MousePointerClick className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          {label}
        </label>

        {/* Target Type Selector */}
        <div className="flex items-center gap-1 bg-zinc-200/80 dark:bg-zinc-700 p-0.5 rounded-md text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setDestType('page')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              destType === 'page' ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-300 shadow-2xs' : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            Page
          </button>
          <button
            type="button"
            onClick={() => setDestType('category')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              destType === 'category' ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-300 shadow-2xs' : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            Category
          </button>
          <button
            type="button"
            onClick={() => setDestType('custom')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              destType === 'custom' ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-300 shadow-2xs' : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            Custom
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Button Label Input */}
        <div>
          <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            Button Display Text
          </label>
          <input
            type="text"
            value={textValue}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder={placeholderText}
            className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Destination Target Dropdown / Input */}
        <div>
          <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            Destination Target
          </label>

          {destType === 'page' && (
            <select
              value={urlValue.replace(/^\//, '').toLowerCase()}
              onChange={(e) => onUrlChange(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            >
              <option value="">-- Choose Store Page --</option>
              {SYSTEM_PAGES.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.name}
                </option>
              ))}
            </select>
          )}

          {destType === 'category' && (
            <select
              value={urlValue.startsWith('category:') ? urlValue : ''}
              onChange={(e) => {
                if (e.target.value) {
                  onUrlChange(e.target.value);
                  if (!textValue) {
                    onTextChange(`Shop ${e.target.value.replace('category:', '')}`);
                  }
                }
              }}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            >
              <option value="">-- Select Dynamic Category --</option>
              {activeCategories.map((cat) => (
                <option key={cat.id} value={`category:${cat.name}`}>
                  {cat.name} ({cat.status || 'Active'})
                </option>
              ))}
            </select>
          )}

          {destType === 'custom' && (
            <input
              type="text"
              value={urlValue}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="e.g. store, /products, or https://..."
              className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Main AdminHeroSliderManager Component
// ==========================================
export function AdminHeroSliderManager() {
  const queryClient = useQueryClient();

  // Query all hero banners including inactive ones for admin view
  const { data: serverBanners } = useQuery<HeroBanner[]>({
    queryKey: ['admin-hero-banners'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/hero-banners/?all=true');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json)) {
            safeLocalStorageSetItem('veloce_hero_slides', JSON.stringify(json));
            return json;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch hero banners from API, checking local storage:', err);
      }
      // fallback
      try {
        const saved = localStorage.getItem('veloce_hero_slides');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {
        // ignore
      }
      return DEFAULT_HERO_SLIDES;
    }
  });

  const [slides, setSlides] = useState<HeroBanner[]>(() => {
    try {
      const saved = localStorage.getItem('veloce_hero_slides');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return DEFAULT_HERO_SLIDES;
  });

  const [activeTab, setActiveTab] = useState<'manager' | 'designer'>('manager');
  const [editingSlide, setEditingSlide] = useState<HeroBanner | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [listStatusFilter, setListStatusFilter] = useState<'all' | 'live' | 'scheduled' | 'expired' | 'inactive'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Dynamic Categories from storage / backend
  const [storedCategories, setStoredCategories] = useState<Category[]>(() => loadCategoriesFromStorage());

  useEffect(() => {
    fetchCategoriesFromBackend().then((cats) => {
      if (cats && Array.isArray(cats)) setStoredCategories(cats);
    });
  }, []);

  // Mobile Device Slider Disable Setting
  const [disableOnMobile, setDisableOnMobile] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('veloce_hero_slider_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.disableOnMobile === 'boolean') return parsed.disableOnMobile;
      }
    } catch {
      // ignore
    }
    return false;
  });

  useEffect(() => {
    if (serverBanners !== undefined && Array.isArray(serverBanners)) {
      setSlides(serverBanners);
    }
  }, [serverBanners]);

  const notifyChange = (newSlides: HeroBanner[], msg = 'Hero banners updated successfully!') => {
    setSlides(newSlides);
    try {
      safeLocalStorageSetItem('veloce_hero_slides', JSON.stringify(newSlides));
    } catch (storageErr) {
      console.warn('[AdminHeroSliderManager] Storage write fallback:', storageErr);
    }
    window.dispatchEvent(new Event('hero_slides_updated'));
    queryClient.invalidateQueries({ queryKey: ['hero-banners'] });
    queryClient.invalidateQueries({ queryKey: ['admin-hero-banners'] });
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(''), 3500);
  };

  const handleToggleMobileDisable = (val: boolean) => {
    setDisableOnMobile(val);
    try {
      safeLocalStorageSetItem('veloce_hero_slider_settings', JSON.stringify({ disableOnMobile: val }));
    } catch (storageErr) {
      console.warn('[AdminHeroSliderManager] Storage write fallback:', storageErr);
    }
    window.dispatchEvent(new Event('hero_slider_settings_updated'));
    setSaveSuccessMsg(val ? 'Hero banner hidden on mobile screens' : 'Hero banner visible on mobile screens');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleToggleActive = async (id: string) => {
    const target = slides.find((s) => s.id === id);
    if (!target) return;
    const currentActive = target.is_active !== undefined ? target.is_active : target.active !== false;
    const newActive = !currentActive;

    const updated = slides.map((s) => (s.id === id ? { ...s, is_active: newActive, active: newActive } : s));
    setSlides(updated);
    safeLocalStorageSetItem('veloce_hero_slides', JSON.stringify(updated));
    window.dispatchEvent(new Event('hero_slides_updated'));

    try {
      await fetch(`/api/hero-banners/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newActive })
      });
    } catch (err) {
      console.warn('API toggle fallback:', err);
    }

    queryClient.invalidateQueries({ queryKey: ['hero-banners'] });
    queryClient.invalidateQueries({ queryKey: ['admin-hero-banners'] });
    setSaveSuccessMsg(`Banner ${newActive ? 'activated' : 'deactivated'}`);
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this hero banner?')) return;
    const updated = slides.filter((s) => s.id !== id);
    
    // Optimistically update UI state & local storage
    setSlides(updated);
    safeLocalStorageSetItem('veloce_hero_slides', JSON.stringify(updated));
    window.dispatchEvent(new Event('hero_slides_updated'));

    try {
      await fetch(`/api/hero-banners/${id}/`, { method: 'DELETE' });
    } catch (err) {
      console.warn('API delete network fallback:', err);
    }

    queryClient.invalidateQueries({ queryKey: ['hero-banners'] });
    queryClient.invalidateQueries({ queryKey: ['admin-hero-banners'] });
    setSaveSuccessMsg('Hero banner deleted successfully');
    setTimeout(() => setSaveSuccessMsg(''), 3500);
  };

  const handleDuplicate = (slide: HeroBanner) => {
    const newId = `hero-banner-${Date.now()}`;
    const copy: HeroBanner = {
      ...slide,
      id: newId,
      title: `${slide.title} (Copy)`,
      display_order: slides.length + 1,
      displayOrder: slides.length + 1,
      is_active: false,
      active: false
    };
    const updated = [...slides, copy];
    notifyChange(updated, 'Banner duplicated as inactive draft');

    // Also persist duplicated banner
    fetch('/api/hero-banners/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(copy)
    }).catch((err) => console.warn('Duplicate banner API error:', err));
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= slides.length) return;

    const copy = [...slides];
    const item = copy.splice(index, 1)[0];
    copy.splice(newIndex, 0, item);

    // Update display orders
    const reordered = copy.map((s, idx) => ({ ...s, display_order: idx + 1, displayOrder: idx + 1 }));
    setSlides(reordered);
    safeLocalStorageSetItem('veloce_hero_slides', JSON.stringify(reordered));
    window.dispatchEvent(new Event('hero_slides_updated'));

    try {
      await fetch('/api/hero-banners/reorder/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: reordered.map((s) => s.id) })
      });
    } catch (err) {
      console.warn('API reorder fallback:', err);
    }

    queryClient.invalidateQueries({ queryKey: ['hero-banners'] });
    queryClient.invalidateQueries({ queryKey: ['admin-hero-banners'] });
    setSaveSuccessMsg('Banner order updated');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleStartEdit = (slide: HeroBanner) => {
    setEditingSlide({ ...slide });
    setActiveTab('designer');
  };

  const handleCreateNew = () => {
    const newId = `hero-banner-${Date.now()}`;
    const newBanner: HeroBanner = {
      id: newId,
      title: 'New Featured Collection Headline',
      subtitle: 'Highlight your latest workspace release or promotional campaign discount.',
      description: 'Crafted with premium materials and engineered for seamless productivity. Order online with instant dispatch.',
      badge_text: 'NEW ARRIVAL',
      primary_button_text: 'Shop Collection',
      primary_button_url: 'store',
      secondary_button_text: 'Learn More',
      secondary_button_url: 'services',
      hero_image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=1200',
      background_type: 'color',
      background_color: '#0f172a',
      background_image_url: '',
      background_position: 'center',
      overlay_enabled: true,
      overlay_color: '#000000',
      overlay_opacity: 0.4,
      text_color: '#ffffff',
      is_active: true,
      display_order: slides.length + 1,
      start_date: null,
      end_date: null,
    };
    setEditingSlide(newBanner);
    setActiveTab('designer');
  };

  const handleApplyTemplate = (preset: HeroTemplatePreset) => {
    const currentId = editingSlide?.id || `hero-banner-${Date.now()}`;
    const currentOrder = editingSlide?.display_order || slides.length + 1;
    const applied: HeroBanner = {
      ...editingSlide,
      ...preset.banner,
      id: currentId,
      display_order: currentOrder,
      displayOrder: currentOrder
    } as HeroBanner;
    setEditingSlide(applied);
    setIsTemplateModalOpen(false);
    setSaveSuccessMsg(`Applied template: ${preset.name}`);
    setTimeout(() => setSaveSuccessMsg(''), 2500);
  };

  const handleApplyQuickSchedule = (type: '3days' | '1week' | '2weeks' | 'monthEnd' | 'clear') => {
    if (!editingSlide) return;
    if (type === 'clear') {
      setEditingSlide({
        ...editingSlide,
        start_date: null,
        startDate: null,
        end_date: null,
        endDate: null
      });
      return;
    }

    const now = new Date();
    const startDate = now.toISOString();
    let endDateObj = new Date();

    if (type === '3days') {
      endDateObj.setDate(now.getDate() + 3);
    } else if (type === '1week') {
      endDateObj.setDate(now.getDate() + 7);
    } else if (type === '2weeks') {
      endDateObj.setDate(now.getDate() + 14);
    } else if (type === 'monthEnd') {
      endDateObj = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    setEditingSlide({
      ...editingSlide,
      start_date: startDate,
      startDate: startDate,
      end_date: endDateObj.toISOString(),
      endDate: endDateObj.toISOString()
    });
  };

  const handleSaveEditedSlide = async () => {
    if (!editingSlide) return;
    if (!editingSlide.title || !editingSlide.title.trim()) {
      setErrorMsg('Title headline is required.');
      return;
    }

    const exists = slides.some((s) => s.id === editingSlide.id);
    let updatedSlides: HeroBanner[];
    if (exists) {
      updatedSlides = slides.map((s) => (s.id === editingSlide.id ? editingSlide : s));
    } else {
      updatedSlides = [...slides, editingSlide];
    }

    // 1. Optimistic update in UI state & localStorage
    setSlides(updatedSlides);
    safeLocalStorageSetItem('veloce_hero_slides', JSON.stringify(updatedSlides));
    window.dispatchEvent(new Event('hero_slides_updated'));

    // 2. Persist to API
    try {
      const method = exists ? 'PUT' : 'POST';
      const endpoint = exists ? `/api/hero-banners/${editingSlide.id}/` : '/api/hero-banners/';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSlide)
      });
      if (res.ok) {
        const savedItem = await res.json();
        if (savedItem && savedItem.id) {
          const syncedSlides = updatedSlides.map(s => (s.id === editingSlide.id ? savedItem : s));
          setSlides(syncedSlides);
          safeLocalStorageSetItem('veloce_hero_slides', JSON.stringify(syncedSlides));
        }
      }
    } catch (err) {
      console.warn('API save fallback:', err);
    }

    // 3. Invalidate React Query caches
    queryClient.invalidateQueries({ queryKey: ['hero-banners'] });
    queryClient.invalidateQueries({ queryKey: ['admin-hero-banners'] });
    setSaveSuccessMsg('Hero banner saved successfully!');
    setTimeout(() => setSaveSuccessMsg(''), 3500);

    setActiveTab('manager');
    setEditingSlide(null);
    setErrorMsg('');
  };

  // Filtered Slides for Manager Tab
  const filteredSlides = useMemo(() => {
    return slides.filter((slide) => {
      const lifecycle = getBannerLifecycleStatus(slide);
      if (listStatusFilter !== 'all' && lifecycle.status !== listStatusFilter) {
        return false;
      }
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchTitle = (slide.title || '').toLowerCase().includes(q);
        const matchBadge = (slide.badge_text || slide.badgeText || '').toLowerCase().includes(q);
        const matchDesc = (slide.description || slide.subtitle || '').toLowerCase().includes(q);
        if (!matchTitle && !matchBadge && !matchDesc) return false;
      }
      return true;
    });
  }, [slides, listStatusFilter, searchFilter]);

  return (
    <div id="admin-hero-manager-root" className="space-y-6">
      {/* Header & Main Control Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Storefront CMS
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              Hero Section Banner Manager
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1.5">
            Design interactive two-column hero slides, upload cutouts & backgrounds, configure campaign date scheduling, and route smart CTAs.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {activeTab === 'designer' && (
            <button
              type="button"
              onClick={() => setIsTemplateModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Templates ({HERO_TEMPLATE_PRESETS.length})
            </button>
          )}

          <button
            id="admin-create-hero-btn"
            type="button"
            onClick={handleCreateNew}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add New Banner
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccessMsg && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200 text-sm font-semibold shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-200 text-sm font-semibold shadow-xs animate-in fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Mode Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('manager');
              setEditingSlide(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'manager'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            Banner List ({slides.length})
          </button>

          <button
            type="button"
            onClick={() => {
              if (!editingSlide && slides.length > 0) {
                setEditingSlide({ ...slides[0] });
              }
              setActiveTab('designer');
            }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'designer'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            {editingSlide ? `Visual Editor: ${editingSlide.title?.slice(0, 20)}...` : 'Visual Editor & Customizer'}
          </button>
        </div>

        {activeTab === 'designer' && (
          <div className="hidden sm:flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTemplateModalOpen(true)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Change Template Preset
            </button>
          </div>
        )}
      </div>

      {/* =========================================================
          TAB 1: BANNER LIST & REORDERING
      ========================================================= */}
      {activeTab === 'manager' && (
        <div className="space-y-5">
          {/* Controls bar: Search, Filters & Mobile switch */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search banners by title or badge..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Status Filter Badges */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              {(['all', 'live', 'scheduled', 'expired', 'inactive'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setListStatusFilter(filterKey)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer transition-colors ${
                    listStatusFilter === filterKey
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {filterKey}
                </button>
              ))}
            </div>

            {/* Mobile Visibility Setting Toggle */}
            <div className="flex items-center justify-between lg:justify-end gap-3 pl-0 lg:pl-3 border-t lg:border-t-0 lg:border-l border-zinc-200 dark:border-zinc-800 pt-2 lg:pt-0 shrink-0">
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-zinc-500" />
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Mobile Display
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleMobileDisable(!disableOnMobile)}
                className="cursor-pointer"
                title={disableOnMobile ? 'Hidden on mobile devices' : 'Visible on mobile devices'}
              >
                {disableOnMobile ? (
                  <ToggleLeft className="w-7 h-7 text-zinc-400" />
                ) : (
                  <ToggleRight className="w-7 h-7 text-indigo-600" />
                )}
              </button>
            </div>
          </div>

          {/* Banner Cards List */}
          <div className="grid grid-cols-1 gap-3.5">
            {filteredSlides.length > 0 ? (
              filteredSlides.map((slide, index) => {
                const isActive = slide.is_active !== undefined ? slide.is_active : slide.active !== false;
                const bgCol = slide.background_color || slide.backgroundColor || slide.bgColor || '#0f172a';
                const heroImg = slide.hero_image_url || slide.hero_image || slide.heroImage || slide.imageUrl || '';
                const lifecycle = getBannerLifecycleStatus(slide);

                return (
                  <div
                    key={slide.id || index}
                    id={`admin-banner-row-${slide.id}`}
                    className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 sm:p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all gap-4 shadow-2xs group"
                  >
                    {/* Left: Thumbnail & Metadata */}
                    <div className="flex items-center gap-4 w-full md:w-auto min-w-0">
                      {/* Banner Visual Thumbnail */}
                      <div
                        className="w-24 h-16 rounded-xl flex items-center justify-center relative overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700 shadow-2xs"
                        style={{ backgroundColor: bgCol }}
                      >
                        {heroImg ? (
                          <img
                            src={heroImg}
                            alt={slide.title}
                            className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <span className="text-[10px] font-bold text-white/70 uppercase">Solid Color</span>
                        )}
                        {slide.badge_text && (
                          <span className="absolute top-1 left-1 px-1.5 py-0.2 bg-indigo-600 text-white text-[8px] font-extrabold rounded shadow-2xs">
                            {slide.badge_text.slice(0, 10)}
                          </span>
                        )}
                      </div>

                      {/* Details & Status */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-black text-zinc-400">
                            #{slide.display_order || index + 1}
                          </span>
                          <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate max-w-md">
                            {slide.title}
                          </h4>

                          {/* Lifecycle Status Pill */}
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${lifecycle.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${lifecycle.dotClass}`} />
                            {lifecycle.label}
                          </span>

                          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                            {slide.background_type === 'image' ? 'Image BG' : 'Solid Color'}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-xl">
                          {slide.subtitle || slide.description || 'No supporting description provided.'}
                        </p>

                        <div className="flex items-center gap-3 text-[11px] text-zinc-400 flex-wrap">
                          <span>
                            Primary CTA: <strong className="text-zinc-700 dark:text-zinc-200">{slide.primary_button_text || 'Shop Now'}</strong> ({slide.primary_button_url || 'store'})
                          </span>
                          {slide.secondary_button_text && (
                            <span>
                              Secondary: <strong className="text-zinc-700 dark:text-zinc-200">{slide.secondary_button_text}</strong> ({slide.secondary_button_url || 'services'})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                      {/* Move Up / Down */}
                      <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveOrder(index, 'up')}
                          title="Move higher"
                          className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === slides.length - 1}
                          onClick={() => handleMoveOrder(index, 'down')}
                          title="Move lower"
                          className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Duplicate */}
                      <button
                        type="button"
                        onClick={() => handleDuplicate(slide)}
                        title="Duplicate as draft copy"
                        className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      {/* Active Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(slide.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                        }`}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(slide)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDelete(slide.id)}
                        title="Delete banner"
                        className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                <Layout className="w-8 h-8 mx-auto text-zinc-400" />
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                  No hero banners found matching your criteria.
                </p>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Try adjusting the search query or status filter, or create a brand new featured banner.
                </p>
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Create New Banner
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          TAB 2: VISUAL DESIGNER & CUSTOMIZER
      ========================================================= */}
      {activeTab === 'designer' && editingSlide && (
        <div className="space-y-6">
          {/* Live Viewport Preview Frame */}
          <div className="bg-zinc-950 p-4 sm:p-6 rounded-2xl border border-zinc-800 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-black text-white uppercase tracking-wider">
                  Live Viewport Preview
                </span>
                {/* Status Indicator */}
                {(() => {
                  const lc = getBannerLifecycleStatus(editingSlide);
                  return (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${lc.badgeClass}`}>
                      {lc.label}
                    </span>
                  );
                })()}
              </div>

              {/* Viewport Toggles & Background check */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('desktop')}
                    className={`px-2 py-1 rounded flex items-center gap-1 cursor-pointer font-semibold ${
                      previewMode === 'desktop' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('tablet')}
                    className={`px-2 py-1 rounded flex items-center gap-1 cursor-pointer font-semibold ${
                      previewMode === 'tablet' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Tablet className="w-3.5 h-3.5" />
                    Tablet
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('mobile')}
                    className={`px-2 py-1 rounded flex items-center gap-1 cursor-pointer font-semibold ${
                      previewMode === 'mobile' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Mobile
                  </button>
                </div>
              </div>
            </div>

            {/* Live Slider Render Container */}
            <div className="flex justify-center w-full overflow-hidden bg-black/40 p-2 sm:p-4 rounded-xl border border-zinc-800/80">
              <div
                className={`transition-all duration-300 overflow-hidden rounded-xl border border-zinc-700/60 ${
                  previewMode === 'desktop'
                    ? 'w-full'
                    : previewMode === 'tablet'
                    ? 'w-[768px]'
                    : 'w-[375px]'
                }`}
              >
                <HeroBannerSlider
                  slides={[editingSlide]}
                  ignoreMobileDisable={true}
                  className="shadow-inner"
                />
              </div>
            </div>
          </div>

          {/* Form Controls: 2 Column Configuration Suite */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            {/* Column 1: Left Copy, Badges, CTAs & Text Colors */}
            <div className="lg:col-span-6 space-y-5">
              <div className="border-b border-zinc-200 dark:border-zinc-800 pb-2.5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    1. Text Copy & Smart Call-To-Actions
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Headline, supporting description, and interactive action buttons.
                  </p>
                </div>
              </div>

              {/* Eyebrow Badge Text */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Hero Eyebrow Badge (Optional)
                </label>
                <input
                  type="text"
                  value={editingSlide.badge_text || editingSlide.badgeText || ''}
                  onChange={(e) =>
                    setEditingSlide({
                      ...editingSlide,
                      badge_text: e.target.value,
                      badgeText: e.target.value
                    })
                  }
                  placeholder="e.g. NEW ARRIVALS 2026 or LIMITED TIME PROMOTION"
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Headline */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Compelling Headline <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingSlide.title || ''}
                  onChange={(e) => setEditingSlide({ ...editingSlide, title: e.target.value })}
                  placeholder="e.g. Precision Engineered Workspace Objects & Machinery"
                  className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Sub-headline / Paragraph */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Supporting Sub-headline / Paragraph
                </label>
                <textarea
                  rows={3}
                  value={editingSlide.description || editingSlide.subtitle || ''}
                  onChange={(e) =>
                    setEditingSlide({
                      ...editingSlide,
                      description: e.target.value,
                      subtitle: e.target.value
                    })
                  }
                  placeholder="e.g. Elevate your display and organize accessories with CNC-machined solid White Oak and heavy-gauge structural steel."
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Primary Smart CTA Selector */}
              <SmartCtaSelector
                label="Primary Action Button"
                textValue={editingSlide.primary_button_text || editingSlide.primaryButtonText || ''}
                urlValue={editingSlide.primary_button_url || editingSlide.primaryButtonUrl || ''}
                onTextChange={(val) =>
                  setEditingSlide({
                    ...editingSlide,
                    primary_button_text: val,
                    primaryButtonText: val
                  })
                }
                onUrlChange={(val) =>
                  setEditingSlide({
                    ...editingSlide,
                    primary_button_url: val,
                    primaryButtonUrl: val
                  })
                }
                categories={storedCategories}
                placeholderText="e.g. Shop Collection"
              />

              {/* Secondary Smart CTA Selector */}
              <SmartCtaSelector
                label="Secondary Action Button (Optional)"
                textValue={editingSlide.secondary_button_text || editingSlide.secondaryButtonText || ''}
                urlValue={editingSlide.secondary_button_url || editingSlide.secondaryButtonUrl || ''}
                onTextChange={(val) =>
                  setEditingSlide({
                    ...editingSlide,
                    secondary_button_text: val,
                    secondaryButtonText: val
                  })
                }
                onUrlChange={(val) =>
                  setEditingSlide({
                    ...editingSlide,
                    secondary_button_url: val,
                    secondaryButtonUrl: val
                  })
                }
                categories={storedCategories}
                placeholderText="e.g. Custom Services"
              />

              {/* Text Color Picker */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Primary Text & Headline Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editingSlide.text_color || editingSlide.textColor || '#ffffff'}
                    onChange={(e) =>
                      setEditingSlide({
                        ...editingSlide,
                        text_color: e.target.value,
                        textColor: e.target.value
                      })
                    }
                    className="w-9 h-9 rounded cursor-pointer border border-zinc-300 dark:border-zinc-700 shrink-0"
                  />
                  <input
                    type="text"
                    value={editingSlide.text_color || editingSlide.textColor || '#ffffff'}
                    onChange={(e) =>
                      setEditingSlide({
                        ...editingSlide,
                        text_color: e.target.value,
                        textColor: e.target.value
                      })
                    }
                    className="w-28 px-3 py-1.5 text-xs font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Column 2: Right Image, Background Style, Overlays & Date Scheduling */}
            <div className="lg:col-span-6 space-y-5">
              <div className="border-b border-zinc-200 dark:border-zinc-800 pb-2.5">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  2. Imagery, Backgrounds & Scheduling
                </h3>
                <p className="text-xs text-zinc-500">
                  Dropzone media uploaders, scenery backdrop tint, and campaign start/expiry timers.
                </p>
              </div>

              {/* Right Column Product/Hero Cutout Image Dropzone */}
              <MediaDropzone
                label="Product / Hero Cutout Image"
                value={editingSlide.hero_image_url || editingSlide.hero_image || editingSlide.heroImage || editingSlide.imageUrl || ''}
                onChange={(val) =>
                  setEditingSlide({
                    ...editingSlide,
                    hero_image_url: val,
                    heroImage: val,
                    imageUrl: val
                  })
                }
                presetImages={PRESET_PRODUCT_IMAGES}
                helperText="Upload transparent PNG/WebP product cutout or pick stock photo."
              />

              {/* Background Type Toggle */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                  Background Style
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingSlide({
                        ...editingSlide,
                        background_type: 'color',
                        backgroundType: 'color'
                      })
                    }
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      editingSlide.background_type === 'color' || !editingSlide.background_type
                        ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-xs'
                        : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="font-bold text-xs text-zinc-900 dark:text-white">
                      Solid Color
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Clean solid palette
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditingSlide({
                        ...editingSlide,
                        background_type: 'image',
                        backgroundType: 'image'
                      })
                    }
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      editingSlide.background_type === 'image'
                        ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-xs'
                        : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="font-bold text-xs text-zinc-900 dark:text-white">
                      Scenery Image
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Full-bleed photographic banner
                    </div>
                  </button>
                </div>
              </div>

              {/* Solid Color Settings */}
              {editingSlide.background_type !== 'image' && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Background Color & Presets
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={editingSlide.background_color || editingSlide.backgroundColor || editingSlide.bgColor || '#0f172a'}
                      onChange={(e) =>
                        setEditingSlide({
                          ...editingSlide,
                          background_color: e.target.value,
                          backgroundColor: e.target.value,
                          bgColor: e.target.value
                        })
                      }
                      className="w-9 h-9 rounded cursor-pointer border border-zinc-300 dark:border-zinc-700 shrink-0"
                    />
                    <input
                      type="text"
                      value={editingSlide.background_color || editingSlide.backgroundColor || editingSlide.bgColor || '#0f172a'}
                      onChange={(e) =>
                        setEditingSlide({
                          ...editingSlide,
                          background_color: e.target.value,
                          backgroundColor: e.target.value,
                          bgColor: e.target.value
                        })
                      }
                      className="w-28 px-3 py-1.5 text-xs font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>

                  {/* Preset Swatches */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {PRESET_SOLID_PALETTES.map((palette) => (
                      <button
                        key={palette.name}
                        type="button"
                        onClick={() =>
                          setEditingSlide({
                            ...editingSlide,
                            background_color: palette.bgColor,
                            backgroundColor: palette.bgColor,
                            bgColor: palette.bgColor,
                            text_color: palette.textColor,
                            textColor: palette.textColor
                          })
                        }
                        className="px-2 py-1 rounded text-[11px] font-medium border border-zinc-200 dark:border-zinc-700 hover:opacity-80 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        style={{ backgroundColor: palette.bgColor, color: palette.textColor }}
                      >
                        {palette.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Background Image Dropzone Settings */}
              {editingSlide.background_type === 'image' && (
                <MediaDropzone
                  label="Scenery Background Image"
                  value={editingSlide.background_image_url || editingSlide.backgroundImage || editingSlide.bgImageUrl || ''}
                  onChange={(val) =>
                    setEditingSlide({
                      ...editingSlide,
                      background_image_url: val,
                      backgroundImage: val,
                      bgImageUrl: val
                    })
                  }
                  presetImages={PRESET_BG_IMAGES}
                  placeholder="https://images.unsplash.com/..."
                  helperText="High resolution scenery or architectural photo."
                />
              )}

              {/* Overlay Customizer */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Background Shading & Tint Overlay
                  </label>
                  <input
                    type="checkbox"
                    checked={editingSlide.overlay_enabled !== undefined ? editingSlide.overlay_enabled : (editingSlide.overlayEnabled !== false)}
                    onChange={(e) =>
                      setEditingSlide({
                        ...editingSlide,
                        overlay_enabled: e.target.checked,
                        overlayEnabled: e.target.checked
                      })
                    }
                    className="w-4 h-4 text-indigo-600 rounded cursor-pointer accent-indigo-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-500 mb-1">Overlay Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editingSlide.overlay_color || editingSlide.overlayColor || '#000000'}
                        onChange={(e) =>
                          setEditingSlide({
                            ...editingSlide,
                            overlay_color: e.target.value,
                            overlayColor: e.target.value
                          })
                        }
                        className="w-7 h-7 rounded cursor-pointer shrink-0"
                      />
                      <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
                        {editingSlide.overlay_color || '#000000'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-zinc-500 mb-1">
                      Opacity: {Math.round((editingSlide.overlay_opacity ?? editingSlide.overlayOpacity ?? 0.5) * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={editingSlide.overlay_opacity ?? editingSlide.overlayOpacity ?? 0.5}
                      onChange={(e) =>
                        setEditingSlide({
                          ...editingSlide,
                          overlay_opacity: parseFloat(e.target.value),
                          overlayOpacity: parseFloat(e.target.value)
                        })
                      }
                      className="w-full cursor-pointer accent-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* Campaign Date Scheduling Suite */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    Campaign Scheduling & Expiry
                  </label>
                  <button
                    type="button"
                    onClick={() => handleApplyQuickSchedule('clear')}
                    className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline cursor-pointer"
                  >
                    Clear Dates
                  </button>
                </div>

                {/* Quick Schedule Presets */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleApplyQuickSchedule('3days')}
                    className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[10px] font-bold hover:bg-zinc-300 dark:hover:bg-zinc-600 cursor-pointer"
                  >
                    +3 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyQuickSchedule('1week')}
                    className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[10px] font-bold hover:bg-zinc-300 dark:hover:bg-zinc-600 cursor-pointer"
                  >
                    +1 Week
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyQuickSchedule('2weeks')}
                    className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[10px] font-bold hover:bg-zinc-300 dark:hover:bg-zinc-600 cursor-pointer"
                  >
                    +2 Weeks
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyQuickSchedule('monthEnd')}
                    className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[10px] font-bold hover:bg-zinc-300 dark:hover:bg-zinc-600 cursor-pointer"
                  >
                    End of Month
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Start Publish Date/Time
                    </label>
                    <input
                      type="datetime-local"
                      value={toDatetimeLocal(editingSlide.start_date || editingSlide.startDate)}
                      onChange={(e) => {
                        const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                        setEditingSlide({
                          ...editingSlide,
                          start_date: val,
                          startDate: val
                        });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      End Expiry Date/Time
                    </label>
                    <input
                      type="datetime-local"
                      value={toDatetimeLocal(editingSlide.end_date || editingSlide.endDate)}
                      onChange={(e) => {
                        const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                        setEditingSlide({
                          ...editingSlide,
                          end_date: val,
                          endDate: val
                        });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Status & Display Priority Order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Storefront Visibility
                  </label>
                  <select
                    value={editingSlide.is_active !== undefined ? (editingSlide.is_active ? 'active' : 'inactive') : (editingSlide.active ? 'active' : 'inactive')}
                    onChange={(e) => {
                      const activeVal = e.target.value === 'active';
                      setEditingSlide({
                        ...editingSlide,
                        is_active: activeVal,
                        active: activeVal
                      });
                    }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold"
                  >
                    <option value="active">Active (Visible)</option>
                    <option value="inactive">Inactive (Draft / Hidden)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Display Priority Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingSlide.display_order ?? editingSlide.displayOrder ?? 1}
                    onChange={(e) =>
                      setEditingSlide({
                        ...editingSlide,
                        display_order: parseInt(e.target.value) || 1,
                        displayOrder: parseInt(e.target.value) || 1
                      })
                    }
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer Bar */}
          <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <button
              type="button"
              onClick={() => {
                setActiveTab('manager');
                setEditingSlide(null);
              }}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
            >
              Cancel
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5 text-amber-500" />
                Apply Preset
              </button>

              <button
                id="admin-save-hero-btn"
                type="button"
                onClick={handleSaveEditedSlide}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md cursor-pointer transition-all"
              >
                <Save className="w-4 h-4" />
                Save Hero Banner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          ONE-CLICK TEMPLATES GALLERY MODAL
      ========================================================= */}
      {isTemplateModalOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setIsTemplateModalOpen(false)}
          />
          <div className="fixed inset-4 sm:inset-10 md:inset-16 z-50 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-lg font-black text-zinc-900 dark:text-white">
                    Curated Hero Banner Template Gallery
                  </h3>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Choose a professionally styled hero template. You can customize text, imagery, and links after applying.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Cards Grid */}
            <div className="flex-1 p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {HERO_TEMPLATE_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850/50 p-5 flex flex-col justify-between hover:border-indigo-500 dark:hover:border-indigo-500 transition-all shadow-2xs hover:shadow-md group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider text-white shadow-2xs"
                        style={{ backgroundColor: preset.accentColor }}
                      >
                        {preset.badge}
                      </span>
                      <span className="text-[11px] font-medium text-zinc-400">
                        {preset.category}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-zinc-900 dark:text-white">
                      {preset.name}
                    </h4>

                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {preset.description}
                    </p>

                    {/* Mini Visual Preview Block */}
                    <div
                      className="h-24 rounded-xl p-3 flex items-center justify-between overflow-hidden border border-zinc-300 dark:border-zinc-700 relative"
                      style={{ backgroundColor: preset.previewBg }}
                    >
                      <div className="space-y-1 max-w-[60%]">
                        <div className="h-2 w-12 bg-white/40 rounded" />
                        <div className="h-3 w-28 bg-white/90 rounded font-bold" />
                        <div className="h-2 w-20 bg-white/40 rounded" />
                      </div>
                      {preset.banner.hero_image_url && (
                        <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0">
                          <img
                            src={preset.banner.hero_image_url}
                            alt=""
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyTemplate(preset)}
                    className="mt-4 w-full py-2 px-4 rounded-xl bg-zinc-900 hover:bg-indigo-600 dark:bg-zinc-800 dark:hover:bg-indigo-600 text-white text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Apply This Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AdminHeroSliderManager;
