/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getAllSqliteSuppliers,
  getSqliteSupplierById,
  saveSqliteSupplier,
  deleteSqliteSupplier,
  getSqliteSupplierStatement,
  getAllSqliteSupplierProducts,
  saveSqliteSupplierProduct,
  getAllSqliteSupplierIntakes,
  saveSqliteSupplierIntake,
  getAllSqliteSupplierPayments,
  saveSqliteSupplierPayment,
  getSqliteSupplierDashboardAnalytics,
  getSqliteSupplierReport,
} from '../../src/lib/sqlite-db';
import { requireAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

// Protect all supplier management endpoints with administrative privileges
router.use(requireAdmin);

// Zod Validation Schemas
const CreateSupplierSchema = z.object({
  name: z.string().optional(),
  company_name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  tax_id: z.string().optional(),
  currency: z.string().optional(),
  status: z.enum(['Active', 'Inactive', 'Suspended']).optional(),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
}).refine(data => Boolean(data.name || data.company_name), {
  message: 'Supplier contact name or company name is required.',
  path: ['name']
});

const SupplierProductSchema = z.object({
  supplier: z.string().min(1, 'Supplier ID is required.'),
  product: z.string().min(1, 'Product ID is required.'),
  supplier_sku: z.string().optional(),
  supplier_price: z.number().nonnegative().optional(),
  moq: z.number().int().positive().optional(),
  lead_time_days: z.number().int().nonnegative().optional(),
  is_preferred: z.boolean().optional(),
});

const SupplierIntakeSchema = z.object({
  supplier: z.string().min(1, 'Supplier ID is required.'),
  product_name: z.string().min(1, 'Product name is required.'),
  quantity_received: z.number().positive('Quantity received must be greater than zero.'),
  unit_cost: z.number().nonnegative().optional(),
  total_cost: z.number().nonnegative().optional(),
  batch_number: z.string().optional(),
  expiry_date: z.string().optional(),
  notes: z.string().optional(),
});

const SupplierPaymentSchema = z.object({
  supplier: z.string().min(1, 'Supplier ID is required.'),
  amount: z.number().positive('Payment amount must be greater than zero.'),
  payment_method: z.string().min(1, 'Payment method is required.'),
  reference_number: z.string().optional(),
  payment_date: z.string().optional(),
  notes: z.string().optional(),
});

// 1. Supplier Directory Endpoints
router.get('/directory', async (req: Request, res: Response) => {
  try {
    const statusParam = req.query.status as string | undefined;
    const suppliers = await getAllSqliteSuppliers(statusParam);
    res.json(suppliers);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch suppliers.';
    console.error('[Supplier API Error] Failed to fetch suppliers directory:', err);
    res.status(500).json({ success: false, error: message });
  }
});

router.get('/directory/:id', async (req: Request, res: Response) => {
  try {
    const supplier = await getSqliteSupplierById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, error: `Supplier with ID or Code '${req.params.id}' not found.` });
    }
    res.json(supplier);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch supplier details.';
    console.error(`[Supplier API Error] Failed to fetch supplier ${req.params.id}:`, err);
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/directory', validateBody(CreateSupplierSchema), async (req: Request, res: Response) => {
  try {
    const created = await saveSqliteSupplier(req.body);
    res.status(201).json(created);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create supplier profile.';
    console.error('[Supplier API Error] Failed to create supplier:', err);
    res.status(500).json({ success: false, error: message });
  }
});

const handleUpdateSupplier = async (req: Request, res: Response) => {
  try {
    const updates = { ...req.body, id: req.params.id };
    const updated = await saveSqliteSupplier(updates);
    res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update supplier profile.';
    console.error(`[Supplier API Error] Failed to update supplier ${req.params.id}:`, err);
    res.status(500).json({ success: false, error: message });
  }
};

router.put('/directory/:id', handleUpdateSupplier);
router.patch('/directory/:id', handleUpdateSupplier);

router.delete('/directory/:id', async (req: Request, res: Response) => {
  try {
    await deleteSqliteSupplier(req.params.id);
    res.status(204).send();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete supplier.';
    console.error(`[Supplier API Error] Failed to delete supplier ${req.params.id}:`, err);
    res.status(500).json({ success: false, error: message });
  }
});

// 2. Supplier Statement
router.get('/directory/:id/statement', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;
    const statement = await getSqliteSupplierStatement(req.params.id, startDate, endDate);
    res.json(statement);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate supplier statement.';
    console.error(`[Supplier API Error] Failed to generate statement for ${req.params.id}:`, err);
    res.status(500).json({ success: false, error: message });
  }
});

// 3. Supplier Products
router.get('/products', async (req: Request, res: Response) => {
  try {
    const supplierId = (req.query.supplier_id || req.query.supplier) as string | undefined;
    const products = await getAllSqliteSupplierProducts(supplierId);
    res.json(products);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch supplier products.';
    console.error('[Supplier API Error] Failed to fetch supplier products:', err);
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/products', validateBody(SupplierProductSchema), async (req: Request, res: Response) => {
  try {
    const created = await saveSqliteSupplierProduct(req.body);
    res.status(201).json(created);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to link product to supplier.';
    console.error('[Supplier API Error] Failed to link product to supplier:', err);
    res.status(500).json({ success: false, error: message });
  }
});

// 4. Supplier Intakes
router.get('/intakes', async (req: Request, res: Response) => {
  try {
    const supplierId = (req.query.supplier_id || req.query.supplier) as string | undefined;
    const intakes = await getAllSqliteSupplierIntakes(supplierId);
    res.json(intakes);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch intake batches.';
    console.error('[Supplier API Error] Failed to fetch intake batches:', err);
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/intakes', validateBody(SupplierIntakeSchema), async (req: Request, res: Response) => {
  try {
    const created = await saveSqliteSupplierIntake(req.body);
    res.status(201).json(created);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record intake batch.';
    console.error('[Supplier API Error] Failed to create intake batch:', err);
    res.status(500).json({ success: false, error: message });
  }
});

// 5. Supplier Payments
router.get('/payments', async (req: Request, res: Response) => {
  try {
    const supplierId = (req.query.supplier_id || req.query.supplier) as string | undefined;
    const payments = await getAllSqliteSupplierPayments(supplierId);
    res.json(payments);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch supplier payments.';
    console.error('[Supplier API Error] Failed to fetch supplier payments:', err);
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/payments', validateBody(SupplierPaymentSchema), async (req: Request, res: Response) => {
  try {
    const created = await saveSqliteSupplierPayment(req.body);
    res.status(201).json(created);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record payment disbursement.';
    console.error('[Supplier API Error] Failed to create supplier payment:', err);
    res.status(500).json({ success: false, error: message });
  }
});

// 6. Supplier Analytics Dashboard
router.get('/analytics/dashboard', async (_req: Request, res: Response) => {
  try {
    const metrics = await getSqliteSupplierDashboardAnalytics();
    res.json(metrics);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve supplier dashboard analytics.';
    console.error('[Supplier API Error] Failed to generate dashboard analytics:', err);
    res.status(500).json({ success: false, error: message });
  }
});

// 7. Supplier Reports
router.get('/reports', async (req: Request, res: Response) => {
  try {
    const type = (req.query.type as string) || 'outstanding_balances';
    const supplierId = (req.query.supplier_id || req.query.supplier) as string | undefined;
    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;
    const report = await getSqliteSupplierReport(type, supplierId, startDate, endDate);
    res.json(report);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate supplier report.';
    console.error('[Supplier API Error] Failed to generate report:', err);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
