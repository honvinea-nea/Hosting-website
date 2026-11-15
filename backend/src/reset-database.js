'use strict';

/**
 * Destructive maintenance command.
 *
 * Clears every application record while keeping the migrated schema, role and
 * permission reference tables, and migration history intact. It then creates a
 * single administrator account:
 *
 *   email:    admin@gmail.com
 *   password: admin123 (stored only as a salted scrypt hash)
 *   role:     admin (granted every administrator permission)
 *
 * Run with: npm run db:reset -- --yes
 */

require('dotenv').config({ quiet: true });

const { randomBytes } = require('node:crypto');
const { encryptTotpSecret, hashPassword, totpEncryptionKey } = require('./security');

const ADMIN_ACCOUNT = Object.freeze({
  email: 'admin@gmail.com',
  password: 'admin123',
  name: 'Administrator',
  role: 'admin'
});

// Every table that stores application/business data. Reference tables
// (admin_roles, admin_permissions, admin_role_permissions) and the migration
// history table are deliberately excluded so the schema and role model survive.
const DATA_TABLES = Object.freeze([
  'admin_sessions',
  'admin_login_attempts',
  'admin_audit_logs',
  'shop_order_items',
  'shop_inventory_movements',
  'shop_orders',
  'shop_notifications',
  'shop_promotions',
  'shop_settings',
  'shop_customers',
  'shop_products',
  'shop_categories',
  'admin_users'
]);

function base32(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function quoteIdentifier(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function resetDatabase(client, { admin = ADMIN_ACCOUNT } = {}) {
  // Fail before touching anything if the TOTP encryption key is missing/invalid.
  totpEncryptionKey();

  const passwordHash = await hashPassword(admin.password, { minLength: 8 });
  // The login endpoint currently authenticates email + password only, but the
  // schema requires an encrypted authenticator secret for every admin row.
  const totpSecret = base32(randomBytes(20));

  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock($1)', [734921805]);

    const adminTable = await client.query("SELECT to_regclass('public.admin_users') AS name");
    if (!adminTable.rows[0].name) {
      throw new Error('The database schema is not initialized. Run `npm run db:migrate` first.');
    }
    const role = await client.query('SELECT 1 FROM admin_roles WHERE id = $1', [admin.role]);
    if (!role.rowCount) {
      throw new Error(`The "${admin.role}" role is missing. Run the database migrations first.`);
    }

    const existing = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_name = ANY($1::text[])`,
      [DATA_TABLES]
    );
    const tables = DATA_TABLES.filter(name => existing.rows.some(row => row.table_name === name));
    if (!tables.includes('admin_users')) throw new Error('The admin_users table was not found.');

    await client.query(`TRUNCATE TABLE ${tables.map(quoteIdentifier).join(', ')} RESTART IDENTITY`);

    // Give the admin role every administrator permission so the seeded account
    // has full administrative access.
    await client.query(
      `INSERT INTO admin_role_permissions (role_id, permission_id)
       SELECT $1, id FROM admin_permissions
       ON CONFLICT DO NOTHING`,
      [admin.role]
    );

    const inserted = await client.query(
      `INSERT INTO admin_users (email, display_name, password_hash, totp_secret, role_id, active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, email, display_name, role_id`,
      [admin.email, admin.name, passwordHash, encryptTotpSecret(totpSecret), admin.role]
    );

    const counts = await client.query(
      `SELECT (SELECT count(*)::int FROM admin_users) AS admin_users,
              (SELECT count(*)::int FROM shop_orders) AS shop_orders`
    );

    await client.query('COMMIT');
    return {
      admin: { ...inserted.rows[0], role: admin.role },
      clearedTables: tables.filter(table => table !== 'admin_users'),
      counts: counts.rows[0]
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  if (!process.argv.includes('--yes')) {
    throw new Error('This command permanently deletes all application data. Re-run with: npm run db:reset -- --yes');
  }
  const pool = require('./database');
  const client = await pool.connect();
  try {
    const result = await resetDatabase(client);
    console.log(`Cleared ${result.clearedTables.length} data tables (schema preserved).`);
    console.log(`Created administrator ${result.admin.email} with role "${result.admin.role}".`);
    console.log('Password: the requested credential, stored as a salted scrypt hash only.');
    console.log(`Remaining administrators: ${result.counts.admin_users}.`);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Database reset failed.', error.message);
    process.exitCode = 1;
  });
}

module.exports = { ADMIN_ACCOUNT, DATA_TABLES, resetDatabase };
