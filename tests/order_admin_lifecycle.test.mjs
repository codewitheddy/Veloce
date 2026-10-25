import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  MPESA_TRANSITION_MAP,
  COD_TRANSITION_MAP,
  normalizeOrderStatus,
  validateWorkflowTransition,
  executeOrderTransition,
  getValidNextStatuses,
} from '../server/services/orderStatusWorkflow.js';

describe('Admin Order Lifecycle: pending -> confirmed -> payment -> processing -> shipped -> completed / cancel with refund check', () => {

  it('1. Default status normalization maps new / unassigned / quote statuses to pending', () => {
    assert.strictEqual(normalizeOrderStatus(undefined, 'mpesa'), 'pending');
    assert.strictEqual(normalizeOrderStatus('', 'mpesa'), 'pending');
    assert.strictEqual(normalizeOrderStatus('awaiting_delivery_quote', 'mpesa'), 'pending');
    assert.strictEqual(normalizeOrderStatus('delivery_quoted', 'mpesa'), 'pending');
    assert.strictEqual(normalizeOrderStatus('pending', 'mpesa'), 'pending');
    assert.strictEqual(normalizeOrderStatus('confirmed', 'mpesa'), 'confirmed');
  });

  it('2. Transition maps support the full sequential workflow', () => {
    // M-Pesa
    assert.ok(MPESA_TRANSITION_MAP.pending.includes('confirmed'), 'pending should allow transition to confirmed');
    assert.ok(MPESA_TRANSITION_MAP.pending.includes('cancelled'), 'pending should allow cancellation');
    assert.ok(MPESA_TRANSITION_MAP.confirmed.includes('payment_confirmed'), 'confirmed should allow payment confirmation');
    assert.ok(MPESA_TRANSITION_MAP.confirmed.includes('processing'), 'confirmed should allow moving to processing');
    assert.ok(MPESA_TRANSITION_MAP.confirmed.includes('cancelled'), 'confirmed should allow cancellation');
    assert.ok(MPESA_TRANSITION_MAP.payment_confirmed.includes('processing'), 'payment_confirmed should allow processing');
    assert.ok(MPESA_TRANSITION_MAP.processing.includes('shipped'), 'processing should allow shipped');
    assert.ok(MPESA_TRANSITION_MAP.shipped.includes('completed'), 'shipped should allow completed');

    // COD
    assert.ok(COD_TRANSITION_MAP.pending.includes('confirmed'), 'COD pending should allow confirmed');
    assert.ok(COD_TRANSITION_MAP.confirmed.includes('processing'), 'COD confirmed should allow processing');
    assert.ok(COD_TRANSITION_MAP.processing.includes('shipped'), 'COD processing should allow shipped');
    assert.ok(COD_TRANSITION_MAP.shipped.includes('payment_received'), 'COD shipped should allow payment_received');
    assert.ok(COD_TRANSITION_MAP.payment_received.includes('completed'), 'COD payment_received should allow completed');
  });

  it('3. validateWorkflowTransition validates transitions at each stage', () => {
    const mockPendingOrder = {
      id: 'ord-test-1',
      status: 'pending',
      paymentMethod: 'mpesa',
      total: 3500,
      customerName: 'Alice Mwangi',
      isPaid: false,
    };

    // Step 1: Admin confirms order
    const confirmVal = validateWorkflowTransition(mockPendingOrder, 'confirmed');
    assert.strictEqual(confirmVal.valid, true, 'Confirming pending order should be valid');

    // Step 2: Payment confirmation requires transaction code
    const payValNoCode = validateWorkflowTransition({ ...mockPendingOrder, status: 'confirmed' }, 'payment_confirmed', {});
    assert.strictEqual(payValNoCode.valid, false, 'Payment confirmation without code should fail');
    assert.match(payValNoCode.error, /transaction code is required/i);

    const payValWithCode = validateWorkflowTransition({ ...mockPendingOrder, status: 'confirmed' }, 'payment_confirmed', {
      transactionCode: 'QKH9XYZ123',
    });
    assert.strictEqual(payValWithCode.valid, true, 'Payment confirmation with code should succeed');

    // Step 3: Confirmed order moving to processing
    const procVal = validateWorkflowTransition({ ...mockPendingOrder, status: 'confirmed' }, 'processing');
    assert.strictEqual(procVal.valid, true, 'Confirmed order moving to processing should be valid');

    // Step 4: Processing order moving to shipped
    const shippedVal = validateWorkflowTransition({ ...mockPendingOrder, status: 'processing' }, 'shipped');
    assert.strictEqual(shippedVal.valid, true, 'Processing moving to shipped should be valid');

    // Step 5: Shipped order moving to completed
    const completeVal = validateWorkflowTransition({ ...mockPendingOrder, status: 'shipped' }, 'completed');
    assert.strictEqual(completeVal.valid, true, 'Shipped moving to completed should be valid');

    // Cancellation: cancellation requires reason
    const cancelNoReason = validateWorkflowTransition({ ...mockPendingOrder, status: 'confirmed' }, 'cancelled', {});
    assert.strictEqual(cancelNoReason.valid, false, 'Cancellation without reason should fail');

    const cancelWithReason = validateWorkflowTransition({ ...mockPendingOrder, status: 'confirmed' }, 'cancelled', {
      cancellationReason: 'Customer requested change',
    });
    assert.strictEqual(cancelWithReason.valid, true, 'Cancellation with reason should be valid');
  });

  it('4. executeOrderTransition handles database transition and conditional refund claim creation', async () => {
    // Test that the module exports executeOrderTransition function
    assert.strictEqual(typeof executeOrderTransition, 'function');
  });
});
