const router = require('express').Router();
const { attachUser } = require('../middleware/auth');

router.use(require('./health.routes'));
router.use(attachUser); // sets req.user from the session cookie (or null)
router.use('/auth', require('./auth.routes'));
router.use('/member', require('./member.routes'));
router.use('/leaderboard', require('./leaderboard.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/admin/members/import', require('./member-import.routes'));
router.use('/admin/scoring', require('./scoring.routes'));
router.use('/admin/analytics', require('./analytics.routes'));
router.use('/admin/reports', require('./admin-report.routes'));
router.use('/admin/settings', require('./system-settings.routes'));
router.use('/admin/leaderboard', require('./leaderboard-admin.routes'));
router.use('/admin/activities', require('./activity.routes'));
router.use('/attendance/sessions', require('./qr-session.routes'));
// Later phases mount their routers here, e.g. router.use('/members', require('./members.routes'));

module.exports = router;
