const path = require('path');
const express = require('express');
const { PORT } = require('./lib/config/env');
const routes = require('./routes');
const csrfGuard = require('./middleware/csrfGuard');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind Vercel's proxy, so req.ip is the visitor's address
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', csrfGuard, routes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use(errorHandler);

module.exports = app; // Vercel uses this export

if (require.main === module) {
  app.listen(PORT, () => console.log(`ClubPoint running at http://localhost:${PORT}`));
}
