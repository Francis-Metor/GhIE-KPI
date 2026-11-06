const crypto = require('crypto');
const mongoose = require('mongoose');
const { Member, Criterion, PointTransaction, AuditLog } = require('../models');
const { runInTransaction } = require('../lib/db/withTransaction');
const { HttpError } = require('../lib/http');

const text = (value) => String(value ?? '').trim();

async function findCriterion(id, session) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Criterion not found.');
  let query = Criterion.findById(id).populate('category');
  if (session) query = query.session(session);
  const criterion = await query;
  if (!criterion || !criterion.isActive) throw new HttpError(404, 'Criterion not found or inactive.');
  if (criterion.awardMethod !== 'manual') throw new HttpError(400, 'Only manual criteria can be awarded by an administrator.');
  return criterion;
}

async function findMembers(ids, session) {
  if (!Array.isArray(ids) || !ids.length) throw new HttpError(400, 'Select at least one member.');
  const normalized = [...new Set(ids.map(text).filter(Boolean))];
  if (normalized.length > 500) throw new HttpError(400, 'A bulk award cannot contain more than 500 members.');
  let query = Member.find({ _id: { $in: normalized }, status: 'active' });
  if (session) query = query.session(session);
  const members = await query;
  if (members.length !== normalized.length) throw new HttpError(400, 'One or more selected members are missing or inactive.');
  return members;
}

function reasonValue(value) {
  const reason = text(value);
  if (!reason) throw new HttpError(400, 'A reason or note is required.');
  if (reason.length > 500) throw new HttpError(400, 'The reason must be 500 characters or fewer.');
  return reason;
}

async function ensureLimit(members, criterion, session) {
  if (!criterion.awardLimit) return;
  for (const member of members) {
    let query = PointTransaction.countDocuments({
      member: member._id, 'criterionSnapshot.criterion': criterion._id, kind: 'award', points: { $gt: 0 },
    });
    if (session) query = query.session(session);
    if ((await query) >= criterion.awardLimit) throw new HttpError(400, `${member.fullName} has reached the award limit for ${criterion.name}.`);
  }
}

async function award({ memberId, criterionId, reason }, actor) {
  const note = reasonValue(reason);
  return runInTransaction(async (session) => {
    const criterion = await findCriterion(criterionId, session);
    const members = await findMembers([memberId], session);
    await ensureLimit(members, criterion, session);
    const transaction = new PointTransaction({
      member: members[0]._id, points: criterion.points, kind: 'award', source: 'manual',
      criterionSnapshot: PointTransaction.snapshotFor(criterion, criterion.category), reason: note, awardedBy: actor._id,
    });
    await transaction.save({ session: session || undefined });
    await AuditLog.create([{
      actor: actor._id, actorRole: 'admin', action: 'points.award', targetType: 'PointTransaction',
      targetId: transaction._id, summary: `Manual award to ${members[0].fullName}`,
      metadata: { points: criterion.points, criterion: criterion._id },
    }], { session: session || undefined });
    return { transaction };
  });
}

async function bulkAward({ memberIds, criterionId, reason }, actor) {
  const note = reasonValue(reason);
  return runInTransaction(async (session) => {
    const criterion = await findCriterion(criterionId, session);
    const members = await findMembers(memberIds, session);
    await ensureLimit(members, criterion, session);
    const batchId = crypto.randomBytes(12).toString('hex');
    const docs = members.map((member) => ({
      member: member._id, points: criterion.points, kind: 'award', source: 'bulk',
      criterionSnapshot: PointTransaction.snapshotFor(criterion, criterion.category),
      reason: note, awardedBy: actor._id, batchId,
    }));
    const created = await PointTransaction.insertMany(docs, { ordered: true, session: session || undefined });
    await AuditLog.create([{
      actor: actor._id, actorRole: 'admin', action: 'points.bulk_award', targetType: 'PointTransaction',
      targetId: created[0]._id, summary: `Bulk award to ${members.length} members`,
      metadata: { batchId, count: members.length, points: criterion.points, criterion: criterion._id },
    }], { session: session || undefined });
    return { count: created.length, batchId };
  });
}

async function reverse({ transactionId, reason }, actor) {
  const note = reasonValue(reason);
  return runInTransaction(async (session) => {
    let query = PointTransaction.findById(transactionId);
    if (session) query = query.session(session);
    const original = await query;
    if (!original) throw new HttpError(404, 'Point transaction not found.');
    if (original.kind === 'reversal') throw new HttpError(400, 'A reversal cannot be reversed.');
    let existingQuery = PointTransaction.findOne({ reversalOf: original._id });
    if (session) existingQuery = existingQuery.session(session);
    if (await existingQuery) throw new HttpError(409, 'This transaction has already been reversed.');
    const reversal = new PointTransaction({
      member: original.member, points: -Math.abs(original.points), kind: 'reversal',
      source: original.source === 'bulk' ? 'bulk' : 'manual', criterionSnapshot: original.criterionSnapshot,
      reason: note, reversalOf: original._id, awardedBy: actor._id, batchId: original.batchId,
    });
    await reversal.save({ session: session || undefined });
    await AuditLog.create([{ actor: actor._id, actorRole: 'admin', action: 'points.reverse', targetType: 'PointTransaction', targetId: reversal._id, summary: `Reversed transaction ${original._id}`, metadata: { reversalOf: original._id } }], { session: session || undefined });
    return { transaction: reversal };
  });
}

async function correct({ transactionId, points, reason }, actor) {
  const note = reasonValue(reason);
  const value = Number(points);
  if (!Number.isFinite(value) || value === 0) throw new HttpError(400, 'Correction points must be a non-zero number.');
  return runInTransaction(async (session) => {
    let query = PointTransaction.findById(transactionId);
    if (session) query = query.session(session);
    const original = await query;
    if (!original) throw new HttpError(404, 'Point transaction not found.');
    const correction = new PointTransaction({
      member: original.member, points: value, kind: 'correction',
      source: original.source === 'bulk' ? 'bulk' : 'manual', criterionSnapshot: original.criterionSnapshot,
      reason: note, correctionOf: original._id, awardedBy: actor._id, batchId: original.batchId,
    });
    await correction.save({ session: session || undefined });
    await AuditLog.create([{ actor: actor._id, actorRole: 'admin', action: 'points.correct', targetType: 'PointTransaction', targetId: correction._id, summary: `Corrected transaction ${original._id}`, metadata: { correctionOf: original._id, points: value } }], { session: session || undefined });
    return { transaction: correction };
  });
}

async function options() {
  const [members, criteria, transactions] = await Promise.all([
    Member.find({ status: 'active' }).select('memberId fullName').sort({ fullName: 1 }).lean(),
    Criterion.find({ isActive: true, awardMethod: 'manual' }).populate('category', 'name').sort({ name: 1 }).lean(),
    PointTransaction.find().populate('member', 'memberId fullName').sort({ createdAt: -1 }).limit(100).lean(),
  ]);
  return { members, criteria, transactions };
}

module.exports = { award, bulkAward, reverse, correct, options };
