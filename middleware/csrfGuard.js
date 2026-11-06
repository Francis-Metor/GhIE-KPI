// Blocks cross-site request forgery on anything that changes data:
// the Origin (when sent) must match this host, and the body must be JSON (a plain HTML form cannot send that).
module.exports = function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin) {
    let same = false;
    try { same = new URL(origin).host === req.get('host'); } catch { /* malformed Origin */ }
    if (!same) return res.status(403).json({ error: 'Cross-site requests are not allowed.' });
  }
  if (!req.is('application/json')) return res.status(415).json({ error: 'Requests must be JSON.' });
  next();
};
