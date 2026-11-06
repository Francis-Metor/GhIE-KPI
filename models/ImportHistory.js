const mongoose = require('mongoose');
const { ObjectId, Mixed } = mongoose.Schema.Types;

const importSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true, trim: true },
    fileSize: Number,
    sheetName: { type: String, trim: true },
    columnMapping: Mixed, // { memberId: 'Index No.', fullName: 'Name', ... }
    performedBy: { type: ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['previewed', 'completed', 'failed', 'cancelled'], default: 'previewed' },
    counts: {
      totalRows: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      sentForReview: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    // Row-level problems, used to build the downloadable error report.
    rowErrors: [{ _id: false, row: Number, field: String, value: String, message: String }],
    // Rows needing an administrator decision (duplicate IDs, ambiguous matches).
    conflicts: [{
      _id: false,
      row: Number,
      memberId: String,
      existingMember: { type: ObjectId, ref: 'Member' },
      reason: String,
      resolution: { type: String, enum: ['pending', 'update', 'skip', 'review'], default: 'pending' },
    }],
    completedAt: Date,
  },
  { timestamps: true, collection: 'importHistory' }
);

importSchema.index({ createdAt: -1 });
importSchema.index({ performedBy: 1, createdAt: -1 });

module.exports = mongoose.models.ImportHistory || mongoose.model('ImportHistory', importSchema);
