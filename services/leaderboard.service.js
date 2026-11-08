const mongoose = require('mongoose');
const { Member, Category, PointTransaction, PublicationSetting, AuditLog } = require('../models');
const { HttpError } = require('../lib/http');

function rankRows(rows, tieHandling) {
  let previous = null;
  let rank = 0;
  rows.forEach((row, index) => {
    if (tieHandling === 'none') row.rank = index + 1;
    else if (row.totalPoints !== previous) {
      rank = tieHandling === 'dense' ? rank + 1 : index + 1;
      row.rank = rank;
    } else row.rank = rank;
    previous = row.totalPoints;
  });
  return rows;
}

function publicRow(row, fields) {
  const allowed = new Set(PublicationSetting.PUBLIC_FIELDS);
  const output = { rank: row.rank };
  fields.filter((field) => allowed.has(field)).forEach((field) => {
    if (field === 'totalPoints') output.totalPoints = row.totalPoints;
    else if (field === 'profileImageUrl' && row.profileImageUrl) output.profileImageUrl = row.profileImageUrl;
    else if (row[field] !== undefined && row[field] !== '') output[field] = row[field];
  });
  return output;
}

function categoryId(value) {
  if (!value) return null;
  if (!mongoose.isValidObjectId(value)) throw new HttpError(400, 'Invalid category filter.');
  return new mongoose.Types.ObjectId(value);
}

async function build(query = {}, { requirePublic = true, user = null } = {}) {
  const setting = await PublicationSetting.getLeaderboard();
  if (requirePublic && !setting.isPublicAt()) throw new HttpError(404, 'Leaderboard is not available.');
  const selectedCategory = categoryId(query.category);
  const match = selectedCategory ? { 'criterionSnapshot.category': selectedCategory } : {};
  const activeMembers = await Member.find({ status: 'active' }).select('_id').lean();
  match.member = { $in: activeMembers.map((member) => member._id) };
  if (user?.role === 'member') {
    const memberType = user.member?.memberType || 'executive';
    match.member = { $in: (await Member.find({
      status: 'active',
      memberType: memberType === 'executive' ? { $in: ['executive', null] } : memberType,
    }).select('_id').lean()).map((member) => member._id) };
  }
  const grouped = await PointTransaction.aggregate([
    { $match: match },
    { $group: { _id: '$member', totalPoints: { $sum: '$points' }, transactions: { $sum: 1 } } },
    { $sort: { totalPoints: -1, _id: 1 } },
  ]);
  const members = grouped.length ? await Member.find({ _id: { $in: grouped.map((row) => row._id) } })
    .select('memberId fullName department profileImageUrl memberType').lean() : [];
  const byId = new Map(members.map((member) => [String(member._id), member]));
  const ranked = rankRows(grouped.map((row) => {
    const member = byId.get(String(row._id)) || {};
    return {
      ...member,
      totalPoints: Number(Number(row.totalPoints || 0).toFixed(2)),
      transactions: row.transactions,
    };
  }), setting.tieHandling);
  const categories = setting.showCategoryRankings ? await Category.find({ isActive: true }).select('name').sort({ displayOrder: 1, name: 1 }).lean() : [];
  return {
    visibility: setting.visibility,
    category: selectedCategory ? String(selectedCategory) : null,
    publicFields: setting.publicFields,
    showCategoryRankings: setting.showCategoryRankings,
    tieHandling: setting.tieHandling,
    categories: categories.map((category) => ({ id: String(category._id), name: category.name })),
    rows: ranked.map((row) => publicRow(row, setting.publicFields)),
  };
}

async function settings() {
  const setting = await PublicationSetting.getLeaderboard();
  return setting.toObject();
}

async function updateSettings(input, actor) {
  const setting = await PublicationSetting.getLeaderboard();
  const allowedFields = PublicationSetting.PUBLIC_FIELDS;
  if (input.visibility !== undefined) setting.visibility = String(input.visibility);
  if (input.publishAt !== undefined) setting.publishAt = input.publishAt ? new Date(input.publishAt) : undefined;
  if (input.unpublishAt !== undefined) setting.unpublishAt = input.unpublishAt ? new Date(input.unpublishAt) : undefined;
  if (input.publicFields !== undefined) {
    if (!Array.isArray(input.publicFields) || input.publicFields.some((field) => !allowedFields.includes(field))) {
      throw new HttpError(400, 'Public fields contain an unsupported value.');
    }
    setting.publicFields = [...new Set(input.publicFields)];
  }
  if (input.showCategoryRankings !== undefined) setting.showCategoryRankings = Boolean(input.showCategoryRankings);
  if (input.tieHandling !== undefined) setting.tieHandling = String(input.tieHandling);
  setting.updatedBy = actor._id;
  await setting.save();
  await AuditLog.create({
    actor: actor._id, actorRole: 'admin', action: 'leaderboard.settings.update',
    targetType: 'PublicationSetting', targetId: setting._id, summary: `Leaderboard visibility set to ${setting.visibility}`,
  });
  return setting.toObject();
}

module.exports = { build, settings, updateSettings };
