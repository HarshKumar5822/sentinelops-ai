'use strict';
const express = require('express');
const cors = require('cors');
const cfg = require('./config');
const rateLimit = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { Store } = require('./services/store');

function createApp({ store = new Store() } = {}) {
  const app = express();
  app.locals.store = store;
  app.disable('x-powered-by');
  app.use(cors({ origin: cfg.corsOrigin === '*' ? true : cfg.corsOrigin.split(',') }));
  app.use(express.json({ limit: '6mb' }));

  app.use('/api', rateLimit({ perMinute: cfg.rateLimitPerMin }));
  app.use('/api', require('./routes/health'));
  app.use('/api', require('./routes/ai'));
  app.use('/api', require('./routes/memory'));
  app.use('/api', require('./routes/state'));
  app.use('/api', require('./routes/hindsight'));
  app.use('/api', notFound);

  // The frontend is served from the same origin, so `npm start` is all you need.
  app.use(express.static(cfg.frontendDir));
  app.use(errorHandler);
  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(cfg.port, () => {
    const ai = cfg.groqKey ? `Groq ✔ (${cfg.groqModel})` : 'Groq ✘  (add GROQ_API_KEY to backend/.env)';
    console.log(`\n  🛡️  SentinelOps AI is running`);
    console.log(`  → App        http://localhost:${cfg.port}`);
    console.log(`  → API health http://localhost:${cfg.port}/api/health`);
    console.log(`  → AI         ${ai}`);
    console.log(`  → Hindsight  ${cfg.hindsight.enabled ? 'bridge ON → ' + cfg.hindsight.baseUrl : 'bridge off (local memory engine)'}\n`);
  });
}
module.exports = { createApp };
