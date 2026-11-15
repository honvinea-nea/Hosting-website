'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(buffer) {
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

async function main() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    throw new Error('backend/.env already exists. Keep it safe; remove it only if you intentionally want to create a new configuration.');
  }
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const databaseUrl = (await rl.question('Supabase/PostgreSQL connection URL: ')).trim();
    if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl) || /YOUR_|PROJECT_REF|YOUR_DATABASE_PASSWORD/i.test(databaseUrl) || /[\r\n]/.test(databaseUrl)) {
      throw new Error('Enter a real PostgreSQL connection URL from your database provider; example placeholders are not accepted.');
    }
    const email = (await rl.question('Admin email: ')).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid admin email address.');
    const name = (await rl.question('Admin display name: ')).trim();
    if (!name || name.length > 120) throw new Error('Admin display name must be 1-120 characters.');

    const password = await rl.question('Choose your admin password (minimum 12 characters): ');
    const passwordConfirm = await rl.question('Confirm your admin password: ');
    if (password.length < 12) throw new Error('Admin password must contain at least 12 characters.');
    if (password.length > 256 || /[\r\n]/.test(password)) throw new Error('Admin password must be 256 characters or fewer and contain no line breaks.');
    if (password !== passwordConfirm) throw new Error('The passwords do not match.');

    const totpSecret = base32(randomBytes(20));
    const encryptionKey = randomBytes(32).toString('hex');
    const content = [
      'NODE_ENV=development', 'PORT=3000', `DATABASE_URL=${JSON.stringify(databaseUrl)}`,
      'PGSSLMODE=require', 'DB_POOL_SIZE=10',
      'ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000',
      `ADMIN_TOTP_ENCRYPTION_KEY=${encryptionKey}`,
      `ADMIN_EMAIL=${email}`, `ADMIN_NAME=${JSON.stringify(name.replace(/[\r\n]/g, ''))}`,
      `ADMIN_PASSWORD=${JSON.stringify(password)}`, `ADMIN_TOTP_SECRET=${totpSecret}`,
      'ABA_PAYWAY_MERCHANT_ID=', 'ABA_PAYWAY_API_KEY=', 'ABA_PAYWAY_ENV=sandbox', ''
    ].join('\n');
    fs.writeFileSync(envPath, content, { mode: 0o600, flag: 'wx' });
    console.log('\nConfiguration saved to backend/.env (private file).');
    console.log('\nYour admin account details:');
    console.log(`Admin email: ${email}`);
    console.log('Admin password: the password you chose (not displayed).');
    console.log(`Authenticator secret (add to Google Authenticator): ${totpSecret}`);
    console.log('\nNext run: npm run db:migrate && npm run admin:bootstrap && npm start');
  } finally {
    rl.close();
  }
}

main().catch(error => {
  console.error(`Setup failed: ${error.message}`);
  process.exitCode = 1;
});
