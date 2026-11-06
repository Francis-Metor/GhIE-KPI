// Secrets (admin reference numbers) are stored as salted scrypt hashes, never in plain text.
const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

async function hashSecret(secret) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(secret), salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

async function verifySecret(secret, stored) {
  const [alg, saltB64, keyB64] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(String(secret), Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// Used when the account does not exist, so "unknown email" and "wrong reference" take the same time.
let dummy;
async function verifyAgainstDummy(secret) {
  dummy = dummy || (await hashSecret(crypto.randomBytes(8).toString('hex')));
  await verifySecret(secret, dummy);
  return false;
}

module.exports = { hashSecret, verifySecret, verifyAgainstDummy };
