// Sessions are signed tokens in an HttpOnly cookie. The user is re-loaded from the database on every
// request (see middleware/auth.js), so disabling an account takes effect immediately.
const jwt = require('jsonwebtoken');
const { SESSION_SECRET, SESSION_HOURS, isProduction } = require('../config/env');

const COOKIE_NAME = 'cp_session';

function secret() {
 if (SESSION_SECRET.length >= 32) return SESSION_SECRET;
 throw new Error('SESSION_SECRET must be set to a random value of at least 32 characters.');
}

const signSession = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role }, secret(), { algorithm: 'HS256', expiresIn: `${SESSION_HOURS}h` });

function verifySession(token) {
  try { return jwt.verify(token, secret(), { algorithms: ['HS256'] }); } catch { return null; }
}

function readSessionCookie(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === COOKIE_NAME) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

// Lax (not Strict) so the cookie is still sent when a member opens the attendance link from a QR scanner.
const cookieOptions = () => ({ httpOnly: true, sameSite: 'lax', secure: isProduction, path: '/' });

const setSessionCookie = (res, token) => res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: SESSION_HOURS * 3600 * 1000 });
const clearSessionCookie = (res) => res.clearCookie(COOKIE_NAME, cookieOptions());

module.exports = { COOKIE_NAME, signSession, verifySession, readSessionCookie, setSessionCookie, clearSessionCookie };
