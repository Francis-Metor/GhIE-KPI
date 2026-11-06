// Exercises the real Express app over HTTP. Database calls are stubbed, so no MongoDB is needed.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);

const db = require('../../lib/db/connect');
const { User } = require('../../models');
const { signSession } = require('../../lib/auth/session');
const app = require('../../server');

let server, base;
test.before(async () => {
  test.mock.method(db, 'connectDB', async () => mongoose);
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const call = (path, { method = 'GET', token, headers = {}, body } = {}) => fetch(base + path, {
  method,
  headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(token && { Cookie: `cp_session=${token}` }), ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});

// Pretend the database holds this user for findById(...).populate(...)
const stubUser = (user) => test.mock.method(User, 'findById', () => ({ populate: async () => user }));
const tokenFor = (role) => signSession({ _id: 'u1', role });

test('protected routes reject signed-out requests', async () => {
  for (const path of ['/api/member/me', '/api/member/portal', '/api/admin/admins', '/api/admin/analytics', '/api/admin/reports/attendance', '/api/admin/settings', '/api/auth/me']) {
    assert.equal((await call(path)).status, 401, path);
  }
});

test('a garbage or tampered cookie is treated as signed out', async () => {
  assert.equal((await call('/api/admin/admins', { token: 'not-a-token' })).status, 401);
  assert.equal((await call('/api/admin/admins', { token: tokenFor('admin').slice(0, -3) + 'abc' })).status, 401);
});

test('state-changing requests must be same-site JSON', async () => {
  const cross = await call('/api/auth/logout', { method: 'POST', body: {}, headers: { Origin: 'https://evil.example' } });
  assert.equal(cross.status, 403);
  const plain = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });
  assert.equal(plain.status, 415);
  const ok = await call('/api/auth/logout', { method: 'POST', body: {} });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('set-cookie') || '', /cp_session=;/);
});

test('a member cannot reach admin routes, and an admin cannot reach member routes', async () => {
  const member = { _id: 'u1', role: 'member', status: 'active', member: { _id: 'm1', status: 'active' } };
  stubUser(member);
  assert.equal((await call('/api/admin/admins', { token: tokenFor('member') })).status, 403);
  assert.equal((await call('/api/admin/admins', { method: 'POST', token: tokenFor('member'), body: { email: 'a@b.co', reference: '123456' } })).status, 403);
  test.mock.restoreAll(); test.mock.method(db, 'connectDB', async () => mongoose);
  stubUser({ _id: 'u1', role: 'admin', status: 'active' });
  assert.equal((await call('/api/member/me', { token: tokenFor('admin') })).status, 403);
  test.mock.restoreAll(); test.mock.method(db, 'connectDB', async () => mongoose);
});

test('disabled accounts and deactivated members lose access immediately', async () => {
  stubUser({ _id: 'u1', role: 'admin', status: 'disabled' });
  assert.equal((await call('/api/admin/admins', { token: tokenFor('admin') })).status, 401);
  test.mock.restoreAll(); test.mock.method(db, 'connectDB', async () => mongoose);
  stubUser({ _id: 'u1', role: 'member', status: 'active', member: { _id: 'm1', status: 'inactive' } });
  assert.equal((await call('/api/member/me', { token: tokenFor('member') })).status, 401);
  test.mock.restoreAll(); test.mock.method(db, 'connectDB', async () => mongoose);
});

test('an admin session can list administrators and never receives password hashes', async () => {
  stubUser({ _id: 'u1', role: 'admin', status: 'active' });
  test.mock.method(User, 'find', () => ({ sort: () => ({ select: () => ({ lean: async () => [{ _id: 'u1', email: 'a@b.co', displayName: 'A', status: 'active' }] }) }) }));
  const res = await call('/api/admin/admins', { token: tokenFor('admin') });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.admins.length, 1);
  assert.equal(body.currentUserId, 'u1');
  assert.ok(!JSON.stringify(body).includes('passwordHash'));
  test.mock.restoreAll();
});

test('unknown API routes return JSON 404', async () => {
  const res = await call('/api/nope');
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Not found.' });
});
