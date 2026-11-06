const Member = require('./Member');
const User = require('./User');
const Category = require('./Category');
const Criterion = require('./Criterion');
const Venue = require('./Venue');
const Activity = require('./Activity');
const AttendanceSession = require('./AttendanceSession');
const AttendanceRecord = require('./AttendanceRecord');
const PointTransaction = require('./PointTransaction');
const PublicationSetting = require('./PublicationSetting');
const AuditLog = require('./AuditLog');
const ImportHistory = require('./ImportHistory');
const SystemSetting = require('./SystemSetting');
const LoginThrottle = require('./LoginThrottle');

const all = [Member, User, Category, Criterion, Venue, Activity, AttendanceSession, AttendanceRecord,
  PointTransaction, PublicationSetting, AuditLog, ImportHistory, SystemSetting, LoginThrottle];

module.exports = {
  Member, User, Category, Criterion, Venue, Activity, AttendanceSession, AttendanceRecord,
  PointTransaction, PublicationSetting, AuditLog, ImportHistory, SystemSetting, LoginThrottle,
  all,
};
