const mongoose = require('mongoose');

// Built-in defaults, used until an administrator saves a value. Rationale in docs/DECISIONS.md.
const DEFAULTS = {
  attendanceRadiusMeters: 500, // from the spec
  sessionExpiryMinutes: 180, // confirmed: 3 hours
  attendanceGpsAccuracyMaxMeters: 100, // confirmed
};

const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: mongoose.Schema.Types.Mixed,
    description: { type: String, trim: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'systemSettings' }
);

/** Stored value if present, otherwise the built-in default. */
settingSchema.statics.get = async function (key) {
  const doc = await this.findOne({ key }).lean();
  return doc ? doc.value : DEFAULTS[key];
};

const SystemSetting = mongoose.models.SystemSetting || mongoose.model('SystemSetting', settingSchema);
SystemSetting.DEFAULTS = DEFAULTS;
module.exports = SystemSetting;
