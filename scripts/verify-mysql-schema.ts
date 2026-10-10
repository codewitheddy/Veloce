/**
 * Direct MySQL Database Verification & Migration Script
 */
import dotenv from 'dotenv';
dotenv.config();

import { getDbPool, initializeDatabaseSchema, saveMysqlOrder, getMysqlOrderById } from '../src/lib/mysql-db';
import { getAllPendingPaymentSubmissions } from '../server/email/db';

async function main() {
  console.log('====================================================');
  console.log('  ROPENIX MYSQL DATABASE INTEGRITY & SCHEMA CHECK   ');
  console.log('====================================================\n');

  try {
    const pool = await getDbPool();
    console.log('1. Connecting to MySQL on XAMPP (127.0.0.1:3306)...');
    
    console.log('2. Running initializeDatabaseSchema()...');
    await initializeDatabaseSchema();

    console.log('3. Inspecting database tables...');
    const [tables]: any = await pool.query('SHOW TABLES');
    console.log(`   Found ${tables.length} tables in ropenix database:`);
    for (const t of tables) {
      const tableName = Object.values(t)[0];
      const [count]: any = await pool.query(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
      console.log(`   - ${tableName}: ${count[0].cnt} rows`);
    }

    console.log('\n4. Testing checkout order placement with M-Pesa reference...');
    const testOrderId = `ORD-TEST-${Date.now()}`;
    const testMpesaCode = `TEST${Math.random().toString(36).substring(2, 7).toUpperCase()}99`;

    const created = await saveMysqlOrder({
      id: testOrderId,
      customerName: 'Alice Mwangi',
      customerEmail: 'alice.test@ropenix.co.ke',
      customerPhone: '0712345678',
      phone: '0712345678',
      items: [
        {
          productId: 'prod-001',
          name: 'Executive Silk Shirt',
          price: 3500,
          quantity: 1,
        }
      ],
      total: 3500,
      paymentMethod: 'mpesa',
      paymentReference: testMpesaCode,
      mpesaPhone: '0712345678',
      status: 'pending',
      paymentStatus: 'pending_verification',
    });

    console.log(`   Created order ${created.id} with paymentReference: ${created.paymentReference}`);

    const retrieved = await getMysqlOrderById(testOrderId);
    if (!retrieved || retrieved.paymentReference !== testMpesaCode) {
      throw new Error(`Order retrieval mismatch: expected ${testMpesaCode}, got ${retrieved?.paymentReference}`);
    }
    console.log('   ✅ Order retrieved from MySQL with correct paymentReference!');

    console.log('\n5. Checking admin pending payment submissions...');
    const pending = await getAllPendingPaymentSubmissions();
    const match = pending.find((p) => p.mpesa_receipt_code === testMpesaCode);
    if (!match) {
      throw new Error(`Payment submission for ${testMpesaCode} not found in pending list!`);
    }
    console.log(`   ✅ Payment submission found in payment_submissions table! ID: ${match.id}, Status: ${match.status}`);

    // Clean up test order
    await pool.query('DELETE FROM orders WHERE id = ?', [testOrderId]);
    await pool.query('DELETE FROM customer_orders WHERE id = ?', [testOrderId]);
    await pool.query('DELETE FROM payment_submissions WHERE mpesa_receipt_code = ?', [testMpesaCode]);
    console.log('   Cleaned up test records.');

    console.log('\n====================================================');
    console.log('  ✅ ALL MYSQL DATABASE SCHEMA CHECKS PASSED!        ');
    console.log('====================================================');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ DATABASE CHECK FAILED:', err);
    process.exit(1);
  }
}

main();
