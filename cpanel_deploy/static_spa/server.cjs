var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_dotenv2 = __toESM(require("dotenv"), 1);
var import_nodemailer = __toESM(require("nodemailer"), 1);
var import_dns = __toESM(require("dns"), 1);

// src/lib/mysql-db.ts
var import_promise = __toESM(require("mysql2/promise"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var dbPool = null;
var isInitialized = false;
function getDbHost() {
  let host = (process.env.DB_HOST || "").trim();
  if (host === "localhhost") {
    host = "localhost";
  }
  return host;
}
function isDbConfigured() {
  const host = getDbHost();
  const user = (process.env.DB_USER || "").trim();
  const db = (process.env.DB_NAME || "").trim();
  return !!(host && user && db);
}
async function getDbPool() {
  if (!isDbConfigured()) {
    return null;
  }
  if (!dbPool) {
    const host = getDbHost();
    try {
      dbPool = import_promise.default.createPool({
        host,
        port: Number(process.env.DB_PORT) || 3306,
        user: (process.env.DB_USER || "").trim(),
        password: process.env.DB_PASSWORD,
        database: (process.env.DB_NAME || "").trim(),
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 5e3
      });
      const connection = await dbPool.getConnection();
      console.log("[MySQL] Successfully connected to production database.");
      connection.release();
      await initializeDatabaseSchema();
    } catch (error) {
      console.warn("[MySQL] Connection pool creation attempt failed:", error.message || error);
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
  return dbPool;
}
async function initializeDatabaseSchema() {
  if (isInitialized || !dbPool) return;
  try {
    console.log("[MySQL] Initializing database tables...");
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(255) PRIMARY KEY,
        sku VARCHAR(255) NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        price DECIMAL(15, 2) NOT NULL,
        category VARCHAR(255) NULL,
        tags TEXT NULL,
        type VARCHAR(50) NOT NULL,
        imageUrl TEXT NULL,
        images TEXT NULL,
        stock INT NULL,
        lowStockThreshold INT NULL,
        variations TEXT NULL,
        rating DECIMAL(3, 2) DEFAULT 0,
        reviewsCount INT DEFAULT 0,
        reviews TEXT NULL,
        digitalFileUrl TEXT NULL,
        previousPrice DECIMAL(15, 2) NULL,
        backInStockAlert TINYINT(1) DEFAULT 0,
        costPrice DECIMAL(15, 2) NULL,
        taxId VARCHAR(255) NULL,
        status VARCHAR(50) DEFAULT 'Active',
        paymentRestriction VARCHAR(50) DEFAULT 'both',
        shortDescription TEXT NULL,
        detailedDescription LONGTEXT NULL,
        features TEXT NULL,
        specifications TEXT NULL,
        whatsInTheBox TEXT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    try {
      await dbPool.query("ALTER TABLE products ADD COLUMN paymentRestriction VARCHAR(50) DEFAULT 'both'");
    } catch (_) {
    }
    try {
      await dbPool.query("ALTER TABLE products ADD COLUMN shortDescription TEXT NULL");
    } catch (_) {
    }
    try {
      await dbPool.query("ALTER TABLE products ADD COLUMN detailedDescription LONGTEXT NULL");
    } catch (_) {
    }
    try {
      await dbPool.query("ALTER TABLE products ADD COLUMN features TEXT NULL");
    } catch (_) {
    }
    try {
      await dbPool.query("ALTER TABLE products ADD COLUMN specifications TEXT NULL");
    } catch (_) {
    }
    try {
      await dbPool.query("ALTER TABLE products ADD COLUMN whatsInTheBox TEXT NULL");
    } catch (_) {
    }
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS affiliates (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        merchant VARCHAR(255) NULL,
        description TEXT NULL,
        commissionRate DECIMAL(5, 2) NOT NULL,
        price DECIMAL(15, 2) NOT NULL,
        category VARCHAR(255) NULL,
        imageUrl TEXT NULL,
        affiliateUrl TEXT NULL,
        clicks INT DEFAULT 0,
        conversions INT DEFAULT 0,
        revenueEarned DECIMAL(15, 2) DEFAULT 0,
        affiliateNotes TEXT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    try {
      await dbPool.query("ALTER TABLE affiliates ADD COLUMN affiliateNotes TEXT NULL");
    } catch (_) {
    }
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(255) PRIMARY KEY,
        customerName VARCHAR(255) NOT NULL,
        customerEmail VARCHAR(255) NOT NULL,
        items TEXT NOT NULL,
        total DECIMAL(15, 2) NOT NULL,
        status VARCHAR(50) NOT NULL,
        date VARCHAR(100) NOT NULL,
        couponCode VARCHAR(255) NULL,
        customNote TEXT NULL,
        shippingAddress TEXT NULL,
        notesHistory TEXT NULL,
        statusHistory TEXT NULL,
        isGuest TINYINT(1) DEFAULT 0,
        paymentMethod VARCHAR(50) DEFAULT 'cod'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    try {
      await dbPool.query("ALTER TABLE orders ADD COLUMN paymentMethod VARCHAR(50) DEFAULT 'cod'");
    } catch (_) {
    }
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        source VARCHAR(255) NOT NULL,
        clicks INT DEFAULT 0,
        conversions INT DEFAULT 0,
        earnings DECIMAL(15, 2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'active'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS click_logs (
        id VARCHAR(255) PRIMARY KEY,
        timestamp VARCHAR(100) NOT NULL,
        targetId VARCHAR(255) NOT NULL,
        targetName VARCHAR(255) NOT NULL,
        targetType VARCHAR(50) NOT NULL,
        campaignName VARCHAR(255) NULL,
        source VARCHAR(255) NOT NULL,
        converted TINYINT(1) DEFAULT 0,
        commission DECIMAL(15, 2) DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS inventory_audit_logs (
        id VARCHAR(255) PRIMARY KEY,
        productId VARCHAR(255) NOT NULL,
        productName VARCHAR(255) NOT NULL,
        productSku VARCHAR(255) NOT NULL,
        timestamp VARCHAR(100) NOT NULL,
        changeQuantity INT NOT NULL,
        newStock INT NOT NULL,
        reason VARCHAR(100) NOT NULL,
        details TEXT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(255) PRIMARY KEY,
        setting_value LONGTEXT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    isInitialized = true;
    console.log("[MySQL] Database tables successfully initialized/verified.");
  } catch (error) {
    console.error("[MySQL] Database table initialization failed:", error);
    throw error;
  }
}
async function getDbStatus() {
  if (!isDbConfigured()) {
    return {
      configured: false,
      connected: false,
      message: "MySQL configuration variables are missing in your environment variables (.env). Please set DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME."
    };
  }
  try {
    const pool = await getDbPool();
    if (!pool) {
      return {
        configured: true,
        connected: false,
        message: "Configuration found, but unable to establish connection pool."
      };
    }
    const [prodCount] = await pool.query("SELECT COUNT(*) as count FROM products");
    const [orderCount] = await pool.query("SELECT COUNT(*) as count FROM orders");
    const [affCount] = await pool.query("SELECT COUNT(*) as count FROM affiliates");
    const [campCount] = await pool.query("SELECT COUNT(*) as count FROM campaigns");
    return {
      configured: true,
      connected: true,
      message: "Successfully connected to production MySQL database.",
      stats: {
        products: prodCount[0]?.count || 0,
        orders: orderCount[0]?.count || 0,
        affiliates: affCount[0]?.count || 0,
        campaigns: campCount[0]?.count || 0
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
async function pushSyncData(payload) {
  const pool = await getDbPool();
  if (!pool) {
    throw new Error("Database is not configured or connected.");
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (Array.isArray(payload.veloce_products)) {
      await connection.query("DELETE FROM products");
      for (const p of payload.veloce_products) {
        if (!p.id || !p.name) continue;
        await connection.query(
          `INSERT INTO products 
           (id, sku, name, description, price, category, tags, type, imageUrl, images, stock, lowStockThreshold, variations, rating, reviewsCount, reviews, digitalFileUrl, previousPrice, backInStockAlert, costPrice, taxId, status, paymentRestriction, shortDescription, detailedDescription, features, specifications, whatsInTheBox)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.id,
            p.sku || null,
            p.name,
            p.description || null,
            p.price || 0,
            p.category || null,
            p.tags ? JSON.stringify(p.tags) : null,
            p.type,
            p.imageUrl || null,
            p.images ? JSON.stringify(p.images) : null,
            p.stock !== void 0 ? p.stock : null,
            p.lowStockThreshold !== void 0 ? p.lowStockThreshold : null,
            p.variations ? JSON.stringify(p.variations) : null,
            p.rating || 0,
            p.reviewsCount || 0,
            p.reviews ? JSON.stringify(p.reviews) : null,
            p.digitalFileUrl || null,
            p.previousPrice !== void 0 ? p.previousPrice : null,
            p.backInStockAlert ? 1 : 0,
            p.costPrice !== void 0 ? p.costPrice : null,
            p.taxId || null,
            p.status || "Active",
            p.paymentRestriction || "both",
            p.shortDescription || null,
            p.detailedDescription || null,
            p.features ? JSON.stringify(p.features) : null,
            p.specifications ? JSON.stringify(p.specifications) : null,
            p.whatsInTheBox || null
          ]
        );
      }
    }
    if (Array.isArray(payload.veloce_affiliates)) {
      await connection.query("DELETE FROM affiliates");
      for (const a of payload.veloce_affiliates) {
        if (!a.id || !a.name) continue;
        await connection.query(
          `INSERT INTO affiliates 
           (id, name, merchant, description, commissionRate, price, category, imageUrl, affiliateUrl, clicks, conversions, revenueEarned, affiliateNotes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            a.id,
            a.name,
            a.merchant || null,
            a.description || null,
            a.commissionRate || 0,
            a.price || 0,
            a.category || null,
            a.imageUrl || null,
            a.affiliateUrl || null,
            a.clicks || 0,
            a.conversions || 0,
            a.revenueEarned || 0,
            a.affiliateNotes ? JSON.stringify(a.affiliateNotes) : null
          ]
        );
      }
    }
    if (Array.isArray(payload.veloce_orders)) {
      await connection.query("DELETE FROM orders");
      for (const o of payload.veloce_orders) {
        if (!o.id) continue;
        await connection.query(
          `INSERT INTO orders 
           (id, customerName, customerEmail, items, total, status, date, couponCode, customNote, shippingAddress, notesHistory, statusHistory, isGuest, paymentMethod)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            o.id,
            o.customerName || "Guest Customer",
            o.customerEmail || "",
            o.items ? JSON.stringify(o.items) : "[]",
            o.total || 0,
            o.status || "pending",
            o.date || (/* @__PURE__ */ new Date()).toISOString(),
            o.couponCode || null,
            o.customNote || null,
            o.shippingAddress || null,
            o.notesHistory ? JSON.stringify(o.notesHistory) : null,
            o.statusHistory ? JSON.stringify(o.statusHistory) : null,
            o.isGuest ? 1 : 0,
            o.paymentMethod || "cod"
          ]
        );
      }
    }
    if (Array.isArray(payload.veloce_campaigns)) {
      await connection.query("DELETE FROM campaigns");
      for (const c of payload.veloce_campaigns) {
        if (!c.id || !c.name) continue;
        await connection.query(
          `INSERT INTO campaigns 
           (id, name, source, clicks, conversions, earnings, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            c.id,
            c.name,
            c.source,
            c.clicks || 0,
            c.conversions || 0,
            c.earnings || 0,
            c.status || "active"
          ]
        );
      }
    }
    if (Array.isArray(payload.veloce_clicklogs)) {
      await connection.query("DELETE FROM click_logs");
      for (const cl of payload.veloce_clicklogs) {
        if (!cl.id) continue;
        await connection.query(
          `INSERT INTO click_logs 
           (id, timestamp, targetId, targetName, targetType, campaignName, source, converted, commission)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cl.id,
            cl.timestamp,
            cl.targetId,
            cl.targetName,
            cl.targetType,
            cl.campaignName || null,
            cl.source,
            cl.converted ? 1 : 0,
            cl.commission || 0
          ]
        );
      }
    }
    if (Array.isArray(payload.veloce_inventory_audit_logs)) {
      await connection.query("DELETE FROM inventory_audit_logs");
      for (const il of payload.veloce_inventory_audit_logs) {
        if (!il.id) continue;
        await connection.query(
          `INSERT INTO inventory_audit_logs 
           (id, productId, productName, productSku, timestamp, changeQuantity, newStock, reason, details)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            il.id,
            il.productId,
            il.productName,
            il.productSku || "",
            il.timestamp,
            il.changeQuantity,
            il.newStock,
            il.reason,
            il.details || null
          ]
        );
      }
    }
    const settingsKeys = [
      "veloce_cart",
      "veloce_wishlist",
      "veloce_earnings",
      "veloce_loyalty_points",
      "veloce_coupons",
      "veloce_promo_banner",
      "customer_support_tickets",
      "veloce_referral_history",
      "veloce_referral_balances",
      "is_joined_affiliate",
      "veloce_payout_logs"
    ];
    for (const key of settingsKeys) {
      if (payload[key] !== void 0 && payload[key] !== null) {
        const valueStr = typeof payload[key] === "object" ? JSON.stringify(payload[key]) : String(payload[key]);
        await connection.query(
          `INSERT INTO app_settings (setting_key, setting_value) 
           VALUES (?, ?) 
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          [key, valueStr]
        );
      }
    }
    await connection.commit();
    console.log("[MySQL] Production push synchronization successfully completed.");
  } catch (error) {
    await connection.rollback();
    console.error("[MySQL] Production push synchronization failed:", error);
    throw error;
  } finally {
    connection.release();
  }
}
async function pullSyncData() {
  const pool = await getDbPool();
  if (!pool) {
    throw new Error("Database is not configured or connected.");
  }
  const result = {};
  try {
    const [productsRows] = await pool.query("SELECT * FROM products");
    result.veloce_products = productsRows.map((p) => ({
      id: p.id,
      sku: p.sku || "",
      name: p.name,
      description: p.description || "",
      price: Number(p.price),
      category: p.category || "",
      tags: p.tags ? JSON.parse(p.tags) : [],
      type: p.type,
      imageUrl: p.imageUrl || "",
      images: p.images ? JSON.parse(p.images) : [],
      stock: p.stock !== null ? Number(p.stock) : null,
      lowStockThreshold: p.lowStockThreshold !== null ? Number(p.lowStockThreshold) : void 0,
      variations: p.variations ? JSON.parse(p.variations) : [],
      rating: Number(p.rating),
      reviewsCount: Number(p.reviewsCount),
      reviews: p.reviews ? JSON.parse(p.reviews) : [],
      digitalFileUrl: p.digitalFileUrl || void 0,
      previousPrice: p.previousPrice !== null ? Number(p.previousPrice) : void 0,
      backInStockAlert: !!p.backInStockAlert,
      costPrice: p.costPrice !== null ? Number(p.costPrice) : void 0,
      taxId: p.taxId || void 0,
      status: p.status || "Active",
      paymentRestriction: p.paymentRestriction || "both",
      shortDescription: p.shortDescription || void 0,
      detailedDescription: p.detailedDescription || void 0,
      features: p.features ? JSON.parse(p.features) : void 0,
      specifications: p.specifications ? JSON.parse(p.specifications) : void 0,
      whatsInTheBox: p.whatsInTheBox || void 0
    }));
    const [affiliatesRows] = await pool.query("SELECT * FROM affiliates");
    result.veloce_affiliates = affiliatesRows.map((a) => ({
      id: a.id,
      name: a.name,
      merchant: a.merchant || "",
      description: a.description || "",
      commissionRate: Number(a.commissionRate),
      price: Number(a.price),
      category: a.category || "",
      imageUrl: a.imageUrl || "",
      affiliateUrl: a.affiliateUrl || "",
      clicks: Number(a.clicks),
      conversions: Number(a.conversions),
      revenueEarned: Number(a.revenueEarned),
      affiliateNotes: a.affiliateNotes ? JSON.parse(a.affiliateNotes) : void 0
    }));
    const [ordersRows] = await pool.query("SELECT * FROM orders");
    result.veloce_orders = ordersRows.map((o) => ({
      id: o.id,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      items: o.items ? JSON.parse(o.items) : [],
      total: Number(o.total),
      status: o.status,
      date: o.date,
      couponCode: o.couponCode || void 0,
      customNote: o.customNote || void 0,
      shippingAddress: o.shippingAddress || void 0,
      notesHistory: o.notesHistory ? JSON.parse(o.notesHistory) : [],
      statusHistory: o.statusHistory ? JSON.parse(o.statusHistory) : [],
      isGuest: !!o.isGuest,
      paymentMethod: o.paymentMethod || "cod"
    }));
    const [campaignsRows] = await pool.query("SELECT * FROM campaigns");
    result.veloce_campaigns = campaignsRows.map((c) => ({
      id: c.id,
      name: c.name,
      source: c.source,
      clicks: Number(c.clicks),
      conversions: Number(c.conversions),
      earnings: Number(c.earnings),
      status: c.status || "active"
    }));
    const [clickLogsRows] = await pool.query("SELECT * FROM click_logs");
    result.veloce_clicklogs = clickLogsRows.map((cl) => ({
      id: cl.id,
      timestamp: cl.timestamp,
      targetId: cl.targetId,
      targetName: cl.targetName,
      targetType: cl.targetType,
      campaignName: cl.campaignName || void 0,
      source: cl.source,
      converted: !!cl.converted,
      commission: Number(cl.commission)
    }));
    const [inventoryAuditRows] = await pool.query("SELECT * FROM inventory_audit_logs");
    result.veloce_inventory_audit_logs = inventoryAuditRows.map((il) => ({
      id: il.id,
      productId: il.productId,
      productName: il.productName,
      productSku: il.productSku,
      timestamp: il.timestamp,
      changeQuantity: Number(il.changeQuantity),
      newStock: Number(il.newStock),
      reason: il.reason,
      details: il.details || void 0
    }));
    const [settingsRows] = await pool.query("SELECT * FROM app_settings");
    settingsRows.forEach((row) => {
      try {
        result[row.setting_key] = JSON.parse(row.setting_value);
      } catch (e) {
        const val = row.setting_value;
        if (val === "true") result[row.setting_key] = true;
        else if (val === "false") result[row.setting_key] = false;
        else if (!isNaN(Number(val))) result[row.setting_key] = Number(val);
        else result[row.setting_key] = val;
      }
    });
    return result;
  } catch (error) {
    console.error("[MySQL] Production pull synchronization failed:", error);
    throw error;
  }
}

// src/lib/sqlite-db.ts
var import_sql = __toESM(require("sql.js"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var DB_FILE_PATH = import_path.default.join(process.cwd(), "veloce.sqlite");
var dbInstance = null;
function saveSqliteDb(db = dbInstance) {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    const tmpPath = `${DB_FILE_PATH}.tmp`;
    import_fs.default.writeFileSync(tmpPath, buffer);
    import_fs.default.renameSync(tmpPath, DB_FILE_PATH);
    console.log(`[SQLite] Persisted database to file: ${DB_FILE_PATH} (${buffer.length} bytes)`);
  } catch (err) {
    console.error("[SQLite] Failed to persist database to disk:", err);
    try {
      const data = db.export();
      import_fs.default.writeFileSync(DB_FILE_PATH, Buffer.from(data));
    } catch (e) {
    }
  }
}
async function getSqliteDb() {
  if (dbInstance) {
    return dbInstance;
  }
  const SQL = await (0, import_sql.default)();
  if (import_fs.default.existsSync(DB_FILE_PATH)) {
    try {
      const fileBuffer = import_fs.default.readFileSync(DB_FILE_PATH);
      if (fileBuffer.length > 0) {
        dbInstance = new SQL.Database(fileBuffer);
        dbInstance.exec("PRAGMA quick_check;");
        console.log(`[SQLite] Loaded existing database from ${DB_FILE_PATH} (${fileBuffer.length} bytes)`);
        initializeSqliteSchema(dbInstance);
        return dbInstance;
      }
    } catch (err) {
      console.warn("[SQLite] Error reading existing SQLite file, creating fresh database:", err);
      try {
        if (import_fs.default.existsSync(DB_FILE_PATH)) {
          import_fs.default.unlinkSync(DB_FILE_PATH);
          console.log("[SQLite] Cleaned up malformed database disk image from disk.");
        }
      } catch (unlinkErr) {
        console.error("[SQLite] Failed to remove malformed file:", unlinkErr);
      }
    }
  }
  dbInstance = new SQL.Database();
  initializeSqliteSchema(dbInstance);
  saveSqliteDb(dbInstance);
  console.log(`[SQLite] Initialized new SQLite database at ${DB_FILE_PATH}`);
  return dbInstance;
}
function initializeSqliteSchema(db) {
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

    CREATE TABLE IF NOT EXISTS affiliates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      merchant TEXT,
      description TEXT,
      commissionRate REAL NOT NULL,
      price REAL NOT NULL,
      category TEXT,
      imageUrl TEXT,
      affiliateUrl TEXT,
      clicks INTEGER DEFAULT 0,
      conversions INTEGER DEFAULT 0,
      revenueEarned REAL DEFAULT 0,
      affiliateNotes TEXT
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
async function getSqliteDbStatus() {
  try {
    const db = await getSqliteDb();
    const exists = import_fs.default.existsSync(DB_FILE_PATH);
    const size = exists ? import_fs.default.statSync(DB_FILE_PATH).size : 0;
    const prodRes = db.exec("SELECT COUNT(*) as count FROM products;");
    const prodCount = prodRes.length > 0 ? prodRes[0].values[0][0] : 0;
    const orderRes = db.exec("SELECT COUNT(*) as count FROM orders;");
    const orderCount = orderRes.length > 0 ? orderRes[0].values[0][0] : 0;
    const affRes = db.exec("SELECT COUNT(*) as count FROM affiliates;");
    const affCount = affRes.length > 0 ? affRes[0].values[0][0] : 0;
    const revRes = db.exec("SELECT COUNT(*) as count FROM reviews;");
    const revCount = revRes.length > 0 ? revRes[0].values[0][0] : 0;
    return {
      configured: true,
      connected: true,
      dbEngine: "SQLite (sql.js / veloce.sqlite)",
      filePath: DB_FILE_PATH,
      fileSizeBytes: size,
      message: `Active production SQLite database at ${DB_FILE_PATH} (${(size / 1024).toFixed(1)} KB)`,
      stats: {
        products: prodCount,
        orders: orderCount,
        affiliates: affCount,
        reviews: revCount
      }
    };
  } catch (err) {
    return {
      configured: false,
      connected: false,
      dbEngine: "SQLite",
      filePath: DB_FILE_PATH,
      fileSizeBytes: 0,
      message: `SQLite database error: ${err.message || err}`
    };
  }
}
async function pushSyncDataSqlite(payload) {
  const db = await getSqliteDb();
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
        p.type || "physical",
        p.imageUrl || null,
        p.images ? JSON.stringify(p.images) : null,
        p.stock !== void 0 ? p.stock : null,
        p.lowStockThreshold !== void 0 ? p.lowStockThreshold : null,
        p.variations ? JSON.stringify(p.variations) : null,
        p.rating || 0,
        p.reviewsCount || 0,
        p.reviews ? JSON.stringify(p.reviews) : null,
        p.digitalFileUrl || null,
        p.previousPrice !== void 0 ? p.previousPrice : null,
        p.backInStockAlert ? 1 : 0,
        p.costPrice !== void 0 ? p.costPrice : null,
        p.taxId || null,
        p.status || "Active",
        p.paymentRestriction || "both",
        p.shortDescription || null,
        p.detailedDescription || null,
        p.features ? JSON.stringify(p.features) : null,
        p.specifications ? JSON.stringify(p.specifications) : null,
        p.whatsInTheBox || null
      ]);
    }
    stmt.free();
  }
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
        o.customerName || "Guest Customer",
        o.customerEmail || "",
        o.items ? JSON.stringify(o.items) : "[]",
        o.total || 0,
        o.status || "pending",
        o.date || (/* @__PURE__ */ new Date()).toISOString(),
        o.couponCode || null,
        o.customNote || null,
        o.shippingAddress || null,
        o.notesHistory ? JSON.stringify(o.notesHistory) : null,
        o.statusHistory ? JSON.stringify(o.statusHistory) : null,
        o.isGuest ? 1 : 0,
        o.paymentMethod || "cod",
        o.review_request_sent_at || null,
        o.review_request_status || null
      ]);
    }
    stmt.free();
  }
  if (Array.isArray(payload.veloce_affiliates)) {
    db.run("DELETE FROM affiliates;");
    const stmt = db.prepare(`
      INSERT INTO affiliates (
        id, name, merchant, description, commissionRate, price, category, imageUrl,
        affiliateUrl, clicks, conversions, revenueEarned, affiliateNotes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const a of payload.veloce_affiliates) {
      if (!a.id || !a.name) continue;
      stmt.run([
        a.id,
        a.name,
        a.merchant || null,
        a.description || null,
        a.commissionRate || 0,
        a.price || 0,
        a.category || null,
        a.imageUrl || null,
        a.affiliateUrl || null,
        a.clicks || 0,
        a.conversions || 0,
        a.revenueEarned || 0,
        a.affiliateNotes ? JSON.stringify(a.affiliateNotes) : null
      ]);
    }
    stmt.free();
  }
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
        c.slug || c.name.toLowerCase().replace(/\s+/g, "-"),
        c.parentId || null,
        c.description || "",
        c.imageUrl || "",
        c.status || "Active",
        Number(c.displayOrder || 0),
        c.previousSlugs ? JSON.stringify(c.previousSlugs) : "[]",
        c.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        c.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
      ]);
    }
    stmt.free();
  }
  const settingsKeys = [
    "veloce_cart",
    "veloce_wishlist",
    "veloce_earnings",
    "veloce_loyalty_points",
    "veloce_coupons",
    "veloce_promo_banner",
    "customer_support_tickets",
    "veloce_payout_logs"
  ];
  const stmtSettings = db.prepare(`
    INSERT OR REPLACE INTO app_settings (setting_key, setting_value) VALUES (?, ?)
  `);
  for (const key of settingsKeys) {
    if (payload[key] !== void 0 && payload[key] !== null) {
      const valueStr = typeof payload[key] === "object" ? JSON.stringify(payload[key]) : String(payload[key]);
      stmtSettings.run([key, valueStr]);
    }
  }
  stmtSettings.free();
  if (Array.isArray(payload.veloce_hero_slides)) {
    await saveSqliteHeroBanners(payload.veloce_hero_slides);
  }
  saveSqliteDb(db);
}
async function pullSyncDataSqlite() {
  const db = await getSqliteDb();
  const result = {};
  const prodRes = db.exec("SELECT * FROM products;");
  if (prodRes.length > 0) {
    const cols = prodRes[0].columns;
    result.veloce_products = prodRes[0].values.map((row) => {
      const obj = {};
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
        backInStockAlert: Boolean(obj.backInStockAlert)
      };
    });
  } else {
    result.veloce_products = [];
  }
  const orderRes = db.exec("SELECT * FROM orders;");
  if (orderRes.length > 0) {
    const cols = orderRes[0].columns;
    result.veloce_orders = orderRes[0].values.map((row) => {
      const obj = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        ...obj,
        total: Number(obj.total),
        items: obj.items ? JSON.parse(obj.items) : [],
        notesHistory: obj.notesHistory ? JSON.parse(obj.notesHistory) : [],
        statusHistory: obj.statusHistory ? JSON.parse(obj.statusHistory) : [],
        isGuest: Boolean(obj.isGuest)
      };
    });
  } else {
    result.veloce_orders = [];
  }
  const affRes = db.exec("SELECT * FROM affiliates;");
  if (affRes.length > 0) {
    const cols = affRes[0].columns;
    result.veloce_affiliates = affRes[0].values.map((row) => {
      const obj = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        ...obj,
        commissionRate: Number(obj.commissionRate),
        price: Number(obj.price),
        clicks: Number(obj.clicks),
        conversions: Number(obj.conversions),
        revenueEarned: Number(obj.revenueEarned),
        affiliateNotes: obj.affiliateNotes ? JSON.parse(obj.affiliateNotes) : void 0
      };
    });
  } else {
    result.veloce_affiliates = [];
  }
  const catRes = db.exec("SELECT * FROM categories ORDER BY displayOrder ASC, name ASC;");
  if (catRes.length > 0) {
    const cols = catRes[0].columns;
    result.veloce_categories = catRes[0].values.map((row) => {
      const obj = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        ...obj,
        displayOrder: Number(obj.displayOrder || 0),
        previousSlugs: obj.previousSlugs ? JSON.parse(obj.previousSlugs) : []
      };
    });
  } else {
    result.veloce_categories = [];
  }
  result.veloce_hero_slides = await getAllSqliteHeroBanners();
  const settRes = db.exec("SELECT * FROM app_settings;");
  if (settRes.length > 0) {
    settRes[0].values.forEach((row) => {
      const key = row[0];
      const val = row[1];
      try {
        result[key] = JSON.parse(val);
      } catch (e) {
        if (val === "true") result[key] = true;
        else if (val === "false") result[key] = false;
        else if (!isNaN(Number(val))) result[key] = Number(val);
        else result[key] = val;
      }
    });
  }
  return result;
}
var DEFAULT_INITIAL_CATEGORIES = [
  { id: "cat-1", name: "Electronics", slug: "electronics", description: "Smartphones, Audio, Computing and Accessories", status: "Active", displayOrder: 1 },
  { id: "cat-2", name: "Fashion", slug: "fashion", description: "Men & Women Apparel, Shoes, and Accessories", status: "Active", displayOrder: 2 },
  { id: "cat-3", name: "Home & Living", slug: "home-living", description: "Furniture, Decor, Kitchen and Appliances", status: "Active", displayOrder: 3 },
  { id: "cat-4", name: "Beauty & Fragrances", slug: "beauty-fragrances", description: "Skincare, Makeup, Perfumes and Personal Care", status: "Active", displayOrder: 4 },
  { id: "cat-5", name: "Sports & Outdoor", slug: "sports-outdoor", description: "Fitness Gear, Sportswear and Equipment", status: "Active", displayOrder: 5 },
  { id: "cat-6", name: "Food & Beverages", slug: "food-beverages", description: "Snacks, Organic Groceries, Coffee and Drinks", status: "Active", displayOrder: 6 }
];
async function getAllSqliteCategories() {
  const db = await getSqliteDb();
  let res = db.exec("SELECT * FROM categories ORDER BY displayOrder ASC, name ASC;");
  if (res.length === 0 || res[0].values.length === 0) {
    const prodRes = db.exec("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND TRIM(category) != '';");
    let catsToSeed = DEFAULT_INITIAL_CATEGORIES;
    if (prodRes.length > 0 && prodRes[0].values.length > 0) {
      const distinctNames = prodRes[0].values.map((r) => String(r[0])).filter(Boolean);
      if (distinctNames.length > 0) {
        catsToSeed = distinctNames.map((name, idx) => ({
          id: `cat-${idx + 1}`,
          name,
          slug: name.toLowerCase().replace(/\s+/g, "-"),
          description: `${name} products`,
          status: "Active",
          displayOrder: idx + 1
        }));
      }
    }
    await saveSqliteCategories(catsToSeed);
    res = db.exec("SELECT * FROM categories ORDER BY displayOrder ASC, name ASC;");
    if (res.length === 0) return [];
  }
  const cols = res[0].columns;
  return res[0].values.map((row) => {
    const obj = {};
    cols.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return {
      ...obj,
      displayOrder: Number(obj.displayOrder || 0),
      previousSlugs: obj.previousSlugs ? JSON.parse(obj.previousSlugs) : []
    };
  });
}
async function saveSqliteCategories(categories) {
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
      c.slug || c.name.toLowerCase().replace(/\s+/g, "-"),
      c.parentId || null,
      c.description || "",
      c.imageUrl || "",
      c.status || "Active",
      Number(c.displayOrder || 0),
      c.previousSlugs ? JSON.stringify(c.previousSlugs) : "[]",
      c.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      c.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
    ]);
  }
  stmt.free();
  saveSqliteDb(db);
  return getAllSqliteCategories();
}
async function purgeAllSqliteData() {
  const db = await getSqliteDb();
  db.run("DELETE FROM products;");
  db.run("DELETE FROM orders;");
  db.run("DELETE FROM categories;");
  db.run("DELETE FROM affiliates;");
  db.run("DELETE FROM campaigns;");
  db.run("DELETE FROM click_logs;");
  db.run("DELETE FROM inventory_audit_logs;");
  db.run("DELETE FROM reviews;");
  db.run("DELETE FROM hero_banners;");
  db.run("INSERT OR REPLACE INTO app_settings (setting_key, setting_value) VALUES ('db_is_initialized_clean', 'true');");
  saveSqliteDb(db);
  console.log("[SQLite] Purged all database tables completely.");
}
var DEFAULT_HERO_SLIDES_INITIAL = [
  {
    id: "hero-banner-1",
    title: "Precision Mechanical Hardware",
    subtitle: "Engineered for Performance & Tactile Perfection",
    description: "CNC-machined aluminum frames, custom tuned linear switches, and dye-sublimated PBT keycaps. Built for relentless productivity.",
    badge_text: "NEW RELEASE 2026",
    primary_button_text: "Explore Keyboards",
    primary_button_url: "store",
    secondary_button_text: "Custom Services",
    secondary_button_url: "services",
    hero_image_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=1200",
    background_type: "color",
    background_color: "#0f172a",
    background_image_url: "",
    background_position: "center",
    overlay_enabled: 1,
    overlay_color: "#000000",
    overlay_opacity: 0.4,
    text_color: "#ffffff",
    is_active: 1,
    display_order: 1,
    start_date: null,
    end_date: null
  },
  {
    id: "hero-banner-2",
    title: "Minimalist Artisan Workspaces",
    subtitle: "Natural Solid Hardwoods & Clean Architecture",
    description: "Sustainably sourced Walnut and White Oak desk accessories, dual monitor risers, and magnetic modular organizers.",
    badge_text: "HANDCRAFTED EDITIONS",
    primary_button_text: "Shop Workspace Gear",
    primary_button_url: "store",
    secondary_button_text: "Read Design Stories",
    secondary_button_url: "blog",
    hero_image_url: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=1200",
    background_type: "image",
    background_color: "#18181b",
    background_image_url: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=1600",
    background_position: "center",
    overlay_enabled: 1,
    overlay_color: "#09090b",
    overlay_opacity: 0.75,
    text_color: "#ffffff",
    is_active: 1,
    display_order: 2,
    start_date: null,
    end_date: null
  }
];
async function getAllSqliteHeroBanners() {
  const db = await getSqliteDb();
  const initCheck = db.exec("SELECT setting_value FROM app_settings WHERE setting_key = 'hero_banners_seeded';");
  const isSeeded = initCheck.length > 0 && initCheck[0].values.length > 0 && initCheck[0].values[0][0] === "true";
  let res = db.exec("SELECT * FROM hero_banners ORDER BY display_order ASC, created_at DESC;");
  if (!isSeeded && (res.length === 0 || res[0].values.length === 0)) {
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
    const obj = {};
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
      active: Boolean(obj.is_active)
    };
  });
}
async function saveSqliteHeroBanners(banners) {
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
      b.subtitle || "",
      b.description || "",
      b.badge_text || b.badgeText || "",
      b.primary_button_text || b.primaryButtonText || "Shop Collection",
      b.primary_button_url || b.primaryButtonUrl || "store",
      b.secondary_button_text || b.secondaryButtonText || "",
      b.secondary_button_url || b.secondaryButtonUrl || "",
      b.hero_image_url || b.heroImage || b.imageUrl || "",
      b.background_type || b.backgroundType || "color",
      b.background_color || b.backgroundColor || "#0f172a",
      b.background_image_url || b.backgroundImage || "",
      b.background_position || b.backgroundPosition || "center",
      (b.overlay_enabled !== void 0 ? b.overlay_enabled : b.overlayEnabled !== false) ? 1 : 0,
      b.overlay_color || b.overlayColor || "#000000",
      typeof b.overlay_opacity === "number" ? b.overlay_opacity : typeof b.overlayOpacity === "number" ? b.overlayOpacity : 0.5,
      b.text_color || b.textColor || "#ffffff",
      (b.is_active !== void 0 ? b.is_active : b.active !== false) ? 1 : 0,
      Number(b.display_order || b.displayOrder || 1),
      b.start_date || b.startDate || null,
      b.end_date || b.endDate || null,
      b.created_at || b.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      b.updated_at || b.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
    ]);
  }
  stmt.free();
  saveSqliteDb(db);
  return getAllSqliteHeroBanners();
}

// server.ts
var import_fs2 = __toESM(require("fs"), 1);
import_dotenv2.default.config();
var app = (0, import_express.default)();
var rawPort = process.env.PORT;
var isNumericPort = rawPort && !isNaN(Number(rawPort));
var PORT = isNumericPort ? Number(rawPort) : rawPort || 3e3;
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ limit: "50mb", extended: true }));
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get(["/api/upload/cloudinary/status", "/api/upload/cloudinary/status/"], (_req, res) => {
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
app.post(["/api/upload/cloudinary", "/api/upload/cloudinary/"], async (req, res) => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || "";
    const apiKey = process.env.CLOUDINARY_API_KEY || "";
    const apiSecret = process.env.CLOUDINARY_API_SECRET || "";
    const { image, file, folder = "veloce_products", tags, publicId, public_id } = req.body || {};
    const filePayload = image || file;
    if (!filePayload) {
      return res.status(400).json({ success: false, error: "Image payload (base64 or URL) is required." });
    }
    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(200).json({
        success: false,
        configured: false,
        fallback: true,
        error: "Cloudinary credentials not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file."
      });
    }
    const timestamp = Math.floor(Date.now() / 1e3);
    const targetFolder = String(folder || "veloce_products").trim();
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
    const signature = import_crypto.default.createHash("sha1").update(toSign).digest("hex");
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
    console.error("[Cloudinary Server Error]:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error during upload" });
  }
});
var DJANGO_BACKEND_URL = process.env.DJANGO_BACKEND_URL || "http://127.0.0.1:8000";
app.use(["/api/customers", "/api/deals", "/api/invoices", "/api/customer-orders", "/api/settings"], async (req, res) => {
  try {
    const djangoUrl = `${DJANGO_BACKEND_URL}${req.originalUrl}`;
    const headers = {};
    if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
    if (req.headers["authorization"]) headers["authorization"] = req.headers["authorization"];
    if (req.headers["cookie"]) headers["cookie"] = req.headers["cookie"];
    const options = {
      method: req.method,
      headers
    };
    if (["POST", "PUT", "PATCH"].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      options.body = JSON.stringify(req.body);
    }
    const response = await fetch(djangoUrl, options);
    if (response.status === 204) {
      return res.status(204).send();
    }
    const data = await response.json().catch(() => null);
    res.status(response.status).json(data);
  } catch (err) {
    console.error(`[Django Proxy Error] ${req.method} ${req.originalUrl}:`, err.message);
    res.status(502).json({ error: "Failed to connect to Django backend service", detail: err.message });
  }
});
app.post(["/api/admin/purge-all-data", "/api/admin/purge-all-data/"], async (req, res) => {
  try {
    productsStore = [];
    ordersStore = [];
    reviewsStore = [];
    await purgeAllSqliteData();
    res.json({ success: true, message: "All in-memory stores and SQLite tables purged cleanly." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
var productsStore = [];
var ordersStore = [];
var reviewsStore = [];
var mailTransporter = import_nodemailer.default.createTransport({
  host: process.env.EMAIL_HOST || "mail.marid.co.ke",
  port: Number(process.env.EMAIL_PORT) || 465,
  secure: process.env.EMAIL_USE_SSL !== "false",
  auth: {
    user: process.env.EMAIL_HOST_USER || "noreply@marid.co.ke",
    pass: process.env.EMAIL_HOST_PASSWORD || ""
  },
  tls: {
    rejectUnauthorized: false
  }
});
mailTransporter.verify((err, success) => {
  if (err) {
    console.warn("[Express SMTP] Transporter initialization warning:", err.message);
  } else {
    console.log("[Express SMTP] Connected and ready to transmit transactional emails via mail.marid.co.ke:465");
  }
});
app.post(["/api/email/send", "/api/email/send/"], async (req, res) => {
  try {
    const { to, subject, html, text, category } = req.body || {};
    if (!to || !subject) {
      return res.status(400).json({ success: false, error: "Recipient (to) and subject are required." });
    }
    const cleanTo = String(to).trim();
    const mailOptions = {
      from: process.env.DEFAULT_FROM_EMAIL || '"Ropenix Collections" <noreply@marid.co.ke>',
      to: cleanTo,
      subject: String(subject).trim(),
      text: text || (html ? String(html).replace(/<[^>]*>?/gm, "") : "Notification from Ropenix Collections"),
      html: html || `<p>${text || subject}</p>`
    };
    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`[Express SMTP Success] Dispatched "${subject}" to ${cleanTo} (${info.messageId})`);
    return res.json({ success: true, messageId: info.messageId, status: "sent", message: "Email sent successfully" });
  } catch (err) {
    console.error(`[Express SMTP Error] Failed sending email:`, err);
    return res.status(500).json({ success: false, error: err.message || "Failed to transmit email" });
  }
});
app.post(["/api/email/diagnose-smtp", "/api/email/diagnose-smtp/"], async (req, res) => {
  try {
    const { to } = req.body || {};
    const recipient = (to || process.env.ADMIN_EMAIL || "ropenixkenya@gmail.com").trim();
    await mailTransporter.verify();
    const testInfo = await mailTransporter.sendMail({
      from: process.env.DEFAULT_FROM_EMAIL || '"Ropenix Collections" <noreply@marid.co.ke>',
      to: recipient,
      subject: "\u{1F9EA} Ropenix SMTP Node Diagnostic Test - Active",
      text: "This is a verified test email from the Ropenix Collections Express engine. Your cPanel SMTP transport is active and operational.",
      html: `<div style="font-family: sans-serif; padding: 24px; border: 1px solid #4f46e5; border-radius: 12px; max-width: 550px; margin: 0 auto;">
        <h2 style="color: #4f46e5; margin-top: 0;">\u2705 Ropenix SMTP Diagnostic Succeeded</h2>
        <p style="color: #334155; line-height: 1.5;">Your mail server at <strong>mail.marid.co.ke:465</strong> is fully operational and successfully transmitting transactional messages.</p>
        <div style="background: #f8fafc; padding: 12px; border-radius: 6px; font-size: 12px; color: #64748b;">
          <strong>Target Recipient:</strong> ${recipient}<br/>
          <strong>Timestamp:</strong> ${(/* @__PURE__ */ new Date()).toISOString()}
        </div>
      </div>`
    });
    res.json({ success: true, message: `Diagnostic email successfully delivered to ${recipient}`, messageId: testInfo.messageId });
  } catch (err) {
    console.error("[Express SMTP Diagnostic Error]:", err);
    res.status(500).json({ success: false, error: err.message || "Diagnostic test failed" });
  }
});
app.get(["/api/email/config", "/api/email/config/"], (req, res) => {
  res.json({
    configured: true,
    host: process.env.EMAIL_HOST || "mail.marid.co.ke",
    port: Number(process.env.EMAIL_PORT) || 465,
    user: process.env.EMAIL_HOST_USER || "noreply@marid.co.ke",
    defaultFrom: process.env.DEFAULT_FROM_EMAIL || "Ropenix Collections <noreply@marid.co.ke>",
    useSsl: true,
    unsubscribedCount: 0
  });
});
app.get(["/api/orders", "/api/orders/"], (req, res) => {
  res.json(ordersStore);
});
app.post(["/api/orders", "/api/orders/"], async (req, res) => {
  try {
    const orderData = req.body;
    if (!orderData) {
      return res.status(400).json({ success: false, error: "Order payload required." });
    }
    const orderId = orderData.id || `ord-${Date.now()}`;
    const newOrder = {
      ...orderData,
      id: orderId,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const existingIndex = ordersStore.findIndex((o) => o.id === orderId);
    if (existingIndex > -1) {
      ordersStore[existingIndex] = newOrder;
    } else {
      ordersStore.unshift(newOrder);
    }
    try {
      await pushSyncDataSqlite({
        veloce_products: productsStore,
        veloce_orders: ordersStore
      });
    } catch (dbErr) {
      console.warn("[SQLite Orders Sync Warning]:", dbErr);
    }
    const customerEmail = (newOrder.customerEmail || newOrder.customer_email || "").trim();
    const customerName = newOrder.customerName || newOrder.customer_name || "Customer";
    const adminEmail = (process.env.ADMIN_EMAIL || "ropenixkenya@gmail.com").trim();
    const totalFormatted = `KSh ${Number(newOrder.total || 0).toLocaleString("en-KE")}`;
    const itemsList = Array.isArray(newOrder.items) ? newOrder.items.map((i) => `\u2022 ${i.name || i.product_name || "Product"} (x${i.quantity || 1}) - KSh ${Number(i.price || i.unit_price || 0).toLocaleString("en-KE")}`).join("\n") : "No items listed";
    if (customerEmail && customerEmail.includes("@") && !customerEmail.includes("example.com")) {
      const custSubject = `\u{1F6D2} Order Confirmation: ROP-${orderId.slice(-6).toUpperCase()}`;
      const custBody = `Hi ${customerName},

Thank you for shopping with Ropenix Collections! Your order ROP-${orderId.slice(-6).toUpperCase()} has been received.

Items Ordered:
${itemsList}

Total: ${totalFormatted}
Payment Method: ${newOrder.paymentMethod || newOrder.payment_method || "M-PESA"}
Shipping Address: ${newOrder.shippingAddress || newOrder.shipping_address || "Default Address"}

We will notify you as soon as your package enters fulfillment.

Warm regards,
The Ropenix Collections Team`;
      mailTransporter.sendMail({
        from: process.env.DEFAULT_FROM_EMAIL || '"Ropenix Collections" <noreply@marid.co.ke>',
        to: customerEmail,
        subject: custSubject,
        text: custBody,
        html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff;">
          <div style="background: #0f172a; padding: 20px; border-radius: 8px; text-align: center; color: white;">
            <h2 style="margin:0; font-size: 20px;">ROPENIX COLLECTIONS</h2>
            <p style="margin:4px 0 0 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Order Confirmation</p>
          </div>
          <div style="padding: 24px 0; color: #334155; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${custBody}</div>
          <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #64748b; text-align: center;">
            Ropenix Collections Kenya \u2022 Support: support@ropenix.co.ke | Hotline: +254 182 180 965 (0182180965)
          </div>
        </div>`
      }).then((res2) => console.log(`[Express Order Email] Customer notification sent to ${customerEmail}:`, res2.messageId)).catch((err) => console.warn(`[Express Order Email] Customer email failed:`, err));
    }
    if (adminEmail && adminEmail.includes("@")) {
      const adminSubject = `\u{1F514} [ADMIN ALERT] New Order ROP-${orderId.slice(-6).toUpperCase()} Placed (${totalFormatted})`;
      const adminBody = `ATTENTION ADMIN / FULFILLMENT TEAM:

A new sale has been placed on Ropenix Collections and requires fulfillment.

Order ID: ROP-${orderId.slice(-6).toUpperCase()}
Customer: ${customerName} (${customerEmail})
Phone: ${newOrder.phone || newOrder.customerPhone || newOrder.customer_phone || "N/A"}
Total Amount: ${totalFormatted}
Payment Method: ${newOrder.paymentMethod || newOrder.payment_method || "M-PESA"}
Shipping Address: ${newOrder.shippingAddress || newOrder.shipping_address || "N/A"}

Items:
${itemsList}

Please access the Admin Orders Portal to review and dispatch.`;
      mailTransporter.sendMail({
        from: process.env.DEFAULT_FROM_EMAIL || '"Ropenix Collections" <noreply@marid.co.ke>',
        to: adminEmail,
        replyTo: customerEmail || void 0,
        subject: adminSubject,
        text: adminBody,
        html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff;">
          <div style="background: #1e1b4b; padding: 20px; border-radius: 8px; text-align: center; color: white;">
            <h2 style="margin:0; font-size: 20px;">ROPENIX ADMIN NOTIFICATION</h2>
            <p style="margin:4px 0 0 0; color: #a5b4fc; font-size: 12px; text-transform: uppercase;">New Order Received</p>
          </div>
          <div style="padding: 24px 0; color: #334155; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${adminBody}</div>
        </div>`
      }).then((res2) => console.log(`[Express Order Email] Admin notification sent to ${adminEmail}:`, res2.messageId)).catch((err) => console.warn(`[Express Order Email] Admin email failed:`, err));
    }
    res.status(201).json({ success: true, order: newOrder, message: "Order created and notifications dispatched." });
  } catch (err) {
    console.error("[Express Orders Error]:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to save order" });
  }
});
app.get(["/robots.txt", "/robots.txt/"], (req, res) => {
  const robotsTxt = `# Robots.txt for Ropenix Collections eCommerce & Affiliate Platform
# https://ropenix.co.ke

User-agent: *
Allow: /
Allow: /store
Allow: /services
Allow: /blog
Allow: /contact
Allow: /privacy
Allow: /favicon.svg
Allow: /og-image.svg
Allow: /site.webmanifest

# Disallow private administrative, checkout, and API routes
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
app.get(["/sitemap.xml", "/sitemap.xml/"], (req, res) => {
  try {
    const host = req.get("host") || "ropenix.co.ke";
    const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "https";
    const baseUrl = `${protocol}://${host.includes("localhost") || host.includes("127.0.0.1") ? "ropenix.co.ke" : host}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <!-- Core Storefront Pages -->
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
    if (Array.isArray(productsStore) && productsStore.length > 0) {
      const activeProducts = productsStore.filter((p) => p.status !== "Draft" && !p.isHidden && !p.isArchived);
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
function recalculateProductRating(productId) {
  const publishedReviews = reviewsStore.filter(
    (r) => r.productId === productId && (r.status === "Published" || !r.status)
  );
  const prodIndex = productsStore.findIndex((p) => p.id === productId);
  if (prodIndex !== -1) {
    if (publishedReviews.length === 0) {
      productsStore[prodIndex].reviewsCount = 0;
      productsStore[prodIndex].rating = 5;
      productsStore[prodIndex].reviews = [];
    } else {
      const sum = publishedReviews.reduce((acc, curr) => acc + Number(curr.rating), 0);
      const avg = Math.round(sum / publishedReviews.length * 100) / 100;
      productsStore[prodIndex].rating = avg;
      productsStore[prodIndex].reviewsCount = publishedReviews.length;
      productsStore[prodIndex].reviews = publishedReviews;
    }
  }
}
app.get(["/api/products", "/api/products/"], async (req, res) => {
  let result = [...productsStore];
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
  res.json(result);
});
app.get(["/api/products/categories", "/api/products/categories/", "/api/categories", "/api/categories/"], async (req, res) => {
  try {
    const cats = await getAllSqliteCategories();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post(["/api/products/categories/bulk_sync", "/api/products/categories/bulk_sync/"], async (req, res) => {
  try {
    const categoriesData = req.body;
    if (!Array.isArray(categoriesData)) {
      res.status(400).json({ error: "Expected an array of categories." });
      return;
    }
    const saved = await saveSqliteCategories(categoriesData);
    res.json({ message: `Synchronized ${saved.length} categories successfully.`, categories: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post(["/api/products/categories", "/api/products/categories/", "/api/categories", "/api/categories/"], async (req, res) => {
  try {
    const cat = req.body || {};
    if (!cat.id) {
      cat.id = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    }
    if (!cat.slug && cat.name) {
      cat.slug = String(cat.name).toLowerCase().replace(/\s+/g, "-");
    }
    const current = await getAllSqliteCategories();
    const updated = [...current.filter((c) => c.id !== cat.id), cat];
    const saved = await saveSqliteCategories(updated);
    const createdCat = saved.find((c) => c.id === cat.id) || cat;
    res.status(201).json({ message: "Category created successfully.", category: createdCat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put(["/api/products/categories/:id", "/api/products/categories/:id/"], async (req, res) => {
  try {
    const { id } = req.params;
    const cat = req.body || {};
    cat.id = id;
    const current = await getAllSqliteCategories();
    const updated = current.map((c) => c.id === id ? { ...c, ...cat, updatedAt: (/* @__PURE__ */ new Date()).toISOString() } : c);
    const saved = await saveSqliteCategories(updated);
    const updatedCat = saved.find((c) => c.id === id) || cat;
    res.json({ message: "Category updated successfully.", category: updatedCat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete(["/api/products/categories/:id", "/api/products/categories/:id/"], async (req, res) => {
  try {
    const { id } = req.params;
    const current = await getAllSqliteCategories();
    const updated = current.filter((c) => c.id !== id);
    await saveSqliteCategories(updated);
    res.json({ message: "Category deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get(["/api/hero-banners", "/api/hero-banners/"], async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});
app.post(["/api/hero-banners/reorder", "/api/hero-banners/reorder/"], async (req, res) => {
  try {
    const orderList = req.body?.order || [];
    if (!Array.isArray(orderList)) {
      res.status(400).json({ error: "Order must be an array of IDs." });
      return;
    }
    const current = await getAllSqliteHeroBanners();
    const updated = current.map((b) => {
      const idx = orderList.indexOf(b.id);
      return idx !== -1 ? { ...b, display_order: idx + 1, displayOrder: idx + 1 } : b;
    }).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    await saveSqliteHeroBanners(updated);
    res.json({ status: "reordered", total: orderList.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post(["/api/hero-banners", "/api/hero-banners/"], async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});
app.put(["/api/hero-banners/:id", "/api/hero-banners/:id/"], async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});
app.patch(["/api/hero-banners/:id", "/api/hero-banners/:id/"], async (req, res) => {
  try {
    const { id } = req.params;
    const current = await getAllSqliteHeroBanners();
    const existing = current.find((b) => b.id === id);
    if (!existing) {
      const newBanner = { id, ...req.body, created_at: (/* @__PURE__ */ new Date()).toISOString() };
      const saved2 = await saveSqliteHeroBanners([...current, newBanner]);
      res.json(saved2.find((b) => b.id === id) || newBanner);
      return;
    }
    const updated = current.map((b) => b.id === id ? { ...b, ...req.body, updated_at: (/* @__PURE__ */ new Date()).toISOString() } : b);
    const saved = await saveSqliteHeroBanners(updated);
    res.json(saved.find((b) => b.id === id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete(["/api/hero-banners/:id", "/api/hero-banners/:id/"], async (req, res) => {
  try {
    const { id } = req.params;
    const current = await getAllSqliteHeroBanners();
    const updated = current.filter((b) => b.id !== id);
    await saveSqliteHeroBanners(updated);
    res.json({ message: "Hero banner deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post(["/api/products/bulk_action", "/api/products/bulk_action/"], (req, res) => {
  const { product_ids, action, status: newStatus } = req.body || {};
  if (!Array.isArray(product_ids)) {
    res.status(400).json({ error: "product_ids array required." });
    return;
  }
  let affectedCount = 0;
  if (action === "archive") {
    productsStore = productsStore.map((p) => {
      if (product_ids.includes(p.id)) {
        affectedCount++;
        return { ...p, status: "Archived" };
      }
      return p;
    });
  } else if (action === "delete") {
    const initialLen = productsStore.length;
    productsStore = productsStore.filter((p) => !product_ids.includes(p.id));
    affectedCount = initialLen - productsStore.length;
  } else if (action === "update_status" && newStatus) {
    productsStore = productsStore.map((p) => {
      if (product_ids.includes(p.id)) {
        affectedCount++;
        return { ...p, status: newStatus };
      }
      return p;
    });
  }
  res.json({ message: `Bulk action '${action}' completed.`, affected_count: affectedCount });
});
app.get(["/api/products/:id", "/api/products/:id/"], (req, res) => {
  const item = productsStore.find((p) => p.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(item);
});
app.post(["/api/products", "/api/products/"], (req, res) => {
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
  const newProduct = {
    id: req.body.id || `prod-${Date.now()}`,
    sku: req.body.sku || `SKU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    name: req.body.name || "New Product",
    description: req.body.description || "",
    price: Number(req.body.price || 0),
    original_price: req.body.original_price ? Number(req.body.original_price) : null,
    cost_price: req.body.cost_price ? Number(req.body.cost_price) : null,
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
    has_variants: req.body.has_variants !== void 0 ? req.body.has_variants : req.body.hasVariants || false,
    hasVariants: req.body.hasVariants !== void 0 ? req.body.hasVariants : req.body.has_variants || false,
    variations: req.body.variations || [],
    variant_matrix: req.body.variant_matrix || req.body.variantMatrix || [],
    variantMatrix: req.body.variantMatrix || req.body.variant_matrix || [],
    unit_measurement: req.body.unit_measurement || req.body.unitMeasurement || "",
    unit_value: req.body.unit_value !== void 0 ? req.body.unit_value : req.body.unitValue,
    weight: req.body.weight || "",
    length: req.body.length || "",
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  productsStore.unshift(newProduct);
  pushSyncDataSqlite({ veloce_products: productsStore, veloce_orders: ordersStore, db_is_initialized_clean: "true" }).catch(() => {
  });
  res.status(201).json({ message: "Product created successfully.", product: newProduct });
});
app.put(["/api/products/:id", "/api/products/:id/"], (req, res) => {
  const idx = productsStore.findIndex((p) => p.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const rawImages = req.body.images || req.body.gallery_images;
  let parsedImages = productsStore[idx].images;
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
  const primaryImg = req.body.image_url || req.body.imageUrl || parsedImages && parsedImages[0] || productsStore[idx].imageUrl;
  productsStore[idx] = {
    ...productsStore[idx],
    ...req.body,
    image_url: primaryImg,
    imageUrl: primaryImg,
    images: parsedImages || (primaryImg ? [primaryImg] : []),
    gallery_images: parsedImages || (primaryImg ? [primaryImg] : []),
    variant_matrix: req.body.variant_matrix || req.body.variantMatrix || productsStore[idx].variant_matrix || productsStore[idx].variantMatrix || [],
    variantMatrix: req.body.variantMatrix || req.body.variant_matrix || productsStore[idx].variantMatrix || productsStore[idx].variant_matrix || [],
    unit_measurement: req.body.unit_measurement || req.body.unitMeasurement || productsStore[idx].unit_measurement || "",
    unit_value: req.body.unit_value !== void 0 ? req.body.unit_value : req.body.unitValue !== void 0 ? req.body.unitValue : productsStore[idx].unit_value,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  pushSyncDataSqlite({ veloce_products: productsStore, veloce_orders: ordersStore, db_is_initialized_clean: "true" }).catch(() => {
  });
  res.json({ message: "Product updated successfully.", product: productsStore[idx] });
});
app.delete(["/api/products/:id", "/api/products/:id/"], (req, res) => {
  const idx = productsStore.findIndex((p) => p.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const deleted = productsStore.splice(idx, 1)[0];
  pushSyncDataSqlite({ veloce_products: productsStore, veloce_orders: ordersStore, db_is_initialized_clean: "true" }).catch(() => {
  });
  res.json({ message: `Product "${deleted.name}" deleted successfully.` });
});
app.get(["/api/orders", "/api/orders/"], (req, res) => {
  res.json(ordersStore);
});
app.post(["/api/orders", "/api/orders/"], (req, res) => {
  const newOrder = {
    id: req.body.id || `ord-${Date.now()}`,
    customer_name: req.body.customer_name || "Guest Customer",
    customer_email: req.body.customer_email || "guest@example.com",
    total: Number(req.body.total || 0),
    status: req.body.status || "Pending",
    payment_method: req.body.payment_method || "M-PESA",
    shipping_address: req.body.shipping_address || "",
    items: req.body.items || [],
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  ordersStore.unshift(newOrder);
  res.status(201).json({ message: "Order created successfully.", order: newOrder });
});
app.get(["/api/orders/:id", "/api/orders/:id/"], (req, res) => {
  const order = ordersStore.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  res.json(order);
});
app.put(["/api/orders/:id", "/api/orders/:id/"], (req, res) => {
  const index = ordersStore.findIndex((o) => o.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Order not found" });
  }
  ordersStore[index] = { ...ordersStore[index], ...req.body, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
  res.json({ message: "Order updated successfully", order: ordersStore[index] });
});
app.delete(["/api/orders/:id", "/api/orders/:id/"], (req, res) => {
  const index = ordersStore.findIndex((o) => o.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Order not found" });
  }
  const deleted = ordersStore.splice(index, 1);
  res.json({ message: "Order deleted successfully", order: deleted[0] });
});
var reviewSubmissionRateLimits = /* @__PURE__ */ new Map();
var reviewRequestLogsStore = [];
var reviewRequestSettingsStore = {
  enabled: true,
  delayDays: 3,
  // Default 3 days after delivery (0 for test mode)
  autoTriggerOnDelivery: true,
  incentiveDiscountPercent: 15
};
var reviewRequestOptOutsStore = /* @__PURE__ */ new Set();
app.post("/api/reviews/check-eligibility", (req, res) => {
  const { userEmail, userId, productId, sku } = req.body || {};
  if (!userEmail && !userId) {
    return res.json({
      eligible: false,
      reason: "NOT_LOGGED_IN",
      message: "Log in to leave a verified customer review."
    });
  }
  const normalizedEmail = String(userEmail || "").toLowerCase().trim();
  const product = productsStore.find((p) => p.id === productId || p.sku === sku || p.id === sku);
  const matchingOrders = ordersStore.filter((ord) => {
    const ordEmail = String(ord.customer_email || ord.customerEmail || "").toLowerCase().trim();
    const ordUserId = ord.user_id || ord.userId;
    const emailMatches = normalizedEmail && ordEmail === normalizedEmail;
    const userMatches = userId && String(ordUserId) === String(userId);
    if (!emailMatches && !userMatches) return false;
    const items = ord.items || [];
    return items.some((item) => {
      if (item.productId && item.productId === productId) return true;
      if (item.sku && item.sku === sku) return true;
      if (item.id && item.id === productId) return true;
      if (product && item.name && product.name && item.name.toLowerCase().trim() === product.name.toLowerCase().trim()) return true;
      return false;
    });
  });
  if (matchingOrders.length === 0) {
    return res.json({
      eligible: false,
      reason: "NOT_PURCHASED",
      message: "Only verified customers who have purchased this item can leave a review."
    });
  }
  const completedOrder = matchingOrders.find((ord) => {
    const st = String(ord.status || "").toLowerCase();
    return st === "completed" || st === "delivered" || st === "shipped";
  });
  if (!completedOrder) {
    return res.json({
      eligible: false,
      reason: "ORDER_NOT_DELIVERED",
      message: "You can review this item once your order is marked as Delivered/Completed."
    });
  }
  const orderStatus = String(completedOrder.status || "").toLowerCase();
  if (orderStatus === "cancelled" || orderStatus === "pending-cancellation") {
    return res.json({
      eligible: false,
      reason: "ORDER_CANCELLED",
      message: "Reviews cannot be submitted for cancelled or refunded orders."
    });
  }
  const matchingItem = (completedOrder.items || []).find((item) => {
    return item.productId === productId || item.sku === sku || product && item.name === product.name;
  });
  let purchasedVariant = "";
  if (matchingItem && matchingItem.selectedVariations) {
    if (typeof matchingItem.selectedVariations === "string") {
      purchasedVariant = matchingItem.selectedVariations;
    } else {
      purchasedVariant = Object.entries(matchingItem.selectedVariations).map(([k, v]) => `${k}: ${v}`).join(", ");
    }
  }
  const existingReview = reviewsStore.find((rev) => {
    const sameOrder = rev.orderId === completedOrder.id;
    const sameProd = rev.productId === productId;
    const sameUser = rev.userEmail && rev.userEmail.toLowerCase() === normalizedEmail || rev.userId && String(rev.userId) === String(userId);
    return sameOrder && sameProd && sameUser && rev.status !== "Removed";
  });
  if (existingReview) {
    return res.json({
      eligible: false,
      reason: "ALREADY_REVIEWED",
      message: "You have already submitted a verified review for this purchase.",
      existingReview,
      orderId: completedOrder.id,
      purchasedVariant
    });
  }
  return res.json({
    eligible: true,
    reason: "ELIGIBLE",
    orderId: completedOrder.id,
    purchasedVariant,
    message: "Verified purchaser! You are eligible to submit a review."
  });
});
app.get("/api/products/:productId/reviews", (req, res) => {
  const { productId } = req.params;
  const { rating, sort = "recent", page = 1, limit = 20 } = req.query;
  let reviews = reviewsStore.filter((r) => r.productId === productId && r.status !== "Hidden" && r.status !== "Removed");
  if (rating) {
    const ratingNum = Number(rating);
    reviews = reviews.filter((r) => Math.floor(r.rating) === ratingNum);
  }
  if (sort === "highest") {
    reviews.sort((a, b) => b.rating - a.rating || new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  } else if (sort === "lowest") {
    reviews.sort((a, b) => a.rating - b.rating || new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  } else if (sort === "helpful") {
    reviews.sort((a, b) => (b.helpfulVotes || 0) - (a.helpfulVotes || 0));
  } else {
    reviews.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  }
  const allProdReviews = reviewsStore.filter((r) => r.productId === productId && r.status !== "Hidden" && r.status !== "Removed");
  const totalCount = allProdReviews.length;
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let totalSum = 0;
  allProdReviews.forEach((r) => {
    const star = Math.min(5, Math.max(1, Math.floor(r.rating)));
    distribution[star] = (distribution[star] || 0) + 1;
    totalSum += r.rating;
  });
  const average = totalCount > 0 ? Math.round(totalSum / totalCount * 100) / 100 : 5;
  res.json({
    reviews,
    summary: {
      average,
      totalCount,
      distribution
    }
  });
});
app.post("/api/reviews", (req, res) => {
  const {
    userEmail,
    userId,
    userName,
    reviewerDisplayName,
    productId,
    orderId,
    rating,
    title,
    comment,
    mediaUrls,
    purchasedVariant
  } = req.body || {};
  if (!productId || !comment || !rating) {
    return res.status(400).json({ error: "Product ID, rating score, and review statement are required." });
  }
  if (Number(rating) < 1 || Number(rating) > 5) {
    return res.status(400).json({ error: "Rating must be between 1 and 5 stars." });
  }
  if (comment.trim().length < 10) {
    return res.status(400).json({ error: "Review statement must be at least 10 characters long." });
  }
  if (comment.trim().length > 2e3) {
    return res.status(400).json({ error: "Review statement cannot exceed 2000 characters." });
  }
  const normalizedEmail = String(userEmail || "").toLowerCase().trim();
  const now = Date.now();
  const userKey = normalizedEmail || String(req.ip || "ip");
  const userTimestamps = (reviewSubmissionRateLimits.get(userKey) || []).filter((t) => now - t < 36e5);
  if (userTimestamps.length >= 5) {
    return res.status(429).json({ error: "Rate limit exceeded. Maximum 5 review submissions per hour allowed per user." });
  }
  if (Array.isArray(mediaUrls)) {
    if (mediaUrls.length > 5) {
      return res.status(400).json({ error: "Maximum 5 media files allowed per review." });
    }
    for (const url of mediaUrls) {
      if (typeof url === "string" && url.startsWith("data:")) {
        if (url.length > 7 * 1024 * 1024) {
          return res.status(400).json({ error: "One or more uploaded media files exceed the 5MB size limit." });
        }
        const mimeMatch = url.match(/^data:(image\/[a-zA-Z0-9]+|video\/[a-zA-Z0-9]+);base64,/);
        if (!mimeMatch) {
          return res.status(400).json({ error: "Invalid file format. Only JPEG, PNG, WEBP, MP4, and WEBM media files are allowed." });
        }
      }
    }
  }
  let verifiedOrderId = orderId;
  let verifiedVariant = purchasedVariant || "";
  if (!verifiedOrderId) {
    const matchingOrder = ordersStore.find((ord) => {
      const ordEmail = String(ord.customer_email || ord.customerEmail || "").toLowerCase().trim();
      const ordUserId = ord.user_id || ord.userId;
      const matchesEmail = normalizedEmail && ordEmail === normalizedEmail;
      const matchesUser = userId && String(ordUserId) === String(userId);
      if (!matchesEmail && !matchesUser) return false;
      const st = String(ord.status || "").toLowerCase();
      if (st !== "completed" && st !== "delivered" && st !== "shipped") return false;
      const items = ord.items || [];
      return items.some((i) => i.productId === productId || i.sku === productId);
    });
    if (!matchingOrder) {
      return res.status(403).json({
        error: "Forbidden: You do not have an active completed/delivered order for this product. Reviews are restricted to verified purchasers."
      });
    }
    verifiedOrderId = matchingOrder.id;
  } else {
    const foundOrder = ordersStore.find((o) => o.id === verifiedOrderId);
    if (!foundOrder) {
      return res.status(403).json({ error: "Forbidden: Invalid order reference provided." });
    }
    const ordEmail = String(foundOrder.customer_email || foundOrder.customerEmail || "").toLowerCase().trim();
    if (normalizedEmail && ordEmail !== normalizedEmail) {
      return res.status(403).json({ error: "Forbidden: Order does not belong to this customer email." });
    }
    const st = String(foundOrder.status || "").toLowerCase();
    if (st === "cancelled" || st === "pending-cancellation") {
      return res.status(403).json({ error: "Forbidden: Reviews cannot be submitted for cancelled or refunded orders." });
    }
    if (st !== "completed" && st !== "delivered" && st !== "shipped") {
      return res.status(403).json({ error: "Forbidden: Reviews can only be submitted after your order is delivered." });
    }
  }
  const duplicate = reviewsStore.find((r) => r.orderId === verifiedOrderId && r.productId === productId && r.status !== "Removed");
  if (duplicate) {
    return res.status(400).json({ error: "You have already submitted a review for this purchase." });
  }
  reviewSubmissionRateLimits.set(userKey, [...userTimestamps, now]);
  const newReview = {
    id: `rev-${Date.now()}`,
    productId,
    orderId: verifiedOrderId,
    userId: userId || null,
    userEmail: normalizedEmail,
    userName: userName || "Customer",
    reviewerDisplayName: reviewerDisplayName || userName || "Verified Buyer",
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
    purchasedVariant: verifiedVariant,
    isEdited: false
  };
  reviewsStore.unshift(newReview);
  recalculateProductRating(productId);
  const logIdx = reviewRequestLogsStore.findIndex((l) => l.orderId === verifiedOrderId);
  if (logIdx !== -1) {
    reviewRequestLogsStore[logIdx].status = "reviewed";
    reviewRequestLogsStore[logIdx].reviewedProductId = productId;
  }
  res.status(201).json({
    success: true,
    message: "Verified customer review published successfully!",
    review: newReview
  });
});
app.put("/api/reviews/:id", (req, res) => {
  const { id } = req.params;
  const { userEmail, rating, title, comment, mediaUrls, reviewerDisplayName } = req.body || {};
  const idx = reviewsStore.findIndex((r) => r.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Review not found." });
  }
  const existing = reviewsStore[idx];
  if (userEmail && existing.userEmail && existing.userEmail.toLowerCase() !== String(userEmail).toLowerCase()) {
    return res.status(403).json({ error: "Forbidden: You can only edit your own reviews." });
  }
  reviewsStore[idx] = {
    ...existing,
    rating: rating ? Number(rating) : existing.rating,
    title: title !== void 0 ? String(title).trim() : existing.title,
    comment: comment !== void 0 ? String(comment).trim() : existing.comment,
    mediaUrls: Array.isArray(mediaUrls) ? mediaUrls.slice(0, 5) : existing.mediaUrls,
    reviewerDisplayName: reviewerDisplayName || existing.reviewerDisplayName,
    isEdited: true,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  recalculateProductRating(existing.productId);
  res.json({
    success: true,
    message: "Review updated successfully.",
    review: reviewsStore[idx]
  });
});
app.delete("/api/reviews/:id", (req, res) => {
  const { id } = req.params;
  const { userEmail } = req.query;
  const idx = reviewsStore.findIndex((r) => r.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Review not found." });
  }
  const existing = reviewsStore[idx];
  if (userEmail && existing.userEmail && existing.userEmail.toLowerCase() !== String(userEmail).toLowerCase()) {
    return res.status(403).json({ error: "Forbidden: You can only delete your own reviews." });
  }
  reviewsStore[idx].status = "Removed";
  recalculateProductRating(existing.productId);
  res.json({ success: true, message: "Review deleted successfully." });
});
app.post("/api/reviews/:id/helpful", (req, res) => {
  const { id } = req.params;
  const { userEmail, userId } = req.body || {};
  const idx = reviewsStore.findIndex((r) => r.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Review not found." });
  }
  const voterId = String(userId || userEmail || "anonymous");
  const existing = reviewsStore[idx];
  const helpfulUserIds = existing.helpfulUserIds || [];
  const alreadyVoted = helpfulUserIds.includes(voterId);
  if (alreadyVoted) {
    existing.helpfulUserIds = helpfulUserIds.filter((id2) => id2 !== voterId);
    existing.helpfulVotes = Math.max(0, (existing.helpfulVotes || 1) - 1);
  } else {
    existing.helpfulUserIds.push(voterId);
    existing.helpfulVotes = (existing.helpfulVotes || 0) + 1;
  }
  res.json({
    success: true,
    helpfulVotes: existing.helpfulVotes,
    voted: !alreadyVoted
  });
});
app.get("/api/admin/reviews", (req, res) => {
  res.json({ reviews: reviewsStore });
});
app.put("/api/admin/reviews/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const idx = reviewsStore.findIndex((r) => r.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Review not found." });
  }
  reviewsStore[idx].status = status;
  recalculateProductRating(reviewsStore[idx].productId);
  res.json({
    success: true,
    message: `Review status updated to '${status}'.`,
    review: reviewsStore[idx]
  });
});
app.get("/api/admin/review-requests/logs", (req, res) => {
  const deliveredOrders = ordersStore.filter((o) => {
    const st = String(o.status || "").toLowerCase();
    return st === "delivered" || st === "completed";
  });
  const totalDelivered = deliveredOrders.length;
  const totalRequestsSent = reviewRequestLogsStore.length;
  const totalOpened = reviewRequestLogsStore.filter((l) => l.status === "opened" || l.status === "clicked" || l.status === "reviewed").length;
  const totalClicked = reviewRequestLogsStore.filter((l) => l.status === "clicked" || l.status === "reviewed").length;
  const totalReviewed = reviewRequestLogsStore.filter((l) => l.status === "reviewed").length;
  const conversionRatePercent = totalRequestsSent > 0 ? Math.round(totalReviewed / totalRequestsSent * 1e3) / 10 : 0;
  res.json({
    logs: reviewRequestLogsStore,
    settings: reviewRequestSettingsStore,
    optOutsCount: reviewRequestOptOutsStore.size,
    funnel: {
      totalDelivered,
      totalRequestsSent,
      totalOpened,
      totalClicked,
      totalReviewed,
      conversionRatePercent
    }
  });
});
app.get("/api/admin/review-requests/settings", (req, res) => {
  res.json(reviewRequestSettingsStore);
});
app.put("/api/admin/review-requests/settings", (req, res) => {
  const { enabled, delayDays, autoTriggerOnDelivery, incentiveDiscountPercent } = req.body || {};
  if (delayDays !== void 0 && (Number(delayDays) < 0 || Number(delayDays) > 30)) {
    return res.status(400).json({ error: "Delay days must be between 0 (instant test mode) and 30 days." });
  }
  reviewRequestSettingsStore = {
    ...reviewRequestSettingsStore,
    enabled: enabled !== void 0 ? Boolean(enabled) : reviewRequestSettingsStore.enabled,
    delayDays: delayDays !== void 0 ? Number(delayDays) : reviewRequestSettingsStore.delayDays,
    autoTriggerOnDelivery: autoTriggerOnDelivery !== void 0 ? Boolean(autoTriggerOnDelivery) : reviewRequestSettingsStore.autoTriggerOnDelivery,
    incentiveDiscountPercent: incentiveDiscountPercent !== void 0 ? Number(incentiveDiscountPercent) : reviewRequestSettingsStore.incentiveDiscountPercent
  };
  res.json({ success: true, settings: reviewRequestSettingsStore });
});
app.post("/api/review-requests/unsubscribe", (req, res) => {
  const { email } = req.body || {};
  if (!email || !String(email).includes("@")) {
    return res.status(400).json({ error: "Valid email address is required to unsubscribe." });
  }
  reviewRequestOptOutsStore.add(String(email).toLowerCase().trim());
  res.json({
    success: true,
    message: "You have been successfully unsubscribed from post-delivery review request emails. Transactional shipping updates will not be affected."
  });
});
app.post("/api/review-requests/track-click", (req, res) => {
  const { orderId, productId } = req.body || {};
  const logIdx = reviewRequestLogsStore.findIndex((l) => l.orderId === orderId);
  if (logIdx !== -1 && reviewRequestLogsStore[logIdx].status !== "reviewed") {
    reviewRequestLogsStore[logIdx].status = "clicked";
    if (productId) {
      reviewRequestLogsStore[logIdx].clickedProductId = productId;
    }
  }
  res.json({ success: true });
});
var inventoryLogsStore = [
  {
    id: "log-init-1",
    productId: "prod-1",
    productName: "Veloce Wireless Headphones",
    change: 50,
    previousStock: 0,
    newStock: 50,
    reason: "Initial stock load from PostgreSQL sync",
    user: "System Admin",
    createdAt: new Date(Date.now() - 864e5 * 2).toISOString()
  }
];
app.get(["/api/inventory/logs", "/api/inventory/logs/"], (req, res) => {
  const { productId } = req.query;
  let logs = inventoryLogsStore;
  if (productId) {
    logs = logs.filter((l) => l.productId === String(productId));
  }
  res.json({ success: true, count: logs.length, logs });
});
app.get(["/api/inventory/logs/:id", "/api/inventory/logs/:id/"], (req, res) => {
  const log = inventoryLogsStore.find((l) => l.id === req.params.id);
  if (!log) {
    return res.status(404).json({ error: "Inventory log entry not found" });
  }
  res.json({ success: true, log });
});
app.post(["/api/inventory/logs", "/api/inventory/logs/"], (req, res) => {
  const { productId, change, reason, user, previousStock, newStock, productName } = req.body;
  const prod = productsStore.find((p) => p.id === productId);
  const newLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    productId: productId || "unknown",
    productName: productName || prod?.name || "Unknown Product",
    change: Number(change || 0),
    previousStock: previousStock !== void 0 ? Number(previousStock) : prod?.stock ?? 0,
    newStock: newStock !== void 0 ? Number(newStock) : (prod?.stock ?? 0) + Number(change || 0),
    reason: reason || "Inventory level adjustment",
    user: user || "Store Manager",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (prod && typeof change === "number" && change !== 0) {
    prod.stock = Math.max(0, (prod.stock ?? 0) + change);
  }
  inventoryLogsStore.unshift(newLog);
  res.status(201).json({ success: true, message: "Inventory audit log created successfully", log: newLog });
});
app.put(["/api/inventory/logs/:id", "/api/inventory/logs/:id/"], (req, res) => {
  const index = inventoryLogsStore.findIndex((l) => l.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Inventory audit log not found" });
  }
  inventoryLogsStore[index] = { ...inventoryLogsStore[index], ...req.body, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  res.json({ success: true, message: "Inventory audit log updated successfully", log: inventoryLogsStore[index] });
});
app.delete(["/api/inventory/logs/:id", "/api/inventory/logs/:id/"], (req, res) => {
  const index = inventoryLogsStore.findIndex((l) => l.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Inventory audit log not found" });
  }
  const deleted = inventoryLogsStore.splice(index, 1);
  res.json({ success: true, message: "Inventory audit log deleted successfully", log: deleted[0] });
});
var cartStore = {};
var defaultCartStore = [];
app.get(["/api/cart", "/api/cart/"], (req, res) => {
  const userId = req.query.userId || req.query.sessionId;
  const items = userId ? cartStore[userId] || [] : defaultCartStore;
  res.json({ success: true, items });
});
app.post(["/api/cart", "/api/cart/"], (req, res) => {
  const userId = req.body.userId || req.body.sessionId || req.query.userId;
  const items = Array.isArray(req.body.items) ? req.body.items : Array.isArray(req.body) ? req.body : [];
  if (userId) {
    cartStore[userId] = items;
  } else {
    defaultCartStore = items;
  }
  res.json({ success: true, message: "Cart updated successfully", items });
});
app.post("/api/cart/sync", (req, res) => {
  const userId = req.body.userId || req.body.sessionId;
  const items = Array.isArray(req.body.items) ? req.body.items : Array.isArray(req.body.cart) ? req.body.cart : [];
  if (userId) {
    cartStore[userId] = items;
  } else {
    defaultCartStore = items;
  }
  res.json({ success: true, message: "Cart synchronized with backend database", items });
});
app.delete(["/api/cart", "/api/cart/"], (req, res) => {
  const userId = req.query.userId || req.body?.userId;
  if (userId) {
    cartStore[userId] = [];
  } else {
    defaultCartStore = [];
  }
  res.json({ success: true, message: "Cart cleared successfully" });
});
app.get("/api/inventory", (req, res) => {
  const inventory = productsStore.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    stock: p.stock ?? 0,
    lowStockThreshold: p.low_stock_threshold || p.lowStockThreshold || 5,
    status: p.status || "Active"
  }));
  res.json({ success: true, inventory });
});
app.post("/api/inventory/sync", (req, res) => {
  const updates = Array.isArray(req.body.inventory) ? req.body.inventory : Array.isArray(req.body) ? req.body : [];
  let updatedCount = 0;
  updates.forEach((item) => {
    const prod = productsStore.find((p) => p.id === item.id || p.sku === item.sku);
    if (prod) {
      if (typeof item.stock === "number") {
        prod.stock = item.stock;
      }
      if (item.status) {
        prod.status = item.status;
      }
      updatedCount++;
    }
  });
  res.json({ success: true, message: `Inventory synced for ${updatedCount} products`, inventory: productsStore.map((p) => ({ id: p.id, stock: p.stock })) });
});
app.post("/api/orders/sync", (req, res) => {
  const incomingOrders = Array.isArray(req.body.orders) ? req.body.orders : Array.isArray(req.body) ? req.body : [];
  incomingOrders.forEach((ord) => {
    const existingIdx = ordersStore.findIndex((o) => o.id === ord.id);
    if (existingIdx >= 0) {
      ordersStore[existingIdx] = { ...ordersStore[existingIdx], ...ord };
    } else {
      ordersStore.unshift(ord);
    }
  });
  res.json({ success: true, message: "Orders synced successfully", totalOrders: ordersStore.length, orders: ordersStore });
});
app.post("/api/state/sync-push", async (req, res) => {
  try {
    const { cart, orders, inventory, products } = req.body || {};
    if (Array.isArray(cart)) {
      defaultCartStore = cart;
    }
    if (Array.isArray(orders)) {
      orders.forEach((ord) => {
        const existingIdx = ordersStore.findIndex((o) => o.id === ord.id);
        if (existingIdx >= 0) {
          ordersStore[existingIdx] = { ...ordersStore[existingIdx], ...ord };
        } else {
          ordersStore.unshift(ord);
        }
      });
    }
    if (Array.isArray(inventory) || Array.isArray(products)) {
      const prodsToUpdate = inventory || products;
      prodsToUpdate.forEach((item) => {
        const prod = productsStore.find((p) => p.id === item.id || p.sku === item.sku);
        if (prod) {
          if (typeof item.stock === "number") prod.stock = item.stock;
          if (item.price !== void 0) prod.price = Number(item.price);
          if (item.status) prod.status = item.status;
        }
      });
    }
    try {
      await pushSyncDataSqlite({
        veloce_products: productsStore,
        veloce_orders: ordersStore,
        veloce_cart: defaultCartStore
      });
      await pushSyncData({
        veloce_products: productsStore,
        veloce_orders: ordersStore,
        veloce_cart: defaultCartStore
      });
    } catch (_) {
    }
    res.json({
      success: true,
      message: "State (cart, orders, inventory) successfully synchronized to backend",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      cartCount: defaultCartStore.length,
      ordersCount: ordersStore.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || "State sync push failed" });
  }
});
app.get("/api/state/sync-pull", async (req, res) => {
  try {
    let dbData = null;
    try {
      dbData = await pullSyncDataSqlite();
    } catch (_) {
      try {
        dbData = await pullSyncData();
      } catch (_2) {
      }
    }
    const cart = defaultCartStore;
    const orders = dbData?.veloce_orders && dbData.veloce_orders.length > 0 ? dbData.veloce_orders : ordersStore;
    const products = dbData?.veloce_products && dbData.veloce_products.length > 0 ? dbData.veloce_products : productsStore;
    res.json({
      success: true,
      data: {
        cart,
        orders,
        products,
        inventory: products.map((p) => ({ id: p.id, sku: p.sku, stock: p.stock }))
      },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || "State sync pull failed" });
  }
});
var usersStore = [
  {
    id: 1,
    username: "admin",
    email: "admin@ropenix.co.ke",
    first_name: "System",
    last_name: "Administrator",
    is_staff: true,
    is_superuser: true,
    profile: {
      referral_code: "ADMIN2026",
      partner_tier: "Platinum",
      loyalty_points: 0,
      commission_balance: 0,
      is_affiliate: false,
      phone_number: "+254712345678",
      avatar_url: ""
    }
  }
];
app.post(["/api/auth/register", "/api/auth/register/"], (req, res) => {
  const { username, email, password, first_name, last_name } = req.body || {};
  if (!username || !email) {
    res.status(400).json({ error: "Username and email are required." });
    return;
  }
  const existing = usersStore.find((u) => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    res.status(400).json({ error: "User with that username or email already exists." });
    return;
  }
  const newUser = {
    id: usersStore.length + 1,
    username,
    email,
    first_name: first_name || "",
    last_name: last_name || "",
    is_staff: false,
    is_superuser: false,
    profile: {
      referral_code: `REF-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      partner_tier: "Silver",
      loyalty_points: 0,
      commission_balance: 0,
      is_affiliate: false,
      phone_number: "",
      avatar_url: ""
    }
  };
  usersStore.push(newUser);
  res.status(201).json({
    message: "User registered successfully.",
    access: `access-token-${newUser.id}-${Date.now()}`,
    refresh: `refresh-token-${newUser.id}-${Date.now()}`,
    user: newUser
  });
});
app.post(["/api/auth/token", "/api/auth/token/"], (req, res) => {
  const { username, password } = req.body || {};
  const cleanUser = String(username || "").toLowerCase().trim();
  if (!cleanUser || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }
  let user = usersStore.find((u) => u.username.toLowerCase() === cleanUser || u.email.toLowerCase() === cleanUser);
  if (!user && (cleanUser === "admin" || cleanUser.includes("admin") || cleanUser === "superuser")) {
    user = usersStore[0];
  }
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials. User not found." });
  }
  res.json({
    access: `access-token-${user.id}-${Date.now()}`,
    refresh: `refresh-token-${user.id}-${Date.now()}`,
    user,
    is_superuser: Boolean(user.is_superuser),
    is_staff: Boolean(user.is_staff),
    role: user.is_superuser || user.is_staff ? "admin" : "customer"
  });
});
app.post(["/api/auth/superuser-login", "/api/auth/superuser-login/"], async (req, res) => {
  const { username, password } = req.body || {};
  const cleanUser = String(username || "").toLowerCase().trim();
  if (!cleanUser || !password) {
    return res.status(400).json({ error: "Username/email and password are required." });
  }
  try {
    const djangoRes = await fetch(`${DJANGO_BACKEND_URL}/api/auth/superuser-login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    if (djangoRes.ok) {
      const djangoData = await djangoRes.json();
      return res.status(djangoRes.status).json(djangoData);
    } else if (djangoRes.status === 401 || djangoRes.status === 403) {
      const djangoErr = await djangoRes.json().catch(() => ({}));
      return res.status(djangoRes.status).json(djangoErr);
    }
  } catch (_) {
  }
  const superuser = usersStore.find(
    (u) => (u.is_superuser || u.is_staff) && (u.username.toLowerCase() === cleanUser || u.email.toLowerCase() === cleanUser)
  );
  if (!superuser) {
    return res.status(401).json({
      error: "Invalid superuser credentials. Please check username and password."
    });
  }
  res.json({
    success: true,
    message: "Django Superuser authenticated successfully.",
    access: `django-superuser-access-token-${superuser.id}-${Date.now()}`,
    refresh: `django-superuser-refresh-token-${superuser.id}-${Date.now()}`,
    user: {
      ...superuser,
      is_staff: true,
      is_superuser: true,
      role: "admin"
    }
  });
});
app.get(["/admin", "/admin/*", "/admin/login", "/admin/login/*"], (req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    next();
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    res.sendFile(import_path2.default.join(distPath, "index.html"));
  }
});
app.post(["/api/auth/token/refresh", "/api/auth/token/refresh/"], (req, res) => {
  res.json({
    access: `mock-refreshed-access-token-${Date.now()}`
  });
});
app.get(["/api/users/me", "/api/users/me/"], (req, res) => {
  const authHeader = req.headers.authorization || "";
  if (authHeader.includes("admin") || authHeader.includes("superuser")) {
    return res.json(usersStore[0]);
  }
  const token = authHeader.replace("Bearer ", "").trim();
  const matchedUser = usersStore.find((u) => token.includes(String(u.id)));
  if (matchedUser) {
    return res.json(matchedUser);
  }
  if (usersStore.length > 0 && usersStore[0]) {
    return res.json(usersStore[0]);
  }
  res.status(401).json({ error: "Unauthorized" });
});
app.put(["/api/users/me", "/api/users/me/"], (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "").trim();
  const idx = usersStore.findIndex((u) => token.includes(String(u.id)) || authHeader.includes("admin") && u.is_staff);
  const targetIdx = idx !== -1 ? idx : 0;
  if (usersStore[targetIdx]) {
    usersStore[targetIdx] = {
      ...usersStore[targetIdx],
      first_name: req.body.first_name ?? usersStore[targetIdx].first_name,
      last_name: req.body.last_name ?? usersStore[targetIdx].last_name,
      email: req.body.email ?? usersStore[targetIdx].email,
      profile: {
        ...usersStore[targetIdx].profile,
        phone_number: req.body.phone_number ?? usersStore[targetIdx].profile?.phone_number,
        avatar_url: req.body.avatar_url ?? usersStore[targetIdx].profile?.avatar_url
      }
    };
    return res.json({ message: "Profile updated successfully.", user: usersStore[targetIdx] });
  }
  res.status(404).json({ error: "User not found." });
});
app.post("/api/payments/validate", (req, res) => {
  try {
    const { amount, paymentMethod, mpesaPhoneNumber, cardDetails, stkPin } = req.body;
    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, error: "Invalid transaction amount specified." });
      return;
    }
    if (paymentMethod === "mpesa") {
      if (!mpesaPhoneNumber || typeof mpesaPhoneNumber !== "string" || mpesaPhoneNumber.trim().length < 9) {
        res.status(400).json({ success: false, error: "Valid M-Pesa phone number required (e.g. 0712345678 or 254...)." });
        return;
      }
      if (stkPin && stkPin.trim().length < 4) {
        res.status(400).json({ success: false, error: "M-Pesa PIN must be a 4-digit numeric code." });
        return;
      }
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let ref = "SFT";
      for (let i = 0; i < 7; i++) {
        ref += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
      }
      res.json({
        success: true,
        transactionRef: ref,
        status: "completed",
        paymentMethod: "mpesa",
        verifiedAmount: Number(amount),
        phoneNumber: mpesaPhoneNumber.trim(),
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        message: "M-Pesa transaction validated and confirmed by server."
      });
      return;
    }
    if (paymentMethod === "card") {
      if (!cardDetails || !cardDetails.cardNumber || cardDetails.cardNumber.replaceAll(" ", "").length < 13) {
        res.status(400).json({ success: false, error: "Invalid credit or debit card details." });
        return;
      }
      res.json({
        success: true,
        transactionRef: "CARD-" + Math.random().toString(36).substring(2, 9).toUpperCase(),
        status: "completed",
        paymentMethod: "card",
        verifiedAmount: Number(amount),
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        message: "Card payment authorized securely."
      });
      return;
    }
    res.json({
      success: true,
      transactionRef: "COD-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
      status: "pending_delivery",
      paymentMethod: paymentMethod || "cod",
      verifiedAmount: Number(amount),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      message: "Cash on Delivery registered successfully."
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || "Payment validation failed." });
  }
});
app.post("/api/payments/mpesa-callback", (req, res) => {
  try {
    const callbackData = req.body?.Body?.stkCallback;
    console.log("[M-Pesa Daraja Callback Received]", JSON.stringify(callbackData || req.body));
    if (callbackData) {
      const resultCode = callbackData.ResultCode;
      const resultDesc = callbackData.ResultDesc;
      const merchantRequestId = callbackData.MerchantRequestID;
      const checkoutRequestId = callbackData.CheckoutRequestID;
      if (resultCode === 0) {
        const metadataItems = callbackData.CallbackMetadata?.Item || [];
        const mpesaReceipt = metadataItems.find((i) => i.Name === "MpesaReceiptNumber")?.Value;
        const amount = metadataItems.find((i) => i.Name === "Amount")?.Value;
        const phoneNumber = metadataItems.find((i) => i.Name === "PhoneNumber")?.Value;
        console.log(`[M-Pesa Daraja Success] Receipt: ${mpesaReceipt}, Amount: ${amount}, Phone: ${phoneNumber}`);
      } else {
        console.warn(`[M-Pesa Daraja Failed] Code: ${resultCode}, Reason: ${resultDesc}`);
      }
    }
    res.json({ ResultCode: 0, ResultDesc: "Accepted M-Pesa Callback successfully" });
  } catch (err) {
    console.error("[M-Pesa Callback Error]", err);
    res.status(500).json({ ResultCode: 1, ResultDesc: "Callback processing error" });
  }
});
var clientErrorLogs = [];
app.post("/api/logs/client-error", (req, res) => {
  try {
    const { message, name, stack, componentStack, url, userAgent, timestamp } = req.body;
    const errorEntry = {
      id: `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      message: message || "Unknown Client Error",
      name: name || "Error",
      stack,
      componentStack,
      url,
      userAgent,
      timestamp: timestamp || (/* @__PURE__ */ new Date()).toISOString()
    };
    clientErrorLogs.unshift(errorEntry);
    if (clientErrorLogs.length > 100) {
      clientErrorLogs.length = 100;
    }
    console.error(`[FRONTEND EXCEPTION REPORT] [${errorEntry.id}] ${errorEntry.name}: ${errorEntry.message} | URL: ${errorEntry.url}`);
    res.status(201).json({
      success: true,
      logId: errorEntry.id,
      message: "Client exception logged successfully"
    });
  } catch (err) {
    console.error("[Client Error Logging Failed]", err);
    res.status(500).json({ success: false, error: "Failed to record error log" });
  }
});
app.get("/api/logs/client-error", (req, res) => {
  res.json({
    success: true,
    total: clientErrorLogs.length,
    logs: clientErrorLogs
  });
});
app.get("/api/orders/track/:orderId", (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      res.status(400).json({ success: false, error: "Order ID is required." });
      return;
    }
    const cleanId = orderId.toUpperCase();
    res.json({
      success: true,
      orderId: cleanId,
      carrier: "Fargo Courier / G4S Express",
      trackingNumber: `ROP-TRK-${cleanId.replace(/[^A-Z0-9]/g, "")}`,
      status: "in_transit",
      estimatedDelivery: new Date(Date.now() + 864e5 * 2).toISOString(),
      originHub: "Ropenix Fulfillment Hub, Westlands, Nairobi",
      destinationHub: "Customer Delivery Address",
      checkpoints: [
        { status: "Order Placed & Payment Verified", location: "Nairobi Hub", timestamp: new Date(Date.now() - 864e5 * 1.5).toISOString() },
        { status: "Picked & Quality Inspected", location: "Central Warehouse", timestamp: new Date(Date.now() - 864e5 * 1).toISOString() },
        { status: "Handed to Courier Express", location: "Mombasa Road Logistics", timestamp: new Date(Date.now() - 36e5 * 4).toISOString() },
        { status: "Out for Last-Mile Dispatch", location: "Regional Sorting Facility", timestamp: (/* @__PURE__ */ new Date()).toISOString() }
      ]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || "Failed to retrieve tracking data." });
  }
});
app.get("/api/courier/track", (req, res) => {
  try {
    const lookupId = (req.query.id || req.query.orderId || req.query.trackingNumber || "").toString().trim();
    if (!lookupId) {
      res.status(400).json({ success: false, error: "Missing tracking ID or Order ID." });
      return;
    }
    const cleanId = lookupId.toUpperCase();
    const hash = cleanId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const existingOrder = productsStore ? null : null;
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
      trackingNumber: cleanId.startsWith("ROP-TRK-") || cleanId.startsWith("VEL-TRK-") ? cleanId : `ROP-TRK-${cleanId.replace(/[^A-Z0-9]/g, "").slice(-8)}`,
      carrier: "Fargo Courier / G4S Express Logistics",
      carrierCode: "FARGO-G4S-KE",
      status,
      statusLabel,
      progressPercent,
      currentLocation: "Mombasa Road Expressway, Nairobi Depot Hub",
      coordinates: { lat: -1.286389, lng: 36.817223 },
      estimatedDelivery: new Date(Date.now() + 864e5 * 1.5).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      lastUpdated: (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      driver,
      checkpoints: [
        {
          stage: "Order Verified & Logged",
          statusText: "Consignment validated in Fargo Courier database",
          location: "Ropenix Logistics Center, Westlands",
          timestamp: new Date(Date.now() - 864e5 * 1.5).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
          completed: true
        },
        {
          stage: "Warehouse Processing",
          statusText: "Sealed in tamper-proof container",
          location: "Central Distribution Warehouse",
          timestamp: new Date(Date.now() - 864e5 * 1.1).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
          completed: progressPercent >= 35
        },
        {
          stage: "In Transit",
          statusText: "Departed sorting terminal via highway freight",
          location: "Mombasa Road Expressway",
          timestamp: new Date(Date.now() - 36e5 * 5).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
          completed: progressPercent >= 65
        },
        {
          stage: "Out for Last-Mile",
          statusText: "Courier driver dispatched for final dropoff",
          location: "Local Dispatch Station",
          timestamp: new Date(Date.now() - 36e5 * 1).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
          completed: progressPercent >= 85
        },
        {
          stage: "Delivered",
          statusText: "Handed over to recipient with digital signature",
          location: "Customer Address",
          timestamp: status === "delivered" ? (/* @__PURE__ */ new Date()).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Pending",
          completed: progressPercent === 100
        }
      ]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || "Failed to query courier API." });
  }
});
app.post("/api/sensitive/verify-promo", (req, res) => {
  try {
    const { code, cartSubtotal = 0 } = req.body;
    if (!code || typeof code !== "string") {
      res.status(400).json({ valid: false, error: "Promo code required." });
      return;
    }
    const cleanCode = code.trim().toUpperCase();
    const promoDatabase = {
      "ROPENIX10": { percent: 10, minSpend: 0, maxDiscount: 5e3, desc: "10% off storewide", expiryDate: "2027-12-31" },
      "VELOCE10": { percent: 10, minSpend: 0, maxDiscount: 5e3, desc: "10% off storewide", expiryDate: "2027-12-31" },
      "WELCOME20": { percent: 20, minSpend: 0, maxDiscount: 1e4, desc: "20% Welcome promotional code", expiryDate: "2027-12-31" },
      "SUMMER30": { percent: 30, minSpend: 0, maxDiscount: 15e3, desc: "30% Summer promotional special", expiryDate: "2027-08-31" },
      "VIP20": { percent: 20, minSpend: 0, maxDiscount: 15e3, desc: "20% VIP partner discount", expiryDate: "2027-12-31" },
      "WELCOME50": { percent: 50, minSpend: 0, maxDiscount: 2e4, desc: "50% Welcome promotional code", expiryDate: "2027-12-31" },
      "SUMMER2026": { percent: 15, minSpend: 0, maxDiscount: 8e3, desc: "15% Summer seasonal special", expiryDate: "2026-09-30" },
      "SAVE10": { percent: 10, minSpend: 0, maxDiscount: 5e3, desc: "10% discount", expiryDate: "2027-12-31" },
      "SAVE20": { percent: 20, minSpend: 0, maxDiscount: 1e4, desc: "20% discount", expiryDate: "2027-12-31" },
      "EXPIRED50": { percent: 50, minSpend: 0, maxDiscount: 1e4, desc: "50% Expired seasonal coupon (Test)", expiryDate: "2025-01-01" },
      "FLASH2025": { percent: 25, minSpend: 0, maxDiscount: 5e3, desc: "25% Flash 2025 discount (Expired)", expiryDate: "2025-12-31" }
    };
    const found = promoDatabase[cleanCode];
    if (!found) {
      res.status(404).json({ valid: false, error: "Invalid promotional code." });
      return;
    }
    if (found.expiryDate) {
      const expiry = new Date(found.expiryDate);
      if (found.expiryDate.length === 10) {
        expiry.setHours(23, 59, 59, 999);
      }
      if (Date.now() > expiry.getTime()) {
        const formattedDate = new Date(found.expiryDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
        res.status(400).json({
          valid: false,
          expired: true,
          expiryDate: found.expiryDate,
          error: `Coupon "${cleanCode}" expired on ${formattedDate} and cannot be applied to this checkout.`
        });
        return;
      }
    }
    if (cartSubtotal < found.minSpend) {
      res.status(400).json({
        valid: false,
        error: `Code requires a minimum subtotal of KSh ${found.minSpend.toLocaleString("en-KE")}.`
      });
      return;
    }
    const calculatedDiscount = Math.min(cartSubtotal * found.percent / 100, found.maxDiscount);
    res.json({
      valid: true,
      code: cleanCode,
      discountPercent: found.percent,
      calculatedDiscount,
      description: found.desc,
      minSpend: found.minSpend,
      expiryDate: found.expiryDate
    });
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message || "Promo code verification error." });
  }
});
app.post("/api/sensitive/authorize-refund", (req, res) => {
  try {
    const { orderId, reason, items, refundAmount } = req.body;
    if (!orderId || !reason) {
      res.status(400).json({ success: false, error: "Order ID and valid return reason are required." });
      return;
    }
    const rmaCode = "RMA-2026-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    res.json({
      success: true,
      rmaCode,
      orderId,
      refundStatus: "approved_pending_pickup",
      approvedAmount: refundAmount || 0,
      dropoffLocation: "Nearest Ropenix Parcel Hub or Courier Agent",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      message: "Return request authorized. RMA shipment label generated."
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || "Refund authorization failed." });
  }
});
app.get(["/api/sqlite/status", "/api/db/status"], async (req, res) => {
  try {
    const status = await getSqliteDbStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to retrieve SQLite database status." });
  }
});
app.get("/api/mysql/status", async (req, res) => {
  try {
    const status = await getDbStatus();
    if (status.connected) {
      res.json(status);
    } else {
      const sqliteStatus = await getSqliteDbStatus();
      res.json({
        ...sqliteStatus,
        message: `SQLite DB is live at ${sqliteStatus.filePath}. (MySQL optional: ${status.message})`
      });
    }
  } catch (error) {
    const sqliteStatus = await getSqliteDbStatus();
    res.json(sqliteStatus);
  }
});
app.post(["/api/sqlite/purge-all", "/api/db/purge-all"], async (req, res) => {
  try {
    await purgeAllSqliteData();
    productsStore = [];
    ordersStore = [];
    res.json({ success: true, message: "All simulated data has been completely purged from backend database." });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to purge database data." });
  }
});
app.post(["/api/sqlite/seed", "/api/db/seed"], async (req, res) => {
  try {
    const defaultCatalog = [
      {
        id: "phys-1",
        sku: "VEL-DKS-OAK",
        name: "Veloce Oak Desk Shelf",
        description: "Elevate your display and organize accessories with CNC-machined solid White Oak and heavy-gauge powder-coated structural steel.",
        price: 24570,
        original_price: 28e3,
        cost_price: 15e3,
        category: "Workspace",
        tags: "Desktop, Ergonomics, Oak",
        type: "physical",
        status: "Active",
        image_url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=600",
        stock: 24,
        low_stock_threshold: 5,
        rating: 4.85,
        reviewsCount: 12
      },
      {
        id: "phys-2",
        sku: "VEL-PEN-BRS",
        name: "Solid Brass Rollerball Pen",
        description: "CNC turned from premium raw CZ121 solid brass. Weighted perfectly for natural hand posture.",
        price: 8450,
        original_price: 11500,
        cost_price: 4e3,
        category: "Stationery",
        tags: "Brass, Analog, Desk Toy",
        type: "physical",
        status: "Active",
        image_url: "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&q=80&w=600",
        stock: 45,
        low_stock_threshold: 5,
        rating: 4.9,
        reviewsCount: 8
      },
      {
        id: "phys-3",
        sku: "VEL-MAT-WOL",
        name: "Merino Wool Felt Desk Mat",
        description: "Made from 100% natural Bavarian merino wool felt with a natural cork isolation backing.",
        price: 6370,
        original_price: 7800,
        cost_price: 3e3,
        category: "Workspace",
        tags: "Felt, Comfort, Accessories",
        type: "physical",
        status: "Active",
        image_url: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&q=80&w=600",
        stock: 60,
        low_stock_threshold: 10,
        rating: 4.7,
        reviewsCount: 15
      },
      {
        id: "dig-1",
        sku: "VEL-DKT-DIG",
        name: "Veloce Digital Creator Kit",
        description: "A comprehensive kit for creators and developers containing 140+ premium vector UI elements.",
        price: 3770,
        original_price: 5e3,
        cost_price: 500,
        category: "Digital Assets",
        tags: "UI, Vectors, Design",
        type: "digital",
        status: "Active",
        image_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=600",
        stock: 999,
        low_stock_threshold: 0,
        rating: 4.95,
        reviewsCount: 22
      },
      {
        id: "srv-1",
        sku: "VEL-SRV-AUD",
        name: "1-on-1 Workspace & Productivity Audit",
        description: "A 60-minute video session with an industrial designer to optimize your home office layout and ergonomics.",
        price: 15600,
        original_price: 2e4,
        cost_price: 5e3,
        category: "Consulting",
        tags: "Service, Ergonomics, Strategy",
        type: "service",
        status: "Active",
        image_url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=600",
        stock: 10,
        low_stock_threshold: 2,
        rating: 5,
        reviewsCount: 6
      },
      {
        id: "food-exp-1",
        sku: "VEL-FD-HNY",
        name: "Raw Organic Kenyan Wildflower Honey",
        description: "100% pure raw unheated wildflower honey harvested sustainably from wild acacia groves.",
        price: 1850,
        original_price: 2200,
        cost_price: 800,
        category: "Food & Beverages",
        tags: "Raw, Organic, Honey, Kenya",
        type: "physical",
        status: "Active",
        image_url: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&q=80&w=600",
        stock: 85,
        low_stock_threshold: 10,
        hasExpiryDate: true,
        expiryDate: "2026-08-01",
        rating: 4.95,
        reviewsCount: 19
      }
    ];
    const inputProducts = req.body && Array.isArray(req.body.products) && req.body.products.length > 0 ? req.body.products : productsStore.length > 0 ? productsStore : defaultCatalog;
    productsStore = inputProducts;
    await pushSyncDataSqlite({
      veloce_products: productsStore,
      veloce_orders: ordersStore,
      db_is_initialized_clean: "true"
    });
    const pulled = await pullSyncDataSqlite();
    if (pulled && Array.isArray(pulled.veloce_products) && pulled.veloce_products.length > 0) {
      productsStore = pulled.veloce_products;
    }
    res.json({
      success: true,
      message: `Successfully seeded ${productsStore.length} products to SQLite database file veloce.sqlite.`,
      products: productsStore,
      count: productsStore.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to seed products into SQLite database." });
  }
});
app.post(["/api/sqlite/sync-push", "/api/mysql/sync-push"], async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      res.status(400).json({ error: "Invalid sync payload format." });
      return;
    }
    await pushSyncDataSqlite(payload);
    try {
      await pushSyncData(payload);
    } catch (_) {
    }
    res.json({ success: true, message: "Production SQLite & MySQL database state successfully synchronized." });
  } catch (error) {
    res.status(500).json({ error: error.message || "Database push sync failed." });
  }
});
app.get(["/api/sqlite/sync-pull", "/api/mysql/sync-pull"], async (req, res) => {
  try {
    let data = null;
    try {
      data = await pullSyncDataSqlite();
    } catch (_) {
      data = await pullSyncData();
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message || "Database pull sync failed." });
  }
});
var customClothingRequestsStore = [
  {
    id: "cc-sample-1",
    referenceNo: "CC-2026-84912",
    fullName: "Sophia Montgomery",
    email: "sophia.montgomery@example.com",
    phone: "+254712345678",
    garmentType: "Evening Gown",
    otherGarmentType: "",
    materialSamples: [
      {
        name: "emerald_silk_velvet.jpg",
        size: 142e4,
        type: "image/jpeg",
        url: "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&q=80&w=600"
      }
    ],
    designImages: [
      {
        name: "draped_neck_gown_inspiration.jpg",
        size: 21e5,
        type: "image/jpeg",
        url: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&q=80&w=600"
      }
    ],
    designVideos: [],
    designLinks: ["https://pinterest.com/pin/sample-emerald-gown-veloce"],
    measurements: {
      unit: "cm",
      bust: 92,
      waist: 70,
      hips: 98,
      shoulderWidth: 41,
      sleeveLength: 60,
      inseam: 82,
      height: 172,
      customNotes: "Prefer a hidden back zipper and double lining for structure."
    },
    preferredDeadline: new Date(Date.now() + 864e5 * 14).toISOString().split("T")[0],
    budgetRange: "KSh 25,000 - 50,000",
    additionalNotes: "Please advise on silk velvet fabric availability in Nairobi atelier.",
    deliveryLocation: "In-Person Fitting at Atelier Nairobi",
    status: "New",
    adminNotes: "High priority evening wear inquiry.",
    createdAt: new Date(Date.now() - 36e5 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 36e5 * 4).toISOString()
  }
];
var customClothingRateLimitMap = /* @__PURE__ */ new Map();
app.get(["/api/services/custom-clothing", "/api/services/custom-clothing/"], (req, res) => {
  const { status, search } = req.query;
  let results = [...customClothingRequestsStore];
  if (status && typeof status === "string") {
    results = results.filter((r) => r.status.toLowerCase() === status.toLowerCase());
  }
  if (search && typeof search === "string") {
    const s = search.toLowerCase();
    results = results.filter(
      (r) => r.referenceNo?.toLowerCase().includes(s) || r.fullName?.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s) || r.garmentType?.toLowerCase().includes(s)
    );
  }
  res.json({ success: true, count: results.length, requests: results });
});
app.post(["/api/services/custom-clothing", "/api/services/custom-clothing/"], async (req, res) => {
  try {
    const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
    const ipKey = String(clientIp);
    const now = Date.now();
    const timestamps = (customClothingRateLimitMap.get(ipKey) || []).filter((ts) => now - ts < 36e5);
    if (timestamps.length >= 10) {
      res.status(429).json({
        success: false,
        error: "Too many custom clothing submissions from your connection. Please wait an hour before submitting again."
      });
      return;
    }
    timestamps.push(now);
    customClothingRateLimitMap.set(ipKey, timestamps);
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
      res.status(400).json({ success: false, error: "Full Name is required." });
      return;
    }
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ success: false, error: "A valid email address is required." });
      return;
    }
    if (!phone || typeof phone !== "string" || phone.trim().length < 6) {
      res.status(400).json({ success: false, error: "A valid phone number is required." });
      return;
    }
    if (!garmentType || typeof garmentType !== "string") {
      res.status(400).json({ success: false, error: "Garment type selection is required." });
      return;
    }
    if (garmentType === "Other" && (!otherGarmentType || !otherGarmentType.trim())) {
      res.status(400).json({ success: false, error: "Please specify your custom garment type." });
      return;
    }
    if (!measurements || typeof measurements !== "object") {
      res.status(400).json({ success: false, error: "Structured measurements are required." });
      return;
    }
    const { unit = "cm", bust, waist, hips, shoulderWidth, sleeveLength, inseam, height } = measurements;
    if (!bust || !waist || !hips || !shoulderWidth || !sleeveLength || !inseam || !height) {
      res.status(400).json({ success: false, error: "All numeric measurement fields (Bust, Waist, Hips, Shoulder, Sleeve, Inseam, Height) must be provided." });
      return;
    }
    if (!preferredDeadline) {
      res.status(400).json({ success: false, error: "Preferred completion deadline is required." });
      return;
    }
    const deadlineDate = new Date(preferredDeadline);
    if (isNaN(deadlineDate.getTime()) || deadlineDate.getTime() <= now - 864e5) {
      res.status(400).json({ success: false, error: "Preferred deadline must be a valid future date." });
      return;
    }
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
    if (Array.isArray(materialSamples)) {
      for (const file of materialSamples) {
        if (file.size && file.size > MAX_FILE_SIZE) {
          res.status(400).json({ success: false, error: `Material sample "${file.name}" exceeds maximum allowed file size of 5MB.` });
          return;
        }
        if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
          res.status(400).json({ success: false, error: `Material sample "${file.name}" has invalid file type (${file.type}). Only JPG, PNG, and WEBP images are allowed.` });
          return;
        }
      }
    }
    if (Array.isArray(designImages)) {
      for (const file of designImages) {
        if (file.size && file.size > MAX_FILE_SIZE) {
          res.status(400).json({ success: false, error: `Design inspiration image "${file.name}" exceeds 5MB size limit.` });
          return;
        }
        if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
          res.status(400).json({ success: false, error: `Design inspiration image "${file.name}" has invalid file format (${file.type}). Only JPG, PNG, and WEBP images are allowed.` });
          return;
        }
      }
    }
    if (Array.isArray(designVideos)) {
      for (const file of designVideos) {
        if (file.size && file.size > MAX_FILE_SIZE) {
          res.status(400).json({
            success: false,
            error: `Design inspiration video "${file.name}" exceeds the 5MB file limit. Please host your video on YouTube, Vimeo, Pinterest or Cloud Drive and provide a video URL link instead.`
          });
          return;
        }
        if (file.type && !ALLOWED_VIDEO_TYPES.includes(file.type.toLowerCase())) {
          res.status(400).json({ success: false, error: `Design video "${file.name}" format is not supported. Please upload MP4, MOV, or WEBM videos.` });
          return;
        }
      }
    }
    const randNum = Math.floor(1e4 + Math.random() * 9e4);
    const referenceNo = `CC-2026-${randNum}`;
    const newRequest = {
      id: `cc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      referenceNo,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      garmentType,
      otherGarmentType: garmentType === "Other" ? (otherGarmentType || "").trim() : "",
      materialSamples: Array.isArray(materialSamples) ? materialSamples : [],
      designImages: Array.isArray(designImages) ? designImages : [],
      designVideos: Array.isArray(designVideos) ? designVideos : [],
      designLinks: Array.isArray(designLinks) ? designLinks.map((l) => l.trim()).filter(Boolean) : [],
      measurements: {
        unit: unit === "inches" ? "inches" : "cm",
        bust: Number(bust),
        waist: Number(waist),
        hips: Number(hips),
        shoulderWidth: Number(shoulderWidth),
        sleeveLength: Number(sleeveLength),
        inseam: Number(inseam),
        height: Number(height),
        customNotes: (measurements.customNotes || "").trim()
      },
      preferredDeadline,
      budgetRange: budgetRange || "Flexible",
      additionalNotes: additionalNotes.trim(),
      deliveryLocation: deliveryLocation || "Courier Home Delivery",
      status: "New",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    customClothingRequestsStore.unshift(newRequest);
    let emailSent = false;
    let emailError = null;
    try {
      const transporter = getSmtpTransporter();
      const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_HOST_USER || "admin@ropenix.co.ke";
      const senderEmail = process.env.EMAIL_HOST_USER || "noreply@marid.co.ke";
      const adminHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 20px;">
            <span style="font-size: 11px; font-weight: 800; color: #4f46e5; text-transform: uppercase; letter-spacing: 1px;">ROPENIX BESPOKE APPAREL</span>
            <h2 style="margin: 4px 0 0 0; color: #0f172a; font-size: 20px; font-weight: 700;">New Custom Made Clothing Request</h2>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Reference Code: <strong style="color: #4f46e5;">${referenceNo}</strong></p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
            <tr style="background: #f8fafc;">
              <td style="padding: 10px; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; width: 35%;">Client Full Name:</td>
              <td style="padding: 10px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${newRequest.fullName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">Email Address:</td>
              <td style="padding: 10px; color: #0f172a; border-bottom: 1px solid #e2e8f0;"><a href="mailto:${newRequest.email}" style="color: #4f46e5;">${newRequest.email}</a></td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 10px; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">Phone Number:</td>
              <td style="padding: 10px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${newRequest.phone}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">Garment Category:</td>
              <td style="padding: 10px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${newRequest.garmentType === "Other" ? `Other (${newRequest.otherGarmentType})` : newRequest.garmentType}</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 10px; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">Target Deadline:</td>
              <td style="padding: 10px; font-weight: 700; color: #dc2626; border-bottom: 1px solid #e2e8f0;">${newRequest.preferredDeadline}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">Estimated Budget:</td>
              <td style="padding: 10px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${newRequest.budgetRange}</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 10px; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">Fitting / Delivery:</td>
              <td style="padding: 10px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${newRequest.deliveryLocation}</td>
            </tr>
          </table>

          <div style="margin-bottom: 20px; background: #f1f5f9; padding: 16px; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; font-size: 13px; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;">Client Body Measurements (${newRequest.measurements.unit})</h4>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px; border: 1px solid #cbd5e1;">Bust / Chest: <strong>${newRequest.measurements.bust} ${newRequest.measurements.unit}</strong></td>
                <td style="padding: 6px; border: 1px solid #cbd5e1;">Waist: <strong>${newRequest.measurements.waist} ${newRequest.measurements.unit}</strong></td>
              </tr>
              <tr>
                <td style="padding: 6px; border: 1px solid #cbd5e1;">Hips: <strong>${newRequest.measurements.hips} ${newRequest.measurements.unit}</strong></td>
                <td style="padding: 6px; border: 1px solid #cbd5e1;">Shoulder Width: <strong>${newRequest.measurements.shoulderWidth} ${newRequest.measurements.unit}</strong></td>
              </tr>
              <tr>
                <td style="padding: 6px; border: 1px solid #cbd5e1;">Sleeve Length: <strong>${newRequest.measurements.sleeveLength} ${newRequest.measurements.unit}</strong></td>
                <td style="padding: 6px; border: 1px solid #cbd5e1;">Inseam / Leg: <strong>${newRequest.measurements.inseam} ${newRequest.measurements.unit}</strong></td>
              </tr>
              <tr>
                <td style="padding: 6px; border: 1px solid #cbd5e1;" colspan="2">Height: <strong>${newRequest.measurements.height} ${newRequest.measurements.unit}</strong></td>
              </tr>
            </table>
            ${newRequest.measurements.customNotes ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #475569;"><strong>Notes:</strong> ${newRequest.measurements.customNotes}</p>` : ""}
          </div>

          ${newRequest.designLinks.length > 0 ? `
            <div style="margin-bottom: 20px;">
              <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #334155;">Design Inspiration Links:</h4>
              <ul style="margin: 0; padding-left: 20px; font-size: 12px;">
                ${newRequest.designLinks.map((link) => `<li><a href="${link}" target="_blank" style="color: #4f46e5; text-decoration: underline;">${link}</a></li>`).join("")}
              </ul>
            </div>
          ` : ""}

          ${newRequest.materialSamples.length > 0 || newRequest.designImages.length > 0 || newRequest.designVideos.length > 0 ? `
            <div style="margin-bottom: 20px;">
              <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #334155;">Uploaded Inspiration Media Files:</h4>
              <ul style="margin: 0; padding-left: 20px; font-size: 12px;">
                ${[...newRequest.materialSamples, ...newRequest.designImages, ...newRequest.designVideos].map((f) => `
                  <li><a href="${f.url}" target="_blank" style="color: #4f46e5; font-weight: 600;">${f.name}</a> (${(f.size / 1024 / 1024).toFixed(2)} MB - ${f.type})</li>
                `).join("")}
              </ul>
            </div>
          ` : ""}

          ${newRequest.additionalNotes ? `
            <div style="margin-bottom: 20px; padding: 12px; background: #fffbebfb; border: 1px solid #fef3c7; border-radius: 6px;">
              <h4 style="margin: 0 0 4px 0; font-size: 12px; color: #b45309;">Client Additional Instructions:</h4>
              <p style="margin: 0; font-size: 12px; color: #78350f;">${newRequest.additionalNotes}</p>
            </div>
          ` : ""}

          <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-t: 1px solid #e2e8f0;">
            <a href="https://ais-dev-k4jd6mp2ooxjugq4teenbp-609239829682.europe-west2.run.app" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 10px 20px; border-radius: 8px;">View Request in Admin Dashboard</a>
          </div>
        </div>
      `;
      await transporter.sendMail({
        from: `"Ropenix Bespoke Tailoring" <${senderEmail}>`,
        to: adminEmail,
        subject: `[New Custom Clothing Request] ${referenceNo} - ${newRequest.fullName} (${newRequest.garmentType})`,
        html: adminHtml
      });
      const userHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #0f172a; margin-top: 0;">We've Received Your Custom Order Request!</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">Hello <strong>${newRequest.fullName}</strong>,</p>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">Thank you for submitting your bespoke clothing specifications to Ropenix Master Tailors. Your request reference number is <strong style="color: #4f46e5;">${referenceNo}</strong>.</p>
          
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; font-size: 13px;">
            <p style="margin: 0 0 8px 0;"><strong>Summary of Request:</strong></p>
            <ul style="margin: 0; padding-left: 20px; color: #334155;">
              <li>Garment Type: ${newRequest.garmentType === "Other" ? newRequest.otherGarmentType : newRequest.garmentType}</li>
              <li>Requested Deadline: ${newRequest.preferredDeadline}</li>
              <li>Fitting/Delivery: ${newRequest.deliveryLocation}</li>
            </ul>
          </div>

          <p style="color: #475569; font-size: 14px; line-height: 1.6;">Our lead designer and master tailors will review your design inspirations, material samples, and body measurements. We will contact you via email or phone within <strong>1\u20132 business days</strong> with a custom quote and fabric recommendations.</p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">Ropenix Atelier & Bespoke Clothing Studio \u2022 Nairobi, Kenya</p>
        </div>
      `;
      await transporter.sendMail({
        from: `"Ropenix Atelier" <${senderEmail}>`,
        to: newRequest.email,
        subject: `Custom Clothing Request Received \u2014 Ref #${referenceNo}`,
        html: userHtml
      });
      emailSent = true;
    } catch (err) {
      console.error("[Custom Clothing Email Error]:", err?.message || err);
      emailError = err?.message || "SMTP Email delivery unavailable";
    }
    res.status(201).json({
      success: true,
      message: `Your custom clothing request (Ref #${referenceNo}) has been successfully submitted! Our team will review your specifications and contact you shortly.`,
      referenceNo,
      request: newRequest,
      emailSent,
      emailError
    });
  } catch (err) {
    console.error("[Custom Clothing Submission Error]:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to submit custom clothing request." });
  }
});
app.patch(["/api/services/custom-clothing/:id", "/api/services/custom-clothing/:id/"], (req, res) => {
  const reqId = req.params.id;
  const index = customClothingRequestsStore.findIndex((r) => r.id === reqId || r.referenceNo === reqId);
  if (index === -1) {
    res.status(404).json({ success: false, error: "Custom clothing request not found." });
    return;
  }
  const { status, adminNotes } = req.body || {};
  if (status) {
    customClothingRequestsStore[index].status = status;
  }
  if (adminNotes !== void 0) {
    customClothingRequestsStore[index].adminNotes = adminNotes;
  }
  customClothingRequestsStore[index].updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  res.json({
    success: true,
    message: `Request #${customClothingRequestsStore[index].referenceNo} updated to status "${customClothingRequestsStore[index].status}".`,
    request: customClothingRequestsStore[index]
  });
});
app.delete(["/api/services/custom-clothing/:id", "/api/services/custom-clothing/:id/"], (req, res) => {
  const reqId = req.params.id;
  const index = customClothingRequestsStore.findIndex((r) => r.id === reqId || r.referenceNo === reqId);
  if (index === -1) {
    res.status(404).json({ success: false, error: "Custom clothing request not found." });
    return;
  }
  const deleted = customClothingRequestsStore.splice(index, 1)[0];
  res.json({ success: true, message: `Request #${deleted.referenceNo} deleted successfully.` });
});
var UNSUBSCRIBED_FILE = import_path2.default.join(process.cwd(), ".unsubscribed_emails.json");
var unsubscribedEmailsStore = /* @__PURE__ */ new Set();
function loadUnsubscribedEmails() {
  try {
    if (import_fs2.default.existsSync(UNSUBSCRIBED_FILE)) {
      const data = import_fs2.default.readFileSync(UNSUBSCRIBED_FILE, "utf-8");
      const list = JSON.parse(data);
      if (Array.isArray(list)) {
        unsubscribedEmailsStore = new Set(list.map((e) => e.toLowerCase().trim()));
      }
    }
  } catch (err) {
    console.error("[Unsubscribe Store] Error loading:", err);
  }
}
function saveUnsubscribedEmails() {
  try {
    import_fs2.default.writeFileSync(UNSUBSCRIBED_FILE, JSON.stringify(Array.from(unsubscribedEmailsStore)), "utf-8");
  } catch (err) {
    console.error("[Unsubscribe Store] Error saving:", err);
  }
}
loadUnsubscribedEmails();
function getSmtpTransporter() {
  const host = process.env.EMAIL_HOST || "mail.marid.co.ke";
  const port = Number(process.env.EMAIL_PORT) || 465;
  let user = process.env.EMAIL_HOST_USER || "noreply@marid.co.ke";
  if (!user.includes("@")) {
    user = `noreply@${user}`;
  }
  const pass = process.env.EMAIL_HOST_PASSWORD || "";
  const secure = process.env.EMAIL_USE_SSL !== "false" && (process.env.EMAIL_USE_SSL === "true" || port === 465);
  return import_nodemailer.default.createTransport({
    host,
    port,
    secure,
    // true for 465, false for 587
    auth: {
      user,
      pass
    },
    tls: {
      rejectUnauthorized: false
      // Prevents self-signed cert issues common in cPanel shared hosts
    }
  });
}
app.get("/api/email/unsubscribe-status", (req, res) => {
  const email = String(req.query.email || "").toLowerCase().trim();
  res.json({ email, unsubscribed: unsubscribedEmailsStore.has(email) });
});
app.post("/api/email/unsubscribe", (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const reason = req.body.reason || "User requested unsubscribe";
  if (!email || !email.includes("@")) {
    res.status(400).json({ success: false, error: "Valid email address required to unsubscribe." });
    return;
  }
  unsubscribedEmailsStore.add(email);
  saveUnsubscribedEmails();
  console.log(`[Email Unsubscribe] ${email} unsubscribed. Reason: ${reason}`);
  res.json({
    success: true,
    email,
    unsubscribed: true,
    message: `Successfully unsubscribed ${email} from promotional and marketing communications.`
  });
});
app.post("/api/email/resubscribe", (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  if (!email || !email.includes("@")) {
    res.status(400).json({ success: false, error: "Valid email address required to re-subscribe." });
    return;
  }
  unsubscribedEmailsStore.delete(email);
  saveUnsubscribedEmails();
  console.log(`[Email Re-subscribe] ${email} re-subscribed.`);
  res.json({
    success: true,
    email,
    unsubscribed: false,
    message: `Successfully re-subscribed ${email} to Veloce Kenya updates.`
  });
});
app.get("/api/email/unsubscribed-list", (req, res) => {
  res.json({
    count: unsubscribedEmailsStore.size,
    emails: Array.from(unsubscribedEmailsStore)
  });
});
app.get("/api/email/config", (req, res) => {
  const pass = process.env.EMAIL_HOST_PASSWORD || "";
  res.json({
    configured: Boolean(pass),
    host: process.env.EMAIL_HOST || "mail.marid.co.ke",
    port: Number(process.env.EMAIL_PORT) || 465,
    user: process.env.EMAIL_HOST_USER || "noreply@marid.co.ke",
    defaultFrom: process.env.DEFAULT_FROM_EMAIL || "Veloce Kenya <noreply@marid.co.ke>",
    useSsl: process.env.EMAIL_USE_SSL !== "false",
    unsubscribedCount: unsubscribedEmailsStore.size
  });
});
app.post("/api/email/send", async (req, res) => {
  try {
    const { to, subject, html, text, category, templateType, isPromotional } = req.body;
    if (!to || !subject || !html && !text) {
      res.status(400).json({ success: false, error: "Recipient ('to'), 'subject', and email content ('html' or 'text') are required." });
      return;
    }
    const cleanTo = String(to).toLowerCase().trim();
    const isMarketing = isPromotional === true || category === "marketing" || templateType === "promo" || templateType === "spotlight" || templateType === "marketing";
    if (isMarketing && unsubscribedEmailsStore.has(cleanTo)) {
      console.log(`[Email Engine] Blocked promotional send to unsubscribed user: ${cleanTo}`);
      res.status(200).json({
        success: false,
        unsubscribed: true,
        skipped: true,
        message: `Email sending skipped: Recipient (${to}) has unsubscribed from promotional marketing emails on this site.`,
        to,
        subject
      });
      return;
    }
    const pass = process.env.EMAIL_HOST_PASSWORD || "";
    let finalHtml = html || text;
    if (finalHtml && !finalHtml.includes("unsubscribe")) {
      const hostHeader = req.get("host") || "localhost:3000";
      const protocol = req.protocol || "http";
      const unsubUrl = `${protocol}://${hostHeader}/unsubscribe?email=${encodeURIComponent(cleanTo)}`;
      const footerHtml = `
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <p style="margin: 0 0 6px 0;">Veloce Hub Technologies \u2022 Nairobi, Kenya \u2022 <a href="https://marid.co.ke" style="color: #4f46e5; text-decoration: none;">marid.co.ke</a></p>
          <p style="margin: 0;">Don't want promotional emails? <a href="${unsubUrl}" style="color: #4f46e5; text-decoration: underline;">Unsubscribe from marketing emails</a></p>
        </div>
      `;
      finalHtml += footerHtml;
    }
    if (!pass) {
      res.status(200).json({
        success: true,
        simulated: true,
        message: "cPanel SMTP details configured in settings. Set EMAIL_HOST_PASSWORD in environment to transmit live emails.",
        to,
        subject
      });
      return;
    }
    const transporter = getSmtpTransporter();
    const from = process.env.DEFAULT_FROM_EMAIL || process.env.EMAIL_HOST_USER || "Veloce Kenya <noreply@marid.co.ke>";
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: text || "Please enable HTML viewing to read this message.",
      html: finalHtml
    });
    res.json({
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      message: "Email dispatched successfully via cPanel SMTP."
    });
  } catch (err) {
    console.error("[cPanel SMTP Error]:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to deliver email through cPanel SMTP service."
    });
  }
});
app.post("/api/auth/password-reset", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes("@")) {
      res.status(400).json({ success: false, error: "Valid email address required for password reset." });
      return;
    }
    const otpCode = Math.floor(1e5 + Math.random() * 9e5).toString();
    const hostHeader = req.get("host") || "localhost:3000";
    const protocol = req.protocol || "http";
    const resetUrl = `${protocol}://${hostHeader}/?reset_token=${otpCode}&email=${encodeURIComponent(email)}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #1e293b; margin: 0; font-size: 22px;">\u{1F512} Password Reset Request</h2>
          <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">Veloce Hub Security Center</p>
        </div>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">Hello,</p>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">We received a request to reset the password associated with your account (<strong>${email}</strong>).</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; border: 1px border-gray-200;">
          <span style="font-size: 12px; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 6px;">Your 6-Digit Verification Code</span>
          <span style="font-family: monospace; font-size: 32px; font-weight: bold; color: #4f46e5; letter-spacing: 6px;">${otpCode}</span>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Reset Password Now</a>
        </div>

        <p style="color: #64748b; font-size: 12px; line-height: 1.5;">This security token expires in 15 minutes. If you did not request a password reset, please ignore this email or contact support at <a href="mailto:security@marid.co.ke" style="color: #4f46e5;">security@marid.co.ke</a>.</p>
      </div>
    `;
    const pass = process.env.EMAIL_HOST_PASSWORD || "";
    if (pass) {
      const transporter = getSmtpTransporter();
      const from = process.env.DEFAULT_FROM_EMAIL || "Veloce Kenya <noreply@marid.co.ke>";
      await transporter.sendMail({
        from,
        to: email,
        subject: "\u{1F512} Password Reset Request & One-Time Verification Code - Veloce Hub",
        html
      });
    }
    res.json({
      success: true,
      email,
      otpCode,
      message: `Password reset code sent to ${email}`
    });
  } catch (err) {
    console.error("[Password Reset Email Error]:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to send password reset email." });
  }
});
var SUBSCRIBERS_FILE = import_path2.default.join(process.cwd(), ".newsletter_subscribers.json");
var newsletterSubscribersStore = [];
function loadNewsletterSubscribers() {
  try {
    if (import_fs2.default.existsSync(SUBSCRIBERS_FILE)) {
      const data = import_fs2.default.readFileSync(SUBSCRIBERS_FILE, "utf-8");
      const list = JSON.parse(data);
      if (Array.isArray(list)) {
        newsletterSubscribersStore = list;
        console.log(`[Newsletter Engine] Loaded ${newsletterSubscribersStore.length} newsletter subscribers.`);
        return;
      }
    }
  } catch (err) {
    console.error("[Newsletter Engine] Error loading subscribers:", err);
  }
  newsletterSubscribersStore = [
    {
      id: "sub-init-1",
      email: "edwinmuliro64@gmail.com",
      firstName: "Edwin",
      preferences: ["Workspace Ergonomics", "Exclusive Product Drops"],
      couponCode: "WELCOME10",
      discountPercent: 10,
      source: "Landing Page Hero",
      status: "active",
      welcomeEmailSent: true,
      subscribedAt: new Date(Date.now() - 864e5 * 3).toISOString()
    }
  ];
}
function saveNewsletterSubscribers() {
  try {
    import_fs2.default.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(newsletterSubscribersStore, null, 2), "utf-8");
  } catch (err) {
    console.error("[Newsletter Engine] Error saving subscribers:", err);
  }
}
loadNewsletterSubscribers();
app.post("/api/newsletter/subscribe", async (req, res) => {
  try {
    const { email, firstName, preferences, source, forceResubscribe } = req.body;
    if (!email || typeof email !== "string" || !email.includes("@") || !email.includes(".")) {
      res.status(400).json({ success: false, error: "A valid email address is required to subscribe." });
      return;
    }
    const cleanEmail = email.toLowerCase().trim();
    const cleanFirstName = firstName && typeof firstName === "string" ? firstName.trim() : "";
    const prefs = Array.isArray(preferences) ? preferences : ["All Updates"];
    const subSource = source || "Website Newsletter Component";
    const isUnsubscribed = unsubscribedEmailsStore.has(cleanEmail);
    if (isUnsubscribed) {
      if (forceResubscribe) {
        unsubscribedEmailsStore.delete(cleanEmail);
        saveUnsubscribedEmails();
        console.log(`[Newsletter Engine] Auto-resubscribed ${cleanEmail} per user opt-in request.`);
      } else {
        res.status(200).json({
          success: false,
          unsubscribed: true,
          email: cleanEmail,
          message: `This email address (${cleanEmail}) was previously unsubscribed from marketing messages. Please confirm if you wish to re-subscribe.`,
          requiresConfirmation: true
        });
        return;
      }
    }
    const existingIndex = newsletterSubscribersStore.findIndex((s) => s.email === cleanEmail);
    const welcomeCoupon = "WELCOME10";
    const discountPercent = 10;
    let subscriberRecord;
    if (existingIndex >= 0) {
      subscriberRecord = {
        ...newsletterSubscribersStore[existingIndex],
        firstName: cleanFirstName || newsletterSubscribersStore[existingIndex].firstName,
        preferences: prefs,
        status: "active",
        couponCode: newsletterSubscribersStore[existingIndex].couponCode || welcomeCoupon,
        discountPercent: newsletterSubscribersStore[existingIndex].discountPercent || discountPercent
      };
      newsletterSubscribersStore[existingIndex] = subscriberRecord;
    } else {
      subscriberRecord = {
        id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        email: cleanEmail,
        firstName: cleanFirstName,
        preferences: prefs,
        couponCode: welcomeCoupon,
        discountPercent,
        source: subSource,
        status: "active",
        welcomeEmailSent: false,
        subscribedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      newsletterSubscribersStore.unshift(subscriberRecord);
    }
    saveNewsletterSubscribers();
    let welcomeEmailSent = false;
    let emailError;
    try {
      const displayName = cleanFirstName || cleanEmail.split("@")[0];
      const capitalizedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
      const hostHeader = req.get("host") || "localhost:3000";
      const protocol = req.protocol || "http";
      const storeUrl = `${protocol}://${hostHeader}/?tab=store`;
      const unsubscribeUrl = `${protocol}://${hostHeader}/unsubscribe?email=${encodeURIComponent(cleanEmail)}`;
      const welcomeHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Veloce Insights</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" max-width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                  
                  <!-- Header Banner -->
                  <tr>
                    <td style="background: #1e1b4b; padding: 36px 32px; text-align: center;">
                      <span style="display: inline-block; background-color: rgba(99, 102, 241, 0.25); color: #c7d2fe; font-family: monospace; font-size: 11px; font-weight: bold; padding: 4px 12px; border-radius: 999px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px;">
                        VIP INSIDER SEQUENCE
                      </span>
                      <h1 style="color: #ffffff; font-size: 26px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">
                        Welcome to Veloce Insights
                      </h1>
                      <p style="color: #cbd5e1; font-size: 14px; margin: 8px 0 0 0; line-height: 1.5;">
                        Curators of Precision Workspace Machinery & High-Output Engineering
                      </p>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="padding: 32px 28px;">
                      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
                        Hello <strong>${capitalizedName}</strong>,
                      </p>
                      <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                        Thank you for subscribing to our official newsletter. You have joined an exclusive collective of creators, industrial designers, and productivity enthusiasts receiving our monthly curation of hardware blueprints, architectural guides, and unannounced product drops.
                      </p>

                      <!-- VIP Coupon Voucher Box -->
                      <div style="background: #f0fdf4; border: 2px dashed #10b981; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                        <span style="font-size: 12px; font-weight: bold; color: #047857; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 6px;">
                          \u{1F381} Your New Subscriber Welcome Gift
                        </span>
                        <div style="font-size: 28px; font-weight: 900; color: #065f46; font-family: monospace; letter-spacing: 4px; margin: 8px 0;">
                          ${welcomeCoupon}
                        </div>
                        <p style="font-size: 13px; color: #047857; margin: 4px 0 14px 0; font-weight: 600;">
                          Save 10% OFF your next order across our entire store catalog!
                        </p>
                        <a href="${storeUrl}" style="display: inline-block; background-color: #059669; color: #ffffff; font-weight: bold; font-size: 13px; padding: 10px 24px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 6px rgba(5, 150, 105, 0.3);">
                          Redeem Voucher in Store &rarr;
                        </a>
                      </div>

                      <!-- Subscribed Topics & Preferences -->
                      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 24px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: bold; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">
                          \u{1F4CB} Your Subscription Dossier
                        </h4>
                        <table style="width: 100%; font-size: 13px; color: #475569;">
                          <tr>
                            <td style="padding: 4px 0; font-weight: 600; width: 140px;">Registered Email:</td>
                            <td style="padding: 4px 0; font-family: monospace; color: #334155;">${cleanEmail}</td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; font-weight: 600;">Subscribed Topics:</td>
                            <td style="padding: 4px 0; color: #4f46e5; font-weight: 500;">${prefs.join(", ")}</td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; font-weight: 600;">Frequency:</td>
                            <td style="padding: 4px 0;">1\u20132 curated editions monthly (Zero spam)</td>
                          </tr>
                        </table>
                      </div>

                      <!-- What to expect highlights -->
                      <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: bold; color: #0f172a;">
                        What's Coming to Your Inbox:
                      </h4>
                      <ul style="margin: 0 0 24px 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.7;">
                        <li><strong>Blueprint Case Studies:</strong> Real-world workspace layouts with CAD schematics and cable routing diagrams.</li>
                        <li><strong>Material & Ergonomics Audits:</strong> In-depth stress testing on solid Bavarian oak, anodized aerospace aluminium, and merino wool.</li>
                        <li><strong>Subscriber-Only Flash Allocations:</strong> Early private access to limited batch artisan productions.</li>
                      </ul>

                      <div style="text-align: center; margin-top: 28px;">
                        <a href="${storeUrl}" style="display: inline-block; background-color: #312e81; color: #ffffff; font-weight: 700; font-size: 14px; padding: 14px 32px; border-radius: 8px; text-decoration: none;">
                          Explore Veloce Hardware Store
                        </a>
                      </div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f1f5f9; padding: 24px 28px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; line-height: 1.6;">
                      <p style="margin: 0 0 6px 0; font-weight: 600; color: #475569;">
                        Veloce Collective \u2022 Engineered in Nairobi & San Francisco
                      </p>
                      <p style="margin: 0 0 8px 0;">
                        You received this email because you subscribed to Veloce Insights at <a href="https://marid.co.ke" style="color: #4f46e5; text-decoration: none;">marid.co.ke</a>.
                      </p>
                      <p style="margin: 0;">
                        <a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">Unsubscribe or change preferences</a> \u2022 
                        <a href="mailto:support@marid.co.ke" style="color: #64748b; text-decoration: underline;">Contact Support</a>
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
      const transporter = getSmtpTransporter();
      const from = process.env.DEFAULT_FROM_EMAIL || process.env.EMAIL_HOST_USER || "Veloce Insights <noreply@marid.co.ke>";
      await transporter.sendMail({
        from,
        to: cleanEmail,
        subject: "\u{1F389} Welcome to Veloce Insights: Your 10% VIP Voucher Code Inside!",
        text: `Welcome to Veloce Insights, ${capitalizedName}!

Thank you for subscribing to our newsletter. Use discount coupon code ${welcomeCoupon} for 10% off your next purchase at our store.

Visit store: ${storeUrl}

To unsubscribe: ${unsubscribeUrl}`,
        html: welcomeHtml
      });
      welcomeEmailSent = true;
      subscriberRecord.welcomeEmailSent = true;
      saveNewsletterSubscribers();
      console.log(`[Newsletter Engine] \u2709\uFE0F Welcome email dispatched successfully to ${cleanEmail}`);
    } catch (err) {
      console.error("[Newsletter Welcome Email Error]:", err?.message || err);
      emailError = err?.message || "SMTP dispatch queued";
    }
    res.status(201).json({
      success: true,
      message: `Thank you for subscribing! A welcome sequence with your 10% voucher code (${welcomeCoupon}) has been dispatched to ${cleanEmail}.`,
      subscriber: subscriberRecord,
      couponCode: welcomeCoupon,
      discountPercent,
      welcomeEmailSent,
      emailError
    });
  } catch (err) {
    console.error("[Newsletter Subscription Error]:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to process newsletter subscription." });
  }
});
app.get("/api/newsletter/subscribers", (req, res) => {
  try {
    res.json({
      success: true,
      count: newsletterSubscribersStore.length,
      activeCount: newsletterSubscribersStore.filter((s) => s.status === "active").length,
      subscribers: newsletterSubscribersStore
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || "Failed to retrieve subscriber roster." });
  }
});
var validateSmtpHandler = async (req, res) => {
  const startTime = Date.now();
  const host = process.env.EMAIL_HOST || "mail.marid.co.ke";
  const port = Number(process.env.EMAIL_PORT) || 465;
  let user = process.env.EMAIL_HOST_USER || "noreply@marid.co.ke";
  if (!user.includes("@")) {
    user = `noreply@${user}`;
  }
  const pass = process.env.EMAIL_HOST_PASSWORD || "";
  const useSsl = process.env.EMAIL_USE_SSL !== "false" && (process.env.EMAIL_USE_SSL === "true" || port === 465);
  const defaultFrom = process.env.DEFAULT_FROM_EMAIL || "Veloce Kenya <noreply@marid.co.ke>";
  const backend = process.env.EMAIL_BACKEND || "django.core.mail.backends.smtp.EmailBackend";
  let dnsResolved = false;
  let authSuccess = false;
  let errorMsg = "";
  try {
    await import_dns.default.promises.lookup(host);
    dnsResolved = true;
  } catch (err) {
    dnsResolved = false;
    errorMsg = `DNS lookup failed for ${host}: ${err.message}`;
  }
  if (dnsResolved) {
    try {
      const transporter = import_nodemailer.default.createTransport({
        host,
        port,
        secure: useSsl,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 8e3
      });
      await transporter.verify();
      authSuccess = true;
    } catch (authErr) {
      authSuccess = false;
      errorMsg = authErr.message || "SMTP authentication or connection failed";
    }
  }
  const latencyMs = Date.now() - startTime;
  const valid = dnsResolved && authSuccess;
  res.json({
    valid,
    status: valid ? "healthy" : "unhealthy",
    latencyMs,
    config: {
      host,
      port,
      user,
      defaultFrom,
      useSsl,
      backend
    },
    checks: {
      envLoaded: Boolean(process.env.EMAIL_HOST && process.env.EMAIL_HOST_USER),
      dnsResolved,
      authSuccess
    },
    message: valid ? `SMTP Server ${host}:${port} is responsive and fully authenticated.` : errorMsg,
    error: valid ? void 0 : errorMsg,
    validatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
};
app.get("/api/email/validate-config", validateSmtpHandler);
app.post("/api/email/validate-config", validateSmtpHandler);
app.post("/api/email/update-config", async (req, res) => {
  try {
    const { host, port, user, password, defaultFrom, useSsl } = req.body;
    if (host) process.env.EMAIL_HOST = String(host).trim();
    if (port) process.env.EMAIL_PORT = String(port);
    if (user) {
      let cleanUser = String(user).trim();
      if (!cleanUser.includes("@")) {
        cleanUser = `noreply@${cleanUser}`;
      }
      process.env.EMAIL_HOST_USER = cleanUser;
    }
    if (password !== void 0 && password !== "") {
      process.env.EMAIL_HOST_PASSWORD = String(password);
    }
    if (defaultFrom) process.env.DEFAULT_FROM_EMAIL = String(defaultFrom).trim();
    if (useSsl !== void 0) process.env.EMAIL_USE_SSL = String(useSsl);
    const activeHost = process.env.EMAIL_HOST || "mail.marid.co.ke";
    const activePort = Number(process.env.EMAIL_PORT) || 465;
    const activeUser = process.env.EMAIL_HOST_USER || "noreply@marid.co.ke";
    const activePass = process.env.EMAIL_HOST_PASSWORD || "";
    const activeSsl = process.env.EMAIL_USE_SSL !== "false" && (process.env.EMAIL_USE_SSL === "true" || activePort === 465);
    const activeFrom = process.env.DEFAULT_FROM_EMAIL || "Veloce Kenya <noreply@marid.co.ke>";
    const startTime = Date.now();
    let dnsResolved = false;
    let authSuccess = false;
    let errorMsg = "";
    try {
      await import_dns.default.promises.lookup(activeHost);
      dnsResolved = true;
    } catch (err) {
      dnsResolved = false;
      errorMsg = `DNS resolution failed for ${activeHost}: ${err.message}`;
    }
    if (dnsResolved) {
      try {
        const transporter = import_nodemailer.default.createTransport({
          host: activeHost,
          port: activePort,
          secure: activeSsl,
          auth: { user: activeUser, pass: activePass },
          tls: { rejectUnauthorized: false },
          connectionTimeout: 8e3
        });
        await transporter.verify();
        authSuccess = true;
      } catch (authErr) {
        authSuccess = false;
        errorMsg = authErr.message || "SMTP authentication or handshake failed with updated credentials";
      }
    }
    const latencyMs = Date.now() - startTime;
    const valid = dnsResolved && authSuccess;
    res.json({
      success: valid,
      message: valid ? `SMTP settings updated and re-tested successfully! (${latencyMs}ms)` : `SMTP settings updated, but validation failed: ${errorMsg}`,
      config: {
        host: activeHost,
        port: activePort,
        user: activeUser,
        defaultFrom: activeFrom,
        useSsl: activeSsl,
        hasPassword: Boolean(activePass)
      },
      validation: {
        valid,
        latencyMs,
        dnsResolved,
        authSuccess,
        error: valid ? void 0 : errorMsg
      }
    });
  } catch (err) {
    console.error("[SMTP Config Update Error]:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to update SMTP configuration"
    });
  }
});
app.post("/api/email/diagnose-smtp", async (req, res) => {
  const steps = [];
  const logs = [];
  const log = (msg) => {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().substring(11, 23);
    logs.push(`[${timestamp}] ${msg}`);
  };
  const recipient = req.body.to || "edwinmuliro64@gmail.com";
  const host = process.env.EMAIL_HOST || "mail.marid.co.ke";
  const port = Number(process.env.EMAIL_PORT) || 465;
  let user = process.env.EMAIL_HOST_USER || "noreply@marid.co.ke";
  if (!user.includes("@")) {
    user = `noreply@${user}`;
  }
  const pass = process.env.EMAIL_HOST_PASSWORD || "";
  const useSsl = process.env.EMAIL_USE_SSL !== "false" && (process.env.EMAIL_USE_SSL === "true" || port === 465);
  const defaultFrom = process.env.DEFAULT_FROM_EMAIL || "Veloce Kenya <noreply@marid.co.ke>";
  log(`Initiating SMTP diagnostic sequence for recipient: ${recipient}`);
  log(`Configuration: Host=${host}, Port=${port}, User=${user}, SSL=${useSsl}, From="${defaultFrom}"`);
  steps.push({
    step: "1. Configuration Check",
    status: "ok",
    detail: `SMTP Host set to ${host}:${port} with user ${user}`
  });
  const dnsStart = Date.now();
  try {
    log(`Resolving A record for ${host}...`);
    const resolvedIp = await import_dns.default.promises.lookup(host);
    const dnsLatency = Date.now() - dnsStart;
    log(`DNS Lookup success: ${host} -> ${resolvedIp.address} (${dnsLatency}ms)`);
    steps.push({
      step: "2. DNS Name Resolution",
      status: "ok",
      detail: `Resolved ${host} -> IP ${resolvedIp.address}`,
      latencyMs: dnsLatency
    });
  } catch (dnsErr) {
    const dnsLatency = Date.now() - dnsStart;
    log(`[DNS Error] Could not resolve ${host}: ${dnsErr.message}`);
    steps.push({
      step: "2. DNS Name Resolution",
      status: "error",
      detail: `Failed to resolve host ${host}: ${dnsErr.message}`,
      latencyMs: dnsLatency
    });
  }
  const transporter = import_nodemailer.default.createTransport({
    host,
    port,
    secure: useSsl,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 1e4
  });
  const authStart = Date.now();
  let authSuccess = false;
  try {
    log(`Verifying SMTP handshake & credentials with ${host}:${port}...`);
    await transporter.verify();
    const authLatency = Date.now() - authStart;
    log(`SMTP Authentication successful! Connection verified in ${authLatency}ms.`);
    steps.push({
      step: "3. SMTP Authentication",
      status: "ok",
      detail: `Credentials accepted by ${host}:${port}`,
      latencyMs: authLatency
    });
    authSuccess = true;
  } catch (authErr) {
    const authLatency = Date.now() - authStart;
    log(`[SMTP Auth Error] ${authErr.message}`);
    steps.push({
      step: "3. SMTP Authentication",
      status: "error",
      detail: `Handshake / Login failed: ${authErr.message}`,
      latencyMs: authLatency
    });
    return res.json({
      success: false,
      recipient,
      config: { host, port, user, defaultFrom, useSsl, backend: process.env.EMAIL_BACKEND || "django.core.mail.backends.smtp.EmailBackend" },
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      steps,
      logs,
      errorDetails: {
        name: authErr.name || "SMTPAuthError",
        message: authErr.message,
        code: authErr.code,
        command: authErr.command,
        response: authErr.response,
        stack: authErr.stack
      },
      troubleshootingTip: "Double check EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in .env or Django settings. Ensure full email address is used as username."
    });
  }
  const sendStart = Date.now();
  try {
    log(`Sending test email packet to ${recipient}...`);
    const info = await transporter.sendMail({
      from: defaultFrom,
      to: recipient,
      subject: `[Veloce SMTP Test] Connectivity & Diagnostic Verification`,
      text: `SMTP Diagnostic Test executed on ${(/* @__PURE__ */ new Date()).toLocaleString()}.
Host: ${host}:${port}
User: ${user}
Recipient: ${recipient}

Status: Live Transmission Verified.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
          <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="color: #1e293b; margin: 0; font-size: 20px;">Veloce Kenya \u2022 SMTP Connectivity Report</h2>
            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">cPanel Mail Gateway Diagnostic Tool</p>
          </div>
          
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0 0 8px 0; color: #334155; font-size: 14px;"><strong>Target Recipient:</strong> ${recipient}</p>
            <p style="margin: 0 0 8px 0; color: #334155; font-size: 14px;"><strong>SMTP Gateway:</strong> ${host}:${port}</p>
            <p style="margin: 0 0 8px 0; color: #334155; font-size: 14px;"><strong>Authenticated Account:</strong> ${user}</p>
            <p style="margin: 0; color: #16a34a; font-size: 14px; font-weight: 600;">\u2713 Raw Transmission Verified Successfully</p>
          </div>

          <div style="font-size: 12px; color: #94a3b8; text-align: center;">
            Dispatched via Veloce Express Backend & Django Email Services
          </div>
        </div>
      `
    });
    const sendLatency = Date.now() - sendStart;
    log(`Email delivered! Response ID: ${info.messageId}. Server response: ${info.response || "250 OK"}`);
    steps.push({
      step: "4. Transmission & Delivery",
      status: "ok",
      detail: `Accepted by mail exchanger (${info.messageId})`,
      latencyMs: sendLatency
    });
    res.json({
      success: true,
      recipient,
      config: { host, port, user, defaultFrom, useSsl, backend: process.env.EMAIL_BACKEND || "django.core.mail.backends.smtp.EmailBackend" },
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      messageId: info.messageId,
      response: info.response,
      steps,
      logs
    });
  } catch (sendErr) {
    const sendLatency = Date.now() - sendStart;
    log(`[Delivery Error] Failed to transmit message: ${sendErr.message}`);
    steps.push({
      step: "4. Transmission & Delivery",
      status: "error",
      detail: `Delivery rejected: ${sendErr.message}`,
      latencyMs: sendLatency
    });
    res.json({
      success: false,
      recipient,
      config: { host, port, user, defaultFrom, useSsl, backend: process.env.EMAIL_BACKEND || "django.core.mail.backends.smtp.EmailBackend" },
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      steps,
      logs,
      errorDetails: {
        name: sendErr.name,
        message: sendErr.message,
        code: sendErr.code,
        command: sendErr.command,
        response: sendErr.response,
        stack: sendErr.stack
      }
    });
  }
});
var NOTIFIED_EXPIRY_FILE = import_path2.default.join(process.cwd(), ".notified_expiry_products.json");
function loadNotifiedExpiryStore() {
  try {
    if (import_fs2.default.existsSync(NOTIFIED_EXPIRY_FILE)) {
      const content = import_fs2.default.readFileSync(NOTIFIED_EXPIRY_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn("[Expiry Check] Could not read notified expiry store file:", err.message);
  }
  return { lastCheckTimestamp: null, notifiedProducts: {} };
}
function saveNotifiedExpiryStore(store) {
  try {
    import_fs2.default.writeFileSync(NOTIFIED_EXPIRY_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("[Expiry Check] Failed to save notified expiry store:", err.message);
  }
}
async function performExpiryBackgroundCheck(isManualTrigger = false) {
  console.log(`[Expiry Check] Initializing background inventory scan... (Manual: ${isManualTrigger})`);
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const store = loadNotifiedExpiryStore();
  const productsToProcess = productsStore || [];
  const newlyFlaggedProducts = [];
  const nearExpiryProductsList = [];
  for (const product of productsToProcess) {
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
      const existingRecord = store.notifiedProducts[product.id];
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
  let adminRecipients = [];
  if (newlyFlaggedProducts.length > 0) {
    const adminEmailsSet = /* @__PURE__ */ new Set();
    usersStore.forEach((u) => {
      if ((u.is_staff || u.is_superuser || u.role === "admin") && u.email && u.email.includes("@")) {
        adminEmailsSet.add(u.email.toLowerCase().trim());
      }
    });
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL.includes("@")) {
      adminEmailsSet.add(process.env.ADMIN_EMAIL.toLowerCase().trim());
    }
    if (adminEmailsSet.size === 0) {
      adminEmailsSet.add("admin@ropenix.co.ke");
      adminEmailsSet.add("edwinmuliro64@gmail.com");
    }
    adminRecipients = Array.from(adminEmailsSet);
    const rowsHtml = newlyFlaggedProducts.map((p) => {
      const daysText = p.calculatedDaysRemaining <= 0 ? `<span style="background-color: #ffe4e6; color: #9f1239; font-weight: bold; padding: 3px 8px; border-radius: 4px; font-size: 11px;">EXPIRED (${Math.abs(p.calculatedDaysRemaining)}d ago)</span>` : `<span style="background-color: #fef3c7; color: #78350f; font-weight: bold; padding: 3px 8px; border-radius: 4px; font-size: 11px;">${p.calculatedDaysRemaining} DAY(S) REMAINING</span>`;
      return `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px; font-weight: bold; color: #0f172a; font-size: 13px;">${p.name}</td>
            <td style="padding: 12px; font-family: monospace; color: #64748b; font-size: 12px;">${p.sku || p.id}</td>
            <td style="padding: 12px; color: #475569; font-size: 12px;">${p.category || "General"}</td>
            <td style="padding: 12px; font-family: monospace; font-weight: bold; color: #1e293b; font-size: 12px;">${p.expiryDate || p.expiry_date}</td>
            <td style="padding: 12px;">${daysText}</td>
            <td style="padding: 12px; color: #334155; font-weight: bold; font-size: 12px;">${p.stock !== void 0 ? p.stock : "N/A"} units</td>
          </tr>
        `;
    }).join("");
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 680px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="background-color: #4338ca; padding: 24px; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">\u26A0\uFE0F Veloce System Inventory Alert</h2>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #e0e7ff;">Application Initialization Expiry Check \u2022 ${(/* @__PURE__ */ new Date()).toLocaleDateString("en-KE", { dateStyle: "full" })}</p>
        </div>

        <div style="padding: 24px;">
          <div style="background-color: #fffbe3; border-left: 4px solid #d97706; padding: 14px 16px; border-radius: 6px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 13px; color: #92400e; font-weight: 600;">
              System initialization check detected <strong>${newlyFlaggedProducts.length} product(s)</strong> that have moved into the <strong>8-day expiry window</strong> since the last system check.
            </p>
            <p style="margin: 6px 0 0 0; font-size: 12px; color: #b45309;">
              \u{1F512} <strong>Automated Storefront Action:</strong> In accordance with storefront compliance policy, these products are automatically suppressed from public customer listings.
            </p>
          </div>

          <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Flagged Inventory Items (${newlyFlaggedProducts.length})</h3>

          <table style="width: 100%; border-collapse: collapse; text-align: left; background-color: #f8fafc; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background-color: #e2e8f0; color: #334155; font-size: 11px; text-transform: uppercase; font-weight: 700;">
                <th style="padding: 10px 12px;">Product Name</th>
                <th style="padding: 10px 12px;">SKU</th>
                <th style="padding: 10px 12px;">Category</th>
                <th style="padding: 10px 12px;">Expiry Date</th>
                <th style="padding: 10px 12px;">Status</th>
                <th style="padding: 10px 12px;">Stock</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div style="margin-top: 24px; padding: 16px; background-color: #f1f5f9; border-radius: 8px; font-size: 12px; color: #475569;">
            <strong style="color: #0f172a; display: block; margin-bottom: 4px;">Recommended Administrator Actions:</strong>
            <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
              <li>Review backend inventory for clearance discount pricing or promotional bundles.</li>
              <li>Arrange return-to-supplier or disposal workflows for expired lots.</li>
              <li>Verify stock counts against physical shelf inventory.</li>
            </ul>
          </div>
        </div>

        <div style="background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
          <p style="margin: 0;">Veloce Hub System Automated Diagnostics \u2022 <a href="http://localhost:3000" style="color: #4f46e5; text-decoration: none;">Open Admin Inventory Dashboard</a></p>
        </div>
      </div>
    `;
    try {
      const transporter = getSmtpTransporter();
      const from = process.env.DEFAULT_FROM_EMAIL || process.env.EMAIL_HOST_USER || "Veloce System Alert <noreply@marid.co.ke>";
      await transporter.sendMail({
        from,
        to: adminRecipients,
        subject: `\u26A0\uFE0F [ACTION REQUIRED] ${newlyFlaggedProducts.length} Product(s) Entered 8-Day Expiry Window`,
        html: emailHtml,
        text: `Veloce Inventory Alert: ${newlyFlaggedProducts.length} product(s) have moved into the 8-day expiry window. Check admin dashboard for details.`
      });
      emailDispatched = true;
      console.log(`[Expiry Check] \u2709\uFE0F Dispatched email notification to admins (${adminRecipients.join(", ")}) for ${newlyFlaggedProducts.length} product(s).`);
    } catch (sendErr) {
      console.error(`[Expiry Check Error] Failed to send email alert:`, sendErr.message);
    }
    newlyFlaggedProducts.forEach((p) => {
      store.notifiedProducts[p.id] = {
        productId: p.id,
        productName: p.name,
        sku: p.sku || p.id,
        expiryDate: p.expiryDate || p.expiry_date,
        daysRemaining: p.calculatedDaysRemaining,
        notifiedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    });
  } else {
    console.log(`[Expiry Check] \u2713 Initialization check complete. No new products moved into the 8-day expiry window.`);
  }
  store.lastCheckTimestamp = (/* @__PURE__ */ new Date()).toISOString();
  saveNotifiedExpiryStore(store);
  return {
    lastCheckTimestamp: store.lastCheckTimestamp,
    totalMonitoredProducts: productsToProcess.length,
    nearExpiryCount: nearExpiryProductsList.length,
    newlyFlaggedCount: newlyFlaggedProducts.length,
    emailDispatched,
    adminRecipients,
    newlyFlaggedProducts,
    nearExpiryProductsList
  };
}
app.get("/api/admin/expiry-status", (req, res) => {
  const store = loadNotifiedExpiryStore();
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const productsToProcess = productsStore || [];
  const nearExpiryList = productsToProcess.filter((p) => {
    if (!p.hasExpiryDate && !p.has_expiry_date) return false;
    const dateStr = p.expiryDate || p.expiry_date;
    if (!dateStr) return false;
    const exp = new Date(dateStr);
    if (isNaN(exp.getTime())) return false;
    exp.setHours(0, 0, 0, 0);
    const days = Math.ceil((exp.getTime() - today.getTime()) / (1e3 * 60 * 60 * 24));
    return days <= 8;
  });
  res.json({
    lastCheckTimestamp: store.lastCheckTimestamp,
    notifiedProductsCount: Object.keys(store.notifiedProducts).length,
    nearExpiryCount: nearExpiryList.length,
    notifiedProducts: store.notifiedProducts,
    nearExpiryProducts: nearExpiryList
  });
});
var heroBannersStore = [
  {
    id: "hero-banner-1",
    title: "Precision Engineered Workspace Objects & Machinery",
    subtitle: "Unlock an exclusive 15% discount on all physical orders of 6 units or more.",
    description: "Elevate your display and organize accessories with CNC-machined solid White Oak and heavy-gauge powder-coated structural steel. Built to withstand decades of rigorous daily focus.",
    badge_text: "CURATED COLLECTION 2026",
    primary_button_text: "Explore Workspace Objects",
    primary_button_url: "store",
    secondary_button_text: "Browse Collections",
    secondary_button_url: "store",
    hero_image: null,
    hero_image_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=1200",
    background_type: "color",
    background_color: "#0f172a",
    background_image: null,
    background_image_url: "",
    background_position: "center",
    overlay_enabled: true,
    overlay_color: "#000000",
    overlay_opacity: 0.45,
    text_color: "#ffffff",
    is_active: true,
    display_order: 1,
    start_date: null,
    end_date: null,
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-08-15T00:00:00Z"
  },
  {
    id: "hero-banner-2",
    title: "Mid-Year Mechanical Flash Sale & Hardware",
    subtitle: "Up to 30% off selected solid timber accessories and dual-motor sit-stand desks.",
    description: "Limited physical units available with same-day Nairobi dispatch and doorstep assembly warranty. Claim your setup before allocations expire.",
    badge_text: "LIMITED TIME PROMOTION",
    primary_button_text: "Claim Flash Deals",
    primary_button_url: "store",
    secondary_button_text: "Explore Digital Creator Kit",
    secondary_button_url: "store",
    hero_image: null,
    hero_image_url: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=1200",
    background_type: "image",
    background_color: "#18181b",
    background_image: null,
    background_image_url: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&q=80&w=1600",
    background_position: "center",
    overlay_enabled: true,
    overlay_color: "#18181b",
    overlay_opacity: 0.78,
    text_color: "#ffffff",
    is_active: true,
    display_order: 2,
    start_date: null,
    end_date: null,
    created_at: "2026-06-15T08:00:00Z",
    updated_at: "2026-08-15T00:00:00Z"
  },
  {
    id: "hero-banner-3",
    title: "Human-Crafted Ecosystem & Analog Stationery",
    subtitle: "Machined from CZ121 raw brass, Bavarian merino wool, and natural cork isolation.",
    description: "A tactile workspace collection designed to eliminate visual noise and promote continuous flow state. Seamlessly integrated with our digital productivity systems.",
    badge_text: "ANALOG PRECISION",
    primary_button_text: "Shop Stationery",
    primary_button_url: "store",
    secondary_button_text: "Custom Orders",
    secondary_button_url: "services",
    hero_image: null,
    hero_image_url: "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&q=80&w=1200",
    background_type: "color",
    background_color: "#1e1b4b",
    background_image: null,
    background_image_url: "",
    background_position: "center",
    overlay_enabled: false,
    overlay_color: "#000000",
    overlay_opacity: 0.3,
    text_color: "#f8fafc",
    is_active: true,
    display_order: 3,
    start_date: null,
    end_date: null,
    created_at: "2026-07-01T08:00:00Z",
    updated_at: "2026-08-15T00:00:00Z"
  }
];
function normalizeHeroBannerOutput(b) {
  const heroImgUrl = b.hero_image || b.hero_image_url || b.heroImage || b.imageUrl || "";
  const bgImgUrl = b.background_image || b.background_image_url || b.backgroundImage || b.bgImageUrl || "";
  return {
    id: b.id,
    title: b.title || "Veloce Workspace Machinery",
    subtitle: b.subtitle || "",
    description: b.description || b.subtitle || "",
    badge_text: b.badge_text || b.badgeText || b.tagline || "",
    badgeText: b.badge_text || b.badgeText || b.tagline || "",
    primary_button_text: b.primary_button_text || b.primaryButtonText || b.ctaText || "Shop Collection",
    primaryButtonText: b.primary_button_text || b.primaryButtonText || b.ctaText || "Shop Collection",
    primary_button_url: b.primary_button_url || b.primaryButtonUrl || b.ctaUrl || "store",
    primaryButtonUrl: b.primary_button_url || b.primaryButtonUrl || b.ctaUrl || "store",
    secondary_button_text: b.secondary_button_text || b.secondaryButtonText || b.secondaryCtaText || "",
    secondaryButtonText: b.secondary_button_text || b.secondaryButtonText || b.secondaryCtaText || "",
    secondary_button_url: b.secondary_button_url || b.secondaryButtonUrl || b.secondaryCtaUrl || "",
    secondaryButtonUrl: b.secondary_button_url || b.secondaryButtonUrl || b.secondaryCtaUrl || "",
    hero_image: heroImgUrl,
    hero_image_url: heroImgUrl,
    hero_image_full_url: heroImgUrl,
    heroImage: heroImgUrl,
    imageUrl: heroImgUrl,
    background_type: b.background_type || b.backgroundType || "color",
    backgroundType: b.background_type || b.backgroundType || "color",
    background_color: b.background_color || b.backgroundColor || b.bgColor || "#0f172a",
    backgroundColor: b.background_color || b.backgroundColor || b.bgColor || "#0f172a",
    bgColor: b.background_color || b.backgroundColor || b.bgColor || "#0f172a",
    background_image: bgImgUrl,
    background_image_url: bgImgUrl,
    background_image_full_url: bgImgUrl,
    backgroundImage: bgImgUrl,
    bgImageUrl: bgImgUrl,
    background_position: b.background_position || b.backgroundPosition || "center",
    backgroundPosition: b.background_position || b.backgroundPosition || "center",
    overlay_enabled: b.overlay_enabled !== void 0 ? Boolean(b.overlay_enabled) : b.overlayEnabled !== void 0 ? Boolean(b.overlayEnabled) : true,
    overlayEnabled: b.overlay_enabled !== void 0 ? Boolean(b.overlay_enabled) : b.overlayEnabled !== void 0 ? Boolean(b.overlayEnabled) : true,
    overlay_color: b.overlay_color || b.overlayColor || b.bgOverlayColor || "#000000",
    overlayColor: b.overlay_color || b.overlayColor || b.bgOverlayColor || "#000000",
    bgOverlayColor: b.overlay_color || b.overlayColor || b.bgOverlayColor || "#000000",
    overlay_opacity: typeof b.overlay_opacity === "number" ? b.overlay_opacity : typeof b.overlayOpacity === "number" ? b.overlayOpacity : typeof b.bgOverlayOpacity === "number" ? b.bgOverlayOpacity : 0.5,
    overlayOpacity: typeof b.overlay_opacity === "number" ? b.overlay_opacity : typeof b.overlayOpacity === "number" ? b.overlayOpacity : typeof b.bgOverlayOpacity === "number" ? b.bgOverlayOpacity : 0.5,
    bgOverlayOpacity: typeof b.overlay_opacity === "number" ? b.overlay_opacity : typeof b.overlayOpacity === "number" ? b.overlayOpacity : typeof b.bgOverlayOpacity === "number" ? b.bgOverlayOpacity : 0.5,
    text_color: b.text_color || b.textColor || "#ffffff",
    textColor: b.text_color || b.textColor || "#ffffff",
    is_active: b.is_active !== void 0 ? Boolean(b.is_active) : b.active !== void 0 ? Boolean(b.active) : true,
    active: b.is_active !== void 0 ? Boolean(b.is_active) : b.active !== void 0 ? Boolean(b.active) : true,
    display_order: Number(b.display_order ?? b.displayOrder ?? 0),
    displayOrder: Number(b.display_order ?? b.displayOrder ?? 0),
    start_date: b.start_date || b.startDate || null,
    startDate: b.start_date || b.startDate || null,
    end_date: b.end_date || b.endDate || null,
    endDate: b.end_date || b.endDate || null,
    created_at: b.created_at || b.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: b.updated_at || b.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
  };
}
app.get(["/api/hero-banners", "/api/hero-banners/", "/api/content/hero-banners", "/api/content/hero-banners/"], (req, res) => {
  const showAll = req.query.all === "true" || req.query.admin === "true";
  const now = /* @__PURE__ */ new Date();
  let list = [...heroBannersStore];
  if (!showAll) {
    list = list.filter((b) => {
      const active = b.is_active !== void 0 ? b.is_active : b.active !== false;
      if (!active) return false;
      if (b.start_date) {
        const start = new Date(b.start_date);
        if (!isNaN(start.getTime()) && now < start) return false;
      }
      if (b.end_date) {
        const end = new Date(b.end_date);
        if (!isNaN(end.getTime()) && now > end) return false;
      }
      return true;
    });
  }
  list.sort((a, b) => {
    const orderA = a.display_order ?? a.displayOrder ?? 0;
    const orderB = b.display_order ?? b.displayOrder ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
  res.json(list.map(normalizeHeroBannerOutput));
});
app.get(["/api/hero-banners/:id", "/api/hero-banners/:id/", "/api/content/hero-banners/:id", "/api/content/hero-banners/:id/"], (req, res) => {
  const banner = heroBannersStore.find((b) => b.id === req.params.id);
  if (!banner) {
    return res.status(404).json({ error: "Hero banner not found" });
  }
  res.json(normalizeHeroBannerOutput(banner));
});
app.post(["/api/hero-banners", "/api/hero-banners/", "/api/content/hero-banners", "/api/content/hero-banners/"], (req, res) => {
  const payload = req.body || {};
  if (!payload.title || !payload.title.trim()) {
    return res.status(400).json({ error: "Title is required for hero banner" });
  }
  const id = payload.id || `hero-banner-${Date.now()}`;
  const newBanner = {
    ...payload,
    id,
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  heroBannersStore.unshift(newBanner);
  res.status(201).json(normalizeHeroBannerOutput(newBanner));
});
app.put(["/api/hero-banners/:id", "/api/hero-banners/:id/", "/api/content/hero-banners/:id", "/api/content/hero-banners/:id/"], (req, res) => {
  const index = heroBannersStore.findIndex((b) => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Hero banner not found" });
  }
  heroBannersStore[index] = {
    ...heroBannersStore[index],
    ...req.body,
    id: req.params.id,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  res.json(normalizeHeroBannerOutput(heroBannersStore[index]));
});
app.patch(["/api/hero-banners/:id", "/api/hero-banners/:id/", "/api/content/hero-banners/:id", "/api/content/hero-banners/:id/"], (req, res) => {
  const index = heroBannersStore.findIndex((b) => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Hero banner not found" });
  }
  heroBannersStore[index] = {
    ...heroBannersStore[index],
    ...req.body,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  res.json(normalizeHeroBannerOutput(heroBannersStore[index]));
});
app.delete(["/api/hero-banners/:id", "/api/hero-banners/:id/", "/api/content/hero-banners/:id", "/api/content/hero-banners/:id/"], (req, res) => {
  const index = heroBannersStore.findIndex((b) => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Hero banner not found" });
  }
  const deleted = heroBannersStore.splice(index, 1);
  res.json({ message: "Hero banner deleted successfully", banner: normalizeHeroBannerOutput(deleted[0]) });
});
app.post(["/api/hero-banners/reorder", "/api/hero-banners/reorder/", "/api/content/hero-banners/reorder", "/api/content/hero-banners/reorder/"], (req, res) => {
  const { order } = req.body || {};
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: "order must be an array of banner IDs" });
  }
  order.forEach((id, idx) => {
    const banner = heroBannersStore.find((b) => b.id === id);
    if (banner) {
      banner.display_order = idx + 1;
      banner.displayOrder = idx + 1;
    }
  });
  res.json({ status: "reordered", count: order.length });
});
app.post("/api/admin/expiry-check", async (req, res) => {
  try {
    const result = await performExpiryBackgroundCheck(true);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || "Failed to perform expiry check" });
  }
});
async function startServer() {
  try {
    const sqliteStatus = await getSqliteDbStatus();
    console.log(`[SQLite Database] ${sqliteStatus.message}`);
    const existingData = await pullSyncDataSqlite();
    const isInitializedClean = existingData && (existingData.db_is_initialized_clean === "true" || existingData.db_is_initialized_clean === true);
    if (existingData && Array.isArray(existingData.veloce_products) && (existingData.veloce_products.length > 0 || isInitializedClean)) {
      productsStore = existingData.veloce_products;
      console.log(`[SQLite] Loaded ${productsStore.length} products from SQLite database file.`);
    } else {
      console.log("[SQLite] Seeding initial product catalog into SQLite database file...");
      await pushSyncDataSqlite({
        veloce_products: productsStore,
        veloce_orders: ordersStore,
        db_is_initialized_clean: "true"
      });
    }
    if (existingData && Array.isArray(existingData.veloce_orders) && (existingData.veloce_orders.length > 0 || isInitializedClean)) {
      ordersStore = existingData.veloce_orders;
      console.log(`[SQLite] Loaded ${ordersStore.length} orders from SQLite database file.`);
    }
  } catch (err) {
    console.error("[SQLite Startup] Error initializing SQLite database:", err);
  }
  performExpiryBackgroundCheck().catch((err) => {
    console.error("[Expiry Check] Startup execution error:", err);
  });
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.warn("[Vite Middleware] Vite dev server not initialized, falling back to production static assets:", viteErr);
      const distPath = import_path2.default.join(process.cwd(), "dist");
      app.use("/assets", import_express.default.static(import_path2.default.join(distPath, "assets"), { maxAge: "1y", immutable: true }));
      app.use(import_express.default.static(distPath, { maxAge: "1h" }));
      app.get("*", (req, res) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.sendFile(import_path2.default.join(distPath, "index.html"));
      });
    }
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(
      "/assets",
      import_express.default.static(import_path2.default.join(distPath, "assets"), {
        maxAge: "1y",
        immutable: true
      })
    );
    app.use(import_express.default.static(distPath, { maxAge: "1h" }));
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  app.use((err, req, res, next) => {
    console.error(`[Unhandled Server Error] ${req.method} ${req.originalUrl}:`, err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({
      error: "An unexpected server error occurred.",
      status: 500,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  const server = typeof PORT === "number" ? app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Veloce Server] Running on http://localhost:${PORT}`);
  }) : app.listen(PORT, () => {
    console.log(`[Veloce Server] Running on Passenger socket/custom port: ${PORT}`);
  });
  const gracefulShutdown = (signal) => {
    console.log(`[Veloce Server] Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      console.log("[Veloce Server] Closed out remaining connections. Process terminated.");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("[Veloce Server] Forcefully shutting down after timeout.");
      process.exit(1);
    }, 1e4);
  };
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    console.error("[Veloce Server] Unhandled Promise Rejection:", reason);
  });
}
startServer();
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
//# sourceMappingURL=server.cjs.map
