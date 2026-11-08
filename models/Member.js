const mongoose = require('mongoose');
const { normalizeMemberId, normalizeName } = require('../lib/validation/normalize');

const emailOk = (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const urlOk = (v) => !v || /^https?:\/\/\S+$/i.test(v);

const memberSchema = new mongoose.Schema(
  {
    memberId: { type: String, required: [true, 'Member ID is required.'], trim: true },
    memberIdNormalized: { type: String, required: true, unique: true }, // the real unique identifier
    fullName: { type: String, required: [true, 'Full name is required.'], trim: true },
    fullNameNormalized: { type: String, required: true, index: true },
    department: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, validate: [emailOk, 'Email is not valid.'] },
    phone: { type: String, trim: true },
    profileImageUrl: { type: String, trim: true, validate: [urlOk, 'Profile image must be an http(s) URL.'] },
    memberType: { type: String, enum: ['executive', 'non-executive'], default: 'executive', index: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    deactivatedAt: Date,
  },
  { timestamps: true, collection: 'members' }
);

memberSchema.index({ department: 1, status: 1 });

// Runs on save()/create()/validate(). Updates made with updateOne/bulkWrite skip this hook,
// so build those payloads with Member.withNormalized().
memberSchema.pre('validate', function () {
  if (this.memberId) this.memberIdNormalized = normalizeMemberId(this.memberId);
  if (this.fullName) this.fullNameNormalized = normalizeName(this.fullName);
});

memberSchema.statics.withNormalized = (data) => ({
  ...data,
  memberIdNormalized: normalizeMemberId(data.memberId),
  fullNameNormalized: normalizeName(data.fullName),
});

memberSchema.statics.findByMemberId = function (memberId) {
  return this.findOne({ memberIdNormalized: normalizeMemberId(memberId) });
};

module.exports = mongoose.models.Member || mongoose.model('Member', memberSchema);
