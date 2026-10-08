/**
 * Order Status Workflow & Transition Rules Test Suite
 * Tests strict lifecycle rules, validation logic, unpaid blocking, and delivery confirmation requirements.
 */

import {
  ALLOWED_STATUS_TRANSITIONS,
  validateStatusTransition,
} from '../server/services/orderStatusService';

interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
}

const tests: TestCase[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn });
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

// -----------------------------------------------------------------------------
// 1. Transition Map Verification
// -----------------------------------------------------------------------------
test('Workflow Map: Verify strict allowed transitions definition', () => {
  assert(
    JSON.stringify(ALLOWED_STATUS_TRANSITIONS.pending) === JSON.stringify(['processing', 'cancelled']),
    'Pending should only transition to processing or cancelled'
  );
  assert(
    JSON.stringify(ALLOWED_STATUS_TRANSITIONS.processing) === JSON.stringify(['shipped', 'cancelled']),
    'Processing should only transition to shipped or cancelled'
  );
  assert(
    JSON.stringify(ALLOWED_STATUS_TRANSITIONS.shipped) === JSON.stringify(['completed', 'cancelled']),
    'Shipped should only transition to completed or cancelled'
  );
  assert(
    ALLOWED_STATUS_TRANSITIONS.completed.length === 0,
    'Completed must be a terminal state with no further transitions'
  );
  assert(
    ALLOWED_STATUS_TRANSITIONS.cancelled.length === 0,
    'Cancelled must be a terminal state with no further transitions'
  );
});

// -----------------------------------------------------------------------------
// 2. Unpaid Order Blocking Rules
// -----------------------------------------------------------------------------
test('Rule: Unpaid orders cannot advance to processing, shipped, or completed', () => {
  const unpaidOrder = {
    id: 'TEST-ORD-001',
    status: 'pending',
    isPaid: false,
    paymentStatus: 'unpaid',
    total: 3500,
  };

  // Attempt to advance to processing while unpaid
  const resProcessing = validateStatusTransition(unpaidOrder, 'processing');
  assert(!resProcessing.valid, 'Unpaid order must NOT transition to processing');
  assert(resProcessing.error?.includes('Payment required') === true, 'Error should explain payment is required');

  // Attempt to skip directly to shipped while unpaid
  const resShipped = validateStatusTransition(unpaidOrder, 'shipped');
  assert(!resShipped.valid, 'Unpaid order must NOT transition to shipped');

  // Attempt to skip directly to completed while unpaid
  const resCompleted = validateStatusTransition(unpaidOrder, 'completed');
  assert(!resCompleted.valid, 'Unpaid order must NOT transition to completed');

  // Cancellation is allowed for unpaid orders
  const resCancelled = validateStatusTransition(unpaidOrder, 'cancelled');
  assert(resCancelled.valid, 'Unpaid orders CAN be cancelled');
});

// -----------------------------------------------------------------------------
// 3. Valid Happy Path Transitions
// -----------------------------------------------------------------------------
test('Rule: Valid sequence pending -> processing -> shipped -> delivered -> completed', () => {
  // 1. Pending (Paid) -> Processing
  const paidOrder = {
    id: 'TEST-ORD-002',
    status: 'pending',
    isPaid: true,
    paymentStatus: 'paid',
    total: 4200,
  };
  const step1 = validateStatusTransition(paidOrder, 'processing');
  assert(step1.valid, 'Paid pending order should successfully transition to processing');

  // 2. Processing -> Shipped
  const processingOrder = {
    ...paidOrder,
    status: 'processing',
  };
  const step2 = validateStatusTransition(processingOrder, 'shipped');
  assert(step2.valid, 'Processing order should successfully transition to shipped');

  // 3. Shipped (with delivery confirmed) -> Completed
  const shippedDeliveredOrder = {
    ...processingOrder,
    status: 'shipped',
    deliveryConfirmed: true,
    deliveredAt: new Date().toISOString(),
    deliveryPerson: 'Courier Rider Kamau',
  };
  const step3 = validateStatusTransition(shippedDeliveredOrder, 'completed');
  assert(step3.valid, 'Shipped order with confirmed delivery should transition to completed');
});

// -----------------------------------------------------------------------------
// 4. Invalid Skipped Transitions (No Skipping Steps)
// -----------------------------------------------------------------------------
test('Rule: Disallow skipping stages in workflow', () => {
  const paidOrder = {
    id: 'TEST-ORD-003',
    status: 'pending',
    isPaid: true,
    paymentStatus: 'paid',
  };

  // Pending -> Shipped (skipping Processing)
  const skipToShipped = validateStatusTransition(paidOrder, 'shipped');
  assert(!skipToShipped.valid, 'Must not skip from Pending to Shipped');
  assert(skipToShipped.error?.includes('Invalid status transition') === true, 'Should return invalid transition error');

  // Pending -> Completed (skipping Processing and Shipped)
  const skipToCompleted = validateStatusTransition(paidOrder, 'completed');
  assert(!skipToCompleted.valid, 'Must not skip from Pending to Completed');

  // Processing -> Completed (skipping Shipped)
  const processingOrder = { ...paidOrder, status: 'processing' };
  const skipShippedToCompleted = validateStatusTransition(processingOrder, 'completed');
  assert(!skipShippedToCompleted.valid, 'Must not skip from Processing to Completed without Shipping');
});

// -----------------------------------------------------------------------------
// 5. Backward Transitions (No Going Backwards)
// -----------------------------------------------------------------------------
test('Rule: Disallow moving backwards in status', () => {
  const processingOrder = { id: 'TEST-ORD-004', status: 'processing', isPaid: true };
  const backToPending = validateStatusTransition(processingOrder, 'pending');
  assert(!backToPending.valid, 'Must not allow moving backwards from Processing to Pending');

  const shippedOrder = { id: 'TEST-ORD-004', status: 'shipped', isPaid: true };
  const backToProcessing = validateStatusTransition(shippedOrder, 'processing');
  assert(!backToProcessing.valid, 'Must not allow moving backwards from Shipped to Processing');

  const completedOrder = { id: 'TEST-ORD-004', status: 'completed', isPaid: true, deliveryConfirmed: true };
  const completedToShipped = validateStatusTransition(completedOrder, 'shipped');
  assert(!completedToShipped.valid, 'Must not allow moving backwards from Completed to Shipped');

  const completedToProcessing = validateStatusTransition(completedOrder, 'processing');
  assert(!completedToProcessing.valid, 'Must not allow moving backwards from Completed to Processing');
});

// -----------------------------------------------------------------------------
// 6. Delivery Confirmation Requirement
// -----------------------------------------------------------------------------
test('Rule: Shipped to Completed requires courier delivery confirmation', () => {
  const shippedUnconfirmedOrder = {
    id: 'TEST-ORD-005',
    status: 'shipped',
    isPaid: true,
    deliveryConfirmed: false,
  };

  // Attempting completion without delivery confirmation
  const resWithoutDelivery = validateStatusTransition(shippedUnconfirmedOrder, 'completed');
  assert(!resWithoutDelivery.valid, 'Completion must fail without delivery confirmation');
  assert(
    resWithoutDelivery.error?.includes('Delivery confirmation required') === true,
    'Error message must state delivery confirmation is required'
  );

  // Supplying delivery confirmation option
  const resWithDeliveryOption = validateStatusTransition(shippedUnconfirmedOrder, 'completed', {
    isDeliveryConfirmed: true,
  });
  assert(resWithDeliveryOption.valid, 'Completion succeeds when isDeliveryConfirmed option is provided');

  // Order with deliveryConfirmed flag set in state
  const shippedConfirmedOrder = {
    ...shippedUnconfirmedOrder,
    deliveryConfirmed: true,
    deliveryPerson: 'Rider Peter',
  };
  const resConfirmed = validateStatusTransition(shippedConfirmedOrder, 'completed');
  assert(resConfirmed.valid, 'Completion succeeds when order.deliveryConfirmed is true');
});

// -----------------------------------------------------------------------------
// 7. Invalid Status Strings & Boundary Checks
// -----------------------------------------------------------------------------
test('Rule: Reject unrecognized status values and null orders', () => {
  const nullCheck = validateStatusTransition(null, 'processing');
  assert(!nullCheck.valid, 'Null order should return invalid');

  const order = { id: 'TEST-ORD-006', status: 'pending', isPaid: true };
  const invalidStatusCheck = validateStatusTransition(order, 'in_limbo');
  assert(!invalidStatusCheck.valid, 'Unrecognized status must be rejected');

  // Same status transition should be a harmless no-op valid: true
  const sameStatusCheck = validateStatusTransition(order, 'pending');
  assert(sameStatusCheck.valid, 'Transition to same status is valid no-op');
});

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------
async function runTests() {
  console.log('🧪 Starting Order Status Workflow Test Suite...\n');
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✅ PASS: ${t.name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${t.name}`);
      console.error(`     Reason: ${err.message || err}\n`);
      failed++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Test Summary: ${passed} passed, ${failed} failed, ${tests.length} total`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
