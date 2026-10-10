import dotenv from 'dotenv';
dotenv.config();

import { getEmailConfig } from '../server/email/config';
import { getMailTransporter, sendEmail } from '../server/email/transporter';
import { enqueueEmail, processQueueBatch } from '../server/email/queue';
import { emailEvents, registerEmailEventListeners } from '../server/email/events';
import { getDbPool } from '../src/lib/mysql-db';

async function testEmailPipeline() {
  console.log('====================================================');
  console.log('       ROPENIX EMAIL DIAGNOSTIC & TEST SUITE        ');
  console.log('====================================================\n');

  const config = getEmailConfig();
  console.log('1. Checking Email Configuration:');
  console.log(`   - EMAIL_ENABLED: ${config.behavior.enabled}`);
  console.log(`   - EMAIL_DEV_MODE: ${config.behavior.devMode}`);
  console.log(`   - SMTP Host: ${config.smtp.host}:${config.smtp.port} (secure: ${config.smtp.secure})`);
  console.log(`   - SMTP User: ${config.smtp.user}`);
  console.log(`   - Password set: ${config.smtp.pass ? 'YES (length: ' + config.smtp.pass.length + ')' : 'NO'}`);
  console.log(`   - Default From: ${config.smtp.defaultFrom}`);
  console.log(`   - Admin Email: ${config.admin.email}\n`);

  console.log('2. Verifying SMTP Transporter Connection...');
  const transporter = getMailTransporter();
  try {
    const verified = await transporter.verify();
    console.log('   ✅ SMTP Transporter connected and verified successfully!\n');
  } catch (err: any) {
    console.error('   ❌ SMTP Transporter verification failed:', err.message || err);
    console.error('   Details:', err);
    return;
  }

  console.log('3. Testing Domain Event -> Queue -> Delivery Pipeline...');
  registerEmailEventListeners();

  const testOrder = {
    id: `ORD-TEST-${Date.now()}`,
    customerName: 'Test Customer',
    customerEmail: 'ropenixkenya@gmail.com', // Admin/test email
    customerPhone: '+254712345678',
    total: 2500,
    subtotal: 2500,
    shippingFee: 0,
    discount: 0,
    paymentMethod: 'M-PESA',
    paymentReference: 'QA12345678',
    shippingAddress: 'Nairobi, Kenya',
    items: [
      {
        name: 'Veloce Silk Shirt',
        sku: 'VEL-001',
        quantity: 1,
        price: 2500,
      }
    ],
    createdAt: new Date().toISOString(),
    isGuest: false,
  };

  console.log(`   Emitting order:created event for order ${testOrder.id} to ${testOrder.customerEmail}...`);
  emailEvents.emit('order:created', testOrder);

  // Allow setImmediate or queue processing to run
  await new Promise(r => setTimeout(r, 3000));

  console.log('   Running processQueueBatch()...');
  const processed = await processQueueBatch(5);
  console.log(`   Processed ${processed} email job(s).\n`);

  console.log('4. Inspecting email_jobs and email_logs in MySQL...');
  const pool = await getDbPool();
  const [jobs]: any = await pool.query(`SELECT id, email_type, recipient, status, attempts, error_message FROM email_jobs ORDER BY created_at DESC LIMIT 5`);
  console.log('   Recent email_jobs:');
  console.table(jobs);

  const [logs]: any = await pool.query(`SELECT id, recipient, email_type, status, error_message FROM email_logs ORDER BY created_at DESC LIMIT 5`);
  console.log('   Recent email_logs:');
  console.table(logs);

  console.log('\n====================================================');
  console.log('               TEST COMPLETE                        ');
  console.log('====================================================');
  process.exit(0);
}

testEmailPipeline().catch(err => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
