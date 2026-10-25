/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Production cPanel Standalone Backfill Script (CommonJS / Plain Node)
 * 
 * Run on cPanel terminal:
 *   node scripts/backfill-order-items.cjs
 * Or with custom batch size:
 *   node scripts/backfill-order-items.cjs --batch-size 50
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

async function runOrderItemsBackfill(options = {}) {
  const batchSize = Math.max(1, options.batchSize || 100);
  const targetDb = (options.dbName || getDbName()).trim();
  const dryRun = Boolean(options.dryRun);

  console.log(`\n=========================================================`);
  console.log(`[Backfill] Starting order_items backfill on database: ${targetDb}`);
  console.log(`[Backfill] Mode: ${dryRun ? 'DRY-RUN (No writes)' : 'LIVE EXECUTION'}`);
  console.log(`[Backfill] Batch size: ${batchSize}`);
  console.log(`=========================================================`);

  const pool = mysql.createPool({
    host: getDbHost(),
    user: getDbUser(),
    password: getDbPassword(),
    port: getDbPort(),
    database: targetDb,
    waitForConnections: true,
    connectionLimit: 5,
  });

  const stats = {
    totalOrders: 0,
    processedOrders: 0,
    ordersWithItems: 0,
    totalJsonItems: 0,
    insertedOrderItems: 0,
    productsFound: 0,
    productsMissingOrNull: 0,
    skippedOrders: [],
    sampleMatched: [],
    sampleMissing: [],
  };

  try {
    const [tables] = await pool.query(
      `SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = 'order_items'`,
      [targetDb]
    );
    if (!tables[0] || !tables[0].cnt) {
      throw new Error(`Target table 'order_items' does not exist in database '${targetDb}'. Run migration first.`);
    }

    const [countRows] = await pool.query('SELECT COUNT(*) as count FROM orders');
    stats.totalOrders = Number(countRows[0] ? countRows[0].count : 0);
    console.log(`[Backfill] Total orders in database: ${stats.totalOrders}`);

    if (stats.totalOrders === 0) {
      console.log('[Backfill] No orders found to backfill.');
      return stats;
    }

    const [productRows] = await pool.query('SELECT id, slug, name FROM products');
    const validProductIds = new Set();
    const slugToIdMap = new Map();
    const nameToIdMap = new Map();

    for (const p of productRows || []) {
      const pid = String(p.id).trim();
      validProductIds.add(pid);
      if (p.slug) slugToIdMap.set(String(p.slug).trim().toLowerCase(), pid);
      if (p.name) nameToIdMap.set(String(p.name).trim().toLowerCase(), pid);
    }

    console.log(`[Backfill] Catalog indexed: ${validProductIds.size} products available for linking.`);

    let offset = 0;
    while (offset < stats.totalOrders) {
      const [orderBatch] = await pool.query(
        'SELECT id, items, created_at, date FROM orders ORDER BY id ASC LIMIT ? OFFSET ?',
        [batchSize, offset]
      );

      if (!orderBatch || orderBatch.length === 0) break;

      const itemsToInsert = [];

      for (const order of orderBatch) {
        stats.processedOrders++;
        const orderId = String(order.id);

        if (!order.items) {
          stats.skippedOrders.push({ orderId, reason: 'Empty or NULL items column' });
          continue;
        }

        let parsedItems = [];
        try {
          parsedItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        } catch (jsonErr) {
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

        parsedItems.forEach((item, index) => {
          const rawItemId = item.id ? String(item.id).trim() : '';
          const deterministicId = rawItemId && rawItemId !== 'undefined' && rawItemId !== '[object Object]'
            ? `oi_${orderId}_${rawItemId}`
            : `oi_${orderId}_${index}`;

          const itemName = String(item.name || item.product_name || item.title || 'Ordered Item').trim();
          const rawPidCandidate = String(item.productId || item.product_id || item.product || '').trim();
          const rawIdCandidate = item.id && String(item.id).startsWith('prod-') ? String(item.id).trim() : '';
          const rawSlugCandidate = String(item.slug || item.productSlug || '').trim().toLowerCase();
          const normalizedName = itemName.toLowerCase();

          let matchedProductId = null;
          let matchMethod = 'none';

          if (rawPidCandidate && validProductIds.has(rawPidCandidate)) {
            matchedProductId = rawPidCandidate;
            matchMethod = 'direct_productId';
          } else if (rawIdCandidate && validProductIds.has(rawIdCandidate)) {
            matchedProductId = rawIdCandidate;
            matchMethod = 'item_id_fallback';
          } else if (rawSlugCandidate && slugToIdMap.has(rawSlugCandidate)) {
            matchedProductId = slugToIdMap.get(rawSlugCandidate) || null;
            matchMethod = 'slug_mapping';
          } else if (normalizedName && nameToIdMap.has(normalizedName)) {
            matchedProductId = nameToIdMap.get(normalizedName) || null;
            matchMethod = 'name_exact_match';
          }

          if (matchedProductId) {
            stats.productsFound++;
            if (stats.sampleMatched.length < 5) {
              stats.sampleMatched.push({ orderId, itemName, productId: matchedProductId, matchMethod });
            }
          } else {
            stats.productsMissingOrNull++;
            if (stats.sampleMissing.length < 5) {
              stats.sampleMissing.push({
                orderId,
                itemName,
                rawIdentifier: rawPidCandidate || rawIdCandidate || itemName || 'unknown',
              });
            }
          }

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

      if (itemsToInsert.length > 0 && !dryRun) {
        const insertSql = `
          INSERT IGNORE INTO order_items 
            (id, order_id, product_id, name, price, quantity, selected_variations, created_at)
          VALUES ?
        `;
        const [insertRes] = await pool.query(insertSql, [itemsToInsert]);
        stats.insertedOrderItems += (insertRes ? insertRes.affectedRows : 0) || 0;
      } else if (itemsToInsert.length > 0 && dryRun) {
        stats.insertedOrderItems += itemsToInsert.length;
      }

      offset += batchSize;
      console.log(`[Backfill] Processed ${stats.processedOrders} / ${stats.totalOrders} orders...`);
    }

    console.log('\n[Backfill] ✅ Order items backfill completed.');
    console.log('---------------------------------------------------------');
    console.log(`Total orders inspected:               ${stats.totalOrders}`);
    console.log(`Orders with valid items JSON:         ${stats.ordersWithItems}`);
    console.log(`Total items parsed from JSON:         ${stats.totalJsonItems}`);
    console.log(`Rows newly inserted in order_items:   ${stats.insertedOrderItems}`);
    console.log(`Items linked to catalog product:      ${stats.productsFound}`);
    console.log(`Items with NULL product_id:           ${stats.productsMissingOrNull} (product no longer exists in catalog)`);
    console.log(`Orders skipped:                       ${stats.skippedOrders.length}`);

    if (stats.sampleMatched.length > 0) {
      console.log('\n--- Sample Linked Items ---');
      stats.sampleMatched.forEach((m) =>
        console.log(`  - Order ${m.orderId}: "${m.itemName}" -> linked to product ${m.productId} via ${m.matchMethod}`)
      );
    }

    if (stats.sampleMissing.length > 0) {
      console.log('\n--- Sample Unlinked Items (Product no longer in products catalog) ---');
      stats.sampleMissing.forEach((m) =>
        console.log(`  - Order ${m.orderId}: "${m.itemName}" (original ID: "${m.rawIdentifier}") -> preserved with product_id = NULL`)
      );
    }

    if (stats.skippedOrders.length > 0) {
      console.log('\n--- Skipped Orders Breakdown ---');
      stats.skippedOrders.forEach((s) => console.log(`  - Order ${s.orderId}: ${s.reason}`));
    }
    console.log('---------------------------------------------------------\n');

    return stats;
  } finally {
    await pool.end();
  }
}

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

module.exports = { runOrderItemsBackfill };
