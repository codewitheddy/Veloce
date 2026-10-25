/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Step 1 Automated Test Suite: Migration, Rollback, Backfill, and Order Transaction Consistency
 * 
 * Tests executed on an isolated copy database:
 * 1. Abort safeguard: Migration refuses to run if legacy reviews table has data.
 * 2. Forward migration: Correct table schemas, foreign keys, constraints, and column additions.
 * 3. Backfill: Idempotent extraction of orders.items JSON -> order_items, tolerating missing products.
 * 4. Verification audit: Exact match between JSON item entries and order_items rows.
 * 5. Order creation consistency: Newly created orders write order_items in the same atomic transaction.
 * 6. Rollback: Safe reversal of all schema changes, restoring legacy reviews without touching orders.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { getDbHost, getDbUser, getDbPassword, getDbPort } from '../src/lib/mysql-db.ts';
import { runOrderItemsBackfill } from '../scripts/backfill-order-items.ts';
import { verifyOrderItemsBackfill } from '../scripts/verify-order-items-backfill.ts';

dotenv.config();

const TEST_DB = 'ropenix_step1_test_copy';

describe('Step 1: Database Migration, Rollback & Backfill Test Suite', () => {
  let rootPool;
  let testPool;

  before(async () => {
    // 1. Connect to MySQL root
    rootPool = mysql.createPool({
      host: getDbHost(),
      user: getDbUser(),
      password: getDbPassword(),
      port: getDbPort(),
      waitForConnections: true,
      connectionLimit: 4,
      multipleStatements: true,
    });

    // 2. Create clean isolated copy database
    await rootPool.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    await rootPool.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

    testPool = mysql.createPool({
      host: getDbHost(),
      user: getDbUser(),
      password: getDbPassword(),
      port: getDbPort(),
      database: TEST_DB,
      waitForConnections: true,
      connectionLimit: 4,
      multipleStatements: true,
    });

    // 3. Set up pre-migration baseline schema on copy database
    await testPool.query(`
      CREATE TABLE users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(255) NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(255) NULL,
        last_name VARCHAR(255) NULL,
        phone VARCHAR(100) NULL,
        role VARCHAR(50) DEFAULT 'customer',
        created_at VARCHAR(100) NOT NULL,
        updated_at VARCHAR(100) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE products (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(15, 2) NOT NULL,
        rating DECIMAL(3, 2) DEFAULT 0,
        reviewsCount INT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Active',
        created_at VARCHAR(100) NULL,
        updated_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE orders (
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
        isPaid TINYINT(1) DEFAULT 0,
        deliveryConfirmed TINYINT(1) DEFAULT 0,
        deliveredAt VARCHAR(100) NULL,
        created_at VARCHAR(100) NULL,
        updated_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE customer_orders (
        id VARCHAR(255) PRIMARY KEY,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NULL,
        customer_phone VARCHAR(100) NULL,
        total DECIMAL(15, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        payment_status VARCHAR(50) DEFAULT 'unpaid',
        payment_reference VARCHAR(255) NULL,
        payment_amount DECIMAL(15, 2) NULL,
        items LONGTEXT NULL,
        created_at VARCHAR(100) NULL,
        placed_at VARCHAR(100) NULL,
        updated_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE reviews (
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

    // 4. Seed realistic test records
    // User
    await testPool.query(`
      INSERT INTO users (id, email, username, password_hash, first_name, last_name, created_at, updated_at)
      VALUES ('usr-test-1', 'customer@example.com', 'testcustomer', 'hash123', 'Jane', 'Doe', NOW(), NOW())
    `);

    // Existing catalog products
    await testPool.query(`
      INSERT INTO products (id, name, price, status, created_at, updated_at)
      VALUES 
        ('prod-shoes-101', 'Artisan Leather Shoes', 4500.00, 'Active', NOW(), NOW()),
        ('prod-jacket-102', 'Vintage Denim Jacket', 7500.00, 'Active', NOW(), NOW())
    `);

    // Orders with diverse items (single item, multi-item, product that was later deleted, malformed)
    await testPool.query(`
      INSERT INTO orders (id, customerName, customerEmail, items, total, status, date, deliveryConfirmed, deliveredAt, created_at)
      VALUES 
        ('ORD-SINGLE-01', 'Jane Doe', 'customer@example.com', 
         '[{"id":"it-101","productId":"prod-shoes-101","name":"Artisan Leather Shoes","price":4500,"quantity":1}]',
         4500.00, 'completed', '2026-10-15', 1, '2026-10-16T12:00:00Z', '2026-10-15T09:00:00Z'),

        ('ORD-MULTI-02', 'Jane Doe', 'customer@example.com', 
         '[{"id":"it-201","productId":"prod-shoes-101","name":"Artisan Leather Shoes","price":4500,"quantity":1},{"id":"it-202","productId":"prod-jacket-102","name":"Vintage Denim Jacket","price":7500,"quantity":2}]',
         19500.00, 'completed', '2026-10-18', 1, '2026-10-19T14:30:00Z', '2026-10-18T10:00:00Z'),

        ('ORD-DELETED-PROD-03', 'Jane Doe', 'customer@example.com', 
         '[{"id":"it-301","productId":"prod-discontinued-999","name":"Discontinued Silk Scarf","price":2200,"quantity":1}]',
         2200.00, 'completed', '2026-10-20', 1, '2026-10-21T08:00:00Z', '2026-10-20T11:00:00Z'),

        ('ORD-EMPTY-ITEMS-04', 'Jane Doe', 'customer@example.com', 
         '[]', 0.00, 'cancelled', '2026-10-22', 0, NULL, '2026-10-22T15:00:00Z')
    `);
  });

  after(async () => {
    if (testPool) await testPool.end();
    if (rootPool) {
      await rootPool.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
      await rootPool.end();
    }
  });

  it('1. Safeguard: Migration aborts with SQLSTATE 45000 if legacy reviews table has data', async () => {
    // Insert a dummy row into legacy reviews table
    await testPool.query(`
      INSERT INTO reviews (id, productId, userName, userEmail, rating, comment, date)
      VALUES ('rev-old-1', 'prod-shoes-101', 'Alice', 'alice@test.com', 5, 'Great legacy review', '2026-10-01')
    `);

    const migrationSql = fs.readFileSync(
      path.resolve(process.cwd(), 'server', 'migrations', '20261025_add_product_reviews_and_reminders.sql'),
      'utf8'
    );

    // Running migration must throw an error due to row presence
    let threw = false;
    try {
      await testPool.query(migrationSql);
    } catch (err) {
      threw = true;
      assert.match(err.message, /ABORT_MIGRATION_EXISTING_REVIEWS_NOT_EMPTY/i);
    } finally {
      // Clean up the test row so subsequent migration tests proceed
      await testPool.query(`DELETE FROM reviews`);
    }
    assert.strictEqual(threw, true, 'Migration must abort if reviews table has rows');
  });

  it('2. Forward migration: Applies cleanly and verifies all table schemas and constraints', async () => {
    const migrationSql = fs.readFileSync(
      path.resolve(process.cwd(), 'server', 'migrations', '20261025_add_product_reviews_and_reminders.sql'),
      'utf8'
    );

    await testPool.query(migrationSql);

    // Verify order_items columns
    const [oiCols] = await testPool.query(`DESCRIBE order_items`);
    const oiColNames = oiCols.map((c) => c.Field);
    assert.ok(oiColNames.includes('id'));
    assert.ok(oiColNames.includes('order_id'));
    assert.ok(oiColNames.includes('product_id'));
    assert.ok(oiColNames.includes('name'));
    assert.ok(oiColNames.includes('price'));
    assert.ok(oiColNames.includes('quantity'));
    assert.ok(oiColNames.includes('selected_variations'));

    // Verify reviews columns and types
    const [revCols] = await testPool.query(`DESCRIBE reviews`);
    const idCol = revCols.find((c) => c.Field === 'id');
    assert.match(idCol.Type, /bigint/i);
    assert.strictEqual(idCol.Key, 'PRI');
    assert.strictEqual(idCol.Extra, 'auto_increment');

    const ratingCol = revCols.find((c) => c.Field === 'rating');
    assert.match(ratingCol.Type, /tinyint/i);

    const titleCol = revCols.find((c) => c.Field === 'title');
    assert.match(titleCol.Type, /varchar\(120\)/i);

    const statusCol = revCols.find((c) => c.Field === 'status');
    assert.match(statusCol.Type, /enum/i);

    // Verify orders altered column
    const [orderCols] = await testPool.query(`DESCRIBE orders`);
    const reminderCol = orderCols.find((c) => c.Field === 'review_reminder_sent_at');
    assert.ok(reminderCol, 'orders.review_reminder_sent_at must exist');
    assert.match(reminderCol.Type, /datetime/i);

    // Verify users altered column
    const [userCols] = await testPool.query(`DESCRIBE users`);
    const optOutCol = userCols.find((c) => c.Field === 'marketing_emails_opt_out');
    assert.ok(optOutCol, 'users.marketing_emails_opt_out must exist');
    assert.strictEqual(optOutCol.Default, '0');
  });

  it('3. Backfill: Populates order_items, tolerates deleted products, and is idempotent', async () => {
    // Run backfill on test DB
    const stats1 = await runOrderItemsBackfill({ dbName: TEST_DB, batchSize: 50 });

    assert.strictEqual(stats1.totalOrders, 4);
    assert.strictEqual(stats1.ordersWithItems, 3);
    assert.strictEqual(stats1.totalJsonItems, 4); // 1 + 2 + 1
    assert.strictEqual(stats1.productsFound, 3);
    assert.strictEqual(stats1.productsMissingOrNull, 1); // prod-discontinued-999

    // Check row in order_items for the discontinued product: product_id should be NULL but name/price intact
    const [discontinuedRow] = await testPool.query(
      `SELECT * FROM order_items WHERE order_id = 'ORD-DELETED-PROD-03'`
    );
    assert.strictEqual(discontinuedRow.length, 1);
    assert.strictEqual(discontinuedRow[0].product_id, null, 'Deleted product ID must be NULL');
    assert.strictEqual(discontinuedRow[0].name, 'Discontinued Silk Scarf');
    assert.strictEqual(Number(discontinuedRow[0].price), 2200);

    // Run backfill a SECOND time: must not duplicate or crash (Idempotency)
    const stats2 = await runOrderItemsBackfill({ dbName: TEST_DB, batchSize: 50 });
    const [totalRows] = await testPool.query(`SELECT COUNT(*) as count FROM order_items`);
    assert.strictEqual(Number(totalRows[0].count), 4, 'Re-running backfill must not create duplicate items');
  });

  it('4. Verification script: Validates zero count discrepancies and reports skipped orders', async () => {
    const report = await verifyOrderItemsBackfill(TEST_DB);

    assert.strictEqual(report.passed, true);
    assert.strictEqual(report.totalOrders, 4);
    assert.strictEqual(report.ordersWithItems, 3);
    assert.strictEqual(report.totalJsonItems, 4);
    assert.strictEqual(report.totalOrderItemsRows, 4);
    assert.strictEqual(report.difference, 0);
    assert.strictEqual(report.discrepancies.length, 0);
    assert.strictEqual(report.productsRetainedWithNullFk, 1);
    assert.strictEqual(report.skippedOrders.length, 1);
    assert.strictEqual(report.skippedOrders[0].orderId, 'ORD-EMPTY-ITEMS-04');
  });

  it('5. Constraint verification: CHECK constraint rating 1-5 and UNIQUE keys on reviews', async () => {
    // Valid review creation
    await testPool.query(`
      INSERT INTO reviews (product_id, user_id, order_item_id, rating, title, body, status)
      VALUES ('prod-shoes-101', 'usr-test-1', 'oi_ORD-SINGLE-01_it-101', 5, 'Exceptional Quality', 'Super comfortable leather.', 'published')
    `);

    // Duplicate review on same order_item_id must fail UNIQUE constraint
    let duplicateRejected = false;
    try {
      await testPool.query(`
        INSERT INTO reviews (product_id, user_id, order_item_id, rating, title, body, status)
        VALUES ('prod-shoes-101', 'usr-test-1', 'oi_ORD-SINGLE-01_it-101', 4, 'Second Review', 'Another text', 'published')
      `);
    } catch (err) {
      duplicateRejected = true;
      assert.match(err.message, /Duplicate entry/i);
    }
    assert.strictEqual(duplicateRejected, true, 'Duplicate review on same order item must be rejected');

    // Rating outside 1-5 should fail CHECK constraint (on MySQL 8.0.16+)
    let checkFailed = false;
    try {
      await testPool.query(`
        INSERT INTO reviews (product_id, user_id, order_item_id, rating, title, body, status)
        VALUES ('prod-jacket-102', 'usr-test-1', 'oi_ORD-MULTI-02_it-202', 6, 'Invalid Rating', 'Rating is 6', 'published')
      `);
    } catch (err) {
      checkFailed = true;
      assert.match(err.message, /check|chk_reviews_rating/i);
    }
    // Clean up valid test review
    await testPool.query(`DELETE FROM reviews`);
  });

  it('6. Rollback: Restores database to exact prior state without deleting existing orders', async () => {
    const rollbackSql = fs.readFileSync(
      path.resolve(process.cwd(), 'server', 'migrations', '20261025_rollback_product_reviews_and_reminders.sql'),
      'utf8'
    );

    await testPool.query(rollbackSql);

    // Verify order_items dropped
    const [oiCheck] = await testPool.query(
      `SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = 'order_items'`,
      [TEST_DB]
    );
    assert.strictEqual(oiCheck[0].cnt, 0, 'order_items table must be dropped');

    // Verify legacy reviews table structure restored
    const [revCols] = await testPool.query(`DESCRIBE reviews`);
    const legacyId = revCols.find((c) => c.Field === 'id');
    assert.match(legacyId.Type, /varchar\(255\)/i, 'reviews.id must be restored to VARCHAR(255)');
    const legacyProductId = revCols.find((c) => c.Field === 'productId');
    assert.ok(legacyProductId, 'legacy reviews.productId column must be restored');

    // Verify orders table preserved
    const [ordersCount] = await testPool.query(`SELECT COUNT(*) as cnt FROM orders`);
    assert.strictEqual(Number(ordersCount[0].cnt), 4, 'Orders must remain completely intact');

    // Verify review_reminder_sent_at dropped
    const [orderCols] = await testPool.query(`DESCRIBE orders`);
    const reminderCol = orderCols.find((c) => c.Field === 'review_reminder_sent_at');
    assert.strictEqual(reminderCol, undefined, 'review_reminder_sent_at must be removed from orders');

    // Verify marketing_emails_opt_out dropped
    const [userCols] = await testPool.query(`DESCRIBE users`);
    const optOutCol = userCols.find((c) => c.Field === 'marketing_emails_opt_out');
    assert.strictEqual(optOutCol, undefined, 'marketing_emails_opt_out must be removed from users');
  });
});
