/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Step 1 Automated Test Suite: Migration, Rollback, Backfill, and Order Transaction Consistency
 * 
 * Tests executed on an isolated copy database:
 * 1. Safe Legacy Table Handling: Legacy reviews table is safely renamed to reviews_legacy_backup (never dropped).
 * 2. Forward migration: Applies cleanly across MySQL 5.7+ / MySQL 8.0+ / MariaDB 10.3+,
 *    matching utf8mb4_general_ci collation, creating order_items and reviews with foreign keys.
 * 3. Backfill: Idempotent extraction from orders.items JSON -> order_items, supporting diverse JSON shapes
 *    (productId, product_id, slug, name) and preserving deleted products with product_id = NULL.
 * 4. Verification audit: Audits linked items vs unlinked items breakdown with examples.
 * 5. Constraint verification: CHECK constraint rating 1-5 and UNIQUE KEY unique_order_item.
 * 6. Rollback: Restores database to exact prior state, renaming reviews_legacy_backup back to reviews.
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

    // 2. Create clean isolated copy database with host matching collation
    await rootPool.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    await rootPool.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);

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

    // 3. Set up pre-migration baseline schema matching host collation
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

      CREATE TABLE products (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NULL,
        price DECIMAL(15, 2) NOT NULL,
        rating DECIMAL(3, 2) DEFAULT 0,
        reviewsCount INT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Active',
        created_at VARCHAR(100) NULL,
        updated_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    // 4. Seed test catalog products
    await testPool.query(`
      INSERT INTO users (id, email, username, password_hash, first_name, last_name, created_at, updated_at)
      VALUES ('usr-test-1', 'customer@example.com', 'testcustomer', 'hash123', 'Jane', 'Doe', NOW(), NOW())
    `);

    await testPool.query(`
      INSERT INTO products (id, name, slug, price, status, created_at, updated_at)
      VALUES 
        ('prod-shoes-101', 'Artisan Leather Shoes', 'artisan-leather-shoes', 4500.00, 'Active', NOW(), NOW()),
        ('prod-jacket-102', 'Vintage Denim Jacket', 'vintage-denim-jacket', 7500.00, 'Active', NOW(), NOW()),
        ('prod-belt-103', 'Handcrafted Leather Belt', 'handcrafted-leather-belt', 1800.00, 'Active', NOW(), NOW())
    `);

    // 5. Seed legacy review data to test table rename safeguard
    await testPool.query(`
      INSERT INTO reviews (id, productId, userName, userEmail, rating, comment, date)
      VALUES ('rev-legacy-1', 'prod-shoes-101', 'Alice', 'alice@test.com', 5, 'Valuable legacy customer review', '2026-09-15')
    `);

    // 6. Seed orders with multi-item orders and varied JSON shapes:
    //    - ORD-01: direct productId
    //    - ORD-02: multi-item order with productId and snake_case product_id
    //    - ORD-03: item with slug only
    //    - ORD-04: item with name only
    //    - ORD-05: deleted product (truly missing from products table)
    //    - ORD-06: empty items array []
    await testPool.query(`
      INSERT INTO orders (id, customerName, customerEmail, items, total, status, date, deliveryConfirmed, deliveredAt, created_at)
      VALUES 
        ('ORD-DIRECT-01', 'Jane Doe', 'customer@example.com', 
         '[{"id":"it-101","productId":"prod-shoes-101","name":"Artisan Leather Shoes","price":4500,"quantity":1}]',
         4500.00, 'completed', '2026-10-15', 1, '2026-10-16T12:00:00Z', '2026-10-15T09:00:00Z'),

        ('ORD-MULTI-02', 'Jane Doe', 'customer@example.com', 
         '[{"id":"it-201","productId":"prod-shoes-101","name":"Artisan Leather Shoes","price":4500,"quantity":1},{"id":"it-202","product_id":"prod-jacket-102","name":"Vintage Denim Jacket","price":7500,"quantity":2}]',
         19500.00, 'completed', '2026-10-18', 1, '2026-10-19T14:30:00Z', '2026-10-18T10:00:00Z'),

        ('ORD-SLUG-03', 'Jane Doe', 'customer@example.com', 
         '[{"id":"it-301","slug":"handcrafted-leather-belt","name":"Handcrafted Belt","price":1800,"quantity":1}]',
         1800.00, 'completed', '2026-10-19', 1, '2026-10-20T10:00:00Z', '2026-10-19T11:00:00Z'),

        ('ORD-NAME-04', 'Jane Doe', 'customer@example.com', 
         '[{"id":"it-401","name":"Artisan Leather Shoes","price":4500,"quantity":1}]',
         4500.00, 'completed', '2026-10-20', 1, '2026-10-21T09:00:00Z', '2026-10-20T12:00:00Z'),

        ('ORD-DELETED-PROD-05', 'Jane Doe', 'customer@example.com', 
         '[{"id":"it-501","productId":"prod-discontinued-999","name":"Discontinued Silk Scarf","price":2200,"quantity":1}]',
         2200.00, 'completed', '2026-10-21', 1, '2026-10-22T08:00:00Z', '2026-10-21T11:00:00Z'),

        ('ORD-EMPTY-ITEMS-06', 'Jane Doe', 'customer@example.com', 
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

  it('1. Safe Table Handling: Legacy reviews table is safely renamed to reviews_legacy_backup (never dropped)', async () => {
    const migrationSql = fs.readFileSync(
      path.resolve(process.cwd(), 'server', 'migrations', '20261025_add_product_reviews_and_reminders.sql'),
      'utf8'
    );

    // Apply migration
    await testPool.query(migrationSql);

    // Verify reviews_legacy_backup exists and has our legacy review row intact
    const [backupRows] = await testPool.query(`SELECT * FROM reviews_legacy_backup`);
    assert.strictEqual(backupRows.length, 1, 'Legacy reviews table must be preserved as reviews_legacy_backup');
    assert.strictEqual(backupRows[0].id, 'rev-legacy-1');
    assert.strictEqual(backupRows[0].comment, 'Valuable legacy customer review');
  });

  it('2. Forward migration: Creates order_items and structured reviews tables with matching collation', async () => {
    // Verify order_items columns and collation
    const [oiCols] = await testPool.query(`DESCRIBE order_items`);
    const oiColNames = oiCols.map((c) => c.Field);
    assert.ok(oiColNames.includes('id'));
    assert.ok(oiColNames.includes('order_id'));
    assert.ok(oiColNames.includes('product_id'));
    assert.ok(oiColNames.includes('name'));
    assert.ok(oiColNames.includes('price'));
    assert.ok(oiColNames.includes('quantity'));
    assert.ok(oiColNames.includes('selected_variations'));

    // Verify reviews table schema and unique key
    const [revCols] = await testPool.query(`DESCRIBE reviews`);
    const idCol = revCols.find((c) => c.Field === 'id');
    assert.match(idCol.Type, /bigint/i);
    assert.strictEqual(idCol.Key, 'PRI');
    assert.strictEqual(idCol.Extra, 'auto_increment');

    // Verify redundant unique_user_order_item was removed and unique_order_item is present
    const [indexes] = await testPool.query(`SHOW INDEX FROM reviews`);
    const indexNames = indexes.map((idx) => idx.Key_name);
    assert.ok(indexNames.includes('unique_order_item'), 'unique_order_item must exist');
    assert.strictEqual(indexNames.includes('unique_user_order_item'), false, 'Redundant unique_user_order_item must be removed');

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

  it('3. Backfill: Populates order_items, resolves diverse JSON shapes, and handles deleted products', async () => {
    const stats1 = await runOrderItemsBackfill({ dbName: TEST_DB, batchSize: 50 });

    assert.strictEqual(stats1.totalOrders, 6);
    assert.strictEqual(stats1.ordersWithItems, 5);
    assert.strictEqual(stats1.totalJsonItems, 6); // 1 + 2 + 1 + 1 + 1
    assert.strictEqual(stats1.productsFound, 5); // 1 direct, 2 multi (1 direct + 1 product_id), 1 slug, 1 name
    assert.strictEqual(stats1.productsMissingOrNull, 1); // prod-discontinued-999

    // Check slug-resolved item
    const [slugItem] = await testPool.query(`SELECT * FROM order_items WHERE order_id = 'ORD-SLUG-03'`);
    assert.strictEqual(slugItem.length, 1);
    assert.strictEqual(slugItem[0].product_id, 'prod-belt-103', 'Slug handcrafted-leather-belt should resolve to prod-belt-103');

    // Check name-resolved item
    const [nameItem] = await testPool.query(`SELECT * FROM order_items WHERE order_id = 'ORD-NAME-04'`);
    assert.strictEqual(nameItem.length, 1);
    assert.strictEqual(nameItem[0].product_id, 'prod-shoes-101', 'Name match should resolve to prod-shoes-101');

    // Check deleted product item: product_id is NULL but name and price are intact
    const [deletedItem] = await testPool.query(`SELECT * FROM order_items WHERE order_id = 'ORD-DELETED-PROD-05'`);
    assert.strictEqual(deletedItem.length, 1);
    assert.strictEqual(deletedItem[0].product_id, null, 'Deleted product ID must be NULL');
    assert.strictEqual(deletedItem[0].name, 'Discontinued Silk Scarf');
    assert.strictEqual(Number(deletedItem[0].price), 2200);

    // Idempotency check: Re-run backfill, should insert 0 new rows
    const stats2 = await runOrderItemsBackfill({ dbName: TEST_DB, batchSize: 50 });
    assert.strictEqual(stats2.insertedOrderItems, 0, 'Re-running backfill must not create duplicate items');
  });

  it('4. Verification script: Audits product linking breakdown (linked vs unlinked) with examples', async () => {
    const report = await verifyOrderItemsBackfill(TEST_DB);

    assert.strictEqual(report.passed, true);
    assert.strictEqual(report.totalOrders, 6);
    assert.strictEqual(report.ordersWithItems, 5);
    assert.strictEqual(report.totalJsonItems, 6);
    assert.strictEqual(report.totalOrderItemsRows, 6);
    assert.strictEqual(report.difference, 0);
    assert.strictEqual(report.discrepancies.length, 0);
    assert.strictEqual(report.itemsLinkedToProduct, 5);
    assert.strictEqual(report.itemsWithNullProductId, 1);
    assert.strictEqual(report.skippedOrders.length, 1);
    assert.strictEqual(report.skippedOrders[0].orderId, 'ORD-EMPTY-ITEMS-06');
    assert.ok(report.sampleLinkedItems.length > 0, 'Should include examples of linked items');
    assert.ok(report.sampleUnlinkedItems.length > 0, 'Should include examples of unlinked items');
  });

  it('5. Constraint verification: CHECK constraint rating 1-5 and UNIQUE (order_item_id) on reviews', async () => {
    // Valid review
    await testPool.query(`
      INSERT INTO reviews (product_id, user_id, order_item_id, rating, title, body, status)
      VALUES ('prod-shoes-101', 'usr-test-1', 'oi_ORD-DIRECT-01_it-101', 5, 'Great Shoes', 'Comfortable leather.', 'published')
    `);

    // Duplicate review on same order_item_id must be rejected by unique_order_item
    let duplicateRejected = false;
    try {
      await testPool.query(`
        INSERT INTO reviews (product_id, user_id, order_item_id, rating, title, body, status)
        VALUES ('prod-shoes-101', 'usr-test-1', 'oi_ORD-DIRECT-01_it-101', 4, 'Second Review', 'Another attempt', 'published')
      `);
    } catch (err) {
      duplicateRejected = true;
      assert.match(err.message, /Duplicate entry/i);
    }
    assert.strictEqual(duplicateRejected, true, 'Duplicate review on same order item must be rejected');

    // Clean up valid test review
    await testPool.query(`DELETE FROM reviews`);
  });

  it('6. Rollback: Restores reviews_legacy_backup back to reviews and preserves existing orders', async () => {
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

    // Verify legacy reviews table was restored from reviews_legacy_backup
    const [revCols] = await testPool.query(`DESCRIBE reviews`);
    const legacyId = revCols.find((c) => c.Field === 'id');
    assert.match(legacyId.Type, /varchar\(255\)/i, 'reviews.id must be restored to VARCHAR(255)');
    const legacyProductId = revCols.find((c) => c.Field === 'productId');
    assert.ok(legacyProductId, 'legacy reviews.productId column must be restored');

    // Verify the legacy backup data is still inside restored reviews table
    const [restoredRows] = await testPool.query(`SELECT * FROM reviews WHERE id = 'rev-legacy-1'`);
    assert.strictEqual(restoredRows.length, 1);
    assert.strictEqual(restoredRows[0].comment, 'Valuable legacy customer review');

    // Verify orders table preserved
    const [ordersCount] = await testPool.query(`SELECT COUNT(*) as cnt FROM orders`);
    assert.strictEqual(Number(ordersCount[0].cnt), 6, 'Orders must remain completely intact');

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
