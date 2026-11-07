const { AttendanceRecord, PointTransaction, ImportHistory, AuditLog, Member } = require('../models');

function date(value, end) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return undefined;
  return new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}Z`);
}

function range(query, field) {
  const from = date(query.from, false);
  const to = date(query.to, true);
  if (!from && !to) return {};
  return { [field]: { ...(from && { $gte: from }), ...(to && { $lte: to }) } };
}

async function attendance(query = {}) {
  const match = { ...range(query, 'submittedAt') };
  if (['accepted', 'rejected'].includes(query.result)) match.result = query.result;
  const rows = await AttendanceRecord.find(match)
    .populate('member', 'memberId fullName department')
    .populate('activity', 'title')
    .sort({ submittedAt: -1 }).limit(500).lean();
  return {
    count: rows.length,
    accepted: rows.filter((row) => row.result === 'accepted').length,
    rejected: rows.filter((row) => row.result === 'rejected').length,
    rows,
  };
}

async function scoring(query = {}) {
  const match = { ...range(query, 'createdAt') };
  if (query.source && ['attendance', 'manual', 'bulk'].includes(query.source)) match.source = query.source;
  const activeMembers = await Member.find({ status: 'active' }).select('_id').lean();
  match.member = { $in: activeMembers.map((member) => member._id) };
  const rows = await PointTransaction.find(match)
    .populate('member', 'memberId fullName department')
    .populate('awardedBy', 'email displayName')
    .sort({ createdAt: -1 }).limit(500).lean();
  return {
    count: rows.length,
    totalPoints: Number(rows.reduce((sum, row) => sum + row.points, 0).toFixed(2)),
    rows,
  };
}

async function imports() {
  return ImportHistory.find()
    .populate('performedBy', 'email displayName')
    .sort({ createdAt: -1 }).limit(200).lean();
}

async function audit(query = {}) {
  const match = { ...range(query, 'createdAt') };
  if (query.action) match.action = String(query.action);
  const rows = await AuditLog.find(match)
    .populate('actor', 'email displayName')
    .sort({ createdAt: -1 }).limit(500).lean();
  return rows;
}

function csvRows(type, report) {
  if (type === 'attendance') return report.rows.map((row) => ({
    Date: row.submittedAt, 'Member ID': row.member?.memberId || '', Member: row.member?.fullName || '',
    Activity: row.activity?.title || '', Result: row.result, Distance: row.distanceMeters ?? '',
    'Rejection reason': row.rejectionReason || '',
  }));
  if (type === 'scoring') return report.rows.map((row) => ({
    Date: row.createdAt, 'Member ID': row.member?.memberId || '', Member: row.member?.fullName || '',
    Points: row.points, Kind: row.kind, Source: row.source, Category: row.criterionSnapshot?.categoryName || '',
    Criterion: row.criterionSnapshot?.criterionName || '', Reason: row.reason || '',
  }));
  if (type === 'imports') return report.map((row) => ({
    Date: row.createdAt, File: row.fileName, Status: row.status, 'Performed by': row.performedBy?.email || '',
    Rows: row.counts?.totalRows || 0, Created: row.counts?.created || 0, Updated: row.counts?.updated || 0, Failed: row.counts?.failed || 0,
  }));
  return report.map((row) => ({
    Date: row.createdAt, Action: row.action, Actor: row.actor?.email || row.actorRole, Target: row.targetType || '',
    Summary: row.summary || '',
  }));
}

function csv(type, report) {
  const rows = csvRows(type, report);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return rows.length ? [headers.map(quote).join(','), ...rows.map((row) => headers.map((header) => quote(row[header])).join(','))].join('\r\n') : '';
}

module.exports = { attendance, scoring, imports, audit, csv };
