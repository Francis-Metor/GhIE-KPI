const mongoose = require('mongoose');
const XLSX = require('xlsx');
const { Member, Category, PointTransaction } = require('../models');
const { HttpError } = require('../lib/http');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function dateFilter(value, endOfDay) {
  if (value === undefined || value === '') return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, 'Dates must use YYYY-MM-DD format.');
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Invalid date filter.');
  return date;
}

function filtersFrom(query) {
  const filters = {
    search: String(query.search || '').trim(),
    department: String(query.department || '').trim(),
    status: String(query.status || 'active').trim(),
    category: String(query.category || '').trim(),
    from: dateFilter(query.from, false),
    to: dateFilter(query.to, true),
  };
  if (!['active', 'inactive', 'all'].includes(filters.status)) throw new HttpError(400, 'Invalid member status filter.');
  if (filters.category && !mongoose.isValidObjectId(filters.category)) throw new HttpError(400, 'Invalid category filter.');
  if (filters.from && filters.to && filters.from > filters.to) throw new HttpError(400, 'The start date must be before the end date.');
  return filters;
}

function number(value) {
  return Number(Number(value || 0).toFixed(2));
}

async function report(query = {}) {
  const filters = filtersFrom(query);
  const memberMatch = {};
  if (filters.status !== 'all') memberMatch.status = filters.status;
  if (filters.department) memberMatch.department = filters.department;
  if (filters.search) {
    const expression = new RegExp(escapeRegex(filters.search), 'i');
    memberMatch.$or = [{ fullName: expression }, { memberId: expression }];
  }

  const members = await Member.find(memberMatch).select('memberId fullName department status').sort({ fullName: 1 }).lean();
  const memberIds = members.map((member) => member._id);
  const transactionMatch = { member: { $in: memberIds } };
  if (filters.category) transactionMatch['criterionSnapshot.category'] = new mongoose.Types.ObjectId(filters.category);
  if (filters.from || filters.to) {
    transactionMatch.createdAt = {};
    if (filters.from) transactionMatch.createdAt.$gte = filters.from;
    if (filters.to) transactionMatch.createdAt.$lte = filters.to;
  }
  const grouped = memberIds.length ? await PointTransaction.aggregate([
    { $match: transactionMatch },
    { $group: {
      _id: { member: '$member', category: '$criterionSnapshot.category' },
      categoryName: { $last: '$criterionSnapshot.categoryName' },
      points: { $sum: '$points' },
      transactions: { $sum: 1 },
    } },
  ]) : [];

  const categories = await Category.find({ isActive: true }).select('name').sort({ displayOrder: 1, name: 1 }).lean();
  const categoryMap = new Map(categories.map((category) => [String(category._id), { id: String(category._id), name: category.name }]));
  grouped.forEach((entry) => {
    const id = String(entry._id.category);
    if (!categoryMap.has(id)) return;
  });
  const categoryList = [...categoryMap.values()];
  const groupedByMember = new Map();
  grouped.forEach((entry) => {
    const memberId = String(entry._id.member);
    if (!groupedByMember.has(memberId)) groupedByMember.set(memberId, new Map());
    groupedByMember.get(memberId).set(String(entry._id.category), { points: number(entry.points), transactions: entry.transactions });
  });
  const rows = members.map((member) => {
    const memberCategories = groupedByMember.get(String(member._id)) || new Map();
    const categoryPoints = {};
    let totalPoints = 0;
    let transactions = 0;
    categoryList.forEach((category) => {
      const value = memberCategories.get(category.id);
      categoryPoints[category.id] = value ? value.points : 0;
      totalPoints += categoryPoints[category.id];
      transactions += value ? value.transactions : 0;
    });
    return { memberId: member.memberId, fullName: member.fullName, department: member.department || '', status: member.status, categoryPoints, totalPoints: number(totalPoints), transactions };
  });
  const categoryTotals = categoryList.map((category) => ({
    ...category,
    totalPoints: number(rows.reduce((sum, row) => sum + (row.categoryPoints[category.id] || 0), 0)),
  }));
  return {
    filters: { search: filters.search, department: filters.department, status: filters.status, category: filters.category, from: query.from || '', to: query.to || '' },
    categories: categoryList,
    rows,
    summary: {
      memberCount: rows.length,
      transactionCount: rows.reduce((sum, row) => sum + row.transactions, 0),
      totalPoints: number(rows.reduce((sum, row) => sum + row.totalPoints, 0)),
      categoryTotals,
      topMembers: [...rows].sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 5).map((row) => ({ fullName: row.fullName, memberId: row.memberId, totalPoints: row.totalPoints })),
    },
  };
}

function exportRows(data) {
  return data.rows.map((row) => {
    const output = { 'Member ID': row.memberId, 'Full Name': row.fullName, Department: row.department, Status: row.status };
    data.categories.forEach((category) => { output[category.name] = row.categoryPoints[category.id] || 0; });
    output.Total = row.totalPoints;
    output.Transactions = row.transactions;
    return output;
  });
}

function csv(data) {
  const rows = exportRows(data);
  if (!rows.length) return `${['Member ID', 'Full Name', 'Department', 'Status', ...data.categories.map((category) => category.name), 'Total', 'Transactions'].join(',')}\r\n`;
  const headers = Object.keys(rows[0]);
  const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers.map(quote).join(','), ...rows.map((row) => headers.map((header) => quote(row[header])).join(','))].join('\r\n');
}

function excel(data) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows(data)), 'Member scores');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
    { Metric: 'Members', Value: data.summary.memberCount },
    { Metric: 'Transactions', Value: data.summary.transactionCount },
    { Metric: 'Total points', Value: data.summary.totalPoints },
  ]), 'Summary');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { report, csv, excel };
