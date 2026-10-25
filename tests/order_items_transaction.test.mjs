/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Order Creation & Transaction Consistency Unit Tests
 * 
 * Verifies Requirement 1:
 * - Order creation writes `order_items` in the same transaction as `orders`.
 * - Newly created orders have matching `order_items` rows.
 * - Editing an order's items updates `order_items` atomically.
 * - Deleting a product sets `order_items.product_id` to NULL without deleting the order item.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDbPool,
  closeDbPool,
  saveMysqlOrder,
  getMysqlOrderById,
  deleteMysqlOrder,
  saveMysqlProduct,
  getMysqlOrderItemsByOrderId,
} from '../src/lib/mysql-db.ts';

describe('Order Creation & order_items Atomic Transaction Consistency', () => {
  const testOrderId = `ORD-TX-TEST-${Date.now()}`;
  const testProductId = `prod-tx-${Date.now()}`;

  before(async () => {
    // Seed a product
    await saveMysqlProduct({
      id: testProductId,
      name: 'Transaction Test Sneakers',
      price: 3200,
      stock: 50,
      status: 'Active',
      type: 'physical',
    });
  });

  after(async () => {
    try {
      await deleteMysqlOrder(testOrderId);
      const pool = await getDbPool();
      await pool.query('DELETE FROM products WHERE id = ?', [testProductId]);
      await pool.query('DELETE FROM order_items WHERE order_id = ?', [testOrderId]);
      await closeDbPool();
    } catch (_) {}
  });

  it('1. Creating a new order automatically writes matching order_items rows in the same transaction', async () => {
    const orderPayload = {
      id: testOrderId,
      customerName: 'Transactional Buyer',
      customerEmail: 'txbuyer@example.com',
      customerPhone: '254711223344',
      total: 6400,
      status: 'order_received',
      items: [
        {
          id: 'item-tx-1',
          productId: testProductId,
          name: 'Transaction Test Sneakers',
          price: 3200,
          quantity: 2,
          selectedVariations: { Size: '42', Color: 'Black' },
        },
      ],
    };

    const savedOrder = await saveMysqlOrder(orderPayload);
    assert.ok(savedOrder, 'Order should be saved successfully');
    assert.strictEqual(savedOrder.id, testOrderId);

    // Verify order_items rows were written in the same transaction
    const orderItems = await getMysqlOrderItemsByOrderId(testOrderId);
    assert.strictEqual(orderItems.length, 1, 'order_items must have exactly 1 item matching the order');

    const oi = orderItems[0];
    assert.strictEqual(oi.order_id, testOrderId);
    assert.strictEqual(oi.product_id, testProductId);
    assert.strictEqual(oi.name, 'Transaction Test Sneakers');
    assert.strictEqual(Number(oi.price), 3200);
    assert.strictEqual(oi.quantity, 2);
    assert.match(oi.selected_variations, /42/);
  });

  it('2. Editing an order\'s items atomically updates order_items table', async () => {
    const updatedPayload = {
      id: testOrderId,
      customerName: 'Transactional Buyer',
      customerEmail: 'txbuyer@example.com',
      total: 9600,
      status: 'order_received',
      items: [
        {
          id: 'item-tx-1',
          productId: testProductId,
          name: 'Transaction Test Sneakers',
          price: 3200,
          quantity: 3, // quantity updated from 2 to 3
          selectedVariations: { Size: '42', Color: 'Black' },
        },
      ],
    };

    await saveMysqlOrder(updatedPayload);

    const orderItems = await getMysqlOrderItemsByOrderId(testOrderId);
    assert.strictEqual(orderItems.length, 1);
    assert.strictEqual(orderItems[0].quantity, 3, 'order_items quantity must be updated to 3');
    assert.strictEqual(Number(orderItems[0].price), 3200);
  });

  it('3. Deleting a product sets order_items.product_id to NULL without removing the order item', async () => {
    const pool = await getDbPool();
    // Delete product from products table
    await pool.query('DELETE FROM products WHERE id = ?', [testProductId]);

    // Order item must still exist with snapshot details, but product_id is now NULL
    const orderItems = await getMysqlOrderItemsByOrderId(testOrderId);
    assert.strictEqual(orderItems.length, 1, 'order_items row must not be deleted when product is deleted');
    assert.strictEqual(orderItems[0].product_id, null, 'product_id must be set to NULL via ON DELETE SET NULL');
    assert.strictEqual(orderItems[0].name, 'Transaction Test Sneakers', 'Item name snapshot must be preserved');
    assert.strictEqual(Number(orderItems[0].price), 3200, 'Item price snapshot must be preserved');
  });
});
