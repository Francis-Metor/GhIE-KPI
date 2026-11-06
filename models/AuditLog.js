const mongoose = require('mongoose');
const { ObjectId, Mixed } = mongoose.Schema.Types;
const appendOnly = require('../lib/db/appendOnly');

const AUDIT_ACTIONS = [
  'member.create', 'member.update', 'member.deactivate', 'member.reactivate',
  'import.complete', 'import.fail',
  'category.create', 'category.update', 'criterion.create', 'criterion.update',
  'venue.create', 'venue.update', 'activity.create', 'activity.update',
  'session.create', 'session.revoke',
  'points.award', 'points.bulk_award', 'points.reverse', 'points.correct',
  'leaderboard.publish', 'leaderboard.unpublish', 'leaderboard.schedule',
  'settings.update', 'auth.login_failed', 'export.run',
  'admin.create', 'admin.disable', 'admin.enable', 'admin.reset_reference',
];

const auditSchema = new mongoose.Schema(
  {
    actor: { type: ObjectId, ref: 'User' }, // empty for system actions
    actorRole: { type: String, enum: ['admin', 'member', 'system'], default: 'admin' },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    targetType: { type: String, trim: true },
    targetId: ObjectId,
    summary: { type: String, trim: true, maxlength: 500 },
    before: Mixed, // keep these small and free of secrets
    after: Mixed,
    metadata: Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'auditLogs' }
);

auditSchema.index({ createdAt: -1 });
auditSchema.index({ action: 1, createdAt: -1 });
auditSchema.index({ actor: 1, createdAt: -1 });
auditSchema.index({ targetType: 1, targetId: 1 });

appendOnly(auditSchema, 'auditLogs');

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditSchema);
AuditLog.AUDIT_ACTIONS = AUDIT_ACTIONS;
module.exports = AuditLog;
