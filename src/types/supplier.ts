/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SupplierPaymentStatus = 'Paid' | 'Partially Paid' | 'Pending';

export type SupplierPaymentTerms =
  | 'Consignment Sale'
  | 'Immediate'
  | 'Net 15'
  | 'Net 30'
  | 'Bi-weekly'
  | 'Monthly';

export type SupplierPaymentMethod =
  | 'M-PESA'
  | 'Bank Transfer'
  | 'Cheque'
  | 'Cash'
  | 'Card';

export interface Supplier {
  id: string;
  code: string;
  name: string;
  company_name: string;
  email: string;
  phone: string;
  physical_address: string;
  tax_pin: string;
  payment_terms: SupplierPaymentTerms;
  bank_name: string;
  bank_account_number: string;
  mpesa_number: string;
  mpesa_account_name: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  notes: string;
  
  // Computed & Aggregated Financial Metrics
  total_received_value: number;
  total_sales_revenue: number;
  total_cost_owed: number;
  total_amount_paid: number;
  outstanding_balance: number;
  gross_profit: number;
  profit_margin_percent: number;
  payment_status: SupplierPaymentStatus;
  active_products_count: number;
  
  created_at: string;
  updated_at: string;
}

export interface SupplierProduct {
  id: string;
  supplier: string;
  product: string;
  product_name: string;
  product_sku: string;
  product_image_url?: string;
  product_category?: string;
  product_stock?: number;
  supplier_sku: string;
  
  agreed_cost_price: number;
  selling_price: number;
  quantity_received: number;
  quantity_sold: number;
  remaining_stock: number;
  
  total_cost_owed: number;
  total_sales_revenue: number;
  gross_profit: number;
  profit_margin_percent: number;
  
  lead_time_days: number;
  is_primary_supplier: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierIntakeBatch {
  id: string;
  batch_number: string;
  supplier: string;
  supplier_name?: string;
  supplier_company?: string;
  product?: string | null;
  product_name: string;
  product_sku: string;
  quantity_received: number;
  unit_cost: number;
  total_cost: number;
  received_date: string;
  delivery_note_ref: string;
  invoice_ref: string;
  status: 'Received' | 'Inspected' | 'Returned' | 'Cancelled';
  notes: string;
  received_by: string;
  created_at: string;
}

export interface SupplierPayment {
  id: string;
  payment_reference: string;
  supplier: string;
  supplier_name?: string;
  supplier_company?: string;
  payment_date: string;
  amount: number;
  payment_method: SupplierPaymentMethod;
  transaction_code: string;
  settlement_period_start?: string | null;
  settlement_period_end?: string | null;
  allocated_batches_or_orders?: string[];
  status: 'Completed' | 'Pending' | 'Void';
  receipt_attachment_url?: string;
  notes: string;
  processed_by: string;
  created_at: string;
}

export interface SupplierLedgerEntry {
  id: string;
  supplier: string;
  supplier_name?: string;
  entry_type: 'STOCK_INTAKE' | 'SALE_PAYABLE' | 'PAYMENT_DISBURSED' | 'RETURN_DEBIT' | 'ADJUSTMENT';
  reference_id: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
  created_at: string;
}

export interface SupplierStatement {
  supplier_id: string;
  supplier_name: string;
  company_name: string;
  code: string;
  tax_pin: string;
  payment_terms: string;
  statement_period: {
    start: string;
    end: string;
  };
  total_debited: number;
  total_credited: number;
  closing_balance: number;
  transactions: {
    id: string;
    date: string;
    entry_type: string;
    reference: string;
    description: string;
    debit: number;
    credit: number;
    running_balance: number;
  }[];
}

export interface SupplierDashboardMetrics {
  metrics: {
    total_suppliers: number;
    total_products_sourced: number;
    total_units_received: number;
    total_units_sold: number;
    total_received_value: number;
    total_sales_revenue: number;
    total_supplier_costs: number;
    total_paid_to_suppliers: number;
    total_outstanding_balance: number;
    total_gross_profit: number;
    overall_profit_margin: number;
  };
  status_distribution: {
    Paid: number;
    'Partially Paid': number;
    Pending: number;
  };
  top_profitable_products: {
    product_id: string;
    product_name: string;
    sku: string;
    supplier_name: string;
    selling_price: number;
    supplier_cost: number;
    quantity_sold: number;
    revenue: number;
    gross_profit: number;
    profit_margin: number;
  }[];
  top_suppliers: {
    supplier_id: string;
    supplier_name: string;
    company_name: string;
    products_count: number;
    total_revenue: number;
    total_cost: number;
    gross_profit: number;
    outstanding_balance: number;
    margin_percent: number;
  }[];
}

export type SupplierReportType =
  | 'outstanding_balances'
  | 'payment_history'
  | 'products_received'
  | 'products_sold'
  | 'sales_by_supplier'
  | 'profitability_by_supplier'
  | 'profitability_by_product'
  | 'outstanding_payments'
  | 'overall_profitability'
  | 'supplier_statement';

export interface SupplierReportData {
  report_type: string;
  title: string;
  generated_at: string;
  columns: string[];
  rows: Record<string, any>[];
}
