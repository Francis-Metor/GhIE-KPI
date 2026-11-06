const crypto = require('crypto');
const LoginThrottle = require('../../models/LoginThrottle');
const { HttpError } = require('../http');

const WINDOW_MS = 15 * 60 * 1000;
// pair = this IP trying this email; email = anyone trying this email; ip = this IP trying anything.
const LIMITS = { pair: 5, email: 30, ip: 30 };

const digest = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 32);

function keysFor(scope, ip, email) {
  const e = String(email || '').trim().toLowerCase();
  const i = String(ip || 'unknown');
  return [
    { key: `${scope}:pair:${digest(`${i}|${e}`)}`, max: LIMITS.pair },
    { key: `${scope}:email:${digest(e)}`, max: LIMITS.email },
    { key: `${scope}:ip:${digest(i)}`, max: LIMITS.ip },
  ];
}

async function assertAllowed(keys, now = new Date()) {
  const docs = await LoginThrottle.find({ key: { $in: keys.map((k) => k.key) }, expiresAt: { $gt: now } }).lean();
  for (const { key, max } of keys) {
    const d = docs.find((x) => x.key === key);
    if (d && d.count >= max) {
      const mins = Math.max(1, Math.ceil((d.expiresAt - now) / 60000));
      throw new HttpError(429, `Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
    }
  }
}

async function recordFailure(keys, now = new Date()) {
  for (const { key } of keys) {
    const bumped = await LoginThrottle.findOneAndUpdate({ key, expiresAt: { $gt: now } }, { $inc: { count: 1 } }, { new: true });
    if (!bumped) {
      await LoginThrottle.findOneAndUpdate({ key }, { $set: { count: 1, expiresAt: new Date(+now + WINDOW_MS) } }, { upsert: true })
        .catch((e) => { if (e.code !== 11000) throw e; }); // a parallel request created it first
    }
  }
}

// A successful sign-in clears only the per-person counter.
const reset = (keys) => LoginThrottle.deleteMany({ key: keys[0].key });

module.exports = { LIMITS, WINDOW_MS, keysFor, assertAllowed, recordFailure, reset };
