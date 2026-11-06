const router = require('express').Router();
const { asyncHandler } = require('../lib/http');
const { requireRole } = require('../middleware/auth');
const leaderboardService = require('../services/leaderboard.service');

router.use(requireRole('admin'));
router.get('/settings', asyncHandler(async (req, res) => res.json({ setting: await leaderboardService.settings() })));
router.patch('/settings', asyncHandler(async (req, res) => res.json({ setting: await leaderboardService.updateSettings(req.body || {}, req.user) })));
router.get('/preview', asyncHandler(async (req, res) => res.json(await leaderboardService.build(req.query, { requirePublic: false }))));

module.exports = router;
