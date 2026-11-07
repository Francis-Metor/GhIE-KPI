const mongoose = require('mongoose');
const { Activity, Venue, Criterion, AuditLog, SystemSetting } = require('../models');
const { HttpError } = require('../lib/http');

const text = (value) => String(value ?? '').trim();

function dateValue(value, label, required = false) {
  if (value === '' || value === null || value === undefined) {
    if (required) throw new HttpError(400, `${label} is required.`);
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `${label} must be a valid date and time.`);
  return date;
}

function numberValue(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new HttpError(400, `${label} must be a number.`);
  return number;
}

async function findVenue(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Venue not found.');
  const venue = await Venue.findById(id);
  if (!venue) throw new HttpError(404, 'Venue not found.');
  return venue;
}

async function findActivity(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Activity not found.');
  const activity = await Activity.findById(id);
  if (!activity) throw new HttpError(404, 'Activity not found.');
  return activity;
}

async function findCriterion(id, label = 'Attendance criterion') {
  if (!id) return undefined;
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, `${label} is invalid.`);
  const criterion = await Criterion.findById(id);
  if (!criterion) throw new HttpError(400, `${label} was not found.`);
  if (criterion.awardMethod !== 'automatic') throw new HttpError(400, `${label} must use the automatic award method.`);
  return criterion;
}

async function listActivities() {
  const [venues, activities] = await Promise.all([
    Venue.find().sort({ isActive: -1, name: 1 }).lean(),
    Activity.find().populate('venue', 'name defaultRadiusMeters').populate('attendanceCriterion', 'name points').populate('punctualityCriterion', 'name points').sort({ startsAt: -1 }).lean(),
  ]);
  return { venues, activities };
}

async function createVenue(input, actor) {
  const defaultRadius = input.defaultRadiusMeters === '' || input.defaultRadiusMeters === undefined
    ? await SystemSetting.get('attendanceRadiusMeters') : numberValue(input.defaultRadiusMeters, 'Default radius');
  const venue = await Venue.create({
    name: text(input.name),
    address: text(input.address),
    latitude: numberValue(input.latitude, 'Latitude'),
    longitude: numberValue(input.longitude, 'Longitude'),
    defaultRadiusMeters: defaultRadius,
    isActive: input.isActive !== false,
  });
  await AuditLog.create({ actor: actor._id, actorRole: 'admin', action: 'venue.create', targetType: 'Venue', targetId: venue._id, summary: `Venue ${venue.name} created` });
  return venue;
}

async function updateVenue(id, input, actor) {
  const venue = await findVenue(id);
  if (input.name !== undefined) venue.name = text(input.name);
  if (input.address !== undefined) venue.address = text(input.address);
  if (input.latitude !== undefined) venue.latitude = numberValue(input.latitude, 'Latitude');
  if (input.longitude !== undefined) venue.longitude = numberValue(input.longitude, 'Longitude');
  if (input.defaultRadiusMeters !== undefined) venue.defaultRadiusMeters = numberValue(input.defaultRadiusMeters, 'Default radius');
  if (input.isActive !== undefined) venue.isActive = Boolean(input.isActive);
  await venue.save();
  await AuditLog.create({ actor: actor._id, actorRole: 'admin', action: 'venue.update', targetType: 'Venue', targetId: venue._id, summary: `Venue ${venue.name} updated` });
  return venue;
}

function activityValues(input, createdBy) {
  if (input.punctualityCriterion && input.attendanceCriterion
    && String(input.punctualityCriterion) === String(input.attendanceCriterion)) {
    throw new HttpError(400, 'Punctuality criterion must be different from the attendance criterion.');
  }
  const values = {
    title: text(input.title),
    description: text(input.description),
    type: input.type || 'meeting',
    startsAt: dateValue(input.startsAt, 'Start time', true),
    endsAt: dateValue(input.endsAt, 'End time'),
    venue: input.venue,
    radiusOverrideMeters: input.radiusOverrideMeters === '' || input.radiusOverrideMeters === undefined ? null : numberValue(input.radiusOverrideMeters, 'Activity radius'),
    attendanceCriterion: input.attendanceCriterion || undefined,
    punctualityCriterion: input.punctualityCriterion || undefined,
    punctualityWindowMinutes: input.punctualityCriterion
      ? numberValue(input.punctualityWindowMinutes, 'Punctuality time limit')
      : null,
    attendanceWindow: {
      opensAt: dateValue(input.attendanceOpensAt ?? input.attendanceWindow?.opensAt, 'Attendance opening time'),
      closesAt: dateValue(input.attendanceClosesAt ?? input.attendanceWindow?.closesAt, 'Attendance closing time'),
    },
    status: input.status || 'scheduled',
  };
  if (createdBy) values.createdBy = createdBy;
  return values;
}

async function createActivity(input, actor) {
  await findVenue(input.venue);
  await findCriterion(input.attendanceCriterion);
  await findCriterion(input.punctualityCriterion, 'Punctuality criterion');
  const activity = await Activity.create(activityValues(input, actor._id));
  await AuditLog.create({ actor: actor._id, actorRole: 'admin', action: 'activity.create', targetType: 'Activity', targetId: activity._id, summary: `Activity ${activity.title} created` });
  return activity;
}

async function updateActivity(id, input, actor) {
  const activity = await findActivity(id);
  const values = activityValues({ ...activity.toObject(), ...input }, activity.createdBy);
  await findVenue(values.venue);
  await findCriterion(values.attendanceCriterion);
  await findCriterion(values.punctualityCriterion, 'Punctuality criterion');
  Object.assign(activity, values);
  await activity.save();
  await AuditLog.create({ actor: actor._id, actorRole: 'admin', action: 'activity.update', targetType: 'Activity', targetId: activity._id, summary: `Activity ${activity.title} updated` });
  return activity;
}

module.exports = { listActivities, createVenue, updateVenue, createActivity, updateActivity };
