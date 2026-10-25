/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Step 2 Automated Test Suite: Backend Review API, Atomic Product Rating Sync,
 * Eligibility Verification, Review Reminders Engine, and Secured Cron Endpoint
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import {
  getDbHost,
  getDbUser,
  getDbPassword,
  getDbPort,
  checkMysqlReviewEligibility,
  createMysqlReview,
  updateMysqlReview,
  deleteMysqlReview,
  adminUpdateMysqlReviewStatus,
  getMysqlReviewsByProduct,
  getMysqlAllReviewsForAdmin,
  getMysqlOrderItemsWithReviews,
  setMysqlMarketingEmailOptOut,
  setMysqlMarketingEmailOptOutByUserId,
  isMysqlUserOptedOutOfMarketing,
  closeDbPool,
} from '../src/lib/mysql-db.ts';
import { processReviewReminders as processRemindersTs } from '../server/services/reviewReminderService.ts';
import { processReviewReminders as processRemindersCjs } from '../scripts/send-review-reminders.cjs';
import systemRouter, { verifyInternalCronToken } from '../server/routes/system.ts';

dotenv.config();

const TEST_DB = 'ropenix_step2_test_copy';

describe('Step 2: Reviews Domain API, Rating Sync & Automated Reminders', () => {
  let rootPool;
  let testPool;
  let app;
  let server;
  let serverUrl;

  before(async () => {
    // 0. Point environment to isolated test database
    process.env.DB_NAME = TEST_DB;
    process.env.REMINDER_CRON_TOKEN = 'secret-cron-token-12345';
    await closeDbPool();

    // 1. Create clean isolated copy database for Step 2 testing
    rootPool = mysql.createPool({
      host: getDbHost(),
      user: getDbUser(),
      password: getDbPassword(),
      port: getDbPort(),
      waitForConnections: true,
      connectionLimit: 4,
      multipleStatements: true,
    });

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

    // 2. Set up base schema
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
        is_staff TINYINT(1) DEFAULT 0,
        is_superuser TINYINT(1) DEFAULT 0,
        marketing_emails_opt_out TINYINT(1) NOT NULL DEFAULT 0,
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
        isPaid TINYINT(1) DEFAULT 0,
        deliveryConfirmed TINYINT(1) DEFAULT 0,
        deliveredAt VARCHAR(100) NULL,
        review_reminder_sent_at DATETIME NULL,
        created_at VARCHAR(100) NULL,
        updated_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

      CREATE TABLE order_items (
        id VARCHAR(255) PRIMARY KEY,
        order_id VARCHAR(255) NOT NULL,
        product_id VARCHAR(255) NULL,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(15, 2) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        selected_variations TEXT NULL,
        created_at VARCHAR(100) NOT NULL,
        CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
        CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

      CREATE TABLE reviews (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        product_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        order_item_id VARCHAR(255) NOT NULL,
        rating TINYINT UNSIGNED NOT NULL,
        title VARCHAR(120) NULL,
        body TEXT NOT NULL,
        status ENUM('published', 'hidden') NOT NULL DEFAULT 'published',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_order_item (order_item_id),
        CONSTRAINT fk_rev_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
        CONSTRAINT fk_rev_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_rev_order_item FOREIGN KEY (order_item_id) REFERENCES order_items (id) ON DELETE CASCADE,
        CONSTRAINT chk_rev_rating CHECK (rating >= 1 AND rating <= 5)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    // 3. Seed test users
    await testPool.query(`
      INSERT INTO users (id, email, username, password_hash, first_name, last_name, role, is_staff, is_superuser, created_at, updated_at)
      VALUES 
        ('usr-customer-1', 'customer1@example.com', 'customer1', 'hash1', 'Alice', 'Smith', 'customer', 0, 0, NOW(), NOW()),
        ('usr-customer-2', 'customer2@example.com', 'customer2', 'hash2', 'Bob', 'Jones', 'customer', 0, 0, NOW(), NOW()),
        ('usr-admin-1', 'admin@example.com', 'admin', 'adminhash', 'Admin', 'User', 'admin', 1, 1, NOW(), NOW())
    `);

    // 4. Seed test products
    await testPool.query(`
      INSERT INTO products (id, name, slug, price, rating, reviewsCount, created_at, updated_at)
      VALUES 
        ('prod-coffee-1', 'Kenyan AA Peaberry Coffee', 'kenyan-aa-peaberry', 1200.00, 0, 0, NOW(), NOW()),
        ('prod-mug-2', 'Ceramic Artisan Mug', 'ceramic-artisan-mug', 850.00, 0, 0, NOW(), NOW())
    `);

    // 5. Seed test orders
    // - ORD-DELIVERED-01: Owned by customer1@example.com, completed & delivered (Eligible!)
    // - ORD-CANCELLED-02: Owned by customer1@example.com, cancelled even if delivery confirmed (Ineligible!)
    // - ORD-PROCESSING-03: Owned by customer1@example.com, processing, not delivered (Ineligible!)
    // - ORD-CUSTOMER2-04: Owned by customer2@example.com, completed & delivered (Eligible for customer2 only!)
    await testPool.query(`
      INSERT INTO orders (id, customerName, customerEmail, items, total, status, date, deliveryConfirmed, deliveredAt, created_at)
      VALUES 
        ('ORD-DELIVERED-01', 'Alice Smith', 'customer1@example.com', 
         '[{"id":"it-101","productId":"prod-coffee-1","name":"Kenyan AA Peaberry Coffee","price":1200,"quantity":1}]',
         1200.00, 'completed', '2026-10-10', 1, '2026-10-11T10:00:00Z', '2026-10-10T09:00:00Z'),

        ('ORD-CANCELLED-02', 'Alice Smith', 'customer1@example.com', 
         '[{"id":"it-201","productId":"prod-coffee-1","name":"Kenyan AA Peaberry Coffee","price":1200,"quantity":1}]',
         1200.00, 'cancelled', '2026-10-11', 1, '2026-10-12T10:00:00Z', '2026-10-11T09:00:00Z'),

        ('ORD-PROCESSING-03', 'Alice Smith', 'customer1@example.com', 
         '[{"id":"it-301","productId":"prod-coffee-1","name":"Kenyan AA Peaberry Coffee","price":1200,"quantity":1}]',
         1200.00, 'processing', '2026-10-12', 0, NULL, '2026-10-12T09:00:00Z'),

        ('ORD-CUSTOMER2-04', 'Bob Jones', 'customer2@example.com', 
         '[{"id":"it-401","productId":"prod-coffee-1","name":"Kenyan AA Peaberry Coffee","price":1200,"quantity":1}]',
         1200.00, 'completed', '2026-10-13', 1, '2026-10-14T10:00:00Z', '2026-10-13T09:00:00Z')
    `);

    // 6. Seed order_items matching the orders
    await testPool.query(`
      INSERT INTO order_items (id, order_id, product_id, name, price, quantity, created_at)
      VALUES 
        ('oi-c1-item1', 'ORD-DELIVERED-01', 'prod-coffee-1', 'Kenyan AA Peaberry Coffee', 1200.00, 1, '2026-10-10T09:00:00Z'),
        ('oi-c1-item2', 'ORD-CANCELLED-02', 'prod-coffee-1', 'Kenyan AA Peaberry Coffee', 1200.00, 1, '2026-10-11T09:00:00Z'),
        ('oi-c1-item3', 'ORD-PROCESSING-03', 'prod-coffee-1', 'Kenyan AA Peaberry Coffee', 1200.00, 1, '2026-10-12T09:00:00Z'),
        ('oi-c2-item4', 'ORD-CUSTOMER2-04', 'prod-coffee-1', 'Kenyan AA Peaberry Coffee', 1200.00, 1, '2026-10-13T09:00:00Z')
    `);

    // 7. Point DB_NAME in process.env to TEST_DB for service/lib tests
    process.env.DB_NAME = TEST_DB;
    process.env.REMINDER_CRON_TOKEN = 'secret-cron-token-12345';
    await closeDbPool();

    // 8. Start lightweight Express server for API endpoint testing
    app = express();
    app.use(express.json());
    app.use('/api', systemRouter);

    server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const addr = server.address();
    serverUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closeDbPool();
    if (testPool) await testPool.end();
    if (rootPool) {
      await rootPool.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
      await rootPool.end();
    }
    setTimeout(() => process.exit(0), 100);
  });

  // ==========================================================================
  // Section A: Review Eligibility & Customer Ownership Enforcement
  // ==========================================================================
  describe('A. Review Eligibility & Ownership Rules', () => {
    it('1. Fails when order item does not exist', async () => {
      const res = await checkMysqlReviewEligibility(
        { id: 'usr-customer-1', email: 'customer1@example.com' },
        'non-existent-order-item-id'
      );
      assert.strictEqual(res.eligible, false);
      assert.strictEqual(res.reason, 'ITEM_NOT_FOUND');
    });

    it('2. Fails when user is not the order owner (Forbidden)', async () => {
      // customer2 attempts to review customer1's order item
      const res = await checkMysqlReviewEligibility(
        { id: 'usr-customer-2', email: 'customer2@example.com' },
        'oi-c1-item1'
      );
      assert.strictEqual(res.eligible, false);
      assert.strictEqual(res.reason, 'FORBIDDEN_NOT_OWNER');
    });

    it('3. Fails when order status is cancelled/refunded, taking precedence over delivery status', async () => {
      // ORD-CANCELLED-02 has deliveryConfirmed = 1, but status = 'cancelled'
      const res = await checkMysqlReviewEligibility(
        { id: 'usr-customer-1', email: 'customer1@example.com' },
        'oi-c1-item2'
      );
      assert.strictEqual(res.eligible, false);
      assert.strictEqual(res.reason, 'ORDER_INELIGIBLE_STATUS');
    });

    it('4. Fails when order is not yet delivered/completed', async () => {
      // ORD-PROCESSING-03 is processing and not delivered
      const res = await checkMysqlReviewEligibility(
        { id: 'usr-customer-1', email: 'customer1@example.com' },
        'oi-c1-item3'
      );
      assert.strictEqual(res.eligible, false);
      assert.strictEqual(res.reason, 'ORDER_NOT_DELIVERED');
    });

    it('5. Succeeds for eligible delivered order item owned by the customer', async () => {
      const res = await checkMysqlReviewEligibility(
        { id: 'usr-customer-1', email: 'customer1@example.com' },
        'oi-c1-item1'
      );
      assert.strictEqual(res.eligible, true);
      assert.strictEqual(res.reason, 'ELIGIBLE');
    });
  });

  // ==========================================================================
  // Section B: Atomic Review Creation & Synchronized Product Rating
  // ==========================================================================
  describe('B. Atomic Rating Synchronization on Create, Update, Hide, and Delete', () => {
    let review1Id;
    let review2Id;

    it('1. Create Review 1: 5-star review updates product rating to 5.0 and count to 1 atomically', async () => {
      const result = await createMysqlReview({
        userId: 'usr-customer-1',
        userEmail: 'customer1@example.com',
        orderItemId: 'oi-c1-item1',
        rating: 5,
        title: 'Exquisite Coffee',
        body: '<b>Wonderful aroma</b> and exquisite rich flavor!',
      });

      assert.ok(result.id);
      review1Id = result.id;
      assert.strictEqual(result.productRating, 5.0);
      assert.strictEqual(result.productReviewsCount, 1);

      // Verify plain-text sanitization (HTML stripped)
      assert.strictEqual(result.body, 'Wonderful aroma and exquisite rich flavor!');

      // Verify products table was atomically updated in the database
      const [prodRows] = await testPool.query(`SELECT rating, reviewsCount FROM products WHERE id = 'prod-coffee-1'`);
      assert.strictEqual(Number(prodRows[0].rating), 5.0);
      assert.strictEqual(Number(prodRows[0].reviewsCount), 1);
    });

    it('2. Block duplicate review on same order item', async () => {
      await assert.rejects(
        async () => {
          await createMysqlReview({
            userId: 'usr-customer-1',
            userEmail: 'customer1@example.com',
            orderItemId: 'oi-c1-item1',
            rating: 4,
            title: 'Second review attempt',
            body: 'Trying to post another review on same order item.',
          });
        },
        (err) => {
          assert.match(err.message, /already reviewed/i);
          return true;
        }
      );
    });

    it('3. Create Review 2: 4-star review updates product rating to 4.5 and count to 2 atomically', async () => {
      const result = await createMysqlReview({
        userId: 'usr-customer-2',
        userEmail: 'customer2@example.com',
        orderItemId: 'oi-c2-item4',
        rating: 4,
        title: 'Good Quality',
        body: 'Very nice coffee beans, great roasted aroma.',
      });

      assert.ok(result.id);
      review2Id = result.id;
      assert.strictEqual(result.productRating, 4.5); // (5 + 4) / 2 = 4.5
      assert.strictEqual(result.productReviewsCount, 2);

      const [prodRows] = await testPool.query(`SELECT rating, reviewsCount FROM products WHERE id = 'prod-coffee-1'`);
      assert.strictEqual(Number(prodRows[0].rating), 4.5);
      assert.strictEqual(Number(prodRows[0].reviewsCount), 2);
    });

    it('4. Edit Review: Only owner can edit; updating rating from 4 to 2 recomputes product rating to 3.5', async () => {
      // Non-owner (customer1) trying to edit customer2's review should fail (403 Forbidden)
      await assert.rejects(
        async () => {
          await updateMysqlReview(review2Id, 'usr-customer-1', { rating: 1 });
        },
        (err) => {
          assert.match(err.message, /Forbidden.*only edit your own/i);
          return true;
        }
      );

      // Owner (customer2) updates rating to 2 stars
      const updated = await updateMysqlReview(review2Id, 'usr-customer-2', {
        rating: 2,
        title: 'Updated: Bitter aftertaste',
        body: 'Updated review: found it had a slight bitter aftertaste.',
      });

      assert.strictEqual(updated.rating, 2);
      assert.strictEqual(updated.productRating, 3.5); // (5 + 2) / 2 = 3.5
      assert.strictEqual(updated.productReviewsCount, 2);

      const [prodRows] = await testPool.query(`SELECT rating, reviewsCount FROM products WHERE id = 'prod-coffee-1'`);
      assert.strictEqual(Number(prodRows[0].rating), 3.5);
      assert.strictEqual(Number(prodRows[0].reviewsCount), 2);
    });

    it('5. Admin Hide Review: Hiding Review 2 removes it from product rating (reverts to 5.0, count 1)', async () => {
      const result = await adminUpdateMysqlReviewStatus(review2Id, 'hidden');
      assert.strictEqual(result.status, 'hidden');
      assert.strictEqual(result.productRating, 5.0); // Only Review 1 (5 stars) is now published
      assert.strictEqual(result.productReviewsCount, 1);

      const [prodRows] = await testPool.query(`SELECT rating, reviewsCount FROM products WHERE id = 'prod-coffee-1'`);
      assert.strictEqual(Number(prodRows[0].rating), 5.0);
      assert.strictEqual(Number(prodRows[0].reviewsCount), 1);
    });

    it('6. Admin Unhide Review: Restoring Review 2 to published recomputes rating to 3.5, count 2', async () => {
      const result = await adminUpdateMysqlReviewStatus(review2Id, 'published');
      assert.strictEqual(result.status, 'published');
      assert.strictEqual(result.productRating, 3.5);
      assert.strictEqual(result.productReviewsCount, 2);
    });

    it('7. Delete Review: Non-owner cannot delete; owner deletion synchronizes product rating atomically', async () => {
      // Non-owner cannot delete
      await assert.rejects(
        async () => {
          await deleteMysqlReview(review2Id, 'usr-customer-1', false);
        },
        (err) => {
          assert.match(err.message, /Forbidden.*only delete your own/i);
          return true;
        }
      );

      // Owner deletes Review 2
      const del2 = await deleteMysqlReview(review2Id, 'usr-customer-2', false);
      assert.strictEqual(del2.success, true);
      assert.strictEqual(del2.productRating, 5.0);
      assert.strictEqual(del2.productReviewsCount, 1);

      // Admin deletes Review 1
      const del1 = await deleteMysqlReview(review1Id, 'usr-admin-1', true);
      assert.strictEqual(del1.success, true);
      assert.strictEqual(del1.productRating, 0.0);
      assert.strictEqual(del1.productReviewsCount, 0);

      const [prodRows] = await testPool.query(`SELECT rating, reviewsCount FROM products WHERE id = 'prod-coffee-1'`);
      assert.strictEqual(Number(prodRows[0].rating), 0.0);
      assert.strictEqual(Number(prodRows[0].reviewsCount), 0);
    });
  });

  // ==========================================================================
  // Section C: Orders List 2nd Query Review Merge
  // ==========================================================================
  describe('C. Orders List 2nd Query Review Merge (getMysqlOrderItemsWithReviews)', () => {
    before(async () => {
      // Insert one fresh review to test status merge
      await testPool.query(`
        INSERT INTO reviews (product_id, user_id, order_item_id, rating, title, body, status, created_at)
        VALUES ('prod-coffee-1', 'usr-customer-1', 'oi-c1-item1', 5, 'Great Coffee', 'Outstanding rich flavor.', 'published', NOW())
      `);
    });

    after(async () => {
      await testPool.query(`DELETE FROM reviews`);
    });

    it('1. Merges per-item review state in memory without multiplying order rows', async () => {
      const orderIds = ['ORD-DELIVERED-01', 'ORD-CUSTOMER2-04'];
      const itemsMap = await getMysqlOrderItemsWithReviews(orderIds);

      assert.ok(itemsMap.has('ORD-DELIVERED-01'));
      assert.ok(itemsMap.has('ORD-CUSTOMER2-04'));

      const c1Items = itemsMap.get('ORD-DELIVERED-01');
      assert.strictEqual(c1Items.length, 1);
      assert.strictEqual(c1Items[0].id, 'oi-c1-item1');
      assert.strictEqual(c1Items[0].hasReview, true);
      assert.ok(c1Items[0].review);
      assert.strictEqual(c1Items[0].review.rating, 5);

      const c2Items = itemsMap.get('ORD-CUSTOMER2-04');
      assert.strictEqual(c2Items.length, 1);
      assert.strictEqual(c2Items[0].id, 'oi-c2-item4');
      assert.strictEqual(c2Items[0].hasReview, false);
      assert.strictEqual(c2Items[0].review, null);
    });
  });

  // ==========================================================================
  // Section D: Automated Review Reminders Engine (TS & CJS)
  // ==========================================================================
  describe('D. Review Reminders Engine & Runners', () => {
    it('1. Skips non-delivered orders without setting review_reminder_sent_at', async () => {
      // ORD-PROCESSING-03 is 13 days old but status is 'processing'
      const stats = await processRemindersCjs({
        days: 7,
        batchSize: 10,
        delayMs: 0,
        dryRun: false,
        dbName: TEST_DB,
      });

      assert.ok(stats.skippedNotDelivered >= 1, 'Should skip non-delivered orders');

      // Verify ORD-PROCESSING-03 review_reminder_sent_at remains NULL!
      const [orderRows] = await testPool.query(
        `SELECT review_reminder_sent_at FROM orders WHERE id = 'ORD-PROCESSING-03'`
      );
      assert.strictEqual(
        orderRows[0].review_reminder_sent_at,
        null,
        'review_reminder_sent_at must NOT be set on non-delivered orders'
      );
    });

    it('2. Skips opted-out customers (marketing_emails_opt_out = 1)', async () => {
      // Opt-out customer2
      await setMysqlMarketingEmailOptOut('customer2@example.com', true);

      // Verify opt-out status was saved
      const isOptedOut = await isMysqlUserOptedOutOfMarketing('customer2@example.com');
      assert.strictEqual(isOptedOut, true);

      // Reset reminder column for customer2's order
      await testPool.query(
        `UPDATE orders SET review_reminder_sent_at = NULL WHERE id = 'ORD-CUSTOMER2-04'`
      );

      const stats = await processRemindersCjs({
        days: 7,
        batchSize: 10,
        delayMs: 0,
        dryRun: false,
        dbName: TEST_DB,
      });

      assert.ok(stats.skippedOptedOut >= 1, 'Must skip opted out customers');

      // Un-opt-out customer2 for further tests
      await setMysqlMarketingEmailOptOut('customer2@example.com', false);
    });

    it('3. Atomically claims order one at a time and resets review_reminder_sent_at = NULL on send failure', async () => {
      // Reset reminder column for ORD-DELIVERED-01
      await testPool.query(
        `UPDATE orders SET review_reminder_sent_at = NULL WHERE id = 'ORD-DELIVERED-01'`
      );

      // Break SMTP credentials temporarily to trigger send failure
      const oldSmtpHost = process.env.SMTP_HOST;
      const oldSmtpPass = process.env.SMTP_PASS;
      process.env.SMTP_HOST = '127.0.0.1';
      process.env.SMTP_PORT = '1'; // Non-existent SMTP port will fail connection
      process.env.SMTP_USER = 'dummy@test.com';
      process.env.SMTP_PASS = 'invalid-pass';

      try {
        const stats = await processRemindersCjs({
          days: 7,
          batchSize: 1,
          delayMs: 0,
          dryRun: false,
          dbName: TEST_DB,
        });

        assert.strictEqual(stats.claimedOrders, 1, 'Order was claimed initially');
        assert.strictEqual(stats.failedDeliveries, 1, 'Delivery failed as expected');
        assert.strictEqual(stats.claimedAndResetOrders, 1, 'Order was reset for retry');

        // CRITICAL REQUIREMENT: Check that review_reminder_sent_at was reset to NULL!
        const [orderRows] = await testPool.query(
          `SELECT review_reminder_sent_at FROM orders WHERE id = 'ORD-DELIVERED-01'`
        );
        assert.strictEqual(
          orderRows[0].review_reminder_sent_at,
          null,
          'review_reminder_sent_at must be reset to NULL on send failure'
        );
      } finally {
        process.env.SMTP_HOST = oldSmtpHost;
        process.env.SMTP_PASS = oldSmtpPass;
        delete process.env.SMTP_USER;
      }
    });
  });

  // ==========================================================================
  // Section E: Secured Internal Cron Endpoint (POST /api/internal/send-review-reminders)
  // ==========================================================================
  describe('E. Secured Internal HTTP Endpoint', () => {
    it('1. Rejects requests without authentication token (401 Unauthorized)', async () => {
      const res = await fetch(`${serverUrl}/api/internal/send-review-reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      });

      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error, /Unauthorized.*token/i);
    });

    it('2. Rejects requests with invalid or forged token using constant-time check (401 Unauthorized)', async () => {
      const res = await fetch(`${serverUrl}/api/internal/send-review-reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-token': 'wrong-token-value',
        },
        body: JSON.stringify({ dryRun: true }),
      });

      assert.strictEqual(res.status, 401);
    });

    it('3. Accepts requests with valid token via x-cron-token header and executes successfully', async () => {
      const res = await fetch(`${serverUrl}/api/internal/send-review-reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-token': 'secret-cron-token-12345',
        },
        body: JSON.stringify({ dryRun: true }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.stats);
    });

    it('4. Accepts requests with valid token via Bearer Authorization header', async () => {
      const res = await fetch(`${serverUrl}/api/internal/send-review-reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer secret-cron-token-12345',
        },
        body: JSON.stringify({ dryRun: true }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
    });
  });
});
