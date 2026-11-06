const mongoose = require('mongoose');
const { normalizeKey } = require('../lib/validation/normalize');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Category name is required.'], trim: true },
    nameKey: { type: String, required: true, unique: true }, // case-insensitive uniqueness
    description: { type: String, trim: true, default: '' },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'categories' }
);

categorySchema.index({ isActive: 1, displayOrder: 1 });
categorySchema.pre('validate', function () { if (this.name) this.nameKey = normalizeKey(this.name); });

module.exports = mongoose.models.Category || mongoose.model('Category', categorySchema);
