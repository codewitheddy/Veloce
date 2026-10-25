/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Preflight Check Script for Product Reviews Migration (CommonJS / Plain Node)
 * 
 * Audits the target MySQL / MariaDB database before migration:
 * 1. Database engine & version.
 * 2. Charset & Collation on `orders`, `products`, `users`.
 * 3. Primary key column types for `orders.id`, `products.id`, `users.id` (must be VARCHAR(255)).
 * 4. Checks legacy `reviews` table row count and warns if non-empty.
 * 
 * Usage:
 *   node scripts/preflight-check.cjs
 *   node scripts/preflight-check.cjs --db custom_db_name
 *   node scripts/preflight-check.cjs --acknowledged-legacy-reviews
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

function getDbHost() {
  let host = (process.env.DB_HOST || '127.0.0.1').trim();
  if (host === 'localhhost' || host === 'localhost') host = '127.0.0.1';
  return host;
}

function getDbUser() {
  return (process.env.DB_USER || 'root').trim();
}

function getDbPassword() {
  return process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '';
}

function getDbName() {
  return (process.env.DB_NAME || 'ropenix').trim();
}

function getDbPort() {
  return Number(process.env.DB_PORT) || 3306;
}

async function runPreflightCheck(options = {}) {
  const targetDb = (options.dbName || getDbName()).trim();
  const acknowledgeLegacy = Boolean(options.acknowledgeLegacy);

  console.log('\n================================================================');
  console.log(`[Preflight] Running database preflight audit on: ${targetDb}`);
  console.log('================================================================');

  const pool = mysql.createPool({
    host: getDbHost(),
    user: getDbUser(),
    password: getDbPassword(),
    port: getDbPort(),
    database: targetDb,
    waitForConnections: true,
    connectionLimit: 4,
  });

  const issues = [];

  try {
    // 1. Check Server Version
    const [versionRows] = await pool.query('SELECT VERSION() as version');
    const dbVersion = versionRows[0] ? versionRows[0].version : 'Unknown';
    console.log(`1. Database Server Version: ${dbVersion}`);

    // 2. Check Table Collation & Charset on orders, products, users
    const [tableRows] = await pool.query(
      `SELECT t.table_name, t.table_collation, c.character_set_name
       FROM information_schema.tables t
       LEFT JOIN information_schema.collation_character_set_applicability c
         ON t.table_collation = c.collation_name
       WHERE t.table_schema = ? 
         AND t.table_name IN ('orders', 'products', 'users')`,
      [targetDb]
    );

    console.log('\n2. Core Tables Collation & Charset:');
    const tableCollations = new Map();
    const tableCharsets = new Map();
    for (const t of tableRows) {
      const charset = t.character_set_name || 'utf8mb4';
      console.log(`   - Table '${t.table_name}': collation = ${t.table_collation}, charset = ${charset}`);
      tableCollations.set(t.table_name, t.table_collation);
      tableCharsets.set(t.table_name, charset);
    }

    const expectedCollation = 'utf8mb4_general_ci';
    for (const tableName of ['orders', 'products', 'users']) {
      const col = tableCollations.get(tableName);
      if (!col) {
        issues.push({
          type: 'MISSING_TABLE',
          message: `Required table '${tableName}' does not exist in database '${targetDb}'.`,
          resolution: `Verify target database name or import your database schema backup first.`,
        });
      } else if (col !== expectedCollation) {
        issues.push({
          type: 'COLLATION_MISMATCH',
          message: `Table '${tableName}' collation is '${col}' (expected '${expectedCollation}').`,
          resolution: `Align table collation using: ALTER TABLE \`${tableName}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`,
        });
      }
    }

    // 3. Check ID Column Types on orders, products, users
    const [colRows] = await pool.query(
      `SELECT table_name, column_name, column_type, collation_name 
       FROM information_schema.columns 
       WHERE table_schema = ? 
         AND table_name IN ('orders', 'products', 'users')
         AND column_name = 'id'`,
      [targetDb]
    );

    console.log('\n3. Primary Key Column Types:');
    for (const c of colRows) {
      console.log(`   - Column '${c.table_name}.id': ${c.column_type} (${c.collation_name || 'none'})`);
      if (!c.column_type.toLowerCase().includes('varchar(255)')) {
        issues.push({
          type: 'COLUMN_TYPE_MISMATCH',
          message: `Column '${c.table_name}.id' type is '${c.column_type}' (expected 'varchar(255)').`,
          resolution: `Alter the column to varchar(255): ALTER TABLE \`${c.table_name}\` MODIFY \`id\` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL;`,
        });
      }
    }

    // 4. Check Legacy reviews table row count
    const [reviewsTblCheck] = await pool.query(
      `SELECT COUNT(*) as cnt 
       FROM information_schema.tables 
       WHERE table_schema = ? AND table_name = 'reviews'`,
      [targetDb]
    );

    let legacyReviewsCount = 0;
    if (reviewsTblCheck[0] && reviewsTblCheck[0].cnt > 0) {
      const [countRes] = await pool.query('SELECT COUNT(*) as cnt FROM reviews');
      legacyReviewsCount = Number(countRes[0] ? countRes[0].cnt : 0);
      console.log(`\n4. Legacy Reviews Table: Found (${legacyReviewsCount} rows).`);

      if (legacyReviewsCount > 0) {
        if (!acknowledgeLegacy) {
          issues.push({
            type: 'LEGACY_REVIEWS_NOT_EMPTY',
            message: `Legacy 'reviews' table contains ${legacyReviewsCount} row(s).`,
            resolution: `The migration will safely rename 'reviews' to 'reviews_legacy_backup'. Legacy reviews will no longer appear on the live site because the new system enforces per-order-item verified customer reviews. If you need to backup legacy reviews, run: mysqldump -u <user> -p <database> reviews > legacy_reviews_backup.sql. To proceed knowing these reviews are safely archived, re-run with: node scripts/preflight-check.cjs --acknowledged-legacy-reviews`,
          });
        } else {
          console.log(`   ⚠ Notice: Legacy reviews table contains ${legacyReviewsCount} rows.`);
          console.log(`     Acknowledged: these rows will be safely archived into 'reviews_legacy_backup' and will no longer appear on the live site.`);
        }
      }
    } else {
      console.log('\n4. Legacy Reviews Table: None detected (Clean environment).');
    }

    console.log('\n================================================================');
    if (issues.length > 0) {
      console.error(`❌ PREFLIGHT CHECK FAILED (${issues.length} issue(s) detected):\n`);
      issues.forEach((iss, idx) => {
        console.error(`Issue #${idx + 1} [${iss.type}]: ${iss.message}`);
        console.error(`  Action: ${iss.resolution}\n`);
      });
      return { passed: false, issues, dbVersion, legacyReviewsCount };
    }

    console.log('✅ PREFLIGHT CHECK PASSED: Database environment is 100% compatible for forward migration.');
    console.log('================================================================\n');
    return { passed: true, issues: [], dbVersion, legacyReviewsCount };
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].includes('preflight-check')) {
  const args = process.argv.slice(2);
  const dbIdx = args.indexOf('--db');
  const dbName = dbIdx !== -1 ? args[dbIdx + 1] : undefined;
  const acknowledgeLegacy = args.includes('--acknowledged-legacy-reviews');

  runPreflightCheck({ dbName, acknowledgeLegacy })
    .then((res) => {
      if (res.passed) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('[Preflight Fatal Error]:', err);
      process.exit(1);
    });
}

module.exports = { runPreflightCheck };
