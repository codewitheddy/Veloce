/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Step 3 Automated Test Suite:
 * - Public Product Reviews Summary (Single aggregate SQL query)
 * - Public Paginated & Sorted Product Reviews with Verified Purchase badges
 * - Order Review Enrichment (canReview, hasReviewed, unreviewedCount)
 * - Needs Review Filter (?needsReview=true)
 * - Review Submission & Seamless Edit Mode Flow
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { createSignedToken } from '../server/middleware/auth.ts';
import {
  getDbHost,
  getDbUser,
  getDbPassword,
  getDbPort,
  getDbPool,
  closeDbPool,
  getMysqlProductReviewsSummary,
  getMysqlReviewsByProduct,
  enrichOrdersWithReviewEligibility,
} from '../src/lib/mysql-db.ts';
import productsRouter from '../server/routes/products.ts';
import ordersRouter from '../server/routes/orders.ts';
import reviewsRouter from '../server/routes/reviews.ts';

dotenv.config();

const TEST_DB = 'ropenix_step3_test_copy';
const JWT_SECRET = process.env.JWT_SECRET || 'ropenix-jwt-test-secret-key-32chars';

describe('Step 3: Frontend Reviews API, Aggregate Summary, and Order Enrichment', () => {
  let rootPool;
  let testPool;
  let app;
  let server;
  let serverUrl;

  const testUser = {
    id: 'user_step3_cust1',
    email: 'step3_customer@example.com',
    role: 'customer',
    firstName: 'Alice',
    lastName: 'Wambui',
  };

  let testUserToken;

  before(async () => {
    try {
      // 0. Point to isolated test database
    process.env.DB_NAME = TEST_DB;
    process.env.JWT_SECRET = JWT_SECRET;
    await closeDbPool();

    // 1. Create clean test database
    rootPool = mysql.createPool({
      host: getDbHost(),
      user: getDbUser(),
      password: getDbPassword(),
      port: getDbPort(),
      waitForConnections: true,
      connectionLimit: 5,
    });

    await rootPool.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    await rootPool.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

    testPool = mysql.createPool({
      host: getDbHost(),
      user: getDbUser(),
      password: getDbPassword(),
      port: getDbPort(),
      database: TEST_DB,
      waitForConnections: true,
      connectionLimit: 10,
      multipleStatements: true,
    });

    // 2. Set up base schema tables
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
        created_at VARCHAR(100) NULL,
        updated_at VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

      CREATE TABLE products (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NULL,
        price DECIMAL(15, 2) NOT NULL,
        type VARCHAR(50) DEFAULT 'physical',
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

    // 3. Seed users
    await testPool.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, username, role, marketing_emails_opt_out)
      VALUES 
      ('${testUser.id}', '${testUser.email}', 'fake_hash', '${testUser.firstName}', '${testUser.lastName}', 'alicew', 'customer', 0),
      ('user_step3_other', 'other@example.com', 'fake_hash', 'Bob', 'Kariuki', 'bobk', 'customer', 0)
    `);

    // 4. Seed products
    await testPool.query(`
      INSERT INTO products (id, name, slug, price, type, rating, reviewsCount, status, created_at)
      VALUES 
      ('prod_alpha', 'Alpha Performance Runner', 'alpha-runner', 6500, 'physical', 0, 0, 'Active', '2026-10-10'),
      ('prod_beta', 'Beta Sport Cap', 'beta-cap', 1500, 'physical', 0, 0, 'Active', '2026-10-10'),
      ('prod_gamma', 'Gamma Water Bottle', 'gamma-bottle', 800, 'physical', 0, 0, 'Active', '2026-10-10')
    `);

    // 5. Seed orders & order_items
    await testPool.query(`
      INSERT INTO orders (id, customerName, customerEmail, total, status, date, deliveryConfirmed, items, created_at)
      VALUES 
      ('ord_1', 'Alice Wambui', 'step3_customer@example.com', 8000, 'delivered', '2026-10-15', 1, '[]', NOW()),
      ('ord_2', 'Alice Wambui', 'step3_customer@example.com', 6500, 'pending', '2026-10-16', 0, '[]', NOW()),
      ('ord_3', 'Alice Wambui', 'step3_customer@example.com', 6500, 'completed', '2026-10-10', 1, '[]', DATE_SUB(NOW(), INTERVAL 5 DAY)),
      ('ord_4', 'Alice Wambui', 'step3_customer@example.com', 1500, 'cancelled', '2026-10-17', 0, '[]', NOW()),
      ('ord_other', 'Bob Kariuki', 'other@example.com', 19500, 'completed', '2026-10-08', 1, '[]', DATE_SUB(NOW(), INTERVAL 10 DAY))
    `);

    await testPool.query(`
      INSERT INTO order_items (id, order_id, product_id, name, price, quantity, created_at)
      VALUES 
      ('item_1_1', 'ord_1', 'prod_alpha', 'Alpha Performance Runner', 6500, 1, '2026-10-15'),
      ('item_1_2', 'ord_1', 'prod_beta', 'Beta Sport Cap', 1500, 1, '2026-10-15'),
      ('item_2_1', 'ord_2', 'prod_alpha', 'Alpha Performance Runner', 6500, 1, '2026-10-16'),
      ('item_3_1', 'ord_3', 'prod_alpha', 'Alpha Performance Runner', 6500, 1, '2026-10-10'),
      ('item_4_1', 'ord_4', 'prod_beta', 'Beta Sport Cap', 1500, 1, '2026-10-17'),
      ('item_mock_other', 'ord_other', 'prod_alpha', 'Alpha Performance Runner', 6500, 1, '2026-10-08'),
      ('item_mock_other2', 'ord_other', 'prod_alpha', 'Alpha Performance Runner', 6500, 1, '2026-10-08'),
      ('item_mock_other3', 'ord_other', 'prod_alpha', 'Alpha Performance Runner', 6500, 1, '2026-10-08')
    `);

    // 6. Seed published reviews for prod_alpha (auto-increment id)
    await testPool.query(`
      INSERT INTO reviews (product_id, user_id, order_item_id, rating, title, body, status, created_at)
      VALUES 
      ('prod_alpha', '${testUser.id}', 'item_3_1', 5, 'Superb shoes!', 'Extremely comfortable for long runs.', 'published', DATE_SUB(NOW(), INTERVAL 4 DAY)),
      ('prod_alpha', 'user_step3_other', 'item_mock_other', 4, 'Very solid quality', 'Good cushioning and fit is true to size.', 'published', DATE_SUB(NOW(), INTERVAL 2 DAY)),
      ('prod_alpha', 'user_step3_other', 'item_mock_other2', 1, 'Color differs slightly', 'Disappointed with color shading.', 'published', DATE_SUB(NOW(), INTERVAL 1 DAY)),
      ('prod_alpha', 'user_step3_other', 'item_mock_other3', 2, 'Spam review', 'Spam content here', 'hidden', NOW())
    `);

    // 7. Mount Express test app
    app = express();
    app.use(express.json());

    testUserToken = createSignedToken({
      sub: testUser.id,
      email: testUser.email,
      username: 'alicew',
      role: 'customer',
      is_staff: false,
      is_superuser: false,
      type: 'access',
    });

    app.use('/api/products', productsRouter);
    app.use('/api/orders', ordersRouter);
    app.use('/api/reviews', reviewsRouter);

    await getDbPool();

    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        serverUrl = `http://127.0.0.1:${addr.port}`;
        resolve(true);
      });
    });
  } catch (err) {
    console.error('*** [BEFORE HOOK ERROR] ***:', err);
    throw err;
  }
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (testPool) {
      await testPool.end();
    }
    if (rootPool) {
      await rootPool.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
      await rootPool.end();
    }
    await closeDbPool();
    setTimeout(() => process.exit(0), 100);
  });

  describe('1. Single Aggregate Query Review Summary Endpoint', () => {
    it('GET /api/products/:id/reviews/summary returns accurate aggregate counts, average, and star distribution', async () => {
      const res = await fetch(`${serverUrl}/api/products/prod_alpha/reviews/summary`);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.productId, 'prod_alpha');

      // Published reviews: 5★, 4★, 1★ (hidden 2★ ignored)
      // Total = 3
      assert.strictEqual(data.total, 3);
      // Average: (5 + 4 + 1) / 3 = 10 / 3 = 3.3
      assert.strictEqual(data.average, 3.3);

      // Count per star distribution
      assert.strictEqual(Number(data.countPerStar[5]), 1);
      assert.strictEqual(Number(data.countPerStar[4]), 1);
      assert.strictEqual(Number(data.countPerStar[3]), 0);
      assert.strictEqual(Number(data.countPerStar[2]), 0);
      assert.strictEqual(Number(data.countPerStar[1]), 1);

      // Distribution alias for frontend compatibility
      assert.strictEqual(Number(data.distribution[5]), 1);
      assert.strictEqual(Number(data.distribution[4]), 1);
      assert.strictEqual(Number(data.distribution[3]), 0);
      assert.strictEqual(Number(data.distribution[2]), 0);
      assert.strictEqual(Number(data.distribution[1]), 1);
    });

    it('GET /api/products/:id/reviews/summary returns zero stats for unreviewed product', async () => {
      const res = await fetch(`${serverUrl}/api/products/prod_gamma/reviews/summary`);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.total, 0);
      assert.strictEqual(data.average, 0);
      assert.deepStrictEqual(data.countPerStar, {
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0,
      });
    });
  });

  describe('2. Public Paginated and Sorted Reviews Endpoint', () => {
    it('GET /api/products/:id/reviews supports pagination with limit and page', async () => {
      const res = await fetch(`${serverUrl}/api/products/prod_alpha/reviews?page=1&limit=2`);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.reviews.length, 2);
      assert.strictEqual(data.page, 1);
      assert.strictEqual(data.limit, 2);
      assert.strictEqual(data.matchingTotal, 3);
      assert.strictEqual(data.totalPages, 2);

      // Verify each review item properties
      for (const rev of data.reviews) {
        assert.ok(rev.id);
        assert.ok(rev.title);
        assert.ok(rev.body);
        assert.strictEqual(rev.verifiedPurchase, true);
        assert.ok(rev.reviewerDisplayName);
      }

      // Verify embedded summary object matches aggregate
      assert.strictEqual(data.summary.totalCount, 3);
      assert.strictEqual(data.summary.average, 3.3);
      assert.strictEqual(Number(data.summary.distribution[5]), 1);
      assert.strictEqual(Number(data.summary.distribution[4]), 1);
      assert.strictEqual(Number(data.summary.distribution[3]), 0);
      assert.strictEqual(Number(data.summary.distribution[2]), 0);
      assert.strictEqual(Number(data.summary.distribution[1]), 1);
    });

    it('GET /api/products/:id/reviews supports sort=highest and sort=lowest', async () => {
      // Highest first: 5★ then 4★ then 1★
      const resHigh = await fetch(`${serverUrl}/api/products/prod_alpha/reviews?sort=highest`);
      assert.strictEqual(resHigh.status, 200);
      const dataHigh = await resHigh.json();
      assert.strictEqual(dataHigh.reviews[0].rating, 5);
      assert.strictEqual(dataHigh.reviews[2].rating, 1);

      // Lowest first: 1★ then 4★ then 5★
      const resLow = await fetch(`${serverUrl}/api/products/prod_alpha/reviews?sort=lowest`);
      assert.strictEqual(resLow.status, 200);
      const dataLow = await resLow.json();
      assert.strictEqual(dataLow.reviews[0].rating, 1);
      assert.strictEqual(dataLow.reviews[2].rating, 5);
    });

    it('GET /api/products/:id/reviews filters by rating', async () => {
      const res = await fetch(`${serverUrl}/api/products/prod_alpha/reviews?rating=5`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.reviews.length, 1);
      assert.strictEqual(data.reviews[0].rating, 5);
      assert.strictEqual(data.reviews[0].title, 'Superb shoes!');
    });
  });

  describe('3. Order Review State Enrichment (Single Batch Query)', () => {
    it('enrichOrdersWithReviewEligibility properly enriches items with canReview and hasReviewed', async () => {
      const rawOrders = [
        { id: 'ord_1', status: 'delivered', deliveryConfirmed: true },
        { id: 'ord_2', status: 'pending', deliveryConfirmed: false },
        { id: 'ord_3', status: 'completed', deliveryConfirmed: true },
        { id: 'ord_4', status: 'cancelled', deliveryConfirmed: false },
      ];

      const enriched = await enrichOrdersWithReviewEligibility(rawOrders);
      assert.strictEqual(enriched.length, 4);

      // ord_1: delivered with 2 items, neither reviewed yet -> unreviewedCount = 2
      const ord1 = enriched.find((o) => o.id === 'ord_1');
      assert.strictEqual(ord1.unreviewedCount, 2);
      assert.strictEqual(ord1.items.length, 2);
      assert.strictEqual(ord1.items[0].canReview, true);
      assert.strictEqual(ord1.items[0].hasReviewed, false);
      assert.strictEqual(ord1.items[1].canReview, true);
      assert.strictEqual(ord1.items[1].hasReviewed, false);

      // ord_2: pending -> canReview must be false
      const ord2 = enriched.find((o) => o.id === 'ord_2');
      assert.strictEqual(ord2.unreviewedCount, 0);
      assert.strictEqual(ord2.items[0].canReview, false);
      assert.strictEqual(ord2.items[0].hasReviewed, false);

      // ord_3: completed, item_3_1 was reviewed -> canReview = false, hasReviewed = true, rating = 5
      const ord3 = enriched.find((o) => o.id === 'ord_3');
      assert.strictEqual(ord3.unreviewedCount, 0);
      assert.strictEqual(ord3.items[0].canReview, false);
      assert.strictEqual(ord3.items[0].hasReviewed, true);
      assert.strictEqual(ord3.items[0].rating, 5);
      assert.ok(ord3.items[0].reviewId);

      // ord_4: cancelled -> canReview must be false
      const ord4 = enriched.find((o) => o.id === 'ord_4');
      assert.strictEqual(ord4.unreviewedCount, 0);
      assert.strictEqual(ord4.items[0].canReview, false);
    });

    it('GET /api/orders returns enriched orders with unreviewedCount', async () => {
      const res = await fetch(`${serverUrl}/api/orders`, {
        headers: { Authorization: `Bearer ${testUserToken}` },
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      const orders = data.orders || data;
      assert.ok(Array.isArray(orders));

      const ord1 = orders.find((o) => o.id === 'ord_1');
      assert.ok(ord1);
      assert.strictEqual(ord1.unreviewedCount, 2);
      assert.strictEqual(ord1.items.length, 2);
      assert.strictEqual(ord1.items[0].canReview, true);
    });

    it('GET /api/orders/:id returns enriched order with item review status', async () => {
      const res = await fetch(`${serverUrl}/api/orders/ord_3`, {
        headers: { Authorization: `Bearer ${testUserToken}` },
      });
      assert.strictEqual(res.status, 200);

      const ord = await res.json();
      assert.strictEqual(ord.id, 'ord_3');
      assert.strictEqual(ord.unreviewedCount, 0);
      assert.strictEqual(ord.items[0].hasReviewed, true);
      assert.strictEqual(ord.items[0].rating, 5);
      assert.strictEqual(ord.items[0].canReview, false);
    });
  });

  describe('4. ?needsReview=true Filter on Orders', () => {
    it('GET /api/orders?needsReview=true returns only delivered orders with unreviewed items', async () => {
      const res = await fetch(`${serverUrl}/api/orders?needsReview=true`, {
        headers: { Authorization: `Bearer ${testUserToken}` },
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      const orders = data.orders || data;
      assert.ok(Array.isArray(orders));

      // ord_1 should be returned (unreviewedCount = 2)
      const ord1 = orders.find((o) => o.id === 'ord_1');
      assert.ok(ord1, 'ord_1 must be present in needsReview list');
      assert.strictEqual(ord1.unreviewedCount, 2);

      // ord_2 (pending), ord_3 (already reviewed), ord_4 (cancelled) must NOT be returned
      const ord2 = orders.find((o) => o.id === 'ord_2');
      const ord3 = orders.find((o) => o.id === 'ord_3');
      const ord4 = orders.find((o) => o.id === 'ord_4');
      assert.strictEqual(ord2, undefined, 'Pending order ord_2 must not appear in needsReview');
      assert.strictEqual(ord3, undefined, 'Fully reviewed order ord_3 must not appear in needsReview');
      assert.strictEqual(ord4, undefined, 'Cancelled order ord_4 must not appear in needsReview');
    });
  });

  describe('5. Review Submission, Seamless Edit Mode, and State Updates', () => {
    it('POST /api/reviews submits a review, updates order unreviewedCount, and supports seamless edit mode', async () => {
      // Step A: Check eligibility on unreviewed item_1_1
      const eligRes = await fetch(`${serverUrl}/api/reviews/check-eligibility`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          orderItemId: 'item_1_1',
        }),
      });
      assert.strictEqual(eligRes.status, 200);
      const eligData = await eligRes.json();
      assert.strictEqual(eligData.eligible, true);
      assert.strictEqual(eligData.reason, 'ELIGIBLE');

      // Step B: Submit review for item_1_1
      const submitRes = await fetch(`${serverUrl}/api/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          orderItemId: 'item_1_1',
          rating: 4,
          title: 'Great fit and comfort',
          body: 'Ran 10km in them this morning, cushioning is outstanding.',
        }),
      });
      assert.strictEqual(submitRes.status, 201);
      const submitData = await submitRes.json();
      assert.strictEqual(submitData.success, true);
      assert.ok(submitData.review.id);
      assert.strictEqual(submitData.review.rating, 4);

      // Step C: Re-check eligibility on item_1_1 - detects already reviewed item and provides existingReview for edit mode
      const editCheckRes = await fetch(`${serverUrl}/api/reviews/check-eligibility`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          orderItemId: 'item_1_1',
        }),
      });
      assert.strictEqual(editCheckRes.status, 200);
      const editCheckData = await editCheckRes.json();
      assert.strictEqual(editCheckData.reason, 'ALREADY_REVIEWED');
      assert.ok(editCheckData.existingReview);
      assert.strictEqual(editCheckData.existingReview.rating, 4);
      assert.strictEqual(editCheckData.existingReview.title, 'Great fit and comfort');

      // Step D: Re-fetch ord_1 - unreviewedCount should decrease from 2 to 1
      const orderRes = await fetch(`${serverUrl}/api/orders/ord_1`, {
        headers: { Authorization: `Bearer ${testUserToken}` },
      });
      assert.strictEqual(orderRes.status, 200);
      const updatedOrd1 = await orderRes.json();
      assert.strictEqual(updatedOrd1.unreviewedCount, 1);

      const item1 = updatedOrd1.items.find((it) => it.id === 'item_1_1');
      assert.strictEqual(item1.canReview, false);
      assert.strictEqual(item1.hasReviewed, true);
      assert.strictEqual(item1.rating, 4);

      const item2 = updatedOrd1.items.find((it) => it.id === 'item_1_2');
      assert.strictEqual(item2.canReview, true);
      assert.strictEqual(item2.hasReviewed, false);

      // Step E: Verify product summary for prod_alpha updated (was 3 reviews, now 4 reviews)
      const sumRes = await fetch(`${serverUrl}/api/products/prod_alpha/reviews/summary`);
      assert.strictEqual(sumRes.status, 200);
      const sumData = await sumRes.json();
      assert.strictEqual(sumData.total, 4);
      // (5 + 4 + 1 + 4) / 4 = 14 / 4 = 3.5
      assert.strictEqual(sumData.average, 3.5);
      assert.strictEqual(sumData.countPerStar[4], 2);
    });

    it('Flexible review eligibility resolves order items by product_id with orderId and automatically backfills legacy JSON orders', async () => {
      // 1. Resolve item_1_2 on delivered ord_1 using product_id instead of exact item ID
      const resByProd = await fetch(`${serverUrl}/api/reviews/eligibility/prod_beta?orderId=ord_1`, {
        headers: { Authorization: `Bearer ${testUserToken}` },
      });
      assert.strictEqual(resByProd.status, 200);
      const prodData = await resByProd.json();
      assert.strictEqual(prodData.success, true);
      assert.strictEqual(prodData.eligible, true);
      assert.strictEqual(prodData.item.id, 'item_1_2');
      assert.strictEqual(prodData.item.product_id, 'prod_beta');

      // 2. Insert a legacy completed order with items only in JSON (no order_items rows)
      await testPool.query(`
        INSERT INTO orders (id, customerName, customerEmail, total, status, date, deliveryConfirmed, items, created_at)
        VALUES ('ord_legacy', 'Alice Wambui', 'step3_customer@example.com', 1500, 'completed', '2026-10-18', 1, ?, NOW())
      `, [JSON.stringify([{ id: 'leg_item_1', productId: 'prod_beta', name: 'Beta Sport Cap', price: 1500, quantity: 1 }])]);

      // 3. Verify eligibility check automatically backfills order_items and returns eligible = true
      const resLegacy = await fetch(`${serverUrl}/api/reviews/eligibility/leg_item_1?orderId=ord_legacy`, {
        headers: { Authorization: `Bearer ${testUserToken}` },
      });
      assert.strictEqual(resLegacy.status, 200);
      const legacyData = await resLegacy.json();
      assert.strictEqual(legacyData.success, true);
      assert.strictEqual(legacyData.eligible, true);
      assert.ok(legacyData.item.id);
      assert.strictEqual(legacyData.item.product_id, 'prod_beta');

      // 4. Submit review for this backfilled order item
      const submitLegacyRes = await fetch(`${serverUrl}/api/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          orderItemId: legacyData.item.id,
          orderId: 'ord_legacy',
          rating: 5,
          title: 'Outstanding legacy cap',
          body: 'Love this cap, great fit and durable stitching.',
        }),
      });
      assert.strictEqual(submitLegacyRes.status, 201);
      const submitLegacyData = await submitLegacyRes.json();
      assert.strictEqual(submitLegacyData.success, true);
      assert.strictEqual(submitLegacyData.review.rating, 5);
    });
  });
});
