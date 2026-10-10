import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import ordersRouter from '../server/routes/orders';
import { initializeDatabaseSchema, getDbPool } from '../src/lib/mysql-db';
import { registerEmailEventListeners } from '../server/email/events';
import { processQueueBatch } from '../server/email/queue';

async function run() {
  console.log('1. Initializing DB schema & events...');
  await initializeDatabaseSchema();
  registerEmailEventListeners();

  const app = express();
  app.use(express.json());
  app.use('/api/orders', ordersRouter);

  const server = app.listen(3099, async () => {
    console.log('2. Test server running on port 3099');

    const orderPayload = {
      customerName: 'Edwin Muliro',
      customerEmail: 'edwinmuliro64@gmail.com',
      phone: '+254712849201',
      shippingAddress: 'Westlands, Nairobi, Kenya',
      paymentMethod: 'M-PESA',
      paymentReference: 'MPESA992011',
      subtotal: 11900,
      shippingFee: 0,
      discount: 0,
      total: 11900,
      items: [
        {
          productId: 'prod-oak-riser',
          name: 'Solid Walnut Dual Monitor Riser with MagSafe Slot',
          sku: 'DSK-OAK-001',
          quantity: 1,
          price: 11900,
        }
      ]
    };

    console.log('3. Sending POST /api/orders request with payload:');
    console.log(orderPayload);

    try {
      const res = await fetch('http://localhost:3099/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      const data = await res.json();
      console.log(`4. Response Status: ${res.status}`);
      console.log('   Response Data:', data);

      if (res.status === 201 || res.status === 200) {
        console.log('   ✅ Order created successfully!');
        
        console.log('5. Processing email queue batch...');
        const processed = await processQueueBatch(5);
        console.log(`   Processed ${processed} queue batch email(s).`);

        // Wait a few seconds for SMTP delivery
        await new Promise(r => setTimeout(r, 4000));

        const pool = await getDbPool();
        const [jobs]: any = await pool.query('SELECT id, email_type, recipient, status, attempts, error_message FROM email_jobs WHERE recipient = ? ORDER BY created_at DESC LIMIT 3', ['edwinmuliro64@gmail.com']);
        console.log('   Email Jobs for customer:');
        console.table(jobs);

        const [logs]: any = await pool.query('SELECT id, recipient, email_type, status, error_message FROM email_logs WHERE recipient = ? ORDER BY created_at DESC LIMIT 3', ['edwinmuliro64@gmail.com']);
        console.log('   Email Logs for customer:');
        console.table(logs);
      } else {
        console.error('   ❌ Order creation failed:', data);
      }
    } catch (err: any) {
      console.error('   ❌ Error making request:', err.message || err);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
