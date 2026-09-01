/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

/**
 * Sanitizes input strings to strip potential HTML script injection patterns.
 */
export function sanitizeString(val: string): string {
  if (!val) return '';
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

/**
 * Address Editing Validation Schema
 */
export const AddressSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100).transform(sanitizeString),
  phone: z.string().min(7, 'Invalid phone number format').max(20).transform(sanitizeString),
  street: z.string().min(3, 'Street address is required').max(200).transform(sanitizeString),
  building: z.string().max(100).optional().transform(v => (v ? sanitizeString(v) : '')),
  city: z.string().min(2, 'City is required').max(100).transform(sanitizeString),
  countyRegion: z.string().min(2, 'County/Region is required').max(100).transform(sanitizeString),
  postalCode: z.string().max(20).optional().transform(v => (v ? sanitizeString(v) : '')),
  notes: z.string().max(500).optional().transform(v => (v ? sanitizeString(v) : ''))
});

export type AddressFormData = z.infer<typeof AddressSchema>;

/**
 * Return Request Submission Schema
 */
export const ReturnRequestSchema = z.object({
  orderId: z.string().min(3, 'Valid Order ID is required').max(50).transform(sanitizeString),
  customerName: z.string().min(2, 'Customer name is required').max(100).transform(sanitizeString),
  customerEmail: z.string().email('Valid email address required').transform(sanitizeString),
  type: z.enum(['refund', 'exchange', 'replacement', 'store_credit', 'repair']),
  reason: z.enum([
    'damaged_defective',
    'wrong_item',
    'not_as_described',
    'size_fit_issue',
    'changed_mind',
    'better_price',
    'defective',
    'bad_fit',
    'size_mismatch',
    'damaged_transit',
    'other'
  ]),
  reasonDetails: z.string().max(1000).optional().transform(v => (v ? sanitizeString(v) : '')),
  refundAmount: z.number().nonnegative('Refund amount cannot be negative').optional(),
  items: z.array(z.object({
    productId: z.string(),
    name: z.string().transform(sanitizeString),
    quantity: z.number().int().positive(),
    price: z.number().nonnegative(),
    conditionReported: z.enum(['unopened', 'opened_unused', 'used', 'damaged']).optional(),
    reason: z.string().optional()
  })).min(1, 'At least one item must be selected for return')
});

export type ReturnRequestFormData = z.infer<typeof ReturnRequestSchema>;

/**
 * Bulk Product CSV Upload Row Schema
 */
export const BulkProductRowSchema = z.object({
  sku: z.string().max(50).optional().transform(v => (v ? sanitizeString(v) : '')),
  name: z.string().min(2, 'Product name must be at least 2 characters').max(150).transform(sanitizeString),
  type: z.enum(['physical', 'digital', 'service']).default('physical'),
  price: z.number().positive('Price must be greater than 0'),
  stock: z.number().int().nonnegative().nullable().optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  category: z.string().min(1, 'Category is required').max(80).transform(sanitizeString),
  description: z.string().max(2000).optional().transform(v => (v ? sanitizeString(v) : '')),
  imageUrl: z.string().url('Invalid image URL format').or(z.literal('')).optional().transform(v => (v ? sanitizeString(v) : '')),
  tags: z.array(z.string().transform(sanitizeString)).optional(),
  status: z.enum(['Active', 'Inactive', 'Draft', 'Archived']).default('Active')
});

export type BulkProductRowInput = z.infer<typeof BulkProductRowSchema>;
