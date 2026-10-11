/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Image Storage & Optimization Service
 * Offloads base64 image data URIs to local disk in public/uploads/ as optimized WebP files
 * and ensures database records store lightweight static URLs rather than multi-megabyte payloads.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

let sharp: any = null;
try {
  sharp = require('sharp');
} catch (_) {
  console.warn('[Image Storage] sharp not available, using raw buffer write.');
}

const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads');

export function ensureUploadsDir(): string {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  return UPLOADS_DIR;
}

/**
 * Saves a base64 data URI to a static WebP / image file on disk in public/uploads/
 * Returns the web-accessible URL (e.g. /uploads/prod_1728..._abcd.webp).
 * If the input is already a URL or empty, returns it unchanged.
 */
export async function saveBase64ImageToDisk(input: string, prefix = 'prod'): Promise<string> {
  if (!input || typeof input !== 'string') return input;
  const trimmed = input.trim();
  if (!trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  ensureUploadsDir();

  try {
    const match = trimmed.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/s);
    if (!match) {
      return trimmed;
    }

    const mimeSubtype = match[1].toLowerCase();
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const randomHex = crypto.randomBytes(4).toString('hex');

    if (sharp && mimeSubtype !== 'svg+xml') {
      const filename = `${prefix}_${Date.now()}_${randomHex}.webp`;
      const filePath = path.join(UPLOADS_DIR, filename);
      await sharp(buffer)
        .rotate()
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toFile(filePath);
      return `/uploads/${filename}`;
    }

    let ext = 'png';
    if (mimeSubtype.includes('jpeg') || mimeSubtype.includes('jpg')) ext = 'jpg';
    else if (mimeSubtype.includes('webp')) ext = 'webp';
    else if (mimeSubtype.includes('gif')) ext = 'gif';
    else if (mimeSubtype.includes('svg')) ext = 'svg';

    const filename = `${prefix}_${Date.now()}_${randomHex}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    await fs.promises.writeFile(filePath, buffer);
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('[Image Storage] Error offloading base64 image to disk:', err);
    return trimmed;
  }
}

/**
 * Sanitizes all image fields in a product object to ensure any base64 data URIs
 * are converted into disk files with lightweight `/uploads/...` URLs.
 */
export async function sanitizeProductImageFields(product: any): Promise<any> {
  if (!product || typeof product !== 'object') return product;

  // 1. Primary image URL
  if (product.imageUrl && typeof product.imageUrl === 'string' && product.imageUrl.startsWith('data:image/')) {
    product.imageUrl = await saveBase64ImageToDisk(product.imageUrl, 'prod');
  }
  if (product.image_url && typeof product.image_url === 'string' && product.image_url.startsWith('data:image/')) {
    product.image_url = product.imageUrl && !product.imageUrl.startsWith('data:image/')
      ? product.imageUrl
      : await saveBase64ImageToDisk(product.image_url, 'prod');
  }
  if (!product.imageUrl && product.image_url) {
    product.imageUrl = product.image_url;
  }
  if (!product.image_url && product.imageUrl) {
    product.image_url = product.imageUrl;
  }

  // 2. Images gallery array
  if (Array.isArray(product.images)) {
    product.images = await Promise.all(
      product.images.map(async (img: any) => {
        if (typeof img === 'string' && img.startsWith('data:image/')) {
          return await saveBase64ImageToDisk(img, 'prod');
        }
        return img;
      })
    );
  }
  if (Array.isArray(product.gallery_images)) {
    product.gallery_images = product.images;
  }

  // 3. Color Images dictionary
  const colorImgs = product.colorImages || product.color_images;
  if (colorImgs && typeof colorImgs === 'object' && !Array.isArray(colorImgs)) {
    const updatedColorImgs: Record<string, string> = {};
    for (const [key, val] of Object.entries(colorImgs)) {
      if (typeof val === 'string' && val.startsWith('data:image/')) {
        updatedColorImgs[key] = await saveBase64ImageToDisk(val, 'color');
      } else {
        updatedColorImgs[key] = String(val);
      }
    }
    product.colorImages = updatedColorImgs;
    product.color_images = updatedColorImgs;
  }

  // 4. Variant matrix images
  const matrix = product.variants || product.variantMatrix || product.variant_matrix;
  if (Array.isArray(matrix)) {
    for (const v of matrix) {
      if (v && typeof v === 'object') {
        if (typeof v.image === 'string' && v.image.startsWith('data:image/')) {
          v.image = await saveBase64ImageToDisk(v.image, 'var');
        }
        if (typeof v.imageUrl === 'string' && v.imageUrl.startsWith('data:image/')) {
          v.imageUrl = await saveBase64ImageToDisk(v.imageUrl, 'var');
        }
      }
    }
  }

  return product;
}
