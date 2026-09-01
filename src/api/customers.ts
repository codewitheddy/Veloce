/**
 * Customer Management TypeScript API Client and Type Definitions
 * Directly executes fetch against /api/ endpoints with JWT authentication and standardized error handling.
 */

const API_BASE = '/api';

const getAuthHeaders = (): HeadersInit => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  try {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // ignore
  }
  return headers;
};

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (typeof errorData === 'object' && errorData !== null) {
        if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else {
          errorMessage = Object.entries(errorData)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join('; ');
        }
      }
    } catch {
      // response not json
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return true;
  }
  return await response.json();
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
export async function getCustomers(params: CustomerQueryParams = {}) {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      queryParams.append(key, String(val));
    }
  });

  const url = `${API_BASE}/customers/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  return handleResponse(response);
}

/**
 * Fetch detailed customer profile with nested deals, orders, and invoices
 */
export async function getCustomer(id: string): Promise<CustomerDetailItem> {
  if (!id) throw new Error('Customer ID is required');
  const response = await fetch(`${API_BASE}/customers/${id}/`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  return handleResponse(response);
}

/**
 * Create a new Customer record
 */
export async function createCustomer(data: Partial<CustomerListItem>) {
  const response = await fetch(`${API_BASE}/customers/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

/**
 * Update an existing Customer record
 */
export async function updateCustomer(id: string, data: Partial<CustomerListItem>) {
  if (!id) throw new Error('Customer ID is required');
  const response = await fetch(`${API_BASE}/customers/${id}/`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

/**
 * Delete a Customer record
 */
export async function deleteCustomer(id: string) {
  if (!id) throw new Error('Customer ID is required');
  const response = await fetch(`${API_BASE}/customers/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  return handleResponse(response);
}

/**
 * Create a new Deal for a Customer
 */
export async function createDeal(data: Partial<CustomerDeal>) {
  const response = await fetch(`${API_BASE}/deals/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

/**
 * Create a new Order for a Customer
 */
export async function createOrder(data: Partial<CustomerOrder>) {
  const response = await fetch(`${API_BASE}/customer-orders/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

/**
 * Create a new Invoice for a Customer
 */
export async function createInvoice(data: Partial<CustomerInvoice>) {
  const response = await fetch(`${API_BASE}/invoices/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}
