/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product } from '../types';

export type TaxStatus = 'taxable' | 'zero_rated' | 'exempt';

export interface TaxClassConfig {
  id: string;
  name: string;
  status: TaxStatus;
  ratePercent: number; // e.g., 16, 8, 0
  description: string;
}

export const DEFAULT_TAX_CLASSES: TaxClassConfig[] = [
  { id: 'standard', name: 'Standard Rate (16% VAT)', status: 'taxable', ratePercent: 16, description: 'Standard Value Added Tax (VAT 16%)' },
  { id: 'reduced', name: 'Reduced Rate (8% VAT)', status: 'taxable', ratePercent: 8, description: 'Reduced VAT rate for specialized goods & services (8%)' },
  { id: 'zero_rated', name: 'Zero-Rated (0% VAT)', status: 'zero_rated', ratePercent: 0, description: 'Exports & essential items (0% VAT)' },
  { id: 'exempt', name: 'Tax Exempt (0%)', status: 'exempt', ratePercent: 0, description: 'Exempt items e.g., medical, education, uncollected tax' },
];

export function getTaxClassConfig(classId?: string): TaxClassConfig {
  if (!classId) return DEFAULT_TAX_CLASSES[0];
  const found = DEFAULT_TAX_CLASSES.find((c) => c.id === classId);
  if (found) return found;

  // Fallbacks for legacy/alternative strings
  if (classId === 'A' || classId === 'standard') return DEFAULT_TAX_CLASSES[0]; // 16%
  if (classId === 'B' || classId === 'reduced') return DEFAULT_TAX_CLASSES[1]; // 8%
  if (classId === 'C' || classId === 'zero_rated') return DEFAULT_TAX_CLASSES[2]; // 0% zero-rated
  if (classId === 'E' || classId === 'exempt') return DEFAULT_TAX_CLASSES[3]; // 0% exempt

  return DEFAULT_TAX_CLASSES[0];
}

export function getProductTaxInfo(product: Partial<Product>) {
  let taxStatus: TaxStatus = product.taxStatus || 'taxable';
  let taxRate = typeof product.taxRate === 'number' ? product.taxRate : 16;
  let taxClass = product.taxClass || 'standard';

  if (product.taxClass) {
    const config = getTaxClassConfig(product.taxClass);
    taxStatus = config.status;
    taxRate = config.ratePercent;
    taxClass = config.id;
  } else if (product.taxId) {
    const config = getTaxClassConfig(product.taxId);
    taxStatus = config.status;
    taxRate = config.ratePercent;
    taxClass = config.id;
  } else if (product.taxStatus) {
    taxStatus = product.taxStatus;
    if (taxStatus === 'zero_rated' || taxStatus === 'exempt') {
      taxRate = 0;
    }
  }

  // Enforce 0 tax rate for non-taxable statuses
  if (taxStatus === 'zero_rated' || taxStatus === 'exempt') {
    taxRate = 0;
  }

  return { taxStatus, taxRate, taxClass };
}

export interface LineTaxCalculation {
  lineSubtotal: number;
  lineDiscount: number;
  effectiveSubtotal: number;
  taxStatus: TaxStatus;
  taxRate: number;
  taxClass: string;
  lineTax: number;
}

export interface MixedCartTaxSummary {
  cartSubtotal: number;
  subtotalExclTax: number;
  discountTotal: number;
  taxableSubtotal: number;
  taxableSubtotalExclTax: number;
  zeroRatedSubtotal: number;
  exemptSubtotal: number;
  cartTax: number;
  shippingFee: number;
  shippingTaxStatus: TaxStatus;
  shippingTaxRate: number;
  shippingTax: number;
  totalTax: number;
  cartTotal: number;
  lineCalculations: LineTaxCalculation[];
}

/**
 * Calculates itemized line-by-line tax for a mixed cart where product prices are INCLUSIVE of tax.
 * Dissects discounts proportionally per line item so zero-rated/exempt items remain unaffected.
 */
export function calculateMixedCartTax(
  items: { product: Product; quantity: number; price?: number }[],
  discountTotal: number = 0,
  shippingFee: number = 0,
  shippingTaxStatus: TaxStatus = 'exempt',
  shippingTaxRate: number = 0
): MixedCartTaxSummary {
  const cartSubtotal = items.reduce((sum, item) => sum + (item.price ?? item.product.price) * item.quantity, 0);

  let taxableSubtotal = 0;
  let taxableSubtotalExclTax = 0;
  let zeroRatedSubtotal = 0;
  let exemptSubtotal = 0;
  let itemsTaxTotal = 0;
  let subtotalExclTax = 0;

  const lineCalculations: LineTaxCalculation[] = items.map((item) => {
    const unitPrice = item.price ?? item.product.price;
    const lineSubtotal = unitPrice * item.quantity;

    // Pro-rate discount proportionally based on item's share of total cart subtotal
    const lineDiscount = cartSubtotal > 0 ? (discountTotal * lineSubtotal) / cartSubtotal : 0;
    const effectiveSubtotal = Math.max(0, lineSubtotal - lineDiscount);

    const { taxStatus, taxRate, taxClass } = getProductTaxInfo(item.product);

    let lineTax = 0;
    let lineExclTax = effectiveSubtotal;

    if (taxStatus === 'taxable' && taxRate > 0) {
      taxableSubtotal += lineSubtotal;
      // Tax is INCLUSIVE in product price: lineExclTax = effectiveSubtotal / (1 + taxRate / 100)
      lineExclTax = effectiveSubtotal / (1 + taxRate / 100);
      lineTax = effectiveSubtotal - lineExclTax;
      taxableSubtotalExclTax += lineExclTax;
    } else if (taxStatus === 'zero_rated') {
      zeroRatedSubtotal += lineSubtotal;
      lineTax = 0;
      lineExclTax = effectiveSubtotal;
    } else {
      exemptSubtotal += lineSubtotal;
      lineTax = 0;
      lineExclTax = effectiveSubtotal;
    }

    subtotalExclTax += lineExclTax;
    itemsTaxTotal += lineTax;

    return {
      lineSubtotal,
      lineDiscount,
      effectiveSubtotal,
      taxStatus,
      taxRate,
      taxClass,
      lineTax,
    };
  });

  // Calculate explicit shipping tax if shipping is taxable
  const shippingTax = shippingTaxStatus === 'taxable' ? shippingFee * (shippingTaxRate / 100) : 0;
  const totalTax = itemsTaxTotal + shippingTax;
  // Product prices are inclusive of tax, so cart total is gross items subtotal minus discount plus shipping
  const cartTotal = Math.max(0, cartSubtotal - discountTotal) + shippingFee + shippingTax;

  return {
    cartSubtotal,
    subtotalExclTax,
    discountTotal,
    taxableSubtotal,
    taxableSubtotalExclTax,
    zeroRatedSubtotal,
    exemptSubtotal,
    cartTax: itemsTaxTotal,
    shippingFee,
    shippingTaxStatus,
    shippingTaxRate,
    shippingTax,
    totalTax,
    cartTotal,
    lineCalculations,
  };
}

/**
 * Automated test/validation per Section 6.4 requirement:
 * A cart containing both a Zero-Rated and a Taxable item with tax-inclusive pricing.
 */
export function runMixedCartTaxValidationTest(): { success: boolean; message: string; details: any } {
  const mockTaxableProduct: Product = {
    id: 'test-taxable',
    sku: 'TAX-001',
    name: 'Taxable Coffee Beans',
    description: '',
    price: 100,
    category: 'Food',
    tags: [],
    type: 'physical',
    imageUrl: '',
    stock: 10,
    rating: 5,
    reviewsCount: 0,
    reviews: [],
    taxStatus: 'taxable',
    taxRate: 16,
    taxClass: 'standard',
  };

  const mockZeroRatedProduct: Product = {
    id: 'test-zero',
    sku: 'ZERO-001',
    name: 'Zero-Rated Export Tea',
    description: '',
    price: 100,
    category: 'Food',
    tags: [],
    type: 'physical',
    imageUrl: '',
    stock: 10,
    rating: 5,
    reviewsCount: 0,
    reviews: [],
    taxStatus: 'zero_rated',
    taxRate: 0,
    taxClass: 'zero_rated',
  };

  const summary = calculateMixedCartTax(
    [
      { product: mockTaxableProduct, quantity: 1, price: 100 },
      { product: mockZeroRatedProduct, quantity: 1, price: 100 },
    ],
    0,
    0
  );

  const expectedTaxableTax = 100 - (100 / 1.16); // ~13.79
  const expectedZeroTax = 0;
  const expectedCartTax = expectedTaxableTax + expectedZeroTax; // ~13.79
  const expectedCartTotal = 200; // Final total equals tax-inclusive product prices sum $200!

  const isExactMatch = Math.abs(summary.cartTax - expectedCartTax) < 0.0001 && Math.abs(summary.cartTotal - expectedCartTotal) < 0.0001;

  if (isExactMatch) {
    return {
      success: true,
      message: `[Validation Test Passed] Mixed cart (Taxable $100 @ 16% incl. + Zero-Rated $100 @ 0%) produced price excl. tax of $${summary.subtotalExclTax.toFixed(2)} + VAT $${summary.cartTax.toFixed(2)} = cartTotal of exactly $${summary.cartTotal.toFixed(2)}.`,
      details: summary,
    };
  } else {
    return {
      success: false,
      message: `[Validation Test Failed] Expected cart_total $${expectedCartTotal.toFixed(2)} & tax $${expectedCartTax.toFixed(2)}, got total $${summary.cartTotal.toFixed(2)} & tax $${summary.cartTax.toFixed(2)}.`,
      details: summary,
    };
  }
}

// Automatically execute the validation test in dev/console for instant automated test confirmation
if (typeof window !== 'undefined') {
  const result = runMixedCartTaxValidationTest();
  console.log('✅ Tax Calculation Validation:', result.message);
}
