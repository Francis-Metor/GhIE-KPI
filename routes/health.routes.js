const router = require('express').Router();
const { connectDB } = require('../lib/db/connect');
const { isProduction } = require('../lib/config/env');
const { all: models } = require('../models');

// Reports whether the database is reachable and how many documents each collection holds.
router.get('/health', async (req, res) => {
  try {
    await connectDB();
    const collections = {};
    for (const Model of models) collections[Model.collection.name] = await Model.estimatedDocumentCount();
    res.json({ ok: true, database: 'connected', collections });
  } catch (err) {
    res.status(503).json({ ok: false, database: 'unreachable', error: isProduction ? 'Database unavailable.' : err.message });
  }
});

module.exports = router;
