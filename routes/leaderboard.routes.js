const router = require('express').Router();
const { asyncHandler } = require('../lib/http');
const leaderboardService = require('../services/leaderboard.service');

router.get('/', asyncHandler(async (req, res) => res.json(await leaderboardService.build(req.query))));

module.exports = router;
