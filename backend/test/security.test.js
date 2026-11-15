'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  decryptTotpSecret,
  encryptTotpSecret,
  hashPassword,
  hashToken,
  matchingTotpCounter,
  makeTotp,
  newSessionToken,
  validateTotpSecret,
  verifyPassword,
  verifyTotp
} = require('../src/security');

test('hashes administrator passwords with scrypt and rejects mismatches', async () => {
  const hash = await hashPassword('Correct Horse Battery Staple');
  assert.match(hash, /^scrypt\$16384\$8\$1\$/);
  assert.equal(await verifyPassword('Correct Horse Battery Staple', hash), true);
  assert.equal(await verifyPassword('incorrect password', hash), false);
  await assert.rejects(() => hashPassword('short'), /between 12 and 1024/);
});

test('generates and validates RFC 6238 TOTP codes with the allowed clock window', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const code = makeTotp(secret, 59000);
  assert.equal(code, '287082');
  assert.equal(verifyTotp(secret, code, 59000), true);
  assert.equal(matchingTotpCounter(secret, code, 59000), 1);
  assert.equal(matchingTotpCounter(secret, code, 89000), 1);
  assert.equal(matchingTotpCounter(secret, code, 90000), null);
  assert.equal(verifyTotp(secret, '000000', 59000), false);
  assert.equal(verifyTotp(secret, '28708x', 59000), false);
  assert.equal(verifyTotp('not a secret', '000000', 59000), false);
});

test('validates base32 authenticator secrets', () => {
  assert.equal(validateTotpSecret('GEZDGNBVGY3TQOJQ'), true);
  assert.equal(validateTotpSecret('not a secret'), false);
  assert.equal(validateTotpSecret('ABC'), false);
});

test('encrypts authenticator secrets and detects tampering', () => {
  process.env.ADMIN_TOTP_ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
  const secret = 'GEZDGNBVGY3TQOJQ';
  const encrypted = encryptTotpSecret(secret);
  assert.match(encrypted, /^v1:/);
  assert.notEqual(encrypted, secret);
  assert.equal(decryptTotpSecret(encrypted), secret);
  const [, iv, tag, ciphertext] = encrypted.split(':');
  const tampered = `v1:${iv}:${tag}:${ciphertext[0] === 'A' ? 'B' : 'A'}${ciphertext.slice(1)}`;
  assert.throws(() => decryptTotpSecret(tampered));
  delete process.env.ADMIN_TOTP_ENCRYPTION_KEY;
});

test('session tokens are random and only stored through one-way hashes', () => {
  const first = newSessionToken();
  const second = newSessionToken();
  assert.notEqual(first, second);
  assert.equal(first.length, 43);
  assert.equal(hashToken(first), hashToken(first));
  assert.notEqual(hashToken(first), first);
});
