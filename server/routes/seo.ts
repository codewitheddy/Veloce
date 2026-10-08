/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { loadProductsCache } from './products';

const router = Router();

router.get('/robots.txt', (_req: Request, res: Response) => {
  const robotsTxt = `# Robots.txt for Ropenix Collections
# https://ropenix.co.ke

User-agent: *
Allow: /
Allow: /store
Allow: /services
Allow: /blog
Allow: /contact
Allow: /privacy
Allow: /track
Allow: /favicon.svg
Allow: /og-image.svg
Allow: /site.webmanifest

Disallow: /admin
Disallow: /admin/
Disallow: /checkout
Disallow: /api/admin/
Disallow: /api/orders/
Disallow: /api/payment/
Disallow: /unsubscribe

Crawl-delay: 1
Sitemap: https://ropenix.co.ke/sitemap.xml
`;
  res.header('Content-Type', 'text/plain; charset=utf-8');
  res.header('Cache-Control', 'public, max-age=86400');
  res.send(robotsTxt);
});

router.get('/sitemap.xml', async (req: Request, res: Response) => {
  try {
    const host = req.get('host') || 'ropenix.co.ke';
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'https';
    const baseUrl = `${protocol}://${host.includes('localhost') || host.includes('127.0.0.1') ? 'ropenix.co.ke' : host}`;
    const now = new Date().toISOString();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/store</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/track</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
  </url>
  <url>
    <loc>${baseUrl}/services</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/blog</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/contact</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/privacy</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
`;

    const products = await loadProductsCache();
    if (Array.isArray(products) && products.length > 0) {
      const activeProducts = products.filter((p: any) => p.status !== 'Draft' && !p.isHidden && !p.isArchived);
      for (const prod of activeProducts) {
        const prodId = prod.id || prod.sku;
        const prodDate = prod.updatedAt || prod.createdAt || now;
        const prodTitle = (prod.title || prod.name || '').replace(/[<>&'"]/g, (c: string) => {
          switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case "'": return '&apos;';
            case '"': return '&quot;';
            default: return c;
          }
        });
        const prodImg = prod.image || (prod.galleryImages && prod.galleryImages[0]);

        xml += `  <url>
    <loc>${baseUrl}/store?product=${encodeURIComponent(prodId)}</loc>
    <lastmod>${prodDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>`;
        if (prodImg && typeof prodImg === 'string' && prodImg.startsWith('http')) {
          xml += `
    <image:image>
      <image:loc>${prodImg.replace(/&/g, '&amp;')}</image:loc>
      <image:title>${prodTitle}</image:title>
    </image:image>`;
        }
        xml += `
  </url>\n`;
      }

      const uniqueCategories = Array.from(new Set(activeProducts.map((p: any) => p.category).filter(Boolean)));
      for (const cat of uniqueCategories) {
        xml += `  <url>
    <loc>${baseUrl}/store?category=${encodeURIComponent(cat as string)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.75</priority>
  </url>\n`;
      }
    }

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml; charset=utf-8');
    res.header('Cache-Control', 'public, max-age=3600, s-maxage=7200');
    res.send(xml);
  } catch (err: unknown) {
    res.status(500).type('text/plain').send('Error generating sitemap');
  }
});

export default router;
