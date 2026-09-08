/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import api, { formatApiError } from '../api/client';
import {
  Supplier,
  SupplierProduct,
  SupplierIntakeBatch,
  SupplierPayment,
  SupplierLedgerEntry,
  SupplierStatement,
  SupplierDashboardMetrics,
  SupplierReportData
} from '../types/supplier';

const SUPPLIERS_STORAGE_KEY = 'veloce_suppliers_cache';
const SUPPLIER_PRODUCTS_STORAGE_KEY = 'veloce_supplier_products_cache';
const SUPPLIER_INTAKES_STORAGE_KEY = 'veloce_supplier_intakes_cache';
const SUPPLIER_PAYMENTS_STORAGE_KEY = 'veloce_supplier_payments_cache';

export const supplierApi = {
  async getSuppliers(statusParam?: string): Promise<Supplier[]> {
    try {
      const res = await api.get('/suppliers/directory/', {
        params: statusParam ? { status: statusParam } : undefined
      });
      const data = res.data;
      const suppliers: Supplier[] = Array.isArray(data) ? data : (data?.results || []);
      try {
        localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(suppliers));
      } catch {}
      return suppliers;
    } catch (err) {
      console.warn('Backend suppliers fetch error, checking cache:', err);
      const cached = localStorage.getItem(SUPPLIERS_STORAGE_KEY);
      if (cached) {
        try {
          const list: Supplier[] = JSON.parse(cached);
          return statusParam ? list.filter((s) => s.status === statusParam) : list;
        } catch {}
      }
      return [];
    }
  },

  async getSupplier(id: string): Promise<Supplier | null> {
    try {
      const res = await api.get(`/suppliers/directory/${id}/`);
      return res.data;
    } catch (err) {
      console.warn(`Backend supplier ${id} fetch error, checking cache:`, err);
      const suppliers = await this.getSuppliers();
      return suppliers.find((s) => s.id === id) || null;
    }
  },

  async createSupplier(supplierData: Partial<Supplier>): Promise<Supplier> {
    const payload: Record<string, any> = { ...supplierData };
    // Remove temporary client-side mock id if present
    if (payload.id && typeof payload.id === 'string' && payload.id.startsWith('sup-')) {
      delete payload.id;
    }
    // Clean empty code so backend generates unique SUP-XXXXXX code
    if (!payload.code || payload.code.trim() === '') {
      delete payload.code;
    }

    try {
      const res = await api.post('/suppliers/directory/', payload);
      const created: Supplier = res.data;

      // Update local storage cache
      try {
        const cached = localStorage.getItem(SUPPLIERS_STORAGE_KEY);
        const suppliers: Supplier[] = cached ? JSON.parse(cached) : [];
        const filtered = suppliers.filter((s) => s.id !== created.id);
        filtered.unshift(created);
        localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(filtered));
      } catch {}

      return created;
    } catch (err) {
      console.error('Backend supplier creation failed:', err);
      throw err;
    }
  },

  async updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier> {
    const payload: Record<string, any> = { ...updates };
    delete payload.id;
    if (payload.code === '' || payload.code === null) {
      delete payload.code;
    }

    try {
      const res = await api.patch(`/suppliers/directory/${id}/`, payload);
      const updated: Supplier = res.data;

      try {
        const cached = localStorage.getItem(SUPPLIERS_STORAGE_KEY);
        if (cached) {
          const suppliers: Supplier[] = JSON.parse(cached);
          const idx = suppliers.findIndex((s) => s.id === id);
          if (idx >= 0) {
            suppliers[idx] = updated;
          } else {
            suppliers.unshift(updated);
          }
          localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(suppliers));
        }
      } catch {}

      return updated;
    } catch (err) {
      console.error('Backend supplier update failed:', err);
      throw err;
    }
  },

  async deleteSupplier(id: string): Promise<void> {
    try {
      await api.delete(`/suppliers/directory/${id}/`);
      try {
        const cached = localStorage.getItem(SUPPLIERS_STORAGE_KEY);
        if (cached) {
          const suppliers: Supplier[] = JSON.parse(cached);
          const filtered = suppliers.filter((s) => s.id !== id);
          localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(filtered));
        }
      } catch {}
    } catch (err) {
      console.error('Backend supplier deletion failed:', err);
      throw err;
    }
  },

  async getSupplierProducts(supplierId?: string): Promise<SupplierProduct[]> {
    try {
      const res = await api.get('/suppliers/products/', {
        params: supplierId ? { supplier_id: supplierId } : undefined
      });
      const data = res.data;
      const products: SupplierProduct[] = Array.isArray(data) ? data : (data?.results || []);
      try {
        localStorage.setItem(SUPPLIER_PRODUCTS_STORAGE_KEY, JSON.stringify(products));
      } catch {}
      return products;
    } catch (err) {
      console.warn('Backend supplier products fetch note:', err);
      const cached = localStorage.getItem(SUPPLIER_PRODUCTS_STORAGE_KEY);
      if (cached) {
        try {
          const all = JSON.parse(cached);
          return supplierId ? all.filter((p: SupplierProduct) => p.supplier === supplierId) : all;
        } catch {}
      }
      return [];
    }
  },

  async linkProductToSupplier(data: {
    supplier: string;
    product: string;
    agreed_cost_price: number;
    selling_price?: number;
    supplier_sku?: string;
    lead_time_days?: number;
  }): Promise<SupplierProduct> {
    try {
      const res = await api.post('/suppliers/products/', data);
      const linked: SupplierProduct = res.data;
      return linked;
    } catch (err) {
      console.error('Backend product linking failed:', err);
      throw err;
    }
  },

  async getIntakeBatches(supplierId?: string): Promise<SupplierIntakeBatch[]> {
    try {
      const res = await api.get('/suppliers/intakes/', {
        params: supplierId ? { supplier_id: supplierId } : undefined
      });
      const data = res.data;
      const batches: SupplierIntakeBatch[] = Array.isArray(data) ? data : (data?.results || []);
      try {
        localStorage.setItem(SUPPLIER_INTAKES_STORAGE_KEY, JSON.stringify(batches));
      } catch {}
      return batches;
    } catch (err) {
      console.warn('Backend intakes fetch error:', err);
      const cached = localStorage.getItem(SUPPLIER_INTAKES_STORAGE_KEY);
      if (cached) {
        try {
          const all = JSON.parse(cached);
          return supplierId ? all.filter((b: SupplierIntakeBatch) => b.supplier === supplierId) : all;
        } catch {}
      }
      return [];
    }
  },

  async createIntakeBatch(intakeData: {
    supplier: string;
    product?: string | null;
    product_name: string;
    product_sku?: string;
    quantity_received: number;
    unit_cost: number;
    delivery_note_ref?: string;
    invoice_ref?: string;
    notes?: string;
    received_by?: string;
  }): Promise<SupplierIntakeBatch> {
    try {
      const res = await api.post('/suppliers/intakes/', intakeData);
      const created: SupplierIntakeBatch = res.data;

      try {
        const cached = localStorage.getItem(SUPPLIER_INTAKES_STORAGE_KEY);
        const batches: SupplierIntakeBatch[] = cached ? JSON.parse(cached) : [];
        batches.unshift(created);
        localStorage.setItem(SUPPLIER_INTAKES_STORAGE_KEY, JSON.stringify(batches));
      } catch {}

      return created;
    } catch (err) {
      console.error('Backend intake creation failed:', err);
      throw err;
    }
  },

  async getPayments(supplierId?: string): Promise<SupplierPayment[]> {
    try {
      const res = await api.get('/suppliers/payments/', {
        params: supplierId ? { supplier_id: supplierId } : undefined
      });
      const data = res.data;
      const payments: SupplierPayment[] = Array.isArray(data) ? data : (data?.results || []);
      try {
        localStorage.setItem(SUPPLIER_PAYMENTS_STORAGE_KEY, JSON.stringify(payments));
      } catch {}
      return payments;
    } catch (err) {
      console.warn('Backend payments fetch error:', err);
      const cached = localStorage.getItem(SUPPLIER_PAYMENTS_STORAGE_KEY);
      if (cached) {
        try {
          const all = JSON.parse(cached);
          return supplierId ? all.filter((p: SupplierPayment) => p.supplier === supplierId) : all;
        } catch {}
      }
      return [];
    }
  },

  async createPayment(paymentData: {
    supplier: string;
    amount: number;
    payment_method: SupplierPayment['payment_method'];
    transaction_code?: string;
    settlement_period_start?: string | null;
    settlement_period_end?: string | null;
    allocated_batches_or_orders?: string[];
    notes?: string;
    processed_by?: string;
  }): Promise<SupplierPayment> {
    try {
      const res = await api.post('/suppliers/payments/', paymentData);
      const created: SupplierPayment = res.data;

      try {
        const cached = localStorage.getItem(SUPPLIER_PAYMENTS_STORAGE_KEY);
        const payments: SupplierPayment[] = cached ? JSON.parse(cached) : [];
        payments.unshift(created);
        localStorage.setItem(SUPPLIER_PAYMENTS_STORAGE_KEY, JSON.stringify(payments));
      } catch {}

      return created;
    } catch (err) {
      console.error('Backend payment creation failed:', err);
      throw err;
    }
  },

  async getSupplierStatement(supplierId: string, startDate?: string, endDate?: string): Promise<SupplierStatement> {
    try {
      const res = await api.get(`/suppliers/directory/${supplierId}/statement/`, {
        params: {
          start_date: startDate || undefined,
          end_date: endDate || undefined
        }
      });
      return res.data;
    } catch (err) {
      console.warn('Backend statement fetch note:', err);
      const supplier = await this.getSupplier(supplierId);
      return {
        supplier_id: supplierId,
        supplier_name: supplier?.name || 'Supplier',
        company_name: supplier?.company_name || '',
        code: supplier?.code || 'SUP-001',
        tax_pin: supplier?.tax_pin || 'P051000000Z',
        payment_terms: supplier?.payment_terms || 'Consignment Sale',
        statement_period: {
          start: startDate || '2026-01-01',
          end: endDate || new Date().toISOString()
        },
        total_debited: supplier?.total_amount_paid || 0,
        total_credited: supplier?.total_cost_owed || 0,
        closing_balance: supplier?.outstanding_balance || 0,
        transactions: []
      };
    }
  },

  async getDashboardAnalytics(): Promise<SupplierDashboardMetrics> {
    try {
      const res = await api.get('/suppliers/analytics/dashboard/');
      return res.data;
    } catch (err) {
      console.warn('Backend dashboard analytics fetch note:', err);
      const suppliers = await this.getSuppliers();
      const products = await this.getSupplierProducts();
      const payments = await this.getPayments();

      const totalSuppliers = suppliers.length;
      const totalProducts = products.length;
      const totalRevenue = products.reduce((acc, p) => acc + (p.total_sales_revenue || 0), 0);
      const totalCost = products.reduce((acc, p) => acc + (p.total_cost_owed || 0), 0);
      const totalPaid = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
      const totalBalance = Math.max(0, totalCost - totalPaid);
      const totalProfit = totalRevenue - totalCost;
      const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      return {
        metrics: {
          total_suppliers: totalSuppliers,
          total_products_sourced: totalProducts,
          total_units_received: products.reduce((acc, p) => acc + p.quantity_received, 0),
          total_units_sold: products.reduce((acc, p) => acc + p.quantity_sold, 0),
          total_received_value: products.reduce((acc, p) => acc + (p.quantity_received * p.agreed_cost_price), 0),
          total_sales_revenue: totalRevenue,
          total_supplier_costs: totalCost,
          total_paid_to_suppliers: totalPaid,
          total_outstanding_balance: totalBalance,
          total_gross_profit: totalProfit,
          overall_profit_margin: Math.round(margin * 10) / 10
        },
        status_distribution: {
          Paid: suppliers.filter((s) => s.payment_status === 'Paid').length,
          'Partially Paid': suppliers.filter((s) => s.payment_status === 'Partially Paid').length,
          Pending: suppliers.filter((s) => s.payment_status === 'Pending').length
        },
        top_profitable_products: products.slice(0, 5).map((p) => ({
          product_id: p.product,
          product_name: p.product_name,
          sku: p.product_sku,
          supplier_name: 'Supplier',
          selling_price: p.selling_price,
          supplier_cost: p.agreed_cost_price,
          quantity_sold: p.quantity_sold,
          revenue: p.total_sales_revenue,
          gross_profit: p.gross_profit,
          profit_margin: p.profit_margin_percent
        })),
        top_suppliers: suppliers.slice(0, 5).map((s) => ({
          supplier_id: s.id,
          supplier_name: s.name,
          company_name: s.company_name,
          products_count: s.active_products_count,
          total_revenue: s.total_sales_revenue,
          total_cost: s.total_cost_owed,
          gross_profit: s.gross_profit,
          outstanding_balance: s.outstanding_balance,
          margin_percent: s.profit_margin_percent
        }))
      };
    }
  },

  async getReport(type: string, supplierId?: string, startDate?: string, endDate?: string): Promise<SupplierReportData> {
    try {
      const res = await api.get('/suppliers/reports/', {
        params: {
          type,
          supplier_id: supplierId || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined
        }
      });
      return res.data;
    } catch (err) {
      console.warn('Backend report fetch note:', err);
      const suppliers = await this.getSuppliers();
      return {
        report_type: type,
        title: 'Supplier Outstanding Balances & Aging Summary',
        generated_at: new Date().toISOString(),
        columns: ['Supplier Code', 'Supplier Name', 'Company', 'Total Cost Owed', 'Total Paid', 'Outstanding Balance', 'Payment Terms', 'Status'],
        rows: suppliers.map((s) => ({
          code: s.code,
          name: s.name,
          company: s.company_name || 'N/A',
          total_owed: s.total_cost_owed,
          total_paid: s.total_amount_paid,
          outstanding_balance: s.outstanding_balance,
          payment_terms: s.payment_terms,
          status: s.payment_status
        }))
      };
    }
  }
};
