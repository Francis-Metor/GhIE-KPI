const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

// One row per submission attempt outcome. Rejected attempts are kept for audit, so a member whose first
// try failed (e.g. out of range) can still succeed later. Only ONE accepted record per member and session
// is allowed, enforced by the partial unique index below.
const recordSchema = new mongoose.Schema(
  {
    member: { type: ObjectId, ref: 'Member', required: true },
    session: { type: ObjectId, ref: 'AttendanceSession', required: true },
    activity: { type: ObjectId, ref: 'Activity', required: true },
    result: { type: String, enum: ['accepted', 'rejected'], required: true },
    rejectionReason: { type: String, trim: true },
    submittedAt: { type: Date, default: Date.now },
    // Location evidence. Retention period is still to be decided (docs/DECISIONS.md).
    location: { _id: false, type: new mongoose.Schema({ latitude: Number, longitude: Number, accuracyMeters: Number }, { _id: false }) },
    distanceMeters: Number,
    allowedRadiusMeters: Number,
    pointTransaction: { type: ObjectId, ref: 'PointTransaction' },
  },
  { timestamps: true, collection: 'attendanceRecords' }
);

recordSchema.index(
  { member: 1, session: 1 },
  { unique: true, partialFilterExpression: { result: 'accepted' } }
);
recordSchema.index({ session: 1, result: 1 });
recordSchema.index({ activity: 1 });
recordSchema.index({ member: 1, submittedAt: -1 });

recordSchema.pre('validate', function () {
  if (this.result === 'rejected' && !this.rejectionReason) this.invalidate('rejectionReason', 'A rejection reason is required.');
  if (this.result === 'accepted' && this.rejectionReason) this.invalidate('rejectionReason', 'Accepted records cannot have a rejection reason.');
});

module.exports = mongoose.models.AttendanceRecord || mongoose.model('AttendanceRecord', recordSchema);
