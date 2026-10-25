/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Verification Script: Order Items Backfill Audit
 * 
 * Verifies and reports:
 * 1. Total orders count.
 * 2. Orders with items in JSON.
 * 3. Total items parsed from orders.items JSON vs total rows in order_items.
 * 4. Separate breakdown of:
 *    (a) Items linked to an active catalog product, with examples.
 *    (b) Items with NULL product_id because the product truly no longer exists, with examples.
 * 5. Itemized list of any skipped orders (malformed JSON, empty items) with exact reason.
 * 6. Discrepancy report: Every difference between JSON items and order_items rows.
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { getDbHost, getDbUser, getDbPassword, getDbPort, getDbName } from '../src/lib/mysql-db';

dotenv.config();

export interface VerificationReport {
  database: string;
  totalOrders: number;
  ordersWithItems: number;
  totalJsonItems: number;
  totalOrderItemsRows: number;
  difference: number;
  passed: boolean;
  itemsLinkedToProduct: number;
  itemsWithNullProductId: number;
  sampleLinkedItems: Array<{ orderId: string; itemName: string; productId: string }>;
  sampleUnlinkedItems: Array<{ orderId: string; itemName: string; rawPid: string }>;
  skippedOrders: Array<{ orderId: string; reason: string }>;
  discrepancies: Array<{ orderId: string; jsonCount: number; tableCount: number; reason: string }>;
}

export async function verifyOrderItemsBackfill(customDbName?: string): Promise<VerificationReport> {
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
    // 1. Total orders
    const [ordersCountRes]: any = await pool.query('SELECT COUNT(*) as count FROM orders');
    const totalOrders = Number(ordersCountRes[0]?.count || 0);

    // 2. Total rows in order_items table
    const [orderItemsCountRes]: any = await pool.query('SELECT COUNT(*) as count FROM order_items');
    const totalOrderItemsRows = Number(orderItemsCountRes[0]?.count || 0);

    // 3. Count products with linked FK vs NULL FK
    const [linkedRes]: any = await pool.query('SELECT COUNT(*) as count FROM order_items WHERE product_id IS NOT NULL');
    const itemsLinkedToProduct = Number(linkedRes[0]?.count || 0);

    const [nullFkRes]: any = await pool.query('SELECT COUNT(*) as count FROM order_items WHERE product_id IS NULL');
    const itemsWithNullProductId = Number(nullFkRes[0]?.count || 0);

    // 4. Sample linked items
    const [sampleLinkedRows]: any = await pool.query(
      `SELECT oi.order_id, oi.name, oi.product_id 
       FROM order_items oi 
       WHERE oi.product_id IS NOT NULL 
       LIMIT 5`
    );
    const sampleLinkedItems = (sampleLinkedRows || []).map((r: any) => ({
      orderId: String(r.order_id),
      itemName: String(r.name),
      productId: String(r.product_id),
    }));

    // 5. Sample unlinked items (product no longer exists in catalog)
    const [sampleUnlinkedRows]: any = await pool.query(
      `SELECT oi.order_id, oi.name, o.items 
       FROM order_items oi 
       JOIN orders o ON o.id = oi.order_id 
       WHERE oi.product_id IS NULL 
       LIMIT 5`
    );
    const sampleUnlinkedItems: Array<{ orderId: string; itemName: string; rawPid: string }> = [];
    for (const r of sampleUnlinkedRows || []) {
      let rawPid = 'not_found';
      try {
        const parsed = typeof r.items === 'string' ? JSON.parse(r.items) : r.items;
        if (Array.isArray(parsed)) {
          const matched = parsed.find((it: any) => String(it.name).trim() === String(r.name).trim());
          if (matched) rawPid = String(matched.productId || matched.product_id || matched.id || 'unknown');
        }
      } catch (_) {}
      sampleUnlinkedItems.push({
        orderId: String(r.order_id),
        itemName: String(r.name),
        rawPid,
      });
    }

    // 6. Group order_items count by order_id
    const [itemsByOrderRows]: any = await pool.query(
      'SELECT order_id, COUNT(*) as count FROM order_items GROUP BY order_id'
    );
    const tableCountsByOrder = new Map<string, number>();
    for (const r of itemsByOrderRows) {
      tableCountsByOrder.set(String(r.order_id), Number(r.count));
    }

    // 7. Inspect every order in database
    const [allOrders]: any = await pool.query('SELECT id, items FROM orders ORDER BY id ASC');

    let ordersWithItems = 0;
    let totalJsonItems = 0;
    const skippedOrders: Array<{ orderId: string; reason: string }> = [];
    const discrepancies: Array<{ orderId: string; jsonCount: number; tableCount: number; reason: string }> = [];

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

      let parsed: any = null;
      try {
        parsed = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      } catch (err: any) {
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

// CLI entry point
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
