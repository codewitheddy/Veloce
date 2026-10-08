/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import readline from 'readline';
import { 
  getSqliteUserByEmail, 
  saveSqliteUser, 
  getAllSqliteUsers, 
  getSqliteDb, 
  saveSqliteDb 
} from '../src/lib/sqlite-db';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function prompt(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function listAdmins() {
  const users = await getAllSqliteUsers();
  const admins = users.filter((u) => u.is_staff || u.is_superuser);

  console.log('\n========================================');
  console.log('  CURRENT ADMIN & STAFF ACCOUNTS');
  console.log('========================================');
  if (admins.length === 0) {
    console.log('  No admin accounts found in the database.');
  } else {
    admins.forEach((adm, idx) => {
      console.log(
        `  ${idx + 1}. [${adm.is_superuser ? 'SUPERUSER' : 'STAFF'}] ${adm.email} | Name: ${adm.first_name || 'N/A'} ${adm.last_name || ''} (ID: ${adm.id})`
      );
    });
  }
  console.log('========================================\n');
}

async function setAdminAccount(emailInput?: string, passwordInput?: string, nameInput?: string) {
  let email = emailInput?.trim().toLowerCase();
  let password = passwordInput?.trim();
  let name = nameInput?.trim();

  // If args are not supplied, enter interactive CLI mode
  if (!email) {
    console.log('\n========================================');
    console.log('  ROPENIX / VELOCE - ADMIN SETUP CLI');
    console.log('========================================');
    email = (await prompt('Enter Admin Email: ')).trim().toLowerCase();
  }

  if (!email || !email.includes('@')) {
    console.error('❌ Error: A valid email address is required.');
    process.exit(1);
  }

  const existingUser = await getSqliteUserByEmail(email);

  if (existingUser) {
    console.log(`\nℹ️ Found existing account for: ${email}`);
    console.log(`  Current role: ${existingUser.is_superuser || existingUser.is_staff ? 'Admin / Staff' : 'Customer'}`);

    if (!password) {
      const changePass = await prompt('Do you want to update the password? (y/N): ');
      if (changePass.toLowerCase() === 'y' || changePass.toLowerCase() === 'yes') {
        password = await prompt('Enter New Password (min 8 chars): ');
      }
    }

    let passwordHash = existingUser.password_hash;
    if (password) {
      if (password.length < 8) {
        console.error('❌ Error: Password must be at least 8 characters long.');
        process.exit(1);
      }
      passwordHash = hashPassword(password);
    }

    if (!name && !existingUser.first_name) {
      name = await prompt('Enter Admin Full Name (optional): ');
    }

    const updatedUser = await saveSqliteUser({
      id: existingUser.id,
      username: existingUser.username || email.split('@')[0],
      email: email,
      password_hash: passwordHash,
      first_name: name || existingUser.first_name || 'Administrator',
      last_name: existingUser.last_name || '',
      phone: existingUser.phone || '',
      is_staff: true,
      is_superuser: true,
      email_verified: true,
      partner_tier: 'Diamond'
    });

    console.log('\n========================================');
    console.log('✅ SUCCESS: User elevated to Superuser Admin!');
    console.log('========================================');
    console.log(`  Email:       ${updatedUser.email}`);
    console.log(`  Name:        ${updatedUser.first_name} ${updatedUser.last_name}`.trim());
    console.log(`  Superuser:   YES`);
    console.log(`  Staff:       YES`);
    console.log(`  Verified:    YES`);
    if (password) {
      console.log(`  Password:    [Updated]`);
    }
    console.log('========================================\n');
  } else {
    // Create new admin user
    if (!password) {
      password = await prompt('Enter Admin Password (min 8 chars): ');
    }

    if (!password || password.length < 8) {
      console.error('❌ Error: Password must be at least 8 characters long.');
      process.exit(1);
    }

    if (!name) {
      name = await prompt('Enter Admin Full Name (e.g. Lead Administrator): ') || 'Administrator';
    }

    const passwordHash = hashPassword(password);
    const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'admin';

    const newUser = await saveSqliteUser({
      username: username,
      email: email,
      password_hash: passwordHash,
      first_name: name,
      last_name: '',
      phone: '',
      is_staff: true,
      is_superuser: true,
      email_verified: true,
      partner_tier: 'Diamond'
    });

    console.log('\n========================================');
    console.log('✅ SUCCESS: New Admin Account Created!');
    console.log('========================================');
    console.log(`  Email:       ${newUser.email}`);
    console.log(`  Username:    ${newUser.username}`);
    console.log(`  Name:        ${newUser.first_name}`);
    console.log(`  Superuser:   YES`);
    console.log(`  Staff:       YES`);
    console.log(`  Status:      Verified`);
    console.log('========================================\n');
  }

  process.exit(0);
}

// CLI Arg Parsing
const args = process.argv.slice(2);
if (args.includes('--list') || args.includes('-l')) {
  listAdmins().then(() => process.exit(0));
} else {
  const emailArg = args[0];
  const passwordArg = args[1];
  const nameArg = args[2];
  setAdminAccount(emailArg, passwordArg, nameArg).catch((err) => {
    console.error('❌ Unexpected error setting admin account:', err);
    process.exit(1);
  });
}
