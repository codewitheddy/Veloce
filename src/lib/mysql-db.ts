/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

let dbPool: mysql.Pool | null = null;
let isInitialized = false;

// Clean up and sanitize database host string
export function getDbHost(): string {
  let host = (process.env.DB_HOST || "").trim();
  if (host === "localhhost") {
    host = "localhost";
  }
  return host;
}

// Return true if MySQL credentials are fully set up
export function isDbConfigured(): boolean {
  const host = getDbHost();
  const user = (process.env.DB_USER || "").trim();
  const db = (process.env.DB_NAME || "").trim();
  return !!(host && user && db);
}

// Get or initialize connection pool
export async function getDbPool(): Promise<mysql.Pool | null> {
  if (!isDbConfigured()) {
    return null;
  }

  if (!dbPool) {
    const host = getDbHost();
    try {
      dbPool = mysql.createPool({
        host: host,
        port: Number(process.env.DB_PORT) || 3306,
        user: (process.env.DB_USER || "").trim(),
        password: process.env.DB_PASSWORD,
        database: (process.env.DB_NAME || "").trim(),
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 5000,
      });

      // Test connection
      const connection = await dbPool.getConnection();
      console.log("[MySQL] Successfully connected to production database.");
      connection.release();

      await initializeDatabaseSchema();
    } catch (error: any) {
      console.warn("[MySQL] Connection pool creation attempt failed:", error.message || error);
      if (dbPool) {
        try {
          await dbPool.end();
        } catch (_) {}
      }
      dbPool = null;
      throw error;
    }
  }

  return dbPool;
}

// Initialize database tables if they do not exist
async function initializeDatabaseSchema() {
  if (isInitialized || !dbPool) return;

  try {
    console.log("[MySQL] Initializing database tables...");

    // 1. Products Table
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

    // Safe column additions for newer product features (if tables already existed)
    try {
      await dbPool.query("ALTER TABLE products ADD COLUMN paymentRestriction VARCHAR(50) DEFAULT 'both'");
    } catch (_) {}
    try {
      await dbPool.query("ALTER TABLE products ADD COLUMN shortDescription TEXT NULL");
    } catch (_) {}
    try {
      await dbPool.query("ALTER TABLE products ADD COLUMN detailedDescription LONGTEXT NULL");
    } catch (_) {}
    try {
      await dbPool.query("ALTER TABLE products ADD COLUMN features TEXT NULL");
    } catch (_) {}
    try {
      await dbPool.query("ALTER TABLE products ADD COLUMN specifications TEXT NULL");
    } catch (_) {}
    try {
      await dbPool.query("ALTER TABLE products ADD COLUMN whatsInTheBox TEXT NULL");
    } catch (_) {}

    // 2. Orders Table
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

    // Safe column addition for payment method (if table already existed)
    try {
      await dbPool.query("ALTER TABLE orders ADD COLUMN paymentMethod VARCHAR(50) DEFAULT 'cod'");
    } catch (_) {}

    // 4. Campaigns Table
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

    // 5. Click Logs Table
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

    // 6. Inventory Audit Logs Table
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

    // 7. App Settings Table
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

// Check database connection and return descriptive details
export async function getDbStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  message: string;
  stats?: Record<string, number>;
}> {
  if (!isDbConfigured()) {
    return {
      configured: false,
      connected: false,
      message: "MySQL configuration variables are missing in your environment variables (.env). Please set DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME.",
    };
  }

  try {
    const pool = await getDbPool();
    if (!pool) {
      return {
        configured: true,
        connected: false,
        message: "Configuration found, but unable to establish connection pool.",
      };
    }

    // Query counts
    const [prodCount]: any = await pool.query("SELECT COUNT(*) as count FROM products");
    const [orderCount]: any = await pool.query("SELECT COUNT(*) as count FROM orders");

    return {
      configured: true,
      connected: true,
      message: "Successfully connected to production MySQL database.",
      stats: {
        products: prodCount[0]?.count || 0,
        orders: orderCount[0]?.count || 0,
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

// Save complete app data block (Push synchronization)
export async function pushSyncData(payload: Record<string, any>): Promise<void> {
  const pool = await getDbPool();
  if (!pool) {
    throw new Error("Database is not configured or connected.");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Sync Products
    if (Array.isArray(payload.veloce_products)) {
      // Clear existing first for simple overwrite-sync
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
            p.status || "Active",
            p.paymentRestriction || 'both',
            p.shortDescription || null,
            p.detailedDescription || null,
            p.features ? JSON.stringify(p.features) : null,
            p.specifications ? JSON.stringify(p.specifications) : null,
            p.whatsInTheBox || null,
          ]
        );
      }
    }

    // 2. Sync Orders
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
            o.date || new Date().toISOString(),
            o.couponCode || null,
            o.customNote || null,
            o.shippingAddress || null,
            o.notesHistory ? JSON.stringify(o.notesHistory) : null,
            o.statusHistory ? JSON.stringify(o.statusHistory) : null,
            o.isGuest ? 1 : 0,
            o.paymentMethod || 'cod',
          ]
        );
      }
    }

    // 3. Sync Campaigns
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
            c.status || "active",
          ]
        );
      }
    }

    // 4. Sync Click Logs
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
            cl.commission || 0,
          ]
        );
      }
    }

    // 5. Sync Inventory Audit Logs
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
            il.details || null,
          ]
        );
      }
    }

    // 6. Store global app settings (coupons, loyalty, earnings, promo_banner, support_tickets, payout_logs)
    const settingsKeys = [
      'veloce_cart',
      'veloce_wishlist',
      'veloce_earnings',
      'veloce_loyalty_points',
      'veloce_coupons',
      'veloce_promo_banner',
      'customer_support_tickets',
      'veloce_referral_history',
      'veloce_referral_balances',
      'is_joined_affiliate',
      'veloce_payout_logs'
    ];

    for (const key of settingsKeys) {
      if (payload[key] !== undefined && payload[key] !== null) {
        const valueStr = typeof payload[key] === 'object' ? JSON.stringify(payload[key]) : String(payload[key]);
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

// Pull complete app data block (Pull synchronization)
export async function pullSyncData(): Promise<Record<string, any>> {
  const pool = await getDbPool();
  if (!pool) {
    throw new Error("Database is not configured or connected.");
  }

  const result: Record<string, any> = {};

  try {
    // 1. Get Products
    const [productsRows]: any = await pool.query("SELECT * FROM products");
    result.veloce_products = productsRows.map((p: any) => ({
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
      lowStockThreshold: p.lowStockThreshold !== null ? Number(p.lowStockThreshold) : undefined,
      variations: p.variations ? JSON.parse(p.variations) : [],
      rating: Number(p.rating),
      reviewsCount: Number(p.reviewsCount),
      reviews: p.reviews ? JSON.parse(p.reviews) : [],
      digitalFileUrl: p.digitalFileUrl || undefined,
      previousPrice: p.previousPrice !== null ? Number(p.previousPrice) : undefined,
      backInStockAlert: !!p.backInStockAlert,
      costPrice: p.costPrice !== null ? Number(p.costPrice) : undefined,
      taxId: p.taxId || undefined,
      status: p.status || "Active",
      paymentRestriction: p.paymentRestriction || 'both',
      shortDescription: p.shortDescription || undefined,
      detailedDescription: p.detailedDescription || undefined,
      features: p.features ? JSON.parse(p.features) : undefined,
      specifications: p.specifications ? JSON.parse(p.specifications) : undefined,
      whatsInTheBox: p.whatsInTheBox || undefined,
    }));

    // 2. Get Orders
    const [ordersRows]: any = await pool.query("SELECT * FROM orders");
    result.veloce_orders = ordersRows.map((o: any) => ({
      id: o.id,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      items: o.items ? JSON.parse(o.items) : [],
      total: Number(o.total),
      status: o.status,
      date: o.date,
      couponCode: o.couponCode || undefined,
      customNote: o.customNote || undefined,
      shippingAddress: o.shippingAddress || undefined,
      notesHistory: o.notesHistory ? JSON.parse(o.notesHistory) : [],
      statusHistory: o.statusHistory ? JSON.parse(o.statusHistory) : [],
      isGuest: !!o.isGuest,
      paymentMethod: o.paymentMethod || 'cod',
    }));

    // 4. Get Campaigns
    const [campaignsRows]: any = await pool.query("SELECT * FROM campaigns");
    result.veloce_campaigns = campaignsRows.map((c: any) => ({
      id: c.id,
      name: c.name,
      source: c.source,
      clicks: Number(c.clicks),
      conversions: Number(c.conversions),
      earnings: Number(c.earnings),
      status: c.status || "active",
    }));

    // 5. Get Click Logs
    const [clickLogsRows]: any = await pool.query("SELECT * FROM click_logs");
    result.veloce_clicklogs = clickLogsRows.map((cl: any) => ({
      id: cl.id,
      timestamp: cl.timestamp,
      targetId: cl.targetId,
      targetName: cl.targetName,
      targetType: cl.targetType,
      campaignName: cl.campaignName || undefined,
      source: cl.source,
      converted: !!cl.converted,
      commission: Number(cl.commission),
    }));

    // 6. Get Inventory Audit Logs
    const [inventoryAuditRows]: any = await pool.query("SELECT * FROM inventory_audit_logs");
    result.veloce_inventory_audit_logs = inventoryAuditRows.map((il: any) => ({
      id: il.id,
      productId: il.productId,
      productName: il.productName,
      productSku: il.productSku,
      timestamp: il.timestamp,
      changeQuantity: Number(il.changeQuantity),
      newStock: Number(il.newStock),
      reason: il.reason,
      details: il.details || undefined,
    }));

    // 7. Get App Settings
    const [settingsRows]: any = await pool.query("SELECT * FROM app_settings");
    settingsRows.forEach((row: any) => {
      try {
        result[row.setting_key] = JSON.parse(row.setting_value);
      } catch (e) {
        const val = row.setting_value;
        if (val === 'true') result[row.setting_key] = true;
        else if (val === 'false') result[row.setting_key] = false;
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
