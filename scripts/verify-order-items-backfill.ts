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
 * 4. Itemized list of any orders skipped (malformed JSON, empty items) with exact reason.
 * 5. Discrepancy report: Every difference between JSON items and order_items rows.
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
  skippedOrders: Array<{ orderId: string; reason: string }>;
  discrepancies: Array<{ orderId: string; jsonCount: number; tableCount: number; reason: string }>;
  productsRetainedWithNullFk: number;
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

    // 3. Count products with NULL foreign key (deleted from catalog but preserved in orders)
    const [nullFkRes]: any = await pool.query('SELECT COUNT(*) as count FROM order_items WHERE product_id IS NULL');
    const productsRetainedWithNullFk = Number(nullFkRes[0]?.count || 0);

    // 4. Group order_items count by order_id
    const [itemsByOrderRows]: any = await pool.query('SELECT order_id, COUNT(*) as count FROM order_items GROUP BY order_id');
    const tableCountsByOrder = new Map<string, number>();
    for (const r of itemsByOrderRows) {
      tableCountsByOrder.set(String(r.order_id), Number(r.count));
    }

    // 5. Inspect every order in database
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
    console.log(`5. Items preserved with NULL product_id:    ${productsRetainedWithNullFk}`);
    console.log(`6. Skipped orders count:                    ${skippedOrders.length}`);
    console.log(`7. Total count difference:                  ${difference}`);

    if (skippedOrders.length > 0) {
      console.log(`\n--- Skipped Orders Breakdown (${skippedOrders.length}) ---`);
      skippedOrders.forEach((s) => console.log(`  - [${s.orderId}]: ${s.reason}`));
    }

    if (discrepancies.length > 0) {
      console.log(`\n❌ Discrepancies detected between JSON items and order_items table:`);
      discrepancies.forEach((d) => console.log(`  - Order ${d.orderId}: JSON=${d.jsonCount}, Table=${d.tableCount} (${d.reason})`));
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
      skippedOrders,
      discrepancies,
      productsRetainedWithNullFk,
    };
  } finally {
    await pool.end();
  }
}

// Direct execution from CLI
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
