/**
 * Customer Management TypeScript API Client and Type Definitions
 * Uses the centralized api Axios client with JWT authentication, automatic token rotation, and standardized error handling.
 */

import api from '../services/api';

const extractErrorMessage = (err: any): string => {
  if (err?.response?.data) {
    const data = err.response.data;
    if (typeof data === 'string') return data;
    if (data.error) return data.error;
    if (data.detail) return data.detail;
    if (data.message) return data.message;
    if (typeof data === 'object') {
      return Object.entries(data)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('; ');
    }
  }
  return err?.message || 'A network error occurred while contacting the customer service.';
};

export interface CustomerDeal {
  id: string;
  customer: string;
  customer_name?: string;
  title: string;
  value: number | string;
  stage: 'prospecting' | 'negotiation' | 'won' | 'lost';
  expected_close?: string | null;
  created_at?: string;
}

export interface CustomerOrder {
  id: string;
  reference: string;
  customer: string;
  customer_name: string;
  customer_email: string;
  total: number | string;
  status: string;
  placed_at: string;
  created_at?: string;
}

export interface CustomerInvoice {
  id: string;
  customer: string;
  customer_name?: string;
  order?: string | null;
  order_reference?: string;
  amount: number | string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  due_date?: string | null;
  issued_at: string;
}

export interface CustomerListItem {
  id: string;
  user?: number | null;
  is_registered: boolean;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  location?: string;
  resolved_location?: string;
  orders_count?: number;
  total_spent?: number | string;
  status: 'active' | 'inactive' | 'lead';
  notes: string;
  open_deal_value: number | string;
  created_at: string;
  updated_at: string;
}

export interface CustomerDetailItem extends CustomerListItem {
  deals: CustomerDeal[];
  orders: CustomerOrder[];
  invoices: CustomerInvoice[];
}

export interface CustomerQueryParams {
  search?: string;
  status?: string;
  is_registered?: boolean | string;
  ordering?: string;
  page?: number;
}

/**
 * Fetch paginated or filtered list of customers
 */
export async function getCustomers(params: CustomerQueryParams = {}): Promise<CustomerListItem[] | { results: CustomerListItem[]; count?: number }> {
  try {
    const response = await api.get('/customers/', { params });
    return response.data;
  } catch (err: any) {
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * Fetch detailed customer profile with nested deals, orders, and invoices
 */
export async function getCustomer(id: string): Promise<CustomerDetailItem> {
  if (!id) throw new Error('Customer ID is required');
  try {
    const response = await api.get(`/customers/${id}/`);
    return response.data;
  } catch (err: any) {
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * Create a new Customer record
 */
export async function createCustomer(data: Partial<CustomerListItem>): Promise<CustomerListItem> {
  try {
    const response = await api.post('/customers/', data);
    return response.data;
  } catch (err: any) {
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * Update an existing Customer record
 */
export async function updateCustomer(id: string, data: Partial<CustomerListItem>): Promise<CustomerListItem> {
  if (!id) throw new Error('Customer ID is required');
  try {
    const response = await api.put(`/customers/${id}/`, data);
    return response.data;
  } catch (err: any) {
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * Delete a Customer record
 */
export async function deleteCustomer(id: string): Promise<boolean> {
  if (!id) throw new Error('Customer ID is required');
  try {
    await api.delete(`/customers/${id}/`);
    return true;
  } catch (err: any) {
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * Create a new Deal for a Customer
 */
export async function createDeal(data: Partial<CustomerDeal>): Promise<CustomerDeal> {
  try {
    const response = await api.post('/customers/deals/', data);
    return response.data;
  } catch (err: any) {
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * Create a new Order for a Customer
 */
export async function createOrder(data: Partial<CustomerOrder>): Promise<CustomerOrder> {
  try {
    const response = await api.post('/customers/customer-orders/', data);
    return response.data;
  } catch (err: any) {
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * Create a new Invoice for a Customer
 */
export async function createInvoice(data: Partial<CustomerInvoice>): Promise<CustomerInvoice> {
  try {
    const response = await api.post('/customers/invoices/', data);
    return response.data;
  } catch (err: any) {
    throw new Error(extractErrorMessage(err));
  }
}
