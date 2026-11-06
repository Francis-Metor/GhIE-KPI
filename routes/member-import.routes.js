const router = require('express').Router();
const { asyncHandler } = require('../lib/http');
const { requireRole } = require('../middleware/auth');
const { MEMBER_COLUMNS, templateBuffer, importMembers } = require('../lib/imports/memberImport');

router.use(requireRole('admin'));

router.get('/columns', (req, res) => {
  res.json({ columns: MEMBER_COLUMNS });
});

router.get('/template', (req, res) => {
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.attachment('clubpoint-members-template.xlsx');
  res.send(templateBuffer());
});

router.post('/upload', asyncHandler(async (req, res) => {
  const result = await importMembers({ data: req.body?.data, fileName: req.body?.fileName, actor: req.user });
  res.status(201).json(result);
}));

module.exports = router;
