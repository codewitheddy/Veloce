# Comprehensive Performance Audit Report & Optimization Plan
**Application:** Ropenix Collections (React JS 19, Node/Express, MySQL on cPanel Shared Hosting)  
**Target Environment:** Mobile Devices on Slow 4G Connections (RTT ~150ms, Downlink ~1.6 Mbps)  
**Audit Phase:** Phase 1 (Baseline Measurements & Findings — No Code Changes)

---

## 1. Executive Summary & Baseline Metrics

### 1.1 Baseline Page Weights & Resource Footprint

| Metric / Page | Baseline Measurement | Target Post-Optimization | Expected Reduction |
| :--- | :--- | :--- | :--- |
| **Main Storefront JS Chunk** (`index-*.js`) | **838.56 kB** (gzip: 255.31 kB) | **< 350 kB** (gzip: < 100 kB) | **~58%** |
| **Main CSS Bundle** (`index-*.css`) | **333.42 kB** (gzip: 44.21 kB) | **< 160 kB** (gzip: < 25 kB) | **~52%** |
| **User Account JS Chunk** | **545.10 kB** (gzip: 160.64 kB) | **< 180 kB** (gzip: < 55 kB) | **~67%** |
| **Largest Static Image** (`delivery-hero.jpg`) | **516.58 kB** (JPEG) | **< 35 kB** (WebP/AVIF) | **~93%** |
| **Home Page Initial Transfer Weight** | **~1.45 MB** | **< 650 kB** | **~55%** |
| **Store Catalog Initial Transfer Weight** | **~1.65 MB** | **< 750 kB** | **~54%** |
| **Order Tracking Initial Transfer Weight** | **~1.75 MB** | **< 600 kB** | **~66%** |
| **Estimated Mobile LCP (Slow 4G)** | **4.8s - 5.5s** | **< 2.4s** | **~52% faster** |
| **Estimated Mobile CLS** | **0.18 - 0.25** | **< 0.05** | **~75% smoother** |
| **Estimated Mobile TBT** | **580ms - 850ms** | **< 150ms** | **~78% faster** |

---

## 2. Detailed Audit Findings (10 Core Dimensions)

### 2.1 Bundle & Dependency Analysis
- **Build Output:**
  - `dist/index.html`: `10.34 kB` (gzip: `3.02 kB`)
  - `dist/assets/index-*.css`: `333.42 kB` (gzip: `44.21 kB`)
  - `dist/assets/index-*.js` (Main Storefront): `838.56 kB` (gzip: `255.31 kB`)
  - `dist/assets/AdminLayout-*.js`: `1,645.42 kB` (gzip: `387.69 kB`)
  - `dist/assets/UserAccount-*.js`: `545.10 kB` (gzip: `160.64 kB`)
  - `dist/assets/html2canvas.esm-*.js`: `202.38 kB` (gzip: `48.04 kB`)
  - `dist/assets/EmailCampaignsPanel-*.js`: `212.67 kB` (gzip: `44.02 kB`)
  - `dist/assets/ProductStore-*.js`: `193.48 kB` (gzip: `45.42 kB`)
  - `dist/assets/index.es-*.js` (D3/Leaflet chunk): `160.03 kB` (gzip: `53.75 kB`)
  - `dist/assets/CheckoutFlow-*.js`: `109.35 kB` (gzip: `26.12 kB`)
- **Key Bottlenecks:**
  - **Heavy PDF Libraries in User Flow:** `UserAccount.tsx` statically imports `pdfGenerator.ts`, pulling in `jspdf` (`4.2.1`) and `html2canvas` (`202 kB`) on initial tab load even before any user clicks "Download Receipt".
  - **D3 Full Import:** `ComparativeD3Chart.tsx` imports `* as d3 from 'd3'` instead of specific modular subpackages.
  - **Leaflet Global CSS:** `leaflet.css` is imported at the top of `src/index.css`, forcing all regular shoppers to download mapping styles that are only needed in admin rate tools.
  - **Framer Motion in Critical Path:** `motion/react` is bundled into the root bundle due to eager imports in home banners.
  - **Static Seed Data in Root Bundle:** `src/data.ts` (17.1 kB of static JSON seed objects for products, orders, blogs, audit logs) is eagerly imported in `App.tsx`.

---

### 2.2 Routing & Code-Splitting
- **Statically Imported Components in Root:**
  - `LandingHome.tsx` (and all its sub-sections: `DailyOffersSection`, `BestSellersNewArrivalsCarousel`, `BestSellingByCategory`, `SaleProducts`, `HeroBannerSlider`).
  - `StorefrontLayout.tsx`, `Header.tsx`, `Footer.tsx`, `EmailToaster.tsx`, `AdminPreloader.tsx`, `MaintenanceModeView.tsx`.
- **Properly Lazy-Loaded Routes:**
  - `ProductStore`, `ServicesPanel`, `BlogPanel`, `UserAccount`, `CheckoutFlow`, `ContactAbout`, `PrivacyPolicy`, `AdminLayout`, `OrderTrackingPage`, `ResetPasswordView`.
- **Optimization Opportunities:**
  - Code-split below-the-fold landing page sections (`BestSellingByCategory`, `SaleProducts`) so the mobile initial paint only requires the hero and top navigation.
  - Convert heavy action modals (`OrderReceiptModal`, `AdminPaymentVerificationModal`, `ProductCompareModal`, `BulkProductUploadModal`) from eager imports to on-demand `React.lazy` or dynamic imports.

---

### 2.3 Images & Visual Media
- **Image Sources Identified:**
  1. **Static Assets (`public/images/` & `public/`):**
     - `/images/delivery-hero.jpg`: **516.58 kB** JPEG (Unoptimized, 1920x1080 rendered in a 400px mobile container on `OrderTrackingPage`).
     - Brand PNGs (`logo.png`, `ropenix_logo_dark.png`, `veloce_logo_white.png`): 11 - 16 kB each.
  2. **External CDN Images (Unsplash & Cloudinary):**
     - Product and Hero banner URLs load full-resolution images (`w=800` / `w=1200` / `w=1600`) for small 180px–280px product cards.
- **Critical Issues Identified:**
  - **Missing Width / Height & Aspect Ratio:** Multiple `<img>` tags in `DailyOffersSection`, `BestSellingByCategory`, `HeroBannerSlider`, `ProductStore`, and `Header` lack explicit `width`, `height`, or CSS `aspect-ratio`, causing Cumulative Layout Shift (CLS) as images load.
  - **Missing Lazy Loading:** Below-the-fold product cards in carousels and listing grids lack `loading="lazy"` and `decoding="async"`.
  - **Hero Image Prioritization:** The LCP hero image in `HeroBannerSlider.tsx` does not have `fetchpriority="high"`.
  - **Missing Responsive srcset:** Mobile screens download desktop-sized assets.
  - **Server-Side Uploads:** The `/api/upload` endpoint stores raw uploads without resizing, compression, or WebP conversion.

---

### 2.4 Fonts & Typography
- **Fonts Loaded:** `Inter`, `Poppins`, `Space Grotesk` (Weights: 400, 500, 600, 700).
- **Current Strategy:**
  - Loaded via Google Fonts CDN (`fonts.googleapis.com` / `fonts.gstatic.com`).
  - `font-display: swap` is enabled.
- **Double Loading Issue:**
  - `index.html` (line 68) loads the font stylesheet via `<link rel="stylesheet">`.
  - `src/index.css` (line 1) ALSO has `@import url('https://fonts.googleapis.com/...');`, creating duplicate render-blocking requests during CSS parsing.
- **Optimization Strategy:**
  - Self-host clean WOFF2 files in `public/fonts/` with `@font-face`, preload the primary body font (`Inter-Regular.woff2`), and eliminate Google Fonts external DNS and TLS latency.

---

### 2.5 Third-Party Scripts & Blocking Behavior
- **Google Translate Element:** Loaded via `https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit` with `async defer`.
- **Preconnect Directives:** `index.html` already preconnects to `res.cloudinary.com`, `images.unsplash.com`, `fonts.googleapis.com`, and `fonts.gstatic.com`.
- **Content Security Policy (CSP):** Configured in `server/index.ts` with explicit source whitelists.
- No heavy third-party tracking pixels or blocking chat widgets currently exist in the main bundle.

---

### 2.6 Backend & API Endpoints
- **Hot Path Endpoints:**
  1. `GET /api/products`: Returns the entire catalog in one single unpaginated JSON array. Each product object includes full text (`detailedDescription`, `features`, `specifications`, `whatsInTheBox`, `options`, `variantMatrix`).
  2. `GET /api/products/:id`: Retrieves full product details.
  3. `GET /api/categories`: Returns full category array.
  4. `GET /api/orders`: Returns all orders unpaginated.
  5. `GET /api/settings`: Returns site configuration.
- **Key Inefficiencies:**
  - **No Server-Side Pagination:** `/api/products` and `/api/orders` lack `page` and `limit` pagination.
  - **Heavy Listing Payload:** Listing views transfer thousands of lines of unused markdown specifications and descriptions.
  - **Sequential Queries:** Dashboard and order detail aggregations run sequential DB queries rather than leveraging `Promise.all`.
  - **Database Connection:** MySQL connection pool is configured (`connectionLimit: 15`), which is well suited for cPanel shared hosting. In-memory caching with short TTL will further protect MySQL limits.

---

### 2.7 Database Schema & Indexing
- **Current Schema State:**
  - All tables (`products`, `orders`, `users`, `categories`, `reviews`, `suppliers`) only define their `PRIMARY KEY` (and `users.email` UNIQUE).
- **Missing Hot-Path Indexes (Full Table Scans Occurring):**
  - `products`: Missing indexes on `category`, `status`, `type`, `slug`, `sku`, `price`, and `created_at`.
  - `orders`: Missing indexes on `customerEmail`, `status`, `paymentStatus`, `date`, `trackingNumber`, and `created_at`.
  - `categories`: Missing indexes on `slug`, `is_active`, and `display_order`.
  - `reviews`: Missing indexes on `product_id` and `status`.
  - `users`: Missing indexes on `role` and `created_at`.

---

### 2.8 React Rendering & State
- **Search-as-you-type Inputs:** Search inputs in `Header.tsx` and `ProductStore.tsx` update state on every keystroke (`onChange`) with **0ms debounce**, triggering synchronous recalculations and re-renders of the catalog.
- **Memoization Gaps:** `ProductCard` components in catalog grids are not wrapped in `React.memo`, causing every card to re-render when filters, search terms, or parent states update.
- **Large Eager Seed State:** Initializing React state directly with `INITIAL_PRODUCTS` (from `src/data.ts`) forces parsing and memory allocation of large seed data before backend sync completes.

---

### 2.9 Server & Caching Configuration
- **Express Backend:**
  - `compression` middleware is active (`threshold: 1024`).
  - `/assets` static route sets `maxAge: '1y', immutable: true`.
  - `index.html` fallback correctly sets `Cache-Control: no-cache, no-store, must-revalidate`.
- **Apache `.htaccess` Configuration:**
  - Gzip/Deflate compression is configured.
  - Expiration headers for `.js`, `.css`, fonts, and images are configured.
  - Missing: Explicit Brotli (`mod_brotli.c`) directives.
  - Missing: Single-step HTTPS and canonical non-www/www rewrite rules.

---

### 2.10 Redirects & HTTPS
- **Current State:**
  - Assets use HTTPS or root-relative paths (no mixed content).
  - `.htaccess` lacks a unified canonical HTTPS redirect rule (`RewriteCond %{HTTPS} off` -> 301).
  - Adding a single-step 301 rule ensures visitors directly land on `https://ropenix.co.ke` without redirect hops over mobile networks.

---

## 3. Prioritized Optimization Roadmap (Ranked by Impact vs Effort)

```
+-----------------------------------------------------------------------------------------+
|                                    PRIORITY MATRIX                                      |
|                                                                                         |
|  HIGH IMPACT / LOW EFFORT (Immediate Wins)                                              |
|  1. Convert & compress static images to WebP (e.g. delivery-hero 516kB -> 35kB).         |
|  2. Fix duplicate font loading & self-host WOFF2 fonts with font-display: swap.         |
|  3. Add explicit aspect-ratio / width & height + lazy loading to all product images.    |
|  4. Debounce search inputs (~300ms) in Header and ProductStore.                         |
|  5. Add database indexes via migrations/performance_indexes.sql.                        |
|                                                                                         |
|  HIGH IMPACT / MEDIUM EFFORT                                                            |
|  6. Dynamic import for PDF export (jspdf/html2canvas) in UserAccount.                   |
|  7. Remove global leaflet.css from storefront index.css.                                |
|  8. Add pagination (page/limit) and trim listing payload fields in /api/products.        |
|  9. Code-split below-the-fold home page components with Suspense/skeleton.              |
|                                                                                         |
|  MEDIUM IMPACT / MEDIUM EFFORT                                                          |
|  10. In-memory TTL caching for categories, settings, and featured products.            |
|  11. Memoize ProductCard components and list items with React.memo & useCallback.      |
|  12. Enhance .htaccess with Brotli and single-step canonical HTTPS redirects.           |
+-----------------------------------------------------------------------------------------+
```

---

## 4. Next Step: Phase 2 (Images) Plan

Upon your approval, we will begin **Phase 2: Images**:
1. Convert `public/images/delivery-hero.jpg` (516 kB) and static badge assets into optimized WebP format (~30 kB).
2. Update all image components (`DailyOffersSection`, `BestSellersNewArrivalsCarousel`, `BestSellingByCategory`, `SaleProducts`, `ProductStore`, `HeroBannerSlider`, `OrderTrackingPage`) with explicit `aspect-ratio` / `width` / `height` attributes to eliminate CLS.
3. Configure `loading="lazy"` and `decoding="async"` for all below-the-fold catalog cards.
4. Set `fetchpriority="high"` on the hero image in `HeroBannerSlider.tsx`.
5. Implement server-side image optimization on upload in `server/routes/upload.ts` using `sharp` (with pure JS fallback if binaries are constrained on shared hosting).
