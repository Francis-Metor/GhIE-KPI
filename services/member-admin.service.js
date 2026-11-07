const mongoose = require('mongoose');
const { Member, AuditLog } = require('../models');
const { HttpError } = require('../lib/http');

const editableFields = ['memberId', 'fullName', 'department', 'email', 'phone', 'profileImageUrl', 'status'];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function publicMember(member) {
  return {
    id: String(member._id),
    memberId: member.memberId,
    fullName: member.fullName,
    department: member.department || '',
    email: member.email || '',
    phone: member.phone || '',
    profileImageUrl: member.profileImageUrl || '',
    status: member.status,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}

async function listMembers({ search = '', status = '', page = 1, limit = 25 } = {}) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25));
  const query = {};
  if (status === 'active' || status === 'inactive') query.status = status;
  const trimmedSearch = String(search).trim();
  if (trimmedSearch) {
    const expression = new RegExp(escapeRegex(trimmedSearch), 'i');
    query.$or = [{ memberId: expression }, { fullName: expression }, { department: expression }, { email: expression }];
  }
  const [members, total] = await Promise.all([
    Member.find(query).select('memberId fullName department email phone profileImageUrl status createdAt updatedAt')
      .sort({ fullName: 1, memberId: 1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    Member.countDocuments(query),
  ]);
  return { members: members.map(publicMember), pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) } };
}

async function updateMember(id, input, actor) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Member not found.');
  const member = await Member.findById(id);
  if (!member) throw new HttpError(404, 'Member not found.');
  const before = publicMember(member);
  const changes = {};
  for (const field of editableFields) {
    if (input[field] !== undefined) changes[field] = typeof input[field] === 'string' ? input[field].trim() : input[field];
  }
  if (!Object.keys(changes).length) throw new HttpError(400, 'Provide at least one member field to update.');
  Object.assign(member, changes);
  if (member.status === 'inactive' && before.status !== 'inactive') member.deactivatedAt = new Date();
  if (member.status === 'active' && before.status !== 'active') member.deactivatedAt = null;
  try {
    await member.save();
  } catch (error) {
    if (error?.code === 11000) throw new HttpError(409, 'That member ID is already in use.');
    if (error?.name === 'ValidationError') throw new HttpError(400, Object.values(error.errors).map((item) => item.message).join(' '));
    throw error;
  }
  const after = publicMember(member);
  await AuditLog.create({
    actor: actor._id, actorRole: 'admin', action: 'member.update', targetType: 'Member', targetId: member._id,
    summary: `Member ${member.memberId} updated`, before, after,
  });
  return after;
}

module.exports = { listMembers, updateMember };
