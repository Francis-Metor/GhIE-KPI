const { SystemSetting, AuditLog } = require('../models');
const { HttpError } = require('../lib/http');

const definitions = {
  attendanceRadiusMeters: { label: 'Default attendance radius (metres)', min: 10, max: 5000 },
  sessionExpiryMinutes: { label: 'Default QR session expiry (minutes)', min: 1, max: 1440 },
  attendanceGpsAccuracyMaxMeters: { label: 'Maximum GPS accuracy (metres)', min: 1, max: 1000 },
};

async function list() {
  const values = {};
  for (const key of Object.keys(definitions)) values[key] = await SystemSetting.get(key);
  return { values, definitions };
}

async function update(input, actor) {
  const changes = {};
  for (const [key, definition] of Object.entries(definitions)) {
    if (input[key] === undefined) continue;
    const value = Number(input[key]);
    if (!Number.isFinite(value) || value < definition.min || value > definition.max) {
      throw new HttpError(400, `${definition.label} must be between ${definition.min} and ${definition.max}.`);
    }
    changes[key] = value;
  }
  for (const [key, value] of Object.entries(changes)) {
    await SystemSetting.findOneAndUpdate(
      { key }, { $set: { value, updatedBy: actor._id, description: definitions[key].label } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  if (Object.keys(changes).length) {
    await AuditLog.create({
      actor: actor._id, actorRole: 'admin', action: 'settings.update', targetType: 'SystemSetting',
      summary: 'System settings updated', metadata: changes,
    });
  }
  return list();
}

module.exports = { list, update, definitions };
