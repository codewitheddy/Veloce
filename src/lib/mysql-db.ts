/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Ropenix Unified MySQL Database Engine
 * Primary and standalone database layer powered by MySQL (mysql2/promise).
 * Configured for local XAMPP and production MySQL environments.
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
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

dotenv.config();

let dbPool: mysql.Pool | null = null;
let isInitialized = false;
let isInitializing = false;

// Host sanitize helper
export function getDbHost(): string {
  let host = (process.env.DB_HOST || '127.0.0.1').trim();
  if (host === 'localhhost' || host === 'localhost') {
    host = '127.0.0.1';
  }
  return host;
}

export function getDbUser(): string {
  return (process.env.DB_USER || 'root').trim();
}

export function getDbPassword(): string {
  return process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '';
}

export function getDbName(): string {
  return (process.env.DB_NAME || 'ropenix').trim();
}

export function getDbPort(): number {
  return Number(process.env.DB_PORT) || 3306;
}

// Return true if MySQL credentials are ready
export function isDbConfigured(): boolean {
  return true;
}

// Get or initialize MySQL connection pool (with auto-database creation for XAMPP)
export async function getDbPool(): Promise<mysql.Pool> {
  if (dbPool) {
    return dbPool;
  }

  const host = getDbHost();
  const user = getDbUser();
  const password = getDbPassword();
  const database = getDbName();
  const port = getDbPort();

  try {
    // 1. Ensure database exists on server (creates 'ropenix' in XAMPP if not present)
    try {
      const rootConn = await mysql.createConnection({
        host,
        port,
        user,
        password,
        connectTimeout: 4000,
      });
      await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await rootConn.end();
    } catch (createDbErr: any) {
      console.warn('[MySQL] Database existence check notice:', createDbErr.message || createDbErr);
    }

    // 2. Create connection pool with target database
    dbPool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      connectTimeout: 6000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });

    // Test connection
    const testConn = await dbPool.getConnection();
    console.log(`[MySQL] Successfully connected to MySQL database: ${database}@${host}:${port}`);
    testConn.release();

    if (!isInitialized && !isInitializing) {
      await initializeDatabaseSchema();
    }

    return dbPool;
  } catch (error: any) {
    console.warn('[MySQL] Connection pool attempt failed:', error.message || error);
    if (dbPool) {
      try {
        await dbPool.end();
      } catch (_) {}
    }
    dbPool = null;
    throw error;
  }
}

// Initialize all database schemas
export async function initializeDatabaseSchema(): Promise<void> {
  if (isInitialized) return;
  isInitializing = true;

  try {
    const pool = dbPool || (await getDbPool());
    console.log('[MySQL] Verifying and initializing database schema tables...');

    // 1. Users Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(255) NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(255) NULL,
        last_name VARCHAR(255) NULL,
        phone VARCHAR(100) NULL,
        role VARCHAR(50) DEFAULT 'customer',
        is_staff TINYINT(1) DEFAULT 0,
        is_superuser TINYINT(1) DEFAULT 0,
        email_verified TINYINT(1) DEFAULT 1,
        avatar_url LONGTEXT NULL,
        referral_code VARCHAR(100) NULL,
        partner_tier VARCHAR(50) DEFAULT 'Silver',
        address TEXT NULL,
        city VARCHAR(100) NULL,
        country VARCHAR(100) NULL,
        created_at VARCHAR(100) NOT NULL,
        updated_at VARCHAR(100) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Products Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(255) PRIMARY KEY,
        sku VARCHAR(255) NULL,
        slug VARCHAR(255) NULL,
        name VARCHAR(255) NOT NULL,
        brand VARCHAR(255) NULL,
        country_of_origin VARCHAR(255) NULL,
        description TEXT NULL,
        shortDescription TEXT NULL,
        detailedDescription LONGTEXT NULL,
        price DECIMAL(15, 2) NOT NULL,
        originalPrice DECIMAL(15, 2) NULL,
        costPrice DECIMAL(15, 2) NULL,
        previousPrice DECIMAL(15, 2) NULL,
        category VARCHAR(255) NULL,
        subcategory VARCHAR(255) NULL,
        tags TEXT NULL,
        type VARCHAR(50) NOT NULL,
        imageUrl LONGTEXT NULL,
        images LONGTEXT NULL,
        stock INT DEFAULT 0,
        lowStockThreshold INT DEFAULT 5,
        rating DECIMAL(3, 2) DEFAULT 0,
        reviewsCount INT DEFAULT 0,
        variations LONGTEXT NULL,
        reviews LONGTEXT NULL,
        features LONGTEXT NULL,
        specifications LONGTEXT NULL,
        whatsInTheBox LONGTEXT NULL,
        digitalFileUrl LONGTEXT NULL,
        status VARCHAR(50) DEFAULT 'Active',
        paymentRestriction VARCHAR(50) DEFAULT 'both',
        backInStockAlert TINYINT(1) DEFAULT 0,
        created_at VARCHAR(100) NULL,
        updated_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. Orders Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(255) PRIMARY KEY,
        customerName VARCHAR(255) NOT NULL,
        customerEmail VARCHAR(255) NOT NULL,
        customerPhone VARCHAR(100) NULL,
        items LONGTEXT NOT NULL,
        total DECIMAL(15, 2) NOT NULL,
        status VARCHAR(50) NOT NULL,
        date VARCHAR(100) NOT NULL,
        couponCode VARCHAR(255) NULL,
        customNote TEXT NULL,
        shippingAddress LONGTEXT NULL,
        notesHistory LONGTEXT NULL,
        statusHistory LONGTEXT NULL,
        isGuest TINYINT(1) DEFAULT 0,
        paymentMethod VARCHAR(50) DEFAULT 'cod',
        checkoutChannel VARCHAR(50) DEFAULT 'web',
        paymentStatus VARCHAR(50) DEFAULT 'pending',
        paymentReference VARCHAR(255) NULL,
        mpesaPhone VARCHAR(100) NULL,
        isPaid TINYINT(1) DEFAULT 0,
        paidAt VARCHAR(100) NULL,
        mpesaReceiptNumber VARCHAR(100) NULL,
        deliveryConfirmed TINYINT(1) DEFAULT 0,
        deliveredAt VARCHAR(100) NULL,
        deliveryPerson VARCHAR(255) NULL,
        deliveryNote TEXT NULL,
        trackingNumber VARCHAR(255) NULL,
        deliveryFee DECIMAL(15, 2) DEFAULT 0,
        tax DECIMAL(15, 2) DEFAULT 0,
        discount DECIMAL(15, 2) DEFAULT 0,
        created_at VARCHAR(100) NULL,
        updated_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Categories Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NULL,
        description TEXT NULL,
        image LONGTEXT NULL,
        icon VARCHAR(100) NULL,
        subcategories LONGTEXT NULL,
        is_active TINYINT(1) DEFAULT 1,
        display_order INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Suppliers Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NULL,
        phone VARCHAR(100) NULL,
        address TEXT NULL,
        contactPerson VARCHAR(255) NULL,
        category VARCHAR(255) NULL,
        notes TEXT NULL,
        productsCount INT DEFAULT 0,
        totalSpend DECIMAL(15, 2) DEFAULT 0,
        active TINYINT(1) DEFAULT 1,
        rating DECIMAL(3, 2) DEFAULT 5.0,
        currency VARCHAR(10) DEFAULT 'KSh',
        paymentTerms VARCHAR(100) DEFAULT 'Net 30',
        bankDetails LONGTEXT NULL,
        kraPin VARCHAR(50) NULL,
        dateJoined VARCHAR(100) NULL,
        tags LONGTEXT NULL,
        created_at VARCHAR(100) NULL,
        updated_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 6. Supplier Products
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supplier_products (
        id VARCHAR(255) PRIMARY KEY,
        supplierId VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(255) NULL,
        category VARCHAR(255) NULL,
        costPrice DECIMAL(15, 2) NOT NULL,
        sellingPrice DECIMAL(15, 2) NOT NULL,
        stock INT DEFAULT 0,
        minOrderQty INT DEFAULT 1,
        leadTimeDays INT DEFAULT 7,
        status VARCHAR(50) DEFAULT 'Active',
        notes TEXT NULL,
        created_at VARCHAR(100) NULL,
        updated_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 7. Supplier Batches
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supplier_batches (
        id VARCHAR(255) PRIMARY KEY,
        supplierId VARCHAR(255) NOT NULL,
        batchNumber VARCHAR(255) NOT NULL,
        dateReceived VARCHAR(100) NOT NULL,
        items LONGTEXT NOT NULL,
        totalCost DECIMAL(15, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'Received',
        invoiceNumber VARCHAR(255) NULL,
        notes TEXT NULL,
        created_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 8. Supplier Payments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supplier_payments (
        id VARCHAR(255) PRIMARY KEY,
        supplierId VARCHAR(255) NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        date VARCHAR(100) NOT NULL,
        paymentMethod VARCHAR(50) DEFAULT 'Bank Transfer',
        referenceNumber VARCHAR(255) NULL,
        status VARCHAR(50) DEFAULT 'Completed',
        notes TEXT NULL,
        invoiceId VARCHAR(255) NULL,
        created_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 9. Supplier Ledger
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supplier_ledger (
        id VARCHAR(255) PRIMARY KEY,
        supplierId VARCHAR(255) NOT NULL,
        date VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        balance DECIMAL(15, 2) NOT NULL,
        referenceId VARCHAR(255) NULL,
        created_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 10. Customers CRM Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(255) PRIMARY KEY,
        user VARCHAR(255) NULL,
        is_registered TINYINT(1) DEFAULT 0,
        first_name VARCHAR(255) NULL,
        last_name VARCHAR(255) NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(100) NULL,
        company VARCHAR(255) NULL,
        location VARCHAR(255) NULL,
        status VARCHAR(50) DEFAULT 'Active',
        notes TEXT NULL,
        open_deal_value DECIMAL(15, 2) DEFAULT 0,
        created_at VARCHAR(100) NULL,
        updated_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 11. Coupons Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id VARCHAR(255) PRIMARY KEY,
        code VARCHAR(255) NOT NULL UNIQUE,
        discountType VARCHAR(50) DEFAULT 'percentage',
        discountValue DECIMAL(10, 2) NOT NULL,
        minPurchase DECIMAL(15, 2) DEFAULT 0,
        maxDiscount DECIMAL(15, 2) NULL,
        validFrom VARCHAR(100) NULL,
        validTo VARCHAR(100) NULL,
        usageLimit INT DEFAULT 100,
        usageCount INT DEFAULT 0,
        isActive TINYINT(1) DEFAULT 1,
        applicableCategories LONGTEXT NULL,
        created_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 12. Reviews Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id VARCHAR(255) PRIMARY KEY,
        productId VARCHAR(255) NOT NULL,
        userName VARCHAR(255) NOT NULL,
        userEmail VARCHAR(255) NULL,
        rating INT NOT NULL,
        comment TEXT NOT NULL,
        verified TINYINT(1) DEFAULT 1,
        status VARCHAR(50) DEFAULT 'approved',
        helpfulCount INT DEFAULT 0,
        date VARCHAR(100) NOT NULL,
        reply TEXT NULL,
        created_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 13. Site Settings Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id VARCHAR(50) PRIMARY KEY,
        general LONGTEXT NULL,
        appearance LONGTEXT NULL,
        tax LONGTEXT NULL,
        receipts LONGTEXT NULL,
        backup LONGTEXT NULL,
        payments LONGTEXT NULL,
        notifications LONGTEXT NULL,
        seo LONGTEXT NULL,
        access_control LONGTEXT NULL,
        updated_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 14. Hero Banners Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS hero_banners (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        subtitle TEXT NULL,
        imageUrl LONGTEXT NOT NULL,
        link VARCHAR(255) NULL,
        ctaText VARCHAR(100) NULL,
        badgeText VARCHAR(100) NULL,
        active TINYINT(1) DEFAULT 1,
        order_index INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 15. Custom Clothing Requests Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS custom_clothing_requests (
        id VARCHAR(255) PRIMARY KEY,
        reference_no VARCHAR(255) NOT NULL UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(100) NULL,
        garment_type VARCHAR(255) NOT NULL,
        other_garment_type VARCHAR(255) NULL,
        material_samples LONGTEXT NULL,
        design_images LONGTEXT NULL,
        design_videos LONGTEXT NULL,
        design_links LONGTEXT NULL,
        measurements LONGTEXT NULL,
        preferred_deadline VARCHAR(100) NULL,
        budget_range VARCHAR(100) NULL,
        additional_notes TEXT NULL,
        delivery_location VARCHAR(255) NULL,
        status VARCHAR(50) DEFAULT 'Pending Review',
        created_at VARCHAR(100) NOT NULL,
        updated_at VARCHAR(100) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 16. Inventory Audit Logs Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory_audit_logs (
        id VARCHAR(255) PRIMARY KEY,
        productId VARCHAR(255) NOT NULL,
        productName VARCHAR(255) NOT NULL,
        productSku VARCHAR(255) NULL,
        timestamp VARCHAR(100) NOT NULL,
        changeQuantity INT NOT NULL,
        newStock INT NOT NULL,
        reason VARCHAR(100) NOT NULL,
        details TEXT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 17. Password Reset Tokens Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at VARCHAR(100) NOT NULL,
        used_at VARCHAR(100) NULL,
        created_at VARCHAR(100) NOT NULL,
        user_email VARCHAR(255) NULL,
        ip_address VARCHAR(100) NULL,
        INDEX idx_prt_user_id (user_id),
        INDEX idx_prt_expires_at (expires_at),
        INDEX idx_prt_token_hash (token_hash)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 18. Returns Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS returns (
        id VARCHAR(255) PRIMARY KEY,
        orderId VARCHAR(255) NOT NULL,
        customerEmail VARCHAR(255) NOT NULL,
        customerName VARCHAR(255) NOT NULL,
        items LONGTEXT NOT NULL,
        reason VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        refundAmount DECIMAL(15, 2) NULL,
        trackingNumber VARCHAR(255) NULL,
        adminNote TEXT NULL,
        createdAt VARCHAR(100) NOT NULL,
        updatedAt VARCHAR(100) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 19. Email Queue Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_queue (
        id VARCHAR(255) PRIMARY KEY,
        to_email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        template_name VARCHAR(100) NOT NULL,
        context LONGTEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        attempts INT DEFAULT 0,
        max_attempts INT DEFAULT 3,
        next_attempt_at VARCHAR(100) NOT NULL,
        error_message TEXT NULL,
        created_at VARCHAR(100) NOT NULL,
        sent_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 20. Email Logs Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id VARCHAR(255) PRIMARY KEY,
        recipient VARCHAR(255) NULL,
        to_email VARCHAR(255) NULL,
        email_type VARCHAR(100) NULL,
        subject VARCHAR(255) NOT NULL,
        template_name VARCHAR(100) NULL,
        status VARCHAR(50) NOT NULL,
        attempts INT DEFAULT 1,
        error_message TEXT NULL,
        related_order_id VARCHAR(255) NULL,
        related_user_id VARCHAR(255) NULL,
        dedupe_key VARCHAR(255) NULL UNIQUE,
        sent_at VARCHAR(100) NULL,
        created_at VARCHAR(100) NULL,
        metadata LONGTEXT NULL,
        INDEX idx_el_recipient (recipient),
        INDEX idx_el_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 21. Email Subscribers Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_subscribers (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        status VARCHAR(50) DEFAULT 'subscribed',
        source VARCHAR(100) DEFAULT 'website_footer',
        subscribed_at VARCHAR(100) NOT NULL,
        unsubscribed_at VARCHAR(100) NULL,
        token VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 22. Email Preferences Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_preferences (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        allow_marketing TINYINT(1) DEFAULT 1,
        allow_review_requests TINYINT(1) DEFAULT 1,
        allow_abandoned_cart TINYINT(1) DEFAULT 1,
        allow_price_drop TINYINT(1) DEFAULT 1,
        unsubscribed_all TINYINT(1) DEFAULT 0,
        order_updates TINYINT(1) DEFAULT 1,
        promotions TINYINT(1) DEFAULT 1,
        newsletter TINYINT(1) DEFAULT 1,
        security_alerts TINYINT(1) DEFAULT 1,
        updated_at VARCHAR(100) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 23. Cart Sessions Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart_sessions (
        id VARCHAR(255) PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL UNIQUE,
        user_id VARCHAR(255) NULL,
        items LONGTEXT NOT NULL,
        updated_at VARCHAR(100) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 24. App Settings Table (Themes, Backups, Audit Logs)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(255) PRIMARY KEY,
        setting_value LONGTEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 25. Email Jobs Table (Transactional Email Queue Engine)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_jobs (
        id VARCHAR(255) PRIMARY KEY,
        email_type VARCHAR(100) NOT NULL,
        recipient VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        payload LONGTEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'queued',
        attempts INT DEFAULT 0,
        max_attempts INT DEFAULT 5,
        next_attempt_at VARCHAR(100) NOT NULL,
        error_message TEXT NULL,
        dedupe_key VARCHAR(255) NULL UNIQUE,
        created_at VARCHAR(100) NOT NULL,
        updated_at VARCHAR(100) NOT NULL,
        INDEX idx_ej_status (status),
        INDEX idx_ej_next_attempt (next_attempt_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 26. Payment Submissions Table (M-Pesa Verification Claims)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_submissions (
        id VARCHAR(255) PRIMARY KEY,
        order_id VARCHAR(255) NOT NULL,
        mpesa_receipt_code VARCHAR(100) NOT NULL UNIQUE,
        phone_number VARCHAR(100) NOT NULL,
        amount_claimed DECIMAL(15, 2) NULL,
        payment_method VARCHAR(50) DEFAULT 'mpesa_paybill',
        status VARCHAR(50) DEFAULT 'pending_verification',
        admin_notes TEXT NULL,
        submitted_at VARCHAR(100) NOT NULL,
        verified_at VARCHAR(100) NULL,
        verified_by VARCHAR(255) NULL,
        INDEX idx_ps_order (order_id),
        INDEX idx_ps_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 27. Scheduled Task Execution Logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scheduled_task_logs (
        id VARCHAR(255) PRIMARY KEY,
        task_name VARCHAR(255) NOT NULL,
        dedupe_key VARCHAR(255) NOT NULL UNIQUE,
        executed_at VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'success',
        details TEXT NULL,
        INDEX idx_stl_dedupe (dedupe_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 28. Customer Orders Table (POS / Invoice ledger sync)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_orders (
        id VARCHAR(255) PRIMARY KEY,
        customer_id VARCHAR(255) NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NULL,
        customer_phone VARCHAR(100) NULL,
        total DECIMAL(15, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        payment_status VARCHAR(50) DEFAULT 'unpaid',
        payment_reference VARCHAR(255) NULL,
        payment_amount DECIMAL(15, 2) NULL,
        payment_confirmed_at VARCHAR(100) NULL,
        payment_confirmed_by VARCHAR(255) NULL,
        payment_reminder_count INT DEFAULT 0,
        last_payment_reminder_at VARCHAR(100) NULL,
        items LONGTEXT NULL,
        created_at VARCHAR(100) NULL,
        placed_at VARCHAR(100) NULL,
        updated_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 29. Pending Registrations (Email OTP flow)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pending_registrations (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        otp VARCHAR(50) NOT NULL,
        user_data LONGTEXT NOT NULL,
        attempts INT DEFAULT 0,
        created_at VARCHAR(100) NOT NULL,
        expires_at VARCHAR(100) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 30. User Wishlists Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_wishlists (
        user_id VARCHAR(255) PRIMARY KEY,
        product_ids LONGTEXT NOT NULL,
        updated_at VARCHAR(100) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 31. CRM Deals Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS deals (
        id VARCHAR(255) PRIMARY KEY,
        customer_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        value DECIMAL(15, 2) NOT NULL,
        stage VARCHAR(50) DEFAULT 'lead',
        probability INT DEFAULT 50,
        expected_close_date VARCHAR(100) NULL,
        created_at VARCHAR(100) NULL,
        updated_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 32. Invoices Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id VARCHAR(255) PRIMARY KEY,
        customer_id VARCHAR(255) NOT NULL,
        invoice_number VARCHAR(100) NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'unpaid',
        issue_date VARCHAR(100) NOT NULL,
        due_date VARCHAR(100) NOT NULL,
        items LONGTEXT NULL,
        created_at VARCHAR(100) NULL,
        updated_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 33. Automatic Column Migrations for Existing MySQL Tables
    const safeAddCol = async (table: string, col: string, def: string) => {
      try {
        await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def};`);
      } catch (err: any) {
        if (err.errno !== 1060 && !err.message?.includes('Duplicate column')) {
          // column already exists
        }
      }
    };

    await safeAddCol('orders', 'paymentReference', 'VARCHAR(255) NULL');
    await safeAddCol('orders', 'mpesaPhone', 'VARCHAR(100) NULL');
    await safeAddCol('customer_orders', 'payment_reference', 'VARCHAR(255) NULL');
    await safeAddCol('customer_orders', 'payment_status', "VARCHAR(50) DEFAULT 'unpaid'");
    await safeAddCol('customer_orders', 'payment_amount', 'DECIMAL(15, 2) NULL');
    await safeAddCol('customer_orders', 'payment_confirmed_at', 'VARCHAR(100) NULL');
    await safeAddCol('customer_orders', 'payment_confirmed_by', 'VARCHAR(255) NULL');
    await safeAddCol('payment_submissions', 'amount_claimed', 'DECIMAL(15, 2) NULL');
    await safeAddCol('payment_submissions', 'payment_method', "VARCHAR(50) DEFAULT 'mpesa_paybill'");
    await safeAddCol('payment_submissions', 'admin_notes', 'TEXT NULL');

    isInitialized = true;
    console.log('[MySQL] All core database tables verified and active in MySQL.');
  } catch (error) {
    console.error('[MySQL] Database table initialization failed:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

// Check database connection & status
export async function getDbStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  message: string;
  stats?: Record<string, number>;
}> {
  try {
    const pool = await getDbPool();
    const [prodCount]: any = await pool.query('SELECT COUNT(*) as count FROM products');
    const [orderCount]: any = await pool.query('SELECT COUNT(*) as count FROM orders');
    const [userCount]: any = await pool.query('SELECT COUNT(*) as count FROM users');

    return {
      configured: true,
      connected: true,
      message: `Successfully connected to MySQL database: ${getDbName()} (via local XAMPP / MySQL)`,
      stats: {
        products: prodCount[0]?.count || 0,
        orders: orderCount[0]?.count || 0,
        users: userCount[0]?.count || 0,
      },
    };
  } catch (error: any) {
    return {
      configured: true,
      connected: false,
      message: `Failed to connect to MySQL server: ${error.message || error}`,
    };
  }
}

// ============================================================================
// USERS CRUD
// ============================================================================

export async function getMysqlUserByEmail(email: string): Promise<any | null> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1', [
    (email || '').trim().toLowerCase(),
  ]);
  if (!rows || rows.length === 0) return null;
  return rows[0];
}

export async function getMysqlUserByEmailOrUsername(identifier: string): Promise<any | null> {
  const pool = await getDbPool();
  const clean = (identifier || '').trim().toLowerCase();
  const [rows]: any = await pool.query(
    'SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1',
    [clean, clean]
  );
  if (!rows || rows.length === 0) return null;
  return rows[0];
}

export async function getMysqlUserById(userId: string): Promise<any | null> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!rows || rows.length === 0) return null;
  return rows[0];
}

export async function getAllMysqlUsers(): Promise<any[]> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
  return rows || [];
}

export async function saveMysqlUser(user: any): Promise<any> {
  const pool = await getDbPool();
  const id = user.id || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO users (
      id, email, username, password_hash, first_name, last_name, phone, role,
      is_staff, is_superuser, email_verified, avatar_url, referral_code, partner_tier,
      address, city, country, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      username = VALUES(username),
      password_hash = VALUES(password_hash),
      first_name = VALUES(first_name),
      last_name = VALUES(last_name),
      phone = VALUES(phone),
      role = VALUES(role),
      is_staff = VALUES(is_staff),
      is_superuser = VALUES(is_superuser),
      email_verified = VALUES(email_verified),
      avatar_url = VALUES(avatar_url),
      referral_code = VALUES(referral_code),
      partner_tier = VALUES(partner_tier),
      address = VALUES(address),
      city = VALUES(city),
      country = VALUES(country),
      updated_at = VALUES(updated_at)`,
    [
      id,
      (user.email || '').trim().toLowerCase(),
      user.username || user.email?.split('@')[0] || '',
      user.password_hash || user.password || '',
      user.first_name || '',
      user.last_name || '',
      user.phone || '',
      user.role || 'customer',
      user.is_staff ? 1 : 0,
      user.is_superuser ? 1 : 0,
      user.email_verified !== undefined ? (user.email_verified ? 1 : 0) : 1,
      user.avatar_url || '',
      user.referral_code || null,
      user.partner_tier || 'Silver',
      user.address || null,
      user.city || null,
      user.country || null,
      user.created_at || now,
      now,
    ]
  );

  return getMysqlUserById(id);
}

export async function deleteMysqlUser(id: string): Promise<boolean> {
  const pool = await getDbPool();
  const [res]: any = await pool.query('DELETE FROM users WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

export async function updateMysqlUserPasswordById(userId: string, newPasswordHash: string): Promise<boolean> {
  const pool = await getDbPool();
  const [res]: any = await pool.query(
    'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
    [newPasswordHash, new Date().toISOString(), userId]
  );
  return res.affectedRows > 0;
}

// ============================================================================
// PRODUCTS CRUD
// ============================================================================

function parseProductRow(row: any): any {
  if (!row) return null;
  return {
    ...row,
    price: Number(row.price),
    originalPrice: row.originalPrice ? Number(row.originalPrice) : undefined,
    costPrice: row.costPrice ? Number(row.costPrice) : undefined,
    previousPrice: row.previousPrice ? Number(row.previousPrice) : undefined,
    rating: Number(row.rating || 0),
    reviewsCount: Number(row.reviewsCount || 0),
    stock: Number(row.stock || 0),
    lowStockThreshold: Number(row.lowStockThreshold || 5),
    backInStockAlert: Boolean(row.backInStockAlert),
    tags: typeof row.tags === 'string' ? safeJsonParse(row.tags, row.tags.split(',').map((t: string) => t.trim())) : row.tags || [],
    images: typeof row.images === 'string' ? safeJsonParse(row.images, [row.imageUrl || '']) : row.images || [],
    variations: typeof row.variations === 'string' ? safeJsonParse(row.variations, []) : row.variations || [],
    reviews: typeof row.reviews === 'string' ? safeJsonParse(row.reviews, []) : row.reviews || [],
    features: typeof row.features === 'string' ? safeJsonParse(row.features, []) : row.features || [],
    specifications: typeof row.specifications === 'string' ? safeJsonParse(row.specifications, []) : row.specifications || [],
  };
}

function safeJsonParse(val: string, fallback: any): any {
  try {
    return JSON.parse(val);
  } catch (_) {
    return fallback;
  }
}

export async function getMysqlProducts(): Promise<any[]> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
  return (rows || []).map(parseProductRow);
}

export async function getMysqlProductById(id: string): Promise<any | null> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM products WHERE id = ? LIMIT 1', [id]);
  if (!rows || rows.length === 0) return null;
  return parseProductRow(rows[0]);
}

export async function saveMysqlProduct(p: any): Promise<any> {
  const pool = await getDbPool();
  const id = p.id || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO products (
      id, sku, slug, name, brand, country_of_origin, description, shortDescription, detailedDescription,
      price, originalPrice, costPrice, previousPrice, category, subcategory, tags, type, imageUrl, images,
      stock, lowStockThreshold, rating, reviewsCount, variations, reviews, features, specifications,
      whatsInTheBox, digitalFileUrl, status, paymentRestriction, backInStockAlert, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      sku = VALUES(sku),
      slug = VALUES(slug),
      name = VALUES(name),
      brand = VALUES(brand),
      country_of_origin = VALUES(country_of_origin),
      description = VALUES(description),
      shortDescription = VALUES(shortDescription),
      detailedDescription = VALUES(detailedDescription),
      price = VALUES(price),
      originalPrice = VALUES(originalPrice),
      costPrice = VALUES(costPrice),
      previousPrice = VALUES(previousPrice),
      category = VALUES(category),
      subcategory = VALUES(subcategory),
      tags = VALUES(tags),
      type = VALUES(type),
      imageUrl = VALUES(imageUrl),
      images = VALUES(images),
      stock = VALUES(stock),
      lowStockThreshold = VALUES(lowStockThreshold),
      rating = VALUES(rating),
      reviewsCount = VALUES(reviewsCount),
      variations = VALUES(variations),
      reviews = VALUES(reviews),
      features = VALUES(features),
      specifications = VALUES(specifications),
      whatsInTheBox = VALUES(whatsInTheBox),
      digitalFileUrl = VALUES(digitalFileUrl),
      status = VALUES(status),
      paymentRestriction = VALUES(paymentRestriction),
      backInStockAlert = VALUES(backInStockAlert),
      updated_at = VALUES(updated_at)`,
    [
      id,
      p.sku || '',
      p.slug || p.name?.toLowerCase().replace(/\s+/g, '-') || '',
      p.name || 'Untitled Product',
      p.brand || 'Ropenix',
      p.countryOfOrigin || p.country_of_origin || 'Kenya',
      p.description || '',
      p.shortDescription || '',
      p.detailedDescription || '',
      Number(p.price || 0),
      p.originalPrice ? Number(p.originalPrice) : null,
      p.costPrice ? Number(p.costPrice) : null,
      p.previousPrice ? Number(p.previousPrice) : null,
      p.category || 'All',
      p.subcategory || '',
      JSON.stringify(Array.isArray(p.tags) ? p.tags : []),
      p.type || 'physical',
      p.imageUrl || (Array.isArray(p.images) && p.images[0]) || '',
      JSON.stringify(Array.isArray(p.images) ? p.images : []),
      Number(p.stock || 0),
      Number(p.lowStockThreshold || 5),
      Number(p.rating || 0),
      Number(p.reviewsCount || 0),
      JSON.stringify(Array.isArray(p.variations) ? p.variations : []),
      JSON.stringify(Array.isArray(p.reviews) ? p.reviews : []),
      JSON.stringify(Array.isArray(p.features) ? p.features : []),
      JSON.stringify(Array.isArray(p.specifications) ? p.specifications : []),
      p.whatsInTheBox || '',
      p.digitalFileUrl || '',
      p.status || 'Active',
      p.paymentRestriction || 'both',
      p.backInStockAlert ? 1 : 0,
      p.created_at || now,
      now,
    ]
  );

  return getMysqlProductById(id);
}

export async function deleteMysqlProduct(id: string): Promise<boolean> {
  const pool = await getDbPool();
  const [res]: any = await pool.query('DELETE FROM products WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

export async function updateMysqlProductStock(id: string, stock: number): Promise<any | null> {
  const pool = await getDbPool();
  await pool.query('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?', [
    Number(stock),
    new Date().toISOString(),
    id,
  ]);
  return getMysqlProductById(id);
}

export async function bulkUpdateMysqlProducts(products: any[]): Promise<void> {
  for (const p of products) {
    if (p.id) {
      await saveMysqlProduct(p);
    }
  }
}

// ============================================================================
// ORDERS CRUD
// ============================================================================

function parseOrderRow(row: any): any {
  if (!row) return null;
  let status = row.status;
  if (typeof status !== 'string' || status === '[object Object]' || !status) {
    status = row.deliveryConfirmed ? 'delivered' : (row.trackingNumber ? 'shipped' : (row.isPaid || row.paymentStatus === 'paid' ? 'processing' : 'pending'));
  }
  return {
    ...row,
    status,
    total: Number(row.total),
    deliveryFee: Number(row.deliveryFee || 0),
    tax: Number(row.tax || 0),
    discount: Number(row.discount || 0),
    isGuest: Boolean(row.isGuest),
    isPaid: Boolean(row.isPaid),
    deliveryConfirmed: Boolean(row.deliveryConfirmed),
    paymentReference: row.paymentReference || row.mpesaReceiptNumber || undefined,
    mpesaReceiptNumber: row.mpesaReceiptNumber || row.paymentReference || undefined,
    mpesaPhone: row.mpesaPhone || undefined,
    items: typeof row.items === 'string' ? safeJsonParse(row.items, []) : row.items || [],
    shippingAddress: typeof row.shippingAddress === 'string' ? safeJsonParse(row.shippingAddress, row.shippingAddress) : row.shippingAddress,
    notesHistory: typeof row.notesHistory === 'string' ? safeJsonParse(row.notesHistory, []) : row.notesHistory || [],
    statusHistory: typeof row.statusHistory === 'string' ? safeJsonParse(row.statusHistory, []) : row.statusHistory || [],
  };
}

export async function getMysqlOrders(): Promise<any[]> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM orders ORDER BY date DESC, created_at DESC');
  return (rows || []).map(parseOrderRow);
}

export async function getMysqlOrderById(id: string): Promise<any | null> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [id]);
  if (!rows || rows.length === 0) return null;
  return parseOrderRow(rows[0]);
}

export async function getMysqlOrdersByCustomerEmail(email: string): Promise<any[]> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query(
    'SELECT * FROM orders WHERE LOWER(customerEmail) = ? ORDER BY date DESC',
    [(email || '').trim().toLowerCase()]
  );
  return (rows || []).map(parseOrderRow);
}

export async function saveMysqlOrder(order: any): Promise<any> {
  const pool = await getDbPool();
  const id = order.id || `ORD-${Date.now()}`;
  const now = new Date().toISOString();
  const refCode = order.paymentReference || order.mpesaReceiptNumber || null;
  const phone = order.mpesaPhone || order.customerPhone || order.phone || null;

  let safeStatus = typeof order.status === 'string' && order.status !== '[object Object]' ? order.status : (typeof order.status === 'object' && typeof order.status?.status === 'string' && order.status.status !== '[object Object]' ? order.status.status : '');
  if (!safeStatus || safeStatus === '[object Object]') {
    safeStatus = order.deliveryConfirmed ? 'delivered' : (order.trackingNumber ? 'shipped' : (order.isPaid || order.paymentStatus === 'paid' ? 'processing' : 'pending'));
  }

  await pool.query(
    `INSERT INTO orders (
      id, customerName, customerEmail, customerPhone, items, total, status, date, couponCode,
      customNote, shippingAddress, notesHistory, statusHistory, isGuest, paymentMethod, checkoutChannel,
      paymentStatus, paymentReference, mpesaPhone, isPaid, paidAt, mpesaReceiptNumber, deliveryConfirmed, deliveredAt, deliveryPerson,
      deliveryNote, trackingNumber, deliveryFee, tax, discount, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      customerName = VALUES(customerName),
      customerEmail = VALUES(customerEmail),
      customerPhone = VALUES(customerPhone),
      items = VALUES(items),
      total = VALUES(total),
      status = VALUES(status),
      couponCode = VALUES(couponCode),
      customNote = VALUES(customNote),
      shippingAddress = VALUES(shippingAddress),
      notesHistory = VALUES(notesHistory),
      statusHistory = VALUES(statusHistory),
      isGuest = VALUES(isGuest),
      paymentMethod = VALUES(paymentMethod),
      checkoutChannel = VALUES(checkoutChannel),
      paymentStatus = VALUES(paymentStatus),
      paymentReference = VALUES(paymentReference),
      mpesaPhone = VALUES(mpesaPhone),
      isPaid = VALUES(isPaid),
      paidAt = VALUES(paidAt),
      mpesaReceiptNumber = VALUES(mpesaReceiptNumber),
      deliveryConfirmed = VALUES(deliveryConfirmed),
      deliveredAt = VALUES(deliveredAt),
      deliveryPerson = VALUES(deliveryPerson),
      deliveryNote = VALUES(deliveryNote),
      trackingNumber = VALUES(trackingNumber),
      deliveryFee = VALUES(deliveryFee),
      tax = VALUES(tax),
      discount = VALUES(discount),
      updated_at = VALUES(updated_at)`,
    [
      id,
      order.customerName || 'Customer',
      (order.customerEmail || '').trim().toLowerCase(),
      order.customerPhone || order.phone || '',
      JSON.stringify(Array.isArray(order.items) ? order.items : []),
      Number(order.total || 0),
      safeStatus,
      order.date || now,
      order.couponCode || null,
      order.customNote || null,
      typeof order.shippingAddress === 'object' ? JSON.stringify(order.shippingAddress) : order.shippingAddress || null,
      JSON.stringify(Array.isArray(order.notesHistory) ? order.notesHistory : []),
      JSON.stringify(Array.isArray(order.statusHistory) ? order.statusHistory : []),
      order.isGuest ? 1 : 0,
      order.paymentMethod || 'cod',
      order.checkoutChannel || 'web',
      order.paymentStatus || (refCode ? 'pending_verification' : 'pending'),
      refCode,
      phone,
      order.isPaid ? 1 : 0,
      order.paidAt || null,
      refCode,
      order.deliveryConfirmed ? 1 : 0,
      order.deliveredAt || null,
      order.deliveryPerson || null,
      order.deliveryNote || null,
      order.trackingNumber || null,
      Number(order.deliveryFee || 0),
      Number(order.tax || 0),
      Number(order.discount || 0),
      order.created_at || now,
      now,
    ]
  );

  // Sync to customer_orders table
  try {
    await pool.query(
      `INSERT INTO customer_orders (
        id, customer_name, customer_email, customer_phone, total, status,
        payment_status, payment_reference, payment_amount, created_at, placed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        customer_name = VALUES(customer_name),
        customer_email = VALUES(customer_email),
        customer_phone = VALUES(customer_phone),
        total = VALUES(total),
        status = VALUES(status),
        payment_status = VALUES(payment_status),
        payment_reference = VALUES(payment_reference),
        payment_amount = VALUES(payment_amount),
        updated_at = VALUES(updated_at)`,
      [
        id,
        order.customerName || 'Customer',
        (order.customerEmail || '').trim().toLowerCase(),
        order.customerPhone || order.phone || '',
        Number(order.total || 0),
        order.status || 'Pending',
        order.paymentStatus || (refCode ? 'pending_verification' : 'unpaid'),
        refCode,
        order.total || null,
        order.created_at || now,
        order.date || now,
        now,
      ]
    );
  } catch (_) {}

  // If customer provided an M-Pesa transaction code at checkout, record in payment_submissions
  if (refCode && refCode.trim().length >= 8) {
    try {
      const claimId = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await pool.query(
        `INSERT INTO payment_submissions (
          id, order_id, mpesa_receipt_code, phone_number, amount_claimed, payment_method, status, admin_notes, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          phone_number = VALUES(phone_number),
          amount_claimed = VALUES(amount_claimed),
          submitted_at = VALUES(submitted_at)`,
        [
          claimId,
          id,
          refCode.trim().toUpperCase(),
          phone || '254700000000',
          Number(order.total || 0),
          order.paymentMethod || 'mpesa_paybill',
          'pending_verification',
          'Submitted directly during checkout placement',
          now,
        ]
      );
    } catch (_) {}
  }

  return getMysqlOrderById(id);
}

export async function updateMysqlOrderStatus(
  id: string,
  statusOrUpdates: string | any,
  paymentStatus?: string,
  trackingNumber?: string
): Promise<any | null> {
  const pool = await getDbPool();
  
  let targetStatus = typeof statusOrUpdates === 'string' && statusOrUpdates !== '[object Object]' ? statusOrUpdates : (typeof statusOrUpdates === 'object' && typeof statusOrUpdates?.status === 'string' && statusOrUpdates.status !== '[object Object]' ? statusOrUpdates.status : undefined);
  let targetPaymentStatus = typeof statusOrUpdates === 'object' ? (statusOrUpdates?.paymentStatus || statusOrUpdates?.payment_status || paymentStatus) : paymentStatus;
  let targetTrackingNumber = typeof statusOrUpdates === 'object' ? (statusOrUpdates?.trackingNumber || statusOrUpdates?.tracking_number || trackingNumber) : trackingNumber;

  const updates: string[] = ['updated_at = ?'];
  const values: any[] = [new Date().toISOString()];

  if (targetStatus) {
    updates.push('status = ?');
    values.push(targetStatus);
  }

  if (targetPaymentStatus) {
    updates.push('paymentStatus = ?');
    values.push(targetPaymentStatus);
    if (targetPaymentStatus === 'paid' || targetPaymentStatus === 'completed') {
      updates.push('isPaid = 1');
      updates.push('paidAt = ?');
      values.push(new Date().toISOString());
    }
  }

  if (targetTrackingNumber) {
    updates.push('trackingNumber = ?');
    values.push(targetTrackingNumber);
  }

  values.push(id);
  await pool.query(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, values);
  return getMysqlOrderById(id);
}

export async function deleteMysqlOrder(id: string): Promise<boolean> {
  const pool = await getDbPool();
  const [res]: any = await pool.query('DELETE FROM orders WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

// ============================================================================
// CATEGORIES CRUD
// ============================================================================

export const DEFAULT_CORE_CATEGORIES = [
  {
    id: 'cat-fashion',
    name: 'Fashion',
    slug: 'fashion',
    description: 'Men & Women Apparel, Streetwear, Shoes, and Accessories',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
    icon: 'Shirt',
    subcategories: ['Streetwear', 'Hoodies', 'T-Shirts', 'Trousers'],
    is_active: 1,
    display_order: 1,
  },
  {
    id: 'cat-electronics',
    name: 'Electronics',
    slug: 'electronics',
    description: 'Keyboards, Audio, Smartphones, Computing, and Smart Tech',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
    icon: 'Laptop',
    subcategories: ['Mechanical Keyboards', 'Audio', 'Accessories'],
    is_active: 1,
    display_order: 2,
  },
  {
    id: 'cat-home-living',
    name: 'Home & Living',
    slug: 'home-living',
    description: 'Desk Setup, Furniture, Decor, Kitchen and Smart Appliances',
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600',
    icon: 'Home',
    subcategories: ['Desk Accessories', 'Decor', 'Lighting'],
    is_active: 1,
    display_order: 3,
  },
  {
    id: 'cat-beauty-fragrances',
    name: 'Beauty & Fragrances',
    slug: 'beauty-fragrances',
    description: 'Handcrafted Candles, Skincare, Perfumes, and Personal Care',
    image: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600',
    icon: 'Sparkles',
    subcategories: ['Candles', 'Fragrances', 'Skincare'],
    is_active: 1,
    display_order: 4,
  },
];

export async function getMysqlCategories(): Promise<any[]> {
  const pool = await getDbPool();
  let [rows]: any = await pool.query('SELECT * FROM categories ORDER BY display_order ASC, name ASC');
  
  if (!rows || rows.length === 0) {
    for (const c of DEFAULT_CORE_CATEGORIES) {
      await saveMysqlCategory(c);
    }
    const [freshRows]: any = await pool.query('SELECT * FROM categories ORDER BY display_order ASC, name ASC');
    rows = freshRows || [];
  }

  // Calculate live product count per category
  let productCountMap: Record<string, number> = {};
  try {
    const [counts]: any = await pool.query('SELECT category, COUNT(*) as cnt FROM products GROUP BY category');
    if (Array.isArray(counts)) {
      for (const item of counts) {
        if (item.category) {
          productCountMap[item.category.toLowerCase().trim()] = Number(item.cnt || 0);
        }
      }
    }
  } catch (_) {}

  return (rows || []).map((c: any) => {
    const catNameLower = (c.name || '').toLowerCase().trim();
    const count = productCountMap[catNameLower] || 0;
    const isActive = !(c.is_active === 0 || c.is_active === false || c.status === 'Inactive');
    return {
      id: String(c.id),
      name: c.name,
      slug: c.slug || String(c.name).toLowerCase().replace(/\s+/g, '-'),
      description: c.description || '',
      imageUrl: c.image || c.imageUrl || '',
      image: c.image || c.imageUrl || '',
      icon: c.icon || '',
      parentId: c.parentId || null,
      status: isActive ? 'Active' : 'Inactive',
      is_active: isActive,
      displayOrder: Number(c.display_order || c.displayOrder || 0),
      display_order: Number(c.display_order || c.displayOrder || 0),
      subcategories: typeof c.subcategories === 'string' ? safeJsonParse(c.subcategories, []) : c.subcategories || [],
      productCount: count,
      previousSlugs: typeof c.previousSlugs === 'string' ? safeJsonParse(c.previousSlugs, []) : (Array.isArray(c.previousSlugs) ? c.previousSlugs : []),
      createdAt: c.created_at || c.createdAt || new Date().toISOString(),
    };
  });
}

export async function saveMysqlCategory(cat: any): Promise<any> {
  const pool = await getDbPool();
  const id = cat.id || `cat-${Date.now()}`;
  const isActive = cat.is_active !== undefined ? (cat.is_active ? 1 : 0) : (cat.status === 'Inactive' ? 0 : 1);
  const image = cat.imageUrl || cat.image || '';
  const displayOrder = Number(cat.displayOrder || cat.display_order || 0);

  await pool.query(
    `INSERT INTO categories (id, name, slug, description, image, icon, subcategories, is_active, display_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       slug = VALUES(slug),
       description = VALUES(description),
       image = VALUES(image),
       icon = VALUES(icon),
       subcategories = VALUES(subcategories),
       is_active = VALUES(is_active),
       display_order = VALUES(display_order)`,
    [
      id,
      cat.name || 'Category',
      cat.slug || String(cat.name || '').toLowerCase().replace(/\s+/g, '-') || '',
      cat.description || '',
      image,
      cat.icon || '',
      JSON.stringify(Array.isArray(cat.subcategories) ? cat.subcategories : []),
      isActive,
      displayOrder,
    ]
  );

  const [rows]: any = await pool.query('SELECT * FROM categories WHERE id = ? LIMIT 1', [id]);
  const row = rows[0];
  if (!row) return cat;
  return {
    ...row,
    imageUrl: row.image || row.imageUrl || '',
    displayOrder: Number(row.display_order || 0),
    status: row.is_active ? 'Active' : 'Inactive',
    is_active: Boolean(row.is_active),
    subcategories: typeof row.subcategories === 'string' ? safeJsonParse(row.subcategories, []) : row.subcategories || [],
  };
}

export async function deleteMysqlCategory(id: string): Promise<boolean> {
  const pool = await getDbPool();
  const [res]: any = await pool.query('DELETE FROM categories WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

// ============================================================================
// SUPPLIERS CRUD
// ============================================================================

export async function getMysqlSuppliers(): Promise<any[]> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM suppliers ORDER BY name ASC');
  return (rows || []).map((s: any) => ({
    ...s,
    active: Boolean(s.active),
    productsCount: Number(s.productsCount || 0),
    totalSpend: Number(s.totalSpend || 0),
    rating: Number(s.rating || 5.0),
    tags: typeof s.tags === 'string' ? safeJsonParse(s.tags, []) : s.tags || [],
  }));
}

export async function saveMysqlSupplier(s: any): Promise<any> {
  const pool = await getDbPool();
  const id = s.id || `sup-${Date.now()}`;
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO suppliers (
      id, name, email, phone, address, contactPerson, category, notes, productsCount,
      totalSpend, active, rating, currency, paymentTerms, bankDetails, kraPin, dateJoined, tags, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      email = VALUES(email),
      phone = VALUES(phone),
      address = VALUES(address),
      contactPerson = VALUES(contactPerson),
      category = VALUES(category),
      notes = VALUES(notes),
      productsCount = VALUES(productsCount),
      totalSpend = VALUES(totalSpend),
      active = VALUES(active),
      rating = VALUES(rating),
      currency = VALUES(currency),
      paymentTerms = VALUES(paymentTerms),
      bankDetails = VALUES(bankDetails),
      kraPin = VALUES(kraPin),
      tags = VALUES(tags),
      updated_at = VALUES(updated_at)`,
    [
      id,
      s.name || 'Supplier',
      s.email || '',
      s.phone || '',
      s.address || '',
      s.contactPerson || '',
      s.category || 'General',
      s.notes || '',
      Number(s.productsCount || 0),
      Number(s.totalSpend || 0),
      s.active !== undefined ? (s.active ? 1 : 0) : 1,
      Number(s.rating || 5.0),
      s.currency || 'KSh',
      s.paymentTerms || 'Net 30',
      s.bankDetails || '',
      s.kraPin || '',
      s.dateJoined || now,
      JSON.stringify(Array.isArray(s.tags) ? s.tags : []),
      s.created_at || now,
      now,
    ]
  );

  const [rows]: any = await pool.query('SELECT * FROM suppliers WHERE id = ? LIMIT 1', [id]);
  return rows[0];
}

export async function deleteMysqlSupplier(id: string): Promise<boolean> {
  const pool = await getDbPool();
  const [res]: any = await pool.query('DELETE FROM suppliers WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

export async function getMysqlSupplierProducts(supplierId?: string): Promise<any[]> {
  const pool = await getDbPool();
  const query = supplierId
    ? 'SELECT * FROM supplier_products WHERE supplierId = ? ORDER BY name ASC'
    : 'SELECT * FROM supplier_products ORDER BY name ASC';
  const params = supplierId ? [supplierId] : [];
  const [rows]: any = await pool.query(query, params);
  return (rows || []).map((sp: any) => ({
    ...sp,
    costPrice: Number(sp.costPrice),
    sellingPrice: Number(sp.sellingPrice),
    stock: Number(sp.stock),
  }));
}

export async function saveMysqlSupplierProduct(sp: any): Promise<any> {
  const pool = await getDbPool();
  const id = sp.id || `sp-${Date.now()}`;
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO supplier_products (
      id, supplierId, name, sku, category, costPrice, sellingPrice, stock, minOrderQty, leadTimeDays, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      sku = VALUES(sku),
      category = VALUES(category),
      costPrice = VALUES(costPrice),
      sellingPrice = VALUES(sellingPrice),
      stock = VALUES(stock),
      minOrderQty = VALUES(minOrderQty),
      leadTimeDays = VALUES(leadTimeDays),
      status = VALUES(status),
      notes = VALUES(notes),
      updated_at = VALUES(updated_at)`,
    [
      id,
      sp.supplierId,
      sp.name || 'Product',
      sp.sku || '',
      sp.category || '',
      Number(sp.costPrice || 0),
      Number(sp.sellingPrice || 0),
      Number(sp.stock || 0),
      Number(sp.minOrderQty || 1),
      Number(sp.leadTimeDays || 7),
      sp.status || 'Active',
      sp.notes || '',
      sp.created_at || now,
      now,
    ]
  );

  const [rows]: any = await pool.query('SELECT * FROM supplier_products WHERE id = ? LIMIT 1', [id]);
  return rows[0];
}

export async function getMysqlSupplierBatches(supplierId?: string): Promise<any[]> {
  const pool = await getDbPool();
  const query = supplierId
    ? 'SELECT * FROM supplier_batches WHERE supplierId = ? ORDER BY dateReceived DESC'
    : 'SELECT * FROM supplier_batches ORDER BY dateReceived DESC';
  const params = supplierId ? [supplierId] : [];
  const [rows]: any = await pool.query(query, params);
  return (rows || []).map((b: any) => ({
    ...b,
    totalCost: Number(b.totalCost),
    items: typeof b.items === 'string' ? safeJsonParse(b.items, []) : b.items || [],
  }));
}

export async function saveMysqlSupplierBatch(batch: any): Promise<any> {
  const pool = await getDbPool();
  const id = batch.id || `batch-${Date.now()}`;

  await pool.query(
    `INSERT INTO supplier_batches (id, supplierId, batchNumber, dateReceived, items, totalCost, status, invoiceNumber, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       items = VALUES(items),
       totalCost = VALUES(totalCost),
       status = VALUES(status),
       invoiceNumber = VALUES(invoiceNumber),
       notes = VALUES(notes)`,
    [
      id,
      batch.supplierId,
      batch.batchNumber || `BAT-${Date.now()}`,
      batch.dateReceived || new Date().toISOString(),
      JSON.stringify(Array.isArray(batch.items) ? batch.items : []),
      Number(batch.totalCost || 0),
      batch.status || 'Received',
      batch.invoiceNumber || '',
      batch.notes || '',
      batch.created_at || new Date().toISOString(),
    ]
  );

  const [rows]: any = await pool.query('SELECT * FROM supplier_batches WHERE id = ? LIMIT 1', [id]);
  return rows[0];
}

export async function getMysqlSupplierPayments(supplierId?: string): Promise<any[]> {
  const pool = await getDbPool();
  const query = supplierId
    ? 'SELECT * FROM supplier_payments WHERE supplierId = ? ORDER BY date DESC'
    : 'SELECT * FROM supplier_payments ORDER BY date DESC';
  const params = supplierId ? [supplierId] : [];
  const [rows]: any = await pool.query(query, params);
  return (rows || []).map((p: any) => ({ ...p, amount: Number(p.amount) }));
}

export async function saveMysqlSupplierPayment(p: any): Promise<any> {
  const pool = await getDbPool();
  const id = p.id || `pay-${Date.now()}`;

  await pool.query(
    `INSERT INTO supplier_payments (id, supplierId, amount, date, paymentMethod, referenceNumber, status, notes, invoiceId, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       amount = VALUES(amount),
       paymentMethod = VALUES(paymentMethod),
       referenceNumber = VALUES(referenceNumber),
       status = VALUES(status),
       notes = VALUES(notes)`,
    [
      id,
      p.supplierId,
      Number(p.amount || 0),
      p.date || new Date().toISOString(),
      p.paymentMethod || 'Bank Transfer',
      p.referenceNumber || '',
      p.status || 'Completed',
      p.notes || '',
      p.invoiceId || '',
      p.created_at || new Date().toISOString(),
    ]
  );

  const [rows]: any = await pool.query('SELECT * FROM supplier_payments WHERE id = ? LIMIT 1', [id]);
  return rows[0];
}

export async function getMysqlSupplierLedger(supplierId: string): Promise<any[]> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query(
    'SELECT * FROM supplier_ledger WHERE supplierId = ? ORDER BY date ASC, created_at ASC',
    [supplierId]
  );
  return (rows || []).map((l: any) => ({
    ...l,
    amount: Number(l.amount),
    balance: Number(l.balance),
  }));
}

export async function saveMysqlSupplierLedgerEntry(entry: any): Promise<any> {
  const pool = await getDbPool();
  const id = entry.id || `led-${Date.now()}`;

  await pool.query(
    `INSERT INTO supplier_ledger (id, supplierId, date, type, description, amount, balance, referenceId, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      entry.supplierId,
      entry.date || new Date().toISOString(),
      entry.type,
      entry.description || '',
      Number(entry.amount || 0),
      Number(entry.balance || 0),
      entry.referenceId || '',
      new Date().toISOString(),
    ]
  );

  const [rows]: any = await pool.query('SELECT * FROM supplier_ledger WHERE id = ? LIMIT 1', [id]);
  return rows[0];
}

// ============================================================================
// CUSTOMERS CRM
// ============================================================================

export async function getAllMysqlCustomers(): Promise<any[]> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM customers ORDER BY name ASC');
  return (rows || []).map((c: any) => ({
    ...c,
    is_registered: Boolean(c.is_registered),
    open_deal_value: Number(c.open_deal_value || 0),
  }));
}

export async function saveMysqlCustomer(c: any): Promise<any> {
  const pool = await getDbPool();
  const id = c.id || `cust-${Date.now()}`;
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO customers (
      id, user, is_registered, first_name, last_name, name, email, phone, company, location, status, notes, open_deal_value, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      user = VALUES(user),
      is_registered = VALUES(is_registered),
      first_name = VALUES(first_name),
      last_name = VALUES(last_name),
      name = VALUES(name),
      email = VALUES(email),
      phone = VALUES(phone),
      company = VALUES(company),
      location = VALUES(location),
      status = VALUES(status),
      notes = VALUES(notes),
      open_deal_value = VALUES(open_deal_value),
      updated_at = VALUES(updated_at)`,
    [
      id,
      c.user || null,
      c.is_registered ? 1 : 0,
      c.first_name || '',
      c.last_name || '',
      c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Customer',
      (c.email || '').trim().toLowerCase(),
      c.phone || '',
      c.company || '',
      c.location || '',
      c.status || 'Active',
      c.notes || '',
      Number(c.open_deal_value || 0),
      c.created_at || now,
      now,
    ]
  );

  const [rows]: any = await pool.query('SELECT * FROM customers WHERE id = ? LIMIT 1', [id]);
  return rows[0];
}

// ============================================================================
// SITE SETTINGS
// ============================================================================

export async function getMysqlSiteSettings(): Promise<any | null> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM site_settings WHERE id = "default" LIMIT 1');
  if (!rows || rows.length === 0) return null;
  const raw = rows[0];
  return {
    general: safeJsonParse(raw.general, null),
    appearance: safeJsonParse(raw.appearance, null),
    tax: safeJsonParse(raw.tax, null),
    receipts: safeJsonParse(raw.receipts, null),
    backup: safeJsonParse(raw.backup, null),
    payments: safeJsonParse(raw.payments, null),
    notifications: safeJsonParse(raw.notifications, null),
    seo: safeJsonParse(raw.seo, null),
    access_control: safeJsonParse(raw.access_control, null),
  };
}

export async function saveMysqlSiteSettings(settings: any): Promise<any> {
  const pool = await getDbPool();
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO site_settings (
      id, general, appearance, tax, receipts, backup, payments, notifications, seo, access_control, updated_at
    ) VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      general = VALUES(general),
      appearance = VALUES(appearance),
      tax = VALUES(tax),
      receipts = VALUES(receipts),
      backup = VALUES(backup),
      payments = VALUES(payments),
      notifications = VALUES(notifications),
      seo = VALUES(seo),
      access_control = VALUES(access_control),
      updated_at = VALUES(updated_at)`,
    [
      JSON.stringify(settings.general || {}),
      JSON.stringify(settings.appearance || {}),
      JSON.stringify(settings.tax || {}),
      JSON.stringify(settings.receipts || {}),
      JSON.stringify(settings.backup || {}),
      JSON.stringify(settings.payments || {}),
      JSON.stringify(settings.notifications || {}),
      JSON.stringify(settings.seo || {}),
      JSON.stringify(settings.access_control || {}),
      now,
    ]
  );

  return getMysqlSiteSettings();
}

// ============================================================================
// HERO BANNERS
// ============================================================================

export async function getMysqlHeroBanners(): Promise<any[]> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM hero_banners ORDER BY order_index ASC');
  return (rows || []).map((b: any) => ({
    ...b,
    active: Boolean(b.active),
    order: Number(b.order_index),
  }));
}

export async function saveMysqlHeroBanners(banners: any[]): Promise<any[]> {
  const pool = await getDbPool();
  await pool.query('DELETE FROM hero_banners');
  for (let i = 0; i < banners.length; i++) {
    const b = banners[i];
    const id = b.id || `banner-${i + 1}`;
    await pool.query(
      `INSERT INTO hero_banners (id, title, subtitle, imageUrl, link, ctaText, badgeText, active, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        b.title || 'Untitled Banner',
        b.subtitle || '',
        b.imageUrl || '',
        b.link || '/store',
        b.ctaText || 'Shop Now',
        b.badgeText || '',
        b.active !== undefined ? (b.active ? 1 : 0) : 1,
        i,
      ]
    );
  }
  return getMysqlHeroBanners();
}

// ============================================================================
// REVIEWS CRUD
// ============================================================================

export async function getMysqlReviews(productId?: string): Promise<any[]> {
  const pool = await getDbPool();
  const query = productId
    ? 'SELECT * FROM reviews WHERE productId = ? ORDER BY date DESC'
    : 'SELECT * FROM reviews ORDER BY date DESC';
  const params = productId ? [productId] : [];
  const [rows]: any = await pool.query(query, params);
  return (rows || []).map((r: any) => ({
    ...r,
    rating: Number(r.rating),
    helpfulCount: Number(r.helpfulCount || 0),
    verified: Boolean(r.verified),
  }));
}

export async function saveMysqlReview(r: any): Promise<any> {
  const pool = await getDbPool();
  const id = r.id || `rev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO reviews (id, productId, userName, userEmail, rating, comment, verified, status, helpfulCount, date, reply, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       rating = VALUES(rating),
       comment = VALUES(comment),
       status = VALUES(status),
       helpfulCount = VALUES(helpfulCount),
       reply = VALUES(reply)`,
    [
      id,
      r.productId,
      r.userName || 'Customer',
      (r.userEmail || '').trim().toLowerCase(),
      Number(r.rating || 5),
      r.comment || '',
      r.verified !== undefined ? (r.verified ? 1 : 0) : 1,
      r.status || 'approved',
      Number(r.helpfulCount || 0),
      r.date || now,
      r.reply || null,
      r.created_at || now,
    ]
  );

  const [rows]: any = await pool.query('SELECT * FROM reviews WHERE id = ? LIMIT 1', [id]);
  return rows[0];
}

export async function deleteMysqlReview(id: string): Promise<boolean> {
  const pool = await getDbPool();
  const [res]: any = await pool.query('DELETE FROM reviews WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

// ============================================================================
// COUPONS CRUD
// ============================================================================

export async function getMysqlCoupons(): Promise<any[]> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC');
  return (rows || []).map((c: any) => ({
    ...c,
    discountValue: Number(c.discountValue),
    minPurchase: Number(c.minPurchase || 0),
    maxDiscount: c.maxDiscount ? Number(c.maxDiscount) : null,
    usageLimit: Number(c.usageLimit || 100),
    usageCount: Number(c.usageCount || 0),
    isActive: Boolean(c.isActive),
    applicableCategories: typeof c.applicableCategories === 'string' ? safeJsonParse(c.applicableCategories, []) : c.applicableCategories || [],
  }));
}

export async function saveMysqlCoupon(c: any): Promise<any> {
  const pool = await getDbPool();
  const id = c.id || `cpn-${Date.now()}`;
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO coupons (id, code, discountType, discountValue, minPurchase, maxDiscount, validFrom, validTo, usageLimit, usageCount, isActive, applicableCategories, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       code = VALUES(code),
       discountType = VALUES(discountType),
       discountValue = VALUES(discountValue),
       minPurchase = VALUES(minPurchase),
       maxDiscount = VALUES(maxDiscount),
       validFrom = VALUES(validFrom),
       validTo = VALUES(validTo),
       usageLimit = VALUES(usageLimit),
       usageCount = VALUES(usageCount),
       isActive = VALUES(isActive),
       applicableCategories = VALUES(applicableCategories)`,
    [
      id,
      (c.code || '').trim().toUpperCase(),
      c.discountType || 'percentage',
      Number(c.discountValue || 0),
      Number(c.minPurchase || 0),
      c.maxDiscount ? Number(c.maxDiscount) : null,
      c.validFrom || null,
      c.validTo || null,
      Number(c.usageLimit || 100),
      Number(c.usageCount || 0),
      c.isActive !== undefined ? (c.isActive ? 1 : 0) : 1,
      JSON.stringify(Array.isArray(c.applicableCategories) ? c.applicableCategories : []),
      c.created_at || now,
    ]
  );

  const [rows]: any = await pool.query('SELECT * FROM coupons WHERE id = ? LIMIT 1', [id]);
  return rows[0];
}

export async function deleteMysqlCoupon(id: string): Promise<boolean> {
  const pool = await getDbPool();
  const [res]: any = await pool.query('DELETE FROM coupons WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

// ============================================================================
// CUSTOM CLOTHING REQUESTS
// ============================================================================

export async function getMysqlCustomClothingRequests(filters?: { status?: string; search?: string }): Promise<any[]> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM custom_clothing_requests ORDER BY created_at DESC');
  let list = (rows || []).map((r: any) => ({
    ...r,
    materialSamples: typeof r.material_samples === 'string' ? safeJsonParse(r.material_samples, []) : r.material_samples || [],
    designImages: typeof r.design_images === 'string' ? safeJsonParse(r.design_images, []) : r.design_images || [],
    designVideos: typeof r.design_videos === 'string' ? safeJsonParse(r.design_videos, []) : r.design_videos || [],
    designLinks: typeof r.design_links === 'string' ? safeJsonParse(r.design_links, []) : r.design_links || [],
    measurements: typeof r.measurements === 'string' ? safeJsonParse(r.measurements, {}) : r.measurements || {},
  }));

  if (filters?.status) {
    const s = filters.status.toLowerCase();
    list = list.filter((r: any) => r.status && r.status.toLowerCase() === s);
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (r: any) =>
        (r.reference_no && r.reference_no.toLowerCase().includes(q)) ||
        (r.full_name && r.full_name.toLowerCase().includes(q)) ||
        (r.email && r.email.toLowerCase().includes(q))
    );
  }

  return list;
}

export async function saveMysqlCustomClothingRequest(req: any): Promise<any> {
  const pool = await getDbPool();
  const id = req.id || `req-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const refNo = req.referenceNo || req.reference_no || `ROP-CC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO custom_clothing_requests (
      id, reference_no, full_name, email, phone, garment_type, other_garment_type,
      material_samples, design_images, design_videos, design_links, measurements,
      preferred_deadline, budget_range, additional_notes, delivery_location, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      status = VALUES(status),
      additional_notes = VALUES(additional_notes),
      updated_at = VALUES(updated_at)`,
    [
      id,
      refNo,
      req.fullName || req.full_name || '',
      (req.email || '').trim().toLowerCase(),
      req.phone || '',
      req.garmentType || req.garment_type || 'Custom Garment',
      req.otherGarmentType || req.other_garment_type || '',
      JSON.stringify(Array.isArray(req.materialSamples) ? req.materialSamples : []),
      JSON.stringify(Array.isArray(req.designImages) ? req.designImages : []),
      JSON.stringify(Array.isArray(req.designVideos) ? req.designVideos : []),
      JSON.stringify(Array.isArray(req.designLinks) ? req.designLinks : []),
      JSON.stringify(req.measurements || {}),
      req.preferredDeadline || req.preferred_deadline || null,
      req.budgetRange || req.budget_range || '',
      req.additionalNotes || req.additional_notes || '',
      req.deliveryLocation || req.delivery_location || '',
      req.status || 'Pending Review',
      req.created_at || now,
      now,
    ]
  );

  const [rows]: any = await pool.query('SELECT * FROM custom_clothing_requests WHERE id = ? LIMIT 1', [id]);
  return rows[0];
}

export async function updateMysqlCustomClothingRequestStatus(id: string, status: string): Promise<any | null> {
  const pool = await getDbPool();
  await pool.query(
    'UPDATE custom_clothing_requests SET status = ?, updated_at = ? WHERE id = ? OR reference_no = ?',
    [status, new Date().toISOString(), id, id]
  );
  const [rows]: any = await pool.query(
    'SELECT * FROM custom_clothing_requests WHERE id = ? OR reference_no = ? LIMIT 1',
    [id, id]
  );
  return rows[0] || null;
}

// ============================================================================
// INVENTORY AUDIT LOGS
// ============================================================================

export async function getMysqlInventoryAuditLogs(limit: number = 100): Promise<any[]> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query(
    'SELECT * FROM inventory_audit_logs ORDER BY timestamp DESC LIMIT ?',
    [Number(limit)]
  );
  return (rows || []).map((l: any) => ({
    ...l,
    changeQuantity: Number(l.changeQuantity),
    newStock: Number(l.newStock),
  }));
}

export async function addMysqlInventoryAuditLog(log: {
  productId: string;
  productName: string;
  productSku?: string;
  changeQuantity: number;
  newStock: number;
  reason: string;
  details?: string;
}): Promise<any> {
  const pool = await getDbPool();
  const id = `inv-log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const timestamp = new Date().toISOString();

  await pool.query(
    `INSERT INTO inventory_audit_logs (id, productId, productName, productSku, timestamp, changeQuantity, newStock, reason, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      log.productId,
      log.productName,
      log.productSku || '',
      timestamp,
      Number(log.changeQuantity || 0),
      Number(log.newStock || 0),
      log.reason || 'Manual Update',
      log.details || '',
    ]
  );

  return { id, timestamp, ...log };
}

// ============================================================================
// PASSWORD RESET TOKENS
// ============================================================================

export async function createMysqlPasswordResetToken(data: {
  userId: string;
  userEmail: string;
  tokenHash: string;
  expiresAt: string;
  ipAddress?: string;
}): Promise<any> {
  const pool = await getDbPool();
  const id = `prt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at, user_email, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.userId,
      data.tokenHash,
      data.expiresAt,
      now,
      data.userEmail.toLowerCase().trim(),
      data.ipAddress || null,
    ]
  );

  return { id, ...data, createdAt: now };
}

export async function getMysqlPasswordResetToken(tokenHash: string): Promise<any | null> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query(
    'SELECT * FROM password_reset_tokens WHERE token_hash = ? LIMIT 1',
    [tokenHash]
  );
  if (!rows || rows.length === 0) return null;
  return rows[0];
}

export async function consumeMysqlPasswordResetToken(
  tokenHash: string,
  newPasswordHash: string,
  nowIso: string = new Date().toISOString()
): Promise<{ success: boolean; error?: string; userId?: string }> {
  const pool = await getDbPool();

  // 1. Atomically mark token as used ONLY IF currently unused and unexpired
  const [updateRes]: any = await pool.query(
    'UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at >= ?',
    [nowIso, tokenHash, nowIso]
  );

  if (!updateRes || updateRes.affectedRows === 0) {
    const tokenRecord = await getMysqlPasswordResetToken(tokenHash);
    if (!tokenRecord) {
      return { success: false, error: 'Password reset token not found or invalid.' };
    }
    if (tokenRecord.used_at) {
      return { success: false, error: 'TOKEN_ALREADY_USED_OR_CONCURRENT_UPDATE' };
    }
    if (new Date(tokenRecord.expires_at) < new Date(nowIso)) {
      return { success: false, error: 'Password reset token has expired. Please request a new link.' };
    }
    return { success: false, error: 'TOKEN_ALREADY_USED_OR_CONCURRENT_UPDATE' };
  }

  // 2. Token was atomically consumed by this specific thread! Fetch user_id and update password.
  const tokenRecord = await getMysqlPasswordResetToken(tokenHash);
  if (!tokenRecord || !tokenRecord.user_id) {
    return { success: false, error: 'User record linked to token not found.' };
  }

  await updateMysqlUserPasswordById(tokenRecord.user_id, newPasswordHash);
  return { success: true, userId: tokenRecord.user_id };
}

export async function cleanupExpiredMysqlResetTokens(nowIso: string = new Date().toISOString()): Promise<number> {
  const pool = await getDbPool();
  const [res]: any = await pool.query(
    'DELETE FROM password_reset_tokens WHERE expires_at < ? OR used_at IS NOT NULL',
    [nowIso]
  );
  return res.affectedRows || 0;
}

export async function invalidatePreviousMysqlUserTokens(userId: string): Promise<void> {
  const pool = await getDbPool();
  await pool.query(
    'UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL',
    [new Date().toISOString(), userId]
  );
}

// ============================================================================
// RETURNS MANAGEMENT
// ============================================================================

export async function getMysqlReturnRequests(filters?: { status?: string; email?: string }): Promise<any[]> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM returns ORDER BY createdAt DESC');
  let list = (rows || []).map((r: any) => ({
    ...r,
    refundAmount: r.refundAmount ? Number(r.refundAmount) : null,
    items: typeof r.items === 'string' ? safeJsonParse(r.items, []) : r.items || [],
  }));

  if (filters?.status) {
    list = list.filter((r: any) => r.status && r.status.toLowerCase() === filters.status!.toLowerCase());
  }

  if (filters?.email) {
    list = list.filter((r: any) => r.customerEmail && r.customerEmail.toLowerCase() === filters.email!.toLowerCase());
  }

  return list;
}

export async function saveMysqlReturnRequest(req: any): Promise<any> {
  const pool = await getDbPool();
  const id = req.id || `ret-${Date.now()}`;
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO returns (id, orderId, customerEmail, customerName, items, reason, status, refundAmount, trackingNumber, adminNote, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       refundAmount = VALUES(refundAmount),
       trackingNumber = VALUES(trackingNumber),
       adminNote = VALUES(adminNote),
       updatedAt = VALUES(updatedAt)`,
    [
      id,
      req.orderId,
      (req.customerEmail || '').trim().toLowerCase(),
      req.customerName || 'Customer',
      JSON.stringify(Array.isArray(req.items) ? req.items : []),
      req.reason || 'General Return',
      req.status || 'pending',
      req.refundAmount ? Number(req.refundAmount) : null,
      req.trackingNumber || null,
      req.adminNote || null,
      req.createdAt || now,
      now,
    ]
  );

  const [rows]: any = await pool.query('SELECT * FROM returns WHERE id = ? LIMIT 1', [id]);
  return rows[0];
}

export async function updateMysqlReturnRequestStatus(
  id: string,
  status: string,
  adminNote?: string,
  trackingNumber?: string
): Promise<any | null> {
  const pool = await getDbPool();
  const updates: string[] = ['status = ?', 'updatedAt = ?'];
  const values: any[] = [status, new Date().toISOString()];

  if (adminNote !== undefined) {
    updates.push('adminNote = ?');
    values.push(adminNote);
  }
  if (trackingNumber !== undefined) {
    updates.push('trackingNumber = ?');
    values.push(trackingNumber);
  }

  values.push(id);
  await pool.query(`UPDATE returns SET ${updates.join(', ')} WHERE id = ?`, values);
  const [rows]: any = await pool.query('SELECT * FROM returns WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

// ============================================================================
// CART SESSIONS
// ============================================================================

export async function getMysqlCartSession(sessionId: string): Promise<any[] | null> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT items FROM cart_sessions WHERE session_id = ? LIMIT 1', [sessionId]);
  if (!rows || rows.length === 0) return null;
  return safeJsonParse(rows[0].items, []);
}

export async function saveMysqlCartSession(sessionId: string, items: any[], userId?: string): Promise<void> {
  const pool = await getDbPool();
  const id = `cart-${sessionId}`;
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO cart_sessions (id, session_id, user_id, items, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       items = VALUES(items),
       user_id = VALUES(user_id),
       updated_at = VALUES(updated_at)`,
    [id, sessionId, userId || null, JSON.stringify(items || []), now]
  );
}

// ============================================================================
// EMAIL QUEUE & SUBSCRIBERS
// ============================================================================

export async function getMysqlEmailQueue(status: string = 'pending', limit: number = 20): Promise<any[]> {
  const pool = await getDbPool();
  const now = new Date().toISOString();
  const [rows]: any = await pool.query(
    'SELECT * FROM email_queue WHERE status = ? AND next_attempt_at <= ? ORDER BY created_at ASC LIMIT ?',
    [status, now, Number(limit)]
  );
  return (rows || []).map((q: any) => ({
    ...q,
    context: safeJsonParse(q.context, {}),
    attempts: Number(q.attempts),
    max_attempts: Number(q.max_attempts),
  }));
}

export async function saveMysqlEmailQueueItem(item: {
  toEmail: string;
  subject: string;
  templateName: string;
  context: any;
}): Promise<any> {
  const pool = await getDbPool();
  const id = `eq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO email_queue (id, to_email, subject, template_name, context, status, attempts, max_attempts, next_attempt_at, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', 0, 3, ?, ?)`,
    [
      id,
      item.toEmail.trim().toLowerCase(),
      item.subject,
      item.templateName,
      JSON.stringify(item.context || {}),
      now,
      now,
    ]
  );

  return { id, ...item, status: 'pending', created_at: now };
}

export async function updateMysqlEmailQueueItemStatus(
  id: string,
  status: 'sent' | 'failed' | 'processing',
  errorMessage?: string,
  nextAttemptAt?: string
): Promise<void> {
  const pool = await getDbPool();
  const now = new Date().toISOString();
  if (status === 'sent') {
    await pool.query(
      'UPDATE email_queue SET status = ?, sent_at = ?, error_message = NULL WHERE id = ?',
      [status, now, id]
    );
  } else if (status === 'failed') {
    await pool.query(
      'UPDATE email_queue SET status = ?, attempts = attempts + 1, error_message = ?, next_attempt_at = ? WHERE id = ?',
      [status, errorMessage || null, nextAttemptAt || now, id]
    );
  } else {
    await pool.query('UPDATE email_queue SET status = ? WHERE id = ?', [status, id]);
  }
}

export async function addMysqlEmailLog(log: {
  toEmail: string;
  subject: string;
  templateName: string;
  status: string;
  errorMessage?: string;
  metadata?: any;
}): Promise<void> {
  const pool = await getDbPool();
  const id = `elog-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO email_logs (id, to_email, subject, template_name, status, error_message, sent_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      log.toEmail.trim().toLowerCase(),
      log.subject,
      log.templateName,
      log.status,
      log.errorMessage || null,
      now,
      JSON.stringify(log.metadata || {}),
    ]
  );
}

export async function getMysqlEmailLogs(limit: number = 100): Promise<any[]> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT ?', [
    Number(limit),
  ]);
  return (rows || []).map((l: any) => ({
    ...l,
    metadata: safeJsonParse(l.metadata, {}),
  }));
}

export async function getMysqlEmailSubscribers(): Promise<any[]> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM email_subscribers ORDER BY subscribed_at DESC');
  return rows || [];
}

export async function saveMysqlEmailSubscriber(email: string, source: string = 'website_footer'): Promise<any> {
  const pool = await getDbPool();
  const normalized = email.trim().toLowerCase();
  const id = `sub-${Date.now()}`;
  const now = new Date().toISOString();
  const token = `tok-${Math.random().toString(36).substring(2, 10)}`;

  await pool.query(
    `INSERT INTO email_subscribers (id, email, status, source, subscribed_at, token)
     VALUES (?, ?, 'subscribed', ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       status = 'subscribed',
       source = VALUES(source),
       subscribed_at = VALUES(subscribed_at)`,
    [id, normalized, source, now, token]
  );

  const [rows]: any = await pool.query('SELECT * FROM email_subscribers WHERE email = ? LIMIT 1', [normalized]);
  return rows[0];
}

export async function getMysqlEmailPreferences(email: string): Promise<any> {
  const pool = await getDbPool();
  const normalized = email.trim().toLowerCase();
  const [rows]: any = await pool.query('SELECT * FROM email_preferences WHERE email = ? LIMIT 1', [normalized]);
  if (!rows || rows.length === 0) {
    return {
      email: normalized,
      order_updates: true,
      promotions: true,
      newsletter: true,
      security_alerts: true,
    };
  }
  const raw = rows[0];
  return {
    email: raw.email,
    order_updates: Boolean(raw.order_updates),
    promotions: Boolean(raw.promotions),
    newsletter: Boolean(raw.newsletter),
    security_alerts: Boolean(raw.security_alerts),
  };
}

export async function saveMysqlEmailPreferences(prefs: {
  email: string;
  order_updates?: boolean;
  promotions?: boolean;
  newsletter?: boolean;
  security_alerts?: boolean;
}): Promise<any> {
  const pool = await getDbPool();
  const normalized = prefs.email.trim().toLowerCase();
  const id = `epref-${Date.now()}`;
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO email_preferences (id, email, order_updates, promotions, newsletter, security_alerts, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       order_updates = VALUES(order_updates),
       promotions = VALUES(promotions),
       newsletter = VALUES(newsletter),
       security_alerts = VALUES(security_alerts),
       updated_at = VALUES(updated_at)`,
    [
      id,
      normalized,
      prefs.order_updates !== undefined ? (prefs.order_updates ? 1 : 0) : 1,
      prefs.promotions !== undefined ? (prefs.promotions ? 1 : 0) : 1,
      prefs.newsletter !== undefined ? (prefs.newsletter ? 1 : 0) : 1,
      prefs.security_alerts !== undefined ? (prefs.security_alerts ? 1 : 0) : 1,
      now,
    ]
  );

  return getMysqlEmailPreferences(normalized);
}

// ============================================================================
// PUSH / PULL COMPLETE SYNC DATA
// ============================================================================

export async function pushSyncData(payload: Record<string, any>): Promise<void> {
  try {
    // 1. Sync Products
    if (Array.isArray(payload.veloce_products)) {
      for (const p of payload.veloce_products) {
        if (!p.id || !p.name) continue;
        await saveMysqlProduct(p);
      }
    }

    // 2. Sync Orders
    if (Array.isArray(payload.veloce_orders)) {
      for (const o of payload.veloce_orders) {
        if (!o.id) continue;
        await saveMysqlOrder(o);
      }
    }

    // 3. Sync Settings
    if (payload.veloce_site_settings) {
      await saveMysqlSiteSettings(payload.veloce_site_settings);
    }

    // 4. Sync Hero Banners
    if (Array.isArray(payload.veloce_hero_banners)) {
      await saveMysqlHeroBanners(payload.veloce_hero_banners);
    }

    console.log('[MySQL] Production push synchronization successfully completed.');
  } catch (error) {
    console.error('[MySQL] Production push synchronization failed:', error);
    throw error;
  }
}

export async function pullSyncData(): Promise<Record<string, any>> {
  const products = await getMysqlProducts();
  const orders = await getMysqlOrders();
  const siteSettings = await getMysqlSiteSettings();
  const heroBanners = await getMysqlHeroBanners();
  const suppliers = await getMysqlSuppliers();
  const coupons = await getMysqlCoupons();
  const reviews = await getMysqlReviews();
  const auditLogs = await getMysqlInventoryAuditLogs(100);

  return {
    veloce_products: products,
    veloce_orders: orders,
    veloce_site_settings: siteSettings,
    veloce_hero_banners: heroBanners,
    veloce_suppliers: suppliers,
    veloce_coupons: coupons,
    veloce_reviews: reviews,
    veloce_inventory_audit_logs: auditLogs,
    last_synced_at: new Date().toISOString(),
    source: 'MySQL Database',
  };
}

// ============================================================================
// DEFAULT BOOTSTRAP SEEDS (ADMIN, CUSTOMERS, PRODUCTS, HERO BANNERS)
// ============================================================================

export async function ensureDefaultAdminUser(): Promise<void> {
  const adminEmail = (process.env.ADMIN_EMAIL || 'ropenixkenya@gmail.com').trim().toLowerCase();
  const hostUser = (process.env.EMAIL_HOST_USER || 'admin@ropenix.co.ke').trim().toLowerCase();

  for (const email of [adminEmail, hostUser]) {
    if (!email || !email.includes('@')) continue;
    try {
      const existing = await getMysqlUserByEmail(email);
      if (!existing) {
        const defaultSalt = '0123456789abcdef0123456789abcdef';
        const defaultHash = '35e4d293226a31c5b88ce8325dc01c385f850e047702890538a7c88b90a61254bf52199b5ff7a988d44747eb6fa32d4323e20e8d0537f819446f28b75710609f';
        await saveMysqlUser({
          id: `usr-admin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          username: email.split('@')[0],
          email: email,
          password_hash: `${defaultSalt}:${defaultHash}`,
          first_name: 'Administrator',
          last_name: 'Account',
          role: 'admin',
          is_staff: 1,
          is_superuser: 1,
          email_verified: 1,
        });
        console.log(`[MySQL] Seeded default administrator account: <${email}>`);
      }
    } catch (err) {
      console.warn(`[MySQL] Admin account seed check notice for ${email}:`, err);
    }
  }

  await ensureDefaultCustomers().catch((err) => console.warn('[MySQL] Default customer seed notice:', err));
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
      let user = await getMysqlUserByEmail(email);
      if (!user) {
        user = await saveMysqlUser({
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
        console.log(`[MySQL] Seeded registered customer user: <${email}>`);
      }

      const allCust = await getAllMysqlCustomers();
      const existingCust = allCust.find((c) => (c.email || '').toLowerCase().trim() === email);
      if (!existingCust) {
        await saveMysqlCustomer({
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
        console.log(`[MySQL] Seeded CRM customer record: <${email}>`);
      }
    } catch (err) {
      console.warn(`[MySQL] Customer seed check notice for ${email}:`, err);
    }
  }
}

export async function ensureDefaultProducts(): Promise<void> {
  try {
    const existing = await getMysqlProducts();
    const existingIds = new Set(existing.map((p: any) => p.id));

    const DEFAULT_PRODUCTS: any[] = [
      {
        id: 'prod-oak-riser',
        sku: 'DSK-OAK-001',
        slug: 'solid-walnut-dual-monitor-riser',
        name: 'Solid Walnut Dual Monitor Riser with MagSafe Slot',
        brand: 'Veloce Woodcraft',
        country_of_origin: 'Kenya',
        description: 'Handcrafted from sustainable solid American walnut timber. Integrated magnetic wireless charging dock, dual display capacity, and premium anodized aluminum risers.',
        shortDescription: 'Handcrafted solid walnut dual monitor stand with integrated MagSafe charging pad.',
        detailedDescription: 'Elevate your workspace ergonomics and aesthetic with the Veloce Solid Walnut Dual Monitor Riser. Masterfully carved from kiln-dried Grade-A American Walnut, this desk shelf accommodates two 27-inch displays or an ultrawide monitor with zero flex.',
        price: 11900,
        costPrice: 6500,
        originalPrice: 13500,
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
        rating: 4.8,
        reviewsCount: 12,
        status: 'Active',
      },
      {
        id: 'prod-mag-keyboard',
        sku: 'KB-TITAN-75',
        slug: 'veloce-titan-75-cnc-magnetic-keyboard',
        name: 'Veloce Titan 75% CNC Magnetic Hall-Effect Keyboard',
        brand: 'Veloce Tech',
        country_of_origin: 'Kenya',
        description: 'Aerospace-grade CNC aluminum housing, rapid-trigger Hall effect magnetic analog switches, and dynamic per-key RGB backlighting.',
        shortDescription: 'Precision CNC 75% gaming & typing keyboard with magnetic rapid-trigger switches.',
        detailedDescription: 'The Veloce Titan 75 is engineered for uncompromising speed, tactile feedback, and endurance. Built inside an anodized 6063 aerospace aluminum case with custom sound-dampening poron foam gaskets.',
        price: 24500,
        costPrice: 14500,
        originalPrice: 28000,
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
        rating: 4.9,
        reviewsCount: 24,
        status: 'Active',
      },
      {
        id: 'prod-streetwear-hoodie',
        sku: 'APP-HDY-480',
        slug: 'ropenix-heavyweight-480gsm-french-terry-hoodie',
        name: 'Ropenix Heavyweight 480GSM French Terry Hoodie',
        brand: 'Ropenix Atelier',
        country_of_origin: 'Kenya',
        description: 'Custom milled 100% organic combed cotton in 480 GSM ultra-heavyweight knit. Double-layered structured hood and signature dropped shoulder fit.',
        shortDescription: 'Luxury heavyweight 480GSM organic cotton oversized streetwear hoodie.',
        detailedDescription: 'Crafted in Nairobi with obsessive attention to fabric weight, drape, and longevity. Milled from sustainably sourced East African organic long-staple cotton, pre-shrunk to guarantee zero size change after washing.',
        price: 6800,
        costPrice: 3200,
        originalPrice: 8000,
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
        rating: 4.7,
        reviewsCount: 18,
        status: 'Active',
      },
      {
        id: 'prod-candle-coconut',
        sku: 'BEA-CNDL-01',
        slug: 'swahili-coast-coconut-amber-candle',
        name: 'Swahili Coast Coconut & Amber Hand-Poured Candle',
        brand: 'Kilifi Artisans',
        country_of_origin: 'Kenya',
        description: 'Hand-poured coconut wax with crackling wood wick and aromatic amber fragrance notes from the Kenyan coast.',
        shortDescription: 'Artisanal coconut wax candle with crackling wood wick and coastal amber aroma.',
        detailedDescription: 'Handcrafted in Kilifi using 100% natural coconut soy wax blended with pure essential oils and fragrance essences inspired by the Indian Ocean coastline.',
        price: 2600,
        costPrice: 1200,
        originalPrice: 3200,
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
        rating: 4.9,
        reviewsCount: 15,
        status: 'Active',
      }
    ];

    for (const p of DEFAULT_PRODUCTS) {
      if (!existingIds.has(p.id)) {
        await saveMysqlProduct(p);
        console.log(`[MySQL] Seeded missing catalog product: "${p.name}" (${p.id})`);
      }
    }
  } catch (err) {
    console.warn('[MySQL] Default product seed notice:', err);
  }
}

export async function ensureDefaultHeroBanners(): Promise<void> {
  try {
    const existing = await getMysqlHeroBanners();
    if (existing.length > 0) return;

    const DEFAULT_BANNERS = [
      {
        id: 'banner-1',
        title: 'Curated Excellence. Uncompromised Quality.',
        subtitle: 'Experience precision engineering, bespoke tailoring, and timeless craftsmanship built in Kenya.',
        imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1600',
        link: '/store',
        ctaText: 'Explore Catalog',
        badgeText: 'New Season Collections',
        active: true,
      },
      {
        id: 'banner-2',
        title: 'Bespoke Atelier Tailoring & Custom Garments',
        subtitle: 'Submit your bespoke fashion requests, upload reference mood boards, and track tailor execution in real-time.',
        imageUrl: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&q=80&w=1600',
        link: '/services',
        ctaText: 'Design Bespoke Apparel',
        badgeText: 'Handmade in Nairobi',
        active: true,
      }
    ];

    await saveMysqlHeroBanners(DEFAULT_BANNERS);
    console.log('[MySQL] Seeded default promotional hero banners.');
  } catch (err) {
    console.warn('[MySQL] Default hero banner seed notice:', err);
  }
}

// ============================================================================
// APP SETTINGS & METADATA (Themes, Backups, Audit Logs)
// ============================================================================

export async function getAppSetting(key: string, defaultValue: any = null): Promise<any> {
  try {
    const pool = await getDbPool();
    const [rows]: any = await pool.query('SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1', [key]);
    if (rows && rows.length > 0 && rows[0].setting_value) {
      try {
        return JSON.parse(rows[0].setting_value);
      } catch {
        return rows[0].setting_value;
      }
    }
  } catch (err) {
    console.warn(`[MySQL] getAppSetting('${key}') notice:`, err);
  }
  return defaultValue;
}

export async function setAppSetting(key: string, value: any): Promise<void> {
  try {
    const pool = await getDbPool();
    const stringVal = typeof value === 'string' ? value : JSON.stringify(value);
    await pool.query(
      `INSERT INTO app_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);`,
      [key, stringVal]
    );
  } catch (err) {
    console.warn(`[MySQL] setAppSetting('${key}') notice:`, err);
  }
}

export async function purgeAllMysqlData(): Promise<void> {
  const pool = await getDbPool();
  const tables = [
    'orders', 'products', 'categories', 'suppliers', 'supplier_products',
    'supplier_batches', 'supplier_payments', 'supplier_ledger', 'customers',
    'coupons', 'reviews', 'hero_banners', 'custom_clothing_requests',
    'inventory_audit_logs', 'password_reset_tokens', 'returns', 'email_queue',
    'email_logs', 'email_subscribers', 'email_preferences', 'cart_sessions',
    'payment_submissions', 'email_jobs', 'scheduled_task_logs', 'customer_orders'
  ];

  for (const table of tables) {
    try {
      await pool.query(`DELETE FROM \`${table}\`;`);
    } catch (err: any) {
      console.warn(`[MySQL Purge] Could not purge table ${table}:`, err?.message);
    }
  }
  console.log('[MySQL] All application data successfully purged.');
}

// ============================================================================
// BACKWARD-COMPATIBILITY EXPORTS & DROP-IN REPLACEMENTS
// ============================================================================

export const getSqliteDb = async () => ({
  exec: () => [],
  prepare: () => ({ run: () => {}, bind: () => {}, step: () => false, getAsObject: () => ({}), free: () => {} }),
  run: () => {},
});
export const saveSqliteDb = () => {};
export const reloadSqliteDbFromDisk = async () => getSqliteDb();
export const getSqliteDbStatus = async () => {
  const status = await getDbStatus();
  return {
    connected: status.connected,
    message: status.message,
  };
};

export const getSqliteUserByEmail = getMysqlUserByEmail;
export const getSqliteUserByEmailOrUsername = getMysqlUserByEmailOrUsername;
export const getSqliteUserById = getMysqlUserById;
export const saveSqliteUser = saveMysqlUser;
export const getAllSqliteUsers = getAllMysqlUsers;
export const deleteSqliteUser = deleteMysqlUser;

export async function getMysqlPendingRegistration(email: string): Promise<any | null> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM pending_registrations WHERE LOWER(email) = ? LIMIT 1', [
    (email || '').trim().toLowerCase()
  ]);
  if (!rows || rows.length === 0) return null;
  const row = rows[0];
  return {
    ...row,
    userData: typeof row.user_data === 'string' ? JSON.parse(row.user_data) : row.user_data
  };
}

export async function saveMysqlPendingRegistration(record: any): Promise<void> {
  const pool = await getDbPool();
  const id = record.id || `pr-${Date.now()}`;
  const now = new Date().toISOString();
  const userDataStr = typeof record.userData === 'string' ? record.userData : JSON.stringify(record.userData || {});
  await pool.query(
    `INSERT INTO pending_registrations (id, email, otp, user_data, attempts, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       otp = VALUES(otp),
       user_data = VALUES(user_data),
       attempts = VALUES(attempts),
       expires_at = VALUES(expires_at);`,
    [
      id,
      (record.email || '').trim().toLowerCase(),
      record.otp,
      userDataStr,
      record.attempts || 0,
      record.createdAt || now,
      record.expiresAt || new Date(Date.now() + 15 * 60 * 1000).toISOString()
    ]
  );
}

export async function deleteMysqlPendingRegistration(email: string): Promise<void> {
  const pool = await getDbPool();
  await pool.query('DELETE FROM pending_registrations WHERE LOWER(email) = ?', [(email || '').trim().toLowerCase()]);
}

export async function updateMysqlPendingRegistrationAttempts(email: string, attempts: number): Promise<void> {
  const pool = await getDbPool();
  await pool.query('UPDATE pending_registrations SET attempts = ? WHERE LOWER(email) = ?', [attempts, (email || '').trim().toLowerCase()]);
}

export const getSqlitePendingRegistration = getMysqlPendingRegistration;
export const saveSqlitePendingRegistration = saveMysqlPendingRegistration;
export const deleteSqlitePendingRegistration = deleteMysqlPendingRegistration;
export const updateSqlitePendingRegistrationAttempts = updateMysqlPendingRegistrationAttempts;
export const getFlaggedDuplicateAccounts = async (): Promise<any[]> => [];

export async function updateSqliteUserPassword(userId: string, newPasswordHash: string): Promise<boolean> {
  const pool = await getDbPool();
  const [res]: any = await pool.query('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
    newPasswordHash,
    new Date().toISOString(),
    userId
  ]);
  return (res?.affectedRows || 0) > 0;
}

export const updateSqliteUserPasswordById = updateSqliteUserPassword;

export const getSqliteProducts = getMysqlProducts;
export const getSqliteProductById = getMysqlProductById;
export const saveSqliteProduct = saveMysqlProduct;
export const deleteSqliteProduct = deleteMysqlProduct;
export const updateSqliteProductStock = updateMysqlProductStock;
export const bulkUpdateSqliteProducts = bulkUpdateMysqlProducts;

export async function deleteSqliteProductsBulk(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  const pool = await getDbPool();
  await pool.query(`DELETE FROM products WHERE id IN (?)`, [ids]);
}

export const getAllSqliteCategories = getMysqlCategories;
export const getSqliteCategories = getMysqlCategories;
export const saveSqliteCategory = saveMysqlCategory;
export const deleteSqliteCategory = deleteMysqlCategory;

export async function saveSqliteCategories(categories: any[]): Promise<void> {
  for (const c of categories) {
    await saveMysqlCategory(c);
  }
}

export async function deleteSqliteCategoriesBulk(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  const pool = await getDbPool();
  await pool.query(`DELETE FROM categories WHERE id IN (?)`, [ids]);
}

export async function updateSqliteCategoriesBulk(categories: any[]): Promise<void> {
  for (const c of categories) {
    await saveMysqlCategory(c);
  }
}

export const getAllSqliteOrders = getMysqlOrders;
export const getSqliteOrders = getMysqlOrders;
export const getSqliteOrderById = getMysqlOrderById;
export const saveSqliteOrder = saveMysqlOrder;
export const updateSqliteOrderStatus = updateMysqlOrderStatus;
export const deleteSqliteOrder = deleteMysqlOrder;
export const getSqliteOrdersByCustomerEmail = getMysqlOrdersByCustomerEmail;

export async function getSqliteOrdersByUser(userIdOrEmail: string): Promise<any[]> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query(
    'SELECT * FROM orders WHERE customerEmail = ? OR customerEmail = (SELECT email FROM users WHERE id = ? LIMIT 1) ORDER BY date DESC',
    [userIdOrEmail, userIdOrEmail]
  );
  return (rows || []).map((r: any) => ({
    ...r,
    items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
  }));
}

export async function syncSqliteOrders(orders: any[]): Promise<void> {
  for (const o of orders) {
    await saveMysqlOrder(o);
  }
}

export const getAllSqliteSuppliers = getMysqlSuppliers;
export const getSqliteSuppliers = getMysqlSuppliers;
export const saveSqliteSupplier = saveMysqlSupplier;
export const deleteSqliteSupplier = deleteMysqlSupplier;

export async function getSqliteSupplierById(id: string): Promise<any | null> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM suppliers WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export const getAllSqliteSupplierProducts = getMysqlSupplierProducts;
export const getSqliteSupplierProducts = getMysqlSupplierProducts;
export const saveSqliteSupplierProduct = saveMysqlSupplierProduct;

export const getAllSqliteSupplierIntakes = getMysqlSupplierBatches;
export const getSqliteSupplierBatches = getMysqlSupplierBatches;
export const saveSqliteSupplierIntake = saveMysqlSupplierBatch;
export const saveSqliteSupplierBatch = saveMysqlSupplierBatch;

export const getAllSqliteSupplierPayments = getMysqlSupplierPayments;
export const getSqliteSupplierPayments = getMysqlSupplierPayments;
export const saveSqliteSupplierPayment = saveMysqlSupplierPayment;

export const getSqliteSupplierLedger = getMysqlSupplierLedger;
export const saveSqliteSupplierLedgerEntry = saveMysqlSupplierLedgerEntry;

export async function getSqliteSupplierStatement(supplierId: string): Promise<SupplierStatement | null> {
  const supplier = await getSqliteSupplierById(supplierId);
  if (!supplier) return null;
  const batches = await getMysqlSupplierBatches(supplierId);
  const payments = await getMysqlSupplierPayments(supplierId);
  const ledger = await getMysqlSupplierLedger(supplierId);
  const totalInvoiced = batches.reduce((sum, b) => sum + Number(b.totalCost || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return {
    supplier,
    openingBalance: 0,
    closingBalance: totalInvoiced - totalPaid,
    totalInvoiced,
    totalPaid,
    batches,
    payments,
    ledgerEntries: ledger,
    periodStart: supplier.created_at || new Date().toISOString(),
    periodEnd: new Date().toISOString(),
  };
}

export async function getSqliteSupplierDashboardAnalytics(): Promise<SupplierDashboardMetrics> {
  const suppliers = await getMysqlSuppliers();
  const batches = await getMysqlSupplierBatches();
  const payments = await getMysqlSupplierPayments();
  const totalPurchases = batches.reduce((sum, b) => sum + Number(b.totalCost || 0), 0);
  const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return {
    totalSuppliers: suppliers.length,
    activeSuppliers: suppliers.filter((s: any) => s.active).length,
    totalPurchases,
    totalOutstanding: totalPurchases - totalPayments,
    totalBatchesReceived: batches.length,
    pendingPaymentsCount: 0,
    topSuppliersByVolume: suppliers.slice(0, 5).map((s: any) => ({ supplierId: s.id, supplierName: s.name, totalVolume: Number(s.totalSpend || 0) })),
  };
}

export async function getSqliteSupplierReport(range?: string): Promise<SupplierReportData> {
  const metrics = await getSqliteSupplierDashboardAnalytics();
  const suppliers = await getMysqlSuppliers();
  const batches = await getMysqlSupplierBatches();
  const payments = await getMysqlSupplierPayments();
  return {
    generatedAt: new Date().toISOString(),
    metrics,
    suppliers,
    batches,
    payments,
  };
}

export const getAllSqliteCustomers = getAllMysqlCustomers;
export const saveSqliteCustomer = saveMysqlCustomer;

export async function getSqliteCustomerById(id: string): Promise<any | null> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM customers WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function deleteSqliteCustomer(id: string): Promise<void> {
  const pool = await getDbPool();
  await pool.query('DELETE FROM customers WHERE id = ?', [id]);
}

export async function saveSqliteDeal(deal: any): Promise<any> {
  const pool = await getDbPool();
  const id = deal.id || `deal-${Date.now()}`;
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO deals (id, customer_id, title, value, stage, probability, expected_close_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       value = VALUES(value),
       stage = VALUES(stage),
       probability = VALUES(probability),
       expected_close_date = VALUES(expected_close_date),
       updated_at = VALUES(updated_at);`,
    [
      id,
      deal.customerId || deal.customer_id || '',
      deal.title || 'Deal',
      Number(deal.value || 0),
      deal.stage || 'lead',
      deal.probability || 50,
      deal.expectedCloseDate || null,
      deal.createdAt || now,
      now
    ]
  );
  return { ...deal, id };
}

export async function deleteSqliteDeal(id: string): Promise<void> {
  const pool = await getDbPool();
  await pool.query('DELETE FROM deals WHERE id = ?', [id]);
}

export async function saveSqliteInvoice(inv: any): Promise<any> {
  const pool = await getDbPool();
  const id = inv.id || `inv-${Date.now()}`;
  const now = new Date().toISOString();
  const itemsStr = typeof inv.items === 'string' ? inv.items : JSON.stringify(inv.items || []);
  await pool.query(
    `INSERT INTO invoices (id, customer_id, invoice_number, amount, status, issue_date, due_date, items, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       invoice_number = VALUES(invoice_number),
       amount = VALUES(amount),
       status = VALUES(status),
       issue_date = VALUES(issue_date),
       due_date = VALUES(due_date),
       items = VALUES(items),
       updated_at = VALUES(updated_at);`,
    [
      id,
      inv.customerId || inv.customer_id || '',
      inv.invoiceNumber || inv.invoice_number || `INV-${Date.now()}`,
      Number(inv.amount || 0),
      inv.status || 'unpaid',
      inv.issueDate || inv.issue_date || now,
      inv.dueDate || inv.due_date || now,
      itemsStr,
      inv.createdAt || now,
      now
    ]
  );
  return { ...inv, id };
}

export async function deleteSqliteInvoice(id: string): Promise<void> {
  const pool = await getDbPool();
  await pool.query('DELETE FROM invoices WHERE id = ?', [id]);
}

export async function saveSqliteCustomerOrder(order: any): Promise<any> {
  const pool = await getDbPool();
  const id = order.id || `co-${Date.now()}`;
  const now = new Date().toISOString();
  const itemsStr = typeof order.items === 'string' ? order.items : JSON.stringify(order.items || []);
  await pool.query(
    `INSERT INTO customer_orders (id, customer_id, customer_name, customer_email, customer_phone, total, status, payment_status, payment_reference, payment_amount, items, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       customer_name = VALUES(customer_name),
       customer_email = VALUES(customer_email),
       customer_phone = VALUES(customer_phone),
       total = VALUES(total),
       status = VALUES(status),
       payment_status = VALUES(payment_status),
       payment_reference = VALUES(payment_reference),
       payment_amount = VALUES(payment_amount),
       items = VALUES(items),
       updated_at = VALUES(updated_at);`,
    [
      id,
      order.customerId || order.customer_id || null,
      order.customerName || order.customer_name || 'Customer',
      order.customerEmail || order.customer_email || '',
      order.customerPhone || order.customer_phone || '',
      Number(order.total || 0),
      order.status || 'pending',
      order.paymentStatus || order.payment_status || 'unpaid',
      order.paymentReference || order.payment_reference || null,
      order.paymentAmount || order.payment_amount || null,
      itemsStr,
      order.createdAt || now,
      now
    ]
  );
  return { ...order, id };
}

export const getSqliteSiteSettings = getMysqlSiteSettings;
export const saveSqliteSiteSettings = saveMysqlSiteSettings;

export const getAllSqliteHeroBanners = getMysqlHeroBanners;
export const getSqliteHeroBanners = getMysqlHeroBanners;
export const saveSqliteHeroBanners = saveMysqlHeroBanners;

export const getAllSqliteReviews = getMysqlReviews;
export const getSqliteReviews = getMysqlReviews;
export const saveSqliteReview = saveMysqlReview;
export const deleteSqliteReview = deleteMysqlReview;

export async function getSqliteReviewsByProduct(productId: string): Promise<any[]> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM reviews WHERE productId = ? AND status = "approved" ORDER BY date DESC', [productId]);
  return rows || [];
}

export async function updateSqliteReview(review: any): Promise<void> {
  await saveMysqlReview(review);
}

export async function toggleSqliteReviewHelpful(reviewId: string): Promise<number> {
  const pool = await getDbPool();
  await pool.query('UPDATE reviews SET helpfulCount = helpfulCount + 1 WHERE id = ?', [reviewId]);
  const [rows]: any = await pool.query('SELECT helpfulCount FROM reviews WHERE id = ? LIMIT 1', [reviewId]);
  return rows[0]?.helpfulCount || 0;
}

export async function updateSqliteReviewStatus(reviewId: string, status: string): Promise<void> {
  const pool = await getDbPool();
  await pool.query('UPDATE reviews SET status = ? WHERE id = ?', [status, reviewId]);
}

export async function recomputeSqliteProductRating(productId: string): Promise<void> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT AVG(rating) as avgRating, COUNT(*) as count FROM reviews WHERE productId = ? AND status = "approved"', [productId]);
  const avg = rows[0]?.avgRating || 0;
  const count = rows[0]?.count || 0;
  await pool.query('UPDATE products SET rating = ?, reviewsCount = ? WHERE id = ?', [Number(avg).toFixed(1), count, productId]);
}

export const getSqliteReviewRequestLogs = async (): Promise<any[]> => [];
export const getSqliteReviewRequestSettings = async (): Promise<any> => getAppSetting('review_request_settings', { enabled: true, delayDays: 7 });
export const saveSqliteReviewRequestSettings = async (s: any): Promise<void> => setAppSetting('review_request_settings', s);
export const addSqliteReviewOptOut = async (email: string): Promise<void> => setAppSetting(`optout_review_${email}`, true);
export const getSqliteReviewOptOutsCount = async (): Promise<number> => 0;

export const getSqliteCoupons = getMysqlCoupons;
export const saveSqliteCoupon = saveMysqlCoupon;
export const deleteSqliteCoupon = deleteMysqlCoupon;

export const getSqliteCustomClothingRequests = getMysqlCustomClothingRequests;
export const saveSqliteCustomClothingRequest = saveMysqlCustomClothingRequest;
export const updateSqliteCustomClothingRequestStatus = updateMysqlCustomClothingRequestStatus;

export async function getSqliteCustomClothingRequestById(id: string): Promise<any | null> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT * FROM custom_clothing_requests WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export const getSqliteInventoryAuditLogs = getMysqlInventoryAuditLogs;
export const addSqliteInventoryAuditLog = addMysqlInventoryAuditLog;

export const createSqlitePasswordResetToken = createMysqlPasswordResetToken;
export const getSqlitePasswordResetToken = getMysqlPasswordResetToken;
export const consumeSqlitePasswordResetToken = consumeMysqlPasswordResetToken;
export const cleanupExpiredSqliteResetTokens = cleanupExpiredMysqlResetTokens;

export const saveSqlitePasswordReset = createMysqlPasswordResetToken;
export const getSqliteActivePasswordReset = getMysqlPasswordResetToken;
export const markSqlitePasswordResetUsed = consumeMysqlPasswordResetToken;
export const incrementSqlitePasswordResetAttempts = async () => {};

export const getSqliteReturnRequests = getMysqlReturnRequests;
export const saveSqliteReturnRequest = saveMysqlReturnRequest;
export const updateSqliteReturnRequestStatus = updateMysqlReturnRequestStatus;

export const getSqliteCartSession = getMysqlCartSession;
export const saveSqliteCartSession = saveMysqlCartSession;

export async function getSqliteWishlist(userId: string): Promise<string[]> {
  const pool = await getDbPool();
  const [rows]: any = await pool.query('SELECT product_ids FROM user_wishlists WHERE user_id = ? LIMIT 1', [userId]);
  if (!rows || rows.length === 0) return [];
  try {
    return JSON.parse(rows[0].product_ids || '[]');
  } catch {
    return [];
  }
}

export async function addToSqliteWishlist(userId: string, productId: string): Promise<string[]> {
  const current = await getSqliteWishlist(userId);
  if (!current.includes(productId)) {
    current.push(productId);
  }
  const pool = await getDbPool();
  await pool.query(
    `INSERT INTO user_wishlists (user_id, product_ids, updated_at)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE product_ids = VALUES(product_ids), updated_at = VALUES(updated_at);`,
    [userId, JSON.stringify(current), new Date().toISOString()]
  );
  return current;
}

export async function removeFromSqliteWishlist(userId: string, productId: string): Promise<string[]> {
  const current = await getSqliteWishlist(userId);
  const next = current.filter(id => id !== productId);
  const pool = await getDbPool();
  await pool.query(
    `INSERT INTO user_wishlists (user_id, product_ids, updated_at)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE product_ids = VALUES(product_ids), updated_at = VALUES(updated_at);`,
    [userId, JSON.stringify(next), new Date().toISOString()]
  );
  return next;
}

export async function getSqliteCart(userIdOrSession: string): Promise<any[]> {
  const session = await getMysqlCartSession(userIdOrSession);
  return session ? session.items : [];
}

export async function saveSqliteCart(userIdOrSession: string, items: any[]): Promise<void> {
  await saveMysqlCartSession(userIdOrSession, items);
}

export async function clearSqliteCart(userIdOrSession: string): Promise<void> {
  await saveMysqlCartSession(userIdOrSession, []);
}

export const purgeAllSqliteData = purgeAllMysqlData;
export const pullSyncDataSqlite = pullSyncData;
export const pushSyncDataSqlite = pushSyncData;
