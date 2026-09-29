'use strict';
const router = require('express').Router();
const { HttpError } = require('../middleware/errorHandler');

/** Full-snapshot sync so your data survives across browsers/devices. */
router.get('/state', (req, res) => {
  const s = req.app.locals.store.get();
  res.json({ state: s, counts: { memories: s.mem.length, incidents: s.inc.length } });
});

router.put('/state', (req, res) => {
  const s = req.body && req.body.state;
  if (!s || s.v !== 2 || !Array.isArray(s.mem) || !Array.isArray(s.inc)) {
    throw new HttpError(400, 'bad_state', 'Body must be { state: { v: 2, mem: [], inc: [], … } }');
  }
  if (s.mem.length > 5000 || s.inc.length > 5000) throw new HttpError(413, 'too_large', 'Snapshot too large');
  req.app.locals.store.set(s);
  res.json({ saved: true, counts: { memories: s.mem.length, incidents: s.inc.length } });
});

module.exports = router;
