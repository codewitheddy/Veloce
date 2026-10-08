/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import {
  Supplier,
  SupplierProduct,
  SupplierIntakeBatch,
  SupplierPayment,
  SupplierLedgerEntry,
  SupplierStatement,
  SupplierDashboardMetrics,
  SupplierReportData
} from '../types/supplier';

const DB_FILE_PATH = path.join(process.cwd(), 'veloce.sqlite');

let dbInstance: Database | null = null;
let lastLoadedMtime = 0;
let isInitializing = false;

// Save SQLite database to local disk
export function saveSqliteDb(db: Database = dbInstance!): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE_PATH, buffer);
    try {
      lastLoadedMtime = fs.statSync(DB_FILE_PATH).mtimeMs;
    } catch (_) {}
  } catch (err) {
    console.error('[SQLite] Failed to persist database to disk:', err);
  }
}

// Force reload SQLite database from disk
export async function reloadSqliteDbFromDisk(): Promise<Database> {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE_PATH)) {
    const fileBuffer = fs.readFileSync(DB_FILE_PATH);
    if (fileBuffer.length > 0) {
      dbInstance = new SQL.Database(fileBuffer);
      lastLoadedMtime = fs.statSync(DB_FILE_PATH).mtimeMs;
      console.log(`[SQLite] Reloaded database from disk (${fileBuffer.length} bytes)`);
      return dbInstance;
    }
  }
  return getSqliteDb();
}

// Get or initialize SQLite database instance
export async function getSqliteDb(forceReload: boolean = false): Promise<Database> {
  const SQL = await initSqlJs();

  // If already instantiated, check if disk file was modified externally
  if (dbInstance && !forceReload) {
    if (fs.existsSync(DB_FILE_PATH)) {
      try {
        const stat = fs.statSync(DB_FILE_PATH);
        // If file on disk has newer mtime than our last loaded/saved mtime (with 100ms tolerance)
        if (stat.mtimeMs > lastLoadedMtime + 100) {
          const fileBuffer = fs.readFileSync(DB_FILE_PATH);
          if (fileBuffer.length > 0) {
            dbInstance = new SQL.Database(fileBuffer);
            lastLoadedMtime = stat.mtimeMs;
            console.log(`[SQLite] Hot-reloaded external changes from disk (${fileBuffer.length} bytes)`);
            return dbInstance;
          }
        }
      } catch (_) {
        // Fall back to existing dbInstance
      }
    }
    return dbInstance;
  }

  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE_PATH);
      if (fileBuffer.length > 0) {
        dbInstance = new SQL.Database(fileBuffer);
        lastLoadedMtime = fs.statSync(DB_FILE_PATH).mtimeMs;
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
  try {
    db.run("PRAGMA foreign_keys = ON;");
  } catch (_) {}

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
      brand TEXT,
      countryOfOrigin TEXT,
      status TEXT DEFAULT 'Active',
      paymentRestriction TEXT DEFAULT 'both',
      shortDescription TEXT,
      detailedDescription TEXT,
      features TEXT,
      specifications TEXT,
      whatsInTheBox TEXT,
      hasVariants INTEGER DEFAULT 0,
      options TEXT,
      colorImages TEXT,
      variantMatrix TEXT,
      variants TEXT
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
      checkoutChannel TEXT DEFAULT 'web',
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

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      user INTEGER,
      is_registered INTEGER DEFAULT 0,
      first_name TEXT DEFAULT '',
      last_name TEXT DEFAULT '',
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT DEFAULT '',
      company TEXT DEFAULT '',
      location TEXT DEFAULT '',
      orders_count INTEGER DEFAULT 0,
      total_spent REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      notes TEXT DEFAULT '',
      open_deal_value REAL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      customer TEXT NOT NULL,
      customer_name TEXT,
      title TEXT NOT NULL,
      value REAL DEFAULT 0,
      stage TEXT DEFAULT 'prospecting',
      expected_close TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      customer TEXT NOT NULL,
      customer_name TEXT,
      order_id TEXT,
      order_reference TEXT,
      amount REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      due_date TEXT,
      issued_at TEXT
    );

    CREATE TABLE IF NOT EXISTS customer_orders (
      id TEXT PRIMARY KEY,
      reference TEXT,
      customer TEXT NOT NULL,
      customer_name TEXT,
      customer_email TEXT,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      placed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      company_name TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      physical_address TEXT DEFAULT '',
      tax_pin TEXT DEFAULT '',
      payment_terms TEXT DEFAULT 'Consignment Sale',
      bank_name TEXT DEFAULT '',
      bank_account_number TEXT DEFAULT '',
      mpesa_number TEXT DEFAULT '',
      mpesa_account_name TEXT DEFAULT '',
      status TEXT DEFAULT 'Active',
      notes TEXT DEFAULT '',
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS supplier_products (
      id TEXT PRIMARY KEY,
      supplier TEXT NOT NULL,
      product TEXT NOT NULL,
      product_name TEXT NOT NULL,
      product_sku TEXT DEFAULT '',
      product_image_url TEXT DEFAULT '',
      product_category TEXT DEFAULT '',
      product_stock INTEGER DEFAULT 0,
      supplier_sku TEXT DEFAULT '',
      agreed_cost_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      quantity_received INTEGER DEFAULT 0,
      quantity_sold INTEGER DEFAULT 0,
      remaining_stock INTEGER DEFAULT 0,
      lead_time_days INTEGER DEFAULT 3,
      is_primary_supplier INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS supplier_intakes (
      id TEXT PRIMARY KEY,
      batch_number TEXT NOT NULL,
      supplier TEXT NOT NULL,
      supplier_name TEXT DEFAULT '',
      supplier_company TEXT DEFAULT '',
      product TEXT,
      product_name TEXT NOT NULL,
      product_sku TEXT DEFAULT '',
      quantity_received INTEGER NOT NULL,
      unit_cost REAL NOT NULL,
      total_cost REAL NOT NULL,
      received_date TEXT NOT NULL,
      delivery_note_ref TEXT DEFAULT '',
      invoice_ref TEXT DEFAULT '',
      status TEXT DEFAULT 'Received',
      notes TEXT DEFAULT '',
      received_by TEXT DEFAULT 'Inventory Manager',
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id TEXT PRIMARY KEY,
      payment_reference TEXT NOT NULL,
      supplier TEXT NOT NULL,
      supplier_name TEXT DEFAULT '',
      supplier_company TEXT DEFAULT '',
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      transaction_code TEXT DEFAULT '',
      settlement_period_start TEXT,
      settlement_period_end TEXT,
      allocated_batches_or_orders TEXT DEFAULT '[]',
      status TEXT DEFAULT 'Completed',
      receipt_attachment_url TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      processed_by TEXT DEFAULT 'Finance Controller',
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS supplier_ledger (
      id TEXT PRIMARY KEY,
      supplier TEXT NOT NULL,
      supplier_name TEXT DEFAULT '',
      entry_type TEXT NOT NULL,
      reference_id TEXT DEFAULT '',
      description TEXT DEFAULT '',
      debit_amount REAL DEFAULT 0,
      credit_amount REAL DEFAULT 0,
      running_balance REAL DEFAULT 0,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      recipient TEXT NOT NULL,
      email_type TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER DEFAULT 1,
      error_message TEXT,
      related_order_id TEXT,
      related_user_id TEXT,
      dedupe_key TEXT UNIQUE,
      metadata TEXT,
      created_at TEXT NOT NULL,
      sent_at TEXT
    );

    CREATE TABLE IF NOT EXISTS email_jobs (
      id TEXT PRIMARY KEY,
      email_type TEXT NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 5,
      next_attempt_at TEXT NOT NULL,
      error_message TEXT,
      dedupe_key TEXT UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_submissions (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      mpesa_receipt_code TEXT UNIQUE NOT NULL,
      phone_number TEXT NOT NULL,
      amount_claimed REAL,
      payment_method TEXT DEFAULT 'mpesa_paybill',
      status TEXT DEFAULT 'pending_verification',
      admin_notes TEXT,
      submitted_at TEXT NOT NULL,
      verified_at TEXT,
      verified_by TEXT
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL,
      user_email TEXT,
      ip_address TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_pwd_reset_user_id ON password_reset_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_pwd_reset_expires_at ON password_reset_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_pwd_reset_token_hash ON password_reset_tokens(token_hash);

    CREATE TABLE IF NOT EXISTS user_verifications (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      verified_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_preferences (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      allow_marketing INTEGER DEFAULT 1,
      allow_review_requests INTEGER DEFAULT 1,
      allow_abandoned_cart INTEGER DEFAULT 1,
      allow_price_drop INTEGER DEFAULT 1,
      unsubscribed_all INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scheduled_task_logs (
      id TEXT PRIMARY KEY,
      task_name TEXT NOT NULL,
      dedupe_key TEXT UNIQUE NOT NULL,
      executed_at TEXT NOT NULL,
      status TEXT NOT NULL,
      details TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT DEFAULT '',
      last_name TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      is_staff INTEGER DEFAULT 0,
      is_superuser INTEGER DEFAULT 0,
      email_verified INTEGER DEFAULT 1,
      avatar_url TEXT DEFAULT '',
      referral_code TEXT,
      partner_tier TEXT DEFAULT 'Silver',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_registrations (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      username TEXT NOT NULL,
      first_name TEXT DEFAULT '',
      last_name TEXT DEFAULT '',
      password_hash TEXT NOT NULL,
      phone TEXT DEFAULT '',
      otp_hash TEXT NOT NULL,
      otp_expires_at TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 5,
      last_sent_at TEXT NOT NULL,
      resend_count INTEGER DEFAULT 0,
      resend_window_start TEXT NOT NULL,
      created_at TEXT NOT NULL,
      ip_address TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_flagged_duplicate_accounts (
      id TEXT PRIMARY KEY,
      source_table TEXT NOT NULL,
      record_id TEXT NOT NULL,
      original_email TEXT NOT NULL,
      normalized_email TEXT NOT NULL,
      flagged_at TEXT NOT NULL,
      resolution_status TEXT DEFAULT 'pending_review',
      admin_notes TEXT
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      ip_address TEXT
    );

    CREATE TABLE IF NOT EXISTS carts (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE,
      session_id TEXT,
      items TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wishlists (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      product_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS custom_clothing_requests (
      id TEXT PRIMARY KEY,
      reference_no TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      garment_type TEXT NOT NULL,
      other_garment_type TEXT,
      material_samples TEXT,
      design_images TEXT,
      design_videos TEXT,
      design_links TEXT,
      measurements TEXT,
      preferred_deadline TEXT,
      budget_range TEXT,
      additional_notes TEXT,
      delivery_location TEXT,
      status TEXT DEFAULT 'Pending Review',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_request_logs (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      customer_email TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      status TEXT DEFAULT 'sent',
      product_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_request_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL
    );
  `);

  try { db.run("CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);"); } catch {}
  try { db.run("ALTER TABLE password_reset_tokens ADD COLUMN user_id TEXT;"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_pwd_reset_user_id ON password_reset_tokens(user_id);"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_pwd_reset_expires_at ON password_reset_tokens(expires_at);"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_pwd_reset_token_hash ON password_reset_tokens(token_hash);"); } catch {}

  // Order workflow and delivery confirmation columns
  try { db.run("ALTER TABLE orders ADD COLUMN isPaid INTEGER DEFAULT 0;"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN paidAt TEXT;"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN deliveryConfirmed INTEGER DEFAULT 0;"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN deliveredAt TEXT;"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN deliveryPerson TEXT;"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN deliveryNote TEXT;"); } catch {}

  // Pre-migration: Audit existing duplicate emails and flag them for review before creating UNIQUE index
  try {
    const dupRes = db.exec(`
      SELECT LOWER(TRIM(email)) as norm_email, COUNT(*) as cnt 
      FROM users 
      WHERE email IS NOT NULL AND email != '' 
      GROUP BY LOWER(TRIM(email)) 
      HAVING cnt > 1;
    `);

    if (dupRes.length > 0 && dupRes[0].values.length > 0) {
      for (const row of dupRes[0].values) {
        const normEmail = String(row[0]);
        console.warn(`[Migration Audit] Found duplicate email "${normEmail}" in users table.`);
        
        const safeQuery = `SELECT id, email, created_at FROM users WHERE LOWER(TRIM(email)) = '${normEmail.replace(/'/g, "''")}';`;
        const recRes = db.exec(safeQuery);
        if (recRes.length > 0 && recRes[0].values.length > 1) {
          const rows = recRes[0].values;
          for (let i = 1; i < rows.length; i++) {
            const dupId = String(rows[i][0]);
            const origEmail = String(rows[i][1]);
            const flaggedEmail = `${normEmail}+duplicate_flagged_${dupId}`;
            
            db.run(`
              INSERT OR IGNORE INTO audit_flagged_duplicate_accounts (
                id, source_table, record_id, original_email, normalized_email, flagged_at, resolution_status, admin_notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
            `, [
              `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              'users',
              dupId,
              origEmail,
              normEmail,
              new Date().toISOString(),
              'pending_review',
              `Duplicate email detected during unique constraint migration. Renamed to ${flaggedEmail} to preserve data integrity.`
            ]);

            db.run(`UPDATE users SET email = ?, updated_at = ? WHERE id = ?;`, [
              flaggedEmail,
              new Date().toISOString(),
              dupId
            ]);
            console.info(`[Migration Audit] Flagged duplicate user ID ${dupId} (${origEmail} -> ${flaggedEmail}) for review.`);
          }
        }
      }
    }
  } catch (auditErr) {
    console.warn('[Migration Audit Warning]:', auditErr);
  }

  // Enforce unique email constraint via unique indexes
  try { db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email);"); } catch {}
  try { db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_registrations_email ON pending_registrations(email);"); } catch {}

  // Safe schema migrations for new product columns
  try { db.run("ALTER TABLE products ADD COLUMN hasVariants INTEGER DEFAULT 0;"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN options TEXT;"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN colorImages TEXT;"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN variantMatrix TEXT;"); } catch {}
  try { db.run("ALTER TABLE products ADD COLUMN variants TEXT;"); } catch {}
  try {
    db.run("ALTER TABLE products ADD COLUMN brand TEXT;");
  } catch (e) {
    // column already exists
  }
  try {
    db.run("ALTER TABLE products ADD COLUMN countryOfOrigin TEXT;");
  } catch (e) {
    // column already exists
  }
  try {
    db.run("ALTER TABLE orders ADD COLUMN checkoutChannel TEXT DEFAULT 'web';");
  } catch (e) {
    // column already exists
  }
  try {
    db.run("ALTER TABLE orders ADD COLUMN paymentStatus TEXT DEFAULT 'unpaid';");
  } catch (e) {
    // column already exists
  }
  try {
    db.run("ALTER TABLE orders ADD COLUMN paymentReference TEXT;");
  } catch (e) {
    // column already exists
  }
  try {
    db.run("ALTER TABLE orders ADD COLUMN paymentAmount REAL;");
  } catch (e) {
    // column already exists
  }
  try {
    db.run("ALTER TABLE orders ADD COLUMN paymentConfirmedAt TEXT;");
  } catch (e) {
    // column already exists
  }
  try {
    db.run("ALTER TABLE orders ADD COLUMN paymentConfirmedBy TEXT;");
  } catch (e) {
    // column already exists
  }
  try {
    db.run("ALTER TABLE orders ADD COLUMN paymentReminderCount INTEGER DEFAULT 0;");
  } catch (e) {
    // column already exists
  }
  try {
    db.run("ALTER TABLE orders ADD COLUMN lastPaymentReminderAt TEXT;");
  } catch (e) {}
  try {
    db.run("ALTER TABLE orders ADD COLUMN autoCancelAt TEXT;");
  } catch (e) {}

  // Safe schema migrations for customer_orders columns
  try {
    db.run("ALTER TABLE customer_orders ADD COLUMN payment_status TEXT DEFAULT 'unpaid';");
  } catch (e) {}
  try {
    db.run("ALTER TABLE customer_orders ADD COLUMN payment_reference TEXT;");
  } catch (e) {}
  try {
    db.run("ALTER TABLE customer_orders ADD COLUMN payment_amount REAL;");
  } catch (e) {}
  try {
    db.run("ALTER TABLE customer_orders ADD COLUMN payment_confirmed_at TEXT;");
  } catch (e) {}
  try {
    db.run("ALTER TABLE customer_orders ADD COLUMN payment_confirmed_by TEXT;");
  } catch (e) {}
  try {
    db.run("ALTER TABLE customer_orders ADD COLUMN payment_reminder_count INTEGER DEFAULT 0;");
  } catch (e) {}
  try {
    db.run("ALTER TABLE customer_orders ADD COLUMN last_payment_reminder_at TEXT;");
  } catch (e) {}
  try {
    db.run("ALTER TABLE customer_orders ADD COLUMN auto_cancel_at TEXT;");
  } catch (e) {}
  try {
    db.run("ALTER TABLE customer_orders ADD COLUMN created_at TEXT;");
  } catch (e) {}

  // Safe schema migrations for orders columns
  try { db.run("ALTER TABLE orders ADD COLUMN shippingFee REAL DEFAULT 0;"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN discount REAL DEFAULT 0;"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN subtotal REAL DEFAULT 0;"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN trackingNumber TEXT;"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN customerPhone TEXT;"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN notes TEXT;"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN userId TEXT;"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN created_at TEXT;"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN updated_at TEXT;"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN paymentStatus TEXT DEFAULT 'pending';"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN paymentReference TEXT;"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN paymentAmount REAL;"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN paymentConfirmedAt TEXT;"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN paymentConfirmedBy TEXT;"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN paymentReminderCount INTEGER DEFAULT 0;"); } catch {}
  try { db.run("ALTER TABLE orders ADD COLUMN lastPaymentReminderAt TEXT;"); } catch {}

  // Safe schema migrations for reviews columns
  try { db.run("ALTER TABLE reviews ADD COLUMN reviewerDisplayName TEXT;"); } catch {}
  try { db.run("ALTER TABLE reviews ADD COLUMN title TEXT;"); } catch {}
  try { db.run("ALTER TABLE reviews ADD COLUMN mediaUrls TEXT;"); } catch {}
  try { db.run("ALTER TABLE reviews ADD COLUMN helpfulVotes INTEGER DEFAULT 0;"); } catch {}
  try { db.run("ALTER TABLE reviews ADD COLUMN helpfulUserIds TEXT;"); } catch {}
  try { db.run("ALTER TABLE reviews ADD COLUMN purchasedVariant TEXT;"); } catch {}
  try { db.run("ALTER TABLE reviews ADD COLUMN isEdited INTEGER DEFAULT 0;"); } catch {}
  try { db.run("ALTER TABLE reviews ADD COLUMN status TEXT DEFAULT 'Published';"); } catch {}
  try { db.run("ALTER TABLE reviews ADD COLUMN createdAt TEXT;"); } catch {}
  try { db.run("ALTER TABLE reviews ADD COLUMN updatedAt TEXT;"); } catch {}
  try { db.run("ALTER TABLE reviews ADD COLUMN userId TEXT;"); } catch {}

  // Automatically reset mock ratings on products with 0 real published reviews
  try {
    db.run(`
      UPDATE products 
      SET rating = 0, reviewsCount = 0, reviews = '[]'
      WHERE id NOT IN (
        SELECT DISTINCT productId FROM reviews WHERE status NOT IN ('Hidden', 'Removed')
      );
    `);
  } catch (e) {}

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
        previousPrice, backInStockAlert, costPrice, taxId, brand, countryOfOrigin, status, paymentRestriction,
        shortDescription, detailedDescription, features, specifications, whatsInTheBox,
        hasVariants, options, colorImages, variantMatrix, variants
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of payload.veloce_products) {
      if (!p.id || !p.name) continue;
      const isVar = (
        p.hasVariants === true || p.hasVariants === 1 || p.hasVariants === 'true' ||
        p.has_variants === true || p.has_variants === 1 || p.has_variants === 'true' ||
        (Array.isArray(p.options) && p.options.length > 0) ||
        (Array.isArray(p.variantMatrix) && p.variantMatrix.length > 0) ||
        (Array.isArray(p.variant_matrix) && p.variant_matrix.length > 0) ||
        (Array.isArray(p.variants) && p.variants.length > 0) ||
        (Array.isArray(p.variations) && p.variations.length > 0) ||
        (p.colorImages && typeof p.colorImages === 'object' && Object.keys(p.colorImages).length > 0) ||
        (p.color_images && typeof p.color_images === 'object' && Object.keys(p.color_images).length > 0)
      ) ? 1 : 0;

      const optsJson = p.options ? (typeof p.options === 'string' ? p.options : JSON.stringify(p.options)) : null;
      const colorImgsJson = (p.colorImages || p.color_images) ? (typeof (p.colorImages || p.color_images) === 'string' ? (p.colorImages || p.color_images) : JSON.stringify(p.colorImages || p.color_images)) : null;
      const matrixJson = (p.variantMatrix || p.variant_matrix || p.variants) ? (typeof (p.variantMatrix || p.variant_matrix || p.variants) === 'string' ? (p.variantMatrix || p.variant_matrix || p.variants) : JSON.stringify(p.variantMatrix || p.variant_matrix || p.variants)) : null;
      const varsJson = (p.variants || p.variantMatrix || p.variant_matrix) ? (typeof (p.variants || p.variantMatrix || p.variant_matrix) === 'string' ? (p.variants || p.variantMatrix || p.variant_matrix) : JSON.stringify(p.variants || p.variantMatrix || p.variant_matrix)) : null;

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
        (p.costPrice !== undefined && p.costPrice !== null && p.costPrice !== '')
          ? Number(p.costPrice)
          : (p.cost_price !== undefined && p.cost_price !== null && p.cost_price !== '')
          ? Number(p.cost_price)
          : null,
        p.taxId || null,
        p.brand || null,
        p.countryOfOrigin || p.country_of_origin || null,
        p.status || 'Active',
        p.paymentRestriction || 'both',
        p.shortDescription || null,
        p.detailedDescription || null,
        p.features ? JSON.stringify(p.features) : null,
        p.specifications ? JSON.stringify(p.specifications) : null,
        p.whatsInTheBox || null,
        isVar,
        optsJson,
        colorImgsJson,
        matrixJson,
        varsJson,
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
        checkoutChannel, review_request_sent_at, review_request_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        o.checkoutChannel || (o.checkoutMode === 'whatsapp' || o.paymentMethod === 'whatsapp' ? 'whatsapp' : 'web'),
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

  // 1. Pull Products (Only seed once if database has never been initialized/seeded)
  let prodRes = db.exec("SELECT * FROM products;");
  if (!prodRes.length || !prodRes[0].values || prodRes[0].values.length === 0) {
    const isCleanInit = db.exec("SELECT setting_value FROM app_settings WHERE setting_key = 'products_seeded_clean';");
    if (!isCleanInit.length || !isCleanInit[0].values || isCleanInit[0].values.length === 0) {
      await ensureDefaultProducts(db);
      prodRes = db.exec("SELECT * FROM products;");
    }
  }

  if (prodRes.length > 0) {
    const cols = prodRes[0].columns;
    result.veloce_products = prodRes[0].values.map((row) => {
      const obj: any = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      const parseJsonSafe = (raw: any, fallback: any) => {
        if (!raw) return fallback;
        try {
          return typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch {
          return fallback;
        }
      };

      const parsedOpts = parseJsonSafe(obj.options, []);
      const parsedColorImgs = parseJsonSafe(obj.colorImages || obj.color_images, {});
      const parsedMatrix = parseJsonSafe(obj.variantMatrix || obj.variant_matrix || obj.variants, []);
      const parsedVars = parseJsonSafe(obj.variants || obj.variantMatrix || obj.variant_matrix, []);
      const parsedVariations = parseJsonSafe(obj.variations, []);

      const hasVarBool = Boolean(
        obj.hasVariants === 1 ||
        obj.hasVariants === true ||
        obj.hasVariants === 'true' ||
        obj.has_variants === 1 ||
        obj.has_variants === true ||
        obj.has_variants === 'true' ||
        parsedOpts.length > 0 ||
        parsedMatrix.length > 0 ||
        parsedVars.length > 0 ||
        parsedVariations.length > 0 ||
        Object.keys(parsedColorImgs).length > 0
      );

      return {
        ...obj,
        price: Number(obj.price),
        costPrice: obj.costPrice !== null && obj.costPrice !== undefined && obj.costPrice !== '' ? Number(obj.costPrice) : undefined,
        cost_price: obj.costPrice !== null && obj.costPrice !== undefined && obj.costPrice !== '' ? Number(obj.costPrice) : undefined,
        tags: parseJsonSafe(obj.tags, []),
        images: parseJsonSafe(obj.images, []),
        variations: parsedVariations,
        reviews: parseJsonSafe(obj.reviews, []),
        stock: obj.stock !== null ? Number(obj.stock) : null,
        rating: Number(obj.rating || 0),
        reviewsCount: Number(obj.reviewsCount || 0),
        backInStockAlert: Boolean(obj.backInStockAlert),
        hasVariants: hasVarBool,
        has_variants: hasVarBool,
        options: parsedOpts,
        colorImages: parsedColorImgs,
        color_images: parsedColorImgs,
        variantMatrix: parsedMatrix,
        variant_matrix: parsedMatrix,
        variants: parsedVars,
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
        checkoutChannel: obj.checkoutChannel || (obj.paymentMethod === 'whatsapp' ? 'whatsapp' : 'web'),
        paymentMethod: obj.paymentMethod === 'whatsapp' ? 'mpesa' : (obj.paymentMethod || 'cod'),
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
  
  // If no categories in table, only auto-seed if database has never been initialized/seeded
  if (res.length === 0 || res[0].values.length === 0) {
    const isCleanInit = db.exec("SELECT setting_value FROM app_settings WHERE setting_key = 'categories_seeded_clean';");
    if (!isCleanInit.length || !isCleanInit[0].values || isCleanInit[0].values.length === 0) {
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
    } else {
      return [];
    }
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
  db.run("INSERT OR REPLACE INTO app_settings (setting_key, setting_value) VALUES ('categories_seeded_clean', 'true');");
  
  if (Array.isArray(categories) && categories.length > 0) {
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
  }

  saveSqliteDb(db);
  return getAllSqliteCategories();
}

export async function deleteSqliteCategory(id: string): Promise<boolean> {
  const db = await getSqliteDb();
  db.run("DELETE FROM categories WHERE id = ?;", [id]);
  db.run("INSERT OR REPLACE INTO app_settings (setting_key, setting_value) VALUES ('categories_seeded_clean', 'true');");
  saveSqliteDb(db);
  return true;
}

export async function deleteSqliteCategoriesBulk(ids: string[]): Promise<number> {
  if (!ids || ids.length === 0) return 0;
  const db = await getSqliteDb();
  let deleted = 0;
  for (const id of ids) {
    db.run("DELETE FROM categories WHERE id = ?;", [id]);
    deleted++;
  }
  db.run("INSERT OR REPLACE INTO app_settings (setting_key, setting_value) VALUES ('categories_seeded_clean', 'true');");
  saveSqliteDb(db);
  return deleted;
}

export async function updateSqliteCategoriesBulk(ids: string[], updates: { status?: string; parentId?: string | null }): Promise<number> {
  if (!ids || ids.length === 0) return 0;
  const db = await getSqliteDb();
  let updated = 0;
  const now = new Date().toISOString();
  for (const id of ids) {
    if (updates.status !== undefined) {
      db.run("UPDATE categories SET status = ?, updatedAt = ? WHERE id = ?;", [updates.status, now, id]);
      updated++;
    }
    if (updates.parentId !== undefined) {
      db.run("UPDATE categories SET parentId = ?, updatedAt = ? WHERE id = ?;", [updates.parentId, now, id]);
      updated++;
    }
  }
  db.run("INSERT OR REPLACE INTO app_settings (setting_key, setting_value) VALUES ('categories_seeded_clean', 'true');");
  saveSqliteDb(db);
  return updated;
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
  db.run("DELETE FROM customers;");
  db.run("DELETE FROM deals;");
  db.run("DELETE FROM invoices;");
  db.run("DELETE FROM customer_orders;");
  db.run("DELETE FROM suppliers;");
  db.run("DELETE FROM supplier_products;");
  db.run("DELETE FROM supplier_intakes;");
  db.run("DELETE FROM supplier_payments;");
  db.run("DELETE FROM supplier_ledger;");
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

export async function ensureDefaultHeroBanners(db?: Database): Promise<void> {
  const database = db || (await getSqliteDb());
  const check = database.exec("SELECT COUNT(*) as count FROM hero_banners;");
  const count = check.length > 0 && check[0].values.length > 0 ? (check[0].values[0][0] as number) : 0;
  if (count === 0) {
    await saveSqliteHeroBanners(DEFAULT_HERO_SLIDES_INITIAL);
    console.log('[SQLite] Seeded default hero slides.');
  }
}

export async function getAllSqliteHeroBanners(): Promise<any[]> {
  const db = await getSqliteDb();
  
  let res = db.exec("SELECT * FROM hero_banners ORDER BY display_order ASC, created_at DESC;");
  
  if (res.length === 0 || res[0].values.length === 0) {
    // Auto seed initial defaults whenever hero_banners is empty
    await saveSqliteHeroBanners(DEFAULT_HERO_SLIDES_INITIAL);
    res = db.exec("SELECT * FROM hero_banners ORDER BY display_order ASC, created_at DESC;");
  }

  if (res.length === 0 || res[0].values.length === 0) {
    return DEFAULT_HERO_SLIDES_INITIAL;
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

// ============================================================================
// CRM: Customers, Deals, Invoices, Customer Orders
// ============================================================================

export async function getAllSqliteCustomers(): Promise<any[]> {
  const db = await getSqliteDb();
  
  // 1. Fetch all records from customers CRM table
  const res = db.exec("SELECT * FROM customers ORDER BY created_at DESC;");
  const customersMap = new Map<string, any>();
  
  if (res && res.length) {
    const cols = res[0].columns;
    res[0].values.forEach((row) => {
      const obj: any = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      obj.is_registered = Boolean(obj.is_registered);
      obj.orders_count = Number(obj.orders_count || 0);
      obj.total_spent = Number(obj.total_spent || 0);
      obj.open_deal_value = Number(obj.open_deal_value || 0);
      if (obj.email) {
        customersMap.set(obj.email.toLowerCase().trim(), obj);
      }
      customersMap.set(obj.id, obj);
    });
  }

  // 2. Fetch all registered users from users table (non-admin, non-staff)
  const users = await getAllSqliteUsers();
  const allOrders = await getAllSqliteOrders();

  for (const user of users) {
    if (user.is_staff || user.is_superuser) continue;
    const userEmail = (user.email || '').toLowerCase().trim();
    if (!userEmail) continue;

    // Calculate actual orders and total spent for this user
    const userOrders = allOrders.filter(
      (o: any) =>
        (o.customerEmail && o.customerEmail.toLowerCase().trim() === userEmail) ||
        (o.email && o.email.toLowerCase().trim() === userEmail) ||
        (o.shippingAddress?.email && o.shippingAddress.email.toLowerCase().trim() === userEmail)
    );
    const ordersCount = userOrders.length;
    const totalSpent = userOrders.reduce((sum: number, o: any) => sum + (Number(o.total || o.amount || 0)), 0);

    const existingCustomer = customersMap.get(userEmail);
    if (!existingCustomer) {
      // Auto-create customer record in customers CRM table
      const newCustomer = {
        id: `cust-${user.id}`,
        user: user.id,
        is_registered: true,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || userEmail.split('@')[0],
        email: userEmail,
        phone: user.phone || '',
        company: '',
        location: '',
        orders_count: ordersCount,
        total_spent: totalSpent,
        status: 'Active',
        notes: `Registered customer account (${user.partner_tier || 'Silver'} member)`,
        open_deal_value: 0,
        created_at: user.created_at || new Date().toISOString(),
        updated_at: user.updated_at || new Date().toISOString(),
      };

      try {
        await saveSqliteCustomer(newCustomer);
      } catch (_) {}

      customersMap.set(userEmail, newCustomer);
    } else {
      // Keep customer up-to-date with user registration and order totals
      existingCustomer.is_registered = true;
      if (!existingCustomer.name || existingCustomer.name === 'Unknown Customer') {
        existingCustomer.name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || userEmail.split('@')[0];
      }
      if (!existingCustomer.phone && user.phone) {
        existingCustomer.phone = user.phone;
      }
      if (ordersCount > 0) {
        existingCustomer.orders_count = ordersCount;
        existingCustomer.total_spent = totalSpent;
      }
    }
  }

  // Deduplicate and return unique customers sorted by created_at DESC
  const uniqueList = Array.from(new Set(customersMap.values()));
  return uniqueList.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
}

export async function getSqliteCustomerById(id: string): Promise<any | null> {
  const db = await getSqliteDb();
  const stmt = db.prepare("SELECT * FROM customers WHERE id = ? LIMIT 1;");
  stmt.bind([id]);
  let customer: any = null;
  if (stmt.step()) {
    const row = stmt.getAsObject();
    customer = {
      ...row,
      is_registered: Boolean(row.is_registered),
      orders_count: Number(row.orders_count || 0),
      total_spent: Number(row.total_spent || 0),
      open_deal_value: Number(row.open_deal_value || 0),
    };
  }
  stmt.free();

  if (!customer) return null;

  // Fetch linked deals, invoices, orders
  const dealsStmt = db.prepare("SELECT * FROM deals WHERE customer = ? ORDER BY created_at DESC;");
  dealsStmt.bind([id]);
  const deals: any[] = [];
  while (dealsStmt.step()) {
    const d = dealsStmt.getAsObject();
    deals.push({ ...d, value: Number(d.value || 0) });
  }
  dealsStmt.free();

  const invStmt = db.prepare("SELECT * FROM invoices WHERE customer = ? ORDER BY issued_at DESC;");
  invStmt.bind([id]);
  const invoices: any[] = [];
  while (invStmt.step()) {
    const inv = invStmt.getAsObject();
    invoices.push({ ...inv, amount: Number(inv.amount || 0) });
  }
  invStmt.free();

  const ordStmt = db.prepare("SELECT * FROM customer_orders WHERE customer = ? ORDER BY placed_at DESC;");
  ordStmt.bind([id]);
  const orders: any[] = [];
  while (ordStmt.step()) {
    const ord = ordStmt.getAsObject();
    orders.push({ ...ord, total: Number(ord.total || 0) });
  }
  ordStmt.free();

  return {
    ...customer,
    deals,
    invoices,
    orders,
  };
}

export async function saveSqliteCustomer(c: any): Promise<any> {
  const db = await getSqliteDb();
  const id = c.id || `cust-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO customers (
      id, user, is_registered, first_name, last_name, name, email, phone,
      company, location, orders_count, total_spent, status, notes, open_deal_value,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run([
    id,
    c.user || null,
    c.is_registered ? 1 : 0,
    c.first_name || '',
    c.last_name || '',
    c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown Customer',
    c.email || '',
    c.phone || '',
    c.company || '',
    c.location || '',
    Number(c.orders_count || 0),
    Number(c.total_spent || 0),
    c.status || 'active',
    c.notes || '',
    Number(c.open_deal_value || 0),
    c.created_at || now,
    now,
  ]);
  stmt.free();
  saveSqliteDb(db);
  return getSqliteCustomerById(id);
}

export async function deleteSqliteCustomer(id: string): Promise<boolean> {
  const db = await getSqliteDb();
  db.run("DELETE FROM customers WHERE id = ?;", [id]);
  db.run("DELETE FROM deals WHERE customer = ?;", [id]);
  db.run("DELETE FROM invoices WHERE customer = ?;", [id]);
  db.run("DELETE FROM customer_orders WHERE customer = ?;", [id]);
  saveSqliteDb(db);
  return true;
}

export async function saveSqliteDeal(deal: any): Promise<any> {
  const db = await getSqliteDb();
  const id = deal.id || `deal-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO deals (
      id, customer, customer_name, title, value, stage, expected_close, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run([
    id,
    deal.customer,
    deal.customer_name || '',
    deal.title || 'Untitled Deal',
    Number(deal.value || 0),
    deal.stage || 'prospecting',
    deal.expected_close || null,
    deal.created_at || now,
  ]);
  stmt.free();
  saveSqliteDb(db);
  return { id, ...deal };
}

export async function deleteSqliteDeal(id: string): Promise<boolean> {
  const db = await getSqliteDb();
  db.run("DELETE FROM deals WHERE id = ?;", [id]);
  saveSqliteDb(db);
  return true;
}

export async function saveSqliteInvoice(invoice: any): Promise<any> {
  const db = await getSqliteDb();
  const id = invoice.id || `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO invoices (
      id, customer, customer_name, order_id, order_reference, amount, status, due_date, issued_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run([
    id,
    invoice.customer,
    invoice.customer_name || '',
    invoice.order || invoice.order_id || null,
    invoice.order_reference || '',
    Number(invoice.amount || 0),
    invoice.status || 'draft',
    invoice.due_date || null,
    invoice.issued_at || now,
  ]);
  stmt.free();
  saveSqliteDb(db);
  return { id, ...invoice };
}

export async function deleteSqliteInvoice(id: string): Promise<boolean> {
  const db = await getSqliteDb();
  db.run("DELETE FROM invoices WHERE id = ?;", [id]);
  saveSqliteDb(db);
  return true;
}

export async function saveSqliteCustomerOrder(order: any): Promise<any> {
  const db = await getSqliteDb();
  const id = order.id || `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO customer_orders (
      id, reference, customer, customer_name, customer_email, total, status, placed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run([
    id,
    order.reference || id,
    order.customer,
    order.customer_name || '',
    order.customer_email || '',
    Number(order.total || 0),
    order.status || 'pending',
    order.placed_at || now,
  ]);
  stmt.free();
  saveSqliteDb(db);
  return { id, ...order };
}

// ============================================================================
// Site Settings Persistence
// ============================================================================

export async function getSqliteSiteSettings(): Promise<any | null> {
  const db = await getSqliteDb();
  const stmt = db.prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'full_site_settings' LIMIT 1;");
  let settings: any = null;
  if (stmt.step()) {
    const val = stmt.getAsObject().setting_value as string;
    try {
      settings = JSON.parse(val);
    } catch (_) {}
  }
  stmt.free();
  return settings;
}

export async function saveSqliteSiteSettings(settings: any): Promise<void> {
  const db = await getSqliteDb();
  const stmt = db.prepare("INSERT OR REPLACE INTO app_settings (setting_key, setting_value) VALUES ('full_site_settings', ?);");
  stmt.run([JSON.stringify(settings)]);
  stmt.free();
  saveSqliteDb(db);
}

// ============================================================================
// Supplier Management System (Directory, Products, Intakes, Payments, Ledger)
// ============================================================================

export const INITIAL_SUPPLIERS_SEED: any[] = [
  {
    id: 'sup-001',
    code: 'SUP-001',
    name: 'Samuel Ndung\'u',
    company_name: 'Global Precision Woodworks',
    email: 'samuel@precisionwoodworks.co.ke',
    phone: '+254 712 345 678',
    physical_address: 'Enterprise Road, Industrial Area, Nairobi',
    tax_pin: 'P051882910Z',
    payment_terms: 'Consignment Sale',
    bank_name: 'Equity Bank Kenya',
    bank_account_number: '0180293849102',
    mpesa_number: '0712345678',
    mpesa_account_name: 'Samuel Ndungu / Precision Woodworks',
    status: 'Active',
    notes: 'Premium solid oak & mahogany artisan furniture and acoustic risers.',
    created_at: new Date(Date.now() - 86400000 * 45).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'sup-002',
    code: 'SUP-002',
    name: 'Grace Mutua',
    company_name: 'Obsidian Tech Foundry',
    email: 'supply@obsidiantech.co.ke',
    phone: '+254 722 987 654',
    physical_address: 'The Mirage Tower, Chiromo Road, Westlands, Nairobi',
    tax_pin: 'P052991044A',
    payment_terms: 'Net 30',
    bank_name: 'KCB Bank',
    bank_account_number: '1109283746',
    mpesa_number: '0722987654',
    mpesa_account_name: 'Obsidian Tech Foundry Ltd',
    status: 'Active',
    notes: 'CNC aluminum mechanical keyboards, magnetic switches, and studio monitors.',
    created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'sup-003',
    code: 'SUP-003',
    name: 'Hassan Omar',
    company_name: 'Rift Valley Apparel Mill',
    email: 'hassan@rvapparel.co.ke',
    phone: '+254 733 112 233',
    physical_address: 'Kenyatta Avenue, Nakuru CBD, Nakuru',
    tax_pin: 'P054128990K',
    payment_terms: 'Bi-weekly',
    bank_name: 'Standard Chartered',
    bank_account_number: '01050293847',
    mpesa_number: '0733112233',
    mpesa_account_name: 'Rift Valley Apparel Mill',
    status: 'Active',
    notes: 'Organic heavyweight cotton hoodies, bespoke streetwear, and linen shirts.',
    created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'sup-004',
    code: 'SUP-004',
    name: 'Amina Salim',
    company_name: 'Kilifi Artisan Handcrafts',
    email: 'amina@kilifihandcrafts.co.ke',
    phone: '+254 744 556 677',
    physical_address: 'Bofa Road, Kilifi Creek, Kilifi',
    tax_pin: 'P053772199M',
    payment_terms: 'Immediate',
    bank_name: 'Cooperative Bank',
    bank_account_number: '01128374659200',
    mpesa_number: '0744556677',
    mpesa_account_name: 'Amina Salim Swahili Crafts',
    status: 'Active',
    notes: 'Handmade coconut wax scented candles, essential oils, and woven decor.',
    created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const INITIAL_SUPPLIER_PRODUCTS_SEED: any[] = [
  {
    id: 'sp-001',
    supplier: 'sup-001',
    product: 'prod-oak-riser',
    product_name: 'Solid Walnut Dual Monitor Riser with MagSafe Slot',
    product_sku: 'DSK-OAK-001',
    product_image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=600',
    product_category: 'Home & Living',
    product_stock: 14,
    supplier_sku: 'GPW-WNR-90',
    agreed_cost_price: 6500,
    selling_price: 11900,
    quantity_received: 25,
    quantity_sold: 11,
    remaining_stock: 14,
    lead_time_days: 4,
    is_primary_supplier: 1,
    created_at: new Date(Date.now() - 86400000 * 40).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'sp-002',
    supplier: 'sup-001',
    product: 'prod-acoustic-panel',
    product_name: 'Artisan Acoustic Felt & Timber Wall Slat (Pair)',
    product_sku: 'DSK-SLAT-002',
    product_image_url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=600',
    product_category: 'Home & Living',
    product_stock: 8,
    supplier_sku: 'GPW-SLT-44',
    agreed_cost_price: 9000,
    selling_price: 16500,
    quantity_received: 15,
    quantity_sold: 7,
    remaining_stock: 8,
    lead_time_days: 5,
    is_primary_supplier: 1,
    created_at: new Date(Date.now() - 86400000 * 35).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'sp-003',
    supplier: 'sup-002',
    product: 'prod-mag-keyboard',
    product_name: 'Veloce Titan 75% CNC Magnetic Hall-Effect Keyboard',
    product_sku: 'KB-TITAN-75',
    product_image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=600',
    product_category: 'Electronics',
    product_stock: 19,
    supplier_sku: 'OTF-KB-75X',
    agreed_cost_price: 14500,
    selling_price: 24500,
    quantity_received: 30,
    quantity_sold: 11,
    remaining_stock: 19,
    lead_time_days: 7,
    is_primary_supplier: 1,
    created_at: new Date(Date.now() - 86400000 * 50).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'sp-004',
    supplier: 'sup-003',
    product: 'prod-streetwear-hoodie',
    product_name: 'Ropenix Heavyweight 480GSM French Terry Hoodie',
    product_sku: 'APP-HDY-480',
    product_image_url: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&q=80&w=600',
    product_category: 'Fashion',
    product_stock: 32,
    supplier_sku: 'RVA-HD-BLK',
    agreed_cost_price: 3200,
    selling_price: 6800,
    quantity_received: 50,
    quantity_sold: 18,
    remaining_stock: 32,
    lead_time_days: 3,
    is_primary_supplier: 1,
    created_at: new Date(Date.now() - 86400000 * 25).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'sp-005',
    supplier: 'sup-004',
    product: 'prod-candle-coconut',
    product_name: 'Swahili Coast Coconut & Amber Hand-Poured Candle',
    product_sku: 'BEA-CNDL-01',
    product_image_url: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&q=80&w=600',
    product_category: 'Beauty & Fragrances',
    product_stock: 22,
    supplier_sku: 'KAH-CND-AMB',
    agreed_cost_price: 1200,
    selling_price: 2600,
    quantity_received: 40,
    quantity_sold: 18,
    remaining_stock: 22,
    lead_time_days: 2,
    is_primary_supplier: 1,
    created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const INITIAL_SUPPLIER_INTAKES_SEED: any[] = [
  {
    id: 'intake-001',
    batch_number: 'BATCH-2026-001',
    supplier: 'sup-001',
    supplier_name: 'Samuel Ndung\'u',
    supplier_company: 'Global Precision Woodworks',
    product: 'prod-oak-riser',
    product_name: 'Solid Walnut Dual Monitor Riser with MagSafe Slot',
    product_sku: 'DSK-OAK-001',
    quantity_received: 25,
    unit_cost: 6500,
    total_cost: 162500,
    received_date: new Date(Date.now() - 86400000 * 40).toISOString().split('T')[0],
    delivery_note_ref: 'DN-GPW-9042',
    invoice_ref: 'INV-GPW-1102',
    status: 'Received',
    notes: 'Q1 production lot. All walnut slats kiln-dried and certified.',
    received_by: 'Operations Supervisor',
    created_at: new Date(Date.now() - 86400000 * 40).toISOString()
  },
  {
    id: 'intake-002',
    batch_number: 'BATCH-2026-002',
    supplier: 'sup-002',
    supplier_name: 'Grace Mutua',
    supplier_company: 'Obsidian Tech Foundry',
    product: 'prod-mag-keyboard',
    product_name: 'Veloce Titan 75% CNC Magnetic Hall-Effect Keyboard',
    product_sku: 'KB-TITAN-75',
    quantity_received: 30,
    unit_cost: 14500,
    total_cost: 435000,
    received_date: new Date(Date.now() - 86400000 * 50).toISOString().split('T')[0],
    delivery_note_ref: 'DN-OTF-4011',
    invoice_ref: 'INV-OTF-8891',
    status: 'Received',
    notes: 'Anodized black aluminum housings. Rapid trigger switches verified.',
    received_by: 'Tech QA Lead',
    created_at: new Date(Date.now() - 86400000 * 50).toISOString()
  },
  {
    id: 'intake-003',
    batch_number: 'BATCH-2026-003',
    supplier: 'sup-003',
    supplier_name: 'Hassan Omar',
    supplier_company: 'Rift Valley Apparel Mill',
    product: 'prod-streetwear-hoodie',
    product_name: 'Ropenix Heavyweight 480GSM French Terry Hoodie',
    product_sku: 'APP-HDY-480',
    quantity_received: 50,
    unit_cost: 3200,
    total_cost: 160000,
    received_date: new Date(Date.now() - 86400000 * 25).toISOString().split('T')[0],
    delivery_note_ref: 'DN-RVA-0129',
    invoice_ref: 'INV-RVA-4401',
    status: 'Received',
    notes: 'Shrinkage tests passed. High-density embroidered logos on chest.',
    received_by: 'Apparel Logistics',
    created_at: new Date(Date.now() - 86400000 * 25).toISOString()
  },
  {
    id: 'intake-004',
    batch_number: 'BATCH-2026-004',
    supplier: 'sup-004',
    supplier_name: 'Amina Salim',
    supplier_company: 'Kilifi Artisan Handcrafts',
    product: 'prod-candle-coconut',
    product_name: 'Swahili Coast Coconut & Amber Hand-Poured Candle',
    product_sku: 'BEA-CNDL-01',
    quantity_received: 40,
    unit_cost: 1200,
    total_cost: 48000,
    received_date: new Date(Date.now() - 86400000 * 12).toISOString().split('T')[0],
    delivery_note_ref: 'DN-KAH-5510',
    invoice_ref: 'INV-KAH-0092',
    status: 'Received',
    notes: 'Amber glass jars with wooden wicks and organic fragrance oils.',
    received_by: 'Warehouse Inbound',
    created_at: new Date(Date.now() - 86400000 * 12).toISOString()
  }
];

export const INITIAL_SUPPLIER_PAYMENTS_SEED: any[] = [
  {
    id: 'pay-001',
    payment_reference: 'PAY-SUP-2026-001',
    supplier: 'sup-001',
    supplier_name: 'Samuel Ndung\'u',
    supplier_company: 'Global Precision Woodworks',
    payment_date: new Date(Date.now() - 86400000 * 10).toISOString().split('T')[0],
    amount: 50000,
    payment_method: 'M-PESA',
    transaction_code: 'QEH78912KL',
    settlement_period_start: new Date(Date.now() - 86400000 * 30).toISOString().split('T')[0],
    settlement_period_end: new Date(Date.now() - 86400000 * 10).toISOString().split('T')[0],
    allocated_batches_or_orders: ['BATCH-2026-001'],
    status: 'Completed',
    receipt_attachment_url: '',
    notes: 'Bi-monthly consignment sales disbursement for units sold in period.',
    processed_by: 'Finance Controller',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString()
  },
  {
    id: 'pay-002',
    payment_reference: 'PAY-SUP-2026-002',
    supplier: 'sup-002',
    supplier_name: 'Grace Mutua',
    supplier_company: 'Obsidian Tech Foundry',
    payment_date: new Date(Date.now() - 86400000 * 20).toISOString().split('T')[0],
    amount: 100000,
    payment_method: 'Bank Transfer',
    transaction_code: 'FT2602288190',
    settlement_period_start: new Date(Date.now() - 86400000 * 45).toISOString().split('T')[0],
    settlement_period_end: new Date(Date.now() - 86400000 * 20).toISOString().split('T')[0],
    allocated_batches_or_orders: ['BATCH-2026-002'],
    status: 'Completed',
    receipt_attachment_url: '',
    notes: 'Net 30 invoice milestone settlement to KCB Bank account.',
    processed_by: 'Finance Controller',
    created_at: new Date(Date.now() - 86400000 * 20).toISOString()
  },
  {
    id: 'pay-003',
    payment_reference: 'PAY-SUP-2026-003',
    supplier: 'sup-004',
    supplier_name: 'Amina Salim',
    supplier_company: 'Kilifi Artisan Handcrafts',
    payment_date: new Date(Date.now() - 86400000 * 12).toISOString().split('T')[0],
    amount: 21600,
    payment_method: 'M-PESA',
    transaction_code: 'QEH33901MN',
    settlement_period_start: new Date(Date.now() - 86400000 * 12).toISOString().split('T')[0],
    settlement_period_end: new Date(Date.now() - 86400000 * 12).toISOString().split('T')[0],
    allocated_batches_or_orders: ['BATCH-2026-004'],
    status: 'Completed',
    receipt_attachment_url: '',
    notes: 'Immediate payment settlement on arrival of artisanal batch.',
    processed_by: 'Finance Controller',
    created_at: new Date(Date.now() - 86400000 * 12).toISOString()
  }
];

async function ensureSuppliersSeeded(db: Database): Promise<void> {
  const check = db.exec("SELECT COUNT(*) as count FROM suppliers;");
  const count = check.length > 0 && check[0].values.length > 0 ? (check[0].values[0][0] as number) : 0;
  if (count > 0) return;

  // 1. Seed Suppliers
  const stmtSup = db.prepare(`
    INSERT INTO suppliers (
      id, code, name, company_name, email, phone, physical_address, tax_pin,
      payment_terms, bank_name, bank_account_number, mpesa_number, mpesa_account_name,
      status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const s of INITIAL_SUPPLIERS_SEED) {
    stmtSup.run([
      s.id, s.code, s.name, s.company_name, s.email, s.phone, s.physical_address, s.tax_pin,
      s.payment_terms, s.bank_name, s.bank_account_number, s.mpesa_number, s.mpesa_account_name,
      s.status, s.notes, s.created_at, s.updated_at
    ]);
  }
  stmtSup.free();

  // 2. Seed Supplier Products
  const stmtProd = db.prepare(`
    INSERT INTO supplier_products (
      id, supplier, product, product_name, product_sku, product_image_url,
      product_category, product_stock, supplier_sku, agreed_cost_price, selling_price,
      quantity_received, quantity_sold, remaining_stock, lead_time_days, is_primary_supplier,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of INITIAL_SUPPLIER_PRODUCTS_SEED) {
    stmtProd.run([
      p.id, p.supplier, p.product, p.product_name, p.product_sku, p.product_image_url,
      p.product_category, p.product_stock, p.supplier_sku, p.agreed_cost_price, p.selling_price,
      p.quantity_received, p.quantity_sold, p.remaining_stock, p.lead_time_days, p.is_primary_supplier,
      p.created_at, p.updated_at
    ]);
  }
  stmtProd.free();

  // 3. Seed Supplier Intakes
  const stmtIntake = db.prepare(`
    INSERT INTO supplier_intakes (
      id, batch_number, supplier, supplier_name, supplier_company, product,
      product_name, product_sku, quantity_received, unit_cost, total_cost,
      received_date, delivery_note_ref, invoice_ref, status, notes, received_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const i of INITIAL_SUPPLIER_INTAKES_SEED) {
    stmtIntake.run([
      i.id, i.batch_number, i.supplier, i.supplier_name, i.supplier_company, i.product,
      i.product_name, i.product_sku, i.quantity_received, i.unit_cost, i.total_cost,
      i.received_date, i.delivery_note_ref, i.invoice_ref, i.status, i.notes, i.received_by, i.created_at
    ]);
  }
  stmtIntake.free();

  // 4. Seed Supplier Payments
  const stmtPay = db.prepare(`
    INSERT INTO supplier_payments (
      id, payment_reference, supplier, supplier_name, supplier_company,
      payment_date, amount, payment_method, transaction_code,
      settlement_period_start, settlement_period_end, allocated_batches_or_orders,
      status, receipt_attachment_url, notes, processed_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of INITIAL_SUPPLIER_PAYMENTS_SEED) {
    stmtPay.run([
      p.id, p.payment_reference, p.supplier, p.supplier_name, p.supplier_company,
      p.payment_date, p.amount, p.payment_method, p.transaction_code,
      p.settlement_period_start, p.settlement_period_end, JSON.stringify(p.allocated_batches_or_orders || []),
      p.status, p.receipt_attachment_url, p.notes, p.processed_by, p.created_at
    ]);
  }
  stmtPay.free();

  saveSqliteDb(db);
  console.log('[SQLite] Seeded initial Kenyan suppliers, intake batches, and payment history.');
}

export async function getAllSqliteSuppliers(statusParam?: string): Promise<Supplier[]> {
  const db = await getSqliteDb();
  await ensureSuppliersSeeded(db);

  let query = "SELECT * FROM suppliers ORDER BY created_at DESC;";
  if (statusParam && statusParam !== 'all') {
    query = `SELECT * FROM suppliers WHERE status = '${statusParam.replace(/'/g, "''")}' ORDER BY created_at DESC;`;
  }

  const res = db.exec(query);
  if (!res || !res.length) return [];

  const cols = res[0].columns;
  const suppliers: any[] = res[0].values.map((row) => {
    const obj: any = {};
    cols.forEach((c, idx) => { obj[c] = row[idx]; });
    return obj;
  });

  // Pull all supplier products, intakes, payments to enrich calculated financials
  const allProducts = await getAllSqliteSupplierProducts();
  const allPayments = await getAllSqliteSupplierPayments();

  return suppliers.map((s) => {
    const supProducts = allProducts.filter((p) => p.supplier === s.id);
    const supPayments = allPayments.filter((p) => p.supplier === s.id && p.status === 'Completed');

    const totalReceivedValue = supProducts.reduce((acc, p) => acc + (p.quantity_received * p.agreed_cost_price), 0);
    const totalSalesRevenue = supProducts.reduce((acc, p) => acc + (p.total_sales_revenue || (p.quantity_sold * p.selling_price)), 0);
    const totalCostOwed = supProducts.reduce((acc, p) => acc + (p.total_cost_owed || (p.quantity_sold * p.agreed_cost_price)), 0);
    const totalPaid = supPayments.reduce((acc, p) => acc + p.amount, 0);
    const outstandingBalance = Math.max(0, totalCostOwed - totalPaid);
    const grossProfit = totalSalesRevenue - totalCostOwed;
    const profitMargin = totalSalesRevenue > 0 ? Math.round(((grossProfit / totalSalesRevenue) * 100) * 10) / 10 : 0;

    let paymentStatus: Supplier['payment_status'] = 'Pending';
    if (outstandingBalance <= 0 && totalPaid > 0) {
      paymentStatus = 'Paid';
    } else if (totalPaid > 0 && outstandingBalance > 0) {
      paymentStatus = 'Partially Paid';
    }

    return {
      id: s.id,
      code: s.code,
      name: s.name,
      company_name: s.company_name || '',
      email: s.email || '',
      phone: s.phone || '',
      physical_address: s.physical_address || '',
      tax_pin: s.tax_pin || '',
      payment_terms: s.payment_terms || 'Consignment Sale',
      bank_name: s.bank_name || '',
      bank_account_number: s.bank_account_number || '',
      mpesa_number: s.mpesa_number || '',
      mpesa_account_name: s.mpesa_account_name || '',
      status: s.status || 'Active',
      notes: s.notes || '',
      total_received_value: totalReceivedValue,
      total_sales_revenue: totalSalesRevenue,
      total_cost_owed: totalCostOwed,
      total_amount_paid: totalPaid,
      outstanding_balance: outstandingBalance,
      gross_profit: grossProfit,
      profit_margin_percent: profitMargin,
      payment_status: paymentStatus,
      active_products_count: supProducts.length,
      created_at: s.created_at || new Date().toISOString(),
      updated_at: s.updated_at || new Date().toISOString()
    } as Supplier;
  });
}

export async function getSqliteSupplierById(id: string): Promise<Supplier | null> {
  const suppliers = await getAllSqliteSuppliers();
  return suppliers.find((s) => s.id === id || s.code === id) || null;
}

export async function saveSqliteSupplier(data: Partial<Supplier>): Promise<Supplier> {
  const db = await getSqliteDb();
  const id = data.id || `sup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  // Generate code if empty
  let code = data.code;
  if (!code || code.trim() === '') {
    const countRes = db.exec("SELECT COUNT(*) as count FROM suppliers;");
    const count = countRes.length > 0 ? (countRes[0].values[0][0] as number) : 0;
    code = `SUP-${String(count + 1).padStart(3, '0')}`;
  }

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO suppliers (
      id, code, name, company_name, email, phone, physical_address, tax_pin,
      payment_terms, bank_name, bank_account_number, mpesa_number, mpesa_account_name,
      status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run([
    id,
    code,
    data.name || 'Unnamed Supplier',
    data.company_name || '',
    data.email || '',
    data.phone || '',
    data.physical_address || '',
    data.tax_pin || '',
    data.payment_terms || 'Consignment Sale',
    data.bank_name || '',
    data.bank_account_number || '',
    data.mpesa_number || '',
    data.mpesa_account_name || '',
    data.status || 'Active',
    data.notes || '',
    data.created_at || now,
    now
  ]);
  stmt.free();
  saveSqliteDb(db);

  const found = await getSqliteSupplierById(id);
  return found!;
}

export async function deleteSqliteSupplier(id: string): Promise<boolean> {
  const db = await getSqliteDb();
  db.run("DELETE FROM suppliers WHERE id = ? OR code = ?;", [id, id]);
  db.run("DELETE FROM supplier_products WHERE supplier = ?;", [id]);
  db.run("DELETE FROM supplier_intakes WHERE supplier = ?;", [id]);
  db.run("DELETE FROM supplier_payments WHERE supplier = ?;", [id]);
  db.run("DELETE FROM supplier_ledger WHERE supplier = ?;", [id]);
  saveSqliteDb(db);
  return true;
}

// Supplier Products
export async function getAllSqliteSupplierProducts(supplierId?: string): Promise<SupplierProduct[]> {
  const db = await getSqliteDb();
  await ensureSuppliersSeeded(db);

  let query = "SELECT * FROM supplier_products ORDER BY created_at DESC;";
  if (supplierId && supplierId !== 'all') {
    query = `SELECT * FROM supplier_products WHERE supplier = '${supplierId.replace(/'/g, "''")}' ORDER BY created_at DESC;`;
  }

  const res = db.exec(query);
  if (!res || !res.length) return [];

  const cols = res[0].columns;
  return res[0].values.map((row) => {
    const obj: any = {};
    cols.forEach((c, idx) => { obj[c] = row[idx]; });

    const agreedCost = Number(obj.agreed_cost_price || 0);
    const sellPrice = Number(obj.selling_price || 0);
    const qtyReceived = Number(obj.quantity_received || 0);
    const qtySold = Number(obj.quantity_sold || 0);
    const remainingStock = Math.max(0, qtyReceived - qtySold);

    const totalCostOwed = qtySold * agreedCost;
    const totalSalesRevenue = qtySold * sellPrice;
    const grossProfit = totalSalesRevenue - totalCostOwed;
    const profitMargin = sellPrice > 0 ? Math.round(((sellPrice - agreedCost) / sellPrice * 100) * 10) / 10 : 0;

    return {
      id: obj.id,
      supplier: obj.supplier,
      product: obj.product,
      product_name: obj.product_name,
      product_sku: obj.product_sku || '',
      product_image_url: obj.product_image_url || '',
      product_category: obj.product_category || '',
      product_stock: Number(obj.product_stock || remainingStock),
      supplier_sku: obj.supplier_sku || '',
      agreed_cost_price: agreedCost,
      selling_price: sellPrice,
      quantity_received: qtyReceived,
      quantity_sold: qtySold,
      remaining_stock: remainingStock,
      total_cost_owed: totalCostOwed,
      total_sales_revenue: totalSalesRevenue,
      gross_profit: grossProfit,
      profit_margin_percent: profitMargin,
      lead_time_days: Number(obj.lead_time_days || 3),
      is_primary_supplier: Boolean(obj.is_primary_supplier),
      created_at: obj.created_at || new Date().toISOString(),
      updated_at: obj.updated_at || new Date().toISOString()
    } as SupplierProduct;
  });
}

export async function saveSqliteSupplierProduct(data: Partial<SupplierProduct>): Promise<SupplierProduct> {
  const db = await getSqliteDb();
  const id = data.id || `sp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO supplier_products (
      id, supplier, product, product_name, product_sku, product_image_url,
      product_category, product_stock, supplier_sku, agreed_cost_price, selling_price,
      quantity_received, quantity_sold, remaining_stock, lead_time_days, is_primary_supplier,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run([
    id,
    data.supplier || '',
    data.product || id,
    data.product_name || 'Linked Sourced Product',
    data.product_sku || '',
    data.product_image_url || '',
    data.product_category || '',
    Number(data.product_stock || 0),
    data.supplier_sku || '',
    Number(data.agreed_cost_price || 0),
    Number(data.selling_price || 0),
    Number(data.quantity_received || 0),
    Number(data.quantity_sold || 0),
    Number(data.remaining_stock || (Number(data.quantity_received || 0) - Number(data.quantity_sold || 0))),
    Number(data.lead_time_days || 3),
    data.is_primary_supplier ? 1 : 0,
    data.created_at || now,
    now
  ]);
  stmt.free();
  saveSqliteDb(db);

  const all = await getAllSqliteSupplierProducts();
  return all.find((p) => p.id === id)!;
}

// Supplier Intakes
export async function getAllSqliteSupplierIntakes(supplierId?: string): Promise<SupplierIntakeBatch[]> {
  const db = await getSqliteDb();
  await ensureSuppliersSeeded(db);

  let query = "SELECT * FROM supplier_intakes ORDER BY created_at DESC;";
  if (supplierId && supplierId !== 'all') {
    query = `SELECT * FROM supplier_intakes WHERE supplier = '${supplierId.replace(/'/g, "''")}' ORDER BY created_at DESC;`;
  }

  const res = db.exec(query);
  if (!res || !res.length) return [];

  const cols = res[0].columns;
  return res[0].values.map((row) => {
    const obj: any = {};
    cols.forEach((c, idx) => { obj[c] = row[idx]; });
    return {
      id: obj.id,
      batch_number: obj.batch_number,
      supplier: obj.supplier,
      supplier_name: obj.supplier_name || '',
      supplier_company: obj.supplier_company || '',
      product: obj.product || null,
      product_name: obj.product_name,
      product_sku: obj.product_sku || '',
      quantity_received: Number(obj.quantity_received || 0),
      unit_cost: Number(obj.unit_cost || 0),
      total_cost: Number(obj.total_cost || 0),
      received_date: obj.received_date || new Date().toISOString().split('T')[0],
      delivery_note_ref: obj.delivery_note_ref || '',
      invoice_ref: obj.invoice_ref || '',
      status: obj.status || 'Received',
      notes: obj.notes || '',
      received_by: obj.received_by || 'Inventory Manager',
      created_at: obj.created_at || new Date().toISOString()
    } as SupplierIntakeBatch;
  });
}

export async function saveSqliteSupplierIntake(data: Partial<SupplierIntakeBatch>): Promise<SupplierIntakeBatch> {
  const db = await getSqliteDb();
  const id = data.id || `intake-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const year = new Date().getFullYear();

  let batchNum = data.batch_number;
  if (!batchNum || batchNum.trim() === '') {
    const countRes = db.exec("SELECT COUNT(*) as count FROM supplier_intakes;");
    const count = countRes.length > 0 ? (countRes[0].values[0][0] as number) : 0;
    batchNum = `BATCH-${year}-${String(count + 1).padStart(3, '0')}`;
  }

  const qty = Number(data.quantity_received || 0);
  const unitCost = Number(data.unit_cost || 0);
  const totalCost = Number(data.total_cost || (qty * unitCost));

  // Get supplier info for denormalization
  let supplierName = data.supplier_name || '';
  let supplierCompany = data.supplier_company || '';
  if (data.supplier && (!supplierName || !supplierCompany)) {
    const sup = await getSqliteSupplierById(data.supplier);
    if (sup) {
      supplierName = sup.name;
      supplierCompany = sup.company_name;
    }
  }

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO supplier_intakes (
      id, batch_number, supplier, supplier_name, supplier_company, product,
      product_name, product_sku, quantity_received, unit_cost, total_cost,
      received_date, delivery_note_ref, invoice_ref, status, notes, received_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run([
    id,
    batchNum,
    data.supplier || '',
    supplierName,
    supplierCompany,
    data.product || null,
    data.product_name || 'Received Sourced Lot',
    data.product_sku || '',
    qty,
    unitCost,
    totalCost,
    data.received_date || now.split('T')[0],
    data.delivery_note_ref || '',
    data.invoice_ref || '',
    data.status || 'Received',
    data.notes || '',
    data.received_by || 'Inventory Manager',
    data.created_at || now
  ]);
  stmt.free();

  // If there is an existing supplier_product matching this product/supplier, update its received quantity
  if (data.supplier && data.product) {
    db.run(`
      UPDATE supplier_products 
      SET quantity_received = quantity_received + ?, remaining_stock = remaining_stock + ?, updated_at = ?
      WHERE supplier = ? AND product = ?;
    `, [qty, qty, now, data.supplier, data.product]);
  }

  saveSqliteDb(db);
  const all = await getAllSqliteSupplierIntakes();
  return all.find((i) => i.id === id)!;
}

// Supplier Payments
export async function getAllSqliteSupplierPayments(supplierId?: string): Promise<SupplierPayment[]> {
  const db = await getSqliteDb();
  await ensureSuppliersSeeded(db);

  let query = "SELECT * FROM supplier_payments ORDER BY created_at DESC;";
  if (supplierId && supplierId !== 'all') {
    query = `SELECT * FROM supplier_payments WHERE supplier = '${supplierId.replace(/'/g, "''")}' ORDER BY created_at DESC;`;
  }

  const res = db.exec(query);
  if (!res || !res.length) return [];

  const cols = res[0].columns;
  return res[0].values.map((row) => {
    const obj: any = {};
    cols.forEach((c, idx) => { obj[c] = row[idx]; });
    let allocated: string[] = [];
    try {
      allocated = obj.allocated_batches_or_orders ? JSON.parse(obj.allocated_batches_or_orders) : [];
    } catch (_) {}

    return {
      id: obj.id,
      payment_reference: obj.payment_reference,
      supplier: obj.supplier,
      supplier_name: obj.supplier_name || '',
      supplier_company: obj.supplier_company || '',
      payment_date: obj.payment_date || new Date().toISOString().split('T')[0],
      amount: Number(obj.amount || 0),
      payment_method: obj.payment_method || 'M-PESA',
      transaction_code: obj.transaction_code || '',
      settlement_period_start: obj.settlement_period_start || null,
      settlement_period_end: obj.settlement_period_end || null,
      allocated_batches_or_orders: allocated,
      status: obj.status || 'Completed',
      receipt_attachment_url: obj.receipt_attachment_url || '',
      notes: obj.notes || '',
      processed_by: obj.processed_by || 'Finance Controller',
      created_at: obj.created_at || new Date().toISOString()
    } as SupplierPayment;
  });
}

export async function saveSqliteSupplierPayment(data: Partial<SupplierPayment>): Promise<SupplierPayment> {
  const db = await getSqliteDb();
  const id = data.id || `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const year = new Date().getFullYear();

  let payRef = data.payment_reference;
  if (!payRef || payRef.trim() === '') {
    const countRes = db.exec("SELECT COUNT(*) as count FROM supplier_payments;");
    const count = countRes.length > 0 ? (countRes[0].values[0][0] as number) : 0;
    payRef = `PAY-SUP-${year}-${String(count + 1).padStart(3, '0')}`;
  }

  let supplierName = data.supplier_name || '';
  let supplierCompany = data.supplier_company || '';
  if (data.supplier && (!supplierName || !supplierCompany)) {
    const sup = await getSqliteSupplierById(data.supplier);
    if (sup) {
      supplierName = sup.name;
      supplierCompany = sup.company_name;
    }
  }

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO supplier_payments (
      id, payment_reference, supplier, supplier_name, supplier_company,
      payment_date, amount, payment_method, transaction_code,
      settlement_period_start, settlement_period_end, allocated_batches_or_orders,
      status, receipt_attachment_url, notes, processed_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run([
    id,
    payRef,
    data.supplier || '',
    supplierName,
    supplierCompany,
    data.payment_date || now.split('T')[0],
    Number(data.amount || 0),
    data.payment_method || 'M-PESA',
    data.transaction_code || '',
    data.settlement_period_start || null,
    data.settlement_period_end || null,
    JSON.stringify(data.allocated_batches_or_orders || []),
    data.status || 'Completed',
    data.receipt_attachment_url || '',
    data.notes || '',
    data.processed_by || 'Finance Controller',
    data.created_at || now
  ]);
  stmt.free();
  saveSqliteDb(db);

  const all = await getAllSqliteSupplierPayments();
  return all.find((p) => p.id === id)!;
}

// Statement Generation
export async function getSqliteSupplierStatement(
  supplierId: string,
  startDate?: string,
  endDate?: string
): Promise<SupplierStatement> {
  const supplier = await getSqliteSupplierById(supplierId);
  const intakes = await getAllSqliteSupplierIntakes(supplierId);
  const payments = await getAllSqliteSupplierPayments(supplierId);

  const transactions: SupplierStatement['transactions'] = [];
  let runningBalance = 0;

  // Combine intakes (Credits to supplier) and payments (Debits to supplier)
  const allEvents: { date: string; type: string; ref: string; desc: string; debit: number; credit: number }[] = [];

  for (const intake of intakes) {
    allEvents.push({
      date: intake.received_date || intake.created_at,
      type: 'STOCK_INTAKE',
      ref: intake.batch_number,
      desc: `Intake Batch: ${intake.product_name} (${intake.quantity_received} units @ KSh ${intake.unit_cost.toLocaleString()})`,
      debit: 0,
      credit: intake.total_cost
    });
  }

  for (const pay of payments) {
    if (pay.status === 'Completed') {
      allEvents.push({
        date: pay.payment_date || pay.created_at,
        type: 'PAYMENT_DISBURSED',
        ref: pay.payment_reference,
        desc: `Payment Disbursed via ${pay.payment_method} ${pay.transaction_code ? `(${pay.transaction_code})` : ''}`,
        debit: pay.amount,
        credit: 0
      });
    }
  }

  // Sort chronologically
  allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let totalDebited = 0;
  let totalCredited = 0;

  for (let i = 0; i < allEvents.length; i++) {
    const ev = allEvents[i];
    runningBalance += (ev.credit - ev.debit);
    totalDebited += ev.debit;
    totalCredited += ev.credit;

    // Filter by date range if provided
    let inRange = true;
    if (startDate && new Date(ev.date) < new Date(startDate)) inRange = false;
    if (endDate && new Date(ev.date) > new Date(endDate)) inRange = false;

    if (inRange) {
      transactions.push({
        id: `tx-${i + 1}`,
        date: ev.date,
        entry_type: ev.type,
        reference: ev.ref,
        description: ev.desc,
        debit: ev.debit,
        credit: ev.credit,
        running_balance: runningBalance
      });
    }
  }

  return {
    supplier_id: supplierId,
    supplier_name: supplier?.name || 'Supplier',
    company_name: supplier?.company_name || '',
    code: supplier?.code || 'SUP-001',
    tax_pin: supplier?.tax_pin || 'P051000000Z',
    payment_terms: supplier?.payment_terms || 'Consignment Sale',
    statement_period: {
      start: startDate || (transactions[0]?.date || '2026-01-01'),
      end: endDate || new Date().toISOString().split('T')[0]
    },
    total_debited: totalDebited,
    total_credited: totalCredited,
    closing_balance: Math.max(0, runningBalance),
    transactions
  };
}

// Dashboard Analytics
export async function getSqliteSupplierDashboardAnalytics(): Promise<SupplierDashboardMetrics> {
  const suppliers = await getAllSqliteSuppliers();
  const products = await getAllSqliteSupplierProducts();
  const payments = await getAllSqliteSupplierPayments();

  const totalSuppliers = suppliers.length;
  const totalProducts = products.length;
  const totalUnitsReceived = products.reduce((acc, p) => acc + (p.quantity_received || 0), 0);
  const totalUnitsSold = products.reduce((acc, p) => acc + (p.quantity_sold || 0), 0);
  const totalReceivedValue = products.reduce((acc, p) => acc + (p.quantity_received * p.agreed_cost_price), 0);
  const totalSalesRevenue = products.reduce((acc, p) => acc + (p.total_sales_revenue || (p.quantity_sold * p.selling_price)), 0);
  const totalSupplierCosts = products.reduce((acc, p) => acc + (p.total_cost_owed || (p.quantity_sold * p.agreed_cost_price)), 0);
  const totalPaid = payments.filter((p) => p.status === 'Completed').reduce((acc, p) => acc + p.amount, 0);
  const totalOutstanding = Math.max(0, totalSupplierCosts - totalPaid);
  const totalProfit = totalSalesRevenue - totalSupplierCosts;
  const margin = totalSalesRevenue > 0 ? Math.round(((totalProfit / totalSalesRevenue) * 100) * 10) / 10 : 0;

  return {
    metrics: {
      total_suppliers: totalSuppliers,
      total_products_sourced: totalProducts,
      total_units_received: totalUnitsReceived,
      total_units_sold: totalUnitsSold,
      total_received_value: totalReceivedValue,
      total_sales_revenue: totalSalesRevenue,
      total_supplier_costs: totalSupplierCosts,
      total_paid_to_suppliers: totalPaid,
      total_outstanding_balance: totalOutstanding,
      total_gross_profit: totalProfit,
      overall_profit_margin: margin
    },
    status_distribution: {
      Paid: suppliers.filter((s) => s.payment_status === 'Paid').length,
      'Partially Paid': suppliers.filter((s) => s.payment_status === 'Partially Paid').length,
      Pending: suppliers.filter((s) => s.payment_status === 'Pending').length
    },
    top_profitable_products: products
      .sort((a, b) => b.gross_profit - a.gross_profit)
      .slice(0, 5)
      .map((p) => {
        const sup = suppliers.find((s) => s.id === p.supplier);
        return {
          product_id: p.product,
          product_name: p.product_name,
          sku: p.product_sku,
          supplier_name: sup?.company_name || sup?.name || 'Supplier',
          selling_price: p.selling_price,
          supplier_cost: p.agreed_cost_price,
          quantity_sold: p.quantity_sold,
          revenue: p.total_sales_revenue,
          gross_profit: p.gross_profit,
          profit_margin: p.profit_margin_percent
        };
      }),
    top_suppliers: suppliers
      .sort((a, b) => b.total_sales_revenue - a.total_sales_revenue)
      .slice(0, 5)
      .map((s) => ({
        supplier_id: s.id,
        supplier_name: s.name,
        company_name: s.company_name,
        products_count: s.active_products_count,
        total_revenue: s.total_sales_revenue,
        total_cost: s.total_cost_owed,
        gross_profit: s.gross_profit,
        outstanding_balance: s.outstanding_balance,
        margin_percent: s.profit_margin_percent
      }))
  };
}

// Supplier Reports
export async function getSqliteSupplierReport(
  type: string,
  supplierId?: string,
  startDate?: string,
  endDate?: string
): Promise<SupplierReportData> {
  const suppliers = await getAllSqliteSuppliers();
  const products = await getAllSqliteSupplierProducts(supplierId);
  const intakes = await getAllSqliteSupplierIntakes(supplierId);
  const payments = await getAllSqliteSupplierPayments(supplierId);

  const targetSuppliers = supplierId && supplierId !== 'all' ? suppliers.filter((s) => s.id === supplierId) : suppliers;

  switch (type) {
    case 'outstanding_balances':
    case 'outstanding_payments':
      return {
        report_type: type,
        title: 'Supplier Outstanding Balances & Aging Summary',
        generated_at: new Date().toISOString(),
        columns: ['Supplier Code', 'Supplier Name', 'Company', 'Total Cost Owed', 'Total Paid', 'Outstanding Balance', 'Payment Terms', 'Status'],
        rows: targetSuppliers.map((s) => ({
          code: s.code,
          name: s.name,
          company: s.company_name || 'N/A',
          total_owed: `KSh ${s.total_cost_owed.toLocaleString()}`,
          total_paid: `KSh ${s.total_amount_paid.toLocaleString()}`,
          outstanding_balance: `KSh ${s.outstanding_balance.toLocaleString()}`,
          payment_terms: s.payment_terms,
          status: s.payment_status
        }))
      };

    case 'payment_history':
      return {
        report_type: type,
        title: 'Supplier Payment Disbursements & Settlement History',
        generated_at: new Date().toISOString(),
        columns: ['Payment Ref', 'Supplier Name', 'Company', 'Payment Date', 'Amount', 'Payment Method', 'Transaction Code', 'Status'],
        rows: payments.map((p) => ({
          payment_ref: p.payment_reference,
          supplier_name: p.supplier_name,
          company: p.supplier_company || 'N/A',
          payment_date: p.payment_date,
          amount: `KSh ${p.amount.toLocaleString()}`,
          method: p.payment_method,
          transaction_code: p.transaction_code || 'N/A',
          status: p.status
        }))
      };

    case 'products_received':
      return {
        report_type: type,
        title: 'Supplier Inventory Intake & Sourcing Log',
        generated_at: new Date().toISOString(),
        columns: ['Batch Ref', 'Supplier Company', 'Product Name', 'SKU', 'Quantity Received', 'Unit Cost', 'Total Cost', 'Received Date', 'Status'],
        rows: intakes.map((i) => ({
          batch: i.batch_number,
          company: i.supplier_company || i.supplier_name || 'N/A',
          product_name: i.product_name,
          sku: i.product_sku || 'N/A',
          quantity: i.quantity_received,
          unit_cost: `KSh ${i.unit_cost.toLocaleString()}`,
          total_cost: `KSh ${i.total_cost.toLocaleString()}`,
          received_date: i.received_date,
          status: i.status
        }))
      };

    case 'profitability_by_supplier':
    case 'sales_by_supplier':
      return {
        report_type: type,
        title: 'Supplier Sourcing Profitability & Sales Revenue Breakdown',
        generated_at: new Date().toISOString(),
        columns: ['Supplier Code', 'Company / Artisan', 'Products Sourced', 'Sales Revenue', 'Cost Owed', 'Gross Profit', 'Margin %', 'Payment Status'],
        rows: targetSuppliers.map((s) => ({
          code: s.code,
          company: s.company_name || s.name,
          products_count: s.active_products_count,
          sales_revenue: `KSh ${s.total_sales_revenue.toLocaleString()}`,
          cost_owed: `KSh ${s.total_cost_owed.toLocaleString()}`,
          gross_profit: `KSh ${s.gross_profit.toLocaleString()}`,
          margin: `${s.profit_margin_percent}%`,
          status: s.payment_status
        }))
      };

    case 'profitability_by_product':
    case 'products_sold':
      return {
        report_type: type,
        title: 'Sourced Product Margins & Unit Sales Velocity',
        generated_at: new Date().toISOString(),
        columns: ['Product Name', 'SKU', 'Agreed Cost', 'Selling Price', 'Units Received', 'Units Sold', 'Remaining Stock', 'Gross Profit', 'Margin %'],
        rows: products.map((p) => ({
          product_name: p.product_name,
          sku: p.product_sku || 'N/A',
          cost_price: `KSh ${p.agreed_cost_price.toLocaleString()}`,
          selling_price: `KSh ${p.selling_price.toLocaleString()}`,
          units_received: p.quantity_received,
          units_sold: p.quantity_sold,
          remaining_stock: p.remaining_stock,
          gross_profit: `KSh ${p.gross_profit.toLocaleString()}`,
          margin: `${p.profit_margin_percent}%`
        }))
      };

    default:
      return {
        report_type: type,
        title: 'Supplier Consolidated Sourcing Report',
        generated_at: new Date().toISOString(),
        columns: ['Supplier Code', 'Supplier Name', 'Company', 'Total Owed', 'Total Paid', 'Outstanding Balance', 'Status'],
        rows: targetSuppliers.map((s) => ({
          code: s.code,
          name: s.name,
          company: s.company_name || 'N/A',
          total_owed: `KSh ${s.total_cost_owed.toLocaleString()}`,
          total_paid: `KSh ${s.total_amount_paid.toLocaleString()}`,
          outstanding_balance: `KSh ${s.outstanding_balance.toLocaleString()}`,
          status: s.payment_status
        }))
      };
  }
}

// ==========================================
// User Authentication & Registration Persistence
// ==========================================

export interface SqliteUserRecord {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  is_staff: boolean;
  is_superuser: boolean;
  email_verified: boolean;
  avatar_url?: string;
  referral_code?: string;
  partner_tier?: string;
  created_at: string;
  updated_at: string;
}

export interface SqlitePendingRegistrationRecord {
  id: string;
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  password_hash: string;
  phone?: string;
  otp_hash: string;
  otp_expires_at: string;
  attempts: number;
  max_attempts: number;
  last_sent_at: string;
  resend_count: number;
  resend_window_start: string;
  created_at: string;
  ip_address?: string;
}

export async function getAllSqliteUsers(): Promise<SqliteUserRecord[]> {
  const db = await getSqliteDb();
  const res = db.exec("SELECT * FROM users;");
  if (res.length === 0) return [];
  const cols = res[0].columns;
  return res[0].values.map((row) => {
    const obj: any = {};
    cols.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return {
      ...obj,
      is_staff: Boolean(obj.is_staff),
      is_superuser: Boolean(obj.is_superuser),
      email_verified: Boolean(obj.email_verified),
    };
  });
}

export async function getSqliteUserByEmail(email: string): Promise<SqliteUserRecord | null> {
  if (!email) return null;
  const db = await getSqliteDb();
  const normalized = email.trim().toLowerCase();
  const stmt = db.prepare("SELECT * FROM users WHERE LOWER(TRIM(email)) = ? OR LOWER(TRIM(username)) = ? LIMIT 1;");
  stmt.bind([normalized, normalized]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const obj: any = stmt.getAsObject();
  stmt.free();
  return {
    ...obj,
    is_staff: Boolean(obj.is_staff),
    is_superuser: Boolean(obj.is_superuser),
    email_verified: Boolean(obj.email_verified),
  };
}

export async function getSqliteUserById(id: string | number): Promise<SqliteUserRecord | null> {
  if (!id) return null;
  const db = await getSqliteDb();
  const stmt = db.prepare("SELECT * FROM users WHERE id = ? LIMIT 1;");
  stmt.bind([String(id)]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const obj: any = stmt.getAsObject();
  stmt.free();
  return {
    ...obj,
    is_staff: Boolean(obj.is_staff),
    is_superuser: Boolean(obj.is_superuser),
    email_verified: Boolean(obj.email_verified),
  };
}

export async function saveSqliteUser(user: {
  id?: string | number;
  username: string;
  email: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  is_staff?: boolean | number;
  is_superuser?: boolean | number;
  email_verified?: boolean | number;
  avatar_url?: string;
  referral_code?: string;
  partner_tier?: string;
}): Promise<SqliteUserRecord> {
  const db = await getSqliteDb();
  const id = String(user.id || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);
  const normalizedEmail = user.email.trim().toLowerCase();
  const now = new Date().toISOString();

  // Check for duplicate normalized email on insert/update of different id
  const existingUser = await getSqliteUserByEmail(normalizedEmail);
  if (existingUser && existingUser.id !== id) {
    throw new Error('An account with this email already exists.');
  }

  const stmt = db.prepare(`
    INSERT INTO users (
      id, username, email, password_hash, first_name, last_name, phone,
      is_staff, is_superuser, email_verified, avatar_url, referral_code, partner_tier,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      email = excluded.email,
      password_hash = excluded.password_hash,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      phone = excluded.phone,
      is_staff = excluded.is_staff,
      is_superuser = excluded.is_superuser,
      email_verified = excluded.email_verified,
      avatar_url = excluded.avatar_url,
      referral_code = excluded.referral_code,
      partner_tier = excluded.partner_tier,
      updated_at = excluded.updated_at
  `);

  stmt.run([
    id,
    user.username || normalizedEmail.split('@')[0],
    normalizedEmail,
    user.password_hash,
    user.first_name || '',
    user.last_name || '',
    user.phone || '',
    user.is_staff ? 1 : 0,
    user.is_superuser ? 1 : 0,
    user.email_verified !== undefined ? (user.email_verified ? 1 : 0) : 1,
    user.avatar_url || '',
    user.referral_code || `REF-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    user.partner_tier || 'Silver',
    existingUser?.created_at || now,
    now
  ]);
  stmt.free();
  saveSqliteDb(db);

  return {
    id,
    username: user.username || normalizedEmail.split('@')[0],
    email: normalizedEmail,
    password_hash: user.password_hash,
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    phone: user.phone || '',
    is_staff: Boolean(user.is_staff),
    is_superuser: Boolean(user.is_superuser),
    email_verified: Boolean(user.email_verified !== undefined ? user.email_verified : true),
    avatar_url: user.avatar_url || '',
    referral_code: user.referral_code,
    partner_tier: user.partner_tier || 'Silver',
    created_at: existingUser?.created_at || now,
    updated_at: now
  };
}

export async function ensureDefaultAdminUser(): Promise<void> {
  const adminEmail = (process.env.ADMIN_EMAIL || 'ropenixkenya@gmail.com').trim().toLowerCase();
  const hostUser = (process.env.EMAIL_HOST_USER || 'admin@ropenix.co.ke').trim().toLowerCase();
  
  for (const email of [adminEmail, hostUser]) {
    if (!email || !email.includes('@')) continue;
    try {
      const existing = await getSqliteUserByEmail(email);
      if (!existing) {
        const defaultSalt = '0123456789abcdef0123456789abcdef';
        const defaultHash = '35e4d293226a31c5b88ce8325dc01c385f850e047702890538a7c88b90a61254bf52199b5ff7a988d44747eb6fa32d4323e20e8d0537f819446f28b75710609f';
        await saveSqliteUser({
          id: `usr-admin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          username: email.split('@')[0],
          email: email,
          password_hash: `${defaultSalt}:${defaultHash}`,
          first_name: 'Administrator',
          last_name: 'Account',
          is_staff: 1,
          is_superuser: 1,
          email_verified: 1,
        });
        console.log(`[SQLite] Seeded default administrator account: <${email}>`);
      }
    } catch (err) {
      console.warn(`[SQLite] Admin account check notice for ${email}:`, err);
    }
  }

  // Also ensure default registered customer accounts are seeded
  await ensureDefaultCustomers().catch((err) => console.warn('[SQLite] Default customer seed notice:', err));
}

export async function ensureDefaultCustomers(): Promise<void> {
  const defaultCustomers = [
    {
      email: 'edwinmuliro64@gmail.com',
      username: 'edwinmuliro64',
      first_name: 'Edwin',
      last_name: 'Muliro',
      phone: '+254712345678',
      company: 'Ropenix Client Services',
      location: 'Nairobi, Kenya',
      partner_tier: 'Silver',
    },
    {
      email: 'sushisoogoong@gmail.com',
      username: 'sushisoogoong',
      first_name: 'Sushi',
      last_name: 'Soogoong',
      phone: '+254722000111',
      company: 'Soogoong Fashion Hub',
      location: 'Mombasa, Kenya',
      partner_tier: 'Silver',
    },
  ];

  const defaultSalt = '0123456789abcdef0123456789abcdef';
  const defaultHash = '35e4d293226a31c5b88ce8325dc01c385f850e047702890538a7c88b90a61254bf52199b5ff7a988d44747eb6fa32d4323e20e8d0537f819446f28b75710609f';

  for (const cust of defaultCustomers) {
    const email = cust.email.trim().toLowerCase();
    try {
      // 1. Ensure user account in users table
      let user = await getSqliteUserByEmail(email);
      if (!user) {
        user = await saveSqliteUser({
          id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          username: cust.username,
          email: email,
          password_hash: `${defaultSalt}:${defaultHash}`,
          first_name: cust.first_name,
          last_name: cust.last_name,
          phone: cust.phone,
          is_staff: 0,
          is_superuser: 0,
          email_verified: 1,
          referral_code: `REF-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          partner_tier: cust.partner_tier,
        });
        console.log(`[SQLite] Seeded registered customer user: <${email}>`);
      }

      // 2. Ensure customer record in customers CRM table
      const allCust = await getAllSqliteCustomers();
      const existingCust = allCust.find((c) => (c.email || '').toLowerCase().trim() === email);
      if (!existingCust) {
        await saveSqliteCustomer({
          id: `cust-${user?.id || Date.now()}`,
          user: user?.id || null,
          is_registered: 1,
          first_name: cust.first_name,
          last_name: cust.last_name,
          name: `${cust.first_name} ${cust.last_name}`.trim(),
          email: email,
          phone: cust.phone,
          company: cust.company,
          location: cust.location,
          status: 'Active',
          notes: `Verified registered customer (${cust.partner_tier} tier)`,
          open_deal_value: 0,
        });
        console.log(`[SQLite] Seeded CRM customer record: <${email}>`);
      }
    } catch (err) {
      console.warn(`[SQLite] Customer seed notice for ${email}:`, err);
    }
  }
}

export const DEFAULT_PRODUCTS_SEED: any[] = [
  {
    id: 'prod-oak-riser',
    sku: 'DSK-OAK-001',
    slug: 'solid-walnut-dual-monitor-riser',
    name: 'Solid Walnut Dual Monitor Riser with MagSafe Slot',
    brand: 'Veloce Woodcraft',
    countryOfOrigin: 'Kenya',
    country_of_origin: 'Kenya',
    description: 'Handcrafted from sustainable solid American walnut timber. Integrated magnetic wireless charging dock, dual display capacity, and premium anodized aluminum risers.',
    shortDescription: 'Handcrafted solid walnut dual monitor stand with integrated MagSafe charging pad.',
    detailedDescription: 'Elevate your workspace ergonomics and aesthetic with the Veloce Solid Walnut Dual Monitor Riser. Masterfully carved from kiln-dried Grade-A American Walnut, this desk shelf accommodates two 27-inch displays or an ultrawide monitor with zero flex. Features a recessed magnetic charging bay for Qi/MagSafe devices and felt-padded aluminum feet to protect premium desk surfaces.',
    price: 11900,
    costPrice: 6500,
    cost_price: 6500,
    originalPrice: 13500,
    original_price: 13500,
    previousPrice: 13500,
    category: 'Home & Living',
    tags: ['Desk Setup', 'Walnut', 'Ergonomic', 'Workspace', 'Handmade'],
    type: 'physical',
    imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=800',
    images: [
      'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=800'
    ],
    stock: 14,
    lowStockThreshold: 5,
    rating: 0,
    reviewsCount: 0,
    status: 'Active',
    features: [
      'Solid kiln-dried American Walnut',
      'Integrated 15W Qi/MagSafe charging channel',
      'Holds up to 50kg dual monitor setups',
      'Cork-lined under-shelf organization slot'
    ],
    specifications: [
      { key: 'Dimensions', value: '115cm x 23cm x 11cm' },
      { key: 'Weight', value: '4.2 kg' },
      { key: 'Material', value: 'American Black Walnut & Matte Aluminum' }
    ],
    whatsInTheBox: '1x Solid Walnut Shelf, 2x Anodized Aluminum Risers, 1x MagSafe Fast-Charging Cable, 4x Anti-slip Wool Felt Pads',
    hasVariants: false,
    options: [],
    colorImages: {},
    variantMatrix: [],
    variants: [],
    reviews: []
  },
  {
    id: 'prod-mag-keyboard',
    sku: 'KB-TITAN-75',
    slug: 'veloce-titan-75-cnc-magnetic-keyboard',
    name: 'Veloce Titan 75% CNC Magnetic Hall-Effect Keyboard',
    brand: 'Veloce Tech',
    countryOfOrigin: 'Kenya',
    country_of_origin: 'Kenya',
    description: 'Aerospace-grade CNC aluminum housing, rapid-trigger Hall effect magnetic analog switches, and dynamic per-key RGB backlighting.',
    shortDescription: 'Precision CNC 75% gaming & typing keyboard with magnetic rapid-trigger switches.',
    detailedDescription: 'The Veloce Titan 75 is engineered for uncompromising speed, tactile feedback, and endurance. Built inside an anodized 6063 aerospace aluminum case with custom sound-dampening poron foam gaskets. Features adjustable magnetic switch actuation from 0.1mm to 4.0mm with dynamic RT (Rapid Trigger) capability.',
    price: 24500,
    costPrice: 14500,
    cost_price: 14500,
    originalPrice: 28000,
    original_price: 28000,
    previousPrice: 28000,
    category: 'Electronics',
    tags: ['Keyboard', 'Hall-Effect', 'Gaming', 'Electronics', 'CNC Aluminum'],
    type: 'physical',
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=800',
    images: [
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=800'
    ],
    stock: 19,
    lowStockThreshold: 4,
    rating: 0,
    reviewsCount: 0,
    status: 'Active',
    features: [
      'Rapid Trigger analog magnetic switches',
      '0.1mm - 4.0mm customizable actuation depth',
      'Full CNC 6063 aluminum chassis with brass weight',
      '8000Hz polling rate with ultra-low 0.125ms latency'
    ],
    specifications: [
      { key: 'Layout', value: '75% Compact (82 Keys)' },
      { key: 'Connectivity', value: 'Type-C Detachable Braided Cable + 2.4GHz Wireless' },
      { key: 'Weight', value: '1.85 kg' }
    ],
    whatsInTheBox: '1x Titan 75 Keyboard, 1x Custom Aviator Coiled Cable, 1x 2-in-1 Switch & Keycap Puller, 4x Spare Magnetic Switches',
    hasVariants: false,
    options: [],
    colorImages: {},
    variantMatrix: [],
    variants: [],
    reviews: []
  },
  {
    id: 'prod-streetwear-hoodie',
    sku: 'APP-HDY-480',
    slug: 'ropenix-heavyweight-480gsm-french-terry-hoodie',
    name: 'Ropenix Heavyweight 480GSM French Terry Hoodie',
    brand: 'Ropenix Atelier',
    countryOfOrigin: 'Kenya',
    country_of_origin: 'Kenya',
    description: 'Custom milled 100% organic combed cotton in 480 GSM ultra-heavyweight knit. Double-layered structured hood and signature dropped shoulder fit.',
    shortDescription: 'Luxury heavyweight 480GSM organic cotton oversized streetwear hoodie.',
    detailedDescription: 'Crafted in Nairobi with obsessive attention to fabric weight, drape, and longevity. Milled from sustainably sourced East African organic long-staple cotton, pre-shrunk to guarantee zero size change after washing. Designed with double-needle reverse coverstitching, kangaroo pocket with reinforced bartacks, and seamless ribbed cuffs.',
    price: 6800,
    costPrice: 3200,
    cost_price: 3200,
    originalPrice: 8000,
    original_price: 8000,
    previousPrice: 8000,
    category: 'Fashion',
    tags: ['Streetwear', 'Hoodie', 'Apparel', 'Fashion', 'Organic Cotton'],
    type: 'physical',
    imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&q=80&w=800',
    images: [
      'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&q=80&w=800'
    ],
    stock: 32,
    lowStockThreshold: 8,
    rating: 0,
    reviewsCount: 0,
    status: 'Active',
    features: [
      'Ultra-heavy 480 GSM 100% organic combed French Terry',
      'Double-lined structured hood with zero drawstrings',
      'Pre-shrunk fabric with lint-free soft brushed interior',
      'Relaxed boxy silhouette with dropped shoulders'
    ],
    specifications: [
      { key: 'Material', value: '100% Organic Combed Cotton (480 GSM)' },
      { key: 'Care', value: 'Machine wash cold inside-out, hang dry' },
      { key: 'Origin', value: 'Ethically crafted in Kenya' }
    ],
    whatsInTheBox: '1x Ropenix Heavyweight Hoodie in branded dust bag with authentication card',
    hasVariants: false,
    options: [],
    colorImages: {},
    variantMatrix: [],
    variants: [],
    reviews: []
  },
  {
    id: 'prod-candle-coconut',
    sku: 'BEA-CNDL-01',
    slug: 'swahili-coast-coconut-amber-candle',
    name: 'Swahili Coast Coconut & Amber Hand-Poured Candle',
    brand: 'Kilifi Artisans',
    countryOfOrigin: 'Kenya',
    country_of_origin: 'Kenya',
    description: 'Hand-poured coconut wax with crackling wood wick and aromatic amber fragrance notes from the Kenyan coast.',
    shortDescription: 'Artisanal coconut wax candle with crackling wood wick and coastal amber aroma.',
    detailedDescription: 'Handcrafted in Kilifi using 100% natural coconut soy wax blended with pure essential oils and fragrance essences inspired by the Indian Ocean coastline. Features a sustainable FSC-certified cherry wood wick that crackles soothingly as it burns for up to 60 clean hours.',
    price: 2600,
    costPrice: 1200,
    cost_price: 1200,
    originalPrice: 3200,
    original_price: 3200,
    previousPrice: 3200,
    category: 'Beauty & Fragrances',
    tags: ['Candle', 'Fragrance', 'Handmade', 'Eco-friendly', 'Kilifi'],
    type: 'physical',
    imageUrl: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&q=80&w=800',
    images: [
      'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&q=80&w=800'
    ],
    stock: 22,
    lowStockThreshold: 6,
    rating: 0,
    reviewsCount: 0,
    status: 'Active',
    features: [
      '60+ hours burn time with zero soot',
      'FSC-certified crackling wood wick',
      'Re-usable amber glass apothecary jar with aluminium lid',
      'Non-toxic, phthalate-free, vegan formula'
    ],
    specifications: [
      { key: 'Wax Weight', value: '280g / 9.8 oz' },
      { key: 'Burn Time', value: '55 - 65 hours' },
      { key: 'Vessel', value: 'Amber Apothecary Glass' }
    ],
    whatsInTheBox: '1x Hand-Poured Amber Candle with wooden matchbox',
    hasVariants: false,
    options: [],
    colorImages: {},
    variantMatrix: [],
    variants: [],
    reviews: []
  }
];

export async function ensureDefaultProducts(db?: Database): Promise<void> {
  const database = db || (await getSqliteDb());
  const checkSeeded = database.exec("SELECT setting_value FROM app_settings WHERE setting_key = 'products_seeded_clean';");
  if (checkSeeded.length > 0 && checkSeeded[0].values.length > 0) {
    // Already seeded once in history. Do not auto-re-seed if admin intentionally deleted items.
    return;
  }

  const check = database.exec("SELECT COUNT(*) as count FROM products;");
  const count = check.length > 0 && check[0].values.length > 0 ? (check[0].values[0][0] as number) : 0;
  
  if (count > 0) {
    database.run("INSERT OR REPLACE INTO app_settings (setting_key, setting_value) VALUES ('products_seeded_clean', 'true');");
    saveSqliteDb(database);
    return;
  }

  const existingRes = database.exec("SELECT id FROM products;");
  const existingIds = new Set<string>();
  if (existingRes.length > 0) {
    existingRes[0].values.forEach((row) => {
      if (row[0]) existingIds.add(String(row[0]));
    });
  }

  const stmt = database.prepare(`
    INSERT OR REPLACE INTO products (
      id, sku, name, description, price, category, tags, type, imageUrl, images,
      stock, lowStockThreshold, variations, rating, reviewsCount, reviews, digitalFileUrl,
      previousPrice, backInStockAlert, costPrice, taxId, brand, countryOfOrigin, status, paymentRestriction,
      shortDescription, detailedDescription, features, specifications, whatsInTheBox,
      hasVariants, options, colorImages, variantMatrix, variants
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const p of DEFAULT_PRODUCTS_SEED) {
    if (existingIds.has(p.id)) continue;

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
      p.brand || null,
      p.countryOfOrigin || null,
      p.status || 'Active',
      p.paymentRestriction || 'both',
      p.shortDescription || null,
      p.detailedDescription || null,
      p.features ? JSON.stringify(p.features) : null,
      p.specifications ? JSON.stringify(p.specifications) : null,
      p.whatsInTheBox || null,
      p.hasVariants ? 1 : 0,
      p.options ? JSON.stringify(p.options) : null,
      p.colorImages ? JSON.stringify(p.colorImages) : null,
      p.variantMatrix ? JSON.stringify(p.variantMatrix) : null,
      p.variants ? JSON.stringify(p.variants) : null
    ]);
  }
  stmt.free();
  database.run("INSERT OR REPLACE INTO app_settings (setting_key, setting_value) VALUES ('products_seeded_clean', 'true');");
  saveSqliteDb(database);
  console.log('[SQLite] Seeded default catalog products (initial clean bootstrap).');
}

export async function deleteSqliteProduct(id: string): Promise<boolean> {
  const db = await getSqliteDb();
  db.run("DELETE FROM products WHERE id = ?;", [id]);
  saveSqliteDb(db);
  return true;
}

export async function deleteSqliteProductsBulk(ids: string[]): Promise<number> {
  if (!ids || ids.length === 0) return 0;
  const db = await getSqliteDb();
  let deleted = 0;
  for (const id of ids) {
    db.run("DELETE FROM products WHERE id = ?;", [id]);
    deleted++;
  }
  saveSqliteDb(db);
  return deleted;
}

// ==========================================
// Pending Registrations (OTP Verification Buffer)
// ==========================================

export async function getSqlitePendingRegistration(email: string): Promise<SqlitePendingRegistrationRecord | null> {
  if (!email) return null;
  const db = await getSqliteDb();
  const normalized = email.trim().toLowerCase();
  const stmt = db.prepare("SELECT * FROM pending_registrations WHERE LOWER(TRIM(email)) = ? LIMIT 1;");
  stmt.bind([normalized]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const obj: any = stmt.getAsObject();
  stmt.free();
  return obj;
}

export async function saveSqlitePendingRegistration(pending: {
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  password_hash: string;
  phone?: string;
  otp_hash: string;
  otp_expires_at: string;
  attempts?: number;
  max_attempts?: number;
  last_sent_at?: string;
  resend_count?: number;
  resend_window_start?: string;
  ip_address?: string;
}): Promise<SqlitePendingRegistrationRecord> {
  const db = await getSqliteDb();
  const normalizedEmail = pending.email.trim().toLowerCase();
  const id = `pend-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  // Delete any existing pending record for this email so only one exists
  db.run("DELETE FROM pending_registrations WHERE LOWER(TRIM(email)) = ?;", [normalizedEmail]);

  const stmt = db.prepare(`
    INSERT INTO pending_registrations (
      id, email, username, first_name, last_name, password_hash, phone,
      otp_hash, otp_expires_at, attempts, max_attempts, last_sent_at,
      resend_count, resend_window_start, created_at, ip_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const record: SqlitePendingRegistrationRecord = {
    id,
    email: normalizedEmail,
    username: pending.username || normalizedEmail.split('@')[0],
    first_name: pending.first_name || '',
    last_name: pending.last_name || '',
    password_hash: pending.password_hash,
    phone: pending.phone || '',
    otp_hash: pending.otp_hash,
    otp_expires_at: pending.otp_expires_at,
    attempts: pending.attempts !== undefined ? pending.attempts : 0,
    max_attempts: pending.max_attempts !== undefined ? pending.max_attempts : 5,
    last_sent_at: pending.last_sent_at || now,
    resend_count: pending.resend_count !== undefined ? pending.resend_count : 0,
    resend_window_start: pending.resend_window_start || now,
    created_at: now,
    ip_address: pending.ip_address || ''
  };

  stmt.run([
    record.id,
    record.email,
    record.username,
    record.first_name,
    record.last_name,
    record.password_hash,
    record.phone,
    record.otp_hash,
    record.otp_expires_at,
    record.attempts,
    record.max_attempts,
    record.last_sent_at,
    record.resend_count,
    record.resend_window_start,
    record.created_at,
    record.ip_address
  ]);
  stmt.free();
  saveSqliteDb(db);

  return record;
}

export async function updateSqlitePendingRegistrationAttempts(email: string, newAttempts: number): Promise<void> {
  const db = await getSqliteDb();
  const normalizedEmail = email.trim().toLowerCase();
  db.run("UPDATE pending_registrations SET attempts = ? WHERE LOWER(TRIM(email)) = ?;", [newAttempts, normalizedEmail]);
  saveSqliteDb(db);
}

export async function deleteSqlitePendingRegistration(email: string): Promise<void> {
  if (!email) return;
  const db = await getSqliteDb();
  const normalizedEmail = email.trim().toLowerCase();
  db.run("DELETE FROM pending_registrations WHERE LOWER(TRIM(email)) = ?;", [normalizedEmail]);
  saveSqliteDb(db);
}

export async function cleanupExpiredPendingRegistrations(): Promise<number> {
  const db = await getSqliteDb();
  const nowIso = new Date().toISOString();
  const checkRes = db.exec(`SELECT COUNT(*) FROM pending_registrations WHERE otp_expires_at < '${nowIso}';`);
  const count = checkRes.length > 0 ? (checkRes[0].values[0][0] as number) : 0;
  if (count > 0) {
    db.run(`DELETE FROM pending_registrations WHERE otp_expires_at < '${nowIso}';`);
    saveSqliteDb(db);
    console.info(`[Auth Cleanup] Pruned ${count} expired pending registration session(s).`);
  }
  return count;
}

export async function getFlaggedDuplicateAccounts(): Promise<any[]> {
  const db = await getSqliteDb();
  const res = db.exec("SELECT * FROM audit_flagged_duplicate_accounts ORDER BY flagged_at DESC;");
  if (res.length === 0) return [];
  const cols = res[0].columns;
  return res[0].values.map((row) => {
    const obj: any = {};
    cols.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

export interface PasswordResetTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at?: string | null;
  created_at: string;
  user_email?: string;
  ip_address?: string;
}

export async function createSqlitePasswordResetToken(data: {
  id?: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt?: string;
  userEmail?: string;
  ipAddress?: string;
}): Promise<PasswordResetTokenRecord> {
  const db = await getSqliteDb();
  const id = data.id || `prt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = data.createdAt || new Date().toISOString();

  // Invalidate previous active requests for this user_id
  db.run("UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL;", [nowIso, data.userId]);

  const stmt = db.prepare(`
    INSERT INTO password_reset_tokens (
      id, user_id, token_hash, expires_at, used_at, created_at, user_email, ip_address
    ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?);
  `);
  stmt.run([
    id,
    data.userId,
    data.tokenHash,
    data.expiresAt,
    nowIso,
    data.userEmail || null,
    data.ipAddress || null
  ]);
  stmt.free();
  saveSqliteDb(db);

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

export async function invalidatePreviousSqliteUserTokens(userId: string): Promise<void> {
  if (!userId) return;
  const db = await getSqliteDb();
  const nowIso = new Date().toISOString();
  db.run("UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL;", [nowIso, userId]);
  saveSqliteDb(db);
}

export async function getSqlitePasswordResetToken(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
  if (!tokenHash) return null;
  const db = await getSqliteDb();
  const stmt = db.prepare("SELECT * FROM password_reset_tokens WHERE token_hash = ? LIMIT 1;");
  stmt.bind([tokenHash]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const obj: any = stmt.getAsObject();
  stmt.free();
  return {
    id: String(obj.id),
    user_id: String(obj.user_id),
    token_hash: String(obj.token_hash),
    expires_at: String(obj.expires_at),
    used_at: obj.used_at ? String(obj.used_at) : null,
    created_at: String(obj.created_at),
    user_email: obj.user_email ? String(obj.user_email) : undefined,
    ip_address: obj.ip_address ? String(obj.ip_address) : undefined,
  };
}

export async function consumeSqlitePasswordResetToken(
  tokenHash: string,
  newPasswordHash: string,
  nowIso: string = new Date().toISOString()
): Promise<{ success: boolean; userId?: string; error?: string }> {
  if (!tokenHash || !newPasswordHash) {
    return { success: false, error: 'INVALID_PARAMETERS' };
  }
  const db = await getSqliteDb();

  // First verify token is valid, unused, and not expired
  const stmtCheck = db.prepare(`
    SELECT id, user_id FROM password_reset_tokens 
    WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? 
    LIMIT 1;
  `);
  stmtCheck.bind([tokenHash, nowIso]);
  if (!stmtCheck.step()) {
    stmtCheck.free();
    return { success: false, error: 'INVALID_OR_EXPIRED_TOKEN' };
  }
  const tokenRow = stmtCheck.getAsObject();
  stmtCheck.free();
  const userId = String(tokenRow.user_id);

  // Conditional single-use atomic update
  db.run(
    "UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?;",
    [nowIso, tokenHash, nowIso]
  );
  const rowsModified = db.getRowsModified();
  if (rowsModified !== 1) {
    return { success: false, error: 'TOKEN_ALREADY_USED_OR_CONCURRENT_UPDATE' };
  }

  // Update password in users table
  const stmtUser = db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?;");
  stmtUser.run([newPasswordHash, nowIso, userId]);
  stmtUser.free();

  // Atomically persist both table mutations to disk
  saveSqliteDb(db);

  return { success: true, userId };
}

export async function cleanupExpiredSqliteResetTokens(nowIso: string = new Date().toISOString()): Promise<number> {
  const db = await getSqliteDb();
  const checkRes = db.exec(`SELECT COUNT(*) FROM password_reset_tokens WHERE expires_at < '${nowIso}' OR used_at IS NOT NULL;`);
  const count = checkRes.length > 0 ? (checkRes[0].values[0][0] as number) : 0;
  if (count > 0) {
    db.run(`DELETE FROM password_reset_tokens WHERE expires_at < ? OR used_at IS NOT NULL;`, [nowIso]);
    saveSqliteDb(db);
  }
  return count;
}

export interface SqlitePasswordReset {
  id: string;
  email: string;
  token_hash: string;
  expires_at: string;
  used: number;
  attempts: number;
  created_at: string;
  ip_address?: string;
}

export async function saveSqlitePasswordReset(reset: SqlitePasswordReset): Promise<void> {
  const db = await getSqliteDb();
  const normalizedEmail = reset.email.trim().toLowerCase();
  
  // Invalidate previous active requests for this email
  db.run("UPDATE password_resets SET used = 1 WHERE LOWER(TRIM(email)) = ? AND used = 0;", [normalizedEmail]);
  
  const stmt = db.prepare(`
    INSERT INTO password_resets (
      id, email, token_hash, expires_at, used, attempts, created_at, ip_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
  `);
  stmt.run([
    reset.id,
    normalizedEmail,
    reset.token_hash,
    reset.expires_at,
    reset.used || 0,
    reset.attempts || 0,
    reset.created_at,
    reset.ip_address || null
  ]);
  stmt.free();
  saveSqliteDb(db);
}

export async function getSqliteActivePasswordReset(email: string): Promise<SqlitePasswordReset | null> {
  const db = await getSqliteDb();
  const normalizedEmail = email.trim().toLowerCase();
  const nowIso = new Date().toISOString();
  
  const stmt = db.prepare(`
    SELECT * FROM password_resets 
    WHERE LOWER(TRIM(email)) = ? AND used = 0 AND expires_at > ? 
    ORDER BY created_at DESC LIMIT 1;
  `);
  stmt.bind([normalizedEmail, nowIso]);
  
  if (stmt.step()) {
    const row = stmt.getAsObject() as unknown as SqlitePasswordReset;
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export async function markSqlitePasswordResetUsed(id: string): Promise<void> {
  const db = await getSqliteDb();
  db.run("UPDATE password_resets SET used = 1 WHERE id = ?;", [id]);
  saveSqliteDb(db);
}

export async function incrementSqlitePasswordResetAttempts(id: string): Promise<void> {
  const db = await getSqliteDb();
  db.run("UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?;", [id]);
  saveSqliteDb(db);
}

export async function updateSqliteUserPassword(email: string, passwordHash: string): Promise<boolean> {
  const db = await getSqliteDb();
  const normalizedEmail = email.trim().toLowerCase();
  const nowIso = new Date().toISOString();
  
  const stmt = db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE LOWER(TRIM(email)) = ?;");
  stmt.run([passwordHash, nowIso, normalizedEmail]);
  stmt.free();
  saveSqliteDb(db);
  return true;
}

export async function updateSqliteUserPasswordById(userId: string, passwordHash: string): Promise<boolean> {
  const db = await getSqliteDb();
  const nowIso = new Date().toISOString();
  const stmt = db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?;");
  stmt.run([passwordHash, nowIso, userId]);
  stmt.free();
  saveSqliteDb(db);
  return true;
}

// ============================================================================
// 1. ORDERS REPOSITORY
// ============================================================================

export function mapSqliteOrderRow(row: any): any {
  if (!row) return null;
  let items: any[] = [];
  try { items = typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []); } catch { items = []; }

  let notesHistory: any[] = [];
  try { notesHistory = typeof row.notesHistory === 'string' ? JSON.parse(row.notesHistory) : (row.notesHistory || []); } catch { notesHistory = []; }

  let statusHistory: any[] = [];
  try { statusHistory = typeof row.statusHistory === 'string' ? JSON.parse(row.statusHistory) : (row.statusHistory || []); } catch { statusHistory = []; }

  return {
    id: row.id,
    customerName: row.customerName || 'Customer',
    customer_name: row.customerName || 'Customer',
    customerEmail: row.customerEmail || '',
    customer_email: row.customerEmail || '',
    customerPhone: row.customerPhone || '',
    phone: row.customerPhone || '',
    userId: row.userId || null,
    items,
    total: Number(row.total || 0),
    subtotal: Number(row.subtotal !== undefined && row.subtotal !== null ? row.subtotal : row.total || 0),
    shippingFee: Number(row.shippingFee || 0),
    discount: Number(row.discount || 0),
    status: row.status || 'pending',
    paymentStatus: row.paymentStatus || 'pending',
    paymentMethod: row.paymentMethod || 'M-PESA',
    trackingNumber: row.trackingNumber || `ROP-TRK-${String(row.id).slice(-6).toUpperCase()}`,
    shippingAddress: row.shippingAddress || '',
    notes: row.notes || row.customNote || '',
    date: row.date || row.created_at || new Date().toISOString(),
    created_at: row.created_at || row.date || new Date().toISOString(),
    updated_at: row.updated_at || row.created_at || new Date().toISOString(),
    notesHistory,
    statusHistory,
    isGuest: Boolean(row.isGuest),
    checkoutChannel: row.checkoutChannel || 'web',
    review_request_sent_at: row.review_request_sent_at || null,
    review_request_status: row.review_request_status || null,
    paymentConfirmedAt: row.paymentConfirmedAt || null,
    paymentConfirmedBy: row.paymentConfirmedBy || null,
    paymentReference: row.paymentReference || null,
    paymentAmount: row.paymentAmount !== undefined && row.paymentAmount !== null ? Number(row.paymentAmount) : null,
    paymentReminderCount: Number(row.paymentReminderCount || 0),
    lastPaymentReminderAt: row.lastPaymentReminderAt || null,
    isPaid: Boolean(row.isPaid || row.paymentStatus === 'paid'),
    paidAt: row.paidAt || row.paymentConfirmedAt || null,
    deliveryConfirmed: Boolean(row.deliveryConfirmed),
    deliveredAt: row.deliveredAt || null,
    deliveryPerson: row.deliveryPerson || null,
    deliveryNote: row.deliveryNote || null,
  };
}

export async function getAllSqliteOrders(): Promise<any[]> {
  const db = await getSqliteDb();
  const res = db.exec("SELECT * FROM orders ORDER BY COALESCE(created_at, date) DESC;");
  if (res.length === 0) return [];
  const cols = res[0].columns;
  return res[0].values.map((val) => {
    const raw: any = {};
    cols.forEach((col, i) => { raw[col] = val[i]; });
    return mapSqliteOrderRow(raw);
  });
}

export async function getSqliteOrderById(id: string): Promise<any | null> {
  if (!id) return null;
  const db = await getSqliteDb();
  const stmt = db.prepare("SELECT * FROM orders WHERE id = ? LIMIT 1;");
  stmt.bind([String(id).trim()]);
  if (stmt.step()) {
    const raw = stmt.getAsObject();
    stmt.free();
    return mapSqliteOrderRow(raw);
  }
  stmt.free();
  return null;
}

export async function getSqliteOrdersByUser(email?: string, userId?: string): Promise<any[]> {
  const db = await getSqliteDb();
  const normEmail = email ? email.trim().toLowerCase() : '';
  const safeUserId = userId ? String(userId).trim() : '';

  let query = "SELECT * FROM orders WHERE 1=0";
  const params: string[] = [];

  if (normEmail && safeUserId) {
    query = "SELECT * FROM orders WHERE LOWER(TRIM(customerEmail)) = ? OR userId = ? ORDER BY COALESCE(created_at, date) DESC;";
    params.push(normEmail, safeUserId);
  } else if (normEmail) {
    query = "SELECT * FROM orders WHERE LOWER(TRIM(customerEmail)) = ? ORDER BY COALESCE(created_at, date) DESC;";
    params.push(normEmail);
  } else if (safeUserId) {
    query = "SELECT * FROM orders WHERE userId = ? ORDER BY COALESCE(created_at, date) DESC;";
    params.push(safeUserId);
  } else {
    return [];
  }

  const stmt = db.prepare(query);
  stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(mapSqliteOrderRow(stmt.getAsObject()));
  }
  stmt.free();
  return rows;
}

export async function saveSqliteOrder(order: any): Promise<any> {
  const db = await getSqliteDb();
  const id = order.id || `ord-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const customerName = order.customerName || order.customer_name || 'Valued Customer';
  const customerEmail = (order.customerEmail || order.customer_email || '').trim().toLowerCase();
  const customerPhone = order.customerPhone || order.phone || order.customer_phone || '';
  const itemsJson = typeof order.items === 'string' ? order.items : JSON.stringify(order.items || []);
  const total = Number(order.total || 0);
  const subtotal = Number(order.subtotal !== undefined ? order.subtotal : order.total || 0);
  const shippingFee = Number(order.shippingFee || 0);
  const discount = Number(order.discount || 0);
  const status = order.status || 'pending';
  const date = order.date || order.created_at || nowIso;
  const couponCode = order.couponCode || null;
  const customNote = order.customNote || order.notes || null;
  const shippingAddress = order.shippingAddress || order.shipping_address || null;
  const notesHistoryJson = order.notesHistory ? JSON.stringify(order.notesHistory) : null;
  const statusHistoryJson = order.statusHistory ? JSON.stringify(order.statusHistory) : null;
  const isGuest = order.isGuest ? 1 : 0;
  const paymentMethod = order.paymentMethod || order.payment_method || 'M-PESA';
  const checkoutChannel = order.checkoutChannel || 'web';
  const reviewRequestSentAt = order.review_request_sent_at || null;
  const reviewRequestStatus = order.review_request_status || null;
  const paymentStatus = order.paymentStatus || 'pending';
  const trackingNumber = order.trackingNumber || `ROP-TRK-${String(id).slice(-6).toUpperCase()}`;
  const notes = order.notes || customNote || '';
  const userId = order.userId ? String(order.userId) : null;
  const createdAt = order.created_at || order.createdAt || date;
  const updatedAt = nowIso;
  const paymentReference = order.paymentReference || null;
  const paymentAmount = order.paymentAmount !== undefined && order.paymentAmount !== null ? Number(order.paymentAmount) : null;
  const paymentConfirmedAt = order.paymentConfirmedAt || order.paidAt || null;
  const paymentConfirmedBy = order.paymentConfirmedBy || null;
  const paymentReminderCount = Number(order.paymentReminderCount || 0);
  const lastPaymentReminderAt = order.lastPaymentReminderAt || null;

  const isPaid = order.isPaid !== undefined ? (order.isPaid ? 1 : 0) : (paymentStatus === 'paid' ? 1 : 0);
  const paidAt = order.paidAt || paymentConfirmedAt || (isPaid ? nowIso : null);
  const deliveryConfirmed = order.deliveryConfirmed ? 1 : 0;
  const deliveredAt = order.deliveredAt || null;
  const deliveryPerson = order.deliveryPerson || null;
  const deliveryNote = order.deliveryNote || null;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO orders (
      id, customerName, customerEmail, items, total, status, date, couponCode,
      customNote, shippingAddress, notesHistory, statusHistory, isGuest, paymentMethod,
      checkoutChannel, review_request_sent_at, review_request_status, paymentStatus,
      shippingFee, discount, subtotal, trackingNumber, customerPhone, notes, userId,
      created_at, updated_at, paymentReference, paymentAmount, paymentConfirmedAt,
      paymentConfirmedBy, paymentReminderCount, lastPaymentReminderAt,
      isPaid, paidAt, deliveryConfirmed, deliveredAt, deliveryPerson, deliveryNote
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  stmt.run([
    id, customerName, customerEmail, itemsJson, total, status, date, couponCode,
    customNote, shippingAddress, notesHistoryJson, statusHistoryJson, isGuest, paymentMethod,
    checkoutChannel, reviewRequestSentAt, reviewRequestStatus, paymentStatus,
    shippingFee, discount, subtotal, trackingNumber, customerPhone, notes, userId,
    createdAt, updatedAt, paymentReference, paymentAmount, paymentConfirmedAt,
    paymentConfirmedBy, paymentReminderCount, lastPaymentReminderAt,
    isPaid, paidAt, deliveryConfirmed, deliveredAt, deliveryPerson, deliveryNote
  ]);
  stmt.free();
  saveSqliteDb(db);

  return getSqliteOrderById(id);
}

export async function updateSqliteOrderStatus(id: string, updates: Record<string, any>): Promise<any | null> {
  const existing = await getSqliteOrderById(id);
  if (!existing) return null;

  const merged = { ...existing, ...updates, updated_at: new Date().toISOString() };
  return saveSqliteOrder(merged);
}

export async function deleteSqliteOrder(id: string): Promise<boolean> {
  const db = await getSqliteDb();
  db.run("DELETE FROM orders WHERE id = ?;", [id]);
  saveSqliteDb(db);
  return true;
}

export async function syncSqliteOrders(ordersList: any[]): Promise<void> {
  if (!Array.isArray(ordersList)) return;
  for (const ord of ordersList) {
    if (ord && ord.id) {
      await saveSqliteOrder(ord);
    }
  }
}

// ============================================================================
// 2. REVIEWS REPOSITORY
// ============================================================================

export function mapSqliteReviewRow(row: any): any {
  if (!row) return null;
  let mediaUrls: string[] = [];
  try { mediaUrls = typeof row.mediaUrls === 'string' ? JSON.parse(row.mediaUrls) : (row.mediaUrls || []); } catch { mediaUrls = []; }

  let helpfulUserIds: string[] = [];
  try { helpfulUserIds = typeof row.helpfulUserIds === 'string' ? JSON.parse(row.helpfulUserIds) : (row.helpfulUserIds || []); } catch { helpfulUserIds = []; }

  return {
    id: row.id,
    productId: row.productId,
    orderId: row.orderId || undefined,
    userId: row.userId || null,
    userEmail: row.userEmail || '',
    userName: row.userName || 'Verified Buyer',
    reviewerDisplayName: row.reviewerDisplayName || row.userName || 'Anonymous',
    rating: Number(row.rating !== undefined && row.rating !== null ? row.rating : 0),
    title: row.title || '',
    comment: row.comment || '',
    mediaUrls,
    verifiedPurchase: Boolean(row.verified === 1 || row.orderId || row.verifiedPurchase),
    status: row.status || 'Published',
    date: row.date || row.createdAt || new Date().toISOString().split('T')[0],
    createdAt: row.createdAt || row.date || new Date().toISOString(),
    updatedAt: row.updatedAt || undefined,
    helpfulVotes: Number(row.helpfulVotes || 0),
    helpfulUserIds,
    purchasedVariant: row.purchasedVariant || undefined,
    isEdited: Boolean(row.isEdited),
  };
}

export async function getAllSqliteReviews(): Promise<any[]> {
  const db = await getSqliteDb();
  const res = db.exec("SELECT * FROM reviews ORDER BY COALESCE(createdAt, date) DESC;");
  if (res.length === 0) return [];
  const cols = res[0].columns;
  return res[0].values.map((val) => {
    const raw: any = {};
    cols.forEach((col, i) => { raw[col] = val[i]; });
    return mapSqliteReviewRow(raw);
  });
}

export async function recomputeSqliteProductRating(productId: string): Promise<{ rating: number; reviewsCount: number }> {
  if (!productId) return { rating: 0, reviewsCount: 0 };
  const db = await getSqliteDb();
  const stmt = db.prepare("SELECT * FROM reviews WHERE productId = ? AND status NOT IN ('Hidden', 'Removed') ORDER BY COALESCE(createdAt, date) DESC;");
  stmt.bind([String(productId).trim()]);

  const activeReviews: any[] = [];
  let sum = 0;
  while (stmt.step()) {
    const mapped = mapSqliteReviewRow(stmt.getAsObject());
    activeReviews.push(mapped);
    sum += mapped.rating;
  }
  stmt.free();

  const reviewsCount = activeReviews.length;
  const rating = reviewsCount > 0 ? Math.round((sum / reviewsCount) * 10) / 10 : 0;
  const reviewsJson = JSON.stringify(activeReviews);

  db.run("UPDATE products SET rating = ?, reviewsCount = ?, reviews = ? WHERE id = ?;", [
    rating,
    reviewsCount,
    reviewsJson,
    String(productId).trim(),
  ]);
  saveSqliteDb(db);

  return { rating, reviewsCount };
}

export async function getSqliteReviewsByProduct(productId: string, options?: { rating?: number; sort?: string }): Promise<{ reviews: any[]; summary: any }> {
  const db = await getSqliteDb();
  const stmt = db.prepare("SELECT * FROM reviews WHERE productId = ? AND status NOT IN ('Hidden', 'Removed') ORDER BY COALESCE(createdAt, date) DESC;");
  stmt.bind([String(productId).trim()]);

  const allReviews: any[] = [];
  while (stmt.step()) {
    allReviews.push(mapSqliteReviewRow(stmt.getAsObject()));
  }
  stmt.free();

  let filtered = [...allReviews];
  if (options?.rating) {
    const ratingNum = Number(options.rating);
    filtered = filtered.filter((r) => Math.floor(r.rating) === ratingNum);
  }

  const sort = options?.sort || 'recent';
  if (sort === 'highest') {
    filtered.sort((a, b) => b.rating - a.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sort === 'lowest') {
    filtered.sort((a, b) => a.rating - b.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sort === 'helpful') {
    filtered.sort((a, b) => (b.helpfulVotes || 0) - (a.helpfulVotes || 0));
  } else {
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const totalCount = allReviews.length;
  const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let totalSum = 0;

  allReviews.forEach((r) => {
    const star = Math.min(5, Math.max(1, Math.floor(r.rating)));
    distribution[star] = (distribution[star] || 0) + 1;
    totalSum += r.rating;
  });

  const average = totalCount > 0 ? Math.round((totalSum / totalCount) * 10) / 10 : 0;

  return {
    reviews: filtered,
    summary: {
      average,
      totalCount,
      distribution,
    },
  };
}

export async function saveSqliteReview(review: any): Promise<any> {
  const db = await getSqliteDb();
  const id = review.id || `rev-${Date.now()}`;
  const nowIso = new Date().toISOString();
  const dateStr = review.date || nowIso.split('T')[0];
  const mediaUrlsJson = JSON.stringify(Array.isArray(review.mediaUrls) ? review.mediaUrls : []);
  const helpfulUserIdsJson = JSON.stringify(Array.isArray(review.helpfulUserIds) ? review.helpfulUserIds : []);

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO reviews (
      id, productId, orderId, userName, userEmail, reviewerDisplayName,
      rating, title, comment, mediaUrls, verified, status, date,
      helpfulVotes, helpfulUserIds, purchasedVariant, isEdited,
      createdAt, updatedAt, userId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  stmt.run([
    id,
    review.productId,
    review.orderId || null,
    review.userName || 'Anonymous Customer',
    review.userEmail ? review.userEmail.toLowerCase().trim() : '',
    review.reviewerDisplayName || review.userName || 'Anonymous',
    Number(review.rating !== undefined && review.rating !== null ? review.rating : 5),
    review.title || '',
    review.comment || '',
    mediaUrlsJson,
    review.verifiedPurchase ? 1 : (review.verified ? 1 : 0),
    review.status || 'Published',
    dateStr,
    Number(review.helpfulVotes || 0),
    helpfulUserIdsJson,
    review.purchasedVariant || null,
    review.isEdited ? 1 : 0,
    review.createdAt || nowIso,
    review.updatedAt || nowIso,
    review.userId ? String(review.userId) : null,
  ]);
  stmt.free();
  saveSqliteDb(db);

  // Automatically recompute the product's real average rating and count
  await recomputeSqliteProductRating(review.productId);

  return mapSqliteReviewRow(review);
}

export async function updateSqliteReview(id: string, updates: Record<string, any>): Promise<any | null> {
  const db = await getSqliteDb();
  const stmt = db.prepare("SELECT * FROM reviews WHERE id = ? LIMIT 1;");
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const existing = mapSqliteReviewRow(stmt.getAsObject());
  stmt.free();

  const merged = {
    ...existing,
    ...updates,
    isEdited: true,
    updatedAt: new Date().toISOString(),
  };

  const saved = await saveSqliteReview(merged);
  await recomputeSqliteProductRating(existing.productId);
  return saved;
}

export async function deleteSqliteReview(id: string): Promise<boolean> {
  const db = await getSqliteDb();
  const stmt = db.prepare("SELECT productId FROM reviews WHERE id = ? LIMIT 1;");
  stmt.bind([id]);
  let productId: string | null = null;
  if (stmt.step()) {
    productId = stmt.getAsObject().productId as string;
  }
  stmt.free();

  db.run("UPDATE reviews SET status = 'Removed', updatedAt = ? WHERE id = ?;", [new Date().toISOString(), id]);
  saveSqliteDb(db);

  if (productId) {
    await recomputeSqliteProductRating(productId);
  }
  return true;
}

export async function toggleSqliteReviewHelpful(id: string, voterId: string): Promise<{ helpfulVotes: number; voted: boolean } | null> {
  const db = await getSqliteDb();
  const stmt = db.prepare("SELECT * FROM reviews WHERE id = ? LIMIT 1;");
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const review = mapSqliteReviewRow(stmt.getAsObject());
  stmt.free();

  const helpfulUserIds: string[] = review.helpfulUserIds || [];
  const alreadyVoted = helpfulUserIds.includes(voterId);
  let newHelpfulUserIds: string[];
  let newHelpfulVotes: number;

  if (alreadyVoted) {
    newHelpfulUserIds = helpfulUserIds.filter((v) => v !== voterId);
    newHelpfulVotes = Math.max(0, (review.helpfulVotes || 1) - 1);
  } else {
    newHelpfulUserIds = [...helpfulUserIds, voterId];
    newHelpfulVotes = (review.helpfulVotes || 0) + 1;
  }

  db.run(
    "UPDATE reviews SET helpfulVotes = ?, helpfulUserIds = ?, updatedAt = ? WHERE id = ?;",
    [newHelpfulVotes, JSON.stringify(newHelpfulUserIds), new Date().toISOString(), id]
  );
  saveSqliteDb(db);

  return { helpfulVotes: newHelpfulVotes, voted: !alreadyVoted };
}

export async function updateSqliteReviewStatus(id: string, status: string): Promise<any | null> {
  const db = await getSqliteDb();
  db.run("UPDATE reviews SET status = ?, updatedAt = ? WHERE id = ?;", [status, new Date().toISOString(), id]);
  saveSqliteDb(db);

  const stmt = db.prepare("SELECT * FROM reviews WHERE id = ? LIMIT 1;");
  stmt.bind([id]);
  if (stmt.step()) {
    const raw = stmt.getAsObject();
    stmt.free();
    const mapped = mapSqliteReviewRow(raw);
    await recomputeSqliteProductRating(mapped.productId);
    return mapped;
  }
  stmt.free();
  return null;
}

// ============================================================================
// 3. REVIEW AUTOMATION & SETTINGS REPOSITORY
// ============================================================================

export async function getSqliteReviewRequestLogs(): Promise<any[]> {
  const db = await getSqliteDb();
  const res = db.exec("SELECT * FROM review_request_logs ORDER BY created_at DESC;");
  if (res.length === 0) return [];
  const cols = res[0].columns;
  return res[0].values.map((val) => {
    const raw: any = {};
    cols.forEach((col, i) => { raw[col] = val[i]; });
    return raw;
  });
}

export async function addSqliteReviewRequestLog(log: any): Promise<any> {
  const db = await getSqliteDb();
  const id = log.id || `rlog-${Date.now()}`;
  const nowIso = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO review_request_logs (id, order_id, customer_email, customer_name, sent_at, status, product_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
  `);
  stmt.run([
    id,
    log.order_id || log.orderId || null,
    log.customer_email || log.customerEmail || '',
    log.customer_name || log.customerName || '',
    log.sent_at || log.sentAt || nowIso,
    log.status || 'sent',
    log.product_id || log.productId || null,
    nowIso,
  ]);
  stmt.free();
  saveSqliteDb(db);
  return { id, ...log, created_at: nowIso };
}

export async function getSqliteReviewRequestSettings(): Promise<{
  enabled: boolean;
  delayDays: number;
  autoTriggerOnDelivery: boolean;
  incentiveDiscountPercent: number;
}> {
  const db = await getSqliteDb();
  const defaults = {
    enabled: true,
    delayDays: 3,
    autoTriggerOnDelivery: true,
    incentiveDiscountPercent: 10,
  };
  const res = db.exec("SELECT setting_key, setting_value FROM review_request_settings;");
  if (res.length === 0) return defaults;
  const result: any = { ...defaults };
  for (const row of res[0].values) {
    const key = String(row[0]);
    const val = String(row[1]);
    if (key === 'enabled') result.enabled = val === 'true' || val === '1';
    if (key === 'delayDays') result.delayDays = Number(val) || 3;
    if (key === 'autoTriggerOnDelivery') result.autoTriggerOnDelivery = val === 'true' || val === '1';
    if (key === 'incentiveDiscountPercent') result.incentiveDiscountPercent = Number(val) || 10;
  }
  return result;
}

export async function saveSqliteReviewRequestSettings(settings: Partial<{
  enabled: boolean;
  delayDays: number;
  autoTriggerOnDelivery: boolean;
  incentiveDiscountPercent: number;
}>): Promise<any> {
  const db = await getSqliteDb();
  const current = await getSqliteReviewRequestSettings();
  const merged = { ...current, ...settings };

  const stmt = db.prepare("INSERT OR REPLACE INTO review_request_settings (setting_key, setting_value) VALUES (?, ?);");
  stmt.run(['enabled', String(merged.enabled)]);
  stmt.run(['delayDays', String(merged.delayDays)]);
  stmt.run(['autoTriggerOnDelivery', String(merged.autoTriggerOnDelivery)]);
  stmt.run(['incentiveDiscountPercent', String(merged.incentiveDiscountPercent)]);
  stmt.free();
  saveSqliteDb(db);

  return merged;
}

export async function addSqliteReviewOptOut(email: string): Promise<void> {
  if (!email) return;
  const db = await getSqliteDb();
  const normEmail = email.trim().toLowerCase();
  db.run("INSERT OR REPLACE INTO review_opt_outs (email, opt_out, updated_at) VALUES (?, 1, ?);", [normEmail, new Date().toISOString()]);
  saveSqliteDb(db);
}

export async function getSqliteReviewOptOutsCount(): Promise<number> {
  const db = await getSqliteDb();
  const res = db.exec("SELECT COUNT(*) FROM review_opt_outs WHERE opt_out = 1;");
  return res.length > 0 ? (res[0].values[0][0] as number) : 0;
}

// ============================================================================
// 4. CARTS REPOSITORY
// ============================================================================

export async function getSqliteCart(cartKey: string): Promise<any[]> {
  if (!cartKey) return [];
  const db = await getSqliteDb();
  const safeKey = String(cartKey).trim();
  const stmt = db.prepare("SELECT items FROM carts WHERE user_id = ? OR session_id = ? OR id = ? LIMIT 1;");
  stmt.bind([safeKey, safeKey, safeKey]);
  if (stmt.step()) {
    const raw = stmt.getAsObject();
    stmt.free();
    try {
      const parsed = typeof raw.items === 'string' ? JSON.parse(raw.items) : raw.items;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  stmt.free();
  return [];
}

export async function saveSqliteCart(cartKey: string, items: any[]): Promise<any[]> {
  const db = await getSqliteDb();
  const safeKey = (cartKey || 'guest_default').trim();
  const itemsJson = JSON.stringify(Array.isArray(items) ? items : []);
  const nowIso = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO carts (id, user_id, session_id, items, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET items = excluded.items, updated_at = excluded.updated_at;
  `);
  stmt.run([`cart-${safeKey}`, safeKey, safeKey, itemsJson, nowIso]);
  stmt.free();
  saveSqliteDb(db);
  return items;
}

export async function clearSqliteCart(cartKey: string): Promise<void> {
  const db = await getSqliteDb();
  const safeKey = (cartKey || 'guest_default').trim();
  db.run("DELETE FROM carts WHERE user_id = ? OR session_id = ? OR id = ?;", [safeKey, safeKey, `cart-${safeKey}`]);
  saveSqliteDb(db);
}

// ============================================================================
// 5. WISHLISTS REPOSITORY
// ============================================================================

export async function getSqliteWishlist(userOrSessionKey: string = 'default'): Promise<string[]> {
  const db = await getSqliteDb();
  const safeKey = (userOrSessionKey || 'default').trim();
  const stmt = db.prepare("SELECT product_id FROM wishlists WHERE user_id = ?;");
  stmt.bind([safeKey]);
  const productIds: string[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    if (row.product_id) productIds.push(String(row.product_id));
  }
  stmt.free();
  return productIds;
}

export async function addToSqliteWishlist(userOrSessionKey: string, productId: string): Promise<string[]> {
  if (!productId) return getSqliteWishlist(userOrSessionKey);
  const db = await getSqliteDb();
  const safeKey = (userOrSessionKey || 'default').trim();
  const prodIdStr = String(productId).trim();
  const id = `wish-${safeKey}-${prodIdStr}`;

  db.run("INSERT OR IGNORE INTO wishlists (id, user_id, product_id, created_at) VALUES (?, ?, ?, ?);", [
    id,
    safeKey,
    prodIdStr,
    new Date().toISOString(),
  ]);
  saveSqliteDb(db);

  return getSqliteWishlist(safeKey);
}

export async function removeFromSqliteWishlist(userOrSessionKey: string, productId: string): Promise<string[]> {
  const db = await getSqliteDb();
  const safeKey = (userOrSessionKey || 'default').trim();
  const prodIdStr = String(productId).trim();

  db.run("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?;", [safeKey, prodIdStr]);
  saveSqliteDb(db);

  return getSqliteWishlist(safeKey);
}

// ============================================================================
// 6. CUSTOM CLOTHING REQUESTS REPOSITORY
// ============================================================================

export function mapSqliteCustomClothingRow(row: any): any {
  if (!row) return null;
  let materialSamples: string[] = [];
  try { materialSamples = typeof row.material_samples === 'string' ? JSON.parse(row.material_samples) : (row.material_samples || []); } catch { materialSamples = []; }

  let designImages: string[] = [];
  try { designImages = typeof row.design_images === 'string' ? JSON.parse(row.design_images) : (row.design_images || []); } catch { designImages = []; }

  let designVideos: string[] = [];
  try { designVideos = typeof row.design_videos === 'string' ? JSON.parse(row.design_videos) : (row.design_videos || []); } catch { designVideos = []; }

  let designLinks: string[] = [];
  try { designLinks = typeof row.design_links === 'string' ? JSON.parse(row.design_links) : (row.design_links || []); } catch { designLinks = []; }

  let measurements: any = {};
  try { measurements = typeof row.measurements === 'string' ? JSON.parse(row.measurements) : (row.measurements || {}); } catch { measurements = {}; }

  return {
    id: row.id,
    referenceNo: row.reference_no,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone || '',
    garmentType: row.garment_type,
    otherGarmentType: row.other_garment_type || '',
    materialSamples,
    designImages,
    designVideos,
    designLinks,
    measurements,
    preferredDeadline: row.preferred_deadline || null,
    budgetRange: row.budget_range || '',
    additionalNotes: row.additional_notes || '',
    deliveryLocation: row.delivery_location || '',
    status: row.status || 'Pending Review',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export async function getSqliteCustomClothingRequests(filters?: { status?: string; search?: string }): Promise<any[]> {
  const db = await getSqliteDb();
  const res = db.exec("SELECT * FROM custom_clothing_requests ORDER BY created_at DESC;");
  if (res.length === 0) return [];
  const cols = res[0].columns;
  let list = res[0].values.map((val) => {
    const raw: any = {};
    cols.forEach((col, i) => { raw[col] = val[i]; });
    return mapSqliteCustomClothingRow(raw);
  });

  if (filters?.status) {
    const s = filters.status.toLowerCase();
    list = list.filter((r) => r.status && r.status.toLowerCase() === s);
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter((r) =>
      (r.referenceNo && r.referenceNo.toLowerCase().includes(q)) ||
      (r.fullName && r.fullName.toLowerCase().includes(q)) ||
      (r.email && r.email.toLowerCase().includes(q)) ||
      (r.garmentType && r.garmentType.toLowerCase().includes(q))
    );
  }

  return list;
}

export async function getSqliteCustomClothingRequestById(id: string): Promise<any | null> {
  const db = await getSqliteDb();
  const stmt = db.prepare("SELECT * FROM custom_clothing_requests WHERE id = ? OR reference_no = ? LIMIT 1;");
  stmt.bind([id, id]);
  if (stmt.step()) {
    const raw = stmt.getAsObject();
    stmt.free();
    return mapSqliteCustomClothingRow(raw);
  }
  stmt.free();
  return null;
}

export async function saveSqliteCustomClothingRequest(req: any): Promise<any> {
  const db = await getSqliteDb();
  const id = req.id || `req-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const refNo = req.referenceNo || req.reference_no || `ROP-CC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const nowIso = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO custom_clothing_requests (
      id, reference_no, full_name, email, phone, garment_type, other_garment_type,
      material_samples, design_images, design_videos, design_links,
      measurements, preferred_deadline, budget_range, additional_notes, delivery_location,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  stmt.run([
    id,
    refNo,
    (req.fullName || req.full_name || '').trim(),
    (req.email || '').trim().toLowerCase(),
    (req.phone || '').trim(),
    (req.garmentType || req.garment_type || 'Custom Garment').trim(),
    (req.otherGarmentType || req.other_garment_type || '').trim(),
    JSON.stringify(Array.isArray(req.materialSamples) ? req.materialSamples : []),
    JSON.stringify(Array.isArray(req.designImages) ? req.designImages : []),
    JSON.stringify(Array.isArray(req.designVideos) ? req.designVideos : []),
    JSON.stringify(Array.isArray(req.designLinks) ? req.designLinks : []),
    JSON.stringify(req.measurements || {}),
    req.preferredDeadline || req.preferred_deadline || null,
    (req.budgetRange || req.budget_range || '').trim(),
    (req.additionalNotes || req.additional_notes || '').trim(),
    (req.deliveryLocation || req.delivery_location || '').trim(),
    req.status || 'Pending Review',
    req.createdAt || req.created_at || nowIso,
    nowIso,
  ]);
  stmt.free();
  saveSqliteDb(db);

  return getSqliteCustomClothingRequestById(id);
}

export async function updateSqliteCustomClothingRequestStatus(id: string, status: string): Promise<any | null> {
  const db = await getSqliteDb();
  db.run("UPDATE custom_clothing_requests SET status = ?, updated_at = ? WHERE id = ? OR reference_no = ?;", [
    status,
    new Date().toISOString(),
    id,
    id,
  ]);
  saveSqliteDb(db);
  return getSqliteCustomClothingRequestById(id);
}

// ============================================================================
// 7. INVENTORY AUDIT LOGS REPOSITORY
// ============================================================================

export async function getSqliteInventoryAuditLogs(limit: number = 100): Promise<any[]> {
  const db = await getSqliteDb();
  const stmt = db.prepare("SELECT * FROM inventory_audit_logs ORDER BY timestamp DESC LIMIT ?;");
  stmt.bind([limit]);
  const logs: any[] = [];
  while (stmt.step()) {
    logs.push(stmt.getAsObject());
  }
  stmt.free();
  return logs;
}

export async function addSqliteInventoryAuditLog(log: {
  productId: string;
  productName: string;
  productSku?: string;
  changeQuantity: number;
  newStock: number;
  reason: string;
  details?: string;
}): Promise<any> {
  const db = await getSqliteDb();
  const id = `inv-log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const timestamp = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO inventory_audit_logs (
      id, productId, productName, productSku, timestamp, changeQuantity, newStock, reason, details
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);
  stmt.run([
    id,
    log.productId,
    log.productName,
    log.productSku || '',
    timestamp,
    log.changeQuantity,
    log.newStock,
    log.reason,
    log.details || '',
  ]);
  stmt.free();
  saveSqliteDb(db);

  return { id, timestamp, ...log };
}




