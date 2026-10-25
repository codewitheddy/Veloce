/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Production cPanel Standalone Verification Script (CommonJS / Plain Node)
 * 
 * Run on cPanel terminal:
 *   node scripts/verify-order-items-backfill.cjs
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

function getDbHost() {
  let host = (process.env.DB_HOST || '127.0.0.1').trim();
  if (host === 'localhhost' || host === 'localhost') host = '127.0.0.1';
  return host;
}

function getDbUser() {
  return (process.env.DB_USER || 'root').trim();
}

function getDbPassword() {
  return process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '';
}

function getDbName() {
  return (process.env.DB_NAME || 'ropenix').trim();
}

function getDbPort() {
  return Number(process.env.DB_PORT) || 3306;
}

async function verifyOrderItemsBackfill(customDbName) {
  const targetDb = (customDbName || getDbName()).trim();
  console.log(`\n================================================================`);
  console.log(`[Verification] Auditing order_items backfill in DB: ${targetDb}`);
  console.log(`================================================================`);

  const pool = mysql.createPool({
    host: getDbHost(),
    user: getDbUser(),
    password: getDbPassword(),
    port: getDbPort(),
    database: targetDb,
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    const [ordersCountRes] = await pool.query('SELECT COUNT(*) as count FROM orders');
    const totalOrders = Number(ordersCountRes[0] ? ordersCountRes[0].count : 0);

    const [orderItemsCountRes] = await pool.query('SELECT COUNT(*) as count FROM order_items');
    const totalOrderItemsRows = Number(orderItemsCountRes[0] ? orderItemsCountRes[0].count : 0);

    const [linkedRes] = await pool.query('SELECT COUNT(*) as count FROM order_items WHERE product_id IS NOT NULL');
    const itemsLinkedToProduct = Number(linkedRes[0] ? linkedRes[0].count : 0);

    const [nullFkRes] = await pool.query('SELECT COUNT(*) as count FROM order_items WHERE product_id IS NULL');
    const itemsWithNullProductId = Number(nullFkRes[0] ? nullFkRes[0].count : 0);

    const [sampleLinkedRows] = await pool.query(
      `SELECT oi.order_id, oi.name, oi.product_id 
       FROM order_items oi 
       WHERE oi.product_id IS NOT NULL 
       LIMIT 5`
    );
    const sampleLinkedItems = (sampleLinkedRows || []).map((r) => ({
      orderId: String(r.order_id),
      itemName: String(r.name),
      productId: String(r.product_id),
    }));

    const [sampleUnlinkedRows] = await pool.query(
      `SELECT oi.order_id, oi.name, o.items 
       FROM order_items oi 
       JOIN orders o ON o.id = oi.order_id 
       WHERE oi.product_id IS NULL 
       LIMIT 5`
    );
    const sampleUnlinkedItems = [];
    for (const r of sampleUnlinkedRows || []) {
      let rawPid = 'not_found';
      try {
        const parsed = typeof r.items === 'string' ? JSON.parse(r.items) : r.items;
        if (Array.isArray(parsed)) {
          const matched = parsed.find((it) => String(it.name).trim() === String(r.name).trim());
          if (matched) rawPid = String(matched.productId || matched.product_id || matched.id || 'unknown');
        }
      } catch (_) {}
      sampleUnlinkedItems.push({
        orderId: String(r.order_id),
        itemName: String(r.name),
        rawPid,
      });
    }

    const [itemsByOrderRows] = await pool.query(
      'SELECT order_id, COUNT(*) as count FROM order_items GROUP BY order_id'
    );
    const tableCountsByOrder = new Map();
    for (const r of itemsByOrderRows) {
      tableCountsByOrder.set(String(r.order_id), Number(r.count));
    }

    const [allOrders] = await pool.query('SELECT id, items FROM orders ORDER BY id ASC');

    let ordersWithItems = 0;
    let totalJsonItems = 0;
    const skippedOrders = [];
    const discrepancies = [];

    for (const order of allOrders) {
      const orderId = String(order.id);
      const tableCount = tableCountsByOrder.get(orderId) || 0;

      if (!order.items) {
        skippedOrders.push({ orderId, reason: 'Empty or NULL items column' });
        if (tableCount > 0) {
          discrepancies.push({
            orderId,
            jsonCount: 0,
            tableCount,
            reason: 'order_items table has rows but orders.items is NULL',
          });
        }
        continue;
      }

      let parsed = null;
      try {
        parsed = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      } catch (err) {
        skippedOrders.push({ orderId, reason: `Malformed JSON in items: ${err.message}` });
        if (tableCount > 0) {
          discrepancies.push({
            orderId,
            jsonCount: 0,
            tableCount,
            reason: 'order_items table has rows but orders.items is malformed JSON',
          });
        }
        continue;
      }

      if (!Array.isArray(parsed)) {
        skippedOrders.push({ orderId, reason: 'Parsed items is not an array' });
        continue;
      }

      if (parsed.length === 0) {
        skippedOrders.push({ orderId, reason: 'Parsed items array is empty ([])' });
        continue;
      }

      ordersWithItems++;
      const jsonItemCount = parsed.length;
      totalJsonItems += jsonItemCount;

      if (jsonItemCount !== tableCount) {
        discrepancies.push({
          orderId,
          jsonCount: jsonItemCount,
          tableCount,
          reason: `Count mismatch (JSON has ${jsonItemCount}, order_items table has ${tableCount})`,
        });
      }
    }

    const difference = Math.abs(totalJsonItems - totalOrderItemsRows);
    const passed = difference === 0 && discrepancies.length === 0;

    console.log(`1. Total orders in orders table:            ${totalOrders}`);
    console.log(`2. Orders with valid non-empty items JSON:  ${ordersWithItems}`);
    console.log(`3. Total item entries parsed from JSON:     ${totalJsonItems}`);
    console.log(`4. Total rows stored in order_items table:  ${totalOrderItemsRows}`);
    console.log(`5. Total count difference:                  ${difference}`);
    console.log(`\n--- Product Linking Breakdown ---`);
    console.log(`  (a) Items linked to active catalog product:  ${itemsLinkedToProduct}`);
    console.log(`  (b) Items with NULL product_id (deleted):    ${itemsWithNullProductId}`);

    if (sampleLinkedItems.length > 0) {
      console.log(`\n--- Examples of Items Linked to Catalog Products ---`);
      sampleLinkedItems.forEach((m) =>
        console.log(`  - Order ${m.orderId}: "${m.itemName}" -> linked to product ID "${m.productId}"`)
      );
    }

    if (sampleUnlinkedItems.length > 0) {
      console.log(`\n--- Examples of Items Retained with NULL product_id (No longer in catalog) ---`);
      sampleUnlinkedItems.forEach((u) =>
        console.log(`  - Order ${u.orderId}: "${u.itemName}" (original ID: "${u.rawPid}") -> product truly deleted; snapshot preserved with product_id = NULL`)
      );
    }

    if (skippedOrders.length > 0) {
      console.log(`\n--- Skipped Orders Breakdown (${skippedOrders.length}) ---`);
      skippedOrders.forEach((s) => console.log(`  - [${s.orderId}]: ${s.reason}`));
    }

    if (discrepancies.length > 0) {
      console.log(`\n❌ Discrepancies detected between JSON items and order_items table:`);
      discrepancies.forEach((d) =>
        console.log(`  - Order ${d.orderId}: JSON=${d.jsonCount}, Table=${d.tableCount} (${d.reason})`)
      );
    } else {
      console.log(`\n✅ Count Verification: PERFECT MATCH (0 discrepancies)`);
    }

    console.log(`================================================================\n`);

    return {
      database: targetDb,
      totalOrders,
      ordersWithItems,
      totalJsonItems,
      totalOrderItemsRows,
      difference,
      passed,
      itemsLinkedToProduct,
      itemsWithNullProductId,
      sampleLinkedItems,
      sampleUnlinkedItems,
      skippedOrders,
      discrepancies,
    };
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].includes('verify-order-items-backfill')) {
  const args = process.argv.slice(2);
  const dbIdx = args.indexOf('--db');
  const customDb = dbIdx !== -1 ? args[dbIdx + 1] : undefined;

  verifyOrderItemsBackfill(customDb)
    .then((report) => {
      if (report.passed) {
        console.log('[Verification Result] AUDIT PASSED: order_items exactly matches orders JSON data.');
        process.exit(0);
      } else {
        console.error('[Verification Result] AUDIT FAILED: Discrepancy between JSON and order_items.');
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('[Verification Error] Audit script encountered fatal error:', err);
      process.exit(1);
    });
}

module.exports = { verifyOrderItemsBackfill };
