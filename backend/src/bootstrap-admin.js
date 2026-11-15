'use strict';

require('dotenv').config({ quiet: true });

const pool = require('./database');
const { encryptTotpSecret, hashPassword, validateTotpSecret } = require('./security');

async function bootstrap() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const displayName = String(process.env.ADMIN_NAME || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  const totpSecret = process.env.ADMIN_TOTP_SECRET || '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set ADMIN_EMAIL to a valid email address.');
  if (!displayName || displayName.length > 120) throw new Error('Set ADMIN_NAME (1-120 characters).');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
  if (!validateTotpSecret(totpSecret)) throw new Error('Set ADMIN_TOTP_SECRET to a base32 secret containing at least 80 bits.');

  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    `INSERT INTO admin_users (email, display_name, password_hash, totp_secret, role_id)
     VALUES ($1, $2, $3, $4, 'super_admin')
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [email, displayName, passwordHash, encryptTotpSecret(totpSecret.toUpperCase())]
  );
  if (!result.rowCount) throw new Error('An administrator with this email already exists; bootstrap will not replace credentials.');
  console.log(`Created the initial Super Admin account ${email}. Configure an authenticator app with the supplied TOTP secret.`);
}

bootstrap()
  .catch(error => {
    console.error('Admin bootstrap failed.', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
