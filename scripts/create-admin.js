#!/usr/bin/env node

/**
 * Create Admin User - Direct Node.js Script
 * Usage: node scripts/create-admin.js admin@example.com mypassword123 "Admin Name"
 */

const crypto = require('crypto');
const mysql = require('mysql2/promise');
require('dotenv').config();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function createAdmin() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3]?.trim();
  const name = process.argv[4]?.trim() || 'Administrator';

  if (!email || !email.includes('@')) {
    console.error('❌ Error: Email is required and must be valid');
    console.error('Usage: node scripts/create-admin.js admin@example.com password123 "Admin Name"');
    process.exit(1);
  }

  if (!password || password.length < 8) {
    console.error('❌ Error: Password must be at least 8 characters');
    process.exit(1);
  }

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ropenix',
    });

    console.log('📡 Connected to database...');

    // Check if user exists
    const [rows] = await connection.execute(
      'SELECT id, email, is_superuser, is_staff FROM users WHERE email = ?',
      [email]
    );

    if (rows.length > 0) {
      // Update existing user
      const user = rows[0];
      const passwordHash = hashPassword(password);
      
      await connection.execute(
        'UPDATE users SET is_superuser = 1, is_staff = 1, email_verified = 1, password_hash = ?, first_name = ? WHERE email = ?',
        [passwordHash, name, email]
      );

      console.log('\n========================================');
      console.log('✅ SUCCESS: User elevated to Admin!');
      console.log('========================================');
      console.log(`  Email:       ${email}`);
      console.log(`  Name:        ${name}`);
      console.log(`  Superuser:   YES`);
      console.log(`  Password:    ${password}`);
      console.log('========================================\n');
    } else {
      // Create new admin user
      const passwordHash = hashPassword(password);
      const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'admin';
      const userId = `usr-admin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      await connection.execute(
        `INSERT INTO users (
          id, username, email, password_hash, first_name, last_name, 
          is_superuser, is_staff, email_verified, role, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [userId, username, email, passwordHash, name, '', 1, 1, 1, 'admin']
      );

      console.log('\n========================================');
      console.log('✅ SUCCESS: New Admin Created!');
      console.log('========================================');
      console.log(`  Email:       ${email}`);
      console.log(`  Username:    ${username}`);
      console.log(`  Name:        ${name}`);
      console.log(`  Superuser:   YES`);
      console.log(`  Password:    ${password}`);
      console.log('========================================\n');
    }

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createAdmin();
