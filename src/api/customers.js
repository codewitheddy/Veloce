/**
 * Customer Management API Service Module
 * Implements fetch-based operations against Django REST Framework /api/ endpoints.
 */

const API_BASE = '/api';

/**
 * Helper to get authentication headers from localStorage or cookies
 */
const getAuthHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  try {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // ignore in environments without localStorage
  }
  return headers;
};

/**
 * Handle API responses with standardized error parsing
 */
const handleResponse = async (response) => {
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

/**
 * Fetch paginated or filtered list of customers
 * @param {Object} params - { search, status, ordering, page }
 */
export async function getCustomers(params = {}) {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      queryParams.append(key, val);
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
 * @param {string} id - Customer ID
 */
export async function getCustomer(id) {
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
 * @param {Object} data - { first_name, last_name, email, phone, company, status, notes }
 */
export async function createCustomer(data) {
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
 * @param {string} id - Customer ID
 * @param {Object} data - updated fields
 */
export async function updateCustomer(id, data) {
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
 * @param {string} id - Customer ID
 */
export async function deleteCustomer(id) {
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
 * @param {Object} data - { customer, title, value, stage, expected_close }
 */
export async function createDeal(data) {
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
 * @param {Object} data - { customer, total, status, reference }
 */
export async function createOrder(data) {
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
 * @param {Object} data - { customer, amount, status, due_date, order }
 */
export async function createInvoice(data) {
  const response = await fetch(`${API_BASE}/invoices/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export default {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  createDeal,
  createOrder,
  createInvoice,
};
