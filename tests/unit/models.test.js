const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
const M = require('../../models');

const oid = () => new mongoose.Types.ObjectId();
// validate() (not validateSync) is used so the pre-validate rules run, exactly as they do on save().
const paths = (doc) => doc.validate().then(() => [], (e) => Object.keys(e.errors || {}));
const bad = async (doc, p) => assert.ok((await paths(doc)).includes(p), `expected "${p}" to be invalid`);
const good = async (doc) => assert.deepEqual(await paths(doc), []);
const snapshot = { criterion: oid(), criterionName: 'Key contribution', category: oid(), categoryName: 'Leadership', awardMethod: 'manual', points: 10 };

test('all 14 collections use the expected names', async () => {
  assert.deepEqual(M.all.map((m) => m.collection.name).sort(), [
    'activities', 'attendanceRecords', 'attendanceSessions', 'auditLogs', 'categories', 'criteria',
    'importHistory', 'loginThrottles', 'members', 'pointTransactions', 'publicationSettings', 'systemSettings', 'users', 'venues']);
});

test('Member normalizes ID and name, and validates email', async () => {
  const m = new M.Member({ memberId: ' ab 12 ', fullName: 'Ama  Mensah', email: 'Ama@Example.com' });
  await good(m);
  assert.equal(m.memberIdNormalized, 'AB12');
  assert.equal(m.fullNameNormalized, 'ama mensah');
  assert.equal(m.email, 'ama@example.com');
  await bad(new M.Member({ memberId: '1', fullName: 'X', email: 'nope' }), 'email');
  await bad(new M.Member({ fullName: 'X' }), 'memberId');
});

test('Member accounts must link to a member record', async () => {
  await bad(new M.User({ email: 'a@b.co', role: 'member' }), 'member');
  await good(new M.User({ email: 'a@b.co', role: 'admin' }));
});

test('Venue defaults to 500 m and rejects bad coordinates or radius', async () => {
  assert.equal(new M.Venue({ name: 'Hall', latitude: 5, longitude: -0.2 }).defaultRadiusMeters, 500);
  await bad(new M.Venue({ name: 'Hall', latitude: 95, longitude: 0 }), 'latitude');
  await bad(new M.Venue({ name: 'Hall', latitude: 5, longitude: 200 }), 'longitude');
  await bad(new M.Venue({ name: 'Hall', latitude: 5, longitude: 0, defaultRadiusMeters: 5 }), 'defaultRadiusMeters');
});

test('Activity radius override beats venue default', async () => {
  const venue = new M.Venue({ name: 'Hall', latitude: 1, longitude: 1 });
  const base = { title: 'Meet', startsAt: new Date(), venue: venue._id };
  assert.equal(new M.Activity(base).effectiveRadius(venue), 500);
  assert.equal(new M.Activity({ ...base, radiusOverrideMeters: 200 }).effectiveRadius(venue), 200);
});

test('Venue and activity reject invalid radius and time windows', async () => {
  await bad(new M.Venue({ name: 'Bad', latitude: 1, longitude: 1, defaultRadiusMeters: 9 }), 'defaultRadiusMeters');
  await bad(new M.Venue({ name: 'Bad', latitude: 91, longitude: 1 }), 'latitude');
  const startsAt = new Date('2026-01-02T10:00:00Z');
  await bad(new M.Activity({
    title: 'Bad window', startsAt, endsAt: new Date('2026-01-02T09:00:00Z'), venue: oid(),
  }), 'endsAt');
  await bad(new M.Activity({
    title: 'Bad attendance window', startsAt, venue: oid(),
    attendanceWindow: { opensAt: new Date('2026-01-02T11:00:00Z'), closesAt: new Date('2026-01-02T10:00:00Z') },
  }), 'attendanceWindow.closesAt');
});

test('Criterion needs a positive point value', async () => {
  const base = { name: 'X', category: oid() };
  await bad(new M.Criterion({ ...base, points: 0 }), 'points');
  await bad(new M.Criterion({ ...base, points: -3 }), 'points');
  await good(new M.Criterion({ ...base, points: 5 }));
});

test('QR tokens are random, URL-safe and only the hash is derivable', async () => {
  const a = M.AttendanceSession.generateToken();
  const b = M.AttendanceSession.generateToken();
  assert.notEqual(a.token, b.token);
  assert.match(a.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(a.tokenHash, M.AttendanceSession.hashToken(a.token));
  assert.notEqual(a.tokenHash, a.token);
});

test('Session is usable only while active and inside its time window', async () => {
  const now = Date.now();
  const s = new M.AttendanceSession({ startsAt: new Date(now - 1000), expiresAt: new Date(now + 60000), status: 'active' });
  assert.equal(s.isUsableAt(new Date(now)), true);
  assert.equal(s.isUsableAt(new Date(now + 120000)), false);
  s.status = 'revoked';
  assert.equal(s.isUsableAt(new Date(now)), false);
});

test('Attendance records allow rejected retries but only one accepted record per member and session', () => {
  const indexes = M.AttendanceRecord.schema.indexes();
  const unique = indexes.find(([fields, options]) => fields.member === 1 && fields.session === 1);
  assert.equal(unique[1].unique, true);
  assert.deepEqual(unique[1].partialFilterExpression, { result: 'accepted' });
});

test('Attendance records require a rejection reason only when rejected', async () => {
  const base = { member: oid(), session: oid(), activity: oid() };
  await bad(new M.AttendanceRecord({ ...base, result: 'rejected' }), 'rejectionReason');
  await good(new M.AttendanceRecord({ ...base, result: 'accepted' }));
});

test('Point transaction rules', async () => {
  const base = { member: oid(), criterionSnapshot: snapshot };
  await bad(new M.PointTransaction({ ...base, points: 10, source: 'manual' }), 'reason');
  await good(new M.PointTransaction({ ...base, points: 10, source: 'manual', reason: 'Led the workshop', awardedBy: oid() }));
  await bad(new M.PointTransaction({ ...base, points: 0, source: 'manual', reason: 'x', awardedBy: oid() }), 'points');
  await bad(new M.PointTransaction({ ...base, points: -5, source: 'manual', reason: 'x', awardedBy: oid() }), 'points');
  await bad(new M.PointTransaction({ ...base, points: -10, kind: 'reversal', source: 'manual', reason: 'x', awardedBy: oid() }), 'reversalOf');
  await good(new M.PointTransaction({ ...base, points: -10, kind: 'reversal', reversalOf: oid(), source: 'manual', reason: 'Awarded in error', awardedBy: oid() }));
  await bad(new M.PointTransaction({ ...base, points: 5, source: 'attendance' }), 'attendanceRecord');
  await good(new M.PointTransaction({ ...base, points: 2, kind: 'correction', correctionOf: oid(), source: 'manual', reason: 'Corrected amount', awardedBy: oid() }));
  await bad(new M.PointTransaction({ ...base, points: 2, kind: 'correction', source: 'manual', reason: 'Missing link', awardedBy: oid() }), 'correctionOf');
});

test('point transaction snapshots copy criterion history at award time', () => {
  const criterion = { _id: oid(), name: 'Attendance', awardMethod: 'automatic', points: 5 };
  const category = { _id: oid(), name: 'Participation' };
  const snapshot = M.PointTransaction.snapshotFor(criterion, category);
  criterion.name = 'Edited attendance';
  criterion.points = 10;
  assert.equal(snapshot.criterionName, 'Attendance');
  assert.equal(snapshot.points, 5);
  assert.equal(snapshot.categoryName, 'Participation');
  assert.equal(snapshot.awardMethod, 'automatic');
});

test('Point ledger and audit log refuse updates and deletes', async () => {
  await assert.rejects(M.PointTransaction.updateOne({}, { points: 99 }).exec(), /append-only/);
  await assert.rejects(M.PointTransaction.deleteMany({}).exec(), /append-only/);
  await assert.rejects(M.AuditLog.findOneAndUpdate({}, { summary: 'x' }).exec(), /append-only/);
  const t = new M.PointTransaction({ member: oid(), points: 1, source: 'attendance', attendanceRecord: oid(), criterionSnapshot: snapshot });
  t.isNew = false;
  await assert.rejects(t.save(), /append-only/);
});

test('Leaderboard is public only when published or inside its schedule', async () => {
  const now = new Date();
  const mk = (o) => new M.PublicationSetting(o);
  assert.equal(mk({}).isPublicAt(now), false);
  assert.equal(mk({ visibility: 'published' }).isPublicAt(now), true);
  assert.equal(mk({ visibility: 'scheduled', publishAt: new Date(+now - 1000) }).isPublicAt(now), true);
  assert.equal(mk({ visibility: 'scheduled', publishAt: new Date(+now + 60000) }).isPublicAt(now), false);
  assert.equal(mk({ visibility: 'scheduled', publishAt: new Date(+now - 5000), unpublishAt: new Date(+now - 1000) }).isPublicAt(now), false);
  assert.ok((await paths(mk({ publicFields: ['fullName', 'email'] }))).some((p) => p.startsWith('publicFields')));
});

test('System settings fall back to the spec default radius', async () => {
  assert.equal(M.SystemSetting.DEFAULTS.attendanceRadiusMeters, 500);
});

test('Confirmed defaults: 3 hour QR expiry, 100 m GPS accuracy', () => {
  assert.equal(M.SystemSetting.DEFAULTS.sessionExpiryMinutes, 180);
  assert.equal(M.SystemSetting.DEFAULTS.attendanceGpsAccuracyMaxMeters, 100);
});
