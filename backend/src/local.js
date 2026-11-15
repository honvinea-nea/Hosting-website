'use strict';

/**
 * Zero-configuration local development server.
 *
 * Runs an embedded PostgreSQL-compatible database (PGlite) inside this project,
 * applies the SQL migrations, seeds the `admin@gmail.com` administrator on a
 * brand-new database, and starts the API. No external PostgreSQL or Supabase
 * project is required.
 *
 * Run with: npm run local
 *
 * Data is kept in backend/.data and survives restarts. Set DATABASE_URL and
 * start the API normally (`npm start`) to use a hosted database instead.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');

const DATA_DIR = path.join(__dirname, '..', '.data');
const PGLITE_DIR = path.join(DATA_DIR, 'pglite');
const KEY_FILE = path.join(DATA_DIR, 'admin-totp-encryption.key');
const PORT = Number(process.env.LOCAL_DB_PORT) || 55432;

function loadOrCreateKey() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(KEY_FILE)) {
    const existing = fs.readFileSync(KEY_FILE, 'utf8').trim();
    if (/^[\da-f]{64}$/i.test(existing)) return existing;
  }
  const key = randomBytes(32).toString('hex');
  fs.writeFileSync(KEY_FILE, `${key}\n`, { mode: 0o600 });
  return key;
}

// Spawn asynchronously: the embedded database runs on this event loop, so a
// blocking child process would starve it of the queries it needs to answer.
function runNode(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, script), ...args], {
      stdio: 'inherit',
      env: process.env
    });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with code ${code}.`));
    });
  });
}

async function main() {
  // Configure the app for the embedded database before any module reads env.
  process.env.DATABASE_URL = process.env.DATABASE_URL || `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`;
  process.env.PGSSLMODE = process.env.PGSSLMODE || 'disable';
  process.env.ADMIN_TOTP_ENCRYPTION_KEY = process.env.ADMIN_TOTP_ENCRYPTION_KEY || loadOrCreateKey();
  process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000';

  const { PGlite } = require('@electric-sql/pglite');
  const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');

  fs.mkdirSync(PGLITE_DIR, { recursive: true });
  const db = await PGlite.create({ dataDir: PGLITE_DIR });
  const socket = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1', maxConnections: 10 });
  await socket.start();
  console.log(`Local database ready on 127.0.0.1:${PORT} (data: backend/.data/pglite).`);

  await runNode('migrate.js', []);

  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let adminCount = 0;
  try {
    const result = await client.query('SELECT count(*)::int AS count FROM admin_users');
    adminCount = result.rows[0].count;
  } finally {
    await client.end();
  }

  if (adminCount === 0) {
    await runNode('reset-database.js', ['--yes']);
  } else {
    console.log(`Keeping existing local database (${adminCount} administrator account(s)).`);
  }

  console.log('Administrator sign-in: http://localhost:3000/admin/login.html');
  require('./app');
}

main().catch(async error => {
  console.error('Local server failed.', error.message);
  process.exitCode = 1;
});
