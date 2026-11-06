const mongoose = require('mongoose');
const QRCode = require('qrcode');
const { Activity, AttendanceSession, AuditLog, SystemSetting } = require('../models');
const { HttpError } = require('../lib/http');
const { APP_URL } = require('../lib/config/env');

const SESSION_MINUTES = 180;

async function findActivity(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Activity not found.');
  const activity = await Activity.findById(id).populate('venue', 'name');
  if (!activity) throw new HttpError(404, 'Activity not found.');
  if (activity.status === 'cancelled') throw new HttpError(400, 'A QR session cannot be created for a cancelled activity.');
  return activity;
}

function parseDate(value, label) {
  if (value === undefined || value === null || value === '') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `${label} must be a valid date and time.`);
  return date;
}

function tokenPayload(token, baseUrl = APP_URL || 'http://localhost:3000') {
  // The QR payload is deliberately only an opaque token. It contains no member or account data.
  return `${baseUrl}/attendance/scan.html?token=${encodeURIComponent(token)}`;
}

async function listSessions() {
  return AttendanceSession.find()
    .populate('activity', 'title startsAt status')
    .populate('venue', 'name')
    .sort({ createdAt: -1 })
    .lean();
}

async function createSession({ activityId, startsAt: requestedStart, expiresAt: requestedExpiry, baseUrl }, actor) {
  const activity = await findActivity(activityId);
  const startsAt = parseDate(requestedStart, 'Start time') || activity.attendanceWindow?.opensAt || activity.startsAt;
  const expiryMinutes = Number(await SystemSetting.get('sessionExpiryMinutes')) || SESSION_MINUTES;
  const expiresAt = parseDate(requestedExpiry, 'Expiry time') || activity.attendanceWindow?.closesAt || new Date(startsAt.getTime() + expiryMinutes * 60 * 1000);
  if (expiresAt <= startsAt) throw new HttpError(400, 'Expiry time must be after the start time.');
  const { token, tokenHash } = AttendanceSession.generateToken();
  const session = await AttendanceSession.create({
    tokenHash,
    activity: activity._id,
    venue: activity.venue._id || activity.venue,
    startsAt,
    expiresAt,
    createdBy: actor._id,
  });
  const qrPayload = tokenPayload(token, baseUrl);
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { errorCorrectionLevel: 'M', margin: 2, width: 360 });
  await AuditLog.create({
    actor: actor._id, actorRole: 'admin', action: 'session.create', targetType: 'AttendanceSession', targetId: session._id,
    summary: `QR session created for ${activity.title}`, metadata: { activity: activity._id, expiresAt },
  });
  return {
    session: { ...session.toObject(), activity: { _id: activity._id, title: activity.title }, venue: activity.venue },
    token,
    qrPayload,
    qrDataUrl,
  };
}

async function revokeSession(id, actor) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'QR session not found.');
  const session = await AttendanceSession.findById(id);
  if (!session) throw new HttpError(404, 'QR session not found.');
  if (session.status === 'revoked') return session;
  session.status = 'revoked';
  session.revokedAt = new Date();
  session.revokedBy = actor._id;
  await session.save();
  await AuditLog.create({
    actor: actor._id, actorRole: 'admin', action: 'session.revoke', targetType: 'AttendanceSession', targetId: session._id,
    summary: 'QR session revoked',
  });
  return session;
}

async function validateToken(rawToken) {
  const token = String(rawToken || '').trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new HttpError(404, 'QR token not found or no longer valid.');
  const session = await AttendanceSession.findOne({ tokenHash: AttendanceSession.hashToken(token) })
    .populate('activity', 'title startsAt endsAt status')
    .populate('venue', 'name latitude longitude defaultRadiusMeters')
    .lean();
  const now = new Date();
  if (!session || session.status !== 'active' || new Date(session.startsAt) > now || new Date(session.expiresAt) <= now) {
    throw new HttpError(410, 'This QR session has expired, been revoked, or has not started yet.');
  }
  return {
    valid: true,
    sessionId: session._id,
    activity: session.activity,
    venue: session.venue,
    startsAt: session.startsAt,
    expiresAt: session.expiresAt,
  };
}

module.exports = { SESSION_MINUTES, listSessions, createSession, revokeSession, validateToken, tokenPayload };
