/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Dynamic Product Catalog Feeds
 * Supports Meta (Facebook & Instagram Shopping / Advantage+ Catalog Ads)
 * and Google Merchant Center (RSS 2.0 / XML, CSV, and TSV formats).
 */

import { Router, Request, Response } from 'express';
import { loadProductsCache } from './products';

const router = Router();

/**
 * Helper to determine current server protocol and host
 */
function getBaseUrl(req: Request): string {
  const host = req.get('host') || 'ropenix.co.ke';
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : (host.includes('localhost') ? 'http' : 'https');
  const cleanHost = host.includes('localhost') || host.includes('127.0.0.1') ? host : 'ropenix.co.ke';
  return `${protocol}://${cleanHost}`;
}

/**
 * Strip HTML tags and normalize whitespace for description fields
 */
function cleanDescription(rawDesc: string | undefined): string {
  if (!rawDesc || typeof rawDesc !== 'string') {
    return 'Exclusive handcrafted fashion, luxury timepieces and bespoke apparel from Ropenix Collections.';
  }
  const clean = rawDesc
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return clean.substring(0, 5000);
}

/**
 * Resolve absolute URL for product image
 */
function resolveImageUrl(imgUrl: string | undefined, baseUrl: string): string {
  if (!imgUrl || typeof imgUrl !== 'string') {
    return `${baseUrl}/og-image.svg`;
  }
  if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
    return imgUrl;
  }
  const normalized = imgUrl.startsWith('/') ? imgUrl : `/${imgUrl}`;
  return `${baseUrl}${normalized}`;
}

/**
 * Escape CSV cell value according to RFC 4180
 */
function csvEscape(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * XML CDATA or safe text wrapper
 */
function cdata(val: string): string {
  const clean = (val || '').replace(/]]>/g, ']]&gt;');
  return `<![CDATA[${clean}]]>`;
}

/**
 * Normalize product list for catalog export
 */
async function getExportProducts(): Promise<any[]> {
  const allProducts = await loadProductsCache();
  if (!Array.isArray(allProducts)) return [];
  return allProducts.filter((p: any) => {
    // Only export active, non-archived, non-hidden storefront products
    return (
      p.status !== 'Draft' &&
      p.status !== 'Archived' &&
      !p.isHidden &&
      !p.isArchived
    );
  });
}

// ==============================================================================
// 1. Meta / Facebook Catalog XML Feed (RSS 2.0 with Google Base standard)
// Endpoint: /feeds/meta.xml, /feeds/facebook.xml, /feeds/catalog.xml
// ==============================================================================
router.get(['/meta.xml', '/facebook.xml', '/catalog.xml', '/products.xml'], async (req: Request, res: Response) => {
  try {
    const baseUrl = getBaseUrl(req);
    const products = await getExportProducts();
    const currency = 'KES';

    let itemsXml = '';

    for (const prod of products) {
      const prodId = prod.id || prod.sku;
      const title = prod.name || prod.title || 'Untitled Product';
      const desc = cleanDescription(prod.description || prod.shortDescription || prod.detailedDescription);
      const link = `${baseUrl}/store?product=${encodeURIComponent(prodId)}`;
      
      const primaryImg = resolveImageUrl(prod.imageUrl || (prod.images && prod.images[0]) || prod.image, baseUrl);
      
      const gallery = (Array.isArray(prod.images) ? prod.images : [])
        .filter((img: string) => img && img !== prod.imageUrl && img !== prod.image)
        .slice(0, 10);
      
      let additionalImagesXml = '';
      for (const gImg of gallery) {
        additionalImagesXml += `\n      <g:additional_image_link>${resolveImageUrl(gImg, baseUrl)}</g:additional_image_link>`;
      }

      const isAvailable = (prod.stock > 0 || (prod.stockQty && prod.stockQty > 0)) && prod.status === 'Active';
      const availability = isAvailable ? 'in stock' : 'out of stock';
      const condition = 'new';
      const brand = prod.brand || 'Ropenix Collections';
      const productType = [prod.category, prod.subcategory].filter(Boolean).join(' > ') || 'Fashion & Accessories';

      const numericPrice = Number(prod.price) || 0;
      const numericOrig = Number(prod.originalPrice || prod.previousPrice || 0);

      let priceStr = `${numericPrice.toFixed(2)} ${currency}`;
      let salePriceStr = '';

      if (numericOrig > numericPrice) {
        priceStr = `${numericOrig.toFixed(2)} ${currency}`;
        salePriceStr = `\n      <g:sale_price>${numericPrice.toFixed(2)} ${currency}</g:sale_price>`;
      }

      itemsXml += `
    <item>
      <g:id>${cdata(String(prodId))}</g:id>
      <g:title>${cdata(title)}</g:title>
      <g:description>${cdata(desc)}</g:description>
      <g:link>${link}</g:link>
      <g:image_link>${primaryImg}</g:image_link>${additionalImagesXml}
      <g:brand>${cdata(brand)}</g:brand>
      <g:condition>${condition}</g:condition>
      <g:availability>${availability}</g:availability>
      <g:price>${priceStr}</g:price>${salePriceStr}
      <g:product_type>${cdata(productType)}</g:product_type>
      <g:item_group_id>${cdata(String(prodId))}</g:item_group_id>
    </item>`;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Ropenix Collections | Meta Product Catalog Feed</title>
    <link>${baseUrl}</link>
    <description>Dynamic real-time product feed for Meta Commerce Manager, Facebook Shop, Instagram Shopping and Google Merchant Center.</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${itemsXml}
  </channel>
</rss>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.send(xml);
  } catch (err) {
    console.error('[Feeds API] Error generating Meta XML feed:', err);
    res.status(500).send('Error generating XML feed.');
  }
});

// ==============================================================================
// 2. Meta / Facebook Catalog CSV Feed (Standard Column Headers)
// Endpoint: /feeds/meta.csv, /feeds/facebook.csv, /feeds/products.csv
// ==============================================================================
router.get(['/meta.csv', '/facebook.csv', '/catalog.csv', '/products.csv'], async (req: Request, res: Response) => {
  try {
    const baseUrl = getBaseUrl(req);
    const products = await getExportProducts();
    const currency = 'KES';

    const headers = [
      'id',
      'title',
      'description',
      'availability',
      'condition',
      'price',
      'sale_price',
      'link',
      'image_link',
      'additional_image_link',
      'brand',
      'product_type',
      'item_group_id'
    ];

    const rows: string[] = [headers.join(',')];

    for (const prod of products) {
      const prodId = prod.id || prod.sku;
      const title = prod.name || prod.title || 'Untitled Product';
      const desc = cleanDescription(prod.description || prod.shortDescription || prod.detailedDescription);
      const link = `${baseUrl}/store?product=${encodeURIComponent(prodId)}`;
      const primaryImg = resolveImageUrl(prod.imageUrl || (prod.images && prod.images[0]) || prod.image, baseUrl);
      
      const gallery = (Array.isArray(prod.images) ? prod.images : [])
        .filter((img: string) => img && img !== prod.imageUrl && img !== prod.image)
        .slice(0, 10)
        .map((img: string) => resolveImageUrl(img, baseUrl))
        .join(',');

      const isAvailable = (prod.stock > 0 || (prod.stockQty && prod.stockQty > 0)) && prod.status === 'Active';
      const availability = isAvailable ? 'in stock' : 'out of stock';
      const condition = 'new';
      const brand = prod.brand || 'Ropenix Collections';
      const productType = [prod.category, prod.subcategory].filter(Boolean).join(' > ') || 'Fashion & Accessories';

      const numericPrice = Number(prod.price) || 0;
      const numericOrig = Number(prod.originalPrice || prod.previousPrice || 0);

      let priceStr = `${numericPrice.toFixed(2)} ${currency}`;
      let salePriceStr = '';

      if (numericOrig > numericPrice) {
        priceStr = `${numericOrig.toFixed(2)} ${currency}`;
        salePriceStr = `${numericPrice.toFixed(2)} ${currency}`;
      }

      const rowValues = [
        csvEscape(prodId),
        csvEscape(title),
        csvEscape(desc),
        csvEscape(availability),
        csvEscape(condition),
        csvEscape(priceStr),
        csvEscape(salePriceStr),
        csvEscape(link),
        csvEscape(primaryImg),
        csvEscape(gallery),
        csvEscape(brand),
        csvEscape(productType),
        csvEscape(prodId)
      ];

      rows.push(rowValues.join(','));
    }

    const csvContent = rows.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="meta-product-catalog.csv"');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.send(csvContent);
  } catch (err) {
    console.error('[Feeds API] Error generating Meta CSV feed:', err);
    res.status(500).send('Error generating CSV feed.');
  }
});

// ==============================================================================
// 3. Meta / Facebook Catalog TSV Feed (Tab-Separated Values)
// Endpoint: /feeds/meta.tsv, /feeds/facebook.tsv
// ==============================================================================
router.get(['/meta.tsv', '/facebook.tsv'], async (req: Request, res: Response) => {
  try {
    const baseUrl = getBaseUrl(req);
    const products = await getExportProducts();
    const currency = 'KES';

    const headers = [
      'id',
      'title',
      'description',
      'availability',
      'condition',
      'price',
      'sale_price',
      'link',
      'image_link',
      'brand',
      'product_type'
    ];

    const rows: string[] = [headers.join('\t')];

    for (const prod of products) {
      const prodId = prod.id || prod.sku;
      const title = (prod.name || prod.title || 'Untitled Product').replace(/[\t\r\n]+/g, ' ');
      const desc = cleanDescription(prod.description || prod.shortDescription).replace(/[\t\r\n]+/g, ' ');
      const link = `${baseUrl}/store?product=${encodeURIComponent(prodId)}`;
      const primaryImg = resolveImageUrl(prod.imageUrl || (prod.images && prod.images[0]) || prod.image, baseUrl);
      
      const isAvailable = (prod.stock > 0 || (prod.stockQty && prod.stockQty > 0)) && prod.status === 'Active';
      const availability = isAvailable ? 'in stock' : 'out of stock';
      const condition = 'new';
      const brand = (prod.brand || 'Ropenix Collections').replace(/[\t\r\n]+/g, ' ');
      const productType = ([prod.category, prod.subcategory].filter(Boolean).join(' > ') || 'Fashion & Accessories').replace(/[\t\r\n]+/g, ' ');

      const numericPrice = Number(prod.price) || 0;
      const numericOrig = Number(prod.originalPrice || prod.previousPrice || 0);

      let priceStr = `${numericPrice.toFixed(2)} ${currency}`;
      let salePriceStr = '';

      if (numericOrig > numericPrice) {
        priceStr = `${numericOrig.toFixed(2)} ${currency}`;
        salePriceStr = `${numericPrice.toFixed(2)} ${currency}`;
      }

      rows.push([
        prodId,
        title,
        desc,
        availability,
        condition,
        priceStr,
        salePriceStr,
        link,
        primaryImg,
        brand,
        productType
      ].join('\t'));
    }

    res.setHeader('Content-Type', 'text/tab-separated-values; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="meta-product-catalog.tsv"');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.send(rows.join('\r\n'));
  } catch (err) {
    console.error('[Feeds API] Error generating Meta TSV feed:', err);
    res.status(500).send('Error generating TSV feed.');
  }
});

// ==============================================================================
// 4. Feeds Directory / Diagnostic Overview
// Endpoint: /feeds, /api/feeds
// ==============================================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const baseUrl = getBaseUrl(req);
    const products = await getExportProducts();

    if (req.headers.accept?.includes('text/html')) {
      return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ropenix Collections - Meta & Google Catalog Feeds</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; display: flex; justify-content: center; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; max-width: 720px; width: 100%; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); }
    h1 { margin-top: 0; color: #38bdf8; font-size: 24px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
    .badge { display: inline-block; background: #059669; color: white; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }
    .feed-item { background: #0b1329; border: 1px solid #1e293b; border-radius: 10px; padding: 16px; margin: 14px 0; }
    .feed-title { font-weight: 600; color: #f1f5f9; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .feed-url { font-family: monospace; background: #1e293b; padding: 8px 12px; border-radius: 6px; color: #38bdf8; word-break: break-all; font-size: 13px; }
    a.btn { display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; }
    a.btn:hover { background: #2563eb; }
    .steps { margin-top: 24px; padding-top: 20px; border-top: 1px solid #334155; }
    .steps ol { padding-left: 20px; color: #cbd5e1; font-size: 13px; line-height: 1.8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">● Live & Synced (${products.length} Products Active)</div>
    <h1>Meta & Google Product Catalog Data Feeds</h1>
    <p>Use these dynamic URLs in Meta Commerce Manager (Facebook & Instagram Shopping) and Google Merchant Center. They update automatically whenever products or prices change.</p>

    <div class="feed-item">
      <div class="feed-title">
        <span>Meta / Google XML Feed (Recommended)</span>
        <a class="btn" href="${baseUrl}/feeds/meta.xml" target="_blank">Open XML</a>
      </div>
      <div class="feed-url">${baseUrl}/feeds/meta.xml</div>
    </div>

    <div class="feed-item">
      <div class="feed-title">
        <span>Meta CSV Catalog Feed</span>
        <a class="btn" href="${baseUrl}/feeds/meta.csv" target="_blank">Download CSV</a>
      </div>
      <div class="feed-url">${baseUrl}/feeds/meta.csv</div>
    </div>

    <div class="feed-item">
      <div class="feed-title">
        <span>Meta TSV Catalog Feed</span>
        <a class="btn" href="${baseUrl}/feeds/meta.tsv" target="_blank">Download TSV</a>
      </div>
      <div class="feed-url">${baseUrl}/feeds/meta.tsv</div>
    </div>

    <div class="steps">
      <strong style="color: #f1f5f9;">How to Add to Meta Commerce Manager:</strong>
      <ol>
        <li>Open <strong>Meta Commerce Manager</strong> and select your Catalog.</li>
        <li>Navigate to <strong>Catalog</strong> &rarr; <strong>Data Sources</strong> &rarr; <strong>Add Items</strong>.</li>
        <li>Select <strong>Data Feed</strong> &rarr; <strong>Use a URL</strong>.</li>
        <li>Paste the XML link: <code>${baseUrl}/feeds/meta.xml</code></li>
        <li>Choose your automatic refresh schedule (e.g., <strong>Hourly</strong> or <strong>Daily</strong>).</li>
      </ol>
    </div>
  </div>
</body>
</html>`);
    }

    res.json({
      success: true,
      store: 'Ropenix Collections',
      activeProductCount: products.length,
      updatedAt: new Date().toISOString(),
      feeds: {
        metaXml: `${baseUrl}/feeds/meta.xml`,
        metaCsv: `${baseUrl}/feeds/meta.csv`,
        metaTsv: `${baseUrl}/feeds/meta.tsv`,
        facebookXml: `${baseUrl}/feeds/facebook.xml`,
        googleXml: `${baseUrl}/feeds/catalog.xml`
      },
      headers: [
        'id', 'title', 'description', 'availability', 'condition',
        'price', 'sale_price', 'link', 'image_link', 'additional_image_link',
        'brand', 'product_type', 'item_group_id'
      ]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not load feed directory' });
  }
});

export default router;
