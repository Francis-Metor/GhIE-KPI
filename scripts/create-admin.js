// Creates the first administrator (or resets an existing one's reference number).
//   npm run admin:create -- --email you@example.com --reference 123456 --name "Your Name"
//   add --update to reset the reference number of an existing administrator
const { connectDB, disconnectDB } = require('../lib/db/connect');
const { User } = require('../models');
const adminService = require('../services/admin.service');
const { cleanEmail } = require('../services/auth.service');

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; };

(async () => {
  const email = cleanEmail(arg('email'));
  const reference = arg('reference');
  if (!email || !reference) throw new Error('Usage: npm run admin:create -- --email <email> --reference <reference> [--name "Full Name"] [--update]');

  await connectDB();
  const existing = await User.findOne({ email, role: 'admin' });
  if (existing) {
    if (!process.argv.includes('--update')) throw new Error(`An administrator with ${email} already exists. Add --update to reset the reference number.`);
    await adminService.resetReference(existing.id, reference, null);
    console.log(`Reference number reset for ${email}.`);
  } else {
    await adminService.createAdmin({ email, displayName: arg('name'), reference }, null);
    console.log(`Administrator ${email} created.`);
  }
  await disconnectDB();
})().catch((err) => { console.error(err.message); process.exit(1); });
