const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;
const { normalizeKey } = require('../lib/validation/normalize');

const criterionSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Criterion name is required.'], trim: true },
    nameKey: { type: String, required: true },
    description: { type: String, trim: true, default: '' },
    category: { type: ObjectId, ref: 'Category', required: true },
    points: {
      type: Number,
      required: [true, 'Point value is required.'],
      validate: [(v) => Number.isFinite(v) && v > 0, 'Point value must be greater than 0. Use a reversal to remove points.'],
    },
    awardMethod: { type: String, enum: ['automatic', 'manual'], default: 'manual', required: true },
    isActive: { type: Boolean, default: true },
    // Optional cap on how many times one member can receive this criterion (null = unlimited).
    awardLimit: {
      type: Number,
      default: null,
      validate: [(v) => v === null || (Number.isInteger(v) && v >= 1), 'Award limit must be a whole number of 1 or more.'],
    },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'criteria' }
);

criterionSchema.index({ category: 1, nameKey: 1 }, { unique: true });
criterionSchema.index({ isActive: 1, awardMethod: 1 });
criterionSchema.pre('validate', function () { if (this.name) this.nameKey = normalizeKey(this.name); });

module.exports = mongoose.models.Criterion || mongoose.model('Criterion', criterionSchema);
