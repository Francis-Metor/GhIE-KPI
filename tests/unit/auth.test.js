const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { hashSecret, verifySecret } = require('../../lib/auth/password');
const { signSession, verifySession, readSessionCookie, COOKIE_NAME } = require('../../lib/auth/session');
const { keysFor, LIMITS } = require('../../lib/auth/throttle');
const csrfGuard = require('../../middleware/csrfGuard');
const { requireRole } = require('../../middleware/auth');

const fakeRes = () => {
  const r = { code: 200, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};
const run = (mw, req) => { const res = fakeRes(); let called = false; mw(req, res, () => { called = true; }); return { res, called }; };

test('reference numbers are stored as salted hashes that verify correctly', async () => {
  const a = await hashSecret('9013422123');
  const b = await hashSecret('9013422123');
  assert.notEqual(a, b);
  assert.ok(!a.includes('9013422123'));
  assert.equal(await verifySecret('9013422123', a), true);
  assert.equal(await verifySecret('9013422124', a), false);
  assert.equal(await verifySecret('x', 'garbage'), false);
  assert.equal(await verifySecret('x', undefined), false);
});

test('session tokens round-trip and reject tampering, other secrets and other algorithms', () => {
  const token = signSession({ _id: 'abc123', role: 'admin' });
  const payload = verifySession(token);
  assert.equal(payload.sub, 'abc123');
  assert.equal(payload.role, 'admin');
  assert.equal(verifySession(token.slice(0, -2) + 'xx'), null);
  assert.equal(verifySession(jwt.sign({ sub: 'abc123', role: 'admin' }, 'a-different-secret-of-some-length')), null);
  assert.equal(verifySession(jwt.sign({ sub: 'abc123', role: 'admin' }, '', { algorithm: 'none' })), null);
  assert.equal(verifySession(null), null);
  assert.equal(verifySession('not.a.token'), null);
});

test('session cookie is read from the Cookie header', () => {
  assert.equal(readSessionCookie({ headers: { cookie: `a=1; ${COOKIE_NAME}=tok%2Eval; b=2` } }), 'tok.val');
  assert.equal(readSessionCookie({ headers: { cookie: 'a=1' } }), null);
  assert.equal(readSessionCookie({ headers: {} }), null);
});

test('throttle keys are hashed and separate by scope, email and IP', () => {
  const k = keysFor('admin', '1.2.3.4', 'Boss@Example.com');
  assert.equal(k.length, 3);
  assert.deepEqual(k.map((x) => x.max), [LIMITS.pair, LIMITS.email, LIMITS.ip]);
  assert.ok(k.every((x) => !x.key.includes('1.2.3.4') && !x.key.toLowerCase().includes('boss')));
  const same = keysFor('admin', '1.2.3.4', ' boss@example.com ');
  assert.deepEqual(k.map((x) => x.key), same.map((x) => x.key));
  assert.notEqual(keysFor('member', '1.2.3.4', 'boss@example.com')[0].key, k[0].key);
  assert.notEqual(keysFor('admin', '9.9.9.9', 'boss@example.com')[0].key, k[0].key);
});

test('csrfGuard allows reads, blocks cross-site and non-JSON writes', () => {
  const req = (method, headers = {}, jsonBody = true) => ({
    method, get: (h) => headers[h.toLowerCase()], is: () => jsonBody,
  });
  assert.equal(run(csrfGuard, req('GET')).called, true);
  assert.equal(run(csrfGuard, req('POST', { host: 'x.com', origin: 'https://x.com' })).called, true);
  assert.equal(run(csrfGuard, req('POST', { host: 'x.com' })).called, true);
  const cross = run(csrfGuard, req('POST', { host: 'x.com', origin: 'https://evil.com' }));
  assert.equal(cross.res.code, 403);
  assert.equal(run(csrfGuard, req('POST', { host: 'x.com', origin: 'garbage' })).res.code, 403);
  assert.equal(run(csrfGuard, req('POST', { host: 'x.com' }, false)).res.code, 415);
});

test('requireRole: 401 when signed out, 403 for the wrong role, passes for the right one', () => {
  const guard = requireRole('admin');
  assert.equal(run(guard, { user: null }).res.code, 401);
  assert.equal(run(guard, { user: { role: 'member' } }).res.code, 403);
  assert.equal(run(guard, { user: { role: 'admin' } }).called, true);
});
