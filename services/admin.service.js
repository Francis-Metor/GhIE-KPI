const mongoose = require('mongoose');
const { User, AuditLog } = require('../models');
const { HttpError } = require('../lib/http');
const { hashSecret } = require('../lib/auth/password');
const { cleanEmail } = require('./auth.service');

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkReference(reference) {
  const ref = String(reference || '').trim();
  if (ref.length < 6 || ref.length > 64) throw new HttpError(400, 'The reference number must be 6 to 64 characters.');
  return ref;
}

const audit = (actor, action, target, summary) =>
  AuditLog.create({ actor: actor?._id, actorRole: actor ? 'admin' : 'system', action, targetType: 'User', targetId: target._id, summary });

async function findAdmin(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Administrator not found.');
  const user = await User.findOne({ _id: id, role: 'admin' });
  if (!user) throw new HttpError(404, 'Administrator not found.');
  return user;
}

const listAdmins = () =>
  User.find({ role: 'admin' }).sort({ createdAt: 1 }).select('email displayName status lastLoginAt createdAt').lean();

async function createAdmin({ email, displayName, reference }, actor) {
  const e = cleanEmail(email);
  if (!EMAIL_RX.test(e)) throw new HttpError(400, 'Enter a valid email address.');
  const ref = checkReference(reference);
  if (await User.exists({ email: e, role: 'admin' })) throw new HttpError(409, 'An administrator with this email already exists.');

  const user = await User.create({ email: e, displayName: String(displayName || '').trim() || e, role: 'admin', passwordHash: await hashSecret(ref) });
  await audit(actor, 'admin.create', user, `Administrator ${e} created`);
  return user;
}

async function setAdminStatus(id, status, actor) {
  if (!['active', 'disabled'].includes(status)) throw new HttpError(400, 'Status must be active or disabled.');
  const user = await findAdmin(id);
  if (actor && String(actor._id) === String(user._id)) throw new HttpError(400, 'You cannot change your own access.');
  user.status = status;
  await user.save();
  await audit(actor, status === 'disabled' ? 'admin.disable' : 'admin.enable', user, `Administrator ${user.email} ${status}`);
  return user;
}

async function resetReference(id, reference, actor) {
  const ref = checkReference(reference);
  const user = await findAdmin(id);
  user.passwordHash = await hashSecret(ref);
  user.failedLoginCount = 0;
  await user.save();
  await audit(actor, 'admin.reset_reference', user, `Reference number reset for ${user.email}`);
  return user;
}

module.exports = { listAdmins, createAdmin, setAdminStatus, resetReference };
