'use strict';

const {
  createHash,
  randomBytes,
  scrypt: scryptCallback,
  timingSafeEqual,
  createHmac,
  createCipheriv,
  createDecipheriv
} = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(scryptCallback);
const PASSWORD_N = 16384;
const PASSWORD_R = 8;
const PASSWORD_P = 1;
const PASSWORD_BYTES = 64;

function hashToken(token) {
  return createHash('sha256').update(String(token ?? '')).digest('hex');
}

function decodeBase32(value) {
  if (typeof value !== 'string') throw new Error('Invalid base32 secret');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = value.toUpperCase().replace(/=+$/g, '').replace(/\s/g, '');
  let bits = '';
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error('Invalid base32 secret');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function makeTotp(secret, time = Date.now()) {
  const counter = Math.floor(time / 30000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(code).padStart(6, '0');
}

function safeEqualText(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function verifyTotp(secret, token, time = Date.now()) {
  return matchingTotpCounter(secret, token, time) !== null;
}

function matchingTotpCounter(secret, token, time = Date.now()) {
  if (typeof secret !== 'string' || !/^\d{6}$/.test(String(token))) return null;
  const current = Math.floor(time / 30000);
  let match = null;
  try {
    for (const offset of [-1, 0, 1]) {
      const counter = current + offset;
      if (safeEqualText(makeTotp(secret, counter * 30000), token) && (match === null || Math.abs(offset) < Math.abs(match - current))) {
        match = counter;
      }
    }
  } catch {
    return null;
  }
  return match;
}

async function hashPassword(password, { minLength = 12 } = {}) {
  if (typeof password !== 'string' || password.length < minLength || password.length > 1024) {
    throw new Error(`Password must be between ${minLength} and 1024 characters`);
  }
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, PASSWORD_BYTES, {
    N: PASSWORD_N,
    r: PASSWORD_R,
    p: PASSWORD_P,
    maxmem: 64 * 1024 * 1024
  });
  return `scrypt$${PASSWORD_N}$${PASSWORD_R}$${PASSWORD_P}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || typeof encoded !== 'string' || password.length > 1024) return false;
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nText, rText, pText, saltText, hashText] = parts;
  const N = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  const salt = Buffer.from(saltText, 'base64url');
  const expected = Buffer.from(hashText, 'base64url');
  if (N !== PASSWORD_N || r !== PASSWORD_R || p !== PASSWORD_P || salt.length !== 16 || expected.length !== PASSWORD_BYTES) return false;
  const actual = await scrypt(password, salt, expected.length, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(actual, expected);
}

function newSessionToken() {
  return randomBytes(32).toString('base64url');
}

function validateTotpSecret(secret) {
  if (typeof secret !== 'string' || !/^[A-Z2-7]{16,64}$/i.test(secret)) return false;
  try {
    return decodeBase32(secret).length >= 10;
  } catch {
    return false;
  }
}

function totpEncryptionKey() {
  const encoded = process.env.ADMIN_TOTP_ENCRYPTION_KEY || '';
  if (!/^[\da-f]{64}$/i.test(encoded)) {
    throw new Error('ADMIN_TOTP_ENCRYPTION_KEY must be a 32-byte hexadecimal key.');
  }
  return Buffer.from(encoded, 'hex');
}

function encryptTotpSecret(secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', totpEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`;
}

function decryptTotpSecret(value) {
  const [version, ivText, tagText, ciphertextText] = String(value).split(':');
  if (version !== 'v1' || !ivText || !tagText || !ciphertextText) throw new Error('Stored authenticator secret has an invalid format.');
  const decipher = createDecipheriv('aes-256-gcm', totpEncryptionKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]).toString('utf8');
}

module.exports = {
  hashToken,
  decodeBase32,
  makeTotp,
  verifyTotp,
  matchingTotpCounter,
  hashPassword,
  verifyPassword,
  newSessionToken,
  validateTotpSecret,
  totpEncryptionKey,
  encryptTotpSecret,
  decryptTotpSecret
};
