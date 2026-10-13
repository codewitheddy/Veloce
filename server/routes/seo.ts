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
Allow: /favicon.ico
Allow: /favicon.svg
Allow: /og-image.svg
Allow: /site.webmanifest

Disallow: /admin
Disallow: /admin/
Disallow: /checkout
Disallow: /api/
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
        let prodDate = now;
        try {
          if (prod.updatedAt || prod.createdAt) {
            prodDate = new Date(prod.updatedAt || prod.createdAt).toISOString();
          }
        } catch (_) {}

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

// ============================================================================
// Server-Side Dynamic Meta & Canonical Pre-Rendering Engine
// Solves SPA crawling & Google Search Console "Crawled - currently not indexed"
// ============================================================================

export interface SeoMetadataResult {
  title: string;
  description: string;
  canonical: string;
  image: string;
  noindex?: boolean;
  schema?: Record<string, any>;
  notFound?: boolean;
}

function escapeAttr(str: string): string {
  return str.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return m;
    }
  });
}

export async function resolveSeoMetadata(req: Request): Promise<SeoMetadataResult> {
  const host = req.get('host') || 'ropenix.co.ke';
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'https';
  const baseUrl = `${protocol}://${host.includes('localhost') || host.includes('127.0.0.1') ? 'ropenix.co.ke' : host}`;
  const path = req.path.toLowerCase();
  const defaultImage = `${baseUrl}/og-image.svg`;

  // 1. Individual Product Page: /store?product=...
  if (req.query.product) {
    const prodParam = String(req.query.product).trim();
    const products = await loadProductsCache();
    const activeProducts = Array.isArray(products)
      ? products.filter((p: any) => p.status !== 'Draft' && !p.isHidden && !p.isArchived)
      : [];
    const product = activeProducts.find((p: any) =>
      String(p.id) === prodParam ||
      String(p.sku).toLowerCase() === prodParam.toLowerCase()
    );

    if (product) {
      const prodName = product.title || product.name || 'Curated Product';
      const cleanDesc = (product.description || product.shortDescription || '')
        .replace(/<[^>]*>?/gm, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160) || `Buy ${prodName} on Ropenix Collections. Luxury bespoke tailoring, premium physical products, and verified delivery across Kenya.`;
      const prodImg = product.image || (product.galleryImages && product.galleryImages[0]) || defaultImage;
      const canonicalUrl = `${baseUrl}/store?product=${encodeURIComponent(prodParam)}`;

      const productSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: prodName,
        image: [prodImg],
        description: cleanDesc,
        sku: product.sku || `ROP-${product.id}`,
        brand: {
          '@type': 'Brand',
          name: product.brand || 'Ropenix Collections'
        },
        offers: {
          '@type': 'Offer',
          url: canonicalUrl,
          priceCurrency: product.currency || 'KES',
          price: product.price || 0,
          priceValidUntil: '2028-12-31',
          itemCondition: 'https://schema.org/NewCondition',
          availability: (product.stock === null || product.stock > 0)
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          seller: {
            '@type': 'Organization',
            name: 'Ropenix Collections',
            url: baseUrl
          }
        }
      };

      return {
        title: `${prodName} | Ropenix Collections`,
        description: cleanDesc,
        canonical: canonicalUrl,
        image: prodImg,
        schema: productSchema
      };
    } else {
      return {
        title: 'Product Not Found | Ropenix Collections',
        description: 'The requested product is no longer available in the Ropenix Collections catalog.',
        canonical: `${baseUrl}/store`,
        image: defaultImage,
        notFound: true
      };
    }
  }

  // 2. Private or Checkout routes (Never index in Google)
  if (path.startsWith('/admin') || path.startsWith('/checkout') || path.startsWith('/login') || path.startsWith('/register')) {
    return {
      title: 'Portal | Ropenix Collections',
      description: 'Secure client portal and management services.',
      canonical: `${baseUrl}${path}`,
      image: defaultImage,
      noindex: true
    };
  }

  // 3. Category Filter: /store?category=...
  if (path === '/store' && req.query.category) {
    const cat = String(req.query.category).trim();
    return {
      title: `${cat} Collections | Ropenix Collections`,
      description: `Explore our curated selection of ${cat} on Ropenix Collections. Master craftsmanship and verified quality.`,
      canonical: `${baseUrl}/store?category=${encodeURIComponent(cat)}`,
      image: defaultImage
    };
  }

  // 4. Standard public routes
  switch (path) {
    case '/store':
      return {
        title: 'Store & Curated Luxury Collections | Ropenix Collections',
        description: 'Explore Ropenix Collections: bespoke tailoring, luxury apparel, physical tools, and high-utility digital assets in Kenya.',
        canonical: `${baseUrl}/store`,
        image: defaultImage
      };
    case '/services':
      return {
        title: 'Bespoke Tailoring & Artisan Services | Ropenix Collections',
        description: 'Experience bespoke tailoring, custom garment fabrication, precision measurement fittings, and master styling consultations.',
        canonical: `${baseUrl}/services`,
        image: defaultImage
      };
    case '/blog':
      return {
        title: 'Style Journal, Fashion Guides & Tailoring Insights | Ropenix Collections',
        description: 'Read sartorial insights, bespoke tailoring care guides, luxury styling advice, and modern African textile heritage.',
        canonical: `${baseUrl}/blog`,
        image: defaultImage
      };
    case '/track':
      return {
        title: 'Real-Time Order Tracking & Courier Transit | Ropenix Collections',
        description: 'Track your Ropenix luxury orders with live dispatch updates, courier checkpoints, and estimated delivery times.',
        canonical: `${baseUrl}/track`,
        image: defaultImage
      };
    case '/contact':
      return {
        title: 'Contact Us & VIP Customer Concierge | Ropenix Collections',
        description: 'Get in touch with Ropenix concierge for support, bespoke tailoring appointments, and merchant partnership inquiries.',
        canonical: `${baseUrl}/contact`,
        image: defaultImage
      };
    case '/privacy':
      return {
        title: 'Privacy Policy & Customer Security | Ropenix Collections',
        description: 'Learn how Ropenix Collections protects your personal data, transaction security, and customer privacy.',
        canonical: `${baseUrl}/privacy`,
        image: defaultImage
      };
    default:
      return {
        title: 'Ropenix Collections | Premium eCommerce & Affiliate Marketplace',
        description: "Explore Ropenix Collections, Kenya's unified luxury eCommerce and affiliate marketplace featuring bespoke tailoring, curated physical products, and verified merchant tracking.",
        canonical: `${baseUrl}/`,
        image: defaultImage
      };
  }
}

export async function renderHtmlWithSeo(rawHtml: string, req: Request): Promise<{ html: string; status: number }> {
  try {
    const meta = await resolveSeoMetadata(req);

    if (meta.notFound) {
      return {
        html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Product Not Found | Ropenix Collections</title>
  <meta name="robots" content="noindex, follow">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0b0f19; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #161e2e; border: 1px solid #2d3748; border-radius: 16px; padding: 40px; max-width: 480px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
    h1 { color: #f59e0b; font-size: 24px; margin-top: 0; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.6; }
    a { display: inline-block; margin-top: 20px; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    a:hover { background: #4338ca; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Item Not Found</h1>
    <p>The product or collection item you were searching for has moved, expired, or is currently unavailable.</p>
    <a href="/store">Explore Available Store Collections &rarr;</a>
  </div>
</body>
</html>`,
        status: 404
      };
    }

    let html = rawHtml;

    // 1. Update <title>
    html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeAttr(meta.title)}</title>`);

    // 2. Update <meta name="title" ...>
    if (html.includes('name="title"')) {
      html = html.replace(/(<meta\s+name=["']title["']\s+content=)[^>]*>/i, `<meta name="title" content="${escapeAttr(meta.title)}" />`);
    } else {
      html = html.replace(/<head>/i, `<head>\n  <meta name="title" content="${escapeAttr(meta.title)}" />`);
    }

    // 3. Update <meta name="description" ...>
    html = html.replace(/(<meta\s+name=["']description["']\s+content=)[^>]*>/i, `<meta name="description" content="${escapeAttr(meta.description)}" />`);

    // 4. Update canonical tag
    if (html.includes('rel="canonical"') || html.includes("rel='canonical'")) {
      html = html.replace(/(<link\s+[^>]*rel=["']canonical["'][^>]*>)/i, `<link rel="canonical" href="${escapeAttr(meta.canonical)}" />`);
    } else {
      html = html.replace(/<\/head>/i, `  <link rel="canonical" href="${escapeAttr(meta.canonical)}" />\n</head>`);
    }

    // 5. Update OpenGraph tags
    html = html.replace(/(<meta\s+property=["']og:title["']\s+content=)[^>]*>/i, `<meta property="og:title" content="${escapeAttr(meta.title)}" />`);
    html = html.replace(/(<meta\s+property=["']og:description["']\s+content=)[^>]*>/i, `<meta property="og:description" content="${escapeAttr(meta.description)}" />`);
    html = html.replace(/(<meta\s+property=["']og:url["']\s+content=)[^>]*>/i, `<meta property="og:url" content="${escapeAttr(meta.canonical)}" />`);
    html = html.replace(/(<meta\s+property=["']og:image["']\s+content=)[^>]*>/i, `<meta property="og:image" content="${escapeAttr(meta.image)}" />`);
    html = html.replace(/(<meta\s+property=["']og:image:secure_url["']\s+content=)[^>]*>/i, `<meta property="og:image:secure_url" content="${escapeAttr(meta.image)}" />`);

    // 6. Update Twitter Card tags
    html = html.replace(/(<meta\s+name=["']twitter:title["']\s+content=)[^>]*>/i, `<meta name="twitter:title" content="${escapeAttr(meta.title)}" />`);
    html = html.replace(/(<meta\s+name=["']twitter:description["']\s+content=)[^>]*>/i, `<meta name="twitter:description" content="${escapeAttr(meta.description)}" />`);
    html = html.replace(/(<meta\s+name=["']twitter:url["']\s+content=)[^>]*>/i, `<meta name="twitter:url" content="${escapeAttr(meta.canonical)}" />`);
    html = html.replace(/(<meta\s+name=["']twitter:image["']\s+content=)[^>]*>/i, `<meta name="twitter:image" content="${escapeAttr(meta.image)}" />`);

    // 7. Robots directives if noindex
    if (meta.noindex) {
      html = html.replace(/(<meta\s+name=["']robots["']\s+content=)[^>]*>/i, `<meta name="robots" content="noindex, nofollow" />`);
      html = html.replace(/(<meta\s+name=["']googlebot["']\s+content=)[^>]*>/i, `<meta name="googlebot" content="noindex, nofollow" />`);
    }

    // 8. Inject structured data schema
    if (meta.schema) {
      const schemaScript = `\n  <!-- Googlebot Structured Data (Auto-Injected) -->\n  <script type="application/ld+json">\n${JSON.stringify(meta.schema, null, 2)}\n  </script>\n`;
      html = html.replace(/<\/head>/i, `${schemaScript}</head>`);
    }

    return { html, status: 200 };
  } catch (err) {
    return { html: rawHtml, status: 200 };
  }
}

export default router;
