const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;
const { RADIUS_LIMITS } = require('./Venue');

const activitySchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Activity title is required.'], trim: true },
    description: { type: String, trim: true, default: '' },
    type: { type: String, enum: ['meeting', 'event', 'course', 'training', 'other'], default: 'meeting' },
    startsAt: { type: Date, required: true },
    endsAt: Date,
    venue: { type: ObjectId, ref: 'Venue', required: true },
    // Overrides the venue's default radius for this activity only.
    radiusOverrideMeters: {
      type: Number,
      default: null,
      validate: [(v) => v === null || (v >= RADIUS_LIMITS.min && v <= RADIUS_LIMITS.max), `Radius must be between ${RADIUS_LIMITS.min} and ${RADIUS_LIMITS.max} m.`],
    },
    attendanceCriterion: { type: ObjectId, ref: 'Criterion' }, // the automatic criterion awarded for attending
    attendanceWindow: { opensAt: Date, closesAt: Date },
    status: { type: String, enum: ['draft', 'scheduled', 'completed', 'cancelled'], default: 'scheduled' },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'activities' }
);

activitySchema.index({ startsAt: -1 });
activitySchema.index({ status: 1, startsAt: -1 });
activitySchema.index({ venue: 1 });

activitySchema.pre('validate', function () {
  if (this.endsAt && this.endsAt < this.startsAt) this.invalidate('endsAt', 'End time must not be before the start time.');
  const w = this.attendanceWindow;
  if (w?.opensAt && w?.closesAt && w.closesAt <= w.opensAt) this.invalidate('attendanceWindow.closesAt', 'Attendance window must close after it opens.');
});

/** Radius to enforce: activity override, else the venue's default. `venue` must be the loaded Venue document. */
activitySchema.methods.effectiveRadius = function (venue) {
  return this.radiusOverrideMeters ?? venue?.defaultRadiusMeters ?? 500;
};

module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
