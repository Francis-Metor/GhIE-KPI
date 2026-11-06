const router = require('express').Router();
const { asyncHandler } = require('../lib/http');
const { requireRole } = require('../middleware/auth');
const settingsService = require('../services/system-settings.service');

router.use(requireRole('admin'));
router.get('/', asyncHandler(async (req, res) => res.json(await settingsService.list())));
router.patch('/', asyncHandler(async (req, res) => res.json(await settingsService.update(req.body || {}, req.user))));

module.exports = router;
