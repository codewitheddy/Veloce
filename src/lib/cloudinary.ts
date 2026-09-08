/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CloudinaryUploadOptions {
  folder?: string;
  tags?: string[];
  publicId?: string;
  onProgress?: (progress: number) => void;
}

export interface CloudinaryUploadResult {
  success: boolean;
  url: string;
  secureUrl: string;
  publicId?: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
  isCloudinary: boolean;
  error?: string;
}

export interface CloudinaryOptimizationOptions {
  width?: number;
  height?: number;
  quality?: 'auto' | 'auto:good' | 'auto:best' | 'auto:eco' | number;
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  crop?: 'limit' | 'fill' | 'fit' | 'thumb' | 'scale';
  gravity?: 'auto' | 'center' | 'face';
}

/**
 * Check if a URL is hosted on Cloudinary
 */
export function isCloudinaryUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes('cloudinary.com') || url.includes('res.cloudinary.com');
}

/**
 * Generates an optimized Cloudinary delivery URL with automatic format and quality compression.
 */
export function getOptimizedCloudinaryUrl(
  url: string,
  options: CloudinaryOptimizationOptions = {}
): string {
  if (!url || typeof url !== 'string') return url;

  // If Unsplash, use Unsplash params
  if (url.includes('images.unsplash.com')) {
    const cleanUrl = url.split('?')[0];
    const width = options.width || 800;
    return `${cleanUrl}?auto=format&fit=crop&w=${width}&q=80`;
  }

  // Only apply Cloudinary transformation string if it is a Cloudinary URL
  if (!isCloudinaryUrl(url)) {
    return url;
  }

  const {
    width,
    height,
    quality = 'auto',
    format = 'auto',
    crop = 'limit',
    gravity,
  } = options;

  const transforms: string[] = [];
  if (format) transforms.push(`f_${format}`);
  if (quality) transforms.push(`q_${quality}`);
  if (crop) transforms.push(`c_${crop}`);
  if (width) transforms.push(`w_${width}`);
  if (height) transforms.push(`h_${height}`);
  if (gravity) transforms.push(`g_${gravity}`);

  const transformString = transforms.join(',');

  // Insert transformations after '/image/upload/'
  if (url.includes('/image/upload/')) {
    // Avoid double-inserting transformations if already present
    if (url.match(/\/image\/upload\/(f_auto|w_|q_|c_)/)) {
      return url;
    }
    return url.replace('/image/upload/', `/image/upload/${transformString}/`);
  }

  return url;
}

/**
 * Queries server endpoint to check if Cloudinary is configured
 */
export async function checkCloudinaryStatus(): Promise<{
  configured: boolean;
  cloudName?: string;
  source: 'backend' | 'client_preset' | 'none';
  message: string;
}> {
  try {
    const res = await fetch('/api/upload/cloudinary/status');
    if (res.ok) {
      const data = await res.json();
      if (data.configured) {
        return {
          configured: true,
          cloudName: data.cloudName,
          source: 'backend',
          message: data.message || `Cloudinary active (Cloud: ${data.cloudName})`,
        };
      }
    }
  } catch {
    // Fallback to client check
  }

  const clientCloudName =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) ||
    localStorage.getItem('veloce_cloudinary_cloud_name') ||
    '';
  const clientPreset =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET) ||
    localStorage.getItem('veloce_cloudinary_upload_preset') ||
    '';

  if (clientCloudName && clientPreset) {
    return {
      configured: true,
      cloudName: clientCloudName,
      source: 'client_preset',
      message: `Client upload preset active (${clientCloudName})`,
    };
  }

  return {
    configured: false,
    source: 'none',
    message: 'Cloudinary not configured. Using high-efficiency local compression fallback.',
  };
}

/**
 * Upload an image (File or base64 data URL) to Cloudinary.
 * Automatically tries backend signed API first, then client preset, then falls back to local data URL.
 */
export async function uploadImageToCloudinary(
  fileOrBase64: File | string,
  options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult> {
  const folder = options.folder || 'veloce_products';

  // 1. Try Backend Upload API (/api/upload/cloudinary)
  try {
    let base64Payload = '';
    let fileName = 'upload.jpg';

    if (typeof fileOrBase64 === 'string') {
      base64Payload = fileOrBase64;
    } else {
      fileName = fileOrBase64.name;
      base64Payload = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(fileOrBase64);
      });
    }

    const response = await fetch('/api/upload/cloudinary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64Payload,
        folder,
        fileName,
        tags: options.tags || ['veloce', 'ecommerce'],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && (data.secure_url || data.url)) {
        const optimizedUrl = getOptimizedCloudinaryUrl(data.secure_url || data.url);
        return {
          success: true,
          url: optimizedUrl,
          secureUrl: optimizedUrl,
          publicId: data.public_id,
          format: data.format,
          width: data.width,
          height: data.height,
          bytes: data.bytes,
          isCloudinary: true,
        };
      }
    }
  } catch (err: any) {
    console.warn('[Cloudinary Backend Upload Warning]:', err.message);
  }

  // 2. Try Direct Unsigned Client Upload Preset if configured
  const clientCloudName =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) ||
    localStorage.getItem('veloce_cloudinary_cloud_name') ||
    '';
  const clientPreset =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET) ||
    localStorage.getItem('veloce_cloudinary_upload_preset') ||
    '';

  if (clientCloudName && clientPreset) {
    try {
      const formData = new FormData();
      if (typeof fileOrBase64 === 'string') {
        formData.append('file', fileOrBase64);
      } else {
        formData.append('file', fileOrBase64);
      }
      formData.append('upload_preset', clientPreset);
      formData.append('folder', folder);

      const clientRes = await fetch(
        `https://api.cloudinary.com/v1_1/${clientCloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (clientRes.ok) {
        const data = await clientRes.json();
        const optimizedUrl = getOptimizedCloudinaryUrl(data.secure_url || data.url);
        return {
          success: true,
          url: optimizedUrl,
          secureUrl: optimizedUrl,
          publicId: data.public_id,
          format: data.format,
          width: data.width,
          height: data.height,
          bytes: data.bytes,
          isCloudinary: true,
        };
      }
    } catch (clientErr: any) {
      console.warn('[Cloudinary Client Upload Warning]:', clientErr.message);
    }
  }

  // 3. Graceful Local Fallback: return data URL
  let fallbackDataUrl = '';
  if (typeof fileOrBase64 === 'string') {
    fallbackDataUrl = fileOrBase64;
  } else {
    fallbackDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(fileOrBase64);
    });
  }

  return {
    success: true,
    url: fallbackDataUrl,
    secureUrl: fallbackDataUrl,
    isCloudinary: false,
  };
}
