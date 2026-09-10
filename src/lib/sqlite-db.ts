/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_FILE_PATH = path.join(process.cwd(), 'veloce.sqlite');

let dbInstance: Database | null = null;
let isInitializing = false;

// Save SQLite database to local disk
export function saveSqliteDb(db: Database = dbInstance!): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    const tmpPath = `${DB_FILE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, DB_FILE_PATH);
    console.log(`[SQLite] Persisted database to file: ${DB_FILE_PATH} (${buffer.length} bytes)`);
  } catch (err) {
    console.error('[SQLite] Failed to persist database to disk:', err);
    try {
      const data = db.export();
      fs.writeFileSync(DB_FILE_PATH, Buffer.from(data));
    } catch (e) {
      // ignore
    }
  }
}

// Get or initialize SQLite database instance
export async function getSqliteDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE_PATH);
      if (fileBuffer.length > 0) {
        dbInstance = new SQL.Database(fileBuffer);
        dbInstance.exec("PRAGMA quick_check;");
        console.log(`[SQLite] Loaded existing database from ${DB_FILE_PATH} (${fileBuffer.length} bytes)`);
        initializeSqliteSchema(dbInstance);
        return dbInstance;
      }
    } catch (err) {
      console.warn('[SQLite] Error reading existing SQLite file, creating fresh database:', err);
      try {
        if (fs.existsSync(DB_FILE_PATH)) {
          fs.unlinkSync(DB_FILE_PATH);
          console.log('[SQLite] Cleaned up malformed database disk image from disk.');
        }
      } catch (unlinkErr) {
        console.error('[SQLite] Failed to remove malformed file:', unlinkErr);
      }
    }
  }

  // Create new SQLite database
  dbInstance = new SQL.Database();
  initializeSqliteSchema(dbInstance);
  saveSqliteDb(dbInstance);
  console.log(`[SQLite] Initialized new SQLite database at ${DB_FILE_PATH}`);
  return dbInstance;
}

// Initialize tables in SQLite
function initializeSqliteSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      category TEXT,
      tags TEXT,
      type TEXT NOT NULL,
      imageUrl TEXT,
      images TEXT,
      stock INTEGER,
      lowStockThreshold INTEGER,
      variations TEXT,
      rating REAL DEFAULT 0,
      reviewsCount INTEGER DEFAULT 0,
      reviews TEXT,
      digitalFileUrl TEXT,
      previousPrice REAL,
      backInStockAlert INTEGER DEFAULT 0,
      costPrice REAL,
      taxId TEXT,
      status TEXT DEFAULT 'Active',
      paymentRestriction TEXT DEFAULT 'both',
      shortDescription TEXT,
      detailedDescription TEXT,
      features TEXT,
      specifications TEXT,
      whatsInTheBox TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customerName TEXT NOT NULL,
      customerEmail TEXT NOT NULL,
      items TEXT NOT NULL,
      total REAL NOT NULL,
      status TEXT NOT NULL,
      date TEXT NOT NULL,
      couponCode TEXT,
      customNote TEXT,
      shippingAddress TEXT,
      notesHistory TEXT,
      statusHistory TEXT,
      isGuest INTEGER DEFAULT 0,
      paymentMethod TEXT DEFAULT 'cod',
      review_request_sent_at TEXT,
      review_request_status TEXT
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      productId TEXT NOT NULL,
      orderId TEXT,
      userName TEXT NOT NULL,
      userEmail TEXT,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      date TEXT NOT NULL,
      verified INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source TEXT NOT NULL,
      clicks INTEGER DEFAULT 0,
      conversions INTEGER DEFAULT 0,
      earnings REAL DEFAULT 0,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS click_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      targetId TEXT NOT NULL,
      targetName TEXT NOT NULL,
      targetType TEXT NOT NULL,
      campaignName TEXT,
      source TEXT NOT NULL,
      converted INTEGER DEFAULT 0,
      commission REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventory_audit_logs (
      id TEXT PRIMARY KEY,
      productId TEXT NOT NULL,
      productName TEXT NOT NULL,
      productSku TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      changeQuantity INTEGER NOT NULL,
      newStock INTEGER NOT NULL,
      reason TEXT NOT NULL,
      details TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT
    );

    CREATE TABLE IF NOT EXISTS unsubscribed_emails (
      email TEXT PRIMARY KEY,
      reason TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      parentId TEXT,
      description TEXT,
      imageUrl TEXT,
      status TEXT DEFAULT 'Active',
      displayOrder INTEGER DEFAULT 0,
      previousSlugs TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS review_opt_outs (
      email TEXT PRIMARY KEY,
      opt_out INTEGER DEFAULT 1,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS hero_banners (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT,
      description TEXT,
      badge_text TEXT,
      primary_button_text TEXT,
      primary_button_url TEXT,
      secondary_button_text TEXT,
      secondary_button_url TEXT,
      hero_image_url TEXT,
      background_type TEXT DEFAULT 'color',
      background_color TEXT DEFAULT '#0f172a',
      background_image_url TEXT,
      background_position TEXT DEFAULT 'center',
      overlay_enabled INTEGER DEFAULT 1,
      overlay_color TEXT DEFAULT '#000000',
      overlay_opacity REAL DEFAULT 0.5,
      text_color TEXT DEFAULT '#ffffff',
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 1,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `);
  saveSqliteDb(db);
}

// Check database status
export async function getSqliteDbStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  dbEngine: string;
  filePath: string;
  fileSizeBytes: number;
  message: string;
  stats?: Record<string, number>;
}> {
  try {
    const db = await getSqliteDb();
    const exists = fs.existsSync(DB_FILE_PATH);
    const size = exists ? fs.statSync(DB_FILE_PATH).size : 0;

    const prodRes = db.exec("SELECT COUNT(*) as count FROM products;");
    const prodCount = prodRes.length > 0 ? (prodRes[0].values[0][0] as number) : 0;

    const orderRes = db.exec("SELECT COUNT(*) as count FROM orders;");
    const orderCount = orderRes.length > 0 ? (orderRes[0].values[0][0] as number) : 0;

    const revRes = db.exec("SELECT COUNT(*) as count FROM reviews;");
    const revCount = revRes.length > 0 ? (revRes[0].values[0][0] as number) : 0;

    return {
      configured: true,
      connected: true,
      dbEngine: 'SQLite (sql.js / veloce.sqlite)',
      filePath: DB_FILE_PATH,
      fileSizeBytes: size,
      message: `Active production SQLite database at ${DB_FILE_PATH} (${(size / 1024).toFixed(1)} KB)`,
      stats: {
        products: prodCount,
        orders: orderCount,
        reviews: revCount,
      },
    };
  } catch (err: any) {
    return {
      configured: false,
      connected: false,
      dbEngine: 'SQLite',
      filePath: DB_FILE_PATH,
      fileSizeBytes: 0,
      message: `SQLite database error: ${err.message || err}`,
    };
  }
}

// Push synchronization to SQLite
export async function pushSyncDataSqlite(payload: Record<string, any>): Promise<void> {
  const db = await getSqliteDb();

  // 1. Sync Products
  if (Array.isArray(payload.veloce_products)) {
    db.run("DELETE FROM products;");
    const stmt = db.prepare(`
      INSERT INTO products (
        id, sku, name, description, price, category, tags, type, imageUrl, images,
        stock, lowStockThreshold, variations, rating, reviewsCount, reviews, digitalFileUrl,
        previousPrice, backInStockAlert, costPrice, taxId, status, paymentRestriction,
        shortDescription, detailedDescription, features, specifications, whatsInTheBox
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of payload.veloce_products) {
      if (!p.id || !p.name) continue;
      stmt.run([
        p.id,
        p.sku || null,
        p.name,
        p.description || null,
        p.price || 0,
        p.category || null,
        p.tags ? JSON.stringify(p.tags) : null,
        p.type || 'physical',
        p.imageUrl || null,
        p.images ? JSON.stringify(p.images) : null,
        p.stock !== undefined ? p.stock : null,
        p.lowStockThreshold !== undefined ? p.lowStockThreshold : null,
        p.variations ? JSON.stringify(p.variations) : null,
        p.rating || 0,
        p.reviewsCount || 0,
        p.reviews ? JSON.stringify(p.reviews) : null,
        p.digitalFileUrl || null,
        p.previousPrice !== undefined ? p.previousPrice : null,
        p.backInStockAlert ? 1 : 0,
        p.costPrice !== undefined ? p.costPrice : null,
        p.taxId || null,
        p.status || 'Active',
        p.paymentRestriction || 'both',
        p.shortDescription || null,
        p.detailedDescription || null,
        p.features ? JSON.stringify(p.features) : null,
        p.specifications ? JSON.stringify(p.specifications) : null,
        p.whatsInTheBox || null,
      ]);
    }
    stmt.free();
  }

  // 2. Sync Orders
  if (Array.isArray(payload.veloce_orders)) {
    db.run("DELETE FROM orders;");
    const stmt = db.prepare(`
      INSERT INTO orders (
        id, customerName, customerEmail, items, total, status, date, couponCode,
        customNote, shippingAddress, notesHistory, statusHistory, isGuest, paymentMethod,
        review_request_sent_at, review_request_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const o of payload.veloce_orders) {
      if (!o.id) continue;
      stmt.run([
        o.id,
        o.customerName || 'Guest Customer',
        o.customerEmail || '',
        o.items ? JSON.stringify(o.items) : '[]',
        o.total || 0,
        o.status || 'pending',
        o.date || new Date().toISOString(),
        o.couponCode || null,
        o.customNote || null,
        o.shippingAddress || null,
        o.notesHistory ? JSON.stringify(o.notesHistory) : null,
        o.statusHistory ? JSON.stringify(o.statusHistory) : null,
        o.isGuest ? 1 : 0,
        o.paymentMethod || 'cod',
        o.review_request_sent_at || null,
        o.review_request_status || null,
      ]);
    }
    stmt.free();
  }

  // 3. Sync Categories
  if (Array.isArray(payload.veloce_categories) || Array.isArray(payload.categories)) {
    const catList = payload.veloce_categories || payload.categories;
    db.run("DELETE FROM categories;");
    const stmt = db.prepare(`
      INSERT INTO categories (
        id, name, slug, parentId, description, imageUrl, status, displayOrder, previousSlugs, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of catList) {
      if (!c.id || !c.name) continue;
      stmt.run([
        String(c.id),
        c.name,
        c.slug || c.name.toLowerCase().replace(/\s+/g, '-'),
        c.parentId || null,
        c.description || '',
        c.imageUrl || '',
        c.status || 'Active',
        Number(c.displayOrder || 0),
        c.previousSlugs ? JSON.stringify(c.previousSlugs) : '[]',
        c.createdAt || new Date().toISOString(),
        c.updatedAt || new Date().toISOString(),
      ]);
    }
    stmt.free();
  }

  // Save settings
  const settingsKeys = [
    'veloce_cart',
    'veloce_wishlist',
    'veloce_earnings',
    'veloce_loyalty_points',
    'veloce_coupons',
    'veloce_promo_banner',
    'customer_support_tickets',
    'veloce_payout_logs'
  ];

  const stmtSettings = db.prepare(`
    INSERT OR REPLACE INTO app_settings (setting_key, setting_value) VALUES (?, ?)
  `);

  for (const key of settingsKeys) {
    if (payload[key] !== undefined && payload[key] !== null) {
      const valueStr = typeof payload[key] === 'object' ? JSON.stringify(payload[key]) : String(payload[key]);
      stmtSettings.run([key, valueStr]);
    }
  }
  stmtSettings.free();

  // 5. Sync Hero Banners
  if (Array.isArray(payload.veloce_hero_slides)) {
    await saveSqliteHeroBanners(payload.veloce_hero_slides);
  }

  saveSqliteDb(db);
}

// Pull synchronization from SQLite
export async function pullSyncDataSqlite(): Promise<Record<string, any>> {
  const db = await getSqliteDb();
  const result: Record<string, any> = {};

  // 1. Pull Products
  const prodRes = db.exec("SELECT * FROM products;");
  if (prodRes.length > 0) {
    const cols = prodRes[0].columns;
    result.veloce_products = prodRes[0].values.map((row) => {
      const obj: any = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        ...obj,
        price: Number(obj.price),
        tags: obj.tags ? JSON.parse(obj.tags) : [],
        images: obj.images ? JSON.parse(obj.images) : [],
        variations: obj.variations ? JSON.parse(obj.variations) : [],
        reviews: obj.reviews ? JSON.parse(obj.reviews) : [],
        stock: obj.stock !== null ? Number(obj.stock) : null,
        rating: Number(obj.rating || 0),
        reviewsCount: Number(obj.reviewsCount || 0),
        backInStockAlert: Boolean(obj.backInStockAlert),
      };
    });
  } else {
    result.veloce_products = [];
  }

  // 2. Pull Orders
  const orderRes = db.exec("SELECT * FROM orders;");
  if (orderRes.length > 0) {
    const cols = orderRes[0].columns;
    result.veloce_orders = orderRes[0].values.map((row) => {
      const obj: any = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        ...obj,
        total: Number(obj.total),
        items: obj.items ? JSON.parse(obj.items) : [],
        notesHistory: obj.notesHistory ? JSON.parse(obj.notesHistory) : [],
        statusHistory: obj.statusHistory ? JSON.parse(obj.statusHistory) : [],
        isGuest: Boolean(obj.isGuest),
      };
    });
  } else {
    result.veloce_orders = [];
  }

  // 3. Pull Categories
  const catRes = db.exec("SELECT * FROM categories ORDER BY displayOrder ASC, name ASC;");
  if (catRes.length > 0) {
    const cols = catRes[0].columns;
    result.veloce_categories = catRes[0].values.map((row) => {
      const obj: any = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        ...obj,
        displayOrder: Number(obj.displayOrder || 0),
        previousSlugs: obj.previousSlugs ? JSON.parse(obj.previousSlugs) : [],
      };
    });
  } else {
    result.veloce_categories = [];
  }

  // 5. Pull Hero Banners
  result.veloce_hero_slides = await getAllSqliteHeroBanners();

  // 6. Pull Settings
  const settRes = db.exec("SELECT * FROM app_settings;");
  if (settRes.length > 0) {
    settRes[0].values.forEach((row) => {
      const key = row[0] as string;
      const val = row[1] as string;
      try {
        result[key] = JSON.parse(val);
      } catch (e) {
        if (val === 'true') result[key] = true;
        else if (val === 'false') result[key] = false;
        else if (!isNaN(Number(val))) result[key] = Number(val);
        else result[key] = val;
      }
    });
  }

  return result;
}

const DEFAULT_INITIAL_CATEGORIES = [
  { id: 'cat-1', name: 'Electronics', slug: 'electronics', description: 'Smartphones, Audio, Computing and Accessories', status: 'Active', displayOrder: 1 },
  { id: 'cat-2', name: 'Fashion', slug: 'fashion', description: 'Men & Women Apparel, Shoes, and Accessories', status: 'Active', displayOrder: 2 },
  { id: 'cat-3', name: 'Home & Living', slug: 'home-living', description: 'Furniture, Decor, Kitchen and Appliances', status: 'Active', displayOrder: 3 },
  { id: 'cat-4', name: 'Beauty & Fragrances', slug: 'beauty-fragrances', description: 'Skincare, Makeup, Perfumes and Personal Care', status: 'Active', displayOrder: 4 },
  { id: 'cat-5', name: 'Sports & Outdoor', slug: 'sports-outdoor', description: 'Fitness Gear, Sportswear and Equipment', status: 'Active', displayOrder: 5 },
  { id: 'cat-6', name: 'Food & Beverages', slug: 'food-beverages', description: 'Snacks, Organic Groceries, Coffee and Drinks', status: 'Active', displayOrder: 6 },
];

export async function getAllSqliteCategories(): Promise<any[]> {
  const db = await getSqliteDb();
  let res = db.exec("SELECT * FROM categories ORDER BY displayOrder ASC, name ASC;");
  
  // If no categories in table, auto-seed from existing products or defaults
  if (res.length === 0 || res[0].values.length === 0) {
    const prodRes = db.exec("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND TRIM(category) != '';");
    let catsToSeed = DEFAULT_INITIAL_CATEGORIES;
    if (prodRes.length > 0 && prodRes[0].values.length > 0) {
      const distinctNames = prodRes[0].values.map(r => String(r[0])).filter(Boolean);
      if (distinctNames.length > 0) {
        catsToSeed = distinctNames.map((name, idx) => ({
          id: `cat-${idx + 1}`,
          name,
          slug: name.toLowerCase().replace(/\s+/g, '-'),
          description: `${name} products`,
          status: 'Active',
          displayOrder: idx + 1,
        }));
      }
    }
    await saveSqliteCategories(catsToSeed);
    res = db.exec("SELECT * FROM categories ORDER BY displayOrder ASC, name ASC;");
    if (res.length === 0) return [];
  }

  const cols = res[0].columns;
  return res[0].values.map((row) => {
    const obj: any = {};
    cols.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return {
      ...obj,
      displayOrder: Number(obj.displayOrder || 0),
      previousSlugs: obj.previousSlugs ? JSON.parse(obj.previousSlugs) : [],
    };
  });
}

export async function saveSqliteCategories(categories: any[]): Promise<any[]> {
  const db = await getSqliteDb();
  db.run("DELETE FROM categories;");
  const stmt = db.prepare(`
    INSERT INTO categories (
      id, name, slug, parentId, description, imageUrl, status, displayOrder, previousSlugs, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const c of categories) {
    if (!c.id || !c.name) continue;
    stmt.run([
      String(c.id),
      c.name,
      c.slug || c.name.toLowerCase().replace(/\s+/g, '-'),
      c.parentId || null,
      c.description || '',
      c.imageUrl || '',
      c.status || 'Active',
      Number(c.displayOrder || 0),
      c.previousSlugs ? JSON.stringify(c.previousSlugs) : '[]',
      c.createdAt || new Date().toISOString(),
      c.updatedAt || new Date().toISOString(),
    ]);
  }
  stmt.free();
  saveSqliteDb(db);
  return getAllSqliteCategories();
}

// Completely purge all simulated data from SQLite database
export async function purgeAllSqliteData(): Promise<void> {
  const db = await getSqliteDb();
  db.run("DELETE FROM products;");
  db.run("DELETE FROM orders;");
  db.run("DELETE FROM categories;");
  db.run("DELETE FROM campaigns;");
  db.run("DELETE FROM click_logs;");
  db.run("DELETE FROM inventory_audit_logs;");
  db.run("DELETE FROM reviews;");
  db.run("DELETE FROM hero_banners;");
  db.run("INSERT OR REPLACE INTO app_settings (setting_key, setting_value) VALUES ('db_is_initialized_clean', 'true');");
  saveSqliteDb(db);
  console.log('[SQLite] Purged all database tables completely.');
}

// ==========================================
// Hero Banners Helpers
// ==========================================
const DEFAULT_HERO_SLIDES_INITIAL = [
  {
    id: 'hero-banner-1',
    title: 'Precision Mechanical Hardware',
    subtitle: 'Engineered for Performance & Tactile Perfection',
    description: 'CNC-machined aluminum frames, custom tuned linear switches, and dye-sublimated PBT keycaps. Built for relentless productivity.',
    badge_text: 'NEW RELEASE 2026',
    primary_button_text: 'Explore Keyboards',
    primary_button_url: 'store',
    secondary_button_text: 'Custom Services',
    secondary_button_url: 'services',
    hero_image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=1200',
    background_type: 'color',
    background_color: '#0f172a',
    background_image_url: '',
    background_position: 'center',
    overlay_enabled: 1,
    overlay_color: '#000000',
    overlay_opacity: 0.4,
    text_color: '#ffffff',
    is_active: 1,
    display_order: 1,
    start_date: null,
    end_date: null
  },
  {
    id: 'hero-banner-2',
    title: 'Minimalist Artisan Workspaces',
    subtitle: 'Natural Solid Hardwoods & Clean Architecture',
    description: 'Sustainably sourced Walnut and White Oak desk accessories, dual monitor risers, and magnetic modular organizers.',
    badge_text: 'HANDCRAFTED EDITIONS',
    primary_button_text: 'Shop Workspace Gear',
    primary_button_url: 'store',
    secondary_button_text: 'Read Design Stories',
    secondary_button_url: 'blog',
    hero_image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=1200',
    background_type: 'image',
    background_color: '#18181b',
    background_image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=1600',
    background_position: 'center',
    overlay_enabled: 1,
    overlay_color: '#09090b',
    overlay_opacity: 0.75,
    text_color: '#ffffff',
    is_active: 1,
    display_order: 2,
    start_date: null,
    end_date: null
  }
];

export async function getAllSqliteHeroBanners(): Promise<any[]> {
  const db = await getSqliteDb();
  
  // Check if hero banners have been initialized
  const initCheck = db.exec("SELECT setting_value FROM app_settings WHERE setting_key = 'hero_banners_seeded';");
  const isSeeded = initCheck.length > 0 && initCheck[0].values.length > 0 && initCheck[0].values[0][0] === 'true';

  let res = db.exec("SELECT * FROM hero_banners ORDER BY display_order ASC, created_at DESC;");
  
  if (!isSeeded && (res.length === 0 || res[0].values.length === 0)) {
    // Auto seed initial defaults
    await saveSqliteHeroBanners(DEFAULT_HERO_SLIDES_INITIAL);
    db.run("INSERT OR REPLACE INTO app_settings (setting_key, setting_value) VALUES ('hero_banners_seeded', 'true');");
    saveSqliteDb(db);
    res = db.exec("SELECT * FROM hero_banners ORDER BY display_order ASC, created_at DESC;");
  } else if (!isSeeded) {
    db.run("INSERT OR REPLACE INTO app_settings (setting_key, setting_value) VALUES ('hero_banners_seeded', 'true');");
    saveSqliteDb(db);
  }

  if (res.length === 0 || res[0].values.length === 0) {
    return [];
  }

  const cols = res[0].columns;
  return res[0].values.map((row) => {
    const obj: any = {};
    cols.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return {
      ...obj,
      display_order: Number(obj.display_order || 0),
      displayOrder: Number(obj.display_order || 0),
      overlay_enabled: Boolean(obj.overlay_enabled),
      overlayEnabled: Boolean(obj.overlay_enabled),
      overlay_opacity: Number(obj.overlay_opacity ?? 0.5),
      overlayOpacity: Number(obj.overlay_opacity ?? 0.5),
      is_active: Boolean(obj.is_active),
      active: Boolean(obj.is_active),
    };
  });
}

export async function saveSqliteHeroBanners(banners: any[]): Promise<any[]> {
  const db = await getSqliteDb();
  db.run("DELETE FROM hero_banners;");
  db.run("INSERT OR REPLACE INTO app_settings (setting_key, setting_value) VALUES ('hero_banners_seeded', 'true');");
  const stmt = db.prepare(`
    INSERT INTO hero_banners (
      id, title, subtitle, description, badge_text, primary_button_text, primary_button_url,
      secondary_button_text, secondary_button_url, hero_image_url, background_type,
      background_color, background_image_url, background_position, overlay_enabled,
      overlay_color, overlay_opacity, text_color, is_active, display_order, start_date, end_date,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const b of banners) {
    if (!b.id || !b.title) continue;
    stmt.run([
      String(b.id),
      b.title,
      b.subtitle || '',
      b.description || '',
      b.badge_text || b.badgeText || '',
      b.primary_button_text || b.primaryButtonText || 'Shop Collection',
      b.primary_button_url || b.primaryButtonUrl || 'store',
      b.secondary_button_text || b.secondaryButtonText || '',
      b.secondary_button_url || b.secondaryButtonUrl || '',
      b.hero_image_url || b.heroImage || b.imageUrl || '',
      b.background_type || b.backgroundType || 'color',
      b.background_color || b.backgroundColor || '#0f172a',
      b.background_image_url || b.backgroundImage || '',
      b.background_position || b.backgroundPosition || 'center',
      (b.overlay_enabled !== undefined ? b.overlay_enabled : (b.overlayEnabled !== false)) ? 1 : 0,
      b.overlay_color || b.overlayColor || '#000000',
      typeof b.overlay_opacity === 'number' ? b.overlay_opacity : (typeof b.overlayOpacity === 'number' ? b.overlayOpacity : 0.5),
      b.text_color || b.textColor || '#ffffff',
      (b.is_active !== undefined ? b.is_active : (b.active !== false)) ? 1 : 0,
      Number(b.display_order || b.displayOrder || 1),
      b.start_date || b.startDate || null,
      b.end_date || b.endDate || null,
      b.created_at || b.createdAt || new Date().toISOString(),
      b.updated_at || b.updatedAt || new Date().toISOString(),
    ]);
  }
  stmt.free();
  saveSqliteDb(db);
  return getAllSqliteHeroBanners();
}
