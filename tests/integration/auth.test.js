// Full sign-in flow against a REAL MongoDB. Skipped unless MONGODB_URI_TEST points at a throwaway database
// whose name contains "test", for example:  MONGODB_URI_TEST=mongodb://127.0.0.1:27017/clubpoint_test npm run test:integration
const test = require('node:test');
const assert = require('node:assert/strict');

const URI = process.env.MONGODB_URI_TEST;
const skip = !URI && 'Set MONGODB_URI_TEST to run the database integration tests.';

test('authentication flow (real database)', { skip }, async (t) => {
  if (!/\/[^/?]*test[^/?]*(\?|$)/i.test(URI)) throw new Error('MONGODB_URI_TEST must name a database containing "test".');
  process.env.MONGODB_URI = URI; // before the app loads
  const { connectDB, disconnectDB } = require('../../lib/db/connect');
  const { Member, User, LoginThrottle, AuditLog } = require('../../models');
  const adminService = require('../../services/admin.service');
  const app = require('../../server');

  await connectDB();
  const id = Date.now().toString(36);
  const email = (p) => `${p}${id}@example.com`;
  const REF = '9013422123';
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    server.close();
    await Member.deleteMany({ memberIdNormalized: new RegExp(`${id.toUpperCase()}$`) });
    await User.deleteMany({ email: new RegExp(id) });
    await LoginThrottle.deleteMany({});
    await AuditLog.collection.deleteMany({ summary: new RegExp(id) });
    await disconnectDB();
  });

  const send = async (path, { method = 'POST', body, cookie } = {}) => {
    const res = await fetch(base + path, {
      method, headers: { ...(method !== 'GET' && { 'Content-Type': 'application/json' }), ...(cookie && { Cookie: cookie }) },
      body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    });
    const set = res.headers.getSetCookie?.()[0];
    return { status: res.status, body: await res.json().catch(() => ({})), cookie: set && set.split(';')[0] };
  };

  const ada = await Member.create({ memberId: `A-${id}`, fullName: 'Ada Test', email: email('ada'), department: 'Testing' });
  const bob = await Member.create({ memberId: `B-${id}`, fullName: 'Bob Test', email: email('bob') });
  await Member.create({ memberId: `C-${id}`, fullName: 'Cleo Test', email: email('cleo'), status: 'inactive' });
  await adminService.createAdmin({ email: email('boss'), displayName: 'Boss', reference: REF }, null);

  let memberCookie, adminCookie, newAdminId;

  await t.test('member sign-in rejects wrong details with one generic message', async () => {
    const wrongRef = await send('/api/auth/member/login', { body: { email: email('ada'), reference: 'nope' } });
    const noEmail = await send('/api/auth/member/login', { body: { email: email('nobody'), reference: `A-${id}` } });
    assert.equal(wrongRef.status, 401);
    assert.equal(noEmail.status, 401);
    assert.equal(wrongRef.body.error, noEmail.body.error);
  });

  await t.test('inactive members cannot sign in', async () => {
    assert.equal((await send('/api/auth/member/login', { body: { email: email('cleo'), reference: `C-${id}` } })).status, 401);
  });

  await t.test('member signs in (case and spacing of the reference are ignored) and sees only their own record', async () => {
    const r = await send('/api/auth/member/login', { body: { email: email('ADA'), reference: ` a-${id.toLowerCase()} ` } });
    assert.equal(r.status, 200);
    assert.equal(r.body.redirect, '/member/index.html');
    memberCookie = r.cookie;
    const me = await send('/api/member/me', { method: 'GET', cookie: memberCookie });
    assert.equal(me.status, 200);
    assert.equal(me.body.member.fullName, 'Ada Test');
    assert.equal(me.body.member._id, String(ada._id));
    const portal = await send(`/api/member/portal?memberId=${bob._id}`, { method: 'GET', cookie: memberCookie });
    assert.equal(portal.status, 200);
    assert.equal(portal.body.member._id, String(ada._id));
    assert.notEqual(portal.body.member._id, String(bob._id), 'member portal must ignore another member identifier');
  });

  await t.test('a member cannot use admin routes', async () => {
    assert.equal((await send('/api/admin/admins', { method: 'GET', cookie: memberCookie })).status, 403);
  });

  await t.test('admin sign-in needs the right reference number', async () => {
    assert.equal((await send('/api/auth/admin/login', { body: { email: email('boss'), reference: 'wrong-ref' } })).status, 401);
    assert.equal((await send('/api/auth/admin/login', { body: { email: email('ada'), reference: `A-${id}` } })).status, 401); // a member is not an admin
    const r = await send('/api/auth/admin/login', { body: { email: email('boss'), reference: REF } });
    assert.equal(r.status, 200);
    assert.equal(r.body.redirect, '/admin/index.html');
    adminCookie = r.cookie;
  });

  await t.test('an admin cannot use member routes; the admin list never exposes hashes', async () => {
    assert.equal((await send('/api/member/me', { method: 'GET', cookie: adminCookie })).status, 403);
    const list = await send('/api/admin/admins', { method: 'GET', cookie: adminCookie });
    assert.equal(list.status, 200);
    assert.ok(!JSON.stringify(list.body).includes('passwordHash'));
  });

  await t.test('an admin can add another admin, who can then sign in', async () => {
    const add = await send('/api/admin/admins', { cookie: adminCookie, body: { email: email('second'), displayName: 'Second', reference: 'second-ref-1' } });
    assert.equal(add.status, 201);
    newAdminId = add.body.id;
    assert.equal((await send('/api/admin/admins', { cookie: adminCookie, body: { email: email('second'), reference: 'second-ref-1' } })).status, 409);
    assert.equal((await send('/api/admin/admins', { cookie: adminCookie, body: { email: email('short'), reference: '123' } })).status, 400);
    assert.equal((await send('/api/auth/admin/login', { body: { email: email('second'), reference: 'second-ref-1' } })).status, 200);
  });

  await t.test('disabling an admin ends their session at once; admins cannot disable themselves', async () => {
    const second = await send('/api/auth/admin/login', { body: { email: email('second'), reference: 'second-ref-1' } });
    assert.equal((await send('/api/admin/admins', { method: 'GET', cookie: second.cookie })).status, 200);
    const boss = await User.findOne({ email: email('boss') });
    assert.equal((await send(`/api/admin/admins/${boss.id}/status`, { method: 'PATCH', cookie: adminCookie, body: { status: 'disabled' } })).status, 400);
    assert.equal((await send(`/api/admin/admins/${newAdminId}/status`, { method: 'PATCH', cookie: adminCookie, body: { status: 'disabled' } })).status, 200);
    assert.equal((await send('/api/admin/admins', { method: 'GET', cookie: second.cookie })).status, 401);
    assert.equal((await send('/api/auth/admin/login', { body: { email: email('second'), reference: 'second-ref-1' } })).status, 401);
    await send(`/api/admin/admins/${newAdminId}/status`, { method: 'PATCH', cookie: adminCookie, body: { status: 'active' } });
    assert.equal((await send('/api/auth/admin/login', { body: { email: email('second'), reference: 'second-ref-1' } })).status, 200);
  });

  await t.test('resetting a reference number replaces the old one', async () => {
    assert.equal((await send(`/api/admin/admins/${newAdminId}/reference`, { method: 'PUT', cookie: adminCookie, body: { reference: 'brand-new-ref' } })).status, 200);
    assert.equal((await send('/api/auth/admin/login', { body: { email: email('second'), reference: 'second-ref-1' } })).status, 401);
    assert.equal((await send('/api/auth/admin/login', { body: { email: email('second'), reference: 'brand-new-ref' } })).status, 200);
  });

  await t.test('repeated failures are throttled', async () => {
    for (let i = 0; i < 5; i++) {
      assert.equal((await send('/api/auth/member/login', { body: { email: email('ghost'), reference: 'x' + i } })).status, 401);
    }
    assert.equal((await send('/api/auth/member/login', { body: { email: email('ghost'), reference: 'again' } })).status, 429);
  });
});
