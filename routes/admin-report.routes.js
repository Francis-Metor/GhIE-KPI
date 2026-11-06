const router = require('express').Router();
const { asyncHandler } = require('../lib/http');
const { requireRole } = require('../middleware/auth');
const reportService = require('../services/admin-report.service');

router.use(requireRole('admin'));
router.get('/attendance', asyncHandler(async (req, res) => res.json(await reportService.attendance(req.query))));
router.get('/scoring', asyncHandler(async (req, res) => res.json(await reportService.scoring(req.query))));
router.get('/imports', asyncHandler(async (req, res) => res.json({ rows: await reportService.imports() })));
router.get('/audit', asyncHandler(async (req, res) => res.json({ rows: await reportService.audit(req.query) })));
router.get('/export', asyncHandler(async (req, res) => {
  const type = String(req.query.type || '');
  const report = type === 'attendance' ? await reportService.attendance(req.query)
    : type === 'scoring' ? await reportService.scoring(req.query)
      : type === 'imports' ? await reportService.imports() : await reportService.audit(req.query);
  if (!['attendance', 'scoring', 'imports', 'audit'].includes(type)) return res.status(400).json({ error: 'Invalid report type.' });
  res.type('text/csv').attachment(`clubpoint-${type}-report.csv`).send(reportService.csv(type, report));
}));

module.exports = router;
