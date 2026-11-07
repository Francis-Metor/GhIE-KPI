const mongoose = require('mongoose');
const { Activity, AttendanceRecord, AttendanceSession, PointTransaction, SystemSetting } = require('../models');
const { runInTransaction } = require('../lib/db/withTransaction');
const { HttpError } = require('../lib/http');

const EARTH_RADIUS_METERS = 6371000;

function distanceMeters(a, b) {
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

function locationValue(location) {
  const value = location || {};
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  const accuracyMeters = Number(value.accuracyMeters);
  if (![latitude, longitude, accuracyMeters].every(Number.isFinite) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || accuracyMeters < 0) {
    throw new HttpError(400, 'A valid GPS location and accuracy are required.');
  }
  return { latitude, longitude, accuracyMeters };
}

async function findSession(rawToken) {
  const token = String(rawToken || '').trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new HttpError(400, 'The attendance token is invalid.');
  const session = await AttendanceSession.findOne({ tokenHash: AttendanceSession.hashToken(token) })
    .populate({ path: 'activity', populate: [{ path: 'venue' }, { path: 'attendanceCriterion', populate: { path: 'category' } }] });
  if (!session) throw new HttpError(410, 'This attendance session is no longer valid.');
  const now = new Date();
  if (!session.isUsableAt(now)) throw new HttpError(410, 'This attendance session is expired, revoked, or has not started.');
  return session;
}

async function submitAttendance({ token, location, memberId }) {
  const session = await findSession(token);
  const gps = locationValue(location);
  const maxAccuracy = Number(await SystemSetting.get('attendanceGpsAccuracyMaxMeters'));
  if (gps.accuracyMeters > maxAccuracy) throw new HttpError(422, `GPS accuracy must be ${maxAccuracy} m or better.`);
  const activity = session.activity;
  const venue = activity.venue;
  if (!venue || !Number.isFinite(venue.latitude) || !Number.isFinite(venue.longitude)) {
    throw new HttpError(500, 'The activity venue is not configured with valid coordinates.');
  }
  const allowedRadiusMeters = activity.radiusOverrideMeters ?? venue.defaultRadiusMeters ?? 500;
  const distance = Math.round(distanceMeters(gps, venue) * 100) / 100;
  const rejected = (reason) => AttendanceRecord.create({
    member: memberId, session: session._id, activity: activity._id, result: 'rejected',
    rejectionReason: reason, location: gps, distanceMeters: distance, allowedRadiusMeters,
  }).then(() => { throw new HttpError(422, reason); });
  if (distance > allowedRadiusMeters) return rejected(`You are outside the attendance radius (${Math.round(distance)} m away; ${allowedRadiusMeters} m allowed).`);
  const criterion = activity.attendanceCriterion;
  if (!criterion || criterion.awardMethod !== 'automatic' || !criterion.category) throw new HttpError(409, 'This activity has no valid automatic attendance criterion.');
  const punctuality = activity.punctualityCriterion;
  const punctualityCutoff = punctuality && activity.punctualityWindowMinutes
    ? new Date(new Date(activity.startsAt).getTime() + activity.punctualityWindowMinutes * 60 * 1000)
    : null;

  try {
    return await runInTransaction(async (dbSession) => {
      const existing = await AttendanceRecord.findOne({ member: memberId, session: session._id, result: 'accepted' }).lean().session(dbSession);
      if (existing) return { accepted: true, duplicate: true, attendanceRecordId: existing._id, points: criterion.points };
      const record = new AttendanceRecord({
        member: memberId, session: session._id, activity: activity._id, result: 'accepted',
        location: gps, distanceMeters: distance, allowedRadiusMeters,
      });
      await record.save({ session: dbSession || undefined });
      const transaction = new PointTransaction({
        member: memberId, points: criterion.points, kind: 'award', source: 'attendance',
        criterionSnapshot: PointTransaction.snapshotFor(criterion, criterion.category),
        activity: activity._id, attendanceRecord: record._id,
      });
      await transaction.save({ session: dbSession || undefined });
      let punctualityTransaction;
      if (punctuality && punctuality.awardMethod === 'automatic' && punctuality.category && punctualityCutoff && new Date() <= punctualityCutoff) {
        punctualityTransaction = new PointTransaction({
          member: memberId, points: punctuality.points, kind: 'award', source: 'attendance',
          criterionSnapshot: PointTransaction.snapshotFor(punctuality, punctuality.category),
          activity: activity._id, attendanceRecord: record._id,
        });
        await punctualityTransaction.save({ session: dbSession || undefined });
      }
      record.pointTransaction = transaction._id;
      await record.save({ session: dbSession || undefined });
      return {
        accepted: true, duplicate: false, attendanceRecordId: record._id, pointTransactionId: transaction._id,
        punctualityAwarded: Boolean(punctualityTransaction), points: transaction.points + (punctualityTransaction?.points || 0),
      };
    });
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await AttendanceRecord.findOne({ member: memberId, session: session._id, result: 'accepted' }).lean();
      if (existing) return { accepted: true, duplicate: true, attendanceRecordId: existing._id, points: criterion.points };
    }
    throw error;
  }
}

module.exports = { EARTH_RADIUS_METERS, distanceMeters, submitAttendance };
