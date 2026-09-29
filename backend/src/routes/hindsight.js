'use strict';
const router = require('express').Router();
const hindsight = require('../services/hindsight');
const { HttpError } = require('../middleware/errorHandler');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const guard = (req, res, next) => {
  if (!hindsight.status().enabled) return next(new HttpError(503, 'hindsight_disabled', 'Hindsight bridge is disabled.', 'Set HINDSIGHT_ENABLED=true in backend/.env'));
  next();
};

router.get('/hindsight/status', (req, res) => res.json(hindsight.status()));
router.post('/hindsight/retain', guard, wrap(async (req, res) => {
  const { content, tags, context } = req.body || {};
  if (!content) throw new HttpError(400, 'bad_request', 'content is required');
  res.json(await hindsight.retain(content, { tags, context }));
}));
router.post('/hindsight/recall', guard, wrap(async (req, res) => {
  if (!req.body?.query) throw new HttpError(400, 'bad_request', 'query is required');
  res.json({ results: await hindsight.recall(req.body.query) });
}));
router.post('/hindsight/reflect', guard, wrap(async (req, res) => {
  if (!req.body?.query) throw new HttpError(400, 'bad_request', 'query is required');
  res.json({ answer: await hindsight.reflect(req.body.query) });
}));
module.exports = router;
