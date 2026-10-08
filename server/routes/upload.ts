/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/cloudinary/status', (_req: Request, res: Response) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || '';
  const apiKey = process.env.CLOUDINARY_API_KEY || '';
  const apiSecret = process.env.CLOUDINARY_API_SECRET || '';
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || process.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';

  const isConfigured = Boolean(cloudName && apiKey && apiSecret);

  res.json({
    configured: isConfigured,
    cloudName: cloudName ? `${cloudName.slice(0, 3)}***` : undefined,
    fullCloudName: cloudName || undefined,
    hasApiKey: Boolean(apiKey),
    hasApiSecret: Boolean(apiSecret),
    uploadPreset: uploadPreset || undefined,
    source: isConfigured ? 'backend' : uploadPreset ? 'client_preset' : 'none',
    message: isConfigured
      ? `Cloudinary signed upload active for cloud: ${cloudName}`
      : 'Cloudinary credentials not configured in environment. Using graceful local canvas compression fallback.',
  });
});

router.post('/cloudinary', requireAdmin, async (req: Request, res: Response) => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || '';
    const apiKey = process.env.CLOUDINARY_API_KEY || '';
    const apiSecret = process.env.CLOUDINARY_API_SECRET || '';

    const { image, file, folder = 'ropenix_products', tags, publicId, public_id } = req.body || {};
    const filePayload = image || file;

    if (!filePayload) {
      return res.status(400).json({ success: false, error: 'Image payload (base64 or URL) is required.' });
    }

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(200).json({
        success: false,
        configured: false,
        fallback: true,
        error: 'Cloudinary credentials not configured in environment.',
      });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const targetFolder = String(folder || 'ropenix_products').trim();
    const pid = publicId || public_id;

    const paramsToSign: Record<string, string> = {
      folder: targetFolder,
      timestamp: String(timestamp),
    };

    if (pid) {
      paramsToSign.public_id = String(pid).trim();
    }

    if (tags) {
      const tagsStr = Array.isArray(tags) ? tags.join(',') : String(tags);
      paramsToSign.tags = tagsStr.trim();
    }

    const sortedKeys = Object.keys(paramsToSign).sort();
    const toSign = sortedKeys.map((k) => `${k}=${paramsToSign[k]}`).join('&') + apiSecret;
    const signature = crypto.createHash('sha1').update(toSign).digest('hex');

    const uploadPayload: Record<string, any> = {
      file: filePayload,
      api_key: apiKey,
      timestamp,
      signature,
      folder: targetFolder,
    };

    if (pid) {
      uploadPayload.public_id = pid;
    }
    if (paramsToSign.tags) {
      uploadPayload.tags = paramsToSign.tags;
    }

    const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(uploadPayload),
    });

    const data = await cloudinaryRes.json();

    if (!cloudinaryRes.ok || data.error) {
      console.error('[Cloudinary API Error]:', data.error || data);
      return res.status(cloudinaryRes.status >= 400 ? cloudinaryRes.status : 500).json({
        success: false,
        error: data.error?.message || 'Failed to upload image to Cloudinary',
        detail: data,
      });
    }

    return res.json({
      success: true,
      url: data.secure_url || data.url,
      secure_url: data.secure_url,
      public_id: data.public_id,
      format: data.format,
      width: data.width,
      height: data.height,
      bytes: data.bytes,
      created_at: data.created_at,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error during upload';
    console.error('[Cloudinary Server Error]:', err);
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
