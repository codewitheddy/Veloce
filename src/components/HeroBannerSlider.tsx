import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  ArrowRight
} from 'lucide-react';
import { HeroBanner } from '../types';
import { getOptimizedImageUrl, generateSrcSet } from '../utils/imageUtils';

export const DEFAULT_HERO_SLIDES: HeroBanner[] = [
  {
    id: 'hero-banner-1',
    title: 'Precision Mechanical Hardware',
    subtitle: 'Engineered for Performance & Tactile Perfection',
    description: 'CNC-machined aluminum frames, custom tuned linear switches, and dye-sublimated PBT keycaps. Built for relentless productivity.',
    badge_text: 'NEW RELEASE 2026',
    badgeText: 'NEW RELEASE 2026',
    primary_button_text: 'Explore Keyboards',
    primaryButtonText: 'Explore Keyboards',
    primary_button_url: 'store',
    primaryButtonUrl: 'store',
    secondary_button_text: 'Custom Services',
    secondaryButtonText: 'Custom Services',
    secondary_button_url: 'services',
    secondaryButtonUrl: 'services',
    hero_image: null,
    hero_image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=1200',
    heroImage: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=1200',
    background_type: 'color',
    backgroundType: 'color',
    background_color: '#0f172a',
    backgroundColor: '#0f172a',
    background_image: null,
    background_image_url: '',
    backgroundImage: '',
    background_position: 'center',
    backgroundPosition: 'center',
    overlay_enabled: true,
    overlayEnabled: true,
    overlay_color: '#000000',
    overlayColor: '#000000',
    overlay_opacity: 0.4,
    overlayOpacity: 0.4,
    text_color: '#ffffff',
    textColor: '#ffffff',
    is_active: true,
    active: true,
    display_order: 1,
    displayOrder: 1,
    start_date: null,
    end_date: null,
    created_at: new Date().toISOString()
  },
  {
    id: 'hero-banner-2',
    title: 'Minimalist Artisan Workspaces',
    subtitle: 'Natural Solid Hardwoods & Clean Architecture',
    description: 'Sustainably sourced Walnut and White Oak desk accessories, dual monitor risers, and magnetic modular organizers.',
    badge_text: 'HANDCRAFTED EDITIONS',
    badgeText: 'HANDCRAFTED EDITIONS',
    primary_button_text: 'Shop Workspace Gear',
    primaryButtonText: 'Shop Workspace Gear',
    primary_button_url: 'store',
    primaryButtonUrl: 'store',
    secondary_button_text: 'Read Design Stories',
    secondaryButtonText: 'Read Design Stories',
    secondary_button_url: 'blog',
    secondaryButtonUrl: 'blog',
    hero_image: null,
    hero_image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=1200',
    heroImage: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=1200',
    background_type: 'image',
    backgroundType: 'image',
    background_color: '#18181b',
    backgroundColor: '#18181b',
    background_image: null,
    background_image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=1600',
    backgroundImage: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=1600',
    background_position: 'center',
    backgroundPosition: 'center',
    overlay_enabled: true,
    overlayEnabled: true,
    overlay_color: '#09090b',
    overlayColor: '#09090b',
    overlay_opacity: 0.75,
    overlayOpacity: 0.75,
    text_color: '#ffffff',
    textColor: '#ffffff',
    is_active: true,
    active: true,
    display_order: 2,
    displayOrder: 2,
    start_date: null,
    end_date: null,
    created_at: new Date().toISOString()
  }
];

async function fetchHeroBanners(): Promise<HeroBanner[]> {
  try {
    const res = await fetch('/api/hero-banners/');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch {
    // fallback
  }

  try {
    const saved = localStorage.getItem('veloce_hero_slides');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }

  return DEFAULT_HERO_SLIDES;
}

export interface HeroBannerSliderProps {
  slides?: HeroBanner[];
  onNavigateTab?: (tab: string) => void;
  onSelectCategory?: (category: string, subcategory?: string) => void;
  onSelectSale?: () => void;
  onProductClick?: (productId: string) => void;
  className?: string;
  autoPlayIntervalMs?: number;
  ignoreMobileDisable?: boolean;
}

export function HeroBannerSlider({
  slides: propSlides,
  onNavigateTab,
  onSelectCategory,
  onSelectSale,
  onProductClick,
  className = '',
  autoPlayIntervalMs = 7000,
  ignoreMobileDisable = false
}: HeroBannerSliderProps) {
  const { data: queriedSlides, refetch } = useQuery<HeroBanner[]>({
    queryKey: ['hero-banners'],
    queryFn: fetchHeroBanners,
    staleTime: 10000,
    initialData: propSlides !== undefined && propSlides.length > 0 ? propSlides : DEFAULT_HERO_SLIDES,
  });

  const [slides, setSlides] = useState<HeroBanner[]>(() => {
    if (propSlides !== undefined && propSlides.length > 0) return propSlides;
    if (queriedSlides !== undefined && queriedSlides.length > 0) return queriedSlides;
    try {
      const saved = localStorage.getItem('veloce_hero_slides');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_HERO_SLIDES;
  });

  useEffect(() => {
    if (propSlides !== undefined && propSlides.length > 0) {
      setSlides(propSlides);
    } else if (queriedSlides !== undefined && queriedSlides.length > 0) {
      setSlides(queriedSlides);
    }
  }, [propSlides, queriedSlides]);

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

  const now = new Date();
  const rawFiltered = (slides && slides.length > 0 ? slides : DEFAULT_HERO_SLIDES)
    .filter((s) => {
      const isActive = s.is_active !== undefined ? s.is_active : s.active !== false;
      if (!isActive) return false;

      const start = s.start_date || s.startDate;
      if (start) {
        const startDate = new Date(start);
        if (!isNaN(startDate.getTime()) && now < startDate) return false;
      }
      const end = s.end_date || s.endDate;
      if (end) {
        const endDate = new Date(end);
        if (!isNaN(endDate.getTime()) && now > endDate) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const orderA = a.display_order ?? a.displayOrder ?? 0;
      const orderB = b.display_order ?? b.displayOrder ?? 0;
      return orderA - orderB;
    });

  const activeSlides = rawFiltered.length > 0 ? rawFiltered : DEFAULT_HERO_SLIDES;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const handleSlidesUpdate = () => {
      refetch();
      try {
        const saved = localStorage.getItem('veloce_hero_slides');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSlides(parsed);
          }
        }
      } catch {
        // ignore
      }
    };

    const handleSettingsUpdate = () => {
      try {
        const saved = localStorage.getItem('veloce_hero_slider_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.disableOnMobile === 'boolean') {
            setDisableOnMobile(parsed.disableOnMobile);
          }
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('hero_slides_updated', handleSlidesUpdate);
    window.addEventListener('hero_slider_settings_updated', handleSettingsUpdate);
    window.addEventListener('storage', handleSlidesUpdate);
    window.addEventListener('storage', handleSettingsUpdate);
    return () => {
      window.removeEventListener('hero_slides_updated', handleSlidesUpdate);
      window.removeEventListener('hero_slider_settings_updated', handleSettingsUpdate);
      window.removeEventListener('storage', handleSlidesUpdate);
      window.removeEventListener('storage', handleSettingsUpdate);
    };
  }, [refetch]);

  useEffect(() => {
    if (currentIndex >= activeSlides.length && activeSlides.length > 0) {
      setCurrentIndex(0);
    }
  }, [activeSlides.length, currentIndex]);

  useEffect(() => {
    if (!isPlaying || isHovered || activeSlides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
    }, autoPlayIntervalMs);
    return () => clearInterval(timer);
  }, [isPlaying, isHovered, activeSlides.length, autoPlayIntervalMs]);

  const handleNext = () => {
    if (activeSlides.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
  };

  const handlePrev = () => {
    if (activeSlides.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);
      if (isInput) return;

      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSlides.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (diff > 45) {
      handleNext();
    } else if (diff < -45) {
      handlePrev();
    }
    touchStartX.current = null;
  };

  const handleCtaClick = (targetUrl?: string) => {
    if (!targetUrl) {
      if (onNavigateTab) onNavigateTab('store');
      return;
    }

    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (targetUrl.startsWith('category:')) {
      const catName = targetUrl.replace('category:', '').trim();
      if (onSelectCategory) {
        onSelectCategory(catName);
      }
      if (onNavigateTab) {
        onNavigateTab('store');
      }
      window.dispatchEvent(new CustomEvent('veloce_navigate_category', { detail: { category: catName } }));
      return;
    }

    if (targetUrl.startsWith('product:')) {
      const prodId = targetUrl.replace('product:', '').trim();
      if (onProductClick) {
        onProductClick(prodId);
      } else {
        window.dispatchEvent(new CustomEvent('veloce_open_product_modal', { detail: { productId: prodId } }));
      }
      return;
    }

    const cleaned = targetUrl.replace(/^\//, '').toLowerCase();
    if (cleaned === 'sale' || cleaned === 'clearance') {
      if (onSelectSale) {
        onSelectSale();
      }
      if (onNavigateTab) {
        onNavigateTab('store');
      }
      return;
    }

    if (onNavigateTab) {
      if (cleaned === 'products' || cleaned === 'shop' || cleaned === 'store') {
        onNavigateTab('store');
      } else if (cleaned === 'affiliate' || cleaned === 'affiliates') {
        onNavigateTab('affiliate');
      } else if (cleaned === 'services' || cleaned === 'custom') {
        onNavigateTab('services');
      } else {
        onNavigateTab(cleaned);
      }
    }
  };

  if (activeSlides.length === 0) return null;

  const currentSlide = activeSlides[currentIndex] || activeSlides[0];

  const title = currentSlide.title || 'Discover Next-Gen Quality';
  const subtitle = currentSlide.subtitle || 'Welcome to Veloce Store';
  const description = currentSlide.description || 'Curated products and high-performance collections crafted for excellence.';
  const primaryCtaText = currentSlide.primary_button_text || currentSlide.primaryButtonText || 'Explore Catalog';
  const primaryCtaUrl = currentSlide.primary_button_url || currentSlide.primaryButtonUrl || 'store';
  const secondaryCtaText = currentSlide.secondary_button_text || currentSlide.secondaryButtonText || '';
  const secondaryCtaUrl = currentSlide.secondary_button_url || currentSlide.secondaryButtonUrl || '';
  const rawHeroImage = currentSlide.hero_image || currentSlide.hero_image_url || currentSlide.heroImage || '';
  const hasHeroImage = Boolean(rawHeroImage && typeof rawHeroImage === 'string' && rawHeroImage.trim().length > 0);
  const heroImage = hasHeroImage ? rawHeroImage.trim() : '';
  
  const bgType = currentSlide.background_type || currentSlide.backgroundType || 'image';
  const bgColor = currentSlide.background_color || currentSlide.backgroundColor || '#141414';
  const bgImage = currentSlide.background_image || currentSlide.background_image_url || currentSlide.backgroundImage || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=1800';
  const bgPosition = currentSlide.background_position || currentSlide.backgroundPosition || 'center';
  
  const overlayEnabled = currentSlide.overlay_enabled !== undefined ? currentSlide.overlay_enabled : (currentSlide.overlayEnabled !== undefined ? currentSlide.overlayEnabled : true);
  const overlayColor = currentSlide.overlay_color || currentSlide.overlayColor || '#0a0a0a';
  const overlayOpacity = typeof currentSlide.overlay_opacity === 'number' ? currentSlide.overlay_opacity : 0.7;

  const mobileHiddenClass = disableOnMobile && !ignoreMobileDisable ? 'hidden md:block' : 'block';

  return (
    <section
      id="storefront-hero-banner"
      aria-roledescription="carousel"
      aria-label="Storefront Hero Promotion Banners"
      className={`relative w-full bg-[#181818] overflow-hidden select-none border-b border-[#2a2a2a] ${mobileHiddenClass} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative min-h-[240px] sm:min-h-[280px] md:min-h-[300px] lg:min-h-[330px] flex items-center justify-center">
        {/* Background Layer */}
        <div
          className="absolute inset-0 z-0 transition-all duration-700 ease-in-out"
          style={{
            backgroundColor: bgColor,
            backgroundImage: bgType === 'image' && bgImage ? `url(${bgImage})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: bgPosition,
            backgroundRepeat: 'no-repeat',
          }}
        >
          {overlayEnabled && (
            <div
              className="absolute inset-0 transition-opacity duration-500 bg-slate-950/75"
              style={{
                backgroundColor: overlayColor,
                opacity: overlayOpacity,
              }}
            />
          )}
        </div>

        {/* Hero Content Container - Clean Dynamic Layout */}
        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 py-4 sm:py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide.id || currentIndex}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className={`grid grid-cols-1 ${hasHeroImage ? 'md:grid-cols-12 gap-6 sm:gap-8' : 'gap-4'} items-center`}
            >
              {/* Left Column: Subtitle, Title, Description, and CTA Button(s) */}
              <div className={`${hasHeroImage ? 'md:col-span-7 lg:col-span-7' : 'max-w-2xl lg:max-w-3xl'} flex flex-col justify-center items-start text-left space-y-2 sm:space-y-3`}>
                {subtitle && (
                  <span className="text-xs sm:text-sm lg:text-base font-semibold text-[#fed700] uppercase tracking-wider font-sans">
                    {subtitle}
                  </span>
                )}
                
                <h1 className={`text-xl sm:text-2xl md:text-2xl ${hasHeroImage ? 'lg:text-3xl' : 'lg:text-4xl'} font-black tracking-tight text-white leading-tight font-sans drop-shadow-md max-w-xl ${!hasHeroImage ? 'lg:max-w-2xl' : ''} line-clamp-2`}>
                  {title}
                </h1>

                {description && (
                  <p className={`text-xs sm:text-sm lg:text-base font-normal text-gray-300 ${hasHeroImage ? 'max-w-lg' : 'max-w-2xl'} leading-relaxed`}>
                    {description}
                  </p>
                )}

                <div className="pt-2 sm:pt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleCtaClick(primaryCtaUrl)}
                    className="inline-flex items-center justify-center px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-xs sm:text-sm font-extrabold text-white bg-[#e63946] hover:bg-[#d62828] active:scale-95 transition-all duration-200 shadow-xl cursor-pointer hover:shadow-red-600/30"
                  >
                    <span>{primaryCtaText}</span>
                  </button>

                  {secondaryCtaText && (
                    <button
                      type="button"
                      onClick={() => handleCtaClick(secondaryCtaUrl)}
                      className="inline-flex items-center justify-center px-5 sm:px-7 py-2.5 sm:py-3 rounded-full text-xs sm:text-sm font-bold text-white bg-white/10 hover:bg-white/20 active:scale-95 border border-white/20 backdrop-blur-sm transition-all duration-200 cursor-pointer"
                    >
                      <span>{secondaryCtaText}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Right Column: Side Product Visual (Only rendered when an image is provided) */}
              {hasHeroImage && (
                <div className="md:col-span-5 lg:col-span-5 flex items-center justify-center md:justify-end px-2">
                  <div className="relative w-full max-w-[380px] sm:max-w-[440px] lg:max-w-[480px] flex items-center justify-center md:justify-end min-h-[160px] sm:min-h-[220px]">
                    <img
                      src={getOptimizedImageUrl(heroImage, { width: 800 })}
                      srcSet={!heroImage.startsWith('data:') ? generateSrcSet(heroImage, [320, 480, 640, 800, 1080]) : undefined}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 480px"
                      alt={title}
                      width={480}
                      height={260}
                      loading={currentSlideIndex === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      // @ts-ignore fetchpriority attribute
                      fetchpriority={currentSlideIndex === 0 ? 'high' : 'auto'}
                      referrerPolicy="no-referrer"
                      className="w-full h-auto max-h-[190px] sm:max-h-[230px] lg:max-h-[260px] object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.85)] transition-transform duration-500 hover:scale-105"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Carousel Slider Arrows (Left/Right) */}
        {activeSlides.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous Slide"
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center bg-black/50 hover:bg-black/80 text-white border border-white/10 transition-all shadow-lg focus:outline-none cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Next Slide"
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center bg-black/50 hover:bg-black/80 text-white border border-white/10 transition-all shadow-lg focus:outline-none cursor-pointer"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Bottom Slider Pagination Dots with Golden Yellow Active Indicator */}
            <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-xs border border-white/10">
              {activeSlides.map((slide, idx) => (
                <button
                  key={slide.id || idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                  className={`transition-all duration-300 rounded-full cursor-pointer focus:outline-none ${
                    currentIndex === idx
                      ? 'w-4 h-2 bg-[#fed700]'
                      : 'w-2 h-2 bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}

              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                title={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
                aria-label={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
                className="ml-1 p-0.5 rounded text-white/60 hover:text-white transition-colors"
              >
                {isPlaying ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
