const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;
const appendOnly = require('../lib/db/appendOnly');

// Details of the criterion exactly as they were when the points were awarded.
// Editing the criterion later never changes past transactions.
const snapshotSchema = new mongoose.Schema(
  {
    criterion: { type: ObjectId, ref: 'Criterion', required: true },
    criterionName: { type: String, required: true },
    category: { type: ObjectId, ref: 'Category', required: true },
    categoryName: { type: String, required: true },
    awardMethod: { type: String, enum: ['automatic', 'manual'], required: true },
    points: { type: Number, required: true }, // the criterion's point value at that time
  },
  { _id: false }
);

const transactionSchema = new mongoose.Schema(
  {
    member: { type: ObjectId, ref: 'Member', required: true },
    points: { type: Number, required: true, validate: [(v) => Number.isFinite(v) && v !== 0, 'Points must be a non-zero number.'] },
    kind: { type: String, enum: ['award', 'reversal', 'correction'], default: 'award' },
    source: { type: String, enum: ['attendance', 'manual', 'bulk'], required: true },
    criterionSnapshot: { type: snapshotSchema, required: true },
    reason: { type: String, trim: true, maxlength: 500 },
    activity: { type: ObjectId, ref: 'Activity' },
    attendanceRecord: { type: ObjectId, ref: 'AttendanceRecord' },
    reversalOf: { type: ObjectId, ref: 'PointTransaction' }, // links a reversal to the original
    correctionOf: { type: ObjectId, ref: 'PointTransaction' }, // links a correction to the original
    awardedBy: { type: ObjectId, ref: 'User' }, // actor for manual/bulk/reversal/correction
    batchId: { type: String, trim: true }, // groups a bulk award
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'pointTransactions' }
);

transactionSchema.index({ member: 1, createdAt: -1 });
transactionSchema.index({ member: 1, 'criterionSnapshot.category': 1 });
transactionSchema.index({ 'criterionSnapshot.criterion': 1, member: 1 });
transactionSchema.index({ activity: 1 });
transactionSchema.index({ batchId: 1 }, { sparse: true });
// A transaction can be reversed once; each attendance criterion can earn once per record.
transactionSchema.index({ reversalOf: 1 }, { unique: true, partialFilterExpression: { reversalOf: { $type: 'objectId' } } });
transactionSchema.index({ attendanceRecord: 1, 'criterionSnapshot.criterion': 1 }, { unique: true, partialFilterExpression: { attendanceRecord: { $type: 'objectId' } } });

transactionSchema.pre('validate', function () {
  if (this.source === 'attendance') {
    if (!this.attendanceRecord) this.invalidate('attendanceRecord', 'Attendance points must link to an attendance record.');
    if (this.kind !== 'award') this.invalidate('kind', 'Attendance transactions must be awards.');
  } else {
    if (!this.awardedBy) this.invalidate('awardedBy', 'The administrator who made this change is required.');
    if (!this.reason) this.invalidate('reason', 'A reason is required for manual awards, reversals and corrections.');
  }
  if (this.kind === 'reversal' && !this.reversalOf) this.invalidate('reversalOf', 'A reversal must link to the transaction it reverses.');
  if (this.kind !== 'reversal' && this.reversalOf) this.invalidate('reversalOf', 'Only reversals can link to another transaction.');
  if (this.kind === 'correction' && !this.correctionOf) this.invalidate('correctionOf', 'A correction must link to the transaction it corrects.');
  if (this.kind !== 'correction' && this.correctionOf) this.invalidate('correctionOf', 'Only corrections can link to another transaction.');
  if (this.kind === 'award' && this.points <= 0) this.invalidate('points', 'Awards must be positive. Use a reversal or correction to remove points.');
});

appendOnly(transactionSchema, 'pointTransactions');

// Totals are always calculated from the ledger, never stored.
transactionSchema.statics.totalsByMember = function (match = {}) {
  return this.aggregate([{ $match: match }, { $group: { _id: '$member', totalPoints: { $sum: '$points' }, transactions: { $sum: 1 } } }]);
};
transactionSchema.statics.snapshotFor = (criterion, category) => ({
  criterion: criterion._id,
  criterionName: criterion.name,
  category: category._id,
  categoryName: category.name,
  awardMethod: criterion.awardMethod,
  points: criterion.points,
});
transactionSchema.statics.totalsByCategory = function (memberId) {
  return this.aggregate([
    { $match: { member: new mongoose.Types.ObjectId(String(memberId)) } },
    { $group: { _id: '$criterionSnapshot.category', categoryName: { $max: '$criterionSnapshot.categoryName' }, totalPoints: { $sum: '$points' } } },
  ]);
};

module.exports = mongoose.models.PointTransaction || mongoose.model('PointTransaction', transactionSchema);
