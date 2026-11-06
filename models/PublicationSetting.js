const mongoose = require('mongoose');

const PUBLIC_FIELDS = ['fullName', 'memberId', 'department', 'profileImageUrl', 'totalPoints'];

// One document per published view. Today only the leaderboard exists.
const publicationSchema = new mongoose.Schema(
  {
    key: { type: String, enum: ['leaderboard'], default: 'leaderboard', unique: true },
    visibility: { type: String, enum: ['private', 'published', 'scheduled'], default: 'private' },
    publishAt: Date,
    unpublishAt: Date,
    // Only these fields may ever appear on the public leaderboard. Phone and email are never allowed.
    publicFields: { type: [{ type: String, enum: PUBLIC_FIELDS }], default: ['fullName', 'department', 'totalPoints'] },
    showCategoryRankings: { type: Boolean, default: false },
    tieHandling: { type: String, enum: ['competition', 'dense', 'none'], default: 'competition' }, // 1,2,2,4 / 1,2,2,3 / by name
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'publicationSettings' }
);

publicationSchema.pre('validate', function () {
  if (this.visibility === 'scheduled' && !this.publishAt) this.invalidate('publishAt', 'A scheduled leaderboard needs a publish time.');
  if (this.publishAt && this.unpublishAt && this.unpublishAt <= this.publishAt) this.invalidate('unpublishAt', 'Unpublish time must be after the publish time.');
});

/** The single check the leaderboard API must use before returning any data. */
publicationSchema.methods.isPublicAt = function (date = new Date()) {
  if (this.visibility === 'published') return true;
  if (this.visibility === 'scheduled') return this.publishAt <= date && (!this.unpublishAt || date < this.unpublishAt);
  return false;
};

publicationSchema.statics.getLeaderboard = function () {
  return this.findOneAndUpdate({ key: 'leaderboard' }, { $setOnInsert: { key: 'leaderboard' } }, { upsert: true, new: true, setDefaultsOnInsert: true });
};

const PublicationSetting = mongoose.models.PublicationSetting || mongoose.model('PublicationSetting', publicationSchema);
PublicationSetting.PUBLIC_FIELDS = PUBLIC_FIELDS;
module.exports = PublicationSetting;
