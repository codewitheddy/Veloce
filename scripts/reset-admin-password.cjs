#!/usr/bin/env node

/**
 * Reset Admin Password - Direct Database Access
 * Usage: node scripts/reset-admin-password.js
 */

const crypto = require('crypto');
const mysql = require('mysql2/promise');
require('dotenv').config();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function resetAdminPassword() {
  const newPassword = 'AdminPassword123'; // Change this to your desired password
  const adminEmail = 'admin@ropenix.co.ke';

  try {
    console.log('🔐 Admin Password Reset Tool');
    console.log('===========================\n');

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ropenix',
    });

    console.log('✅ Connected to database\n');

    // Check if admin exists
    const [existingAdmins] = await connection.execute(
      'SELECT id, email, username FROM users WHERE is_superuser = 1 OR is_staff = 1 LIMIT 5'
    );

    if (existingAdmins.length === 0) {
      console.log('❌ No admin accounts found. Creating new admin...\n');

      // Create new admin
      const passwordHash = hashPassword(newPassword);
      const userId = `usr-admin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      await connection.execute(
        `INSERT INTO users (
          id, username, email, password_hash, first_name, last_name, 
          is_superuser, is_staff, email_verified, role, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [userId, 'admin', adminEmail, passwordHash, 'Admin', 'User', 1, 1, 1, 'admin']
      );

      console.log('✅ New Admin Account Created!\n');
      console.log('=========================================');
      console.log(`Email:    ${adminEmail}`);
      console.log(`Username: admin`);
      console.log(`Password: ${newPassword}`);
      console.log('=========================================\n');
    } else {
      // Ensure edwinmuliro64@gmail.com is also granted staff & superuser admin role
      await connection.execute(
        `UPDATE users 
         SET is_superuser = 1, is_staff = 1, role = 'admin', email_verified = 1 
         WHERE email = 'edwinmuliro64@gmail.com'`
      );

      // Re-fetch all admins
      const [allAdmins] = await connection.execute(
        'SELECT id, email, username FROM users WHERE is_superuser = 1 OR is_staff = 1 OR email = ?',
        ['edwinmuliro64@gmail.com']
      );

      for (const admin of allAdmins) {
        console.log(`  - ${admin.email} (${admin.username})`);
      }

      console.log('\n🔄 Updating all admin passwords...\n');

      const passwordHash = hashPassword(newPassword);

      // Update all admins with new password
      await connection.execute(
        'UPDATE users SET password_hash = ? WHERE is_superuser = 1 OR is_staff = 1 OR email = ?',
        [passwordHash, 'edwinmuliro64@gmail.com']
      );

      // Extend any active password reset tokens to 2 days (48 hours)
      const twoDaysFromNow = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      await connection.execute(
        'UPDATE password_reset_tokens SET expires_at = ? WHERE used_at IS NULL',
        [twoDaysFromNow]
      );

      console.log('✅ Admin Passwords Reset!\n');
      console.log('=========================================');
      console.log(`Use ANY of these admin emails to login:`);
      for (const admin of existingAdmins) {
        console.log(`  Email: ${admin.email}`);
      }
      console.log(`Password: ${newPassword}`);
      console.log('=========================================\n');
    }

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetAdminPassword();
