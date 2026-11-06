const router = require('express').Router();
const { asyncHandler } = require('../lib/http');
const { requireRole } = require('../middleware/auth');
const adminService = require('../services/admin.service');

router.use(requireRole('admin'));

router.get('/admins', asyncHandler(async (req, res) => {
  res.json({ admins: await adminService.listAdmins(), currentUserId: String(req.user._id) });
}));

router.post('/admins', asyncHandler(async (req, res) => {
  const user = await adminService.createAdmin(req.body || {}, req.user);
  res.status(201).json({ id: user.id, email: user.email });
}));

router.patch('/admins/:id/status', asyncHandler(async (req, res) => {
  await adminService.setAdminStatus(req.params.id, req.body?.status, req.user);
  res.json({ ok: true });
}));

router.put('/admins/:id/reference', asyncHandler(async (req, res) => {
  await adminService.resetReference(req.params.id, req.body?.reference, req.user);
  res.json({ ok: true });
}));

module.exports = router;
