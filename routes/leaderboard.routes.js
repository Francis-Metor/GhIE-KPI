const router = require('express').Router();
const { asyncHandler } = require('../lib/http');
const { attachUser } = require('../middleware/auth');
const leaderboardService = require('../services/leaderboard.service');

router.use(attachUser);
router.get('/', asyncHandler(async (req, res) => res.json(await leaderboardService.build(req.query, { user: req.user }))));

module.exports = router;
