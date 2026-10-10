/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const getAppDirname = (): string => {
  try {
    if (typeof __dirname !== 'undefined') return __dirname;
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch (_) {}
  return process.cwd();
};

const appDir = getAppDirname();

import { 
  getDbStatus, 
  initializeDatabaseSchema, 
  ensureDefaultAdminUser, 
  ensureDefaultCustomers, 
  ensureDefaultProducts, 
  ensureDefaultHeroBanners 
} from '../src/lib/mysql-db';
import { validateEmailConfigOnStartup } from './email/startupCheck';
import { registerEmailEventListeners } from './email/events';
import { startEmailQueueWorker, stopEmailQueueWorker } from './email/queue';
import { startEmailScheduler, stopEmailScheduler } from './email/scheduler';
import { performExpiryBackgroundCheck } from './services/expiryChecker';
import { errorHandler } from './middleware/errorHandler';

// Import Domain Routers
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import productsRouter, { loadProductsCache } from './routes/products';
import categoriesRouter from './routes/categories';
import ordersRouter from './routes/orders';
import suppliersRouter from './routes/suppliers';
import customersRouter from './routes/customers';
import settingsRouter from './routes/settings';
import contentRouter from './routes/content';
import cartRouter from './routes/cart';
import reviewsRouter from './routes/reviews';
import paymentsRouter from './routes/payments';
import newsletterRouter, { handleContactForm } from './routes/newsletter';
import uploadRouter from './routes/upload';
import emailPreferencesRouter from './routes/emailPreferences';
import emailDiagnosticsRouter from './routes/emailDiagnostics';
import systemRouter from './routes/system';
import compression from 'compression';
import seoRouter from './routes/seo';

dotenv.config();

const app = express();
const rawPort = process.env.PORT;
const isNumericPort = rawPort && !isNaN(Number(rawPort));
const PORT: number | string = isNumericPort ? Number(rawPort) : rawPort || 3000;

// Security & Hardening Configuration
app.disable('x-powered-by');
app.set('strict routing', false);

// 1. Compression Middleware (Gzip / Brotli acceleration)
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
  })
);

// 2. Comprehensive Security Headers & Content Security Policy (CSP)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  const cspDirectives = [
    "default-src 'self' https: http: data: blob:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://translate.google.com https://translate.googleapis.com https://translate-pa.googleapis.com https://*.googleapis.com https://*.google.com https://*.gstatic.com https://www.gstatic.com http://translate.google.com http://translate.googleapis.com",
    "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' https://translate.google.com https://translate.googleapis.com https://translate-pa.googleapis.com https://*.googleapis.com https://*.google.com https://*.gstatic.com https://www.gstatic.com http://translate.google.com http://translate.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://translate.googleapis.com https://*.googleapis.com https://www.gstatic.com https://*.gstatic.com http://translate.googleapis.com",
    "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://translate.googleapis.com https://*.googleapis.com https://www.gstatic.com https://*.gstatic.com http://translate.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com https://*.gstatic.com data:",
    "img-src 'self' data: blob: https: http: res.cloudinary.com https://images.unsplash.com https://translate.google.com https://www.google.com https://*.google.com https://*.gstatic.com https://www.gstatic.com",
    "connect-src 'self' https: http: ws: wss: https://*.googleapis.com https://translate-pa.googleapis.com https://*.google.com https://*.gstatic.com",
    "frame-src 'self' https://translate.google.com https://*.google.com https://*.googleapis.com",
    "child-src 'self' https://translate.google.com https://*.google.com https://*.googleapis.com",
    "media-src 'self' data: blob: https: res.cloudinary.com",
    "frame-ancestors 'self'",
  ];

  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  next();
});

// 3. Lightweight Health Check Monitor Endpoint
app.get(['/health', '/api/health'], async (_req: Request, res: Response) => {
  try {
    const dbStatus = await getDbStatus();
    const memUsage = process.memoryUsage();
    return res.status(200).json({
      status: dbStatus.connected ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      database: {
        engine: 'MySQL',
        status: dbStatus.connected ? 'connected' : 'disconnected',
        message: dbStatus.message,
        stats: dbStatus.stats,
      },
      memory: {
        rss_mb: Math.round(memUsage.rss / 1024 / 1024),
        heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
      },
      service: 'Ropenix Collections Platform Engine',
      environment: process.env.NODE_ENV || 'production',
      version: '1.0.0',
    });
  } catch (err: any) {
    return res.status(503).json({
      status: 'unhealthy',
      error: err?.message || 'Health check failure',
    });
  }
});

// Middleware for body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============================================================================
// Mount Modular Domain Routers
// ============================================================================
app.use('/auth', authRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/inventory', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/customers', customersRouter);
app.use('/api/deals', customersRouter);
app.use('/api/invoices', customersRouter);
app.use('/api/customer-orders', customersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/content', contentRouter);
app.use('/api/hero-banners', contentRouter);
app.use('/api/services/custom-clothing', contentRouter);
app.use('/api/wishlist', contentRouter);
app.use('/api/cart', cartRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/admin/reviews', reviewsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/email', emailPreferencesRouter);
app.use('/api/admin/email', emailDiagnosticsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/newsletter', newsletterRouter);
app.post(['/api/contact', '/api/contact/'], handleContactForm);
app.use('/api', systemRouter);
app.use('/', seoRouter);

// Global Error Handler
app.use(errorHandler);

// ============================================================================
// Server Bootstrap & Static Asset Serving
// ============================================================================
async function startServer() {
  try {
    await initializeDatabaseSchema();
    const dbStatus = await getDbStatus();
    console.log(`[MySQL Database] ${dbStatus.message}`);
    await loadProductsCache();
  } catch (err) {
    console.error('[MySQL Startup] Error initializing MySQL database:', err);
  }

  performExpiryBackgroundCheck().catch((err) => {
    console.error('[Expiry Check] Startup execution error:', err);
  });

  const resolveDistPath = (): string => {
    const candidates = [
      path.resolve(appDir, 'dist'),
      path.resolve(process.cwd(), 'dist'),
      path.resolve(appDir, '..', 'dist'),
      path.resolve(appDir),
      path.resolve(process.cwd()),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(path.join(candidate, 'index.html')) && fs.existsSync(path.join(candidate, 'assets'))) {
        return candidate;
      }
    }
    if (fs.existsSync(path.resolve(process.cwd(), 'dist', 'index.html'))) {
      return path.resolve(process.cwd(), 'dist');
    }
    return path.resolve(process.cwd(), 'dist');
  };

  const serveStaticProductionAssets = () => {
    const distPath = resolveDistPath();
    const assetsPath = path.join(distPath, 'assets');
    if (fs.existsSync(assetsPath)) {
      app.use(
        '/assets',
        express.static(assetsPath, {
          maxAge: '1y',
          immutable: true,
          setHeaders: (res, filePath) => {
            if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
              res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            } else if (filePath.endsWith('.css')) {
              res.setHeader('Content-Type', 'text/css; charset=utf-8');
            }
          },
        })
      );
    }
    app.use(
      express.static(distPath, {
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          } else if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send(`
          <!DOCTYPE html>
          <html>
            <head><title>Ropenix Collections - 404 Build Asset Missing</title></head>
            <body style="font-family: sans-serif; padding: 40px; background: #0f172a; color: #f8fafc;">
              <h1 style="color: #38bdf8;">Ropenix Collections - Production Assets Not Found</h1>
              <p>Please ensure the production bundle has been generated via <code>npm run build</code>.</p>
            </body>
          </html>
        `);
      }
    });
  };

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    (Boolean(process.argv[1]) && (process.argv[1].endsWith('.cjs') || process.argv[1].includes('dist')));

  if (isProduction) {
    serveStaticProductionAssets();
  } else {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.warn('[Vite Middleware Notice]:', viteErr instanceof Error ? viteErr.message : viteErr);
      serveStaticProductionAssets();
    }
  }

  let listenPort: number | string = PORT;
  if (typeof (global as any).PhusionPassenger !== 'undefined') {
    try {
      (global as any).PhusionPassenger.configure({ autoInstall: false });
    } catch (_) {}
    listenPort = 'passenger';
  } else if (process.env.PORT === 'passenger' || (process.env.PORT && isNaN(Number(process.env.PORT)))) {
    listenPort = process.env.PORT;
  }

  const server = app.listen(listenPort, () => {
    const listenMsg = listenPort === 'passenger' ? 'Phusion Passenger' : `http://localhost:${listenPort}`;
    console.log(`[Ropenix Express Server] Running on ${listenMsg}`);
    console.log(`[Ropenix Auth API] Route registered at /api/auth`);
    console.log(`[Ropenix Products API] Route registered at /api/products`);
    console.log(`[Ropenix Orders API] Route registered at /api/orders`);
    console.log(`[Ropenix Suppliers API] Route registered at /api/suppliers`);
  });

  ensureDefaultAdminUser().catch((err) => console.warn('[MySQL] Default admin seed notice:', err));
  ensureDefaultCustomers().catch((err) => console.warn('[MySQL] Default customer seed notice:', err));
  ensureDefaultProducts().catch((err) => console.warn('[MySQL] Default product seed notice:', err));
  ensureDefaultHeroBanners().catch((err) => console.warn('[MySQL] Default hero banners seed notice:', err));
  registerEmailEventListeners();
  try {
    validateEmailConfigOnStartup();
  } catch (_) {}
  startEmailQueueWorker();
  startEmailScheduler();

  const handleShutdown = (signal: string) => {
    console.log(`[Ropenix Server] Received ${signal}. Gracefully stopping workers and closing server...`);
    stopEmailQueueWorker();
    stopEmailScheduler();
    server.close(() => {
      console.log('[Ropenix Server] Server closed gracefully.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  return server;
}

const isMain = process.argv[1] && (
  process.argv[1].endsWith('server.ts') || 
  process.argv[1].endsWith('server.cjs') || 
  process.argv[1].endsWith('index.ts') || 
  process.argv[1].endsWith('index.cjs') ||
  process.argv[1].endsWith('app.cjs') ||
  process.argv[1].endsWith('app.js')
);

if (isMain && process.env.NODE_ENV !== 'test') {
  startServer();
}

export { startServer, app };
export default app;
