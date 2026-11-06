const router = require('express').Router();
const { asyncHandler } = require('../lib/http');
const { requireRole } = require('../middleware/auth');
const scoringService = require('../services/scoring.service');
const awardService = require('../services/award.service');

router.use(requireRole('admin'));

router.get('/', asyncHandler(async (req, res) => res.json(await scoringService.listScoring())));
router.post('/categories', asyncHandler(async (req, res) => res.status(201).json({ category: await scoringService.createCategory(req.body || {}, req.user) })));
router.patch('/categories/:id', asyncHandler(async (req, res) => res.json({ category: await scoringService.updateCategory(req.params.id, req.body || {}, req.user) })));
router.post('/criteria', asyncHandler(async (req, res) => res.status(201).json({ criterion: await scoringService.createCriterion(req.body || {}, req.user) })));
router.patch('/criteria/:id', asyncHandler(async (req, res) => res.json({ criterion: await scoringService.updateCriterion(req.params.id, req.body || {}, req.user) })));
router.get('/awards/options', asyncHandler(async (req, res) => res.json(await awardService.options())));
router.post('/awards', asyncHandler(async (req, res) => res.status(201).json(await awardService.award(req.body || {}, req.user))));
router.post('/awards/bulk', asyncHandler(async (req, res) => res.status(201).json(await awardService.bulkAward(req.body || {}, req.user))));
router.post('/awards/reverse', asyncHandler(async (req, res) => res.status(201).json(await awardService.reverse(req.body || {}, req.user))));
router.post('/awards/correct', asyncHandler(async (req, res) => res.status(201).json(await awardService.correct(req.body || {}, req.user))));

module.exports = router;
