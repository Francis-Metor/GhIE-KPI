const { isProduction } = require('../lib/config/env');
const { HttpError } = require('../lib/http');

// Keeps stack traces and internals out of production responses.
module.exports = function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...(err.details && { details: err.details }) });
  console.error(err);
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation failed.', details: Object.values(err.errors).map((e) => e.message) });
  }
  if (err.code === 11000) return res.status(409).json({ error: 'A record with these details already exists.' });
  if (/ECONNREFUSED|ServerSelection|buffering timed out|MONGODB_URI/i.test(`${err.name} ${err.message}`)) {
    return res.status(503).json({ error: isProduction ? 'Database unavailable.' : err.message });
  }
  res.status(err.status || 500).json({ error: isProduction ? 'Something went wrong.' : err.message });
};
