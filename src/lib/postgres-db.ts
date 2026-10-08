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

export function isPostgresConfigured(): boolean {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  const isPostgresUrl = databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://');
  const host = process.env.POSTGRES_HOST || process.env.PGHOST || '';
  const user = process.env.POSTGRES_USER || process.env.PGUSER || '';
  const database = process.env.POSTGRES_DB || process.env.PGDATABASE || '';
  return isPostgresUrl || !!(host && user && database);
}

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
        has_variants BOOLEAN DEFAULT FALSE,
        options JSONB,
        color_images JSONB,
        variant_matrix JSONB,
        variants JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT FALSE;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS options JSONB;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS color_images JSONB;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_matrix JSONB;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS variants JSONB;
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
        checkout_channel VARCHAR(50) DEFAULT 'web',
        payment_method VARCHAR(50) DEFAULT 'cod',
        payment_reference VARCHAR(255),
        payment_status VARCHAR(50) DEFAULT 'Pending',
        tracking_number VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_channel VARCHAR(50) DEFAULT 'web';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_confirmed BOOLEAN DEFAULT FALSE;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_person VARCHAR(255);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_note TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_history JSONB;
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

    // 6. Email Logs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id VARCHAR(255) PRIMARY KEY,
        recipient VARCHAR(255) NOT NULL,
        email_type VARCHAR(100) NOT NULL,
        subject TEXT NOT NULL,
        status VARCHAR(50) NOT NULL,
        attempts INT DEFAULT 1,
        error_message TEXT,
        related_order_id VARCHAR(255),
        related_user_id VARCHAR(255),
        dedupe_key VARCHAR(255) UNIQUE,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        sent_at TIMESTAMPTZ
      );
    `);

    // 7. Email Jobs Queue Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_jobs (
        id VARCHAR(255) PRIMARY KEY,
        email_type VARCHAR(100) NOT NULL,
        recipient VARCHAR(255) NOT NULL,
        subject TEXT NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'queued',
        attempts INT DEFAULT 0,
        max_attempts INT DEFAULT 5,
        next_attempt_at TIMESTAMPTZ NOT NULL,
        error_message TEXT,
        dedupe_key VARCHAR(255) UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_email_jobs_status_next_attempt ON email_jobs(status, next_attempt_at);
    `);

    // 8. Payment Submissions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_submissions (
        id VARCHAR(255) PRIMARY KEY,
        order_id VARCHAR(255) NOT NULL,
        mpesa_receipt_code VARCHAR(100) UNIQUE NOT NULL,
        phone_number VARCHAR(50) NOT NULL,
        amount_claimed NUMERIC(15, 2),
        payment_method VARCHAR(50) DEFAULT 'mpesa_paybill',
        status VARCHAR(50) DEFAULT 'pending_verification',
        admin_notes TEXT,
        submitted_at TIMESTAMPTZ DEFAULT NOW(),
        verified_at TIMESTAMPTZ,
        verified_by VARCHAR(255)
      );
    `);

    // 9. Users Table (Ensure created before foreign keys)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(150) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name VARCHAR(150) DEFAULT '',
        last_name VARCHAR(150) DEFAULT '',
        phone VARCHAR(100) DEFAULT '',
        is_staff INT DEFAULT 0,
        is_superuser INT DEFAULT 0,
        email_verified INT DEFAULT 1,
        avatar_url TEXT DEFAULT '',
        referral_code VARCHAR(50),
        partner_tier VARCHAR(50) DEFAULT 'Silver',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pg_users_email_unique ON users(LOWER(email));
    `);

    // 10. Password Reset Tokens Table (with foreign key to users)
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        user_email VARCHAR(255),
        ip_address VARCHAR(100),
        CONSTRAINT fk_pg_pwd_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
      CREATE INDEX IF NOT EXISTS idx_pg_pwd_reset_user_id ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_pg_pwd_reset_expires_at ON password_reset_tokens(expires_at);
      CREATE INDEX IF NOT EXISTS idx_pg_pwd_reset_token_hash ON password_reset_tokens(token_hash);
    `);

    // 10. User Verifications Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_verifications (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 11. Email Preferences Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_preferences (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        allow_marketing INT DEFAULT 1,
        allow_review_requests INT DEFAULT 1,
        allow_abandoned_cart INT DEFAULT 1,
        allow_price_drop INT DEFAULT 1,
        unsubscribed_all INT DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 12. Scheduled Task Logs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS scheduled_task_logs (
        id VARCHAR(255) PRIMARY KEY,
        task_name VARCHAR(100) NOT NULL,
        dedupe_key VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW(),
        status VARCHAR(50) NOT NULL,
        details TEXT
      );
    `);

    // 14. Pending Registrations Table (with unique email constraint)
    await client.query(`
      CREATE TABLE IF NOT EXISTS pending_registrations (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(150) NOT NULL,
        first_name VARCHAR(150) DEFAULT '',
        last_name VARCHAR(150) DEFAULT '',
        password_hash TEXT NOT NULL,
        phone VARCHAR(100) DEFAULT '',
        otp_hash VARCHAR(255) NOT NULL,
        otp_expires_at TIMESTAMPTZ NOT NULL,
        attempts INT DEFAULT 0,
        max_attempts INT DEFAULT 5,
        last_sent_at TIMESTAMPTZ DEFAULT NOW(),
        resend_count INT DEFAULT 0,
        resend_window_start TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        ip_address VARCHAR(100)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pg_pending_registrations_email ON pending_registrations(LOWER(email));
    `);

    // 15. Audit Flagged Duplicate Accounts Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_flagged_duplicate_accounts (
        id VARCHAR(255) PRIMARY KEY,
        source_table VARCHAR(100) NOT NULL,
        record_id VARCHAR(255) NOT NULL,
        original_email VARCHAR(255) NOT NULL,
        normalized_email VARCHAR(255) NOT NULL,
        flagged_at TIMESTAMPTZ DEFAULT NOW(),
        resolution_status VARCHAR(50) DEFAULT 'pending_review',
        admin_notes TEXT
      );
    `);

    // Orders safe migrations
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(15, 2);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_confirmed_by VARCHAR(255);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reminder_count INT DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_payment_reminder_at TIMESTAMPTZ;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_cancel_at TIMESTAMPTZ;
    `);

    console.log('[PostgreSQL] Database tables & email system tables initialized successfully.');
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
           (id, sku, name, description, price, category, tags, type, image_url, images, stock, low_stock_threshold, variations, rating, reviews_count, reviews, digital_file_url, previous_price, back_in_stock_alert, cost_price, tax_id, status, payment_restriction, short_description, detailed_description, features, specifications, whats_in_the_box, has_variants, options, color_images, variant_matrix, variants)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)`,
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
            (p.costPrice !== undefined && p.costPrice !== null && p.costPrice !== '')
              ? Number(p.costPrice)
              : (p.cost_price !== undefined && p.cost_price !== null && p.cost_price !== '')
              ? Number(p.cost_price)
              : null,
            p.taxId || null,
            p.status || 'Active',
            p.paymentRestriction || 'both',
            p.shortDescription || null,
            p.detailedDescription || null,
            JSON.stringify(p.features || []),
            JSON.stringify(p.specifications || []),
            p.whatsInTheBox || null,
            p.hasVariants !== undefined ? Boolean(p.hasVariants) : (p.has_variants !== undefined ? Boolean(p.has_variants) : ((p.options && p.options.length > 0) || (p.variantMatrix && p.variantMatrix.length > 0) || (p.variants && p.variants.length > 0))),
            JSON.stringify(p.options || []),
            JSON.stringify(p.colorImages || p.color_images || {}),
            JSON.stringify(p.variantMatrix || p.variant_matrix || p.variants || []),
            JSON.stringify(p.variants || p.variantMatrix || p.variant_matrix || []),
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
           (id, customer_name, customer_email, customer_phone, delivery_address, items, subtotal, discount, shipping_fee, tax_amount, total, status, checkout_channel, payment_method, payment_status, tracking_number, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
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
            o.checkoutChannel || (o.checkoutMode === 'whatsapp' || o.paymentMethod === 'whatsapp' ? 'whatsapp' : 'web'),
            o.paymentMethod === 'whatsapp' ? 'mpesa' : (o.paymentMethod || 'cod'),
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
      costPrice: p.cost_price !== null && p.cost_price !== undefined ? Number(p.cost_price) : undefined,
      cost_price: p.cost_price !== null && p.cost_price !== undefined ? Number(p.cost_price) : undefined,
      taxId: p.tax_id || undefined,
      status: p.status || 'Active',
      paymentRestriction: p.payment_restriction || 'both',
      shortDescription: p.short_description || undefined,
      detailedDescription: p.detailed_description || undefined,
      features: p.features || [],
      specifications: p.specifications || [],
      whatsInTheBox: p.whats_in_the_box || undefined,
      hasVariants: Boolean(p.has_variants === true || p.hasVariants === true || p.has_variants === 1 || p.hasVariants === 1 || p.has_variants === 'true' || p.hasVariants === 'true' || (Array.isArray(p.options) && p.options.length > 0) || (Array.isArray(p.variant_matrix) && p.variant_matrix.length > 0) || (Array.isArray(p.variantMatrix) && p.variantMatrix.length > 0) || (Array.isArray(p.variants) && p.variants.length > 0) || (Array.isArray(p.variations) && p.variations.length > 0)),
      has_variants: Boolean(p.has_variants === true || p.hasVariants === true || p.has_variants === 1 || p.hasVariants === 1 || p.has_variants === 'true' || p.hasVariants === 'true' || (Array.isArray(p.options) && p.options.length > 0) || (Array.isArray(p.variant_matrix) && p.variant_matrix.length > 0) || (Array.isArray(p.variantMatrix) && p.variantMatrix.length > 0) || (Array.isArray(p.variants) && p.variants.length > 0) || (Array.isArray(p.variations) && p.variations.length > 0)),
      options: p.options || [],
      colorImages: p.color_images || p.colorImages || {},
      color_images: p.color_images || p.colorImages || {},
      variantMatrix: p.variant_matrix || p.variantMatrix || p.variants || [],
      variant_matrix: p.variant_matrix || p.variantMatrix || p.variants || [],
      variants: p.variants || p.variant_matrix || p.variantMatrix || [],
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
      checkoutChannel: o.checkout_channel || (o.payment_method === 'whatsapp' ? 'whatsapp' : 'web'),
      paymentMethod: o.payment_method === 'whatsapp' ? 'mpesa' : o.payment_method,
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

export async function getPostgresUserByEmail(email: string): Promise<any | null> {
  const pool = getPostgresPool();
  if (!pool) return null;
  const normalized = email.trim().toLowerCase();
  const res = await pool.query('SELECT * FROM users WHERE LOWER(TRIM(email)) = $1 LIMIT 1', [normalized]);
  if (res.rows.length === 0) return null;
  return res.rows[0];
}

export async function getPostgresUserById(userId: string): Promise<any | null> {
  const pool = getPostgresPool();
  if (!pool) return null;
  const res = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId]);
  if (res.rows.length === 0) return null;
  return res.rows[0];
}

export async function updatePostgresUserPasswordById(
  userId: string,
  newPasswordHash: string,
  nowIso: string = new Date().toISOString()
): Promise<boolean> {
  const pool = getPostgresPool();
  if (!pool || !userId) return false;
  const res = await pool.query('UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3', [
    newPasswordHash,
    nowIso,
    userId,
  ]);
  return (res.rowCount || 0) > 0;
}

export async function createPostgresPasswordResetToken(data: {
  id?: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt?: string;
  userEmail?: string;
  ipAddress?: string;
}): Promise<any> {
  const pool = getPostgresPool();
  if (!pool) throw new Error('PostgreSQL pool not available');

  const id = data.id || `prt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = data.createdAt || new Date().toISOString();

  // Invalidate previous active requests for this user_id
  await pool.query('UPDATE password_reset_tokens SET used_at = $1 WHERE user_id = $2 AND used_at IS NULL', [nowIso, data.userId]);

  await pool.query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at, user_email, ip_address)
     VALUES ($1, $2, $3, $4, NULL, $5, $6, $7)`,
    [id, data.userId, data.tokenHash, data.expiresAt, nowIso, data.userEmail || null, data.ipAddress || null]
  );

  return {
    id,
    user_id: data.userId,
    token_hash: data.tokenHash,
    expires_at: data.expiresAt,
    used_at: null,
    created_at: nowIso,
    user_email: data.userEmail,
    ip_address: data.ipAddress
  };
}

export async function invalidatePreviousPostgresUserTokens(userId: string): Promise<void> {
  const pool = getPostgresPool();
  if (!pool || !userId) return;
  const nowIso = new Date().toISOString();
  await pool.query('UPDATE password_reset_tokens SET used_at = $1 WHERE user_id = $2 AND used_at IS NULL', [nowIso, userId]);
}

export async function getPostgresPasswordResetToken(tokenHash: string): Promise<any | null> {
  const pool = getPostgresPool();
  if (!pool || !tokenHash) return null;
  const res = await pool.query('SELECT * FROM password_reset_tokens WHERE token_hash = $1 LIMIT 1', [tokenHash]);
  if (res.rows.length === 0) return null;
  return res.rows[0];
}

export async function consumePostgresPasswordResetToken(
  tokenHash: string,
  newPasswordHash: string,
  nowIso: string = new Date().toISOString()
): Promise<{ success: boolean; userId?: string; error?: string }> {
  const pool = getPostgresPool();
  if (!pool) throw new Error('PostgreSQL pool not available');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // First find user_id for this valid unexpired token
    const tokenCheck = await client.query(
      'SELECT id, user_id FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2 LIMIT 1',
      [tokenHash, nowIso]
    );

    if (tokenCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'INVALID_OR_EXPIRED_TOKEN' };
    }

    const userId = String(tokenCheck.rows[0].user_id);

    // Conditional atomic single-use update
    const updateTokenRes = await client.query(
      'UPDATE password_reset_tokens SET used_at = $1 WHERE token_hash = $2 AND used_at IS NULL AND expires_at > $3',
      [nowIso, tokenHash, nowIso]
    );

    if (updateTokenRes.rowCount !== 1) {
      await client.query('ROLLBACK');
      return { success: false, error: 'TOKEN_ALREADY_USED_OR_CONCURRENT_UPDATE' };
    }

    // Update password in users table
    await client.query(
      'UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3',
      [newPasswordHash, nowIso, userId]
    );

    await client.query('COMMIT');
    return { success: true, userId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function cleanupExpiredPostgresResetTokens(nowIso: string = new Date().toISOString()): Promise<number> {
  const pool = getPostgresPool();
  if (!pool) return 0;
  const res = await pool.query('DELETE FROM password_reset_tokens WHERE expires_at < $1 OR used_at IS NOT NULL', [nowIso]);
  return res.rowCount || 0;
}

