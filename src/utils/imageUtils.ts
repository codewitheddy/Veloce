/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * High-Performance Image Optimization Utilities
 * Generates responsive srcset, format-negotiated WebP/AVIF URLs, and optimized thumbnails.
 */

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number | 'auto';
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  crop?: 'fill' | 'fit' | 'limit' | 'thumb' | 'scale';
}

/**
 * Transforms an image URL to deliver optimized format, dimensions, and compression.
 * Works seamlessly with Cloudinary, Unsplash, and local static assets.
 */
export function getOptimizedImageUrl(
  url: string,
  options: ImageOptimizationOptions = {}
): string {
  if (!url || typeof url !== 'string') return '/placeholder-product.png';

  const { width = 600, height, quality = 80, format = 'auto', crop = 'limit' } = options;

  // 1. Unsplash Images
  if (url.includes('images.unsplash.com')) {
    const cleanUrl = url.split('?')[0];
    let params = `auto=format&fit=crop&w=${width}&q=${quality}`;
    if (height) {
      params += `&h=${height}`;
    }
    return `${cleanUrl}?${params}`;
  }

  // 2. Cloudinary Images
  if (url.includes('cloudinary.com') || url.includes('res.cloudinary.com')) {
    if (url.match(/\/image\/upload\/(f_auto|w_|q_|c_)/)) {
      return url;
    }
    const transforms = [`f_${format}`, `q_${quality === 80 ? 'auto' : quality}`, `w_${width}`];
    if (height) transforms.push(`h_${height}`);
    if (crop) transforms.push(`c_${crop}`);

    const transformStr = transforms.join(',');
    if (url.includes('/image/upload/')) {
      return url.replace('/image/upload/', `/image/upload/${transformStr}/`);
    }
    return url;
  }

  // 3. Local static assets (.png / .jpg -> .webp if standard asset)
  if (url.startsWith('/images/delivery-hero.jpg')) {
    return '/images/delivery-hero.webp';
  }
  if (url.startsWith('/logo.png')) {
    return '/logo.webp';
  }
  if (url.startsWith('/ropenix_logo.png')) {
    return '/ropenix_logo.webp';
  }

  return url;
}

/**
 * Generates standard responsive srcset string for phone, tablet, and desktop display.
 */
export function generateSrcSet(
  url: string,
  widths: number[] = [280, 420, 600, 800, 1080]
): string {
  if (!url || typeof url !== 'string' || url.startsWith('data:')) return '';

  return widths
    .map((w) => `${getOptimizedImageUrl(url, { width: w })} ${w}w`)
    .join(', ');
}

/**
 * Returns standard responsive sizes attribute for various UI surfaces.
 */
export function getResponsiveSizes(
  type: 'grid_card' | 'hero' | 'thumbnail' | 'detail' | 'carousel' = 'grid_card'
): string {
  switch (type) {
    case 'hero':
      return '(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1200px';
    case 'thumbnail':
      return '(max-width: 640px) 48px, 64px';
    case 'detail':
      return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 600px';
    case 'carousel':
      return '(max-width: 640px) 240px, (max-width: 1024px) 280px, 320px';
    case 'grid_card':
    default:
      return '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px';
  }
}
