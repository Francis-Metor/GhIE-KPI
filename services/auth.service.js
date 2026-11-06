const { Member, User } = require('../models');
const { HttpError } = require('../lib/http');
const { normalizeMemberId } = require('../lib/validation/normalize');
const { verifySecret, verifyAgainstDummy } = require('../lib/auth/password');

const cleanEmail = (v) => String(v || '').trim().toLowerCase();
// One message for every kind of failure, so the form never reveals which emails exist.
const badLogin = () => new HttpError(401, 'Email or reference number is incorrect.');
const needBoth = () => new HttpError(400, 'Enter your email and reference number.');

/**
 * Member sign-in: the email and reference number must match one active row in the members collection
 * (the data imported from Excel). The member's account row is created on first sign-in.
 */
async function loginMember({ email, reference }) {
  const e = cleanEmail(email);
  const ref = normalizeMemberId(reference);
  if (!e || !ref) throw needBoth();

  const member = await Member.findOne({ email: e, memberIdNormalized: ref, status: 'active' });
  if (!member) throw badLogin();

  let user = await User.findOne({ member: member._id });
  if (user && user.status !== 'active') throw badLogin();
  if (!user) {
    try {
      user = await User.create({ email: e, displayName: member.fullName, role: 'member', member: member._id });
    } catch (err) {
      if (err.code !== 11000) throw err;
      user = await User.findOne({ member: member._id }); // created by a parallel request
    }
  }
  user.email = e;
  user.displayName = member.fullName;
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

/** Admin sign-in: email plus reference number, checked against the stored hash. */
async function loginAdmin({ email, reference }) {
  const e = cleanEmail(email);
  const ref = String(reference || '').trim();
  if (!e || !ref) throw needBoth();

  const user = await User.findOne({ email: e, role: 'admin' }).select('+passwordHash');
  if (!user || user.status !== 'active' || !user.passwordHash) {
    await verifyAgainstDummy(ref);
    throw badLogin();
  }
  if (!(await verifySecret(ref, user.passwordHash))) throw badLogin();

  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

module.exports = { loginMember, loginAdmin, cleanEmail };
