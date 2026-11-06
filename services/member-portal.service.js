const { Member, PointTransaction, AttendanceRecord } = require('../models');

async function getPortal(memberId) {
  const [member, transactions, attendance] = await Promise.all([
    Member.findById(memberId).select('memberId fullName department email profileImageUrl status').lean(),
    PointTransaction.find({ member: memberId })
      .select('points kind source reason criterionSnapshot activity createdAt')
      .populate('activity', 'title')
      .sort({ createdAt: -1 }).limit(200).lean(),
    AttendanceRecord.find({ member: memberId })
      .select('activity result rejectionReason submittedAt distanceMeters allowedRadiusMeters')
      .populate('activity', 'title')
      .sort({ submittedAt: -1 }).limit(200).lean(),
  ]);
  if (!member) return null;

  const categoryTotals = new Map();
  let totalPoints = 0;
  transactions.forEach((transaction) => {
    const category = transaction.criterionSnapshot?.category;
    const categoryName = transaction.criterionSnapshot?.categoryName || 'Uncategorized';
    const key = String(category || categoryName);
    const current = categoryTotals.get(key) || { category: key, name: categoryName, points: 0 };
    current.points = Number((current.points + transaction.points).toFixed(2));
    categoryTotals.set(key, current);
    totalPoints += transaction.points;
  });

  return {
    member,
    summary: {
      totalPoints: Number(totalPoints.toFixed(2)),
      transactionCount: transactions.length,
      attendanceCount: attendance.filter((record) => record.result === 'accepted').length,
      categoryTotals: [...categoryTotals.values()],
    },
    transactions,
    attendance,
  };
}

module.exports = { getPortal };
