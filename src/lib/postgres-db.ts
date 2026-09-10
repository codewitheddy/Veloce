/**
 * Production PostgreSQL Database Interface
 * 
 * Supports standard PostgreSQL connections via:
 * - `DATABASE_URL` (e.g. postgres://user:pass@host:5432/dbname)
 * - Or individual variables: `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let pgPool: pg.Pool | null = null;

export function getPostgresPool(): pg.Pool | null {
  if (pgPool) return pgPool;

  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  const isPostgresUrl = databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://');

  const host = process.env.POSTGRES_HOST || process.env.PGHOST || (isPostgresUrl ? undefined : '');
  const user = process.env.POSTGRES_USER || process.env.PGUSER || '';
  const password = process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || '';
  const database = process.env.POSTGRES_DB || process.env.PGDATABASE || '';
  const port = Number(process.env.POSTGRES_PORT || process.env.PGPORT) || 5432;

  if (isPostgresUrl) {
    try {
      pgPool = new Pool({
        connectionString: databaseUrl,
        ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      return pgPool;
    } catch (err) {
      console.error('[PostgreSQL] Failed to initialize connection pool with DATABASE_URL:', err);
      return null;
    }
  }

  if (host && user && database) {
    try {
      pgPool = new Pool({
        host,
        user,
        password,
        database,
        port,
        ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      return pgPool;
    } catch (err) {
      console.error('[PostgreSQL] Failed to initialize connection pool:', err);
      return null;
    }
  }

  return null;
}

export async function initPostgresTables(): Promise<void> {
  const pool = getPostgresPool();
  if (!pool) return;

  const client = await pool.connect();
  try {
    // 1. Products Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(255) PRIMARY KEY,
        sku VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price NUMERIC(15, 2) NOT NULL,
        category VARCHAR(255),
        tags JSONB,
        type VARCHAR(50) DEFAULT 'physical',
        image_url TEXT,
        images JSONB,
        stock INT,
        low_stock_threshold INT,
        variations JSONB,
        rating NUMERIC(3, 2) DEFAULT 0,
        reviews_count INT DEFAULT 0,
        reviews JSONB,
        digital_file_url TEXT,
        previous_price NUMERIC(15, 2),
        back_in_stock_alert BOOLEAN DEFAULT FALSE,
        cost_price NUMERIC(15, 2),
        tax_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Active',
        payment_restriction VARCHAR(50) DEFAULT 'both',
        short_description TEXT,
        detailed_description TEXT,
        features JSONB,
        specifications JSONB,
        whats_in_the_box TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Categories Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        parent_id VARCHAR(255),
        description TEXT,
        image_url TEXT,
        status VARCHAR(50) DEFAULT 'active',
        display_order INT DEFAULT 0,
        previous_slugs JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Orders Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255),
        customer_name VARCHAR(255),
        customer_email VARCHAR(255),
        customer_phone VARCHAR(255),
        delivery_address TEXT,
        city VARCHAR(255),
        postal_code VARCHAR(50),
        items JSONB NOT NULL,
        subtotal NUMERIC(15, 2) NOT NULL,
        discount NUMERIC(15, 2) DEFAULT 0,
        shipping_fee NUMERIC(15, 2) DEFAULT 0,
        tax_amount NUMERIC(15, 2) DEFAULT 0,
        total NUMERIC(15, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        payment_method VARCHAR(50) DEFAULT 'cod',
        payment_reference VARCHAR(255),
        payment_status VARCHAR(50) DEFAULT 'Pending',
        tracking_number VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 4. Reviews Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id VARCHAR(255) PRIMARY KEY,
        product_id VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        rating INT NOT NULL,
        comment TEXT NOT NULL,
        date TIMESTAMPTZ DEFAULT NOW(),
        verified BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 5. App Settings Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(255) PRIMARY KEY,
        setting_value JSONB,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('[PostgreSQL] Database tables initialized successfully.');
  } catch (err) {
    console.error('[PostgreSQL] Failed to initialize tables:', err);
  } finally {
    client.release();
  }
}

export async function getPostgresDbStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  dbEngine: string;
  message: string;
  stats?: { products: number; orders: number; categories: number; reviews: number };
}> {
  const pool = getPostgresPool();
  if (!pool) {
    return {
      configured: false,
      connected: false,
      dbEngine: 'PostgreSQL',
      message: 'PostgreSQL is not configured. Set DATABASE_URL or POSTGRES_DB in environment.',
    };
  }

  try {
    const client = await pool.connect();
    try {
      const prodRes = await client.query('SELECT COUNT(*) as count FROM products');
      const orderRes = await client.query('SELECT COUNT(*) as count FROM orders');
      const catRes = await client.query('SELECT COUNT(*) as count FROM categories');
      const revRes = await client.query('SELECT COUNT(*) as count FROM reviews');

      return {
        configured: true,
        connected: true,
        dbEngine: 'PostgreSQL',
        message: 'Successfully connected to production PostgreSQL database.',
        stats: {
          products: parseInt(prodRes.rows[0]?.count || '0', 10),
          orders: parseInt(orderRes.rows[0]?.count || '0', 10),
          categories: parseInt(catRes.rows[0]?.count || '0', 10),
          reviews: parseInt(revRes.rows[0]?.count || '0', 10),
        },
      };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      dbEngine: 'PostgreSQL',
      message: `Failed to connect to PostgreSQL: ${err.message || err}`,
    };
  }
}

export async function pushSyncDataPostgres(payload: Record<string, any>): Promise<void> {
  const pool = getPostgresPool();
  if (!pool) throw new Error('PostgreSQL is not configured or connected.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Sync Products
    if (Array.isArray(payload.veloce_products)) {
      await client.query('DELETE FROM products');
      for (const p of payload.veloce_products) {
        if (!p.id || !p.name) continue;
        await client.query(
          `INSERT INTO products 
           (id, sku, name, description, price, category, tags, type, image_url, images, stock, low_stock_threshold, variations, rating, reviews_count, reviews, digital_file_url, previous_price, back_in_stock_alert, cost_price, tax_id, status, payment_restriction, short_description, detailed_description, features, specifications, whats_in_the_box)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)`,
          [
            p.id,
            p.sku || null,
            p.name,
            p.description || null,
            p.price || 0,
            p.category || null,
            JSON.stringify(p.tags || []),
            p.type || 'physical',
            p.imageUrl || null,
            JSON.stringify(p.images || []),
            p.stock !== undefined ? p.stock : null,
            p.lowStockThreshold !== undefined ? p.lowStockThreshold : null,
            JSON.stringify(p.variations || []),
            p.rating || 0,
            p.reviewsCount || 0,
            JSON.stringify(p.reviews || []),
            p.digitalFileUrl || null,
            p.previousPrice !== undefined ? p.previousPrice : null,
            Boolean(p.backInStockAlert),
            p.costPrice !== undefined ? p.costPrice : null,
            p.taxId || null,
            p.status || 'Active',
            p.paymentRestriction || 'both',
            p.shortDescription || null,
            p.detailedDescription || null,
            JSON.stringify(p.features || []),
            JSON.stringify(p.specifications || []),
            p.whatsInTheBox || null,
          ]
        );
      }
    }

    // 2. Sync Categories
    if (Array.isArray(payload.veloce_categories) || Array.isArray(payload.categories)) {
      const catList = payload.veloce_categories || payload.categories;
      await client.query('DELETE FROM categories');
      for (const c of catList) {
        if (!c.id || !c.name) continue;
        await client.query(
          `INSERT INTO categories 
           (id, name, slug, parent_id, description, image_url, status, display_order, previous_slugs)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            c.id,
            c.name,
            c.slug || c.id,
            c.parentId || null,
            c.description || null,
            c.imageUrl || null,
            c.status || 'active',
            c.displayOrder || 0,
            JSON.stringify(c.previousSlugs || []),
          ]
        );
      }
    }

    // 3. Sync Orders
    if (Array.isArray(payload.veloce_orders)) {
      await client.query('DELETE FROM orders');
      for (const o of payload.veloce_orders) {
        if (!o.id) continue;
        await client.query(
          `INSERT INTO orders 
           (id, customer_name, customer_email, customer_phone, delivery_address, items, subtotal, discount, shipping_fee, tax_amount, total, status, payment_method, payment_status, tracking_number, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            o.id,
            o.customerName || 'Guest Customer',
            o.customerEmail || 'customer@example.com',
            o.customerPhone || null,
            o.deliveryAddress || null,
            JSON.stringify(o.items || []),
            o.subtotal || 0,
            o.discount || 0,
            o.shippingFee || 0,
            o.taxAmount || 0,
            o.total || 0,
            o.status || 'Pending',
            o.paymentMethod || 'cod',
            o.paymentStatus || 'Pending',
            o.trackingNumber || null,
            o.notes || null,
          ]
        );
      }
    }

    await client.query('COMMIT');
    console.log('[PostgreSQL] Production push synchronization successfully completed.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PostgreSQL] Push synchronization failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

export async function pullSyncDataPostgres(): Promise<Record<string, any>> {
  const pool = getPostgresPool();
  if (!pool) throw new Error('PostgreSQL is not configured or connected.');

  const client = await pool.connect();
  const result: Record<string, any> = {};

  try {
    // 1. Get Products
    const prodRes = await client.query('SELECT * FROM products ORDER BY name ASC');
    result.veloce_products = prodRes.rows.map((p: any) => ({
      id: p.id,
      sku: p.sku || undefined,
      name: p.name,
      description: p.description || '',
      price: Number(p.price),
      category: p.category || '',
      tags: p.tags || [],
      type: p.type || 'physical',
      imageUrl: p.image_url || '',
      images: p.images || [],
      stock: p.stock !== null ? Number(p.stock) : undefined,
      lowStockThreshold: p.low_stock_threshold !== null ? Number(p.low_stock_threshold) : undefined,
      variations: p.variations || [],
      rating: Number(p.rating || 0),
      reviewsCount: Number(p.reviews_count || 0),
      reviews: p.reviews || [],
      digitalFileUrl: p.digital_file_url || undefined,
      previousPrice: p.previous_price !== null ? Number(p.previous_price) : undefined,
      backInStockAlert: Boolean(p.back_in_stock_alert),
      costPrice: p.cost_price !== null ? Number(p.cost_price) : undefined,
      taxId: p.tax_id || undefined,
      status: p.status || 'Active',
      paymentRestriction: p.payment_restriction || 'both',
      shortDescription: p.short_description || undefined,
      detailedDescription: p.detailed_description || undefined,
      features: p.features || [],
      specifications: p.specifications || [],
      whatsInTheBox: p.whats_in_the_box || undefined,
    }));

    // 2. Get Categories
    const catRes = await client.query('SELECT * FROM categories ORDER BY display_order ASC, name ASC');
    result.veloce_categories = catRes.rows.map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentId: c.parent_id || undefined,
      description: c.description || '',
      imageUrl: c.image_url || '',
      status: c.status || 'active',
      displayOrder: Number(c.display_order || 0),
      previousSlugs: c.previous_slugs || [],
    }));

    // 3. Get Orders
    const orderRes = await client.query('SELECT * FROM orders ORDER BY created_at DESC');
    result.veloce_orders = orderRes.rows.map((o: any) => ({
      id: o.id,
      customerName: o.customer_name,
      customerEmail: o.customer_email,
      customerPhone: o.customer_phone || undefined,
      deliveryAddress: o.delivery_address || undefined,
      items: o.items || [],
      subtotal: Number(o.subtotal),
      discount: Number(o.discount || 0),
      shippingFee: Number(o.shipping_fee || 0),
      taxAmount: Number(o.tax_amount || 0),
      total: Number(o.total),
      status: o.status,
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_status,
      trackingNumber: o.tracking_number || undefined,
      notes: o.notes || undefined,
      createdAt: o.created_at,
    }));

    return result;
  } finally {
    client.release();
  }
}
