// DEVELOPMENT ONLY. Creates clearly labelled test data (member IDs start with DEV-).
//   npm run seed:dev     add the fixtures (safe to run repeatedly)
//   npm run seed:reset   DROP THE WHOLE DATABASE, then seed again
const { connectDB, disconnectDB } = require('../lib/db/connect');
const mongoose = require('mongoose');
const { isProduction } = require('../lib/config/env');
const M = require('../models');

async function ensure(Model, filter, data) {
  return (await Model.findOne(filter)) || Model.create(data);
}

(async () => {
  if (isProduction) throw new Error('Refusing to seed: NODE_ENV is production.');
  await connectDB();
  if (process.argv.includes('--reset')) {
    if (!process.argv.includes('--confirm')) throw new Error('--reset drops the whole database. Add --confirm to proceed.');
    await mongoose.connection.dropDatabase();
    console.log('Database dropped.');
  }
  await Promise.all(M.all.map((Model) => Model.init()));

  const admin = await ensure(M.User, { email: 'dev-admin@clubpoint.local' }, {
    email: 'dev-admin@clubpoint.local', displayName: 'DEV Admin (cannot log in)', role: 'admin', status: 'disabled',
  });

  const cat = {};
  for (const [i, name] of ['Attendance', 'Participation', 'Leadership', 'Volunteering'].entries()) {
    cat[name] = await ensure(M.Category, { nameKey: name.toLowerCase() }, { name, displayOrder: i });
  }
  const crit = {};
  const defs = [
    ['Meeting attendance', 'Attendance', 5, 'automatic'],
    ['Punctual arrival', 'Attendance', 2, 'manual'],
    ['Active participation', 'Participation', 5, 'manual'],
    ['Key contribution', 'Leadership', 10, 'manual'],
    ['Most assistive', 'Volunteering', 10, 'manual'],
  ];
  for (const [name, category, points, awardMethod] of defs) {
    crit[name] = await ensure(M.Criterion, { category: cat[category]._id, nameKey: name.toLowerCase() },
      { name, category: cat[category]._id, points, awardMethod, createdBy: admin._id });
  }

  const venue = await ensure(M.Venue, { name: 'DEV placeholder venue' },
    { name: 'DEV placeholder venue', address: 'Replace with a real venue', latitude: 0, longitude: 0 });
  const start = new Date(Date.now() + 24 * 3600 * 1000);
  await ensure(M.Activity, { title: 'DEV General Meeting' }, {
    title: 'DEV General Meeting', startsAt: start, venue: venue._id, attendanceCriterion: crit['Meeting attendance']._id,
    attendanceWindow: { opensAt: new Date(start - 30 * 60000), closesAt: new Date(+start + 2 * 3600000) }, createdBy: admin._id,
  });

  const people = [['DEV-001', 'Ama Mensah', 'Computer Engineering'], ['DEV-002', 'Kofi Boateng', 'Petroleum Engineering'],
    ['DEV-003', 'Esi Owusu', 'Data Science'], ['DEV-004', 'Yaw Darko', 'Electrical Engineering']];
  // Dev sign-in: email dev001@clubpoint.local ... dev004@clubpoint.local with reference DEV-001 ... DEV-004
  const members = [];
  for (const [memberId, fullName, department] of people) {
    members.push(await ensure(M.Member, { memberIdNormalized: memberId }, { memberId, fullName, department, email: `${memberId.toLowerCase().replace('-', '')}@clubpoint.local` }));
  }

  if (!(await M.PointTransaction.countDocuments({ batchId: 'dev-seed' }))) {
    const snap = (c) => ({ criterion: c._id, criterionName: c.name, category: c.category, categoryName: Object.values(cat).find((x) => x.id === String(c.category)).name, awardMethod: c.awardMethod, points: c.points });
    const awards = [[0, 'Key contribution'], [0, 'Active participation'], [1, 'Most assistive'], [2, 'Punctual arrival'], [2, 'Key contribution']];
    for (const [who, name] of awards) {
      await M.PointTransaction.create({ member: members[who]._id, points: crit[name].points, source: 'manual', criterionSnapshot: snap(crit[name]), reason: 'DEV seed data', awardedBy: admin._id, batchId: 'dev-seed' });
    }
  }
  await M.PublicationSetting.getLeaderboard();

  console.log('Seed complete. Totals from the ledger:');
  const totals = await M.PointTransaction.totalsByMember({});
  for (const t of totals.sort((a, b) => b.totalPoints - a.totalPoints)) {
    console.log(`  ${members.find((m) => m.id === String(t._id)).fullName}: ${t.totalPoints} points`);
  }
  await disconnectDB();
})().catch((err) => { console.error('Seed failed:', err.message); process.exit(1); });
