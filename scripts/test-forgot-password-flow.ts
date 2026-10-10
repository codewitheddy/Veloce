import dotenv from 'dotenv';
dotenv.config();

import { requestPasswordReset } from '../server/services/passwordResetService';
import { getDbPool } from '../src/lib/mysql-db';

async function testForgotPassword() {
  console.log('Testing password reset request for edwinmuliro64@gmail.com...');
  const res = await requestPasswordReset('edwinmuliro64@gmail.com', '127.0.0.1', 'http://localhost:3000');
  console.log('Result:', res);

  // Wait 4 seconds for async sendEmail
  await new Promise(r => setTimeout(r, 4000));

  const pool = await getDbPool();
  const [tokens]: any = await pool.query('SELECT * FROM password_reset_tokens WHERE user_email = ? ORDER BY created_at DESC LIMIT 3', ['edwinmuliro64@gmail.com']);
  console.log('Tokens in DB:');
  console.table(tokens);

  process.exit(0);
}

testForgotPassword().catch(err => {
  console.error(err);
  process.exit(1);
});
