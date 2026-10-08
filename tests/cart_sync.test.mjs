/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Comprehensive Test Suite for Live Cart Synchronization & Oversell Protection
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../server/index.js';

let server;
let baseUrl = '';

async function postJson(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function getJson(path) {
  const res = await fetch(`${baseUrl}${path}`);
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

describe('Live Cart Synchronization & Authoritative Validation Tests', () => {
  let testProductId = 'prod-1';
  let initialStock = 10;
  let testPrice = 2500;

  before(async () => {
    // Start ephemeral server
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // Fetch products to pick a target product
    const prodsRes = await getJson('/api/products');
    if (prodsRes.ok && Array.isArray(prodsRes.data) && prodsRes.data.length > 0) {
      const target = prodsRes.data[0];
      testProductId = target.id;
      testPrice = target.price || 2500;
      initialStock = target.stock !== undefined && target.stock !== null ? target.stock : 10;
    }
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('1. Authoritative Cart Validation: Computes correct totals and ignores client prices', async () => {
    const payload = {
      items: [
        {
          productId: testProductId,
          quantity: 2,
          clientPrice: 1, // Malicious / outdated price
        },
      ],
      couponCode: '',
    };

    const res = await postJson('/api/cart/validate', payload);
    assert.strictEqual(res.status, 200, 'Expected 200 OK from /api/cart/validate');
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.items));
    assert.strictEqual(res.data.items.length, 1);
    
    const validatedItem = res.data.items[0];
    assert.strictEqual(validatedItem.productId, testProductId);
    assert.strictEqual(validatedItem.price, testPrice, 'Server must enforce authoritative database price');
    assert.strictEqual(validatedItem.lineSubtotal, testPrice * 2);
    assert.strictEqual(res.data.subtotal, testPrice * 2);

    // Verify price change notice
    const priceChange = res.data.changes.find(c => c.type === 'PRICE_CHANGED');
    assert.ok(priceChange, 'Server must return PRICE_CHANGED change entry when clientPrice differs');
  });

  it('2. Quantity Adjustment: Clamps requested quantity when stock is limited', async () => {
    const excessiveQty = initialStock + 100;
    const payload = {
      items: [
        {
          productId: testProductId,
          quantity: excessiveQty,
        },
      ],
    };

    const res = await postJson('/api/cart/validate', payload);
    assert.strictEqual(res.status, 200);
    const qtyChange = res.data.changes.find(c => c.type === 'QUANTITY_ADJUSTED');
    assert.ok(qtyChange, 'Must return QUANTITY_ADJUSTED notice');
    assert.strictEqual(qtyChange.oldValue, excessiveQty);
    assert.strictEqual(qtyChange.newValue, initialStock);
  });

  it('3. Coupon Validation: Detects invalid discount coupons', async () => {
    const payload = {
      items: [{ productId: testProductId, quantity: 1 }],
      couponCode: 'INVALID_EXPIRED_CODE_999',
    };

    const res = await postJson('/api/cart/validate', payload);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.isCouponValid, false);
    const couponChange = res.data.changes.find(c => c.type === 'COUPON_INVALID');
    assert.ok(couponChange, 'Must return COUPON_INVALID notice');
    assert.strictEqual(res.data.discountAmount, 0);
  });

  it('4. Out of Stock & Non-existent Product Handling', async () => {
    const payload = {
      items: [
        {
          productId: 'non-existent-product-id-xyz',
          quantity: 1,
        },
      ],
    };

    const res = await postJson('/api/cart/validate', payload);
    assert.strictEqual(res.status, 200);
    const removedChange = res.data.changes.find(c => c.type === 'PRODUCT_REMOVED');
    assert.ok(removedChange, 'Must return PRODUCT_REMOVED notice');
    assert.strictEqual(res.data.items.length, 0);
  });

  it('5. Oversell Protection: Returns 409 Conflict on order creation if cart has conflicts', async () => {
    const orderPayload = {
      items: [
        {
          productId: testProductId,
          quantity: 999999, // Exceeds available stock
          price: 1, // Stale price
        },
      ],
      total: 1,
      customerName: 'Test Buyer',
      customerEmail: 'testbuyer@example.com',
      phone: '0712345678',
    };

    const res = await postJson('/api/orders', orderPayload);
    assert.strictEqual(res.status, 409, 'Expected 409 Conflict when attempting to place order with oversell');
    assert.strictEqual(res.data.error, 'CART_CONFLICT');
    assert.ok(Array.isArray(res.data.changes));
    assert.ok(res.data.changes.length > 0);
  });
});
