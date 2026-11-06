const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

// Sign-in accounts.
//  - admin:  email + reference number; the reference is stored only as a hash in `passwordHash`.
//  - member: email + reference number checked against the members collection (the Excel data).
//            The account row is created on first sign-in and links to the member record.
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    displayName: { type: String, trim: true },
    passwordHash: { type: String, select: false }, // never returned by default; never log
    role: { type: String, enum: ['admin', 'member'], required: true },
    member: { type: ObjectId, ref: 'Member' }, // required for member accounts
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    mustChangePassword: { type: Boolean, default: false },
    lastLoginAt: Date,
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: Date,
  },
  { timestamps: true, collection: 'users' }
);

// Admin emails are unique. Members may share an email address (for example family members).
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { role: 'admin' } });
// One account per member.
userSchema.index({ member: 1 }, { unique: true, partialFilterExpression: { member: { $type: 'objectId' } } });

userSchema.pre('validate', function () {
  if (this.role === 'member' && !this.member) {
    this.invalidate('member', 'Member accounts must be linked to a member record.');
  }
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
