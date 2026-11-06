const router = require('express').Router();
const { asyncHandler } = require('../lib/http');
const { requireRole } = require('../middleware/auth');
const db = require('../lib/db/connect');
const qrSessionService = require('../services/qr-session.service');
const attendanceService = require('../services/attendance.service');

router.get('/validate/:token', asyncHandler(async (req, res) => {
  await db.connectDB();
  res.json(await qrSessionService.validateToken(req.params.token));
}));

router.post('/submit', requireRole('member'), asyncHandler(async (req, res) => {
  const result = await attendanceService.submitAttendance({
    token: req.body?.token,
    location: req.body?.location,
    memberId: req.user.member._id,
  });
  res.status(result.duplicate ? 200 : 201).json(result);
}));

router.use(requireRole('admin'));
router.get('/', asyncHandler(async (req, res) => {
  res.json({ sessions: await qrSessionService.listSessions() });
}));

router.post('/', asyncHandler(async (req, res) => {
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  res.status(201).json(await qrSessionService.createSession({ ...(req.body || {}), baseUrl }, req.user));
}));

router.patch('/:id/revoke', asyncHandler(async (req, res) => {
  res.json({ session: await qrSessionService.revokeSession(req.params.id, req.user) });
}));

module.exports = router;
