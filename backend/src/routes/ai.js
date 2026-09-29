'use strict';
const router = require('express').Router();
const groq = require('../services/groq');
const P = require('../services/prompts');
const hindsight = require('../services/hindsight');
const memoryEngine = require('../services/memory');
const { HttpError } = require('../middleware/errorHandler');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const need = (cond, msg) => { if (!cond) throw new HttpError(400, 'bad_request', msg); };

/** Add Hindsight recall results (if enabled) to locally recalled memories. Never throws. */
async function withHindsight(memories, query) {
  try {
    const extra = await hindsight.recall(query);
    return [...memories, ...extra].slice(0, 8);
  } catch (e) {
    console.warn('[hindsight] recall skipped:', e.message);
    return memories;
  }
}

/**
 * POST /api/ai/triage
 * body: { incident, memories?, mode: 'stateless' | 'memory' }
 */
router.post('/ai/triage', wrap(async (req, res) => {
  const { incident, memories, mode } = req.body || {};
  need(incident && typeof incident === 'object', 'incident is required');
  need(['stateless', 'memory'].includes(mode), "mode must be 'stateless' or 'memory'");
  let mem = mode === 'memory' ? P.cleanMemories(memories) : [];
  if (mode === 'memory') mem = await withHindsight(mem, `${incident.service} ${(incident.symptoms || []).join(' ')}`);
  const { data, model, usage } = await groq.chatJSON({ messages: P.triage({ incident, memories: mem, mode }), maxTokens: 1500 });
  res.json({ result: P.normaliseTriage(data), model, usage });
}));

/**
 * POST /api/agent/triage  — server-side recall over the synced memory bank.
 * Handy for webhooks (PagerDuty, Alertmanager, Datadog…): send the raw alert, get a plan.
 * body: { service, alert, symptoms?, logs? }
 */
router.post('/agent/triage', wrap(async (req, res) => {
  const store = req.app.locals.store;
  const b = req.body || {};
  need(b.alert || (b.symptoms && b.symptoms.length), 'alert or symptoms required');
  const incident = { id: 'WEBHOOK', service: b.service, title: b.alert, symptoms: b.symptoms || [b.alert], logs: b.logs || [] };
  const query = `${b.service || ''} ${b.alert || ''} ${(b.symptoms || []).join(' ')} ${(b.logs || []).join(' ')}`;
  const hits = memoryEngine.recall(store.get().mem, query, { k: 6, service: b.service });
  const local = hits.filter((h) => h.cos >= 0.1).map((h) => h.memory);
  const mem = await withHindsight(local, query);
  const { data, model } = await groq.chatJSON({ messages: P.triage({ incident, memories: mem, mode: 'memory' }), maxTokens: 1500 });
  res.json({ result: P.normaliseTriage(data), model, recalled: hits.map((h) => ({ id: h.memory.id, title: h.memory.title, relevance: Number(h.score.toFixed(3)) })) });
}));

/** POST /api/ai/chat  body: { messages:[{role,content}], memories? } */
router.post('/ai/chat', wrap(async (req, res) => {
  const { messages, memories } = req.body || {};
  need(Array.isArray(messages) && messages.length, 'messages[] is required');
  need(messages[messages.length - 1].role === 'user', 'last message must be from the user');
  const last = String(messages[messages.length - 1].content || '');
  const mem = await withHindsight(P.cleanMemories(memories), last);
  const { text, model } = await groq.chat({ messages: P.chat({ messages, memories: mem }), maxTokens: 900, temperature: 0.3 });
  res.json({ reply: text, model });
}));

/** POST /api/ai/postmortem  body: { incident, notes?, memories? } */
router.post('/ai/postmortem', wrap(async (req, res) => {
  const { incident, notes, memories } = req.body || {};
  need(incident && typeof incident === 'object', 'incident is required');
  const { data, model } = await groq.chatJSON({ messages: P.postmortem({ incident, notes, memories }), maxTokens: 1200 });
  res.json({
    result: {
      rootCause: String(data.rootCause || '').slice(0, 600),
      steps: (Array.isArray(data.steps) ? data.steps : []).map((s) => String(s).slice(0, 260)).slice(0, 8),
      lessons: String(data.lessons || '').slice(0, 500),
      prevention: (Array.isArray(data.prevention) ? data.prevention : []).map((s) => String(s).slice(0, 240)).slice(0, 4),
    },
    model,
  });
}));

/** POST /api/ai/summary  body: { incident:{…, status, timeline[], resolution} } */
router.post('/ai/summary', wrap(async (req, res) => {
  const { incident } = req.body || {};
  need(incident && typeof incident === 'object', 'incident is required');
  const { data, model } = await groq.chatJSON({ messages: P.summary({ incident }), maxTokens: 900 });
  res.json({
    result: {
      statusUpdate: String(data.statusUpdate || '').slice(0, 400),
      executiveSummary: String(data.executiveSummary || '').slice(0, 600),
      customerImpact: String(data.customerImpact || '').slice(0, 400),
      nextSteps: (Array.isArray(data.nextSteps) ? data.nextSteps : []).map((s) => String(s).slice(0, 200)).slice(0, 5),
    },
    model,
  });
}));

module.exports = router;
