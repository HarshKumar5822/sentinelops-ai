'use strict';
const router = require('express').Router();
const engine = require('../services/memory');
const groq = require('../services/groq');
const hindsight = require('../services/hindsight');
const P = require('../services/prompts');
const { HttpError } = require('../middleware/errorHandler');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const pub = ({ tok, ...m }) => m; // never send the token cache to clients

router.get('/memory', (req, res) => {
  const { cat } = req.query;
  const list = req.app.locals.store.get().mem.filter((m) => !cat || m.cat === cat).sort((a, b) => b.ts - a.ts);
  res.json({ count: list.length, memories: list.map(pub) });
});

router.post('/memory/retain', wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.text) throw new HttpError(400, 'bad_request', 'title and text are required');
  const store = req.app.locals.store;
  const m = engine.makeMemory(b);
  store.get().mem.push(m);
  store.touch();
  hindsight.retain(`${m.title}. ${m.text}`, { tags: [m.cat, m.service].filter(Boolean) }).catch((e) => console.warn('[hindsight] retain skipped:', e.message));
  res.status(201).json({ memory: pub(m) });
}));

router.post('/memory/recall', (req, res) => {
  const { query, k, service, cat } = req.body || {};
  if (!query) throw new HttpError(400, 'bad_request', 'query is required');
  const store = req.app.locals.store;
  const hits = engine.recall(store.get().mem, String(query).slice(0, 2000), { k: Math.min(20, Number(k) || 5), service, cat });
  hits.forEach((h) => { if (h.cos >= 0.24) h.memory.recalls = (h.memory.recalls || 0) + 1; });
  store.touch();
  res.json({ results: hits.map((h) => ({ memory: pub(h.memory), relevance: Number(Math.min(0.99, h.score).toFixed(3)), cosine: Number(h.cos.toFixed(3)) })) });
});

/** Hindsight-style reflect: synthesise recalled memories into an answer (uses Groq when configured). */
router.post('/memory/reflect', wrap(async (req, res) => {
  const { query } = req.body || {};
  if (!query) throw new HttpError(400, 'bad_request', 'query is required');
  const store = req.app.locals.store;
  const hits = engine.recall(store.get().mem, query, { k: 8 }).filter((h) => h.cos >= 0.08).map((h) => h.memory);
  if (!groq.isConfigured()) {
    return res.json({ answer: hits.length ? `Found ${hits.length} related memories. Configure GROQ_API_KEY for a synthesised reflection.` : 'No related memories yet.', memories: hits.map(pub), model: null });
  }
  const { text, model } = await groq.chat({ messages: P.reflect({ query, memories: hits }), maxTokens: 700, temperature: 0.3 });
  res.json({ answer: text, memories: hits.map(pub), model });
}));

router.delete('/memory/:id', (req, res) => {
  const store = req.app.locals.store;
  const s = store.get();
  const before = s.mem.length;
  s.mem = s.mem.filter((m) => m.id !== req.params.id);
  if (s.mem.length === before) throw new HttpError(404, 'not_found', 'Memory not found');
  store.touch();
  res.json({ deleted: req.params.id });
});

module.exports = router;
