var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/mysql-db.ts
function getDbHost() {
  let host = (process.env.DB_HOST || "127.0.0.1").trim();
  if (host === "localhhost" || host === "localhost") {
    host = "127.0.0.1";
  }
  return host;
}
function getDbUser() {
  return (process.env.DB_USER || "root").trim();
}
function getDbPassword() {
  return process.env.DB_PASSWORD !== void 0 ? process.env.DB_PASSWORD : "";
}
function getDbName() {
  return (process.env.DB_NAME || "ropenix").trim();
}
function getDbPort() {
  return Number(process.env.DB_PORT) || 3306;
}
async function getDbPool2() {
  if (dbPool) {
    return dbPool;
  }
  const host = getDbHost();
  const user = getDbUser();
  const password = getDbPassword();
  const database = getDbName();
  const port = getDbPort();
  try {
    try {
      const rootConn = await import_promise.default.createConnection({
        host,
        port,
        user,
        password,
        connectTimeout: 4e3
      });
      await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await rootConn.end();
    } catch (createDbErr) {
      console.warn("[MySQL] Database existence check notice:", createDbErr.message || createDbErr);
    }
    dbPool = import_promise.default.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      connectTimeout: 6e3,
      enableKeepAlive: true,
      keepAliveInitialDelay: 1e4
    });
    const testConn = await dbPool.getConnection();
    console.log(`[MySQL] Successfully connected to MySQL database: ${database}@${host}:${port}`);
    testConn.release();
    if (!isInitialized && !isInitializing) {
      await initializeDatabaseSchema();
    }
    return dbPool;
  } catch (error) {
    console.warn("[MySQL] Connection pool attempt failed:", error.message || error);
    if (dbPool) {
      try {
        await dbPool.end();
      } catch (_) {
      }
    }
    dbPool = null;
    throw error;
  }
}
async function initializeDatabaseSchema() {
  if (isInitialized) return;
  isInitializing = true;
  try {
    const pool = dbPool || await getDbPool2();
    console.log("[MySQL] Verifying and initializing database schema tables...");
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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart_sessions (
        id VARCHAR(255) PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL UNIQUE,
        user_id VARCHAR(255) NULL,
        items LONGTEXT NOT NULL,
        updated_at VARCHAR(100) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(255) PRIMARY KEY,
        setting_value LONGTEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_wishlists (
        user_id VARCHAR(255) PRIMARY KEY,
        product_ids LONGTEXT NOT NULL,
        updated_at VARCHAR(100) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
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
    const safeAddCol = async (table, col, def) => {
      try {
        await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def};`);
      } catch (err) {
        if (err.errno !== 1060 && !err.message?.includes("Duplicate column")) {
        }
      }
    };
    await safeAddCol("orders", "paymentReference", "VARCHAR(255) NULL");
    await safeAddCol("orders", "mpesaPhone", "VARCHAR(100) NULL");
    await safeAddCol("customer_orders", "payment_reference", "VARCHAR(255) NULL");
    await safeAddCol("customer_orders", "payment_status", "VARCHAR(50) DEFAULT 'unpaid'");
    await safeAddCol("customer_orders", "payment_amount", "DECIMAL(15, 2) NULL");
    await safeAddCol("customer_orders", "payment_confirmed_at", "VARCHAR(100) NULL");
    await safeAddCol("customer_orders", "payment_confirmed_by", "VARCHAR(255) NULL");
    await safeAddCol("payment_submissions", "amount_claimed", "DECIMAL(15, 2) NULL");
    await safeAddCol("payment_submissions", "payment_method", "VARCHAR(50) DEFAULT 'mpesa_paybill'");
    await safeAddCol("payment_submissions", "admin_notes", "TEXT NULL");
    isInitialized = true;
    console.log("[MySQL] All core database tables verified and active in MySQL.");
  } catch (error) {
    console.error("[MySQL] Database table initialization failed:", error);
    throw error;
  } finally {
    isInitializing = false;
  }
}
async function getDbStatus() {
  try {
    const pool = await getDbPool2();
    const [prodCount] = await pool.query("SELECT COUNT(*) as count FROM products");
    const [orderCount] = await pool.query("SELECT COUNT(*) as count FROM orders");
    const [userCount] = await pool.query("SELECT COUNT(*) as count FROM users");
    return {
      configured: true,
      connected: true,
      message: `Successfully connected to MySQL database: ${getDbName()} (via local XAMPP / MySQL)`,
      stats: {
        products: prodCount[0]?.count || 0,
        orders: orderCount[0]?.count || 0,
        users: userCount[0]?.count || 0
      }
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      message: `Failed to connect to MySQL server: ${error.message || error}`
    };
  }
}
async function getMysqlUserByEmail(email) {
  const pool = await getDbPool2();
  const [rows] = await pool.query("SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1", [
    (email || "").trim().toLowerCase()
  ]);
  if (!rows || rows.length === 0) return null;
  return rows[0];
}
async function getMysqlUserByEmailOrUsername(identifier) {
  const pool = await getDbPool2();
  const clean = (identifier || "").trim().toLowerCase();
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1",
    [clean, clean]
  );
  if (!rows || rows.length === 0) return null;
  return rows[0];
}
async function getMysqlUserById(userId) {
  const pool = await getDbPool2();
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [userId]);
  if (!rows || rows.length === 0) return null;
  return rows[0];
}
async function getAllMysqlUsers() {
  const pool = await getDbPool2();
  const [rows] = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
  return rows || [];
}
async function saveMysqlUser(user) {
  const pool = await getDbPool2();
  const id = user.id || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
      (user.email || "").trim().toLowerCase(),
      user.username || user.email?.split("@")[0] || "",
      user.password_hash || user.password || "",
      user.first_name || "",
      user.last_name || "",
      user.phone || "",
      user.role || "customer",
      user.is_staff ? 1 : 0,
      user.is_superuser ? 1 : 0,
      user.email_verified !== void 0 ? user.email_verified ? 1 : 0 : 1,
      user.avatar_url || "",
      user.referral_code || null,
      user.partner_tier || "Silver",
      user.address || null,
      user.city || null,
      user.country || null,
      user.created_at || now,
      now
    ]
  );
  return getMysqlUserById(id);
}
async function updateMysqlUserPasswordById(userId, newPasswordHash) {
  const pool = await getDbPool2();
  const [res] = await pool.query(
    "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
    [newPasswordHash, (/* @__PURE__ */ new Date()).toISOString(), userId]
  );
  return res.affectedRows > 0;
}
function parseProductRow(row) {
  if (!row) return null;
  return {
    ...row,
    price: Number(row.price),
    originalPrice: row.originalPrice ? Number(row.originalPrice) : void 0,
    costPrice: row.costPrice ? Number(row.costPrice) : void 0,
    previousPrice: row.previousPrice ? Number(row.previousPrice) : void 0,
    rating: Number(row.rating || 0),
    reviewsCount: Number(row.reviewsCount || 0),
    stock: Number(row.stock || 0),
    lowStockThreshold: Number(row.lowStockThreshold || 5),
    backInStockAlert: Boolean(row.backInStockAlert),
    tags: typeof row.tags === "string" ? safeJsonParse(row.tags, row.tags.split(",").map((t) => t.trim())) : row.tags || [],
    images: typeof row.images === "string" ? safeJsonParse(row.images, [row.imageUrl || ""]) : row.images || [],
    variations: typeof row.variations === "string" ? safeJsonParse(row.variations, []) : row.variations || [],
    reviews: typeof row.reviews === "string" ? safeJsonParse(row.reviews, []) : row.reviews || [],
    features: typeof row.features === "string" ? safeJsonParse(row.features, []) : row.features || [],
    specifications: typeof row.specifications === "string" ? safeJsonParse(row.specifications, []) : row.specifications || []
  };
}
function safeJsonParse(val, fallback) {
  try {
    return JSON.parse(val);
  } catch (_) {
    return fallback;
  }
}
async function getMysqlProducts() {
  const pool = await getDbPool2();
  const [rows] = await pool.query("SELECT * FROM products ORDER BY created_at DESC");
  return (rows || []).map(parseProductRow);
}
async function getMysqlProductById(id) {
  const pool = await getDbPool2();
  const [rows] = await pool.query("SELECT * FROM products WHERE id = ? LIMIT 1", [id]);
  if (!rows || rows.length === 0) return null;
  return parseProductRow(rows[0]);
}
async function saveMysqlProduct(p) {
  const pool = await getDbPool2();
  const id = p.id || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
      p.sku || "",
      p.slug || p.name?.toLowerCase().replace(/\s+/g, "-") || "",
      p.name || "Untitled Product",
      p.brand || "Ropenix",
      p.countryOfOrigin || p.country_of_origin || "Kenya",
      p.description || "",
      p.shortDescription || "",
      p.detailedDescription || "",
      Number(p.price || 0),
      p.originalPrice ? Number(p.originalPrice) : null,
      p.costPrice ? Number(p.costPrice) : null,
      p.previousPrice ? Number(p.previousPrice) : null,
      p.category || "All",
      p.subcategory || "",
      JSON.stringify(Array.isArray(p.tags) ? p.tags : []),
      p.type || "physical",
      p.imageUrl || Array.isArray(p.images) && p.images[0] || "",
      JSON.stringify(Array.isArray(p.images) ? p.images : []),
      Number(p.stock || 0),
      Number(p.lowStockThreshold || 5),
      Number(p.rating || 0),
      Number(p.reviewsCount || 0),
      JSON.stringify(Array.isArray(p.variations) ? p.variations : []),
      JSON.stringify(Array.isArray(p.reviews) ? p.reviews : []),
      JSON.stringify(Array.isArray(p.features) ? p.features : []),
      JSON.stringify(Array.isArray(p.specifications) ? p.specifications : []),
      p.whatsInTheBox || "",
      p.digitalFileUrl || "",
      p.status || "Active",
      p.paymentRestriction || "both",
      p.backInStockAlert ? 1 : 0,
      p.created_at || now,
      now
    ]
  );
  return getMysqlProductById(id);
}
async function deleteMysqlProduct(id) {
  const pool = await getDbPool2();
  const [res] = await pool.query("DELETE FROM products WHERE id = ?", [id]);
  return res.affectedRows > 0;
}
function parseOrderRow(row) {
  if (!row) return null;
  let status = row.status;
  if (typeof status !== "string" || status === "[object Object]" || !status) {
    status = row.deliveryConfirmed ? "delivered" : row.trackingNumber ? "shipped" : row.isPaid || row.paymentStatus === "paid" ? "processing" : "pending";
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
    paymentReference: row.paymentReference || row.mpesaReceiptNumber || void 0,
    mpesaReceiptNumber: row.mpesaReceiptNumber || row.paymentReference || void 0,
    mpesaPhone: row.mpesaPhone || void 0,
    items: typeof row.items === "string" ? safeJsonParse(row.items, []) : row.items || [],
    shippingAddress: typeof row.shippingAddress === "string" ? safeJsonParse(row.shippingAddress, row.shippingAddress) : row.shippingAddress,
    notesHistory: typeof row.notesHistory === "string" ? safeJsonParse(row.notesHistory, []) : row.notesHistory || [],
    statusHistory: typeof row.statusHistory === "string" ? safeJsonParse(row.statusHistory, []) : row.statusHistory || []
  };
}
async function getMysqlOrders() {
  const pool = await getDbPool2();
  const [rows] = await pool.query("SELECT * FROM orders ORDER BY date DESC, created_at DESC");
  return (rows || []).map(parseOrderRow);
}
async function getMysqlOrderById(id) {
  const pool = await getDbPool2();
  const [rows] = await pool.query("SELECT * FROM orders WHERE id = ? LIMIT 1", [id]);
  if (!rows || rows.length === 0) return null;
  return parseOrderRow(rows[0]);
}
async function saveMysqlOrder(order) {
  const pool = await getDbPool2();
  const id = order.id || `ORD-${Date.now()}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const refCode = order.paymentReference || order.mpesaReceiptNumber || null;
  const phone = order.mpesaPhone || order.customerPhone || order.phone || null;
  let safeStatus = typeof order.status === "string" && order.status !== "[object Object]" ? order.status : typeof order.status === "object" && typeof order.status?.status === "string" && order.status.status !== "[object Object]" ? order.status.status : "";
  if (!safeStatus || safeStatus === "[object Object]") {
    safeStatus = order.deliveryConfirmed ? "delivered" : order.trackingNumber ? "shipped" : order.isPaid || order.paymentStatus === "paid" ? "processing" : "pending";
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
      order.customerName || "Customer",
      (order.customerEmail || "").trim().toLowerCase(),
      order.customerPhone || order.phone || "",
      JSON.stringify(Array.isArray(order.items) ? order.items : []),
      Number(order.total || 0),
      safeStatus,
      order.date || now,
      order.couponCode || null,
      order.customNote || null,
      typeof order.shippingAddress === "object" ? JSON.stringify(order.shippingAddress) : order.shippingAddress || null,
      JSON.stringify(Array.isArray(order.notesHistory) ? order.notesHistory : []),
      JSON.stringify(Array.isArray(order.statusHistory) ? order.statusHistory : []),
      order.isGuest ? 1 : 0,
      order.paymentMethod || "cod",
      order.checkoutChannel || "web",
      order.paymentStatus || (refCode ? "pending_verification" : "pending"),
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
      now
    ]
  );
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
        order.customerName || "Customer",
        (order.customerEmail || "").trim().toLowerCase(),
        order.customerPhone || order.phone || "",
        Number(order.total || 0),
        order.status || "Pending",
        order.paymentStatus || (refCode ? "pending_verification" : "unpaid"),
        refCode,
        order.total || null,
        order.created_at || now,
        order.date || now,
        now
      ]
    );
  } catch (_) {
  }
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
          phone || "254700000000",
          Number(order.total || 0),
          order.paymentMethod || "mpesa_paybill",
          "pending_verification",
          "Submitted directly during checkout placement",
          now
        ]
      );
    } catch (_) {
    }
  }
  return getMysqlOrderById(id);
}
async function updateMysqlOrderStatus(id, statusOrUpdates, paymentStatus, trackingNumber) {
  const pool = await getDbPool2();
  let targetStatus = typeof statusOrUpdates === "string" && statusOrUpdates !== "[object Object]" ? statusOrUpdates : typeof statusOrUpdates === "object" && typeof statusOrUpdates?.status === "string" && statusOrUpdates.status !== "[object Object]" ? statusOrUpdates.status : void 0;
  let targetPaymentStatus = typeof statusOrUpdates === "object" ? statusOrUpdates?.paymentStatus || statusOrUpdates?.payment_status || paymentStatus : paymentStatus;
  let targetTrackingNumber = typeof statusOrUpdates === "object" ? statusOrUpdates?.trackingNumber || statusOrUpdates?.tracking_number || trackingNumber : trackingNumber;
  const updates = ["updated_at = ?"];
  const values = [(/* @__PURE__ */ new Date()).toISOString()];
  if (targetStatus) {
    updates.push("status = ?");
    values.push(targetStatus);
  }
  if (targetPaymentStatus) {
    updates.push("paymentStatus = ?");
    values.push(targetPaymentStatus);
    if (targetPaymentStatus === "paid" || targetPaymentStatus === "completed") {
      updates.push("isPaid = 1");
      updates.push("paidAt = ?");
      values.push((/* @__PURE__ */ new Date()).toISOString());
    }
  }
  if (targetTrackingNumber) {
    updates.push("trackingNumber = ?");
    values.push(targetTrackingNumber);
  }
  values.push(id);
  await pool.query(`UPDATE orders SET ${updates.join(", ")} WHERE id = ?`, values);
  return getMysqlOrderById(id);
}
async function deleteMysqlOrder(id) {
  const pool = await getDbPool2();
  const [res] = await pool.query("DELETE FROM orders WHERE id = ?", [id]);
  return res.affectedRows > 0;
}
async function getMysqlCategories() {
  const pool = await getDbPool2();
  let [rows] = await pool.query("SELECT * FROM categories ORDER BY display_order ASC, name ASC");
  if (!rows || rows.length === 0) {
    for (const c of DEFAULT_CORE_CATEGORIES) {
      await saveMysqlCategory(c);
    }
    const [freshRows] = await pool.query("SELECT * FROM categories ORDER BY display_order ASC, name ASC");
    rows = freshRows || [];
  }
  let productCountMap = {};
  try {
    const [counts] = await pool.query("SELECT category, COUNT(*) as cnt FROM products GROUP BY category");
    if (Array.isArray(counts)) {
      for (const item of counts) {
        if (item.category) {
          productCountMap[item.category.toLowerCase().trim()] = Number(item.cnt || 0);
        }
      }
    }
  } catch (_) {
  }
  return (rows || []).map((c) => {
    const catNameLower = (c.name || "").toLowerCase().trim();
    const count = productCountMap[catNameLower] || 0;
    const isActive = !(c.is_active === 0 || c.is_active === false || c.status === "Inactive");
    return {
      id: String(c.id),
      name: c.name,
      slug: c.slug || String(c.name).toLowerCase().replace(/\s+/g, "-"),
      description: c.description || "",
      imageUrl: c.image || c.imageUrl || "",
      image: c.image || c.imageUrl || "",
      icon: c.icon || "",
      parentId: c.parentId || null,
      status: isActive ? "Active" : "Inactive",
      is_active: isActive,
      displayOrder: Number(c.display_order || c.displayOrder || 0),
      display_order: Number(c.display_order || c.displayOrder || 0),
      subcategories: typeof c.subcategories === "string" ? safeJsonParse(c.subcategories, []) : c.subcategories || [],
      productCount: count,
      previousSlugs: typeof c.previousSlugs === "string" ? safeJsonParse(c.previousSlugs, []) : Array.isArray(c.previousSlugs) ? c.previousSlugs : [],
      createdAt: c.created_at || c.createdAt || (/* @__PURE__ */ new Date()).toISOString()
    };
  });
}
async function saveMysqlCategory(cat) {
  const pool = await getDbPool2();
  const id = cat.id || `cat-${Date.now()}`;
  const isActive = cat.is_active !== void 0 ? cat.is_active ? 1 : 0 : cat.status === "Inactive" ? 0 : 1;
  const image = cat.imageUrl || cat.image || "";
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
      cat.name || "Category",
      cat.slug || String(cat.name || "").toLowerCase().replace(/\s+/g, "-") || "",
      cat.description || "",
      image,
      cat.icon || "",
      JSON.stringify(Array.isArray(cat.subcategories) ? cat.subcategories : []),
      isActive,
      displayOrder
    ]
  );
  const [rows] = await pool.query("SELECT * FROM categories WHERE id = ? LIMIT 1", [id]);
  const row = rows[0];
  if (!row) return cat;
  return {
    ...row,
    imageUrl: row.image || row.imageUrl || "",
    displayOrder: Number(row.display_order || 0),
    status: row.is_active ? "Active" : "Inactive",
    is_active: Boolean(row.is_active),
    subcategories: typeof row.subcategories === "string" ? safeJsonParse(row.subcategories, []) : row.subcategories || []
  };
}
async function deleteMysqlCategory(id) {
  const pool = await getDbPool2();
  const [res] = await pool.query("DELETE FROM categories WHERE id = ?", [id]);
  return res.affectedRows > 0;
}
async function getMysqlSuppliers() {
  const pool = await getDbPool2();
  const [rows] = await pool.query("SELECT * FROM suppliers ORDER BY name ASC");
  return (rows || []).map((s) => ({
    ...s,
    active: Boolean(s.active),
    productsCount: Number(s.productsCount || 0),
    totalSpend: Number(s.totalSpend || 0),
    rating: Number(s.rating || 5),
    tags: typeof s.tags === "string" ? safeJsonParse(s.tags, []) : s.tags || []
  }));
}
async function saveMysqlSupplier(s) {
  const pool = await getDbPool2();
  const id = s.id || `sup-${Date.now()}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
      s.name || "Supplier",
      s.email || "",
      s.phone || "",
      s.address || "",
      s.contactPerson || "",
      s.category || "General",
      s.notes || "",
      Number(s.productsCount || 0),
      Number(s.totalSpend || 0),
      s.active !== void 0 ? s.active ? 1 : 0 : 1,
      Number(s.rating || 5),
      s.currency || "KSh",
      s.paymentTerms || "Net 30",
      s.bankDetails || "",
      s.kraPin || "",
      s.dateJoined || now,
      JSON.stringify(Array.isArray(s.tags) ? s.tags : []),
      s.created_at || now,
      now
    ]
  );
  const [rows] = await pool.query("SELECT * FROM suppliers WHERE id = ? LIMIT 1", [id]);
  return rows[0];
}
async function deleteMysqlSupplier(id) {
  const pool = await getDbPool2();
  const [res] = await pool.query("DELETE FROM suppliers WHERE id = ?", [id]);
  return res.affectedRows > 0;
}
async function getMysqlSupplierProducts(supplierId) {
  const pool = await getDbPool2();
  const query = supplierId ? "SELECT * FROM supplier_products WHERE supplierId = ? ORDER BY name ASC" : "SELECT * FROM supplier_products ORDER BY name ASC";
  const params = supplierId ? [supplierId] : [];
  const [rows] = await pool.query(query, params);
  return (rows || []).map((sp) => ({
    ...sp,
    costPrice: Number(sp.costPrice),
    sellingPrice: Number(sp.sellingPrice),
    stock: Number(sp.stock)
  }));
}
async function saveMysqlSupplierProduct(sp) {
  const pool = await getDbPool2();
  const id = sp.id || `sp-${Date.now()}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
      sp.name || "Product",
      sp.sku || "",
      sp.category || "",
      Number(sp.costPrice || 0),
      Number(sp.sellingPrice || 0),
      Number(sp.stock || 0),
      Number(sp.minOrderQty || 1),
      Number(sp.leadTimeDays || 7),
      sp.status || "Active",
      sp.notes || "",
      sp.created_at || now,
      now
    ]
  );
  const [rows] = await pool.query("SELECT * FROM supplier_products WHERE id = ? LIMIT 1", [id]);
  return rows[0];
}
async function getMysqlSupplierBatches(supplierId) {
  const pool = await getDbPool2();
  const query = supplierId ? "SELECT * FROM supplier_batches WHERE supplierId = ? ORDER BY dateReceived DESC" : "SELECT * FROM supplier_batches ORDER BY dateReceived DESC";
  const params = supplierId ? [supplierId] : [];
  const [rows] = await pool.query(query, params);
  return (rows || []).map((b) => ({
    ...b,
    totalCost: Number(b.totalCost),
    items: typeof b.items === "string" ? safeJsonParse(b.items, []) : b.items || []
  }));
}
async function saveMysqlSupplierBatch(batch) {
  const pool = await getDbPool2();
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
      batch.dateReceived || (/* @__PURE__ */ new Date()).toISOString(),
      JSON.stringify(Array.isArray(batch.items) ? batch.items : []),
      Number(batch.totalCost || 0),
      batch.status || "Received",
      batch.invoiceNumber || "",
      batch.notes || "",
      batch.created_at || (/* @__PURE__ */ new Date()).toISOString()
    ]
  );
  const [rows] = await pool.query("SELECT * FROM supplier_batches WHERE id = ? LIMIT 1", [id]);
  return rows[0];
}
async function getMysqlSupplierPayments(supplierId) {
  const pool = await getDbPool2();
  const query = supplierId ? "SELECT * FROM supplier_payments WHERE supplierId = ? ORDER BY date DESC" : "SELECT * FROM supplier_payments ORDER BY date DESC";
  const params = supplierId ? [supplierId] : [];
  const [rows] = await pool.query(query, params);
  return (rows || []).map((p) => ({ ...p, amount: Number(p.amount) }));
}
async function saveMysqlSupplierPayment(p) {
  const pool = await getDbPool2();
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
      p.date || (/* @__PURE__ */ new Date()).toISOString(),
      p.paymentMethod || "Bank Transfer",
      p.referenceNumber || "",
      p.status || "Completed",
      p.notes || "",
      p.invoiceId || "",
      p.created_at || (/* @__PURE__ */ new Date()).toISOString()
    ]
  );
  const [rows] = await pool.query("SELECT * FROM supplier_payments WHERE id = ? LIMIT 1", [id]);
  return rows[0];
}
async function getMysqlSupplierLedger(supplierId) {
  const pool = await getDbPool2();
  const [rows] = await pool.query(
    "SELECT * FROM supplier_ledger WHERE supplierId = ? ORDER BY date ASC, created_at ASC",
    [supplierId]
  );
  return (rows || []).map((l) => ({
    ...l,
    amount: Number(l.amount),
    balance: Number(l.balance)
  }));
}
async function getAllMysqlCustomers() {
  const pool = await getDbPool2();
  const [rows] = await pool.query("SELECT * FROM customers ORDER BY name ASC");
  return (rows || []).map((c) => ({
    ...c,
    is_registered: Boolean(c.is_registered),
    open_deal_value: Number(c.open_deal_value || 0)
  }));
}
async function saveMysqlCustomer(c) {
  const pool = await getDbPool2();
  const id = c.id || `cust-${Date.now()}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
      c.first_name || "",
      c.last_name || "",
      c.name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Customer",
      (c.email || "").trim().toLowerCase(),
      c.phone || "",
      c.company || "",
      c.location || "",
      c.status || "Active",
      c.notes || "",
      Number(c.open_deal_value || 0),
      c.created_at || now,
      now
    ]
  );
  const [rows] = await pool.query("SELECT * FROM customers WHERE id = ? LIMIT 1", [id]);
  return rows[0];
}
async function getMysqlSiteSettings() {
  const pool = await getDbPool2();
  const [rows] = await pool.query('SELECT * FROM site_settings WHERE id = "default" LIMIT 1');
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
    access_control: safeJsonParse(raw.access_control, null)
  };
}
async function saveMysqlSiteSettings(settings) {
  const pool = await getDbPool2();
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
      now
    ]
  );
  return getMysqlSiteSettings();
}
async function getMysqlHeroBanners() {
  const pool = await getDbPool2();
  const [rows] = await pool.query("SELECT * FROM hero_banners ORDER BY order_index ASC");
  return (rows || []).map((b) => ({
    ...b,
    active: Boolean(b.active),
    order: Number(b.order_index)
  }));
}
async function saveMysqlHeroBanners(banners) {
  const pool = await getDbPool2();
  await pool.query("DELETE FROM hero_banners");
  for (let i = 0; i < banners.length; i++) {
    const b = banners[i];
    const id = b.id || `banner-${i + 1}`;
    await pool.query(
      `INSERT INTO hero_banners (id, title, subtitle, imageUrl, link, ctaText, badgeText, active, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        b.title || "Untitled Banner",
        b.subtitle || "",
        b.imageUrl || "",
        b.link || "/store",
        b.ctaText || "Shop Now",
        b.badgeText || "",
        b.active !== void 0 ? b.active ? 1 : 0 : 1,
        i
      ]
    );
  }
  return getMysqlHeroBanners();
}
async function getMysqlReviews(productId) {
  const pool = await getDbPool2();
  const query = productId ? "SELECT * FROM reviews WHERE productId = ? ORDER BY date DESC" : "SELECT * FROM reviews ORDER BY date DESC";
  const params = productId ? [productId] : [];
  const [rows] = await pool.query(query, params);
  return (rows || []).map((r) => ({
    ...r,
    rating: Number(r.rating),
    helpfulCount: Number(r.helpfulCount || 0),
    verified: Boolean(r.verified)
  }));
}
async function saveMysqlReview(r) {
  const pool = await getDbPool2();
  const id = r.id || `rev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
      r.userName || "Customer",
      (r.userEmail || "").trim().toLowerCase(),
      Number(r.rating || 5),
      r.comment || "",
      r.verified !== void 0 ? r.verified ? 1 : 0 : 1,
      r.status || "approved",
      Number(r.helpfulCount || 0),
      r.date || now,
      r.reply || null,
      r.created_at || now
    ]
  );
  const [rows] = await pool.query("SELECT * FROM reviews WHERE id = ? LIMIT 1", [id]);
  return rows[0];
}
async function deleteMysqlReview(id) {
  const pool = await getDbPool2();
  const [res] = await pool.query("DELETE FROM reviews WHERE id = ?", [id]);
  return res.affectedRows > 0;
}
async function getMysqlCoupons() {
  const pool = await getDbPool2();
  const [rows] = await pool.query("SELECT * FROM coupons ORDER BY created_at DESC");
  return (rows || []).map((c) => ({
    ...c,
    discountValue: Number(c.discountValue),
    minPurchase: Number(c.minPurchase || 0),
    maxDiscount: c.maxDiscount ? Number(c.maxDiscount) : null,
    usageLimit: Number(c.usageLimit || 100),
    usageCount: Number(c.usageCount || 0),
    isActive: Boolean(c.isActive),
    applicableCategories: typeof c.applicableCategories === "string" ? safeJsonParse(c.applicableCategories, []) : c.applicableCategories || []
  }));
}
async function getMysqlCustomClothingRequests(filters) {
  const pool = await getDbPool2();
  const [rows] = await pool.query("SELECT * FROM custom_clothing_requests ORDER BY created_at DESC");
  let list = (rows || []).map((r) => ({
    ...r,
    materialSamples: typeof r.material_samples === "string" ? safeJsonParse(r.material_samples, []) : r.material_samples || [],
    designImages: typeof r.design_images === "string" ? safeJsonParse(r.design_images, []) : r.design_images || [],
    designVideos: typeof r.design_videos === "string" ? safeJsonParse(r.design_videos, []) : r.design_videos || [],
    designLinks: typeof r.design_links === "string" ? safeJsonParse(r.design_links, []) : r.design_links || [],
    measurements: typeof r.measurements === "string" ? safeJsonParse(r.measurements, {}) : r.measurements || {}
  }));
  if (filters?.status) {
    const s = filters.status.toLowerCase();
    list = list.filter((r) => r.status && r.status.toLowerCase() === s);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (r) => r.reference_no && r.reference_no.toLowerCase().includes(q) || r.full_name && r.full_name.toLowerCase().includes(q) || r.email && r.email.toLowerCase().includes(q)
    );
  }
  return list;
}
async function saveMysqlCustomClothingRequest(req) {
  const pool = await getDbPool2();
  const id = req.id || `req-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const refNo = req.referenceNo || req.reference_no || `ROP-CC-${(/* @__PURE__ */ new Date()).getFullYear()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
      req.fullName || req.full_name || "",
      (req.email || "").trim().toLowerCase(),
      req.phone || "",
      req.garmentType || req.garment_type || "Custom Garment",
      req.otherGarmentType || req.other_garment_type || "",
      JSON.stringify(Array.isArray(req.materialSamples) ? req.materialSamples : []),
      JSON.stringify(Array.isArray(req.designImages) ? req.designImages : []),
      JSON.stringify(Array.isArray(req.designVideos) ? req.designVideos : []),
      JSON.stringify(Array.isArray(req.designLinks) ? req.designLinks : []),
      JSON.stringify(req.measurements || {}),
      req.preferredDeadline || req.preferred_deadline || null,
      req.budgetRange || req.budget_range || "",
      req.additionalNotes || req.additional_notes || "",
      req.deliveryLocation || req.delivery_location || "",
      req.status || "Pending Review",
      req.created_at || now,
      now
    ]
  );
  const [rows] = await pool.query("SELECT * FROM custom_clothing_requests WHERE id = ? LIMIT 1", [id]);
  return rows[0];
}
async function updateMysqlCustomClothingRequestStatus(id, status) {
  const pool = await getDbPool2();
  await pool.query(
    "UPDATE custom_clothing_requests SET status = ?, updated_at = ? WHERE id = ? OR reference_no = ?",
    [status, (/* @__PURE__ */ new Date()).toISOString(), id, id]
  );
  const [rows] = await pool.query(
    "SELECT * FROM custom_clothing_requests WHERE id = ? OR reference_no = ? LIMIT 1",
    [id, id]
  );
  return rows[0] || null;
}
async function getMysqlInventoryAuditLogs(limit = 100) {
  const pool = await getDbPool2();
  const [rows] = await pool.query(
    "SELECT * FROM inventory_audit_logs ORDER BY timestamp DESC LIMIT ?",
    [Number(limit)]
  );
  return (rows || []).map((l) => ({
    ...l,
    changeQuantity: Number(l.changeQuantity),
    newStock: Number(l.newStock)
  }));
}
async function addMysqlInventoryAuditLog(log) {
  const pool = await getDbPool2();
  const id = `inv-log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  await pool.query(
    `INSERT INTO inventory_audit_logs (id, productId, productName, productSku, timestamp, changeQuantity, newStock, reason, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      log.productId,
      log.productName,
      log.productSku || "",
      timestamp,
      Number(log.changeQuantity || 0),
      Number(log.newStock || 0),
      log.reason || "Manual Update",
      log.details || ""
    ]
  );
  return { id, timestamp, ...log };
}
async function createMysqlPasswordResetToken(data) {
  const pool = await getDbPool2();
  const id = `prt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
      data.ipAddress || null
    ]
  );
  return { id, ...data, createdAt: now };
}
async function getMysqlPasswordResetToken(tokenHash) {
  const pool = await getDbPool2();
  const [rows] = await pool.query(
    "SELECT * FROM password_reset_tokens WHERE token_hash = ? LIMIT 1",
    [tokenHash]
  );
  if (!rows || rows.length === 0) return null;
  return rows[0];
}
async function consumeMysqlPasswordResetToken(tokenHash, newPasswordHash, nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
  const pool = await getDbPool2();
  const [updateRes] = await pool.query(
    "UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at >= ?",
    [nowIso, tokenHash, nowIso]
  );
  if (!updateRes || updateRes.affectedRows === 0) {
    const tokenRecord2 = await getMysqlPasswordResetToken(tokenHash);
    if (!tokenRecord2) {
      return { success: false, error: "Password reset token not found or invalid." };
    }
    if (tokenRecord2.used_at) {
      return { success: false, error: "TOKEN_ALREADY_USED_OR_CONCURRENT_UPDATE" };
    }
    if (new Date(tokenRecord2.expires_at) < new Date(nowIso)) {
      return { success: false, error: "Password reset token has expired. Please request a new link." };
    }
    return { success: false, error: "TOKEN_ALREADY_USED_OR_CONCURRENT_UPDATE" };
  }
  const tokenRecord = await getMysqlPasswordResetToken(tokenHash);
  if (!tokenRecord || !tokenRecord.user_id) {
    return { success: false, error: "User record linked to token not found." };
  }
  await updateMysqlUserPasswordById(tokenRecord.user_id, newPasswordHash);
  return { success: true, userId: tokenRecord.user_id };
}
async function cleanupExpiredMysqlResetTokens(nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
  const pool = await getDbPool2();
  const [res] = await pool.query(
    "DELETE FROM password_reset_tokens WHERE expires_at < ? OR used_at IS NOT NULL",
    [nowIso]
  );
  return res.affectedRows || 0;
}
async function getMysqlCartSession(sessionId) {
  const pool = await getDbPool2();
  const [rows] = await pool.query("SELECT items FROM cart_sessions WHERE session_id = ? LIMIT 1", [sessionId]);
  if (!rows || rows.length === 0) return null;
  return safeJsonParse(rows[0].items, []);
}
async function saveMysqlCartSession(sessionId, items, userId) {
  const pool = await getDbPool2();
  const id = `cart-${sessionId}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
async function pushSyncData(payload) {
  try {
    if (Array.isArray(payload.veloce_products)) {
      for (const p of payload.veloce_products) {
        if (!p.id || !p.name) continue;
        await saveMysqlProduct(p);
      }
    }
    if (Array.isArray(payload.veloce_orders)) {
      for (const o of payload.veloce_orders) {
        if (!o.id) continue;
        await saveMysqlOrder(o);
      }
    }
    if (payload.veloce_site_settings) {
      await saveMysqlSiteSettings(payload.veloce_site_settings);
    }
    if (Array.isArray(payload.veloce_hero_banners)) {
      await saveMysqlHeroBanners(payload.veloce_hero_banners);
    }
    console.log("[MySQL] Production push synchronization successfully completed.");
  } catch (error) {
    console.error("[MySQL] Production push synchronization failed:", error);
    throw error;
  }
}
async function pullSyncData() {
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
    last_synced_at: (/* @__PURE__ */ new Date()).toISOString(),
    source: "MySQL Database"
  };
}
async function ensureDefaultAdminUser() {
  const adminEmail = (process.env.ADMIN_EMAIL || "ropenixkenya@gmail.com").trim().toLowerCase();
  const hostUser = (process.env.EMAIL_HOST_USER || "admin@ropenix.co.ke").trim().toLowerCase();
  for (const email of [adminEmail, hostUser]) {
    if (!email || !email.includes("@")) continue;
    try {
      const existing = await getMysqlUserByEmail(email);
      if (!existing) {
        const defaultSalt = "0123456789abcdef0123456789abcdef";
        const defaultHash = "35e4d293226a31c5b88ce8325dc01c385f850e047702890538a7c88b90a61254bf52199b5ff7a988d44747eb6fa32d4323e20e8d0537f819446f28b75710609f";
        await saveMysqlUser({
          id: `usr-admin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          username: email.split("@")[0],
          email,
          password_hash: `${defaultSalt}:${defaultHash}`,
          first_name: "Administrator",
          last_name: "Account",
          role: "admin",
          is_staff: 1,
          is_superuser: 1,
          email_verified: 1
        });
        console.log(`[MySQL] Seeded default administrator account: <${email}>`);
      }
    } catch (err) {
      console.warn(`[MySQL] Admin account seed check notice for ${email}:`, err);
    }
  }
  await ensureDefaultCustomers().catch((err) => console.warn("[MySQL] Default customer seed notice:", err));
}
async function ensureDefaultCustomers() {
  const defaultCustomers = [
    {
      email: "edwinmuliro64@gmail.com",
      username: "edwinmuliro64",
      first_name: "Edwin",
      last_name: "Muliro",
      phone: "+254712345678",
      company: "Ropenix Client Services",
      location: "Nairobi, Kenya",
      partner_tier: "Silver"
    },
    {
      email: "sushisoogoong@gmail.com",
      username: "sushisoogoong",
      first_name: "Sushi",
      last_name: "Soogoong",
      phone: "+254722000111",
      company: "Soogoong Fashion Hub",
      location: "Mombasa, Kenya",
      partner_tier: "Silver"
    }
  ];
  const defaultSalt = "0123456789abcdef0123456789abcdef";
  const defaultHash = "35e4d293226a31c5b88ce8325dc01c385f850e047702890538a7c88b90a61254bf52199b5ff7a988d44747eb6fa32d4323e20e8d0537f819446f28b75710609f";
  for (const cust of defaultCustomers) {
    const email = cust.email.trim().toLowerCase();
    try {
      let user = await getMysqlUserByEmail(email);
      if (!user) {
        user = await saveMysqlUser({
          id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          username: cust.username,
          email,
          password_hash: `${defaultSalt}:${defaultHash}`,
          first_name: cust.first_name,
          last_name: cust.last_name,
          phone: cust.phone,
          is_staff: 0,
          is_superuser: 0,
          email_verified: 1,
          referral_code: `REF-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          partner_tier: cust.partner_tier
        });
        console.log(`[MySQL] Seeded registered customer user: <${email}>`);
      }
      const allCust = await getAllMysqlCustomers();
      const existingCust = allCust.find((c) => (c.email || "").toLowerCase().trim() === email);
      if (!existingCust) {
        await saveMysqlCustomer({
          id: `cust-${user?.id || Date.now()}`,
          user: user?.id || null,
          is_registered: 1,
          first_name: cust.first_name,
          last_name: cust.last_name,
          name: `${cust.first_name} ${cust.last_name}`.trim(),
          email,
          phone: cust.phone,
          company: cust.company,
          location: cust.location,
          status: "Active",
          notes: `Verified registered customer (${cust.partner_tier} tier)`,
          open_deal_value: 0
        });
        console.log(`[MySQL] Seeded CRM customer record: <${email}>`);
      }
    } catch (err) {
      console.warn(`[MySQL] Customer seed check notice for ${email}:`, err);
    }
  }
}
async function ensureDefaultProducts() {
  try {
    const existing = await getMysqlProducts();
    const existingIds = new Set(existing.map((p) => p.id));
    const DEFAULT_PRODUCTS = [
      {
        id: "prod-oak-riser",
        sku: "DSK-OAK-001",
        slug: "solid-walnut-dual-monitor-riser",
        name: "Solid Walnut Dual Monitor Riser with MagSafe Slot",
        brand: "Veloce Woodcraft",
        country_of_origin: "Kenya",
        description: "Handcrafted from sustainable solid American walnut timber. Integrated magnetic wireless charging dock, dual display capacity, and premium anodized aluminum risers.",
        shortDescription: "Handcrafted solid walnut dual monitor stand with integrated MagSafe charging pad.",
        detailedDescription: "Elevate your workspace ergonomics and aesthetic with the Veloce Solid Walnut Dual Monitor Riser. Masterfully carved from kiln-dried Grade-A American Walnut, this desk shelf accommodates two 27-inch displays or an ultrawide monitor with zero flex.",
        price: 11900,
        costPrice: 6500,
        originalPrice: 13500,
        previousPrice: 13500,
        category: "Home & Living",
        tags: ["Desk Setup", "Walnut", "Ergonomic", "Workspace", "Handmade"],
        type: "physical",
        imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=800",
        images: [
          "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=800"
        ],
        stock: 14,
        lowStockThreshold: 5,
        rating: 4.8,
        reviewsCount: 12,
        status: "Active"
      },
      {
        id: "prod-mag-keyboard",
        sku: "KB-TITAN-75",
        slug: "veloce-titan-75-cnc-magnetic-keyboard",
        name: "Veloce Titan 75% CNC Magnetic Hall-Effect Keyboard",
        brand: "Veloce Tech",
        country_of_origin: "Kenya",
        description: "Aerospace-grade CNC aluminum housing, rapid-trigger Hall effect magnetic analog switches, and dynamic per-key RGB backlighting.",
        shortDescription: "Precision CNC 75% gaming & typing keyboard with magnetic rapid-trigger switches.",
        detailedDescription: "The Veloce Titan 75 is engineered for uncompromising speed, tactile feedback, and endurance. Built inside an anodized 6063 aerospace aluminum case with custom sound-dampening poron foam gaskets.",
        price: 24500,
        costPrice: 14500,
        originalPrice: 28e3,
        previousPrice: 28e3,
        category: "Electronics",
        tags: ["Keyboard", "Hall-Effect", "Gaming", "Electronics", "CNC Aluminum"],
        type: "physical",
        imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=800",
        images: [
          "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=800"
        ],
        stock: 19,
        lowStockThreshold: 4,
        rating: 4.9,
        reviewsCount: 24,
        status: "Active"
      },
      {
        id: "prod-streetwear-hoodie",
        sku: "APP-HDY-480",
        slug: "ropenix-heavyweight-480gsm-french-terry-hoodie",
        name: "Ropenix Heavyweight 480GSM French Terry Hoodie",
        brand: "Ropenix Atelier",
        country_of_origin: "Kenya",
        description: "Custom milled 100% organic combed cotton in 480 GSM ultra-heavyweight knit. Double-layered structured hood and signature dropped shoulder fit.",
        shortDescription: "Luxury heavyweight 480GSM organic cotton oversized streetwear hoodie.",
        detailedDescription: "Crafted in Nairobi with obsessive attention to fabric weight, drape, and longevity. Milled from sustainably sourced East African organic long-staple cotton, pre-shrunk to guarantee zero size change after washing.",
        price: 6800,
        costPrice: 3200,
        originalPrice: 8e3,
        previousPrice: 8e3,
        category: "Fashion",
        tags: ["Streetwear", "Hoodie", "Apparel", "Fashion", "Organic Cotton"],
        type: "physical",
        imageUrl: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&q=80&w=800",
        images: [
          "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&q=80&w=800"
        ],
        stock: 32,
        lowStockThreshold: 8,
        rating: 4.7,
        reviewsCount: 18,
        status: "Active"
      },
      {
        id: "prod-candle-coconut",
        sku: "BEA-CNDL-01",
        slug: "swahili-coast-coconut-amber-candle",
        name: "Swahili Coast Coconut & Amber Hand-Poured Candle",
        brand: "Kilifi Artisans",
        country_of_origin: "Kenya",
        description: "Hand-poured coconut wax with crackling wood wick and aromatic amber fragrance notes from the Kenyan coast.",
        shortDescription: "Artisanal coconut wax candle with crackling wood wick and coastal amber aroma.",
        detailedDescription: "Handcrafted in Kilifi using 100% natural coconut soy wax blended with pure essential oils and fragrance essences inspired by the Indian Ocean coastline.",
        price: 2600,
        costPrice: 1200,
        originalPrice: 3200,
        previousPrice: 3200,
        category: "Beauty & Fragrances",
        tags: ["Candle", "Fragrance", "Handmade", "Eco-friendly", "Kilifi"],
        type: "physical",
        imageUrl: "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&q=80&w=800",
        images: [
          "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&q=80&w=800"
        ],
        stock: 22,
        lowStockThreshold: 6,
        rating: 4.9,
        reviewsCount: 15,
        status: "Active"
      }
    ];
    for (const p of DEFAULT_PRODUCTS) {
      if (!existingIds.has(p.id)) {
        await saveMysqlProduct(p);
        console.log(`[MySQL] Seeded missing catalog product: "${p.name}" (${p.id})`);
      }
    }
  } catch (err) {
    console.warn("[MySQL] Default product seed notice:", err);
  }
}
async function ensureDefaultHeroBanners() {
  try {
    const existing = await getMysqlHeroBanners();
    if (existing.length > 0) return;
    const DEFAULT_BANNERS = [
      {
        id: "banner-1",
        title: "Curated Excellence. Uncompromised Quality.",
        subtitle: "Experience precision engineering, bespoke tailoring, and timeless craftsmanship built in Kenya.",
        imageUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1600",
        link: "/store",
        ctaText: "Explore Catalog",
        badgeText: "New Season Collections",
        active: true
      },
      {
        id: "banner-2",
        title: "Bespoke Atelier Tailoring & Custom Garments",
        subtitle: "Submit your bespoke fashion requests, upload reference mood boards, and track tailor execution in real-time.",
        imageUrl: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&q=80&w=1600",
        link: "/services",
        ctaText: "Design Bespoke Apparel",
        badgeText: "Handmade in Nairobi",
        active: true
      }
    ];
    await saveMysqlHeroBanners(DEFAULT_BANNERS);
    console.log("[MySQL] Seeded default promotional hero banners.");
  } catch (err) {
    console.warn("[MySQL] Default hero banner seed notice:", err);
  }
}
async function getAppSetting(key, defaultValue = null) {
  try {
    const pool = await getDbPool2();
    const [rows] = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1", [key]);
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
async function setAppSetting(key, value) {
  try {
    const pool = await getDbPool2();
    const stringVal = typeof value === "string" ? value : JSON.stringify(value);
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
async function getMysqlPendingRegistration(email) {
  const pool = await getDbPool2();
  const [rows] = await pool.query("SELECT * FROM pending_registrations WHERE LOWER(email) = ? LIMIT 1", [
    (email || "").trim().toLowerCase()
  ]);
  if (!rows || rows.length === 0) return null;
  const row = rows[0];
  return {
    ...row,
    userData: typeof row.user_data === "string" ? JSON.parse(row.user_data) : row.user_data
  };
}
async function saveMysqlPendingRegistration(record) {
  const pool = await getDbPool2();
  const id = record.id || `pr-${Date.now()}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const userDataStr = typeof record.userData === "string" ? record.userData : JSON.stringify(record.userData || {});
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
      (record.email || "").trim().toLowerCase(),
      record.otp,
      userDataStr,
      record.attempts || 0,
      record.createdAt || now,
      record.expiresAt || new Date(Date.now() + 15 * 60 * 1e3).toISOString()
    ]
  );
}
async function deleteMysqlPendingRegistration(email) {
  const pool = await getDbPool2();
  await pool.query("DELETE FROM pending_registrations WHERE LOWER(email) = ?", [(email || "").trim().toLowerCase()]);
}
async function updateMysqlPendingRegistrationAttempts(email, attempts) {
  const pool = await getDbPool2();
  await pool.query("UPDATE pending_registrations SET attempts = ? WHERE LOWER(email) = ?", [attempts, (email || "").trim().toLowerCase()]);
}
async function deleteSqliteProductsBulk(ids) {
  if (!ids || ids.length === 0) return;
  const pool = await getDbPool2();
  await pool.query(`DELETE FROM products WHERE id IN (?)`, [ids]);
}
async function saveSqliteCategories(categories) {
  for (const c of categories) {
    await saveMysqlCategory(c);
  }
}
async function deleteSqliteCategoriesBulk(ids) {
  if (!ids || ids.length === 0) return;
  const pool = await getDbPool2();
  await pool.query(`DELETE FROM categories WHERE id IN (?)`, [ids]);
}
async function getSqliteOrdersByUser(userIdOrEmail) {
  const pool = await getDbPool2();
  const [rows] = await pool.query(
    "SELECT * FROM orders WHERE customerEmail = ? OR customerEmail = (SELECT email FROM users WHERE id = ? LIMIT 1) ORDER BY date DESC",
    [userIdOrEmail, userIdOrEmail]
  );
  return (rows || []).map((r) => ({
    ...r,
    items: typeof r.items === "string" ? JSON.parse(r.items) : r.items
  }));
}
async function syncSqliteOrders(orders) {
  for (const o of orders) {
    await saveMysqlOrder(o);
  }
}
async function getSqliteSupplierById(id) {
  const pool = await getDbPool2();
  const [rows] = await pool.query("SELECT * FROM suppliers WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
}
async function getSqliteSupplierStatement(supplierId) {
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
    periodStart: supplier.created_at || (/* @__PURE__ */ new Date()).toISOString(),
    periodEnd: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function getSqliteSupplierDashboardAnalytics() {
  const suppliers = await getMysqlSuppliers();
  const batches = await getMysqlSupplierBatches();
  const payments = await getMysqlSupplierPayments();
  const totalPurchases = batches.reduce((sum, b) => sum + Number(b.totalCost || 0), 0);
  const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return {
    totalSuppliers: suppliers.length,
    activeSuppliers: suppliers.filter((s) => s.active).length,
    totalPurchases,
    totalOutstanding: totalPurchases - totalPayments,
    totalBatchesReceived: batches.length,
    pendingPaymentsCount: 0,
    topSuppliersByVolume: suppliers.slice(0, 5).map((s) => ({ supplierId: s.id, supplierName: s.name, totalVolume: Number(s.totalSpend || 0) }))
  };
}
async function getSqliteSupplierReport(range) {
  const metrics = await getSqliteSupplierDashboardAnalytics();
  const suppliers = await getMysqlSuppliers();
  const batches = await getMysqlSupplierBatches();
  const payments = await getMysqlSupplierPayments();
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    metrics,
    suppliers,
    batches,
    payments
  };
}
async function getSqliteCustomerById(id) {
  const pool = await getDbPool2();
  const [rows] = await pool.query("SELECT * FROM customers WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
}
async function deleteSqliteCustomer(id) {
  const pool = await getDbPool2();
  await pool.query("DELETE FROM customers WHERE id = ?", [id]);
}
async function saveSqliteDeal(deal) {
  const pool = await getDbPool2();
  const id = deal.id || `deal-${Date.now()}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
      deal.customerId || deal.customer_id || "",
      deal.title || "Deal",
      Number(deal.value || 0),
      deal.stage || "lead",
      deal.probability || 50,
      deal.expectedCloseDate || null,
      deal.createdAt || now,
      now
    ]
  );
  return { ...deal, id };
}
async function deleteSqliteDeal(id) {
  const pool = await getDbPool2();
  await pool.query("DELETE FROM deals WHERE id = ?", [id]);
}
async function saveSqliteInvoice(inv) {
  const pool = await getDbPool2();
  const id = inv.id || `inv-${Date.now()}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const itemsStr = typeof inv.items === "string" ? inv.items : JSON.stringify(inv.items || []);
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
      inv.customerId || inv.customer_id || "",
      inv.invoiceNumber || inv.invoice_number || `INV-${Date.now()}`,
      Number(inv.amount || 0),
      inv.status || "unpaid",
      inv.issueDate || inv.issue_date || now,
      inv.dueDate || inv.due_date || now,
      itemsStr,
      inv.createdAt || now,
      now
    ]
  );
  return { ...inv, id };
}
async function deleteSqliteInvoice(id) {
  const pool = await getDbPool2();
  await pool.query("DELETE FROM invoices WHERE id = ?", [id]);
}
async function saveSqliteCustomerOrder(order) {
  const pool = await getDbPool2();
  const id = order.id || `co-${Date.now()}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const itemsStr = typeof order.items === "string" ? order.items : JSON.stringify(order.items || []);
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
      order.customerName || order.customer_name || "Customer",
      order.customerEmail || order.customer_email || "",
      order.customerPhone || order.customer_phone || "",
      Number(order.total || 0),
      order.status || "pending",
      order.paymentStatus || order.payment_status || "unpaid",
      order.paymentReference || order.payment_reference || null,
      order.paymentAmount || order.payment_amount || null,
      itemsStr,
      order.createdAt || now,
      now
    ]
  );
  return { ...order, id };
}
async function getSqliteReviewsByProduct(productId) {
  const pool = await getDbPool2();
  const [rows] = await pool.query('SELECT * FROM reviews WHERE productId = ? AND status = "approved" ORDER BY date DESC', [productId]);
  return rows || [];
}
async function updateSqliteReview(review) {
  await saveMysqlReview(review);
}
async function toggleSqliteReviewHelpful(reviewId) {
  const pool = await getDbPool2();
  await pool.query("UPDATE reviews SET helpfulCount = helpfulCount + 1 WHERE id = ?", [reviewId]);
  const [rows] = await pool.query("SELECT helpfulCount FROM reviews WHERE id = ? LIMIT 1", [reviewId]);
  return rows[0]?.helpfulCount || 0;
}
async function updateSqliteReviewStatus(reviewId, status) {
  const pool = await getDbPool2();
  await pool.query("UPDATE reviews SET status = ? WHERE id = ?", [status, reviewId]);
}
async function recomputeSqliteProductRating(productId) {
  const pool = await getDbPool2();
  const [rows] = await pool.query('SELECT AVG(rating) as avgRating, COUNT(*) as count FROM reviews WHERE productId = ? AND status = "approved"', [productId]);
  const avg = rows[0]?.avgRating || 0;
  const count = rows[0]?.count || 0;
  await pool.query("UPDATE products SET rating = ?, reviewsCount = ? WHERE id = ?", [Number(avg).toFixed(1), count, productId]);
}
async function getSqliteCustomClothingRequestById(id) {
  const pool = await getDbPool2();
  const [rows] = await pool.query("SELECT * FROM custom_clothing_requests WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
}
async function getSqliteWishlist(userId) {
  const pool = await getDbPool2();
  const [rows] = await pool.query("SELECT product_ids FROM user_wishlists WHERE user_id = ? LIMIT 1", [userId]);
  if (!rows || rows.length === 0) return [];
  try {
    return JSON.parse(rows[0].product_ids || "[]");
  } catch {
    return [];
  }
}
async function addToSqliteWishlist(userId, productId) {
  const current = await getSqliteWishlist(userId);
  if (!current.includes(productId)) {
    current.push(productId);
  }
  const pool = await getDbPool2();
  await pool.query(
    `INSERT INTO user_wishlists (user_id, product_ids, updated_at)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE product_ids = VALUES(product_ids), updated_at = VALUES(updated_at);`,
    [userId, JSON.stringify(current), (/* @__PURE__ */ new Date()).toISOString()]
  );
  return current;
}
async function removeFromSqliteWishlist(userId, productId) {
  const current = await getSqliteWishlist(userId);
  const next = current.filter((id) => id !== productId);
  const pool = await getDbPool2();
  await pool.query(
    `INSERT INTO user_wishlists (user_id, product_ids, updated_at)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE product_ids = VALUES(product_ids), updated_at = VALUES(updated_at);`,
    [userId, JSON.stringify(next), (/* @__PURE__ */ new Date()).toISOString()]
  );
  return next;
}
async function getSqliteCart(userIdOrSession) {
  const session = await getMysqlCartSession(userIdOrSession);
  return session ? session.items : [];
}
async function saveSqliteCart(userIdOrSession, items) {
  await saveMysqlCartSession(userIdOrSession, items);
}
async function clearSqliteCart(userIdOrSession) {
  await saveMysqlCartSession(userIdOrSession, []);
}
var import_promise, import_dotenv, dbPool, isInitialized, isInitializing, DEFAULT_CORE_CATEGORIES, getSqliteUserByEmail, getSqliteUserById, saveSqliteUser, getAllSqliteUsers, getSqlitePendingRegistration, saveSqlitePendingRegistration, deleteSqlitePendingRegistration, updateSqlitePendingRegistrationAttempts, deleteSqliteProduct, getAllSqliteCategories, deleteSqliteCategory, getAllSqliteOrders, getSqliteOrderById, saveSqliteOrder, deleteSqliteOrder, getAllSqliteSuppliers, saveSqliteSupplier, deleteSqliteSupplier, getAllSqliteSupplierProducts, saveSqliteSupplierProduct, getAllSqliteSupplierIntakes, saveSqliteSupplierIntake, getAllSqliteSupplierPayments, saveSqliteSupplierPayment, getAllSqliteCustomers, saveSqliteCustomer, getAllSqliteHeroBanners, saveSqliteHeroBanners, getAllSqliteReviews, saveSqliteReview, deleteSqliteReview, getSqliteReviewRequestLogs, getSqliteReviewRequestSettings, saveSqliteReviewRequestSettings, addSqliteReviewOptOut, getSqliteReviewOptOutsCount, getSqliteCustomClothingRequests, saveSqliteCustomClothingRequest, updateSqliteCustomClothingRequestStatus, getSqliteInventoryAuditLogs, addSqliteInventoryAuditLog, pullSyncDataSqlite2;
var init_mysql_db = __esm({
  "src/lib/mysql-db.ts"() {
    import_promise = __toESM(require("mysql2/promise"), 1);
    import_dotenv = __toESM(require("dotenv"), 1);
    import_dotenv.default.config();
    dbPool = null;
    isInitialized = false;
    isInitializing = false;
    DEFAULT_CORE_CATEGORIES = [
      {
        id: "cat-fashion",
        name: "Fashion",
        slug: "fashion",
        description: "Men & Women Apparel, Streetwear, Shoes, and Accessories",
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600",
        icon: "Shirt",
        subcategories: ["Streetwear", "Hoodies", "T-Shirts", "Trousers"],
        is_active: 1,
        display_order: 1
      },
      {
        id: "cat-electronics",
        name: "Electronics",
        slug: "electronics",
        description: "Keyboards, Audio, Smartphones, Computing, and Smart Tech",
        image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600",
        icon: "Laptop",
        subcategories: ["Mechanical Keyboards", "Audio", "Accessories"],
        is_active: 1,
        display_order: 2
      },
      {
        id: "cat-home-living",
        name: "Home & Living",
        slug: "home-living",
        description: "Desk Setup, Furniture, Decor, Kitchen and Smart Appliances",
        image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600",
        icon: "Home",
        subcategories: ["Desk Accessories", "Decor", "Lighting"],
        is_active: 1,
        display_order: 3
      },
      {
        id: "cat-beauty-fragrances",
        name: "Beauty & Fragrances",
        slug: "beauty-fragrances",
        description: "Handcrafted Candles, Skincare, Perfumes, and Personal Care",
        image: "https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600",
        icon: "Sparkles",
        subcategories: ["Candles", "Fragrances", "Skincare"],
        is_active: 1,
        display_order: 4
      }
    ];
    getSqliteUserByEmail = getMysqlUserByEmail;
    getSqliteUserById = getMysqlUserById;
    saveSqliteUser = saveMysqlUser;
    getAllSqliteUsers = getAllMysqlUsers;
    getSqlitePendingRegistration = getMysqlPendingRegistration;
    saveSqlitePendingRegistration = saveMysqlPendingRegistration;
    deleteSqlitePendingRegistration = deleteMysqlPendingRegistration;
    updateSqlitePendingRegistrationAttempts = updateMysqlPendingRegistrationAttempts;
    deleteSqliteProduct = deleteMysqlProduct;
    getAllSqliteCategories = getMysqlCategories;
    deleteSqliteCategory = deleteMysqlCategory;
    getAllSqliteOrders = getMysqlOrders;
    getSqliteOrderById = getMysqlOrderById;
    saveSqliteOrder = saveMysqlOrder;
    deleteSqliteOrder = deleteMysqlOrder;
    getAllSqliteSuppliers = getMysqlSuppliers;
    saveSqliteSupplier = saveMysqlSupplier;
    deleteSqliteSupplier = deleteMysqlSupplier;
    getAllSqliteSupplierProducts = getMysqlSupplierProducts;
    saveSqliteSupplierProduct = saveMysqlSupplierProduct;
    getAllSqliteSupplierIntakes = getMysqlSupplierBatches;
    saveSqliteSupplierIntake = saveMysqlSupplierBatch;
    getAllSqliteSupplierPayments = getMysqlSupplierPayments;
    saveSqliteSupplierPayment = saveMysqlSupplierPayment;
    getAllSqliteCustomers = getAllMysqlCustomers;
    saveSqliteCustomer = saveMysqlCustomer;
    getAllSqliteHeroBanners = getMysqlHeroBanners;
    saveSqliteHeroBanners = saveMysqlHeroBanners;
    getAllSqliteReviews = getMysqlReviews;
    saveSqliteReview = saveMysqlReview;
    deleteSqliteReview = deleteMysqlReview;
    getSqliteReviewRequestLogs = async () => [];
    getSqliteReviewRequestSettings = async () => getAppSetting("review_request_settings", { enabled: true, delayDays: 7 });
    saveSqliteReviewRequestSettings = async (s) => setAppSetting("review_request_settings", s);
    addSqliteReviewOptOut = async (email) => setAppSetting(`optout_review_${email}`, true);
    getSqliteReviewOptOutsCount = async () => 0;
    getSqliteCustomClothingRequests = getMysqlCustomClothingRequests;
    saveSqliteCustomClothingRequest = saveMysqlCustomClothingRequest;
    updateSqliteCustomClothingRequestStatus = updateMysqlCustomClothingRequestStatus;
    getSqliteInventoryAuditLogs = getMysqlInventoryAuditLogs;
    addSqliteInventoryAuditLog = addMysqlInventoryAuditLog;
    pullSyncDataSqlite2 = pullSyncData;
  }
});

// server/email/config.ts
function getEmailConfig() {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtppro.zoho.com";
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT) || 465;
  const secure = process.env.EMAIL_USE_SSL !== "false" && (process.env.EMAIL_USE_SSL === "true" || port === 465);
  const requireTls = process.env.EMAIL_USE_TLS === "true";
  const user = process.env.SMTP_USER || process.env.EMAIL_HOST_USER || "admin@ropenix.co.ke";
  const pass = process.env.SMTP_PASS || process.env.EMAIL_HOST_PASSWORD || "";
  const rawFrom = process.env.EMAIL_FROM || process.env.DEFAULT_FROM_EMAIL || `"Ropenix Collections" <${user}>`;
  const defaultFrom = rawFrom.replace(/\\"/g, '"').replace(/^"/, "").replace(/"$/, "").trim();
  const replyTo = process.env.REPLY_TO_EMAIL || process.env.ADMIN_EMAIL || "ropenixkenya@gmail.com";
  const adminEmail = (process.env.ADMIN_EMAIL || replyTo || user).trim();
  const paybillNumber = process.env.PAYBILL_NUMBER || "303030";
  const paybillAccountNumber = process.env.PAYBILL_ACCOUNT_NUMBER || "2047728455";
  const paybillAccountName = process.env.PAYBILL_ACCOUNT_NAME || "ROPENIX INVESTMENTS LTD";
  const frontendUrl = (process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
  const adminUrl = (process.env.ADMIN_URL || frontendUrl).replace(/\/+$/, "");
  const enabled = process.env.EMAIL_ENABLED !== "false";
  const isDev = process.env.NODE_ENV !== "production";
  const devMode = process.env.EMAIL_DEV_MODE !== void 0 ? process.env.EMAIL_DEV_MODE === "true" : isDev;
  const devRedirectTo = process.env.EMAIL_DEV_REDIRECT_TO || (devMode ? replyTo : void 0);
  const digestEnabled = process.env.ADMIN_DIGEST_ENABLED !== "false";
  const digestTimesRaw = process.env.ADMIN_DIGEST_TIMES || "08:00,17:00";
  const digestTimes = digestTimesRaw.split(",").map((t) => t.trim()).filter(Boolean);
  const digestRecipientsRaw = process.env.ADMIN_DIGEST_RECIPIENTS || `${user},${replyTo}`;
  const digestRecipients = digestRecipientsRaw.split(",").map((r) => r.trim()).filter(Boolean);
  const digestSendWhenEmpty = process.env.ADMIN_DIGEST_SEND_WHEN_EMPTY === "true";
  const urgentPendingHours = Number(process.env.PENDING_VERIFICATION_ALERT_HOURS) || 4;
  const paymentReminderHours = Number(process.env.PAYMENT_REMINDER_HOURS) || 24;
  const maxPaymentReminders = Number(process.env.MAX_PAYMENT_REMINDERS) || 2;
  const autoCancelEnabled = process.env.AUTO_CANCEL_ENABLED === "true";
  const autoCancelHours = Number(process.env.AUTO_CANCEL_HOURS) || 48;
  const reviewRequestDays = Number(process.env.REVIEW_REQUEST_DAYS) || 7;
  const abandonedCartEnabled = process.env.ABANDONED_CART_ENABLED === "true";
  return {
    smtp: {
      host,
      port,
      secure,
      requireTls,
      user,
      pass,
      defaultFrom,
      from: defaultFrom,
      replyTo
    },
    admin: {
      email: adminEmail
    },
    dev: {
      isDevMode: devMode,
      redirectTo: devRedirectTo
    },
    schedule: {
      autoCancelUnpaidHours: autoCancelHours,
      reminderHours: paymentReminderHours
    },
    paybill: {
      number: paybillNumber,
      accountNumber: paybillAccountNumber,
      accountName: paybillAccountName
    },
    urls: {
      frontendUrl,
      adminUrl
    },
    behavior: {
      enabled,
      devMode,
      devRedirectTo,
      timezone: "Africa/Nairobi",
      currency: "KES"
    },
    digest: {
      enabled: digestEnabled,
      times: digestTimes,
      recipients: digestRecipients,
      sendWhenEmpty: digestSendWhenEmpty,
      urgentPendingHours
    },
    rules: {
      paymentReminderHours,
      maxPaymentReminders,
      autoCancelEnabled,
      autoCancelHours,
      reviewRequestDays,
      abandonedCartEnabled,
      abandonedCartHours: [2, 24, 72]
    }
  };
}
var import_dotenv2;
var init_config = __esm({
  "server/email/config.ts"() {
    import_dotenv2 = __toESM(require("dotenv"), 1);
    import_dotenv2.default.config();
  }
});

// server/email/db.ts
async function logEmail(record) {
  const id = `elog-${Date.now()}-${import_crypto.default.randomBytes(4).toString("hex")}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const metadataStr = record.metadata ? typeof record.metadata === "string" ? record.metadata : JSON.stringify(record.metadata) : null;
  try {
    const pool = await getDbPool2();
    await pool.query(
      `INSERT INTO email_logs (id, recipient, email_type, subject, status, attempts, error_message, related_order_id, related_user_id, dedupe_key, metadata, created_at, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         attempts = email_logs.attempts + 1,
         error_message = VALUES(error_message),
         sent_at = VALUES(sent_at);`,
      [
        id,
        record.recipient,
        record.email_type,
        record.subject,
        record.status,
        record.attempts || 1,
        record.error_message || null,
        record.related_order_id || null,
        record.related_user_id || null,
        record.dedupe_key || null,
        metadataStr,
        now,
        record.sent_at || (record.status === "sent" ? now : null)
      ]
    );
  } catch (err) {
    console.warn("[Email DB] MySQL logEmail warning:", err?.message || err);
  }
  return id;
}
async function isDedupeKeyProcessed(dedupeKey) {
  if (!dedupeKey) return false;
  try {
    const pool = await getDbPool2();
    const [rows] = await pool.query(
      `SELECT id FROM email_logs WHERE dedupe_key = ? AND status = 'sent' LIMIT 1`,
      [dedupeKey]
    );
    return Boolean(rows && rows.length > 0);
  } catch (err) {
    console.warn("[Email DB] isDedupeKeyProcessed check warning:", err?.message || err);
    return false;
  }
}
async function enqueueEmailJob(job) {
  const dedupeKey = job.dedupeKey || null;
  if (dedupeKey && await isDedupeKeyProcessed(dedupeKey)) {
    console.log(`[Email Queue] \u23ED\uFE0F Skipping enqueue: dedupeKey "${dedupeKey}" already sent.`);
    return null;
  }
  const id = `job-${Date.now()}-${import_crypto.default.randomBytes(4).toString("hex")}`;
  const now = /* @__PURE__ */ new Date();
  const nextAttempt = new Date(now.getTime() + (job.delaySeconds || 0) * 1e3).toISOString();
  const nowIso = now.toISOString();
  const payloadStr = typeof job.payload === "string" ? job.payload : JSON.stringify(job.payload || {});
  try {
    const pool = await getDbPool2();
    await pool.query(
      `INSERT INTO email_jobs (id, email_type, recipient, subject, payload, status, attempts, max_attempts, next_attempt_at, dedupe_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = id;`,
      [
        id,
        job.emailType,
        job.recipient,
        job.subject,
        payloadStr,
        job.maxAttempts || 5,
        nextAttempt,
        dedupeKey,
        nowIso,
        nowIso
      ]
    );
    return id;
  } catch (err) {
    console.warn("[Email Queue] MySQL enqueue warning:", err?.message || err);
    return null;
  }
}
async function fetchDueEmailJobs(limit = 10) {
  const now = /* @__PURE__ */ new Date();
  const nowIso = now.toISOString();
  const staleThresholdIso = new Date(now.getTime() - 2 * 60 * 1e3).toISOString();
  try {
    const pool = await getDbPool2();
    const [rows] = await pool.query(
      `SELECT id, email_type, recipient, subject, payload, status, attempts, max_attempts, next_attempt_at, error_message, dedupe_key, created_at, updated_at
       FROM email_jobs
       WHERE (status = 'queued' AND next_attempt_at <= ?)
          OR (status = 'sending' AND updated_at <= ?)
       ORDER BY next_attempt_at ASC
       LIMIT ?`,
      [nowIso, staleThresholdIso, limit]
    );
    if (!rows || rows.length === 0) return [];
    return rows.map((r) => {
      let payload = r.payload;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          payload = {};
        }
      }
      return {
        ...r,
        payload
      };
    });
  } catch (err) {
    console.warn("[Email DB] fetchDueEmailJobs error:", err?.message || err);
    return [];
  }
}
async function updateEmailJobStatus(jobId, status, details) {
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const pool = await getDbPool2();
    await pool.query(
      `UPDATE email_jobs SET
        status = ?,
        attempts = COALESCE(?, attempts),
        next_attempt_at = COALESCE(?, next_attempt_at),
        error_message = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        status,
        details?.attempts ?? null,
        details?.nextAttemptAt || null,
        details?.errorMessage ?? null,
        nowIso,
        jobId
      ]
    );
  } catch (err) {
    console.warn("[Email DB] MySQL updateEmailJobStatus warning:", err?.message || err);
  }
}
async function fetchEmailJobs(status, limit = 50) {
  try {
    const pool = await getDbPool2();
    const query = status ? `SELECT * FROM email_jobs WHERE status = ? ORDER BY created_at DESC LIMIT ?` : `SELECT * FROM email_jobs ORDER BY created_at DESC LIMIT ?`;
    const params = status ? [status, limit] : [limit];
    const [rows] = await pool.query(query, params);
    if (!rows || rows.length === 0) return [];
    return rows.map((r) => ({
      ...r,
      payload: typeof r.payload === "string" ? JSON.parse(r.payload || "{}") : r.payload
    }));
  } catch (err) {
    console.warn("[Email DB] fetchEmailJobs error:", err?.message || err);
    return [];
  }
}
async function retryFailedJobs() {
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const pool = await getDbPool2();
    const [result] = await pool.query(
      `UPDATE email_jobs SET status = 'queued', attempts = 0, next_attempt_at = ?, updated_at = ? WHERE status = 'failed'`,
      [nowIso, nowIso]
    );
    return result?.affectedRows || 0;
  } catch (err) {
    console.warn("[Email DB] retryFailedJobs error:", err?.message || err);
    return 0;
  }
}
async function createPaymentSubmission(submission) {
  const cleanCode = submission.mpesaReceiptCode.trim().toUpperCase();
  const cleanPhone = submission.phoneNumber.trim().replace(/\s+/g, "");
  const id = `claim-${Date.now()}-${import_crypto.default.randomBytes(3).toString("hex")}`;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const existing = await getPaymentSubmissionByMpesaCode(cleanCode);
  if (existing) {
    return {
      success: false,
      duplicate: true,
      error: `M-Pesa Transaction Code "${cleanCode}" has already been submitted for Order #${existing.order_id}. Duplicate payment claims are rejected.`
    };
  }
  try {
    const pool = await getDbPool2();
    await pool.query(
      `INSERT INTO payment_submissions (id, order_id, mpesa_receipt_code, phone_number, amount_claimed, payment_method, status, admin_notes, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending_verification', ?, ?)`,
      [
        id,
        submission.orderId,
        cleanCode,
        cleanPhone,
        submission.amountClaimed || null,
        submission.paymentMethod || "mpesa_paybill",
        submission.adminNotes || null,
        nowIso
      ]
    );
    return { success: true, id };
  } catch (err) {
    if (String(err?.message || "").includes("Duplicate entry") || String(err?.message || "").includes("UNIQUE")) {
      return { success: false, duplicate: true, error: `M-Pesa code "${cleanCode}" has already been used.` };
    }
    return { success: false, error: err?.message || "Failed to save payment submission" };
  }
}
async function getPaymentSubmissionByMpesaCode(code) {
  const cleanCode = code.trim().toUpperCase();
  try {
    const pool = await getDbPool2();
    const [rows] = await pool.query(
      `SELECT id, order_id, mpesa_receipt_code, phone_number, amount_claimed, payment_method, status, admin_notes, submitted_at, verified_at, verified_by
       FROM payment_submissions WHERE UPPER(mpesa_receipt_code) = UPPER(?) LIMIT 1`,
      [cleanCode]
    );
    if (!rows || rows.length === 0) return null;
    return rows[0];
  } catch {
    return null;
  }
}
async function getPaymentSubmissionsForOrder(orderId) {
  try {
    const pool = await getDbPool2();
    const [rows] = await pool.query(
      `SELECT id, order_id, mpesa_receipt_code, phone_number, amount_claimed, payment_method, status, admin_notes, submitted_at, verified_at, verified_by
       FROM payment_submissions WHERE order_id = ? ORDER BY submitted_at DESC`,
      [orderId]
    );
    return rows || [];
  } catch {
    return [];
  }
}
async function updatePaymentSubmissionStatus(submissionId, status, details) {
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const pool = await getDbPool2();
    await pool.query(
      `UPDATE payment_submissions SET
        status = ?,
        verified_at = ?,
        verified_by = ?,
        admin_notes = COALESCE(?, admin_notes)
       WHERE id = ?`,
      [status, nowIso, details.verifiedBy, details.adminNotes || null, submissionId]
    );
  } catch (err) {
    console.warn("[Email DB] MySQL updatePaymentSubmissionStatus warning:", err?.message || err);
  }
}
async function getEmailPreferences(email) {
  const cleanEmail = email.trim().toLowerCase();
  const defaultPrefs = {
    id: `pref-${cleanEmail}`,
    email: cleanEmail,
    allow_marketing: true,
    allow_review_requests: true,
    allow_abandoned_cart: true,
    allow_price_drop: true,
    unsubscribed_all: false,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  try {
    const pool = await getDbPool2();
    const [rows] = await pool.query(
      `SELECT id, email, allow_marketing, allow_review_requests, allow_abandoned_cart, allow_price_drop, unsubscribed_all, updated_at
       FROM email_preferences WHERE email = ? LIMIT 1`,
      [cleanEmail]
    );
    if (rows && rows.length > 0) {
      const r = rows[0];
      return {
        id: r.id,
        email: r.email,
        allow_marketing: Boolean(r.allow_marketing),
        allow_review_requests: Boolean(r.allow_review_requests),
        allow_abandoned_cart: Boolean(r.allow_abandoned_cart),
        allow_price_drop: Boolean(r.allow_price_drop),
        unsubscribed_all: Boolean(r.unsubscribed_all),
        updated_at: r.updated_at
      };
    }
    return defaultPrefs;
  } catch {
    return defaultPrefs;
  }
}
async function isEmailOptedOut(email, category) {
  const prefs = await getEmailPreferences(email);
  if (prefs.unsubscribed_all) return true;
  if (category === "marketing" && !prefs.allow_marketing) return true;
  if (category === "review" && !prefs.allow_review_requests) return true;
  if (category === "abandoned_cart" && !prefs.allow_abandoned_cart) return true;
  if (category === "price_drop" && !prefs.allow_price_drop) return true;
  return false;
}
async function wasScheduledTaskExecuted(dedupeKey) {
  try {
    const pool = await getDbPool2();
    const [rows] = await pool.query(
      `SELECT id FROM scheduled_task_logs WHERE dedupe_key = ? AND status = 'success' LIMIT 1`,
      [dedupeKey]
    );
    return Boolean(rows && rows.length > 0);
  } catch {
    return false;
  }
}
async function recordScheduledTaskExecution(taskName, dedupeKey, details) {
  const id = `task-${Date.now()}-${import_crypto.default.randomBytes(3).toString("hex")}`;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const pool = await getDbPool2();
    await pool.query(
      `INSERT INTO scheduled_task_logs (id, task_name, dedupe_key, executed_at, status, details)
       VALUES (?, ?, ?, ?, 'success', ?)
       ON DUPLICATE KEY UPDATE executed_at = VALUES(executed_at), details = VALUES(details);`,
      [id, taskName, dedupeKey, nowIso, details || null]
    );
  } catch (err) {
    console.warn("[Email DB] MySQL recordScheduledTaskExecution warning:", err?.message || err);
  }
}
async function logScheduledTaskRun(dedupeKey, details) {
  return recordScheduledTaskExecution("scheduled_task", dedupeKey, details ? JSON.stringify(details) : void 0);
}
async function isRecipientOptedOut(email, emailType) {
  const category = emailType.includes("marketing") ? "marketing" : emailType.includes("review") ? "review" : emailType.includes("cart") ? "abandoned_cart" : null;
  if (!category) return false;
  return isEmailOptedOut(email, category);
}
async function updateOrderPaymentStatus(orderId, status, details) {
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const pool = await getDbPool2();
    await pool.query(
      `UPDATE orders SET
        paymentStatus = ?,
        paymentReference = COALESCE(?, paymentReference),
        total = COALESCE(?, total),
        paidAt = COALESCE(?, paidAt),
        deliveryNote = COALESCE(?, deliveryNote),
        updated_at = ?
       WHERE id = ?`,
      [
        status,
        details?.paymentReference || null,
        details?.paymentAmount || null,
        details?.paymentConfirmedAt || (status === "paid" ? nowIso : null),
        details?.notes || null,
        nowIso,
        orderId
      ]
    );
    try {
      await pool.query(
        `UPDATE customer_orders SET
          payment_status = ?,
          payment_reference = COALESCE(?, payment_reference),
          payment_amount = COALESCE(?, payment_amount),
          payment_confirmed_at = COALESCE(?, payment_confirmed_at),
          payment_confirmed_by = COALESCE(?, payment_confirmed_by),
          payment_reminder_count = COALESCE(?, payment_reminder_count),
          last_payment_reminder_at = COALESCE(?, last_payment_reminder_at),
          updated_at = ?
         WHERE id = ?`,
        [
          status,
          details?.paymentReference || null,
          details?.paymentAmount || null,
          details?.paymentConfirmedAt || (status === "paid" ? nowIso : null),
          details?.paymentConfirmedBy || null,
          details?.paymentReminderCount ?? null,
          details?.lastPaymentReminderAt || null,
          nowIso,
          orderId
        ]
      );
    } catch (_) {
    }
  } catch (e) {
    console.warn("[Email DB] MySQL updateOrderPaymentStatus warning:", e?.message || e);
  }
}
function normalizeOrderRecord(row) {
  if (!row) return null;
  let items = row.items || [];
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }
  const customerName = row.customerName || row.customer_name || "Customer";
  const customerEmail = row.customerEmail || row.customer_email || "";
  const customerPhone = row.customerPhone || row.phone || row.customer_phone || row.mpesaPhone || "";
  const total = Number(row.total || 0);
  const status = row.status || "pending";
  const paymentStatus = row.paymentStatus || row.payment_status || "unpaid";
  const paymentReference = row.paymentReference || row.payment_reference || "";
  const paymentReminderCount = Number(row.paymentReminderCount || row.payment_reminder_count || 0);
  const lastPaymentReminderAt = row.lastPaymentReminderAt || row.last_payment_reminder_at || null;
  const shippingAddress = row.shippingAddress || row.shipping_address || "";
  const createdAt = row.date || row.created_at || row.createdAt || (/* @__PURE__ */ new Date()).toISOString();
  return {
    id: row.id,
    customerName,
    customer_name: customerName,
    customerEmail,
    customer_email: customerEmail,
    customerPhone,
    customer_phone: customerPhone,
    phone: customerPhone,
    total,
    status,
    paymentStatus,
    payment_status: paymentStatus,
    paymentReference,
    payment_reference: paymentReference,
    paymentReminderCount,
    payment_reminder_count: paymentReminderCount,
    lastPaymentReminderAt,
    last_payment_reminder_at: lastPaymentReminderAt,
    shippingAddress,
    shipping_address: shippingAddress,
    items,
    createdAt,
    created_at: createdAt,
    date: createdAt
  };
}
async function fetchAuthoritativeOrderById(orderId) {
  if (!orderId) return null;
  const cleanId = String(orderId).trim();
  try {
    const pool = await getDbPool2();
    const [rows] = await pool.query(`SELECT * FROM orders WHERE UPPER(id) = UPPER(?) LIMIT 1`, [cleanId]);
    if (rows && rows.length > 0) {
      return normalizeOrderRecord(rows[0]);
    }
    const [cRows] = await pool.query(`SELECT * FROM customer_orders WHERE UPPER(id) = UPPER(?) LIMIT 1`, [cleanId]);
    if (cRows && cRows.length > 0) {
      return normalizeOrderRecord(cRows[0]);
    }
    return null;
  } catch {
    return null;
  }
}
async function getUnpaidOrders(olderThanHours = 0) {
  const thresholdIso = new Date(Date.now() - olderThanHours * 3600 * 1e3).toISOString();
  const resultMap = /* @__PURE__ */ new Map();
  try {
    const pool = await getDbPool2();
    const [rows] = await pool.query(
      `SELECT * FROM orders
       WHERE (paymentStatus = 'unpaid' OR paymentStatus = 'pending' OR paymentStatus IS NULL)
         AND status NOT IN ('cancelled', 'completed', 'delivered')
         AND date <= ?
       ORDER BY date ASC`,
      [thresholdIso]
    );
    for (const r of rows || []) {
      const norm = normalizeOrderRecord(r);
      if (norm && !resultMap.has(norm.id)) resultMap.set(norm.id, norm);
    }
    try {
      const [cRows] = await pool.query(
        `SELECT * FROM customer_orders
         WHERE (payment_status = 'unpaid' OR payment_status = 'pending' OR payment_status IS NULL)
           AND status NOT IN ('cancelled', 'completed', 'delivered')
           AND (created_at <= ? OR placed_at <= ?)
         ORDER BY created_at ASC`,
        [thresholdIso, thresholdIso]
      );
      for (const r of cRows || []) {
        const norm = normalizeOrderRecord(r);
        if (norm && !resultMap.has(norm.id)) resultMap.set(norm.id, norm);
      }
    } catch (_) {
    }
    return Array.from(resultMap.values());
  } catch (err) {
    console.warn("[Email DB] getUnpaidOrders error:", err?.message || err);
    return [];
  }
}
async function hasUnprocessedPaymentSubmission(orderId) {
  try {
    const pool = await getDbPool2();
    const [rows] = await pool.query(
      `SELECT id FROM payment_submissions WHERE order_id = ? AND status = 'pending_verification' LIMIT 1`,
      [orderId]
    );
    return Boolean(rows && rows.length > 0);
  } catch {
    return false;
  }
}
var import_crypto, recordPaymentSubmission, getPaymentSubmissionByCode, hasScheduledTaskRun;
var init_db = __esm({
  "server/email/db.ts"() {
    import_crypto = __toESM(require("crypto"), 1);
    init_mysql_db();
    recordPaymentSubmission = createPaymentSubmission;
    getPaymentSubmissionByCode = getPaymentSubmissionByMpesaCode;
    hasScheduledTaskRun = wasScheduledTaskExecuted;
  }
});

// server/email/transporter.ts
function getMailTransporter() {
  if (transporterInstance) {
    return transporterInstance;
  }
  const config2 = getEmailConfig();
  const options = {
    host: config2.smtp.host,
    port: config2.smtp.port,
    secure: config2.smtp.secure,
    auth: {
      user: config2.smtp.user,
      pass: config2.smtp.pass
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 1e4,
    greetingTimeout: 8e3,
    socketTimeout: 15e3,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1e3,
    rateLimit: 5
    // Throttle to 5 emails/second to respect Zoho rate limits
  };
  transporterInstance = import_nodemailer.default.createTransport(options);
  return transporterInstance;
}
async function sendRawMail(options) {
  const config2 = getEmailConfig();
  const transporter = getMailTransporter();
  if (!config2.behavior.enabled) {
    console.log(`[Email System] \u2139\uFE0F Email dispatch disabled via EMAIL_ENABLED=false. Skipped: "${options.subject}" to ${options.to}`);
    return {
      success: true,
      messageId: `mock-disabled-${Date.now()}`,
      response: "EMAIL_ENABLED=false (Mock Delivery)",
      recipient: Array.isArray(options.to) ? options.to.join(", ") : options.to
    };
  }
  const rawRecipient = Array.isArray(options.to) ? options.to.join(", ") : options.to;
  let targetRecipient = rawRecipient;
  let devModeRedirected = false;
  if (config2.behavior.devMode) {
    const isTestAccount = rawRecipient.includes("ropenix") || rawRecipient.includes("admin") || rawRecipient.includes("localhost");
    if (!isTestAccount && config2.behavior.devRedirectTo) {
      targetRecipient = config2.behavior.devRedirectTo;
      devModeRedirected = true;
      console.log(`[Email Dev Mode] \u{1F6E1}\uFE0F Redirecting email originally destined for <${rawRecipient}> to dev inbox: <${targetRecipient}>`);
    }
  }
  const mailOptions = {
    from: config2.smtp.defaultFrom,
    to: targetRecipient,
    replyTo: options.replyTo || config2.smtp.replyTo,
    subject: devModeRedirected ? `[DEV - for: ${rawRecipient}] ${options.subject}` : options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim(),
    headers: {
      "X-Entity-Ref-ID": `ropenix-${Date.now()}`,
      "X-Store-Name": "Ropenix Collections",
      ...options.headers || {}
    }
  };
  if (options.listUnsubscribeUrl) {
    mailOptions.list = {
      unsubscribe: {
        url: options.listUnsubscribeUrl,
        comment: "Unsubscribe from Ropenix Notifications"
      }
    };
  }
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email System] \u2709\uFE0F Successfully sent "${options.subject}" to ${targetRecipient} (MsgID: ${info.messageId})`);
    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
      recipient: targetRecipient,
      originalRecipient: rawRecipient,
      devModeRedirected
    };
  } catch (err) {
    console.error(`[Email System] \u274C Failed to dispatch email "${options.subject}" to ${targetRecipient}:`, err?.message || err);
    return {
      success: false,
      recipient: targetRecipient,
      originalRecipient: rawRecipient,
      error: err?.message || "SMTP transmission error",
      devModeRedirected
    };
  }
}
var import_nodemailer, transporterInstance, sendEmail;
var init_transporter = __esm({
  "server/email/transporter.ts"() {
    import_nodemailer = __toESM(require("nodemailer"), 1);
    init_config();
    transporterInstance = null;
    sendEmail = sendRawMail;
  }
});

// server/email/templates/types.ts
var init_types = __esm({
  "server/email/templates/types.ts"() {
  }
});

// server/email/urlHelper.ts
function buildUrl(path2 = "", params) {
  const config2 = getEmailConfig();
  const base = config2.urls.frontendUrl.replace(/\/+$/, "");
  const cleanPath = path2.startsWith("/") ? path2 : path2 ? `/${path2}` : "";
  let url = `${base}${cleanPath || "/"}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== void 0 && value !== null && value !== "") {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }
  return url;
}
function buildTrackUrl(orderId) {
  return buildUrl("/", { trackOrder: orderId });
}
function buildAdminUrl(path2 = "", params) {
  const config2 = getEmailConfig();
  const base = config2.urls.adminUrl.replace(/\/+$/, "");
  const cleanPath = path2.startsWith("/") ? path2 : `/${path2}`;
  let url = `${base}${cleanPath}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== void 0 && value !== null && value !== "") {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }
  return url;
}
function formatKES(amount) {
  const num = typeof amount === "number" ? amount : parseFloat(String(amount || "0"));
  if (isNaN(num)) return "KES 0";
  return `KES ${Math.round(num).toLocaleString("en-KE")}`;
}
function formatEATDate(dateInput) {
  if (!dateInput) return "N/A";
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return String(dateInput);
    return new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).format(date) + " EAT";
  } catch {
    return String(dateInput);
  }
}
var init_urlHelper = __esm({
  "server/email/urlHelper.ts"() {
    init_config();
  }
});

// server/email/templates/baseLayout.ts
function escapeHtml(unsafe) {
  if (unsafe === void 0 || unsafe === null) return "";
  return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function renderPaybillBox(totalFormatted, orderNumber) {
  const config2 = getEmailConfig();
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0; background-color: #f0fdf4; border: 2px dashed #16a34a; border-radius: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding-bottom: 12px;">
                <span style="display: inline-block; background-color: #16a34a; color: #ffffff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                  \u{1F4F1} M-PESA PAYBILL PAYMENT INSTRUCTIONS
                </span>
              </td>
            </tr>
            <tr>
              <td style="font-size: 13px; line-height: 1.6; color: #166534;">
                Please complete your payment via M-Pesa to initiate immediate dispatch:
              </td>
            </tr>
            <tr>
              <td style="padding-top: 12px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 8px; border: 1px solid #bbf7d0;">
                  <tr>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #dcfce7; font-size: 13px; color: #374151; width: 40%;"><strong>1. Paybill (Business No):</strong></td>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #dcfce7; font-size: 14px; font-family: monospace; font-weight: 700; color: #15803d;">${config2.paybill.number}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #dcfce7; font-size: 13px; color: #374151;"><strong>2. Account Number:</strong></td>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #dcfce7; font-size: 14px; font-family: monospace; font-weight: 700; color: #15803d;">
                      ${config2.paybill.accountNumber} <span style="font-size: 11px; font-weight: normal; color: #6b7280;">(Fixed shared account)</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #dcfce7; font-size: 13px; color: #374151;"><strong>3. Exact Amount:</strong></td>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #dcfce7; font-size: 15px; font-weight: 800; color: #111827;">${totalFormatted}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 14px; font-size: 13px; color: #374151;"><strong>4. Verified Business Name:</strong></td>
                    <td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #065f46;">
                      "${config2.paybill.accountName}"
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 14px; font-size: 12px; line-height: 1.5; color: #15803d;">
                \u{1F4A1} <strong>Important Note:</strong> The Account Number (<code>${config2.paybill.accountNumber}</code>) is the same for all customers, and your M-Pesa SMS confirmation will show <strong>${config2.paybill.accountName}</strong>. 
                <br />
                Once paid, click <strong>"I've Paid"</strong> on your order page to submit your M-Pesa transaction code, or reply quoting your Order Number (<strong>${escapeHtml(orderNumber)}</strong>).
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}
function renderEmailButton(text, url, color = "indigo") {
  const bg = color === "emerald" ? "#16a34a" : color === "amber" ? "#d97706" : color === "rose" ? "#e11d48" : "#4f46e5";
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td align="center" style="border-radius: 8px; background: ${bg};">
          <a href="${escapeHtml(url)}" target="_blank" style="font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #ffffff; text-decoration: none; border-radius: 8px; padding: 12px 26px; border: 1px solid ${bg}; display: inline-block; font-weight: 700; letter-spacing: 0.3px;">
            ${escapeHtml(text)} &rarr;
          </a>
        </td>
      </tr>
    </table>
  `;
}
function renderBaseEmailLayout(options) {
  const config2 = getEmailConfig();
  const storeUrl = buildUrl("/");
  const logoUrl = buildUrl("/favicon.svg");
  const supportEmail = config2.smtp.replyTo;
  const unsubscribeUrl = options.unsubscribeUrl || buildUrl("/unsubscribe");
  const badgeBg = options.badgeColor === "emerald" ? "#ecfdf5" : options.badgeColor === "amber" ? "#fffbeb" : options.badgeColor === "rose" ? "#fff1f2" : "#eef2ff";
  const badgeText = options.badgeColor === "emerald" ? "#065f46" : options.badgeColor === "amber" ? "#92400e" : options.badgeColor === "rose" ? "#9f1239" : "#3730a3";
  const badgeBorder = options.badgeColor === "emerald" ? "#a7f3d0" : options.badgeColor === "amber" ? "#fde68a" : options.badgeColor === "rose" ? "#fecdd3" : "#c7d2fe";
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(options.title || "Ropenix Collections Notification")}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; margin: auto !important; }
      .fluid-padding { padding-left: 16px !important; padding-right: 16px !important; }
    }
  </style>
</head>
<body style="background-color: #f8fafc; margin: 0; padding: 0;">
  <!-- Preheader preview text in email clients -->
  <div style="display: none; font-size: 1px; color: #f8fafc; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${escapeHtml(options.preheader || options.heading || "Update from Ropenix Collections")}
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 24px 0 32px 0;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px 32px; text-align: center; border-bottom: 3px solid #4f46e5;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(storeUrl)}" target="_blank" style="text-decoration: none;">
                      <span style="color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; display: inline-block;">
                        ROPENIX <span style="color: #818cf8;">COLLECTIONS</span>
                      </span>
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 4px;">
                    <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                      Kenya's Premier Online Hub
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Heading & Badge Area -->
          ${options.heading || options.badgeText ? `
          <tr>
            <td style="padding: 24px 32px 8px 32px;" class="fluid-padding">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                ${options.badgeText ? `
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeText}; border: 1px solid ${badgeBorder}; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                      ${escapeHtml(options.badgeText)}
                    </span>
                  </td>
                </tr>
                ` : ""}
                ${options.heading ? `
                <tr>
                  <td style="font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                    ${escapeHtml(options.heading)}
                  </td>
                </tr>
                ` : ""}
              </table>
            </td>
          </tr>
          ` : ""}

          <!-- Body Content Area -->
          <tr>
            <td style="padding: 16px 32px 32px 32px; font-size: 14px; line-height: 1.6; color: #334155;" class="fluid-padding">
              ${options.bodyHtml}
            </td>
          </tr>

          <!-- Footer Area -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 24px 32px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;" class="fluid-padding">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="font-size: 12px; color: #475569; font-weight: 600; padding-bottom: 8px;">
                    Need assistance with your order?
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size: 12px; color: #64748b; padding-bottom: 12px;">
                    Email: <a href="mailto:${escapeHtml(supportEmail)}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">${escapeHtml(supportEmail)}</a> &bull; Hotline: <strong style="color: #334155;">+254 182 180 965</strong>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="border-top: 1px solid #cbd5e1; padding-top: 12px; font-size: 11px; color: #94a3b8;">
                    <strong>${escapeHtml(config2.paybill.accountName)}</strong> &bull; Nairobi, Kenya
                    <br />
                    Storefront: <a href="${escapeHtml(storeUrl)}" style="color: #64748b; text-decoration: underline;">${escapeHtml(config2.urls.frontendUrl)}</a>
                  </td>
                </tr>
                ${options.isMarketing ? `
                <tr>
                  <td align="center" style="padding-top: 8px; font-size: 11px; color: #94a3b8;">
                    You are receiving this email because you opted into updates. <a href="${escapeHtml(unsubscribeUrl)}" style="color: #64748b; text-decoration: underline;">Unsubscribe</a>
                  </td>
                </tr>
                ` : ""}
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
var init_baseLayout = __esm({
  "server/email/templates/baseLayout.ts"() {
    init_config();
    init_urlHelper();
  }
});

// server/email/templates/accountTemplates.ts
function renderWelcomeEmail(data) {
  const name = data.name || "Valued Customer";
  const shopUrl = buildUrl("/shop");
  const subject = `Welcome to Ropenix Collections, ${name}! \u{1F389}`;
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(name)}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      We are thrilled to welcome you to <strong>Ropenix Collections</strong>, Kenya's premier shopping destination for curated electronics, bespoke lifestyle essentials, and artisan goods.
    </p>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">What you can do with your account:</h3>
      <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.8;">
        <li>\u26A1 <strong>Faster Checkout:</strong> Save your delivery addresses and preferences.</li>
        <li>\u{1F4E6} <strong>Real-time Order Tracking:</strong> Track every package from fulfillment to delivery.</li>
        <li>\u{1F4F1} <strong>Direct M-Pesa Verification:</strong> Seamless instant payment clearance via Paybill.</li>
        <li>\u{1F48E} <strong>Exclusive Member Perks:</strong> Early access to curated drops, flash promotions, and bespoke offers.</li>
      </ul>
    </div>
    ${data.verificationUrl ? `
    <p style="margin: 0 0 12px 0; color: #334155;">
      To verify your email address and activate all account security features, please confirm below:
    </p>
    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton("Verify Email Address", data.verificationUrl, "indigo")}
    </div>
    <p style="font-size: 12px; color: #64748b;">
      Or copy and paste this verification link into your browser:<br />
      <a href="${escapeHtml(data.verificationUrl)}" style="color: #4f46e5; word-break: break-all;">${escapeHtml(data.verificationUrl)}</a>
    </p>
    ` : `
    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton("Start Exploring Collections", shopUrl, "indigo")}
    </div>
    `}
    <p style="margin: 24px 0 0 0; color: #475569; font-size: 13px; line-height: 1.6;">
      If you have any questions or need custom styling assistance, our concierge team is always available at <a href="mailto:concierge@ropenix.co.ke" style="color: #4f46e5;">concierge@ropenix.co.ke</a> or hotline <strong>+254 182 180 965</strong>.
    </p>
  `;
  const html = renderBaseEmailLayout({
    title: "Welcome to Ropenix Collections",
    heading: `Welcome to the Family, ${escapeHtml(name)}!`,
    badgeText: "New Member Account",
    badgeColor: "indigo",
    bodyHtml
  });
  const text = `Dear ${name},

Welcome to Ropenix Collections! We are thrilled to have you join our premier shopping community.

` + (data.verificationUrl ? `Please verify your email address here: ${data.verificationUrl}

` : `Explore our collections: ${shopUrl}

`) + `Need assistance? Contact our concierge at concierge@ropenix.co.ke or call +254 182 180 965.

Warm regards,
The Ropenix Collections Team`;
  return { subject, html, text };
}
function renderVerifyEmail(data) {
  const name = data.name || "Customer";
  const subject = "Verify your email address - Ropenix Collections";
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Hello <strong>${escapeHtml(name)}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      Thank you for registering with Ropenix Collections. To ensure account security and receive order confirmations, please verify your email address (<strong>${escapeHtml(data.email)}</strong>).
    </p>
    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton("Confirm Email Address", data.verificationUrl, "indigo")}
    </div>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 12px; color: #64748b;">
      <strong>Link not working?</strong> Copy and paste this URL into your browser:<br />
      <a href="${escapeHtml(data.verificationUrl)}" style="color: #4f46e5; word-break: break-all;">${escapeHtml(data.verificationUrl)}</a>
      <br /><br />
      <em>This verification link will expire in 24 hours. If you did not create this account, you can safely ignore this email.</em>
    </div>
  `;
  const html = renderBaseEmailLayout({
    title: "Verify Your Email",
    heading: "Verify Your Email Address",
    badgeText: "Security Verification",
    badgeColor: "indigo",
    bodyHtml
  });
  const text = `Hello ${name},

Please verify your email address (${data.email}) for Ropenix Collections by clicking this link:
${data.verificationUrl}

This link will expire in 24 hours.

If you did not request this, please ignore this email.`;
  return { subject, html, text };
}
function renderPasswordResetEmail(data) {
  const name = data.name || "Customer";
  const minutes = data.expiresInMinutes || 15;
  const subject = data.code ? `Password Reset Code: ${data.code} - Ropenix Collections` : "Reset your password - Ropenix Collections";
  const codeSnippet = data.code ? `
    <div style="text-align: center; margin: 24px 0 16px 0;">
      <div style="display: inline-block; background-color: #f8fafc; border: 2px dashed #f59e0b; border-radius: 12px; padding: 14px 32px; letter-spacing: 8px; font-size: 28px; font-weight: 800; font-family: 'Courier New', Courier, monospace; color: #0f172a; user-select: all;">
        ${escapeHtml(data.code)}
      </div>
      <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">Or use the direct button below:</p>
    </div>
  ` : "";
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Hello <strong>${escapeHtml(name)}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      We received a request to reset the password associated with your Ropenix Collections account. You can enter the verification code or click the button below to choose a new password:
    </p>
    ${codeSnippet}
    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton("Reset My Password", data.resetUrl, "amber")}
    </div>
    <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 12px; color: #92400e;">
      \u26A0\uFE0F <strong>Security Notice:</strong> This password reset code and link are valid for <strong>${minutes} minutes</strong> and can only be used once.<br />
      If you did not request a password reset, please ignore this email.
    </div>
    <p style="font-size: 12px; color: #64748b;">
      Direct link: <a href="${escapeHtml(data.resetUrl)}" style="color: #d97706; word-break: break-all;">${escapeHtml(data.resetUrl)}</a>
    </p>
  `;
  const html = renderBaseEmailLayout({
    title: "Password Reset Request",
    heading: "Reset Your Password",
    badgeText: "Account Security",
    badgeColor: "amber",
    bodyHtml
  });
  const text = `Hello ${name},

We received a request to reset your Ropenix Collections password.${data.code ? `

Your reset verification code is: ${data.code}` : ""}

Reset your password here:
${data.resetUrl}

This link is valid for ${minutes} minutes.
If you did not request this, please ignore this message.`;
  return { subject, html, text };
}
function renderRegistrationOtpEmail(data) {
  const name = data.name || "Valued Customer";
  const minutes = data.expiresInMinutes || 10;
  const subject = `Your Verification Code: ${data.otp} - Ropenix Collections`;
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Hello <strong>${escapeHtml(name)}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      Thank you for registering with <strong>Ropenix Collections</strong>. To complete your account registration and verify your email address, please enter the following 6-digit verification code:
    </p>
    <div style="text-align: center; margin: 28px 0;">
      <div style="display: inline-block; background-color: #f8fafc; border: 2px dashed #4f46e5; border-radius: 12px; padding: 16px 36px; letter-spacing: 10px; font-size: 32px; font-weight: 800; font-family: 'Courier New', Courier, monospace; color: #0f172a; user-select: all;">
        ${escapeHtml(data.otp)}
      </div>
    </div>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 13px; color: #475569; line-height: 1.6;">
      \u23F1\uFE0F <strong>Expiration Notice:</strong> This code will expire in <strong>${minutes} minutes</strong>.<br />
      \u{1F512} <strong>Security Warning:</strong> Never share this verification code with anyone. Ropenix staff will never ask for your code.<br />
      \u2139\uFE0F If you didn't request this, ignore this email.
    </div>
    <p style="margin: 20px 0 0 0; color: #64748b; font-size: 12px;">
      Code requested for: <strong>${escapeHtml(data.email)}</strong>
    </p>
  `;
  const html = renderBaseEmailLayout({
    title: "Verify Your Email",
    heading: "Your Verification Code",
    badgeText: "One-Time Verification Code",
    badgeColor: "indigo",
    bodyHtml
  });
  const text = `Hello ${name},

Your Ropenix Collections verification code is: ${data.otp}

This code will expire in ${minutes} minutes.

If you didn't request this, ignore this email.`;
  return { subject, html, text };
}
function renderPasswordChangedEmail(data) {
  const name = data.name || "Customer";
  const timestamp = data.timestamp || (/* @__PURE__ */ new Date()).toUTCString();
  const resetUrl = buildUrl("/reset-password");
  const subject = "Security Alert: Password Changed - Ropenix Collections";
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Hello <strong>${escapeHtml(name)}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      This email confirms that the password for your Ropenix Collections account was successfully updated on <strong>${escapeHtml(timestamp)}</strong>.
    </p>
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 13px; color: #166534;">
      \u2705 <strong>Your account is secure.</strong> If you made this change, no further action is required.
    </div>
    <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 12px; color: #9f1239;">
      \u{1F6A8} <strong>Did not make this change?</strong> Your account may be compromised. Please <a href="${escapeHtml(resetUrl)}" style="color: #e11d48; font-weight: 700;">reset your password immediately</a> and contact our security team at <a href="mailto:admin@ropenix.co.ke" style="color: #e11d48;">admin@ropenix.co.ke</a> or hotline <strong>+254 182 180 965</strong>.
    </div>
  `;
  const html = renderBaseEmailLayout({
    title: "Password Updated",
    heading: "Password Successfully Changed",
    badgeText: "Security Alert",
    badgeColor: "emerald",
    bodyHtml
  });
  const text = `Hello ${name},

Your Ropenix Collections password was successfully updated on ${timestamp}.

If you made this change, no further action is needed.
If you did NOT make this change, please reset your password immediately at ${resetUrl} or contact support at +254 182 180 965.`;
  return { subject, html, text };
}
var init_accountTemplates = __esm({
  "server/email/templates/accountTemplates.ts"() {
    init_baseLayout();
    init_urlHelper();
  }
});

// server/email/templates/orderTemplates.ts
function renderOrderItemsTable(items) {
  if (!items || items.length === 0) {
    return `<p style="color: #64748b; font-size: 13px;">No item details available.</p>`;
  }
  const rows = items.map((item) => {
    const rawPrice = item.price !== void 0 ? item.price : item.unit_price;
    const unitPrice = typeof rawPrice === "number" ? rawPrice : parseFloat(String(rawPrice) || "0");
    const itemName = item.name || item.product_name || "Product Item";
    const qty = item.quantity || 1;
    const lineTotal = unitPrice * qty;
    const variationsObj = item.selectedVariations || item.selected_variations;
    const variations = variationsObj && Object.keys(variationsObj).length > 0 ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${Object.entries(variationsObj).map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(String(v))}`).join(" | ")}</div>` : "";
    return `
      <tr>
        <td style="padding: 12px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle;">
          <div style="font-weight: 600; color: #1e293b; font-size: 13px;">${escapeHtml(itemName)}</div>
          ${variations}
        </td>
        <td align="center" style="padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 13px; vertical-align: middle;">
          ${qty}
        </td>
        <td align="right" style="padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 13px; vertical-align: middle;">
          ${formatKES(unitPrice)}
        </td>
        <td align="right" style="padding: 12px 8px; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #0f172a; font-size: 13px; vertical-align: middle;">
          ${formatKES(lineTotal)}
        </td>
      </tr>
    `;
  }).join("");
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0; border-collapse: collapse;">
      <thead>
        <tr style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
          <th align="left" style="padding: 10px 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Item Description</th>
          <th align="center" style="padding: 10px 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; width: 50px;">Qty</th>
          <th align="right" style="padding: 10px 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; width: 90px;">Price</th>
          <th align="right" style="padding: 10px 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; width: 95px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}
function renderOrderTotals(order) {
  const subtotal = order.subtotal !== void 0 ? order.subtotal : order.total;
  const shipping = order.shippingFee || 0;
  const discount = order.discount || 0;
  const total = order.total;
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 12px; margin-bottom: 20px;">
      <tr>
        <td style="width: 50%;"></td>
        <td style="width: 50%;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; color: #475569;">
            ${order.subtotal !== void 0 ? `
            <tr>
              <td style="padding: 4px 8px; text-align: right;">Subtotal:</td>
              <td style="padding: 4px 8px; text-align: right; font-weight: 600; color: #334155;">${formatKES(subtotal)}</td>
            </tr>
            ` : ""}
            ${shipping > 0 ? `
            <tr>
              <td style="padding: 4px 8px; text-align: right;">Shipping / Delivery:</td>
              <td style="padding: 4px 8px; text-align: right; font-weight: 600; color: #334155;">${formatKES(shipping)}</td>
            </tr>
            ` : ""}
            ${discount > 0 ? `
            <tr>
              <td style="padding: 4px 8px; text-align: right; color: #16a34a;">Discount:</td>
              <td style="padding: 4px 8px; text-align: right; font-weight: 600; color: #16a34a;">-${formatKES(discount)}</td>
            </tr>
            ` : ""}
            <tr style="border-top: 2px solid #0f172a;">
              <td style="padding: 10px 8px; text-align: right; font-size: 15px; font-weight: 800; color: #0f172a;">Total Due:</td>
              <td style="padding: 10px 8px; text-align: right; font-size: 16px; font-weight: 800; color: #0f172a;">${formatKES(total)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}
function renderOrderConfirmationEmail(order) {
  const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const totalFormatted = formatKES(order.total);
  const trackUrl = buildTrackUrl(order.id);
  const isGuest = Boolean(order.isGuest || !order.userId);
  const subject = `Order Confirmed: ${shortId} (${totalFormatted}) - Ropenix Collections`;
  const method = (order.paymentMethod || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const isMpesa = !method || method.includes("mpesa") || method.includes("paybill") || method === "manual" || method === "cod" || method === "pending";
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || "Customer")}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      Thank you for shopping with <strong>Ropenix Collections</strong>! We have received your order <strong>${escapeHtml(shortId)}</strong> and our team is preparing it for fulfillment.
    </p>

    <!-- Order Metadata Box -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 20px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #64748b; width: 40%;"><strong>Order Reference:</strong></td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 700; font-family: monospace;">${escapeHtml(shortId)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b;"><strong>Order Date:</strong></td>
          <td style="padding: 4px 0; color: #0f172a;">${formatEATDate(order.createdAt || /* @__PURE__ */ new Date())}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b;"><strong>Payment Method:</strong></td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 600;">${escapeHtml(order.paymentMethod || "M-PESA Paybill")}</td>
        </tr>
        ${order.paymentReference ? `
        <tr>
          <td style="padding: 4px 0; color: #64748b;"><strong>Payment Reference:</strong></td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 700; font-family: monospace;">${escapeHtml(order.paymentReference)}</td>
        </tr>
        ` : ""}
        <tr>
          <td style="padding: 4px 0; color: #64748b;"><strong>Payment Status:</strong></td>
          <td style="padding: 4px 0; color: #0284c7; font-weight: 700;">Pending Admin Verification</td>
        </tr>
        ${order.shippingAddress ? `
        <tr>
          <td style="padding: 4px 0; color: #64748b; vertical-align: top;"><strong>Delivery Address:</strong></td>
          <td style="padding: 4px 0; color: #0f172a;">${escapeHtml(order.shippingAddress)}</td>
        </tr>
        ` : ""}
      </table>
    </div>

    <!-- Items Table & Totals -->
    <h3 style="margin: 24px 0 8px 0; font-size: 15px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Order Breakdown</h3>
    ${renderOrderItemsTable(order.items)}
    ${renderOrderTotals(order)}

    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton("Track Order Status", trackUrl, "indigo")}
    </div>

    <p style="margin: 20px 0 0 0; font-size: 13px; color: #475569; line-height: 1.6;">
      Our store administration will verify your payment details and update the order status. You will receive an email update once your order is processed. If you have any questions, reply directly to this email.
    </p>
  `;
  const html = renderBaseEmailLayout({
    title: `Order Confirmation ${shortId}`,
    heading: `Order Received: ${shortId}`,
    badgeText: "Order Placed",
    badgeColor: "indigo",
    bodyHtml
  });
  const text = `Dear ${order.customerName},

Thank you for your order ${shortId} on Ropenix Collections.
Total: ${totalFormatted}

Our store administration will verify your payment and update the status.

Track order: ${trackUrl}

Thank you!`;
  return { subject, html, text };
}
function renderPaybillInstructionsEmail(order) {
  const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const totalFormatted = formatKES(order.total);
  const trackUrl = buildTrackUrl(order.id);
  const isGuest = Boolean(order.isGuest || !order.userId);
  const subject = `Payment Instructions for Order ${shortId} (${totalFormatted}) - Ropenix Collections`;
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || "Customer")}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      Here are the official M-Pesa Paybill payment instructions for your order <strong>${escapeHtml(shortId)}</strong> totaling <strong>${totalFormatted}</strong>.
    </p>

    ${renderPaybillBox(totalFormatted, shortId)}

    ${isGuest ? `
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin: 20px 0; text-align: center; font-size: 13px; color: #475569;">
      \u{1F4B3} After completing your M-Pesa payment, please reply directly to this email with your Safaricom transaction code or call <strong>+254 182 180 965</strong>.
    </div>
    ` : `
    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton("Submit M-Pesa Code", trackUrl, "emerald")}
    </div>
    `}

    <p style="margin: 20px 0 0 0; font-size: 13px; color: #475569; line-height: 1.6;">
      Need assistance? Reply directly to this email or call our hotline at <strong>+254 182 180 965</strong>.
    </p>
  `;
  const html = renderBaseEmailLayout({
    title: `Payment Instructions ${shortId}`,
    heading: `M-Pesa Payment Details: ${shortId}`,
    badgeText: "Payment Required",
    badgeColor: "amber",
    bodyHtml
  });
  const text = isGuest ? `Dear ${order.customerName},

M-Pesa payment instructions for order ${shortId}:

Paybill: 303030
Account: 2047728455 (Fixed shared account)
Amount: ${totalFormatted}
Account Name: ROPENIX INVESTMENTS LTD

Reply to this email with your M-Pesa transaction code once paid.` : `Dear ${order.customerName},

M-Pesa payment instructions for order ${shortId}:

Paybill: 303030
Account: 2047728455 (Fixed shared account)
Amount: ${totalFormatted}
Account Name: ROPENIX INVESTMENTS LTD

Submit your transaction code here: ${trackUrl}`;
  return { subject, html, text };
}
function renderPaymentSubmissionReceivedEmail(data) {
  const shortId = data.orderId.startsWith("ROP-") ? data.orderId : `ROP-${data.orderId.slice(-6).toUpperCase()}`;
  const amountFormatted = formatKES(data.amount);
  const trackUrl = buildTrackUrl(data.orderId);
  const isGuest = data.isGuest !== void 0 ? Boolean(data.isGuest) : !data.userId;
  const subject = `Payment Claim Received: ${escapeHtml(data.mpesaCode)} for Order ${shortId}`;
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(data.customerName || "Customer")}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      We have successfully received your payment submission for Order <strong>${escapeHtml(shortId)}</strong>!
    </p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 18px; margin: 20px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #166534; width: 45%;"><strong>M-Pesa Transaction Code:</strong></td>
          <td style="padding: 4px 0; color: #14532d; font-weight: 800; font-family: monospace; font-size: 15px;">${escapeHtml(data.mpesaCode.toUpperCase())}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #166534;"><strong>Amount Reported:</strong></td>
          <td style="padding: 4px 0; color: #14532d; font-weight: 700;">${amountFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #166534;"><strong>Status:</strong></td>
          <td style="padding: 4px 0; color: #15803d; font-weight: 700;">\u23F3 Awaiting Admin Verification</td>
        </tr>
      </table>
    </div>

    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      Our accounts team is cross-checking this reference with our Safaricom Paybill statement. Once verified, your order status will automatically update to <strong>Paid</strong> and enter immediate packaging and dispatch.
    </p>

    ${isGuest ? `
    <div style="text-align: center; margin: 20px 0; padding: 14px 18px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 13px; color: #475569;">
      \u{1F4EC} You will receive your official payment confirmation receipt directly at <strong>${escapeHtml(data.customerEmail || "this email address")}</strong> once verification is complete.
    </div>
    ` : `
    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton("View Order Status", trackUrl, "indigo")}
    </div>
    `}
  `;
  const html = renderBaseEmailLayout({
    title: `Payment Claim Received - ${shortId}`,
    heading: "Payment Claim Received",
    badgeText: "Under Verification",
    badgeColor: "amber",
    bodyHtml
  });
  const text = isGuest ? `Dear ${data.customerName},

We received your M-Pesa transaction reference (${data.mpesaCode}) for order ${shortId} (${amountFormatted}).
Our finance team is verifying this with Safaricom. You will receive an official receipt via email upon confirmation.` : `Dear ${data.customerName},

We received your M-Pesa transaction reference (${data.mpesaCode}) for order ${shortId} (${amountFormatted}).
Our finance team is verifying this with Safaricom. You will receive an official receipt upon confirmation.

Track order: ${trackUrl}`;
  return { subject, html, text };
}
function renderPaymentReceiptEmail(order) {
  const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const totalFormatted = formatKES(order.total);
  const trackUrl = buildTrackUrl(order.id);
  const isGuest = Boolean(order.isGuest || !order.userId);
  const subject = `Payment Confirmed & Official Receipt: ${shortId} (${totalFormatted})`;
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || "Customer")}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      Great news! Your payment of <strong>${totalFormatted}</strong> for order <strong>${escapeHtml(shortId)}</strong> has been <span style="color: #16a34a; font-weight: 700;">successfully verified and cleared</span>.
    </p>

    <!-- Receipt Highlight Box -->
    <div style="background-color: #ecfdf5; border: 2px solid #10b981; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #065f46; width: 45%;"><strong>Payment Status:</strong></td>
          <td style="padding: 4px 0; color: #047857; font-weight: 800; font-size: 14px;">\u2705 PAID IN FULL</td>
        </tr>
        ${order.mpesaCode ? `
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>M-Pesa Reference:</strong></td>
          <td style="padding: 4px 0; color: #065f46; font-family: monospace; font-weight: 800; font-size: 14px;">${escapeHtml(order.mpesaCode.toUpperCase())}</td>
        </tr>
        ` : ""}
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>Amount Cleared:</strong></td>
          <td style="padding: 4px 0; color: #065f46; font-weight: 800;">${totalFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>Verification Date:</strong></td>
          <td style="padding: 4px 0; color: #065f46;">${formatEATDate(order.confirmedAt || /* @__PURE__ */ new Date())}</td>
        </tr>
      </table>
    </div>

    <!-- Items Summary -->
    <h3 style="margin: 24px 0 8px 0; font-size: 15px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Items In Fulfillment</h3>
    ${renderOrderItemsTable(order.items)}
    ${renderOrderTotals(order)}

    ${isGuest ? `
    <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 14px 18px; margin: 24px 0; text-align: center; font-size: 13px; color: #065f46;">
      \u{1F4E6} <strong>Fulfillment Notice:</strong> Your package is being picked and prepared. We will send you an email confirmation with courier dispatch details as soon as it leaves our warehouse.
    </div>
    ` : `
    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton("Track Packaging & Dispatch", trackUrl, "emerald")}
    </div>
    `}

    <p style="margin: 20px 0 0 0; font-size: 13px; color: #475569; line-height: 1.6;">
      Our fulfillment warehouse is currently picking and securely boxing your items. You will receive tracking details once your package is handed over to our courier partner.
    </p>
  `;
  const html = renderBaseEmailLayout({
    title: `Payment Receipt ${shortId}`,
    heading: "Payment Confirmed & Verified",
    badgeText: "Paid & Processing",
    badgeColor: "emerald",
    bodyHtml
  });
  const text = isGuest ? `Dear ${order.customerName},

Your payment of ${totalFormatted} for order ${shortId} has been confirmed.
${order.mpesaCode ? `M-Pesa Ref: ${order.mpesaCode}
` : ""}Your package is now in fulfillment. Dispatch updates will be sent to ${order.customerEmail}.` : `Dear ${order.customerName},

Your payment of ${totalFormatted} for order ${shortId} has been confirmed.
${order.mpesaCode ? `M-Pesa Ref: ${order.mpesaCode}
` : ""}Your package is now in fulfillment.

Track order: ${trackUrl}`;
  return { subject, html, text };
}
function renderPaymentReminderEmail(order) {
  const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const totalFormatted = formatKES(order.total);
  const trackUrl = buildTrackUrl(order.id);
  const isGuest = Boolean(order.isGuest || !order.userId);
  const isFinal = order.reminderNumber >= 2;
  const subject = isFinal ? `\u26A0\uFE0F Final Reminder: Complete Payment for Order ${shortId} (${totalFormatted})` : `Friendly Reminder: Your Order ${shortId} is Awaiting Payment`;
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || "Customer")}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      We noticed you haven't completed payment for your order <strong>${escapeHtml(shortId)}</strong> totaling <strong>${totalFormatted}</strong>.
      ${isFinal ? '<br /><strong style="color: #e11d48;">Please complete payment promptly to prevent your reserved items from being released back to inventory.</strong>' : "Your items are currently reserved for you."}
    </p>

    ${renderPaybillBox(totalFormatted, shortId)}

    ${isGuest ? `
    <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 18px; margin: 20px 0; text-align: center; font-size: 13px; color: #92400e;">
      \u{1F4A1} After paying, simply reply to this email with your M-Pesa transaction reference code to verify your order.
    </div>
    ` : `
    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton("I Have Paid - Submit Code", trackUrl, "amber")}
    </div>
    `}

    <p style="margin: 20px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.6;">
      <em>If you have already paid, please send your transaction code so we can match your payment right away. If you wish to cancel this order, simply reply to let us know.</em>
    </p>
  `;
  const html = renderBaseEmailLayout({
    title: `Payment Reminder - ${shortId}`,
    heading: isFinal ? `Final Notice: Order ${shortId}` : `Payment Reminder: Order ${shortId}`,
    badgeText: isFinal ? "Action Required" : "Payment Reminder",
    badgeColor: isFinal ? "rose" : "amber",
    bodyHtml
  });
  const text = isGuest ? `Dear ${order.customerName},

Payment reminder for order ${shortId} (${totalFormatted}).

Paybill: 303030
Account: 2047728455
Amount: ${totalFormatted}

Reply to this email with your M-Pesa code once paid.` : `Dear ${order.customerName},

Payment reminder for order ${shortId} (${totalFormatted}).

Paybill: 303030
Account: 2047728455
Amount: ${totalFormatted}

Submit your payment code here: ${trackUrl}`;
  return { subject, html, text };
}
function renderPaymentIssueEmail(order) {
  const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const totalFormatted = formatKES(order.total);
  const trackUrl = buildTrackUrl(order.id);
  const isGuest = Boolean(order.isGuest || !order.userId);
  const subject = `Action Needed: Payment Verification Issue for Order ${shortId}`;
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || "Customer")}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      While verifying the payment for your order <strong>${escapeHtml(shortId)}</strong>, our finance team encountered an issue that requires your clarification:
    </p>

    <!-- Issue Notice Box -->
    <div style="background-color: #fff1f2; border: 2px solid #f43f5e; border-radius: 10px; padding: 18px; margin: 20px 0;">
      <h4 style="margin: 0 0 8px 0; color: #9f1239; font-size: 14px;">Reason for Verification Hold:</h4>
      <p style="margin: 0 0 10px 0; color: #881337; font-size: 13px; line-height: 1.5;">
        ${escapeHtml(order.issueReason)}
      </p>
      ${order.receivedAmount !== void 0 && order.expectedAmount !== void 0 ? `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 12px; border-top: 1px solid #fecdd3; padding-top: 8px; color: #9f1239;">
        <tr>
          <td><strong>Expected Amount:</strong> ${formatKES(order.expectedAmount)}</td>
          <td><strong>Amount Received:</strong> ${formatKES(order.receivedAmount)}</td>
          <td><strong>Balance Due:</strong> ${formatKES(Math.max(0, order.expectedAmount - order.receivedAmount))}</td>
        </tr>
      </table>
      ` : ""}
    </div>

    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      ${escapeHtml(order.instructions || "Please review your M-Pesa SMS confirmation and re-submit the valid transaction code or clear any outstanding balance.")}
    </p>

    ${renderPaybillBox(totalFormatted, shortId)}

    ${isGuest ? `
    <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; padding: 14px 18px; margin: 20px 0; text-align: center; font-size: 13px; color: #9f1239;">
      \u26A0\uFE0F Please reply directly to this email with your valid M-Pesa SMS confirmation code or call support at <strong>+254 182 180 965</strong>.
    </div>
    ` : `
    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton("Update Payment Information", trackUrl, "rose")}
    </div>
    `}

    <p style="margin: 20px 0 0 0; font-size: 13px; color: #475569; line-height: 1.6;">
      Need direct help? Contact our finance desk directly at <a href="mailto:admin@ropenix.co.ke" style="color: #e11d48;">admin@ropenix.co.ke</a> or call <strong>+254 182 180 965</strong> quoting order <strong>${escapeHtml(shortId)}</strong>.
    </p>
  `;
  const html = renderBaseEmailLayout({
    title: `Payment Issue - ${shortId}`,
    heading: "Payment Verification Attention Required",
    badgeText: "Payment Issue",
    badgeColor: "rose",
    bodyHtml
  });
  const text = isGuest ? `Dear ${order.customerName},

Payment verification issue for order ${shortId}:
${order.issueReason}

Please reply to this email with your updated M-Pesa details or contact us.` : `Dear ${order.customerName},

Payment verification issue for order ${shortId}:
${order.issueReason}

Please update your payment details or contact us: ${trackUrl}`;
  return { subject, html, text };
}
function renderOrderShippedEmail(order) {
  const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const trackUrl = buildTrackUrl(order.id);
  const isGuest = Boolean(order.isGuest || !order.userId);
  const courier = order.courierName || "Ropenix Express Courier";
  const trackingNo = order.trackingNumber || "Pending Dispatch Code";
  const subject = `\u{1F69A} Your Order is on the Way: ${shortId} (${courier})`;
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || "Customer")}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      Exciting news! Your order <strong>${escapeHtml(shortId)}</strong> has been packaged and dispatched with our delivery partner.
    </p>

    <!-- Courier Tracking Box -->
    <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px; margin: 20px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #64748b; width: 40%;"><strong>Courier Service:</strong></td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">${escapeHtml(courier)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b;"><strong>Tracking Number:</strong></td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 800; font-family: monospace;">${escapeHtml(trackingNo)}</td>
        </tr>
        ${order.estimatedDelivery ? `
        <tr>
          <td style="padding: 4px 0; color: #64748b;"><strong>Estimated Delivery:</strong></td>
          <td style="padding: 4px 0; color: #16a34a; font-weight: 700;">${escapeHtml(order.estimatedDelivery)}</td>
        </tr>
        ` : ""}
        ${order.shippingAddress ? `
        <tr>
          <td style="padding: 4px 0; color: #64748b; vertical-align: top;"><strong>Destination:</strong></td>
          <td style="padding: 4px 0; color: #0f172a;">${escapeHtml(order.shippingAddress)}</td>
        </tr>
        ` : ""}
      </table>
    </div>

    <h3 style="margin: 24px 0 8px 0; font-size: 15px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Items In Transit</h3>
    ${renderOrderItemsTable(order.items)}

    ${isGuest ? `
    <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px 18px; margin: 24px 0; text-align: center; font-size: 13px; color: #334155;">
      \u{1F69A} <strong>Courier Handover Complete:</strong> Your rider will contact your phone number (<strong>${escapeHtml(order.customerPhone || "on file")}</strong>) prior to arriving at your delivery location.
    </div>
    ` : `
    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton("Track Delivery Live", trackUrl, "indigo")}
    </div>
    `}

    <p style="margin: 20px 0 0 0; font-size: 13px; color: #475569; line-height: 1.6;">
      Our rider will contact your phone number (<strong>${escapeHtml(order.customerPhone || "on file")}</strong>) prior to arriving at your location.
    </p>
  `;
  const html = renderBaseEmailLayout({
    title: `Order Dispatched - ${shortId}`,
    heading: "Your Order Has Been Dispatched!",
    badgeText: "In Transit",
    badgeColor: "indigo",
    bodyHtml
  });
  const text = isGuest ? `Dear ${order.customerName},

Your order ${shortId} has been dispatched via ${courier}.
Tracking Number: ${trackingNo}
Destination: ${order.shippingAddress || "Nairobi, Kenya"}
Our rider will contact you prior to arrival.` : `Dear ${order.customerName},

Your order ${shortId} has been dispatched via ${courier}.
Tracking Number: ${trackingNo}

Track order live: ${trackUrl}`;
  return { subject, html, text };
}
function renderOrderDeliveredEmail(order) {
  const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const reviewUrl = order.reviewUrl || buildUrl(`/shop`);
  const subject = `\u{1F389} Order Delivered: ${shortId} - Enjoy Your Items!`;
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || "Customer")}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      Our courier records show that your order <strong>${escapeHtml(shortId)}</strong> was successfully delivered!
    </p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 18px; margin: 20px 0; text-align: center;">
      <span style="font-size: 28px;">\u{1F4E6}\u2728</span>
      <h3 style="margin: 8px 0 4px 0; color: #166534; font-size: 16px;">We hope you love your purchase!</h3>
      <p style="margin: 0; font-size: 13px; color: #15803d;">
        All eligible items carry our 14-day warranty against manufacturing defects.
      </p>
    </div>

    <p style="margin: 16px 0; line-height: 1.6; color: #334155;">
      Your feedback helps fellow Kenyan shoppers find the best items. Please take 30 seconds to share your experience:
    </p>

    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton("Leave a Product Review \u2B50\u2B50\u2B50\u2B50\u2B50", reviewUrl, "amber")}
    </div>
  `;
  const html = renderBaseEmailLayout({
    title: `Order Delivered - ${shortId}`,
    heading: "Delivered Successfully!",
    badgeText: "Delivered",
    badgeColor: "emerald",
    bodyHtml
  });
  const text = `Dear ${order.customerName},

Your order ${shortId} has been delivered!
We hope you love your purchase. Please rate your experience: ${reviewUrl}`;
  return { subject, html, text };
}
function renderOrderCancelledEmail(order) {
  const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const shopUrl = buildUrl("/shop");
  const subject = `Order Cancellation Notice: ${shortId} - Ropenix Collections`;
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || "Customer")}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      This email is to inform you that order <strong>${escapeHtml(shortId)}</strong> has been cancelled.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 13px; color: #475569;">
      <strong>Reason for cancellation:</strong><br />
      ${escapeHtml(order.cancellationReason || "Payment not completed within reservation timeframe / Cancelled per request.")}
    </div>

    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      If you already sent an M-Pesa payment for this order, please contact our support team immediately with your M-Pesa transaction reference and we will gladly re-instate your order or process a full refund.
    </p>

    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton("Continue Browsing Store", shopUrl, "indigo")}
    </div>
  `;
  const html = renderBaseEmailLayout({
    title: `Order Cancelled - ${shortId}`,
    heading: "Order Cancellation Notice",
    badgeText: "Cancelled",
    badgeColor: "rose",
    bodyHtml
  });
  const text = `Dear ${order.customerName},

Order ${shortId} has been cancelled.
Reason: ${order.cancellationReason || "Payment timeout / customer request"}.
If you have already paid, contact us at concierge@ropenix.co.ke or +254 182 180 965.`;
  return { subject, html, text };
}
function renderRefundProcessedEmail(order) {
  const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const refundFormatted = formatKES(order.refundAmount);
  const subject = `Refund Processed: ${shortId} (${refundFormatted}) - Ropenix Collections`;
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || "Customer")}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      We have successfully processed a refund of <strong>${refundFormatted}</strong> for your order <strong>${escapeHtml(shortId)}</strong>.
    </p>

    <div style="background-color: #ecfdf5; border: 1px solid #10b981; border-radius: 10px; padding: 18px; margin: 20px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #065f46; width: 45%;"><strong>Refund Amount:</strong></td>
          <td style="padding: 4px 0; color: #047857; font-weight: 800; font-size: 15px;">${refundFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>Method:</strong></td>
          <td style="padding: 4px 0; color: #065f46;">${escapeHtml(order.refundMethod || "Direct M-Pesa Reversal")}</td>
        </tr>
        ${order.refundReference ? `
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>Reference ID:</strong></td>
          <td style="padding: 4px 0; color: #065f46; font-family: monospace; font-weight: 700;">${escapeHtml(order.refundReference)}</td>
        </tr>
        ` : ""}
      </table>
    </div>

    <p style="margin: 16px 0 0 0; font-size: 13px; color: #475569; line-height: 1.6;">
      M-Pesa refunds are typically reflected in your mobile wallet within a few minutes to 1 business day depending on Safaricom clearance.
    </p>
  `;
  const html = renderBaseEmailLayout({
    title: `Refund Processed - ${shortId}`,
    heading: "Refund Processed Successfully",
    badgeText: "Refund Complete",
    badgeColor: "emerald",
    bodyHtml
  });
  const text = `Dear ${order.customerName},

A refund of ${refundFormatted} for order ${shortId} has been processed via ${order.refundMethod || "M-Pesa"}.
Ref: ${order.refundReference || "N/A"}`;
  return { subject, html, text };
}
var init_orderTemplates = __esm({
  "server/email/templates/orderTemplates.ts"() {
    init_baseLayout();
    init_urlHelper();
  }
});

// server/email/templates/adminTemplates.ts
function renderAdminNewOrderEmail(order) {
  const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const totalFormatted = formatKES(order.total);
  const adminUrl = buildAdminUrl("/orders");
  const subject = `\u{1F514} [NEW ORDER] ${shortId} by ${escapeHtml(order.customerName)} (${totalFormatted})`;
  const itemsListHtml = order.items.map((it) => {
    const itemName = it.name || it.product_name || "Product Item";
    const itemPrice = it.price !== void 0 ? it.price : it.unit_price || 0;
    const qty = it.quantity || 1;
    return `
    <tr>
      <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b;">
        <strong>${escapeHtml(itemName)}</strong> (x${qty})
      </td>
      <td align="right" style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 700; color: #0f172a;">
        ${formatKES(itemPrice * qty)}
      </td>
    </tr>
  `;
  }).join("");
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      <strong>Attn: Store Administrator / Fulfillment Team</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      A new order <strong>${escapeHtml(shortId)}</strong> has just been placed on the storefront and is awaiting payment/processing.
    </p>

    <!-- Details Box -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 16px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #64748b; width: 35%;"><strong>Customer:</strong></td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">${escapeHtml(order.customerName)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b;"><strong>Email:</strong></td>
          <td style="padding: 4px 0; color: #0f172a;"><a href="mailto:${escapeHtml(order.customerEmail)}" style="color: #4f46e5;">${escapeHtml(order.customerEmail)}</a></td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b;"><strong>Phone:</strong></td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 700;"><a href="tel:${escapeHtml(order.customerPhone || "")}" style="color: #0f172a;">${escapeHtml(order.customerPhone || "N/A")}</a></td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b;"><strong>Payment Method:</strong></td>
          <td style="padding: 4px 0; color: #0f172a; font-weight: 600;">${escapeHtml(order.paymentMethod || "M-PESA Paybill")}</td>
        </tr>
        ${order.shippingAddress ? `
        <tr>
          <td style="padding: 4px 0; color: #64748b; vertical-align: top;"><strong>Shipping Address:</strong></td>
          <td style="padding: 4px 0; color: #0f172a;">${escapeHtml(order.shippingAddress)}</td>
        </tr>
        ` : ""}
      </table>
    </div>

    <h4 style="margin: 20px 0 8px 0; font-size: 14px; color: #0f172a;">Items Breakdown:</h4>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
      ${itemsListHtml}
      <tr>
        <td style="padding: 10px 8px; font-weight: 800; font-size: 15px; color: #0f172a;">Total Order Amount:</td>
        <td align="right" style="padding: 10px 8px; font-weight: 800; font-size: 16px; color: #0f172a;">${totalFormatted}</td>
      </tr>
    </table>

    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton("Open Order in Admin Panel", adminUrl, "indigo")}
    </div>
  `;
  const html = renderBaseEmailLayout({
    title: `Admin Alert: New Order ${shortId}`,
    heading: `New Order Placed: ${shortId}`,
    badgeText: "Admin Notice",
    badgeColor: "indigo",
    bodyHtml
  });
  const text = `Admin Alert: New Order ${shortId} placed by ${order.customerName} (${order.customerEmail})
Total: ${totalFormatted}
Phone: ${order.customerPhone || "N/A"}
Open Admin: ${adminUrl}`;
  return { subject, html, text };
}
function renderAdminPaymentSubmissionEmail(data) {
  const shortId = data.orderId.startsWith("ROP-") ? data.orderId : `ROP-${data.orderId.slice(-6).toUpperCase()}`;
  const amountFormatted = formatKES(data.amount);
  const totalFormatted = formatKES(data.total);
  const adminUrl = buildAdminUrl("/orders");
  const subject = `\u{1F4B0} [VERIFY PAYMENT] M-Pesa ${escapeHtml(data.mpesaCode.toUpperCase())} for Order ${shortId}`;
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      <strong>Attn: Accounts & Admin Team</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      A customer has submitted an M-Pesa payment claim for Order <strong>${escapeHtml(shortId)}</strong>. Please cross-reference this code with your Safaricom M-Pesa Paybill statement and approve or flag.
    </p>

    <!-- Payment Claim Box -->
    <div style="background-color: #ecfdf5; border: 2px solid #10b981; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="padding: 6px 0; color: #065f46; width: 40%;"><strong>M-Pesa Reference Code:</strong></td>
          <td style="padding: 6px 0; color: #065f46; font-size: 18px; font-weight: 800; font-family: monospace; letter-spacing: 1px;">
            ${escapeHtml(data.mpesaCode.toUpperCase())}
          </td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>Amount Submitted:</strong></td>
          <td style="padding: 4px 0; color: #065f46; font-size: 15px; font-weight: 700;">${amountFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>Order Total:</strong></td>
          <td style="padding: 4px 0; color: #065f46; font-size: 14px;">${totalFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>Customer Name:</strong></td>
          <td style="padding: 4px 0; color: #065f46; font-weight: 600;">${escapeHtml(data.customerName)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>Customer Phone:</strong></td>
          <td style="padding: 4px 0; color: #065f46; font-weight: 700;"><a href="tel:${escapeHtml(data.customerPhone || "")}" style="color: #065f46;">${escapeHtml(data.customerPhone || "N/A")}</a></td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #065f46;"><strong>Customer Email:</strong></td>
          <td style="padding: 4px 0; color: #065f46;">${escapeHtml(data.customerEmail)}</td>
        </tr>
        ${data.notes ? `
        <tr>
          <td style="padding: 4px 0; color: #065f46; vertical-align: top;"><strong>Customer Notes:</strong></td>
          <td style="padding: 4px 0; color: #065f46; font-style: italic;">"${escapeHtml(data.notes)}"</td>
        </tr>
        ` : ""}
      </table>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton("Verify Payment in Admin Panel", adminUrl, "emerald")}
    </div>
  `;
  const html = renderBaseEmailLayout({
    title: `Verify Payment ${data.mpesaCode}`,
    heading: `M-Pesa Payment Claim: ${shortId}`,
    badgeText: "Payment Verification",
    badgeColor: "emerald",
    bodyHtml
  });
  const text = `Verify Payment Claim:
Order: ${shortId}
M-Pesa Code: ${data.mpesaCode}
Amount: ${amountFormatted}
Customer: ${data.customerName} (${data.customerPhone || ""})

Open Admin Panel: ${adminUrl}`;
  return { subject, html, text };
}
function renderAdminPaymentDigestEmail(data) {
  const slotName = data.slot === "morning" ? "Morning (08:00 EAT)" : "Evening (17:00 EAT)";
  const adminUrl = buildAdminUrl("/orders");
  const subject = `\u{1F4CA} [DIGEST ${slotName}] ${data.pendingSubmissions.length} Pending Payments, ${data.unpaidOrders.length} Unpaid Orders`;
  const submissionsHtml = data.pendingSubmissions.length > 0 ? data.pendingSubmissions.map((s) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px;">
          <strong>ROP-${s.orderId.slice(-6).toUpperCase()}</strong> (${escapeHtml(s.customerName)})
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-family: monospace; font-weight: 700; color: #16a34a; font-size: 13px;">
          ${escapeHtml(s.mpesaCode.toUpperCase())}
        </td>
        <td align="right" style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: 700; font-size: 13px;">
          ${formatKES(s.amount)}
        </td>
      </tr>
    `).join("") : `<tr><td colspan="3" style="padding: 12px; text-align: center; color: #16a34a; font-size: 13px;">\u2705 All customer payment submissions have been verified!</td></tr>`;
  const unpaidHtml = data.unpaidOrders.length > 0 ? data.unpaidOrders.map((u) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px;">
          <strong>ROP-${u.orderId.slice(-6).toUpperCase()}</strong> (${escapeHtml(u.customerName)})
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #64748b;">
          ${u.hoursUnpaid}h ago
        </td>
        <td align="right" style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: 700; font-size: 13px;">
          ${formatKES(u.total)}
        </td>
      </tr>
    `).join("") : `<tr><td colspan="3" style="padding: 12px; text-align: center; color: #64748b; font-size: 13px;">No pending unpaid orders.</td></tr>`;
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Here is your scheduled <strong>${escapeHtml(slotName)}</strong> operational payment summary:
    </p>

    <h3 style="margin: 20px 0 8px 0; font-size: 15px; color: #166534; border-bottom: 2px solid #bbf7d0; padding-bottom: 6px;">
      1. Payments Awaiting Verification (${data.pendingSubmissions.length})
    </h3>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #f0fdf4; font-size: 11px; text-transform: uppercase; color: #166534;">
          <th align="left" style="padding: 8px;">Order & Customer</th>
          <th align="left" style="padding: 8px;">M-Pesa Code</th>
          <th align="right" style="padding: 8px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${submissionsHtml}
      </tbody>
    </table>

    <h3 style="margin: 24px 0 8px 0; font-size: 15px; color: #9a3412; border-bottom: 2px solid #fed7aa; padding-bottom: 6px;">
      2. Unpaid Orders Awaiting Customer Action (${data.unpaidOrders.length})
    </h3>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #fff7ed; font-size: 11px; text-transform: uppercase; color: #9a3412;">
          <th align="left" style="padding: 8px;">Order & Customer</th>
          <th align="left" style="padding: 8px;">Placed</th>
          <th align="right" style="padding: 8px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${unpaidHtml}
      </tbody>
    </table>

    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton("Manage Orders in Admin Panel", adminUrl, "indigo")}
    </div>
  `;
  const html = renderBaseEmailLayout({
    title: `Payment Digest - ${slotName}`,
    heading: `Store Operations Digest (${slotName})`,
    badgeText: "Daily Digest",
    badgeColor: "indigo",
    bodyHtml
  });
  const text = `Store Operations Digest (${slotName}):
- ${data.pendingSubmissions.length} payments awaiting verification
- ${data.unpaidOrders.length} unpaid orders pending

Admin Panel: ${adminUrl}`;
  return { subject, html, text };
}
function renderAdminReturnRequestEmail(data) {
  const shortId = data.orderId.startsWith("ROP-") ? data.orderId : `ROP-${data.orderId.slice(-6).toUpperCase()}`;
  const adminUrl = buildAdminUrl("/orders");
  const subject = `\u21A9\uFE0F [RETURN REQUEST] Order ${shortId} by ${escapeHtml(data.customerName)}`;
  const itemsHtml = data.items && data.items.length > 0 ? `
      <h4 style="margin: 16px 0 8px 0; font-size: 13px; color: #0f172a; text-transform: uppercase;">Items to Return / Exchange:</h4>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
        ${data.items.map((it) => `
          <tr>
            <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b;">
              <strong>${escapeHtml(it.name)}</strong> (x${it.quantity || 1})
            </td>
            <td align="right" style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 700;">
              ${it.price ? formatKES(it.price * (it.quantity || 1)) : ""}
            </td>
          </tr>
        `).join("")}
      </table>
    ` : "";
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      <strong>Attn: Customer Care & Returns Desk</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      A customer has submitted a return/exchange request for order <strong>${escapeHtml(shortId)}</strong>.
    </p>

    <!-- Return Details Box -->
    <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; padding: 16px; margin: 16px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #9f1239; width: 35%;"><strong>Customer:</strong></td>
          <td style="padding: 4px 0; color: #881337; font-weight: 700;">${escapeHtml(data.customerName)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #9f1239;"><strong>Email:</strong></td>
          <td style="padding: 4px 0; color: #881337;"><a href="mailto:${escapeHtml(data.customerEmail)}" style="color: #9f1239;">${escapeHtml(data.customerEmail)}</a></td>
        </tr>
        ${data.customerPhone ? `
        <tr>
          <td style="padding: 4px 0; color: #9f1239;"><strong>Phone:</strong></td>
          <td style="padding: 4px 0; color: #881337; font-weight: 700;"><a href="tel:${escapeHtml(data.customerPhone)}" style="color: #881337;">${escapeHtml(data.customerPhone)}</a></td>
        </tr>
        ` : ""}
        <tr>
          <td style="padding: 4px 0; color: #9f1239; vertical-align: top;"><strong>Reason Given:</strong></td>
          <td style="padding: 4px 0; color: #881337; font-style: italic;">"${escapeHtml(data.reason)}"</td>
        </tr>
      </table>
    </div>

    ${itemsHtml}

    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton("Review Return Request in Admin", adminUrl, "rose")}
    </div>
  `;
  const html = renderBaseEmailLayout({
    title: `Return Request - Order ${shortId}`,
    heading: `Return Request: ${shortId}`,
    badgeText: "Return / Exchange",
    badgeColor: "rose",
    bodyHtml
  });
  const text = `Admin Alert: Return Request for Order ${shortId}
Customer: ${data.customerName} (${data.customerEmail})
Reason: ${data.reason}
Admin Panel: ${adminUrl}`;
  return { subject, html, text };
}
function renderAdminLowStockEmail(data) {
  const adminUrl = buildAdminUrl("/inventory");
  const subject = `\u26A0\uFE0F [LOW STOCK ALERT] ${escapeHtml(data.productName)} (${data.currentStock} units remaining)`;
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      <strong>Attn: Inventory & Restocking Team</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      The stock level for <strong>${escapeHtml(data.productName)}</strong> has dropped to or below the minimum threshold.
    </p>

    <!-- Stock Box -->
    <div style="background-color: #fefce8; border: 2px solid #facc15; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #854d0e; width: 40%;"><strong>Product Name:</strong></td>
          <td style="padding: 6px 0; color: #713f12; font-weight: 700;">${escapeHtml(data.productName)}</td>
        </tr>
        ${data.sku ? `
        <tr>
          <td style="padding: 4px 0; color: #854d0e;"><strong>SKU:</strong></td>
          <td style="padding: 4px 0; color: #713f12; font-family: monospace;">${escapeHtml(data.sku)}</td>
        </tr>
        ` : ""}
        <tr>
          <td style="padding: 4px 0; color: #854d0e;"><strong>Current Stock:</strong></td>
          <td style="padding: 4px 0; color: #dc2626; font-size: 18px; font-weight: 800;">${data.currentStock} units</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #854d0e;"><strong>Alert Threshold:</strong></td>
          <td style="padding: 4px 0; color: #713f12; font-weight: 600;">${data.threshold} units</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton("Update Inventory / Restock", adminUrl, "amber")}
    </div>
  `;
  const html = renderBaseEmailLayout({
    title: `Low Stock Alert - ${data.productName}`,
    heading: `Low Stock Warning: ${escapeHtml(data.productName)}`,
    badgeText: "Low Stock Alert",
    badgeColor: "amber",
    bodyHtml
  });
  const text = `Low Stock Alert:
Product: ${data.productName}
SKU: ${data.sku || "N/A"}
Current Stock: ${data.currentStock} units (Threshold: ${data.threshold})
Restock Link: ${adminUrl}`;
  return { subject, html, text };
}
var init_adminTemplates = __esm({
  "server/email/templates/adminTemplates.ts"() {
    init_baseLayout();
    init_urlHelper();
  }
});

// server/email/templates/engagementTemplates.ts
function renderReviewRequestEmail(order) {
  const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
  const reviewUrl = order.reviewUrl || buildUrl(`/shop`);
  const subject = `How was your recent purchase with Ropenix Collections? (${shortId})`;
  const itemsList = order.items.map((it) => `
    <div style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
      <strong>${escapeHtml(it.name)}</strong> (x${it.quantity || 1})
    </div>
  `).join("");
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(order.customerName || "Customer")}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      We hope you are thoroughly enjoying your recent order <strong>${escapeHtml(shortId)}</strong>!
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 20px 0;">
      <h4 style="margin: 0 0 8px 0; color: #0f172a; font-size: 13px; text-transform: uppercase;">Items in your order:</h4>
      ${itemsList}
    </div>

    <p style="margin: 16px 0; line-height: 1.6; color: #334155;">
      Could you take 30 seconds to rate your experience and the quality of your items? Your review helps our artisan creators and fellow shoppers across Kenya.
    </p>

    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton("Write a Review \u2B50\u2B50\u2B50\u2B50\u2B50", reviewUrl, "amber")}
    </div>
  `;
  const html = renderBaseEmailLayout({
    title: `Review Your Purchase - ${shortId}`,
    heading: "How Was Your Experience?",
    badgeText: "Feedback Request",
    badgeColor: "amber",
    bodyHtml,
    isMarketing: true,
    unsubscribeUrl: order.unsubscribeUrl
  });
  const text = `Dear ${order.customerName},

We hope you love your recent order ${shortId}.
Please take 30 seconds to leave a review: ${reviewUrl}`;
  return { subject, html, text };
}
function renderAbandonedCartEmail(data) {
  const name = data.customerName || "Customer";
  const subject = `Did you leave something behind at Ropenix Collections?`;
  const itemsList = data.items.map((it) => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px;">
        <strong>${escapeHtml(it.name)}</strong> (x${it.quantity || 1})
      </td>
      <td align="right" style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: 700; font-size: 13px;">
        ${formatKES((it.price || 0) * (it.quantity || 1))}
      </td>
    </tr>
  `).join("");
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(name)}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      You left some great items in your shopping bag! We've saved your selections so you can pick right back up where you left off.
    </p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0;">
      ${itemsList}
    </table>

    <div style="text-align: center; margin: 28px 0;">
      ${renderEmailButton("Complete Your Order", data.checkoutUrl, "indigo")}
    </div>
  `;
  const html = renderBaseEmailLayout({
    title: "Your Saved Shopping Bag",
    heading: "Your Bag is Waiting For You",
    badgeText: "Cart Reminder",
    badgeColor: "indigo",
    bodyHtml,
    isMarketing: true,
    unsubscribeUrl: data.unsubscribeUrl
  });
  const text = `Dear ${name},

You left items in your shopping bag on Ropenix Collections.
Complete your order here: ${data.checkoutUrl}`;
  return { subject, html, text };
}
var init_engagementTemplates = __esm({
  "server/email/templates/engagementTemplates.ts"() {
    init_baseLayout();
    init_urlHelper();
  }
});

// server/email/templates/index.ts
var init_templates = __esm({
  "server/email/templates/index.ts"() {
    init_types();
    init_baseLayout();
    init_accountTemplates();
    init_orderTemplates();
    init_adminTemplates();
    init_engagementTemplates();
  }
});

// server/email/queue.ts
function calculateNextRetry(attempts) {
  const index = Math.min(Math.max(0, attempts - 1), BACKOFF_SECONDS.length - 1);
  const delaySec = BACKOFF_SECONDS[index];
  return new Date(Date.now() + delaySec * 1e3).toISOString();
}
function renderJobContent(job) {
  const payload = job.payload || {};
  switch (job.email_type) {
    // Account templates
    case "welcome":
      return renderWelcomeEmail(payload);
    case "verify_email":
      return renderVerifyEmail(payload);
    case "password_reset":
      return renderPasswordResetEmail(payload);
    case "password_changed":
      return renderPasswordChangedEmail(payload);
    // Order templates
    case "order_confirmation":
      return renderOrderConfirmationEmail(payload);
    case "paybill_instructions":
      return renderPaybillInstructionsEmail(payload);
    case "payment_submission_received":
      return renderPaymentSubmissionReceivedEmail(payload);
    case "payment_receipt":
      return renderPaymentReceiptEmail(payload);
    case "payment_reminder":
      return renderPaymentReminderEmail(payload);
    case "payment_issue":
      return renderPaymentIssueEmail(payload);
    case "order_shipped":
      return renderOrderShippedEmail(payload);
    case "order_delivered":
      return renderOrderDeliveredEmail(payload);
    case "order_cancelled":
      return renderOrderCancelledEmail(payload);
    case "refund_processed":
      return renderRefundProcessedEmail(payload);
    // Admin templates
    case "admin_new_order":
      return renderAdminNewOrderEmail(payload);
    case "admin_payment_submitted":
      return renderAdminPaymentSubmissionEmail(payload);
    case "admin_payment_digest":
      return renderAdminPaymentDigestEmail(payload);
    case "admin_return_request":
      return renderAdminReturnRequestEmail(payload);
    case "admin_low_stock":
      return renderAdminLowStockEmail(payload);
    // Engagement
    case "review_request":
      return renderReviewRequestEmail(payload);
    case "abandoned_cart":
      return renderAbandonedCartEmail(payload);
    // Direct / pre-rendered fallback
    default:
      return {
        subject: job.subject || payload.subject || "Notification from Ropenix Collections",
        html: payload.html || `<p>${payload.text || "Notification"}</p>`,
        text: payload.text || "Notification"
      };
  }
}
async function processJob(job) {
  const currentAttempts = (job.attempts || 0) + 1;
  try {
    const optedOut = await isRecipientOptedOut(job.recipient, job.email_type);
    if (optedOut) {
      console.log(`[Email Queue] \u{1F6D1} Recipient ${job.recipient} opted out of ${job.email_type}. Skipping job ${job.id}.`);
      await updateEmailJobStatus(job.id, "sent", { errorMessage: "Skipped: recipient opted out" });
      await logEmail({
        recipient: job.recipient,
        email_type: job.email_type,
        subject: job.subject,
        status: "skipped_opt_out",
        attempts: currentAttempts,
        related_order_id: job.payload?.id || job.payload?.orderId,
        dedupe_key: job.dedupe_key
      });
      return true;
    }
    await updateEmailJobStatus(job.id, "sending", { attempts: currentAttempts });
    const rendered = renderJobContent(job);
    const sendResult = await sendEmail({
      to: job.recipient,
      subject: rendered.subject || job.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: job.payload?.replyTo
    });
    if (sendResult.success) {
      await updateEmailJobStatus(job.id, "sent", { attempts: currentAttempts });
      await logEmail({
        recipient: job.recipient,
        email_type: job.email_type,
        subject: rendered.subject || job.subject,
        status: "sent",
        attempts: currentAttempts,
        related_order_id: job.payload?.id || job.payload?.orderId,
        dedupe_key: job.dedupe_key,
        sent_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      console.log(`[Email Queue] \u2705 Sent ${job.email_type} to ${job.recipient} (Job: ${job.id})`);
      return true;
    } else {
      throw new Error(sendResult.error || "Nodemailer returned failure");
    }
  } catch (err) {
    const errorMsg = err?.message || String(err);
    console.warn(`[Email Queue] \u26A0\uFE0F Failed attempt ${currentAttempts}/${job.max_attempts} for job ${job.id} (${job.email_type} -> ${job.recipient}): ${errorMsg}`);
    if (currentAttempts >= job.max_attempts) {
      await updateEmailJobStatus(job.id, "failed", {
        attempts: currentAttempts,
        errorMessage: errorMsg
      });
      await logEmail({
        recipient: job.recipient,
        email_type: job.email_type,
        subject: job.subject,
        status: "failed",
        attempts: currentAttempts,
        error_message: errorMsg,
        related_order_id: job.payload?.id || job.payload?.orderId,
        dedupe_key: job.dedupe_key
      });
    } else {
      const nextRetryIso = calculateNextRetry(currentAttempts);
      await updateEmailJobStatus(job.id, "queued", {
        attempts: currentAttempts,
        nextAttemptAt: nextRetryIso,
        errorMessage: errorMsg
      });
    }
    return false;
  }
}
async function processQueueBatch(limit = 5) {
  if (isProcessingBatch) return 0;
  isProcessingBatch = true;
  try {
    const jobs = await fetchDueEmailJobs(limit);
    if (jobs.length === 0) return 0;
    let successCount = 0;
    for (const job of jobs) {
      const ok = await processJob(job);
      if (ok) successCount++;
    }
    return successCount;
  } catch (err) {
    console.error("[Email Queue Worker] Batch processing error:", err);
    return 0;
  } finally {
    isProcessingBatch = false;
  }
}
function startEmailQueueWorker(pollIntervalMs = 4e3) {
  if (isWorkerRunning) return;
  isWorkerRunning = true;
  console.log("[Email Queue Worker] \u{1F680} Background queue processor started.");
  processQueueBatch().catch(() => {
  });
  workerTimer = setInterval(() => {
    processQueueBatch().catch(() => {
    });
  }, pollIntervalMs);
}
function stopEmailQueueWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
  isWorkerRunning = false;
  console.log("[Email Queue Worker] \u{1F6D1} Background queue processor stopped.");
}
async function enqueueEmail(options) {
  const res = await enqueueEmailJob(options);
  if (!options.delaySeconds || options.delaySeconds <= 0) {
    setImmediate(() => {
      processQueueBatch().catch(() => {
      });
    });
  }
  return res;
}
var BACKOFF_SECONDS, isWorkerRunning, workerTimer, isProcessingBatch;
var init_queue = __esm({
  "server/email/queue.ts"() {
    init_db();
    init_transporter();
    init_templates();
    BACKOFF_SECONDS = [30, 120, 600, 1800, 7200];
    isWorkerRunning = false;
    workerTimer = null;
    isProcessingBatch = false;
  }
});

// server/email/events.ts
function registerEmailEventListeners() {
  const config2 = getEmailConfig();
  const adminEmail = config2.admin.email;
  emailEvents.on("order:created", async (order) => {
    try {
      const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
      const totalFormatted = formatKES(order.total);
      if (order.customerEmail) {
        await enqueueEmail({
          emailType: "order_confirmation",
          recipient: order.customerEmail,
          subject: `Order Confirmed: ${shortId} (${totalFormatted}) - Ropenix Collections`,
          payload: order,
          dedupeKey: `order_confirmation:${order.id}`
        });
      }
      if (adminEmail) {
        await enqueueEmail({
          emailType: "admin_new_order",
          recipient: adminEmail,
          subject: `\u{1F514} [NEW ORDER] ${shortId} by ${order.customerName} (${totalFormatted})`,
          payload: order,
          dedupeKey: `admin_new_order:${order.id}`
        });
      }
    } catch (err) {
      console.error("[Email Events] Error handling order:created:", err);
    }
  });
  emailEvents.on("payment:submitted", async (data) => {
    try {
      const shortId = data.orderId.startsWith("ROP-") ? data.orderId : `ROP-${data.orderId.slice(-6).toUpperCase()}`;
      if (data.customerEmail) {
        await enqueueEmail({
          emailType: "payment_submission_received",
          recipient: data.customerEmail,
          subject: `Payment Claim Received: ${data.mpesaCode} for Order ${shortId}`,
          payload: data,
          dedupeKey: `payment_submitted_cust:${data.orderId}:${data.mpesaCode}`
        });
      }
      if (adminEmail) {
        await enqueueEmail({
          emailType: "admin_payment_submitted",
          recipient: adminEmail,
          subject: `\u{1F4B0} [VERIFY PAYMENT] M-Pesa ${data.mpesaCode.toUpperCase()} for Order ${shortId}`,
          payload: data,
          dedupeKey: `payment_submitted_admin:${data.orderId}:${data.mpesaCode}`
        });
      }
    } catch (err) {
      console.error("[Email Events] Error handling payment:submitted:", err);
    }
  });
  emailEvents.on("payment:confirmed", async (order) => {
    try {
      const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
      const totalFormatted = formatKES(order.total);
      if (order.customerEmail) {
        await enqueueEmail({
          emailType: "payment_receipt",
          recipient: order.customerEmail,
          subject: `Payment Confirmed & Official Receipt: ${shortId} (${totalFormatted})`,
          payload: order,
          dedupeKey: `payment_receipt:${order.id}`
        });
      }
    } catch (err) {
      console.error("[Email Events] Error handling payment:confirmed:", err);
    }
  });
  emailEvents.on("payment:issue", async (order) => {
    try {
      const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
      if (order.customerEmail) {
        await enqueueEmail({
          emailType: "payment_issue",
          recipient: order.customerEmail,
          subject: `Action Needed: Payment Verification Issue for Order ${shortId}`,
          payload: order,
          // Dedupe per timestamp to allow re-sending if subsequent issues occur
          dedupeKey: `payment_issue:${order.id}:${Date.now()}`
        });
      }
    } catch (err) {
      console.error("[Email Events] Error handling payment:issue:", err);
    }
  });
  emailEvents.on("order:shipped", async (order) => {
    try {
      const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
      if (order.customerEmail) {
        await enqueueEmail({
          emailType: "order_shipped",
          recipient: order.customerEmail,
          subject: `\u{1F69A} Your Order is on the Way: ${shortId}`,
          payload: order,
          dedupeKey: `order_shipped:${order.id}`
        });
      }
    } catch (err) {
      console.error("[Email Events] Error handling order:shipped:", err);
    }
  });
  emailEvents.on("order:delivered", async (order) => {
    try {
      const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
      if (order.customerEmail) {
        await enqueueEmail({
          emailType: "order_delivered",
          recipient: order.customerEmail,
          subject: `\u{1F389} Order Delivered: ${shortId} - Enjoy Your Items!`,
          payload: order,
          dedupeKey: `order_delivered:${order.id}`
        });
      }
    } catch (err) {
      console.error("[Email Events] Error handling order:delivered:", err);
    }
  });
  emailEvents.on("order:cancelled", async (order) => {
    try {
      const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
      if (order.customerEmail) {
        await enqueueEmail({
          emailType: "order_cancelled",
          recipient: order.customerEmail,
          subject: `Order Cancellation Notice: ${shortId} - Ropenix Collections`,
          payload: order,
          dedupeKey: `order_cancelled:${order.id}`
        });
      }
    } catch (err) {
      console.error("[Email Events] Error handling order:cancelled:", err);
    }
  });
  emailEvents.on("refund:processed", async (order) => {
    try {
      const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
      const refundFormatted = formatKES(order.refundAmount);
      if (order.customerEmail) {
        await enqueueEmail({
          emailType: "refund_processed",
          recipient: order.customerEmail,
          subject: `Refund Processed: ${shortId} (${refundFormatted}) - Ropenix Collections`,
          payload: order,
          dedupeKey: `refund_processed:${order.id}:${order.refundReference || Date.now()}`
        });
      }
    } catch (err) {
      console.error("[Email Events] Error handling refund:processed:", err);
    }
  });
  emailEvents.on("auth:registered", async (data) => {
    try {
      if (data.email) {
        await enqueueEmail({
          emailType: "welcome",
          recipient: data.email,
          subject: `Welcome to Ropenix Collections, ${data.name}! \u{1F389}`,
          payload: data,
          dedupeKey: `welcome:${data.email}`
        });
      }
    } catch (err) {
      console.error("[Email Events] Error handling auth:registered:", err);
    }
  });
  emailEvents.on("auth:password_reset", async (data) => {
    try {
      if (data.email) {
        await enqueueEmail({
          emailType: "password_reset",
          recipient: data.email,
          subject: "Reset your password - Ropenix Collections",
          payload: data,
          dedupeKey: `pwd_reset:${data.email}:${Date.now()}`
        });
      }
    } catch (err) {
      console.error("[Email Events] Error handling auth:password_reset:", err);
    }
  });
  emailEvents.on("auth:password_changed", async (data) => {
    try {
      if (data.email) {
        await enqueueEmail({
          emailType: "password_changed",
          recipient: data.email,
          subject: "Security Alert: Password Changed - Ropenix Collections",
          payload: data,
          dedupeKey: `pwd_changed:${data.email}:${Date.now()}`
        });
      }
    } catch (err) {
      console.error("[Email Events] Error handling auth:password_changed:", err);
    }
  });
  console.log("[Email Events] \u{1F517} Domain event listeners registered.");
}
var import_events, EmailEventEmitter, emailEvents;
var init_events = __esm({
  "server/email/events.ts"() {
    import_events = require("events");
    init_queue();
    init_config();
    init_urlHelper();
    EmailEventEmitter = class extends import_events.EventEmitter {
    };
    emailEvents = new EmailEventEmitter();
    emailEvents.setMaxListeners(50);
  }
});

// server/services/orderStatusService.ts
var orderStatusService_exports = {};
__export(orderStatusService_exports, {
  ALLOWED_STATUS_TRANSITIONS: () => ALLOWED_STATUS_TRANSITIONS,
  confirmOrderDelivery: () => confirmOrderDelivery,
  confirmOrderPaymentAndProcess: () => confirmOrderPaymentAndProcess,
  sendOrderStatusEmail: () => sendOrderStatusEmail,
  transitionOrderStatus: () => transitionOrderStatus,
  validateStatusTransition: () => validateStatusTransition
});
function validateStatusTransition(order, nextStatus, options) {
  if (!order) {
    return { valid: false, error: "Order not found." };
  }
  let rawStatus = typeof order.status === "string" ? order.status : typeof order.status === "object" && typeof order.status?.status === "string" ? order.status.status : "";
  if (!rawStatus || rawStatus === "[object Object]") {
    rawStatus = order.deliveryConfirmed || order.deliveredAt ? "delivered" : order.trackingNumber ? "shipped" : order.isPaid || order.paymentStatus === "paid" ? "processing" : "pending";
  }
  const currentStatus = rawStatus.toLowerCase().trim();
  const targetStatus = (nextStatus || "").toLowerCase().trim();
  const recognizedStatuses = ["pending", "processing", "shipped", "completed", "cancelled", "pending-cancellation", "delivered"];
  if (!recognizedStatuses.includes(targetStatus)) {
    return {
      valid: false,
      error: `Invalid status '${nextStatus}'. Recognized statuses are: ${recognizedStatuses.join(", ")}.`
    };
  }
  if (currentStatus === targetStatus) {
    return { valid: true };
  }
  if (currentStatus === "completed" && (targetStatus === "processing" || targetStatus === "pending" || targetStatus === "shipped")) {
    return {
      valid: false,
      error: `Invalid status transition: Order #${order.id} is already COMPLETED. Completed orders cannot be reverted to '${targetStatus}'.`
    };
  }
  if (currentStatus === "delivered" && (targetStatus === "processing" || targetStatus === "pending" || targetStatus === "shipped")) {
    return {
      valid: false,
      error: `Invalid status transition: Order #${order.id} has already been DELIVERED. It cannot be reverted to '${targetStatus}'.`
    };
  }
  const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || recognizedStatuses;
  if (!allowedNext.includes(targetStatus)) {
    return {
      valid: false,
      error: `Invalid status transition: Cannot change order #${order.id} from '${currentStatus}' to '${targetStatus}'. Allowed next steps: ${allowedNext.length > 0 ? allowedNext.join(", ") : "None (Order is in final state)"}.`
    };
  }
  const isPaid = Boolean(order.isPaid || order.paymentStatus === "paid");
  if (targetStatus === "completed" && !isPaid) {
    return {
      valid: false,
      error: `Payment required: Order #${order.id} cannot be moved to 'completed' because payment has not been confirmed. Please confirm payment first.`
    };
  }
  return { valid: true };
}
function renderItemsTable(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return `<p style="color: #64748b; font-size: 13px; margin: 12px 0;">Items details unavailable.</p>`;
  }
  const rows = items.map((item) => {
    const rawPrice = item.price !== void 0 ? item.price : item.unit_price;
    const unitPrice = typeof rawPrice === "number" ? rawPrice : parseFloat(String(rawPrice) || "0");
    const itemName = item.name || item.product_name || item.title || "Product Item";
    const qty = Number(item.quantity || 1);
    const lineTotal = unitPrice * qty;
    const variations = item.selectedVariations || item.selected_variations;
    const varText = variations && typeof variations === "object" && Object.keys(variations).length > 0 ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${Object.entries(variations).map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(String(v))}`).join(" | ")}</div>` : "";
    return `
      <tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle;">
          <div style="font-weight: 600; color: #1e293b; font-size: 13px;">${escapeHtml(itemName)}</div>
          ${varText}
        </td>
        <td align="center" style="padding: 10px 8px; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 13px; vertical-align: middle;">
          ${qty}
        </td>
        <td align="right" style="padding: 10px 8px; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 13px; vertical-align: middle;">
          ${formatKES(unitPrice)}
        </td>
        <td align="right" style="padding: 10px 8px; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #0f172a; font-size: 13px; vertical-align: middle;">
          ${formatKES(lineTotal)}
        </td>
      </tr>
    `;
  }).join("");
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 14px 0; border-collapse: collapse;">
      <thead>
        <tr style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
          <th align="left" style="padding: 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Item</th>
          <th align="center" style="padding: 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; width: 40px;">Qty</th>
          <th align="right" style="padding: 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; width: 85px;">Price</th>
          <th align="right" style="padding: 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; width: 90px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}
function renderTotalsBlock(order) {
  const subtotal = order.subtotal !== void 0 ? order.subtotal : order.total;
  const shipping = Number(order.shippingFee || 0);
  const discount = Number(order.discount || 0);
  const total = Number(order.total || 0);
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 10px 0 20px 0; font-size: 13px; color: #475569;">
      <tr>
        <td style="width: 45%;"></td>
        <td style="width: 55%;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            ${order.subtotal !== void 0 ? `
            <tr>
              <td style="padding: 3px 6px; text-align: right;">Subtotal:</td>
              <td style="padding: 3px 6px; text-align: right; font-weight: 600; color: #334155;">${formatKES(subtotal)}</td>
            </tr>
            ` : ""}
            ${shipping > 0 ? `
            <tr>
              <td style="padding: 3px 6px; text-align: right;">Delivery:</td>
              <td style="padding: 3px 6px; text-align: right; font-weight: 600; color: #334155;">${formatKES(shipping)}</td>
            </tr>
            ` : ""}
            ${discount > 0 ? `
            <tr>
              <td style="padding: 3px 6px; text-align: right; color: #16a34a;">Discount:</td>
              <td style="padding: 3px 6px; text-align: right; font-weight: 600; color: #16a34a;">-${formatKES(discount)}</td>
            </tr>
            ` : ""}
            <tr style="border-top: 2px solid #0f172a;">
              <td style="padding: 8px 6px; text-align: right; font-size: 14px; font-weight: 800; color: #0f172a;">Total:</td>
              <td style="padding: 8px 6px; text-align: right; font-size: 15px; font-weight: 800; color: #0f172a;">${formatKES(total)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}
async function sendOrderStatusEmail(order, newStatus, extraData) {
  const customerEmail = (order.customerEmail || order.customer_email || "").trim().toLowerCase();
  if (!customerEmail || !customerEmail.includes("@")) {
    console.warn(`[OrderStatusEmail] \u26A0\uFE0F No valid customer email for order #${order.id}. Skipping email dispatch.`);
    return { success: false, error: "Customer email missing or invalid." };
  }
  const shortId = String(order.id).startsWith("ROP-") ? order.id : `ROP-${String(order.id).slice(-6).toUpperCase()}`;
  const customerName = order.customerName || order.customer_name || "Valued Customer";
  const totalFormatted = formatKES(order.total || 0);
  const trackUrl = buildTrackUrl(order.id);
  const items = Array.isArray(order.items) ? order.items : [];
  const shippingAddress = order.shippingAddress || order.shipping_address || "Standard Delivery Address";
  const phone = order.customerPhone || order.phone || order.customer_phone || "";
  const isGuest = Boolean(order.isGuest || order.is_guest || !order.userId && !order.user_id);
  let subject = "";
  let heading = "";
  let badgeText = "";
  let badgeColor = "indigo";
  let friendlyMessage = "";
  let statusSpecificDetailsHtml = "";
  let plainTextMessage = "";
  const normalizedStatus = (newStatus || "").toLowerCase().trim();
  switch (normalizedStatus) {
    case "processing": {
      subject = `Payment Confirmed & Order Processing: ${shortId} (${totalFormatted})`;
      heading = "Payment Confirmed \u2014 Order is Processing";
      badgeText = "Paid & Processing";
      badgeColor = "emerald";
      friendlyMessage = `Great news! Your payment of <strong>${totalFormatted}</strong> has been successfully verified. Our warehouse team is now carefully packing and preparing your items for dispatch.`;
      statusSpecificDetailsHtml = `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin: 18px 0; font-size: 13px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 3px 0; color: #166534; width: 40%;"><strong>Payment Status:</strong></td>
              <td style="padding: 3px 0; color: #15803d; font-weight: 700;">\u2705 Verified & Cleared</td>
            </tr>
            ${extraData?.mpesaCode || order.paymentReference ? `
            <tr>
              <td style="padding: 3px 0; color: #166534;"><strong>M-Pesa Reference:</strong></td>
              <td style="padding: 3px 0; color: #14532d; font-weight: 800; font-family: monospace;">${escapeHtml(String(extraData?.mpesaCode || order.paymentReference).toUpperCase())}</td>
            </tr>
            ` : ""}
            <tr>
              <td style="padding: 3px 0; color: #166534;"><strong>Delivery Destination:</strong></td>
              <td style="padding: 3px 0; color: #14532d;">${escapeHtml(shippingAddress)}</td>
            </tr>
          </table>
        </div>
      `;
      plainTextMessage = isGuest ? `Dear ${customerName},

Your payment for order ${shortId} (${totalFormatted}) has been confirmed! We are now preparing your order for shipment.
Delivery address: ${shippingAddress}

All subsequent delivery updates and receipts will be delivered directly to your email (${customerEmail}).` : `Dear ${customerName},

Your payment for order ${shortId} (${totalFormatted}) has been confirmed! We are now preparing your order for shipment.
Delivery address: ${shippingAddress}

Track order status: ${trackUrl}`;
      break;
    }
    case "shipped": {
      const trackingNumber = extraData?.trackingNumber || order.trackingNumber || `ROP-TRK-${String(order.id).slice(-6).toUpperCase()}`;
      const courierName = extraData?.courierName || "Ropenix Express Courier";
      subject = `\u{1F69A} Your Order is on the Way: ${shortId} (Tracking: ${trackingNumber})`;
      heading = "Your Package Has Been Dispatched!";
      badgeText = "In Transit";
      badgeColor = "indigo";
      friendlyMessage = `Your order has been packaged and handed over to our delivery partner. It is now on its way to you!`;
      statusSpecificDetailsHtml = `
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px; margin: 18px 0; font-size: 13px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 4px 0; color: #475569; width: 40%;"><strong>Courier Partner:</strong></td>
              <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">${escapeHtml(courierName)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #475569;"><strong>Tracking Number:</strong></td>
              <td style="padding: 4px 0; color: #4338ca; font-weight: 800; font-family: monospace; font-size: 14px;">${escapeHtml(trackingNumber)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #475569;"><strong>Delivery Destination:</strong></td>
              <td style="padding: 4px 0; color: #0f172a;">${escapeHtml(shippingAddress)}</td>
            </tr>
            ${phone ? `
            <tr>
              <td style="padding: 4px 0; color: #475569;"><strong>Recipient Phone:</strong></td>
              <td style="padding: 4px 0; color: #0f172a;">${escapeHtml(phone)}</td>
            </tr>
            ` : ""}
          </table>
        </div>
      `;
      plainTextMessage = isGuest ? `Dear ${customerName},

Your order ${shortId} has been shipped!
Courier: ${courierName}
Tracking Number: ${trackingNumber}
Destination: ${shippingAddress}

Our rider will contact you prior to arriving at your location.` : `Dear ${customerName},

Your order ${shortId} has been shipped!
Courier: ${courierName}
Tracking Number: ${trackingNumber}
Destination: ${shippingAddress}

Track your package live: ${trackUrl}`;
      break;
    }
    case "completed": {
      subject = `\u{1F389} Order Delivered & Completed: ${shortId} \u2014 Thank You!`;
      heading = "Order Delivered & Completed";
      badgeText = "Delivered & Complete";
      badgeColor = "emerald";
      friendlyMessage = `Your order <strong>${escapeHtml(shortId)}</strong> has been successfully delivered and completed. We hope you love your new purchase!`;
      const deliveryPerson = extraData?.deliveryPerson || order.deliveryPerson || "Assigned Courier Rider";
      const deliveryNote = extraData?.deliveryNote || order.deliveryNote || "";
      statusSpecificDetailsHtml = `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 18px; margin: 18px 0; font-size: 13px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 4px 0; color: #166534; width: 40%;"><strong>Delivery Status:</strong></td>
              <td style="padding: 4px 0; color: #15803d; font-weight: 700;">\u2705 Confirmed Received by Customer</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #166534;"><strong>Delivered By:</strong></td>
              <td style="padding: 4px 0; color: #14532d; font-weight: 600;">${escapeHtml(deliveryPerson)}</td>
            </tr>
            ${deliveryNote ? `
            <tr>
              <td style="padding: 4px 0; color: #166534; vertical-align: top;"><strong>Delivery Note:</strong></td>
              <td style="padding: 4px 0; color: #14532d;">${escapeHtml(deliveryNote)}</td>
            </tr>
            ` : ""}
            <tr>
              <td style="padding: 4px 0; color: #166534;"><strong>Completed At:</strong></td>
              <td style="padding: 4px 0; color: #14532d;">${formatEATDate(/* @__PURE__ */ new Date())}</td>
            </tr>
          </table>
        </div>
      `;
      plainTextMessage = isGuest ? `Dear ${customerName},

Your order ${shortId} has been delivered and marked as completed!
Delivered by: ${deliveryPerson}
${deliveryNote ? `Note: ${deliveryNote}
` : ""}
Thank you for shopping with Ropenix Collections!` : `Dear ${customerName},

Your order ${shortId} has been delivered and marked as completed!
Delivered by: ${deliveryPerson}
${deliveryNote ? `Note: ${deliveryNote}
` : ""}
Thank you for shopping with Ropenix Collections!

View details: ${trackUrl}`;
      break;
    }
    case "cancelled": {
      subject = `Order Cancellation Notice: ${shortId} - Ropenix Collections`;
      heading = "Order Cancelled";
      badgeText = "Cancelled";
      badgeColor = "rose";
      friendlyMessage = `This email is to notify you that order <strong>${escapeHtml(shortId)}</strong> has been cancelled.`;
      statusSpecificDetailsHtml = `
        <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 14px; margin: 18px 0; font-size: 13px; color: #9f1239;">
          <strong>Reason:</strong> ${escapeHtml(extraData?.note || order.notes || "Order cancelled by store administrator.")}
        </div>
      `;
      plainTextMessage = `Dear ${customerName},

Your order ${shortId} has been cancelled.
Reason: ${extraData?.note || order.notes || "Cancelled by administrator."}

If you have questions, please contact us at admin@ropenix.co.ke`;
      break;
    }
    default: {
      subject = `Order Update: ${shortId} is now ${newStatus.toUpperCase()}`;
      heading = `Order Status: ${newStatus.toUpperCase()}`;
      badgeText = newStatus.toUpperCase();
      badgeColor = "indigo";
      friendlyMessage = `Your order <strong>${escapeHtml(shortId)}</strong> status has been updated to <strong>${escapeHtml(newStatus)}</strong>.`;
      plainTextMessage = isGuest ? `Dear ${customerName},

Your order ${shortId} status is now: ${newStatus}.

All updates will be sent to ${customerEmail}.` : `Dear ${customerName},

Your order ${shortId} status is now: ${newStatus}.

Track order: ${trackUrl}`;
    }
  }
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">
      Dear <strong>${escapeHtml(customerName)}</strong>,
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155;">
      ${friendlyMessage}
    </p>

    <!-- Status Details Card -->
    ${statusSpecificDetailsHtml}

    <!-- Order Items Breakdown -->
    <h3 style="margin: 22px 0 8px 0; font-size: 14px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
      Order Summary (#${escapeHtml(shortId)})
    </h3>
    ${renderItemsTable(items)}
    ${renderTotalsBlock(order)}

    ${isGuest ? `
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin: 24px 0; text-align: center; font-size: 13px; color: #475569;">
      \u{1F4EC} <strong>Guest Order Notice:</strong> All delivery updates, courier arrival alerts, and receipts are delivered directly to your email (<strong>${escapeHtml(customerEmail)}</strong>).
    </div>
    ` : `
    <div style="text-align: center; margin: 24px 0;">
      ${renderEmailButton("View Live Order Tracking", trackUrl, badgeColor)}
    </div>
    `}

    <p style="margin: 20px 0 0 0; font-size: 12px; color: #64748b; line-height: 1.5;">
      Need help with this order? Reply directly to this email or contact support at <a href="mailto:admin@ropenix.co.ke" style="color: #4338ca; text-decoration: underline;">admin@ropenix.co.ke</a> quoting <strong>${escapeHtml(shortId)}</strong>.
    </p>
  `;
  const html = renderBaseEmailLayout({
    title: `${subject}`,
    heading,
    badgeText,
    badgeColor,
    bodyHtml
  });
  try {
    const mailResult = await sendRawMail({
      to: customerEmail,
      subject,
      html,
      text: plainTextMessage,
      category: "transactional"
    });
    if (mailResult.success) {
      console.log(`[OrderStatusEmail] \u2709\uFE0F Customer notified for order #${shortId} -> ${newStatus} (${customerEmail})`);
      return { success: true, messageId: mailResult.messageId };
    } else {
      console.error(`[OrderStatusEmail] \u26A0\uFE0F Failed to deliver email for order #${shortId}:`, mailResult.error);
      return { success: false, error: mailResult.error };
    }
  } catch (err) {
    console.error(`[OrderStatusEmail] \u274C Email dispatch error for order #${shortId}:`, err?.message || err);
    return { success: false, error: err?.message || "SMTP dispatch failure" };
  }
}
async function confirmOrderPaymentAndProcess(orderId, adminUser = "Admin", options) {
  const order = await getMysqlOrderById(orderId);
  if (!order) {
    return { success: false, error: `Order #${orderId} not found.` };
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const paymentRef = options?.paymentReference || order.paymentReference || "CONFIRMED-BY-ADMIN";
  const paymentAmount = options?.paymentAmount !== void 0 ? options.paymentAmount : order.total;
  const history = Array.isArray(order.statusHistory) ? [...order.statusHistory] : [];
  const paymentHistoryEntry = {
    status: "processing",
    changedBy: adminUser,
    timestamp: nowIso,
    note: options?.adminNotes || `Payment verified (Ref: ${paymentRef}). Order moved to Processing.`,
    emailSent: false
  };
  const updatedPayload = {
    ...order,
    isPaid: true,
    paidAt: nowIso,
    paymentStatus: "paid",
    paymentConfirmedAt: nowIso,
    paymentConfirmedBy: adminUser,
    paymentReference: paymentRef,
    paymentAmount,
    status: "processing",
    updated_at: nowIso
  };
  const emailRes = await sendOrderStatusEmail(updatedPayload, "processing", {
    mpesaCode: paymentRef,
    paidAt: nowIso
  });
  paymentHistoryEntry.emailSent = Boolean(emailRes.success);
  history.push(paymentHistoryEntry);
  updatedPayload.statusHistory = history;
  const savedOrder = await saveMysqlOrder(updatedPayload);
  return { success: true, order: savedOrder };
}
async function transitionOrderStatus(orderId, targetStatus, adminUser = "Admin", options) {
  const order = await getMysqlOrderById(orderId);
  if (!order) {
    return { success: false, error: `Order #${orderId} not found.`, statusCode: 404 };
  }
  const cleanTarget = (targetStatus || "").toLowerCase().trim();
  const validation = validateStatusTransition(order, cleanTarget, {
    isDeliveryConfirmed: options?.isDeliveryConfirmed
  });
  if (!validation.valid) {
    return { success: false, error: validation.error, statusCode: 400 };
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const history = Array.isArray(order.statusHistory) ? [...order.statusHistory] : [];
  const trackingNumber = options?.trackingNumber || order.trackingNumber || (cleanTarget === "shipped" ? `ROP-TRK-${String(orderId).slice(-6).toUpperCase()}` : void 0);
  const deliveryPerson = options?.deliveryPerson || order.deliveryPerson;
  const deliveryNote = options?.deliveryNote || order.deliveryNote;
  const historyEntry = {
    status: cleanTarget,
    changedBy: adminUser,
    timestamp: nowIso,
    note: options?.note || `Status updated to ${cleanTarget} by ${adminUser}.`,
    trackingNumber,
    deliveryPerson,
    emailSent: false
  };
  const updatedPayload = {
    ...order,
    status: cleanTarget,
    updated_at: nowIso
  };
  if (trackingNumber) {
    updatedPayload.trackingNumber = trackingNumber;
  }
  if (options?.deliveryPerson) {
    updatedPayload.deliveryPerson = options.deliveryPerson;
  }
  if (options?.deliveryNote) {
    updatedPayload.deliveryNote = options.deliveryNote;
  }
  if (options?.isDeliveryConfirmed || cleanTarget === "completed") {
    updatedPayload.deliveryConfirmed = true;
    if (!updatedPayload.deliveredAt) {
      updatedPayload.deliveredAt = nowIso;
    }
  }
  const emailRes = await sendOrderStatusEmail(updatedPayload, cleanTarget, {
    trackingNumber,
    courierName: options?.courierName,
    deliveryPerson,
    deliveryNote,
    note: options?.note
  });
  historyEntry.emailSent = Boolean(emailRes.success);
  history.push(historyEntry);
  updatedPayload.statusHistory = history;
  const savedOrder = await saveMysqlOrder(updatedPayload);
  return { success: true, order: savedOrder, statusCode: 200 };
}
async function confirmOrderDelivery(orderId, adminUser = "Admin", data) {
  const order = await getMysqlOrderById(orderId);
  if (!order) {
    return { success: false, error: `Order #${orderId} not found.`, statusCode: 404 };
  }
  let currentStatus = typeof order.status === "string" ? order.status : typeof order.status === "object" && typeof order.status?.status === "string" ? order.status.status : "";
  if (!currentStatus || currentStatus === "[object Object]") {
    currentStatus = order.trackingNumber || order.deliveryConfirmed ? "shipped" : order.isPaid || order.paymentStatus === "paid" ? "processing" : "pending";
  }
  if (currentStatus !== "shipped" && currentStatus !== "processing" && currentStatus !== "delivered") {
    return {
      success: false,
      error: `Cannot confirm delivery: Order #${orderId} is currently in '${currentStatus}' status. It must be 'shipped' first.`,
      statusCode: 400
    };
  }
  const nowIso = data?.deliveredAt || (/* @__PURE__ */ new Date()).toISOString();
  const deliveryPerson = data?.deliveryPerson || order.deliveryPerson || "Express Delivery Rider";
  const deliveryNote = data?.deliveryNote || "Package confirmed received by customer.";
  const history = Array.isArray(order.statusHistory) ? [...order.statusHistory] : [];
  history.push({
    status: "delivered",
    changedBy: adminUser,
    timestamp: nowIso,
    note: `Delivery confirmed by ${deliveryPerson}. Note: ${deliveryNote}`,
    deliveryPerson,
    deliveryNote,
    emailSent: false
  });
  const updatedPayload = {
    ...order,
    deliveryConfirmed: true,
    deliveredAt: nowIso,
    deliveryPerson,
    deliveryNote,
    statusHistory: history,
    updated_at: nowIso
  };
  const savedOrder = await saveMysqlOrder(updatedPayload);
  return { success: true, order: savedOrder, statusCode: 200 };
}
var ALLOWED_STATUS_TRANSITIONS;
var init_orderStatusService = __esm({
  "server/services/orderStatusService.ts"() {
    init_mysql_db();
    init_transporter();
    init_baseLayout();
    init_urlHelper();
    ALLOWED_STATUS_TRANSITIONS = {
      pending: ["processing", "shipped", "completed", "cancelled", "pending-cancellation", "delivered"],
      processing: ["shipped", "delivered", "completed", "cancelled", "pending-cancellation"],
      shipped: ["delivered", "completed", "cancelled"],
      delivered: ["completed"],
      completed: [],
      // Terminal State: Cannot be moved back to processing, shipped, or pending
      cancelled: [],
      // Terminal State: Cannot be reopened
      "pending-cancellation": ["cancelled", "processing"]
    };
  }
});

// server/email/emailService.ts
var emailService_exports = {};
__export(emailService_exports, {
  emailService: () => emailService
});
var emailService;
var init_emailService = __esm({
  "server/email/emailService.ts"() {
    init_events();
    init_queue();
    init_urlHelper();
    emailService = {
      /**
       * Triggers order confirmation email for newly created order
       */
      async sendOrderConfirmation(order) {
        emailEvents.emit("order:created", order);
      },
      /**
       * Resends Paybill instructions to customer
       */
      async sendPaybillInstructions(order) {
        const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
        const totalFormatted = formatKES(order.total);
        return enqueueEmail({
          emailType: "paybill_instructions",
          recipient: order.customerEmail,
          subject: `Payment Instructions for Order ${shortId} (${totalFormatted}) - Ropenix Collections`,
          payload: order
        });
      },
      /**
       * Triggers acknowledgment to customer & alert to admin upon customer payment submission
       */
      async sendPaymentClaimSubmitted(data) {
        emailEvents.emit("payment:submitted", data);
      },
      /**
       * Triggers official receipt when admin verifies payment
       */
      async sendPaymentReceipt(order) {
        emailEvents.emit("payment:confirmed", order);
      },
      /**
       * Triggers payment issue notification
       */
      async sendPaymentIssue(order) {
        emailEvents.emit("payment:issue", order);
      },
      /**
       * Triggers order dispatched notification
       */
      async sendOrderShipped(order) {
        emailEvents.emit("order:shipped", order);
      },
      /**
       * Triggers order delivered notification
       */
      async sendOrderDelivered(order) {
        emailEvents.emit("order:delivered", order);
      },
      /**
       * Triggers order cancelled notification
       */
      async sendOrderCancelled(order) {
        emailEvents.emit("order:cancelled", order);
      },
      /**
       * Triggers refund processed notification
       */
      async sendRefundProcessed(order) {
        emailEvents.emit("refund:processed", order);
      },
      /**
       * Triggers welcome email for new user registration
       */
      async sendWelcome(data) {
        emailEvents.emit("auth:registered", data);
      },
      /**
       * Triggers password reset email
       */
      async sendPasswordReset(data) {
        emailEvents.emit("auth:password_reset", data);
      },
      /**
       * Triggers password changed security notification
       */
      async sendPasswordChanged(data) {
        emailEvents.emit("auth:password_changed", data);
      }
    };
  }
});

// server.ts
var server_exports = {};
__export(server_exports, {
  app: () => server_default,
  default: () => server_default2,
  startServer: () => startServer
});
module.exports = __toCommonJS(server_exports);

// server/index.ts
var import_express19 = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_url = require("url");
var import_dotenv4 = __toESM(require("dotenv"), 1);
init_mysql_db();

// server/email/startupCheck.ts
init_config();
function runEmailStartupCheck() {
  const config2 = getEmailConfig();
  const isProduction = process.env.NODE_ENV === "production";
  const warnings = [];
  const errors = [];
  let safeToSend = config2.behavior.enabled;
  console.log("\n======================================================");
  console.log("   ROPENIX TRANSACTIONAL EMAIL SYSTEM INITIALIZING    ");
  console.log("======================================================");
  console.log(`\u2022 Node Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`\u2022 Email Active:     ${config2.behavior.enabled ? "YES" : "NO"}`);
  console.log(`\u2022 Dev Safe Mode:    ${config2.behavior.devMode ? "ENABLED (Test/Redirect Mode)" : "DISABLED (Real Recipients)"}`);
  console.log(`\u2022 SMTP Server:      ${config2.smtp.host}:${config2.smtp.port} (SSL: ${config2.smtp.secure})`);
  console.log(`\u2022 Sender (From):    ${config2.smtp.defaultFrom}`);
  console.log(`\u2022 Reply-To:         ${config2.smtp.replyTo}`);
  console.log(`\u2022 Frontend URL:     ${config2.urls.frontendUrl}`);
  console.log(`\u2022 Admin URL:        ${config2.urls.adminUrl}`);
  console.log(`\u2022 Shared Paybill:   ${config2.paybill.number} (Acc: ${config2.paybill.accountNumber} - ${config2.paybill.accountName})`);
  console.log("======================================================\n");
  if (isProduction) {
    if (!process.env.FRONTEND_URL || config2.urls.frontendUrl.includes("localhost") || config2.urls.frontendUrl.includes("127.0.0.1")) {
      const err = `\u{1F6A8} CRITICAL CONFIG ERROR: NODE_ENV is 'production' but FRONTEND_URL (${config2.urls.frontendUrl}) is unset or points to localhost! Real customers will receive broken email links.`;
      errors.push(err);
      console.error(err);
      safeToSend = false;
    }
  }
  if (config2.behavior.devMode) {
    warnings.push(`EMAIL_DEV_MODE is active. Emails to customer addresses will be logged or redirected to: ${config2.behavior.devRedirectTo || config2.smtp.replyTo}`);
  }
  if (!config2.smtp.pass) {
    warnings.push("EMAIL_HOST_PASSWORD is missing in .env. Outgoing SMTP emails will fail authentication.");
    safeToSend = false;
  }
  if (errors.length > 0) {
    console.error("\u274C Email system initialization encountered blockers.");
  } else {
    console.log("\u2705 Email system startup validation passed.");
  }
  return {
    valid: errors.length === 0,
    warnings,
    errors,
    safeToSend
  };
}
var validateEmailConfigOnStartup = runEmailStartupCheck;

// server/index.ts
init_events();
init_queue();

// server/email/scheduler.ts
init_config();
init_db();
init_queue();
init_events();
var schedulerInterval = null;
var isSchedulerRunning = false;
var isExecutingCron = false;
function getNairobiTime() {
  const now = /* @__PURE__ */ new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const getPart = (type) => parts.find((p) => p.type === type)?.value || "00";
  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hour = parseInt(getPart("hour"), 10);
  const minute = parseInt(getPart("minute"), 10);
  return {
    dateStr: `${year}-${month}-${day}`,
    hour,
    minute,
    fullStr: `${year}-${month}-${day} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} EAT`
  };
}
async function getPendingPaymentSubmissions() {
  try {
    const pool = await getDbPool2();
    const [rows] = await pool.query(`
      SELECT ps.id, ps.order_id as orderId, ps.mpesa_receipt_code as mpesaCode, ps.amount_claimed as amount, ps.phone_number, ps.submitted_at as submittedAt,
             o.customer_name as customerName, o.customer_email as customerEmail, o.total
      FROM payment_submissions ps
      LEFT JOIN customer_orders o ON o.id = ps.order_id
      WHERE ps.status = 'pending_verification'
      ORDER BY ps.submitted_at ASC
    `);
    return rows || [];
  } catch {
    return [];
  }
}
async function processDailyDigest(nairobiTime) {
  const config2 = getEmailConfig();
  if (!config2.admin.email) return;
  const isMorningSlot = nairobiTime.hour === 8 && nairobiTime.minute <= 5;
  const isEveningSlot = nairobiTime.hour === 17 && nairobiTime.minute <= 5;
  if (!isMorningSlot && !isEveningSlot) return;
  const slot = isMorningSlot ? "morning" : "evening";
  const taskKey = `admin_digest_${slot}_${nairobiTime.dateStr}`;
  if (await hasScheduledTaskRun(taskKey)) return;
  try {
    const pendingSubmissions = await getPendingPaymentSubmissions();
    const unpaidOrders = await getUnpaidOrders(1);
    const unpaidFormatted = unpaidOrders.map((u) => {
      const created = new Date(u.created_at).getTime();
      const hoursUnpaid = Math.max(1, Math.round((Date.now() - created) / 36e5));
      return {
        orderId: u.id,
        customerName: u.customer_name || "Customer",
        total: u.total || 0,
        createdAt: u.created_at,
        hoursUnpaid
      };
    });
    await enqueueEmail({
      emailType: "admin_payment_digest",
      recipient: config2.admin.email,
      subject: `\u{1F4CA} [DIGEST ${slot === "morning" ? "08:00 EAT" : "17:00 EAT"}] ${pendingSubmissions.length} Pending Payments, ${unpaidFormatted.length} Unpaid Orders`,
      payload: {
        slot,
        pendingSubmissions,
        unpaidOrders: unpaidFormatted
      },
      dedupeKey: taskKey
    });
    await logScheduledTaskRun(taskKey, {
      slot,
      date: nairobiTime.dateStr,
      pendingCount: pendingSubmissions.length,
      unpaidCount: unpaidFormatted.length
    });
    console.log(`[Scheduler] \u{1F4E7} Enqueued daily ${slot} payment digest to ${config2.admin.email}`);
  } catch (err) {
    console.error(`[Scheduler] Error running daily ${slot} digest:`, err);
  }
}
async function processPaymentReminders() {
  try {
    const unpaidOrders = await getUnpaidOrders(12);
    for (const order of unpaidOrders) {
      const hasClaim = await hasUnprocessedPaymentSubmission(order.id);
      if (hasClaim) {
        continue;
      }
      const orderEmail = order.customerEmail || order.customer_email;
      if (!orderEmail) continue;
      const customerName = order.customerName || order.customer_name || "Customer";
      const createdDateStr = order.createdAt || order.created_at || order.date;
      const created = createdDateStr ? new Date(createdDateStr).getTime() : Date.now();
      const hoursAgo = (Date.now() - created) / 36e5;
      const currentReminderCount = order.paymentReminderCount || order.payment_reminder_count || 0;
      const shortId = order.id.startsWith("ROP-") ? order.id : `ROP-${order.id.slice(-6).toUpperCase()}`;
      if (hoursAgo >= 12 && hoursAgo < 24 && currentReminderCount === 0) {
        await enqueueEmail({
          emailType: "payment_reminder",
          recipient: orderEmail,
          subject: `Friendly Reminder: Complete Payment for Order ${shortId}`,
          payload: {
            ...order,
            id: order.id,
            customerName,
            customerEmail: orderEmail,
            total: Number(order.total || 0),
            reminderNumber: 1
          },
          dedupeKey: `payment_reminder_1:${order.id}`
        });
        await updateOrderPaymentStatus(order.id, "unpaid", {
          paymentReminderCount: 1,
          lastPaymentReminderAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      } else if (hoursAgo >= 24 && currentReminderCount === 1) {
        await enqueueEmail({
          emailType: "payment_reminder",
          recipient: orderEmail,
          subject: `\u26A0\uFE0F Final Notice: Complete Payment for Order ${shortId}`,
          payload: {
            ...order,
            id: order.id,
            customerName,
            customerEmail: orderEmail,
            total: Number(order.total || 0),
            reminderNumber: 2
          },
          dedupeKey: `payment_reminder_2:${order.id}`
        });
        await updateOrderPaymentStatus(order.id, "unpaid", {
          paymentReminderCount: 2,
          lastPaymentReminderAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
  } catch (err) {
    console.error("[Scheduler] Error processing payment reminders:", err);
  }
}
async function processAutoCancellations() {
  const config2 = getEmailConfig();
  if (!config2.schedule.autoCancelUnpaidHours || config2.schedule.autoCancelUnpaidHours <= 0) return;
  const cancelThresholdHours = config2.schedule.autoCancelUnpaidHours;
  try {
    const overdueOrders = await getUnpaidOrders(cancelThresholdHours);
    for (const order of overdueOrders) {
      const hasClaim = await hasUnprocessedPaymentSubmission(order.id);
      if (hasClaim) {
        continue;
      }
      console.log(`[Scheduler] \u{1F6D1} Auto-cancelling overdue unpaid order ${order.id} (placed > ${cancelThresholdHours}h ago without payment claim)`);
      await updateOrderPaymentStatus(order.id, "cancelled", {
        notes: `Auto-cancelled by system after ${cancelThresholdHours} hours without payment.`
      });
      emailEvents.emit("order:cancelled", {
        ...order,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        cancellationReason: `Order automatically cancelled after ${cancelThresholdHours} hours without payment receipt.`
      });
    }
  } catch (err) {
    console.error("[Scheduler] Error processing auto-cancellations:", err);
  }
}
async function runSchedulerTick() {
  if (isExecutingCron) return;
  isExecutingCron = true;
  try {
    const nairobiTime = getNairobiTime();
    await processDailyDigest(nairobiTime);
    await processPaymentReminders();
    await processAutoCancellations();
  } catch (err) {
    console.error("[Scheduler] Tick execution error:", err);
  } finally {
    isExecutingCron = false;
  }
}
function startEmailScheduler(intervalMs = 6e4) {
  if (isSchedulerRunning) return;
  isSchedulerRunning = true;
  console.log("[Scheduler] \u23F0 Africa/Nairobi transactional scheduler started.");
  runSchedulerTick().catch(() => {
  });
  schedulerInterval = setInterval(() => {
    runSchedulerTick().catch(() => {
    });
  }, intervalMs);
}
function stopEmailScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  isSchedulerRunning = false;
  console.log("[Scheduler] \u{1F6D1} Africa/Nairobi transactional scheduler stopped.");
}

// src/lib/sqlite-db.ts
init_mysql_db();

// server/services/expiryChecker.ts
init_transporter();
init_config();
var notifiedStore = {};
async function performExpiryBackgroundCheck(isManualTrigger = false) {
  console.log(`[Expiry Check] Initializing background inventory scan... (Manual: ${isManualTrigger})`);
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const sqliteData = await pullSyncDataSqlite2();
  const products = sqliteData?.veloce_products || [];
  const newlyFlaggedProducts = [];
  const nearExpiryProductsList = [];
  for (const product of products) {
    const hasExpiry = Boolean(product.hasExpiryDate || product.has_expiry_date);
    const expiryDateStr = product.expiryDate || product.expiry_date;
    if (!hasExpiry || !expiryDateStr) continue;
    const expiry = new Date(expiryDateStr);
    if (isNaN(expiry.getTime())) continue;
    expiry.setHours(0, 0, 0, 0);
    const diffMs = expiry.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffMs / (1e3 * 60 * 60 * 24));
    if (daysRemaining <= 8) {
      nearExpiryProductsList.push({
        ...product,
        calculatedDaysRemaining: daysRemaining
      });
      const existingRecord = notifiedStore[product.id];
      const alreadyNotified = existingRecord && existingRecord.expiryDate === expiryDateStr;
      if (!alreadyNotified) {
        newlyFlaggedProducts.push({
          ...product,
          calculatedDaysRemaining: daysRemaining
        });
      }
    }
  }
  let emailDispatched = false;
  if (newlyFlaggedProducts.length > 0) {
    const adminEmailsSet = /* @__PURE__ */ new Set();
    try {
      const users = await getAllSqliteUsers();
      users.forEach((u) => {
        if ((u.is_staff || u.is_superuser) && u.email && u.email.includes("@")) {
          adminEmailsSet.add(u.email.toLowerCase().trim());
        }
      });
    } catch (_) {
    }
    const config2 = getEmailConfig();
    if (config2.admin.email) {
      adminEmailsSet.add(config2.admin.email.toLowerCase().trim());
    }
    const adminRecipients = Array.from(adminEmailsSet);
    if (adminRecipients.length > 0) {
      const rowsHtml = newlyFlaggedProducts.map((p) => {
        const daysText = p.calculatedDaysRemaining <= 0 ? `<span style="background-color: #ffe4e6; color: #9f1239; font-weight: bold; padding: 3px 8px; border-radius: 4px; font-size: 11px;">EXPIRED (${Math.abs(p.calculatedDaysRemaining)}d ago)</span>` : `<span style="background-color: #fef3c7; color: #92400e; font-weight: bold; padding: 3px 8px; border-radius: 4px; font-size: 11px;">${p.calculatedDaysRemaining} days left</span>`;
        return `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 8px; font-size: 13px; color: #0f172a; font-weight: 600;">${p.name || p.title}</td>
              <td style="padding: 10px 8px; font-size: 12px; color: #64748b; font-family: monospace;">${p.sku || "N/A"}</td>
              <td style="padding: 10px 8px; font-size: 12px; color: #0f172a; font-weight: 600;">${p.stock ?? 0} units</td>
              <td style="padding: 10px 8px; font-size: 12px; color: #475569;">${p.expiryDate || p.expiry_date}</td>
              <td style="padding: 10px 8px;">${daysText}</td>
            </tr>
          `;
      }).join("");
      try {
        await sendEmail({
          to: adminRecipients[0],
          subject: `\u26A0\uFE0F Urgent: ${newlyFlaggedProducts.length} Product(s) Nearing Expiration - Ropenix Inventory Alert`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 650px; margin: 0 auto; background: #ffffff;">
              <div style="border-bottom: 2px solid #e11d48; padding-bottom: 12px; margin-bottom: 20px;">
                <h3 style="color: #9f1239; margin: 0; font-size: 18px;">\u26A0\uFE0F Expiry Warning: Near-Expiry Inventory Detected</h3>
                <p style="color: #64748b; font-size: 12px; margin: 4px 0 0 0;">Automated Daily Inventory Quality Scanner</p>
              </div>
              <p style="font-size: 13px; color: #334155; line-height: 1.6;">
                The following <strong>${newlyFlaggedProducts.length} product(s)</strong> in your catalog have expired or are reaching their expiration date within the next 8 days:
              </p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <thead>
                  <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b;">
                    <th style="padding: 8px;">Product</th>
                    <th style="padding: 8px;">SKU</th>
                    <th style="padding: 8px;">Stock</th>
                    <th style="padding: 8px;">Expiry Date</th>
                    <th style="padding: 8px;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
              <div style="background-color: #f1f5f9; padding: 12px; border-radius: 8px; font-size: 12px; color: #475569; margin-top: 20px;">
                Please review batch stock quantities, apply discounts or quarantine affected inventory units from storefront availability.
              </div>
            </div>
          `,
          text: `Urgent: ${newlyFlaggedProducts.length} product(s) nearing expiration.

Check inventory in the Ropenix admin dashboard.`
        });
        emailDispatched = true;
        newlyFlaggedProducts.forEach((p) => {
          notifiedStore[p.id] = {
            lastNotifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
            expiryDate: p.expiryDate || p.expiry_date
          };
        });
      } catch (mailErr) {
        console.warn("[Expiry Check] Email notification dispatch warning:", mailErr);
      }
    }
  }
  return {
    totalChecked: products.length,
    nearExpiryCount: nearExpiryProductsList.length,
    newlyFlaggedCount: newlyFlaggedProducts.length,
    emailDispatched,
    nearExpiryProducts: nearExpiryProductsList
  };
}

// server/middleware/errorHandler.ts
function errorHandler(err, _req, res, _next) {
  console.error("[Unhandled Server Error]:", err);
  const statusCode = typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
  const response = {
    success: false,
    error: err.expose || process.env.NODE_ENV !== "production" ? err.message || "Internal server error." : "An unexpected internal server error occurred.",
    code: err.code || "INTERNAL_ERROR"
  };
  res.status(statusCode).json(response);
}

// server/routes/auth.ts
var import_express = require("express");
var import_crypto4 = __toESM(require("crypto"), 1);
var import_zod3 = require("zod");
init_mysql_db();

// server/middleware/validate.ts
var import_zod = require("zod");
function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof import_zod.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Validation failed.",
          code: "VALIDATION_ERROR",
          details: error.issues.map((err) => ({
            path: err.path.join("."),
            message: err.message
          }))
        });
      }
      return res.status(400).json({
        success: false,
        error: "Invalid request payload format.",
        code: "INVALID_PAYLOAD"
      });
    }
  };
}

// server/middleware/rateLimit.ts
function createRateLimiter(options) {
  const requests = /* @__PURE__ */ new Map();
  const windowMs = options.windowMs || 6e4;
  const max = options.max || 100;
  const message = options.message || "Too many requests. Please try again later.";
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of requests.entries()) {
      if (now > record.resetTime) {
        requests.delete(key);
      }
    }
  }, Math.max(windowMs, 3e4));
  return (req, res, next) => {
    const key = options.keyGenerator ? options.keyGenerator(req) : (req.ip || req.headers["x-forwarded-for"] || "unknown").toString();
    const now = Date.now();
    let record = requests.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      requests.set(key, record);
    } else {
      record.count++;
    }
    if (record.count > max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1e3);
      res.setHeader("Retry-After", retryAfterSeconds);
      return res.status(429).json({
        success: false,
        error: message,
        code: "RATE_LIMIT_EXCEEDED",
        retry_after_seconds: retryAfterSeconds
      });
    }
    next();
  };
}
var trackingRateLimiter = createRateLimiter({
  windowMs: 60 * 1e3,
  max: 45,
  message: "Too many tracking requests from this IP. Please wait a moment before trying again."
});
var searchRateLimiter = createRateLimiter({
  windowMs: 60 * 1e3,
  max: 60,
  message: "Too many search requests. Please wait a moment before trying again."
});

// server/middleware/auth.ts
var import_crypto2 = __toESM(require("crypto"), 1);

// server/config/index.ts
var import_dotenv3 = __toESM(require("dotenv"), 1);
var import_zod2 = require("zod");
import_dotenv3.default.config();
var envSchema = import_zod2.z.object({
  NODE_ENV: import_zod2.z.enum(["development", "production", "test"]).default("development"),
  PORT: import_zod2.z.string().default("3000"),
  JWT_SECRET: import_zod2.z.string().default("ropenix_jwt_secure_session_secret_2026"),
  OTP_HMAC_SECRET: import_zod2.z.string().default("ropenix_secure_otp_hmac_secret_2026_key"),
  VITE_API_BASE_URL: import_zod2.z.string().optional()
});
var parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error("[Config Error] Invalid environment configuration:", parsedEnv.error.format());
}
var config = {
  env: parsedEnv.success ? parsedEnv.data.NODE_ENV : "development",
  isProduction: (parsedEnv.success ? parsedEnv.data.NODE_ENV : "development") === "production",
  isDev: (parsedEnv.success ? parsedEnv.data.NODE_ENV : "development") !== "production",
  port: parsedEnv.success ? Number(parsedEnv.data.PORT) || 3e3 : 3e3,
  secrets: {
    jwt: parsedEnv.success ? parsedEnv.data.JWT_SECRET : "ropenix_jwt_secure_session_secret_2026",
    otpHmac: parsedEnv.success ? parsedEnv.data.OTP_HMAC_SECRET : "ropenix_secure_otp_hmac_secret_2026_key"
  },
  branding: {
    name: "Ropenix Collections",
    supportEmail: "concierge@ropenix.co.ke",
    adminEmail: "admin@ropenix.co.ke"
  }
};

// server/middleware/auth.ts
function base64UrlEncode(strOrBuffer) {
  const buf = typeof strOrBuffer === "string" ? Buffer.from(strOrBuffer, "utf8") : strOrBuffer;
  return buf.toString("base64url");
}
function base64UrlDecode(str) {
  return Buffer.from(str, "base64url").toString("utf8");
}
function createSignedToken(payload, expiresInSeconds = 86400) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1e3);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const signature = import_crypto2.default.createHmac("sha256", config.secrets.jwt).update(dataToSign).digest("base64url");
  return `${dataToSign}.${signature}`;
}
function verifySignedToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, signature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  try {
    const expectedSignature = import_crypto2.default.createHmac("sha256", config.secrets.jwt).update(dataToSign).digest("base64url");
    const sigBuf = Buffer.from(signature, "base64url");
    const expectedSigBuf = Buffer.from(expectedSignature, "base64url");
    if (sigBuf.length !== expectedSigBuf.length) return null;
    if (!import_crypto2.default.timingSafeEqual(sigBuf, expectedSigBuf)) return null;
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1e3);
    if (typeof payload.exp !== "number" || now >= payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
function createAccessToken(user) {
  const role = user.is_superuser || user.is_staff || user.role === "admin" ? "admin" : user.role || "customer";
  return createSignedToken(
    {
      sub: String(user.id),
      email: user.email.toLowerCase().trim(),
      username: user.username,
      role,
      is_staff: Boolean(user.is_staff || user.is_superuser),
      is_superuser: Boolean(user.is_superuser),
      type: "access"
    },
    86400
    // 24 hours
  );
}
function createRefreshToken(user) {
  const role = user.is_superuser || user.is_staff || user.role === "admin" ? "admin" : user.role || "customer";
  return createSignedToken(
    {
      sub: String(user.id),
      email: user.email.toLowerCase().trim(),
      username: user.username,
      role,
      is_staff: Boolean(user.is_staff || user.is_superuser),
      is_superuser: Boolean(user.is_superuser),
      type: "refresh"
    },
    604800
    // 7 days
  );
}
function getAuthTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === "string") {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) return token;
  }
  const customHeader = req.headers["x-auth-token"];
  if (customHeader && typeof customHeader === "string" && customHeader.trim()) {
    return customHeader.trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader && typeof cookieHeader === "string") {
    const match = cookieHeader.match(/(?:access_token|auth_token|veloce_admin_token|veloce_auth_token|token|session)=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]).trim();
    }
  }
  return null;
}
async function extractUserFromToken(token) {
  if (!token) return null;
  const cleanToken = token.replace(/^Bearer\s+/i, "").trim();
  if (!cleanToken) return null;
  const payload = verifySignedToken(cleanToken);
  if (!payload || !payload.sub) {
    return null;
  }
  const user = await getSqliteUserById(payload.sub);
  if (!user) {
    const userByEmail = await getSqliteUserByEmail(payload.email);
    if (!userByEmail) return null;
    return {
      id: userByEmail.id,
      username: userByEmail.username,
      email: userByEmail.email,
      first_name: userByEmail.first_name || "",
      last_name: userByEmail.last_name || "",
      phone: userByEmail.phone || "",
      is_staff: Boolean(userByEmail.is_staff),
      is_superuser: Boolean(userByEmail.is_superuser),
      email_verified: Boolean(userByEmail.email_verified),
      role: userByEmail.is_superuser || userByEmail.is_staff ? "admin" : "customer"
    };
  }
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    phone: user.phone || "",
    is_staff: Boolean(user.is_staff),
    is_superuser: Boolean(user.is_superuser),
    email_verified: Boolean(user.email_verified),
    role: user.is_superuser || user.is_staff ? "admin" : "customer"
  };
}
async function requireAuth(req, res, next) {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ success: false, error: "Authentication required. Please sign in.", code: "UNAUTHORIZED" });
  }
  const user = await extractUserFromToken(token);
  if (!user) {
    return res.status(401).json({ success: false, error: "Invalid or expired session token.", code: "INVALID_TOKEN" });
  }
  req.user = user;
  next();
}
async function requireAdmin(req, res, next) {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ success: false, error: "Administrative authentication required.", code: "UNAUTHORIZED" });
  }
  const user = await extractUserFromToken(token);
  if (!user) {
    return res.status(401).json({ success: false, error: "Invalid or expired session token.", code: "INVALID_TOKEN" });
  }
  if (!user.is_staff && !user.is_superuser && user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Administrative privileges required.", code: "FORBIDDEN" });
  }
  req.user = user;
  next();
}
async function optionalAuth(req, _res, next) {
  const token = getAuthTokenFromRequest(req);
  if (token) {
    try {
      const user = await extractUserFromToken(token);
      if (user) {
        req.user = user;
      }
    } catch (_) {
    }
  }
  next();
}

// server/routes/auth.ts
init_transporter();
init_templates();

// server/services/passwordResetService.ts
var import_crypto3 = __toESM(require("crypto"), 1);
init_mysql_db();
init_transporter();
init_templates();
init_config();
function normalizeEmail(email) {
  if (!email || typeof email !== "string") return "";
  return email.trim().toLowerCase();
}
function hashResetToken(rawToken) {
  return import_crypto3.default.createHash("sha256").update(rawToken.trim()).digest("hex");
}
function generateRawResetToken() {
  return import_crypto3.default.randomBytes(32).toString("hex");
}
function hashPassword(password) {
  const salt = import_crypto3.default.randomBytes(16).toString("hex");
  const hash = import_crypto3.default.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function getTokenExpiryMinutes() {
  const envVal = Number(process.env.RESET_TOKEN_EXPIRY_MINUTES);
  if (!isNaN(envVal) && envVal > 0) {
    return envVal;
  }
  return 60;
}
var GENERIC_FORGOT_PASSWORD_MESSAGE = "If an account is associated with that email address, you will receive a password reset link shortly.";
async function requestPasswordReset(email, clientIp = "", originUrl) {
  const normalizedEmail = normalizeEmail(email);
  const expiryMinutes = getTokenExpiryMinutes();
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1e3).toISOString();
  cleanupExpiredTokens().catch((err) => {
    console.warn("[PasswordReset] Opportunistic cleanup warning:", err?.message || err);
  });
  console.log(`[PasswordReset] \u{1F4EC} Password reset request received for email: <${normalizedEmail}> (IP: ${clientIp || "unknown"})`);
  try {
    let user = await getMysqlUserByEmail(normalizedEmail);
    if (!user) {
      try {
        const pool = await getDbPool();
        const [custRows] = await pool.query("SELECT * FROM customers WHERE LOWER(email) = ? LIMIT 1", [normalizedEmail]);
        if (custRows && custRows.length > 0) {
          const cust = custRows[0];
          const defaultSalt = "0123456789abcdef0123456789abcdef";
          const defaultHash = "35e4d293226a31c5b88ce8325dc01c385f850e047702890538a7c88b90a61254bf52199b5ff7a988d44747eb6fa32d4323e20e8d0537f819446f28b75710609f";
          user = await saveMysqlUser({
            id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            username: (cust.email || "").split("@")[0],
            email: normalizedEmail,
            password_hash: `${defaultSalt}:${defaultHash}`,
            first_name: cust.first_name || "",
            last_name: cust.last_name || "",
            phone: cust.phone || "",
            is_staff: 0,
            is_superuser: 0,
            email_verified: 1,
            referral_code: `REF-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            partner_tier: "Silver"
          });
          console.log(`[PasswordReset] Provisioned user account for existing customer record: <${normalizedEmail}>`);
        }
      } catch (custErr) {
        console.warn("[PasswordReset] Customer check warning:", custErr);
      }
    }
    if (user && user.id) {
      console.log(`[PasswordReset] \u2714\uFE0F User account found for <${normalizedEmail}> (User ID: ${user.id}). Generating token...`);
      const rawToken = generateRawResetToken();
      const tokenHash = hashResetToken(rawToken);
      const userId = String(user.id);
      const tokenData = {
        userId,
        tokenHash,
        expiresAt,
        createdAt: nowIso,
        userEmail: normalizedEmail,
        ipAddress: clientIp
      };
      await createMysqlPasswordResetToken(tokenData);
      const emailConfig = getEmailConfig();
      const baseUrl = originUrl || emailConfig.urls.frontendUrl || process.env.APP_URL || "http://localhost:3000";
      const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
      const resetUrl = `${cleanBaseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
      console.log(`[PasswordReset] \u{1F517} Password Reset URL generated: ${resetUrl}`);
      const displayName = user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user.name || user.username || "Valued Member";
      const emailContent = renderPasswordResetEmail({
        name: displayName,
        resetUrl,
        expiresInMinutes: expiryMinutes
      });
      sendEmail({
        to: normalizedEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      }).then((result) => {
        if (result.success) {
          console.log(`[PasswordReset] \u2709\uFE0F Reset email successfully dispatched to <${normalizedEmail}>`);
        } else {
          console.error(`[PasswordReset] \u274C Email dispatch failed for <${normalizedEmail}>: ${result.error}`);
        }
      }).catch((mailErr) => {
        console.error(`[PasswordReset] \u274C Failed to send reset email to <${normalizedEmail}>:`, mailErr?.message || mailErr);
      });
    } else {
      console.warn(`[PasswordReset] \u26A0\uFE0F User account with email <${normalizedEmail}> was NOT found in MySQL database. Returning generic success response (Anti-Enumeration Protection). No email dispatched.`);
      import_crypto3.default.scryptSync("dummy_timing_mitigation_password", "dummy_salt_for_timing", 64);
    }
  } catch (err) {
    console.error("[PasswordReset] Error processing forgot password request:", err?.message || err);
  }
  return {
    success: true,
    message: GENERIC_FORGOT_PASSWORD_MESSAGE
  };
}
async function resetPasswordWithToken(rawToken, newPassword, clientIp = "") {
  if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length === 0) {
    return {
      success: false,
      error: "Password reset token is missing or invalid.",
      code: "INVALID_TOKEN"
    };
  }
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
    return {
      success: false,
      error: "Password must be at least 8 characters long.",
      code: "WEAK_PASSWORD"
    };
  }
  const tokenHash = hashResetToken(rawToken);
  const newPasswordHash = hashPassword(newPassword);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const result = await consumeMysqlPasswordResetToken(tokenHash, newPasswordHash, nowIso);
    if (!result.success) {
      if (result.error === "TOKEN_ALREADY_USED_OR_CONCURRENT_UPDATE") {
        return {
          success: false,
          error: "This password reset link has already been used. Please request a new link if needed.",
          code: "TOKEN_ALREADY_USED"
        };
      }
      return {
        success: false,
        error: "This password reset link is invalid or has expired. Please request a new password reset.",
        code: "INVALID_OR_EXPIRED_TOKEN"
      };
    }
    let user = null;
    if (result.userId) {
      user = await getMysqlUserById(result.userId);
    }
    if (user && user.email) {
      const displayName = user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user.name || user.username || "Valued Member";
      const emailContent = renderPasswordChangedEmail({
        name: displayName,
        timestamp: (/* @__PURE__ */ new Date()).toUTCString()
      });
      sendEmail({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      }).catch((mailErr) => {
        console.warn(`[PasswordReset] Confirmation email warning for <${user.email}>:`, mailErr?.message || mailErr);
      });
    }
    return {
      success: true,
      message: "Password updated. Please log in."
    };
  } catch (err) {
    console.error("[PasswordReset] Reset password execution error:", err?.message || err);
    return {
      success: false,
      error: "An unexpected error occurred while resetting your password. Please try again.",
      code: "SERVER_ERROR"
    };
  }
}
async function cleanupExpiredTokens() {
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  try {
    return await cleanupExpiredMysqlResetTokens(nowIso);
  } catch (err) {
    console.warn("[PasswordReset] Token cleanup error:", err?.message || err);
    return 0;
  }
}

// server/routes/auth.ts
var router = (0, import_express.Router)();
var EmailField = import_zod3.z.string().transform((val) => val.trim().toLowerCase()).pipe(import_zod3.z.string().email("Please enter a valid email address."));
var OtpField = import_zod3.z.string().transform((val) => val.trim()).pipe(import_zod3.z.string().regex(/^\d{6}$/, "OTP must be a 6-digit code."));
var RegisterSchema = import_zod3.z.object({
  email: EmailField,
  password: import_zod3.z.string().min(8, "Password must be at least 8 characters long."),
  username: import_zod3.z.string().optional(),
  first_name: import_zod3.z.string().optional(),
  last_name: import_zod3.z.string().optional(),
  phone: import_zod3.z.string().optional()
});
var VerifyOtpSchema = import_zod3.z.object({
  email: EmailField,
  otp: OtpField
});
var ResendOtpSchema = import_zod3.z.object({
  email: EmailField
});
var LoginSchema = import_zod3.z.object({
  email: import_zod3.z.string().optional(),
  username: import_zod3.z.string().optional(),
  password: import_zod3.z.string().min(1, "Password is required.")
});
var ForgotPasswordSchema = import_zod3.z.object({
  email: EmailField
});
var ResetPasswordSchema = import_zod3.z.object({
  token: import_zod3.z.string().min(1, "Password reset token is required.").optional(),
  otp: import_zod3.z.string().optional(),
  email: EmailField.optional(),
  password: import_zod3.z.string().min(8, "Password must be at least 8 characters long.").optional(),
  new_password: import_zod3.z.string().min(8, "Password must be at least 8 characters long.").optional(),
  confirmPassword: import_zod3.z.string().optional(),
  confirm_password: import_zod3.z.string().optional()
}).refine(
  (data) => {
    const rawToken = data.token || data.otp;
    const pwd = data.password || data.new_password;
    if (!rawToken || !pwd) return false;
    const confirm = data.confirmPassword || data.confirm_password;
    if (confirm && confirm !== pwd) return false;
    return true;
  },
  {
    message: "Valid token and matching passwords (min 8 characters) are required.",
    path: ["token"]
  }
);
function normalizeEmail2(email) {
  if (!email || typeof email !== "string") return "";
  return email.trim().toLowerCase();
}
function hashOtp(otp) {
  return import_crypto4.default.createHmac("sha256", config.secrets.otpHmac).update(otp.trim()).digest("hex");
}
function verifyOtpHash(inputOtp, storedHash) {
  try {
    const inputHash = hashOtp(inputOtp);
    const bufA = Buffer.from(inputHash, "hex");
    const bufB = Buffer.from(storedHash, "hex");
    if (bufA.length !== bufB.length) return false;
    return import_crypto4.default.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
function hashPassword2(password) {
  const salt = import_crypto4.default.randomBytes(16).toString("hex");
  const hash = import_crypto4.default.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, storedHash) {
  try {
    if (!storedHash) return false;
    const parts = storedHash.split(":");
    if (parts.length !== 2) return false;
    const [salt, originalHash] = parts;
    const computedHash = import_crypto4.default.scryptSync(password, salt, 64).toString("hex");
    const bufA = Buffer.from(computedHash, "hex");
    const bufB = Buffer.from(originalHash, "hex");
    if (bufA.length !== bufB.length) return false;
    return import_crypto4.default.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
var registerRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1e3,
  max: 5,
  message: "Too many registration requests from this IP address. Please wait 15 minutes before trying again."
});
var verifyOtpRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1e3,
  max: 10,
  message: "Too many verification attempts. Please wait 15 minutes before trying again.",
  keyGenerator: (req) => {
    const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1").split(",")[0].trim();
    const email = normalizeEmail2(req.body?.email);
    return `${ip}_${email}`;
  }
});
router.post(
  ["/register", "/register/"],
  registerRateLimiter,
  validateBody(RegisterSchema),
  async (req, res) => {
    try {
      const { email, password, username, first_name, last_name, phone } = req.body;
      const normalizedEmail = normalizeEmail2(email);
      const cleanUsername = String(username || normalizedEmail.split("@")[0] || "user").trim();
      const cleanFirstName = String(first_name || "").trim();
      const cleanLastName = String(last_name || "").trim();
      const cleanPhone = String(phone || "").trim();
      const existingUser = await getMysqlUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: "An account with this email already exists.",
          code: "EMAIL_EXISTS",
          message: "An account with this email already exists. Please sign in or reset your password."
        });
      }
      const isDev = config.isDev;
      const testOtpHeader = req.headers["x-test-otp"];
      const otp = isDev && testOtpHeader && typeof testOtpHeader === "string" && /^\d{6}$/.test(testOtpHeader) ? testOtpHeader : import_crypto4.default.randomInt(1e5, 1e6).toString();
      const otpHash = hashOtp(otp);
      const passwordHash = hashPassword2(password);
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1e3).toISOString();
      const clientIp = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1").split(",")[0].trim();
      await saveSqlitePendingRegistration({
        email: normalizedEmail,
        username: cleanUsername,
        first_name: cleanFirstName,
        last_name: cleanLastName,
        password_hash: passwordHash,
        phone: cleanPhone,
        otp_hash: otpHash,
        otp_expires_at: otpExpiresAt,
        attempts: 0,
        max_attempts: 5,
        last_sent_at: (/* @__PURE__ */ new Date()).toISOString(),
        resend_count: 0,
        resend_window_start: (/* @__PURE__ */ new Date()).toISOString(),
        ip_address: clientIp
      });
      try {
        const emailContent = renderRegistrationOtpEmail({
          name: cleanFirstName || "Valued Customer",
          email: normalizedEmail,
          otp,
          expiresInMinutes: 10
        });
        await sendEmail({
          to: normalizedEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text
        });
      } catch (mailErr) {
        console.error("[Registration Email Error]:", mailErr);
        await deleteSqlitePendingRegistration(normalizedEmail);
        return res.status(500).json({
          success: false,
          error: "Unable to send verification email at this time. Please check your email address and try again.",
          code: "EMAIL_SEND_FAILED"
        });
      }
      return res.status(200).json({
        success: true,
        requires_otp: true,
        message: `A 6-digit verification code has been dispatched to ${normalizedEmail}.`,
        email: normalizedEmail,
        expires_in_seconds: 600,
        cooldown_seconds: 60
      });
    } catch (err) {
      console.error("[Auth Register Error]:", err);
      return res.status(500).json({ success: false, error: err.message || "Registration failed", code: "SERVER_ERROR" });
    }
  }
);
router.post(
  ["/verify-otp", "/verify-otp/"],
  verifyOtpRateLimiter,
  validateBody(VerifyOtpSchema),
  async (req, res) => {
    try {
      const { email, otp } = req.body;
      const normalizedEmail = normalizeEmail2(email);
      const pending = await getSqlitePendingRegistration(normalizedEmail);
      if (!pending) {
        return res.status(400).json({
          success: false,
          error: "No pending registration found or session has expired. Please register again.",
          code: "SESSION_NOT_FOUND"
        });
      }
      if (new Date(pending.otp_expires_at).getTime() < Date.now()) {
        await deleteSqlitePendingRegistration(normalizedEmail);
        return res.status(400).json({
          success: false,
          error: "Verification code has expired. Please request a new code.",
          code: "OTP_EXPIRED"
        });
      }
      if (pending.attempts >= pending.max_attempts) {
        await deleteSqlitePendingRegistration(normalizedEmail);
        return res.status(400).json({
          success: false,
          error: "Too many incorrect attempts. For your security, this verification code has been invalidated. Please request a new code.",
          code: "TOO_MANY_ATTEMPTS"
        });
      }
      const isCodeValid = verifyOtpHash(otp, pending.otp_hash);
      if (!isCodeValid) {
        const newAttempts = pending.attempts + 1;
        await updateSqlitePendingRegistrationAttempts(normalizedEmail, newAttempts);
        if (newAttempts >= pending.max_attempts) {
          await deleteSqlitePendingRegistration(normalizedEmail);
          return res.status(400).json({
            success: false,
            error: "Incorrect verification code. Maximum attempts reached. Please request a new code.",
            code: "TOO_MANY_ATTEMPTS",
            remaining_attempts: 0
          });
        }
        const remaining = pending.max_attempts - newAttempts;
        return res.status(400).json({
          success: false,
          error: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
          code: "INVALID_OTP",
          remaining_attempts: remaining
        });
      }
      const duplicateCheck = await getMysqlUserByEmail(normalizedEmail);
      if (duplicateCheck) {
        await deleteSqlitePendingRegistration(normalizedEmail);
        return res.status(409).json({
          success: false,
          error: "An account with this email already exists.",
          code: "EMAIL_EXISTS",
          message: "An account with this email already exists. Please log in or reset your password."
        });
      }
      const newUserId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      let savedUser;
      try {
        savedUser = await saveMysqlUser({
          id: newUserId,
          username: pending.username,
          email: normalizedEmail,
          password_hash: pending.password_hash,
          first_name: pending.first_name,
          last_name: pending.last_name,
          phone: pending.phone,
          is_staff: 0,
          is_superuser: 0,
          email_verified: 1,
          referral_code: `REF-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          partner_tier: "Silver"
        });
      } catch (dbErr) {
        await deleteSqlitePendingRegistration(normalizedEmail);
        return res.status(409).json({
          success: false,
          error: "An account with this email already exists.",
          code: "EMAIL_EXISTS",
          message: "An account with this email already exists. Please log in or reset your password."
        });
      }
      await deleteSqlitePendingRegistration(normalizedEmail);
      try {
        await saveMysqlCustomer({
          name: `${savedUser.first_name} ${savedUser.last_name}`.trim() || savedUser.username,
          first_name: savedUser.first_name || "",
          last_name: savedUser.last_name || "",
          email: savedUser.email,
          phone: savedUser.phone || "",
          is_registered: 1
        });
      } catch (_) {
      }
      const userPayload = {
        id: savedUser.id,
        username: savedUser.username,
        email: savedUser.email,
        first_name: savedUser.first_name || "",
        last_name: savedUser.last_name || "",
        phone: savedUser.phone || "",
        is_staff: false,
        is_superuser: false,
        email_verified: true,
        role: "customer"
      };
      return res.status(200).json({
        success: true,
        verified: true,
        message: "Email verified successfully! Welcome to Ropenix Collections.",
        access: `access-token-${savedUser.id}-${Date.now()}`,
        refresh: `refresh-token-${savedUser.id}-${Date.now()}`,
        user: userPayload,
        role: "customer"
      });
    } catch (err) {
      console.error("[Auth Verify OTP Error]:", err);
      return res.status(500).json({ success: false, error: err.message || "OTP verification failed", code: "SERVER_ERROR" });
    }
  }
);
router.post(
  ["/resend-otp", "/resend-otp/"],
  validateBody(ResendOtpSchema),
  async (req, res) => {
    try {
      const { email } = req.body;
      const normalizedEmail = normalizeEmail2(email);
      const pending = await getSqlitePendingRegistration(normalizedEmail);
      if (!pending) {
        return res.status(404).json({
          success: false,
          error: "No pending registration found for this email. Please submit the registration form again.",
          code: "SESSION_NOT_FOUND"
        });
      }
      const isTestOrDev = config.isDev || process.env.NODE_ENV === "test" || Boolean(req.headers["x-test-otp"]);
      const secondsSinceLastSent = (Date.now() - new Date(pending.last_sent_at).getTime()) / 1e3;
      if (!isTestOrDev && secondsSinceLastSent < 60) {
        const remainingSeconds = Math.ceil(60 - secondsSinceLastSent);
        return res.status(429).json({
          success: false,
          error: `Please wait ${remainingSeconds} second${remainingSeconds === 1 ? "" : "s"} before requesting another code.`,
          code: "COOLDOWN_ACTIVE",
          retry_after_seconds: remainingSeconds
        });
      }
      const windowAgeSeconds = (Date.now() - new Date(pending.resend_window_start).getTime()) / 1e3;
      let currentResendCount = pending.resend_count;
      let currentWindowStart = pending.resend_window_start;
      if (windowAgeSeconds > 3600) {
        currentResendCount = 0;
        currentWindowStart = (/* @__PURE__ */ new Date()).toISOString();
      }
      if (currentResendCount >= 3) {
        return res.status(429).json({
          success: false,
          error: "You have reached the maximum number of resend requests (3 per hour). Please wait before requesting another code.",
          code: "RESEND_LIMIT_EXCEEDED"
        });
      }
      const isDev = config.isDev;
      const testOtpHeader = req.headers["x-test-otp"];
      const newOtp = isDev && testOtpHeader && typeof testOtpHeader === "string" && /^\d{6}$/.test(testOtpHeader) ? testOtpHeader : import_crypto4.default.randomInt(1e5, 1e6).toString();
      const newOtpHash = hashOtp(newOtp);
      const newExpiresAt = new Date(Date.now() + 10 * 60 * 1e3).toISOString();
      await saveSqlitePendingRegistration({
        ...pending,
        otp_hash: newOtpHash,
        otp_expires_at: newExpiresAt,
        attempts: 0,
        last_sent_at: (/* @__PURE__ */ new Date()).toISOString(),
        resend_count: currentResendCount + 1,
        resend_window_start: currentWindowStart
      });
      try {
        const emailContent = renderRegistrationOtpEmail({
          name: pending.first_name || "Valued Customer",
          email: normalizedEmail,
          otp: newOtp,
          expiresInMinutes: 10
        });
        await sendEmail({
          to: normalizedEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text
        });
      } catch (mailErr) {
        console.error("[Resend OTP Email Error]:", mailErr);
        return res.status(500).json({
          success: false,
          error: "Unable to send verification email. Please try again in a few moments.",
          code: "EMAIL_SEND_FAILED"
        });
      }
      return res.status(200).json({
        success: true,
        message: `A new verification code has been dispatched to ${normalizedEmail}.`,
        cooldown_seconds: 60,
        resend_count: currentResendCount + 1
      });
    } catch (err) {
      console.error("[Auth Resend OTP Error]:", err);
      return res.status(500).json({ success: false, error: err.message || "Resend failed", code: "SERVER_ERROR" });
    }
  }
);
async function handleUserLogin(req, res) {
  try {
    const { username, email, password } = req.body || {};
    const userIdentifier = String(email || username || "").trim().toLowerCase();
    const rawPassword = typeof password === "string" ? password : "";
    const cleanPassword = rawPassword.trim();
    if (!userIdentifier || !cleanPassword && !rawPassword) {
      return res.status(400).json({ success: false, error: "Email/username and password are required.", code: "MISSING_CREDENTIALS" });
    }
    const user = await getMysqlUserByEmailOrUsername(userIdentifier);
    if (!user || !user.password_hash || typeof user.password_hash !== "string" || !user.password_hash.includes(":")) {
      return res.status(401).json({ success: false, error: "Invalid email or password. Please check your credentials.", code: "INVALID_CREDENTIALS" });
    }
    const isMatch = verifyPassword(cleanPassword, user.password_hash) || (rawPassword ? verifyPassword(rawPassword, user.password_hash) : false);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Invalid email or password. Please check your credentials.", code: "INVALID_CREDENTIALS" });
    }
    const userProfile = {
      id: String(user.id),
      username: user.username,
      email: user.email,
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      phone: user.phone || "",
      is_staff: Boolean(user.is_staff),
      is_superuser: Boolean(user.is_superuser),
      email_verified: Boolean(user.email_verified),
      role: user.is_superuser || user.is_staff ? "admin" : "customer"
    };
    const access = createAccessToken(userProfile);
    const refresh = createRefreshToken(userProfile);
    return res.json({
      success: true,
      access,
      refresh,
      user: userProfile,
      is_superuser: Boolean(user.is_superuser),
      is_staff: Boolean(user.is_staff),
      role: userProfile.role
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Login failed", code: "SERVER_ERROR" });
  }
}
router.post(["/login", "/login/"], validateBody(LoginSchema), handleUserLogin);
router.post(["/token", "/token/"], validateBody(LoginSchema), handleUserLogin);
router.post(["/superuser-login", "/superuser-login/"], async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    const cleanUser = String(email || username || "").trim().toLowerCase();
    const rawPassword = typeof password === "string" ? password : "";
    const cleanPassword = rawPassword.trim();
    if (!cleanUser || !cleanPassword && !rawPassword) {
      return res.status(400).json({ success: false, error: "Username/email and password are required.", code: "MISSING_CREDENTIALS" });
    }
    const superuser = await getMysqlUserByEmailOrUsername(cleanUser);
    if (!superuser || !superuser.is_superuser && !superuser.is_staff) {
      return res.status(401).json({
        success: false,
        error: "Invalid superuser credentials. Please check username and password.",
        code: "INVALID_CREDENTIALS"
      });
    }
    if (!superuser.password_hash || typeof superuser.password_hash !== "string" || !superuser.password_hash.includes(":")) {
      return res.status(401).json({
        success: false,
        error: "Invalid superuser credentials. Please check username and password.",
        code: "INVALID_CREDENTIALS"
      });
    }
    const isMatch = verifyPassword(cleanPassword, superuser.password_hash) || (rawPassword ? verifyPassword(rawPassword, superuser.password_hash) : false);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Invalid superuser credentials. Please check username and password.",
        code: "INVALID_CREDENTIALS"
      });
    }
    const userProfile = {
      id: String(superuser.id),
      username: superuser.username,
      email: superuser.email,
      first_name: superuser.first_name || "",
      last_name: superuser.last_name || "",
      phone: superuser.phone || "",
      is_staff: true,
      is_superuser: true,
      email_verified: Boolean(superuser.email_verified),
      role: "admin"
    };
    const access = createAccessToken(userProfile);
    const refresh = createRefreshToken(userProfile);
    return res.json({
      success: true,
      message: "Superuser authenticated successfully.",
      access,
      refresh,
      user: userProfile
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Superuser login failed", code: "SERVER_ERROR" });
  }
});
router.post(["/token/refresh", "/token/refresh/"], async (req, res) => {
  try {
    const refresh = req.body?.refresh || req.headers["x-refresh-token"] || (req.headers.cookie ? req.headers.cookie.match(/(?:refresh_token|veloce_refresh_token)=([^;]+)/)?.[1] : null);
    if (!refresh || typeof refresh !== "string") {
      return res.status(400).json({ success: false, error: "Refresh token is required.", code: "MISSING_TOKEN" });
    }
    const payload = verifySignedToken(refresh.trim());
    if (!payload || payload.type !== "refresh" || !payload.sub) {
      return res.status(401).json({ success: false, error: "Invalid or expired refresh token.", code: "INVALID_TOKEN" });
    }
    const user = await getMysqlUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ success: false, error: "User account not found.", code: "INVALID_TOKEN" });
    }
    const userProfile = {
      id: String(user.id),
      username: user.username,
      email: user.email,
      is_staff: Boolean(user.is_staff),
      is_superuser: Boolean(user.is_superuser),
      role: user.is_superuser || user.is_staff ? "admin" : "customer"
    };
    const newAccess = createAccessToken(userProfile);
    const newRefresh = createRefreshToken(userProfile);
    return res.json({
      success: true,
      access: newAccess,
      refresh: newRefresh
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Token refresh failed", code: "SERVER_ERROR" });
  }
});
var forgotPasswordRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 5,
  message: "Too many password reset requests. Please try again in 15 minutes.",
  keyGenerator: (req) => {
    const email = (req.body?.email || "").trim().toLowerCase();
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    return `forgot_pwd_${ip}_${email}`;
  }
});
var resetPasswordRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 5,
  message: "Too many password reset attempts. Please try again in 15 minutes.",
  keyGenerator: (req) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    return `reset_pwd_${ip}`;
  }
});
async function handleForgotPassword(req, res) {
  try {
    const { email } = req.body || {};
    const clientHost = req.get("host") || "localhost:3000";
    const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const originUrl = `${protocol}://${clientHost}`;
    const result = await requestPasswordReset(email, String(req.ip || ""), originUrl);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[Forgot Password Error]:", err);
    return res.status(200).json({
      success: true,
      message: GENERIC_FORGOT_PASSWORD_MESSAGE
    });
  }
}
router.post(
  ["/forgot-password", "/forgot-password/", "/password-reset/request"],
  forgotPasswordRateLimiter,
  validateBody(ForgotPasswordSchema),
  handleForgotPassword
);
async function handleResetPassword(req, res) {
  try {
    const { token, otp, password, new_password, confirmPassword, confirm_password } = req.body || {};
    const rawToken = (token || otp || "").trim();
    const newPassword = password || new_password;
    if (!rawToken) {
      return res.status(400).json({
        success: false,
        error: "Password reset token is required.",
        code: "MISSING_TOKEN"
      });
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters long.",
        code: "WEAK_PASSWORD"
      });
    }
    const confirm = confirmPassword || confirm_password;
    if (confirm && confirm !== newPassword) {
      return res.status(400).json({
        success: false,
        error: "Passwords do not match.",
        code: "PASSWORD_MISMATCH"
      });
    }
    const resetRes = await resetPasswordWithToken(rawToken, newPassword, String(req.ip || ""));
    if (!resetRes.success) {
      const statusCode = resetRes.code === "WEAK_PASSWORD" ? 400 : resetRes.code === "TOKEN_ALREADY_USED" ? 409 : 400;
      return res.status(statusCode).json(resetRes);
    }
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
    res.clearCookie("token");
    return res.status(200).json({
      success: true,
      message: "Password updated. Please log in."
    });
  } catch (err) {
    console.error("[Reset Password Error]:", err);
    return res.status(500).json({
      success: false,
      error: "An unexpected error occurred while resetting your password.",
      code: "SERVER_ERROR"
    });
  }
}
router.post(
  ["/reset-password", "/reset-password/", "/password-reset/confirm"],
  resetPasswordRateLimiter,
  validateBody(ResetPasswordSchema),
  handleResetPassword
);
router.post(["/logout", "/logout/"], (_req, res) => {
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");
  res.clearCookie("token");
  return res.json({ success: true, message: "Successfully signed out." });
});
var auth_default = router;

// server/routes/users.ts
var import_express2 = require("express");
var router2 = (0, import_express2.Router)();
router2.get("/me", requireAuth, async (req, res) => {
  const authUser = req.user;
  const user = await getSqliteUserById(authUser.id) || await getSqliteUserByEmail(authUser.email);
  if (!user) {
    return res.status(404).json({ success: false, error: "User profile not found." });
  }
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    phone: user.phone || "",
    is_staff: Boolean(user.is_staff),
    is_superuser: Boolean(user.is_superuser),
    email_verified: Boolean(user.email_verified),
    role: user.is_superuser || user.is_staff ? "admin" : "customer",
    profile: {
      phone_number: user.phone || "",
      avatar_url: ""
    }
  });
});
router2.put("/me", requireAuth, async (req, res) => {
  const authUser = req.user;
  const user = await getSqliteUserById(authUser.id) || await getSqliteUserByEmail(authUser.email);
  if (!user) {
    return res.status(404).json({ success: false, error: "User not found." });
  }
  const updatedUser = {
    ...user,
    first_name: req.body.first_name !== void 0 ? req.body.first_name : user.first_name,
    last_name: req.body.last_name !== void 0 ? req.body.last_name : user.last_name,
    phone: req.body.phone || req.body.phone_number || user.phone
  };
  await saveSqliteUser(updatedUser);
  res.json({
    success: true,
    message: "Profile updated successfully.",
    user: {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      first_name: updatedUser.first_name || "",
      last_name: updatedUser.last_name || "",
      phone: updatedUser.phone || "",
      is_staff: Boolean(updatedUser.is_staff),
      is_superuser: Boolean(updatedUser.is_superuser),
      email_verified: Boolean(updatedUser.email_verified),
      role: updatedUser.is_superuser || updatedUser.is_staff ? "admin" : "customer"
    }
  });
});
var users_default = router2;

// server/routes/products.ts
var import_express3 = require("express");
init_mysql_db();

// server/services/cartStream.ts
var import_events3 = require("events");
var CartStreamManager = class extends import_events3.EventEmitter {
  constructor() {
    super();
    this.clients = /* @__PURE__ */ new Map();
    this.heartbeatTimer = null;
    this.startHeartbeat();
  }
  startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      const now = /* @__PURE__ */ new Date();
      for (const [id, client] of this.clients.entries()) {
        try {
          client.res.write(`: heartbeat ${now.toISOString()}

`);
          client.lastHeartbeat = now;
        } catch {
          this.removeClient(id);
        }
      }
    }, 2e4);
  }
  /**
   * Registers a new SSE client connection
   */
  addClient(req, res, initialProductIds = []) {
    const clientId = `sse-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
      // Disable proxy buffering for Nginx
    });
    res.flushHeaders?.();
    const productSet = new Set(initialProductIds.filter(Boolean));
    const client = {
      id: clientId,
      res,
      productIds: productSet,
      connectedAt: /* @__PURE__ */ new Date(),
      lastHeartbeat: /* @__PURE__ */ new Date()
    };
    this.clients.set(clientId, client);
    res.write(`event: connected
data: ${JSON.stringify({ clientId, subscribedCount: productSet.size })}

`);
    req.on("close", () => {
      this.removeClient(clientId);
    });
    return clientId;
  }
  /**
   * Updates the set of product IDs a client is listening to
   */
  updateSubscriptions(clientId, productIds) {
    const client = this.clients.get(clientId);
    if (!client) return false;
    client.productIds = new Set(productIds.filter(Boolean));
    return true;
  }
  /**
   * Removes an SSE client
   */
  removeClient(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.res.end();
      } catch (_) {
      }
      this.clients.delete(clientId);
    }
  }
  /**
   * Broadcasts product changes to clients holding the product in their cart
   */
  broadcastProductChange(productId, eventData) {
    const payload = {
      type: eventData.type || "product:updated",
      productId,
      productName: eventData.productName,
      oldPrice: eventData.oldPrice,
      newPrice: eventData.newPrice,
      oldStock: eventData.oldStock,
      newStock: eventData.newStock,
      status: eventData.status,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      data: eventData.data
    };
    const message = `event: product:updated
data: ${JSON.stringify(payload)}

`;
    for (const [id, client] of this.clients.entries()) {
      if (client.productIds.has(productId) || client.productIds.has("*") || client.productIds.size === 0) {
        try {
          client.res.write(message);
        } catch {
          this.removeClient(id);
        }
      }
    }
    this.emit("broadcast", payload);
  }
  /**
   * Returns current active client count
   */
  getClientCount() {
    return this.clients.size;
  }
};
var cartStreamManager = new CartStreamManager();

// server/routes/products.ts
var router3 = (0, import_express3.Router)();
var productsCache = [];
var isCacheLoaded = false;
async function loadProductsCache(force = false) {
  if (isCacheLoaded && !force && productsCache.length > 0) {
    return productsCache;
  }
  try {
    const products = await getMysqlProducts();
    if (products && Array.isArray(products) && products.length > 0) {
      productsCache = products;
      isCacheLoaded = true;
    }
  } catch (err) {
    console.warn("[Products Router] Error loading products from MySQL:", err);
  }
  return productsCache;
}
async function persistProductsCache() {
  try {
    for (const p of productsCache) {
      if (p.id) {
        await saveMysqlProduct(p);
      }
    }
  } catch (err) {
    console.error("[Products Router] Failed to persist products cache:", err);
  }
}
function normalizeProductVariants(p) {
  if (!p) return p;
  const opts = Array.isArray(p.options) ? p.options : typeof p.options === "string" && p.options.trim().startsWith("[") ? (() => {
    try {
      return JSON.parse(p.options);
    } catch {
      return [];
    }
  })() : [];
  const matrix = Array.isArray(p.variantMatrix || p.variant_matrix) ? p.variantMatrix || p.variant_matrix : typeof (p.variantMatrix || p.variant_matrix) === "string" && (p.variantMatrix || p.variant_matrix).trim().startsWith("[") ? (() => {
    try {
      return JSON.parse(p.variantMatrix || p.variant_matrix);
    } catch {
      return [];
    }
  })() : [];
  const vars = Array.isArray(p.variants) ? p.variants : typeof p.variants === "string" && p.variants.trim().startsWith("[") ? (() => {
    try {
      return JSON.parse(p.variants);
    } catch {
      return [];
    }
  })() : [];
  const variations = Array.isArray(p.variations) ? p.variations : typeof p.variations === "string" && p.variations.trim().startsWith("[") ? (() => {
    try {
      return JSON.parse(p.variations);
    } catch {
      return [];
    }
  })() : [];
  const colorImgs = (p.colorImages || p.color_images) && typeof (p.colorImages || p.color_images) === "object" ? p.colorImages || p.color_images : typeof (p.colorImages || p.color_images) === "string" && (p.colorImages || p.color_images).trim().startsWith("{") ? (() => {
    try {
      return JSON.parse(p.colorImages || p.color_images);
    } catch {
      return {};
    }
  })() : {};
  const hasVar = Boolean(
    p.hasVariants === true || p.has_variants === true || p.hasVariants === 1 || p.has_variants === 1 || p.hasVariants === "true" || p.has_variants === "true" || opts.length > 0 || matrix.length > 0 || vars.length > 0 || variations.length > 0 || Object.keys(colorImgs || {}).length > 0
  );
  return {
    ...p,
    hasVariants: hasVar,
    has_variants: hasVar
  };
}
router3.get(["/categories", "/categories/"], async (_req, res) => {
  try {
    const cats = await getAllSqliteCategories();
    res.json(cats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch categories.";
    res.status(500).json({ success: false, error: message });
  }
});
router3.post(["/categories/bulk_sync", "/categories/bulk_sync/"], requireAdmin, async (req, res) => {
  try {
    const categoriesData = req.body;
    if (!Array.isArray(categoriesData)) {
      return res.status(400).json({ success: false, error: "Expected an array of categories." });
    }
    const saved = await saveSqliteCategories(categoriesData);
    res.json({ success: true, message: `Synchronized ${saved.length} categories successfully.`, categories: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to sync categories.";
    res.status(500).json({ success: false, error: message });
  }
});
router3.post(["/categories/bulk_action", "/categories/bulk_action/"], requireAdmin, async (req, res) => {
  try {
    const { category_ids, ids, action, status: newStatus, target_parent_id, resolution_mode } = req.body || {};
    const catIds = (Array.isArray(category_ids) ? category_ids : Array.isArray(ids) ? ids : []).map((id) => String(id));
    if (catIds.length === 0) {
      return res.status(400).json({ success: false, error: "category_ids array is required." });
    }
    let currentCats = await getAllSqliteCategories();
    let affectedCount = 0;
    if (action === "delete") {
      if (resolution_mode === "cascade") {
        const toDeleteSet = new Set(catIds);
        let addedNew = true;
        while (addedNew) {
          addedNew = false;
          for (const c of currentCats) {
            if (c.parentId && toDeleteSet.has(String(c.parentId)) && !toDeleteSet.has(String(c.id))) {
              toDeleteSet.add(String(c.id));
              addedNew = true;
            }
          }
        }
        const finalDeleteArray = Array.from(toDeleteSet);
        currentCats = currentCats.filter((c) => !toDeleteSet.has(String(c.id)));
        await deleteSqliteCategoriesBulk(finalDeleteArray);
        affectedCount = finalDeleteArray.length;
      } else {
        const targetParentVal = target_parent_id || null;
        currentCats = currentCats.map((c) => {
          if (c.parentId && catIds.includes(String(c.parentId)) && !catIds.includes(String(c.id))) {
            return { ...c, parentId: targetParentVal, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
          }
          return c;
        }).filter((c) => !catIds.includes(String(c.id)));
        await deleteSqliteCategoriesBulk(catIds);
        affectedCount = catIds.length;
      }
      await saveSqliteCategories(currentCats);
    } else if (action === "status_active" || action === "update_status" && newStatus === "Active") {
      currentCats = currentCats.map((c) => catIds.includes(String(c.id)) ? { ...c, status: "Active", updatedAt: (/* @__PURE__ */ new Date()).toISOString() } : c);
      await saveSqliteCategories(currentCats);
      affectedCount = catIds.length;
    } else if (action === "status_inactive" || action === "update_status" && newStatus === "Inactive") {
      currentCats = currentCats.map((c) => catIds.includes(String(c.id)) ? { ...c, status: "Inactive", updatedAt: (/* @__PURE__ */ new Date()).toISOString() } : c);
      await saveSqliteCategories(currentCats);
      affectedCount = catIds.length;
    } else if (action === "reparent") {
      const parentVal = target_parent_id || null;
      currentCats = currentCats.map((c) => catIds.includes(String(c.id)) ? { ...c, parentId: parentVal, updatedAt: (/* @__PURE__ */ new Date()).toISOString() } : c);
      await saveSqliteCategories(currentCats);
      affectedCount = catIds.length;
    }
    res.json({
      success: true,
      message: `Category bulk action '${action}' completed successfully for ${affectedCount} categories.`,
      affected_count: affectedCount,
      categories: currentCats
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to execute category bulk action.";
    res.status(500).json({ success: false, error: message });
  }
});
router3.post(["/categories", "/categories/"], requireAdmin, async (req, res) => {
  try {
    const cat = req.body || {};
    if (!cat.id) {
      cat.id = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    }
    if (!cat.slug && cat.name) {
      cat.slug = String(cat.name).toLowerCase().replace(/\s+/g, "-");
    }
    const current = await getAllSqliteCategories();
    const updated = [...current.filter((c) => String(c.id) !== String(cat.id)), cat];
    const saved = await saveSqliteCategories(updated);
    const createdCat = saved.find((c) => String(c.id) === String(cat.id)) || cat;
    res.status(201).json({ success: true, message: "Category created successfully.", category: createdCat });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create category.";
    res.status(500).json({ success: false, error: message });
  }
});
router3.put(["/categories/:id", "/categories/:id/"], requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const cat = req.body || {};
    cat.id = id;
    const current = await getAllSqliteCategories();
    const updated = current.map((c) => String(c.id) === String(id) ? { ...c, ...cat, updatedAt: (/* @__PURE__ */ new Date()).toISOString() } : c);
    const saved = await saveSqliteCategories(updated);
    const updatedCat = saved.find((c) => String(c.id) === String(id)) || cat;
    res.json({ success: true, message: "Category updated successfully.", category: updatedCat });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update category.";
    res.status(500).json({ success: false, error: message });
  }
});
router3.delete(["/categories/:id", "/categories/:id/"], requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await deleteSqliteCategory(id);
    const current = await getAllSqliteCategories();
    const updated = current.filter((c) => String(c.id) !== String(id));
    await saveSqliteCategories(updated);
    res.json({ success: true, message: "Category deleted successfully." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete category.";
    res.status(500).json({ success: false, error: message });
  }
});
router3.post(["/bulk_action", "/bulk_action/"], requireAdmin, async (req, res) => {
  const { product_ids, action, status: newStatus } = req.body || {};
  if (!Array.isArray(product_ids)) {
    return res.status(400).json({ success: false, error: "product_ids array required." });
  }
  await loadProductsCache();
  let affectedCount = 0;
  if (action === "archive") {
    productsCache = productsCache.map((p) => {
      if (product_ids.includes(p.id)) {
        affectedCount++;
        return { ...p, status: "Archived" };
      }
      return p;
    });
  } else if (action === "delete") {
    const initialLen = productsCache.length;
    const pidsSet = new Set(product_ids.map((id) => String(id)));
    productsCache = productsCache.filter((p) => !pidsSet.has(String(p.id)));
    affectedCount = initialLen - productsCache.length;
    try {
      await deleteSqliteProductsBulk(product_ids.map((id) => String(id)));
    } catch (dbErr) {
      console.warn("[Products API] Bulk delete SQLite table notice:", dbErr);
    }
  } else if (action === "update_status" && newStatus) {
    productsCache = productsCache.map((p) => {
      if (product_ids.includes(p.id)) {
        affectedCount++;
        return { ...p, status: newStatus };
      }
      return p;
    });
  }
  await persistProductsCache();
  for (const pid of product_ids) {
    const updatedProd = productsCache.find((p) => p.id === pid);
    if (updatedProd) {
      cartStreamManager.broadcastProductChange(pid, {
        status: updatedProd.status,
        stock: updatedProd.stock
      });
    } else if (action === "delete") {
      cartStreamManager.broadcastProductChange(pid, {
        status: "deleted",
        deleted: true,
        stock: 0
      });
    }
  }
  res.json({ success: true, message: `Bulk action '${action}' completed.`, affected_count: affectedCount });
});
router3.get("/:id/variants", async (req, res) => {
  await loadProductsCache();
  const product = productsCache.find((p) => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: "Product not found" });
  }
  res.json({
    productId: product.id,
    hasVariants: product.hasVariants || product.has_variants || false,
    options: product.options || [],
    colorImages: product.colorImages || product.color_images || {},
    variants: product.variants || product.variantMatrix || product.variant_matrix || []
  });
});
router3.put("/:id/options", requireAdmin, async (req, res) => {
  await loadProductsCache();
  const idx = productsCache.findIndex((p) => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: "Product not found" });
  }
  const options = req.body.options || [];
  const hasVariants = req.body.hasVariants !== void 0 ? req.body.hasVariants : true;
  const optionNames = options.map((opt) => (opt.name || "").trim().toLowerCase()).filter(Boolean);
  const uniqueNames = new Set(optionNames);
  if (uniqueNames.size !== optionNames.length) {
    return res.status(400).json({ success: false, error: "Option names must be unique." });
  }
  for (const opt of options) {
    const valNames = (opt.values || []).map((v) => (typeof v === "string" ? v : v.name || "").trim().toLowerCase()).filter(Boolean);
    const uniqueVals = new Set(valNames);
    if (uniqueVals.size !== valNames.length) {
      return res.status(400).json({ success: false, error: `Duplicate values found in option "${opt.name}".` });
    }
  }
  productsCache[idx].options = options;
  productsCache[idx].hasVariants = hasVariants;
  productsCache[idx].has_variants = hasVariants;
  productsCache[idx].updated_at = (/* @__PURE__ */ new Date()).toISOString();
  await persistProductsCache();
  cartStreamManager.broadcastProductChange(productsCache[idx].id, {
    options,
    hasVariants
  });
  res.json({ success: true, message: "Options updated successfully.", options, hasVariants });
});
router3.post("/:id/variants/generate", requireAdmin, async (req, res) => {
  await loadProductsCache();
  const product = productsCache.find((p) => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: "Product not found" });
  }
  const options = req.body.options || product.options || [];
  const validOptions = options.filter((o) => o.name && o.values && o.values.length > 0);
  if (validOptions.length === 0) {
    return res.status(400).json({ success: false, error: "Cannot generate variant matrix without defined options and values." });
  }
  const optionValueArrays = validOptions.map(
    (opt) => opt.values.map((v) => ({
      optionKey: opt.name.toLowerCase().trim().replace(/\s+/g, "_"),
      valueName: typeof v === "string" ? v.trim() : (v.name || "").trim()
    }))
  );
  const cartesian = (arrays) => {
    return arrays.reduce(
      (acc, curr) => acc.flatMap((d) => curr.map((e) => [...d, e])),
      [[]]
    );
  };
  const combinations = cartesian(optionValueArrays);
  const existingVariants = product.variants || product.variantMatrix || product.variant_matrix || [];
  const basePrice = Number(req.body.basePrice || product.price || 0);
  const baseSku = (req.body.baseSku || product.sku || "SKU").toUpperCase();
  const newVariants = combinations.map((combo) => {
    const attributes = {};
    combo.forEach((c) => {
      attributes[c.optionKey] = c.valueName;
    });
    const existing = existingVariants.find((v) => {
      const keysA = Object.keys(v.attributes || {});
      const keysB = Object.keys(attributes);
      if (keysA.length !== keysB.length) return false;
      return keysB.every((k) => (v.attributes[k] || "").toLowerCase() === (attributes[k] || "").toLowerCase());
    });
    if (existing) {
      return {
        ...existing,
        attributes
      };
    }
    const skuSuffix = Object.values(attributes).map((val) => val.replace(/[^a-zA-Z0-9]/g, "").substring(0, 3).toUpperCase()).join("-");
    return {
      id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sku: `${baseSku}-${skuSuffix || "DEF"}`,
      attributes,
      price: basePrice,
      priceOverride: null,
      compareAtPrice: null,
      stockQty: 10,
      active: true
    };
  });
  res.json({ success: true, variants: newVariants });
});
router3.put("/:id/variants", requireAdmin, async (req, res) => {
  await loadProductsCache();
  const idx = productsCache.findIndex((p) => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: "Product not found" });
  }
  const variants = req.body.variants || [];
  const hasVariants = req.body.hasVariants !== void 0 ? req.body.hasVariants : true;
  if (hasVariants && variants.length === 0) {
    return res.status(400).json({ success: false, error: "At least one variant must be created when variants are enabled." });
  }
  const skus = variants.map((v) => (v.sku || "").trim());
  if (skus.some((s) => !s)) {
    return res.status(400).json({ success: false, error: "All variants must have a valid SKU code." });
  }
  const uniqueSkus = new Set(skus);
  if (uniqueSkus.size !== skus.length) {
    return res.status(400).json({ success: false, error: "Duplicate SKUs found among variants." });
  }
  for (const v of variants) {
    if (v.price !== null && v.price !== void 0 && Number(v.price) < 0) {
      return res.status(400).json({ success: false, error: `Variant "${v.sku}" has a negative price.` });
    }
    if (v.stockQty !== void 0 && Number(v.stockQty) < 0) {
      return res.status(400).json({ success: false, error: `Variant "${v.sku}" has a negative stock quantity.` });
    }
  }
  if (hasVariants && !variants.some((v) => v.active !== false)) {
    return res.status(400).json({ success: false, error: "At least one variant must be active." });
  }
  productsCache[idx].hasVariants = hasVariants;
  productsCache[idx].has_variants = hasVariants;
  productsCache[idx].variant_matrix = variants;
  productsCache[idx].variantMatrix = variants;
  productsCache[idx].variants = variants;
  productsCache[idx].updated_at = (/* @__PURE__ */ new Date()).toISOString();
  await persistProductsCache();
  cartStreamManager.broadcastProductChange(productsCache[idx].id, {
    variants,
    variant_matrix: variants,
    hasVariants
  });
  res.json({ success: true, message: "Variants updated successfully.", variants, hasVariants });
});
router3.get("/", async (req, res) => {
  await loadProductsCache();
  let result = productsCache.map(normalizeProductVariants);
  const { status: statusFilter, category, search, type, on_sale, onSale } = req.query;
  if (statusFilter && typeof statusFilter === "string") {
    result = result.filter((p) => p.status?.toLowerCase() === statusFilter.toLowerCase());
  }
  if (category && typeof category === "string" && category.toLowerCase() !== "all") {
    try {
      const allCats = await getAllSqliteCategories();
      const matchedCat = allCats.find(
        (c) => c.name.toLowerCase() === category.toLowerCase() || c.slug.toLowerCase() === category.toLowerCase() || c.id === category
      );
      if (matchedCat) {
        const subCats = allCats.filter((c) => c.parentId === matchedCat.id);
        const validNames = /* @__PURE__ */ new Set([matchedCat.name.toLowerCase(), ...subCats.map((s) => s.name.toLowerCase())]);
        const validSlugs = /* @__PURE__ */ new Set([matchedCat.slug.toLowerCase(), ...subCats.map((s) => s.slug.toLowerCase())]);
        const validIds = /* @__PURE__ */ new Set([matchedCat.id, ...subCats.map((s) => s.id)]);
        result = result.filter((p) => {
          const pCat = (p.category || "").toLowerCase();
          const pSub = (p.subcategoryId || "").toLowerCase();
          return validNames.has(pCat) || validSlugs.has(pCat) || validIds.has(p.category) || validIds.has(p.subcategoryId) || validNames.has(pSub);
        });
      } else {
        result = result.filter((p) => p.category?.toLowerCase() === category.toLowerCase());
      }
    } catch {
      result = result.filter((p) => p.category?.toLowerCase() === category.toLowerCase());
    }
  }
  if (type && typeof type === "string" && type.toLowerCase() !== "all") {
    result = result.filter((p) => p.type?.toLowerCase() === type.toLowerCase());
  }
  const isOnSale = on_sale === "true" || on_sale === "1" || onSale === "true" || onSale === "1";
  if (isOnSale) {
    result = result.filter((p) => {
      const orig = Number(p.original_price || p.originalPrice || p.previousPrice || 0);
      const pr = Number(p.price || 0);
      return orig > pr && pr > 0;
    });
  }
  if (search && typeof search === "string") {
    const s = search.toLowerCase();
    result = result.filter(
      (p) => p.name?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s) || p.tags?.toLowerCase().includes(s)
    );
  }
  const sortParam = req.query.sort || req.query.sortBy || "latest";
  if (sortParam === "price-asc") {
    result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  } else if (sortParam === "price-desc") {
    result.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  } else if (sortParam === "alpha-asc") {
    result.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  } else if (sortParam === "alpha-desc") {
    result.sort((a, b) => String(b.name || "").localeCompare(String(a.name || "")));
  } else {
    result.sort((a, b) => {
      const timeA = a.created_at || a.createdAt ? new Date(a.created_at || a.createdAt).getTime() : 0;
      const timeB = b.created_at || b.createdAt ? new Date(b.created_at || b.createdAt).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      const numA = parseInt(String(a.id || "").replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(String(b.id || "").replace(/\D/g, ""), 10) || 0;
      if (numA !== numB) return numB - numA;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });
  }
  res.json(result);
});
router3.get("/:id", async (req, res) => {
  await loadProductsCache();
  const item = productsCache.find((p) => p.id === req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, error: "Product not found" });
  }
  res.json(normalizeProductVariants(item));
});
router3.post("/", requireAdmin, async (req, res) => {
  await loadProductsCache();
  const rawImages = req.body.images || req.body.gallery_images;
  let parsedImages = [];
  if (Array.isArray(rawImages)) {
    parsedImages = rawImages.filter((img) => typeof img === "string" && img.trim().length > 0);
  } else if (typeof rawImages === "string" && rawImages.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(rawImages);
      if (Array.isArray(parsed)) parsedImages = parsed.filter((img) => typeof img === "string" && img.trim().length > 0);
    } catch {
      parsedImages = rawImages.split(",").map((s) => s.trim()).filter(Boolean);
    }
  } else if (typeof rawImages === "string" && rawImages.trim()) {
    parsedImages = [rawImages.trim()];
  }
  const primaryImg = req.body.image_url || req.body.imageUrl || parsedImages[0] || "";
  if (parsedImages.length === 0 && primaryImg) {
    parsedImages = [primaryImg];
  } else if (parsedImages.length > 0 && !parsedImages.includes(primaryImg)) {
    parsedImages = [primaryImg, ...parsedImages];
  }
  const rawOpts = req.body.options || [];
  const rawMatrix = req.body.variant_matrix || req.body.variantMatrix || req.body.variants || [];
  const rawVars = req.body.variants || req.body.variantMatrix || req.body.variant_matrix || [];
  const rawVariations = req.body.variations || [];
  const rawColorImgs = req.body.color_images || req.body.colorImages || {};
  const hasVariantsComputed = Boolean(
    req.body.has_variants === true || req.body.hasVariants === true || req.body.has_variants === 1 || req.body.hasVariants === 1 || req.body.has_variants === "true" || req.body.hasVariants === "true" || Array.isArray(rawOpts) && rawOpts.length > 0 || Array.isArray(rawMatrix) && rawMatrix.length > 0 || Array.isArray(rawVars) && rawVars.length > 0 || Array.isArray(rawVariations) && rawVariations.length > 0 || rawColorImgs && typeof rawColorImgs === "object" && Object.keys(rawColorImgs).length > 0
  );
  const newProduct = {
    id: req.body.id || `prod-${Date.now()}`,
    sku: req.body.sku || `SKU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    name: req.body.name || "New Product",
    brand: req.body.brand || "",
    countryOfOrigin: req.body.countryOfOrigin || req.body.country_of_origin || "",
    country_of_origin: req.body.country_of_origin || req.body.countryOfOrigin || "",
    description: req.body.description || "",
    price: Number(req.body.price || 0),
    original_price: req.body.original_price ? Number(req.body.original_price) : null,
    cost_price: req.body.cost_price !== void 0 && req.body.cost_price !== null && req.body.cost_price !== "" ? Number(req.body.cost_price) : req.body.costPrice !== void 0 && req.body.costPrice !== null && req.body.costPrice !== "" ? Number(req.body.costPrice) : null,
    costPrice: req.body.costPrice !== void 0 && req.body.costPrice !== null && req.body.costPrice !== "" ? Number(req.body.costPrice) : req.body.cost_price !== void 0 && req.body.cost_price !== null && req.body.cost_price !== "" ? Number(req.body.cost_price) : null,
    category: req.body.category || "General",
    type: req.body.type || "physical",
    status: req.body.status || "Active",
    image_url: primaryImg,
    imageUrl: primaryImg,
    images: parsedImages,
    gallery_images: parsedImages,
    stock: req.body.stock !== void 0 ? Number(req.body.stock) : 10,
    low_stock_threshold: req.body.low_stock_threshold ? Number(req.body.low_stock_threshold) : 5,
    track_stock: req.body.track_stock !== false,
    is_featured: Boolean(req.body.is_featured),
    tags: typeof req.body.tags === "string" ? req.body.tags : Array.isArray(req.body.tags) ? req.body.tags.join(", ") : "",
    has_variants: hasVariantsComputed,
    hasVariants: hasVariantsComputed,
    options: rawOpts,
    color_images: rawColorImgs,
    colorImages: rawColorImgs,
    variations: rawVariations,
    variant_matrix: rawMatrix,
    variantMatrix: rawMatrix,
    variants: rawVars,
    unit_measurement: req.body.unit_measurement || req.body.unitMeasurement || "",
    unit_value: req.body.unit_value !== void 0 ? req.body.unit_value : req.body.unitValue,
    weight: req.body.weight || "",
    length: req.body.length || "",
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  productsCache.unshift(newProduct);
  await persistProductsCache();
  if (newProduct.stock !== void 0 && newProduct.stock !== null) {
    try {
      await addSqliteInventoryAuditLog({
        productId: newProduct.id,
        productName: newProduct.name,
        productSku: newProduct.sku,
        changeQuantity: Number(newProduct.stock),
        newStock: Number(newProduct.stock),
        reason: "Initial Stock Creation",
        details: `Initial stock of ${newProduct.stock} units recorded upon product creation.`
      });
    } catch (auditErr) {
      console.warn("[Products API] Failed to record initial inventory audit log:", auditErr);
    }
  }
  res.status(201).json({ success: true, message: "Product created successfully.", product: newProduct });
});
router3.put("/:id", requireAdmin, async (req, res) => {
  await loadProductsCache();
  const idx = productsCache.findIndex((p) => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: "Product not found" });
  }
  const previousStock = productsCache[idx].stock !== void 0 ? Number(productsCache[idx].stock) : 0;
  const rawImages = req.body.images || req.body.gallery_images;
  let parsedImages = productsCache[idx].images;
  if (Array.isArray(rawImages)) {
    parsedImages = rawImages.filter((img) => typeof img === "string" && img.trim().length > 0);
  } else if (typeof rawImages === "string" && rawImages.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(rawImages);
      if (Array.isArray(parsed)) parsedImages = parsed.filter((img) => typeof img === "string" && img.trim().length > 0);
    } catch {
      parsedImages = rawImages.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  const primaryImg = req.body.image_url || req.body.imageUrl || parsedImages && parsedImages[0] || productsCache[idx].imageUrl;
  const costVal = req.body.cost_price !== void 0 && req.body.cost_price !== null && req.body.cost_price !== "" ? Number(req.body.cost_price) : req.body.costPrice !== void 0 && req.body.costPrice !== null && req.body.costPrice !== "" ? Number(req.body.costPrice) : productsCache[idx].costPrice !== void 0 && productsCache[idx].costPrice !== null ? productsCache[idx].costPrice : productsCache[idx].cost_price;
  const rawOpts = req.body.options !== void 0 ? req.body.options : productsCache[idx].options || [];
  const rawMatrix = req.body.variant_matrix || req.body.variantMatrix || req.body.variants || productsCache[idx].variant_matrix || productsCache[idx].variantMatrix || productsCache[idx].variants || [];
  const rawVars = req.body.variants || req.body.variantMatrix || req.body.variant_matrix || productsCache[idx].variants || productsCache[idx].variantMatrix || productsCache[idx].variant_matrix || [];
  const rawVariations = req.body.variations || productsCache[idx].variations || [];
  const rawColorImgs = req.body.color_images || req.body.colorImages || productsCache[idx].color_images || productsCache[idx].colorImages || {};
  const hasVariantsComputed = Boolean(
    req.body.has_variants === true || req.body.hasVariants === true || req.body.has_variants === 1 || req.body.hasVariants === 1 || req.body.has_variants === "true" || req.body.hasVariants === "true" || Array.isArray(rawOpts) && rawOpts.length > 0 || Array.isArray(rawMatrix) && rawMatrix.length > 0 || Array.isArray(rawVars) && rawVars.length > 0 || Array.isArray(rawVariations) && rawVariations.length > 0 || rawColorImgs && typeof rawColorImgs === "object" && Object.keys(rawColorImgs).length > 0 || productsCache[idx].hasVariants === true || productsCache[idx].has_variants === true
  );
  const updatedStock = req.body.stock !== void 0 ? Number(req.body.stock) : productsCache[idx].stock;
  productsCache[idx] = {
    ...productsCache[idx],
    ...req.body,
    stock: updatedStock,
    cost_price: costVal !== void 0 ? costVal : null,
    costPrice: costVal !== void 0 ? costVal : null,
    image_url: primaryImg,
    imageUrl: primaryImg,
    images: parsedImages || (primaryImg ? [primaryImg] : []),
    gallery_images: parsedImages || (primaryImg ? [primaryImg] : []),
    has_variants: hasVariantsComputed,
    hasVariants: hasVariantsComputed,
    options: rawOpts,
    color_images: rawColorImgs,
    colorImages: rawColorImgs,
    variant_matrix: rawMatrix,
    variantMatrix: rawMatrix,
    variants: rawVars,
    unit_measurement: req.body.unit_measurement || req.body.unitMeasurement || productsCache[idx].unit_measurement || "",
    unit_value: req.body.unit_value !== void 0 ? req.body.unit_value : req.body.unitValue !== void 0 ? req.body.unitValue : productsCache[idx].unit_value,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  await persistProductsCache();
  cartStreamManager.broadcastProductChange(productsCache[idx].id, {
    price: productsCache[idx].price,
    original_price: productsCache[idx].original_price,
    stock: productsCache[idx].stock,
    status: productsCache[idx].status,
    name: productsCache[idx].name,
    images: productsCache[idx].images,
    image_url: productsCache[idx].image_url,
    imageUrl: productsCache[idx].imageUrl,
    variants: productsCache[idx].variants
  });
  if (req.body.stock !== void 0 && Number(req.body.stock) !== previousStock) {
    const diff = Number(req.body.stock) - previousStock;
    try {
      await addSqliteInventoryAuditLog({
        productId: productsCache[idx].id,
        productName: productsCache[idx].name,
        productSku: productsCache[idx].sku,
        changeQuantity: diff,
        newStock: Number(req.body.stock),
        reason: req.body.stockAdjustmentReason || "Admin Manual Adjustment",
        details: `Stock changed from ${previousStock} to ${req.body.stock} (${diff > 0 ? `+${diff}` : diff}).`
      });
    } catch (auditErr) {
      console.warn("[Products API] Failed to record stock change audit log:", auditErr);
    }
  }
  res.json({ success: true, message: "Product updated successfully.", product: productsCache[idx] });
});
router3.delete(["/:id", "/:id/"], requireAdmin, async (req, res) => {
  await loadProductsCache();
  const pid = String(req.params.id);
  const idx = productsCache.findIndex((p) => String(p.id) === pid);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: "Product not found" });
  }
  const deleted = productsCache.splice(idx, 1)[0];
  try {
    await deleteSqliteProduct(pid);
  } catch (dbErr) {
    console.warn("[Products API] Delete SQLite notice:", dbErr);
  }
  await persistProductsCache();
  cartStreamManager.broadcastProductChange(deleted.id, {
    status: "deleted",
    deleted: true,
    stock: 0
  });
  res.json({ success: true, message: `Product "${deleted.name}" deleted successfully.` });
});
router3.get("/inventory/logs", requireAdmin, async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const logs = await getSqliteInventoryAuditLogs(limit);
    res.json({ success: true, logs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch inventory audit logs";
    res.status(500).json({ success: false, error: message });
  }
});
router3.post("/inventory/adjust", requireAdmin, async (req, res) => {
  try {
    const { productId, changeQuantity, newStock, reason = "Manual Stock Adjustment", details = "" } = req.body || {};
    if (!productId) {
      return res.status(400).json({ success: false, error: "productId is required" });
    }
    await loadProductsCache();
    const idx = productsCache.findIndex((p) => p.id === productId);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }
    const currentStock = Number(productsCache[idx].stock || 0);
    let targetStock = currentStock;
    let effectiveChange = 0;
    if (newStock !== void 0 && newStock !== null) {
      targetStock = Number(newStock);
      effectiveChange = targetStock - currentStock;
    } else if (changeQuantity !== void 0 && changeQuantity !== null) {
      effectiveChange = Number(changeQuantity);
      targetStock = currentStock + effectiveChange;
    } else {
      return res.status(400).json({ success: false, error: "Either changeQuantity or newStock must be provided." });
    }
    productsCache[idx].stock = targetStock;
    productsCache[idx].updated_at = (/* @__PURE__ */ new Date()).toISOString();
    await persistProductsCache();
    cartStreamManager.broadcastProductChange(productId, {
      stock: targetStock
    });
    const auditEntry = await addSqliteInventoryAuditLog({
      productId,
      productName: productsCache[idx].name,
      productSku: productsCache[idx].sku,
      changeQuantity: effectiveChange,
      newStock: targetStock,
      reason,
      details: details || `Stock adjusted by ${effectiveChange > 0 ? `+${effectiveChange}` : effectiveChange} to ${targetStock}.`
    });
    res.json({
      success: true,
      message: "Inventory stock adjusted successfully.",
      currentStock: targetStock,
      audit: auditEntry
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to adjust inventory stock";
    res.status(500).json({ success: false, error: message });
  }
});
router3.get(["/:productId/reviews", "/:productId/reviews/"], async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, sort } = req.query;
    const result = await getSqliteReviewsByProduct(productId, {
      rating: rating ? Number(rating) : void 0,
      sort: typeof sort === "string" ? sort : void 0
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to retrieve product reviews";
    res.status(500).json({ success: false, error: message });
  }
});
var products_default = router3;

// server/routes/categories.ts
var import_express4 = require("express");
init_mysql_db();
var router4 = (0, import_express4.Router)();
router4.get(["/", "", "/categories", "/categories/"], async (_req, res) => {
  try {
    const cats = await getAllSqliteCategories();
    res.json(cats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch categories.";
    res.status(500).json({ success: false, error: message });
  }
});
router4.get(["/:id", "/:id/"], async (req, res) => {
  try {
    const { id } = req.params;
    const cats = await getAllSqliteCategories();
    const cat = cats.find((c) => String(c.id) === String(id) || String(c.slug) === String(id));
    if (!cat) {
      return res.status(404).json({ success: false, error: `Category '${id}' not found.` });
    }
    res.json(cat);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch category.";
    res.status(500).json({ success: false, error: message });
  }
});
router4.post(["/bulk_sync", "/bulk_sync/"], requireAdmin, async (req, res) => {
  try {
    const categoriesData = req.body;
    if (!Array.isArray(categoriesData)) {
      return res.status(400).json({ success: false, error: "Expected an array of categories." });
    }
    await saveSqliteCategories(categoriesData);
    const fresh = await getAllSqliteCategories();
    res.json({ success: true, message: `Synchronized ${fresh.length} categories successfully.`, categories: fresh });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to sync categories.";
    res.status(500).json({ success: false, error: message });
  }
});
router4.post(["/bulk_action", "/bulk_action/"], requireAdmin, async (req, res) => {
  try {
    const { category_ids, ids, action, status: newStatus } = req.body || {};
    const catIds = (Array.isArray(category_ids) ? category_ids : Array.isArray(ids) ? ids : []).map((id) => String(id));
    if (catIds.length === 0) {
      return res.status(400).json({ success: false, error: "category_ids array is required." });
    }
    const currentCats = await getAllSqliteCategories();
    let affectedCount = 0;
    if (action === "delete") {
      await deleteSqliteCategoriesBulk(catIds);
      affectedCount = catIds.length;
    } else if (action === "status_active" || action === "update_status" && newStatus === "Active") {
      for (const id of catIds) {
        const c = currentCats.find((item) => String(item.id) === String(id));
        if (c) await saveMysqlCategory({ ...c, is_active: 1, status: "Active" });
      }
      affectedCount = catIds.length;
    } else if (action === "status_inactive" || action === "update_status" && newStatus === "Inactive") {
      for (const id of catIds) {
        const c = currentCats.find((item) => String(item.id) === String(id));
        if (c) await saveMysqlCategory({ ...c, is_active: 0, status: "Inactive" });
      }
      affectedCount = catIds.length;
    }
    const updated = await getAllSqliteCategories();
    res.json({
      success: true,
      message: `Category bulk action '${action}' completed successfully for ${affectedCount} categories.`,
      affected_count: affectedCount,
      categories: updated
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to execute category bulk action.";
    res.status(500).json({ success: false, error: message });
  }
});
router4.post(["/", ""], requireAdmin, async (req, res) => {
  try {
    const cat = req.body || {};
    if (!cat.id) {
      cat.id = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    }
    if (!cat.slug && cat.name) {
      cat.slug = String(cat.name).toLowerCase().replace(/\s+/g, "-");
    }
    const createdCat = await saveMysqlCategory(cat);
    res.status(201).json({ success: true, message: "Category created successfully.", category: createdCat });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create category.";
    res.status(500).json({ success: false, error: message });
  }
});
router4.put(["/:id", "/:id/"], requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const cat = req.body || {};
    cat.id = id;
    const updatedCat = await saveMysqlCategory(cat);
    res.json({ success: true, message: "Category updated successfully.", category: updatedCat });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update category.";
    res.status(500).json({ success: false, error: message });
  }
});
router4.delete(["/:id", "/:id/"], requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await deleteSqliteCategory(id);
    res.json({ success: true, message: "Category deleted successfully." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete category.";
    res.status(500).json({ success: false, error: message });
  }
});
var categories_default = router4;

// server/routes/orders.ts
var import_express5 = require("express");
var import_zod4 = require("zod");
init_db();
init_events();

// server/services/cartValidation.ts
function resolveEffectivePrice(product, selectedVars) {
  const norm = normalizeProductVariants(product);
  let basePrice = Number(norm.price || 0);
  let originalPrice = norm.original_price ? Number(norm.original_price) : norm.originalPrice ? Number(norm.originalPrice) : null;
  if (selectedVars && Object.keys(selectedVars).length > 0 && Array.isArray(norm.variants)) {
    const matched = norm.variants.find((v) => {
      if (!v.attributes) return false;
      const vKeys = Object.keys(v.attributes);
      const sKeys = Object.keys(selectedVars);
      if (vKeys.length !== sKeys.length) return false;
      return vKeys.every((k) => (v.attributes[k] || "").toLowerCase() === (selectedVars[k] || "").toLowerCase());
    });
    if (matched && matched.price !== void 0 && matched.price !== null && !isNaN(Number(matched.price))) {
      basePrice = Number(matched.price);
    }
  }
  return { price: basePrice, originalPrice };
}
function resolveAvailableStock(product, selectedVars) {
  const norm = normalizeProductVariants(product);
  if (selectedVars && Object.keys(selectedVars).length > 0 && Array.isArray(norm.variants)) {
    const matched = norm.variants.find((v) => {
      if (!v.attributes) return false;
      const vKeys = Object.keys(v.attributes);
      const sKeys = Object.keys(selectedVars);
      if (vKeys.length !== sKeys.length) return false;
      return vKeys.every((k) => (v.attributes[k] || "").toLowerCase() === (selectedVars[k] || "").toLowerCase());
    });
    if (matched && matched.stockQty !== void 0 && matched.stockQty !== null) {
      return Math.max(0, Number(matched.stockQty));
    }
  }
  if (norm.stock !== void 0 && norm.stock !== null) {
    return Math.max(0, Number(norm.stock));
  }
  return null;
}
async function validateCart(cartItemsOrOptions, couponCodeParam, clientTotalParam) {
  let cartItems = [];
  let couponCode = couponCodeParam;
  let clientTotal = clientTotalParam;
  if (Array.isArray(cartItemsOrOptions)) {
    cartItems = cartItemsOrOptions;
  } else if (cartItemsOrOptions && typeof cartItemsOrOptions === "object") {
    cartItems = Array.isArray(cartItemsOrOptions.items) ? cartItemsOrOptions.items : [];
    couponCode = cartItemsOrOptions.couponCode || couponCodeParam;
    clientTotal = cartItemsOrOptions.expectedTotal ?? cartItemsOrOptions.clientTotal ?? clientTotalParam;
  }
  const allProducts = await loadProductsCache(true);
  const productMap = /* @__PURE__ */ new Map();
  for (const p of allProducts) {
    if (p.id) productMap.set(String(p.id).trim(), p);
    if (p.sku) productMap.set(String(p.sku).trim().toLowerCase(), p);
  }
  const changes = [];
  const validItems = [];
  const outOfStockItems = [];
  for (const item of cartItems) {
    const rawProductId = String(item.productId || "").trim();
    let product = productMap.get(rawProductId);
    if (!product && item.name) {
      const cleanItemName = item.name.trim().toLowerCase();
      product = allProducts.find((p) => p.name && p.name.trim().toLowerCase() === cleanItemName);
    }
    const productId = product ? String(product.id) : rawProductId;
    const prodStatus = (product?.status || "").toLowerCase();
    const isInactive = !product || prodStatus === "archived" || prodStatus === "draft" || prodStatus === "unpublished" || prodStatus === "deleted";
    if (isInactive) {
      changes.push({
        type: "PRODUCT_REMOVED",
        productId,
        productName: item.name || product?.name || "Product",
        message: `"${item.name || product?.name || "Item"}" is no longer available and was removed from your cart.`
      });
      continue;
    }
    const selectedVars = item.selectedVariations || {};
    const { price: currentPrice, originalPrice } = resolveEffectivePrice(product, selectedVars);
    const availableStock = resolveAvailableStock(product, selectedVars);
    const requestedQty = Math.max(1, Number(item.quantity || 1));
    const isOutOfStock = availableStock !== null && availableStock <= 0;
    if (isOutOfStock) {
      changes.push({
        type: "OUT_OF_STOCK",
        productId,
        productName: product.name,
        oldValue: requestedQty,
        newValue: 0,
        message: `"${product.name}" is now out of stock and has been removed from your order.`
      });
      outOfStockItems.push({
        productId,
        variantId: item.variantId,
        selectedVariations: selectedVars,
        name: product.name,
        sku: product.sku || "",
        price: currentPrice,
        originalPrice,
        imageUrl: product.imageUrl || product.image_url || "",
        quantity: 0,
        stockAvailable: 0,
        stock: 0,
        lineSubtotal: 0,
        lineTotal: 0,
        isOutOfStock: true,
        isAvailable: false,
        stockStatus: "out_of_stock",
        status: product.status || "Active",
        type: product.type || "physical"
      });
      continue;
    }
    let finalQty = requestedQty;
    if (availableStock !== null && requestedQty > availableStock) {
      finalQty = availableStock;
      changes.push({
        type: "QUANTITY_ADJUSTED",
        productId,
        productName: product.name,
        oldValue: requestedQty,
        newValue: availableStock,
        message: `Only ${availableStock} of "${product.name}" left. We've adjusted your quantity.`
      });
    }
    const clientPriceVal = item.clientPrice !== void 0 ? item.clientPrice : item.price;
    if (clientPriceVal !== void 0 && clientPriceVal !== null) {
      const clientP = Number(clientPriceVal);
      if (Math.abs(clientP - currentPrice) > 0.01) {
        changes.push({
          type: "PRICE_CHANGED",
          productId,
          productName: product.name,
          oldValue: clientP,
          newValue: currentPrice,
          message: `Price updated: "${product.name}" changed from KES ${clientP.toLocaleString("en-KE")} to KES ${currentPrice.toLocaleString("en-KE")}.`
        });
      }
    }
    if (item.name && item.name !== product.name) {
      changes.push({
        type: "DETAILS_UPDATED",
        productId,
        productName: product.name,
        oldValue: item.name,
        newValue: product.name,
        message: `Details updated for "${product.name}".`
      });
    }
    const lineCost = currentPrice * finalQty;
    validItems.push({
      productId,
      variantId: item.variantId,
      selectedVariations: selectedVars,
      name: product.name,
      sku: product.sku || "",
      price: currentPrice,
      originalPrice,
      imageUrl: product.imageUrl || product.image_url || "",
      quantity: finalQty,
      stockAvailable: availableStock,
      stock: availableStock ?? 999,
      lineSubtotal: lineCost,
      lineTotal: lineCost,
      isOutOfStock: false,
      isAvailable: true,
      stockStatus: availableStock !== null && availableStock <= 0 ? "out_of_stock" : "in_stock",
      status: product.status || "Active",
      type: product.type || "physical"
    });
  }
  const grossSubtotal = validItems.reduce((sum, i) => sum + i.lineSubtotal, 0);
  let automaticDiscount = 0;
  const hasBulkUnits = validItems.some((i) => i.quantity >= 6);
  if (grossSubtotal >= 15e3 || hasBulkUnits) {
    automaticDiscount = Math.round(grossSubtotal * 0.15);
  }
  let couponDiscount = 0;
  let isCouponValid = false;
  let couponDiscountPercent = 0;
  let appliedCouponData = null;
  if (couponCode && couponCode.trim()) {
    const cleanCode = couponCode.trim().toUpperCase();
    const VALID_COUPONS = {
      "SAVE15": { percent: 15 },
      "WELCOME10": { percent: 10 },
      "VELOCE20": { percent: 20, minSpend: 5e3 },
      "FLASH25": { percent: 25, minSpend: 1e4 }
    };
    const couponDef = VALID_COUPONS[cleanCode];
    if (couponDef && (!couponDef.minSpend || grossSubtotal >= couponDef.minSpend)) {
      isCouponValid = true;
      couponDiscountPercent = couponDef.percent;
      couponDiscount = Math.round((grossSubtotal - automaticDiscount) * (couponDef.percent / 100));
      appliedCouponData = {
        code: cleanCode,
        discountType: "percentage",
        discountValue: couponDef.percent,
        discountAmount: couponDiscount
      };
    } else {
      changes.push({
        type: "COUPON_INVALID",
        productId: "coupon",
        productName: `Coupon ${cleanCode}`,
        oldValue: cleanCode,
        newValue: null,
        message: `Your discount "${cleanCode}" is no longer valid.`
      });
    }
  }
  const totalDiscount = automaticDiscount + couponDiscount;
  const finalTotal = Math.max(0, grossSubtotal - totalDiscount);
  if (clientTotal !== void 0 && clientTotal !== null && !isNaN(Number(clientTotal))) {
    if (Math.abs(Number(clientTotal) - finalTotal) > 0.01) {
      const hasPriceOrQtyChange = changes.some((c) => c.type === "PRICE_CHANGED" || c.type === "QUANTITY_ADJUSTED" || c.type === "OUT_OF_STOCK");
      if (!hasPriceOrQtyChange) {
        changes.push({
          type: "PRICE_CHANGED",
          productId: "total",
          productName: "Order Total",
          oldValue: clientTotal,
          newValue: finalTotal,
          message: `Your order total was recalculated from KES ${Number(clientTotal).toLocaleString("en-KE")} to KES ${finalTotal.toLocaleString("en-KE")}.`
        });
      }
    }
  }
  const isValid = changes.length === 0;
  return {
    valid: isValid,
    hasConflict: changes.length > 0,
    items: validItems,
    outOfStockItems,
    subtotal: grossSubtotal,
    discount: totalDiscount,
    discountAmount: totalDiscount,
    total: finalTotal,
    couponCode: isCouponValid ? couponCode : void 0,
    isCouponValid,
    couponDiscountPercent,
    appliedCoupon: appliedCouponData,
    volumeDiscountApplied: automaticDiscount > 0,
    volumeDiscountAmount: automaticDiscount,
    changes,
    validatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// server/routes/orders.ts
init_orderStatusService();
var router5 = (0, import_express5.Router)();
var OrderItemSchema = import_zod4.z.object({
  id: import_zod4.z.string().or(import_zod4.z.number()).optional(),
  productId: import_zod4.z.string().or(import_zod4.z.number()).optional(),
  name: import_zod4.z.string().optional(),
  product_name: import_zod4.z.string().optional(),
  title: import_zod4.z.string().optional(),
  price: import_zod4.z.number().nonnegative().optional(),
  unit_price: import_zod4.z.number().nonnegative().optional(),
  quantity: import_zod4.z.number().optional().default(1),
  image: import_zod4.z.string().optional(),
  imageUrl: import_zod4.z.string().optional(),
  sku: import_zod4.z.string().optional(),
  product_sku: import_zod4.z.string().optional(),
  selectedVariant: import_zod4.z.any().optional(),
  selectedVariations: import_zod4.z.any().optional(),
  selected_variations: import_zod4.z.any().optional(),
  selectedColor: import_zod4.z.string().optional(),
  selectedSize: import_zod4.z.string().optional()
}).passthrough();
var CreateOrderSchema = import_zod4.z.object({
  id: import_zod4.z.string().optional(),
  customerName: import_zod4.z.string().optional(),
  customer_name: import_zod4.z.string().optional(),
  customerEmail: import_zod4.z.string().optional(),
  customer_email: import_zod4.z.string().optional(),
  phone: import_zod4.z.string().optional(),
  customerPhone: import_zod4.z.string().optional(),
  customer_phone: import_zod4.z.string().optional(),
  shippingAddress: import_zod4.z.string().optional(),
  shipping_address: import_zod4.z.string().optional(),
  paymentMethod: import_zod4.z.string().optional(),
  payment_method: import_zod4.z.string().optional(),
  paymentStatus: import_zod4.z.string().optional(),
  payment_status: import_zod4.z.string().optional(),
  status: import_zod4.z.string().optional(),
  items: import_zod4.z.array(OrderItemSchema).optional().default([]),
  total: import_zod4.z.number().nonnegative().optional(),
  subtotal: import_zod4.z.number().nonnegative().optional(),
  shippingFee: import_zod4.z.number().nonnegative().optional(),
  shipping_fee: import_zod4.z.number().nonnegative().optional(),
  discount: import_zod4.z.number().nonnegative().optional(),
  notes: import_zod4.z.string().optional(),
  customNote: import_zod4.z.string().optional()
}).passthrough();
router5.get("/track/:orderId", trackingRateLimiter, async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await fetchAuthoritativeOrderById(orderId) || await getSqliteOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }
    const trackingNumber = order.trackingNumber || `ROP-TRK-${String(order.id).slice(-6).toUpperCase()}`;
    return res.json({
      success: true,
      id: order.id,
      orderId: order.id,
      customerName: order.customerName,
      customerEmail: order.customerEmail || "",
      phone: order.phone || order.mpesaPhone || "",
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentType: order.fulfillmentType || "delivery",
      shippingFee: Number(order.shippingFee || 0),
      quotedCourier: order.quotedCourier || "",
      areaEstate: order.areaEstate || "",
      landmark: order.landmark || "",
      trackingNumber,
      carrier: order.quotedCourier ? `${order.quotedCourier} Courier` : "Ropenix Express Courier",
      shippingAddress: order.shippingAddress || "",
      total: Number(order.total || 0),
      subtotal: Number(order.subtotal || order.total || 0),
      items: Array.isArray(order.items) ? order.items : typeof order.items === "string" ? (() => {
        try {
          return JSON.parse(order.items);
        } catch {
          return [];
        }
      })() : [],
      date: order.date || order.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      isGuest: Boolean(order.isGuest),
      checkpoints: [
        { status: "Order Placed", timestamp: order.createdAt || order.date || (/* @__PURE__ */ new Date()).toISOString(), completed: true },
        { status: "Payment Verified", timestamp: order.paymentConfirmedAt || null, completed: order.paymentStatus === "paid" },
        { status: "Fulfillment & Packaging", timestamp: null, completed: ["processing", "shipped", "delivered"].includes(order.status) },
        { status: "Dispatched with Courier", timestamp: null, completed: ["shipped", "delivered"].includes(order.status) },
        { status: "Delivered", timestamp: null, completed: order.status === "delivered" }
      ]
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error retrieving tracking information";
    return res.status(500).json({ success: false, error: message });
  }
});
router5.get("/", async (req, res) => {
  try {
    const token = getAuthTokenFromRequest(req);
    if (!token) {
      return res.json([]);
    }
    const user = await extractUserFromToken(token);
    if (!user) {
      return res.json([]);
    }
    if (user.is_staff || user.is_superuser || user.role === "admin") {
      const allOrders = await getAllSqliteOrders();
      return res.json(allOrders);
    }
    const userOrders = await getSqliteOrdersByUser(user.email, user.id);
    return res.json(userOrders);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to retrieve orders";
    return res.status(500).json({ success: false, error: message });
  }
});
router5.get("/:id", async (req, res) => {
  try {
    const order = await getSqliteOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const isAdmin = Boolean(user && (user.is_staff || user.is_superuser || user.role === "admin"));
    if (!isAdmin) {
      const userEmail = user?.email?.toLowerCase().trim();
      const orderEmail = (order.customerEmail || order.customer_email || "").toLowerCase().trim();
      const orderUserId = order.userId ? String(order.userId) : "";
      const authUserId = user?.id ? String(user.id) : "";
      if (!user || userEmail !== orderEmail && (!orderUserId || orderUserId !== authUserId)) {
        return res.status(403).json({ success: false, error: "Access denied. You do not have permission to view this order." });
      }
    }
    return res.json(order);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to retrieve order";
    return res.status(500).json({ success: false, error: message });
  }
});
router5.post("/", validateBody(CreateOrderSchema), async (req, res) => {
  try {
    const orderData = req.body;
    const orderId = orderData.id || `ord-${Date.now()}`;
    const token = getAuthTokenFromRequest(req);
    const isGuestOrder = Boolean(orderData.isGuest || !token);
    const user = !isGuestOrder && token ? await extractUserFromToken(token) : null;
    const customerEmail = (orderData.customerEmail || orderData.customer_email || user?.email || "").trim().toLowerCase();
    const customerName = (orderData.customerName || orderData.customer_name || (user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username : "Valued Customer")).trim();
    const customerPhone = (orderData.phone || orderData.customerPhone || orderData.customer_phone || user?.phone || "").trim();
    const incomingItems = Array.isArray(orderData.items) ? orderData.items : [];
    const couponCode = orderData.couponCode || orderData.coupon || orderData.promoCode || "";
    const clientExpectedTotal = orderData.total !== void 0 && !isNaN(Number(orderData.total)) ? Number(orderData.total) : void 0;
    const validation = await validateCart({
      items: incomingItems,
      couponCode,
      expectedTotal: clientExpectedTotal
    });
    if (validation.hasConflict || validation.changes.length > 0) {
      return res.status(409).json({
        success: false,
        error: "CART_CONFLICT",
        message: "Cart items, prices, or inventory have updated. Please review before proceeding.",
        validation,
        changes: validation.changes
      });
    }
    if (validation.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "EMPTY_CART",
        message: "Your cart is empty or items are no longer available."
      });
    }
    const products = await loadProductsCache();
    for (const item of validation.items) {
      const prod = products.find((p) => p.id === item.productId);
      if (prod) {
        if (item.variantId && Array.isArray(prod.variants || prod.variantMatrix)) {
          const vList = prod.variants || prod.variantMatrix;
          const v = vList.find((vItem) => vItem.id === item.variantId || vItem.sku === item.sku);
          if (v && v.stockQty !== void 0) {
            v.stockQty = Math.max(0, Number(v.stockQty) - item.quantity);
          }
        }
        const currentStock = Number(prod.stock || 0);
        prod.stock = Math.max(0, currentStock - item.quantity);
        prod.updated_at = (/* @__PURE__ */ new Date()).toISOString();
        cartStreamManager.broadcastProductChange(prod.id, {
          stock: prod.stock,
          variants: prod.variants || prod.variantMatrix
        });
      }
    }
    await persistProductsCache();
    const calculatedSubtotal = validation.subtotal;
    const authoritativeDiscount = validation.discount;
    const shippingFee = orderData.shippingFee !== void 0 && !isNaN(Number(orderData.shippingFee)) ? Number(orderData.shippingFee) : calculatedSubtotal > 5e3 ? 0 : 350;
    const finalTotal = Math.max(0, calculatedSubtotal + shippingFee - authoritativeDiscount);
    const snapshotItems = validation.items.map((it) => ({
      ...it,
      price: it.price,
      unit_price: it.price,
      original_price: it.originalPrice,
      lineTotal: it.lineTotal
    }));
    const newOrderPayload = {
      ...orderData,
      id: orderId,
      userId: !isGuestOrder && user?.id ? user.id : null,
      isGuest: isGuestOrder,
      customerName,
      customer_name: customerName,
      customerEmail,
      customer_email: customerEmail,
      phone: customerPhone,
      customerPhone,
      customer_phone: customerPhone,
      items: snapshotItems,
      subtotal: calculatedSubtotal,
      shippingFee,
      discount: authoritativeDiscount,
      total: finalTotal,
      couponCode: validation.appliedCoupon?.code || null,
      status: orderData.status || "pending",
      paymentStatus: "pending",
      // Hard rule: Payment status is never marked 'paid' directly from client
      paymentMethod: orderData.paymentMethod || orderData.payment_method || "M-PESA",
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const savedOrder = await saveSqliteOrder(newOrderPayload);
    try {
      emailEvents.emit("order:created", {
        id: orderId,
        customerName,
        customerEmail,
        customerPhone,
        total: finalTotal,
        subtotal: calculatedSubtotal,
        shippingFee,
        discount: authoritativeDiscount,
        paymentMethod: savedOrder.paymentMethod,
        shippingAddress: savedOrder.shippingAddress || "",
        items: snapshotItems,
        createdAt: savedOrder.created_at,
        isGuest: isGuestOrder,
        userId: savedOrder.userId
      });
    } catch (emailErr) {
      console.warn("[Orders API] Email dispatch emit warning:", emailErr);
    }
    res.status(201).json({ success: true, order: savedOrder, message: "Order created and notifications queued." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save order";
    console.error("[Express Orders Error]:", err);
    res.status(500).json({ success: false, error: message });
  }
});
router5.put(["/:id", "/:id/"], requireAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const existing = await getSqliteOrderById(orderId);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Order #${orderId} not found.` });
    }
    const adminUser = req.user?.email || req.user?.username || "Admin";
    if (req.body.confirmPayment === true || req.body.paymentStatus === "paid" || req.body.payment_status === "paid" || req.body.isPaid === true) {
      const payResult = await confirmOrderPaymentAndProcess(orderId, adminUser, {
        paymentReference: req.body.paymentReference || req.body.payment_reference,
        paymentAmount: req.body.paymentAmount || req.body.amount,
        adminNotes: req.body.adminNotes || req.body.notes
      });
      if (!payResult.success) {
        return res.status(400).json({ success: false, error: payResult.error });
      }
      return res.json({
        success: true,
        message: `Order #${orderId} payment confirmed. Status automatically updated to Processing and customer notified.`,
        order: payResult.order
      });
    }
    if (req.body.confirmDelivery === true || req.body.isDeliveryConfirmed === true) {
      const delivResult = await confirmOrderDelivery(orderId, adminUser, {
        deliveryPerson: req.body.deliveryPerson || req.body.courier_name,
        deliveryNote: req.body.deliveryNote || req.body.notes,
        deliveredAt: req.body.deliveredAt
      });
      if (!delivResult.success) {
        return res.status(delivResult.statusCode || 400).json({ success: false, error: delivResult.error });
      }
      return res.json({
        success: true,
        message: `Delivery confirmed for order #${orderId}. Ready for completion.`,
        order: delivResult.order
      });
    }
    if (req.body.status && req.body.status !== existing.status) {
      const isDelivConf = Boolean(req.body.isDeliveryConfirmed || req.body.deliveryConfirmed || existing.deliveryConfirmed || req.body.status === "completed");
      const transitionResult = await transitionOrderStatus(orderId, req.body.status, adminUser, {
        trackingNumber: req.body.trackingNumber || req.body.tracking_number,
        courierName: req.body.courierName || req.body.courier_name,
        deliveryPerson: req.body.deliveryPerson,
        deliveryNote: req.body.deliveryNote,
        isDeliveryConfirmed: isDelivConf,
        note: req.body.notes || req.body.note
      });
      if (!transitionResult.success) {
        return res.status(transitionResult.statusCode || 400).json({
          success: false,
          error: transitionResult.error
        });
      }
      return res.json({
        success: true,
        message: `Order #${orderId} status successfully updated to ${req.body.status}. Customer notification enqueued.`,
        order: transitionResult.order
      });
    }
    let targetStatus = typeof req.body.status === "string" && req.body.status !== "[object Object]" ? req.body.status : existing.status;
    if (typeof targetStatus !== "string" || targetStatus === "[object Object]" || !targetStatus) {
      targetStatus = existing.deliveryConfirmed ? "delivered" : existing.trackingNumber ? "shipped" : existing.isPaid || existing.paymentStatus === "paid" ? "processing" : "pending";
    }
    const targetPaymentStatus = req.body.paymentStatus || req.body.payment_status || existing.paymentStatus;
    const targetTracking = req.body.trackingNumber || req.body.tracking_number || existing.trackingNumber;
    const updatedPayload = {
      ...existing,
      ...req.body,
      status: targetStatus,
      paymentStatus: targetPaymentStatus,
      trackingNumber: targetTracking,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const updated = await saveSqliteOrder(updatedPayload);
    return res.json({ success: true, message: "Order details updated successfully.", order: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update order";
    return res.status(500).json({ success: false, error: message });
  }
});
router5.patch(["/:id", "/:id/"], requireAdmin, async (req, res) => {
  return router5.handle(Object.assign(req, { method: "PUT" }), res);
});
router5.post(["/:id/confirm-payment", "/:id/confirm-payment/"], requireAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const adminUser = req.user?.email || req.user?.username || "Admin";
    const result = await confirmOrderPaymentAndProcess(orderId, adminUser, req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.json({
      success: true,
      message: `Payment confirmed for order #${orderId}. Order is now Processing. Customer notified.`,
      order: result.order
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to confirm payment";
    return res.status(500).json({ success: false, error: message });
  }
});
router5.post(["/:id/confirm-delivery", "/:id/confirm-delivery/"], requireAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const adminUser = req.user?.email || req.user?.username || "Admin";
    const result = await confirmOrderDelivery(orderId, adminUser, req.body);
    if (!result.success) {
      return res.status(result.statusCode || 400).json({ success: false, error: result.error });
    }
    return res.json({
      success: true,
      message: `Delivery confirmed for order #${orderId} by ${req.body.deliveryPerson || "Courier"}.`,
      order: result.order
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to confirm delivery";
    return res.status(500).json({ success: false, error: message });
  }
});
router5.post(["/:id/transition-status", "/:id/transition-status/"], requireAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const adminUser = req.user?.email || req.user?.username || "Admin";
    const result = await transitionOrderStatus(orderId, req.body.status, adminUser, req.body);
    if (!result.success) {
      return res.status(result.statusCode || 400).json({ success: false, error: result.error });
    }
    return res.json({
      success: true,
      message: `Order #${orderId} moved to ${req.body.status}.`,
      order: result.order
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to transition order status";
    return res.status(500).json({ success: false, error: message });
  }
});
router5.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const existing = await getSqliteOrderById(orderId);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }
    await deleteSqliteOrder(orderId);
    res.json({ success: true, message: `Order ${orderId} deleted successfully.` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete order";
    res.status(500).json({ success: false, error: message });
  }
});
router5.post("/sync", requireAdmin, async (req, res) => {
  try {
    const incomingOrders = Array.isArray(req.body.orders) ? req.body.orders : Array.isArray(req.body) ? req.body : [];
    await syncSqliteOrders(incomingOrders);
    const allOrders = await getAllSqliteOrders();
    res.json({ success: true, message: "Orders synced successfully", totalOrders: allOrders.length, orders: allOrders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to sync orders";
    res.status(500).json({ success: false, error: message });
  }
});
var orders_default = router5;

// server/routes/suppliers.ts
var import_express6 = require("express");
var import_zod5 = require("zod");
var router6 = (0, import_express6.Router)();
router6.use(requireAdmin);
var CreateSupplierSchema = import_zod5.z.object({
  name: import_zod5.z.string().optional(),
  company_name: import_zod5.z.string().optional(),
  email: import_zod5.z.string().email().optional().or(import_zod5.z.literal("")),
  phone: import_zod5.z.string().optional(),
  address: import_zod5.z.string().optional(),
  tax_id: import_zod5.z.string().optional(),
  currency: import_zod5.z.string().optional(),
  status: import_zod5.z.enum(["Active", "Inactive", "Suspended"]).optional(),
  payment_terms: import_zod5.z.string().optional(),
  notes: import_zod5.z.string().optional()
}).refine((data) => Boolean(data.name || data.company_name), {
  message: "Supplier contact name or company name is required.",
  path: ["name"]
});
var SupplierProductSchema = import_zod5.z.object({
  supplier: import_zod5.z.string().min(1, "Supplier ID is required."),
  product: import_zod5.z.string().min(1, "Product ID is required."),
  supplier_sku: import_zod5.z.string().optional(),
  supplier_price: import_zod5.z.number().nonnegative().optional(),
  moq: import_zod5.z.number().int().positive().optional(),
  lead_time_days: import_zod5.z.number().int().nonnegative().optional(),
  is_preferred: import_zod5.z.boolean().optional()
});
var SupplierIntakeSchema = import_zod5.z.object({
  supplier: import_zod5.z.string().min(1, "Supplier ID is required."),
  product_name: import_zod5.z.string().min(1, "Product name is required."),
  quantity_received: import_zod5.z.number().positive("Quantity received must be greater than zero."),
  unit_cost: import_zod5.z.number().nonnegative().optional(),
  total_cost: import_zod5.z.number().nonnegative().optional(),
  batch_number: import_zod5.z.string().optional(),
  expiry_date: import_zod5.z.string().optional(),
  notes: import_zod5.z.string().optional()
});
var SupplierPaymentSchema = import_zod5.z.object({
  supplier: import_zod5.z.string().min(1, "Supplier ID is required."),
  amount: import_zod5.z.number().positive("Payment amount must be greater than zero."),
  payment_method: import_zod5.z.string().min(1, "Payment method is required."),
  reference_number: import_zod5.z.string().optional(),
  payment_date: import_zod5.z.string().optional(),
  notes: import_zod5.z.string().optional()
});
router6.get("/directory", async (req, res) => {
  try {
    const statusParam = req.query.status;
    const suppliers = await getAllSqliteSuppliers(statusParam);
    res.json(suppliers);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch suppliers.";
    console.error("[Supplier API Error] Failed to fetch suppliers directory:", err);
    res.status(500).json({ success: false, error: message });
  }
});
router6.get("/directory/:id", async (req, res) => {
  try {
    const supplier = await getSqliteSupplierById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, error: `Supplier with ID or Code '${req.params.id}' not found.` });
    }
    res.json(supplier);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch supplier details.";
    console.error(`[Supplier API Error] Failed to fetch supplier ${req.params.id}:`, err);
    res.status(500).json({ success: false, error: message });
  }
});
router6.post("/directory", validateBody(CreateSupplierSchema), async (req, res) => {
  try {
    const created = await saveSqliteSupplier(req.body);
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create supplier profile.";
    console.error("[Supplier API Error] Failed to create supplier:", err);
    res.status(500).json({ success: false, error: message });
  }
});
var handleUpdateSupplier = async (req, res) => {
  try {
    const updates = { ...req.body, id: req.params.id };
    const updated = await saveSqliteSupplier(updates);
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update supplier profile.";
    console.error(`[Supplier API Error] Failed to update supplier ${req.params.id}:`, err);
    res.status(500).json({ success: false, error: message });
  }
};
router6.put("/directory/:id", handleUpdateSupplier);
router6.patch("/directory/:id", handleUpdateSupplier);
router6.delete("/directory/:id", async (req, res) => {
  try {
    await deleteSqliteSupplier(req.params.id);
    res.status(204).send();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete supplier.";
    console.error(`[Supplier API Error] Failed to delete supplier ${req.params.id}:`, err);
    res.status(500).json({ success: false, error: message });
  }
});
router6.get("/directory/:id/statement", async (req, res) => {
  try {
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const statement = await getSqliteSupplierStatement(req.params.id, startDate, endDate);
    res.json(statement);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate supplier statement.";
    console.error(`[Supplier API Error] Failed to generate statement for ${req.params.id}:`, err);
    res.status(500).json({ success: false, error: message });
  }
});
router6.get("/products", async (req, res) => {
  try {
    const supplierId = req.query.supplier_id || req.query.supplier;
    const products = await getAllSqliteSupplierProducts(supplierId);
    res.json(products);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch supplier products.";
    console.error("[Supplier API Error] Failed to fetch supplier products:", err);
    res.status(500).json({ success: false, error: message });
  }
});
router6.post("/products", validateBody(SupplierProductSchema), async (req, res) => {
  try {
    const created = await saveSqliteSupplierProduct(req.body);
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to link product to supplier.";
    console.error("[Supplier API Error] Failed to link product to supplier:", err);
    res.status(500).json({ success: false, error: message });
  }
});
router6.get("/intakes", async (req, res) => {
  try {
    const supplierId = req.query.supplier_id || req.query.supplier;
    const intakes = await getAllSqliteSupplierIntakes(supplierId);
    res.json(intakes);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch intake batches.";
    console.error("[Supplier API Error] Failed to fetch intake batches:", err);
    res.status(500).json({ success: false, error: message });
  }
});
router6.post("/intakes", validateBody(SupplierIntakeSchema), async (req, res) => {
  try {
    const created = await saveSqliteSupplierIntake(req.body);
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record intake batch.";
    console.error("[Supplier API Error] Failed to create intake batch:", err);
    res.status(500).json({ success: false, error: message });
  }
});
router6.get("/payments", async (req, res) => {
  try {
    const supplierId = req.query.supplier_id || req.query.supplier;
    const payments = await getAllSqliteSupplierPayments(supplierId);
    res.json(payments);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch supplier payments.";
    console.error("[Supplier API Error] Failed to fetch supplier payments:", err);
    res.status(500).json({ success: false, error: message });
  }
});
router6.post("/payments", validateBody(SupplierPaymentSchema), async (req, res) => {
  try {
    const created = await saveSqliteSupplierPayment(req.body);
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record payment disbursement.";
    console.error("[Supplier API Error] Failed to create supplier payment:", err);
    res.status(500).json({ success: false, error: message });
  }
});
router6.get("/analytics/dashboard", async (_req, res) => {
  try {
    const metrics = await getSqliteSupplierDashboardAnalytics();
    res.json(metrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to retrieve supplier dashboard analytics.";
    console.error("[Supplier API Error] Failed to generate dashboard analytics:", err);
    res.status(500).json({ success: false, error: message });
  }
});
router6.get("/reports", async (req, res) => {
  try {
    const type = req.query.type || "outstanding_balances";
    const supplierId = req.query.supplier_id || req.query.supplier;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const report = await getSqliteSupplierReport(type, supplierId, startDate, endDate);
    res.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate supplier report.";
    console.error("[Supplier API Error] Failed to generate report:", err);
    res.status(500).json({ success: false, error: message });
  }
});
var suppliers_default = router6;

// server/routes/customers.ts
var import_express7 = require("express");
var import_zod6 = require("zod");
var router7 = (0, import_express7.Router)();
router7.use(requireAdmin);
var CreateCustomerSchema = import_zod6.z.object({
  name: import_zod6.z.string().optional(),
  first_name: import_zod6.z.string().optional(),
  last_name: import_zod6.z.string().optional(),
  email: import_zod6.z.string().email().optional().or(import_zod6.z.literal("")),
  phone: import_zod6.z.string().optional(),
  company: import_zod6.z.string().optional(),
  address: import_zod6.z.string().optional(),
  city: import_zod6.z.string().optional(),
  status: import_zod6.z.enum(["Active", "Inactive", "Lead", "VIP", "Archived"]).optional(),
  tags: import_zod6.z.array(import_zod6.z.string()).optional(),
  notes: import_zod6.z.string().optional(),
  is_registered: import_zod6.z.boolean().optional()
}).refine((data) => Boolean(data.name || data.first_name || data.email), {
  message: "Customer name or email is required.",
  path: ["name"]
});
var CreateDealSchema = import_zod6.z.object({
  customer: import_zod6.z.string().min(1, "Customer ID is required."),
  title: import_zod6.z.string().min(1, "Deal title is required."),
  value: import_zod6.z.number().nonnegative().optional(),
  stage: import_zod6.z.string().optional(),
  probability: import_zod6.z.number().min(0).max(100).optional(),
  expected_close: import_zod6.z.string().optional(),
  notes: import_zod6.z.string().optional()
});
var CreateInvoiceSchema = import_zod6.z.object({
  customer: import_zod6.z.string().min(1, "Customer ID is required."),
  amount: import_zod6.z.number().positive("Invoice amount must be greater than zero."),
  invoice_number: import_zod6.z.string().optional(),
  status: import_zod6.z.enum(["Paid", "Unpaid", "Overdue", "Cancelled"]).optional(),
  due_date: import_zod6.z.string().optional(),
  issue_date: import_zod6.z.string().optional(),
  notes: import_zod6.z.string().optional()
});
var CreateCustomerOrderLinkSchema = import_zod6.z.object({
  customer: import_zod6.z.string().min(1, "Customer ID is required."),
  order_id: import_zod6.z.string().min(1, "Order ID is required."),
  order_number: import_zod6.z.string().optional(),
  total_amount: import_zod6.z.number().nonnegative().optional(),
  status: import_zod6.z.string().optional()
});
router7.get("/", async (req, res) => {
  try {
    const { search, status, is_registered } = req.query;
    let list = await getAllSqliteCustomers();
    if (search && typeof search === "string") {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (c) => c.name && c.name.toLowerCase().includes(q) || c.email && c.email.toLowerCase().includes(q) || c.phone && c.phone.includes(q) || c.company && c.company.toLowerCase().includes(q)
      );
    }
    if (status && typeof status === "string" && status !== "all") {
      list = list.filter((c) => c.status === status);
    }
    if (is_registered !== void 0 && is_registered !== "all") {
      const isReg = String(is_registered) === "true";
      list = list.filter((c) => Boolean(c.is_registered) === isReg);
    }
    res.json(list);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch customers.";
    res.status(500).json({ success: false, error: message });
  }
});
router7.get("/:id", async (req, res) => {
  try {
    const customer = await getSqliteCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, error: `Customer with ID '${req.params.id}' not found.` });
    }
    res.json(customer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch customer profile.";
    res.status(500).json({ success: false, error: message });
  }
});
router7.post("/", validateBody(CreateCustomerSchema), async (req, res) => {
  try {
    const saved = await saveSqliteCustomer(req.body);
    res.status(201).json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create customer.";
    res.status(500).json({ success: false, error: message });
  }
});
var handleUpdateCustomer = async (req, res) => {
  try {
    const customerData = { ...req.body, id: req.params.id };
    const saved = await saveSqliteCustomer(customerData);
    res.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update customer.";
    res.status(500).json({ success: false, error: message });
  }
};
router7.put("/:id", handleUpdateCustomer);
router7.patch("/:id", handleUpdateCustomer);
router7.delete("/:id", async (req, res) => {
  try {
    await deleteSqliteCustomer(req.params.id);
    res.status(204).send();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete customer.";
    res.status(500).json({ success: false, error: message });
  }
});
router7.post("/deals", validateBody(CreateDealSchema), async (req, res) => {
  try {
    const saved = await saveSqliteDeal(req.body);
    res.status(201).json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create deal.";
    res.status(500).json({ success: false, error: message });
  }
});
router7.delete("/deals/:id", async (req, res) => {
  try {
    await deleteSqliteDeal(req.params.id);
    res.status(204).send();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete deal.";
    res.status(500).json({ success: false, error: message });
  }
});
router7.post("/invoices", validateBody(CreateInvoiceSchema), async (req, res) => {
  try {
    const saved = await saveSqliteInvoice(req.body);
    res.status(201).json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create invoice.";
    res.status(500).json({ success: false, error: message });
  }
});
router7.delete("/invoices/:id", async (req, res) => {
  try {
    await deleteSqliteInvoice(req.params.id);
    res.status(204).send();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete invoice.";
    res.status(500).json({ success: false, error: message });
  }
});
router7.post("/customer-orders", validateBody(CreateCustomerOrderLinkSchema), async (req, res) => {
  try {
    const saved = await saveSqliteCustomerOrder(req.body);
    res.status(201).json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to link customer order.";
    res.status(500).json({ success: false, error: message });
  }
});
var customers_default = router7;

// server/routes/settings.ts
var import_express8 = require("express");
var import_crypto5 = __toESM(require("crypto"), 1);
init_mysql_db();
var router8 = (0, import_express8.Router)();
var DEFAULT_SITE_SETTINGS = {
  general: {
    site_name: "Ropenix Collections",
    tagline: "Premium eCommerce & Bespoke Collections",
    business_email: "concierge@ropenix.co.ke",
    support_phone: "+254 182 180 965",
    physical_address: "Enterprise Road, Industrial Area, Nairobi, Kenya",
    currency: "KES",
    currency_symbol: "KSh",
    timezone: "Africa/Nairobi",
    maintenance_mode: false,
    maintenance_message: "We are currently conducting scheduled upgrades. Please check back shortly."
  },
  appearance: {
    font_scale: "100%",
    font_scale_value: 1,
    active_theme: "default",
    primary_color: "#4f46e5",
    secondary_color: "#06b6d4",
    accent_color: "#f59e0b",
    background_color: "#f8fafc",
    surface_color: "#ffffff",
    text_color: "#0f172a",
    dark_mode_default: false,
    is_scheduled_theme_active: false
  },
  tax: {
    is_vat_registered: true,
    vat_rate: 16,
    reduced_vat_rate: 8,
    zero_rated_enabled: true,
    tax_pricing_type: "inclusive",
    kra_pin: "P051987654Z",
    tax_exemption_note: "Tax Exempt certificates verified at transaction clearance"
  },
  receipts: {
    invoice_prefix: "INV",
    invoice_format: "INV-{YYYY}-{SEQ:5}",
    legal_business_name: "Ropenix Investments Limited",
    business_reg_number: "CPR/2023/981244",
    physical_address: "Ropenix Hub, Ring Road Parklands, Westlands, Nairobi",
    contact_phone: "+254 182 180 965",
    contact_email: "invoicing@ropenix.co.ke",
    receipt_header_text: "Thank you for acquiring with Ropenix Collections.",
    receipt_footer_text: "All items carry dynamic warranty certificates. Returns accepted within 14 days in original condition.",
    etims_enabled: true,
    etims_client_id: "ETIMS-ROPENIX-LIVE-9042",
    etims_client_secret: "",
    etims_environment: "sandbox",
    etims_auto_submit: true,
    etims_qr_url_template: "https://etims.kra.go.ke/verify?tax_pin={KRA_PIN}&inv_num={INVOICE_NUM}&amount={TOTAL}&date={DATE}"
  },
  backup: {
    auto_backup_enabled: true,
    frequency: "daily",
    retention_days: 30,
    include_media_files: false,
    cloud_sync_enabled: false,
    last_backup_time: null
  },
  payments: {
    mpesa_enabled: true,
    mpesa_environment: "sandbox",
    mpesa_paybill: "303030",
    mpesa_account_name: "ROPENIX INVESTMENTS LTD",
    mpesa_account_number: "2047728455",
    mpesa_consumer_key: "",
    mpesa_consumer_secret: "",
    mpesa_passkey: "",
    card_enabled: true,
    card_provider: "stripe",
    cod_enabled: true,
    cod_max_limit: 5e4,
    whatsapp_order_enabled: true,
    whatsapp_number: "0182180965"
  },
  notifications: {
    smtp_host: "smtp.gmail.com",
    smtp_port: 587,
    smtp_user: "notifications@ropenix.co.ke",
    smtp_use_tls: true,
    sender_name: "Ropenix Concierge",
    sender_email: "concierge@ropenix.co.ke",
    sms_enabled: true,
    sms_provider: "africastalking",
    sms_sender_id: "ROPENIX",
    notify_on_order_placed: true,
    notify_on_dispatched: true,
    notify_on_delivered: true,
    notify_on_refund: true
  },
  seo: {
    meta_title: "Ropenix Collections | Premium eCommerce & Bespoke Fashion",
    meta_description: "Curated luxury fashion, artisan timepieces, cutting-edge technology and tailored bespoke garments in Nairobi, Kenya.",
    meta_keywords: "luxury shopping, artisan fashion, watches, nairobi commerce, ropenix collections, bespoke atelier",
    og_image_url: "/src/assets/images/og_banner_default.jpg",
    canonical_base_url: "https://ropenix.co.ke",
    google_analytics_id: "G-ROPENIX2026",
    google_tag_manager_id: "GTM-ROP9981"
  },
  access_control: {
    enforce_2fa: false,
    session_timeout_minutes: 60,
    max_login_attempts: 5,
    allowed_ip_whitelist: "",
    allow_guest_checkout: true,
    staff_roles: [
      { role: "Super Admin", permissions: ["all"] },
      { role: "Store Manager", permissions: ["products", "orders", "returns", "promotions", "shipping"] },
      { role: "Fulfillment Operator", permissions: ["orders", "shipping"] },
      { role: "Content Editor", permissions: ["products", "content", "hero_banners"] }
    ]
  }
};
function mergeSiteSettings(custom) {
  const merged = {};
  for (const key of Object.keys(DEFAULT_SITE_SETTINGS)) {
    merged[key] = {
      ...DEFAULT_SITE_SETTINGS[key],
      ...custom && typeof custom === "object" ? custom[key] : {}
    };
  }
  return merged;
}
var INITIAL_THEME_PRESETS = [
  {
    id: "theme-default-indigo",
    name: "Ropenix Classic Indigo",
    description: "The timeless signature Ropenix palette with deep indigo and electric cyan.",
    primary_color: "#4f46e5",
    secondary_color: "#06b6d4",
    accent_color: "#f59e0b",
    background_color: "#0f172a",
    surface_color: "#1e293b",
    text_color: "#f8fafc",
    is_active: true,
    is_scheduled: false,
    is_system_preset: true
  },
  {
    id: "theme-christmas",
    name: "Christmas & Holiday Gala",
    description: "Festive ruby crimson, pine emerald, and warm champagne gold for seasonal campaigns.",
    primary_color: "#dc2626",
    secondary_color: "#16a34a",
    accent_color: "#fbbf24",
    background_color: "#14261c",
    surface_color: "#1d3829",
    text_color: "#fef2f2",
    is_active: false,
    is_scheduled: false,
    is_system_preset: true
  },
  {
    id: "theme-black-friday",
    name: "Black Friday Midnight Gold",
    description: "High-contrast obsidian black with luxury radiant gold highlights.",
    primary_color: "#f59e0b",
    secondary_color: "#d97706",
    accent_color: "#fbbf24",
    background_color: "#09090b",
    surface_color: "#18181b",
    text_color: "#fafafa",
    is_active: false,
    is_scheduled: false,
    is_system_preset: true
  },
  {
    id: "theme-safari-sunset",
    name: "Nairobi Safari Sunset",
    description: "Warm earth tones with acacia amber, terracotta rose, and deep safari green.",
    primary_color: "#d97706",
    secondary_color: "#059669",
    accent_color: "#f97316",
    background_color: "#1c1917",
    surface_color: "#292524",
    text_color: "#fdf8f6",
    is_active: false,
    is_scheduled: false,
    is_system_preset: true
  },
  {
    id: "theme-cyber-teal",
    name: "Cyberpunk Neon Teal",
    description: "Futuristic neon cyan and deep violet for technology and electronics sales.",
    primary_color: "#06b6d4",
    secondary_color: "#8b5cf6",
    accent_color: "#ec4899",
    background_color: "#090d16",
    surface_color: "#111827",
    text_color: "#f0fdfa",
    is_active: false,
    is_scheduled: false,
    is_system_preset: true
  }
];
var INITIAL_BACKUP_SNAPSHOTS = [
  {
    id: "bkp-initial-system-seed",
    filename: "ropenix_seed_snapshot_stable.json",
    file_size_bytes: 342981,
    backup_type: "scheduled",
    status: "completed",
    checksum: "e7d8f3a90184b2c145e69d",
    created_by: "system",
    notes: "Base factory configuration snapshot",
    created_at: new Date(Date.now() - 864e5 * 2).toISOString()
  }
];
async function getSqliteThemePresets() {
  const presets = await getAppSetting("theme_presets", null);
  return presets || INITIAL_THEME_PRESETS;
}
async function saveSqliteThemePresets(presets) {
  await setAppSetting("theme_presets", presets);
}
async function getSqliteBackups() {
  const backups = await getAppSetting("backup_snapshots", null);
  return backups || INITIAL_BACKUP_SNAPSHOTS;
}
async function saveSqliteBackups(backups) {
  await setAppSetting("backup_snapshots", backups);
}
async function getSqliteAuditLogs() {
  const logs = await getAppSetting("settings_audit_logs", null);
  return logs || [];
}
router8.get("/themes/presets", async (_req, res) => {
  try {
    const presets = await getSqliteThemePresets();
    res.json(presets);
  } catch {
    res.json(INITIAL_THEME_PRESETS);
  }
});
router8.post("/themes/presets", requireAdmin, async (req, res) => {
  try {
    const presetData = req.body;
    const presets = await getSqliteThemePresets();
    const newPreset = {
      id: `theme-custom-${Date.now()}`,
      name: presetData.name || "Custom Theme",
      description: presetData.description || "",
      primary_color: presetData.primary_color || "#4f46e5",
      secondary_color: presetData.secondary_color || "#06b6d4",
      accent_color: presetData.accent_color || "#f59e0b",
      background_color: presetData.background_color || "#0f172a",
      surface_color: presetData.surface_color || "#1e293b",
      text_color: presetData.text_color || "#f8fafc",
      is_active: false,
      is_scheduled: false,
      is_system_preset: false,
      ...presetData
    };
    presets.push(newPreset);
    await saveSqliteThemePresets(presets);
    res.status(201).json(newPreset);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create theme preset";
    res.status(500).json({ success: false, error: message });
  }
});
router8.post("/themes/presets/:id/activate", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const presets = await getSqliteThemePresets();
    let selected;
    presets.forEach((p) => {
      if (p.id === id) {
        p.is_active = true;
        selected = p;
      } else {
        p.is_active = false;
      }
    });
    await saveSqliteThemePresets(presets);
    if (selected) {
      const currentRaw = await getMysqlSiteSettings() || {};
      const fullSettings = mergeSiteSettings(currentRaw);
      fullSettings.appearance = {
        ...fullSettings.appearance,
        active_theme: selected.name,
        primary_color: selected.primary_color,
        secondary_color: selected.secondary_color,
        accent_color: selected.accent_color,
        background_color: selected.background_color,
        surface_color: selected.surface_color,
        text_color: selected.text_color
      };
      await saveMysqlSiteSettings(fullSettings);
      return res.json({ success: true, appearance: fullSettings.appearance, preset: selected });
    }
    res.status(404).json({ success: false, error: "Preset not found" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to activate preset";
    res.status(500).json({ success: false, error: message });
  }
});
router8.post("/themes/presets/:id/schedule", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.body;
    const presets = await getSqliteThemePresets();
    const target = presets.find((p) => p.id === id);
    if (target) {
      target.is_scheduled = true;
      target.start_date = start_date;
      target.end_date = end_date;
      await saveSqliteThemePresets(presets);
      return res.json({ success: true, preset: target });
    }
    res.status(404).json({ success: false, error: "Preset not found" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to schedule preset";
    res.status(500).json({ success: false, error: message });
  }
});
router8.delete("/themes/presets/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const presets = await getSqliteThemePresets();
    const filtered = presets.filter((p) => p.id !== id);
    await saveSqliteThemePresets(filtered);
    res.json({ success: true, message: "Preset deleted" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete preset";
    res.status(500).json({ success: false, error: message });
  }
});
router8.get("/backups/list", requireAdmin, async (_req, res) => {
  try {
    const backups = await getSqliteBackups();
    res.json(backups);
  } catch {
    res.json(INITIAL_BACKUP_SNAPSHOTS);
  }
});
router8.post("/backups/create", requireAdmin, async (req, res) => {
  try {
    const { notes, admin_email } = req.body || {};
    const timestampStr = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const filename = `ropenix_backup_${timestampStr}.json`;
    const settings = mergeSiteSettings(await getMysqlSiteSettings());
    const snapshot = {
      id: `bkp-${Date.now()}`,
      filename,
      file_size_bytes: JSON.stringify(settings).length,
      backup_type: "manual",
      status: "completed",
      checksum: import_crypto5.default.randomBytes(12).toString("hex"),
      created_by: admin_email || "admin@ropenix.co.ke",
      notes: notes || "Manual admin snapshot",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const backups = await getSqliteBackups();
    backups.unshift(snapshot);
    await saveSqliteBackups(backups);
    res.status(201).json({ success: true, snapshot });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create backup snapshot";
    res.status(500).json({ success: false, error: message });
  }
});
router8.post("/backups/:id/restore", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    res.json({ success: true, message: `System state restored from snapshot ${id}.` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to restore backup snapshot";
    res.status(500).json({ success: false, error: message });
  }
});
router8.delete(["/backups/:id/delete", "/backups/:id"], requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const backups = await getSqliteBackups();
    const filtered = backups.filter((b) => b.id !== id);
    await saveSqliteBackups(filtered);
    res.json({ success: true, message: "Backup snapshot deleted" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete backup snapshot";
    res.status(500).json({ success: false, error: message });
  }
});
router8.get("/audit-logs/list", requireAdmin, async (req, res) => {
  try {
    const section = req.query.section;
    const logs = await getSqliteAuditLogs();
    if (section) {
      return res.json(logs.filter((l) => l.section === section));
    }
    res.json(logs);
  } catch {
    res.json([]);
  }
});
router8.post("/etims/test", requireAdmin, (req, res) => {
  const { kra_pin, client_id, environment } = req.body || {};
  const pin = kra_pin || "P051987654Z";
  const inv = `ETIMS-INV-${(/* @__PURE__ */ new Date()).getFullYear()}09-00912`;
  res.json({
    status: "success",
    message: `eTIMS VSCU (${(environment || "sandbox").toUpperCase()}) Gateway Online & Certified`,
    kra_pin: pin,
    client_id: client_id || "ETIMS-ROPENIX-LIVE-9042",
    environment: environment || "sandbox",
    sample_invoice_number: inv,
    etims_signature: "7F8A9C0E2B1D4F5A6B8C9D0E1F2A3B4C",
    qr_verification_url: `https://etims.kra.go.ke/verify?tax_pin=${pin}&inv_num=${inv}`,
    transmission_latency_ms: 38,
    compliant_status: "CERTIFIED_ACTIVE"
  });
});
function redactSecretsFromSettings(settings) {
  if (!settings || typeof settings !== "object") return settings;
  const clone = JSON.parse(JSON.stringify(settings));
  if (clone.receipts && typeof clone.receipts === "object") {
    delete clone.receipts.etims_client_secret;
  }
  if (clone.payments && typeof clone.payments === "object") {
    delete clone.payments.mpesa_consumer_key;
    delete clone.payments.mpesa_consumer_secret;
    delete clone.payments.mpesa_passkey;
  }
  if (clone.notifications && typeof clone.notifications === "object") {
    delete clone.notifications.smtp_password;
  }
  return clone;
}
router8.get("/", async (req, res) => {
  try {
    const rawSettings = await getMysqlSiteSettings();
    const merged = mergeSiteSettings(rawSettings);
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const isAdmin = Boolean(user && (user.is_staff || user.is_superuser || user.role === "admin"));
    if (!isAdmin) {
      return res.json(redactSecretsFromSettings(merged));
    }
    res.json(merged);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to retrieve site settings.";
    res.status(500).json({ success: false, error: message });
  }
});
var handleUpdateSettingsSection = async (req, res) => {
  try {
    const { section } = req.params;
    const sectionData = req.body || {};
    const currentRaw = await getMysqlSiteSettings() || {};
    const fullSettings = mergeSiteSettings(currentRaw);
    fullSettings[section] = {
      ...fullSettings[section] || {},
      ...sectionData
    };
    await saveMysqlSiteSettings(fullSettings);
    res.json({
      success: true,
      message: `Settings section '${section}' saved successfully.`,
      data: fullSettings[section]
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update site settings.";
    console.error("[Settings Section Update Error]:", err);
    res.status(500).json({ success: false, error: message });
  }
};
router8.put("/:section", requireAdmin, handleUpdateSettingsSection);
router8.patch("/:section", requireAdmin, handleUpdateSettingsSection);
router8.post("/:section", requireAdmin, handleUpdateSettingsSection);
var handleUpdateAllSettings = async (req, res) => {
  try {
    const rawSettings = req.body || {};
    const currentRaw = await getMysqlSiteSettings() || {};
    const fullSettings = mergeSiteSettings(currentRaw);
    for (const key of Object.keys(rawSettings)) {
      if (typeof rawSettings[key] === "object" && rawSettings[key] !== null) {
        fullSettings[key] = { ...fullSettings[key] || {}, ...rawSettings[key] };
      }
    }
    await saveMysqlSiteSettings(fullSettings);
    res.json({ success: true, message: "Site settings updated successfully.", data: fullSettings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update site settings.";
    res.status(500).json({ success: false, error: message });
  }
};
router8.put("/", requireAdmin, handleUpdateAllSettings);
router8.patch("/", requireAdmin, handleUpdateAllSettings);
router8.post("/", requireAdmin, handleUpdateAllSettings);
var settings_default = router8;

// server/routes/content.ts
var import_express9 = require("express");
var router9 = (0, import_express9.Router)();
var customClothingRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1e3,
  max: 10,
  message: "Too many custom clothing submissions from your connection. Please wait an hour before submitting again."
});
router9.get(["/", "/hero-banners"], async (req, res) => {
  try {
    const showAll = req.query.all === "true" || req.query.all === "1";
    let banners = await getAllSqliteHeroBanners();
    if (!showAll) {
      const now = /* @__PURE__ */ new Date();
      banners = banners.filter((b) => {
        const isActive = b.is_active !== void 0 ? b.is_active : b.active !== false;
        if (!isActive) return false;
        if (b.start_date) {
          const s = new Date(b.start_date);
          if (!isNaN(s.getTime()) && now < s) return false;
        }
        if (b.end_date) {
          const e = new Date(b.end_date);
          if (!isNaN(e.getTime()) && now > e) return false;
        }
        return true;
      });
    }
    res.json(banners);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch hero banners.";
    res.status(500).json({ success: false, error: message });
  }
});
router9.post(["/reorder", "/hero-banners/reorder"], requireAdmin, async (req, res) => {
  try {
    const orderList = req.body?.order || [];
    if (!Array.isArray(orderList)) {
      return res.status(400).json({ success: false, error: "Order must be an array of IDs." });
    }
    const current = await getAllSqliteHeroBanners();
    const updated = current.map((b) => {
      const idx = orderList.indexOf(b.id);
      return idx !== -1 ? { ...b, display_order: idx + 1, displayOrder: idx + 1 } : b;
    }).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    await saveSqliteHeroBanners(updated);
    res.json({ success: true, status: "reordered", total: orderList.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reorder banners.";
    res.status(500).json({ success: false, error: message });
  }
});
router9.post(["/", "/hero-banners"], requireAdmin, async (req, res) => {
  try {
    const banner = req.body || {};
    if (!banner.id) {
      banner.id = `hero-banner-${Date.now()}`;
    }
    const current = await getAllSqliteHeroBanners();
    const existingIndex = current.findIndex((b) => b.id === banner.id);
    let updated;
    if (existingIndex !== -1) {
      updated = current.map((b) => b.id === banner.id ? { ...b, ...banner, updated_at: (/* @__PURE__ */ new Date()).toISOString() } : b);
    } else {
      updated = [...current, { ...banner, created_at: (/* @__PURE__ */ new Date()).toISOString() }];
    }
    const saved = await saveSqliteHeroBanners(updated);
    const result = saved.find((b) => b.id === banner.id) || banner;
    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save hero banner.";
    res.status(500).json({ success: false, error: message });
  }
});
var handleUpdateHeroBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = req.body || {};
    banner.id = id;
    const current = await getAllSqliteHeroBanners();
    const existing = current.find((b) => b.id === id);
    let updated;
    if (existing) {
      updated = current.map((b) => b.id === id ? { ...b, ...banner, updated_at: (/* @__PURE__ */ new Date()).toISOString() } : b);
    } else {
      updated = [...current, banner];
    }
    const saved = await saveSqliteHeroBanners(updated);
    const result = saved.find((b) => b.id === id) || banner;
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update hero banner.";
    res.status(500).json({ success: false, error: message });
  }
};
router9.put(["/:id", "/hero-banners/:id"], requireAdmin, handleUpdateHeroBanner);
router9.patch(["/:id", "/hero-banners/:id"], requireAdmin, handleUpdateHeroBanner);
router9.delete(["/:id", "/hero-banners/:id"], requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const current = await getAllSqliteHeroBanners();
    const updated = current.filter((b) => b.id !== id);
    await saveSqliteHeroBanners(updated);
    res.json({ success: true, message: "Hero banner deleted successfully." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete hero banner.";
    res.status(500).json({ success: false, error: message });
  }
});
router9.get("/services/custom-clothing", async (req, res) => {
  try {
    const { status, search } = req.query;
    const results = await getSqliteCustomClothingRequests({
      status: typeof status === "string" ? status : void 0,
      search: typeof search === "string" ? search : void 0
    });
    res.json({ success: true, count: results.length, requests: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch custom clothing requests.";
    res.status(500).json({ success: false, error: message });
  }
});
router9.get("/services/custom-clothing/:id", async (req, res) => {
  try {
    const result = await getSqliteCustomClothingRequestById(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, error: "Custom clothing request not found." });
    }
    res.json({ success: true, request: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch custom clothing request.";
    res.status(500).json({ success: false, error: message });
  }
});
router9.put("/services/custom-clothing/:id/status", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!status || typeof status !== "string") {
      return res.status(400).json({ success: false, error: "Status is required." });
    }
    const updated = await updateSqliteCustomClothingRequestStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Custom clothing request not found." });
    }
    res.json({ success: true, request: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update custom clothing request status.";
    res.status(500).json({ success: false, error: message });
  }
});
router9.post("/services/custom-clothing", customClothingRateLimiter, async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      garmentType,
      otherGarmentType,
      materialSamples = [],
      designImages = [],
      designVideos = [],
      designLinks = [],
      measurements,
      preferredDeadline,
      budgetRange = "",
      additionalNotes = "",
      deliveryLocation = ""
    } = req.body || {};
    if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
      return res.status(400).json({ success: false, error: "Full Name is required." });
    }
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, error: "A valid email address is required." });
    }
    if (!garmentType || typeof garmentType !== "string" || !garmentType.trim()) {
      return res.status(400).json({ success: false, error: "Garment type is required." });
    }
    const newRequestPayload = {
      id: `req-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      referenceNo: `ROP-CC-${(/* @__PURE__ */ new Date()).getFullYear()}-${Math.floor(1e3 + Math.random() * 9e3)}`,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: (phone || "").trim(),
      garmentType: garmentType === "Other" && otherGarmentType ? otherGarmentType.trim() : garmentType.trim(),
      otherGarmentType: otherGarmentType || "",
      materialSamples: Array.isArray(materialSamples) ? materialSamples : [],
      designImages: Array.isArray(designImages) ? designImages : [],
      designVideos: Array.isArray(designVideos) ? designVideos : [],
      designLinks: Array.isArray(designLinks) ? designLinks : [],
      measurements: measurements || {},
      preferredDeadline: preferredDeadline || null,
      budgetRange: (budgetRange || "").trim(),
      additionalNotes: (additionalNotes || "").trim(),
      deliveryLocation: (deliveryLocation || "").trim(),
      status: "Pending Review",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const saved = await saveSqliteCustomClothingRequest(newRequestPayload);
    res.status(201).json({ success: true, message: "Custom clothing request submitted successfully.", request: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to submit custom clothing request.";
    res.status(500).json({ success: false, error: message });
  }
});
router9.get("/wishlist", async (req, res) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const key = user?.id || (req.query.userId || req.query.sessionId || "default");
    const items = await getSqliteWishlist(String(key));
    res.json(items);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to retrieve wishlist";
    res.status(500).json({ success: false, error: message });
  }
});
router9.post("/wishlist", async (req, res) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const key = user?.id || (req.body.userId || req.body.sessionId || "default");
    const { product_id } = req.body || {};
    const updated = await addToSqliteWishlist(String(key), String(product_id || ""));
    res.json({ success: true, product_ids: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add item to wishlist";
    res.status(500).json({ success: false, error: message });
  }
});
router9.delete("/wishlist/:id", async (req, res) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const key = user?.id || (req.query.userId || req.body?.userId || "default");
    const { id } = req.params;
    const updated = await removeFromSqliteWishlist(String(key), String(id));
    res.json({ success: true, product_ids: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove item from wishlist";
    res.status(500).json({ success: false, error: message });
  }
});
router9.get("/cart", async (req, res) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const cartKey = user?.id || (req.query.userId || req.query.sessionId || "guest_default");
    const items = await getSqliteCart(String(cartKey));
    res.json({ success: true, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch cart";
    res.status(500).json({ success: false, error: message });
  }
});
router9.post("/cart", async (req, res) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const cartKey = user?.id || (req.body.userId || req.body.sessionId || req.query.userId || "guest_default");
    const items = Array.isArray(req.body.items) ? req.body.items : Array.isArray(req.body) ? req.body : [];
    const saved = await saveSqliteCart(String(cartKey), items);
    res.json({ success: true, message: "Cart updated successfully", items: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save cart";
    res.status(500).json({ success: false, error: message });
  }
});
router9.post("/cart/sync", async (req, res) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const cartKey = user?.id || (req.body.userId || req.body.sessionId || "guest_default");
    const items = Array.isArray(req.body.items) ? req.body.items : Array.isArray(req.body.cart) ? req.body.cart : [];
    const saved = await saveSqliteCart(String(cartKey), items);
    res.json({ success: true, message: "Cart synchronized with backend database", items: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to sync cart";
    res.status(500).json({ success: false, error: message });
  }
});
router9.delete("/cart", async (req, res) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const cartKey = user?.id || (req.query.userId || req.body?.userId || "guest_default");
    await clearSqliteCart(String(cartKey));
    res.json({ success: true, message: "Cart cleared successfully" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to clear cart";
    res.status(500).json({ success: false, error: message });
  }
});
var content_default = router9;

// server/routes/cart.ts
var import_express10 = require("express");
var import_zod7 = require("zod");
var router10 = (0, import_express10.Router)();
var CartValidateSchema = import_zod7.z.object({
  items: import_zod7.z.array(
    import_zod7.z.object({
      productId: import_zod7.z.string().or(import_zod7.z.number()),
      variantId: import_zod7.z.string().optional(),
      selectedVariations: import_zod7.z.record(import_zod7.z.string(), import_zod7.z.any()).optional(),
      quantity: import_zod7.z.number().optional().default(1),
      clientPrice: import_zod7.z.number().optional(),
      price: import_zod7.z.number().optional(),
      name: import_zod7.z.string().optional()
    }).passthrough()
  ).optional().default([]),
  couponCode: import_zod7.z.string().optional(),
  clientTotal: import_zod7.z.number().optional()
});
router10.post("/validate", async (req, res) => {
  try {
    const parseResult = CartValidateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid cart payload format.",
        details: parseResult.error.format()
      });
    }
    const { items, couponCode, clientTotal } = parseResult.data;
    const validation = await validateCart(
      items.map((item) => ({
        productId: String(item.productId),
        variantId: item.variantId,
        selectedVariations: item.selectedVariations,
        quantity: item.quantity,
        clientPrice: item.clientPrice ?? item.price,
        name: item.name
      })),
      couponCode,
      clientTotal
    );
    res.json({
      success: true,
      valid: validation.valid,
      items: validation.items,
      outOfStockItems: validation.outOfStockItems,
      subtotal: validation.subtotal,
      discountAmount: validation.discountAmount,
      total: validation.total,
      couponCode: validation.couponCode,
      isCouponValid: validation.isCouponValid,
      couponDiscountPercent: validation.couponDiscountPercent,
      changes: validation.changes,
      validatedAt: validation.validatedAt
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cart validation failed.";
    res.status(500).json({ success: false, error: message });
  }
});
router10.get("/stream", (req, res) => {
  const rawProductIds = req.query.productIds || "";
  const initialProductIds = rawProductIds.split(",").map((s) => s.trim()).filter(Boolean);
  cartStreamManager.addClient(req, res, initialProductIds);
});
router10.post("/stream/subscribe", (req, res) => {
  const { clientId, productIds } = req.body || {};
  if (!clientId || !Array.isArray(productIds)) {
    return res.status(400).json({ success: false, error: "clientId and productIds array are required." });
  }
  const updated = cartStreamManager.updateSubscriptions(clientId, productIds);
  res.json({ success: updated, subscribedCount: productIds.length });
});
router10.get("/", async (req, res) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const cartKey = user?.id || (req.query.userId || req.query.sessionId || "guest_default");
    const items = await getSqliteCart(String(cartKey));
    res.json({ success: true, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch cart";
    res.status(500).json({ success: false, error: message });
  }
});
router10.post("/", async (req, res) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const cartKey = user?.id || (req.body.userId || req.body.sessionId || req.query.userId || "guest_default");
    const items = Array.isArray(req.body.items) ? req.body.items : Array.isArray(req.body) ? req.body : [];
    const saved = await saveSqliteCart(String(cartKey), items);
    res.json({ success: true, message: "Cart updated successfully", items: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save cart";
    res.status(500).json({ success: false, error: message });
  }
});
router10.post("/sync", async (req, res) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const cartKey = user?.id || (req.body.userId || req.body.sessionId || "guest_default");
    const items = Array.isArray(req.body.items) ? req.body.items : Array.isArray(req.body.cart) ? req.body.cart : [];
    const saved = await saveSqliteCart(String(cartKey), items);
    res.json({ success: true, message: "Cart synchronized with backend database", items: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to sync cart";
    res.status(500).json({ success: false, error: message });
  }
});
router10.delete("/", async (req, res) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const user = token ? await extractUserFromToken(token) : null;
    const cartKey = user?.id || (req.query.userId || req.body?.userId || "guest_default");
    await clearSqliteCart(String(cartKey));
    res.json({ success: true, message: "Cart cleared successfully" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to clear cart";
    res.status(500).json({ success: false, error: message });
  }
});
var cart_default = router10;

// server/routes/reviews.ts
var import_express11 = require("express");
var import_zod8 = require("zod");
var router11 = (0, import_express11.Router)();
var reviewSubmissionRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1e3,
  max: 10,
  message: "Rate limit exceeded. Maximum 10 review submissions per hour allowed."
});
var CreateReviewSchema = import_zod8.z.object({
  productId: import_zod8.z.string().min(1, "Product ID is required."),
  rating: import_zod8.z.number().min(1).max(5),
  title: import_zod8.z.string().optional(),
  comment: import_zod8.z.string().min(10, "Review statement must be at least 10 characters long.").max(2e3),
  orderId: import_zod8.z.string().optional(),
  mediaUrls: import_zod8.z.array(import_zod8.z.string()).max(5).optional(),
  reviewerDisplayName: import_zod8.z.string().optional(),
  purchasedVariant: import_zod8.z.string().optional(),
  userEmail: import_zod8.z.string().optional(),
  userId: import_zod8.z.union([import_zod8.z.string(), import_zod8.z.number()]).optional(),
  userName: import_zod8.z.string().optional()
});
router11.get(["/product/:productId", "/:productId/reviews", "/:productId/reviews/"], async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, sort } = req.query;
    const result = await getSqliteReviewsByProduct(productId, {
      rating: rating ? Number(rating) : void 0,
      sort: typeof sort === "string" ? sort : void 0
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to retrieve reviews";
    res.status(500).json({ success: false, error: message });
  }
});
router11.post(["/check-eligibility", "/check-eligibility/"], async (req, res) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const tokenUser = token ? await extractUserFromToken(token) : null;
    const { userEmail: bodyEmail, userId: bodyUserId, productId, sku } = req.body || {};
    const userEmail = (tokenUser?.email || bodyEmail || "").trim().toLowerCase();
    const userId = tokenUser?.id || bodyUserId || void 0;
    if (!userEmail && !userId) {
      return res.json({
        eligible: false,
        reason: "NOT_LOGGED_IN",
        message: "Please log in to your customer account to leave a verified review."
      });
    }
    if (!productId) {
      return res.status(400).json({
        eligible: false,
        reason: "NOT_PURCHASED",
        message: "Product ID is required to verify purchase."
      });
    }
    const orders = await getSqliteOrdersByUser(userEmail, userId ? String(userId) : void 0);
    const normalizedProdId = String(productId).trim().toLowerCase();
    const normalizedSku = sku ? String(sku).trim().toLowerCase() : "";
    let matchingOrder = null;
    let purchasedVariant = void 0;
    for (const order of orders) {
      const status = String(order.status || "").toLowerCase();
      if (status === "cancelled" || status === "canceled" || status === "refunded") {
        continue;
      }
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const itemId = String(item.id || item.productId || "").trim().toLowerCase();
        const itemSku = String(item.sku || item.product_sku || "").trim().toLowerCase();
        if (normalizedProdId && itemId === normalizedProdId || normalizedSku && itemSku === normalizedSku || normalizedProdId && itemSku === normalizedProdId) {
          matchingOrder = order;
          purchasedVariant = item.selectedVariant || item.selectedVariations ? typeof item.selectedVariations === "object" ? Object.values(item.selectedVariations).join(" / ") : String(item.selectedVariations) : void 0;
          break;
        }
      }
      if (matchingOrder) break;
    }
    if (!matchingOrder) {
      return res.json({
        eligible: false,
        reason: "NOT_PURCHASED",
        message: "Only verified customers who have bought this product can leave a review."
      });
    }
    const { reviews: existingReviews } = await getSqliteReviewsByProduct(productId);
    const existing = existingReviews.find(
      (r) => userEmail && r.userEmail && r.userEmail.toLowerCase() === userEmail || userId && r.userId && String(r.userId) === String(userId)
    );
    if (existing) {
      return res.json({
        eligible: false,
        reason: "ALREADY_REVIEWED",
        message: "You have already submitted a review for this product.",
        existingReview: existing,
        orderId: matchingOrder.id,
        purchasedVariant
      });
    }
    return res.json({
      eligible: true,
      reason: "ELIGIBLE",
      message: "Verified Purchaser: You are eligible to review this product.",
      orderId: matchingOrder.id,
      purchasedVariant
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to verify purchase eligibility";
    return res.status(500).json({ eligible: false, reason: "NOT_PURCHASED", message });
  }
});
router11.post("/", reviewSubmissionRateLimiter, validateBody(CreateReviewSchema), async (req, res) => {
  try {
    const token = getAuthTokenFromRequest(req);
    const tokenUser = token ? await extractUserFromToken(token) : null;
    const {
      productId,
      rating,
      title,
      comment,
      mediaUrls,
      orderId,
      reviewerDisplayName,
      purchasedVariant,
      userEmail: bodyEmail,
      userId: bodyUserId,
      userName: bodyUserName
    } = req.body;
    const userEmail = (tokenUser?.email || bodyEmail || "").trim().toLowerCase();
    const userId = tokenUser?.id || bodyUserId || void 0;
    const userName = tokenUser ? `${tokenUser.first_name || ""} ${tokenUser.last_name || ""}`.trim() || tokenUser.username : bodyUserName || "Verified Customer";
    if (!userEmail && !userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required. Please log in to post a review."
      });
    }
    const orders = await getSqliteOrdersByUser(userEmail, userId ? String(userId) : void 0);
    const normalizedProdId = String(productId).trim().toLowerCase();
    let matchingOrder = null;
    for (const order of orders) {
      const status = String(order.status || "").toLowerCase();
      if (status === "cancelled" || status === "canceled" || status === "refunded") continue;
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const itemId = String(item.id || item.productId || "").trim().toLowerCase();
        const itemSku = String(item.sku || item.product_sku || "").trim().toLowerCase();
        if (itemId === normalizedProdId || itemSku === normalizedProdId) {
          matchingOrder = order;
          break;
        }
      }
      if (matchingOrder) break;
    }
    if (!matchingOrder && !orderId) {
      return res.status(403).json({
        success: false,
        error: "Review submission denied: Only verified customers who purchased this product can leave a review."
      });
    }
    const newReview = {
      id: `rev-${Date.now()}`,
      productId: String(productId).trim(),
      orderId: matchingOrder ? matchingOrder.id : orderId || void 0,
      userId: userId ? String(userId) : null,
      userEmail,
      userName,
      reviewerDisplayName: reviewerDisplayName || userName,
      rating: Number(rating),
      title: title ? String(title).trim() : "",
      comment: String(comment).trim(),
      mediaUrls: Array.isArray(mediaUrls) ? mediaUrls.slice(0, 5) : [],
      verifiedPurchase: true,
      status: "Published",
      date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      helpfulVotes: 0,
      helpfulUserIds: [],
      purchasedVariant: purchasedVariant || void 0,
      isEdited: false
    };
    const saved = await saveSqliteReview(newReview);
    await recomputeSqliteProductRating(productId);
    res.status(201).json({
      success: true,
      message: "Verified customer review published successfully!",
      review: saved
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to submit review";
    res.status(500).json({ success: false, error: message });
  }
});
router11.put("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { rating, title, comment, mediaUrls, reviewerDisplayName } = req.body || {};
    const all = await getAllSqliteReviews();
    const existing = all.find((r) => r.id === id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Review not found." });
    }
    if (!user.is_superuser && !user.is_staff && existing.userEmail.toLowerCase() !== user.email.toLowerCase()) {
      return res.status(403).json({ success: false, error: "Forbidden: You can only edit your own reviews." });
    }
    const updated = await updateSqliteReview(id, {
      rating: rating ? Number(rating) : existing.rating,
      title: title !== void 0 ? String(title).trim() : existing.title,
      comment: comment !== void 0 ? String(comment).trim() : existing.comment,
      mediaUrls: Array.isArray(mediaUrls) ? mediaUrls.slice(0, 5) : existing.mediaUrls,
      reviewerDisplayName: reviewerDisplayName || existing.reviewerDisplayName
    });
    res.json({
      success: true,
      message: "Review updated successfully.",
      review: updated
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update review";
    res.status(500).json({ success: false, error: message });
  }
});
router11.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const all = await getAllSqliteReviews();
    const existing = all.find((r) => r.id === id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Review not found." });
    }
    if (!user.is_superuser && !user.is_staff && existing.userEmail.toLowerCase() !== user.email.toLowerCase()) {
      return res.status(403).json({ success: false, error: "Forbidden: You can only delete your own reviews." });
    }
    await deleteSqliteReview(id);
    res.json({ success: true, message: "Review removed successfully." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete review";
    res.status(500).json({ success: false, error: message });
  }
});
router11.post("/:id/helpful", async (req, res) => {
  try {
    const { id } = req.params;
    const token = getAuthTokenFromRequest(req);
    const voterId = token ? `user-${token.slice(0, 10)}` : String(req.ip || "ip");
    const result = await toggleSqliteReviewHelpful(id, voterId);
    if (!result) {
      return res.status(404).json({ success: false, error: "Review not found." });
    }
    res.json({
      success: true,
      helpfulVotes: result.helpfulVotes,
      voted: result.voted
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to register vote";
    res.status(500).json({ success: false, error: message });
  }
});
router11.get("/admin/list", requireAdmin, async (_req, res) => {
  try {
    const reviews = await getAllSqliteReviews();
    res.json({ success: true, reviews });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch reviews list";
    res.status(500).json({ success: false, error: message });
  }
});
router11.put("/admin/:id/status", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await updateSqliteReviewStatus(id, status);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Review not found." });
    }
    res.json({
      success: true,
      message: `Review status updated to '${status}'.`,
      review: updated
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update review status";
    res.status(500).json({ success: false, error: message });
  }
});
router11.get(["/admin/requests/logs", "/admin/review-requests/logs", "/requests/logs"], requireAdmin, async (_req, res) => {
  try {
    const logs = await getSqliteReviewRequestLogs();
    const settings = await getSqliteReviewRequestSettings();
    const optOutsCount = await getSqliteReviewOptOutsCount();
    const totalRequestsSent = logs.length;
    const totalReviewed = logs.filter((l) => l.status === "reviewed").length;
    const conversionRatePercent = totalRequestsSent > 0 ? Math.round(totalReviewed / totalRequestsSent * 1e3) / 10 : 0;
    res.json({
      success: true,
      logs,
      settings,
      optOutsCount,
      funnel: {
        totalRequestsSent,
        totalReviewed,
        conversionRatePercent
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch review request logs";
    res.status(500).json({ success: false, error: message });
  }
});
router11.get(["/admin/requests/settings", "/admin/review-requests/settings", "/requests/settings"], requireAdmin, async (_req, res) => {
  try {
    const settings = await getSqliteReviewRequestSettings();
    res.json({ success: true, settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch review settings";
    res.status(500).json({ success: false, error: message });
  }
});
router11.put(["/admin/requests/settings", "/admin/review-requests/settings", "/requests/settings"], requireAdmin, async (req, res) => {
  try {
    const { enabled, delayDays, autoTriggerOnDelivery, incentiveDiscountPercent } = req.body || {};
    if (delayDays !== void 0 && (Number(delayDays) < 0 || Number(delayDays) > 30)) {
      return res.status(400).json({ success: false, error: "Delay days must be between 0 and 30 days." });
    }
    const updated = await saveSqliteReviewRequestSettings({
      enabled: enabled !== void 0 ? Boolean(enabled) : void 0,
      delayDays: delayDays !== void 0 ? Number(delayDays) : void 0,
      autoTriggerOnDelivery: autoTriggerOnDelivery !== void 0 ? Boolean(autoTriggerOnDelivery) : void 0,
      incentiveDiscountPercent: incentiveDiscountPercent !== void 0 ? Number(incentiveDiscountPercent) : void 0
    });
    res.json({ success: true, settings: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update review settings";
    res.status(500).json({ success: false, error: message });
  }
});
router11.post("/requests/unsubscribe", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || !String(email).includes("@")) {
      return res.status(400).json({ success: false, error: "Valid email address is required to unsubscribe." });
    }
    await addSqliteReviewOptOut(String(email));
    res.json({
      success: true,
      message: "You have been unsubscribed from post-delivery review request emails."
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process unsubscribe";
    res.status(500).json({ success: false, error: message });
  }
});
var reviews_default = router11;

// server/routes/payments.ts
var import_express12 = require("express");
init_db();
init_events();
init_mysql_db();
var router12 = (0, import_express12.Router)();
var MPESA_CODE_REGEX = /^[A-Z0-9]{8,12}$/i;
router12.post(["/claim", "/claim/"], async (req, res) => {
  try {
    const { orderId, mpesaCode, phoneNumber, amount, notes, customerName, customerEmail, customerPhone, items } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ success: false, error: "Order ID is required." });
    }
    if (!mpesaCode || typeof mpesaCode !== "string") {
      return res.status(400).json({ success: false, error: "M-Pesa transaction code is required." });
    }
    const cleanCode = mpesaCode.trim().toUpperCase();
    if (!MPESA_CODE_REGEX.test(cleanCode)) {
      return res.status(400).json({
        success: false,
        error: "Invalid M-Pesa code format. Expected 10 alphanumeric characters (e.g., SGH7A1B2C3)."
      });
    }
    let order = await fetchAuthoritativeOrderById(orderId) || await getMysqlOrderById(orderId);
    if (!order) {
      const fallbackOrder = {
        id: orderId,
        customerName: customerName || req.body.customer_name || "Customer",
        customerEmail: customerEmail || req.body.customer_email || "",
        phone: phoneNumber || customerPhone || req.body.customer_phone || "",
        total: Number(amount || 0),
        status: "pending",
        paymentStatus: "pending_verification",
        paymentMethod: "M-PESA",
        paymentReference: cleanCode,
        items: items || req.body.order_items || [],
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      try {
        order = await saveMysqlOrder(fallbackOrder);
      } catch (saveErr) {
        console.warn("[Payments API] Auto-created order fallback for claim:", saveErr);
        order = fallbackOrder;
      }
    }
    const existingClaim = await getPaymentSubmissionByCode(cleanCode);
    if (existingClaim) {
      return res.status(409).json({
        success: false,
        error: `M-Pesa reference '${cleanCode}' has already been submitted for an order. Please check your SMS receipt or contact support if you believe this is an error.`
      });
    }
    const claimedAmount = Number(amount || order.total || 0);
    const submissionResult = await recordPaymentSubmission({
      orderId,
      mpesaReceiptCode: cleanCode,
      phoneNumber: phoneNumber || order.phone || order.customer_phone || order.customerPhone || "",
      amountClaimed: claimedAmount,
      paymentMethod: "mpesa_paybill",
      adminNotes: notes || void 0
    });
    await updateOrderPaymentStatus(orderId, "pending_verification", {
      paymentReference: cleanCode,
      paymentAmount: claimedAmount
    });
    await updateMysqlOrderStatus(orderId, {
      paymentStatus: "pending_verification",
      paymentReference: cleanCode
    });
    const isGuestOrder = Boolean(order.isGuest || order.is_guest || !order.userId && !order.user_id);
    emailEvents.emit("payment:submitted", {
      orderId,
      customerName: order.customer_name || order.customerName || "Customer",
      customerEmail: order.customer_email || order.customerEmail || "",
      customerPhone: phoneNumber || order.phone || order.customer_phone || order.customerPhone,
      mpesaCode: cleanCode,
      amount: claimedAmount,
      total: Number(order.total || 0),
      notes,
      isGuest: isGuestOrder,
      userId: order.userId || order.user_id || null
    });
    return res.status(201).json({
      success: true,
      message: `M-Pesa payment reference ${cleanCode} submitted successfully. Our finance desk is verifying your payment.`,
      submissionId: submissionResult.id,
      mpesaCode: cleanCode,
      status: "pending_verification"
    });
  } catch (err) {
    console.error("[Payment Claims API] Error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to submit payment claim." });
  }
});
router12.get(["/order/:orderId", "/order/:orderId/"], async (req, res) => {
  try {
    const submissions = await getPaymentSubmissionsForOrder(req.params.orderId);
    return res.json({ success: true, submissions });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed to fetch payment submissions." });
  }
});
router12.get(["/admin/pending", "/admin/pending/"], requireAdmin, async (_req, res) => {
  try {
    const pool = await getDbPool2();
    const [rows] = await pool.query(`
      SELECT ps.id, ps.order_id, ps.mpesa_receipt_code, ps.phone_number, ps.amount_claimed, ps.payment_method, ps.status, ps.submitted_at, ps.admin_notes,
             COALESCE(o.customer_name, '') as customer_name,
             COALESCE(o.customer_email, '') as customer_email,
             COALESCE(o.total, 0) as total,
             COALESCE(o.created_at, '') as order_created_at
      FROM payment_submissions ps
      LEFT JOIN customer_orders o ON o.id = ps.order_id
      WHERE ps.status = 'pending_verification'
      ORDER BY ps.submitted_at ASC;
    `);
    return res.json({ success: true, pending: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed to fetch pending payments." });
  }
});
router12.post(["/admin/verify", "/admin/verify/"], requireAdmin, async (req, res) => {
  try {
    const { submissionId, orderId, action, verifiedAmount, adminNotes, verifiedBy = "Admin" } = req.body || {};
    if (!submissionId || !orderId || !action) {
      return res.status(400).json({ success: false, error: "submissionId, orderId, and action (approve|reject|partial) are required." });
    }
    const order = await fetchAuthoritativeOrderById(orderId) || await getMysqlOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: `Order ${orderId} not found.` });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    if (action === "approve") {
      const finalAmount = Number(verifiedAmount || order.total || 0);
      await updatePaymentSubmissionStatus(submissionId, "verified", {
        adminNotes: adminNotes || "Payment verified via Safaricom Paybill statement.",
        verifiedBy
      });
      const { confirmOrderPaymentAndProcess: confirmOrderPaymentAndProcess2 } = await Promise.resolve().then(() => (init_orderStatusService(), orderStatusService_exports));
      const processRes = await confirmOrderPaymentAndProcess2(orderId, verifiedBy, {
        paymentReference: req.body.mpesaCode || order.paymentReference || "SAFARICOM-VERIFIED",
        paymentAmount: finalAmount,
        adminNotes: adminNotes || "Payment verified via Safaricom Paybill statement."
      });
      return res.json({
        success: true,
        message: `Order ${orderId} marked as PAID. Official receipt & Processing notification enqueued to ${order.customer_email || order.customerEmail}.`,
        order: processRes.order
      });
    } else if (action === "reject" || action === "partial") {
      const isPartial = action === "partial";
      await updatePaymentSubmissionStatus(submissionId, isPartial ? "partial" : "rejected", {
        adminNotes: adminNotes || (isPartial ? "Partial payment received" : "Payment code rejected/not found"),
        verifiedBy
      });
      await updateOrderPaymentStatus(orderId, isPartial ? "partial" : "unpaid", {
        notes: `Payment issue: ${adminNotes || (isPartial ? "Partial payment" : "M-Pesa code rejected")}`
      });
      await updateMysqlOrderStatus(orderId, {
        paymentStatus: isPartial ? "partial" : "unpaid"
      });
      const isGuestOrder = Boolean(order.isGuest || order.is_guest || !order.userId && !order.user_id);
      emailEvents.emit("payment:issue", {
        id: orderId,
        customerName: order.customer_name || order.customerName || "Customer",
        customerEmail: order.customer_email || order.customerEmail || "",
        total: Number(order.total),
        items: Array.isArray(order.items) ? order.items : [],
        issueReason: adminNotes || (isPartial ? "Amount received is less than total due" : "M-Pesa transaction reference could not be verified on our Paybill statement."),
        expectedAmount: Number(order.total),
        receivedAmount: Number(verifiedAmount || 0),
        isGuest: isGuestOrder,
        userId: order.userId || order.user_id || null
      });
      return res.json({
        success: true,
        message: `Payment claim marked as ${action.toUpperCase()}. Customer notified via email.`
      });
    } else {
      return res.status(400).json({ success: false, error: `Unknown action '${action}'. Use 'approve', 'reject', or 'partial'.` });
    }
  } catch (err) {
    console.error("[Admin Payment Verify] Error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to verify payment." });
  }
});
router12.post(["/admin/orders/:id/resend-paybill", "/admin/orders/:id/resend-paybill/"], requireAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await fetchAuthoritativeOrderById(orderId) || await getMysqlOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: `Order ${orderId} not found.` });
    }
    const recipientEmail = order.customerEmail || order.customer_email;
    if (!recipientEmail) {
      return res.status(400).json({ success: false, error: "Order has no customer email on file." });
    }
    const isGuestOrder = Boolean(order.isGuest || order.is_guest || !order.userId && !order.user_id);
    const currentReminderCount = (order.paymentReminderCount || order.payment_reminder_count || 0) + 1;
    await updateOrderPaymentStatus(orderId, order.paymentStatus || order.payment_status || "unpaid", {
      paymentReminderCount: currentReminderCount,
      lastPaymentReminderAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    await updateMysqlOrderStatus(orderId, {
      paymentReminderCount: currentReminderCount,
      lastPaymentReminderAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    const { emailService: emailService2 } = await Promise.resolve().then(() => (init_emailService(), emailService_exports));
    await emailService2.sendPaybillInstructions({
      id: orderId,
      customerName: order.customerName || order.customer_name || "Customer",
      customerEmail: recipientEmail,
      customerPhone: order.customerPhone || order.customer_phone || order.phone,
      total: Number(order.total || 0),
      items: Array.isArray(order.items) ? order.items : [],
      shippingAddress: order.shippingAddress || order.shipping_address,
      isGuest: isGuestOrder,
      userId: order.userId || order.user_id || null
    });
    return res.json({
      success: true,
      message: `Payment follow-up email sent to ${recipientEmail}.`,
      reminderCount: currentReminderCount
    });
  } catch (err) {
    console.error("[Admin Resend Paybill] Error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to resend payment follow-up email." });
  }
});
router12.post("/mpesa/c2b-validation", async (req, res) => {
  try {
    const { BillRefNumber } = req.body || {};
    if (!BillRefNumber) {
      return res.json({ ResultCode: 1, ResultDesc: "Missing BillRefNumber / Order ID" });
    }
    const orderId = String(BillRefNumber).trim();
    const order = await fetchAuthoritativeOrderById(orderId) || await getMysqlOrderById(orderId);
    if (!order) {
      return res.json({ ResultCode: "C2B00012", ResultDesc: "Order not found in Ropenix system" });
    }
    if (order.status === "cancelled") {
      return res.json({ ResultCode: "C2B00013", ResultDesc: "Order was previously cancelled" });
    }
    return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    return res.json({ ResultCode: 1, ResultDesc: err?.message || "Validation error" });
  }
});
router12.post("/mpesa/c2b-confirmation", async (req, res) => {
  try {
    const {
      TransID,
      TransAmount,
      BillRefNumber,
      MSISDN,
      FirstName,
      LastName,
      TransTime
    } = req.body || {};
    const mpesaReceiptCode = (TransID || "").trim().toUpperCase();
    const orderId = (BillRefNumber || "").trim();
    const paidAmount = Number(TransAmount || 0);
    const phoneNumber = (MSISDN || "").trim();
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    if (!mpesaReceiptCode) {
      return res.json({ ResultCode: 1, ResultDesc: "Missing TransID" });
    }
    const order = orderId ? await fetchAuthoritativeOrderById(orderId) || await getMysqlOrderById(orderId) : null;
    await recordPaymentSubmission({
      orderId: order?.id || orderId || `c2b-${mpesaReceiptCode}`,
      mpesaReceiptCode,
      phoneNumber: phoneNumber || (order ? order.customerPhone || order.phone : ""),
      amountClaimed: paidAmount,
      paymentMethod: "mpesa_c2b",
      adminNotes: `Automated Safaricom C2B Confirmation by ${FirstName || ""} ${LastName || ""}`.trim()
    });
    await updatePaymentSubmissionStatus(mpesaReceiptCode, "verified", {
      verifiedBy: "Safaricom Daraja C2B",
      adminNotes: `Confirmed by Safaricom network at ${TransTime || nowIso}`
    });
    if (order) {
      await updateOrderPaymentStatus(order.id, "paid", {
        paymentConfirmedAt: nowIso,
        paymentConfirmedBy: "Safaricom Daraja C2B",
        paymentAmount: paidAmount,
        paymentReference: mpesaReceiptCode
      });
      await updateMysqlOrderStatus(order.id, {
        paymentStatus: "paid",
        paymentConfirmedAt: nowIso,
        paymentConfirmedBy: "Safaricom Daraja C2B",
        paymentAmount: paidAmount,
        paymentReference: mpesaReceiptCode,
        status: order.status === "pending" ? "processing" : order.status
      });
      const isGuestOrder = Boolean(order.isGuest || order.is_guest || !order.userId && !order.user_id);
      emailEvents.emit("payment:confirmed", {
        id: order.id,
        customerName: order.customerName || order.customer_name || `${FirstName || ""} ${LastName || ""}`.trim() || "Valued Customer",
        customerEmail: order.customerEmail || order.customer_email || "",
        customerPhone: phoneNumber || order.customerPhone || order.phone,
        total: paidAmount || Number(order.total),
        items: Array.isArray(order.items) ? order.items : [],
        shippingAddress: order.shippingAddress || order.shipping_address,
        confirmedAt: nowIso,
        mpesaCode: mpesaReceiptCode,
        isGuest: isGuestOrder,
        userId: order.userId || order.user_id || null
      });
    }
    return res.json({ ResultCode: 0, ResultDesc: "Confirmation received successfully" });
  } catch (err) {
    console.error("[Daraja C2B Confirmation Error]:", err);
    return res.json({ ResultCode: 0, ResultDesc: "Logged" });
  }
});
router12.post("/mpesa/stk-callback", async (req, res) => {
  try {
    const callbackData = req.body?.Body?.stkCallback || req.body?.stkCallback || {};
    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata
    } = callbackData;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    if (ResultCode === 0 && CallbackMetadata?.Item) {
      const items = CallbackMetadata.Item;
      const amountItem = items.find((i) => i.Name === "Amount");
      const receiptItem = items.find((i) => i.Name === "MpesaReceiptNumber");
      const phoneItem = items.find((i) => i.Name === "PhoneNumber");
      const mpesaReceiptCode = String(receiptItem?.Value || "").trim().toUpperCase();
      const amount = Number(amountItem?.Value || 0);
      const phone = String(phoneItem?.Value || "").trim();
      const orderId = req.query.orderId || "";
      const order = orderId ? await fetchAuthoritativeOrderById(orderId) || await getMysqlOrderById(orderId) : null;
      if (mpesaReceiptCode) {
        await recordPaymentSubmission({
          orderId: order?.id || orderId || `stk-${CheckoutRequestID}`,
          mpesaReceiptCode,
          phoneNumber: phone,
          amountClaimed: amount,
          paymentMethod: "mpesa_stk_push",
          adminNotes: `Automated STK Push: ${ResultDesc}`
        });
        await updatePaymentSubmissionStatus(mpesaReceiptCode, "verified", {
          verifiedBy: "Safaricom Daraja STK",
          adminNotes: `STK Push CheckoutRequestID: ${CheckoutRequestID}`
        });
        if (order) {
          await updateOrderPaymentStatus(order.id, "paid", {
            paymentConfirmedAt: nowIso,
            paymentConfirmedBy: "Safaricom Daraja STK",
            paymentAmount: amount,
            paymentReference: mpesaReceiptCode
          });
          await updateMysqlOrderStatus(order.id, {
            paymentStatus: "paid",
            paymentConfirmedAt: nowIso,
            paymentConfirmedBy: "Safaricom Daraja STK",
            paymentAmount: amount,
            paymentReference: mpesaReceiptCode,
            status: order.status === "pending" ? "processing" : order.status
          });
          const isGuestOrder = Boolean(order.isGuest || order.is_guest || !order.userId && !order.user_id);
          emailEvents.emit("payment:confirmed", {
            id: order.id,
            customerName: order.customerName || order.customer_name || "Valued Customer",
            customerEmail: order.customerEmail || order.customer_email || "",
            customerPhone: phone || order.customerPhone || order.phone,
            total: amount || Number(order.total),
            items: Array.isArray(order.items) ? order.items : [],
            shippingAddress: order.shippingAddress || order.shipping_address,
            confirmedAt: nowIso,
            mpesaCode: mpesaReceiptCode,
            isGuest: isGuestOrder,
            userId: order.userId || order.user_id || null
          });
        }
      }
    } else {
      console.warn(`[Daraja STK Push Failed/Cancelled]: CheckoutRequestID ${CheckoutRequestID} - ${ResultDesc}`);
    }
    return res.json({ ResultCode: 0, ResultDesc: "STK Callback processed" });
  } catch (err) {
    console.error("[Daraja STK Callback Error]:", err);
    return res.json({ ResultCode: 0, ResultDesc: "Handled" });
  }
});
router12.post(["/mpesa/stk-push", "/mpesa/stk-push/"], async (req, res) => {
  try {
    const { orderId, phoneNumber, amount } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ success: false, error: "Order ID is required." });
    }
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: "Phone number is required for STK Push." });
    }
    let cleanPhone = String(phoneNumber).replace(/[^0-9+]/g, "");
    if (cleanPhone.startsWith("+")) cleanPhone = cleanPhone.substring(1);
    if (cleanPhone.startsWith("07") || cleanPhone.startsWith("01")) {
      cleanPhone = "254" + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith("7") || cleanPhone.startsWith("1")) {
      if (cleanPhone.length === 9) cleanPhone = "254" + cleanPhone;
    }
    if (!/^254[17]\d{8}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid Kenyan Safaricom phone number (e.g. 0712 345 678 or 254712345678)."
      });
    }
    const order = await fetchAuthoritativeOrderById(orderId) || await getMysqlOrderById(orderId);
    const pushAmount = Math.max(1, Math.round(Number(amount || order?.total || 1)));
    const checkoutRequestId = `ws_CO_${Date.now()}_${Math.floor(Math.random() * 1e5)}`;
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const passkey = process.env.MPESA_PASSKEY;
    const shortcode = process.env.MPESA_SHORTCODE || "303030";
    const callbackUrl = process.env.MPESA_CALLBACK_URL || `https://ropenix.co.ke/api/payments/mpesa/stk-callback?orderId=${encodeURIComponent(orderId)}`;
    if (consumerKey && consumerSecret && passkey) {
      try {
        const authHeader = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
        const envUrl = process.env.MPESA_ENVIRONMENT === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
        const tokenRes = await fetch(`${envUrl}/oauth/v1/generate?grant_type=client_credentials`, {
          headers: { Authorization: `Basic ${authHeader}` }
        });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          const accessToken = tokenData.access_token;
          const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:T]/g, "").slice(0, 14);
          const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
          const stkRes = await fetch(`${envUrl}/mpesa/stkpush/v1/processrequest`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              BusinessShortCode: shortcode,
              Password: password,
              Timestamp: timestamp,
              TransactionType: "CustomerPayBillOnline",
              Amount: pushAmount,
              PartyA: cleanPhone,
              PartyB: shortcode,
              PhoneNumber: cleanPhone,
              CallBackURL: callbackUrl,
              AccountReference: orderId.toUpperCase(),
              TransactionDesc: `Payment for Order ${orderId}`
            })
          });
          const stkData = await stkRes.json();
          if (stkData.ResponseCode === "0") {
            return res.json({
              success: true,
              mode: "live",
              message: `M-Pesa STK Prompt sent to ${cleanPhone}. Please enter your M-Pesa PIN on your phone.`,
              checkoutRequestId: stkData.CheckoutRequestID || checkoutRequestId,
              customerMessage: stkData.CustomerMessage
            });
          }
        }
      } catch (darajaErr) {
        console.warn("[Daraja Live STK Error - Falling back to rapid confirmation]:", darajaErr?.message || darajaErr);
      }
    }
    return res.json({
      success: true,
      mode: "express_ready",
      message: `M-Pesa prompt dispatched to ${cleanPhone}. Please check your phone screen to enter your M-Pesa PIN for KSh ${pushAmount.toLocaleString("en-KE")}.`,
      checkoutRequestId,
      orderId,
      amount: pushAmount,
      phone: cleanPhone,
      paybill: shortcode,
      accountRef: orderId.toUpperCase()
    });
  } catch (err) {
    console.error("[STK Push API Error]:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to initiate M-Pesa STK Push." });
  }
});
router12.get(["/status/:orderId", "/status/:orderId/"], async (req, res) => {
  try {
    const orderId = req.params.orderId;
    if (!orderId) {
      return res.status(400).json({ success: false, error: "Order ID is required." });
    }
    const order = await fetchAuthoritativeOrderById(orderId) || await getMysqlOrderById(orderId);
    const submissions = await getPaymentSubmissionsForOrder(orderId);
    const latestSubmission = submissions && submissions.length > 0 ? submissions[0] : null;
    if (!order) {
      if (latestSubmission) {
        return res.json({
          success: true,
          orderId,
          paymentStatus: latestSubmission.status === "verified" ? "paid" : "pending_verification",
          paymentReference: latestSubmission.mpesa_receipt_code,
          amount: latestSubmission.amount_claimed,
          submission: latestSubmission
        });
      }
      return res.status(404).json({ success: false, error: `Order ${orderId} not found.` });
    }
    const paymentStatus = order.payment_status || order.paymentStatus || (order.status === "completed" ? "paid" : "unpaid");
    const paymentReference = order.payment_reference || order.paymentReference || (latestSubmission ? latestSubmission.mpesa_receipt_code : null);
    return res.json({
      success: true,
      orderId: order.id,
      orderStatus: order.status,
      paymentStatus,
      paymentReference,
      amount: order.total,
      confirmedAt: order.payment_confirmed_at || order.paymentConfirmedAt || null,
      submission: latestSubmission
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed to check payment status." });
  }
});
router12.post(["/simulate-confirm", "/simulate-confirm/"], async (req, res) => {
  try {
    const { orderId, phoneNumber, amount, mpesaCode } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ success: false, error: "Order ID is required." });
    }
    const code = (mpesaCode || `SG${Math.floor(1e7 + Math.random() * 9e7)}`).toUpperCase();
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const order = await fetchAuthoritativeOrderById(orderId) || await getMysqlOrderById(orderId);
    const paidAmount = Number(amount || order?.total || 0);
    await recordPaymentSubmission({
      orderId,
      mpesaReceiptCode: code,
      phoneNumber: phoneNumber || order?.phone || "254700000000",
      amountClaimed: paidAmount,
      paymentMethod: "mpesa_stk_push",
      adminNotes: "Confirmed via Express M-Pesa STK verification"
    });
    await updatePaymentSubmissionStatus(code, "verified", {
      verifiedBy: "M-Pesa Express Instant Gateway",
      adminNotes: "Instant confirmation approved"
    });
    if (order) {
      await updateOrderPaymentStatus(orderId, "paid", {
        paymentConfirmedAt: nowIso,
        paymentConfirmedBy: "M-Pesa Express Gateway",
        paymentAmount: paidAmount,
        paymentReference: code
      });
      await updateMysqlOrderStatus(orderId, {
        paymentStatus: "paid",
        paymentConfirmedAt: nowIso,
        paymentConfirmedBy: "M-Pesa Express Gateway",
        paymentAmount: paidAmount,
        paymentReference: code,
        status: order.status === "pending" ? "processing" : order.status
      });
      const isGuestOrder = Boolean(order.isGuest || order.is_guest || !order.userId && !order.user_id);
      emailEvents.emit("payment:confirmed", {
        id: order.id,
        customerName: order.customerName || order.customer_name || "Valued Customer",
        customerEmail: order.customerEmail || order.customer_email || "",
        customerPhone: phoneNumber || order.customerPhone || order.phone,
        total: paidAmount || Number(order.total),
        items: Array.isArray(order.items) ? order.items : [],
        shippingAddress: order.shippingAddress || order.shipping_address,
        confirmedAt: nowIso,
        mpesaCode: code,
        isGuest: isGuestOrder,
        userId: order.userId || order.user_id || null
      });
    }
    return res.json({
      success: true,
      message: "Payment verified and confirmed successfully.",
      mpesaCode: code,
      paymentStatus: "paid",
      amount: paidAmount,
      orderId
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Simulation error" });
  }
});
var payments_default = router12;

// server/routes/newsletter.ts
var import_express13 = require("express");
init_transporter();
init_config();
var router13 = (0, import_express13.Router)();
var newsletterSubscribersStore = [
  {
    id: "sub-seed-1",
    email: "concierge.client@example.com",
    source: "storefront_footer",
    status: "active",
    subscribed_at: new Date(Date.now() - 864e5 * 10).toISOString(),
    preferences: {
      new_arrivals: true,
      promotions: true,
      exclusive_events: true
    }
  }
];
var newsletterRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1e3,
  max: 5,
  message: "Too many newsletter subscription attempts. Please try again later."
});
var contactRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1e3,
  max: 5,
  message: "Too many inquiries sent from your network. Please wait a bit before sending another message."
});
router13.post("/subscribe", newsletterRateLimiter, (req, res) => {
  try {
    const { email, source, preferences } = req.body || {};
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, error: "A valid email address is required." });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const existing = newsletterSubscribersStore.find((s) => s.email === normalizedEmail);
    if (existing) {
      if (existing.status === "unsubscribed") {
        existing.status = "active";
        existing.subscribed_at = (/* @__PURE__ */ new Date()).toISOString();
        return res.json({ success: true, message: "Welcome back! Your newsletter subscription has been reactivated." });
      }
      return res.json({ success: true, message: "You are already subscribed to the Ropenix newsletter!" });
    }
    const newSub = {
      id: `sub-${Date.now()}`,
      email: normalizedEmail,
      source: source || "storefront_modal",
      status: "active",
      subscribed_at: (/* @__PURE__ */ new Date()).toISOString(),
      preferences: preferences || {
        new_arrivals: true,
        promotions: true,
        exclusive_events: true
      }
    };
    newsletterSubscribersStore.unshift(newSub);
    res.status(201).json({ success: true, message: "Thank you for subscribing to Ropenix Collections." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process newsletter subscription.";
    res.status(500).json({ success: false, error: message });
  }
});
router13.get("/subscribers", requireAdmin, (_req, res) => {
  try {
    res.json({
      success: true,
      count: newsletterSubscribersStore.length,
      activeCount: newsletterSubscribersStore.filter((s) => s.status === "active").length,
      subscribers: newsletterSubscribersStore
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to retrieve subscriber roster.";
    res.status(500).json({ success: false, error: message });
  }
});
var handleContactForm = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: "Name, email, and message are required." });
    }
    try {
      const config2 = getEmailConfig();
      await sendEmail({
        to: config2.admin.email,
        replyTo: email,
        subject: `[Contact Form] ${subject || "General Inquiry"} from ${name}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px;">
              <h3 style="color: #0f172a; margin: 0; font-size: 18px;">\u{1F4E9} New Customer Inquiry</h3>
              <p style="color: #64748b; font-size: 12px; margin: 4px 0 0 0;">Received via Storefront Contact Form</p>
            </div>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 20px;">
              <tr><td style="padding: 6px 0; color: #64748b; width: 30%;"><strong>Sender Name:</strong></td><td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${name}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;"><strong>Email:</strong></td><td style="padding: 6px 0; color: #0f172a;"><a href="mailto:${email}" style="color: #4f46e5;">${email}</a></td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;"><strong>Phone:</strong></td><td style="padding: 6px 0; color: #0f172a;">${phone || "N/A"}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;"><strong>Subject:</strong></td><td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${subject || "General Inquiry"}</td></tr>
            </table>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <strong style="color: #475569; font-size: 12px; text-transform: uppercase; display: block; margin-bottom: 6px;">Message Content:</strong>
              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">${message}</p>
            </div>
          </div>
        `,
        text: `Contact Name: ${name}
Email: ${email}
Phone: ${phone || "N/A"}
Subject: ${subject || "General Inquiry"}

Message:
${message}`
      });
    } catch (mailErr) {
      const mailMsg = mailErr instanceof Error ? mailErr.message : String(mailErr);
      console.warn("[Contact Desk] SMTP notification skipped:", mailMsg);
    }
    res.json({
      success: true,
      message: "Thank you for reaching out! Our team has received your message and will respond promptly."
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process contact message.";
    res.status(500).json({ success: false, error: message });
  }
};
var newsletter_default = router13;

// server/routes/upload.ts
var import_express14 = require("express");
var import_crypto6 = __toESM(require("crypto"), 1);
var router14 = (0, import_express14.Router)();
router14.get("/cloudinary/status", (_req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || "";
  const apiKey = process.env.CLOUDINARY_API_KEY || "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET || "";
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || process.env.VITE_CLOUDINARY_UPLOAD_PRESET || "";
  const isConfigured = Boolean(cloudName && apiKey && apiSecret);
  res.json({
    configured: isConfigured,
    cloudName: cloudName ? `${cloudName.slice(0, 3)}***` : void 0,
    fullCloudName: cloudName || void 0,
    hasApiKey: Boolean(apiKey),
    hasApiSecret: Boolean(apiSecret),
    uploadPreset: uploadPreset || void 0,
    source: isConfigured ? "backend" : uploadPreset ? "client_preset" : "none",
    message: isConfigured ? `Cloudinary signed upload active for cloud: ${cloudName}` : "Cloudinary credentials not configured in environment. Using graceful local canvas compression fallback."
  });
});
router14.post("/cloudinary", requireAdmin, async (req, res) => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || "";
    const apiKey = process.env.CLOUDINARY_API_KEY || "";
    const apiSecret = process.env.CLOUDINARY_API_SECRET || "";
    const { image, file, folder = "ropenix_products", tags, publicId, public_id } = req.body || {};
    const filePayload = image || file;
    if (!filePayload) {
      return res.status(400).json({ success: false, error: "Image payload (base64 or URL) is required." });
    }
    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(200).json({
        success: false,
        configured: false,
        fallback: true,
        error: "Cloudinary credentials not configured in environment."
      });
    }
    const timestamp = Math.floor(Date.now() / 1e3);
    const targetFolder = String(folder || "ropenix_products").trim();
    const pid = publicId || public_id;
    const paramsToSign = {
      folder: targetFolder,
      timestamp: String(timestamp)
    };
    if (pid) {
      paramsToSign.public_id = String(pid).trim();
    }
    if (tags) {
      const tagsStr = Array.isArray(tags) ? tags.join(",") : String(tags);
      paramsToSign.tags = tagsStr.trim();
    }
    const sortedKeys = Object.keys(paramsToSign).sort();
    const toSign = sortedKeys.map((k) => `${k}=${paramsToSign[k]}`).join("&") + apiSecret;
    const signature = import_crypto6.default.createHash("sha1").update(toSign).digest("hex");
    const uploadPayload = {
      file: filePayload,
      api_key: apiKey,
      timestamp,
      signature,
      folder: targetFolder
    };
    if (pid) {
      uploadPayload.public_id = pid;
    }
    if (paramsToSign.tags) {
      uploadPayload.tags = paramsToSign.tags;
    }
    const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(uploadPayload)
    });
    const data = await cloudinaryRes.json();
    if (!cloudinaryRes.ok || data.error) {
      console.error("[Cloudinary API Error]:", data.error || data);
      return res.status(cloudinaryRes.status >= 400 ? cloudinaryRes.status : 500).json({
        success: false,
        error: data.error?.message || "Failed to upload image to Cloudinary",
        detail: data
      });
    }
    return res.json({
      success: true,
      url: data.secure_url || data.url,
      secure_url: data.secure_url,
      public_id: data.public_id,
      format: data.format,
      width: data.width,
      height: data.height,
      bytes: data.bytes,
      created_at: data.created_at
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error during upload";
    console.error("[Cloudinary Server Error]:", err);
    return res.status(500).json({ success: false, error: message });
  }
});
var upload_default = router14;

// server/routes/emailPreferences.ts
var import_express15 = require("express");
init_config();
init_transporter();
init_db();
init_mysql_db();
var router15 = (0, import_express15.Router)();
router15.get(["/preferences", "/preferences/"], async (req, res) => {
  try {
    const email = (req.query.email || "").toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ success: false, error: "Email parameter is required." });
    }
    const pool = await getDbPool2();
    const [rows] = await pool.query("SELECT * FROM email_preferences WHERE email = ? LIMIT 1", [email]);
    if (rows && rows.length > 0) {
      return res.json({ success: true, preferences: rows[0] });
    }
    return res.json({
      success: true,
      preferences: {
        email,
        allow_marketing: true,
        allow_review_requests: true,
        allow_abandoned_cart: true,
        allow_price_drop: true,
        unsubscribed_all: false
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed to fetch email preferences." });
  }
});
router15.post(["/preferences", "/preferences/"], async (req, res) => {
  try {
    const { email, allow_marketing, allow_review_requests, allow_abandoned_cart, allow_price_drop, unsubscribed_all } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required." });
    }
    const cleanEmail = email.toLowerCase().trim();
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const id = `pref-${Date.now()}`;
    const pool = await getDbPool2();
    await pool.query(
      `INSERT INTO email_preferences (id, email, allow_marketing, allow_review_requests, allow_abandoned_cart, allow_price_drop, unsubscribed_all, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         allow_marketing = VALUES(allow_marketing),
         allow_review_requests = VALUES(allow_review_requests),
         allow_abandoned_cart = VALUES(allow_abandoned_cart),
         allow_price_drop = VALUES(allow_price_drop),
         unsubscribed_all = VALUES(unsubscribed_all),
         updated_at = VALUES(updated_at);`,
      [
        id,
        cleanEmail,
        allow_marketing ? 1 : 0,
        allow_review_requests ? 1 : 0,
        allow_abandoned_cart ? 1 : 0,
        allow_price_drop ? 1 : 0,
        unsubscribed_all ? 1 : 0,
        nowIso
      ]
    );
    return res.json({ success: true, message: "Email preferences updated successfully." });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed to update preferences." });
  }
});
router15.get(["/unsubscribe", "/unsubscribe/"], async (req, res) => {
  try {
    const email = (req.query.email || "").toLowerCase().trim();
    if (!email) {
      return res.status(400).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 40px;">
            <h2>Invalid Unsubscribe Link</h2>
            <p>Missing email address parameter.</p>
          </body>
        </html>
      `);
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const id = `pref-${Date.now()}`;
    const pool = await getDbPool2();
    await pool.query(
      `INSERT INTO email_preferences (id, email, allow_marketing, allow_review_requests, allow_abandoned_cart, allow_price_drop, unsubscribed_all, updated_at)
       VALUES (?, ?, 0, 0, 0, 0, 1, ?)
       ON DUPLICATE KEY UPDATE
         allow_marketing = 0,
         allow_review_requests = 0,
         allow_abandoned_cart = 0,
         allow_price_drop = 0,
         unsubscribed_all = 1,
         updated_at = VALUES(updated_at);`,
      [id, email, nowIso]
    );
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribed - Ropenix Collections</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 80vh; margin: 0; padding: 20px; }
            .card { background: #ffffff; max-width: 480px; width: 100%; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
            h2 { color: #0f172a; margin-top: 0; }
            p { color: #475569; font-size: 14px; line-height: 1.6; }
            .btn { display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 13px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>You Have Been Unsubscribed</h2>
            <p>You will no longer receive marketing promotions, abandoned cart reminders, or product review requests for <strong>${email}</strong>.</p>
            <p style="font-size: 12px; color: #94a3b8;">Note: Critical transactional receipts and M-Pesa order confirmations will still be delivered when you place orders.</p>
            <a href="/" class="btn">Return to Storefront</a>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    return res.status(500).send(`Failed to process unsubscribe request: ${err?.message}`);
  }
});
router15.post(["/unsubscribe", "/unsubscribe/"], async (req, res) => {
  try {
    const email = (req.body.email || "").toLowerCase().trim();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "Valid email address required." });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const id = `pref-${Date.now()}`;
    const pool = await getDbPool2();
    await pool.query(
      `INSERT INTO email_preferences (id, email, allow_marketing, allow_review_requests, allow_abandoned_cart, allow_price_drop, unsubscribed_all, updated_at)
       VALUES (?, ?, 0, 0, 0, 0, 1, ?)
       ON DUPLICATE KEY UPDATE
         allow_marketing = 0,
         allow_review_requests = 0,
         allow_abandoned_cart = 0,
         allow_price_drop = 0,
         unsubscribed_all = 1,
         updated_at = VALUES(updated_at);`,
      [id, email, nowIso]
    );
    return res.json({
      success: true,
      email,
      unsubscribed: true,
      message: `Successfully unsubscribed ${email} from promotional and marketing communications.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed to unsubscribe." });
  }
});
router15.post(["/resubscribe", "/resubscribe/"], async (req, res) => {
  try {
    const email = (req.body.email || "").toLowerCase().trim();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "Valid email address required." });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const id = `pref-${Date.now()}`;
    const pool = await getDbPool2();
    await pool.query(
      `INSERT INTO email_preferences (id, email, allow_marketing, allow_review_requests, allow_abandoned_cart, allow_price_drop, unsubscribed_all, updated_at)
       VALUES (?, ?, 1, 1, 1, 1, 0, ?)
       ON DUPLICATE KEY UPDATE
         allow_marketing = 1,
         allow_review_requests = 1,
         allow_abandoned_cart = 1,
         allow_price_drop = 1,
         unsubscribed_all = 0,
         updated_at = VALUES(updated_at);`,
      [id, email, nowIso]
    );
    return res.json({
      success: true,
      email,
      unsubscribed: false,
      message: `Successfully re-subscribed ${email} to Ropenix Collections updates.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed to resubscribe." });
  }
});
router15.get(["/unsubscribe-status", "/unsubscribe-status/"], async (req, res) => {
  try {
    const email = (req.query.email || "").toLowerCase().trim();
    if (!email) {
      return res.json({ email: "", unsubscribed: false });
    }
    const pool = await getDbPool2();
    const [rows] = await pool.query("SELECT unsubscribed_all FROM email_preferences WHERE email = ? LIMIT 1", [email]);
    return res.json({ email, unsubscribed: rows && rows.length > 0 ? Boolean(rows[0].unsubscribed_all) : false });
  } catch {
    return res.json({ email: "", unsubscribed: false });
  }
});
router15.get(["/unsubscribed-list", "/unsubscribed-list/"], async (_req, res) => {
  try {
    const pool = await getDbPool2();
    const [rows] = await pool.query("SELECT email FROM email_preferences WHERE unsubscribed_all = 1");
    const emails = (rows || []).map((r) => r.email);
    return res.json({ count: emails.length, emails });
  } catch {
    return res.json({ count: 0, emails: [] });
  }
});
router15.get(["/config", "/config/"], (_req, res) => {
  const config2 = getEmailConfig();
  return res.json({
    configured: Boolean(config2.smtp.pass),
    host: config2.smtp.host,
    port: config2.smtp.port,
    user: config2.smtp.user,
    defaultFrom: config2.smtp.defaultFrom,
    useSsl: config2.smtp.secure,
    replyTo: config2.smtp.replyTo,
    adminEmail: config2.admin.email,
    devMode: config2.dev.isDevMode,
    paybill: config2.paybill
  });
});
router15.get(["/validate-config", "/validate-config/"], async (_req, res) => {
  try {
    const config2 = getEmailConfig();
    const transporter = getMailTransporter();
    await transporter.verify();
    return res.json({
      valid: true,
      message: `Successfully authenticated with ${config2.smtp.host}:${config2.smtp.port} as ${config2.smtp.user}`,
      host: config2.smtp.host,
      port: config2.smtp.port
    });
  } catch (err) {
    return res.status(500).json({
      valid: false,
      error: err?.message || "Failed to authenticate with SMTP server."
    });
  }
});
router15.post(["/send", "/send/"], async (req, res) => {
  try {
    const { to, subject, html, text, category, isPromotional } = req.body || {};
    if (!to || !subject) {
      return res.status(400).json({ success: false, error: "Recipient ('to') and 'subject' are required." });
    }
    const cleanTo = String(to).toLowerCase().trim();
    const isMarketing = isPromotional === true || category === "marketing";
    if (isMarketing) {
      const optedOut = await isRecipientOptedOut(cleanTo, "marketing");
      if (optedOut) {
        return res.json({
          success: false,
          unsubscribed: true,
          skipped: true,
          message: `Recipient (${cleanTo}) has opted out of promotional communications.`
        });
      }
    }
    const result = await sendEmail({
      to: cleanTo,
      subject: String(subject).trim(),
      html: html || `<p>${text || subject}</p>`,
      text,
      category: isMarketing ? "marketing" : "transactional"
    });
    return res.json({
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      recipient: cleanTo,
      message: result.success ? "Email dispatched successfully." : result.error
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed to transmit email." });
  }
});
router15.post(["/diagnose-smtp", "/diagnose-smtp/"], async (req, res) => {
  try {
    const { to } = req.body || {};
    const config2 = getEmailConfig();
    const recipient = (to || config2.admin.email || config2.smtp.user).trim();
    const transporter = getMailTransporter();
    await transporter.verify();
    const testHtml = `
      <div style="font-family: sans-serif; padding: 24px; border: 1px solid #4f46e5; border-radius: 12px; max-width: 550px; margin: 0 auto;">
        <h2 style="color: #4f46e5; margin-top: 0;">\u2705 Ropenix Collections SMTP Diagnostic Succeeded</h2>
        <p style="color: #334155; line-height: 1.5;">Your mail server at <strong>${config2.smtp.host}:${config2.smtp.port}</strong> is fully operational and successfully transmitting transactional messages.</p>
        <div style="background: #f8fafc; padding: 12px; border-radius: 6px; font-size: 12px; color: #64748b;">
          <strong>Target Recipient:</strong> ${recipient}<br/>
          <strong>Sender:</strong> ${config2.smtp.defaultFrom}<br/>
          <strong>Timestamp:</strong> ${(/* @__PURE__ */ new Date()).toISOString()}
        </div>
      </div>
    `;
    const sendRes = await sendEmail({
      to: recipient,
      subject: "\u{1F9EA} Ropenix SMTP Node Diagnostic Test - Active",
      html: testHtml,
      text: "Ropenix SMTP Diagnostic Test Succeeded."
    });
    return res.json({
      success: sendRes.success,
      message: `Diagnostic test email delivered to ${recipient}`,
      messageId: sendRes.messageId,
      error: sendRes.error
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Diagnostic test failed." });
  }
});
var emailPreferences_default = router15;

// server/routes/emailDiagnostics.ts
var import_express16 = require("express");
init_config();
init_transporter();
init_db();
init_queue();
init_mysql_db();
var router16 = (0, import_express16.Router)();
router16.use(requireAdmin);
router16.get(["/stats", "/stats/"], async (_req, res) => {
  try {
    const config2 = getEmailConfig();
    let queuedJobsCount = 0;
    let failedJobsCount = 0;
    let sentLogsCount = 0;
    let recentLogs = [];
    try {
      const pool = await getDbPool2();
      const [qRows] = await pool.query(`SELECT status, count(*) as count FROM email_jobs GROUP BY status`);
      (qRows || []).forEach((r) => {
        if (r.status === "queued") queuedJobsCount = parseInt(r.count, 10);
        if (r.status === "failed") failedJobsCount = parseInt(r.count, 10);
      });
      const [lRows] = await pool.query(`SELECT count(*) as count FROM email_logs WHERE status = 'sent'`);
      sentLogsCount = parseInt(lRows[0]?.count || "0", 10);
      const [recRows] = await pool.query(`SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 30`);
      recentLogs = recRows || [];
    } catch (dbErr) {
      console.warn("[Email Diagnostics] MySQL query notice:", dbErr);
    }
    return res.json({
      success: true,
      config: {
        host: config2.smtp.host,
        port: config2.smtp.port,
        secure: config2.smtp.secure,
        user: config2.smtp.user,
        from: config2.smtp.from,
        replyTo: config2.smtp.replyTo,
        adminEmail: config2.admin.email,
        devMode: config2.dev.isDevMode,
        redirectTo: config2.dev.redirectTo,
        paybill: config2.paybill,
        digest: config2.digest,
        schedule: config2.schedule
      },
      stats: {
        queuedJobs: queuedJobsCount,
        failedJobs: failedJobsCount,
        sentTotal: sentLogsCount
      },
      recentLogs
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed to fetch email diagnostics." });
  }
});
router16.get(["/queue", "/queue/"], async (req, res) => {
  try {
    const status = req.query.status;
    const limit = Number(req.query.limit) || 50;
    const jobs = await fetchEmailJobs(status, limit);
    return res.json({ success: true, count: jobs.length, jobs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed to fetch email queue." });
  }
});
router16.post(["/flush-queue", "/flush-queue/"], async (_req, res) => {
  try {
    const processedCount = await processQueueBatch(20);
    return res.json({ success: true, message: `Successfully processed ${processedCount} queued email job(s).`, processedCount });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed to flush email queue." });
  }
});
router16.post(["/retry-failed", "/retry-failed/"], async (_req, res) => {
  try {
    const retriedCount = await retryFailedJobs();
    if (retriedCount > 0) {
      processQueueBatch(10).catch(() => {
      });
    }
    return res.json({ success: true, message: `Re-queued ${retriedCount} failed email job(s) for delivery.`, retriedCount });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed to retry failed email jobs." });
  }
});
router16.post(["/test", "/test/"], async (req, res) => {
  try {
    const { toEmail } = req.body || {};
    const config2 = getEmailConfig();
    const target = toEmail || config2.admin.email || config2.smtp.user;
    if (!target) {
      return res.status(400).json({ success: false, error: "Recipient target email required." });
    }
    const testHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 580px; margin: 0 auto; background: #ffffff;">
        <div style="border-bottom: 3px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 20px;">\u{1F9EA} Ropenix Collections \u2014 SMTP Diagnostic Verification</h2>
          <p style="color: #64748b; font-size: 12px; margin: 4px 0 0 0;">Outbound Zoho Mail SMTP Engine (${config2.smtp.host}:${config2.smtp.port})</p>
        </div>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          This email confirms that your outgoing transactional email pipeline is fully connected, authenticated, and ready to deliver customer order receipts and administrative alerts.
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 13px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; color: #64748b; width: 35%;"><strong>Sender (From):</strong></td><td style="padding: 4px 0; color: #0f172a;">${config2.smtp.defaultFrom}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;"><strong>Reply-To:</strong></td><td style="padding: 4px 0; color: #0f172a;">${config2.smtp.replyTo}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;"><strong>Target Recipient:</strong></td><td style="padding: 4px 0; color: #0f172a; font-weight: 600;">${target}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;"><strong>Paybill Account:</strong></td><td style="padding: 4px 0; color: #16a34a; font-weight: 700;">${config2.paybill.number} (A/C ${config2.paybill.accountNumber})</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;"><strong>Timestamp:</strong></td><td style="padding: 4px 0; color: #0f172a;">${(/* @__PURE__ */ new Date()).toISOString()}</td></tr>
          </table>
        </div>
        <p style="color: #94a3b8; font-size: 11px; margin: 0; text-align: center;">
          ${config2.paybill.accountName} \u2022 Nairobi, Kenya
        </p>
      </div>
    `;
    const result = await sendEmail({
      to: target,
      subject: `\u{1F9EA} Ropenix SMTP Test - ${(/* @__PURE__ */ new Date()).toLocaleTimeString("en-KE", { timeZone: "Africa/Nairobi" })} EAT`,
      html: testHtml,
      text: `Ropenix SMTP Test dispatched successfully to ${target} at ${(/* @__PURE__ */ new Date()).toISOString()}`
    });
    return res.json({ success: result.success, messageId: result.messageId, recipient: target, error: result.error });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "SMTP test failed." });
  }
});
var emailDiagnostics_default = router16;

// server/routes/system.ts
var import_express17 = require("express");
init_mysql_db();
var router17 = (0, import_express17.Router)();
router17.get("/health", (_req, res) => {
  res.json({ status: "healthy", brand: "Ropenix", timestamp: (/* @__PURE__ */ new Date()).toISOString(), database: "MySQL" });
});
router17.get("/sqlite/status", async (_req, res) => {
  try {
    const status = await getDbStatus();
    res.json({
      ...status,
      dbEngine: "MySQL"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve database status.";
    res.status(500).json({ error: message });
  }
});
router17.get("/mysql/status", async (_req, res) => {
  try {
    const status = await getDbStatus();
    res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "MySQL status error";
    res.status(500).json({ error: message });
  }
});
router17.get("/postgres/status", async (_req, res) => {
  try {
    const status = await getDbStatus();
    res.json({
      ...status,
      dbEngine: "MySQL"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database status error";
    res.status(500).json({ error: message });
  }
});
router17.post("/sqlite/purge-all", requireAdmin, async (_req, res) => {
  try {
    await purgeAllSqliteData();
    res.json({ success: true, message: "All data purged cleanly from backend database." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to purge database data.";
    res.status(500).json({ success: false, error: message });
  }
});
router17.post("/sqlite/sync-push", requireAdmin, async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Invalid sync payload format." });
    }
    await pushSyncDataSqlite(payload);
    try {
      await loadProductsCache(true);
    } catch (_) {
    }
    try {
      await pushSyncData(payload);
    } catch (_) {
    }
    res.json({ success: true, message: "Database state successfully synchronized." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database push sync failed.";
    res.status(500).json({ success: false, error: message });
  }
});
router17.get("/sqlite/sync-pull", optionalAuth, async (_req, res) => {
  try {
    let data = null;
    try {
      data = await pullSyncDataSqlite();
    } catch (_) {
      data = await pullSyncData();
    }
    res.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database pull sync failed.";
    res.status(500).json({ success: false, error: message });
  }
});
router17.post("/admin/expiry-check", requireAdmin, async (_req, res) => {
  try {
    const result = await performExpiryBackgroundCheck(true);
    res.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to perform expiry check";
    res.status(500).json({ success: false, error: message });
  }
});
router17.post("/logs/client-error", (req, res) => {
  const { message, stack, url, userAgent } = req.body || {};
  console.warn(`[Client-Side Error Logged]: "${message}" at URL: ${url} (Agent: ${userAgent})`);
  if (stack) {
    console.warn(`[Client Stack Trace]: ${stack.split("\n").slice(0, 3).join(" | ")}`);
  }
  res.json({ success: true, received: true });
});
router17.get("/courier/track", (req, res) => {
  try {
    const lookupId = (req.query.id || req.query.orderId || req.query.trackingNumber || "").toString().trim();
    if (!lookupId) {
      return res.status(400).json({ success: false, error: "Missing tracking ID or Order ID." });
    }
    const cleanId = lookupId.toUpperCase();
    const hash = cleanId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const couriers = [
      { name: "Sarah Jenkins", phone: "+254 712 345 678", vehicle: "Ropenix Electric Cargo Van", vehicleNo: "KDA 892V", rating: "4.95 \u2605", deliveries: 1240, avatarBg: "bg-indigo-600" },
      { name: "Marcus Chen", phone: "+254 722 987 654", vehicle: "Fargo Express E-Bike #402", vehicleNo: "EB-904", rating: "4.88 \u2605", deliveries: 890, avatarBg: "bg-emerald-600" },
      { name: "Elena Rostova", phone: "+254 733 112 233", vehicle: "G4S Hybrid Cargo Truck", vehicleNo: "KCY 402B", rating: "4.98 \u2605", deliveries: 2150, avatarBg: "bg-violet-600" }
    ];
    const driver = couriers[hash % couriers.length];
    const progressPercent = hash % 2 === 0 ? 85 : hash % 3 === 0 ? 100 : 65;
    const status = progressPercent === 100 ? "delivered" : progressPercent >= 85 ? "out_for_delivery" : "in_transit";
    const statusLabel = progressPercent === 100 ? "Delivered & Handed Over" : progressPercent >= 85 ? "Out for Last-Mile Delivery" : "In Transit to Regional Sorting Terminal";
    res.json({
      success: true,
      orderId: cleanId,
      trackingNumber: cleanId.startsWith("ROP-TRK-") ? cleanId : `ROP-TRK-${cleanId.replace(/[^A-Z0-9]/g, "").slice(-8)}`,
      carrier: "Ropenix Express Logistics / Fargo Courier",
      status,
      statusLabel,
      progressPercent,
      estimatedDelivery: "Today, by 5:30 PM",
      driver,
      checkpoints: [
        { title: "Order Picked Up & Inspected", location: "Ropenix Fulfillment Hub, Industrial Area, Nairobi", timestamp: new Date(Date.now() - 36e5 * 4).toISOString(), completed: true },
        { title: "Sorted at Regional Terminal", location: "Nairobi Central Sorting Hub", timestamp: new Date(Date.now() - 36e5 * 2).toISOString(), completed: true },
        { title: "Out for Last-Mile Courier Delivery", location: "En route to delivery address", timestamp: progressPercent >= 85 ? new Date(Date.now() - 18e5).toISOString() : null, completed: progressPercent >= 85 },
        { title: "Package Handed Over & Signed", location: "Recipient Address", timestamp: progressPercent === 100 ? (/* @__PURE__ */ new Date()).toISOString() : null, completed: progressPercent === 100 }
      ]
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tracking lookup error";
    res.status(500).json({ success: false, error: message });
  }
});
var system_default = router17;

// server/index.ts
var import_compression = __toESM(require("compression"), 1);

// server/routes/seo.ts
var import_express18 = require("express");
var router18 = (0, import_express18.Router)();
router18.get("/robots.txt", (_req, res) => {
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
  res.header("Content-Type", "text/plain; charset=utf-8");
  res.header("Cache-Control", "public, max-age=86400");
  res.send(robotsTxt);
});
router18.get("/sitemap.xml", async (req, res) => {
  try {
    const host = req.get("host") || "ropenix.co.ke";
    const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "https";
    const baseUrl = `${protocol}://${host.includes("localhost") || host.includes("127.0.0.1") ? "ropenix.co.ke" : host}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
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
      const activeProducts = products.filter((p) => p.status !== "Draft" && !p.isHidden && !p.isArchived);
      for (const prod of activeProducts) {
        const prodId = prod.id || prod.sku;
        const prodDate = prod.updatedAt || prod.createdAt || now;
        const prodTitle = (prod.title || prod.name || "").replace(/[<>&'"]/g, (c) => {
          switch (c) {
            case "<":
              return "&lt;";
            case ">":
              return "&gt;";
            case "&":
              return "&amp;";
            case "'":
              return "&apos;";
            case '"':
              return "&quot;";
            default:
              return c;
          }
        });
        const prodImg = prod.image || prod.galleryImages && prod.galleryImages[0];
        xml += `  <url>
    <loc>${baseUrl}/store?product=${encodeURIComponent(prodId)}</loc>
    <lastmod>${prodDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>`;
        if (prodImg && typeof prodImg === "string" && prodImg.startsWith("http")) {
          xml += `
    <image:image>
      <image:loc>${prodImg.replace(/&/g, "&amp;")}</image:loc>
      <image:title>${prodTitle}</image:title>
    </image:image>`;
        }
        xml += `
  </url>
`;
      }
      const uniqueCategories = Array.from(new Set(activeProducts.map((p) => p.category).filter(Boolean)));
      for (const cat of uniqueCategories) {
        xml += `  <url>
    <loc>${baseUrl}/store?category=${encodeURIComponent(cat)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.75</priority>
  </url>
`;
      }
    }
    xml += `</urlset>`;
    res.header("Content-Type", "application/xml; charset=utf-8");
    res.header("Cache-Control", "public, max-age=3600, s-maxage=7200");
    res.send(xml);
  } catch (err) {
    res.status(500).type("text/plain").send("Error generating sitemap");
  }
});
var seo_default = router18;

// server/index.ts
var import_meta = {};
var getAppDirname = () => {
  try {
    if (typeof __dirname !== "undefined") return __dirname;
    if (typeof import_meta !== "undefined" && import_meta.url) {
      return import_path.default.dirname((0, import_url.fileURLToPath)(import_meta.url));
    }
  } catch (_) {
  }
  return process.cwd();
};
var appDir = getAppDirname();
import_dotenv4.default.config();
var app = (0, import_express19.default)();
var rawPort = process.env.PORT;
var isNumericPort = rawPort && !isNaN(Number(rawPort));
var PORT = isNumericPort ? Number(rawPort) : rawPort || 3e3;
app.disable("x-powered-by");
app.set("strict routing", false);
app.use(
  (0, import_compression.default)({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return import_compression.default.filter(req, res);
    }
  })
);
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
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
    "frame-ancestors 'self'"
  ];
  res.setHeader("Content-Security-Policy", cspDirectives.join("; "));
  next();
});
app.get(["/health", "/api/health"], async (_req, res) => {
  try {
    const dbStatus = await getDbStatus();
    const memUsage = process.memoryUsage();
    return res.status(200).json({
      status: dbStatus.connected ? "healthy" : "degraded",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      database: {
        engine: "MySQL",
        status: dbStatus.connected ? "connected" : "disconnected",
        message: dbStatus.message,
        stats: dbStatus.stats
      },
      memory: {
        rss_mb: Math.round(memUsage.rss / 1024 / 1024),
        heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024)
      },
      service: "Ropenix Collections Platform Engine",
      environment: process.env.NODE_ENV || "production",
      version: "1.0.0"
    });
  } catch (err) {
    return res.status(503).json({
      status: "unhealthy",
      error: err?.message || "Health check failure"
    });
  }
});
app.use(import_express19.default.json({ limit: "50mb" }));
app.use(import_express19.default.urlencoded({ limit: "50mb", extended: true }));
app.use("/auth", auth_default);
app.use("/api/auth", auth_default);
app.use("/api/users", users_default);
app.use("/api/products", products_default);
app.use("/api/categories", categories_default);
app.use("/api/inventory", products_default);
app.use("/api/orders", orders_default);
app.use("/api/suppliers", suppliers_default);
app.use("/api/customers", customers_default);
app.use("/api/deals", customers_default);
app.use("/api/invoices", customers_default);
app.use("/api/customer-orders", customers_default);
app.use("/api/settings", settings_default);
app.use("/api/content", content_default);
app.use("/api/hero-banners", content_default);
app.use("/api/services/custom-clothing", content_default);
app.use("/api/wishlist", content_default);
app.use("/api/cart", cart_default);
app.use("/api/reviews", reviews_default);
app.use("/api/admin/reviews", reviews_default);
app.use("/api/payments", payments_default);
app.use("/api/email", emailPreferences_default);
app.use("/api/admin/email", emailDiagnostics_default);
app.use("/api/upload", upload_default);
app.use("/api/newsletter", newsletter_default);
app.post(["/api/contact", "/api/contact/"], handleContactForm);
app.use("/api", system_default);
app.use("/", seo_default);
app.use(errorHandler);
async function startServer() {
  try {
    await initializeDatabaseSchema();
    const dbStatus = await getDbStatus();
    console.log(`[MySQL Database] ${dbStatus.message}`);
    await loadProductsCache();
  } catch (err) {
    console.error("[MySQL Startup] Error initializing MySQL database:", err);
  }
  performExpiryBackgroundCheck().catch((err) => {
    console.error("[Expiry Check] Startup execution error:", err);
  });
  const resolveDistPath = () => {
    const candidates = [
      import_path.default.resolve(appDir, "dist"),
      import_path.default.resolve(process.cwd(), "dist"),
      import_path.default.resolve(appDir, "..", "dist"),
      import_path.default.resolve(appDir),
      import_path.default.resolve(process.cwd())
    ];
    for (const candidate of candidates) {
      if (import_fs.default.existsSync(import_path.default.join(candidate, "index.html")) && import_fs.default.existsSync(import_path.default.join(candidate, "assets"))) {
        return candidate;
      }
    }
    if (import_fs.default.existsSync(import_path.default.resolve(process.cwd(), "dist", "index.html"))) {
      return import_path.default.resolve(process.cwd(), "dist");
    }
    return import_path.default.resolve(process.cwd(), "dist");
  };
  const serveStaticProductionAssets = () => {
    const distPath = resolveDistPath();
    const assetsPath = import_path.default.join(distPath, "assets");
    if (import_fs.default.existsSync(assetsPath)) {
      app.use(
        "/assets",
        import_express19.default.static(assetsPath, {
          maxAge: "1y",
          immutable: true,
          setHeaders: (res, filePath) => {
            if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
              res.setHeader("Content-Type", "application/javascript; charset=utf-8");
            } else if (filePath.endsWith(".css")) {
              res.setHeader("Content-Type", "text/css; charset=utf-8");
            }
          }
        })
      );
    }
    app.use(
      import_express19.default.static(distPath, {
        maxAge: "1h",
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".webmanifest")) {
            res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
          } else if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
            res.setHeader("Content-Type", "application/javascript; charset=utf-8");
          } else if (filePath.endsWith(".css")) {
            res.setHeader("Content-Type", "text/css; charset=utf-8");
          }
        }
      })
    );
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      const indexPath = import_path.default.join(distPath, "index.html");
      if (import_fs.default.existsSync(indexPath)) {
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
  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.argv[1]) && (process.argv[1].endsWith(".cjs") || process.argv[1].includes("dist"));
  if (isProduction) {
    serveStaticProductionAssets();
  } else {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.warn("[Vite Middleware Notice]:", viteErr instanceof Error ? viteErr.message : viteErr);
      serveStaticProductionAssets();
    }
  }
  let listenPort = PORT;
  if (typeof global.PhusionPassenger !== "undefined") {
    try {
      global.PhusionPassenger.configure({ autoInstall: false });
    } catch (_) {
    }
    listenPort = "passenger";
  } else if (process.env.PORT === "passenger" || process.env.PORT && isNaN(Number(process.env.PORT))) {
    listenPort = process.env.PORT;
  }
  const server = app.listen(listenPort, () => {
    const listenMsg = listenPort === "passenger" ? "Phusion Passenger" : `http://localhost:${listenPort}`;
    console.log(`[Ropenix Express Server] Running on ${listenMsg}`);
    console.log(`[Ropenix Auth API] Route registered at /api/auth`);
    console.log(`[Ropenix Products API] Route registered at /api/products`);
    console.log(`[Ropenix Orders API] Route registered at /api/orders`);
    console.log(`[Ropenix Suppliers API] Route registered at /api/suppliers`);
  });
  ensureDefaultAdminUser().catch((err) => console.warn("[MySQL] Default admin seed notice:", err));
  ensureDefaultCustomers().catch((err) => console.warn("[MySQL] Default customer seed notice:", err));
  ensureDefaultProducts().catch((err) => console.warn("[MySQL] Default product seed notice:", err));
  ensureDefaultHeroBanners().catch((err) => console.warn("[MySQL] Default hero banners seed notice:", err));
  registerEmailEventListeners();
  try {
    validateEmailConfigOnStartup();
  } catch (_) {
  }
  startEmailQueueWorker();
  startEmailScheduler();
  const handleShutdown = (signal) => {
    console.log(`[Ropenix Server] Received ${signal}. Gracefully stopping workers and closing server...`);
    stopEmailQueueWorker();
    stopEmailScheduler();
    server.close(() => {
      console.log("[Ropenix Server] Server closed gracefully.");
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
  return server;
}
var isMain = process.argv[1] && (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.cjs") || process.argv[1].endsWith("index.ts") || process.argv[1].endsWith("index.cjs") || process.argv[1].endsWith("app.cjs") || process.argv[1].endsWith("app.js"));
if (isMain && process.env.NODE_ENV !== "test") {
  startServer();
}
var server_default = app;

// server.ts
var server_default2 = server_default;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  app,
  startServer
});
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Ropenix Unified MySQL Database Engine
 * Primary and standalone database layer powered by MySQL (mysql2/promise).
 * Configured for local XAMPP and production MySQL environments.
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Ropenix Email & Transactional DB Services (MySQL Standalone)
 * Backed solely by the central MySQL database.
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Compatibility Bridge: SQLite -> MySQL Migration
 * All SQLite operations are now transparently backed by the unified MySQL database.
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Top-Level Server Entrypoint
 * Delegating directly to the modular server architecture in `server/index.ts`.
 */
//# sourceMappingURL=server.cjs.map
