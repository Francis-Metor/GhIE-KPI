const db = require('../lib/db/connect');
const User = require('../models/User');
const { readSessionCookie, verifySession } = require('../lib/auth/session');

// Sets req.user from the session cookie, or null. The account is re-checked in the database each time,
// so a disabled admin or deactivated member loses access straight away.
async function attachUser(req, res, next) {
  try {
    req.user = null;
    const payload = verifySession(readSessionCookie(req));
    if (payload) {
      await db.connectDB();
      const user = await User.findById(payload.sub).populate('member', 'status memberType');
      const memberOk = user?.role !== 'member' || user.member?.status === 'active';
      if (user && user.status === 'active' && user.role === payload.role && memberOk) req.user = user;
    }
    next();
  } catch (err) { next(err); }
}

const requireAuth = (req, res, next) =>
  req.user ? next() : res.status(401).json({ error: 'Please sign in.' });

// Role checks happen here on the server for every protected route. Hidden buttons are not security.
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Please sign in.' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have access to this.' });
  next();
};

module.exports = { attachUser, requireAuth, requireRole };
