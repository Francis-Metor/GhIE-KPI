const crypto = require('crypto');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

// Only the hash of the QR token is stored. The raw token exists once, when the session is created,
// and is what the QR code carries.
const sessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    activity: { type: ObjectId, ref: 'Activity', required: true },
    venue: { type: ObjectId, ref: 'Venue', required: true },
    startsAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    revokedAt: Date,
    revokedBy: { type: ObjectId, ref: 'User' },
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'attendanceSessions' }
);

sessionSchema.index({ activity: 1, status: 1 });
sessionSchema.index({ expiresAt: 1 });

sessionSchema.pre('validate', function () {
  if (this.expiresAt && this.startsAt && this.expiresAt <= this.startsAt) this.invalidate('expiresAt', 'Expiry must be after the start time.');
});

sessionSchema.statics.hashToken = (rawToken) => crypto.createHash('sha256').update(String(rawToken)).digest('hex');

/** 256 bits of randomness, URL-safe. Show `token` once; save only `tokenHash`. */
sessionSchema.statics.generateToken = function () {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: this.hashToken(token) };
};

/** True only while active, started and not yet expired. Expiry is evaluated by time, never stored. */
sessionSchema.methods.isUsableAt = function (date = new Date()) {
  return this.status === 'active' && this.startsAt <= date && date < this.expiresAt;
};

module.exports = mongoose.models.AttendanceSession || mongoose.model('AttendanceSession', sessionSchema);
