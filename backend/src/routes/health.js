'use strict';
const router = require('express').Router();
const cfg = require('../config');
const groq = require('../services/groq');
const hindsight = require('../services/hindsight');

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    name: 'SentinelOps AI',
    version: '2.0.0',
    uptimeSec: Math.round(process.uptime()),
    ai: { configured: groq.isConfigured(), provider: 'groq', model: cfg.groqModel, fallback: cfg.groqFallback },
    hindsight: hindsight.status(),
    time: new Date().toISOString(),
  });
});
module.exports = router;
