const router = require('express').Router();
const { asyncHandler } = require('../lib/http');
const { requireRole } = require('../middleware/auth');
const activityService = require('../services/activity.service');

router.use(requireRole('admin'));

router.get('/', asyncHandler(async (req, res) => res.json(await activityService.listActivities())));
router.post('/venues', asyncHandler(async (req, res) => res.status(201).json({ venue: await activityService.createVenue(req.body || {}, req.user) })));
router.patch('/venues/:id', asyncHandler(async (req, res) => res.json({ venue: await activityService.updateVenue(req.params.id, req.body || {}, req.user) })));
router.post('/', asyncHandler(async (req, res) => res.status(201).json({ activity: await activityService.createActivity(req.body || {}, req.user) })));
router.patch('/:id', asyncHandler(async (req, res) => res.json({ activity: await activityService.updateActivity(req.params.id, req.body || {}, req.user) })));

module.exports = router;
