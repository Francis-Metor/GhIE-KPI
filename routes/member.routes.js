const router = require('express').Router();
const { asyncHandler } = require('../lib/http');
const { requireRole } = require('../middleware/auth');
const { Member } = require('../models');
const memberPortalService = require('../services/member-portal.service');

router.use(requireRole('member'));

// The member is always taken from the session, never from a URL or request body,
// so one member can never ask for another member's record.
router.get('/me', asyncHandler(async (req, res) => {
  const member = await Member.findById(req.user.member._id)
    .select('memberId fullName department email profileImageUrl status').lean();
  res.json({ member });
}));

router.get('/portal', asyncHandler(async (req, res) => {
  const portal = await memberPortalService.getPortal(req.user.member._id);
  if (!portal) return res.status(404).json({ error: 'Member profile not found.' });
  res.json(portal);
}));

module.exports = router;
