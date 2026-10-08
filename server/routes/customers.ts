/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getAllSqliteCustomers,
  getSqliteCustomerById,
  saveSqliteCustomer,
  deleteSqliteCustomer,
  saveSqliteDeal,
  deleteSqliteDeal,
  saveSqliteInvoice,
  deleteSqliteInvoice,
  saveSqliteCustomerOrder,
} from '../../src/lib/sqlite-db';
import { requireAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

// Protect all customer CRM endpoints with administrative privileges
router.use(requireAdmin);

// Zod Validation Schemas
const CreateCustomerSchema = z.object({
  name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  status: z.enum(['Active', 'Inactive', 'Lead', 'VIP', 'Archived']).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  is_registered: z.boolean().optional(),
}).refine(data => Boolean(data.name || data.first_name || data.email), {
  message: 'Customer name or email is required.',
  path: ['name']
});

const CreateDealSchema = z.object({
  customer: z.string().min(1, 'Customer ID is required.'),
  title: z.string().min(1, 'Deal title is required.'),
  value: z.number().nonnegative().optional(),
  stage: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  expected_close: z.string().optional(),
  notes: z.string().optional(),
});

const CreateInvoiceSchema = z.object({
  customer: z.string().min(1, 'Customer ID is required.'),
  amount: z.number().positive('Invoice amount must be greater than zero.'),
  invoice_number: z.string().optional(),
  status: z.enum(['Paid', 'Unpaid', 'Overdue', 'Cancelled']).optional(),
  due_date: z.string().optional(),
  issue_date: z.string().optional(),
  notes: z.string().optional(),
});

const CreateCustomerOrderLinkSchema = z.object({
  customer: z.string().min(1, 'Customer ID is required.'),
  order_id: z.string().min(1, 'Order ID is required.'),
  order_number: z.string().optional(),
  total_amount: z.number().nonnegative().optional(),
  status: z.string().optional(),
});

// 1. Customer Directory CRUD
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, status, is_registered } = req.query;
    let list = await getAllSqliteCustomers();

    if (search && typeof search === 'string') {
      const q = search.toLowerCase().trim();
      list = list.filter((c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.company && c.company.toLowerCase().includes(q))
      );
    }

    if (status && typeof status === 'string' && status !== 'all') {
      list = list.filter((c) => c.status === status);
    }

    if (is_registered !== undefined && is_registered !== 'all') {
      const isReg = String(is_registered) === 'true';
      list = list.filter((c) => Boolean(c.is_registered) === isReg);
    }

    res.json(list);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch customers.';
    res.status(500).json({ success: false, error: message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const customer = await getSqliteCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, error: `Customer with ID '${req.params.id}' not found.` });
    }
    res.json(customer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch customer profile.';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/', validateBody(CreateCustomerSchema), async (req: Request, res: Response) => {
  try {
    const saved = await saveSqliteCustomer(req.body);
    res.status(201).json(saved);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create customer.';
    res.status(500).json({ success: false, error: message });
  }
});

const handleUpdateCustomer = async (req: Request, res: Response) => {
  try {
    const customerData = { ...req.body, id: req.params.id };
    const saved = await saveSqliteCustomer(customerData);
    res.json(saved);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update customer.';
    res.status(500).json({ success: false, error: message });
  }
};

router.put('/:id', handleUpdateCustomer);
router.patch('/:id', handleUpdateCustomer);

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await deleteSqliteCustomer(req.params.id);
    res.status(204).send();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete customer.';
    res.status(500).json({ success: false, error: message });
  }
});

// 2. Deals Endpoints
router.post('/deals', validateBody(CreateDealSchema), async (req: Request, res: Response) => {
  try {
    const saved = await saveSqliteDeal(req.body);
    res.status(201).json(saved);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create deal.';
    res.status(500).json({ success: false, error: message });
  }
});

router.delete('/deals/:id', async (req: Request, res: Response) => {
  try {
    await deleteSqliteDeal(req.params.id);
    res.status(204).send();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete deal.';
    res.status(500).json({ success: false, error: message });
  }
});

// 3. Invoices Endpoints
router.post('/invoices', validateBody(CreateInvoiceSchema), async (req: Request, res: Response) => {
  try {
    const saved = await saveSqliteInvoice(req.body);
    res.status(201).json(saved);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create invoice.';
    res.status(500).json({ success: false, error: message });
  }
});

router.delete('/invoices/:id', async (req: Request, res: Response) => {
  try {
    await deleteSqliteInvoice(req.params.id);
    res.status(204).send();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete invoice.';
    res.status(500).json({ success: false, error: message });
  }
});

// 4. Customer Order Link
router.post('/customer-orders', validateBody(CreateCustomerOrderLinkSchema), async (req: Request, res: Response) => {
  try {
    const saved = await saveSqliteCustomerOrder(req.body);
    res.status(201).json(saved);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to link customer order.';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
