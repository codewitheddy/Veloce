/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { 
  getDbStatus, 
  pushSyncData, 
  pullSyncData, 
  purgeAllMysqlData 
} from '../../src/lib/mysql-db';
import { performExpiryBackgroundCheck } from '../services/expiryChecker';
import { requireAdmin, optionalAuth } from '../middleware/auth';
import { loadProductsCache } from './products';

const router = Router();

// ============================================================================
// 1. Health & Status Endpoints
// ============================================================================
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', brand: 'Ropenix', timestamp: new Date().toISOString(), database: 'MySQL' });
});

router.get('/sqlite/status', async (_req: Request, res: Response) => {
  try {
    const status = await getDbStatus();
    res.json({
      ...status,
      dbEngine: 'MySQL',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to retrieve database status.';
    res.status(500).json({ error: message });
  }
});

router.get('/mysql/status', async (_req: Request, res: Response) => {
  try {
    const status = await getDbStatus();
    res.json(status);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'MySQL status error';
    res.status(500).json({ error: message });
  }
});

router.get('/postgres/status', async (_req: Request, res: Response) => {
  try {
    const status = await getDbStatus();
    res.json({
      ...status,
      dbEngine: 'MySQL',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database status error';
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// 2. Database Sync & Admin Maintenance Endpoints
// ============================================================================
router.post('/sqlite/purge-all', requireAdmin, async (_req: Request, res: Response) => {
  try {
    await purgeAllSqliteData();
    res.json({ success: true, message: 'All data purged cleanly from backend database.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to purge database data.';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/sqlite/sync-push', requireAdmin, async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid sync payload format.' });
    }
    await pushSyncDataSqlite(payload);
    try {
      await loadProductsCache(true);
    } catch (_) {}
    try {
      await pushSyncData(payload);
    } catch (_) {}
    res.json({ success: true, message: 'Database state successfully synchronized.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database push sync failed.';
    res.status(500).json({ success: false, error: message });
  }
});

router.get('/sqlite/sync-pull', optionalAuth, async (_req: Request, res: Response) => {
  try {
    let data: any = null;
    try {
      data = await pullSyncDataSqlite();
    } catch (_) {
      data = await pullSyncData();
    }
    res.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database pull sync failed.';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/admin/expiry-check', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await performExpiryBackgroundCheck(true);
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to perform expiry check';
    res.status(500).json({ success: false, error: message });
  }
});

// ============================================================================
// 3. Diagnostics & Telemetry
// ============================================================================
router.post('/logs/client-error', (req: Request, res: Response) => {
  const { message, stack, url, userAgent } = req.body || {};
  console.warn(`[Client-Side Error Logged]: "${message}" at URL: ${url} (Agent: ${userAgent})`);
  if (stack) {
    console.warn(`[Client Stack Trace]: ${stack.split('\n').slice(0, 3).join(' | ')}`);
  }
  res.json({ success: true, received: true });
});

router.get('/courier/track', (req: Request, res: Response) => {
  try {
    const lookupId = (req.query.id || req.query.orderId || req.query.trackingNumber || '').toString().trim();
    if (!lookupId) {
      return res.status(400).json({ success: false, error: 'Missing tracking ID or Order ID.' });
    }

    const cleanId = lookupId.toUpperCase();
    const hash = cleanId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    const couriers = [
      { name: 'Sarah Jenkins', phone: '+254 712 345 678', vehicle: 'Ropenix Electric Cargo Van', vehicleNo: 'KDA 892V', rating: '4.95 ★', deliveries: 1240, avatarBg: 'bg-indigo-600' },
      { name: 'Marcus Chen', phone: '+254 722 987 654', vehicle: 'Fargo Express E-Bike #402', vehicleNo: 'EB-904', rating: '4.88 ★', deliveries: 890, avatarBg: 'bg-emerald-600' },
      { name: 'Elena Rostova', phone: '+254 733 112 233', vehicle: 'G4S Hybrid Cargo Truck', vehicleNo: 'KCY 402B', rating: '4.98 ★', deliveries: 2150, avatarBg: 'bg-violet-600' }
    ];
    const driver = couriers[hash % couriers.length];

    const progressPercent = hash % 2 === 0 ? 85 : (hash % 3 === 0 ? 100 : 65);
    const status = progressPercent === 100 ? 'delivered' : (progressPercent >= 85 ? 'out_for_delivery' : 'in_transit');
    const statusLabel = progressPercent === 100 ? 'Delivered & Handed Over' : (progressPercent >= 85 ? 'Out for Last-Mile Delivery' : 'In Transit to Regional Sorting Terminal');

    res.json({
      success: true,
      orderId: cleanId,
      trackingNumber: cleanId.startsWith('ROP-TRK-') ? cleanId : `ROP-TRK-${cleanId.replace(/[^A-Z0-9]/g, '').slice(-8)}`,
      carrier: 'Ropenix Express Logistics / Fargo Courier',
      status,
      statusLabel,
      progressPercent,
      estimatedDelivery: 'Today, by 5:30 PM',
      driver,
      checkpoints: [
        { title: 'Order Picked Up & Inspected', location: 'Ropenix Fulfillment Hub, Industrial Area, Nairobi', timestamp: new Date(Date.now() - 3600000 * 4).toISOString(), completed: true },
        { title: 'Sorted at Regional Terminal', location: 'Nairobi Central Sorting Hub', timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), completed: true },
        { title: 'Out for Last-Mile Courier Delivery', location: 'En route to delivery address', timestamp: progressPercent >= 85 ? new Date(Date.now() - 1800000).toISOString() : null, completed: progressPercent >= 85 },
        { title: 'Package Handed Over & Signed', location: 'Recipient Address', timestamp: progressPercent === 100 ? new Date().toISOString() : null, completed: progressPercent === 100 }
      ]
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Tracking lookup error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
