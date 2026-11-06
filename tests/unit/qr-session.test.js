const test = require('node:test');
const assert = require('node:assert/strict');
const { HttpError } = require('../../lib/http');
const { AttendanceSession } = require('../../models');
const { tokenPayload, validateToken } = require('../../services/qr-session.service');
const { APP_URL } = require('../../lib/config/env');

test('QR payload contains only the opaque token', () => {
  const token = AttendanceSession.generateToken().token;
  const payload = tokenPayload(token);
  assert.equal(payload, `${APP_URL || 'http://localhost:3000'}/attendance/scan.html?token=${token}`);
  assert.ok(!payload.includes('member'));
  assert.ok(!payload.includes('email'));
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
});

test('malformed QR tokens are rejected before database lookup', async () => {
  await assert.rejects(
    () => validateToken('not-a-token'),
    (error) => error instanceof HttpError && error.status === 404,
  );
});

test('expired, revoked, and unknown tokens are rejected server-side', async (t) => {
  const token = AttendanceSession.generateToken().token;
  const base = {
    tokenHash: AttendanceSession.hashToken(token),
    startsAt: new Date(Date.now() - 60_000),
    expiresAt: new Date(Date.now() + 60_000),
    activity: { title: 'Meeting' },
    venue: { name: 'Hall' },
  };
  const stub = (session) => ({
    populate() { return this; },
    lean: async () => session,
  });

  t.mock.method(AttendanceSession, 'findOne', () => stub({ ...base, status: 'revoked' }));
  await assert.rejects(() => validateToken(token), (error) => error.status === 410);
  t.mock.restoreAll();

  t.mock.method(AttendanceSession, 'findOne', () => stub({ ...base, status: 'active', expiresAt: new Date(Date.now() - 1) }));
  await assert.rejects(() => validateToken(token), (error) => error.status === 410);
  t.mock.restoreAll();

  t.mock.method(AttendanceSession, 'findOne', () => stub(null));
  await assert.rejects(() => validateToken(token), (error) => error.status === 410);
  t.mock.restoreAll();
});
