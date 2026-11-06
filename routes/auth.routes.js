const router = require('express').Router();
const crypto = require('crypto');
const db = require('../lib/db/connect');
const { asyncHandler } = require('../lib/http');
const { AuditLog } = require('../models');
const authService = require('../services/auth.service');
const throttle = require('../lib/auth/throttle');
const { signSession, setSessionCookie, clearSessionCookie } = require('../lib/auth/session');

const publicUser = (u) => ({ role: u.role, email: u.email, name: u.displayName });

function safeNext(value, fallback) {
  const next = String(value || '');
  return next.startsWith('/attendance/scan.html?token=') ? next : fallback;
}

async function login(scope, loginFn, redirect, req, res) {
  await db.connectDB();
  const { email, reference } = req.body || {};
  const keys = throttle.keysFor(scope, req.ip, email);
  await throttle.assertAllowed(keys);

  let user;
  try {
    user = await loginFn({ email, reference });
  } catch (err) {
    if (err.status === 401) {
      await throttle.recordFailure(keys);
      const emailHash = crypto.createHash('sha256').update(authService.cleanEmail(email)).digest('hex').slice(0, 12);
      await AuditLog.create({ actorRole: 'system', action: 'auth.login_failed', metadata: { scope, emailHash } }).catch(() => {});
    }
    throw err;
  }
  await throttle.reset(keys);
  setSessionCookie(res, signSession(user));
  res.json({ ok: true, redirect: safeNext(req.body?.next, redirect), user: publicUser(user) });
}

router.post('/member/login', asyncHandler((req, res) => login('member', authService.loginMember, '/member/index.html', req, res)));
router.post('/admin/login', asyncHandler((req, res) => login('admin', authService.loginAdmin, '/admin/index.html', req, res)));

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) =>
  req.user ? res.json({ user: publicUser(req.user) }) : res.status(401).json({ error: 'Not signed in.' }));

module.exports = router;
