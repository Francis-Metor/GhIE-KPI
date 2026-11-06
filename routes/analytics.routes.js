const router = require('express').Router();
const { asyncHandler } = require('../lib/http');
const { requireRole } = require('../middleware/auth');
const analyticsService = require('../services/analytics.service');

router.use(requireRole('admin'));
router.get('/', asyncHandler(async (req, res) => res.json(await analyticsService.report(req.query))));
router.get('/export', asyncHandler(async (req, res) => {
  const data = await analyticsService.report(req.query);
  const format = String(req.query.format || 'csv').toLowerCase();
  if (format === 'xlsx') {
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.attachment('clubpoint-analytics.xlsx');
    return res.send(analyticsService.excel(data));
  }
  if (format !== 'csv') return res.status(400).json({ error: 'Export format must be csv or xlsx.' });
  res.type('text/csv');
  res.attachment('clubpoint-analytics.csv');
  return res.send(analyticsService.csv(data));
}));

module.exports = router;
