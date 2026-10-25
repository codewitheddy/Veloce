/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Standalone Idempotent Backfill Script: orders.items JSON -> order_items Table
 * 
 * Safeguards:
 * 1. Processed in configurable batches (default 100).
 * 2. Idempotent: Uses deterministic IDs and INSERT IGNORE, safe to re-run.
 * 3. Tolerates missing products: Checks product existence; sets product_id = NULL
 *    if the product was deleted, preserving snapshot name/price.
 * 4. Resilient: Logs and skips malformed JSON without crashing.
 * 5. Supports --dry-run and custom --db parameters.
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { getDbHost, getDbUser, getDbPassword, getDbPort, getDbName } from '../src/lib/mysql-db';

dotenv.config();

export interface BackfillOptions {
  batchSize?: number;
  dbName?: string;
  dryRun?: boolean;
}

export interface BackfillStats {
  totalOrders: number;
  processedOrders: number;
  ordersWithItems: number;
  totalJsonItems: number;
  insertedOrderItems: number;
  skippedOrders: Array<{ orderId: string; reason: string }>;
  productsFound: number;
  productsMissingOrNull: number;
}

export async function runOrderItemsBackfill(options: BackfillOptions = {}): Promise<BackfillStats> {
  const batchSize = Math.max(1, options.batchSize || 100);
  const targetDb = (options.dbName || getDbName()).trim();
  const dryRun = Boolean(options.dryRun);

  console.log(`[Backfill] Starting order_items backfill on database: ${targetDb}`);
  console.log(`[Backfill] Mode: ${dryRun ? 'DRY-RUN (No writes)' : 'LIVE EXECUTION'}`);
  console.log(`[Backfill] Batch size: ${batchSize}`);

  const pool = mysql.createPool({
    host: getDbHost(),
    user: getDbUser(),
    password: getDbPassword(),
    port: getDbPort(),
    database: targetDb,
    waitForConnections: true,
    connectionLimit: 5,
  });

  const stats: BackfillStats = {
    totalOrders: 0,
    processedOrders: 0,
    ordersWithItems: 0,
    totalJsonItems: 0,
    insertedOrderItems: 0,
    skippedOrders: [],
    productsFound: 0,
    productsMissingOrNull: 0,
  };

  try {
    // 1. Verify order_items table exists
    const [tables]: any = await pool.query(
      `SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = 'order_items'`,
      [targetDb]
    );
    if (!tables[0]?.cnt) {
      throw new Error(`Target table 'order_items' does not exist in database '${targetDb}'. Run migration first.`);
    }

    // 2. Count total orders
    const [countRows]: any = await pool.query('SELECT COUNT(*) as count FROM orders');
    stats.totalOrders = Number(countRows[0]?.count || 0);
    console.log(`[Backfill] Total orders in database: ${stats.totalOrders}`);

    if (stats.totalOrders === 0) {
      console.log('[Backfill] No orders found to backfill.');
      return stats;
    }

    // 3. Cache valid product IDs in memory for fast FK resolution
    const [productRows]: any = await pool.query('SELECT id FROM products');
    const validProductIds = new Set<string>((productRows || []).map((p: any) => String(p.id)));
    console.log(`[Backfill] Found ${validProductIds.size} existing products in catalog for foreign key matching.`);

    // 4. Batch through all orders
    let offset = 0;
    while (offset < stats.totalOrders) {
      const [orderBatch]: any = await pool.query(
        'SELECT id, items, created_at, date FROM orders ORDER BY id ASC LIMIT ? OFFSET ?',
        [batchSize, offset]
      );

      if (!orderBatch || orderBatch.length === 0) break;

      const itemsToInsert: Array<[string, string, string | null, string, number, number, string | null, string]> = [];

      for (const order of orderBatch) {
        stats.processedOrders++;
        const orderId = String(order.id);

        if (!order.items) {
          stats.skippedOrders.push({ orderId, reason: 'Empty or NULL items column' });
          continue;
        }

        let parsedItems: any[] = [];
        try {
          parsedItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        } catch (jsonErr: any) {
          stats.skippedOrders.push({ orderId, reason: `Malformed JSON: ${jsonErr.message}` });
          continue;
        }

        if (!Array.isArray(parsedItems)) {
          stats.skippedOrders.push({ orderId, reason: 'Items value is not an array' });
          continue;
        }

        if (parsedItems.length === 0) {
          stats.skippedOrders.push({ orderId, reason: 'Items array is empty ([])' });
          continue;
        }

        stats.ordersWithItems++;
        stats.totalJsonItems += parsedItems.length;

        // Process each item in order
        parsedItems.forEach((item, index) => {
          const rawItemId = item.id ? String(item.id).trim() : '';
          const deterministicId = rawItemId && rawItemId !== 'undefined' && rawItemId !== '[object Object]'
            ? `oi_${orderId}_${rawItemId}`
            : `oi_${orderId}_${index}`;

          const rawProductId = String(item.productId || item.product_id || item.product || item.id || '').trim();
          let matchedProductId: string | null = null;

          if (rawProductId && validProductIds.has(rawProductId)) {
            matchedProductId = rawProductId;
            stats.productsFound++;
          } else {
            stats.productsMissingOrNull++;
          }

          const itemName = String(item.name || item.product_name || item.title || 'Ordered Item').trim();
          const itemPrice = typeof item.price === 'number'
            ? item.price
            : parseFloat(item.unit_price || item.price || '0') || 0;
          const itemQuantity = Math.max(1, parseInt(String(item.quantity || 1), 10) || 1);
          const variations = item.selectedVariations || item.selected_variations
            ? JSON.stringify(item.selectedVariations || item.selected_variations)
            : null;

          const createdAt = order.created_at || order.date || new Date().toISOString();

          itemsToInsert.push([
            deterministicId,
            orderId,
            matchedProductId,
            itemName,
            itemPrice,
            itemQuantity,
            variations,
            createdAt,
          ]);
        });
      }

      // Batch insert with INSERT IGNORE to guarantee idempotency
      if (itemsToInsert.length > 0 && !dryRun) {
        const insertSql = `
          INSERT IGNORE INTO order_items 
            (id, order_id, product_id, name, price, quantity, selected_variations, created_at)
          VALUES ?
        `;
        const [insertRes]: any = await pool.query(insertSql, [itemsToInsert]);
        stats.insertedOrderItems += insertRes.affectedRows || 0;
      } else if (itemsToInsert.length > 0 && dryRun) {
        stats.insertedOrderItems += itemsToInsert.length;
      }

      offset += batchSize;
      console.log(`[Backfill] Processed ${stats.processedOrders} / ${stats.totalOrders} orders...`);
    }

    console.log('[Backfill] ✅ Order items backfill completed.');
    console.log('---------------------------------------------------------');
    console.log(`Total orders inspected:       ${stats.totalOrders}`);
    console.log(`Orders with valid items JSON: ${stats.ordersWithItems}`);
    console.log(`Total items in JSON:          ${stats.totalJsonItems}`);
    console.log(`Rows inserted in order_items: ${stats.insertedOrderItems}`);
    console.log(`Items matched to catalog:     ${stats.productsFound}`);
    console.log(`Items with NULL product_id:   ${stats.productsMissingOrNull} (product no longer exists)`);
    console.log(`Orders skipped:               ${stats.skippedOrders.length}`);
    if (stats.skippedOrders.length > 0) {
      console.log('Skipped orders sample:');
      stats.skippedOrders.slice(0, 10).forEach((s) => console.log(`  - Order ${s.orderId}: ${s.reason}`));
    }
    console.log('---------------------------------------------------------');

    return stats;
  } finally {
    await pool.end();
  }
}

// Direct execution from CLI
if (process.argv[1] && process.argv[1].includes('backfill-order-items')) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const batchIdx = args.indexOf('--batch-size');
  const batchSize = batchIdx !== -1 ? parseInt(args[batchIdx + 1], 10) : 100;
  const dbIdx = args.indexOf('--db');
  const dbName = dbIdx !== -1 ? args[dbIdx + 1] : undefined;

  runOrderItemsBackfill({ batchSize, dbName, dryRun })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Backfill Error] Fatal execution error:', err);
      process.exit(1);
    });
}
