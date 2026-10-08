/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Phase 3 Automated Verification Suite: Database Repositories & In-Memory Elimination
 */

import dotenv from 'dotenv';
dotenv.config();

import {
  getSqliteDb,
  saveSqliteOrder,
  getSqliteOrderById,
  getAllSqliteOrders,
  getSqliteOrdersByUser,
  updateSqliteOrderStatus,
  deleteSqliteOrder,
  saveSqliteReview,
  getSqliteReviewsByProduct,
  getAllSqliteReviews,
  updateSqliteReview,
  toggleSqliteReviewHelpful,
  updateSqliteReviewStatus,
  deleteSqliteReview,
  saveSqliteCart,
  getSqliteCart,
  clearSqliteCart,
  addToSqliteWishlist,
  getSqliteWishlist,
  removeFromSqliteWishlist,
  saveSqliteCustomClothingRequest,
  getSqliteCustomClothingRequests,
  getSqliteCustomClothingRequestById,
  updateSqliteCustomClothingRequestStatus,
  addSqliteInventoryAuditLog,
  getSqliteInventoryAuditLogs,
  saveSqliteReviewRequestSettings,
  getSqliteReviewRequestSettings,
  addSqliteReviewRequestLog,
  getSqliteReviewRequestLogs,
} from '../src/lib/sqlite-db';

async function runPhase3Tests() {
  console.log('================================================================');
  console.log('   ROPENIX BACKEND PHASE 3 PERSISTENCE REPOSITORIES TEST SUITE   ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
    }
  }

  const db = await getSqliteDb();

  // -------------------------------------------------------------
  // 1. Orders Repository
  // -------------------------------------------------------------
  console.log('\n[1. Testing Orders SQLite Repository]');
  const testOrderId = `ord-p3-test-${Date.now()}`;
  const testUserEmail = `customer.p3.${Date.now()}@example.com`;

  const orderPayload = {
    id: testOrderId,
    customerName: 'Amina Kimani',
    customerEmail: testUserEmail,
    items: [
      { productId: 'prod-p3-1', name: 'Silk Kimono', price: 4500, quantity: 2 },
      { productId: 'prod-p3-2', name: 'Linen Trousers', price: 3200, quantity: 1 }
    ],
    total: 12200,
    subtotal: 12200,
    shippingFee: 0,
    status: 'pending',
    paymentStatus: 'pending',
    paymentMethod: 'M-PESA',
    trackingNumber: 'ROP-TRK-P3TEST',
    shippingAddress: 'Kilimani, Nairobi',
  };

  const savedOrder = await saveSqliteOrder(orderPayload);
  assert(savedOrder !== null && savedOrder.id === testOrderId, '1.1 Save order to SQLite');
  assert(savedOrder.customerName === 'Amina Kimani' && savedOrder.items.length === 2, '1.2 Order fields & items array correctly persisted');

  const fetchedOrder = await getSqliteOrderById(testOrderId);
  assert(fetchedOrder !== null && fetchedOrder.id === testOrderId, '1.3 Get order by ID from SQLite');

  const userOrders = await getSqliteOrdersByUser(testUserEmail);
  assert(userOrders.some(o => o.id === testOrderId), '1.4 Query orders by customer email from SQLite');

  const updatedOrder = await updateSqliteOrderStatus(testOrderId, { status: 'shipped', trackingNumber: 'ROP-TRK-P3UPDATED' });
  assert(updatedOrder.status === 'shipped' && updatedOrder.trackingNumber === 'ROP-TRK-P3UPDATED', '1.5 Update order status in SQLite');

  const allOrders = await getAllSqliteOrders();
  assert(allOrders.some(o => o.id === testOrderId), '1.6 Fetch all orders from SQLite');

  await deleteSqliteOrder(testOrderId);
  const deletedCheck = await getSqliteOrderById(testOrderId);
  assert(deletedCheck === null, '1.7 Delete order from SQLite');

  // -------------------------------------------------------------
  // 2. Reviews Repository
  // -------------------------------------------------------------
  console.log('\n[2. Testing Reviews SQLite Repository]');
  const testRevId = `rev-p3-test-${Date.now()}`;
  const testProdId = `prod-p3-item-${Date.now()}`;

  const reviewPayload = {
    id: testRevId,
    productId: testProdId,
    orderId: 'ord-ref-123',
    userId: 'usr-p3-reviewer',
    userEmail: 'reviewer.p3@example.com',
    userName: 'David Otieno',
    reviewerDisplayName: 'David O.',
    rating: 5,
    title: 'Outstanding Quality',
    comment: 'The stitching and fabric feel completely luxurious. Highly recommended!',
    mediaUrls: ['https://example.com/photo1.jpg'],
    verifiedPurchase: true,
    status: 'Published',
    helpfulVotes: 0,
    helpfulUserIds: [],
  };

  const savedRev = await saveSqliteReview(reviewPayload);
  assert(savedRev !== null && savedRev.id === testRevId, '2.1 Save review to SQLite');

  const prodReviews = await getSqliteReviewsByProduct(testProdId);
  assert(prodReviews.reviews.length === 1 && prodReviews.summary.average === 5, '2.2 Get product reviews & aggregate summary');

  const vote1 = await toggleSqliteReviewHelpful(testRevId, 'voter-ip-1');
  assert(vote1?.helpfulVotes === 1 && vote1?.voted === true, '2.3 Upvote review increment');

  const vote2 = await toggleSqliteReviewHelpful(testRevId, 'voter-ip-1');
  assert(vote2?.helpfulVotes === 0 && vote2?.voted === false, '2.4 Toggle unvote review decrement');

  const statusUpdatedRev = await updateSqliteReviewStatus(testRevId, 'Hidden');
  assert(statusUpdatedRev?.status === 'Hidden', '2.5 Update review status in SQLite');

  await deleteSqliteReview(testRevId);
  const allRevsAfterDelete = await getAllSqliteReviews();
  const deletedRevObj = allRevsAfterDelete.find(r => r.id === testRevId);
  assert(deletedRevObj?.status === 'Removed', '2.6 Soft delete review in SQLite');

  // -------------------------------------------------------------
  // 3. Cart Repository
  // -------------------------------------------------------------
  console.log('\n[3. Testing Cart SQLite Repository]');
  const cartSessionKey = `session-p3-${Date.now()}`;
  const cartItems = [
    { productId: 'prod-cart-1', name: 'Velvet Blazer', price: 8500, quantity: 1 },
    { productId: 'prod-cart-2', name: 'Silk Scarf', price: 1800, quantity: 2 }
  ];

  await saveSqliteCart(cartSessionKey, cartItems);
  const fetchedCart = await getSqliteCart(cartSessionKey);
  assert(fetchedCart.length === 2 && fetchedCart[0].name === 'Velvet Blazer', '3.1 Save and fetch cart from SQLite');

  await clearSqliteCart(cartSessionKey);
  const clearedCart = await getSqliteCart(cartSessionKey);
  assert(clearedCart.length === 0, '3.2 Clear cart from SQLite');

  // -------------------------------------------------------------
  // 4. Wishlist Repository
  // -------------------------------------------------------------
  console.log('\n[4. Testing Wishlist SQLite Repository]');
  const wishlistUserKey = `user-wish-${Date.now()}`;

  await addToSqliteWishlist(wishlistUserKey, 'prod-wish-1');
  await addToSqliteWishlist(wishlistUserKey, 'prod-wish-2');
  const userWishlist = await getSqliteWishlist(wishlistUserKey);
  assert(userWishlist.includes('prod-wish-1') && userWishlist.includes('prod-wish-2'), '4.1 Add items to wishlist in SQLite');

  await removeFromSqliteWishlist(wishlistUserKey, 'prod-wish-1');
  const wishlistAfterRemove = await getSqliteWishlist(wishlistUserKey);
  assert(!wishlistAfterRemove.includes('prod-wish-1') && wishlistAfterRemove.includes('prod-wish-2'), '4.2 Remove item from wishlist in SQLite');

  // -------------------------------------------------------------
  // 5. Custom Clothing Requests Repository
  // -------------------------------------------------------------
  console.log('\n[5. Testing Custom Clothing Requests SQLite Repository]');
  const customReqId = `req-cc-${Date.now()}`;
  const customReqPayload = {
    id: customReqId,
    referenceNo: `ROP-CC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    fullName: 'Lilian Wanjiku',
    email: 'lilian.w@example.com',
    phone: '+254 700 112 233',
    garmentType: 'Bespoke Evening Jumpsuit',
    measurements: { bust: '34', waist: '26', hips: '36' },
    budgetRange: 'KES 20,000 - 35,000',
    deliveryLocation: 'Westlands, Nairobi',
    status: 'Pending Review',
  };

  const savedCustomReq = await saveSqliteCustomClothingRequest(customReqPayload);
  assert(savedCustomReq !== null && savedCustomReq.id === customReqId, '5.1 Save custom clothing request to SQLite');

  const fetchedCustomReq = await getSqliteCustomClothingRequestById(customReqId);
  assert(fetchedCustomReq !== null && fetchedCustomReq.fullName === 'Lilian Wanjiku', '5.2 Fetch custom clothing request by ID');

  const updatedCustomReq = await updateSqliteCustomClothingRequestStatus(customReqId, 'In Consultation');
  assert(updatedCustomReq?.status === 'In Consultation', '5.3 Update custom clothing status in SQLite');

  // -------------------------------------------------------------
  // 6. Inventory Audit Logs Repository
  // -------------------------------------------------------------
  console.log('\n[6. Testing Inventory Audit Logs SQLite Repository]');
  const auditEntry = await addSqliteInventoryAuditLog({
    productId: 'prod-audit-test',
    productName: 'Tailored Cashmere Coat',
    productSku: 'ROP-COAT-001',
    changeQuantity: 15,
    newStock: 35,
    reason: 'Supplier Intake Batch ROP-BATCH-902',
    details: 'Received 15 units from artisanal mill.',
  });
  assert(auditEntry !== null && auditEntry.changeQuantity === 15, '6.1 Record inventory audit log in SQLite');

  const auditLogs = await getSqliteInventoryAuditLogs(10);
  assert(auditLogs.some(l => l.productId === 'prod-audit-test'), '6.2 Fetch recent inventory audit logs from SQLite');

  // -------------------------------------------------------------
  // 7. Review Automation Settings & Logs
  // -------------------------------------------------------------
  console.log('\n[7. Testing Review Automation Settings & Logs in SQLite]');
  await saveSqliteReviewRequestSettings({ enabled: true, delayDays: 4, incentiveDiscountPercent: 15 });
  const reviewSettings = await getSqliteReviewRequestSettings();
  assert(reviewSettings.delayDays === 4 && reviewSettings.incentiveDiscountPercent === 15, '7.1 Persist and read review settings');

  await addSqliteReviewRequestLog({
    order_id: 'ord-rev-auto-1',
    customer_email: 'auto.rev@example.com',
    customer_name: 'Auto Buyer',
    status: 'sent',
    product_id: 'prod-123'
  });
  const revLogs = await getSqliteReviewRequestLogs();
  assert(revLogs.some(l => l.customer_email === 'auto.rev@example.com'), '7.2 Persist and fetch review request log');

  console.log(`\n--- TEST SUMMARY: ${passed} Passed, ${total - passed} Failed ---\n`);
  if (total - passed > 0) {
    process.exit(1);
  }
}

runPhase3Tests().catch((err) => {
  console.error('Fatal Test Failure:', err);
  process.exit(1);
});
